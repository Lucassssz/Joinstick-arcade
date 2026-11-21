import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type RankingEntry,
  type SoundEvent,
  type VaultHeistSnapshot,
  type VaultPlayerState,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface InternalVaultPlayer extends VaultPlayerState {
  vx: number;
  vy: number;
  dashCd: number;
  hackCd: number;
}

interface InternalSpike {
  x: number;
  y: number;
  w: number;
  h: number;
  phase: number;
  period: number;
  state: 'idle' | 'warn' | 'active';
  disabledTimer: number;
}

interface InternalLaser {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  phase: number;
  period: number;
  state: 'off' | 'warn' | 'active';
  disabledTimer: number;
}

interface InternalDrone {
  x: number;
  y: number;
  r: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  t: number;
  dir: 1 | -1;
  speed: number;
  angle: number;
  disabledTimer: number;
}

interface VaultHeistState {
  timeLeft: number;
  totalTime: number;
  nextId: number;
  walls: { x: number; y: number; w: number; h: number }[];
  spikes: InternalSpike[];
  lasers: InternalLaser[];
  drones: InternalDrone[];
  relics: { id: string; x: number; y: number; value: number }[];
  portal: { x: number; y: number; r: number };
  hackWaves: { x: number; y: number; radius: number; maxRadius: number; colorHex: string; alpha: number }[];
  players: Map<string, InternalVaultPlayer>;
}

const PORTAL_X = ARENA_WIDTH / 2;
const PORTAL_Y = ARENA_HEIGHT / 2;
const PORTAL_R = 46;
const PLAYER_R = 16;
const DASH_CD = 1.6;
const HACK_CD = 4.2;

const RELIC_SPOTS = [
  { x: 140, y: 120 },
  { x: 1060, y: 120 },
  { x: 140, y: 600 },
  { x: 1060, y: 600 },
  { x: 600, y: 105 },
  { x: 600, y: 615 },
  { x: 165, y: 360 },
  { x: 1035, y: 360 },
  { x: 380, y: 215 },
  { x: 820, y: 215 },
  { x: 380, y: 505 },
  { x: 820, y: 505 },
];

function resolveWall(entity: { x: number; y: number }, r: number, w: { x: number; y: number; w: number; h: number }) {
  const cx = Math.max(w.x, Math.min(entity.x, w.x + w.w));
  const cy = Math.max(w.y, Math.min(entity.y, w.y + w.h));
  const dx = entity.x - cx;
  const dy = entity.y - cy;
  const dist = Math.hypot(dx, dy);
  if (dist < r && dist > 0.0001) {
    entity.x += (dx / dist) * (r - dist);
    entity.y += (dy / dist) * (r - dist);
  }
}

function pointSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const lenSq = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / lenSq));
  return Math.hypot(px - (x1 + t * vx), py - (y1 + t * vy));
}

function spawnRelic(state: VaultHeistState) {
  const available = RELIC_SPOTS.filter(
    (s) => !state.relics.some((r) => Math.hypot(r.x - s.x, r.y - s.y) < 30)
  );
  const pick = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : RELIC_SPOTS[Math.floor(Math.random() * RELIC_SPOTS.length)];
  const edgeBonus = Math.hypot(pick.x - PORTAL_X, pick.y - PORTAL_Y) > 420;
  state.relics.push({
    id: `rel_${state.nextId++}`,
    x: pick.x,
    y: pick.y,
    value: edgeBonus ? 60 : 40,
  });
}

function makePlayer(p: ServerPlayerInputState, idx: number, total: number): InternalVaultPlayer {
  const angle = (idx / Math.max(1, total)) * Math.PI * 2;
  return {
    id: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    colorHex: p.color.hex,
    x: PORTAL_X + Math.cos(angle) * 76,
    y: PORTAL_Y + Math.sin(angle) * 76,
    vx: 0,
    vy: 0,
    angle,
    dashTimer: 0,
    invulnTimer: 1.5,
    carrying: 0,
    banked: 0,
    score: 0,
    cooldownA: 0,
    cooldownB: 0,
    dashCd: 0,
    hackCd: 0,
  };
}

export const vaultHeistModule: ServerGameModule<VaultHeistState> = {
  id: 'vault-heist',

  createState(players, settingValue) {
    const totalTime = Math.max(45, Math.min(120, settingValue || 75));
    const state: VaultHeistState = {
      timeLeft: totalTime,
      totalTime,
      nextId: 1,
      walls: [
        { x: 250, y: 155, w: 32, h: 165 },
        { x: 918, y: 155, w: 32, h: 165 },
        { x: 250, y: 400, w: 32, h: 165 },
        { x: 918, y: 400, w: 32, h: 165 },
        { x: 455, y: 170, w: 290, h: 28 },
        { x: 455, y: 522, w: 290, h: 28 },
      ],
      spikes: [
        { x: 315, y: 260, w: 72, h: 72, phase: 0.4, period: 4.2, state: 'idle', disabledTimer: 0 },
        { x: 813, y: 260, w: 72, h: 72, phase: 2.3, period: 4.2, state: 'idle', disabledTimer: 0 },
        { x: 315, y: 388, w: 72, h: 72, phase: 1.8, period: 4.2, state: 'idle', disabledTimer: 0 },
        { x: 813, y: 388, w: 72, h: 72, phase: 3.7, period: 4.2, state: 'idle', disabledTimer: 0 },
        { x: 564, y: 215, w: 72, h: 64, phase: 1.1, period: 4.5, state: 'idle', disabledTimer: 0 },
        { x: 564, y: 441, w: 72, h: 64, phase: 3.1, period: 4.5, state: 'idle', disabledTimer: 0 },
      ],
      lasers: [
        { x1: 282, y1: 195, x2: 455, y2: 195, phase: 0.2, period: 4.4, state: 'off', disabledTimer: 0 },
        { x1: 745, y1: 195, x2: 918, y2: 195, phase: 2.4, period: 4.4, state: 'off', disabledTimer: 0 },
        { x1: 282, y1: 525, x2: 455, y2: 525, phase: 1.3, period: 4.4, state: 'off', disabledTimer: 0 },
        { x1: 745, y1: 525, x2: 918, y2: 525, phase: 3.5, period: 4.4, state: 'off', disabledTimer: 0 },
      ],
      drones: [
        { x: 160, y: 200, r: 16, ax: 140, ay: 185, bx: 140, by: 535, t: 0.2, dir: 1, speed: 0.34, angle: 0, disabledTimer: 0 },
        { x: 1040, y: 520, r: 16, ax: 1060, ay: 185, bx: 1060, by: 535, t: 0.8, dir: -1, speed: 0.34, angle: 0, disabledTimer: 0 },
        { x: 600, y: 115, r: 16, ax: 330, ay: 105, bx: 870, by: 105, t: 0.5, dir: 1, speed: 0.28, angle: 0, disabledTimer: 0 },
        { x: 600, y: 615, r: 16, ax: 330, ay: 615, bx: 870, by: 615, t: 0.5, dir: -1, speed: 0.28, angle: 0, disabledTimer: 0 },
      ],
      relics: [],
      portal: { x: PORTAL_X, y: PORTAL_Y, r: PORTAL_R },
      hackWaves: [],
      players: new Map(),
    };

    players.forEach((p, idx) => state.players.set(p.id, makePlayer(p, idx, players.length)));
    for (let i = 0; i < 6; i++) spawnRelic(state);
    return state;
  },

  addPlayer(state, player) {
    if (!state.players.has(player.id)) {
      state.players.set(player.id, makePlayer(player, state.players.size, state.players.size + 1));
    }
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const hudUpdates: Record<string, PlayerHudUpdate> = {};

    state.timeLeft = Math.max(0, state.timeLeft - dt);

    // Update spikes
    for (const s of state.spikes) {
      if (s.disabledTimer > 0) {
        s.disabledTimer = Math.max(0, s.disabledTimer - dt);
        s.state = 'idle';
        continue;
      }
      s.phase = (s.phase + dt) % s.period;
      if (s.phase < 2.2) s.state = 'idle';
      else if (s.phase < 3.0) s.state = 'warn';
      else s.state = 'active';
    }

    // Update lasers
    for (const l of state.lasers) {
      if (l.disabledTimer > 0) {
        l.disabledTimer = Math.max(0, l.disabledTimer - dt);
        l.state = 'off';
        continue;
      }
      l.phase = (l.phase + dt) % l.period;
      if (l.phase < 2.1) l.state = 'off';
      else if (l.phase < 2.95) l.state = 'warn';
      else l.state = 'active';
    }

    // Update patrol drones
    for (const d of state.drones) {
      if (d.disabledTimer > 0) {
        d.disabledTimer = Math.max(0, d.disabledTimer - dt);
        continue;
      }
      d.t += d.dir * d.speed * dt;
      if (d.t >= 1) {
        d.t = 1;
        d.dir = -1;
      } else if (d.t <= 0) {
        d.t = 0;
        d.dir = 1;
      }
      const nx = d.ax + (d.bx - d.ax) * d.t;
      const ny = d.ay + (d.by - d.ay) * d.t;
      d.angle = Math.atan2(ny - d.y, nx - d.x);
      d.x = nx;
      d.y = ny;
    }

    // Update hack waves
    for (let i = state.hackWaves.length - 1; i >= 0; i--) {
      const w = state.hackWaves[i];
      w.radius += 620 * dt;
      w.alpha = Math.max(0, 1 - w.radius / w.maxRadius);
      if (w.radius >= w.maxRadius) state.hackWaves.splice(i, 1);
    }

    // Update players
    for (const p of players) {
      const e = state.players.get(p.id);
      if (!e) continue;

      e.dashCd = Math.max(0, e.dashCd - dt);
      e.hackCd = Math.max(0, e.hackCd - dt);
      e.dashTimer = Math.max(0, e.dashTimer - dt);
      e.invulnTimer = Math.max(0, e.invulnTimer - dt);

      const mag = Math.hypot(p.input.dx, p.input.dy);
      const nx = mag > 0.12 ? p.input.dx / mag : 0;
      const ny = mag > 0.12 ? p.input.dy / mag : 0;
      if (mag > 0.12) e.angle = Math.atan2(ny, nx);

      // Button A: Smoke Dash
      if (p.input.a && !p.prevA && e.dashCd <= 0) {
        const dx = mag > 0.12 ? nx : Math.cos(e.angle);
        const dy = mag > 0.12 ? ny : Math.sin(e.angle);
        e.vx = dx * 680;
        e.vy = dy * 680;
        e.dashTimer = 0.22;
        e.invulnTimer = Math.max(e.invulnTimer, 0.28);
        e.dashCd = DASH_CD;
        sounds.push({ type: 'boost', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: 22, reason: 'dash' });
      }

      // Button B: Hack EMP (disables nearby traps for 3.6s)
      if (p.input.b && !p.prevB && e.hackCd <= 0) {
        e.hackCd = HACK_CD;
        const hackR = 240;
        state.hackWaves.push({
          x: e.x,
          y: e.y,
          radius: 16,
          maxRadius: hackR,
          colorHex: e.colorHex,
          alpha: 0.9,
        });
        for (const s of state.spikes) {
          if (Math.hypot(s.x + s.w / 2 - e.x, s.y + s.h / 2 - e.y) < hackR) s.disabledTimer = 3.6;
        }
        for (const l of state.lasers) {
          if (pointSegDist(e.x, e.y, l.x1, l.y1, l.x2, l.y2) < hackR) l.disabledTimer = 3.6;
        }
        for (const d of state.drones) {
          if (Math.hypot(d.x - e.x, d.y - e.y) < hackR) d.disabledTimer = 3.6;
        }
        sounds.push({ type: 'pulse', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: [30, 25, 35], reason: 'hack' });
      }

      const carryPenalty = Math.max(0.84, 1 - e.carrying * 0.04);
      const speed = (e.dashTimer > 0 ? 660 : 315) * carryPenalty;
      const targetVx = e.dashTimer > 0 ? e.vx : nx * speed;
      const targetVy = e.dashTimer > 0 ? e.vy : ny * speed;
      const accel = e.dashTimer > 0 ? 4 : 15;
      e.vx += (targetVx - e.vx) * Math.min(1, accel * dt);
      e.vy += (targetVy - e.vy) * Math.min(1, accel * dt);

      e.x = Math.max(30, Math.min(ARENA_WIDTH - 30, e.x + e.vx * dt));
      e.y = Math.max(30, Math.min(ARENA_HEIGHT - 30, e.y + e.vy * dt));

      for (const w of state.walls) resolveWall(e, PLAYER_R, w);

      // Grab relics
      for (let i = state.relics.length - 1; i >= 0; i--) {
        const r = state.relics[i];
        if (Math.hypot(e.x - r.x, e.y - r.y) < PLAYER_R + 18) {
          e.carrying += 1;
          e.score += 15;
          state.relics.splice(i, 1);
          spawnRelic(state);
          sounds.push({ type: 'pickup', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: 20, reason: 'relic' });
        }
      }

      // Bank carried relics at extraction portal
      if (e.carrying > 0 && Math.hypot(e.x - PORTAL_X, e.y - PORTAL_Y) < PORTAL_R + PLAYER_R) {
        const comboBonus = e.carrying > 1 ? (e.carrying - 1) * 30 : 0;
        e.score += e.carrying * 55 + comboBonus;
        e.banked += e.carrying;
        e.carrying = 0;
        sounds.push({ type: 'lap', playerId: p.id });
        haptics.push({ playerId: p.id, pattern: [28, 25, 45], reason: 'bank' });
      }

      // Trap hits
      if (e.invulnTimer <= 0) {
        let hit = false;
        for (const s of state.spikes) {
          if (
            s.state === 'active' &&
            e.x > s.x + 6 &&
            e.x < s.x + s.w - 6 &&
            e.y > s.y + 6 &&
            e.y < s.y + s.h - 6
          ) {
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const l of state.lasers) {
            if (l.state === 'active' && pointSegDist(e.x, e.y, l.x1, l.y1, l.x2, l.y2) < PLAYER_R + 4) {
              hit = true;
              break;
            }
          }
        }
        if (!hit) {
          for (const d of state.drones) {
            if (d.disabledTimer <= 0 && Math.hypot(e.x - d.x, e.y - d.y) < PLAYER_R + d.r - 3) {
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          e.invulnTimer = 1.6;
          if (e.carrying > 0) e.carrying -= 1;
          else e.score = Math.max(0, e.score - 20);
          // Push slightly toward portal
          const dx = PORTAL_X - e.x;
          const dy = PORTAL_Y - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          e.vx = (dx / dist) * 320;
          e.vy = (dy / dist) * 320;
          sounds.push({ type: 'hit', playerId: p.id });
          haptics.push({ playerId: p.id, pattern: [55, 30, 55], reason: 'trap' });
        }
      }

      e.cooldownA = e.dashCd / DASH_CD;
      e.cooldownB = e.hackCd / HACK_CD;
      hudUpdates[p.id] = {
        score: Math.round(e.score),
        alive: true,
        statText: `Bag ${e.carrying} · Banked ${e.banked}`,
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

  getSnapshot(state): VaultHeistSnapshot {
    return {
      gameId: 'vault-heist',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      walls: state.walls,
      spikes: state.spikes.map((s) => ({
        x: s.x,
        y: s.y,
        w: s.w,
        h: s.h,
        state: s.state,
        disabledTimer: s.disabledTimer,
      })),
      lasers: state.lasers.map((l) => ({
        x1: l.x1,
        y1: l.y1,
        x2: l.x2,
        y2: l.y2,
        state: l.state,
        disabledTimer: l.disabledTimer,
      })),
      drones: state.drones.map((d) => ({
        x: d.x,
        y: d.y,
        r: d.r,
        angle: d.angle,
        disabledTimer: d.disabledTimer,
      })),
      relics: state.relics.map((r) => ({ ...r })),
      portal: state.portal,
      hackWaves: state.hackWaves.map((w) => ({ ...w })),
      players: [...state.players.values()].map((e) => ({
        id: e.id,
        slotIndex: e.slotIndex,
        name: e.name,
        colorHex: e.colorHex,
        x: e.x,
        y: e.y,
        angle: e.angle,
        dashTimer: e.dashTimer,
        invulnTimer: e.invulnTimer,
        carrying: e.carrying,
        banked: e.banked,
        score: Math.round(e.score),
        cooldownA: e.cooldownA,
        cooldownB: e.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...players]
      .map((p) => ({ p, e: state.players.get(p.id) }))
      .sort((a, b) => (b.e?.score ?? 0) - (a.e?.score ?? 0));
    return sorted.map(({ p, e }, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: p.color,
      rank: idx + 1,
      score: Math.round(e?.score ?? 0),
      highlight: `${e?.banked ?? 0} relics banked`,
    }));
  },
};
