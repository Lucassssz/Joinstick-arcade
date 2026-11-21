import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BombGridPlayerState,
  type BombGridSnapshot,
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

interface InternalBomb {
  id: string;
  ownerId: string;
  col: number;
  row: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuse: number;
  maxFuse: number;
  range: number;
  colorHex: string;
}

interface InternalFlame {
  col: number;
  row: number;
  ownerId: string;
  timer: number;
  maxTimer: number;
  colorHex: string;
}

interface InternalPowerup {
  id: string;
  col: number;
  row: number;
  kind: 'flame' | 'bomb' | 'speed' | 'shield' | 'mega';
}

interface InternalPlayer extends BombGridPlayerState {
  bombCd: number;
  kickCd: number;
  hasShield: boolean;
  megaBombs: number;
  invulnTimer: number;
}

interface BombGridState {
  round: number;
  totalRounds: number;
  roundTimer: number;
  roundEndPause: number;
  roundBanner: string | null;
  cols: number;
  rows: number;
  cells: number[];
  bombs: InternalBomb[];
  flames: InternalFlame[];
  powerups: InternalPowerup[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  shrinkTimer: number;
  shrinkOrder: [number, number][];
  shrinkIdx: number;
  players: InternalPlayer[];
  nextId: number;
  finished: boolean;
}

const COLS = 15;
const ROWS = 9;
const CELL = 68;
const GRID_LEFT = Math.floor((ARENA_WIDTH - COLS * CELL) / 2);
const GRID_TOP = Math.floor((ARENA_HEIGHT - ROWS * CELL) / 2) + 14;
const ROUND_LIMIT = 55;

const SPAWNS: [number, number][] = [
  [1, 1],
  [COLS - 2, ROWS - 2],
  [COLS - 2, 1],
  [1, ROWS - 2],
  [7, 1],
  [7, ROWS - 2],
  [1, 4],
  [COLS - 2, 4],
];

function cellCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: GRID_LEFT + (col + 0.5) * CELL,
    y: GRID_TOP + (row + 0.5) * CELL,
  };
}

function posToCell(x: number, y: number): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.floor((x - GRID_LEFT) / CELL))),
    row: Math.max(0, Math.min(ROWS - 1, Math.floor((y - GRID_TOP) / CELL))),
  };
}

function isSpawnSafe(col: number, row: number): boolean {
  for (const [sc, sr] of SPAWNS) {
    if (Math.abs(col - sc) + Math.abs(row - sr) <= 1) return true;
  }
  return false;
}

function buildMaze(): number[] {
  const cells = new Array<number>(COLS * ROWS).fill(0);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0)) {
        cells[idx] = 1; // indestructible steel
      } else if (!isSpawnSafe(c, r) && Math.random() < 0.62) {
        cells[idx] = 2; // wooden crate
      }
    }
  }
  return cells;
}

function buildShrinkOrder(): [number, number][] {
  const coords: [number, number][] = [];
  for (let c = 1; c <= COLS - 2; c++) coords.push([c, 1]);
  for (let r = 2; r <= ROWS - 2; r++) coords.push([COLS - 2, r]);
  for (let c = COLS - 3; c >= 1; c--) coords.push([c, ROWS - 2]);
  for (let r = ROWS - 3; r >= 2; r--) coords.push([1, r]);
  return coords;
}

function resetRound(state: BombGridState): void {
  state.cells = buildMaze();
  state.bombs = [];
  state.flames = [];
  state.powerups = [];
  state.popups = [];
  state.shrinkTimer = 0.28;
  state.shrinkIdx = 0;
  state.shrinkOrder = buildShrinkOrder();
  state.roundTimer = ROUND_LIMIT;
  state.roundEndPause = 0;
  state.roundBanner = `ROUND ${state.round}`;
  state.players.forEach((p, idx) => {
    const [sc, sr] = SPAWNS[idx % SPAWNS.length];
    const pos = cellCenter(sc, sr);
    p.x = pos.x;
    p.y = pos.y;
    p.alive = true;
    p.maxBombs = 1;
    p.blastRange = 2;
    p.speedBonus = 0;
    p.bombCd = 0;
    p.kickCd = 0;
    p.hasShield = false;
    p.megaBombs = 0;
    p.invulnTimer = 0;
  });
}

function isBlocked(state: BombGridState, col: number, row: number): boolean {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return true;
  return state.cells[row * COLS + col] !== 0;
}

function explodeBomb(
  state: BombGridState,
  bomb: InternalBomb,
  sounds: SoundEvent[],
  haptics: HapticTrigger[]
): void {
  sounds.push({ type: 'pulse', playerId: bomb.ownerId, intensity: 0.9 });
  const addFlame = (c: number, r: number) => {
    state.flames.push({
      col: c,
      row: r,
      ownerId: bomb.ownerId,
      timer: 0.42,
      maxTimer: 0.42,
      colorHex: bomb.colorHex,
    });
  };

  addFlame(bomb.col, bomb.row);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (const [dc, dr] of dirs) {
    for (let step = 1; step <= bomb.range; step++) {
      const c = bomb.col + dc * step;
      const r = bomb.row + dr * step;
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) break;
      const idx = r * COLS + c;
      if (state.cells[idx] === 1) break;
      addFlame(c, r);

      // Chain react any bomb hit by flame
      const chained = state.bombs.find((b) => b.id !== bomb.id && b.col === c && b.row === r && b.fuse > 0.05);
      if (chained) chained.fuse = 0.05;

      if (state.cells[idx] === 2) {
        state.cells[idx] = 0;
        const owner = state.players.find((p) => p.id === bomb.ownerId);
        if (owner) owner.score += 15;
        if (Math.random() < 0.42) {
          const kinds: ('flame' | 'bomb' | 'speed' | 'shield' | 'mega')[] = ['flame', 'bomb', 'speed', 'shield', 'mega'];
          state.powerups.push({
            id: `pu_${state.nextId++}`,
            col: c,
            row: r,
            kind: kinds[Math.floor(Math.random() * kinds.length)],
          });
        }
        break;
      }
    }
  }

  for (const p of state.players) {
    if (p.alive && Math.hypot(p.x - bomb.x, p.y - bomb.y) < CELL * 3.5) {
      haptics.push({ playerId: p.id, pattern: 24, reason: 'blast' });
    }
  }
}

export const bombGridModule: ServerGameModule<BombGridState> = {
  id: 'bomb-grid',

  createState(players, settingValue) {
    const totalRounds = Math.max(1, Math.min(5, settingValue || 3));
    const list: InternalPlayer[] = players.map((p, idx) => {
      const [sc, sr] = SPAWNS[idx % SPAWNS.length];
      const pos = cellCenter(sc, sr);
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        x: pos.x,
        y: pos.y,
        angle: 0,
        alive: true,
        maxBombs: 1,
        blastRange: 2,
        speedBonus: 0,
        kos: 0,
        score: 0,
        roundsWon: 0,
        cooldownA: 0,
        cooldownB: 0,
        bombCd: 0,
        kickCd: 0,
        hasShield: false,
        megaBombs: 0,
        invulnTimer: 0,
      };
    });

    const state: BombGridState = {
      round: 1,
      totalRounds,
      roundTimer: ROUND_LIMIT,
      roundEndPause: 0,
      roundBanner: 'ROUND 1',
      cols: COLS,
      rows: ROWS,
      cells: [],
      bombs: [],
      flames: [],
      powerups: [],
      popups: [],
      shrinkTimer: 0.28,
      shrinkOrder: [],
      shrinkIdx: 0,
      players: list,
      nextId: 1,
      finished: false,
    };
    resetRound(state);
    return state;
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    if (state.roundEndPause > 0) {
      state.roundEndPause -= dt;
      if (state.roundEndPause <= 0) {
        if (state.round >= state.totalRounds) {
          state.finished = true;
        } else {
          state.round++;
          resetRound(state);
          sounds.push({ type: 'go' });
        }
      }
    } else if (!state.finished) {
      state.roundTimer = Math.max(0, state.roundTimer - dt);
      if (state.roundTimer < ROUND_LIMIT - 1.3 && state.roundTimer >= 16) state.roundBanner = null;

      for (let i = state.popups.length - 1; i >= 0; i--) {
        state.popups[i].y -= 34 * dt;
        state.popups[i].alpha -= dt * 0.9;
        if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
      }

      // Sudden Death shrinking outer walls in final 16s!
      if (state.roundTimer < 16 && state.shrinkIdx < state.shrinkOrder.length) {
        if (state.shrinkIdx === 0 && !state.roundBanner) {
          state.roundBanner = 'SUDDEN DEATH SHRINK!';
          sounds.push({ type: 'countdown' });
        }
        state.shrinkTimer -= dt;
        if (state.shrinkTimer <= 0) {
          state.shrinkTimer = 0.28;
          const [sc, sr] = state.shrinkOrder[state.shrinkIdx++];
          state.cells[sr * COLS + sc] = 1;
          for (const p of state.players) {
            if (!p.alive) continue;
            const pc = posToCell(p.x, p.y);
            if (pc.col === sc && pc.row === sr) {
              p.alive = false;
              sounds.push({ type: 'ko', playerId: p.id });
            }
          }
          if (state.shrinkIdx > 4 && state.roundBanner === 'SUDDEN DEATH SHRINK!') {
            state.roundBanner = null;
          }
        }
      }

      // Update players
      for (const p of state.players) {
        p.bombCd = Math.max(0, p.bombCd - dt);
        p.kickCd = Math.max(0, p.kickCd - dt);
        p.invulnTimer = Math.max(0, p.invulnTimer - dt);
        if (!p.alive) continue;

        const inp = players.find((x) => x.id === p.id);
        if (!inp) continue;
        const { dx, dy, a, b } = inp.input;
        const mag = Math.hypot(dx, dy);
        if (mag > 0.14) {
          p.angle = Math.atan2(dy, dx);
          const spd = 215 + p.speedBonus * 26;
          const nx = p.x + (dx / Math.max(1, mag)) * spd * dt;
          const ny = p.y + (dy / Math.max(1, mag)) * spd * dt;
          const r = 20;

          // Separate axis collision against solid cells with gentle corner assist
          const tryX = (tx: number) => {
            const c1 = posToCell(tx - r, p.y - r * 0.72);
            const c2 = posToCell(tx + r, p.y + r * 0.72);
            const c3 = posToCell(tx - r, p.y + r * 0.72);
            const c4 = posToCell(tx + r, p.y - r * 0.72);
            return (
              !isBlocked(state, c1.col, c1.row) &&
              !isBlocked(state, c2.col, c2.row) &&
              !isBlocked(state, c3.col, c3.row) &&
              !isBlocked(state, c4.col, c4.row)
            );
          };
          if (tryX(nx)) p.x = nx;

          const tryY = (ty: number) => {
            const c1 = posToCell(p.x - r * 0.72, ty - r);
            const c2 = posToCell(p.x + r * 0.72, ty + r);
            const c3 = posToCell(p.x - r * 0.72, ty + r);
            const c4 = posToCell(p.x + r * 0.72, ty - r);
            return (
              !isBlocked(state, c1.col, c1.row) &&
              !isBlocked(state, c2.col, c2.row) &&
              !isBlocked(state, c3.col, c3.row) &&
              !isBlocked(state, c4.col, c4.row)
            );
          };
          if (tryY(ny)) p.y = ny;
        }

        const myCell = posToCell(p.x, p.y);

        // Pick up powerups
        for (let i = state.powerups.length - 1; i >= 0; i--) {
          const pu = state.powerups[i];
          if (pu.col === myCell.col && pu.row === myCell.row) {
            if (pu.kind === 'flame') {
              p.blastRange = Math.min(5, p.blastRange + 1);
              state.popups.push({ x: p.x, y: p.y - 24, text: 'FLAME +1!', colorHex: '#FF7A1A', alpha: 1.1 });
            } else if (pu.kind === 'bomb') {
              p.maxBombs = Math.min(4, p.maxBombs + 1);
              state.popups.push({ x: p.x, y: p.y - 24, text: 'BOMB +1!', colorHex: '#00C2FF', alpha: 1.1 });
            } else if (pu.kind === 'speed') {
              p.speedBonus = Math.min(3, p.speedBonus + 1);
              state.popups.push({ x: p.x, y: p.y - 24, text: 'SPEED +1!', colorHex: '#9EE622', alpha: 1.1 });
            } else if (pu.kind === 'shield') {
              p.hasShield = true;
              state.popups.push({ x: p.x, y: p.y - 24, text: 'BLAST SHIELD!', colorHex: '#38BDF8', alpha: 1.2 });
            } else {
              p.megaBombs += 2;
              state.popups.push({ x: p.x, y: p.y - 24, text: 'MEGA BOMB x2!', colorHex: '#FF3B9A', alpha: 1.2 });
            }
            p.score += 40;
            state.powerups.splice(i, 1);
            sounds.push({ type: 'pickup', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 18, reason: 'powerup' });
          }
        }

        // Action A: Drop Bomb
        if (a && !inp.prevA && p.bombCd <= 0) {
          const activeOwned = state.bombs.filter((bm) => bm.ownerId === p.id).length;
          const occupied = state.bombs.some((bm) => bm.col === myCell.col && bm.row === myCell.row);
          if (activeOwned < p.maxBombs && !occupied) {
            const center = cellCenter(myCell.col, myCell.row);
            const isMega = p.megaBombs > 0;
            if (isMega) p.megaBombs--;
            state.bombs.push({
              id: `bm_${state.nextId++}`,
              ownerId: p.id,
              col: myCell.col,
              row: myCell.row,
              x: center.x,
              y: center.y,
              vx: 0,
              vy: 0,
              fuse: 2.0,
              maxFuse: 2.0,
              range: isMega ? Math.min(7, p.blastRange + 2) : p.blastRange,
              colorHex: isMega ? '#FF3B9A' : p.colorHex,
            });
            p.bombCd = 0.25;
            sounds.push({ type: 'confirm', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 16, reason: 'drop-bomb' });
          }
        }

        // Action B: Kick nearby bomb along facing cardinal direction
        if (b && !inp.prevB && p.kickCd <= 0) {
          const near = state.bombs.find((bm) => Math.hypot(bm.x - p.x, bm.y - p.y) < CELL * 1.15);
          if (near) {
            const cos = Math.cos(p.angle);
            const sin = Math.sin(p.angle);
            if (Math.abs(cos) >= Math.abs(sin)) {
              near.vx = Math.sign(cos || 1) * 420;
              near.vy = 0;
            } else {
              near.vx = 0;
              near.vy = Math.sign(sin || 1) * 420;
            }
            p.kickCd = 0.65;
            sounds.push({ type: 'boost', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 22, reason: 'kick-bomb' });
          }
        }
      }

      // Update bombs
      for (let i = state.bombs.length - 1; i >= 0; i--) {
        const bm = state.bombs[i];
        bm.fuse -= dt;
        if (bm.vx !== 0 || bm.vy !== 0) {
          const nx = bm.x + bm.vx * dt;
          const ny = bm.y + bm.vy * dt;
          const nextCell = posToCell(nx + Math.sign(bm.vx) * 20, ny + Math.sign(bm.vy) * 20);
          const hitOtherBomb = state.bombs.some(
            (o) => o.id !== bm.id && o.col === nextCell.col && o.row === nextCell.row
          );
          if (isBlocked(state, nextCell.col, nextCell.row) || hitOtherBomb) {
            const snap = cellCenter(bm.col, bm.row);
            bm.x = snap.x;
            bm.y = snap.y;
            bm.vx = 0;
            bm.vy = 0;
          } else {
            bm.x = nx;
            bm.y = ny;
            const nc = posToCell(bm.x, bm.y);
            bm.col = nc.col;
            bm.row = nc.row;
          }
        }
        if (bm.fuse <= 0) {
          state.bombs.splice(i, 1);
          explodeBomb(state, bm, sounds, haptics);
        }
      }

      // Update flames & player hits
      for (let i = state.flames.length - 1; i >= 0; i--) {
        const fl = state.flames[i];
        fl.timer -= dt;
        for (const p of state.players) {
          if (!p.alive || p.invulnTimer > 0) continue;
          const pc = posToCell(p.x, p.y);
          if (pc.col === fl.col && pc.row === fl.row) {
            if (p.hasShield) {
              p.hasShield = false;
              p.invulnTimer = 1.1;
              state.popups.push({ x: p.x, y: p.y - 26, text: 'SHIELD SAVED!', colorHex: '#38BDF8', alpha: 1.2 });
              sounds.push({ type: 'confirm', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: 25, reason: 'shield-save' });
              continue;
            }
            p.alive = false;
            sounds.push({ type: 'ko', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: [50, 40, 60], reason: 'ko' });
            const killer = state.players.find((k) => k.id === fl.ownerId);
            if (killer && killer.id !== p.id) {
              killer.kos++;
              killer.score += 120;
              state.popups.push({ x: killer.x, y: killer.y - 28, text: '+120 KO!', colorHex: '#FFB800', alpha: 1.2 });
            }
          }
        }
        if (fl.timer <= 0) state.flames.splice(i, 1);
      }

      // Check round end
      const alive = state.players.filter((p) => p.alive);
      const cratesLeft = state.cells.filter((c) => c === 2).length;
      const soloDone = state.players.length === 1 && (alive.length === 0 || cratesLeft === 0);
      const multiDone = state.players.length > 1 && alive.length <= 1;

      if (soloDone || multiDone || state.roundTimer <= 0) {
        if (alive.length === 1) {
          alive[0].roundsWon++;
          alive[0].score += 150;
          state.roundBanner = `${alive[0].name} WINS ROUND ${state.round}!`;
          sounds.push({ type: 'win', playerId: alive[0].id });
        } else if (cratesLeft === 0 && state.players.length === 1) {
          state.players[0].roundsWon++;
          state.players[0].score += 200;
          state.roundBanner = `MAZE CLEARED!`;
          sounds.push({ type: 'win', playerId: state.players[0].id });
        } else {
          state.roundBanner = `ROUND ${state.round} DRAW!`;
        }
        state.roundEndPause = 2.0;
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      p.cooldownA = Math.min(1, p.bombCd / 0.25);
      p.cooldownB = Math.min(1, p.kickCd / 0.65);
      hudUpdates[p.id] = {
        score: p.score,
        alive: p.alive,
        statText: p.alive ? `${p.score} pts · ${p.maxBombs}B/${p.blastRange}F` : 'Eliminated',
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

  getSnapshot(state): BombGridSnapshot {
    return {
      gameId: 'bomb-grid',
      round: state.round,
      totalRounds: state.totalRounds,
      roundTimer: state.roundTimer,
      roundBanner: state.roundBanner,
      cols: state.cols,
      rows: state.rows,
      cells: [...state.cells],
      bombs: state.bombs.map((b) => ({
        id: b.id,
        ownerId: b.ownerId,
        col: b.col,
        row: b.row,
        x: b.x,
        y: b.y,
        fuse: b.fuse,
        maxFuse: b.maxFuse,
        range: b.range,
        colorHex: b.colorHex,
      })),
      flames: state.flames.map((f) => ({
        col: f.col,
        row: f.row,
        alpha: Math.max(0, f.timer / f.maxTimer),
        colorHex: f.colorHex,
      })),
      powerups: state.powerups.map((pu) => ({ ...pu })),
      suddenDeath: state.roundTimer < 16,
      popups: state.popups.map((pp) => ({ ...pp })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        alive: p.alive,
        maxBombs: p.maxBombs,
        blastRange: p.blastRange,
        speedBonus: p.speedBonus,
        kos: p.kos,
        score: p.score,
        roundsWon: p.roundsWon,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
        hasShield: p.hasShield,
        megaBombs: p.megaBombs,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.roundsWon - a.roundsWon);
    return sorted.map((bp, idx) => {
      const meta = players.find((p) => p.id === bp.id);
      return {
        playerId: bp.id,
        slotIndex: bp.slotIndex,
        name: bp.name,
        color: meta?.color ?? {
          id: 'tangerine',
          name: 'Tangerine',
          hex: bp.colorHex,
          dark: '#B54F06',
          textOnColor: '#140F0A',
        },
        rank: idx + 1,
        score: bp.score,
        highlight: `${bp.roundsWon} wins · ${bp.kos} KOs`,
      };
    });
  },
};
