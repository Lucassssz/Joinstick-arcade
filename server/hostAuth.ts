import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export type HostAuthRole = 'master' | 'guest';
export type GuestPassMode = 'single-use' | 'timed';

export interface GuestPassSummary {
  id: string;
  label: string;
  codeHint: string;
  mode: GuestPassMode;
  durationHours: number;
  usesRemaining: number | null;
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
  usedAt: number | null;
}

interface StoredGuestPass extends GuestPassSummary {
  codeHash: string;
}

interface MasterPinHashRecord {
  salt: string;
  hashHex: string;
  updatedAt?: number;
  publicAccessOpen?: boolean;
  lastLockedAt?: number;
}

export type HostSessionScope = 'owner-admin' | 'room-host';

interface HostSessionPayload {
  jti: string;
  role: HostAuthRole;
  scope?: HostSessionScope;
  passId?: string;
  label?: string;
  singleUse?: boolean;
  iat: number;
  exp: number;
}

interface RateBucket {
  failures: number;
  resetAt: number;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SINGLE_USE_PASS_TTL_MS = 2 * 60 * 60 * 1000;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES_PER_WINDOW = 12;
const PASS_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OWNER_AUTH_DATA_DIR = path.resolve(CURRENT_DIR, '..', 'data');
const OWNER_AUTH_FILE = path.join(OWNER_AUTH_DATA_DIR, 'owner-auth.json');

// Pre-computed one-way salted scrypt digest for the fixed Owner Master PIN.
// Never store plaintext PINs in source code or on disk; updates from Owner Settings
// overwrite the persisted hash record in OWNER_AUTH_FILE so all devices stay in sync.
const DEFAULT_MASTER_PIN_HASH: MasterPinHashRecord = {
  salt: '202afdde6be8880d934d3a9d9b660e33',
  hashHex:
    '93f248186452d4b8ccac1cc8a1f6d376414be60152206624083f179ae285cba5d7e88b243f4eaaaa225e89259a82b2450a26da81cd1633f80d0c59ad7906ae68',
};

function isValidHashRecord(value: unknown): value is MasterPinHashRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<MasterPinHashRecord>;
  return (
    typeof candidate.salt === 'string' &&
    /^[a-f0-9]{32,64}$/i.test(candidate.salt) &&
    typeof candidate.hashHex === 'string' &&
    /^[a-f0-9]{128}$/i.test(candidate.hashHex)
  );
}

class HostAuthService {
  private readonly signingSecret: string;
  private activeMasterHash: MasterPinHashRecord;
  private readonly guestPasses = new Map<string, StoredGuestPass>();
  private readonly consumedSingleUseTokens = new Set<string>();
  private readonly revokedTokens = new Set<string>();
  private readonly revokedPassIds = new Set<string>();
  private readonly rateLimits = new Map<string, RateBucket>();
  private publicAccessOpen = false;
  private lastLockedAt = Date.now();

  constructor() {
    this.signingSecret =
      (process.env.HOST_AUTH_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
    const persisted = this.loadPersistedMasterHash();
    this.activeMasterHash = persisted ?? DEFAULT_MASTER_PIN_HASH;
    this.publicAccessOpen = Boolean(persisted?.publicAccessOpen);
    this.lastLockedAt =
      typeof persisted?.lastLockedAt === 'number' && Number.isFinite(persisted.lastLockedAt)
        ? persisted.lastLockedAt
        : Date.now();
  }

  private loadPersistedMasterHash(): MasterPinHashRecord | null {
    try {
      if (!fs.existsSync(OWNER_AUTH_FILE)) return null;
      const raw = fs.readFileSync(OWNER_AUTH_FILE, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      if (isValidHashRecord(parsed)) {
        return {
          salt: parsed.salt,
          hashHex: parsed.hashHex,
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined,
          publicAccessOpen:
            typeof parsed.publicAccessOpen === 'boolean' ? parsed.publicAccessOpen : false,
          lastLockedAt:
            typeof parsed.lastLockedAt === 'number' ? parsed.lastLockedAt : undefined,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  private persistMasterHash(record?: MasterPinHashRecord): void {
    try {
      const base = record ?? this.activeMasterHash;
      const toSave: MasterPinHashRecord = {
        salt: base.salt,
        hashHex: base.hashHex,
        updatedAt: base.updatedAt ?? Date.now(),
        publicAccessOpen: this.publicAccessOpen,
        lastLockedAt: this.lastLockedAt,
      };
      this.activeMasterHash = toSave;
      fs.mkdirSync(OWNER_AUTH_DATA_DIR, { recursive: true, mode: 0o700 });
      const tmpFile = path.join(
        OWNER_AUTH_DATA_DIR,
        `.owner-auth-${crypto.randomBytes(6).toString('hex')}.tmp`
      );
      fs.writeFileSync(tmpFile, JSON.stringify(toSave, null, 2), { encoding: 'utf8', mode: 0o600 });
      fs.renameSync(tmpFile, OWNER_AUTH_FILE);
    } catch (err) {
      console.warn('[HostAuth] Could not persist updated Owner Auth state to disk:', err);
    }
  }

  public isMasterConfigured(): boolean {
    return true;
  }

  public isUsingEnvPin(): boolean {
    return false;
  }

  public isPublicAccessOpen(): boolean {
    return this.publicAccessOpen;
  }

  public getLastLockedAt(): number {
    return this.lastLockedAt;
  }

  public setPublicAccess(
    token: string | null | undefined,
    open: boolean
  ):
    | { ok: true; publicAccessOpen: boolean; lastLockedAt: number }
    | { ok: false; status: number; error: string } {
    const session = this.verifyToken(token);
    if (!session || session.role !== 'master') {
      return { ok: false, status: 403, error: 'Master authorization required.' };
    }
    if (typeof open !== 'boolean') {
      return { ok: false, status: 400, error: 'Invalid public access state.' };
    }
    this.publicAccessOpen = open;
    if (!open) {
      this.lastLockedAt = Date.now();
    }
    this.persistMasterHash();
    return {
      ok: true,
      publicAccessOpen: this.publicAccessOpen,
      lastLockedAt: this.lastLockedAt,
    };
  }

  private normalizeCode(raw: string): string {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private hashGuestCode(normalizedCode: string): string {
    return crypto
      .createHmac('sha256', this.signingSecret)
      .update(`guest-pass:${normalizedCode}`)
      .digest('hex');
  }

  private timingSafeEqualStr(a: string, b: string): boolean {
    const da = crypto.createHash('sha256').update(a).digest();
    const db = crypto.createHash('sha256').update(b).digest();
    return crypto.timingSafeEqual(da, db);
  }

  private verifyScryptHash(pin: string, record: MasterPinHashRecord): boolean {
    try {
      const derived = crypto.scryptSync(pin, record.salt, 64);
      const expected = Buffer.from(record.hashHex, 'hex');
      if (derived.length !== expected.length) return false;
      return crypto.timingSafeEqual(derived, expected);
    } catch {
      return false;
    }
  }

  private verifyMasterPin(rawPin: string): boolean {
    const trimmed = rawPin.trim();
    if (!trimmed) return false;
    return this.verifyScryptHash(trimmed, this.activeMasterHash);
  }

  private checkRateLimit(clientKey: string): { allowed: boolean; retryAfterSec: number } {
    const now = Date.now();
    // Prune expired buckets occasionally
    if (this.rateLimits.size > 500) {
      for (const [k, b] of this.rateLimits.entries()) {
        if (b.resetAt <= now) this.rateLimits.delete(k);
      }
    }
    const bucket = this.rateLimits.get(clientKey);
    if (!bucket || bucket.resetAt <= now) {
      return { allowed: true, retryAfterSec: 0 };
    }
    if (bucket.failures >= MAX_FAILURES_PER_WINDOW) {
      return {
        allowed: false,
        retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  private recordFailure(clientKey: string): void {
    const now = Date.now();
    const existing = this.rateLimits.get(clientKey);
    if (!existing || existing.resetAt <= now) {
      this.rateLimits.set(clientKey, { failures: 1, resetAt: now + RATE_WINDOW_MS });
      return;
    }
    existing.failures += 1;
  }

  private clearFailures(clientKey: string): void {
    this.rateLimits.delete(clientKey);
  }

  private signToken(payload: HostSessionPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(body)
      .digest('base64url');
    return `${body}.${sig}`;
  }

  public verifyToken(token?: string | null): HostSessionPayload | null {
    if (!token || typeof token !== 'string') return null;
    const dotIdx = token.indexOf('.');
    if (dotIdx <= 0) return null;
    const body = token.slice(0, dotIdx);
    const sig = token.slice(dotIdx + 1);
    if (!body || !sig) return null;

    const expectedSig = crypto
      .createHmac('sha256', this.signingSecret)
      .update(body)
      .digest('base64url');
    if (!this.timingSafeEqualStr(sig, expectedSig)) return null;

    try {
      const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as HostSessionPayload;
      if (!parsed || !parsed.jti || !parsed.role || typeof parsed.exp !== 'number') return null;
      if (Date.now() > parsed.exp) return null;
      if (this.revokedTokens.has(parsed.jti)) return null;
      if (parsed.passId) {
        if (this.revokedPassIds.has(parsed.passId)) return null;
        const pass = this.guestPasses.get(parsed.passId);
        if (!pass || pass.revoked || Date.now() > pass.expiresAt) return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  public claimInitialMasterPin(
    _rawPin: string,
    _clientKey: string
  ): { ok: false; status: number; error: string } {
    return {
      ok: false,
      status: 403,
      error: 'Master PIN is fixed across all devices and can only be changed in Owner Settings.',
    };
  }

  public changeMasterPin(
    token: string | null | undefined,
    newRawPin: string
  ): { ok: true } | { ok: false; status: number; error: string } {
    const session = this.verifyToken(token);
    if (!session || session.role !== 'master') {
      return { ok: false, status: 403, error: 'Master authorization required.' };
    }
    const pin = typeof newRawPin === 'string' ? newRawPin.trim() : '';
    if (pin.length < 4 || pin.length > 24) {
      return { ok: false, status: 400, error: 'New PIN must be 4 to 24 characters.' };
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = crypto.scryptSync(pin, salt, 64).toString('hex');
    const nextRecord: MasterPinHashRecord = { salt, hashHex, updatedAt: Date.now() };
    this.activeMasterHash = nextRecord;
    this.persistMasterHash(nextRecord);
    return { ok: true };
  }

  public verifyCode(
    rawCode: string,
    clientKey: string,
    opts?: { requireMaster?: boolean }
  ):
    | {
        ok: true;
        token: string;
        role: HostAuthRole;
        scope: HostSessionScope;
        issuedAt: number;
        expiresAt: number;
        passLabel?: string;
        singleUse?: boolean;
      }
    | { ok: false; status: number; error: string } {
    const requireMaster = Boolean(opts?.requireMaster);
    const scope: HostSessionScope = requireMaster ? 'owner-admin' : 'room-host';
    const rate = this.checkRateLimit(clientKey);
    if (!rate.allowed) {
      return {
        ok: false,
        status: 429,
        error: `Too many attempts. Try again in ${rate.retryAfterSec}s.`,
      };
    }

    if (!this.isMasterConfigured()) {
      return {
        ok: false,
        status: 409,
        error: 'Master PIN has not been set up yet.',
      };
    }

    const input = typeof rawCode === 'string' ? rawCode.trim() : '';
    if (!input) {
      return {
        ok: false,
        status: 400,
        error: requireMaster
          ? 'Enter your Owner Master PIN.'
          : 'Enter your Master PIN or Guest Pass.',
      };
    }

    // 1. Check Master PIN first
    if (this.verifyMasterPin(input)) {
      this.clearFailures(clientKey);
      const now = Date.now();
      const exp = now + SESSION_TTL_MS;
      const token = this.signToken({
        jti: crypto.randomUUID(),
        role: 'master',
        scope,
        iat: now,
        exp,
      });
      return { ok: true, token, role: 'master', scope, issuedAt: now, expiresAt: exp };
    }

    if (requireMaster) {
      this.recordFailure(clientKey);
      return {
        ok: false,
        status: 401,
        error: 'Invalid Owner Master PIN.',
      };
    }

    // 2. Check disposable Guest Pass codes
    const normalized = this.normalizeCode(input);
    if (normalized.length >= 6) {
      const candidateHash = this.hashGuestCode(normalized);
      const now = Date.now();
      for (const pass of this.guestPasses.values()) {
        if (!this.timingSafeEqualStr(candidateHash, pass.codeHash)) continue;
        if (pass.revoked) {
          this.recordFailure(clientKey);
          return { ok: false, status: 401, error: 'This Guest Pass has been revoked.' };
        }
        if (now > pass.expiresAt) {
          this.recordFailure(clientKey);
          return { ok: false, status: 401, error: 'This Guest Pass has expired.' };
        }
        if (pass.mode === 'single-use' && (pass.usesRemaining ?? 0) <= 0) {
          this.recordFailure(clientKey);
          return { ok: false, status: 401, error: 'This 1-time Guest Pass has already been used.' };
        }

        // Consume single-use verification slot immediately so another friend cannot reuse the same code,
        // while granting the bearer token a single room-creation allowance until used or expired.
        if (pass.mode === 'single-use') {
          pass.usesRemaining = 0;
          pass.usedAt = now;
        }

        this.clearFailures(clientKey);
        const exp = Math.min(pass.expiresAt, now + SESSION_TTL_MS);
        const token = this.signToken({
          jti: crypto.randomUUID(),
          role: 'guest',
          scope: 'room-host',
          passId: pass.id,
          label: pass.label,
          singleUse: pass.mode === 'single-use',
          iat: now,
          exp,
        });
        return {
          ok: true,
          token,
          role: 'guest',
          scope: 'room-host',
          issuedAt: now,
          expiresAt: exp,
          passLabel: pass.label,
          singleUse: pass.mode === 'single-use',
        };
      }
    }

    this.recordFailure(clientKey);
    return {
      ok: false,
      status: 401,
      error: 'Invalid PIN or Guest Pass.',
    };
  }

  public consumeRoomCreation(token?: string | null): { ok: true; session: HostSessionPayload } | { ok: false; error: string } {
    if (this.publicAccessOpen) {
      const existingSession = this.verifyToken(token);
      const now = Date.now();
      return {
        ok: true,
        session: existingSession ?? {
          jti: 'public-open',
          role: 'guest',
          scope: 'room-host',
          iat: now,
          exp: now + SESSION_TTL_MS,
        },
      };
    }

    const session = this.verifyToken(token);
    if (!session || session.scope === 'owner-admin' || session.iat < this.lastLockedAt) {
      return { ok: false, error: 'Host unlock required. Enter Master PIN or a Guest Pass.' };
    }
    if (session.singleUse) {
      if (this.consumedSingleUseTokens.has(session.jti)) {
        return {
          ok: false,
          error: 'Your 1-time Guest Pass already created a room. Ask the owner for a new pass.',
        };
      }
      this.consumedSingleUseTokens.add(session.jti);
    }
    return { ok: true, session };
  }

  public revokeSessionToken(token?: string | null): void {
    const session = this.verifyToken(token);
    if (session) {
      this.revokedTokens.add(session.jti);
    }
  }

  private generatePassCode(): string {
    const bytes = crypto.randomBytes(8);
    let chars = '';
    for (let i = 0; i < 8; i++) {
      chars += PASS_ALPHABET[bytes[i] % PASS_ALPHABET.length];
    }
    return `GP-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
  }

  public createGuestPass(
    token: string | null | undefined,
    opts: { label?: string; mode?: GuestPassMode; hours?: number }
  ): { ok: true; pass: GuestPassSummary; code: string } | { ok: false; status: number; error: string } {
    const session = this.verifyToken(token);
    if (!session || session.role !== 'master') {
      return { ok: false, status: 403, error: 'Master PIN sign-in required to create Guest Passes.' };
    }

    this.pruneOldPasses();
    const mode: GuestPassMode = opts.mode === 'timed' ? 'timed' : 'single-use';
    const rawHours = Number(opts.hours);
    const allowedHours = mode === 'single-use' ? 2 : [1, 4, 12, 24].includes(rawHours) ? rawHours : 4;

    const cleanLabel =
      typeof opts.label === 'string' && opts.label.trim()
        ? opts.label.trim().slice(0, 24)
        : mode === 'single-use'
        ? '1-Time Friend'
        : `${allowedHours}h Party Pass`;

    const code = this.generatePassCode();
    const normalized = this.normalizeCode(code);
    const now = Date.now();
    const expiresAt =
      mode === 'single-use' ? now + SINGLE_USE_PASS_TTL_MS : now + allowedHours * 60 * 60 * 1000;

    const id = crypto.randomUUID();
    const stored: StoredGuestPass = {
      id,
      label: cleanLabel,
      codeHint: `GP-••••-${code.slice(-4)}`,
      mode,
      durationHours: allowedHours,
      usesRemaining: mode === 'single-use' ? 1 : null,
      createdAt: now,
      expiresAt,
      revoked: false,
      usedAt: null,
      codeHash: this.hashGuestCode(normalized),
    };

    this.guestPasses.set(id, stored);
    const { codeHash: _ignored, ...summary } = stored;
    return { ok: true, pass: summary, code };
  }

  public listGuestPasses(
    token: string | null | undefined
  ):
    | {
        ok: true;
        passes: GuestPassSummary[];
        usingEnvPin: boolean;
        publicAccessOpen: boolean;
        lastLockedAt: number;
      }
    | { ok: false; status: number; error: string } {
    const session = this.verifyToken(token);
    if (!session || session.role !== 'master') {
      return { ok: false, status: 403, error: 'Master authorization required.' };
    }
    this.pruneOldPasses();
    const passes = Array.from(this.guestPasses.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ codeHash: _ignored, ...summary }) => summary);
    return {
      ok: true,
      passes,
      usingEnvPin: this.isUsingEnvPin(),
      publicAccessOpen: this.publicAccessOpen,
      lastLockedAt: this.lastLockedAt,
    };
  }

  public revokeGuestPass(
    token: string | null | undefined,
    passId: string
  ): { ok: true } | { ok: false; status: number; error: string } {
    const session = this.verifyToken(token);
    if (!session || session.role !== 'master') {
      return { ok: false, status: 403, error: 'Master authorization required.' };
    }
    const pass = this.guestPasses.get(passId);
    if (!pass) {
      return { ok: false, status: 404, error: 'Guest Pass not found.' };
    }
    pass.revoked = true;
    this.revokedPassIds.add(passId);
    return { ok: true };
  }

  private pruneOldPasses(): void {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    for (const [id, pass] of this.guestPasses.entries()) {
      if (pass.createdAt < cutoff && (pass.revoked || Date.now() > pass.expiresAt)) {
        this.guestPasses.delete(id);
        this.revokedPassIds.delete(id);
      }
    }
    if (this.consumedSingleUseTokens.size > 2000) {
      this.consumedSingleUseTokens.clear();
    }
    if (this.revokedTokens.size > 2000) {
      this.revokedTokens.clear();
    }
  }
}

export const hostAuth = new HostAuthService();
