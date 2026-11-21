import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type GravityFlipSnapshot,
  type GravityPlayerState,
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

interface InternalGravityPlayer extends GravityPlayerState {
  vy: number;
  grounded: boolean;
  flipCd: number;
  phaseCd: number;
  respawnTimer: number;
}

interface InternalObstacle {
  id: string;
  kind: 'saw' | 'barrier' | 'gap';
  x: number;
  y: number;
  w: number;
  h: number;
  side: 'floor' | 'ceiling' | 'mid';
}

interface GravityFlipState {
  timeLeft: number;
  totalTime: number;
  elapsed: number;
  speed: number;
  scrollX: number;
  floorY: number;
  ceilingY: number;
  spawnTimer: number;
  coinTimer: number;
  nextId: number;
  obstacles: InternalObstacle[];
  coins: { id: string; x: number; y: number; r: number }[];
  players: Map<string, InternalGravityPlayer>;
}

const CEILING_Y = 128;
const FLOOR_Y = ARENA_HEIGHT - 128;
const PLAYER_R = 18;
const FLIP_CD = 0.22;
const PHASE_CD = 2.8;

function makePlayer(p: ServerPlayerInputState, idx: number): InternalGravityPlayer {
  return {
    id: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    colorHex: p.color.hex,
    x: 240 + (idx % 4) * 58,
    y: FLOOR_Y - PLAYER_R,
    vy: 0,
    gravityDir: 1,
    grounded: true,
    alive: true,
    phaseTimer: 1.2,
    distance: 0,
    coins: 0,
    score: 0,
    cooldownA: 0,
    cooldownB: 0,
    flipCd: 0,
    phaseCd: 0,
    respawnTimer: 0,
  };
}

export const gravityFlipModule: ServerGameModule<GravityFlipState> = {
  id: 'gravity-flip',

  createState(players, settingValue) {
    const totalTime = Math.max(30, Math.min(120, settingValue || 60));
    const state: GravityFlipState = {
      timeLeft: totalTime,
      totalTime,
      elapsed: 0,
      speed: 310,
      scrollX: 0,
      floorY: FLOOR_Y,
      ceilingY: CEILING_Y,
      spawnTimer: 1.1,
      coinTimer: 0.7,
      nextId: 1,
      obstacles: [],
      coins: [],
      players: new Map(),
    };
    players.forEach((p, idx) => state.players.set(p.id, makePlayer(p, idx)));
    return state;
  },

  addPlayer(state, player) {
    if (!state.players.has(player.id)) {
      state.players.set(player.id, makePlayer(player, state.players.size));
    }
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};

    state.elapsed += dt;
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    // Smooth intermediate acceleration curve
    state.speed = Math.min(540, 310 + state.elapsed * 3.6);
    state.scrollX += state.speed * dt;

    // Spawn fair, readable obstacles (never impossible walls)
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.44) {
        const onFloor = Math.random() < 0.5;
        state.obstacles.push({
          id: `ob_${state.nextId++}`,
          kind: 'saw',
          x: ARENA_WIDTH + 60,
          y: onFloor ? FLOOR_Y - 34 : CEILING_Y + 34,
          w: 62,
          h: 62,
          side: onFloor ? 'floor' : 'ceiling',
        });
      } else if (roll < 0.82) {
        const onFloor = Math.random() < 0.5;
        const bh = 155 + Math.random() * 55;
        state.obstacles.push({
          id: `ob_${state.nextId++}`,
          kind: 'barrier',
          x: ARENA_WIDTH + 60,
          y: onFloor ? FLOOR_Y - bh : CEILING_Y,
          w: 36,
          h: bh,
          side: onFloor ? 'floor' : 'ceiling',
        });
      } else {
        // Mid-air laser block leaving both floor & ceiling safe
        state.obstacles.push({
          id: `ob_${state.nextId++}`,
          kind: 'barrier',
          x: ARENA_WIDTH + 60,
          y: (CEILING_Y + FLOOR_Y) / 2 - 58,
          w: 44,
          h: 116,
          side: 'mid',
        });
      }
      state.spawnTimer = Math.max(0.78, 1.38 - state.elapsed * 0.008);
    }

    // Spawn coin trails
    state.coinTimer -= dt;
    if (state.coinTimer <= 0) {
      const lane = Math.floor(Math.random() * 3);
      const y = lane === 0 ? FLOOR_Y - 46 : lane === 1 ? CEILING_Y + 46 : (FLOOR_Y + CEILING_Y) / 2;
      for (let i = 0; i < 3; i++) {
        state.coins.push({
          id: `c_${state.nextId++}`,
          x: ARENA_WIDTH + 60 + i * 48,
          y,
          r: 13,
        });
      }
      state.coinTimer = 1.6;
    }

    // Scroll obstacles & coins
    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      state.obstacles[i].x -= state.speed * dt;
      if (state.obstacles[i].x + state.obstacles[i].w < -80) state.obstacles.splice(i, 1);
    }
    for (let i = state.coins.length - 1; i >= 0; i--) {
      state.coins[i].x -= state.speed * dt;
      if (state.coins[i].x < -40) state.coins.splice(i, 1);
    }

    // Update players
    for (const p of players) {
      const e = state.players.get(p.id);
      if (!e) continue;

      if (!e.alive) {
        e.respawnTimer -= dt;
        if (e.respawnTimer <= 0) {
          e.alive = true;
          e.x = 260;
          e.y = FLOOR_Y - PLAYER_R;
          e.vy = 0;
          e.gravityDir = 1;
          e.grounded = true;
          e.phaseTimer = 1.8;
        }
        continue;
      }

      e.flipCd = Math.max(0, e.flipCd - dt);
      e.phaseCd = Math.max(0, e.phaseCd - dt);
      e.phaseTimer = Math.max(0, e.phaseTimer - dt);

      // Button A (or strong joystick up/down flick): Flip Gravity!
      const pressFlip = (p.input.a && !p.prevA) || (Math.abs(p.input.dy) > 0.78 && Math.sign(p.input.dy) !== e.gravityDir && e.grounded);
      if (pressFlip && e.flipCd <= 0) {
        e.gravityDir = e.gravityDir === 1 ? -1 : 1;
        e.grounded = false;
        e.vy = e.gravityDir * 520;
        e.flipCd = FLIP_CD;
        sounds.push({ type: 'boost', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: 18, reason: 'gravity-flip' });
      }

      // Button B: Ghost Phase Surge
      if (p.input.b && !p.prevB && e.phaseCd <= 0) {
        e.phaseCd = PHASE_CD;
        e.phaseTimer = 0.72;
        e.x = Math.min(ARENA_WIDTH - 240, e.x + 80);
        sounds.push({ type: 'pulse', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: [20, 20, 32], reason: 'phase' });
      }

      // Horizontal drift control
      e.x += p.input.dx * 320 * dt;
      e.x = Math.max(60, Math.min(ARENA_WIDTH - 220, e.x));

      // Gravity physics
      e.vy += e.gravityDir * 2400 * dt;
      e.vy = Math.max(-980, Math.min(980, e.vy));
      e.y += e.vy * dt;

      if (e.y >= FLOOR_Y - PLAYER_R) {
        e.y = FLOOR_Y - PLAYER_R;
        e.vy = 0;
        e.grounded = true;
      } else if (e.y <= CEILING_Y + PLAYER_R) {
        e.y = CEILING_Y + PLAYER_R;
        e.vy = 0;
        e.grounded = true;
      }

      // Distance & score accumulation
      e.distance += (state.speed * dt) / 25;
      e.score += dt * 10;

      // Coin pickups
      for (let i = state.coins.length - 1; i >= 0; i--) {
        const c = state.coins[i];
        if (Math.hypot(e.x - c.x, e.y - c.y) < PLAYER_R + c.r + 6) {
          e.coins += 1;
          e.score += 25;
          state.coins.splice(i, 1);
          sounds.push({ type: 'pickup', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 15, reason: 'coin' });
        }
      }

      // Obstacle collisions (skipped while phasing)
      if (e.phaseTimer <= 0) {
        let hit = false;
        for (const ob of state.obstacles) {
          if (ob.kind === 'saw') {
            if (Math.hypot(e.x - ob.x, e.y - ob.y) < PLAYER_R + ob.w * 0.42) {
              hit = true;
              break;
            }
          } else {
            if (
              e.x + PLAYER_R * 0.78 > ob.x &&
              e.x - PLAYER_R * 0.78 < ob.x + ob.w &&
              e.y + PLAYER_R * 0.78 > ob.y &&
              e.y - PLAYER_R * 0.78 < ob.y + ob.h
            ) {
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          e.alive = false;
          e.respawnTimer = 1.65;
          e.score = Math.max(0, e.score - 35);
          sounds.push({ type: 'ko', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: [65, 30, 65], reason: 'crash' });
        }
      }

      e.cooldownA = e.flipCd / FLIP_CD;
      e.cooldownB = e.phaseCd / PHASE_CD;
      hudUpdates[p.id] = {
        score: Math.round(e.score),
        alive: e.alive,
        statText: `${Math.round(e.distance)}m · ${e.coins} Coins`,
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
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

  getSnapshot(state): GravityFlipSnapshot {
    return {
      gameId: 'gravity-flip',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      speed: state.speed,
      scrollX: state.scrollX,
      floorY: state.floorY,
      ceilingY: state.ceilingY,
      obstacles: state.obstacles.map((o) => ({ ...o })),
      coins: state.coins.map((c) => ({ ...c })),
      players: [...state.players.values()].map((e) => ({
        id: e.id,
        slotIndex: e.slotIndex,
        name: e.name,
        colorHex: e.colorHex,
        x: e.x,
        y: e.y,
        gravityDir: e.gravityDir,
        alive: e.alive,
        phaseTimer: e.phaseTimer,
        distance: Math.round(e.distance),
        coins: e.coins,
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
      highlight: `${Math.round(e?.distance ?? 0)}m · ${e?.coins ?? 0} coins`,
    }));
  },
};
