import type {
  CardColor,
  CardPrivateHandItem,
  CardPrivateState,
} from '../../src/shared/types.ts';
import type {
  CamelStackDerbySnapshot,
  CornerPolyominoSnapshot,
  GemEngineGuildSnapshot,
  HexInsectChessSnapshot,
  HexIslandSettlersSnapshot,
  MazeWallDuelSnapshot,
  MosaicTileDraftSnapshot,
  PillarAscent3dSnapshot,
  RouteExpressSnapshot,
  SecretRankFlagsSnapshot,
} from '../../src/shared/packTabletopGemsTypes.ts';
import { isStateFrenzyActive } from './packModuleAdapter.ts';
import type {
  CompactGameModule,
  CompactResultEntry,
  CompactSoundEvent,
} from './packModuleAdapter.ts';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rankByScore<T extends { id: string; score: number }>(
  items: T[],
  labelFn: (item: T) => string
): CompactResultEntry[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  return sorted.map((it, i) => ({
    playerId: it.id,
    rank: i + 1,
    score: Math.round(it.score),
    statLabel: labelFn(it),
  }));
}

type TileColor = 'red' | 'blue' | 'gold' | 'green';
const TILE_COLORS: TileColor[] = ['red', 'blue', 'gold', 'green'];
const COLOR_HEX_MAP: Record<TileColor, string> = {
  red: '#FF4D2E',
  blue: '#00C2FF',
  gold: '#FFB800',
  green: '#10D98B',
};

// ============================================================================
// 1. MOSAIC TILE DRAFT (Azul Style — Pad 2 Board)
// ============================================================================
interface MosaicState {
  timeLeft: number;
  totalTime: number;
  round: number;
  factories: { id: number; tiles: TileColor[] }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    factoryIdx: number;
    colorIdx: number;
    wallMask: number;
    wallCount: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function buildMosaicFactories(frenzy: boolean): { id: number; tiles: TileColor[] }[] {
  return [0, 1, 2, 3].map((id) => ({
    id,
    tiles: Array.from({ length: frenzy ? 5 : 4 }, () => TILE_COLORS[Math.floor(Math.random() * 4)]),
  }));
}

export const mosaicTileDraftModule: CompactGameModule<MosaicState, MosaicTileDraftSnapshot> = {
  id: 'mosaic-tile-draft',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      round: 1,
      factories: buildMosaicFactories(false),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        factoryIdx: i % 4,
        colorIdx: i % 4,
        wallMask: 0,
        wallCount: 0,
        score: 0,
        stepCd: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'STEP TO A PLATE · PICK COLOR (B) · DRAFT TILES (A)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCd <= 0 && (Math.abs(mx) > 0.35 || Math.abs(my) > 0.35)) {
        if (Math.abs(mx) >= Math.abs(my)) {
          p.factoryIdx = (p.factoryIdx + (mx > 0 ? 1 : 3)) % 4;
        } else {
          p.colorIdx = (p.colorIdx + (my > 0 ? 1 : 3)) % 4;
        }
        p.stepCd = 0.16;
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.colorIdx = (p.colorIdx + 1) % 4;
        p.cdB = 0.15;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const fac = state.factories[p.factoryIdx];
        const targetColor = TILE_COLORS[p.colorIdx];
        const matching = fac.tiles.filter((t) => t === targetColor).length;
        if (matching > 0) {
          fac.tiles = fac.tiles.filter((t) => t !== targetColor);
          let placed = 0;
          let bonus = 0;
          for (let k = 0; k < matching; k++) {
            const colBase = p.colorIdx;
            let bit = -1;
            for (let r = 0; r < 5; r++) {
              const c = (colBase + r) % 5;
              const idx = r * 5 + c;
              if ((p.wallMask & (1 << idx)) === 0) {
                bit = idx;
                break;
              }
            }
            if (bit === -1) {
              for (let idx = 0; idx < 25; idx++) {
                if ((p.wallMask & (1 << idx)) === 0) {
                  bit = idx;
                  break;
                }
              }
            }
            if (bit >= 0) {
              const row = Math.floor(bit / 5);
              const col = bit % 5;
              p.wallMask |= 1 << bit;
              p.wallCount += 1;
              placed += 1;
              let rowFull = true;
              let colFull = true;
              for (let i = 0; i < 5; i++) {
                if ((p.wallMask & (1 << (row * 5 + i))) === 0) rowFull = false;
                if ((p.wallMask & (1 << (i * 5 + col))) === 0) colFull = false;
              }
              if (rowFull) bonus += 90;
              if (colFull) bonus += 110;
            } else {
              p.wallMask = 0;
              bonus += 150;
            }
          }
          const gained = (placed * 28 + bonus) * mult;
          p.score += gained;
          p.cdA = frenzy ? 0.25 : 0.42;
          if (bonus > 0) state.banner = `${p.name} COMPLETED MOSAIC LINE! +${gained}`;
          sounds.push({ type: bonus > 0 ? 'score' : 'pickup', playerId: p.id });
        } else {
          p.cdA = 0.2;
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    if (state.factories.every((f) => f.tiles.length === 0)) {
      state.round += 1;
      state.factories = buildMosaicFactories(frenzy);
      state.banner = `ROUND ${state.round} — FRESH CERAMIC TILES DEALT!`;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'mosaic-tile-draft',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      factories: state.factories,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        factoryIdx: p.factoryIdx,
        pickColor: TILE_COLORS[p.colorIdx],
        wallMask: p.wallMask,
        wallCount: p.wallCount,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.42, 0, 1),
        cooldownB: clamp(p.cdB / 0.15, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.wallCount} tiles · ${p.score} pts`);
  },
};

// ============================================================================
// 2. MAZE WALL DUEL (Quoridor Style — Pad 2 Board)
// ============================================================================
interface MazeWallState {
  timeLeft: number;
  totalTime: number;
  size: number;
  walls: { r: number; c: number; horizontal: boolean; ownerColor: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    targetR: number;
    wallMode: boolean;
    wallsLeft: number;
    crossings: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
    aimDirR: number;
    aimDirC: number;
  }[];
  banner: string | null;
}

function isBlockedByWall(
  walls: MazeWallState['walls'],
  r1: number,
  c1: number,
  r2: number,
  c2: number
): boolean {
  if (r2 === r1 + 1 && c2 === c1) {
    return walls.some((w) => w.horizontal && w.r === r1 && (w.c === c1 || w.c === c1 - 1));
  }
  if (r2 === r1 - 1 && c2 === c1) {
    return walls.some((w) => w.horizontal && w.r === r2 && (w.c === c1 || w.c === c1 - 1));
  }
  if (c2 === c1 + 1 && r2 === r1) {
    return walls.some((w) => !w.horizontal && w.c === c1 && (w.r === r1 || w.r === r1 - 1));
  }
  if (c2 === c1 - 1 && r2 === r1) {
    return walls.some((w) => !w.horizontal && w.c === c2 && (w.r === r1 || w.r === r1 - 1));
  }
  return false;
}

export const mazeWallDuelModule: CompactGameModule<MazeWallState, MazeWallDuelSnapshot> = {
  id: 'maze-wall-duel',
  init({ players, settingValue }) {
    const size = 7;
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      size,
      walls: [],
      players: players.map((p, i) => {
        const startTop = i % 2 === 0;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          r: startTop ? 0 : size - 1,
          c: clamp(1 + (i % 5), 0, size - 1),
          targetR: startTop ? size - 1 : 0,
          wallMode: false,
          wallsLeft: 4,
          crossings: 0,
          score: 0,
          stepCd: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
          aimDirR: startTop ? 1 : -1,
          aimDirC: 0,
        };
      }),
      banner: 'RACE TO THE OPPOSITE EDGE (+175) OR PLACE MAZE WALLS (B)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.wallMode = !p.wallMode;
        p.cdB = 0.2;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      const tryMove = (dr: number, dc: number) => {
        const nr = clamp(p.r + dr, 0, state.size - 1);
        const nc = clamp(p.c + dc, 0, state.size - 1);
        if (nr === p.r && nc === p.c) return;
        if (isBlockedByWall(state.walls, p.r, p.c, nr, nc)) {
          sounds.push({ type: 'hit', playerId: p.id });
          return;
        }
        p.r = nr;
        p.c = nc;
        p.score += 12 * mult;
        if (p.r === p.targetR) {
          p.crossings += 1;
          const bonus = 175 * mult;
          p.score += bonus;
          p.targetR = p.targetR === 0 ? state.size - 1 : 0;
          p.wallsLeft = Math.min(5, p.wallsLeft + (frenzy ? 3 : 2));
          if (state.walls.length > 10) state.walls.splice(0, 4);
          state.banner = `${p.name} CROSSED THE MAZE! +${bonus}`;
          sounds.push({ type: 'score', playerId: p.id });
        } else {
          sounds.push({ type: 'tick', playerId: p.id });
        }
      };

      if (p.stepCd <= 0 && (Math.abs(mx) > 0.38 || Math.abs(my) > 0.38)) {
        const dr = Math.abs(my) >= Math.abs(mx) ? Math.sign(my) : 0;
        const dc = Math.abs(mx) > Math.abs(my) ? Math.sign(mx) : 0;
        p.aimDirR = dr;
        p.aimDirC = dc;
        if (!p.wallMode) {
          tryMove(dr, dc);
        }
        p.stepCd = 0.19;
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        if (p.wallMode && (p.wallsLeft > 0 || frenzy)) {
          const horizontal = p.aimDirR !== 0 || p.aimDirC === 0;
          const wr = clamp(p.aimDirR < 0 ? p.r - 1 : p.r, 0, state.size - 2);
          const wc = clamp(p.aimDirC < 0 ? p.c - 1 : p.c, 0, state.size - 2);
          if (!state.walls.some((w) => w.r === wr && w.c === wc && w.horizontal === horizontal)) {
            state.walls.push({ r: wr, c: wc, horizontal, ownerColor: p.colorHex });
            if (state.walls.length > 14) state.walls.shift();
            if (!frenzy) p.wallsLeft = Math.max(0, p.wallsLeft - 1);
            p.score += 35 * mult;
            p.wallMode = false;
            p.cdA = 0.4;
            sounds.push({ type: 'bump', playerId: p.id });
          }
        } else {
          const dr = p.targetR > p.r ? 1 : -1;
          tryMove(dr, 0);
          p.cdA = 0.24;
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'maze-wall-duel',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      size: state.size,
      walls: state.walls,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: p.r,
        c: p.c,
        targetR: p.targetR,
        wallMode: p.wallMode,
        wallsLeft: p.wallsLeft,
        crossings: p.crossings,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.4, 0, 1),
        cooldownB: clamp(p.cdB / 0.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.crossings} runs · ${p.score} pts`);
  },
};

// ============================================================================
// 3. CORNER POLYOMINO (Blokus Style — Pad 2 Board)
// ============================================================================
const POLYOMINO_SHAPES: [number, number][][] = [
  [[0, 0], [0, 1], [1, 0]],
  [[0, 0], [0, 1], [0, 2], [1, 1]],
  [[0, 0], [1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [1, 1], [1, 2]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
];

export function getRotatedPolyomino(shapeIdx: number, rot: number): [number, number][] {
  const base = POLYOMINO_SHAPES[shapeIdx % POLYOMINO_SHAPES.length];
  return base.map(([r, c]) => {
    let nr = r;
    let nc = c;
    for (let k = 0; k < (rot % 4); k++) {
      const tr = nc;
      const tc = -nr;
      nr = tr;
      nc = tc;
    }
    return [nr, nc];
  });
}

interface CornerPolyState {
  timeLeft: number;
  totalTime: number;
  size: number;
  cells: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    shapeIdx: number;
    rot: number;
    tilesPlaced: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const cornerPolyominoModule: CompactGameModule<CornerPolyState, CornerPolyominoSnapshot> = {
  id: 'corner-polyomino',
  init({ players, settingValue }) {
    const size = 10;
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      size,
      cells: new Array(size * size).fill(-1),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: 2 + (i % 2) * 5,
        c: 2 + Math.floor(i / 2) * 2,
        shapeIdx: i % POLYOMINO_SHAPES.length,
        rot: 0,
        tilesPlaced: 0,
        score: 0,
        stepCd: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'STAMP POLYOMINOES & LINK DIAGONAL CORNERS FOR +55 SYNERGY!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCd <= 0 && (Math.abs(mx) > 0.35 || Math.abs(my) > 0.35)) {
        if (Math.abs(mx) >= Math.abs(my)) p.c = clamp(p.c + Math.sign(mx), 0, state.size - 1);
        else p.r = clamp(p.r + Math.sign(my), 0, state.size - 1);
        p.stepCd = 0.14;
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.rot = (p.rot + 1) % 4;
        if (p.rot === 0) p.shapeIdx = (p.shapeIdx + 1) % POLYOMINO_SHAPES.length;
        p.cdB = 0.18;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const offsets = getRotatedPolyomino(p.shapeIdx, p.rot);
        const coords = offsets.map(([dr, dc]) => [p.r + dr, p.c + dc] as [number, number]);
        const valid = coords.every(
          ([rr, cc]) => rr >= 0 && rr < state.size && cc >= 0 && cc < state.size && state.cells[rr * state.size + cc] === -1
        );
        if (valid) {
          let cornerTouch = false;
          for (const [rr, cc] of coords) {
            for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
              const nr = rr + dr;
              const nc = cc + dc;
              if (nr >= 0 && nr < state.size && nc >= 0 && nc < state.size && state.cells[nr * state.size + nc] === p.slotIndex) {
                cornerTouch = true;
              }
            }
          }
          for (const [rr, cc] of coords) {
            state.cells[rr * state.size + cc] = p.slotIndex;
          }
          p.tilesPlaced += coords.length;
          const pts = (coords.length * 25 + (cornerTouch ? 55 : 0)) * mult;
          p.score += pts;
          p.shapeIdx = (p.shapeIdx + 1) % POLYOMINO_SHAPES.length;
          p.cdA = frenzy ? 0.24 : 0.42;
          if (cornerTouch) state.banner = `${p.name} CORNER SYNERGY! +${pts}`;
          sounds.push({ type: cornerTouch ? 'score' : 'pickup', playerId: p.id });
        } else {
          p.cdA = 0.15;
          sounds.push({ type: 'hit', playerId: p.id });
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    const filled = state.cells.filter((c) => c !== -1).length;
    if (filled >= state.size * state.size - 10) {
      state.cells.fill(-1);
      state.banner = 'BOARD PACKED — FRESH 10×10 POLYOMINO ROUND!';
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'corner-polyomino',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      size: state.size,
      cells: state.cells,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: p.r,
        c: p.c,
        shapeIdx: p.shapeIdx,
        rot: p.rot,
        tilesPlaced: p.tilesPlaced,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.42, 0, 1),
        cooldownB: clamp(p.cdB / 0.18, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.tilesPlaced} tiles · ${p.score} pts`);
  },
};

// ============================================================================
// 4. 3D PILLAR ASCENT (Santorini Style — Pad 2 Board)
// ============================================================================
interface PillarAscentState {
  timeLeft: number;
  totalTime: number;
  size: number;
  heights: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    ascents: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
    lastDr: number;
    lastDc: number;
  }[];
  banner: string | null;
}

export const pillarAscent3dModule: CompactGameModule<PillarAscentState, PillarAscent3dSnapshot> = {
  id: 'pillar-ascent-3d',
  init({ players, settingValue }) {
    const size = 5;
    const totalTime = settingValue || 90;
    const heights = new Array(size * size).fill(0);
    heights[6] = 1;
    heights[12] = 2;
    heights[18] = 1;
    return {
      timeLeft: totalTime,
      totalTime,
      size,
      heights,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: (i * 2) % size,
        c: Math.floor(i / 2) * 2 % size,
        ascents: 0,
        score: 0,
        stepCd: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
        lastDr: 0,
        lastDc: 1,
      })),
      banner: 'BUILD MARBLE TOWERS (A) & CLIMB TO LEVEL 3 ROOFS (+180)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCd <= 0 && (Math.abs(mx) > 0.38 || Math.abs(my) > 0.38)) {
        const dr = Math.abs(my) >= Math.abs(mx) ? Math.sign(my) : 0;
        const dc = Math.abs(mx) > Math.abs(my) ? Math.sign(mx) : 0;
        p.lastDr = dr;
        p.lastDc = dc;
        const nr = clamp(p.r + dr, 0, state.size - 1);
        const nc = clamp(p.c + dc, 0, state.size - 1);
        const curH = state.heights[p.r * state.size + p.c];
        const nextH = state.heights[nr * state.size + nc];
        if (nextH < 4 && nextH <= curH + 1) {
          p.r = nr;
          p.c = nc;
          p.score += 10 * mult;
          if (nextH === 3) {
            p.ascents += 1;
            const bonus = 180 * mult;
            p.score += bonus;
            state.heights[nr * state.size + nc] = 0;
            state.banner = `${p.name} CONQUERED LEVEL 3 TEMPLE! +${bonus}`;
            sounds.push({ type: 'score', playerId: p.id });
          } else {
            sounds.push({ type: 'tick', playerId: p.id });
          }
        } else {
          sounds.push({ type: 'hit', playerId: p.id });
        }
        p.stepCd = 0.17;
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        let tr = clamp(p.r + p.lastDr, 0, state.size - 1);
        let tc = clamp(p.c + p.lastDc, 0, state.size - 1);
        if (tr === p.r && tc === p.c) tr = clamp(p.r + 1, 0, state.size - 1);
        const idx = tr * state.size + tc;
        if (state.heights[idx] < 3) {
          state.heights[idx] += 1;
          p.score += 28 * mult;
          p.cdA = frenzy ? 0.22 : 0.42;
          sounds.push({ type: 'pickup', playerId: p.id });
        } else {
          const selfIdx = p.r * state.size + p.c;
          if (state.heights[selfIdx] < 3) {
            state.heights[selfIdx] += 1;
            p.score += 28 * mult;
            p.cdA = frenzy ? 0.22 : 0.42;
            sounds.push({ type: 'pickup', playerId: p.id });
          }
        }
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        const tr = clamp(p.r + p.lastDr, 0, state.size - 1);
        const tc = clamp(p.c + p.lastDc, 0, state.size - 1);
        const idx = tr * state.size + tc;
        if (state.heights[idx] < 4) {
          state.heights[idx] = 4;
          p.score += 45 * mult;
          p.cdB = 1.6;
          sounds.push({ type: 'bump', playerId: p.id });
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    if (state.heights.filter((h) => h === 4).length >= 10) {
      state.heights.fill(0);
      state.banner = 'ISLAND DOMES RESET — NEW TEMPLE RACE!';
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'pillar-ascent-3d',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      size: state.size,
      heights: state.heights,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: p.r,
        c: p.c,
        ascents: p.ascents,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.42, 0, 1),
        cooldownB: clamp(p.cdB / 1.6, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.ascents} crowns · ${p.score} pts`);
  },
};

// ============================================================================
// 5. CAMEL STACK DERBY (Camel Up Style — Pad 4 Card)
// ============================================================================
const CAMEL_SPECS = [
  { id: 'red', name: 'Ruby Camel', colorHex: '#FF4D2E' },
  { id: 'blue', name: 'Cyan Camel', colorHex: '#00C2FF' },
  { id: 'gold', name: 'Amber Camel', colorHex: '#FFB800' },
  { id: 'green', name: 'Mint Camel', colorHex: '#10D98B' },
  { id: 'purple', name: 'Violet Camel', colorHex: '#A855F7' },
];

interface CamelStackState {
  timeLeft: number;
  totalTime: number;
  leg: number;
  trackLen: number;
  autoRollTimer: number;
  rolledThisLeg: string[];
  camels: { id: string; name: string; colorHex: string; space: number; stackOrder: number }[];
  lastRollText: string | null;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    actionCd: number;
    betColor: string | null;
    coins: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function getLeadingCamelId(camels: CamelStackState['camels']): string {
  const sorted = [...camels].sort((a, b) => (b.space !== a.space ? b.space - a.space : b.stackOrder - a.stackOrder));
  return sorted[0]?.id ?? 'gold';
}

function advanceCamel(
  state: CamelStackState,
  camelId: string,
  steps: number,
  mult: number,
  sounds: CompactSoundEvent[]
) {
  const mover = state.camels.find((c) => c.id === camelId);
  if (!mover) return;
  const oldSpace = mover.space;
  const oldStack = mover.stackOrder;
  const riders = state.camels.filter((c) => c.space === oldSpace && c.stackOrder >= oldStack).sort((a, b) => a.stackOrder - b.stackOrder);
  const newSpace = Math.min(state.trackLen - 1, oldSpace + steps);
  const topExisting = state.camels.filter((c) => c.space === newSpace).reduce((m, c) => Math.max(m, c.stackOrder), -1);
  riders.forEach((c, idx) => {
    c.space = newSpace;
    c.stackOrder = topExisting + 1 + idx;
  });
  state.lastRollText = `${mover.name.split(' ')[0].toUpperCase()} +${steps}`;

  if (state.rolledThisLeg.length >= 4 || newSpace >= state.trackLen - 1) {
    const leaderId = getLeadingCamelId(state.camels);
    const leaderName = state.camels.find((c) => c.id === leaderId)?.name ?? 'Camel';
    for (const p of state.players) {
      if (p.betColor === leaderId) {
        const pay = 150 * mult;
        p.coins += pay;
        p.score += pay;
        p.lastAction = 'WON BET!';
      } else if (p.betColor) {
        p.coins += 20;
        p.score += 20;
        p.lastAction = '2ND TRY';
      }
      p.betColor = null;
    }
    state.leg += 1;
    state.rolledThisLeg = [];
    if (newSpace >= state.trackLen - 1) {
      state.camels.forEach((c, idx) => {
        c.space = idx % 2;
        c.stackOrder = idx;
      });
    }
    state.banner = `LEG ${state.leg - 1} PAYOUT — ${leaderName.toUpperCase()} LED THE STACK!`;
    sounds.push({ type: 'score' });
  }
}

export const camelStackDerbyModule: CompactGameModule<CamelStackState, CamelStackDerbySnapshot> = {
  id: 'camel-stack-derby',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      leg: 1,
      trackLen: 14,
      autoRollTimer: 3.2,
      rolledThisLeg: [],
      camels: CAMEL_SPECS.map((c, i) => ({ ...c, space: 1, stackOrder: i })),
      lastRollText: 'RACE READY!',
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.4 + Math.random() * 1.6,
        actionCd: 0,
        betColor: null,
        coins: 50,
        score: 0,
        lastAction: 'BETTING',
      })),
      banner: 'PICK YOUR WINNING CAMEL TICKET & ROLL THE PYRAMID DIE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.autoRollTimer -= dt;
    if (state.autoRollTimer <= 0) {
      state.autoRollTimer = frenzy ? 2.2 : 3.2;
      const unrolled = state.camels.filter((c) => !state.rolledThisLeg.includes(c.id));
      const pool = unrolled.length > 0 ? unrolled : state.camels;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      state.rolledThisLeg.push(pick.id);
      advanceCamel(state, pick.id, 1 + Math.floor(Math.random() * 3), mult, sounds);
    }

    for (const p of state.players) {
      p.actionCd = Math.max(0, p.actionCd - dt);
      if (!p.isBot) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        p.botTimer = 1.8 + Math.random() * 1.6;
        if (!p.betColor) {
          const leader = getLeadingCamelId(state.camels);
          p.betColor = Math.random() < 0.72 ? leader : CAMEL_SPECS[Math.floor(Math.random() * CAMEL_SPECS.length)].id;
          p.lastAction = `BET ${p.betColor.toUpperCase()}`;
        } else {
          const unrolled = state.camels.filter((c) => !state.rolledThisLeg.includes(c.id));
          const pool = unrolled.length > 0 ? unrolled : state.camels;
          const pick = pool[Math.floor(Math.random() * pool.length)];
          state.rolledThisLeg.push(pick.id);
          p.coins += 20 * mult;
          p.score += 20 * mult;
          p.lastAction = 'ROLLED DIE';
          advanceCamel(state, pick.id, 1 + Math.floor(Math.random() * 3), mult, sounds);
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = state.camels.map((c) => ({
        id: `camel_${c.id}`,
        kind: 'party',
        title: c.name.split(' ')[0].toUpperCase(),
        subtitle: `Space ${c.space + 1} · Stack #${c.stackOrder + 1}`,
        badge: p.betColor === c.id ? 'BACKED' : 'BET',
        accentHex: c.colorHex,
        playable: true,
        selected: p.betColor === c.id,
      }));
      out[p.id] = {
        gameId: 'camel-stack-derby',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: true,
        isActionRequired: !p.betColor,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        badgeText: p.betColor ? `BET: ${p.betColor.toUpperCase()}` : 'PICK A CAMEL',
        badgeColorHex: CAMEL_SPECS.find((c) => c.id === p.betColor)?.colorHex ?? '#FFB800',
        secondaryBtn: {
          label: 'ROLL PYRAMID',
          labelZh: '掷金字塔骰',
          action: { type: 'draw-or-pass' },
          colorHex: '#10D98B',
          textColor: '#0A1913',
        },
        statusHint: 'Tap a Camel card to bet on the Leg Leader, or tap ROLL PYRAMID (+25)!',
        statusHintZh: '点选看好的骆驼下注，或点击「掷金字塔骰」赚 +25 推高赔率！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.actionCd > 0) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    p.actionCd = 0.45;
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId?.startsWith('camel_')) {
      p.betColor = action.cardId.slice(6);
      p.lastAction = `BET ${p.betColor.toUpperCase()}`;
      sounds.push({ type: 'card', playerId: p.id });
    } else if (action.type === 'draw-or-pass' || action.type === 'submit-selected') {
      const unrolled = state.camels.filter((c) => !state.rolledThisLeg.includes(c.id));
      const pool = unrolled.length > 0 ? unrolled : state.camels;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      state.rolledThisLeg.push(pick.id);
      p.coins += 25 * mult;
      p.score += 25 * mult;
      p.lastAction = 'ROLLED DIE';
      advanceCamel(state, pick.id, 1 + Math.floor(Math.random() * 3), mult, sounds);
      sounds.push({ type: 'wheel', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'camel-stack-derby',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      leg: state.leg,
      trackLen: state.trackLen,
      camels: state.camels,
      lastRollText: state.lastRollText,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        betColor: p.betColor,
        coins: p.coins,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: clamp(p.actionCd / 0.45, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.coins} coins · ${p.score} pts`);
  },
};

// ============================================================================
// 6. ROUTE EXPRESS (Ticket to Ride Style — Pad 4 Card)
// ============================================================================
const RAIL_CITIES = [
  { id: 'c0', name: 'SEA', x: 240, y: 170 },
  { id: 'c1', name: 'DEN', x: 520, y: 150 },
  { id: 'c2', name: 'CHI', x: 780, y: 165 },
  { id: 'c3', name: 'NYC', x: 980, y: 215 },
  { id: 'c4', name: 'LAX', x: 270, y: 400 },
  { id: 'c5', name: 'DAL', x: 590, y: 390 },
  { id: 'c6', name: 'MIA', x: 920, y: 410 },
];

function createFreshRoutes(): RouteExpressSnapshot['routes'] {
  return [
    { id: 'r0', from: 0, to: 1, color: 'blue', len: 2, ownerId: null, ownerColor: null },
    { id: 'r1', from: 1, to: 2, color: 'gold', len: 2, ownerId: null, ownerColor: null },
    { id: 'r2', from: 2, to: 3, color: 'red', len: 2, ownerId: null, ownerColor: null },
    { id: 'r3', from: 0, to: 4, color: 'green', len: 2, ownerId: null, ownerColor: null },
    { id: 'r4', from: 4, to: 5, color: 'red', len: 3, ownerId: null, ownerColor: null },
    { id: 'r5', from: 5, to: 6, color: 'blue', len: 3, ownerId: null, ownerColor: null },
    { id: 'r6', from: 1, to: 5, color: 'green', len: 2, ownerId: null, ownerColor: null },
    { id: 'r7', from: 2, to: 6, color: 'gold', len: 4, ownerId: null, ownerColor: null },
    { id: 'r8', from: 3, to: 6, color: 'red', len: 2, ownerId: null, ownerColor: null },
    { id: 'r9', from: 4, to: 1, color: 'gold', len: 3, ownerId: null, ownerColor: null },
  ];
}

interface RouteExpressState {
  timeLeft: number;
  totalTime: number;
  cities: RouteExpressSnapshot['cities'];
  routes: RouteExpressSnapshot['routes'];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    actionCd: number;
    hand: { id: string; color: TileColor | 'wild' }[];
    routesClaimed: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function drawTrainCards(count: number): { id: string; color: TileColor | 'wild' }[] {
  const pool: (TileColor | 'wild')[] = ['red', 'blue', 'gold', 'green', 'wild'];
  return Array.from({ length: count }, () => ({
    id: `tr_${Math.random().toString(36).slice(2, 8)}`,
    color: pool[Math.floor(Math.random() * pool.length)],
  }));
}

function tryClaimRouteByColor(
  state: RouteExpressState,
  p: RouteExpressState['players'][0],
  colorChoice: TileColor | 'wild',
  mult: number,
  sounds: CompactSoundEvent[]
): boolean {
  const openRoutes = state.routes.filter((r) => !r.ownerId);
  const wildCount = p.hand.filter((c) => c.color === 'wild').length;
  const targetColors = colorChoice === 'wild' ? TILE_COLORS : [colorChoice];
  const candidate = openRoutes
    .filter((r) => targetColors.includes(r.color))
    .sort((a, b) => a.len - b.len)
    .find((r) => {
      const exactCount = p.hand.filter((c) => c.color === r.color).length;
      return exactCount + wildCount >= r.len;
    });

  if (!candidate) return false;
  let need = candidate.len;
  const kept: typeof p.hand = [];
  for (const c of p.hand) {
    if (need > 0 && c.color === candidate.color) {
      need--;
    } else {
      kept.push(c);
    }
  }
  const finalHand: typeof p.hand = [];
  for (const c of kept) {
    if (need > 0 && c.color === 'wild') {
      need--;
    } else {
      finalHand.push(c);
    }
  }
  p.hand = finalHand;
  while (p.hand.length < 3) p.hand.push(...drawTrainCards(1));

  candidate.ownerId = p.id;
  candidate.ownerColor = p.colorHex;
  p.routesClaimed += 1;
  const pts = (candidate.len === 4 ? 190 : candidate.len === 3 ? 125 : 75) * mult;
  p.score += pts;
  p.lastAction = `BUILT ${candidate.len}-CAR`;
  state.banner = `${p.name} CLAIMED ${state.cities[candidate.from].name}→${state.cities[candidate.to].name}! +${pts}`;
  sounds.push({ type: 'score', playerId: p.id });
  return true;
}

export const routeExpressModule: CompactGameModule<RouteExpressState, RouteExpressSnapshot> = {
  id: 'route-express',
  init({ players, settingValue }) {
    const totalTime = settingValue || 120;
    return {
      timeLeft: totalTime,
      totalTime,
      cities: RAIL_CITIES,
      routes: createFreshRoutes(),
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.8 + Math.random() * 1.8,
        actionCd: 0,
        hand: drawTrainCards(5),
        routesClaimed: 0,
        score: 0,
        lastAction: 'DRAWING',
      })),
      banner: 'COLLECT TRAIN CARDS & TAP TO CLAIM MATCHING RAIL ROUTES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.actionCd = Math.max(0, p.actionCd - dt);
      if (!p.isBot) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        p.botTimer = 1.9 + Math.random() * 1.9;
        let built = false;
        for (const c of p.hand) {
          if (tryClaimRouteByColor(state, p, c.color, mult, sounds)) {
            built = true;
            break;
          }
        }
        if (!built && p.hand.length < 9) {
          p.hand.push(...drawTrainCards(2));
          p.lastAction = 'DREW +2';
        }
      }
    }

    if (state.routes.every((r) => r.ownerId !== null)) {
      state.routes = createFreshRoutes();
      state.banner = 'CONTINENTAL NETWORK COMPLETE — NEW RAIL MAP!';
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    const openRoutes = state.routes.filter((r) => !r.ownerId);
    for (const p of state.players) {
      const wildCount = p.hand.filter((c) => c.color === 'wild').length;
      const hand: CardPrivateHandItem[] = p.hand.map((c) => {
        const canBuild = openRoutes.some((r) => {
          if (c.color !== 'wild' && r.color !== c.color) return false;
          const cnt = p.hand.filter((x) => x.color === r.color).length;
          return cnt + wildCount >= r.len;
        });
        return {
          id: c.id,
          kind: 'clash',
          color: c.color as CardColor,
          value: c.color === 'wild' ? '★' : '🚂',
          playable: canBuild,
          selected: false,
        };
      });
      out[p.id] = {
        gameId: 'route-express',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: true,
        isActionRequired: true,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        secondaryBtn: {
          label: 'DRAW TRAINS (+2)',
          labelZh: '摸两张列车牌',
          action: { type: 'draw-or-pass' },
          colorHex: '#FFB800',
          textColor: '#14120B',
          disabled: p.hand.length >= 10,
        },
        statusHint: 'Tap a glowing Train Card to claim a matching TV route, or DRAW TRAINS!',
        statusHintZh: '点击高亮同色列车牌抢修铁路，或点「摸两张列车牌」攒手牌！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.actionCd > 0) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    p.actionCd = 0.4;
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId) {
      const card = p.hand.find((c) => c.id === action.cardId);
      if (card) {
        if (!tryClaimRouteByColor(state, p, card.color, mult, sounds)) {
          if (p.hand.length < 10) p.hand.push(...drawTrainCards(1));
          sounds.push({ type: 'tick', playerId: p.id });
        }
      }
    } else if (action.type === 'draw-or-pass') {
      if (p.hand.length < 10) {
        p.hand.push(...drawTrainCards(isStateFrenzyActive(state) ? 3 : 2));
        p.lastAction = 'DREW TRAINS';
        sounds.push({ type: 'card', playerId: p.id });
      }
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'route-express',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cities: state.cities,
      routes: state.routes,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cardCount: p.hand.length,
        routesClaimed: p.routesClaimed,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: clamp(p.actionCd / 0.4, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.routesClaimed} routes · ${p.score} pts`);
  },
};

// ============================================================================
// 7. GEM ENGINE GUILD (Splendor Style — Pad 4 Card)
// ============================================================================
interface GemMarketCard {
  id: string;
  tier: 1 | 2 | 3;
  color: TileColor;
  cost: number;
  pts: number;
}

function makeGemCard(tier: 1 | 2 | 3): GemMarketCard {
  const color = TILE_COLORS[Math.floor(Math.random() * 4)];
  const cost = tier === 1 ? 3 : tier === 2 ? 5 : 7;
  const pts = tier === 1 ? 45 : tier === 2 ? 95 : 175;
  return { id: `gc_${tier}_${Math.random().toString(36).slice(2, 7)}`, tier, color, cost, pts };
}

interface GemEngineState {
  timeLeft: number;
  totalTime: number;
  market: GemMarketCard[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    actionCd: number;
    gems: Record<TileColor, number>;
    discounts: Record<TileColor, number>;
    cardsBought: number;
    nobles: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function sumRecord(r: Record<TileColor, number>): number {
  return r.red + r.blue + r.gold + r.green;
}

function buyGemMarketCard(
  state: GemEngineState,
  p: GemEngineState['players'][0],
  cardId: string,
  mult: number,
  sounds: CompactSoundEvent[]
): boolean {
  const idx = state.market.findIndex((m) => m.id === cardId);
  if (idx < 0) return false;
  const card = state.market[idx];
  const discount = p.discounts[card.color] + Math.floor((sumRecord(p.discounts) - p.discounts[card.color]) / 2);
  const netCost = Math.max(1, card.cost - discount);
  if (sumRecord(p.gems) < netCost) return false;

  let rem = netCost;
  for (const col of TILE_COLORS) {
    const take = Math.min(rem, p.gems[col]);
    p.gems[col] -= take;
    rem -= take;
  }
  p.discounts[card.color] += 1;
  p.cardsBought += 1;
  let gained = card.pts * mult;
  let nobleHit = false;
  if (p.cardsBought % 3 === 0) {
    p.nobles += 1;
    gained += 160 * mult;
    nobleHit = true;
  }
  p.score += gained;
  p.lastAction = nobleHit ? 'NOBLE PATRON!' : `TIER-${card.tier} CARD`;
  state.market[idx] = makeGemCard(card.tier);
  if (nobleHit) state.banner = `${p.name} ATTRACTED A ROYAL NOBLE! +${gained}`;
  sounds.push({ type: nobleHit ? 'score' : 'card', playerId: p.id });
  return true;
}

export const gemEngineGuildModule: CompactGameModule<GemEngineState, GemEngineGuildSnapshot> = {
  id: 'gem-engine-guild',
  init({ players, settingValue }) {
    const totalTime = settingValue || 120;
    return {
      timeLeft: totalTime,
      totalTime,
      market: [makeGemCard(1), makeGemCard(1), makeGemCard(2), makeGemCard(2), makeGemCard(3), makeGemCard(3)],
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.5 + Math.random() * 1.5,
        actionCd: 0,
        gems: { red: 1, blue: 1, gold: 1, green: 1 },
        discounts: { red: 0, blue: 0, gold: 0, green: 0 },
        cardsBought: 0,
        nobles: 0,
        score: 0,
        lastAction: 'MINING',
      })),
      banner: 'MINE GEMS & BUY PERMANENT DISCOUNT CARDS TO UNLOCK +160 NOBLES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.actionCd = Math.max(0, p.actionCd - dt);
      if (!p.isBot) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        p.botTimer = 1.6 + Math.random() * 1.6;
        const sorted = [...state.market].sort((a, b) => b.pts - a.pts);
        let bought = false;
        for (const m of sorted) {
          if (buyGemMarketCard(state, p, m.id, mult, sounds)) {
            bought = true;
            break;
          }
        }
        if (!bought) {
          p.gems[TILE_COLORS[Math.floor(Math.random() * 4)]] += 1;
          p.gems[TILE_COLORS[Math.floor(Math.random() * 4)]] += 1;
          p.lastAction = 'MINED +2';
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const totalGems = sumRecord(p.gems);
      const totalDisc = sumRecord(p.discounts);
      const hand: CardPrivateHandItem[] = state.market.map((m) => {
        const disc = p.discounts[m.color] + Math.floor((totalDisc - p.discounts[m.color]) / 2);
        const netCost = Math.max(1, m.cost - disc);
        return {
          id: m.id,
          kind: 'party',
          title: `TIER ${m.tier} (+${m.pts})`,
          subtitle: `Cost ${netCost} 💎 (Base ${m.cost})`,
          badge: `+1 ${m.color.toUpperCase()}`,
          accentHex: COLOR_HEX_MAP[m.color],
          playable: totalGems >= netCost,
          selected: false,
        };
      });
      out[p.id] = {
        gameId: 'gem-engine-guild',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: true,
        isActionRequired: true,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        badgeText: `${totalGems} 💎 · ${totalDisc} DISC`,
        badgeColorHex: '#EC4899',
        secondaryBtn: {
          label: 'MINE +2 GEMS',
          labelZh: '采集 +2 宝石',
          action: { type: 'draw-or-pass' },
          colorHex: '#10D98B',
          textColor: '#0A1913',
        },
        statusHint: 'Tap MINE +2 GEMS, then buy highlighted Development Cards to stack discounts!',
        statusHintZh: '点击「采集 +2 宝石」，再购买高亮商会卡叠加永久折扣！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.actionCd > 0) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    p.actionCd = 0.35;
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId) {
      if (!buyGemMarketCard(state, p, action.cardId, mult, sounds)) {
        p.gems[TILE_COLORS[Math.floor(Math.random() * 4)]] += 1;
        sounds.push({ type: 'tick', playerId: p.id });
      }
    } else if (action.type === 'draw-or-pass') {
      const gain = isStateFrenzyActive(state) ? 3 : 2;
      for (let i = 0; i < gain; i++) {
        p.gems[TILE_COLORS[Math.floor(Math.random() * 4)]] += 1;
      }
      p.lastAction = `MINED +${gain}`;
      sounds.push({ type: 'pickup', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'gem-engine-guild',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      market: state.market,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        gems: sumRecord(p.gems),
        discounts: sumRecord(p.discounts),
        nobles: p.nobles,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: clamp(p.actionCd / 0.35, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.nobles} nobles · ${p.score} pts`);
  },
};

// ============================================================================
// 8. HEX ISLAND SETTLERS (Fast Catan Style — Pad 2 Board)
// ============================================================================
const HEX_LAYOUT: { x: number; y: number; resource: 'wood' | 'brick' | 'ore' | 'gold'; rollNum: number }[] = [
  { x: 470, y: 230, resource: 'wood', rollNum: 6 },
  { x: 730, y: 230, resource: 'brick', rollNum: 8 },
  { x: 340, y: 360, resource: 'ore', rollNum: 5 },
  { x: 600, y: 360, resource: 'gold', rollNum: 7 },
  { x: 860, y: 360, resource: 'wood', rollNum: 9 },
  { x: 470, y: 490, resource: 'brick', rollNum: 4 },
  { x: 730, y: 490, resource: 'ore', rollNum: 10 },
];

interface HexIslandState {
  timeLeft: number;
  totalTime: number;
  lastDice: number;
  hexes: HexIslandSettlersSnapshot['hexes'];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorHex: number;
    resources: number;
    settlements: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const hexIslandSettlersModule: CompactGameModule<HexIslandState, HexIslandSettlersSnapshot> = {
  id: 'hex-island-settlers',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      lastDice: 7,
      hexes: HEX_LAYOUT.map((h, id) => ({ id, ...h, ownerSlot: -1, city: false })),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorHex: i % HEX_LAYOUT.length,
        resources: 3,
        settlements: 0,
        score: 0,
        stepCd: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'ROLL 2D6 (B) TO HARVEST ISLANDS · CLAIM CITIES (A)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCd <= 0 && (Math.abs(mx) > 0.35 || Math.abs(my) > 0.35)) {
        const cur = state.hexes[p.cursorHex];
        let bestId = p.cursorHex;
        let bestDot = 0.1;
        for (const h of state.hexes) {
          if (h.id === cur.id) continue;
          const dx = h.x - cur.x;
          const dy = h.y - cur.y;
          const dist = Math.hypot(dx, dy);
          const dot = ((dx * mx + dy * my) / dist) * (1 - dist / 900);
          if (dot > bestDot) {
            bestDot = dot;
            bestId = h.id;
          }
        }
        if (bestId === p.cursorHex) {
          p.cursorHex = (p.cursorHex + (mx + my >= 0 ? 1 : state.hexes.length - 1)) % state.hexes.length;
        } else {
          p.cursorHex = bestId;
        }
        p.stepCd = 0.17;
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        const d1 = 1 + Math.floor(Math.random() * 6);
        const d2 = 1 + Math.floor(Math.random() * 6);
        state.lastDice = d1 + d2;
        let harvest = 1;
        for (const h of state.hexes) {
          if (h.ownerSlot === p.slotIndex) {
            const match = h.rollNum === state.lastDice || Math.abs(h.rollNum - state.lastDice) <= 1;
            if (match || frenzy) harvest += h.city ? 3 : 2;
          }
        }
        p.resources += harvest;
        p.score += harvest * 18 * mult;
        p.cdB = frenzy ? 0.45 : 0.75;
        state.banner = `${p.name} ROLLED ${state.lastDice} — HARVESTED +${harvest} RESOURCES!`;
        sounds.push({ type: 'wheel', playerId: p.id });
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const hx = state.hexes[p.cursorHex];
        if (hx.ownerSlot === -1 && p.resources >= 2) {
          p.resources -= 2;
          hx.ownerSlot = p.slotIndex;
          hx.city = false;
          p.settlements += 1;
          const pts = 95 * mult;
          p.score += pts;
          p.cdA = 0.45;
          sounds.push({ type: 'score', playerId: p.id });
        } else if (hx.ownerSlot === p.slotIndex && !hx.city && p.resources >= 3) {
          p.resources -= 3;
          hx.city = true;
          p.settlements += 1;
          const pts = 145 * mult;
          p.score += pts;
          p.cdA = 0.45;
          state.banner = `${p.name} UPGRADED GOLDEN CITY ON ${hx.resource.toUpperCase()}! +${pts}`;
          sounds.push({ type: 'score', playerId: p.id });
        } else if (hx.ownerSlot !== p.slotIndex && hx.ownerSlot !== -1 && p.resources >= 4) {
          p.resources -= 4;
          hx.ownerSlot = p.slotIndex;
          hx.city = false;
          p.settlements += 1;
          p.score += 110 * mult;
          p.cdA = 0.55;
          sounds.push({ type: 'bump', playerId: p.id });
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'hex-island-settlers',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      lastDice: state.lastDice,
      hexes: state.hexes,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorHex: p.cursorHex,
        resources: p.resources,
        settlements: p.settlements,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.45, 0, 1),
        cooldownB: clamp(p.cdB / 0.75, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.settlements} builds · ${p.score} pts`);
  },
};

// ============================================================================
// 9. HEX INSECT CHESS (Hive Style — Pad 2 Board)
// ============================================================================
type BugKind = 'queen' | 'beetle' | 'hopper' | 'spider';
const BUG_KINDS: BugKind[] = ['queen', 'beetle', 'hopper', 'spider'];

interface HexInsectState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  bugs: { r: number; c: number; kind: BugKind; ownerSlot: number; ownerColor: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    bugIdx: number;
    captures: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const hexInsectChessModule: CompactGameModule<HexInsectState, HexInsectChessSnapshot> = {
  id: 'hex-insect-chess',
  init({ players, settingValue }) {
    const cols = 7;
    const rows = 5;
    const totalTime = settingValue || 90;
    const bugs: HexInsectState['bugs'] = players.map((p, i) => ({
      r: 2,
      c: clamp(1 + i, 0, cols - 1),
      kind: 'queen',
      ownerSlot: p.slotIndex,
      ownerColor: p.colorHex,
    }));
    return {
      timeLeft: totalTime,
      totalTime,
      cols,
      rows,
      bugs,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: 1 + (i % 3),
        c: clamp(1 + i, 0, cols - 1),
        bugIdx: 1,
        captures: 0,
        score: 0,
        stepCd: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DEPLOY BEETLES & HOPPERS (A) TO SURROUND RIVAL QUEEN BEES (+190)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCd <= 0 && (Math.abs(mx) > 0.35 || Math.abs(my) > 0.35)) {
        if (Math.abs(mx) >= Math.abs(my)) p.c = clamp(p.c + Math.sign(mx), 0, state.cols - 1);
        else p.r = clamp(p.r + Math.sign(my), 0, state.rows - 1);
        p.stepCd = 0.14;
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.bugIdx = (p.bugIdx + 1) % BUG_KINDS.length;
        p.cdB = 0.16;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const pickBug = BUG_KINDS[p.bugIdx];
        const existingIdx = state.bugs.findIndex((b) => b.r === p.r && b.c === p.c);
        const adjacent = state.bugs.some((b) => Math.abs(b.r - p.r) + Math.abs(b.c - p.c) === 1);
        if (existingIdx === -1 && (adjacent || state.bugs.length === 0)) {
          state.bugs.push({ r: p.r, c: p.c, kind: pickBug, ownerSlot: p.slotIndex, ownerColor: p.colorHex });
          p.score += 35 * mult;
          p.cdA = frenzy ? 0.22 : 0.42;
          sounds.push({ type: 'pickup', playerId: p.id });

          for (const qb of [...state.bugs]) {
            if (qb.kind !== 'queen' || qb.ownerSlot === p.slotIndex) continue;
            const neighbors = [
              [qb.r - 1, qb.c],
              [qb.r + 1, qb.c],
              [qb.r, qb.c - 1],
              [qb.r, qb.c + 1],
            ].filter(([nr, nc]) => nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols);
            const surrounded = neighbors.every(([nr, nc]) => state.bugs.some((b) => b.r === nr && b.c === nc));
            if (surrounded) {
              p.captures += 1;
              const bonus = 190 * mult;
              p.score += bonus;
              qb.r = Math.floor(Math.random() * state.rows);
              qb.c = Math.floor(Math.random() * state.cols);
              state.banner = `${p.name} SURROUNDED RIVAL QUEEN! +${bonus}`;
              sounds.push({ type: 'score', playerId: p.id });
            }
          }
        } else if (existingIdx >= 0 && pickBug === 'beetle' && state.bugs[existingIdx].ownerSlot !== p.slotIndex) {
          state.bugs[existingIdx] = { r: p.r, c: p.c, kind: 'beetle', ownerSlot: p.slotIndex, ownerColor: p.colorHex };
          p.score += 55 * mult;
          p.cdA = 0.6;
          sounds.push({ type: 'bump', playerId: p.id });
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    if (state.bugs.length >= state.cols * state.rows - 4) {
      state.bugs = state.bugs.filter((b) => b.kind === 'queen');
      state.banner = 'HIVE FULL — QUEENS REDEPLOYED!';
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'hex-insect-chess',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: state.cols,
      rows: state.rows,
      bugs: state.bugs,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: p.r,
        c: p.c,
        pickBug: BUG_KINDS[p.bugIdx],
        score: p.score,
        cooldownA: clamp(p.cdA / 0.42, 0, 1),
        cooldownB: clamp(p.cdB / 0.16, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.captures} queens · ${p.score} pts`);
  },
};

// ============================================================================
// 10. SECRET RANK FLAGS (Stratego Style — Pad 4 Card)
// ============================================================================
interface FlagPiece {
  id: string;
  r: number;
  c: number;
  ownerId: string;
  ownerColor: string;
  rankName: string;
  rankVal: number;
  revealed: boolean;
}

interface SecretRankState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  pieces: FlagPiece[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    actionCd: number;
    flagsCaptured: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function spawnUnitsForPlayer(
  p: { id: string; slotIndex: number; colorHex: string },
  cols: number,
  rows: number
): FlagPiece[] {
  const templates: [string, number][] = [
    ['Marshal 10', 10],
    ['General 9', 9],
    ['Miner 3', 3],
    ['Spy 1', 1],
    ['Bomb', 99],
    ['Flag', 0],
  ];
  return templates.map(([rankName, rankVal], idx) => ({
    id: `sf_${p.slotIndex}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    r: (p.slotIndex * 2 + Math.floor(idx / 3)) % rows,
    c: (idx + p.slotIndex * 2) % cols,
    ownerId: p.id,
    ownerColor: p.colorHex,
    rankName,
    rankVal,
    revealed: false,
  }));
}

function moveFlagUnit(
  state: SecretRankState,
  p: SecretRankState['players'][0],
  pieceId: string,
  lateralShift: boolean,
  mult: number,
  sounds: CompactSoundEvent[]
) {
  const unit = state.pieces.find((u) => u.id === pieceId && u.ownerId === p.id);
  if (!unit || unit.rankVal === 0 || unit.rankVal === 99) return;

  let nr = unit.r;
  let nc = unit.c;
  const enemy = state.pieces.find((u) => u.ownerId !== p.id && Math.abs(u.r - unit.r) + Math.abs(u.c - unit.c) <= 2);
  if (!lateralShift && enemy) {
    if (Math.abs(enemy.r - unit.r) >= Math.abs(enemy.c - unit.c)) nr += Math.sign(enemy.r - unit.r);
    else nc += Math.sign(enemy.c - unit.c);
  } else if (lateralShift) {
    nc = (unit.c + 1) % state.cols;
  } else {
    nr = (unit.r + (p.slotIndex % 2 === 0 ? 1 : state.rows - 1)) % state.rows;
  }
  nr = clamp(nr, 0, state.rows - 1);
  nc = clamp(nc, 0, state.cols - 1);

  const blocker = state.pieces.find((u) => u.id !== unit.id && u.r === nr && u.c === nc);
  if (blocker && blocker.ownerId === p.id) {
    nc = (nc + 1) % state.cols;
    return;
  }

  unit.r = nr;
  unit.c = nc;

  if (blocker && blocker.ownerId !== p.id) {
    unit.revealed = true;
    blocker.revealed = true;
    if (blocker.rankVal === 0) {
      // Captured Flag!
      p.flagsCaptured += 1;
      const pts = 240 * mult;
      p.score += pts;
      p.lastAction = 'CAPTURED FLAG!';
      state.banner = `${p.name} CAPTURED A HIDDEN FLAG! +${pts}`;
      state.pieces = state.pieces.filter((u) => u.id !== blocker.id);
      const owner = state.players.find((pl) => pl.id === blocker.ownerId);
      if (owner) state.pieces.push(...spawnUnitsForPlayer(owner, state.cols, state.rows).slice(0, 3));
      sounds.push({ type: 'score', playerId: p.id });
    } else if (blocker.rankVal === 99) {
      if (unit.rankVal === 3) {
        // Miner defuses Bomb!
        p.score += 120 * mult;
        p.lastAction = 'DEFUSED BOMB';
        state.pieces = state.pieces.filter((u) => u.id !== blocker.id);
        sounds.push({ type: 'score', playerId: p.id });
      } else {
        p.lastAction = 'HIT BOMB!';
        state.pieces = state.pieces.filter((u) => u.id !== unit.id && u.id !== blocker.id);
        sounds.push({ type: 'elim', playerId: p.id });
      }
    } else if ((unit.rankVal === 1 && blocker.rankVal === 10) || unit.rankVal > blocker.rankVal) {
      p.score += 85 * mult;
      p.lastAction = `BEAT ${blocker.rankName.toUpperCase()}`;
      state.pieces = state.pieces.filter((u) => u.id !== blocker.id);
      sounds.push({ type: 'hit', playerId: p.id });
    } else {
      p.lastAction = `LOST TO ${blocker.rankName.toUpperCase()}`;
      state.pieces = state.pieces.filter((u) => u.id !== unit.id);
      sounds.push({ type: 'hit', playerId: p.id });
    }
  } else {
    p.score += 12 * mult;
    p.lastAction = `MARCH ${unit.rankName.split(' ')[0].toUpperCase()}`;
    sounds.push({ type: 'card', playerId: p.id });
  }
}

export const secretRankFlagsModule: CompactGameModule<SecretRankState, SecretRankFlagsSnapshot> = {
  id: 'secret-rank-flags',
  init({ players, settingValue }) {
    const cols = 6;
    const rows = 4;
    const totalTime = settingValue || 120;
    const pieces: FlagPiece[] = [];
    for (const p of players) {
      pieces.push(...spawnUnitsForPlayer(p, cols, rows));
    }
    return {
      timeLeft: totalTime,
      totalTime,
      cols,
      rows,
      pieces,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.8 + Math.random() * 1.6,
        actionCd: 0,
        flagsCaptured: 0,
        score: 0,
        lastAction: 'DEPLOYED',
      })),
      banner: 'KEEP YOUR RANKS HIDDEN · CAPTURE ENEMY FLAGS (+240)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.actionCd = Math.max(0, p.actionCd - dt);
      const mobile = state.pieces.filter((u) => u.ownerId === p.id && u.rankVal > 0 && u.rankVal < 99);
      if (mobile.length === 0) {
        state.pieces.push(...spawnUnitsForPlayer(p, state.cols, state.rows).slice(0, 4));
      }
      if (!p.isBot) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        p.botTimer = 2.0 + Math.random() * 1.6;
        const unit = mobile[Math.floor(Math.random() * mobile.length)];
        if (unit) moveFlagUnit(state, p, unit.id, false, mult, sounds);
      }
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const myUnits = state.pieces.filter((u) => u.ownerId === p.id);
      const hand: CardPrivateHandItem[] = myUnits.map((u) => ({
        id: u.id,
        kind: 'party',
        title: u.rankName.toUpperCase(),
        subtitle: `Row ${u.r + 1} · Col ${u.c + 1}`,
        badge: u.rankVal === 0 ? 'GUARD' : u.rankVal === 99 ? 'TRAP' : 'MARCH',
        accentHex: u.rankVal === 0 ? '#FFB800' : u.rankVal === 99 ? '#EF4444' : p.colorHex,
        playable: u.rankVal > 0 && u.rankVal < 99,
        selected: false,
      }));
      out[p.id] = {
        gameId: 'secret-rank-flags',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: true,
        isActionRequired: true,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        secondaryBtn: {
          label: 'FLANK SHIFT',
          labelZh: '侧翼调动',
          action: { type: 'draw-or-pass' },
          colorHex: '#38BDF8',
          textColor: '#07131D',
        },
        statusHint: 'Tap a mobile unit (Marshal/General/Miner/Spy) on your phone to march & clash!',
        statusHintZh: '点选你的可移动单位（元帅/将军/工兵/间谍）向前突击夺旗！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.actionCd > 0) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    p.actionCd = 0.42;
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId) {
      moveFlagUnit(state, p, action.cardId, false, mult, sounds);
    } else if (action.type === 'draw-or-pass') {
      const mobile = state.pieces.filter((u) => u.ownerId === p.id && u.rankVal > 0 && u.rankVal < 99);
      const pick = mobile[Math.floor(Math.random() * mobile.length)];
      if (pick) moveFlagUnit(state, p, pick.id, true, mult, sounds);
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'secret-rank-flags',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: state.cols,
      rows: state.rows,
      pieces: state.pieces.map((u) => ({
        id: u.id,
        r: u.r,
        c: u.c,
        ownerId: u.ownerId,
        ownerColor: u.ownerColor,
        revealedRank: u.revealed ? u.rankName : null,
      })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        unitsLeft: state.pieces.filter((u) => u.ownerId === p.id).length,
        flagsCaptured: p.flagsCaptured,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: clamp(p.actionCd / 0.42, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.flagsCaptured} flags · ${p.score} pts`);
  },
};
