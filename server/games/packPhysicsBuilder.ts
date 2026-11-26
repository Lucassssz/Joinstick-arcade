import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/shared/types.ts';
import type {
  ArtilleryCraterWarSnapshot,
  BridgeLoadStressSnapshot,
  HillTorqueClimbSnapshot,
  RopeSlicePhysicsSnapshot,
  SlingshotFortressSnapshot,
  ThreeLaneMetroSnapshot,
  TiltLabyrinthSnapshot,
  TrackCrafterGpSnapshot,
  TrapBuilderRunSnapshot,
  WobblyTimberPullSnapshot,
} from '../../src/shared/packPhysicsBuilderTypes.ts';
import type {
  CompactGameModule,
  CompactPlayerInput,
  CompactResultEntry,
  CompactSoundEvent,
} from './packModuleAdapter.ts';

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
// 1. TRAP BUILDER RUN (Ultimate Chicken Horse style)
// ============================================================================
type TrapKind = 'platform' | 'spring' | 'saw' | 'spike' | 'ice';
const TRAP_CYCLE: TrapKind[] = ['platform', 'spring', 'saw', 'spike', 'ice'];

interface TrapItem {
  id: string;
  kind: TrapKind;
  x: number;
  y: number;
  w: number;
  h: number;
  ownerId: string;
  colorHex: string;
}

interface TrapBuilderState {
  timeLeft: number;
  totalTime: number;
  round: number;
  phase: 'build' | 'run';
  phaseTimer: number;
  items: TrapItem[];
  goal: { x: number; y: number };
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    onGround: boolean;
    cursorX: number;
    cursorY: number;
    selectedKind: TrapKind;
    placedThisRound: boolean;
    finishedRound: boolean;
    alive: boolean;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const trapBuilderRunModule: CompactGameModule<TrapBuilderState, TrapBuilderRunSnapshot> = {
  id: 'trap-builder-run',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const starterItems: TrapItem[] = [
      { id: 'base_start', kind: 'platform', x: 140, y: 510, w: 180, h: 24, ownerId: 'sys', colorHex: '#64748B' },
      { id: 'base_mid', kind: 'platform', x: 580, y: 455, w: 150, h: 24, ownerId: 'sys', colorHex: '#64748B' },
      { id: 'base_goal', kind: 'platform', x: 1050, y: 390, w: 180, h: 24, ownerId: 'sys', colorHex: '#64748B' },
    ];
    return {
      timeLeft: totalTime,
      totalTime,
      round: 1,
      phase: 'build',
      phaseTimer: 5.5,
      items: starterItems,
      goal: { x: 1060, y: 345 },
      players: players.map((p, idx) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 110 + (idx % 4) * 26,
        y: 470,
        vx: 0,
        vy: 0,
        onGround: true,
        cursorX: 340 + idx * 95,
        cursorY: 420,
        selectedKind: idx % 2 === 0 ? 'platform' : 'saw',
        placedThisRound: false,
        finishedRound: false,
        alive: true,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'BUILD PHASE: DROP TRAPS OR PLATFORMS (A)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.phaseTimer -= dt;
    const mult = frenzy ? 2 : 1;

    if (state.phase === 'build') {
      for (const p of state.players) {
        const inp = players.find((x) => x.id === p.id)?.input;
        p.cdA = Math.max(0, p.cdA - dt);
        p.cdB = Math.max(0, p.cdB - dt);
        if (!inp) continue;
        p.cursorX = clamp(p.cursorX + inp.moveX * 420 * dt, 240, 960);
        p.cursorY = clamp(p.cursorY + inp.moveY * 360 * dt, 190, 560);
        const justB = inp.actionB && !p.prevB;
        const justA = inp.actionA && !p.prevA;
        p.prevA = inp.actionA;
        p.prevB = inp.actionB;

        if (justB && !p.placedThisRound) {
          const idx = TRAP_CYCLE.indexOf(p.selectedKind);
          p.selectedKind = TRAP_CYCLE[(idx + 1) % TRAP_CYCLE.length];
          sounds.push({ type: 'tick', playerId: p.id });
        }
        if (justA && !p.placedThisRound) {
          p.placedThisRound = true;
          const isSmall = p.selectedKind === 'saw' || p.selectedKind === 'spring';
          state.items.push({
            id: `it_${state.round}_${p.slotIndex}_${state.items.length}`,
            kind: p.selectedKind,
            x: Math.round(p.cursorX),
            y: Math.round(p.cursorY),
            w: isSmall ? 58 : p.selectedKind === 'spike' ? 92 : 132,
            h: isSmall ? 34 : 22,
            ownerId: p.id,
            colorHex: p.colorHex,
          });
          if (state.items.length > 26) state.items.splice(3, 1);
          p.score += 15 * mult;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      if (state.phaseTimer <= 0 || state.players.every((p) => p.placedThisRound)) {
        state.phase = 'run';
        state.phaseTimer = 11.5;
        state.banner = `ROUND ${state.round}: RACE TO THE GOLD FLAG!`;
        state.players.forEach((p, idx) => {
          p.x = 110 + (idx % 4) * 24;
          p.y = 470;
          p.vx = 0;
          p.vy = 0;
          p.onGround = true;
          p.alive = true;
          p.finishedRound = false;
        });
        sounds.push({ type: 'dash' });
      }
    } else {
      // RUN phase
      for (const p of state.players) {
        p.cdA = Math.max(0, p.cdA - dt);
        p.cdB = Math.max(0, p.cdB - dt);
        if (!p.alive || p.finishedRound) continue;
        const inp = players.find((x) => x.id === p.id)?.input;
        const mx = inp?.moveX ?? 0;
        const justA = Boolean(inp?.actionA && !p.prevA);
        const justB = Boolean(inp?.actionB && !p.prevB);
        if (inp) {
          p.prevA = inp.actionA;
          p.prevB = inp.actionB;
        }

        const accel = frenzy ? 1.15 : 1;
        p.vx = clamp(p.vx * 0.84 + mx * 340 * accel * 0.28, -330 * accel, 330 * accel);
        if (justA && p.onGround) {
          p.vy = -590;
          p.onGround = false;
          p.cdA = 0.25;
          sounds.push({ type: 'dash', playerId: p.id });
        }
        if (justB && p.cdB <= 0) {
          p.vx = (mx !== 0 ? Math.sign(mx) : 1) * 490 * accel;
          p.vy = Math.min(p.vy, -130);
          p.cdB = 1.4;
          sounds.push({ type: 'dash', playerId: p.id });
        }

        p.vy = Math.min(820, p.vy + 1320 * dt);
        const prevY = p.y;
        p.x = clamp(p.x + p.vx * dt, 45, ARENA_WIDTH - 45);
        p.y += p.vy * dt;
        p.onGround = false;

        for (const it of state.items) {
          const halfW = it.w / 2 + 14;
          const topY = it.y - it.h / 2;
          if (Math.abs(p.x - it.x) <= halfW && Math.abs(p.y - it.y) <= it.h / 2 + 18) {
            if (it.kind === 'saw' || it.kind === 'spike') {
              p.alive = false;
              const owner = state.players.find((o) => o.id === it.ownerId);
              if (owner && owner.id !== p.id) owner.score += 55 * mult;
              sounds.push({ type: 'elim', playerId: p.id });
              break;
            } else if (it.kind === 'spring') {
              p.vy = -760;
              p.onGround = false;
              sounds.push({ type: 'dash', playerId: p.id });
            } else if (p.vy >= 0 && prevY <= topY + 12) {
              p.y = topY - 16;
              p.vy = 0;
              p.onGround = true;
              if (it.kind === 'ice') p.vx *= 1.04;
            }
          }
        }

        if (p.y > 650) {
          p.alive = false;
          sounds.push({ type: 'elim', playerId: p.id });
        } else if (p.alive && Math.hypot(p.x - state.goal.x, p.y - state.goal.y) < 42) {
          p.finishedRound = true;
          const finishRank = state.players.filter((x) => x.finishedRound).length;
          const pts = Math.max(70, 150 - (finishRank - 1) * 25) * mult;
          p.score += pts;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      const activeLeft = state.players.filter((p) => p.alive && !p.finishedRound).length;
      if (state.phaseTimer <= 0 || activeLeft === 0) {
        const finishers = state.players.filter((p) => p.finishedRound);
        if (finishers.length > 0 && finishers.length < state.players.length) {
          finishers.forEach((f) => {
            f.score += 55 * mult;
          });
        }
        state.round += 1;
        state.phase = 'build';
        state.phaseTimer = 5.2;
        state.banner = `ROUND ${state.round}: PLACE YOUR NEXT TRAP!`;
        state.players.forEach((p, idx) => {
          p.placedThisRound = false;
          p.finishedRound = false;
          p.alive = true;
          p.x = 110 + (idx % 4) * 26;
          p.y = 470;
          p.vx = 0;
          p.vy = 0;
        });
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'trap-builder-run',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      phase: state.phase,
      phaseTimer: state.phaseTimer,
      items: state.items,
      goal: state.goal,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        cursorX: p.cursorX,
        cursorY: p.cursorY,
        selectedKind: p.selectedKind,
        placedThisRound: p.placedThisRound,
        finishedRound: p.finishedRound,
        alive: p.alive,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.3, 0, 1),
        cooldownB: clamp(p.cdB / 1.4, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} builder pts`);
  },
};

// ============================================================================
// 2. TRACK CRAFTER GP (Make Way style)
// ============================================================================
type TrackPieceKind = 'boost' | 'hazard' | 'ramp';
const PIECE_CYCLE: TrackPieceKind[] = ['boost', 'hazard', 'ramp'];

interface TrackCrafterState {
  timeLeft: number;
  totalTime: number;
  round: number;
  phase: 'craft' | 'race';
  phaseTimer: number;
  nodes: { x: number; y: number; kind: 'normal' | TrackPieceKind }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    angle: number;
    speed: number;
    nodeIdx: number;
    pickKind: TrackPieceKind;
    placedPiece: boolean;
    alive: boolean;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function buildInitialTrack(): { x: number; y: number; kind: 'normal' | TrackPieceKind }[] {
  const pts: { x: number; y: number; kind: 'normal' | TrackPieceKind }[] = [];
  const count = 12;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 - Math.PI / 2;
    const rx = 400 + (i % 3 === 0 ? 35 : -20);
    const ry = 215 + (i % 2 === 0 ? 22 : -15);
    pts.push({
      x: Math.round(600 + Math.cos(ang) * rx),
      y: Math.round(375 + Math.sin(ang) * ry),
      kind: i === 2 ? 'boost' : i === 7 ? 'ramp' : 'normal',
    });
  }
  return pts;
}

export const trackCrafterGpModule: CompactGameModule<TrackCrafterState, TrackCrafterGpSnapshot> = {
  id: 'track-crafter-gp',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const nodes = buildInitialTrack();
    return {
      timeLeft: totalTime,
      totalTime,
      round: 1,
      phase: 'craft',
      phaseTimer: 4.5,
      nodes,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: nodes[0].x + (i % 3 - 1) * 24,
        y: nodes[0].y + Math.floor(i / 3) * 22,
        angle: 0,
        speed: 0,
        nodeIdx: 1,
        pickKind: PIECE_CYCLE[i % PIECE_CYCLE.length],
        placedPiece: false,
        alive: true,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'CRAFT PHASE: SNAP A BOOST, RAMP, OR MUD TRAP ONTO THE TRACK!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.phaseTimer -= dt;
    const mult = frenzy ? 2 : 1;

    if (state.phase === 'craft') {
      for (const p of state.players) {
        const inp = players.find((x) => x.id === p.id)?.input;
        if (!inp) continue;
        const justB = inp.actionB && !p.prevB;
        const justA = inp.actionA && !p.prevA;
        p.prevA = inp.actionA;
        p.prevB = inp.actionB;
        if (justB && !p.placedPiece) {
          p.pickKind = PIECE_CYCLE[(PIECE_CYCLE.indexOf(p.pickKind) + 1) % PIECE_CYCLE.length];
          sounds.push({ type: 'tick', playerId: p.id });
        }
        if (justA && !p.placedPiece) {
          p.placedPiece = true;
          const targetIdx = (p.nodeIdx + 1 + p.slotIndex) % state.nodes.length;
          state.nodes[targetIdx].kind = p.pickKind;
          p.score += 20 * mult;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
      if (state.phaseTimer <= 0 || state.players.every((p) => p.placedPiece)) {
        state.phase = 'race';
        state.phaseTimer = 11.5;
        state.banner = `GP LEG ${state.round}: FLOOR IT THROUGH CHECKPOINTS!`;
        sounds.push({ type: 'dash' });
      }
    } else {
      for (const p of state.players) {
        p.cdA = Math.max(0, p.cdA - dt);
        p.cdB = Math.max(0, p.cdB - dt);
        const inp = players.find((x) => x.id === p.id)?.input;
        const mx = inp?.moveX ?? 0;
        const my = inp?.moveY ?? 0;
        const aDown = Boolean(inp?.actionA);
        const bDown = Boolean(inp?.actionB);
        if (inp) {
          p.prevA = aDown;
          p.prevB = bDown;
        }

        const mag = Math.hypot(mx, my);
        if (mag > 0.16) {
          const targetAng = Math.atan2(my, mx);
          let diff = targetAng - p.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          p.angle += diff * Math.min(1, dt * (bDown ? 11 : 7.5));
        }

        const boost = aDown && p.cdA <= 0 ? 1.45 : 1;
        if (aDown && p.cdA <= 0) p.cdA = 0.25;
        const nodeHere = state.nodes[p.nodeIdx];
        const onNode = nodeHere && Math.hypot(p.x - nodeHere.x, p.y - nodeHere.y) < 55;
        const surfFactor = onNode && nodeHere.kind === 'hazard' ? 0.58 : onNode && nodeHere.kind === 'boost' ? 1.45 : 1;
        const targetSpd = (mag > 0.15 ? 250 : 120) * boost * surfFactor * (frenzy ? 1.15 : 1);
        p.speed += (targetSpd - p.speed) * Math.min(1, dt * 6);
        p.x = clamp(p.x + Math.cos(p.angle) * p.speed * dt, 70, ARENA_WIDTH - 70);
        p.y = clamp(p.y + Math.sin(p.angle) * p.speed * dt, 90, ARENA_HEIGHT - 70);

        if (nodeHere && Math.hypot(p.x - nodeHere.x, p.y - nodeHere.y) < 56) {
          const bonus = nodeHere.kind === 'ramp' ? 65 : nodeHere.kind === 'boost' ? 50 : 40;
          p.score += bonus * mult;
          p.nodeIdx = (p.nodeIdx + 1) % state.nodes.length;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
      if (state.phaseTimer <= 0) {
        state.round += 1;
        state.phase = 'craft';
        state.phaseTimer = 4.2;
        state.banner = `LEG ${state.round}: ADD A NEW TRACK MODIFIER!`;
        state.players.forEach((p) => {
          p.placedPiece = false;
        });
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'track-crafter-gp',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      phase: state.phase,
      phaseTimer: state.phaseTimer,
      nodes: state.nodes,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        angle: p.angle,
        speed: p.speed,
        nodeIdx: p.nodeIdx,
        pickKind: p.pickKind,
        placedPiece: p.placedPiece,
        alive: p.alive,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.3, 0, 1),
        cooldownB: clamp(p.cdB / 0.4, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} GP pts`);
  },
};

// ============================================================================
// 3. SLINGSHOT FORTRESS (Angry Birds style)
// ============================================================================
interface SlingshotState {
  timeLeft: number;
  totalTime: number;
  wave: number;
  blocks: { id: string; x: number; y: number; w: number; h: number; hp: number; maxHp: number; mat: 'wood' | 'stone' | 'tnt' }[];
  targets: { id: string; x: number; y: number; r: number; hp: number; gold: boolean }[];
  projectiles: { id: string; x: number; y: number; vx: number; vy: number; ownerId: string; colorHex: string; cluster: boolean; splitDone: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    aimAngle: number;
    power: number;
    ammoMode: 'heavy' | 'cluster';
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function buildFortressWave(wave: number) {
  const blocks: SlingshotState['blocks'] = [];
  const targets: SlingshotState['targets'] = [];
  const baseX = 760;
  const cols = 3;
  for (let c = 0; c < cols; c++) {
    const cx = baseX + c * 115;
    blocks.push({ id: `b_${wave}_l_${c}`, x: cx - 32, y: 540, w: 22, h: 110, hp: 3, maxHp: 3, mat: c === 1 ? 'stone' : 'wood' });
    blocks.push({ id: `b_${wave}_r_${c}`, x: cx + 32, y: 540, w: 22, h: 110, hp: 3, maxHp: 3, mat: c === 1 ? 'stone' : 'wood' });
    blocks.push({ id: `b_${wave}_t_${c}`, x: cx, y: 472, w: 96, h: 22, hp: 2, maxHp: 2, mat: c === 1 ? 'tnt' : 'wood' });
    targets.push({ id: `tg_${wave}_${c}`, x: cx, y: 560, r: 21, hp: 2, gold: c === 1 });
    if (c === 1) {
      blocks.push({ id: `b_${wave}_u1`, x: cx - 26, y: 408, w: 20, h: 92, hp: 2, maxHp: 2, mat: 'wood' });
      blocks.push({ id: `b_${wave}_u2`, x: cx + 26, y: 408, w: 20, h: 92, hp: 2, maxHp: 2, mat: 'wood' });
      blocks.push({ id: `b_${wave}_ut`, x: cx, y: 350, w: 84, h: 20, hp: 2, maxHp: 2, mat: 'stone' });
      targets.push({ id: `tg_${wave}_top`, x: cx, y: 425, r: 22, hp: 2, gold: true });
    }
  }
  return { blocks, targets };
}

export const slingshotFortressModule: CompactGameModule<SlingshotState, SlingshotFortressSnapshot> = {
  id: 'slingshot-fortress',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const { blocks, targets } = buildFortressWave(1);
    return {
      timeLeft: totalTime,
      totalTime,
      wave: 1,
      blocks,
      targets,
      projectiles: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 155 + (i % 2) * 42,
        y: 520 - Math.floor(i / 2) * 58,
        aimAngle: -0.45,
        power: 0.72,
        ammoMode: 'heavy',
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'AIM YOUR SLINGSHOT & DEMOLISH THE FORTRESS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (!inp) continue;
      const justA = inp.actionA && !p.prevA;
      const justB = inp.actionB && !p.prevB;
      p.prevA = inp.actionA;
      p.prevB = inp.actionB;

      if (Math.abs(inp.moveX) > 0.08 || Math.abs(inp.moveY) > 0.08) {
        p.aimAngle = clamp(p.aimAngle + inp.moveY * dt * 1.45, -1.25, 0.25);
        p.power = clamp(p.power + inp.moveX * dt * 0.75, 0.35, 1.0);
      }
      if (justB && p.cdB <= 0) {
        p.ammoMode = p.ammoMode === 'heavy' ? 'cluster' : 'heavy';
        p.cdB = 0.25;
        sounds.push({ type: 'tick', playerId: p.id });
      }
      if (justA && p.cdA <= 0) {
        const spd = 460 + p.power * 470;
        state.projectiles.push({
          id: `pr_${Date.now()}_${p.slotIndex}_${Math.random()}`,
          x: p.x + 18,
          y: p.y - 10,
          vx: Math.cos(p.aimAngle) * spd,
          vy: Math.sin(p.aimAngle) * spd,
          ownerId: p.id,
          colorHex: p.colorHex,
          cluster: p.ammoMode === 'cluster',
          splitDone: false,
        });
        p.cdA = frenzy ? 0.55 : 0.95;
        sounds.push({ type: 'dash', playerId: p.id });
      }
    }

    const spawned: SlingshotState['projectiles'] = [];
    for (const pr of state.projectiles) {
      pr.vy += 680 * dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      if (pr.cluster && !pr.splitDone && pr.x > 460) {
        pr.splitDone = true;
        spawned.push(
          { ...pr, id: `${pr.id}_u`, vy: pr.vy - 110, cluster: false, splitDone: true },
          { ...pr, id: `${pr.id}_d`, vy: pr.vy + 110, cluster: false, splitDone: true }
        );
      }

      // Hit blocks
      for (let i = state.blocks.length - 1; i >= 0; i--) {
        const b = state.blocks[i];
        if (Math.abs(pr.x - b.x) <= b.w / 2 + 12 && Math.abs(pr.y - b.y) <= b.h / 2 + 12) {
          b.hp -= pr.cluster ? 1 : 2;
          pr.vx *= 0.65;
          pr.vy *= 0.65;
          const owner = state.players.find((o) => o.id === pr.ownerId);
          if (b.hp <= 0) {
            state.blocks.splice(i, 1);
            if (owner) owner.score += (b.mat === 'tnt' ? 95 : 40) * mult;
            if (b.mat === 'tnt') {
              // Explosion damages nearby blocks & targets
              for (const nb of state.blocks) {
                if (Math.hypot(nb.x - b.x, nb.y - b.y) < 130) nb.hp -= 3;
              }
              for (const nt of state.targets) {
                if (Math.hypot(nt.x - b.x, nt.y - b.y) < 135) nt.hp -= 3;
              }
            }
          }
          sounds.push({ type: 'hit' });
          break;
        }
      }

      // Hit targets
      for (let i = state.targets.length - 1; i >= 0; i--) {
        const tg = state.targets[i];
        if (Math.hypot(pr.x - tg.x, pr.y - tg.y) <= tg.r + 13) {
          tg.hp -= 2;
          const owner = state.players.find((o) => o.id === pr.ownerId);
          if (tg.hp <= 0) {
            state.targets.splice(i, 1);
            if (owner) owner.score += (tg.gold ? 160 : 100) * mult;
            sounds.push({ type: 'score', playerId: pr.ownerId });
          }
        }
      }
    }
    state.blocks = state.blocks.filter((b) => b.hp > 0);
    state.targets = state.targets.filter((tg) => tg.hp > 0);
    state.projectiles.push(...spawned);
    state.projectiles = state.projectiles.filter((pr) => pr.x < ARENA_WIDTH + 40 && pr.y < 630);

    if (state.targets.length === 0) {
      state.wave += 1;
      const next = buildFortressWave(state.wave);
      state.blocks = next.blocks;
      state.targets = next.targets;
      state.banner = `FORTRESS CRUSHED! WAVE ${state.wave} UP!`;
      sounds.push({ type: 'win' });
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'slingshot-fortress',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      wave: state.wave,
      blocks: state.blocks,
      targets: state.targets,
      projectiles: state.projectiles.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        colorHex: p.colorHex,
        cluster: p.cluster,
      })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        aimAngle: p.aimAngle,
        power: p.power,
        ammoMode: p.ammoMode,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.95, 0, 1),
        cooldownB: clamp(p.cdB / 0.3, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} siege pts`);
  },
};

// ============================================================================
// 4. ROPE SLICE PHYSICS (Cut the Rope style)
// ============================================================================
interface RopeEntry {
  id: string;
  ax: number;
  ay: number;
  len: number;
  ang: number;
  angVel: number;
  orbX: number;
  orbY: number;
  vx: number;
  vy: number;
  cut: boolean;
  slicedBy: string | null;
  kind: 'candy' | 'gold' | 'bomb';
}

interface RopeSliceState {
  timeLeft: number;
  totalTime: number;
  ropes: RopeEntry[];
  buckets: { id: string; x: number; y: number; w: number; dir: number; ownerId: string | null; colorHex: string }[];
  spawnTimer: number;
  seq: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    gustTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function makeRope(seq: number): RopeEntry {
  const ax = 180 + Math.random() * 840;
  const ay = 105;
  const len = 145 + Math.random() * 95;
  const ang = (Math.random() - 0.5) * 1.1;
  const r = Math.random();
  const kind: RopeEntry['kind'] = r < 0.18 ? 'bomb' : r < 0.45 ? 'gold' : 'candy';
  return {
    id: `rp_${seq}`,
    ax,
    ay,
    len,
    ang,
    angVel: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.2),
    orbX: ax + Math.sin(ang) * len,
    orbY: ay + Math.cos(ang) * len,
    vx: 0,
    vy: 0,
    cut: false,
    slicedBy: null,
    kind,
  };
}

export const ropeSlicePhysicsModule: CompactGameModule<RopeSliceState, RopeSlicePhysicsSnapshot> = {
  id: 'rope-slice-physics',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const ropes = Array.from({ length: 6 }, (_, i) => makeRope(i + 1));
    const buckets = [
      { id: 'bk1', x: 320, y: 610, w: 155, dir: 1, ownerId: null, colorHex: '#10D98B' },
      { id: 'bk2', x: 600, y: 610, w: 155, dir: -1, ownerId: null, colorHex: '#FFB800' },
      { id: 'bk3', x: 880, y: 610, w: 155, dir: 1, ownerId: null, colorHex: '#00C2FF' },
    ];
    return {
      timeLeft: totalTime,
      totalTime,
      ropes,
      buckets,
      spawnTimer: 1.5,
      seq: 10,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 240 + i * 110,
        y: 260,
        gustTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'SLICE ROPES (A) SO SWEETS DROP INTO MOVING BASKETS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    // Move collector baskets
    for (const bk of state.buckets) {
      bk.x += bk.dir * (frenzy ? 170 : 125) * dt;
      if (bk.x < 170) { bk.x = 170; bk.dir = 1; }
      if (bk.x > ARENA_WIDTH - 170) { bk.x = ARENA_WIDTH - 170; bk.dir = -1; }
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.gustTimer = Math.max(0, p.gustTimer - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (!inp) continue;
      p.x = clamp(p.x + inp.moveX * 560 * dt, 100, ARENA_WIDTH - 100);
      p.y = clamp(p.y + inp.moveY * 460 * dt, 110, 520);
      const justA = inp.actionA && !p.prevA;
      const justB = inp.actionB && !p.prevB;
      p.prevA = inp.actionA;
      p.prevB = inp.actionB;

      // Slicing via A or sweeping swiftly across rope midpoint
      const fastSweep = Math.hypot(inp.moveX, inp.moveY) > 0.72;
      if ((justA || fastSweep) && p.cdA <= 0) {
        for (const r of state.ropes) {
          if (r.cut) continue;
          const midX = (r.ax + r.orbX) / 2;
          const midY = (r.ay + r.orbY) / 2;
          if (Math.hypot(p.x - midX, p.y - midY) < 58) {
            r.cut = true;
            r.slicedBy = p.id;
            r.vx = r.angVel * r.len * Math.cos(r.ang) * 0.65;
            r.vy = 40;
            p.cdA = 0.16;
            sounds.push({ type: 'dash', playerId: p.id });
            break;
          }
        }
      }

      if (justB && p.cdB <= 0) {
        p.gustTimer = 0.4;
        p.cdB = 1.2;
        for (const r of state.ropes) {
          const d = Math.hypot(r.orbX - p.x, r.orbY - p.y);
          if (d < 220) {
            const push = (r.orbX >= p.x ? 1 : -1) * 190;
            if (!r.cut) r.angVel += push / 140;
            else r.vx += push;
          }
        }
        sounds.push({ type: 'tick', playerId: p.id });
      }
    }

    for (let i = state.ropes.length - 1; i >= 0; i--) {
      const r = state.ropes[i];
      if (!r.cut) {
        r.angVel += -Math.sin(r.ang) * 5.2 * dt;
        r.ang += r.angVel * dt;
        r.orbX = r.ax + Math.sin(r.ang) * r.len;
        r.orbY = r.ay + Math.cos(r.ang) * r.len;
      } else {
        r.vy += 680 * dt;
        r.orbX += r.vx * dt;
        r.orbY += r.vy * dt;
        const caught = state.buckets.find((bk) => Math.abs(r.orbX - bk.x) < bk.w / 2 && Math.abs(r.orbY - bk.y) < 34);
        if (caught) {
          const owner = state.players.find((o) => o.id === r.slicedBy);
          if (owner) {
            if (r.kind === 'bomb') {
              owner.score = Math.max(0, owner.score - 65);
              sounds.push({ type: 'elim', playerId: owner.id });
            } else {
              owner.score += (r.kind === 'gold' ? 140 : 85) * mult;
              sounds.push({ type: 'score', playerId: owner.id });
            }
          }
          state.ropes.splice(i, 1);
          continue;
        }
        if (r.orbY > ARENA_HEIGHT) state.ropes.splice(i, 1);
      }
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 || state.ropes.length < 4) {
      state.spawnTimer = frenzy ? 1.1 : 1.6;
      if (state.ropes.length < 8) {
        state.seq += 1;
        state.ropes.push(makeRope(state.seq));
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'rope-slice-physics',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      ropes: state.ropes.map((r) => ({
        id: r.id,
        ax: r.ax,
        ay: r.ay,
        orbX: r.orbX,
        orbY: r.orbY,
        cut: r.cut,
        kind: r.kind,
      })),
      buckets: state.buckets.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, ownerId: b.ownerId, colorHex: b.colorHex })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        gustTimer: p.gustTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.25, 0, 1),
        cooldownB: clamp(p.cdB / 1.2, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} slice pts`);
  },
};

// ============================================================================
// 5. WOBBLY TIMBER PULL (Jenga style)
// ============================================================================
interface WobblyState {
  timeLeft: number;
  totalTime: number;
  tiltAngle: number;
  tiltVel: number;
  collapseCount: number;
  rows: { row: number; blocks: [boolean, boolean, boolean]; stress: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorRow: number;
    cursorCol: number;
    pullProgress: number;
    combo: number;
    score: number;
    cdA: number;
    cdB: number;
    moveCooldown: number;
    prevB: boolean;
  }[];
  banner: string | null;
}

function buildJengaRows() {
  return Array.from({ length: 8 }, (_, r) => ({
    row: r,
    blocks: [true, true, true] as [boolean, boolean, boolean],
    stress: 0,
  }));
}

export const wobblyTimberPullModule: CompactGameModule<WobblyState, WobblyTimberPullSnapshot> = {
  id: 'wobbly-timber-pull',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      tiltAngle: 0,
      tiltVel: 0,
      collapseCount: 0,
      rows: buildJengaRows(),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorRow: 2 + (i % 4),
        cursorCol: 1,
        pullProgress: 0,
        combo: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        moveCooldown: 0,
        prevB: false,
      })),
      banner: 'SLIDE LOOSE TIMBERS OUT (HOLD A) WITHOUT TIPPING THE TOWER!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    // Torque from missing side blocks
    let imbalance = 0;
    for (const r of state.rows) {
      const weightAbove = (state.rows.length - r.row) * 0.14;
      if (!r.blocks[0] && r.blocks[2]) imbalance -= weightAbove;
      if (!r.blocks[2] && r.blocks[0]) imbalance += weightAbove;
      const present = (r.blocks[0] ? 1 : 0) + (r.blocks[1] ? 1 : 0) + (r.blocks[2] ? 1 : 0);
      r.stress = present === 1 ? 0.9 : present === 2 ? 0.45 : 0.1;
    }

    state.tiltVel += (imbalance * 0.42 - state.tiltAngle * 1.1) * dt;
    state.tiltVel *= Math.pow(0.84, dt * 10);
    state.tiltAngle += state.tiltVel * dt;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.moveCooldown = Math.max(0, p.moveCooldown - dt);
      const inp = players.find((x) => x.id === p.id)?.input;
      if (!inp) continue;
      const justB = inp.actionB && !p.prevB;
      p.prevB = inp.actionB;

      if (p.moveCooldown <= 0 && (Math.abs(inp.moveX) > 0.35 || Math.abs(inp.moveY) > 0.35)) {
        if (Math.abs(inp.moveX) > Math.abs(inp.moveY)) {
          p.cursorCol = clamp(p.cursorCol + Math.sign(inp.moveX), 0, 2);
        } else {
          p.cursorRow = clamp(p.cursorRow - Math.sign(inp.moveY), 0, state.rows.length - 2);
        }
        p.pullProgress = 0;
        p.moveCooldown = 0.16;
      }

      if (justB && p.cdB <= 0) {
        state.tiltAngle *= 0.45;
        state.tiltVel *= 0.3;
        p.cdB = 2.0;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      const rowObj = state.rows[p.cursorRow];
      if (inp.actionA && p.cdA <= 0 && rowObj && rowObj.blocks[p.cursorCol]) {
        p.pullProgress += dt * (frenzy ? 2.1 : 1.55);
        state.tiltVel += (p.cursorCol - 1) * 0.28 * dt;
        if (p.pullProgress >= 1) {
          p.pullProgress = 0;
          rowObj.blocks[p.cursorCol] = false;
          const remain = (rowObj.blocks[0] ? 1 : 0) + (rowObj.blocks[1] ? 1 : 0) + (rowObj.blocks[2] ? 1 : 0);
          // Check collapse: empty row OR only outer single block on high imbalance
          if (remain === 0 || (remain === 1 && !rowObj.blocks[1] && Math.abs(state.tiltAngle) > 0.14)) {
            state.collapseCount += 1;
            p.combo = 0;
            p.score = Math.max(0, p.score - 90);
            state.rows = buildJengaRows();
            state.tiltAngle = 0;
            state.tiltVel = 0;
            state.banner = `${p.name} TOPPLED THE TOWER! (-90 PTS)`;
            sounds.push({ type: 'elim', playerId: p.id });
          } else {
            p.combo += 1;
            p.score += (85 + Math.min(60, p.combo * 15)) * mult;
            state.rows.push({ row: state.rows.length, blocks: [true, false, false], stress: 0.2 });
            if (state.rows.length > 11) {
              state.rows = buildJengaRows();
              state.tiltAngle = 0;
            }
            p.cdA = 0.35;
            sounds.push({ type: 'score', playerId: p.id });
          }
        }
      } else if (!inp.actionA) {
        p.pullProgress = Math.max(0, p.pullProgress - dt * 2.5);
      }
    }

    if (Math.abs(state.tiltAngle) > 0.32) {
      state.collapseCount += 1;
      state.rows = buildJengaRows();
      state.tiltAngle = 0;
      state.tiltVel = 0;
      state.banner = 'TIMBER!! FRESH TOWER STACKED!';
      sounds.push({ type: 'elim' });
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'wobbly-timber-pull',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      tiltAngle: state.tiltAngle,
      collapseCount: state.collapseCount,
      rows: state.rows,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorRow: p.cursorRow,
        cursorCol: p.cursorCol,
        pullProgress: p.pullProgress,
        combo: p.combo,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.4, 0, 1),
        cooldownB: clamp(p.cdB / 2.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} stack pts`);
  },
};

// ============================================================================
// 6. ARTILLERY CRATER WAR (Worms / Scorched Earth style)
// ============================================================================
interface ArtilleryState {
  timeLeft: number;
  totalTime: number;
  wind: number;
  windTimer: number;
  terrain: number[];
  shells: { id: string; x: number; y: number; vx: number; vy: number; ownerId: string; colorHex: string; big: boolean }[];
  craters: { x: number; y: number; r: number; age: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vy: number;
    aimAngle: number;
    power: number;
    hp: number;
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

function buildTerrain(): number[] {
  return Array.from({ length: 61 }, (_, i) => {
    const x = i * 20;
    return Math.round(470 - Math.sin(x * 0.008) * 65 - Math.cos(x * 0.017) * 35);
  });
}

function terrainYAt(terrain: number[], x: number): number {
  const idx = clamp(Math.floor(x / 20), 0, terrain.length - 2);
  const t = clamp((x - idx * 20) / 20, 0, 1);
  return terrain[idx] * (1 - t) + terrain[idx + 1] * t;
}

export const artilleryCraterWarModule: CompactGameModule<ArtilleryState, ArtilleryCraterWarSnapshot> = {
  id: 'artillery-crater-war',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const terrain = buildTerrain();
    return {
      timeLeft: totalTime,
      totalTime,
      wind: (Math.random() - 0.5) * 180,
      windTimer: 7,
      terrain,
      shells: [],
      craters: [],
      players: players.map((p, i) => {
        const px = 140 + ((i + 0.5) / Math.max(1, players.length)) * 920;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          x: px,
          y: terrainYAt(terrain, px) - 18,
          vy: 0,
          aimAngle: px < 600 ? -0.75 : -Math.PI + 0.75,
          power: 0.72,
          hp: 100,
          alive: true,
          respawnTimer: 0,
          score: 0,
          cdA: 0,
          cdB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      banner: 'BLAST REAL CRATERS UNDER RIVALS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    state.windTimer -= dt;
    if (state.windTimer <= 0) {
      state.windTimer = 7.5;
      state.wind = (Math.random() - 0.5) * 210;
    }

    for (const c of state.craters) c.age += dt;
    state.craters = state.craters.filter((c) => c.age < 0.7);

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.hp = 100;
          p.x = 180 + Math.random() * 840;
          p.y = terrainYAt(state.terrain, p.x) - 22;
          p.vy = 0;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      if (!inp) continue;
      const justA = inp.actionA && !p.prevA;
      const justB = inp.actionB && !p.prevB;
      p.prevA = inp.actionA;
      p.prevB = inp.actionB;

      if (Math.abs(inp.moveX) > 0.1 || Math.abs(inp.moveY) > 0.1) {
        p.aimAngle = clamp(p.aimAngle + inp.moveY * dt * 1.9, -Math.PI + 0.15, -0.15);
        p.x = clamp(p.x + inp.moveX * 145 * dt, 70, ARENA_WIDTH - 70);
      }
      if (justB && p.cdB <= 0) {
        p.vy = -380;
        p.cdB = 2.0;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (justA && p.cdA <= 0) {
        const spd = 480 + p.power * 340;
        state.shells.push({
          id: `sh_${Date.now()}_${p.slotIndex}_${Math.random()}`,
          x: p.x + Math.cos(p.aimAngle) * 24,
          y: p.y + Math.sin(p.aimAngle) * 24,
          vx: Math.cos(p.aimAngle) * spd,
          vy: Math.sin(p.aimAngle) * spd,
          ownerId: p.id,
          colorHex: p.colorHex,
          big: frenzy,
        });
        p.cdA = frenzy ? 0.65 : 1.05;
        sounds.push({ type: 'dash', playerId: p.id });
      }

      p.vy += 680 * dt;
      p.y += p.vy * dt;
      const floorY = terrainYAt(state.terrain, p.x) - 16;
      if (p.y >= floorY && floorY < 630) {
        p.y = floorY;
        p.vy = 0;
      }
      if (p.y > 650) {
        p.alive = false;
        p.respawnTimer = 2.5;
        sounds.push({ type: 'elim', playerId: p.id });
      }
    }

    for (let i = state.shells.length - 1; i >= 0; i--) {
      const sh = state.shells[i];
      sh.vx += state.wind * 0.35 * dt;
      sh.vy += 560 * dt;
      sh.x += sh.vx * dt;
      sh.y += sh.vy * dt;

      const hitGround = sh.y >= terrainYAt(state.terrain, sh.x);
      const hitEnemy = state.players.find(
        (pl) => pl.alive && pl.id !== sh.ownerId && Math.hypot(pl.x - sh.x, pl.y - sh.y) < 26
      );
      if (hitGround || hitEnemy || sh.x < 0 || sh.x > ARENA_WIDTH) {
        if (sh.x >= 0 && sh.x <= ARENA_WIDTH) {
          const rad = sh.big ? 62 : 48;
          state.craters.push({ x: sh.x, y: sh.y, r: rad, age: 0 });
          for (let k = 0; k < state.terrain.length; k++) {
            const tx = k * 20;
            const d = Math.abs(tx - sh.x);
            if (d < rad) {
              const depth = Math.sqrt(rad * rad - d * d) * 0.85;
              state.terrain[k] = Math.min(648, Math.max(state.terrain[k], sh.y + depth));
            }
          }
          const owner = state.players.find((o) => o.id === sh.ownerId);
          for (const pl of state.players) {
            if (!pl.alive) continue;
            const dist = Math.hypot(pl.x - sh.x, pl.y - sh.y);
            if (dist < rad + 28 && pl.id !== sh.ownerId) {
              const dmg = Math.round(45 * (1 - dist / (rad + 38)));
              pl.hp -= dmg;
              pl.vy = -240;
              if (owner) owner.score += 110 * mult;
              if (pl.hp <= 0) {
                pl.alive = false;
                pl.respawnTimer = 2.5;
                if (owner) owner.score += 90 * mult;
                sounds.push({ type: 'elim', playerId: pl.id });
              }
            }
          }
          sounds.push({ type: 'hit' });
        }
        state.shells.splice(i, 1);
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'artillery-crater-war',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      wind: state.wind,
      terrain: state.terrain,
      shells: state.shells.map((s) => ({
        id: s.id,
        x: s.x,
        y: s.y,
        vx: s.vx,
        vy: s.vy,
        colorHex: s.colorHex,
        big: s.big,
      })),
      craters: state.craters,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        aimAngle: p.aimAngle,
        power: p.power,
        hp: p.hp,
        alive: p.alive,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.05, 0, 1),
        cooldownB: clamp(p.cdB / 2.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} war pts`);
  },
};

// ============================================================================
// 7. BRIDGE LOAD STRESS (Poly Bridge style)
// ============================================================================
interface BridgeState {
  timeLeft: number;
  totalTime: number;
  phase: 'build' | 'test';
  phaseTimer: number;
  truckX: number;
  truckY: number;
  truckOk: boolean;
  anchors: { id: number; x: number; y: number }[];
  beams: { a: number; b: number; mat: 'wood' | 'steel'; stress: number; broken: boolean; ownerId: string; ownerColor: string }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    cursorIdx: number;
    selectedFrom: number | null;
    mat: 'wood' | 'steel';
    score: number;
    cdA: number;
    cdB: number;
    moveCooldown: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function buildBridgeAnchors(): { id: number; x: number; y: number }[] {
  const anchors: { id: number; x: number; y: number }[] = [];
  const xs = [230, 415, 600, 785, 970];
  const ys = [430, 295];
  let id = 0;
  for (const y of ys) {
    for (const x of xs) {
      anchors.push({ id: id++, x, y });
    }
  }
  return anchors;
}

export const bridgeLoadStressModule: CompactGameModule<BridgeState, BridgeLoadStressSnapshot> = {
  id: 'bridge-load-stress',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      phase: 'build',
      phaseTimer: 8.5,
      truckX: 160,
      truckY: 412,
      truckOk: true,
      anchors: buildBridgeAnchors(),
      beams: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorIdx: i % 5,
        selectedFrom: null,
        mat: 'wood',
        score: 0,
        cdA: 0,
        cdB: 0,
        moveCooldown: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'LINK ANCHOR PINS (A) TO SPAN THE CANYON!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.phaseTimer -= dt;
    const mult = frenzy ? 2 : 1;

    if (state.phase === 'build') {
      for (const p of state.players) {
        p.cdA = Math.max(0, p.cdA - dt);
        p.cdB = Math.max(0, p.cdB - dt);
        p.moveCooldown = Math.max(0, p.moveCooldown - dt);
        const inp = players.find((x) => x.id === p.id)?.input;
        if (!inp) continue;
        const justA = inp.actionA && !p.prevA;
        const justB = inp.actionB && !p.prevB;
        p.prevA = inp.actionA;
        p.prevB = inp.actionB;

        if (p.moveCooldown <= 0 && (Math.abs(inp.moveX) > 0.35 || Math.abs(inp.moveY) > 0.35)) {
          const row = Math.floor(p.cursorIdx / 5);
          const col = p.cursorIdx % 5;
          const nCol = clamp(col + (Math.abs(inp.moveX) > 0.35 ? Math.sign(inp.moveX) : 0), 0, 4);
          const nRow = clamp(row + (Math.abs(inp.moveY) > 0.35 ? Math.sign(inp.moveY) : 0), 0, 1);
          p.cursorIdx = nRow * 5 + nCol;
          p.moveCooldown = 0.16;
        }
        if (justB && p.cdB <= 0) {
          p.mat = p.mat === 'wood' ? 'steel' : 'wood';
          p.cdB = 0.2;
          sounds.push({ type: 'tick', playerId: p.id });
        }
        if (justA && p.cdA <= 0) {
          if (p.selectedFrom === null) {
            p.selectedFrom = p.cursorIdx;
            sounds.push({ type: 'tick', playerId: p.id });
          } else if (p.selectedFrom !== p.cursorIdx) {
            const a = Math.min(p.selectedFrom, p.cursorIdx);
            const b = Math.max(p.selectedFrom, p.cursorIdx);
            const exists = state.beams.some((bm) => bm.a === a && bm.b === b && !bm.broken);
            const pa = state.anchors[a];
            const pb = state.anchors[b];
            if (!exists && pa && pb && Math.hypot(pa.x - pb.x, pa.y - pb.y) < 260) {
              state.beams.push({
                a,
                b,
                mat: p.mat,
                stress: 0,
                broken: false,
                ownerId: p.id,
                ownerColor: p.colorHex,
              });
              p.score += (p.mat === 'steel' ? 40 : 25) * mult;
              p.cdA = p.mat === 'steel' && !frenzy ? 0.65 : 0.3;
              sounds.push({ type: 'score', playerId: p.id });
            }
            p.selectedFrom = null;
          } else {
            p.selectedFrom = null;
          }
        }
      }
      if (state.phaseTimer <= 0) {
        state.phase = 'test';
        state.phaseTimer = 6.5;
        state.truckX = 160;
        state.truckY = 412;
        state.truckOk = true;
        state.banner = 'CONVOY STRESS TEST! HOLD STRONG!';
        sounds.push({ type: 'dash' });
      }
    } else {
      if (state.truckOk) {
        state.truckX += 165 * dt;
        // Check support beams near truckX on bottom deck (anchors 0..4)
        if (state.truckX > 240 && state.truckX < 960) {
          const nearby = state.beams.filter((bm) => {
            if (bm.broken) return false;
            const pa = state.anchors[bm.a];
            const pb = state.anchors[bm.b];
            const minX = Math.min(pa.x, pb.x) - 20;
            const maxX = Math.max(pa.x, pb.x) + 20;
            return state.truckX >= minX && state.truckX <= maxX;
          });
          if (nearby.length === 0) {
            state.truckOk = false;
            state.banner = 'BRIDGE GAP COLLAPSED!!';
            sounds.push({ type: 'elim' });
          } else {
            const load = 1.0 / nearby.length;
            for (const bm of nearby) {
              bm.stress = clamp(bm.stress + load * (bm.mat === 'steel' ? 0.45 : 0.85) * dt, 0, 1.2);
              if (bm.stress >= 1.0) {
                bm.broken = true;
                sounds.push({ type: 'hit' });
              }
            }
          }
        }
        if (state.truckX >= 1030 && state.truckOk) {
          state.truckOk = false;
          for (const bm of state.beams) {
            if (!bm.broken) {
              const owner = state.players.find((o) => o.id === bm.ownerId);
              if (owner) owner.score += (bm.mat === 'steel' ? 115 : 85) * mult;
            }
          }
          state.banner = 'CONVOY CROSSED SAFELY! HUGE SPAN BONUS!';
          sounds.push({ type: 'win' });
        }
      } else {
        state.truckY += 320 * dt;
      }

      if (state.phaseTimer <= 0) {
        state.phase = 'build';
        state.phaseTimer = 8.0;
        state.beams = state.beams.filter((b) => !b.broken).slice(-14);
        state.beams.forEach((b) => { b.stress = 0; });
        state.banner = 'NEXT BUILD WAVE: REINFORCE WEAK TRUSSES!';
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'bridge-load-stress',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      phase: state.phase,
      phaseTimer: state.phaseTimer,
      truckX: state.truckX,
      truckY: state.truckY,
      truckOk: state.truckOk,
      anchors: state.anchors,
      beams: state.beams.map((b) => ({
        a: b.a,
        b: b.b,
        mat: b.mat,
        stress: b.stress,
        broken: b.broken,
        ownerColor: b.ownerColor,
      })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorIdx: p.cursorIdx,
        selectedFrom: p.selectedFrom,
        mat: p.mat,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.65, 0, 1),
        cooldownB: clamp(p.cdB / 0.25, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} bridge pts`);
  },
};

// ============================================================================
// 8. HILL TORQUE CLIMB (Hill Climb Racing style)
// ============================================================================
interface HillClimbState {
  timeLeft: number;
  totalTime: number;
  cameraX: number;
  coins: { id: string; x: number; y: number; gold: boolean; takenBy: Set<string> }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    airSpinAcc: number;
    distMeters: number;
    flips: number;
    stunTimer: number;
    score: number;
    cdA: number;
    cdB: number;
  }[];
  banner: string | null;
}

function hillHeightAt(wx: number): number {
  return (
    495 -
    Math.sin(wx * 0.0052) * 85 -
    Math.cos(wx * 0.013) * 42 -
    Math.sin(wx * 0.025) * 18
  );
}

export const hillTorqueClimbModule: CompactGameModule<HillClimbState, HillTorqueClimbSnapshot> = {
  id: 'hill-torque-climb',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const coins: HillClimbState['coins'] = [];
    for (let i = 1; i <= 48; i++) {
      const cx = i * 260 + 180;
      coins.push({
        id: `hc_${i}`,
        x: cx,
        y: hillHeightAt(cx) - (i % 4 === 0 ? 95 : 42),
        gold: i % 4 === 0,
        takenBy: new Set(),
      });
    }
    return {
      timeLeft: totalTime,
      totalTime,
      cameraX: 0,
      coins,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 160 + i * 18,
        y: hillHeightAt(160) - 24,
        vx: 0,
        vy: 0,
        angle: 0,
        airSpinAcc: 0,
        distMeters: 0,
        flips: 0,
        stunTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
      })),
      banner: 'HOLD GAS (A) TO CLIMB HILLS & NAIL MID-AIR FLIPS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    let leadX = 0;
    for (const p of state.players) {
      if (p.stunTimer > 0) {
        p.stunTimer = Math.max(0, p.stunTimer - dt);
        p.vx *= 0.9;
        p.angle = 0;
        continue;
      }
      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const gas = Boolean(inp?.actionA);
      const brake = Boolean(inp?.actionB);

      const groundY = hillHeightAt(p.x) - 20;
      const onGround = p.y >= groundY - 4;

      if (onGround) {
        p.y = groundY;
        const slopeAng = Math.atan2(hillHeightAt(p.x + 12) - hillHeightAt(p.x - 12), 24);
        p.angle += (slopeAng - p.angle) * Math.min(1, dt * 12);
        const drive = (gas ? 390 : 0) - (brake ? 220 : 0);
        p.vx = clamp(p.vx + (drive - Math.sin(slopeAng) * 190) * dt, -140, frenzy ? 520 : 440);
        if (gas && p.vx > 240 && slopeAng < -0.22) {
          p.vy = -190;
        } else {
          p.vy = 0;
        }
        p.airSpinAcc = 0;
      } else {
        p.vy += 680 * dt;
        const spin = mx * 5.2 * dt;
        p.angle += spin;
        p.airSpinAcc += Math.abs(spin);
        if (p.airSpinAcc >= Math.PI * 1.85) {
          p.airSpinAcc = 0;
          p.flips += 1;
          p.score += 95 * mult;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Landing check
      const newFloor = hillHeightAt(p.x) - 20;
      if (!onGround && p.y >= newFloor && p.vy > 0) {
        const slopeAng = Math.atan2(hillHeightAt(p.x + 12) - hillHeightAt(p.x - 12), 24);
        let diff = Math.abs(p.angle - slopeAng) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        p.y = newFloor;
        p.vy = 0;
        if (diff > 2.1) {
          p.stunTimer = 1.25;
          p.vx = 0;
          p.angle = slopeAng;
          sounds.push({ type: 'hit', playerId: p.id });
        }
      }

      const meters = Math.max(0, Math.floor((p.x - 160) / 18));
      if (meters > p.distMeters) {
        p.score += (meters - p.distMeters) * 2 * mult;
        p.distMeters = meters;
      }

      for (const c of state.coins) {
        if (!c.takenBy.has(p.id) && Math.hypot(p.x - c.x, p.y - c.y) < 42) {
          c.takenBy.add(p.id);
          p.score += (c.gold ? 80 : 35) * mult;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      if (p.x > leadX) leadX = p.x;
    }

    state.cameraX = Math.max(0, leadX - 420);
    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    const terrainHeights: { x: number; y: number }[] = [];
    for (let sx = -40; sx <= ARENA_WIDTH + 60; sx += 30) {
      const wx = state.cameraX + sx;
      terrainHeights.push({ x: sx, y: hillHeightAt(wx) });
    }
    return {
      gameId: 'hill-torque-climb',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cameraX: state.cameraX,
      terrainHeights,
      coins: state.coins
        .filter((c) => c.x >= state.cameraX - 40 && c.x <= state.cameraX + ARENA_WIDTH + 40)
        .map((c) => ({ id: c.id, x: c.x - state.cameraX, y: c.y, gold: c.gold })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: clamp(p.x - state.cameraX, 60, ARENA_WIDTH - 60),
        y: p.y,
        angle: p.angle,
        distMeters: p.distMeters,
        flips: p.flips,
        stunTimer: p.stunTimer,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.distMeters}m · ${p.flips} flips`);
  },
};

// ============================================================================
// 9. 3-LANE METRO DASH (Subway Surfers style)
// ============================================================================
interface MetroState {
  timeLeft: number;
  totalTime: number;
  speed: number;
  spawnTimer: number;
  seq: number;
  obstacles: { id: string; lane: number; z: number; kind: 'train' | 'highbar' | 'lowbarrier' | 'coin' | 'magnet' }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    lane: number;
    zHeight: number;
    vz: number;
    slideTimer: number;
    magnetTimer: number;
    stunTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    laneCooldown: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

export const threeLaneMetroModule: CompactGameModule<MetroState, ThreeLaneMetroSnapshot> = {
  id: 'three-lane-metro',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    return {
      timeLeft: totalTime,
      totalTime,
      speed: 0.45,
      spawnTimer: 0.4,
      seq: 1,
      obstacles: [
        { id: 'm1', lane: 1, z: 0.85, kind: 'coin' },
        { id: 'm2', lane: 0, z: 0.65, kind: 'lowbarrier' },
        { id: 'm3', lane: 2, z: 0.5, kind: 'train' },
      ],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        lane: i % 3,
        zHeight: 0,
        vz: 0,
        slideTimer: 0,
        magnetTimer: 0,
        stunTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        laneCooldown: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'SWIPE L/R TO CHANGE TRACKS · JUMP (A) · SLIDE (B)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    state.speed = frenzy ? 0.68 : Math.min(0.62, 0.42 + (1 - state.timeLeft / state.totalTime) * 0.22);

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = frenzy ? 0.52 : 0.72;
      const lane = Math.floor(Math.random() * 3);
      const r = Math.random();
      const kind: MetroState['obstacles'][0]['kind'] =
        r < 0.34 ? 'coin' : r < 0.42 ? 'magnet' : r < 0.64 ? 'lowbarrier' : r < 0.84 ? 'highbar' : 'train';
      state.obstacles.push({ id: `mo_${++state.seq}`, lane, z: 1.0, kind });
    }

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      p.laneCooldown = Math.max(0, p.laneCooldown - dt);
      p.slideTimer = Math.max(0, p.slideTimer - dt);
      p.magnetTimer = Math.max(0, p.magnetTimer - dt);
      p.stunTimer = Math.max(0, p.stunTimer - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      if (inp) {
        const justA = inp.actionA && !p.prevA;
        const justB = inp.actionB && !p.prevB;
        p.prevA = inp.actionA;
        p.prevB = inp.actionB;

        if (p.laneCooldown <= 0 && Math.abs(inp.moveX) > 0.45) {
          p.lane = clamp(p.lane + Math.sign(inp.moveX), 0, 2);
          p.laneCooldown = 0.2;
          sounds.push({ type: 'tick', playerId: p.id });
        }
        if ((justA || inp.moveY < -0.55) && p.zHeight <= 1 && p.cdA <= 0) {
          p.vz = 420;
          p.slideTimer = 0;
          p.cdA = 0.4;
          sounds.push({ type: 'dash', playerId: p.id });
        }
        if ((justB || inp.moveY > 0.55) && p.cdB <= 0) {
          p.slideTimer = 0.65;
          p.zHeight = 0;
          p.vz = 0;
          p.cdB = 0.5;
          sounds.push({ type: 'tick', playerId: p.id });
        }
      }

      if (p.zHeight > 0 || p.vz > 0) {
        p.zHeight = Math.max(0, p.zHeight + p.vz * dt);
        p.vz -= 980 * dt;
      }

      if (p.stunTimer <= 0) {
        p.score += 18 * mult * dt;
      }
    }

    for (let i = state.obstacles.length - 1; i >= 0; i--) {
      const ob = state.obstacles[i];
      ob.z -= state.speed * dt;
      if (ob.z <= 0.14 && ob.z >= 0.04) {
        for (const p of state.players) {
          const sameLane = p.lane === ob.lane;
          const magnetPull = (ob.kind === 'coin' || ob.kind === 'magnet') && p.magnetTimer > 0;
          if (!sameLane && !magnetPull) continue;

          if (ob.kind === 'coin') {
            p.score += 45 * mult;
            sounds.push({ type: 'score', playerId: p.id });
            ob.z = -1;
            break;
          } else if (ob.kind === 'magnet') {
            p.magnetTimer = 6.0;
            p.score += 65 * mult;
            sounds.push({ type: 'score', playerId: p.id });
            ob.z = -1;
            break;
          } else if (sameLane && p.stunTimer <= 0) {
            const cleared =
              (ob.kind === 'lowbarrier' && p.zHeight > 32) ||
              (ob.kind === 'highbar' && p.slideTimer > 0) ||
              (ob.kind === 'train' && p.zHeight > 52);
            if (!cleared) {
              p.stunTimer = 1.0;
              p.score = Math.max(0, p.score - 45);
              sounds.push({ type: 'hit', playerId: p.id });
            }
          }
        }
      }
      if (ob.z < 0) state.obstacles.splice(i, 1);
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'three-lane-metro',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      speed: state.speed,
      obstacles: state.obstacles,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        lane: p.lane,
        zHeight: p.zHeight,
        sliding: p.slideTimer > 0,
        magnetTimer: p.magnetTimer,
        stunTimer: p.stunTimer,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 0.4, 0, 1),
        cooldownB: clamp(p.cdB / 0.5, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} metro pts`);
  },
};

// ============================================================================
// 10. TILT LABYRINTH (Super Monkey Ball / Wooden Maze style)
// ============================================================================
interface TiltLabState {
  timeLeft: number;
  totalTime: number;
  stage: number;
  tiltX: number;
  tiltY: number;
  holes: { x: number; y: number; r: number }[];
  walls: { x: number; y: number; w: number; h: number }[];
  goals: { id: string; x: number; y: number; r: number; gold: boolean }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    z: number;
    vz: number;
    alive: boolean;
    respawnTimer: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
  }[];
  banner: string | null;
}

function buildLabyrinthStage(stage: number) {
  const holes = [
    { x: 350, y: 240, r: 24 },
    { x: 520, y: 460, r: 24 },
    { x: 740, y: 255, r: 26 },
    { x: 890, y: 470, r: 24 },
    { x: 600, y: 360, r: 24 },
  ];
  const walls = [
    { x: 310, y: 120, w: 22, h: 250 },
    { x: 470, y: 310, w: 22, h: 280 },
    { x: 680, y: 120, w: 22, h: 240 },
    { x: 840, y: 320, w: 22, h: 270 },
  ];
  const goals = [
    { id: `g1_${stage}`, x: 250, y: 500, r: 22, gold: false },
    { id: `g2_${stage}`, x: 600, y: 195, r: 24, gold: true },
    { id: `g3_${stage}`, x: 960, y: 230, r: 24, gold: true },
    { id: `g4_${stage}`, x: 950, y: 530, r: 22, gold: false },
  ];
  return { holes, walls, goals };
}

export const tiltLabyrinthModule: CompactGameModule<TiltLabState, TiltLabyrinthSnapshot> = {
  id: 'tilt-labyrinth',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const { holes, walls, goals } = buildLabyrinthStage(1);
    return {
      timeLeft: totalTime,
      totalTime,
      stage: 1,
      tiltX: 0,
      tiltY: 0,
      holes,
      walls,
      goals,
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 190 + (i % 2) * 38,
        y: 190 + Math.floor(i / 2) * 44,
        vx: 0,
        vy: 0,
        z: 0,
        vz: 0,
        alive: true,
        respawnTimer: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
      })),
      banner: 'TILT THE LABYRINTH & HOP OVER PITFALLS TO GRAB GOLD STARS!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    let sumX = 0;
    let sumY = 0;
    let activeCount = 0;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);
      if (!p.alive) {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) {
          p.alive = true;
          p.x = 185;
          p.y = 195 + (p.slotIndex % 3) * 40;
          p.vx = 0;
          p.vy = 0;
        }
        continue;
      }

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      sumX += mx;
      sumY += my;
      activeCount += 1;

      const justA = Boolean(inp?.actionA && !p.prevA);
      if (inp) p.prevA = inp.actionA;

      if (justA && p.z <= 1 && p.cdA <= 0) {
        p.vz = 290;
        p.cdA = 1.1;
        sounds.push({ type: 'dash', playerId: p.id });
      }
      if (inp?.actionB) {
        p.vx *= 0.82;
        p.vy *= 0.82;
      }

      const acc = frenzy ? 640 : 520;
      p.vx = clamp(p.vx + mx * acc * dt, -340, 340);
      p.vy = clamp(p.vy + my * acc * dt, -340, 340);
      p.vx *= Math.pow(0.92, dt * 10);
      p.vy *= Math.pow(0.92, dt * 10);

      if (p.z > 0 || p.vz > 0) {
        p.z = Math.max(0, p.z + p.vz * dt);
        p.vz -= 780 * dt;
      }

      p.x = clamp(p.x + p.vx * dt, 130, ARENA_WIDTH - 130);
      p.y = clamp(p.y + p.vy * dt, 120, ARENA_HEIGHT - 105);

      for (const w of state.walls) {
        const nearestX = clamp(p.x, w.x, w.x + w.w);
        const nearestY = clamp(p.y, w.y, w.y + w.h);
        const dx = p.x - nearestX;
        const dy = p.y - nearestY;
        const d = Math.hypot(dx, dy);
        if (d < 16 && d > 0.001) {
          p.x = nearestX + (dx / d) * 16;
          p.y = nearestY + (dy / d) * 16;
          if (Math.abs(dx) > Math.abs(dy)) p.vx *= -0.5;
          else p.vy *= -0.5;
        }
      }

      if (p.z < 10) {
        for (const h of state.holes) {
          if (Math.hypot(p.x - h.x, p.y - h.y) < h.r - 4) {
            p.alive = false;
            p.respawnTimer = 1.6;
            sounds.push({ type: 'elim', playerId: p.id });
            break;
          }
        }
      }

      for (let i = state.goals.length - 1; i >= 0; i--) {
        const g = state.goals[i];
        if (Math.hypot(p.x - g.x, p.y - g.y) < g.r + 14) {
          p.score += (g.gold ? 140 : 85) * mult;
          state.goals.splice(i, 1);
          sounds.push({ type: 'score', playerId: p.id });
        }
      }
    }

    if (activeCount > 0) {
      state.tiltX = clamp(sumX / activeCount, -1, 1);
      state.tiltY = clamp(sumY / activeCount, -1, 1);
    }

    if (state.goals.length === 0) {
      state.stage += 1;
      const next = buildLabyrinthStage(state.stage);
      state.goals = next.goals;
      state.banner = `STAGE ${state.stage} GOALS SPAWNED!`;
      sounds.push({ type: 'win' });
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'tilt-labyrinth',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      stage: state.stage,
      tiltX: state.tiltX,
      tiltY: state.tiltY,
      holes: state.holes,
      walls: state.walls,
      goals: state.goals,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        z: p.z,
        alive: p.alive,
        score: Math.round(p.score),
        cooldownA: clamp(p.cdA / 1.1, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} maze pts`);
  },
};
