import crypto from 'crypto';
import type { WebSocket } from 'ws';
import {
  MAX_PLAYERS_PER_ROOM,
  PLAYER_PALETTE,
  type BotDifficulty,
  type CardPrivateState,
  type ClientMessage,
  type ControllerInput,
  type CupVoteState,
  type FrenzyState,
  type GameId,
  type GameSnapshot,
  type HostTransferNotice,
  type HostTransferReason,
  type PlayerColorSpec,
  type PlayerFilterMode,
  type PlayerMatchStats,
  type PlayerSummary,
  type RankingEntry,
  type RemoteDirection,
  type RemoteFocusState,
  type RoomReadyGate,
  type RoomSnapshot,
  type RoomStatus,
  type ServerMessage,
  type SoundEvent,
  type TournamentMatchRecord,
  type TournamentPlayerStanding,
  type TournamentState,
} from '../src/shared/types.ts';
import {
  AVATAR_PRESETS,
  computeTeamStandings,
  getTeamsForMode,
  isValidAvatarId,
  type TeamId,
  type TeamMode,
  type TeamStanding,
} from '../src/shared/party.ts';
import {
  CARD_GAME_IDS,
  filterGamesByPlayerMode,
  GAME_CATALOG,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../src/shared/games.ts';
import {
  CHAOS_WHEEL_MUTATORS,
  computeTournamentMarks,
  getMutatorSpec,
  MUTATOR_BY_ID,
  TOURNAMENT_TOTAL_GAMES,
  type MutatorId,
} from '../src/shared/modifiers.ts';
import { SERVER_GAMES, type ServerPlayerInputState } from './games/engine.ts';
import { computeBotInput, createBotMemory, type BotMemory } from './games/botController.ts';

const VALID_TEAM_MODES = new Set<TeamMode>(['ffa', 'teams-2', 'teams-3', 'teams-4', 'one-vs-all']);
const CUP_VOTE_SECONDS = 15;

function isSimDeviceId(deviceId?: string): boolean {
  return Boolean(deviceId && /^sim_device_[A-Z0-9]{4}_P[12]$/i.test(deviceId.trim()));
}

interface ConnectedPlayer {
  id: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
  avatarId: string;
  teamId: TeamId | null;
  ws: WebSocket | null;
  connected: boolean;
  ready: boolean;
  isBot: boolean;
  deviceId?: string;
  isTestController?: boolean;
  botDifficulty?: BotDifficulty;
  botMemory?: BotMemory;
  score: number;
  rawGameScore: number;
  bonusScore: number;
  alive: boolean;
  statText: string;
  cooldownA: number;
  cooldownB: number;
  input: ControllerInput;
  prevA: boolean;
  prevB: boolean;
  disconnectedAt: number | null;
  matchStats: PlayerMatchStats;
  cardPromptStartedAt: number | null;
}

function createDefaultMatchStats(): PlayerMatchStats {
  return {
    wins: 0,
    cardWins: 0,
    matchesPlayed: 0,
    totalActions: 0,
    cardActions: 0,
    cardResponses: 0,
    totalCardResponseMs: 0,
    avgCardResponseMs: null,
    lastCardResponseMs: null,
    fastestCardResponseMs: null,
  };
}

function recordCardPlayerResponse(player: ConnectedPlayer, elapsedMs: number): void {
  const clamped = Math.max(80, Math.min(30_000, Math.round(elapsedMs)));
  const st = player.matchStats;
  st.cardResponses += 1;
  st.totalCardResponseMs += clamped;
  st.lastCardResponseMs = clamped;
  st.avgCardResponseMs = Math.round(st.totalCardResponseMs / st.cardResponses);
  st.fastestCardResponseMs =
    st.fastestCardResponseMs === null ? clamped : Math.min(st.fastestCardResponseMs, clamped);
}

interface HostHapticTracker {
  lastActivePlayerId: string | null;
  lastPhase: string | null;
  lastRoundOrWave: number | null;
  lastBanner: string | null;
  lastLightState: string | null;
  lastHolderId: string | null;
  lastFeverActive: boolean;
  lastFiresCount: number;
  lastHighestBidderId: string | null;
  lastCardTurnByPlayer: Map<string, boolean>;
  lastCardActionReqByPlayer: Map<string, boolean>;
  lastSentAtByPlayer: Map<string, number>;
}

function createHostHapticTracker(): HostHapticTracker {
  return {
    lastActivePlayerId: null,
    lastPhase: null,
    lastRoundOrWave: null,
    lastBanner: null,
    lastLightState: null,
    lastHolderId: null,
    lastFeverActive: false,
    lastFiresCount: 0,
    lastHighestBidderId: null,
    lastCardTurnByPlayer: new Map(),
    lastCardActionReqByPlayer: new Map(),
    lastSentAtByPlayer: new Map(),
  };
}

interface RoomRecord {
  code: string;
  hostToken: string;
  hostWs: WebSocket | null;
  hostDisconnectedAt: number | null;
  hostPlayerId: string | null;
  hostTransfer: HostTransferNotice | null;
  hostTransferSeq: number;
  botDifficulty: BotDifficulty;
  teamMode: TeamMode;
  teamRankings: TeamStanding[];
  status: RoomStatus;
  selectedGameId: GameId;
  gameSettingValue: number;
  lobbyFilter: PlayerFilterMode;
  lobbyGameCols: number;
  lobbyActionCols: number;
  remoteFocus: RemoteFocusState;
  activeMutator: MutatorId;
  mutatorSpinSeq: number;
  frenzy: FrenzyState;
  matchElapsedSec: number;
  tournament: TournamentState | null;
  countdownValue: number;
  countdownTimer: number;
  players: Map<string, ConnectedPlayer>;
  gameState: unknown | null;
  lastSnapshot: GameSnapshot | null;
  lastCardStateHashes: Map<string, string>;
  hapticTracker: HostHapticTracker;
  rankings: RankingEntry[];
  createdAt: number;
  lastActivityAt: number;
  tickInterval: ReturnType<typeof setInterval> | null;
  voteInterval: ReturnType<typeof setInterval> | null;
  voteLockTimeout: ReturnType<typeof setTimeout> | null;
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
const LOBBY_DISCONNECT_GRACE_MS = 45_000; // 45s auto-prune in SETUP / LOBBY so offline players never block the lobby
const PLAYER_RECONNECT_GRACE_MS = 10 * 60_000; // 10m reconnect grace during active match phases
const HOST_PLAYER_MIGRATION_GRACE_MS = 15_000; // 15s grace before migrating hostPlayerId on disconnect
const HOST_RECONNECT_GRACE_MS = 15 * 60_000;
const IDLE_ROOM_TTL_MS = 90 * 60_000;
const WS_HEARTBEAT_INTERVAL_MS = 10_000;
const WS_HEARTBEAT_TIMEOUT_MS = 45_000;

export class RoomManager {
  private rooms = new Map<string, RoomRecord>();
  private bindings = new Map<WebSocket, SocketBinding>();
  private socketAlive = new Map<WebSocket, boolean>();
  private socketLastSeen = new Map<WebSocket, number>();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private heartbeatInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.pruneExpired(), 2_000);
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
        // Send both RFC6455 ping AND a lightweight JSON pong data frame so proxies/Cloud Run/NAT firewalls never idle-close the monitor
        this.send(ws, { type: 'pong' });
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

  private ensureHostPlayer(
    room: RoomRecord,
    opts?: {
      forceMigrate?: boolean;
      reason?: HostTransferReason;
      prevHostName?: string;
    }
  ): void {
    const connectedHumans = [...room.players.values()]
      .filter((p) => !p.isBot && p.connected)
      .sort((a, b) => a.slotIndex - b.slotIndex);
    const connectedPhones = connectedHumans.filter((p) => !p.isTestController);

    if (room.hostPlayerId) {
      const current = room.players.get(room.hostPlayerId);
      if (current && !current.isBot) {
        if (current.connected) {
          // Test Controllers must never remain hostPlayerId if any real phone player is connected
          if (current.isTestController && connectedPhones.length > 0) {
            const nextHost = connectedPhones[0];
            room.hostPlayerId = nextHost.id;
            room.hostTransferSeq += 1;
            room.hostTransfer = {
              seq: room.hostTransferSeq,
              toPlayerId: nextHost.id,
              toPlayerName: nextHost.name,
              toSlotIndex: nextHost.slotIndex,
              fromPlayerName: current.name,
              reason: 'real-phone-priority',
            };
            this.dispatchHapticToPlayer(room, nextHost.id, {
              pattern: [45, 30, 85],
              reason: 'host-transfer',
              event: 'host-transfer',
              label: 'HOST REMOTE ACTIVE',
              intensity: 'medium',
              minGapMs: 0,
            });
          }
          return;
        }

        // Disconnected host: if not forced (e.g. not left/kicked), hold hostPlayerId during the 15s grace window
        // unless current was a Test Controller and a real phone is connected.
        if (!opts?.forceMigrate) {
          const isTestYieldingToPhone = current.isTestController && connectedPhones.length > 0;
          const withinGrace =
            current.disconnectedAt !== null &&
            Date.now() - current.disconnectedAt < HOST_PLAYER_MIGRATION_GRACE_MS;
          if (!isTestYieldingToPhone && withinGrace) {
            return;
          }
        }
      }
    }

    // Prefer connected real phones in deterministic slot order (P1 -> P2 -> ...);
    // fall back to Test Controllers only when 0 real phone players are connected.
    const pool = connectedPhones.length > 0 ? connectedPhones : connectedHumans;
    if (pool.length === 0) {
      room.hostPlayerId = null;
      return;
    }

    const prevHostId = room.hostPlayerId;
    const prevHost = prevHostId ? room.players.get(prevHostId) : null;
    const fromName = opts?.prevHostName ?? prevHost?.name;

    const picked = pool[0];
    room.hostPlayerId = picked.id;

    if ((prevHostId !== null && prevHostId !== picked.id) || opts?.reason) {
      room.hostTransferSeq += 1;
      room.hostTransfer = {
        seq: room.hostTransferSeq,
        toPlayerId: picked.id,
        toPlayerName: picked.name,
        toSlotIndex: picked.slotIndex,
        fromPlayerName: fromName,
        reason: opts?.reason ?? 'disconnect-timeout',
      };
    }

    this.dispatchHapticToPlayer(room, picked.id, {
      pattern: [45, 30, 85],
      reason: 'host-transfer',
      event: 'host-transfer',
      label: 'HOST REMOTE ACTIVE',
      intensity: 'medium',
      minGapMs: 0,
    });
  }

  private computeRoomReadyGate(room: RoomRecord): RoomReadyGate {
    const sorted = [...room.players.values()].sort((a, b) => a.slotIndex - b.slotIndex);
    const humans = sorted.filter((p) => !p.isBot);
    const bots = sorted.filter((p) => p.isBot);
    const connectedHumans = humans.filter((p) => p.connected);
    const offlineHumans = humans.filter((p) => !p.connected);
    const readyHumans = connectedHumans.filter((p) => p.ready);
    const unreadyHumans = connectedHumans.filter((p) => !p.ready);
    const allHumansReady = unreadyHumans.length === 0;
    const activeParticipantCount = connectedHumans.length + bots.length;
    const canStart = activeParticipantCount > 0 && allHumansReady;

    return {
      totalPlayers: sorted.length,
      connectedHumanCount: connectedHumans.length,
      readyHumanCount: readyHumans.length,
      unreadyHumanIds: unreadyHumans.map((p) => p.id),
      unreadyHumanNames: unreadyHumans.map((p) => p.name),
      offlineHumanIds: offlineHumans.map((p) => p.id),
      offlineHumanNames: offlineHumans.map((p) => p.name),
      allHumansReady,
      canStart,
    };
  }

  private dispatchHapticToPlayer(
    room: RoomRecord,
    playerId: string,
    spec: {
      pattern: number | number[];
      reason: string;
      event?: string;
      label?: string;
      intensity?: 'light' | 'medium' | 'heavy';
      minGapMs?: number;
    }
  ): void {
    const p = room.players.get(playerId);
    if (!p || p.isBot || !p.connected || !p.ws) return;
    const now = Date.now();
    const minGap = spec.minGapMs ?? 140;
    const lastSent = room.hapticTracker.lastSentAtByPlayer.get(playerId) ?? 0;
    if (minGap > 0 && now - lastSent < minGap) return;
    room.hapticTracker.lastSentAtByPlayer.set(playerId, now);
    this.send(p.ws, {
      type: 'player:haptic',
      pattern: spec.pattern,
      reason: spec.reason,
      event: spec.event ?? spec.reason,
      label: spec.label,
      intensity: spec.intensity,
    });
  }

  private broadcastHapticToRoom(
    room: RoomRecord,
    spec: {
      pattern: number | number[];
      reason: string;
      event?: string;
      label?: string;
      intensity?: 'light' | 'medium' | 'heavy';
      minGapMs?: number;
      excludePlayerId?: string;
      onlyAlive?: boolean;
    }
  ): void {
    for (const p of room.players.values()) {
      if (p.isBot || !p.connected || !p.ws) continue;
      if (spec.excludePlayerId && p.id === spec.excludePlayerId) continue;
      if (spec.onlyAlive && !p.alive) continue;
      this.dispatchHapticToPlayer(room, p.id, spec);
    }
  }

  private checkBriefingReadyAdvance(room: RoomRecord): boolean {
    if (room.status !== 'BRIEFING') return false;
    const gate = this.computeRoomReadyGate(room);
    if (gate.connectedHumanCount > 0 && gate.allHumansReady) {
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
        avatarId: p.avatarId,
        teamId: p.teamId,
        connected: p.connected,
        ready: p.ready,
        isBot: p.isBot,
        isTestController: p.isTestController,
        botDifficulty: p.isBot ? p.botDifficulty ?? room.botDifficulty : undefined,
        score: p.score,
        alive: p.alive,
        statText: p.statText,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
        matchStats: { ...p.matchStats },
      }));

    const liveTeamRankings =
      room.teamMode === 'ffa'
        ? []
        : room.status === 'RESULTS' && room.teamRankings.length > 0
        ? room.teamRankings.map((t) => ({ ...t, memberIds: [...t.memberIds] }))
        : computeTeamStandings(
            room.teamMode,
            players.map((p) => ({ id: p.id, teamId: p.teamId, score: p.score }))
          );

    return {
      code: room.code,
      status: room.status,
      selectedGameId: room.selectedGameId,
      gameSettingValue: room.gameSettingValue,
      botDifficulty: room.botDifficulty,
      teamMode: room.teamMode,
      teamRankings: liveTeamRankings,
      hostPlayerId: room.hostPlayerId,
      hostTransfer: room.hostTransfer ? { ...room.hostTransfer } : null,
      readyGate: this.computeRoomReadyGate(room),
      lobbyFilter: room.lobbyFilter,
      remoteFocus: { ...room.remoteFocus },
      activeMutator: room.activeMutator,
      mutatorSpinSeq: room.mutatorSpinSeq,
      frenzy: { ...room.frenzy },
      tournament: room.tournament
        ? {
            ...room.tournament,
            gameQueue: [...room.tournament.gameQueue],
            standings: room.tournament.standings.map((s) => ({ ...s })),
            teamStandings: room.tournament.teamStandings
              ? room.tournament.teamStandings.map((ts) => ({
                  ...ts,
                  memberIds: [...ts.memberIds],
                }))
              : undefined,
            history: room.tournament.history.map((h) => ({ ...h })),
            vote: room.tournament.vote
              ? {
                  ...room.tournament.vote,
                  candidates: [...room.tournament.vote.candidates],
                  votes: { ...room.tournament.vote.votes },
                }
              : null,
          }
        : null,
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

  private pickAvatar(room: RoomRecord, slotIndex: number, preferredAvatarId?: string): string {
    if (isValidAvatarId(preferredAvatarId)) {
      return preferredAvatarId;
    }
    const usedAvatars = new Set([...room.players.values()].map((p) => p.avatarId));
    const defaultPreset = AVATAR_PRESETS[slotIndex % AVATAR_PRESETS.length];
    if (!usedAvatars.has(defaultPreset.id)) return defaultPreset.id;
    return AVATAR_PRESETS.find((a) => !usedAvatars.has(a.id))?.id ?? defaultPreset.id;
  }

  private pickTeamForNewPlayer(room: RoomRecord): TeamId | null {
    if (room.teamMode === 'ffa') return null;
    if (room.teamMode === 'one-vs-all') {
      const hasBoss = [...room.players.values()].some((p) => p.teamId === 'boss');
      return hasBoss ? 'squad' : 'boss';
    }
    const teams = getTeamsForMode(room.teamMode);
    if (teams.length === 0) return null;
    const counts = new Map<TeamId, number>(teams.map((t) => [t, 0]));
    for (const p of room.players.values()) {
      if (p.teamId && counts.has(p.teamId)) {
        counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
      }
    }
    let bestTeam = teams[0];
    let bestCount = Infinity;
    for (const t of teams) {
      const c = counts.get(t) ?? 0;
      if (c < bestCount) {
        bestCount = c;
        bestTeam = t;
      }
    }
    return bestTeam;
  }

  private assignBalancedTeams(room: RoomRecord, shuffle = false): void {
    const list = [...room.players.values()].sort((a, b) => a.slotIndex - b.slotIndex);
    if (room.teamMode === 'ffa') {
      for (const p of list) p.teamId = null;
      return;
    }
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    if (room.teamMode === 'one-vs-all') {
      if (list.length === 0) return;
      const bossCandidate = shuffle
        ? list[0]
        : list.find((p) => p.id === room.hostPlayerId) ?? list[0];
      for (const p of list) {
        p.teamId = p.id === bossCandidate.id ? 'boss' : 'squad';
      }
      return;
    }
    const teams = getTeamsForMode(room.teamMode);
    list.forEach((p, idx) => {
      p.teamId = teams[idx % teams.length];
    });
  }

  private setPlayerTeam(room: RoomRecord, playerId: string, nextTeamId: TeamId): boolean {
    if (room.teamMode === 'ffa') return false;
    const validTeams = getTeamsForMode(room.teamMode);
    if (!validTeams.includes(nextTeamId)) return false;
    const target = room.players.get(playerId);
    if (!target) return false;

    if (room.teamMode === 'one-vs-all') {
      if (nextTeamId === 'boss') {
        for (const p of room.players.values()) {
          p.teamId = p.id === target.id ? 'boss' : 'squad';
        }
      } else {
        target.teamId = 'squad';
        const remainingBoss = [...room.players.values()].find(
          (p) => p.id !== target.id && p.teamId === 'boss'
        );
        if (!remainingBoss) {
          const fallback = [...room.players.values()].find((p) => p.id !== target.id);
          if (fallback) {
            fallback.teamId = 'boss';
          } else {
            target.teamId = 'boss';
          }
        }
      }
      return true;
    }

    target.teamId = nextTeamId;
    return true;
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
      case 'ping': {
        const binding = this.bindings.get(ws);
        if (binding) {
          const boundRoom = this.rooms.get(binding.roomCode);
          if (boundRoom) {
            boundRoom.lastActivityAt = Date.now();
          }
        }
        this.send(ws, { type: 'pong' });
        return;
      }

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
          hostTransfer: null,
          hostTransferSeq: 0,
          botDifficulty: 'arcade',
          teamMode: 'ffa',
          teamRankings: [],
          status: 'SETUP',
          selectedGameId: gameId,
          gameSettingValue: meta.defaultSetting,
          lobbyFilter: 'all',
          lobbyGameCols: 4,
          lobbyActionCols: 7,
          remoteFocus: { zone: 'games', index: 0, modalIndex: 0 },
          activeMutator: 'normal',
          mutatorSpinSeq: 0,
          frenzy: {
            active: false,
            freezing: false,
            freezeRemaining: 0,
            freezeTotal: 3.0,
            triggerCount: 0,
          },
          matchElapsedSec: 0,
          tournament: null,
          countdownValue: 3,
          countdownTimer: 0,
          players: new Map(),
          gameState: null,
          lastSnapshot: null,
          lastCardStateHashes: new Map(),
          hapticTracker: createHostHapticTracker(),
          rankings: [],
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          tickInterval: null,
          voteInterval: null,
          voteLockTimeout: null,
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
        const staleHostWs = room.hostWs;
        if (staleHostWs && staleHostWs !== ws) {
          this.bindings.delete(staleHostWs);
          this.cleanupSocketTracking(staleHostWs);
          try {
            if (staleHostWs.readyState === 1 || staleHostWs.readyState === 0) {
              staleHostWs.close();
            }
          } catch {
            // Ignore close errors on stale socket
          }
        }
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
        const cleanDeviceId =
          typeof msg.deviceId === 'string' && msg.deviceId.trim()
            ? msg.deviceId.trim().slice(0, 80)
            : undefined;
        const isSimController = isSimDeviceId(cleanDeviceId);
        room.lastActivityAt = Date.now();

        // 1. Reclaim by exact playerId
        let existing: ConnectedPlayer | undefined =
          msg.playerId && room.players.has(msg.playerId)
            ? room.players.get(msg.playerId)
            : undefined;
        if (existing?.isBot) {
          existing = undefined;
        }

        // 2. Reclaim by persistent deviceId (same device/session re-joining)
        if (!existing && cleanDeviceId) {
          existing = [...room.players.values()].find(
            (p) => !p.isBot && p.deviceId && p.deviceId === cleanDeviceId
          );
        }

        // 3. Name-match fallback is allowed ONLY for deterministic Test Controller IDs (sim_device_..._P1 / P2)
        if (!existing && isSimController) {
          const normName = cleanName.toLowerCase();
          existing = [...room.players.values()].find(
            (p) =>
              !p.isBot &&
              (p.isTestController || p.name.toLowerCase().startsWith('test p')) &&
              p.name.toLowerCase() === normName
          );
        }

        if (existing && !existing.isBot) {
          this.detachSocket(ws);
          // Kill any stale socket previously bound to this player slot so zombie connections never linger
          const stalePlayerWs = existing.ws;
          if (stalePlayerWs && stalePlayerWs !== ws) {
            this.bindings.delete(stalePlayerWs);
            this.cleanupSocketTracking(stalePlayerWs);
            try {
              if (stalePlayerWs.readyState === 1 || stalePlayerWs.readyState === 0) {
                stalePlayerWs.close();
              }
            } catch {
              // Ignore close errors on stale socket
            }
          }

          existing.ws = ws;
          existing.connected = true;
          existing.disconnectedAt = null;
          existing.name = cleanName;
          if (cleanDeviceId) {
            existing.deviceId = cleanDeviceId;
          }
          if (isSimController || msg.isTestController) {
            existing.isTestController = isSimController || Boolean(msg.isTestController);
          }
          if (isValidAvatarId(msg.avatarId)) {
            existing.avatarId = msg.avatarId;
          }
          this.ensureHostPlayer(room);
          this.bindings.set(ws, { role: 'player', roomCode: code, playerId: existing.id });
          this.send(ws, {
            type: 'room:joined',
            playerId: existing.id,
            room: this.buildRoomSnapshot(room),
          });
          if (
            room.gameState &&
            (room.status === 'PLAYING' || room.status === 'COUNTDOWN' || room.status === 'PAUSED')
          ) {
            const engine = SERVER_GAMES[room.selectedGameId];
            const states = engine.getPrivateStates?.(room.gameState, this.toInputPlayers(room));
            if (states && states[existing.id]) {
              this.send(ws, { type: 'player:card-state', cardState: states[existing.id] });
            }
          }
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
        const avatarId = this.pickAvatar(room, slotIndex, msg.avatarId);
        const teamId = this.pickTeamForNewPlayer(room);

        const player: ConnectedPlayer = {
          id: playerId,
          slotIndex,
          name: cleanName,
          color,
          avatarId,
          teamId,
          ws,
          connected: true,
          ready: false,
          isBot: false,
          deviceId: cleanDeviceId,
          isTestController: isSimController || Boolean(msg.isTestController),
          score: 0,
          rawGameScore: 0,
          bonusScore: 0,
          alive: true,
          statText: room.status === 'SETUP' ? 'In Setup' : 'In Lobby',
          cooldownA: 0,
          cooldownB: 0,
          input: { dx: 0, dy: 0, a: false, b: false },
          prevA: false,
          prevB: false,
          disconnectedAt: null,
          matchStats: createDefaultMatchStats(),
          cardPromptStartedAt: null,
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
        const binding = this.bindings.get(ws);
        const room =
          binding?.role === 'host'
            ? this.rooms.get(binding.roomCode) ?? null
            : this.getPrivilegedRoom(ws);
        if (!room) return;
        if (room.status !== 'SETUP' && room.status !== 'LOBBY') return;
        const target = room.players.get(msg.botId);
        if (!target || !target.isBot) return;
        room.players.delete(msg.botId);
        if (room.teamMode === 'one-vs-all' && target.teamId === 'boss') {
          this.assignBalancedTeams(room, false);
        }
        room.lastActivityAt = Date.now();
        this.broadcastRoom(room);
        return;
      }

      case 'room:kick-player': {
        const binding = this.bindings.get(ws);
        if (!binding) return;
        const room =
          binding.role === 'host'
            ? this.rooms.get(binding.roomCode) ?? null
            : this.getPrivilegedRoom(ws);
        if (!room) return;
        const target = room.players.get(msg.playerId);
        if (!target) return;
        if (binding.role === 'player' && binding.playerId === target.id) return;

        if (target.ws) {
          this.send(target.ws, {
            type: 'room:closed',
            reason: 'You were removed from the room by the host.',
          });
          this.bindings.delete(target.ws);
          this.cleanupSocketTracking(target.ws);
          try {
            if (target.ws.readyState === 1 || target.ws.readyState === 0) {
              target.ws.close();
            }
          } catch {
            // Ignore close errors
          }
          target.ws = null;
        }

        const wasHost = room.hostPlayerId === target.id;
        room.players.delete(target.id);
        if (room.teamMode === 'one-vs-all' && target.teamId === 'boss') {
          this.assignBalancedTeams(room, false);
        }
        if (wasHost) {
          room.hostPlayerId = null;
          this.ensureHostPlayer(room, {
            forceMigrate: true,
            reason: 'kicked',
            prevHostName: target.name,
          });
        } else {
          this.ensureHostPlayer(room);
        }
        room.lastActivityAt = Date.now();
        if (this.checkBriefingReadyAdvance(room)) return;
        if (this.checkCupVoteEarlyLock(room)) return;
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

      case 'room:set-team-mode': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (room.status !== 'SETUP' && room.status !== 'LOBBY') return;
        if (!VALID_TEAM_MODES.has(msg.teamMode)) return;
        room.teamMode = msg.teamMode;
        room.teamRankings = [];
        this.assignBalancedTeams(room, false);
        room.lastActivityAt = Date.now();
        this.playHostSound(room, 'confirm');
        this.broadcastRoom(room);
        return;
      }

      case 'room:set-player-team': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (room.status !== 'SETUP' && room.status !== 'LOBBY') return;
        if (this.setPlayerTeam(room, msg.playerId, msg.teamId)) {
          room.lastActivityAt = Date.now();
          this.playHostSound(room, 'nav');
          this.broadcastRoom(room);
        }
        return;
      }

      case 'room:shuffle-teams': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (room.status !== 'SETUP' && room.status !== 'LOBBY') return;
        if (room.teamMode === 'ffa') return;
        this.assignBalancedTeams(room, true);
        room.lastActivityAt = Date.now();
        this.playHostSound(room, 'wheel');
        this.broadcastRoom(room);
        return;
      }

      case 'room:set-host-player': {
        const binding = this.bindings.get(ws);
        const room =
          binding?.role === 'host'
            ? this.rooms.get(binding.roomCode) ?? null
            : this.getPrivilegedRoom(ws);
        if (!room) return;
        const target = room.players.get(msg.playerId);
        if (!target || target.isBot || !target.connected) {
          this.send(ws, {
            type: 'error',
            message: 'Only a connected human player can be chosen as the Room Host.',
          });
          return;
        }
        const prevHost = room.hostPlayerId ? room.players.get(room.hostPlayerId) : null;
        room.hostPlayerId = target.id;
        room.hostTransferSeq += 1;
        room.hostTransfer = {
          seq: room.hostTransferSeq,
          toPlayerId: target.id,
          toPlayerName: target.name,
          toSlotIndex: target.slotIndex,
          fromPlayerName: prevHost?.name,
          reason: 'manual',
        };
        room.lastActivityAt = Date.now();
        this.playHostSound(room, 'confirm');
        if (target.ws) {
          this.send(target.ws, { type: 'player:haptic', pattern: [45, 30, 85], reason: 'host' });
        }
        this.broadcastRoom(room);
        return;
      }

      case 'room:set-mutator': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (!MUTATOR_BY_ID[msg.mutatorId]) return;
        room.activeMutator = msg.mutatorId;
        room.lastActivityAt = Date.now();
        this.playHostSound(room, 'confirm');
        this.broadcastRoom(room);
        return;
      }

      case 'room:spin-mutator': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        this.spinRoomMutator(room);
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
        this.broadcastHapticToRoom(room, {
          pattern: [22, 28, 34],
          reason: 'phase-transition',
          event: 'phase-transition',
          label: 'GAME ROOM',
          intensity: 'light',
          minGapMs: 80,
        });
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

      case 'room:layout': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'host') return;
        const room = this.rooms.get(binding.roomCode);
        if (!room) return;
        if (Number.isFinite(msg.gameCols)) {
          room.lobbyGameCols = Math.max(1, Math.min(8, Math.round(msg.gameCols)));
        }
        if (Number.isFinite(msg.actionCols)) {
          room.lobbyActionCols = Math.max(1, Math.min(10, Math.round(msg.actionCols)));
        }
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
          if (room.hostPlayerId && room.hostPlayerId !== player.id) {
            this.dispatchHapticToPlayer(room, room.hostPlayerId, {
              pattern: 18,
              reason: 'player-ready',
              event: 'player-ready',
              label: `${player.name} READY`,
              intensity: 'light',
              minGapMs: 120,
            });
          }
        }

        // During Rules Briefing: as soon as EVERY connected human presses Ready, start immediately (no auto-countdown!)
        if (this.checkBriefingReadyAdvance(room)) return;

        this.broadcastRoom(room);
        return;
      }

      case 'player:set-avatar': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'player' || !binding.playerId) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room) return;
        const player = room.players.get(binding.playerId);
        if (!player || player.isBot) return;
        if (!isValidAvatarId(msg.avatarId)) return;
        player.avatarId = msg.avatarId;
        if (room.tournament) {
          const st = room.tournament.standings.find((s) => s.playerId === player.id);
          if (st) st.avatarId = player.avatarId;
        }
        room.lastActivityAt = Date.now();
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
        return;
      }

      case 'player:set-team': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'player' || !binding.playerId) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room || (room.status !== 'SETUP' && room.status !== 'LOBBY')) return;
        if (this.setPlayerTeam(room, binding.playerId, msg.teamId)) {
          room.lastActivityAt = Date.now();
          this.playHostSound(room, 'nav');
          this.broadcastRoom(room);
        }
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
        const leavingPlayer = room.players.get(binding.playerId);
        const wasHost = leavingPlayer && room.hostPlayerId === leavingPlayer.id;
        room.players.delete(binding.playerId);
        this.bindings.delete(ws);
        if (leavingPlayer && room.teamMode === 'one-vs-all' && leavingPlayer.teamId === 'boss') {
          this.assignBalancedTeams(room, false);
        }
        if (wasHost && leavingPlayer) {
          room.hostPlayerId = null;
          this.ensureHostPlayer(room, {
            forceMigrate: true,
            reason: 'player-left',
            prevHostName: leavingPlayer.name,
          });
        } else {
          this.ensureHostPlayer(room);
        }
        room.lastActivityAt = Date.now();
        if (this.checkBriefingReadyAdvance(room)) return;
        if (this.checkCupVoteEarlyLock(room)) return;
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
          this.broadcastHapticToRoom(room, {
            pattern: 22,
            reason: 'pause',
            event: 'phase-transition',
            label: 'MATCH PAUSED',
            intensity: 'light',
            minGapMs: 60,
          });
          this.broadcastRoom(room);
        } else if (room.status === 'PAUSED' && !msg.paused) {
          room.status = 'PLAYING';
          this.broadcastHapticToRoom(room, {
            pattern: [22, 24, 34],
            reason: 'resume',
            event: 'phase-transition',
            label: 'MATCH RESUMED',
            intensity: 'light',
            minGapMs: 60,
          });
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

      case 'tournament:start': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        this.attemptStartTournament(room, ws);
        return;
      }

      case 'tournament:vote': {
        const binding = this.bindings.get(ws);
        if (!binding) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room || room.status !== 'VOTING' || !room.tournament?.vote) return;
        const vote = room.tournament.vote;
        if (vote.phase !== 'voting') return;
        if (!vote.candidates.includes(msg.gameId)) return;
        if (binding.role === 'host') {
          if (room.hostPlayerId) return;
          this.lockCupVote(room, msg.gameId);
          return;
        }
        if (binding.role !== 'player' || !binding.playerId) return;
        vote.votes[binding.playerId] = msg.gameId;
        room.lastActivityAt = Date.now();
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
        this.checkCupVoteEarlyLock(room);
        return;
      }

      case 'tournament:force-lock-vote': {
        const room = this.getPrivilegedRoom(ws);
        if (!room || room.status !== 'VOTING' || !room.tournament?.vote) return;
        if (room.tournament.vote.phase !== 'voting') return;
        this.lockCupVote(room);
        return;
      }

      case 'tournament:next': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        if (!room.tournament?.active || room.tournament.completed) return;
        const nextIdx = room.tournament.currentGameIndex + 1;
        if (nextIdx >= room.tournament.totalGames) return;
        this.startCupVoteRound(room, nextIdx);
        return;
      }

      case 'tournament:exit': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        room.tournament = null;
        this.returnToLobby(room);
        return;
      }

      case 'card:action': {
        const binding = this.bindings.get(ws);
        if (!binding || binding.role !== 'player' || !binding.playerId) return;
        const room = this.rooms.get(binding.roomCode);
        if (!room || room.status !== 'PLAYING' || room.frenzy.freezing || !room.gameState) return;
        const player = room.players.get(binding.playerId);
        if (!player || player.isBot) return;

        const engine = SERVER_GAMES[room.selectedGameId];
        if (!engine.handleCardAction) return;

        const now = Date.now();
        if (msg.action.type !== 'select-index') {
          player.matchStats.totalActions += 1;
          player.matchStats.cardActions += 1;
          const isDecisionAction =
            msg.action.type === 'play-card' ||
            msg.action.type === 'draw-or-pass' ||
            msg.action.type === 'pick-color' ||
            msg.action.type === 'submit-selected' ||
            msg.action.type === 'call-bluff' ||
            msg.action.type === 'trust-claim' ||
            msg.action.type === 'custom';
          if (isDecisionAction) {
            let elapsedMs: number | null =
              player.cardPromptStartedAt !== null ? now - player.cardPromptStartedAt : null;
            if (elapsedMs === null && room.lastSnapshot) {
              const snap = room.lastSnapshot as unknown as {
                gameId: GameId;
                turnTotal?: number;
                turnTimeLeft?: number;
              };
              if (
                CARD_GAME_IDS.has(snap.gameId) &&
                typeof snap.turnTotal === 'number' &&
                snap.turnTotal > 0 &&
                typeof snap.turnTimeLeft === 'number'
              ) {
                elapsedMs = Math.max(120, Math.round((snap.turnTotal - snap.turnTimeLeft) * 1000));
              }
            }
            if (elapsedMs !== null) {
              recordCardPlayerResponse(player, elapsedMs);
            }
            player.cardPromptStartedAt = now;
          }
        }

        engine.handleCardAction(room.gameState, player.id, msg.action, this.toInputPlayers(room));
        room.lastSnapshot = engine.getSnapshot(room.gameState);
        room.lastActivityAt = now;
        this.pushCardStates(room, undefined, true);
        if (room.lastSnapshot) {
          this.broadcastTick(room, room.lastSnapshot, []);
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

      case 'host:ui-haptic': {
        const room = this.getPrivilegedRoom(ws);
        if (!room) return;
        const reason = (msg.event || 'host-alert').slice(0, 32);
        const label = msg.label ? msg.label.slice(0, 36) : undefined;
        const pattern: number | number[] =
          reason === 'turn-start'
            ? [26, 36, 46]
            : reason === 'action-required'
              ? [34, 28, 54]
              : reason === 'chaos-wheel'
                ? [24, 24, 42]
                : [24, 26, 36];
        if (msg.targetPlayerId) {
          this.dispatchHapticToPlayer(room, msg.targetPlayerId, {
            pattern,
            reason,
            event: reason,
            label,
            intensity: 'medium',
            minGapMs: 90,
          });
        } else {
          this.broadcastHapticToRoom(room, {
            pattern,
            reason,
            event: reason,
            label,
            intensity: 'light',
            minGapMs: 90,
          });
        }
        return;
      }
    }
  }

  private pushCardStates(
    room: RoomRecord,
    providedStates?: Record<string, CardPrivateState>,
    force = false
  ): void {
    const engine = SERVER_GAMES[room.selectedGameId];
    const states =
      providedStates ??
      (room.gameState ? engine.getPrivateStates?.(room.gameState, this.toInputPlayers(room)) : undefined);
    if (!states) return;

    for (const p of room.players.values()) {
      if (p.isBot || !p.connected || !p.ws) continue;
      const cs = states[p.id];
      if (!cs) continue;

      // Detect private card turn / action-required transitions and vibrate the player's phone
      const prevTurn = room.hapticTracker.lastCardTurnByPlayer.get(p.id) ?? false;
      const prevActionReq = room.hapticTracker.lastCardActionReqByPlayer.get(p.id) ?? false;
      room.hapticTracker.lastCardTurnByPlayer.set(p.id, cs.isMyTurn);
      room.hapticTracker.lastCardActionReqByPlayer.set(p.id, cs.isActionRequired);

      if (room.status === 'PLAYING') {
        if (!prevTurn && cs.isMyTurn) {
          this.dispatchHapticToPlayer(room, p.id, {
            pattern: [26, 36, 46],
            reason: 'turn-start',
            event: 'turn-start',
            label: 'YOUR TURN!',
            intensity: 'medium',
            minGapMs: 120,
          });
        } else if (!prevActionReq && cs.isActionRequired) {
          this.dispatchHapticToPlayer(room, p.id, {
            pattern: [34, 28, 54],
            reason: 'action-required',
            event: 'action-required',
            label: cs.awaitingColorPick ? 'PICK A COLOR!' : 'CHALLENGE OR TRUST!',
            intensity: 'medium',
            minGapMs: 120,
          });
        }
      }

      const hash = JSON.stringify({
        h: cs.hand.map((c) => `${c.id}:${c.playable ? 1 : 0}:${c.selected ? 1 : 0}`),
        c: cs.cursorIndex,
        m: cs.isMyTurn,
        r: cs.isActionRequired,
        t: Math.ceil(cs.turnTimeLeft),
        ac: cs.activeColor,
        aw: cs.awaitingColorPick,
        dp: cs.drawPenalty,
        ph: cs.phase,
        tr: cs.targetRank,
        cb: cs.canCallBluff,
        ct: cs.canTrust,
        bt: cs.badgeText,
        pb: cs.primaryBtn ? `${cs.primaryBtn.label}:${cs.primaryBtn.disabled ? 1 : 0}` : '',
        sb: cs.secondaryBtn ? `${cs.secondaryBtn.label}:${cs.secondaryBtn.disabled ? 1 : 0}` : '',
        ea: cs.extraActions ? cs.extraActions.map((e) => `${e.label}:${e.disabled ? 1 : 0}`).join('|') : '',
        sh: cs.statusHint,
      });
      if (force || room.lastCardStateHashes.get(p.id) !== hash) {
        room.lastCardStateHashes.set(p.id, hash);
        this.send(p.ws, { type: 'player:card-state', cardState: cs });
      }
    }
  }

  private clearCardStates(room: RoomRecord): void {
    room.lastCardStateHashes.clear();
    room.hapticTracker.lastCardTurnByPlayer.clear();
    room.hapticTracker.lastCardActionReqByPlayer.clear();
    for (const p of room.players.values()) {
      if (!p.isBot && p.connected && p.ws) {
        this.send(p.ws, { type: 'player:card-state', cardState: null });
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
      avatarId: this.pickAvatar(room, slotIndex),
      teamId: this.pickTeamForNewPlayer(room),
      ws: null,
      connected: true,
      ready: true,
      isBot: true,
      botDifficulty: difficulty,
      botMemory: createBotMemory(),
      score: 0,
      rawGameScore: 0,
      bonusScore: 0,
      alive: true,
      statText: 'Bot Ready',
      cooldownA: 0,
      cooldownB: 0,
      input: { dx: 0, dy: 0, a: false, b: false },
      prevA: false,
      prevB: false,
      disconnectedAt: null,
      matchStats: createDefaultMatchStats(),
      cardPromptStartedAt: null,
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
    const gate = this.computeRoomReadyGate(room);
    const hasBots = [...room.players.values()].some((p) => p.isBot);
    if (gate.connectedHumanCount === 0 && !hasBots) {
      this.send(senderWs, {
        type: 'error',
        message: 'Connect at least 1 player (or add a robot) before starting.',
      });
      return false;
    }

    // Strict Ready Gate (single source of truth): every connected human player MUST press Ready on their phone controller
    if (!gate.allHumansReady) {
      const names = gate.unreadyHumanNames.join(', ');
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

  private spinRoomMutator(room: RoomRecord): void {
    const pool = CHAOS_WHEEL_MUTATORS.filter((m) => m.id !== room.activeMutator);
    const list = pool.length > 0 ? pool : CHAOS_WHEEL_MUTATORS;
    const picked = list[Math.floor(Math.random() * list.length)];
    room.activeMutator = picked.id;
    room.mutatorSpinSeq += 1;
    room.lastActivityAt = Date.now();
    this.playHostSound(room, 'wheel');
    this.broadcastHapticToRoom(room, {
      pattern: [24, 24, 42],
      reason: 'chaos-wheel',
      event: 'chaos-wheel',
      label: `CHAOS: ${picked.name.toUpperCase()}`,
      intensity: 'medium',
      minGapMs: 80,
    });
    this.broadcastRoom(room);
  }

  private attemptStartTournament(room: RoomRecord, senderWs: WebSocket): boolean {
    const gate = this.computeRoomReadyGate(room);
    const hasBots = [...room.players.values()].some((p) => p.isBot);
    if (gate.connectedHumanCount === 0 && !hasBots) {
      this.send(senderWs, {
        type: 'error',
        message: 'Connect at least 1 player (or add a robot) before starting.',
      });
      return false;
    }

    if (!gate.allHumansReady) {
      const names = gate.unreadyHumanNames.join(', ');
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

    const standings: TournamentPlayerStanding[] = [...room.players.values()]
      .sort((a, b) => a.slotIndex - b.slotIndex)
      .map((p, idx) => ({
        playerId: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        color: p.color,
        avatarId: p.avatarId,
        teamId: p.teamId,
        isBot: p.isBot,
        totalMarks: 0,
        wins: 0,
        lastGameMarks: 0,
        rank: idx + 1,
      }));

    room.tournament = {
      active: true,
      totalGames: TOURNAMENT_TOTAL_GAMES,
      currentGameIndex: 0,
      gameQueue: [],
      standings,
      teamStandings:
        room.teamMode === 'ffa'
          ? undefined
          : computeTeamStandings(
              room.teamMode,
              standings.map((s) => ({
                id: s.playerId,
                teamId: s.teamId ?? null,
                score: 0,
              }))
            ),
      history: [],
      vote: null,
      completed: false,
    };

    this.playHostSound(room, 'confirm');
    this.startCupVoteRound(room, 0);
    return true;
  }

  private pickCupVoteCandidates(room: RoomRecord, count = 3): GameId[] {
    const playedSet = new Set<GameId>(room.tournament?.gameQueue ?? []);
    const playerCount = Math.max(1, room.players.size);

    const eligible = GAME_CATALOG.filter((g) => {
      if (playedSet.has(g.id)) return false;
      if (playerCount <= 1) return g.suitableFor.includes('solo');
      return true;
    });
    const basePool = eligible.length >= count ? eligible : GAME_CATALOG.filter((g) => !playedSet.has(g.id));
    const pool = basePool.length >= count ? basePool : [...GAME_CATALOG];

    // Prefer variety across Arcade, Board, and Card genres when possible
    const genres = ['arcade', 'board', 'card'] as const;
    const picked: GameId[] = [];
    const shuffleCopy = <T,>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const genreOrder = shuffleCopy([...genres]);
    for (const genre of genreOrder) {
      if (picked.length >= count) break;
      const inGenre = shuffleCopy(
        pool.filter((g) => (g.genre ?? 'arcade') === genre && !picked.includes(g.id))
      );
      if (inGenre.length > 0) {
        picked.push(inGenre[0].id);
      }
    }

    const remaining = shuffleCopy(pool.filter((g) => !picked.includes(g.id)));
    for (const g of remaining) {
      if (picked.length >= count) break;
      picked.push(g.id);
    }

    return picked;
  }

  private startCupVoteRound(room: RoomRecord, roundIndex: number): void {
    if (!room.tournament || !room.tournament.active) return;
    this.stopGameLoop(room);
    this.clearVoteTimers(room);
    this.clearCardStates(room);

    const candidates = this.pickCupVoteCandidates(room, 3);
    const vote: CupVoteState = {
      roundIndex,
      candidates,
      votes: {},
      secondsLeft: CUP_VOTE_SECONDS,
      totalSeconds: CUP_VOTE_SECONDS,
      phase: 'voting',
      winningGameId: null,
    };

    room.status = 'VOTING';
    room.tournament.currentGameIndex = roundIndex;
    room.tournament.vote = vote;
    room.remoteFocus.modalIndex = 0;
    room.gameState = null;
    room.lastSnapshot = null;
    room.rankings = [];
    room.lastActivityAt = Date.now();

    for (const p of room.players.values()) {
      p.statText = p.isBot ? 'Voting...' : 'Pick Next Game!';
      p.input = { dx: 0, dy: 0, a: false, b: false };
      p.prevA = false;
      p.prevB = false;
    }

    this.playHostSound(room, 'wheel');
    this.broadcastRoom(room);

    // Tick down every second; bots vote at elapsed = 2s
    let elapsed = 0;
    room.voteInterval = setInterval(() => {
      if (room.status !== 'VOTING' || !room.tournament?.vote) {
        this.clearVoteTimers(room);
        return;
      }
      const curVote = room.tournament.vote;
      if (curVote.phase !== 'voting') return;

      elapsed += 1;
      curVote.secondsLeft = Math.max(0, CUP_VOTE_SECONDS - elapsed);

      // Bots cast automatic votes after 2s so solo/bot parties feel lively
      if (elapsed === 2) {
        for (const p of room.players.values()) {
          if (p.isBot && !curVote.votes[p.id]) {
            curVote.votes[p.id] =
              curVote.candidates[Math.floor(Math.random() * curVote.candidates.length)];
          }
        }
      }

      if (curVote.secondsLeft <= 0) {
        this.lockCupVote(room);
      } else {
        this.broadcastRoom(room);
      }
    }, 1000);
  }

  private checkCupVoteEarlyLock(room: RoomRecord): boolean {
    if (room.status !== 'VOTING' || !room.tournament?.vote) return false;
    const vote = room.tournament.vote;
    if (vote.phase !== 'voting') return false;

    const connectedHumans = [...room.players.values()].filter((p) => !p.isBot && p.connected);
    if (connectedHumans.length === 0) return false;
    const allHumansVoted = connectedHumans.every((p) => Boolean(vote.votes[p.id]));
    if (!allHumansVoted) return false;

    // Ensure bots also cast their votes before locking
    for (const p of room.players.values()) {
      if (p.isBot && !vote.votes[p.id]) {
        vote.votes[p.id] = vote.candidates[Math.floor(Math.random() * vote.candidates.length)];
      }
    }

    if (room.voteInterval) {
      clearInterval(room.voteInterval);
      room.voteInterval = null;
    }
    if (!room.voteLockTimeout) {
      room.voteLockTimeout = setTimeout(() => {
        room.voteLockTimeout = null;
        this.lockCupVote(room);
      }, 650);
    }
    return true;
  }

  private lockCupVote(room: RoomRecord, forcedWinnerId?: GameId): void {
    if (room.status !== 'VOTING' || !room.tournament?.vote) return;
    const vote = room.tournament.vote;
    if (vote.phase === 'locked') return;

    this.clearVoteTimers(room);

    // Ensure bots cast votes if locking early
    for (const p of room.players.values()) {
      if (p.isBot && !vote.votes[p.id]) {
        vote.votes[p.id] = vote.candidates[Math.floor(Math.random() * vote.candidates.length)];
      }
    }

    const tally = new Map<GameId, number>(vote.candidates.map((id) => [id, 0]));
    for (const chosen of Object.values(vote.votes)) {
      if (tally.has(chosen)) {
        tally.set(chosen, (tally.get(chosen) ?? 0) + 1);
      }
    }

    let maxVotes = -1;
    let topGames: GameId[] = [];
    for (const [gId, count] of tally.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        topGames = [gId];
      } else if (count === maxVotes) {
        topGames.push(gId);
      }
    }
    const winnerId =
      forcedWinnerId && vote.candidates.includes(forcedWinnerId)
        ? forcedWinnerId
        : topGames.length > 0
        ? topGames[Math.floor(Math.random() * topGames.length)]
        : vote.candidates[0];

    vote.phase = 'locked';
    vote.winningGameId = winnerId;
    vote.secondsLeft = 0;

    // Record voted winner into the tournament gameQueue for this round
    room.tournament.gameQueue[vote.roundIndex] = winnerId;
    room.selectedGameId = winnerId;
    room.gameSettingValue = getGameMeta(winnerId).defaultSetting;
    room.lastActivityAt = Date.now();

    this.playHostSound(room, 'confirm');
    this.broadcastRoom(room);

    // Celebrate the winning pick briefly, then open Rules Briefing
    room.voteLockTimeout = setTimeout(() => {
      room.voteLockTimeout = null;
      if (room.status !== 'VOTING' || !room.tournament?.active) return;
      room.tournament.vote = null;
      this.startMatch(room, true);
    }, 1800);
  }

  private returnToLobby(room: RoomRecord): void {
    this.stopGameLoop(room);
    room.status = 'LOBBY';
    room.tournament = null;
    room.frenzy = {
      active: false,
      freezing: false,
      freezeRemaining: 0,
      freezeTotal: 3.0,
      triggerCount: 0,
    };
    room.gameState = null;
    room.lastSnapshot = null;
    this.clearCardStates(room);
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
      p.rawGameScore = 0;
      p.bonusScore = 0;
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
    room.tournament = null;
    room.frenzy = {
      active: false,
      freezing: false,
      freezeRemaining: 0,
      freezeTotal: 3.0,
      triggerCount: 0,
    };
    room.gameState = null;
    room.lastSnapshot = null;
    this.clearCardStates(room);
    room.rankings = [];
    for (const p of room.players.values()) {
      p.ready = p.isBot ? true : false;
      p.score = 0;
      p.rawGameScore = 0;
      p.bonusScore = 0;
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

    // --- CUP GROUP VOTING REMOTE ---
    if (room.status === 'VOTING' && room.tournament?.vote) {
      const vote = room.tournament.vote;
      if (vote.phase !== 'voting') return;
      const count = vote.candidates.length;
      if (action === 'left' || action === 'up') {
        room.remoteFocus.modalIndex = (room.remoteFocus.modalIndex - 1 + count) % count;
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
      } else if (action === 'right' || action === 'down') {
        room.remoteFocus.modalIndex = (room.remoteFocus.modalIndex + 1) % count;
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
      } else if (action === 'ok') {
        const chosen = vote.candidates[room.remoteFocus.modalIndex] ?? vote.candidates[0];
        if (room.hostPlayerId) {
          vote.votes[room.hostPlayerId] = chosen;
          this.playHostSound(room, 'confirm');
          this.broadcastRoom(room);
          this.checkCupVoteEarlyLock(room);
        } else {
          this.lockCupVote(room);
        }
      }
      return;
    }

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
        if (room.tournament?.active) {
          if (room.remoteFocus.modalIndex === 0) {
            if (!room.tournament.completed) {
              const nextIdx = room.tournament.currentGameIndex + 1;
              if (nextIdx < room.tournament.totalGames) {
                this.startCupVoteRound(room, nextIdx);
              }
            } else {
              this.attemptStartTournament(room, senderWs);
            }
          } else {
            this.returnToLobby(room);
          }
        } else if (room.remoteFocus.modalIndex === 0) {
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

    const COLS = Math.max(1, room.lobbyGameCols || 4);
    const ACTION_COLS = Math.max(1, room.lobbyActionCols || 7);
    const ACTION_COUNT = 7; // 0: Start Game, 1: 5-Game Tournament, 2: Chaos Wheel, 3: Match Setting, 4: Add Robot, 5: Bot Level, 6: Room Setup
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
      const totalFilters = PLAYER_FILTER_OPTIONS.length;
      const applyFilterAtIndex = (idx: number) => {
        const clampedIdx = ((idx % totalFilters) + totalFilters) % totalFilters;
        focus.index = clampedIdx;
        const chosenOpt = PLAYER_FILTER_OPTIONS[clampedIdx];
        if (chosenOpt) {
          room.lobbyFilter = chosenOpt.id;
          const nextGames = filterGamesByPlayerMode(room.lobbyFilter);
          if (nextGames.length > 0 && !nextGames.some((g) => g.id === room.selectedGameId)) {
            room.selectedGameId = nextGames[0].id;
            room.gameSettingValue = nextGames[0].defaultSetting;
          }
        }
      };

      if (action === 'left') {
        applyFilterAtIndex(focus.index - 1);
        this.playHostSound(room, 'nav');
      } else if (action === 'right') {
        applyFilterAtIndex(focus.index + 1);
        this.playHostSound(room, 'nav');
      } else if (action === 'down' || action === 'ok') {
        applyFilterAtIndex(focus.index);
        const nextGames = filterGamesByPlayerMode(room.lobbyFilter);
        if (nextGames.length > 0) {
          focus.zone = 'games';
          const selectedIdx = nextGames.findIndex((g) => g.id === room.selectedGameId);
          selectGameAt(selectedIdx >= 0 ? selectedIdx : 0);
        }
        this.playHostSound(room, action === 'ok' ? 'confirm' : 'nav');
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
      const curIdx = Math.max(0, Math.min(filteredGames.length - 1, focus.index));
      if (action === 'left') {
        const prevIdx = (curIdx - 1 + filteredGames.length) % filteredGames.length;
        selectGameAt(prevIdx);
        this.playHostSound(room, 'nav');
      } else if (action === 'right') {
        const nextIdx = (curIdx + 1) % filteredGames.length;
        selectGameAt(nextIdx);
        this.playHostSound(room, 'nav');
      } else if (action === 'up') {
        const activeFilterIdx = Math.max(
          0,
          PLAYER_FILTER_OPTIONS.findIndex((opt) => opt.id === room.lobbyFilter)
        );
        focus.zone = 'filter';
        focus.index = activeFilterIdx;
        this.playHostSound(room, 'nav');
      } else if (action === 'down') {
        focus.zone = 'actions';
        focus.index = 0;
        this.playHostSound(room, 'nav');
      } else if (action === 'ok') {
        // Ensure focused game is selected, then try to launch it (or move focus to Start bar with prompt)
        selectGameAt(curIdx);
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
      if (focus.index >= ACTION_COLS) {
        focus.index = focus.index - ACTION_COLS;
      } else {
        focus.zone = 'games';
        if (filteredGames.length > 0) {
          const lastRow = Math.floor((filteredGames.length - 1) / COLS);
          const targetCol = Math.min(COLS - 1, focus.index % ACTION_COLS);
          selectGameAt(Math.min(filteredGames.length - 1, lastRow * COLS + targetCol));
        } else {
          focus.zone = 'filter';
          focus.index = 0;
        }
      }
      this.playHostSound(room, 'nav');
      this.broadcastRoom(room);
      return;
    }
    if (action === 'down') {
      const curActionRow = Math.floor(focus.index / ACTION_COLS);
      const lastActionRow = Math.floor((ACTION_COUNT - 1) / ACTION_COLS);
      if (focus.index + ACTION_COLS < ACTION_COUNT) {
        focus.index = focus.index + ACTION_COLS;
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
      } else if (curActionRow < lastActionRow) {
        focus.index = ACTION_COUNT - 1;
        this.playHostSound(room, 'nav');
        this.broadcastRoom(room);
      }
      return;
    }
    if (action === 'ok') {
      if (focus.index === 0) {
        this.attemptStartMatch(room, senderWs);
      } else if (focus.index === 1) {
        this.attemptStartTournament(room, senderWs);
      } else if (focus.index === 2) {
        this.spinRoomMutator(room);
      } else if (focus.index === 3) {
        const meta = getGameMeta(room.selectedGameId);
        const opts = meta.settingOptions;
        const curIdx = opts.findIndex((o) => o.value === room.gameSettingValue);
        const nextOpt = opts[(curIdx + 1) % opts.length];
        if (nextOpt) {
          room.gameSettingValue = nextOpt.value;
          this.playHostSound(room, 'confirm');
          this.broadcastRoom(room);
        }
      } else if (focus.index === 4) {
        this.addBotToRoom(room, senderWs);
      } else if (focus.index === 5) {
        const order: BotDifficulty[] = ['chill', 'arcade', 'spicy'];
        const nextDiff = order[(order.indexOf(room.botDifficulty) + 1) % order.length];
        room.botDifficulty = nextDiff;
        for (const p of room.players.values()) {
          if (p.isBot) p.botDifficulty = nextDiff;
        }
        this.playHostSound(room, 'confirm');
        this.broadcastRoom(room);
      } else if (focus.index === 6) {
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

  private shouldTriggerFrenzy(
    snap: GameSnapshot,
    elapsedSec: number,
    earlyFrenzy: boolean
  ): boolean {
    if (elapsedSec < 5) return false;
    switch (snap.gameId) {
      case 'astro-blaster':
      case 'ricochet-tanks':
      case 'turbo-striker':
      case 'paint-rush':
      case 'laser-gauntlet':
      case 'vault-heist':
      case 'cannon-siege':
      case 'crown-heist':
      case 'freeze-tag':
      case 'ghost-hunt':
      case 'meteor-swarm':
      case 'hook-shot':
      case 'gravity-flip':
      case 'kitchen-rush':
      case 'treasure-dig':
      case 'fruit-drop': {
        const threshold = earlyFrenzy
          ? snap.totalTime * 0.52
          : Math.min(15.2, Math.max(10, snap.totalTime * 0.35));
        return snap.timeLeft <= threshold && snap.timeLeft > 2.2;
      }
      case 'bumper-brawl':
      case 'hex-drop':
      case 'grid-runners':
      case 'bomb-grid':
      case 'red-light-dash': {
        if (earlyFrenzy) {
          return (
            snap.round >= Math.max(1, Math.ceil(snap.totalRounds / 2)) ||
            snap.roundTimer <= 22
          );
        }
        return snap.totalRounds > 1 ? snap.round >= snap.totalRounds : snap.roundTimer <= 15.2;
      }
      case 'fuse-pass':
        return earlyFrenzy
          ? snap.round >= Math.max(1, Math.ceil(snap.totalRounds / 2))
          : snap.totalRounds > 1
          ? snap.round >= snap.totalRounds
          : snap.bombTimer <= 10;
      case 'color-match':
        return earlyFrenzy
          ? snap.wave >= Math.max(2, Math.ceil(snap.totalWaves * 0.5))
          : snap.wave >= Math.max(2, snap.totalWaves - 1);
      case 'lucky-auction':
        return earlyFrenzy
          ? snap.round >= Math.max(2, Math.ceil(snap.totalRounds * 0.5))
          : snap.round >= snap.totalRounds;
      case 'turbo-drift':
        return (
          snap.finishCountdown !== null ||
          snap.players.some((p) => p.lap >= snap.totalLaps) ||
          (earlyFrenzy && elapsedSec >= 18)
        );
      case 'hyper-pong':
        return (
          Math.max(snap.scoreLeft, snap.scoreRight) >= Math.max(1, snap.targetScore - 1) ||
          elapsedSec >= (earlyFrenzy ? 15 : 32)
        );
      case 'blade-duel':
        return (
          snap.players.some((p) => p.roundsWon >= Math.max(1, snap.targetWins - 1)) ||
          (earlyFrenzy && elapsedSec >= 16)
        );
      case 'pinball-clash':
        return (
          Math.max(snap.scoreLeft, snap.scoreRight) >= Math.max(1, snap.targetGoals - 1) ||
          elapsedSec >= (earlyFrenzy ? 15 : 32)
        );
      case 'rich-street':
        return earlyFrenzy
          ? snap.round >= Math.max(2, Math.ceil(snap.totalRounds * 0.5))
          : snap.round >= Math.max(2, snap.totalRounds - 1);
      case 'jungle-ladders':
        return snap.players.some(
          (p) => p.tile >= snap.targetTile * (earlyFrenzy ? 0.5 : 0.72)
        );
      case 'color-clash':
        return (
          snap.players.some((p) => p.cardCount <= 2) ||
          snap.turnCount >= (earlyFrenzy ? 7 : 14)
        );
      case 'liars-deck':
        return (
          snap.players.some((p) => p.cardCount <= 2) ||
          snap.round >= (earlyFrenzy ? 2 : 3)
        );
      case 'volley-smash':
        return (
          Math.max(snap.scoreRed, snap.scoreBlue) >=
          Math.max(2, snap.targetPoints - (earlyFrenzy ? 2 : 1))
        );
      case 'lava-hopper':
        return snap.timeLeft <= snap.totalTime * (earlyFrenzy ? 0.55 : 0.35);
      case 'ludo-royale':
      case 'star-party-board':
      case 'naval-salvo':
      case 'carrom-arena':
      case 'dungeon-crawl-board':
        return snap.round >= Math.max(2, Math.floor(snap.totalRounds * (earlyFrenzy ? 0.5 : 0.72)));
      case 'reversi-clash':
      case 'neon-checkers':
        return snap.turnCount >= Math.max(4, Math.floor(snap.maxTurns * (earlyFrenzy ? 0.5 : 0.7)));
      case 'four-in-a-row':
        return snap.players.some((p) => p.connects >= Math.max(1, snap.targetConnects - 1));
      case 'boom-kittens':
        return snap.deckCount <= (earlyFrenzy ? 22 : 14) || snap.round >= (earlyFrenzy ? 6 : 10);
      case 'property-deal':
        return (
          snap.players.some((p) => p.setsCompleted >= Math.max(1, snap.targetSets - 1)) ||
          snap.round >= (earlyFrenzy ? 4 : 7)
        );
      case 'flip-seven':
        return snap.round >= (earlyFrenzy ? 3 : 4) || snap.players.some((p) => p.totalScore >= snap.targetScore * 0.68);
      case 'royal-bluff':
        return snap.round >= (earlyFrenzy ? 5 : 8) || snap.players.filter((p) => p.alive).length <= 2;
      case 'dark-flip-clash':
        return snap.players.some((p) => p.cardCount <= 2) || snap.turnCount >= (earlyFrenzy ? 7 : 13);
      case 'sushi-draft':
        return snap.round >= Math.max(2, snap.totalRounds - (earlyFrenzy ? 1 : 0));
      default:
        return false;
    }
  }

  private applyTournamentMatchResult(room: RoomRecord): void {
    const t = room.tournament;
    if (!t || !t.active) return;

    const isFinale = t.currentGameIndex >= t.totalGames - 1;
    const marksMap = new Map<string, number>();
    const marksObj: Record<string, number> = {};

    for (const r of room.rankings) {
      const m = computeTournamentMarks(r.rank, isFinale);
      marksMap.set(r.playerId, m);
      marksObj[r.playerId] = m;
    }

    // Ensure every currently connected/known player has a standing entry
    const byId = new Map(t.standings.map((s) => [s.playerId, s]));
    for (const p of room.players.values()) {
      if (!byId.has(p.id)) {
        const entry: TournamentPlayerStanding = {
          playerId: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          color: p.color,
          avatarId: p.avatarId,
          teamId: p.teamId,
          isBot: p.isBot,
          totalMarks: 0,
          wins: 0,
          lastGameMarks: 0,
          rank: t.standings.length + 1,
        };
        t.standings.push(entry);
        byId.set(p.id, entry);
      }
    }

    for (const st of t.standings) {
      const gained = marksMap.get(st.playerId) ?? 0;
      const pObj = room.players.get(st.playerId);
      if (pObj) {
        st.name = pObj.name;
        st.color = pObj.color;
        st.avatarId = pObj.avatarId;
        st.teamId = pObj.teamId;
      }
      st.lastGameMarks = gained;
      st.totalMarks += gained;
      const rankEntry = room.rankings.find((r) => r.playerId === st.playerId);
      if (rankEntry?.rank === 1) {
        st.wins += 1;
      }
    }

    t.standings.sort((a, b) => {
      if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.slotIndex - b.slotIndex;
    });
    t.standings.forEach((st, idx) => {
      st.rank = idx + 1;
    });

    t.teamStandings =
      room.teamMode === 'ffa'
        ? undefined
        : computeTeamStandings(
            room.teamMode,
            t.standings.map((st) => ({
              id: st.playerId,
              teamId: st.teamId ?? null,
              score: st.totalMarks,
            }))
          );

    const winner = room.rankings[0] ?? null;
    const record: TournamentMatchRecord = {
      roundIndex: t.currentGameIndex,
      gameId: room.selectedGameId,
      winnerId: winner?.playerId ?? null,
      winnerName: winner?.name ?? null,
      winnerColorHex: winner?.color.hex ?? null,
      marksAwarded: marksObj,
    };
    t.history.push(record);
    if (isFinale) {
      t.completed = true;
    }
  }

  private startMatch(room: RoomRecord, showBriefing = true): void {
    this.stopGameLoop(room);
    const engine = SERVER_GAMES[room.selectedGameId];
    room.frenzy = {
      active: false,
      freezing: false,
      freezeRemaining: 0,
      freezeTotal: 3.0,
      triggerCount: 0,
    };
    room.matchElapsedSec = 0;

    for (const p of room.players.values()) {
      p.score = 0;
      p.rawGameScore = 0;
      p.bonusScore = 0;
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
    room.lastCardStateHashes.clear();
    room.hapticTracker = createHostHapticTracker();
    room.gameState = engine.createState(playerList, room.gameSettingValue);
    room.lastSnapshot = engine.getSnapshot(room.gameState);
    if (room.lastSnapshot) {
      this.seedHostHapticTracker(room, room.lastSnapshot);
    }
    room.rankings = [];
    room.lastActivityAt = Date.now();
    this.pushCardStates(room, undefined, true);

    if (showBriefing) {
      room.status = 'BRIEFING';
      room.remoteFocus.modalIndex = 0;
      room.countdownValue = 0;
      room.countdownTimer = 0;
      this.broadcastHapticToRoom(room, {
        pattern: [22, 28, 34],
        reason: 'briefing',
        event: 'phase-transition',
        label: 'RULES BRIEFING',
        intensity: 'light',
        minGapMs: 80,
      });
      this.broadcastRoom(room);
      if (room.lastSnapshot) {
        this.broadcastTick(room, room.lastSnapshot, []);
      }
    } else {
      this.beginCountdown(room);
    }

    let hudBroadcastCounter = 0;
    let freezeBroadcastCounter = 0;
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
              this.send(p.ws, {
                type: 'player:haptic',
                pattern: 35,
                reason: 'countdown',
                event: 'countdown',
                label: `READY ${nextVal}...`,
                intensity: 'light',
              });
            }
          }
        }
        if (room.countdownTimer <= 0) {
          room.status = 'PLAYING';
          room.countdownValue = 0;
          const startedAt = Date.now();
          for (const p of room.players.values()) {
            p.cardPromptStartedAt = null;
          }
          if (room.lastSnapshot && CARD_GAME_IDS.has(room.lastSnapshot.gameId)) {
            const activeId = (room.lastSnapshot as unknown as { activePlayerId?: string }).activePlayerId;
            if (activeId) {
              const activeP = room.players.get(activeId);
              if (activeP) {
                activeP.cardPromptStartedAt = startedAt;
              }
            } else {
              for (const p of room.players.values()) p.cardPromptStartedAt = startedAt;
            }
          }
          this.broadcastRoom(room);
          if (room.lastSnapshot) {
            this.broadcastTick(room, room.lastSnapshot, [{ type: 'go' }]);
          }
          for (const p of room.players.values()) {
            if (p.connected && !p.isBot && p.ws) {
              this.send(p.ws, {
                type: 'player:haptic',
                pattern: [55, 35, 95],
                reason: 'go',
                event: 'go',
                label: 'GO! GO! GO!',
                intensity: 'heavy',
              });
            }
          }
        }
        return;
      }

      if (room.status !== 'PLAYING' || !room.gameState) return;

      // --- 3.0-SECOND DRAMATIC FRENZY FREEZE TO DISPLAY SEQUENTIAL FIRE BANNERS ---
      if (room.frenzy.freezing) {
        room.frenzy.freezeRemaining = Math.max(0, room.frenzy.freezeRemaining - dt);
        freezeBroadcastCounter += 1;
        if (room.frenzy.freezeRemaining <= 0) {
          room.frenzy.freezing = false;
          freezeBroadcastCounter = 0;
          this.broadcastRoom(room);
          if (room.lastSnapshot) {
            this.broadcastTick(room, room.lastSnapshot, [{ type: 'go' }]);
          }
          for (const p of room.players.values()) {
            if (p.connected && !p.isBot && p.ws) {
              this.send(p.ws, {
                type: 'player:haptic',
                pattern: [45, 25, 85],
                reason: 'go',
                event: 'go',
                label: 'FRENZY GO!',
                intensity: 'heavy',
              });
            }
          }
        } else if (freezeBroadcastCounter >= 3) {
          freezeBroadcastCounter = 0;
          this.broadcastRoom(room);
        }
        return;
      }

      const mutator = getMutatorSpec(room.activeMutator);
      room.matchElapsedSec += dt;

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

      const currentInputs = this.toInputPlayers(room).map((ip) =>
        mutator.invertControls
          ? { ...ip, input: { ...ip.input, dx: -ip.input.dx, dy: -ip.input.dy } }
          : ip
      );

      const isTurnPacedGame =
        room.selectedGameId === 'rich-street' ||
        room.selectedGameId === 'jungle-ladders' ||
        room.selectedGameId === 'ludo-royale' ||
        room.selectedGameId === 'star-party-board' ||
        room.selectedGameId === 'reversi-clash' ||
        room.selectedGameId === 'four-in-a-row' ||
        room.selectedGameId === 'naval-salvo' ||
        room.selectedGameId === 'neon-checkers' ||
        room.selectedGameId === 'carrom-arena' ||
        room.selectedGameId === 'dungeon-crawl-board' ||
        room.selectedGameId === 'lucky-auction' ||
        CARD_GAME_IDS.has(room.selectedGameId);
      const speedScale = isTurnPacedGame ? 1.0 : mutator.speedScale * (room.frenzy.active ? 1.18 : 1.0);
      const simDt = Math.min(0.085, dt * speedScale);
      const scoreMult = mutator.scoreMult * (room.frenzy.active && !engine.handlesOwnFrenzyMultiplier ? 2 : 1);

      const prevSnapshot = room.lastSnapshot;
      const result = engine.step(room.gameState, currentInputs, simDt, room.frenzy.active);
      const isCardMatch = CARD_GAME_IDS.has(room.selectedGameId);

      // Persist edge-trigger states & live HUD telemetry (with Frenzy + Mutator score multiplier)
      let liveScoreOrAliveChanged = false;
      for (const p of room.players.values()) {
        const justA = p.input.a && !p.prevA;
        const justB = p.input.b && !p.prevB;
        if (!p.isBot && (justA || justB)) {
          const presses = (justA ? 1 : 0) + (justB ? 1 : 0);
          p.matchStats.totalActions += presses;
          if (isCardMatch) {
            p.matchStats.cardActions += 1;
            if (p.cardPromptStartedAt !== null) {
              recordCardPlayerResponse(p, now - p.cardPromptStartedAt);
              p.cardPromptStartedAt = now;
            }
          }
        }
        p.prevA = p.input.a;
        p.prevB = p.input.b;
        const hud = result.hudUpdates[p.id];
        if (hud) {
          const prevScore = p.score;
          const prevAlive = p.alive;
          const rawScore = hud.score;
          if (rawScore > p.rawGameScore && scoreMult > 1) {
            const gain = rawScore - p.rawGameScore;
            p.bonusScore += Math.round(gain * (scoreMult - 1));
          }
          p.rawGameScore = rawScore;
          p.score = rawScore + p.bonusScore;
          p.alive = hud.alive;
          p.statText =
            p.bonusScore > 0 && hud.statText.includes(`${rawScore}`)
              ? hud.statText.replace(`${rawScore}`, `${p.score}`)
              : hud.statText;
          p.cooldownA = hud.cooldownA;
          p.cooldownB = hud.cooldownB;
          if (p.score !== prevScore || p.alive !== prevAlive) {
            liveScoreOrAliveChanged = true;
          }
        }
      }

      if (isCardMatch && prevSnapshot) {
        this.trackCardSnapshotStats(room, prevSnapshot, result.snapshot, now);
      }

      room.lastSnapshot = result.snapshot;

      // Check whether Frenzy Mode should erupt right now!
      if (
        !result.finished &&
        room.frenzy.triggerCount === 0 &&
        this.shouldTriggerFrenzy(result.snapshot, room.matchElapsedSec, mutator.earlyFrenzy)
      ) {
        room.frenzy = {
          active: true,
          freezing: true,
          freezeRemaining: 3.0,
          freezeTotal: 3.0,
          triggerCount: 1,
        };
        freezeBroadcastCounter = 0;
        this.broadcastTick(room, result.snapshot, [...result.sounds, { type: 'frenzy' }]);
        for (const p of room.players.values()) {
          if (p.connected && !p.isBot && p.ws) {
            this.send(p.ws, {
              type: 'player:haptic',
              pattern: [60, 35, 95, 35, 120],
              reason: 'frenzy',
              event: 'frenzy-alert',
              label: '2X FRENZY MODE!',
              intensity: 'heavy',
            });
          }
        }
        this.broadcastRoom(room);
        return;
      }

      this.broadcastTick(room, result.snapshot, result.sounds);

      if (result.privateStates) {
        this.pushCardStates(room, result.privateStates);
      }

      // Coalesce & dispatch targeted phone haptics from game engine (human phones only)
      const playersWithEngineHaptic = new Set<string>();
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
            playersWithEngineHaptic.add(playerId);
            room.hapticTracker.lastSentAtByPlayer.set(playerId, Date.now());
            this.send(target.ws, {
              type: 'player:haptic',
              pattern: h.pattern,
              reason: h.reason,
            });
          }
        }
      }

      // Detect Host UI events (turn transitions, action prompts, round changes, game alerts)
      // and dispatch subtle smartphone vibrations to players who didn't already get an engine hit this tick
      this.detectHostSnapshotHaptics(room, result.snapshot, playersWithEngineHaptic);

      // Sync lightweight HUD updates (scores, cooldowns, alive state) at ~6Hz, or ~15Hz immediately when scores change
      hudBroadcastCounter += 1;
      if (hudBroadcastCounter >= 5 || (liveScoreOrAliveChanged && hudBroadcastCounter >= 2)) {
        hudBroadcastCounter = 0;
        this.broadcastRoom(room);
      }

      if (result.finished) {
        this.stopGameLoop(room);
        room.status = 'RESULTS';
        room.frenzy.freezing = false;
        room.remoteFocus.modalIndex = 0;
        this.clearCardStates(room);

        const baseRankings = result.rankings ?? engine.getRankings(room.gameState, currentInputs);
        const anyBonus = [...room.players.values()].some((p) => p.bonusScore > 0);
        const RANK_PRIORITY_GAMES = new Set<GameId>([
          'boom-kittens',
          'lava-hopper',
          'royal-bluff',
          'liars-deck',
          'color-clash',
          'property-deal',
          'dark-flip-clash',
          'ludo-royale',
          'jungle-ladders',
          'red-light-dash',
          'fuse-pass',
          'bomb-grid',
          'big-two-royale',
          'landlord-clash',
          'speed-mahjong',
          'liars-dice-tavern',
          'undercover-word',
          'midnight-werewolf',
          'idiom-chain',
          'goose-alert',
          'truth-bomb',
          'bomb-tag-arena',
          'musical-thrones',
          'laser-jump-rope',
          'paint-rush',
          'four-in-a-row',
        ]);
        const preserveOrder = RANK_PRIORITY_GAMES.has(room.selectedGameId);
        const enriched = baseRankings.map((r) => {
          const pObj = room.players.get(r.playerId);
          return {
            ...r,
            avatarId: pObj?.avatarId,
            teamId: pObj?.teamId ?? null,
            score: anyBonus ? r.score + (pObj?.bonusScore ?? 0) : r.score,
          };
        });
        if (anyBonus && !preserveOrder) {
          enriched.sort((a, b) => b.score - a.score);
          enriched.forEach((entry, idx) => {
            entry.rank = idx + 1;
          });
        }
        room.rankings = enriched;
        room.teamRankings =
          room.teamMode === 'ffa'
            ? []
            : computeTeamStandings(
                room.teamMode,
                enriched.map((r) => ({
                  id: r.playerId,
                  teamId: r.teamId ?? null,
                  score: r.score,
                }))
              );

        for (const p of room.players.values()) {
          p.matchStats.matchesPlayed += 1;
          p.cardPromptStartedAt = null;
        }
        for (const r of room.rankings) {
          if (r.rank === 1) {
            const winPlayer = room.players.get(r.playerId);
            if (winPlayer) {
              winPlayer.matchStats.wins += 1;
              if (CARD_GAME_IDS.has(room.selectedGameId)) {
                winPlayer.matchStats.cardWins += 1;
              }
            }
          }
        }

        if (room.tournament?.active) {
          this.applyTournamentMatchResult(room);
        }

        for (const p of room.players.values()) {
          if (p.connected && !p.isBot && p.ws) {
            this.send(p.ws, {
              type: 'player:haptic',
              pattern: [70, 40, 120],
              reason: 'win',
              event: 'podium-reveal',
              label: 'MATCH COMPLETE!',
              intensity: 'heavy',
            });
          }
        }
        this.broadcastRoom(room);
      }
    }, TICK_MS);
  }

  private trackCardSnapshotStats(
    room: RoomRecord,
    prevSnap: GameSnapshot,
    nextSnap: GameSnapshot,
    now: number
  ): void {
    if (prevSnap.gameId === 'color-clash' && nextSnap.gameId === 'color-clash') {
      const turnChanged = nextSnap.activePlayerId !== prevSnap.activePlayerId;
      const turnAdvanced = nextSnap.turnCount > prevSnap.turnCount;
      const enteredColorPick = !prevSnap.awaitingColorPick && nextSnap.awaitingColorPick;

      if (turnChanged || turnAdvanced || enteredColorPick) {
        const actor = room.players.get(prevSnap.activePlayerId);
        if (actor) {
          if (actor.isBot) {
            actor.matchStats.totalActions += 1;
            actor.matchStats.cardActions += 1;
          }
          if (actor.cardPromptStartedAt !== null && (actor.isBot || now - actor.cardPromptStartedAt > 65)) {
            recordCardPlayerResponse(actor, now - actor.cardPromptStartedAt);
          }
          actor.cardPromptStartedAt = enteredColorPick && !turnChanged ? now : null;
        }
      }

      if (turnChanged) {
        const nextActor = room.players.get(nextSnap.activePlayerId);
        if (nextActor) {
          nextActor.cardPromptStartedAt = now;
        }
      }
      return;
    }

    if (prevSnap.gameId === 'liars-deck' && nextSnap.gameId === 'liars-deck') {
      // Transition 1: Active player submitted face-down cards (selecting -> challenge)
      if (prevSnap.phase === 'selecting' && nextSnap.phase === 'challenge') {
        const actor = room.players.get(prevSnap.activePlayerId);
        if (actor) {
          if (actor.isBot) {
            actor.matchStats.totalActions += 1;
            actor.matchStats.cardActions += 1;
          }
          if (actor.cardPromptStartedAt !== null && (actor.isBot || now - actor.cardPromptStartedAt > 65)) {
            recordCardPlayerResponse(actor, now - actor.cardPromptStartedAt);
          }
          actor.cardPromptStartedAt = null;
        }
        // Start challenge decision clock for all other players
        for (const p of room.players.values()) {
          p.cardPromptStartedAt = p.id !== nextSnap.lastClaimPlayerId ? now : null;
        }
        return;
      }

      // Transition 2: Challenge phase resolved (challenge -> reveal or challenge -> selecting)
      if (prevSnap.phase === 'challenge' && nextSnap.phase !== 'challenge') {
        for (const pView of nextSnap.players) {
          const p = room.players.get(pView.id);
          if (!p || p.id === prevSnap.lastClaimPlayerId) continue;
          const prevView = prevSnap.players.find((pv) => pv.id === pView.id);
          const actedThisStep =
            pView.lastAction !== null && pView.lastAction !== (prevView?.lastAction ?? null);
          if (p.isBot && (actedThisStep || nextSnap.phase === 'selecting')) {
            p.matchStats.totalActions += 1;
            p.matchStats.cardActions += 1;
            if (p.cardPromptStartedAt !== null) {
              recordCardPlayerResponse(p, now - p.cardPromptStartedAt);
            }
          }
          p.cardPromptStartedAt = null;
        }
      }

      // Transition 3: Entering or advancing selecting phase
      if (
        nextSnap.phase === 'selecting' &&
        (prevSnap.phase !== 'selecting' || nextSnap.activePlayerId !== prevSnap.activePlayerId)
      ) {
        for (const p of room.players.values()) {
          p.cardPromptStartedAt = p.id === nextSnap.activePlayerId ? now : null;
        }
      }
      return;
    }

    // Generic turn-change response-time tracker for the 6 modular party card games
    if (CARD_GAME_IDS.has(nextSnap.gameId) && prevSnap.gameId === nextSnap.gameId) {
      const prevActive = (prevSnap as unknown as { activePlayerId?: string }).activePlayerId;
      const nextActive = (nextSnap as unknown as { activePlayerId?: string }).activePlayerId;
      if (prevActive && nextActive && prevActive !== nextActive) {
        const actor = room.players.get(prevActive);
        if (actor) {
          if (actor.isBot) {
            actor.matchStats.totalActions += 1;
            actor.matchStats.cardActions += 1;
          }
          if (actor.cardPromptStartedAt !== null && (actor.isBot || now - actor.cardPromptStartedAt > 65)) {
            recordCardPlayerResponse(actor, now - actor.cardPromptStartedAt);
          }
          actor.cardPromptStartedAt = null;
        }
        const nextActor = room.players.get(nextActive);
        if (nextActor) {
          nextActor.cardPromptStartedAt = now;
        }
      }
    }
  }

  private extractHostSnapshotMeta(snap: GameSnapshot): {
    activePlayerId: string | null;
    phase: string | null;
    roundOrWave: number | null;
    banner: string | null;
    lightState: string | null;
    holderId: string | null;
    feverActive: boolean;
    firesCount: number;
    highestBidderId: string | null;
  } {
    let activePlayerId: string | null = null;
    let phase: string | null = null;
    let roundOrWave: number | null = null;
    let banner: string | null = null;
    let lightState: string | null = null;
    let holderId: string | null = null;
    let feverActive = false;
    let firesCount = 0;
    let highestBidderId: string | null = null;

    if ('activePlayerId' in snap && typeof snap.activePlayerId === 'string') {
      activePlayerId = snap.activePlayerId;
    } else if ('turnIndex' in snap && typeof snap.turnIndex === 'number' && 'players' in snap) {
      activePlayerId = snap.players[snap.turnIndex]?.id ?? null;
    }

    if ('phase' in snap && typeof snap.phase === 'string') {
      phase = snap.phase;
    }

    if ('round' in snap && typeof snap.round === 'number') {
      roundOrWave = snap.round;
    } else if ('wave' in snap && typeof snap.wave === 'number') {
      roundOrWave = snap.wave;
    }

    if ('roundBanner' in snap && typeof snap.roundBanner === 'string' && snap.roundBanner) {
      banner = snap.roundBanner;
    } else if ('goalBanner' in snap && typeof snap.goalBanner === 'string' && snap.goalBanner) {
      banner = snap.goalBanner;
    } else if ('banner' in snap && typeof snap.banner === 'string' && snap.banner) {
      banner = snap.banner;
    } else if ('eventText' in snap && typeof snap.eventText === 'string' && snap.eventText) {
      banner = snap.eventText;
    }

    if (snap.gameId === 'red-light-dash') {
      lightState = snap.lightState;
    } else if (snap.gameId === 'fuse-pass') {
      holderId = snap.bombHolderId;
    } else if (snap.gameId === 'freeze-tag') {
      holderId = snap.players.find((p) => p.role === 'hunter')?.id ?? null;
    } else if (snap.gameId === 'fruit-drop') {
      feverActive = Boolean(snap.feverActive);
    } else if (snap.gameId === 'kitchen-rush') {
      firesCount = snap.stations.filter((st) => st.kind === 'grill' && st.onFire).length;
    } else if (snap.gameId === 'lucky-auction') {
      highestBidderId = snap.highestBidderId;
    }

    return {
      activePlayerId,
      phase,
      roundOrWave,
      banner,
      lightState,
      holderId,
      feverActive,
      firesCount,
      highestBidderId,
    };
  }

  private seedHostHapticTracker(room: RoomRecord, snap: GameSnapshot): void {
    const meta = this.extractHostSnapshotMeta(snap);
    room.hapticTracker.lastActivePlayerId = meta.activePlayerId;
    room.hapticTracker.lastPhase = meta.phase;
    room.hapticTracker.lastRoundOrWave = meta.roundOrWave;
    room.hapticTracker.lastBanner = meta.banner;
    room.hapticTracker.lastLightState = meta.lightState;
    room.hapticTracker.lastHolderId = meta.holderId;
    room.hapticTracker.lastFeverActive = meta.feverActive;
    room.hapticTracker.lastFiresCount = meta.firesCount;
    room.hapticTracker.lastHighestBidderId = meta.highestBidderId;
  }

  private detectHostSnapshotHaptics(
    room: RoomRecord,
    snap: GameSnapshot,
    skipPlayers: Set<string>
  ): void {
    const tracker = room.hapticTracker;
    const meta = this.extractHostSnapshotMeta(snap);

    // 1. Turn Transitions (Board & Card Games: Rich Street, Jungle Ladders, Color Clash, Liar's Deck)
    if (meta.activePlayerId && meta.activePlayerId !== tracker.lastActivePlayerId) {
      const nextTurnPlayerId = meta.activePlayerId;
      tracker.lastActivePlayerId = nextTurnPlayerId;
      if (!skipPlayers.has(nextTurnPlayerId)) {
        this.dispatchHapticToPlayer(room, nextTurnPlayerId, {
          pattern: [26, 36, 46],
          reason: 'turn-start',
          event: 'turn-start',
          label: 'YOUR TURN!',
          intensity: 'medium',
          minGapMs: 110,
        });
      }
      // Subtle table rhythm tick for other connected human players
      for (const p of room.players.values()) {
        if (p.id !== nextTurnPlayerId && !p.isBot && p.connected && !skipPlayers.has(p.id)) {
          this.dispatchHapticToPlayer(room, p.id, {
            pattern: 18,
            reason: 'turn-change',
            event: 'turn-change',
            label: 'TURN CHANGED',
            intensity: 'light',
            minGapMs: 220,
          });
        }
      }
    }

    // 2. Phase Transitions & Action Prompts (Rich Street Buy Prompt, Lucky Auction Reveal, Liar's Deck Challenge)
    if (meta.phase && meta.phase !== tracker.lastPhase) {
      tracker.lastPhase = meta.phase;
      if (snap.gameId === 'rich-street' && meta.phase === 'decision' && meta.activePlayerId) {
        if (!skipPlayers.has(meta.activePlayerId)) {
          this.dispatchHapticToPlayer(room, meta.activePlayerId, {
            pattern: [105, 40, 125, 40, 165],
            reason: 'buy-prompt',
            event: 'action-required',
            label: 'Buy or Pass!',
            intensity: 'heavy',
            minGapMs: 100,
          });
        }
      } else if (snap.gameId === 'lucky-auction' && meta.phase === 'reveal') {
        this.broadcastHapticToRoom(room, {
          pattern: [100, 45, 155],
          reason: 'round-transition',
          event: 'round-transition',
          label: 'CHEST REVEAL!',
          intensity: 'medium',
          minGapMs: 140,
        });
      }
    }

    // 3. Round / Wave Transitions on the Host Screen
    if (
      meta.roundOrWave !== null &&
      tracker.lastRoundOrWave !== null &&
      meta.roundOrWave > tracker.lastRoundOrWave
    ) {
      tracker.lastRoundOrWave = meta.roundOrWave;
      this.broadcastHapticToRoom(room, {
        pattern: [100, 45, 155],
        reason: 'round-transition',
        event: 'round-transition',
        label: `ROUND ${meta.roundOrWave}`,
        intensity: 'medium',
        minGapMs: 160,
      });
    } else if (meta.roundOrWave !== null && tracker.lastRoundOrWave === null) {
      tracker.lastRoundOrWave = meta.roundOrWave;
    }

    // 4. Host Announcement Banners (Goals, Round Winners, Board Events, Sudden Death)
    if (meta.banner && meta.banner !== tracker.lastBanner) {
      tracker.lastBanner = meta.banner;
      this.broadcastHapticToRoom(room, {
        pattern: [95, 40, 145],
        reason: 'host-alert',
        event: 'host-alert',
        label: meta.banner.slice(0, 32),
        intensity: 'medium',
        minGapMs: 180,
      });
    } else if (!meta.banner) {
      tracker.lastBanner = null;
    }

    // 5. Red Light Dash Traffic Light Warnings on Host
    if (snap.gameId === 'red-light-dash' && meta.lightState !== tracker.lastLightState) {
      tracker.lastLightState = meta.lightState;
      if (meta.lightState === 'yellow') {
        this.broadcastHapticToRoom(room, {
          pattern: [95, 35, 95, 35, 140],
          reason: 'yellow-light',
          event: 'timer-warning',
          label: 'YELLOW LIGHT — SLOW!',
          intensity: 'heavy',
          onlyAlive: true,
          minGapMs: 120,
        });
      } else if (meta.lightState === 'red') {
        this.broadcastHapticToRoom(room, {
          pattern: [110, 40, 160],
          reason: 'red-light',
          event: 'host-alert',
          label: 'RED LIGHT — FREEZE!',
          intensity: 'heavy',
          onlyAlive: true,
          minGapMs: 120,
        });
      }
    }

    // 6. Fuse Pass Bomb Holder & Freeze Tag "IT" Role Transfers
    if (
      (snap.gameId === 'fuse-pass' || snap.gameId === 'freeze-tag') &&
      meta.holderId &&
      meta.holderId !== tracker.lastHolderId
    ) {
      tracker.lastHolderId = meta.holderId;
      if (!skipPlayers.has(meta.holderId)) {
        this.dispatchHapticToPlayer(room, meta.holderId, {
          pattern: [40, 26, 58],
          reason: snap.gameId === 'fuse-pass' ? 'bomb-holder' : 'tagger',
          event: 'action-required',
          label: snap.gameId === 'fuse-pass' ? 'PASS THE BOMB!' : 'YOU ARE IT!',
          intensity: 'medium',
          minGapMs: 110,
        });
      }
    }

    // 7. Kitchen Rush Stove Fire Alert
    if (snap.gameId === 'kitchen-rush') {
      if (meta.firesCount > tracker.lastFiresCount) {
        this.broadcastHapticToRoom(room, {
          pattern: [30, 24, 46],
          reason: 'stove-fire',
          event: 'host-alert',
          label: '🔥 STOVE FIRE!',
          intensity: 'medium',
          minGapMs: 160,
        });
      }
      tracker.lastFiresCount = meta.firesCount;
    }

    // 8. Fruit Drop Fever Time Alert
    if (snap.gameId === 'fruit-drop') {
      if (meta.feverActive && !tracker.lastFeverActive) {
        this.broadcastHapticToRoom(room, {
          pattern: [30, 24, 46],
          reason: 'fever',
          event: 'host-alert',
          label: 'FEVER TIME!',
          intensity: 'medium',
          minGapMs: 160,
        });
      }
      tracker.lastFeverActive = meta.feverActive;
    }

    // 9. Lucky Auction Highest Bidder Change
    if (snap.gameId === 'lucky-auction' && meta.highestBidderId !== tracker.lastHighestBidderId) {
      tracker.lastHighestBidderId = meta.highestBidderId;
      if (meta.highestBidderId) {
        this.broadcastHapticToRoom(room, {
          pattern: 20,
          reason: 'high-bid',
          event: 'host-alert',
          label: `HIGH BID: $${snap.highestBid}`,
          intensity: 'light',
          excludePlayerId: meta.highestBidderId,
          minGapMs: 180,
        });
      }
    }
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
        botDifficulty: p.isBot ? (p.botDifficulty ?? room.botDifficulty) : undefined,
        input: p.input,
        prevA: p.prevA,
        prevB: p.prevB,
      }));
  }

  private clearVoteTimers(room: RoomRecord): void {
    if (room.voteInterval) {
      clearInterval(room.voteInterval);
      room.voteInterval = null;
    }
    if (room.voteLockTimeout) {
      clearTimeout(room.voteLockTimeout);
      room.voteLockTimeout = null;
    }
  }

  private stopGameLoop(room: RoomRecord): void {
    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }
    this.clearVoteTimers(room);
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
        if (this.checkCupVoteEarlyLock(room)) return;
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
    for (const [, room] of this.rooms.entries()) {
      let changed = false;

      // 1. Check 15-second host migration grace period for disconnected hostPlayerId
      if (room.hostPlayerId) {
        const curHost = room.players.get(room.hostPlayerId);
        if (
          curHost &&
          !curHost.isBot &&
          !curHost.connected &&
          curHost.disconnectedAt !== null &&
          now - curHost.disconnectedAt >= HOST_PLAYER_MIGRATION_GRACE_MS
        ) {
          const prevHostId = room.hostPlayerId;
          this.ensureHostPlayer(room, {
            forceMigrate: true,
            reason: 'disconnect-timeout',
            prevHostName: curHost.name,
          });
          if (room.hostPlayerId !== prevHostId) {
            changed = true;
          }
        }
      }

      // 2. Auto-prune disconnected human players after 45s in SETUP/LOBBY (keep 10m grace during active match phases)
      const isLobbyOrSetup = room.status === 'SETUP' || room.status === 'LOBBY';
      const disconnectGraceMs = isLobbyOrSetup
        ? LOBBY_DISCONNECT_GRACE_MS
        : PLAYER_RECONNECT_GRACE_MS;

      for (const [pid, p] of room.players.entries()) {
        if (!p.isBot && !p.connected && p.disconnectedAt && now - p.disconnectedAt > disconnectGraceMs) {
          const wasHost = room.hostPlayerId === pid;
          room.players.delete(pid);
          if (room.teamMode === 'one-vs-all' && p.teamId === 'boss') {
            this.assignBalancedTeams(room, false);
          }
          if (wasHost) {
            room.hostPlayerId = null;
            this.ensureHostPlayer(room, {
              forceMigrate: true,
              reason: 'disconnect-timeout',
              prevHostName: p.name,
            });
          }
          changed = true;
        }
      }

      if (changed) {
        this.ensureHostPlayer(room);
        if (!this.checkBriefingReadyAdvance(room)) {
          this.checkCupVoteEarlyLock(room);
          this.broadcastRoom(room);
        }
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
