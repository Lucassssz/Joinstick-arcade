import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type FallingItemState,
  type FruitDropSnapshot,
  type FruitPlayerState,
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

interface InternalCatcher extends FruitPlayerState {
  vx: number;
  dashCd: number;
  bounceCd: number;
}

interface FruitDropState {
  timeLeft: number;
  totalTime: number;
  spawnTimer: number;
  items: FallingItemState[];
  bounceWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: InternalCatcher[];
  nextId: number;
  finished: boolean;
}

const STAGE_Y = ARENA_HEIGHT - 96;

function spawnItem(nextId: number, progress: number): FallingItemState {
  const roll = Math.random();
  let kind: FallingItemState['kind'] = 'pineapple';
  if (roll < 0.27) kind = 'pineapple';
  else if (roll < 0.52) kind = 'watermelon';
  else if (roll < 0.72) kind = 'berry';
  else if (roll < 0.84) kind = 'star';
  else kind = 'bomb';

  const speedScale = 1 + progress * 0.45;
  return {
    id: `fr_${nextId}`,
    kind,
    x: 90 + Math.random() * (ARENA_WIDTH - 180),
    y: -24,
    vx: (Math.random() - 0.5) * 48,
    vy: (kind === 'star' ? 245 : kind === 'bomb' ? 225 : 190 + Math.random() * 55) * speedScale,
    r: kind === 'watermelon' ? 24 : kind === 'bomb' ? 22 : 20,
    rot: Math.random() * Math.PI * 2,
  };
}

export const fruitDropModule: ServerGameModule<FruitDropState> = {
  id: 'fruit-drop',

  createState(players, settingValue) {
    const totalTime = Math.max(45, Math.min(90, settingValue || 60));
    const count = Math.max(1, players.length);
    const list: InternalCatcher[] = players.map((p, idx) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: 150 + ((idx + 0.5) / count) * (ARENA_WIDTH - 300),
      y: STAGE_Y,
      vx: 0,
      dashTimer: 0,
      bounceTimer: 0,
      stunTimer: 0,
      combo: 0,
      caught: 0,
      score: 0,
      cooldownA: 0,
      cooldownB: 0,
      dashCd: 0,
      bounceCd: 0,
    }));

    return {
      timeLeft: totalTime,
      totalTime,
      spawnTimer: 0.35,
      items: [],
      bounceWaves: [],
      popups: [],
      players: list,
      nextId: 1,
      finished: false,
    };
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (let i = state.bounceWaves.length - 1; i >= 0; i--) {
      const w = state.bounceWaves[i];
      w.radius += 420 * dt;
      w.alpha -= dt * 2.5;
      if (w.alpha <= 0) state.bounceWaves.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= 48 * dt;
      state.popups[i].alpha -= dt * 1.25;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    if (!state.finished) {
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) state.finished = true;

      const progress = 1 - state.timeLeft / state.totalTime;
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const count = Math.min(3, 1 + Math.floor(state.players.length / 3));
        for (let i = 0; i < count; i++) {
          state.items.push(spawnItem(state.nextId++, progress));
        }
        state.spawnTimer = Math.max(0.32, 0.72 - progress * 0.28);
      }

      // Move players
      for (const p of state.players) {
        p.dashTimer = Math.max(0, p.dashTimer - dt);
        p.bounceTimer = Math.max(0, p.bounceTimer - dt);
        p.stunTimer = Math.max(0, p.stunTimer - dt);
        p.dashCd = Math.max(0, p.dashCd - dt);
        p.bounceCd = Math.max(0, p.bounceCd - dt);

        const inp = players.find((x) => x.id === p.id);
        if (!inp) continue;
        const { dx, a, b } = inp.input;

        if (p.stunTimer <= 0) {
          if (a && !inp.prevA && p.dashCd <= 0) {
            p.dashTimer = 0.24;
            p.dashCd = 1.4;
            const dir = Math.abs(dx) > 0.15 ? Math.sign(dx) : p.vx >= 0 ? 1 : -1;
            p.vx = dir * 740;
            sounds.push({ type: 'boost', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 16, reason: 'dash' });
          }

          if (b && !inp.prevB && p.bounceCd <= 0) {
            p.bounceTimer = 0.25;
            p.bounceCd = 1.8;
            state.bounceWaves.push({
              x: p.x,
              y: p.y - 18,
              radius: 26,
              maxRadius: 145,
              colorHex: p.colorHex,
              alpha: 0.92,
            });
            sounds.push({ type: 'pulse', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 20, reason: 'bounce' });

            // Swat nearby bombs upward and sideways!
            for (const item of state.items) {
              if (item.kind === 'bomb' && Math.hypot(item.x - p.x, item.y - (p.y - 20)) < 150) {
                item.vy = -420;
                item.vx = (item.x >= p.x ? 1 : -1) * 260;
                p.score += 35;
                state.popups.push({ x: item.x, y: item.y - 12, text: 'SWAT +35!', colorHex: '#00C2FF', alpha: 1 });
              }
            }
          }

          if (p.dashTimer <= 0) {
            const targetVx = Math.abs(dx) > 0.1 ? dx * 430 : 0;
            p.vx += (targetVx - p.vx) * Math.min(1, dt * 14);
          }
        } else {
          p.vx *= 0.85;
        }

        p.x = Math.max(66, Math.min(ARENA_WIDTH - 66, p.x + p.vx * dt));
      }

      // Move falling items & check basket catches
      for (let i = state.items.length - 1; i >= 0; i--) {
        const it = state.items[i];
        it.x += it.vx * dt;
        it.y += it.vy * dt;
        it.vy += 65 * dt;
        it.rot += dt * 2.2;
        if (it.x < 44 || it.x > ARENA_WIDTH - 44) it.vx *= -1;

        let consumed = false;
        for (const p of state.players) {
          if (p.stunTimer > 0) continue;
          const dx = Math.abs(it.x - p.x);
          const dy = Math.abs(it.y - (p.y - 16));
          if (dx < 46 && dy < 36) {
            consumed = true;
            if (it.kind === 'bomb') {
              p.combo = 0;
              p.stunTimer = 0.85;
              p.score = Math.max(0, p.score - 50);
              state.popups.push({ x: p.x, y: p.y - 44, text: 'BOOM -50!', colorHex: '#FF4D2E', alpha: 1 });
              sounds.push({ type: 'hit', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: [40, 30, 50], reason: 'bomb-hit' });
            } else {
              p.combo = Math.min(5, p.combo + 1);
              p.caught++;
              const base = it.kind === 'star' ? 90 : it.kind === 'pineapple' ? 45 : it.kind === 'watermelon' ? 35 : 25;
              const pts = base * p.combo;
              p.score += pts;
              state.popups.push({
                x: p.x,
                y: p.y - 44,
                text: p.combo > 1 ? `+${pts} (x${p.combo})` : `+${pts}`,
                colorHex: it.kind === 'star' ? '#FFB800' : '#9EE622',
                alpha: 1,
              });
              sounds.push({ type: it.kind === 'star' ? 'win' : 'pickup', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: it.kind === 'star' ? [18, 18, 30] : 14, reason: 'catch' });
            }
            break;
          }
        }

        if (consumed || it.y > ARENA_HEIGHT + 40 || it.y < -280) {
          state.items.splice(i, 1);
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      p.cooldownA = Math.min(1, p.dashCd / 1.4);
      p.cooldownB = Math.min(1, p.bounceCd / 1.8);
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: p.combo > 1 ? `${p.score} pts · x${p.combo}` : `${p.score} pts`,
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

  getSnapshot(state): FruitDropSnapshot {
    return {
      gameId: 'fruit-drop',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      items: state.items.map((it) => ({ ...it })),
      bounceWaves: state.bounceWaves.map((w) => ({ ...w })),
      popups: state.popups.map((pp) => ({ ...pp })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        dashTimer: p.dashTimer,
        bounceTimer: p.bounceTimer,
        stunTimer: p.stunTimer,
        combo: p.combo,
        caught: p.caught,
        score: p.score,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.caught - a.caught);
    return sorted.map((fp, idx) => {
      const meta = players.find((p) => p.id === fp.id);
      return {
        playerId: fp.id,
        slotIndex: fp.slotIndex,
        name: fp.name,
        color: meta?.color ?? {
          id: 'lime',
          name: 'Arcade Lime',
          hex: fp.colorHex,
          dark: '#679910',
          textOnColor: '#12190A',
        },
        rank: idx + 1,
        score: fp.score,
        highlight: `${fp.caught} fruits caught`,
      };
    });
  },
};
