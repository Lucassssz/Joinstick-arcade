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
  | 'gravity-flip';

export type RoomStatus = 'SETUP' | 'LOBBY' | 'BRIEFING' | 'COUNTDOWN' | 'PLAYING' | 'PAUSED' | 'RESULTS';

export type BotDifficulty = 'chill' | 'arcade' | 'spicy';

export type GameSuitability = 'solo' | 'double' | 'multiplayer';
export type PlayerFilterMode = 'all' | GameSuitability;

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

export interface PlayerSummary {
  id: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
  connected: boolean;
  ready: boolean;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
  score: number;
  alive: boolean;
  statText: string;
  cooldownA: number; // 0 (ready) to 1 (cooling)
  cooldownB: number; // 0 (ready) to 1 (cooling)
}

export interface RankingEntry {
  playerId: string;
  slotIndex: number;
  name: string;
  color: PlayerColorSpec;
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
    | 'win';
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
  cooldownA: number;
  cooldownB: number;
  kos: number;
  score: number;
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
}

export interface AstroPickupState {
  id: string;
  kind: 'shield' | 'rapid' | 'heal';
  x: number;
  y: number;
}

export interface AstroBlasterSnapshot {
  gameId: 'astro-blaster';
  timeLeft: number;
  totalTime: number;
  asteroids: { x: number; y: number; r: number; seed: number }[];
  pickups: AstroPickupState[];
  bullets: AstroBulletState[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
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
  players: DriftCarState[];
}

// --- 4. Hex Drop ---
export interface HexTileState {
  id: number;
  x: number;
  y: number;
  radius: number;
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
  cooldownA: number;
  cooldownB: number;
  score: number;
  passes: number;
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

export interface GridRunnersSnapshot {
  gameId: 'grid-runners';
  round: number;
  totalRounds: number;
  roundTimer: number;
  roundBanner: string | null;
  trails: { playerId: string; colorHex: string; points: GridTrailPoint[] }[];
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
  goalBanner: string | null;
  goalBannerColor: string | null;
  ball: StrikerBallState;
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
  slowMoTimer: number;
  coreAngle: number;
  beams: { angle: number; width: number; state: 'warn' | 'active'; progress: number }[];
  rings: { radius: number; maxRadius: number; thickness: number; alpha: number }[];
  orbs: { id: string; x: number; y: number; r: number }[];
  shards: { id: string; x: number; y: number; value: number; pulse: number }[];
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
  walls: { x: number; y: number; w: number; h: number }[];
  spikes: { x: number; y: number; w: number; h: number; state: 'idle' | 'warn' | 'active'; disabledTimer: number }[];
  lasers: { x1: number; y1: number; x2: number; y2: number; state: 'off' | 'warn' | 'active'; disabledTimer: number }[];
  drones: { x: number; y: number; r: number; angle: number; disabledTimer: number }[];
  relics: { id: string; x: number; y: number; value: number }[];
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
  slashTimer: number;
  parryTimer: number;
  stunTimer: number;
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
  pillars: { x: number; y: number; r: number }[];
  slashes: { x: number; y: number; angle: number; colorHex: string; alpha: number }[];
  sparks: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
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
  shells: { id: string; ownerId: string; colorHex: string; x: number; y: number; vx: number; vy: number; r: number }[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
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
  obstacles: { x: number; y: number; r: number }[];
  waves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
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
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
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
  coins: { id: string; x: number; y: number; r: number }[];
  players: GravityPlayerState[];
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
  | GravityFlipSnapshot;

export interface RoomSnapshot {
  code: string;
  status: RoomStatus;
  selectedGameId: GameId;
  gameSettingValue: number;
  countdownValue: number;
  botDifficulty: BotDifficulty;
  hostPlayerId: string | null;
  players: PlayerSummary[];
  rankings: RankingEntry[];
  hostConnected: boolean;
}

// --- WebSocket Protocol ---

export type ClientMessage =
  | { type: 'room:create'; preferredGameId?: GameId }
  | { type: 'room:host-reattach'; code: string; hostToken: string }
  | { type: 'room:join'; code: string; name: string; playerId?: string; preferredColorId?: string }
  | { type: 'room:add-bot'; difficulty?: BotDifficulty }
  | { type: 'room:remove-bot'; botId: string }
  | { type: 'room:set-bot-difficulty'; difficulty: BotDifficulty; botId?: string }
  | { type: 'room:set-host-player'; playerId: string }
  | { type: 'room:enter-game-room' }
  | { type: 'room:return-setup' }
  | { type: 'player:ready'; ready: boolean }
  | { type: 'player:leave' }
  | { type: 'game:select'; gameId: GameId; settingValue?: number }
  | { type: 'game:start' }
  | { type: 'game:dismiss-briefing' }
  | { type: 'game:pause'; paused: boolean }
  | { type: 'game:restart' }
  | { type: 'game:return-lobby' }
  | { type: 'controller:input'; input: ControllerInput }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'room:created'; code: string; hostToken: string; room: RoomSnapshot }
  | { type: 'room:joined'; playerId: string; room: RoomSnapshot }
  | { type: 'room:snapshot'; room: RoomSnapshot }
  | { type: 'game:tick'; snapshot: GameSnapshot; sounds: SoundEvent[] }
  | { type: 'player:haptic'; pattern: number | number[]; reason?: string }
  | { type: 'room:closed'; reason: string }
  | { type: 'error'; message: string; code?: string }
  | { type: 'pong' };
