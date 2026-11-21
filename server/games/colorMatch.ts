import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type ColorMatchPlayerState,
  type ColorMatchSnapshot,
  type ColorMatchTileState,
  type RankingEntry,
  type SoundEvent,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface InternalDancer extends ColorMatchPlayerState {
  vx: number;
  vy: number;
  hopCd: number;
  shoveCd: number;
}

interface ColorMatchState {
  wave: number;
  totalWaves: number;
  phase: 'preview' | 'scramble' | 'drop';
  phaseTimer: number;
  targetColorIndex: number;
  targetSymbol: 'star' | 'moon' | 'diamond' | 'bolt';
  banner: string | null;
  tiles: ColorMatchTileState[];
  shoveWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  players: InternalDancer[];
  finished: boolean;
}

const SYMBOLS: ('star' | 'moon' | 'diamond' | 'bolt')[] = ['star', 'moon', 'diamond', 'bolt'];
const COLS = 6;
const ROWS = 4;
const TILE_W = 148;
const TILE_H = 114;
const GAP = 10;
const BOARD_W = COLS * TILE_W + (COLS - 1) * GAP;
const BOARD_H = ROWS * TILE_H + (ROWS - 1) * GAP;
const BOARD_LEFT = Math.floor((ARENA_WIDTH - BOARD_W) / 2);
const BOARD_TOP = Math.floor((ARENA_HEIGHT - BOARD_H) / 2) + 34;

function buildBoard(): ColorMatchTileState[] {
  const tiles: ColorMatchTileState[] = [];
  // Ensure balanced distribution across all 4 color+symbol pairs (6 tiles each!)
  const bag: number[] = [];
  for (let i = 0; i < COLS * ROWS; i++) bag.push(i % 4);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }

  let id = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ci = bag[id];
      tiles.push({
        id: id++,
        col: c,
        row: r,
        x: BOARD_LEFT + c * (TILE_W + GAP),
        y: BOARD_TOP + r * (TILE_H + GAP),
        w: TILE_W,
        h: TILE_H,
        colorIndex: ci,
        symbol: SYMBOLS[ci],
        dropped: false,
        warning: false,
      });
    }
  }
  return tiles;
}

function startWave(state: ColorMatchState): void {
  state.tiles = buildBoard();
  state.targetColorIndex = Math.floor(Math.random() * 4);
  state.targetSymbol = SYMBOLS[state.targetColorIndex];
  state.phase = 'preview';
  state.phaseTimer = 1.05;
  state.banner = `WAVE ${state.wave}`;
  // Respawn fallen players cleanly onto the middle so everyone stays engaged for points!
  state.players.forEach((p, idx) => {
    if (!p.alive || p.falling) {
      const ang = (idx / Math.max(1, state.players.length)) * Math.PI * 2;
      p.x = ARENA_WIDTH / 2 + Math.cos(ang) * 110;
      p.y = BOARD_TOP + BOARD_H / 2 + Math.sin(ang) * 75;
      p.vx = 0;
      p.vy = 0;
      p.alive = true;
      p.falling = false;
      p.fallProgress = 0;
    }
  });
}

export const colorMatchModule: ServerGameModule<ColorMatchState> = {
  id: 'color-match',

  createState(players, settingValue) {
    const totalWaves = Math.max(5, Math.min(12, settingValue || 8));
    const list: InternalDancer[] = players.map((p, idx) => {
      const ang = (idx / Math.max(1, players.length)) * Math.PI * 2;
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        x: ARENA_WIDTH / 2 + Math.cos(ang) * 140,
        y: BOARD_TOP + BOARD_H / 2 + Math.sin(ang) * 90,
        vx: 0,
        vy: 0,
        angle: 0,
        alive: true,
        falling: false,
        fallProgress: 0,
        hopTimer: 0,
        hopDuration: 0.42,
        shoveTimer: 0,
        score: 0,
        survivedWaves: 0,
        cooldownA: 0,
        cooldownB: 0,
        hopCd: 0,
        shoveCd: 0,
      };
    });

    const state: ColorMatchState = {
      wave: 1,
      totalWaves,
      phase: 'preview',
      phaseTimer: 1.05,
      targetColorIndex: 0,
      targetSymbol: 'star',
      banner: 'WAVE 1',
      tiles: [],
      shoveWaves: [],
      players: list,
      finished: false,
    };
    startWave(state);
    return state;
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (let i = state.shoveWaves.length - 1; i >= 0; i--) {
      const w = state.shoveWaves[i];
      w.radius += 360 * dt;
      w.alpha -= dt * 2.6;
      if (w.alpha <= 0) state.shoveWaves.splice(i, 1);
    }

    if (!state.finished) {
      state.phaseTimer -= dt;

      if (state.phase === 'preview' && state.phaseTimer <= 0) {
        state.phase = 'scramble';
        // Gently speed up each wave from 3.4s down to 2.1s
        state.phaseTimer = Math.max(2.05, 3.55 - (state.wave - 1) * 0.17);
        state.banner = null;
        sounds.push({ type: 'go' });
      } else if (state.phase === 'scramble') {
        const warn = state.phaseTimer < 0.85;
        for (const t of state.tiles) {
          t.warning = warn && t.colorIndex !== state.targetColorIndex;
        }
        if (state.phaseTimer <= 0) {
          state.phase = 'drop';
          state.phaseTimer = 1.65;
          for (const t of state.tiles) {
            t.warning = false;
            if (t.colorIndex !== state.targetColorIndex) {
              t.dropped = true;
            }
          }
          sounds.push({ type: 'pulse', intensity: 0.9 });
        }
      } else if (state.phase === 'drop' && state.phaseTimer <= 0) {
        for (const p of state.players) {
          if (p.alive && !p.falling) {
            p.survivedWaves++;
            p.score += 100 + state.wave * 15;
            sounds.push({ type: 'pickup', playerId: p.id });
          }
        }
        if (state.wave >= state.totalWaves) {
          state.finished = true;
        } else {
          state.wave++;
          startWave(state);
        }
      }

      // Move dancers
      for (const p of state.players) {
        p.hopCd = Math.max(0, p.hopCd - dt);
        p.shoveCd = Math.max(0, p.shoveCd - dt);
        p.hopTimer = Math.max(0, p.hopTimer - dt);
        p.shoveTimer = Math.max(0, p.shoveTimer - dt);

        if (p.falling) {
          p.fallProgress = Math.min(1, p.fallProgress + dt * 2.2);
          if (p.fallProgress >= 1) p.alive = false;
          continue;
        }
        if (!p.alive) continue;

        const inp = players.find((x) => x.id === p.id);
        if (!inp) continue;
        const { dx, dy, a, b } = inp.input;
        const mag = Math.hypot(dx, dy);
        if (mag > 0.12) {
          p.angle = Math.atan2(dy, dx);
          const spd = p.hopTimer > 0 ? 375 : 295;
          p.vx += ((dx / Math.max(1, mag)) * spd - p.vx) * Math.min(1, dt * 11);
          p.vy += ((dy / Math.max(1, mag)) * spd - p.vy) * Math.min(1, dt * 11);
        } else {
          p.vx *= Math.pow(0.002, dt);
          p.vy *= Math.pow(0.002, dt);
        }

        if (a && !inp.prevA && p.hopCd <= 0) {
          p.hopTimer = p.hopDuration;
          p.hopCd = 1.3;
          p.vx += Math.cos(p.angle) * 140;
          p.vy += Math.sin(p.angle) * 140;
          sounds.push({ type: 'boost', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 16, reason: 'hop' });
        }

        if (b && !inp.prevB && p.shoveCd <= 0) {
          p.shoveTimer = 0.25;
          p.shoveCd = 1.9;
          state.shoveWaves.push({
            x: p.x,
            y: p.y,
            radius: 24,
            maxRadius: 115,
            colorHex: p.colorHex,
            alpha: 0.9,
          });
          sounds.push({ type: 'pulse', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 22, reason: 'shove' });

          for (const other of state.players) {
            if (other.id === p.id || !other.alive || other.falling || other.hopTimer > 0) continue;
            const d = Math.hypot(other.x - p.x, other.y - p.y);
            if (d < 115 && d > 1) {
              other.vx += ((other.x - p.x) / d) * 480;
              other.vy += ((other.y - p.y) / d) * 480;
              sounds.push({ type: 'bump', playerId: other.id });
              haptics.push({ playerId: other.id, pattern: 35, reason: 'shoved' });
            }
          }
        }

        p.x = Math.max(BOARD_LEFT - 18, Math.min(BOARD_LEFT + BOARD_W + 18, p.x + p.vx * dt));
        p.y = Math.max(BOARD_TOP - 18, Math.min(BOARD_TOP + BOARD_H + 18, p.y + p.vy * dt));

        // Check if standing over empty void during drop
        if (state.phase === 'drop' && p.hopTimer <= 0) {
          const onSolid = state.tiles.some(
            (t) => !t.dropped && p.x >= t.x - 10 && p.x <= t.x + t.w + 10 && p.y >= t.y - 10 && p.y <= t.y + t.h + 10
          );
          if (!onSolid) {
            p.falling = true;
            p.fallProgress = 0;
            sounds.push({ type: 'ko', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: [40, 30, 50], reason: 'fell' });
          }
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      p.cooldownA = Math.min(1, p.hopCd / 1.3);
      p.cooldownB = Math.min(1, p.shoveCd / 1.9);
      hudUpdates[p.id] = {
        score: p.score,
        alive: p.alive && !p.falling,
        statText: p.falling || !p.alive ? 'Fell — Next Wave!' : `${p.score} pts · ${p.survivedWaves} waves`,
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

  getSnapshot(state): ColorMatchSnapshot {
    return {
      gameId: 'color-match',
      wave: state.wave,
      totalWaves: state.totalWaves,
      phase: state.phase,
      phaseTimer: state.phaseTimer,
      targetColorIndex: state.targetColorIndex,
      targetSymbol: state.targetSymbol,
      banner: state.banner,
      tiles: state.tiles.map((t) => ({ ...t })),
      shoveWaves: state.shoveWaves.map((w) => ({ ...w })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        alive: p.alive,
        falling: p.falling,
        fallProgress: p.fallProgress,
        hopTimer: p.hopTimer,
        hopDuration: p.hopDuration,
        shoveTimer: p.shoveTimer,
        score: p.score,
        survivedWaves: p.survivedWaves,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.survivedWaves - a.survivedWaves);
    return sorted.map((dp, idx) => {
      const meta = players.find((p) => p.id === dp.id);
      return {
        playerId: dp.id,
        slotIndex: dp.slotIndex,
        name: dp.name,
        color: meta?.color ?? {
          id: 'magenta',
          name: 'Magenta',
          hex: dp.colorHex,
          dark: '#B31C67',
          textOnColor: '#FFFFFF',
        },
        rank: idx + 1,
        score: dp.score,
        highlight: `${dp.survivedWaves}/${state.totalWaves} waves safe`,
      };
    });
  },
};
