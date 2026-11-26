import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type RankingEntry,
  type SoundEvent,
  type VolleyPlayerState,
  type VolleySmashSnapshot,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface VolleySmashState {
  targetPoints: number;
  scoreRed: number;
  scoreBlue: number;
  servingTeam: 'red' | 'blue';
  resetTimer: number;
  goalBanner: string | null;
  goalBannerColor: string | null;
  rallyCount: number;
  matchTimeLeft: number;
  suddenDeath: boolean;
  soloHoloTimer: number;
  ball: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    targetX: number;
    targetY: number;
    hot: boolean;
    lastTouchColor: string | null;
    lastTouchTeam: 'red' | 'blue' | null;
  };
  shockwaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: VolleyPlayerState[];
  finished: boolean;
}

const COURT_LEFT = 110;
const COURT_RIGHT = ARENA_WIDTH - 110;
const COURT_TOP = 130;
const COURT_BOTTOM = ARENA_HEIGHT - 95;
const NET_X = ARENA_WIDTH / 2;
const GRAVITY_Z = 290;

function predictBallLanding(ball: VolleySmashState['ball']): { x: number; y: number } {
  const a = -0.5 * GRAVITY_Z;
  const b = ball.vz;
  const c = Math.max(0.1, ball.z);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return { x: ball.x, y: ball.y };
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  const flightT = Math.max(0, Math.min(4.0, t));
  const tx = Math.max(COURT_LEFT + 35, Math.min(COURT_RIGHT - 35, ball.x + ball.vx * flightT));
  const ty = Math.max(COURT_TOP + 35, Math.min(COURT_BOTTOM - 35, ball.y + ball.vy * flightT));
  return { x: tx, y: ty };
}

function resetServe(state: VolleySmashState, servingTeam: 'red' | 'blue'): void {
  state.servingTeam = servingTeam;
  state.rallyCount = 0;
  // In 1P solo mode (no blue players), always serve gently toward the human on Red side
  const hasBlue = state.players.some((p) => p.team === 'blue');
  const fromBlue = !hasBlue || servingTeam === 'blue';
  const startX = fromBlue ? NET_X + 200 : NET_X - 200;
  const dir = fromBlue ? -1 : 1;
  state.ball = {
    x: startX,
    y: (COURT_TOP + COURT_BOTTOM) / 2,
    z: 145,
    vx: dir * 155,
    vy: (Math.random() - 0.5) * 65,
    vz: 165,
    targetX: NET_X + dir * 185,
    targetY: (COURT_TOP + COURT_BOTTOM) / 2,
    hot: false,
    lastTouchColor: fromBlue ? '#00C2FF' : '#FF4D2E',
    lastTouchTeam: fromBlue ? 'blue' : 'red',
  };
  const land = predictBallLanding(state.ball);
  state.ball.targetX = land.x;
  state.ball.targetY = land.y;
}

export const volleySmashModule: ServerGameModule<VolleySmashState> = {
  id: 'volley-smash',

  createState(players: ServerPlayerInputState[], settingValue: number): VolleySmashState {
    const targetPoints = settingValue || 5;
    const pStates: VolleyPlayerState[] = players.map((p, idx) => {
      const team: 'red' | 'blue' = idx % 2 === 0 ? 'red' : 'blue';
      const teamIdx = Math.floor(idx / 2);
      const sideX = team === 'red' ? NET_X - 210 - (teamIdx % 2) * 65 : NET_X + 210 + (teamIdx % 2) * 65;
      const sideY =
        (COURT_TOP + COURT_BOTTOM) / 2 +
        (teamIdx === 0 ? 0 : teamIdx % 2 === 1 ? -90 : 90);
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        team,
        x: sideX,
        y: Math.max(COURT_TOP + 45, Math.min(COURT_BOTTOM - 45, sideY)),
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        spikeTimer: 0,
        setTimer: 0,
        pointsScored: 0,
        saves: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      };
    });

    const state: VolleySmashState = {
      targetPoints,
      scoreRed: 0,
      scoreBlue: 0,
      servingTeam: 'red',
      resetTimer: 0,
      goalBanner: null,
      goalBannerColor: null,
      rallyCount: 0,
      matchTimeLeft: 95,
      suddenDeath: false,
      soloHoloTimer: 0,
      ball: {
        x: NET_X - 180,
        y: (COURT_TOP + COURT_BOTTOM) / 2,
        z: 145,
        vx: 150,
        vy: 0,
        vz: 165,
        targetX: NET_X + 180,
        targetY: (COURT_TOP + COURT_BOTTOM) / 2,
        hot: false,
        lastTouchColor: '#FF4D2E',
        lastTouchTeam: 'red',
      },
      shockwaves: [],
      popups: [],
      players: pStates,
      finished: false,
    };
    resetServe(state, 'red');
    return state;
  },

  step(state: VolleySmashState, players: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(players.map((p) => [p.id, p]));
    const hasBluePlayers = state.players.some((p) => p.team === 'blue');

    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.radius += dt * 270;
      sw.alpha -= dt * 1.9;
      if (sw.alpha <= 0) state.shockwaves.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= dt * 36;
      state.popups[i].alpha -= dt * 1.05;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    if (!state.finished && state.resetTimer <= 0) {
      state.matchTimeLeft = Math.max(0, state.matchTimeLeft - dt);
      if (state.matchTimeLeft <= 0 && !state.suddenDeath) {
        if (state.scoreRed !== state.scoreBlue) {
          state.finished = true;
          sounds.push({ type: 'win' });
        } else {
          state.suddenDeath = true;
          state.goalBanner = 'SUDDEN DEATH · NEXT POINT WINS!';
          state.goalBannerColor = '#FFB800';
        }
      }
    }

    if (state.resetTimer > 0) {
      state.resetTimer -= dt;
      if (state.resetTimer <= 0) {
        state.goalBanner = null;
        state.goalBannerColor = null;
        if (
          state.scoreRed >= state.targetPoints ||
          state.scoreBlue >= state.targetPoints ||
          (state.suddenDeath && state.scoreRed !== state.scoreBlue)
        ) {
          state.finished = true;
        } else {
          resetServe(state, state.servingTeam);
        }
      }
    }

    // Player movement & actions
    for (const p of state.players) {
      const inp = inputMap.get(p.id);
      p.cooldownA = Math.max(0, p.cooldownA - dt * 1.65);
      p.cooldownB = Math.max(0, p.cooldownB - dt * 1.05);
      p.spikeTimer = Math.max(0, p.spikeTimer - dt);
      p.setTimer = Math.max(0, p.setTimer - dt);

      const dx = inp?.input.dx ?? 0;
      const dy = inp?.input.dy ?? 0;
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);

      const moveSpeed = 335;
      p.vx = dx * moveSpeed;
      p.vy = dy * moveSpeed;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.z > 0 || p.vz > 0) {
        p.z += p.vz * dt;
        p.vz -= 640 * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;
        }
      }

      const minX = p.team === 'red' ? COURT_LEFT + 28 : NET_X + 34;
      const maxX = p.team === 'red' ? NET_X - 34 : COURT_RIGHT - 28;
      p.x = Math.max(minX, Math.min(maxX, p.x));
      p.y = Math.max(COURT_TOP + 26, Math.min(COURT_BOTTOM - 26, p.y));

      const distBall = Math.hypot(state.ball.x - p.x, state.ball.y - p.y);
      const onMySide = p.team === 'red' ? state.ball.x <= NET_X + 26 : state.ball.x >= NET_X - 26;

      // Action A: Bump / High Set
      if (justA && p.cooldownA <= 0) {
        p.cooldownA = 1;
        p.setTimer = 0.3;
        if (state.resetTimer <= 0 && onMySide && distBall < 102 && state.ball.z < 135) {
          const targetDir = p.team === 'red' ? 1 : -1;
          const aimX = Math.max(
            COURT_LEFT + 55,
            Math.min(COURT_RIGHT - 55, NET_X + targetDir * (160 + Math.random() * 175) + dx * 85)
          );
          const aimY = Math.max(
            COURT_TOP + 52,
            Math.min(COURT_BOTTOM - 52, p.y + dy * 185)
          );
          const rallyMult = 1 + Math.min(0.85, state.rallyCount * 0.065) + (state.suddenDeath ? 0.3 : 0);
          const flightTime = 1.25 / rallyMult;
          state.ball.vx = (aimX - state.ball.x) / flightTime;
          state.ball.vy = (aimY - state.ball.y) / flightTime;
          state.ball.vz = 230 / Math.sqrt(rallyMult);
          state.ball.z = Math.max(46, state.ball.z);
          state.ball.hot = false;
          state.ball.lastTouchColor = p.colorHex;
          state.ball.lastTouchTeam = p.team;
          state.rallyCount += 1;
          const land = predictBallLanding(state.ball);
          state.ball.targetX = land.x;
          state.ball.targetY = land.y;
          p.saves += 1;
          p.score += 20;
          state.shockwaves.push({
            x: p.x,
            y: p.y,
            radius: 16,
            maxRadius: 76,
            colorHex: '#00C2FF',
            alpha: 0.9,
          });
          sounds.push({ type: 'bump', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 24, reason: 'volley-bump' });
        }
      }

      // Action B: Jump Spike
      if (justB && p.cooldownB <= 0) {
        p.cooldownB = 1;
        p.spikeTimer = 0.36;
        if (p.z === 0) {
          p.vz = 250;
        }
        if (state.resetTimer <= 0 && onMySide && distBall < 112 && state.ball.z < 185) {
          const targetDir = p.team === 'red' ? 1 : -1;
          const aimX = Math.max(
            COURT_LEFT + 55,
            Math.min(COURT_RIGHT - 55, NET_X + targetDir * (190 + Math.random() * 195) + dx * 105)
          );
          const aimY = Math.max(
            COURT_TOP + 48,
            Math.min(COURT_BOTTOM - 48, p.y + dy * 210)
          );
          const rallyMult = 1 + Math.min(0.85, state.rallyCount * 0.065) + (state.suddenDeath ? 0.3 : 0);
          const flightTime = 0.84 / rallyMult;
          state.ball.vx = (aimX - state.ball.x) / flightTime;
          state.ball.vy = (aimY - state.ball.y) / flightTime;
          state.ball.vz = 152 / Math.sqrt(rallyMult);
          state.ball.z = Math.max(62, state.ball.z);
          state.ball.hot = true;
          state.ball.lastTouchColor = p.colorHex;
          state.ball.lastTouchTeam = p.team;
          state.rallyCount += 1;
          const land = predictBallLanding(state.ball);
          state.ball.targetX = land.x;
          state.ball.targetY = land.y;
          p.saves += 1;
          p.score += 35;
          state.shockwaves.push({
            x: state.ball.x,
            y: state.ball.y,
            radius: 22,
            maxRadius: 102,
            colorHex: '#FF4D2E',
            alpha: 1,
          });
          state.popups.push({
            x: p.x,
            y: p.y - 38,
            text: 'TURBO SPIKE!',
            colorHex: '#FFB800',
            alpha: 1,
          });
          sounds.push({ type: 'boost', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: [35, 20, 55], reason: 'volley-spike' });
        }
      }

      // Forgiving Auto-Bump when directly under a descending ball (tightens during hot rallies)
      const autoRadius = state.rallyCount >= 5 ? 30 : 44;
      if (
        state.resetTimer <= 0 &&
        onMySide &&
        distBall < autoRadius &&
        state.ball.z < 42 &&
        state.ball.vz < 0
      ) {
        const targetDir = p.team === 'red' ? 1 : -1;
        const aimX = NET_X + targetDir * (165 + Math.random() * 165);
        const aimY = Math.max(
          COURT_TOP + 58,
          Math.min(COURT_BOTTOM - 58, p.y + (Math.random() - 0.5) * 140)
        );
        const rallyMult = 1 + Math.min(0.85, state.rallyCount * 0.065) + (state.suddenDeath ? 0.3 : 0);
        const flightTime = 1.28 / rallyMult;
        state.ball.vx = (aimX - state.ball.x) / flightTime;
        state.ball.vy = (aimY - state.ball.y) / flightTime;
        state.ball.vz = 225 / Math.sqrt(rallyMult);
        state.ball.z = 46;
        state.ball.hot = false;
        state.ball.lastTouchColor = p.colorHex;
        state.ball.lastTouchTeam = p.team;
        state.rallyCount += 1;
        const land = predictBallLanding(state.ball);
        state.ball.targetX = land.x;
        state.ball.targetY = land.y;
        p.saves += 1;
        p.score += 15;
        sounds.push({ type: 'bump', playerId: p.id });
      }
    }

    // Ball physics
    if (state.resetTimer <= 0) {
      const prevX = state.ball.x;
      state.ball.x += state.ball.vx * dt;
      state.ball.y += state.ball.vy * dt;
      state.ball.z += state.ball.vz * dt;
      state.ball.vz -= GRAVITY_Z * dt;

      // Net top clip rebound if ball crosses net too low (z < 36)
      if ((prevX < NET_X && state.ball.x >= NET_X) || (prevX > NET_X && state.ball.x <= NET_X)) {
        if (state.ball.z < 34) {
          state.ball.vz = Math.max(125, state.ball.vz + 95);
          state.ball.vx *= 0.85;
          sounds.push({ type: 'bump' });
        }
      }

      // Court boundary rebounds
      if (state.ball.y < COURT_TOP + 24) {
        state.ball.y = COURT_TOP + 24;
        state.ball.vy = Math.abs(state.ball.vy) * 0.85;
      } else if (state.ball.y > COURT_BOTTOM - 24) {
        state.ball.y = COURT_BOTTOM - 24;
        state.ball.vy = -Math.abs(state.ball.vy) * 0.85;
      }
      if (state.ball.x < COURT_LEFT + 24) {
        state.ball.x = COURT_LEFT + 24;
        state.ball.vx = Math.abs(state.ball.vx) * 0.78;
      } else if (state.ball.x > COURT_RIGHT - 24) {
        state.ball.x = COURT_RIGHT - 24;
        state.ball.vx = -Math.abs(state.ball.vx) * 0.78;
      }

      // Solo 1P Mode: Automated Holo-Keeper returns normal shots on Blue side (spiked shots can beat it!)
      if (!hasBluePlayers && state.ball.x > NET_X + 40 && state.ball.z < 42 && state.ball.vz < 0) {
        const beatKeeper = state.ball.hot && Math.random() < 0.72;
        if (!beatKeeper) {
          const aimX = COURT_LEFT + 75 + Math.random() * (NET_X - COURT_LEFT - 140);
          const aimY = COURT_TOP + 65 + Math.random() * (COURT_BOTTOM - COURT_TOP - 130);
          const flightTime = 1.25;
          state.ball.vx = (aimX - state.ball.x) / flightTime;
          state.ball.vy = (aimY - state.ball.y) / flightTime;
          state.ball.vz = 225;
          state.ball.z = 44;
          state.ball.hot = false;
          state.ball.lastTouchColor = '#00C2FF';
          state.ball.lastTouchTeam = 'blue';
          state.shockwaves.push({
            x: state.ball.x,
            y: state.ball.y,
            radius: 16,
            maxRadius: 72,
            colorHex: '#00C2FF',
            alpha: 0.9,
          });
          state.popups.push({
            x: state.ball.x,
            y: state.ball.y - 26,
            text: 'HOLO RETURN!',
            colorHex: '#00C2FF',
            alpha: 0.95,
          });
          sounds.push({ type: 'bump' });
        }
      }

      const land = predictBallLanding(state.ball);
      state.ball.targetX = land.x;
      state.ball.targetY = land.y;

      // Ball touches the sand -> Point scored!
      if (state.ball.z <= 0) {
        state.ball.z = 0;
        const landedOnRed = state.ball.x < NET_X;
        const scoringTeam: 'red' | 'blue' = landedOnRed ? 'blue' : 'red';
        if (scoringTeam === 'red') {
          state.scoreRed += 1;
          state.goalBanner = `RED TEAM POINT! (${state.scoreRed}-${state.scoreBlue})`;
          state.goalBannerColor = '#FF4D2E';
        } else {
          state.scoreBlue += 1;
          state.goalBanner = `BLUE TEAM POINT! (${state.scoreRed}-${state.scoreBlue})`;
          state.goalBannerColor = '#00C2FF';
        }
        state.servingTeam = scoringTeam;
        state.resetTimer = state.suddenDeath ? 0.6 : 1.35;

        for (const p of state.players) {
          if (p.team === scoringTeam) {
            p.pointsScored += 1;
            p.score += 110;
          }
        }
        state.shockwaves.push({
          x: state.ball.x,
          y: state.ball.y,
          radius: 18,
          maxRadius: 115,
          colorHex: scoringTeam === 'red' ? '#FF4D2E' : '#00C2FF',
          alpha: 1,
        });
        sounds.push({ type: 'lap' });
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: `${p.team.toUpperCase()} · ${state.scoreRed}-${state.scoreBlue} · ${p.score} pts`,
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

  getSnapshot(state: VolleySmashState): VolleySmashSnapshot {
    return {
      gameId: 'volley-smash',
      targetPoints: state.targetPoints,
      scoreRed: state.scoreRed,
      scoreBlue: state.scoreBlue,
      servingTeam: state.servingTeam,
      goalBanner: state.goalBanner,
      goalBannerColor: state.goalBannerColor,
      ball: {
        x: state.ball.x,
        y: state.ball.y,
        z: state.ball.z,
        vx: state.ball.vx,
        vy: state.ball.vy,
        vz: state.ball.vz,
        targetX: state.ball.targetX,
        targetY: state.ball.targetY,
        hot: state.ball.hot,
        lastTouchColor: state.ball.lastTouchColor,
      },
      shockwaves: state.shockwaves,
      popups: state.popups,
      players: state.players,
    };
  },

  getRankings(state: VolleySmashState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort((a, b) => b.score - a.score);
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: p.score,
      highlight: `${p.team.toUpperCase()} Team · ${p.pointsScored} pts · ${p.saves} touches`,
    }));
  },
};
