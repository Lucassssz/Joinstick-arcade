import type { CardShockwave, FlyingCardAnim, LiarSuit } from './types.ts';
import type { PlayingCardRank, StandardCardView } from './packMalaysianTypes.ts';

export type PackChineseViralGameId =
  | 'melon-merge'
  | 'tile-triple'
  | 'block-hop'
  | 'platform-leap'
  | 'egg-rush'
  | 'goose-alert'
  | 'hotpot-rush'
  | 'claw-mania'
  | 'truth-bomb'
  | 'draw-guess-relay'
  | 'landlord-clash'
  | 'speed-mahjong'
  | 'liars-dice-tavern'
  | 'undercover-word'
  | 'midnight-werewolf'
  | 'idiom-chain';

export type PackChineseViralCardGameId =
  | 'landlord-clash'
  | 'speed-mahjong'
  | 'liars-dice-tavern'
  | 'undercover-word'
  | 'midnight-werewolf'
  | 'idiom-chain';

// --- 59. Melon Merge (合成大西瓜) ---
export interface MelonFruitItem {
  id: string;
  x: number; // normalized 0..1 inside player tank
  y: number; // normalized 0..1 inside player tank
  tier: number; // 0..9 (Cherry -> Giant Watermelon)
  r: number; // normalized radius
}

export interface MelonMergePlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  aimX: number; // 0.1..0.9
  nextTier: number;
  fruits: MelonFruitItem[];
  melonsCreated: number;
  comboCount: number;
  overflowed: boolean;
  shakeTimer: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface MelonMergeSnapshot {
  gameId: 'melon-merge';
  timeLeft: number;
  totalTime: number;
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: MelonMergePlayerState[];
}

// --- 60. Tile Triple (羊了个羊) ---
export interface TripleTileItem {
  id: string;
  col: number; // 0..5
  row: number; // 0..4
  layer: number; // 0..2
  symbol: number; // 0..7
  blocked: boolean;
  removed: boolean;
}

export interface TileTriplePlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  cursorCol: number;
  cursorRow: number;
  tray: number[]; // max 7 symbols
  clearedTriples: number;
  remainingTiles: number;
  failed: boolean;
  tiles: TripleTileItem[];
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface TileTripleSnapshot {
  gameId: 'tile-triple';
  timeLeft: number;
  totalTime: number;
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: TileTriplePlayerState[];
}

// --- 61. Block Hop (跳一跳) ---
export interface BlockHopPlatform {
  index: number;
  x: number; // world X along track
  y: number; // world Y along track
  size: number;
  colorHex: string;
  kind: 'normal' | 'music' | 'shop' | 'gold';
}

export interface BlockHopPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  z: number;
  charging: number; // 0..1
  inAir: boolean;
  platformIndex: number;
  bullseyeStreak: number;
  alive: boolean;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface BlockHopSnapshot {
  gameId: 'block-hop';
  timeLeft: number;
  totalTime: number;
  cameraX: number;
  cameraY: number;
  platforms: BlockHopPlatform[];
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: BlockHopPlayerState[];
}

// --- 62. Platform Leap (极速跳台) ---
export interface SkyPlatformItem {
  id: string;
  x: number;
  y: number; // world height (negative = higher up)
  w: number;
  kind: 'solid' | 'moving' | 'spring' | 'crumble';
  cracked: boolean;
}

export interface PlatformLeapPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  maxAltitude: number;
  stompTimer: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface PlatformLeapSnapshot {
  gameId: 'platform-leap';
  timeLeft: number;
  cameraY: number;
  lavaY: number;
  platforms: SkyPlatformItem[];
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: PlatformLeapPlayerState[];
}

// --- 63. Egg Rush (蛋仔派对) ---
export interface EggObstacleItem {
  id: string;
  kind: 'sweeper' | 'bumper' | 'conveyor' | 'boost';
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
  dir: number;
}

export interface EggRushPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number; // world X 0..trackLength
  y: number; // lane Y 110..570
  z: number;
  rolling: boolean;
  rollTimer: number;
  stunTimer: number;
  finished: boolean;
  finishRank: number;
  progressPct: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface EggRushSnapshot {
  gameId: 'egg-rush';
  timeLeft: number;
  trackLength: number;
  cameraX: number;
  obstacles: EggObstacleItem[];
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: EggRushPlayerState[];
}

// --- 64. Goose Alert (鹅鸭杀) ---
export interface GooseTaskStation {
  id: string;
  x: number;
  y: number;
  label: string;
  completed: boolean;
  progress: number; // 0..1
}

export interface GooseAlertPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  role: 'goose' | 'duck';
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  honkWaveTimer: number;
  revealedDuck: boolean;
  tasksDone: number;
  tags: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface GooseAlertSnapshot {
  gameId: 'goose-alert';
  timeLeft: number;
  totalTasks: number;
  completedTasks: number;
  sabotageTimer: number;
  stations: GooseTaskStation[];
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: GooseAlertPlayerState[];
}

// --- 65. Hotpot Rush (火锅夹菜王) ---
export interface HotpotIngredient {
  id: string;
  x: number;
  y: number;
  kind: 'beef' | 'shrimp' | 'dumpling' | 'mushroom' | 'chili' | 'golden-ball';
  broth: 'mala' | 'golden';
  cookPct: number; // 0..100 (55..90 = PERFECT!)
  value: number;
  r: number;
}

export interface HotpotPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  seatAngle: number;
  tipX: number;
  tipY: number;
  snatchTimer: number;
  parryTimer: number;
  spicyBurnTimer: number;
  bites: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface HotpotRushSnapshot {
  gameId: 'hotpot-rush';
  timeLeft: number;
  totalTime: number;
  potX: number;
  potY: number;
  potR: number;
  ingredients: HotpotIngredient[];
  bubbles: { x: number; y: number; r: number; broth: 'mala' | 'golden'; alpha: number }[];
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: HotpotPlayerState[];
}

// --- 66. Claw Mania (娃娃机大作战) ---
export interface ClawPrizeItem {
  id: string;
  x: number;
  y: number;
  kind: 'bear' | 'capsule' | 'dragon' | 'duck' | 'bomb';
  colorHex: string;
  value: number;
  r: number;
  grabbedBy: string | null;
}

export interface ClawPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  clawState: 'aim' | 'drop' | 'lift';
  clawDepth: number; // 0..1
  magnetTimer: number;
  prizesWon: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface ClawManiaSnapshot {
  gameId: 'claw-mania';
  timeLeft: number;
  totalTime: number;
  binX: number;
  binY: number;
  binW: number;
  binH: number;
  prizes: ClawPrizeItem[];
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: ClawPlayerState[];
}

// --- 67. Truth Bomb (真心话大冒险轮盘) ---
export interface TruthBombPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  seatAngle: number;
  hasBomb: boolean;
  daresCompleted: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface TruthBombSnapshot {
  gameId: 'truth-bomb';
  round: number;
  totalRounds: number;
  phase: 'pass' | 'challenge' | 'result';
  fuseRatio: number; // 0..1
  wheelAngle: number;
  holderId: string;
  challengeKind: 'TRUTH' | 'DARE' | null;
  challengeEn: string | null;
  challengeZh: string | null;
  doubleStakes: boolean;
  votesDone: number;
  votesNeeded: number;
  phaseTimer: number;
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: TruthBombPlayerState[];
}

// --- 68. Draw & Guess Relay (你画我猜) ---
export interface DrawStrokePoint {
  x: number;
  y: number;
  colorHex: string;
  newStroke?: boolean;
}

export interface DrawGuessPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isArtist: boolean;
  cursorOption: number; // 0..3 for guessers
  guessedCorrect: boolean;
  lockedGuess: boolean;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface DrawGuessRelaySnapshot {
  gameId: 'draw-guess-relay';
  round: number;
  totalRounds: number;
  artistId: string;
  artistName: string;
  brushX: number;
  brushY: number;
  brushColor: string;
  isDrawing: boolean;
  strokes: DrawStrokePoint[];
  options: { en: string; zh: string }[];
  revealedWord: { en: string; zh: string } | null;
  phase: 'drawing' | 'reveal';
  timeLeft: number;
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: DrawGuessPlayerState[];
}

// --- 69. Landlord Clash (斗地主) ---
export interface LandlordCardView {
  id: string;
  rank: PlayingCardRank;
  suit: LiarSuit;
  jokerKind?: 'small' | 'big';
}

export interface LandlordPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  isLandlord: boolean;
  cardCount: number;
  bidValue: number; // -1 unbid, 0 pass, 1..3
  passedTrick: boolean;
  score: number;
  lastAction: string | null;
}

export interface LandlordClashSnapshot {
  gameId: 'landlord-clash';
  round: number;
  totalRounds: number;
  phase: 'bidding' | 'playing' | 'round-over';
  activePlayerId: string;
  landlordId: string | null;
  multiplier: number;
  kittyCards: LandlordCardView[];
  kittyRevealed: boolean;
  tableComboName: string | null;
  tableCards: LandlordCardView[];
  trickOwnerName: string | null;
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LandlordPlayerView[];
}

// --- 70. Speed Mahjong (雀魂极速麻将) ---
export interface MahjongTileView {
  id: string;
  suit: 'wan' | 'dragon'; // 1-9 万 + 中發白
  value: number; // 1..9 or 1=中, 2=發, 3=白
  label: string;
  sublabel: string;
}

export interface SpeedMahjongPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  tileCount: number;
  melds: MahjongTileView[][];
  discards: MahjongTileView[];
  readyTenpai: boolean;
  score: number;
  lastAction: string | null;
}

export interface SpeedMahjongSnapshot {
  gameId: 'speed-mahjong';
  round: number;
  totalRounds: number;
  activePlayerId: string;
  wallRemaining: number;
  lastDiscard: MahjongTileView | null;
  lastDiscardBy: string | null;
  winnerHand: MahjongTileView[] | null;
  winnerLabel: string | null;
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: SpeedMahjongPlayerView[];
}

// --- 71. Tavern Dice (大话骰 / 吹牛骰子) ---
export interface TavernDicePlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  diceCount: number;
  revealedDice: number[]; // only populated on reveal!
  alive: boolean;
  score: number;
  lastAction: string | null;
}

export interface LiarsDiceTavernSnapshot {
  gameId: 'liars-dice-tavern';
  round: number;
  totalRounds: number;
  phase: 'bidding' | 'reveal';
  activePlayerId: string;
  currentBidQty: number;
  currentBidFace: number; // 1..6
  pureMode: boolean; // 齋 (1s not wild)
  lastBidderName: string | null;
  totalMatchingDice: number | null;
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: TavernDicePlayerView[];
}

// --- 72. Spy Word (谁是卧底) ---
export interface SpyWordPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  alive: boolean;
  clueSubmitted: string | null;
  votesReceived: number;
  hasVoted: boolean;
  revealedRole: 'civilian' | 'spy' | null;
  score: number;
}

export interface UndercoverWordSnapshot {
  gameId: 'undercover-word';
  round: number;
  totalRounds: number;
  phase: 'clue' | 'vote' | 'reveal';
  civilianWordRevealed: string | null;
  spyWordRevealed: string | null;
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: SpyWordPlayerView[];
}

// --- 73. Midnight Werewolf (狼人杀极速版) ---
export interface WerewolfPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  alive: boolean;
  actedNight: boolean;
  hasVoted: boolean;
  votesReceived: number;
  revealedRole: 'werewolf' | 'seer' | 'guard' | 'villager' | null;
  score: number;
}

export interface MidnightWerewolfSnapshot {
  gameId: 'midnight-werewolf';
  dayNumber: number;
  phase: 'night' | 'dawn' | 'vote' | 'end';
  dawnReport: string | null;
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: WerewolfPlayerView[];
}

// --- 74. Word Chain (成语/词语接龙) ---
export interface IdiomChainEntry {
  en: string;
  zh: string;
  byName: string;
  colorHex: string;
}

export interface IdiomChainPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  alive: boolean;
  streak: number;
  score: number;
  lastAction: string | null;
}

export interface IdiomChainSnapshot {
  gameId: 'idiom-chain';
  round: number;
  activePlayerId: string;
  anchorEn: string;
  anchorZh: string;
  linkHintEn: string;
  linkHintZh: string;
  history: IdiomChainEntry[];
  chainLength: number;
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: IdiomChainPlayerView[];
}

export type PackChineseViralSnapshot =
  | MelonMergeSnapshot
  | TileTripleSnapshot
  | BlockHopSnapshot
  | PlatformLeapSnapshot
  | EggRushSnapshot
  | GooseAlertSnapshot
  | HotpotRushSnapshot
  | ClawManiaSnapshot
  | TruthBombSnapshot
  | DrawGuessRelaySnapshot
  | LandlordClashSnapshot
  | SpeedMahjongSnapshot
  | LiarsDiceTavernSnapshot
  | UndercoverWordSnapshot
  | MidnightWerewolfSnapshot
  | IdiomChainSnapshot;

export type { StandardCardView };
