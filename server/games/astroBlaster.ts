import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type AstroBlasterSnapshot,
  type AstroBulletState,
  type AstroPickupState,
  type AstroShipState,
  type RankingEntry,
  type SoundEvent,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface InternalShip extends AstroShipState {
  fireCd: number;
  boostCd: number;
  tripleTimer: number;
  pierceTimer: number;
}

interface InternalBullet extends AstroBulletState {
  ttl: number;
  pierce: boolean;
}

interface InternalExplosion {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  colorHex: string;
  alpha: number;
}

interface InternalCrystal {
  id: string;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
}

interface InternalPopup {
  x: number;
  y: number;
  text: string;
  colorHex: string;
  alpha: number;
}

interface AstroInternalState {
  timeLeft: number;
  totalTime: number;
  asteroids: { x: number; y: number; r: number; seed: number }[];
  crystals: InternalCrystal[];
  crystalSpawnTimer: number;
  vortex: { x: number; y: number; r: number; active: boolean; timer: number };
  vortexCooldown: number;
  pickups: AstroPickupState[];
  pickupSpawnTimer: number;
  bullets: InternalBullet[];
  explosions: InternalExplosion[];
  popups: InternalPopup[];
  players: InternalShip[];
  bulletSeq: number;
  pickupSeq: number;
  finished: boolean;
}

const FIRE_CD_NORMAL = 0.27;
const FIRE_CD_RAPID = 0.13;
const BOOST_CD = 2.1;
const BOOST_DURATION = 0.28;
const SHIP_RADIUS = 19;
const BULLET_SPEED = 690;

const FIXED_ASTEROIDS = [
  { x: 310, y: 210, r: 44, seed: 11 },
  { x: 890, y: 210, r: 42, seed: 23 },
  { x: 600, y: 360, r: 52, seed: 37 },
  { x: 310, y: 510, r: 40, seed: 53 },
  { x: 890, y: 510, r: 45, seed: 71 },
  { x: 600, y: 120, r: 28, seed: 89 },
  { x: 600, y: 600, r: 28, seed: 97 },
];

const SPAWN_SLOTS = [
  { x: 130, y: 130, angle: 0.6 },
  { x: 1070, y: 590, angle: -2.5 },
  { x: 1070, y: 130, angle: 2.5 },
  { x: 130, y: 590, angle: -0.6 },
  { x: 600, y: 230, angle: Math.PI / 2 },
  { x: 600, y: 490, angle: -Math.PI / 2 },
  { x: 160, y: 360, angle: 0 },
  { x: 1040, y: 360, angle: Math.PI },
];

function findSafeSpawn(
  slotIndex: number,
  players: InternalShip[]
): { x: number; y: number; angle: number } {
  let best = SPAWN_SLOTS[slotIndex % SPAWN_SLOTS.length];
  let bestMinDist = -1;
  for (const candidate of SPAWN_SLOTS) {
    let minDist = Infinity;
    for (const p of players) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - candidate.x, p.y - candidate.y);
      if (d < minDist) minDist = d;
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      best = candidate;
    }
  }
  return best;
}

function toSnapshot(state: AstroInternalState): AstroBlasterSnapshot {
  return {
    gameId: 'astro-blaster',
    timeLeft: Math.max(0, state.timeLeft),
    totalTime: state.totalTime,
    asteroids: state.asteroids,
    crystals: state.crystals.map((c) => ({ ...c })),
    vortex: state.vortex.active ? { ...state.vortex } : null,
    pickups: state.pickups.map((p) => ({ ...p })),
    bullets: state.bullets.map((b) => ({
      id: b.id,
      ownerId: b.ownerId,
      colorHex: b.colorHex,
      x: b.x,
      y: b.y,
      vx: b.vx,
      vy: b.vy,
      pierce: b.pierce,
    })),
    explosions: state.explosions.map((e) => ({
      x: e.x,
      y: e.y,
      radius: e.radius,
      colorHex: e.colorHex,
      alpha: e.alpha,
    })),
    popups: state.popups.map((p) => ({ ...p })),
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
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      respawnTimer: p.respawnTimer,
      shieldTimer: p.shieldTimer,
      rapidTimer: p.rapidTimer,
      tripleTimer: p.tripleTimer,
      pierceTimer: p.pierceTimer,
      boostTimer: p.boostTimer,
      cooldownA: Math.min(1, Math.max(0, p.fireCd / (p.rapidTimer > 0 ? FIRE_CD_RAPID : FIRE_CD_NORMAL))),
      cooldownB: Math.min(1, Math.max(0, p.boostCd / BOOST_CD)),
      kills: p.kills,
      score: p.score,
    })),
  };
}

function buildRankings(
  state: AstroInternalState,
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
      name: 'Pilot',
      hex: p.colorHex,
      dark: p.colorHex,
      textOnColor: '#FFFFFF',
    },
    rank: idx + 1,
    score: p.score,
    highlight: `${p.kills} Elim${p.kills === 1 ? '' : 's'}`,
  }));
}

export const astroBlasterModule: ServerGameModule<AstroInternalState> = {
  id: 'astro-blaster',

  createState(players: ServerPlayerInputState[], settingValue: number): AstroInternalState {
    const totalTime = Math.max(30, Math.min(180, settingValue || 75));
    const ships: InternalShip[] = players.map((p, idx) => {
      const sp = SPAWN_SLOTS[idx % SPAWN_SLOTS.length];
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        angle: sp.angle,
        hp: 3,
        maxHp: 3,
        alive: true,
        respawnTimer: 0,
        shieldTimer: 1.5,
        rapidTimer: 0,
        tripleTimer: 0,
        pierceTimer: 0,
        boostTimer: 0,
        fireCd: 0,
        boostCd: 0,
        cooldownA: 0,
        cooldownB: 0,
        kills: 0,
        score: 0,
      };
    });

    return {
      timeLeft: totalTime,
      totalTime,
      asteroids: FIXED_ASTEROIDS,
      crystals: [{ id: 'cr_1', x: 600, y: 245, r: 22, hp: 3, maxHp: 3 }],
      crystalSpawnTimer: 8,
      vortex: { x: 455, y: 360, r: 95, active: false, timer: 0 },
      vortexCooldown: 14,
      pickups: [],
      pickupSpawnTimer: 3.5,
      bullets: [],
      explosions: [],
      popups: [],
      players: ships,
      bulletSeq: 0,
      pickupSeq: 1,
      finished: false,
    };
  },

  addPlayer(state: AstroInternalState, p: ServerPlayerInputState): void {
    if (state.players.some((existing) => existing.id === p.id)) return;
    const sp = findSafeSpawn(p.slotIndex, state.players);
    state.players.push({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: sp.x,
      y: sp.y,
      vx: 0,
      vy: 0,
      angle: sp.angle,
      hp: 3,
      maxHp: 3,
      alive: true,
      respawnTimer: 0,
      shieldTimer: 1.8,
      rapidTimer: 0,
      tripleTimer: 0,
      pierceTimer: 0,
      boostTimer: 0,
      fireCd: 0,
      boostCd: 0,
      cooldownA: 0,
      cooldownB: 0,
      kills: 0,
      score: 0,
    });
  },

  step(state: AstroInternalState, inputPlayers: ServerPlayerInputState[], dt: number): StepOutput {
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
      e.radius += 190 * dt;
      e.alpha = Math.max(0, 1 - e.radius / e.maxRadius);
      if (e.radius >= e.maxRadius) state.explosions.splice(i, 1);
    }

    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pop = state.popups[i];
      pop.y -= 34 * dt;
      pop.alpha -= 0.9 * dt;
      if (pop.alpha <= 0) state.popups.splice(i, 1);
    }

    // Gravity Vortex lifecycle
    if (state.vortex.active) {
      state.vortex.timer -= dt;
      if (state.vortex.timer <= 0) {
        state.vortex.active = false;
        state.vortexCooldown = 16;
      }
    } else {
      state.vortexCooldown -= dt;
      if (state.vortexCooldown <= 0) {
        const spots = [
          { x: 455, y: 360 },
          { x: 745, y: 360 },
          { x: 600, y: 235 },
          { x: 600, y: 485 },
        ];
        const spot = spots[Math.floor(Math.random() * spots.length)];
        state.vortex = { x: spot.x, y: spot.y, r: 95, active: true, timer: 8.5 };
        state.popups.push({ x: spot.x, y: spot.y - 30, text: 'GRAVITY VORTEX!', colorHex: '#FF3B9A', alpha: 1 });
      }
    }

    // Spawn Gold Crystal Meteors
    state.crystalSpawnTimer -= dt;
    if (state.crystalSpawnTimer <= 0 && state.crystals.length < 2) {
      state.crystalSpawnTimer = 9;
      state.pickupSeq += 1;
      const cSpots = [
        { x: 600, y: 240 },
        { x: 600, y: 480 },
        { x: 440, y: 360 },
        { x: 760, y: 360 },
        { x: 210, y: 360 },
        { x: 990, y: 360 },
      ];
      const sp = cSpots[state.pickupSeq % cSpots.length];
      if (!state.crystals.some((c) => Math.hypot(c.x - sp.x, c.y - sp.y) < 55)) {
        state.crystals.push({ id: `cr_${state.pickupSeq}`, x: sp.x, y: sp.y, r: 22, hp: 3, maxHp: 3 });
      }
    }

    // Spawn powerups (now 5 varieties!)
    state.pickupSpawnTimer -= dt;
    if (state.pickupSpawnTimer <= 0 && state.pickups.length < 3) {
      state.pickupSpawnTimer = 5.5;
      const spots = [
        { x: 455, y: 360 },
        { x: 745, y: 360 },
        { x: 600, y: 235 },
        { x: 600, y: 485 },
        { x: 200, y: 360 },
        { x: 1000, y: 360 },
      ];
      const spot = spots[state.pickupSeq % spots.length];
      const kinds: AstroPickupState['kind'][] = ['triple', 'shield', 'rapid', 'pierce', 'heal'];
      const kind = kinds[state.pickupSeq % kinds.length];
      state.pickupSeq += 1;
      if (!state.pickups.some((p) => Math.hypot(p.x - spot.x, p.y - spot.y) < 40)) {
        state.pickups.push({
          id: `pk_${state.pickupSeq}`,
          kind,
          x: spot.x,
          y: spot.y,
        });
      }
    }

    for (const ship of state.players) {
      const src = inputMap.get(ship.id);
      if (!ship.alive) {
        ship.respawnTimer -= dt;
        if (ship.respawnTimer <= 0) {
          const sp = findSafeSpawn(ship.slotIndex, state.players);
          ship.x = sp.x;
          ship.y = sp.y;
          ship.vx = 0;
          ship.vy = 0;
          ship.angle = sp.angle;
          ship.hp = ship.maxHp;
          ship.alive = true;
          ship.shieldTimer = 1.8;
          ship.rapidTimer = 0;
          ship.tripleTimer = 0;
          ship.pierceTimer = 0;
        }
        continue;
      }

      ship.fireCd = Math.max(0, ship.fireCd - dt);
      ship.boostCd = Math.max(0, ship.boostCd - dt);
      ship.shieldTimer = Math.max(0, ship.shieldTimer - dt);
      ship.rapidTimer = Math.max(0, ship.rapidTimer - dt);
      ship.tripleTimer = Math.max(0, ship.tripleTimer - dt);
      ship.pierceTimer = Math.max(0, ship.pierceTimer - dt);
      ship.boostTimer = Math.max(0, ship.boostTimer - dt);

      if (src) {
        const { dx, dy, a, b } = src.input;
        const mag = Math.hypot(dx, dy);
        if (mag > 0.14) {
          const targetAngle = Math.atan2(dy, dx);
          let diff = targetAngle - ship.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ship.angle += diff * Math.min(1, dt * 14);

          const thrust = ship.boostTimer > 0 ? 1050 : 720;
          const clampedMag = Math.min(1, mag);
          ship.vx += (dx / mag) * clampedMag * thrust * dt;
          ship.vy += (dy / mag) * clampedMag * thrust * dt;
        }

        // Action A: Fire plasma (supports Triple Spread & Hyper Piercing!)
        if (a && ship.fireCd <= 0) {
          const cd = ship.rapidTimer > 0 ? FIRE_CD_RAPID : FIRE_CD_NORMAL;
          ship.fireCd = cd;
          const isTriple = ship.tripleTimer > 0;
          const isPierce = ship.pierceTimer > 0;
          const offsets = isTriple ? [-0.2, 0, 0.2] : [0];
          const bSpeed = isPierce ? BULLET_SPEED * 1.25 : BULLET_SPEED;

          for (const angOff of offsets) {
            state.bulletSeq += 1;
            const fireAng = ship.angle + angOff;
            const noseX = ship.x + Math.cos(fireAng) * (SHIP_RADIUS + 8);
            const noseY = ship.y + Math.sin(fireAng) * (SHIP_RADIUS + 8);
            state.bullets.push({
              id: `b_${state.bulletSeq}`,
              ownerId: ship.id,
              colorHex: isPierce ? '#FF3B9A' : ship.colorHex,
              x: noseX,
              y: noseY,
              vx: Math.cos(fireAng) * bSpeed + ship.vx * 0.18,
              vy: Math.sin(fireAng) * bSpeed + ship.vy * 0.18,
              ttl: 1.45,
              pierce: isPierce,
            });
          }
          sounds.push({ type: 'shoot', playerId: ship.id });
          haptics.push({ playerId: ship.id, pattern: 28, reason: 'shoot' });
        }

        // Action B: Afterburner Boost
        if (b && !src.prevB && ship.boostCd <= 0) {
          ship.boostCd = BOOST_CD;
          ship.boostTimer = BOOST_DURATION;
          ship.vx = Math.cos(ship.angle) * 560;
          ship.vy = Math.sin(ship.angle) * 560;
          sounds.push({ type: 'boost', playerId: ship.id });
          haptics.push({ playerId: ship.id, pattern: 42, reason: 'boost' });
        }
      }

      // Gravity vortex gentle pull & slingshot
      if (state.vortex.active) {
        const vx = state.vortex.x - ship.x;
        const vy = state.vortex.y - ship.y;
        const vd = Math.hypot(vx, vy);
        if (vd > 12 && vd < state.vortex.r * 1.9) {
          const pull = (1 - vd / (state.vortex.r * 1.9)) * 220;
          ship.vx += (vx / vd) * pull * dt;
          ship.vy += (vy / vd) * pull * dt;
        }
      }

      const drag = ship.boostTimer > 0 ? Math.pow(0.4, dt) : Math.pow(0.14, dt);
      ship.vx *= drag;
      ship.vy *= drag;
      const maxSpd = ship.boostTimer > 0 ? 590 : 340;
      const spd = Math.hypot(ship.vx, ship.vy);
      if (spd > maxSpd) {
        ship.vx = (ship.vx / spd) * maxSpd;
        ship.vy = (ship.vy / spd) * maxSpd;
      }

      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;

      const margin = SHIP_RADIUS + 10;
      if (ship.x < margin) {
        ship.x = margin;
        ship.vx = Math.abs(ship.vx) * 0.6;
      } else if (ship.x > ARENA_WIDTH - margin) {
        ship.x = ARENA_WIDTH - margin;
        ship.vx = -Math.abs(ship.vx) * 0.6;
      }
      if (ship.y < margin) {
        ship.y = margin;
        ship.vy = Math.abs(ship.vy) * 0.6;
      } else if (ship.y > ARENA_HEIGHT - margin) {
        ship.y = ARENA_HEIGHT - margin;
        ship.vy = -Math.abs(ship.vy) * 0.6;
      }

      for (const ast of state.asteroids) {
        const dx = ship.x - ast.x;
        const dy = ship.y - ast.y;
        const dist = Math.hypot(dx, dy);
        const minDist = SHIP_RADIUS + ast.r;
        if (dist > 0.001 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          ship.x = ast.x + nx * minDist;
          ship.y = ast.y + ny * minDist;
          const dot = ship.vx * nx + ship.vy * ny;
          if (dot < 0) {
            ship.vx -= 1.6 * dot * nx;
            ship.vy -= 1.6 * dot * ny;
          }
        }
      }

      // Pickup collection
      for (let i = state.pickups.length - 1; i >= 0; i--) {
        const pk = state.pickups[i];
        if (Math.hypot(ship.x - pk.x, ship.y - pk.y) < SHIP_RADIUS + 18) {
          if (pk.kind === 'shield') {
            ship.shieldTimer = Math.max(ship.shieldTimer, 5.5);
            state.popups.push({ x: ship.x, y: ship.y - 30, text: 'SHIELD!', colorHex: '#00C2FF', alpha: 1 });
          } else if (pk.kind === 'rapid') {
            ship.rapidTimer = 7.0;
            state.popups.push({ x: ship.x, y: ship.y - 30, text: 'RAPID FIRE!', colorHex: '#FFB800', alpha: 1 });
          } else if (pk.kind === 'triple') {
            ship.tripleTimer = 7.5;
            state.popups.push({ x: ship.x, y: ship.y - 30, text: 'TRIPLE LASER!', colorHex: '#9EE622', alpha: 1 });
          } else if (pk.kind === 'pierce') {
            ship.pierceTimer = 7.0;
            state.popups.push({ x: ship.x, y: ship.y - 30, text: 'HYPER BEAM!', colorHex: '#FF3B9A', alpha: 1 });
          } else if (pk.kind === 'heal') {
            ship.hp = Math.min(ship.maxHp, ship.hp + 1);
            state.popups.push({ x: ship.x, y: ship.y - 30, text: '+1 HP!', colorHex: '#10D98B', alpha: 1 });
          }
          ship.score += 25;
          state.pickups.splice(i, 1);
          sounds.push({ type: 'pickup', playerId: ship.id });
          haptics.push({ playerId: ship.id, pattern: [15, 15, 25], reason: 'pickup' });
        }
      }
    }

    // Update bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;

      if (
        b.ttl <= 0 ||
        b.x < 0 ||
        b.x > ARENA_WIDTH ||
        b.y < 0 ||
        b.y > ARENA_HEIGHT
      ) {
        state.bullets.splice(i, 1);
        continue;
      }

      // Asteroid block
      let blocked = false;
      for (const ast of state.asteroids) {
        if (Math.hypot(b.x - ast.x, b.y - ast.y) < ast.r + 4) {
          state.explosions.push({
            x: b.x,
            y: b.y,
            radius: 4,
            maxRadius: 20,
            colorHex: '#94A3B8',
            alpha: 0.9,
          });
          blocked = true;
          break;
        }
      }
      if (blocked) {
        state.bullets.splice(i, 1);
        continue;
      }

      // Crystal meteor hits
      let hitCrystal = false;
      for (let cIdx = state.crystals.length - 1; cIdx >= 0; cIdx--) {
        const cr = state.crystals[cIdx];
        if (Math.hypot(b.x - cr.x, b.y - cr.y) < cr.r + 6) {
          hitCrystal = true;
          cr.hp -= b.pierce ? 2 : 1;
          state.explosions.push({
            x: b.x,
            y: b.y,
            radius: 5,
            maxRadius: 24,
            colorHex: '#FFB800',
            alpha: 0.9,
          });
          if (cr.hp <= 0) {
            state.crystals.splice(cIdx, 1);
            const shooter = state.players.find((p) => p.id === b.ownerId);
            if (shooter) {
              shooter.score += 55;
            }
            state.popups.push({ x: cr.x, y: cr.y - 18, text: '+55 CRYSTAL!', colorHex: '#FFB800', alpha: 1 });
            state.pickupSeq += 1;
            const dropKinds: AstroPickupState['kind'][] = ['triple', 'pierce', 'rapid', 'shield'];
            state.pickups.push({
              id: `pk_${state.pickupSeq}`,
              kind: dropKinds[state.pickupSeq % dropKinds.length],
              x: cr.x,
              y: cr.y,
            });
            sounds.push({ type: 'pickup' });
          } else {
            sounds.push({ type: 'hit' });
          }
          break;
        }
      }
      if (hitCrystal) {
        state.bullets.splice(i, 1);
        continue;
      }

      // Ship hit detection
      for (const ship of state.players) {
        if (!ship.alive || ship.id === b.ownerId) continue;
        if (Math.hypot(b.x - ship.x, b.y - ship.y) < SHIP_RADIUS + 6) {
          state.bullets.splice(i, 1);
          if ((ship.shieldTimer > 0 && !b.pierce) || ship.boostTimer > 0) {
            state.explosions.push({
              x: b.x,
              y: b.y,
              radius: 6,
              maxRadius: 26,
              colorHex: '#00C2FF',
              alpha: 0.9,
            });
            sounds.push({ type: 'bump', intensity: 0.4 });
          } else {
            const dmg = b.pierce ? 2 : 1;
            ship.hp -= dmg;
            const shooter = state.players.find((p) => p.id === b.ownerId);
            if (shooter) shooter.score += 20;

            state.explosions.push({
              x: ship.x,
              y: ship.y,
              radius: 8,
              maxRadius: ship.hp <= 0 ? 58 : 30,
              colorHex: ship.colorHex,
              alpha: 1,
            });

            if (ship.hp <= 0) {
              ship.alive = false;
              ship.respawnTimer = 1.9;
              if (shooter) {
                shooter.kills += 1;
                shooter.score += 100;
                state.popups.push({ x: ship.x, y: ship.y - 24, text: '+100 ELIM!', colorHex: shooter.colorHex, alpha: 1 });
                haptics.push({ playerId: shooter.id, pattern: [35, 25, 55], reason: 'kill' });
              }
              sounds.push({ type: 'ko', playerId: ship.id });
              haptics.push({ playerId: ship.id, pattern: [75, 40, 95], reason: 'eliminated' });
            } else {
              sounds.push({ type: 'hit', playerId: ship.id });
              haptics.push({ playerId: ship.id, pattern: 50, reason: 'hit' });
            }
          }
          break;
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: p.score,
        alive: p.alive,
        statText: p.alive ? `HP ${p.hp}/${p.maxHp} · ${p.kills} Elim` : 'Respawning...',
        cooldownA: Math.min(1, Math.max(0, p.fireCd / (p.rapidTimer > 0 ? FIRE_CD_RAPID : FIRE_CD_NORMAL))),
        cooldownB: Math.min(1, Math.max(0, p.boostCd / BOOST_CD)),
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

  getSnapshot(state: AstroInternalState): AstroBlasterSnapshot {
    return toSnapshot(state);
  },

  getRankings(state: AstroInternalState, players: ServerPlayerInputState[]): RankingEntry[] {
    return buildRankings(state, players);
  },
};
