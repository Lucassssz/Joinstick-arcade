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
}

interface CannonSiegeState {
  timeLeft: number;
  totalTime: number;
  nextId: number;
  blocks: InternalBlock[];
  cores: { side: 'left' | 'right'; x: number; y: number; r: number; hp: number; maxHp: number; colorHex: string }[];
  shells: InternalShell[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
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
      blocks: [...buildWallBlocks('left', 1), ...buildWallBlocks('right', 40)],
      cores: [
        { side: 'left', x: 96, y: ARENA_HEIGHT / 2, r: 42, hp: MAX_CORE_HP, maxHp: MAX_CORE_HP, colorHex: cannons[0]?.colorHex ?? '#FF4D2E' },
        { side: 'right', x: ARENA_WIDTH - 96, y: ARENA_HEIGHT / 2, r: 42, hp: MAX_CORE_HP, maxHp: MAX_CORE_HP, colorHex: cannons[1]?.colorHex ?? '#00C2FF' },
      ],
      shells: [],
      explosions: [],
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

    for (const c of state.cannons) {
      c.fireCd = Math.max(0, c.fireCd - dt);
      c.shieldCd = Math.max(0, c.shieldCd - dt);
      c.shieldTimer = Math.max(0, c.shieldTimer - dt);

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
        state.shells.push({
          id: `sh_${state.nextId++}`,
          ownerId: c.id,
          side: c.side,
          colorHex: c.colorHex,
          x: c.x + Math.cos(c.aimAngle) * 32,
          y: c.y + Math.sin(c.aimAngle) * 32,
          vx: Math.cos(c.aimAngle) * spd,
          vy: Math.sin(c.aimAngle) * spd,
          r: 10,
          ttl: 3.5,
        });
        sounds.push({ type: 'shoot', playerId: c.id });
        if (!c.isBot) haptics.push({ playerId: c.id, pattern: 20, reason: 'cannon-fire' });
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
          b.hp -= 1;
          const shooter = state.cannons.find((cn) => cn.id === s.ownerId);
          if (shooter) shooter.score += 15;
          if (b.hp <= 0) state.blocks.splice(bi, 1);
          state.explosions.push({ x: s.x, y: s.y, radius: 14, colorHex: s.colorHex, alpha: 0.9 });
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
          core.hp = Math.max(0, core.hp - 1);
          const shooter = state.cannons.find((cn) => cn.id === s.ownerId);
          const defender = state.cannons.find((cn) => cn.side === core.side);
          if (shooter) shooter.score += 65;
          if (defender) defender.coreHp = core.hp;
          state.explosions.push({ x: core.x, y: core.y, radius: 28, colorHex: s.colorHex, alpha: 1 });
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
      shells: state.shells.map((s) => ({
        id: s.id,
        ownerId: s.ownerId,
        colorHex: s.colorHex,
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        r: s.r,
      })),
      explosions: state.explosions.map((e) => ({ ...e })),
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
