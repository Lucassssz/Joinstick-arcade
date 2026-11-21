import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type HookLineState,
  type HookPlayerState,
  type HookShotSnapshot,
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

interface InternalHookPlayer extends HookPlayerState {
  vx: number;
  vy: number;
  hookCd: number;
  parryCd: number;
  lastTouchedBy: string | null;
  lastTouchedTime: number;
}

interface InternalHook {
  ownerId: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dist: number;
  maxDist: number;
  state: 'extending' | 'retracting' | 'pulling';
  targetId: string | null;
}

interface HookShotState {
  timeLeft: number;
  totalTime: number;
  elapsed: number;
  islands: { x: number; y: number; w: number; h: number }[];
  hooks: InternalHook[];
  waves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  entities: InternalHookPlayer[];
}

const PLAYER_R = 18;
const HOOK_CD = 1.5;
const PARRY_CD = 2.6;

const ISLANDS = [
  { x: 430, y: 230, w: 340, h: 260 }, // Center platform
  { x: 110, y: 110, w: 235, h: 205 }, // Top-left
  { x: 855, y: 110, w: 235, h: 205 }, // Top-right
  { x: 110, y: 405, w: 235, h: 205 }, // Bottom-left
  { x: 855, y: 405, w: 235, h: 205 }, // Bottom-right
];

function isOnIsland(x: number, y: number): boolean {
  for (const isl of ISLANDS) {
    if (x >= isl.x - 10 && x <= isl.x + isl.w + 10 && y >= isl.y - 10 && y <= isl.y + isl.h + 10) {
      return true;
    }
  }
  return false;
}

function respawnSpot(idx: number): { x: number; y: number } {
  const isl = ISLANDS[idx % ISLANDS.length];
  return {
    x: isl.x + isl.w / 2 + (Math.random() - 0.5) * 60,
    y: isl.y + isl.h / 2 + (Math.random() - 0.5) * 50,
  };
}

export const hookShotModule: ServerGameModule<HookShotState> = {
  id: 'hook-shot',

  createState(players, settingValue) {
    const totalTime = Math.max(45, Math.min(120, settingValue || 75));
    const entities: InternalHookPlayer[] = players.map((p, i) => {
      const sp = respawnSpot(i);
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        isBot: p.isBot,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        angle: Math.atan2(ARENA_HEIGHT / 2 - sp.y, ARENA_WIDTH / 2 - sp.x),
        alive: true,
        falling: false,
        fallProgress: 0,
        respawnTimer: 0,
        parryTimer: 0,
        hookedBy: null,
        kos: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        hookCd: 0,
        parryCd: 0,
        lastTouchedBy: null,
        lastTouchedTime: 0,
      };
    });

    return {
      timeLeft: totalTime,
      totalTime,
      elapsed: 0,
      islands: ISLANDS,
      hooks: [],
      waves: [],
      entities,
    };
  },

  addPlayer(state, player) {
    if (!state.entities.some((e) => e.id === player.id)) {
      const sp = respawnSpot(state.entities.length);
      state.entities.push({
        id: player.id,
        slotIndex: player.slotIndex,
        name: player.name,
        colorHex: player.color.hex,
        x: sp.x,
        y: sp.y,
        vx: 0,
        vy: 0,
        angle: 0,
        alive: true,
        falling: false,
        fallProgress: 0,
        respawnTimer: 0,
        parryTimer: 0,
        hookedBy: null,
        kos: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        hookCd: 0,
        parryCd: 0,
        lastTouchedBy: null,
        lastTouchedTime: 0,
      });
    }
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const inputById = new Map(players.map((p) => [p.id, p]));

    state.elapsed += dt;
    state.timeLeft = Math.max(0, state.timeLeft - dt);

    for (let i = state.waves.length - 1; i >= 0; i--) {
      const w = state.waves[i];
      w.radius += 480 * dt;
      w.alpha = Math.max(0, 1 - w.radius / w.maxRadius);
      if (w.radius >= w.maxRadius) state.waves.splice(i, 1);
    }

    for (let idx = 0; idx < state.entities.length; idx++) {
      const e = state.entities[idx];
      e.hookCd = Math.max(0, e.hookCd - dt);
      e.parryCd = Math.max(0, e.parryCd - dt);
      e.parryTimer = Math.max(0, e.parryTimer - dt);

      if (e.falling) {
        e.fallProgress += dt * 1.9;
        if (e.fallProgress >= 1) {
          e.falling = false;
          e.alive = false;
          e.respawnTimer = 1.6;
          e.hookedBy = null;
          if (e.lastTouchedBy && state.elapsed - e.lastTouchedTime < 4.5) {
            const killer = state.entities.find((k) => k.id === e.lastTouchedBy);
            if (killer && killer.id !== e.id) {
              killer.kos += 1;
              killer.score += 100;
              if (!killer.isBot) haptics.push({ playerId: killer.id, pattern: [35, 25, 55], reason: 'hook-ko' });
            }
          }
          sounds.push({ type: 'ko', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: [75, 35, 75], reason: 'pit-fall' });
        }
        continue;
      }

      if (!e.alive) {
        e.respawnTimer -= dt;
        if (e.respawnTimer <= 0) {
          const sp = respawnSpot(idx + Math.floor(state.elapsed));
          e.x = sp.x;
          e.y = sp.y;
          e.vx = 0;
          e.vy = 0;
          e.alive = true;
          e.falling = false;
          e.fallProgress = 0;
          e.hookedBy = null;
          e.lastTouchedBy = null;
        }
        continue;
      }

      let dx = 0;
      let dy = 0;
      let pressA = false;
      let pressB = false;

      const inp = inputById.get(e.id);
      if (inp) {
        dx = inp.input.dx;
        dy = inp.input.dy;
        pressA = inp.input.a && !inp.prevA;
        pressB = inp.input.b && !inp.prevB;
      }

      const mag = Math.hypot(dx, dy);
      const nx = mag > 0.12 ? dx / mag : 0;
      const ny = mag > 0.12 ? dy / mag : 0;
      if (mag > 0.12) e.angle = Math.atan2(ny, nx);

      // Button A: Fire Grapple Hook
      if (pressA && e.hookCd <= 0 && !e.hookedBy) {
        e.hookCd = HOOK_CD;
        state.hooks.push({
          ownerId: e.id,
          colorHex: e.colorHex,
          x: e.x + Math.cos(e.angle) * 20,
          y: e.y + Math.sin(e.angle) * 20,
          vx: Math.cos(e.angle) * 860,
          vy: Math.sin(e.angle) * 860,
          dist: 0,
          maxDist: 470,
          state: 'extending',
          targetId: null,
        });
        sounds.push({ type: 'shoot', playerId: e.id });
        if (!e.isBot) haptics.push({ playerId: e.id, pattern: 22, reason: 'hook-fire' });
      }

      // Button B: Shock Parry (snaps incoming hooks & blasts rivals back!)
      if (pressB && e.parryCd <= 0) {
        e.parryCd = PARRY_CD;
        e.parryTimer = 0.35;
        e.hookedBy = null;
        // Snap any hooks pulling this player
        for (const hk of state.hooks) {
          if (hk.targetId === e.id) {
            hk.targetId = null;
            hk.state = 'retracting';
          }
        }
        const waveR = 145;
        state.waves.push({ x: e.x, y: e.y, radius: 18, maxRadius: waveR, colorHex: e.colorHex, alpha: 0.9 });
        for (const other of state.entities) {
          if (other.id === e.id || !other.alive || other.falling) continue;
          const odx = other.x - e.x;
          const ody = other.y - e.y;
          const od = Math.hypot(odx, ody) || 1;
          if (od < waveR) {
            other.vx += (odx / od) * 580;
            other.vy += (ody / od) * 580;
            other.lastTouchedBy = e.id;
            other.lastTouchedTime = state.elapsed;
            if (!other.isBot) haptics.push({ playerId: other.id, pattern: 35, reason: 'parry-knock' });
          }
        }
        sounds.push({ type: 'pulse', playerId: e.id });
        if (!e.isBot) haptics.push({ playerId: e.id, pattern: [24, 20, 34], reason: 'shock-parry' });
      }

      if (!e.hookedBy) {
        const tvx = nx * 315;
        const tvy = ny * 315;
        e.vx += (tvx - e.vx) * Math.min(1, 10 * dt);
        e.vy += (tvy - e.vy) * Math.min(1, 10 * dt);
        e.x = Math.max(30, Math.min(ARENA_WIDTH - 30, e.x + e.vx * dt));
        e.y = Math.max(30, Math.min(ARENA_HEIGHT - 30, e.y + e.vy * dt));

        // Gentle ledge guard when walking (so players don't accidentally stroll off—you only fall when knocked/hooked!)
        if (!isOnIsland(e.x, e.y)) {
          const knockedFast = Math.hypot(e.vx, e.vy) > 360 || (e.lastTouchedBy && state.elapsed - e.lastTouchedTime < 1.6);
          if (knockedFast) {
            e.falling = true;
            e.fallProgress = 0;
          } else {
            // Pull back onto nearest island edge gently so accidental joystick slips feel forgiving!
            let bestX = e.x;
            let bestY = e.y;
            let bestD = Infinity;
            for (const isl of ISLANDS) {
              const cx = Math.max(isl.x + 8, Math.min(e.x, isl.x + isl.w - 8));
              const cy = Math.max(isl.y + 8, Math.min(e.y, isl.y + isl.h - 8));
              const d = Math.hypot(e.x - cx, e.y - cy);
              if (d < bestD) {
                bestD = d;
                bestX = cx;
                bestY = cy;
              }
            }
            if (bestD < 32) {
              e.x = bestX;
              e.y = bestY;
            } else {
              e.falling = true;
              e.fallProgress = 0;
            }
          }
        }
      }

      e.cooldownA = e.hookCd / HOOK_CD;
      e.cooldownB = e.parryCd / PARRY_CD;
    }

    // Update grapple hooks
    for (let i = state.hooks.length - 1; i >= 0; i--) {
      const hk = state.hooks[i];
      const owner = state.entities.find((e) => e.id === hk.ownerId);
      if (!owner || !owner.alive || owner.falling) {
        if (hk.targetId) {
          const tgt = state.entities.find((e) => e.id === hk.targetId);
          if (tgt) tgt.hookedBy = null;
        }
        state.hooks.splice(i, 1);
        continue;
      }

      if (hk.state === 'extending') {
        const stepDist = Math.hypot(hk.vx * dt, hk.vy * dt);
        hk.x += hk.vx * dt;
        hk.y += hk.vy * dt;
        hk.dist += stepDist;

        // Check catching a rival
        for (const target of state.entities) {
          if (target.id === owner.id || !target.alive || target.falling) continue;
          if (Math.hypot(hk.x - target.x, hk.y - target.y) < PLAYER_R + 18) {
            if (target.parryTimer > 0) {
              hk.state = 'retracting';
              sounds.push({ type: 'bump', intensity: 0.9 });
            } else {
              hk.state = 'pulling';
              hk.targetId = target.id;
              target.hookedBy = owner.id;
              target.lastTouchedBy = owner.id;
              target.lastTouchedTime = state.elapsed;
              sounds.push({ type: 'hit', playerId: owner.id });
              if (!owner.isBot) haptics.push({ playerId: owner.id, pattern: [24, 20, 38], reason: 'hook-latch' });
              if (!target.isBot) haptics.push({ playerId: target.id, pattern: [40, 20, 40], reason: 'hooked' });
            }
            break;
          }
        }

        if (hk.state === 'extending' && (hk.dist >= hk.maxDist || hk.x < 10 || hk.x > ARENA_WIDTH - 10 || hk.y < 10 || hk.y > ARENA_HEIGHT - 10)) {
          hk.state = 'retracting';
        }
      } else if (hk.state === 'pulling' && hk.targetId) {
        const target = state.entities.find((e) => e.id === hk.targetId);
        if (!target || !target.alive) {
          state.hooks.splice(i, 1);
          continue;
        }
        const dx = owner.x - target.x;
        const dy = owner.y - target.y;
        const d = Math.hypot(dx, dy) || 1;
        const pullSpeed = 720;
        target.x += (dx / d) * pullSpeed * dt;
        target.y += (dy / d) * pullSpeed * dt;
        target.vx = (dx / d) * 440;
        target.vy = (dy / d) * 440;
        hk.x = target.x;
        hk.y = target.y;

        if (d < 56) {
          // Release with momentum right past the edge or into a gap!
          target.hookedBy = null;
          target.lastTouchedBy = owner.id;
          target.lastTouchedTime = state.elapsed;
          if (!isOnIsland(target.x, target.y)) {
            target.falling = true;
            target.fallProgress = 0;
          }
          state.hooks.splice(i, 1);
        }
      } else {
        // Retracting
        const dx = owner.x - hk.x;
        const dy = owner.y - hk.y;
        const d = Math.hypot(dx, dy) || 1;
        hk.x += (dx / d) * 1050 * dt;
        hk.y += (dy / d) * 1050 * dt;
        if (d < 36) state.hooks.splice(i, 1);
      }
    }

    for (const p of players) {
      const e = state.entities.find((en) => en.id === p.id);
      if (!e) continue;
      hudUpdates[p.id] = {
        score: e.score,
        alive: e.alive && !e.falling,
        statText: `${e.kos} Pit KOs`,
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
      };
    }

    const finished = state.timeLeft <= 0;
    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished,
      rankings: finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state): HookShotSnapshot {
    const hookLines: HookLineState[] = [];
    for (const hk of state.hooks) {
      const owner = state.entities.find((e) => e.id === hk.ownerId);
      if (!owner) continue;
      hookLines.push({
        ownerId: hk.ownerId,
        colorHex: hk.colorHex,
        x1: owner.x,
        y1: owner.y,
        x2: hk.x,
        y2: hk.y,
        state: hk.state,
      });
    }
    return {
      gameId: 'hook-shot',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      islands: state.islands,
      hooks: hookLines,
      waves: state.waves.map((w) => ({ ...w })),
      players: state.entities.map((e) => ({
        id: e.id,
        slotIndex: e.slotIndex,
        name: e.name,
        colorHex: e.colorHex,
        isBot: e.isBot,
        x: e.x,
        y: e.y,
        angle: e.angle,
        alive: e.alive,
        falling: e.falling,
        fallProgress: e.fallProgress,
        respawnTimer: e.respawnTimer,
        parryTimer: e.parryTimer,
        hookedBy: e.hookedBy,
        kos: e.kos,
        score: e.score,
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...players]
      .map((p) => ({ p, e: state.entities.find((en) => en.id === p.id) }))
      .sort((a, b) => (b.e?.score ?? 0) - (a.e?.score ?? 0));
    return sorted.map(({ p, e }, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      rank: idx + 1,
      score: e?.score ?? 0,
      highlight: `${e?.kos ?? 0} grapple KOs`,
    }));
  },
};
