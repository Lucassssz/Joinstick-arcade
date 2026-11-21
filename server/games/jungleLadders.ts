import type {
  JungleLaddersPlayerState,
  JungleLaddersSnapshot,
  RankingEntry,
  SoundEvent,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface JungleLaddersState {
  targetTile: number;
  turnIndex: number;
  phase: 'wait-roll' | 'rolling' | 'moving' | 'sliding' | 'event';
  turnTimeLeft: number;
  phaseTimer: number;
  powerMeter: number;
  powerDir: number;
  diceValue: number;
  diceRolling: boolean;
  stepsRemaining: number;
  hopProgress: number;
  banner: string | null;
  eventText: string | null;
  ladders: { from: number; to: number }[];
  snakes: { from: number; to: number; colorHex: string }[];
  mysteryTiles: number[];
  goldenTiles: number[];
  bananas: number[];
  players: JungleLaddersPlayerState[];
  finished: boolean;
}

const LADDERS_100 = [
  { from: 4, to: 25 },
  { from: 13, to: 46 },
  { from: 33, to: 49 },
  { from: 42, to: 63 },
  { from: 50, to: 69 },
  { from: 62, to: 81 },
  { from: 74, to: 92 },
];

const SNAKES_100 = [
  { from: 27, to: 8, colorHex: '#FF4D2E' },
  { from: 40, to: 18, colorHex: '#FF3B9A' },
  { from: 54, to: 31, colorHex: '#FF7A1A' },
  { from: 66, to: 45, colorHex: '#FF4D2E' },
  { from: 76, to: 58, colorHex: '#FF3B9A' },
  { from: 89, to: 53, colorHex: '#FF7A1A' },
  { from: 97, to: 78, colorHex: '#FF4D2E' },
];

const MYSTERY_100 = [9, 22, 37, 56, 71, 85];

const LADDERS_50 = [
  { from: 4, to: 16 },
  { from: 11, to: 28 },
  { from: 20, to: 37 },
  { from: 32, to: 44 },
];

const SNAKES_50 = [
  { from: 19, to: 7, colorHex: '#FF4D2E' },
  { from: 34, to: 15, colorHex: '#FF3B9A' },
  { from: 43, to: 24, colorHex: '#FF7A1A' },
  { from: 48, to: 31, colorHex: '#FF4D2E' },
];

const MYSTERY_50 = [8, 17, 26, 39];
const GOLDEN_100 = [16, 35, 58, 79, 91];
const GOLDEN_50 = [12, 23, 35, 42];

const TURN_TIMEOUT = 10;

function rollFromPower(power: number): number {
  // Timing influence + playful randomness so higher meter nudges rolls higher
  const base = 1 + Math.floor(Math.random() * 6);
  if (power > 0.78 && Math.random() < 0.65) {
    return Math.min(6, Math.max(base, 4 + Math.floor(Math.random() * 3)));
  }
  if (power < 0.22 && Math.random() < 0.4) {
    return Math.max(1, Math.min(base, 3));
  }
  return base;
}

function nextTurn(state: JungleLaddersState): void {
  state.turnIndex = (state.turnIndex + 1) % state.players.length;
  state.phase = 'wait-roll';
  state.turnTimeLeft = TURN_TIMEOUT;
  state.diceRolling = false;
  state.banner = null;
  const active = state.players[state.turnIndex];
  state.eventText = active ? `${active.name}'s Turn — Press A to Roll!` : null;
}

function resolveTile(
  state: JungleLaddersState,
  active: JungleLaddersPlayerState,
  sounds: SoundEvent[],
  haptics: HapticTrigger[]
): void {
  if (active.tile >= state.targetTile) {
    active.tile = state.targetTile;
    active.visualTile = state.targetTile;
    state.finished = true;
    state.banner = `${active.name} REACHED #${state.targetTile}!`;
    state.eventText = `${active.name} wins Jungle Ladders!`;
    sounds.push({ type: 'win', playerId: active.id });
    haptics.push({ playerId: active.id, pattern: [40, 40, 70], reason: 'win' });
    return;
  }

  // Banana slip check
  const bananaIdx = state.bananas.indexOf(active.tile);
  if (bananaIdx !== -1) {
    state.bananas.splice(bananaIdx, 1);
    if (active.shielded) {
      active.shielded = false;
      state.banner = 'LEAF SHIELD SAVED!';
      state.eventText = `${active.name}'s Leaf Shield blocked a Banana slip!`;
      sounds.push({ type: 'confirm', playerId: active.id });
      state.phase = 'event';
      state.phaseTimer = 0.95;
      return;
    }
    const slipTo = Math.max(1, active.tile - 3);
    active.slideFrom = active.tile;
    active.slideTo = slipTo;
    active.slideProgress = 0;
    state.phase = 'sliding';
    state.eventText = `WHOA! ${active.name} slipped on a Banana to #${slipTo}!`;
    sounds.push({ type: 'hit', playerId: active.id });
    haptics.push({ playerId: active.id, pattern: 40, reason: 'banana' });
    return;
  }

  // Ladder check
  const ladder = state.ladders.find((l) => l.from === active.tile);
  if (ladder) {
    active.slideFrom = ladder.from;
    active.slideTo = ladder.to;
    active.slideProgress = 0;
    active.climbs++;
    state.phase = 'sliding';
    state.banner = `LADDER! #${ladder.from} → #${ladder.to}`;
    state.eventText = `${active.name} climbs a bamboo ladder to #${ladder.to}!`;
    sounds.push({ type: 'boost', playerId: active.id });
    haptics.push({ playerId: active.id, pattern: [20, 20, 45], reason: 'ladder' });
    return;
  }

  // Snake check
  const snake = state.snakes.find((s) => s.from === active.tile);
  if (snake) {
    if (active.shielded) {
      active.shielded = false;
      state.banner = 'LEAF SHIELD SAVED!';
      state.eventText = `${active.name}'s Leaf Shield chased away the Snake!`;
      sounds.push({ type: 'pulse', playerId: active.id });
      haptics.push({ playerId: active.id, pattern: 26, reason: 'shield-save' });
      state.phase = 'event';
      state.phaseTimer = 1.0;
      return;
    }
    active.slideFrom = snake.from;
    active.slideTo = snake.to;
    active.slideProgress = 0;
    active.slides++;
    state.phase = 'sliding';
    state.banner = `SNAKE! #${snake.from} → #${snake.to}`;
    state.eventText = `OH NO! ${active.name} slid down a snake to #${snake.to}!`;
    sounds.push({ type: 'ko', playerId: active.id });
    haptics.push({ playerId: active.id, pattern: [45, 35, 45], reason: 'snake' });
    return;
  }

  // Golden Vine tile check (Leaf Shield + +3 Tile Surge!)
  if (state.goldenTiles.includes(active.tile)) {
    active.shielded = true;
    const leapTo = Math.min(state.targetTile - 1, active.tile + 3);
    active.slideFrom = active.tile;
    active.slideTo = leapTo;
    active.slideProgress = 0;
    state.phase = 'sliding';
    state.banner = 'GOLDEN VINE + SHIELD!';
    state.eventText = `${active.name} got a Leaf Shield & swung to #${leapTo}!`;
    sounds.push({ type: 'boost', playerId: active.id });
    haptics.push({ playerId: active.id, pattern: [22, 20, 36], reason: 'golden-vine' });
    return;
  }

  // Mystery tile check
  if (state.mysteryTiles.includes(active.tile)) {
    if (active.trickReady) {
      active.shielded = true;
      state.eventText = `${active.name} found a Leaf Shield on Mystery Tile!`;
    } else {
      active.trickReady = true;
      state.eventText = `${active.name} found a Mystery Tile! TRICK (B) Ready!`;
    }
    sounds.push({ type: 'pickup', playerId: active.id });
    haptics.push({ playerId: active.id, pattern: 30, reason: 'mystery' });
    state.phase = 'event';
    state.phaseTimer = 1.2;
    return;
  }

  state.phase = 'event';
  state.phaseTimer = 0.65;
}

export const jungleLaddersModule: ServerGameModule<JungleLaddersState> = {
  id: 'jungle-ladders',

  createState(players, settingValue) {
    const targetTile = settingValue === 50 ? 50 : 100;
    const is50 = targetTile === 50;
    const boardPlayers: JungleLaddersPlayerState[] = players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      tile: 1,
      visualTile: 1,
      slideFrom: null,
      slideTo: null,
      slideProgress: 0,
      trickReady: false,
      boostQueued: false,
      shielded: false,
      climbs: 0,
      slides: 0,
      cooldownA: 0,
      cooldownB: 1,
    }));

    return {
      targetTile,
      turnIndex: 0,
      phase: 'wait-roll',
      turnTimeLeft: TURN_TIMEOUT,
      phaseTimer: 0,
      powerMeter: 0.5,
      powerDir: 1,
      diceValue: 6,
      diceRolling: false,
      stepsRemaining: 0,
      hopProgress: 0,
      banner: null,
      eventText: boardPlayers[0] ? `${boardPlayers[0].name}'s Turn — Press A to Roll!` : null,
      ladders: is50 ? LADDERS_50.map((l) => ({ ...l })) : LADDERS_100.map((l) => ({ ...l })),
      snakes: is50 ? SNAKES_50.map((s) => ({ ...s })) : SNAKES_100.map((s) => ({ ...s })),
      mysteryTiles: is50 ? [...MYSTERY_50] : [...MYSTERY_100],
      goldenTiles: is50 ? [...GOLDEN_50] : [...GOLDEN_100],
      bananas: [],
      players: boardPlayers,
      finished: false,
    };
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    if (state.players.length === 0) state.finished = true;

    if (!state.finished) {
      const active = state.players[state.turnIndex];
      const inputState = players.find((p) => p.id === active.id);
      const justA = Boolean(inputState && inputState.input.a && !inputState.prevA);
      const justB = Boolean(inputState && inputState.input.b && !inputState.prevB);

      if (state.phase === 'wait-roll') {
        state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
        state.powerMeter += state.powerDir * dt * 1.45;
        if (state.powerMeter >= 1) {
          state.powerMeter = 1;
          state.powerDir = -1;
        } else if (state.powerMeter <= 0) {
          state.powerMeter = 0;
          state.powerDir = 1;
        }

        if (justB && active.trickReady) {
          active.trickReady = false;
          active.boostQueued = true;
          if (active.tile > 3 && !state.bananas.includes(active.tile - 1)) {
            state.bananas.push(active.tile - 1);
            if (state.bananas.length > 4) state.bananas.shift();
          }
          state.eventText = `${active.name} activated TRICK! +2 Roll Boost & Banana Trap!`;
          sounds.push({ type: 'boost', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: 25, reason: 'trick' });
        }

        if (justA || state.turnTimeLeft <= 0) {
          state.phase = 'rolling';
          state.phaseTimer = 0.65;
          state.diceRolling = true;
          state.diceValue = rollFromPower(state.powerMeter);
          sounds.push({ type: 'confirm', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: 20, reason: 'roll' });
        }
      } else if (state.phase === 'rolling') {
        state.phaseTimer -= dt;
        if (Math.random() < 0.45) {
          state.diceValue = 1 + Math.floor(Math.random() * 6);
        }
        if (state.phaseTimer <= 0) {
          state.diceRolling = false;
          const finalRoll = rollFromPower(state.powerMeter);
          state.diceValue = finalRoll;
          const trickBonus = active.boostQueued ? 2 : 0;
          const perfectBonus = state.powerMeter >= 0.88 ? 2 : 0;
          active.boostQueued = false;
          const bonus = trickBonus + perfectBonus;
          const steps = finalRoll + bonus;
          state.stepsRemaining = Math.min(steps, state.targetTile - active.tile);
          state.hopProgress = 0;
          state.phase = 'moving';
          if (perfectBonus > 0) state.banner = 'PERFECT ROLL +2!';
          state.eventText =
            bonus > 0
              ? `${active.name} rolled ${finalRoll} + ${bonus} Bonus = ${steps}!`
              : `${active.name} rolled a ${finalRoll}!`;
          sounds.push({ type: 'bump', playerId: active.id });
          if (state.stepsRemaining <= 0) {
            resolveTile(state, active, sounds, haptics);
          }
        }
      } else if (state.phase === 'moving') {
        state.hopProgress += dt * 7.2;
        if (state.hopProgress >= 1) {
          state.hopProgress = 0;
          active.tile = Math.min(state.targetTile, active.tile + 1);
          active.visualTile = active.tile;
          state.stepsRemaining--;
          sounds.push({ type: 'nav', playerId: active.id });
          if (state.stepsRemaining <= 0) {
            resolveTile(state, active, sounds, haptics);
          }
        } else {
          active.visualTile = active.tile + state.hopProgress;
        }
      } else if (state.phase === 'sliding') {
        active.slideProgress = Math.min(1, active.slideProgress + dt * 1.45);
        if (active.slideProgress >= 1) {
          active.tile = active.slideTo ?? active.tile;
          active.visualTile = active.tile;
          active.slideFrom = null;
          active.slideTo = null;
          active.slideProgress = 0;
          state.phase = 'event';
          state.phaseTimer = 0.7;
        }
      } else if (state.phase === 'event') {
        state.phaseTimer -= dt;
        if (state.phaseTimer <= 0) {
          nextTurn(state);
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const activePlayer = state.players[state.turnIndex];
    for (const p of state.players) {
      const isTurn = activePlayer && p.id === activePlayer.id && !state.finished;
      p.cooldownA = isTurn && state.phase === 'wait-roll' ? 0 : 1;
      p.cooldownB = isTurn && state.phase === 'wait-roll' && p.trickReady ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.tile * 10,
        alive: true,
        statText: isTurn
          ? `YOUR TURN · #${p.tile}/${state.targetTile}`
          : `Tile #${p.tile}/${state.targetTile}`,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state): JungleLaddersSnapshot {
    return {
      gameId: 'jungle-ladders',
      targetTile: state.targetTile,
      activePlayerId: state.players[state.turnIndex]?.id ?? '',
      phase: state.phase,
      turnTimeLeft: state.turnTimeLeft,
      powerMeter: state.powerMeter,
      diceValue: state.diceValue,
      diceRolling: state.diceRolling,
      banner: state.banner,
      eventText: state.eventText,
      ladders: state.ladders,
      snakes: state.snakes,
      mysteryTiles: state.mysteryTiles,
      goldenTiles: state.goldenTiles,
      bananas: [...state.bananas],
      players: state.players.map((p) => ({ ...p })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => b.tile - a.tile || b.climbs - a.climbs);
    return sorted.map((jp, idx) => {
      const meta = players.find((p) => p.id === jp.id);
      return {
        playerId: jp.id,
        slotIndex: jp.slotIndex,
        name: jp.name,
        color: meta?.color ?? {
          id: 'mint',
          name: 'Mint',
          hex: jp.colorHex,
          dark: '#0A915D',
          textOnColor: '#0A1913',
        },
        rank: idx + 1,
        score: jp.tile * 10,
        highlight: `Tile #${jp.tile} · ${jp.climbs} climbs`,
      };
    });
  },
};
