import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type FusePassSnapshot,
  type FusePlayerState,
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

interface InternalFusePlayer extends FusePlayerState {
  sprintCd: number;
  lungeCd: number;
  roundsWon: number;
}

interface FusePassInternalState {
  round: number;
  totalRounds: number;
  bombHolderId: string | null;
  bombTimer: number;
  bombMaxTime: number;
  detonationsThisRound: number;
  betweenRoundTimer: number;
  roundBanner: string | null;
  pillars: { x: number; y: number; r: number }[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  players: InternalFusePlayer[];
  soloMode: boolean;
  finished: boolean;
}

const ARENA_MARGIN = 34;
const PLAYER_RADIUS = 20;
const SPRINT_DURATION = 0.45;
const SPRINT_COOLDOWN = 2.2;
const LUNGE_DURATION = 0.22;
const LUNGE_COOLDOWN = 1.4;
const PASS_IMMUNITY = 0.55;

const ARENA_PILLARS = [
  { x: 350, y: 215, r: 36 },
  { x: 850, y: 215, r: 36 },
  { x: 350, y: 505, r: 36 },
  { x: 850, y: 505, r: 36 },
  { x: 600, y: 360, r: 44 },
];

function spawnPlayers(
  players: ServerPlayerInputState[],
  prevMap?: Map<string, { score: number; passes: number; roundsWon: number }>
): InternalFusePlayer[] {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;
  return players.map((p, idx) => {
    const angle = (idx / Math.max(players.length, 1)) * Math.PI * 2;
    const prev = prevMap?.get(p.id);
    return {
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: cx + Math.cos(angle) * 280,
      y: cy + Math.sin(angle) * 190,
      vx: 0,
      vy: 0,
      angle: angle + Math.PI,
      alive: true,
      hasBomb: false,
      sprintTimer: 0,
      lungeTimer: 0,
      immuneTimer: 0,
      sprintCd: 0,
      lungeCd: 0,
      cooldownA: 0,
      cooldownB: 0,
      score: prev?.score ?? 0,
      passes: prev?.passes ?? 0,
      roundsWon: prev?.roundsWon ?? 0,
    };
  });
}

function assignBomb(state: FusePassInternalState): void {
  const alive = state.players.filter((p) => p.alive);
  for (const p of state.players) p.hasBomb = false;
  if (alive.length === 0) {
    state.bombHolderId = null;
    return;
  }
  const chosen = alive[Math.floor(Math.random() * alive.length)];
  chosen.hasBomb = true;
  state.bombHolderId = chosen.id;
  const maxTime = Math.max(6.5, 11 - state.detonationsThisRound * 0.9);
  state.bombMaxTime = maxTime;
  state.bombTimer = maxTime;
}

function toSnapshot(state: FusePassInternalState): FusePassSnapshot {
  return {
    gameId: 'fuse-pass',
    round: state.round,
    totalRounds: state.totalRounds,
    bombHolderId: state.bombHolderId,
    bombTimer: Math.max(0, state.bombTimer),
    bombMaxTime: state.bombMaxTime,
    roundBanner: state.roundBanner,
    pillars: state.pillars,
    explosions: state.explosions.map((e) => ({ ...e })),
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
      hasBomb: p.hasBomb,
      sprintTimer: p.sprintTimer,
      lungeTimer: p.lungeTimer,
      immuneTimer: p.immuneTimer,
      cooldownA: Math.min(1, Math.max(0, p.sprintCd / SPRINT_COOLDOWN)),
      cooldownB: Math.min(1, Math.max(0, p.lungeCd / LUNGE_COOLDOWN)),
      score: p.score,
      passes: p.passes,
    })),
  };
}

function buildRankings(
  state: FusePassInternalState,
  inputPlayers: ServerPlayerInputState[]
): RankingEntry[] {
  const colorById = new Map(inputPlayers.map((p) => [p.id, p.color]));
  const sorted = [...state.players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.passes - a.passes;
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
    highlight: `${p.passes} pass${p.passes === 1 ? '' : 'es'}`,
  }));
}

export const fusePassModule: ServerGameModule<FusePassInternalState> = {
  id: 'fuse-pass',

  createState(players: ServerPlayerInputState[], settingValue: number): FusePassInternalState {
    const totalRounds = Math.max(1, Math.min(7, settingValue || 3));
    const state: FusePassInternalState = {
      round: 1,
      totalRounds,
      bombHolderId: null,
      bombTimer: 11,
      bombMaxTime: 11,
      detonationsThisRound: 0,
      betweenRoundTimer: 0,
      roundBanner: null,
      pillars: ARENA_PILLARS,
      explosions: [],
      players: spawnPlayers(players),
      soloMode: players.length <= 1,
      finished: false,
    };
    assignBomb(state);
    return state;
  },

  addPlayer(state: FusePassInternalState, p: ServerPlayerInputState): void {
    if (state.players.some((x) => x.id === p.id)) return;
    const angle = (state.players.length / 8) * Math.PI * 2;
    state.players.push({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: ARENA_WIDTH / 2 + Math.cos(angle) * 280,
      y: ARENA_HEIGHT / 2 + Math.sin(angle) * 190,
      vx: 0,
      vy: 0,
      angle: 0,
      alive: true,
      hasBomb: false,
      sprintTimer: 0,
      lungeTimer: 0,
      immuneTimer: 0.6,
      sprintCd: 0,
      lungeCd: 0,
      cooldownA: 0,
      cooldownB: 0,
      score: 0,
      passes: 0,
      roundsWon: 0,
    });
    if (state.players.length > 1) state.soloMode = false;
    if (!state.bombHolderId) assignBomb(state);
  },

  step(state: FusePassInternalState, inputPlayers: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(inputPlayers.map((p) => [p.id, p]));

    for (let i = state.explosions.length - 1; i >= 0; i--) {
      const e = state.explosions[i];
      e.radius += 380 * dt;
      e.alpha = Math.max(0, e.alpha - 2.1 * dt);
      if (e.alpha <= 0) state.explosions.splice(i, 1);
    }

    if (state.betweenRoundTimer > 0) {
      state.betweenRoundTimer -= dt;
      if (state.betweenRoundTimer <= 0) {
        if (state.round >= state.totalRounds) {
          state.finished = true;
          sounds.push({ type: 'win' });
        } else {
          state.round += 1;
          state.detonationsThisRound = 0;
          state.roundBanner = null;
          const prevMap = new Map(
            state.players.map((p) => [
              p.id,
              { score: p.score, passes: p.passes, roundsWon: p.roundsWon },
            ])
          );
          state.players = spawnPlayers(inputPlayers, prevMap);
          assignBomb(state);
          sounds.push({ type: 'go' });
        }
      }
    } else {
      // Tick bomb countdown
      const prevSec = Math.ceil(state.bombTimer);
      state.bombTimer = Math.max(0, state.bombTimer - dt);
      const currSec = Math.ceil(state.bombTimer);
      if (currSec !== prevSec && currSec <= 3 && currSec > 0 && state.bombHolderId) {
        sounds.push({ type: 'countdown' });
        haptics.push({ playerId: state.bombHolderId, pattern: 35, reason: 'tick' });
      }

      // Move players
      for (const p of state.players) {
        if (!p.alive) continue;
        const src = inputMap.get(p.id);
        p.sprintCd = Math.max(0, p.sprintCd - dt);
        p.lungeCd = Math.max(0, p.lungeCd - dt);
        p.sprintTimer = Math.max(0, p.sprintTimer - dt);
        p.lungeTimer = Math.max(0, p.lungeTimer - dt);
        p.immuneTimer = Math.max(0, p.immuneTimer - dt);

        if (src) {
          const { dx, dy, a, b } = src.input;
          const mag = Math.hypot(dx, dy);
          if (mag > 0.08) {
            const nx = dx / Math.max(1, mag);
            const ny = dy / Math.max(1, mag);
            const baseAccel = p.hasBomb ? 1580 : 1360;
            const accel = p.sprintTimer > 0 ? baseAccel * 1.4 : baseAccel;
            p.vx += nx * accel * dt;
            p.vy += ny * accel * dt;
            p.angle = Math.atan2(ny, nx);
          }

          // Action A: SPRINT
          if (a && !src.prevA && p.sprintCd <= 0) {
            p.sprintTimer = SPRINT_DURATION;
            p.sprintCd = SPRINT_COOLDOWN;
            const dirX = mag > 0.12 ? dx / mag : Math.cos(p.angle);
            const dirY = mag > 0.12 ? dy / mag : Math.sin(p.angle);
            p.vx += dirX * 260;
            p.vy += dirY * 260;
            sounds.push({ type: 'boost', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 38, reason: 'sprint' });
          }

          // Action B: PASS LUNGE
          if (b && !src.prevB && p.lungeCd <= 0) {
            p.lungeTimer = LUNGE_DURATION;
            p.lungeCd = LUNGE_COOLDOWN;
            const dirX = mag > 0.12 ? dx / mag : Math.cos(p.angle);
            const dirY = mag > 0.12 ? dy / mag : Math.sin(p.angle);
            p.vx = dirX * 610;
            p.vy = dirY * 610;
            sounds.push({ type: 'pulse', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 42, reason: 'lunge' });
          }
        }

        const damping = p.lungeTimer > 0 ? Math.pow(0.25, dt) : Math.pow(0.06, dt);
        p.vx *= damping;
        p.vy *= damping;

        const baseMax = p.hasBomb ? 375 : 325;
        const maxSpeed = p.lungeTimer > 0 ? 620 : p.sprintTimer > 0 ? baseMax * 1.38 : baseMax;
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Arena wall bounce
        if (p.x < ARENA_MARGIN + PLAYER_RADIUS) {
          p.x = ARENA_MARGIN + PLAYER_RADIUS;
          p.vx = Math.abs(p.vx) * 0.5;
        } else if (p.x > ARENA_WIDTH - ARENA_MARGIN - PLAYER_RADIUS) {
          p.x = ARENA_WIDTH - ARENA_MARGIN - PLAYER_RADIUS;
          p.vx = -Math.abs(p.vx) * 0.5;
        }
        if (p.y < ARENA_MARGIN + PLAYER_RADIUS) {
          p.y = ARENA_MARGIN + PLAYER_RADIUS;
          p.vy = Math.abs(p.vy) * 0.5;
        } else if (p.y > ARENA_HEIGHT - ARENA_MARGIN - PLAYER_RADIUS) {
          p.y = ARENA_HEIGHT - ARENA_MARGIN - PLAYER_RADIUS;
          p.vy = -Math.abs(p.vy) * 0.5;
        }

        // Pillar collisions
        for (const pil of state.pillars) {
          const dx = p.x - pil.x;
          const dy = p.y - pil.y;
          const dist = Math.hypot(dx, dy);
          const minD = PLAYER_RADIUS + pil.r;
          if (dist > 0.01 && dist < minD) {
            const nx = dx / dist;
            const ny = dy / dist;
            p.x = pil.x + nx * minD;
            p.y = pil.y + ny * minD;
            const dot = p.vx * nx + p.vy * ny;
            if (dot < 0) {
              p.vx -= 1.5 * dot * nx;
              p.vy -= 1.5 * dot * ny;
            }
          }
        }
      }

      // Check bomb pass collisions
      const holder = state.players.find((p) => p.id === state.bombHolderId && p.alive);
      if (holder) {
        const reachBonus = holder.lungeTimer > 0 ? 18 : 0;
        for (const target of state.players) {
          if (!target.alive || target.id === holder.id || target.immuneTimer > 0) continue;
          const dx = target.x - holder.x;
          const dy = target.y - holder.y;
          const dist = Math.hypot(dx, dy);
          if (dist < PLAYER_RADIUS * 2 + 8 + reachBonus) {
            holder.hasBomb = false;
            holder.immuneTimer = PASS_IMMUNITY;
            holder.passes += 1;
            holder.score += 35;

            target.hasBomb = true;
            state.bombHolderId = target.id;
            // Small breath of time if passed at the buzzer
            if (state.bombTimer < 1.6) state.bombTimer = 1.6;

            // Separation bounce
            const nx = dist > 0.01 ? dx / dist : 1;
            const ny = dist > 0.01 ? dy / dist : 0;
            holder.vx -= nx * 160;
            holder.vy -= ny * 160;
            target.vx += nx * 190;
            target.vy += ny * 190;

            sounds.push({ type: 'bump', intensity: 0.9 });
            haptics.push({ playerId: holder.id, pattern: 40, reason: 'pass' });
            haptics.push({ playerId: target.id, pattern: [50, 30, 75], reason: 'hit' });
            break;
          }
        }
      }

      // Bomb detonation!
      if (state.bombTimer <= 0 && holder) {
        state.explosions.push({
          x: holder.x,
          y: holder.y,
          radius: 20,
          colorHex: '#FF4D2E',
          alpha: 1,
        });
        sounds.push({ type: 'ko', playerId: holder.id });
        haptics.push({ playerId: holder.id, pattern: [80, 40, 110], reason: 'ko' });

        if (state.soloMode) {
          // Solo mode: survive-the-fuse practice, blow up & end round cleanly
          holder.alive = false;
          holder.hasBomb = false;
          state.bombHolderId = null;
          state.roundBanner = 'BOOM! Fuse Detonated!';
          state.betweenRoundTimer = 2.0;
        } else {
          holder.alive = false;
          holder.hasBomb = false;
          state.detonationsThisRound += 1;

          const remaining = state.players.filter((p) => p.alive);
          for (const survivor of remaining) {
            survivor.score += 65;
          }

          if (remaining.length <= 1) {
            state.bombHolderId = null;
            if (remaining.length === 1) {
              remaining[0].score += 180;
              remaining[0].roundsWon += 1;
              state.roundBanner = `${remaining[0].name} Wins Round ${state.round}!`;
              sounds.push({ type: 'win', playerId: remaining[0].id });
            } else {
              state.roundBanner = 'Everyone Blasted!';
            }
            state.betweenRoundTimer = 2.3;
          } else {
            assignBomb(state);
          }
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: p.score,
        alive: p.alive,
        statText: !p.alive
          ? `OUT · ${p.score} pts`
          : p.hasBomb
          ? `BOMB! ${state.bombTimer.toFixed(1)}s`
          : `SAFE · ${p.score} pts`,
        cooldownA: Math.min(1, Math.max(0, p.sprintCd / SPRINT_COOLDOWN)),
        cooldownB: Math.min(1, Math.max(0, p.lungeCd / LUNGE_COOLDOWN)),
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

  getSnapshot(state: FusePassInternalState): FusePassSnapshot {
    return toSnapshot(state);
  },

  getRankings(state: FusePassInternalState, players: ServerPlayerInputState[]): RankingEntry[] {
    return buildRankings(state, players);
  },
};
