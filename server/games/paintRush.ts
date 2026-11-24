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
  wideTimer: number;
  turboTimer: number;
  bonusPts: number;
  stealAccum: number;
}

interface PaintRushInternalState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  grid: number[];
  bonusCells: number[];
  pickups: { id: string; kind: 'wide' | 'bomb' | 'turbo'; x: number; y: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pickupTimer: number;
  bonusCellTimer: number;
  nextId: number;
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
): { flipped: number; stolen: number } {
  const minCol = Math.max(0, Math.floor((cx - radiusPx) / CELL_W));
  const maxCol = Math.min(GRID_COLS - 1, Math.floor((cx + radiusPx) / CELL_W));
  const minRow = Math.max(0, Math.floor((cy - radiusPx) / CELL_H));
  const maxRow = Math.min(GRID_ROWS - 1, Math.floor((cy + radiusPx) / CELL_H));

  let flipped = 0;
  let stolen = 0;
  for (let r = minRow; r <= maxRow; r++) {
    const cellCenterY = (r + 0.5) * CELL_H;
    for (let c = minCol; c <= maxCol; c++) {
      const cellCenterX = (c + 0.5) * CELL_W;
      if (Math.hypot(cellCenterX - cx, cellCenterY - cy) <= radiusPx) {
        const idx = r * GRID_COLS + c;
        const prevOwner = grid[idx];
        if (prevOwner !== slotIndex) {
          if (prevOwner >= 0) stolen += 1;
          grid[idx] = slotIndex;
          flipped += 1;
        }
      }
    }
  }
  return { flipped, stolen };
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
    p.score = Math.round(p.percent * 10) + p.bonusPts;
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
    wideTimer: 0,
    turboTimer: 0,
    bonusPts: 0,
    stealAccum: 0,
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
    bonusCells: state.bonusCells,
    pickups: state.pickups.map((pk) => ({ ...pk })),
    popups: state.popups.map((pp) => ({ ...pp })),
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
      wideTimer: p.wideTimer,
      turboTimer: p.turboTimer,
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
      bonusCells: [],
      pickups: [],
      popups: [],
      pickupTimer: 4,
      bonusCellTimer: 2.5,
      nextId: 1,
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

    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pp = state.popups[i];
      pp.y -= 32 * dt;
      pp.alpha -= 0.9 * dt;
      if (pp.alpha <= 0) state.popups.splice(i, 1);
    }

    state.pickupTimer -= dt;
    if (state.pickupTimer <= 0 && state.pickups.length < 3) {
      const kinds: ('wide' | 'bomb' | 'turbo')[] = ['wide', 'bomb', 'turbo'];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      state.pickups.push({
        id: `pk_${state.nextId++}`,
        kind,
        x: 110 + Math.random() * (ARENA_WIDTH - 220),
        y: 110 + Math.random() * (ARENA_HEIGHT - 220),
      });
      state.pickupTimer = 5.5;
    }

    state.bonusCellTimer -= dt;
    if (state.bonusCellTimer <= 0 && state.bonusCells.length < 6) {
      const c = 2 + Math.floor(Math.random() * (GRID_COLS - 4));
      const r = 2 + Math.floor(Math.random() * (GRID_ROWS - 4));
      const idx = r * GRID_COLS + c;
      if (!state.bonusCells.includes(idx)) state.bonusCells.push(idx);
      state.bonusCellTimer = 4;
    }

    for (const p of state.players) {
      const src = inputMap.get(p.id);
      p.splashCd = Math.max(0, p.splashCd - dt);
      p.slideCd = Math.max(0, p.slideCd - dt);
      p.slideTimer = Math.max(0, p.slideTimer - dt);
      p.wideTimer = Math.max(0, p.wideTimer - dt);
      p.turboTimer = Math.max(0, p.turboTimer - dt);

      if (src) {
        const { dx, dy, a, b } = src.input;
        const mag = Math.hypot(dx, dy);
        if (mag > 0.08) {
          const nx = dx / Math.max(1, mag);
          const ny = dy / Math.max(1, mag);
          const accel = (p.slideTimer > 0 ? 1550 : 1400) * (p.turboTimer > 0 ? 1.25 : 1);
          p.vx += nx * accel * dt;
          p.vy += ny * accel * dt;
          p.angle = Math.atan2(ny, nx);
        }

        // Action A: SPLASH Paint Bomb
        if (a && !src.prevA && p.splashCd <= 0) {
          p.splashCd = SPLASH_COOLDOWN;
          const splashRad = p.wideTimer > 0 ? SPLASH_RADIUS_PX * 1.25 : SPLASH_RADIUS_PX;
          const splashRes = paintCircle(state.grid, p.x, p.y, splashRad, p.slotIndex);
          p.stealAccum += splashRes.stolen;
          if (p.stealAccum >= 10) {
            const batches = Math.floor(p.stealAccum / 10);
            p.stealAccum %= 10;
            const pts = batches * 15;
            p.bonusPts += pts;
            state.popups.push({ x: p.x, y: p.y - 24, text: `STEAL +${pts}!`, colorHex: '#FF8A00', alpha: 1 });
          }
          state.splashes.push({
            x: p.x,
            y: p.y,
            radius: 18,
            maxRadius: splashRad + 16,
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
            if (dist > 0.01 && dist < splashRad + 20) {
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

      const baseSpd = p.turboTimer > 0 ? 485 : 355;
      const maxSpd = p.slideTimer > 0 ? 690 : baseSpd;
      const spd = Math.hypot(p.vx, p.vy);
      if (spd > maxSpd) {
        p.vx = (p.vx / spd) * maxSpd;
        p.vy = (p.vy / spd) * maxSpd;
      }

      p.x = Math.max(PLAYER_RADIUS, Math.min(ARENA_WIDTH - PLAYER_RADIUS, p.x + p.vx * dt));
      p.y = Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, p.y + p.vy * dt));

      // Paint cells under roller brush & reward turf steals from rivals
      const brushRadius = (p.slideTimer > 0 ? 52 : 38) * (p.wideTimer > 0 ? 1.65 : 1);
      const rollRes = paintCircle(state.grid, p.x, p.y, brushRadius, p.slotIndex);
      if (rollRes.stolen > 0) {
        p.stealAccum += rollRes.stolen;
        if (p.stealAccum >= 10) {
          const batches = Math.floor(p.stealAccum / 10);
          p.stealAccum %= 10;
          const pts = batches * 15;
          p.bonusPts += pts;
          state.popups.push({ x: p.x, y: p.y - 22, text: `STEAL +${pts}!`, colorHex: '#FF8A00', alpha: 1 });
        }
      }

      // Check Golden Bonus Cells
      for (let bi = state.bonusCells.length - 1; bi >= 0; bi--) {
        const idx = state.bonusCells[bi];
        if (state.grid[idx] === p.slotIndex) {
          const br = Math.floor(idx / GRID_COLS);
          const bc = idx % GRID_COLS;
          const bx = (bc + 0.5) * CELL_W;
          const by = (br + 0.5) * CELL_H;
          if (Math.hypot(p.x - bx, p.y - by) < brushRadius + 24) {
            p.bonusPts += 25;
            state.bonusCells.splice(bi, 1);
            state.popups.push({ x: bx, y: by - 12, text: '+25 GOLD!', colorHex: '#FFB800', alpha: 1 });
            sounds.push({ type: 'pickup', playerId: p.id });
          }
        }
      }

      // Collect paint bucket pickups
      for (let i = state.pickups.length - 1; i >= 0; i--) {
        const pk = state.pickups[i];
        if (Math.hypot(p.x - pk.x, p.y - pk.y) < PLAYER_RADIUS + 18) {
          if (pk.kind === 'wide') {
            p.wideTimer = 7.5;
            state.popups.push({ x: pk.x, y: pk.y - 12, text: 'MEGA ROLLER!', colorHex: '#00C2FF', alpha: 1 });
          } else if (pk.kind === 'turbo') {
            p.turboTimer = 7.5;
            state.popups.push({ x: pk.x, y: pk.y - 12, text: 'TURBO PAINT!', colorHex: '#10D98B', alpha: 1 });
          } else {
            paintCircle(state.grid, pk.x, pk.y, 190, p.slotIndex);
            state.splashes.push({
              x: pk.x,
              y: pk.y,
              radius: 24,
              maxRadius: 210,
              colorHex: p.colorHex,
              alpha: 1,
            });
            state.popups.push({ x: pk.x, y: pk.y - 12, text: 'MEGA SPLASH!', colorHex: '#FF3B9A', alpha: 1 });
          }
          p.bonusPts += 15;
          state.pickups.splice(i, 1);
          sounds.push({ type: 'pickup', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 26, reason: 'pickup' });
        }
      }
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
