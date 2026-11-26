import { ClientMessage, ServerMessage } from '../shared/types';

export type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

export function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function getJoinUrl(roomCode: string, lang?: 'en' | 'zh'): string {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('mode', 'controller');
  url.searchParams.set('room', roomCode.toUpperCase());
  if (lang === 'zh') {
    url.searchParams.set('lang', 'zh');
  }
  return url.toString();
}

export interface ManagedSocketCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onRecover?: () => void;
  onStatusChange?: (status: SocketStatus) => void;
  onPendingOpsChange?: (pendingCount: number) => void;
  onMessage: (msg: ServerMessage) => void;
}

const PING_INTERVAL_MS = 5_000;
const PONG_TIMEOUT_MS = 18_000;
const SILENCE_TIMEOUT_MS = 28_000;
const CONNECT_TIMEOUT_MS = 8_000;
const INITIAL_RECONNECT_MS = 200;
const MAX_RECONNECT_MS = 3_000;
const PENDING_OP_TTL_MS = 10_000;

const RELIABLE_OP_TYPES = new Set<ClientMessage['type']>([
  'room:add-bot',
  'room:remove-bot',
  'room:kick-player',
  'room:set-bot-difficulty',
  'room:set-team-mode',
  'room:set-player-team',
  'room:shuffle-teams',
  'room:set-host-player',
  'room:set-mutator',
  'room:spin-mutator',
  'room:enter-game-room',
  'room:return-setup',
  'lobby:filter',
  'player:ready',
  'player:set-avatar',
  'player:set-team',
  'game:select',
  'game:start',
  'game:dismiss-briefing',
  'game:pause',
  'game:restart',
  'game:return-lobby',
  'tournament:start',
  'tournament:vote',
  'tournament:force-lock-vote',
  'tournament:next',
  'tournament:exit',
  'card:action',
]);

interface PendingOpEntry {
  opId: string;
  msg: ClientMessage;
  createdAt: number;
}

export class ManagedWebSocket {
  private ws: WebSocket | null = null;
  private status: SocketStatus = 'connecting';
  private closedManually = false;
  private reconnectDelay = INITIAL_RECONNECT_MS;
  private consecutiveFailures = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectStartedAt = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private lastWatchdogTickAt = 0;
  private awaitingPongSince: number | null = null;
  private queue: ClientMessage[] = [];
  private pendingOps: PendingOpEntry[] = [];
  private opCounter = 0;
  private readonly clientNonce = Math.random().toString(36).slice(2, 8);
  private callbacks: ManagedSocketCallbacks;

  constructor(callbacks: ManagedSocketCallbacks) {
    this.callbacks = callbacks;
    this.bindLifecycleEvents();
    this.connect();
  }

  private setStatus(next: SocketStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.callbacks.onStatusChange?.(next);
  }

  public getStatus(): SocketStatus {
    return this.status;
  }

  public isConnected(): boolean {
    return Boolean(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  public getPendingOpCount(): number {
    this.pruneExpiredOps();
    return this.pendingOps.length;
  }

  public getLastMessageAt(): number {
    return this.lastMessageAt;
  }

  public clearPendingOps(): void {
    if (this.pendingOps.length === 0) return;
    this.pendingOps = [];
    this.callbacks.onPendingOpsChange?.(0);
  }

  public requestSync(knownStateSeq?: number, knownTickSeq?: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'room:sync',
          knownStateSeq,
          knownTickSeq,
        })
      );
    } catch {
      this.forceDropAndReconnect(true);
    }
  }

  private pruneExpiredOps(): void {
    if (this.pendingOps.length === 0) return;
    const cutoff = Date.now() - PENDING_OP_TTL_MS;
    const next = this.pendingOps.filter((op) => op.createdAt >= cutoff);
    if (next.length !== this.pendingOps.length) {
      this.pendingOps = next;
      this.callbacks.onPendingOpsChange?.(this.pendingOps.length);
    }
  }

  private handleOnline = (): void => {
    if (this.closedManually) return;
    this.reconnectDelay = INITIAL_RECONNECT_MS;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.reconnectNow(false);
    } else {
      this.sendHeartbeatProbe(7_000);
      this.callbacks.onRecover?.();
    }
  };

  private handleOffline = (): void => {
    if (this.closedManually) return;
    // Some browsers/OSes emit transient 'offline' events during Wi-Fi roaming; probe before dropping
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendHeartbeatProbe(5_000);
    }
  };

  private handleVisibilityOrShow = (): void => {
    if (this.closedManually) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    this.reconnectDelay = INITIAL_RECONNECT_MS;
    if (
      this.ws &&
      this.ws.readyState === WebSocket.CONNECTING &&
      Date.now() - this.connectStartedAt < CONNECT_TIMEOUT_MS
    ) {
      return;
    }
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.reconnectNow(false);
    } else {
      // Only probe if we haven't heard from the server in >2.5s; give generous 7s window so focus changes never cause false drops
      const now = Date.now();
      if (now - this.lastMessageAt > 2_500) {
        this.lastMessageAt = now;
        this.sendHeartbeatProbe(7_000);
      }
      this.callbacks.onRecover?.();
    }
  };

  private bindLifecycleEvents(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('pageshow', this.handleVisibilityOrShow);
    window.addEventListener('focus', this.handleVisibilityOrShow);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityOrShow);
    }
  }

  private unbindLifecycleEvents(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('pageshow', this.handleVisibilityOrShow);
    window.removeEventListener('focus', this.handleVisibilityOrShow);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityOrShow);
    }
  }

  private clearConnectTimer(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private detachAndCloseSocket(socket: WebSocket | null): void {
    if (!socket) return;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    try {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    } catch {
      // Ignore close errors
    }
  }

  private connect(): void {
    if (this.closedManually) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.clearConnectTimer();

    this.detachAndCloseSocket(this.ws);
    if (this.status !== 'reconnecting') {
      this.setStatus('connecting');
    }

    // After repeated failures, gently nudge /api/health to warm up any idle proxy/container
    if (this.consecutiveFailures >= 2 && typeof fetch === 'function') {
      fetch('/api/health', { cache: 'no-store' }).catch(() => {});
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(getWebSocketUrl());
    } catch {
      this.handleSocketDropped(false);
      return;
    }
    this.ws = ws;
    this.connectStartedAt = Date.now();

    // Prevent stalled TCP/TLS/proxy handshakes from hanging 30-60+ seconds in CONNECTING
    this.connectTimer = setTimeout(() => {
      if (this.ws === ws && ws.readyState !== WebSocket.OPEN && !this.closedManually) {
        this.forceDropAndReconnect(true);
      }
    }, CONNECT_TIMEOUT_MS);

    ws.onopen = () => {
      if (this.ws !== ws || this.closedManually) {
        this.detachAndCloseSocket(ws);
        return;
      }
      this.clearConnectTimer();
      this.reconnectDelay = INITIAL_RECONNECT_MS;
      this.consecutiveFailures = 0;
      const now = Date.now();
      this.lastMessageAt = now;
      this.lastWatchdogTickAt = now;
      this.awaitingPongSince = null;
      this.setStatus('connected');

      this.startHeartbeat();

      // Run onOpen FIRST so room:host-reattach / room:join always binds the socket before queued actions fire
      const pending = this.queue.splice(0, this.queue.length);
      this.callbacks.onOpen?.();

      this.pruneExpiredOps();
      const flushedOpIds = new Set<string>();
      for (const op of this.pendingOps) {
        if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) break;
        flushedOpIds.add(op.opId);
        try {
          ws.send(JSON.stringify(op.msg));
        } catch {
          break;
        }
      }

      for (const msg of pending) {
        if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) break;
        if (
          msg.type === 'room:host-reattach' ||
          msg.type === 'room:join' ||
          msg.type === 'room:create' ||
          msg.type === 'room:sync'
        ) {
          continue; // Handled authoritatively by onOpen / requestSync
        }
        const maybeOpId = (msg as { opId?: string }).opId;
        if (maybeOpId && flushedOpIds.has(maybeOpId)) {
          continue;
        }
        try {
          ws.send(JSON.stringify(msg));
        } catch {
          break;
        }
      }
    };

    ws.onmessage = (event) => {
      if (this.ws !== ws) return;
      this.lastMessageAt = Date.now();
      this.awaitingPongSince = null;
      try {
        const parsed = JSON.parse(event.data) as ServerMessage;
        if (parsed.type === 'room:ack' && parsed.opId) {
          const prevLen = this.pendingOps.length;
          this.pendingOps = this.pendingOps.filter((op) => op.opId !== parsed.opId);
          if (this.pendingOps.length !== prevLen) {
            this.callbacks.onPendingOpsChange?.(this.pendingOps.length);
          }
        } else if (parsed.type === 'room:closed') {
          this.clearPendingOps();
        }
        this.callbacks.onMessage(parsed);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.handleSocketDropped(false);
    };

    ws.onerror = () => {
      // Allow immediate drop check if socket fails during handshake or active state
      if (this.ws !== ws) return;
      if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        this.handleSocketDropped(false);
      }
    };
  }

  private handleSocketDropped(immediate: boolean): void {
    this.clearConnectTimer();
    this.stopHeartbeat();
    this.detachAndCloseSocket(this.ws);
    this.ws = null;
    this.awaitingPongSince = null;
    if (this.closedManually) {
      this.setStatus('closed');
      return;
    }
    this.consecutiveFailures += 1;
    this.setStatus('reconnecting');
    this.callbacks.onClose?.();

    const jitter = Math.floor(Math.random() * 220);
    const delay = immediate ? 150 : this.reconnectDelay + jitter;
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.reconnectDelay = Math.min(MAX_RECONNECT_MS, Math.round(this.reconnectDelay * 1.5));
        this.connect();
      }, delay);
    }
  }

  private forceDropAndReconnect(immediate: boolean): void {
    if (this.closedManually) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.handleSocketDropped(immediate);
  }

  public reconnectNow(force = true): void {
    if (this.closedManually) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectDelay = INITIAL_RECONNECT_MS;

    // Never abort an in-flight handshake that is still within CONNECT_TIMEOUT_MS unless explicitly forced
    if (
      !force &&
      this.ws &&
      this.ws.readyState === WebSocket.CONNECTING &&
      Date.now() - this.connectStartedAt < CONNECT_TIMEOUT_MS
    ) {
      return;
    }

    this.clearConnectTimer();
    this.stopHeartbeat();
    this.detachAndCloseSocket(this.ws);
    this.ws = null;
    this.awaitingPongSince = null;
    this.setStatus('reconnecting');
    this.connect();
  }

  private sendHeartbeatProbe(maxWaitMs?: number): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ type: 'ping' }));
      const now = Date.now();
      if (maxWaitMs !== undefined) {
        const candidateStart = now - Math.max(0, PONG_TIMEOUT_MS - maxWaitMs);
        // Never make an existing waiting deadline shorter than maxWaitMs from now
        this.awaitingPongSince =
          this.awaitingPongSince === null ? candidateStart : Math.max(this.awaitingPongSince, candidateStart);
      } else if (this.awaitingPongSince === null) {
        this.awaitingPongSince = now;
      }
    } catch {
      this.forceDropAndReconnect(true);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const now = Date.now();
    this.lastMessageAt = now;
    this.lastWatchdogTickAt = now;
    this.awaitingPongSince = null;

    this.pingTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        if (!this.closedManually && !this.reconnectTimer) {
          this.forceDropAndReconnect(true);
        }
        return;
      }
      this.sendHeartbeatProbe();
    }, PING_INTERVAL_MS);

    this.watchdogTimer = setInterval(() => {
      if (this.closedManually) return;
      if (!this.ws) {
        if (!this.reconnectTimer) this.forceDropAndReconnect(true);
        return;
      }
      if (this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
        this.forceDropAndReconnect(true);
        return;
      }
      if (this.ws.readyState !== WebSocket.OPEN) return;

      const now = Date.now();
      const tickDelta = now - this.lastWatchdogTickAt;
      this.lastWatchdogTickAt = now;

      // If browser throttled/paused JS timers (e.g. screen dim/background tab), probe generously before dropping
      if (tickDelta > 4_000) {
        this.lastMessageAt = now;
        this.sendHeartbeatProbe(7_000);
        return;
      }

      const pongTimedOut =
        this.awaitingPongSince !== null && now - this.awaitingPongSince > PONG_TIMEOUT_MS;
      const silenceTimedOut = now - this.lastMessageAt > SILENCE_TIMEOUT_MS;
      if (pongTimedOut || silenceTimedOut) {
        this.forceDropAndReconnect(true);
      }
    }, 1_500);
  }

  private stopHeartbeat(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
  }

  public send(msg: ClientMessage): void {
    let outbound = msg;
    if (RELIABLE_OP_TYPES.has(msg.type)) {
      const existingOpId = (msg as { opId?: string }).opId;
      const opId = existingOpId || `${this.clientNonce}_${++this.opCounter}`;
      outbound = { ...msg, opId } as ClientMessage;
      this.pruneExpiredOps();
      if (!this.pendingOps.some((op) => op.opId === opId)) {
        if (this.pendingOps.length >= 16) {
          this.pendingOps.shift();
        }
        this.pendingOps.push({ opId, msg: outbound, createdAt: Date.now() });
        this.callbacks.onPendingOpsChange?.(this.pendingOps.length);
      }
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(outbound));
      } catch {
        this.forceDropAndReconnect(true);
      }
    } else if (
      outbound.type !== 'controller:input' &&
      outbound.type !== 'ping' &&
      outbound.type !== 'remote:action' &&
      outbound.type !== 'room:sync' &&
      !RELIABLE_OP_TYPES.has(outbound.type)
    ) {
      if (outbound.type === 'room:join' || outbound.type === 'room:host-reattach') {
        this.queue = this.queue.filter((queued) => queued.type !== outbound.type);
      }
      // Queue non-op essential session control messages until reconnected
      if (this.queue.length < 12) {
        this.queue.push(outbound);
      }
    }
  }

  public close(): void {
    this.closedManually = true;
    this.clearPendingOps();
    this.unbindLifecycleEvents();
    this.clearConnectTimer();
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.detachAndCloseSocket(this.ws);
    this.ws = null;
    this.setStatus('closed');
  }
}
