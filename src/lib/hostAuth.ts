import { useEffect, useState } from 'react';

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

// Held strictly in JS/React memory (never written to localStorage/sessionStorage).
let currentSession: HostAuthSession | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const fn of listeners) fn();
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

export async function fetchHostAuthStatus(): Promise<HostAuthStatus> {
  const res = await fetch('/api/host-auth/status', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to check host auth status');
  }
  return (await res.json()) as HostAuthStatus;
}

export async function claimInitialMasterPin(pin: string): Promise<HostAuthSession> {
  const res = await fetch('/api/host-auth/claim-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    token?: string;
    role?: HostAuthRole;
    expiresAt?: number;
    error?: string;
  };
  if (!res.ok || !data.token || !data.role || !data.expiresAt) {
    throw new Error(data.error || 'Failed to set Master PIN');
  }
  const session: HostAuthSession = {
    token: data.token,
    role: data.role,
    expiresAt: data.expiresAt,
  };
  setHostAuthSession(session);
  return session;
}

export async function verifyHostCode(code: string): Promise<HostAuthSession> {
  const res = await fetch('/api/host-auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    token?: string;
    role?: HostAuthRole;
    expiresAt?: number;
    passLabel?: string;
    singleUse?: boolean;
    error?: string;
  };
  if (!res.ok || !data.token || !data.role || !data.expiresAt) {
    throw new Error(data.error || 'Invalid PIN or Guest Pass');
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

export async function listGuestPasses(): Promise<{ passes: GuestPassSummary[]; usingEnvPin: boolean }> {
  const token = getHostAuthToken();
  if (!token) throw new Error('Master session required');
  const res = await fetch('/api/host-auth/passes', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const data = (await res.json()) as {
    passes?: GuestPassSummary[];
    usingEnvPin?: boolean;
    error?: string;
  };
  if (!res.ok || !Array.isArray(data.passes)) {
    throw new Error(data.error || 'Failed to load guest passes');
  }
  return { passes: data.passes, usingEnvPin: Boolean(data.usingEnvPin) };
}

export async function createGuestPass(opts: {
  label?: string;
  mode: GuestPassMode;
  hours?: number;
}): Promise<{ pass: GuestPassSummary; code: string }> {
  const token = getHostAuthToken();
  if (!token) throw new Error('Master session required');
  const res = await fetch('/api/host-auth/passes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(opts),
  });
  const data = (await res.json()) as {
    pass?: GuestPassSummary;
    code?: string;
    error?: string;
  };
  if (!res.ok || !data.pass || !data.code) {
    throw new Error(data.error || 'Failed to create guest pass');
  }
  return { pass: data.pass, code: data.code };
}

export async function revokeGuestPass(id: string): Promise<void> {
  const token = getHostAuthToken();
  if (!token) throw new Error('Master session required');
  const res = await fetch(`/api/host-auth/passes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to revoke pass');
  }
}

export async function changeMasterPin(newPin: string): Promise<void> {
  const token = getHostAuthToken();
  if (!token) throw new Error('Master session required');
  const res = await fetch('/api/host-auth/change-pin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ pin: newPin }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || 'Failed to update PIN');
  }
}
