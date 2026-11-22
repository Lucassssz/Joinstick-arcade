export type PackRetroArcadeGameId =
  | 'maze-chomper'
  | 'brick-clash'
  | 'alien-wave'
  | 'block-stack'
  | 'frog-crossing'
  | 'barrel-tower'
  | 'whack-blitz'
  | 'rhythm-pulse'
  | 'clay-skeet'
  | 'air-hockey-neo'
  | 'skee-roll'
  | 'stack-tower'
  | 'tunnel-dig'
  | 'bubble-pop-arc'
  | 'pin-strike'
  | 'coin-dozer';

// 1. Maze Chomper (Pac-Man)
export interface MazeChomperSnapshot {
  gameId: 'maze-chomper';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  walls: number[]; // 0 open, 1 wall
  pellets: { x: number; y: number; power: boolean }[];
  ghosts: { id: string; x: number; y: number; colorHex: string; scaredTimer: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    powerTimer: number;
    stunTimer: number;
    score: number;
    ghostsEaten: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 2. Brick Clash (Breakout / Arkanoid)
export interface BrickClashSnapshot {
  gameId: 'brick-clash';
  timeLeft: number;
  totalTime: number;
  bricks: { id: string; x: number; y: number; w: number; h: number; hp: number; colorHex: string; bonus?: 'multi' | 'gold' }[];
  balls: { x: number; y: number; vx: number; vy: number; ownerSlot: number; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    w: number;
    laserActive: boolean;
    score: number;
    bricksBroken: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 3. Alien Wave (Space Invaders)
export interface AlienWaveSnapshot {
  gameId: 'alien-wave';
  timeLeft: number;
  totalTime: number;
  wave: number;
  aliens: { id: string; x: number; y: number; kind: 'grunt' | 'elite' | 'ufo'; hp: number; colorHex: string }[];
  bullets: { x: number; y: number; vy: number; colorHex: string; enemy?: boolean }[];
  shields: { x: number; y: number; hp: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    stunTimer: number;
    rapidTimer: number;
    score: number;
    kills: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 4. Block Stack (Tetris)
export interface BlockStackSnapshot {
  gameId: 'block-stack';
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    board: number[]; // 10 cols x 16 rows (0 empty, 1..7 piece color, 8 garbage)
    curShape: { cx: number; cy: number }[];
    curColor: number;
    linesCleared: number;
    score: number;
    alive: boolean;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 5. Frog Crossing (Frogger / Crossy Road)
export interface FrogCrossingSnapshot {
  gameId: 'frog-crossing';
  timeLeft: number;
  totalTime: number;
  lanes: {
    row: number;
    kind: 'safe' | 'road' | 'river' | 'goal';
    items: { x: number; w: number; colorHex: string }[];
  }[];
  pads: { x: number; claimedByColor: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    row: number;
    hopTimer: number;
    stunTimer: number;
    crossings: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 6. Barrel Tower (Donkey Kong)
export interface BarrelTowerSnapshot {
  gameId: 'barrel-tower';
  timeLeft: number;
  totalTime: number;
  floors: { y: number; tilt: number; ladderX: number[] }[];
  barrels: { id: string; x: number; y: number; vx: number; r: number; burning?: boolean }[];
  hammers: { id: string; x: number; y: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vy: number;
    floorIdx: number;
    hammerTimer: number;
    stunTimer: number;
    summits: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 7. Whack Blitz (Whac-A-Mole)
export interface WhackBlitzSnapshot {
  gameId: 'whack-blitz';
  timeLeft: number;
  totalTime: number;
  holes: {
    x: number;
    y: number;
    mole: 'none' | 'normal' | 'golden' | 'bomb';
    popProgress: number; // 0..1
  }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    swingTimer: number;
    stunTimer: number;
    streak: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 8. Rhythm Pulse (DDR / Guitar Hero)
export interface RhythmPulseSnapshot {
  gameId: 'rhythm-pulse';
  timeLeft: number;
  totalTime: number;
  bpm: number;
  beatPhase: number;
  notes: { id: string; lane: 0 | 1 | 2 | 3; y: number; golden?: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    activeLane: number;
    combo: number;
    maxCombo: number;
    lastJudge: string;
    judgeColor: string;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 9. Clay Skeet (Duck Hunt)
export interface ClaySkeetSnapshot {
  gameId: 'clay-skeet';
  timeLeft: number;
  totalTime: number;
  targets: { id: string; x: number; y: number; vx: number; vy: number; r: number; kind: 'clay' | 'gold' | 'decoy'; hit?: boolean }[];
  flashes: { x: number; y: number; colorHex: string; alpha: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    ammo: number;
    streak: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 10. Neo Hockey (Air Hockey)
export interface AirHockeyNeoSnapshot {
  gameId: 'air-hockey-neo';
  timeLeft: number;
  totalTime: number;
  leftScore: number;
  rightScore: number;
  pucks: { x: number; y: number; vx: number; vy: number; r: number; supercharged: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    side: 'left' | 'right';
    x: number;
    y: number;
    smashTimer: number;
    goals: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 11. Skee Roll (Skee-Ball)
export interface SkeeRollSnapshot {
  gameId: 'skee-roll';
  timeLeft: number;
  totalTime: number;
  rings: { x: number; y: number; r: number; points: number; colorHex: string }[];
  balls: { x: number; y: number; vx: number; vy: number; ownerSlot: number; colorHex: string; landed?: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    aimX: number;
    charge: number;
    charging: boolean;
    lastPts: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 12. Stack Tower (Arcade Stacker)
export interface StackTowerSnapshot {
  gameId: 'stack-tower';
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    blocks: { x: number; w: number; colorHex: string }[];
    moverX: number;
    moverW: number;
    height: number;
    perfectStreak: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 13. Tunnel Dig (Dig Dug)
export interface TunnelDigSnapshot {
  gameId: 'tunnel-dig';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  dirt: number[]; // 1 dirt, 0 dug
  gems: { id: string; x: number; y: number; value: number; colorHex: string }[];
  boulders: { id: string; x: number; y: number; falling: boolean }[];
  monsters: { id: string; x: number; y: number; inflated: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    pumpTimer: number;
    stunTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 14. Bubble Pop (Puzzle Bobble)
export interface BubblePopArcSnapshot {
  gameId: 'bubble-pop-arc';
  timeLeft: number;
  totalTime: number;
  ceilingY: number;
  bubbles: { id: string; x: number; y: number; colorIdx: number; colorHex: string }[];
  shots: { x: number; y: number; vx: number; vy: number; colorIdx: number; colorHex: string; ownerId: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    aimAngle: number;
    nextColorIdx: number;
    nextColorHex: string;
    pops: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 15. Pin Strike (Arcade Bowling)
export interface PinStrikeSnapshot {
  gameId: 'pin-strike';
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  pins: { id: number; x: number; y: number; knocked: boolean }[];
  balls: { x: number; y: number; vx: number; vy: number; spin: number; ownerSlot: number; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    laneX: number;
    aimSpin: number;
    charge: number;
    charging: boolean;
    strikes: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 16. Coin Dozer (Arcade Coin Pusher)
export interface CoinDozerSnapshot {
  gameId: 'coin-dozer';
  timeLeft: number;
  totalTime: number;
  pusherY: number;
  coins: { id: string; x: number; y: number; r: number; kind: 'gold' | 'mega' | 'gem'; ownerSlot: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    tokens: number;
    megaReady: boolean;
    jackpots: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

export type PackRetroArcadeSnapshot =
  | MazeChomperSnapshot
  | BrickClashSnapshot
  | AlienWaveSnapshot
  | BlockStackSnapshot
  | FrogCrossingSnapshot
  | BarrelTowerSnapshot
  | WhackBlitzSnapshot
  | RhythmPulseSnapshot
  | ClaySkeetSnapshot
  | AirHockeyNeoSnapshot
  | SkeeRollSnapshot
  | StackTowerSnapshot
  | TunnelDigSnapshot
  | BubblePopArcSnapshot
  | PinStrikeSnapshot
  | CoinDozerSnapshot;
