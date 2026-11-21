import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type HexDropSnapshot,
  type HexPlayerState,
  type HexTileState,
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

interface InternalHexTile extends HexTileState {
  timer: number;
  kind: 'normal' | 'gold' | 'spring' | 'ice';
  targeted: boolean;
  bonusClaimed?: boolean;
}

interface InternalHexPlayer extends HexPlayerState {
  leapCd: number;
  shoveCd: number;
  coyoteTimer: number;
  lastShovedBy: string | null;
  lastShovedAt: number;
  onIce: boolean;
}

interface InternalPopup {
  x: number;
  y: number;
  text: string;
  colorHex: string;
  alpha: number;
}

interface HexDropInternalState {
  round: number;
  totalRounds: number;
  roundTimer: number;
  roundElapsed: number;
  meteorTimer: number;
  betweenRoundTimer: number;
  roundBanner: string | null;
  tiles: InternalHexTile[];
  popups: InternalPopup[];
  shoveWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  players: InternalHexPlayer[];
  soloMode: boolean;
  finished: boolean;
}

const HEX_RADIUS = 44;
const CRACK_DURATION = 1.35;
const ICE_CRACK_DURATION = 0.68;
const FALL_DURATION = 0.55;
const START_GRACE_TIME = 1.1;
const COYOTE_TIME = 0.16;
const LEAP_DURATION = 0.56;
const LEAP_COOLDOWN = 1.1;
const SHOVE_COOLDOWN = 2.2;
const SHOVE_RADIUS = 130;
const PLAYER_RADIUS = 17;
const ROUND_TIME_LIMIT = 50;

function buildHexGrid(): InternalHexTile[] {
  const tiles: InternalHexTile[] = [];
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 8;
  const dx = HEX_RADIUS * Math.sqrt(3);
  const dy = HEX_RADIUS * 1.5;
  let id = 0;

  for (let row = -4; row <= 4; row++) {
    const isOddRow = Math.abs(row) % 2 === 1;
    const rowShift = isOddRow ? dx * 0.5 : 0;
    for (let col = -7; col <= 7; col++) {
      const x = cx + col * dx + rowShift;
      const y = cy + row * dy;
      const distNorm = Math.hypot((x - cx) / 535, (y - cy) / 315);
      if (distNorm <= 0.99) {
        const roll = Math.random();
        const kind: InternalHexTile['kind'] =
          roll < 0.08 ? 'gold' : roll < 0.15 ? 'spring' : roll < 0.25 ? 'ice' : 'normal';
        tiles.push({
          id: id++,
          x,
          y,
          radius: HEX_RADIUS,
          kind,
          targeted: false,
          state: 'solid',
          progress: 0,
          timer: 0,
        });
      }
    }
  }
  return tiles;
}

function findSafeSpawnTile(tiles: InternalHexTile[], idx: number, total: number): { x: number; y: number } {
  const solid = tiles.filter((t) => t.state === 'solid');
  const pool = solid.length > 0 ? solid : tiles;
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2;
  if (total <= 1) {
    let best = pool[0];
    let bestD = Infinity;
    for (const t of pool) {
      const d = Math.hypot(t.x - cx, t.y - cy);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return { x: best.x, y: best.y };
  }

  const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
  const targetX = cx + Math.cos(angle) * 240;
  const targetY = cy + Math.sin(angle) * 145;
  let best = pool[0];
  let bestD = Infinity;
  for (const t of pool) {
    const d = Math.hypot(t.x - targetX, t.y - targetY);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  return { x: best.x, y: best.y };
}

function spawnPlayers(
  players: ServerPlayerInputState[],
  tiles: InternalHexTile[],
  prevMap?: Map<string, { score: number; roundsWon: number }>
): InternalHexPlayer[] {
  return players.map((p, idx) => {
    const pos = findSafeSpawnTile(tiles, idx, players.length);
    const prev = prevMap?.get(p.id);
    return {
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      angle: Math.atan2(ARENA_HEIGHT / 2 - pos.y, ARENA_WIDTH / 2 - pos.x),
      alive: true,
      leapTimer: 0,
      leapDuration: LEAP_DURATION,
      shoveTimer: 0,
      falling: false,
      fallProgress: 0,
      leapCd: 0,
      shoveCd: 0,
      coyoteTimer: COYOTE_TIME,
      cooldownA: 0,
      cooldownB: 0,
      score: prev?.score ?? 0,
      roundsWon: prev?.roundsWon ?? 0,
      lastShovedBy: null,
      lastShovedAt: 0,
      onIce: false,
    };
  });
}

function toSnapshot(state: HexDropInternalState): HexDropSnapshot {
  return {
    gameId: 'hex-drop',
    round: state.round,
    totalRounds: state.totalRounds,
    roundTimer: Math.max(0, state.roundTimer),
    roundBanner: state.roundBanner,
    tiles: state.tiles.map((t) => ({
      id: t.id,
      x: t.x,
      y: t.y,
      radius: t.radius,
      kind: t.kind,
      targeted: t.targeted,
      state: t.state,
      progress: t.progress,
    })),
    popups: state.popups.map((p) => ({ ...p })),
    shoveWaves: state.shoveWaves.map((s) => ({ ...s })),
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
      alive: p.alive,
      leapTimer: p.leapTimer,
      leapDuration: p.leapDuration,
      shoveTimer: p.shoveTimer,
      falling: p.falling,
      fallProgress: p.fallProgress,
      cooldownA: Math.min(1, Math.max(0, p.leapCd / LEAP_COOLDOWN)),
      cooldownB: Math.min(1, Math.max(0, p.shoveCd / SHOVE_COOLDOWN)),
      score: p.score,
      roundsWon: p.roundsWon,
    })),
  };
}

function buildRankings(
  state: HexDropInternalState,
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

export const hexDropModule: ServerGameModule<HexDropInternalState> = {
  id: 'hex-drop',

  createState(players: ServerPlayerInputState[], settingValue: number): HexDropInternalState {
    const totalRounds = Math.max(1, Math.min(7, settingValue || 3));
    const tiles = buildHexGrid();
    return {
      round: 1,
      totalRounds,
      roundTimer: ROUND_TIME_LIMIT,
      roundElapsed: 0,
      meteorTimer: 6.5,
      betweenRoundTimer: 0,
      roundBanner: null,
      tiles,
      popups: [],
      shoveWaves: [],
      players: spawnPlayers(players, tiles),
      soloMode: players.length <= 1,
      finished: false,
    };
  },

  addPlayer(state: HexDropInternalState, p: ServerPlayerInputState): void {
    if (state.players.some((x) => x.id === p.id)) return;
    const pos = findSafeSpawnTile(state.tiles, state.players.length, Math.max(2, state.players.length + 1));
    state.players.push({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      x: pos.x,
      y: pos.y,
      vx: 0,
      vy: 0,
      angle: 0,
      alive: true,
      leapTimer: 0.4,
      leapDuration: LEAP_DURATION,
      shoveTimer: 0,
      falling: false,
      fallProgress: 0,
      leapCd: 0,
      shoveCd: 0,
      coyoteTimer: COYOTE_TIME,
      cooldownA: 0,
      cooldownB: 0,
      score: 0,
      roundsWon: 0,
      lastShovedBy: null,
      lastShovedAt: 0,
      onIce: false,
    });
    if (state.players.length > 1) state.soloMode = false;
  },

  step(state: HexDropInternalState, inputPlayers: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(inputPlayers.map((p) => [p.id, p]));
    const now = Date.now();

    for (let i = state.shoveWaves.length - 1; i >= 0; i--) {
      const w = state.shoveWaves[i];
      w.radius += 460 * dt;
      w.alpha = Math.max(0, 1 - w.radius / w.maxRadius);
      if (w.radius >= w.maxRadius) state.shoveWaves.splice(i, 1);
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
          state.roundElapsed = 0;
          state.meteorTimer = 6.0;
          state.roundBanner = null;
          state.tiles = buildHexGrid();
          const prevMap = new Map(
            state.players.map((p) => [p.id, { score: p.score, roundsWon: p.roundsWon }])
          );
          state.players = spawnPlayers(inputPlayers, state.tiles, prevMap);
          sounds.push({ type: 'go' });
        }
      }
    } else {
      state.roundTimer = Math.max(0, state.roundTimer - dt);
      state.roundElapsed += dt;

      // Periodic anti-camping meteor hex drops
      if (state.roundElapsed > 6) {
        state.meteorTimer -= dt;
        if (state.meteorTimer <= 0) {
          state.meteorTimer = Math.max(2.2, 4.4 - state.roundElapsed * 0.05);
          const solidPool = state.tiles.filter((t) => t.state === 'solid');
          const count = Math.min(3, solidPool.length);
          for (let m = 0; m < count; m++) {
            const pick = solidPool[Math.floor(Math.random() * solidPool.length)];
            if (pick && pick.state === 'solid') {
              pick.state = 'cracking';
              pick.targeted = true;
              pick.timer = 0;
              pick.progress = 0;
            }
          }
        }
      }

      // Update cracking / falling tiles
      for (const tile of state.tiles) {
        if (tile.state === 'cracking') {
          const dur = tile.kind === 'ice' ? ICE_CRACK_DURATION : CRACK_DURATION;
          tile.timer += dt;
          tile.progress = Math.min(1, tile.timer / dur);
          if (tile.timer >= dur) {
            tile.state = 'falling';
            tile.timer = 0;
            tile.progress = 0;
            tile.targeted = false;
          }
        } else if (tile.state === 'falling') {
          tile.timer += dt;
          tile.progress = Math.min(1, tile.timer / FALL_DURATION);
          if (tile.timer >= FALL_DURATION) {
            tile.state = 'gone';
            tile.progress = 1;
          }
        }
      }

      for (const p of state.players) {
        if (!p.alive) continue;

        if (p.falling) {
          p.fallProgress = Math.min(1, p.fallProgress + dt * 1.55);
          p.x += p.vx * dt * 0.35;
          p.y += p.vy * dt * 0.35 + 42 * dt;
          if (p.fallProgress >= 1) {
            p.alive = false;
            if (p.lastShovedBy && now - p.lastShovedAt < 3500) {
              const pusher = state.players.find((x) => x.id === p.lastShovedBy);
              if (pusher) {
                pusher.score += 100;
                state.popups.push({ x: pusher.x, y: pusher.y - 30, text: '+100 SHOVE KO!', colorHex: pusher.colorHex, alpha: 1 });
                haptics.push({ playerId: pusher.id, pattern: [35, 25, 60], reason: 'score' });
              }
            }
          }
          continue;
        }

        const src = inputMap.get(p.id);
        p.leapCd = Math.max(0, p.leapCd - dt);
        p.shoveCd = Math.max(0, p.shoveCd - dt);
        p.leapTimer = Math.max(0, p.leapTimer - dt);
        p.shoveTimer = Math.max(0, p.shoveTimer - dt);

        if (src) {
          const { dx, dy, a, b } = src.input;
          const mag = Math.hypot(dx, dy);
          if (mag > 0.08) {
            const nx = dx / Math.max(1, mag);
            const ny = dy / Math.max(1, mag);
            const accel = p.leapTimer > 0 ? 860 : p.onIce ? 1200 : 1480;
            p.vx += nx * accel * dt;
            p.vy += ny * accel * dt;
            p.angle = Math.atan2(ny, nx);
          }

          if (a && !src.prevA && p.leapCd <= 0 && p.leapTimer <= 0) {
            const dirX = mag > 0.12 ? dx / mag : Math.cos(p.angle);
            const dirY = mag > 0.12 ? dy / mag : Math.sin(p.angle);
            p.vx = dirX * 355;
            p.vy = dirY * 355;
            p.leapDuration = LEAP_DURATION;
            p.leapTimer = LEAP_DURATION;
            p.leapCd = LEAP_COOLDOWN;
            p.coyoteTimer = COYOTE_TIME;
            sounds.push({ type: 'boost', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 38, reason: 'leap' });
          }

          if (b && !src.prevB && p.shoveCd <= 0) {
            p.shoveCd = SHOVE_COOLDOWN;
            p.shoveTimer = 0.22;
            state.shoveWaves.push({
              x: p.x,
              y: p.y,
              radius: PLAYER_RADIUS,
              maxRadius: SHOVE_RADIUS,
              colorHex: p.colorHex,
              alpha: 1,
            });
            sounds.push({ type: 'pulse', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: [35, 25, 50], reason: 'shove' });

            for (const other of state.players) {
              if (!other.alive || other.falling || other.id === p.id) continue;
              const ox = other.x - p.x;
              const oy = other.y - p.y;
              const dist = Math.hypot(ox, oy);
              if (dist > 0.01 && dist < SHOVE_RADIUS) {
                const falloff = 1 - dist / SHOVE_RADIUS;
                const push = 230 + falloff * 190;
                other.vx += (ox / dist) * push;
                other.vy += (oy / dist) * push;
                other.lastShovedBy = p.id;
                other.lastShovedAt = now;
                haptics.push({ playerId: other.id, pattern: 68, reason: 'knockback' });
              }
            }
          }
        }

        const damping =
          p.leapTimer > 0
            ? Math.pow(0.5, dt)
            : p.onIce
              ? Math.pow(0.28, dt)
              : Math.pow(0.015, dt);
        p.vx *= damping;
        p.vy *= damping;

        const maxSpeed = p.leapTimer > 0 ? 395 : p.onIce ? 320 : 275;
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > maxSpeed) {
          p.vx = (p.vx / speed) * maxSpeed;
          p.vy = (p.vy / speed) * maxSpeed;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.onIce = false;

        if (p.leapTimer <= 0) {
          let standingTile: InternalHexTile | null = null;
          let bestDist = Infinity;
          for (const tile of state.tiles) {
            if (tile.state === 'gone' || (tile.state === 'falling' && tile.progress > 0.6)) continue;
            const d = Math.hypot(p.x - tile.x, p.y - tile.y);
            if (d <= tile.radius * 1.14 && d < bestDist) {
              bestDist = d;
              standingTile = tile;
            }
          }

          if (!standingTile) {
            p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
            if (p.coyoteTimer <= 0) {
              p.falling = true;
              p.fallProgress = 0;
              sounds.push({ type: 'ko', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: [70, 35, 95], reason: 'falloff' });
            }
          } else {
            p.coyoteTimer = COYOTE_TIME;
            if (standingTile.kind === 'ice') p.onIce = true;

            if (standingTile.kind === 'gold' && !standingTile.bonusClaimed) {
              standingTile.bonusClaimed = true;
              p.score += 45;
              state.popups.push({ x: standingTile.x, y: standingTile.y - 22, text: '+45 GOLD!', colorHex: '#FFB800', alpha: 1 });
              sounds.push({ type: 'pickup', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: 30, reason: 'gold' });
            } else if (standingTile.kind === 'spring' && !standingTile.bonusClaimed && state.roundElapsed >= 0.6) {
              standingTile.bonusClaimed = true;
              const spd = Math.hypot(p.vx, p.vy);
              const dirX = spd > 20 ? p.vx / spd : Math.cos(p.angle);
              const dirY = spd > 20 ? p.vy / spd : Math.sin(p.angle);
              p.vx = dirX * 390;
              p.vy = dirY * 390;
              p.leapDuration = 0.78;
              p.leapTimer = 0.78;
              p.score += 20;
              state.popups.push({ x: standingTile.x, y: standingTile.y - 24, text: 'SPRING JUMP!', colorHex: '#10D98B', alpha: 1 });
              sounds.push({ type: 'boost', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: [25, 20, 40], reason: 'spring' });
            }

            if (standingTile.state === 'solid' && state.roundElapsed >= START_GRACE_TIME) {
              standingTile.state = 'cracking';
              standingTile.timer = 0;
              standingTile.progress = 0;
              p.score += 5;
            }
          }
        }
      }

      for (let i = 0; i < state.players.length; i++) {
        const a = state.players[i];
        if (!a.alive || a.falling || a.leapTimer > 0) continue;
        for (let j = i + 1; j < state.players.length; j++) {
          const b = state.players[j];
          if (!b.alive || b.falling || b.leapTimer > 0) continue;
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
            a.vx -= nx * 70;
            a.vy -= ny * 70;
            b.vx += nx * 70;
            b.vy += ny * 70;
            sounds.push({ type: 'bump', intensity: 0.45 });
            haptics.push({ playerId: a.id, pattern: 36, reason: 'bump' });
            haptics.push({ playerId: b.id, pattern: 36, reason: 'bump' });
          }
        }
      }

      const standing = state.players.filter((p) => p.alive && !p.falling);
      const anyFalling = state.players.some((p) => p.alive && p.falling);

      if (state.soloMode) {
        if ((standing.length === 0 && !anyFalling) || state.roundTimer <= 0) {
          if (standing.length === 1) {
            standing[0].score += 150;
            standing[0].roundsWon += 1;
            state.roundBanner = `${standing[0].name} Survived!`;
            sounds.push({ type: 'win', playerId: standing[0].id });
          } else {
            state.roundBanner = 'Fell Into the Abyss!';
          }
          state.betweenRoundTimer = 2.0;
        }
      } else {
        if ((standing.length <= 1 && !anyFalling) || state.roundTimer <= 0) {
          if (standing.length === 1) {
            standing[0].score += 200;
            standing[0].roundsWon += 1;
            state.roundBanner = `${standing[0].name} Wins Round ${state.round}`;
            sounds.push({ type: 'win', playerId: standing[0].id });
          } else if (standing.length > 1) {
            for (const p of standing) p.score += 80;
            state.roundBanner = `Time Up — ${standing.length} Survived`;
          } else {
            state.roundBanner = 'Everyone Dropped!';
          }
          state.betweenRoundTimer = 2.2;
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: p.score,
        alive: p.alive && !p.falling,
        statText: p.alive && !p.falling ? `${p.roundsWon}W · ${p.score} pts` : `OUT · ${p.score} pts`,
        cooldownA: Math.min(1, Math.max(0, p.leapCd / LEAP_COOLDOWN)),
        cooldownB: Math.min(1, Math.max(0, p.shoveCd / SHOVE_COOLDOWN)),
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

  getSnapshot(state: HexDropInternalState): HexDropSnapshot {
    return toSnapshot(state);
  },

  getRankings(state: HexDropInternalState, players: ServerPlayerInputState[]): RankingEntry[] {
    return buildRankings(state, players);
  },
};
