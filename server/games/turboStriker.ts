import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type RankingEntry,
  type SoundEvent,
  type StrikerBallState,
  type StrikerPlayerState,
  type TurboStrikerSnapshot,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface InternalStrikerPlayer extends StrikerPlayerState {
  kickCd: number;
  tackleCd: number;
  megaKickTimer: number;
  speedTimer: number;
}

interface TurboStrikerInternalState {
  timeLeft: number;
  totalTime: number;
  scoreRed: number;
  scoreBlue: number;
  goalPauseTimer: number;
  goalBanner: string | null;
  goalBannerColor: string | null;
  ball: StrikerBallState;
  bonusBalls: StrikerBallState[];
  powerups: { id: string; kind: 'mega-kick' | 'speed' | 'twin-ball'; x: number; y: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pickupTimer: number;
  nextId: number;
  lastTouchPlayerId: string | null;
  players: InternalStrikerPlayer[];
  finished: boolean;
}

export const PITCH_LEFT = 72;
export const PITCH_RIGHT = ARENA_WIDTH - 72;
export const PITCH_TOP = 58;
export const PITCH_BOTTOM = ARENA_HEIGHT - 58;
export const GOAL_HALF_HEIGHT = 115;
export const GOAL_DEPTH = 48;

const PLAYER_RADIUS = 22;
const BALL_RADIUS = 17;
const KICK_COOLDOWN = 0.85;
const KICK_RANGE = 76;
const TACKLE_COOLDOWN = 1.75;
const TACKLE_DURATION = 0.26;

function teamForSlot(slotIndex: number): 'red' | 'blue' {
  return slotIndex % 2 === 0 ? 'red' : 'blue';
}

function positionPlayersForKickoff(players: InternalStrikerPlayer[]): void {
  const red = players.filter((p) => p.team === 'red');
  const blue = players.filter((p) => p.team === 'blue');
  const cy = ARENA_HEIGHT / 2;

  red.forEach((p, i) => {
    const spread = red.length > 1 ? (i - (red.length - 1) / 2) * 95 : 0;
    p.x = ARENA_WIDTH * 0.32 - (i % 2) * 55;
    p.y = cy + spread;
    p.vx = 0;
    p.vy = 0;
    p.angle = 0;
  });

  blue.forEach((p, i) => {
    const spread = blue.length > 1 ? (i - (blue.length - 1) / 2) * 95 : 0;
    p.x = ARENA_WIDTH * 0.68 + (i % 2) * 55;
    p.y = cy + spread;
    p.vx = 0;
    p.vy = 0;
    p.angle = Math.PI;
  });
}

function resetBall(): StrikerBallState {
  return {
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2,
    vx: 0,
    vy: 0,
    radius: BALL_RADIUS,
    spin: 0,
    lastTouchColor: null,
  };
}

function toSnapshot(state: TurboStrikerInternalState): TurboStrikerSnapshot {
  const goldenTime = state.timeLeft > 0 && state.timeLeft <= 15;
  return {
    gameId: 'turbo-striker',
    timeLeft: Math.max(0, state.timeLeft),
    totalTime: state.totalTime,
    scoreRed: state.scoreRed,
    scoreBlue: state.scoreBlue,
    goldenTime,
    goalBanner: state.goalBanner,
    goalBannerColor: state.goalBannerColor,
    ball: { ...state.ball },
    bonusBalls: state.bonusBalls.map((b) => ({ ...b })),
    powerups: state.powerups.map((pk) => ({ ...pk })),
    popups: state.popups.map((pp) => ({ ...pp })),
    players: state.players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.colorHex,
      team: p.team,
      x: p.x,
      y: p.y,
      vx: p.vx,
      vy: p.vy,
      angle: p.angle,
      tackleTimer: p.tackleTimer,
      kickRingTimer: p.kickRingTimer,
      megaKickTimer: p.megaKickTimer,
      speedTimer: p.speedTimer,
      cooldownA: Math.min(1, Math.max(0, p.kickCd / KICK_COOLDOWN)),
      cooldownB: Math.min(1, Math.max(0, p.tackleCd / TACKLE_COOLDOWN)),
      goals: p.goals,
      score: p.score,
    })),
  };
}

function buildRankings(
  state: TurboStrikerInternalState,
  inputPlayers: ServerPlayerInputState[]
): RankingEntry[] {
  const colorById = new Map(inputPlayers.map((p) => [p.id, p.color]));
  const winningTeam: 'red' | 'blue' | 'tie' =
    state.scoreRed > state.scoreBlue
      ? 'red'
      : state.scoreBlue > state.scoreRed
      ? 'blue'
      : 'tie';

  const sorted = [...state.players].sort((a, b) => {
    const aWin = a.team === winningTeam ? 1 : 0;
    const bWin = b.team === winningTeam ? 1 : 0;
    if (bWin !== aWin) return bWin - aWin;
    if (b.score !== a.score) return b.score - a.score;
    return b.goals - a.goals;
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
    score: p.score + (p.team === winningTeam ? 200 : 0),
    highlight: `${p.team.toUpperCase()} · ${p.goals} goal${p.goals === 1 ? '' : 's'}`,
  }));
}

export const turboStrikerModule: ServerGameModule<TurboStrikerInternalState> = {
  id: 'turbo-striker',

  createState(players: ServerPlayerInputState[], settingValue: number): TurboStrikerInternalState {
    const totalTime = Math.max(30, Math.min(180, settingValue || 90));
    const list: InternalStrikerPlayer[] = players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      team: teamForSlot(p.slotIndex),
      x: ARENA_WIDTH / 2,
      y: ARENA_HEIGHT / 2,
      vx: 0,
      vy: 0,
      angle: 0,
      tackleTimer: 0,
      kickRingTimer: 0,
      megaKickTimer: 0,
      speedTimer: 0,
      kickCd: 0,
      tackleCd: 0,
      cooldownA: 0,
      cooldownB: 0,
      goals: 0,
      score: 0,
    }));
    positionPlayersForKickoff(list);

    return {
      timeLeft: totalTime,
      totalTime,
      scoreRed: 0,
      scoreBlue: 0,
      goalPauseTimer: 0,
      goalBanner: null,
      goalBannerColor: null,
      ball: resetBall(),
      bonusBalls: [],
      powerups: [],
      popups: [],
      pickupTimer: 5.5,
      nextId: 1,
      lastTouchPlayerId: null,
      players: list,
      finished: false,
    };
  },

  addPlayer(state: TurboStrikerInternalState, p: ServerPlayerInputState): void {
    if (state.players.some((x) => x.id === p.id)) return;
    const team = teamForSlot(p.slotIndex);
    state.players.push({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      team,
      x: team === 'red' ? ARENA_WIDTH * 0.3 : ARENA_WIDTH * 0.7,
      y: ARENA_HEIGHT / 2,
      vx: 0,
      vy: 0,
      angle: team === 'red' ? 0 : Math.PI,
      tackleTimer: 0,
      kickRingTimer: 0,
      megaKickTimer: 0,
      speedTimer: 0,
      kickCd: 0,
      tackleCd: 0,
      cooldownA: 0,
      cooldownB: 0,
      goals: 0,
      score: 0,
    });
  },

  step(state: TurboStrikerInternalState, inputPlayers: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(inputPlayers.map((p) => [p.id, p]));

    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pp = state.popups[i];
      pp.y -= 32 * dt;
      pp.alpha -= 0.9 * dt;
      if (pp.alpha <= 0) state.popups.splice(i, 1);
    }

    if (state.goalPauseTimer > 0) {
      state.goalPauseTimer -= dt;
      if (state.goalPauseTimer <= 0) {
        state.goalBanner = null;
        state.goalBannerColor = null;
        state.ball = resetBall();
        state.lastTouchPlayerId = null;
        positionPlayersForKickoff(state.players);
        sounds.push({ type: 'go' });
      }
    } else {
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) {
        state.finished = true;
        sounds.push({ type: 'win' });
      }

      // Spawn pitch powerups
      state.pickupTimer -= dt;
      if (state.pickupTimer <= 0 && state.powerups.length < 2) {
        const kinds: ('mega-kick' | 'speed' | 'twin-ball')[] = ['mega-kick', 'speed', 'twin-ball'];
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        const px = ARENA_WIDTH / 2 + (Math.random() - 0.5) * 440;
        const py = ARENA_HEIGHT / 2 + (Math.random() - 0.5) * 320;
        state.powerups.push({ id: `sp_${state.nextId++}`, kind, x: px, y: py });
        state.pickupTimer = 8.5;
      }

      const ball = state.ball;
      const goldenTime = state.timeLeft <= 15;
      const goalValue = goldenTime ? 2 : 1;

      // Update strikers
      for (const p of state.players) {
        const src = inputMap.get(p.id);
        p.kickCd = Math.max(0, p.kickCd - dt);
        p.tackleCd = Math.max(0, p.tackleCd - dt);
        p.tackleTimer = Math.max(0, p.tackleTimer - dt);
        p.kickRingTimer = Math.max(0, p.kickRingTimer - dt);
        p.megaKickTimer = Math.max(0, p.megaKickTimer - dt);
        p.speedTimer = Math.max(0, p.speedTimer - dt);

        if (src) {
          const { dx, dy, a, b } = src.input;
          const mag = Math.hypot(dx, dy);
          if (mag > 0.08) {
            const nx = dx / Math.max(1, mag);
            const ny = dy / Math.max(1, mag);
            const accel = (p.tackleTimer > 0 ? 1550 : 1420) * (p.speedTimer > 0 ? 1.25 : 1);
            p.vx += nx * accel * dt;
            p.vy += ny * accel * dt;
            p.angle = Math.atan2(ny, nx);
          }

          // Action A: POWER KICK
          if (a && !src.prevA && p.kickCd <= 0) {
            p.kickCd = KICK_COOLDOWN;
            p.kickRingTimer = 0.24;
            const kickPower = p.megaKickTimer > 0 ? 1080 : 780;
            let kicked = false;
            for (const targetBall of [ball, ...state.bonusBalls]) {
              const bx = targetBall.x - p.x;
              const by = targetBall.y - p.y;
              const dist = Math.hypot(bx, by);
              if (dist < KICK_RANGE) {
                const dirX = dist > 0.01 ? bx / dist : Math.cos(p.angle);
                const dirY = dist > 0.01 ? by / dist : Math.sin(p.angle);
                targetBall.vx = dirX * kickPower + p.vx * 0.25;
                targetBall.vy = dirY * kickPower + p.vy * 0.25;
                targetBall.spin = (Math.random() - 0.5) * 14;
                targetBall.lastTouchColor = p.team === 'red' ? '#FF4D2E' : '#00C2FF';
                state.lastTouchPlayerId = p.id;
                p.score += 10;
                kicked = true;
              }
            }
            if (kicked) {
              sounds.push({ type: 'pulse', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: [38, 22, 55], reason: 'kick' });
            } else {
              sounds.push({ type: 'boost', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: 30, reason: 'kick-miss' });
            }
          }

          // Action B: TACKLE / GOALIE DIVE
          if (b && !src.prevB && p.tackleCd <= 0) {
            p.tackleCd = TACKLE_COOLDOWN;
            p.tackleTimer = TACKLE_DURATION;
            const dirX = mag > 0.12 ? dx / mag : Math.cos(p.angle);
            const dirY = mag > 0.12 ? dy / mag : Math.sin(p.angle);
            p.vx = dirX * 640;
            p.vy = dirY * 640;
            sounds.push({ type: 'boost', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 42, reason: 'tackle' });
          }
        }

        const damping = p.tackleTimer > 0 ? Math.pow(0.26, dt) : Math.pow(0.07, dt);
        p.vx *= damping;
        p.vy *= damping;

        const baseMax = p.speedTimer > 0 ? 485 : 370;
        const maxSpd = p.tackleTimer > 0 ? 680 : baseMax;
        const spd = Math.hypot(p.vx, p.vy);
        if (spd > maxSpd) {
          p.vx = (p.vx / spd) * maxSpd;
          p.vy = (p.vy / spd) * maxSpd;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Clamp players inside pitch
        p.x = Math.max(PITCH_LEFT + PLAYER_RADIUS, Math.min(PITCH_RIGHT - PLAYER_RADIUS, p.x));
        p.y = Math.max(PITCH_TOP + PLAYER_RADIUS, Math.min(PITCH_BOTTOM - PLAYER_RADIUS, p.y));

        // Collect pitch powerups
        for (let i = state.powerups.length - 1; i >= 0; i--) {
          const pk = state.powerups[i];
          if (Math.hypot(p.x - pk.x, p.y - pk.y) < PLAYER_RADIUS + 18) {
            if (pk.kind === 'mega-kick') {
              p.megaKickTimer = 8;
              state.popups.push({ x: pk.x, y: pk.y - 12, text: 'MEGA KICK!', colorHex: '#FF4D2E', alpha: 1 });
            } else if (pk.kind === 'speed') {
              p.speedTimer = 8;
              state.popups.push({ x: pk.x, y: pk.y - 12, text: 'TURBO SPRINT!', colorHex: '#10D98B', alpha: 1 });
            } else {
              if (state.bonusBalls.length < 2) {
                state.bonusBalls.push({
                  x: ARENA_WIDTH / 2,
                  y: ARENA_HEIGHT / 2 + (Math.random() - 0.5) * 120,
                  vx: (Math.random() - 0.5) * 320,
                  vy: (Math.random() - 0.5) * 320,
                  radius: 14,
                  spin: 0,
                  lastTouchColor: '#FFB800',
                });
              }
              state.popups.push({ x: pk.x, y: pk.y - 12, text: 'GOLD BALL!', colorHex: '#FFB800', alpha: 1 });
            }
            p.score += 15;
            state.powerups.splice(i, 1);
            sounds.push({ type: 'pickup', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 26, reason: 'pickup' });
          }
        }
      }

      // Player-to-player bump
      for (let i = 0; i < state.players.length; i++) {
        const a = state.players[i];
        for (let j = i + 1; j < state.players.length; j++) {
          const b = state.players[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy);
          const minD = PLAYER_RADIUS * 2;
          if (dist > 0.01 && dist < minD) {
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = minD - dist;
            a.x -= nx * overlap * 0.5;
            a.y -= ny * overlap * 0.5;
            b.x += nx * overlap * 0.5;
            b.y += ny * overlap * 0.5;
            const boostA = a.tackleTimer > 0 ? 220 : 80;
            const boostB = b.tackleTimer > 0 ? 220 : 80;
            a.vx -= nx * boostB;
            a.vy -= ny * boostB;
            b.vx += nx * boostA;
            b.vy += ny * boostA;
            if (a.tackleTimer > 0 || b.tackleTimer > 0) {
              sounds.push({ type: 'bump', intensity: 0.7 });
              haptics.push({ playerId: a.id, pattern: 45, reason: 'bump' });
              haptics.push({ playerId: b.id, pattern: 45, reason: 'bump' });
            }
          }
        }
      }

      // Ball physics & player-to-ball dribbling
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;
      const ballDamp = Math.pow(0.42, dt);
      ball.vx *= ballDamp;
      ball.vy *= ballDamp;
      ball.spin *= Math.pow(0.5, dt);

      for (const p of state.players) {
        const dx = ball.x - p.x;
        const dy = ball.y - p.y;
        const dist = Math.hypot(dx, dy);
        const minD = PLAYER_RADIUS + ball.radius;
        if (dist > 0.001 && dist < minD) {
          const nx = dx / dist;
          const ny = dy / dist;
          ball.x = p.x + nx * minD;
          ball.y = p.y + ny * minD;
          const power = p.tackleTimer > 0 ? 520 : 280;
          ball.vx = nx * power + p.vx * 0.75;
          ball.vy = ny * power + p.vy * 0.75;
          ball.lastTouchColor = p.team === 'red' ? '#FF4D2E' : '#00C2FF';
          state.lastTouchPlayerId = p.id;
          sounds.push({ type: 'bump', intensity: 0.45 });
          haptics.push({ playerId: p.id, pattern: 30, reason: 'dribble' });
        }
      }

      // Clamp ball max speed
      const ballSpd = Math.hypot(ball.vx, ball.vy);
      if (ballSpd > 920) {
        ball.vx = (ball.vx / ballSpd) * 920;
        ball.vy = (ball.vy / ballSpd) * 920;
      }

      // Ball pitch walls & recessed goal nets
      const goalTop = ARENA_HEIGHT / 2 - GOAL_HALF_HEIGHT;
      const goalBottom = ARENA_HEIGHT / 2 + GOAL_HALF_HEIGHT;
      const inGoalMouthY = ball.y > goalTop + ball.radius * 0.5 && ball.y < goalBottom - ball.radius * 0.5;

      if (ball.y < PITCH_TOP + ball.radius) {
        ball.y = PITCH_TOP + ball.radius;
        ball.vy = Math.abs(ball.vy) * 0.85;
        sounds.push({ type: 'bump', intensity: 0.35 });
      } else if (ball.y > PITCH_BOTTOM - ball.radius) {
        ball.y = PITCH_BOTTOM - ball.radius;
        ball.vy = -Math.abs(ball.vy) * 0.85;
        sounds.push({ type: 'bump', intensity: 0.35 });
      }

      if (!inGoalMouthY) {
        if (ball.x < PITCH_LEFT + ball.radius) {
          ball.x = PITCH_LEFT + ball.radius;
          ball.vx = Math.abs(ball.vx) * 0.85;
          sounds.push({ type: 'bump', intensity: 0.35 });
        } else if (ball.x > PITCH_RIGHT - ball.radius) {
          ball.x = PITCH_RIGHT - ball.radius;
          ball.vx = -Math.abs(ball.vx) * 0.85;
          sounds.push({ type: 'bump', intensity: 0.35 });
        }
      } else {
        // Check GOAL scored!
        if (ball.x < PITCH_LEFT - ball.radius * 0.6) {
          // Ball entered Left (Red's net) -> Blue scores!
          state.scoreBlue += goalValue;
          const scorer = state.players.find((p) => p.id === state.lastTouchPlayerId);
          if (scorer && scorer.team === 'blue') {
            scorer.goals += 1;
            scorer.score += 120 * goalValue;
            state.goalBanner = goldenTime ? `2X BLUE GOAL! ${scorer.name}` : `BLUE GOAL! ${scorer.name}`;
          } else {
            state.goalBanner = goldenTime ? '2X BLUE GOAL!' : 'BLUE TEAM SCORES!';
          }
          state.goalBannerColor = '#00C2FF';
          state.goalPauseTimer = 1.8;
          sounds.push({ type: 'win' });
          for (const pl of state.players) {
            haptics.push({ playerId: pl.id, pattern: [50, 30, 80], reason: 'goal' });
          }
        } else if (ball.x > PITCH_RIGHT + ball.radius * 0.6) {
          // Ball entered Right (Blue's net) -> Red scores!
          state.scoreRed += goalValue;
          const scorer = state.players.find((p) => p.id === state.lastTouchPlayerId);
          if (scorer && scorer.team === 'red') {
            scorer.goals += 1;
            scorer.score += 120 * goalValue;
            state.goalBanner = goldenTime ? `2X RED GOAL! ${scorer.name}` : `RED GOAL! ${scorer.name}`;
          } else {
            state.goalBanner = goldenTime ? '2X RED GOAL!' : 'RED TEAM SCORES!';
          }
          state.goalBannerColor = '#FF4D2E';
          state.goalPauseTimer = 1.8;
          sounds.push({ type: 'win' });
          for (const pl of state.players) {
            haptics.push({ playerId: pl.id, pattern: [50, 30, 80], reason: 'goal' });
          }
        }
      }

      // Bonus Gold Balls physics & goal scoring (instant +1 without resetting main kickoff)
      for (let bi = state.bonusBalls.length - 1; bi >= 0; bi--) {
        const bb = state.bonusBalls[bi];
        bb.x += bb.vx * dt;
        bb.y += bb.vy * dt;
        bb.vx *= Math.pow(0.45, dt);
        bb.vy *= Math.pow(0.45, dt);
        for (const p of state.players) {
          const dx = bb.x - p.x;
          const dy = bb.y - p.y;
          const dist = Math.hypot(dx, dy);
          const minD = PLAYER_RADIUS + bb.radius;
          if (dist > 0.001 && dist < minD) {
            const nx = dx / dist;
            const ny = dy / dist;
            bb.x = p.x + nx * minD;
            bb.y = p.y + ny * minD;
            bb.vx = nx * 360 + p.vx * 0.7;
            bb.vy = ny * 360 + p.vy * 0.7;
            bb.lastTouchColor = p.team === 'red' ? '#FF4D2E' : '#00C2FF';
            state.lastTouchPlayerId = p.id;
          }
        }
        if (bb.y < PITCH_TOP + bb.radius) {
          bb.y = PITCH_TOP + bb.radius;
          bb.vy = Math.abs(bb.vy) * 0.85;
        } else if (bb.y > PITCH_BOTTOM - bb.radius) {
          bb.y = PITCH_BOTTOM - bb.radius;
          bb.vy = -Math.abs(bb.vy) * 0.85;
        }
        const inMouth = bb.y > goalTop + bb.radius * 0.5 && bb.y < goalBottom - bb.radius * 0.5;
        if (!inMouth) {
          if (bb.x < PITCH_LEFT + bb.radius) {
            bb.x = PITCH_LEFT + bb.radius;
            bb.vx = Math.abs(bb.vx) * 0.85;
          } else if (bb.x > PITCH_RIGHT - bb.radius) {
            bb.x = PITCH_RIGHT - bb.radius;
            bb.vx = -Math.abs(bb.vx) * 0.85;
          }
        } else if (bb.x < PITCH_LEFT - bb.radius * 0.4) {
          state.scoreBlue += 1;
          state.popups.push({ x: PITCH_LEFT + 60, y: bb.y, text: '+1 GOLD BALL!', colorHex: '#00C2FF', alpha: 1 });
          state.bonusBalls.splice(bi, 1);
          sounds.push({ type: 'lap' });
        } else if (bb.x > PITCH_RIGHT + bb.radius * 0.4) {
          state.scoreRed += 1;
          state.popups.push({ x: PITCH_RIGHT - 60, y: bb.y, text: '+1 GOLD BALL!', colorHex: '#FF4D2E', alpha: 1 });
          state.bonusBalls.splice(bi, 1);
          sounds.push({ type: 'lap' });
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: `${p.team.toUpperCase()} · ${state.scoreRed}-${state.scoreBlue} · ${p.goals}G`,
        cooldownA: Math.min(1, Math.max(0, p.kickCd / KICK_COOLDOWN)),
        cooldownB: Math.min(1, Math.max(0, p.tackleCd / TACKLE_COOLDOWN)),
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

  getSnapshot(state: TurboStrikerInternalState): TurboStrikerSnapshot {
    return toSnapshot(state);
  },

  getRankings(state: TurboStrikerInternalState, players: ServerPlayerInputState[]): RankingEntry[] {
    return buildRankings(state, players);
  },
};
