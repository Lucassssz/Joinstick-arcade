import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/shared/types.ts';
import type {
  BladeFruitSliceSnapshot,
  ChaptehJuggleSnapshot,
  CorridorFencingSnapshot,
  FiveSecondMicrogamesSnapshot,
  FiveStonesTossSnapshot,
  HalfpipeSkateComboSnapshot,
  PegFeverBounceSnapshot,
  ProDarts301Snapshot,
  WauKiteCutSnapshot,
  XiangqiRiverClashSnapshot,
} from '../../src/shared/packCultHeritageTypes.ts';
import type {
  CompactGameModule,
  CompactResultEntry,
  CompactSoundEvent,
} from './packModuleAdapter.ts';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rankByScore<T extends { id: string; score: number }>(
  items: T[],
  labelFn: (item: T) => string
): CompactResultEntry[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  return sorted.map((it, i) => ({
    playerId: it.id,
    rank: i + 1,
    score: Math.round(it.score),
    statLabel: labelFn(it),
  }));
}

// ============================================================================
// 1. BLADE FRUIT SLICE (Fruit Ninja Style — Pad 3 Glide)
// ============================================================================
interface FruitEntity {
  id: string;
  kind: 'melon' | 'orange' | 'kiwi' | 'bomb' | 'gold';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

interface BladeFruitState {
  timeLeft: number;
  totalTime: number;
  spawnTimer: number;
  fruits: FruitEntity[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    trailX: number;
    trailY: number;
    wideTimer: number;
    slices: number;
    combo: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function spawnFruit(frenzy: boolean): FruitEntity {
  const r = Math.random();
  const kind: FruitEntity['kind'] =
    r < (frenzy ? 0.24 : 0.12) ? 'gold' : r < 0.3 ? 'bomb' : r < 0.54 ? 'melon' : r < 0.78 ? 'orange' : 'kiwi';
  const x = 180 + Math.random() * (ARENA_WIDTH - 360);
  const vx = (ARENA_WIDTH / 2 - x) * 0.45 + (Math.random() - 0.5) * 180;
  const vy = -(540 + Math.random() * 160);
  return {
    id: `fr_${Math.random().toString(36).slice(2, 7)}`,
    kind,
    x,
    y: ARENA_HEIGHT - 40,
    vx,
    vy,
    r: kind === 'melon' ? 30 : kind === 'gold' ? 28 : 24,
  };
}

export const bladeFruitSliceModule: CompactGameModule<BladeFruitState, BladeFruitSliceSnapshot> = {
  id: 'blade-fruit-slice',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      spawnTimer: 0.4,
      fruits: [spawnFruit(false), spawnFruit(false), spawnFruit(false)],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 240 + (i % 4) * 220,
        y: 320 + Math.floor(i / 4) * 100,
        trailX: 240 + (i % 4) * 220,
        trailY: 320 + Math.floor(i / 4) * 100,
        wideTimer: 0,
        slices: 0,
        combo: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'SWIPE THROUGH FLYING FRUIT · DODGE SPIKED BOMBS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = frenzy ? 0.55 : 0.85;
      if (state.fruits.length < 11) state.fruits.push(spawnFruit(frenzy));
    }

    for (const f of state.fruits) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vy += 520 * dt;
    }
    state.fruits = state.fruits.filter((f) => f.y < ARENA_HEIGHT + 60);

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.wideTimer = Math.max(0, p.wideTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.trailX = p.x;
      p.trailY = p.y;
      const spd = frenzy ? 620 : 500;
      p.x = clamp(p.x + mx * spd * dt, 90, ARENA_WIDTH - 90);
      p.y = clamp(p.y + my * spd * dt, 100, ARENA_HEIGHT - 90);

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.wideTimer = 0.55;
        p.cdA = 1.6;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.x = clamp(p.x + (mx || 1) * 140, 90, ARENA_WIDTH - 90);
        p.y = clamp(p.y + my * 140, 100, ARENA_HEIGHT - 90);
        p.cdB = 1.2;
        sounds.push({ type: 'dash', playerId: p.id });
      }

      const bladeDist = Math.hypot(p.x - p.trailX, p.y - p.trailY);
      const bladeRadius = p.wideTimer > 0 ? 78 : bladeDist > 2 || aDown ? 46 : 32;

      for (let i = state.fruits.length - 1; i >= 0; i--) {
        const f = state.fruits[i];
        if (Math.hypot(f.x - p.x, f.y - p.y) <= f.r + bladeRadius) {
          state.fruits.splice(i, 1);
          if (f.kind === 'bomb') {
            p.combo = 0;
            p.score = Math.max(0, p.score - 35);
            state.banner = `${p.name} HIT A BOMB!`;
            sounds.push({ type: 'elim', playerId: p.id });
          } else {
            p.slices += 1;
            p.combo = Math.min(5, p.combo + 1);
            const base = f.kind === 'gold' ? 120 : 40 + p.combo * 10;
            const gained = base * mult;
            p.score += gained;
            if (f.kind === 'gold') state.banner = `${p.name} GOLDEN PINEAPPLE SLICE! +${gained}`;
            sounds.push({ type: 'score', playerId: p.id });
          }
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'blade-fruit-slice',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      fruits: state.fruits.map(({ id, kind, x, y, r }) => ({ id, kind, x, y, r })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        trailX: p.trailX,
        trailY: p.trailY,
        slices: p.slices,
        combo: p.combo,
        score: p.score,
        cooldownA: clamp(p.cdA / 1.6, 0, 1),
        cooldownB: clamp(p.cdB / 1.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.slices} slices · ${p.score} pts`);
  },
};

// ============================================================================
// 2. PEG FEVER BOUNCE (Peggle Style — Pad 3 Glide + Tap A)
// ============================================================================
interface PegBall {
  id: string;
  ownerId: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface PegFeverState {
  timeLeft: number;
  totalTime: number;
  pegs: { id: string; x: number; y: number; kind: 'orange' | 'blue' | 'purple'; hit: boolean }[];
  balls: PegBall[];
  bucketX: number;
  bucketDir: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    aimX: number;
    pegsHit: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function makePegBoard(): PegFeverState['pegs'] {
  const pegs: PegFeverState['pegs'] = [];
  for (let row = 0; row < 4; row++) {
    const cols = 9 - (row % 2);
    for (let col = 0; col < cols; col++) {
      const x = 230 + (row % 2) * 45 + col * 92;
      const y = 215 + row * 72;
      const r = Math.random();
      const kind: 'orange' | 'blue' | 'purple' = r < 0.36 ? 'orange' : r < 0.5 ? 'purple' : 'blue';
      pegs.push({ id: `peg_${row}_${col}`, x, y, kind, hit: false });
    }
  }
  return pegs;
}

export const pegFeverBounceModule: CompactGameModule<PegFeverState, PegFeverBounceSnapshot> = {
  id: 'peg-fever-bounce',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      pegs: makePegBoard(),
      balls: [],
      bucketX: ARENA_WIDTH / 2,
      bucketDir: 1,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: 300 + (i % 4) * 200,
        pegsHit: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'AIM CANNON & FIRE ORBS (A) INTO ORANGE PEGS + SLIDING BUCKET!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.bucketX += state.bucketDir * 240 * dt;
    if (state.bucketX > ARENA_WIDTH - 220) {
      state.bucketX = ARENA_WIDTH - 220;
      state.bucketDir = -1;
    } else if (state.bucketX < 220) {
      state.bucketX = 220;
      state.bucketDir = 1;
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.aimX = clamp(p.aimX + mx * 460 * dt, 180, ARENA_WIDTH - 180);

      if (aDown && !p.prevA && p.cdA <= 0) {
        const dx = (p.aimX - ARENA_WIDTH / 2) * 0.9;
        state.balls.push({
          id: `pb_${Math.random().toString(36).slice(2, 7)}`,
          ownerId: p.id,
          colorHex: p.colorHex,
          x: p.aimX,
          y: 132,
          vx: clamp(-dx * 0.25 + (Math.random() - 0.5) * 80, -240, 240),
          vy: 260,
        });
        p.cdA = frenzy ? 0.45 : 0.75;
        sounds.push({ type: 'shoot', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        for (const b of state.balls) {
          if (b.ownerId === p.id) b.vx += (state.bucketX - b.x) * 0.45;
        }
        p.cdB = 1.4;
        sounds.push({ type: 'bump', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i];
      b.vy += 460 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 145) {
        b.x = 145;
        b.vx = Math.abs(b.vx) * 0.85;
      } else if (b.x > ARENA_WIDTH - 145) {
        b.x = ARENA_WIDTH - 145;
        b.vx = -Math.abs(b.vx) * 0.85;
      }

      for (const peg of state.pegs) {
        if (peg.hit) continue;
        const dist = Math.hypot(b.x - peg.x, b.y - peg.y);
        if (dist < 22) {
          peg.hit = true;
          const nx = (b.x - peg.x) / Math.max(1, dist);
          const ny = (b.y - peg.y) / Math.max(1, dist);
          b.vx = nx * 240 + (Math.random() - 0.5) * 60;
          b.vy = Math.min(-140, ny * 260);
          const owner = state.players.find((pl) => pl.id === b.ownerId);
          if (owner) {
            owner.pegsHit += 1;
            const pts = (peg.kind === 'purple' ? 130 : peg.kind === 'orange' ? 75 : 35) * mult;
            owner.score += pts;
            sounds.push({ type: peg.kind === 'blue' ? 'tick' : 'score', playerId: owner.id });
          }
        }
      }

      if (b.y >= ARENA_HEIGHT - 120) {
        if (Math.abs(b.x - state.bucketX) < 76) {
          const owner = state.players.find((pl) => pl.id === b.ownerId);
          if (owner) {
            const pts = 110 * mult;
            owner.score += pts;
            state.banner = `${owner.name} CATCH BUCKET! +${pts}`;
            sounds.push({ type: 'score', playerId: owner.id });
          }
        }
        state.balls.splice(i, 1);
      }
    }

    if (state.pegs.filter((p) => !p.hit).length <= 6) {
      state.pegs = makePegBoard();
      state.banner = 'FEVER BOARD CLEARED — FRESH PEGS LOADED!';
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'peg-fever-bounce',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      pegs: state.pegs,
      balls: state.balls.map(({ id, ownerId, colorHex, x, y }) => ({ id, ownerId, colorHex, x, y })),
      bucketX: state.bucketX,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: p.aimX,
        x: p.aimX,
        y: 120,
        pegsHit: p.pegsHit,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.75, 0, 1),
        cooldownB: clamp(p.cdB / 1.4, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.pegsHit} pegs · ${p.score} pts`);
  },
};

// ============================================================================
// 3. HALFPIPE SKATE COMBO (Pad 2 Arrows)
// ============================================================================
interface HalfpipeState {
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    uPos: number; // -1..1 across halfpipe
    vx: number;
    airY: number;
    vy: number;
    spinDeg: number;
    trickName: string | null;
    combo: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function halfpipeSurfaceY(u: number): number {
  return 505 - Math.pow(Math.abs(u), 2.1) * 235;
}

export const halfpipeSkateComboModule: CompactGameModule<HalfpipeState, HalfpipeSkateComboSnapshot> = {
  id: 'halfpipe-skate-combo',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        uPos: -0.5 + (i % 4) * 0.3,
        vx: i % 2 === 0 ? 0.65 : -0.65,
        airY: 0,
        vy: 0,
        spinDeg: 0,
        trickName: null,
        combo: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'PUMP THE HALFPIPE · LAUNCH FLIPS (A) & GRABS (B) OFF THE LIP!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.vx += (-p.uPos * 2.4 + mx * (frenzy ? 2.5 : 2.0)) * dt;
      p.vx = clamp(p.vx * 0.992, -1.9, 1.9);
      p.uPos += p.vx * dt;
      if (p.uPos > 1) {
        p.uPos = 1;
        p.vx = -Math.abs(p.vx) * 0.85;
      } else if (p.uPos < -1) {
        p.uPos = -1;
        p.vx = Math.abs(p.vx) * 0.85;
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        if (p.airY <= 4) {
          const nearLip = Math.abs(p.uPos) > 0.55;
          p.vy = nearLip ? 390 : 280;
          p.combo += 1;
          p.trickName = nearLip ? '360 BIG AIR!' : 'KICKFLIP!';
        } else {
          p.combo += 1;
          p.trickName = 'HEELFLIP!';
        }
        p.cdA = 0.42;
        sounds.push({ type: 'dash', playerId: p.id });
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        if (p.airY > 12) {
          p.combo += 1;
          p.trickName = 'INDY GRAB!';
          p.vy += 80;
        } else {
          p.vx += Math.sign(p.vx || 1) * 0.45;
        }
        p.cdB = 0.55;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      if (p.airY > 0 || p.vy > 0) {
        p.airY += p.vy * dt;
        p.vy -= 620 * dt;
        p.spinDeg = (p.spinDeg + 420 * dt) % 360;
        if (p.airY <= 0) {
          p.airY = 0;
          p.vy = 0;
          p.spinDeg = 0;
          if (p.combo > 0) {
            const pts = p.combo * 55 * mult;
            p.score += pts;
            if (p.combo >= 3) state.banner = `${p.name} LANDED ${p.combo}× SKATE COMBO! +${pts}`;
            p.combo = 0;
            sounds.push({ type: 'score', playerId: p.id });
          }
          p.trickName = null;
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'halfpipe-skate-combo',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      players: state.players.map((p) => {
        const x = ARENA_WIDTH / 2 + p.uPos * 420;
        const y = halfpipeSurfaceY(p.uPos) - p.airY;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x,
          y,
          airborne: p.airY > 4,
          spinDeg: p.spinDeg,
          trickName: p.trickName,
          combo: p.combo,
          score: p.score,
          cooldownA: clamp(p.cdA / 0.42, 0, 1),
          cooldownB: clamp(p.cdB / 0.55, 0, 1),
        };
      }),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.score} pts`);
  },
};

// ============================================================================
// 4. FIVE-SECOND MICROGAMES (WarioWare Style — Pad 2 Arrows)
// ============================================================================
const MICRO_SPECS: { kind: FiveSecondMicrogamesSnapshot['microKind']; en: string; zh: string }[] = [
  { kind: 'catch', en: 'TOUCH THE GOLD STAR!', zh: '快冲向发光金星！' },
  { kind: 'dodge', en: 'DODGE THE SAWBLADE!', zh: '快躲开巡逻锯片！' },
  { kind: 'mash', en: 'MASH (A) LIKE CRAZY!', zh: '狂按 A 键爆冲分！' },
  { kind: 'stop', en: 'FREEZE ON RED LIGHT!', zh: '红灯千万别乱动！' },
];

interface FiveSecState {
  timeLeft: number;
  totalTime: number;
  round: number;
  microIdx: number;
  microTimer: number;
  hazardX: number;
  hazardY: number;
  goalX: number;
  goalY: number;
  redLight: boolean;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    passed: boolean;
    mashCount: number;
    wins: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
  }[];
  banner: string | null;
}

function setupMicroRound(state: FiveSecState) {
  state.microIdx = (state.microIdx + 1) % MICRO_SPECS.length;
  state.microTimer = 5.0;
  state.hazardX = 240;
  state.hazardY = ARENA_HEIGHT / 2;
  state.goalX = 250 + Math.random() * (ARENA_WIDTH - 500);
  state.goalY = 180 + Math.random() * (ARENA_HEIGHT - 360);
  state.redLight = MICRO_SPECS[state.microIdx].kind === 'stop';
  for (const p of state.players) {
    p.passed = MICRO_SPECS[state.microIdx].kind === 'dodge' || MICRO_SPECS[state.microIdx].kind === 'stop';
    p.mashCount = 0;
  }
}

export const fiveSecondMicrogamesModule: CompactGameModule<FiveSecState, FiveSecondMicrogamesSnapshot> = {
  id: 'five-second-microgames',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const state: FiveSecState = {
      timeLeft: totalTime,
      totalTime,
      round: 1,
      microIdx: -1,
      microTimer: 5.0,
      hazardX: 600,
      hazardY: 360,
      goalX: 600,
      goalY: 280,
      redLight: false,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 320 + (i % 4) * 180,
        y: 280 + Math.floor(i / 4) * 140,
        passed: false,
        mashCount: 0,
        wins: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
      })),
      banner: '5-SECOND MICROGAME BLITZ — REACT FAST!',
    };
    setupMicroRound(state);
    return state;
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    const spec = MICRO_SPECS[state.microIdx];

    state.microTimer -= dt * (frenzy ? 1.15 : 1);
    if (spec.kind === 'dodge') {
      state.hazardX = ARENA_WIDTH / 2 + Math.sin(state.timeLeft * 3.1) * 340;
      state.hazardY = ARENA_HEIGHT / 2 + Math.cos(state.timeLeft * 2.2) * 140;
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const moved = Math.abs(mx) > 0.3 || Math.abs(my) > 0.3;

      if (spec.kind === 'stop') {
        if (state.redLight && state.microTimer < 3.6 && moved && p.passed) {
          p.passed = false;
          sounds.push({ type: 'hit', playerId: p.id });
        }
      } else {
        const spd = frenzy ? 420 : 350;
        p.x = clamp(p.x + mx * spd * dt, 120, ARENA_WIDTH - 120);
        p.y = clamp(p.y + my * spd * dt, 140, ARENA_HEIGHT - 140);
      }

      if (spec.kind === 'catch' && !p.passed && Math.hypot(p.x - state.goalX, p.y - state.goalY) < 54) {
        p.passed = true;
        p.score += 65 * mult;
        sounds.push({ type: 'pickup', playerId: p.id });
      }
      if (spec.kind === 'dodge' && p.passed && Math.hypot(p.x - state.hazardX, p.y - state.hazardY) < 46) {
        p.passed = false;
        sounds.push({ type: 'hit', playerId: p.id });
      }
      if (spec.kind === 'mash' && aDown && !p.prevA) {
        p.mashCount += 1;
        p.score += 18 * mult;
        if (p.mashCount >= 4 && !p.passed) {
          p.passed = true;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      p.prevA = aDown;
    }

    if (state.microTimer <= 0) {
      for (const p of state.players) {
        if (p.passed) {
          p.wins += 1;
          p.score += 95 * mult;
        }
      }
      state.round += 1;
      setupMicroRound(state);
      sounds.push({ type: 'win' });
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    const spec = MICRO_SPECS[state.microIdx];
    return {
      gameId: 'five-second-microgames',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      promptEn: spec.en,
      promptZh: spec.zh,
      microKind: spec.kind,
      microTimer: state.microTimer,
      hazardX: state.hazardX,
      hazardY: state.hazardY,
      goalX: state.goalX,
      goalY: state.goalY,
      redLight: state.redLight,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        passed: p.passed,
        wins: p.wins,
        score: p.score,
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: `${spec.en} (${state.microTimer.toFixed(1)}s)`,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.wins} clears · ${p.score} pts`);
  },
};

// ============================================================================
// 5. CORRIDOR FENCING (Nidhogg Style — Pad 2 Arrows)
// ============================================================================
const STANCES: ('high' | 'mid' | 'low')[] = ['high', 'mid', 'low'];

interface FencingState {
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    facing: 1 | -1;
    stanceIdx: number;
    lungeTimer: number;
    parryTimer: number;
    touches: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const corridorFencingModule: CompactGameModule<FencingState, CorridorFencingSnapshot> = {
  id: 'corridor-fencing',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: i % 2 === 0 ? 220 + i * 35 : ARENA_WIDTH - 220 - i * 35,
        y: 260 + (i % 3) * 80,
        facing: i % 2 === 0 ? 1 : -1,
        stanceIdx: 1,
        lungeTimer: 0,
        parryTimer: 0,
        touches: 0,
        score: 0,
        stepCd: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'SWITCH BLADE HEIGHT (↑/↓) · LUNGE (A) · REACH OPPOSITE GATE (+160)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.lungeTimer = Math.max(0, p.lungeTimer - dt);
      p.parryTimer = Math.max(0, p.parryTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (Math.abs(mx) > 0.25) {
        p.facing = mx > 0 ? 1 : -1;
        p.x = clamp(p.x + mx * (frenzy ? 380 : 300) * dt, 110, ARENA_WIDTH - 110);
      }
      if (p.stepCd <= 0 && Math.abs(my) > 0.45) {
        p.stanceIdx = clamp(p.stanceIdx + (my > 0 ? 1 : -1), 0, 2);
        p.stepCd = 0.16;
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.parryTimer = 0.45;
        p.cdB = 1.0;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.lungeTimer = 0.24;
        p.x = clamp(p.x + p.facing * 52, 110, ARENA_WIDTH - 110);
        p.cdA = frenzy ? 0.26 : 0.44;
        sounds.push({ type: 'dash', playerId: p.id });

        for (const other of state.players) {
          if (other.id === p.id) continue;
          const dx = (other.x - p.x) * p.facing;
          if (dx > -10 && dx < 95 && Math.abs(other.y - p.y) < 110) {
            if (other.parryTimer > 0 && other.stanceIdx === p.stanceIdx) {
              other.score += 45 * mult;
              sounds.push({ type: 'bump', playerId: other.id });
            } else {
              p.touches += 1;
              p.score += 85 * mult;
              other.x = clamp(other.x + p.facing * 120, 130, ARENA_WIDTH - 130);
              sounds.push({ type: 'hit', playerId: p.id });
            }
          }
        }
      }

      // Goal gate check
      const goalX = p.slotIndex % 2 === 0 ? ARENA_WIDTH - 135 : 135;
      if (Math.abs(p.x - goalX) < 35) {
        const pts = 160 * mult;
        p.touches += 1;
        p.score += pts;
        p.x = p.slotIndex % 2 === 0 ? 220 : ARENA_WIDTH - 220;
        state.banner = `${p.name} PIERCED THE GOAL GATE! +${pts}`;
        sounds.push({ type: 'score', playerId: p.id });
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'corridor-fencing',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        facing: p.facing,
        stance: STANCES[p.stanceIdx],
        lunging: p.lungeTimer > 0,
        touches: p.touches,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.44, 0, 1),
        cooldownB: clamp(p.cdB / 1.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.touches} touchés · ${p.score} pts`);
  },
};

// ============================================================================
// 6. PRO DARTS 301 (Pad 3 Glide + Tap A)
// ============================================================================
interface ProDartsState {
  timeLeft: number;
  totalTime: number;
  boardX: number;
  boardY: number;
  darts: { id: string; x: number; y: number; colorHex: string; label: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    steadyTimer: number;
    remaining301: number;
    checkouts: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const proDarts301Module: CompactGameModule<ProDartsState, ProDarts301Snapshot> = {
  id: 'pro-darts-301',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      boardX: ARENA_WIDTH / 2,
      boardY: 340,
      darts: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: ARENA_WIDTH / 2 + (i - 1) * 40,
        y: 340,
        steadyTimer: 0,
        remaining301: 301,
        checkouts: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'AIM AT BULLSEYE (50) & TRIPLE-20 (60) TO CHECK OUT FROM 301!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.steadyTimer = Math.max(0, p.steadyTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      const swayX = p.steadyTimer > 0 || frenzy ? 0 : Math.sin(state.timeLeft * 3.8 + p.slotIndex) * 26;
      const swayY = p.steadyTimer > 0 || frenzy ? 0 : Math.cos(state.timeLeft * 3.1 + p.slotIndex) * 20;
      p.x = clamp(p.x + (mx * 340 + swayX) * dt, state.boardX - 210, state.boardX + 210);
      p.y = clamp(p.y + (my * 340 + swayY) * dt, state.boardY - 210, state.boardY + 210);

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.steadyTimer = 1.6;
        p.cdB = 2.0;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const dist = Math.hypot(p.x - state.boardX, p.y - state.boardY);
        let hitVal = 10;
        let label = '10';
        if (dist <= 22) {
          hitVal = 50;
          label = 'BULL 50!';
        } else if (dist >= 100 && dist <= 132 && p.y < state.boardY - 80 && Math.abs(p.x - state.boardX) < 34) {
          hitVal = 60;
          label = 'T20!';
        } else if (dist <= 65) {
          hitVal = 25;
          label = '25';
        } else if (dist <= 135) {
          hitVal = 30;
          label = '30';
        } else if (dist <= 190) {
          hitVal = 20;
          label = '20';
        }

        state.darts.push({ id: `dt_${Math.random()}`, x: p.x, y: p.y, colorHex: p.colorHex, label });
        if (state.darts.length > 16) state.darts.shift();

        p.score += hitVal * mult;
        p.remaining301 -= hitVal;
        if (p.remaining301 <= 0) {
          p.checkouts += 1;
          p.remaining301 = 301;
          const bonus = 180 * mult;
          p.score += bonus;
          state.banner = `${p.name} PRO CHECKOUT 301! +${bonus}`;
          sounds.push({ type: 'score', playerId: p.id });
        } else {
          sounds.push({ type: hitVal >= 50 ? 'score' : 'hit', playerId: p.id });
        }
        p.cdA = frenzy ? 0.35 : 0.6;
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'pro-darts-301',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      boardX: state.boardX,
      boardY: state.boardY,
      darts: state.darts,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        remaining301: p.remaining301,
        checkouts: p.checkouts,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.6, 0, 1),
        cooldownB: clamp(p.cdB / 2.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.checkouts} checkouts · ${p.score} pts`);
  },
};

// ============================================================================
// 7. WAU KITE CUT (Malaysian Wau Bulan Kite Fighting — Pad 3 Glide)
// ============================================================================
interface WauKiteState {
  timeLeft: number;
  totalTime: number;
  windX: number;
  gustRings: { id: string; x: number; y: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    dashTimer: number;
    loopTimer: number;
    cuts: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const wauKiteCutModule: CompactGameModule<WauKiteState, WauKiteCutSnapshot> = {
  id: 'wau-kite-cut',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      windX: 40,
      gustRings: [
        { id: 'gr1', x: 350, y: 240 },
        { id: 'gr2', x: 600, y: 390 },
        { id: 'gr3', x: 850, y: 260 },
      ],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 240 + (i % 4) * 220,
        y: 240 + Math.floor(i / 4) * 160,
        dashTimer: 0,
        loopTimer: 0,
        cuts: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'FLY WAU BULAN KITES · SLASH RIVAL STRINGS (A) & CATCH WIND RINGS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    state.windX = Math.sin(state.timeLeft * 0.9) * 55;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.loopTimer = Math.max(0, p.loopTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      const spd = (p.dashTimer > 0 ? 590 : 340) * (frenzy ? 1.18 : 1);
      p.x = clamp(p.x + (mx * spd + state.windX) * dt, 110, ARENA_WIDTH - 110);
      p.y = clamp(p.y + my * spd * dt, 120, ARENA_HEIGHT - 120);

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.35;
        p.cdA = 0.85;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.loopTimer = 0.55;
        p.cdB = 1.25;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      for (const ring of state.gustRings) {
        if (Math.hypot(p.x - ring.x, p.y - ring.y) < 48) {
          p.score += 55 * mult;
          ring.x = 220 + Math.random() * (ARENA_WIDTH - 440);
          ring.y = 160 + Math.random() * (ARENA_HEIGHT - 320);
          sounds.push({ type: 'pickup', playerId: p.id });
        }
      }

      if (p.dashTimer > 0) {
        for (const other of state.players) {
          if (other.id === p.id || other.loopTimer > 0) continue;
          if (Math.hypot(p.x - other.x, p.y - (other.y + 26)) < 54) {
            p.cuts += 1;
            const pts = 120 * mult;
            p.score += pts;
            p.dashTimer = 0;
            other.y = clamp(other.y + 90, 120, ARENA_HEIGHT - 120);
            state.banner = `${p.name} SLICED ${other.name}'S WAU STRING! +${pts}`;
            sounds.push({ type: 'score', playerId: p.id });
          }
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'wau-kite-cut',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      windX: state.windX,
      gustRings: state.gustRings,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        dashing: p.dashTimer > 0,
        cuts: p.cuts,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.85, 0, 1),
        cooldownB: clamp(p.cdB / 1.25, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.cuts} cuts · ${p.score} pts`);
  },
};

// ============================================================================
// 8. FIVE STONES TOSS (Batu Seremban — Pad 3 Glide + Tap A)
// ============================================================================
interface FiveStonesState {
  timeLeft: number;
  totalTime: number;
  stones: { id: string; x: number; y: number; kind: 'floor' | 'tossed'; z: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    ibuBoostTimer: number;
    heldStones: number;
    setsCleared: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function makeMatStones(): FiveStonesState['stones'] {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `bs_${i}_${Math.random().toString(36).slice(2, 6)}`,
    x: 260 + i * 165 + (Math.random() - 0.5) * 60,
    y: 250 + (i % 2) * 140 + (Math.random() - 0.5) * 50,
    kind: 'floor' as const,
    z: 0,
  }));
}

export const fiveStonesTossModule: CompactGameModule<FiveStonesState, FiveStonesTossSnapshot> = {
  id: 'five-stones-toss',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      stones: makeMatStones(),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 280 + (i % 4) * 200,
        y: 340,
        ibuBoostTimer: 0,
        heldStones: 0,
        setsCleared: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'TOSS IBU STONE (B) · SWEEP & SCOOP CLOTH STONES (A)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const s of state.stones) {
      if (s.kind === 'tossed') {
        s.z = Math.max(0, s.z - 28 * dt);
        if (s.z === 0) s.kind = 'floor';
      }
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.ibuBoostTimer = Math.max(0, p.ibuBoostTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      const spd = (p.ibuBoostTimer > 0 ? 520 : 390) * (frenzy ? 1.18 : 1);
      p.x = clamp(p.x + mx * spd * dt, 130, ARENA_WIDTH - 130);
      p.y = clamp(p.y + my * spd * dt, 150, ARENA_HEIGHT - 140);

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.ibuBoostTimer = 2.5;
        p.cdB = 3.2;
        if (state.stones[0]) {
          state.stones[0].kind = 'tossed';
          state.stones[0].z = 70;
        }
        sounds.push({ type: 'dash', playerId: p.id });
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const radius = frenzy || p.ibuBoostTimer > 0 ? 82 : 64;
        const hitIdx = state.stones.findIndex((s) => Math.hypot(s.x - p.x, s.y - p.y) < radius);
        if (hitIdx >= 0) {
          state.stones.splice(hitIdx, 1);
          p.heldStones += 1;
          let pts = (p.ibuBoostTimer > 0 ? 65 : 45) * mult;
          if (p.heldStones >= 5) {
            p.heldStones = 0;
            p.setsCleared += 1;
            pts += 135 * mult;
            state.banner = `${p.name} CLEARED FULL 5-STONE BATU SET! +${pts}`;
          }
          p.score += pts;
          sounds.push({ type: 'score', playerId: p.id });
        }
        p.cdA = 0.22;
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    if (state.stones.length === 0) {
      state.stones = makeMatStones();
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'five-stones-toss',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      stones: state.stones,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        heldStones: p.heldStones,
        setsCleared: p.setsCleared,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.22, 0, 1),
        cooldownB: clamp(p.cdB / 3.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.setsCleared} sets · ${p.score} pts`);
  },
};

// ============================================================================
// 9. CHAPTEH JUGGLE (Malaysian / Chinese Jianzi — Pad 2 Arrows)
// ============================================================================
interface ChaptehFeather {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  golden: boolean;
}

interface ChaptehState {
  timeLeft: number;
  totalTime: number;
  feathers: ChaptehFeather[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    kicks: number;
    streak: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function makeChapteh(golden = false): ChaptehFeather {
  return {
    id: `ch_${Math.random().toString(36).slice(2, 7)}`,
    x: 260 + Math.random() * (ARENA_WIDTH - 520),
    y: 160 + Math.random() * 60,
    vx: (Math.random() - 0.5) * 140,
    vy: 60,
    golden,
  };
}

export const chaptehJuggleModule: CompactGameModule<ChaptehState, ChaptehJuggleSnapshot> = {
  id: 'chapteh-juggle',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      feathers: [makeChapteh(false), makeChapteh(true), makeChapteh(false)],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 250 + (i % 4) * 230,
        y: 540,
        kicks: 0,
        streak: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DASH UNDER FALLING CHAPTEH FEATHERS · KICK UP (A) BEFORE THEY LAND!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (let i = 0; i < state.feathers.length; i++) {
      const f = state.feathers[i];
      f.vy += 320 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < 140) {
        f.x = 140;
        f.vx = Math.abs(f.vx);
      } else if (f.x > ARENA_WIDTH - 140) {
        f.x = ARENA_WIDTH - 140;
        f.vx = -Math.abs(f.vx);
      }
      if (f.y > 590) {
        state.feathers[i] = makeChapteh(frenzy ? Math.random() < 0.5 : Math.random() < 0.25);
      }
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.x = clamp(p.x + mx * (frenzy ? 500 : 410) * dt, 130, ARENA_WIDTH - 130);

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.cdA = 0.24;
        for (const f of state.feathers) {
          if (Math.abs(f.x - p.x) < 76 && f.y > 390 && f.y < 585) {
            f.vy = -440;
            f.vx = (f.x - p.x) * 3.2 + (Math.random() - 0.5) * 110;
            p.kicks += 1;
            p.streak += 1;
            const pts = ((f.golden ? 95 : 40) + Math.min(4, p.streak) * 10) * mult;
            p.score += pts;
            sounds.push({ type: f.golden ? 'score' : 'pickup', playerId: p.id });
          }
        }
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 1.1;
        for (const f of state.feathers) {
          if (Math.abs(f.x - p.x) < 128 && f.y > 350) {
            f.vy = -480;
            f.vx = (ARENA_WIDTH / 2 - f.x) * 0.4;
            p.kicks += 1;
            p.score += 55 * mult;
            sounds.push({ type: 'dash', playerId: p.id });
          }
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'chapteh-juggle',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      feathers: state.feathers.map(({ id, x, y, vx, vy, golden }) => ({ id, x, y, vx, vy, golden })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        kicks: p.kicks,
        streak: p.streak,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.24, 0, 1),
        cooldownB: clamp(p.cdB / 1.1, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.kicks} kicks · ${p.score} pts`);
  },
};

// ============================================================================
// 10. XIANGQI RIVER CLASH (Chinese Chess Blitz — Pad 2 Board)
// ============================================================================
const XIANGQI_PIECES: ('chariot' | 'horse' | 'cannon')[] = ['chariot', 'horse', 'cannon'];

interface XiangqiState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  targets: { id: string; r: number; c: number; label: string; pts: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    pieceIdx: number;
    captures: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function makeXiangqiTargets(cols: number, rows: number): XiangqiState['targets'] {
  const specs: [string, number][] = [
    ['將', 180],
    ['士', 120],
    ['象', 100],
    ['兵', 80],
    ['帥', 180],
  ];
  return specs.map(([label, pts], i) => ({
    id: `xq_${i}_${Math.random().toString(36).slice(2, 6)}`,
    r: Math.floor(Math.random() * rows),
    c: Math.floor(Math.random() * cols),
    label,
    pts,
  }));
}

export const xiangqiRiverClashModule: CompactGameModule<XiangqiState, XiangqiRiverClashSnapshot> = {
  id: 'xiangqi-river-clash',
  init({ players, settingValue }) {
    const cols = 9;
    const rows = 6;
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      cols,
      rows,
      targets: makeXiangqiTargets(cols, rows),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: i % 2 === 0 ? 5 : 0,
        c: clamp(1 + i, 0, cols - 1),
        pieceIdx: i % 3,
        captures: 0,
        score: 0,
        stepCd: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'CROSS THE CHU-HAN RIVER · CAPTURE GENERAL (將/帥) PIECES (+180)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCd <= 0 && (Math.abs(mx) > 0.35 || Math.abs(my) > 0.35)) {
        const stride = p.pieceIdx === 0 || frenzy ? 2 : 1;
        if (Math.abs(mx) >= Math.abs(my)) p.c = clamp(p.c + Math.sign(mx) * stride, 0, state.cols - 1);
        else p.r = clamp(p.r + Math.sign(my) * stride, 0, state.rows - 1);
        p.stepCd = 0.14;
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.pieceIdx = (p.pieceIdx + 1) % XIANGQI_PIECES.length;
        p.cdB = 0.16;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const range = p.pieceIdx === 2 ? 2 : 1;
        const idx = state.targets.findIndex(
          (t) => Math.abs(t.r - p.r) + Math.abs(t.c - p.c) <= range
        );
        if (idx >= 0) {
          const hit = state.targets[idx];
          p.captures += 1;
          const pts = hit.pts * mult;
          p.score += pts;
          state.targets[idx] = {
            ...hit,
            id: `xq_${Math.random().toString(36).slice(2, 6)}`,
            r: Math.floor(Math.random() * state.rows),
            c: Math.floor(Math.random() * state.cols),
          };
          state.banner = `${p.name} CAPTURED [${hit.label}]! +${pts}`;
          sounds.push({ type: 'score', playerId: p.id });
        } else {
          p.score += 10 * mult;
          sounds.push({ type: 'tick', playerId: p.id });
        }
        p.cdA = frenzy ? 0.2 : 0.35;
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'xiangqi-river-clash',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: state.cols,
      rows: state.rows,
      targets: state.targets,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: p.r,
        c: p.c,
        piece: XIANGQI_PIECES[p.pieceIdx],
        captures: p.captures,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.35, 0, 1),
        cooldownB: clamp(p.cdB / 0.16, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.captures} captures · ${p.score} pts`);
  },
};
