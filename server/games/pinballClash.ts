import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type PinballBallState,
  type PinballClashSnapshot,
  type PinballPlayerState,
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

interface InternalFlipper extends PinballPlayerState {
  flipCd: number;
  bumpCd: number;
}

interface PinballState {
  targetGoals: number;
  scoreLeft: number;
  scoreRight: number;
  goalBanner: string | null;
  goalBannerColor: string | null;
  pauseTimer: number;
  multiballCharge: number;
  bumpers: { x: number; y: number; r: number; value: number; flash: number; colorHex: string }[];
  balls: PinballBallState[];
  players: InternalFlipper[];
  nextId: number;
  finished: boolean;
}

const TABLE_TOP = 64;
const TABLE_BOTTOM = ARENA_HEIGHT - 64;
const TABLE_LEFT = 64;
const TABLE_RIGHT = ARENA_WIDTH - 64;
const GOAL_HALF = 148;
const PADDLE_H = 112;

function spawnBall(nextId: number, toward: 'left' | 'right', golden = false): PinballBallState {
  const dir = toward === 'right' ? 1 : -1;
  const ang = (Math.random() - 0.5) * 0.7;
  const spd = golden ? 470 : 410;
  return {
    id: `pb_${nextId}`,
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT / 2 + (golden ? (Math.random() - 0.5) * 80 : 0),
    vx: Math.cos(ang) * spd * dir,
    vy: Math.sin(ang) * spd,
    r: golden ? 14 : 16,
    golden,
    lastTouchColor: golden ? '#FFB800' : null,
    trail: [],
  };
}

export const pinballClashModule: ServerGameModule<PinballState> = {
  id: 'pinball-clash',

  createState(players, settingValue) {
    const targetGoals = Math.max(3, Math.min(9, settingValue || 5));
    const list: InternalFlipper[] = players.map((p, idx) => {
      const side: 'left' | 'right' = idx % 2 === 0 ? 'left' : 'right';
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        side,
        isBot: p.isBot,
        x: side === 'left' ? TABLE_LEFT + 76 : TABLE_RIGHT - 76,
        y: ARENA_HEIGHT / 2,
        flipTimer: 0,
        bumpTimer: 0,
        goals: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        flipCd: 0,
        bumpCd: 0,
      };
    });

    return {
      targetGoals,
      scoreLeft: 0,
      scoreRight: 0,
      goalBanner: null,
      goalBannerColor: null,
      pauseTimer: 0,
      multiballCharge: 0,
      bumpers: [
        { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, r: 36, value: 100, flash: 0, colorHex: '#FFB800' },
        { x: ARENA_WIDTH / 2 - 140, y: TABLE_TOP + 135, r: 28, value: 60, flash: 0, colorHex: '#00C2FF' },
        { x: ARENA_WIDTH / 2 + 140, y: TABLE_TOP + 135, r: 28, value: 60, flash: 0, colorHex: '#FF4D2E' },
        { x: ARENA_WIDTH / 2 - 140, y: TABLE_BOTTOM - 135, r: 28, value: 60, flash: 0, colorHex: '#FF3B9A' },
        { x: ARENA_WIDTH / 2 + 140, y: TABLE_BOTTOM - 135, r: 28, value: 60, flash: 0, colorHex: '#10D98B' },
      ],
      balls: [spawnBall(1, Math.random() < 0.5 ? 'left' : 'right')],
      players: list,
      nextId: 2,
      finished: false,
    };
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (const b of state.bumpers) {
      b.flash = Math.max(0, b.flash - dt * 3.5);
    }

    if (state.pauseTimer > 0) {
      state.pauseTimer -= dt;
      if (state.pauseTimer <= 0) {
        state.goalBanner = null;
        if (state.balls.length === 0) {
          state.balls.push(spawnBall(state.nextId++, Math.random() < 0.5 ? 'left' : 'right'));
        }
      }
    } else if (!state.finished) {
      // Update flippers
      for (const p of state.players) {
        p.flipTimer = Math.max(0, p.flipTimer - dt);
        p.bumpTimer = Math.max(0, p.bumpTimer - dt);
        p.flipCd = Math.max(0, p.flipCd - dt);
        p.bumpCd = Math.max(0, p.bumpCd - dt);

        const inp = players.find((x) => x.id === p.id);
        if (!inp) continue;
        const { dy, a, b } = inp.input;
        if (Math.abs(dy) > 0.08) {
          p.y = Math.max(TABLE_TOP + PADDLE_H / 2 + 14, Math.min(TABLE_BOTTOM - PADDLE_H / 2 - 14, p.y + dy * 470 * dt));
        }

        if (a && !inp.prevA && p.flipCd <= 0) {
          p.flipTimer = 0.22;
          p.flipCd = 0.45;
          sounds.push({ type: 'confirm', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 16, reason: 'flip' });
        }

        if (b && !inp.prevB && p.bumpCd <= 0) {
          p.bumpTimer = 0.3;
          p.bumpCd = 2.0;
          sounds.push({ type: 'pulse', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 22, reason: 'bump-wave' });
          for (const ball of state.balls) {
            const d = Math.hypot(ball.x - p.x, ball.y - p.y);
            if (d < 175) {
              const dir = p.side === 'left' ? 1 : -1;
              ball.vx = dir * Math.max(540, Math.abs(ball.vx) * 1.15);
              ball.vy += ((ball.y - p.y) / 90) * 180;
              ball.lastTouchColor = p.colorHex;
            }
          }
        }
      }

      // Move balls
      for (let i = state.balls.length - 1; i >= 0; i--) {
        const ball = state.balls[i];
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 10) ball.trail.shift();

        // Top & Bottom table walls
        if (ball.y - ball.r < TABLE_TOP) {
          ball.y = TABLE_TOP + ball.r;
          ball.vy = Math.abs(ball.vy);
          sounds.push({ type: 'nav' });
        } else if (ball.y + ball.r > TABLE_BOTTOM) {
          ball.y = TABLE_BOTTOM - ball.r;
          ball.vy = -Math.abs(ball.vy);
          sounds.push({ type: 'nav' });
        }

        // Left & Right side walls outside goal opening (and solo wall on right if 1 player!)
        const inGoalY = Math.abs(ball.y - ARENA_HEIGHT / 2) < GOAL_HALF;
        const hasRightPlayer = state.players.some((p) => p.side === 'right');

        if (ball.x - ball.r < TABLE_LEFT) {
          if (inGoalY) {
            // Right side scored!
            state.scoreRight++;
            for (const p of state.players) {
              if (p.side === 'right') {
                p.goals++;
                p.score += ball.golden ? 200 : 120;
              }
            }
            state.balls.splice(i, 1);
            sounds.push({ type: 'win' });
            if (state.balls.length === 0) {
              state.goalBanner = hasRightPlayer ? 'RIGHT GOAL!' : 'BALL LOST!';
              state.goalBannerColor = '#FF4D2E';
              state.pauseTimer = 1.25;
            }
            continue;
          } else {
            ball.x = TABLE_LEFT + ball.r;
            ball.vx = Math.abs(ball.vx);
            sounds.push({ type: 'bump' });
          }
        } else if (ball.x + ball.r > TABLE_RIGHT) {
          if (inGoalY && hasRightPlayer) {
            // Left side scored!
            state.scoreLeft++;
            for (const p of state.players) {
              if (p.side === 'left') {
                p.goals++;
                p.score += ball.golden ? 200 : 120;
              }
            }
            state.balls.splice(i, 1);
            sounds.push({ type: 'win' });
            if (state.balls.length === 0) {
              state.goalBanner = 'LEFT GOAL!';
              state.goalBannerColor = '#00C2FF';
              state.pauseTimer = 1.25;
            }
            continue;
          } else {
            // Solo bounce wall on right counts as goal if inGoalY!
            if (inGoalY && !hasRightPlayer) {
              state.scoreLeft++;
              for (const p of state.players) {
                if (p.side === 'left') {
                  p.goals++;
                  p.score += 150;
                }
              }
              sounds.push({ type: 'lap' });
            }
            ball.x = TABLE_RIGHT - ball.r;
            ball.vx = -Math.abs(ball.vx);
            sounds.push({ type: 'bump' });
          }
        }

        // Bumper collisions
        for (const bm of state.bumpers) {
          const dx = ball.x - bm.x;
          const dy = ball.y - bm.y;
          const d = Math.hypot(dx, dy);
          if (d < ball.r + bm.r && d > 0.01) {
            const nx = dx / d;
            const ny = dy / d;
            ball.x = bm.x + nx * (ball.r + bm.r + 2);
            ball.y = bm.y + ny * (ball.r + bm.r + 2);
            const spd = Math.min(720, Math.max(460, Math.hypot(ball.vx, ball.vy) * 1.08));
            ball.vx = nx * spd;
            ball.vy = ny * spd;
            bm.flash = 1;
            state.multiballCharge = Math.min(1, state.multiballCharge + 0.2);
            sounds.push({ type: 'pickup' });

            // Award bumper points to last toucher
            const hitter = state.players.find((p) => p.colorHex === ball.lastTouchColor);
            if (hitter) hitter.score += bm.value;

            // Trigger Golden Multiball!
            if (state.multiballCharge >= 1 && state.balls.length < 2) {
              state.multiballCharge = 0;
              state.balls.push(spawnBall(state.nextId++, Math.random() < 0.5 ? 'left' : 'right', true));
              state.goalBanner = 'GOLDEN MULTIBALL!';
              state.goalBannerColor = '#FFB800';
              sounds.push({ type: 'boost' });
            }
          }
        }

        // Flipper collisions
        for (const p of state.players) {
          const hitX = Math.abs(ball.x - p.x) < ball.r + 18;
          const hitY = Math.abs(ball.y - p.y) < PADDLE_H / 2 + ball.r;
          if (hitX && hitY) {
            const dir = p.side === 'left' ? 1 : -1;
            const relY = (ball.y - p.y) / (PADDLE_H / 2);
            const isSnap = p.flipTimer > 0;
            const spd = isSnap ? 690 : 480;
            ball.x = p.x + dir * (ball.r + 20);
            ball.vx = dir * Math.cos(relY * 0.72) * spd;
            ball.vy = Math.sin(relY * 0.82) * spd;
            ball.lastTouchColor = p.colorHex;
            p.score += isSnap ? 35 : 15;
            sounds.push({ type: isSnap ? 'boost' : 'bump', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: isSnap ? 28 : 14, reason: 'flipper-hit' });
          }
        }

        // Prevent flat vertical stalling
        if (Math.abs(ball.vx) < 160) {
          ball.vx = (ball.vx >= 0 ? 1 : -1) * 210;
        }
      }

      if (state.scoreLeft >= state.targetGoals || state.scoreRight >= state.targetGoals) {
        state.finished = true;
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      p.cooldownA = Math.min(1, p.flipCd / 0.45);
      p.cooldownB = Math.min(1, p.bumpCd / 2.0);
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: `${p.goals} goals · ${p.score} pts`,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state): PinballClashSnapshot {
    return {
      gameId: 'pinball-clash',
      targetGoals: state.targetGoals,
      scoreLeft: state.scoreLeft,
      scoreRight: state.scoreRight,
      goalBanner: state.goalBanner,
      goalBannerColor: state.goalBannerColor,
      multiballCharge: state.multiballCharge,
      bumpers: state.bumpers.map((b) => ({ ...b })),
      balls: state.balls.map((b) => ({ ...b, trail: b.trail.map((pt) => ({ ...pt })) })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        side: p.side,
        isBot: p.isBot,
        x: p.x,
        y: p.y,
        flipTimer: p.flipTimer,
        bumpTimer: p.bumpTimer,
        goals: p.goals,
        score: p.score,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => b.goals - a.goals || b.score - a.score);
    return sorted.map((pp, idx) => {
      const meta = players.find((p) => p.id === pp.id);
      return {
        playerId: pp.id,
        slotIndex: pp.slotIndex,
        name: pp.name,
        color: meta?.color ?? {
          id: 'cyan',
          name: 'Cyan',
          hex: pp.colorHex,
          dark: '#007FA8',
          textOnColor: '#0B1219',
        },
        rank: idx + 1,
        score: pp.score,
        highlight: `${pp.goals} goals · ${pp.score} pts`,
      };
    });
  },
};
