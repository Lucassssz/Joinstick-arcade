import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/shared/types.ts';
import type {
  CardPrivateHandItem,
  CardPrivateState,
  LiarSuit,
  PlayingCardRank,
} from '../../src/shared/types.ts';
import type {
  BaccaratClubSnapshot,
  BackgammonSprintSnapshot,
  ChessBlitzSnapshot,
  CurlingMastersSnapshot,
  DominoChainSnapshot,
  GomokuBlitzSnapshot,
  HeartsBreakerSnapshot,
  HexagonConquestSnapshot,
  MancalaJewelsSnapshot,
  MemoryPairsSnapshot,
  PokerShowdownSnapshot,
  RummyRoyaleSnapshot,
  SequenceJackSnapshot,
  SpadesBiddingSnapshot,
  TarotArcanaSnapshot,
} from '../../src/shared/packStrategyClassicsTypes.ts';
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

const SUITS: LiarSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: PlayingCardRank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

function makeCardDeck(): { id: string; rank: PlayingCardRank; suit: LiarSuit }[] {
  const deck: { id: string; rank: PlayingCardRank; suit: LiarSuit }[] = [];
  let idx = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `sc_${idx++}_${rank}_${suit}`, rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function rankNumeric(r: PlayingCardRank): number {
  const idx = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'].indexOf(r);
  return idx >= 0 ? idx + 2 : 0;
}

// ============================================================================
// 1. GOMOKU BLITZ (Five-in-a-Row)
// ============================================================================
interface GomokuState {
  timeLeft: number;
  totalTime: number;
  size: number;
  cells: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorR: number;
    cursorC: number;
    stepCooldown: number;
    lines: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function countLongestLine(cells: number[], size: number, r: number, c: number, slot: number): number {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  let best = 1;
  for (const [dr, dc] of dirs) {
    let run = 1;
    for (const sgn of [1, -1]) {
      let nr = r + dr * sgn;
      let nc = c + dc * sgn;
      while (nr >= 0 && nr < size && nc >= 0 && nc < size && cells[nr * size + nc] === slot) {
        run++;
        nr += dr * sgn;
        nc += dc * sgn;
      }
    }
    if (run > best) best = run;
  }
  return best;
}

export const gomokuBlitzModule: CompactGameModule<GomokuState, GomokuBlitzSnapshot> = {
  id: 'gomoku-blitz',
  init({ players, settingValue }) {
    const size = 11;
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
        cursorR: 3 + (i % 2) * 4,
        cursorC: 3 + Math.floor(i / 2) * 2,
        stepCooldown: 0,
        lines: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DROP STONES TO LINK 3, 4 & 5-IN-A-ROW!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.stepCooldown = Math.max(0, p.stepCooldown - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCooldown <= 0 && (Math.abs(mx) > 0.38 || Math.abs(my) > 0.38)) {
        if (Math.abs(mx) >= Math.abs(my)) p.cursorC = clamp(p.cursorC + Math.sign(mx), 0, state.size - 1);
        else p.cursorR = clamp(p.cursorR + Math.sign(my), 0, state.size - 1);
        p.stepCooldown = 0.14;
      }

      const idx = p.cursorR * state.size + p.cursorC;
      if (aDown && !p.prevA && p.cdA <= 0 && state.cells[idx] === -1) {
        state.cells[idx] = p.slotIndex;
        p.cdA = frenzy ? 0.25 : 0.45;
        const streak = countLongestLine(state.cells, state.size, p.cursorR, p.cursorC, p.slotIndex);
        let pts = 25;
        if (streak >= 5) {
          pts = 300;
          p.lines += 1;
          state.banner = `${p.name} HIT 5-IN-A-ROW! +${pts * mult}`;
        } else if (streak === 4) {
          pts = 150;
          p.lines += 1;
        } else if (streak === 3) {
          pts = 75;
        }
        p.score += pts * mult;
        sounds.push({ type: streak >= 4 ? 'score' : 'tick', playerId: p.id });
      } else if (bDown && !p.prevB && p.cdB <= 0 && state.cells[idx] === -1) {
        state.cells[idx] = -2;
        p.cdB = 2.8;
        p.score += 15 * mult;
        sounds.push({ type: 'hit', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    if (state.cells.every((c) => c !== -1)) {
      state.cells.fill(-1);
      state.banner = 'BOARD FULL — FRESH GOMOKU ROUND!';
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'gomoku-blitz',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      size: state.size,
      cells: state.cells,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorR: p.cursorR,
        cursorC: p.cursorC,
        lines: p.lines,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.45, 0, 1),
        cooldownB: clamp(p.cdB / 2.8, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.lines} chains · ${p.score} pts`);
  },
};

// ============================================================================
// 2. CHESS BLITZ (Mini Knight Chess)
// ============================================================================
interface ChessState {
  timeLeft: number;
  totalTime: number;
  size: number;
  pawns: { id: string; r: number; c: number; gold: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    stepCooldown: number;
    invulnTimer: number;
    captures: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const chessBlitzModule: CompactGameModule<ChessState, ChessBlitzSnapshot> = {
  id: 'chess-blitz',
  init({ players, settingValue }) {
    const size = 6;
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      size,
      pawns: Array.from({ length: 6 }, (_, i) => ({
        id: `pw-${i}`,
        r: Math.floor(Math.random() * size),
        c: Math.floor(Math.random() * size),
        gold: i === 0,
      })),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: i % 2 === 0 ? 0 : size - 1,
        c: i % size,
        stepCooldown: 0,
        invulnTimer: 0,
        captures: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'CAPTURE GOLD PAWNS & LEAP OVER RIVALS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    while (state.pawns.length < 6) {
      state.pawns.push({
        id: `pw-${Math.random().toString(36).slice(2, 7)}`,
        r: Math.floor(Math.random() * state.size),
        c: Math.floor(Math.random() * state.size),
        gold: Math.random() < 0.3,
      });
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.stepCooldown = Math.max(0, p.stepCooldown - dt);
      p.invulnTimer = Math.max(0, p.invulnTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCooldown <= 0 && (Math.abs(mx) > 0.35 || Math.abs(my) > 0.35)) {
        if (Math.abs(mx) >= Math.abs(my)) p.c = clamp(p.c + Math.sign(mx), 0, state.size - 1);
        else p.r = clamp(p.r + Math.sign(my), 0, state.size - 1);
        p.stepCooldown = 0.16;
      }

      let struckThisTick = false;
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.cdA = frenzy ? 0.35 : 0.65;
        const knightDeltas = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
        let best = knightDeltas[0];
        let bestScore = -1;
        for (const [dr, dc] of knightDeltas) {
          const nr = p.r + dr;
          const nc = p.c + dc;
          if (nr < 0 || nr >= state.size || nc < 0 || nc >= state.size) continue;
          const pawnHit = state.pawns.some((pw) => pw.r === nr && pw.c === nc) ? 5 : 0;
          const rivalHit = state.players.some((r) => r.id !== p.id && r.invulnTimer <= 0 && r.r === nr && r.c === nc) ? 8 : 0;
          const dirBias = dr * Math.sign(my || 0) + dc * Math.sign(mx || 0);
          const sc = pawnHit + rivalHit + dirBias + Math.random() * 0.5;
          if (sc > bestScore) {
            bestScore = sc;
            best = [dr, dc];
          }
        }
        p.r = clamp(p.r + best[0], 0, state.size - 1);
        p.c = clamp(p.c + best[1], 0, state.size - 1);
        struckThisTick = true;
        sounds.push({ type: 'dash', playerId: p.id });
      } else if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 2.0;
        const dr = Math.abs(my) > 0.25 ? Math.sign(my) * 2 : 0;
        const dc = Math.abs(mx) > 0.25 ? Math.sign(mx) * 2 : dr === 0 ? 2 : 0;
        p.r = clamp(p.r + dr, 0, state.size - 1);
        p.c = clamp(p.c + dc, 0, state.size - 1);
        struckThisTick = true;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      for (let i = state.pawns.length - 1; i >= 0; i--) {
        const pw = state.pawns[i];
        if (pw.r === p.r && pw.c === p.c) {
          const pts = (pw.gold ? 110 : 60) * mult;
          p.captures += 1;
          p.score += pts;
          state.pawns.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
      if (struckThisTick) {
        for (const r of state.players) {
          if (r.id !== p.id && r.invulnTimer <= 0 && r.r === p.r && r.c === p.c) {
            p.captures += 1;
            p.score += 130 * mult;
            r.invulnTimer = 1.25;
            r.r = p.r < state.size / 2 ? state.size - 1 : 0;
            r.c = p.c < state.size / 2 ? state.size - 1 : 0;
            state.banner = `${p.name} KNIGHT-CHECKED ${r.name}!`;
            sounds.push({ type: 'hit', playerId: p.id });
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'chess-blitz',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      size: state.size,
      pawns: state.pawns,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: p.r,
        c: p.c,
        captures: p.captures,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.65, 0, 1),
        cooldownB: clamp(p.cdB / 2.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.captures} captures · ${p.score} pts`);
  },
};

// ============================================================================
// 3. DOMINO CHAIN (Domino Blitz)
// ============================================================================
function randomTile(): [number, number] {
  return [Math.floor(Math.random() * 7), Math.floor(Math.random() * 7)];
}

interface DominoState {
  timeLeft: number;
  totalTime: number;
  leftEnd: number;
  rightEnd: number;
  chain: { a: number; b: number; ownerColor: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    tiles: [number, number][];
    cursorIdx: number;
    stepCooldown: number;
    played: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const dominoChainModule: CompactGameModule<DominoState, DominoChainSnapshot> = {
  id: 'domino-chain',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      leftEnd: 4,
      rightEnd: 4,
      chain: [{ a: 4, b: 4, ownerColor: '#FACC15' }],
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        tiles: [randomTile(), randomTile(), randomTile(), randomTile(), [4, Math.floor(Math.random() * 7)]],
        cursorIdx: 4,
        stepCooldown: 0,
        played: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'CONNECT MATCHING PIPS TO EXTEND THE DOMINO CHAIN!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.stepCooldown = Math.max(0, p.stepCooldown - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCooldown <= 0 && Math.abs(mx) > 0.35) {
        p.cursorIdx = (p.cursorIdx + Math.sign(mx) + p.tiles.length) % p.tiles.length;
        p.stepCooldown = 0.16;
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const tile = p.tiles[p.cursorIdx];
        const fitsLeft = tile[0] === state.leftEnd || tile[1] === state.leftEnd;
        const fitsRight = tile[0] === state.rightEnd || tile[1] === state.rightEnd;
        if (fitsLeft || fitsRight) {
          p.cdA = 0.4;
          if (fitsRight) {
            const newEnd = tile[0] === state.rightEnd ? tile[1] : tile[0];
            state.chain.push({ a: state.rightEnd, b: newEnd, ownerColor: p.colorHex });
            state.rightEnd = newEnd;
          } else {
            const newEnd = tile[0] === state.leftEnd ? tile[1] : tile[0];
            state.chain.unshift({ a: newEnd, b: state.leftEnd, ownerColor: p.colorHex });
            state.leftEnd = newEnd;
          }
          if (state.chain.length > 11) state.chain.shift();
          const isDouble = tile[0] === tile[1];
          const pts = (isDouble ? 110 : 65) * mult;
          p.played += 1;
          p.score += pts;
          p.tiles[p.cursorIdx] = randomTile();
          state.banner = `${p.name} SNAPPED [${tile[0]}|${tile[1]}] (+${pts})`;
          sounds.push({ type: 'score', playerId: p.id });
        } else {
          sounds.push({ type: 'tick' });
        }
      } else if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 0.7;
        p.tiles[p.cursorIdx] = [Math.random() < 0.5 ? state.leftEnd : state.rightEnd, Math.floor(Math.random() * 7)];
        sounds.push({ type: 'card', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'domino-chain',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      leftEnd: state.leftEnd,
      rightEnd: state.rightEnd,
      chain: state.chain,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        tiles: p.tiles,
        cursorIdx: p.cursorIdx,
        played: p.played,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.4, 0, 1),
        cooldownB: clamp(p.cdB / 0.7, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.played} tiles · ${p.score} pts`);
  },
};

// ============================================================================
// 4. HEXAGON CONQUEST (Hex Territory)
// ============================================================================
interface HexConquestState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  owners: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    stepCooldown: number;
    hexes: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const hexagonConquestModule: CompactGameModule<HexConquestState, HexagonConquestSnapshot> = {
  id: 'hexagon-conquest',
  init({ players, settingValue }) {
    const cols = 8;
    const rows = 5;
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      cols,
      rows,
      owners: new Array(cols * rows).fill(-1),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: i % rows,
        c: (i * 2) % cols,
        stepCooldown: 0,
        hexes: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'CLAIM HONEYCOMB TILES (A) & CONVERT RIVALS (B)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.stepCooldown = Math.max(0, p.stepCooldown - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCooldown <= 0 && (Math.abs(mx) > 0.36 || Math.abs(my) > 0.36)) {
        if (Math.abs(mx) >= Math.abs(my)) p.c = clamp(p.c + Math.sign(mx), 0, state.cols - 1);
        else p.r = clamp(p.r + Math.sign(my), 0, state.rows - 1);
        p.stepCooldown = 0.14;
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.cdA = frenzy ? 0.25 : 0.42;
        state.owners[p.r * state.cols + p.c] = p.slotIndex;
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nr = p.r + dr;
          const nc = p.c + dc;
          if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols && state.owners[nr * state.cols + nc] === -1) {
            state.owners[nr * state.cols + nc] = p.slotIndex;
          }
        }
        sounds.push({ type: 'score', playerId: p.id });
      } else if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 2.2;
        const rad = frenzy ? 2 : 1;
        for (let dr = -rad; dr <= rad; dr++) {
          for (let dc = -rad; dc <= rad; dc++) {
            const nr = p.r + dr;
            const nc = p.c + dc;
            if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
              state.owners[nr * state.cols + nc] = p.slotIndex;
            }
          }
        }
        sounds.push({ type: 'hit', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    for (const p of state.players) {
      let cnt = 0;
      for (const o of state.owners) if (o === p.slotIndex) cnt++;
      p.hexes = cnt;
      p.score = cnt * 25 * mult;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'hexagon-conquest',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: state.cols,
      rows: state.rows,
      owners: state.owners,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: p.r,
        c: p.c,
        hexes: p.hexes,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.42, 0, 1),
        cooldownB: clamp(p.cdB / 2.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.hexes} hexes · ${p.score} pts`);
  },
};

// ============================================================================
// 5. BACKGAMMON SPRINT (Dice Backgammon)
// ============================================================================
interface BackgammonState {
  timeLeft: number;
  totalTime: number;
  trackLen: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    pips: number[];
    cursorPip: number;
    stepCooldown: number;
    lastRoll: [number, number];
    borneOff: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const backgammonSprintModule: CompactGameModule<BackgammonState, BackgammonSprintSnapshot> = {
  id: 'backgammon-sprint',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      trackLen: 24,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        pips: [0, 3, 6],
        cursorPip: 0,
        stepCooldown: 0,
        lastRoll: [3, 4],
        borneOff: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'PICK A RUNNER & ROLL DICE (A) TO RACE PAST POINT 24!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.stepCooldown = Math.max(0, p.stepCooldown - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCooldown <= 0 && Math.abs(mx) > 0.35) {
        p.cursorPip = (p.cursorPip + Math.sign(mx) + p.pips.length) % p.pips.length;
        p.stepCooldown = 0.16;
      }

      if ((aDown && !p.prevA && p.cdA <= 0) || (bDown && !p.prevB && p.cdB <= 0)) {
        const isLucky = bDown && !p.prevB && p.cdB <= 0;
        if (isLucky) p.cdB = 2.6;
        else p.cdA = frenzy ? 0.45 : 0.75;

        const d1 = isLucky ? 4 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 6);
        const d2 = isLucky ? d1 : 1 + Math.floor(Math.random() * 6);
        p.lastRoll = [d1, d2];
        const move = Math.max(d1, d2);
        p.pips[p.cursorPip] += move;
        p.score += move * 8 * mult;
        sounds.push({ type: 'tick', playerId: p.id });

        // Blot bump check
        const dest = p.pips[p.cursorPip];
        for (const r of state.players) {
          if (r.id === p.id) continue;
          const idx = r.pips.findIndex((rp) => rp === dest);
          if (idx >= 0) {
            r.pips[idx] = Math.max(0, r.pips[idx] - 3);
            p.score += 75 * mult;
            state.banner = `${p.name} BLOT-BUMPED ${r.name}! +${75 * mult}`;
            sounds.push({ type: 'hit', playerId: p.id });
          }
        }

        if (p.pips[p.cursorPip] >= state.trackLen) {
          p.borneOff += 1;
          p.score += 140 * mult;
          p.pips[p.cursorPip] = 0;
          state.banner = `${p.name} BORE OFF A CHECKER! +${140 * mult}`;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'backgammon-sprint',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      trackLen: state.trackLen,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        pips: p.pips,
        cursorPip: p.cursorPip,
        lastRoll: p.lastRoll,
        borneOff: p.borneOff,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.75, 0, 1),
        cooldownB: clamp(p.cdB / 2.6, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.borneOff} borne off · ${p.score} pts`);
  },
};

// ============================================================================
// 6. MANCALA JEWELS (Gem Pit Mancala)
// ============================================================================
interface MancalaState {
  timeLeft: number;
  totalTime: number;
  pits: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorPit: number;
    stepCooldown: number;
    store: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const mancalaJewelsModule: CompactGameModule<MancalaState, MancalaJewelsSnapshot> = {
  id: 'mancala-jewels',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      pits: new Array(12).fill(4),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorPit: (i * 3) % 12,
        stepCooldown: 0,
        store: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'SCOOP GLOWING PITS (A) TO SOW & CAPTURE OPPOSITE GEMS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.stepCooldown = Math.max(0, p.stepCooldown - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCooldown <= 0 && Math.abs(mx) > 0.35) {
        p.cursorPit = (p.cursorPit + Math.sign(mx) + 12) % 12;
        p.stepCooldown = 0.14;
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const gems = state.pits[p.cursorPit];
        if (gems > 0) {
          p.cdA = 0.55;
          state.pits[p.cursorPit] = 0;
          let idx = p.cursorPit;
          for (let g = 0; g < gems; g++) {
            idx = (idx + 1) % 12;
            state.pits[idx] += 1;
          }
          const opp = (11 - idx) % 12;
          const cap = state.pits[idx] === 1 || state.pits[idx] === 3 ? state.pits[opp] : 0;
          if (cap > 0) {
            state.pits[opp] = 0;
            const gained = cap * 3 + 1;
            p.store += gained;
            p.score += gained * 18 * mult;
            state.banner = `${p.name} CAPTURED +${cap} OPPOSITE GEMS!`;
            sounds.push({ type: 'score', playerId: p.id });
          } else {
            p.store += 1;
            p.score += gems * 10 * mult;
            sounds.push({ type: 'tick', playerId: p.id });
          }
        }
      } else if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 3.2;
        state.pits = state.pits.map((v) => v + 2);
        state.banner = `${p.name} SUMMONED A GEM SHOWER!`;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    if (state.pits.every((v) => v === 0)) {
      state.pits = state.pits.map(() => 4);
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'mancala-jewels',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      pits: state.pits,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorPit: p.cursorPit,
        store: p.store,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.55, 0, 1),
        cooldownB: clamp(p.cdB / 3.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.store} gems · ${p.score} pts`);
  },
};

// ============================================================================
// 7. CURLING MASTERS (Tabletop Curling)
// ============================================================================
interface CurlingState {
  timeLeft: number;
  totalTime: number;
  houseX: number;
  houseY: number;
  houseR: number;
  stones: { id: string; x: number; y: number; vx: number; vy: number; ownerId: string; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    aimX: number;
    power: number;
    powerDir: number;
    charging: boolean;
    sweepTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const curlingMastersModule: CompactGameModule<CurlingState, CurlingMastersSnapshot> = {
  id: 'curling-masters',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      houseX: ARENA_WIDTH / 2,
      houseY: 225,
      houseR: 135,
      stones: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: ARENA_WIDTH / 2 + ((i % 4) - 1.5) * 90,
        power: 0.5,
        powerDir: 1,
        charging: false,
        sweepTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevB: false,
      })),
      banner: 'HOLD A TO CHARGE GRANITE STONE — SWEEP (B) INTO THE GOLD BUTTON!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.sweepTimer = Math.max(0, p.sweepTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.aimX = clamp(p.aimX + mx * 360 * dt, 260, ARENA_WIDTH - 260);
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.sweepTimer = 0.5;
        p.cdB = 0.4;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      p.prevB = bDown;

      if (aDown && p.cdA <= 0) {
        p.charging = true;
        p.power += p.powerDir * dt * 1.15;
        if (p.power >= 1) {
          p.power = 1;
          p.powerDir = -1;
        } else if (p.power <= 0.15) {
          p.power = 0.15;
          p.powerDir = 1;
        }
      } else if (!aDown && p.charging) {
        p.charging = false;
        p.cdA = 1.1;
        const speed = 330 + p.power * 310;
        state.stones.push({
          id: `st-${Math.random().toString(36).slice(2, 7)}`,
          x: p.aimX,
          y: 625,
          vx: 0,
          vy: -speed,
          ownerId: p.id,
          colorHex: p.colorHex,
        });
        if (state.stones.length > 14) state.stones.shift();
        sounds.push({ type: 'shoot', playerId: p.id });
      }
    }

    // Stone collisions & ice friction
    for (let i = 0; i < state.stones.length; i++) {
      const a = state.stones[i];
      for (let j = i + 1; j < state.stones.length; j++) {
        const b = state.stones[j];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d > 0 && d < 36) {
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          const ov = 36 - d;
          a.x -= nx * ov * 0.5;
          a.y -= ny * ov * 0.5;
          b.x += nx * ov * 0.5;
          b.y += ny * ov * 0.5;
          const dot = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
          if (dot > 0) {
            a.vx -= dot * nx * 0.9;
            a.vy -= dot * ny * 0.9;
            b.vx += dot * nx * 0.9;
            b.vy += dot * ny * 0.9;
            sounds.push({ type: 'hit' });
          }
        }
      }
    }

    for (const s of state.stones) {
      const owner = state.players.find((pl) => pl.id === s.ownerId);
      const sweeping = owner && owner.sweepTimer > 0;
      s.x = clamp(s.x + s.vx * dt, 220, ARENA_WIDTH - 220);
      s.y = clamp(s.y + s.vy * dt, 100, ARENA_HEIGHT - 60);
      const fr = Math.pow(sweeping || frenzy ? 0.62 : 0.36, dt);
      s.vx *= fr;
      s.vy *= fr;
      if (Math.hypot(s.vx, s.vy) < 8) {
        s.vx = 0;
        s.vy = 0;
      }
    }

    // Continuous House scoring tick
    for (const p of state.players) {
      let rate = 0;
      for (const s of state.stones) {
        if (s.ownerId !== p.id) continue;
        const d = Math.hypot(s.x - state.houseX, s.y - state.houseY);
        if (d < 36) rate += 35;
        else if (d < state.houseR) rate += 15;
      }
      p.score += rate * mult * dt;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'curling-masters',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      houseX: state.houseX,
      houseY: state.houseY,
      houseR: state.houseR,
      stones: state.stones.map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        ownerId: s.ownerId,
        colorHex: s.colorHex,
      })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: p.aimX,
        power: p.power,
        charging: p.charging,
        sweeping: p.sweepTimer > 0,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.1, 0, 1),
        cooldownB: clamp(p.cdB / 0.4, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} curl pts`);
  },
};

// ============================================================================
// 8. RUMMY ROYALE (Gin Rummy Rush — Pad 4 Card)
// ============================================================================
interface RummyCard {
  id: string;
  rank: PlayingCardRank;
  suit: LiarSuit;
  selected: boolean;
}

interface RummyState {
  timeLeft: number;
  totalTime: number;
  round: number;
  melds: { ownerName: string; colorHex: string; label: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    hand: RummyCard[];
    meldsCount: number;
    score: number;
  }[];
  banner: string | null;
}

function drawRummyCard(): RummyCard {
  const ranks: PlayingCardRank[] = ['5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  return {
    id: `rm_${Math.random().toString(36).slice(2, 8)}`,
    rank: ranks[Math.floor(Math.random() * ranks.length)],
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
    selected: false,
  };
}

function isValidMeld(cards: RummyCard[]): boolean {
  if (cards.length < 3) return false;
  const allSameRank = cards.every((c) => c.rank === cards[0].rank);
  if (allSameRank) return true;
  const allSameSuit = cards.every((c) => c.suit === cards[0].suit);
  if (allSameSuit) {
    const nums = cards.map((c) => rankNumeric(c.rank)).sort((a, b) => a - b);
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] !== nums[i - 1] + 1) return false;
    }
    return true;
  }
  return false;
}

export const rummyRoyaleModule: CompactGameModule<RummyState, RummyRoyaleSnapshot> = {
  id: 'rummy-royale',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      round: 1,
      melds: [],
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 3 + Math.random() * 3,
        hand: Array.from({ length: 7 }, () => drawRummyCard()),
        meldsCount: 0,
        score: 0,
      })),
      banner: 'SELECT 3-OF-A-KIND OR 3-CARD RUNS ON YOUR PHONE & TAP MELD!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      if (!p.isBot) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        p.botTimer = 3.2 + Math.random() * 2.5;
        // Check if bot already holds a meld
        let melded = false;
        for (let i = 0; i < p.hand.length && !melded; i++) {
          for (let j = i + 1; j < p.hand.length && !melded; j++) {
            for (let k = j + 1; k < p.hand.length && !melded; k++) {
              const trio = [p.hand[i], p.hand[j], p.hand[k]];
              if (isValidMeld(trio)) {
                melded = true;
                p.hand = p.hand.filter((_, idx) => idx !== i && idx !== j && idx !== k);
                while (p.hand.length < 7) p.hand.push(drawRummyCard());
                p.meldsCount += 1;
                p.score += 150 * mult;
                state.melds.unshift({
                  ownerName: p.name,
                  colorHex: p.colorHex,
                  label: trio.map((c) => c.rank).join('-'),
                });
                if (state.melds.length > 6) state.melds.pop();
                sounds.push({ type: 'score', playerId: p.id });
              }
            }
          }
        }
        if (!melded) {
          p.hand[0] = drawRummyCard();
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const selCount = p.hand.filter((c) => c.selected).length;
      out[p.id] = {
        gameId: 'rummy-royale',
        playerId: p.id,
        hand: p.hand.map((c) => ({
          id: c.id,
          kind: 'liar',
          rank: c.rank,
          suit: c.suit,
          playable: true,
          selected: c.selected,
        })),
        cursorIndex: 0,
        isMyTurn: true,
        isActionRequired: true,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        selectedCount: selCount,
        primaryBtn: {
          label: 'MELD 3+',
          labelZh: '亮牌凑组',
          action: { type: 'submit-selected' },
          colorHex: '#10D98B',
          textColor: '#071710',
          disabled: selCount < 3,
        },
        secondaryBtn: {
          label: 'SWAP 1',
          labelZh: '换新牌',
          action: { type: 'draw-or-pass' },
          colorHex: '#FFB800',
          textColor: '#14120B',
        },
        statusHint: 'Tap 3 matching ranks OR 3-card suited sequence, then tap MELD 3+!',
        statusHintZh: '点选 3 张同点（三条）或同花顺后点击「亮牌凑组」！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return { sounds };
    if (action.type === 'toggle-card' || action.type === 'play-card') {
      const card = p.hand.find((c) => c.id === action.cardId);
      if (card) card.selected = !card.selected;
    } else if (action.type === 'submit-selected') {
      const picked = p.hand.filter((c) => c.selected);
      if (isValidMeld(picked)) {
        const mult = isStateFrenzyActive(state) ? 2 : 1;
        const pts = 150 * mult;
        p.hand = p.hand.filter((c) => !c.selected);
        while (p.hand.length < 7) p.hand.push(drawRummyCard());
        p.meldsCount += 1;
        p.score += pts;
        state.melds.unshift({
          ownerName: p.name,
          colorHex: p.colorHex,
          label: picked.map((c) => c.rank).join('-'),
        });
        if (state.melds.length > 6) state.melds.pop();
        state.banner = `${p.name} LAID A MELD (+${pts})!`;
        sounds.push({ type: 'score', playerId: p.id });
      } else {
        p.hand.forEach((c) => (c.selected = false));
        sounds.push({ type: 'hit' });
      }
    } else if (action.type === 'draw-or-pass') {
      const idx = Math.max(0, p.hand.findIndex((c) => c.selected));
      p.hand[idx] = drawRummyCard();
      sounds.push({ type: 'card', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'rummy-royale',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      melds: state.melds,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        handCount: p.hand.length,
        meldsCount: p.meldsCount,
        score: p.score,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.meldsCount} melds · ${p.score} pts`);
  },
};

// ============================================================================
// 9 & 10. TRICK-TAKING ENGINE (Hearts Breaker & Spades Bidding)
// ============================================================================
interface TrickGameState {
  gameId: 'hearts-breaker' | 'spades-bidding';
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  pauseTimer: number;
  trick: { playerId: string; playerName: string; colorHex: string; rank: PlayingCardRank; suit: LiarSuit }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    hand: { id: string; rank: PlayingCardRank; suit: LiarSuit }[];
    picked: boolean;
    tricksWon: number;
    specialCount: number;
    score: number;
  }[];
  banner: string | null;
}

function dealHands(playersCount: number) {
  const deck = makeCardDeck();
  const hands: { id: string; rank: PlayingCardRank; suit: LiarSuit }[][] = Array.from({ length: playersCount }, () => []);
  for (let i = 0; i < playersCount * 6; i++) {
    hands[i % playersCount].push(deck[i]);
  }
  return hands;
}

function createTrickModule(gameId: 'hearts-breaker' | 'spades-bidding'): CompactGameModule<TrickGameState, HeartsBreakerSnapshot | SpadesBiddingSnapshot> {
  return {
    id: gameId,
    init({ players, settingValue }) {
      const maxRounds = settingValue || 6;
      const hands = dealHands(Math.max(1, players.length));
      return {
        gameId,
        timeLeft: 14,
        totalTime: 14,
        round: 1,
        maxRounds,
        pauseTimer: 0,
        trick: [],
        players: players.map((p, i) => ({
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          isBot: !!p.isBot,
          botTimer: 1.6 + Math.random() * 2.2,
          hand: hands[i] ?? [],
          picked: false,
          tricksWon: 0,
          specialCount: 0,
          score: 0,
        })),
        banner: gameId === 'hearts-breaker' ? 'PLAY A TRICK CARD — DODGE HEARTS & Q♠!' : 'SPADES TRUMP ALL — WIN HIGH TRICKS!',
      };
    },
    step(state, players, dt, frenzy) {
      const sounds: CompactSoundEvent[] = [];
      const mult = frenzy ? 2 : 1;

      if (state.pauseTimer > 0) {
        state.pauseTimer -= dt;
        if (state.pauseTimer <= 0) {
          if (state.round >= state.maxRounds) return { finished: true, sounds };
          state.round += 1;
          state.timeLeft = 14;
          state.trick = [];
          state.players.forEach((p) => {
            p.picked = false;
            p.botTimer = 1.4 + Math.random() * 2.0;
            if (p.hand.length === 0) p.hand = makeCardDeck().slice(0, 6);
          });
          state.banner = `TRICK ${state.round}/${state.maxRounds} — PICK YOUR CARD!`;
        }
        return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
      }

      state.timeLeft = Math.max(0, state.timeLeft - dt);

      for (const p of state.players) {
        if (!p.isBot || p.picked || p.hand.length === 0) continue;
        p.botTimer -= dt;
        if (p.botTimer <= 0) {
          const card = p.hand[Math.floor(Math.random() * p.hand.length)];
          p.hand = p.hand.filter((c) => c.id !== card.id);
          p.picked = true;
          state.trick.push({ playerId: p.id, playerName: p.name, colorHex: p.colorHex, rank: card.rank, suit: card.suit });
          sounds.push({ type: 'card', playerId: p.id });
        }
      }

      if (state.timeLeft <= 0) {
        for (const p of state.players) {
          if (!p.picked && p.hand.length > 0) {
            const card = p.hand.shift()!;
            p.picked = true;
            state.trick.push({ playerId: p.id, playerName: p.name, colorHex: p.colorHex, rank: card.rank, suit: card.suit });
          }
        }
      }

      if (state.players.every((p) => p.picked)) {
        // Resolve trick winner
        let bestEntry = state.trick[0];
        let bestVal = -1;
        for (const t of state.trick) {
          const isTrump = state.gameId === 'spades-bidding' && t.suit === 'spades';
          const v = rankNumeric(t.rank) + (isTrump ? 30 : 0);
          if (v > bestVal) {
            bestVal = v;
            bestEntry = t;
          }
        }
        const winner = state.players.find((p) => p.id === bestEntry?.playerId);
        if (winner) {
          winner.tricksWon += 1;
          if (state.gameId === 'hearts-breaker') {
            const penalty = state.trick.reduce(
              (acc, t) => acc + (t.suit === 'hearts' ? 25 : 0) + (t.suit === 'spades' && t.rank === 'Q' ? 120 : 0),
              0
            );
            winner.specialCount += state.trick.filter((t) => t.suit === 'hearts').length;
            const delta = (80 - penalty) * mult;
            winner.score = Math.max(0, winner.score + delta);
            state.banner = penalty > 0 ? `${winner.name} ATE ${penalty} HEART PENALTY!` : `${winner.name} SWEPT CLEAN TRICK +${80 * mult}!`;
          } else {
            const spades = state.trick.filter((t) => t.suit === 'spades').length;
            winner.specialCount += spades;
            const pts = (95 + spades * 20) * mult;
            winner.score += pts;
            state.banner = `${winner.name} WON THE TRICK! +${pts}`;
          }
          sounds.push({ type: 'score', playerId: winner.id });
        }
        state.pauseTimer = 2.1;
      }

      return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
    },
    getPrivateStates(state) {
      const out: Record<string, CardPrivateState> = {};
      for (const p of state.players) {
        out[p.id] = {
          gameId: state.gameId,
          playerId: p.id,
          hand: p.hand.map((c) => ({
            id: c.id,
            kind: 'liar',
            rank: c.rank,
            suit: c.suit,
            playable: !p.picked && state.pauseTimer <= 0,
            selected: false,
          })),
          cursorIndex: 0,
          isMyTurn: !p.picked && state.pauseTimer <= 0,
          isActionRequired: !p.picked && state.pauseTimer <= 0,
          turnTimeLeft: state.timeLeft,
          turnTotal: state.totalTime,
          primaryBtn: {
            label: 'PLAY CARD',
            labelZh: '出牌赢墩',
            action: { type: 'play-card' },
            colorHex: state.gameId === 'hearts-breaker' ? '#F43F5E' : '#38BDF8',
            textColor: '#FFFFFF',
            disabled: p.picked,
          },
          statusHint: p.picked ? 'Card locked — waiting for table reveal!' : 'Tap a card on your phone to play into the trick!',
          statusHintZh: p.picked ? '已出牌 — 等待牌桌亮牌！' : '在手机点击一张牌投入本轮牌墩！',
        };
      }
      return out;
    },
    handleCardAction(state, playerId, action) {
      const sounds: CompactSoundEvent[] = [];
      if (state.pauseTimer > 0) return { sounds };
      const p = state.players.find((x) => x.id === playerId);
      if (!p || p.picked || p.hand.length === 0) return { sounds };
      const card = (action.type === 'play-card' || action.type === 'toggle-card') && action.cardId
        ? p.hand.find((c) => c.id === action.cardId) ?? p.hand[0]
        : p.hand[0];
      p.hand = p.hand.filter((c) => c.id !== card.id);
      p.picked = true;
      state.trick.push({ playerId: p.id, playerName: p.name, colorHex: p.colorHex, rank: card.rank, suit: card.suit });
      sounds.push({ type: 'card', playerId: p.id });
      return { sounds };
    },
    snapshot(state) {
      if (state.gameId === 'hearts-breaker') {
        return {
          gameId: 'hearts-breaker',
          timeLeft: state.timeLeft,
          totalTime: state.totalTime,
          round: state.round,
          trick: state.trick,
          players: state.players.map((p) => ({
            id: p.id,
            slotIndex: p.slotIndex,
            name: p.name,
            colorHex: p.colorHex,
            tricksWon: p.tricksWon,
            heartsTaken: p.specialCount,
            score: p.score,
          })),
          banner: state.banner,
        };
      }
      return {
        gameId: 'spades-bidding',
        timeLeft: state.timeLeft,
        totalTime: state.totalTime,
        round: state.round,
        trick: state.trick,
        players: state.players.map((p) => ({
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          tricksWon: p.tricksWon,
          spadesPlayed: p.specialCount,
          score: p.score,
        })),
        banner: state.banner,
      };
    },
    buildResults(state) {
      return rankByScore(state.players, (p) => `${p.tricksWon} tricks · ${p.score} pts`);
    },
  };
}

export const heartsBreakerModule = createTrickModule('hearts-breaker');
export const spadesBiddingModule = createTrickModule('spades-bidding');

// ============================================================================
// 11. POKER SHOWDOWN (5-Card Poker Blitz — Pad 4 Card)
// ============================================================================
interface PokerState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'draw' | 'reveal';
  pauseTimer: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    hand: { id: string; rank: PlayingCardRank; suit: LiarSuit; selected: boolean }[];
    locked: boolean;
    swapped: boolean;
    handRankLabel: string | null;
    score: number;
  }[];
  banner: string | null;
}

function evalPokerHand(hand: { rank: PlayingCardRank; suit: LiarSuit }[]): { tier: number; label: string } {
  const counts: Record<string, number> = {};
  for (const c of hand) counts[c.rank] = (counts[c.rank] ?? 0) + 1;
  const freq = Object.values(counts).sort((a, b) => b - a);
  const flush = hand.length === 5 && hand.every((c) => c.suit === hand[0].suit);
  const nums = hand.map((c) => rankNumeric(c.rank)).sort((a, b) => a - b);
  const straight = nums.length === 5 && nums.every((v, i) => i === 0 || v === nums[i - 1] + 1);
  if (flush && straight) return { tier: 8, label: 'STRAIGHT FLUSH!' };
  if (freq[0] === 4) return { tier: 7, label: 'FOUR OF A KIND!' };
  if (freq[0] === 3 && freq[1] === 2) return { tier: 6, label: 'FULL HOUSE!' };
  if (flush) return { tier: 5, label: 'FLUSH!' };
  if (straight) return { tier: 4, label: 'STRAIGHT!' };
  if (freq[0] === 3) return { tier: 3, label: 'THREE OF A KIND' };
  if (freq[0] === 2 && freq[1] === 2) return { tier: 2, label: 'TWO PAIR' };
  if (freq[0] === 2) return { tier: 1, label: 'ONE PAIR' };
  return { tier: 0, label: 'HIGH CARD' };
}

export const pokerShowdownModule: CompactGameModule<PokerState, PokerShowdownSnapshot> = {
  id: 'poker-showdown',
  init({ players, settingValue }) {
    const maxRounds = settingValue || 4;
    return {
      timeLeft: 14,
      totalTime: 14,
      round: 1,
      maxRounds,
      phase: 'draw',
      pauseTimer: 0,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 2 + Math.random() * 2,
        hand: makeCardDeck().slice(0, 5).map((c) => ({ ...c, selected: false })),
        locked: false,
        swapped: false,
        handRankLabel: null,
        score: 0,
      })),
      banner: 'SELECT WEAK CARDS TO SWAP OR LOCK YOUR 5-CARD POKER HAND!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    const mult = frenzy ? 2 : 1;

    if (state.phase === 'reveal') {
      state.pauseTimer -= dt;
      if (state.pauseTimer <= 0) {
        if (state.round >= state.maxRounds) return { finished: true, sounds };
        state.round += 1;
        state.phase = 'draw';
        state.timeLeft = 14;
        state.players.forEach((p) => {
          p.hand = makeCardDeck().slice(0, 5).map((c) => ({ ...c, selected: false }));
          p.locked = false;
          p.swapped = false;
          p.handRankLabel = null;
          p.botTimer = 2 + Math.random() * 2;
        });
        state.banner = `HAND ${state.round}/${state.maxRounds} — DRAW OR LOCK!`;
      }
      return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
    }

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    for (const p of state.players) {
      if (!p.isBot || p.locked) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) p.locked = true;
    }

    if (state.timeLeft <= 0 || state.players.every((p) => p.locked)) {
      state.phase = 'reveal';
      state.pauseTimer = 3.0;
      let bestTier = -1;
      let winner: PokerState['players'][0] | null = null;
      for (const p of state.players) {
        const res = evalPokerHand(p.hand);
        p.handRankLabel = res.label;
        p.score += (30 + res.tier * 45) * mult;
        if (res.tier > bestTier) {
          bestTier = res.tier;
          winner = p;
        }
      }
      if (winner) {
        winner.score += 120 * mult;
        state.banner = `${winner.name} WINS THE POT WITH ${winner.handRankLabel}!`;
        sounds.push({ type: 'score', playerId: winner.id });
      }
    }

    return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const selCount = p.hand.filter((c) => c.selected).length;
      out[p.id] = {
        gameId: 'poker-showdown',
        playerId: p.id,
        hand: p.hand.map((c) => ({
          id: c.id,
          kind: 'liar',
          rank: c.rank,
          suit: c.suit,
          playable: state.phase === 'draw' && !p.locked,
          selected: c.selected,
        })),
        cursorIndex: 0,
        isMyTurn: state.phase === 'draw' && !p.locked,
        isActionRequired: state.phase === 'draw' && !p.locked,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        selectedCount: selCount,
        primaryBtn: {
          label: 'LOCK HAND',
          labelZh: '锁牌摊牌',
          action: { type: 'submit-selected' },
          colorHex: '#FACC15',
          textColor: '#14120B',
          disabled: p.locked || state.phase === 'reveal',
        },
        secondaryBtn: {
          label: 'SWAP SELECTED',
          labelZh: '换掉选中',
          action: { type: 'draw-or-pass' },
          colorHex: '#00C2FF',
          textColor: '#07131D',
          disabled: p.locked || p.swapped || selCount === 0,
        },
        statusHint: p.locked ? 'Locked! Waiting for TV Showdown...' : 'Tap weak cards to mark for Swap, or tap LOCK HAND!',
        statusHintZh: p.locked ? '已锁牌，等待大屏亮牌！' : '点选散牌换牌，或直接点击「锁牌摊牌」！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    if (state.phase !== 'draw') return { sounds };
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.locked) return { sounds };
    if ((action.type === 'toggle-card' || action.type === 'play-card') && action.cardId) {
      const c = p.hand.find((x) => x.id === action.cardId);
      if (c) c.selected = !c.selected;
    } else if (action.type === 'draw-or-pass' && !p.swapped) {
      p.swapped = true;
      const heldKeys = new Set(p.hand.map((c) => `${c.rank}_${c.suit}`));
      const fresh = makeCardDeck().filter((c) => !heldKeys.has(`${c.rank}_${c.suit}`));
      let idx = 0;
      p.hand = p.hand.map((c) => (c.selected && fresh[idx] ? { ...fresh[idx++], selected: false } : { ...c, selected: false }));
      sounds.push({ type: 'card', playerId: p.id });
    } else if (action.type === 'submit-selected') {
      p.locked = true;
      sounds.push({ type: 'tick', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'poker-showdown',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      phase: state.phase,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        locked: p.locked,
        handRankLabel: p.handRankLabel,
        revealedCards: state.phase === 'reveal' ? p.hand.map((c) => ({ rank: c.rank, suit: c.suit })) : [],
        score: p.score,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.score} chips`);
  },
};

// ============================================================================
// 12. TAROT ARCANA (Elemental Clash — Pad 4 Card)
// ============================================================================
type ElementType = 'FIRE' | 'NATURE' | 'FROST' | 'SUN';
interface TarotState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'pick' | 'clash';
  pauseTimer: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    hand: ElementType[];
    picked: ElementType | null;
    wins: number;
    score: number;
  }[];
  banner: string | null;
}

function elementBeats(a: ElementType, b: ElementType): boolean {
  if (a === 'SUN' && b !== 'SUN') return true;
  return (a === 'FIRE' && b === 'NATURE') || (a === 'NATURE' && b === 'FROST') || (a === 'FROST' && b === 'FIRE');
}

export const tarotArcanaModule: CompactGameModule<TarotState, TarotArcanaSnapshot> = {
  id: 'tarot-arcana',
  init({ players, settingValue }) {
    const maxRounds = settingValue || 5;
    return {
      timeLeft: 12,
      totalTime: 12,
      round: 1,
      maxRounds,
      phase: 'pick',
      pauseTimer: 0,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.5 + Math.random() * 2,
        hand: ['FIRE', 'NATURE', 'FROST', 'SUN'],
        picked: null,
        wins: 0,
        score: 0,
      })),
      banner: 'FIRE > NATURE > FROST > FIRE · PICK YOUR ELEMENT!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    const mult = frenzy ? 2 : 1;

    if (state.phase === 'clash') {
      state.pauseTimer -= dt;
      if (state.pauseTimer <= 0) {
        if (state.round >= state.maxRounds) return { finished: true, sounds };
        state.round += 1;
        state.phase = 'pick';
        state.timeLeft = 12;
        state.players.forEach((p) => {
          p.picked = null;
          p.botTimer = 1.4 + Math.random() * 2;
        });
        state.banner = `CLASH ${state.round}/${state.maxRounds} — CAST AN ELEMENT!`;
      }
      return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
    }

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    for (const p of state.players) {
      if (!p.isBot || p.picked) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        const pool: ElementType[] = ['FIRE', 'NATURE', 'FROST', 'SUN'];
        p.picked = pool[Math.floor(Math.random() * (Math.random() < 0.25 ? 4 : 3))];
      }
    }

    if (state.timeLeft <= 0 || state.players.every((p) => p.picked)) {
      for (const p of state.players) {
        if (!p.picked) p.picked = 'FIRE';
      }
      state.phase = 'clash';
      state.pauseTimer = 2.5;
      for (const a of state.players) {
        let roundWins = 0;
        for (const b of state.players) {
          if (a.id !== b.id && a.picked && b.picked && elementBeats(a.picked, b.picked)) {
            roundWins++;
          }
        }
        if (roundWins > 0 || state.players.length === 1) {
          a.wins += 1;
          a.score += (state.players.length === 1 ? 100 : roundWins * 110) * mult;
        }
      }
      sounds.push({ type: 'score' });
      state.banner = 'ELEMENTS REVEALED!';
    }

    return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const colors: Record<ElementType, string> = {
      FIRE: '#EF4444',
      NATURE: '#22C55E',
      FROST: '#38BDF8',
      SUN: '#FACC15',
    };
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = p.hand.map((el) => ({
        id: `el_${el}`,
        kind: 'party',
        title: el,
        subtitle: el === 'SUN' ? 'Wild Trump' : el === 'FIRE' ? 'Beats Nature' : el === 'NATURE' ? 'Beats Frost' : 'Beats Fire',
        badge: 'ARCANA',
        accentHex: colors[el],
        playable: state.phase === 'pick' && !p.picked,
        selected: p.picked === el,
      }));
      out[p.id] = {
        gameId: 'tarot-arcana',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: state.phase === 'pick' && !p.picked,
        isActionRequired: state.phase === 'pick' && !p.picked,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        statusHint: p.picked ? `Cast ${p.picked}! Waiting for Clash...` : 'Tap Fire, Nature, Frost, or Sun on your phone!',
        statusHintZh: p.picked ? `已锁定 ${p.picked}！等待结算...` : '在手机点击选择火、自然、冰或太阳元素！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    if (state.phase !== 'pick') return { sounds };
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.picked) return { sounds };
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId?.startsWith('el_')) {
      p.picked = action.cardId.slice(3) as ElementType;
      sounds.push({ type: 'card', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'tarot-arcana',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      phase: state.phase,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        picked: !!p.picked,
        element: state.phase === 'clash' ? p.picked : null,
        wins: p.wins,
        score: p.score,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.wins} clashes · ${p.score} pts`);
  },
};

// ============================================================================
// 13. BACCARAT CLUB (Royale Nine — Pad 4 Card)
// ============================================================================
interface BaccaratState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'pick' | 'reveal';
  pauseTimer: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    hand: { id: string; rank: PlayingCardRank; suit: LiarSuit; selected: boolean }[];
    locked: boolean;
    handTotal: number | null;
    wins: number;
    score: number;
  }[];
  banner: string | null;
}

function baccaratPoints(r: PlayingCardRank): number {
  if (r === 'A') return 1;
  if (['10', 'J', 'Q', 'K'].includes(r)) return 0;
  return Number(r) || 0;
}

export const baccaratClubModule: CompactGameModule<BaccaratState, BaccaratClubSnapshot> = {
  id: 'baccarat-club',
  init({ players, settingValue }) {
    const maxRounds = settingValue || 5;
    return {
      timeLeft: 14,
      totalTime: 14,
      round: 1,
      maxRounds,
      phase: 'pick',
      pauseTimer: 0,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.5 + Math.random() * 2,
        hand: makeCardDeck().slice(0, 4).map((c) => ({ ...c, selected: false })),
        locked: false,
        handTotal: null,
        wins: 0,
        score: 0,
      })),
      banner: 'PICK 2 CARDS CLOSEST TO NATURAL 9 (MOD 10)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    const mult = frenzy ? 2 : 1;

    if (state.phase === 'reveal') {
      state.pauseTimer -= dt;
      if (state.pauseTimer <= 0) {
        if (state.round >= state.maxRounds) return { finished: true, sounds };
        state.round += 1;
        state.phase = 'pick';
        state.timeLeft = 14;
        state.players.forEach((p) => {
          p.hand = makeCardDeck().slice(0, 4).map((c) => ({ ...c, selected: false }));
          p.locked = false;
          p.handTotal = null;
          p.botTimer = 1.5 + Math.random() * 2;
        });
        state.banner = `ROUND ${state.round}/${state.maxRounds} — FORM YOUR BEST 2-CARD PAIR!`;
      }
      return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
    }

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    for (const p of state.players) {
      if (!p.isBot || p.locked) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        // Pick optimal 2-card pair toward 9
        let bi = 0;
        let bj = 1;
        let best = -1;
        for (let i = 0; i < p.hand.length; i++) {
          for (let j = i + 1; j < p.hand.length; j++) {
            const val = (baccaratPoints(p.hand[i].rank) + baccaratPoints(p.hand[j].rank)) % 10;
            if (val > best) {
              best = val;
              bi = i;
              bj = j;
            }
          }
        }
        p.hand[bi].selected = true;
        p.hand[bj].selected = true;
        p.locked = true;
      }
    }

    if (state.timeLeft <= 0 || state.players.every((p) => p.locked)) {
      state.phase = 'reveal';
      state.pauseTimer = 2.6;
      let topVal = -1;
      let winner: BaccaratState['players'][0] | null = null;
      for (const p of state.players) {
        const picked = p.hand.filter((c) => c.selected).slice(0, 2);
        const pair = picked.length === 2 ? picked : p.hand.slice(0, 2);
        p.handTotal = (baccaratPoints(pair[0].rank) + baccaratPoints(pair[1].rank)) % 10;
        if (p.handTotal >= 8) p.score += 60 * mult;
        if (p.handTotal > topVal) {
          topVal = p.handTotal;
          winner = p;
        }
      }
      if (winner) {
        winner.wins += 1;
        winner.score += 130 * mult;
        state.banner = `${winner.name} SWEPT WITH ${winner.handTotal} (${winner.handTotal === 9 ? 'NATURAL 9!' : 'HIGH'})!`;
        sounds.push({ type: 'score', playerId: winner.id });
      }
    }

    return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const selCount = p.hand.filter((c) => c.selected).length;
      out[p.id] = {
        gameId: 'baccarat-club',
        playerId: p.id,
        hand: p.hand.map((c) => ({
          id: c.id,
          kind: 'liar',
          rank: c.rank,
          suit: c.suit,
          playable: state.phase === 'pick' && !p.locked,
          selected: c.selected,
        })),
        cursorIndex: 0,
        isMyTurn: state.phase === 'pick' && !p.locked,
        isActionRequired: state.phase === 'pick' && !p.locked,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        selectedCount: selCount,
        primaryBtn: {
          label: 'BET 2 CARDS',
          labelZh: '亮牌比点',
          action: { type: 'submit-selected' },
          colorHex: '#F59E0B',
          textColor: '#14120B',
          disabled: p.locked || selCount !== 2,
        },
        statusHint: 'Select exactly 2 cards whose mod-10 total gets closest to 9!',
        statusHintZh: '点选 2 张牌使总和个位数最接近 9！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    if (state.phase !== 'pick') return { sounds };
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.locked) return { sounds };
    if ((action.type === 'toggle-card' || action.type === 'play-card') && action.cardId) {
      const c = p.hand.find((x) => x.id === action.cardId);
      if (c) {
        if (!c.selected && p.hand.filter((x) => x.selected).length >= 2) {
          const first = p.hand.find((x) => x.selected);
          if (first) first.selected = false;
        }
        c.selected = !c.selected;
      }
    } else if (action.type === 'submit-selected' && p.hand.filter((x) => x.selected).length === 2) {
      p.locked = true;
      sounds.push({ type: 'card', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'baccarat-club',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      phase: state.phase,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        picked: p.locked,
        handTotal: p.handTotal,
        cardsShown: state.phase === 'reveal' ? p.hand.filter((c) => c.selected).slice(0, 2).map((c) => c.rank) : [],
        wins: p.wins,
        score: p.score,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.wins} wins · ${p.score} chips`);
  },
};

// ============================================================================
// 14. MEMORY PAIRS (Pair Flip Arena — Pad 4 Card Grid)
// ============================================================================
interface MemoryState {
  timeLeft: number;
  totalTime: number;
  cards: { id: string; symbol: string; colorHex: string; flipped: boolean; matchedByColor: string | null }[];
  openPicks: string[];
  seenSymbols: Record<string, string>;
  revealResetTimer: number;
  lastPickerId: string | null;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    pairs: number;
    streak: number;
    score: number;
  }[];
  banner: string | null;
}

function makeMemoryDeck() {
  const specs: [string, string][] = [
    ['★', '#FACC15'],
    ['♦', '#38BDF8'],
    ['♥', '#F43F5E'],
    ['⚡', '#A855F7'],
    ['🍀', '#22C55E'],
    ['👑', '#F97316'],
  ];
  const pairs = [...specs, ...specs].map(([symbol, colorHex], i) => ({
    id: `mp_${i}_${Math.random().toString(36).slice(2, 5)}`,
    symbol,
    colorHex,
    flipped: false,
    matchedByColor: null as string | null,
  }));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

export const memoryPairsModule: CompactGameModule<MemoryState, MemoryPairsSnapshot> = {
  id: 'memory-pairs',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      cards: makeMemoryDeck(),
      openPicks: [],
      seenSymbols: {},
      revealResetTimer: 0,
      lastPickerId: null,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.5 + Math.random() * 1.5,
        pairs: 0,
        streak: 0,
        score: 0,
      })),
      banner: 'FLIP MATCHING PAIRS ACROSS THE 12-CARD BOARD!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    if (state.revealResetTimer > 0) {
      state.revealResetTimer -= dt;
      if (state.revealResetTimer <= 0) {
        for (const c of state.cards) {
          if (!c.matchedByColor) c.flipped = false;
        }
        state.openPicks = [];
      }
      return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
    }

    for (const p of state.players) {
      if (!p.isBot) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0 && state.openPicks.length < 2) {
        p.botTimer = 1.4 + Math.random() * 1.4;
        const hidden = state.cards.filter((c) => !c.flipped && !c.matchedByColor);
        if (hidden.length > 0) {
          let pick = hidden[Math.floor(Math.random() * hidden.length)];
          if (state.openPicks.length === 1) {
            const firstCard = state.cards.find((c) => c.id === state.openPicks[0]);
            const knownMatch = firstCard
              ? hidden.find((c) => state.seenSymbols[c.id] === firstCard.symbol)
              : undefined;
            if (knownMatch && Math.random() < 0.78) pick = knownMatch;
          } else {
            // Look for two already-seen hidden matching cards
            const seenHidden = hidden.filter((c) => Boolean(state.seenSymbols[c.id]));
            for (const c of seenHidden) {
              const pair = seenHidden.find((other) => other.id !== c.id && state.seenSymbols[other.id] === state.seenSymbols[c.id]);
              if (pair && Math.random() < 0.7) {
                pick = c;
                break;
              }
            }
          }
          flipMemoryCard(state, p, pick.id, mult, sounds);
        }
      }
    }

    if (state.cards.every((c) => c.matchedByColor)) {
      state.cards = makeMemoryDeck();
      state.openPicks = [];
      state.seenSymbols = {};
      state.banner = 'BOARD CLEARED — FRESH 12 CARDS DEALT!';
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = state.cards.map((c, idx) => ({
        id: c.id,
        kind: 'party',
        title: c.flipped || c.matchedByColor ? c.symbol : `#${idx + 1}`,
        subtitle: c.matchedByColor ? 'MATCHED' : c.flipped ? 'OPEN' : 'HIDDEN',
        badge: 'FLIP',
        accentHex: c.matchedByColor ? c.matchedByColor : c.flipped ? c.colorHex : '#334155',
        playable: !c.flipped && !c.matchedByColor && state.revealResetTimer <= 0,
        selected: c.flipped && !c.matchedByColor,
      }));
      out[p.id] = {
        gameId: 'memory-pairs',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: state.revealResetTimer <= 0,
        isActionRequired: state.revealResetTimer <= 0,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        statusHint: 'Tap 2 cards to match symbols! Watch TV flips to steal pairs!',
        statusHintZh: '点翻两张同图案卡片得分，盯紧大屏记住别人翻出的位置！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    if (state.revealResetTimer > 0) return { sounds };
    const p = state.players.find((x) => x.id === playerId);
    if (!p || (action.type !== 'play-card' && action.type !== 'toggle-card') || !action.cardId) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    flipMemoryCard(state, p, action.cardId, mult, sounds);
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'memory-pairs',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cards: state.cards,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        pairs: p.pairs,
        streak: p.streak,
        score: p.score,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.pairs} pairs · ${p.score} pts`);
  },
};

function flipMemoryCard(
  state: MemoryState,
  p: MemoryState['players'][0],
  cardId: string,
  mult: number,
  sounds: CompactSoundEvent[]
) {
  const card = state.cards.find((c) => c.id === cardId);
  if (!card || card.flipped || card.matchedByColor || state.openPicks.length >= 2) return;
  card.flipped = true;
  state.seenSymbols[card.id] = card.symbol;
  state.openPicks.push(card.id);
  sounds.push({ type: 'card', playerId: p.id });

  if (state.openPicks.length === 2) {
    const c1 = state.cards.find((c) => c.id === state.openPicks[0]);
    const c2 = state.cards.find((c) => c.id === state.openPicks[1]);
    if (c1 && c2 && c1.symbol === c2.symbol) {
      c1.matchedByColor = p.colorHex;
      c2.matchedByColor = p.colorHex;
      p.pairs += 1;
      p.streak += 1;
      const pts = (100 + Math.min(3, p.streak - 1) * 35) * mult;
      p.score += pts;
      state.openPicks = [];
      state.banner = `${p.name} MATCHED ${c1.symbol} (+${pts})!`;
      sounds.push({ type: 'score', playerId: p.id });
    } else {
      p.streak = 0;
      state.revealResetTimer = 0.85;
    }
  }
}

// ============================================================================
// 15. SEQUENCE JACK (Jack Lineup — Pad 4 Card)
// ============================================================================
const SEQ_LABELS: PlayingCardRank[] = ['A', 'K', 'Q', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

interface SequenceState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  boardLabels: string[];
  owners: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    actionCd: number;
    hand: { id: string; rank: PlayingCardRank; suit: LiarSuit }[];
    chips: number;
    lines: number;
    score: number;
  }[];
  banner: string | null;
}

function drawSeqCard(): { id: string; rank: PlayingCardRank; suit: LiarSuit } {
  const pool: PlayingCardRank[] = [...SEQ_LABELS, 'J'];
  return {
    id: `sq_${Math.random().toString(36).slice(2, 8)}`,
    rank: pool[Math.floor(Math.random() * pool.length)],
    suit: SUITS[Math.floor(Math.random() * SUITS.length)],
  };
}

function count4Lines(owners: number[], cols: number, rows: number, slot: number): number {
  let total = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        let ok = true;
        for (let k = 0; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || owners[nr * cols + nc] !== slot) {
            ok = false;
            break;
          }
        }
        if (ok) total++;
      }
    }
  }
  return total;
}

export const sequenceJackModule: CompactGameModule<SequenceState, SequenceJackSnapshot> = {
  id: 'sequence-jack',
  init({ players, settingValue }) {
    const cols = 6;
    const rows = 4;
    const totalTime = settingValue || 90;
    const boardLabels = Array.from({ length: cols * rows }, (_, i) => SEQ_LABELS[i % SEQ_LABELS.length]);
    return {
      timeLeft: totalTime,
      totalTime,
      cols,
      rows,
      boardLabels,
      owners: new Array(cols * rows).fill(-1),
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 2.0 + Math.random() * 2.2,
        actionCd: 0,
        hand: Array.from({ length: 5 }, () => drawSeqCard()),
        chips: 0,
        lines: 0,
        score: 0,
      })),
      banner: 'PLAY CARDS TO CLAIM BOARD NUMBERS — JACKS ARE WILD!',
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
        p.botTimer = 2.0 + Math.random() * 2.0;
        const card = p.hand[Math.floor(Math.random() * p.hand.length)];
        if (card) playSeqCard(state, p, card.id, mult, sounds);
      }
    }

    if (state.owners.every((o) => o !== -1)) {
      state.owners.fill(-1);
      state.banner = 'FULL SEQUENCE BOARD — FRESH GRID RESET!';
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      out[p.id] = {
        gameId: 'sequence-jack',
        playerId: p.id,
        hand: p.hand.map((c) => ({
          id: c.id,
          kind: 'liar',
          rank: c.rank,
          suit: c.suit,
          playable: true,
          selected: false,
        })),
        cursorIndex: 0,
        isMyTurn: true,
        isActionRequired: true,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        secondaryBtn: {
          label: 'SWAP HAND',
          labelZh: '刷新手牌',
          action: { type: 'draw-or-pass' },
          colorHex: '#38BDF8',
          textColor: '#07131D',
        },
        statusHint: 'Tap any numbered card to claim a matching TV square (J = Wild Steal)!',
        statusHintZh: '点选任意手牌占领大屏对应数字格（J 为万能抢格王牌）！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.actionCd > 0) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId) {
      p.actionCd = 0.42;
      playSeqCard(state, p, action.cardId, mult, sounds);
    } else if (action.type === 'draw-or-pass') {
      p.actionCd = 0.65;
      p.hand = Array.from({ length: 5 }, () => drawSeqCard());
      sounds.push({ type: 'card', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'sequence-jack',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: state.cols,
      rows: state.rows,
      boardLabels: state.boardLabels,
      owners: state.owners,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        chips: p.chips,
        lines: p.lines,
        score: p.score,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.lines} sequences · ${p.score} pts`);
  },
};

function playSeqCard(
  state: SequenceState,
  p: SequenceState['players'][0],
  cardId: string,
  mult: number,
  sounds: CompactSoundEvent[]
) {
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return;
  const card = p.hand[idx];
  let targetIdx = -1;
  if (card.rank === 'J') {
    const open = state.owners.findIndex((o) => o !== p.slotIndex);
    targetIdx = open >= 0 ? open : -1;
  } else {
    targetIdx = state.boardLabels.findIndex((lbl, i) => lbl === card.rank && state.owners[i] === -1);
  }
  if (targetIdx >= 0) {
    state.owners[targetIdx] = p.slotIndex;
    p.chips += 1;
    const prevLines = p.lines;
    const newLines = count4Lines(state.owners, state.cols, state.rows, p.slotIndex);
    const lineBonus = Math.max(0, newLines - prevLines) * 250;
    p.lines = newLines;
    p.score += ((card.rank === 'J' ? 80 : 40) + lineBonus) * mult;
    state.banner = lineBonus > 0 ? `${p.name} COMPLETED A 4-IN-A-ROW SEQUENCE (+${250 * mult})!` : `${p.name} CLAIMED [${card.rank}]!`;
    sounds.push({ type: lineBonus > 0 ? 'score' : 'card', playerId: p.id });
  } else {
    p.score += 10 * mult;
    state.banner = `${p.name} RECYCLED DEAD [${card.rank}] (+${10 * mult})`;
    sounds.push({ type: 'tick', playerId: p.id });
  }
  p.hand[idx] = drawSeqCard();
}
