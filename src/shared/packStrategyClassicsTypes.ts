export type PackStrategyBoardGameId =
  | 'gomoku-blitz'
  | 'chess-blitz'
  | 'domino-chain'
  | 'hexagon-conquest'
  | 'backgammon-sprint'
  | 'mancala-jewels'
  | 'curling-masters';

export type PackStrategyCardGameId =
  | 'rummy-royale'
  | 'hearts-breaker'
  | 'spades-bidding'
  | 'poker-showdown'
  | 'tarot-arcana'
  | 'baccarat-club'
  | 'memory-pairs'
  | 'sequence-jack';

export type PackStrategyGameId = PackStrategyBoardGameId | PackStrategyCardGameId;

// 1. Gomoku 5-in-a-Row
export interface GomokuBlitzSnapshot {
  gameId: 'gomoku-blitz';
  timeLeft: number;
  totalTime: number;
  size: number;
  cells: number[]; // -1 empty, >=0 slotIndex, -2 blocker
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorR: number;
    cursorC: number;
    lines: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 2. Mini Knight Chess
export interface ChessBlitzSnapshot {
  gameId: 'chess-blitz';
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
    captures: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 3. Domino Blitz
export interface DominoChainSnapshot {
  gameId: 'domino-chain';
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
    played: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 4. Hex Territory
export interface HexagonConquestSnapshot {
  gameId: 'hexagon-conquest';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  owners: number[]; // -1 neutral, >=0 slotIndex
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    hexes: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 5. Dice Backgammon
export interface BackgammonSprintSnapshot {
  gameId: 'backgammon-sprint';
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
    lastRoll: [number, number];
    borneOff: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 6. Gem Pit Mancala
export interface MancalaJewelsSnapshot {
  gameId: 'mancala-jewels';
  timeLeft: number;
  totalTime: number;
  pits: number[]; // 12 outer glowing gem pits
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorPit: number;
    store: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 7. Tabletop Curling
export interface CurlingMastersSnapshot {
  gameId: 'curling-masters';
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
    charging: boolean;
    sweeping: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 8. Gin Rummy Rush (Card)
export interface RummyRoyaleSnapshot {
  gameId: 'rummy-royale';
  timeLeft: number;
  totalTime: number;
  round: number;
  melds: { ownerName: string; colorHex: string; label: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    handCount: number;
    meldsCount: number;
    score: number;
  }[];
  banner: string | null;
}

// 9. Heart Breaker (Card)
export interface HeartsBreakerSnapshot {
  gameId: 'hearts-breaker';
  timeLeft: number;
  totalTime: number;
  round: number;
  trick: { playerId: string; playerName: string; colorHex: string; rank: string; suit: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    tricksWon: number;
    heartsTaken: number;
    score: number;
  }[];
  banner: string | null;
}

// 10. Trump Spades (Card)
export interface SpadesBiddingSnapshot {
  gameId: 'spades-bidding';
  timeLeft: number;
  totalTime: number;
  round: number;
  trick: { playerId: string; playerName: string; colorHex: string; rank: string; suit: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    tricksWon: number;
    spadesPlayed: number;
    score: number;
  }[];
  banner: string | null;
}

// 11. 5-Card Poker Blitz (Card)
export interface PokerShowdownSnapshot {
  gameId: 'poker-showdown';
  timeLeft: number;
  totalTime: number;
  round: number;
  phase: 'draw' | 'reveal';
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    locked: boolean;
    handRankLabel: string | null;
    revealedCards: { rank: string; suit: string }[];
    score: number;
  }[];
  banner: string | null;
}

// 12. Arcana Duel (Card)
export interface TarotArcanaSnapshot {
  gameId: 'tarot-arcana';
  timeLeft: number;
  totalTime: number;
  round: number;
  phase: 'pick' | 'clash';
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    picked: boolean;
    element: string | null;
    wins: number;
    score: number;
  }[];
  banner: string | null;
}

// 13. Royale Nine / Baccarat Club (Card)
export interface BaccaratClubSnapshot {
  gameId: 'baccarat-club';
  timeLeft: number;
  totalTime: number;
  round: number;
  phase: 'pick' | 'reveal';
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    picked: boolean;
    handTotal: number | null;
    cardsShown: string[];
    wins: number;
    score: number;
  }[];
  banner: string | null;
}

// 14. Pair Flip Arena (Card)
export interface MemoryPairsSnapshot {
  gameId: 'memory-pairs';
  timeLeft: number;
  totalTime: number;
  cards: { id: string; symbol: string; colorHex: string; flipped: boolean; matchedByColor: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    pairs: number;
    streak: number;
    score: number;
  }[];
  banner: string | null;
}

// 15. Jack Lineup / Sequence Jack (Card)
export interface SequenceJackSnapshot {
  gameId: 'sequence-jack';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  boardLabels: string[];
  owners: number[]; // -1 open, >=0 slotIndex
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    chips: number;
    lines: number;
    score: number;
  }[];
  banner: string | null;
}

export type PackStrategySnapshot =
  | GomokuBlitzSnapshot
  | ChessBlitzSnapshot
  | DominoChainSnapshot
  | HexagonConquestSnapshot
  | BackgammonSprintSnapshot
  | MancalaJewelsSnapshot
  | CurlingMastersSnapshot
  | RummyRoyaleSnapshot
  | HeartsBreakerSnapshot
  | SpadesBiddingSnapshot
  | PokerShowdownSnapshot
  | TarotArcanaSnapshot
  | BaccaratClubSnapshot
  | MemoryPairsSnapshot
  | SequenceJackSnapshot;
