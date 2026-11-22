import { GameId, GameSnapshot } from '../shared/types';

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
interface XYPoint {
  x: number;
  y: number;
}

function interpPointArray<T extends XYPoint>(
  prevArr: T[] | undefined,
  currArr: T[] | undefined,
  alpha: number,
  extraAngles?: ('angle' | 'hullAngle' | 'turretAngle' | 'aimAngle' | 'rot')[]
): T[] | undefined {
  if (!currArr || !prevArr || currArr.length === 0 || prevArr.length === 0) return currArr;

  const prevById = new Map<string, T>();
  const hasId = typeof (currArr[0] as unknown as { id?: unknown }).id === 'string';
  if (hasId) {
    for (const item of prevArr) {
      const id = (item as unknown as { id?: string }).id;
      if (id) prevById.set(id, item);
    }
  }

  return currArr.map((c, idx) => {
    const id = hasId ? (c as unknown as { id?: string }).id : undefined;
    const p = id ? prevById.get(id) : prevArr[idx];
    if (!p) return c;
    const dist = Math.hypot(c.x - p.x, c.y - p.y);
    // Teleport / respawn guard
    if (dist > 135) return c;

    const clone: Record<string, unknown> = { ...(c as unknown as Record<string, unknown>) };
    clone.x = lerp(p.x, c.x, alpha);
    clone.y = lerp(p.y, c.y, alpha);

    if (extraAngles) {
      const pRec = p as unknown as Record<string, unknown>;
      const cRec = c as unknown as Record<string, unknown>;
      for (const k of extraAngles) {
        if (typeof pRec[k] === 'number' && typeof cRec[k] === 'number') {
          clone[k] = lerpAngle(pRec[k] as number, cRec[k] as number, alpha);
        }
      }
    }
    return clone as unknown as T;
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

  if (Array.isArray(cRec.players) && Array.isArray(pRec.players)) {
    const firstP = cRec.players[0] as Record<string, unknown> | undefined;
    if (firstP && typeof firstP.x === 'number' && typeof firstP.y === 'number') {
      out.players = interpPointArray(
        pRec.players as XYPoint[],
        cRec.players as XYPoint[],
        alpha,
        ['angle', 'hullAngle', 'turretAngle', 'aimAngle']
      );
    }
  }

  // Common moving entity arrays
  const entityKeys: { key: string; angles?: ('angle' | 'rot')[] }[] = [
    { key: 'bullets' },
    { key: 'shells' },
    { key: 'orbs' },
    { key: 'bolts' },
    { key: 'meteors', angles: ['angle'] },
    { key: 'drones', angles: ['angle'] },
    { key: 'crabs', angles: ['angle'] },
    { key: 'items', angles: ['rot'] },
    { key: 'flyingPlates' },
    { key: 'balls' },
    { key: 'bonusBalls' },
    { key: 'extraPucks' },
    { key: 'waveProjectiles', angles: ['angle'] },
  ];

  for (const ek of entityKeys) {
    if (Array.isArray(cRec[ek.key]) && Array.isArray(pRec[ek.key])) {
      out[ek.key] = interpPointArray(
        pRec[ek.key] as XYPoint[],
        cRec[ek.key] as XYPoint[],
        alpha,
        ek.angles
      );
    }
  }

  // Single ball / puck
  if (curr.gameId === 'turbo-striker' && prev.gameId === 'turbo-striker') {
    const d = Math.hypot(curr.ball.x - prev.ball.x, curr.ball.y - prev.ball.y);
    if (d < 135) {
      out.ball = {
        ...curr.ball,
        x: lerp(prev.ball.x, curr.ball.x, alpha),
        y: lerp(prev.ball.y, curr.ball.y, alpha),
      };
    }
  }

  if (curr.gameId === 'hyper-pong' && prev.gameId === 'hyper-pong') {
    const d = Math.hypot(curr.puck.x - prev.puck.x, curr.puck.y - prev.puck.y);
    if (d < 135) {
      out.puck = {
        ...curr.puck,
        x: lerp(prev.puck.x, curr.puck.x, alpha),
        y: lerp(prev.puck.y, curr.puck.y, alpha),
      };
    }
  }

  // Side-scroller smoothness in GravityFlip
  if (curr.gameId === 'gravity-flip' && prev.gameId === 'gravity-flip') {
    out.scrollX = lerp(prev.scrollX, curr.scrollX, alpha);
    out.obstacles = interpPointArray(prev.obstacles, curr.obstacles, alpha);
    out.coins = interpPointArray(prev.coins, curr.coins, alpha);
    out.gates = interpPointArray(prev.gates, curr.gates, alpha);
    out.pickups = interpPointArray(prev.pickups, curr.pickups, alpha);
  }

  return out as unknown as GameSnapshot;
}

// ============================================================
// FRAME LIFECYCLE & CANVAS LAYER DRAWING
// ============================================================
export function prepareArcadeFrame(
  rawSnap: GameSnapshot,
  st: ArcadeMotionState
): GameSnapshot {
  const nowMs = performance.now();
  const rawDt = st.lastFrameMs > 0 ? (nowMs - st.lastFrameMs) / 1000 : 1 / 60;
  st.dt = Math.min(0.05, Math.max(0.001, rawDt));
  st.lastFrameMs = nowMs;
  st.nowSec = nowMs / 1000;

  if (rawSnap.gameId === 'color-clash' || rawSnap.gameId === 'liars-deck') {
    st.activeGameId = rawSnap.gameId;
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

  const snap =
    st.prevSnap && st.currSnap
      ? buildInterpolatedSnapshot(st.prevSnap, st.currSnap, interpAlpha)
      : rawSnap;

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
  if (st.activeGameId === 'color-clash' || st.activeGameId === 'liars-deck') return;
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
  if (st.activeGameId === 'color-clash' || st.activeGameId === 'liars-deck') return;

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
