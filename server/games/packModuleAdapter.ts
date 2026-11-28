import type {
  BotDifficulty,
  CardClientAction,
  CardPrivateState,
  GameId,
  GameSnapshot,
  RankingEntry,
  SoundEvent,
} from '../../src/shared/types.ts';
import type {
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

export type CompactSoundType = 'score' | 'hit' | 'dash' | 'win' | 'tick' | 'elim' | 'card' | SoundEvent['type'];

export interface CompactSoundEvent {
  type: CompactSoundType;
  playerId?: string;
  intensity?: number;
}

export interface CompactResultEntry {
  playerId: string;
  rank: number;
  score: number;
  statLabel: string;
}

export interface CompactPlayerInit {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
}

export interface CompactPlayerInput {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
  input: {
    moveX: number;
    moveY: number;
    actionA: boolean;
    actionB: boolean;
    targetX?: number;
    targetY?: number;
    aimAngle?: number;
    shootPower?: number;
    shootRelease?: number;
  };
}

export interface CompactGameInitContext {
  players: CompactPlayerInit[];
  settingValue: number;
}

export interface CompactGameModule<TState, TSnap extends GameSnapshot> {
  id: GameId;
  init(ctx: CompactGameInitContext): TState;
  step(
    state: TState,
    players: CompactPlayerInput[],
    dt: number,
    frenzyActive: boolean
  ): {
    finished: boolean;
    sounds: CompactSoundEvent[];
    privateStates?: Record<string, CardPrivateState>;
  };
  snapshot(state: TState): TSnap;
  buildResults(state: TState): CompactResultEntry[];
  getPrivateStates?(state: TState, players: CompactPlayerInput[]): Record<string, CardPrivateState>;
  handleCardAction?(
    state: TState,
    playerId: string,
    action: CardClientAction,
    players: CompactPlayerInput[]
  ): {
    sounds: CompactSoundEvent[];
    privateStates?: Record<string, CardPrivateState>;
  };
}

function mapSound(s: CompactSoundEvent): SoundEvent {
  const map: Record<string, SoundEvent['type']> = {
    score: 'pickup',
    dash: 'boost',
    tick: 'nav',
    elim: 'ko',
    hit: 'hit',
    win: 'win',
    card: 'card',
  };
  return {
    type: (map[s.type] ?? s.type) as SoundEvent['type'],
    playerId: s.playerId,
    intensity: s.intensity,
  };
}

function toCompactPlayers(players: ServerPlayerInputState[]): CompactPlayerInput[] {
  return players.map((p) => ({
    id: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    colorHex: p.color.hex,
    isBot: p.isBot,
    botDifficulty: p.botDifficulty,
    input: {
      moveX: p.input.dx,
      moveY: p.input.dy,
      actionA: p.input.a,
      actionB: p.input.b,
      targetX: p.input.targetX,
      targetY: p.input.targetY,
      aimAngle: p.input.aimAngle,
      shootPower: p.input.shootPower,
      shootRelease: p.input.shootRelease,
    },
  }));
}

function toRankings(
  entries: CompactResultEntry[],
  players: ServerPlayerInputState[]
): RankingEntry[] {
  const map = new Map(players.map((p) => [p.id, p]));
  return entries.map((e, i) => {
    const sp = map.get(e.playerId);
    return {
      playerId: e.playerId,
      slotIndex: sp?.slotIndex ?? i,
      name: sp?.name ?? `P${i + 1}`,
      color: sp?.color ?? {
        id: 'amber',
        name: 'Solar Gold',
        hex: '#F59E0B',
        dark: '#B45309',
        textOnColor: '#14120B',
      },
      rank: e.rank,
      score: Math.round(e.score),
      highlight: e.statLabel,
    };
  });
}

/**
 * Adapts a clean CompactGameModule (used by Expansion Packs 2–7) into
 * the core ServerGameModule contract with automatic HUD updates, sounds,
 * and Rankings formatting.
 */
export function isStateFrenzyActive(state: unknown): boolean {
  return Boolean((state as { __frenzyActive?: boolean } | null | undefined)?.__frenzyActive);
}

export function adaptPackModule<TState, TSnap extends GameSnapshot>(
  mod: CompactGameModule<TState, TSnap>
): ServerGameModule<TState> {
  return {
    id: mod.id,
    handlesOwnFrenzyMultiplier: true,
    createState(players, settingValue) {
      return mod.init({
        players: players.map((p) => ({
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.color.hex,
          isBot: p.isBot,
          botDifficulty: p.botDifficulty,
        })),
        settingValue,
      });
    },
    getPrivateStates: mod.getPrivateStates
      ? (state, players) => mod.getPrivateStates!(state, toCompactPlayers(players))
      : undefined,
    handleCardAction: mod.handleCardAction
      ? (state, playerId, action, players) => {
          mod.handleCardAction!(state, playerId, action, toCompactPlayers(players));
        }
      : undefined,
    step(state, players, dt, frenzyActive = false): StepOutput {
      if (state && typeof state === 'object') {
        (state as { __frenzyActive?: boolean }).__frenzyActive = Boolean(frenzyActive);
      }
      const compactPlayers = toCompactPlayers(players);
      const res = mod.step(state, compactPlayers, dt, Boolean(frenzyActive));
      const snapshot = mod.snapshot(state);

      const hudUpdates: Record<string, PlayerHudUpdate> = {};
      const snapPlayers = (snapshot as { players?: Array<Record<string, any>> }).players ?? [];
      for (const sp of snapPlayers) {
        if (!sp || typeof sp.id !== 'string') continue;
        hudUpdates[sp.id] = {
          score: typeof sp.score === 'number' ? Math.round(sp.score) : 0,
          alive: typeof sp.alive === 'boolean' ? sp.alive : true,
          statText:
            typeof sp.lastAction === 'string' && sp.lastAction
              ? sp.lastAction
              : `${typeof sp.score === 'number' ? Math.round(sp.score) : 0} PTS`,
          cooldownA: typeof sp.cooldownA === 'number' ? sp.cooldownA : 0,
          cooldownB: typeof sp.cooldownB === 'number' ? sp.cooldownB : 0,
        };
      }

      return {
        snapshot,
        sounds: res.sounds.map(mapSound),
        haptics: [],
        hudUpdates,
        privateStates: res.privateStates,
        finished: res.finished,
        rankings: res.finished ? toRankings(mod.buildResults(state), players) : undefined,
      };
    },
    getSnapshot(state) {
      return mod.snapshot(state);
    },
    getRankings(state, players) {
      return toRankings(mod.buildResults(state), players);
    },
  };
}
