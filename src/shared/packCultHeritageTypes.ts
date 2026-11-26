export type PackCultHeritageGameId =
  | 'blade-fruit-slice'
  | 'peg-fever-bounce'
  | 'halfpipe-skate-combo'
  | 'five-second-microgames'
  | 'corridor-fencing'
  | 'pro-darts-301'
  | 'wau-kite-cut'
  | 'five-stones-toss'
  | 'chapteh-juggle'
  | 'xiangqi-river-clash';

// 1. Blade Fruit Slice (Fruit Ninja style — Pad 3 Glide)
export interface BladeFruitSliceSnapshot {
  gameId: 'blade-fruit-slice';
  timeLeft: number;
  totalTime: number;
  fruits: { id: string; kind: 'melon' | 'orange' | 'kiwi' | 'bomb' | 'gold'; x: number; y: number; r: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    trailX: number;
    trailY: number;
    slices: number;
    combo: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 2. Peg Fever Bounce (Peggle style — Pad 3 Glide + Tap A)
export interface PegFeverBounceSnapshot {
  gameId: 'peg-fever-bounce';
  timeLeft: number;
  totalTime: number;
  pegs: { id: string; x: number; y: number; kind: 'orange' | 'blue' | 'purple'; hit: boolean }[];
  balls: { id: string; ownerId: string; colorHex: string; x: number; y: number }[];
  bucketX: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    aimX: number;
    x: number;
    y: number;
    pegsHit: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 3. Halfpipe Skate Combo (Pad 2 Arrows)
export interface HalfpipeSkateComboSnapshot {
  gameId: 'halfpipe-skate-combo';
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    airborne: boolean;
    spinDeg: number;
    trickName: string | null;
    combo: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 4. Five-Second Microgames (WarioWare style — Pad 2 Arrows)
export interface FiveSecondMicrogamesSnapshot {
  gameId: 'five-second-microgames';
  timeLeft: number;
  totalTime: number;
  round: number;
  promptEn: string;
  promptZh: string;
  microKind: 'dodge' | 'catch' | 'mash' | 'stop';
  microTimer: number;
  hazardX: number;
  hazardY: number;
  goalX: number;
  goalY: number;
  redLight: boolean;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    passed: boolean;
    wins: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 5. Corridor Fencing (Nidhogg style — Pad 2 Arrows 4-Way)
export interface CorridorFencingSnapshot {
  gameId: 'corridor-fencing';
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    facing: 1 | -1;
    stance: 'high' | 'mid' | 'low';
    lunging: boolean;
    touches: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 6. Pro Darts 301 (Pad 3 Glide + Tap A)
export interface ProDarts301Snapshot {
  gameId: 'pro-darts-301';
  timeLeft: number;
  totalTime: number;
  boardX: number;
  boardY: number;
  darts: { id: string; x: number; y: number; colorHex: string; label: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    remaining301: number;
    checkouts: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 7. Wau Kite Cut (Malaysian Wau Bulan Kite Fighting — Pad 3 Glide)
export interface WauKiteCutSnapshot {
  gameId: 'wau-kite-cut';
  timeLeft: number;
  totalTime: number;
  windX: number;
  gustRings: { id: string; x: number; y: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    dashing: boolean;
    cuts: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 8. Five Stones Toss (Malaysian Batu Seremban — Pad 3 Glide + Tap A)
export interface FiveStonesTossSnapshot {
  gameId: 'five-stones-toss';
  timeLeft: number;
  totalTime: number;
  stones: { id: string; x: number; y: number; kind: 'floor' | 'tossed'; z: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    heldStones: number;
    setsCleared: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 9. Chapteh Juggle (Malaysian / Chinese Jianzi — Pad 2 Arrows)
export interface ChaptehJuggleSnapshot {
  gameId: 'chapteh-juggle';
  timeLeft: number;
  totalTime: number;
  feathers: { id: string; x: number; y: number; vx: number; vy: number; golden: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    kicks: number;
    streak: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 10. Xiangqi River Clash (Chinese Chess Blitz — Pad 2 Board 4-Way)
export interface XiangqiRiverClashSnapshot {
  gameId: 'xiangqi-river-clash';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  targets: { id: string; r: number; c: number; label: string; pts: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    piece: 'chariot' | 'horse' | 'cannon';
    captures: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

export type PackCultHeritageSnapshot =
  | BladeFruitSliceSnapshot
  | PegFeverBounceSnapshot
  | HalfpipeSkateComboSnapshot
  | FiveSecondMicrogamesSnapshot
  | CorridorFencingSnapshot
  | ProDarts301Snapshot
  | WauKiteCutSnapshot
  | FiveStonesTossSnapshot
  | ChaptehJuggleSnapshot
  | XiangqiRiverClashSnapshot;
