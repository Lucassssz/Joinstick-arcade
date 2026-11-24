import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/shared/types.ts';
import type {
  AlienWaveSnapshot,
  BarrelTowerSnapshot,
  BlockStackSnapshot,
  BrickClashSnapshot,
  FrogCrossingSnapshot,
  MazeChomperSnapshot,
  RhythmPulseSnapshot,
  WhackBlitzSnapshot,
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
// 1. MAZE CHOMPER (Pac-Man)
// ============================================================================
const MZ_COLS = 19;
const MZ_ROWS = 11;
const MZ_LAYOUT = [
  '1111111111111111111',
  '1P000000010000000P1',
  '1011011101011101101',
  '1000000000000000001',
  '1011010110110101101',
  '1000010000000100001',
  '1011010111110101101',
  '1000000000000000001',
  '1011011101011101101',
  '1P000000010000000P1',
  '1111111111111111111',
];

interface MazeState {
  timeLeft: number;
  totalTime: number;
  walls: number[];
  pellets: { x: number; y: number; power: boolean }[];
  ghosts: { id: string; x: number; y: number; vx: number; vy: number; colorHex: string; scaredTimer: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    powerTimer: number;
    stunTimer: number;
    dashTimer: number;
    score: number;
    ghostsEaten: number;
    ghostCombo: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function mazeWallAt(walls: number[], gx: number, gy: number): boolean {
  const c = Math.floor(gx);
  const r = Math.floor(gy);
  if (c < 0 || c >= MZ_COLS || r < 0 || r >= MZ_ROWS) return true;
  return walls[r * MZ_COLS + c] === 1;
}

function buildMazePellets(): { walls: number[]; pellets: { x: number; y: number; power: boolean }[] } {
  const walls: number[] = [];
  const pellets: { x: number; y: number; power: boolean }[] = [];
  for (let r = 0; r < MZ_ROWS; r++) {
    for (let c = 0; c < MZ_COLS; c++) {
      const ch = MZ_LAYOUT[r][c];
      walls.push(ch === '1' ? 1 : 0);
      if (ch === '0' || ch === 'P') {
        pellets.push({ x: c + 0.5, y: r + 0.5, power: ch === 'P' });
      }
    }
  }
  return { walls, pellets };
}

export const mazeChomperModule: CompactGameModule<MazeState, MazeChomperSnapshot> = {
  id: 'maze-chomper',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const { walls, pellets } = buildMazePellets();
    const spawns = [
      [1.5, 5.5],
      [17.5, 5.5],
      [9.5, 3.5],
      [9.5, 7.5],
      [4.5, 3.5],
      [14.5, 3.5],
      [4.5, 7.5],
      [14.5, 7.5],
    ];
    return {
      timeLeft: totalTime,
      totalTime,
      walls,
      pellets,
      ghosts: [
        { id: 'g1', x: 8.5, y: 5.5, vx: 1, vy: 0, colorHex: '#EF4444', scaredTimer: 0 },
        { id: 'g2', x: 10.5, y: 5.5, vx: -1, vy: 0, colorHex: '#EC4899', scaredTimer: 0 },
        { id: 'g3', x: 9.5, y: 5.5, vx: 0, vy: -1, colorHex: '#06B6D4', scaredTimer: 0 },
        { id: 'g4', x: 9.5, y: 3.5, vx: 1, vy: 0, colorHex: '#F97316', scaredTimer: 0 },
      ],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: spawns[i % spawns.length][0],
        y: spawns[i % spawns.length][1],
        angle: 0,
        powerTimer: 0,
        stunTimer: 0,
        dashTimer: 0,
        score: 0,
        ghostsEaten: 0,
        ghostCombo: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'GRAB CORNER ORBS TO CHOMP GHOSTS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    if (state.pellets.length < 15) {
      state.pellets = buildMazePellets().pellets;
      state.banner = 'FRESH PELLET WAVE SPAWNED!';
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.powerTimer = Math.max(0, p.powerTimer - dt);
      if (p.powerTimer <= 0) p.ghostCombo = 0;
      p.stunTimer = Math.max(0, p.stunTimer - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      if (p.stunTimer > 0) continue;

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.dashTimer = 0.6;
        p.cdA = 2.6;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.cdB = 4.2;
        for (const g of state.ghosts) {
          if (dist(p.x, p.y, g.x, g.y) < 3.4) g.scaredTimer = Math.max(g.scaredTimer, 2.5);
        }
        sounds.push({ type: 'score', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const speed = p.dashTimer > 0 ? 7.6 : 4.8;
      if (Math.hypot(mx, my) > 0.18) {
        p.angle = Math.atan2(my, mx);
        const nx = p.x + mx * speed * dt;
        const ny = p.y + my * speed * dt;
        if (!mazeWallAt(state.walls, nx + Math.sign(mx) * 0.28, p.y)) p.x = nx;
        if (!mazeWallAt(state.walls, p.x, ny + Math.sign(my) * 0.28)) p.y = ny;
      }

      for (let i = state.pellets.length - 1; i >= 0; i--) {
        const pel = state.pellets[i];
        if (dist(p.x, p.y, pel.x, pel.y) < 0.55) {
          state.pellets.splice(i, 1);
          if (pel.power) {
            p.powerTimer = frenzy ? 9 : 6;
            p.score += 40 * mult;
            for (const g of state.ghosts) g.scaredTimer = Math.max(g.scaredTimer, p.powerTimer);
            state.banner = `${p.name} POWERED UP! CHOMP GHOSTS!`;
            sounds.push({ type: 'win', playerId: p.id });
          } else {
            p.score += 10 * mult;
            sounds.push({ type: 'tick', playerId: p.id });
          }
        }
      }
    }

    // Move ghosts
    for (const g of state.ghosts) {
      g.scaredTimer = Math.max(0, g.scaredTimer - dt);
      const spd = g.scaredTimer > 0 ? 2.4 : 3.5;
      const nx = g.x + g.vx * spd * dt;
      const ny = g.y + g.vy * spd * dt;
      if (mazeWallAt(state.walls, nx + Math.sign(g.vx) * 0.32, ny + Math.sign(g.vy) * 0.32) || Math.random() < dt * 0.8) {
        const dirs = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].filter(([dx, dy]) => !mazeWallAt(state.walls, g.x + dx * 0.65, g.y + dy * 0.65));
        if (dirs.length > 0) {
          const pick = dirs[Math.floor(Math.random() * dirs.length)];
          g.vx = pick[0];
          g.vy = pick[1];
        }
      } else {
        g.x = nx;
        g.y = ny;
      }

      for (const p of state.players) {
        if (p.stunTimer > 0) continue;
        if (dist(p.x, p.y, g.x, g.y) < 0.65) {
          if (g.scaredTimer > 0 || p.powerTimer > 0) {
            p.ghostsEaten += 1;
            p.ghostCombo = Math.min(4, p.ghostCombo + 1);
            const comboPts = [120, 200, 300, 450][p.ghostCombo - 1] ?? 450;
            p.score += comboPts * mult;
            g.x = 9.5;
            g.y = 5.5;
            g.scaredTimer = 0;
            state.banner = `${p.name} ${p.ghostCombo > 1 ? `${p.ghostCombo}× ` : ''}GHOST CHOMP (+${comboPts * mult})!`;
            sounds.push({ type: 'score', playerId: p.id });
          } else {
            p.stunTimer = 1.6;
            p.score = Math.max(0, p.score - 35);
            p.x = 1.5;
            p.y = 5.5;
            sounds.push({ type: 'elim', playerId: p.id });
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'maze-chomper',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: MZ_COLS,
      rows: MZ_ROWS,
      walls: state.walls,
      pellets: state.pellets,
      ghosts: state.ghosts.map((g) => ({ id: g.id, x: g.x, y: g.y, colorHex: g.colorHex, scaredTimer: g.scaredTimer })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        powerTimer: p.powerTimer,
        stunTimer: p.stunTimer,
        score: Math.round(p.score),
        ghostsEaten: p.ghostsEaten,
        cooldownA: clamp(p.cdA / 2.6, 0, 1),
        cooldownB: clamp(p.cdB / 4.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.ghostsEaten} Ghosts Eaten`);
  },
};

// ============================================================================
// 2. BRICK CLASH (Breakout / Arkanoid)
// ============================================================================
const BRICK_ROW_COLORS = ['#EF4444', '#F97316', '#FACC15', '#22C55E', '#38BDF8', '#A855F7'];

interface BrickClashState {
  timeLeft: number;
  totalTime: number;
  bricks: BrickClashSnapshot['bricks'];
  balls: { x: number; y: number; vx: number; vy: number; ownerSlot: number; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    w: number;
    laserTimer: number;
    smashTimer: number;
    score: number;
    bricksBroken: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function buildBrickWall(): BrickClashSnapshot['bricks'] {
  const out: BrickClashSnapshot['bricks'] = [];
  const cols = 12;
  const rows = 5;
  const bw = 82;
  const bh = 28;
  const ox = (ARENA_WIDTH - cols * (bw + 8)) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bonus = (r === 0 && c % 3 === 1) ? 'gold' : (r === 2 && c % 4 === 1) ? 'multi' : undefined;
      out.push({
        id: `br_${r}_${c}`,
        x: ox + c * (bw + 8),
        y: 88 + r * (bh + 8),
        w: bw,
        h: bh,
        hp: bonus === 'gold' ? 2 : 1,
        colorHex: bonus === 'gold' ? '#FACC15' : BRICK_ROW_COLORS[r % BRICK_ROW_COLORS.length],
        bonus,
      });
    }
  }
  return out;
}

export const brickClashModule: CompactGameModule<BrickClashState, BrickClashSnapshot> = {
  id: 'brick-clash',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const balls = players.slice(0, 4).map((p, i) => ({
      x: 240 + i * 220,
      y: 480,
      vx: (i % 2 === 0 ? 1 : -1) * 260,
      vy: -360,
      ownerSlot: p.slotIndex,
      colorHex: p.colorHex,
    }));
    return {
      timeLeft: totalTime,
      totalTime,
      bricks: buildBrickWall(),
      balls,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 160 + ((i * 220) % (ARENA_WIDTH - 320)),
        y: 630 - (i % 2) * 24,
        w: 132,
        laserTimer: 0,
        smashTimer: 0,
        score: 0,
        bricksBroken: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'SHATTER BRICKS & UNLEASH LASER PADDLES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    if (state.bricks.length < 6) {
      state.bricks = buildBrickWall();
      state.banner = 'NEW NEON BRICK WALL!';
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.laserTimer = Math.max(0, p.laserTimer - dt);
      p.smashTimer = Math.max(0, p.smashTimer - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      p.x = clamp(p.x + (inp?.moveX ?? 0) * 560 * dt, p.w / 2 + 24, ARENA_WIDTH - p.w / 2 - 24);

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      if (aDown && !p.prevA && p.cdA <= 0) {
        p.smashTimer = 0.45;
        p.cdA = 1.4;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.laserTimer = 0.25;
        p.cdB = frenzy ? 1.5 : 3.2;
        // Destroy lowest brick aligned with paddle
        const aligned = state.bricks
          .filter((b) => p.x >= b.x - 16 && p.x <= b.x + b.w + 16)
          .sort((a, b) => b.y - a.y)[0];
        if (aligned) {
          aligned.hp -= 1;
          if (aligned.hp <= 0) {
            state.bricks = state.bricks.filter((b) => b.id !== aligned.id);
            p.bricksBroken += 1;
            p.score += (aligned.bonus === 'gold' ? 60 : 25) * mult;
          }
        }
        sounds.push({ type: 'hit', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;
    }

    for (const b of state.balls) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < 24 || b.x > ARENA_WIDTH - 24) {
        b.vx *= -1;
        b.x = clamp(b.x, 24, ARENA_WIDTH - 24);
      }
      if (b.y < 64) {
        b.vy = Math.abs(b.vy);
        b.y = 64;
      }
      if (b.y > ARENA_HEIGHT - 16) {
        b.y = 480;
        b.vy = -340;
      }

      // Paddle bounce
      for (const p of state.players) {
        if (b.vy > 0 && Math.abs(b.y - p.y) < 18 && Math.abs(b.x - p.x) < p.w / 2 + 10) {
          const offset = (b.x - p.x) / (p.w / 2);
          const boost = p.smashTimer > 0 ? 1.28 : 1.02;
          b.vx = clamp(offset * 440, -520, 520);
          b.vy = -clamp(Math.abs(b.vy) * boost, 340, 580);
          b.ownerSlot = p.slotIndex;
          b.colorHex = p.colorHex;
          sounds.push({ type: 'tick', playerId: p.id });
        }
      }

      // Brick collision
      for (let i = state.bricks.length - 1; i >= 0; i--) {
        const br = state.bricks[i];
        if (b.x > br.x - 9 && b.x < br.x + br.w + 9 && b.y > br.y - 9 && b.y < br.y + br.h + 9) {
          b.vy *= -1;
          br.hp -= 1;
          const owner = state.players.find((pl) => pl.slotIndex === b.ownerSlot);
          if (br.hp <= 0) {
            state.bricks.splice(i, 1);
            if (owner) {
              owner.bricksBroken += 1;
              owner.score += (br.bonus === 'gold' ? 65 : 25) * mult;
              sounds.push({ type: 'score', playerId: owner.id });
            }
            if (br.bonus === 'multi' && state.balls.length < 9) {
              state.balls.push({
                x: br.x + br.w / 2,
                y: br.y + br.h,
                vx: -b.vx,
                vy: 340,
                ownerSlot: b.ownerSlot,
                colorHex: b.colorHex,
              });
              state.banner = 'MULTI-BALL UNLEASHED!';
            }
          }
          break;
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'brick-clash',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      bricks: state.bricks,
      balls: state.balls,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        w: p.w,
        laserActive: p.laserTimer > 0,
        score: Math.round(p.score),
        bricksBroken: p.bricksBroken,
        cooldownA: clamp(p.cdA / 1.4, 0, 1),
        cooldownB: clamp(p.cdB / 3.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.bricksBroken} Bricks Smashed`);
  },
};

// ============================================================================
// 3. ALIEN WAVE (Space Invaders)
// ============================================================================
interface AlienWaveState {
  timeLeft: number;
  totalTime: number;
  wave: number;
  alienDir: number;
  ufoTimer: number;
  aliens: { id: string; x: number; y: number; kind: 'grunt' | 'elite' | 'ufo'; hp: number; colorHex: string }[];
  bullets: { x: number; y: number; vy: number; colorHex: string; ownerId?: string; enemy?: boolean }[];
  shields: { x: number; y: number; hp: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    stunTimer: number;
    rapidTimer: number;
    fireCd: number;
    cdB: number;
    score: number;
    kills: number;
    prevB: boolean;
  }[];
  banner: string | null;
}

function spawnAlienArmada(wave: number) {
  const out: AlienWaveState['aliens'] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 10; c++) {
      const elite = r === 0;
      out.push({
        id: `al_${wave}_${r}_${c}`,
        x: 190 + c * 86,
        y: 110 + r * 54,
        kind: elite ? 'elite' : 'grunt',
        hp: elite ? 2 : 1,
        colorHex: elite ? '#F43F5E' : r === 1 ? '#A855F7' : '#22C55E',
      });
    }
  }
  return out;
}

export const alienWaveModule: CompactGameModule<AlienWaveState, AlienWaveSnapshot> = {
  id: 'alien-wave',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      wave: 1,
      alienDir: 1,
      ufoTimer: 9,
      aliens: spawnAlienArmada(1),
      bullets: [],
      shields: [
        { x: 240, y: 545, hp: 10 },
        { x: 480, y: 545, hp: 10 },
        { x: 720, y: 545, hp: 10 },
        { x: 960, y: 545, hp: 10 },
      ],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 200 + ((i * 150) % 800),
        y: 632,
        stunTimer: 0,
        rapidTimer: 0,
        fireCd: 0,
        cdB: 0,
        score: 0,
        kills: 0,
        prevB: false,
      })),
      banner: 'WAVE 1 · BLAST THE ALIEN ARMADA!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    // Spawn UFO
    state.ufoTimer -= dt;
    if (state.ufoTimer <= 0) {
      state.ufoTimer = frenzy ? 7 : 13;
      state.aliens.push({
        id: `ufo_${Math.floor(state.timeLeft * 10)}`,
        x: 60,
        y: 74,
        kind: 'ufo',
        hp: 1,
        colorHex: '#FACC15',
      });
      state.banner = 'MYSTERY GOLDEN UFO SPOTTED (+150)!';
    }

    // Move aliens
    let hitEdge = false;
    const swarmSpeed = 52 + state.wave * 16;
    for (let i = state.aliens.length - 1; i >= 0; i--) {
      const a = state.aliens[i];
      if (a.kind === 'ufo') {
        a.x += 220 * dt;
        if (a.x > ARENA_WIDTH + 40) state.aliens.splice(i, 1);
      } else {
        a.x += state.alienDir * swarmSpeed * dt;
        if (a.x < 70 || a.x > ARENA_WIDTH - 70) hitEdge = true;
        if (Math.random() < dt * 0.09) {
          state.bullets.push({ x: a.x, y: a.y + 18, vy: 280, colorHex: '#FB7185', enemy: true });
        }
      }
    }
    if (hitEdge) {
      state.alienDir *= -1;
      for (const a of state.aliens) {
        if (a.kind !== 'ufo') a.y = Math.min(480, a.y + 18);
      }
    }

    if (!state.aliens.some((a) => a.kind !== 'ufo')) {
      state.wave += 1;
      state.aliens.push(...spawnAlienArmada(state.wave));
      state.banner = `WAVE ${state.wave} INCOMING!`;
      sounds.push({ type: 'win' });
    }

    for (const p of state.players) {
      p.stunTimer = Math.max(0, p.stunTimer - dt);
      p.rapidTimer = Math.max(0, p.rapidTimer - dt);
      p.fireCd = Math.max(0, p.fireCd - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      if (p.stunTimer > 0) continue;

      const inp = players.find((x) => x.id === p.id)?.input;
      p.x = clamp(p.x + (inp?.moveX ?? 0) * 440 * dt, 48, ARENA_WIDTH - 48);
      if (inp?.actionA && p.fireCd <= 0) {
        p.fireCd = p.rapidTimer > 0 ? 0.13 : 0.28;
        if (p.rapidTimer > 0) {
          state.bullets.push({ x: p.x - 10, y: p.y - 22, vy: -640, colorHex: p.colorHex, ownerId: p.id });
          state.bullets.push({ x: p.x + 10, y: p.y - 22, vy: -640, colorHex: p.colorHex, ownerId: p.id });
        } else {
          state.bullets.push({ x: p.x, y: p.y - 22, vy: -600, colorHex: p.colorHex, ownerId: p.id });
        }
        sounds.push({ type: 'tick', playerId: p.id });
      }
      const bDown = !!inp?.actionB;
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.rapidTimer = 4.0;
        p.cdB = 9.0;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevB = bDown;
    }

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.y += b.vy * dt;
      if (b.y < 40 || b.y > ARENA_HEIGHT) {
        state.bullets.splice(i, 1);
        continue;
      }
      // Shield hit
      const sh = state.shields.find((s) => s.hp > 0 && Math.abs(b.x - s.x) < 42 && Math.abs(b.y - s.y) < 16);
      if (sh) {
        if (b.enemy) sh.hp = Math.max(0, sh.hp - 1);
        state.bullets.splice(i, 1);
        continue;
      }

      if (b.enemy) {
        const hitP = state.players.find((p) => p.stunTimer <= 0 && dist(p.x, p.y, b.x, b.y) < 24);
        if (hitP) {
          hitP.stunTimer = 1.1;
          hitP.score = Math.max(0, hitP.score - 20);
          state.bullets.splice(i, 1);
          sounds.push({ type: 'hit', playerId: hitP.id });
        }
      } else {
        const idx = state.aliens.findIndex((a) => dist(a.x, a.y, b.x, b.y) < 26);
        if (idx >= 0) {
          const al = state.aliens[idx];
          al.hp -= 1;
          state.bullets.splice(i, 1);
          if (al.hp <= 0) {
            state.aliens.splice(idx, 1);
            const shooter = state.players.find((p) => p.id === b.ownerId);
            if (shooter) {
              shooter.kills += 1;
              shooter.score += (al.kind === 'ufo' ? 150 : al.kind === 'elite' ? 50 : 25) * mult;
              sounds.push({ type: al.kind === 'ufo' ? 'win' : 'score', playerId: shooter.id });
            }
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'alien-wave',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      wave: state.wave,
      aliens: state.aliens,
      bullets: state.bullets.map((b) => ({ x: b.x, y: b.y, vy: b.vy, colorHex: b.colorHex, enemy: b.enemy })),
      shields: state.shields,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        stunTimer: p.stunTimer,
        rapidTimer: p.rapidTimer,
        score: Math.round(p.score),
        kills: p.kills,
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 9.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.kills} Aliens Blasted`);
  },
};

// ============================================================================
// 4. BLOCK STACK (Tetris Battle)
// ============================================================================
const TET_W = 10;
const TET_H = 16;
const TET_SHAPES: [number, number][][] = [
  [[0, 0], [1, 0], [2, 0], [3, 0]], // I
  [[0, 0], [1, 0], [0, 1], [1, 1]], // O
  [[1, 0], [0, 1], [1, 1], [2, 1]], // T
  [[0, 0], [0, 1], [1, 1], [2, 1]], // J
  [[2, 0], [0, 1], [1, 1], [2, 1]], // L
  [[1, 0], [2, 0], [0, 1], [1, 1]], // S
  [[0, 0], [1, 0], [1, 1], [2, 1]], // Z
];

interface TetPlayer {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  board: number[];
  piece: [number, number][];
  px: number;
  py: number;
  pieceColor: number;
  fallTimer: number;
  moveCd: number;
  linesCleared: number;
  score: number;
  alive: boolean;
  prevA: boolean;
  prevB: boolean;
}

interface BlockStackState {
  timeLeft: number;
  totalTime: number;
  players: TetPlayer[];
  banner: string | null;
}

function tetCanPlace(board: number[], piece: [number, number][], px: number, py: number): boolean {
  for (const [dx, dy] of piece) {
    const x = px + dx;
    const y = py + dy;
    if (x < 0 || x >= TET_W || y >= TET_H) return false;
    if (y >= 0 && board[y * TET_W + x] !== 0) return false;
  }
  return true;
}

function spawnTetPiece(p: TetPlayer) {
  const idx = Math.floor(Math.random() * TET_SHAPES.length);
  p.piece = TET_SHAPES[idx].map(([x, y]) => [x, y]);
  p.pieceColor = idx + 1;
  p.px = 3;
  p.py = 0;
  if (!tetCanPlace(p.board, p.piece, p.px, p.py)) {
    // Top out -> clear top half & penalize so match continues cleanly
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < TET_W; c++) p.board[r * TET_W + c] = 0;
    }
    p.score = Math.max(0, p.score - 60);
  }
}

function lockTetPiece(state: BlockStackState, p: TetPlayer, mult: number, sounds: CompactSoundEvent[]) {
  for (const [dx, dy] of p.piece) {
    const x = p.px + dx;
    const y = p.py + dy;
    if (y >= 0 && y < TET_H && x >= 0 && x < TET_W) p.board[y * TET_W + x] = p.pieceColor;
  }
  let cleared = 0;
  for (let r = TET_H - 1; r >= 0; r--) {
    let full = true;
    for (let c = 0; c < TET_W; c++) {
      if (p.board[r * TET_W + c] === 0) {
        full = false;
        break;
      }
    }
    if (full) {
      cleared++;
      for (let rr = r; rr > 0; rr--) {
        for (let c = 0; c < TET_W; c++) p.board[rr * TET_W + c] = p.board[(rr - 1) * TET_W + c];
      }
      for (let c = 0; c < TET_W; c++) p.board[c] = 0;
      r++;
    }
  }
  if (cleared > 0) {
    p.linesCleared += cleared;
    p.score += cleared * cleared * 55 * mult;
    sounds.push({ type: cleared >= 2 ? 'win' : 'score', playerId: p.id });
    if (cleared >= 2) {
      state.banner = `${p.name} CLEARED ${cleared} LINES! GARBAGE SENT!`;
      for (const o of state.players) {
        if (o.id === p.id) continue;
        // Shift up 1 garbage row with a hole
        for (let r = 0; r < TET_H - 1; r++) {
          for (let c = 0; c < TET_W; c++) o.board[r * TET_W + c] = o.board[(r + 1) * TET_W + c];
        }
        const hole = Math.floor(Math.random() * TET_W);
        for (let c = 0; c < TET_W; c++) o.board[(TET_H - 1) * TET_W + c] = c === hole ? 0 : 8;
      }
    }
  }
  spawnTetPiece(p);
}

export const blockStackModule: CompactGameModule<BlockStackState, BlockStackSnapshot> = {
  id: 'block-stack',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const pStates: TetPlayer[] = players.map((p) => {
      const tp: TetPlayer = {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        board: new Array(TET_W * TET_H).fill(0),
        piece: [],
        px: 3,
        py: 0,
        pieceColor: 1,
        fallTimer: 0.55,
        moveCd: 0,
        linesCleared: 0,
        score: 0,
        alive: true,
        prevA: false,
        prevB: false,
      };
      spawnTetPiece(tp);
      return tp;
    });
    return {
      timeLeft: totalTime,
      totalTime,
      players: pStates,
      banner: 'CLEAR MULTI-LINES TO SEND GARBAGE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.moveCd = Math.max(0, p.moveCd - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.moveCd <= 0 && Math.abs(mx) > 0.42) {
        const dx = mx > 0 ? 1 : -1;
        if (tetCanPlace(p.board, p.piece, p.px + dx, p.py)) {
          p.px += dx;
          p.moveCd = 0.12;
        }
      }
      if (aDown && !p.prevA) {
        const rotated: [number, number][] = p.piece.map(([x, y]) => [2 - y, x]);
        if (tetCanPlace(p.board, rotated, p.px, p.py)) {
          p.piece = rotated;
          sounds.push({ type: 'tick', playerId: p.id });
        }
      }
      if (bDown && !p.prevB) {
        let drops = 0;
        while (tetCanPlace(p.board, p.piece, p.px, p.py + 1)) {
          p.py++;
          drops++;
        }
        p.score += drops * 2 * mult;
        lockTetPiece(state, p, mult, sounds);
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const stepInterval = my > 0.45 ? 0.08 : 0.46;
      p.fallTimer -= dt;
      if (p.fallTimer <= 0) {
        p.fallTimer = stepInterval;
        if (tetCanPlace(p.board, p.piece, p.px, p.py + 1)) {
          p.py++;
        } else {
          lockTetPiece(state, p, mult, sounds);
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'block-stack',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        board: p.board,
        curShape: p.piece.map(([dx, dy]) => ({ cx: p.px + dx, cy: p.py + dy })),
        curColor: p.pieceColor,
        linesCleared: p.linesCleared,
        score: Math.round(p.score),
        alive: p.alive,
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.linesCleared} Lines Cleared`);
  },
};

// ============================================================================
// 5. FROG CROSSING (Frogger / Crossy Road)
// ============================================================================
interface FrogLane {
  row: number;
  kind: 'safe' | 'road' | 'river' | 'goal';
  speed: number;
  items: { x: number; w: number; colorHex: string }[];
}
interface FrogState {
  timeLeft: number;
  totalTime: number;
  lanes: FrogLane[];
  pads: { x: number; claimedByColor: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    row: number;
    hopTimer: number;
    stunTimer: number;
    crossings: number;
    score: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const frogCrossingModule: CompactGameModule<FrogState, FrogCrossingSnapshot> = {
  id: 'frog-crossing',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const lanes: FrogLane[] = [
      { row: 0, kind: 'goal', speed: 0, items: [] },
      { row: 1, kind: 'river', speed: 120, items: [{ x: 100, w: 170, colorHex: '#92400E' }, { x: 460, w: 170, colorHex: '#92400E' }, { x: 840, w: 170, colorHex: '#92400E' }] },
      { row: 2, kind: 'river', speed: -145, items: [{ x: 180, w: 160, colorHex: '#B45309' }, { x: 560, w: 160, colorHex: '#B45309' }, { x: 940, w: 160, colorHex: '#B45309' }] },
      { row: 3, kind: 'river', speed: 110, items: [{ x: 80, w: 190, colorHex: '#92400E' }, { x: 480, w: 190, colorHex: '#92400E' }, { x: 880, w: 190, colorHex: '#92400E' }] },
      { row: 4, kind: 'safe', speed: 0, items: [] },
      { row: 5, kind: 'road', speed: -210, items: [{ x: 120, w: 105, colorHex: '#EF4444' }, { x: 520, w: 105, colorHex: '#F97316' }, { x: 900, w: 105, colorHex: '#EF4444' }] },
      { row: 6, kind: 'road', speed: 245, items: [{ x: 240, w: 120, colorHex: '#38BDF8' }, { x: 680, w: 120, colorHex: '#A855F7' }] },
      { row: 7, kind: 'road', speed: -180, items: [{ x: 140, w: 95, colorHex: '#FACC15' }, { x: 520, w: 95, colorHex: '#EC4899' }, { x: 910, w: 95, colorHex: '#FACC15' }] },
      { row: 8, kind: 'safe', speed: 0, items: [] },
    ];
    return {
      timeLeft: totalTime,
      totalTime,
      lanes,
      pads: [180, 390, 600, 810, 1020].map((x) => ({ x, claimedByColor: null })),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 200 + ((i * 120) % 800),
        row: 8,
        hopTimer: 0,
        stunTimer: 0,
        crossings: 0,
        score: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DODGE TRAFFIC · RIDE LOGS TO GOLDEN LILY PADS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const ln of state.lanes) {
      if (ln.speed === 0) continue;
      for (const it of ln.items) {
        it.x += ln.speed * dt;
        if (ln.speed > 0 && it.x > ARENA_WIDTH + 60) it.x = -it.w - 40;
        if (ln.speed < 0 && it.x < -it.w - 60) it.x = ARENA_WIDTH + 40;
      }
    }

    for (const p of state.players) {
      p.hopTimer = Math.max(0, p.hopTimer - dt);
      p.stunTimer = Math.max(0, p.stunTimer - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      if (p.stunTimer > 0) continue;

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.x = clamp(p.x + mx * 240 * dt, 40, ARENA_WIDTH - 40);

      if (aDown && !p.prevA && p.hopTimer <= 0) {
        const dRow = my > 0.45 ? 1 : -1;
        p.row = clamp(p.row + dRow, 0, 8);
        p.hopTimer = 0.2;
        if (dRow < 0) p.score += 10 * mult;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (bDown && !p.prevB && p.cdB <= 0) {
        p.row = clamp(p.row - 2, 0, 8);
        p.hopTimer = 0.28;
        p.cdB = frenzy ? 1.8 : 3.4;
        p.score += 20 * mult;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      const lane = state.lanes[p.row];
      if (lane.kind === 'road') {
        const hitCar = lane.items.some((c) => p.x > c.x - 16 && p.x < c.x + c.w + 16);
        if (hitCar) {
          p.row = 8;
          p.stunTimer = 0.9;
          sounds.push({ type: 'elim', playerId: p.id });
        }
      } else if (lane.kind === 'river') {
        const onLog = lane.items.find((l) => p.x > l.x - 14 && p.x < l.x + l.w + 14);
        if (onLog) {
          p.x = clamp(p.x + lane.speed * dt, 30, ARENA_WIDTH - 30);
        } else {
          p.row = 4;
          p.stunTimer = 0.8;
          sounds.push({ type: 'hit', playerId: p.id });
        }
      } else if (lane.kind === 'goal') {
        p.crossings += 1;
        p.score += 150 * mult;
        const nearestPad = [...state.pads].sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
        if (nearestPad) nearestPad.claimedByColor = p.colorHex;
        p.row = 8;
        state.banner = `${p.name} REACHED THE LILY PAD (+${150 * mult})!`;
        sounds.push({ type: 'win', playerId: p.id });
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'frog-crossing',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      lanes: state.lanes.map((l) => ({ row: l.row, kind: l.kind, items: l.items })),
      pads: state.pads,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        row: p.row,
        hopTimer: p.hopTimer,
        stunTimer: p.stunTimer,
        crossings: p.crossings,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 3.4, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.crossings} Crossings`);
  },
};

// ============================================================================
// 6. BARREL TOWER (Donkey Kong)
// ============================================================================
const DK_FLOORS = [
  { y: 625, tilt: 0, ladderX: [260, 940] },
  { y: 495, tilt: 0, ladderX: [460, 760] },
  { y: 365, tilt: 0, ladderX: [240, 960] },
  { y: 235, tilt: 0, ladderX: [600] },
  { y: 120, tilt: 0, ladderX: [] },
];

interface BarrelTowerState {
  timeLeft: number;
  totalTime: number;
  spawnTimer: number;
  bSeq: number;
  barrels: { id: string; x: number; y: number; vx: number; r: number; floorIdx: number; burning: boolean }[];
  hammers: { id: string; x: number; y: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vy: number;
    floorIdx: number;
    hammerTimer: number;
    stunTimer: number;
    summits: number;
    score: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const barrelTowerModule: CompactGameModule<BarrelTowerState, BarrelTowerSnapshot> = {
  id: 'barrel-tower',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      spawnTimer: 1.0,
      bSeq: 1,
      barrels: [],
      hammers: [
        { id: 'h1', x: 350, y: 462 },
        { id: 'h2', x: 840, y: 332 },
      ],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 160 + i * 65,
        y: DK_FLOORS[0].y - 20,
        vy: 0,
        floorIdx: 0,
        hammerTimer: 0,
        stunTimer: 0,
        summits: 0,
        score: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'CLIMB LADDERS & VAULT ROLLING BARRELS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = 1.6;
      state.barrels.push({
        id: `bl_${state.bSeq++}`,
        x: 560,
        y: DK_FLOORS[3].y - 18,
        vx: Math.random() < 0.5 ? 215 : -215,
        r: 18,
        floorIdx: 3,
        burning: Math.random() < 0.25,
      });
    }

    for (let i = state.barrels.length - 1; i >= 0; i--) {
      const b = state.barrels[i];
      b.x += b.vx * dt;
      if (b.x < 95 || b.x > ARENA_WIDTH - 95) {
        if (b.floorIdx > 0) {
          b.floorIdx -= 1;
          b.y = DK_FLOORS[b.floorIdx].y - 18;
          b.vx = -b.vx;
          b.x = clamp(b.x, 105, ARENA_WIDTH - 105);
        } else {
          state.barrels.splice(i, 1);
        }
      }
    }

    for (const p of state.players) {
      p.hammerTimer = Math.max(0, p.hammerTimer - dt);
      p.stunTimer = Math.max(0, p.stunTimer - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      if (p.stunTimer > 0) continue;

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.x = clamp(p.x + mx * 300 * dt, 90, ARENA_WIDTH - 90);
      const fl = DK_FLOORS[p.floorIdx];
      const floorY = fl.y - 20;

      // Climb ladder
      const onLadder = fl.ladderX.some((lx) => Math.abs(p.x - lx) < 34);
      if (onLadder && my < -0.35 && p.floorIdx < DK_FLOORS.length - 1) {
        p.y -= 210 * dt;
        p.vy = 0;
        if (p.y <= DK_FLOORS[p.floorIdx + 1].y - 16) {
          p.floorIdx += 1;
          p.y = DK_FLOORS[p.floorIdx].y - 20;
          p.score += 20 * mult;
          if (p.floorIdx === DK_FLOORS.length - 1) {
            p.summits += 1;
            p.score += 200 * mult;
            p.floorIdx = 0;
            p.y = DK_FLOORS[0].y - 20;
            p.x = 180 + Math.random() * 840;
            state.banner = `${p.name} REACHED THE CROWN SUMMIT (+${200 * mult})!`;
            sounds.push({ type: 'win', playerId: p.id });
          }
        }
      } else {
        if (aDown && !p.prevA && Math.abs(p.y - floorY) < 4) {
          p.vy = -440;
          sounds.push({ type: 'tick', playerId: p.id });
        }
        p.vy += 1250 * dt;
        p.y += p.vy * dt;
        if (p.y >= floorY) {
          p.y = floorY;
          p.vy = 0;
        }
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.hammerTimer = Math.max(p.hammerTimer, frenzy ? 4.5 : 2.5);
        p.cdB = 5.5;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      p.prevA = aDown;
      p.prevB = bDown;

      // Pick hammers
      for (const h of state.hammers) {
        if (dist(p.x, p.y, h.x, h.y) < 34) {
          p.hammerTimer = 5.5;
          h.x = 200 + Math.random() * 800;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      // Barrel collisions & jump-overs
      for (let i = state.barrels.length - 1; i >= 0; i--) {
        const b = state.barrels[i];
        if (dist(p.x, p.y, b.x, b.y) < 32) {
          if (p.hammerTimer > 0) {
            state.barrels.splice(i, 1);
            p.score += 65 * mult;
            sounds.push({ type: 'score', playerId: p.id });
          } else {
            p.stunTimer = 1.1;
            p.score = Math.max(0, p.score - 20);
            sounds.push({ type: 'hit', playerId: p.id });
          }
        } else if (Math.abs(p.x - b.x) < 18 && b.y - p.y > 26 && b.y - p.y < 78 && p.vy !== 0) {
          p.score += 25 * mult;
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'barrel-tower',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      floors: DK_FLOORS,
      barrels: state.barrels.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, r: b.r, burning: b.burning })),
      hammers: state.hammers,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        vy: p.vy,
        floorIdx: p.floorIdx,
        hammerTimer: p.hammerTimer,
        stunTimer: p.stunTimer,
        summits: p.summits,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 5.5, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.summits} Summits`);
  },
};

// ============================================================================
// 7. WHACK BLITZ (Whac-A-Mole)
// ============================================================================
interface WhackHole {
  x: number;
  y: number;
  mole: 'none' | 'normal' | 'golden' | 'bomb';
  timer: number;
  duration: number;
}
interface WhackBlitzState {
  timeLeft: number;
  totalTime: number;
  holes: WhackHole[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  spawnTimer: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    swingTimer: number;
    stunTimer: number;
    streak: number;
    score: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const whackBlitzModule: CompactGameModule<WhackBlitzState, WhackBlitzSnapshot> = {
  id: 'whack-blitz',
  init({ players, settingValue }) {
    const totalTime = settingValue || 60;
    const holes: WhackHole[] = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        holes.push({
          x: 240 + c * 240,
          y: 220 + r * 175,
          mole: 'none',
          timer: 0,
          duration: 1.5,
        });
      }
    }
    return {
      timeLeft: totalTime,
      totalTime,
      holes,
      popups: [],
      spawnTimer: 0.3,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 360 + (i % 4) * 160,
        y: 360 + Math.floor(i / 4) * 80,
        swingTimer: 0,
        stunTimer: 0,
        streak: 0,
        score: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'WHACK MOLES & GOLDEN KINGS · DODGE BOMBS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= 48 * dt;
      state.popups[i].alpha -= dt * 1.4;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = frenzy ? 0.25 : 0.42;
      const empty = state.holes.filter((h) => h.mole === 'none');
      if (empty.length > 0) {
        const pick = empty[Math.floor(Math.random() * empty.length)];
        const r = Math.random();
        pick.mole = r < (frenzy ? 0.34 : 0.2) ? 'golden' : r < 0.38 ? 'bomb' : 'normal';
        pick.duration = pick.mole === 'golden' ? 1.25 : 1.85;
        pick.timer = pick.duration;
      }
    }

    for (const h of state.holes) {
      if (h.mole !== 'none') {
        h.timer -= dt;
        if (h.timer <= 0) h.mole = 'none';
      }
    }

    for (const p of state.players) {
      p.swingTimer = Math.max(0, p.swingTimer - dt);
      p.stunTimer = Math.max(0, p.stunTimer - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      if (p.stunTimer > 0) continue;

      const inp = players.find((x) => x.id === p.id)?.input;
      p.x = clamp(p.x + (inp?.moveX ?? 0) * 580 * dt, 90, ARENA_WIDTH - 90);
      p.y = clamp(p.y + (inp?.moveY ?? 0) * 520 * dt, 110, ARENA_HEIGHT - 80);

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      const whack = aDown && !p.prevA;
      const shock = bDown && !p.prevB && p.cdB <= 0;
      p.prevA = aDown;
      p.prevB = bDown;

      if (whack || shock) {
        p.swingTimer = 0.22;
        const rad = shock ? 260 : 78;
        if (shock) p.cdB = 4.5;
        for (const h of state.holes) {
          if (h.mole === 'none') continue;
          if (dist(p.x, p.y, h.x, h.y) < rad) {
            if (h.mole === 'bomb' && !shock) {
              p.stunTimer = 1.4;
              p.streak = 0;
              p.score = Math.max(0, p.score - 45);
              state.popups.push({ x: h.x, y: h.y - 24, text: 'BOOM -45', colorHex: '#EF4444', alpha: 1 });
              sounds.push({ type: 'elim', playerId: p.id });
            } else if (h.mole !== 'bomb') {
              p.streak += 1;
              const gain = (h.mole === 'golden' ? 80 : 25) * mult;
              p.score += gain;
              state.popups.push({
                x: h.x,
                y: h.y - 24,
                text: `+${gain}`,
                colorHex: h.mole === 'golden' ? '#FACC15' : p.colorHex,
                alpha: 1,
              });
              sounds.push({ type: h.mole === 'golden' ? 'win' : 'score', playerId: p.id });
            }
            h.mole = 'none';
            if (!shock) break;
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'whack-blitz',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      holes: state.holes.map((h) => ({
        x: h.x,
        y: h.y,
        mole: h.mole,
        popProgress: h.mole === 'none' ? 0 : Math.min(1, Math.sin((h.timer / h.duration) * Math.PI) * 1.4),
      })),
      popups: state.popups,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        swingTimer: p.swingTimer,
        stunTimer: p.stunTimer,
        streak: p.streak,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 4.5, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} Whack Pts`);
  },
};

// ============================================================================
// 8. RHYTHM PULSE (DDR / Guitar Hero)
// ============================================================================
interface RhythmNote {
  id: string;
  lane: 0 | 1 | 2 | 3;
  y: number;
  golden: boolean;
  hitBy: Set<string>;
}
interface RhythmState {
  timeLeft: number;
  totalTime: number;
  bpm: number;
  beatPhase: number;
  spawnTimer: number;
  nSeq: number;
  notes: RhythmNote[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    activeLane: number;
    combo: number;
    maxCombo: number;
    lastJudge: string;
    judgeColor: string;
    score: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const rhythmPulseModule: CompactGameModule<RhythmState, RhythmPulseSnapshot> = {
  id: 'rhythm-pulse',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      bpm: 124,
      beatPhase: 0,
      spawnTimer: 0.4,
      nSeq: 1,
      notes: [],
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        activeLane: 1,
        combo: 0,
        maxCombo: 0,
        lastJudge: 'READY',
        judgeColor: '#94A3B8',
        score: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'AIM THE LANE & SLAM BEAT ON THE GLOW LINE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.beatPhase = (state.beatPhase + dt * (state.bpm / 60)) % 1;
    const mult = frenzy ? 2 : 1;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = 0.52;
      const lane = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
      state.notes.push({
        id: `rn_${state.nSeq++}`,
        lane,
        y: 80,
        golden: Math.random() < 0.22,
        hitBy: new Set(),
      });
    }

    for (let i = state.notes.length - 1; i >= 0; i--) {
      state.notes[i].y += 330 * dt;
      if (state.notes[i].y > 685) state.notes.splice(i, 1);
    }

    const hitY = 585;
    for (const p of state.players) {
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      if (Math.hypot(mx, my) > 0.3) {
        if (mx < -0.5) p.activeLane = 0;
        else if (my < -0.4) p.activeLane = 1;
        else if (my > 0.4) p.activeLane = 2;
        else if (mx > 0.5) p.activeLane = 3;
        else p.activeLane = clamp(Math.floor(((mx + 1) / 2) * 4), 0, 3);
      }

      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;
      const hitA = aDown && !p.prevA;
      const hitB = bDown && !p.prevB && p.cdB <= 0;
      p.prevA = aDown;
      p.prevB = bDown;

      if (hitA || hitB) {
        if (hitB) p.cdB = 3.0;
        const cand = state.notes
          .filter((n) => !n.hitBy.has(p.id) && (hitB || n.lane === p.activeLane) && Math.abs(n.y - hitY) < 68)
          .sort((a, b) => Math.abs(a.y - hitY) - Math.abs(b.y - hitY))[0];
        if (cand) {
          cand.hitBy.add(p.id);
          const err = Math.abs(cand.y - hitY);
          const perfect = err < 26;
          p.combo += 1;
          p.maxCombo = Math.max(p.maxCombo, p.combo);
          const comboMult = 1 + Math.min(3, Math.floor(p.combo / 5)) * 0.5;
          const base = (perfect ? 50 : 25) * (cand.golden || hitB ? 1.8 : 1);
          p.score += Math.round(base * comboMult * mult);
          p.lastJudge = perfect ? 'PERFECT!' : 'GREAT!';
          p.judgeColor = perfect ? '#FACC15' : '#22C55E';
          sounds.push({ type: perfect ? 'score' : 'tick', playerId: p.id });
        } else {
          p.combo = 0;
          p.lastJudge = 'MISS';
          p.judgeColor = '#EF4444';
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'rhythm-pulse',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      bpm: state.bpm,
      beatPhase: state.beatPhase,
      notes: state.notes.map((n) => ({ id: n.id, lane: n.lane, y: n.y, golden: n.golden })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        activeLane: p.activeLane,
        combo: p.combo,
        maxCombo: p.maxCombo,
        lastJudge: p.lastJudge,
        judgeColor: p.judgeColor,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 3.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `Max Combo ×${p.maxCombo}`);
  },
};
