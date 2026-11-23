import { selectTurnBasedBotMove, getTurnBotDelayMs } from './botEngine.ts';
import type { BotDifficulty } from '../../src/shared/types.ts';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type DeskFlippersSnapshot,
  type LineBreakersSnapshot,
  type MarbleRingSnapshot,
  type PitHarvestSnapshot,
  type RankingEntry,
  type RattanVolleySnapshot,
  type SoundEvent,
  type SpinClashSnapshot,
  type StepStompSnapshot,
} from '../../src/shared/types.ts';
import type { PlayerHudUpdate, ServerGameModule, ServerPlayerInputState, StepOutput } from './engine.ts';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function buildRankings(
  entries: { id: string; slotIndex: number; name: string; score: number; highlight: string }[],
  players: ServerPlayerInputState[]
): RankingEntry[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.slotIndex - b.slotIndex);
  return sorted.map((e, idx) => {
    const src = byId.get(e.id);
    return {
      playerId: e.id,
      slotIndex: e.slotIndex,
      name: e.name,
      color: src?.color ?? players[0].color,
      rank: idx + 1,
      score: Math.round(e.score),
      highlight: e.highlight,
    };
  });
}

function decayPopups(popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[], dt: number) {
  for (let i = popups.length - 1; i >= 0; i--) {
    popups[i].y -= 28 * dt;
    popups[i].alpha -= dt * 0.85;
    if (popups[i].alpha <= 0) popups.splice(i, 1);
  }
}

// ============================================================================
// 1. LINE BREAKERS (Galah Panjang / 过五关)
// ============================================================================
interface LineBreakersInternal {
  round: number;
  totalRounds: number;
  roundTimer: number;
  courtX: number;
  courtY: number;
  courtW: number;
  courtH: number;
  lineYs: number[];
  centerSpineX: number;
  banner: string | null;
  bannerTimer: number;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LineBreakersSnapshot['players'];
  finished: boolean;
}

function setupLineBreakersRound(state: LineBreakersInternal) {
  const n = state.players.length;
  const swap = state.round % 2 === 0;
  let guardCounter = 0;
  let runnerCounter = 0;
  for (let i = 0; i < n; i++) {
    const p = state.players[i];
    const isGuard = n === 1 ? false : swap ? i % 2 === 0 : i % 2 === 1;
    p.role = isGuard ? 'guard' : 'runner';
    p.alive = true;
    p.reachedFarEnd = false;
    p.dashTimer = 0;
    p.feintTimer = 0;
    p.tagStunTimer = 0;
    p.cooldownA = 0;
    p.cooldownB = 0;

    if (isGuard) {
      const lineIdx = guardCounter % 5; // 0..3 horizontal lines, 4 center spine
      p.guardLineIndex = lineIdx;
      if (lineIdx < 4) {
        p.x = state.courtX + state.courtW * (0.25 + ((guardCounter * 0.31) % 0.5));
        p.y = state.lineYs[lineIdx];
      } else {
        p.x = state.centerSpineX;
        p.y = state.courtY + state.courtH * 0.5;
      }
      guardCounter++;
    } else {
      p.guardLineIndex = -1;
      const spread = Math.max(1, Math.ceil(n / 2));
      p.x = state.courtX + 120 + ((runnerCounter + 0.5) / spread) * (state.courtW - 240);
      p.y = state.courtY + state.courtH - 36;
      runnerCounter++;
    }
  }
  state.roundTimer = 32;
  state.banner = `ROUND ${state.round} · GALAH PANJANG!`;
  state.bannerTimer = 2.0;
}

export const lineBreakersModule: ServerGameModule<LineBreakersInternal> = {
  id: 'line-breakers',
  createState(players, settingValue) {
    const courtX = 160;
    const courtY = 84;
    const courtW = 880;
    const courtH = 552;
    const lineYs = [
      courtY + courtH * 0.2,
      courtY + courtH * 0.4,
      courtY + courtH * 0.6,
      courtY + courtH * 0.8,
    ];
    const state: LineBreakersInternal = {
      round: 1,
      totalRounds: Math.max(2, settingValue || 2),
      roundTimer: 32,
      courtX,
      courtY,
      courtW,
      courtH,
      lineYs,
      centerSpineX: courtX + courtW / 2,
      banner: null,
      bannerTimer: 0,
      popups: [],
      finished: false,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        role: 'runner',
        guardLineIndex: -1,
        x: courtX + courtW / 2,
        y: courtY + courtH - 36,
        angle: -Math.PI / 2,
        alive: true,
        reachedFarEnd: false,
        dashTimer: 0,
        feintTimer: 0,
        tagStunTimer: 0,
        crossings: 0,
        tags: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      })),
    };
    setupLineBreakersRound(state);
    return state;
  },
  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const inputMap = new Map(players.map((p) => [p.id, p]));
    decayPopups(state.popups, dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }

    if (!state.finished) {
      state.roundTimer = Math.max(0, state.roundTimer - dt);

      for (const p of state.players) {
        const inp = inputMap.get(p.id);
        const dx = inp?.input.dx ?? 0;
        const dy = inp?.input.dy ?? 0;
        const pressA = Boolean(inp?.input.a && !inp.prevA);
        const pressB = Boolean(inp?.input.b && !inp.prevB);

        p.cooldownA = Math.max(0, p.cooldownA - dt * 0.45);
        p.cooldownB = Math.max(0, p.cooldownB - dt * 0.35);
        p.dashTimer = Math.max(0, p.dashTimer - dt);
        p.feintTimer = Math.max(0, p.feintTimer - dt);
        p.tagStunTimer = Math.max(0, p.tagStunTimer - dt);

        if (!p.alive || p.tagStunTimer > 0) continue;

        if (pressA && p.cooldownA <= 0) {
          p.dashTimer = 0.28;
          p.cooldownA = 1;
          sounds.push({ type: 'boost', playerId: p.id });
        }
        if (pressB && p.cooldownB <= 0) {
          p.feintTimer = 0.34;
          p.cooldownB = 1;
          if (p.role === 'guard') {
            // Guards can shift to an adjacent horizontal line on B!
            p.guardLineIndex = (p.guardLineIndex + 1) % 5;
            if (p.guardLineIndex < 4) {
              p.y = state.lineYs[p.guardLineIndex];
            } else {
              p.x = state.centerSpineX;
            }
          }
          sounds.push({ type: 'pulse', playerId: p.id });
        }

        const speed = (p.role === 'guard' ? 360 : 285) * (p.dashTimer > 0 ? 1.65 : 1) * (p.feintTimer > 0 ? 1.25 : 1);
        if (p.role === 'guard') {
          if (p.guardLineIndex < 4) {
            p.x = clamp(p.x + dx * speed * dt, state.courtX + 18, state.courtX + state.courtW - 18);
            p.y = state.lineYs[p.guardLineIndex];
            if (Math.abs(dx) > 0.1) p.angle = dx > 0 ? 0 : Math.PI;
          } else {
            // Center spine vertical guard!
            p.x = state.centerSpineX;
            p.y = clamp(p.y + dy * speed * dt, state.courtY + 24, state.courtY + state.courtH - 24);
            if (Math.abs(dy) > 0.1) p.angle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        } else {
          const mag = Math.hypot(dx, dy);
          if (mag > 0.08) {
            p.x = clamp(p.x + (dx / Math.max(1, mag)) * speed * dt, state.courtX + 20, state.courtX + state.courtW - 20);
            p.y = clamp(p.y + (dy / Math.max(1, mag)) * speed * dt, state.courtY + 20, state.courtY + state.courtH - 20);
            p.angle = Math.atan2(dy, dx);
          }

          // Check far zone touch & return to start zone (Authentic Galah Panjang round-trip!)
          if (!p.reachedFarEnd && p.y <= state.courtY + 58) {
            p.reachedFarEnd = true;
            p.score += 120;
            state.popups.push({ x: p.x, y: p.y, text: 'FAR ZONE! +120', colorHex: '#FFB800', alpha: 1 });
            sounds.push({ type: 'pickup', playerId: p.id });
          } else if (p.reachedFarEnd && p.y >= state.courtY + state.courtH - 58) {
            p.reachedFarEnd = false;
            p.crossings += 1;
            p.score += 280;
            state.popups.push({ x: p.x, y: p.y - 16, text: 'FULL CROSSING! +280', colorHex: '#10D98B', alpha: 1 });
            sounds.push({ type: 'lap', playerId: p.id });
          }
        }
      }

      // Guard tag collisions
      const guards = state.players.filter((p) => p.role === 'guard' && p.alive);
      const runners = state.players.filter((p) => p.role === 'runner' && p.alive);
      for (const g of guards) {
        const reach = g.dashTimer > 0 ? 48 : 34;
        for (const r of runners) {
          if (r.tagStunTimer > 0 || r.feintTimer > 0.16) continue;
          if (Math.hypot(g.x - r.x, g.y - r.y) < reach) {
            g.tags += 1;
            g.score += 160;
            r.tagStunTimer = 1.4;
            r.reachedFarEnd = false;
            r.y = state.courtY + state.courtH - 36;
            state.popups.push({ x: r.x, y: r.y - 14, text: 'TAGGED!', colorHex: g.colorHex, alpha: 1 });
            sounds.push({ type: 'hit', playerId: g.id });
          }
        }
      }

      if (state.roundTimer <= 0) {
        if (state.round < state.totalRounds) {
          state.round += 1;
          setupLineBreakersRound(state);
          sounds.push({ type: 'go' });
        } else {
          state.finished = true;
          sounds.push({ type: 'win' });
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: Math.round(p.score),
        alive: p.alive,
        statText: p.role === 'guard' ? `Guard · ${p.tags} Tags` : `Runner · ${p.crossings} Runs`,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics: [],
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },
  getSnapshot(state): LineBreakersSnapshot {
    return {
      gameId: 'line-breakers',
      round: state.round,
      totalRounds: state.totalRounds,
      roundTimer: state.roundTimer,
      courtX: state.courtX,
      courtY: state.courtY,
      courtW: state.courtW,
      courtH: state.courtH,
      lineYs: state.lineYs,
      centerSpineX: state.centerSpineX,
      banner: state.banner,
      popups: state.popups,
      players: state.players,
    };
  },
  getRankings(state, players) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        score: p.score,
        highlight: `${p.crossings} Runs · ${p.tags} Tags`,
      })),
      players
    );
  },
};

// ============================================================================
// 2. DESK FLIPPERS (Lawan Pemadam / 翻橡皮擦)
// ============================================================================
interface DeskFlippersInternal {
  round: number;
  totalRounds: number;
  timeLeft: number;
  deskX: number;
  deskY: number;
  deskW: number;
  deskH: number;
  banner: string | null;
  bannerTimer: number;
  shockwaves: DeskFlippersSnapshot['shockwaves'];
  popups: DeskFlippersSnapshot['popups'];
  players: DeskFlippersSnapshot['players'];
  finished: boolean;
}

const FLAG_STRIPES = ['#FFB800', '#FFFFFF', '#00C2FF', '#10D98B', '#FF3B9A', '#F97316', '#A855F7', '#FACC15'];

function resetDeskRound(state: DeskFlippersInternal) {
  const cx = state.deskX + state.deskW / 2;
  const cy = state.deskY + state.deskH / 2;
  const n = state.players.length;
  state.players.forEach((p, idx) => {
    const ang = (idx / Math.max(1, n)) * Math.PI * 2;
    p.x = cx + Math.cos(ang) * 210;
    p.y = cy + Math.sin(ang) * 145;
    p.z = 0;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.angle = ang + Math.PI;
    p.flipRot = 0;
    p.alive = true;
    p.pinnedTimer = 0;
    p.cooldownA = 0;
    p.cooldownB = 0;
  });
  state.timeLeft = 26;
  state.banner = `ROUND ${state.round} · TINDIH TO WIN!`;
  state.bannerTimer = 1.8;
}

export const deskFlippersModule: ServerGameModule<DeskFlippersInternal> = {
  id: 'desk-flippers',
  createState(players, settingValue) {
    const state: DeskFlippersInternal = {
      round: 1,
      totalRounds: Math.max(2, settingValue || 3),
      timeLeft: 26,
      deskX: 165,
      deskY: 95,
      deskW: 870,
      deskH: 530,
      banner: null,
      bannerTimer: 0,
      shockwaves: [],
      popups: [],
      finished: false,
      players: players.map((p, idx) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        flagStripeHex: FLAG_STRIPES[idx % FLAG_STRIPES.length],
        x: ARENA_WIDTH / 2,
        y: ARENA_HEIGHT / 2,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        angle: 0,
        flipRot: 0,
        alive: true,
        pinnedTimer: 0,
        charge: 0,
        pins: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      })),
    };
    resetDeskRound(state);
    return state;
  },
  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const inputMap = new Map(players.map((p) => [p.id, p]));
    decayPopups(state.popups, dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      state.shockwaves[i].radius += 190 * dt;
      state.shockwaves[i].alpha -= dt * 2.1;
      if (state.shockwaves[i].alpha <= 0) state.shockwaves.splice(i, 1);
    }

    if (!state.finished) {
      state.timeLeft = Math.max(0, state.timeLeft - dt);

      for (const p of state.players) {
        const inp = inputMap.get(p.id);
        const dx = inp?.input.dx ?? 0;
        const dy = inp?.input.dy ?? 0;
        const pressA = Boolean(inp?.input.a && !inp.prevA);
        const pressB = Boolean(inp?.input.b && !inp.prevB);

        p.cooldownA = Math.max(0, p.cooldownA - dt * 0.9);
        p.cooldownB = Math.max(0, p.cooldownB - dt * 0.65);
        p.pinnedTimer = Math.max(0, p.pinnedTimer - dt);

        if (!p.alive) continue;

        if (Math.hypot(dx, dy) > 0.14) {
          p.angle = Math.atan2(dy, dx);
        }

        const grounded = p.z <= 0.5;
        if (grounded && p.pinnedTimer <= 0) {
          if (pressA && p.cooldownA <= 0) {
            // Classic Eraser Flip Flick forward
            p.vx = Math.cos(p.angle) * 440;
            p.vy = Math.sin(p.angle) * 440;
            p.vz = 230;
            p.cooldownA = 1;
            sounds.push({ type: 'boost', playerId: p.id });
          } else if (pressB && p.cooldownB <= 0) {
            // High Hop Arc for landing cleanly on top (Tindih!)
            p.vx = Math.cos(p.angle) * 285;
            p.vy = Math.sin(p.angle) * 285;
            p.vz = 390;
            p.cooldownB = 1;
            sounds.push({ type: 'pulse', playerId: p.id });
          }
        }

        // Physics & Gravity
        const wasAirborne = p.z > 4;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.z > 0) {
          p.vz -= 920 * dt;
          p.flipRot += dt * 13;
        }
        if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;
          p.flipRot = 0;
          p.vx *= Math.pow(0.06, dt);
          p.vy *= Math.pow(0.06, dt);

          // Just landed! Check for Tindih (landing on top of another eraser!)
          if (wasAirborne) {
            state.shockwaves.push({
              x: p.x,
              y: p.y,
              radius: 12,
              maxRadius: 56,
              colorHex: p.colorHex,
              alpha: 0.75,
            });
            for (const other of state.players) {
              if (other.id === p.id || !other.alive || other.z > 14) continue;
              const d = Math.hypot(p.x - other.x, p.y - other.y);
              if (d < 46) {
                other.alive = false;
                other.pinnedTimer = 2.0;
                p.pins += 1;
                p.score += 240;
                state.popups.push({ x: other.x, y: other.y - 18, text: 'TINDIH PIN! +240', colorHex: '#FFB800', alpha: 1 });
                sounds.push({ type: 'ko', playerId: p.id });
              }
            }
          }
        }

        // Desk edge fall check
        if (
          p.x < state.deskX - 10 ||
          p.x > state.deskX + state.deskW + 10 ||
          p.y < state.deskY - 10 ||
          p.y > state.deskY + state.deskH + 10
        ) {
          p.alive = false;
          state.popups.push({ x: clamp(p.x, state.deskX, state.deskX + state.deskW), y: clamp(p.y, state.deskY, state.deskY + state.deskH), text: 'OFF DESK!', colorHex: '#FF4D2E', alpha: 1 });
          sounds.push({ type: 'ko', playerId: p.id });
        }
      }

      // Grounded bumping between erasers
      for (let i = 0; i < state.players.length; i++) {
        for (let j = i + 1; j < state.players.length; j++) {
          const a = state.players[i];
          const b = state.players[j];
          if (!a.alive || !b.alive || a.z > 16 || b.z > 16) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.1 && d < 46) {
            const nx = dx / d;
            const ny = dy / d;
            const push = (46 - d) * 0.5;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            a.vx -= nx * 130;
            a.vy -= ny * 130;
            b.vx += nx * 130;
            b.vy += ny * 130;
            sounds.push({ type: 'bump' });
          }
        }
      }

      const aliveList = state.players.filter((p) => p.alive);
      if (state.timeLeft <= 0 || (state.players.length > 1 && aliveList.length <= 1)) {
        for (const survivor of aliveList) survivor.score += 120;
        if (state.round < state.totalRounds) {
          state.round += 1;
          resetDeskRound(state);
          sounds.push({ type: 'go' });
        } else {
          state.finished = true;
          sounds.push({ type: 'win' });
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: Math.round(p.score),
        alive: p.alive,
        statText: `${p.pins} Tindih Pins`,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics: [],
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },
  getSnapshot(state): DeskFlippersSnapshot {
    return {
      gameId: 'desk-flippers',
      round: state.round,
      totalRounds: state.totalRounds,
      timeLeft: state.timeLeft,
      deskX: state.deskX,
      deskY: state.deskY,
      deskW: state.deskW,
      deskH: state.deskH,
      banner: state.banner,
      shockwaves: state.shockwaves,
      popups: state.popups,
      players: state.players,
    };
  },
  getRankings(state, players) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        score: p.score,
        highlight: `${p.pins} Tindih Pins`,
      })),
      players
    );
  },
};

// ============================================================================
// 3. SPIN CLASH (Gasing Pangkah / 马来陀螺)
// ============================================================================
interface SpinClashInternal {
  round: number;
  totalRounds: number;
  timeLeft: number;
  ringCenterX: number;
  ringCenterY: number;
  ringRadius: number;
  sparks: SpinClashSnapshot['sparks'];
  banner: string | null;
  bannerTimer: number;
  popups: SpinClashSnapshot['popups'];
  players: SpinClashSnapshot['players'];
  finished: boolean;
}

function resetSpinRound(state: SpinClashInternal) {
  const n = state.players.length;
  state.ringRadius = 295;
  state.timeLeft = 30;
  state.players.forEach((p, idx) => {
    const ang = (idx / Math.max(1, n)) * Math.PI * 2;
    p.x = state.ringCenterX + Math.cos(ang) * 165;
    p.y = state.ringCenterY + Math.sin(ang) * 165;
    p.vx = 0;
    p.vy = 0;
    p.rpm = 100;
    p.alive = true;
    p.whipTimer = 0;
    p.braceTimer = 0;
    p.cooldownA = 0;
    p.cooldownB = 0;
  });
  state.banner = `ROUND ${state.round} · GASING PANGKAH!`;
  state.bannerTimer = 1.8;
}

export const spinClashModule: ServerGameModule<SpinClashInternal> = {
  id: 'spin-clash',
  createState(players, settingValue) {
    const state: SpinClashInternal = {
      round: 1,
      totalRounds: Math.max(2, settingValue || 3),
      timeLeft: 30,
      ringCenterX: ARENA_WIDTH / 2,
      ringCenterY: ARENA_HEIGHT / 2 + 12,
      ringRadius: 295,
      sparks: [],
      banner: null,
      bannerTimer: 0,
      popups: [],
      finished: false,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        x: ARENA_WIDTH / 2,
        y: ARENA_HEIGHT / 2,
        vx: 0,
        vy: 0,
        spinAngle: 0,
        rpm: 100,
        alive: true,
        whipTimer: 0,
        braceTimer: 0,
        kos: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      })),
    };
    resetSpinRound(state);
    return state;
  },
  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const inputMap = new Map(players.map((p) => [p.id, p]));
    decayPopups(state.popups, dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    for (let i = state.sparks.length - 1; i >= 0; i--) {
      const sp = state.sparks[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.alpha -= dt * 2.4;
      if (sp.alpha <= 0) state.sparks.splice(i, 1);
    }

    if (!state.finished) {
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      state.ringRadius = Math.max(175, state.ringRadius - dt * 3.2);

      for (const p of state.players) {
        const inp = inputMap.get(p.id);
        const dx = inp?.input.dx ?? 0;
        const dy = inp?.input.dy ?? 0;
        const pressA = Boolean(inp?.input.a && !inp.prevA);
        const pressB = Boolean(inp?.input.b && !inp.prevB);

        p.cooldownA = Math.max(0, p.cooldownA - dt * 0.45);
        p.cooldownB = Math.max(0, p.cooldownB - dt * 0.42);
        p.whipTimer = Math.max(0, p.whipTimer - dt);
        p.braceTimer = Math.max(0, p.braceTimer - dt);

        if (!p.alive) continue;

        p.rpm = Math.max(0, p.rpm - dt * 2.4);
        p.spinAngle += dt * (4 + p.rpm * 0.22);

        if (pressA && p.cooldownA <= 0) {
          const ang = Math.hypot(dx, dy) > 0.1 ? Math.atan2(dy, dx) : Math.atan2(state.ringCenterY - p.y, state.ringCenterX - p.x);
          p.vx += Math.cos(ang) * 410;
          p.vy += Math.sin(ang) * 410;
          p.rpm = Math.min(100, p.rpm + 16);
          p.whipTimer = 0.35;
          p.cooldownA = 1;
          sounds.push({ type: 'boost', playerId: p.id });
        }
        if (pressB && p.cooldownB <= 0) {
          p.braceTimer = 0.45;
          p.vx *= 0.45;
          p.vy *= 0.45;
          p.cooldownB = 1;
          sounds.push({ type: 'pulse', playerId: p.id });
        }

        const accel = p.braceTimer > 0 ? 320 : 680;
        p.vx += dx * accel * dt;
        p.vy += dy * accel * dt;
        // Slight inward bowl pull toward center of wooden arena
        const toCx = state.ringCenterX - p.x;
        const toCy = state.ringCenterY - p.y;
        p.vx += toCx * 0.35 * dt;
        p.vy += toCy * 0.35 * dt;
        p.vx *= Math.pow(0.24, dt);
        p.vy *= Math.pow(0.24, dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.score += dt * 4;

        const dist = Math.hypot(p.x - state.ringCenterX, p.y - state.ringCenterY);
        if (dist > state.ringRadius || p.rpm <= 0) {
          p.alive = false;
          state.popups.push({ x: p.x, y: p.y - 14, text: p.rpm <= 0 ? 'OUT OF RPM!' : 'RING OUT!', colorHex: '#FF4D2E', alpha: 1 });
          sounds.push({ type: 'ko', playerId: p.id });
        }
      }

      // Top-to-top metallic/wooden clash!
      for (let i = 0; i < state.players.length; i++) {
        for (let j = i + 1; j < state.players.length; j++) {
          const a = state.players[i];
          const b = state.players[j];
          if (!a.alive || !b.alive) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d > 0.1 && d < 54) {
            const nx = dx / d;
            const ny = dy / d;
            const overlap = (54 - d) * 0.5;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;

            const aPower = (a.whipTimer > 0 ? 1.55 : 1) * (b.braceTimer > 0 ? 0.5 : 1);
            const bPower = (b.whipTimer > 0 ? 1.55 : 1) * (a.braceTimer > 0 ? 0.5 : 1);
            const knockA = 310 * bPower * (a.braceTimer > 0 ? 0.4 : 1);
            const knockB = 310 * aPower * (b.braceTimer > 0 ? 0.4 : 1);
            a.vx -= nx * knockA;
            a.vy -= ny * knockA;
            b.vx += nx * knockB;
            b.vy += ny * knockB;

            a.rpm = Math.max(0, a.rpm - 6 * bPower);
            b.rpm = Math.max(0, b.rpm - 6 * aPower);
            if (aPower > bPower) {
              a.score += 35;
              a.kos += b.rpm <= 2 ? 1 : 0;
            } else {
              b.score += 35;
              b.kos += a.rpm <= 2 ? 1 : 0;
            }

            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            for (let k = 0; k < 6; k++) {
              const ang = Math.random() * Math.PI * 2;
              state.sparks.push({
                x: mx,
                y: my,
                vx: Math.cos(ang) * (120 + Math.random() * 140),
                vy: Math.sin(ang) * (120 + Math.random() * 140),
                colorHex: k % 2 === 0 ? '#FFB800' : '#FFFFFF',
                alpha: 1,
              });
            }
            sounds.push({ type: 'bump' });
          }
        }
      }

      const aliveList = state.players.filter((p) => p.alive);
      if (state.timeLeft <= 0 || (state.players.length > 1 && aliveList.length <= 1)) {
        for (const s of aliveList) {
          s.score += 180;
          s.kos += 1;
        }
        if (state.round < state.totalRounds) {
          state.round += 1;
          resetSpinRound(state);
          sounds.push({ type: 'go' });
        } else {
          state.finished = true;
          sounds.push({ type: 'win' });
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: Math.round(p.score),
        alive: p.alive,
        statText: `RPM ${Math.round(p.rpm)}%`,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics: [],
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },
  getSnapshot(state): SpinClashSnapshot {
    return {
      gameId: 'spin-clash',
      round: state.round,
      totalRounds: state.totalRounds,
      timeLeft: state.timeLeft,
      ringCenterX: state.ringCenterX,
      ringCenterY: state.ringCenterY,
      ringRadius: state.ringRadius,
      sparks: state.sparks,
      banner: state.banner,
      popups: state.popups,
      players: state.players,
    };
  },
  getRankings(state, players) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        score: p.score,
        highlight: `${p.kos} Ring-Outs`,
      })),
      players
    );
  },
};

// ============================================================================
// 4. MARBLE RING (Guli / Kelereng / 弹珠)
// ============================================================================
interface MarbleRingInternal {
  timeLeft: number;
  totalTime: number;
  ringCenterX: number;
  ringCenterY: number;
  ringRadius: number;
  marbles: (MarbleRingSnapshot['marbles'][number] & { lastHitterId: string | null })[];
  popups: MarbleRingSnapshot['popups'];
  players: MarbleRingSnapshot['players'];
  finished: boolean;
}

function spawnRingMarbles(cx: number, cy: number): MarbleRingInternal['marbles'] {
  const palette = ['#00C2FF', '#FF4D2E', '#10D98B', '#A855F7', '#EC4899'];
  const list: MarbleRingInternal['marbles'] = [];
  for (let i = 0; i < 15; i++) {
    const ring = i === 0 ? 0 : i < 7 ? 56 : 112;
    const ang = i === 0 ? 0 : ((i - (i < 7 ? 1 : 7)) / (i < 7 ? 6 : 8)) * Math.PI * 2;
    const isGold = i === 0 || i === 5;
    const isJade = !isGold && i % 3 === 0;
    list.push({
      id: `guli_${i}_${Math.random().toString(36).slice(2, 5)}`,
      x: cx + Math.cos(ang) * ring,
      y: cy + Math.sin(ang) * ring,
      vx: 0,
      vy: 0,
      r: isGold ? 17 : 14,
      kind: isGold ? 'gold' : isJade ? 'jade' : 'glass',
      colorHex: isGold ? '#FFB800' : isJade ? '#10D98B' : palette[i % palette.length],
      value: isGold ? 150 : isJade ? 80 : 50,
      claimed: false,
      lastHitterId: null,
    });
  }
  return list;
}

export const marbleRingModule: ServerGameModule<MarbleRingInternal> = {
  id: 'marble-ring',
  createState(players, settingValue) {
    const cx = ARENA_WIDTH / 2;
    const cy = ARENA_HEIGHT / 2 + 12;
    const totalTime = Math.max(45, settingValue || 60);
    return {
      timeLeft: totalTime,
      totalTime,
      ringCenterX: cx,
      ringCenterY: cy,
      ringRadius: 215,
      marbles: spawnRingMarbles(cx, cy),
      popups: [],
      finished: false,
      players: players.map((p, idx) => {
        const ang = (idx / Math.max(1, players.length)) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.color.hex,
          x: cx + Math.cos(ang) * 290,
          y: cy + Math.sin(ang) * 240,
          vx: 0,
          vy: 0,
          aimAngle: ang + Math.PI,
          isShooting: false,
          marblesWon: 0,
          score: 0,
          cooldownA: 0,
          cooldownB: 0,
        };
      }),
    };
  },
  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const inputMap = new Map(players.map((p) => [p.id, p]));
    decayPopups(state.popups, dt);

    if (!state.finished) {
      state.timeLeft = Math.max(0, state.timeLeft - dt);

      for (const p of state.players) {
        const inp = inputMap.get(p.id);
        const dx = inp?.input.dx ?? 0;
        const dy = inp?.input.dy ?? 0;
        const pressA = Boolean(inp?.input.a && !inp.prevA);
        const pressB = Boolean(inp?.input.b && !inp.prevB);

        p.cooldownA = Math.max(0, p.cooldownA - dt * 0.72);
        p.cooldownB = Math.max(0, p.cooldownB - dt * 0.65);

        if (Math.hypot(dx, dy) > 0.1) {
          p.aimAngle = Math.atan2(dy, dx);
        }

        if (pressA && p.cooldownA <= 0) {
          p.vx = Math.cos(p.aimAngle) * 760;
          p.vy = Math.sin(p.aimAngle) * 760;
          p.isShooting = true;
          p.cooldownA = 1;
          sounds.push({ type: 'shoot', playerId: p.id });
        } else if (pressB && p.cooldownB <= 0) {
          const curveAng = p.aimAngle + 0.16;
          p.vx = Math.cos(curveAng) * 610;
          p.vy = Math.sin(curveAng) * 610;
          p.isShooting = true;
          p.cooldownB = 1;
          sounds.push({ type: 'pulse', playerId: p.id });
        } else if (!p.isShooting) {
          p.x = clamp(p.x + dx * 270 * dt, 90, ARENA_WIDTH - 90);
          p.y = clamp(p.y + dy * 270 * dt, 90, ARENA_HEIGHT - 70);
        }

        if (p.isShooting) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= Math.pow(0.14, dt);
          p.vy *= Math.pow(0.14, dt);
          if (p.x < 75 || p.x > ARENA_WIDTH - 75) {
            p.vx *= -0.75;
            p.x = clamp(p.x, 75, ARENA_WIDTH - 75);
          }
          if (p.y < 75 || p.y > ARENA_HEIGHT - 60) {
            p.vy *= -0.75;
            p.y = clamp(p.y, 75, ARENA_HEIGHT - 60);
          }
          if (Math.hypot(p.vx, p.vy) < 42) {
            p.vx = 0;
            p.vy = 0;
            p.isShooting = false;
          }
        }
      }

      // Shooter-to-marble & marble-to-marble collisions
      for (const m of state.marbles) {
        if (m.claimed) continue;
        for (const p of state.players) {
          const dx = m.x - p.x;
          const dy = m.y - p.y;
          const d = Math.hypot(dx, dy);
          const minD = m.r + 18;
          if (d > 0.1 && d < minD) {
            const nx = dx / d;
            const ny = dy / d;
            m.x = p.x + nx * minD;
            m.y = p.y + ny * minD;
            const speed = Math.max(220, Math.hypot(p.vx, p.vy) * 1.05);
            m.vx = nx * speed;
            m.vy = ny * speed;
            p.vx *= 0.45;
            p.vy *= 0.45;
            m.lastHitterId = p.id;
            sounds.push({ type: 'bump', playerId: p.id });
          }
        }
      }

      for (let i = 0; i < state.marbles.length; i++) {
        const a = state.marbles[i];
        if (a.claimed) continue;
        for (let j = i + 1; j < state.marbles.length; j++) {
          const b = state.marbles[j];
          if (b.claimed) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          const minD = a.r + b.r;
          if (d > 0.1 && d < minD) {
            const nx = dx / d;
            const ny = dy / d;
            const push = (minD - d) * 0.5;
            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;
            const rvx = a.vx - b.vx;
            const rvy = a.vy - b.vy;
            const imp = rvx * nx + rvy * ny;
            if (imp > 0) {
              a.vx -= nx * imp * 0.92;
              a.vy -= ny * imp * 0.92;
              b.vx += nx * imp * 0.92;
              b.vy += ny * imp * 0.92;
              if (a.lastHitterId && !b.lastHitterId) b.lastHitterId = a.lastHitterId;
              else if (b.lastHitterId && !a.lastHitterId) a.lastHitterId = b.lastHitterId;
              sounds.push({ type: 'bump' });
            }
          }
        }
      }

      // Move marbles & check Bulatan ring-out claim!
      let remaining = 0;
      for (const m of state.marbles) {
        if (m.claimed) continue;
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.vx *= Math.pow(0.22, dt);
        m.vy *= Math.pow(0.22, dt);
        const distFromCenter = Math.hypot(m.x - state.ringCenterX, m.y - state.ringCenterY);
        if (distFromCenter > state.ringRadius + m.r * 0.65) {
          m.claimed = true;
          const winner = state.players.find((p) => p.id === m.lastHitterId) ?? state.players[0];
          if (winner) {
            winner.marblesWon += 1;
            winner.score += m.value;
            state.popups.push({
              x: clamp(m.x, 120, ARENA_WIDTH - 120),
              y: clamp(m.y, 110, ARENA_HEIGHT - 90),
              text: m.kind === 'gold' ? `GOLD GULI! +${m.value}` : `+${m.value}`,
              colorHex: m.colorHex,
              alpha: 1,
            });
            sounds.push({ type: 'pickup', playerId: winner.id });
          }
        } else {
          remaining++;
        }
      }

      if (remaining <= 2) {
        // Fresh marble rack drop!
        state.marbles = spawnRingMarbles(state.ringCenterX, state.ringCenterY);
        sounds.push({ type: 'go' });
      }

      if (state.timeLeft <= 0) {
        state.finished = true;
        sounds.push({ type: 'win' });
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: Math.round(p.score),
        alive: true,
        statText: `${p.marblesWon} Marbles`,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics: [],
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },
  getSnapshot(state): MarbleRingSnapshot {
    return {
      gameId: 'marble-ring',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      ringCenterX: state.ringCenterX,
      ringCenterY: state.ringCenterY,
      ringRadius: state.ringRadius,
      marbles: state.marbles.filter((m) => !m.claimed),
      popups: state.popups,
      players: state.players,
    };
  },
  getRankings(state, players) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        score: p.score,
        highlight: `${p.marblesWon} Guli Claimed`,
      })),
      players
    );
  },
};

// ============================================================================
// 5. RATTAN VOLLEY (Sepak Takraw / 藤球)
// ============================================================================
interface RattanVolleyInternal {
  targetPoints: number;
  scoreLeft: number;
  scoreRight: number;
  floorY: number;
  netX: number;
  netTopY: number;
  ball: RattanVolleySnapshot['ball'];
  sideTouchesLeft: number;
  sideTouchesRight: number;
  maxTouches: number;
  servePause: number;
  banner: string | null;
  bannerTimer: number;
  popups: RattanVolleySnapshot['popups'];
  players: RattanVolleySnapshot['players'];
  finished: boolean;
}

function serveTakrawBall(state: RattanVolleyInternal, side: 'left' | 'right') {
  state.ball.x = side === 'left' ? 320 : ARENA_WIDTH - 320;
  state.ball.y = 220;
  state.ball.vx = side === 'left' ? 140 : -140;
  state.ball.vy = -120;
  state.ball.trail = [];
  state.sideTouchesLeft = 0;
  state.sideTouchesRight = 0;
  state.servePause = 0.6;
}

export const rattanVolleyModule: ServerGameModule<RattanVolleyInternal> = {
  id: 'rattan-volley',
  createState(players, settingValue) {
    const floorY = 625;
    const state: RattanVolleyInternal = {
      targetPoints: Math.max(5, settingValue || 7),
      scoreLeft: 0,
      scoreRight: 0,
      floorY,
      netX: ARENA_WIDTH / 2,
      netTopY: 420,
      ball: { x: 320, y: 220, vx: 150, vy: -80, r: 22, rot: 0, trail: [] },
      sideTouchesLeft: 0,
      sideTouchesRight: 0,
      maxTouches: 3,
      servePause: 0.4,
      banner: 'SEPAK TAKRAW · 3 TOUCHES!',
      bannerTimer: 2.0,
      popups: [],
      finished: false,
      players: players.map((p, idx) => {
        const team: 'left' | 'right' = idx % 2 === 0 ? 'left' : 'right';
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.color.hex,
          team,
          x: team === 'left' ? 280 + Math.floor(idx / 2) * 140 : ARENA_WIDTH - 280 - Math.floor(idx / 2) * 140,
          y: floorY - 26,
          vx: 0,
          vy: 0,
          kickTimer: 0,
          bicycleAngle: 0,
          score: 0,
          cooldownA: 0,
          cooldownB: 0,
        };
      }),
    };
    return state;
  },
  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const inputMap = new Map(players.map((p) => [p.id, p]));
    decayPopups(state.popups, dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }

    if (!state.finished) {
      for (const p of state.players) {
        const inp = inputMap.get(p.id);
        const dx = inp?.input.dx ?? 0;
        const pressA = Boolean(inp?.input.a && !inp.prevA);
        const pressB = Boolean(inp?.input.b && !inp.prevB);

        p.cooldownA = Math.max(0, p.cooldownA - dt * 1.1);
        p.cooldownB = Math.max(0, p.cooldownB - dt * 1.2);
        p.kickTimer = Math.max(0, p.kickTimer - dt);

        p.vx = dx * 390;
        const grounded = p.y >= state.floorY - 27;
        if (grounded && (pressA || (inp?.input.dy ?? 0) < -0.55)) {
          p.vy = -560;
        }
        if (pressA && p.cooldownA <= 0) {
          p.kickTimer = 0.34;
          p.cooldownA = 1;
          sounds.push({ type: 'boost', playerId: p.id });
        }
        if (pressB && p.cooldownB <= 0) {
          p.kickTimer = 0.25;
          p.cooldownB = 1;
          sounds.push({ type: 'pulse', playerId: p.id });
        }

        p.vy += 1280 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y > state.floorY - 26) {
          p.y = state.floorY - 26;
          p.vy = 0;
        }
        if (p.team === 'left') {
          p.x = clamp(p.x, 72, state.netX - 38);
        } else {
          p.x = clamp(p.x, state.netX + 38, ARENA_WIDTH - 72);
        }
        p.bicycleAngle = p.kickTimer > 0 ? (p.team === 'left' ? 1 : -1) * (1 - p.kickTimer / 0.34) * Math.PI * 2 : 0;
      }

      if (state.servePause > 0) {
        state.servePause -= dt;
      } else {
        const b = state.ball;
        b.vy += 690 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += b.vx * 0.012 * dt;
        b.trail.push({ x: b.x, y: b.y });
        if (b.trail.length > 12) b.trail.shift();

        // Walls & Ceiling
        if (b.x < 50 + b.r) {
          b.x = 50 + b.r;
          b.vx = Math.abs(b.vx) * 0.85;
        } else if (b.x > ARENA_WIDTH - 50 - b.r) {
          b.x = ARENA_WIDTH - 50 - b.r;
          b.vx = -Math.abs(b.vx) * 0.85;
        }
        if (b.y < 70 + b.r) {
          b.y = 70 + b.r;
          b.vy = Math.abs(b.vy) * 0.7;
        }

        // Net collision
        if (Math.abs(b.x - state.netX) < b.r + 10 && b.y > state.netTopY - b.r) {
          if (b.y < state.netTopY + 12 && b.vy > 0) {
            b.vy = -Math.abs(b.vy) * 0.72;
          } else {
            b.vx = (b.x < state.netX ? -1 : 1) * Math.max(160, Math.abs(b.vx) * 0.85);
            b.x = state.netX + (b.x < state.netX ? -(b.r + 12) : b.r + 12);
          }
          sounds.push({ type: 'bump' });
        }

        // Player kick & control lift hits
        for (const p of state.players) {
          const inp = inputMap.get(p.id);
          const dist = Math.hypot(b.x - p.x, b.y - (p.y - 10));
          const hitRadius = p.kickTimer > 0 ? 64 : 46;
          if (dist < hitRadius) {
            const dir = p.team === 'left' ? 1 : -1;
            const isSpike = p.kickTimer > 0 && Boolean(inp?.input.a || p.y < state.floorY - 75);
            const isLift = Boolean(inp?.input.b);
            if (isSpike) {
              // Authentic Sepak Takraw Bicycle Spike (Lipat Gulung!)
              b.vx = dir * 590;
              b.vy = -210;
              state.popups.push({ x: p.x, y: p.y - 46, text: 'LIPAT SPIKE!', colorHex: '#FFB800', alpha: 1 });
              sounds.push({ type: 'hit', playerId: p.id });
            } else if (isLift) {
              // Soft control lift (Timang)
              b.vx = dir * 185 + (inp?.input.dx ?? 0) * 120;
              b.vy = -510;
              sounds.push({ type: 'bump', playerId: p.id });
            } else {
              b.vx = dir * 320 + (b.x - p.x) * 3.5;
              b.vy = -465;
              sounds.push({ type: 'bump', playerId: p.id });
            }
            b.y = Math.min(b.y, p.y - 34);

            if (p.team === 'left') {
              state.sideTouchesLeft += 1;
              state.sideTouchesRight = 0;
            } else {
              state.sideTouchesRight += 1;
              state.sideTouchesLeft = 0;
            }

            // 3-touch rule violation!
            if (state.sideTouchesLeft > state.maxTouches) {
              state.scoreRight += 1;
              state.players.filter((q) => q.team === 'right').forEach((q) => (q.score += 100));
              state.banner = 'OVER 3 TOUCHES! RIGHT POINT!';
              state.bannerTimer = 1.6;
              serveTakrawBall(state, 'right');
              sounds.push({ type: 'ko' });
            } else if (state.sideTouchesRight > state.maxTouches) {
              state.scoreLeft += 1;
              state.players.filter((q) => q.team === 'left').forEach((q) => (q.score += 100));
              state.banner = 'OVER 3 TOUCHES! LEFT POINT!';
              state.bannerTimer = 1.6;
              serveTakrawBall(state, 'left');
              sounds.push({ type: 'ko' });
            }
            break;
          }
        }

        // Floor touch = Point!
        if (b.y >= state.floorY - b.r) {
          if (b.x < state.netX) {
            state.scoreRight += 1;
            state.players.filter((q) => q.team === 'right').forEach((q) => (q.score += 100));
            state.banner = `RIGHT SCORES! ${state.scoreLeft} - ${state.scoreRight}`;
            state.bannerTimer = 1.5;
            serveTakrawBall(state, 'left');
          } else {
            state.scoreLeft += 1;
            state.players.filter((q) => q.team === 'left').forEach((q) => (q.score += 100));
            state.banner = `LEFT SCORES! ${state.scoreLeft} - ${state.scoreRight}`;
            state.bannerTimer = 1.5;
            serveTakrawBall(state, 'right');
          }
          sounds.push({ type: 'pickup' });

          if (state.scoreLeft >= state.targetPoints || state.scoreRight >= state.targetPoints) {
            state.finished = true;
            sounds.push({ type: 'win' });
          }
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: Math.round(p.score),
        alive: true,
        statText: `${p.team.toUpperCase()} · ${state.scoreLeft}-${state.scoreRight}`,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics: [],
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },
  getSnapshot(state): RattanVolleySnapshot {
    return {
      gameId: 'rattan-volley',
      targetPoints: state.targetPoints,
      scoreLeft: state.scoreLeft,
      scoreRight: state.scoreRight,
      floorY: state.floorY,
      netX: state.netX,
      netTopY: state.netTopY,
      ball: state.ball,
      sideTouchesLeft: state.sideTouchesLeft,
      sideTouchesRight: state.sideTouchesRight,
      maxTouches: state.maxTouches,
      banner: state.banner,
      popups: state.popups,
      players: state.players,
    };
  },
  getRankings(state, players) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        score: p.score,
        highlight: p.team === 'left' ? `Left ${state.scoreLeft}` : `Right ${state.scoreRight}`,
      })),
      players
    );
  },
};

// ============================================================================
// 6. STEP STOMP (Pepsi Cola / One-Two-Jus / 踩脚)
// ============================================================================
interface StepStompInternal {
  round: number;
  totalRounds: number;
  phase: 'callout' | 'stride' | 'resolve';
  phaseTimer: number;
  attackerIdx: number;
  calloutText: string;
  footprints: StepStompSnapshot['footprints'];
  shockwaves: StepStompSnapshot['shockwaves'];
  popups: StepStompSnapshot['popups'];
  players: StepStompSnapshot['players'];
  finished: boolean;
}

function resetStompRound(state: StepStompInternal) {
  const n = state.players.length;
  state.players.forEach((p, idx) => {
    const ang = (idx / Math.max(1, n)) * Math.PI * 2;
    p.x = ARENA_WIDTH / 2 + Math.cos(ang) * 240;
    p.y = ARENA_HEIGHT / 2 + Math.sin(ang) * 165;
    p.angle = ang + Math.PI;
    p.alive = true;
    p.stepsLeft = 3;
    p.leapTimer = 0;
    p.dodgeTimer = 0;
    p.cooldownA = 0;
    p.cooldownB = 0;
  });
  state.attackerIdx = (state.round - 1) % Math.max(1, n);
  state.phase = 'callout';
  state.phaseTimer = 1.4;
  state.calloutText = 'PEPSI COLA · ONE TWO JUS!';
}

export const stepStompModule: ServerGameModule<StepStompInternal> = {
  id: 'step-stomp',
  createState(players, settingValue) {
    const state: StepStompInternal = {
      round: 1,
      totalRounds: Math.max(2, settingValue || 2),
      phase: 'callout',
      phaseTimer: 1.4,
      attackerIdx: 0,
      calloutText: 'PEPSI COLA · ONE TWO JUS!',
      footprints: [],
      shockwaves: [],
      popups: [],
      finished: false,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        x: ARENA_WIDTH / 2,
        y: ARENA_HEIGHT / 2,
        angle: 0,
        alive: true,
        stepsLeft: 3,
        maxSteps: 3,
        leapTimer: 0,
        dodgeTimer: 0,
        stomps: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      })),
    };
    resetStompRound(state);
    return state;
  },
  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const inputMap = new Map(players.map((p) => [p.id, p]));
    decayPopups(state.popups, dt);
    for (let i = state.footprints.length - 1; i >= 0; i--) {
      state.footprints[i].alpha -= dt * 0.25;
      if (state.footprints[i].alpha <= 0) state.footprints.splice(i, 1);
    }
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      state.shockwaves[i].radius += 210 * dt;
      state.shockwaves[i].alpha -= dt * 2.2;
      if (state.shockwaves[i].alpha <= 0) state.shockwaves.splice(i, 1);
    }

    if (!state.finished) {
      state.phaseTimer -= dt;
      for (const p of state.players) {
        p.leapTimer = Math.max(0, p.leapTimer - dt);
        p.dodgeTimer = Math.max(0, p.dodgeTimer - dt);
        p.cooldownA = Math.max(0, p.cooldownA - dt * 1.4);
        p.cooldownB = Math.max(0, p.cooldownB - dt * 0.55);
      }

      const advanceAttacker = () => {
        const alive = state.players.filter((p) => p.alive);
        if (state.players.length > 1 && alive.length <= 1) {
          for (const s of alive) s.score += 180;
          if (state.round < state.totalRounds) {
            state.round += 1;
            resetStompRound(state);
          } else {
            state.finished = true;
            sounds.push({ type: 'win' });
          }
          return;
        }
        let next = state.attackerIdx;
        for (let k = 0; k < state.players.length; k++) {
          next = (next + 1) % state.players.length;
          if (state.players[next].alive) break;
        }
        state.attackerIdx = next;
        state.players[next].stepsLeft = 3;
        state.phase = 'stride';
        state.phaseTimer = 5.5;
        state.calloutText = `${state.players[next].name}'S 3 STRIDES!`;
      };

      if (state.phase === 'callout') {
        if (state.phaseTimer <= 0) {
          const cur = state.players[state.attackerIdx];
          if (cur) cur.stepsLeft = 3;
          state.phase = 'stride';
          state.phaseTimer = 5.5;
          state.calloutText = `${cur?.name ?? 'PLAYER'}'S 3 STRIDES!`;
          sounds.push({ type: 'go' });
        }
      } else if (state.phase === 'stride') {
        const attacker = state.players[state.attackerIdx];
        if (!attacker || !attacker.alive) {
          advanceAttacker();
        } else {
          // Allow defenders to aim & press B to Dodge Step!
          for (const def of state.players) {
            if (def.id === attacker.id || !def.alive) continue;
            const dInp = inputMap.get(def.id);
            const ddx = dInp?.input.dx ?? 0;
            const ddy = dInp?.input.dy ?? 0;
            if (Math.hypot(ddx, ddy) > 0.12) def.angle = Math.atan2(ddy, ddx);
            if (dInp?.input.b && !dInp.prevB && def.cooldownB <= 0) {
              const ang = Math.hypot(ddx, ddy) > 0.12 ? Math.atan2(ddy, ddx) : Math.atan2(def.y - attacker.y, def.x - attacker.x);
              def.x = clamp(def.x + Math.cos(ang) * 95, 110, ARENA_WIDTH - 110);
              def.y = clamp(def.y + Math.sin(ang) * 95, 110, ARENA_HEIGHT - 95);
              def.dodgeTimer = 0.4;
              def.cooldownB = 1;
              state.popups.push({ x: def.x, y: def.y - 24, text: 'DODGE!', colorHex: '#00C2FF', alpha: 1 });
              sounds.push({ type: 'pulse', playerId: def.id });
            }
          }

          // Attacker aims & spends exact strides!
          const aInp = inputMap.get(attacker.id);
          const adx = aInp?.input.dx ?? 0;
          const ady = aInp?.input.dy ?? 0;
          if (Math.hypot(adx, ady) > 0.12) {
            attacker.angle = Math.atan2(ady, adx);
          }

          if (aInp?.input.a && !aInp.prevA && attacker.cooldownA <= 0 && attacker.stepsLeft > 0) {
            state.footprints.push({ x: attacker.x, y: attacker.y, angle: attacker.angle, colorHex: attacker.colorHex, alpha: 0.9 });
            const strideDist = 135;
            attacker.x = clamp(attacker.x + Math.cos(attacker.angle) * strideDist, 110, ARENA_WIDTH - 110);
            attacker.y = clamp(attacker.y + Math.sin(attacker.angle) * strideDist, 110, ARENA_HEIGHT - 95);
            attacker.stepsLeft -= 1;
            attacker.leapTimer = 0.28;
            attacker.cooldownA = 0.55;
            state.shockwaves.push({ x: attacker.x, y: attacker.y, radius: 14, maxRadius: 72, colorHex: attacker.colorHex, alpha: 0.9 });
            sounds.push({ type: 'bump', playerId: attacker.id });

            // Check shoe stomp hit!
            for (const target of state.players) {
              if (target.id === attacker.id || !target.alive || target.dodgeTimer > 0.1) continue;
              if (Math.hypot(attacker.x - target.x, attacker.y - target.y) < 62) {
                target.alive = false;
                attacker.stomps += 1;
                attacker.score += 240;
                state.popups.push({ x: target.x, y: target.y - 22, text: 'STOMPED! +240', colorHex: '#FFB800', alpha: 1 });
                sounds.push({ type: 'ko', playerId: attacker.id });
              }
            }

            if (attacker.stepsLeft <= 0) {
              advanceAttacker();
            }
          } else if (state.phaseTimer <= 0) {
            advanceAttacker();
          }
        }
      }
    }

    const activeAttacker = state.players[state.attackerIdx] ?? null;
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      hudUpdates[p.id] = {
        score: Math.round(p.score),
        alive: p.alive,
        statText: activeAttacker?.id === p.id ? `${p.stepsLeft} Steps Left` : `${p.stomps} Stomps`,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics: [],
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },
  getSnapshot(state): StepStompSnapshot {
    return {
      gameId: 'step-stomp',
      round: state.round,
      totalRounds: state.totalRounds,
      phase: state.phase,
      phaseTimer: state.phaseTimer,
      activeAttackerId: state.players[state.attackerIdx]?.id ?? null,
      calloutText: state.calloutText,
      footprints: state.footprints,
      shockwaves: state.shockwaves,
      popups: state.popups,
      players: state.players,
    };
  },
  getRankings(state, players) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        score: p.score,
        highlight: `${p.stomps} Shoe Stomps`,
      })),
      players
    );
  },
};

// ============================================================================
// 7. PIT HARVEST (Congkak / 冲格 — Authentic 7-Pit Malaysian Wooden Board!)
// ============================================================================
interface PitHarvestInternal {
  round: number;
  totalRounds: number;
  pits: number[]; // 0..6 = side 0 (bottom left->right), 7..13 = side 1 (top right->left)
  burntPits: boolean[];
  rumah: [number, number];
  activeSide: 0 | 1;
  sowingInHand: number;
  sowingPos: number | null; // 0..13, -1 = rumah0, -2 = rumah1
  sowStepTimer: number;
  turnTimeLeft: number;
  turnTotal: number;
  joyCooldown: number;
  banner: string | null;
  bannerTimer: number;
  popups: PitHarvestSnapshot['popups'];
  players: PitHarvestSnapshot['players'];
  finished: boolean;
  botThinkTimer?: number;
}

function nextCongkakPos(pos: number, activeSide: 0 | 1): number {
  if (pos === -1) return 7;
  if (pos === -2) return 0;
  if (pos === 6) return activeSide === 0 ? -1 : 7;
  if (pos === 13) return activeSide === 1 ? -2 : 0;
  return pos + 1;
}

function chooseBestCongkakPit(state: PitHarvestInternal, side: 0 | 1, difficulty?: BotDifficulty): number {
  const start = side === 0 ? 0 : 7;
  const candidates: { move: number; rawScore: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = start + i;
    const count = state.pits[idx];
    if (count <= 0 || state.burntPits[idx]) continue;
    const distToRumah = 7 - i;
    let val = count * 2;
    if (count === distToRumah) val += 45; // Free turn (Jalan Terus!)
    const landIdx = (idx + count) % 14;
    if (count < distToRumah && state.pits[landIdx] === 0 && !state.burntPits[landIdx]) {
      const oppIdx = 13 - landIdx;
      val += state.pits[oppIdx] * 5; // Tembak capture!
    }
    candidates.push({ move: i, rawScore: val });
  }
  if (candidates.length === 0) return 0;
  const chosen = selectTurnBasedBotMove({
    difficulty,
    candidates,
  });
  return chosen !== null ? chosen : candidates[0].move;
}

function sideHasMoves(state: PitHarvestInternal, side: 0 | 1): boolean {
  const start = side === 0 ? 0 : 7;
  for (let i = 0; i < 7; i++) {
    if (state.pits[start + i] > 0 && !state.burntPits[start + i]) return true;
  }
  return false;
}

function startCongkakRound2(state: PitHarvestInternal) {
  state.round += 1;
  state.burntPits = Array(14).fill(false);
  // Authentic Malaysian Congkak Rumah Terbakar (Burnt Pits): refill 7 per pit from own rumah!
  for (let side = 0; side < 2; side++) {
    let bank = state.rumah[side];
    const start = side === 0 ? 0 : 7;
    for (let i = 0; i < 7; i++) {
      if (bank >= 7) {
        state.pits[start + i] = 7;
        bank -= 7;
      } else {
        state.pits[start + i] = 0;
        state.burntPits[start + i] = true; // Rumah terbakar!
      }
    }
    state.rumah[side] = bank;
  }
  state.banner = 'ROUND 2 · RUMAH TERBAKAR!';
  state.bannerTimer = 2.4;
}

export const pitHarvestModule: ServerGameModule<PitHarvestInternal> = {
  id: 'pit-harvest',
  createState(players, settingValue) {
    // Support 1P (auto-virtual AI rival) or 2P
    const pList: PitHarvestSnapshot['players'] = [
      {
        id: players[0]?.id ?? 'p1',
        slotIndex: players[0]?.slotIndex ?? 0,
        name: players[0]?.name ?? 'P1',
        colorHex: players[0]?.color.hex ?? '#FFB800',
        side: 0,
        cursorPit: 0,
        rumah: 0,
        totalScore: 0,
        captures: 0,
        lastAction: null,
      },
      {
        id: players[1]?.id ?? 'congkak_bot',
        slotIndex: players[1]?.slotIndex ?? 1,
        name: players[1]?.name ?? 'KAMPUNG AI',
        colorHex: players[1]?.color.hex ?? '#00C2FF',
        side: 1,
        cursorPit: 0,
        rumah: 0,
        totalScore: 0,
        captures: 0,
        lastAction: null,
      },
    ];
    return {
      round: 1,
      totalRounds: Math.max(1, settingValue || 1),
      pits: Array(14).fill(7),
      burntPits: Array(14).fill(false),
      rumah: [0, 0],
      activeSide: 0,
      sowingInHand: 0,
      sowingPos: null,
      sowStepTimer: 0,
      turnTimeLeft: 14,
      turnTotal: 14,
      joyCooldown: 0,
      banner: 'CONGKAK · SOW CLOCKWISE!',
      bannerTimer: 2.0,
      popups: [],
      players: pList,
      finished: false,
    };
  },
  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const inputMap = new Map(players.map((p) => [p.id, p]));
    decayPopups(state.popups, dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    state.joyCooldown = Math.max(0, state.joyCooldown - dt);

    if (!state.finished) {
      const activePlayer = state.players[state.activeSide];

      // Animated marble-by-marble Congkak sowing!
      if (state.sowingInHand > 0 && state.sowingPos !== null) {
        state.sowStepTimer -= dt;
        if (state.sowStepTimer <= 0) {
          state.sowStepTimer = 0.085;
          let nextPos = nextCongkakPos(state.sowingPos, state.activeSide);
          // Skip burnt pits (Rumah Terbakar)
          while (nextPos >= 0 && state.burntPits[nextPos]) {
            nextPos = nextCongkakPos(nextPos, state.activeSide);
          }
          state.sowingPos = nextPos;
          state.sowingInHand -= 1;

          if (nextPos === -1) {
            state.rumah[0] += 1;
            sounds.push({ type: 'pickup' });
          } else if (nextPos === -2) {
            state.rumah[1] += 1;
            sounds.push({ type: 'pickup' });
          } else {
            state.pits[nextPos] += 1;
            sounds.push({ type: 'nav' });
          }

          // Last marble dropped! Apply authentic Malaysian Congkak rules:
          if (state.sowingInHand === 0) {
            const ownRumah = state.activeSide === 0 ? -1 : -2;
            if (nextPos === ownRumah) {
              // Jalan Terus! Free extra turn!
              state.sowingPos = null;
              state.turnTimeLeft = state.turnTotal;
              activePlayer.lastAction = 'FREE TURN!';
              state.banner = `${activePlayer.name} · JALAN TERUS (FREE TURN!)`;
              state.bannerTimer = 1.4;
              sounds.push({ type: 'confirm' });
            } else if (nextPos >= 0 && state.pits[nextPos] > 1) {
              // Continuous sowing! Scoop up the pit and keep moving!
              state.sowingInHand = state.pits[nextPos];
              state.pits[nextPos] = 0;
              state.sowStepTimer = 0.14;
            } else {
              // Landed in empty pit (now has 1 marble) -> check Tembak (Capture opposite pit!)
              const isOwnPit =
                nextPos >= 0 &&
                (state.activeSide === 0 ? nextPos >= 0 && nextPos <= 6 : nextPos >= 7 && nextPos <= 13);
              if (isOwnPit) {
                const oppIdx = 13 - nextPos;
                if (state.pits[oppIdx] > 0) {
                  const captured = state.pits[oppIdx] + state.pits[nextPos];
                  state.pits[oppIdx] = 0;
                  state.pits[nextPos] = 0;
                  state.rumah[state.activeSide] += captured;
                  activePlayer.captures += 1;
                  activePlayer.lastAction = `TEMBAK +${captured}!`;
                  state.banner = `TEMBAK CAPTURE! +${captured} MARBLES!`;
                  state.bannerTimer = 1.7;
                  state.popups.push({ x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 - 40, text: `TEMBAK +${captured}!`, colorHex: '#FFB800', alpha: 1 });
                  sounds.push({ type: 'hit' });
                }
              }
              state.sowingPos = null;
              state.activeSide = state.activeSide === 0 ? 1 : 0;
              state.turnTimeLeft = state.turnTotal;
            }
          }
        }
      } else {
        // Check if either side is out of marbles -> sweep remaining into rumah
        if (!sideHasMoves(state, state.activeSide)) {
          const otherSide: 0 | 1 = state.activeSide === 0 ? 1 : 0;
          if (!sideHasMoves(state, otherSide)) {
            if (state.round < state.totalRounds && state.rumah[0] >= 7 && state.rumah[1] >= 7) {
              startCongkakRound2(state);
            } else {
              state.finished = true;
              sounds.push({ type: 'win' });
            }
          } else {
            state.activeSide = otherSide;
            state.turnTimeLeft = state.turnTotal;
          }
        } else {
          state.turnTimeLeft -= dt;
          const inp = inputMap.get(activePlayer.id);
          const isVirtualBot = !inp || inp.isBot;

          const triggerSow = (localPit: number) => {
            const start = state.activeSide === 0 ? 0 : 7;
            let idx = start + clamp(localPit, 0, 6);
            if (state.pits[idx] <= 0 || state.burntPits[idx]) {
              idx = start + chooseBestCongkakPit(state, state.activeSide, inp?.botDifficulty);
            }
            if (state.pits[idx] <= 0) return;
            state.sowingInHand = state.pits[idx];
            state.pits[idx] = 0;
            state.sowingPos = idx;
            state.sowStepTimer = 0.08;
            activePlayer.cursorPit = idx - start;
            activePlayer.lastAction = `SOW PIT ${idx - start + 1}`;
            sounds.push({ type: 'boost', playerId: activePlayer.id });
          };

          if (isVirtualBot) {
            if (state.botThinkTimer === undefined) {
              state.botThinkTimer = getTurnBotDelayMs(inp?.botDifficulty) / 1000;
            }
            state.botThinkTimer -= dt;
            if (state.botThinkTimer <= 0) {
              state.botThinkTimer = undefined;
              triggerSow(chooseBestCongkakPit(state, state.activeSide, inp?.botDifficulty));
            }
          } else {
            const dx = inp.input.dx;
            if (Math.abs(dx) > 0.45 && state.joyCooldown <= 0) {
              const stepDir = state.activeSide === 0 ? Math.sign(dx) : -Math.sign(dx);
              activePlayer.cursorPit = (activePlayer.cursorPit + stepDir + 7) % 7;
              state.joyCooldown = 0.22;
              sounds.push({ type: 'nav', playerId: activePlayer.id });
            }
            if (inp.input.a && !inp.prevA) {
              triggerSow(activePlayer.cursorPit);
            } else if ((inp.input.b && !inp.prevB) || state.turnTimeLeft <= 0) {
              triggerSow(chooseBestCongkakPit(state, state.activeSide, inp?.botDifficulty));
            }
          }
        }
      }

      // Sync scores from rumah storehouses
      state.players[0].rumah = state.rumah[0];
      state.players[0].totalScore = state.rumah[0] * 10 + state.players[0].captures * 25;
      state.players[1].rumah = state.rumah[1];
      state.players[1].totalScore = state.rumah[1] * 10 + state.players[1].captures * 25;
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of players) {
      const view = state.players.find((v) => v.id === p.id);
      hudUpdates[p.id] = view
        ? {
            score: view.totalScore,
            alive: true,
            statText: `Rumah: ${view.rumah} · ${view.captures} Tembak`,
            cooldownA: 0,
            cooldownB: 0,
          }
        : {
            score: 0,
            alive: true,
            statText: 'Spectator',
            cooldownA: 1,
            cooldownB: 1,
          };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics: [],
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },
  getSnapshot(state): PitHarvestSnapshot {
    return {
      gameId: 'pit-harvest',
      round: state.round,
      totalRounds: state.totalRounds,
      pits: [...state.pits],
      burntPits: [...state.burntPits],
      rumah: [state.rumah[0], state.rumah[1]],
      activeSide: state.activeSide,
      activePlayerId: state.players[state.activeSide]?.id ?? '',
      sowingInHand: state.sowingInHand,
      sowingPitIndex: state.sowingPos,
      turnTimeLeft: state.turnTimeLeft,
      turnTotal: state.turnTotal,
      banner: state.banner,
      popups: state.popups,
      players: state.players,
    };
  },
  getRankings(state, players) {
    const entries = state.players
      .filter((v) => players.some((p) => p.id === v.id))
      .map((v) => ({
        id: v.id,
        slotIndex: v.slotIndex,
        name: v.name,
        score: v.totalScore,
        highlight: `${v.rumah} in Rumah · ${v.captures} Tembak`,
      }));
    for (const p of players) {
      if (!entries.some((e) => e.id === p.id)) {
        entries.push({
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          score: 0,
          highlight: 'Spectator',
        });
      }
    }
    return buildRankings(entries, players);
  },
};
