import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type LaserGauntletPlayerState,
  type LaserGauntletSnapshot,
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

interface InternalLaserPlayer extends LaserGauntletPlayerState {
  vx: number;
  vy: number;
  blinkCd: number;
  empCd: number;
  respawnTimer: number;
  magnetTimer: number;
  shieldCharges: number;
}

interface InternalBeam {
  angle: number;
  angVel: number;
  width: number;
  state: 'warn' | 'active';
  timer: number;
  duration: number;
}

interface InternalRing {
  radius: number;
  maxRadius: number;
  speed: number;
  thickness: number;
}

interface InternalOrb {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ttl: number;
}

interface InternalShard {
  id: string;
  x: number;
  y: number;
  value: number;
  pulse: number;
}

interface LaserGauntletState {
  timeLeft: number;
  totalTime: number;
  elapsed: number;
  wave: number;
  slowMoTimer: number;
  coreAngle: number;
  beamSpawnTimer: number;
  ringSpawnTimer: number;
  orbSpawnTimer: number;
  powerupSpawnTimer: number;
  nextId: number;
  beams: InternalBeam[];
  rings: InternalRing[];
  orbs: InternalOrb[];
  shards: InternalShard[];
  powerups: { id: string; kind: 'magnet' | 'shield' | 'star'; x: number; y: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: Map<string, InternalLaserPlayer>;
}

const CX = ARENA_WIDTH / 2;
const CY = ARENA_HEIGHT / 2;
const CORE_RADIUS = 54;
const PLAYER_RADIUS = 17;
const BLINK_CD = 1.65;
const EMP_CD = 5.5;

function spawnShard(state: LaserGauntletState): InternalShard {
  const angle = Math.random() * Math.PI * 2;
  const dist = 140 + Math.random() * 210;
  const x = Math.max(70, Math.min(ARENA_WIDTH - 70, CX + Math.cos(angle) * dist * 1.35));
  const y = Math.max(70, Math.min(ARENA_HEIGHT - 70, CY + Math.sin(angle) * dist * 0.92));
  const big = Math.random() < 0.25;
  return {
    id: `sh_${state.nextId++}`,
    x,
    y,
    value: big ? 25 : 10,
    pulse: Math.random() * Math.PI * 2,
  };
}

function makePlayer(p: ServerPlayerInputState, idx: number, total: number): InternalLaserPlayer {
  const angle = (idx / Math.max(1, total)) * Math.PI * 2 + Math.PI * 0.5;
  return {
    id: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    colorHex: p.color.hex,
    x: CX + Math.cos(angle) * 240,
    y: CY + Math.sin(angle) * 185,
    vx: 0,
    vy: 0,
    angle: angle + Math.PI,
    hp: 4,
    maxHp: 4,
    alive: true,
    blinkTimer: 0,
    invulnTimer: 1.4,
    magnetTimer: 0,
    shieldCharges: 0,
    combo: 1,
    score: 0,
    cooldownA: 0,
    cooldownB: 0,
    blinkCd: 0,
    empCd: 0,
    respawnTimer: 0,
  };
}

function distToRay(px: number, py: number, ox: number, oy: number, angle: number): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const rx = px - ox;
  const ry = py - oy;
  const proj = rx * dx + ry * dy;
  if (proj < CORE_RADIUS * 0.7) return 9999;
  const perp = Math.abs(rx * -dy + ry * dx);
  return perp;
}

export const laserGauntletModule: ServerGameModule<LaserGauntletState> = {
  id: 'laser-gauntlet',

  createState(players, settingValue) {
    const totalTime = Math.max(45, Math.min(120, settingValue || 75));
    const state: LaserGauntletState = {
      timeLeft: totalTime,
      totalTime,
      elapsed: 0,
      wave: 1,
      slowMoTimer: 0,
      coreAngle: 0,
      beamSpawnTimer: 1.2,
      ringSpawnTimer: 3.4,
      orbSpawnTimer: 4.5,
      powerupSpawnTimer: 6.0,
      nextId: 1,
      beams: [],
      rings: [],
      orbs: [],
      shards: [],
      powerups: [],
      popups: [],
      players: new Map(),
    };

    players.forEach((p, idx) => {
      state.players.set(p.id, makePlayer(p, idx, players.length));
    });
    for (let i = 0; i < 6; i++) {
      state.shards.push(spawnShard(state));
    }
    return state;
  },

  addPlayer(state, player) {
    if (!state.players.has(player.id)) {
      state.players.set(player.id, makePlayer(player, state.players.size, state.players.size + 1));
    }
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};

    state.elapsed += dt;
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.wave = 1 + Math.floor(state.elapsed / 16);
    if (state.slowMoTimer > 0) state.slowMoTimer = Math.max(0, state.slowMoTimer - dt);

    const hazardDt = state.slowMoTimer > 0 ? dt * 0.42 : dt;
    state.coreAngle += hazardDt * (0.65 + state.wave * 0.14);

    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pp = state.popups[i];
      pp.y -= 32 * dt;
      pp.alpha -= 0.9 * dt;
      if (pp.alpha <= 0) state.popups.splice(i, 1);
    }

    state.powerupSpawnTimer -= dt;
    if (state.powerupSpawnTimer <= 0 && state.powerups.length < 2) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 160 + Math.random() * 190;
      const kinds: ('magnet' | 'shield' | 'star')[] = ['magnet', 'shield', 'star'];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      state.powerups.push({
        id: `lgp_${state.nextId++}`,
        kind,
        x: Math.max(80, Math.min(ARENA_WIDTH - 80, CX + Math.cos(angle) * dist * 1.3)),
        y: Math.max(80, Math.min(ARENA_HEIGHT - 80, CY + Math.sin(angle) * dist * 0.85)),
      });
      state.powerupSpawnTimer = 7.5;
    }

    // Move & act players
    for (const p of players) {
      const entity = state.players.get(p.id);
      if (!entity) continue;

      if (!entity.alive) {
        entity.respawnTimer -= dt;
        if (entity.respawnTimer <= 0) {
          entity.alive = true;
          entity.hp = entity.maxHp;
          entity.invulnTimer = 2.0;
          entity.combo = 1;
          const a = Math.random() * Math.PI * 2;
          entity.x = CX + Math.cos(a) * 260;
          entity.y = CY + Math.sin(a) * 195;
          entity.vx = 0;
          entity.vy = 0;
        }
        continue;
      }

      entity.blinkCd = Math.max(0, entity.blinkCd - dt);
      entity.empCd = Math.max(0, entity.empCd - dt);
      entity.blinkTimer = Math.max(0, entity.blinkTimer - dt);
      entity.invulnTimer = Math.max(0, entity.invulnTimer - dt);
      entity.magnetTimer = Math.max(0, entity.magnetTimer - dt);

      const mag = Math.hypot(p.input.dx, p.input.dy);
      const nx = mag > 0.12 ? p.input.dx / mag : 0;
      const ny = mag > 0.12 ? p.input.dy / mag : 0;
      if (mag > 0.12) entity.angle = Math.atan2(ny, nx);

      // Button A: Phase Blink (invulnerable burst dash)
      if (p.input.a && !p.prevA && entity.blinkCd <= 0) {
        const bx = mag > 0.12 ? nx : Math.cos(entity.angle);
        const by = mag > 0.12 ? ny : Math.sin(entity.angle);
        entity.vx = bx * 760;
        entity.vy = by * 760;
        entity.blinkTimer = 0.24;
        entity.invulnTimer = Math.max(entity.invulnTimer, 0.34);
        entity.blinkCd = BLINK_CD;
        sounds.push({ type: 'boost', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: [18, 22, 24], reason: 'blink' });
      }

      // Button B: Slow-Mo EMP (slows boss + clears nearby orbs)
      if (p.input.b && !p.prevB && entity.empCd <= 0) {
        entity.empCd = EMP_CD;
        state.slowMoTimer = 3.2;
        const before = state.orbs.length;
        state.orbs = state.orbs.filter((o) => Math.hypot(o.x - entity.x, o.y - entity.y) > 280);
        const cleared = before - state.orbs.length;
        entity.score += cleared * 15;
        sounds.push({ type: 'pulse', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: [35, 25, 45], reason: 'emp' });
      }

      const maxSpeed = entity.blinkTimer > 0 ? 740 : 350;
      const accel = entity.blinkTimer > 0 ? 3.5 : 14;
      const targetVx = entity.blinkTimer > 0 ? entity.vx : nx * maxSpeed;
      const targetVy = entity.blinkTimer > 0 ? entity.vy : ny * maxSpeed;
      entity.vx += (targetVx - entity.vx) * Math.min(1, accel * dt);
      entity.vy += (targetVy - entity.vy) * Math.min(1, accel * dt);

      entity.x += entity.vx * dt;
      entity.y += entity.vy * dt;

      // Keep inside arena bounds
      entity.x = Math.max(36, Math.min(ARENA_WIDTH - 36, entity.x));
      entity.y = Math.max(36, Math.min(ARENA_HEIGHT - 36, entity.y));

      // Keep outside central core
      const cdx = entity.x - CX;
      const cdy = entity.y - CY;
      const cdist = Math.hypot(cdx, cdy) || 1;
      const minCoreDist = CORE_RADIUS + PLAYER_RADIUS + 8;
      if (cdist < minCoreDist) {
        entity.x = CX + (cdx / cdist) * minCoreDist;
        entity.y = CY + (cdy / cdist) * minCoreDist;
      }

      // Passive survival trickle
      entity.score += dt * 4;

      // Magnet pulls shards toward player
      if (entity.magnetTimer > 0) {
        for (const sh of state.shards) {
          const sx = entity.x - sh.x;
          const sy = entity.y - sh.y;
          const sd = Math.hypot(sx, sy);
          if (sd > 4 && sd < 260) {
            sh.x += (sx / sd) * 320 * dt;
            sh.y += (sy / sd) * 320 * dt;
          }
        }
      }

      // Collect shards
      for (let i = state.shards.length - 1; i >= 0; i--) {
        const sh = state.shards[i];
        if (Math.hypot(entity.x - sh.x, entity.y - sh.y) < PLAYER_RADIUS + 20) {
          const pts = sh.value * Math.min(5, entity.combo);
          entity.score += pts;
          entity.combo = Math.min(5, entity.combo + 1);
          state.shards.splice(i, 1);
          state.shards.push(spawnShard(state));
          sounds.push({ type: 'pickup', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 18, reason: 'shard' });
        }
      }

      // Collect powerups
      for (let i = state.powerups.length - 1; i >= 0; i--) {
        const pk = state.powerups[i];
        if (Math.hypot(entity.x - pk.x, entity.y - pk.y) < PLAYER_RADIUS + 20) {
          if (pk.kind === 'magnet') {
            entity.magnetTimer = 7.5;
            state.popups.push({ x: pk.x, y: pk.y - 12, text: 'SHARD MAGNET!', colorHex: '#00C2FF', alpha: 1 });
          } else if (pk.kind === 'shield') {
            entity.shieldCharges = Math.min(2, entity.shieldCharges + 1);
            state.popups.push({ x: pk.x, y: pk.y - 12, text: 'ENERGY SHIELD!', colorHex: '#10D98B', alpha: 1 });
          } else {
            entity.score += 80;
            entity.combo = Math.min(5, entity.combo + 1);
            state.popups.push({ x: pk.x, y: pk.y - 12, text: '+80 STAR!', colorHex: '#FFB800', alpha: 1 });
          }
          state.powerups.splice(i, 1);
          sounds.push({ type: 'pickup', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 26, reason: 'powerup' });
        }
      }

      entity.cooldownA = entity.blinkCd / BLINK_CD;
      entity.cooldownB = entity.empCd / EMP_CD;
    }

    // Spawn sweeping laser beams (generous 0.85s warning before firing!)
    state.beamSpawnTimer -= hazardDt;
    if (state.beamSpawnTimer <= 0) {
      const count = state.wave >= 4 ? 3 : state.wave >= 2 ? 2 : 1;
      const baseAngle = Math.random() * Math.PI * 2;
      const dir = Math.random() < 0.5 ? 1 : -1;
      const sweepSpeed = dir * (0.42 + Math.min(0.45, state.wave * 0.08));
      for (let i = 0; i < count; i++) {
        state.beams.push({
          angle: baseAngle + (i * Math.PI * 2) / count,
          angVel: sweepSpeed,
          width: 20,
          state: 'warn',
          timer: 0,
          duration: 0.85,
        });
      }
      state.beamSpawnTimer = Math.max(2.1, 3.6 - state.wave * 0.25);
    }

    // Spawn expanding shockwave rings
    state.ringSpawnTimer -= hazardDt;
    if (state.ringSpawnTimer <= 0) {
      state.rings.push({
        radius: CORE_RADIUS + 10,
        maxRadius: 680,
        speed: 190 + state.wave * 18,
        thickness: 14,
      });
      state.ringSpawnTimer = Math.max(2.8, 4.6 - state.wave * 0.25);
    }

    // Spawn gentle homing orbs
    state.orbSpawnTimer -= hazardDt;
    if (state.orbSpawnTimer <= 0 && state.orbs.length < 3 + state.wave) {
      const a = Math.random() * Math.PI * 2;
      state.orbs.push({
        id: `orb_${state.nextId++}`,
        x: CX + Math.cos(a) * (CORE_RADIUS + 16),
        y: CY + Math.sin(a) * (CORE_RADIUS + 16),
        vx: Math.cos(a) * 140,
        vy: Math.sin(a) * 140,
        r: 13,
        ttl: 7.5,
      });
      state.orbSpawnTimer = Math.max(1.9, 3.5 - state.wave * 0.2);
    }

    // Update beams
    for (let i = state.beams.length - 1; i >= 0; i--) {
      const b = state.beams[i];
      b.timer += hazardDt;
      if (b.state === 'warn') {
        if (b.timer >= b.duration) {
          b.state = 'active';
          b.timer = 0;
          b.duration = 2.2;
          sounds.push({ type: 'shoot' });
        }
      } else {
        b.angle += b.angVel * hazardDt;
        if (b.timer >= b.duration) {
          state.beams.splice(i, 1);
        }
      }
    }

    // Update rings
    for (let i = state.rings.length - 1; i >= 0; i--) {
      const r = state.rings[i];
      r.radius += r.speed * hazardDt;
      if (r.radius >= r.maxRadius) state.rings.splice(i, 1);
    }

    // Update orbs (mild steering so they are dodgeable, intermediate feel)
    const aliveList = [...state.players.values()].filter((e) => e.alive);
    for (let i = state.orbs.length - 1; i >= 0; i--) {
      const o = state.orbs[i];
      o.ttl -= hazardDt;
      if (o.ttl <= 0) {
        state.orbs.splice(i, 1);
        continue;
      }
      if (aliveList.length > 0) {
        let nearest = aliveList[0];
        let bestD = Infinity;
        for (const pl of aliveList) {
          const d = Math.hypot(pl.x - o.x, pl.y - o.y);
          if (d < bestD) {
            bestD = d;
            nearest = pl;
          }
        }
        const tx = nearest.x - o.x;
        const ty = nearest.y - o.y;
        const td = Math.hypot(tx, ty) || 1;
        const spd = 155 + state.wave * 10;
        o.vx += ((tx / td) * spd - o.vx) * Math.min(1, 2.2 * hazardDt);
        o.vy += ((ty / td) * spd - o.vy) * Math.min(1, 2.2 * hazardDt);
      }
      o.x += o.vx * hazardDt;
      o.y += o.vy * hazardDt;
    }

    // Pulse shards
    for (const sh of state.shards) sh.pulse += dt * 4;

    // Damage checks (forgiving inner hitbox + 1.3s i-frames + shield charge block)
    const damagePlayer = (entity: InternalLaserPlayer) => {
      if (entity.invulnTimer > 0 || !entity.alive) return;
      if (entity.shieldCharges > 0) {
        entity.shieldCharges -= 1;
        entity.invulnTimer = 1.1;
        state.popups.push({ x: entity.x, y: entity.y - 24, text: 'SHIELD SAVED!', colorHex: '#10D98B', alpha: 1 });
        sounds.push({ type: 'bump', playerId: entity.id });
        haptics.push({ playerId: entity.id, pattern: 24, reason: 'shield' });
        return;
      }
      entity.hp -= 1;
      entity.combo = 1;
      entity.invulnTimer = 1.35;
      sounds.push({ type: 'hit', playerId: entity.id });
      if (entity.hp <= 0) {
        entity.alive = false;
        entity.respawnTimer = 2.6;
        entity.score = Math.max(0, entity.score - 40);
        sounds.push({ type: 'ko', playerId: entity.id });
        haptics.push({ playerId: entity.id, pattern: [90, 40, 90], reason: 'ko' });
      } else {
        haptics.push({ playerId: entity.id, pattern: [45, 30, 45], reason: 'damage' });
      }
    };

    for (const entity of aliveList) {
      if (entity.invulnTimer > 0) continue;
      for (const b of state.beams) {
        if (b.state !== 'active') continue;
        if (distToRay(entity.x, entity.y, CX, CY, b.angle) < b.width * 0.45 + PLAYER_RADIUS * 0.72) {
          damagePlayer(entity);
          break;
        }
      }
      if (entity.invulnTimer > 0) continue;
      const distC = Math.hypot(entity.x - CX, entity.y - CY);
      for (const r of state.rings) {
        if (Math.abs(distC - r.radius) < r.thickness * 0.5 + PLAYER_RADIUS * 0.65) {
          damagePlayer(entity);
          break;
        }
      }
      if (entity.invulnTimer > 0) continue;
      for (let i = state.orbs.length - 1; i >= 0; i--) {
        const o = state.orbs[i];
        if (Math.hypot(entity.x - o.x, entity.y - o.y) < o.r + PLAYER_RADIUS * 0.78) {
          state.orbs.splice(i, 1);
          damagePlayer(entity);
          break;
        }
      }
    }

    for (const p of players) {
      const entity = state.players.get(p.id);
      if (!entity) continue;
      hudUpdates[p.id] = {
        score: Math.round(entity.score),
        alive: entity.alive,
        statText: `HP ${entity.hp}/${entity.maxHp} · ${entity.combo}x`,
        cooldownA: entity.cooldownA,
        cooldownB: entity.cooldownB,
      };
    }

    const finished = state.timeLeft <= 0;
    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished,
      rankings: finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state): LaserGauntletSnapshot {
    return {
      gameId: 'laser-gauntlet',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      wave: state.wave,
      overdrive: state.wave >= 4,
      slowMoTimer: state.slowMoTimer,
      coreAngle: state.coreAngle,
      beams: state.beams.map((b) => ({
        angle: b.angle,
        width: b.width,
        state: b.state,
        progress: Math.min(1, b.timer / b.duration),
      })),
      rings: state.rings.map((r) => ({
        radius: r.radius,
        maxRadius: r.maxRadius,
        thickness: r.thickness,
        alpha: Math.max(0.15, 1 - r.radius / r.maxRadius),
      })),
      orbs: state.orbs.map((o) => ({ id: o.id, x: o.x, y: o.y, r: o.r })),
      shards: state.shards.map((s) => ({ ...s })),
      powerups: state.powerups.map((pk) => ({ ...pk })),
      popups: state.popups.map((pp) => ({ ...pp })),
      players: [...state.players.values()].map((e) => ({
        id: e.id,
        slotIndex: e.slotIndex,
        name: e.name,
        colorHex: e.colorHex,
        x: e.x,
        y: e.y,
        angle: e.angle,
        hp: e.hp,
        maxHp: e.maxHp,
        alive: e.alive,
        blinkTimer: e.blinkTimer,
        invulnTimer: e.invulnTimer,
        magnetTimer: e.magnetTimer,
        shieldCharges: e.shieldCharges,
        combo: e.combo,
        score: Math.round(e.score),
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...players]
      .map((p) => ({ p, e: state.players.get(p.id) }))
      .sort((a, b) => (b.e?.score ?? 0) - (a.e?.score ?? 0));
    return sorted.map(({ p, e }, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      rank: idx + 1,
      score: Math.round(e?.score ?? 0),
      highlight: `Wave ${state.wave} · ${Math.round(e?.score ?? 0)} pts`,
    }));
  },
};
