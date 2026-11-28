import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/shared/types.ts';
import type {
  BlobDevourSnapshot,
  DinoDashSnapshot,
  FlappyFlockSnapshot,
  GeoPinRushSnapshot,
  GlassBridgeSnapshot,
  MineSweepDuelSnapshot,
  SkyClimbSnapshot,
  SlitherFeastSnapshot,
  Tile2048BlitzSnapshot,
  TugTitanSnapshot,
  TurfRibbonSnapshot,
  WavelengthSyncSnapshot,
} from '../../src/shared/packGlobalViralTypes.ts';
import type {
  CompactGameModule,
  CompactPlayerInit,
  CompactPlayerInput,
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
// 1. SKY CLIMB (Only Up! / Chained Together vertical parkour)
// ============================================================================
interface SkyPlatform {
  id: string;
  x: number;
  y: number;
  w: number;
  vx: number;
  kind: 'beam' | 'cloud' | 'moving' | 'boost' | 'crumble';
  broken: boolean;
  crumbleTimer: number;
}
interface SkyClimbState {
  timeLeft: number;
  totalTime: number;
  cameraY: number;
  goalHeight: number;
  platforms: SkyPlatform[];
  collectibles: { id: string; x: number; y: number; value: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    altitude: number;
    bestAltitude: number;
    grounded: boolean;
    grappling: boolean;
    grappleTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const skyClimbModule: CompactGameModule<SkyClimbState, SkyClimbSnapshot> = {
  id: 'sky-climb',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const platforms: SkyPlatform[] = [
      { id: 'base', x: ARENA_WIDTH / 2, y: 660, w: 980, vx: 0, kind: 'beam', broken: false, crumbleTimer: 0 },
    ];
    const collectibles: { id: string; x: number; y: number; value: number }[] = [];
    for (let i = 1; i <= 55; i++) {
      const y = 660 - i * 96;
      const x = 180 + ((i * 257 + Math.floor(Math.random() * 140)) % (ARENA_WIDTH - 360));
      const r = Math.random();
      const kind: SkyPlatform['kind'] =
        r < 0.16 ? 'boost' : r < 0.34 ? 'moving' : r < 0.5 ? 'crumble' : r < 0.72 ? 'cloud' : 'beam';
      platforms.push({
        id: `sp_${i}`,
        x,
        y,
        w: kind === 'boost' ? 120 : kind === 'cloud' ? 145 : 170,
        vx: kind === 'moving' ? (i % 2 === 0 ? 1 : -1) * (95 + (i % 4) * 20) : 0,
        kind,
        broken: false,
        crumbleTimer: 0,
      });
      if (i % 3 === 0) {
        collectibles.push({ id: `sc_${i}`, x, y: y - 46, value: 40 });
      }
    }
    return {
      timeLeft: totalTime,
      totalTime,
      cameraY: 0,
      goalHeight: 5200,
      platforms,
      collectibles,
      players: players.map((p, idx) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 280 + (idx * 90) % 640,
        y: 632,
        vx: 0,
        vy: 0,
        altitude: 0,
        bestAltitude: 0,
        grounded: true,
        grappling: false,
        grappleTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'CLIMB TO THE SKY!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const plat of state.platforms) {
      if (plat.vx !== 0) {
        plat.x += plat.vx * dt;
        if (plat.x < 110 || plat.x > ARENA_WIDTH - 110) plat.vx *= -1;
      }
      if (plat.crumbleTimer > 0) {
        plat.crumbleTimer -= dt;
        if (plat.crumbleTimer <= 0) plat.broken = true;
      }
    }

    let highestY = 660;
    for (const p of state.players) {
      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      const aPressed = aDown && !p.prevA;
      const bPressed = bDown && !p.prevB;
      p.prevA = aDown;
      p.prevB = bDown;
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      if (p.grappleTimer > 0) {
        p.grappleTimer -= dt;
        if (p.grappleTimer <= 0) p.grappling = false;
      }

      p.vx = mx * 380;
      if (aPressed && (p.grounded || p.cdA <= 0)) {
        p.vy = -560;
        p.grounded = false;
        p.cdA = 0.55;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bPressed && p.cdB <= 0) {
        // Grapple toward nearest platform above
        const above = state.platforms
          .filter((pl) => !pl.broken && pl.y < p.y - 25 && pl.y > p.y - 260)
          .sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y))[0];
        if (above) {
          p.vx = (above.x - p.x) * 3.2;
          p.vy = -660;
          p.grappling = true;
          p.grappleTimer = 0.35;
          p.cdB = frenzy ? 1.8 : 3.2;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      const prevY = p.y;
      p.vy += 1180 * dt;
      p.x = clamp(p.x + p.vx * dt, 30, ARENA_WIDTH - 30);
      p.y += p.vy * dt;
      p.grounded = false;

      if (p.vy >= 0) {
        for (const plat of state.platforms) {
          if (plat.broken) continue;
          if (
            prevY <= plat.y - 12 &&
            p.y >= plat.y - 20 &&
            Math.abs(p.x - plat.x) <= plat.w / 2 + 14
          ) {
            p.y = plat.y - 20;
            if (plat.kind === 'boost') {
              p.vy = -860;
              p.grounded = false;
              sounds.push({ type: 'dash', playerId: p.id });
            } else {
              p.vy = 0;
              p.grounded = true;
              if (plat.kind === 'crumble' && plat.crumbleTimer === 0) {
                plat.crumbleTimer = 0.75;
              }
            }
            break;
          }
        }
      }

      // Catch falls at base
      if (p.y > 640) {
        p.y = 640;
        p.vy = 0;
        p.grounded = true;
      }

      const alt = Math.max(0, Math.round((640 - p.y) / 10));
      p.altitude = alt;
      if (alt > p.bestAltitude) {
        p.score += (alt - p.bestAltitude) * 2 * mult;
        p.bestAltitude = alt;
      }
      if (p.y < highestY) highestY = p.y;

      for (let i = state.collectibles.length - 1; i >= 0; i--) {
        const c = state.collectibles[i];
        if (dist(p.x, p.y, c.x, c.y) < 34) {
          p.score += c.value * mult;
          state.collectibles.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
    }

    const targetCam = Math.min(0, highestY - 290);
    state.cameraY += (targetCam - state.cameraY) * Math.min(1, dt * 5);
    const leader = [...state.players].sort((a, b) => b.bestAltitude - a.bestAltitude)[0];
    state.banner = leader ? `${leader.name} · ${leader.bestAltitude}m PEAK!` : null;

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'sky-climb',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cameraY: state.cameraY,
      goalHeight: state.goalHeight,
      platforms: state.platforms
        .filter((pl) => pl.y - state.cameraY > -120 && pl.y - state.cameraY < ARENA_HEIGHT + 140)
        .map((pl) => ({ id: pl.id, x: pl.x, y: pl.y, w: pl.w, kind: pl.kind, broken: pl.broken })),
      collectibles: state.collectibles.filter(
        (c) => c.y - state.cameraY > -80 && c.y - state.cameraY < ARENA_HEIGHT + 80
      ),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        altitude: p.altitude,
        bestAltitude: p.bestAltitude,
        grounded: p.grounded,
        grappling: p.grappling,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.55, 0, 1),
        cooldownB: clamp(p.cdB / 3.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.bestAltitude}m Peak`);
  },
};

// ============================================================================
// 2. SLITHER FEAST (Slither.io)
// ============================================================================
interface SlitherSnake {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  alive: boolean;
  respawnTimer: number;
  boosting: boolean;
  angle: number;
  length: number;
  score: number;
  kills: number;
  segments: { x: number; y: number }[];
  cdB: number;
  prevB: boolean;
}
interface SlitherFeastState {
  timeLeft: number;
  totalTime: number;
  pellets: { x: number; y: number; r: number; colorHex: string; value: number }[];
  snakes: SlitherSnake[];
  banner: string | null;
}

const ORB_COLORS = ['#22C55E', '#38BDF8', '#FACC15', '#FB7185', '#A855F7', '#F97316'];

function spawnSnake(p: CompactPlayerInit, idx: number, total: number): SlitherSnake {
  const a = (idx / Math.max(1, total)) * Math.PI * 2;
  const cx = ARENA_WIDTH / 2 + Math.cos(a) * 260;
  const cy = ARENA_HEIGHT / 2 + Math.sin(a) * 180;
  const segs: { x: number; y: number }[] = [];
  for (let i = 0; i < 12; i++) {
    segs.push({ x: cx - Math.cos(a + Math.PI) * i * 10, y: cy - Math.sin(a + Math.PI) * i * 10 });
  }
  return {
    id: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    colorHex: p.colorHex,
    alive: true,
    respawnTimer: 0,
    boosting: false,
    angle: a + Math.PI,
    length: 12,
    score: 0,
    kills: 0,
    segments: segs,
    cdB: 0,
    prevB: false,
  };
}

export const slitherFeastModule: CompactGameModule<SlitherFeastState, SlitherFeastSnapshot> = {
  id: 'slither-feast',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const pellets = Array.from({ length: 75 }, (_, i) => ({
      x: 60 + Math.random() * (ARENA_WIDTH - 120),
      y: 60 + Math.random() * (ARENA_HEIGHT - 120),
      r: 5 + (i % 3),
      colorHex: ORB_COLORS[i % ORB_COLORS.length],
      value: 10,
    }));
    return {
      timeLeft: totalTime,
      totalTime,
      pellets,
      snakes: players.map((p, idx) => spawnSnake(p, idx, players.length)),
      banner: 'CUT OFF RIVALS TO BURST LOOT!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    while (state.pellets.length < 75) {
      state.pellets.push({
        x: 50 + Math.random() * (ARENA_WIDTH - 100),
        y: 50 + Math.random() * (ARENA_HEIGHT - 100),
        r: 6,
        colorHex: ORB_COLORS[Math.floor(Math.random() * ORB_COLORS.length)],
        value: 10,
      });
    }

    for (const s of state.snakes) {
      const inp = players.find((x) => x.id === s.id)?.input;
      s.cdB = Math.max(0, s.cdB - dt);
      if (!s.alive) {
        s.respawnTimer -= dt;
        if (s.respawnTimer <= 0) {
          s.alive = true;
          s.length = 10;
          const rx = 180 + Math.random() * (ARENA_WIDTH - 360);
          const ry = 140 + Math.random() * (ARENA_HEIGHT - 280);
          s.angle = Math.random() * Math.PI * 2;
          s.segments = Array.from({ length: 10 }, (_, k) => ({
            x: rx - Math.cos(s.angle) * k * 10,
            y: ry - Math.sin(s.angle) * k * 10,
          }));
        }
        continue;
      }

      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const bDown = !!inp?.actionB;
      const coilPressed = bDown && !s.prevB && s.cdB <= 0;
      s.prevB = bDown;
      if (coilPressed) {
        s.cdB = 1.6;
        s.angle += Math.PI * 0.75;
        sounds.push({ type: 'dash', playerId: s.id });
      } else if (Math.hypot(mx, my) > 0.2) {
        const target = Math.atan2(my, mx);
        let diff = target - s.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        s.angle += clamp(diff, -5.2 * dt, 5.2 * dt);
      }

      s.boosting = !!inp?.actionA && s.length > 8;
      const speed = s.boosting ? 285 : 175;
      const head = s.segments[0];
      let nx = head.x + Math.cos(s.angle) * speed * dt;
      let ny = head.y + Math.sin(s.angle) * speed * dt;
      if (nx < 34 || nx > ARENA_WIDTH - 34) {
        s.angle = Math.PI - s.angle;
        nx = clamp(nx, 34, ARENA_WIDTH - 34);
      }
      if (ny < 34 || ny > ARENA_HEIGHT - 34) {
        s.angle = -s.angle;
        ny = clamp(ny, 34, ARENA_HEIGHT - 34);
      }

      if (dist(nx, ny, head.x, head.y) >= 1) {
        s.segments.unshift({ x: nx, y: ny });
        const maxSegs = Math.min(72, Math.floor(s.length));
        while (s.segments.length > maxSegs) s.segments.pop();
      }
      if (s.boosting) s.length = Math.max(8, s.length - dt * 1.4);

      for (let i = state.pellets.length - 1; i >= 0; i--) {
        const pel = state.pellets[i];
        if (dist(nx, ny, pel.x, pel.y) < 20 + pel.r) {
          s.score += pel.value * mult;
          s.length = Math.min(70, s.length + (pel.value >= 25 ? 1.4 : 0.45));
          state.pellets.splice(i, 1);
          sounds.push({ type: 'score', playerId: s.id });
        }
      }
    }

    // Head-to-body collisions
    for (const s of state.snakes) {
      if (!s.alive) continue;
      const h = s.segments[0];
      for (const other of state.snakes) {
        if (!other.alive || other.id === s.id) continue;
        for (let k = 2; k < other.segments.length; k++) {
          if (dist(h.x, h.y, other.segments[k].x, other.segments[k].y) < 17) {
            s.alive = false;
            s.respawnTimer = 2.0;
            other.kills += 1;
            other.score += 80 * mult;
            state.banner = `${other.name} CUT OFF ${s.name}!`;
            sounds.push({ type: 'elim', playerId: s.id });
            for (let m = 0; m < s.segments.length; m += 2) {
              state.pellets.push({
                x: s.segments[m].x,
                y: s.segments[m].y,
                r: 10,
                colorHex: s.colorHex,
                value: 25,
              });
            }
            break;
          }
        }
        if (!s.alive) break;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'slither-feast',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      pellets: state.pellets.slice(0, 120),
      snakes: state.snakes.map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        colorHex: s.colorHex,
        alive: s.alive,
        respawnTimer: s.respawnTimer,
        boosting: s.boosting,
        angle: s.angle,
        length: Math.round(s.length),
        score: Math.round(s.score),
        kills: s.kills,
        segments: s.segments,
        cooldownA: 0,
        cooldownB: clamp(s.cdB / 1.6, 0, 1),
      })),
      players: state.snakes.map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        colorHex: s.colorHex,
        score: Math.round(s.score),
        alive: s.alive,
        lastAction: `LEN ${Math.round(s.length)}`,
        cooldownA: 0,
        cooldownB: clamp(s.cdB / 1.6, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.snakes, (s) => `${s.kills} Cuts · ${Math.round(s.length)} Len`);
  },
};

// ============================================================================
// 3. BLOB DEVOUR (Agar.io)
// ============================================================================
interface BlobDevourState {
  timeLeft: number;
  totalTime: number;
  pellets: { x: number; y: number; colorHex: string; value: number }[];
  viruses: { x: number; y: number; r: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    mass: number;
    splitTimer: number;
    alive: boolean;
    respawnTimer: number;
    score: number;
    eats: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const blobDevourModule: CompactGameModule<BlobDevourState, BlobDevourSnapshot> = {
  id: 'blob-devour',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      pellets: Array.from({ length: 85 }, (_, i) => ({
        x: 45 + Math.random() * (ARENA_WIDTH - 90),
        y: 45 + Math.random() * (ARENA_HEIGHT - 90),
        colorHex: ORB_COLORS[i % ORB_COLORS.length],
        value: 8,
      })),
      viruses: [
        { x: 320, y: 230, r: 28 },
        { x: 880, y: 230, r: 28 },
        { x: 600, y: 500, r: 30 },
      ],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 160 + ((i * 170) % (ARENA_WIDTH - 320)),
        y: 160 + ((i * 130) % (ARENA_HEIGHT - 320)),
        vx: 0,
        vy: 0,
        mass: 28,
        splitTimer: 0,
        alive: true,
        respawnTimer: 0,
        score: 0,
        eats: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'ABSORB PELLETS & DEVOUR SMALLER RIVALS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    while (state.pellets.length < 85) {
      state.pellets.push({
        x: 40 + Math.random() * (ARENA_WIDTH - 80),
        y: 40 + Math.random() * (ARENA_HEIGHT - 80),
        colorHex: ORB_COLORS[Math.floor(Math.random() * ORB_COLORS.length)],
        value: 8,
      });
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.splitTimer = Math.max(0, p.splitTimer - dt);
      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.mass = 26;
          p.x = 120 + Math.random() * (ARENA_WIDTH - 240);
          p.y = 120 + Math.random() * (ARENA_HEIGHT - 240);
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (aDown && !p.prevA && p.cdA <= 0) {
        const mag = Math.hypot(mx, my) || 1;
        p.vx = (mx / mag) * 560;
        p.vy = (my / mag) * 560;
        p.splitTimer = 0.4;
        p.cdA = frenzy ? 1.4 : 2.5;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0 && p.mass > 22) {
        p.mass -= 6;
        const mag = Math.hypot(mx, my) || 1;
        p.vx = (mx / mag) * 420;
        p.vy = (my / mag) * 420;
        p.cdB = 1.4;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const r = 14 + Math.sqrt(p.mass) * 3.1;
      const baseSpeed = Math.max(125, 290 - r * 1.9);
      p.vx = p.vx * 0.88 + mx * baseSpeed * 0.25;
      p.vy = p.vy * 0.88 + my * baseSpeed * 0.25;
      p.x = clamp(p.x + p.vx * dt, r + 18, ARENA_WIDTH - r - 18);
      p.y = clamp(p.y + p.vy * dt, r + 18, ARENA_HEIGHT - r - 18);

      for (let i = state.pellets.length - 1; i >= 0; i--) {
        const pel = state.pellets[i];
        if (dist(p.x, p.y, pel.x, pel.y) < r + 8) {
          p.mass = Math.min(260, p.mass + 2.2);
          p.score += pel.value * mult;
          state.pellets.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      // Virus split hazard
      for (const v of state.viruses) {
        if (r > v.r + 4 && dist(p.x, p.y, v.x, v.y) < r + v.r * 0.7) {
          p.mass = Math.max(24, p.mass * 0.58);
          p.vx = (p.x - v.x) * 6;
          p.vy = (p.y - v.y) * 6;
          sounds.push({ type: 'hit', playerId: p.id });
          state.banner = `${p.name} HIT A VIRUS!`;
        }
      }
    }

    // Eat smaller blobs
    for (const a of state.players) {
      if (!a.alive) continue;
      const ra = 14 + Math.sqrt(a.mass) * 3.1;
      for (const b of state.players) {
        if (!b.alive || a.id === b.id) continue;
        if (a.mass > b.mass * 1.18 && dist(a.x, a.y, b.x, b.y) < ra * 0.88) {
          a.mass = Math.min(280, a.mass + b.mass * 0.45);
          a.eats += 1;
          a.score += 100 * mult;
          b.alive = false;
          b.respawnTimer = 2.0;
          state.banner = `${a.name} DEVOURED ${b.name}!`;
          sounds.push({ type: 'elim', playerId: b.id });
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'blob-devour',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      pellets: state.pellets,
      viruses: state.viruses,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        r: 14 + Math.sqrt(p.mass) * 3.1,
        mass: Math.round(p.mass),
        splitTimer: p.splitTimer,
        alive: p.alive,
        score: Math.round(p.score),
        eats: p.eats,
        cooldownA: clamp(p.cdA / 2.5, 0, 1),
        cooldownB: clamp(p.cdB / 1.4, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.eats} Eats · ${Math.round(p.mass)} Mass`);
  },
};

// ============================================================================
// 4. TURF RIBBON (Paper.io)
// ============================================================================
const TURF_COLS = 36;
const TURF_ROWS = 22;

interface TurfRibbonState {
  timeLeft: number;
  totalTime: number;
  cells: number[];
  trails: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number; // grid coords 0..cols
    y: number; // grid coords 0..rows
    dirX: number;
    dirY: number;
    alive: boolean;
    respawnTimer: number;
    outside: boolean;
    score: number;
    kills: number;
    boostTimer: number;
    shieldTimer: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function seedTurfBase(cells: number[], slot: number, cx: number, cy: number) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const gx = clamp(cx + dx, 0, TURF_COLS - 1);
      const gy = clamp(cy + dy, 0, TURF_ROWS - 1);
      cells[gy * TURF_COLS + gx] = slot;
    }
  }
}

function captureTurfForSlot(cells: number[], trails: number[], slot: number): number {
  let minX = TURF_COLS;
  let maxX = 0;
  let minY = TURF_ROWS;
  let maxY = 0;
  let gained = 0;
  for (let y = 0; y < TURF_ROWS; y++) {
    for (let x = 0; x < TURF_COLS; x++) {
      const idx = y * TURF_COLS + x;
      if (trails[idx] === slot) {
        trails[idx] = -1;
        if (cells[idx] !== slot) gained++;
        cells[idx] = slot;
      }
      if (cells[idx] === slot) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // Flood fill enclosed area inside bounding box
  if (maxX - minX >= 2 && maxY - minY >= 2) {
    const visited = new Uint8Array(TURF_COLS * TURF_ROWS);
    const q: number[] = [];
    for (let x = 0; x < TURF_COLS; x++) {
      for (const y of [0, TURF_ROWS - 1]) {
        const idx = y * TURF_COLS + x;
        if (cells[idx] !== slot) {
          visited[idx] = 1;
          q.push(idx);
        }
      }
    }
    for (let y = 0; y < TURF_ROWS; y++) {
      for (const x of [0, TURF_COLS - 1]) {
        const idx = y * TURF_COLS + x;
        if (!visited[idx] && cells[idx] !== slot) {
          visited[idx] = 1;
          q.push(idx);
        }
      }
    }
    while (q.length > 0) {
      const cur = q.pop()!;
      const cx = cur % TURF_COLS;
      const cy = Math.floor(cur / TURF_COLS);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < TURF_COLS && ny >= 0 && ny < TURF_ROWS) {
          const ni = ny * TURF_COLS + nx;
          if (!visited[ni] && cells[ni] !== slot) {
            visited[ni] = 1;
            q.push(ni);
          }
        }
      }
    }
    for (let i = 0; i < cells.length; i++) {
      if (!visited[i] && cells[i] !== slot) {
        cells[i] = slot;
        gained++;
      }
    }
  }
  return gained;
}

export const turfRibbonModule: CompactGameModule<TurfRibbonState, TurfRibbonSnapshot> = {
  id: 'turf-ribbon',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const cells = new Array(TURF_COLS * TURF_ROWS).fill(-1);
    const trails = new Array(TURF_COLS * TURF_ROWS).fill(-1);
    const anchors = [
      [5, 5],
      [30, 5],
      [5, 16],
      [30, 16],
      [18, 4],
      [18, 17],
      [11, 11],
      [25, 11],
    ];
    const pStates = players.map((p, idx) => {
      const [ax, ay] = anchors[idx % anchors.length];
      seedTurfBase(cells, p.slotIndex, ax, ay);
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: ax + 0.5,
        y: ay + 0.5,
        dirX: idx % 2 === 0 ? 1 : -1,
        dirY: 0,
        alive: true,
        respawnTimer: 0,
        outside: false,
        score: 90,
        kills: 0,
        boostTimer: 0,
        shieldTimer: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      };
    });
    return {
      timeLeft: totalTime,
      totalTime,
      cells,
      trails,
      players: pStates,
      banner: 'LOOP BACK HOME TO CLAIM TURF!',
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
      p.shieldTimer = Math.max(0, p.shieldTimer - dt);
      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.outside = false;
          const rx = 4 + Math.floor(Math.random() * (TURF_COLS - 8));
          const ry = 4 + Math.floor(Math.random() * (TURF_ROWS - 8));
          seedTurfBase(state.cells, p.slotIndex, rx, ry);
          p.x = rx + 0.5;
          p.y = ry + 0.5;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      if (Math.hypot(mx, my) > 0.25) {
        if (Math.abs(mx) > Math.abs(my)) {
          const ndx = mx > 0 ? 1 : -1;
          if (ndx !== -p.dirX) {
            p.dirX = ndx;
            p.dirY = 0;
          }
        } else {
          const ndy = my > 0 ? 1 : -1;
          if (ndy !== -p.dirY) {
            p.dirX = 0;
            p.dirY = ndy;
          }
        }
      }
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.boostTimer = 1.4;
        p.cdA = 3.5;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.shieldTimer = 2.0;
        p.cdB = 5.0;
        sounds.push({ type: 'score', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const speed = (p.boostTimer > 0 ? 10.5 : 6.8) * (frenzy ? 1.15 : 1);
      p.x = clamp(p.x + p.dirX * speed * dt, 0.5, TURF_COLS - 0.5);
      p.y = clamp(p.y + p.dirY * speed * dt, 0.5, TURF_ROWS - 0.5);

      const gx = clamp(Math.floor(p.x), 0, TURF_COLS - 1);
      const gy = clamp(Math.floor(p.y), 0, TURF_ROWS - 1);
      const idx = gy * TURF_COLS + gx;

      // Check cutting another player's trail
      const trailOwner = state.trails[idx];
      if (trailOwner !== -1 && trailOwner !== p.slotIndex) {
        const victim = state.players.find((v) => v.slotIndex === trailOwner && v.alive);
        if (victim && victim.shieldTimer <= 0) {
          victim.alive = false;
          victim.respawnTimer = 2.2;
          victim.outside = false;
          for (let i = 0; i < state.trails.length; i++) {
            if (state.trails[i] === victim.slotIndex) state.trails[i] = -1;
          }
          p.kills += 1;
          p.score += 120 * mult;
          state.banner = `${p.name} SLICED ${victim.name}'S RIBBON!`;
          sounds.push({ type: 'elim', playerId: victim.id });
        }
      }

      if (state.cells[idx] === p.slotIndex) {
        if (p.outside) {
          const gained = captureTurfForSlot(state.cells, state.trails, p.slotIndex);
          p.outside = false;
          if (gained > 0) {
            p.score += gained * 14 * mult;
            sounds.push({ type: 'score', playerId: p.id });
          }
        }
      } else {
        p.outside = true;
        state.trails[idx] = p.slotIndex;
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    const counts = new Map<number, number>();
    for (const c of state.cells) {
      if (c >= 0) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const total = TURF_COLS * TURF_ROWS;
    return {
      gameId: 'turf-ribbon',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: TURF_COLS,
      rows: TURF_ROWS,
      cells: state.cells,
      trails: state.trails,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        dirX: p.dirX,
        dirY: p.dirY,
        alive: p.alive,
        respawnTimer: p.respawnTimer,
        territoryPct: Math.round(((counts.get(p.slotIndex) ?? 0) / total) * 100),
        score: Math.round(p.score),
        kills: p.kills,
        boostTimer: p.boostTimer,
        cooldownA: clamp(p.cdA / 3.5, 0, 1),
        cooldownB: clamp(p.cdB / 5.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.kills} Slices · ${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 5. GLASS BRIDGE (Squid Game)
// ============================================================================
interface GlassBridgeState {
  timeLeft: number;
  totalTime: number;
  totalSteps: number;
  safeLane: (0 | 1)[];
  panels: { step: number; lane: 0 | 1; state: 'unknown' | 'safe-revealed' | 'shattered' }[];
  finishOrder: string[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    step: number;
    lane: 0 | 1;
    x: number;
    y: number;
    alive: boolean;
    falling: boolean;
    finished: boolean;
    respawnTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function stepToCoords(step: number, lane: 0 | 1, totalSteps: number) {
  const startX = 115;
  const endX = ARENA_WIDTH - 115;
  const span = endX - startX;
  const x = step < 0 ? 75 : step >= totalSteps ? ARENA_WIDTH - 65 : startX + ((step + 0.5) / totalSteps) * span;
  const y = lane === 0 ? 275 : 445;
  return { x, y };
}

export const glassBridgeModule: CompactGameModule<GlassBridgeState, GlassBridgeSnapshot> = {
  id: 'glass-bridge',
  init({ players, settingValue }) {
    const totalSteps = settingValue || 10;
    const safeLane: (0 | 1)[] = Array.from({ length: totalSteps }, () => (Math.random() < 0.5 ? 0 : 1));
    const panels: GlassBridgeState['panels'] = [];
    for (let s = 0; s < totalSteps; s++) {
      panels.push({ step: s, lane: 0, state: 'unknown' });
      panels.push({ step: s, lane: 1, state: 'unknown' });
    }
    return {
      timeLeft: 75,
      totalTime: 75,
      totalSteps,
      safeLane,
      panels,
      finishOrder: [],
      players: players.map((p, idx) => {
        const lane: 0 | 1 = idx % 2 === 0 ? 0 : 1;
        const { x, y } = stepToCoords(-1, lane, totalSteps);
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          step: -1,
          lane,
          x,
          y: y + ((idx % 4) - 1.5) * 18,
          alive: true,
          falling: false,
          finished: false,
          respawnTimer: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'CHOOSE LEFT OR RIGHT GLASS — ONE HOLDS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      if (p.finished) continue;
      if (p.falling) {
        p.respawnTimer -= dt;
        p.y += 280 * dt;
        if (p.respawnTimer <= 0) {
          p.falling = false;
          p.alive = true;
          p.step = Math.max(-1, p.step - 2);
          const c = stepToCoords(p.step, p.lane, state.totalSteps);
          p.x = c.x;
          p.y = c.y;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const my = inp?.moveY ?? 0;
      if (my < -0.35) p.lane = 0;
      else if (my > 0.35) p.lane = 1;

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      const leap = aDown && !p.prevA && p.cdA <= 0;
      const shove = bDown && !p.prevB && p.cdB <= 0;
      p.prevA = aDown;
      p.prevB = bDown;

      const tryAdvance = (target: typeof p) => {
        const nextStep = target.step + 1;
        target.cdA = 0.42;
        if (nextStep >= state.totalSteps) {
          target.step = state.totalSteps;
          target.finished = true;
          state.finishOrder.push(target.id);
          const bonus = Math.max(120, 420 - (state.finishOrder.length - 1) * 70);
          target.score += bonus;
          state.banner = `${target.name} CROSSED THE GLASS BRIDGE!`;
          sounds.push({ type: 'win', playerId: target.id });
          return;
        }
        const panel = state.panels.find((pn) => pn.step === nextStep && pn.lane === target.lane)!;
        if (state.safeLane[nextStep] === target.lane) {
          panel.state = 'safe-revealed';
          target.step = nextStep;
          target.score += 35 * mult;
          sounds.push({ type: 'score', playerId: target.id });
        } else {
          panel.state = 'shattered';
          target.step = nextStep;
          target.falling = true;
          target.alive = false;
          target.respawnTimer = 1.5;
          state.banner = `${target.name} SHATTERED STEP ${nextStep + 1}!`;
          sounds.push({ type: 'elim', playerId: target.id });
        }
      };

      if (leap) tryAdvance(p);

      if (shove) {
        p.cdB = 2.4;
        const victim = state.players.find(
          (o) => o.id !== p.id && !o.falling && !o.finished && o.step === p.step && dist(p.x, p.y, o.x, o.y) < 120
        );
        if (victim) {
          sounds.push({ type: 'hit', playerId: victim.id });
          tryAdvance(victim);
        }
      }

      const tgt = stepToCoords(p.step, p.lane, state.totalSteps);
      p.x += (tgt.x - p.x) * Math.min(1, dt * 11);
      p.y += (tgt.y - p.y) * Math.min(1, dt * 11);
    }

    const allDone = state.players.every((p) => p.finished);
    return { finished: state.timeLeft <= 0 || allDone, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'glass-bridge',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      totalSteps: state.totalSteps,
      panels: state.panels,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        step: p.step,
        lane: p.lane,
        x: p.x,
        y: p.y,
        alive: p.alive,
        falling: p.falling,
        finished: p.finished,
        respawnTimer: p.respawnTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.42, 0, 1),
        cooldownB: clamp(p.cdB / 2.4, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    const sorted = [...state.players].sort((a, b) => {
      const aFin = a.finished ? state.finishOrder.indexOf(a.id) : 999;
      const bFin = b.finished ? state.finishOrder.indexOf(b.id) : 999;
      if (aFin !== bFin) return aFin - bFin;
      if (b.step !== a.step) return b.step - a.step;
      return b.score - a.score;
    });
    return sorted.map((p, i) => ({
      playerId: p.id,
      rank: i + 1,
      score: Math.round(p.score),
      statLabel: p.finished ? `FINISHED #${state.finishOrder.indexOf(p.id) + 1}` : `Step ${Math.max(0, p.step + 1)}/${state.totalSteps}`,
    }));
  },
};

// ============================================================================
// 6. TUG TITAN (Squid Game Tug-of-War)
// ============================================================================
interface TugTitanState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  roundPause: number;
  ropeOffset: number;
  leftPower: number;
  rightPower: number;
  leftWins: number;
  rightWins: number;
  pulsePhase: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    team: 'left' | 'right';
    pulling: boolean;
    anchorActive: boolean;
    stamina: number;
    pulls: number;
    score: number;
    prevA: boolean;
  }[];
  banner: string | null;
}

export const tugTitanModule: CompactGameModule<TugTitanState, TugTitanSnapshot> = {
  id: 'tug-titan',
  init({ players, settingValue }) {
    const maxRounds = settingValue || 3;
    return {
      timeLeft: 75,
      totalTime: 75,
      round: 1,
      maxRounds,
      roundPause: 0,
      ropeOffset: 0,
      leftPower: 0,
      rightPower: 0,
      leftWins: 0,
      rightWins: 0,
      pulsePhase: 0,
      players: players.map((p, idx) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        team: idx % 2 === 0 ? 'left' : 'right',
        pulling: false,
        anchorActive: false,
        stamina: 100,
        pulls: 0,
        score: 0,
        prevA: false,
      })),
      banner: 'ROUND 1 · PULL ON THE GOLD PULSE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.pulsePhase = (state.pulsePhase + dt * 1.35) % 1;
    const pulseZone = 0.5 + 0.5 * Math.sin(state.pulsePhase * Math.PI * 2);
    const inSweetSpot = pulseZone > (frenzy ? 0.65 : 0.78);

    if (state.roundPause > 0) {
      state.roundPause -= dt;
      if (state.roundPause <= 0) {
        if (state.round >= state.maxRounds) return { finished: true, sounds };
        state.round += 1;
        state.ropeOffset = 0;
        state.banner = `ROUND ${state.round} · HEAVE!`;
      }
      return { finished: state.timeLeft <= 0, sounds };
    }

    let lForce = 0;
    let rForce = 0;
    let lAnchor = 0;
    let rAnchor = 0;

    for (const p of state.players) {
      const inp = players.find((x) => x.id === p.id)?.input;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      p.anchorActive = bDown;
      p.pulling = false;
      p.stamina = Math.min(100, p.stamina + dt * 22);

      if (bDown) {
        if (p.team === 'left') lAnchor += 0.35;
        else rAnchor += 0.35;
      }

      if (aDown && !p.prevA && p.stamina >= 6) {
        p.pulling = true;
        p.pulls += 1;
        p.stamina = Math.max(0, p.stamina - 8);
        const burst = (inSweetSpot ? 2.1 : 1.0) * (frenzy ? 1.5 : 1.0);
        p.score += Math.round(burst * 8);
        if (p.team === 'left') lForce += burst;
        else rForce += burst;
        sounds.push({ type: inSweetSpot ? 'score' : 'tick', playerId: p.id });
      }
      p.prevA = aDown;
    }

    state.leftPower = state.leftPower * 0.85 + lForce * 16;
    state.rightPower = state.rightPower * 0.85 + rForce * 16;

    const net = (rForce / (1 + lAnchor) - lForce / (1 + rAnchor)) * 0.085;
    state.ropeOffset = clamp(state.ropeOffset + net, -1, 1);

    if (Math.abs(state.ropeOffset) >= 0.98) {
      const winTeam = state.ropeOffset < 0 ? 'left' : 'right';
      if (winTeam === 'left') state.leftWins += 1;
      else state.rightWins += 1;
      for (const p of state.players) {
        if (p.team === winTeam) p.score += 180;
      }
      state.banner = `${winTeam === 'left' ? 'LEFT SQUAD' : 'RIGHT SQUAD'} WINS ROUND ${state.round}!`;
      state.roundPause = 2.0;
      sounds.push({ type: 'win' });
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    const pulseZone = 0.5 + 0.5 * Math.sin(state.pulsePhase * Math.PI * 2);
    return {
      gameId: 'tug-titan',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      maxRounds: state.maxRounds,
      ropeOffset: state.ropeOffset,
      leftPower: state.leftPower,
      rightPower: state.rightPower,
      leftWins: state.leftWins,
      rightWins: state.rightWins,
      pulseZone,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        team: p.team,
        pulling: p.pulling,
        anchorActive: p.anchorActive,
        stamina: Math.round(p.stamina),
        pulls: p.pulls,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.team.toUpperCase()} · ${p.pulls} Pulls`);
  },
};

// ============================================================================
// 7. FLAPPY FLOCK (Flappy Bird Multiplayer)
// ============================================================================
interface FlappyFlockState {
  timeLeft: number;
  totalTime: number;
  scrollX: number;
  pipes: { x: number; gapY: number; gapH: number; hasRing: boolean; ringTaken: boolean; clearedBy: Set<string> }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vy: number;
    alive: boolean;
    respawnTimer: number;
    dashTimer: number;
    pipesCleared: number;
    score: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const flappyFlockModule: CompactGameModule<FlappyFlockState, FlappyFlockSnapshot> = {
  id: 'flappy-flock',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const pipes = Array.from({ length: 6 }, (_, i) => ({
      x: 540 + i * 260,
      gapY: 220 + Math.random() * 280,
      gapH: 185,
      hasRing: i % 2 === 1,
      ringTaken: false,
      clearedBy: new Set<string>(),
    }));
    return {
      timeLeft: totalTime,
      totalTime,
      scrollX: 0,
      pipes,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 210 + (i % 4) * 32,
        y: 260 + (i * 28) % 160,
        vy: 0,
        alive: true,
        respawnTimer: 0,
        dashTimer: 0,
        pipesCleared: 0,
        score: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'FLAP THROUGH PIPES & GRAB GOLD RINGS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    const pipeSpeed = 235 + (state.totalTime - state.timeLeft) * 1.4;
    state.scrollX += pipeSpeed * dt;

    for (const pipe of state.pipes) {
      pipe.x -= pipeSpeed * dt;
      if (pipe.x < -80) {
        const maxX = Math.max(...state.pipes.map((pp) => pp.x));
        pipe.x = maxX + 260;
        pipe.gapY = 185 + Math.random() * 340;
        pipe.gapH = Math.max(152, 185 - (state.totalTime - state.timeLeft) * 0.25);
        pipe.hasRing = Math.random() < 0.55;
        pipe.ringTaken = false;
        pipe.clearedBy.clear();
      }
    }

    for (const p of state.players) {
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.y = ARENA_HEIGHT / 2;
          p.vy = -160;
          p.dashTimer = 0.8;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (aDown && !p.prevA) {
        p.vy = -345;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.dashTimer = 0.75;
        p.vy = 0;
        p.cdB = frenzy ? 2.0 : 3.8;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      p.vy += 860 * dt;
      p.y += p.vy * dt;
      if (p.y < 24) {
        p.y = 24;
        p.vy = 0;
      }
      if (p.y > ARENA_HEIGHT - 44) {
        p.alive = false;
        p.respawnTimer = 1.4;
        sounds.push({ type: 'hit', playerId: p.id });
        continue;
      }

      for (const pipe of state.pipes) {
        if (pipe.hasRing && !pipe.ringTaken && dist(p.x, p.y, pipe.x, pipe.gapY) < 34) {
          pipe.ringTaken = true;
          p.score += 50 * mult;
          sounds.push({ type: 'score', playerId: p.id });
        }
        if (pipe.x < p.x - 20 && !pipe.clearedBy.has(p.id)) {
          pipe.clearedBy.add(p.id);
          p.pipesCleared += 1;
          p.score += 20 * mult;
          sounds.push({ type: 'score', playerId: p.id });
        }
        if (p.dashTimer <= 0 && Math.abs(p.x - pipe.x) < 36) {
          if (p.y < pipe.gapY - pipe.gapH / 2 + 12 || p.y > pipe.gapY + pipe.gapH / 2 - 12) {
            p.alive = false;
            p.respawnTimer = 1.5;
            sounds.push({ type: 'elim', playerId: p.id });
            break;
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'flappy-flock',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      scrollX: state.scrollX,
      pipes: state.pipes.map((pp) => ({
        x: pp.x,
        gapY: pp.gapY,
        gapH: pp.gapH,
        hasRing: pp.hasRing,
        ringTaken: pp.ringTaken,
      })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        vy: p.vy,
        alive: p.alive,
        respawnTimer: p.respawnTimer,
        dashTimer: p.dashTimer,
        pipesCleared: p.pipesCleared,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 3.8, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.pipesCleared} Pipes Cleared`);
  },
};

// ============================================================================
// 8. DINO DASH (Chrome Dino Multiplayer)
// ============================================================================
const DINO_GROUND_Y = 560;
interface DinoObstacle {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'cactus-sm' | 'cactus-lg' | 'ptero-high' | 'ptero-low' | 'star';
  taken?: boolean;
}
interface DinoDashState {
  timeLeft: number;
  totalTime: number;
  speed: number;
  distance: number;
  spawnTimer: number;
  obsSeq: number;
  obstacles: DinoObstacle[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vy: number;
    ducking: boolean;
    grounded: boolean;
    stunTimer: number;
    streak: number;
    score: number;
    prevA: boolean;
  }[];
  banner: string | null;
}

export const dinoDashModule: CompactGameModule<DinoDashState, DinoDashSnapshot> = {
  id: 'dino-dash',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      speed: 370,
      distance: 0,
      spawnTimer: 0.7,
      obsSeq: 1,
      obstacles: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 150 + i * 52,
        y: DINO_GROUND_Y,
        vy: 0,
        ducking: false,
        grounded: true,
        stunTimer: 0,
        streak: 0,
        score: 0,
        prevA: false,
      })),
      banner: 'LEAP CACTI & DUCK PTERODACTYLS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    state.speed = Math.min(680, 370 + (state.totalTime - state.timeLeft) * 3.8);
    state.distance += state.speed * dt * 0.08;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = Math.max(0.65, 1.35 - (state.speed - 370) * 0.0018);
      const r = Math.random();
      const id = `do_${state.obsSeq++}`;
      if (r < 0.34) {
        state.obstacles.push({ id, x: ARENA_WIDTH + 60, y: DINO_GROUND_Y - 52, w: 34, h: 52, kind: 'cactus-sm' });
      } else if (r < 0.62) {
        state.obstacles.push({ id, x: ARENA_WIDTH + 60, y: DINO_GROUND_Y - 78, w: 46, h: 78, kind: 'cactus-lg' });
      } else if (r < 0.84) {
        state.obstacles.push({ id, x: ARENA_WIDTH + 60, y: DINO_GROUND_Y - 94, w: 58, h: 32, kind: 'ptero-high' });
      } else {
        state.obstacles.push({ id, x: ARENA_WIDTH + 60, y: DINO_GROUND_Y - 135, w: 32, h: 32, kind: 'star' });
      }
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      state.obstacles[i].x -= state.speed * dt;
      if (state.obstacles[i].x < -100 || state.obstacles[i].taken) {
        state.obstacles.splice(i, 1);
      }
    }

    for (const p of state.players) {
      const inp = players.find((x) => x.id === p.id)?.input;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      p.stunTimer = Math.max(0, p.stunTimer - dt);
      p.ducking = bDown && p.grounded;

      if (aDown && !p.prevA && p.grounded && p.stunTimer <= 0) {
        p.vy = -690;
        p.grounded = false;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (bDown && !p.grounded) {
        p.vy += 1800 * dt; // fast drop
      }
      p.prevA = aDown;

      p.vy += 1750 * dt;
      p.y += p.vy * dt;
      if (p.y >= DINO_GROUND_Y) {
        p.y = DINO_GROUND_Y;
        p.vy = 0;
        p.grounded = true;
      }

      if (p.stunTimer <= 0) {
        p.score += dt * (12 + Math.min(20, p.streak * 2)) * mult;
      }

      const ph = p.ducking ? 34 : 62;
      const pTop = p.y - ph;
      const pBot = p.y;
      for (const o of state.obstacles) {
        if (o.taken) continue;
        const hitX = Math.abs(p.x - (o.x + o.w / 2)) < o.w / 2 + 16;
        const hitY = pBot > o.y + 4 && pTop < o.y + o.h - 4;
        if (hitX && hitY) {
          if (o.kind === 'star') {
            o.taken = true;
            p.streak += 1;
            p.score += 60 * mult;
            sounds.push({ type: 'score', playerId: p.id });
          } else if (p.stunTimer <= 0) {
            p.stunTimer = 1.2;
            p.streak = 0;
            p.score = Math.max(0, p.score - 25);
            sounds.push({ type: 'hit', playerId: p.id });
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    const nightMode = Math.floor(state.distance / 280) % 2 === 1;
    return {
      gameId: 'dino-dash',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      speed: Math.round(state.speed),
      distance: Math.round(state.distance),
      nightMode,
      obstacles: state.obstacles.map((o) => ({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, kind: o.kind })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        vy: p.vy,
        ducking: p.ducking,
        grounded: p.grounded,
        stunTimer: p.stunTimer,
        streak: p.streak,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: nightMode ? 'NEON NIGHT SPRINT!' : state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} Dash Pts`);
  },
};

// ============================================================================
// 9. 2048 BLITZ
// ============================================================================
interface Tile2048State {
  timeLeft: number;
  totalTime: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    grid: number[];
    maxTile: number;
    frozenTimer: number;
    score: number;
    lastAction: string;
    moveCd: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function spawn2048Tile(grid: number[]) {
  const empty: number[] = [];
  for (let i = 0; i < 16; i++) if (grid[i] === 0) empty.push(i);
  if (empty.length === 0) return;
  const pick = empty[Math.floor(Math.random() * empty.length)];
  grid[pick] = Math.random() < 0.85 ? 2 : 4;
}

function slide2048(grid: number[], dir: 'L' | 'R' | 'U' | 'D'): { moved: boolean; gain: number } {
  let moved = false;
  let gain = 0;
  const get = (r: number, c: number) => grid[r * 4 + c];
  const set = (r: number, c: number, v: number) => {
    grid[r * 4 + c] = v;
  };
  for (let line = 0; line < 4; line++) {
    const vals: number[] = [];
    for (let k = 0; k < 4; k++) {
      const v =
        dir === 'L' ? get(line, k) : dir === 'R' ? get(line, 3 - k) : dir === 'U' ? get(k, line) : get(3 - k, line);
      if (v > 0) vals.push(v);
    }
    const merged: number[] = [];
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] === vals[i + 1]) {
        const nv = vals[i] * 2;
        merged.push(nv);
        gain += nv;
        i++;
      } else {
        merged.push(vals[i]);
      }
    }
    while (merged.length < 4) merged.push(0);
    for (let k = 0; k < 4; k++) {
      const old =
        dir === 'L' ? get(line, k) : dir === 'R' ? get(line, 3 - k) : dir === 'U' ? get(k, line) : get(3 - k, line);
      if (old !== merged[k]) moved = true;
      if (dir === 'L') set(line, k, merged[k]);
      else if (dir === 'R') set(line, 3 - k, merged[k]);
      else if (dir === 'U') set(k, line, merged[k]);
      else set(3 - k, line, merged[k]);
    }
  }
  return { moved, gain };
}

export const tile2048BlitzModule: CompactGameModule<Tile2048State, Tile2048BlitzSnapshot> = {
  id: 'tile-2048-blitz',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      players: players.map((p) => {
        const grid = new Array(16).fill(0);
        spawn2048Tile(grid);
        spawn2048Tile(grid);
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          grid,
          maxTile: Math.max(...grid),
          frozenTimer: 0,
          score: 0,
          lastAction: 'MERGE!',
          moveCd: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'SLIDE & MERGE TO 2048!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.moveCd = Math.max(0, p.moveCd - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.frozenTimer = Math.max(0, p.frozenTimer - dt);
      if (p.frozenTimer > 0) continue;

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      let dir: 'L' | 'R' | 'U' | 'D' | null = null;
      if (p.moveCd <= 0 && Math.hypot(mx, my) > 0.48) {
        dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'R' : 'L') : my > 0 ? 'D' : 'U';
      } else if (aDown && !p.prevA && p.moveCd <= 0) {
        // Smart best-gain slide
        let bestDir: 'L' | 'R' | 'U' | 'D' = 'L';
        let bestGain = -1;
        for (const d of ['L', 'D', 'R', 'U'] as const) {
          const copy = [...p.grid];
          const res = slide2048(copy, d);
          if (res.moved && res.gain > bestGain) {
            bestGain = res.gain;
            bestDir = d;
          }
        }
        dir = bestDir;
      }

      if (bDown && !p.prevB && p.cdB <= 0 && state.players.length > 1) {
        const leader = state.players
          .filter((o) => o.id !== p.id)
          .sort((a, b) => b.score - a.score)[0];
        if (leader) {
          leader.frozenTimer = 2.6;
          p.cdB = frenzy ? 5 : 9;
          p.lastAction = `FROZE ${leader.name}!`;
          state.banner = `${p.name} FROZE ${leader.name}!`;
          sounds.push({ type: 'hit', playerId: leader.id });
        }
      }
      p.prevA = aDown;
      p.prevB = bDown;

      if (dir) {
        const res = slide2048(p.grid, dir);
        p.moveCd = 0.22;
        if (res.moved) {
          spawn2048Tile(p.grid);
          p.score += res.gain * mult;
          p.maxTile = Math.max(...p.grid);
          if (res.gain > 0) {
            p.lastAction = `+${res.gain * mult}`;
            sounds.push({ type: 'score', playerId: p.id });
          }
          if (p.maxTile >= 2048) {
            state.banner = `${p.name} REACHED 2048!`;
            return { finished: true, sounds };
          }
        } else if (!p.grid.includes(0)) {
          // Board stuck -> clear smallest 6 tiles so match stays lively
          for (let i = 0; i < 16; i++) if (p.grid[i] <= 4) p.grid[i] = 0;
          spawn2048Tile(p.grid);
          p.lastAction = 'BOARD RESET';
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'tile-2048-blitz',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        grid: p.grid,
        maxTile: p.maxTile,
        frozenTimer: p.frozenTimer,
        score: Math.round(p.score),
        lastAction: p.lastAction,
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 9, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `Max Tile ${p.maxTile}`);
  },
};

// ============================================================================
// 10. MINE SWEEP DUEL
// ============================================================================
const MS_COLS = 14;
const MS_ROWS = 9;
interface MineCell {
  mine: boolean;
  adj: number;
  state: 'hidden' | 'revealed' | 'flagged' | 'exploded';
  ownerSlot: number;
}
interface MineSweepState {
  timeLeft: number;
  totalTime: number;
  cells: MineCell[];
  minesLeft: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    col: number;
    row: number;
    moveCd: number;
    stunTimer: number;
    flagsCorrect: number;
    score: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function buildMineBoard(): { cells: MineCell[]; mines: number } {
  const total = MS_COLS * MS_ROWS;
  const cells: MineCell[] = Array.from({ length: total }, () => ({
    mine: false,
    adj: 0,
    state: 'hidden',
    ownerSlot: -1,
  }));
  let placed = 0;
  while (placed < 24) {
    const idx = Math.floor(Math.random() * total);
    if (!cells[idx].mine) {
      cells[idx].mine = true;
      placed++;
    }
  }
  for (let r = 0; r < MS_ROWS; r++) {
    for (let c = 0; c < MS_COLS; c++) {
      let adj = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < MS_ROWS && nc >= 0 && nc < MS_COLS && cells[nr * MS_COLS + nc].mine) {
            adj++;
          }
        }
      }
      cells[r * MS_COLS + c].adj = adj;
    }
  }
  // Open one safe 0-pocket at start so players have immediate deduction clues
  const safeStart = cells.findIndex((cl) => !cl.mine && cl.adj === 0);
  if (safeStart >= 0) {
    const q = [safeStart];
    while (q.length > 0) {
      const i = q.pop()!;
      if (cells[i].state !== 'hidden') continue;
      cells[i].state = 'revealed';
      if (cells[i].adj === 0) {
        const r = Math.floor(i / MS_COLS);
        const c = i % MS_COLS;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < MS_ROWS && nc >= 0 && nc < MS_COLS) {
              const ni = nr * MS_COLS + nc;
              if (cells[ni].state === 'hidden' && !cells[ni].mine) q.push(ni);
            }
          }
        }
      }
    }
  }
  return { cells, mines: placed };
}

export const mineSweepDuelModule: CompactGameModule<MineSweepState, MineSweepDuelSnapshot> = {
  id: 'mine-sweep-duel',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const { cells, mines } = buildMineBoard();
    return {
      timeLeft: totalTime,
      totalTime,
      cells,
      minesLeft: mines,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        col: 2 + (i * 2) % (MS_COLS - 4),
        row: 2 + (i % (MS_ROWS - 4)),
        moveCd: 0,
        stunTimer: 0,
        flagsCorrect: 0,
        score: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DIG SAFE CELLS · FLAG MINES FOR +60!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.moveCd = Math.max(0, p.moveCd - dt);
      p.stunTimer = Math.max(0, p.stunTimer - dt);
      if (p.stunTimer > 0) continue;

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      if (p.moveCd <= 0 && Math.hypot(mx, my) > 0.35) {
        if (Math.abs(mx) > Math.abs(my)) p.col = clamp(p.col + (mx > 0 ? 1 : -1), 0, MS_COLS - 1);
        else p.row = clamp(p.row + (my > 0 ? 1 : -1), 0, MS_ROWS - 1);
        p.moveCd = 0.14;
      }

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      const idx = p.row * MS_COLS + p.col;
      const cell = state.cells[idx];

      if (aDown && !p.prevA && cell.state === 'hidden') {
        if (cell.mine) {
          cell.state = 'exploded';
          cell.ownerSlot = p.slotIndex;
          state.minesLeft = Math.max(0, state.minesLeft - 1);
          p.stunTimer = frenzy ? 1.0 : 2.0;
          p.score = Math.max(0, p.score - 45);
          state.banner = `BOOM! ${p.name} HIT A MINE!`;
          sounds.push({ type: 'elim', playerId: p.id });
        } else {
          const q = [idx];
          let opened = 0;
          while (q.length > 0) {
            const cur = q.pop()!;
            const cl = state.cells[cur];
            if (cl.state !== 'hidden' || cl.mine) continue;
            cl.state = 'revealed';
            cl.ownerSlot = p.slotIndex;
            opened++;
            if (cl.adj === 0) {
              const r = Math.floor(cur / MS_COLS);
              const c = cur % MS_COLS;
              for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                  const nr = r + dr;
                  const nc = c + dc;
                  if (nr >= 0 && nr < MS_ROWS && nc >= 0 && nc < MS_COLS) {
                    q.push(nr * MS_COLS + nc);
                  }
                }
              }
            }
          }
          p.score += Math.min(80, opened * 12) * mult;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      if (bDown && !p.prevB && cell.state === 'hidden') {
        if (cell.mine) {
          cell.state = 'flagged';
          cell.ownerSlot = p.slotIndex;
          state.minesLeft = Math.max(0, state.minesLeft - 1);
          p.flagsCorrect += 1;
          p.score += 60 * mult;
          state.banner = `${p.name} FLAGGED A MINE (+${60 * mult})!`;
          sounds.push({ type: 'score', playerId: p.id });
        } else {
          p.score = Math.max(0, p.score - 20);
          p.stunTimer = 0.7;
          sounds.push({ type: 'hit', playerId: p.id });
        }
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    const remainingSafeOrMine = state.cells.some((c) => c.state === 'hidden');
    return { finished: state.timeLeft <= 0 || !remainingSafeOrMine, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'mine-sweep-duel',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: MS_COLS,
      rows: MS_ROWS,
      cells: state.cells.map((c) => ({ state: c.state, adj: c.adj, ownerSlot: c.ownerSlot })),
      minesLeft: state.minesLeft,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        col: p.col,
        row: p.row,
        stunTimer: p.stunTimer,
        flagsCorrect: p.flagsCorrect,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.flagsCorrect} Mines Flagged`);
  },
};

// ============================================================================
// 11. GEO PIN RUSH (GeoGuessr)
// ============================================================================
const GEO_SPOTS = [
  { city: 'Kuala Lumpur, Malaysia', title: 'Petronas Twin Towers', titleZh: '吉隆坡双峰塔', hint: 'Nasi Lemak & 88-story silver spires in Southeast Asia', hintZh: '东南亚椰浆饭与 88 层双子银塔', emoji: '🏙️', x: 0.76, y: 0.56 },
  { city: 'Tokyo, Japan', title: 'Shibuya Crossing & Mt. Fuji', titleZh: '涩谷十字路口与富士山', hint: 'Bullet trains, ramen alleys & neon arcades', hintZh: '新干线、拉面小巷与霓虹电玩城', emoji: '🗼', x: 0.87, y: 0.37 },
  { city: 'Paris, France', title: 'Eiffel Tower & Seine', titleZh: '埃菲尔铁塔与塞纳河', hint: 'Croissants, iron lattice tower in Western Europe', hintZh: '西欧浪漫之都的铁塔与可颂面包', emoji: '🥐', x: 0.50, y: 0.28 },
  { city: 'New York, USA', title: 'Statue of Liberty', titleZh: '自由女神像', hint: 'Times Square yellow cabs on the US East Coast', hintZh: '美国东岸时代广场与黄色出租车', emoji: '🗽', x: 0.27, y: 0.33 },
  { city: 'Cairo, Egypt', title: 'Great Pyramids of Giza', titleZh: '吉萨大金字塔', hint: 'Ancient Sphinx beside the Nile in North Africa', hintZh: '北非尼罗河畔的狮身人面像与金字塔', emoji: '🐪', x: 0.58, y: 0.42 },
  { city: 'Sydney, Australia', title: 'Sydney Opera House', titleZh: '悉尼歌剧院', hint: 'White sail-shaped roofs in Southern Hemisphere harbor', hintZh: '南半球海港的白色贝壳船帆屋顶', emoji: '🦘', x: 0.90, y: 0.76 },
  { city: 'Rio de Janeiro, Brazil', title: 'Christ the Redeemer', titleZh: '里约基督像', hint: 'Carnival samba & Copacabana beach in South America', hintZh: '南美洲狂欢节桑巴与海滩山顶巨像', emoji: '🌴', x: 0.36, y: 0.70 },
  { city: 'Beijing, China', title: 'Great Wall & Forbidden City', titleZh: '万里长城与故宫', hint: 'Imperial golden roofs & stone wall across northern ridges', hintZh: '东方古都琉璃瓦宫殿与万里长城', emoji: '🐉', x: 0.80, y: 0.34 },
  { city: 'London, UK', title: 'Big Ben & Tower Bridge', titleZh: '大本钟与伦敦塔桥', hint: 'Red double-decker buses along the Thames', hintZh: '泰晤士河畔的红色双层巴士与大本钟', emoji: '🎡', x: 0.48, y: 0.25 },
  { city: 'Singapore', title: 'Marina Bay Sands', titleZh: '滨海湾金沙酒店', hint: 'Merlion & rooftop ship-pool at the tip of Malay Peninsula', hintZh: '马来半岛南端的鱼尾狮与空中无边泳池', emoji: '🦁', x: 0.77, y: 0.58 },
];

interface GeoPinState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'guessing' | 'reveal';
  spotIdx: number;
  usedIdx: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    locked: boolean;
    lastDistKm: number | null;
    score: number;
    prevA: boolean;
  }[];
  banner: string | null;
}

export const geoPinRushModule: CompactGameModule<GeoPinState, GeoPinRushSnapshot> = {
  id: 'geo-pin-rush',
  init({ players, settingValue }) {
    const maxRounds = settingValue || 6;
    const order = GEO_SPOTS.map((_, i) => i).sort(() => Math.random() - 0.5);
    return {
      timeLeft: 12,
      totalTime: 12,
      round: 1,
      maxRounds,
      phase: 'guessing',
      spotIdx: order[0],
      usedIdx: order,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 0.5,
        y: 0.5,
        locked: false,
        lastDistKm: null,
        score: 0,
        prevA: false,
      })),
      banner: 'DROP YOUR PIN ON THE WORLD MAP!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const spot = GEO_SPOTS[state.spotIdx];

    if (state.phase === 'guessing') {
      let allLocked = true;
      for (const p of state.players) {
        const inp = players.find((x) => x.id === p.id)?.input;
        const aDown = !!inp?.actionA;
        if (!p.locked) {
          const speed = inp?.actionB ? 0.62 : 0.32;
          p.x = clamp(p.x + (inp?.moveX ?? 0) * speed * dt, 0.04, 0.96);
          p.y = clamp(p.y + (inp?.moveY ?? 0) * speed * dt, 0.08, 0.92);
          if (aDown && !p.prevA) {
            p.locked = true;
            sounds.push({ type: 'tick', playerId: p.id });
          } else {
            allLocked = false;
          }
        }
        p.prevA = aDown;
      }

      if (state.timeLeft <= 0 || allLocked) {
        state.phase = 'reveal';
        state.timeLeft = 3.6;
        state.totalTime = 3.6;
        const mult = frenzy ? 2 : 1;
        for (const p of state.players) {
          const d = dist(p.x, p.y, spot.x, spot.y);
          const km = Math.round(d * 18000);
          p.lastDistKm = km;
          const pts = Math.round(Math.max(0, 500 - d * 1150)) * mult;
          p.score += pts;
        }
        state.banner = `ANSWER: ${spot.city}!`;
        sounds.push({ type: 'score' });
      }
    } else if (state.timeLeft <= 0) {
      if (state.round >= state.maxRounds) return { finished: true, sounds };
      state.round += 1;
      state.phase = 'guessing';
      state.timeLeft = 12;
      state.totalTime = 12;
      state.spotIdx = state.usedIdx[(state.round - 1) % state.usedIdx.length];
      for (const p of state.players) {
        p.locked = false;
        p.lastDistKm = null;
      }
      state.banner = `ROUND ${state.round} · PIN THE LANDMARK!`;
    }

    return { finished: false, sounds };
  },
  snapshot(state) {
    const spot = GEO_SPOTS[state.spotIdx];
    return {
      gameId: 'geo-pin-rush',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      maxRounds: state.maxRounds,
      phase: state.phase,
      clueTitle: spot.title,
      clueTitleZh: spot.titleZh,
      clueHint: spot.hint,
      clueHintZh: spot.hintZh,
      clueEmoji: spot.emoji,
      targetX: spot.x,
      targetY: spot.y,
      targetCity: spot.city,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        locked: p.locked,
        lastDistKm: p.lastDistKm,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} Geo Pts`);
  },
};

// ============================================================================
// 12. MIND DIAL (Wavelength)
// ============================================================================
const DIAL_PROMPTS = [
  { left: 'FREEZING', leftZh: '极寒', right: 'BOILING', rightZh: '滚烫', clue: 'Iced Teh Tarik', clueZh: '冰拉茶', target: 0.20 },
  { left: 'FREEZING', leftZh: '极寒', right: 'BOILING', rightZh: '滚烫', clue: 'Sichuan Mala Hotpot', clueZh: '四川麻辣火锅', target: 0.90 },
  { left: 'TINY', leftZh: '微小', right: 'GIANT', rightZh: '巨大', clue: 'Golden Retriever', clueZh: '金毛寻回犬', target: 0.45 },
  { left: 'BORING', leftZh: '无聊', right: 'THRILLING', rightZh: '刺激', clue: 'Front-Row Rollercoaster', clueZh: '第一排过山车', target: 0.92 },
  { left: 'CHEAP', leftZh: '便宜', right: 'LUXURY', rightZh: '奢华', clue: 'Private Yacht', clueZh: '私人游艇', target: 0.95 },
  { left: 'SWEET', leftZh: '超甜', right: 'SOUR', rightZh: '超酸', clue: 'Fresh Lemon Slice', clueZh: '新鲜柠檬片', target: 0.88 },
  { left: 'SLOW', leftZh: '极慢', right: 'SONIC', rightZh: '光速', clue: 'Bullet Train', clueZh: '高速子弹列车', target: 0.84 },
  { left: 'HERO', leftZh: '英雄', right: 'VILLAIN', rightZh: '反派', clue: 'Friendly Neighborhood Spider', clueZh: '邻家好邻居蜘蛛侠', target: 0.12 },
  { left: 'QUIET', leftZh: '安静', right: 'DEAFENING', rightZh: '震耳', clue: 'Library Midnight', clueZh: '午夜图书馆', target: 0.08 },
  { left: 'SOFT', leftZh: '柔软', right: 'HARD', rightZh: '坚硬', clue: 'Diamond Crystal', clueZh: '天然钻石', target: 0.96 },
];

interface WavelengthState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'dialing' | 'reveal';
  order: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    dial: number;
    locked: boolean;
    lastGain: number;
    score: number;
    prevA: boolean;
  }[];
  banner: string | null;
}

export const wavelengthSyncModule: CompactGameModule<WavelengthState, WavelengthSyncSnapshot> = {
  id: 'wavelength-sync',
  init({ players, settingValue }) {
    const maxRounds = settingValue || 6;
    const order = DIAL_PROMPTS.map((_, i) => i).sort(() => Math.random() - 0.5);
    return {
      timeLeft: 10,
      totalTime: 10,
      round: 1,
      maxRounds,
      phase: 'dialing',
      order,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        dial: 0.5,
        locked: false,
        lastGain: 0,
        score: 0,
        prevA: false,
      })),
      banner: 'DIAL YOUR NEEDLE TO THE SECRET ZONE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const prompt = DIAL_PROMPTS[state.order[(state.round - 1) % state.order.length]];

    if (state.phase === 'dialing') {
      let allLocked = true;
      for (const p of state.players) {
        const inp = players.find((x) => x.id === p.id)?.input;
        const aDown = !!inp?.actionA;
        if (!p.locked) {
          const speed = inp?.actionB ? 0.25 : 0.65;
          p.dial = clamp(p.dial + (inp?.moveX ?? 0) * speed * dt, 0.02, 0.98);
          if (aDown && !p.prevA) {
            p.locked = true;
            sounds.push({ type: 'tick', playerId: p.id });
          } else {
            allLocked = false;
          }
        }
        p.prevA = aDown;
      }

      if (state.timeLeft <= 0 || allLocked) {
        state.phase = 'reveal';
        state.timeLeft = 3.4;
        state.totalTime = 3.4;
        const mult = frenzy ? 2 : 1;
        for (const p of state.players) {
          const err = Math.abs(p.dial - prompt.target);
          const gain = (err < 0.07 ? 100 : err < 0.15 ? 60 : err < 0.24 ? 30 : 0) * mult;
          p.lastGain = gain;
          p.score += gain;
        }
        state.banner = `TARGET REVEALED · ${Math.round(prompt.target * 100)}%!`;
        sounds.push({ type: 'score' });
      }
    } else if (state.timeLeft <= 0) {
      if (state.round >= state.maxRounds) return { finished: true, sounds };
      state.round += 1;
      state.phase = 'dialing';
      state.timeLeft = 10;
      state.totalTime = 10;
      for (const p of state.players) {
        p.dial = 0.5;
        p.locked = false;
        p.lastGain = 0;
      }
      state.banner = `ROUND ${state.round} · SYNC MINDS!`;
    }

    return { finished: false, sounds };
  },
  snapshot(state) {
    const prompt = DIAL_PROMPTS[state.order[(state.round - 1) % state.order.length]];
    return {
      gameId: 'wavelength-sync',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      maxRounds: state.maxRounds,
      phase: state.phase,
      leftLabel: prompt.left,
      leftLabelZh: prompt.leftZh,
      rightLabel: prompt.right,
      rightLabelZh: prompt.rightZh,
      clueText: prompt.clue,
      clueTextZh: prompt.clueZh,
      targetAngle: prompt.target,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        dial: p.dial,
        locked: p.locked,
        lastGain: p.lastGain,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} Mind Pts`);
  },
};
