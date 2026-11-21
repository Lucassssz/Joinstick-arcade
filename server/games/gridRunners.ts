import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type GridPickupState,
  type GridRunnerPlayerState,
  type GridRunnersSnapshot,
  type GridTrailPoint,
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

interface InternalGridRunner extends GridRunnerPlayerState {
  overdriveCd: number;
  hopCd: number;
  points: GridTrailPoint[];
  lastPointX: number;
  lastPointY: number;
  wasAirborne: boolean;
  surviveAccum: number;
  nearMissCd: number;
}

interface InternalPopup {
  x: number;
  y: number;
  text: string;
  colorHex: string;
  alpha: number;
}

interface GridRunnersInternalState {
  round: number;
  totalRounds: number;
  roundTimer: number;
  betweenRoundTimer: number;
  roundBanner: string | null;
  pickups: GridPickupState[];
  pickupTimer: number;
  pickupSeq: number;
  obstacles: { x: number; y: number; w: number; h: number }[];
  popups: InternalPopup[];
  explosions: { x: number; y: number; radius: number; colorHex: string; alpha: number }[];
  players: InternalGridRunner[];
  soloMode: boolean;
  finished: boolean;
}

const ARENA_MARGIN = 26;
const BASE_SPEED = 245;
const OVERDRIVE_SPEED = 365;
const OVERDRIVE_DURATION = 0.65;
const OVERDRIVE_COOLDOWN = 2.4;
const HOP_DURATION = 0.48;
const HOP_COOLDOWN = 2.5;
const TURN_RATE = 4.6;
const TRAIL_STEP = 10;
const COLLISION_RADIUS = 10;
const SELF_SAFE_POINTS = 11;
const ROUND_TIME_LIMIT = 60;

function normalizeAngle(a: number): number {
  let res = a;
  while (res > Math.PI) res -= Math.PI * 2;
  while (res < -Math.PI) res += Math.PI * 2;
  return res;
}

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy;
  if (lenSq < 0.0001) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

function buildRoundObstacles(round: number): { x: number; y: number; w: number; h: number }[] {
  if (round <= 1) return [];
  if (round === 2) {
    return [
      { x: 560, y: 175, w: 80, h: 42 },
      { x: 560, y: 503, w: 80, h: 42 },
    ];
  }
  return [
    { x: 350, y: 220, w: 58, h: 58 },
    { x: 792, y: 220, w: 58, h: 58 },
    { x: 350, y: 442, w: 58, h: 58 },
    { x: 792, y: 442, w: 58, h: 58 },
  ];
}

function spawnRunners(
  players: ServerPlayerInputState[],
  prevMap?: Map<string, { score: number; roundsWon: number }>
): InternalGridRunner[] {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;
  return players.map((p, idx) => {
    const angle = (idx / Math.max(players.length, 1)) * Math.PI * 2;
    const x = players.length === 1 ? cx - 220 : cx + Math.cos(angle) * 340;
    const y = players.length === 1 ? cy : cy + Math.sin(angle) * 200;
    const heading = players.length === 1 ? 0 : normalizeAngle(angle + Math.PI);
    const prev = prevMap?.get(p.id);
    return {
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x,
      y,
      angle: heading,
      speed: BASE_SPEED,
      alive: true,
      overdriveTimer: 0,
      hopTimer: 0,
      hopDuration: HOP_DURATION,
      overdriveCd: 0,
      hopCd: 0,
      cooldownA: 0,
      cooldownB: 0,
      score: prev?.score ?? 0,
      roundsWon: prev?.roundsWon ?? 0,
      points: [{ x, y }],
      lastPointX: x,
      lastPointY: y,
      wasAirborne: false,
      surviveAccum: 0,
      nearMissCd: 0,
    };
  });
}

function toSnapshot(state: GridRunnersInternalState): GridRunnersSnapshot {
  return {
    gameId: 'grid-runners',
    round: state.round,
    totalRounds: state.totalRounds,
    roundTimer: Math.max(0, state.roundTimer),
    roundBanner: state.roundBanner,
    trails: state.players.map((p) => ({
      playerId: p.id,
      colorHex: p.colorHex,
      points: p.points,
    })),
    pickups: state.pickups.map((pk) => ({ ...pk })),
    obstacles: state.obstacles,
    popups: state.popups.map((p) => ({ ...p })),
    explosions: state.explosions.map((e) => ({ ...e })),
    players: state.players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.colorHex,
      x: p.x,
      y: p.y,
      angle: p.angle,
      speed: p.speed,
      alive: p.alive,
      overdriveTimer: p.overdriveTimer,
      hopTimer: p.hopTimer,
      hopDuration: p.hopDuration,
      cooldownA: Math.min(1, Math.max(0, p.overdriveCd / OVERDRIVE_COOLDOWN)),
      cooldownB: Math.min(1, Math.max(0, p.hopCd / HOP_COOLDOWN)),
      score: p.score,
      roundsWon: p.roundsWon,
    })),
  };
}

function buildRankings(
  state: GridRunnersInternalState,
  inputPlayers: ServerPlayerInputState[]
): RankingEntry[] {
  const colorById = new Map(inputPlayers.map((p) => [p.id, p.color]));
  const sorted = [...state.players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.roundsWon - a.roundsWon;
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
    highlight: `${p.roundsWon} win${p.roundsWon === 1 ? '' : 's'}`,
  }));
}

export const gridRunnersModule: ServerGameModule<GridRunnersInternalState> = {
  id: 'grid-runners',

  createState(players: ServerPlayerInputState[], settingValue: number): GridRunnersInternalState {
    const totalRounds = Math.max(1, Math.min(7, settingValue || 3));
    return {
      round: 1,
      totalRounds,
      roundTimer: ROUND_TIME_LIMIT,
      betweenRoundTimer: 0,
      roundBanner: null,
      pickups: [],
      pickupTimer: 3.5,
      pickupSeq: 0,
      obstacles: buildRoundObstacles(1),
      popups: [],
      explosions: [],
      players: spawnRunners(players),
      soloMode: players.length <= 1,
      finished: false,
    };
  },

  addPlayer(state: GridRunnersInternalState, p: ServerPlayerInputState): void {
    if (state.players.some((x) => x.id === p.id)) return;
    const x = ARENA_WIDTH / 2;
    const y = ARENA_HEIGHT / 2;
    state.players.push({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x,
      y,
      angle: 0,
      speed: BASE_SPEED,
      alive: true,
      overdriveTimer: 0,
      hopTimer: 0.6,
      hopDuration: HOP_DURATION,
      overdriveCd: 0,
      hopCd: 0,
      cooldownA: 0,
      cooldownB: 0,
      score: 0,
      roundsWon: 0,
      points: [{ x, y }],
      lastPointX: x,
      lastPointY: y,
      wasAirborne: true,
      surviveAccum: 0,
      nearMissCd: 0,
    });
    if (state.players.length > 1) state.soloMode = false;
  },

  step(state: GridRunnersInternalState, inputPlayers: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(inputPlayers.map((p) => [p.id, p]));

    for (let i = state.explosions.length - 1; i >= 0; i--) {
      const e = state.explosions[i];
      e.radius += 260 * dt;
      e.alpha = Math.max(0, e.alpha - 2.3 * dt);
      if (e.alpha <= 0) state.explosions.splice(i, 1);
    }

    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pop = state.popups[i];
      pop.y -= 34 * dt;
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
          state.roundBanner = null;
          state.pickups = [];
          state.pickupTimer = 3.0;
          state.obstacles = buildRoundObstacles(state.round);
          const prevMap = new Map(
            state.players.map((p) => [p.id, { score: p.score, roundsWon: p.roundsWon }])
          );
          state.players = spawnRunners(inputPlayers, prevMap);
          sounds.push({ type: 'go' });
        }
      }
    } else {
      state.roundTimer = Math.max(0, state.roundTimer - dt);

      // Spawn Energy / EMP / Score Cubes
      state.pickupTimer -= dt;
      if (state.pickupTimer <= 0 && state.pickups.length < 3) {
        state.pickupTimer = 4.6;
        state.pickupSeq += 1;
        const kinds: GridPickupState['kind'][] = ['energy', 'emp', 'score'];
        const kind = kinds[state.pickupSeq % kinds.length];
        const px = 140 + Math.random() * (ARENA_WIDTH - 280);
        const py = 110 + Math.random() * (ARENA_HEIGHT - 220);
        const insideOb = state.obstacles.some(
          (ob) => px > ob.x - 24 && px < ob.x + ob.w + 24 && py > ob.y - 24 && py < ob.y + ob.h + 24
        );
        if (!insideOb) {
          state.pickups.push({ id: `gp_${state.pickupSeq}`, kind, x: px, y: py });
        }
      }

      for (const r of state.players) {
        if (!r.alive) continue;
        const src = inputMap.get(r.id);
        r.overdriveCd = Math.max(0, r.overdriveCd - dt);
        r.hopCd = Math.max(0, r.hopCd - dt);
        r.overdriveTimer = Math.max(0, r.overdriveTimer - dt);
        r.hopTimer = Math.max(0, r.hopTimer - dt);
        r.nearMissCd = Math.max(0, r.nearMissCd - dt);

        if (src) {
          const { dx, dy, a, b } = src.input;
          const mag = Math.hypot(dx, dy);
          if (mag > 0.14) {
            const desired = Math.atan2(dy, dx);
            const diff = normalizeAngle(desired - r.angle);
            const maxStep = TURN_RATE * dt;
            if (Math.abs(diff) <= maxStep) r.angle = desired;
            else r.angle = normalizeAngle(r.angle + Math.sign(diff) * maxStep);
          }

          if (a && !src.prevA && r.overdriveCd <= 0) {
            r.overdriveTimer = OVERDRIVE_DURATION;
            r.overdriveCd = OVERDRIVE_COOLDOWN;
            sounds.push({ type: 'boost', playerId: r.id });
            haptics.push({ playerId: r.id, pattern: 38, reason: 'boost' });
          }

          if (b && !src.prevB && r.hopCd <= 0 && r.hopTimer <= 0) {
            r.hopTimer = HOP_DURATION;
            r.hopCd = HOP_COOLDOWN;
            sounds.push({ type: 'pulse', playerId: r.id });
            haptics.push({ playerId: r.id, pattern: 40, reason: 'hop' });
          }
        }

        r.speed = r.overdriveTimer > 0 ? OVERDRIVE_SPEED : BASE_SPEED;
        r.x += Math.cos(r.angle) * r.speed * dt;
        r.y += Math.sin(r.angle) * r.speed * dt;

        // Pickup collection
        for (let i = state.pickups.length - 1; i >= 0; i--) {
          const pk = state.pickups[i];
          if (Math.hypot(r.x - pk.x, r.y - pk.y) < 26) {
            state.pickups.splice(i, 1);
            sounds.push({ type: 'pickup', playerId: r.id });
            haptics.push({ playerId: r.id, pattern: [18, 12, 24], reason: 'pickup' });
            if (pk.kind === 'energy') {
              r.overdriveCd = 0;
              r.hopCd = 0;
              r.score += 35;
              state.popups.push({ x: r.x, y: r.y - 24, text: 'RECHARGED!', colorHex: '#00C2FF', alpha: 1 });
            } else if (pk.kind === 'emp') {
              // Erase nearby enemy trail points!
              for (const other of state.players) {
                if (other.id === r.id) continue;
                for (const pt of other.points) {
                  if (Math.hypot(pt.x - r.x, pt.y - r.y) < 175) {
                    pt.gap = true;
                  }
                }
              }
              state.explosions.push({ x: r.x, y: r.y, radius: 18, colorHex: '#FF3B9A', alpha: 1 });
              r.score += 40;
              state.popups.push({ x: r.x, y: r.y - 24, text: 'EMP CLEAR!', colorHex: '#FF3B9A', alpha: 1 });
            } else {
              r.score += 75;
              r.overdriveTimer = Math.max(r.overdriveTimer, 0.9);
              state.popups.push({ x: r.x, y: r.y - 24, text: '+75 DATA!', colorHex: '#FFB800', alpha: 1 });
            }
          }
        }

        r.surviveAccum += dt;
        if (r.surviveAccum >= 1.0) {
          r.surviveAccum -= 1.0;
          r.score += 10;
        }

        const airborne = r.hopTimer > 0;
        if (!airborne) {
          const distSinceLast = Math.hypot(r.x - r.lastPointX, r.y - r.lastPointY);
          if (r.wasAirborne || distSinceLast >= TRAIL_STEP) {
            r.points.push({ x: r.x, y: r.y, gap: r.wasAirborne ? true : undefined });
            r.lastPointX = r.x;
            r.lastPointY = r.y;
            if (r.points.length > 420) {
              r.points.shift();
            }
          }
        }
        r.wasAirborne = airborne;
      }

      const crashedIds = new Set<string>();
      for (const r of state.players) {
        if (!r.alive) continue;

        if (
          r.x < ARENA_MARGIN ||
          r.x > ARENA_WIDTH - ARENA_MARGIN ||
          r.y < ARENA_MARGIN ||
          r.y > ARENA_HEIGHT - ARENA_MARGIN
        ) {
          crashedIds.add(r.id);
          continue;
        }

        if (r.hopTimer > 0) continue;

        // Obstacle crash check (can hop over them!)
        const hitOb = state.obstacles.some(
          (ob) => r.x > ob.x - 8 && r.x < ob.x + ob.w + 8 && r.y > ob.y - 8 && r.y < ob.y + ob.h + 8
        );
        if (hitOb) {
          crashedIds.add(r.id);
          continue;
        }

        let hitTrail = false;
        let closeEnemyTrail = false;
        for (const other of state.players) {
          const pts = other.points;
          const endIdx = other.id === r.id ? pts.length - SELF_SAFE_POINTS : pts.length - 1;
          for (let i = 1; i < endIdx; i++) {
            const p1 = pts[i - 1];
            const p2 = pts[i];
            if (p2.gap) continue;
            const d = distToSegment(r.x, r.y, p1.x, p1.y, p2.x, p2.y);
            if (d < COLLISION_RADIUS) {
              hitTrail = true;
              if (other.id !== r.id) {
                other.score += 80;
                haptics.push({ playerId: other.id, pattern: 45, reason: 'score' });
              }
              break;
            } else if (other.id !== r.id && d < 22) {
              closeEnemyTrail = true;
            }
          }
          if (hitTrail) break;
        }

        if (hitTrail) {
          crashedIds.add(r.id);
        } else if (closeEnemyTrail && r.nearMissCd <= 0) {
          r.nearMissCd = 1.6;
          r.score += 15;
          state.popups.push({ x: r.x, y: r.y - 24, text: 'NEAR MISS! +15', colorHex: '#10D98B', alpha: 1 });
        }
      }

      for (let i = 0; i < state.players.length; i++) {
        const a = state.players[i];
        if (!a.alive || a.hopTimer > 0) continue;
        for (let j = i + 1; j < state.players.length; j++) {
          const b = state.players[j];
          if (!b.alive || b.hopTimer > 0) continue;
          if (Math.hypot(a.x - b.x, a.y - b.y) < 18) {
            crashedIds.add(a.id);
            crashedIds.add(b.id);
          }
        }
      }

      for (const cid of crashedIds) {
        const r = state.players.find((p) => p.id === cid);
        if (!r || !r.alive) continue;
        r.alive = false;
        state.explosions.push({
          x: r.x,
          y: r.y,
          radius: 12,
          colorHex: r.colorHex,
          alpha: 1,
        });
        sounds.push({ type: 'ko', playerId: r.id });
        haptics.push({ playerId: r.id, pattern: [75, 35, 95], reason: 'ko' });
      }

      const alive = state.players.filter((p) => p.alive);
      if (state.soloMode) {
        if (alive.length === 0 || state.roundTimer <= 0) {
          if (alive.length === 1) {
            alive[0].score += 150;
            alive[0].roundsWon += 1;
            state.roundBanner = `${alive[0].name} Cleared the Grid!`;
            sounds.push({ type: 'win', playerId: alive[0].id });
          } else {
            state.roundBanner = 'Derezzed!';
          }
          state.betweenRoundTimer = 2.0;
        }
      } else {
        if (alive.length <= 1 || state.roundTimer <= 0) {
          if (alive.length === 1) {
            alive[0].score += 200;
            alive[0].roundsWon += 1;
            state.roundBanner = `${alive[0].name} Wins Round ${state.round}!`;
            sounds.push({ type: 'win', playerId: alive[0].id });
          } else if (alive.length > 1) {
            for (const p of alive) p.score += 75;
            state.roundBanner = `Time Up — ${alive.length} Survived`;
          } else {
            state.roundBanner = 'Double Crash!';
          }
          state.betweenRoundTimer = 2.2;
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: p.score,
        alive: p.alive,
        statText: p.alive ? `${p.roundsWon}W · ${p.score} pts` : `OUT · ${p.score} pts`,
        cooldownA: Math.min(1, Math.max(0, p.overdriveCd / OVERDRIVE_COOLDOWN)),
        cooldownB: Math.min(1, Math.max(0, p.hopCd / HOP_COOLDOWN)),
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

  getSnapshot(state: GridRunnersInternalState): GridRunnersSnapshot {
    return toSnapshot(state);
  },

  getRankings(state: GridRunnersInternalState, players: ServerPlayerInputState[]): RankingEntry[] {
    return buildRankings(state, players);
  },
};
