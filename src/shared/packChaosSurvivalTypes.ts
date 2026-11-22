export type PackChaosSurvivalGameId =
  | 'laser-jump-rope'
  | 'hot-lava-floor'
  | 'bomb-tag-arena'
  | 'musical-thrones'
  | 'sumo-ice-drift'
  | 'meteor-dodge-x'
  | 'king-of-hill-neo'
  | 'laser-maze-heist'
  | 'zombie-outbreak'
  | 'falling-anvils'
  | 'seesaw-balance'
  | 'chain-gang-climb'
  | 'confetti-capture'
  | 'crane-drop-chaos'
  | 'roulette-arena';

// 1. Laser Jump Rope (#73 replacement)
export interface LaserJumpRopeSnapshot {
  gameId: 'laser-jump-rope';
  timeLeft: number;
  totalTime: number;
  beamAngle: number;
  beamSpeed: number;
  doubleBeam: boolean;
  gems: { id: string; x: number; y: number; value: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    z: number;
    vz: number;
    jumpsCleared: number;
    alive: boolean;
    shieldTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 2. Floor Is Lava (Hot Lava Floor)
export interface HotLavaFloorSnapshot {
  gameId: 'hot-lava-floor';
  timeLeft: number;
  totalTime: number;
  lavaWave: number;
  platforms: { id: string; x: number; y: number; r: number; safe: boolean; sinking: boolean; timer: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    z: number;
    alive: boolean;
    shoveTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 3. Tick Tock Tag (Bomb Tag Arena)
export interface BombTagArenaSnapshot {
  gameId: 'bomb-tag-arena';
  timeLeft: number;
  totalTime: number;
  fuseLeft: number;
  bombHolderId: string | null;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    dashTimer: number;
    shieldTimer: number;
    alive: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  explosions: { x: number; y: number; radius: number; alpha: number }[];
  banner: string | null;
}

// 4. Neon Thrones (Musical Chairs)
export interface MusicalThronesSnapshot {
  gameId: 'musical-thrones';
  timeLeft: number;
  totalTime: number;
  phase: 'music' | 'scramble' | 'lock';
  phaseTimer: number;
  pods: { id: string; x: number; y: number; r: number; occupantId: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    seatedPodId: string | null;
    alive: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 5. Slippery Glacier (Ice Drift)
export interface SumoIceDriftSnapshot {
  gameId: 'sumo-ice-drift';
  timeLeft: number;
  totalTime: number;
  iceRadius: number;
  cracks: { angle: number; r: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    alive: boolean;
    dashTimer: number;
    kos: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 6. Skyfall Survival (Meteor Dodge X)
export interface MeteorDodgeXSnapshot {
  gameId: 'meteor-dodge-x';
  timeLeft: number;
  totalTime: number;
  meteors: { id: string; x: number; y: number; r: number; progress: number; gold: boolean }[];
  craters: { x: number; y: number; r: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    z: number;
    alive: boolean;
    shieldTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 7. Hill Sovereign (King of the Hill)
export interface KingOfHillNeoSnapshot {
  gameId: 'king-of-hill-neo';
  timeLeft: number;
  totalTime: number;
  zoneX: number;
  zoneY: number;
  zoneR: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    inZone: boolean;
    dashTimer: number;
    pulseTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  shockwaves: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  banner: string | null;
}

// 8. Vault Lasers (Laser Maze Heist)
export interface LaserMazeHeistSnapshot {
  gameId: 'laser-maze-heist';
  timeLeft: number;
  totalTime: number;
  sweepers: { x: number; y: number; angle: number; length: number }[];
  diamonds: { id: string; x: number; y: number; value: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    crouching: boolean;
    stunTimer: number;
    gems: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 9. Infection Wave (Zombie Outbreak)
export interface ZombieOutbreakSnapshot {
  gameId: 'zombie-outbreak';
  timeLeft: number;
  totalTime: number;
  cureOrbs: { id: string; x: number; y: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    infected: boolean;
    dashTimer: number;
    repelTimer: number;
    infections: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 10. Anvil Rain (Falling Anvils)
export interface FallingAnvilsSnapshot {
  gameId: 'falling-anvils';
  timeLeft: number;
  totalTime: number;
  anvils: { id: string; x: number; y: number; r: number; progress: number; gold: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    alive: boolean;
    shoveTimer: number;
    dashTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 11. Seesaw Tilt (Seesaw Balance)
export interface SeesawBalanceSnapshot {
  gameId: 'seesaw-balance';
  timeLeft: number;
  totalTime: number;
  beamTilt: number; // -0.55..0.55 rad
  coins: { id: string; offset: number; value: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    offset: number; // -420..420 along seesaw
    z: number;
    alive: boolean;
    stompTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 12. Chain Dash (Chain Gang Climb)
export interface ChainGangClimbSnapshot {
  gameId: 'chain-gang-climb';
  timeLeft: number;
  totalTime: number;
  scrollY: number;
  hazards: { id: string; x: number; y: number; r: number }[];
  stars: { id: string; x: number; y: number; value: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    alive: boolean;
    pulling: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 13. Color Turf War (Confetti Capture)
export interface ConfettiCaptureSnapshot {
  gameId: 'confetti-capture';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  cells: number[]; // -1 neutral or slotIndex
  bombs: { id: string; x: number; y: number; slotIndex: number; colorHex: string; fuse: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    dashTimer: number;
    tilesOwned: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 14. Wrecking Arena (Crane Drop Chaos)
export interface CraneDropChaosSnapshot {
  gameId: 'crane-drop-chaos';
  timeLeft: number;
  totalTime: number;
  balls: { x: number; y: number; r: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    alive: boolean;
    dashTimer: number;
    shieldTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 15. Trapdoor Fate (Roulette Arena)
export interface RouletteArenaSnapshot {
  gameId: 'roulette-arena';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  tileStates: number[]; // 0 intact, 1 warning glow, 2 open trapdoor
  countdown: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    alive: boolean;
    shoveTimer: number;
    dashTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

export type PackChaosSurvivalSnapshot =
  | LaserJumpRopeSnapshot
  | HotLavaFloorSnapshot
  | BombTagArenaSnapshot
  | MusicalThronesSnapshot
  | SumoIceDriftSnapshot
  | MeteorDodgeXSnapshot
  | KingOfHillNeoSnapshot
  | LaserMazeHeistSnapshot
  | ZombieOutbreakSnapshot
  | FallingAnvilsSnapshot
  | SeesawBalanceSnapshot
  | ChainGangClimbSnapshot
  | ConfettiCaptureSnapshot
  | CraneDropChaosSnapshot
  | RouletteArenaSnapshot;
