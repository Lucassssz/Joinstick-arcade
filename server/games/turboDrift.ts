import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type DriftCarState,
  type RankingEntry,
  type SoundEvent,
  type TurboDriftSnapshot,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface InternalCar extends DriftCarState {
  boostPadTimer: number;
  lastPadIdx: number;
  bestLapMs: number | null;
  lapStartMs: number;
  lastSafeTrackIdx: number;
  fallTimer: number;
  coins: number;
  slipTimer: number;
}

interface InternalTrackCoin {
  id: string;
  trackIdx: number;
  offset: number;
  x: number;
  y: number;
  kind: 'coin' | 'mystery';
  respawn: number;
}

interface TurboInternalState {
  elapsedMs: number;
  totalLaps: number;
  finishCountdown: number | null;
  trackPoints: { x: number; y: number }[];
  trackHalfWidth: number;
  boostPads: { x: number; y: number; angle: number }[];
  coins: InternalTrackCoin[];
  oils: { x: number; y: number; r: number }[];
  checkpoints: { x: number; y: number; index: number }[];
  players: InternalCar[];
  finished: boolean;
}

const CONTROL_POINTS = [
  { x: 340, y: 580 },
  { x: 660, y: 585 },
  { x: 960, y: 570 },
  { x: 1055, y: 430 },
  { x: 970, y: 205 },
  { x: 760, y: 155 },
  { x: 610, y: 310 },
  { x: 430, y: 155 },
  { x: 185, y: 200 },
  { x: 150, y: 435 },
];

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function buildTrackSpline(samplesPerSeg = 12): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const n = CONTROL_POINTS.length;
  for (let i = 0; i < n; i++) {
    const p0 = CONTROL_POINTS[(i - 1 + n) % n];
    const p1 = CONTROL_POINTS[i];
    const p2 = CONTROL_POINTS[(i + 1) % n];
    const p3 = CONTROL_POINTS[(i + 2) % n];
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      pts.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
      });
    }
  }
  return pts;
}

const TRACK_POINTS = buildTrackSpline(12);
const TRACK_HALF_WIDTH = 70;
const CAR_RADIUS = 16;

function buildBoostPads(): { x: number; y: number; angle: number }[] {
  const indices = [10, 44, 88];
  return indices.map((idx) => {
    const p = TRACK_POINTS[idx % TRACK_POINTS.length];
    const next = TRACK_POINTS[(idx + 1) % TRACK_POINTS.length];
    return {
      x: p.x,
      y: p.y,
      angle: Math.atan2(next.y - p.y, next.x - p.x),
    };
  });
}

function buildTrackCoins(): InternalTrackCoin[] {
  const specs: { idx: number; offset: number; kind: 'coin' | 'mystery' }[] = [
    { idx: 22, offset: -22, kind: 'coin' },
    { idx: 34, offset: 0, kind: 'mystery' },
    { idx: 56, offset: 24, kind: 'coin' },
    { idx: 70, offset: 0, kind: 'mystery' },
    { idx: 82, offset: -22, kind: 'coin' },
    { idx: 102, offset: 22, kind: 'coin' },
  ];
  return specs.map((sp, i) => {
    const p = TRACK_POINTS[sp.idx % TRACK_POINTS.length];
    const next = TRACK_POINTS[(sp.idx + 1) % TRACK_POINTS.length];
    const ang = Math.atan2(next.y - p.y, next.x - p.x);
    return {
      id: `tc_${i}`,
      trackIdx: sp.idx,
      offset: sp.offset,
      x: p.x - Math.sin(ang) * sp.offset,
      y: p.y + Math.cos(ang) * sp.offset,
      kind: sp.kind,
      respawn: 0,
    };
  });
}

function buildOilSlicks(): { x: number; y: number; r: number }[] {
  const specs = [
    { idx: 63, offset: -26, r: 22 },
    { idx: 96, offset: 26, r: 22 },
  ];
  return specs.map((sp) => {
    const p = TRACK_POINTS[sp.idx % TRACK_POINTS.length];
    const next = TRACK_POINTS[(sp.idx + 1) % TRACK_POINTS.length];
    const ang = Math.atan2(next.y - p.y, next.x - p.x);
    return {
      x: p.x - Math.sin(ang) * sp.offset,
      y: p.y + Math.cos(ang) * sp.offset,
      r: sp.r,
    };
  });
}

const BOOST_PADS = buildBoostPads();
const OIL_SLICKS = buildOilSlicks();

function buildCheckpoints(count = 8): { x: number; y: number; index: number }[] {
  const step = Math.floor(TRACK_POINTS.length / count);
  return Array.from({ length: count }, (_, i) => {
    const pt = TRACK_POINTS[(i * step) % TRACK_POINTS.length];
    return { x: pt.x, y: pt.y, index: i };
  });
}

const CHECKPOINTS = buildCheckpoints(8);

function nearestTrackIndex(x: number, y: number): { index: number; dist: number } {
  let bestIdx = 0;
  let bestDistSq = Infinity;
  for (let i = 0; i < TRACK_POINTS.length; i++) {
    const dx = x - TRACK_POINTS[i].x;
    const dy = y - TRACK_POINTS[i].y;
    const dSq = dx * dx + dy * dy;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
    }
  }
  return { index: bestIdx, dist: Math.sqrt(bestDistSq) };
}

function formatMs(ms: number): string {
  const sec = (ms / 1000).toFixed(1);
  return `${sec}s`;
}

function toSnapshot(state: TurboInternalState): TurboDriftSnapshot {
  return {
    gameId: 'turbo-drift',
    elapsedMs: state.elapsedMs,
    totalLaps: state.totalLaps,
    finishCountdown: state.finishCountdown,
    trackPoints: state.trackPoints,
    trackHalfWidth: state.trackHalfWidth,
    boostPads: state.boostPads,
    coins: state.coins.filter((c) => c.respawn <= 0).map((c) => ({ id: c.id, x: c.x, y: c.y, kind: c.kind })),
    oils: state.oils,
    players: state.players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.colorHex,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      angle: p.angle,
      speed: p.speed,
      drifting: p.drifting,
      boosting: p.boosting,
      drafting: p.drafting,
      slipping: p.slipTimer > 0,
      nitro: p.nitro,
      lap: p.lap,
      totalLaps: p.totalLaps,
      checkpoint: p.checkpoint,
      progress: p.progress,
      finished: p.finished,
      finishTimeMs: p.finishTimeMs,
      position: p.position,
      falling: p.falling,
      fallProgress: p.fallProgress,
      respawnBlink: p.respawnBlink,
      coins: p.coins,
      cooldownA: Math.max(0, 1 - p.nitro),
      cooldownB: 0,
    })),
  };
}

function buildRankings(
  state: TurboInternalState,
  inputPlayers: ServerPlayerInputState[]
): RankingEntry[] {
  const colorById = new Map(inputPlayers.map((p) => [p.id, p.color]));
  const sorted = [...state.players].sort((a, b) => a.position - b.position);

  return sorted.map((p, idx) => ({
    playerId: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    color: colorById.get(p.id) ?? {
      id: 'default',
      name: 'Racer',
      hex: p.colorHex,
      dark: p.colorHex,
      textOnColor: '#FFFFFF',
    },
    rank: idx + 1,
    score: Math.max(100, (sorted.length - idx) * 100 + p.lap * 25 + p.coins * 15),
    highlight:
      p.finishTimeMs !== null
        ? `Finished ${formatMs(p.finishTimeMs)}`
        : `Lap ${Math.min(p.lap, p.totalLaps)}/${p.totalLaps}`,
  }));
}

export const turboDriftModule: ServerGameModule<TurboInternalState> = {
  id: 'turbo-drift',

  createState(players: ServerPlayerInputState[], settingValue: number): TurboInternalState {
    const totalLaps = Math.max(1, Math.min(7, settingValue || 3));
    const startPt = TRACK_POINTS[0];
    const nextPt = TRACK_POINTS[1];
    const startAngle = Math.atan2(nextPt.y - startPt.y, nextPt.x - startPt.x);
    const perpX = -Math.sin(startAngle);
    const perpY = Math.cos(startAngle);

    const cars: InternalCar[] = players.map((p, idx) => {
      const row = Math.floor(idx / 2);
      const col = idx % 2 === 0 ? -1 : 1;
      const backOffset = row * 38 + 20;
      const sideOffset = col * 24;
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        x: startPt.x - Math.cos(startAngle) * backOffset + perpX * sideOffset,
        y: startPt.y - Math.sin(startAngle) * backOffset + perpY * sideOffset,
        vx: 0,
        vy: 0,
        angle: startAngle,
        speed: 0,
        drifting: false,
        boosting: false,
        drafting: false,
        slipping: false,
        nitro: 0.45,
        lap: 1,
        totalLaps,
        checkpoint: 0,
        progress: 0,
        finished: false,
        finishTimeMs: null,
        position: idx + 1,
        falling: false,
        fallProgress: 0,
        respawnBlink: 0,
        coins: 0,
        cooldownA: 0.55,
        cooldownB: 0,
        boostPadTimer: 0,
        lastPadIdx: -1,
        bestLapMs: null,
        lapStartMs: 0,
        lastSafeTrackIdx: 0,
        fallTimer: 0,
        slipTimer: 0,
      };
    });

    return {
      elapsedMs: 0,
      totalLaps,
      finishCountdown: null,
      trackPoints: TRACK_POINTS,
      trackHalfWidth: TRACK_HALF_WIDTH,
      boostPads: BOOST_PADS,
      coins: buildTrackCoins(),
      oils: OIL_SLICKS,
      checkpoints: CHECKPOINTS,
      players: cars,
      finished: false,
    };
  },

  addPlayer(state: TurboInternalState, p: ServerPlayerInputState): void {
    if (state.players.some((existing) => existing.id === p.id)) return;
    const startPt = TRACK_POINTS[0];
    const nextPt = TRACK_POINTS[1];
    const startAngle = Math.atan2(nextPt.y - startPt.y, nextPt.x - startPt.x);
    state.players.push({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: startPt.x,
      y: startPt.y,
      vx: 0,
      vy: 0,
      angle: startAngle,
      speed: 0,
      drifting: false,
      boosting: false,
      drafting: false,
      slipping: false,
      nitro: 0.45,
      lap: 1,
      totalLaps: state.totalLaps,
      checkpoint: 0,
      progress: 0,
      finished: false,
      finishTimeMs: null,
      position: state.players.length + 1,
      falling: false,
      fallProgress: 0,
      respawnBlink: 0,
      coins: 0,
      cooldownA: 0.55,
      cooldownB: 0,
      boostPadTimer: 0,
      lastPadIdx: -1,
      bestLapMs: null,
      lapStartMs: state.elapsedMs,
      lastSafeTrackIdx: 0,
      fallTimer: 0,
      slipTimer: 0,
    });
  },

  step(state: TurboInternalState, inputPlayers: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(inputPlayers.map((p) => [p.id, p]));

    state.elapsedMs += dt * 1000;

    for (const c of state.coins) {
      if (c.respawn > 0) c.respawn = Math.max(0, c.respawn - dt);
    }

    if (state.finishCountdown !== null) {
      state.finishCountdown -= dt;
      if (state.finishCountdown <= 0) {
        state.finished = true;
        sounds.push({ type: 'win' });
      }
    }

    const FALL_DURATION = 0.9;
    const OFF_TRACK_LIMIT = state.trackHalfWidth + 16;

    for (const car of state.players) {
      const src = inputMap.get(car.id);
      car.boostPadTimer = Math.max(0, car.boostPadTimer - dt);
      car.respawnBlink = Math.max(0, car.respawnBlink - dt);
      car.slipTimer = Math.max(0, car.slipTimer - dt);
      car.slipping = car.slipTimer > 0;
      car.drafting = false;

      if (car.falling) {
        car.fallTimer -= dt;
        car.fallProgress = Math.min(1, 1 - Math.max(0, car.fallTimer) / FALL_DURATION);
        car.vx *= Math.pow(0.25, dt);
        car.vy *= Math.pow(0.25, dt);
        car.x += car.vx * dt;
        car.y += car.vy * dt;
        car.drifting = false;
        car.boosting = false;

        if (car.fallTimer <= 0) {
          const idx = car.lastSafeTrackIdx % state.trackPoints.length;
          const pt = state.trackPoints[idx];
          const nextPt = state.trackPoints[(idx + 1) % state.trackPoints.length];
          car.x = pt.x;
          car.y = pt.y;
          car.vx = 0;
          car.vy = 0;
          car.speed = 0;
          car.angle = Math.atan2(nextPt.y - pt.y, nextPt.x - pt.x);
          car.falling = false;
          car.fallProgress = 0;
          car.respawnBlink = 1.4;
          sounds.push({ type: 'ready', playerId: car.id });
          haptics.push({ playerId: car.id, pattern: 35, reason: 'respawn' });
        }
        continue;
      }

      const nearest = nearestTrackIndex(car.x, car.y);
      const onRoad = nearest.dist <= state.trackHalfWidth + 10;
      if (onRoad) {
        car.lastSafeTrackIdx = nearest.index;
      }

      if (car.finished) {
        car.vx *= Math.pow(0.25, dt);
        car.vy *= Math.pow(0.25, dt);
        car.x += car.vx * dt;
        car.y += car.vy * dt;
        car.speed = Math.hypot(car.vx, car.vy);
        car.drifting = false;
        car.boosting = false;
        continue;
      }

      // Check Slipstream Drafting behind a rival car ahead
      const myFwdX = Math.cos(car.angle);
      const myFwdY = Math.sin(car.angle);
      for (const other of state.players) {
        if (other.id === car.id || other.falling) continue;
        const rx = other.x - car.x;
        const ry = other.y - car.y;
        const d = Math.hypot(rx, ry);
        if (d > 34 && d < 155) {
          const dot = (rx / d) * myFwdX + (ry / d) * myFwdY;
          if (dot > 0.86) {
            car.drafting = true;
            break;
          }
        }
      }

      let throttle = 0;
      let drifting = false;
      let usingNitro = false;

      if (src) {
        const { dx, dy, a, b } = src.input;
        const mag = Math.hypot(dx, dy);
        drifting = b && mag > 0.15;

        if (mag > 0.08 && car.slipTimer <= 0) {
          const desiredAngle = Math.atan2(dy, dx);
          let diff = desiredAngle - car.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          const turnRate = drifting ? 9.5 : 7.2;
          const maxStep = turnRate * dt;
          car.angle += Math.max(-maxStep, Math.min(maxStep, diff * 9.5 * dt));
          throttle = Math.min(1, mag * 1.25);
        } else if (car.slipTimer > 0) {
          car.angle += 7.5 * dt;
          throttle = 0.55;
        }

        if (a && car.nitro > 0.08) {
          usingNitro = true;
          car.nitro = Math.max(0, car.nitro - 0.52 * dt);
          if (!src.prevA) {
            sounds.push({ type: 'boost', playerId: car.id });
            haptics.push({ playerId: car.id, pattern: 38, reason: 'nitro' });
          }
        }
      }

      if (!usingNitro) {
        const chargeRate = (drifting && onRoad && car.speed > 130 ? 0.34 : 0.12) + (car.drafting ? 0.18 : 0);
        car.nitro = Math.min(1, car.nitro + chargeRate * dt);
      }

      const isBoosted = usingNitro || car.boostPadTimer > 0;
      car.drifting = drifting && car.speed > 110;
      car.boosting = isBoosted;

      const coinSpeedMult = 1 + Math.min(0.12, car.coins * 0.015);
      const draftMult = car.drafting ? 1.15 : 1.0;
      const maxSpeed = 335 * (isBoosted ? 1.42 : 1.0) * coinSpeedMult * draftMult;
      const accel = 650 * (isBoosted ? 1.55 : 1.0) * draftMult;

      const fwdX = Math.cos(car.angle);
      const fwdY = Math.sin(car.angle);

      car.vx += fwdX * throttle * accel * dt;
      car.vy += fwdY * throttle * accel * dt;

      const fwdVel = car.vx * fwdX + car.vy * fwdY;
      const latX = -fwdY;
      const latY = fwdX;
      const latVel = car.vx * latX + car.vy * latY;

      const lateralGrip = car.slipTimer > 0 ? Math.pow(0.45, dt) : drifting ? Math.pow(0.18, dt) : Math.pow(0.015, dt);
      const forwardDrag = throttle > 0.1 ? Math.pow(0.45, dt) : Math.pow(0.14, dt);

      const newFwd = Math.max(-90, Math.min(maxSpeed, fwdVel * forwardDrag));
      const newLat = latVel * lateralGrip;

      car.vx = fwdX * newFwd + latX * newLat;
      car.vy = fwdY * newFwd + latY * newLat;

      car.x += car.vx * dt;
      car.y += car.vy * dt;
      car.speed = Math.hypot(car.vx, car.vy);

      const afterNearest = nearestTrackIndex(car.x, car.y);
      if (afterNearest.dist > OFF_TRACK_LIMIT) {
        car.falling = true;
        car.fallTimer = FALL_DURATION;
        car.fallProgress = 0;
        car.drifting = false;
        car.boosting = false;
        car.boostPadTimer = 0;
        car.lastSafeTrackIdx = afterNearest.index;
        sounds.push({ type: 'ko', playerId: car.id });
        haptics.push({ playerId: car.id, pattern: [65, 35, 90], reason: 'falloff' });
        continue;
      }

      // Oil slick check (unless currently boosting!)
      if (!isBoosted && car.slipTimer <= 0 && car.respawnBlink <= 0) {
        for (const oil of state.oils) {
          if (Math.hypot(car.x - oil.x, car.y - oil.y) < oil.r + 8) {
            car.slipTimer = 0.72;
            sounds.push({ type: 'bump', intensity: 0.5 });
            haptics.push({ playerId: car.id, pattern: 50, reason: 'slip' });
            break;
          }
        }
      }

      // Coin & Mystery Item Box collection
      for (const coin of state.coins) {
        if (coin.respawn > 0) continue;
        if (Math.hypot(car.x - coin.x, car.y - coin.y) < CAR_RADIUS + 16) {
          coin.respawn = 8.0;
          sounds.push({ type: 'pickup', playerId: car.id });
          haptics.push({ playerId: car.id, pattern: [18, 12, 24], reason: 'coin' });
          if (coin.kind === 'coin') {
            car.coins += 1;
            car.nitro = Math.min(1, car.nitro + 0.3);
          } else {
            // Mystery Box: Super Nitro + Surge!
            car.nitro = 1.0;
            car.boostPadTimer = Math.max(car.boostPadTimer, 1.35);
            car.vx += Math.cos(car.angle) * 180;
            car.vy += Math.sin(car.angle) * 180;
          }
        }
      }

      // Boost pad trigger
      let onPad = -1;
      for (let i = 0; i < state.boostPads.length; i++) {
        const bp = state.boostPads[i];
        if (Math.hypot(car.x - bp.x, car.y - bp.y) < 38) {
          onPad = i;
          if (car.lastPadIdx !== i) {
            car.boostPadTimer = 0.75;
            car.nitro = Math.min(1, car.nitro + 0.25);
            car.vx += Math.cos(bp.angle) * 170;
            car.vy += Math.sin(bp.angle) * 170;
            sounds.push({ type: 'boost', playerId: car.id });
            haptics.push({ playerId: car.id, pattern: 42, reason: 'boostpad' });
          }
          break;
        }
      }
      car.lastPadIdx = onPad;

      // Checkpoint & Lap progression
      const nextCpIdx = (car.checkpoint + 1) % state.checkpoints.length;
      const nextCp = state.checkpoints[nextCpIdx];
      if (Math.hypot(car.x - nextCp.x, car.y - nextCp.y) < state.trackHalfWidth + 32) {
        car.checkpoint = nextCpIdx;
        if (nextCpIdx === 0) {
          const lapDuration = state.elapsedMs - car.lapStartMs;
          if (car.bestLapMs === null || lapDuration < car.bestLapMs) {
            car.bestLapMs = lapDuration;
          }
          car.lapStartMs = state.elapsedMs;

          if (car.lap >= state.totalLaps) {
            car.finished = true;
            car.finishTimeMs = state.elapsedMs;
            sounds.push({ type: 'win', playerId: car.id });
            haptics.push({ playerId: car.id, pattern: [45, 30, 85], reason: 'finish' });
            if (state.finishCountdown === null && state.players.length > 1) {
              state.finishCountdown = 12;
            }
          } else {
            car.lap += 1;
            sounds.push({ type: 'lap', playerId: car.id });
            haptics.push({ playerId: car.id, pattern: [35, 30, 45], reason: 'lap' });
          }
        }
      }

      const trackFrac = afterNearest.index / state.trackPoints.length;
      const cpFrac = car.checkpoint / state.checkpoints.length;
      const distToNext = Math.hypot(car.x - nextCp.x, car.y - nextCp.y);
      car.progress =
        (car.lap - 1) * 1000 +
        car.checkpoint * 100 +
        Math.max(0, 95 - distToNext * 0.25) +
        (Math.abs(trackFrac - cpFrac) < 0.25 ? trackFrac * 2 : 0);
    }

    for (let i = 0; i < state.players.length; i++) {
      const a = state.players[i];
      if (a.falling || a.respawnBlink > 0.6) continue;
      for (let j = i + 1; j < state.players.length; j++) {
        const b = state.players[j];
        if (b.falling || b.respawnBlink > 0.6) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = CAR_RADIUS * 2;
        if (dist > 0.001 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            a.vx += nx * vn * 0.55;
            a.vy += ny * vn * 0.55;
            b.vx -= nx * vn * 0.55;
            b.vy -= ny * vn * 0.55;
            if (Math.abs(vn) > 70) {
              sounds.push({ type: 'bump', intensity: 0.45 });
              haptics.push({ playerId: a.id, pattern: 35, reason: 'bump' });
              haptics.push({ playerId: b.id, pattern: 35, reason: 'bump' });
            }
          }
        }
      }
    }

    const ordered = [...state.players].sort((a, b) => {
      if (a.finished && b.finished) return (a.finishTimeMs ?? 0) - (b.finishTimeMs ?? 0);
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    ordered.forEach((c, idx) => {
      c.position = idx + 1;
    });

    if (state.players.length > 0 && state.players.every((p) => p.finished)) {
      state.finished = true;
    }

    const ordinal = (n: number) =>
      n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: Math.round(p.progress + p.coins * 15),
        alive: !p.falling,
        statText: p.falling
          ? 'OFF TRACK · Respawning'
          : p.finished
          ? `${ordinal(p.position)} · FINISHED`
          : `${ordinal(p.position)} · Lap ${p.lap}/${p.totalLaps}`,
        cooldownA: Math.max(0, 1 - p.nitro),
        cooldownB: 0,
      };
    }

    return {
      snapshot: toSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? buildRankings(state, inputPlayers) : undefined,
    };
  },

  getSnapshot(state: TurboInternalState): TurboDriftSnapshot {
    return toSnapshot(state);
  },

  getRankings(state: TurboInternalState, players: ServerPlayerInputState[]): RankingEntry[] {
    return buildRankings(state, players);
  },
};
