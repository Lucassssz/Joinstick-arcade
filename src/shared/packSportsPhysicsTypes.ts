export type PackSportsPhysicsGameId =
  | 'hoop-blitz'
  | 'penalty-duel'
  | 'mini-golf-pro'
  | 'archery-wind'
  | 'boxing-ko'
  | 'ping-pong-pro'
  | 'home-run-derby'
  | 'dodgeball-riot'
  | 'sumo-clash'
  | 'canoe-sprint'
  | 'disc-arena'
  | 'badminton-smash'
  | 'billiards-snooker'
  | 'tether-joust';

// 1. Hoop Blitz (Basketball 3PT Shootout)
export interface HoopBlitzSnapshot {
  gameId: 'hoop-blitz';
  timeLeft: number;
  totalTime: number;
  hoopX: number;
  hoopY: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    aimAngle: number;
    charging: boolean;
    power: number;
    streak: number;
    made: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  balls: { x: number; y: number; vx: number; vy: number; colorHex: string; moneyBall: boolean }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  banner: string | null;
}

// 2. Penalty Duel (Penalty Shootout)
export interface PenaltyDuelSnapshot {
  gameId: 'penalty-duel';
  timeLeft: number;
  totalTime: number;
  round: number;
  goalX: number;
  goalY: number;
  goalW: number;
  keeperX: number;
  keeperDive: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    aimX: number;
    power: number;
    charging: boolean;
    goals: number;
    saves: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  shots: { x: number; y: number; vx: number; vy: number; colorHex: string; active: boolean }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  banner: string | null;
}

// 3. Mini Golf Pro (Top-Down Golf)
export interface MiniGolfProSnapshot {
  gameId: 'mini-golf-pro';
  timeLeft: number;
  totalTime: number;
  holeIndex: number;
  cupX: number;
  cupY: number;
  walls: { x: number; y: number; w: number; h: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    aimAngle: number;
    power: number;
    charging: boolean;
    sunk: boolean;
    strokes: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 4. Wind Archery
export interface ArcheryWindSnapshot {
  gameId: 'archery-wind';
  timeLeft: number;
  totalTime: number;
  windX: number;
  windY: number;
  targetX: number;
  targetY: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    aimX: number;
    aimY: number;
    drawing: boolean;
    drawPct: number;
    lastRing: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  arrows: { x: number; y: number; z: number; colorHex: string }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  banner: string | null;
}

// 5. Ring Blitz (Punch-Out Boxing)
export interface BoxingKoSnapshot {
  gameId: 'boxing-ko';
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    hp: number;
    maxHp: number;
    stamina: number;
    guarding: boolean;
    punchTimer: number;
    stunTimer: number;
    kos: number;
    alive: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  impacts: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  banner: string | null;
}

// 6. Spin Pong (Table Tennis)
export interface PingPongProSnapshot {
  gameId: 'ping-pong-pro';
  timeLeft: number;
  totalTime: number;
  balls: { x: number; y: number; vx: number; vy: number; spin: number; smash: boolean; lastId: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    side: 'top' | 'bottom' | 'left' | 'right';
    x: number;
    y: number;
    swingTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 7. Slugger Derby (Baseball Home Run)
export interface HomeRunDerbySnapshot {
  gameId: 'home-run-derby';
  timeLeft: number;
  totalTime: number;
  pitches: { id: string; y: number; speed: number; curve: number; active: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    laneX: number;
    swingTimer: number;
    homeruns: number;
    combo: number;
    lastHitDist: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  hitBalls: { x: number; y: number; vx: number; vy: number; colorHex: string }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  banner: string | null;
}

// 8. Dodgeball Riot
export interface DodgeballRiotSnapshot {
  gameId: 'dodgeball-riot';
  timeLeft: number;
  totalTime: number;
  balls: { id: string; x: number; y: number; vx: number; vy: number; hot: boolean; ownerId: string | null; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    hasBall: boolean;
    catchTimer: number;
    dashTimer: number;
    hp: number;
    alive: boolean;
    hits: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 9. Dohyo Sumo
export interface SumoClashSnapshot {
  gameId: 'sumo-clash';
  round: number;
  timeLeft: number;
  ringRadius: number;
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
    radius: number;
    chargeTimer: number;
    stompTimer: number;
    alive: boolean;
    ringOuts: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  shockwaves: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  banner: string | null;
}

// 10. Rapids Sprint (Canoe Slalom)
export interface CanoeSprintSnapshot {
  gameId: 'canoe-sprint';
  timeLeft: number;
  totalTime: number;
  finishDist: number;
  gates: { id: string; x: number; dist: number; width: number }[];
  rocks: { x: number; dist: number; r: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    laneX: number;
    dist: number;
    speed: number;
    boostTimer: number;
    stunTimer: number;
    gatesCleared: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 11. Hyper Disc (Windjammers)
export interface DiscArenaSnapshot {
  gameId: 'disc-arena';
  timeLeft: number;
  totalTime: number;
  disc: { x: number; y: number; vx: number; vy: number; curve: number; power: boolean; holderId: string | null };
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    dashTimer: number;
    goals: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 12. Shuttle Smash (Badminton)
export interface BadmintonSmashSnapshot {
  gameId: 'badminton-smash';
  timeLeft: number;
  totalTime: number;
  shuttle: { x: number; y: number; vx: number; vy: number; smashing: boolean; lastTeam: number };
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    side: 0 | 1;
    x: number;
    y: number;
    jumpVy: number;
    swingTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 13. Pool Blitz (Pocket Billiards)
export interface BilliardsSnookerSnapshot {
  gameId: 'billiards-snooker';
  timeLeft: number;
  totalTime: number;
  pockets: { x: number; y: number; r: number }[];
  balls: { id: string; x: number; y: number; vx: number; vy: number; colorHex: string; value: number; isCue?: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    aimAngle: number;
    power: number;
    charging: boolean;
    potted: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 14. Bumper Joust
export interface TetherJoustSnapshot {
  gameId: 'tether-joust';
  timeLeft: number;
  totalTime: number;
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
    lungeTimer: number;
    shieldTimer: number;
    alive: boolean;
    hits: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  sparks: { x: number; y: number; colorHex: string; alpha: number }[];
  banner: string | null;
}

export type PackSportsPhysicsSnapshot =
  | HoopBlitzSnapshot
  | PenaltyDuelSnapshot
  | MiniGolfProSnapshot
  | ArcheryWindSnapshot
  | BoxingKoSnapshot
  | PingPongProSnapshot
  | HomeRunDerbySnapshot
  | DodgeballRiotSnapshot
  | SumoClashSnapshot
  | CanoeSprintSnapshot
  | DiscArenaSnapshot
  | BadmintonSmashSnapshot
  | BilliardsSnookerSnapshot
  | TetherJoustSnapshot;
