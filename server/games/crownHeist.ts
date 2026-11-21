import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type CrownHeistSnapshot,
  type CrownPlayerState,
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

interface InternalCrownPlayer extends CrownPlayerState {
  vx: number;
  vy: number;
  tackleCd: number;
  pushCd: number;
}

interface CrownHeistState {
  timeLeft: number;
  totalTime: number;
  crownX: number;
  crownY: number;
  crownHolderId: string | null;
  obstacles: { x: number; y: number; r: number }[];
  waves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  entities: InternalCrownPlayer[];
}

const CX = ARENA_WIDTH / 2;
const CY = ARENA_HEIGHT / 2;
const PLAYER_R = 19;
const TACKLE_CD = 1.6;
const PUSH_CD = 3.2;

function spawnEntity(
  id: string,
  slotIndex: number,
  name: string,
  colorHex: string,
  idx: number,
  total: number,
  isBot = false
): InternalCrownPlayer {
  const ang = (idx / Math.max(1, total)) * Math.PI * 2;
  return {
    id,
    slotIndex,
    name,
    colorHex,
    isBot,
    x: CX + Math.cos(ang) * 280,
    y: CY + Math.sin(ang) * 210,
    vx: 0,
    vy: 0,
    angle: ang + Math.PI,
    hasCrown: false,
    tackleTimer: 0,
    stunTimer: 0,
    stealGraceTimer: 0,
    score: 0,
    steals: 0,
    cooldownA: 0,
    cooldownB: 0,
    tackleCd: 0,
    pushCd: 0,
  };
}

export const crownHeistModule: ServerGameModule<CrownHeistState> = {
  id: 'crown-heist',

  createState(players, settingValue) {
    const totalTime = Math.max(30, Math.min(120, settingValue || 60));
    const entities: InternalCrownPlayer[] = players.map((p, idx) =>
      spawnEntity(p.id, p.slotIndex, p.name, p.color.hex, idx, players.length, Boolean(p.isBot))
    );

    return {
      timeLeft: totalTime,
      totalTime,
      crownX: CX,
      crownY: CY,
      crownHolderId: null,
      obstacles: [
        { x: 340, y: 210, r: 34 },
        { x: ARENA_WIDTH - 340, y: 210, r: 34 },
        { x: 340, y: ARENA_HEIGHT - 210, r: 34 },
        { x: ARENA_WIDTH - 340, y: ARENA_HEIGHT - 210, r: 34 },
      ],
      waves: [],
      entities,
    };
  },

  addPlayer(state, player) {
    if (!state.entities.some((e) => e.id === player.id)) {
      state.entities.push(
        spawnEntity(player.id, player.slotIndex, player.name, player.color.hex, state.entities.length, state.entities.length + 1, false)
      );
    }
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const inputById = new Map(players.map((p) => [p.id, p]));

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    for (let i = state.waves.length - 1; i >= 0; i--) {
      const w = state.waves[i];
      w.radius += 520 * dt;
      w.alpha = Math.max(0, 1 - w.radius / w.maxRadius);
      if (w.radius >= w.maxRadius) state.waves.splice(i, 1);
    }

    for (const e of state.entities) {
      e.tackleCd = Math.max(0, e.tackleCd - dt);
      e.pushCd = Math.max(0, e.pushCd - dt);
      e.tackleTimer = Math.max(0, e.tackleTimer - dt);
      e.stunTimer = Math.max(0, e.stunTimer - dt);
      e.stealGraceTimer = Math.max(0, e.stealGraceTimer - dt);

      let dx = 0;
      let dy = 0;
      let pressA = false;
      let pressB = false;

      if (e.stunTimer <= 0) {
        const inp = inputById.get(e.id);
        if (inp) {
          dx = inp.input.dx;
          dy = inp.input.dy;
          pressA = inp.input.a && !inp.prevA;
          pressB = inp.input.b && !inp.prevB;
        }
      }

      const mag = Math.hypot(dx, dy);
      const nx = mag > 0.12 ? dx / mag : 0;
      const ny = mag > 0.12 ? dy / mag : 0;
      if (mag > 0.12) e.angle = Math.atan2(ny, nx);

      // Button A: Tackle lunge
      if (pressA && e.tackleCd <= 0) {
        e.tackleCd = TACKLE_CD;
        e.tackleTimer = 0.25;
        const bx = mag > 0.12 ? nx : Math.cos(e.angle);
        const by = mag > 0.12 ? ny : Math.sin(e.angle);
        e.vx = bx * 690;
        e.vy = by * 690;
        if (!e.isBot) {
          sounds.push({ type: 'boost', playerId: e.id });
          haptics.push({ playerId: e.id, pattern: 22, reason: 'tackle' });
        }
      }

      // Button B: Shockwave Push
      if (pressB && e.pushCd <= 0) {
        e.pushCd = PUSH_CD;
        const waveR = 165;
        state.waves.push({ x: e.x, y: e.y, radius: 20, maxRadius: waveR, colorHex: e.colorHex, alpha: 0.9 });
        for (const other of state.entities) {
          if (other.id === e.id) continue;
          const odx = other.x - e.x;
          const ody = other.y - e.y;
          const od = Math.hypot(odx, ody) || 1;
          if (od < waveR) {
            other.vx += (odx / od) * 560;
            other.vy += (ody / od) * 560;
            other.stunTimer = Math.max(other.stunTimer, 0.35);
            if (!other.isBot) haptics.push({ playerId: other.id, pattern: 35, reason: 'pushed' });
          }
        }
        sounds.push({ type: 'pulse', playerId: e.id });
        if (!e.isBot) haptics.push({ playerId: e.id, pattern: [26, 20, 32], reason: 'push' });
      }

      const crownFactor = e.hasCrown ? 0.89 : 1.0;
      const baseSpeed = e.stunTimer > 0 ? 70 : e.tackleTimer > 0 ? 670 : 345 * crownFactor;
      const tvx = e.tackleTimer > 0 ? e.vx : nx * baseSpeed;
      const tvy = e.tackleTimer > 0 ? e.vy : ny * baseSpeed;
      const accel = e.tackleTimer > 0 ? 3.5 : 13;
      e.vx += (tvx - e.vx) * Math.min(1, accel * dt);
      e.vy += (tvy - e.vy) * Math.min(1, accel * dt);

      e.x = Math.max(38, Math.min(ARENA_WIDTH - 38, e.x + e.vx * dt));
      e.y = Math.max(38, Math.min(ARENA_HEIGHT - 38, e.y + e.vy * dt));

      for (const obs of state.obstacles) {
        const odx = e.x - obs.x;
        const ody = e.y - obs.y;
        const od = Math.hypot(odx, ody) || 1;
        if (od < obs.r + PLAYER_R) {
          e.x = obs.x + (odx / od) * (obs.r + PLAYER_R);
          e.y = obs.y + (ody / od) * (obs.r + PLAYER_R);
        }
      }

      // Pick up loose crown
      if (!state.crownHolderId && Math.hypot(e.x - state.crownX, e.y - state.crownY) < PLAYER_R + 24) {
        state.crownHolderId = e.id;
        e.hasCrown = true;
        e.stealGraceTimer = 0.9;
        e.score += 20;
        sounds.push({ type: 'pickup', playerId: e.id });
        if (!e.isBot) haptics.push({ playerId: e.id, pattern: [24, 22, 42], reason: 'crown-grab' });
      }

      e.cooldownA = e.tackleCd / TACKLE_CD;
      e.cooldownB = e.pushCd / PUSH_CD;
    }

    // Check steals & scoring
    const holder = state.entities.find((e) => e.id === state.crownHolderId) ?? null;
    if (holder) {
      holder.score += dt * 18;
      state.crownX = holder.x;
      state.crownY = holder.y;

      if (holder.stealGraceTimer <= 0) {
        for (const rival of state.entities) {
          if (rival.id === holder.id || rival.stunTimer > 0) continue;
          const d = Math.hypot(rival.x - holder.x, rival.y - holder.y);
          const stealRange = rival.tackleTimer > 0 ? PLAYER_R * 2.4 : PLAYER_R * 2.0;
          if (d < stealRange) {
            holder.hasCrown = false;
            holder.stunTimer = 0.65;
            rival.hasCrown = true;
            rival.stealGraceTimer = 1.0;
            rival.steals += 1;
            rival.score += 30;
            state.crownHolderId = rival.id;
            state.crownX = rival.x;
            state.crownY = rival.y;
            sounds.push({ type: 'bump', intensity: 0.9 });
            if (!rival.isBot) haptics.push({ playerId: rival.id, pattern: [28, 22, 48], reason: 'steal' });
            if (!holder.isBot) haptics.push({ playerId: holder.id, pattern: [50, 28, 50], reason: 'stolen' });
            break;
          }
        }
      }
    }

    for (const p of players) {
      const e = state.entities.find((en) => en.id === p.id);
      if (!e) continue;
      hudUpdates[p.id] = {
        score: Math.round(e.score),
        alive: true,
        statText: e.hasCrown ? 'CROWNED!' : `${e.steals} Steals`,
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

  getSnapshot(state): CrownHeistSnapshot {
    return {
      gameId: 'crown-heist',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      crownX: state.crownX,
      crownY: state.crownY,
      crownHolderId: state.crownHolderId,
      obstacles: state.obstacles,
      waves: state.waves.map((w) => ({ ...w })),
      players: state.entities.map((e) => ({
        id: e.id,
        slotIndex: e.slotIndex,
        name: e.name,
        colorHex: e.colorHex,
        isBot: e.isBot,
        x: e.x,
        y: e.y,
        angle: e.angle,
        hasCrown: e.hasCrown,
        tackleTimer: e.tackleTimer,
        stunTimer: e.stunTimer,
        stealGraceTimer: e.stealGraceTimer,
        score: Math.round(e.score),
        steals: e.steals,
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...players]
      .map((p) => ({ p, e: state.entities.find((en) => en.id === p.id) }))
      .sort((a, b) => (b.e?.score ?? 0) - (a.e?.score ?? 0));
    return sorted.map(({ p, e }, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      rank: idx + 1,
      score: Math.round(e?.score ?? 0),
      highlight: `${Math.round(e?.score ?? 0)} pts · ${e?.steals ?? 0} steals`,
    }));
  },
};
