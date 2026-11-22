import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/shared/types.ts';
import type {
  BombTagArenaSnapshot,
  ChainGangClimbSnapshot,
  ConfettiCaptureSnapshot,
  CraneDropChaosSnapshot,
  FallingAnvilsSnapshot,
  HotLavaFloorSnapshot,
  KingOfHillNeoSnapshot,
  LaserJumpRopeSnapshot,
  LaserMazeHeistSnapshot,
  MeteorDodgeXSnapshot,
  MusicalThronesSnapshot,
  RouletteArenaSnapshot,
  SeesawBalanceSnapshot,
  SumoIceDriftSnapshot,
  ZombieOutbreakSnapshot,
} from '../../src/shared/packChaosSurvivalTypes.ts';
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
// 1. LASER JUMP ROPE (#73 replacement)
// ============================================================================
interface LaserJumpState {
  timeLeft: number;
  totalTime: number;
  beamAngle: number;
  beamSpeed: number;
  doubleBeam: boolean;
  gems: { id: string; x: number; y: number; value: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    z: number;
    vz: number;
    jumpsCleared: number;
    alive: boolean;
    respawnTimer: number;
    shieldTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const laserJumpRopeModule: CompactGameModule<LaserJumpState, LaserJumpRopeSnapshot> = {
  id: 'laser-jump-rope',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      beamAngle: 0,
      beamSpeed: 1.85,
      doubleBeam: false,
      gems: Array.from({ length: 4 }, (_, i) => {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        return { id: `lj-${i}`, x: ARENA_WIDTH / 2 + Math.cos(ang) * 165, y: 375 + Math.sin(ang) * 165, value: 60 };
      }),
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2 + 0.6;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 140,
          y: 375 + Math.sin(ang) * 140,
          z: 0,
          vz: 0,
          jumpsCleared: 0,
          alive: true,
          respawnTimer: 0,
          shieldTimer: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'HOP THE LASER BEAM & SNATCH GEMS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    const elapsed = state.totalTime - state.timeLeft;
    state.doubleBeam = frenzy || elapsed > state.totalTime * 0.45;
    const dir = Math.floor(elapsed / 12) % 2 === 0 ? 1 : -1;
    state.beamSpeed = (1.85 + Math.min(1.6, elapsed * 0.025)) * dir * (frenzy ? 1.2 : 1);
    state.beamAngle += state.beamSpeed * dt;

    while (state.gems.length < 4) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 75 + Math.random() * 145;
      state.gems.push({
        id: `lj-${Math.random().toString(36).slice(2, 7)}`,
        x: ARENA_WIDTH / 2 + Math.cos(ang) * rad,
        y: 375 + Math.sin(ang) * rad,
        value: 60,
      });
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.shieldTimer = Math.max(0, p.shieldTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.z = 24;
          p.vz = 0;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.x += mx * 240 * dt;
      p.y += my * 240 * dt;
      const dc = dist(p.x, p.y, ARENA_WIDTH / 2, 375);
      if (dc > 235) {
        p.x = ARENA_WIDTH / 2 + ((p.x - ARENA_WIDTH / 2) / dc) * 235;
        p.y = 375 + ((p.y - 375) / dc) * 235;
      }

      if (aDown && !p.prevA && p.z <= 1 && p.cdA <= 0) {
        p.vz = 390;
        p.cdA = 0.35;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.shieldTimer = 1.1;
        p.cdB = 4.2;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      p.vz -= 980 * dt;
      p.z = Math.max(0, p.z + p.vz * dt);
      if (p.z === 0) p.vz = Math.max(0, p.vz);

      // Gem collection
      for (let i = state.gems.length - 1; i >= 0; i--) {
        const g = state.gems[i];
        if (dist(p.x, p.y, g.x, g.y) < 34) {
          p.score += g.value * mult;
          state.gems.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      // Beam intersection check
      const angles = state.doubleBeam ? [state.beamAngle, state.beamAngle + Math.PI] : [state.beamAngle];
      for (const ang of angles) {
        const bx = Math.cos(ang);
        const by = Math.sin(ang);
        const rx = p.x - ARENA_WIDTH / 2;
        const ry = p.y - 375;
        const proj = rx * bx + ry * by;
        if (proj > 20 && proj < 255) {
          const perp = Math.abs(rx * -by + ry * bx);
          if (perp < 16) {
            if (p.z > 18) {
              if (p.cdA < 0.06) {
                p.jumpsCleared += 1;
                p.score += 30 * mult;
              }
            } else if (p.shieldTimer > 0) {
              p.shieldTimer = 0;
              p.z = 16;
              sounds.push({ type: 'hit', playerId: p.id });
            } else {
              p.alive = false;
              p.respawnTimer = 1.65;
              p.score = Math.max(0, p.score - 20);
              state.banner = `${p.name} GOT ZAPPED BY THE LASER!`;
              sounds.push({ type: 'elim' });
            }
          }
        }
      }
      p.score += 12 * dt;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'laser-jump-rope',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      beamAngle: state.beamAngle,
      beamSpeed: state.beamSpeed,
      doubleBeam: state.doubleBeam,
      gems: state.gems,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        z: p.z,
        vz: p.vz,
        jumpsCleared: p.jumpsCleared,
        alive: p.alive,
        shieldTimer: p.shieldTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.35, 0, 1),
        cooldownB: clamp(p.cdB / 4.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.jumpsCleared} jumps · ${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 2. HOT LAVA FLOOR (Floor Is Lava)
// ============================================================================
interface HotLavaState {
  timeLeft: number;
  totalTime: number;
  lavaWave: number;
  platforms: { id: string; x: number; y: number; r: number; safe: boolean; sinking: boolean; timer: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    z: number;
    vz: number;
    alive: boolean;
    respawnTimer: number;
    shoveTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const hotLavaFloorModule: CompactGameModule<HotLavaState, HotLavaFloorSnapshot> = {
  id: 'hot-lava-floor',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const coords = [
      [310, 250],
      [600, 210],
      [890, 250],
      [280, 480],
      [600, 385],
      [920, 480],
      [470, 560],
      [730, 560],
    ];
    return {
      timeLeft: totalTime,
      totalTime,
      lavaWave: 0,
      platforms: coords.map(([x, y], i) => ({
        id: `hl-${i}`,
        x,
        y,
        r: 86,
        safe: true,
        sinking: false,
        timer: 3 + i * 0.9,
      })),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: coords[i % coords.length][0],
        y: coords[i % coords.length][1],
        z: 0,
        vz: 0,
        alive: true,
        respawnTimer: 0,
        shoveTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'LEAP TO GREEN ISLANDS BEFORE RED ONES SINK!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.lavaWave += dt * 3;
    const mult = frenzy ? 2 : 1;

    for (const pl of state.platforms) {
      pl.timer -= dt * (frenzy ? 1.45 : 1);
      if (pl.timer <= 0) {
        if (pl.safe && !pl.sinking) {
          pl.sinking = true;
          pl.timer = 1.7;
        } else if (pl.sinking) {
          pl.safe = false;
          pl.sinking = false;
          pl.timer = 2.6;
        } else {
          pl.safe = true;
          pl.sinking = false;
          pl.timer = 4.2 + Math.random() * 2.5;
        }
      }
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.shoveTimer = Math.max(0, p.shoveTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          const safePlat = state.platforms.find((pl) => pl.safe) ?? state.platforms[0];
          p.alive = true;
          p.x = safePlat.x;
          p.y = safePlat.y;
          p.z = 25;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.x = clamp(p.x + mx * 305 * dt, 100, ARENA_WIDTH - 100);
      p.y = clamp(p.y + my * 305 * dt, 115, ARENA_HEIGHT - 85);

      if (aDown && !p.prevA && p.z <= 1 && p.cdA <= 0) {
        p.vz = 420;
        p.cdA = 0.45;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.shoveTimer = 0.25;
        p.cdB = 2.0;
        sounds.push({ type: 'hit', playerId: p.id });
        for (const r of state.players) {
          if (r.id === p.id || !r.alive) continue;
          const d = dist(p.x, p.y, r.x, r.y);
          if (d < 85 && d > 0) {
            r.x += ((r.x - p.x) / d) * 115;
            r.y += ((r.y - p.y) / d) * 115;
          }
        }
      }
      p.prevA = aDown;
      p.prevB = bDown;

      p.vz -= 980 * dt;
      p.z = Math.max(0, p.z + p.vz * dt);

      const onSafe = state.platforms.some((pl) => pl.safe && dist(p.x, p.y, pl.x, pl.y) < pl.r + 6);
      if (!onSafe && p.z <= 0) {
        p.alive = false;
        p.respawnTimer = 1.6;
        state.banner = `${p.name} FELL INTO THE LAVA!`;
        sounds.push({ type: 'elim' });
      } else {
        p.score += 18 * mult * dt;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'hot-lava-floor',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      lavaWave: state.lavaWave,
      platforms: state.platforms,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        z: p.z,
        alive: p.alive,
        shoveTimer: p.shoveTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.45, 0, 1),
        cooldownB: clamp(p.cdB / 2.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 3. BOMB TAG ARENA (Tick Tock Tag)
// ============================================================================
interface BombTagState {
  timeLeft: number;
  totalTime: number;
  fuseLeft: number;
  bombHolderId: string | null;
  graceTimer: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    dashTimer: number;
    shieldTimer: number;
    respawnTimer: number;
    alive: boolean;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  explosions: { x: number; y: number; radius: number; alpha: number }[];
  banner: string | null;
}

export const bombTagArenaModule: CompactGameModule<BombTagState, BombTagArenaSnapshot> = {
  id: 'bomb-tag-arena',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      fuseLeft: 10,
      bombHolderId: players[0]?.id ?? null,
      graceTimer: 0.6,
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 240,
          y: 375 + Math.sin(ang) * 165,
          angle: ang + Math.PI,
          dashTimer: 0,
          shieldTimer: 0,
          respawnTimer: 0,
          alive: true,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      explosions: [],
      banner: 'PASS THE TICKING BOMB BEFORE 0.0s!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.fuseLeft = Math.max(0, state.fuseLeft - dt * (frenzy ? 1.45 : 1));
    state.graceTimer = Math.max(0, state.graceTimer - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.shieldTimer = Math.max(0, p.shieldTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.x = ARENA_WIDTH / 2 + (Math.random() - 0.5) * 320;
          p.y = 375 + (Math.random() - 0.5) * 180;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.28;
        p.cdA = 1.6;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.shieldTimer = 1.0;
        p.cdB = 3.5;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const isHolder = state.bombHolderId === p.id;
      const spd = (isHolder ? 345 : 295) * (p.dashTimer > 0 ? 1.65 : 1);
      if (Math.hypot(mx, my) > 0.16) {
        p.angle = Math.atan2(my, mx);
        p.x = clamp(p.x + mx * spd * dt, 100, ARENA_WIDTH - 100);
        p.y = clamp(p.y + my * spd * dt, 115, ARENA_HEIGHT - 85);
      }

      if (!isHolder) p.score += 18 * mult * dt;
    }

    const holder = state.players.find((p) => p.id === state.bombHolderId && p.alive);
    if (holder && state.graceTimer <= 0) {
      for (const r of state.players) {
        if (r.id === holder.id || !r.alive || r.shieldTimer > 0) continue;
        if (dist(holder.x, holder.y, r.x, r.y) < 46) {
          state.bombHolderId = r.id;
          state.graceTimer = 0.75;
          holder.score += 45 * mult;
          state.banner = `${holder.name} PASSED THE BOMB TO ${r.name}!`;
          sounds.push({ type: 'hit', playerId: holder.id });
          break;
        }
      }
    }

    if (state.fuseLeft <= 0) {
      if (holder) {
        holder.alive = false;
        holder.respawnTimer = 2.1;
        state.explosions.push({ x: holder.x, y: holder.y, radius: 130, alpha: 1 });
        state.banner = `KABOOM! ${holder.name} BLEW UP!`;
        sounds.push({ type: 'elim' });
      }
      const next = state.players.filter((p) => p.alive);
      state.bombHolderId = next.length > 0 ? next[Math.floor(Math.random() * next.length)].id : state.players[0]?.id ?? null;
      state.fuseLeft = frenzy ? 6.5 : 9.0;
    }

    for (let i = state.explosions.length - 1; i >= 0; i--) {
      state.explosions[i].radius += 160 * dt;
      state.explosions[i].alpha -= dt * 1.9;
      if (state.explosions[i].alpha <= 0) state.explosions.splice(i, 1);
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'bomb-tag-arena',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      fuseLeft: state.fuseLeft,
      bombHolderId: state.bombHolderId,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        dashTimer: p.dashTimer,
        shieldTimer: p.shieldTimer,
        alive: p.alive,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.6, 0, 1),
        cooldownB: clamp(p.cdB / 3.5, 0, 1),
      })),
      explosions: state.explosions,
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 4. MUSICAL THRONES (Neon Thrones)
// ============================================================================
interface MusicalThronesState {
  timeLeft: number;
  totalTime: number;
  phase: 'music' | 'scramble' | 'lock';
  phaseTimer: number;
  pods: { id: string; x: number; y: number; r: number; occupantId: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    seatedPodId: string | null;
    dashTimer: number;
    respawnTimer: number;
    alive: boolean;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function buildPods(count: number, tiny: boolean) {
  const pods: MusicalThronesState['pods'] = [];
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    pods.push({
      id: `pod-${i}`,
      x: ARENA_WIDTH / 2 + Math.cos(ang) * 165,
      y: 375 + Math.sin(ang) * 135,
      r: tiny ? 28 : 38,
      occupantId: null,
    });
  }
  return pods;
}

export const musicalThronesModule: CompactGameModule<MusicalThronesState, MusicalThronesSnapshot> = {
  id: 'musical-thrones',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      phase: 'music',
      phaseTimer: 3.8,
      pods: buildPods(Math.max(1, count - 1), false),
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 280,
          y: 375 + Math.sin(ang) * 200,
          seatedPodId: null,
          dashTimer: 0,
          respawnTimer: 0,
          alive: true,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'ORBIT THE RING — DIVE INTO GREEN PODS WHEN ALARM DROPS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.phaseTimer -= dt;
    const mult = frenzy ? 2 : 1;

    if (state.phaseTimer <= 0) {
      if (state.phase === 'music') {
        state.phase = 'scramble';
        state.phaseTimer = frenzy ? 3.2 : 4.2;
        const aliveCount = state.players.filter((p) => p.alive).length;
        state.pods = buildPods(Math.max(1, aliveCount - 1), frenzy);
        state.banner = 'SCRAMBLE! CLAIM A GLOWING THRONE!';
        sounds.push({ type: 'tick' });
      } else if (state.phase === 'scramble') {
        state.phase = 'lock';
        state.phaseTimer = 1.6;
        for (const p of state.players) {
          if (!p.alive) continue;
          if (p.seatedPodId) {
            p.score += 120 * mult;
            sounds.push({ type: 'score', playerId: p.id });
          } else if (state.players.length > 1) {
            p.alive = false;
            p.respawnTimer = 2.0;
            state.banner = `${p.name} MISSED A THRONE!`;
            sounds.push({ type: 'elim' });
          }
        }
      } else {
        state.phase = 'music';
        state.phaseTimer = 3.5;
        state.pods.forEach((pd) => (pd.occupantId = null));
        state.players.forEach((p) => {
          p.alive = true;
          p.seatedPodId = null;
        });
        state.banner = 'DANCE AROUND THE ARENA!';
      }
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      if (!p.alive) continue;

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.25;
        p.cdA = 1.4;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 1.8;
        for (const r of state.players) {
          if (r.id === p.id || !r.alive) continue;
          const d = dist(p.x, p.y, r.x, r.y);
          if (d < 85 && d > 0) {
            r.x += ((r.x - p.x) / d) * 110;
            r.y += ((r.y - p.y) / d) * 110;
            r.seatedPodId = null;
          }
        }
        sounds.push({ type: 'hit', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const spd = p.dashTimer > 0 ? 540 : 300;
      p.x = clamp(p.x + mx * spd * dt, 100, ARENA_WIDTH - 100);
      p.y = clamp(p.y + my * spd * dt, 115, ARENA_HEIGHT - 85);

      if (state.phase === 'scramble') {
        p.seatedPodId = null;
        for (const pd of state.pods) {
          if (dist(p.x, p.y, pd.x, pd.y) < pd.r + 10) {
            if (!pd.occupantId || pd.occupantId === p.id) {
              pd.occupantId = p.id;
              p.seatedPodId = pd.id;
              break;
            }
          } else if (pd.occupantId === p.id) {
            pd.occupantId = null;
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'musical-thrones',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      phase: state.phase,
      phaseTimer: state.phaseTimer,
      pods: state.pods,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        seatedPodId: p.seatedPodId,
        alive: p.alive,
        score: p.score,
        cooldownA: clamp(p.cdA / 1.4, 0, 1),
        cooldownB: clamp(p.cdB / 1.8, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.score} pts`);
  },
};

// ============================================================================
// 5. SUMO ICE DRIFT (Slippery Glacier)
// ============================================================================
interface IceDriftState {
  timeLeft: number;
  totalTime: number;
  iceRadius: number;
  cracks: { angle: number; r: number }[];
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
    alive: boolean;
    dashTimer: number;
    respawnTimer: number;
    lastHitBy: string | null;
    kos: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const sumoIceDriftModule: CompactGameModule<IceDriftState, SumoIceDriftSnapshot> = {
  id: 'sumo-ice-drift',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      iceRadius: 275,
      cracks: Array.from({ length: 6 }, (_, i) => ({ angle: (i / 6) * Math.PI * 2, r: 220 })),
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 145,
          y: 375 + Math.sin(ang) * 145,
          vx: 0,
          vy: 0,
          angle: ang + Math.PI,
          alive: true,
          dashTimer: 0,
          respawnTimer: 0,
          lastHitBy: null,
          kos: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'ZERO FRICTION! DRIFT & BUMP RIVALS OFF THE GLACIER!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    state.iceRadius = Math.max(165, state.iceRadius - dt * (frenzy ? 4.2 : 1.7));

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.x = ARENA_WIDTH / 2 + (Math.random() - 0.5) * 140;
          p.y = 375 + (Math.random() - 0.5) * 140;
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

      if (Math.hypot(mx, my) > 0.14) {
        p.angle = Math.atan2(my, mx);
        p.vx += mx * 340 * dt;
        p.vy += my * 340 * dt;
      }
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.3;
        p.cdA = 1.4;
        p.vx += Math.cos(p.angle) * 320;
        p.vy += Math.sin(p.angle) * 320;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 2.6;
        for (const r of state.players) {
          if (r.id === p.id || !r.alive) continue;
          const d = dist(p.x, p.y, r.x, r.y);
          if (d < 155 && d > 0) {
            r.vx += ((r.x - p.x) / d) * 390;
            r.vy += ((r.y - p.y) / d) * 390;
            r.lastHitBy = p.id;
          }
        }
        sounds.push({ type: 'hit', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // Low ice friction!
      p.vx *= Math.pow(0.66, dt);
      p.vy *= Math.pow(0.66, dt);
    }

    for (let i = 0; i < state.players.length; i++) {
      const a = state.players[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < state.players.length; j++) {
        const b = state.players[j];
        if (!b.alive) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d > 0 && d < 52) {
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          const ov = 52 - d;
          a.x -= nx * ov * 0.5;
          a.y -= ny * ov * 0.5;
          b.x += nx * ov * 0.5;
          b.y += ny * ov * 0.5;
          b.vx += nx * 260;
          b.vy += ny * 260;
          a.vx -= nx * 260;
          a.vy -= ny * 260;
          b.lastHitBy = a.id;
          a.lastHitBy = b.id;
          sounds.push({ type: 'hit' });
        }
      }

      if (dist(a.x, a.y, ARENA_WIDTH / 2, 375) > state.iceRadius) {
        a.alive = false;
        a.respawnTimer = 1.6;
        const hitter = state.players.find((pl) => pl.id === a.lastHitBy);
        if (hitter) {
          hitter.kos += 1;
          hitter.score += 140 * mult;
          state.banner = `${hitter.name} SLID ${a.name} INTO THE SEA!`;
          sounds.push({ type: 'score', playerId: hitter.id });
        } else {
          sounds.push({ type: 'elim' });
        }
      } else {
        a.score += 10 * dt;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'sumo-ice-drift',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      iceRadius: state.iceRadius,
      cracks: state.cracks,
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
        alive: p.alive,
        dashTimer: p.dashTimer,
        kos: p.kos,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.4, 0, 1),
        cooldownB: clamp(p.cdB / 2.6, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.kos} KOs · ${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 6. METEOR DODGE X (Skyfall Survival)
// ============================================================================
interface MeteorDodgeState {
  timeLeft: number;
  totalTime: number;
  spawnTimer: number;
  meteors: { id: string; x: number; y: number; r: number; progress: number; gold: boolean }[];
  craters: { x: number; y: number; r: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    z: number;
    alive: boolean;
    respawnTimer: number;
    shieldTimer: number;
    dashTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const meteorDodgeXModule: CompactGameModule<MeteorDodgeState, MeteorDodgeXSnapshot> = {
  id: 'meteor-dodge-x',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      spawnTimer: 0.4,
      meteors: [{ id: 'm-0', x: 600, y: 360, r: 75, progress: 0.2, gold: true }],
      craters: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 340 + (i % 4) * 165,
        y: 300 + Math.floor(i / 4) * 160,
        z: 0,
        alive: true,
        respawnTimer: 0,
        shieldTimer: 0,
        dashTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DODGE RED RINGS — COLLECT GOLDEN STAR CORES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = frenzy ? 0.38 : 0.68;
      state.meteors.push({
        id: `m-${Math.random().toString(36).slice(2, 7)}`,
        x: 160 + Math.random() * (ARENA_WIDTH - 320),
        y: 140 + Math.random() * (ARENA_HEIGHT - 240),
        r: 58 + Math.random() * 44,
        progress: 0,
        gold: Math.random() < 0.26,
      });
    }

    for (let i = state.meteors.length - 1; i >= 0; i--) {
      const m = state.meteors[i];
      m.progress += dt * (frenzy ? 0.95 : 0.72);
      if (m.progress >= 1) {
        if (m.gold) {
          state.craters.push({ x: m.x, y: m.y, r: 28 });
          if (state.craters.length > 6) state.craters.shift();
        }
        for (const p of state.players) {
          if (!p.alive) continue;
          if (dist(p.x, p.y, m.x, m.y) < m.r) {
            if (p.shieldTimer > 0) {
              p.shieldTimer = 0;
              p.score += 40 * mult;
              sounds.push({ type: 'hit', playerId: p.id });
            } else {
              p.alive = false;
              p.respawnTimer = 1.6;
              sounds.push({ type: 'elim' });
            }
          }
        }
        state.meteors.splice(i, 1);
      }
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.shieldTimer = Math.max(0, p.shieldTimer - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.x = 260 + Math.random() * 680;
          p.y = 200 + Math.random() * 340;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.25;
        p.cdA = 1.3;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.shieldTimer = 1.3;
        p.cdB = 4.2;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const spd = p.dashTimer > 0 ? 540 : 300;
      p.x = clamp(p.x + mx * spd * dt, 100, ARENA_WIDTH - 100);
      p.y = clamp(p.y + my * spd * dt, 115, ARENA_HEIGHT - 85);

      for (let i = state.craters.length - 1; i >= 0; i--) {
        if (dist(p.x, p.y, state.craters[i].x, state.craters[i].y) < 40) {
          state.craters.splice(i, 1);
          p.score += 90 * mult;
          state.banner = `${p.name} GRABBED A GOLD STAR CORE!`;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
      p.score += 20 * mult * dt;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'meteor-dodge-x',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      meteors: state.meteors,
      craters: state.craters,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        z: p.z,
        alive: p.alive,
        shieldTimer: p.shieldTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.3, 0, 1),
        cooldownB: clamp(p.cdB / 4.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 7. KING OF HILL NEO (Hill Sovereign)
// ============================================================================
interface KingHillState {
  timeLeft: number;
  totalTime: number;
  zoneX: number;
  zoneY: number;
  zoneR: number;
  zoneVx: number;
  zoneVy: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    inZone: boolean;
    dashTimer: number;
    pulseTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  shockwaves: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  banner: string | null;
}

export const kingOfHillNeoModule: CompactGameModule<KingHillState, KingOfHillNeoSnapshot> = {
  id: 'king-of-hill-neo',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      zoneX: ARENA_WIDTH / 2,
      zoneY: 375,
      zoneR: 135,
      zoneVx: 72,
      zoneVy: 52,
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 240,
          y: 375 + Math.sin(ang) * 165,
          vx: 0,
          vy: 0,
          inZone: false,
          dashTimer: 0,
          pulseTimer: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      shockwaves: [],
      banner: 'HOLD THE MOVING GOLDEN CROWN ZONE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    const zMult = frenzy ? 1.55 : 1;
    state.zoneX += state.zoneVx * zMult * dt;
    state.zoneY += state.zoneVy * zMult * dt;
    if (state.zoneX < 260 || state.zoneX > ARENA_WIDTH - 260) state.zoneVx *= -1;
    if (state.zoneY < 220 || state.zoneY > ARENA_HEIGHT - 190) state.zoneVy *= -1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.pulseTimer = Math.max(0, p.pulseTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.vx += mx * 840 * dt;
      p.vy += my * 840 * dt;

      if (aDown && !p.prevA && p.cdA <= 0 && Math.hypot(mx, my) > 0.1) {
        p.dashTimer = 0.28;
        p.cdA = 1.4;
        const a = Math.atan2(my, mx);
        p.vx += Math.cos(a) * 460;
        p.vy += Math.sin(a) * 460;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.pulseTimer = 0.35;
        p.cdB = 2.8;
        state.shockwaves.push({ x: p.x, y: p.y, radius: 28, colorHex: p.colorHex, alpha: 1 });
        sounds.push({ type: 'hit', playerId: p.id });
        for (const r of state.players) {
          if (r.id === p.id) continue;
          const d = dist(p.x, p.y, r.x, r.y);
          if (d < 165 && d > 0) {
            r.vx += ((r.x - p.x) / d) * 580;
            r.vy += ((r.y - p.y) / d) * 580;
          }
        }
      }
      p.prevA = aDown;
      p.prevB = bDown;

      p.x = clamp(p.x + p.vx * dt, 95, ARENA_WIDTH - 95);
      p.y = clamp(p.y + p.vy * dt, 110, ARENA_HEIGHT - 85);
      p.vx *= Math.pow(0.12, dt);
      p.vy *= Math.pow(0.12, dt);

      p.inZone = dist(p.x, p.y, state.zoneX, state.zoneY) <= state.zoneR;
      if (p.inZone) {
        p.score += 35 * mult * dt;
      }
    }

    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      state.shockwaves[i].radius += 340 * dt;
      state.shockwaves[i].alpha -= dt * 2.2;
      if (state.shockwaves[i].alpha <= 0) state.shockwaves.splice(i, 1);
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'king-of-hill-neo',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      zoneX: state.zoneX,
      zoneY: state.zoneY,
      zoneR: state.zoneR,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        inZone: p.inZone,
        dashTimer: p.dashTimer,
        pulseTimer: p.pulseTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.4, 0, 1),
        cooldownB: clamp(p.cdB / 2.8, 0, 1),
      })),
      shockwaves: state.shockwaves,
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} crown pts`);
  },
};

// ============================================================================
// 8. LASER MAZE HEIST (Vault Lasers)
// ============================================================================
interface LaserMazeState {
  timeLeft: number;
  totalTime: number;
  sweepers: { x: number; y: number; angle: number; speed: number; length: number }[];
  diamonds: { id: string; x: number; y: number; value: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    crouching: boolean;
    stunTimer: number;
    gems: number;
    score: number;
    cdA: number;
    cdB: number;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const laserMazeHeistModule: CompactGameModule<LaserMazeState, LaserMazeHeistSnapshot> = {
  id: 'laser-maze-heist',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      sweepers: [
        { x: 360, y: 375, angle: 0, speed: 1.35, length: 245 },
        { x: 600, y: 375, angle: 1.8, speed: -1.55, length: 265 },
        { x: 840, y: 375, angle: 3.1, speed: 1.45, length: 245 },
      ],
      diamonds: Array.from({ length: 6 }, (_, i) => ({
        id: `dm-${i}`,
        x: 200 + Math.random() * (ARENA_WIDTH - 400),
        y: 165 + Math.random() * (ARENA_HEIGHT - 290),
        value: i === 0 ? 120 : 75,
      })),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 170 + (i % 4) * 260,
        y: 590,
        crouching: false,
        stunTimer: 0,
        gems: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevB: false,
      })),
      banner: 'HOLD DUCK (A) UNDER RED LASERS & SNATCH DIAMONDS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    while (state.diamonds.length < 6) {
      state.diamonds.push({
        id: `dm-${Math.random().toString(36).slice(2, 7)}`,
        x: 180 + Math.random() * (ARENA_WIDTH - 360),
        y: 155 + Math.random() * (ARENA_HEIGHT - 260),
        value: Math.random() < 0.25 ? 120 : 75,
      });
    }

    for (const sw of state.sweepers) {
      sw.angle += sw.speed * (frenzy ? 1.45 : 1) * dt;
    }

    for (const p of state.players) {
      p.cdB = Math.max(0, p.cdB - dt);
      p.stunTimer = Math.max(0, p.stunTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.crouching = aDown && p.stunTimer <= 0;
      if (p.stunTimer <= 0) {
        const spd = p.crouching ? 150 : 295;
        p.x = clamp(p.x + mx * spd * dt, 100, ARENA_WIDTH - 100);
        p.y = clamp(p.y + my * spd * dt, 115, ARENA_HEIGHT - 85);

        if (bDown && !p.prevB && p.cdB <= 0) {
          const ang = Math.hypot(mx, my) > 0.1 ? Math.atan2(my, mx) : 0;
          p.x = clamp(p.x + Math.cos(ang) * 125, 100, ARENA_WIDTH - 100);
          p.y = clamp(p.y + Math.sin(ang) * 125, 115, ARENA_HEIGHT - 85);
          p.cdB = 2.6;
          sounds.push({ type: 'dash', playerId: p.id });
        }
      }
      p.prevB = bDown;

      for (let i = state.diamonds.length - 1; i >= 0; i--) {
        if (dist(p.x, p.y, state.diamonds[i].x, state.diamonds[i].y) < 36) {
          const d = state.diamonds[i];
          p.gems += 1;
          p.score += d.value * mult;
          state.diamonds.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      if (!p.crouching && p.stunTimer <= 0) {
        for (const sw of state.sweepers) {
          const bx = Math.cos(sw.angle);
          const by = Math.sin(sw.angle);
          const rx = p.x - sw.x;
          const ry = p.y - sw.y;
          const proj = clamp(rx * bx + ry * by, 0, sw.length);
          const cx = sw.x + bx * proj;
          const cy = sw.y + by * proj;
          if (dist(p.x, p.y, cx, cy) < 22) {
            p.stunTimer = 1.2;
            p.score = Math.max(0, p.score - 25);
            state.banner = `${p.name} TRIPPED THE VAULT ALARM!`;
            sounds.push({ type: 'hit' });
            break;
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'laser-maze-heist',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      sweepers: state.sweepers.map((s) => ({ x: s.x, y: s.y, angle: s.angle, length: s.length })),
      diamonds: state.diamonds,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        crouching: p.crouching,
        stunTimer: p.stunTimer,
        gems: p.gems,
        score: p.score,
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 2.6, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.gems} gems · ${p.score} pts`);
  },
};

// ============================================================================
// 9. ZOMBIE OUTBREAK (Infection Wave)
// ============================================================================
interface ZombieState {
  timeLeft: number;
  totalTime: number;
  cureOrbs: { id: string; x: number; y: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    infected: boolean;
    dashTimer: number;
    repelTimer: number;
    infections: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const zombieOutbreakModule: CompactGameModule<ZombieState, ZombieOutbreakSnapshot> = {
  id: 'zombie-outbreak',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      cureOrbs: Array.from({ length: 4 }, (_, i) => ({
        id: `co-${i}`,
        x: 240 + i * 230,
        y: 260 + (i % 2) * 210,
      })),
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 260,
          y: 375 + Math.sin(ang) * 180,
          angle: ang + Math.PI,
          infected: i === 0,
          dashTimer: 0,
          repelTimer: 0,
          infections: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'PATIENT ZERO HUNTING! SURVIVE OR INFECT EVERYONE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    while (state.cureOrbs.length < 4) {
      state.cureOrbs.push({
        id: `co-${Math.random().toString(36).slice(2, 7)}`,
        x: 160 + Math.random() * (ARENA_WIDTH - 320),
        y: 155 + Math.random() * (ARENA_HEIGHT - 260),
      });
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.repelTimer = Math.max(0, p.repelTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.28;
        p.cdA = 1.6;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.repelTimer = 0.3;
        p.cdB = 3.0;
        for (const r of state.players) {
          if (r.id === p.id) continue;
          const d = dist(p.x, p.y, r.x, r.y);
          if (d < 130 && d > 0) {
            r.x = clamp(r.x + ((r.x - p.x) / d) * 115, 95, ARENA_WIDTH - 95);
            r.y = clamp(r.y + ((r.y - p.y) / d) * 115, 110, ARENA_HEIGHT - 85);
          }
        }
        sounds.push({ type: 'hit', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const baseSpd = (p.infected ? 320 : 285) * (frenzy ? 1.25 : 1);
      const spd = p.dashTimer > 0 ? baseSpd * 1.6 : baseSpd;
      if (Math.hypot(mx, my) > 0.15) {
        p.angle = Math.atan2(my, mx);
        p.x = clamp(p.x + mx * spd * dt, 95, ARENA_WIDTH - 95);
        p.y = clamp(p.y + my * spd * dt, 110, ARENA_HEIGHT - 85);
      }

      if (!p.infected) {
        p.score += 22 * mult * dt;
        for (let i = state.cureOrbs.length - 1; i >= 0; i--) {
          if (dist(p.x, p.y, state.cureOrbs[i].x, state.cureOrbs[i].y) < 34) {
            state.cureOrbs.splice(i, 1);
            p.score += 75 * mult;
            sounds.push({ type: 'score', playerId: p.id });
          }
        }
      }
    }

    for (const z of state.players.filter((pl) => pl.infected)) {
      for (const h of state.players.filter((pl) => !pl.infected)) {
        if (dist(z.x, z.y, h.x, h.y) < 38) {
          h.infected = true;
          z.infections += 1;
          z.score += 140 * mult;
          state.banner = `${z.name} INFECTED ${h.name}!`;
          sounds.push({ type: 'elim', playerId: z.id });
        }
      }
    }

    // If all infected with >1 player, cure everyone except a fresh random Patient Zero!
    if (state.players.length > 1 && state.players.every((p) => p.infected)) {
      const nextZero = state.players[Math.floor(Math.random() * state.players.length)];
      state.players.forEach((p) => {
        p.infected = p.id === nextZero.id;
      });
      state.banner = `NEW WAVE! ${nextZero.name} IS PATIENT ZERO!`;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'zombie-outbreak',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cureOrbs: state.cureOrbs,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        infected: p.infected,
        dashTimer: p.dashTimer,
        repelTimer: p.repelTimer,
        infections: p.infections,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.6, 0, 1),
        cooldownB: clamp(p.cdB / 3.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.infections} tags · ${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 10. FALLING ANVILS (Anvil Rain)
// ============================================================================
interface FallingAnvilsState {
  timeLeft: number;
  totalTime: number;
  spawnTimer: number;
  anvils: { id: string; x: number; y: number; r: number; progress: number; gold: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    alive: boolean;
    respawnTimer: number;
    shoveTimer: number;
    dashTimer: number;
    lastShovedBy: string | null;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const fallingAnvilsModule: CompactGameModule<FallingAnvilsState, FallingAnvilsSnapshot> = {
  id: 'falling-anvils',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      spawnTimer: 0.4,
      anvils: [{ id: 'a-0', x: 600, y: 360, r: 58, progress: 0.25, gold: true }],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 320 + (i % 4) * 180,
        y: 310 + Math.floor(i / 4) * 140,
        alive: true,
        respawnTimer: 0,
        shoveTimer: 0,
        dashTimer: 0,
        lastShovedBy: null,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'SHOVE (B) RIVALS UNDER FALLING ANVIL SHADOWS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = frenzy ? 0.34 : 0.62;
      state.anvils.push({
        id: `a-${Math.random().toString(36).slice(2, 7)}`,
        x: 150 + Math.random() * (ARENA_WIDTH - 300),
        y: 145 + Math.random() * (ARENA_HEIGHT - 245),
        r: 50 + Math.random() * 26,
        progress: 0,
        gold: frenzy || Math.random() < 0.2,
      });
    }

    for (let i = state.anvils.length - 1; i >= 0; i--) {
      const av = state.anvils[i];
      av.progress += dt * (frenzy ? 1.15 : 0.85);
      if (av.progress >= 1) {
        sounds.push({ type: 'hit' });
        for (const p of state.players) {
          if (!p.alive) continue;
          if (dist(p.x, p.y, av.x, av.y) < av.r) {
            p.alive = false;
            p.respawnTimer = 1.65;
            const shover = state.players.find((pl) => pl.id === p.lastShovedBy);
            if (shover) {
              shover.score += 130 * mult;
              state.banner = `${shover.name} TRAPPED ${p.name} UNDER AN ANVIL!`;
              sounds.push({ type: 'score', playerId: shover.id });
            } else {
              sounds.push({ type: 'elim' });
            }
          }
        }
        state.anvils.splice(i, 1);
      }
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.shoveTimer = Math.max(0, p.shoveTimer - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.x = 260 + Math.random() * 680;
          p.y = 200 + Math.random() * 340;
          p.lastShovedBy = null;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.25;
        p.cdA = 1.4;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.shoveTimer = 0.25;
        p.cdB = 1.8;
        for (const r of state.players) {
          if (r.id === p.id || !r.alive) continue;
          const d = dist(p.x, p.y, r.x, r.y);
          if (d < 85 && d > 0) {
            r.x = clamp(r.x + ((r.x - p.x) / d) * 115, 100, ARENA_WIDTH - 100);
            r.y = clamp(r.y + ((r.y - p.y) / d) * 115, 115, ARENA_HEIGHT - 85);
            r.lastShovedBy = p.id;
          }
        }
        sounds.push({ type: 'hit', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const spd = p.dashTimer > 0 ? 520 : 295;
      p.x = clamp(p.x + mx * spd * dt, 100, ARENA_WIDTH - 100);
      p.y = clamp(p.y + my * spd * dt, 115, ARENA_HEIGHT - 85);
      p.score += 22 * mult * dt;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'falling-anvils',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      anvils: state.anvils,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        alive: p.alive,
        shoveTimer: p.shoveTimer,
        dashTimer: p.dashTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.4, 0, 1),
        cooldownB: clamp(p.cdB / 1.8, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 11. SEESAW BALANCE (Seesaw Tilt)
// ============================================================================
interface SeesawState {
  timeLeft: number;
  totalTime: number;
  beamTilt: number;
  beamVel: number;
  coins: { id: string; offset: number; value: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    offset: number;
    vx: number;
    z: number;
    vz: number;
    gripping: boolean;
    alive: boolean;
    respawnTimer: number;
    stompTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
  }[];
  banner: string | null;
}

export const seesawBalanceModule: CompactGameModule<SeesawState, SeesawBalanceSnapshot> = {
  id: 'seesaw-balance',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      beamTilt: 0,
      beamVel: 0,
      coins: [
        { id: 'sc-1', offset: -280, value: 60 },
        { id: 'sc-2', offset: 0, value: 80 },
        { id: 'sc-3', offset: 280, value: 60 },
      ],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        offset: -240 + ((i + 0.5) / count) * 480,
        vx: 0,
        z: 0,
        vz: 0,
        gripping: false,
        alive: true,
        respawnTimer: 0,
        stompTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
      })),
      banner: 'BALANCE THE SKY SEESAW & HOLD GRIP (B) ON STEEP SLOPES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    while (state.coins.length < 4) {
      state.coins.push({
        id: `sc-${Math.random().toString(36).slice(2, 7)}`,
        offset: (Math.random() - 0.5) * 700,
        value: 75,
      });
    }

    let torque = Math.sin((state.totalTime - state.timeLeft) * 1.4) * (frenzy ? 0.35 : 0.14);
    for (const p of state.players) {
      if (p.alive) torque += (p.offset / 420) * 0.45;
    }
    state.beamVel += (torque - state.beamTilt * 1.45) * dt * 2.4;
    state.beamVel *= Math.pow(0.25, dt);
    state.beamTilt = clamp(state.beamTilt + state.beamVel * dt, -0.52, 0.52);

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.stompTimer = Math.max(0, p.stompTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.offset = (Math.random() - 0.5) * 160;
          p.vx = 0;
          p.z = 30;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.gripping = bDown;
      if (aDown && !p.prevA && p.z <= 1 && p.cdA <= 0) {
        p.vz = 420;
        p.stompTimer = 0.3;
        p.cdA = 1.4;
        for (const r of state.players) {
          if (r.id === p.id || !r.alive) continue;
          if (Math.abs(r.offset - p.offset) < 120) {
            r.vz = 240;
            r.vx += Math.sign(r.offset - p.offset || 1) * 260;
          }
        }
        sounds.push({ type: 'hit', playerId: p.id });
      }
      p.prevA = aDown;

      const gravSlide = Math.sin(state.beamTilt) * (p.gripping ? 180 : 620);
      p.vx += (mx * (p.gripping ? 220 : 640) + gravSlide) * dt;
      p.vx *= Math.pow(0.18, dt);
      p.offset += p.vx * dt;

      p.vz -= 980 * dt;
      p.z = Math.max(0, p.z + p.vz * dt);

      for (let i = state.coins.length - 1; i >= 0; i--) {
        if (Math.abs(p.offset - state.coins[i].offset) < 38) {
          p.score += state.coins[i].value * mult;
          state.coins.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      if (Math.abs(p.offset) > 435) {
        p.alive = false;
        p.respawnTimer = 1.6;
        state.banner = `${p.name} SLID OFF THE SEESAW!`;
        sounds.push({ type: 'elim' });
      } else {
        p.score += 18 * mult * dt;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'seesaw-balance',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      beamTilt: state.beamTilt,
      coins: state.coins,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        offset: p.offset,
        z: p.z,
        alive: p.alive,
        stompTimer: p.stompTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.4, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 12. CHAIN GANG CLIMB (Chain Dash)
// ============================================================================
interface ChainDashState {
  timeLeft: number;
  totalTime: number;
  scrollY: number;
  spawnTimer: number;
  hazards: { id: string; x: number; y: number; r: number }[];
  stars: { id: string; x: number; y: number; value: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    alive: boolean;
    respawnTimer: number;
    pulling: boolean;
    dashTimer: number;
    score: number;
    cdA: number;
    prevA: boolean;
  }[];
  banner: string | null;
}

export const chainGangClimbModule: CompactGameModule<ChainDashState, ChainGangClimbSnapshot> = {
  id: 'chain-gang-climb',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      scrollY: 0,
      spawnTimer: 0.4,
      hazards: [
        { id: 'hz-0', x: 420, y: 180, r: 34 },
        { id: 'hz-1', x: 780, y: 240, r: 34 },
      ],
      stars: [
        { id: 'st-0', x: 600, y: 220, value: 80 },
      ],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 360 + ((i + 0.5) / count) * 480,
        y: 470,
        alive: true,
        respawnTimer: 0,
        pulling: false,
        dashTimer: 0,
        score: 0,
        cdA: 0,
        prevA: false,
      })),
      banner: 'DODGE CANYON BUZZ-SAWS & RIDE THE ELASTIC TETHER!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    const scrollSpd = frenzy ? 260 : 185;
    state.scrollY += scrollSpd * dt;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = frenzy ? 0.65 : 0.95;
      state.hazards.push({
        id: `hz-${Math.random().toString(36).slice(2, 7)}`,
        x: 180 + Math.random() * (ARENA_WIDTH - 360),
        y: -40,
        r: 32,
      });
      if (Math.random() < 0.75) {
        state.stars.push({
          id: `st-${Math.random().toString(36).slice(2, 7)}`,
          x: 200 + Math.random() * (ARENA_WIDTH - 400),
          y: -40,
          value: 80,
        });
      }
    }

    for (let i = state.hazards.length - 1; i >= 0; i--) {
      state.hazards[i].y += scrollSpd * dt;
      if (state.hazards[i].y > ARENA_HEIGHT + 60) state.hazards.splice(i, 1);
    }
    for (let i = state.stars.length - 1; i >= 0; i--) {
      state.stars[i].y += scrollSpd * dt;
      if (state.stars[i].y > ARENA_HEIGHT + 60) state.stars.splice(i, 1);
    }

    const alivePlayers = state.players.filter((p) => p.alive);
    const avgX = alivePlayers.reduce((s, p) => s + p.x, 0) / Math.max(1, alivePlayers.length);
    const avgY = alivePlayers.reduce((s, p) => s + p.y, 0) / Math.max(1, alivePlayers.length);

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.x = avgX;
          p.y = Math.min(560, avgY + 40);
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.pulling = aDown;
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.25;
        p.cdA = 1.4;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;

      const spd = p.dashTimer > 0 ? 520 : bDown ? 140 : 285;
      p.x = clamp(p.x + mx * spd * dt, 110, ARENA_WIDTH - 110);
      p.y = clamp(p.y + my * spd * dt, 130, ARENA_HEIGHT - 85);

      // Gentle elastic tether toward team center
      if (!bDown && dist(p.x, p.y, avgX, avgY) > 190) {
        p.x += (avgX - p.x) * 1.1 * dt;
        p.y += (avgY - p.y) * 1.1 * dt;
      }

      for (let i = state.stars.length - 1; i >= 0; i--) {
        if (dist(p.x, p.y, state.stars[i].x, state.stars[i].y) < 38) {
          p.score += state.stars[i].value * mult;
          state.stars.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      for (const h of state.hazards) {
        if (dist(p.x, p.y, h.x, h.y) < h.r + 16) {
          p.alive = false;
          p.respawnTimer = 1.65;
          p.score = Math.max(0, p.score - 25);
          state.banner = `${p.name} HIT A CANYON SAW!`;
          sounds.push({ type: 'elim' });
          break;
        }
      }
      p.score += 18 * mult * dt;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'chain-gang-climb',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      scrollY: state.scrollY,
      hazards: state.hazards,
      stars: state.stars,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        alive: p.alive,
        pulling: p.pulling,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.4, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 13. CONFETTI CAPTURE (Color Turf War)
// ============================================================================
interface ConfettiCaptureState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  cells: number[];
  bombs: { id: string; x: number; y: number; slotIndex: number; colorHex: string; fuse: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    dashTimer: number;
    tilesOwned: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const confettiCaptureModule: CompactGameModule<ConfettiCaptureState, ConfettiCaptureSnapshot> = {
  id: 'confetti-capture',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const cols = 16;
    const rows = 10;
    return {
      timeLeft: totalTime,
      totalTime,
      cols,
      rows,
      cells: new Array(cols * rows).fill(-1),
      bombs: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 240 + (i % 4) * 240,
        y: 230 + Math.floor(i / 4) * 240,
        angle: 0,
        dashTimer: 0,
        tilesOwned: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'PAINT FLOOR TILES & DROP CONFETTI BOMBS (A)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    const ax = 120;
    const ay = 105;
    const aw = ARENA_WIDTH - 240;
    const ah = ARENA_HEIGHT - 190;
    const cw = aw / state.cols;
    const ch = ah / state.rows;

    const paintCell = (col: number, row: number, slot: number) => {
      if (col >= 0 && col < state.cols && row >= 0 && row < state.rows) {
        state.cells[row * state.cols + col] = slot;
      }
    };

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.cdA = frenzy ? 1.5 : 2.5;
        state.bombs.push({
          id: `cb-${Math.random().toString(36).slice(2, 6)}`,
          x: p.x,
          y: p.y,
          slotIndex: p.slotIndex,
          colorHex: p.colorHex,
          fuse: 1.2,
        });
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.dashTimer = 1.4;
        p.cdB = 3.5;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const spd = p.dashTimer > 0 ? 430 : 300;
      if (Math.hypot(mx, my) > 0.14) p.angle = Math.atan2(my, mx);
      p.x = clamp(p.x + mx * spd * dt, ax + 18, ax + aw - 18);
      p.y = clamp(p.y + my * spd * dt, ay + 18, ay + ah - 18);

      const col = Math.floor((p.x - ax) / cw);
      const row = Math.floor((p.y - ay) / ch);
      paintCell(col, row, p.slotIndex);
      if (p.dashTimer > 0) {
        paintCell(col - 1, row, p.slotIndex);
        paintCell(col + 1, row, p.slotIndex);
      }
    }

    for (let i = state.bombs.length - 1; i >= 0; i--) {
      const bm = state.bombs[i];
      bm.fuse -= dt;
      if (bm.fuse <= 0) {
        const col = Math.floor((bm.x - ax) / cw);
        const row = Math.floor((bm.y - ay) / ch);
        const rad = frenzy ? 2 : 1;
        for (let dy = -rad; dy <= rad; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            paintCell(col + dx, row + dy, bm.slotIndex);
          }
        }
        sounds.push({ type: 'score' });
        state.bombs.splice(i, 1);
      }
    }

    for (const p of state.players) {
      let count = 0;
      for (const c of state.cells) if (c === p.slotIndex) count++;
      p.tilesOwned = count;
      p.score = count * 12 * mult;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'confetti-capture',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: state.cols,
      rows: state.rows,
      cells: state.cells,
      bombs: state.bombs,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        dashTimer: p.dashTimer,
        tilesOwned: p.tilesOwned,
        score: p.score,
        cooldownA: clamp(p.cdA / 2.5, 0, 1),
        cooldownB: clamp(p.cdB / 3.5, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.tilesOwned} tiles · ${p.score} pts`);
  },
};

// ============================================================================
// 14. CRANE DROP CHAOS (Wrecking Arena)
// ============================================================================
interface CraneDropState {
  timeLeft: number;
  totalTime: number;
  ballAngles: number[];
  balls: { x: number; y: number; r: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    alive: boolean;
    respawnTimer: number;
    dashTimer: number;
    shieldTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const craneDropChaosModule: CompactGameModule<CraneDropState, CraneDropChaosSnapshot> = {
  id: 'crane-drop-chaos',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const count = Math.max(1, players.length);
    return {
      timeLeft: totalTime,
      totalTime,
      ballAngles: [Math.PI / 3, Math.PI + Math.PI / 3, -Math.PI / 2],
      balls: [
        { x: ARENA_WIDTH / 2 + Math.cos(Math.PI / 3) * 165, y: 375 + Math.sin(Math.PI / 3) * 165, r: 38 },
        { x: ARENA_WIDTH / 2 + Math.cos(Math.PI + Math.PI / 3) * 225, y: 375 + Math.sin(Math.PI + Math.PI / 3) * 225, r: 38 },
      ],
      players: players.map((p, i) => {
        const ang = (i / count) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 145,
          y: 375 + Math.sin(ang) * 145,
          vx: 0,
          vy: 0,
          alive: true,
          respawnTimer: 0,
          dashTimer: 0,
          shieldTimer: 0.9,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'EVADE SWINGING STEEL WRECKING BALLS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    const elapsed = state.totalTime - state.timeLeft;

    const ballCount = frenzy ? 3 : elapsed > state.totalTime * 0.45 ? 3 : 2;
    state.ballAngles[0] += (1.7 + elapsed * 0.015) * dt;
    state.ballAngles[1] -= (1.5 + elapsed * 0.014) * dt;
    state.ballAngles[2] += 2.2 * dt;

    const radii = [165, 225, 110];
    state.balls = Array.from({ length: ballCount }, (_, i) => ({
      x: ARENA_WIDTH / 2 + Math.cos(state.ballAngles[i]) * radii[i],
      y: 375 + Math.sin(state.ballAngles[i]) * radii[i],
      r: 38,
    }));

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.shieldTimer = Math.max(0, p.shieldTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.x = ARENA_WIDTH / 2 + (Math.random() - 0.5) * 140;
          p.y = 375 + (Math.random() - 0.5) * 140;
          p.vx = 0;
          p.vy = 0;
          p.shieldTimer = 1.1;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.25;
        p.cdA = 1.4;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.shieldTimer = 1.1;
        p.cdB = 3.8;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const spd = p.dashTimer > 0 ? 520 : 295;
      p.x += mx * spd * dt + p.vx * dt;
      p.y += my * spd * dt + p.vy * dt;
      p.vx *= Math.pow(0.12, dt);
      p.vy *= Math.pow(0.12, dt);

      for (const b of state.balls) {
        if (dist(p.x, p.y, b.x, b.y) < b.r + 18) {
          if (p.shieldTimer > 0) {
            p.shieldTimer = 0;
            const ang = Math.atan2(p.y - b.y, p.x - b.x);
            p.vx = Math.cos(ang) * 380;
            p.vy = Math.sin(ang) * 380;
            p.score += 35 * mult;
            sounds.push({ type: 'hit', playerId: p.id });
          } else {
            p.alive = false;
            p.respawnTimer = 1.65;
            state.banner = `${p.name} GOT WRECKED!`;
            sounds.push({ type: 'elim' });
            break;
          }
        }
      }

      if (dist(p.x, p.y, ARENA_WIDTH / 2, 375) > 275) {
        p.alive = false;
        p.respawnTimer = 1.65;
        sounds.push({ type: 'elim' });
      } else if (p.alive) {
        p.score += 22 * mult * dt;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'crane-drop-chaos',
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
        vx: p.vx,
        vy: p.vy,
        alive: p.alive,
        dashTimer: p.dashTimer,
        shieldTimer: p.shieldTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.4, 0, 1),
        cooldownB: clamp(p.cdB / 3.8, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 15. ROULETTE ARENA (Trapdoor Fate)
// ============================================================================
interface RouletteState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  tileStates: number[];
  phase: 'warn' | 'open';
  countdown: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    alive: boolean;
    respawnTimer: number;
    shoveTimer: number;
    dashTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const rouletteArenaModule: CompactGameModule<RouletteState, RouletteArenaSnapshot> = {
  id: 'roulette-arena',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const cols = 6;
    const rows = 4;
    const tileStates = new Array(cols * rows).fill(0);
    for (let i = 0; i < 8; i++) {
      tileStates[Math.floor(Math.random() * tileStates.length)] = 1;
    }
    return {
      timeLeft: totalTime,
      totalTime,
      cols,
      rows,
      tileStates,
      phase: 'warn',
      countdown: 3.0,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 280 + (i % 4) * 200,
        y: 260 + Math.floor(i / 4) * 210,
        alive: true,
        respawnTimer: 0,
        shoveTimer: 0,
        dashTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'RUN OFF BLINKING RED TRAPDOORS BEFORE THEY DROP!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.countdown -= dt;
    const mult = frenzy ? 2 : 1;

    if (state.countdown <= 0) {
      if (state.phase === 'warn') {
        state.phase = 'open';
        state.countdown = 1.65;
        state.tileStates = state.tileStates.map((s) => (s === 1 ? 2 : 0));
        state.banner = 'TRAPDOORS OPENED!';
        sounds.push({ type: 'hit' });
      } else {
        state.phase = 'warn';
        state.countdown = frenzy ? 2.1 : 2.9;
        state.tileStates = new Array(state.cols * state.rows).fill(0);
        const badCount = frenzy ? 13 : 9;
        for (let i = 0; i < badCount; i++) {
          state.tileStates[Math.floor(Math.random() * state.tileStates.length)] = 1;
        }
        for (const p of state.players) {
          if (p.alive) p.score += 60 * mult;
        }
        state.banner = 'FIND A SOLID GREEN SQUARE!';
        sounds.push({ type: 'score' });
      }
    }

    const ax = 180;
    const ay = 135;
    const aw = ARENA_WIDTH - 360;
    const ah = ARENA_HEIGHT - 230;
    const cw = aw / state.cols;
    const ch = ah / state.rows;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.shoveTimer = Math.max(0, p.shoveTimer - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          const safeIdx = Math.max(0, state.tileStates.findIndex((s) => s !== 2));
          const c = safeIdx % state.cols;
          const r = Math.floor(safeIdx / state.cols);
          p.x = ax + (c + 0.5) * cw;
          p.y = ay + (r + 0.5) * ch;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.25;
        p.cdA = 1.4;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.shoveTimer = 0.25;
        p.cdB = 1.8;
        for (const r of state.players) {
          if (r.id === p.id || !r.alive) continue;
          const d = dist(p.x, p.y, r.x, r.y);
          if (d < 85 && d > 0) {
            r.x = clamp(r.x + ((r.x - p.x) / d) * 105, ax + 15, ax + aw - 15);
            r.y = clamp(r.y + ((r.y - p.y) / d) * 105, ay + 15, ay + ah - 15);
          }
        }
        sounds.push({ type: 'hit', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const spd = p.dashTimer > 0 ? 520 : 295;
      p.x = clamp(p.x + mx * spd * dt, ax + 12, ax + aw - 12);
      p.y = clamp(p.y + my * spd * dt, ay + 12, ay + ah - 12);

      const c = clamp(Math.floor((p.x - ax) / cw), 0, state.cols - 1);
      const r = clamp(Math.floor((p.y - ay) / ch), 0, state.rows - 1);
      if (state.tileStates[r * state.cols + c] === 2) {
        p.alive = false;
        p.respawnTimer = 1.6;
        state.banner = `${p.name} DROPPED THROUGH A TRAPDOOR!`;
        sounds.push({ type: 'elim' });
      } else {
        p.score += 18 * mult * dt;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'roulette-arena',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: state.cols,
      rows: state.rows,
      tileStates: state.tileStates,
      countdown: state.countdown,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        alive: p.alive,
        shoveTimer: p.shoveTimer,
        dashTimer: p.dashTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.4, 0, 1),
        cooldownB: clamp(p.cdB / 1.8, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} pts`);
  },
};
