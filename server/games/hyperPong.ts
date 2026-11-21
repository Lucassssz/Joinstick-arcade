import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type HyperPongPaddleState,
  type HyperPongSnapshot,
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

interface InternalPaddle extends HyperPongPaddleState {
  vx: number;
  vy: number;
  smashCd: number;
  magnetCd: number;
}

interface HyperPongState {
  targetScore: number;
  scoreLeft: number;
  scoreRight: number;
  goalBanner: string | null;
  goalBannerColor: string | null;
  goalPauseTimer: number;
  puck: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    hot: boolean;
    trail: { x: number; y: number }[];
  };
  bumpers: { x: number; y: number; r: number; flash: number }[];
  paddles: InternalPaddle[];
}

const COURT_TOP = 54;
const COURT_BOTTOM = ARENA_HEIGHT - 54;
const COURT_LEFT = 54;
const COURT_RIGHT = ARENA_WIDTH - 54;
const GOAL_HALF = 128;
const PADDLE_R = 34;
const PUCK_R = 19;
const SMASH_CD = 1.4;
const MAGNET_CD = 2.4;

function resetPuck(state: HyperPongState, towardSide: 'left' | 'right') {
  const dir = towardSide === 'right' ? 1 : -1;
  const ang = (Math.random() - 0.5) * 0.55;
  state.puck.x = ARENA_WIDTH / 2;
  state.puck.y = ARENA_HEIGHT / 2;
  state.puck.vx = Math.cos(ang) * 380 * dir;
  state.puck.vy = Math.sin(ang) * 380;
  state.puck.hot = false;
  state.puck.trail = [];
}

export const hyperPongModule: ServerGameModule<HyperPongState> = {
  id: 'hyper-pong',

  createState(players, settingValue) {
    const targetScore = Math.max(3, Math.min(11, settingValue || 5));
    const paddles: InternalPaddle[] = [];
    const leftCount = Math.ceil(players.length / 2);
    const rightCount = Math.floor(players.length / 2);

    players.forEach((p, idx) => {
      const side: 'left' | 'right' = idx % 2 === 0 ? 'left' : 'right';
      const sideIndex = Math.floor(idx / 2);
      const sideTotal = side === 'left' ? leftCount : rightCount;
      const yFrac = sideTotal <= 1 ? 0.5 : (sideIndex + 1) / (sideTotal + 1);
      paddles.push({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        side,
        isBot: p.isBot,
        x: side === 'left' ? 210 : ARENA_WIDTH - 210,
        y: COURT_TOP + 60 + yFrac * (COURT_BOTTOM - COURT_TOP - 120),
        vx: 0,
        vy: 0,
        radius: PADDLE_R,
        smashTimer: 0,
        magnetTimer: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        smashCd: 0,
        magnetCd: 0,
      });
    });

    const state: HyperPongState = {
      targetScore,
      scoreLeft: 0,
      scoreRight: 0,
      goalBanner: null,
      goalBannerColor: null,
      goalPauseTimer: 0,
      puck: { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: 0, vy: 0, radius: PUCK_R, hot: false, trail: [] },
      bumpers: [
        { x: ARENA_WIDTH / 2, y: COURT_TOP + 58, r: 24, flash: 0 },
        { x: ARENA_WIDTH / 2, y: COURT_BOTTOM - 58, r: 24, flash: 0 },
      ],
      paddles,
    };
    resetPuck(state, Math.random() < 0.5 ? 'left' : 'right');
    return state;
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};

    const inputById = new Map(players.map((p) => [p.id, p]));

    for (const b of state.bumpers) {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 3);
    }

    if (state.goalPauseTimer > 0) {
      state.goalPauseTimer = Math.max(0, state.goalPauseTimer - dt);
      if (state.goalPauseTimer <= 0) {
        state.goalBanner = null;
        state.goalBannerColor = null;
      }
    }

    // Move paddles
    for (const pad of state.paddles) {
      pad.smashCd = Math.max(0, pad.smashCd - dt);
      pad.magnetCd = Math.max(0, pad.magnetCd - dt);
      pad.smashTimer = Math.max(0, pad.smashTimer - dt);
      pad.magnetTimer = Math.max(0, pad.magnetTimer - dt);

      let dx = 0;
      let dy = 0;
      let pressA = false;
      let pressB = false;

      const inp = inputById.get(pad.id);
      if (inp) {
        dx = inp.input.dx;
        dy = inp.input.dy;
        pressA = inp.input.a && !inp.prevA;
        pressB = inp.input.b && !inp.prevB;
      }

      if (pressA && pad.smashCd <= 0) {
        pad.smashTimer = 0.28;
        pad.smashCd = SMASH_CD;
        if (!pad.isBot) {
          sounds.push({ type: 'boost', playerId: pad.id });
          haptics.push({ playerId: pad.id, pattern: 22, reason: 'smash' });
        }
      }

      if (pressB && pad.magnetCd <= 0) {
        pad.magnetTimer = 0.7;
        pad.magnetCd = MAGNET_CD;
        if (!pad.isBot) {
          sounds.push({ type: 'pulse', playerId: pad.id });
          haptics.push({ playerId: pad.id, pattern: [18, 20, 22], reason: 'magnet' });
        }
      }

      const speed = 540;
      const targetVx = dx * speed;
      const targetVy = dy * speed;
      pad.vx += (targetVx - pad.vx) * Math.min(1, 18 * dt);
      pad.vy += (targetVy - pad.vy) * Math.min(1, 18 * dt);

      pad.x += pad.vx * dt;
      pad.y += pad.vy * dt;

      // Clamp to player's half of the court
      const minX = pad.side === 'left' ? COURT_LEFT + pad.radius : ARENA_WIDTH / 2 + pad.radius + 8;
      const maxX = pad.side === 'left' ? ARENA_WIDTH / 2 - pad.radius - 8 : COURT_RIGHT - pad.radius;
      pad.x = Math.max(minX, Math.min(maxX, pad.x));
      pad.y = Math.max(COURT_TOP + pad.radius, Math.min(COURT_BOTTOM - pad.radius, pad.y));

      pad.cooldownA = pad.smashCd / SMASH_CD;
      pad.cooldownB = pad.magnetCd / MAGNET_CD;
    }

    // Update puck when not paused for a goal celebration
    if (state.goalPauseTimer <= 0) {
      const puck = state.puck;

      // Magnet gentle pull / spin
      for (const pad of state.paddles) {
        if (pad.magnetTimer > 0) {
          const dx = pad.x - puck.x;
          const dy = pad.y - puck.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 260) {
            puck.vx += (dx / d) * 650 * dt;
            puck.vy += (dy / d) * 650 * dt;
          }
        }
      }

      puck.x += puck.vx * dt;
      puck.y += puck.vy * dt;
      // Mild air friction while keeping minimum rally energy
      puck.vx *= 1 - 0.12 * dt;
      puck.vy *= 1 - 0.12 * dt;
      const spd = Math.hypot(puck.vx, puck.vy);
      if (spd < 290 && spd > 1) {
        puck.vx = (puck.vx / spd) * 290;
        puck.vy = (puck.vy / spd) * 290;
      } else if (spd > 960) {
        puck.vx = (puck.vx / spd) * 960;
        puck.vy = (puck.vy / spd) * 960;
      }

      puck.trail.push({ x: puck.x, y: puck.y });
      if (puck.trail.length > 10) puck.trail.shift();

      // Top/bottom court walls
      if (puck.y - puck.radius < COURT_TOP) {
        puck.y = COURT_TOP + puck.radius;
        puck.vy = Math.abs(puck.vy);
        sounds.push({ type: 'bump', intensity: 0.35 });
      } else if (puck.y + puck.radius > COURT_BOTTOM) {
        puck.y = COURT_BOTTOM - puck.radius;
        puck.vy = -Math.abs(puck.vy);
        sounds.push({ type: 'bump', intensity: 0.35 });
      }

      // Goal mouth vs side walls
      const inGoalY = Math.abs(puck.y - ARENA_HEIGHT / 2) < GOAL_HALF;
      if (puck.x - puck.radius < COURT_LEFT) {
        if (inGoalY) {
          state.scoreRight += 1;
          const rightPad = state.paddles.find((p) => p.side === 'right');
          if (rightPad) rightPad.score = state.scoreRight;
          state.goalBanner = `${rightPad?.name ?? 'Right'} SCORES!`;
          state.goalBannerColor = rightPad?.colorHex ?? '#00C2FF';
          state.goalPauseTimer = 1.35;
          resetPuck(state, 'left');
          sounds.push({ type: 'lap' });
          for (const pl of players) haptics.push({ playerId: pl.id, pattern: [50, 35, 70], reason: 'goal' });
        } else {
          puck.x = COURT_LEFT + puck.radius;
          puck.vx = Math.abs(puck.vx);
          sounds.push({ type: 'bump', intensity: 0.4 });
        }
      } else if (puck.x + puck.radius > COURT_RIGHT) {
        if (inGoalY) {
          state.scoreLeft += 1;
          const leftPad = state.paddles.find((p) => p.side === 'left');
          if (leftPad) leftPad.score = state.scoreLeft;
          state.goalBanner = `${leftPad?.name ?? 'Left'} SCORES!`;
          state.goalBannerColor = leftPad?.colorHex ?? '#FF4D2E';
          state.goalPauseTimer = 1.35;
          resetPuck(state, 'right');
          sounds.push({ type: 'lap' });
          for (const pl of players) haptics.push({ playerId: pl.id, pattern: [50, 35, 70], reason: 'goal' });
        } else {
          puck.x = COURT_RIGHT - puck.radius;
          puck.vx = -Math.abs(puck.vx);
          sounds.push({ type: 'bump', intensity: 0.4 });
        }
      }

      // Bumpers
      for (const b of state.bumpers) {
        const dx = puck.x - b.x;
        const dy = puck.y - b.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minD = puck.radius + b.r;
        if (dist < minD) {
          const nx = dx / dist;
          const ny = dy / dist;
          puck.x = b.x + nx * minD;
          puck.y = b.y + ny * minD;
          const s = Math.max(460, Math.hypot(puck.vx, puck.vy) * 1.08);
          puck.vx = nx * s;
          puck.vy = ny * s;
          b.flash = 1;
          sounds.push({ type: 'bump', intensity: 0.6 });
        }
      }

      // Paddle collisions
      for (const pad of state.paddles) {
        const dx = puck.x - pad.x;
        const dy = puck.y - pad.y;
        const dist = Math.hypot(dx, dy) || 1;
        const minD = puck.radius + pad.radius;
        if (dist < minD) {
          const nx = dx / dist;
          const ny = dy / dist;
          puck.x = pad.x + nx * (minD + 2);
          puck.y = pad.y + ny * (minD + 2);

          const isSmash = pad.smashTimer > 0;
          const baseSpeed = Math.max(520, Math.hypot(puck.vx, puck.vy) * 1.06);
          const launchSpeed = isSmash ? Math.min(920, baseSpeed + 280) : Math.min(780, baseSpeed);
          puck.vx = nx * launchSpeed + pad.vx * 0.45;
          puck.vy = ny * launchSpeed + pad.vy * 0.45;
          puck.hot = isSmash;
          sounds.push({ type: isSmash ? 'pulse' : 'bump', playerId: pad.id, intensity: isSmash ? 1 : 0.7 });
          if (!pad.isBot) {
            haptics.push({ playerId: pad.id, pattern: isSmash ? [40, 25, 45] : 22, reason: 'paddle-hit' });
          }
        }
      }
    }

    for (const p of players) {
      const pad = state.paddles.find((pd) => pd.id === p.id);
      if (!pad) continue;
      hudUpdates[p.id] = {
        score: pad.side === 'left' ? state.scoreLeft : state.scoreRight,
        alive: true,
        statText: `${state.scoreLeft} – ${state.scoreRight}`,
        cooldownA: pad.cooldownA,
        cooldownB: pad.cooldownB,
      };
    }

    const finished =
      (state.scoreLeft >= state.targetScore || state.scoreRight >= state.targetScore) &&
      state.goalPauseTimer <= 0.1;

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished,
      rankings: finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state): HyperPongSnapshot {
    return {
      gameId: 'hyper-pong',
      targetScore: state.targetScore,
      scoreLeft: state.scoreLeft,
      scoreRight: state.scoreRight,
      goalBanner: state.goalBanner,
      goalBannerColor: state.goalBannerColor,
      puck: {
        ...state.puck,
        trail: [...state.puck.trail],
      },
      bumpers: state.bumpers.map((b) => ({ ...b })),
      players: state.paddles.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        side: p.side,
        isBot: p.isBot,
        x: p.x,
        y: p.y,
        radius: p.radius,
        smashTimer: p.smashTimer,
        magnetTimer: p.magnetTimer,
        score: p.side === 'left' ? state.scoreLeft : state.scoreRight,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const entries = players.map((p) => {
      const pad = state.paddles.find((pd) => pd.id === p.id);
      const s = pad?.side === 'left' ? state.scoreLeft : state.scoreRight;
      return { p, score: s };
    });
    entries.sort((a, b) => b.score - a.score);
    return entries.map(({ p, score }, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      rank: idx + 1,
      score,
      highlight: `${score} goals (${state.scoreLeft}–${state.scoreRight})`,
    }));
  },
};
