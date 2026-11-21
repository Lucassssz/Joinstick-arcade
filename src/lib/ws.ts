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

const PING_INTERVAL_MS = 2_500;
const PONG_TIMEOUT_MS = 5_500;
const SILENCE_TIMEOUT_MS = 8_000;
const INITIAL_RECONNECT_MS = 350;
const MAX_RECONNECT_MS = 2_500;

export class ManagedWebSocket {
  private ws: WebSocket | null = null;
  private status: SocketStatus = 'connecting';
  private closedManually = false;
  private reconnectDelay = INITIAL_RECONNECT_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private watchdogTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
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

  private handleOnline = (): void => {
    if (this.closedManually) return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.reconnectNow();
    } else {
      this.sendHeartbeatProbe(2_000);
    }
  };

  private handleOffline = (): void => {
    if (this.closedManually) return;
    this.forceDropAndReconnect(false);
  };

  private handleVisibilityOrShow = (): void => {
    if (this.closedManually) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.reconnectNow();
    } else {
      // Probe immediately when a phone wakes up or returns to tab; timeout within 2s if dead
      this.sendHeartbeatProbe(2_000);
    }
  };

  private bindLifecycleEvents(): void {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    window.addEventListener('pageshow', this.handleVisibilityOrShow);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityOrShow);
    }
  }

  private unbindLifecycleEvents(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('pageshow', this.handleVisibilityOrShow);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityOrShow);
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

    this.detachAndCloseSocket(this.ws);
    if (this.status !== 'reconnecting') {
      this.setStatus('connecting');
    }

    const ws = new WebSocket(getWebSocketUrl());
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws || this.closedManually) {
        this.detachAndCloseSocket(ws);
        return;
      }
      this.reconnectDelay = INITIAL_RECONNECT_MS;
      this.lastMessageAt = Date.now();
      this.awaitingPongSince = null;
      this.setStatus('connected');

      while (this.queue.length > 0 && ws.readyState === WebSocket.OPEN) {
        const msg = this.queue.shift()!;
        ws.send(JSON.stringify(msg));
      }
      this.startHeartbeat();
      this.callbacks.onOpen?.();
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
    this.stopHeartbeat();
    this.detachAndCloseSocket(this.ws);
    this.ws = null;
    this.awaitingPongSince = null;
    if (this.closedManually) {
      this.setStatus('closed');
      return;
    }
    this.setStatus('reconnecting');
    this.callbacks.onClose?.();

    const delay = immediate ? 100 : this.reconnectDelay;
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.reconnectDelay = Math.min(MAX_RECONNECT_MS, Math.round(this.reconnectDelay * 1.45));
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

  public reconnectNow(): void {
    if (this.closedManually) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectDelay = INITIAL_RECONNECT_MS;
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
        this.awaitingPongSince = now - Math.max(0, PONG_TIMEOUT_MS - maxWaitMs);
      } else if (this.awaitingPongSince === null) {
        this.awaitingPongSince = now;
      }
    } catch {
      this.forceDropAndReconnect(true);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.lastMessageAt = Date.now();
    this.awaitingPongSince = null;

    this.pingTimer = setInterval(() => {
      this.sendHeartbeatProbe();
    }, PING_INTERVAL_MS);

    this.watchdogTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const now = Date.now();
      const pongTimedOut =
        this.awaitingPongSince !== null && now - this.awaitingPongSince > PONG_TIMEOUT_MS;
      const silenceTimedOut = now - this.lastMessageAt > SILENCE_TIMEOUT_MS;
      if (pongTimedOut || silenceTimedOut) {
        this.forceDropAndReconnect(true);
      }
    }, 1_000);
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
      // Queue essential state/session control messages until reconnected
      if (this.queue.length < 12) {
        this.queue.push(msg);
      }
    }
  }

  public close(): void {
    this.closedManually = true;
    this.unbindLifecycleEvents();
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
