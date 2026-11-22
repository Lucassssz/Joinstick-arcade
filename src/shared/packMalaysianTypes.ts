import type { CardShockwave, FlyingCardAnim, LiarSuit } from './types.ts';

export type PlayingCardRank =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'A'
  | 'JOKER';

export interface StandardCardView {
  id: string;
  rank: Exclude<PlayingCardRank, 'JOKER'>;
  suit: Exclude<LiarSuit, 'joker'>;
}

export type PackMalaysianGameId =
  | 'line-breakers'
  | 'desk-flippers'
  | 'spin-clash'
  | 'marble-ring'
  | 'rattan-volley'
  | 'step-stomp'
  | 'pit-harvest'
  | 'big-two-royale'
  | 'lucky-21'
  | 'ten-pair-showdown';

export type PackMalaysianCardGameId =
  | 'big-two-royale'
  | 'lucky-21'
  | 'ten-pair-showdown';

// --- 49. Line Breakers (Galah Panjang / 过五关) ---
export interface LineBreakersPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  role: 'runner' | 'guard';
  guardLineIndex: number; // -1 for runners, 0..3 horizontal lines, 4 center spine
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  reachedFarEnd: boolean; // Runner must reach far end and return!
  dashTimer: number;
  feintTimer: number;
  tagStunTimer: number;
  crossings: number;
  tags: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface LineBreakersSnapshot {
  gameId: 'line-breakers';
  round: number;
  totalRounds: number;
  roundTimer: number;
  courtX: number;
  courtY: number;
  courtW: number;
  courtH: number;
  lineYs: number[];
  centerSpineX: number;
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LineBreakersPlayerState[];
}

// --- 50. Desk Flippers (Lawan Pemadam / 翻橡皮擦) ---
export interface DeskFlipperPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  flagStripeHex: string;
  x: number;
  y: number;
  z: number; // Height during flip arc
  vx: number;
  vy: number;
  vz: number;
  angle: number;
  flipRot: number;
  alive: boolean;
  pinnedTimer: number;
  charge: number;
  pins: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface DeskFlippersSnapshot {
  gameId: 'desk-flippers';
  round: number;
  totalRounds: number;
  timeLeft: number;
  deskX: number;
  deskY: number;
  deskW: number;
  deskH: number;
  banner: string | null;
  shockwaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: DeskFlipperPlayerState[];
}

// --- 51. Spin Clash (Gasing Pangkah / 马来陀螺) ---
export interface SpinClashPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spinAngle: number;
  rpm: number; // 0..100
  alive: boolean;
  whipTimer: number;
  braceTimer: number;
  kos: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface SpinClashSnapshot {
  gameId: 'spin-clash';
  round: number;
  totalRounds: number;
  timeLeft: number;
  ringCenterX: number;
  ringCenterY: number;
  ringRadius: number;
  sparks: { x: number; y: number; vx: number; vy: number; colorHex: string; alpha: number }[];
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: SpinClashPlayerState[];
}

// --- 52. Marble Ring (Guli / Kelereng / 弹珠) ---
export interface RingMarbleState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'glass' | 'jade' | 'gold';
  colorHex: string;
  value: number;
  claimed: boolean;
}

export interface MarbleRingPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimAngle: number;
  isShooting: boolean;
  marblesWon: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface MarbleRingSnapshot {
  gameId: 'marble-ring';
  timeLeft: number;
  totalTime: number;
  ringCenterX: number;
  ringCenterY: number;
  ringRadius: number;
  marbles: RingMarbleState[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: MarbleRingPlayerState[];
}

// --- 53. Rattan Volley (Sepak Takraw / 藤球) ---
export interface RattanVolleyPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  team: 'left' | 'right';
  x: number;
  y: number;
  vx: number;
  vy: number;
  kickTimer: number;
  bicycleAngle: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface RattanVolleySnapshot {
  gameId: 'rattan-volley';
  targetPoints: number;
  scoreLeft: number;
  scoreRight: number;
  floorY: number;
  netX: number;
  netTopY: number;
  ball: { x: number; y: number; vx: number; vy: number; r: number; rot: number; trail: { x: number; y: number }[] };
  sideTouchesLeft: number;
  sideTouchesRight: number;
  maxTouches: number;
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: RattanVolleyPlayerState[];
}

// --- 54. Step Stomp (Pepsi Cola / One-Two-Jus / 踩脚) ---
export interface StepStompPlayerState {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  stepsLeft: number;
  maxSteps: number;
  leapTimer: number;
  dodgeTimer: number;
  stomps: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
}

export interface StepStompSnapshot {
  gameId: 'step-stomp';
  round: number;
  totalRounds: number;
  phase: 'callout' | 'stride' | 'resolve';
  phaseTimer: number;
  activeAttackerId: string | null;
  calloutText: string;
  footprints: { x: number; y: number; angle: number; colorHex: string; alpha: number }[];
  shockwaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: StepStompPlayerState[];
}

// --- 55. Pit Harvest (Congkak / 冲格) ---
export interface PitHarvestPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  side: 0 | 1; // 0 = bottom row (left->right), 1 = top row (right->left)
  cursorPit: number; // 0..6
  rumah: number;
  totalScore: number;
  captures: number;
  lastAction: string | null;
}

export interface PitHarvestSnapshot {
  gameId: 'pit-harvest';
  round: number;
  totalRounds: number;
  pits: number[]; // 14 kampung pits: 0..6 = side 0, 7..13 = side 1
  burntPits: boolean[]; // Rumah terbakar on Round 2!
  rumah: [number, number];
  activeSide: 0 | 1;
  activePlayerId: string;
  sowingInHand: number;
  sowingPitIndex: number | null; // 0..13 or -1 (rumah 0) or -2 (rumah 1)
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: PitHarvestPlayerView[];
}

// --- 56. Big Two Royale (Chor Dai Di / 锄大弟) ---
export interface BigTwoPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  cardCount: number;
  passedTrick: boolean;
  score: number;
  lastAction: string | null;
  oneCardWarning: boolean;
}

export interface BigTwoRoyaleSnapshot {
  gameId: 'big-two-royale';
  round: number;
  totalRounds: number;
  activePlayerId: string;
  trickOwnerId: string | null;
  trickOwnerName: string | null;
  tableComboName: string | null;
  tableCards: StandardCardView[];
  mustInclude3D: boolean;
  topCardGuardActive: boolean;
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: BigTwoPlayerView[];
}

// --- 57. Lucky 21 (21点 / Ban Luck / 廿一点) ---
export interface Lucky21PlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  isBanker: boolean;
  chips: number;
  bet: number;
  cardCount: number;
  revealed: boolean;
  cards: StandardCardView[]; // Only populated on TV when revealed!
  handValue: number | null; // Shown when revealed
  specialTag: string | null; // BAN BAN ×3, BAN LUCK ×2, WU LONG ×2, 7-7-7 ×7, BUST, RUN
  status: 'betting' | 'playing' | 'stood' | 'escaped' | 'busted' | 'settled';
  lastDelta: number;
  lastAction: string | null;
}

export interface Lucky21Snapshot {
  gameId: 'lucky-21';
  round: number;
  totalRounds: number;
  phase: 'betting' | 'player-turns' | 'banker-turn' | 'settle';
  bankerId: string;
  activePlayerId: string;
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: Lucky21PlayerView[];
}

// --- 58. Ten-Pair Showdown (Ngau / 斗牛) ---
export interface TenPairPlayerView {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  isBanker: boolean;
  chips: number;
  bet: number;
  lockedIn: boolean;
  revealed: boolean;
  baseCards: StandardCardView[]; // 3-card multiple-of-10 base when revealed
  pairCards: StandardCardView[]; // 2-card point pair when revealed
  rankLabel: string | null; // NO NGAU, NGAU 7, NGAU TUNG ×2, PAIR NGAU ×3, FIVE GONG ×5
  multiplier: number;
  lastDelta: number;
  lastAction: string | null;
}

export interface TenPairShowdownSnapshot {
  gameId: 'ten-pair-showdown';
  round: number;
  totalRounds: number;
  wild36Enabled: boolean;
  phase: 'arrange' | 'reveal' | 'settle';
  bankerId: string;
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: TenPairPlayerView[];
}

export type PackMalaysianSnapshot =
  | LineBreakersSnapshot
  | DeskFlippersSnapshot
  | SpinClashSnapshot
  | MarbleRingSnapshot
  | RattanVolleySnapshot
  | StepStompSnapshot
  | PitHarvestSnapshot
  | BigTwoRoyaleSnapshot
  | Lucky21Snapshot
  | TenPairShowdownSnapshot;
