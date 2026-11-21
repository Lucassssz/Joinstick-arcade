import crypto from 'crypto';
import type { WebSocket } from 'ws';
import {
  MAX_PLAYERS_PER_ROOM,
  PLAYER_PALETTE,
  type ClientMessage,
  type ControllerInput,
  type GameId,
  type GameSnapshot,
  type PlayerColorSpec,
  type PlayerSummary,
  type RankingEntry,
  type RoomSnapshot,
  type RoomStatus,
  type ServerMessage,
  type SoundEvent,
} from '../src/shared/types.ts';
import { getGameMeta } from '../src/shared/games.ts';
import { SERVER_GAMES, type ServerPlayerInputState } from './games/engine.ts';

interface ConnectedPlayer {
  id: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
  ws: WebSocket | null;
  connected: boolean;
  ready: boolean;
  score: number;
  alive: boolean;
  statText: string;
  cooldownA: number;
  cooldownB: number;
  input: ControllerInput;
  prevA: boolean;
  prevB: boolean;
  disconnectedAt: number | null;
}

interface RoomRecord {
  code: string;
  hostToken: string;
  hostWs: WebSocket | null;
  hostDisconnectedAt: number | null;
  status: RoomStatus;
  selectedGameId: GameId;
  gameSettingValue: number;
  countdownValue: number;
  countdownTimer: number;
  players: Map<string, ConnectedPlayer>;
  gameState: unknown | null;
  lastSnapshot: GameSnapshot | null;
  rankings: RankingEntry[];
  createdAt: number;
  lastActivityAt: number;
  tickInterval: ReturnType<typeof setInterval> | null;
}

interface SocketBinding {
  role: 'host' | 'player';
  roomCode: string;
  playerId?: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TICK_MS = 33; // ~30Hz authoritative server tick
const PLAYER_RECONNECT_GRACE_MS = 30_000;
const HOST_RECONNECT_GRACE_MS = 120_000;
const IDLE_ROOM_TTL_MS = 30 * 60_000;

export class RoomManager {
  private rooms = new Map<string, RoomRecord>();
  private bindings = new Map<WebSocket, SocketBinding>();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.pruneExpired(), 5_000);
  }

  public dispose(): void {
    clearInterval(this.cleanupInterval);
    for (const room of this.rooms.values()) {
      if (room.tickInterval) clearInterval(room.tickInterval);
    }
    this.rooms.clear();
  }

  public getRoomSummary(code: string): { exists: boolean; playerCount: number; maxPlayers: number; status: RoomStatus; gameName: string } | null {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return null;
    return {
      exists: true,
      playerCount: room.players.size,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      status: room.status,
      gameName: getGameMeta(room.selectedGameId).name,
    };
  }

  public handleConnection(ws: WebSocket): void {
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        this.handleMessage(ws, msg);
      } catch {
        this.send(ws, { type: 'error', message: 'Invalid message format.' });
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(ws);
    });
  }

  private generateRoomCode(): string {
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = '';
      for (let i = 0; i < 4; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      }
      if (!this.rooms.has(code)) return code;
    }
    return crypto.randomBytes(2).toString('hex').toUpperCase();
  }

  private send(ws: WebSocket | null, payload: ServerMessage): void {
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify(payload));
    } catch {
      // Ignore send errors on closing sockets
    }
  }

  private buildRoomSnapshot(room: RoomRecord): RoomSnapshot {
    const players: PlayerSummary[] = [...room.players.values()]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        color: p.color,
        connected: p.connected,
        ready: p.ready,
        score: p.score,
        alive: p.alive,
        statText: p.statText,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      }));

    return {
      code: room.code,
      status: room.status,
      selectedGameId: room.selectedGameId,
      gameSettingValue: room.gameSettingValue,
      countdownValue: room.countdownValue,
      players,
      rankings: room.rankings,
      hostConnected: Boolean(room.hostWs && room.hostWs.readyState === 1),
    };
  }

  private broadcastRoom(room: RoomRecord): void {
    const msg: ServerMessage = {
      type: 'room:snapshot',
      room: this.buildRoomSnapshot(room),
    };
    this.send(room.hostWs, msg);
    for (const p of room.players.values()) {
      if (p.connected) this.send(p.ws, msg);
    }
  }

  private broadcastTick(room: RoomRecord, snapshot: GameSnapshot, sounds: SoundEvent[]): void {
    const msg: ServerMessage = { type: 'game:tick', snapshot, sounds };
    this.send(room.hostWs, msg);
  }

  private nextAvailableSlot(room: RoomRecord): number {
    const used = new Set([...room.players.values()].map((p) => p.slotIndex));
    for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i++) {
      if (!used.has(i)) return i;
    }
    return -1;
  }

  private pickColor(room: RoomRecord, slotIndex: number, preferredColorId?: string): PlayerColorSpec {
    const usedColors = new Set([...room.players.values()].map((p) => p.color.id));
    if (preferredColorId) {
      const preferred = PLAYER_PALETTE.find((c) => c.id === preferredColorId);
      if (preferred && !usedColors.has(preferred.id)) return preferred;
    }
    const defaultForSlot = PLAYER_PALETTE[slotIndex % PLAYER_PALETTE.length];
    if (!usedColors.has(defaultForSlot.id)) return defaultForSlot;
    return PLAYER_PALETTE.find((c) => !usedColors.has(c.id)) ?? defaultForSlot;
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case 'ping':
        this.send(ws, { type: 'pong' });
        return;

      case 'room:create': {
        this.detachSocket(ws);
        const code = this.generateRoomCode();
        const hostToken = crypto.randomUUID();
        const gameId: GameId =
          msg.preferredGameId && SERVER_GAMES[msg.preferredGameId]
            ? msg.preferredGameId
            : 'bumper-brawl';
        const meta = getGameMeta(gameId);

        const room: RoomRecord = {
          code,
          hostToken,
          hostWs: ws,
          hostDisconnectedAt: null,
          status: 'LOBBY',
          selectedGameId: gameId,
          gameSettingValue: meta.defaultSetting,
          countdownValue: 3,
          countdownTimer: 0,
          players: new Map(),
          gameState: null,
          lastSnapshot: null,
          rankings: [],
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          tickInterval: null,
        };

        this.rooms.set(code, room);
        this.bindings.set(ws, { role: 'host', roomCode: code });
        this.send(ws, {
          type: 'room:created',
          code,
          hostToken,
          room: this.buildRoomSnapshot(room),
        });
        return;
      }

      case 'room:host-reattach': {
        const room = this.rooms.get(msg.code.toUpperCase());
        if (!room || room.hostToken !== msg.hostToken) {
          this.send(ws, {
            type: 'error',
            code: 'ROOM_NOT_FOUND',
            message: 'Previous room expired. Creating a fresh room.',
          });
          return;
        }
        this.detachSocket(ws);
        room.hostWs = ws;
        room.hostDisconnectedAt = null;
        room.lastActivityAt = Date.now();
        this.bindings.set(ws, { role: 'host', roomCode: room.code });
        this.send(ws, {
          type: 'room:created',
          code: room.code,
          hostToken: room.hostToken,
          room: this.buildRoomSnapshot(room),
        });
        if (room.lastSnapshot) {
          this.send(ws, { type: 'game:tick', snapshot: room.lastSnapshot, sounds: [] });
        }
        this.broadcastRoom(room);
        return;
      }

      case 'room:join': {
        const code = (msg.code || '').trim().toUpperCase();
        const room = this.rooms.get(code);
        if (!room) {
          this.send(ws, {
            type: 'error',
            code: 'ROOM_NOT_FOUND',
            message: `Room "${code}" was not found. Check the 4-letter code on the monitor.`,
          });
          return;
        }

        const cleanName = (msg.name || '').trim().slice(0, 14) || `Player ${room.players.size + 1}`;
        room.lastActivityAt = Date.now();

        // Idempotent reconnect by playerId
        if (msg.playerId && room.players.has(msg.playerId)) {
          const existing = room.players.get(msg.playerId)!;
          this.detachSocket(ws);
          existing.ws = ws;
          existing.connected = true;
          existing.disconnectedAt = null;
          existing.name = cleanName;
          this.bindings.set(ws, { role: 'player', roomCode: code, playerId: existing.id });
          this.send(ws, {
            type: 'room:joined',
            playerId: existing.id,
            room: this.buildRoomSnapshot(room),
          });
          this.broadcastRoom(room);
          return;
        }

        if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
          this.send(ws, {
            type: 'error',
            code: 'ROOM_FULL',
            message: `Room ${code} already has all ${MAX_PLAYERS_PER_ROOM} players connected.`,
          });
          return;
        }

        const slotIndex = this.nextAvailableSlot(room);
        if (slotIndex === -1) {
          this.send(ws, { type: 'error', code: 'ROOM_FULL', message: 'Room is full.' });
          return;
        }

        this.detachSocket(ws);
        const playerId = msg.playerId || crypto.randomUUID();
        const color = this.pickColor(room, slotIndex, msg.preferredColorId);

        const player: ConnectedPlayer = {
          id: playerId,
          slotIndex,
          name: cleanName,
          color,
          ws,
          connected: true,
          ready: false,
          score: 0,
          alive: true,
          statText: 'In Lobby',
          cooldownA: 0,
          cooldownB: 0,
          input: { dx: 0, dy: 0, a: false, b: false },
          prevA: false,
          prevB: false,
          disconnectedAt: null,
        };

        room.players.set(playerId, player);
        this.bindings.set(ws, { role: 'player', roomCode: code, playerId });

        // If joining mid-match or during briefing, spawn the player directly into the active game state
        if (
          (room.status === 'BRIEFING' ||
            room.status === 'PLAYING' ||
            room.status === 'COUNTDOWN' ||
            room.status === 'PAUSED') &&
          room.gameState
        ) {
          const engine = SERVER_GAMES[room.selectedGameId];
          engine.addPlayer?.(room.gameState, {
            id: player.id,
            slotIndex: player.slotIndex,
            name: player.name,
            color: player.color,
            connected: player.connected,
            input: player.input,
            prevA: false,
            prevB: false,
          });
          room.lastSnapshot = engine.getSnapshot(room.gameState);
        }

        this.send(ws, {
          type: 'room:joined',
          playerId,
          room: this.buildRoomSnapshot(room),
        });
        this.send(room.hostWs, {
          type: 'game:tick',
          snapshot: room.lastSnapshot as any,
          sounds: [{ type: 'join', playerId }],
        });
        this.broadcastRoom(room);
        return;
      }

      case 'player:ready': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'player' || !binding.playerId) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room) return;
        const player = room.players.get(binding.playerId);
        if (!player) return;
        player.ready = Boolean(msg.ready);
        room.lastActivityAt = Date.now();
        this.broadcastRoom(room);
        return;
      }

      case 'player:leave': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'player' || !binding.playerId) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room) return;
        room.players.delete(binding.playerId);
        this.bindings.delete(ws);
        room.lastActivityAt = Date.now();
        this.broadcastRoom(room);
        return;
      }

      case 'game:select': {
        const room = this.getHostRoom(ws);
        if (!room) return;
        if (!SERVER_GAMES[msg.gameId]) return;
        room.selectedGameId = msg.gameId;
        const meta = getGameMeta(msg.gameId);
        room.gameSettingValue = msg.settingValue ?? meta.defaultSetting;
        room.lastActivityAt = Date.now();
        this.broadcastRoom(room);
        return;
      }

      case 'game:start': {
        const room = this.getHostRoom(ws);
        if (!room) return;
        if (room.players.size === 0) {
          this.send(ws, {
            type: 'error',
            message: 'Connect at least 1 controller (or open Test Controller) before starting.',
          });
          return;
        }
        this.startMatch(room, true);
        return;
      }

      case 'game:dismiss-briefing': {
        const room = this.getHostRoom(ws);
        if (!room || room.status !== 'BRIEFING') return;
        this.beginCountdown(room);
        return;
      }

      case 'game:pause': {
        const room = this.getHostRoom(ws);
        if (!room) return;
        if (room.status === 'PLAYING' && msg.paused) {
          room.status = 'PAUSED';
          this.broadcastRoom(room);
        } else if (room.status === 'PAUSED' && !msg.paused) {
          room.status = 'PLAYING';
          this.broadcastRoom(room);
        }
        return;
      }

      case 'game:restart': {
        const room = this.getHostRoom(ws);
        if (!room) return;
        if (room.players.size === 0) return;
        this.startMatch(room, false);
        return;
      }

      case 'game:return-lobby': {
        const room = this.getHostRoom(ws);
        if (!room) return;
        this.stopGameLoop(room);
        room.status = 'LOBBY';
        room.gameState = null;
        room.lastSnapshot = null;
        room.rankings = [];
        for (const p of room.players.values()) {
          p.ready = false;
          p.score = 0;
          p.alive = true;
          p.statText = 'In Lobby';
          p.cooldownA = 0;
          p.cooldownB = 0;
          p.input = { dx: 0, dy: 0, a: false, b: false };
          p.prevA = false;
          p.prevB = false;
        }
        this.broadcastRoom(room);
        return;
      }

      case 'controller:input': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'player' || !binding.playerId) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room) return;
        const player = room.players.get(binding.playerId);
        if (!player) return;

        const dx = Number.isFinite(msg.input.dx) ? Math.max(-1, Math.min(1, msg.input.dx)) : 0;
        const dy = Number.isFinite(msg.input.dy) ? Math.max(-1, Math.min(1, msg.input.dy)) : 0;
        player.input = {
          dx,
          dy,
          a: Boolean(msg.input.a),
          b: Boolean(msg.input.b),
        };
        room.lastActivityAt = Date.now();
        return;
      }
    }
  }

  private getHostRoom(ws: WebSocket): RoomRecord | null {
    const binding = this.bindings.get(ws);
    if (!binding || binding.role !== 'host') return null;
    return this.rooms.get(binding.roomCode) ?? null;
  }

  private beginCountdown(room: RoomRecord): void {
    room.status = 'COUNTDOWN';
    room.countdownValue = 3;
    room.countdownTimer = 2.6;
    room.lastActivityAt = Date.now();
    for (const p of room.players.values()) {
      p.statText = 'Get Ready!';
    }
    this.broadcastRoom(room);
    if (room.lastSnapshot) {
      this.broadcastTick(room, room.lastSnapshot, [{ type: 'countdown' }]);
    }
    for (const p of room.players.values()) {
      if (p.connected) this.send(p.ws, { type: 'player:haptic', pattern: 35, reason: 'countdown' });
    }
  }

  private startMatch(room: RoomRecord, showBriefing = true): void {
    this.stopGameLoop(room);
    const engine = SERVER_GAMES[room.selectedGameId];
    const playerList = this.toInputPlayers(room);
    room.gameState = engine.createState(playerList, room.gameSettingValue);
    room.lastSnapshot = engine.getSnapshot(room.gameState);
    room.rankings = [];
    room.lastActivityAt = Date.now();

    for (const p of room.players.values()) {
      p.score = 0;
      p.alive = true;
      p.statText = showBriefing ? 'How to Play' : 'Get Ready!';
      p.cooldownA = 0;
      p.cooldownB = 0;
      p.prevA = false;
      p.prevB = false;
    }

    if (showBriefing) {
      room.status = 'BRIEFING';
      room.countdownValue = 8;
      room.countdownTimer = 8.0;
      this.broadcastRoom(room);
      if (room.lastSnapshot) {
        this.broadcastTick(room, room.lastSnapshot, []);
      }
    } else {
      this.beginCountdown(room);
    }

    let hudBroadcastCounter = 0;
    let lastTickTime = Date.now();

    room.tickInterval = setInterval(() => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - lastTickTime) / 1000);
      lastTickTime = now;

      if (room.status === 'PAUSED') return;

      if (room.status === 'BRIEFING') {
        const prevVal = room.countdownValue;
        room.countdownTimer -= dt;
        const nextVal = Math.max(0, Math.ceil(room.countdownTimer));
        if (nextVal !== prevVal && nextVal > 0) {
          room.countdownValue = nextVal;
          this.broadcastRoom(room);
        }
        if (room.countdownTimer <= 0) {
          this.beginCountdown(room);
        }
        return;
      }

      if (room.status === 'COUNTDOWN') {
        const prevVal = room.countdownValue;
        room.countdownTimer -= dt;
        const nextVal = Math.max(0, Math.ceil((room.countdownTimer / 2.6) * 3));
        if (nextVal !== prevVal && nextVal > 0) {
          room.countdownValue = nextVal;
          this.broadcastRoom(room);
          if (room.lastSnapshot) {
            this.broadcastTick(room, room.lastSnapshot, [{ type: 'countdown' }]);
          }
          for (const p of room.players.values()) {
            if (p.connected) this.send(p.ws, { type: 'player:haptic', pattern: 35, reason: 'countdown' });
          }
        }
        if (room.countdownTimer <= 0) {
          room.status = 'PLAYING';
          room.countdownValue = 0;
          this.broadcastRoom(room);
          if (room.lastSnapshot) {
            this.broadcastTick(room, room.lastSnapshot, [{ type: 'go' }]);
          }
          for (const p of room.players.values()) {
            if (p.connected) this.send(p.ws, { type: 'player:haptic', pattern: [55, 35, 95], reason: 'go' });
          }
        }
        return;
      }

      if (room.status !== 'PLAYING' || !room.gameState) return;

      const currentInputs = this.toInputPlayers(room);
      const result = engine.step(room.gameState, currentInputs, dt);

      // Persist edge-trigger states
      for (const p of room.players.values()) {
        p.prevA = p.input.a;
        p.prevB = p.input.b;
        const hud = result.hudUpdates[p.id];
        if (hud) {
          p.score = hud.score;
          p.alive = hud.alive;
          p.statText = hud.statText;
          p.cooldownA = hud.cooldownA;
          p.cooldownB = hud.cooldownB;
        }
      }

      room.lastSnapshot = result.snapshot;
      this.broadcastTick(room, result.snapshot, result.sounds);

      // Coalesce & dispatch targeted phone haptics (strongest pattern per player per tick)
      if (result.haptics.length > 0) {
        const strongestByPlayer = new Map<string, { pattern: number | number[]; reason?: string; weight: number }>();
        for (const h of result.haptics) {
          const weight = Array.isArray(h.pattern)
            ? h.pattern.reduce((sum, n) => sum + n, 0) + 1000
            : h.pattern;
          const prev = strongestByPlayer.get(h.playerId);
          if (!prev || weight > prev.weight) {
            strongestByPlayer.set(h.playerId, { pattern: h.pattern, reason: h.reason, weight });
          }
        }
        for (const [playerId, h] of strongestByPlayer.entries()) {
          const target = room.players.get(playerId);
          if (target?.connected) {
            this.send(target.ws, {
              type: 'player:haptic',
              pattern: h.pattern,
              reason: h.reason,
            });
          }
        }
      }

      // Sync lightweight HUD updates (scores, cooldowns, alive state) at ~6Hz to phones & host
      hudBroadcastCounter += 1;
      if (hudBroadcastCounter >= 5) {
        hudBroadcastCounter = 0;
        this.broadcastRoom(room);
      }

      if (result.finished) {
        this.stopGameLoop(room);
        room.status = 'RESULTS';
        room.rankings = result.rankings ?? engine.getRankings(room.gameState, currentInputs);
        for (const p of room.players.values()) {
          if (p.connected) {
            this.send(p.ws, { type: 'player:haptic', pattern: [70, 40, 120], reason: 'win' });
          }
        }
        this.broadcastRoom(room);
      }
    }, TICK_MS);
  }

  private toInputPlayers(room: RoomRecord): ServerPlayerInputState[] {
    return [...room.players.values()]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        color: p.color,
        connected: p.connected,
        input: p.input,
        prevA: p.prevA,
        prevB: p.prevB,
      }));
  }

  private stopGameLoop(room: RoomRecord): void {
    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }
  }

  private detachSocket(ws: WebSocket): void {
    const existing = this.bindings.get(ws);
    if (!existing) return;
    this.bindings.delete(ws);
    const room = this.rooms.get(existing.roomCode);
    if (!room) return;
    if (existing.role === 'host' && room.hostWs === ws) {
      room.hostWs = null;
      room.hostDisconnectedAt = Date.now();
    } else if (existing.role === 'player' && existing.playerId) {
      const p = room.players.get(existing.playerId);
      if (p && p.ws === ws) {
        p.ws = null;
        p.connected = false;
        p.disconnectedAt = Date.now();
        p.input = { dx: 0, dy: 0, a: false, b: false };
      }
    }
  }

  private handleDisconnect(ws: WebSocket): void {
    const binding = this.bindings.get(ws);
    if (!binding) return;
    this.bindings.delete(ws);

    const room = this.rooms.get(binding.roomCode);
    if (!room) return;

    if (binding.role === 'host' && room.hostWs === ws) {
      room.hostWs = null;
      room.hostDisconnectedAt = Date.now();
      this.broadcastRoom(room);
    } else if (binding.role === 'player' && binding.playerId) {
      const player = room.players.get(binding.playerId);
      if (player && player.ws === ws) {
        player.ws = null;
        player.connected = false;
        player.disconnectedAt = Date.now();
        player.input = { dx: 0, dy: 0, a: false, b: false };
        this.broadcastRoom(room);
      }
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      let changed = false;

      // Prune long-disconnected players (in lobby immediately after grace; in match after grace)
      for (const [pid, p] of room.players.entries()) {
        if (!p.connected && p.disconnectedAt && now - p.disconnectedAt > PLAYER_RECONNECT_GRACE_MS) {
          room.players.delete(pid);
          changed = true;
        }
      }

      if (changed) {
        this.broadcastRoom(room);
      }

      const hostGone =
        !room.hostWs &&
        room.hostDisconnectedAt !== null &&
        now - room.hostDisconnectedAt > HOST_RECONNECT_GRACE_MS;
      const idleExpired = now - room.lastActivityAt > IDLE_ROOM_TTL_MS;

      if (hostGone || idleExpired) {
        this.stopGameLoop(room);
        for (const p of room.players.values()) {
          this.send(p.ws, {
            type: 'room:closed',
            reason: 'The host monitor session ended.',
          });
        }
        this.rooms.delete(code);
      }
    }
  }
}
