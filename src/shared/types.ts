import type { MutatorId } from './modifiers.ts';
import type { TeamId, TeamMode, TeamStanding } from './party.ts';
import type {
  PackMalaysianCardGameId,
  PackMalaysianGameId,
  PackMalaysianSnapshot,
  PlayingCardRank,
} from './packMalaysianTypes.ts';
import type {
  PackChineseViralCardGameId,
  PackChineseViralGameId,
  PackChineseViralSnapshot,
} from './packChineseViralTypes.ts';
import type {
  PackGlobalViralCardGameId,
  PackGlobalViralGameId,
  PackGlobalViralSnapshot,
} from './packGlobalViralTypes.ts';
import type {
  PackRetroArcadeGameId,
  PackRetroArcadeSnapshot,
} from './packRetroArcadeTypes.ts';
import type {
  PackSportsPhysicsGameId,
  PackSportsPhysicsSnapshot,
} from './packSportsPhysicsTypes.ts';
import type {
  PackChaosSurvivalGameId,
  PackChaosSurvivalSnapshot,
} from './packChaosSurvivalTypes.ts';
import type {
  PackStrategyCardGameId,
  PackStrategyGameId,
  PackStrategySnapshot,
} from './packStrategyClassicsTypes.ts';

export * from './packMalaysianTypes.ts';
export * from './packChineseViralTypes.ts';
export * from './packGlobalViralTypes.ts';
export * from './packRetroArcadeTypes.ts';
export * from './packSportsPhysicsTypes.ts';
export * from './packChaosSurvivalTypes.ts';
export * from './packStrategyClassicsTypes.ts';

export type GameId =
  | 'bumper-brawl'
  | 'astro-blaster'
  | 'turbo-drift'
  | 'hex-drop'
  | 'fuse-pass'
  | 'grid-runners'
  | 'ricochet-tanks'
  | 'turbo-striker'
  | 'paint-rush'
  | 'laser-gauntlet'
  | 'vault-heist'
  | 'hyper-pong'
  | 'blade-duel'
  | 'cannon-siege'
  | 'crown-heist'
  | 'freeze-tag'
  | 'ghost-hunt'
  | 'meteor-swarm'
  | 'hook-shot'
  | 'gravity-flip'
  | 'rich-street'
  | 'jungle-ladders'
  | 'bomb-grid'
  | 'red-light-dash'
  | 'color-match'
  | 'kitchen-rush'
  | 'treasure-dig'
  | 'fruit-drop'
  | 'lucky-auction'
  | 'pinball-clash'
  | 'color-clash'
  | 'liars-deck'
  | 'volley-smash'
  | 'lava-hopper'
  | 'ludo-royale'
  | 'star-party-board'
  | 'reversi-clash'
  | 'four-in-a-row'
  | 'naval-salvo'
  | 'neon-checkers'
  | 'carrom-arena'
  | 'dungeon-crawl-board'
  | 'boom-kittens'
  | 'property-deal'
  | 'flip-seven'
  | 'royal-bluff'
  | 'dark-flip-clash'
  | 'sushi-draft'
  | PackMalaysianGameId
  | PackChineseViralGameId
  | PackGlobalViralGameId
  | PackRetroArcadeGameId
  | PackSportsPhysicsGameId
  | PackChaosSurvivalGameId
  | PackStrategyGameId;

export type CardGameId =
  | 'color-clash'
  | 'liars-deck'
  | 'boom-kittens'
  | 'property-deal'
  | 'flip-seven'
  | 'royal-bluff'
  | 'dark-flip-clash'
  | 'sushi-draft'
  | PackMalaysianCardGameId
  | PackChineseViralCardGameId
  | PackGlobalViralCardGameId
  | PackStrategyCardGameId;

export type RoomStatus =
  | 'SETUP'
  | 'LOBBY'
  | 'VOTING'
  | 'BRIEFING'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'PAUSED'
  | 'RESULTS';

export type BotDifficulty = 'chill' | 'arcade' | 'spicy';

export type GameGenre = 'arcade' | 'board' | 'card';
export type GameSuitability = 'solo' | 'double' | 'multiplayer';
export type PlayerFilterMode = 'all' | 'heritage' | GameGenre | GameSuitability;
export type RemoteDirection = 'up' | 'down' | 'left' | 'right' | 'ok';
export type LobbyFocusZone = 'filter' | 'games' | 'actions';

export interface RemoteFocusState {
  zone: LobbyFocusZone;
  index: number;
  modalIndex: number;
}

export interface PlayerColorSpec {
  id: string;
  name: string;
  hex: string;
  dark: string;
  textOnColor: string;
}

export const PLAYER_PALETTE: PlayerColorSpec[] = [
  { id: 'vermilion', name: 'Coral Red', hex: '#FF4D2E', dark: '#B82E17', textOnColor: '#FFFFFF' },
  { id: 'cyan', name: 'Electric Cyan', hex: '#00C2FF', dark: '#007FA8', textOnColor: '#0B1219' },
  { id: 'amber', name: 'Solar Gold', hex: '#FFB800', dark: '#B58100', textOnColor: '#14120B' },
  { id: 'mint', name: 'Vivid Mint', hex: '#10D98B', dark: '#0A915D', textOnColor: '#0A1913' },
  { id: 'magenta', name: 'Hot Magenta', hex: '#FF3B9A', dark: '#B31C67', textOnColor: '#FFFFFF' },
  { id: 'tangerine', name: 'Tangerine', hex: '#FF7A1A', dark: '#B54F06', textOnColor: '#140F0A' },
  { id: 'cobalt', name: 'Sky Cobalt', hex: '#528BFF', dark: '#2759BF', textOnColor: '#FFFFFF' },
  { id: 'lime', name: 'Arcade Lime', hex: '#9EE622', dark: '#679910', textOnColor: '#12190A' },
];

export const MAX_PLAYERS_PER_ROOM = 8;
export const ARENA_WIDTH = 1200;
export const ARENA_HEIGHT = 720;

export interface ActionButtonSpec {
  label: string;
  sublabel: string;
  colorHex: string;
  darkHex: string;
  textColor: string;
  icon:
    | 'zap'
    | 'waves'
    | 'crosshair'
    | 'flame'
    | 'gauge'
    | 'wind'
    | 'arrow-up'
    | 'bomb'
    | 'target'
    | 'shield'
    | 'paintbrush'
    | 'footprints';
}

export interface ControllerSchema {
  joystickMode: 'analog-360';
  joystickLabel: string;
  actionA: ActionButtonSpec;
  actionB: ActionButtonSpec;
  controlTip: string;
}

export interface GameMetadata {
  id: GameId;
  name: string;
  genre?: GameGenre;
  category: string;
  tagline: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  suitableFor: GameSuitability[];
  playerModeLabel: string;
  coverImage: string;
  accentHex: string;
  rules: string[];
  controllerSchema: ControllerSchema;
  settingLabel: string;
  settingOptions: { label: string; value: number }[];
  defaultSetting: number;
}

export interface ControllerInput {
  dx: number; // -1 to 1
  dy: number; // -1 to 1
  a: boolean;
  b: boolean;
}

export interface PlayerMatchStats {
  wins: number;
  cardWins: number;
  matchesPlayed: number;
  totalActions: number;
  cardActions: number;
  cardResponses: number;
  totalCardResponseMs: number;
  avgCardResponseMs: number | null;
  lastCardResponseMs: number | null;
  fastestCardResponseMs: number | null;
}

export interface PlayerSummary {
  id: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
  avatarId: string;
  teamId: TeamId | null;
  connected: boolean;
  ready: boolean;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
  score: number;
  alive: boolean;
  statText: string;
  cooldownA: number; // 0 (ready) to 1 (cooling)
  cooldownB: number; // 0 (ready) to 1 (cooling)
  matchStats?: PlayerMatchStats;
}

export interface RankingEntry {
  playerId: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
  avatarId?: string;
  teamId?: TeamId | null;
  rank: number;
  score: number;
  highlight: string;
}

export interface SoundEvent {
  type:
    | 'join'
    | 'ready'
    | 'countdown'
    | 'go'
    | 'bump'
    | 'pulse'
    | 'ko'
    | 'shoot'
    | 'hit'
    | 'pickup'
    | 'boost'
    | 'lap'
    | 'win'
    | 'nav'
    | 'confirm'
    | 'frenzy'
    | 'wheel'
    | 'card'
    | 'bluff';
  playerId?: string;
  intensity?: number;
}

// --- Game-Specific Authoritative Snapshots ---

export interface BumperPlayerState {
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
  alive: boolean;
  dashTimer: number;
  pulseTimer: number;
  giantTimer?: number;
  shockTimer?: number;
  streak?: number;
  cooldownA: number;
  cooldownB: number;
  kos: number;
  score: number;
}

export interface BumperPowerupState {
  id: string;
  kind: 'giant' | 'shock' | 'star';
  x: number;
  y: number;
}

export interface BumperBrawlSnapshot {
  gameId: 'bumper-brawl';
  round: number;
  totalRounds: number;
  roundTimer: number;
  ringRadius: number;
  maxRingRadius: number;
  ringCenterX: number;
  ringCenterY: number;
  roundBanner: string | null;
  pylons: { x: number; y: number; r: number }[];
  powerups?: BumperPowerupState[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  shockwaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  players: BumperPlayerState[];
}

export interface AstroShipState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  shieldTimer: number;
  rapidTimer: number;
  tripleTimer?: number;
  pierceTimer?: number;
  boostTimer: number;
  cooldownA: number;
  cooldownB: number;
  kills: number;
  score: number;
}

export interface AstroBulletState {
  id: string;
  ownerId: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pierce?: boolean;
}

export interface AstroPickupState {
  id: string;
  kind: 'shield' | 'rapid' | 'heal' | 'triple' | 'pierce';
  x: number;
  y: number;
}

export interface AstroBlasterSnapshot {
  gameId: 'astro-blaster';
  timeLeft: number;
  totalTime: number;
  asteroids: { x: number; y: number; r: number; seed: number }[];
  crystals?: { id: string; x: number; y: number; r: number; hp: number; maxHp: number }[];
  vortex?: { x: number; y: number; r: number; active: boolean; timer: number } | null;
  pickups: AstroPickupState[];
  bullets: AstroBulletState[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: AstroShipState[];
}

export interface DriftCarState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  speed: number;
  drifting: boolean;
  boosting: boolean;
  drafting?: boolean;
  slipping?: boolean;
  nitro: number; // 0 to 1
  lap: number;
  totalLaps: number;
  checkpoint: number;
  progress: number;
  finished: boolean;
  finishTimeMs: number | null;
  position: number;
  falling: boolean;
  fallProgress: number; // 0 to 1 while falling off track
  respawnBlink: number; // > 0 briefly after respawning
  coins?: number;
  cooldownA: number;
  cooldownB: number;
}

export interface TurboDriftSnapshot {
  gameId: 'turbo-drift';
  elapsedMs: number;
  totalLaps: number;
  finishCountdown: number | null;
  trackPoints: { x: number; y: number }[];
  trackHalfWidth: number;
  boostPads: { x: number; y: number; angle: number }[];
  coins?: { id: string; x: number; y: number; kind: 'coin' | 'mystery' }[];
  oils?: { x: number; y: number; r: number }[];
  players: DriftCarState[];
}

// --- 4. Hex Drop ---
export interface HexTileState {
  id: number;
  x: number;
  y: number;
  radius: number;
  kind?: 'normal' | 'gold' | 'spring' | 'ice';
  targeted?: boolean;
  state: 'solid' | 'cracking' | 'falling' | 'gone';
  progress: number; // 0..1 within current state
}

export interface HexPlayerState {
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
  leapTimer: number; // > 0 when airborne
  leapDuration: number;
  shoveTimer: number;
  falling: boolean;
  fallProgress: number;
  cooldownA: number;
  cooldownB: number;
  score: number;
  roundsWon: number;
}

export interface HexDropSnapshot {
  gameId: 'hex-drop';
  round: number;
  totalRounds: number;
  roundTimer: number;
  roundBanner: string | null;
  tiles: HexTileState[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  shoveWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  players: HexPlayerState[];
}

// --- 5. Fuse Pass ---
export interface FusePlayerState {
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
  hasBomb: boolean;
  sprintTimer: number;
  lungeTimer: number;
  immuneTimer: number;
  shieldTimer?: number;
  speedBuffTimer?: number;
  cooldownA: number;
  cooldownB: number;
  score: number;
  passes: number;
}

export interface FusePickupState {
  id: string;
  kind: 'speed' | 'shield' | 'chill';
  x: number;
  y: number;
}

export interface FusePassSnapshot {
  gameId: 'fuse-pass';
  round: number;
  totalRounds: number;
  bombHolderId: string | null;
  bombTimer: number;
  bombMaxTime: number;
  roundBanner: string | null;
  pillars: { x: number; y: number; r: number }[];
  pickups?: FusePickupState[];
  jumpPads?: { x: number; y: number; r: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  players: FusePlayerState[];
}

// --- 6. Grid Runners ---
export interface GridRunnerPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  angle: number;
  speed: number;
  alive: boolean;
  overdriveTimer: number;
  hopTimer: number;
  hopDuration: number;
  cooldownA: number;
  cooldownB: number;
  score: number;
  roundsWon: number;
}

export interface GridTrailPoint {
  x: number;
  y: number;
  gap?: boolean;
}

export interface GridPickupState {
  id: string;
  kind: 'energy' | 'emp' | 'score';
  x: number;
  y: number;
}

export interface GridRunnersSnapshot {
  gameId: 'grid-runners';
  round: number;
  totalRounds: number;
  roundTimer: number;
  roundBanner: string | null;
  trails: { playerId: string; colorHex: string; points: GridTrailPoint[] }[];
  pickups?: GridPickupState[];
  obstacles?: { x: number; y: number; w: number; h: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  players: GridRunnerPlayerState[];
}

// --- 7. Ricochet Tanks ---
export interface TankPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  hullAngle: number;
  turretAngle: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  respawnTimer: number;
  shieldTimer: number;
  tripleTimer?: number;
  speedTimer?: number;
  cooldownA: number;
  cooldownB: number;
  kills: number;
  bankKills: number;
  score: number;
}

export interface TankShellState {
  id: string;
  ownerId: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bounces: number;
  maxBounces: number;
}

export interface TankMineState {
  id: string;
  ownerId: string;
  colorHex: string;
  x: number;
  y: number;
  armed: boolean;
}

export interface RicochetTanksSnapshot {
  gameId: 'ricochet-tanks';
  timeLeft: number;
  totalTime: number;
  walls: { x: number; y: number; w: number; h: number }[];
  crates?: { id: string; x: number; y: number; r: number; hp: number; maxHp: number }[];
  pickups?: { id: string; kind: 'triple' | 'speed' | 'shield'; x: number; y: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  shells: TankShellState[];
  mines: TankMineState[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  players: TankPlayerState[];
}

// --- 8. Turbo Striker ---
export interface StrikerPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  team: 'red' | 'blue';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  tackleTimer: number;
  kickRingTimer: number;
  megaKickTimer?: number;
  speedTimer?: number;
  cooldownA: number;
  cooldownB: number;
  goals: number;
  score: number;
}

export interface StrikerBallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  spin: number;
  lastTouchColor: string | null;
}

export interface TurboStrikerSnapshot {
  gameId: 'turbo-striker';
  timeLeft: number;
  totalTime: number;
  scoreRed: number;
  scoreBlue: number;
  goldenTime?: boolean;
  goalBanner: string | null;
  goalBannerColor: string | null;
  ball: StrikerBallState;
  bonusBalls?: StrikerBallState[];
  powerups?: { id: string; kind: 'mega-kick' | 'speed' | 'twin-ball'; x: number; y: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: StrikerPlayerState[];
}

// --- 9. Paint Rush ---
export interface PaintPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  slideTimer: number;
  wideTimer?: number;
  turboTimer?: number;
  cooldownA: number;
  cooldownB: number;
  tilesOwned: number;
  percent: number;
  score: number;
}

export interface PaintRushSnapshot {
  gameId: 'paint-rush';
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  grid: number[]; // -1 unpainted, 0..7 slotIndex
  bonusCells?: number[];
  pickups?: { id: string; kind: 'wide' | 'bomb' | 'turbo'; x: number; y: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  splashes: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  players: PaintPlayerState[];
}

// --- 10. Laser Gauntlet ---
export interface LaserGauntletPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  blinkTimer: number;
  invulnTimer: number;
  magnetTimer?: number;
  shieldCharges?: number;
  combo: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface LaserGauntletSnapshot {
  gameId: 'laser-gauntlet';
  timeLeft: number;
  totalTime: number;
  wave: number;
  overdrive?: boolean;
  slowMoTimer: number;
  coreAngle: number;
  beams: { angle: number; width: number; state: 'warn' | 'active'; progress: number }[];
  rings: { radius: number; maxRadius: number; thickness: number; alpha: number }[];
  orbs: { id: string; x: number; y: number; r: number }[];
  shards: { id: string; x: number; y: number; value: number; pulse: number }[];
  powerups?: { id: string; kind: 'magnet' | 'shield' | 'star'; x: number; y: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LaserGauntletPlayerState[];
}

// --- 11. Vault Heist ---
export interface VaultPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  angle: number;
  dashTimer: number;
  invulnTimer: number;
  overchargeTimer?: number;
  carrying: number;
  banked: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface VaultHeistSnapshot {
  gameId: 'vault-heist';
  timeLeft: number;
  totalTime: number;
  lockdown?: boolean;
  walls: { x: number; y: number; w: number; h: number }[];
  spikes: { x: number; y: number; w: number; h: number; state: 'idle' | 'warn' | 'active'; disabledTimer: number }[];
  lasers: { x1: number; y1: number; x2: number; y2: number; state: 'off' | 'warn' | 'active'; disabledTimer: number }[];
  drones: { x: number; y: number; r: number; angle: number; disabledTimer: number }[];
  relics: { id: string; x: number; y: number; value: number; kind?: 'gem' | 'crown' }[];
  pickups?: { id: string; kind: 'emp-cell' | 'cloak'; x: number; y: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  portal: { x: number; y: number; r: number };
  hackWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  players: VaultPlayerState[];
}

// --- 12. Hyper Pong ---
export interface HyperPongPaddleState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  side: 'left' | 'right';
  isBot?: boolean;
  x: number;
  y: number;
  radius: number;
  smashTimer: number;
  magnetTimer: number;
  giantTimer?: number;
  fireTimer?: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface HyperPongSnapshot {
  gameId: 'hyper-pong';
  targetScore: number;
  scoreLeft: number;
  scoreRight: number;
  goalBanner: string | null;
  goalBannerColor: string | null;
  puck: { x: number; y: number; vx: number; vy: number; radius: number; hot: boolean; trail: { x: number; y: number }[] };
  extraPucks?: { x: number; y: number; vx: number; vy: number; radius: number; hot: boolean; trail: { x: number; y: number }[] }[];
  powerOrb?: { x: number; y: number; kind: 'multiball' | 'giant' | 'fire' } | null;
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  bumpers: { x: number; y: number; r: number; flash: number }[];
  players: HyperPongPaddleState[];
}

// --- 13. Blade Duel ---
export interface BladeDuelPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  invulnTimer: number;
  slashTimer: number;
  parryTimer: number;
  stunTimer: number;
  waveTimer?: number;
  windTimer?: number;
  roundsWon: number;
  parries: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface BladeDuelSnapshot {
  gameId: 'blade-duel';
  round: number;
  targetWins: number;
  roundTimer: number;
  roundBanner: string | null;
  dangerRadius?: number;
  pillars: { x: number; y: number; r: number }[];
  scrolls?: { id: string; kind: 'blade-wave' | 'wind-step' | 'heart'; x: number; y: number }[];
  waveProjectiles?: { x: number; y: number; angle: number; colorHex: string }[];
  slashes: { x: number; y: number; angle: number; colorHex: string; alpha: number }[];
  sparks: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: BladeDuelPlayerState[];
}

// --- 14. Cannon Siege ---
export interface CannonPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  side: 'left' | 'right';
  isBot?: boolean;
  x: number;
  y: number;
  aimAngle: number;
  coreHp: number;
  maxCoreHp: number;
  shieldTimer: number;
  tripleTimer?: number;
  heavyCharges?: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface CannonSiegeSnapshot {
  gameId: 'cannon-siege';
  timeLeft: number;
  totalTime: number;
  blocks: { id: number; side: 'left' | 'right'; x: number; y: number; w: number; h: number; hp: number; maxHp: number }[];
  cores: { side: 'left' | 'right'; x: number; y: number; r: number; hp: number; maxHp: number; colorHex: string }[];
  pickups?: { id: string; kind: 'triple-shot' | 'bunker-buster'; x: number; y: number; r: number }[];
  goldenTarget?: { x: number; y: number; r: number } | null;
  shells: { id: string; ownerId: string; colorHex: string; x: number; y: number; vx: number; vy: number; r: number; heavy?: boolean }[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: CannonPlayerState[];
}

// --- 15. Crown Heist ---
export interface CrownPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  x: number;
  y: number;
  angle: number;
  hasCrown: boolean;
  tackleTimer: number;
  stunTimer: number;
  stealGraceTimer: number;
  boostTimer?: number;
  score: number;
  steals: number;
  cooldownA: number;
  cooldownB: number;
}

export interface CrownHeistSnapshot {
  gameId: 'crown-heist';
  timeLeft: number;
  totalTime: number;
  crownX: number;
  crownY: number;
  crownHolderId: string | null;
  crownFrenzy?: boolean;
  obstacles: { x: number; y: number; r: number }[];
  pickups?: { id: string; kind: 'speed-crown' | 'shock-orb' | 'gold-coin'; x: number; y: number }[];
  waves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: CrownPlayerState[];
}

// --- 16. Freeze Tag Arena ---
export interface FreezePlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  role: 'hunter' | 'runner';
  x: number;
  y: number;
  angle: number;
  frozen: boolean;
  dashTimer: number;
  immuneTimer: number;
  skateTimer?: number;
  auraTimer?: number;
  saves: number;
  freezes: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface FreezeTagSnapshot {
  gameId: 'freeze-tag';
  timeLeft: number;
  totalTime: number;
  frozenCount: number;
  runnerCount: number;
  banner: string | null;
  bolts: { id: string; x: number; y: number; vx: number; vy: number }[];
  traps: { id: string; x: number; y: number; r: number; alpha: number }[];
  icePatches?: { x: number; y: number; r: number }[];
  pickups?: { id: string; kind: 'thaw-star' | 'turbo-skates' | 'frost-aura'; x: number; y: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pillars: { x: number; y: number; r: number }[];
  players: FreezePlayerState[];
}

// --- 17. Ghost Hunt ---
export interface GhostPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  role: 'ghost' | 'hunter';
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  hp: number;
  maxHp: number;
  visibility: number; // 0 (invisible) .. 1 (fully revealed)
  dashTimer: number;
  flareTimer?: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface GhostHuntSnapshot {
  gameId: 'ghost-hunt';
  timeLeft: number;
  totalTime: number;
  banner: string | null;
  walls: { x: number; y: number; w: number; h: number }[];
  nets: { id: string; x: number; y: number; r: number; colorHex: string }[];
  pings: { x: number; y: number; radius: number; maxRadius: number; alpha: number }[];
  orbs?: { id: string; kind: 'flare' | 'ecto'; x: number; y: number }[];
  decoys?: { x: number; y: number; alpha: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: GhostPlayerState[];
}

// --- 18. Meteor Swarm ---
export interface MeteorPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  downed: boolean;
  reviveProgress: number;
  novaTimer: number;
  spreadTimer?: number;
  rapidTimer?: number;
  kills: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface MeteorSwarmSnapshot {
  gameId: 'meteor-swarm';
  timeLeft: number;
  totalTime: number;
  wave: number;
  coreHp: number;
  maxCoreHp: number;
  teamScore: number;
  meteors: { id: string; kind: 'rock' | 'ufo'; x: number; y: number; r: number; hp: number; maxHp: number; angle: number }[];
  bullets: { id: string; x: number; y: number; colorHex: string; enemy?: boolean }[];
  pickups?: { id: string; kind: 'spread-shot' | 'core-repair' | 'overcharge'; x: number; y: number }[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: MeteorPlayerState[];
}

// --- 19. Hook Shot ---
export interface HookPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  falling: boolean;
  fallProgress: number;
  respawnTimer: number;
  parryTimer: number;
  hookedBy: string | null;
  kos: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
  longHookTimer?: number;
  speedTimer?: number;
}

export interface HookLineState {
  ownerId: string;
  colorHex: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  state: 'extending' | 'retracting' | 'pulling';
}

export interface HookShotSnapshot {
  gameId: 'hook-shot';
  timeLeft: number;
  totalTime: number;
  islands: { x: number; y: number; w: number; h: number }[];
  hooks: HookLineState[];
  waves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  coins?: { id: string; x: number; y: number; value: number }[];
  pickups?: { id: string; x: number; y: number; kind: 'long-hook' | 'speed-anchor' }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: HookPlayerState[];
}

// --- 20. Gravity Flip ---
export interface GravityPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  gravityDir: 1 | -1; // 1 = floor, -1 = ceiling
  alive: boolean;
  phaseTimer: number;
  distance: number;
  coins: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
  magnetTimer?: number;
  overdriveTimer?: number;
}

export interface GravityFlipSnapshot {
  gameId: 'gravity-flip';
  timeLeft: number;
  totalTime: number;
  speed: number;
  scrollX: number;
  floorY: number;
  ceilingY: number;
  obstacles: { id: string; kind: 'saw' | 'barrier' | 'gap'; x: number; y: number; w: number; h: number; side: 'floor' | 'ceiling' | 'mid' }[];
  coins: { id: string; x: number; y: number; r: number; golden?: boolean }[];
  gates?: { id: string; x: number; y: number; h: number; triggered?: boolean }[];
  pickups?: { id: string; x: number; y: number; kind: 'magnet' | 'overdrive' }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: GravityPlayerState[];
}

// --- 21. Rich Street (Monopoly-Style Fast Board Game) ---
export interface RichStreetTileState {
  index: number;
  kind: 'go' | 'property' | 'chance' | 'tax' | 'jail' | 'jackpot';
  name: string;
  groupColor: string;
  price: number;
  baseRent: number;
  ownerId: string | null;
  ownerColor: string | null;
  level: number; // 0 unowned, 1 shop, 2 plaza, 3 tower
  monopoly?: boolean;
}

export interface RichStreetPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  tileIndex: number;
  visualTile: number;
  cash: number;
  netWorth: number;
  propertiesOwned: number;
  jailTurns: number;
  luckyCharge: number; // 0..100
  rentShield: boolean;
  bankrupt: boolean;
  cooldownA: number;
  cooldownB: number;
}

export interface RichStreetSnapshot {
  gameId: 'rich-street';
  round: number;
  totalRounds: number;
  activePlayerId: string;
  phase: 'wait-roll' | 'rolling' | 'moving' | 'decision' | 'event';
  turnTimeLeft: number;
  dice: [number, number];
  diceRolling: boolean;
  jackpotPool: number;
  decisionTileIndex: number | null;
  decisionAction: 'buy' | 'upgrade' | null;
  decisionCost: number;
  banner: string | null;
  eventText: string | null;
  tiles: RichStreetTileState[];
  players: RichStreetPlayerState[];
}

// --- 22. Jungle Ladders (Snakes & Ladders Party) ---
export interface JungleLaddersPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  tile: number; // 1..100
  visualTile: number;
  slideFrom: number | null;
  slideTo: number | null;
  slideProgress: number; // 0..1
  trickReady: boolean;
  boostQueued: boolean;
  shielded?: boolean;
  climbs: number;
  slides: number;
  cooldownA: number;
  cooldownB: number;
}

export interface JungleLaddersSnapshot {
  gameId: 'jungle-ladders';
  targetTile: number;
  activePlayerId: string;
  phase: 'wait-roll' | 'rolling' | 'moving' | 'sliding' | 'event';
  turnTimeLeft: number;
  powerMeter: number; // 0..1 oscillating timing bar
  diceValue: number;
  diceRolling: boolean;
  banner: string | null;
  eventText: string | null;
  ladders: { from: number; to: number }[];
  snakes: { from: number; to: number; colorHex: string }[];
  mysteryTiles: number[];
  goldenTiles?: number[];
  bananas: number[];
  players: JungleLaddersPlayerState[];
}

// --- 23. Bomb Grid (Bomberman-Style Maze) ---
export interface BombGridPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  maxBombs: number;
  blastRange: number;
  speedBonus: number;
  kos: number;
  score: number;
  roundsWon: number;
  cooldownA: number;
  cooldownB: number;
  hasShield?: boolean;
  megaBombs?: number;
}

export interface BombGridSnapshot {
  gameId: 'bomb-grid';
  round: number;
  totalRounds: number;
  roundTimer: number;
  roundBanner: string | null;
  cols: number;
  rows: number;
  cells: number[]; // 0 empty, 1 steel wall, 2 wooden crate
  bombs: { id: string; ownerId: string; col: number; row: number; x: number; y: number; fuse: number; maxFuse: number; range: number; colorHex: string }[];
  flames: { col: number; row: number; alpha: number; colorHex: string }[];
  powerups: { id: string; col: number; row: number; kind: 'flame' | 'bomb' | 'speed' | 'shield' | 'mega' }[];
  suddenDeath?: boolean;
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: BombGridPlayerState[];
}

// --- 24. Red Light Dash ---
export interface RedLightPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sprintTimer: number;
  shieldTimer: number;
  zappedTimer: number;
  mudTimer?: number;
  finished: boolean;
  finishOrder: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface RedLightDashSnapshot {
  gameId: 'red-light-dash';
  round: number;
  totalRounds: number;
  roundTimer: number;
  lightState: 'green' | 'yellow' | 'red';
  lightTimer: number;
  finishX: number;
  startX: number;
  banner: string | null;
  zapLines: { x: number; y: number; alpha: number }[];
  puddles?: { id: string; x: number; y: number; rx: number; ry: number }[];
  apples?: { id: string; x: number; y: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: RedLightPlayerState[];
}

// --- 25. Color Match Dance ---
export interface ColorMatchTileState {
  id: number;
  col: number;
  row: number;
  x: number;
  y: number;
  w: number;
  h: number;
  colorIndex: number; // 0 red, 1 cyan, 2 amber, 3 mint
  symbol: 'star' | 'moon' | 'diamond' | 'bolt';
  dropped: boolean;
  warning: boolean;
  bonus?: boolean;
}

export interface ColorMatchPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  falling: boolean;
  fallProgress: number;
  hopTimer: number;
  hopDuration: number;
  shoveTimer: number;
  speedTimer?: number;
  score: number;
  survivedWaves: number;
  cooldownA: number;
  cooldownB: number;
}

export interface ColorMatchSnapshot {
  gameId: 'color-match';
  wave: number;
  totalWaves: number;
  phase: 'preview' | 'scramble' | 'drop';
  phaseTimer: number;
  targetColorIndex: number;
  targetSymbol: 'star' | 'moon' | 'diamond' | 'bolt';
  banner: string | null;
  tiles: ColorMatchTileState[];
  shoveWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  orb?: { x: number; y: number; kind: 'speed' | 'shock' } | null;
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: ColorMatchPlayerState[];
}

// --- 26. Kitchen Rush ---
export type DishKind = 'burger' | 'pizza' | 'taco';
export type KitchenItemStage = 'raw' | 'chopped' | 'cooked' | 'plated';

export interface KitchenOrderState {
  id: string;
  dish: DishKind;
  timeLeft: number;
  maxTime: number;
  points: number;
  vip?: boolean;
}

export interface KitchenStationState {
  id: string;
  kind: 'raw-burger' | 'raw-pizza' | 'raw-taco' | 'chop' | 'grill' | 'sink' | 'serve' | 'trash';
  x: number;
  y: number;
  w: number;
  h: number;
  cookingDish: DishKind | null;
  cookProgress: number; // 0..1
  cookOwnerId: string | null;
  burnProgress?: number; // 0..1 after cooked on grill
  onFire?: boolean;
  dirtyPlates?: number;
  cleanPlates?: number;
}

export interface KitchenPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  angle: number;
  holding: { dish: DishKind; cooked: boolean; stage?: KitchenItemStage; gourmet?: boolean } | null;
  dashTimer: number;
  bootsTimer?: number;
  choppingTimer?: number;
  combo?: number;
  served: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface KitchenRushSnapshot {
  gameId: 'kitchen-rush';
  timeLeft: number;
  totalTime: number;
  teamScore?: number;
  orders: KitchenOrderState[];
  stations: KitchenStationState[];
  flyingPlates: { id: string; dish: DishKind; x: number; y: number; colorHex: string; gourmet?: boolean }[];
  boots?: { id: string; x: number; y: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: KitchenPlayerState[];
}

// --- 27. Treasure Island Dig ---
export interface TreasureSpotState {
  id: string;
  x: number;
  y: number;
  kind: 'gold' | 'gem' | 'crown';
  value: number;
  revealedTimer: number;
}

export interface TreasureCrabState {
  id: string;
  x: number;
  y: number;
  angle: number;
  stunTimer: number;
}

export interface TreasurePlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  angle: number;
  heat: number; // 0..1 proximity to nearest buried chest
  digTimer: number;
  stunTimer: number;
  magnetTimer?: number;
  chestsFound: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface TreasureDigSnapshot {
  gameId: 'treasure-dig';
  timeLeft: number;
  totalTime: number;
  spots: TreasureSpotState[];
  crabs: TreasureCrabState[];
  pickups?: { id: string; x: number; y: number; kind: 'map' | 'magnet' }[];
  dugHoles: { x: number; y: number; success: boolean; alpha: number; colorHex: string }[];
  radars: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: TreasurePlayerState[];
}

// --- 28. Fruit Drop Frenzy ---
export interface FallingItemState {
  id: string;
  kind: 'pineapple' | 'watermelon' | 'berry' | 'star' | 'bomb' | 'magnet';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
}

export interface FruitPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  dashTimer: number;
  bounceTimer: number;
  stunTimer: number;
  magnetTimer?: number;
  combo: number;
  caught: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface FruitDropSnapshot {
  gameId: 'fruit-drop';
  timeLeft: number;
  totalTime: number;
  feverActive?: boolean;
  items: FallingItemState[];
  bounceWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: FruitPlayerState[];
}

// --- 29. Lucky Auction ---
export interface AuctionPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  cash: number;
  treasureValue: number;
  totalWorth: number;
  itemsWon: number;
  draftBid: number;
  passed: boolean;
  cooldownA: number;
  cooldownB: number;
}

export interface LuckyAuctionSnapshot {
  gameId: 'lucky-auction';
  round: number;
  totalRounds: number;
  phase: 'bidding' | 'reveal';
  timer: number;
  chestLabel: string;
  chestClue: string;
  chestVisual: 'royal' | 'wooden' | 'mystery' | 'crystal';
  revealedPrize: 'diamond' | 'crown' | 'gold' | 'ruby' | 'duck' | null;
  revealedValue: number;
  highestBid: number;
  highestBidderId: string | null;
  highestBidderName: string | null;
  highestBidderColor: string | null;
  multiplier?: number;
  banner: string | null;
  players: AuctionPlayerState[];
}

// --- 30. Pinball Clash ---
export interface PinballPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  side: 'left' | 'right';
  isBot?: boolean;
  x: number;
  y: number;
  flipTimer: number;
  bumpTimer: number;
  giantTimer?: number;
  goals: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface PinballBallState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  golden: boolean;
  lastTouchColor: string | null;
  trail: { x: number; y: number }[];
}

export interface PinballClashSnapshot {
  gameId: 'pinball-clash';
  targetGoals: number;
  scoreLeft: number;
  scoreRight: number;
  goalBanner: string | null;
  goalBannerColor: string | null;
  multiballCharge: number; // 0..1
  bumpers: { x: number; y: number; r: number; value: number; flash: number; colorHex: string }[];
  balls: PinballBallState[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: PinballPlayerState[];
}

export type GameSnapshot =
  | BumperBrawlSnapshot
  | AstroBlasterSnapshot
  | TurboDriftSnapshot
  | HexDropSnapshot
  | FusePassSnapshot
  | GridRunnersSnapshot
  | RicochetTanksSnapshot
  | TurboStrikerSnapshot
  | PaintRushSnapshot
  | LaserGauntletSnapshot
  | VaultHeistSnapshot
  | HyperPongSnapshot
  | BladeDuelSnapshot
  | CannonSiegeSnapshot
  | CrownHeistSnapshot
  | FreezeTagSnapshot
  | GhostHuntSnapshot
  | MeteorSwarmSnapshot
  | HookShotSnapshot
  | GravityFlipSnapshot
  | RichStreetSnapshot
  | JungleLaddersSnapshot
  | BombGridSnapshot
  | RedLightDashSnapshot
  | ColorMatchSnapshot
  | KitchenRushSnapshot
  | TreasureDigSnapshot
  | FruitDropSnapshot
  | LuckyAuctionSnapshot
  | PinballClashSnapshot
  | ColorClashSnapshot
  | LiarsDeckSnapshot
  | VolleySmashSnapshot
  | LavaHopperSnapshot
  | LudoRoyaleSnapshot
  | StarPartyBoardSnapshot
  | ReversiClashSnapshot
  | FourInARowSnapshot
  | NavalSalvoSnapshot
  | NeonCheckersSnapshot
  | CarromArenaSnapshot
  | DungeonCrawlBoardSnapshot
  | BoomKittensSnapshot
  | PropertyDealSnapshot
  | FlipSevenSnapshot
  | RoyalBluffSnapshot
  | DarkFlipClashSnapshot
  | SushiDraftSnapshot
  | PackMalaysianSnapshot
  | PackChineseViralSnapshot
  | PackGlobalViralSnapshot
  | PackRetroArcadeSnapshot
  | PackSportsPhysicsSnapshot
  | PackChaosSurvivalSnapshot
  | PackStrategySnapshot;

// --- 33. Volley Smash (Arcade Beach Volleyball) ---
export interface VolleyPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  team: 'red' | 'blue';
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  vz: number;
  spikeTimer: number;
  setTimer: number;
  pointsScored: number;
  saves: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface VolleySmashSnapshot {
  gameId: 'volley-smash';
  targetPoints: number;
  scoreRed: number;
  scoreBlue: number;
  servingTeam: 'red' | 'blue';
  goalBanner: string | null;
  goalBannerColor: string | null;
  ball: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    targetX: number;
    targetY: number;
    hot: boolean;
    lastTouchColor: string | null;
  };
  shockwaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: VolleyPlayerState[];
}

// --- 34. Lava Hopper (Magma Pillar Survival) ---
export interface LavaPillarState {
  id: number;
  x: number;
  y: number;
  r: number;
  state: 'safe' | 'warning' | 'sunk';
  timer: number;
  hasGem?: boolean;
}

export interface LavaHopperPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  angle: number;
  alive: boolean;
  leapTimer: number;
  leapDuration: number;
  stompTimer: number;
  respawnTimer: number;
  gems: number;
  kos: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface LavaHopperSnapshot {
  gameId: 'lava-hopper';
  timeLeft: number;
  totalTime: number;
  wave: number;
  pillars: LavaPillarState[];
  fireballs: { id: string; x: number; y: number; vx: number; vy: number; r: number }[];
  stompWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LavaHopperPlayerState[];
}

// --- 35. Ludo Royale (Cross-Board Token Race) ---
export interface LudoPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  startTrackIndex: number;
  selectedToken: number; // 0..2
  tokens: number[]; // -1 in base, 0..27 main loop steps taken, 28..30 home stretch, 31 finished
  visualSteps: number[];
  finishedCount: number;
  captures: number;
  boostReady: boolean;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface LudoRoyaleSnapshot {
  gameId: 'ludo-royale';
  round: number;
  totalRounds: number;
  activePlayerId: string;
  phase: 'wait-roll' | 'rolling' | 'moving' | 'event';
  turnTimeLeft: number;
  diceValue: number;
  diceRolling: boolean;
  starIndices: number[];
  banner: string | null;
  eventText: string | null;
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LudoPlayerState[];
}

// --- 36. Star Party Island (Mario-Party-Style Star Hunt Board) ---
export interface StarPartyTileState {
  index: number;
  x: number;
  y: number;
  kind: 'coin' | 'lucky' | 'trap' | 'boost' | 'duel';
  label: string;
}

export interface StarPartyPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  tileIndex: number;
  visualTile: number;
  stars: number;
  coins: number;
  candyActive: boolean;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface StarPartyBoardSnapshot {
  gameId: 'star-party-board';
  round: number;
  totalRounds: number;
  activePlayerId: string;
  phase: 'wait-roll' | 'rolling' | 'moving' | 'event';
  turnTimeLeft: number;
  diceValue: number;
  diceRolling: boolean;
  starTileIndex: number;
  starCost: number;
  tiles: StarPartyTileState[];
  banner: string | null;
  eventText: string | null;
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: StarPartyPlayerState[];
}

// --- 37. Reversi Clash (8x8 Tactical Disc Flip Board) ---
export interface ReversiPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  cursorCol: number;
  cursorRow: number;
  discCount: number;
  flipsTotal: number;
  novaCharges: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface ReversiClashSnapshot {
  gameId: 'reversi-clash';
  turnCount: number;
  maxTurns: number;
  activePlayerId: string;
  turnTimeLeft: number;
  cols: number;
  rows: number;
  grid: (string | null)[]; // playerId or null (64 cells)
  colorGrid: (string | null)[]; // colorHex or null
  validMoves: { col: number; row: number; flips: number }[];
  lastPlaced: { col: number; row: number } | null;
  flippedCells: { col: number; row: number; colorHex: string; alpha: number }[];
  banner: string | null;
  eventText: string | null;
  players: ReversiPlayerState[];
}

// --- 38. Connect 4 Drop (Four-in-a-Row Gravity Rack) ---
export interface FourInARowPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  hoverCol: number;
  connects: number;
  tokensPlaced: number;
  anvilCharges: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface FourInARowSnapshot {
  gameId: 'four-in-a-row';
  targetConnects: number;
  activePlayerId: string;
  turnTimeLeft: number;
  cols: number;
  rows: number;
  grid: (string | null)[]; // playerId or null (cols * rows)
  colorGrid: (string | null)[];
  winningCells: { col: number; row: number; colorHex: string }[];
  fallingToken: { col: number; row: number; currentY: number; colorHex: string } | null;
  banner: string | null;
  eventText: string | null;
  players: FourInARowPlayerState[];
}

// --- 39. Battleship Salvo (Radar Grid Sea Warfare) ---
export interface NavalCellState {
  col: number;
  row: number;
  revealed: boolean;
  content: 'water' | 'ship' | 'flagship' | 'mine';
  hitByColor: string | null;
  sonarHint: number | null; // nearby ships count when pinged
}

export interface NavalPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  cursorCol: number;
  cursorRow: number;
  hits: number;
  sunkShips: number;
  sonarCharges: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface NavalSalvoSnapshot {
  gameId: 'naval-salvo';
  round: number;
  totalRounds: number;
  activePlayerId: string;
  turnTimeLeft: number;
  cols: number;
  rows: number;
  shipsRemaining: number;
  cells: NavalCellState[];
  explosions: { col: number; row: number; colorHex: string; alpha: number }[];
  banner: string | null;
  eventText: string | null;
  players: NavalPlayerState[];
}

// --- 40. King Jump Checkers (Arcade Chain-Jump Draughts) ---
export interface CheckersPieceState {
  id: string;
  ownerId: string;
  colorHex: string;
  slotIndex: number;
  col: number;
  row: number;
  king: boolean;
  shielded: boolean;
}

export interface CheckersMoveOption {
  pieceId: string;
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  capturedId: string | null;
  isJump: boolean;
}

export interface NeonCheckersPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  selectedMoveIndex: number;
  piecesCount: number;
  kingsCount: number;
  captures: number;
  boostCharges: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface NeonCheckersSnapshot {
  gameId: 'neon-checkers';
  turnCount: number;
  maxTurns: number;
  activePlayerId: string;
  turnTimeLeft: number;
  pieces: CheckersPieceState[];
  availableMoves: CheckersMoveOption[];
  selectedMoveIndex: number;
  lastMove: { fromCol: number; fromRow: number; toCol: number; toRow: number; colorHex: string } | null;
  banner: string | null;
  eventText: string | null;
  players: NeonCheckersPlayerState[];
}

// --- 41. Carrom Striker (Tabletop Flick & Pocket Board) ---
export interface CarromPuckState {
  id: string;
  kind: 'gold' | 'silver' | 'queen';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  value: number;
}

export interface CarromPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  aimAngle: number;
  strikerOffset: number; // -1..1 along baseline
  pocketed: number;
  queensPocketed: number;
  spinCharges: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface CarromArenaSnapshot {
  gameId: 'carrom-arena';
  round: number;
  totalRounds: number;
  activePlayerId: string;
  phase: 'aiming' | 'sliding';
  turnTimeLeft: number;
  striker: { x: number; y: number; vx: number; vy: number; r: number; colorHex: string; spin: boolean };
  pucks: CarromPuckState[];
  pockets: { x: number; y: number; r: number }[];
  banner: string | null;
  eventText: string | null;
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: CarromPlayerState[];
}

// --- 42. Dungeon Quest Board (Roll-and-Battle Spiral Adventure) ---
export interface DungeonTileState {
  index: number;
  x: number;
  y: number;
  kind: 'start' | 'monster' | 'chest' | 'camp' | 'trap' | 'boss';
  name: string;
  power: number;
  reward: number;
}

export interface DungeonPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  tileIndex: number;
  visualTile: number;
  hp: number;
  maxHp: number;
  attackBonus: number;
  potions: number;
  monstersSlain: number;
  gold: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface DungeonCrawlBoardSnapshot {
  gameId: 'dungeon-crawl-board';
  round: number;
  totalRounds: number;
  activePlayerId: string;
  phase: 'wait-roll' | 'rolling' | 'moving' | 'combat' | 'event';
  turnTimeLeft: number;
  diceValue: number;
  combatRoll: number | null;
  diceRolling: boolean;
  bossHp: number;
  bossMaxHp: number;
  tiles: DungeonTileState[];
  banner: string | null;
  eventText: string | null;
  popups?: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: DungeonPlayerState[];
}

// --- 31 & 32. Card Games (Color Clash & Liar's Deck) ---
export type CardColor = 'red' | 'blue' | 'gold' | 'green' | 'wild';
export type ClashCardValue =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'SKIP'
  | 'REV'
  | '+2'
  | 'WILD'
  | '+4';

export interface ClashCard {
  id: string;
  color: CardColor;
  value: ClashCardValue;
}

export type LiarRank = 'A' | 'K' | 'Q' | 'J' | '10' | 'JOKER';
export type LiarSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs' | 'joker';

export interface LiarCard {
  id: string;
  rank: LiarRank;
  suit: LiarSuit;
}

export interface FlyingCardAnim {
  id: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  progress: number;
  faceUp: boolean;
  flipping?: boolean;
  colorHex?: string;
  rankText?: string;
  suitSymbol?: string;
  rotStart: number;
  rotEnd: number;
}

export interface CardShockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  colorHex: string;
  alpha: number;
}

export interface ColorClashPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  cardCount: number;
  score: number;
  lastAction: string | null;
  cooldownA: number;
  cooldownB: number;
}

export interface ColorClashSnapshot {
  gameId: 'color-clash';
  activePlayerId: string;
  direction: 1 | -1;
  activeColor: 'red' | 'blue' | 'gold' | 'green';
  topCard: ClashCard;
  recentCards: { color: CardColor; value: ClashCardValue; rot: number }[];
  drawPenalty: number;
  deckCount: number;
  discardCount: number;
  awaitingColorPick: boolean;
  turnTimeLeft: number;
  turnTotal: number;
  turnCount: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: ColorClashPlayerView[];
}

export interface LiarsDeckPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  cardCount: number;
  bluffsCaught: number;
  truthsLanded: number;
  bustedCount: number;
  score: number;
  lastAction: string | null;
  cooldownA: number;
  cooldownB: number;
}

export interface LiarsDeckSnapshot {
  gameId: 'liars-deck';
  round: number;
  targetRank: 'A' | 'K' | 'Q' | 'J' | '10';
  activePlayerId: string;
  lastClaimPlayerId: string | null;
  lastClaimPlayerName: string | null;
  lastClaimCount: number;
  phase: 'selecting' | 'challenge' | 'reveal';
  turnTimeLeft: number;
  turnTotal: number;
  pileCount: number;
  revealedCards: (LiarCard & { matchesTarget: boolean })[];
  revealVerdict: 'bluff-caught' | 'truth-confirmed' | null;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LiarsDeckPlayerView[];
}

// --- 43. Boom Kittens (Push-Your-Luck Bomb Deck) ---
export interface BoomKittensPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  alive: boolean;
  cardCount: number;
  defuseCount: number;
  score: number;
  lastAction: string | null;
}

export interface BoomKittensSnapshot {
  gameId: 'boom-kittens';
  round: number;
  activePlayerId: string;
  turnTimeLeft: number;
  turnTotal: number;
  deckCount: number;
  bombsInDeck: number;
  drawsOwed: number;
  topDiscard: { label: string; badge: string; accentHex: string } | null;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: BoomKittensPlayerView[];
}

// --- 44. Property Deal (Monopoly Deal-Style Property Heist Card Game) ---
export interface PropertySetView {
  color: 'red' | 'blue' | 'gold' | 'green';
  count: number;
  complete: boolean;
}

export interface PropertyDealPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  cardCount: number;
  bankCash: number;
  setsCompleted: number;
  properties: PropertySetView[];
  score: number;
  lastAction: string | null;
}

export interface PropertyDealSnapshot {
  gameId: 'property-deal';
  round: number;
  maxRounds: number;
  targetSets: number;
  activePlayerId: string;
  playsLeft: number;
  turnTimeLeft: number;
  turnTotal: number;
  deckCount: number;
  lastPlayedCard: { title: string; subtitle: string; badge: string; accentHex: string } | null;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: PropertyDealPlayerView[];
}

// --- 45. Flip Seven (Press-Your-Luck Unique Number Card Game) ---
export interface FlipSevenPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  status: 'active' | 'stayed' | 'busted' | 'flip7';
  numberCards: number[];
  bonusTotal: number;
  hasMultiplier: boolean;
  hasSecondChance: boolean;
  roundPoints: number;
  totalScore: number;
  lastAction: string | null;
}

export interface FlipSevenSnapshot {
  gameId: 'flip-seven';
  round: number;
  totalRounds: number;
  targetScore: number;
  activePlayerId: string;
  turnTimeLeft: number;
  turnTotal: number;
  deckCount: number;
  lastFlipped: { label: string; subtitle: string; accentHex: string } | null;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: FlipSevenPlayerView[];
}

// --- 46. Royal Bluff (Hidden-Role Deduction & Bluffing Card Game) ---
export interface RoyalBluffPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  alive: boolean;
  coins: number;
  influenceLeft: number;
  revealedRoles: string[];
  score: number;
  lastAction: string | null;
}

export interface RoyalBluffSnapshot {
  gameId: 'royal-bluff';
  round: number;
  activePlayerId: string;
  phase: 'action' | 'challenge' | 'resolve';
  turnTimeLeft: number;
  turnTotal: number;
  pendingClaim: {
    actorId: string;
    actorName: string;
    actionName: string;
    claimedRole: string;
    targetName: string | null;
  } | null;
  banner: string | null;
  bannerColor: string | null;
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: RoyalBluffPlayerView[];
}

// --- 47. Dark Flip Clash (Dual-Sided Light & Dark Color Card Game) ---
export interface DarkFlipPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  cardCount: number;
  score: number;
  lastAction: string | null;
}

export interface DarkFlipClashSnapshot {
  gameId: 'dark-flip-clash';
  side: 'light' | 'dark';
  activeColor: 'red' | 'blue' | 'gold' | 'green';
  topCard: { color: CardColor; value: string };
  direction: 1 | -1;
  activePlayerId: string;
  awaitingColorPick: boolean;
  drawPenalty: number;
  turnTimeLeft: number;
  turnTotal: number;
  turnCount: number;
  deckCount: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: DarkFlipPlayerView[];
}

// --- 48. Sushi Draft (Simultaneous Pick-and-Pass Combo Card Game) ---
export interface SushiDraftPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  pickedThisStep: boolean;
  plateCards: { id: string; kind: string; label: string; badge: string; accentHex: string }[];
  makiCount: number;
  puddingCount: number;
  roundScore: number;
  totalScore: number;
  lastAction: string | null;
}

export interface SushiDraftSnapshot {
  gameId: 'sushi-draft';
  round: number;
  totalRounds: number;
  pickStep: number;
  totalPickSteps: number;
  phase: 'picking' | 'reveal' | 'round-end';
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: SushiDraftPlayerView[];
}

export interface CardPrivateHandItem {
  id: string;
  kind: 'clash' | 'liar' | 'party';
  color?: CardColor;
  value?: string;
  rank?: PlayingCardRank;
  suit?: LiarSuit;
  title?: string;
  subtitle?: string;
  badge?: string;
  accentHex?: string;
  secondaryHex?: string;
  playable: boolean;
  selected: boolean;
}

export interface CardActionButton {
  label: string;
  labelZh: string;
  action: CardClientAction;
  colorHex: string;
  textColor?: string;
  disabled?: boolean;
}

export interface CardPrivateState {
  gameId: CardGameId;
  playerId: string;
  hand: CardPrivateHandItem[];
  cursorIndex: number;
  isMyTurn: boolean;
  isActionRequired: boolean;
  turnTimeLeft: number;
  turnTotal: number;
  activeColor?: 'red' | 'blue' | 'gold' | 'green';
  awaitingColorPick?: boolean;
  drawPenalty?: number;
  phase?: 'selecting' | 'challenge' | 'reveal';
  targetRank?: 'A' | 'K' | 'Q' | 'J' | '10';
  canCallBluff?: boolean;
  canTrust?: boolean;
  lastClaimSummary?: string | null;
  selectedCount?: number;
  badgeText?: string;
  badgeColorHex?: string;
  primaryBtn?: CardActionButton;
  secondaryBtn?: CardActionButton;
  extraActions?: CardActionButton[];
  statusHint: string;
  statusHintZh: string;
}

export type CardClientAction =
  | { type: 'select-index'; index: number }
  | { type: 'play-card'; cardId?: string }
  | { type: 'draw-or-pass' }
  | { type: 'pick-color'; color: 'red' | 'blue' | 'gold' | 'green' }
  | { type: 'toggle-card'; cardId: string }
  | { type: 'submit-selected' }
  | { type: 'call-bluff' }
  | { type: 'trust-claim' }
  | { type: 'custom'; id: string; payload?: string };

export interface FrenzyState {
  active: boolean;
  freezing: boolean;
  freezeRemaining: number;
  freezeTotal: number;
  triggerCount: number;
}

export interface TournamentMatchRecord {
  roundIndex: number;
  gameId: GameId;
  winnerId: string | null;
  winnerName: string | null;
  winnerColorHex: string | null;
  marksAwarded: Record<string, number>;
}

export interface TournamentPlayerStanding {
  playerId: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
  avatarId?: string;
  teamId?: TeamId | null;
  isBot?: boolean;
  totalMarks: number;
  wins: number;
  lastGameMarks: number;
  rank: number;
}

export interface CupVoteState {
  roundIndex: number;
  candidates: GameId[];
  votes: Record<string, GameId>;
  secondsLeft: number;
  totalSeconds: number;
  phase: 'voting' | 'locked';
  winningGameId: GameId | null;
}

export interface TournamentState {
  active: boolean;
  totalGames: number;
  currentGameIndex: number;
  gameQueue: GameId[];
  standings: TournamentPlayerStanding[];
  teamStandings?: TeamStanding[];
  history: TournamentMatchRecord[];
  vote: CupVoteState | null;
  completed: boolean;
}

export interface RoomSnapshot {
  code: string;
  status: RoomStatus;
  selectedGameId: GameId;
  gameSettingValue: number;
  countdownValue: number;
  botDifficulty: BotDifficulty;
  teamMode: TeamMode;
  teamRankings: TeamStanding[];
  hostPlayerId: string | null;
  lobbyFilter: PlayerFilterMode;
  remoteFocus: RemoteFocusState;
  activeMutator: MutatorId;
  mutatorSpinSeq: number;
  frenzy: FrenzyState;
  tournament: TournamentState | null;
  players: PlayerSummary[];
  rankings: RankingEntry[];
  hostConnected: boolean;
}

// --- WebSocket Protocol ---

export type ClientMessage =
  | { type: 'room:create'; preferredGameId?: GameId }
  | { type: 'room:host-reattach'; code: string; hostToken: string }
  | {
      type: 'room:join';
      code: string;
      name: string;
      playerId?: string;
      preferredColorId?: string;
      avatarId?: string;
    }
  | { type: 'room:add-bot'; difficulty?: BotDifficulty }
  | { type: 'room:remove-bot'; botId: string }
  | { type: 'room:set-bot-difficulty'; difficulty: BotDifficulty; botId?: string }
  | { type: 'room:set-team-mode'; teamMode: TeamMode }
  | { type: 'room:set-player-team'; playerId: string; teamId: TeamId }
  | { type: 'room:shuffle-teams' }
  | { type: 'room:set-host-player'; playerId: string }
  | { type: 'room:set-mutator'; mutatorId: MutatorId }
  | { type: 'room:spin-mutator' }
  | { type: 'room:enter-game-room' }
  | { type: 'room:return-setup' }
  | { type: 'room:close' }
  | { type: 'lobby:filter'; filter: PlayerFilterMode }
  | { type: 'room:layout'; gameCols: number; actionCols: number }
  | { type: 'remote:action'; action: RemoteDirection }
  | { type: 'player:ready'; ready: boolean }
  | { type: 'player:set-avatar'; avatarId: string }
  | { type: 'player:set-team'; teamId: TeamId }
  | { type: 'player:emote'; emoji: string }
  | { type: 'player:leave' }
  | { type: 'game:select'; gameId: GameId; settingValue?: number }
  | { type: 'game:start' }
  | { type: 'game:dismiss-briefing' }
  | { type: 'game:pause'; paused: boolean }
  | { type: 'game:restart' }
  | { type: 'game:return-lobby' }
  | { type: 'tournament:start' }
  | { type: 'tournament:vote'; gameId: GameId }
  | { type: 'tournament:force-lock-vote' }
  | { type: 'tournament:next' }
  | { type: 'tournament:exit' }
  | { type: 'card:action'; action: CardClientAction }
  | { type: 'controller:input'; input: ControllerInput }
  | {
      type: 'host:ui-haptic';
      event: string;
      targetPlayerId?: string;
      label?: string;
    }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'room:created'; code: string; hostToken: string; room: RoomSnapshot }
  | { type: 'room:joined'; playerId: string; room: RoomSnapshot }
  | { type: 'room:snapshot'; room: RoomSnapshot }
  | {
      type: 'room:emote';
      id: string;
      playerId: string;
      playerName: string;
      colorHex: string;
      emoji: string;
    }
  | { type: 'game:tick'; snapshot: GameSnapshot; sounds: SoundEvent[] }
  | { type: 'player:card-state'; cardState: CardPrivateState | null }
  | {
      type: 'player:haptic';
      pattern: number | number[];
      reason?: string;
      event?: string;
      label?: string;
      intensity?: 'light' | 'medium' | 'heavy';
    }
  | { type: 'room:closed'; reason: string }
  | { type: 'error'; message: string; code?: string }
  | { type: 'pong' };

