import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/shared/types.ts';
import type {
  AirTrafficLandingSnapshot,
  FishingTensionTugSnapshot,
  HordeSurvivorSnapshot,
  LaneTowerBlitzSnapshot,
  MovingDayHavocSnapshot,
  PathTowerDefenseSnapshot,
  PipeFlowSprintSnapshot,
  RailSwitchRushSnapshot,
  StarshipCrewChaosSnapshot,
  SwarmHerdClashSnapshot,
} from '../../src/shared/packCrewDefenseTypes.ts';
import type { CompactGameModule, CompactResultEntry, CompactSoundEvent } from './packModuleAdapter.ts';

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function rankByScore<T extends { id: string; score: number }>(
  players: T[],
  labelFn: (p: T) => string
): CompactResultEntry[] {
  return [...players]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({
      playerId: p.id,
      rank: i + 1,
      score: Math.round(p.score),
      statLabel: labelFn(p),
    }));
}

// ============================================================================
// 1. LANE TOWER BLITZ (PvZ / Clash Royale style — Pad 2)
// ============================================================================
type LaneUnitKind = 'pea' | 'frost' | 'mortar';
const LANE_UNIT_CYCLE: LaneUnitKind[] = ['pea', 'frost', 'mortar'];

interface LaneTowerState {
  timeLeft: number;
  totalTime: number;
  wave: number;
  baseHp: number;
  spawnTimer: number;
  seq: number;
  towers: { id: string; row: number; col: number; kind: LaneUnitKind; level: number; cd: number; ownerId: string; ownerColor: string }[];
  enemies: { id: string; row: number; x: number; hp: number; maxHp: number; fast: boolean; chillTimer: number }[];
  bolts: { x: number; y: number; vx: number; row: number; dmg: number; splash: boolean; frost: boolean; ownerId: string; colorHex: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    row: number;
    col: number;
    pickKind: LaneUnitKind;
    score: number;
    cdA: number;
    cdB: number;
    moveCd: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function laneCellXY(row: number, col: number) {
  return { x: 235 + col * 118, y: 175 + row * 122 };
}

export const laneTowerBlitzModule: CompactGameModule<LaneTowerState, LaneTowerBlitzSnapshot> = {
  id: 'lane-tower-blitz',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      wave: 1,
      baseHp: 100,
      spawnTimer: 0.9,
      seq: 1,
      towers: [],
      enemies: [
        { id: 'le_1', row: 1, x: 960, hp: 3, maxHp: 3, fast: false, chillTimer: 0 },
        { id: 'le_2', row: 2, x: 1020, hp: 3, maxHp: 3, fast: false, chillTimer: 0 },
      ],
      bolts: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        row: i % 4,
        col: i % 2,
        pickKind: LANE_UNIT_CYCLE[i % LANE_UNIT_CYCLE.length],
        score: 0,
        cdA: 0,
        cdB: 0,
        moveCd: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DEPLOY DEFENDERS ACROSS 4 LANES TO CRUSH INVADERS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.moveCd = Math.max(0, p.moveCd - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (!inp) continue;
      const justA = inp.actionA && !p.prevA;
      const justB = inp.actionB && !p.prevB;
      p.prevA = inp.actionA;
      p.prevB = inp.actionB;

      if (p.moveCd <= 0 && (Math.abs(inp.moveX) > 0.35 || Math.abs(inp.moveY) > 0.35)) {
        if (Math.abs(inp.moveX) >= Math.abs(inp.moveY)) {
          p.col = clamp(p.col + Math.sign(inp.moveX), 0, 5);
        } else {
          p.row = clamp(p.row + Math.sign(inp.moveY), 0, 3);
        }
        p.moveCd = 0.15;
      }
      if (justB && p.cdB <= 0) {
        p.pickKind = LANE_UNIT_CYCLE[(LANE_UNIT_CYCLE.indexOf(p.pickKind) + 1) % LANE_UNIT_CYCLE.length];
        p.cdB = 0.2;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (justA && p.cdA <= 0) {
        const existing = state.towers.find((t) => t.row === p.row && t.col === p.col);
        if (existing) {
          existing.level = Math.min(3, existing.level + 1);
          existing.ownerId = p.id;
          existing.ownerColor = p.colorHex;
          p.score += 20 * mult;
        } else {
          state.towers.push({
            id: `lt_${++state.seq}`,
            row: p.row,
            col: p.col,
            kind: p.pickKind,
            level: 1,
            cd: 0.2,
            ownerId: p.id,
            ownerColor: p.colorHex,
          });
          p.score += 15 * mult;
        }
        p.cdA = frenzy ? 0.55 : 0.95;
        sounds.push({ type: 'score', playerId: p.id });
      }
    }

    // Spawn waves
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = frenzy ? 0.85 : 1.35;
      const row = Math.floor(Math.random() * 4);
      const fast = Math.random() < 0.28;
      const hp = fast ? 2 : 3 + Math.floor((state.totalTime - state.timeLeft) / 28);
      state.enemies.push({
        id: `le_${++state.seq}`,
        row,
        x: 1060,
        hp,
        maxHp: hp,
        fast,
        chillTimer: 0,
      });
    }

    // Towers fire
    for (const tw of state.towers) {
      tw.cd -= dt * (frenzy ? 1.55 : 1);
      const hasTarget = state.enemies.some((e) => e.row === tw.row && e.x >= laneCellXY(tw.row, tw.col).x - 20);
      if (tw.cd <= 0 && hasTarget) {
        const pos = laneCellXY(tw.row, tw.col);
        tw.cd = tw.kind === 'mortar' ? 1.35 : tw.kind === 'frost' ? 1.0 : 0.72 - tw.level * 0.1;
        state.bolts.push({
          x: pos.x + 22,
          y: pos.y,
          vx: tw.kind === 'mortar' ? 380 : 520,
          row: tw.row,
          dmg: tw.kind === 'mortar' ? 2 + tw.level : tw.level,
          splash: tw.kind === 'mortar',
          frost: tw.kind === 'frost',
          ownerId: tw.ownerId,
          colorHex: tw.ownerColor,
        });
      }
    }

    // Bolts move & hit
    for (let i = state.bolts.length - 1; i >= 0; i--) {
      const b = state.bolts[i];
      b.x += b.vx * dt;
      const hit = state.enemies.find((e) => e.row === b.row && Math.abs(e.x - b.x) < 26);
      if (hit) {
        const owner = state.players.find((o) => o.id === b.ownerId);
        if (b.splash) {
          for (const e of state.enemies) {
            if (Math.abs(e.row - b.row) <= 1 && Math.abs(e.x - b.x) < 95) e.hp -= b.dmg;
          }
        } else {
          hit.hp -= b.dmg;
          if (b.frost) hit.chillTimer = 2.4;
        }
        if (owner) owner.score += 12 * mult;
        state.bolts.splice(i, 1);
        sounds.push({ type: 'hit' });
      } else if (b.x > 1110) {
        state.bolts.splice(i, 1);
      }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (e.hp <= 0) {
        state.enemies.splice(i, 1);
        continue;
      }
      e.chillTimer = Math.max(0, e.chillTimer - dt);
      const spd = (e.fast ? 82 : 52) * (e.chillTimer > 0 ? 0.5 : 1);
      e.x -= spd * dt;
      if (e.x < 145) {
        state.baseHp = Math.max(0, state.baseHp - 8);
        state.enemies.splice(i, 1);
        sounds.push({ type: 'elim' });
      }
    }

    return { finished: state.timeLeft <= 0 || state.baseHp <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'lane-tower-blitz',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      wave: state.wave,
      baseHp: state.baseHp,
      towers: state.towers.map((t) => ({ id: t.id, row: t.row, col: t.col, kind: t.kind, level: t.level, ownerColor: t.ownerColor })),
      enemies: state.enemies.map((e) => ({ id: e.id, row: e.row, x: e.x, hp: e.hp, maxHp: e.maxHp, fast: e.fast })),
      bolts: state.bolts.map((b) => ({ x: b.x, y: b.y, colorHex: b.colorHex })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        row: p.row,
        col: p.col,
        pickKind: p.pickKind,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.95, 0, 1),
        cooldownB: clamp(p.cdB / 0.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} def pts`);
  },
};

// ============================================================================
// 2. PATH TOWER DEFENSE (Bloons / Kingdom Rush style — Pad 2)
// ============================================================================
type PathTowerKind = 'laser' | 'cannon' | 'frost';
const PATH_TOWER_CYCLE: PathTowerKind[] = ['laser', 'cannon', 'frost'];

interface PathTdState {
  timeLeft: number;
  totalTime: number;
  wave: number;
  lives: number;
  spawnTimer: number;
  seq: number;
  waypoints: { x: number; y: number }[];
  pads: { id: number; x: number; y: number; tower: 'none' | PathTowerKind; level: number; cd: number; ownerId: string | null; ownerColor: string }[];
  creeps: { id: string; wpIdx: number; x: number; y: number; hp: number; maxHp: number; boss: boolean; chillTimer: number }[];
  beams: { x1: number; y1: number; x2: number; y2: number; colorHex: string; age: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    padIdx: number;
    pickTower: PathTowerKind;
    score: number;
    cdA: number;
    cdB: number;
    moveCd: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

const TD_WAYPOINTS = [
  { x: 110, y: 210 },
  { x: 420, y: 210 },
  { x: 420, y: 495 },
  { x: 780, y: 495 },
  { x: 780, y: 210 },
  { x: 1090, y: 210 },
];

const TD_PADS = [
  { id: 0, x: 255, y: 140 },
  { id: 1, x: 255, y: 310 },
  { id: 2, x: 340, y: 380 },
  { id: 3, x: 510, y: 300 },
  { id: 4, x: 600, y: 405 },
  { id: 5, x: 600, y: 585 },
  { id: 6, x: 690, y: 300 },
  { id: 7, x: 870, y: 380 },
  { id: 8, x: 945, y: 140 },
  { id: 9, x: 945, y: 310 },
];

export const pathTowerDefenseModule: CompactGameModule<PathTdState, PathTowerDefenseSnapshot> = {
  id: 'path-tower-defense',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      wave: 1,
      lives: 20,
      spawnTimer: 0.7,
      seq: 1,
      waypoints: TD_WAYPOINTS,
      pads: TD_PADS.map((p) => ({ ...p, tower: 'none', level: 0, cd: 0, ownerId: null, ownerColor: '#64748B' })),
      creeps: [
        { id: 'cr_1', wpIdx: 1, x: 180, y: 210, hp: 4, maxHp: 4, boss: false, chillTimer: 0 },
      ],
      beams: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        padIdx: i % TD_PADS.length,
        pickTower: PATH_TOWER_CYCLE[i % PATH_TOWER_CYCLE.length],
        score: 0,
        cdA: 0,
        cdB: 0,
        moveCd: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'SNAP TOWERS ONTO TRACK PADS & BLAST CREEP WAVES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const bm of state.beams) bm.age += dt;
    state.beams = state.beams.filter((b) => b.age < 0.22);

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.moveCd = Math.max(0, p.moveCd - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (!inp) continue;
      const justA = inp.actionA && !p.prevA;
      const justB = inp.actionB && !p.prevB;
      p.prevA = inp.actionA;
      p.prevB = inp.actionB;

      if (p.moveCd <= 0 && (Math.abs(inp.moveX) > 0.35 || Math.abs(inp.moveY) > 0.35)) {
        const dir = Math.abs(inp.moveX) >= Math.abs(inp.moveY) ? Math.sign(inp.moveX) : Math.sign(inp.moveY) * 2;
        p.padIdx = (p.padIdx + dir + state.pads.length) % state.pads.length;
        p.moveCd = 0.16;
      }
      if (justB && p.cdB <= 0) {
        p.pickTower = PATH_TOWER_CYCLE[(PATH_TOWER_CYCLE.indexOf(p.pickTower) + 1) % PATH_TOWER_CYCLE.length];
        p.cdB = 0.2;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (justA && p.cdA <= 0) {
        const pad = state.pads[p.padIdx];
        if (pad.tower === 'none') {
          pad.tower = p.pickTower;
          pad.level = 1;
        } else {
          pad.level = Math.min(3, pad.level + 1);
        }
        pad.ownerId = p.id;
        pad.ownerColor = p.colorHex;
        p.score += 20 * mult;
        p.cdA = frenzy ? 0.55 : 0.9;
        sounds.push({ type: 'score', playerId: p.id });
      }
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = frenzy ? 0.8 : 1.25;
      const boss = state.seq % 7 === 0;
      const hp = boss ? 12 : 4 + Math.floor((state.totalTime - state.timeLeft) / 25);
      state.creeps.push({
        id: `cr_${++state.seq}`,
        wpIdx: 1,
        x: TD_WAYPOINTS[0].x,
        y: TD_WAYPOINTS[0].y,
        hp,
        maxHp: hp,
        boss,
        chillTimer: 0,
      });
    }

    for (const pad of state.pads) {
      if (pad.tower === 'none') continue;
      pad.cd -= dt * (frenzy ? 1.55 : 1);
      if (pad.cd <= 0) {
        const target = state.creeps.find((c) => Math.hypot(c.x - pad.x, c.y - pad.y) < 235);
        if (target) {
          pad.cd = pad.tower === 'cannon' ? 1.1 : pad.tower === 'frost' ? 0.85 : 0.55;
          const dmg = (pad.tower === 'cannon' ? 2.5 : 1.4) + pad.level * 0.6;
          if (pad.tower === 'cannon') {
            for (const c of state.creeps) {
              if (Math.hypot(c.x - target.x, c.y - target.y) < 85) c.hp -= dmg;
            }
          } else {
            target.hp -= dmg;
            if (pad.tower === 'frost') target.chillTimer = 2.5;
          }
          state.beams.push({ x1: pad.x, y1: pad.y, x2: target.x, y2: target.y, colorHex: pad.ownerColor, age: 0 });
          const owner = state.players.find((o) => o.id === pad.ownerId);
          if (owner) owner.score += (target.hp <= 0 ? (target.boss ? 125 : 40) : 10) * mult;
          sounds.push({ type: 'hit' });
        }
      }
    }

    for (let i = state.creeps.length - 1; i >= 0; i--) {
      const c = state.creeps[i];
      if (c.hp <= 0) {
        state.creeps.splice(i, 1);
        continue;
      }
      c.chillTimer = Math.max(0, c.chillTimer - dt);
      const wp = TD_WAYPOINTS[c.wpIdx];
      if (!wp) {
        state.lives = Math.max(0, state.lives - (c.boss ? 3 : 1));
        state.creeps.splice(i, 1);
        sounds.push({ type: 'elim' });
        continue;
      }
      const dx = wp.x - c.x;
      const dy = wp.y - c.y;
      const d = Math.hypot(dx, dy);
      const spd = (c.boss ? 72 : 112) * (c.chillTimer > 0 ? 0.52 : 1);
      if (d < 8) {
        c.wpIdx += 1;
      } else {
        c.x += (dx / d) * spd * dt;
        c.y += (dy / d) * spd * dt;
      }
    }

    return { finished: state.timeLeft <= 0 || state.lives <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'path-tower-defense',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      wave: state.wave,
      lives: state.lives,
      waypoints: state.waypoints,
      pads: state.pads.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        tower: p.tower,
        level: p.level,
        ownerColor: p.ownerColor,
      })),
      creeps: state.creeps.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
        hp: c.hp,
        maxHp: c.maxHp,
        boss: c.boss,
        chilled: c.chillTimer > 0,
      })),
      beams: state.beams.map((b) => ({ x1: b.x1, y1: b.y1, x2: b.x2, y2: b.y2, colorHex: b.colorHex })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        padIdx: p.padIdx,
        pickTower: p.pickTower,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.9, 0, 1),
        cooldownB: clamp(p.cdB / 0.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} TD pts`);
  },
};

// ============================================================================
// 3. HORDE SURVIVOR (Vampire Survivors style — Pad 1)
// ============================================================================
interface HordeState {
  timeLeft: number;
  totalTime: number;
  wave: number;
  spawnTimer: number;
  seq: number;
  enemies: { id: string; x: number; y: number; r: number; hp: number; elite: boolean }[];
  gems: { id: string; x: number; y: number; gold: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    level: number;
    xp: number;
    hp: number;
    orbitAngle: number;
    novaTimer: number;
    dashTimer: number;
    alive: boolean;
    respawnTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const hordeSurvivorModule: CompactGameModule<HordeState, HordeSurvivorSnapshot> = {
  id: 'horde-survivor',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      wave: 1,
      spawnTimer: 0.4,
      seq: 1,
      enemies: [],
      gems: Array.from({ length: 8 }, (_, i) => ({
        id: `hg_${i}`,
        x: 240 + (i % 4) * 230,
        y: 210 + Math.floor(i / 4) * 260,
        gold: i % 4 === 0,
      })),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 420 + (i % 4) * 120,
        y: 310 + Math.floor(i / 4) * 120,
        vx: 0,
        vy: 0,
        level: 1,
        xp: 0,
        hp: 100,
        orbitAngle: i,
        novaTimer: 0,
        dashTimer: 0,
        alive: true,
        respawnTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'KITE THE HORDE & GRAB XP GEMS TO EVOLVE ORBITING BLADES!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.enemies.length < 38) {
      state.spawnTimer = frenzy ? 0.32 : 0.48;
      const side = Math.floor(Math.random() * 4);
      const ex = side === 0 ? 75 : side === 1 ? ARENA_WIDTH - 75 : 100 + Math.random() * 1000;
      const ey = side === 2 ? 95 : side === 3 ? ARENA_HEIGHT - 65 : 110 + Math.random() * 500;
      const elite = state.seq % 9 === 0;
      state.enemies.push({ id: `he_${++state.seq}`, x: ex, y: ey, r: elite ? 20 : 13, hp: elite ? 3 : 1, elite });
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.novaTimer = Math.max(0, p.novaTimer - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      p.orbitAngle += dt * (4.2 + p.level * 0.4);

      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.hp = 100;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      if (inp) {
        const justA = inp.actionA && !p.prevA;
        const justB = inp.actionB && !p.prevB;
        p.prevA = inp.actionA;
        p.prevB = inp.actionB;
        const spd = p.dashTimer > 0 ? 440 : 255;
        p.x = clamp(p.x + inp.moveX * spd * dt, 90, ARENA_WIDTH - 90);
        p.y = clamp(p.y + inp.moveY * spd * dt, 100, ARENA_HEIGHT - 65);

        if (justA && p.cdA <= 0) {
          p.novaTimer = 0.35;
          p.cdA = frenzy ? 1.8 : 2.8;
          for (let i = state.enemies.length - 1; i >= 0; i--) {
            if (Math.hypot(state.enemies[i].x - p.x, state.enemies[i].y - p.y) < 155) {
              p.score += (state.enemies[i].elite ? 60 : 25) * mult;
              state.gems.push({ id: `hg_${++state.seq}`, x: state.enemies[i].x, y: state.enemies[i].y, gold: state.enemies[i].elite });
              state.enemies.splice(i, 1);
            }
          }
          sounds.push({ type: 'dash', playerId: p.id });
        }
        if (justB && p.cdB <= 0) {
          p.dashTimer = 0.28;
          p.cdB = 1.6;
          sounds.push({ type: 'dash', playerId: p.id });
        }
      }

      // Auto-orbiting blades shred enemies
      const bladeCount = Math.min(5, 1 + p.level);
      const orbitR = 54 + p.level * 6;
      for (let b = 0; b < bladeCount; b++) {
        const ang = p.orbitAngle + (b / bladeCount) * Math.PI * 2;
        const bx = p.x + Math.cos(ang) * orbitR;
        const by = p.y + Math.sin(ang) * orbitR;
        for (let i = state.enemies.length - 1; i >= 0; i--) {
          const e = state.enemies[i];
          if (Math.hypot(e.x - bx, e.y - by) < e.r + 16) {
            e.hp -= 1;
            if (e.hp <= 0) {
              p.score += (e.elite ? 70 : 25) * mult;
              state.gems.push({ id: `hg_${++state.seq}`, x: e.x, y: e.y, gold: e.elite });
              state.enemies.splice(i, 1);
              sounds.push({ type: 'hit' });
            }
          }
        }
      }

      // Vacuum gems
      for (let i = state.gems.length - 1; i >= 0; i--) {
        const g = state.gems[i];
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d < 105) {
          g.x += ((p.x - g.x) / Math.max(1, d)) * 290 * dt;
          g.y += ((p.y - g.y) / Math.max(1, d)) * 290 * dt;
        }
        if (d < 26) {
          p.xp += g.gold ? 3 : 1;
          p.score += (g.gold ? 50 : 20) * mult;
          if (p.xp >= p.level * 5) {
            p.xp = 0;
            p.level = Math.min(5, p.level + 1);
          }
          state.gems.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
    }

    // Move enemies toward nearest living player
    for (const e of state.enemies) {
      let best = state.players.find((p) => p.alive);
      let bestD = Infinity;
      for (const p of state.players) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (best && bestD > 1) {
        const spd = e.elite ? 105 : 125;
        e.x += ((best.x - e.x) / bestD) * spd * dt;
        e.y += ((best.y - e.y) / bestD) * spd * dt;
        if (bestD < e.r + 17 && best.dashTimer <= 0) {
          best.hp -= 34 * dt;
          if (best.hp <= 0) {
            best.alive = false;
            best.respawnTimer = 2.0;
            sounds.push({ type: 'elim', playerId: best.id });
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'horde-survivor',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      wave: state.wave,
      enemies: state.enemies.map((e) => ({ id: e.id, x: e.x, y: e.y, r: e.r, elite: e.elite })),
      gems: state.gems,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        level: p.level,
        hp: Math.round(p.hp),
        orbitAngle: p.orbitAngle,
        novaTimer: p.novaTimer,
        alive: p.alive,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 2.8, 0, 1),
        cooldownB: clamp(p.cdB / 1.6, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `LV${p.level} · ${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 4. STARSHIP CREW CHAOS (Lovers in a Dangerous Spacetime style — Pad 1)
// ============================================================================
interface StarshipState {
  timeLeft: number;
  totalTime: number;
  shipX: number;
  shipY: number;
  shipAngle: number;
  shieldAngle: number;
  turretAngle: number;
  hullHp: number;
  spawnTimer: number;
  seq: number;
  threats: { id: string; x: number; y: number; vx: number; vy: number; r: number; kind: 'rock' | 'drone' | 'gem' }[];
  lasers: { x1: number; y1: number; x2: number; y2: number; colorHex: string; age: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    relX: number;
    relY: number;
    operating: string | null;
    fireCd: number;
    score: number;
    cdA: number;
    cdB: number;
    prevB: boolean;
  }[];
  banner: string | null;
}

const SHIP_STATIONS: { id: 'helm' | 'shield' | 'turret' | 'thruster'; rx: number; ry: number }[] = [
  { id: 'helm', rx: 0, ry: -58 },
  { id: 'shield', rx: -62, ry: 0 },
  { id: 'turret', rx: 62, ry: 0 },
  { id: 'thruster', rx: 0, ry: 58 },
];

export const starshipCrewChaosModule: CompactGameModule<StarshipState, StarshipCrewChaosSnapshot> = {
  id: 'starship-crew-chaos',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      shipX: 600,
      shipY: 375,
      shipAngle: 0,
      shieldAngle: 0,
      turretAngle: 0,
      hullHp: 100,
      spawnTimer: 0.6,
      seq: 1,
      threats: [
        { id: 'st_1', x: 180, y: 190, vx: 65, vy: 25, r: 22, kind: 'rock' },
        { id: 'st_2', x: 1010, y: 220, vx: -60, vy: 30, r: 16, kind: 'gem' },
        { id: 'st_3', x: 960, y: 540, vx: -70, vy: -35, r: 20, kind: 'drone' },
      ],
      lasers: [],
      players: players.map((p, i) => {
        const st = SHIP_STATIONS[i % SHIP_STATIONS.length];
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          relX: st.rx,
          relY: st.ry,
          operating: null,
          fireCd: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevB: false,
        };
      }),
      banner: 'RUN TO HELM, SHIELD, OR TURRET & HOLD (A) TO DEFEND THE SHIP!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const l of state.lasers) l.age += dt;
    state.lasers = state.lasers.filter((l) => l.age < 0.16);

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.threats.length < 16) {
      state.spawnTimer = frenzy ? 0.65 : 0.95;
      const ang = Math.random() * Math.PI * 2;
      const tx = 600 + Math.cos(ang) * 560;
      const ty = 375 + Math.sin(ang) * 320;
      const toCenterAng = Math.atan2(state.shipY - ty, state.shipX - tx);
      const r = Math.random();
      const kind: StarshipState['threats'][0]['kind'] = r < 0.28 ? 'gem' : r < 0.62 ? 'rock' : 'drone';
      const spd = kind === 'drone' ? 115 : 85;
      state.threats.push({
        id: `st_${++state.seq}`,
        x: clamp(tx, 70, ARENA_WIDTH - 70),
        y: clamp(ty, 90, ARENA_HEIGHT - 60),
        vx: Math.cos(toCenterAng) * spd,
        vy: Math.sin(toCenterAng) * spd,
        r: kind === 'gem' ? 15 : 22,
        kind,
      });
    }

    for (const p of state.players) {
      p.cdB = Math.max(0, p.cdB - dt);
      p.fireCd = Math.max(0, p.fireCd - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      p.operating = null;
      if (!inp) continue;
      const justB = inp.actionB && !p.prevB;
      p.prevB = inp.actionB;

      const nearStation = SHIP_STATIONS.find((s) => Math.hypot(s.rx - p.relX, s.ry - p.relY) < 34);
      if (inp.actionA && nearStation) {
        p.operating = nearStation.id;
        const mag = Math.hypot(inp.moveX, inp.moveY);
        if (nearStation.id === 'helm' && mag > 0.15) {
          state.shipX = clamp(state.shipX + inp.moveX * 220 * dt, 180, ARENA_WIDTH - 180);
          state.shipY = clamp(state.shipY + inp.moveY * 180 * dt, 185, ARENA_HEIGHT - 165);
          state.shipAngle = Math.atan2(inp.moveY, inp.moveX);
          p.score += 14 * mult * dt;
        } else if (nearStation.id === 'shield' && mag > 0.15) {
          state.shieldAngle = Math.atan2(inp.moveY, inp.moveX);
        } else if (nearStation.id === 'thruster') {
          state.shipX = clamp(state.shipX + Math.cos(state.shipAngle) * 280 * dt, 180, ARENA_WIDTH - 180);
          state.shipY = clamp(state.shipY + Math.sin(state.shipAngle) * 220 * dt, 185, ARENA_HEIGHT - 165);
        } else if (nearStation.id === 'turret') {
          if (mag > 0.15) state.turretAngle = Math.atan2(inp.moveY, inp.moveX);
          if (p.fireCd <= 0) {
            p.fireCd = frenzy ? 0.18 : 0.28;
            const lx1 = state.shipX + Math.cos(state.turretAngle) * 95;
            const ly1 = state.shipY + Math.sin(state.turretAngle) * 95;
            const lx2 = state.shipX + Math.cos(state.turretAngle) * 520;
            const ly2 = state.shipY + Math.sin(state.turretAngle) * 520;
            state.lasers.push({ x1: lx1, y1: ly1, x2: lx2, y2: ly2, colorHex: p.colorHex, age: 0 });
            // Check ray hit on threats
            for (let i = state.threats.length - 1; i >= 0; i--) {
              const th = state.threats[i];
              if (th.kind === 'gem') continue;
              const angDiff = Math.abs(Math.atan2(th.y - state.shipY, th.x - state.shipX) - state.turretAngle);
              if (angDiff < 0.36 || angDiff > Math.PI * 2 - 0.36) {
                p.score += 75 * mult;
                state.threats.splice(i, 1);
                sounds.push({ type: 'score', playerId: p.id });
                break;
              }
            }
          }
        }
      } else {
        p.relX += inp.moveX * 195 * dt;
        p.relY += inp.moveY * 195 * dt;
        const d = Math.hypot(p.relX, p.relY);
        if (d > 82) {
          p.relX = (p.relX / d) * 82;
          p.relY = (p.relY / d) * 82;
        }
        if (justB && p.cdB <= 0) {
          const nextSt = SHIP_STATIONS[(p.slotIndex + Math.floor(Math.random() * 4)) % SHIP_STATIONS.length];
          p.relX = nextSt.rx;
          p.relY = nextSt.ry;
          p.cdB = 1.2;
          sounds.push({ type: 'dash', playerId: p.id });
        }
      }
    }

    for (let i = state.threats.length - 1; i >= 0; i--) {
      const th = state.threats[i];
      th.x += th.vx * dt;
      th.y += th.vy * dt;
      const dist = Math.hypot(th.x - state.shipX, th.y - state.shipY);
      if (dist < 105 + th.r) {
        if (th.kind === 'gem') {
          state.players.forEach((p) => { p.score += 65 * mult; });
          state.threats.splice(i, 1);
          sounds.push({ type: 'score' });
          continue;
        }
        const incAng = Math.atan2(th.y - state.shipY, th.x - state.shipX);
        let diff = Math.abs(incAng - state.shieldAngle) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < 0.95) {
          const shielder = state.players.find((p) => p.operating === 'shield');
          if (shielder) shielder.score += 85 * mult;
          sounds.push({ type: 'hit' });
        } else {
          state.hullHp = Math.max(0, state.hullHp - 10);
          sounds.push({ type: 'elim' });
        }
        state.threats.splice(i, 1);
      }
    }

    return { finished: state.timeLeft <= 0 || state.hullHp <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'starship-crew-chaos',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      shipX: state.shipX,
      shipY: state.shipY,
      shipAngle: state.shipAngle,
      shieldAngle: state.shieldAngle,
      hullHp: state.hullHp,
      stations: SHIP_STATIONS.map((s) => ({
        id: s.id,
        x: state.shipX + s.rx,
        y: state.shipY + s.ry,
        activeBy: state.players.find((p) => p.operating === s.id)?.colorHex ?? null,
      })),
      threats: state.threats.map((t) => ({ id: t.id, x: t.x, y: t.y, r: t.r, kind: t.kind })),
      lasers: state.lasers.map((l) => ({ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, colorHex: l.colorHex })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: state.shipX + p.relX,
        y: state.shipY + p.relY,
        relX: p.relX,
        relY: p.relY,
        operating: p.operating,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 1.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} crew pts`);
  },
};

// ============================================================================
// 5. SWARM HERD CLASH (Pikmin / Crowd City style — Pad 1)
// ============================================================================
interface SwarmState {
  timeLeft: number;
  totalTime: number;
  seq: number;
  neutrals: { id: string; x: number; y: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    swarmCount: number;
    dashTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const swarmHerdClashModule: CompactGameModule<SwarmState, SwarmHerdClashSnapshot> = {
  id: 'swarm-herd-clash',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const neutrals = Array.from({ length: 28 }, (_, i) => ({
      id: `sn_${i}`,
      x: 150 + ((i * 173) % 900),
      y: 135 + ((i * 137) % 480),
    }));
    return {
      timeLeft: totalTime,
      totalTime,
      seq: 30,
      neutrals,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 230 + (i % 4) * 240,
        y: 230 + Math.floor(i / 4) * 270,
        angle: 0,
        swarmCount: 4,
        dashTimer: 0,
        score: 40,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'RECRUIT WHITE FOLLOWERS & SWALLOW SMALLER RIVAL HERDS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    while (state.neutrals.length < 24) {
      state.neutrals.push({
        id: `sn_${++state.seq}`,
        x: 140 + Math.random() * 920,
        y: 130 + Math.random() * 500,
      });
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (inp) {
        const justA = inp.actionA && !p.prevA;
        const justB = inp.actionB && !p.prevB;
        p.prevA = inp.actionA;
        p.prevB = inp.actionB;
        if (justA && p.cdA <= 0) {
          p.dashTimer = 0.4;
          p.cdA = 1.6;
          sounds.push({ type: 'dash', playerId: p.id });
        }
        if (justB && p.cdB <= 0) {
          p.dashTimer = 0.3;
          p.cdB = 1.4;
          sounds.push({ type: 'dash', playerId: p.id });
        }
        const mag = Math.hypot(inp.moveX, inp.moveY);
        if (mag > 0.1) p.angle = Math.atan2(inp.moveY, inp.moveX);
        const spd = (p.dashTimer > 0 ? 410 : 255) * (frenzy ? 1.15 : 1);
        p.x = clamp(p.x + inp.moveX * spd * dt, 110, ARENA_WIDTH - 110);
        p.y = clamp(p.y + inp.moveY * spd * dt, 115, ARENA_HEIGHT - 80);
      }

      const radius = 32 + Math.min(45, p.swarmCount * 1.4);
      for (let i = state.neutrals.length - 1; i >= 0; i--) {
        const n = state.neutrals[i];
        if (Math.hypot(n.x - p.x, n.y - p.y) < radius) {
          p.swarmCount += 1;
          p.score += 18 * mult;
          state.neutrals.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
    }

    // Swarm vs Swarm absorption
    for (let i = 0; i < state.players.length; i++) {
      for (let j = i + 1; j < state.players.length; j++) {
        const a = state.players[i];
        const b = state.players[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 52) {
          if (a.swarmCount >= b.swarmCount + 3) {
            const steal = Math.max(2, Math.floor(b.swarmCount * 0.45));
            a.swarmCount += steal;
            b.swarmCount = Math.max(2, b.swarmCount - steal);
            a.score += steal * 25 * mult;
            b.x = 180 + Math.random() * 840;
            sounds.push({ type: 'elim', playerId: b.id });
          } else if (b.swarmCount >= a.swarmCount + 3) {
            const steal = Math.max(2, Math.floor(a.swarmCount * 0.45));
            b.swarmCount += steal;
            a.swarmCount = Math.max(2, a.swarmCount - steal);
            b.score += steal * 25 * mult;
            a.x = 180 + Math.random() * 840;
            sounds.push({ type: 'elim', playerId: a.id });
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'swarm-herd-clash',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      neutrals: state.neutrals,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        swarmCount: p.swarmCount,
        dashTimer: p.dashTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.6, 0, 1),
        cooldownB: clamp(p.cdB / 1.4, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.swarmCount} herd · ${Math.round(p.score)} pts`);
  },
};

// ============================================================================
// 6. RAIL SWITCH RUSH (Mini Metro / Train Conductor style — Pad 2)
// ============================================================================
interface RailState {
  timeLeft: number;
  totalTime: number;
  slowTimer: number;
  spawnTimer: number;
  seq: number;
  switches: { id: number; x: number; y: number; state: boolean; row: number }[];
  trains: { id: string; x: number; row: number; targetRow: number; colorHex: string; label: string; ownerColor: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorSwitch: number;
    score: number;
    cdA: number;
    cdB: number;
    moveCd: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

const RAIL_COLORS = ['#EF4444', '#00C2FF', '#FFB800'];
const RAIL_LABELS = ['RED', 'BLU', 'GLD'];

export const railSwitchRushModule: CompactGameModule<RailState, RailSwitchRushSnapshot> = {
  id: 'rail-switch-rush',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const switches = [
      { id: 0, x: 420, y: 225, state: false, row: 0 },
      { id: 1, x: 740, y: 225, state: true, row: 0 },
      { id: 2, x: 420, y: 375, state: false, row: 1 },
      { id: 3, x: 740, y: 375, state: false, row: 1 },
      { id: 4, x: 420, y: 525, state: true, row: 2 },
      { id: 5, x: 740, y: 525, state: false, row: 2 },
    ];
    return {
      timeLeft: totalTime,
      totalTime,
      slowTimer: 0,
      spawnTimer: 1.0,
      seq: 1,
      switches,
      trains: [{ id: 'tr_1', x: 160, row: 0, targetRow: 1, colorHex: RAIL_COLORS[1], label: 'BLU', ownerColor: '#FFFFFF' }],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorSwitch: i % switches.length,
        score: 0,
        cdA: 0,
        cdB: 0,
        moveCd: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'FLIP TRACK SWITCHES (A) TO GUIDE COLORED TRAINS TO MATCHING STATIONS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.slowTimer = Math.max(0, state.slowTimer - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.moveCd = Math.max(0, p.moveCd - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (!inp) continue;
      const justA = inp.actionA && !p.prevA;
      const justB = inp.actionB && !p.prevB;
      p.prevA = inp.actionA;
      p.prevB = inp.actionB;

      if (p.moveCd <= 0 && (Math.abs(inp.moveX) > 0.35 || Math.abs(inp.moveY) > 0.35)) {
        const col = p.cursorSwitch % 2;
        const row = Math.floor(p.cursorSwitch / 2);
        const nCol = clamp(col + (Math.abs(inp.moveX) > 0.35 ? Math.sign(inp.moveX) : 0), 0, 1);
        const nRow = clamp(row + (Math.abs(inp.moveY) > 0.35 ? Math.sign(inp.moveY) : 0), 0, 2);
        p.cursorSwitch = nRow * 2 + nCol;
        p.moveCd = 0.16;
      }
      if (justA && p.cdA <= 0) {
        const sw = state.switches[p.cursorSwitch];
        sw.state = !sw.state;
        p.score += 10 * mult;
        p.cdA = 0.2;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (justB && p.cdB <= 0) {
        state.slowTimer = 2.5;
        p.cdB = 4.0;
        sounds.push({ type: 'dash', playerId: p.id });
      }
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.trains.length < 6) {
      state.spawnTimer = frenzy ? 1.55 : 2.25;
      const row = Math.floor(Math.random() * 3);
      const targetRow = Math.floor(Math.random() * 3);
      state.trains.push({
        id: `tr_${++state.seq}`,
        x: 140,
        row,
        targetRow,
        colorHex: RAIL_COLORS[targetRow],
        label: RAIL_LABELS[targetRow],
        ownerColor: '#FFFFFF',
      });
    }

    const spd = (state.slowTimer > 0 ? 78 : frenzy ? 195 : 155) * dt;
    for (let i = state.trains.length - 1; i >= 0; i--) {
      const tr = state.trains[i];
      const prevX = tr.x;
      tr.x += spd;
      for (const sw of state.switches) {
        if (prevX < sw.x && tr.x >= sw.x && tr.row === sw.row && sw.state) {
          tr.row = (tr.row + 1) % 3;
        }
      }
      if (tr.x >= 1020) {
        if (tr.row === tr.targetRow) {
          state.players.forEach((p) => { p.score += 100 * mult; });
          sounds.push({ type: 'score' });
        } else {
          sounds.push({ type: 'elim' });
        }
        state.trains.splice(i, 1);
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'rail-switch-rush',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      switches: state.switches.map((s) => ({ id: s.id, x: s.x, y: s.y, state: s.state })),
      trains: state.trains.map((t) => ({
        id: t.id,
        x: t.x,
        y: 225 + t.row * 150,
        row: t.row,
        targetRow: t.targetRow,
        colorHex: t.colorHex,
        label: t.label,
      })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorSwitch: p.cursorSwitch,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.25, 0, 1),
        cooldownB: clamp(p.cdB / 4.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} rail pts`);
  },
};

// ============================================================================
// 7. AIR TRAFFIC LANDING (Flight Control style — Pad 3)
// ============================================================================
interface AirTrafficState {
  timeLeft: number;
  totalTime: number;
  spawnTimer: number;
  seq: number;
  runways: { id: string; kind: 'jet' | 'heli'; x: number; y: number; colorHex: string }[];
  planes: { id: string; x: number; y: number; angle: number; kind: 'jet' | 'heli'; guidedBy: string | null; colorHex: string; holding: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    lockedPlaneId: string | null;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const airTrafficLandingModule: CompactGameModule<AirTrafficState, AirTrafficLandingSnapshot> = {
  id: 'air-traffic-landing',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const runways: AirTrafficState['runways'] = [
      { id: 'rw_jet', kind: 'jet', x: 450, y: 390, colorHex: '#38BDF8' },
      { id: 'rw_heli', kind: 'heli', x: 750, y: 390, colorHex: '#FFB800' },
    ];
    return {
      timeLeft: totalTime,
      totalTime,
      spawnTimer: 1.0,
      seq: 1,
      runways,
      planes: [
        { id: 'pl_1', x: 180, y: 200, angle: 0.4, kind: 'jet', guidedBy: null, colorHex: '#38BDF8', holding: false },
        { id: 'pl_2', x: 980, y: 200, angle: 2.7, kind: 'heli', guidedBy: null, colorHex: '#FFB800', holding: false },
      ],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 340 + i * 140,
        y: 260,
        lockedPlaneId: null,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'GUIDE JETS TO BLUE RUNWAY & CHOPPERS TO GOLD HELIPAD!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.planes.length < 7) {
      state.spawnTimer = frenzy ? 1.5 : 2.15;
      const left = Math.random() > 0.5;
      const kind: 'jet' | 'heli' = Math.random() > 0.45 ? 'jet' : 'heli';
      const px = left ? 110 : ARENA_WIDTH - 110;
      const py = 135 + Math.random() * 440;
      state.planes.push({
        id: `pl_${++state.seq}`,
        x: px,
        y: py,
        angle: Math.atan2(390 - py, 600 - px),
        kind,
        guidedBy: null,
        colorHex: kind === 'jet' ? '#38BDF8' : '#FFB800',
        holding: false,
      });
    }

    for (const p of state.players) {
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (!inp) continue;
      const justB = inp.actionB && !p.prevB;
      p.prevA = inp.actionA;
      p.prevB = inp.actionB;

      p.x = clamp(p.x + inp.moveX * 520 * dt, 90, ARENA_WIDTH - 90);
      p.y = clamp(p.y + inp.moveY * 420 * dt, 100, ARENA_HEIGHT - 75);

      if (inp.actionA) {
        let locked = state.planes.find((pl) => pl.id === p.lockedPlaneId);
        if (!locked) {
          locked = state.planes.find((pl) => Math.hypot(pl.x - p.x, pl.y - p.y) < 120);
          p.lockedPlaneId = locked?.id ?? null;
        }
        if (locked) {
          locked.guidedBy = p.id;
          locked.holding = false;
          if (Math.hypot(inp.moveX, inp.moveY) > 0.15) {
            locked.angle = Math.atan2(inp.moveY, inp.moveX);
          }
        }
      } else {
        p.lockedPlaneId = null;
      }

      if (justB && p.cdB <= 0) {
        const nearest = state.planes.find((pl) => Math.hypot(pl.x - p.x, pl.y - p.y) < 160);
        if (nearest) {
          nearest.holding = !nearest.holding;
          p.cdB = 0.8;
          sounds.push({ type: 'tick', playerId: p.id });
        }
      }
    }

    for (let i = state.planes.length - 1; i >= 0; i--) {
      const pl = state.planes[i];
      if (pl.holding) pl.angle += 2.2 * dt;
      const spd = (pl.kind === 'jet' ? 115 : 88) * dt;
      pl.x += Math.cos(pl.angle) * spd;
      pl.y += Math.sin(pl.angle) * spd;

      if (pl.x < 85 || pl.x > ARENA_WIDTH - 85) pl.angle = Math.PI - pl.angle;
      if (pl.y < 100 || pl.y > ARENA_HEIGHT - 70) pl.angle = -pl.angle;

      const rw = state.runways.find((r) => r.kind === pl.kind && Math.hypot(pl.x - r.x, pl.y - r.y) < 42);
      if (rw) {
        const owner = state.players.find((o) => o.id === pl.guidedBy);
        if (owner) owner.score += 125 * mult;
        else state.players.forEach((o) => { o.score += 40 * mult; });
        state.planes.splice(i, 1);
        sounds.push({ type: 'score', playerId: pl.guidedBy ?? undefined });
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'air-traffic-landing',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      runways: state.runways,
      planes: state.planes,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        lockedPlaneId: p.lockedPlaneId,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 0.8, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} ATC pts`);
  },
};

// ============================================================================
// 8. PIPE FLOW SPRINT (Pipe Mania style — Pad 2)
// ============================================================================
interface PipeState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  flowProgress: number;
  pipes: { kind: 'straight' | 'corner' | 'cross'; rot: number; filled: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    score: number;
    cdA: number;
    cdB: number;
    moveCd: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

// Bitmask directions: 0=Top(1), 1=Right(2), 2=Bottom(4), 3=Left(8)
function pipePorts(kind: 'straight' | 'corner' | 'cross', rot: number): number {
  const r = ((rot % 4) + 4) % 4;
  if (kind === 'cross') return 15;
  if (kind === 'straight') return r % 2 === 0 ? 10 : 5;
  // corner: rot 0 -> Top+Right (3), 1 -> Right+Bottom (6), 2 -> Bottom+Left (12), 3 -> Left+Top (9)
  return [3, 6, 12, 9][r];
}

function buildPipeBoard(cols: number, rows: number) {
  const kinds: ('straight' | 'corner' | 'cross')[] = ['straight', 'corner', 'straight', 'corner', 'cross'];
  return Array.from({ length: cols * rows }, (_, idx) => ({
    kind: idx % 7 === 0 ? 'cross' : kinds[idx % kinds.length],
    rot: Math.floor(Math.random() * 4),
    filled: false,
  }));
}

function computeConnectedFlow(pipes: PipeState['pipes'], cols: number, rows: number): boolean {
  pipes.forEach((p) => { p.filled = false; });
  const startR = Math.floor(rows / 2);
  const startIdx = startR * cols;
  if ((pipePorts(pipes[startIdx].kind, pipes[startIdx].rot) & 8) === 0) return false;
  const q = [startIdx];
  pipes[startIdx].filled = true;
  let reachedEnd = false;
  while (q.length > 0) {
    const cur = q.shift()!;
    const r = Math.floor(cur / cols);
    const c = cur % cols;
    const mask = pipePorts(pipes[cur].kind, pipes[cur].rot);
    if (c === cols - 1 && r === startR && (mask & 2) !== 0) reachedEnd = true;
    const dirs = [
      { dr: -1, dc: 0, bit: 1, opp: 4 },
      { dr: 0, dc: 1, bit: 2, opp: 8 },
      { dr: 1, dc: 0, bit: 4, opp: 1 },
      { dr: 0, dc: -1, bit: 8, opp: 2 },
    ];
    for (const d of dirs) {
      if ((mask & d.bit) === 0) continue;
      const nr = r + d.dr;
      const nc = c + d.dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      const nIdx = nr * cols + nc;
      if (pipes[nIdx].filled) continue;
      if ((pipePorts(pipes[nIdx].kind, pipes[nIdx].rot) & d.opp) !== 0) {
        pipes[nIdx].filled = true;
        q.push(nIdx);
      }
    }
  }
  return reachedEnd;
}

export const pipeFlowSprintModule: CompactGameModule<PipeState, PipeFlowSprintSnapshot> = {
  id: 'pipe-flow-sprint',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const cols = 7;
    const rows = 5;
    const pipes = buildPipeBoard(cols, rows);
    computeConnectedFlow(pipes, cols, rows);
    return {
      timeLeft: totalTime,
      totalTime,
      cols,
      rows,
      flowProgress: 0,
      pipes,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: Math.min(rows - 1, 1 + (i % 3)),
        c: Math.min(cols - 1, i % 4),
        score: 0,
        cdA: 0,
        cdB: 0,
        moveCd: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'ROTATE PIPES (A) TO CONNECT LEFT VALVE TO RIGHT DRAIN!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.moveCd = Math.max(0, p.moveCd - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (!inp) continue;
      const justA = inp.actionA && !p.prevA;
      const justB = inp.actionB && !p.prevB;
      p.prevA = inp.actionA;
      p.prevB = inp.actionB;

      if (p.moveCd <= 0 && (Math.abs(inp.moveX) > 0.35 || Math.abs(inp.moveY) > 0.35)) {
        if (Math.abs(inp.moveX) >= Math.abs(inp.moveY)) p.c = clamp(p.c + Math.sign(inp.moveX), 0, state.cols - 1);
        else p.r = clamp(p.r + Math.sign(inp.moveY), 0, state.rows - 1);
        p.moveCd = 0.14;
      }

      if (justA && p.cdA <= 0) {
        const idx = p.r * state.cols + p.c;
        state.pipes[idx].rot = (state.pipes[idx].rot + 1) % 4;
        const done = computeConnectedFlow(state.pipes, state.cols, state.rows);
        p.score += 18 * mult;
        p.cdA = 0.12;
        sounds.push({ type: 'tick', playerId: p.id });
        if (done) {
          p.score += 180 * mult;
          state.pipes = buildPipeBoard(state.cols, state.rows);
          computeConnectedFlow(state.pipes, state.cols, state.rows);
          state.banner = `${p.name} COMPLETED THE PIPELINE! (+180 PTS)`;
          sounds.push({ type: 'win', playerId: p.id });
        }
      }

      if (justB && p.cdB <= 0) {
        const filledCount = state.pipes.filter((pp) => pp.filled).length;
        p.score += filledCount * 8 * mult;
        state.pipes = buildPipeBoard(state.cols, state.rows);
        computeConnectedFlow(state.pipes, state.cols, state.rows);
        p.cdB = 3.0;
        sounds.push({ type: 'score', playerId: p.id });
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'pipe-flow-sprint',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: state.cols,
      rows: state.rows,
      flowProgress: state.flowProgress,
      pipes: state.pipes,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: p.r,
        c: p.c,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: clamp(p.cdB / 3.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} pipe pts`);
  },
};

// ============================================================================
// 9. MOVING DAY HAVOC (Moving Out style — Pad 1)
// ============================================================================
interface MovingDayState {
  timeLeft: number;
  totalTime: number;
  seq: number;
  truckZone: { x: number; y: number; w: number; h: number };
  items: { id: string; kind: 'sofa' | 'tv' | 'piano' | 'box'; x: number; y: number; vx: number; vy: number; value: number; carrierId: string | null }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    carryingId: string | null;
    dashTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function makeMovingItems(seqStart: number): MovingDayState['items'] {
  const specs: { kind: 'sofa' | 'tv' | 'piano' | 'box'; x: number; y: number; value: number }[] = [
    { kind: 'sofa', x: 240, y: 210, value: 110 },
    { kind: 'tv', x: 350, y: 510, value: 90 },
    { kind: 'piano', x: 210, y: 390, value: 160 },
    { kind: 'box', x: 490, y: 250, value: 75 },
    { kind: 'box', x: 520, y: 480, value: 75 },
  ];
  return specs.map((s, i) => ({
    id: `mv_${seqStart + i}`,
    kind: s.kind,
    x: s.x,
    y: s.y,
    vx: 0,
    vy: 0,
    value: s.value,
    carrierId: null,
  }));
}

export const movingDayHavocModule: CompactGameModule<MovingDayState, MovingDayHavocSnapshot> = {
  id: 'moving-day-havoc',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      seq: 10,
      truckZone: { x: 890, y: 215, w: 195, h: 310 },
      items: makeMovingItems(1),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 680 + (i % 2) * 55,
        y: 230 + Math.floor(i / 2) * 75,
        angle: Math.PI,
        carryingId: null,
        dashTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'GRAB FURNITURE (A) & HEAVE IT INTO THE MOVING TRUCK (B)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.dashTimer = Math.max(0, p.dashTimer - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (inp) {
        const justA = inp.actionA && !p.prevA;
        const justB = inp.actionB && !p.prevB;
        p.prevA = inp.actionA;
        p.prevB = inp.actionB;

        const mag = Math.hypot(inp.moveX, inp.moveY);
        if (mag > 0.12) p.angle = Math.atan2(inp.moveY, inp.moveX);
        const held = state.items.find((it) => it.id === p.carryingId);
        const carrySlow = held ? (held.kind === 'piano' ? 0.66 : 0.82) : 1.0;
        const spd = (p.dashTimer > 0 ? 410 : 275) * carrySlow;
        p.x = clamp(p.x + inp.moveX * spd * dt, 100, ARENA_WIDTH - 100);
        p.y = clamp(p.y + inp.moveY * spd * dt, 110, ARENA_HEIGHT - 80);

        if (justA && p.cdA <= 0) {
          if (held) {
            held.carrierId = null;
            p.carryingId = null;
          } else {
            const pick = state.items.find((it) => !it.carrierId && Math.hypot(it.x - p.x, it.y - p.y) < 55);
            if (pick) {
              pick.carrierId = p.id;
              p.carryingId = pick.id;
              sounds.push({ type: 'tick', playerId: p.id });
            }
          }
          p.cdA = 0.2;
        }
        if (justB && p.cdB <= 0) {
          if (held) {
            held.carrierId = null;
            p.carryingId = null;
            held.vx = Math.cos(p.angle) * 520;
            held.vy = Math.sin(p.angle) * 520;
            p.cdB = 0.5;
            sounds.push({ type: 'dash', playerId: p.id });
          } else {
            p.dashTimer = 0.3;
            p.cdB = 1.1;
            sounds.push({ type: 'dash', playerId: p.id });
          }
        }
      }
    }

    const tz = state.truckZone;
    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      if (it.carrierId) {
        const carrier = state.players.find((pl) => pl.id === it.carrierId);
        if (carrier) {
          it.x = carrier.x + Math.cos(carrier.angle) * 28;
          it.y = carrier.y + Math.sin(carrier.angle) * 28;
        }
      } else {
        it.x = clamp(it.x + it.vx * dt, 100, ARENA_WIDTH - 95);
        it.y = clamp(it.y + it.vy * dt, 110, ARENA_HEIGHT - 80);
        it.vx *= Math.pow(0.84, dt * 10);
        it.vy *= Math.pow(0.84, dt * 10);
      }

      if (it.x >= tz.x && it.x <= tz.x + tz.w && it.y >= tz.y && it.y <= tz.y + tz.h) {
        const owner =
          state.players.find((pl) => pl.id === it.carrierId) ??
          state.players.reduce((best, cur) =>
            Math.hypot(cur.x - it.x, cur.y - it.y) < Math.hypot(best.x - it.x, best.y - it.y) ? cur : best
          );
        if (owner) {
          owner.score += it.value * mult;
          if (owner.carryingId === it.id) owner.carryingId = null;
          sounds.push({ type: 'score', playerId: owner.id });
        }
        state.items.splice(i, 1);
      }
    }

    if (state.items.length === 0) {
      state.seq += 10;
      state.items = makeMovingItems(state.seq);
      state.banner = 'TRUCK LOADED! FRESH FURNITURE DELIVERED!';
      sounds.push({ type: 'win' });
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'moving-day-havoc',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      truckZone: state.truckZone,
      items: state.items.map((it) => ({
        id: it.id,
        kind: it.kind,
        x: it.x,
        y: it.y,
        value: it.value,
        carrierId: it.carrierId,
      })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        carryingId: p.carryingId,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.25, 0, 1),
        cooldownB: clamp(p.cdB / 1.1, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} cargo pts`);
  },
};

// ============================================================================
// 10. FISHING TENSION TUG (Arcade Bass Fishing style — Pad 3)
// ============================================================================
interface FishingState {
  timeLeft: number;
  totalTime: number;
  seq: number;
  fish: { id: string; x: number; y: number; vx: number; vy: number; size: number; gold: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    hooked: boolean;
    tension: number;
    reelProgress: number;
    fishGold: boolean;
    catches: number;
    score: number;
    cdA: number;
    cdB: number;
    prevB: boolean;
  }[];
  banner: string | null;
}

function makeFish(seq: number): FishingState['fish'][0] {
  const gold = Math.random() < 0.34;
  return {
    id: `fs_${seq}`,
    x: 180 + Math.random() * 840,
    y: 165 + Math.random() * 410,
    vx: (Math.random() - 0.5) * 140,
    vy: (Math.random() - 0.5) * 90,
    size: gold ? 24 : 18,
    gold,
  };
}

export const fishingTensionTugModule: CompactGameModule<FishingState, FishingTensionTugSnapshot> = {
  id: 'fishing-tension-tug',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      seq: 20,
      fish: Array.from({ length: 10 }, (_, i) => makeFish(i + 1)),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 260 + i * 115,
        y: 350,
        hooked: false,
        tension: 0,
        reelProgress: 0,
        fishGold: false,
        catches: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevB: false,
      })),
      banner: 'AIM BOBBER OVER FISH & HOLD REEL (A)—DON’T SNAP THE LINE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    while (state.fish.length < 9) {
      state.fish.push(makeFish(++state.seq));
    }

    for (const f of state.fish) {
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.x < 140 || f.x > ARENA_WIDTH - 140) f.vx *= -1;
      if (f.y < 140 || f.y > ARENA_HEIGHT - 110) f.vy *= -1;
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (!inp) continue;
      const justB = inp.actionB && !p.prevB;
      p.prevB = inp.actionB;

      if (!p.hooked) {
        p.x = clamp(p.x + inp.moveX * 480 * dt, 130, ARENA_WIDTH - 130);
        p.y = clamp(p.y + inp.moveY * 400 * dt, 135, ARENA_HEIGHT - 105);
        if (inp.actionA && p.cdA <= 0) {
          const hitIdx = state.fish.findIndex((f) => Math.hypot(f.x - p.x, f.y - p.y) < f.size + 28);
          if (hitIdx >= 0) {
            const caught = state.fish.splice(hitIdx, 1)[0];
            p.hooked = true;
            p.fishGold = caught.gold;
            p.tension = 0.25;
            p.reelProgress = 0.12;
            sounds.push({ type: 'hit', playerId: p.id });
          }
        }
      } else {
        if (justB && p.cdB <= 0) {
          p.tension = Math.max(0.05, p.tension - 0.32);
          p.cdB = 0.85;
          sounds.push({ type: 'tick', playerId: p.id });
        }
        if (inp.actionA) {
          p.reelProgress += dt * (frenzy ? 0.92 : 0.72);
          p.tension += dt * (p.fishGold ? 0.64 : 0.48);
        } else {
          p.tension = Math.max(0, p.tension - dt * 0.78);
        }

        if (p.tension >= 1.0) {
          p.hooked = false;
          p.tension = 0;
          p.reelProgress = 0;
          p.cdA = 0.85;
          sounds.push({ type: 'elim', playerId: p.id });
        } else if (p.reelProgress >= 1.0) {
          p.hooked = false;
          p.tension = 0;
          p.reelProgress = 0;
          p.catches += 1;
          p.score += (p.fishGold ? 175 : 100) * mult;
          p.cdA = 0.35;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'fishing-tension-tug',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      fish: state.fish.map((f) => ({ id: f.id, x: f.x, y: f.y, size: f.size, gold: f.gold })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        hooked: p.hooked,
        tension: p.tension,
        reelProgress: p.reelProgress,
        fishGold: p.fishGold,
        catches: p.catches,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.85, 0, 1),
        cooldownB: clamp(p.cdB / 0.85, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.catches} fish · ${Math.round(p.score)} pts`);
  },
};
