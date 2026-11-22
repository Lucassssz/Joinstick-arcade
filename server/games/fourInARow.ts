import type {
  FourInARowPlayerState,
  FourInARowSnapshot,
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

interface FourInARowState {
  targetConnects: number;
  turnIndex: number;
  turnTimeLeft: number;
  cols: number;
  rows: number;
  grid: (string | null)[];
  colorGrid: (string | null)[];
  winningCells: { col: number; row: number; colorHex: string }[];
  celebrateTimer: number;
  fallingToken: { col: number; row: number; currentY: number; colorHex: string } | null;
  moveCooldowns: Record<string, number>;
  banner: string | null;
  eventText: string | null;
  players: FourInARowPlayerState[];
  finished: boolean;
}

const COLS = 7;
const ROWS = 6;
const TURN_TIMEOUT = 13;

function idxOf(col: number, row: number): number {
  return row * COLS + col;
}

function findFourConnect(
  grid: (string | null)[],
  playerId: string,
  colorHex: string
): { col: number; row: number; colorHex: string }[] | null {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[idxOf(c, r)] !== playerId) continue;
      for (const [dc, dr] of dirs) {
        const line = [{ col: c, row: r, colorHex }];
        for (let s = 1; s < 4; s++) {
          const nc = c + dc * s;
          const nr = r + dr * s;
          if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && grid[idxOf(nc, nr)] === playerId) {
            line.push({ col: nc, row: nr, colorHex });
          } else {
            break;
          }
        }
        if (line.length >= 4) return line;
      }
    }
  }
  return null;
}

function applyColumnGravity(grid: (string | null)[], colorGrid: (string | null)[]): void {
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const owner = grid[idxOf(c, r)];
      if (owner !== null) {
        if (writeRow !== r) {
          grid[idxOf(c, writeRow)] = owner;
          colorGrid[idxOf(c, writeRow)] = colorGrid[idxOf(c, r)];
          grid[idxOf(c, r)] = null;
          colorGrid[idxOf(c, r)] = null;
        }
        writeRow--;
      }
    }
  }
}

export const fourInARowModule: ServerGameModule<FourInARowState> = {
  id: 'four-in-a-row',

  createState(players: ServerPlayerInputState[], settingValue: number): FourInARowState {
    const targetConnects = settingValue || 2;
    const moveCooldowns: Record<string, number> = {};
    const rackPlayers: FourInARowPlayerState[] = players.map((p) => {
      moveCooldowns[p.id] = 0;
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        isBot: p.isBot,
        hoverCol: 3,
        connects: 0,
        tokensPlaced: 0,
        anvilCharges: 1,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      };
    });

    return {
      targetConnects,
      turnIndex: 0,
      turnTimeLeft: TURN_TIMEOUT,
      cols: COLS,
      rows: ROWS,
      grid: Array(COLS * ROWS).fill(null),
      colorGrid: Array(COLS * ROWS).fill(null),
      winningCells: [],
      celebrateTimer: 0,
      fallingToken: null,
      moveCooldowns,
      banner: null,
      eventText: rackPlayers[0] ? `${rackPlayers[0].name}'s Turn — Aim Column & Press A to Drop!` : null,
      players: rackPlayers,
      finished: false,
    };
  },

  step(state: FourInARowState, players: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    if (state.fallingToken) {
      state.fallingToken.currentY = Math.min(
        state.fallingToken.row,
        state.fallingToken.currentY + dt * 18
      );
      if (state.fallingToken.currentY >= state.fallingToken.row) {
        state.fallingToken = null;
      }
    }

    if (state.players.length === 0) state.finished = true;

    const checkFlushAndAdvance = () => {
      const hasTopOpen = Array.from({ length: COLS }, (_, c) => state.grid[idxOf(c, 0)] === null).some(Boolean);
      if (!hasTopOpen) {
        for (let r = ROWS - 1; r > 0; r--) {
          for (let c = 0; c < COLS; c++) {
            state.grid[idxOf(c, r)] = state.grid[idxOf(c, r - 1)];
            state.colorGrid[idxOf(c, r)] = state.colorGrid[idxOf(c, r - 1)];
          }
        }
        for (let c = 0; c < COLS; c++) {
          state.grid[idxOf(c, 0)] = null;
          state.colorGrid[idxOf(c, 0)] = null;
        }
        state.banner = 'RACK SHIFTED DOWN!';
      }
      state.turnIndex = (state.turnIndex + 1) % state.players.length;
      state.turnTimeLeft = TURN_TIMEOUT;
    };

    // Brief celebration pause showing the blazing 4-in-a-row line before clearing & dropping discs
    if (state.celebrateTimer > 0 && !state.finished) {
      state.celebrateTimer -= dt;
      if (state.celebrateTimer <= 0) {
        for (const cell of state.winningCells) {
          state.grid[idxOf(cell.col, cell.row)] = null;
          state.colorGrid[idxOf(cell.col, cell.row)] = null;
        }
        applyColumnGravity(state.grid, state.colorGrid);
        state.winningCells = [];
        state.banner = null;
        checkFlushAndAdvance();
      }
    } else if (!state.finished) {
      const active = state.players[state.turnIndex];
      const inp = players.find((p) => p.id === active.id);
      state.moveCooldowns[active.id] = Math.max(0, (state.moveCooldowns[active.id] || 0) - dt);

      if (inp && state.moveCooldowns[active.id] <= 0 && Math.abs(inp.input.dx) > 0.38) {
        const dir = Math.sign(inp.input.dx);
        active.hoverCol = Math.max(0, Math.min(COLS - 1, active.hoverCol + dir));
        state.moveCooldowns[active.id] = 0.14;
        sounds.push({ type: 'nav', playerId: active.id });
      }

      state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);

      const findDropRow = (col: number) => {
        for (let r = ROWS - 1; r >= 0; r--) {
          if (state.grid[idxOf(col, r)] === null) return r;
        }
        return -1;
      };

      const resolvePlacement = () => {
        const line = findFourConnect(state.grid, active.id, active.colorHex);
        if (line) {
          state.winningCells = line;
          active.connects++;
          active.score += 150;
          state.banner = `${active.name} CONNECTED 4! (${active.connects}/${state.targetConnects})`;
          state.eventText = `⚡ ${active.name} scored a 4-IN-A-ROW Connect!`;
          sounds.push({ type: 'lap', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: [40, 25, 60], reason: 'c4-line' });
          if (active.connects >= state.targetConnects) {
            state.finished = true;
            sounds.push({ type: 'win', playerId: active.id });
          } else {
            state.celebrateTimer = 1.05;
          }
        } else {
          checkFlushAndAdvance();
        }
      };

      // Action B: Anvil Drop crushes the top token in the column and replaces it
      if (justB && active.anvilCharges > 0) {
        active.anvilCharges--;
        const col = active.hoverCol;
        let targetRow = ROWS - 1;
        for (let r = 0; r < ROWS; r++) {
          if (state.grid[idxOf(col, r)] !== null) {
            targetRow = r;
            break;
          }
        }
        state.grid[idxOf(col, targetRow)] = active.id;
        state.colorGrid[idxOf(col, targetRow)] = active.colorHex;
        state.fallingToken = { col, row: targetRow, currentY: -0.6, colorHex: active.colorHex };
        active.tokensPlaced++;
        active.score += 25;
        state.banner = 'ANVIL CRUSH!';
        state.eventText = `🔨 ${active.name} crushed Column ${col + 1} with an Anvil Token!`;
        sounds.push({ type: 'boost', playerId: active.id });
        haptics.push({ playerId: active.id, pattern: [35, 20, 45], reason: 'anvil-drop' });
        resolvePlacement();
      } else if (justA || state.turnTimeLeft <= 0) {
        let col = active.hoverCol;
        let dropRow = findDropRow(col);
        if (dropRow === -1) {
          for (let c = 0; c < COLS; c++) {
            const r = findDropRow(c);
            if (r !== -1) {
              col = c;
              dropRow = r;
              active.hoverCol = c;
              break;
            }
          }
        }
        if (dropRow !== -1) {
          state.grid[idxOf(col, dropRow)] = active.id;
          state.colorGrid[idxOf(col, dropRow)] = active.colorHex;
          state.fallingToken = { col, row: dropRow, currentY: -0.6, colorHex: active.colorHex };
          active.tokensPlaced++;
          active.score += 15;
          state.banner = null;
          state.eventText = `${active.name} dropped a token in Column ${col + 1}!`;
          sounds.push({ type: 'confirm', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: 22, reason: 'c4-drop' });
          resolvePlacement();
        } else {
          checkFlushAndAdvance();
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const activePlayer = state.players[state.turnIndex];
    for (const p of state.players) {
      const isTurn = activePlayer && p.id === activePlayer.id && !state.finished && state.celebrateTimer <= 0;
      p.cooldownA = isTurn ? 0 : 1;
      p.cooldownB = isTurn && p.anvilCharges > 0 ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: isTurn
          ? `YOUR TURN · Col ${p.hoverCol + 1} · ${p.connects}/${state.targetConnects}`
          : `${p.connects}/${state.targetConnects} Connects · ${p.score} pts`,
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

  getSnapshot(state: FourInARowState): FourInARowSnapshot {
    return {
      gameId: 'four-in-a-row',
      targetConnects: state.targetConnects,
      activePlayerId: state.players[state.turnIndex]?.id ?? '',
      turnTimeLeft: state.turnTimeLeft,
      cols: state.cols,
      rows: state.rows,
      grid: [...state.grid],
      colorGrid: [...state.colorGrid],
      winningCells: state.winningCells,
      fallingToken: state.fallingToken ? { ...state.fallingToken } : null,
      banner: state.banner,
      eventText: state.eventText,
      players: state.players.map((p) => ({ ...p })),
    };
  },

  getRankings(state: FourInARowState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort((a, b) => b.connects - a.connects || b.score - a.score);
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: p.score,
      highlight: `${p.connects} Connects · ${p.tokensPlaced} Tokens`,
    }));
  },
};
