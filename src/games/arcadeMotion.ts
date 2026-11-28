import { GameId, GameSnapshot } from '../shared/types';
import { CARD_GAME_IDS } from '../shared/games';

// ============================================================
// MOTION CURVES & MATH HELPERS
// ============================================================
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutBack(t: number, overshoot = 1.70158): number {
  const x = clamp01(t) - 1;
  return 1 + (overshoot + 1) * x * x * x + overshoot * x * x;
}

export function parseHexRgb(hex: string): [number, number, number] {
  let clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [255, 184, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function lerpHex(fromHex: string, toHex: string, alpha: number): string {
  const a = clamp01(alpha);
  const [r1, g1, b1] = parseHexRgb(fromHex);
  const [r2, g2, b2] = parseHexRgb(toHex);
  const r = Math.round(r1 + (r2 - r1) * a);
  const g = Math.round(g1 + (g2 - g1) * a);
  const b = Math.round(b1 + (b2 - b1) * a);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// ============================================================
// FX TYPES & STATE
// ============================================================
export type ParticleKind = 'spark' | 'dust' | 'ember' | 'confetti' | 'droplet' | 'snowflake' | 'star';

export interface ArcadeParticle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  rot: number;
  vrot: number;
  gravity: number;
}

export interface ArcadeRing {
  x: number;
  y: number;
  r: number;
  maxR: number;
  color: string;
  alpha: number;
  lineWidth: number;
}

export interface PodTrailPoint {
  x: number;
  y: number;
  alpha: number;
  color: string;
  r: number;
}

export interface PodMotionState {
  scaleX: number;
  scaleY: number;
  flash: number;
  trail: PodTrailPoint[];
  lastX: number;
  lastY: number;
  trailCd: number;
}

interface BannerAnimEntry {
  text: string;
  progress: number;
}

interface AmbientMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
}

export interface ArcadeMotionState {
  activeGameId: GameId | null;
  lastRoundMarker: number | string | null;
  lastFrameMs: number;
  nowSec: number;
  dt: number;

  // Sub-tick snapshot interpolation
  prevSnap: GameSnapshot | null;
  currSnap: GameSnapshot | null;
  snapReceivedMs: number;
  tickIntervalMs: number;
  interpAlpha: number;

  // Motion & FX pools
  podMotion: Map<string, PodMotionState>;
  boardTileLerp: Map<string, number>;
  banners: Map<string, BannerAnimEntry>;
  particles: ArcadeParticle[];
  rings: ArcadeRing[];
  motes: AmbientMote[];

  // Camera recoil & subtle screen vignette pulse
  kickX: number;
  kickY: number;
  hitStopTimer: number;
  flashColor: string;
  flashAlpha: number;

  // Dice settle tracker for board games
  diceRollingPrev: boolean;
  diceSettleProgress: number;

  // Diff counters
  prevGoalKey: string;
  prevHighestBid: number;
  prevAuctionPhase: string;
  prevDugCount: number;
  prevFlameCount: number;
  prevHexFallingIds: Set<number>;
  prevColorDroppedIds: Set<number>;
  prevLightState: string;
  ambientEmitAccum: number;

  // Local input prediction (Job B: direct-touch paddles)
  predOffsetX: number;
  predOffsetY: number;
  predLastPlayerX: number | null;
  predLastPlayerY: number | null;
}

export interface LocalPaddlePrediction {
  gameId: GameId;
  playerId: string;
  active: boolean;
  targetX: number;
  targetY: number;
  updatedAtMs: number;
}

function createAmbientMotes(): AmbientMote[] {
  const out: AmbientMote[] = [];
  for (let i = 0; i < 24; i++) {
    out.push({
      x: ((i * 197 + 41) % 1160) + 20,
      y: ((i * 131 + 59) % 680) + 20,
      vx: ((i % 2 === 0 ? 1 : -1) * (5 + (i % 4) * 2.5)),
      vy: -(4 + (i % 5) * 2),
      r: 1.2 + (i % 3) * 0.75,
      phase: i * 0.72,
    });
  }
  return out;
}

export function createArcadeMotionState(): ArcadeMotionState {
  return {
    activeGameId: null,
    lastRoundMarker: null,
    lastFrameMs: 0,
    nowSec: 0,
    dt: 1 / 60,
    prevSnap: null,
    currSnap: null,
    snapReceivedMs: 0,
    tickIntervalMs: 33.3,
    interpAlpha: 1,
    podMotion: new Map(),
    boardTileLerp: new Map(),
    banners: new Map(),
    particles: [],
    rings: [],
    motes: createAmbientMotes(),
    kickX: 0,
    kickY: 0,
    hitStopTimer: 0,
    flashColor: '#FFFFFF',
    flashAlpha: 0,
    diceRollingPrev: false,
    diceSettleProgress: 1,
    prevGoalKey: '',
    prevHighestBid: 0,
    prevAuctionPhase: '',
    prevDugCount: 0,
    prevFlameCount: 0,
    prevHexFallingIds: new Set(),
    prevColorDroppedIds: new Set(),
    prevLightState: '',
    ambientEmitAccum: 0,
    predOffsetX: 0,
    predOffsetY: 0,
    predLastPlayerX: null,
    predLastPlayerY: null,
  };
}

let activeMotionRef: ArcadeMotionState | null = null;

export function setActiveArcadeMotion(state: ArcadeMotionState | null): void {
  activeMotionRef = state;
}

export function getMotionTime(): number {
  return activeMotionRef ? activeMotionRef.nowSec : performance.now() / 1000;
}

export function getPodFx(playerId: string): {
  scaleX: number;
  scaleY: number;
  flash: number;
  trail: PodTrailPoint[];
} {
  const entry = activeMotionRef?.podMotion.get(playerId);
  if (!entry) {
    return { scaleX: 1, scaleY: 1, flash: 0, trail: [] };
  }
  return entry;
}

export function getSpringBannerAnim(
  key: string,
  text: string | null | undefined
): { scale: number; alpha: number } {
  if (!text || !activeMotionRef) return { scale: 1, alpha: 1 };
  let entry = activeMotionRef.banners.get(key);
  if (!entry || entry.text !== text) {
    entry = { text, progress: 0 };
    activeMotionRef.banners.set(key, entry);
  }
  const t = clamp01(entry.progress);
  const s = 0.72 + 0.28 * easeOutBack(t, 1.85);
  return { scale: s, alpha: clamp01(t * 3.5) };
}

export function getDiceSettleMotion(rolling: boolean): {
  scale: number;
  bounceY: number;
  wobbleAngle: number;
} {
  const st = activeMotionRef;
  if (!st) return { scale: 1, bounceY: 0, wobbleAngle: 0 };
  if (rolling) {
    st.diceRollingPrev = true;
    st.diceSettleProgress = 0;
    const t = st.nowSec * 22;
    return {
      scale: 1.06 + Math.sin(t) * 0.05,
      bounceY: -Math.abs(Math.sin(t * 0.75)) * 7,
      wobbleAngle: Math.sin(t * 1.1) * 0.14,
    };
  }
  if (st.diceRollingPrev) {
    st.diceRollingPrev = false;
    st.diceSettleProgress = 0;
  }
  const p = clamp01(st.diceSettleProgress);
  if (p >= 1) return { scale: 1, bounceY: 0, wobbleAngle: 0 };
  const decay = Math.pow(1 - p, 2);
  return {
    scale: 1 + Math.sin(p * Math.PI * 2.5) * 0.14 * decay,
    bounceY: -Math.abs(Math.sin(p * Math.PI * 2)) * 8 * decay,
    wobbleAngle: Math.sin(p * Math.PI * 3) * 0.09 * decay,
  };
}

export function getBoardVisualTile(playerId: string, targetTile: number, wrapTiles?: number): number {
  const st = activeMotionRef;
  if (!st) return targetTile;
  let curr = st.boardTileLerp.get(playerId);
  if (curr === undefined) {
    st.boardTileLerp.set(playerId, targetTile);
    return targetTile;
  }
  let diff = targetTile - curr;
  if (wrapTiles && wrapTiles > 0) {
    if (diff < -wrapTiles * 0.5) diff += wrapTiles;
    if (diff > wrapTiles * 0.5) diff -= wrapTiles;
  }
  if (Math.abs(diff) > 12) {
    curr = targetTile;
  } else {
    const rate = 1 - Math.exp(-16 * st.dt);
    curr += diff * rate;
    if (wrapTiles && wrapTiles > 0) {
      curr = ((curr % wrapTiles) + wrapTiles) % wrapTiles;
    }
  }
  st.boardTileLerp.set(playerId, curr);
  return curr;
}

// ============================================================
// PARTICLE & RING SPAWNERS
// ============================================================
export function spawnBurst(
  st: ArcadeMotionState,
  x: number,
  y: number,
  color: string,
  count: number,
  opts?: {
    kind?: ParticleKind;
    speedMin?: number;
    speedMax?: number;
    sizeMin?: number;
    sizeMax?: number;
    lifeMin?: number;
    lifeMax?: number;
    gravity?: number;
  }
): void {
  if (st.particles.length > 240) return;
  const kind = opts?.kind ?? 'spark';
  const sMin = opts?.speedMin ?? 80;
  const sMax = opts?.speedMax ?? 260;
  const szMin = opts?.sizeMin ?? 2.4;
  const szMax = opts?.sizeMax ?? 5.4;
  const lMin = opts?.lifeMin ?? 0.25;
  const lMax = opts?.lifeMax ?? 0.58;
  const grav = opts?.gravity ?? (kind === 'confetti' ? 240 : kind === 'droplet' ? 320 : 120);

  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = sMin + Math.random() * (sMax - sMin);
    const maxLife = lMin + Math.random() * (lMax - lMin);
    st.particles.push({
      kind,
      x,
      y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - (kind === 'confetti' || kind === 'droplet' ? 95 : 0),
      size: szMin + Math.random() * (szMax - szMin),
      color,
      life: maxLife,
      maxLife,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 11,
      gravity: grav,
    });
  }
}

export function spawnRing(
  st: ArcadeMotionState,
  x: number,
  y: number,
  maxR: number,
  color: string,
  lineWidth = 4
): void {
  if (st.rings.length >= 36) st.rings.shift();
  st.rings.push({
    x,
    y,
    r: Math.max(6, maxR * 0.14),
    maxR,
    color,
    alpha: 0.9,
    lineWidth,
  });
}

function addKick(st: ArcadeMotionState, dx: number, dy: number, mag: number): void {
  const len = Math.hypot(dx, dy) || 1;
  st.kickX = Math.max(-14, Math.min(14, st.kickX + (dx / len) * mag));
  st.kickY = Math.max(-14, Math.min(14, st.kickY + (dy / len) * mag));
}

function getPodState(st: ArcadeMotionState, id: string, x: number, y: number): PodMotionState {
  let entry = st.podMotion.get(id);
  if (!entry) {
    entry = { scaleX: 1, scaleY: 1, flash: 0, trail: [], lastX: x, lastY: y, trailCd: 0 };
    st.podMotion.set(id, entry);
  }
  return entry;
}

// ============================================================
// RESET & DIFFING ON NEW SNAPSHOTS
// ============================================================
function resetForGameSwitch(st: ArcadeMotionState, gameId: GameId): void {
  st.activeGameId = gameId;
  st.prevSnap = null;
  st.currSnap = null;
  st.podMotion.clear();
  st.boardTileLerp.clear();
  st.banners.clear();
  st.particles = [];
  st.rings = [];
  st.kickX = 0;
  st.kickY = 0;
  st.hitStopTimer = 0;
  st.flashAlpha = 0;
  st.diceRollingPrev = false;
  st.diceSettleProgress = 1;
  st.prevGoalKey = '';
  st.prevHighestBid = 0;
  st.prevAuctionPhase = '';
  st.prevDugCount = 0;
  st.prevFlameCount = 0;
  st.prevHexFallingIds.clear();
  st.prevColorDroppedIds.clear();
  st.prevLightState = '';
  st.predOffsetX = 0;
  st.predOffsetY = 0;
  st.predLastPlayerX = null;
  st.predLastPlayerY = null;
}

function getRoundMarker(snap: GameSnapshot): number | string | null {
  const s = snap as unknown as { round?: number; wave?: number };
  if (typeof s.round === 'number') return `r${s.round}`;
  if (typeof s.wave === 'number') return `w${s.wave}`;
  return null;
}

interface GenericPlayerLike {
  id: string;
  x?: number;
  y?: number;
  colorHex?: string;
  alive?: boolean;
  falling?: boolean;
  hp?: number;
  score?: number;
  dashTimer?: number;
  sprintTimer?: number;
  lungeTimer?: number;
  tackleTimer?: number;
  smashTimer?: number;
  slashTimer?: number;
  boostTimer?: number;
  boosting?: boolean;
  slideTimer?: number;
  hopTimer?: number;
  leapTimer?: number;
  digTimer?: number;
  bounceTimer?: number;
  gravityDir?: number;
  frozen?: boolean;
  stunTimer?: number;
  hasBomb?: boolean;
  hasCrown?: boolean;
}

function diffSnapshotForFX(prev: GameSnapshot, curr: GameSnapshot, st: ArcadeMotionState): void {
  const prevPlayersArr = (prev as unknown as { players?: GenericPlayerLike[] }).players;
  const currPlayersArr = (curr as unknown as { players?: GenericPlayerLike[] }).players;

  if (Array.isArray(prevPlayersArr) && Array.isArray(currPlayersArr)) {
    const prevMap = new Map<string, GenericPlayerLike>();
    for (const pp of prevPlayersArr) prevMap.set(pp.id, pp);

    for (const cp of currPlayersArr) {
      const pp = prevMap.get(cp.id);
      if (!pp) continue;
      const px = typeof cp.x === 'number' ? cp.x : 600;
      const py = typeof cp.y === 'number' ? cp.y : 360;
      const col = cp.colorHex ?? '#FFB800';
      const pod = getPodState(st, cp.id, px, py);

      // Elimination / Ring-out burst
      if ((pp.alive === true && cp.alive === false) || (pp.falling === false && cp.falling === true)) {
        spawnBurst(st, px, py, col, 16, { kind: 'spark', speedMin: 120, speedMax: 340, sizeMax: 6 });
        spawnBurst(st, px, py, '#FFFFFF', 6, { kind: 'star', speedMin: 70, speedMax: 190 });
        spawnRing(st, px, py, 95, col, 5);
        addKick(st, px - 600, py - 360, 7);
        st.hitStopTimer = Math.max(st.hitStopTimer, 0.042);
        pod.flash = 1;
        pod.scaleX = 1.28;
        pod.scaleY = 0.72;
      }

      // HP damage flash
      if (typeof pp.hp === 'number' && typeof cp.hp === 'number' && cp.hp < pp.hp) {
        pod.flash = 1;
        pod.scaleX = 1.2;
        pod.scaleY = 0.8;
        spawnBurst(st, px, py, '#FFFFFF', 8, { kind: 'spark', speedMin: 90, speedMax: 220 });
        addKick(st, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 4);
      }

      // Freeze / Stun transition
      if (pp.frozen === false && cp.frozen === true) {
        spawnBurst(st, px, py, '#7CE8FF', 14, { kind: 'snowflake', speedMin: 60, speedMax: 180 });
        spawnRing(st, px, py, 68, '#00C2FF', 3.5);
        pod.scaleX = 1.18;
        pod.scaleY = 0.85;
      } else if (pp.frozen === true && cp.frozen === false) {
        spawnBurst(st, px, py, '#FFFFFF', 12, { kind: 'spark', speedMin: 80, speedMax: 210 });
        spawnRing(st, px, py, 64, '#FFB800', 3);
      }

      // Score increase chime burst
      if (typeof pp.score === 'number' && typeof cp.score === 'number' && cp.score > pp.score && curr.gameId !== 'paint-rush') {
        const gained = cp.score - pp.score;
        if (gained >= 2) {
          spawnBurst(st, px, py - 12, '#FFB800', Math.min(10, 4 + Math.floor(gained / 10)), {
            kind: 'star',
            speedMin: 55,
            speedMax: 165,
            gravity: 60,
          });
          pod.scaleX = 0.9;
          pod.scaleY = 1.14;
        }
      }

      // Action spikes (dash, hop, tackle, slash, smash, flip, dig, bounce)
      const actionSpiked =
        ((cp.dashTimer ?? 0) > (pp.dashTimer ?? 0) + 0.04) ||
        ((cp.sprintTimer ?? 0) > (pp.sprintTimer ?? 0) + 0.04) ||
        ((cp.lungeTimer ?? 0) > (pp.lungeTimer ?? 0) + 0.04) ||
        ((cp.tackleTimer ?? 0) > (pp.tackleTimer ?? 0) + 0.04) ||
        ((cp.smashTimer ?? 0) > (pp.smashTimer ?? 0) + 0.04) ||
        ((cp.slashTimer ?? 0) > (pp.slashTimer ?? 0) + 0.04) ||
        ((cp.slideTimer ?? 0) > (pp.slideTimer ?? 0) + 0.04) ||
        ((cp.hopTimer ?? 0) > (pp.hopTimer ?? 0) + 0.04) ||
        ((cp.leapTimer ?? 0) > (pp.leapTimer ?? 0) + 0.04) ||
        ((cp.digTimer ?? 0) > (pp.digTimer ?? 0) + 0.04) ||
        ((cp.bounceTimer ?? 0) > (pp.bounceTimer ?? 0) + 0.04) ||
        (Boolean(cp.boosting) && !pp.boosting);

      if (actionSpiked) {
        pod.scaleX = 1.24;
        pod.scaleY = 0.78;
        spawnBurst(st, px, py, col, 6, { kind: 'dust', speedMin: 40, speedMax: 130, sizeMax: 5 });
      }

      // GravityFlip bounce squash when flipping ceiling <-> floor
      if (pp.gravityDir !== undefined && cp.gravityDir !== undefined && pp.gravityDir !== cp.gravityDir) {
        pod.scaleX = 0.74;
        pod.scaleY = 1.3;
        spawnBurst(st, px, py, '#00C2FF', 8, { kind: 'spark', speedMin: 70, speedMax: 180 });
      }

      // FusePass bomb handoff beam/spark
      if (pp.hasBomb === false && cp.hasBomb === true) {
        spawnRing(st, px, py, 74, '#FF4D2E', 4);
        spawnBurst(st, px, py, '#FFB800', 10, { kind: 'ember', speedMin: 90, speedMax: 210 });
        pod.scaleX = 1.25;
        pod.scaleY = 0.78;
      }

      // CrownHeist crown grab
      if (pp.hasCrown === false && cp.hasCrown === true) {
        spawnRing(st, px, py, 82, '#FFB800', 4.5);
        spawnBurst(st, px, py - 10, '#FFB800', 12, { kind: 'star', speedMin: 70, speedMax: 210 });
      }
    }
  }

  // Genre-specific event diffs
  switch (curr.gameId) {
    case 'turbo-striker':
    case 'hyper-pong':
    case 'pinball-clash': {
      const s = curr as unknown as { goalBanner?: string | null; goalBannerColor?: string | null };
      const key = s.goalBanner ?? '';
      if (key && key !== st.prevGoalKey) {
        const col = s.goalBannerColor ?? '#FFB800';
        spawnBurst(st, 600, 340, col, 28, { kind: 'confetti', speedMin: 140, speedMax: 420, sizeMax: 7, lifeMax: 1.0 });
        spawnBurst(st, 600, 340, '#FFFFFF', 14, { kind: 'confetti', speedMin: 120, speedMax: 380, sizeMax: 6, lifeMax: 0.95 });
        spawnRing(st, 600, 340, 260, col, 6);
        st.flashColor = col;
        st.flashAlpha = 0.28;
        st.hitStopTimer = 0.045;
      }
      st.prevGoalKey = key;
      break;
    }
    case 'hex-drop': {
      for (const tile of curr.tiles) {
        if (tile.state === 'falling' && !st.prevHexFallingIds.has(tile.id)) {
          st.prevHexFallingIds.add(tile.id);
          spawnBurst(st, tile.x, tile.y, '#94A3B8', 5, { kind: 'dust', speedMin: 40, speedMax: 120 });
        }
      }
      break;
    }
    case 'color-match': {
      for (const tile of curr.tiles) {
        if (tile.dropped && !st.prevColorDroppedIds.has(tile.id)) {
          st.prevColorDroppedIds.add(tile.id);
          spawnBurst(st, tile.x + tile.w / 2, tile.y + tile.h / 2, '#E2E8F0', 5, {
            kind: 'dust',
            speedMin: 40,
            speedMax: 110,
          });
        } else if (!tile.dropped && st.prevColorDroppedIds.has(tile.id)) {
          st.prevColorDroppedIds.delete(tile.id);
        }
      }
      break;
    }
    case 'treasure-dig': {
      if (curr.dugHoles.length > st.prevDugCount) {
        const newest = curr.dugHoles[curr.dugHoles.length - 1];
        if (newest) {
          spawnBurst(
            st,
            newest.x,
            newest.y,
            newest.success ? '#FFB800' : '#E7C282',
            newest.success ? 14 : 7,
            { kind: newest.success ? 'star' : 'dust', speedMin: 70, speedMax: 210 }
          );
          if (newest.success) spawnRing(st, newest.x, newest.y, 76, '#FFB800', 4);
        }
      }
      st.prevDugCount = curr.dugHoles.length;
      break;
    }
    case 'bomb-grid': {
      if (curr.flames.length > st.prevFlameCount + 2) {
        addKick(st, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, 5.5);
      }
      st.prevFlameCount = curr.flames.length;
      break;
    }
    case 'red-light-dash': {
      if (st.prevLightState !== curr.lightState) {
        if (curr.lightState === 'red') {
          st.flashColor = '#FF4D2E';
          st.flashAlpha = 0.18;
        } else if (curr.lightState === 'green') {
          st.flashColor = '#10D98B';
          st.flashAlpha = 0.14;
        }
      }
      st.prevLightState = curr.lightState;
      break;
    }
    case 'lucky-auction': {
      if (curr.highestBid > st.prevHighestBid) {
        spawnRing(st, 600, 224, 150, curr.highestBidderColor ?? '#FFB800', 4.5);
        spawnBurst(st, 600, 224, curr.highestBidderColor ?? '#FFB800', 10, {
          kind: 'spark',
          speedMin: 80,
          speedMax: 240,
        });
      }
      if (st.prevAuctionPhase !== 'reveal' && curr.phase === 'reveal') {
        const prizeCol = curr.revealedPrize === 'duck' ? '#FFB800' : '#10D98B';
        spawnBurst(st, 600, 224, '#FFB800', 24, { kind: 'confetti', speedMin: 120, speedMax: 360, lifeMax: 0.9 });
        spawnBurst(st, 600, 224, prizeCol, 14, { kind: 'star', speedMin: 90, speedMax: 260 });
        spawnRing(st, 600, 224, 210, '#FFB800', 5);
        st.flashColor = '#FFB800';
        st.flashAlpha = 0.22;
      }
      st.prevHighestBid = curr.highestBid;
      st.prevAuctionPhase = curr.phase;
      break;
    }
  }
}

// ============================================================
// SUB-TICK INTERPOLATION
// ============================================================
type AngleFieldName = 'angle' | 'hullAngle' | 'turretAngle' | 'aimAngle' | 'rot' | 'spinAngle' | 'flipRot';

interface ScalarInterpSpec {
  key: string;
  maxJump: number;
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function wrappedAngleDiff(a: number, b: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff);
}

function interpPointArray<T extends object>(
  prevArr: T[] | undefined,
  currArr: T[] | undefined,
  alpha: number,
  extraAngles?: AngleFieldName[],
  maxJump = 135,
  extraScalars?: ScalarInterpSpec[]
): T[] | undefined {
  if (!currArr || !prevArr || currArr.length === 0 || prevArr.length === 0) return currArr;

  const prevById = new Map<string, T>();
  const hasId = typeof (currArr[0] as { id?: unknown }).id === 'string';
  if (hasId) {
    for (const item of prevArr) {
      const id = (item as { id?: string }).id;
      if (id) prevById.set(id, item);
    }
  }

  return currArr.map((c, idx) => {
    const id = hasId ? (c as { id?: string }).id : undefined;
    const p = id ? prevById.get(id) : prevArr[idx];
    if (!p) return c;

    const pRec = p as Record<string, unknown>;
    const cRec = c as Record<string, unknown>;
    const hasX = isFiniteNum(pRec.x) && isFiniteNum(cRec.x);
    const hasY = isFiniteNum(pRec.y) && isFiniteNum(cRec.y);

    if (hasX && hasY) {
      if (Math.hypot((cRec.x as number) - (pRec.x as number), (cRec.y as number) - (pRec.y as number)) > maxJump) {
        return c;
      }
    } else if (hasX) {
      if (Math.abs((cRec.x as number) - (pRec.x as number)) > maxJump) return c;
    } else if (hasY) {
      if (Math.abs((cRec.y as number) - (pRec.y as number)) > maxJump) return c;
    } else if (!extraScalars && !extraAngles) {
      return c;
    }

    let mutated = false;
    const clone: Record<string, unknown> = { ...cRec };

    if (hasX) {
      clone.x = lerp(pRec.x as number, cRec.x as number, alpha);
      mutated = true;
    }
    if (hasY) {
      clone.y = lerp(pRec.y as number, cRec.y as number, alpha);
      mutated = true;
    }

    if (extraAngles) {
      for (const k of extraAngles) {
        if (isFiniteNum(pRec[k]) && isFiniteNum(cRec[k])) {
          clone[k] = lerpAngle(pRec[k] as number, cRec[k] as number, alpha);
          mutated = true;
        }
      }
    }

    if (extraScalars) {
      for (const spec of extraScalars) {
        if (isFiniteNum(pRec[spec.key]) && isFiniteNum(cRec[spec.key])) {
          const pv = pRec[spec.key] as number;
          const cv = cRec[spec.key] as number;
          if (Math.abs(cv - pv) <= spec.maxJump) {
            clone[spec.key] = lerp(pv, cv, alpha);
            mutated = true;
          }
        }
      }
    }

    return mutated ? (clone as T) : c;
  });
}

function interpPlayersById<T extends { id: string }>(
  prevPlayers: T[],
  currPlayers: T[],
  patchFn: (prev: T, curr: T) => T | null
): T[] {
  if (prevPlayers.length === 0 || currPlayers.length === 0) return currPlayers;
  const prevMap = new Map<string, T>();
  for (const p of prevPlayers) prevMap.set(p.id, p);
  return currPlayers.map((c) => {
    const p = prevMap.get(c.id);
    if (!p) return c;
    return patchFn(p, c) ?? c;
  });
}

function buildInterpolatedSnapshot(
  prev: GameSnapshot,
  curr: GameSnapshot,
  alpha: number
): GameSnapshot {
  if (alpha >= 0.999 || prev.gameId !== curr.gameId) return curr;

  const out: Record<string, unknown> = { ...(curr as unknown as Record<string, unknown>) };
  const pRec = prev as unknown as Record<string, unknown>;
  const cRec = curr as unknown as Record<string, unknown>;

  const isGridSpaceGame =
    curr.gameId === 'maze-chomper' ||
    curr.gameId === 'tunnel-dig' ||
    curr.gameId === 'turf-ribbon';
  const playerMaxJump = isGridSpaceGame ? 2.5 : 135;

  if (Array.isArray(cRec.players) && Array.isArray(pRec.players)) {
    const firstP = cRec.players[0] as Record<string, unknown> | undefined;
    if (firstP && (isFiniteNum(firstP.x) || isFiniteNum(firstP.y))) {
      out.players = interpPointArray(
        pRec.players as Record<string, unknown>[],
        cRec.players as Record<string, unknown>[],
        alpha,
        ['angle', 'hullAngle', 'turretAngle', 'aimAngle', 'rot', 'spinAngle', 'flipRot'],
        playerMaxJump,
        [
          { key: 'z', maxJump: 135 },
          { key: 'zHeight', maxJump: 135 },
          { key: 'clawDepth', maxJump: 0.35 },
        ]
      );
    }
  }

  // Common moving entity arrays
  const entityKeys: {
    key: string;
    angles?: AngleFieldName[];
    scalars?: ScalarInterpSpec[];
    requireId?: boolean;
  }[] = [
    // Legacy covered arrays
    { key: 'bullets' },
    { key: 'shells' },
    { key: 'orbs' },
    { key: 'bolts' },
    {
      key: 'meteors',
      angles: ['angle'],
      scalars: [{ key: 'progress', maxJump: 0.35 }],
    },
    { key: 'drones', angles: ['angle'] },
    { key: 'crabs', angles: ['angle'] },
    { key: 'items', angles: ['rot'] },
    { key: 'flyingPlates' },
    { key: 'balls' },
    { key: 'bonusBalls' },
    { key: 'extraPucks' },
    { key: 'waveProjectiles', angles: ['angle'] },
    // Extended ID-backed / fixed-slot moving arrays
    { key: 'fireballs', requireId: true },
    { key: 'nets', requireId: true },
    { key: 'shards', requireId: true },
    { key: 'hazards', requireId: true },
    { key: 'stars', requireId: true },
    { key: 'ingredients', requireId: true },
    { key: 'prizes', requireId: true },
    { key: 'creeps', requireId: true },
    { key: 'enemies', requireId: true },
    { key: 'gems', requireId: true },
    { key: 'threats', requireId: true },
    { key: 'planes', angles: ['angle'], requireId: true },
    { key: 'trains', requireId: true },
    { key: 'fish', requireId: true },
    { key: 'fruits', requireId: true },
    { key: 'feathers', requireId: true },
    { key: 'obstacles', angles: ['angle'], requireId: true },
    { key: 'platforms', requireId: true },
    { key: 'collectibles', requireId: true },
    { key: 'marbles', requireId: true },
    { key: 'projectiles', requireId: true },
    { key: 'buckets', requireId: true },
    { key: 'coins', requireId: true },
    { key: 'aliens', requireId: true },
    { key: 'barrels', requireId: true },
    { key: 'targets', requireId: true },
    { key: 'bombs', requireId: true },
    { key: 'anvils', requireId: true, scalars: [{ key: 'progress', maxJump: 0.35 }] },
    { key: 'pucks' }, // air-hockey-neo (1 fixed puck) & carrom-arena (id-backed)
    { key: 'stones', requireId: true },
    { key: 'pitches', requireId: true },
    { key: 'notes', requireId: true },
    { key: 'neutrals', requireId: true },
    { key: 'gustRings', requireId: true },
  ];

  for (const ek of entityKeys) {
    const cArr = cRec[ek.key];
    const pArr = pRec[ek.key];
    if (Array.isArray(cArr) && Array.isArray(pArr) && cArr.length > 0 && pArr.length > 0) {
      if (ek.requireId && typeof (cArr[0] as { id?: unknown }).id !== 'string') {
        continue;
      }
      out[ek.key] = interpPointArray(
        pArr as Record<string, unknown>[],
        cArr as Record<string, unknown>[],
        alpha,
        ek.angles,
        135,
        ek.scalars
      );
    }
  }

  // Game-specific single objects, 1D/normalized coordinates, nested arrays & cameras
  switch (curr.gameId) {
    case 'turbo-striker': {
      if (prev.gameId !== 'turbo-striker') break;
      const d = Math.hypot(curr.ball.x - prev.ball.x, curr.ball.y - prev.ball.y);
      if (d < 135) {
        out.ball = {
          ...curr.ball,
          x: lerp(prev.ball.x, curr.ball.x, alpha),
          y: lerp(prev.ball.y, curr.ball.y, alpha),
        };
      }
      break;
    }

    case 'hyper-pong': {
      if (prev.gameId !== 'hyper-pong') break;
      const d = Math.hypot(curr.puck.x - prev.puck.x, curr.puck.y - prev.puck.y);
      if (d < 135) {
        out.puck = {
          ...curr.puck,
          x: lerp(prev.puck.x, curr.puck.x, alpha),
          y: lerp(prev.puck.y, curr.puck.y, alpha),
        };
      }
      break;
    }

    case 'gravity-flip': {
      if (prev.gameId !== 'gravity-flip') break;
      if (Math.abs(curr.scrollX - prev.scrollX) < 135) {
        out.scrollX = lerp(prev.scrollX, curr.scrollX, alpha);
      }
      out.obstacles = interpPointArray(prev.obstacles, curr.obstacles, alpha);
      out.coins = interpPointArray(prev.coins, curr.coins, alpha);
      out.gates = interpPointArray(prev.gates, curr.gates, alpha);
      out.pickups = interpPointArray(prev.pickups, curr.pickups, alpha);
      break;
    }

    case 'volley-smash': {
      if (prev.gameId !== 'volley-smash') break;
      const d = Math.hypot(curr.ball.x - prev.ball.x, curr.ball.y - prev.ball.y);
      if (d < 135) {
        out.ball = {
          ...curr.ball,
          x: lerp(prev.ball.x, curr.ball.x, alpha),
          y: lerp(prev.ball.y, curr.ball.y, alpha),
          z: Math.abs(curr.ball.z - prev.ball.z) < 135 ? lerp(prev.ball.z, curr.ball.z, alpha) : curr.ball.z,
          targetX:
            Math.abs(curr.ball.targetX - prev.ball.targetX) < 135
              ? lerp(prev.ball.targetX, curr.ball.targetX, alpha)
              : curr.ball.targetX,
          targetY:
            Math.abs(curr.ball.targetY - prev.ball.targetY) < 135
              ? lerp(prev.ball.targetY, curr.ball.targetY, alpha)
              : curr.ball.targetY,
        };
      }
      break;
    }

    case 'rattan-volley': {
      if (prev.gameId !== 'rattan-volley') break;
      const d = Math.hypot(curr.ball.x - prev.ball.x, curr.ball.y - prev.ball.y);
      if (d < 135) {
        out.ball = {
          ...curr.ball,
          x: lerp(prev.ball.x, curr.ball.x, alpha),
          y: lerp(prev.ball.y, curr.ball.y, alpha),
          rot: lerpAngle(prev.ball.rot, curr.ball.rot, alpha),
        };
      }
      break;
    }

    case 'disc-arena': {
      if (prev.gameId !== 'disc-arena') break;
      const d = Math.hypot(curr.disc.x - prev.disc.x, curr.disc.y - prev.disc.y);
      if (d < 135) {
        out.disc = {
          ...curr.disc,
          x: lerp(prev.disc.x, curr.disc.x, alpha),
          y: lerp(prev.disc.y, curr.disc.y, alpha),
        };
      }
      break;
    }

    case 'badminton-smash': {
      if (prev.gameId !== 'badminton-smash') break;
      const d = Math.hypot(curr.shuttle.x - prev.shuttle.x, curr.shuttle.y - prev.shuttle.y);
      if (d < 135) {
        out.shuttle = {
          ...curr.shuttle,
          x: lerp(prev.shuttle.x, curr.shuttle.x, alpha),
          y: lerp(prev.shuttle.y, curr.shuttle.y, alpha),
        };
      }
      break;
    }

    case 'carrom-arena': {
      if (prev.gameId !== 'carrom-arena') break;
      const d = Math.hypot(curr.striker.x - prev.striker.x, curr.striker.y - prev.striker.y);
      if (d < 135) {
        out.striker = {
          ...curr.striker,
          x: lerp(prev.striker.x, curr.striker.x, alpha),
          y: lerp(prev.striker.y, curr.striker.y, alpha),
        };
      }
      break;
    }

    case 'cannon-siege': {
      if (prev.gameId !== 'cannon-siege') break;
      if (curr.goldenTarget && prev.goldenTarget && Math.abs(curr.goldenTarget.y - prev.goldenTarget.y) < 60) {
        out.goldenTarget = {
          ...curr.goldenTarget,
          y: lerp(prev.goldenTarget.y, curr.goldenTarget.y, alpha),
        };
      }
      break;
    }

    case 'hook-shot': {
      if (prev.gameId !== 'hook-shot') break;
      if (curr.hooks.length > 0 && prev.hooks.length > 0) {
        const prevByOwner = new Map(prev.hooks.map((h) => [h.ownerId, h]));
        out.hooks = curr.hooks.map((c) => {
          const p = prevByOwner.get(c.ownerId);
          if (!p) return c;
          if (Math.hypot(c.x2 - p.x2, c.y2 - p.y2) > 135) return c;
          return {
            ...c,
            x1: Math.abs(c.x1 - p.x1) < 135 ? lerp(p.x1, c.x1, alpha) : c.x1,
            y1: Math.abs(c.y1 - p.y1) < 135 ? lerp(p.y1, c.y1, alpha) : c.y1,
            x2: lerp(p.x2, c.x2, alpha),
            y2: lerp(p.y2, c.y2, alpha),
          };
        });
      }
      break;
    }

    case 'crown-heist': {
      if (prev.gameId !== 'crown-heist') break;
      if (Math.hypot(curr.crownX - prev.crownX, curr.crownY - prev.crownY) < 135) {
        out.crownX = lerp(prev.crownX, curr.crownX, alpha);
        out.crownY = lerp(prev.crownY, curr.crownY, alpha);
      }
      break;
    }

    case 'king-of-hill-neo': {
      if (prev.gameId !== 'king-of-hill-neo') break;
      if (Math.hypot(curr.zoneX - prev.zoneX, curr.zoneY - prev.zoneY) < 80) {
        out.zoneX = lerp(prev.zoneX, curr.zoneX, alpha);
        out.zoneY = lerp(prev.zoneY, curr.zoneY, alpha);
      }
      break;
    }

    case 'laser-jump-rope': {
      if (prev.gameId !== 'laser-jump-rope') break;
      if (wrappedAngleDiff(prev.beamAngle, curr.beamAngle) < 0.8) {
        out.beamAngle = lerpAngle(prev.beamAngle, curr.beamAngle, alpha);
      }
      break;
    }

    case 'laser-maze-heist': {
      if (prev.gameId !== 'laser-maze-heist') break;
      if (prev.sweepers.length === curr.sweepers.length && curr.sweepers.length > 0) {
        out.sweepers = curr.sweepers.map((c, idx) => {
          const p = prev.sweepers[idx];
          if (!p || wrappedAngleDiff(p.angle, c.angle) >= 0.8) return c;
          return { ...c, angle: lerpAngle(p.angle, c.angle, alpha) };
        });
      }
      break;
    }

    case 'laser-gauntlet': {
      if (prev.gameId !== 'laser-gauntlet') break;
      if (wrappedAngleDiff(prev.coreAngle, curr.coreAngle) < 0.8) {
        out.coreAngle = lerpAngle(prev.coreAngle, curr.coreAngle, alpha);
      }
      if (prev.beams.length === curr.beams.length && curr.beams.length > 0) {
        out.beams = curr.beams.map((c, idx) => {
          const p = prev.beams[idx];
          if (!p || wrappedAngleDiff(p.angle, c.angle) >= 0.08) return c;
          return { ...c, angle: lerpAngle(p.angle, c.angle, alpha) };
        });
      }
      break;
    }

    case 'starship-crew-chaos': {
      if (prev.gameId !== 'starship-crew-chaos') break;
      if (Math.hypot(curr.shipX - prev.shipX, curr.shipY - prev.shipY) < 135) {
        out.shipX = lerp(prev.shipX, curr.shipX, alpha);
        out.shipY = lerp(prev.shipY, curr.shipY, alpha);
      }
      if (wrappedAngleDiff(prev.shipAngle, curr.shipAngle) < 0.8) {
        out.shipAngle = lerpAngle(prev.shipAngle, curr.shipAngle, alpha);
      }
      if (wrappedAngleDiff(prev.shieldAngle, curr.shieldAngle) < 0.8) {
        out.shieldAngle = lerpAngle(prev.shieldAngle, curr.shieldAngle, alpha);
      }
      if (curr.stations.length > 0 && prev.stations.length > 0) {
        const prevStations = new Map(prev.stations.map((s) => [s.id, s]));
        out.stations = curr.stations.map((c) => {
          const p = prevStations.get(c.id);
          if (!p || Math.hypot(c.x - p.x, c.y - p.y) >= 135) return c;
          return { ...c, x: lerp(p.x, c.x, alpha), y: lerp(p.y, c.y, alpha) };
        });
      }
      break;
    }

    case 'rope-slice-physics': {
      if (prev.gameId !== 'rope-slice-physics') break;
      if (curr.ropes.length > 0 && prev.ropes.length > 0) {
        const prevRopes = new Map(prev.ropes.map((r) => [r.id, r]));
        out.ropes = curr.ropes.map((c) => {
          const p = prevRopes.get(c.id);
          if (!p || Math.hypot(c.orbX - p.orbX, c.orbY - p.orbY) >= 135) return c;
          return { ...c, orbX: lerp(p.orbX, c.orbX, alpha), orbY: lerp(p.orbY, c.orbY, alpha) };
        });
      }
      break;
    }

    case 'frog-crossing': {
      if (prev.gameId !== 'frog-crossing') break;
      if (prev.lanes.length === curr.lanes.length && curr.lanes.length > 0) {
        out.lanes = curr.lanes.map((lane, lIdx) => {
          const pLane = prev.lanes[lIdx];
          if (!pLane || pLane.items.length !== lane.items.length || lane.items.length === 0) return lane;
          return {
            ...lane,
            items: lane.items.map((item, iIdx) => {
              const pItem = pLane.items[iIdx];
              if (!pItem || Math.abs(item.x - pItem.x) >= 135) return item;
              return { ...item, x: lerp(pItem.x, item.x, alpha) };
            }),
          };
        });
      }
      break;
    }

    case 'coin-dozer': {
      if (prev.gameId !== 'coin-dozer') break;
      if (Math.abs(curr.pusherY - prev.pusherY) < 60) {
        out.pusherY = lerp(prev.pusherY, curr.pusherY, alpha);
      }
      break;
    }

    case 'hoop-blitz': {
      if (prev.gameId !== 'hoop-blitz') break;
      if (Math.abs(curr.hoopX - prev.hoopX) < 80) {
        out.hoopX = lerp(prev.hoopX, curr.hoopX, alpha);
      }
      break;
    }

    case 'penalty-duel': {
      if (prev.gameId !== 'penalty-duel') break;
      if (Math.abs(curr.keeperX - prev.keeperX) < 80) {
        out.keeperX = lerp(prev.keeperX, curr.keeperX, alpha);
      }
      out.players = interpPlayersById(prev.players, curr.players, (p, c) =>
        Math.abs(c.aimX - p.aimX) < 135 ? { ...c, aimX: lerp(p.aimX, c.aimX, alpha) } : null
      );
      break;
    }

    case 'archery-wind': {
      if (prev.gameId !== 'archery-wind') break;
      if (Math.hypot(curr.targetX - prev.targetX, curr.targetY - prev.targetY) < 80) {
        out.targetX = lerp(prev.targetX, curr.targetX, alpha);
        out.targetY = lerp(prev.targetY, curr.targetY, alpha);
      }
      out.players = interpPlayersById(prev.players, curr.players, (p, c) => {
        if (Math.hypot(c.aimX - p.aimX, c.aimY - p.aimY) >= 135) return null;
        return { ...c, aimX: lerp(p.aimX, c.aimX, alpha), aimY: lerp(p.aimY, c.aimY, alpha) };
      });
      break;
    }

    case 'peg-fever-bounce': {
      if (prev.gameId !== 'peg-fever-bounce') break;
      if (Math.abs(curr.bucketX - prev.bucketX) < 80) {
        out.bucketX = lerp(prev.bucketX, curr.bucketX, alpha);
      }
      out.players = interpPlayersById(prev.players, curr.players, (p, c) =>
        Math.abs(c.aimX - p.aimX) < 135 ? { ...c, aimX: lerp(p.aimX, c.aimX, alpha) } : null
      );
      break;
    }

    case 'five-second-microgames': {
      if (prev.gameId !== 'five-second-microgames') break;
      if (Math.hypot(curr.hazardX - prev.hazardX, curr.hazardY - prev.hazardY) < 135) {
        out.hazardX = lerp(prev.hazardX, curr.hazardX, alpha);
        out.hazardY = lerp(prev.hazardY, curr.hazardY, alpha);
      }
      break;
    }

    case 'bridge-load-stress': {
      if (prev.gameId !== 'bridge-load-stress') break;
      if (Math.hypot(curr.truckX - prev.truckX, curr.truckY - prev.truckY) < 135) {
        out.truckX = lerp(prev.truckX, curr.truckX, alpha);
        out.truckY = lerp(prev.truckY, curr.truckY, alpha);
      }
      break;
    }

    case 'block-hop': {
      if (prev.gameId !== 'block-hop') break;
      if (Math.hypot(curr.cameraX - prev.cameraX, curr.cameraY - prev.cameraY) < 135) {
        out.cameraX = lerp(prev.cameraX, curr.cameraX, alpha);
        out.cameraY = lerp(prev.cameraY, curr.cameraY, alpha);
      }
      break;
    }

    case 'platform-leap': {
      if (prev.gameId !== 'platform-leap') break;
      if (Math.abs(curr.cameraY - prev.cameraY) < 135) {
        out.cameraY = lerp(prev.cameraY, curr.cameraY, alpha);
      }
      if (Math.abs(curr.lavaY - prev.lavaY) < 135) {
        out.lavaY = lerp(prev.lavaY, curr.lavaY, alpha);
      }
      break;
    }

    case 'egg-rush': {
      if (prev.gameId !== 'egg-rush') break;
      if (Math.abs(curr.cameraX - prev.cameraX) < 135) {
        out.cameraX = lerp(prev.cameraX, curr.cameraX, alpha);
      }
      break;
    }

    case 'sky-climb': {
      if (prev.gameId !== 'sky-climb') break;
      if (Math.abs(curr.cameraY - prev.cameraY) < 135) {
        out.cameraY = lerp(prev.cameraY, curr.cameraY, alpha);
      }
      break;
    }

    case 'flappy-flock': {
      if (prev.gameId !== 'flappy-flock') break;
      if (Math.abs(curr.scrollX - prev.scrollX) < 135) {
        out.scrollX = lerp(prev.scrollX, curr.scrollX, alpha);
      }
      if (prev.pipes.length === curr.pipes.length && curr.pipes.length > 0) {
        out.pipes = curr.pipes.map((c, idx) => {
          const p = prev.pipes[idx];
          if (!p || Math.abs(c.x - p.x) >= 135) return c;
          return { ...c, x: lerp(p.x, c.x, alpha) };
        });
      }
      break;
    }

    case 'hill-torque-climb': {
      if (prev.gameId !== 'hill-torque-climb') break;
      if (Math.abs(curr.cameraX - prev.cameraX) < 135) {
        out.cameraX = lerp(prev.cameraX, curr.cameraX, alpha);
      }
      if (prev.terrainHeights.length === curr.terrainHeights.length && curr.terrainHeights.length > 0) {
        out.terrainHeights = curr.terrainHeights.map((c, idx) => {
          const p = prev.terrainHeights[idx];
          if (!p || Math.abs(c.y - p.y) >= 135) return c;
          return { ...c, y: lerp(p.y, c.y, alpha) };
        });
      }
      break;
    }

    case 'three-lane-metro': {
      if (prev.gameId !== 'three-lane-metro') break;
      out.players = interpPlayersById(prev.players, curr.players, (p, c) =>
        Math.abs(c.zHeight - p.zHeight) < 135 ? { ...c, zHeight: lerp(p.zHeight, c.zHeight, alpha) } : null
      );
      if (curr.obstacles.length > 0 && prev.obstacles.length > 0) {
        const prevObs = new Map(prev.obstacles.map((o) => [o.id, o]));
        out.obstacles = curr.obstacles.map((c) => {
          const p = prevObs.get(c.id);
          if (!p || Math.abs(c.z - p.z) >= 0.25) return c;
          return { ...c, z: lerp(p.z, c.z, alpha) };
        });
      }
      break;
    }

    case 'slither-feast': {
      if (prev.gameId !== 'slither-feast') break;
      if (curr.snakes.length > 0 && prev.snakes.length > 0) {
        const prevSnakes = new Map(prev.snakes.map((s) => [s.id, s]));
        out.snakes = curr.snakes.map((c) => {
          const p = prevSnakes.get(c.id);
          if (!p || !c.alive || !p.alive) return c;
          const nextAngle = wrappedAngleDiff(p.angle, c.angle) < 0.8 ? lerpAngle(p.angle, c.angle, alpha) : c.angle;
          let nextSegments = c.segments;
          if (
            c.segments.length > 0 &&
            p.segments.length > 0 &&
            Math.hypot(c.segments[0].x - p.segments[0].x, c.segments[0].y - p.segments[0].y) < 40
          ) {
            nextSegments = c.segments.map((seg, idx) => {
              const pSeg = p.segments[idx];
              if (!pSeg) return seg;
              const dist = Math.hypot(seg.x - pSeg.x, seg.y - pSeg.y);
              if (dist > (idx === 0 ? 40 : 25)) return seg;
              return { x: lerp(pSeg.x, seg.x, alpha), y: lerp(pSeg.y, seg.y, alpha) };
            });
          }
          return { ...c, angle: nextAngle, segments: nextSegments };
        });
      }
      break;
    }

    case 'seesaw-balance': {
      if (prev.gameId !== 'seesaw-balance') break;
      if (Math.abs(curr.beamTilt - prev.beamTilt) < 0.25) {
        out.beamTilt = lerp(prev.beamTilt, curr.beamTilt, alpha);
      }
      out.players = interpPlayersById(prev.players, curr.players, (p, c) => ({
        ...c,
        offset: Math.abs(c.offset - p.offset) < 135 ? lerp(p.offset, c.offset, alpha) : c.offset,
        z: Math.abs(c.z - p.z) < 135 ? lerp(p.z, c.z, alpha) : c.z,
      }));
      break;
    }

    case 'wobbly-timber-pull': {
      if (prev.gameId !== 'wobbly-timber-pull') break;
      if (Math.abs(curr.tiltAngle - prev.tiltAngle) < 0.2) {
        out.tiltAngle = lerp(prev.tiltAngle, curr.tiltAngle, alpha);
      }
      break;
    }

    case 'tilt-labyrinth': {
      if (prev.gameId !== 'tilt-labyrinth') break;
      if (Math.abs(curr.tiltX - prev.tiltX) < 0.5) {
        out.tiltX = lerp(prev.tiltX, curr.tiltX, alpha);
      }
      if (Math.abs(curr.tiltY - prev.tiltY) < 0.5) {
        out.tiltY = lerp(prev.tiltY, curr.tiltY, alpha);
      }
      break;
    }

    case 'tug-titan': {
      if (prev.gameId !== 'tug-titan') break;
      if (Math.abs(curr.ropeOffset - prev.ropeOffset) < 0.3) {
        out.ropeOffset = lerp(prev.ropeOffset, curr.ropeOffset, alpha);
      }
      break;
    }

    case 'stack-tower': {
      if (prev.gameId !== 'stack-tower') break;
      out.players = interpPlayersById(prev.players, curr.players, (p, c) =>
        Math.abs(c.moverX - p.moverX) < 0.25 ? { ...c, moverX: lerp(p.moverX, c.moverX, alpha) } : null
      );
      break;
    }

    case 'home-run-derby': {
      if (prev.gameId !== 'home-run-derby') break;
      out.players = interpPlayersById(prev.players, curr.players, (p, c) =>
        Math.abs(c.laneX - p.laneX) < 135 ? { ...c, laneX: lerp(p.laneX, c.laneX, alpha) } : null
      );
      break;
    }

    case 'skee-roll': {
      if (prev.gameId !== 'skee-roll') break;
      out.players = interpPlayersById(prev.players, curr.players, (p, c) =>
        Math.abs(c.aimX - p.aimX) < 135 ? { ...c, aimX: lerp(p.aimX, c.aimX, alpha) } : null
      );
      break;
    }

    case 'pin-strike': {
      if (prev.gameId !== 'pin-strike') break;
      out.players = interpPlayersById(prev.players, curr.players, (p, c) =>
        Math.abs(c.laneX - p.laneX) < 135 ? { ...c, laneX: lerp(p.laneX, c.laneX, alpha) } : null
      );
      break;
    }

    case 'canoe-sprint': {
      if (prev.gameId !== 'canoe-sprint') break;
      out.players = interpPlayersById(prev.players, curr.players, (p, c) => ({
        ...c,
        laneX: Math.abs(c.laneX - p.laneX) < 135 ? lerp(p.laneX, c.laneX, alpha) : c.laneX,
        dist: Math.abs(c.dist - p.dist) < 135 ? lerp(p.dist, c.dist, alpha) : c.dist,
      }));
      break;
    }

    case 'hotpot-rush': {
      if (prev.gameId !== 'hotpot-rush') break;
      out.players = interpPlayersById(prev.players, curr.players, (p, c) =>
        Math.hypot(c.tipX - p.tipX, c.tipY - p.tipY) < 135
          ? { ...c, tipX: lerp(p.tipX, c.tipX, alpha), tipY: lerp(p.tipY, c.tipY, alpha) }
          : null
      );
      break;
    }

    case 'melon-merge': {
      if (prev.gameId !== 'melon-merge') break;
      out.players = interpPlayersById(prev.players, curr.players, (p, c) => ({
        ...c,
        aimX: Math.abs(c.aimX - p.aimX) < 0.25 ? lerp(p.aimX, c.aimX, alpha) : c.aimX,
        fruits: interpPointArray(p.fruits, c.fruits, alpha, undefined, 0.35) ?? c.fruits,
      }));
      break;
    }

    case 'curling-masters': {
      if (prev.gameId !== 'curling-masters') break;
      out.players = interpPlayersById(prev.players, curr.players, (p, c) =>
        Math.abs(c.aimX - p.aimX) < 135 ? { ...c, aimX: lerp(p.aimX, c.aimX, alpha) } : null
      );
      break;
    }

    case 'maze-chomper': {
      if (prev.gameId !== 'maze-chomper') break;
      out.ghosts = interpPointArray(prev.ghosts, curr.ghosts, alpha, undefined, 2.5);
      break;
    }

    case 'tunnel-dig': {
      if (prev.gameId !== 'tunnel-dig') break;
      out.boulders = interpPointArray(prev.boulders, curr.boulders, alpha, undefined, 2.5);
      out.monsters = interpPointArray(prev.monsters, curr.monsters, alpha, undefined, 2.5);
      break;
    }

    case 'chain-gang-climb': {
      if (prev.gameId !== 'chain-gang-climb') break;
      if (isFiniteNum(curr.scrollY) && isFiniteNum(prev.scrollY) && Math.abs(curr.scrollY - prev.scrollY) < 135) {
        out.scrollY = lerp(prev.scrollY, curr.scrollY, alpha);
      }
      break;
    }

    case 'bubble-pop-arc': {
      if (prev.gameId !== 'bubble-pop-arc') break;
      if (isFiniteNum(curr.ceilingY) && isFiniteNum(prev.ceilingY) && Math.abs(curr.ceilingY - prev.ceilingY) < 40) {
        out.ceilingY = lerp(prev.ceilingY, curr.ceilingY, alpha);
      }
      if (prev.shots.length === curr.shots.length && curr.shots.length > 0) {
        out.shots = interpPointArray(prev.shots, curr.shots, alpha, undefined, 135);
      }
      break;
    }
  }

  return out as unknown as GameSnapshot;
}

const PADDLE_PREDICTION_GAMES = new Set<GameId>([
  'hyper-pong',
  'air-hockey-neo',
  'ping-pong-pro',
]);

function clampNum(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function resetPaddlePrediction(st: ArcadeMotionState): void {
  st.predOffsetX = 0;
  st.predOffsetY = 0;
  st.predLastPlayerX = null;
  st.predLastPlayerY = null;
}

function getPaddlePredictionBounds(
  gameId: GameId,
  player: Record<string, unknown>
): { minX: number; maxX: number; minY: number; maxY: number; maxOffset: number } | null {
  const px = player.x as number;
  const py = player.y as number;
  if (gameId === 'hyper-pong') {
    const r = isFiniteNum(player.radius) ? player.radius : 34;
    const isLeft = player.side === 'left';
    return {
      minX: isLeft ? 54 + r : 600 + r + 8,
      maxX: isLeft ? 600 - r - 8 : 1200 - 54 - r,
      minY: 54 + r,
      maxY: 720 - 54 - r,
      maxOffset: Math.max(48, r * 2),
    };
  }
  if (gameId === 'air-hockey-neo') {
    const isLeft = player.side === 'left';
    return {
      minX: isLeft ? 92 : 600 + 34,
      maxX: isLeft ? 600 - 34 : 1200 - 92,
      minY: 98,
      maxY: 720 - 98,
      maxOffset: 64,
    };
  }
  if (gameId === 'ping-pong-pro') {
    const isVert = player.side === 'left' || player.side === 'right';
    return isVert
      ? { minX: px, maxX: px, minY: 150, maxY: 590, maxOffset: 96 }
      : { minX: 220, maxX: 980, minY: py, maxY: py, maxOffset: 96 };
  }
  return null;
}

function applyLocalPaddlePrediction(
  snap: GameSnapshot,
  rawSnap: GameSnapshot,
  st: ArcadeMotionState,
  localPrediction: LocalPaddlePrediction | null | undefined,
  nowMs: number
): GameSnapshot {
  if (!PADDLE_PREDICTION_GAMES.has(snap.gameId)) {
    resetPaddlePrediction(st);
    return snap;
  }

  const rawStatus = (rawSnap as unknown as { status?: unknown }).status;
  if (typeof rawStatus === 'string' && rawStatus !== 'PLAYING') {
    resetPaddlePrediction(st);
    return snap;
  }

  if (!localPrediction || localPrediction.gameId !== snap.gameId || !localPrediction.playerId) {
    resetPaddlePrediction(st);
    return snap;
  }

  const snapRec = snap as unknown as { players?: Record<string, unknown>[] };
  if (!Array.isArray(snapRec.players)) {
    resetPaddlePrediction(st);
    return snap;
  }

  const meIdx = snapRec.players.findIndex((p) => p.id === localPrediction.playerId);
  if (meIdx < 0) {
    resetPaddlePrediction(st);
    return snap;
  }

  const me = snapRec.players[meIdx];
  if (
    me.alive === false ||
    me.eliminated === true ||
    !isFiniteNum(me.x) ||
    !isFiniteNum(me.y)
  ) {
    resetPaddlePrediction(st);
    return snap;
  }

  const bounds = getPaddlePredictionBounds(snap.gameId, me);
  if (!bounds) {
    resetPaddlePrediction(st);
    return snap;
  }

  // Zero predicted offset immediately on serve / goal reset teleports
  if (st.predLastPlayerX !== null && st.predLastPlayerY !== null) {
    if (Math.hypot(me.x - st.predLastPlayerX, me.y - st.predLastPlayerY) > 135) {
      st.predOffsetX = 0;
      st.predOffsetY = 0;
    }
  }
  st.predLastPlayerX = me.x;
  st.predLastPlayerY = me.y;

  const spring = 1 - Math.exp(-16 * st.dt);
  const ageMs = nowMs - localPrediction.updatedAtMs;
  const isTouchFresh =
    localPrediction.active &&
    ageMs >= -50 &&
    ageMs <= 150 &&
    isFiniteNum(localPrediction.targetX) &&
    isFiniteNum(localPrediction.targetY);

  if (isTouchFresh) {
    const clampedTargetX = clampNum(localPrediction.targetX, bounds.minX, bounds.maxX);
    const clampedTargetY = clampNum(localPrediction.targetY, bounds.minY, bounds.maxY);
    let desiredOffX = clampedTargetX - me.x;
    let desiredOffY = clampedTargetY - me.y;
    const dist = Math.hypot(desiredOffX, desiredOffY);
    if (dist > bounds.maxOffset) {
      const scale = bounds.maxOffset / dist;
      desiredOffX *= scale;
      desiredOffY *= scale;
    }
    st.predOffsetX = lerp(st.predOffsetX, desiredOffX, spring);
    st.predOffsetY = lerp(st.predOffsetY, desiredOffY, spring);
  } else {
    st.predOffsetX = lerp(st.predOffsetX, 0, spring);
    st.predOffsetY = lerp(st.predOffsetY, 0, spring);
    if (Math.hypot(st.predOffsetX, st.predOffsetY) < 0.25) {
      st.predOffsetX = 0;
      st.predOffsetY = 0;
    }
  }

  if (st.predOffsetX === 0 && st.predOffsetY === 0) {
    return snap;
  }

  const nextPlayers = snapRec.players.slice();
  nextPlayers[meIdx] = {
    ...me,
    x: clampNum(me.x + st.predOffsetX, bounds.minX, bounds.maxX),
    y: clampNum(me.y + st.predOffsetY, bounds.minY, bounds.maxY),
  };

  return {
    ...(snap as unknown as Record<string, unknown>),
    players: nextPlayers,
  } as unknown as GameSnapshot;
}

// ============================================================
// FRAME LIFECYCLE & CANVAS LAYER DRAWING
// ============================================================
export function prepareArcadeFrame(
  rawSnap: GameSnapshot,
  st: ArcadeMotionState,
  localPrediction?: LocalPaddlePrediction | null
): GameSnapshot {
  const nowMs = performance.now();
  const rawDt = st.lastFrameMs > 0 ? (nowMs - st.lastFrameMs) / 1000 : 1 / 60;
  st.dt = Math.min(0.05, Math.max(0.001, rawDt));
  st.lastFrameMs = nowMs;
  st.nowSec = nowMs / 1000;

  if (CARD_GAME_IDS.has(rawSnap.gameId)) {
    st.activeGameId = rawSnap.gameId;
    resetPaddlePrediction(st);
    return rawSnap;
  }

  if (st.activeGameId !== rawSnap.gameId) {
    resetForGameSwitch(st, rawSnap.gameId);
  }

  const roundMark = getRoundMarker(rawSnap);
  if (roundMark !== null && st.lastRoundMarker !== null && roundMark !== st.lastRoundMarker) {
    st.podMotion.forEach((pm) => {
      pm.trail = [];
    });
    st.prevHexFallingIds.clear();
  }
  st.lastRoundMarker = roundMark;

  // Detect new server snapshot arrival (~30Hz)
  if (st.currSnap !== rawSnap) {
    if (st.currSnap && st.snapReceivedMs > 0) {
      const measured = nowMs - st.snapReceivedMs;
      if (measured >= 14 && measured <= 100) {
        st.tickIntervalMs = st.tickIntervalMs * 0.72 + measured * 0.28;
      }
      diffSnapshotForFX(st.currSnap, rawSnap, st);
    }
    st.prevSnap = st.currSnap;
    st.currSnap = rawSnap;
    st.snapReceivedMs = nowMs;
  }

  const interpAlpha =
    st.prevSnap && st.currSnap
      ? clamp01((nowMs - st.snapReceivedMs) / Math.max(18, st.tickIntervalMs))
      : 1;
  st.interpAlpha = interpAlpha;

  const interpSnap =
    st.prevSnap && st.currSnap
      ? buildInterpolatedSnapshot(st.prevSnap, st.currSnap, interpAlpha)
      : rawSnap;

  const snap = applyLocalPaddlePrediction(interpSnap, rawSnap, st, localPrediction, nowMs);

  // Step 60fps per-player squash, flash, and dash/boost afterimages
  const dt = st.dt;
  const playersArr = (snap as unknown as { players?: GenericPlayerLike[] }).players;
  if (Array.isArray(playersArr)) {
    for (const p of playersArr) {
      if (typeof p.x !== 'number' || typeof p.y !== 'number') continue;
      const pm = getPodState(st, p.id, p.x, p.y);
      const spring = 1 - Math.exp(-16 * dt);
      pm.scaleX = lerp(pm.scaleX, 1, spring);
      pm.scaleY = lerp(pm.scaleY, 1, spring);
      pm.flash = Math.max(0, pm.flash - dt * 5.2);

      const isFastAction =
        (p.dashTimer ?? 0) > 0 ||
        (p.sprintTimer ?? 0) > 0 ||
        (p.lungeTimer ?? 0) > 0 ||
        (p.tackleTimer ?? 0) > 0 ||
        (p.boostTimer ?? 0) > 0 ||
        Boolean(p.boosting) ||
        (p.slideTimer ?? 0) > 0;

      const movedDist = Math.hypot(p.x - pm.lastX, p.y - pm.lastY);
      pm.trailCd -= dt;
      if ((isFastAction || movedDist > 6.5) && pm.trailCd <= 0 && p.alive !== false && !p.falling) {
        pm.trail.push({
          x: p.x,
          y: p.y,
          alpha: isFastAction ? 0.52 : 0.24,
          color: p.colorHex ?? '#00C2FF',
          r: isFastAction ? 17 : 13,
        });
        if (pm.trail.length > 8) pm.trail.shift();
        pm.trailCd = isFastAction ? 0.022 : 0.045;
      }
      for (let i = pm.trail.length - 1; i >= 0; i--) {
        pm.trail[i].alpha -= dt * 2.6;
        if (pm.trail[i].alpha <= 0.02) pm.trail.splice(i, 1);
      }
      pm.lastX = p.x;
      pm.lastY = p.y;
    }
  }

  // Step banners
  st.banners.forEach((b) => {
    b.progress = Math.min(1, b.progress + dt * 4.2);
  });

  // Step dice bounce settle
  if (st.diceSettleProgress < 1) {
    st.diceSettleProgress = Math.min(1, st.diceSettleProgress + dt * 3.0);
  }

  // Step ambient motes
  for (const m of st.motes) {
    m.x = (m.x + m.vx * dt + 1200) % 1200;
    m.y = (m.y + m.vy * dt + 720) % 720;
  }

  // Ambient genre particles (snowflakes in FreezeTag, embers in FusePass)
  st.ambientEmitAccum += dt;
  if (st.ambientEmitAccum >= 0.12 && st.particles.length < 180) {
    st.ambientEmitAccum = 0;
    if (snap.gameId === 'freeze-tag') {
      st.particles.push({
        kind: 'snowflake',
        x: Math.random() * 1200,
        y: -8,
        vx: (Math.random() - 0.5) * 26,
        vy: 38 + Math.random() * 28,
        size: 2.2 + Math.random() * 2.2,
        color: '#E0F7FF',
        life: 3.4,
        maxLife: 3.4,
        rot: Math.random() * Math.PI,
        vrot: 1.4,
        gravity: 0,
      });
    } else if (snap.gameId === 'fuse-pass' && snap.bombHolderId) {
      const holder = snap.players.find((pl) => pl.id === snap.bombHolderId);
      if (holder) {
        spawnBurst(st, holder.x, holder.y - 26, '#FFB800', 2, {
          kind: 'ember',
          speedMin: 35,
          speedMax: 95,
          sizeMin: 1.8,
          sizeMax: 3.6,
          lifeMin: 0.18,
          lifeMax: 0.35,
          gravity: -70,
        });
      }
    }
  }

  // Step particles
  for (let i = st.particles.length - 1; i >= 0; i--) {
    const p = st.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      st.particles.splice(i, 1);
      continue;
    }
    p.vy += p.gravity * dt;
    p.vx *= Math.pow(0.2, dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vrot * dt;
  }

  // Step shockwave rings
  for (let i = st.rings.length - 1; i >= 0; i--) {
    const r = st.rings[i];
    r.r += (r.maxR - r.r) * (1 - Math.exp(-10 * dt));
    r.alpha -= dt * 2.3;
    if (r.alpha <= 0.02) st.rings.splice(i, 1);
  }

  // Step camera recoil & hit-stop
  st.kickX *= Math.pow(0.015, dt);
  st.kickY *= Math.pow(0.015, dt);
  if (Math.abs(st.kickX) < 0.1) st.kickX = 0;
  if (Math.abs(st.kickY) < 0.1) st.kickY = 0;
  st.hitStopTimer = Math.max(0, st.hitStopTimer - dt);
  st.flashAlpha = Math.max(0, st.flashAlpha - dt * 1.4);

  return snap;
}

export function drawArcadeTrails(ctx: CanvasRenderingContext2D, st: ArcadeMotionState): void {
  if (st.activeGameId && CARD_GAME_IDS.has(st.activeGameId)) return;
  ctx.save();
  for (const pm of st.podMotion.values()) {
    for (const pt of pm.trail) {
      ctx.globalAlpha = pt.alpha * 0.48;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y - 3, pt.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawArcadeFrontFX(ctx: CanvasRenderingContext2D, st: ArcadeMotionState): void {
  if (st.activeGameId && CARD_GAME_IDS.has(st.activeGameId)) return;

  // Subtle ambient arena dust motes (very low opacity so arenas stay crisp)
  ctx.save();
  for (const m of st.motes) {
    const twinkle = 0.08 + 0.07 * Math.sin(st.nowSec * 2.1 + m.phase);
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Afterimages
  drawArcadeTrails(ctx, st);

  // Expanding shockwave rings
  if (st.rings.length > 0) {
    ctx.save();
    for (const r of st.rings) {
      ctx.globalAlpha = clamp01(r.alpha);
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.lineWidth;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Particle bursts
  if (st.particles.length > 0) {
    ctx.save();
    for (const p of st.particles) {
      const a = clamp01(p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size, -p.size * 0.55, p.size * 2, p.size * 1.1);
        ctx.restore();
      } else if (p.kind === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(0, -p.size * 1.3);
        ctx.lineTo(p.size * 0.9, 0);
        ctx.lineTo(0, p.size * 1.3);
        ctx.lineTo(-p.size * 0.9, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'snowflake') {
        ctx.globalAlpha = a * 0.48;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.45 + a * 0.55), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Edge pulse vignette on goals/KOs
  if (st.flashAlpha > 0.01) {
    ctx.save();
    const grad = ctx.createRadialGradient(600, 360, 260, 600, 360, 740);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, st.flashColor);
    ctx.globalAlpha = st.flashAlpha;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 720);
    ctx.restore();
  }
}
