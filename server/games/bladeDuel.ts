import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BladeDuelPlayerState,
  type BladeDuelSnapshot,
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

interface InternalDuelist extends BladeDuelPlayerState {
  vx: number;
  vy: number;
  slashCd: number;
  parryCd: number;
}

interface BladeDuelState {
  round: number;
  targetWins: number;
  roundTimer: number;
  roundBanner: string | null;
  betweenRoundTimer: number;
  pillars: { x: number; y: number; r: number }[];
  slashes: { x: number; y: number; angle: number; colorHex: string; alpha: number }[];
  sparks: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  duelists: InternalDuelist[];
}

const SLASH_CD = 1.25;
const PARRY_CD = 1.7;
const PARRY_WINDOW = 0.44; // Generous intermediate parry window
const PLAYER_R = 20;

function resetRound(state: BladeDuelState) {
  state.roundTimer = 35;
  state.slashes = [];
  const total = state.duelists.length;
  state.duelists.forEach((d, idx) => {
    if (total <= 2) {
      d.x = idx === 0 ? 270 : ARENA_WIDTH - 270;
      d.y = ARENA_HEIGHT / 2;
      d.angle = idx === 0 ? 0 : Math.PI;
    } else {
      const ang = (idx / total) * Math.PI * 2;
      d.x = ARENA_WIDTH / 2 + Math.cos(ang) * 320;
      d.y = ARENA_HEIGHT / 2 + Math.sin(ang) * 210;
      d.angle = ang + Math.PI;
    }
    d.vx = 0;
    d.vy = 0;
    d.alive = true;
    d.slashTimer = 0;
    d.parryTimer = 0;
    d.stunTimer = 0;
    d.slashCd = 0.35;
    d.parryCd = 0.35;
  });
}

export const bladeDuelModule: ServerGameModule<BladeDuelState> = {
  id: 'blade-duel',

  createState(players, settingValue) {
    const targetWins = Math.max(2, Math.min(7, settingValue || 3));
    const duelists: InternalDuelist[] = players.map((p, idx) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      x: idx === 0 ? 270 : ARENA_WIDTH - 270,
      y: ARENA_HEIGHT / 2,
      vx: 0,
      vy: 0,
      angle: idx === 0 ? 0 : Math.PI,
      alive: true,
      slashTimer: 0,
      parryTimer: 0,
      stunTimer: 0,
      roundsWon: 0,
      parries: 0,
      score: 0,
      cooldownA: 0,
      cooldownB: 0,
      slashCd: 0,
      parryCd: 0,
    }));

    const state: BladeDuelState = {
      round: 1,
      targetWins,
      roundTimer: 35,
      roundBanner: null,
      betweenRoundTimer: 0,
      pillars: [
        { x: ARENA_WIDTH / 2, y: 205, r: 30 },
        { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - 205, r: 30 },
      ],
      slashes: [],
      sparks: [],
      duelists,
    };
    resetRound(state);
    return state;
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const inputById = new Map(players.map((p) => [p.id, p]));

    for (let i = state.slashes.length - 1; i >= 0; i--) {
      state.slashes[i].alpha -= dt * 3.8;
      if (state.slashes[i].alpha <= 0) state.slashes.splice(i, 1);
    }
    for (let i = state.sparks.length - 1; i >= 0; i--) {
      state.sparks[i].radius += 260 * dt;
      state.sparks[i].alpha -= dt * 2.8;
      if (state.sparks[i].alpha <= 0) state.sparks.splice(i, 1);
    }

    if (state.betweenRoundTimer > 0) {
      state.betweenRoundTimer = Math.max(0, state.betweenRoundTimer - dt);
      if (state.betweenRoundTimer <= 0) {
        const matchWinner = state.duelists.find((d) => d.roundsWon >= state.targetWins);
        if (matchWinner) {
          return {
            snapshot: this.getSnapshot(state),
            sounds,
            haptics,
            hudUpdates,
            finished: true,
            rankings: this.getRankings(state, players),
          };
        }
        state.round += 1;
        state.roundBanner = null;
        resetRound(state);
      }
    } else {
      state.roundTimer = Math.max(0, state.roundTimer - dt);

      for (let idx = 0; idx < state.duelists.length; idx++) {
        const d = state.duelists[idx];
        if (!d.alive) continue;

        d.slashCd = Math.max(0, d.slashCd - dt);
        d.parryCd = Math.max(0, d.parryCd - dt);
        d.slashTimer = Math.max(0, d.slashTimer - dt);
        d.parryTimer = Math.max(0, d.parryTimer - dt);
        d.stunTimer = Math.max(0, d.stunTimer - dt);

        let dx = 0;
        let dy = 0;
        let pressA = false;
        let pressB = false;

        if (d.stunTimer <= 0) {
          const inp = inputById.get(d.id);
          if (inp) {
            dx = inp.input.dx;
            dy = inp.input.dy;
            pressA = inp.input.a && !inp.prevA;
            pressB = inp.input.b && !inp.prevB;
          }
        }

        const mag = Math.hypot(dx, dy);
        if (mag > 0.14 && d.slashTimer <= 0) {
          d.angle = Math.atan2(dy, dx);
        }

        // Button B: Timed Parry
        if (pressB && d.parryCd <= 0 && d.slashTimer <= 0) {
          d.parryTimer = PARRY_WINDOW;
          d.parryCd = PARRY_CD;
          sounds.push({ type: 'ready', playerId: d.id });
          if (!d.isBot) haptics.push({ playerId: d.id, pattern: 18, reason: 'parry-stance' });
        }

        // Button A: Dash Slash
        if (pressA && d.slashCd <= 0 && d.parryTimer <= 0) {
          d.slashTimer = 0.24;
          d.slashCd = SLASH_CD;
          d.vx = Math.cos(d.angle) * 760;
          d.vy = Math.sin(d.angle) * 760;
          state.slashes.push({ x: d.x, y: d.y, angle: d.angle, colorHex: d.colorHex, alpha: 1 });
          sounds.push({ type: 'boost', playerId: d.id });
          if (!d.isBot) haptics.push({ playerId: d.id, pattern: 26, reason: 'slash' });
        }

        const speed = d.stunTimer > 0 ? 0 : d.parryTimer > 0 ? 110 : d.slashTimer > 0 ? 740 : 300;
        const tvx = d.slashTimer > 0 ? d.vx : mag > 0.14 ? (dx / mag) * speed : 0;
        const tvy = d.slashTimer > 0 ? d.vy : mag > 0.14 ? (dy / mag) * speed : 0;
        const accel = d.slashTimer > 0 ? 3.5 : 15;
        d.vx += (tvx - d.vx) * Math.min(1, accel * dt);
        d.vy += (tvy - d.vy) * Math.min(1, accel * dt);

        d.x = Math.max(84, Math.min(ARENA_WIDTH - 84, d.x + d.vx * dt));
        d.y = Math.max(84, Math.min(ARENA_HEIGHT - 84, d.y + d.vy * dt));

        for (const pil of state.pillars) {
          const pdx = d.x - pil.x;
          const pdy = d.y - pil.y;
          const pdist = Math.hypot(pdx, pdy) || 1;
          if (pdist < pil.r + PLAYER_R) {
            d.x = pil.x + (pdx / pdist) * (pil.r + PLAYER_R);
            d.y = pil.y + (pdy / pdist) * (pil.r + PLAYER_R);
          }
        }

        d.cooldownA = d.slashCd / SLASH_CD;
        d.cooldownB = d.parryCd / PARRY_CD;
      }

      // Check pairwise blade clashes & hits across all active duelists
      for (let i = 0; i < state.duelists.length; i++) {
        for (let j = i + 1; j < state.duelists.length; j++) {
          const a = state.duelists[i];
          const b = state.duelists[j];
          if (!a.alive || !b.alive) continue;
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist >= 66) continue;

          if (a.slashTimer > 0 && b.slashTimer > 0) {
            const nx = (a.x - b.x) / (dist || 1);
            const ny = (a.y - b.y) / (dist || 1);
            a.vx = nx * 460;
            a.vy = ny * 460;
            b.vx = -nx * 460;
            b.vy = -ny * 460;
            a.slashTimer = 0;
            b.slashTimer = 0;
            state.sparks.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, radius: 14, colorHex: '#FFB800', alpha: 1 });
            sounds.push({ type: 'pulse' });
            for (const pl of players) haptics.push({ playerId: pl.id, pattern: [30, 20, 45], reason: 'clash' });
          } else if (a.slashTimer > 0) {
            if (b.parryTimer > 0) {
              a.slashTimer = 0;
              a.stunTimer = 1.15;
              b.parries += 1;
              b.score += 40;
              b.slashCd = 0;
              state.sparks.push({ x: b.x, y: b.y, radius: 18, colorHex: '#FFB800', alpha: 1 });
              sounds.push({ type: 'pulse', playerId: b.id });
              if (!b.isBot) haptics.push({ playerId: b.id, pattern: [25, 20, 60], reason: 'parry-win' });
              if (!a.isBot) haptics.push({ playerId: a.id, pattern: [60, 30, 60], reason: 'parried' });
            } else {
              b.alive = false;
              a.score += 100;
              state.sparks.push({ x: b.x, y: b.y, radius: 22, colorHex: a.colorHex, alpha: 1 });
              sounds.push({ type: 'ko' });
              for (const pl of players) haptics.push({ playerId: pl.id, pattern: [65, 35, 85], reason: 'ko' });
            }
          } else if (b.slashTimer > 0) {
            if (a.parryTimer > 0) {
              b.slashTimer = 0;
              b.stunTimer = 1.15;
              a.parries += 1;
              a.score += 40;
              a.slashCd = 0;
              state.sparks.push({ x: a.x, y: a.y, radius: 18, colorHex: '#FFB800', alpha: 1 });
              sounds.push({ type: 'pulse', playerId: a.id });
              if (!a.isBot) haptics.push({ playerId: a.id, pattern: [25, 20, 60], reason: 'parry-win' });
              if (!b.isBot) haptics.push({ playerId: b.id, pattern: [60, 30, 60], reason: 'parried' });
            } else {
              a.alive = false;
              b.score += 100;
              state.sparks.push({ x: a.x, y: a.y, radius: 22, colorHex: b.colorHex, alpha: 1 });
              sounds.push({ type: 'ko' });
              for (const pl of players) haptics.push({ playerId: pl.id, pattern: [65, 35, 85], reason: 'ko' });
            }
          }
        }
      }

      const aliveDuelists = state.duelists.filter((d) => d.alive);
      if (state.duelists.length > 1 && aliveDuelists.length <= 1 && state.betweenRoundTimer <= 0) {
        const survivor = aliveDuelists[0];
        if (survivor) {
          survivor.roundsWon += 1;
          state.roundBanner = `${survivor.name} STRIKES TRUE!`;
        } else {
          state.roundBanner = 'DOUBLE KO!';
        }
        state.betweenRoundTimer = 1.9;
      }

      if (state.roundTimer <= 0 && state.betweenRoundTimer <= 0) {
        state.roundBanner = 'DRAW — NEXT ROUND';
        state.betweenRoundTimer = 1.6;
      }
    }

    for (const p of players) {
      const d = state.duelists.find((du) => du.id === p.id);
      if (!d) continue;
      hudUpdates[p.id] = {
        score: d.roundsWon,
        alive: d.alive,
        statText: `Wins ${d.roundsWon}/${state.targetWins} · ${d.parries} Parries`,
        cooldownA: d.cooldownA,
        cooldownB: d.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished: false,
    };
  },

  getSnapshot(state): BladeDuelSnapshot {
    return {
      gameId: 'blade-duel',
      round: state.round,
      targetWins: state.targetWins,
      roundTimer: state.roundTimer,
      roundBanner: state.roundBanner,
      pillars: state.pillars,
      slashes: state.slashes.map((s) => ({ ...s })),
      sparks: state.sparks.map((s) => ({ ...s })),
      players: state.duelists.map((d) => ({
        id: d.id,
        slotIndex: d.slotIndex,
        name: d.name,
        colorHex: d.colorHex,
        isBot: d.isBot,
        x: d.x,
        y: d.y,
        angle: d.angle,
        alive: d.alive,
        slashTimer: d.slashTimer,
        parryTimer: d.parryTimer,
        stunTimer: d.stunTimer,
        roundsWon: d.roundsWon,
        parries: d.parries,
        score: d.score,
        cooldownA: d.cooldownA,
        cooldownB: d.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...players]
      .map((p) => ({ p, d: state.duelists.find((du) => du.id === p.id) }))
      .sort((a, b) => (b.d?.roundsWon ?? 0) - (a.d?.roundsWon ?? 0) || (b.d?.score ?? 0) - (a.d?.score ?? 0));
    return sorted.map(({ p, d }, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      rank: idx + 1,
      score: d?.roundsWon ?? 0,
      highlight: `${d?.roundsWon ?? 0} wins · ${d?.parries ?? 0} parries`,
    }));
  },
};
