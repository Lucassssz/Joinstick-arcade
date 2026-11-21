import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type CannonPlayerState,
  type CannonSiegeSnapshot,
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

interface InternalCannon extends CannonPlayerState {
  fireCd: number;
  shieldCd: number;
  tripleTimer: number;
  heavyCharges: number;
}

interface InternalBlock {
  id: number;
  side: 'left' | 'right';
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
}

interface InternalShell {
  id: string;
  ownerId: string;
  side: 'left' | 'right';
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ttl: number;
  heavy?: boolean;
}

interface CannonSiegeState {
  timeLeft: number;
  totalTime: number;
  nextId: number;
  pickupTimer: number;
  targetTimer: number;
  targetDir: number;
  blocks: InternalBlock[];
  cores: { side: 'left' | 'right'; x: number; y: number; r: number; hp: number; maxHp: number; colorHex: string }[];
  pickups: { id: string; kind: 'triple-shot' | 'bunker-buster'; x: number; y: number; r: number }[];
  goldenTarget: { x: number; y: number; r: number } | null;
  shells: InternalShell[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  cannons: InternalCannon[];
}

const FIRE_CD = 0.72;
const SHIELD_CD = 3.2;
const MAX_CORE_HP = 12;

function buildWallBlocks(side: 'left' | 'right', startId: number): InternalBlock[] {
  const blocks: InternalBlock[] = [];
  const baseX = side === 'left' ? 300 : ARENA_WIDTH - 364;
  let id = startId;
  for (let col = 0; col < 2; col++) {
    for (let row = 0; row < 7; row++) {
      blocks.push({
        id: id++,
        side,
        x: baseX + col * 34,
        y: 122 + row * 68,
        w: 28,
        h: 60,
        hp: 2,
        maxHp: 2,
      });
    }
  }
  return blocks;
}

export const cannonSiegeModule: ServerGameModule<CannonSiegeState> = {
  id: 'cannon-siege',

  createState(players, settingValue) {
    const totalTime = Math.max(45, Math.min(120, settingValue || 75));
    const cannons: InternalCannon[] = [];
    const leftCount = Math.ceil(players.length / 2);
    const rightCount = Math.floor(players.length / 2);

    players.forEach((p, idx) => {
      const side: 'left' | 'right' = idx % 2 === 0 ? 'left' : 'right';
      const sideIdx = Math.floor(idx / 2);
      const sideTotal = side === 'left' ? leftCount : rightCount;
      const yFrac = sideTotal <= 1 ? 0.5 : (sideIdx + 1) / (sideTotal + 1);
      cannons.push({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        side,
        isBot: p.isBot,
        x: side === 'left' ? 215 : ARENA_WIDTH - 215,
        y: 120 + yFrac * (ARENA_HEIGHT - 240),
        aimAngle: side === 'left' ? 0 : Math.PI,
        coreHp: MAX_CORE_HP,
        maxCoreHp: MAX_CORE_HP,
        shieldTimer: 0,
        tripleTimer: 0,
        heavyCharges: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        fireCd: 0,
        shieldCd: 0,
      });
    });

    return {
      timeLeft: totalTime,
      totalTime,
      nextId: 100,
      pickupTimer: 4.0,
      targetTimer: 8.0,
      targetDir: 1,
      blocks: [...buildWallBlocks('left', 1), ...buildWallBlocks('right', 40)],
      cores: [
        { side: 'left', x: 96, y: ARENA_HEIGHT / 2, r: 42, hp: MAX_CORE_HP, maxHp: MAX_CORE_HP, colorHex: cannons[0]?.colorHex ?? '#FF4D2E' },
        { side: 'right', x: ARENA_WIDTH - 96, y: ARENA_HEIGHT / 2, r: 42, hp: MAX_CORE_HP, maxHp: MAX_CORE_HP, colorHex: cannons[1]?.colorHex ?? '#00C2FF' },
      ],
      pickups: [],
      goldenTarget: null,
      shells: [],
      explosions: [],
      popups: [],
      cannons,
    };
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const inputById = new Map(players.map((p) => [p.id, p]));

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    for (let i = state.explosions.length - 1; i >= 0; i--) {
      state.explosions[i].radius += 160 * dt;
      state.explosions[i].alpha -= dt * 3.1;
      if (state.explosions[i].alpha <= 0) state.explosions.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= 28 * dt;
      state.popups[i].alpha -= dt * 1.1;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    // Mid-canyon floating supply crates
    state.pickupTimer -= dt;
    if (state.pickupTimer <= 0 && state.pickups.length < 2) {
      const kind: 'triple-shot' | 'bunker-buster' = Math.random() < 0.55 ? 'triple-shot' : 'bunker-buster';
      state.pickups.push({
        id: `cp_${state.nextId++}`,
        kind,
        x: ARENA_WIDTH / 2 + (Math.random() - 0.5) * 80,
        y: 130 + Math.random() * (ARENA_HEIGHT - 260),
        r: 22,
      });
      state.pickupTimer = 7.5;
    }

    // Gliding Golden Target
    if (!state.goldenTarget) {
      state.targetTimer -= dt;
      if (state.targetTimer <= 0) {
        state.goldenTarget = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, r: 24 };
      }
    } else {
      state.goldenTarget.y += state.targetDir * 145 * dt;
      if (state.goldenTarget.y < 110) {
        state.goldenTarget.y = 110;
        state.targetDir = 1;
      } else if (state.goldenTarget.y > ARENA_HEIGHT - 110) {
        state.goldenTarget.y = ARENA_HEIGHT - 110;
        state.targetDir = -1;
      }
    }

    for (const c of state.cannons) {
      c.fireCd = Math.max(0, c.fireCd - dt);
      c.shieldCd = Math.max(0, c.shieldCd - dt);
      c.shieldTimer = Math.max(0, c.shieldTimer - dt);
      c.tripleTimer = Math.max(0, c.tripleTimer - dt);

      let moveY = 0;
      let aimTilt = 0;
      let pressA = false;
      let pressB = false;

      const inp = inputById.get(c.id);
      if (inp) {
        moveY = inp.input.dy;
        aimTilt = inp.input.dy * 0.55;
        pressA = inp.input.a;
        pressB = inp.input.b && !inp.prevB;
      }

      c.y = Math.max(105, Math.min(ARENA_HEIGHT - 105, c.y + moveY * 320 * dt));
      const baseAngle = c.side === 'left' ? 0 : Math.PI;
      const targetAngle = c.side === 'left' ? baseAngle + aimTilt : baseAngle - aimTilt;
      c.aimAngle += (targetAngle - c.aimAngle) * Math.min(1, 10 * dt);

      if (pressA && c.fireCd <= 0) {
        c.fireCd = FIRE_CD;
        const spd = 610;
        const isHeavy = c.heavyCharges > 0;
        if (isHeavy) c.heavyCharges -= 1;
        const offsets = c.tripleTimer > 0 ? [-0.18, 0, 0.18] : [0];
        for (const off of offsets) {
          const ang = c.aimAngle + off;
          state.shells.push({
            id: `sh_${state.nextId++}`,
            ownerId: c.id,
            side: c.side,
            colorHex: isHeavy ? '#FFB800' : c.colorHex,
            x: c.x + Math.cos(ang) * 32,
            y: c.y + Math.sin(ang) * 32,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd,
            r: isHeavy ? 15 : 10,
            ttl: 3.5,
            heavy: isHeavy,
          });
        }
        sounds.push({ type: 'shoot', playerId: c.id });
        if (!c.isBot) haptics.push({ playerId: c.id, pattern: isHeavy ? [22, 16, 26] : 20, reason: 'cannon-fire' });
      }

      if (pressB && c.shieldCd <= 0) {
        c.shieldCd = SHIELD_CD;
        c.shieldTimer = 1.15;
        sounds.push({ type: 'pulse', playerId: c.id });
        if (!c.isBot) haptics.push({ playerId: c.id, pattern: [22, 20, 28], reason: 'shield' });
      }

      c.cooldownA = c.fireCd / FIRE_CD;
      c.cooldownB = c.shieldCd / SHIELD_CD;
    }

    // Step shells
    for (let i = state.shells.length - 1; i >= 0; i--) {
      const s = state.shells[i];
      s.ttl -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      // Top/bottom canyon bounce for cool trick shots
      if (s.y < 42) {
        s.y = 42;
        s.vy = Math.abs(s.vy);
      } else if (s.y > ARENA_HEIGHT - 42) {
        s.y = ARENA_HEIGHT - 42;
        s.vy = -Math.abs(s.vy);
      }

      if (s.ttl <= 0 || s.x < 10 || s.x > ARENA_WIDTH - 10) {
        state.shells.splice(i, 1);
        continue;
      }

      // Check shooting mid-canyon supply crates
      let hitSupply = false;
      for (let pi = state.pickups.length - 1; pi >= 0; pi--) {
        const pk = state.pickups[pi];
        if (Math.hypot(s.x - pk.x, s.y - pk.y) < pk.r + s.r) {
          const shooter = state.cannons.find((cn) => cn.id === s.ownerId);
          if (shooter) {
            if (pk.kind === 'triple-shot') {
              shooter.tripleTimer = 8.0;
              state.popups.push({ x: pk.x, y: pk.y - 20, text: 'TRIPLE SHOT!', colorHex: '#FF3B9A', alpha: 1 });
            } else {
              shooter.heavyCharges += 2;
              state.popups.push({ x: pk.x, y: pk.y - 20, text: 'HEAVY SHELL x2!', colorHex: '#FFB800', alpha: 1 });
            }
            shooter.score += 35;
          }
          state.explosions.push({ x: pk.x, y: pk.y, radius: 18, colorHex: '#FFB800', alpha: 0.9 });
          state.pickups.splice(pi, 1);
          state.shells.splice(i, 1);
          sounds.push({ type: 'pickup', playerId: s.ownerId });
          hitSupply = true;
          break;
        }
      }
      if (hitSupply) continue;

      // Check shooting Golden Target
      if (state.goldenTarget && Math.hypot(s.x - state.goldenTarget.x, s.y - state.goldenTarget.y) < state.goldenTarget.r + s.r) {
        const shooter = state.cannons.find((cn) => cn.id === s.ownerId);
        if (shooter) {
          shooter.score += 80;
          const ownCore = state.cores.find((co) => co.side === shooter.side);
          if (ownCore && ownCore.hp < ownCore.maxHp) {
            ownCore.hp += 1;
          }
          state.popups.push({ x: state.goldenTarget.x, y: state.goldenTarget.y - 24, text: '+80 & REPAIR!', colorHex: '#FFB800', alpha: 1 });
        }
        state.explosions.push({ x: state.goldenTarget.x, y: state.goldenTarget.y, radius: 26, colorHex: '#FFB800', alpha: 1 });
        state.goldenTarget = null;
        state.targetTimer = 11.0;
        state.shells.splice(i, 1);
        sounds.push({ type: 'pickup', playerId: s.ownerId });
        continue;
      }

      // Check shield deflection
      let deflected = false;
      for (const c of state.cannons) {
        if (c.side !== s.side && c.shieldTimer > 0 && Math.hypot(s.x - c.x, s.y - c.y) < 62) {
          s.vx = -s.vx * 1.12;
          s.side = c.side;
          s.ownerId = c.id;
          s.colorHex = c.colorHex;
          deflected = true;
          c.score += 25;
          state.popups.push({ x: c.x, y: c.y - 36, text: 'DEFLECT +25', colorHex: '#00C2FF', alpha: 1 });
          sounds.push({ type: 'bump', playerId: c.id, intensity: 0.9 });
          if (!c.isBot) haptics.push({ playerId: c.id, pattern: [24, 20, 40], reason: 'reflect' });
          break;
        }
      }
      if (deflected) continue;

      // Check enemy bunker blocks
      let hitBlock = false;
      for (let bi = state.blocks.length - 1; bi >= 0; bi--) {
        const b = state.blocks[bi];
        if (b.side === s.side) continue;
        if (s.x + s.r > b.x && s.x - s.r < b.x + b.w && s.y + s.r > b.y && s.y - s.r < b.y + b.h) {
          b.hp -= s.heavy ? 3 : 1;
          const shooter = state.cannons.find((cn) => cn.id === s.ownerId);
          if (shooter) shooter.score += s.heavy ? 25 : 15;
          if (b.hp <= 0) state.blocks.splice(bi, 1);
          state.explosions.push({ x: s.x, y: s.y, radius: s.heavy ? 22 : 14, colorHex: s.colorHex, alpha: 0.9 });
          state.shells.splice(i, 1);
          sounds.push({ type: 'hit' });
          hitBlock = true;
          break;
        }
      }
      if (hitBlock) continue;

      // Check enemy core hit
      for (const core of state.cores) {
        if (core.side === s.side) continue;
        if (Math.hypot(s.x - core.x, s.y - core.y) < core.r + s.r) {
          const dmg = s.heavy ? 2 : 1;
          core.hp = Math.max(0, core.hp - dmg);
          const shooter = state.cannons.find((cn) => cn.id === s.ownerId);
          const defender = state.cannons.find((cn) => cn.side === core.side);
          if (shooter) shooter.score += dmg * 65;
          if (defender) defender.coreHp = core.hp;
          state.explosions.push({ x: core.x, y: core.y, radius: s.heavy ? 38 : 28, colorHex: s.colorHex, alpha: 1 });
          state.popups.push({ x: core.x, y: core.y - 45, text: s.heavy ? 'MEGA HIT!' : 'CORE HIT!', colorHex: s.colorHex, alpha: 1 });
          state.shells.splice(i, 1);
          sounds.push({ type: 'ko' });
          if (shooter && !shooter.isBot) haptics.push({ playerId: shooter.id, pattern: [30, 20, 45], reason: 'core-hit' });
          if (defender && !defender.isBot) haptics.push({ playerId: defender.id, pattern: [65, 30, 65], reason: 'core-damaged' });
          break;
        }
      }
    }

    for (const c of state.cannons) {
      const core = state.cores.find((co) => co.side === c.side);
      if (core) c.coreHp = core.hp;
    }

    for (const p of players) {
      const c = state.cannons.find((cn) => cn.id === p.id);
      if (!c) continue;
      hudUpdates[p.id] = {
        score: c.score,
        alive: c.coreHp > 0,
        statText: `Core ${c.coreHp}/${c.maxCoreHp}`,
        cooldownA: c.cooldownA,
        cooldownB: c.cooldownB,
      };
    }

    const coreDestroyed = state.cores.some((co) => co.hp <= 0);
    const finished = coreDestroyed || state.timeLeft <= 0;
    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished,
      rankings: finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state): CannonSiegeSnapshot {
    return {
      gameId: 'cannon-siege',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      blocks: state.blocks.map((b) => ({ ...b })),
      cores: state.cores.map((c) => ({ ...c })),
      pickups: state.pickups.map((p) => ({ ...p })),
      goldenTarget: state.goldenTarget ? { ...state.goldenTarget } : null,
      shells: state.shells.map((s) => ({
        id: s.id,
        ownerId: s.ownerId,
        colorHex: s.colorHex,
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        r: s.r,
        heavy: s.heavy,
      })),
      explosions: state.explosions.map((e) => ({ ...e })),
      popups: state.popups.map((p) => ({ ...p })),
      players: state.cannons.map((c) => ({
        id: c.id,
        slotIndex: c.slotIndex,
        name: c.name,
        colorHex: c.colorHex,
        side: c.side,
        isBot: c.isBot,
        x: c.x,
        y: c.y,
        aimAngle: c.aimAngle,
        coreHp: c.coreHp,
        maxCoreHp: c.maxCoreHp,
        shieldTimer: c.shieldTimer,
        tripleTimer: c.tripleTimer,
        heavyCharges: c.heavyCharges,
        score: c.score,
        cooldownA: c.cooldownA,
        cooldownB: c.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...players]
      .map((p) => ({ p, c: state.cannons.find((cn) => cn.id === p.id) }))
      .sort((a, b) => (b.c?.coreHp ?? 0) - (a.c?.coreHp ?? 0) || (b.c?.score ?? 0) - (a.c?.score ?? 0));
    return sorted.map(({ p, c }, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      rank: idx + 1,
      score: c?.score ?? 0,
      highlight: `Core HP ${c?.coreHp ?? 0}/${MAX_CORE_HP}`,
    }));
  },
};
