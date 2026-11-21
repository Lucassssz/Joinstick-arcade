import crypto from 'crypto';
import type { WebSocket } from 'ws';
import {
  MAX_PLAYERS_PER_ROOM,
  PLAYER_PALETTE,
  type BotDifficulty,
  type ClientMessage,
  type ControllerInput,
  type GameId,
  type GameSnapshot,
  type PlayerColorSpec,
  type PlayerFilterMode,
  type PlayerSummary,
  type RankingEntry,
  type RemoteDirection,
  type RemoteFocusState,
  type RoomSnapshot,
  type RoomStatus,
  type ServerMessage,
  type SoundEvent,
} from '../src/shared/types.ts';
import {
  filterGamesByPlayerMode,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../src/shared/games.ts';
import { SERVER_GAMES, type ServerPlayerInputState } from './games/engine.ts';
import { computeBotInput, createBotMemory, type BotMemory } from './games/botController.ts';

interface ConnectedPlayer {
  id: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
  ws: WebSocket | null;
  connected: boolean;
  ready: boolean;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  botMemory?: BotMemory;
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
  hostPlayerId: string | null;
  botDifficulty: BotDifficulty;
  status: RoomStatus;
  selectedGameId: GameId;
  gameSettingValue: number;
  lobbyFilter: PlayerFilterMode;
  remoteFocus: RemoteFocusState;
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
const BOT_CALLSIGNS = [
  'Bot Alpha',
  'Bot Beta',
  'Bot Pixel',
  'Bot Nova',
  'Bot Spark',
  'Bot Turbo',
  'Bot Echo',
  'Bot Glitch',
];
const VALID_DIFFICULTIES = new Set<BotDifficulty>(['chill', 'arcade', 'spicy']);
const ALLOWED_EMOTES = new Set(['🔥', '😂', '⚡', '👑', '🎉', '🤖', '👏', '😎']);
const TICK_MS = 33; // ~30Hz authoritative server tick
const PLAYER_RECONNECT_GRACE_MS = 90_000;
const HOST_RECONNECT_GRACE_MS = 120_000;
const IDLE_ROOM_TTL_MS = 30 * 60_000;
const WS_HEARTBEAT_INTERVAL_MS = 2_500;
const WS_HEARTBEAT_TIMEOUT_MS = 4_800;

export class RoomManager {
  private rooms = new Map<string, RoomRecord>();
  private bindings = new Map<WebSocket, SocketBinding>();
  private socketAlive = new Map<WebSocket, boolean>();
  private socketLastSeen = new Map<WebSocket, number>();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private heartbeatInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.pruneExpired(), 5_000);
    this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), WS_HEARTBEAT_INTERVAL_MS);
  }

  public dispose(): void {
    clearInterval(this.cleanupInterval);
    clearInterval(this.heartbeatInterval);
    for (const room of this.rooms.values()) {
      if (room.tickInterval) clearInterval(room.tickInterval);
    }
    this.rooms.clear();
    this.socketAlive.clear();
    this.socketLastSeen.clear();
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
    this.socketAlive.set(ws, true);
    this.socketLastSeen.set(ws, Date.now());

    ws.on('pong', () => {
      this.socketAlive.set(ws, true);
      this.socketLastSeen.set(ws, Date.now());
    });

    ws.on('message', (raw) => {
      this.socketAlive.set(ws, true);
      this.socketLastSeen.set(ws, Date.now());
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        this.handleMessage(ws, msg);
      } catch {
        this.send(ws, { type: 'error', message: 'Invalid message format.' });
      }
    });

    ws.on('close', () => {
      this.cleanupSocketTracking(ws);
      this.handleDisconnect(ws);
    });

    ws.on('error', () => {
      this.cleanupSocketTracking(ws);
      this.handleDisconnect(ws);
    });
  }

  private cleanupSocketTracking(ws: WebSocket): void {
    this.socketAlive.delete(ws);
    this.socketLastSeen.delete(ws);
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    for (const [ws, alive] of this.socketAlive.entries()) {
      if (ws.readyState !== 1) {
        if (ws.readyState >= 2) {
          this.cleanupSocketTracking(ws);
          this.handleDisconnect(ws);
        }
        continue;
      }
      const lastSeen = this.socketLastSeen.get(ws) ?? now;
      if (!alive && now - lastSeen > WS_HEARTBEAT_TIMEOUT_MS) {
        this.cleanupSocketTracking(ws);
        this.handleDisconnect(ws);
        try {
          if (typeof ws.terminate === 'function') {
            ws.terminate();
          } else {
            ws.close();
          }
        } catch {
          // Ignore terminate errors on already-closed sockets
        }
        continue;
      }
      this.socketAlive.set(ws, false);
      try {
        if (typeof ws.ping === 'function') {
          ws.ping();
        }
      } catch {
        // Ignore ping errors; next sweep or close event cleans up
      }
    }
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

  private ensureHostPlayer(room: RoomRecord): void {
    if (room.hostPlayerId) {
      const current = room.players.get(room.hostPlayerId);
      if (current && !current.isBot && current.connected) return;
    }
    const candidates = [...room.players.values()].filter((p) => !p.isBot && p.connected);
    if (candidates.length === 0) {
      room.hostPlayerId = null;
      return;
    }
    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    room.hostPlayerId = picked.id;
    if (picked.ws) {
      this.send(picked.ws, { type: 'player:haptic', pattern: [45, 30, 85], reason: 'host' });
    }
  }

  private checkBriefingReadyAdvance(room: RoomRecord): boolean {
    if (room.status !== 'BRIEFING') return false;
    const connectedHumans = [...room.players.values()].filter((p) => !p.isBot && p.connected);
    if (connectedHumans.length > 0 && connectedHumans.every((p) => p.ready)) {
      this.beginCountdown(room);
      return true;
    }
    return false;
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
        isBot: p.isBot,
        botDifficulty: p.isBot ? p.botDifficulty ?? room.botDifficulty : undefined,
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
      botDifficulty: room.botDifficulty,
      hostPlayerId: room.hostPlayerId,
      lobbyFilter: room.lobbyFilter,
      remoteFocus: { ...room.remoteFocus },
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
      if (p.connected && !p.isBot && p.ws) {
        this.send(p.ws, msg);
      }
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

  private pickBotName(room: RoomRecord): string {
    const usedNames = new Set([...room.players.values()].map((p) => p.name));
    for (const candidate of BOT_CALLSIGNS) {
      if (!usedNames.has(candidate)) return candidate;
    }
    let idx = 1;
    while (usedNames.has(`Robot ${idx}`)) idx += 1;
    return `Robot ${idx}`;
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
          hostPlayerId: null,
          botDifficulty: 'arcade',
          status: 'SETUP',
          selectedGameId: gameId,
          gameSettingValue: meta.defaultSetting,
          lobbyFilter: 'all',
          remoteFocus: { zone: 'games', index: 0, modalIndex: 0 },
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

        // Idempotent reconnect by playerId (humans only)
        if (msg.playerId && room.players.has(msg.playerId)) {
          const existing = room.players.get(msg.playerId)!;
          if (!existing.isBot) {
            this.detachSocket(ws);
            existing.ws = ws;
            existing.connected = true;
            existing.disconnectedAt = null;
            existing.name = cleanName;
            this.ensureHostPlayer(room);
            this.bindings.set(ws, { role: 'player', roomCode: code, playerId: existing.id });
            this.send(ws, {
              type: 'room:joined',
              playerId: existing.id,
              room: this.buildRoomSnapshot(room),
            });
            this.broadcastRoom(room);
            return;
          }
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
          isBot: false,
          score: 0,
          alive: true,
          statText: room.status === 'SETUP' ? 'In Setup' : 'In Lobby',
          cooldownA: 0,
          cooldownB: 0,
          input: { dx: 0, dy: 0, a: false, b: false },
          prevA: false,
          prevB: false,
          disconnectedAt: null,
        };

        room.players.set(playerId, player);
        this.ensureHostPlayer(room);
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
            isBot: false,
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

      case 'room:add-bot': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        this.addBotToRoom(room, ws, msg.difficulty);
        return;
      }

      case 'room:remove-bot': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (room.status !== 'SETUP' && room.status !== 'LOBBY') return;
        const target = room.players.get(msg.botId);
        if (!target || !target.isBot) return;
        room.players.delete(msg.botId);
        room.lastActivityAt = Date.now();
        this.broadcastRoom(room);
        return;
      }

      case 'room:set-bot-difficulty': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (!VALID_DIFFICULTIES.has(msg.difficulty)) return;
        room.lastActivityAt = Date.now();
        if (msg.botId) {
          const target = room.players.get(msg.botId);
          if (target && target.isBot) {
            target.botDifficulty = msg.difficulty;
          }
        } else {
          room.botDifficulty = msg.difficulty;
          for (const p of room.players.values()) {
            if (p.isBot) {
              p.botDifficulty = msg.difficulty;
            }
          }
        }
        this.broadcastRoom(room);
        return;
      }

      case 'room:set-host-player': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        const target = room.players.get(msg.playerId);
        if (!target || target.isBot || !target.connected) {
          this.send(ws, {
            type: 'error',
            message: 'Only a connected human player can be chosen as the Room Host.',
          });
          return;
        }
        room.hostPlayerId = target.id;
        room.lastActivityAt = Date.now();
        this.playHostSound(room, 'confirm');
        if (target.ws) {
          this.send(target.ws, { type: 'player:haptic', pattern: [45, 30, 85], reason: 'host' });
        }
        this.broadcastRoom(room);
        return;
      }

      case 'room:enter-game-room': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (room.players.size === 0) {
          this.send(ws, {
            type: 'error',
            message: 'Connect at least 1 player or add a robot before entering the Game Room.',
          });
          return;
        }
        this.stopGameLoop(room);
        room.status = 'LOBBY';
        room.lobbyFilter = 'all';
        const allGames = filterGamesByPlayerMode('all');
        const currentIdx = Math.max(
          0,
          allGames.findIndex((g) => g.id === room.selectedGameId)
        );
        room.remoteFocus = { zone: 'games', index: currentIdx, modalIndex: 0 };
        room.gameState = null;
        room.lastSnapshot = null;
        room.rankings = [];
        for (const p of room.players.values()) {
          p.ready = p.isBot ? true : false;
          p.score = 0;
          p.alive = true;
          p.statText = p.isBot ? 'Bot Ready' : 'Waiting for Ready';
          p.cooldownA = 0;
          p.cooldownB = 0;
          p.input = { dx: 0, dy: 0, a: false, b: false };
          p.prevA = false;
          p.prevB = false;
        }
        room.lastActivityAt = Date.now();
        this.playHostSound(room, 'confirm');
        this.broadcastRoom(room);
        return;
      }

      case 'room:return-setup': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        this.returnToSetup(room);
        return;
      }

      case 'room:close': {
        const binding = this.bindings.get(ws);
        if (!binding) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room) return;
        const isMonitor = binding.role === 'host';
        const isRoomHostPlayer =
          binding.role === 'player' && binding.playerId && room.hostPlayerId === binding.playerId;
        if (!isMonitor && !isRoomHostPlayer) return;

        this.closeRoom(room, 'The room was closed by the host.');
        return;
      }

      case 'lobby:filter': {
        const room = this.getPrivilegedRoom(ws);
        if (!room || room.status !== 'LOBBY') return;
        const filterIdx = PLAYER_FILTER_OPTIONS.findIndex((o) => o.id === msg.filter);
        if (filterIdx === -1) return;
        room.lobbyFilter = msg.filter;
        room.remoteFocus = { ...room.remoteFocus, zone: 'filter', index: filterIdx };
        const nextGames = filterGamesByPlayerMode(room.lobbyFilter);
        if (nextGames.length > 0 && !nextGames.some((g) => g.id === room.selectedGameId)) {
          room.selectedGameId = nextGames[0].id;
          room.gameSettingValue = nextGames[0].defaultSetting;
        }
        room.lastActivityAt = Date.now();
        this.playHostSound(room, 'confirm');
        this.broadcastRoom(room);
        return;
      }

      case 'remote:action': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        this.handleRemoteAction(room, ws, msg.action);
        return;
      }

      case 'player:ready': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'player' || !binding.playerId) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room) return;
        const player = room.players.get(binding.playerId);
        if (!player || player.isBot) return;
        player.ready = Boolean(msg.ready);
        player.statText = player.ready ? 'Ready' : room.status === 'BRIEFING' ? 'Reading Rules' : 'Waiting for Ready';
        room.lastActivityAt = Date.now();

        if (player.ready) {
          this.send(room.hostWs, {
            type: 'game:tick',
            snapshot: room.lastSnapshot as any,
            sounds: [{ type: 'ready', playerId: player.id }],
          });
        }

        // During Rules Briefing: as soon as EVERY connected human presses Ready, start immediately (no auto-countdown!)
        if (this.checkBriefingReadyAdvance(room)) return;

        this.broadcastRoom(room);
        return;
      }

      case 'player:emote': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'player' || !binding.playerId) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room) return;
        const player = room.players.get(binding.playerId);
        if (!player || player.isBot) return;
        const emoji = typeof msg.emoji === 'string' && ALLOWED_EMOTES.has(msg.emoji) ? msg.emoji : '🔥';
        room.lastActivityAt = Date.now();
        this.send(room.hostWs, {
          type: 'room:emote',
          id: crypto.randomUUID(),
          playerId: player.id,
          playerName: player.name,
          colorHex: player.color.hex,
          emoji,
        });
        this.send(room.hostWs, {
          type: 'game:tick',
          snapshot: room.lastSnapshot as any,
          sounds: [{ type: 'pickup', playerId: player.id }],
        });
        return;
      }

      case 'player:leave': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'player' || !binding.playerId) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room) return;
        room.players.delete(binding.playerId);
        this.bindings.delete(ws);
        this.ensureHostPlayer(room);
        room.lastActivityAt = Date.now();
        if (this.checkBriefingReadyAdvance(room)) return;
        this.broadcastRoom(room);
        return;
      }

      case 'game:select': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (!SERVER_GAMES[msg.gameId]) return;
        room.selectedGameId = msg.gameId;
        const meta = getGameMeta(msg.gameId);
        room.gameSettingValue = msg.settingValue ?? meta.defaultSetting;
        const visibleGames = filterGamesByPlayerMode(room.lobbyFilter);
        const gameIdx = visibleGames.findIndex((g) => g.id === msg.gameId);
        if (gameIdx >= 0) {
          room.remoteFocus = { ...room.remoteFocus, zone: 'games', index: gameIdx };
        }
        room.lastActivityAt = Date.now();
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
        return;
      }

      case 'game:start': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        this.attemptStartMatch(room, ws);
        return;
      }

      case 'game:dismiss-briefing': {
        const room = this.getPrivilegedRoom(ws);
        if (!room || room.status !== 'BRIEFING') return;
        this.beginCountdown(room);
        return;
      }

      case 'game:pause': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (room.status === 'PLAYING' && msg.paused) {
          room.status = 'PAUSED';
          room.remoteFocus.modalIndex = 0;
          this.broadcastRoom(room);
        } else if (room.status === 'PAUSED' && !msg.paused) {
          room.status = 'PLAYING';
          this.broadcastRoom(room);
        }
        return;
      }

      case 'game:restart': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (room.players.size === 0) return;
        this.startMatch(room, false);
        return;
      }

      case 'game:return-lobby': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        this.returnToLobby(room);
        return;
      }

      case 'controller:input': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'player' || !binding.playerId) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room) return;
        const player = room.players.get(binding.playerId);
        if (!player || player.isBot) return;

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

  private playHostSound(room: RoomRecord, soundType: SoundEvent['type']): void {
    this.send(room.hostWs, {
      type: 'game:tick',
      snapshot: room.lastSnapshot as any,
      sounds: [{ type: soundType }],
    });
  }

  private addBotToRoom(room: RoomRecord, senderWs: WebSocket, requestedDiff?: BotDifficulty): void {
    if (room.status !== 'SETUP' && room.status !== 'LOBBY') {
      this.send(senderWs, {
        type: 'error',
        message: 'Robots can only be added during Room Setup or in the Game Room.',
      });
      return;
    }
    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      this.send(senderWs, {
        type: 'error',
        code: 'ROOM_FULL',
        message: `Room already has all ${MAX_PLAYERS_PER_ROOM} players.`,
      });
      return;
    }
    const slotIndex = this.nextAvailableSlot(room);
    if (slotIndex === -1) return;

    const botId = `bot_${crypto.randomUUID().slice(0, 8)}`;
    const difficulty: BotDifficulty =
      requestedDiff && VALID_DIFFICULTIES.has(requestedDiff) ? requestedDiff : room.botDifficulty;

    const botPlayer: ConnectedPlayer = {
      id: botId,
      slotIndex,
      name: this.pickBotName(room),
      color: this.pickColor(room, slotIndex),
      ws: null,
      connected: true,
      ready: true,
      isBot: true,
      botDifficulty: difficulty,
      botMemory: createBotMemory(),
      score: 0,
      alive: true,
      statText: 'Bot Ready',
      cooldownA: 0,
      cooldownB: 0,
      input: { dx: 0, dy: 0, a: false, b: false },
      prevA: false,
      prevB: false,
      disconnectedAt: null,
    };

    room.players.set(botId, botPlayer);
    room.lastActivityAt = Date.now();
    this.send(room.hostWs, {
      type: 'game:tick',
      snapshot: room.lastSnapshot as any,
      sounds: [{ type: 'join', playerId: botId }],
    });
    this.broadcastRoom(room);
  }

  private attemptStartMatch(room: RoomRecord, senderWs: WebSocket): boolean {
    if (room.players.size === 0) {
      this.send(senderWs, {
        type: 'error',
        message: 'Connect at least 1 player (or add a robot) before starting.',
      });
      return false;
    }

    // Strict Ready Gate: every connected human player MUST press Ready on their phone controller
    const unreadyHumans = [...room.players.values()]
      .filter((p) => !p.isBot && p.connected && !p.ready)
      .sort((a, b) => a.slotIndex - b.slotIndex);

    if (unreadyHumans.length > 0) {
      const names = unreadyHumans.map((p) => p.name).join(', ');
      this.send(senderWs, {
        type: 'error',
        code: 'PLAYERS_NOT_READY',
        message: `Everyone must press Ready on their phone first. Waiting for: ${names}`,
      });
      if (room.hostWs && room.hostWs !== senderWs) {
        this.send(room.hostWs, {
          type: 'error',
          code: 'PLAYERS_NOT_READY',
          message: `Waiting for ${names} to press Ready on their phone!`,
        });
      }
      return false;
    }

    this.playHostSound(room, 'confirm');
    this.startMatch(room, true);
    return true;
  }

  private returnToLobby(room: RoomRecord): void {
    this.stopGameLoop(room);
    room.status = 'LOBBY';
    room.gameState = null;
    room.lastSnapshot = null;
    room.rankings = [];
    const visibleGames = filterGamesByPlayerMode(room.lobbyFilter);
    const idx = Math.max(
      0,
      visibleGames.findIndex((g) => g.id === room.selectedGameId)
    );
    room.remoteFocus = { zone: 'games', index: idx, modalIndex: 0 };
    for (const p of room.players.values()) {
      p.ready = p.isBot ? true : false;
      p.score = 0;
      p.alive = true;
      p.statText = p.isBot ? 'Bot Ready' : 'Waiting for Ready';
      p.cooldownA = 0;
      p.cooldownB = 0;
      p.input = { dx: 0, dy: 0, a: false, b: false };
      p.prevA = false;
      p.prevB = false;
    }
    room.lastActivityAt = Date.now();
    this.playHostSound(room, 'confirm');
    this.broadcastRoom(room);
  }

  private returnToSetup(room: RoomRecord): void {
    this.stopGameLoop(room);
    room.status = 'SETUP';
    room.gameState = null;
    room.lastSnapshot = null;
    room.rankings = [];
    for (const p of room.players.values()) {
      p.ready = p.isBot ? true : false;
      p.score = 0;
      p.alive = true;
      p.statText = p.isBot ? 'Bot Ready' : 'In Setup';
      p.cooldownA = 0;
      p.cooldownB = 0;
      p.input = { dx: 0, dy: 0, a: false, b: false };
      p.prevA = false;
      p.prevB = false;
    }
    room.lastActivityAt = Date.now();
    this.playHostSound(room, 'confirm');
    this.broadcastRoom(room);
  }

  private handleRemoteAction(room: RoomRecord, senderWs: WebSocket, action: RemoteDirection): void {
    room.lastActivityAt = Date.now();

    // --- BRIEFING REMOTE ---
    if (room.status === 'BRIEFING') {
      if (action === 'left' || action === 'up') {
        room.remoteFocus.modalIndex = 0;
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
      } else if (action === 'right' || action === 'down') {
        room.remoteFocus.modalIndex = 1;
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
      } else if (action === 'ok') {
        if (room.remoteFocus.modalIndex === 0) {
          this.playHostSound(room, 'confirm');
          this.beginCountdown(room);
        } else {
          this.returnToLobby(room);
        }
      }
      return;
    }

    // --- PAUSED REMOTE ---
    if (room.status === 'PAUSED') {
      if (action === 'left' || action === 'up') {
        room.remoteFocus.modalIndex = Math.max(0, room.remoteFocus.modalIndex - 1);
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
      } else if (action === 'right' || action === 'down') {
        room.remoteFocus.modalIndex = Math.min(2, room.remoteFocus.modalIndex + 1);
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
      } else if (action === 'ok') {
        if (room.remoteFocus.modalIndex === 0) {
          room.status = 'PLAYING';
          this.playHostSound(room, 'confirm');
          this.broadcastRoom(room);
        } else if (room.remoteFocus.modalIndex === 1) {
          this.playHostSound(room, 'confirm');
          this.startMatch(room, false);
        } else {
          this.returnToLobby(room);
        }
      }
      return;
    }

    // --- RESULTS PODIUM REMOTE ---
    if (room.status === 'RESULTS') {
      if (action === 'left' || action === 'up') {
        room.remoteFocus.modalIndex = 0;
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
      } else if (action === 'right' || action === 'down') {
        room.remoteFocus.modalIndex = 1;
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
      } else if (action === 'ok') {
        if (room.remoteFocus.modalIndex === 0) {
          this.playHostSound(room, 'confirm');
          this.startMatch(room, false);
        } else {
          this.returnToLobby(room);
        }
      }
      return;
    }

    // --- FULLSCREEN GAME ROOM (LOBBY) TV REMOTE ---
    if (room.status !== 'LOBBY') return;

    const COLS = 4;
    const ACTION_COUNT = 5; // 0: Start Game, 1: Match Setting, 2: Add Robot, 3: Bot Difficulty, 4: Room Setup
    const filteredGames = filterGamesByPlayerMode(room.lobbyFilter);
    const focus = room.remoteFocus;

    const selectGameAt = (idx: number) => {
      const clamped = Math.max(0, Math.min(filteredGames.length - 1, idx));
      focus.index = clamped;
      const picked = filteredGames[clamped];
      if (picked && picked.id !== room.selectedGameId) {
        room.selectedGameId = picked.id;
        room.gameSettingValue = picked.defaultSetting;
      }
    };

    if (focus.zone === 'filter') {
      if (action === 'left') {
        focus.index = Math.max(0, focus.index - 1);
        this.playHostSound(room, 'nav');
      } else if (action === 'right') {
        focus.index = Math.min(PLAYER_FILTER_OPTIONS.length - 1, focus.index + 1);
        this.playHostSound(room, 'nav');
      } else if (action === 'down') {
        focus.zone = 'games';
        const curIdx = filteredGames.findIndex((g) => g.id === room.selectedGameId);
        selectGameAt(curIdx >= 0 ? curIdx : 0);
        this.playHostSound(room, 'nav');
      } else if (action === 'ok') {
        const chosenOpt = PLAYER_FILTER_OPTIONS[focus.index];
        if (chosenOpt) {
          room.lobbyFilter = chosenOpt.id;
          const nextGames = filterGamesByPlayerMode(room.lobbyFilter);
          if (nextGames.length > 0 && !nextGames.some((g) => g.id === room.selectedGameId)) {
            room.selectedGameId = nextGames[0].id;
            room.gameSettingValue = nextGames[0].defaultSetting;
          }
          this.playHostSound(room, 'confirm');
        }
      }
      this.broadcastRoom(room);
      return;
    }

    if (focus.zone === 'games') {
      if (filteredGames.length === 0) {
        focus.zone = 'filter';
        focus.index = 0;
        this.broadcastRoom(room);
        return;
      }
      if (action === 'left') {
        if (focus.index > 0) {
          selectGameAt(focus.index - 1);
          this.playHostSound(room, 'nav');
        }
      } else if (action === 'right') {
        if (focus.index < filteredGames.length - 1) {
          selectGameAt(focus.index + 1);
          this.playHostSound(room, 'nav');
        }
      } else if (action === 'up') {
        if (focus.index >= COLS) {
          selectGameAt(focus.index - COLS);
        } else {
          focus.zone = 'filter';
          focus.index = Math.max(
            0,
            PLAYER_FILTER_OPTIONS.findIndex((o) => o.id === room.lobbyFilter)
          );
        }
        this.playHostSound(room, 'nav');
      } else if (action === 'down') {
        const currentRow = Math.floor(focus.index / COLS);
        const lastRow = Math.floor((filteredGames.length - 1) / COLS);
        if (focus.index + COLS < filteredGames.length) {
          selectGameAt(focus.index + COLS);
        } else if (currentRow < lastRow) {
          selectGameAt(filteredGames.length - 1);
        } else {
          focus.zone = 'actions';
          focus.index = 0;
        }
        this.playHostSound(room, 'nav');
      } else if (action === 'ok') {
        // Ensure focused game is selected, then try to launch it (or move focus to Start bar with prompt)
        selectGameAt(focus.index);
        const started = this.attemptStartMatch(room, senderWs);
        if (!started) {
          focus.zone = 'actions';
          focus.index = 0;
          this.broadcastRoom(room);
        }
        return;
      }
      this.broadcastRoom(room);
      return;
    }

    // focus.zone === 'actions'
    if (action === 'left') {
      focus.index = Math.max(0, focus.index - 1);
      this.playHostSound(room, 'nav');
      this.broadcastRoom(room);
      return;
    }
    if (action === 'right') {
      focus.index = Math.min(ACTION_COUNT - 1, focus.index + 1);
      this.playHostSound(room, 'nav');
      this.broadcastRoom(room);
      return;
    }
    if (action === 'up') {
      focus.zone = 'games';
      const curIdx = filteredGames.findIndex((g) => g.id === room.selectedGameId);
      selectGameAt(curIdx >= 0 ? curIdx : Math.max(0, filteredGames.length - 1));
      this.playHostSound(room, 'nav');
      this.broadcastRoom(room);
      return;
    }
    if (action === 'ok') {
      if (focus.index === 0) {
        this.attemptStartMatch(room, senderWs);
      } else if (focus.index === 1) {
        const meta = getGameMeta(room.selectedGameId);
        const opts = meta.settingOptions;
        const curIdx = opts.findIndex((o) => o.value === room.gameSettingValue);
        const nextOpt = opts[(curIdx + 1) % opts.length];
        if (nextOpt) {
          room.gameSettingValue = nextOpt.value;
          this.playHostSound(room, 'confirm');
          this.broadcastRoom(room);
        }
      } else if (focus.index === 2) {
        this.addBotToRoom(room, senderWs);
      } else if (focus.index === 3) {
        const order: BotDifficulty[] = ['chill', 'arcade', 'spicy'];
        const nextDiff = order[(order.indexOf(room.botDifficulty) + 1) % order.length];
        room.botDifficulty = nextDiff;
        for (const p of room.players.values()) {
          if (p.isBot) p.botDifficulty = nextDiff;
        }
        this.playHostSound(room, 'confirm');
        this.broadcastRoom(room);
      } else if (focus.index === 4) {
        this.returnToSetup(room);
      }
    }
  }

  /**
   * Host-Only Authorization:
   * - During SETUP: either the Monitor screen OR the chosen Room Host phone can configure setup & enter the Game Room.
   * - Inside the Game Room & Match (LOBBY / BRIEFING / PLAYING / PAUSED / RESULTS):
   *   When a human Room Host is connected (`room.hostPlayerId !== null`), ONLY that Host's phone remote can control the screen
   *   until they pass host to another player. If there are 0 connected humans (bot-only room), the Monitor acts as fallback.
   */
  private getPrivilegedRoom(ws: WebSocket): RoomRecord | null {
    const binding = this.bindings.get(ws);
    if (!binding) return null;
    const room = this.rooms.get(binding.roomCode);
    if (!room) return null;

    if (binding.role === 'player' && binding.playerId && room.hostPlayerId === binding.playerId) {
      return room;
    }

    if (binding.role === 'host') {
      if (room.status === 'SETUP') return room;
      const activeHumanHost =
        room.hostPlayerId &&
        room.players.get(room.hostPlayerId)?.connected &&
        !room.players.get(room.hostPlayerId)?.isBot;
      if (!activeHumanHost) return room;
    }

    return null;
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
      if (p.connected && !p.isBot && p.ws) {
        this.send(p.ws, { type: 'player:haptic', pattern: 35, reason: 'countdown' });
      }
    }
  }

  private startMatch(room: RoomRecord, showBriefing = true): void {
    this.stopGameLoop(room);
    const engine = SERVER_GAMES[room.selectedGameId];
    for (const p of room.players.values()) {
      p.score = 0;
      p.alive = true;
      // During Rules Briefing, every human taps "I'm Ready!" once they finish reading (bots stay auto-ready)
      if (showBriefing) {
        p.ready = p.isBot ? true : false;
        p.statText = p.isBot ? 'Bot Ready' : 'Reading Rules';
      } else {
        p.statText = 'Get Ready!';
      }
      p.cooldownA = 0;
      p.cooldownB = 0;
      p.input = { dx: 0, dy: 0, a: false, b: false };
      p.prevA = false;
      p.prevB = false;
      if (p.isBot) {
        p.botMemory = createBotMemory();
      }
    }

    const playerList = this.toInputPlayers(room);
    room.gameState = engine.createState(playerList, room.gameSettingValue);
    room.lastSnapshot = engine.getSnapshot(room.gameState);
    room.rankings = [];
    room.lastActivityAt = Date.now();

    if (showBriefing) {
      room.status = 'BRIEFING';
      room.remoteFocus.modalIndex = 0;
      room.countdownValue = 0;
      room.countdownTimer = 0;
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

      // Wait patiently while players read the rules — no auto-countdown!
      // Starts automatically as soon as every connected human taps Ready on their phone (or host clicks Start Now).
      if (room.status === 'BRIEFING') {
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
            if (p.connected && !p.isBot && p.ws) {
              this.send(p.ws, { type: 'player:haptic', pattern: 35, reason: 'countdown' });
            }
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
            if (p.connected && !p.isBot && p.ws) {
              this.send(p.ws, { type: 'player:haptic', pattern: [55, 35, 95], reason: 'go' });
            }
          }
        }
        return;
      }

      if (room.status !== 'PLAYING' || !room.gameState) return;

      // Drive every manually assigned Robot via the universal game-aware AI controller
      for (const p of room.players.values()) {
        if (p.isBot) {
          if (!p.botMemory) p.botMemory = createBotMemory();
          p.input = computeBotInput(
            room.lastSnapshot,
            p.id,
            p.botDifficulty ?? room.botDifficulty,
            dt,
            p.botMemory
          );
        }
      }

      const currentInputs = this.toInputPlayers(room);
      const result = engine.step(room.gameState, currentInputs, dt);

      // Persist edge-trigger states & live HUD telemetry
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

      // Coalesce & dispatch targeted phone haptics (human phones only)
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
          if (target && target.connected && !target.isBot && target.ws) {
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
        room.remoteFocus.modalIndex = 0;
        room.rankings = result.rankings ?? engine.getRankings(room.gameState, currentInputs);
        for (const p of room.players.values()) {
          if (p.connected && !p.isBot && p.ws) {
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
        isBot: p.isBot,
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
      if (p && !p.isBot && p.ws === ws) {
        p.ws = null;
        p.connected = false;
        p.disconnectedAt = Date.now();
        p.input = { dx: 0, dy: 0, a: false, b: false };
        this.ensureHostPlayer(room);
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
      if (player && !player.isBot && player.ws === ws) {
        player.ws = null;
        player.connected = false;
        player.disconnectedAt = Date.now();
        player.input = { dx: 0, dy: 0, a: false, b: false };
        this.ensureHostPlayer(room);
        if (this.checkBriefingReadyAdvance(room)) return;
        this.broadcastRoom(room);
      }
    }
  }

  private closeRoom(room: RoomRecord, reason: string): void {
    this.stopGameLoop(room);
    const closedMsg: ServerMessage = { type: 'room:closed', reason };

    if (room.hostWs) {
      this.send(room.hostWs, closedMsg);
      this.bindings.delete(room.hostWs);
      room.hostWs = null;
    }

    for (const p of room.players.values()) {
      if (!p.isBot && p.ws) {
        this.send(p.ws, closedMsg);
        this.bindings.delete(p.ws);
        p.ws = null;
      }
    }

    room.players.clear();
    this.rooms.delete(room.code);
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      let changed = false;

      // Prune long-disconnected human players (never prune manually assigned bots)
      for (const [pid, p] of room.players.entries()) {
        if (!p.isBot && !p.connected && p.disconnectedAt && now - p.disconnectedAt > PLAYER_RECONNECT_GRACE_MS) {
          room.players.delete(pid);
          changed = true;
        }
      }

      if (changed) {
        this.ensureHostPlayer(room);
        this.broadcastRoom(room);
      }

      const hostGone =
        !room.hostWs &&
        room.hostDisconnectedAt !== null &&
        now - room.hostDisconnectedAt > HOST_RECONNECT_GRACE_MS;
      const idleExpired = now - room.lastActivityAt > IDLE_ROOM_TTL_MS;

      if (hostGone || idleExpired) {
        this.closeRoom(room, 'The host monitor session ended.');
      }
    }
  }
}
