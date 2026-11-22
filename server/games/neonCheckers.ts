import type {
  CheckersMoveOption,
  CheckersPieceState,
  NeonCheckersPlayerState,
  NeonCheckersSnapshot,
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

interface NeonCheckersState {
  turnCount: number;
  maxTurns: number;
  turnIndex: number;
  turnTimeLeft: number;
  pieces: CheckersPieceState[];
  availableMoves: CheckersMoveOption[];
  selectedMoveIndex: number;
  lastMove: { fromCol: number; fromRow: number; toCol: number; toRow: number; colorHex: string } | null;
  moveCooldowns: Record<string, number>;
  banner: string | null;
  eventText: string | null;
  players: NeonCheckersPlayerState[];
  finished: boolean;
}

const SIZE = 8;
const TURN_TIMEOUT = 13;

function computeMovesForPlayer(
  pieces: CheckersPieceState[],
  playerId: string,
  slotIndex: number
): CheckersMoveOption[] {
  const myPieces = pieces.filter((p) => p.ownerId === playerId);
  const jumps: CheckersMoveOption[] = [];
  const slides: CheckersMoveOption[] = [];

  const forwardDr = slotIndex % 2 === 0 ? 1 : -1;

  for (const piece of myPieces) {
    const drList = piece.king ? [-1, 1] : [forwardDr, -forwardDr];
    for (const dr of drList) {
      for (const dc of [-1, 1]) {
        const nc = piece.col + dc;
        const nr = piece.row + dr;
        if (nc < 0 || nc >= SIZE || nr < 0 || nr >= SIZE) continue;
        const occupant = pieces.find((p) => p.col === nc && p.row === nr);
        if (!occupant) {
          if (piece.king || dr === forwardDr) {
            slides.push({
              pieceId: piece.id,
              fromCol: piece.col,
              fromRow: piece.row,
              toCol: nc,
              toRow: nr,
              capturedId: null,
              isJump: false,
            });
          }
        } else if (occupant.ownerId !== playerId && !occupant.shielded) {
          const jc = nc + dc;
          const jr = nr + dr;
          if (jc >= 0 && jc < SIZE && jr >= 0 && jr < SIZE) {
            const landingOcc = pieces.find((p) => p.col === jc && p.row === jr);
            if (!landingOcc) {
              jumps.push({
                pieceId: piece.id,
                fromCol: piece.col,
                fromRow: piece.row,
                toCol: jc,
                toRow: jr,
                capturedId: occupant.id,
                isJump: true,
              });
            }
          }
        }
      }
    }
  }

  if (jumps.length === 0 && slides.length === 0) {
    for (const piece of myPieces) {
      for (const dr of [-1, 1]) {
        for (const dc of [-1, 1]) {
          const nc = piece.col + dc;
          const nr = piece.row + dr;
          if (nc >= 0 && nc < SIZE && nr >= 0 && nr < SIZE && !pieces.some((p) => p.col === nc && p.row === nr)) {
            slides.push({
              pieceId: piece.id,
              fromCol: piece.col,
              fromRow: piece.row,
              toCol: nc,
              toRow: nr,
              capturedId: null,
              isJump: false,
            });
          }
        }
      }
    }
  }

  return jumps.length > 0 ? [...jumps, ...slides] : slides;
}

function updatePieceCounts(state: NeonCheckersState): void {
  for (const p of state.players) {
    const mine = state.pieces.filter((pc) => pc.ownerId === p.id);
    p.piecesCount = mine.length;
    p.kingsCount = mine.filter((pc) => pc.king).length;
    p.score = p.captures * 40 + p.kingsCount * 20 + p.piecesCount * 10;
  }
}

export const neonCheckersModule: ServerGameModule<NeonCheckersState> = {
  id: 'neon-checkers',

  createState(players: ServerPlayerInputState[], settingValue: number): NeonCheckersState {
    const maxTurns = settingValue || 32;
    const pieces: CheckersPieceState[] = [];
    const moveCooldowns: Record<string, number> = {};

    const chkPlayers: NeonCheckersPlayerState[] = players.map((p) => {
      moveCooldowns[p.id] = 0;
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        isBot: p.isBot,
        selectedMoveIndex: 0,
        piecesCount: 0,
        kingsCount: 0,
        captures: 0,
        boostCharges: 1,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      };
    });

    // Balanced per-player piece seeding so EVERY player (1-8) always gets equal pieces on dark squares!
    let pieceSeq = 1;
    const isTwoPlayer = chkPlayers.length <= 2;
    const perPlayer = isTwoPlayer ? 8 : chkPlayers.length <= 4 ? 4 : 3;

    const allDarkSquares: { col: number; row: number }[] = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if ((r + c) % 2 === 1) allDarkSquares.push({ col: c, row: r });
      }
    }

    chkPlayers.forEach((p, idx) => {
      let seeded = 0;
      const preferredRows = isTwoPlayer
        ? idx === 0
          ? [0, 1]
          : [6, 7]
        : idx === 0
        ? [0, 1]
        : idx === 1
        ? [6, 7]
        : idx === 2
        ? [2]
        : idx === 3
        ? [5]
        : [3, 4];

      for (const r of preferredRows) {
        for (let c = 0; c < SIZE && seeded < perPlayer; c++) {
          if ((r + c) % 2 === 1 && !pieces.some((ex) => ex.col === c && ex.row === r)) {
            pieces.push({
              id: `chk-${pieceSeq++}`,
              ownerId: p.id,
              colorHex: p.colorHex,
              slotIndex: idx,
              col: c,
              row: r,
              king: false,
              shielded: false,
            });
            seeded++;
          }
        }
      }
      // Fallback for 5-8 players so nobody ever starts with 0 pieces
      for (const sq of allDarkSquares) {
        if (seeded >= perPlayer) break;
        if (!pieces.some((ex) => ex.col === sq.col && ex.row === sq.row)) {
          pieces.push({
            id: `chk-${pieceSeq++}`,
            ownerId: p.id,
            colorHex: p.colorHex,
            slotIndex: idx,
            col: sq.col,
            row: sq.row,
            king: false,
            shielded: false,
          });
          seeded++;
        }
      }
    });

    const first = chkPlayers[0];
    const availableMoves = first ? computeMovesForPlayer(pieces, first.id, 0) : [];

    const state: NeonCheckersState = {
      turnCount: 1,
      maxTurns,
      turnIndex: 0,
      turnTimeLeft: TURN_TIMEOUT,
      pieces,
      availableMoves,
      selectedMoveIndex: 0,
      lastMove: null,
      moveCooldowns,
      banner: null,
      eventText: first ? `${first.name}'s Turn — Stick Selects Move · Press A to Jump!` : null,
      players: chkPlayers,
      finished: false,
    };
    updatePieceCounts(state);
    return state;
  },

  step(state: NeonCheckersState, players: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    if (state.players.length === 0) state.finished = true;

    if (!state.finished) {
      const active = state.players[state.turnIndex];
      const inp = players.find((p) => p.id === active.id);
      state.moveCooldowns[active.id] = Math.max(0, (state.moveCooldowns[active.id] || 0) - dt);

      if (inp && state.moveCooldowns[active.id] <= 0 && state.availableMoves.length > 0) {
        const delta =
          Math.abs(inp.input.dx) > 0.38
            ? Math.sign(inp.input.dx)
            : Math.abs(inp.input.dy) > 0.38
            ? Math.sign(inp.input.dy)
            : 0;
        if (delta !== 0) {
          state.selectedMoveIndex =
            (state.selectedMoveIndex + delta + state.availableMoves.length) %
            state.availableMoves.length;
          active.selectedMoveIndex = state.selectedMoveIndex;
          state.moveCooldowns[active.id] = 0.16;
          sounds.push({ type: 'nav', playerId: active.id });
        }
      }

      state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);

      if (justB && active.boostCharges > 0) {
        const move = state.availableMoves[state.selectedMoveIndex];
        const piece =
          (move && state.pieces.find((pc) => pc.id === move.pieceId)) ||
          state.pieces.find((pc) => pc.ownerId === active.id);
        if (piece) {
          active.boostCharges--;
          piece.king = true;
          piece.shielded = true;
          updatePieceCounts(state);
          state.availableMoves = computeMovesForPlayer(state.pieces, active.id, state.turnIndex);
          state.selectedMoveIndex = 0;
          state.banner = 'CROWN KING BOOST!';
          state.eventText = `👑 ${active.name} promoted a piece to a Shielded King!`;
          sounds.push({ type: 'boost', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: 25, reason: 'checkers-king' });
        }
      }

      const advanceTurn = () => {
        updatePieceCounts(state);
        state.turnCount++;
        const aliveOwners = new Set(state.pieces.map((pc) => pc.ownerId));
        if (
          state.turnCount > state.maxTurns ||
          (state.players.length > 1 && aliveOwners.size <= 1)
        ) {
          state.finished = true;
          state.banner = 'CHECKERS CLASH COMPLETE!';
          sounds.push({ type: 'win' });
          return;
        }
        for (let step = 1; step <= state.players.length; step++) {
          const nextIdx = (state.turnIndex + step) % state.players.length;
          const nextP = state.players[nextIdx];
          const moves = computeMovesForPlayer(state.pieces, nextP.id, nextIdx);
          if (moves.length > 0) {
            state.turnIndex = nextIdx;
            state.turnTimeLeft = TURN_TIMEOUT;
            state.availableMoves = moves;
            state.selectedMoveIndex = 0;
            nextP.selectedMoveIndex = 0;
            return;
          }
        }
        state.finished = true;
      };

      if (justA || state.turnTimeLeft <= 0) {
        const chosen = state.availableMoves[state.selectedMoveIndex] || state.availableMoves[0];
        if (chosen) {
          const piece = state.pieces.find((pc) => pc.id === chosen.pieceId);
          if (piece) {
            piece.col = chosen.toCol;
            piece.row = chosen.toRow;
            piece.shielded = false;
            state.lastMove = {
              fromCol: chosen.fromCol,
              fromRow: chosen.fromRow,
              toCol: chosen.toCol,
              toRow: chosen.toRow,
              colorHex: active.colorHex,
            };

            if (!piece.king && (piece.row === 0 || piece.row === SIZE - 1)) {
              piece.king = true;
              state.banner = `${active.name} CROWNED A KING!`;
              sounds.push({ type: 'lap', playerId: active.id });
            }

            if (chosen.capturedId) {
              const capIdx = state.pieces.findIndex((pc) => pc.id === chosen.capturedId);
              if (capIdx !== -1) state.pieces.splice(capIdx, 1);
              active.captures++;
              state.banner = `JUMP CAPTURE! +40`;
              state.eventText = `⚡ ${active.name} jumped & captured an enemy checker!`;
              sounds.push({ type: 'ko', playerId: active.id });
              haptics.push({ playerId: active.id, pattern: [35, 20, 45], reason: 'checkers-jump' });
            } else {
              state.banner = null;
              state.eventText = `${active.name} moved to (${chosen.toCol + 1},${chosen.toRow + 1}).`;
              sounds.push({ type: 'confirm', playerId: active.id });
            }
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
      p.cooldownB = isTurn && p.boostCharges > 0 ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.score,
        alive: p.piecesCount > 0,
        statText: isTurn
          ? `YOUR TURN · ${p.piecesCount} Pcs · ${p.captures} KOs`
          : `${p.piecesCount} Pcs · 👑${p.kingsCount} · ${p.captures} KOs`,
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

  getSnapshot(state: NeonCheckersState): NeonCheckersSnapshot {
    return {
      gameId: 'neon-checkers',
      turnCount: Math.min(state.turnCount, state.maxTurns),
      maxTurns: state.maxTurns,
      activePlayerId: state.players[state.turnIndex]?.id ?? '',
      turnTimeLeft: state.turnTimeLeft,
      pieces: state.pieces.map((p) => ({ ...p })),
      availableMoves: state.availableMoves,
      selectedMoveIndex: state.selectedMoveIndex,
      lastMove: state.lastMove,
      banner: state.banner,
      eventText: state.eventText,
      players: state.players.map((p) => ({ ...p })),
    };
  },

  getRankings(state: NeonCheckersState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.captures - a.captures);
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: p.score,
      highlight: `${p.captures} Captures · ${p.kingsCount} Kings`,
    }));
  },
};
