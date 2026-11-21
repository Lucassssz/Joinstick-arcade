import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type RankingEntry,
  type SoundEvent,
  type TreasureCrabState,
  type TreasureDigSnapshot,
  type TreasurePlayerState,
  type TreasureSpotState,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface InternalCrab extends TreasureCrabState {
  vx: number;
  vy: number;
  changeTimer: number;
}

interface InternalHunter extends TreasurePlayerState {
  digCd: number;
  radarCd: number;
  pulseCd: number;
  magnetTimer: number;
}

interface TreasureState {
  timeLeft: number;
  totalTime: number;
  spots: TreasureSpotState[];
  crabs: InternalCrab[];
  pickups: { id: string; x: number; y: number; kind: 'map' | 'magnet' }[];
  pickupTimer: number;
  dugHoles: { x: number; y: number; success: boolean; alpha: number; colorHex: string }[];
  radars: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: InternalHunter[];
  nextId: number;
  finished: boolean;
}

const BEACH_LEFT = 140;
const BEACH_RIGHT = ARENA_WIDTH - 140;
const BEACH_TOP = 115;
const BEACH_BOTTOM = ARENA_HEIGHT - 95;

function spawnSpot(nextId: number): TreasureSpotState {
  const roll = Math.random();
  const kind: 'gold' | 'gem' | 'crown' = roll < 0.56 ? 'gold' : roll < 0.86 ? 'gem' : 'crown';
  const value = kind === 'gold' ? 100 : kind === 'gem' ? 180 : 300;
  return {
    id: `tr_${nextId}`,
    x: BEACH_LEFT + 55 + Math.random() * (BEACH_RIGHT - BEACH_LEFT - 110),
    y: BEACH_TOP + 45 + Math.random() * (BEACH_BOTTOM - BEACH_TOP - 90),
    kind,
    value,
    revealedTimer: 0,
  };
}

export const treasureDigModule: ServerGameModule<TreasureState> = {
  id: 'treasure-dig',

  createState(players, settingValue) {
    const totalTime = Math.max(45, Math.min(90, settingValue || 75));
    let nextId = 1;
    const spots: TreasureSpotState[] = [];
    for (let i = 0; i < 7; i++) spots.push(spawnSpot(nextId++));

    const crabs: InternalCrab[] = [];
    for (let i = 0; i < 4; i++) {
      const ang = Math.random() * Math.PI * 2;
      crabs.push({
        id: `cr_${nextId++}`,
        x: BEACH_LEFT + 120 + Math.random() * (BEACH_RIGHT - BEACH_LEFT - 240),
        y: BEACH_TOP + 80 + Math.random() * (BEACH_BOTTOM - BEACH_TOP - 160),
        angle: ang,
        vx: Math.cos(ang) * 95,
        vy: Math.sin(ang) * 95,
        stunTimer: 0,
        changeTimer: 1.5 + Math.random() * 2,
      });
    }

    const list: InternalHunter[] = players.map((p, idx) => {
      const ang = (idx / Math.max(1, players.length)) * Math.PI * 2;
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        x: ARENA_WIDTH / 2 + Math.cos(ang) * 160,
        y: ARENA_HEIGHT / 2 + Math.sin(ang) * 110,
        angle: ang,
        heat: 0,
        digTimer: 0,
        stunTimer: 0,
        chestsFound: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        digCd: 0,
        radarCd: 0,
        pulseCd: 0,
        magnetTimer: 0,
      };
    });

    return {
      timeLeft: totalTime,
      totalTime,
      spots,
      crabs,
      pickups: [],
      pickupTimer: 6.5,
      dugHoles: [],
      radars: [],
      popups: [],
      players: list,
      nextId,
      finished: false,
    };
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (let i = state.dugHoles.length - 1; i >= 0; i--) {
      state.dugHoles[i].alpha -= dt * 0.45;
      if (state.dugHoles[i].alpha <= 0) state.dugHoles.splice(i, 1);
    }
    for (let i = state.radars.length - 1; i >= 0; i--) {
      const r = state.radars[i];
      r.radius += 460 * dt;
      r.alpha -= dt * 1.4;
      if (r.alpha <= 0) state.radars.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= 42 * dt;
      state.popups[i].alpha -= dt * 1.0;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    if (!state.finished) {
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) state.finished = true;

      for (const s of state.spots) {
        s.revealedTimer = Math.max(0, s.revealedTimer - dt);
      }

      state.pickupTimer -= dt;
      if (state.pickupTimer <= 0 && state.pickups.length < 2) {
        state.pickupTimer = 8.5;
        state.pickups.push({
          id: `tp_${state.nextId++}`,
          x: BEACH_LEFT + 80 + Math.random() * (BEACH_RIGHT - BEACH_LEFT - 160),
          y: BEACH_TOP + 60 + Math.random() * (BEACH_BOTTOM - BEACH_TOP - 120),
          kind: Math.random() < 0.5 ? 'map' : 'magnet',
        });
      }

      // Update crabs
      for (const c of state.crabs) {
        c.stunTimer = Math.max(0, c.stunTimer - dt);
        if (c.stunTimer > 0) continue;
        c.changeTimer -= dt;
        if (c.changeTimer <= 0) {
          c.angle += (Math.random() - 0.5) * 2.2;
          c.vx = Math.cos(c.angle) * 105;
          c.vy = Math.sin(c.angle) * 105;
          c.changeTimer = 1.4 + Math.random() * 1.8;
        }
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.x < BEACH_LEFT + 35 || c.x > BEACH_RIGHT - 35) {
          c.vx *= -1;
          c.angle = Math.atan2(c.vy, c.vx);
        }
        if (c.y < BEACH_TOP + 35 || c.y > BEACH_BOTTOM - 35) {
          c.vy *= -1;
          c.angle = Math.atan2(c.vy, c.vx);
        }
      }

      // Update hunters
      for (const p of state.players) {
        p.digTimer = Math.max(0, p.digTimer - dt);
        p.stunTimer = Math.max(0, p.stunTimer - dt);
        p.digCd = Math.max(0, p.digCd - dt);
        p.radarCd = Math.max(0, p.radarCd - dt);
        p.pulseCd = Math.max(0, p.pulseCd - dt);
        p.magnetTimer = Math.max(0, p.magnetTimer - dt);

        // Pick up Map / Golden Magnet
        for (let pi = state.pickups.length - 1; pi >= 0; pi--) {
          const pk = state.pickups[pi];
          if (Math.hypot(p.x - pk.x, p.y - pk.y) < 34) {
            if (pk.kind === 'map') {
              for (const s of state.spots) s.revealedTimer = Math.max(s.revealedTimer, 4.5);
              state.popups.push({ x: pk.x, y: pk.y - 18, text: 'TREASURE MAP!', colorHex: '#FFB800', alpha: 1.2 });
            } else {
              p.magnetTimer = 8;
              state.popups.push({ x: pk.x, y: pk.y - 18, text: 'GOLD MAGNET!', colorHex: '#00C2FF', alpha: 1.2 });
            }
            p.score += 35;
            state.pickups.splice(pi, 1);
            sounds.push({ type: 'boost', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 22, reason: 'treasure-pickup' });
          }
        }

        const inp = players.find((x) => x.id === p.id);
        if (inp && p.stunTimer <= 0) {
          const { dx, dy, a, b } = inp.input;
          const mag = Math.hypot(dx, dy);
          if (mag > 0.12 && p.digTimer <= 0) {
            p.angle = Math.atan2(dy, dx);
            const spd = p.magnetTimer > 0 ? 320 : 255;
            p.x = Math.max(BEACH_LEFT, Math.min(BEACH_RIGHT, p.x + (dx / Math.max(1, mag)) * spd * dt));
            p.y = Math.max(BEACH_TOP, Math.min(BEACH_BOTTOM, p.y + (dy / Math.max(1, mag)) * spd * dt));
          }

          // Action A: Dig
          if (a && !inp.prevA && p.digCd <= 0) {
            p.digTimer = 0.28;
            p.digCd = p.magnetTimer > 0 ? 0.38 : 0.65;
            let hitIdx = -1;
            let hitDist = p.magnetTimer > 0 ? 92 : 66;
            state.spots.forEach((s, idx) => {
              const d = Math.hypot(s.x - p.x, s.y - p.y);
              if (d < hitDist) {
                hitDist = d;
                hitIdx = idx;
              }
            });

            if (hitIdx !== -1) {
              const found = state.spots[hitIdx];
              state.spots.splice(hitIdx, 1);
              state.spots.push(spawnSpot(state.nextId++));
              p.score += found.value;
              p.chestsFound++;
              state.dugHoles.push({ x: found.x, y: found.y, success: true, alpha: 1, colorHex: p.colorHex });
              const label = found.kind === 'crown' ? `CROWN +${found.value}!` : found.kind === 'gem' ? `GEM +${found.value}!` : `+${found.value} GOLD!`;
              state.popups.push({ x: found.x, y: found.y - 16, text: label, colorHex: '#FFB800', alpha: 1 });
              sounds.push({ type: found.kind === 'crown' ? 'win' : 'pickup', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: [24, 24, 48], reason: 'treasure-found' });
            } else {
              state.dugHoles.push({ x: p.x, y: p.y, success: false, alpha: 0.75, colorHex: '#8C6D46' });
              sounds.push({ type: 'nav', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: 14, reason: 'dig-miss' });
            }
          }

          // Action B: Radar Ping
          if (b && !inp.prevB && p.radarCd <= 0) {
            p.radarCd = 3.2;
            state.radars.push({
              x: p.x,
              y: p.y,
              radius: 20,
              maxRadius: 270,
              colorHex: '#00C2FF',
              alpha: 0.95,
            });
            sounds.push({ type: 'pulse', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 22, reason: 'radar' });
            for (const s of state.spots) {
              if (Math.hypot(s.x - p.x, s.y - p.y) < 275) {
                s.revealedTimer = 2.8;
              }
            }
            for (const c of state.crabs) {
              if (Math.hypot(c.x - p.x, c.y - p.y) < 240) {
                c.stunTimer = 2.6;
              }
            }
          }
        }

        // Crab pinch check
        if (p.stunTimer <= 0) {
          for (const c of state.crabs) {
            if (c.stunTimer > 0) continue;
            if (Math.hypot(c.x - p.x, c.y - p.y) < 34) {
              p.stunTimer = 0.9;
              c.stunTimer = 1.6;
              sounds.push({ type: 'hit', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: [35, 30, 35], reason: 'crab-pinch' });
              state.popups.push({ x: p.x, y: p.y - 24, text: 'PINCHED!', colorHex: '#FF4D2E', alpha: 1 });
              break;
            }
          }
        }

        // Compute heat proximity (0..1)
        let nearest = Infinity;
        for (const s of state.spots) {
          const d = Math.hypot(s.x - p.x, s.y - p.y);
          if (d < nearest) nearest = d;
        }
        p.heat = Math.max(0, Math.min(1, 1 - (nearest - 35) / 260));
        if (p.heat > 0.72 && p.pulseCd <= 0) {
          p.pulseCd = 0.45;
          haptics.push({ playerId: p.id, pattern: 14, reason: 'hot-radar' });
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      p.cooldownA = Math.min(1, p.digCd / 0.65);
      p.cooldownB = Math.min(1, p.radarCd / 3.2);
      const heatLabel = p.heat > 0.75 ? 'HOT!' : p.heat > 0.4 ? 'Warm' : 'Cold';
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: `${p.score}g · ${heatLabel}`,
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

  getSnapshot(state): TreasureDigSnapshot {
    return {
      gameId: 'treasure-dig',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      spots: state.spots.map((s) => ({ ...s })),
      crabs: state.crabs.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        angle: c.angle,
        stunTimer: c.stunTimer,
      })),
      dugHoles: state.dugHoles.map((h) => ({ ...h })),
      pickups: state.pickups.map((pk) => ({ ...pk })),
      radars: state.radars.map((r) => ({ ...r })),
      popups: state.popups.map((pp) => ({ ...pp })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        heat: p.heat,
        digTimer: p.digTimer,
        stunTimer: p.stunTimer,
        magnetTimer: p.magnetTimer,
        chestsFound: p.chestsFound,
        score: p.score,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => b.score - a.score || b.chestsFound - a.chestsFound);
    return sorted.map((tp, idx) => {
      const meta = players.find((p) => p.id === tp.id);
      return {
        playerId: tp.id,
        slotIndex: tp.slotIndex,
        name: tp.name,
        color: meta?.color ?? {
          id: 'amber',
          name: 'Gold',
          hex: tp.colorHex,
          dark: '#B58100',
          textOnColor: '#14120B',
        },
        rank: idx + 1,
        score: tp.score,
        highlight: `${tp.chestsFound} chests found`,
      };
    });
  },
};
