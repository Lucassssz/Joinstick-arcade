import type {
  NavalCellState,
  NavalPlayerState,
  NavalSalvoSnapshot,
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

interface NavalSalvoState {
  round: number;
  totalRounds: number;
  turnIndex: number;
  turnTimeLeft: number;
  cols: number;
  rows: number;
  shipsRemaining: number;
  cells: NavalCellState[];
  explosions: { col: number; row: number; colorHex: string; alpha: number }[];
  moveCooldowns: Record<string, number>;
  banner: string | null;
  eventText: string | null;
  players: NavalPlayerState[];
  finished: boolean;
}

const COLS = 8;
const ROWS = 6;
const TURN_TIMEOUT = 13;

function idxOf(col: number, row: number): number {
  return row * COLS + col;
}

function generateFleetGrid(): { cells: NavalCellState[]; shipCount: number } {
  const cells: NavalCellState[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      cells.push({
        col: c,
        row: r,
        revealed: false,
        content: 'water',
        hitByColor: null,
        sonarHint: null,
      });
    }
  }

  let shipCount = 0;
  // Place horizontal & vertical ship segments + 3 golden flagships + 4 sea mines
  const shipLengths = [3, 3, 2, 2, 2];
  for (const len of shipLengths) {
    let placed = false;
    for (let attempt = 0; attempt < 30 && !placed; attempt++) {
      const horiz = Math.random() < 0.55;
      const maxC = horiz ? COLS - len : COLS - 1;
      const maxR = horiz ? ROWS - 1 : ROWS - len;
      const sc = Math.floor(Math.random() * (maxC + 1));
      const sr = Math.floor(Math.random() * (maxR + 1));
      let clear = true;
      for (let i = 0; i < len; i++) {
        const c = sc + (horiz ? i : 0);
        const r = sr + (horiz ? 0 : i);
        if (cells[idxOf(c, r)].content !== 'water') clear = false;
      }
      if (clear) {
        for (let i = 0; i < len; i++) {
          const c = sc + (horiz ? i : 0);
          const r = sr + (horiz ? 0 : i);
          cells[idxOf(c, r)].content = 'ship';
          shipCount++;
        }
        placed = true;
      }
    }
  }

  // Place 3 high-value Flagships
  let flagships = 0;
  while (flagships < 3) {
    const i = Math.floor(Math.random() * cells.length);
    if (cells[i].content === 'water') {
      cells[i].content = 'flagship';
      flagships++;
      shipCount++;
    }
  }

  // Place 4 Sea Mines
  let mines = 0;
  while (mines < 4) {
    const i = Math.floor(Math.random() * cells.length);
    if (cells[i].content === 'water') {
      cells[i].content = 'mine';
      mines++;
    }
  }

  return { cells, shipCount };
}

export const navalSalvoModule: ServerGameModule<NavalSalvoState> = {
  id: 'naval-salvo',

  createState(players: ServerPlayerInputState[], settingValue: number): NavalSalvoState {
    const totalRounds = settingValue || 10;
    const { cells, shipCount } = generateFleetGrid();
    const moveCooldowns: Record<string, number> = {};

    const navalPlayers: NavalPlayerState[] = players.map((p, idx) => {
      moveCooldowns[p.id] = 0;
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        isBot: p.isBot,
        cursorCol: (idx * 2 + 1) % COLS,
        cursorRow: (idx + 2) % ROWS,
        hits: 0,
        sunkShips: 0,
        sonarCharges: 2,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      };
    });

    return {
      round: 1,
      totalRounds,
      turnIndex: 0,
      turnTimeLeft: TURN_TIMEOUT,
      cols: COLS,
      rows: ROWS,
      shipsRemaining: shipCount,
      cells,
      explosions: [],
      moveCooldowns,
      banner: null,
      eventText: navalPlayers[0] ? `${navalPlayers[0].name}'s Turn — Aim & Press A to Fire Torpedo!` : null,
      players: navalPlayers,
      finished: false,
    };
  },

  step(state: NavalSalvoState, players: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (let i = state.explosions.length - 1; i >= 0; i--) {
      state.explosions[i].alpha -= dt * 1.35;
      if (state.explosions[i].alpha <= 0) state.explosions.splice(i, 1);
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
          active.cursorCol = Math.max(0, Math.min(COLS - 1, active.cursorCol + dx));
          active.cursorRow = Math.max(0, Math.min(ROWS - 1, active.cursorRow + dy));
          state.moveCooldowns[active.id] = 0.16;
          sounds.push({ type: 'nav', playerId: active.id });
        }
      }

      state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);

      const advanceTurn = () => {
        if (state.shipsRemaining <= 0) {
          state.finished = true;
          state.banner = 'ALL FLEETS SUNK!';
          sounds.push({ type: 'win' });
          return;
        }
        state.turnIndex = (state.turnIndex + 1) % state.players.length;
        if (state.turnIndex === 0) {
          state.round++;
          if (state.round > state.totalRounds) {
            state.finished = true;
            state.banner = 'SALVO OPERATION COMPLETE!';
            sounds.push({ type: 'win' });
            return;
          }
        }
        state.turnTimeLeft = TURN_TIMEOUT;
      };

      // Action B: 3x3 Sonar Ping Scan
      if (justB && active.sonarCharges > 0) {
        active.sonarCharges--;
        let detected = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nc = active.cursorCol + dc;
            const nr = active.cursorRow + dr;
            if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
              const cell = state.cells[idxOf(nc, nr)];
              if (!cell.revealed && (cell.content === 'ship' || cell.content === 'flagship')) {
                detected++;
              }
            }
          }
        }
        const centerCell = state.cells[idxOf(active.cursorCol, active.cursorRow)];
        centerCell.sonarHint = detected;
        state.banner = `SONAR PING: ${detected} TARGET${detected === 1 ? '' : 'S'}!`;
        state.eventText = `📡 ${active.name} scanned 3x3 sector (${active.cursorCol + 1},${active.cursorRow + 1}) — ${detected} hidden hull${detected === 1 ? '' : 's'}!`;
        sounds.push({ type: 'pulse', playerId: active.id });
        haptics.push({ playerId: active.id, pattern: 25, reason: 'sonar-ping' });
      }

      if (justA || state.turnTimeLeft <= 0) {
        let col = active.cursorCol;
        let row = active.cursorRow;
        let cell = state.cells[idxOf(col, row)];

        if (cell.revealed) {
          // Auto-pick nearest unrevealed cell so player never wastes a torpedo
          const unrevealed = state.cells.filter((c) => !c.revealed);
          if (unrevealed.length > 0) {
            unrevealed.sort(
              (a, b) =>
                Math.hypot(a.col - col, a.row - row) - Math.hypot(b.col - col, b.row - row)
            );
            cell = unrevealed[0];
            active.cursorCol = cell.col;
            active.cursorRow = cell.row;
          }
        }

        if (!cell.revealed) {
          cell.revealed = true;
          cell.hitByColor = active.colorHex;
          state.explosions.push({ col: cell.col, row: cell.row, colorHex: active.colorHex, alpha: 1 });

          if (cell.content === 'flagship') {
            state.shipsRemaining = Math.max(0, state.shipsRemaining - 1);
            active.hits++;
            active.sunkShips++;
            active.score += 90;
            state.banner = 'GOLDEN FLAGSHIP SUNK! +90';
            state.eventText = `💥 ${active.name} destroyed a Golden Flagship at (${cell.col + 1},${cell.row + 1})!`;
            sounds.push({ type: 'lap', playerId: active.id });
            haptics.push({ playerId: active.id, pattern: [40, 20, 60], reason: 'flagship-hit' });
          } else if (cell.content === 'ship') {
            state.shipsRemaining = Math.max(0, state.shipsRemaining - 1);
            active.hits++;
            active.sunkShips++;
            active.score += 45;
            state.banner = 'DIRECT TORPEDO HIT! +45';
            state.eventText = `🎯 ${active.name} hit an armored warship at (${cell.col + 1},${cell.row + 1})!`;
            sounds.push({ type: 'boost', playerId: active.id });
            haptics.push({ playerId: active.id, pattern: [30, 20, 40], reason: 'ship-hit' });
          } else if (cell.content === 'mine') {
            active.score = Math.max(0, active.score - 15);
            state.banner = 'SEA MINE DETONATED! -15';
            state.eventText = `💣 ${active.name} triggered a Sea Mine at (${cell.col + 1},${cell.row + 1})!`;
            sounds.push({ type: 'ko', playerId: active.id });
            haptics.push({ playerId: active.id, pattern: 45, reason: 'mine-hit' });
          } else {
            active.score += 5;
            state.banner = null;
            state.eventText = `🌊 ${active.name} splashed open water at (${cell.col + 1},${cell.row + 1}).`;
            sounds.push({ type: 'bump', playerId: active.id });
          }
        }
        advanceTurn();
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const activePlayer = state.players[state.turnIndex];
    for (const p of state.players) {
      const isTurn = activePlayer && p.id === activePlayer.id && !state.finished;
      p.cooldownA = isTurn ? 0 : 1;
      p.cooldownB = isTurn && p.sonarCharges > 0 ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: isTurn
          ? `YOUR TURN · (${p.cursorCol + 1},${p.cursorRow + 1}) · ${p.hits} Hits`
          : `${p.hits} Hits · ${p.score} pts`,
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

  getSnapshot(state: NavalSalvoState): NavalSalvoSnapshot {
    return {
      gameId: 'naval-salvo',
      round: Math.min(state.round, state.totalRounds),
      totalRounds: state.totalRounds,
      activePlayerId: state.players[state.turnIndex]?.id ?? '',
      turnTimeLeft: state.turnTimeLeft,
      cols: state.cols,
      rows: state.rows,
      shipsRemaining: state.shipsRemaining,
      cells: state.cells.map((c) => ({ ...c })),
      explosions: state.explosions,
      banner: state.banner,
      eventText: state.eventText,
      players: state.players.map((p) => ({ ...p })),
    };
  },

  getRankings(state: NavalSalvoState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.hits - a.hits);
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: p.score,
      highlight: `${p.hits} Direct Hits · ${p.score} pts`,
    }));
  },
};
