import type {
  RankingEntry,
  ReversiClashSnapshot,
  ReversiPlayerState,
  SoundEvent,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface ReversiClashState {
  turnCount: number;
  maxTurns: number;
  turnIndex: number;
  turnTimeLeft: number;
  cols: number;
  rows: number;
  grid: (string | null)[];
  colorGrid: (string | null)[];
  validMoves: { col: number; row: number; flips: number }[];
  lastPlaced: { col: number; row: number } | null;
  flippedCells: { col: number; row: number; colorHex: string; alpha: number }[];
  moveCooldowns: Record<string, number>;
  banner: string | null;
  eventText: string | null;
  players: ReversiPlayerState[];
  finished: boolean;
}

const SIZE = 8;
const TURN_TIMEOUT = 14;
const DIRS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],           [1, 0],
  [-1, 1],  [0, 1],  [1, 1],
];

function idxOf(col: number, row: number): number {
  return row * SIZE + col;
}

function getBracketFlips(grid: (string | null)[], col: number, row: number, playerId: string): { col: number; row: number }[] {
  if (grid[idxOf(col, row)] !== null) return [];
  const flips: { col: number; row: number }[] = [];
  for (const [dc, dr] of DIRS) {
    const line: { col: number; row: number }[] = [];
    let c = col + dc;
    let r = row + dr;
    while (c >= 0 && c < SIZE && r >= 0 && r < SIZE) {
      const owner = grid[idxOf(c, r)];
      if (owner === null) break;
      if (owner === playerId) {
        if (line.length > 0) flips.push(...line);
        break;
      }
      line.push({ col: c, row: r });
      c += dc;
      r += dr;
    }
  }
  return flips;
}

function computeValidMoves(grid: (string | null)[], playerId: string): { col: number; row: number; flips: number }[] {
  const valid: { col: number; row: number; flips: number }[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const flips = getBracketFlips(grid, c, r, playerId);
      if (flips.length > 0) {
        valid.push({ col: c, row: r, flips: flips.length });
      }
    }
  }
  if (valid.length === 0) {
    // Allow placing adjacent to any occupied cell so multi-player matches never stall
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[idxOf(c, r)] !== null) continue;
        const adj = DIRS.some(([dc, dr]) => {
          const nc = c + dc;
          const nr = r + dr;
          return nc >= 0 && nc < SIZE && nr >= 0 && nr < SIZE && grid[idxOf(nc, nr)] !== null;
        });
        if (adj) valid.push({ col: c, row: r, flips: 1 });
      }
    }
  }
  return valid;
}

function recountDiscs(state: ReversiClashState): number {
  let empty = 0;
  for (const p of state.players) {
    p.discCount = 0;
  }
  for (let i = 0; i < state.grid.length; i++) {
    const owner = state.grid[i];
    if (!owner) {
      empty++;
    } else {
      const pl = state.players.find((p) => p.id === owner);
      if (pl) pl.discCount++;
    }
  }
  for (const p of state.players) {
    p.score = p.discCount * 10 + p.flipsTotal * 2;
  }
  return empty;
}

export const reversiClashModule: ServerGameModule<ReversiClashState> = {
  id: 'reversi-clash',

  createState(players: ServerPlayerInputState[], settingValue: number): ReversiClashState {
    const maxTurns = settingValue || 36;
    const grid: (string | null)[] = Array(SIZE * SIZE).fill(null);
    const colorGrid: (string | null)[] = Array(SIZE * SIZE).fill(null);
    const moveCooldowns: Record<string, number> = {};

    const revPlayers: ReversiPlayerState[] = players.map((p) => {
      moveCooldowns[p.id] = 0;
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        isBot: p.isBot,
        cursorCol: 2,
        cursorRow: 3,
        discCount: 0,
        flipsTotal: 0,
        novaCharges: 1,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      };
    });

    const placeSeed = (col: number, row: number, p: ReversiPlayerState) => {
      grid[idxOf(col, row)] = p.id;
      colorGrid[idxOf(col, row)] = p.colorHex;
    };

    if (revPlayers.length >= 2) {
      placeSeed(3, 3, revPlayers[0]);
      placeSeed(4, 4, revPlayers[0]);
      placeSeed(3, 4, revPlayers[1]);
      placeSeed(4, 3, revPlayers[1]);
      if (revPlayers.length >= 3) {
        placeSeed(2, 3, revPlayers[2]);
        placeSeed(5, 4, revPlayers[2]);
      }
      if (revPlayers.length >= 4) {
        placeSeed(3, 2, revPlayers[3]);
        placeSeed(4, 5, revPlayers[3]);
      }
    } else if (revPlayers.length === 1) {
      placeSeed(3, 3, revPlayers[0]);
      placeSeed(4, 4, revPlayers[0]);
    }

    const first = revPlayers[0];
    const validMoves = first ? computeValidMoves(grid, first.id) : [];
    if (first && validMoves.length > 0) {
      first.cursorCol = validMoves[0].col;
      first.cursorRow = validMoves[0].row;
    }

    const state: ReversiClashState = {
      turnCount: 1,
      maxTurns,
      turnIndex: 0,
      turnTimeLeft: TURN_TIMEOUT,
      cols: SIZE,
      rows: SIZE,
      grid,
      colorGrid,
      validMoves,
      lastPlaced: null,
      flippedCells: [],
      moveCooldowns,
      banner: null,
      eventText: first ? `${first.name}'s Turn — Aim & Press A to Flip!` : null,
      players: revPlayers,
      finished: false,
    };
    recountDiscs(state);
    return state;
  },

  step(state: ReversiClashState, players: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (let i = state.flippedCells.length - 1; i >= 0; i--) {
      state.flippedCells[i].alpha -= dt * 1.4;
      if (state.flippedCells[i].alpha <= 0) state.flippedCells.splice(i, 1);
    }

    if (state.players.length === 0) state.finished = true;

    if (!state.finished) {
      const active = state.players[state.turnIndex];
      const inp = players.find((p) => p.id === active.id);
      state.moveCooldowns[active.id] = Math.max(0, (state.moveCooldowns[active.id] || 0) - dt);

      if (inp && state.moveCooldowns[active.id] <= 0) {
        const dx = Math.abs(inp.input.dx) > 0.4 ? Math.sign(inp.input.dx) : 0;
        const dy = Math.abs(inp.input.dy) > 0.4 ? Math.sign(inp.input.dy) : 0;
        if (dx !== 0 || dy !== 0) {
          active.cursorCol = Math.max(0, Math.min(SIZE - 1, active.cursorCol + dx));
          active.cursorRow = Math.max(0, Math.min(SIZE - 1, active.cursorRow + dy));
          state.moveCooldowns[active.id] = 0.16;
          sounds.push({ type: 'nav', playerId: active.id });
        }
      }

      state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);

      const nextPlayerTurn = () => {
        const empty = recountDiscs(state);
        state.turnCount++;
        if (empty === 0 || state.turnCount > state.maxTurns) {
          state.finished = true;
          state.banner = 'BOARD COMPLETE!';
          sounds.push({ type: 'win' });
          return;
        }
        state.turnIndex = (state.turnIndex + 1) % state.players.length;
        state.turnTimeLeft = TURN_TIMEOUT;
        const nextP = state.players[state.turnIndex];
        state.validMoves = computeValidMoves(state.grid, nextP.id);
        if (state.validMoves.length > 0) {
          nextP.cursorCol = state.validMoves[0].col;
          nextP.cursorRow = state.validMoves[0].row;
        }
      };

      // Action B: 3x3 Nova Flip Bomb
      if (justB && active.novaCharges > 0) {
        active.novaCharges--;
        const c = active.cursorCol;
        const r = active.cursorRow;
        state.grid[idxOf(c, r)] = active.id;
        state.colorGrid[idxOf(c, r)] = active.colorHex;
        state.lastPlaced = { col: c, row: r };
        let flippedCount = 0;
        for (const [dc, dr] of DIRS) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc >= 0 && nc < SIZE && nr >= 0 && nr < SIZE && state.grid[idxOf(nc, nr)] !== null) {
            state.grid[idxOf(nc, nr)] = active.id;
            state.colorGrid[idxOf(nc, nr)] = active.colorHex;
            state.flippedCells.push({ col: nc, row: nr, colorHex: active.colorHex, alpha: 1 });
            flippedCount++;
          }
        }
        active.flipsTotal += flippedCount;
        state.banner = `NOVA FLIP (${flippedCount})!`;
        state.eventText = `💥 ${active.name} detonated a 3x3 Nova Flip Bomb!`;
        sounds.push({ type: 'boost', playerId: active.id });
        haptics.push({ playerId: active.id, pattern: [35, 20, 50], reason: 'nova-flip' });
        nextPlayerTurn();
      } else if (justA || state.turnTimeLeft <= 0) {
        let targetCol = active.cursorCol;
        let targetRow = active.cursorRow;
        const isValid = state.validMoves.some((m) => m.col === targetCol && m.row === targetRow);

        if (!isValid && state.validMoves.length > 0) {
          // Pick valid move with highest flips if timeout, or nearest valid move if button pressed
          const best = [...state.validMoves].sort(
            (a, b) =>
              Math.hypot(a.col - targetCol, a.row - targetRow) -
              Math.hypot(b.col - targetCol, b.row - targetRow)
          )[0];
          targetCol = best.col;
          targetRow = best.row;
          active.cursorCol = targetCol;
          active.cursorRow = targetRow;
        }

        if (state.grid[idxOf(targetCol, targetRow)] === null) {
          const flips = getBracketFlips(state.grid, targetCol, targetRow, active.id);
          state.grid[idxOf(targetCol, targetRow)] = active.id;
          state.colorGrid[idxOf(targetCol, targetRow)] = active.colorHex;
          state.lastPlaced = { col: targetCol, row: targetRow };
          for (const f of flips) {
            state.grid[idxOf(f.col, f.row)] = active.id;
            state.colorGrid[idxOf(f.col, f.row)] = active.colorHex;
            state.flippedCells.push({ col: f.col, row: f.row, colorHex: active.colorHex, alpha: 1 });
          }
          active.flipsTotal += flips.length;
          state.banner = flips.length >= 3 ? `${flips.length}X CHAIN FLIP!` : null;
          state.eventText = `${active.name} placed at (${targetCol + 1},${targetRow + 1}) & flipped ${flips.length} disc${flips.length === 1 ? '' : 's'}!`;
          sounds.push({ type: 'confirm', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: 24, reason: 'reversi-place' });
        }
        nextPlayerTurn();
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const activePlayer = state.players[state.turnIndex];
    for (const p of state.players) {
      const isTurn = activePlayer && p.id === activePlayer.id && !state.finished;
      p.cooldownA = isTurn ? 0 : 1;
      p.cooldownB = isTurn && p.novaCharges > 0 ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: isTurn ? `YOUR TURN · ${p.discCount} Discs` : `${p.discCount} Discs · ${p.flipsTotal} Flips`,
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

  getSnapshot(state: ReversiClashState): ReversiClashSnapshot {
    return {
      gameId: 'reversi-clash',
      turnCount: Math.min(state.turnCount, state.maxTurns),
      maxTurns: state.maxTurns,
      activePlayerId: state.players[state.turnIndex]?.id ?? '',
      turnTimeLeft: state.turnTimeLeft,
      cols: state.cols,
      rows: state.rows,
      grid: [...state.grid],
      colorGrid: [...state.colorGrid],
      validMoves: state.validMoves,
      lastPlaced: state.lastPlaced,
      flippedCells: state.flippedCells,
      banner: state.banner,
      eventText: state.eventText,
      players: state.players.map((p) => ({ ...p })),
    };
  },

  getRankings(state: ReversiClashState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort((a, b) => b.discCount - a.discCount || b.score - a.score);
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: p.score,
      highlight: `${p.discCount} Discs Owned · ${p.flipsTotal} Flips`,
    }));
  },
};
