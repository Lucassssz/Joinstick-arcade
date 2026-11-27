import { useEffect, useState } from 'react';
import type { GameId, RoomMode, RoomStatus } from '../shared/types';

export type HostAuthRole = 'master' | 'guest';
export type GuestPassMode = 'single-use' | 'timed';

export interface HostAuthSession {
  token: string;
  role: HostAuthRole;
  expiresAt: number;
  passLabel?: string;
  singleUse?: boolean;
}

export interface HostAuthStatus {
  masterConfigured: boolean;
  usingEnvPin: boolean;
  publicAccessOpen: boolean;
}

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

export interface RoomActivityEvent {
  id: string;
  roomCode: string;
  timestamp: number;
  kind:
    | 'room-created'
    | 'player-joined'
    | 'player-left'
    | 'lobby'
    | 'game-selected'
    | 'match-started'
    | 'match-finished'
    | 'room-closed';
  summaryEn: string;
  summaryZh: string;
}

export interface OwnerRoomPlayerSummary {
  id: string;
  name: string;
  colorHex: string;
  isBot: boolean;
  connected: boolean;
  ready: boolean;
  isHost: boolean;
  score: number;
}

export interface OwnerActiveRoomSummary {
  code: string;
  roomMode: RoomMode;
  status: RoomStatus;
  selectedGameId: GameId;
  createdAt: number;
  lastActivityAt: number;
  matchElapsedSec: number;
  hostConnected: boolean;
  playerCount: number;
  humanCount: number;
  connectedHumanCount: number;
  botCount: number;
  players: OwnerRoomPlayerSummary[];
  activity: RoomActivityEvent[];
}

export interface OwnerRoomsDashboard {
  rooms: OwnerActiveRoomSummary[];
  recentActivity: RoomActivityEvent[];
  serverTime: number;
}

// Held strictly in JS/React memory (never written to localStorage/sessionStorage).
let currentSession: HostAuthSession | null = null;
let currentPublicAccessOpen = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const fn of listeners) fn();
}

export function getPublicAccessOpen(): boolean {
  return currentPublicAccessOpen;
}

export function setPublicAccessOpenLocally(open: boolean): void {
  const next = Boolean(open);
  if (currentPublicAccessOpen !== next) {
    currentPublicAccessOpen = next;
    notifyListeners();
  }
}

export function getHostAuthSession(): HostAuthSession | null {
  if (currentSession && Date.now() > currentSession.expiresAt) {
    currentSession = null;
  }
  return currentSession;
}

export function getHostAuthToken(): string | null {
  return getHostAuthSession()?.token ?? null;
}

export function setHostAuthSession(session: HostAuthSession | null): void {
  currentSession = session;
  notifyListeners();
}

export class HostAuthApiError extends Error {
  public readonly status: number;
  public readonly isAuthError: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HostAuthApiError';
    this.status = status;
    this.isAuthError = status === 401 || status === 403;
  }
}

async function parseJsonSafe<T>(res: Response): Promise<Partial<T>> {
  try {
    const parsed = (await res.json()) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Partial<T>;
    }
    return {};
  } catch {
    return {};
  }
}

export function clearHostAuthSessionLocally(): void {
  if (currentSession !== null) {
    currentSession = null;
    notifyListeners();
  }
}

function handleOwnerAuthFailure(res: Response, fallbackMsg: string, serverError?: string): never {
  if (res.status === 401 || res.status === 403) {
    clearHostAuthSessionLocally();
    throw new HostAuthApiError(
      serverError || 'Owner session expired. Please unlock with your Master PIN again.',
      res.status
    );
  }
  throw new HostAuthApiError(serverError || fallbackMsg, res.status);
}

export function clearHostAuthSession(): void {
  const token = currentSession?.token;
  currentSession = null;
  notifyListeners();
  if (token) {
    void fetch('/api/host-auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
}

export function consumeGuestSingleUseTokenLocally(): void {
  if (currentSession?.singleUse) {
    currentSession = null;
    notifyListeners();
  }
}

export function useHostAuthSession(): HostAuthSession | null {
  const [session, setSession] = useState<HostAuthSession | null>(() => getHostAuthSession());
  useEffect(() => {
    const sync = () => setSession(getHostAuthSession());
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return session;
}

export function usePublicAccessOpen(): boolean {
  const [open, setOpen] = useState<boolean>(() => getPublicAccessOpen());
  useEffect(() => {
    const sync = () => setOpen(getPublicAccessOpen());
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);
  return open;
}

export async function fetchHostAuthStatus(): Promise<HostAuthStatus> {
  const res = await fetch('/api/host-auth/status', { cache: 'no-store' });
  if (!res.ok) {
    throw new HostAuthApiError('Failed to check host auth status', res.status);
  }
  const data = await parseJsonSafe<HostAuthStatus>(res);
  const status: HostAuthStatus = {
    masterConfigured: Boolean(data.masterConfigured),
    usingEnvPin: Boolean(data.usingEnvPin),
    publicAccessOpen: Boolean(data.publicAccessOpen),
  };
  setPublicAccessOpenLocally(status.publicAccessOpen);
  return status;
}

export async function verifyHostCode(
  code: string,
  opts?: { requireMaster?: boolean }
): Promise<HostAuthSession> {
  const res = await fetch('/api/host-auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, requireMaster: Boolean(opts?.requireMaster) }),
  });
  const data = await parseJsonSafe<{
    ok?: boolean;
    token?: string;
    role?: HostAuthRole;
    expiresAt?: number;
    passLabel?: string;
    singleUse?: boolean;
    error?: string;
  }>(res);
  if (!res.ok || !data.token || !data.role || typeof data.expiresAt !== 'number') {
    throw new HostAuthApiError(data.error || 'Invalid PIN or Guest Pass', res.status);
  }
  const session: HostAuthSession = {
    token: data.token,
    role: data.role,
    expiresAt: data.expiresAt,
    passLabel: data.passLabel,
    singleUse: data.singleUse,
  };
  setHostAuthSession(session);
  return session;
}

export async function listGuestPasses(): Promise<{
  passes: GuestPassSummary[];
  usingEnvPin: boolean;
  publicAccessOpen: boolean;
}> {
  const token = getHostAuthToken();
  if (!token) throw new HostAuthApiError('Master session required', 401);
  const res = await fetch('/api/host-auth/passes', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await parseJsonSafe<{
    passes?: GuestPassSummary[];
    usingEnvPin?: boolean;
    publicAccessOpen?: boolean;
    error?: string;
  }>(res);
  if (!res.ok || !Array.isArray(data.passes)) {
    handleOwnerAuthFailure(res, 'Failed to load guest passes', data.error);
  }
  const publicAccessOpen = Boolean(data.publicAccessOpen);
  setPublicAccessOpenLocally(publicAccessOpen);
  return { passes: data.passes, usingEnvPin: Boolean(data.usingEnvPin), publicAccessOpen };
}

export async function setPlatformPublicAccess(open: boolean): Promise<boolean> {
  const token = getHostAuthToken();
  if (!token) throw new HostAuthApiError('Master session required', 401);
  const res = await fetch('/api/host-auth/public-access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ open: Boolean(open) }),
  });
  const data = await parseJsonSafe<{
    ok?: boolean;
    publicAccessOpen?: boolean;
    error?: string;
  }>(res);
  if (!res.ok || typeof data.publicAccessOpen !== 'boolean') {
    handleOwnerAuthFailure(res, 'Failed to update platform access', data.error);
  }
  setPublicAccessOpenLocally(data.publicAccessOpen);
  return data.publicAccessOpen;
}

export async function createGuestPass(opts: {
  label?: string;
  mode: GuestPassMode;
  hours?: number;
}): Promise<{ pass: GuestPassSummary; code: string }> {
  const token = getHostAuthToken();
  if (!token) throw new HostAuthApiError('Master session required', 401);
  const res = await fetch('/api/host-auth/passes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(opts),
  });
  const data = await parseJsonSafe<{
    pass?: GuestPassSummary;
    code?: string;
    error?: string;
  }>(res);
  if (!res.ok || !data.pass || !data.code) {
    handleOwnerAuthFailure(res, 'Failed to create guest pass', data.error);
  }
  return { pass: data.pass, code: data.code };
}

export async function revokeGuestPass(id: string): Promise<void> {
  const token = getHostAuthToken();
  if (!token) throw new HostAuthApiError('Master session required', 401);
  const res = await fetch(`/api/host-auth/passes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await parseJsonSafe<{ error?: string }>(res);
    handleOwnerAuthFailure(res, 'Failed to revoke pass', data.error);
  }
}

export async function changeMasterPin(newPin: string): Promise<void> {
  const token = getHostAuthToken();
  if (!token) throw new HostAuthApiError('Master session required', 401);
  const res = await fetch('/api/host-auth/change-pin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pin: newPin }),
  });
  if (!res.ok) {
    const data = await parseJsonSafe<{ error?: string }>(res);
    handleOwnerAuthFailure(res, 'Failed to update PIN', data.error);
  }
}

export async function fetchOwnerRoomsDashboard(): Promise<OwnerRoomsDashboard> {
  const token = getHostAuthToken();
  if (!token) throw new HostAuthApiError('Master session required', 401);
  const res = await fetch('/api/owner/rooms', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = await parseJsonSafe<Partial<OwnerRoomsDashboard> & { error?: string }>(res);
  if (!res.ok || !Array.isArray(data.rooms)) {
    handleOwnerAuthFailure(res, 'Failed to load active rooms', data.error);
  }
  return {
    rooms: data.rooms,
    recentActivity: Array.isArray(data.recentActivity) ? data.recentActivity : [],
    serverTime: typeof data.serverTime === 'number' && Number.isFinite(data.serverTime)
      ? data.serverTime
      : Date.now(),
  };
}

export async function closeActiveRoomByOwner(code: string): Promise<void> {
  const token = getHostAuthToken();
  if (!token) throw new HostAuthApiError('Master session required', 401);
  const res = await fetch(`/api/owner/rooms/${encodeURIComponent(code.trim().toUpperCase())}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await parseJsonSafe<{ error?: string }>(res);
    handleOwnerAuthFailure(res, 'Failed to close room', data.error);
  }
}
