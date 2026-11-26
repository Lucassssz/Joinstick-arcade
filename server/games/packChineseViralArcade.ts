import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BlockHopPlatform,
  type BlockHopSnapshot,
  type ClawManiaSnapshot,
  type ClawPrizeItem,
  type DrawGuessRelaySnapshot,
  type DrawStrokePoint,
  type EggObstacleItem,
  type EggRushSnapshot,
  type GooseAlertSnapshot,
  type GooseTaskStation,
  type HotpotIngredient,
  type HotpotRushSnapshot,
  type MelonMergeSnapshot,
  type PlatformLeapSnapshot,
  type SkyPlatformItem,
  type TileTripleSnapshot,
  type TripleTileItem,
  type TruthBombSnapshot,
} from '../../src/shared/types.ts';
import type {
  CompactGameInitContext as GameInitContext,
  CompactGameModule as ServerGameModule,
  CompactResultEntry as GameResultEntry,
  CompactSoundEvent as SoundEvent,
} from './packModuleAdapter.ts';

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const dist = (x1: number, y1: number, x2: number, y2: number) => Math.hypot(x2 - x1, y2 - y1);

function buildRankings(
  entries: { id: string; score: number; stat: string }[]
): GameResultEntry[] {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  return sorted.map((e, i) => ({
    playerId: e.id,
    rank: i + 1,
    score: Math.round(e.score),
    statLabel: e.stat,
  }));
}

function tickPopups(
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[],
  dt: number
) {
  for (let i = popups.length - 1; i >= 0; i--) {
    popups[i].y -= dt * 26;
    popups[i].alpha -= dt * 1.1;
    if (popups[i].alpha <= 0) popups.splice(i, 1);
  }
}

// ============================================================
// 59. MELON MERGE (合成大西瓜)
// ============================================================
const MELON_RADII = [0.045, 0.058, 0.072, 0.086, 0.102, 0.12, 0.138, 0.158, 0.18, 0.21];
const MELON_SCORES = [5, 12, 25, 45, 80, 140, 230, 380, 620, 1200];

interface MelonFruitSim {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tier: number;
  r: number;
}

interface MelonPlayerSim {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  aimX: number;
  nextTier: number;
  fruits: MelonFruitSim[];
  melonsCreated: number;
  comboCount: number;
  overflowed: boolean;
  overflowTimer: number;
  shakeTimer: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
  maxCooldownB: number;
  prevA: boolean;
  prevB: boolean;
}

interface MelonMergeState {
  timeLeft: number;
  totalTime: number;
  banner: string | null;
  bannerTimer: number;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: MelonPlayerSim[];
  seq: number;
}

export const melonMergeModule: ServerGameModule<MelonMergeState, MelonMergeSnapshot> = {
  id: 'melon-merge',
  init(ctx: GameInitContext): MelonMergeState {
    const totalTime = ctx.settingValue || 90;
    const players: MelonPlayerSim[] = ctx.players.map((p, idx) => {
      const f1 = { id: `m_${idx}_0`, x: 0.35, y: 0.92, vx: 0, vy: 0, tier: 0, r: MELON_RADII[0] };
      const f2 = { id: `m_${idx}_1`, x: 0.62, y: 0.9, vx: 0, vy: 0, tier: 1, r: MELON_RADII[1] };
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: 0.5,
        nextTier: Math.floor(Math.random() * 3),
        fruits: [f1, f2],
        melonsCreated: 0,
        comboCount: 0,
        overflowed: false,
        overflowTimer: 0,
        shakeTimer: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        maxCooldownB: 4.5,
        prevA: false,
        prevB: false,
      };
    });
    return {
      timeLeft: totalTime,
      totalTime,
      banner: 'DROP & MERGE INTO A GIANT MELON!',
      bannerTimer: 2.2,
      popups: [],
      players,
      seq: 10,
    };
  },
  step(state, players, dt, frenzyActive) {
    const sounds: SoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    tickPopups(state.popups, dt);

    const inputMap = new Map(players.map((p) => [p.id, p]));
    const cols = Math.min(4, Math.max(1, state.players.length));

    for (let pi = 0; pi < state.players.length; pi++) {
      const sp = state.players[pi];
      const inp = inputMap.get(sp.id);
      sp.cooldownA = Math.max(0, sp.cooldownA - dt);
      sp.cooldownB = Math.max(0, sp.cooldownB - dt);
      sp.shakeTimer = Math.max(0, sp.shakeTimer - dt);

      if (sp.overflowed) continue;

      const moveX = inp?.input.moveX ?? 0;
      const aNow = Boolean(inp?.input.actionA);
      const bNow = Boolean(inp?.input.actionB);
      const aPressed = aNow && !sp.prevA;
      const bPressed = bNow && !sp.prevB;
      sp.prevA = aNow;
      sp.prevB = bNow;

      sp.aimX = clamp(sp.aimX + moveX * dt * 0.95, 0.12, 0.88);

      // Drop fruit
      if (aPressed && sp.cooldownA <= 0) {
        const tier = sp.nextTier;
        const r = MELON_RADII[tier];
        sp.fruits.push({
          id: `f_${state.seq++}`,
          x: clamp(sp.aimX, r + 0.02, 1 - r - 0.02),
          y: 0.14,
          vx: (Math.random() - 0.5) * 0.06,
          vy: 0.08,
          tier,
          r,
        });
        sp.nextTier = frenzyActive
          ? Math.floor(Math.random() * 4) + 1
          : Math.floor(Math.random() * 4);
        sp.cooldownA = 0.42;
        sounds.push({ type: 'tick', playerId: sp.id });
      }

      // Shake tank
      if (bPressed && sp.cooldownB <= 0) {
        sp.shakeTimer = 0.45;
        const maxCdB = frenzyActive ? 2.5 : 4.5;
        sp.cooldownB = maxCdB;
        sp.maxCooldownB = maxCdB;
        for (const f of sp.fruits) {
          f.vx += (Math.random() - 0.5) * 0.7;
          f.vy -= 0.35 + Math.random() * 0.2;
        }
        sounds.push({ type: 'dash', playerId: sp.id });
      }

      // Physics integration (2 substeps)
      for (let sub = 0; sub < 2; sub++) {
        const sdt = dt / 2;
        for (const f of sp.fruits) {
          f.vy += 1.65 * sdt;
          f.x += f.vx * sdt;
          f.y += f.vy * sdt;
          f.vx *= 0.985;
          f.vy *= 0.992;

          if (f.x < f.r) {
            f.x = f.r;
            f.vx = Math.abs(f.vx) * 0.35;
          } else if (f.x > 1 - f.r) {
            f.x = 1 - f.r;
            f.vx = -Math.abs(f.vx) * 0.35;
          }
          if (f.y > 1 - f.r) {
            f.y = 1 - f.r;
            f.vy = -Math.abs(f.vy) * 0.18;
            f.vx *= 0.88;
          }
        }

        // Pairwise collision + merge
        const toRemove = new Set<string>();
        const toAdd: MelonFruitSim[] = [];
        for (let i = 0; i < sp.fruits.length; i++) {
          const a = sp.fruits[i];
          if (toRemove.has(a.id)) continue;
          for (let j = i + 1; j < sp.fruits.length; j++) {
            const b = sp.fruits[j];
            if (toRemove.has(b.id)) continue;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            const minD = a.r + b.r;
            if (d < minD && d > 0.0001) {
              if (a.tier === b.tier && a.tier < MELON_RADII.length - 1) {
                toRemove.add(a.id);
                toRemove.add(b.id);
                const nextTier = a.tier + 1;
                const nx = clamp((a.x + b.x) / 2, MELON_RADII[nextTier], 1 - MELON_RADII[nextTier]);
                const ny = clamp((a.y + b.y) / 2, 0.1, 1 - MELON_RADII[nextTier]);
                toAdd.push({
                  id: `f_${state.seq++}`,
                  x: nx,
                  y: ny,
                  vx: (a.vx + b.vx) * 0.25,
                  vy: -0.14,
                  tier: nextTier,
                  r: MELON_RADII[nextTier],
                });
                const pts = MELON_SCORES[nextTier] * (frenzyActive ? 2 : 1);
                sp.score += pts;
                sp.comboCount++;
                if (nextTier === MELON_RADII.length - 1) {
                  sp.melonsCreated++;
                  state.banner = `${sp.name} CRAFTED A GIANT WATERMELON!`;
                  state.bannerTimer = 2.4;
                  sounds.push({ type: 'win', playerId: sp.id });
                } else {
                  sounds.push({ type: 'score', playerId: sp.id });
                }
                const colIdx = pi % cols;
                const tankCenterX = (ARENA_WIDTH / cols) * (colIdx + 0.5);
                state.popups.push({
                  x: tankCenterX,
                  y: 260,
                  text: nextTier === 9 ? `WATERMELON +${pts}!` : `MERGE +${pts}`,
                  colorHex: nextTier >= 7 ? '#FACC15' : '#4ADE80',
                  alpha: 1,
                });
                break;
              } else {
                const overlap = (minD - d) * 0.52;
                const ux = dx / d;
                const uy = dy / d;
                a.x -= ux * overlap;
                a.y -= uy * overlap;
                b.x += ux * overlap;
                b.y += uy * overlap;
                const relVn = (b.vx - a.vx) * ux + (b.vy - a.vy) * uy;
                if (relVn < 0) {
                  const imp = -relVn * 0.4;
                  a.vx -= imp * ux;
                  a.vy -= imp * uy;
                  b.vx += imp * ux;
                  b.vy += imp * uy;
                }
              }
            }
          }
        }
        if (toRemove.size > 0) {
          sp.fruits = sp.fruits.filter((f) => !toRemove.has(f.id)).concat(toAdd);
        }
      }

      // Overflow check (sustained 2.2s above danger line y < 0.14)
      const highFruit = sp.fruits.some((f) => f.y - f.r < 0.11 && Math.abs(f.vy) < 0.25);
      if (highFruit) {
        sp.overflowTimer += dt;
        if (sp.overflowTimer > 2.4) {
          sp.overflowed = true;
          sounds.push({ type: 'elim', playerId: sp.id });
        }
      } else {
        sp.overflowTimer = Math.max(0, sp.overflowTimer - dt * 1.5);
      }
    }

    const activeCount = state.players.filter((p) => !p.overflowed).length;
    const finished = state.timeLeft <= 0 || activeCount === 0;
    return { finished, sounds };
  },
  snapshot(state): MelonMergeSnapshot {
    return {
      gameId: 'melon-merge',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      banner: state.banner,
      popups: state.popups.map((p) => ({ ...p })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        aimX: p.aimX,
        nextTier: p.nextTier,
        fruits: p.fruits.map((f) => ({ id: f.id, x: f.x, y: f.y, tier: f.tier, r: f.r })),
        melonsCreated: p.melonsCreated,
        comboCount: p.comboCount,
        overflowed: p.overflowed,
        shakeTimer: p.shakeTimer,
        score: p.score,
        cooldownA: clamp(p.cooldownA / 0.42, 0, 1),
        cooldownB: clamp(p.cooldownB / Math.max(0.1, p.maxCooldownB || 4.5), 0, 1),
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        score: p.score,
        stat: p.melonsCreated > 0 ? `${p.melonsCreated} Melons · ${p.score} pts` : `${p.comboCount} Merges`,
      }))
    );
  },
};

// ============================================================
// 60. TILE TRIPLE (羊了个羊)
// ============================================================
interface TileTriplePlayerSim {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  cursorCol: number;
  cursorRow: number;
  tray: number[];
  clearedTriples: number;
  failed: boolean;
  tiles: TripleTileItem[];
  score: number;
  cooldownA: number;
  cooldownB: number;
  maxCooldownB: number;
  navCooldown: number;
  prevA: boolean;
  prevB: boolean;
}

interface TileTripleState {
  timeLeft: number;
  totalTime: number;
  banner: string | null;
  bannerTimer: number;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: TileTriplePlayerSim[];
}

function makeTripleDeck(seedOffset: number): TripleTileItem[] {
  // 36 tiles = 12 triples across 6 symbols -> guaranteed solvable!
  const symbols: number[] = [];
  for (let i = 0; i < 12; i++) {
    const sym = (i + seedOffset) % 6;
    symbols.push(sym, sym, sym);
  }
  for (let i = symbols.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
  }
  const tiles: TripleTileItem[] = [];
  let idx = 0;
  // Layer 0 (bottom): 4x4 = 16 tiles
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      tiles.push({ id: `t_${idx}`, col: c, row: r, layer: 0, symbol: symbols[idx++], blocked: false, removed: false });
    }
  }
  // Layer 1 (mid): 4x3 = 12 tiles
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      tiles.push({ id: `t_${idx}`, col: c, row: r, layer: 1, symbol: symbols[idx++], blocked: false, removed: false });
    }
  }
  // Layer 2 (top): 4x2 = 8 tiles
  for (let r = 1; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      tiles.push({ id: `t_${idx}`, col: c, row: r, layer: 2, symbol: symbols[idx++], blocked: false, removed: false });
    }
  }
  recomputeBlockedTiles(tiles);
  return tiles;
}

function recomputeBlockedTiles(tiles: TripleTileItem[]) {
  for (const t of tiles) {
    if (t.removed) {
      t.blocked = true;
      continue;
    }
    t.blocked = tiles.some(
      (other) => !other.removed && other.layer > t.layer && other.col === t.col && other.row === t.row
    );
  }
}

export const tileTripleModule: ServerGameModule<TileTripleState, TileTripleSnapshot> = {
  id: 'tile-triple',
  init(ctx): TileTripleState {
    const totalTime = ctx.settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      banner: 'MATCH 3 IDENTICAL TILES — DON’T FILL YOUR TRAY!',
      bannerTimer: 2.3,
      popups: [],
      players: ctx.players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorCol: 1,
        cursorRow: 1,
        tray: [],
        clearedTriples: 0,
        failed: false,
        tiles: makeTripleDeck(i),
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        maxCooldownB: 6.0,
        navCooldown: 0,
        prevA: false,
        prevB: false,
      })),
    };
  },
  step(state, players, dt, frenzyActive) {
    const sounds: SoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    tickPopups(state.popups, dt);
    const inputMap = new Map(players.map((p) => [p.id, p]));

    for (const sp of state.players) {
      sp.cooldownA = Math.max(0, sp.cooldownA - dt);
      sp.cooldownB = Math.max(0, sp.cooldownB - dt);
      sp.navCooldown = Math.max(0, sp.navCooldown - dt);
      if (sp.failed) continue;

      const inp = inputMap.get(sp.id);
      const mx = inp?.input.moveX ?? 0;
      const my = inp?.input.moveY ?? 0;
      const aNow = Boolean(inp?.input.actionA);
      const bNow = Boolean(inp?.input.actionB);
      const aPressed = aNow && !sp.prevA;
      const bPressed = bNow && !sp.prevB;
      sp.prevA = aNow;
      sp.prevB = bNow;

      if (sp.navCooldown <= 0 && (Math.abs(mx) > 0.35 || Math.abs(my) > 0.35)) {
        if (Math.abs(mx) >= Math.abs(my)) {
          sp.cursorCol = (sp.cursorCol + (mx > 0 ? 1 : -1) + 4) % 4;
        } else {
          sp.cursorRow = (sp.cursorRow + (my > 0 ? 1 : -1) + 4) % 4;
        }
        sp.navCooldown = 0.16;
      }

      // Pick top unblocked tile at cursor (or nearest unblocked if empty cell)
      if (aPressed && sp.cooldownA <= 0) {
        let pick = sp.tiles
          .filter((t) => !t.removed && !t.blocked && t.col === sp.cursorCol && t.row === sp.cursorRow)
          .sort((a, b) => b.layer - a.layer)[0];
        if (!pick) {
          pick = sp.tiles.filter((t) => !t.removed && !t.blocked).sort((a, b) => b.layer - a.layer)[0];
          if (pick) {
            sp.cursorCol = pick.col;
            sp.cursorRow = pick.row;
          }
        }
        if (pick) {
          pick.removed = true;
          recomputeBlockedTiles(sp.tiles);
          sp.tray.push(pick.symbol);
          sp.tray.sort((a, b) => a - b);
          sp.cooldownA = 0.2;
          sounds.push({ type: 'tick', playerId: sp.id });

          // Check for 3-of-a-kind pop!
          const counts = new Map<number, number>();
          for (const s of sp.tray) counts.set(s, (counts.get(s) ?? 0) + 1);
          let popped = false;
          for (const [sym, cnt] of counts) {
            if (cnt >= 3) {
              let rem = 3;
              sp.tray = sp.tray.filter((s) => {
                if (s === sym && rem > 0) {
                  rem--;
                  return false;
                }
                return true;
              });
              sp.clearedTriples++;
              const pts = (120 + sp.clearedTriples * 15) * (frenzyActive ? 2 : 1);
              sp.score += pts;
              popped = true;
              sounds.push({ type: 'score', playerId: sp.id });
            }
          }

          if (!popped && sp.tray.length >= 7) {
            sp.failed = true;
            sounds.push({ type: 'elim', playerId: sp.id });
          }

          // Cleared entire board! Spawn a fresh bonus stack!
          if (sp.tiles.every((t) => t.removed)) {
            sp.score += 500;
            sp.tiles = makeTripleDeck(sp.clearedTriples + 1);
            state.banner = `${sp.name} CLEARED A FULL STACK! +500!`;
            state.bannerTimer = 2.2;
            sounds.push({ type: 'win', playerId: sp.id });
          }
        }
      }

      // Shuffle remaining symbols
      if (bPressed && sp.cooldownB <= 0) {
        const rem = sp.tiles.filter((t) => !t.removed);
        const syms = rem.map((t) => t.symbol);
        for (let i = syms.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [syms[i], syms[j]] = [syms[j], syms[i]];
        }
        rem.forEach((t, i) => {
          t.symbol = syms[i];
        });
        const maxCdB = frenzyActive ? 3.0 : 6.0;
        sp.cooldownB = maxCdB;
        sp.maxCooldownB = maxCdB;
        sounds.push({ type: 'dash', playerId: sp.id });
      }
    }

    const alive = state.players.filter((p) => !p.failed).length;
    return { finished: state.timeLeft <= 0 || alive === 0, sounds };
  },
  snapshot(state): TileTripleSnapshot {
    return {
      gameId: 'tile-triple',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      banner: state.banner,
      popups: state.popups.map((p) => ({ ...p })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorCol: p.cursorCol,
        cursorRow: p.cursorRow,
        tray: [...p.tray],
        clearedTriples: p.clearedTriples,
        remainingTiles: p.tiles.filter((t) => !t.removed).length,
        failed: p.failed,
        tiles: p.tiles.map((t) => ({ ...t })),
        score: p.score,
        cooldownA: clamp(p.cooldownA / 0.2, 0, 1),
        cooldownB: clamp(p.cooldownB / Math.max(0.1, p.maxCooldownB || 6.0), 0, 1),
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        score: p.score,
        stat: `${p.clearedTriples} Triples`,
      }))
    );
  },
};

// ============================================================
// 61. BLOCK HOP (跳一跳)
// ============================================================
interface BlockHopPlayerSim {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  z: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  jumpProgress: number;
  charging: number;
  isHolding: boolean;
  inAir: boolean;
  platformIndex: number;
  bullseyeStreak: number;
  alive: boolean;
  respawnTimer: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
  prevB: boolean;
}

interface BlockHopState {
  timeLeft: number;
  totalTime: number;
  cameraX: number;
  cameraY: number;
  platforms: BlockHopPlatform[];
  banner: string | null;
  bannerTimer: number;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: BlockHopPlayerSim[];
}

const HOP_COLORS = ['#38BDF8', '#A78BFA', '#34D399', '#FB923C', '#F472B6', '#FACC15'];

function ensurePlatforms(platforms: BlockHopPlatform[], upToIndex: number) {
  while (platforms.length <= upToIndex + 10) {
    const prev = platforms[platforms.length - 1];
    const idx = platforms.length;
    const goRight = idx % 2 === 1;
    const gap = 125 + Math.random() * 115;
    const dx = goRight ? gap * 0.88 : -gap * 0.15;
    const dy = goRight ? -gap * 0.44 : -gap * 0.56;
    const roll = Math.random();
    const kind: BlockHopPlatform['kind'] =
      roll > 0.88 ? 'gold' : roll > 0.76 ? 'music' : roll > 0.65 ? 'shop' : 'normal';
    platforms.push({
      index: idx,
      x: prev.x + dx,
      y: prev.y + dy,
      size: kind === 'gold' ? 46 : 42 + Math.random() * 14,
      colorHex: kind === 'gold' ? '#FACC15' : HOP_COLORS[idx % HOP_COLORS.length],
      kind,
    });
  }
}

export const blockHopModule: ServerGameModule<BlockHopState, BlockHopSnapshot> = {
  id: 'block-hop',
  init(ctx): BlockHopState {
    const totalTime = ctx.settingValue || 90;
    const platforms: BlockHopPlatform[] = [
      { index: 0, x: 260, y: 460, size: 54, colorHex: '#38BDF8', kind: 'normal' },
    ];
    ensurePlatforms(platforms, 12);
    return {
      timeLeft: totalTime,
      totalTime,
      cameraX: 260,
      cameraY: 460,
      platforms,
      banner: 'HOLD A TO CHARGE JUMP — LAND ON CENTER FOR STREAKS!',
      bannerTimer: 2.3,
      popups: [],
      players: ctx.players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 260 + ((i % 4) - 1.5) * 14,
        y: 460 + Math.floor(i / 4) * 12,
        z: 0,
        startX: 260,
        startY: 460,
        targetX: 260,
        targetY: 460,
        jumpProgress: 0,
        charging: 0,
        isHolding: false,
        inAir: false,
        platformIndex: 0,
        bullseyeStreak: 0,
        alive: true,
        respawnTimer: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        prevB: false,
      })),
    };
  },
  step(state, players, dt, frenzyActive) {
    const sounds: SoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    tickPopups(state.popups, dt);
    const inputMap = new Map(players.map((p) => [p.id, p]));

    let leadPlat = state.platforms[0];
    for (const sp of state.players) {
      if (sp.respawnTimer > 0) {
        sp.respawnTimer -= dt;
        if (sp.respawnTimer <= 0) {
          const cur = state.platforms[sp.platformIndex] ?? state.platforms[0];
          sp.x = cur.x;
          sp.y = cur.y;
          sp.z = 0;
          sp.alive = true;
          sp.inAir = false;
        }
        continue;
      }

      const inp = inputMap.get(sp.id);
      const holdA = Boolean(inp?.input.actionA);
      const bNow = Boolean(inp?.input.actionB);
      const bPressed = bNow && !sp.prevB;
      sp.prevB = bNow;
      sp.cooldownB = Math.max(0, sp.cooldownB - dt);

      const curPlat = state.platforms[sp.platformIndex];
      const nextPlat = state.platforms[sp.platformIndex + 1];
      if (!curPlat || !nextPlat) continue;

      if (!sp.inAir) {
        if (holdA) {
          sp.isHolding = true;
          sp.charging = clamp(sp.charging + dt * 0.92, 0, 1);
        } else if (sp.isHolding) {
          // Launch along direction toward next platform scaled by charge!
          sp.isHolding = false;
          const dx = nextPlat.x - curPlat.x;
          const dy = nextPlat.y - curPlat.y;
          const d = Math.hypot(dx, dy) || 1;
          const jumpDist = 60 + sp.charging * 255;
          sp.startX = sp.x;
          sp.startY = sp.y;
          sp.targetX = sp.x + (dx / d) * jumpDist;
          sp.targetY = sp.y + (dy / d) * jumpDist;
          sp.jumpProgress = 0;
          sp.inAir = true;
          sp.charging = 0;
          sounds.push({ type: 'dash', playerId: sp.id });
        }
      } else {
        // Subtle mid-air nudge + Air brake
        const nudgeX = clamp(inp?.input.moveX ?? 0, -1, 1);
        const nudgeY = clamp(inp?.input.moveY ?? 0, -1, 1);
        sp.targetX += nudgeX * dt * 65;
        sp.targetY += nudgeY * dt * 45;
        if (bPressed && sp.cooldownB <= 0) {
          sp.targetX = sp.x + (sp.targetX - sp.x) * 0.65;
          sp.targetY = sp.y + (sp.targetY - sp.y) * 0.65;
          sp.cooldownB = 1.5;
        }
        sp.jumpProgress = clamp(sp.jumpProgress + dt * 2.4, 0, 1);
        const p = sp.jumpProgress;
        sp.x = sp.startX + (sp.targetX - sp.startX) * p;
        sp.y = sp.startY + (sp.targetY - sp.startY) * p;
        sp.z = Math.sin(p * Math.PI) * 95;

        if (p >= 1) {
          sp.inAir = false;
          sp.z = 0;
          // Check landing on nextPlat or curPlat
          const dNext = dist(sp.x, sp.y, nextPlat.x, nextPlat.y);
          const dCur = dist(sp.x, sp.y, curPlat.x, curPlat.y);
          const hitRadius = nextPlat.size * (frenzyActive ? 1.15 : 0.96);
          if (dNext <= hitRadius) {
            sp.platformIndex++;
            ensurePlatforms(state.platforms, sp.platformIndex);
            const bullseye = dNext <= nextPlat.size * (frenzyActive ? 0.45 : 0.34);
            sp.bullseyeStreak = bullseye ? sp.bullseyeStreak + 1 : 0;
            const bonus = nextPlat.kind === 'gold' ? 60 : nextPlat.kind !== 'normal' ? 30 : 0;
            const pts =
              (20 + (bullseye ? 20 * sp.bullseyeStreak : 0) + bonus) * (frenzyActive ? 2 : 1);
            sp.score += pts;
            sounds.push({ type: 'score', playerId: sp.id });
            state.popups.push({
              x: ARENA_WIDTH / 2 + (sp.x - state.cameraX),
              y: ARENA_HEIGHT / 2 + (sp.y - state.cameraY) - 40,
              text: bullseye ? `BULLSEYE ×${sp.bullseyeStreak} +${pts}!` : `+${pts}`,
              colorHex: bullseye ? '#FACC15' : '#38BDF8',
              alpha: 1,
            });
          } else if (dCur <= curPlat.size * 0.95) {
            // Short hop back onto same block
            sp.bullseyeStreak = 0;
          } else {
            // Fell off! Respawn on current block with small streak reset
            sp.bullseyeStreak = 0;
            sp.alive = false;
            sp.respawnTimer = 0.85;
            sounds.push({ type: 'hit', playerId: sp.id });
          }
        }
      }

      if (sp.platformIndex > leadPlat.index) {
        leadPlat = state.platforms[sp.platformIndex] ?? leadPlat;
      }
    }

    // Smooth camera follows leading platform
    state.cameraX += (leadPlat.x - state.cameraX) * Math.min(1, dt * 4);
    state.cameraY += (leadPlat.y - state.cameraY) * Math.min(1, dt * 4);

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state): BlockHopSnapshot {
    const minIdx = Math.max(0, Math.min(...state.players.map((p) => p.platformIndex)) - 2);
    const maxIdx = Math.max(...state.players.map((p) => p.platformIndex)) + 8;
    return {
      gameId: 'block-hop',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cameraX: state.cameraX,
      cameraY: state.cameraY,
      platforms: state.platforms.slice(minIdx, maxIdx).map((p) => ({ ...p })),
      banner: state.banner,
      popups: state.popups.map((p) => ({ ...p })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        z: p.z,
        charging: p.charging,
        inAir: p.inAir,
        platformIndex: p.platformIndex,
        bullseyeStreak: p.bullseyeStreak,
        alive: p.alive,
        score: p.score,
        cooldownA: 0,
        cooldownB: clamp(p.cooldownB / 1.5, 0, 1),
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        score: p.score,
        stat: `Block #${p.platformIndex} · ${p.score} pts`,
      }))
    );
  },
};

// ============================================================
// 62. PLATFORM LEAP (极速跳台)
// ============================================================
interface SkyPlatSim extends SkyPlatformItem {
  vx: number;
}

interface LeapPlayerSim {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
  maxAltitude: number;
  stompTimer: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
  prevA: boolean;
  prevB: boolean;
}

interface PlatformLeapState {
  timeLeft: number;
  cameraY: number;
  lavaY: number;
  lavaGrace: number;
  highestGenY: number;
  platforms: SkyPlatSim[];
  banner: string | null;
  bannerTimer: number;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LeapPlayerSim[];
  seq: number;
}

function generateSkyPlatforms(state: PlatformLeapState, targetY: number) {
  while (state.highestGenY > targetY) {
    state.highestGenY -= 78 + Math.random() * 24;
    const roll = Math.random();
    const kind: SkyPlatformItem['kind'] =
      roll > 0.82 ? 'spring' : roll > 0.62 ? 'moving' : roll > 0.45 ? 'crumble' : 'solid';
    const w = kind === 'spring' ? 110 : 128 + Math.random() * 48;
    const x = 90 + Math.random() * (ARENA_WIDTH - 180 - w);
    state.platforms.push({
      id: `sp_${state.seq++}`,
      x,
      y: state.highestGenY,
      w,
      kind,
      cracked: false,
      vx: kind === 'moving' ? (Math.random() > 0.5 ? 120 : -120) : 0,
    });
  }
}

export const platformLeapModule: ServerGameModule<PlatformLeapState, PlatformLeapSnapshot> = {
  id: 'platform-leap',
  init(ctx): PlatformLeapState {
    const totalTime = ctx.settingValue || 90;
    const st: PlatformLeapState = {
      timeLeft: totalTime,
      cameraY: 0,
      lavaY: 760,
      lavaGrace: 2.5,
      highestGenY: 540,
      platforms: [
        { id: 'floor', x: 60, y: 540, w: ARENA_WIDTH - 120, kind: 'solid', cracked: false, vx: 0 },
      ],
      banner: 'CLIMB HIGHER THAN THE RISING NEON LAVA!',
      bannerTimer: 2.2,
      popups: [],
      players: ctx.players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 200 + (i * (ARENA_WIDTH - 400)) / Math.max(1, ctx.players.length - 1),
        y: 500,
        vx: 0,
        vy: -520,
        alive: true,
        maxAltitude: 0,
        stompTimer: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        prevA: false,
        prevB: false,
      })),
      seq: 1,
    };
    generateSkyPlatforms(st, -900);
    return st;
  },
  step(state, players, dt, frenzyActive) {
    const sounds: SoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    tickPopups(state.popups, dt);

    // Move moving platforms
    for (const pl of state.platforms) {
      if (pl.kind === 'moving') {
        pl.x += pl.vx * dt;
        if (pl.x < 60 || pl.x + pl.w > ARENA_WIDTH - 60) pl.vx *= -1;
      }
    }

    const inputMap = new Map(players.map((p) => [p.id, p]));
    let highestPlayerY = 500;

    for (const sp of state.players) {
      if (!sp.alive) continue;
      sp.cooldownA = Math.max(0, sp.cooldownA - dt);
      sp.cooldownB = Math.max(0, sp.cooldownB - dt);
      sp.stompTimer = Math.max(0, sp.stompTimer - dt);

      const inp = inputMap.get(sp.id);
      const mx = inp?.input.moveX ?? 0;
      const aNow = Boolean(inp?.input.actionA);
      const bNow = Boolean(inp?.input.actionB);
      const aPressed = aNow && !sp.prevA;
      const bPressed = bNow && !sp.prevB;
      sp.prevA = aNow;
      sp.prevB = bNow;

      sp.vx = mx * 390;
      sp.vy += 1260 * dt;

      if (aPressed && sp.cooldownA <= 0 && sp.vy > -220) {
        sp.vy = -590;
        sp.cooldownA = 0.55;
        sounds.push({ type: 'dash', playerId: sp.id });
      }
      if (bPressed && sp.cooldownB <= 0) {
        sp.vy = 560;
        sp.stompTimer = 0.45;
        sp.cooldownB = 1.6;
      }

      const prevY = sp.y;
      sp.x = clamp(sp.x + sp.vx * dt, 34, ARENA_WIDTH - 34);
      sp.y += sp.vy * dt;

      // Landing on platforms while falling
      if (sp.vy > 0) {
        for (const pl of state.platforms) {
          if (pl.cracked) continue;
          if (
            prevY + 18 <= pl.y + 10 &&
            sp.y + 18 >= pl.y &&
            sp.x >= pl.x - 14 &&
            sp.x <= pl.x + pl.w + 14
          ) {
            sp.y = pl.y - 18;
            const springBoost = pl.kind === 'spring' ? (frenzyActive ? -980 : -860) : -600;
            sp.vy = sp.stompTimer > 0 ? springBoost * 1.15 : springBoost;
            if (pl.kind === 'crumble') pl.cracked = true;
            if (pl.kind === 'spring') sounds.push({ type: 'score', playerId: sp.id });
            break;
          }
        }
        // Head-stomp bounce off another player!
        for (const other of state.players) {
          if (other.id === sp.id || !other.alive) continue;
          if (Math.abs(sp.x - other.x) < 34 && sp.y < other.y && other.y - sp.y < 36) {
            sp.vy = -780;
            other.vy = Math.max(other.vy, 240);
            sp.score += frenzyActive ? 160 : 80;
            sounds.push({ type: 'hit', playerId: sp.id });
            state.popups.push({
              x: sp.x,
              y: sp.y - state.cameraY - 24,
              text: 'HEAD BOUNCE!',
              colorHex: '#FACC15',
              alpha: 1,
            });
          }
        }
      }

      const alt = Math.max(0, Math.round((520 - sp.y) / 10));
      if (alt > sp.maxAltitude) {
        sp.score += (alt - sp.maxAltitude) * (frenzyActive ? 4 : 2);
        sp.maxAltitude = alt;
      }
      if (sp.y < highestPlayerY) highestPlayerY = sp.y;
    }

    // Camera smoothly rises with leader; lava climbs relentlessly!
    const targetCam = Math.min(state.cameraY, highestPlayerY - 260);
    state.cameraY += (targetCam - state.cameraY) * Math.min(1, dt * 5);
    generateSkyPlatforms(state, state.cameraY - 900);

    if (state.lavaGrace > 0) {
      state.lavaGrace = Math.max(0, state.lavaGrace - dt);
    } else {
      const lavaSpeed = frenzyActive ? 74 : 50;
      state.lavaY = Math.min(state.lavaY - lavaSpeed * dt, state.cameraY + ARENA_HEIGHT + 40);
    }

    // Check lava elimination
    for (const sp of state.players) {
      if (sp.alive && sp.y > state.lavaY) {
        sp.alive = false;
        sounds.push({ type: 'elim', playerId: sp.id });
      }
    }

    // Prune far below platforms
    state.platforms = state.platforms.filter((p) => p.y < state.lavaY + 120);

    const aliveCount = state.players.filter((p) => p.alive).length;
    const finished =
      state.timeLeft <= 0 ||
      aliveCount === 0 ||
      (state.players.length > 1 && aliveCount <= 1);
    return { finished, sounds };
  },
  snapshot(state): PlatformLeapSnapshot {
    return {
      gameId: 'platform-leap',
      timeLeft: state.timeLeft,
      cameraY: state.cameraY,
      lavaY: state.lavaY,
      platforms: state.platforms
        .filter((p) => p.y >= state.cameraY - 60 && p.y <= state.cameraY + ARENA_HEIGHT + 60)
        .map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, kind: p.kind, cracked: p.cracked })),
      banner: state.banner,
      popups: state.popups.map((p) => ({ ...p })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        alive: p.alive,
        maxAltitude: p.maxAltitude,
        stompTimer: p.stompTimer,
        score: p.score,
        cooldownA: clamp(p.cooldownA / 0.55, 0, 1),
        cooldownB: clamp(p.cooldownB / 1.6, 0, 1),
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        score: p.score + (p.alive ? 250 : 0),
        stat: `${p.maxAltitude}m Peak`,
      }))
    );
  },
};

// ============================================================
// 63. EGG RUSH (蛋仔派对)
// ============================================================
interface EggPlayerSim {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  z: number;
  vz: number;
  vx: number;
  vy: number;
  rolling: boolean;
  rollTimer: number;
  stunTimer: number;
  finished: boolean;
  finishRank: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
  maxCooldownB: number;
  prevA: boolean;
  prevB: boolean;
}

interface EggRushState {
  timeLeft: number;
  trackLength: number;
  cameraX: number;
  finishCount: number;
  obstacles: EggObstacleItem[];
  banner: string | null;
  bannerTimer: number;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: EggPlayerSim[];
}

export const eggRushModule: ServerGameModule<EggRushState, EggRushSnapshot> = {
  id: 'egg-rush',
  init(ctx): EggRushState {
    const lenMult = ctx.settingValue || 2;
    const trackLength = 2200 + lenMult * 850;
    const obstacles: EggObstacleItem[] = [];
    for (let x = 420; x < trackLength - 260; x += 250) {
      const idx = Math.floor(x / 250);
      if (idx % 3 === 0) {
        obstacles.push({ id: `sw_${idx}`, kind: 'sweeper', x, y: 340, w: 170, h: 20, angle: idx, dir: idx % 2 === 0 ? 1 : -1 });
      } else if (idx % 3 === 1) {
        obstacles.push({ id: `bp1_${idx}`, kind: 'bumper', x, y: 210, w: 46, h: 46, angle: 0, dir: 1 });
        obstacles.push({ id: `bp2_${idx}`, kind: 'bumper', x: x + 65, y: 455, w: 46, h: 46, angle: 0, dir: -1 });
      } else {
        obstacles.push({ id: `cv_${idx}`, kind: 'conveyor', x, y: 175, w: 150, h: 120, angle: 0, dir: 1 });
        obstacles.push({ id: `bs_${idx}`, kind: 'boost', x, y: 410, w: 120, h: 90, angle: 0, dir: 1 });
      }
    }
    return {
      timeLeft: 75,
      trackLength,
      cameraX: 0,
      finishCount: 0,
      obstacles,
      banner: 'BOUNCE, ROLL & BLAST THROUGH THE FINISH GATE!',
      bannerTimer: 2.2,
      popups: [],
      players: ctx.players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 110,
        y: 165 + (i * 350) / Math.max(1, ctx.players.length - 1),
        z: 0,
        vz: 0,
        vx: 0,
        vy: 0,
        rolling: false,
        rollTimer: 0,
        stunTimer: 0,
        finished: false,
        finishRank: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        maxCooldownB: 4.2,
        prevA: false,
        prevB: false,
      })),
    };
  },
  step(state, players, dt, frenzyActive) {
    const sounds: SoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    tickPopups(state.popups, dt);

    for (const obs of state.obstacles) {
      if (obs.kind === 'sweeper') {
        obs.angle += obs.dir * dt * (frenzyActive ? 3.2 : 2.3);
      }
    }

    const inputMap = new Map(players.map((p) => [p.id, p]));
    let maxX = 120;

    for (const sp of state.players) {
      if (sp.finished) continue;
      sp.cooldownA = Math.max(0, sp.cooldownA - dt);
      sp.cooldownB = Math.max(0, sp.cooldownB - dt);
      sp.rollTimer = Math.max(0, sp.rollTimer - dt);
      sp.stunTimer = Math.max(0, sp.stunTimer - dt);
      sp.rolling = sp.rollTimer > 0;

      const inp = inputMap.get(sp.id);
      const mx = inp?.input.moveX ?? 0;
      const my = inp?.input.moveY ?? 0;
      const aNow = Boolean(inp?.input.actionA);
      const bNow = Boolean(inp?.input.actionB);
      const aPressed = aNow && !sp.prevA;
      const bPressed = bNow && !sp.prevB;
      sp.prevA = aNow;
      sp.prevB = bNow;

      if (aPressed && sp.z <= 1 && sp.cooldownA <= 0) {
        sp.vz = 390;
        sp.cooldownA = 0.45;
        sounds.push({ type: 'dash', playerId: sp.id });
      }
      if (bPressed && sp.cooldownB <= 0) {
        sp.rollTimer = 2.0;
        sp.rolling = true;
        const maxCdB = frenzyActive ? 1.8 : 4.2;
        sp.cooldownB = maxCdB;
        sp.maxCooldownB = maxCdB;
        sounds.push({ type: 'score', playerId: sp.id });
      }

      const speed = sp.stunTimer > 0 ? 70 : sp.rolling ? 360 : 230;
      sp.vx += (mx * speed - sp.vx) * Math.min(1, dt * 8);
      sp.vy += (my * speed - sp.vy) * Math.min(1, dt * 8);

      // Jump gravity
      if (sp.z > 0 || sp.vz > 0) {
        sp.z += sp.vz * dt;
        sp.vz -= 1050 * dt;
        if (sp.z < 0) {
          sp.z = 0;
          sp.vz = 0;
        }
      }

      // Obstacle collisions
      for (const obs of state.obstacles) {
        if (obs.kind === 'boost' && sp.x > obs.x - obs.w / 2 && sp.x < obs.x + obs.w / 2 && sp.y > obs.y - obs.h / 2 && sp.y < obs.y + obs.h / 2) {
          sp.vx = Math.max(sp.vx, 420);
        } else if (obs.kind === 'conveyor' && sp.x > obs.x - obs.w / 2 && sp.x < obs.x + obs.w / 2 && sp.y > obs.y - obs.h / 2 && sp.y < obs.y + obs.h / 2) {
          sp.vx += 240 * dt;
        } else if (obs.kind === 'bumper') {
          const d = dist(sp.x, sp.y, obs.x, obs.y);
          if (d < 44 && sp.z < 26) {
            const ang = Math.atan2(sp.y - obs.y, sp.x - obs.x);
            sp.vx = Math.cos(ang) * 340;
            sp.vy = Math.sin(ang) * 340;
            sp.stunTimer = 0.28;
            sounds.push({ type: 'hit', playerId: sp.id });
          }
        } else if (obs.kind === 'sweeper' && sp.z < 24) {
          const d = dist(sp.x, sp.y, obs.x, obs.y);
          if (d < obs.w * 0.55) {
            const barAng = Math.atan2(sp.y - obs.y, sp.x - obs.x);
            const diff = Math.abs(Math.atan2(Math.sin(barAng - obs.angle), Math.cos(barAng - obs.angle)));
            if (diff < 0.28 || Math.abs(diff - Math.PI) < 0.28) {
              sp.vx = -220;
              sp.stunTimer = 0.35;
              sounds.push({ type: 'hit', playerId: sp.id });
            }
          }
        }
      }

      sp.x = clamp(sp.x + sp.vx * dt, 40, state.trackLength + 60);
      sp.y = clamp(sp.y + sp.vy * dt, 120, 560);
      sp.score = Math.max(sp.score, Math.round((sp.x / state.trackLength) * 600));

      if (sp.x >= state.trackLength) {
        sp.finished = true;
        state.finishCount++;
        sp.finishRank = state.finishCount;
        const finishBonus = Math.max(150, 700 - (state.finishCount - 1) * 120) * (frenzyActive ? 2 : 1);
        sp.score += finishBonus;
        state.banner = `${sp.name} FINISHED #${sp.finishRank}!`;
        state.bannerTimer = 2.0;
        sounds.push({ type: 'win', playerId: sp.id });
      }

      if (sp.x > maxX) maxX = sp.x;
    }

    // Egg-to-egg bouncy bumping
    for (let i = 0; i < state.players.length; i++) {
      const a = state.players[i];
      if (a.finished) continue;
      for (let j = i + 1; j < state.players.length; j++) {
        const b = state.players[j];
        if (b.finished) continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d < 38 && d > 0.1) {
          const ux = (b.x - a.x) / d;
          const uy = (b.y - a.y) / d;
          const pushA = b.rolling ? 310 : 140;
          const pushB = a.rolling ? 310 : 140;
          a.vx -= ux * pushA;
          a.vy -= uy * pushA;
          b.vx += ux * pushB;
          b.vy += uy * pushB;
        }
      }
    }

    const targetCam = clamp(maxX - 660, 0, Math.max(0, state.trackLength - ARENA_WIDTH + 180));
    state.cameraX += (targetCam - state.cameraX) * Math.min(1, dt * 4.5);

    const allDone = state.players.every((p) => p.finished);
    return { finished: state.timeLeft <= 0 || allDone, sounds };
  },
  snapshot(state): EggRushSnapshot {
    return {
      gameId: 'egg-rush',
      timeLeft: state.timeLeft,
      trackLength: state.trackLength,
      cameraX: state.cameraX,
      obstacles: state.obstacles
        .filter((o) => o.x >= state.cameraX - 220 && o.x <= state.cameraX + ARENA_WIDTH + 220)
        .map((o) => ({ ...o })),
      banner: state.banner,
      popups: state.popups.map((p) => ({ ...p })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        z: p.z,
        rolling: p.rolling,
        rollTimer: p.rollTimer,
        stunTimer: p.stunTimer,
        finished: p.finished,
        finishRank: p.finishRank,
        progressPct: Math.min(100, Math.round((p.x / state.trackLength) * 100)),
        score: p.score,
        cooldownA: clamp(p.cooldownA / 0.45, 0, 1),
        cooldownB: clamp(p.cooldownB / Math.max(0.1, p.maxCooldownB || 4.2), 0, 1),
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        score: p.score,
        stat: p.finished ? `Finished #${p.finishRank}` : `${Math.round((p.x / state.trackLength) * 100)}% Track`,
      }))
    );
  },
};

// ============================================================
// 64. GOOSE ALERT (鹅鸭杀)
// ============================================================
interface GoosePlayerSim {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  role: 'goose' | 'duck';
  x: number;
  y: number;
  angle: number;
  alive: boolean;
  honkWaveTimer: number;
  revealedTimer: number;
  tasksDone: number;
  tags: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
  maxCooldownB: number;
  prevB: boolean;
}

interface GooseAlertState {
  timeLeft: number;
  stations: GooseTaskStation[];
  sabotageTimer: number;
  banner: string | null;
  bannerTimer: number;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: GoosePlayerSim[];
}

export const gooseAlertModule: ServerGameModule<GooseAlertState, GooseAlertSnapshot> = {
  id: 'goose-alert',
  init(ctx): GooseAlertState {
    const totalTime = ctx.settingValue || 90;
    const duckCount = ctx.players.length >= 6 ? 2 : 1;
    const shuffled = [...ctx.players].sort(() => Math.random() - 0.5);
    const duckIds = new Set(shuffled.slice(0, duckCount).map((p) => p.id));

    const stations: GooseTaskStation[] = [
      { id: 'st_1', x: 220, y: 170, label: 'KITCHEN', completed: false, progress: 0 },
      { id: 'st_2', x: 960, y: 170, label: 'LIBRARY', completed: false, progress: 0 },
      { id: 'st_3', x: 220, y: 510, label: 'BOILER', completed: false, progress: 0 },
      { id: 'st_4', x: 960, y: 510, label: 'GARDEN', completed: false, progress: 0 },
      { id: 'st_5', x: 590, y: 340, label: 'BELL TOWER', completed: false, progress: 0 },
      { id: 'st_6', x: 590, y: 140, label: 'VAULT', completed: false, progress: 0 },
    ];

    return {
      timeLeft: totalTime,
      stations,
      sabotageTimer: 0,
      banner: 'GEESE: REPAIR ALL 6 STATIONS! DUCKS: STRIKE IN STEALTH!',
      bannerTimer: 2.5,
      popups: [],
      players: ctx.players.map((p, i) => {
        const ang = (i / Math.max(1, ctx.players.length)) * Math.PI * 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          role: duckIds.has(p.id) ? 'duck' : 'goose',
          x: ARENA_WIDTH / 2 + Math.cos(ang) * 140,
          y: ARENA_HEIGHT / 2 + Math.sin(ang) * 110,
          angle: ang,
          alive: true,
          honkWaveTimer: 0,
          revealedTimer: 0,
          tasksDone: 0,
          tags: 0,
          score: 0,
          cooldownA: 0,
          cooldownB: duckIds.has(p.id) ? 1.5 : 1.0,
          maxCooldownB: duckIds.has(p.id) ? 1.5 : 1.0,
          prevB: false,
        };
      }),
    };
  },
  step(state, players, dt, frenzyActive) {
    const sounds: SoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.sabotageTimer = Math.max(0, state.sabotageTimer - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    tickPopups(state.popups, dt);
    const inputMap = new Map(players.map((p) => [p.id, p]));

    for (const sp of state.players) {
      if (!sp.alive) continue;
      sp.cooldownA = Math.max(0, sp.cooldownA - dt);
      sp.cooldownB = Math.max(0, sp.cooldownB - dt);
      sp.honkWaveTimer = Math.max(0, sp.honkWaveTimer - dt);
      sp.revealedTimer = Math.max(0, sp.revealedTimer - dt);

      const inp = inputMap.get(sp.id);
      const mx = inp?.input.moveX ?? 0;
      const my = inp?.input.moveY ?? 0;
      const aNow = Boolean(inp?.input.actionA);
      const bNow = Boolean(inp?.input.actionB);
      const bPressed = bNow && !sp.prevB;
      sp.prevB = bNow;

      const speed = sp.role === 'duck' ? 245 : 225;
      sp.x = clamp(sp.x + mx * speed * dt, 70, ARENA_WIDTH - 70);
      sp.y = clamp(sp.y + my * speed * dt, 80, ARENA_HEIGHT - 80);
      if (Math.hypot(mx, my) > 0.15) sp.angle = Math.atan2(my, mx);

      // Geese repair stations by holding A; Ducks fake-repair & sabotage stations by holding A
      if (aNow) {
        for (const st of state.stations) {
          if (st.completed) continue;
          if (dist(sp.x, sp.y, st.x, st.y) < 70) {
            if (sp.role === 'goose') {
              st.progress = Math.min(1, st.progress + dt * (frenzyActive ? 0.85 : 0.55));
              if (st.progress >= 1) {
                st.completed = true;
                sp.tasksDone++;
                const pts = frenzyActive ? 320 : 180;
                sp.score += pts;
                sounds.push({ type: 'score', playerId: sp.id });
                state.popups.push({ x: st.x, y: st.y - 26, text: `${st.label} FIXED!`, colorHex: '#10D98B', alpha: 1 });
              }
            } else if (st.progress > 0.05) {
              const prevProg = st.progress;
              st.progress = Math.max(0, st.progress - dt * 0.35);
              if (sp.cooldownA <= 0 && prevProg > st.progress) {
                sp.cooldownA = 1.6;
                sp.score += frenzyActive ? 40 : 20;
                sounds.push({ type: 'tick', playerId: sp.id });
                state.popups.push({ x: st.x, y: st.y - 26, text: 'SABOTAGE!', colorHex: '#FB923C', alpha: 1 });
              }
            }
          }
        }
      }

      // Action B: Geese HONK radar scan; Ducks STRIKE nearby Goose!
      if (bPressed && sp.cooldownB <= 0) {
        if (sp.role === 'goose') {
          sp.honkWaveTimer = 0.65;
          const maxCdB = frenzyActive ? 3.5 : 5.5;
          sp.cooldownB = maxCdB;
          sp.maxCooldownB = maxCdB;
          const scanR = frenzyActive ? 290 : 210;
          sounds.push({ type: 'tick', playerId: sp.id });
          for (const other of state.players) {
            if (other.alive && other.role === 'duck' && dist(sp.x, sp.y, other.x, other.y) <= scanR) {
              other.revealedTimer = 3.2;
              sp.score += 75;
              state.popups.push({ x: other.x, y: other.y - 30, text: 'DUCK SPOTTED!', colorHex: '#FB923C', alpha: 1 });
            }
          }
        } else {
          // Duck stealth strike!
          const victim = state.players
            .filter((o) => o.alive && o.role === 'goose')
            .sort((a, b) => dist(sp.x, sp.y, a.x, a.y) - dist(sp.x, sp.y, b.x, b.y))[0];
          if (victim && dist(sp.x, sp.y, victim.x, victim.y) <= 68) {
            victim.alive = false;
            sp.tags++;
            sp.revealedTimer = 1.6;
            sp.score += frenzyActive ? 380 : 240;
            sp.cooldownB = 3.4;
            sp.maxCooldownB = 3.4;
            sounds.push({ type: 'elim', playerId: victim.id });
            state.popups.push({ x: victim.x, y: victim.y - 24, text: 'QUACKED!', colorHex: '#EF4444', alpha: 1 });
          } else {
            sp.cooldownB = 1.0;
            sp.maxCooldownB = 1.0;
          }
        }
      }
    }

    const completedCount = state.stations.filter((s) => s.completed).length;
    const aliveGeese = state.players.filter((p) => p.alive && p.role === 'goose').length;
    let finished = false;
    if (completedCount >= state.stations.length) {
      for (const p of state.players) if (p.role === 'goose') p.score += 350;
      state.banner = 'GEESE WIN! MANOR SECURED!';
      finished = true;
    } else if (aliveGeese === 0) {
      for (const p of state.players) if (p.role === 'duck') p.score += 450;
      state.banner = 'DUCKS WIN! FLOCK ELIMINATED!';
      finished = true;
    } else if (state.timeLeft <= 0) {
      finished = true;
    }
    return { finished, sounds };
  },
  snapshot(state): GooseAlertSnapshot {
    return {
      gameId: 'goose-alert',
      timeLeft: state.timeLeft,
      totalTasks: state.stations.length,
      completedTasks: state.stations.filter((s) => s.completed).length,
      sabotageTimer: state.sabotageTimer,
      stations: state.stations.map((s) => ({ ...s })),
      banner: state.banner,
      popups: state.popups.map((p) => ({ ...p })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        role: p.role,
        x: p.x,
        y: p.y,
        angle: p.angle,
        alive: p.alive,
        honkWaveTimer: p.honkWaveTimer,
        revealedDuck: p.revealedTimer > 0,
        tasksDone: p.tasksDone,
        tags: p.tags,
        score: p.score,
        cooldownA: clamp(p.cooldownA / 1.6, 0, 1),
        cooldownB: clamp(p.cooldownB / Math.max(0.1, p.maxCooldownB || 3.4), 0, 1),
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        score: p.score,
        stat: p.role === 'duck' ? `Duck · ${p.tags} Strikes` : `Goose · ${p.tasksDone} Tasks`,
      }))
    );
  },
};

// ============================================================
// 65. HOTPOT RUSH (火锅夹菜王)
// ============================================================
interface HotpotIngredientSim extends HotpotIngredient {
  orbitAngle: number;
  orbitDist: number;
  orbitSpeed: number;
}

interface HotpotPlayerSim {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  seatAngle: number;
  tipX: number;
  tipY: number;
  snatchTimer: number;
  parryTimer: number;
  spicyBurnTimer: number;
  bites: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
  prevA: boolean;
  prevB: boolean;
}

interface HotpotRushState {
  timeLeft: number;
  totalTime: number;
  potX: number;
  potY: number;
  potR: number;
  ingredients: HotpotIngredientSim[];
  bubbles: { x: number; y: number; r: number; broth: 'mala' | 'golden'; alpha: number }[];
  banner: string | null;
  bannerTimer: number;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: HotpotPlayerSim[];
  seq: number;
}

function spawnIngredient(state: HotpotRushState, frenzy: boolean): HotpotIngredientSim {
  const roll = Math.random();
  const kind: HotpotIngredient['kind'] =
    roll > (frenzy ? 0.72 : 0.86)
      ? 'golden-ball'
      : roll > 0.68
      ? 'chili'
      : roll > 0.48
      ? 'beef'
      : roll > 0.3
      ? 'shrimp'
      : roll > 0.14
      ? 'dumpling'
      : 'mushroom';
  const ang = Math.random() * Math.PI * 2;
  const rad = 36 + Math.random() * (state.potR - 64);
  const x = state.potX + Math.cos(ang) * rad;
  const y = state.potY + Math.sin(ang) * rad;
  const value =
    kind === 'golden-ball' ? 160 : kind === 'beef' ? 110 : kind === 'shrimp' ? 90 : kind === 'dumpling' ? 85 : kind === 'mushroom' ? 65 : -80;
  return {
    id: `hp_${state.seq++}`,
    x,
    y,
    kind,
    broth: x < state.potX ? 'mala' : 'golden',
    cookPct: kind === 'chili' ? 75 : 20 + Math.random() * 25,
    value,
    r: kind === 'golden-ball' ? 20 : kind === 'beef' ? 19 : 16,
    orbitAngle: ang,
    orbitDist: rad,
    orbitSpeed: (Math.random() > 0.5 ? 1 : -1) * (0.28 + Math.random() * 0.35),
  };
}

export const hotpotRushModule: ServerGameModule<HotpotRushState, HotpotRushSnapshot> = {
  id: 'hotpot-rush',
  init(ctx): HotpotRushState {
    const totalTime = ctx.settingValue || 90;
    const st: HotpotRushState = {
      timeLeft: totalTime,
      totalTime,
      potX: ARENA_WIDTH / 2,
      potY: ARENA_HEIGHT / 2 + 12,
      potR: 225,
      ingredients: [],
      bubbles: [],
      banner: 'SNATCH GOLDEN COOKED WAGYU — DODGE FIERY CHILIES!',
      bannerTimer: 2.3,
      popups: [],
      players: ctx.players.map((p, i) => {
        const ang = (i / Math.max(1, ctx.players.length)) * Math.PI * 2 - Math.PI / 2;
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          seatAngle: ang,
          tipX: ARENA_WIDTH / 2 + Math.cos(ang) * 115,
          tipY: ARENA_HEIGHT / 2 + 12 + Math.sin(ang) * 115,
          snatchTimer: 0,
          parryTimer: 0,
          spicyBurnTimer: 0,
          bites: 0,
          score: 0,
          cooldownA: 0,
          cooldownB: 0,
          prevA: false,
          prevB: false,
        };
      }),
      seq: 1,
    };
    for (let i = 0; i < 14; i++) st.ingredients.push(spawnIngredient(st, false));
    return st;
  },
  step(state, players, dt, frenzyActive) {
    const sounds: SoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    tickPopups(state.popups, dt);

    // Simmer bubbles
    if (Math.random() < dt * 16) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * (state.potR - 28);
      const bx = state.potX + Math.cos(a) * d;
      state.bubbles.push({
        x: bx,
        y: state.potY + Math.sin(a) * d,
        r: 4 + Math.random() * 8,
        broth: bx < state.potX ? 'mala' : 'golden',
        alpha: 0.85,
      });
    }
    for (let i = state.bubbles.length - 1; i >= 0; i--) {
      state.bubbles[i].r += dt * 14;
      state.bubbles[i].alpha -= dt * 1.4;
      if (state.bubbles[i].alpha <= 0) state.bubbles.splice(i, 1);
    }

    // Swirl & cook ingredients
    for (let i = state.ingredients.length - 1; i >= 0; i--) {
      const ing = state.ingredients[i];
      ing.orbitAngle += ing.orbitSpeed * dt;
      ing.x = state.potX + Math.cos(ing.orbitAngle) * ing.orbitDist;
      ing.y = state.potY + Math.sin(ing.orbitAngle) * ing.orbitDist;
      ing.broth = ing.x < state.potX ? 'mala' : 'golden';
      if (ing.kind !== 'chili') {
        ing.cookPct += dt * 9.5;
        if (ing.cookPct > 112) state.ingredients.splice(i, 1);
      }
    }
    while (state.ingredients.length < (frenzyActive ? 17 : 13)) {
      state.ingredients.push(spawnIngredient(state, frenzyActive));
    }

    const inputMap = new Map(players.map((p) => [p.id, p]));
    for (const sp of state.players) {
      sp.cooldownA = Math.max(0, sp.cooldownA - dt);
      sp.cooldownB = Math.max(0, sp.cooldownB - dt);
      sp.snatchTimer = Math.max(0, sp.snatchTimer - dt);
      sp.parryTimer = Math.max(0, sp.parryTimer - dt);
      sp.spicyBurnTimer = Math.max(0, sp.spicyBurnTimer - dt);

      const inp = inputMap.get(sp.id);
      const mx = inp?.input.moveX ?? 0;
      const my = inp?.input.moveY ?? 0;
      const aNow = Boolean(inp?.input.actionA);
      const bNow = Boolean(inp?.input.actionB);
      const aPressed = aNow && !sp.prevA;
      const bPressed = bNow && !sp.prevB;
      sp.prevA = aNow;
      sp.prevB = bNow;

      const moveSpeed = sp.spicyBurnTimer > 0 ? 110 : 320;
      sp.tipX += mx * moveSpeed * dt;
      sp.tipY += my * moveSpeed * dt;
      const dPot = dist(sp.tipX, sp.tipY, state.potX, state.potY);
      if (dPot > state.potR - 14) {
        const ang = Math.atan2(sp.tipY - state.potY, sp.tipX - state.potX);
        sp.tipX = state.potX + Math.cos(ang) * (state.potR - 14);
        sp.tipY = state.potY + Math.sin(ang) * (state.potR - 14);
      }

      // Snatch food
      if (aPressed && sp.cooldownA <= 0 && sp.spicyBurnTimer <= 0) {
        sp.snatchTimer = 0.25;
        sp.cooldownA = 0.34;
        const targetIdx = state.ingredients.findIndex((ing) => dist(sp.tipX, sp.tipY, ing.x, ing.y) <= ing.r + 22);
        if (targetIdx >= 0) {
          const ing = state.ingredients.splice(targetIdx, 1)[0];
          if (ing.kind === 'chili') {
            sp.spicyBurnTimer = 1.6;
            sp.score = Math.max(0, sp.score - 60);
            sounds.push({ type: 'hit', playerId: sp.id });
            state.popups.push({ x: ing.x, y: ing.y, text: 'SO SPICY! -60', colorHex: '#EF4444', alpha: 1 });
          } else {
            const perfect = ing.cookPct >= 55 && ing.cookPct <= 95;
            const pts = ing.value * (perfect ? 2 : 1) * (frenzyActive ? 2 : 1);
            sp.score += pts;
            sp.bites++;
            sounds.push({ type: 'score', playerId: sp.id });
            state.popups.push({
              x: ing.x,
              y: ing.y,
              text: perfect ? `PERFECT +${pts}!` : `+${pts}`,
              colorHex: perfect ? '#FACC15' : '#4ADE80',
              alpha: 1,
            });
          }
        } else {
          sounds.push({ type: 'tick', playerId: sp.id });
        }
      }

      // Chopstick parry knocks nearby rival chopsticks outward!
      if (bPressed && sp.cooldownB <= 0) {
        sp.parryTimer = 0.35;
        sp.cooldownB = 2.0;
        sounds.push({ type: 'dash', playerId: sp.id });
        for (const other of state.players) {
          if (other.id === sp.id) continue;
          const d = dist(sp.tipX, sp.tipY, other.tipX, other.tipY);
          if (d < 85) {
            const ang = Math.atan2(other.tipY - sp.tipY, other.tipX - sp.tipX);
            other.tipX += Math.cos(ang) * 90;
            other.tipY += Math.sin(ang) * 90;
            sounds.push({ type: 'hit', playerId: other.id });
          }
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state): HotpotRushSnapshot {
    return {
      gameId: 'hotpot-rush',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      potX: state.potX,
      potY: state.potY,
      potR: state.potR,
      ingredients: state.ingredients.map((i) => ({
        id: i.id,
        x: i.x,
        y: i.y,
        kind: i.kind,
        broth: i.broth,
        cookPct: i.cookPct,
        value: i.value,
        r: i.r,
      })),
      bubbles: state.bubbles.map((b) => ({ ...b })),
      banner: state.banner,
      popups: state.popups.map((p) => ({ ...p })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        seatAngle: p.seatAngle,
        tipX: p.tipX,
        tipY: p.tipY,
        snatchTimer: p.snatchTimer,
        parryTimer: p.parryTimer,
        spicyBurnTimer: p.spicyBurnTimer,
        bites: p.bites,
        score: p.score,
        cooldownA: clamp(p.cooldownA / 0.34, 0, 1),
        cooldownB: clamp(p.cooldownB / 2.0, 0, 1),
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        score: p.score,
        stat: `${p.bites} Bites · ${p.score} pts`,
      }))
    );
  },
};

// ============================================================
// 66. CLAW MANIA (娃娃机大作战)
// ============================================================
interface ClawPrizeSim extends ClawPrizeItem {
  vx: number;
}

interface ClawPlayerSim {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  x: number;
  y: number;
  clawState: 'aim' | 'drop' | 'lift';
  clawDepth: number;
  grabbedPrizeId: string | null;
  magnetTimer: number;
  prizesWon: number;
  score: number;
  cooldownA: number;
  cooldownB: number;
  maxCooldownB: number;
  prevA: boolean;
  prevB: boolean;
}

interface ClawManiaState {
  timeLeft: number;
  totalTime: number;
  binX: number;
  binY: number;
  binW: number;
  binH: number;
  prizes: ClawPrizeSim[];
  banner: string | null;
  bannerTimer: number;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: ClawPlayerSim[];
  seq: number;
}

function spawnClawPrize(st: ClawManiaState, frenzy: boolean): ClawPrizeSim {
  const roll = Math.random();
  const kind: ClawPrizeItem['kind'] =
    roll > (frenzy ? 0.72 : 0.87)
      ? 'dragon'
      : roll > 0.7
      ? 'bomb'
      : roll > 0.45
      ? 'capsule'
      : roll > 0.22
      ? 'bear'
      : 'duck';
  const colors: Record<ClawPrizeItem['kind'], string> = {
    dragon: '#FACC15',
    capsule: '#38BDF8',
    bear: '#F472B6',
    duck: '#FB923C',
    bomb: '#334155',
  };
  const values: Record<ClawPrizeItem['kind'], number> = {
    dragon: 260,
    capsule: 130,
    bear: 100,
    duck: 90,
    bomb: -110,
  };
  const row = Math.floor(Math.random() * 3);
  const y = st.binY + 75 + row * 125;
  const dir = row % 2 === 0 ? 1 : -1;
  return {
    id: `cp_${st.seq++}`,
    x: st.binX + 50 + Math.random() * (st.binW - 100),
    y,
    kind,
    colorHex: colors[kind],
    value: values[kind],
    r: kind === 'dragon' ? 24 : 20,
    grabbedBy: null,
    vx: dir * (58 + row * 22),
  };
}

export const clawManiaModule: ServerGameModule<ClawManiaState, ClawManiaSnapshot> = {
  id: 'claw-mania',
  init(ctx): ClawManiaState {
    const totalTime = ctx.settingValue || 90;
    const st: ClawManiaState = {
      timeLeft: totalTime,
      totalTime,
      binX: 110,
      binY: 135,
      binW: ARENA_WIDTH - 220,
      binH: 430,
      prizes: [],
      banner: 'DROP YOUR CLAW ON GOLDEN DRAGONS & PLUSHIES!',
      bannerTimer: 2.3,
      popups: [],
      players: ctx.players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 200 + (i * (ARENA_WIDTH - 400)) / Math.max(1, ctx.players.length - 1),
        y: 340,
        clawState: 'aim',
        clawDepth: 0,
        grabbedPrizeId: null,
        magnetTimer: 0,
        prizesWon: 0,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        maxCooldownB: 8.0,
        prevA: false,
        prevB: false,
      })),
      seq: 1,
    };
    for (let i = 0; i < 15; i++) st.prizes.push(spawnClawPrize(st, false));
    return st;
  },
  step(state, players, dt, frenzyActive) {
    const sounds: SoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    tickPopups(state.popups, dt);

    // Move conveyor prizes
    for (const pr of state.prizes) {
      if (pr.grabbedBy) continue;
      pr.x += pr.vx * dt;
      if (pr.x < state.binX + 32) pr.x = state.binX + state.binW - 32;
      if (pr.x > state.binX + state.binW - 32) pr.x = state.binX + 32;
    }
    while (state.prizes.length < 15) state.prizes.push(spawnClawPrize(state, frenzyActive));

    const inputMap = new Map(players.map((p) => [p.id, p]));
    for (const sp of state.players) {
      sp.cooldownA = Math.max(0, sp.cooldownA - dt);
      sp.cooldownB = Math.max(0, sp.cooldownB - dt);
      sp.magnetTimer = Math.max(0, sp.magnetTimer - dt);

      const inp = inputMap.get(sp.id);
      const mx = inp?.input.moveX ?? 0;
      const my = inp?.input.moveY ?? 0;
      const aNow = Boolean(inp?.input.actionA);
      const bNow = Boolean(inp?.input.actionB);
      const aPressed = aNow && !sp.prevA;
      const bPressed = bNow && !sp.prevB;
      sp.prevA = aNow;
      sp.prevB = bNow;

      if (bPressed && sp.cooldownB <= 0) {
        sp.magnetTimer = 4.2;
        const maxCdB = frenzyActive ? 5.0 : 8.0;
        sp.cooldownB = maxCdB;
        sp.maxCooldownB = maxCdB;
        sounds.push({ type: 'dash', playerId: sp.id });
      }

      if (sp.clawState === 'aim') {
        sp.x = clamp(sp.x + mx * 340 * dt, state.binX + 34, state.binX + state.binW - 34);
        sp.y = clamp(sp.y + my * 340 * dt, state.binY + 34, state.binY + state.binH - 34);
        if (aPressed && sp.cooldownA <= 0) {
          sp.clawState = 'drop';
          sp.clawDepth = 0;
          sounds.push({ type: 'tick', playerId: sp.id });
        }
      } else if (sp.clawState === 'drop') {
        sp.clawDepth = Math.min(1, sp.clawDepth + dt * 3.1);
        if (sp.clawDepth >= 1) {
          const grabR = sp.magnetTimer > 0 || frenzyActive ? 54 : 34;
          const hit = state.prizes
            .filter((p) => !p.grabbedBy)
            .sort((a, b) => dist(sp.x, sp.y, a.x, a.y) - dist(sp.x, sp.y, b.x, b.y))[0];
          if (hit && dist(sp.x, sp.y, hit.x, hit.y) <= grabR) {
            hit.grabbedBy = sp.id;
            sp.grabbedPrizeId = hit.id;
          }
          sp.clawState = 'lift';
        }
      } else if (sp.clawState === 'lift') {
        sp.clawDepth = Math.max(0, sp.clawDepth - dt * 2.5);
        const grabbed = sp.grabbedPrizeId ? state.prizes.find((p) => p.id === sp.grabbedPrizeId) : null;
        if (grabbed) {
          grabbed.x = sp.x;
          grabbed.y = sp.y;
        }
        if (sp.clawDepth <= 0) {
          if (grabbed) {
            state.prizes = state.prizes.filter((p) => p.id !== grabbed.id);
            if (grabbed.kind === 'bomb') {
              sp.score = Math.max(0, sp.score - 100);
              sounds.push({ type: 'hit', playerId: sp.id });
              state.popups.push({ x: sp.x, y: sp.y, text: 'BOOM! -100', colorHex: '#EF4444', alpha: 1 });
            } else {
              const pts = grabbed.value * (frenzyActive ? 2 : 1);
              sp.score += pts;
              sp.prizesWon++;
              sounds.push({ type: 'score', playerId: sp.id });
              state.popups.push({
                x: sp.x,
                y: sp.y,
                text: grabbed.kind === 'dragon' ? `GOLD DRAGON +${pts}!` : `+${pts}`,
                colorHex: grabbed.kind === 'dragon' ? '#FACC15' : '#E879F9',
                alpha: 1,
              });
            }
          }
          sp.grabbedPrizeId = null;
          sp.clawState = 'aim';
          sp.cooldownA = 0.25;
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state): ClawManiaSnapshot {
    return {
      gameId: 'claw-mania',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      binX: state.binX,
      binY: state.binY,
      binW: state.binW,
      binH: state.binH,
      prizes: state.prizes.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        kind: p.kind,
        colorHex: p.colorHex,
        value: p.value,
        r: p.r,
        grabbedBy: p.grabbedBy,
      })),
      banner: state.banner,
      popups: state.popups.map((p) => ({ ...p })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        clawState: p.clawState,
        clawDepth: p.clawDepth,
        magnetTimer: p.magnetTimer,
        prizesWon: p.prizesWon,
        score: p.score,
        cooldownA: clamp(p.cooldownA / 0.25, 0, 1),
        cooldownB: clamp(p.cooldownB / Math.max(0.1, p.maxCooldownB || 8.0), 0, 1),
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        score: p.score,
        stat: `${p.prizesWon} Prizes`,
      }))
    );
  },
};

// ============================================================
// 67. TRUTH BOMB (真心话大冒险轮盘)
// ============================================================
const TRUTH_DARE_DECK: { kind: 'TRUTH' | 'DARE'; en: string; zh: string }[] = [
  { kind: 'TRUTH', en: 'What is the funniest text you sent to the wrong person?', zh: '你发错过最社死的一条消息是什么？' },
  { kind: 'DARE', en: 'Do your best 5-second movie villain laugh out loud!', zh: '现场大笑 5 秒，演一段反派经典狂笑！' },
  { kind: 'TRUTH', en: 'Which food could you happily eat every single day?', zh: '哪一种美食让你天天吃都不会腻？' },
  { kind: 'DARE', en: 'Give the player on your left an Oscar-worthy compliment!', zh: '给左手边的玩家来一段奥斯卡级别的花式夸赞！' },
  { kind: 'TRUTH', en: 'What childhood game were you secretly undefeated at?', zh: '小时候你最拿手、几乎没输过的游戏是什么？' },
  { kind: 'DARE', en: 'Strike your coolest superhero pose and hold it for 5 seconds!', zh: '摆一个最帅气的超级英雄姿势定格 5 秒！' },
  { kind: 'TRUTH', en: 'If you won RM1,000,000 tonight, what is your first purchase?', zh: '今晚突然中奖一百万，你第一件想买什么？' },
  { kind: 'DARE', en: 'Hum the chorus of a famous song until someone guesses it!', zh: '哼唱一首经典副歌，让在场好友猜出来！' },
];

interface TruthBombPlayerSim {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  seatAngle: number;
  daresCompleted: number;
  votedThisRound: boolean;
  score: number;
  cooldownA: number;
  cooldownB: number;
  prevA: boolean;
  prevB: boolean;
}

interface TruthBombState {
  round: number;
  totalRounds: number;
  phase: 'pass' | 'challenge' | 'result';
  fuseLeft: number;
  fuseMax: number;
  wheelAngle: number;
  holderIdx: number;
  challengeKind: 'TRUTH' | 'DARE' | null;
  challengeEn: string | null;
  challengeZh: string | null;
  doubleStakes: boolean;
  phaseTimer: number;
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: TruthBombPlayerSim[];
}

export const truthBombModule: ServerGameModule<TruthBombState, TruthBombSnapshot> = {
  id: 'truth-bomb',
  init(ctx): TruthBombState {
    const totalRounds = ctx.settingValue || 5;
    const fuse = 7 + Math.random() * 5;
    return {
      round: 1,
      totalRounds,
      phase: 'pass',
      fuseLeft: fuse,
      fuseMax: fuse,
      wheelAngle: 0,
      holderIdx: 0,
      challengeKind: null,
      challengeEn: null,
      challengeZh: null,
      doubleStakes: false,
      phaseTimer: fuse,
      banner: 'PASS THE BOMB BEFORE IT BLOWS!',
      popups: [],
      players: ctx.players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        seatAngle: (i / Math.max(1, ctx.players.length)) * Math.PI * 2 - Math.PI / 2,
        daresCompleted: 0,
        votedThisRound: false,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        prevA: false,
        prevB: false,
      })),
    };
  },
  step(state, players, dt, frenzyActive) {
    const sounds: SoundEvent[] = [];
    tickPopups(state.popups, dt);
    const inputMap = new Map(players.map((p) => [p.id, p]));
    const n = state.players.length;

    for (const sp of state.players) {
      sp.cooldownA = Math.max(0, sp.cooldownA - dt);
      sp.cooldownB = Math.max(0, sp.cooldownB - dt);
    }

    if (state.phase === 'pass') {
      state.wheelAngle += dt * (frenzyActive ? 3.4 : 2.1);
      state.fuseLeft -= dt * (frenzyActive ? 1.35 : 1.0);
      state.phaseTimer = Math.max(0, state.fuseLeft);

      const holder = state.players[state.holderIdx];
      const inp = holder ? inputMap.get(holder.id) : undefined;
      const aNow = Boolean(inp?.input.actionA);
      const bNow = Boolean(inp?.input.actionB);
      const aPressed = aNow && !holder.prevA;
      const bPressed = bNow && !holder.prevB;
      if (holder) {
        holder.prevA = aNow;
        holder.prevB = bNow;
      }

      if (holder && (aPressed || bPressed) && holder.cooldownA <= 0) {
        if (bPressed) {
          state.doubleStakes = true;
          holder.score += 40;
        }
        holder.score += 20;
        holder.cooldownA = 0.45;
        state.holderIdx = (state.holderIdx + 1 + Math.floor(Math.random() * Math.max(1, n - 1))) % n;
        sounds.push({ type: 'dash', playerId: holder.id });
      }

      if (state.fuseLeft <= 0) {
        const card = TRUTH_DARE_DECK[Math.floor(Math.random() * TRUTH_DARE_DECK.length)];
        state.phase = 'challenge';
        state.challengeKind = card.kind;
        state.challengeEn = card.en;
        state.challengeZh = card.zh;
        state.phaseTimer = 11.0;
        for (const p of state.players) p.votedThisRound = false;
        state.banner = `BOOM! ${state.players[state.holderIdx].name} — ${card.kind}!`;
        sounds.push({ type: 'hit', playerId: state.players[state.holderIdx].id });
      }
    } else if (state.phase === 'challenge') {
      state.phaseTimer -= dt;
      const holder = state.players[state.holderIdx];
      for (const sp of state.players) {
        const inp = inputMap.get(sp.id);
        const aNow = Boolean(inp?.input.actionA);
        const aPressed = aNow && !sp.prevA;
        sp.prevA = aNow;
        if (aPressed && !sp.votedThisRound && (sp.id !== holder.id || n <= 1)) {
          sp.votedThisRound = true;
          sounds.push({ type: 'tick', playerId: sp.id });
        }
      }
      const votes = state.players.filter((p) => p.votedThisRound).length;
      const needed = Math.max(1, Math.ceil((n - 1) * 0.5));
      if (votes >= needed || state.phaseTimer <= 0) {
        const reward = (state.doubleStakes || frenzyActive ? 320 : 180);
        holder.score += reward;
        holder.daresCompleted++;
        state.phase = 'result';
        state.phaseTimer = 2.4;
        state.banner = `${holder.name} NAILED IT! +${reward} PTS!`;
        sounds.push({ type: 'score', playerId: holder.id });
      }
    } else {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        if (state.round >= state.totalRounds) {
          return { finished: true, sounds };
        }
        state.round++;
        const fuse = 6.5 + Math.random() * 5;
        state.fuseLeft = fuse;
        state.fuseMax = fuse;
        state.phase = 'pass';
        state.doubleStakes = false;
        state.challengeKind = null;
        state.challengeEn = null;
        state.challengeZh = null;
        state.banner = `ROUND ${state.round}/${state.totalRounds} — PASS FAST!`;
      }
    }

    return { finished: false, sounds };
  },
  snapshot(state): TruthBombSnapshot {
    const holder = state.players[state.holderIdx] ?? state.players[0];
    const votesDone = state.players.filter((p) => p.votedThisRound).length;
    const votesNeeded = Math.max(1, Math.ceil((state.players.length - 1) * 0.5));
    return {
      gameId: 'truth-bomb',
      round: state.round,
      totalRounds: state.totalRounds,
      phase: state.phase,
      fuseRatio: clamp(state.fuseLeft / Math.max(0.1, state.fuseMax), 0, 1),
      wheelAngle: state.wheelAngle,
      holderId: holder.id,
      challengeKind: state.challengeKind,
      challengeEn: state.challengeEn,
      challengeZh: state.challengeZh,
      doubleStakes: state.doubleStakes,
      votesDone,
      votesNeeded,
      phaseTimer: Math.max(0, state.phaseTimer),
      banner: state.banner,
      popups: state.popups.map((p) => ({ ...p })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        seatAngle: p.seatAngle,
        hasBomb: p.id === holder.id,
        daresCompleted: p.daresCompleted,
        score: p.score,
        cooldownA: clamp(p.cooldownA / 0.45, 0, 1),
        cooldownB: 0,
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        score: p.score,
        stat: `${p.daresCompleted} Challenges`,
      }))
    );
  },
};

// ============================================================
// 68. DRAW & GUESS RELAY (你画我猜)
// ============================================================
const SKETCH_PROMPTS: { en: string; zh: string }[] = [
  { en: 'Watermelon', zh: '大西瓜' },
  { en: 'Hotpot', zh: '鸳鸯火锅' },
  { en: 'Rocket', zh: '火箭' },
  { en: 'Cat', zh: '小猫咪' },
  { en: 'Bubble Tea', zh: '珍珠奶茶' },
  { en: 'Dragon', zh: '中国龙' },
  { en: 'Pizza', zh: '披萨' },
  { en: 'Snowman', zh: '雪人' },
  { en: 'Crown', zh: '皇冠' },
  { en: 'Umbrella', zh: '雨伞' },
  { en: 'Guitar', zh: '吉他' },
  { en: 'Panda', zh: '大熊猫' },
];
const BRUSH_COLORS = ['#111827', '#EF4444', '#2563EB', '#10B981', '#F59E0B', '#9333EA'];

interface DrawGuessPlayerSim {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  cursorOption: number;
  guessedCorrect: boolean;
  lockedGuess: boolean;
  score: number;
  cooldownA: number;
  cooldownB: number;
  navCooldown: number;
  prevA: boolean;
  prevB: boolean;
}

interface DrawGuessState {
  round: number;
  totalRounds: number;
  artistIdx: number;
  brushX: number;
  brushY: number;
  colorIdx: number;
  isDrawing: boolean;
  strokes: DrawStrokePoint[];
  options: { en: string; zh: string }[];
  correctIndex: number;
  phase: 'drawing' | 'reveal';
  timeLeft: number;
  banner: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: DrawGuessPlayerSim[];
}

function setupSketchRound(state: DrawGuessState) {
  const pool = [...SKETCH_PROMPTS].sort(() => Math.random() - 0.5).slice(0, 4);
  state.options = pool;
  state.correctIndex = Math.floor(Math.random() * 4);
  state.strokes = [];
  state.brushX = 420;
  state.brushY = 340;
  state.isDrawing = false;
  state.phase = 'drawing';
  state.timeLeft = 22;
  for (const p of state.players) {
    p.guessedCorrect = false;
    p.lockedGuess = false;
    p.cursorOption = 0;
  }
  const artist = state.players[state.artistIdx];
  state.banner = `${artist.name} IS DRAWING: ${pool[state.correctIndex].en.toUpperCase()} (${pool[state.correctIndex].zh})`;
}

export const drawGuessRelayModule: ServerGameModule<DrawGuessState, DrawGuessRelaySnapshot> = {
  id: 'draw-guess-relay',
  init(ctx): DrawGuessState {
    const totalRounds = ctx.settingValue || 5;
    const st: DrawGuessState = {
      round: 1,
      totalRounds,
      artistIdx: 0,
      brushX: 420,
      brushY: 340,
      colorIdx: 0,
      isDrawing: false,
      strokes: [],
      options: [],
      correctIndex: 0,
      phase: 'drawing',
      timeLeft: 22,
      banner: null,
      popups: [],
      players: ctx.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cursorOption: 0,
        guessedCorrect: false,
        lockedGuess: false,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
        navCooldown: 0,
        prevA: false,
        prevB: false,
      })),
    };
    setupSketchRound(st);
    return st;
  },
  step(state, players, dt, frenzyActive) {
    const sounds: SoundEvent[] = [];
    tickPopups(state.popups, dt);
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const inputMap = new Map(players.map((p) => [p.id, p]));
    const artist = state.players[state.artistIdx];

    if (state.phase === 'drawing') {
      // Artist paints on left/center canvas board (x: 110..740, y: 125..565)
      const aInp = inputMap.get(artist.id);
      const amx = aInp?.input.moveX ?? 0;
      const amy = aInp?.input.moveY ?? 0;
      const aHold = Boolean(aInp?.input.actionA);
      const bNow = Boolean(aInp?.input.actionB);
      const bPressed = bNow && !artist.prevB;
      artist.prevB = bNow;

      state.brushX = clamp(state.brushX + amx * 340 * dt, 118, 732);
      state.brushY = clamp(state.brushY + amy * 340 * dt, 132, 558);

      if (bPressed) {
        state.colorIdx = (state.colorIdx + 1) % BRUSH_COLORS.length;
        sounds.push({ type: 'tick', playerId: artist.id });
      }
      if (aHold) {
        const last = state.strokes[state.strokes.length - 1];
        if (!state.isDrawing || !last || dist(last.x, last.y, state.brushX, state.brushY) > 7) {
          if (state.strokes.length < 340) {
            state.strokes.push({
              x: state.brushX,
              y: state.brushY,
              colorHex: BRUSH_COLORS[state.colorIdx],
              newStroke: !state.isDrawing,
            });
          }
        }
        state.isDrawing = true;
      } else {
        state.isDrawing = false;
      }

      // Guessers select among 4 options
      let allGuessed = state.players.length > 1;
      for (const sp of state.players) {
        if (sp.id === artist.id) continue;
        sp.navCooldown = Math.max(0, sp.navCooldown - dt);
        const inp = inputMap.get(sp.id);
        const my = inp?.input.moveY ?? 0;
        const aNow = Boolean(inp?.input.actionA);
        const aPressed = aNow && !sp.prevA;
        sp.prevA = aNow;

        if (!sp.lockedGuess) {
          allGuessed = false;
          if (sp.navCooldown <= 0 && Math.abs(my) > 0.35) {
            sp.cursorOption = (sp.cursorOption + (my > 0 ? 1 : -1) + 4) % 4;
            sp.navCooldown = 0.18;
          }
          if (aPressed) {
            sp.lockedGuess = true;
            if (sp.cursorOption === state.correctIndex) {
              sp.guessedCorrect = true;
              const speedPts = Math.round(120 + state.timeLeft * 10) * (frenzyActive ? 2 : 1);
              sp.score += speedPts;
              artist.score += frenzyActive ? 140 : 80;
              sounds.push({ type: 'score', playerId: sp.id });
              state.popups.push({ x: 960, y: 260, text: `${sp.name} +${speedPts}!`, colorHex: '#10D98B', alpha: 1 });
            } else {
              sounds.push({ type: 'hit', playerId: sp.id });
            }
          }
        }
      }

      if (state.timeLeft <= 0 || allGuessed) {
        state.phase = 'reveal';
        state.timeLeft = 2.8;
        const ans = state.options[state.correctIndex];
        state.banner = `ANSWER: ${ans.en.toUpperCase()} (${ans.zh})!`;
      }
    } else {
      if (state.timeLeft <= 0) {
        if (state.round >= state.totalRounds) {
          return { finished: true, sounds };
        }
        state.round++;
        state.artistIdx = (state.artistIdx + 1) % state.players.length;
        setupSketchRound(state);
      }
    }

    return { finished: false, sounds };
  },
  snapshot(state): DrawGuessRelaySnapshot {
    const artist = state.players[state.artistIdx];
    const ans = state.options[state.correctIndex];
    return {
      gameId: 'draw-guess-relay',
      round: state.round,
      totalRounds: state.totalRounds,
      artistId: artist.id,
      artistName: artist.name,
      brushX: state.brushX,
      brushY: state.brushY,
      brushColor: BRUSH_COLORS[state.colorIdx],
      isDrawing: state.isDrawing,
      strokes: state.strokes,
      options: state.options,
      revealedWord: state.phase === 'reveal' ? ans : null,
      phase: state.phase,
      timeLeft: state.timeLeft,
      banner: state.phase === 'reveal' ? state.banner : `${artist.name} IS SKETCHING — GUESS FAST!`,
      popups: state.popups.map((p) => ({ ...p })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isArtist: p.id === artist.id,
        cursorOption: p.cursorOption,
        guessedCorrect: p.guessedCorrect,
        lockedGuess: p.lockedGuess,
        score: p.score,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.players.map((p) => ({
        id: p.id,
        score: p.score,
        stat: `${p.score} pts`,
      }))
    );
  },
};
