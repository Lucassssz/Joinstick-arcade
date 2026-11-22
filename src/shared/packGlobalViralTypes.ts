export type PackGlobalViralCardGameId =
  | 'word-pulse'
  | 'trivia-blitz'
  | 'codenames-grid'
  | 'fib-party';

export type PackGlobalViralGameId =
  | 'sky-climb'
  | 'slither-feast'
  | 'blob-devour'
  | 'turf-ribbon'
  | 'glass-bridge'
  | 'tug-titan'
  | 'flappy-flock'
  | 'dino-dash'
  | 'tile-2048-blitz'
  | 'mine-sweep-duel'
  | 'geo-pin-rush'
  | 'wavelength-sync'
  | PackGlobalViralCardGameId;

// 1. Sky Climb (#27 replacement — Only Up! / Chained Together parkour)
export interface SkyClimbSnapshot {
  gameId: 'sky-climb';
  timeLeft: number;
  totalTime: number;
  cameraY: number;
  goalHeight: number;
  platforms: {
    id: string;
    x: number;
    y: number;
    w: number;
    kind: 'beam' | 'cloud' | 'moving' | 'boost' | 'crumble';
    broken?: boolean;
  }[];
  collectibles: { id: string; x: number; y: number; value: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    altitude: number;
    bestAltitude: number;
    grounded: boolean;
    grappling: boolean;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 2. Slither Feast (Slither.io)
export interface SlitherFeastSnapshot {
  gameId: 'slither-feast';
  timeLeft: number;
  totalTime: number;
  pellets: { x: number; y: number; r: number; colorHex: string; value: number }[];
  snakes: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    alive: boolean;
    respawnTimer: number;
    boosting: boolean;
    angle: number;
    length: number;
    score: number;
    kills: number;
    segments: { x: number; y: number }[];
    cooldownA: number;
    cooldownB: number;
  }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    score: number;
    alive: boolean;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 3. Blob Devour (Agar.io)
export interface BlobDevourSnapshot {
  gameId: 'blob-devour';
  timeLeft: number;
  totalTime: number;
  pellets: { x: number; y: number; colorHex: string; value: number }[];
  viruses: { x: number; y: number; r: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    r: number;
    mass: number;
    splitTimer: number;
    alive: boolean;
    score: number;
    eats: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 4. Turf Ribbon (Paper.io)
export interface TurfRibbonSnapshot {
  gameId: 'turf-ribbon';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  cells: number[]; // -1 neutral, or slotIndex
  trails: number[]; // -1 none, or slotIndex
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    dirX: number;
    dirY: number;
    alive: boolean;
    respawnTimer: number;
    territoryPct: number;
    score: number;
    kills: number;
    boostTimer: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 5. Glass Bridge (Squid Game)
export interface GlassBridgeSnapshot {
  gameId: 'glass-bridge';
  timeLeft: number;
  totalTime: number;
  totalSteps: number;
  panels: {
    step: number;
    lane: 0 | 1;
    state: 'unknown' | 'safe-revealed' | 'shattered';
  }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    step: number; // -1 start .. totalSteps finish
    lane: 0 | 1;
    x: number;
    y: number;
    alive: boolean;
    falling: boolean;
    finished: boolean;
    respawnTimer: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 6. Tug Titan (Tug-of-War)
export interface TugTitanSnapshot {
  gameId: 'tug-titan';
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  ropeOffset: number; // -1 (Left wins) .. +1 (Right wins)
  leftPower: number;
  rightPower: number;
  leftWins: number;
  rightWins: number;
  pulseZone: number; // 0..1 timing rhythm bar
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    team: 'left' | 'right';
    pulling: boolean;
    anchorActive: boolean;
    stamina: number;
    pulls: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 7. Flappy Flock (Flappy Bird Multiplayer)
export interface FlappyFlockSnapshot {
  gameId: 'flappy-flock';
  timeLeft: number;
  totalTime: number;
  scrollX: number;
  pipes: { x: number; gapY: number; gapH: number; hasRing: boolean; ringTaken?: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vy: number;
    alive: boolean;
    respawnTimer: number;
    dashTimer: number;
    pipesCleared: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 8. Dino Dash (Chrome Dino Multiplayer)
export interface DinoDashSnapshot {
  gameId: 'dino-dash';
  timeLeft: number;
  totalTime: number;
  speed: number;
  distance: number;
  nightMode: boolean;
  obstacles: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    kind: 'cactus-sm' | 'cactus-lg' | 'ptero-high' | 'ptero-low' | 'star';
  }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vy: number;
    ducking: boolean;
    grounded: boolean;
    stunTimer: number;
    streak: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 9. 2048 Blitz
export interface Tile2048BlitzSnapshot {
  gameId: 'tile-2048-blitz';
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    grid: number[]; // 16 tiles
    maxTile: number;
    frozenTimer: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 10. Mine Sweep Duel
export interface MineSweepDuelSnapshot {
  gameId: 'mine-sweep-duel';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  cells: {
    state: 'hidden' | 'revealed' | 'flagged' | 'exploded';
    adj: number;
    ownerSlot: number; // -1 none
  }[];
  minesLeft: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    col: number;
    row: number;
    stunTimer: number;
    flagsCorrect: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 11. Geo Pin Rush (GeoGuessr)
export interface GeoPinRushSnapshot {
  gameId: 'geo-pin-rush';
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'guessing' | 'reveal';
  clueTitle: string;
  clueTitleZh: string;
  clueHint: string;
  clueHintZh: string;
  clueEmoji: string;
  targetX: number; // 0..1 on world map
  targetY: number; // 0..1 on world map
  targetCity: string;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number; // 0..1
    y: number; // 0..1
    locked: boolean;
    lastDistKm: number | null;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 12. Mind Dial (Wavelength)
export interface WavelengthSyncSnapshot {
  gameId: 'wavelength-sync';
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'dialing' | 'reveal';
  leftLabel: string;
  leftLabelZh: string;
  rightLabel: string;
  rightLabelZh: string;
  clueText: string;
  clueTextZh: string;
  targetAngle: number; // 0..1
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    dial: number; // 0..1
    locked: boolean;
    lastGain: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 13. Word Pulse (Wordle — Private Phone)
export interface WordPulseSnapshot {
  gameId: 'word-pulse';
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  attempt: number;
  maxAttempts: number;
  categoryHint: string;
  categoryHintZh: string;
  revealedWord: string | null;
  rows: {
    word: string;
    marks: ('correct' | 'present' | 'absent')[];
    pickerName: string;
    pickerColor: string;
  }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    solved: boolean;
    lastPick: string | null;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 14. Trivia Blitz (Kahoot! — Private Phone)
export interface TriviaBlitzSnapshot {
  gameId: 'trivia-blitz';
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'question' | 'reveal';
  category: string;
  question: string;
  questionZh: string;
  options: { label: string; labelZh: string; colorHex: string }[];
  correctIdx: number | null;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    answered: boolean;
    pickedIdx: number | null;
    streak: number;
    lastGain: number;
    score: number;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 15. Code Grid (Codenames — Private Phone)
export interface CodeGridSnapshot {
  gameId: 'codenames-grid';
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  clueWord: string;
  clueWordZh: string;
  clueCount: number;
  foundCount: number;
  cards: {
    id: string;
    word: string;
    wordZh: string;
    kind: 'agent' | 'neutral' | 'assassin';
    revealed: boolean;
    pickedByColor: string | null;
  }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    correctPicks: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

// 16. Bluff Trivia (Fibbage — Private Phone)
export interface FibPartySnapshot {
  gameId: 'fib-party';
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'write-fib' | 'guess-truth' | 'reveal';
  prompt: string;
  promptZh: string;
  truthAnswer: string | null;
  choices: {
    id: string;
    text: string;
    textZh: string;
    isTruth?: boolean;
    authorName?: string;
    voterColors: string[];
  }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    submitted: boolean;
    fooledCount: number;
    score: number;
    lastAction?: string;
    cooldownA: number;
    cooldownB: number;
  }[];
  banner: string | null;
}

export type PackGlobalViralSnapshot =
  | SkyClimbSnapshot
  | SlitherFeastSnapshot
  | BlobDevourSnapshot
  | TurfRibbonSnapshot
  | GlassBridgeSnapshot
  | TugTitanSnapshot
  | FlappyFlockSnapshot
  | DinoDashSnapshot
  | Tile2048BlitzSnapshot
  | MineSweepDuelSnapshot
  | GeoPinRushSnapshot
  | WavelengthSyncSnapshot
  | WordPulseSnapshot
  | TriviaBlitzSnapshot
  | CodeGridSnapshot
  | FibPartySnapshot;
