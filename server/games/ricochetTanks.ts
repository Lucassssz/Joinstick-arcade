import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type RankingEntry,
  type RicochetTanksSnapshot,
  type SoundEvent,
  type TankMineState,
  type TankPlayerState,
  type TankShellState,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface InternalTank extends TankPlayerState {
  fireCd: number;
  mineCd: number;
}

interface InternalShell extends TankShellState {
  life: number;
  safeAge: number;
}

interface InternalMine extends TankMineState {
  armTimer: number;
  life: number;
}

interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface RicochetTanksInternalState {
  timeLeft: number;
  totalTime: number;
  walls: WallRect[];
  shells: InternalShell[];
  mines: InternalMine[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  players: InternalTank[];
  nextId: number;
  finished: boolean;
}

const ARENA_MARGIN = 22;
const TANK_RADIUS = 19;
const TANK_SPEED = 235;
const FIRE_COOLDOWN = 0.65;
const MINE_COOLDOWN = 3.8;
const MAX_MINES_PER_TANK = 2;
const SHELL_SPEED = 520;
const SHELL_RADIUS = 6;
const MAX_BOUNCES = 2;

// Symmetrical tactical bunker walls inside 1200x720
const BUNKER_WALLS: WallRect[] = [
  // Center cross barriers
  { x: 560, y: 270, w: 80, h: 28 },
  { x: 560, y: 422, w: 80, h: 28 },
  // Left & Right vertical shields
  { x: 265, y: 260, w: 30, h: 200 },
  { x: 905, y: 260, w: 30, h: 200 },
  // Four corner L-bunkers
  { x: 185, y: 120, w: 155, h: 26 },
  { x: 860, y: 120, w: 155, h: 26 },
  { x: 185, y: 574, w: 155, h: 26 },
  { x: 860, y: 574, w: 155, h: 26 },
  // Mid-lane pillars
  { x: 425, y: 165, w: 28, h: 115 },
  { x: 747, y: 165, w: 28, h: 115 },
  { x: 425, y: 440, w: 28, h: 115 },
  { x: 747, y: 440, w: 28, h: 115 },
];

const SPAWN_SPOTS = [
  { x: 105, y: 105, angle: 0.4 },
  { x: 1095, y: 615, angle: -2.7 },
  { x: 1095, y: 105, angle: 2.7 },
  { x: 105, y: 615, angle: -0.4 },
  { x: 600, y: 80, angle: Math.PI / 2 },
  { x: 600, y: 640, angle: -Math.PI / 2 },
  { x: 105, y: 360, angle: 0 },
  { x: 1095, y: 360, angle: Math.PI },
];

function resolveCircleRect(
  cx: number,
  cy: number,
  r: number,
  rect: WallRect
): { x: number; y: number; hit: boolean; nx: number; ny: number } {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= r * r) {
    return { x: cx, y: cy, hit: false, nx: 0, ny: 0 };
  }
  const dist = Math.sqrt(distSq);
  if (dist > 0.0001) {
    const nx = dx / dist;
    const ny = dy / dist;
    return {
      x: closestX + nx * r,
      y: closestY + ny * r,
      hit: true,
      nx,
      ny,
    };
  }
  // Center inside rect fallback
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const minPen = Math.min(left, right, top, bottom);
  if (minPen === left) return { x: rect.x - r, y: cy, hit: true, nx: -1, ny: 0 };
  if (minPen === right) return { x: rect.x + rect.w + r, y: cy, hit: true, nx: 1, ny: 0 };
  if (minPen === top) return { x: cx, y: rect.y - r, hit: true, nx: 0, ny: -1 };
  return { x: cx, y: rect.y + rect.h + r, hit: true, nx: 0, ny: 1 };
}

function createTank(p: ServerPlayerInputState, idx: number): InternalTank {
  const spot = SPAWN_SPOTS[idx % SPAWN_SPOTS.length];
  return {
    id: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    colorHex: p.color.hex,
    x: spot.x,
    y: spot.y,
    hullAngle: spot.angle,
    turretAngle: spot.angle,
    hp: 3,
    maxHp: 3,
    alive: true,
    respawnTimer: 0,
    shieldTimer: 1.5,
    fireCd: 0,
    mineCd: 0,
    cooldownA: 0,
    cooldownB: 0,
    kills: 0,
    bankKills: 0,
    score: 0,
  };
}

function toSnapshot(state: RicochetTanksInternalState): RicochetTanksSnapshot {
  return {
    gameId: 'ricochet-tanks',
    timeLeft: Math.max(0, state.timeLeft),
    totalTime: state.totalTime,
    walls: state.walls,
    shells: state.shells.map((s) => ({
      id: s.id,
      ownerId: s.ownerId,
      colorHex: s.colorHex,
      x: s.x,
      y: s.y,
      vx: s.vx,
      vy: s.vy,
      bounces: s.bounces,
      maxBounces: s.maxBounces,
    })),
    mines: state.mines.map((m) => ({
      id: m.id,
      ownerId: m.ownerId,
      colorHex: m.colorHex,
      x: m.x,
      y: m.y,
      armed: m.armed,
    })),
    explosions: state.explosions.map((e) => ({ ...e })),
    players: state.players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.colorHex,
      x: p.x,
      y: p.y,
      hullAngle: p.hullAngle,
      turretAngle: p.turretAngle,
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      respawnTimer: p.respawnTimer,
      shieldTimer: p.shieldTimer,
      cooldownA: Math.min(1, Math.max(0, p.fireCd / FIRE_COOLDOWN)),
      cooldownB: Math.min(1, Math.max(0, p.mineCd / MINE_COOLDOWN)),
      kills: p.kills,
      bankKills: p.bankKills,
      score: p.score,
    })),
  };
}

function buildRankings(
  state: RicochetTanksInternalState,
  inputPlayers: ServerPlayerInputState[]
): RankingEntry[] {
  const colorById = new Map(inputPlayers.map((p) => [p.id, p.color]));
  const sorted = [...state.players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.kills - a.kills;
  });
  return sorted.map((p, idx) => ({
    playerId: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    color: colorById.get(p.id) ?? {
      id: 'default',
      name: 'Player',
      hex: p.colorHex,
      dark: p.colorHex,
      textOnColor: '#FFFFFF',
    },
    rank: idx + 1,
    score: p.score,
    highlight:
      p.bankKills > 0
        ? `${p.kills} KO (${p.bankKills} bank)`
        : `${p.kills} KO${p.kills === 1 ? '' : 's'}`,
  }));
}

export const ricochetTanksModule: ServerGameModule<RicochetTanksInternalState> = {
  id: 'ricochet-tanks',

  createState(players: ServerPlayerInputState[], settingValue: number): RicochetTanksInternalState {
    const totalTime = Math.max(30, Math.min(180, settingValue || 90));
    return {
      timeLeft: totalTime,
      totalTime,
      walls: BUNKER_WALLS,
      shells: [],
      mines: [],
      explosions: [],
      players: players.map((p, idx) => createTank(p, idx)),
      nextId: 1,
      finished: false,
    };
  },

  addPlayer(state: RicochetTanksInternalState, p: ServerPlayerInputState): void {
    if (state.players.some((x) => x.id === p.id)) return;
    state.players.push(createTank(p, state.players.length));
  },

  step(state: RicochetTanksInternalState, inputPlayers: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(inputPlayers.map((p) => [p.id, p]));

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.timeLeft <= 0) {
      state.finished = true;
      sounds.push({ type: 'win' });
    }

    for (let i = state.explosions.length - 1; i >= 0; i--) {
      const e = state.explosions[i];
      e.radius += 220 * dt;
      e.alpha = Math.max(0, e.alpha - 2.4 * dt);
      if (e.alpha <= 0) state.explosions.splice(i, 1);
    }

    const damageTank = (
      victim: InternalTank,
      attackerId: string,
      dmg: number,
      isBankShot: boolean
    ) => {
      if (!victim.alive || victim.shieldTimer > 0) return;
      victim.hp -= dmg;
      state.explosions.push({
        x: victim.x,
        y: victim.y,
        radius: 14,
        colorHex: victim.colorHex,
        alpha: 0.9,
      });
      sounds.push({ type: 'hit', playerId: victim.id });
      haptics.push({ playerId: victim.id, pattern: [50, 25, 65], reason: 'hit' });

      if (victim.hp <= 0) {
        victim.alive = false;
        victim.respawnTimer = 2.0;
        state.explosions.push({
          x: victim.x,
          y: victim.y,
          radius: 26,
          colorHex: '#FF4D2E',
          alpha: 1,
        });
        sounds.push({ type: 'ko', playerId: victim.id });
        haptics.push({ playerId: victim.id, pattern: [75, 40, 100], reason: 'ko' });

        if (attackerId !== victim.id) {
          const attacker = state.players.find((x) => x.id === attackerId);
          if (attacker) {
            attacker.kills += 1;
            attacker.score += isBankShot ? 150 : 100;
            if (isBankShot) attacker.bankKills += 1;
            haptics.push({ playerId: attacker.id, pattern: [35, 25, 65], reason: 'score' });
          }
        }
      }
    };

    // Update tanks
    for (const tank of state.players) {
      tank.fireCd = Math.max(0, tank.fireCd - dt);
      tank.mineCd = Math.max(0, tank.mineCd - dt);
      tank.shieldTimer = Math.max(0, tank.shieldTimer - dt);

      if (!tank.alive) {
        tank.respawnTimer -= dt;
        if (tank.respawnTimer <= 0) {
          const spot = SPAWN_SPOTS[(tank.slotIndex + Math.floor(state.timeLeft)) % SPAWN_SPOTS.length];
          tank.x = spot.x;
          tank.y = spot.y;
          tank.hullAngle = spot.angle;
          tank.turretAngle = spot.angle;
          tank.hp = tank.maxHp;
          tank.alive = true;
          tank.shieldTimer = 1.8;
        }
        continue;
      }

      const src = inputMap.get(tank.id);
      if (src) {
        const { dx, dy, a, b } = src.input;
        const mag = Math.hypot(dx, dy);
        if (mag > 0.1) {
          const nx = dx / Math.max(1, mag);
          const ny = dy / Math.max(1, mag);
          const speed = TANK_SPEED * Math.min(1, mag);
          tank.x += nx * speed * dt;
          tank.y += ny * speed * dt;
          const targetAngle = Math.atan2(ny, nx);
          tank.hullAngle = targetAngle;
          tank.turretAngle = targetAngle;
        }

        // Action A: Fire bouncing shell
        if (a && !src.prevA && tank.fireCd <= 0) {
          tank.fireCd = FIRE_COOLDOWN;
          const muzzleX = tank.x + Math.cos(tank.turretAngle) * (TANK_RADIUS + 8);
          const muzzleY = tank.y + Math.sin(tank.turretAngle) * (TANK_RADIUS + 8);
          state.shells.push({
            id: `sh_${state.nextId++}`,
            ownerId: tank.id,
            colorHex: tank.colorHex,
            x: muzzleX,
            y: muzzleY,
            vx: Math.cos(tank.turretAngle) * SHELL_SPEED,
            vy: Math.sin(tank.turretAngle) * SHELL_SPEED,
            bounces: 0,
            maxBounces: MAX_BOUNCES,
            life: 3.4,
            safeAge: 0.18,
          });
          sounds.push({ type: 'shoot', playerId: tank.id });
          haptics.push({ playerId: tank.id, pattern: 35, reason: 'shoot' });
        }

        // Action B: Plant proximity mine
        if (b && !src.prevB && tank.mineCd <= 0) {
          tank.mineCd = MINE_COOLDOWN;
          const myMines = state.mines.filter((m) => m.ownerId === tank.id);
          if (myMines.length >= MAX_MINES_PER_TANK) {
            const oldestIdx = state.mines.findIndex((m) => m.ownerId === tank.id);
            if (oldestIdx >= 0) state.mines.splice(oldestIdx, 1);
          }
          state.mines.push({
            id: `mn_${state.nextId++}`,
            ownerId: tank.id,
            colorHex: tank.colorHex,
            x: tank.x - Math.cos(tank.hullAngle) * 18,
            y: tank.y - Math.sin(tank.hullAngle) * 18,
            armed: false,
            armTimer: 0.7,
            life: 16,
          });
          sounds.push({ type: 'pickup', playerId: tank.id });
          haptics.push({ playerId: tank.id, pattern: 40, reason: 'mine' });
        }
      }

      // Clamp to arena walls
      tank.x = Math.max(ARENA_MARGIN + TANK_RADIUS, Math.min(ARENA_WIDTH - ARENA_MARGIN - TANK_RADIUS, tank.x));
      tank.y = Math.max(ARENA_MARGIN + TANK_RADIUS, Math.min(ARENA_HEIGHT - ARENA_MARGIN - TANK_RADIUS, tank.y));

      // Resolve tank vs bunker walls
      for (const wall of state.walls) {
        const res = resolveCircleRect(tank.x, tank.y, TANK_RADIUS, wall);
        if (res.hit) {
          tank.x = res.x;
          tank.y = res.y;
        }
      }
    }

    // Tank-to-tank separation
    for (let i = 0; i < state.players.length; i++) {
      const a = state.players[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < state.players.length; j++) {
        const b = state.players[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minD = TANK_RADIUS * 2;
        if (dist > 0.01 && dist < minD) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minD - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;
        }
      }
    }

    // Update bouncing shells
    for (let i = state.shells.length - 1; i >= 0; i--) {
      const sh = state.shells[i];
      sh.life -= dt;
      sh.safeAge = Math.max(0, sh.safeAge - dt);
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;

      let bounced = false;
      if (sh.x < ARENA_MARGIN + SHELL_RADIUS) {
        sh.x = ARENA_MARGIN + SHELL_RADIUS;
        sh.vx = Math.abs(sh.vx);
        bounced = true;
      } else if (sh.x > ARENA_WIDTH - ARENA_MARGIN - SHELL_RADIUS) {
        sh.x = ARENA_WIDTH - ARENA_MARGIN - SHELL_RADIUS;
        sh.vx = -Math.abs(sh.vx);
        bounced = true;
      }
      if (sh.y < ARENA_MARGIN + SHELL_RADIUS) {
        sh.y = ARENA_MARGIN + SHELL_RADIUS;
        sh.vy = Math.abs(sh.vy);
        bounced = true;
      } else if (sh.y > ARENA_HEIGHT - ARENA_MARGIN - SHELL_RADIUS) {
        sh.y = ARENA_HEIGHT - ARENA_MARGIN - SHELL_RADIUS;
        sh.vy = -Math.abs(sh.vy);
        bounced = true;
      }

      for (const wall of state.walls) {
        const res = resolveCircleRect(sh.x, sh.y, SHELL_RADIUS, wall);
        if (res.hit) {
          sh.x = res.x;
          sh.y = res.y;
          const dot = sh.vx * res.nx + sh.vy * res.ny;
          if (dot < 0) {
            sh.vx -= 2 * dot * res.nx;
            sh.vy -= 2 * dot * res.ny;
          }
          bounced = true;
          break;
        }
      }

      if (bounced) {
        sh.bounces += 1;
        sounds.push({ type: 'bump', intensity: 0.45 });
        if (sh.bounces > sh.maxBounces) {
          state.explosions.push({
            x: sh.x,
            y: sh.y,
            radius: 8,
            colorHex: sh.colorHex,
            alpha: 0.75,
          });
          state.shells.splice(i, 1);
          continue;
        }
      }

      if (sh.life <= 0) {
        state.shells.splice(i, 1);
        continue;
      }

      // Check shell hit on tanks
      let hitTank = false;
      for (const tank of state.players) {
        if (!tank.alive) continue;
        if (tank.id === sh.ownerId && sh.safeAge > 0) continue;
        if (Math.hypot(sh.x - tank.x, sh.y - tank.y) < TANK_RADIUS + SHELL_RADIUS) {
          damageTank(tank, sh.ownerId, 1, sh.bounces > 0);
          hitTank = true;
          break;
        }
      }
      if (hitTank) {
        state.shells.splice(i, 1);
      }
    }

    // Update proximity mines
    for (let i = state.mines.length - 1; i >= 0; i--) {
      const m = state.mines[i];
      m.life -= dt;
      if (!m.armed) {
        m.armTimer -= dt;
        if (m.armTimer <= 0) m.armed = true;
      }
      if (m.life <= 0) {
        state.mines.splice(i, 1);
        continue;
      }
      if (!m.armed) continue;

      let triggered = false;
      for (const tank of state.players) {
        if (!tank.alive || tank.id === m.ownerId) continue;
        if (Math.hypot(tank.x - m.x, tank.y - m.y) < TANK_RADIUS + 26) {
          triggered = true;
          break;
        }
      }
      if (triggered) {
        state.explosions.push({
          x: m.x,
          y: m.y,
          radius: 30,
          colorHex: '#FF7A1A',
          alpha: 1,
        });
        sounds.push({ type: 'pulse', playerId: m.ownerId });
        for (const tank of state.players) {
          if (!tank.alive) continue;
          if (Math.hypot(tank.x - m.x, tank.y - m.y) < 88) {
            damageTank(tank, m.ownerId, 2, false);
          }
        }
        state.mines.splice(i, 1);
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: p.score,
        alive: p.alive,
        statText: p.alive ? `${p.kills} KO · ${p.score} pts` : `RESPAWN ${p.respawnTimer.toFixed(1)}s`,
        cooldownA: Math.min(1, Math.max(0, p.fireCd / FIRE_COOLDOWN)),
        cooldownB: Math.min(1, Math.max(0, p.mineCd / MINE_COOLDOWN)),
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

  getSnapshot(state: RicochetTanksInternalState): RicochetTanksSnapshot {
    return toSnapshot(state);
  },

  getRankings(state: RicochetTanksInternalState, players: ServerPlayerInputState[]): RankingEntry[] {
    return buildRankings(state, players);
  },
};
