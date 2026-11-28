import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/shared/types.ts';
import type {
  ArcheryWindSnapshot,
  BadmintonSmashSnapshot,
  BilliardsSnookerSnapshot,
  BoxingKoSnapshot,
  CanoeSprintSnapshot,
  DiscArenaSnapshot,
  DodgeballRiotSnapshot,
  HomeRunDerbySnapshot,
  HoopBlitzSnapshot,
  MiniGolfProSnapshot,
  PenaltyDuelSnapshot,
  PingPongProSnapshot,
  SumoClashSnapshot,
  TetherJoustSnapshot,
} from '../../src/shared/packSportsPhysicsTypes.ts';
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

function decayPopups(popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[], dt: number) {
  for (let i = popups.length - 1; i >= 0; i--) {
    popups[i].y -= 28 * dt;
    popups[i].alpha -= dt * 1.15;
    if (popups[i].alpha <= 0) popups.splice(i, 1);
  }
}

// ============================================================================
// 1. HOOP BLITZ (Basketball 3PT Shootout)
// ============================================================================
interface HoopState {
  timeLeft: number;
  totalTime: number;
  hoopX: number;
  hoopY: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    aimAngle: number;
    charging: boolean;
    power: number;
    powerDir: number;
    moneyReady: boolean;
    streak: number;
    made: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  balls: { x: number; y: number; vx: number; vy: number; ownerId: string; colorHex: string; moneyBall: boolean; scored: boolean }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  banner: string | null;
}

export const hoopBlitzModule: CompactGameModule<HoopState, HoopBlitzSnapshot> = {
  id: 'hoop-blitz',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      hoopX: ARENA_WIDTH / 2,
      hoopY: 165,
      players: players.map((p, i) => {
        const x = 180 + ((i + 0.5) / count) * (ARENA_WIDTH - 360);
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x,
          aimAngle: Math.atan2(165 - 610, ARENA_WIDTH / 2 - x),
          charging: false,
          power: 0.55,
          powerDir: 1,
          moneyReady: false,
          streak: 0,
          made: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      balls: [],
      popups: [],
      banner: 'HOLD A TO CHARGE — HIT THE SWEET SPOT!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.hoopX = ARENA_WIDTH / 2 + Math.sin((state.totalTime - state.timeLeft) * 0.65) * (frenzy ? 220 : 120);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.x = clamp(p.x + mx * 260 * dt, 110, ARENA_WIDTH - 110);
      const baseAngle = Math.atan2(state.hoopY - 610, state.hoopX - p.x);
      p.aimAngle = baseAngle + mx * 0.14 - my * 0.1;

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 4.0;
        p.moneyReady = true;
        p.x = clamp(ARENA_WIDTH / 2 + (Math.random() - 0.5) * 460, 140, ARENA_WIDTH - 140);
        sounds.push({ type: 'dash', playerId: p.id });
      }

      if (aDown && p.cdA <= 0) {
        p.charging = true;
        p.power += p.powerDir * dt * 1.45;
        if (p.power >= 1) {
          p.power = 1;
          p.powerDir = -1;
        } else if (p.power <= 0.15) {
          p.power = 0.15;
          p.powerDir = 1;
        }
      } else if (!aDown && p.charging) {
        p.charging = false;
        p.cdA = 0.7;
        const speed = 780 + p.power * 340;
        const toHoopDist = dist(p.x, 600, state.hoopX, state.hoopY);
        const flightT = toHoopDist / speed;
        const dx = state.hoopX - p.x;
        const dy = state.hoopY - 600;
        const g = 740;
        const aimBias = (p.power - 0.72) * 260;
        const vx = dx / Math.max(0.32, flightT);
        const vy = (dy - 0.5 * g * flightT * flightT) / Math.max(0.32, flightT) - aimBias;
        const isMoney = frenzy || p.moneyReady || p.streak >= 2;
        p.moneyReady = false;
        state.balls.push({
          x: p.x,
          y: 590,
          vx,
          vy,
          ownerId: p.id,
          colorHex: p.colorHex,
          moneyBall: isMoney,
          scored: false,
        });
        sounds.push({ type: 'shoot', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i];
      b.x += b.vx * dt;
      b.vy += 740 * dt;
      b.y += b.vy * dt;
      const hoopDist = dist(b.x, b.y, state.hoopX, state.hoopY);
      if (!b.scored && b.vy > 0 && hoopDist < 44) {
        b.scored = true;
        const owner = state.players.find((pl) => pl.id === b.ownerId);
        if (owner) {
          owner.made += 1;
          owner.streak += 1;
          const perfectSwish = hoopDist < 19;
          const pts =
            (b.moneyBall ? 160 : 100) +
            Math.min(6, owner.streak - 1) * 30 +
            (perfectSwish ? 30 : 0);
          owner.score += pts * mult;
          state.popups.push({
            x: state.hoopX,
            y: state.hoopY - 25,
            text: `${perfectSwish ? 'PERFECT ' : b.moneyBall ? 'MONEY ' : 'SWISH '}+${pts * mult}!`,
            colorHex: perfectSwish ? '#10D98B' : b.moneyBall ? '#FACC15' : owner.colorHex,
            alpha: 1,
          });
          state.banner = owner.streak >= 3 ? `${owner.name} ON FIRE (${owner.streak}×)!` : `${owner.name} SWISH!`;
          sounds.push({ type: 'score', playerId: owner.id });
        }
      }
      if (b.y > ARENA_HEIGHT + 50 || b.x < -60 || b.x > ARENA_WIDTH + 60) {
        if (!b.scored) {
          const owner = state.players.find((pl) => pl.id === b.ownerId);
          if (owner) owner.streak = 0;
        }
        state.balls.splice(i, 1);
      }
    }

    decayPopups(state.popups, dt);
    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'hoop-blitz',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      hoopX: state.hoopX,
      hoopY: state.hoopY,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        aimAngle: p.aimAngle,
        charging: p.charging,
        power: p.power,
        streak: p.streak,
        made: p.made,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.7, 0, 1),
        cooldownB: clamp(p.cdB / 4.0, 0, 1),
      })),
      balls: state.balls.map((b) => ({
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        colorHex: b.colorHex,
        moneyBall: b.moneyBall,
      })),
      popups: state.popups,
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.made} buckets · ${p.score} pts`);
  },
};

// ============================================================================
// 2. PENALTY DUEL (Soccer Showdown)
// ============================================================================
interface PenaltyState {
  timeLeft: number;
  totalTime: number;
  round: number;
  goalX: number;
  goalY: number;
  goalW: number;
  keeperX: number;
  keeperDir: number;
  keeperDive: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    aimX: number;
    power: number;
    charging: boolean;
    goals: number;
    saves: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  shots: { x: number; y: number; vx: number; vy: number; curve: number; ownerId: string; colorHex: string; active: boolean }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  banner: string | null;
}

export const penaltyDuelModule: CompactGameModule<PenaltyState, PenaltyDuelSnapshot> = {
  id: 'penalty-duel',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      round: 1,
      goalX: ARENA_WIDTH / 2,
      goalY: 180,
      goalW: 540,
      keeperX: ARENA_WIDTH / 2,
      keeperDir: 1,
      keeperDive: 0,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: ARENA_WIDTH / 2 + (i % 2 === 0 ? -120 : 120),
        power: 0.75,
        charging: false,
        goals: 0,
        saves: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      shots: [],
      popups: [],
      banner: 'AIM TOP CORNERS & STRIKE PAST THE KEEPER!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    const minKX = state.goalX - state.goalW / 2 + 65;
    const maxKX = state.goalX + state.goalW / 2 - 65;
    const keeperSpeed = frenzy ? 340 : 275;
    state.keeperX += state.keeperDir * keeperSpeed * dt;
    if (state.keeperX > maxKX) {
      state.keeperX = maxKX;
      state.keeperDir = -1;
    } else if (state.keeperX < minKX) {
      state.keeperX = minKX;
      state.keeperDir = 1;
    }
    state.keeperDive = Math.sin((state.totalTime - state.timeLeft) * 3.8) * 0.4;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.aimX = clamp(p.aimX + mx * 470 * dt, state.goalX - state.goalW / 2 + 24, state.goalX + state.goalW / 2 - 24);
      p.power = clamp(p.power - my * 0.5 * dt, 0.4, 1);

      const fireShot = (curved: boolean) => {
        const startX = ARENA_WIDTH / 2 + ((p.slotIndex % 4) - 1.5) * 90;
        const startY = 610;
        const dx = p.aimX - startX;
        const dy = state.goalY - startY;
        const len = Math.hypot(dx, dy) || 1;
        const spd = curved ? 820 : 940;
        state.shots.push({
          x: startX,
          y: startY,
          vx: (dx / len) * spd,
          vy: (dy / len) * spd,
          curve: curved ? (p.aimX >= state.goalX ? -480 : 480) : 0,
          ownerId: p.id,
          colorHex: p.colorHex,
          active: true,
        });
        sounds.push({ type: 'shoot', playerId: p.id });
      };

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.cdA = 1.05;
        fireShot(false);
      } else if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 1.85;
        fireShot(true);
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    for (let i = state.shots.length - 1; i >= 0; i--) {
      const s = state.shots[i];
      s.vx += s.curve * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (s.active && s.y <= state.goalY + 26) {
        s.active = false;
        const owner = state.players.find((pl) => pl.id === s.ownerId);
        const blocked = Math.abs(s.x - state.keeperX) < 62;
        const inGoal = Math.abs(s.x - state.goalX) <= state.goalW / 2;
        if (!blocked && inGoal && owner) {
          const corner = Math.abs(s.x - state.goalX) > state.goalW * 0.34;
          const pts = (corner ? 140 : 100) * mult;
          owner.goals += 1;
          owner.score += pts;
          state.round += 1;
          state.popups.push({
            x: s.x,
            y: state.goalY - 12,
            text: `${corner ? 'TOP BIN ' : 'GOAL '}+${pts}!`,
            colorHex: owner.colorHex,
            alpha: 1,
          });
          state.banner = `${owner.name} SCORES!`;
          sounds.push({ type: 'score', playerId: owner.id });
        } else {
          if (owner) owner.saves += 1;
          state.popups.push({
            x: s.x,
            y: state.goalY + 10,
            text: blocked ? 'SAVED!' : 'WIDE!',
            colorHex: '#EF4444',
            alpha: 1,
          });
          sounds.push({ type: 'hit' });
        }
        state.shots.splice(i, 1);
      } else if (s.y < -40 || s.x < 0 || s.x > ARENA_WIDTH) {
        state.shots.splice(i, 1);
      }
    }

    decayPopups(state.popups, dt);
    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'penalty-duel',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      goalX: state.goalX,
      goalY: state.goalY,
      goalW: state.goalW,
      keeperX: state.keeperX,
      keeperDive: state.keeperDive,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: p.aimX,
        power: p.power,
        charging: p.charging,
        goals: p.goals,
        saves: p.saves,
        score: p.score,
        cooldownA: clamp(p.cdA / 1.05, 0, 1),
        cooldownB: clamp(p.cdB / 1.85, 0, 1),
      })),
      shots: state.shots.map((s) => ({
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        colorHex: s.colorHex,
        active: s.active,
      })),
      popups: state.popups,
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.goals} goals · ${p.score} pts`);
  },
};

// ============================================================================
// 3. MINI GOLF PRO (Top-Down Physics Golf)
// ============================================================================
interface MiniGolfState {
  timeLeft: number;
  totalTime: number;
  holeIndex: number;
  resetTimer: number;
  cupX: number;
  cupY: number;
  walls: { x: number; y: number; w: number; h: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    aimAngle: number;
    power: number;
    powerDir: number;
    charging: boolean;
    sunk: boolean;
    strokes: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
    lastShootRelease: number;
  }[];
  banner: string | null;
}

function buildGolfHole(index: number) {
  const layouts = [
    {
      cupX: 980,
      cupY: 360,
      walls: [
        { x: 480, y: 160, w: 34, h: 210 },
        { x: 710, y: 350, w: 34, h: 210 },
      ],
    },
    {
      cupX: 960,
      cupY: 210,
      walls: [
        { x: 430, y: 260, w: 320, h: 32 },
        { x: 760, y: 340, w: 32, h: 220 },
      ],
    },
    {
      cupX: 990,
      cupY: 500,
      walls: [
        { x: 380, y: 150, w: 32, h: 240 },
        { x: 600, y: 310, w: 32, h: 260 },
        { x: 800, y: 150, w: 32, h: 240 },
      ],
    },
  ];
  return layouts[index % layouts.length];
}

export const miniGolfProModule: CompactGameModule<MiniGolfState, MiniGolfProSnapshot> = {
  id: 'mini-golf-pro',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const hole = buildGolfHole(0);
    return {
      timeLeft: totalTime,
      totalTime,
      holeIndex: 1,
      resetTimer: 0,
      cupX: hole.cupX,
      cupY: hole.cupY,
      walls: hole.walls,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 195,
        y: 230 + (i % 4) * 80,
        vx: 0,
        vy: 0,
        aimAngle: 0,
        power: 0.6,
        powerDir: 1,
        charging: false,
        sunk: false,
        strokes: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
        lastShootRelease: 0,
      })),
      banner: 'HOLE 1 — BANK OFF WALLS TO SINK THE CUP!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      if (p.sunk) continue;

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      const hasDirectAim = typeof inp?.aimAngle === 'number' && Number.isFinite(inp.aimAngle);
      const hasDirectPower = typeof inp?.shootPower === 'number' && Number.isFinite(inp.shootPower);
      const releaseSeq =
        typeof inp?.shootRelease === 'number' && Number.isFinite(inp.shootRelease)
          ? inp.shootRelease
          : 0;

      if (hasDirectAim) {
        p.aimAngle = inp!.aimAngle!;
      } else {
        const mag = Math.hypot(mx, my);
        if (mag > 0.34) {
          const targetAngle = Math.atan2(my, mx);
          const diff = Math.atan2(
            Math.sin(targetAngle - p.aimAngle),
            Math.cos(targetAngle - p.aimAngle)
          );
          const push = clamp((mag - 0.34) / 0.66, 0, 1);
          const maxStep = (1.6 + push * 5.2) * dt;
          p.aimAngle += clamp(diff, -maxStep, maxStep);
        }
      }

      const moving = Math.hypot(p.vx, p.vy) > 28;
      if (!moving) {
        if (releaseSeq > p.lastShootRelease && p.cdA <= 0) {
          p.lastShootRelease = releaseSeq;
          p.charging = false;
          const pwr = clamp(hasDirectPower ? inp!.shootPower! : p.power, 0.08, 1);
          p.power = pwr;
          const spd = 200 + pwr * 720;
          p.vx = Math.cos(p.aimAngle) * spd;
          p.vy = Math.sin(p.aimAngle) * spd;
          p.strokes += 1;
          p.cdA = 0.4;
          sounds.push({ type: 'hit', playerId: p.id });
        } else if (hasDirectPower && inp!.shootPower! > 0.02 && !aDown) {
          p.power = clamp(inp!.shootPower!, 0.08, 1);
          p.charging = true;
        } else if (aDown && p.cdA <= 0) {
          p.charging = true;
          p.power += p.powerDir * dt * 1.2;
          if (p.power >= 1) {
            p.power = 1;
            p.powerDir = -1;
          } else if (p.power <= 0.15) {
            p.power = 0.15;
            p.powerDir = 1;
          }
        } else if (!aDown && p.charging && !hasDirectPower) {
          p.charging = false;
          const spd = 280 + p.power * 640;
          p.vx = Math.cos(p.aimAngle) * spd;
          p.vy = Math.sin(p.aimAngle) * spd;
          p.strokes += 1;
          p.cdA = 0.45;
          sounds.push({ type: 'hit', playerId: p.id });
        } else if (bDown && !p.prevB && p.cdB <= 0) {
          p.vx = Math.cos(p.aimAngle) * 320;
          p.vy = Math.sin(p.aimAngle) * 320;
          p.strokes += 1;
          p.cdB = 0.5;
          sounds.push({ type: 'hit', playerId: p.id });
        } else if (!hasDirectPower && !aDown) {
          p.charging = false;
        }
      } else {
        p.charging = false;
        if (releaseSeq > p.lastShootRelease) {
          p.lastShootRelease = releaseSeq;
        }
      }
      p.prevA = aDown;
      p.prevB = bDown;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const friction = Math.pow(0.28, dt);
      p.vx *= friction;
      p.vy *= friction;
      if (Math.hypot(p.vx, p.vy) < 12) {
        p.vx = 0;
        p.vy = 0;
      }

      // Course walls
      if (p.x < 105) {
        p.x = 105;
        p.vx = Math.abs(p.vx) * 0.85;
      } else if (p.x > ARENA_WIDTH - 105) {
        p.x = ARENA_WIDTH - 105;
        p.vx = -Math.abs(p.vx) * 0.85;
      }
      if (p.y < 125) {
        p.y = 125;
        p.vy = Math.abs(p.vy) * 0.85;
      } else if (p.y > ARENA_HEIGHT - 85) {
        p.y = ARENA_HEIGHT - 85;
        p.vy = -Math.abs(p.vy) * 0.85;
      }

      for (const w of state.walls) {
        const cx = clamp(p.x, w.x, w.x + w.w);
        const cy = clamp(p.y, w.y, w.y + w.h);
        const dx = p.x - cx;
        const dy = p.y - cy;
        if (Math.hypot(dx, dy) < 14) {
          if (Math.abs(dx) > Math.abs(dy)) {
            p.vx = Math.sign(dx || 1) * Math.max(90, Math.abs(p.vx) * 0.82);
            p.x = cx + Math.sign(dx || 1) * 15;
          } else {
            p.vy = Math.sign(dy || 1) * Math.max(90, Math.abs(p.vy) * 0.82);
            p.y = cy + Math.sign(dy || 1) * 15;
          }
        }
      }

      if (dist(p.x, p.y, state.cupX, state.cupY) < 25 && Math.hypot(p.vx, p.vy) < 480) {
        p.sunk = true;
        p.vx = 0;
        p.vy = 0;
        const parBonus = Math.max(60, 220 - (p.strokes - 1) * 40) * mult;
        p.score += parBonus;
        state.banner = `${p.name} SUNK HOLE ${state.holeIndex}! +${parBonus}`;
        sounds.push({ type: 'score', playerId: p.id });
      }
    }

    if (state.players.every((p) => p.sunk)) {
      state.resetTimer += dt;
      if (state.resetTimer >= 1.1) {
        state.resetTimer = 0;
        state.holeIndex += 1;
        const nextHole = buildGolfHole(state.holeIndex - 1);
        state.cupX = nextHole.cupX;
        state.cupY = nextHole.cupY;
        state.walls = nextHole.walls;
        state.players.forEach((p, i) => {
          p.x = 195;
          p.y = 230 + (i % 4) * 80;
          p.vx = 0;
          p.vy = 0;
          p.sunk = false;
          p.strokes = 0;
        });
        state.banner = `HOLE ${state.holeIndex} — TEE OFF!`;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'mini-golf-pro',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      holeIndex: state.holeIndex,
      cupX: state.cupX,
      cupY: state.cupY,
      walls: state.walls,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        aimAngle: p.aimAngle,
        power: p.power,
        charging: p.charging,
        sunk: p.sunk,
        strokes: p.strokes,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.45, 0, 1),
        cooldownB: clamp(p.cdB / 0.5, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.score} pts · Hole ${state.holeIndex}`);
  },
};

// ============================================================================
// 4. ARCHERY WIND (Wind Archery)
// ============================================================================
interface ArcheryState {
  timeLeft: number;
  totalTime: number;
  windX: number;
  windY: number;
  windTimer: number;
  targetX: number;
  targetY: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    aimX: number;
    aimY: number;
    drawing: boolean;
    drawPct: number;
    steadyTimer: number;
    lastRing: number;
    score: number;
    cdA: number;
    cdB: number;
    prevB: boolean;
  }[];
  arrows: { x: number; y: number; z: number; colorHex: string }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  banner: string | null;
}

export const archeryWindModule: CompactGameModule<ArcheryState, ArcheryWindSnapshot> = {
  id: 'archery-wind',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      windX: 45,
      windY: -18,
      windTimer: 7,
      targetX: ARENA_WIDTH / 2,
      targetY: 360,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: ARENA_WIDTH / 2 + ((i % 4) - 1.5) * 40,
        aimY: 360,
        drawing: false,
        drawPct: 0,
        steadyTimer: 0,
        lastRing: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevB: false,
      })),
      arrows: [],
      popups: [],
      banner: 'AIM UPWIND & RELEASE (A) FOR 100-PT BULLSEYES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.windTimer -= dt;
    if (state.windTimer <= 0) {
      state.windTimer = 6.5;
      const ang = Math.random() * Math.PI * 2;
      const spd = frenzy ? 15 : 42 + Math.random() * 55;
      state.windX = Math.cos(ang) * spd;
      state.windY = Math.sin(ang) * spd;
    }

    const t = state.totalTime - state.timeLeft;
    state.targetX = ARENA_WIDTH / 2 + Math.sin(t * 0.7) * 90;
    state.targetY = 360 + Math.cos(t * 0.55) * 45;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.steadyTimer = Math.max(0, p.steadyTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      const sway = p.steadyTimer > 0 ? 0.25 : 1;
      p.aimX = clamp(p.aimX + mx * 360 * dt + Math.sin(t * 3 + p.slotIndex) * 26 * sway * dt, 240, ARENA_WIDTH - 240);
      p.aimY = clamp(p.aimY + my * 360 * dt + Math.cos(t * 2.5 + p.slotIndex) * 26 * sway * dt, 130, ARENA_HEIGHT - 120);

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.steadyTimer = 2.6;
        p.cdB = 4.5;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevB = bDown;

      if (aDown && p.cdA <= 0) {
        p.drawing = true;
        p.drawPct = clamp(p.drawPct + dt * 1.4, 0, 1);
      } else if (!aDown && p.drawing) {
        p.drawing = false;
        p.cdA = 0.85;
        const driftScale = p.steadyTimer > 0 ? 0.35 : 0.72;
        const hitX = p.aimX + state.windX * driftScale;
        const hitY = p.aimY + state.windY * driftScale;
        const d = dist(hitX, hitY, state.targetX, state.targetY);
        let pts = 0;
        let ring = 0;
        if (d < 26) {
          pts = 100;
          ring = 10;
        } else if (d < 56) {
          pts = 75;
          ring = 8;
        } else if (d < 92) {
          pts = 50;
          ring = 6;
        } else if (d < 135) {
          pts = 25;
          ring = 4;
        }
        p.lastRing = ring;
        const bonus = Math.round(pts * (0.65 + p.drawPct * 0.55) * mult);
        p.score += bonus;
        p.drawPct = 0;
        state.arrows.push({ x: hitX, y: hitY, z: 0, colorHex: p.colorHex });
        if (state.arrows.length > 24) state.arrows.shift();
        if (bonus > 0) {
          state.popups.push({
            x: hitX,
            y: hitY - 18,
            text: ring === 10 ? `BULLSEYE +${bonus}!` : `+${bonus}`,
            colorHex: ring === 10 ? '#FACC15' : p.colorHex,
            alpha: 1,
          });
          if (ring === 10) state.banner = `${p.name} HIT GOLD BULLSEYE!`;
          sounds.push({ type: 'score', playerId: p.id });
        } else {
          sounds.push({ type: 'hit' });
        }
      }
    }

    decayPopups(state.popups, dt);
    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'archery-wind',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      windX: state.windX,
      windY: state.windY,
      targetX: state.targetX,
      targetY: state.targetY,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: p.aimX,
        aimY: p.aimY,
        drawing: p.drawing,
        drawPct: p.drawPct,
        lastRing: p.lastRing,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.85, 0, 1),
        cooldownB: clamp(p.cdB / 4.5, 0, 1),
      })),
      arrows: state.arrows,
      popups: state.popups,
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `Best Ring ${p.lastRing || '-'} · ${p.score} pts`);
  },
};

// ============================================================================
// 5. BOXING KO (Ring Blitz)
// ============================================================================
interface BoxingState {
  timeLeft: number;
  totalTime: number;
  players: {
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
    stamina: number;
    guarding: boolean;
    punchTimer: number;
    stunTimer: number;
    respawnTimer: number;
    kos: number;
    alive: boolean;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
  }[];
  impacts: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  banner: string | null;
}

export const boxingKoModule: CompactGameModule<BoxingState, BoxingKoSnapshot> = {
  id: 'boxing-ko',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 190,
          y: 375 + Math.sin(ang) * 130,
          vx: 0,
          vy: 0,
          angle: ang + Math.PI,
          hp: 100,
          maxHp: 100,
          stamina: 100,
          guarding: false,
          punchTimer: 0,
          stunTimer: 0,
          respawnTimer: 0,
          kos: 0,
          alive: true,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
        };
      }),
      impacts: [],
      banner: 'GUARD COUNTER-HOOKS TO SCORE KNOCKOUTS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.punchTimer = Math.max(0, p.punchTimer - dt);
      p.stunTimer = Math.max(0, p.stunTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.hp = p.maxHp;
          p.x = ARENA_WIDTH / 2 + (Math.random() - 0.5) * 320;
          p.y = 375 + (Math.random() - 0.5) * 200;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.guarding = bDown && p.stamina > 8 && p.stunTimer <= 0;
      if (p.guarding) p.stamina = Math.max(0, p.stamina - 28 * dt);
      else p.stamina = Math.min(100, p.stamina + (frenzy ? 45 : 22) * dt);

      if (p.stunTimer <= 0 && Math.hypot(mx, my) > 0.16) {
        p.angle = Math.atan2(my, mx);
        const spd = p.guarding ? 165 : 275;
        p.vx += mx * spd * 4 * dt;
        p.vy += my * spd * 4 * dt;
      }

      if (aDown && !p.prevA && p.cdA <= 0 && p.stunTimer <= 0 && !p.guarding) {
        p.punchTimer = 0.24;
        p.cdA = frenzy ? 0.28 : 0.42;
        p.vx += Math.cos(p.angle) * 260;
        p.vy += Math.sin(p.angle) * 260;
        sounds.push({ type: 'dash', playerId: p.id });

        for (const r of state.players) {
          if (r.id === p.id || !r.alive) continue;
          const px = p.x + Math.cos(p.angle) * 44;
          const py = p.y + Math.sin(p.angle) * 44;
          if (dist(px, py, r.x, r.y) < 58) {
            if (r.guarding) {
              p.stunTimer = 0.45;
              r.score += 20 * mult;
              state.impacts.push({ x: r.x, y: r.y - 30, text: 'BLOCKED!', colorHex: '#38BDF8', alpha: 1 });
              sounds.push({ type: 'hit', playerId: r.id });
            } else {
              const dmg = frenzy ? 34 : 26;
              r.hp = Math.max(0, r.hp - dmg);
              r.vx += Math.cos(p.angle) * 380;
              r.vy += Math.sin(p.angle) * 380;
              p.score += 35 * mult;
              state.impacts.push({ x: r.x, y: r.y - 24, text: `POW -${dmg}!`, colorHex: p.colorHex, alpha: 1 });
              sounds.push({ type: 'hit', playerId: p.id });
              if (r.hp <= 0) {
                r.alive = false;
                r.respawnTimer = 2.0;
                p.kos += 1;
                p.score += 150 * mult;
                state.banner = `${p.name} KNOCKED OUT ${r.name}!`;
                state.impacts.push({ x: r.x, y: r.y - 45, text: 'KO +150!', colorHex: '#FACC15', alpha: 1 });
                sounds.push({ type: 'elim', playerId: p.id });
              }
            }
          }
        }
      }
      p.prevA = aDown;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.06, dt);
      p.vy *= Math.pow(0.06, dt);
      p.x = clamp(p.x, 220, ARENA_WIDTH - 220);
      p.y = clamp(p.y, 145, ARENA_HEIGHT - 105);
    }

    decayPopups(state.impacts, dt);
    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'boxing-ko',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        hp: p.hp,
        maxHp: p.maxHp,
        stamina: p.stamina,
        guarding: p.guarding,
        punchTimer: p.punchTimer,
        stunTimer: p.stunTimer,
        kos: p.kos,
        alive: p.alive,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.42, 0, 1),
        cooldownB: clamp(1 - p.stamina / 100, 0, 1),
      })),
      impacts: state.impacts,
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.kos} KOs · ${p.score} pts`);
  },
};

// ============================================================================
// 6. PING PONG PRO (Spin Pong)
// ============================================================================
interface PingPongState {
  timeLeft: number;
  totalTime: number;
  balls: { x: number; y: number; vx: number; vy: number; spin: number; smash: boolean; lastId: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    side: 'top' | 'bottom' | 'left' | 'right';
    x: number;
    y: number;
    swingTimer: number;
    spinCharge: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const pingPongProModule: CompactGameModule<PingPongState, PingPongProSnapshot> = {
  id: 'ping-pong-pro',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const sides: ('left' | 'right' | 'top' | 'bottom')[] = ['left', 'right', 'top', 'bottom'];
    return {
      timeLeft: totalTime,
      totalTime,
      balls: [
        { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: 380, vy: 190, spin: 0, smash: false, lastId: null },
      ],
      players: players.map((p, i) => {
        const side = sides[i % sides.length];
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          side,
          x: side === 'left' ? 190 : side === 'right' ? ARENA_WIDTH - 190 : ARENA_WIDTH / 2,
          y: side === 'top' ? 130 : side === 'bottom' ? ARENA_HEIGHT - 110 : ARENA_HEIGHT / 2,
          swingTimer: 0,
          spinCharge: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'PRESS A FOR SMASH · B FOR CURVE SPIN!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    const minX = 160;
    const maxX = ARENA_WIDTH - 160;
    const minY = 105;
    const maxY = ARENA_HEIGHT - 85;

    if (frenzy && state.balls.length < 2) {
      state.balls.push({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: -400, vy: -220, spin: 80, smash: true, lastId: null });
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.swingTimer = Math.max(0, p.swingTimer - dt);
      p.spinCharge = Math.max(0, p.spinCharge - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (
        typeof inp?.targetX === 'number' &&
        Number.isFinite(inp.targetX) &&
        typeof inp?.targetY === 'number' &&
        Number.isFinite(inp.targetY)
      ) {
        const follow = Math.min(1, 42 * dt);
        if (p.side === 'left' || p.side === 'right') {
          const ty = clamp(inp.targetY, minY + 45, maxY - 45);
          p.y = clamp(p.y + (ty - p.y) * follow, minY + 45, maxY - 45);
        } else {
          const tx = clamp(inp.targetX, minX + 60, maxX - 60);
          p.x = clamp(p.x + (tx - p.x) * follow, minX + 60, maxX - 60);
        }
      } else if (p.side === 'left' || p.side === 'right') {
        p.y = clamp(p.y + my * 480 * dt, minY + 45, maxY - 45);
      } else {
        p.x = clamp(p.x + mx * 540 * dt, minX + 60, maxX - 60);
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.swingTimer = 0.25;
        p.cdA = 0.45;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.spinCharge = 0.8;
        p.swingTimer = 0.25;
        p.cdB = 0.9;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    const soloOrMissingSides = new Set(state.players.map((p) => p.side));
    for (const b of state.balls) {
      b.vy += b.spin * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // Bounce off undefended edges
      if (b.y < minY && !soloOrMissingSides.has('top')) {
        b.y = minY;
        b.vy = Math.abs(b.vy);
      }
      if (b.y > maxY && !soloOrMissingSides.has('bottom')) {
        b.y = maxY;
        b.vy = -Math.abs(b.vy);
      }
      if (b.x < minX && !soloOrMissingSides.has('left')) {
        b.x = minX;
        b.vx = Math.abs(b.vx);
      }
      if (b.x > maxX && !soloOrMissingSides.has('right')) {
        b.x = maxX;
        b.vx = -Math.abs(b.vx);
      }

      // Paddle collisions
      for (const p of state.players) {
        if (dist(b.x, b.y, p.x, p.y) < 62) {
          const boost = p.swingTimer > 0 ? 1.24 : 1.04;
          b.smash = p.swingTimer > 0;
          b.spin = p.spinCharge > 0 ? (Math.random() < 0.5 ? 240 : -240) : b.spin * 0.4;
          if (p.side === 'left') b.vx = Math.min(840, Math.abs(b.vx) * boost + 60);
          else if (p.side === 'right') b.vx = -Math.min(840, Math.abs(b.vx) * boost + 60);
          else if (p.side === 'top') b.vy = Math.min(760, Math.abs(b.vy) * boost + 60);
          else b.vy = -Math.min(760, Math.abs(b.vy) * boost + 60);
          b.lastId = p.id;
          p.score += (b.smash ? 25 : 15) * mult;
          sounds.push({ type: 'hit', playerId: p.id });
        }
      }

      // Missed goal check
      if (b.x < minX - 18 || b.x > maxX + 18 || b.y < minY - 18 || b.y > maxY + 18) {
        const scorer = state.players.find((p) => p.id === b.lastId);
        if (scorer) {
          scorer.score += 80 * mult;
          state.banner = `${scorer.name} WINS THE RALLY! +${80 * mult}`;
          sounds.push({ type: 'score', playerId: scorer.id });
        }
        b.x = ARENA_WIDTH / 2;
        b.y = ARENA_HEIGHT / 2;
        const ang = (Math.random() < 0.5 ? 0 : Math.PI) + (Math.random() - 0.5) * 0.7;
        b.vx = Math.cos(ang) * 410;
        b.vy = Math.sin(ang) * 320;
        b.spin = 0;
        b.smash = false;
        b.lastId = null;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'ping-pong-pro',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      balls: state.balls,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        side: p.side,
        x: p.x,
        y: p.y,
        swingTimer: p.swingTimer,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.45, 0, 1),
        cooldownB: clamp(p.cdB / 0.9, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.score} pts`);
  },
};

// ============================================================================
// 7. HOME RUN DERBY (Slugger Derby)
// ============================================================================
interface HomeRunState {
  timeLeft: number;
  totalTime: number;
  pitchSpawnTimer: number;
  pitches: { id: string; y: number; speed: number; curve: number; active: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    laneX: number;
    swingTimer: number;
    powerTimer: number;
    homeruns: number;
    combo: number;
    lastHitDist: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  hitBalls: { x: number; y: number; vx: number; vy: number; colorHex: string }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  banner: string | null;
}

export const homeRunDerbyModule: CompactGameModule<HomeRunState, HomeRunDerbySnapshot> = {
  id: 'home-run-derby',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      pitchSpawnTimer: 0.7,
      pitches: [{ id: 'pitch-0', y: 260, speed: 340, curve: 0, active: true }],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        laneX: 160 + ((i + 0.5) / count) * (ARENA_WIDTH - 320),
        swingTimer: 0,
        powerTimer: 0,
        homeruns: 0,
        combo: 0,
        lastHitDist: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      hitBalls: [],
      popups: [],
      banner: 'SWING (A) WHEN THE BALL ENTERS THE PLATE RING!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.pitchSpawnTimer -= dt;
    if (state.pitchSpawnTimer <= 0) {
      state.pitchSpawnTimer = frenzy ? 1.15 : 1.55;
      state.pitches.push({
        id: `p-${Math.random().toString(36).slice(2, 7)}`,
        y: 120,
        speed: 330 + Math.random() * 140,
        curve: (Math.random() - 0.5) * 45,
        active: true,
      });
    }

    for (let i = state.pitches.length - 1; i >= 0; i--) {
      const pt = state.pitches[i];
      pt.y += pt.speed * dt;
      if (pt.y > ARENA_HEIGHT + 30) {
        state.pitches.splice(i, 1);
      }
    }

    const plateY = 560;
    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.swingTimer = Math.max(0, p.swingTimer - dt);
      p.powerTimer = Math.max(0, p.powerTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.laneX = clamp(p.laneX + mx * 190 * dt, 100, ARENA_WIDTH - 100);

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.powerTimer = 3.2;
        p.cdB = 4.2;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.swingTimer = 0.24;
        p.cdA = 0.42;
        const strike = state.pitches.find((pt) => pt.active && Math.abs(pt.y - plateY) < 62);
        if (strike) {
          const precision = 1 - Math.abs(strike.y - plateY) / 62;
          const isHR = precision > 0.42 || p.powerTimer > 0;
          p.combo += 1;
          const distFt = Math.round(290 + precision * 175 + (p.powerTimer > 0 ? 45 : 0));
          p.lastHitDist = distFt;
          if (isHR) p.homeruns += 1;
          const pts = Math.round((isHR ? 130 : 65) * (1 + Math.min(3, p.combo - 1) * 0.25) * mult);
          p.score += pts;
          state.hitBalls.push({
            x: p.laneX,
            y: plateY,
            vx: (Math.random() - 0.5) * 260,
            vy: -680 - precision * 260,
            colorHex: p.colorHex,
          });
          state.popups.push({
            x: p.laneX,
            y: plateY - 35,
            text: isHR ? `HOME RUN ${distFt}ft! +${pts}` : `HIT +${pts}!`,
            colorHex: isHR ? '#FACC15' : p.colorHex,
            alpha: 1,
          });
          if (isHR) state.banner = `${p.name} CRUSHED A ${distFt}FT MOONSHOT!`;
          sounds.push({ type: isHR ? 'score' : 'hit', playerId: p.id });
        } else {
          p.combo = 0;
          sounds.push({ type: 'tick' });
        }
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    for (let i = state.hitBalls.length - 1; i >= 0; i--) {
      const hb = state.hitBalls[i];
      hb.x += hb.vx * dt;
      hb.y += hb.vy * dt;
      if (hb.y < -60) state.hitBalls.splice(i, 1);
    }

    decayPopups(state.popups, dt);
    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'home-run-derby',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      pitches: state.pitches,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        laneX: p.laneX,
        swingTimer: p.swingTimer,
        homeruns: p.homeruns,
        combo: p.combo,
        lastHitDist: p.lastHitDist,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.42, 0, 1),
        cooldownB: clamp(p.cdB / 4.2, 0, 1),
      })),
      hitBalls: state.hitBalls,
      popups: state.popups,
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.homeruns} HRs · ${p.lastHitDist}ft best`);
  },
};

// ============================================================================
// 8. DODGEBALL RIOT
// ============================================================================
interface DodgeballState {
  timeLeft: number;
  totalTime: number;
  balls: { id: string; x: number; y: number; vx: number; vy: number; hot: boolean; ownerId: string | null; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    hasBall: boolean;
    catchTimer: number;
    dashTimer: number;
    respawnTimer: number;
    hp: number;
    alive: boolean;
    hits: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const dodgeballRiotModule: CompactGameModule<DodgeballState, DodgeballRiotSnapshot> = {
  id: 'dodgeball-riot',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      balls: [
        { id: 'db-1', x: ARENA_WIDTH / 2 - 140, y: 360, vx: 0, vy: 0, hot: false, ownerId: null, colorHex: '#FB7185' },
        { id: 'db-2', x: ARENA_WIDTH / 2, y: 260, vx: 0, vy: 0, hot: false, ownerId: null, colorHex: '#FACC15' },
        { id: 'db-3', x: ARENA_WIDTH / 2 + 140, y: 460, vx: 0, vy: 0, hot: false, ownerId: null, colorHex: '#38BDF8' },
      ],
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 320,
          y: 375 + Math.sin(ang) * 200,
          angle: ang + Math.PI,
          hasBall: false,
          catchTimer: 0,
          dashTimer: 0,
          respawnTimer: 0,
          hp: 3,
          alive: true,
          hits: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'GRAB DODGEBALLS — PRESS B TO CATCH HOT THROWS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    if (frenzy && state.balls.length < 5) {
      state.balls.push({
        id: `db-${Math.random().toString(36).slice(2, 6)}`,
        x: ARENA_WIDTH / 2,
        y: 360,
        vx: 0,
        vy: 0,
        hot: false,
        ownerId: null,
        colorHex: '#FB7185',
      });
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.catchTimer = Math.max(0, p.catchTimer - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.hp = 3;
          p.x = ARENA_WIDTH / 2 + (Math.random() - 0.5) * 480;
          p.y = 375 + (Math.random() - 0.5) * 260;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (Math.hypot(mx, my) > 0.16) {
        p.angle = Math.atan2(my, mx);
        const spd = p.dashTimer > 0 ? 520 : 285;
        p.x = clamp(p.x + mx * spd * dt, 90, ARENA_WIDTH - 90);
        p.y = clamp(p.y + my * spd * dt, 105, ARENA_HEIGHT - 80);
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.catchTimer = 0.4;
        p.dashTimer = 0.24;
        p.cdB = 1.6;
        sounds.push({ type: 'dash', playerId: p.id });
      }

      if (!p.hasBall) {
        const loose = state.balls.find((b) => !b.hot && dist(b.x, b.y, p.x, p.y) < 42);
        if (loose) {
          p.hasBall = true;
          loose.ownerId = p.id;
          loose.colorHex = p.colorHex;
          sounds.push({ type: 'tick', playerId: p.id });
        }
      } else if (aDown && !p.prevA && p.cdA <= 0) {
        const held = state.balls.find((b) => b.ownerId === p.id);
        if (held) {
          p.hasBall = false;
          p.cdA = 0.45;
          held.ownerId = p.id;
          held.hot = true;
          held.x = p.x + Math.cos(p.angle) * 32;
          held.y = p.y + Math.sin(p.angle) * 32;
          held.vx = Math.cos(p.angle) * 760;
          held.vy = Math.sin(p.angle) * 760;
          sounds.push({ type: 'shoot', playerId: p.id });
        }
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    for (const b of state.balls) {
      if (b.ownerId && !b.hot) {
        const owner = state.players.find((pl) => pl.id === b.ownerId && pl.alive && pl.hasBall);
        if (owner) {
          b.x = owner.x + Math.cos(owner.angle) * 26;
          b.y = owner.y + Math.sin(owner.angle) * 26;
          continue;
        }
        b.ownerId = null;
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= Math.pow(0.45, dt);
      b.vy *= Math.pow(0.45, dt);
      if (Math.hypot(b.vx, b.vy) < 180) {
        b.hot = false;
        b.ownerId = null;
      }
      if (b.x < 85 || b.x > ARENA_WIDTH - 85) {
        b.vx *= -0.82;
        b.x = clamp(b.x, 85, ARENA_WIDTH - 85);
      }
      if (b.y < 100 || b.y > ARENA_HEIGHT - 75) {
        b.vy *= -0.82;
        b.y = clamp(b.y, 100, ARENA_HEIGHT - 75);
      }

      if (b.hot) {
        for (const p of state.players) {
          if (!p.alive || p.id === b.ownerId) continue;
          if (dist(b.x, b.y, p.x, p.y) < 34) {
            if (p.catchTimer > 0 && !p.hasBall) {
              b.hot = false;
              b.vx = 0;
              b.vy = 0;
              b.ownerId = p.id;
              b.colorHex = p.colorHex;
              p.hasBall = true;
              p.score += 75 * mult;
              state.banner = `${p.name} CAUGHT A BLAZING BALL!`;
              sounds.push({ type: 'score', playerId: p.id });
            } else {
              const thrower = state.players.find((pl) => pl.id === b.ownerId);
              if (thrower) {
                thrower.hits += 1;
                thrower.score += 100 * mult;
                state.banner = `${thrower.name} BLASTED ${p.name}!`;
                sounds.push({ type: 'score', playerId: thrower.id });
              }
              p.hp -= 1;
              b.hot = false;
              b.vx *= -0.3;
              b.vy *= -0.3;
              b.ownerId = null;
              if (p.hp <= 0) {
                p.alive = false;
                p.respawnTimer = 2.0;
                sounds.push({ type: 'elim' });
              }
            }
            break;
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'dodgeball-riot',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      balls: state.balls,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        hasBall: p.hasBall,
        catchTimer: p.catchTimer,
        dashTimer: p.dashTimer,
        hp: p.hp,
        alive: p.alive,
        hits: p.hits,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.45, 0, 1),
        cooldownB: clamp(p.cdB / 1.6, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.hits} hits · ${p.score} pts`);
  },
};

// ============================================================================
// 9. SUMO CLASH (Dohyo Sumo)
// ============================================================================
interface SumoClashState {
  round: number;
  timeLeft: number;
  ringRadius: number;
  players: {
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
    chargeTimer: number;
    stompTimer: number;
    respawnTimer: number;
    alive: boolean;
    ringOuts: number;
    lastHitBy: string | null;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  shockwaves: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  banner: string | null;
}

export const sumoClashModule: CompactGameModule<SumoClashState, SumoClashSnapshot> = {
  id: 'sumo-clash',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      round: 1,
      timeLeft: totalTime,
      ringRadius: 270,
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 140,
          y: 375 + Math.sin(ang) * 140,
          vx: 0,
          vy: 0,
          angle: ang + Math.PI,
          radius: 30,
          chargeTimer: 0,
          stompTimer: 0,
          respawnTimer: 0,
          alive: true,
          ringOuts: 0,
          lastHitBy: null,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      shockwaves: [],
      banner: 'DOSUKOI! BLAST RIVALS OFF THE GOLDEN DOHYO!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    state.ringRadius = Math.max(175, state.ringRadius - dt * (frenzy ? 4 : 1.5));

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.chargeTimer = Math.max(0, p.chargeTimer - dt);
      p.stompTimer = Math.max(0, p.stompTimer - dt);
      p.radius = frenzy ? 35 : 30;

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.x = ARENA_WIDTH / 2 + (Math.random() - 0.5) * 160;
          p.y = 375 + (Math.random() - 0.5) * 160;
          p.vx = 0;
          p.vy = 0;
          p.lastHitBy = null;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (Math.hypot(mx, my) > 0.15) {
        p.angle = Math.atan2(my, mx);
        p.vx += mx * 640 * dt;
        p.vy += my * 640 * dt;
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.chargeTimer = 0.35;
        p.cdA = 1.6;
        p.vx += Math.cos(p.angle) * 460;
        p.vy += Math.sin(p.angle) * 460;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.stompTimer = 0.35;
        p.cdB = 3.0;
        state.shockwaves.push({ x: p.x, y: p.y, radius: 30, colorHex: p.colorHex, alpha: 1 });
        sounds.push({ type: 'hit', playerId: p.id });
        for (const r of state.players) {
          if (r.id === p.id || !r.alive) continue;
          const d = dist(p.x, p.y, r.x, r.y);
          if (d < 165) {
            const ang = Math.atan2(r.y - p.y, r.x - p.x);
            r.vx += Math.cos(ang) * 560;
            r.vy += Math.sin(ang) * 560;
            r.lastHitBy = p.id;
          }
        }
      }
      p.prevA = aDown;
      p.prevB = bDown;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.14, dt);
      p.vy *= Math.pow(0.14, dt);
    }

    // Sumo body collisions
    for (let i = 0; i < state.players.length; i++) {
      const a = state.players[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < state.players.length; j++) {
        const b = state.players[j];
        if (!b.alive) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        const minD = a.radius + b.radius;
        if (d > 0 && d < minD) {
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          const overlap = minD - d;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
          const forceA = a.chargeTimer > 0 ? 520 : 240;
          const forceB = b.chargeTimer > 0 ? 520 : 240;
          b.vx += nx * forceA;
          b.vy += ny * forceA;
          a.vx -= nx * forceB;
          a.vy -= ny * forceB;
          b.lastHitBy = a.id;
          a.lastHitBy = b.id;
          sounds.push({ type: 'hit' });
        }
      }

      if (dist(a.x, a.y, ARENA_WIDTH / 2, 375) > state.ringRadius) {
        a.alive = false;
        a.respawnTimer = 1.6;
        state.round += 1;
        const hitter = state.players.find((pl) => pl.id === a.lastHitBy);
        if (hitter) {
          hitter.ringOuts += 1;
          hitter.score += 150 * mult;
          state.banner = `${hitter.name} RINGED OUT ${a.name}! +${150 * mult}`;
          sounds.push({ type: 'score', playerId: hitter.id });
        } else {
          sounds.push({ type: 'elim' });
        }
      } else {
        a.score += 6 * dt;
      }
    }

    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      state.shockwaves[i].radius += 340 * dt;
      state.shockwaves[i].alpha -= dt * 2.1;
      if (state.shockwaves[i].alpha <= 0) state.shockwaves.splice(i, 1);
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'sumo-clash',
      round: state.round,
      timeLeft: state.timeLeft,
      ringRadius: state.ringRadius,
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
        radius: p.radius,
        chargeTimer: p.chargeTimer,
        stompTimer: p.stompTimer,
        alive: p.alive,
        ringOuts: p.ringOuts,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.6, 0, 1),
        cooldownB: clamp(p.cdB / 3.0, 0, 1),
      })),
      shockwaves: state.shockwaves,
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.ringOuts} ring-outs · ${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 10. CANOE SPRINT (Rapids Sprint)
// ============================================================================
interface CanoeState {
  timeLeft: number;
  totalTime: number;
  finishDist: number;
  gates: { id: string; x: number; dist: number; width: number }[];
  rocks: { x: number; dist: number; r: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    laneX: number;
    dist: number;
    speed: number;
    boostTimer: number;
    stunTimer: number;
    gatesCleared: number;
    passedGateIds: Set<string>;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const canoeSprintModule: CompactGameModule<CanoeState, CanoeSprintSnapshot> = {
  id: 'canoe-sprint',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const finishDist = 5200;
    const gates: { id: string; x: number; dist: number; width: number }[] = [];
    const rocks: { x: number; dist: number; r: number }[] = [];
    for (let d = 380; d < finishDist - 250; d += 340) {
      gates.push({
        id: `g-${d}`,
        x: 240 + Math.random() * (ARENA_WIDTH - 480),
        dist: d,
        width: 150,
      });
      rocks.push({
        x: 210 + Math.random() * (ARENA_WIDTH - 420),
        dist: d + 170,
        r: 30,
      });
    }
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      finishDist,
      gates,
      rocks,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        laneX: 250 + ((i + 0.5) / count) * (ARENA_WIDTH - 500),
        dist: 0,
        speed: 140,
        boostTimer: 0,
        stunTimer: 0,
        gatesCleared: 0,
        passedGateIds: new Set(),
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'TAP PADDLE (A) & STEER THROUGH GREEN GATES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.boostTimer = Math.max(0, p.boostTimer - dt);
      p.stunTimer = Math.max(0, p.stunTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.laneX = clamp(p.laneX + mx * 340 * dt, 160, ARENA_WIDTH - 160);
      if (aDown && !p.prevA && p.cdA <= 0 && p.stunTimer <= 0) {
        p.speed = Math.min(460, p.speed + 68);
        p.cdA = 0.14;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.boostTimer = 1.1;
        p.cdB = 4.2;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const targetBase = p.boostTimer > 0 || frenzy ? 440 : 155;
      p.speed = Math.max(targetBase, p.speed - 95 * dt);
      if (p.stunTimer > 0) p.speed = 65;

      p.dist = Math.min(state.finishDist, p.dist + p.speed * dt);
      p.score = Math.max(p.score, Math.round(p.dist / 10 + p.gatesCleared * 60 * mult));

      for (const g of state.gates) {
        if (!p.passedGateIds.has(g.id) && Math.abs(p.dist - g.dist) < 35 && Math.abs(p.laneX - g.x) < g.width * 0.55) {
          p.passedGateIds.add(g.id);
          p.gatesCleared += 1;
          p.score += 60 * mult;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
      for (const r of state.rocks) {
        if (p.stunTimer <= 0 && Math.abs(p.dist - r.dist) < r.r + 16 && Math.abs(p.laneX - r.x) < r.r + 18) {
          p.stunTimer = 0.65;
          p.speed = 70;
          sounds.push({ type: 'hit', playerId: p.id });
        }
      }
    }

    const winner = state.players.find((p) => p.dist >= state.finishDist);
    if (winner) {
      const topOther = state.players.reduce((m, pl) => (pl.id !== winner.id ? Math.max(m, pl.score) : m), 0);
      winner.score = Math.max(winner.score + 300, topOther + 150);
      state.banner = `${winner.name} CROSSED THE FINISH!`;
      return { finished: true, sounds: [{ type: 'win', playerId: winner.id }] };
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'canoe-sprint',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      finishDist: state.finishDist,
      gates: state.gates,
      rocks: state.rocks,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        laneX: p.laneX,
        dist: p.dist,
        speed: p.speed,
        boostTimer: p.boostTimer,
        stunTimer: p.stunTimer,
        gatesCleared: p.gatesCleared,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.14, 0, 1),
        cooldownB: clamp(p.cdB / 4.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    const sorted = [...state.players].sort((a, b) => b.dist - a.dist || b.score - a.score);
    return sorted.map((p, i) => ({
      playerId: p.id,
      rank: i + 1,
      score: Math.round(p.score),
      statLabel: `${Math.round(p.dist)}m · ${p.gatesCleared} gates`,
    }));
  },
};

// ============================================================================
// 11. DISC ARENA (Hyper Disc / Windjammers)
// ============================================================================
interface DiscArenaState {
  timeLeft: number;
  totalTime: number;
  disc: { x: number; y: number; vx: number; vy: number; curve: number; power: boolean; holderId: string | null; lastTeam: number };
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    dashTimer: number;
    goals: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const discArenaModule: CompactGameModule<DiscArenaState, DiscArenaSnapshot> = {
  id: 'disc-arena',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      disc: { x: ARENA_WIDTH / 2, y: 360, vx: 430, vy: 170, curve: 0, power: false, holderId: null, lastTeam: 0 },
      players: players.map((p, i) => {
        const isLeft = i % 2 === 0;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: isLeft ? 210 : ARENA_WIDTH - 210,
          y: 260 + Math.floor(i / 2) * 140,
          angle: isLeft ? 0 : Math.PI,
          dashTimer: 0,
          goals: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'CATCH THE HYPER DISC & CURVE THROW INTO THE RIVAL GOAL!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      const isLeft = p.slotIndex % 2 === 0;

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.dashTimer = 0.25;
        p.cdB = 1.4;
        sounds.push({ type: 'dash', playerId: p.id });
      }

      const spd = p.dashTimer > 0 ? 640 : 350;
      p.x = clamp(p.x + mx * spd * dt, isLeft ? 105 : ARENA_WIDTH / 2 + 40, isLeft ? ARENA_WIDTH / 2 - 40 : ARENA_WIDTH - 105);
      p.y = clamp(p.y + my * spd * dt, 110, ARENA_HEIGHT - 85);

      if (!state.disc.holderId && dist(p.x, p.y, state.disc.x, state.disc.y) < 42) {
        state.disc.holderId = p.id;
        state.disc.lastTeam = p.slotIndex % 2;
        p.score += 15 * mult;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      if (state.disc.holderId === p.id && aDown && !p.prevA) {
        state.disc.holderId = null;
        const dir = isLeft ? 1 : -1;
        const spdThrow = frenzy ? 920 : 760;
        state.disc.vx = dir * spdThrow;
        state.disc.vy = my * 520 + (Math.random() - 0.5) * 90;
        state.disc.curve = my * 360;
        state.disc.power = true;
        p.cdA = 0.4;
        sounds.push({ type: 'shoot', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    const d = state.disc;
    if (d.holderId) {
      const h = state.players.find((pl) => pl.id === d.holderId);
      if (h) {
        d.x = h.x + (h.slotIndex % 2 === 0 ? 28 : -28);
        d.y = h.y;
      } else {
        d.holderId = null;
      }
    } else {
      d.vy += d.curve * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y < 105) {
        d.y = 105;
        d.vy = Math.abs(d.vy);
        d.curve *= -0.7;
      } else if (d.y > ARENA_HEIGHT - 80) {
        d.y = ARENA_HEIGHT - 80;
        d.vy = -Math.abs(d.vy);
        d.curve *= -0.7;
      }

      if (d.x < 90 || d.x > ARENA_WIDTH - 90) {
        const scoringSide = d.x > ARENA_WIDTH - 90 ? 0 : 1;
        for (const p of state.players) {
          if (p.slotIndex % 2 === scoringSide) {
            p.goals += 1;
            p.score += 120 * mult;
          }
        }
        state.banner = `${scoringSide === 0 ? 'LEFT TEAM' : 'RIGHT TEAM'} GOAL! +${120 * mult}`;
        sounds.push({ type: 'score' });
        d.x = ARENA_WIDTH / 2;
        d.y = 360;
        d.vx = scoringSide === 0 ? -420 : 420;
        d.vy = (Math.random() - 0.5) * 260;
        d.curve = 0;
        d.power = false;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'disc-arena',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      disc: {
        x: state.disc.x,
        y: state.disc.y,
        vx: state.disc.vx,
        vy: state.disc.vy,
        curve: state.disc.curve,
        power: state.disc.power,
        holderId: state.disc.holderId,
      },
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        dashTimer: p.dashTimer,
        goals: p.goals,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.4, 0, 1),
        cooldownB: clamp(p.cdB / 1.4, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.goals} goals · ${p.score} pts`);
  },
};

// ============================================================================
// 12. BADMINTON SMASH (Shuttle Smash)
// ============================================================================
interface BadmintonState {
  timeLeft: number;
  totalTime: number;
  shuttle: { x: number; y: number; vx: number; vy: number; smashing: boolean; lastTeam: number };
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    side: 0 | 1;
    x: number;
    y: number;
    jumpVy: number;
    swingTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const badmintonSmashModule: CompactGameModule<BadmintonState, BadmintonSmashSnapshot> = {
  id: 'badminton-smash',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const floorY = 610;
    return {
      timeLeft: totalTime,
      totalTime,
      shuttle: { x: 340, y: 240, vx: 320, vy: -120, smashing: false, lastTeam: 0 },
      players: players.map((p, i) => {
        const side: 0 | 1 = i % 2 === 0 ? 0 : 1;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          side,
          x: side === 0 ? 280 : ARENA_WIDTH - 280,
          y: floorY,
          jumpVy: 0,
          swingTimer: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'LEAP AT THE NET WITH A FOR LIGHTNING SMASHES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    const floorY = 610;
    const netX = ARENA_WIDTH / 2;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.swingTimer = Math.max(0, p.swingTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      const minX = p.side === 0 ? 105 : netX + 42;
      const maxX = p.side === 0 ? netX - 42 : ARENA_WIDTH - 105;
      p.x = clamp(p.x + mx * 410 * dt, minX, maxX);

      if (aDown && !p.prevA && p.cdA <= 0) {
        if (p.y >= floorY - 4) p.jumpVy = -540;
        p.swingTimer = 0.28;
        p.cdA = 0.45;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.swingTimer = 0.3;
        p.cdB = 0.5;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      p.jumpVy += 1250 * dt;
      p.y += p.jumpVy * dt;
      if (p.y > floorY) {
        p.y = floorY;
        p.jumpVy = 0;
      }
    }

    const s = state.shuttle;
    s.vy += (s.smashing ? 420 : 540) * dt;
    s.vx *= Math.pow(0.86, dt);
    s.x += s.vx * dt;
    s.y += s.vy * dt;

    if (s.x < 80) {
      s.x = 80;
      s.vx = Math.abs(s.vx);
    } else if (s.x > ARENA_WIDTH - 80) {
      s.x = ARENA_WIDTH - 80;
      s.vx = -Math.abs(s.vx);
    }
    if (s.y < 95) {
      s.y = 95;
      s.vy = Math.abs(s.vy) * 0.5;
    }

    // Net bounce
    if (Math.abs(s.x - netX) < 12 && s.y > floorY - 145) {
      s.vx *= -0.7;
      s.x = s.x < netX ? netX - 13 : netX + 13;
    }

    // If solo test, bounce off undefended right wall floor cleanly
    const hasSide1 = state.players.some((p) => p.side === 1);
    if (!hasSide1 && s.x > netX + 20 && s.y > floorY - 35) {
      s.vx = -380;
      s.vy = -520;
      s.smashing = false;
      s.lastTeam = 1;
    }

    for (const p of state.players) {
      if (dist(s.x, s.y, p.x, p.y - 24) < 62) {
        const dir = p.side === 0 ? 1 : -1;
        const isSmash = p.y < floorY - 25 || p.swingTimer > 0;
        s.smashing = isSmash;
        s.vx = dir * (isSmash ? (frenzy ? 780 : 650) : 390);
        s.vy = isSmash ? 140 : -580;
        s.lastTeam = p.side;
        p.score += (isSmash ? 30 : 15) * mult;
        sounds.push({ type: 'hit', playerId: p.id });
        break;
      }
    }

    if (s.y > floorY + 12) {
      const winnerSide = s.x < netX ? 1 : 0;
      for (const p of state.players) {
        if (p.side === winnerSide) p.score += 90 * mult;
      }
      state.banner = `${winnerSide === 0 ? 'LEFT TEAM' : 'RIGHT TEAM'} SHUTTLE WINNER! +${90 * mult}`;
      sounds.push({ type: 'score' });
      s.x = winnerSide === 0 ? 320 : ARENA_WIDTH - 320;
      s.y = 260;
      s.vx = winnerSide === 0 ? 330 : -330;
      s.vy = -180;
      s.smashing = false;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'badminton-smash',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      shuttle: state.shuttle,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        side: p.side,
        x: p.x,
        y: p.y,
        jumpVy: p.jumpVy,
        swingTimer: p.swingTimer,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.45, 0, 1),
        cooldownB: clamp(p.cdB / 0.5, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.score} pts`);
  },
};

// ============================================================================
// 13. BILLIARDS SNOOKER (Pool Blitz)
// ============================================================================
interface BilliardsState {
  timeLeft: number;
  totalTime: number;
  pockets: { x: number; y: number; r: number }[];
  balls: { id: string; x: number; y: number; vx: number; vy: number; colorHex: string; value: number; isCue?: boolean; lastHitId?: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    aimAngle: number;
    power: number;
    powerDir: number;
    charging: boolean;
    potted: number;
    score: number;
    cdA: number;
    cdB: number;
    prevB: boolean;
  }[];
  banner: string | null;
}

function spawnRackBalls() {
  const balls: BilliardsState['balls'] = [];
  const colors = ['#EF4444', '#3B82F6', '#22C55E', '#A855F7', '#F97316', '#EC4899'];
  let idx = 0;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col <= row; col++) {
      const isEight = row === 2 && col === 1;
      balls.push({
        id: `b-${idx}`,
        x: 680 + row * 34,
        y: 365 + (col - row / 2) * 36,
        vx: 0,
        vy: 0,
        colorHex: isEight ? '#FACC15' : colors[idx % colors.length],
        value: isEight ? 150 : 75,
      });
      idx++;
    }
  }
  return balls;
}

export const billiardsSnookerModule: CompactGameModule<BilliardsState, BilliardsSnookerSnapshot> = {
  id: 'billiards-snooker',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const tx = 130;
    const ty = 115;
    const tw = ARENA_WIDTH - 260;
    const th = ARENA_HEIGHT - 200;
    const pockets = [
      { x: tx + 16, y: ty + 16, r: 28 },
      { x: tx + tw / 2, y: ty + 10, r: 26 },
      { x: tx + tw - 16, y: ty + 16, r: 28 },
      { x: tx + 16, y: ty + th - 16, r: 28 },
      { x: tx + tw / 2, y: ty + th - 10, r: 26 },
      { x: tx + tw - 16, y: ty + th - 16, r: 28 },
    ];
    return {
      timeLeft: totalTime,
      totalTime,
      pockets,
      balls: spawnRackBalls(),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 280,
        y: 230 + (i % 4) * 90,
        aimAngle: 0,
        power: 0.65,
        powerDir: 1,
        charging: false,
        potted: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevB: false,
      })),
      banner: 'POCKET COLORED BALLS & GOLDEN +150 8-BALLS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    if (state.balls.length < 3) {
      state.balls.push(...spawnRackBalls());
      state.banner = 'FRESH RACK SPAWNED!';
    }

    const left = 148;
    const right = ARENA_WIDTH - 148;
    const top = 133;
    const bottom = ARENA_HEIGHT - 103;

    // Update strikers
    const cues: { id: string; x: number; y: number; vx: number; vy: number; colorHex: string }[] = [];
    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (Math.hypot(mx, my) > 0.18) {
        p.aimAngle = Math.atan2(my, mx);
      }

      if (aDown && p.cdA <= 0) {
        p.charging = true;
        p.power += p.powerDir * dt * 1.3;
        if (p.power >= 1) {
          p.power = 1;
          p.powerDir = -1;
        } else if (p.power <= 0.2) {
          p.power = 0.2;
          p.powerDir = 1;
        }
      } else if (!aDown && p.charging) {
        p.charging = false;
        p.cdA = 0.55;
        const spd = 420 + p.power * 620;
        cues.push({ id: p.id, x: p.x, y: p.y, vx: Math.cos(p.aimAngle) * spd, vy: Math.sin(p.aimAngle) * spd, colorHex: p.colorHex });
        p.x = clamp(p.x + Math.cos(p.aimAngle) * 165, left + 20, right - 20);
        p.y = clamp(p.y + Math.sin(p.aimAngle) * 165, top + 20, bottom - 20);
        sounds.push({ type: 'hit', playerId: p.id });
      } else if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 0.5;
        cues.push({ id: p.id, x: p.x, y: p.y, vx: Math.cos(p.aimAngle) * 440, vy: Math.sin(p.aimAngle) * 440, colorHex: p.colorHex });
        p.x = clamp(p.x + Math.cos(p.aimAngle) * 75, left + 20, right - 20);
        p.y = clamp(p.y + Math.sin(p.aimAngle) * 75, top + 20, bottom - 20);
        sounds.push({ type: 'hit', playerId: p.id });
      }
      p.prevB = bDown;
    }

    // Impart energy onto balls near striker
    for (const c of cues) {
      for (const b of state.balls) {
        if (dist(c.x, c.y, b.x, b.y) < 120) {
          const ang = Math.atan2(b.y - c.y, b.x - c.x);
          const push = Math.hypot(c.vx, c.vy) * 0.72;
          b.vx += Math.cos(ang) * push;
          b.vy += Math.sin(ang) * push;
          b.lastHitId = c.id;
        }
      }
    }

    // Ball-to-ball collisions
    for (let i = 0; i < state.balls.length; i++) {
      const a = state.balls[i];
      for (let j = i + 1; j < state.balls.length; j++) {
        const b = state.balls[j];
        const d = dist(a.x, a.y, b.x, b.y);
        if (d > 0 && d < 30) {
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          const ov = 30 - d;
          a.x -= nx * ov * 0.5;
          a.y -= ny * ov * 0.5;
          b.x += nx * ov * 0.5;
          b.y += ny * ov * 0.5;
          const dvx = a.vx - b.vx;
          const dvy = a.vy - b.vy;
          const dot = dvx * nx + dvy * ny;
          if (dot > 0) {
            a.vx -= dot * nx * 0.9;
            a.vy -= dot * ny * 0.9;
            b.vx += dot * nx * 0.9;
            b.vy += dot * ny * 0.9;
            if (a.lastHitId) b.lastHitId = a.lastHitId;
          }
        }
      }
    }

    // Move & pocket check
    for (let i = state.balls.length - 1; i >= 0; i--) {
      const b = state.balls[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const fr = Math.pow(0.28, dt);
      b.vx *= fr;
      b.vy *= fr;
      if (b.x < left) {
        b.x = left;
        b.vx = Math.abs(b.vx) * 0.85;
      } else if (b.x > right) {
        b.x = right;
        b.vx = -Math.abs(b.vx) * 0.85;
      }
      if (b.y < top) {
        b.y = top;
        b.vy = Math.abs(b.vy) * 0.85;
      } else if (b.y > bottom) {
        b.y = bottom;
        b.vy = -Math.abs(b.vy) * 0.85;
      }

      if (state.pockets.some((pk) => dist(b.x, b.y, pk.x, pk.y) < pk.r + 6)) {
        const owner = state.players.find((pl) => pl.id === b.lastHitId) ?? state.players[0];
        if (owner) {
          owner.potted += 1;
          owner.score += b.value * mult;
          state.banner = `${owner.name} POTTED +${b.value * mult}!`;
          sounds.push({ type: 'score', playerId: owner.id });
        }
        state.balls.splice(i, 1);
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'billiards-snooker',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      pockets: state.pockets,
      balls: state.balls.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        colorHex: b.colorHex,
        value: b.value,
      })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        aimAngle: p.aimAngle,
        power: p.power,
        charging: p.charging,
        potted: p.potted,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.55, 0, 1),
        cooldownB: clamp(p.cdB / 0.5, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.potted} potted · ${p.score} pts`);
  },
};

// ============================================================================
// 14. TETHER JOUST (Bumper Joust)
// ============================================================================
interface TetherJoustState {
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    lungeTimer: number;
    shieldTimer: number;
    respawnTimer: number;
    alive: boolean;
    hits: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  sparks: { x: number; y: number; colorHex: string; alpha: number }[];
  banner: string | null;
}

export const tetherJoustModule: CompactGameModule<TetherJoustState, TetherJoustSnapshot> = {
  id: 'tether-joust',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 240,
          y: 370 + Math.sin(ang) * 165,
          vx: 0,
          vy: 0,
          angle: ang + Math.PI,
          lungeTimer: 0,
          shieldTimer: 0,
          respawnTimer: 0,
          alive: true,
          hits: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      sparks: [],
      banner: 'LUNGE (A) TO IMPALE FLANKS · SHIELD (B) TO PARRY!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.lungeTimer = Math.max(0, p.lungeTimer - dt);
      p.shieldTimer = Math.max(0, p.shieldTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.x = ARENA_WIDTH / 2 + (Math.random() - 0.5) * 420;
          p.y = 370 + (Math.random() - 0.5) * 240;
          p.vx = 0;
          p.vy = 0;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (Math.hypot(mx, my) > 0.16) {
        p.angle = Math.atan2(my, mx);
        p.vx += mx * 820 * dt;
        p.vy += my * 820 * dt;
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.lungeTimer = 0.34;
        p.cdA = frenzy ? 0.5 : 1.15;
        p.vx += Math.cos(p.angle) * 580;
        p.vy += Math.sin(p.angle) * 580;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.shieldTimer = 0.7;
        p.cdB = 2.6;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      p.x = clamp(p.x + p.vx * dt, 105, ARENA_WIDTH - 105);
      p.y = clamp(p.y + p.vy * dt, 115, ARENA_HEIGHT - 85);
      p.vx *= Math.pow(0.18, dt);
      p.vy *= Math.pow(0.18, dt);

      // Lance tip hit check
      const tipX = p.x + Math.cos(p.angle) * (p.lungeTimer > 0 ? 58 : 42);
      const tipY = p.y + Math.sin(p.angle) * (p.lungeTimer > 0 ? 58 : 42);
      for (const r of state.players) {
        if (r.id === p.id || !r.alive) continue;
        if (dist(tipX, tipY, r.x, r.y) < 34) {
          if (r.shieldTimer > 0) {
            p.vx = -Math.cos(p.angle) * 440;
            p.vy = -Math.sin(p.angle) * 440;
            state.sparks.push({ x: tipX, y: tipY, colorHex: '#FACC15', alpha: 1 });
            sounds.push({ type: 'hit' });
          } else if (p.lungeTimer > 0 || Math.hypot(p.vx, p.vy) > 150) {
            r.alive = false;
            r.respawnTimer = 1.65;
            p.hits += 1;
            p.score += 120 * mult;
            state.banner = `${p.name} UNHORSED ${r.name}! +${120 * mult}`;
            state.sparks.push({ x: r.x, y: r.y, colorHex: p.colorHex, alpha: 1 });
            sounds.push({ type: 'score', playerId: p.id });
          }
        }
      }
    }

    for (let i = state.sparks.length - 1; i >= 0; i--) {
      state.sparks[i].alpha -= dt * 2.4;
      if (state.sparks[i].alpha <= 0) state.sparks.splice(i, 1);
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'tether-joust',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
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
        lungeTimer: p.lungeTimer,
        shieldTimer: p.shieldTimer,
        alive: p.alive,
        hits: p.hits,
        score: p.score,
        cooldownA: clamp(p.cdA / 1.15, 0, 1),
        cooldownB: clamp(p.cdB / 2.6, 0, 1),
      })),
      sparks: state.sparks,
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.hits} unhorses · ${p.score} pts`);
  },
};
