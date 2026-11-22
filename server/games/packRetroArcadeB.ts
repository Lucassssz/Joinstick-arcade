import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/shared/types.ts';
import type {
  AirHockeyNeoSnapshot,
  BubblePopArcSnapshot,
  ClaySkeetSnapshot,
  CoinDozerSnapshot,
  PinStrikeSnapshot,
  SkeeRollSnapshot,
  StackTowerSnapshot,
  TunnelDigSnapshot,
} from '../../src/shared/packRetroArcadeTypes.ts';
import type {
  CompactGameModule,
  CompactResultEntry,
  CompactSoundEvent,
} from './packModuleAdapter.ts';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
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
// 9. CLAY SKEET (Duck Hunt)
// ============================================================================
interface ClayTarget {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  kind: 'clay' | 'gold' | 'decoy';
}
interface ClaySkeetState {
  timeLeft: number;
  totalTime: number;
  spawnTimer: number;
  tSeq: number;
  targets: ClayTarget[];
  flashes: { x: number; y: number; colorHex: string; alpha: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    ammo: number;
    streak: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const claySkeetModule: CompactGameModule<ClaySkeetState, ClaySkeetSnapshot> = {
  id: 'clay-skeet',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      spawnTimer: 0.4,
      tSeq: 1,
      targets: [],
      flashes: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 320 + (i % 4) * 180,
        y: 340,
        ammo: 6,
        streak: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'SNIPE FLYING CLAYS & GOLDEN SAUCERS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (let i = state.flashes.length - 1; i >= 0; i--) {
      state.flashes[i].alpha -= dt * 3;
      if (state.flashes[i].alpha <= 0) state.flashes.splice(i, 1);
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.targets.length < 7) {
      state.spawnTimer = frenzy ? 0.55 : 0.85;
      const fromLeft = Math.random() < 0.5;
      const r = Math.random();
      const kind: ClayTarget['kind'] = r < 0.22 ? 'gold' : r < 0.36 ? 'decoy' : 'clay';
      state.targets.push({
        id: `cs_${state.tSeq++}`,
        x: fromLeft ? 40 : ARENA_WIDTH - 40,
        y: 440 + Math.random() * 140,
        vx: (fromLeft ? 1 : -1) * (kind === 'gold' ? 360 : 250 + Math.random() * 90),
        vy: -(320 + Math.random() * 140),
        r: kind === 'gold' ? 22 : 28,
        kind,
      });
    }

    for (let i = state.targets.length - 1; i >= 0; i--) {
      const t = state.targets[i];
      t.vy += 290 * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      if (t.x < -50 || t.x > ARENA_WIDTH + 50 || t.y > ARENA_HEIGHT + 40) {
        state.targets.splice(i, 1);
      }
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      p.x = clamp(p.x + (inp?.moveX ?? 0) * 620 * dt, 40, ARENA_WIDTH - 40);
      p.y = clamp(p.y + (inp?.moveY ?? 0) * 520 * dt, 70, ARENA_HEIGHT - 80);

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      const fire = aDown && !p.prevA && p.cdA <= 0;
      const spread = bDown && !p.prevB && p.cdB <= 0;
      p.prevA = aDown;
      p.prevB = bDown;

      if (fire || spread) {
        p.cdA = 0.22;
        if (spread) p.cdB = frenzy ? 2.2 : 4.0;
        const rad = spread ? 145 : 46;
        state.flashes.push({ x: p.x, y: p.y, colorHex: p.colorHex, alpha: 1 });
        let hitAny = false;
        for (let i = state.targets.length - 1; i >= 0; i--) {
          const t = state.targets[i];
          if (dist(p.x, p.y, t.x, t.y) < rad + t.r) {
            hitAny = true;
            state.targets.splice(i, 1);
            if (t.kind === 'decoy') {
              p.streak = 0;
              p.score = Math.max(0, p.score - 35);
              sounds.push({ type: 'hit', playerId: p.id });
            } else {
              p.streak += 1;
              const pts = (t.kind === 'gold' ? 90 : 30) * mult + Math.min(30, p.streak * 4);
              p.score += pts;
              sounds.push({ type: t.kind === 'gold' ? 'win' : 'score', playerId: p.id });
            }
            if (!spread) break;
          }
        }
        if (!hitAny) p.streak = 0;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'clay-skeet',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      targets: state.targets,
      flashes: state.flashes,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        ammo: p.ammo,
        streak: p.streak,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.22, 0, 1),
        cooldownB: clamp(p.cdB / 4.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} Skeet Pts`);
  },
};

// ============================================================================
// 10. NEO HOCKEY (Air Hockey)
// ============================================================================
interface AirHockeyState {
  timeLeft: number;
  totalTime: number;
  leftScore: number;
  rightScore: number;
  pucks: { x: number; y: number; vx: number; vy: number; r: number; supercharged: boolean; lastTouchId: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    side: 'left' | 'right';
    x: number;
    y: number;
    vx: number;
    vy: number;
    smashTimer: number;
    guardTimer: number;
    goals: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const airHockeyNeoModule: CompactGameModule<AirHockeyState, AirHockeyNeoSnapshot> = {
  id: 'air-hockey-neo',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      leftScore: 0,
      rightScore: 0,
      pucks: [{ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: 260, vy: 140, r: 22, supercharged: false, lastTouchId: null }],
      players: players.map((p, i) => {
        const side: 'left' | 'right' = i % 2 === 0 ? 'left' : 'right';
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          side,
          x: side === 'left' ? 240 : ARENA_WIDTH - 240,
          y: 260 + Math.floor(i / 2) * 140,
          vx: 0,
          vy: 0,
          smashTimer: 0,
          guardTimer: 0,
          goals: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'BANK SHOTS & POWER SMASHES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.smashTimer = Math.max(0, p.smashTimer - dt);
      p.guardTimer = Math.max(0, p.guardTimer - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      p.vx = (inp?.moveX ?? 0) * 540;
      p.vy = (inp?.moveY ?? 0) * 540;
      const minX = p.side === 'left' ? 92 : ARENA_WIDTH / 2 + 34;
      const maxX = p.side === 'left' ? ARENA_WIDTH / 2 - 34 : ARENA_WIDTH - 92;
      p.x = clamp(p.x + p.vx * dt, minX, maxX);
      p.y = clamp(p.y + p.vy * dt, 98, ARENA_HEIGHT - 98);

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.smashTimer = 0.4;
        p.cdA = 1.6;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.guardTimer = 1.4;
        p.cdB = 3.5;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    for (const pk of state.pucks) {
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.vx *= 0.996;
      pk.vy *= 0.996;

      if (pk.y < 86 || pk.y > ARENA_HEIGHT - 86) {
        pk.vy *= -1;
        pk.y = clamp(pk.y, 86, ARENA_HEIGHT - 86);
        sounds.push({ type: 'tick' });
      }

      const inGoalMouth = pk.y > ARENA_HEIGHT / 2 - 115 && pk.y < ARENA_HEIGHT / 2 + 115;
      if (pk.x < 70) {
        if (inGoalMouth) {
          state.rightScore += 1;
          for (const p of state.players) {
            if (p.side === 'right') p.score += 100 * mult;
          }
          const scorer = state.players.find((p) => p.id === pk.lastTouchId && p.side === 'right');
          if (scorer) {
            scorer.goals += 1;
            scorer.score += 50 * mult;
          }
          state.banner = `RIGHT SQUAD GOAL! (${state.leftScore} - ${state.rightScore})`;
          pk.x = ARENA_WIDTH / 2;
          pk.y = ARENA_HEIGHT / 2;
          pk.vx = 240;
          pk.vy = (Math.random() - 0.5) * 260;
          pk.supercharged = false;
          sounds.push({ type: 'win' });
        } else {
          pk.vx = Math.abs(pk.vx);
          pk.x = 72;
        }
      } else if (pk.x > ARENA_WIDTH - 70) {
        if (inGoalMouth) {
          state.leftScore += 1;
          for (const p of state.players) {
            if (p.side === 'left') p.score += 100 * mult;
          }
          const scorer = state.players.find((p) => p.id === pk.lastTouchId && p.side === 'left');
          if (scorer) {
            scorer.goals += 1;
            scorer.score += 50 * mult;
          }
          state.banner = `LEFT SQUAD GOAL! (${state.leftScore} - ${state.rightScore})`;
          pk.x = ARENA_WIDTH / 2;
          pk.y = ARENA_HEIGHT / 2;
          pk.vx = -240;
          pk.vy = (Math.random() - 0.5) * 260;
          pk.supercharged = false;
          sounds.push({ type: 'win' });
        } else {
          pk.vx = -Math.abs(pk.vx);
          pk.x = ARENA_WIDTH - 72;
        }
      }

      for (const p of state.players) {
        const hitR = (p.guardTimer > 0 ? 48 : 34) + pk.r;
        const d = dist(p.x, p.y, pk.x, pk.y);
        if (d < hitR && d > 0.1) {
          const nx = (pk.x - p.x) / d;
          const ny = (pk.y - p.y) / d;
          const power = (p.smashTimer > 0 || frenzy ? 820 : 560) + Math.hypot(p.vx, p.vy) * 0.35;
          pk.vx = nx * power;
          pk.vy = ny * power;
          pk.x = p.x + nx * (hitR + 2);
          pk.y = p.y + ny * (hitR + 2);
          pk.supercharged = p.smashTimer > 0;
          pk.lastTouchId = p.id;
          p.score += 10;
          sounds.push({ type: p.smashTimer > 0 ? 'hit' : 'tick', playerId: p.id });
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'air-hockey-neo',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      leftScore: state.leftScore,
      rightScore: state.rightScore,
      pucks: state.pucks.map((pk) => ({ x: pk.x, y: pk.y, vx: pk.vx, vy: pk.vy, r: pk.r, supercharged: pk.supercharged })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        side: p.side,
        x: p.x,
        y: p.y,
        smashTimer: p.smashTimer,
        goals: p.goals,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.6, 0, 1),
        cooldownB: clamp(p.cdB / 3.5, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.side.toUpperCase()} · ${p.goals} Goals`);
  },
};

// ============================================================================
// 11. SKEE ROLL (Skee-Ball)
// ============================================================================
const SKEE_RINGS = [
  { x: 430, y: 155, r: 34, points: 100, colorHex: '#FACC15' },
  { x: 770, y: 155, r: 34, points: 100, colorHex: '#FACC15' },
  { x: 600, y: 170, r: 44, points: 50, colorHex: '#EC4899' },
  { x: 600, y: 245, r: 52, points: 30, colorHex: '#38BDF8' },
  { x: 600, y: 335, r: 64, points: 10, colorHex: '#22C55E' },
];

interface SkeeRollState {
  timeLeft: number;
  totalTime: number;
  balls: { x: number; y: number; vx: number; vy: number; ownerId: string; ownerSlot: number; colorHex: string; life: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    aimX: number;
    charge: number;
    charging: boolean;
    lastPts: number;
    score: number;
    cdA: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const skeeRollModule: CompactGameModule<SkeeRollState, SkeeRollSnapshot> = {
  id: 'skee-roll',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      balls: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: 520 + (i % 4) * 55,
        charge: 0,
        charging: false,
        lastPts: 0,
        score: 0,
        cdA: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'HOLD ROLL TO HIT THE 100-PT CORNER RINGS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      p.aimX = clamp(p.aimX + (inp?.moveX ?? 0) * 340 * dt, 390, 810);

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (aDown && p.cdA <= 0) {
        p.charging = true;
        p.charge = Math.min(1, p.charge + dt * 1.1);
      } else if (p.charging && !aDown) {
        const power = 520 + p.charge * 560;
        const aimAngle = (p.aimX - 600) / 380;
        state.balls.push({
          x: p.aimX,
          y: 635,
          vx: aimAngle * 150,
          vy: -power,
          ownerId: p.id,
          ownerSlot: p.slotIndex,
          colorHex: p.colorHex,
          life: 1.4,
        });
        p.charging = false;
        p.charge = 0;
        p.cdA = 0.5;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdA <= 0) {
        state.balls.push({
          x: p.aimX,
          y: 635,
          vx: ((600 - p.aimX) * 0.25),
          vy: -860,
          ownerId: p.id,
          ownerSlot: p.slotIndex,
          colorHex: p.colorHex,
          life: 1.3,
        });
        p.cdA = 0.55;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 460 * dt; // ramp friction
      b.life -= dt;
      if (b.vy >= -40 || b.y < 120 || b.life <= 0) {
        // Score closest pocket
        let pts = 0;
        for (const ring of SKEE_RINGS) {
          if (dist(b.x, b.y, ring.x, ring.y) < ring.r + (frenzy ? 16 : 8)) {
            pts = Math.max(pts, ring.points);
          }
        }
        const owner = state.players.find((pl) => pl.id === b.ownerId);
        if (owner) {
          owner.lastPts = pts * mult;
          owner.score += pts * mult;
          if (pts >= 100) {
            state.banner = `${owner.name} SANK A 100-PT JACKPOT!`;
            sounds.push({ type: 'win', playerId: owner.id });
          } else if (pts > 0) {
            sounds.push({ type: 'score', playerId: owner.id });
          }
        }
        state.balls.splice(i, 1);
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'skee-roll',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      rings: SKEE_RINGS,
      balls: state.balls.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, ownerSlot: b.ownerSlot, colorHex: b.colorHex })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: p.aimX,
        charge: p.charge,
        charging: p.charging,
        lastPts: p.lastPts,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.5, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} Tickets`);
  },
};

// ============================================================================
// 12. STACK TOWER (Arcade Stacker)
// ============================================================================
const STACK_COLORS = ['#38BDF8', '#22C55E', '#FACC15', '#F97316', '#EC4899', '#A855F7'];

interface StackTowerState {
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    blocks: { x: number; w: number; colorHex: string }[];
    moverX: number;
    moverW: number;
    moverDir: number;
    slowTimer: number;
    height: number;
    perfectStreak: number;
    score: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const stackTowerModule: CompactGameModule<StackTowerState, StackTowerSnapshot> = {
  id: 'stack-tower',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        blocks: [{ x: 0.5, w: 0.62, colorHex: p.colorHex }],
        moverX: 0.2,
        moverW: 0.62,
        moverDir: 1,
        slowTimer: 0,
        height: 1,
        perfectStreak: 0,
        score: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DROP BLOCKS FLUSH FOR GOLDEN STREAKS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdB = Math.max(0, p.cdB - dt);
      p.slowTimer = Math.max(0, p.slowTimer - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      const spd = (0.75 + Math.min(1.1, p.height * 0.045)) * (p.slowTimer > 0 ? 0.42 : 1);
      p.moverX += p.moverDir * spd * dt;
      if (p.moverX > 0.92 - p.moverW / 2) {
        p.moverX = 0.92 - p.moverW / 2;
        p.moverDir = -1;
      } else if (p.moverX < 0.08 + p.moverW / 2) {
        p.moverX = 0.08 + p.moverW / 2;
        p.moverDir = 1;
      }

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.slowTimer = 2.4;
        p.cdB = 5.0;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (aDown && !p.prevA) {
        const top = p.blocks[p.blocks.length - 1];
        const diff = Math.abs(p.moverX - top.x);
        const tol = frenzy ? 0.065 : 0.045;
        if (diff <= tol) {
          p.perfectStreak += 1;
          const newW = p.perfectStreak >= 3 ? Math.min(0.68, top.w + 0.06) : top.w;
          p.blocks.push({ x: top.x, w: newW, colorHex: '#FACC15' });
          p.moverW = newW;
          p.height += 1;
          p.score += (45 + p.perfectStreak * 15) * mult;
          sounds.push({ type: 'win', playerId: p.id });
        } else {
          const left = Math.max(p.moverX - p.moverW / 2, top.x - top.w / 2);
          const right = Math.min(p.moverX + p.moverW / 2, top.x + top.w / 2);
          const overlap = right - left;
          if (overlap > 0.06) {
            p.perfectStreak = 0;
            const nx = (left + right) / 2;
            p.blocks.push({ x: nx, w: overlap, colorHex: STACK_COLORS[p.height % STACK_COLORS.length] });
            p.moverW = overlap;
            p.height += 1;
            p.score += 20 * mult;
            sounds.push({ type: 'score', playerId: p.id });
          } else {
            // Missed completely -> reset beam cleanly
            p.perfectStreak = 0;
            p.moverW = 0.55;
            p.blocks = [{ x: 0.5, w: 0.55, colorHex: p.colorHex }];
            sounds.push({ type: 'hit', playerId: p.id });
          }
        }
        if (p.blocks.length > 14) p.blocks.shift();
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'stack-tower',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        blocks: p.blocks,
        moverX: p.moverX,
        moverW: p.moverW,
        height: p.height,
        perfectStreak: p.perfectStreak,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 5.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.height} Floors Stacked`);
  },
};

// ============================================================================
// 13. TUNNEL DIG (Dig Dug)
// ============================================================================
const DIG_COLS = 20;
const DIG_ROWS = 12;

interface TunnelDigState {
  timeLeft: number;
  totalTime: number;
  dirt: number[];
  gems: { id: string; x: number; y: number; value: number; colorHex: string }[];
  boulders: { id: string; x: number; y: number; falling: boolean }[];
  monsters: { id: string; x: number; y: number; vx: number; vy: number; inflated: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    pumpTimer: number;
    boostTimer: number;
    stunTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const tunnelDigModule: CompactGameModule<TunnelDigState, TunnelDigSnapshot> = {
  id: 'tunnel-dig',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const dirt = new Array(DIG_COLS * DIG_ROWS).fill(1);
    for (let c = 0; c < DIG_COLS; c++) dirt[c] = 0; // sky row
    const gems = Array.from({ length: 18 }, (_, i) => {
      const gy = 2 + Math.floor(Math.random() * (DIG_ROWS - 3));
      const gx = 1 + Math.floor(Math.random() * (DIG_COLS - 2));
      return {
        id: `gm_${i}`,
        x: gx + 0.5,
        y: gy + 0.5,
        value: gy >= 8 ? 80 : gy >= 5 ? 45 : 25,
        colorHex: gy >= 8 ? '#38BDF8' : gy >= 5 ? '#E879F9' : '#FACC15',
      };
    });
    const boulders = [
      { id: 'b1', x: 5.5, y: 3.5, falling: false },
      { id: 'b2', x: 10.5, y: 4.5, falling: false },
      { id: 'b3', x: 15.5, y: 3.5, falling: false },
    ];
    const monsters = [
      { id: 'm1', x: 4.5, y: 7.5, vx: 1, vy: 0, inflated: 0 },
      { id: 'm2', x: 14.5, y: 7.5, vx: -1, vy: 0, inflated: 0 },
      { id: 'm3', x: 9.5, y: 9.5, vx: 1, vy: 0, inflated: 0 },
    ];
    for (const m of monsters) {
      const r = Math.floor(m.y);
      for (let dc = -1; dc <= 1; dc++) dirt[r * DIG_COLS + clamp(Math.floor(m.x) + dc, 0, DIG_COLS - 1)] = 0;
    }
    return {
      timeLeft: totalTime,
      totalTime,
      dirt,
      gems,
      boulders,
      monsters,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 2.5 + i * 2.2,
        y: 0.6,
        angle: Math.PI / 2,
        pumpTimer: 0,
        boostTimer: 0,
        stunTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DRILL FOR DEEP DIAMONDS & CRUSH MONSTERS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    while (state.gems.length < 14) {
      const gy = 3 + Math.floor(Math.random() * (DIG_ROWS - 4));
      const gx = 1 + Math.floor(Math.random() * (DIG_COLS - 2));
      state.gems.push({
        id: `gm_${Math.random().toString(36).slice(2, 7)}`,
        x: gx + 0.5,
        y: gy + 0.5,
        value: gy >= 8 ? 80 : 40,
        colorHex: gy >= 8 ? '#38BDF8' : '#FACC15',
      });
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.pumpTimer = Math.max(0, p.pumpTimer - dt);
      p.boostTimer = Math.max(0, p.boostTimer - dt);
      p.stunTimer = Math.max(0, p.stunTimer - dt);
      if (p.stunTimer > 0) continue;

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      if (Math.hypot(mx, my) > 0.2) {
        p.angle = Math.atan2(my, mx);
        const spd = p.boostTimer > 0 ? 7.4 : 4.6;
        p.x = clamp(p.x + mx * spd * dt, 0.5, DIG_COLS - 0.5);
        p.y = clamp(p.y + my * spd * dt, 0.5, DIG_ROWS - 0.5);
        const gi = Math.floor(p.y) * DIG_COLS + Math.floor(p.x);
        if (state.dirt[gi] === 1) {
          state.dirt[gi] = 0;
          p.score += 3;
        }
      }

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.pumpTimer = 0.28;
        p.cdA = 0.35;
        for (let i = state.monsters.length - 1; i >= 0; i--) {
          const m = state.monsters[i];
          if (dist(p.x, p.y, m.x, m.y) < 2.6) {
            m.inflated += 1;
            sounds.push({ type: 'tick', playerId: p.id });
            if (m.inflated >= 2) {
              p.score += 100 * mult;
              m.x = 2 + Math.random() * (DIG_COLS - 4);
              m.y = 6 + Math.random() * 4;
              m.inflated = 0;
              sounds.push({ type: 'score', playerId: p.id });
            }
          }
        }
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.boostTimer = 2.0;
        p.cdB = 4.2;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      for (let i = state.gems.length - 1; i >= 0; i--) {
        if (dist(p.x, p.y, state.gems[i].x, state.gems[i].y) < 0.72) {
          p.score += state.gems[i].value * mult;
          state.gems.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
    }

    // Boulders fall if dirt beneath is dug
    for (const b of state.boulders) {
      const belowRow = Math.min(DIG_ROWS - 1, Math.floor(b.y + 0.65));
      const belowIdx = belowRow * DIG_COLS + Math.floor(b.x);
      if (state.dirt[belowIdx] === 0 && b.y < DIG_ROWS - 0.6) {
        b.falling = true;
        b.y += 6.2 * dt;
        for (const m of state.monsters) {
          if (dist(b.x, b.y, m.x, m.y) < 0.9) {
            const nearest = [...state.players].sort((x, y) => dist(x.x, x.y, b.x, b.y) - dist(y.x, y.y, b.x, b.y))[0];
            if (nearest) nearest.score += 150 * mult;
            m.x = 2 + Math.random() * (DIG_COLS - 4);
            m.y = 7 + Math.random() * 3;
            state.banner = 'BOULDER CRUSH (+150)!';
            sounds.push({ type: 'win' });
          }
        }
      } else {
        b.falling = false;
      }
    }

    for (const m of state.monsters) {
      if (m.inflated > 0) m.inflated = Math.max(0, m.inflated - dt * 0.4);
      const nearest = [...state.players].sort((a, b) => dist(a.x, a.y, m.x, m.y) - dist(b.x, b.y, m.x, m.y))[0];
      if (nearest) {
        const d = dist(m.x, m.y, nearest.x, nearest.y) || 1;
        m.x = clamp(m.x + ((nearest.x - m.x) / d) * 2.1 * dt, 0.5, DIG_COLS - 0.5);
        m.y = clamp(m.y + ((nearest.y - m.y) / d) * 2.1 * dt, 1.2, DIG_ROWS - 0.5);
        if (d < 0.65 && nearest.stunTimer <= 0) {
          nearest.stunTimer = 1.2;
          nearest.score = Math.max(0, nearest.score - 25);
          sounds.push({ type: 'hit', playerId: nearest.id });
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'tunnel-dig',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: DIG_COLS,
      rows: DIG_ROWS,
      dirt: state.dirt,
      gems: state.gems,
      boulders: state.boulders,
      monsters: state.monsters.map((m) => ({ id: m.id, x: m.x, y: m.y, inflated: m.inflated })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        pumpTimer: p.pumpTimer,
        stunTimer: p.stunTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.35, 0, 1),
        cooldownB: clamp(p.cdB / 4.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} Gem Pts`);
  },
};

// ============================================================================
// 14. BUBBLE POP (Puzzle Bobble)
// ============================================================================
const BUBBLE_COLORS = ['#EF4444', '#38BDF8', '#22C55E', '#FACC15', '#E879F9'];
const BUB_R = 22;

interface BubblePopState {
  timeLeft: number;
  totalTime: number;
  ceilingY: number;
  bSeq: number;
  bubbles: { id: string; x: number; y: number; colorIdx: number; colorHex: string }[];
  shots: { x: number; y: number; vx: number; vy: number; colorIdx: number; colorHex: string; ownerId: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    aimAngle: number;
    nextColorIdx: number;
    pops: number;
    score: number;
    cdA: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function buildBubbleCluster(startSeq: number) {
  const out: BubblePopState['bubbles'] = [];
  let seq = startSeq;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 18; c++) {
      const ci = (r + Math.floor(c / 2)) % BUBBLE_COLORS.length;
      out.push({
        id: `bb_${seq++}`,
        x: 165 + c * 50 + (r % 2) * 25,
        y: 105 + r * 44,
        colorIdx: ci,
        colorHex: BUBBLE_COLORS[ci],
      });
    }
  }
  return { out, seq };
}

export const bubblePopArcModule: CompactGameModule<BubblePopState, BubblePopArcSnapshot> = {
  id: 'bubble-pop-arc',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const { out, seq } = buildBubbleCluster(1);
    return {
      timeLeft: totalTime,
      totalTime,
      ceilingY: 80,
      bSeq: seq,
      bubbles: out,
      shots: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 200 + ((i * 150) % 800),
        aimAngle: -Math.PI / 2,
        nextColorIdx: i % BUBBLE_COLORS.length,
        pops: 0,
        score: 0,
        cdA: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'MATCH 3+ BUBBLES FOR CLUSTER POPS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    if (state.bubbles.length < 18) {
      const { out, seq } = buildBubbleCluster(state.bSeq);
      state.bubbles = out;
      state.bSeq = seq;
      state.banner = 'FRESH CRYSTAL WAVE!';
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      p.aimAngle = clamp(p.aimAngle + (inp?.moveX ?? 0) * 2.2 * dt, -Math.PI + 0.32, -0.32);

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (bDown && !p.prevB) {
        p.nextColorIdx = (p.nextColorIdx + 1) % BUBBLE_COLORS.length;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.cdA = frenzy ? 0.28 : 0.48;
        state.shots.push({
          x: p.x,
          y: 630,
          vx: Math.cos(p.aimAngle) * 740,
          vy: Math.sin(p.aimAngle) * 740,
          colorIdx: p.nextColorIdx,
          colorHex: BUBBLE_COLORS[p.nextColorIdx],
          ownerId: p.id,
        });
        p.nextColorIdx = Math.floor(Math.random() * BUBBLE_COLORS.length);
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    for (let i = state.shots.length - 1; i >= 0; i--) {
      const s = state.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 120 || s.x > ARENA_WIDTH - 120) {
        s.vx *= -1;
        s.x = clamp(s.x, 120, ARENA_WIDTH - 120);
      }
      const hitBub = state.bubbles.find((b) => dist(s.x, s.y, b.x, b.y) < BUB_R * 1.9);
      if (hitBub || s.y <= state.ceilingY + BUB_R) {
        const landed = {
          id: `bb_${state.bSeq++}`,
          x: s.x,
          y: s.y,
          colorIdx: s.colorIdx,
          colorHex: s.colorHex,
        };
        state.bubbles.push(landed);
        state.shots.splice(i, 1);

        // BFS same color cluster
        const group: typeof state.bubbles = [landed];
        const visited = new Set([landed.id]);
        for (let k = 0; k < group.length; k++) {
          const cur = group[k];
          for (const other of state.bubbles) {
            if (!visited.has(other.id) && other.colorIdx === landed.colorIdx && dist(cur.x, cur.y, other.x, other.y) < BUB_R * 2.65) {
              visited.add(other.id);
              group.push(other);
            }
          }
        }
        if (group.length >= 3) {
          const ids = new Set(group.map((g) => g.id));
          state.bubbles = state.bubbles.filter((b) => !ids.has(b.id));
          const owner = state.players.find((pl) => pl.id === s.ownerId);
          if (owner) {
            owner.pops += group.length;
            owner.score += group.length * 25 * mult;
            sounds.push({ type: group.length >= 5 ? 'win' : 'score', playerId: owner.id });
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'bubble-pop-arc',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      ceilingY: state.ceilingY,
      bubbles: state.bubbles,
      shots: state.shots,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        aimAngle: p.aimAngle,
        nextColorIdx: p.nextColorIdx,
        nextColorHex: BUBBLE_COLORS[p.nextColorIdx],
        pops: p.pops,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.48, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.pops} Bubbles Popped`);
  },
};

// ============================================================================
// 15. PIN STRIKE (Arcade Bowling)
// ============================================================================
function buildTenPins() {
  const pins: { id: number; x: number; y: number; knocked: boolean }[] = [];
  let id = 1;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col <= row; col++) {
      pins.push({
        id: id++,
        x: 600 + (col - row / 2) * 52,
        y: 235 - row * 38,
        knocked: false,
      });
    }
  }
  return pins;
}

interface PinStrikeState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  resetTimer: number;
  pins: { id: number; x: number; y: number; knocked: boolean }[];
  balls: { x: number; y: number; vx: number; vy: number; spin: number; ownerId: string; ownerSlot: number; colorHex: string; hits: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    laneX: number;
    aimSpin: number;
    charge: number;
    charging: boolean;
    strikes: number;
    score: number;
    cdA: number;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const pinStrikeModule: CompactGameModule<PinStrikeState, PinStrikeSnapshot> = {
  id: 'pin-strike',
  init({ players, settingValue }) {
    const maxRounds = settingValue || 5;
    return {
      timeLeft: maxRounds * 14,
      totalTime: maxRounds * 14,
      round: 1,
      maxRounds,
      resetTimer: 0,
      pins: buildTenPins(),
      balls: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        laneX: 500 + (i % 4) * 65,
        aimSpin: 0,
        charge: 0,
        charging: false,
        strikes: 0,
        score: 0,
        cdA: 0,
        prevB: false,
      })),
      banner: 'ADD HOOK SPIN & BLAST ALL 10 PINS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    if (state.resetTimer > 0) {
      state.resetTimer -= dt;
      if (state.resetTimer <= 0) {
        state.pins = buildTenPins();
        state.round = Math.min(state.maxRounds, state.round + 1);
      }
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      p.laneX = clamp(p.laneX + (inp?.moveX ?? 0) * 320 * dt, 390, 810);

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (bDown && !p.prevB) {
        p.aimSpin = p.aimSpin === 0 ? -1 : p.aimSpin === -1 ? 1 : 0;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (aDown && p.cdA <= 0) {
        p.charging = true;
        p.charge = Math.min(1, p.charge + dt * 1.15);
      } else if (p.charging && !aDown) {
        state.balls.push({
          x: p.laneX,
          y: 630,
          vx: p.aimSpin * -70,
          vy: -(520 + p.charge * 380),
          spin: p.aimSpin * 260,
          ownerId: p.id,
          ownerSlot: p.slotIndex,
          colorHex: p.colorHex,
          hits: 0,
        });
        p.charging = false;
        p.charge = 0;
        p.cdA = 1.2;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevB = bDown;
    }

    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i];
      b.vx += b.spin * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      for (const pin of state.pins) {
        if (!pin.knocked && dist(b.x, b.y, pin.x, pin.y) < 38) {
          pin.knocked = true;
          b.hits += 1;
          // Splash knock nearby pins
          for (const near of state.pins) {
            if (!near.knocked && dist(pin.x, pin.y, near.x, near.y) < 68 && Math.random() < 0.72) {
              near.knocked = true;
              b.hits += 1;
            }
          }
        }
      }

      if (b.y < 95 || b.x < 350 || b.x > 850) {
        const owner = state.players.find((pl) => pl.id === b.ownerId);
        if (owner && b.hits > 0) {
          const strike = b.hits >= 9 || state.pins.every((pn) => pn.knocked);
          if (strike) {
            owner.strikes += 1;
            owner.score += 150 * mult;
            state.banner = `⚡ STRIKE! ${owner.name} (+${150 * mult})`;
            sounds.push({ type: 'win', playerId: owner.id });
          } else {
            owner.score += b.hits * 15 * mult;
            sounds.push({ type: 'score', playerId: owner.id });
          }
        }
        state.balls.splice(i, 1);
        if (state.pins.filter((pn) => !pn.knocked).length <= 2 && state.resetTimer <= 0) {
          state.resetTimer = 1.1;
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'pin-strike',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      maxRounds: state.maxRounds,
      pins: state.pins,
      balls: state.balls.map((b) => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, spin: b.spin, ownerSlot: b.ownerSlot, colorHex: b.colorHex })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        laneX: p.laneX,
        aimSpin: p.aimSpin,
        charge: p.charge,
        charging: p.charging,
        strikes: p.strikes,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.2, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.strikes} Strikes`);
  },
};

// ============================================================================
// 16. COIN DOZER (Arcade Coin Pusher)
// ============================================================================
interface DozerCoin {
  id: string;
  x: number;
  y: number;
  r: number;
  kind: 'gold' | 'mega' | 'gem';
  ownerSlot: number;
}
interface CoinDozerState {
  timeLeft: number;
  totalTime: number;
  pusherPhase: number;
  pusherY: number;
  cSeq: number;
  coins: DozerCoin[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    tokens: number;
    megaCd: number;
    jackpots: number;
    score: number;
    cdA: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const coinDozerModule: CompactGameModule<CoinDozerState, CoinDozerSnapshot> = {
  id: 'coin-dozer',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const coins: DozerCoin[] = [];
    for (let i = 0; i < 42; i++) {
      coins.push({
        id: `cd_${i}`,
        x: 240 + Math.random() * 720,
        y: 250 + Math.random() * 340,
        r: i % 9 === 0 ? 18 : 14,
        kind: i % 9 === 0 ? 'gem' : 'gold',
        ownerSlot: -1,
      });
    }
    return {
      timeLeft: totalTime,
      totalTime,
      pusherPhase: 0,
      pusherY: 220,
      cSeq: 50,
      coins,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 300 + ((i * 140) % 600),
        tokens: 99,
        megaCd: 3,
        jackpots: 0,
        score: 0,
        cdA: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DROP COINS & TRIGGER GEM AVALANCHES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    const prevPusherY = state.pusherY;
    state.pusherPhase += dt * 1.9;
    state.pusherY = 215 + Math.sin(state.pusherPhase) * 78;
    const pushDelta = Math.max(0, state.pusherY - prevPusherY);

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.megaCd = Math.max(0, p.megaCd - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      p.x = clamp(p.x + (inp?.moveX ?? 0) * 480 * dt, 230, ARENA_WIDTH - 230);

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.cdA = 0.24;
        state.coins.push({
          id: `cd_${state.cSeq++}`,
          x: p.x + (Math.random() - 0.5) * 14,
          y: state.pusherY + 26,
          r: 14,
          kind: 'gold',
          ownerSlot: p.slotIndex,
        });
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (bDown && !p.prevB && p.megaCd <= 0) {
        p.megaCd = frenzy ? 3.5 : 6.0;
        state.coins.push({
          id: `cd_${state.cSeq++}`,
          x: p.x,
          y: state.pusherY + 34,
          r: 26,
          kind: 'mega',
          ownerSlot: p.slotIndex,
        });
        state.banner = `${p.name} DROPPED A GIANT MEGA COIN!`;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    // Pusher shoves coins forward + coin-to-coin shoving
    if (pushDelta > 0) {
      for (const c of state.coins) {
        if (c.y < state.pusherY + 60) {
          c.y += pushDelta * 1.15;
        }
      }
    }
    for (let i = 0; i < state.coins.length; i++) {
      const a = state.coins[i];
      for (let j = i + 1; j < state.coins.length; j++) {
        const b = state.coins[j];
        const minD = a.r + b.r - 2;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < minD && d > 0.01) {
          const ov = (minD - d) * 0.55;
          const nx = dx / d;
          const ny = dy / d;
          if (a.y < b.y) {
            b.x = clamp(b.x + nx * ov, 215, ARENA_WIDTH - 215);
            b.y += Math.max(0.2, ny * ov);
            if (b.ownerSlot === -1 && a.ownerSlot >= 0) b.ownerSlot = a.ownerSlot;
          } else {
            a.x = clamp(a.x - nx * ov, 215, ARENA_WIDTH - 215);
            a.y += Math.max(0.2, -ny * ov);
            if (a.ownerSlot === -1 && b.ownerSlot >= 0) a.ownerSlot = b.ownerSlot;
          }
        }
      }
    }

    // Check coins falling off front jackpot lip (y > 615)
    for (let i = state.coins.length - 1; i >= 0; i--) {
      const c = state.coins[i];
      if (c.y > 615) {
        state.coins.splice(i, 1);
        const owner =
          state.players.find((pl) => pl.slotIndex === c.ownerSlot) ??
          [...state.players].sort((a, b) => Math.abs(a.x - c.x) - Math.abs(b.x - c.x))[0];
        if (owner) {
          const pts = (c.kind === 'gem' ? 80 : c.kind === 'mega' ? 60 : 15) * mult;
          owner.score += pts;
          if (c.kind === 'gem') {
            owner.jackpots += 1;
            state.banner = `💎 ${owner.name} SCORED A RUBY GEM (+${pts})!`;
            sounds.push({ type: 'win', playerId: owner.id });
          } else {
            sounds.push({ type: 'score', playerId: owner.id });
          }
        }
      }
    }

    // Keep table stocked with gems
    if (state.coins.filter((c) => c.kind === 'gem').length < 4) {
      state.coins.push({
        id: `cd_${state.cSeq++}`,
        x: 280 + Math.random() * 640,
        y: 340 + Math.random() * 140,
        r: 18,
        kind: 'gem',
        ownerSlot: -1,
      });
    }
    if (state.coins.length > 95) state.coins.splice(0, state.coins.length - 95);

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'coin-dozer',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      pusherY: state.pusherY,
      coins: state.coins,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        tokens: p.tokens,
        megaReady: p.megaCd <= 0,
        jackpots: p.jackpots,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.24, 0, 1),
        cooldownB: clamp(p.megaCd / 6.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.jackpots} Gems · ${Math.round(p.score)} pts`);
  },
};
