export type PackPhysicsBuilderGameId =
  | 'trap-builder-run'
  | 'track-crafter-gp'
  | 'slingshot-fortress'
  | 'rope-slice-physics'
  | 'wobbly-timber-pull'
  | 'artillery-crater-war'
  | 'bridge-load-stress'
  | 'hill-torque-climb'
  | 'three-lane-metro'
  | 'tilt-labyrinth';

// 1. Trap Builder Run (Ultimate Chicken Horse style)
export interface TrapBuilderRunSnapshot {
  gameId: 'trap-builder-run';
  timeLeft: number;
  totalTime: number;
  round: number;
  phase: 'build' | 'run';
  phaseTimer: number;
  items: {
    id: string;
    kind: 'platform' | 'spring' | 'saw' | 'spike' | 'ice';
    x: number;
    y: number;
    w: number;
    h: number;
    ownerId: string;
    colorHex: string;
  }[];
  goal: { x: number; y: number };
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    cursorX: number;
    cursorY: number;
    selectedKind: 'platform' | 'spring' | 'saw' | 'spike' | 'ice';
    placedThisRound: boolean;
    finishedRound: boolean;
    alive: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 2. Track Crafter GP (Make Way style)
export interface TrackCrafterGpSnapshot {
  gameId: 'track-crafter-gp';
  timeLeft: number;
  totalTime: number;
  round: number;
  phase: 'craft' | 'race';
  phaseTimer: number;
  nodes: { x: number; y: number; kind: 'normal' | 'boost' | 'hazard' | 'ramp' }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    speed: number;
    nodeIdx: number;
    pickKind: 'boost' | 'hazard' | 'ramp';
    placedPiece: boolean;
    alive: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 3. Slingshot Fortress (Angry Birds style)
export interface SlingshotFortressSnapshot {
  gameId: 'slingshot-fortress';
  timeLeft: number;
  totalTime: number;
  wave: number;
  blocks: { id: string; x: number; y: number; w: number; h: number; hp: number; maxHp: number; mat: 'wood' | 'stone' | 'tnt' }[];
  targets: { id: string; x: number; y: number; r: number; hp: number; gold: boolean }[];
  projectiles: { id: string; x: number; y: number; vx: number; vy: number; colorHex: string; cluster: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    aimAngle: number;
    power: number;
    ammoMode: 'heavy' | 'cluster';
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 4. Rope Slice Physics (Cut the Rope style)
export interface RopeSlicePhysicsSnapshot {
  gameId: 'rope-slice-physics';
  timeLeft: number;
  totalTime: number;
  ropes: { id: string; ax: number; ay: number; orbX: number; orbY: number; cut: boolean; kind: 'candy' | 'gold' | 'bomb' }[];
  buckets: { id: string; x: number; y: number; w: number; ownerId: string | null; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    gustTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 5. Wobbly Timber Pull (Jenga style)
export interface WobblyTimberPullSnapshot {
  gameId: 'wobbly-timber-pull';
  timeLeft: number;
  totalTime: number;
  tiltAngle: number;
  collapseCount: number;
  rows: { row: number; blocks: [boolean, boolean, boolean]; stress: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorRow: number;
    cursorCol: number;
    pullProgress: number;
    combo: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 6. Artillery Crater War (Worms / Scorched Earth style)
export interface ArtilleryCraterWarSnapshot {
  gameId: 'artillery-crater-war';
  timeLeft: number;
  totalTime: number;
  wind: number;
  terrain: number[]; // heights sampled every 20px across 1200px (61 samples)
  shells: { id: string; x: number; y: number; vx: number; vy: number; colorHex: string; big: boolean }[];
  craters: { x: number; y: number; r: number; age: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    aimAngle: number;
    power: number;
    hp: number;
    alive: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 7. Bridge Load Stress (Poly Bridge style)
export interface BridgeLoadStressSnapshot {
  gameId: 'bridge-load-stress';
  timeLeft: number;
  totalTime: number;
  phase: 'build' | 'test';
  phaseTimer: number;
  truckX: number;
  truckY: number;
  truckOk: boolean;
  anchors: { id: number; x: number; y: number }[];
  beams: { a: number; b: number; mat: 'wood' | 'steel'; stress: number; broken: boolean; ownerColor: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorIdx: number;
    selectedFrom: number | null;
    mat: 'wood' | 'steel';
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 8. Hill Torque Climb (Hill Climb Racing style)
export interface HillTorqueClimbSnapshot {
  gameId: 'hill-torque-climb';
  timeLeft: number;
  totalTime: number;
  cameraX: number;
  terrainHeights: { x: number; y: number }[];
  coins: { id: string; x: number; y: number; gold: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    distMeters: number;
    flips: number;
    stunTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 9. 3-Lane Metro Dash (Subway Surfers style)
export interface ThreeLaneMetroSnapshot {
  gameId: 'three-lane-metro';
  timeLeft: number;
  totalTime: number;
  speed: number;
  obstacles: { id: string; lane: number; z: number; kind: 'train' | 'highbar' | 'lowbarrier' | 'coin' | 'magnet' }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    lane: number;
    zHeight: number;
    sliding: boolean;
    magnetTimer: number;
    stunTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 10. Tilt Labyrinth (Super Monkey Ball / Wooden Maze style)
export interface TiltLabyrinthSnapshot {
  gameId: 'tilt-labyrinth';
  timeLeft: number;
  totalTime: number;
  stage: number;
  tiltX: number;
  tiltY: number;
  holes: { x: number; y: number; r: number }[];
  walls: { x: number; y: number; w: number; h: number }[];
  goals: { id: string; x: number; y: number; r: number; gold: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    z: number;
    alive: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

export type PackPhysicsBuilderSnapshot =
  | TrapBuilderRunSnapshot
  | TrackCrafterGpSnapshot
  | SlingshotFortressSnapshot
  | RopeSlicePhysicsSnapshot
  | WobblyTimberPullSnapshot
  | ArtilleryCraterWarSnapshot
  | BridgeLoadStressSnapshot
  | HillTorqueClimbSnapshot
  | ThreeLaneMetroSnapshot
  | TiltLabyrinthSnapshot;
