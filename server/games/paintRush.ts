import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type PaintPlayerState,
  type PaintRushSnapshot,
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

interface InternalPaintPlayer extends PaintPlayerState {
  splashCd: number;
  slideCd: number;
}

interface PaintRushInternalState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  grid: number[];
  splashes: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  players: InternalPaintPlayer[];
  finished: boolean;
}

const GRID_COLS = 30;
const GRID_ROWS = 18;
const CELL_W = ARENA_WIDTH / GRID_COLS; // 40px
const CELL_H = ARENA_HEIGHT / GRID_ROWS; // 40px
const PLAYER_RADIUS = 22;
const SPLASH_COOLDOWN = 3.2;
const SPLASH_RADIUS_PX = 128;
const SLIDE_COOLDOWN = 1.9;
const SLIDE_DURATION = 0.34;

function paintCircle(
  grid: number[],
  cx: number,
  cy: number,
  radiusPx: number,
  slotIndex: number
): number {
  const minCol = Math.max(0, Math.floor((cx - radiusPx) / CELL_W));
  const maxCol = Math.min(GRID_COLS - 1, Math.floor((cx + radiusPx) / CELL_W));
  const minRow = Math.max(0, Math.floor((cy - radiusPx) / CELL_H));
  const maxRow = Math.min(GRID_ROWS - 1, Math.floor((cy + radiusPx) / CELL_H));

  let flipped = 0;
  for (let r = minRow; r <= maxRow; r++) {
    const cellCenterY = (r + 0.5) * CELL_H;
    for (let c = minCol; c <= maxCol; c++) {
      const cellCenterX = (c + 0.5) * CELL_W;
      if (Math.hypot(cellCenterX - cx, cellCenterY - cy) <= radiusPx) {
        const idx = r * GRID_COLS + c;
        if (grid[idx] !== slotIndex) {
          grid[idx] = slotIndex;
          flipped += 1;
        }
      }
    }
  }
  return flipped;
}

function recountTiles(state: PaintRushInternalState): void {
  const totalCells = state.cols * state.rows;
  const counts = new Array(8).fill(0);
  for (let i = 0; i < state.grid.length; i++) {
    const owner = state.grid[i];
    if (owner >= 0 && owner < 8) counts[owner] += 1;
  }
  for (const p of state.players) {
    p.tilesOwned = counts[p.slotIndex] ?? 0;
    p.percent = Math.round((p.tilesOwned / totalCells) * 1000) / 10;
    p.score = Math.round(p.percent * 10); // e.g., 34.5% -> 345 pts
  }
}

function spawnPaintPlayer(p: ServerPlayerInputState, idx: number, total: number): InternalPaintPlayer {
  const angle = (idx / Math.max(total, 1)) * Math.PI * 2;
  const x = total === 1 ? ARENA_WIDTH / 2 : ARENA_WIDTH / 2 + Math.cos(angle) * 340;
  const y = total === 1 ? ARENA_HEIGHT / 2 : ARENA_HEIGHT / 2 + Math.sin(angle) * 200;
  return {
    id: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    colorHex: p.color.hex,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: angle + Math.PI,
    slideTimer: 0,
    splashCd: 0,
    slideCd: 0,
    cooldownA: 0,
    cooldownB: 0,
    tilesOwned: 0,
    percent: 0,
    score: 0,
  };
}

function toSnapshot(state: PaintRushInternalState): PaintRushSnapshot {
  return {
    gameId: 'paint-rush',
    timeLeft: Math.max(0, state.timeLeft),
    totalTime: state.totalTime,
    cols: state.cols,
    rows: state.rows,
    grid: state.grid,
    splashes: state.splashes.map((s) => ({ ...s })),
    players: state.players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.colorHex,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      angle: p.angle,
      slideTimer: p.slideTimer,
      cooldownA: Math.min(1, Math.max(0, p.splashCd / SPLASH_COOLDOWN)),
      cooldownB: Math.min(1, Math.max(0, p.slideCd / SLIDE_COOLDOWN)),
      tilesOwned: p.tilesOwned,
      percent: p.percent,
      score: p.score,
    })),
  };
}

function buildRankings(
  state: PaintRushInternalState,
  inputPlayers: ServerPlayerInputState[]
): RankingEntry[] {
  const colorById = new Map(inputPlayers.map((p) => [p.id, p.color]));
  const sorted = [...state.players].sort((a, b) => b.tilesOwned - a.tilesOwned);
  return sorted.map((p, idx) => ({
    playerId: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    color: colorById.get(p.id) ?? {
      id: 'default',
      name: 'Player',
      hex: p.colorHex,
      dark: p.colorHex,
      textOnColor: '#FFFFFF',
    },
    rank: idx + 1,
    score: p.score,
    highlight: `${p.percent.toFixed(1)}% turf`,
  }));
}

export const paintRushModule: ServerGameModule<PaintRushInternalState> = {
  id: 'paint-rush',

  createState(players: ServerPlayerInputState[], settingValue: number): PaintRushInternalState {
    const totalTime = Math.max(20, Math.min(120, settingValue || 60));
    const grid = new Array<number>(GRID_COLS * GRID_ROWS).fill(-1);
    const list = players.map((p, idx) => spawnPaintPlayer(p, idx, players.length));
    for (const pl of list) {
      paintCircle(grid, pl.x, pl.y, 44, pl.slotIndex);
    }
    const state: PaintRushInternalState = {
      timeLeft: totalTime,
      totalTime,
      cols: GRID_COLS,
      rows: GRID_ROWS,
      grid,
      splashes: [],
      players: list,
      finished: false,
    };
    recountTiles(state);
    return state;
  },

  addPlayer(state: PaintRushInternalState, p: ServerPlayerInputState): void {
    if (state.players.some((x) => x.id === p.id)) return;
    const pl = spawnPaintPlayer(p, state.players.length, Math.max(2, state.players.length + 1));
    paintCircle(state.grid, pl.x, pl.y, 44, pl.slotIndex);
    state.players.push(pl);
    recountTiles(state);
  },

  step(state: PaintRushInternalState, inputPlayers: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(inputPlayers.map((p) => [p.id, p]));

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) {
      state.finished = true;
      sounds.push({ type: 'win' });
    }

    for (let i = state.splashes.length - 1; i >= 0; i--) {
      const s = state.splashes[i];
      s.radius += 420 * dt;
      s.alpha = Math.max(0, 1 - s.radius / s.maxRadius);
      if (s.radius >= s.maxRadius) state.splashes.splice(i, 1);
    }

    for (const p of state.players) {
      const src = inputMap.get(p.id);
      p.splashCd = Math.max(0, p.splashCd - dt);
      p.slideCd = Math.max(0, p.slideCd - dt);
      p.slideTimer = Math.max(0, p.slideTimer - dt);

      if (src) {
        const { dx, dy, a, b } = src.input;
        const mag = Math.hypot(dx, dy);
        if (mag > 0.08) {
          const nx = dx / Math.max(1, mag);
          const ny = dy / Math.max(1, mag);
          const accel = p.slideTimer > 0 ? 1550 : 1400;
          p.vx += nx * accel * dt;
          p.vy += ny * accel * dt;
          p.angle = Math.atan2(ny, nx);
        }

        // Action A: SPLASH Paint Bomb
        if (a && !src.prevA && p.splashCd <= 0) {
          p.splashCd = SPLASH_COOLDOWN;
          paintCircle(state.grid, p.x, p.y, SPLASH_RADIUS_PX, p.slotIndex);
          state.splashes.push({
            x: p.x,
            y: p.y,
            radius: 18,
            maxRadius: SPLASH_RADIUS_PX + 16,
            colorHex: p.colorHex,
            alpha: 1,
          });
          sounds.push({ type: 'pulse', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: [38, 25, 62], reason: 'splash' });

          // Push nearby rivals slightly away from splash
          for (const other of state.players) {
            if (other.id === p.id) continue;
            const ox = other.x - p.x;
            const oy = other.y - p.y;
            const dist = Math.hypot(ox, oy);
            if (dist > 0.01 && dist < SPLASH_RADIUS_PX + 20) {
              other.vx += (ox / dist) * 290;
              other.vy += (oy / dist) * 290;
              haptics.push({ playerId: other.id, pattern: 50, reason: 'knockback' });
            }
          }
        }

        // Action B: SLIDE Paint-Streak Dash
        if (b && !src.prevB && p.slideCd <= 0) {
          p.slideCd = SLIDE_COOLDOWN;
          p.slideTimer = SLIDE_DURATION;
          const dirX = mag > 0.12 ? dx / mag : Math.cos(p.angle);
          const dirY = mag > 0.12 ? dy / mag : Math.sin(p.angle);
          p.vx = dirX * 670;
          p.vy = dirY * 670;
          sounds.push({ type: 'boost', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 40, reason: 'slide' });
        }
      }

      const damping = p.slideTimer > 0 ? Math.pow(0.32, dt) : Math.pow(0.06, dt);
      p.vx *= damping;
      p.vy *= damping;

      const maxSpd = p.slideTimer > 0 ? 680 : 355;
      const spd = Math.hypot(p.vx, p.vy);
      if (spd > maxSpd) {
        p.vx = (p.vx / spd) * maxSpd;
        p.vy = (p.vy / spd) * maxSpd;
      }

      p.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_WIDTH - PLAYER_RADIUS, p.x + p.vx * dt));
      p.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, p.y + p.vy * dt));

      // Paint cells under roller brush
      const brushRadius = p.slideTimer > 0 ? 52 : 38;
      paintCircle(state.grid, p.x, p.y, brushRadius, p.slotIndex);
    }

    // Soft bumps between painters
    for (let i = 0; i < state.players.length; i++) {
      const a = state.players[i];
      for (let j = i + 1; j < state.players.length; j++) {
        const b = state.players[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minD = PLAYER_RADIUS * 2;
        if (dist > 0.01 && dist < minD) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minD - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          a.vx -= nx * 95;
          a.vy -= ny * 95;
          b.vx += nx * 95;
          b.vy += ny * 95;
          sounds.push({ type: 'bump', intensity: 0.4 });
          haptics.push({ playerId: a.id, pattern: 38, reason: 'bump' });
          haptics.push({ playerId: b.id, pattern: 38, reason: 'bump' });
        }
      }
    }

    recountTiles(state);

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: `${p.percent.toFixed(1)}% turf`,
        cooldownA: Math.min(1, Math.max(0, p.splashCd / SPLASH_COOLDOWN)),
        cooldownB: Math.min(1, Math.max(0, p.slideCd / SLIDE_COOLDOWN)),
      };
    }

    return {
      snapshot: toSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? buildRankings(state, inputPlayers) : undefined,
    };
  },

  getSnapshot(state: PaintRushInternalState): PaintRushSnapshot {
    return toSnapshot(state);
  },

  getRankings(state: PaintRushInternalState, players: ServerPlayerInputState[]): RankingEntry[] {
    return buildRankings(state, players);
  },
};
