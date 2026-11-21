import { ClientMessage, ServerMessage } from '../shared/types';

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
  onMessage: (msg: ServerMessage) => void;
}

export class ManagedWebSocket {
  private ws: WebSocket | null = null;
  private closedManually = false;
  private reconnectDelay = 700;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private queue: ClientMessage[] = [];
  private callbacks: ManagedSocketCallbacks;

  constructor(callbacks: ManagedSocketCallbacks) {
    this.callbacks = callbacks;
    this.connect();
  }

  private connect(): void {
    if (this.closedManually) return;
    const ws = new WebSocket(getWebSocketUrl());
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 700;
      while (this.queue.length > 0 && ws.readyState === WebSocket.OPEN) {
        const msg = this.queue.shift()!;
        ws.send(JSON.stringify(msg));
      }
      this.startPing();
      this.callbacks.onOpen?.();
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as ServerMessage;
        this.callbacks.onMessage(parsed);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      this.stopPing();
      this.callbacks.onClose?.();
      if (!this.closedManually) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectDelay = Math.min(4000, this.reconnectDelay * 1.4);
          this.connect();
        }, this.reconnectDelay);
      }
    };

    ws.onerror = () => {
      // onclose handles reconnect cleanly
    };
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 15_000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  public send(msg: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else if (msg.type !== 'controller:input') {
      // Queue non-high-frequency control messages until connected
      this.queue.push(msg);
    }
  }

  public close(): void {
    this.closedManually = true;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
