export type PackTabletopBoardGameId =
  | 'mosaic-tile-draft'
  | 'maze-wall-duel'
  | 'corner-polyomino'
  | 'pillar-ascent-3d'
  | 'hex-island-settlers'
  | 'hex-insect-chess';

export type PackTabletopCardGameId =
  | 'camel-stack-derby'
  | 'route-express'
  | 'gem-engine-guild'
  | 'secret-rank-flags';

export type PackTabletopGemsGameId = PackTabletopBoardGameId | PackTabletopCardGameId;

// 1. Mosaic Tile Draft (Azul style — Pad 2 Board)
export interface MosaicTileDraftSnapshot {
  gameId: 'mosaic-tile-draft';
  timeLeft: number;
  totalTime: number;
  round: number;
  factories: { id: number; tiles: ('red' | 'blue' | 'gold' | 'green')[] }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    factoryIdx: number;
    pickColor: 'red' | 'blue' | 'gold' | 'green';
    wallMask: number; // bitmask of filled cells
    wallCount: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 2. Maze Wall Duel (Quoridor style — Pad 2 Board)
export interface MazeWallDuelSnapshot {
  gameId: 'maze-wall-duel';
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
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 3. Corner Polyomino (Blokus style — Pad 2 Board)
export interface CornerPolyominoSnapshot {
  gameId: 'corner-polyomino';
  timeLeft: number;
  totalTime: number;
  size: number;
  cells: number[]; // -1 empty, >=0 slotIndex
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
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 4. 3D Pillar Ascent (Santorini style — Pad 2 Board)
export interface PillarAscent3dSnapshot {
  gameId: 'pillar-ascent-3d';
  timeLeft: number;
  totalTime: number;
  size: number;
  heights: number[]; // 0..3, 4 = capped dome
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    ascents: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 5. Camel Stack Derby (Camel Up style — Pad 4 Card)
export interface CamelStackDerbySnapshot {
  gameId: 'camel-stack-derby';
  timeLeft: number;
  totalTime: number;
  leg: number;
  trackLen: number;
  camels: { id: string; name: string; colorHex: string; space: number; stackOrder: number }[];
  lastRollText: string | null;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    betColor: string | null;
    coins: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 6. Route Express (Ticket to Ride style — Pad 4 Card)
export interface RouteExpressSnapshot {
  gameId: 'route-express';
  timeLeft: number;
  totalTime: number;
  cities: { id: string; name: string; x: number; y: number }[];
  routes: { id: string; from: number; to: number; color: 'red' | 'blue' | 'gold' | 'green'; len: number; ownerId: string | null; ownerColor: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cardCount: number;
    routesClaimed: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 7. Gem Engine Guild (Splendor style — Pad 4 Card)
export interface GemEngineGuildSnapshot {
  gameId: 'gem-engine-guild';
  timeLeft: number;
  totalTime: number;
  market: { id: string; tier: 1 | 2 | 3; color: 'red' | 'blue' | 'gold' | 'green'; cost: number; pts: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    gems: number;
    discounts: number;
    nobles: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 8. Hex Island Settlers (Fast Catan style — Pad 2 Board)
export interface HexIslandSettlersSnapshot {
  gameId: 'hex-island-settlers';
  timeLeft: number;
  totalTime: number;
  lastDice: number;
  hexes: { id: number; x: number; y: number; resource: 'wood' | 'brick' | 'ore' | 'gold'; rollNum: number; ownerSlot: number; city: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorHex: number;
    resources: number;
    settlements: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 9. Hex Insect Chess (Hive style — Pad 2 Board)
export interface HexInsectChessSnapshot {
  gameId: 'hex-insect-chess';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  bugs: { r: number; c: number; kind: 'queen' | 'beetle' | 'hopper' | 'spider'; ownerSlot: number; ownerColor: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    pickBug: 'queen' | 'beetle' | 'hopper' | 'spider';
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 10. Secret Rank Flags (Stratego style — Pad 4 Card)
export interface SecretRankFlagsSnapshot {
  gameId: 'secret-rank-flags';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  pieces: { id: string; r: number; c: number; ownerId: string; ownerColor: string; revealedRank: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    unitsLeft: number;
    flagsCaptured: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

export type PackTabletopGemsSnapshot =
  | MosaicTileDraftSnapshot
  | MazeWallDuelSnapshot
  | CornerPolyominoSnapshot
  | PillarAscent3dSnapshot
  | CamelStackDerbySnapshot
  | RouteExpressSnapshot
  | GemEngineGuildSnapshot
  | HexIslandSettlersSnapshot
  | HexInsectChessSnapshot
  | SecretRankFlagsSnapshot;
