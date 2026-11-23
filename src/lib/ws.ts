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
  onStatusChange?: (status: SocketStatus) => void;
  onMessage: (msg: ServerMessage) => void;
}

const PING_INTERVAL_MS = 5_000;
const PONG_TIMEOUT_MS = 18_000;
const SILENCE_TIMEOUT_MS = 28_000;
const CONNECT_TIMEOUT_MS = 8_000;
const INITIAL_RECONNECT_MS = 200;
const MAX_RECONNECT_MS = 3_000;

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

  private handleOnline = (): void => {
    if (this.closedManually) return;
    this.reconnectDelay = INITIAL_RECONNECT_MS;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.reconnectNow(false);
    } else {
      this.sendHeartbeatProbe(7_000);
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

      for (const msg of pending) {
        if (this.ws !== ws || ws.readyState !== WebSocket.OPEN) break;
        if (msg.type === 'room:host-reattach' || msg.type === 'room:join' || msg.type === 'room:create') {
          continue; // Handled authoritatively by onOpen
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
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {
        this.forceDropAndReconnect(true);
      }
    } else if (
      msg.type !== 'controller:input' &&
      msg.type !== 'ping' &&
      msg.type !== 'remote:action'
    ) {
      if (msg.type === 'room:join' || msg.type === 'room:host-reattach') {
        this.queue = this.queue.filter((queued) => queued.type !== msg.type);
      }
      // Queue essential state/session control messages until reconnected
      if (this.queue.length < 12) {
        this.queue.push(msg);
      }
    }
  }

  public close(): void {
    this.closedManually = true;
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
