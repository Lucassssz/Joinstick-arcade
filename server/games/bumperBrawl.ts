import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BumperBrawlSnapshot,
  type BumperPlayerState,
  type BumperPowerupState,
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

interface InternalBumperPlayer extends BumperPlayerState {
  dashCd: number;
  pulseCd: number;
  lastHitBy: string | null;
  lastHitTime: number;
  giantTimer: number;
  shockTimer: number;
  streak: number;
}

interface InternalShockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  colorHex: string;
  alpha: number;
}

interface InternalPopup {
  x: number;
  y: number;
  text: string;
  colorHex: string;
  alpha: number;
}

interface BumperInternalState {
  round: number;
  totalRounds: number;
  roundTimer: number;
  betweenRoundTimer: number;
  ringRadius: number;
  maxRingRadius: number;
  minRingRadius: number;
  ringCenterX: number;
  ringCenterY: number;
  pylonAngle: number;
  roundBanner: string | null;
  pylons: { x: number; y: number; r: number }[];
  powerups: BumperPowerupState[];
  powerupTimer: number;
  powerupSeq: number;
  popups: InternalPopup[];
  shockwaves: InternalShockwave[];
  players: InternalBumperPlayer[];
  soloMode: boolean;
  finished: boolean;
}

const DASH_COOLDOWN = 1.7;
const DASH_DURATION = 0.24;
const PULSE_COOLDOWN = 3.0;
const PULSE_RADIUS = 155;
const BASE_RADIUS = 23;
const GIANT_RADIUS = 31;
const ROUND_TIME_LIMIT = 50;

function spawnPlayersForRound(
  players: ServerPlayerInputState[],
  prevMap?: Map<string, { score: number; kos: number; streak: number }>
): InternalBumperPlayer[] {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;
  const spawnDist = players.length === 1 ? 0 : 185;

  return players.map((p, idx) => {
    const angle = (idx / Math.max(players.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const prev = prevMap?.get(p.id);
    return {
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: cx + Math.cos(angle) * spawnDist,
      y: cy + Math.sin(angle) * spawnDist,
      vx: 0,
      vy: 0,
      angle: angle + Math.PI,
      radius: BASE_RADIUS,
      alive: true,
      dashTimer: 0,
      pulseTimer: 0,
      giantTimer: 0,
      shockTimer: 0,
      streak: prev?.streak ?? 0,
      dashCd: 0,
      pulseCd: 0,
      cooldownA: 0,
      cooldownB: 0,
      kos: prev?.kos ?? 0,
      score: prev?.score ?? 0,
      lastHitBy: null,
      lastHitTime: 0,
    };
  });
}

function buildPylons(ringRadius: number, phaseAngle = 0): { x: number; y: number; r: number }[] {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;
  const dist = Math.min(110, ringRadius * 0.42);
  return [0, 1, 2].map((i) => {
    const a = (i * Math.PI * 2) / 3 - Math.PI / 2 + phaseAngle;
    return {
      x: cx + Math.cos(a) * dist,
      y: cy + Math.sin(a) * dist,
      r: 16,
    };
  });
}

function toSnapshot(state: BumperInternalState): BumperBrawlSnapshot {
  return {
    gameId: 'bumper-brawl',
    round: state.round,
    totalRounds: state.totalRounds,
    roundTimer: Math.max(0, state.roundTimer),
    ringRadius: state.ringRadius,
    maxRingRadius: state.maxRingRadius,
    ringCenterX: state.ringCenterX,
    ringCenterY: state.ringCenterY,
    roundBanner: state.roundBanner,
    pylons: state.pylons,
    powerups: state.powerups.map((p) => ({ ...p })),
    popups: state.popups.map((p) => ({ ...p })),
    shockwaves: state.shockwaves.map((s) => ({ ...s })),
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
      radius: p.radius,
      alive: p.alive,
      dashTimer: p.dashTimer,
      pulseTimer: p.pulseTimer,
      giantTimer: p.giantTimer,
      shockTimer: p.shockTimer,
      streak: p.streak,
      cooldownA: Math.min(1, Math.max(0, p.dashCd / DASH_COOLDOWN)),
      cooldownB: Math.min(1, Math.max(0, p.pulseCd / PULSE_COOLDOWN)),
      kos: p.kos,
      score: p.score,
    })),
  };
}

function buildRankings(
  state: BumperInternalState,
  inputPlayers: ServerPlayerInputState[]
): RankingEntry[] {
  const colorById = new Map(inputPlayers.map((p) => [p.id, p.color]));
  const sorted = [...state.players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.kos - a.kos;
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
    highlight: `${p.kos} KO${p.kos === 1 ? '' : 's'}`,
  }));
}

export const bumperBrawlModule: ServerGameModule<BumperInternalState> = {
  id: 'bumper-brawl',

  createState(players: ServerPlayerInputState[], settingValue: number): BumperInternalState {
    const totalRounds = Math.max(1, Math.min(7, settingValue || 3));
    const maxRingRadius = 310;
    return {
      round: 1,
      totalRounds,
      roundTimer: ROUND_TIME_LIMIT,
      betweenRoundTimer: 0,
      ringRadius: maxRingRadius,
      maxRingRadius,
      minRingRadius: 118,
      ringCenterX: ARENA_WIDTH / 2,
      ringCenterY: ARENA_HEIGHT / 2,
      pylonAngle: 0,
      roundBanner: null,
      pylons: buildPylons(maxRingRadius, 0),
      powerups: [],
      powerupTimer: 3.5,
      powerupSeq: 0,
      popups: [],
      shockwaves: [],
      players: spawnPlayersForRound(players),
      soloMode: players.length <= 1,
      finished: false,
    };
  },

  addPlayer(state: BumperInternalState, p: ServerPlayerInputState): void {
    if (state.players.some((existing) => existing.id === p.id)) return;
    const angle = (state.players.length / 8) * Math.PI * 2;
    const spawnDist = Math.min(130, state.ringRadius * 0.55);
    state.players.push({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: state.ringCenterX + Math.cos(angle) * spawnDist,
      y: state.ringCenterY + Math.sin(angle) * spawnDist,
      vx: 0,
      vy: 0,
      angle: angle + Math.PI,
      radius: BASE_RADIUS,
      alive: true,
      dashTimer: 0,
      pulseTimer: 0,
      giantTimer: 0,
      shockTimer: 0,
      streak: 0,
      dashCd: 0,
      pulseCd: 0,
      cooldownA: 0,
      cooldownB: 0,
      kos: 0,
      score: 0,
      lastHitBy: null,
      lastHitTime: 0,
    });
    if (state.players.length > 1) {
      state.soloMode = false;
    }
  },

  step(state: BumperInternalState, inputPlayers: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(inputPlayers.map((p) => [p.id, p]));

    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.radius += 520 * dt;
      sw.alpha = Math.max(0, 1 - sw.radius / sw.maxRadius);
      if (sw.radius >= sw.maxRadius) {
        state.shockwaves.splice(i, 1);
      }
    }

    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pop = state.popups[i];
      pop.y -= 36 * dt;
      pop.alpha -= 0.9 * dt;
      if (pop.alpha <= 0) state.popups.splice(i, 1);
    }

    if (state.betweenRoundTimer > 0) {
      state.betweenRoundTimer -= dt;
      if (state.betweenRoundTimer <= 0) {
        if (state.round >= state.totalRounds) {
          state.finished = true;
          sounds.push({ type: 'win' });
        } else {
          state.round += 1;
          state.roundTimer = ROUND_TIME_LIMIT;
          state.ringRadius = state.maxRingRadius;
          state.pylonAngle = 0;
          state.roundBanner = null;
          state.powerups = [];
          state.powerupTimer = 3.2;
          state.pylons = buildPylons(state.ringRadius, 0);
          const prevMap = new Map(
            state.players.map((p) => [p.id, { score: p.score, kos: p.kos, streak: p.streak }])
          );
          state.players = spawnPlayersForRound(inputPlayers, prevMap);
          sounds.push({ type: 'go' });
        }
      }
    } else {
      state.roundTimer = Math.max(0, state.roundTimer - dt);
      const shrinkProgress = 1 - state.roundTimer / ROUND_TIME_LIMIT;
      state.ringRadius =
        state.maxRingRadius - (state.maxRingRadius - state.minRingRadius) * shrinkProgress;

      // Orbiting bumper pylons speed up in later rounds or late in the round
      const spinSpeed = state.round >= 2 || shrinkProgress > 0.3 ? 0.42 + state.round * 0.12 : 0;
      state.pylonAngle += spinSpeed * dt;
      state.pylons = buildPylons(state.ringRadius, state.pylonAngle);

      // Spawn ring power orbs
      state.powerupTimer -= dt;
      if (state.powerupTimer <= 0 && state.powerups.length < 2 && state.ringRadius > 145) {
        state.powerupTimer = 5.5;
        state.powerupSeq += 1;
        const kinds: BumperPowerupState['kind'][] = ['giant', 'shock', 'star'];
        const kind = kinds[state.powerupSeq % kinds.length];
        const a = Math.random() * Math.PI * 2;
        const r = Math.min(state.ringRadius * 0.62, 55 + Math.random() * 110);
        state.powerups.push({
          id: `bpw_${state.powerupSeq}`,
          kind,
          x: state.ringCenterX + Math.cos(a) * r,
          y: state.ringCenterY + Math.sin(a) * r,
        });
      }

      // Remove powerups outside shrinking ring
      state.powerups = state.powerups.filter(
        (pw) => Math.hypot(pw.x - state.ringCenterX, pw.y - state.ringCenterY) < state.ringRadius - 24
      );

      const now = Date.now();

      for (const bp of state.players) {
        if (!bp.alive) continue;
        const src = inputMap.get(bp.id);
        bp.dashCd = Math.max(0, bp.dashCd - dt);
        bp.pulseCd = Math.max(0, bp.pulseCd - dt);
        bp.dashTimer = Math.max(0, bp.dashTimer - dt);
        bp.pulseTimer = Math.max(0, bp.pulseTimer - dt);
        bp.giantTimer = Math.max(0, bp.giantTimer - dt);
        bp.shockTimer = Math.max(0, bp.shockTimer - dt);
        bp.radius = bp.giantTimer > 0 ? GIANT_RADIUS : BASE_RADIUS;

        if (src) {
          const { dx, dy, a, b } = src.input;
          const mag = Math.hypot(dx, dy);
          if (mag > 0.08) {
            const nx = dx / Math.max(1, mag);
            const ny = dy / Math.max(1, mag);
            const accel = bp.dashTimer > 0 ? 1320 : 1080;
            bp.vx += nx * accel * dt;
            bp.vy += ny * accel * dt;
            bp.angle = Math.atan2(ny, nx);
          }

          // Action A: Dash
          if (a && !src.prevA && bp.dashCd <= 0) {
            const dirX = mag > 0.15 ? dx / mag : Math.cos(bp.angle);
            const dirY = mag > 0.15 ? dy / mag : Math.sin(bp.angle);
            bp.vx = dirX * 560;
            bp.vy = dirY * 560;
            bp.dashTimer = DASH_DURATION;
            bp.dashCd = DASH_COOLDOWN;
            sounds.push({ type: 'boost', playerId: bp.id });
            haptics.push({ playerId: bp.id, pattern: 40, reason: 'dash' });
          }

          // Action B: Radial Pulse (boosted when Shock powerup is active!)
          if (b && !src.prevB && bp.pulseCd <= 0) {
            bp.pulseCd = PULSE_COOLDOWN;
            bp.pulseTimer = 0.28;
            const effRadius = bp.shockTimer > 0 ? PULSE_RADIUS * 1.45 : PULSE_RADIUS;
            const effForce = bp.shockTimer > 0 ? 1.42 : 1.0;
            state.shockwaves.push({
              x: bp.x,
              y: bp.y,
              radius: bp.radius,
              maxRadius: effRadius,
              colorHex: bp.shockTimer > 0 ? '#FFB800' : bp.colorHex,
              alpha: 1,
            });
            sounds.push({ type: 'pulse', playerId: bp.id });
            haptics.push({ playerId: bp.id, pattern: [35, 25, 55], reason: 'pulse' });

            for (const other of state.players) {
              if (!other.alive || other.id === bp.id) continue;
              const ox = other.x - bp.x;
              const oy = other.y - bp.y;
              const dist = Math.hypot(ox, oy);
              if (dist > 0.01 && dist < effRadius) {
                const falloff = 1 - dist / effRadius;
                const push = (380 + falloff * 320) * effForce;
                other.vx += (ox / dist) * push;
                other.vy += (oy / dist) * push;
                other.lastHitBy = bp.id;
                other.lastHitTime = now;
                haptics.push({ playerId: other.id, pattern: 65, reason: 'knockback' });
              }
            }
          }
        }

        const damping = bp.dashTimer > 0 ? Math.pow(0.28, dt) : Math.pow(0.11, dt);
        bp.vx *= damping;
        bp.vy *= damping;

        const maxSpeed = bp.dashTimer > 0 ? 640 : 410;
        const speed = Math.hypot(bp.vx, bp.vy);
        if (speed > maxSpeed) {
          bp.vx = (bp.vx / speed) * maxSpeed;
          bp.vy = (bp.vy / speed) * maxSpeed;
        }

        bp.x += bp.vx * dt;
        bp.y += bp.vy * dt;

        // Pickup power orbs
        for (let i = state.powerups.length - 1; i >= 0; i--) {
          const pw = state.powerups[i];
          if (Math.hypot(bp.x - pw.x, bp.y - pw.y) < bp.radius + 17) {
            state.powerups.splice(i, 1);
            sounds.push({ type: 'pickup', playerId: bp.id });
            haptics.push({ playerId: bp.id, pattern: [20, 15, 35], reason: 'pickup' });
            if (pw.kind === 'giant') {
              bp.giantTimer = 6.5;
              bp.score += 35;
              state.popups.push({ x: bp.x, y: bp.y - 28, text: 'TITAN SIZE!', colorHex: '#FFB800', alpha: 1 });
            } else if (pw.kind === 'shock') {
              bp.shockTimer = 7.0;
              bp.pulseCd = 0;
              bp.score += 35;
              state.popups.push({ x: bp.x, y: bp.y - 28, text: 'MEGA PULSE!', colorHex: '#00C2FF', alpha: 1 });
            } else {
              bp.score += 75;
              bp.dashCd = 0;
              bp.pulseCd = 0;
              state.popups.push({ x: bp.x, y: bp.y - 28, text: '+75 STAR!', colorHex: '#10D98B', alpha: 1 });
            }
          }
        }

        // Pylon bounce
        for (const pylon of state.pylons) {
          const px = bp.x - pylon.x;
          const py = bp.y - pylon.y;
          const dist = Math.hypot(px, py);
          const minDist = bp.radius + pylon.r;
          if (dist > 0.001 && dist < minDist) {
            const nx = px / dist;
            const ny = py / dist;
            bp.x = pylon.x + nx * minDist;
            bp.y = pylon.y + ny * minDist;
            const dot = bp.vx * nx + bp.vy * ny;
            if (dot < 0) {
              bp.vx -= 1.85 * dot * nx;
              bp.vy -= 1.85 * dot * ny;
            }
            bp.vx += nx * 130;
            bp.vy += ny * 130;
            sounds.push({ type: 'bump', intensity: 0.6 });
            haptics.push({ playerId: bp.id, pattern: 38, reason: 'pylon' });
          }
        }
      }

      // Player-to-player elastic bumper collisions
      for (let i = 0; i < state.players.length; i++) {
        const a = state.players[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < state.players.length; j++) {
          const b = state.players[j];
          if (!b.alive) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minDist = a.radius + b.radius;

          if (dist > 0.001 && dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minDist - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;

            const rvx = b.vx - a.vx;
            const rvy = b.vy - a.vy;
            const velAlongNormal = rvx * nx + rvy * ny;

            if (velAlongNormal < 0) {
              const aBoost = (a.dashTimer > 0 ? 1.65 : 1.0) * (a.giantTimer > 0 ? 1.4 : 1.0);
              const bBoost = (b.dashTimer > 0 ? 1.65 : 1.0) * (b.giantTimer > 0 ? 1.4 : 1.0);
              const impulse = -1.35 * velAlongNormal;

              a.vx -= nx * impulse * 0.65 * bBoost + nx * (b.dashTimer > 0 ? 160 : 50);
              a.vy -= ny * impulse * 0.65 * bBoost + ny * (b.dashTimer > 0 ? 160 : 50);
              b.vx += nx * impulse * 0.65 * aBoost + nx * (a.dashTimer > 0 ? 160 : 50);
              b.vy += ny * impulse * 0.65 * aBoost + ny * (a.dashTimer > 0 ? 160 : 50);

              a.lastHitBy = b.id;
              a.lastHitTime = now;
              b.lastHitBy = a.id;
              b.lastHitTime = now;

              const intensity = Math.min(1, Math.abs(velAlongNormal) / 350);
              sounds.push({ type: 'bump', intensity });
              haptics.push({ playerId: a.id, pattern: 48, reason: 'bump' });
              haptics.push({ playerId: b.id, pattern: 48, reason: 'bump' });
            }
          }
        }
      }

      // Check ring knock-outs
      for (const bp of state.players) {
        if (!bp.alive) continue;
        const distFromCenter = Math.hypot(bp.x - state.ringCenterX, bp.y - state.ringCenterY);
        if (distFromCenter > state.ringRadius + bp.radius * 0.35) {
          const victimHadStreak = bp.streak >= 1 || bp.kos >= 2;
          bp.alive = false;
          bp.streak = 0;
          sounds.push({ type: 'ko', playerId: bp.id });
          haptics.push({ playerId: bp.id, pattern: [75, 40, 100], reason: 'ko' });

          if (bp.lastHitBy && now - bp.lastHitTime < 4500) {
            const attacker = state.players.find((x) => x.id === bp.lastHitBy);
            if (attacker) {
              attacker.kos += 1;
              attacker.streak += 1;
              const chainBonus = attacker.streak >= 2 ? 50 : 0;
              const shutdownBonus = victimHadStreak ? 45 : 0;
              const totalPts = 100 + chainBonus + shutdownBonus;
              attacker.score += totalPts;
              const label =
                shutdownBonus > 0
                  ? `SHUTDOWN KO! +${totalPts}`
                  : attacker.streak >= 2
                  ? `${attacker.streak}x KO! +${totalPts}`
                  : 'RING OUT! +100';
              state.popups.push({
                x: attacker.x,
                y: attacker.y - 34,
                text: label,
                colorHex: shutdownBonus > 0 ? '#FFB800' : attacker.colorHex,
                alpha: 1,
              });
              haptics.push({ playerId: attacker.id, pattern: [35, 25, 60], reason: 'score' });
            }
          }
        }
      }

      // Check round completion
      const alivePlayers = state.players.filter((p) => p.alive);
      if (state.soloMode) {
        if (alivePlayers.length === 0 || state.roundTimer <= 0) {
          if (alivePlayers.length === 1) {
            alivePlayers[0].score += 150;
            state.roundBanner = `${alivePlayers[0].name} Survived!`;
          } else {
            state.roundBanner = 'Ring Out!';
          }
          state.betweenRoundTimer = 2.0;
        }
      } else {
        if (alivePlayers.length <= 1 || state.roundTimer <= 0) {
          if (alivePlayers.length === 1) {
            alivePlayers[0].score += 200;
            state.roundBanner = `${alivePlayers[0].name} Wins Round ${state.round}`;
            sounds.push({ type: 'win', playerId: alivePlayers[0].id });
          } else if (alivePlayers.length > 1) {
            for (const p of alivePlayers) p.score += 75;
            state.roundBanner = `Time Up — ${alivePlayers.length} Survived`;
          } else {
            state.roundBanner = 'Double Ring Out!';
          }
          state.betweenRoundTimer = 2.3;
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: p.score,
        alive: p.alive,
        statText: p.alive ? `${p.kos} KO · ${p.score} pts` : `OUT · ${p.score} pts`,
        cooldownA: Math.min(1, Math.max(0, p.dashCd / DASH_COOLDOWN)),
        cooldownB: Math.min(1, Math.max(0, p.pulseCd / PULSE_COOLDOWN)),
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

  getSnapshot(state: BumperInternalState): BumperBrawlSnapshot {
    return toSnapshot(state);
  },

  getRankings(state: BumperInternalState, players: ServerPlayerInputState[]): RankingEntry[] {
    return buildRankings(state, players);
  },
};
