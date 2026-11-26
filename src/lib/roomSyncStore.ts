import { useSyncExternalStore } from 'react';
import type {
  CardPrivateState,
  CompetitiveSnapshot,
  GameSnapshot,
  RoomSnapshot,
  ServerMessage,
} from '../shared/types';
import type { ManagedWebSocket, SocketStatus } from './ws';

export interface RoomSyncViewState {
  room: RoomSnapshot | null;
  cardState: CardPrivateState | null;
  stateSeq: number;
  tickSeq: number;
  cardSeq: number;
  socketStatus: SocketStatus;
  wsConnected: boolean;
  pendingOpsCount: number;
  lastSyncedAt: number;
}

const ACTIVE_SYNC_PHASES = new Set([
  'BRIEFING',
  'COUNTDOWN',
  'PLAYING',
  'PAUSED',
  'VOTING',
]);

export class RoomSyncStore {
  private view: RoomSyncViewState = {
    room: null,
    cardState: null,
    stateSeq: 0,
    tickSeq: 0,
    cardSeq: 0,
    socketStatus: 'connecting',
    wsConnected: false,
    pendingOpsCount: 0,
    lastSyncedAt: 0,
  };

  // High-frequency 30Hz game ticks stay off React state so canvas rendering runs at 60fps without re-renders
  public latestSnapshot: GameSnapshot | null = null;
  public latestCompetitive: CompetitiveSnapshot | null = null;

  private ws: ManagedWebSocket | null = null;
  private listeners = new Set<() => void>();
  private lastSyncReqAt = 0;
  private pendingOpsSince = 0;
  private driftTimer: ReturnType<typeof setInterval> | null = null;

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): RoomSyncViewState => {
    return this.view;
  };

  public attachSocket(ws: ManagedWebSocket): void {
    this.ws = ws;
    this.startDriftGuard();
  }

  public detachSocket(): void {
    this.stopDriftGuard();
    this.ws = null;
  }

  public setSocketStatus(status: SocketStatus): void {
    const connected = status === 'connected';
    if (this.view.socketStatus === status && this.view.wsConnected === connected) return;
    this.view = {
      ...this.view,
      socketStatus: status,
      wsConnected: connected,
    };
    this.emit();
  }

  public setPendingOpsCount(count: number): void {
    if (count > 0 && this.pendingOpsSince === 0) {
      this.pendingOpsSince = Date.now();
    } else if (count === 0) {
      this.pendingOpsSince = 0;
    }
    if (this.view.pendingOpsCount === count) return;
    this.view = {
      ...this.view,
      pendingOpsCount: count,
    };
    this.emit();
  }

  public applyRoomAuthoritative(nextRoom: RoomSnapshot, forceReset = false): boolean {
    const prevRoom = this.view.room;
    const isNewRoom = !prevRoom || prevRoom.code !== nextRoom.code;
    const incomingSeq = typeof nextRoom.stateSeq === 'number' ? nextRoom.stateSeq : 0;

    if (!forceReset && !isNewRoom && incomingSeq > 0 && incomingSeq < this.view.stateSeq) {
      return false;
    }

    const hadGap =
      !forceReset &&
      !isNewRoom &&
      this.view.stateSeq > 0 &&
      incomingSeq > this.view.stateSeq + 1 &&
      ACTIVE_SYNC_PHASES.has(nextRoom.status);

    if (isNewRoom) {
      this.latestSnapshot = null;
      this.latestCompetitive = null;
    }

    const shouldClearCard =
      nextRoom.status === 'SETUP' ||
      nextRoom.status === 'LOBBY' ||
      nextRoom.status === 'VOTING' ||
      nextRoom.status === 'RESULTS';

    this.view = {
      ...this.view,
      room: nextRoom,
      cardState: shouldClearCard ? null : this.view.cardState,
      stateSeq: incomingSeq,
      tickSeq: isNewRoom ? 0 : this.view.tickSeq,
      cardSeq: isNewRoom ? 0 : this.view.cardSeq,
      lastSyncedAt: Date.now(),
    };
    this.emit();

    if (hadGap) {
      this.requestSync(false);
    }
    return true;
  }

  public applyGameTick(
    msg: Extract<ServerMessage, { type: 'game:tick' }>
  ): { accepted: boolean; firstSnapshot: boolean } {
    if (!msg.snapshot) {
      return { accepted: false, firstSnapshot: false };
    }
    const incomingTickSeq = typeof msg.tickSeq === 'number' ? msg.tickSeq : 0;
    if (incomingTickSeq > 0 && incomingTickSeq < this.view.tickSeq) {
      return { accepted: false, firstSnapshot: false };
    }

    const wasEmpty = this.latestSnapshot === null;
    this.latestSnapshot = msg.snapshot;
    this.latestCompetitive = msg.competitive ?? null;

    if (incomingTickSeq > this.view.tickSeq) {
      this.view = {
        ...this.view,
        tickSeq: incomingTickSeq,
        lastSyncedAt: Date.now(),
      };
    } else {
      this.view.lastSyncedAt = Date.now();
    }
    return { accepted: true, firstSnapshot: wasEmpty };
  }

  public applyCardState(cardState: CardPrivateState | null, seq?: number): boolean {
    if (typeof seq === 'number' && seq > 0 && seq < this.view.cardSeq) {
      return false;
    }
    this.view = {
      ...this.view,
      cardState,
      cardSeq: typeof seq === 'number' && seq > this.view.cardSeq ? seq : this.view.cardSeq,
      lastSyncedAt: Date.now(),
    };
    this.emit();
    return true;
  }

  public requestSync(force = false): void {
    if (!this.ws || !this.ws.isConnected() || !this.view.room) return;
    const now = Date.now();
    if (!force && now - this.lastSyncReqAt < 450) return;
    this.lastSyncReqAt = now;
    this.ws.requestSync(this.view.stateSeq, this.view.tickSeq);
  }

  public reset(): void {
    this.latestSnapshot = null;
    this.latestCompetitive = null;
    this.pendingOpsSince = 0;
    this.ws?.clearPendingOps();
    this.view = {
      ...this.view,
      room: null,
      cardState: null,
      stateSeq: 0,
      tickSeq: 0,
      cardSeq: 0,
      pendingOpsCount: 0,
    };
    this.emit();
  }

  private startDriftGuard(): void {
    this.stopDriftGuard();
    this.driftTimer = setInterval(() => {
      if (!this.ws || !this.ws.isConnected() || !this.view.room) return;
      const now = Date.now();
      const staleSync = now - this.view.lastSyncedAt > 4_500 && now - this.ws.getLastMessageAt() > 4_000;
      const stalledOp = this.view.pendingOpsCount > 0 && this.pendingOpsSince > 0 && now - this.pendingOpsSince > 2_000;
      if (staleSync || stalledOp) {
        this.requestSync(true);
      }
    }, 2_500);
  }

  private stopDriftGuard(): void {
    if (this.driftTimer) {
      clearInterval(this.driftTimer);
      this.driftTimer = null;
    }
  }
}

export function createRoomSyncStore(): RoomSyncStore {
  return new RoomSyncStore();
}

export function useRoomSyncSnapshot(store: RoomSyncStore): RoomSyncViewState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
