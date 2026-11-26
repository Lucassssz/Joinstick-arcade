export type PackCrewDefenseGameId =
  | 'lane-tower-blitz'
  | 'path-tower-defense'
  | 'horde-survivor'
  | 'starship-crew-chaos'
  | 'swarm-herd-clash'
  | 'rail-switch-rush'
  | 'air-traffic-landing'
  | 'pipe-flow-sprint'
  | 'moving-day-havoc'
  | 'fishing-tension-tug';

// 1. Lane Tower Blitz (PvZ / Clash Royale style)
export interface LaneTowerBlitzSnapshot {
  gameId: 'lane-tower-blitz';
  timeLeft: number;
  totalTime: number;
  wave: number;
  baseHp: number;
  towers: { id: string; row: number; col: number; kind: 'pea' | 'frost' | 'mortar'; level: number; ownerColor: string }[];
  enemies: { id: string; row: number; x: number; hp: number; maxHp: number; fast: boolean }[];
  bolts: { x: number; y: number; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    row: number;
    col: number;
    pickKind: 'pea' | 'frost' | 'mortar';
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 2. Path Tower Defense (Bloons / Kingdom Rush style)
export interface PathTowerDefenseSnapshot {
  gameId: 'path-tower-defense';
  timeLeft: number;
  totalTime: number;
  wave: number;
  lives: number;
  waypoints: { x: number; y: number }[];
  pads: { id: number; x: number; y: number; tower: 'none' | 'laser' | 'cannon' | 'frost'; level: number; ownerColor: string }[];
  creeps: { id: string; x: number; y: number; hp: number; maxHp: number; boss: boolean; chilled: boolean }[];
  beams: { x1: number; y1: number; x2: number; y2: number; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    padIdx: number;
    pickTower: 'laser' | 'cannon' | 'frost';
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 3. Horde Survivor (Vampire Survivors style)
export interface HordeSurvivorSnapshot {
  gameId: 'horde-survivor';
  timeLeft: number;
  totalTime: number;
  wave: number;
  enemies: { id: string; x: number; y: number; r: number; elite: boolean }[];
  gems: { id: string; x: number; y: number; gold: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    level: number;
    hp: number;
    orbitAngle: number;
    novaTimer: number;
    alive: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 4. Starship Crew Chaos (Lovers in a Dangerous Spacetime style)
export interface StarshipCrewChaosSnapshot {
  gameId: 'starship-crew-chaos';
  timeLeft: number;
  totalTime: number;
  shipX: number;
  shipY: number;
  shipAngle: number;
  shieldAngle: number;
  hullHp: number;
  stations: { id: 'helm' | 'shield' | 'turret' | 'thruster'; x: number; y: number; activeBy: string | null }[];
  threats: { id: string; x: number; y: number; r: number; kind: 'rock' | 'drone' | 'gem' }[];
  lasers: { x1: number; y1: number; x2: number; y2: number; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    relX: number;
    relY: number;
    operating: string | null;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 5. Swarm Herd Clash (Pikmin / Crowd City style)
export interface SwarmHerdClashSnapshot {
  gameId: 'swarm-herd-clash';
  timeLeft: number;
  totalTime: number;
  neutrals: { id: string; x: number; y: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    swarmCount: number;
    dashTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 6. Rail Switch Rush (Mini Metro / Train Conductor style)
export interface RailSwitchRushSnapshot {
  gameId: 'rail-switch-rush';
  timeLeft: number;
  totalTime: number;
  switches: { id: number; x: number; y: number; state: boolean }[];
  trains: { id: string; x: number; y: number; row: number; targetRow: number; colorHex: string; label: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorSwitch: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 7. Air Traffic Landing (Flight Control style)
export interface AirTrafficLandingSnapshot {
  gameId: 'air-traffic-landing';
  timeLeft: number;
  totalTime: number;
  runways: { id: string; kind: 'jet' | 'heli'; x: number; y: number; colorHex: string }[];
  planes: { id: string; x: number; y: number; angle: number; kind: 'jet' | 'heli'; guidedBy: string | null; colorHex: string; holding: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    lockedPlaneId: string | null;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 8. Pipe Flow Sprint (Pipe Mania style)
export interface PipeFlowSprintSnapshot {
  gameId: 'pipe-flow-sprint';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  flowProgress: number;
  pipes: { kind: 'straight' | 'corner' | 'cross'; rot: number; filled: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 9. Moving Day Havoc (Moving Out style)
export interface MovingDayHavocSnapshot {
  gameId: 'moving-day-havoc';
  timeLeft: number;
  totalTime: number;
  truckZone: { x: number; y: number; w: number; h: number };
  items: { id: string; kind: 'sofa' | 'tv' | 'piano' | 'box'; x: number; y: number; value: number; carrierId: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    carryingId: string | null;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 10. Fishing Tension Tug (Arcade Bass Fishing style)
export interface FishingTensionTugSnapshot {
  gameId: 'fishing-tension-tug';
  timeLeft: number;
  totalTime: number;
  fish: { id: string; x: number; y: number; size: number; gold: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    hooked: boolean;
    tension: number;
    reelProgress: number;
    fishGold: boolean;
    catches: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

export type PackCrewDefenseSnapshot =
  | LaneTowerBlitzSnapshot
  | PathTowerDefenseSnapshot
  | HordeSurvivorSnapshot
  | StarshipCrewChaosSnapshot
  | SwarmHerdClashSnapshot
  | RailSwitchRushSnapshot
  | AirTrafficLandingSnapshot
  | PipeFlowSprintSnapshot
  | MovingDayHavocSnapshot
  | FishingTensionTugSnapshot;
