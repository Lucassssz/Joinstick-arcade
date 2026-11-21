import {
  ARENA_HEIGHT,
  type RankingEntry,
  type RedLightDashSnapshot,
  type RedLightPlayerState,
  type SoundEvent,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface InternalRunner extends RedLightPlayerState {
  sprintCd: number;
  shieldCd: number;
  mudTimer: number;
}

interface RedLightState {
  round: number;
  totalRounds: number;
  roundTimer: number;
  roundPause: number;
  lightState: 'green' | 'yellow' | 'red';
  lightTimer: number;
  redGrace: number;
  finishCount: number;
  banner: string | null;
  zapLines: { x: number; y: number; alpha: number }[];
  puddles: { id: string; x: number; y: number; rx: number; ry: number }[];
  apples: { id: string; x: number; y: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: InternalRunner[];
  finished: boolean;
}

const START_X = 110;
const FINISH_X = 1045;
const TRACK_TOP = 115;
const TRACK_BOTTOM = ARENA_HEIGHT - 85;
const ROUND_TIME = 35;

function resetRace(state: RedLightState): void {
  state.roundTimer = ROUND_TIME;
  state.roundPause = 0;
  state.lightState = 'green';
  state.lightTimer = 2.4 + Math.random() * 1.4;
  state.redGrace = 0;
  state.finishCount = 0;
  state.banner = `RACE ${state.round} — GO!`;
  state.zapLines = [];
  state.popups = [];
  state.puddles = Array.from({ length: 5 }, (_, i) => ({
    id: `mud_${i}`,
    x: START_X + 160 + i * 165 + (Math.random() - 0.5) * 55,
    y: TRACK_TOP + 38 + Math.random() * (TRACK_BOTTOM - TRACK_TOP - 76),
    rx: 40 + Math.random() * 14,
    ry: 24 + Math.random() * 8,
  }));
  state.apples = Array.from({ length: 4 }, (_, i) => ({
    id: `ap_${i}`,
    x: START_X + 210 + i * 195 + (Math.random() - 0.5) * 50,
    y: TRACK_TOP + 34 + Math.random() * (TRACK_BOTTOM - TRACK_TOP - 68),
  }));
  const count = Math.max(1, state.players.length);
  state.players.forEach((p, idx) => {
    const frac = count === 1 ? 0.5 : (idx + 0.5) / count;
    p.x = START_X;
    p.y = TRACK_TOP + frac * (TRACK_BOTTOM - TRACK_TOP);
    p.vx = 0;
    p.vy = 0;
    p.sprintTimer = 0;
    p.shieldTimer = 0;
    p.zappedTimer = 0;
    p.mudTimer = 0;
    p.finished = false;
    p.finishOrder = 0;
    p.sprintCd = 0;
    p.shieldCd = 0;
  });
}

export const redLightDashModule: ServerGameModule<RedLightState> = {
  id: 'red-light-dash',

  createState(players, settingValue) {
    const totalRounds = Math.max(1, Math.min(5, settingValue || 3));
    const list: InternalRunner[] = players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: START_X,
      y: ARENA_HEIGHT / 2,
      vx: 0,
      vy: 0,
      sprintTimer: 0,
      shieldTimer: 0,
      zappedTimer: 0,
      mudTimer: 0,
      finished: false,
      finishOrder: 0,
      score: 0,
      cooldownA: 0,
      cooldownB: 0,
      sprintCd: 0,
      shieldCd: 0,
    }));

    const state: RedLightState = {
      round: 1,
      totalRounds,
      roundTimer: ROUND_TIME,
      roundPause: 0,
      lightState: 'green',
      lightTimer: 2.8,
      redGrace: 0,
      finishCount: 0,
      banner: null,
      zapLines: [],
      puddles: [],
      apples: [],
      popups: [],
      players: list,
      finished: false,
    };
    resetRace(state);
    return state;
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (let i = state.zapLines.length - 1; i >= 0; i--) {
      state.zapLines[i].alpha -= dt * 2.5;
      if (state.zapLines[i].alpha <= 0) state.zapLines.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= 34 * dt;
      state.popups[i].alpha -= dt * 0.9;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    if (state.roundPause > 0) {
      state.roundPause -= dt;
      if (state.roundPause <= 0) {
        if (state.round >= state.totalRounds) {
          state.finished = true;
        } else {
          state.round++;
          resetRace(state);
          sounds.push({ type: 'go' });
        }
      }
    } else if (!state.finished) {
      state.roundTimer = Math.max(0, state.roundTimer - dt);
      if (state.roundTimer < ROUND_TIME - 1.2) state.banner = null;

      // Traffic light cycle
      state.lightTimer -= dt;
      if (state.redGrace > 0) state.redGrace = Math.max(0, state.redGrace - dt);

      if (state.lightTimer <= 0) {
        if (state.lightState === 'green') {
          state.lightState = 'yellow';
          state.lightTimer = 0.72;
          sounds.push({ type: 'countdown' });
        } else if (state.lightState === 'yellow') {
          if (Math.random() < 0.24) {
            state.lightState = 'green';
            state.lightTimer = 1.45;
            state.banner = 'FAKE OUT — RUN!';
            sounds.push({ type: 'go' });
          } else {
            state.lightState = 'red';
            state.lightTimer = 1.65 + Math.random() * 0.95;
            state.redGrace = 0.2;
            sounds.push({ type: 'bump', intensity: 0.9 });
          }
        } else {
          state.lightState = 'green';
          state.lightTimer = 1.85 + Math.random() * 1.65;
          sounds.push({ type: 'go' });
        }
      }

      for (const p of state.players) {
        p.sprintTimer = Math.max(0, p.sprintTimer - dt);
        p.shieldTimer = Math.max(0, p.shieldTimer - dt);
        p.zappedTimer = Math.max(0, p.zappedTimer - dt);
        p.mudTimer = Math.max(0, p.mudTimer - dt);
        p.sprintCd = Math.max(0, p.sprintCd - dt);
        p.shieldCd = Math.max(0, p.shieldCd - dt);

        if (p.finished) continue;

        const inp = players.find((x) => x.id === p.id);
        if (!inp) continue;
        const { dx, dy, a, b } = inp.input;

        if (a && !inp.prevA && p.sprintCd <= 0 && p.zappedTimer <= 0) {
          p.sprintTimer = 0.55;
          p.sprintCd = 2.6;
          sounds.push({ type: 'boost', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 18, reason: 'sprint' });
        }
        if (b && !inp.prevB && p.shieldCd <= 0) {
          p.shieldTimer = 1.1;
          p.shieldCd = 4.0;
          sounds.push({ type: 'pulse', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 22, reason: 'shield' });
        }

        // Check mud puddles & golden apples
        for (const pd of state.puddles) {
          const ex = (p.x - pd.x) / pd.rx;
          const ey = (p.y - pd.y) / pd.ry;
          if (ex * ex + ey * ey <= 1) {
            p.mudTimer = 0.25;
            break;
          }
        }
        for (let ai = state.apples.length - 1; ai >= 0; ai--) {
          const ap = state.apples[ai];
          if (Math.hypot(p.x - ap.x, p.y - ap.y) < 30) {
            p.score += 35;
            p.sprintTimer = Math.max(p.sprintTimer, 0.75);
            p.mudTimer = 0;
            state.popups.push({ x: ap.x, y: ap.y - 16, text: '+35 SPRINT!', colorHex: '#FFB800', alpha: 1.1 });
            state.apples.splice(ai, 1);
            sounds.push({ type: 'pickup', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 18, reason: 'apple' });
          }
        }

        const inputMag = Math.hypot(dx, dy);
        if (p.zappedTimer > 0) {
          p.vx *= 0.85;
          p.vy *= 0.85;
        } else if (inputMag > 0.16) {
          const baseSpd = p.sprintTimer > 0 ? 315 : 195;
          const speed = p.mudTimer > 0 ? baseSpd * 0.58 : baseSpd;
          p.vx = Math.max(-90, dx * speed);
          p.vy = dy * (p.mudTimer > 0 ? 110 : 165);
        } else {
          p.vx *= Math.pow(0.001, dt);
          p.vy *= Math.pow(0.001, dt);
        }

        p.x = Math.max(START_X - 25, Math.min(FINISH_X + 20, p.x + p.vx * dt));
        p.y = Math.max(TRACK_TOP, Math.min(TRACK_BOTTOM, p.y + p.vy * dt));

        // Red-light scan!
        if (state.lightState === 'red' && state.redGrace <= 0 && p.zappedTimer <= 0) {
          const moving = inputMag > 0.22 || Math.hypot(p.vx, p.vy) > 48;
          if (moving) {
            if (p.shieldTimer > 0) {
              p.shieldTimer = 0;
              p.vx = 0;
              p.vy = 0;
              state.popups.push({ x: p.x, y: p.y - 26, text: 'SHIELDED!', colorHex: '#00C2FF', alpha: 1.1 });
              sounds.push({ type: 'confirm', playerId: p.id });
            } else {
              state.zapLines.push({ x: p.x, y: p.y, alpha: 1 });
              state.popups.push({ x: p.x, y: p.y - 26, text: 'ZAPPED!', colorHex: '#FF4D2E', alpha: 1.1 });
              p.x = Math.max(START_X, p.x - 145);
              p.vx = 0;
              p.vy = 0;
              p.zappedTimer = 0.75;
              sounds.push({ type: 'hit', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: [40, 30, 50], reason: 'zapped' });
            }
          }
        }

        // Crossed finish line!
        if (p.x >= FINISH_X) {
          p.finished = true;
          state.finishCount++;
          p.finishOrder = state.finishCount;
          const pts = Math.max(40, 180 - (state.finishCount - 1) * 35);
          p.score += pts;
          state.popups.push({ x: p.x - 20, y: p.y - 26, text: `+${pts}!`, colorHex: '#10D98B', alpha: 1.2 });
          sounds.push({ type: state.finishCount === 1 ? 'win' : 'lap', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: [25, 25, 45], reason: 'finish' });
          if (state.finishCount === 1) {
            state.banner = `${p.name} FINISHED 1ST!`;
          }
        }
      }

      const allDone = state.players.every((p) => p.finished);
      if (allDone || state.roundTimer <= 0) {
        // Partial progress points for runners still on track
        for (const p of state.players) {
          if (!p.finished) {
            const pct = Math.max(0, (p.x - START_X) / (FINISH_X - START_X));
            p.score += Math.round(pct * 45);
          }
        }
        if (!state.banner) state.banner = `RACE ${state.round} COMPLETE!`;
        state.roundPause = 2.0;
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      const pct = Math.min(100, Math.max(0, Math.round(((p.x - START_X) / (FINISH_X - START_X)) * 100)));
      p.cooldownA = Math.min(1, p.sprintCd / 2.6);
      p.cooldownB = Math.min(1, p.shieldCd / 4.0);
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: p.finished ? `FINISHED #${p.finishOrder}` : `${pct}% · ${p.score} pts`,
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

  getSnapshot(state): RedLightDashSnapshot {
    return {
      gameId: 'red-light-dash',
      round: state.round,
      totalRounds: state.totalRounds,
      roundTimer: state.roundTimer,
      lightState: state.lightState,
      lightTimer: state.lightTimer,
      finishX: FINISH_X,
      startX: START_X,
      banner: state.banner,
      zapLines: state.zapLines.map((z) => ({ ...z })),
      puddles: state.puddles.map((pd) => ({ ...pd })),
      apples: state.apples.map((ap) => ({ ...ap })),
      popups: state.popups.map((pp) => ({ ...pp })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        sprintTimer: p.sprintTimer,
        shieldTimer: p.shieldTimer,
        zappedTimer: p.zappedTimer,
        mudTimer: p.mudTimer,
        finished: p.finished,
        finishOrder: p.finishOrder,
        score: p.score,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.x - a.x);
    return sorted.map((rp, idx) => {
      const meta = players.find((p) => p.id === rp.id);
      return {
        playerId: rp.id,
        slotIndex: rp.slotIndex,
        name: rp.name,
        color: meta?.color ?? {
          id: 'vermilion',
          name: 'Coral Red',
          hex: rp.colorHex,
          dark: '#B82E17',
          textOnColor: '#FFFFFF',
        },
        rank: idx + 1,
        score: rp.score,
        highlight: `${rp.score} pts`,
      };
    });
  },
};
