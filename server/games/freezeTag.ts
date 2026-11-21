import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type FreezePlayerState,
  type FreezeTagSnapshot,
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

interface InternalFreezePlayer extends FreezePlayerState {
  vx: number;
  vy: number;
  cdA: number;
  cdB: number;
  skateTimer: number;
  auraTimer: number;
}

interface InternalBolt {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl: number;
}

interface InternalTrap {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  r: number;
  ttl: number;
}

interface FreezeTagState {
  timeLeft: number;
  totalTime: number;
  nextId: number;
  pickupTimer: number;
  banner: string | null;
  bannerTimer: number;
  bolts: InternalBolt[];
  traps: InternalTrap[];
  icePatches: { x: number; y: number; r: number }[];
  pickups: { id: string; kind: 'thaw-star' | 'turbo-skates' | 'frost-aura'; x: number; y: number }[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pillars: { x: number; y: number; r: number }[];
  entities: InternalFreezePlayer[];
}

const PLAYER_R = 19;
const CD_A = 1.9;
const CD_B = 3.2;

export const freezeTagModule: ServerGameModule<FreezeTagState> = {
  id: 'freeze-tag',

  createState(players, settingValue) {
    const totalTime = Math.max(30, Math.min(120, settingValue || 60));
    const entities: InternalFreezePlayer[] = [];
    const totalCount = players.length;
    const hunterCount = totalCount >= 6 ? 2 : totalCount >= 2 ? 1 : 0;

    const hunterIndices = new Set<number>();
    if (hunterCount > 0) {
      const first = Math.floor(Math.random() * totalCount);
      hunterIndices.add(first);
      if (hunterCount === 2) {
        hunterIndices.add((first + 1) % totalCount);
      }
    }

    for (let i = 0; i < totalCount; i++) {
      const p = players[i];
      const role: 'hunter' | 'runner' = hunterIndices.has(i) ? 'hunter' : 'runner';
      const ang = (i / Math.max(1, totalCount)) * Math.PI * 2;
      entities.push({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        isBot: p.isBot,
        role,
        x: role === 'hunter' ? ARENA_WIDTH / 2 : ARENA_WIDTH / 2 + Math.cos(ang) * 340,
        y: role === 'hunter' ? ARENA_HEIGHT / 2 : ARENA_HEIGHT / 2 + Math.sin(ang) * 230,
        vx: 0,
        vy: 0,
        angle: ang,
        frozen: false,
        dashTimer: 0,
        immuneTimer: 1.8,
        skateTimer: 0,
        auraTimer: 0,
        saves: 0,
        freezes: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        cdA: 0,
        cdB: 0,
      });
    }

    return {
      timeLeft: totalTime,
      totalTime,
      nextId: 1,
      pickupTimer: 3.5,
      banner: 'RUNNERS: THAW FROZEN FRIENDS!',
      bannerTimer: 2.2,
      bolts: [],
      traps: [],
      icePatches: [
        { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, r: 85 },
        { x: 200, y: ARENA_HEIGHT / 2, r: 62 },
        { x: ARENA_WIDTH - 200, y: ARENA_HEIGHT / 2, r: 62 },
      ],
      pickups: [],
      popups: [],
      pillars: [
        { x: 320, y: 200, r: 30 },
        { x: ARENA_WIDTH - 320, y: 200, r: 30 },
        { x: 320, y: ARENA_HEIGHT - 200, r: 30 },
        { x: ARENA_WIDTH - 320, y: ARENA_HEIGHT - 200, r: 30 },
      ],
      entities,
    };
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const inputById = new Map(players.map((p) => [p.id, p]));

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }

    for (let i = state.traps.length - 1; i >= 0; i--) {
      state.traps[i].ttl -= dt;
      if (state.traps[i].ttl <= 0) state.traps.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= 28 * dt;
      state.popups[i].alpha -= dt * 1.1;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    state.pickupTimer -= dt;
    if (state.pickupTimer <= 0 && state.pickups.length < 3) {
      const roll = Math.random();
      const kind: 'thaw-star' | 'turbo-skates' | 'frost-aura' =
        roll < 0.36 ? 'thaw-star' : roll < 0.72 ? 'turbo-skates' : 'frost-aura';
      state.pickups.push({
        id: `fp_${state.nextId++}`,
        kind,
        x: 150 + Math.random() * (ARENA_WIDTH - 300),
        y: 110 + Math.random() * (ARENA_HEIGHT - 220),
      });
      state.pickupTimer = 5.2;
    }

    const freezeRunner = (runner: InternalFreezePlayer, hunter?: InternalFreezePlayer) => {
      if (runner.frozen || runner.immuneTimer > 0 || runner.role !== 'runner') return;
      runner.frozen = true;
      runner.vx = 0;
      runner.vy = 0;
      if (hunter) {
        hunter.freezes += 1;
        hunter.score += 65;
        state.popups.push({ x: runner.x, y: runner.y - 24, text: 'FROZEN +65!', colorHex: '#38BDF8', alpha: 1 });
        if (!hunter.isBot) haptics.push({ playerId: hunter.id, pattern: [26, 20, 42], reason: 'freeze-hit' });
      }
      sounds.push({ type: 'hit', playerId: runner.id });
      if (!runner.isBot) haptics.push({ playerId: runner.id, pattern: [60, 35, 60], reason: 'frozen' });
    };

    for (const e of state.entities) {
      e.cdA = Math.max(0, e.cdA - dt);
      e.cdB = Math.max(0, e.cdB - dt);
      e.dashTimer = Math.max(0, e.dashTimer - dt);
      e.immuneTimer = Math.max(0, e.immuneTimer - dt);
      e.skateTimer = Math.max(0, e.skateTimer - dt);
      e.auraTimer = Math.max(0, e.auraTimer - dt);

      if (e.frozen) {
        e.cooldownA = 1;
        e.cooldownB = 1;
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

      // Button A: Hunter fires Frost Bolt; Runner Sprint Burst
      if (pressA && e.cdA <= 0) {
        e.cdA = CD_A;
        if (e.role === 'hunter') {
          state.bolts.push({
            id: `fb_${state.nextId++}`,
            ownerId: e.id,
            x: e.x + Math.cos(e.angle) * 24,
            y: e.y + Math.sin(e.angle) * 24,
            vx: Math.cos(e.angle) * 560,
            vy: Math.sin(e.angle) * 560,
            ttl: 1.15,
          });
          sounds.push({ type: 'shoot', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: 22, reason: 'frost-bolt' });
        } else {
          e.dashTimer = 0.28;
          e.vx = (mag > 0.12 ? nx : Math.cos(e.angle)) * 640;
          e.vy = (mag > 0.12 ? ny : Math.sin(e.angle)) * 640;
          sounds.push({ type: 'boost', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: 20, reason: 'sprint' });
        }
      }

      // Button B: Hunter drops Ice Trap; Runner Slide Boost
      if (pressB && e.cdB <= 0) {
        e.cdB = CD_B;
        if (e.role === 'hunter') {
          state.traps.push({
            id: `tr_${state.nextId++}`,
            ownerId: e.id,
            x: e.x,
            y: e.y,
            r: 42,
            ttl: 7.5,
          });
          sounds.push({ type: 'pulse', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: [18, 18, 25], reason: 'ice-trap' });
        } else {
          e.dashTimer = 0.34;
          e.immuneTimer = Math.max(e.immuneTimer, 0.34);
          e.vx = (mag > 0.12 ? nx : Math.cos(e.angle)) * 680;
          e.vy = (mag > 0.12 ? ny : Math.sin(e.angle)) * 680;
          sounds.push({ type: 'boost', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: [18, 20, 26], reason: 'slide' });
        }
      }

      const onIcePatch = state.icePatches.some((ip) => Math.hypot(e.x - ip.x, e.y - ip.y) < ip.r);
      const skateMult = e.skateTimer > 0 ? 1.32 : onIcePatch ? 1.18 : 1;
      const baseSpeed = e.dashTimer > 0 ? 640 : (e.role === 'hunter' ? 345 : 325) * skateMult;
      const tvx = e.dashTimer > 0 ? e.vx : nx * baseSpeed;
      const tvy = e.dashTimer > 0 ? e.vy : ny * baseSpeed;
      const accel = e.dashTimer > 0 ? 4 : onIcePatch ? 5.5 : 11; // Extra glide on slick ice patches
      e.vx += (tvx - e.vx) * Math.min(1, accel * dt);
      e.vy += (tvy - e.vy) * Math.min(1, accel * dt);

      e.x = Math.max(38, Math.min(ARENA_WIDTH - 38, e.x + e.vx * dt));
      e.y = Math.max(38, Math.min(ARENA_HEIGHT - 38, e.y + e.vy * dt));

      for (const pil of state.pillars) {
        const pdx = e.x - pil.x;
        const pdy = e.y - pil.y;
        const pd = Math.hypot(pdx, pdy) || 1;
        if (pd < pil.r + PLAYER_R) {
          e.x = pil.x + (pdx / pd) * (pil.r + PLAYER_R);
          e.y = pil.y + (pdy / pd) * (pil.r + PLAYER_R);
        }
      }

      // Ice rink pickups
      for (let pi = state.pickups.length - 1; pi >= 0; pi--) {
        const pk = state.pickups[pi];
        if (Math.hypot(e.x - pk.x, e.y - pk.y) < PLAYER_R + 18) {
          if (pk.kind === 'thaw-star') {
            if (e.role === 'runner') {
              const frozenAlly = state.entities.find((a) => a.role === 'runner' && a.frozen);
              if (frozenAlly) {
                frozenAlly.frozen = false;
                frozenAlly.immuneTimer = 2.0;
                e.saves += 1;
                e.score += 75;
                state.popups.push({ x: e.x, y: e.y - 26, text: 'STAR THAW +75!', colorHex: '#FFB800', alpha: 1 });
              } else {
                e.score += 45;
                state.popups.push({ x: e.x, y: e.y - 26, text: '+45 STAR!', colorHex: '#FFB800', alpha: 1 });
              }
            } else {
              e.cdA = 0;
              e.score += 45;
              state.popups.push({ x: e.x, y: e.y - 26, text: 'BOLT READY +45', colorHex: '#FFB800', alpha: 1 });
            }
          } else if (pk.kind === 'turbo-skates') {
            e.skateTimer = 5.5;
            state.popups.push({ x: e.x, y: e.y - 26, text: 'TURBO SKATES!', colorHex: '#10D98B', alpha: 1 });
          } else {
            e.auraTimer = 5.5;
            if (e.role === 'runner') e.immuneTimer = Math.max(e.immuneTimer, 3.0);
            state.popups.push({
              x: e.x,
              y: e.y - 26,
              text: e.role === 'runner' ? 'ICE SHIELD!' : 'FROST AURA!',
              colorHex: '#00C2FF',
              alpha: 1,
            });
          }
          state.pickups.splice(pi, 1);
          sounds.push({ type: 'pickup', playerId: e.id });
          if (!e.isBot) haptics.push({ playerId: e.id, pattern: 18, reason: 'ice-pickup' });
        }
      }

      if (e.role === 'runner') {
        e.score += dt * 4;
      }

      e.cooldownA = e.cdA / CD_A;
      e.cooldownB = e.cdB / CD_B;
    }

    // Update bolts
    for (let i = state.bolts.length - 1; i >= 0; i--) {
      const b = state.bolts[i];
      b.ttl -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.ttl <= 0 || b.x < 10 || b.x > ARENA_WIDTH - 10 || b.y < 10 || b.y > ARENA_HEIGHT - 10) {
        state.bolts.splice(i, 1);
        continue;
      }
      const hitPillar = state.pillars.some((p) => Math.hypot(b.x - p.x, b.y - p.y) < p.r + 8);
      if (hitPillar) {
        state.bolts.splice(i, 1);
        continue;
      }
      const hunter = state.entities.find((e) => e.id === b.ownerId);
      const hitRunner = state.entities.find(
        (e) => e.role === 'runner' && !e.frozen && e.immuneTimer <= 0 && Math.hypot(e.x - b.x, e.y - b.y) < PLAYER_R + 12
      );
      if (hitRunner) {
        freezeRunner(hitRunner, hunter);
        state.bolts.splice(i, 1);
      }
    }

    // Contact freeze, hunter frost-aura freeze, trap freeze, and teammate thaws
    const hunters = state.entities.filter((e) => e.role === 'hunter');
    const runners = state.entities.filter((e) => e.role === 'runner');

    for (const r of runners) {
      if (!r.frozen && r.immuneTimer <= 0) {
        for (const h of hunters) {
          const hitRange = h.auraTimer > 0 ? PLAYER_R * 3.1 : PLAYER_R * 2.05;
          if (Math.hypot(r.x - h.x, r.y - h.y) < hitRange) {
            freezeRunner(r, h);
            break;
          }
        }
        if (!r.frozen) {
          for (let ti = state.traps.length - 1; ti >= 0; ti--) {
            const tr = state.traps[ti];
            if (Math.hypot(r.x - tr.x, r.y - tr.y) < tr.r) {
              const owner = state.entities.find((e) => e.id === tr.ownerId);
              freezeRunner(r, owner);
              state.traps.splice(ti, 1);
              break;
            }
          }
        }
      }
    }

    // Thaw rescues!
    for (const rescuer of runners) {
      if (rescuer.frozen) continue;
      for (const ally of runners) {
        if (!ally.frozen || ally.id === rescuer.id) continue;
        if (Math.hypot(rescuer.x - ally.x, rescuer.y - ally.y) < PLAYER_R * 2.4) {
          ally.frozen = false;
          ally.immuneTimer = 1.6;
          rescuer.saves += 1;
          rescuer.score += 85;
          ally.score += 20;
          state.banner = `${rescuer.name} THAWED ${ally.name}!`;
          state.bannerTimer = 1.5;
          state.popups.push({ x: rescuer.x, y: rescuer.y - 28, text: 'THAW +85!', colorHex: '#10D98B', alpha: 1 });
          sounds.push({ type: 'pickup', playerId: rescuer.id });
          if (!rescuer.isBot) haptics.push({ playerId: rescuer.id, pattern: [24, 20, 48], reason: 'thaw-save' });
          if (!ally.isBot) haptics.push({ playerId: ally.id, pattern: [20, 20, 35], reason: 'thawed' });
        }
      }
    }

    const frozenCount = runners.filter((r) => r.frozen).length;
    const allFrozen = hunters.length > 0 && runners.length > 0 && frozenCount === runners.length;

    if (allFrozen) {
      for (const h of hunters) h.score += 150;
    } else if (state.timeLeft <= 0) {
      for (const r of runners) {
        if (!r.frozen) r.score += 120;
      }
    }

    for (const p of players) {
      const e = state.entities.find((en) => en.id === p.id);
      if (!e) continue;
      hudUpdates[p.id] = {
        score: Math.round(e.score),
        alive: !e.frozen,
        statText: e.role === 'hunter' ? `Hunter · ${e.freezes} Frozen` : e.frozen ? 'FROZEN!' : `Runner · ${e.saves} Saves`,
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
      };
    }

    const finished = allFrozen || state.timeLeft <= 0;
    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished,
      rankings: finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state): FreezeTagSnapshot {
    const runners = state.entities.filter((e) => e.role === 'runner');
    return {
      gameId: 'freeze-tag',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      frozenCount: runners.filter((r) => r.frozen).length,
      runnerCount: runners.length,
      banner: state.banner,
      bolts: state.bolts.map((b) => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
      traps: state.traps.map((t) => ({ id: t.id, x: t.x, y: t.y, r: t.r, alpha: Math.min(1, t.ttl / 2) })),
      icePatches: state.icePatches,
      pickups: state.pickups.map((p) => ({ ...p })),
      popups: state.popups.map((p) => ({ ...p })),
      pillars: state.pillars,
      players: state.entities.map((e) => ({
        id: e.id,
        slotIndex: e.slotIndex,
        name: e.name,
        colorHex: e.colorHex,
        isBot: e.isBot,
        role: e.role,
        x: e.x,
        y: e.y,
        angle: e.angle,
        frozen: e.frozen,
        dashTimer: e.dashTimer,
        immuneTimer: e.immuneTimer,
        skateTimer: e.skateTimer,
        auraTimer: e.auraTimer,
        saves: e.saves,
        freezes: e.freezes,
        score: Math.round(e.score),
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
      score: Math.round(e?.score ?? 0),
      highlight: e?.role === 'hunter' ? `Hunter · ${e.freezes} frozen` : `Runner · ${e?.saves ?? 0} saves`,
    }));
  },
};
