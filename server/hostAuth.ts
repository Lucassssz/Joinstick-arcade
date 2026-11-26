import crypto from 'crypto';

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

interface HostSessionPayload {
  jti: string;
  role: HostAuthRole;
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

class HostAuthService {
  private readonly signingSecret: string;
  private claimedMasterHash: { salt: string; hashHex: string } | null = null;
  private readonly guestPasses = new Map<string, StoredGuestPass>();
  private readonly consumedSingleUseTokens = new Set<string>();
  private readonly revokedTokens = new Set<string>();
  private readonly revokedPassIds = new Set<string>();
  private readonly rateLimits = new Map<string, RateBucket>();

  constructor() {
    this.signingSecret =
      (process.env.HOST_AUTH_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
  }

  private getEnvPin(): string {
    return (process.env.HOST_MASTER_PIN || '').trim();
  }

  public isMasterConfigured(): boolean {
    return Boolean(this.getEnvPin()) || Boolean(this.claimedMasterHash);
  }

  public isUsingEnvPin(): boolean {
    return Boolean(this.getEnvPin());
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

  private verifyScryptHash(pin: string, record: { salt: string; hashHex: string }): boolean {
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
    const envPin = this.getEnvPin();
    if (envPin) {
      return this.timingSafeEqualStr(trimmed, envPin);
    }
    if (this.claimedMasterHash) {
      return this.verifyScryptHash(trimmed, this.claimedMasterHash);
    }
    return false;
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
    rawPin: string,
    clientKey: string
  ): { ok: true; token: string; role: 'master'; expiresAt: number } | { ok: false; status: number; error: string } {
    const rate = this.checkRateLimit(clientKey);
    if (!rate.allowed) {
      return {
        ok: false,
        status: 429,
        error: `Too many attempts. Try again in ${rate.retryAfterSec}s.`,
      };
    }

    if (this.isMasterConfigured()) {
      return {
        ok: false,
        status: 409,
        error: 'Master PIN is already configured.',
      };
    }

    const pin = typeof rawPin === 'string' ? rawPin.trim() : '';
    if (pin.length < 4 || pin.length > 24) {
      this.recordFailure(clientKey);
      return {
        ok: false,
        status: 400,
        error: 'PIN must be between 4 and 24 characters.',
      };
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = crypto.scryptSync(pin, salt, 64).toString('hex');
    this.claimedMasterHash = { salt, hashHex };
    this.clearFailures(clientKey);

    const now = Date.now();
    const exp = now + SESSION_TTL_MS;
    const token = this.signToken({
      jti: crypto.randomUUID(),
      role: 'master',
      iat: now,
      exp,
    });
    return { ok: true, token, role: 'master', expiresAt: exp };
  }

  public changeMasterPin(
    token: string | null | undefined,
    newRawPin: string
  ): { ok: true } | { ok: false; status: number; error: string } {
    const session = this.verifyToken(token);
    if (!session || session.role !== 'master') {
      return { ok: false, status: 403, error: 'Master authorization required.' };
    }
    if (this.isUsingEnvPin()) {
      return {
        ok: false,
        status: 409,
        error: 'Master PIN is managed by server environment configuration (HOST_MASTER_PIN).',
      };
    }
    const pin = typeof newRawPin === 'string' ? newRawPin.trim() : '';
    if (pin.length < 4 || pin.length > 24) {
      return { ok: false, status: 400, error: 'New PIN must be 4 to 24 characters.' };
    }
    const salt = crypto.randomBytes(16).toString('hex');
    const hashHex = crypto.scryptSync(pin, salt, 64).toString('hex');
    this.claimedMasterHash = { salt, hashHex };
    return { ok: true };
  }

  public verifyCode(
    rawCode: string,
    clientKey: string
  ):
    | {
        ok: true;
        token: string;
        role: HostAuthRole;
        expiresAt: number;
        passLabel?: string;
        singleUse?: boolean;
      }
    | { ok: false; status: number; error: string } {
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
      return { ok: false, status: 400, error: 'Enter your Master PIN or Guest Pass.' };
    }

    // 1. Check Master PIN first
    if (this.verifyMasterPin(input)) {
      this.clearFailures(clientKey);
      const now = Date.now();
      const exp = now + SESSION_TTL_MS;
      const token = this.signToken({
        jti: crypto.randomUUID(),
        role: 'master',
        iat: now,
        exp,
      });
      return { ok: true, token, role: 'master', expiresAt: exp };
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
    const session = this.verifyToken(token);
    if (!session) {
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
  ): { ok: true; passes: GuestPassSummary[]; usingEnvPin: boolean } | { ok: false; status: number; error: string } {
    const session = this.verifyToken(token);
    if (!session || session.role !== 'master') {
      return { ok: false, status: 403, error: 'Master authorization required.' };
    }
    this.pruneOldPasses();
    const passes = Array.from(this.guestPasses.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ codeHash: _ignored, ...summary }) => summary);
    return { ok: true, passes, usingEnvPin: this.isUsingEnvPin() };
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
