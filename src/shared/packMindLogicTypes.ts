export type PackMindLogicCardGameId =
  | 'row-six-bust'
  | 'silent-sync'
  | 'one-card-court'
  | 'firework-hints'
  | 'tunnel-saboteur'
  | 'word-tile-crossroads';

export type PackMindLogicBoardGameId =
  | 'deep-sea-oxygen'
  | 'picross-nonogram'
  | 'speed-sudoku-duel'
  | 'tangram-silhouette';

export type PackMindLogicGameId = PackMindLogicCardGameId | PackMindLogicBoardGameId;

// 1. Row Six Bust (6 Nimmt! style — Pad 4 Card)
export interface RowSixBustSnapshot {
  gameId: 'row-six-bust';
  timeLeft: number;
  totalTime: number;
  round: number;
  rows: { id: number; cards: { val: number; bulls: number }[] }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    picked: boolean;
    bullsTaken: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 2. Silent Sync (The Mind style — Pad 4 Card)
export interface SilentSyncSnapshot {
  gameId: 'silent-sync';
  timeLeft: number;
  totalTime: number;
  level: number;
  lastPlayedNum: number;
  streak: number;
  mistakes: number;
  cardsRemaining: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cardsLeft: number;
    synced: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 3. Deep Sea Oxygen (Deep Sea Adventure style — Pad 2 Board)
export interface DeepSeaOxygenSnapshot {
  gameId: 'deep-sea-oxygen';
  timeLeft: number;
  totalTime: number;
  oxygen: number;
  maxOxygen: number;
  depths: { depth: number; treasure: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    depth: number;
    bagLoot: number;
    divingDown: boolean;
    banked: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 4. One Card Court (Love Letter style — Pad 4 Card)
export interface OneCardCourtSnapshot {
  gameId: 'one-card-court';
  timeLeft: number;
  totalTime: number;
  round: number;
  phase: 'play' | 'showdown';
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    shielded: boolean;
    playedCard: string | null;
    favors: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 5. Firework Hints (Hanabi style — Pad 4 Card)
export interface FireworkHintsSnapshot {
  gameId: 'firework-hints';
  timeLeft: number;
  totalTime: number;
  hintTokens: number;
  fuseLives: number;
  stacks: { color: 'red' | 'blue' | 'gold' | 'green'; topVal: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    hintsGiven: number;
    launched: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 6. Tunnel Saboteur (Saboteur style — Pad 4 Card)
export interface TunnelSaboteurSnapshot {
  gameId: 'tunnel-saboteur';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  tunnelCells: ('empty' | 'path' | 'rock' | 'gold')[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    digs: number;
    goldFound: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 7. Picross Nonogram Race (Picross style — Pad 2 Board)
export interface PicrossNonogramSnapshot {
  gameId: 'picross-nonogram';
  timeLeft: number;
  totalTime: number;
  size: number;
  puzzleIndex: number;
  rowClues: string[];
  colClues: string[];
  revealed: number[]; // -1 unknown, >=0 slotIndex owner
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    hits: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 8. Speed Sudoku Duel (6x6 Mini Sudoku — Pad 2 Board)
export interface SpeedSudokuDuelSnapshot {
  gameId: 'speed-sudoku-duel';
  timeLeft: number;
  totalTime: number;
  size: number;
  grid: number[]; // 0 empty, 1..6 filled
  lockedMask: boolean[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    pickNum: number;
    solves: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 9. Word Tile Crossroads (Scrabble / Bananagrams style — Pad 4 Card)
export interface WordTileCrossroadsSnapshot {
  gameId: 'word-tile-crossroads';
  timeLeft: number;
  totalTime: number;
  targetWords: { word: string; claimedBy: string | null; bonus: number }[];
  playedLetters: string[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    wordsBuilt: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 10. Tangram Silhouette Sprint (Pad 3 Direct Touch/Swipe)
export interface TangramSilhouetteSnapshot {
  gameId: 'tangram-silhouette';
  timeLeft: number;
  totalTime: number;
  puzzlesSolved: number;
  targetX: number;
  targetY: number;
  targetRot: number;
  shapeKind: 'triangle' | 'diamond' | 'parallelogram' | 'square';
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    rot: number;
    matches: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

export type PackMindLogicSnapshot =
  | RowSixBustSnapshot
  | SilentSyncSnapshot
  | DeepSeaOxygenSnapshot
  | OneCardCourtSnapshot
  | FireworkHintsSnapshot
  | TunnelSaboteurSnapshot
  | PicrossNonogramSnapshot
  | SpeedSudokuDuelSnapshot
  | WordTileCrossroadsSnapshot
  | TangramSilhouetteSnapshot;
