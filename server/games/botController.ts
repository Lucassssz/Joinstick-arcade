import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BotDifficulty,
  type ControllerInput,
  type GameId,
  type GameSnapshot,
} from '../../src/shared/types.ts';
import { getUniversalBotProfile } from '../../src/shared/botProfile.ts';
import { runRealtimeBotAdapter, selectTurnBasedBotMove, getTurnBotDelayMs, type RealtimeTargetPoint } from './botEngine.ts';

export interface BotMemory {
  wanderAngle: number;
  wanderTimer: number;
  actionCooldown: number;
  strafeDir: number;
  driftPhase: number;
  lastColorIdx?: number;
  colorReactionTimer?: number;
}

interface DifficultyTuning {
  moveScale: number;
  abilityChance: number;
  aimJitter: number;
  reactionCooldown: number;
  reflexFactor: number;
}

function getTuningFromUniversalProfile(difficulty: BotDifficulty): DifficultyTuning {
  const p = getUniversalBotProfile(difficulty);
  return {
    // Universal fairness rule: moveScale is ALWAYS 1.0 (bots move at identical legal speed as humans)
    moveScale: 1.0,
    abilityChance: p.aggression,
    aimJitter: p.aimError,
    reactionCooldown: p.reactionTime,
    reflexFactor: Math.max(0.2, 1 - p.mistakeRate),
  };
}

/**
 * Phase 2 Turn-Based Board Games (18) and Phase 3 Card Games (30).
 * These 48 games are excluded from the Phase 1 Real-Time Adapter and will be
 * migrated in Phase 2 and Phase 3 respectively upon user approval.
 */
const NON_REALTIME_PHASE_GAME_IDS = new Set<GameId>([
  // Phase 2 — Turn-Based Board Adapter (18 games)
  'rich-street',
  'jungle-ladders',
  'ludo-royale',
  'star-party-board',
  'reversi-clash',
  'four-in-a-row',
  'naval-salvo',
  'neon-checkers',
  'carrom-arena',
  'dungeon-crawl-board',
  'pit-harvest',
  'gomoku-blitz',
  'chess-blitz',
  'domino-chain',
  'hexagon-conquest',
  'backgammon-sprint',
  'mancala-jewels',
  'curling-masters',
  // Phase 3 — Hidden-Information Card Adapter (30 games)
  'lucky-auction',
  'color-clash',
  'liars-deck',
  'boom-kittens',
  'property-deal',
  'flip-seven',
  'royal-bluff',
  'dark-flip-clash',
  'sushi-draft',
  'big-two-royale',
  'lucky-21',
  'ten-pair-showdown',
  'landlord-clash',
  'speed-mahjong',
  'liars-dice-tavern',
  'undercover-word',
  'midnight-werewolf',
  'idiom-chain',
  'word-pulse',
  'trivia-blitz',
  'codenames-grid',
  'fib-party',
  'rummy-royale',
  'hearts-breaker',
  'spades-bidding',
  'poker-showdown',
  'tarot-arcana',
  'baccarat-club',
  'memory-pairs',
  'sequence-jack',
  // Pack 10–12 Turn-Paced Board Games (10)
  'mosaic-tile-draft',
  'maze-wall-duel',
  'corner-polyomino',
  'pillar-ascent-3d',
  'hex-island-settlers',
  'hex-insect-chess',
  'deep-sea-oxygen',
  'picross-nonogram',
  'speed-sudoku-duel',
  'xiangqi-river-clash',
  // Pack 10–11 Card Games (10)
  'camel-stack-derby',
  'route-express',
  'gem-engine-guild',
  'secret-rank-flags',
  'row-six-bust',
  'silent-sync',
  'one-card-court',
  'firework-hints',
  'tunnel-saboteur',
  'word-tile-crossroads',
]);

/**
 * Phase 1 Real-Time games that use discrete grid/lane/axis inputs rather than
 * 2D continuous free-angle vectors.
 */
const DISCRETE_STEERING_REALTIME_GAME_IDS = new Set<GameId>([
  'red-light-dash',
  'lava-hopper',
  'melon-merge',
  'tile-triple',
  'block-hop',
  'platform-leap',
  'truth-bomb',
  'draw-guess-relay',
  'sky-climb',
  'glass-bridge',
  'tug-titan',
  'flappy-flock',
  'dino-dash',
  'tile-2048-blitz',
  'mine-sweep-duel',
  'geo-pin-rush',
  'wavelength-sync',
  'brick-clash',
  'alien-wave',
  'block-stack',
  'frog-crossing',
  'barrel-tower',
  'rhythm-pulse',
  'skee-roll',
  'stack-tower',
  'bubble-pop-arc',
  'pin-strike',
  'coin-dozer',
  'laser-jump-rope',
  'falling-anvils',
  'seesaw-balance',
  'chain-gang-climb',
  'crane-drop-chaos',
  // Pack 8–12 Discrete / Lane / Cursor Real-Time Games
  'trap-builder-run',
  'wobbly-timber-pull',
  'bridge-load-stress',
  'three-lane-metro',
  'lane-tower-blitz',
  'path-tower-defense',
  'rail-switch-rush',
  'pipe-flow-sprint',
  'halfpipe-skate-combo',
  'five-second-microgames',
  'corridor-fencing',
  'chapteh-juggle',
]);

export function createBotMemory(): BotMemory {
  return {
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: 0.6 + Math.random() * 0.8,
    actionCooldown: 0,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    driftPhase: Math.random() * Math.PI * 2,
  };
}

function clampUnit(v: number): number {
  return Math.max(-1, Math.min(1, v));
}

function steerToward(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  _tuning: DifficultyTuning,
  _jitterSeed = 0
): { dx: number; dy: number; dist: number; angle: number } {
  const rx = toX - fromX;
  const ry = toY - fromY;
  const dist = Math.hypot(rx, ry);
  if (dist < 1) return { dx: 0, dy: 0, dist: 0, angle: 0 };
  const baseAngle = Math.atan2(ry, rx);
  return {
    dx: Math.cos(baseAngle),
    dy: Math.sin(baseAngle),
    dist,
    angle: baseAngle,
  };
}

function nearestOf<T extends { x: number; y: number }>(
  fromX: number,
  fromY: number,
  list: T[]
): { item: T | null; dist: number } {
  let best: T | null = null;
  let bestD = Infinity;
  for (const item of list) {
    const d = Math.hypot(item.x - fromX, item.y - fromY);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return { item: best, dist: bestD };
}

/**
 * Universal game-aware AI controller supporting all 20 JoinStick Arcade games
 * across Chill (Easy), Arcade (Medium), and Spicy (Hard) difficulties.
 */
export function computeBotInput(
  snapshot: GameSnapshot | null,
  botId: string,
  difficulty: BotDifficulty,
  dt: number,
  mem: BotMemory
): ControllerInput {
  if (!snapshot) return { dx: 0, dy: 0, a: false, b: false };

  const profile = getUniversalBotProfile(difficulty);
  // For Phase 1 real-time games, botController acts strictly as a stateless sensor translator
  // while runRealtimeBotAdapter() in botEngine.ts applies 100% of cognitive difficulty parameters.
  // For Phase 2 turn-based board games, keep legacy tuning/canAct() until Phase 2 migration.
  const isPhase1Realtime = !NON_REALTIME_PHASE_GAME_IDS.has(snapshot.gameId);
  const tuning: DifficultyTuning = isPhase1Realtime
    ? { moveScale: 1.0, abilityChance: 1.0, aimJitter: 0, reactionCooldown: 0, reflexFactor: 1.0 }
    : getTuningFromUniversalProfile(difficulty);
  mem.wanderTimer -= dt;
  mem.driftPhase = (mem.driftPhase ?? 0) + dt * 1.45;
  mem.actionCooldown = Math.max(0, mem.actionCooldown - dt);
  if (mem.colorReactionTimer && mem.colorReactionTimer > 0) {
    mem.colorReactionTimer = Math.max(0, mem.colorReactionTimer - dt);
  }
  if (mem.wanderTimer <= 0) {
    mem.wanderAngle += (Math.random() - 0.5) * 1.9;
    mem.strafeDir = Math.random() < 0.5 ? 1 : -1;
    mem.wanderTimer = 0.7 + Math.random() * 0.9;
  }

  const canAct = () =>
    isPhase1Realtime ? true : mem.actionCooldown <= 0 && Math.random() < tuning.abilityChance;
  const markActed = () => {
    if (!isPhase1Realtime) {
      mem.actionCooldown = tuning.reactionCooldown;
    }
  };

  let dx = 0;
  let dy = 0;
  let a = false;
  let b = false;
  let rtSelfPos: { x: number; y: number; vx?: number; vy?: number } | undefined;
  let rtSafeCenter: { x: number; y: number; safeRadius?: number } | undefined;
  let rtTargets: RealtimeTargetPoint[] | undefined;
  let rtIsBoundaryRecovery = false;
  let rtIsOffensiveMove = false;
  let rtIsAggressiveA = true;
  let rtIsAggressiveB = true;
  let rtHoldA = false;
  let rtRoundElapsedSec: number | undefined;

  switch (snapshot.gameId) {
    case 'bumper-brawl': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      rtSelfPos = { x: me.x, y: me.y, vx: me.vx, vy: me.vy };
      rtSafeCenter = {
        x: snapshot.ringCenterX,
        y: snapshot.ringCenterY,
        safeRadius: snapshot.ringRadius,
      };
      rtRoundElapsedSec = Math.max(0, 50 - snapshot.roundTimer);
      const distCenter = Math.hypot(me.x - snapshot.ringCenterX, me.y - snapshot.ringCenterY);
      if (distCenter > snapshot.ringRadius * 0.74) {
        rtIsBoundaryRecovery = true;
        rtIsOffensiveMove = false;
        const s = steerToward(me.x, me.y, snapshot.ringCenterX, snapshot.ringCenterY, tuning);
        dx = s.dx;
        dy = s.dy;
        if (distCenter > snapshot.ringRadius * 0.88 && me.cooldownA <= 0) {
          a = true;
          rtIsAggressiveA = false;
        }
      } else {
        const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
        const safePowerups = (snapshot.powerups ?? []).filter(
          (p) => Math.hypot(p.x - snapshot.ringCenterX, p.y - snapshot.ringCenterY) < snapshot.ringRadius * 0.78,
        );
        rtTargets = [
          ...rivals.map((r) => ({
            x: r.x,
            y: r.y,
            vx: r.vx,
            vy: r.vy,
            weight: 1.0,
            isAggressiveTarget: true,
          })),
          ...safePowerups.map((pw) => ({
            x: pw.x,
            y: pw.y,
            weight: 1.35,
            isAggressiveTarget: false,
          })),
        ];
        const { item: pwr, dist: pwrDist } = nearestOf(me.x, me.y, safePowerups);
        const { item: target, dist } = nearestOf(me.x, me.y, rivals);
        if (pwr && pwrDist < 210) {
          rtIsOffensiveMove = false;
          const s = steerToward(me.x, me.y, pwr.x, pwr.y, tuning);
          dx = s.dx;
          dy = s.dy;
        } else if (target) {
          rtIsOffensiveMove = true;
          const s = steerToward(me.x, me.y, target.x, target.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if (dist < 165 && me.cooldownA <= 0) {
            a = true;
          }
          if (dist < 115 && me.cooldownB <= 0) {
            b = true;
          }
        } else {
          rtIsOffensiveMove = false;
          const s = steerToward(me.x, me.y, snapshot.ringCenterX, snapshot.ringCenterY, tuning);
          dx = s.dx;
          dy = s.dy;
        }
      }
      break;
    }

    case 'astro-blaster': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      rtSelfPos = { x: me.x, y: me.y, vx: me.vx, vy: me.vy };
      rtSafeCenter = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, safeRadius: 310 };
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const pickups = snapshot.pickups ?? [];
      rtTargets = [
        ...rivals.map((r) => ({
          x: r.x,
          y: r.y,
          vx: r.vx,
          vy: r.vy,
          weight: 1.0,
          isAggressiveTarget: true,
        })),
        ...pickups.map((pk) => ({
          x: pk.x,
          y: pk.y,
          weight: 1.4,
          isAggressiveTarget: false,
        })),
      ];
      const { item: pickup, dist: pDist } = nearestOf(me.x, me.y, pickups);
      const { item: target, dist: tDist } = nearestOf(me.x, me.y, rivals);

      if (pickup && pDist < 220) {
        rtIsOffensiveMove = false;
        const s = steerToward(me.x, me.y, pickup.x, pickup.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else if (target) {
        rtIsOffensiveMove = true;
        const s = steerToward(me.x, me.y, target.x, target.y, tuning);
        if (tDist < 175) {
          // Strafe while keeping aim
          dx = s.dx * 0.45 - s.dy * 0.55 * mem.strafeDir;
          dy = s.dy * 0.45 + s.dx * 0.55 * mem.strafeDir;
        } else {
          dx = s.dx;
          dy = s.dy;
        }
        if (tDist < 460) a = true;
        if (tDist < 140 && me.cooldownB <= 0) {
          b = true;
        }
      } else {
        rtIsOffensiveMove = false;
        dx = Math.cos(mem.wanderAngle);
        dy = Math.sin(mem.wanderAngle);
      }
      break;
    }

    case 'turbo-drift': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.finished || me.falling || snapshot.trackPoints.length === 0) break;
      rtSelfPos = { x: me.x, y: me.y };
      rtIsOffensiveMove = false;
      rtIsAggressiveA = false;
      rtIsAggressiveB = false;
      const pts = snapshot.trackPoints;
      // Find closest waypoint and aim ahead along track (scaled by lookaheadDepth)
      let bestIdx = 0;
      let bestD = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const d = Math.hypot(pts[i].x - me.x, pts[i].y - me.y);
        if (d < bestD) {
          bestD = d;
          bestIdx = i;
        }
      }
      const lookAhead = pts[(bestIdx + 2) % pts.length];
      const nextPt = pts[(bestIdx + 3 + profile.lookaheadDepth) % pts.length];
      let aimX = lookAhead.x;
      let aimY = lookAhead.y;
      if (profile.lookaheadDepth >= 1) {
        aimX = lookAhead.x * 0.78 + nextPt.x * 0.22;
        aimY = lookAhead.y * 0.78 + nextPt.y * 0.22;
      }
      const { item: nearCoin, dist: cDist } = nearestOf(me.x, me.y, snapshot.coins ?? []);
      if (nearCoin && cDist < 105 && profile.lookaheadDepth >= 1) {
        aimX = aimX * 0.68 + nearCoin.x * 0.32;
        aimY = aimY * 0.68 + nearCoin.y * 0.32;
      }
      const { item: nearOil, dist: oDist } = nearestOf(me.x, me.y, snapshot.oils ?? []);
      if (nearOil && oDist < 84) {
        aimX += (me.x - nearOil.x) * 0.75;
        aimY += (me.y - nearOil.y) * 0.75;
      }
      const s = steerToward(me.x, me.y, aimX, aimY, tuning);
      dx = s.dx;
      dy = s.dy;

      // Measure upcoming corner sharpness
      const a1 = Math.atan2(lookAhead.y - me.y, lookAhead.x - me.x);
      const a2 = Math.atan2(nextPt.y - lookAhead.y, nextPt.x - lookAhead.x);
      let turn = a2 - a1;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;

      b = Math.abs(turn) > 0.56 && me.speed > 260;
      a = Math.abs(turn) < 0.32 && me.nitro > 0.5;
      break;
    }

    case 'hex-drop': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive || me.falling) break;
      const solidTiles = snapshot.tiles.filter((t) => t.state === 'solid');
      const currentTile = snapshot.tiles.find(
        (t) => t.state !== 'gone' && Math.hypot(t.x - me.x, t.y - me.y) < t.radius * 1.05
      );
      const { item: safeTile, dist: safeDist } = nearestOf(me.x, me.y, solidTiles);
      if (!currentTile || currentTile.state !== 'solid') {
        if (safeTile) {
          const s = steerToward(me.x, me.y, safeTile.x, safeTile.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if ((safeDist > 72 || !currentTile) && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        }
      } else if (safeTile) {
        // Keep moving across solid hexes; higher difficulties favor gold/spring center clusters
        const preferBonus = Math.random() < tuning.reflexFactor;
        const centerSolid = [...solidTiles].sort((t1, t2) => {
          const bonus1 = preferBonus && (t1.kind === 'gold' || t1.kind === 'spring') ? -105 : t1.kind === 'ice' ? 75 : 0;
          const bonus2 = preferBonus && (t2.kind === 'gold' || t2.kind === 'spring') ? -105 : t2.kind === 'ice' ? 75 : 0;
          return (
            Math.hypot(t1.x - ARENA_WIDTH / 2, t1.y - ARENA_HEIGHT / 2) + bonus1 -
            (Math.hypot(t2.x - ARENA_WIDTH / 2, t2.y - ARENA_HEIGHT / 2) + bonus2)
          );
        })[0];
        if (centerSolid) {
          const s = steerToward(me.x, me.y, centerSolid.x, centerSolid.y, tuning, mem.wanderAngle);
          dx = s.dx * 0.72;
          dy = s.dy * 0.72;
        }
      }
      const rival = nearestOf(
        me.x,
        me.y,
        snapshot.players.filter((p) => p.id !== botId && p.alive && !p.falling)
      );
      if (rival.item && rival.dist < 82 && me.cooldownB <= 0 && canAct() && Math.random() < 0.14) {
        b = true;
        markActed();
      }
      break;
    }

    case 'fuse-pass': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const others = snapshot.players.filter((p) => p.id !== botId && p.alive);
      if (me.hasBomb) {
        const { item: target, dist } = nearestOf(me.x, me.y, others);
        if (target) {
          const s = steerToward(me.x, me.y, target.x, target.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if (dist < 130 && me.cooldownB <= 0 && canAct()) {
            b = true;
            markActed();
          } else if (dist > 180 && me.cooldownA <= 0 && canAct() && Math.random() < 0.15) {
            a = true;
            markActed();
          }
        }
      } else {
        const holder = snapshot.players.find((p) => p.hasBomb && p.alive);
        const { item: fpPick, dist: fpDist } = nearestOf(me.x, me.y, snapshot.pickups ?? []);
        if (fpPick && fpDist < 200 && (!holder || Math.hypot(me.x - holder.x, me.y - holder.y) > 150)) {
          const s = steerToward(me.x, me.y, fpPick.x, fpPick.y, tuning);
          dx = s.dx;
          dy = s.dy;
        } else if (holder) {
          const d = Math.hypot(me.x - holder.x, me.y - holder.y) || 1;
          const fx = (me.x - holder.x) / d + ((ARENA_WIDTH / 2 - me.x) / 700) * 0.45;
          const fy = (me.y - holder.y) / d + ((ARENA_HEIGHT / 2 - me.y) / 450) * 0.45;
          const m = Math.hypot(fx, fy) || 1;
          dx = (fx / m) * tuning.moveScale;
          dy = (fy / m) * tuning.moveScale;
          if (d < 150 && me.cooldownA <= 0 && canAct() && Math.random() < 0.25) {
            a = true;
            markActed();
          }
        }
      }
      break;
    }

    case 'grid-runners': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      // Check ahead, left-turn, right-turn for walls, obstacles & trail points
      const dangerAt = (ang: number, dist: number): number => {
        const tx = me.x + Math.cos(ang) * dist;
        const ty = me.y + Math.sin(ang) * dist;
        if (tx < 58 || tx > ARENA_WIDTH - 58 || ty < 58 || ty > ARENA_HEIGHT - 58) return 1000;
        let score = 0;
        for (const ob of snapshot.obstacles ?? []) {
          if (tx > ob.x - 16 && tx < ob.x + ob.w + 16 && ty > ob.y - 16 && ty < ob.y + ob.h + 16) {
            score += 600;
          }
        }
        for (const tr of snapshot.trails) {
          const pts = tr.points;
          const limit = tr.playerId === botId ? Math.max(0, pts.length - 12) : pts.length;
          for (let i = 0; i < limit; i += 2) {
            const d = Math.hypot(pts[i].x - tx, pts[i].y - ty);
            if (d < 34) score += 200;
            else if (d < 70) score += 25;
          }
        }
        return score;
      };
      const ahead = dangerAt(me.angle, 78);
      let chosenAngle = me.angle;
      if (ahead > 40) {
        const leftD = dangerAt(me.angle - 1.2, 85);
        const rightD = dangerAt(me.angle + 1.2, 85);
        chosenAngle = leftD < rightD ? me.angle - 1.3 : me.angle + 1.3;
        if (ahead > 180 && leftD > 120 && rightD > 120 && me.cooldownB <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
          b = true;
          markActed();
        }
      } else {
        const { item: gp, dist: gpDist } = nearestOf(me.x, me.y, snapshot.pickups ?? []);
        if (gp && gpDist < 200) {
          const toPick = Math.atan2(gp.y - me.y, gp.x - me.x);
          if (dangerAt(toPick, 78) < 30) chosenAngle = toPick;
        } else if (Math.random() < 0.055) {
          chosenAngle += (Math.random() - 0.5) * 0.75;
        }
      }
      dx = Math.cos(chosenAngle) * tuning.moveScale;
      dy = Math.sin(chosenAngle) * tuning.moveScale;
      if (ahead < 20 && me.cooldownA <= 0 && canAct() && Math.random() < 0.03) {
        a = true;
        markActed();
      }
      break;
    }

    case 'ricochet-tanks': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const { item: tPick, dist: tPickDist } = nearestOf(me.x, me.y, snapshot.pickups ?? []);
      const { item: target, dist } = nearestOf(me.x, me.y, rivals);
      if (tPick && tPickDist < 200 && dist > 160) {
        const s = steerToward(me.x, me.y, tPick.x, tPick.y, tuning, mem.driftPhase * 0.4);
        dx = s.dx;
        dy = s.dy;
      } else if (target) {
        const s = steerToward(me.x, me.y, target.x, target.y, tuning, mem.driftPhase);
        if (dist < 220) {
          dx = -s.dy * mem.strafeDir;
          dy = s.dx * mem.strafeDir;
        } else {
          dx = s.dx;
          dy = s.dy;
        }
        if (me.cooldownA <= 0 && canAct() && Math.random() < 0.11) {
          a = true;
          markActed();
        }
        if (dist < 140 && me.cooldownB <= 0 && canAct() && Math.random() < 0.07) {
          b = true;
          markActed();
        }
      } else {
        dx = Math.cos(mem.wanderAngle) * tuning.moveScale * 0.6;
        dy = Math.sin(mem.wanderAngle) * tuning.moveScale * 0.6;
      }
      break;
    }

    case 'turbo-striker': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const ball = snapshot.ball;
      const enemyGoalX = me.team === 'red' ? ARENA_WIDTH - 40 : 40;
      const enemyGoalY = ARENA_HEIGHT / 2;
      // Aim slightly behind ball toward enemy goal with gentle human offset
      const bgx = enemyGoalX - ball.x;
      const bgy = enemyGoalY - ball.y;
      const bgd = Math.hypot(bgx, bgy) || 1;
      const aimOffY = Math.sin(mem.driftPhase * 1.1) * (1 - tuning.reflexFactor) * 44;
      const desiredX = ball.x - (bgx / bgd) * 34;
      const desiredY = ball.y - (bgy / bgd) * 34 + aimOffY;
      const s = steerToward(me.x, me.y, desiredX, desiredY, tuning, mem.driftPhase * 0.5);
      dx = s.dx;
      dy = s.dy;
      const distBall = Math.hypot(ball.x - me.x, ball.y - me.y);
      if (distBall < 68 && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      } else if (distBall > 180 && me.cooldownB <= 0 && canAct() && Math.random() < 0.055) {
        b = true;
        markActed();
      }
      break;
    }

    case 'paint-rush': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const cellW = ARENA_WIDTH / snapshot.cols;
      const cellH = ARENA_HEIGHT / snapshot.rows;
      let targetX = ARENA_WIDTH / 2 + Math.cos(mem.wanderAngle) * 260;
      let targetY = ARENA_HEIGHT / 2 + Math.sin(mem.wanderAngle) * 180;
      const { item: pPick, dist: pPickDist } = nearestOf(me.x, me.y, snapshot.pickups ?? []);
      if (pPick && pPickDist < 240) {
        targetX = pPick.x;
        targetY = pPick.y;
      } else {
        let bestScore = Infinity;
        for (const bc of snapshot.bonusCells ?? []) {
          if (snapshot.grid[bc] !== me.slotIndex) {
            const col = bc % snapshot.cols;
            const row = Math.floor(bc / snapshot.cols);
            const cx = (col + 0.5) * cellW;
            const cy = (row + 0.5) * cellH;
            const d = Math.hypot(cx - me.x, cy - me.y) * 0.7;
            if (d < bestScore) {
              bestScore = d;
              targetX = cx;
              targetY = cy;
            }
          }
        }
        for (let i = 0; i < 18; i++) {
          const col = Math.floor(Math.random() * snapshot.cols);
          const row = Math.floor(Math.random() * snapshot.rows);
          const owner = snapshot.grid[row * snapshot.cols + col];
          if (owner !== me.slotIndex) {
            const cx = (col + 0.5) * cellW;
            const cy = (row + 0.5) * cellH;
            const d = Math.hypot(cx - me.x, cy - me.y);
            if (d < bestScore) {
              bestScore = d;
              targetX = cx;
              targetY = cy;
            }
          }
        }
      }
      const s = steerToward(me.x, me.y, targetX, targetY, tuning, mem.driftPhase * 0.5);
      dx = s.dx;
      dy = s.dy;
      if (me.cooldownA <= 0 && canAct() && Math.random() < 0.07) {
        a = true;
        markActed();
      } else if (me.cooldownB <= 0 && canAct() && Math.random() < 0.055) {
        b = true;
        markActed();
      }
      break;
    }

    case 'laser-gauntlet': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const { item: orb, dist: orbD } = nearestOf(me.x, me.y, snapshot.orbs);
      const { item: lgPick, dist: lgDist } = nearestOf(me.x, me.y, snapshot.powerups ?? []);
      if (orb && orbD < 122) {
        const s = steerToward(orb.x, orb.y, me.x, me.y, tuning, mem.driftPhase * 0.4);
        dx = s.dx;
        dy = s.dy;
        if (orbD < 66 && me.cooldownA <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
          a = true;
          markActed();
        }
      } else if (lgPick && lgDist < 190) {
        const s = steerToward(me.x, me.y, lgPick.x, lgPick.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const { item: sh } = nearestOf(me.x, me.y, snapshot.shards);
        if (sh) {
          const s = steerToward(me.x, me.y, sh.x, sh.y, tuning, mem.driftPhase * 0.4);
          dx = s.dx;
          dy = s.dy;
        }
      }
      if (snapshot.orbs.length >= 3 && me.cooldownB <= 0 && canAct() && Math.random() < 0.045) {
        b = true;
        markActed();
      }
      break;
    }

    case 'vault-heist': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const { item: vhPick, dist: vhDist } = nearestOf(me.x, me.y, snapshot.pickups ?? []);
      if (me.carrying >= 2) {
        const s = steerToward(me.x, me.y, snapshot.portal.x, snapshot.portal.y, tuning, mem.driftPhase * 0.4);
        dx = s.dx;
        dy = s.dy;
      } else if (vhPick && vhDist < 165) {
        const s = steerToward(me.x, me.y, vhPick.x, vhPick.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const crowns = snapshot.relics.filter((r) => r.kind === 'crown');
        const { item: rel } = nearestOf(me.x, me.y, crowns.length > 0 ? crowns : snapshot.relics);
        if (rel) {
          const s = steerToward(me.x, me.y, rel.x, rel.y, tuning, mem.driftPhase * 0.4);
          dx = s.dx;
          dy = s.dy;
        }
      }
      const nearDrone = nearestOf(me.x, me.y, snapshot.drones.filter((d) => d.disabledTimer <= 0));
      if (nearDrone.item && nearDrone.dist < 115 && Math.random() < tuning.reflexFactor) {
        if (me.cooldownB <= 0 && canAct()) {
          b = true;
          markActed();
        } else if (me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'hyper-pong': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const puck = snapshot.puck;
      const onMySide = me.side === 'left' ? puck.x < ARENA_WIDTH * 0.54 : puck.x > ARENA_WIDTH * 0.46;
      const homeX = me.side === 'left' ? 185 : ARENA_WIDTH - 185;
      const puckInCorner =
        (puck.x < 190 || puck.x > ARENA_WIDTH - 190) && (puck.y < 155 || puck.y > ARENA_HEIGHT - 155);
      const puckBehindMe = me.side === 'left' ? puck.x < me.x + 14 : puck.x > me.x - 14;

      let targetX = homeX;
      let targetY = ARENA_HEIGHT / 2;

      if (puckInCorner || puckBehindMe) {
        // Retreat to goal-guard stance so the bot never pins the puck into a corner or back wall
        targetX = me.side === 'left' ? 175 : ARENA_WIDTH - 175;
        targetY = Math.max(210, Math.min(ARENA_HEIGHT - 210, puck.y * 0.5 + (ARENA_HEIGHT / 2) * 0.5));
      } else if (onMySide) {
        // Always approach from the GOAL side (behind the puck) to drive it forward toward the opponent
        targetX =
          me.side === 'left'
            ? Math.min(ARENA_WIDTH / 2 - 60, Math.max(145, puck.x - 34))
            : Math.max(ARENA_WIDTH / 2 + 60, Math.min(ARENA_WIDTH - 145, puck.x + 34));
        const humanOffsetY = Math.sin(mem.driftPhase * 1.35) * (1 - tuning.reflexFactor) * 44;
        targetY = Math.max(115, Math.min(ARENA_HEIGHT - 115, puck.y + humanOffsetY));
      } else {
        const humanOffsetY = Math.sin(mem.driftPhase * 1.35) * (1 - tuning.reflexFactor) * 44;
        targetY = Math.max(130, Math.min(ARENA_HEIGHT - 130, puck.y * 0.7 + (ARENA_HEIGHT / 2) * 0.3 + humanOffsetY));
      }

      const s = steerToward(me.x, me.y, targetX, targetY, tuning);
      if (s.dist > 20) {
        dx = s.dx;
        dy = s.dy;
      }
      const pDist = Math.hypot(puck.x - me.x, puck.y - me.y);
      const puckInFront = me.side === 'left' ? puck.x >= me.x - 6 : puck.x <= me.x + 6;
      if (puckInFront && !puckInCorner && pDist < 86 && me.cooldownA <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
        a = true;
        markActed();
      } else if (puckInFront && pDist < 175 && pDist > 92 && me.cooldownB <= 0 && canAct() && Math.random() < 0.06) {
        b = true;
        markActed();
      }
      break;
    }

    case 'blade-duel': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive || me.stunTimer > 0) break;
      const dangerR = snapshot.dangerRadius ?? 500;
      const distC = Math.hypot(me.x - ARENA_WIDTH / 2, me.y - ARENA_HEIGHT / 2);
      const { item: scroll, dist: scDist } = nearestOf(me.x, me.y, snapshot.scrolls ?? []);
      const rival = snapshot.players.find((p) => p.id !== botId && p.alive);
      if (distC > dangerR * 0.82) {
        const s = steerToward(me.x, me.y, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, tuning);
        dx = s.dx;
        dy = s.dy;
      } else if (scroll && scDist < 180) {
        const s = steerToward(me.x, me.y, scroll.x, scroll.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else if (rival) {
        const s = steerToward(me.x, me.y, rival.x, rival.y, tuning, mem.driftPhase * 0.4);
        if (s.dist > 165) {
          dx = s.dx * 0.85 - s.dy * 0.3 * mem.strafeDir;
          dy = s.dy * 0.85 + s.dx * 0.3 * mem.strafeDir;
        } else {
          dx = -s.dy * 0.7 * mem.strafeDir;
          dy = s.dx * 0.7 * mem.strafeDir;
        }
        if (rival.slashTimer > 0.05 && s.dist < 170 && me.cooldownB <= 0 && canAct() && Math.random() < tuning.reflexFactor * 0.55) {
          b = true;
          markActed();
        } else if (s.dist < 152 && me.cooldownA <= 0 && canAct() && Math.random() < 0.11) {
          dx = s.dx;
          dy = s.dy;
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'cannon-siege': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const nearPick = (snapshot.pickups ?? []).find((pk) => Math.abs(pk.x - me.x) < 150);
      const targetY = nearPick
        ? nearPick.y
        : snapshot.goldenTarget && Math.random() < 0.42
          ? snapshot.goldenTarget.y
          : ARENA_HEIGHT / 2 + Math.sin(mem.wanderAngle * 2) * 210;
      const diffY = targetY - me.y;
      dy = Math.abs(diffY) > 20 ? Math.sign(diffY) * tuning.moveScale * 0.72 : 0;
      a = me.cooldownA <= 0 && Math.random() < tuning.abilityChance * 0.36;
      const incoming = snapshot.shells.find(
        (sh) => sh.ownerId !== me.id && Math.hypot(sh.x - me.x, sh.y - me.y) < 118
      );
      if (incoming && me.cooldownB <= 0 && canAct() && Math.random() < tuning.reflexFactor * 0.65) {
        b = true;
        markActed();
      }
      break;
    }

    case 'crown-heist': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.stunTimer > 0) break;
      const { item: chPick, dist: chDist } = nearestOf(me.x, me.y, snapshot.pickups ?? []);
      if (me.hasCrown) {
        const others = snapshot.players.filter((p) => p.id !== botId);
        const { item: near, dist } = nearestOf(me.x, me.y, others);
        if (near) {
          const d = dist || 1;
          const fx = (me.x - near.x) / d + ((ARENA_WIDTH / 2 - me.x) / 600) * 0.35;
          const fy = (me.y - near.y) / d + ((ARENA_HEIGHT / 2 - me.y) / 400) * 0.35;
          const m = Math.hypot(fx, fy) || 1;
          dx = (fx / m) * tuning.moveScale;
          dy = (fy / m) * tuning.moveScale;
          if (dist < 110 && me.cooldownB <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
            b = true;
            markActed();
          }
        }
      } else if (chPick && chDist < 170) {
        const s = steerToward(me.x, me.y, chPick.x, chPick.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const s = steerToward(me.x, me.y, snapshot.crownX, snapshot.crownY, tuning, mem.driftPhase * 0.5);
        dx = s.dx;
        dy = s.dy;
        if (s.dist < 140 && me.cooldownA <= 0 && canAct() && Math.random() < 0.14) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'freeze-tag': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.frozen) break;
      const { item: ftPick, dist: ftDist } = nearestOf(me.x, me.y, snapshot.pickups ?? []);
      if (me.role === 'hunter') {
        const targets = snapshot.players.filter((p) => p.role === 'runner' && !p.frozen);
        const { item: target, dist } = nearestOf(me.x, me.y, targets);
        if (ftPick && ftDist < 160 && dist > 180) {
          const s = steerToward(me.x, me.y, ftPick.x, ftPick.y, tuning);
          dx = s.dx;
          dy = s.dy;
        } else if (target) {
          const s = steerToward(me.x, me.y, target.x, target.y, tuning, mem.driftPhase * 0.5);
          dx = s.dx;
          dy = s.dy;
          if (dist < 240 && me.cooldownA <= 0 && canAct() && Math.random() < 0.09) {
            a = true;
            markActed();
          } else if (dist < 180 && me.cooldownB <= 0 && canAct() && Math.random() < 0.04) {
            b = true;
            markActed();
          }
        }
      } else {
        const hunters = snapshot.players.filter((p) => p.role === 'hunter');
        const { item: hunter, dist: hDist } = nearestOf(me.x, me.y, hunters);
        const frozenAlly = snapshot.players.find((p) => p.role === 'runner' && p.frozen);
        if (hunter && hDist < 205) {
          const d = hDist || 1;
          dx = ((me.x - hunter.x) / d) * tuning.moveScale;
          dy = ((me.y - hunter.y) / d) * tuning.moveScale;
          if (hDist < 105 && me.cooldownA <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
            a = true;
            markActed();
          }
        } else if (ftPick && ftDist < 190) {
          const s = steerToward(me.x, me.y, ftPick.x, ftPick.y, tuning);
          dx = s.dx;
          dy = s.dy;
        } else if (frozenAlly) {
          const s = steerToward(me.x, me.y, frozenAlly.x, frozenAlly.y, tuning, mem.driftPhase * 0.4);
          dx = s.dx;
          dy = s.dy;
        } else {
          dx = Math.cos(mem.wanderAngle) * tuning.moveScale * 0.6;
          dy = Math.sin(mem.wanderAngle) * tuning.moveScale * 0.6;
        }
      }
      break;
    }

    case 'ghost-hunt': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const ghost = snapshot.players.find((p) => p.role === 'ghost' && p.alive);
      const hunters = snapshot.players.filter((p) => p.role === 'hunter' && p.alive);
      const { item: ghOrb, dist: ghOrbD } = nearestOf(me.x, me.y, snapshot.orbs ?? []);
      if (me.role === 'ghost') {
        const { item: near, dist } = nearestOf(me.x, me.y, hunters);
        if (ghOrb && ghOrb.kind === 'ecto' && ghOrbD < 185 && (!near || dist > 150)) {
          const s = steerToward(me.x, me.y, ghOrb.x, ghOrb.y, tuning);
          dx = s.dx;
          dy = s.dy;
        } else if (near) {
          if (me.visibility > 0.65 && dist < 230) {
            const s = steerToward(near.x, near.y, me.x, me.y, tuning, mem.driftPhase * 0.4);
            dx = s.dx;
            dy = s.dy;
            if (me.cooldownB <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
              b = true;
              markActed();
            }
          } else {
            const s = steerToward(me.x, me.y, near.x, near.y, tuning, mem.driftPhase * 0.4);
            dx = s.dx * 0.82;
            dy = s.dy * 0.82;
            if (dist < 128 && me.cooldownA <= 0 && canAct()) {
              a = true;
              markActed();
            }
          }
        }
      } else if (ghOrb && ghOrbD < 175) {
        const s = steerToward(me.x, me.y, ghOrb.x, ghOrb.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else if (ghost) {
        const s = steerToward(me.x, me.y, ghost.x, ghost.y, tuning, mem.driftPhase);
        dx = s.dx * 0.8;
        dy = s.dy * 0.8;
        if (ghost.visibility > 0.48 && s.dist < 285 && me.cooldownA <= 0 && canAct() && Math.random() < 0.14) {
          a = true;
          markActed();
        } else if (ghost.visibility < 0.3 && me.cooldownB <= 0 && canAct() && Math.random() < 0.03) {
          b = true;
          markActed();
        }
      }
      break;
    }

    case 'meteor-swarm': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.downed) break;
      const downedAlly = snapshot.players.find((p) => p.id !== botId && p.downed);
      const { item: msPick, dist: msDist } = nearestOf(me.x, me.y, snapshot.pickups ?? []);
      if (downedAlly) {
        const s = steerToward(me.x, me.y, downedAlly.x, downedAlly.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else if (msPick && msDist < 190) {
        const s = steerToward(me.x, me.y, msPick.x, msPick.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const { item: threat, dist } = nearestOf(me.x, me.y, snapshot.meteors);
        if (threat) {
          const s = steerToward(me.x, me.y, threat.x, threat.y, tuning, mem.driftPhase * 0.7);
          if (dist < 130) {
            // Back off slightly while firing
            dx = -s.dx * 0.5;
            dy = -s.dy * 0.5;
            if (dist < 85 && me.cooldownB <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
              b = true;
              markActed();
            }
          } else {
            dx = s.dx;
            dy = s.dy;
          }
          a = dist < 420 && Math.random() < tuning.abilityChance * 0.58;
        }
      }
      break;
    }

    case 'hook-shot': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive || me.falling) break;
      const home =
        snapshot.islands.find(
          (isl) => me.x >= isl.x - 16 && me.x <= isl.x + isl.w + 16 && me.y >= isl.y - 16 && me.y <= isl.y + isl.h + 16
        ) ?? snapshot.islands[0];
      const cx = home.x + home.w / 2;
      const cy = home.y + home.h / 2;
      const safeCollectibles = [...(snapshot.coins ?? []), ...(snapshot.pickups ?? [])].filter(
        (c) => c.x >= home.x + 14 && c.x <= home.x + home.w - 14 && c.y >= home.y + 14 && c.y <= home.y + home.h - 14
      );
      const { item: hsPick, dist: hsPickD } = nearestOf(me.x, me.y, safeCollectibles);
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive && !p.falling);
      const { item: rival, dist } = nearestOf(me.x, me.y, rivals);
      if (rival && dist < 410 && me.cooldownA <= 0 && canAct() && Math.random() < 0.09) {
        const aim = steerToward(me.x, me.y, rival.x, rival.y, tuning, mem.driftPhase);
        dx = aim.dx;
        dy = aim.dy;
        a = true;
        markActed();
      } else if (hsPick && hsPickD < 180) {
        const s = steerToward(me.x, me.y, hsPick.x, hsPick.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const s = steerToward(me.x, me.y, cx, cy, tuning);
        if (s.dist > 36) {
          dx = s.dx * 0.7;
          dy = s.dy * 0.7;
        }
      }
      if ((me.hookedBy || (rival && dist < 100)) && me.cooldownB <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
        b = true;
        markActed();
      }
      break;
    }

    case 'gravity-flip': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const mySide: 'floor' | 'ceiling' = me.gravityDir === 1 ? 'floor' : 'ceiling';
      const lookDist = 148 + profile.lookaheadDepth * 18;
      const aheadDanger = snapshot.obstacles.find(
        (ob) => ob.x > me.x - 16 && ob.x < me.x + lookDist && (ob.side === mySide || ob.side === 'mid')
      );
      if (aheadDanger) {
        if (aheadDanger.side === mySide && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        } else if (me.cooldownB <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
          b = true;
          markActed();
        }
      } else {
        // Flip toward upcoming coins or pickups on the opposite lane when safe
        const rewardList = [...snapshot.coins, ...(snapshot.pickups ?? [])];
        const nextCoin = rewardList.find((c) => c.x > me.x + 40 && c.x < me.x + 250);
        if (nextCoin && Math.random() < tuning.reflexFactor * 0.6) {
          const coinSide: 'floor' | 'ceiling' =
            nextCoin.y > (snapshot.floorY + snapshot.ceilingY) / 2 ? 'floor' : 'ceiling';
          const oppositeDanger = snapshot.obstacles.some(
            (ob) => ob.x > me.x - 20 && ob.x < me.x + 210 && (ob.side === coinSide || ob.side === 'mid')
          );
          if (coinSide !== mySide && !oppositeDanger && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        }
      }
      // Subtle dynamic lane weaving within the safe runner band (240..420)
      const targetX = 320 + Math.sin(mem.wanderAngle) * 75;
      const errX = targetX - me.x;
      if (Math.abs(errX) > 12) {
        dx = Math.sign(errX) * Math.min(0.65, Math.abs(errX) / 90) * tuning.moveScale;
      }
      break;
    }

    case 'rich-street': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.bankrupt || snapshot.activePlayerId !== botId) break;
      // Snappy board-game thinking delay (~0.85s) via turnTimeLeft (ROLL_TIMEOUT = 14, DECISION_TIMEOUT = 12)
      if (snapshot.phase === 'wait-roll' && snapshot.turnTimeLeft < 13.15 && mem.actionCooldown <= 0) {
        if (me.luckyCharge >= 100 && !me.rentShield && Math.random() < tuning.abilityChance) {
          b = true;
          mem.actionCooldown = 0.8;
        } else {
          a = true;
          mem.actionCooldown = 0.85;
        }
      } else if (snapshot.phase === 'decision' && snapshot.turnTimeLeft < 11.15 && mem.actionCooldown <= 0) {
        const keepBuffer = difficulty === 'chill' ? 360 : difficulty === 'arcade' ? 220 : 120;
        const canAffordComfortably = me.cash - snapshot.decisionCost >= keepBuffer;
        if (canAffordComfortably || (snapshot.decisionAction === 'buy' && me.propertiesOwned < 2 && me.cash >= snapshot.decisionCost)) {
          a = true;
        } else {
          b = true;
        }
        mem.actionCooldown = 0.85;
      }
      break;
    }

    case 'jungle-ladders': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.activePlayerId !== botId) break;
      // Snappy board-game thinking delay (~0.85s) via turnTimeLeft (TURN_TIMEOUT = 14)
      if (snapshot.phase === 'wait-roll' && snapshot.turnTimeLeft < 13.15 && mem.actionCooldown <= 0) {
        if (me.trickReady && !me.boostQueued && Math.random() < tuning.abilityChance) {
          b = true;
          mem.actionCooldown = 0.75;
        } else {
          const goodTiming =
            difficulty === 'spicy'
              ? snapshot.powerMeter > 0.68
              : difficulty === 'arcade'
                ? snapshot.powerMeter > 0.5
                : true;
          if (goodTiming || snapshot.turnTimeLeft < 10.8) {
            a = true;
            mem.actionCooldown = 0.85;
          }
        }
      }
      break;
    }

    case 'bomb-grid': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      // Flee any active bomb in same row/col within blast range
      const dangerBomb = snapshot.bombs.find(
        (bm) =>
          Math.hypot(bm.x - me.x, bm.y - me.y) < 220 &&
          (Math.abs(bm.x - me.x) < 48 || Math.abs(bm.y - me.y) < 48)
      );
      if (dangerBomb) {
        const rx = me.x - dangerBomb.x;
        const ry = me.y - dangerBomb.y;
        // Step perpendicular to escape cross-blast!
        if (Math.abs(rx) < 34) {
          dx = mem.strafeDir * tuning.moveScale;
          dy = Math.sign(ry || 1) * 0.45 * tuning.moveScale;
        } else {
          dx = Math.sign(rx || 1) * 0.45 * tuning.moveScale;
          dy = mem.strafeDir * tuning.moveScale;
        }
        if (Math.hypot(rx, ry) < 76 && me.cooldownB <= 0 && canAct() && Math.random() < 0.25) {
          b = true;
          markActed();
        }
      } else if (
        snapshot.suddenDeath &&
        (me.x < 210 || me.x > ARENA_WIDTH - 210 || me.y < 190 || me.y > ARENA_HEIGHT - 190)
      ) {
        const s = steerToward(me.x, me.y, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
        const { item: rival, dist } = nearestOf(me.x, me.y, rivals);
        if (rival && dist < 340) {
          const s = steerToward(me.x, me.y, rival.x, rival.y, tuning, mem.wanderAngle);
          dx = s.dx;
          dy = s.dy;
          if (dist < 135 && me.cooldownA <= 0 && canAct() && Math.random() < 0.1) {
            a = true;
            markActed();
          }
        } else {
          dx = Math.cos(mem.wanderAngle) * tuning.moveScale * 0.8;
          dy = Math.sin(mem.wanderAngle) * tuning.moveScale * 0.8;
          if (me.cooldownA <= 0 && canAct() && Math.random() < 0.03) {
            a = true;
            markActed();
          }
        }
      }
      break;
    }

    case 'red-light-dash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.finished) break;
      if (snapshot.lightState === 'green') {
        dx = tuning.moveScale;
        let steerY = Math.sin(mem.wanderAngle) * 0.15;
        const nearApple = (snapshot.apples ?? []).find(
          (ap) => ap.x > me.x && ap.x < me.x + 125 && Math.abs(ap.y - me.y) < 105
        );
        const nearPuddle = (snapshot.puddles ?? []).find(
          (pd) => pd.x > me.x - 10 && pd.x < me.x + 80 && Math.abs(pd.y - me.y) < pd.ry + 16
        );
        if (nearPuddle) {
          steerY = Math.sign(me.y - nearPuddle.y || 1) * 0.75 * tuning.moveScale;
        } else if (nearApple) {
          steerY = Math.sign(nearApple.y - me.y) * 0.65 * tuning.moveScale;
        }
        dy = steerY;
        if (me.cooldownA <= 0 && canAct() && Math.random() < 0.11) {
          a = true;
          markActed();
        }
      } else if (snapshot.lightState === 'yellow') {
        const brakeThresh = 0.24 + profile.lookaheadDepth * 0.14;
        const brakeNow = snapshot.lightTimer < brakeThresh;
        dx = brakeNow ? 0 : tuning.moveScale * 0.5;
      } else {
        dx = 0;
        dy = 0;
      }
      break;
    }

    case 'color-match': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive || me.falling) break;
      if (mem.lastColorIdx !== snapshot.targetColorIndex) {
        mem.lastColorIdx = snapshot.targetColorIndex;
        mem.colorReactionTimer = profile.reactionTime;
      }
      if ((mem.colorReactionTimer ?? 0) > 0) {
        dx = Math.cos(mem.wanderAngle) * tuning.moveScale * 0.25;
        dy = Math.sin(mem.wanderAngle) * tuning.moveScale * 0.25;
        break;
      }
      const safeTiles = snapshot.tiles.filter(
        (t) => !t.dropped && t.colorIndex === snapshot.targetColorIndex
      );
      if (snapshot.orb && snapshot.phase === 'scramble' && snapshot.phaseTimer > 1.3 && Math.hypot(snapshot.orb.x - me.x, snapshot.orb.y - me.y) < 140) {
        const s = steerToward(me.x, me.y, snapshot.orb.x, snapshot.orb.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else if (safeTiles.length > 0) {
        let best = safeTiles[0];
        let bestScore = Infinity;
        for (const t of safeTiles) {
          const cx = t.x + t.w / 2;
          const cy = t.y + t.h / 2;
          const d = Math.hypot(cx - me.x, cy - me.y) - (t.bonus ? 70 * tuning.reflexFactor : 0);
          if (d < bestScore) {
            bestScore = d;
            best = t;
          }
        }
        const cx = best.x + best.w / 2;
        const cy = best.y + best.h / 2;
        const bestD = Math.hypot(cx - me.x, cy - me.y);
        if (bestD > 26) {
          const s = steerToward(me.x, me.y, cx, cy, tuning, mem.driftPhase * 0.35);
          dx = s.dx;
          dy = s.dy;
          if (bestD > 170 && me.cooldownA <= 0 && canAct() && Math.random() < 0.16) {
            a = true;
            markActed();
          }
        } else {
          const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive && !p.falling);
          const { item: near, dist } = nearestOf(me.x, me.y, rivals);
          if (near && dist < 92 && me.cooldownB <= 0 && canAct() && Math.random() < 0.09) {
            b = true;
            markActed();
          }
        }
      }
      break;
    }

    case 'kitchen-rush': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const serveSt = snapshot.stations.find((s) => s.kind === 'serve');
      const sinkSt = snapshot.stations.find((s) => s.kind === 'sink');
      const burningGrill = snapshot.stations.find((s) => s.kind === 'grill' && s.onFire);
      const readyGrill = snapshot.stations.find(
        (s) => s.kind === 'grill' && s.cookingDish && s.cookProgress >= 1 && !s.onFire
      );
      const emptyGrill = snapshot.stations.find((s) => s.kind === 'grill' && !s.cookingDish && !s.onFire);
      const activeChop = snapshot.stations.find((s) => s.kind === 'chop' && s.cookingDish);
      const emptyChop = snapshot.stations.find((s) => s.kind === 'chop' && !s.cookingDish);

      const vipOrder = Math.random() < profile.mistakeRate ? undefined : snapshot.orders.find((o) => o.vip);
      const wantedDish = (vipOrder ?? snapshot.orders[0])?.dish ?? 'burger';
      const rawKind = wantedDish === 'burger' ? 'raw-burger' : wantedDish === 'pizza' ? 'raw-pizza' : 'raw-taco';
      const rawSt = snapshot.stations.find((s) => s.kind === rawKind);
      const { item: nearBoots, dist: bootsD } = nearestOf(me.x, me.y, snapshot.boots ?? []);

      let targetX = ARENA_WIDTH / 2;
      let targetY = ARENA_HEIGHT / 2;
      let wantInteract = false;

      if (burningGrill) {
        // Priority 1: Extinguish Stove Fire!
        targetX = burningGrill.x < me.x ? burningGrill.x + burningGrill.w + 30 : burningGrill.x - 30;
        targetY = burningGrill.y + burningGrill.h / 2;
        if (Math.hypot(targetX - me.x, targetY - me.y) < 105) wantInteract = true;
      } else if (nearBoots && bootsD < 135 && (me.bootsTimer ?? 0) <= 0) {
        targetX = nearBoots.x;
        targetY = nearBoots.y;
      } else if (me.holding && me.holding.cooked && serveSt) {
        // Deliver cooked plate to Serve Conveyor
        targetX = serveSt.x - 34;
        targetY = Math.max(serveSt.y + 34, Math.min(serveSt.y + serveSt.h - 34, me.y));
        const dServe = Math.hypot(targetX - me.x, targetY - me.y);
        const tossRange = 130 + profile.lookaheadDepth * 95;
        if (dServe < tossRange && me.x > 760 && me.cooldownB <= 0 && canAct()) {
          b = true;
          markActed();
        } else if (dServe < 88) {
          wantInteract = true;
        }
      } else if (me.holding && !me.holding.cooked && me.holding.stage === 'chopped' && emptyGrill) {
        // Take chopped ingredient to an empty Stove
        targetX = emptyGrill.x - 34;
        targetY = emptyGrill.y + emptyGrill.h / 2;
        if (Math.hypot(targetX - me.x, targetY - me.y) < 92) wantInteract = true;
      } else if (me.holding && !me.holding.cooked && emptyChop) {
        // Take raw ingredient to an empty Cutting Board
        targetX = emptyChop.x - 34;
        targetY = emptyChop.y + emptyChop.h / 2;
        if (Math.hypot(targetX - me.x, targetY - me.y) < 92) wantInteract = true;
      } else if (me.holding && !me.holding.cooked && emptyGrill) {
        // Fallback if all cutting boards are full: put directly on stove
        targetX = emptyGrill.x - 34;
        targetY = emptyGrill.y + emptyGrill.h / 2;
        if (Math.hypot(targetX - me.x, targetY - me.y) < 92) wantInteract = true;
      } else if (!me.holding && readyGrill) {
        // Grab finished dish from Stove before it burns!
        targetX = readyGrill.x + readyGrill.w + 34;
        targetY = readyGrill.y + readyGrill.h / 2;
        if (me.x < readyGrill.x + readyGrill.w / 2) targetX = readyGrill.x - 34;
        if (Math.hypot(targetX - me.x, targetY - me.y) < 92) wantInteract = true;
      } else if (!me.holding && activeChop) {
        // Stand at Cutting Board to finish chopping & auto-pickup
        targetX = activeChop.x + activeChop.w + 30;
        targetY = activeChop.y + activeChop.h / 2;
        if (me.x < activeChop.x + activeChop.w / 2) targetX = activeChop.x - 30;
        if (Math.hypot(targetX - me.x, targetY - me.y) < 92) wantInteract = true;
      } else if (!me.holding && sinkSt && (sinkSt.dirtyPlates ?? 0) >= 2) {
        // Wash dirty plates at the Sink for bonus points
        targetX = sinkSt.x - 34;
        targetY = sinkSt.y + sinkSt.h / 2;
        if (Math.hypot(targetX - me.x, targetY - me.y) < 92) wantInteract = true;
      } else if (!me.holding && rawSt) {
        // Grab raw ingredient from crate
        targetX = rawSt.x + rawSt.w + 34;
        targetY = rawSt.y + rawSt.h / 2;
        if (Math.hypot(targetX - me.x, targetY - me.y) < 92) wantInteract = true;
      }

      // Smoothly route through the 2 horizontal kitchen walkways (y=285 or y=484) when crossing island columns
      const colOf = (x: number) => (x < 335 ? 0 : x < 630 ? 1 : 2);
      if (colOf(me.x) !== colOf(targetX)) {
        const aisleY = Math.abs(me.y - 285) < Math.abs(me.y - 484) ? 285 : 484;
        if (Math.abs(me.y - aisleY) > 28) {
          targetX = me.x;
          targetY = aisleY;
        }
      }

      const s = steerToward(me.x, me.y, targetX, targetY, tuning);
      dx = s.dx;
      dy = s.dy;
      if (wantInteract && mem.actionCooldown <= 0) {
        a = true;
        markActed();
      }
      break;
    }

    case 'treasure-dig': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.stunTimer > 0) break;
      const activeCrabs = snapshot.crabs.filter((c) => c.stunTimer <= 0);
      const { item: nearCrab, dist: crabDist } = nearestOf(me.x, me.y, activeCrabs);
      const { item: digPick, dist: digPickD } = nearestOf(me.x, me.y, snapshot.pickups ?? []);
      if (nearCrab && crabDist < 88) {
        const flee = steerToward(nearCrab.x, nearCrab.y, me.x, me.y, tuning);
        dx = flee.dx;
        dy = flee.dy;
        if (me.cooldownB <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
          b = true;
          markActed();
        }
      } else if (digPick && digPickD < 185) {
        const s = steerToward(me.x, me.y, digPick.x, digPick.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        // Legal public view ONLY: only target spots with revealedTimer > 0 (never peek unrevealed buried spots!)
        const revealed = snapshot.spots.filter((s) => s.revealedTimer > 0);
        const { item: spot, dist: spotDist } = nearestOf(me.x, me.y, revealed);
        if (spot) {
          const s = steerToward(me.x, me.y, spot.x, spot.y, tuning, mem.wanderAngle);
          dx = s.dx;
          dy = s.dy;
          if (spotDist < 52 && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        } else {
          dx = Math.cos(mem.wanderAngle) * tuning.moveScale * 0.82;
          dy = Math.sin(mem.wanderAngle) * tuning.moveScale * 0.82;
          if (me.heat > 0.82 && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          } else if (me.heat > 0.4 && me.cooldownB <= 0 && canAct() && Math.random() < 0.06) {
            b = true;
            markActed();
          }
        }
      }
      break;
    }

    case 'fruit-drop': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.stunTimer > 0) break;
      const nearbyBomb = snapshot.items.find(
        (it) => it.kind === 'bomb' && it.y > me.y - 165 && it.y < me.y + 20 && Math.abs(it.x - me.x) < 82
      );
      if (nearbyBomb) {
        if (me.cooldownB <= 0 && canAct() && Math.abs(nearbyBomb.x - me.x) < 105 && Math.random() < tuning.reflexFactor) {
          b = true;
          markActed();
        } else {
          dx = (nearbyBomb.x >= me.x ? -1 : 1) * tuning.moveScale;
        }
      } else {
        const goodItems = snapshot.items.filter((it) => it.kind !== 'bomb' && it.y < me.y + 10);
        let best = goodItems[0] ?? null;
        let bestScore = -Infinity;
        for (const it of goodItems) {
          const val = it.kind === 'magnet' ? 185 : it.kind === 'star' ? 175 : 90;
          const score = val + it.y * 0.35 - Math.abs(it.x - me.x) * 0.72;
          if (score > bestScore) {
            bestScore = score;
            best = it;
          }
        }
        if (best) {
          const err = best.x - me.x;
          if (Math.abs(err) > 22) {
            dx = Math.sign(err) * tuning.moveScale;
            if (Math.abs(err) > 155 && best.y > me.y - 230 && me.cooldownA <= 0 && canAct()) {
              a = true;
              markActed();
            }
          }
        }
      }
      break;
    }

    case 'lucky-auction': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.passed || snapshot.phase !== 'bidding') break;
      if (snapshot.highestBidderId === botId || mem.actionCooldown > 0 || snapshot.timer > 13.0) break;
      const soundsLikeDuck =
        snapshot.chestClue.toLowerCase().includes('squeak') ||
        snapshot.chestClue.toLowerCase().includes('hollow');
      const mult = snapshot.multiplier ?? 1;
      const maxWilling =
        (soundsLikeDuck
          ? difficulty === 'chill'
            ? 200
            : 120
          : difficulty === 'spicy'
            ? 295
            : 245) * (mult > 1 ? 1.45 : 1);
      const nextBid = snapshot.highestBid + 50;
      if (nextBid <= maxWilling && me.cash >= nextBid && Math.random() < 0.08) {
        a = true;
        mem.actionCooldown = 2.3;
      } else if ((nextBid > maxWilling || me.cash < nextBid) && snapshot.timer < 9.5 && Math.random() < 0.18) {
        b = true;
        mem.actionCooldown = 1.5;
      }
      break;
    }

    case 'pinball-clash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.balls.length === 0) break;
      const targetBall = [...snapshot.balls].sort(
        (b1, b2) => Math.abs(b1.x - me.x) - Math.abs(b2.x - me.x)
      )[0];
      const wobbleY = Math.sin(mem.driftPhase * 1.45) * (1 - tuning.reflexFactor) * 44;
      const diffY = targetBall.y + wobbleY - me.y;
      if (Math.abs(diffY) > 20) {
        dy = Math.sign(diffY) * Math.min(1, Math.abs(diffY) / 76) * tuning.moveScale;
      }
      const dist = Math.hypot(targetBall.x - me.x, targetBall.y - me.y);
      if (dist < 108 && me.cooldownA <= 0 && canAct() && Math.random() < tuning.reflexFactor) {
        a = true;
        markActed();
      } else if (dist < 140 && me.cooldownB <= 0 && canAct() && Math.random() < 0.1) {
        b = true;
        markActed();
      }
      break;
    }

    case 'color-clash':
    case 'liars-deck': {
      // Bot card decisions run authoritatively on the server inside colorClash.ts & liarsDeck.ts
      break;
    }

    case 'volley-smash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const myHalf =
        (me.team === 'red' && snapshot.ball.targetX < ARENA_WIDTH / 2 + 30) ||
        (me.team === 'blue' && snapshot.ball.targetX > ARENA_WIDTH / 2 - 30);
      const homeX = me.team === 'red' ? ARENA_WIDTH / 2 - 190 : ARENA_WIDTH / 2 + 190;
      const homeY = ARENA_HEIGHT / 2 + (me.slotIndex % 2 === 0 ? -90 : 90);
      const tx = myHalf ? snapshot.ball.targetX : homeX;
      const ty = myHalf ? snapshot.ball.targetY : homeY;
      const s = steerToward(me.x, me.y, tx, ty, tuning);
      if (s.dist > 18) {
        dx = s.dx;
        dy = s.dy;
      }
      const ballDist = Math.hypot(snapshot.ball.x - me.x, snapshot.ball.y - me.y);
      if (ballDist < 88 && snapshot.ball.z < 140 && canAct()) {
        if (me.cooldownB <= 0 && Math.random() < tuning.reflexFactor * 0.65) {
          b = true;
          markActed();
        } else if (me.cooldownA <= 0) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'lava-hopper': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const safePillars = snapshot.pillars.filter((pl) => pl.state === 'safe');
      const warnPillars = snapshot.pillars.filter((pl) => pl.state === 'warning');
      const pool = safePillars.length > 0 ? safePillars : warnPillars;
      let bestPillar = pool[0];
      let bestScore = Infinity;
      for (const pl of pool) {
        const d = Math.hypot(pl.x - me.x, pl.y - me.y) - (pl.hasGem ? 95 : 0);
        if (d < bestScore) {
          bestScore = d;
          bestPillar = pl;
        }
      }
      if (bestPillar) {
        const s = steerToward(me.x, me.y, bestPillar.x, bestPillar.y, tuning);
        if (s.dist > 16) {
          dx = s.dx;
          dy = s.dy;
        }
        if (s.dist > 75 && s.dist < 185 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const { item: nearRival, dist: rDist } = nearestOf(me.x, me.y, rivals);
      if (nearRival && rDist < 85 && me.cooldownB <= 0 && canAct() && Math.random() < tuning.reflexFactor * 0.5) {
        b = true;
        markActed();
      }
      break;
    }

    case 'ludo-royale': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.activePlayerId !== botId) break;
      if (snapshot.phase === 'wait-roll' && snapshot.turnTimeLeft < 11.8 && mem.actionCooldown <= 0) {
        a = true;
        mem.actionCooldown = 1.1;
      }
      break;
    }

    case 'star-party-board': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.activePlayerId !== botId) break;
      if (snapshot.phase === 'wait-roll' && snapshot.turnTimeLeft < 10.1 && mem.actionCooldown <= 0) {
        if (!me.candyActive && me.coins >= 25 && Math.random() < tuning.abilityChance) {
          b = true;
          mem.actionCooldown = 0.9;
        } else {
          a = true;
          mem.actionCooldown = 1.1;
        }
      }
      break;
    }

    case 'reversi-clash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.activePlayerId !== botId) break;
      const turnDelaySec = getTurnBotDelayMs(difficulty) / 1000;
      if (snapshot.turnTimeLeft < 14 - turnDelaySec && mem.actionCooldown <= 0) {
        const candidates = (snapshot.validMoves ?? []).map((m) => ({
          move: m,
          rawScore: m.flips + ((m.col === 0 || m.col === snapshot.cols - 1) && (m.row === 0 || m.row === snapshot.rows - 1) ? 25 : 0),
        }));
        const chosenMove = selectTurnBasedBotMove({ difficulty, candidates });
        const bestMove = chosenMove ?? snapshot.validMoves[0];
        if (bestMove) {
          if (me.cursorCol !== bestMove.col) {
            dx = Math.sign(bestMove.col - me.cursorCol);
            mem.actionCooldown = 0.25;
          } else if (me.cursorRow !== bestMove.row) {
            dy = Math.sign(bestMove.row - me.cursorRow);
            mem.actionCooldown = 0.25;
          } else {
            if (me.novaCharges > 0 && snapshot.turnCount > 8 && Math.random() < 0.25) {
              b = true;
            } else {
              a = true;
            }
            mem.actionCooldown = 1.0;
          }
        } else {
          a = true;
          mem.actionCooldown = 1.0;
        }
      }
      break;
    }

    case 'four-in-a-row': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.activePlayerId !== botId) break;
      const turnDelaySec = getTurnBotDelayMs(difficulty) / 1000;
      if (snapshot.turnTimeLeft < 14 - turnDelaySec && mem.actionCooldown <= 0) {
        const cols = snapshot.cols;
        const rows = snapshot.rows;
        const dropRowOf = (col: number) => {
          for (let r = rows - 1; r >= 0; r--) {
            if (snapshot.grid[r * cols + col] === null) return r;
          }
          return -1;
        };
        const wouldConnect4 = (col: number, row: number, pid: string) => {
          const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
          for (const [dc, dr] of dirs) {
            let cnt = 1;
            for (const dir of [-1, 1]) {
              for (let s = 1; s < 4; s++) {
                const nc = col + dc * s * dir;
                const nr = row + dr * s * dir;
                if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) break;
                if (snapshot.grid[nr * cols + nc] === pid) cnt++;
                else break;
              }
            }
            if (cnt >= 4) return true;
          }
          return false;
        };
        const candidates: { move: number; rawScore: number }[] = [];
        for (let c = 0; c < cols; c++) {
          const r = dropRowOf(c);
          if (r < 0) continue;
          let sc = 4 - Math.abs(3 - c);
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nc = c + dc;
              const nr = r + dr;
              if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && snapshot.grid[nr * cols + nc] === botId) {
                sc += 18;
              }
            }
          }
          if (wouldConnect4(c, r, botId)) sc += 1000;
          for (const opp of snapshot.players) {
            if (opp.id !== botId && wouldConnect4(c, r, opp.id)) sc += 400;
          }
          candidates.push({ move: c, rawScore: sc });
        }
        const chosenCol = selectTurnBasedBotMove({ difficulty, candidates });
        const targetCol = chosenCol !== null ? chosenCol : (candidates[0]?.move ?? 3);

        if (me.hoverCol !== targetCol && snapshot.turnTimeLeft > 8.5) {
          dx = Math.sign(targetCol - me.hoverCol);
          mem.actionCooldown = 0.16;
        } else {
          if (me.anvilCharges > 0 && Math.random() < 0.15) {
            b = true;
          } else {
            a = true;
          }
          mem.actionCooldown = 0.65;
        }
      }
      break;
    }

    case 'naval-salvo': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.activePlayerId !== botId) break;
      if (snapshot.turnTimeLeft < 11.5 && mem.actionCooldown <= 0) {
        const unrevealed = snapshot.cells.filter((c) => !c.revealed);
        if (unrevealed.length > 0) {
          const target = unrevealed[(me.slotIndex * 7 + snapshot.round * 3) % unrevealed.length];
          if (me.cursorCol !== target.col) {
            dx = Math.sign(target.col - me.cursorCol);
            mem.actionCooldown = 0.24;
          } else if (me.cursorRow !== target.row) {
            dy = Math.sign(target.row - me.cursorRow);
            mem.actionCooldown = 0.24;
          } else {
            if (me.sonarCharges > 0 && Math.random() < 0.25) {
              b = true;
            } else {
              a = true;
            }
            mem.actionCooldown = 0.95;
          }
        } else {
          a = true;
          mem.actionCooldown = 0.95;
        }
      }
      break;
    }

    case 'neon-checkers': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.activePlayerId !== botId) break;
      if (snapshot.turnTimeLeft < 11.4 && mem.actionCooldown <= 0) {
        if (me.boostCharges > 0 && Math.random() < 0.25) {
          b = true;
          mem.actionCooldown = 0.85;
        } else {
          a = true;
          mem.actionCooldown = 1.0;
        }
      }
      break;
    }

    case 'carrom-arena': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.activePlayerId !== botId || snapshot.phase !== 'aiming') break;
      const upperPucks = snapshot.pucks.filter((pk) => pk.y < snapshot.striker.y - 16);
      const targetPuck =
        upperPucks.find((pk) => pk.kind === 'queen') ||
        upperPucks.sort(
          (aPk, bPk) =>
            Math.hypot(aPk.x - snapshot.striker.x, aPk.y - snapshot.striker.y) -
            Math.hypot(bPk.x - snapshot.striker.x, bPk.y - snapshot.striker.y)
        )[0] ||
        snapshot.pucks[0];
      if (targetPuck) {
        // Pick closest upper corner pocket to cut the puck toward
        const pocket =
          snapshot.pockets.length > 0
            ? [...snapshot.pockets].sort(
                (p1, p2) =>
                  Math.hypot(p1.x - targetPuck.x, p1.y - targetPuck.y) -
                  Math.hypot(p2.x - targetPuck.x, p2.y - targetPuck.y)
              )[0]
            : null;
        const pDx = pocket ? pocket.x - targetPuck.x : 0;
        const pDy = pocket ? pocket.y - targetPuck.y : -1;
        const pLen = Math.hypot(pDx, pDy) || 1;
        // Aim slightly through the back of the puck toward pocket
        const aimTx = targetPuck.x - (pDx / pLen) * 14;
        const aimTy = Math.min(snapshot.striker.y - 24, targetPuck.y - (pDy / pLen) * 14);
        const desiredAngle = Math.atan2(aimTy - snapshot.striker.y, aimTx - snapshot.striker.x);
        let diff = desiredAngle - me.aimAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        if (Math.abs(diff) > 0.08 && snapshot.turnTimeLeft > 8.0) {
          dx = Math.cos(desiredAngle);
          dy = Math.min(-0.32, Math.sin(desiredAngle));
        } else if (snapshot.turnTimeLeft < 11.7 && mem.actionCooldown <= 0) {
          if (me.spinCharges > 0 && Math.random() < 0.35) {
            b = true;
          } else {
            a = true;
          }
          mem.actionCooldown = 1.1;
        }
      }
      break;
    }

    case 'dungeon-crawl-board': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.activePlayerId !== botId) break;
      if (
        (snapshot.phase === 'wait-roll' || snapshot.phase === 'combat') &&
        snapshot.turnTimeLeft < 11.6 &&
        mem.actionCooldown <= 0
      ) {
        if (me.potions > 0 && (me.hp <= 5 || snapshot.phase === 'combat') && Math.random() < 0.45) {
          b = true;
          mem.actionCooldown = 0.85;
        } else {
          a = true;
          mem.actionCooldown = 1.05;
        }
      }
      break;
    }

    case 'boom-kittens':
    case 'property-deal':
    case 'flip-seven':
    case 'royal-bluff':
    case 'dark-flip-clash':
    case 'sushi-draft':
    case 'pit-harvest':
    case 'big-two-royale':
    case 'lucky-21':
    case 'ten-pair-showdown':
    case 'landlord-clash':
    case 'speed-mahjong':
    case 'liars-dice-tavern':
    case 'undercover-word':
    case 'midnight-werewolf':
    case 'idiom-chain':
    case 'word-pulse':
    case 'trivia-blitz':
    case 'codenames-grid':
    case 'fib-party':
      // Card, Mahjong, Quiz & Social Deduction games run native AI inside each engine's step()
      break;

    case 'line-breakers': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      if (me.role === 'guard') {
        const runners = snapshot.players.filter((p) => p.role === 'runner' && p.alive);
        const { item: nearRunner, dist } = nearestOf(me.x, me.y, runners);
        if (nearRunner) {
          dx = clampUnit((nearRunner.x - me.x) / 90);
          dy = clampUnit((nearRunner.y - me.y) / 90);
          if (dist < 110 && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        }
      } else {
        const goalY = me.reachedFarEnd ? snapshot.courtY + snapshot.courtH - 25 : snapshot.courtY + 25;
        const targetX = snapshot.courtX + snapshot.courtW * (0.5 + Math.sin(mem.driftPhase) * 0.35);
        const s = steerToward(me.x, me.y, targetX, goalY, tuning);
        dx = s.dx;
        dy = s.dy;
        if (me.cooldownA <= 0 && canAct() && Math.random() < 0.28) {
          a = true;
          markActed();
        } else if (me.cooldownB <= 0 && canAct() && Math.random() < 0.16) {
          b = true;
          markActed();
        }
      }
      break;
    }

    case 'desk-flippers': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const { item: target, dist } = nearestOf(me.x, me.y, rivals);
      if (target) {
        const s = steerToward(me.x, me.y, target.x, target.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (dist < 175 && me.cooldownB <= 0 && canAct() && Math.random() < 0.4) {
          b = true;
          markActed();
        } else if (me.cooldownA <= 0 && canAct() && Math.random() < 0.45) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'spin-clash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const distCenter = Math.hypot(me.x - snapshot.ringCenterX, me.y - snapshot.ringCenterY);
      if (distCenter > snapshot.ringRadius * 0.72) {
        const s = steerToward(me.x, me.y, snapshot.ringCenterX, snapshot.ringCenterY, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
        const { item: target, dist } = nearestOf(me.x, me.y, rivals);
        if (target) {
          const s = steerToward(me.x, me.y, target.x, target.y, tuning, mem.driftPhase);
          dx = s.dx;
          dy = s.dy;
          if (dist < 165 && me.cooldownA <= 0 && canAct() && Math.random() < 0.35) {
            a = true;
            markActed();
          } else if (dist < 85 && me.cooldownB <= 0 && canAct() && Math.random() < 0.22) {
            b = true;
            markActed();
          }
        }
      }
      break;
    }

    case 'marble-ring': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const { item: target, dist } = nearestOf(me.x, me.y, snapshot.marbles);
      if (target) {
        const s = steerToward(me.x, me.y, target.x, target.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (dist < 380 && me.cooldownA <= 0 && canAct() && Math.random() < 0.4) {
          a = true;
          markActed();
        } else if (dist < 280 && me.cooldownB <= 0 && canAct() && Math.random() < 0.22) {
          b = true;
          markActed();
        }
      }
      break;
    }

    case 'rattan-volley': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const ballOnMySide = me.team === 'left' ? snapshot.ball.x <= snapshot.netX + 60 : snapshot.ball.x >= snapshot.netX - 60;
      const targetX = ballOnMySide ? snapshot.ball.x : me.team === 'left' ? 300 : ARENA_WIDTH - 300;
      dx = clampUnit((targetX - me.x) / 65);
      const distBall = Math.hypot(snapshot.ball.x - me.x, snapshot.ball.y - me.y);
      if (ballOnMySide && distBall < 115 && canAct()) {
        if (snapshot.ball.y < snapshot.floorY - 120 && Math.random() < 0.6) a = true;
        else b = true;
        markActed();
      }
      break;
    }

    case 'step-stomp': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const { item: target, dist } = nearestOf(me.x, me.y, rivals);
      if (snapshot.activeAttackerId === botId && target) {
        const s = steerToward(me.x, me.y, target.x, target.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (me.cooldownA <= 0 && canAct() && Math.random() < 0.45) {
          a = true;
          markActed();
        }
      } else if (snapshot.activeAttackerId && snapshot.activeAttackerId !== botId) {
        const attacker = snapshot.players.find((p) => p.id === snapshot.activeAttackerId);
        if (attacker && Math.hypot(attacker.x - me.x, attacker.y - me.y) < 170 && me.cooldownB <= 0 && canAct()) {
          dx = clampUnit((me.x - attacker.x) / 80);
          dy = clampUnit((me.y - attacker.y) / 80);
          b = true;
          markActed();
        }
      }
      break;
    }

    case 'melon-merge': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.overflowed) break;
      const sameTier = me.fruits.find((f) => f.tier === me.nextTier);
      const targetX = sameTier ? sameTier.x : 0.25 + ((Math.sin(mem.driftPhase) + 1) * 0.25);
      dx = clampUnit((targetX - me.aimX) * 5);
      if (Math.abs(targetX - me.aimX) < 0.08 && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      } else if (me.cooldownB <= 0 && me.fruits.length > 9 && canAct() && Math.random() < 0.15) {
        b = true;
        markActed();
      }
      break;
    }

    case 'tile-triple': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.failed) break;
      const open = me.tiles.filter((t) => !t.removed && !t.blocked);
      if (open.length === 0) break;
      // Prefer symbol already in tray!
      const traySet = new Set(me.tray);
      const target = open.find((t) => traySet.has(t.symbol)) ?? open[0];
      if (target.col !== me.cursorCol) dx = target.col > me.cursorCol ? 1 : -1;
      else if (target.row !== me.cursorRow) dy = target.row > me.cursorRow ? 1 : -1;
      else if (me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'block-hop': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive || me.inAir) break;
      const cur = snapshot.platforms.find((p) => p.index === me.platformIndex);
      const nxt = snapshot.platforms.find((p) => p.index === me.platformIndex + 1);
      if (cur && nxt) {
        const segLen = Math.hypot(nxt.x - cur.x, nxt.y - cur.y) || 1;
        const ux = (nxt.x - cur.x) / segLen;
        const uy = (nxt.y - cur.y) / segLen;
        const projDist = Math.max(60, (nxt.x - me.x) * ux + (nxt.y - me.y) * uy);
        const jitter = Math.sin(mem.driftPhase * 1.9 + me.slotIndex * 2.1 + me.platformIndex) * profile.aimError * 0.16;
        const idealCharge = clampUnit((projDist - 60) / 255 + jitter);
        rtHoldA = true;
        rtIsAggressiveA = false;
        rtIsOffensiveMove = false;
        if (me.charging < idealCharge - 0.025) {
          a = true;
        }
      }
      break;
    }

    case 'platform-leap': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const above = snapshot.platforms
        .filter((p) => !p.cracked && p.y <= me.y + 45 && p.y >= me.y - 190)
        .sort((p1, p2) => Math.abs(p1.x + p1.w / 2 - me.x) - Math.abs(p2.x + p2.w / 2 - me.x))[0];
      if (above) {
        dx = clampUnit((above.x + above.w / 2 - me.x) / 70);
      }
      if (me.vy > 80 && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'egg-rush': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.finished) break;
      dx = 1;
      dy = Math.sin(mem.driftPhase * 1.4) * 0.45;
      const nearObs = snapshot.obstacles.find((o) => o.x > me.x - 10 && o.x - me.x < 110 && Math.abs(o.y - me.y) < 75);
      if (nearObs && nearObs.kind === 'sweeper' && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      } else if (me.cooldownB <= 0 && canAct() && Math.random() < 0.25) {
        b = true;
        markActed();
      }
      break;
    }

    case 'goose-alert': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      if (me.role === 'goose') {
        const openSt = snapshot.stations.filter((s) => !s.completed);
        const { item: st, dist } = nearestOf(me.x, me.y, openSt);
        if (st) {
          const s = steerToward(me.x, me.y, st.x, st.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if (dist < 62) a = true;
        }
        if (me.cooldownB <= 0 && canAct() && Math.random() < 0.08) {
          b = true;
          markActed();
        }
      } else {
        const geese = snapshot.players.filter((p) => p.alive && p.role === 'goose');
        const { item: prey, dist } = nearestOf(me.x, me.y, geese);
        if (prey) {
          const s = steerToward(me.x, me.y, prey.x, prey.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if (dist < 64 && me.cooldownB <= 0 && canAct()) {
            b = true;
            markActed();
          }
        }
      }
      break;
    }

    case 'hotpot-rush': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const yummy = snapshot.ingredients.filter((i) => i.kind !== 'chili');
      const best = yummy
        .sort((i1, i2) => (i2.cookPct >= 55 ? i2.value * 2 : i2.value) - (i1.cookPct >= 55 ? i1.value * 2 : i1.value))[0];
      if (best) {
        const s = steerToward(me.tipX, me.tipY, best.x, best.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (Math.hypot(best.x - me.tipX, best.y - me.tipY) < best.r + 18 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'claw-mania': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.clawState !== 'aim') break;
      const good = snapshot.prizes.filter((p) => !p.grabbedBy && p.kind !== 'bomb');
      const { item: prize, dist } = nearestOf(me.x, me.y, good);
      if (prize) {
        const s = steerToward(me.x, me.y, prize.x, prize.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (dist < 26 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        } else if (me.cooldownB <= 0 && canAct() && Math.random() < 0.08) {
          b = true;
          markActed();
        }
      }
      break;
    }

    case 'truth-bomb': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (snapshot.phase === 'pass' && snapshot.holderId === botId && canAct()) {
        if (Math.random() < 0.25) b = true;
        else a = true;
        markActed();
      } else if (snapshot.phase === 'challenge' && snapshot.holderId !== botId && snapshot.phaseTimer < 8 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'draw-guess-relay': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.phase !== 'drawing') break;
      rtIsOffensiveMove = false;
      rtIsAggressiveA = false;
      if (me.isArtist) {
        rtHoldA = true;
        dx = Math.cos(mem.driftPhase * 2.1);
        dy = Math.sin(mem.driftPhase * 1.7);
        a = true;
      } else if (!me.lockedGuess && snapshot.timeLeft < 16 && canAct()) {
        if (Math.random() < 0.35) dy = 1;
        else a = true;
        markActed();
      }
      break;
    }

    case 'sky-climb': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const above = snapshot.platforms
        .filter((pl) => !pl.broken && pl.y < me.y - 10)
        .sort((x, y) => Math.hypot(x.x - me.x, x.y - me.y) - Math.hypot(y.x - me.x, y.y - me.y))[0];
      if (above) dx = clampUnit((above.x - me.x) / 90);
      if ((me.grounded || me.vy > 180) && canAct()) {
        a = true;
        markActed();
      } else if (me.vy > 340 && me.cooldownB <= 0 && canAct()) {
        b = true;
        markActed();
      }
      break;
    }

    case 'flappy-flock': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const nextPipe = snapshot.pipes
        .filter((pp) => pp.x > me.x - 25)
        .sort((x, y) => x.x - y.x)[0];
      const targetY = nextPipe ? nextPipe.gapY + 12 : ARENA_HEIGHT / 2;
      if (me.y > targetY && me.vy > -40 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'dino-dash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      const spd = snapshot.speed ?? 370;
      const lookAhead = 115 + spd * profile.reactionTime;
      const near = snapshot.obstacles.find((o) => o.x > me.x - 10 && o.x - me.x < lookAhead && o.kind !== 'star');
      if (near) {
        if (near.kind.startsWith('ptero')) b = true;
        else if (me.grounded) a = true;
      }
      break;
    }

    case 'tug-titan': {
      if (snapshot.pulseZone > 0.72 || Math.random() < 0.35) a = true;
      break;
    }

    case 'glass-bridge': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.falling || me.finished) break;
      const nextStep = me.step + 1;
      const knownSafe = snapshot.panels.find((pn) => pn.step === nextStep && pn.state === 'safe-revealed');
      const knownBad = snapshot.panels.find((pn) => pn.step === nextStep && pn.state === 'shattered');
      const desiredLane = knownSafe ? knownSafe.lane : knownBad ? (knownBad.lane === 0 ? 1 : 0) : (Math.sin(mem.driftPhase) > 0 ? 0 : 1);
      dy = desiredLane === 0 ? -0.8 : 0.8;
      if (me.lane === desiredLane && canAct() && Math.random() < 0.45) {
        a = true;
        markActed();
      }
      break;
    }

    case 'tile-2048-blitz': {
      if (canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'geo-pin-rush': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.locked || snapshot.phase !== 'guessing') break;
      const spread = profile.aimError * 0.72 + profile.evaluationNoise * 0.35;
      const tx = clampUnit(snapshot.targetX + Math.sin(mem.driftPhase * 0.7 + me.slotIndex) * spread);
      const ty = clampUnit(snapshot.targetY + Math.cos(mem.driftPhase * 0.9 + me.slotIndex) * spread);
      dx = clampUnit((tx - me.x) * 6);
      dy = clampUnit((ty - me.y) * 6);
      if (Math.hypot(tx - me.x, ty - me.y) < 0.06 && snapshot.timeLeft < 9) a = true;
      break;
    }

    case 'wavelength-sync': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.locked || snapshot.phase !== 'dialing') break;
      const spread = profile.aimError * 0.65 + profile.evaluationNoise * 0.35;
      const tgt = Math.max(
        0.05,
        Math.min(0.95, snapshot.targetAngle + Math.sin(mem.driftPhase * 0.8 + me.slotIndex) * spread),
      );
      dx = clampUnit((tgt - me.dial) * 6);
      if (Math.abs(tgt - me.dial) < 0.04 && snapshot.timeLeft < 7.5) a = true;
      break;
    }

    case 'brick-clash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const lowestBall = [...snapshot.balls].sort((x, y) => y.y - x.y)[0];
      if (lowestBall) dx = clampUnit((lowestBall.x - me.x) / 60);
      if (me.cooldownB <= 0 && canAct() && Math.random() < 0.25) {
        b = true;
        markActed();
      }
      break;
    }

    case 'alien-wave': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const target = snapshot.aliens[0];
      if (target) dx = clampUnit((target.x - me.x) / 50);
      a = true;
      if (me.cooldownB <= 0 && Math.random() < 0.08) b = true;
      break;
    }

    case 'rhythm-pulse': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      const nextNote = snapshot.notes
        .filter((n) => n.y <= 635)
        .sort((x, y) => y.y - x.y)[0];
      if (nextNote) {
        dx = nextNote.lane === 0 ? -0.9 : nextNote.lane === 3 ? 0.9 : 0;
        dy = nextNote.lane === 1 ? -0.9 : nextNote.lane === 2 ? 0.9 : 0;
        const triggerY = 585 - 330 * profile.reactionTime * 0.88;
        if (nextNote.y >= triggerY - 34 && nextNote.y <= 605 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'whack-blitz': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const good = snapshot.holes.filter((h) => h.mole === 'golden' || h.mole === 'normal');
      const { item: tgt, dist } = nearestOf(me.x, me.y, good);
      if (tgt) {
        const s = steerToward(me.x, me.y, tgt.x, tgt.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (dist < 62 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'air-hockey-neo': {
      const me = snapshot.players.find((p) => p.id === botId);
      const pk = snapshot.pucks[0];
      if (!me || !pk) break;
      const s = steerToward(me.x, me.y, pk.x, pk.y, tuning);
      dx = s.dx;
      dy = s.dy;
      if (Math.hypot(pk.x - me.x, pk.y - me.y) < 85 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'stack-tower': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      const top = me.blocks[me.blocks.length - 1];
      if (top && Math.abs(me.moverX - top.x) < 0.085 + profile.reactionTime * 0.22 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    // ------------------------------------------------------------------
    // Pack 5 — Sports & Physics Showdowns
    // ------------------------------------------------------------------
    case 'hoop-blitz': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const targetX = clampUnit((snapshot.hoopX - me.x) / 140);
      dx = targetX;
      if (me.cooldownA <= 0) {
        rtHoldA = true;
        rtIsAggressiveA = false;
        if (!me.charging) {
          a = true;
        } else if (me.power < 0.7 + Math.sin(mem.driftPhase) * 0.06) {
          a = true;
        }
      }
      if (me.cooldownB <= 0 && canAct() && Math.random() < 0.08) {
        b = true;
        markActed();
      }
      break;
    }

    case 'penalty-duel': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const targetCorner =
        snapshot.keeperX > snapshot.goalX
          ? snapshot.goalX - snapshot.goalW * 0.36
          : snapshot.goalX + snapshot.goalW * 0.36;
      dx = clampUnit((targetCorner - me.aimX) / 90);
      if (Math.abs(targetCorner - me.aimX) < 55 && canAct()) {
        if (me.cooldownB <= 0 && Math.random() < 0.35) b = true;
        else if (me.cooldownA <= 0) a = true;
        markActed();
      }
      break;
    }

    case 'mini-golf-pro': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.sunk) break;
      const vx = snapshot.cupX - me.x;
      const vy = snapshot.cupY - me.y;
      const len = Math.hypot(vx, vy) || 1;
      dx = clampUnit((vx / len) * 0.9);
      dy = clampUnit((vy / len) * 0.9);
      const moving = Math.hypot(me.vx, me.vy) > 28;
      if (!moving && me.cooldownA <= 0) {
        const wantPower = Math.min(0.9, Math.max(0.32, len / 780));
        rtHoldA = true;
        rtIsAggressiveA = false;
        if (!me.charging) a = true;
        else if (me.power < wantPower) a = true;
      }
      break;
    }

    case 'archery-wind': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const aimTargetX = snapshot.targetX - snapshot.windX * 0.65;
      const aimTargetY = snapshot.targetY - snapshot.windY * 0.65;
      const steer = steerToward(me.aimX, me.aimY, aimTargetX, aimTargetY, tuning);
      dx = steer.dx;
      dy = steer.dy;
      if (me.cooldownA <= 0) {
        rtHoldA = true;
        rtIsAggressiveA = false;
        if (!me.drawing && Math.hypot(aimTargetX - me.aimX, aimTargetY - me.aimY) < 90) {
          a = true;
        } else if (me.drawing && me.drawPct < 0.78) {
          a = true;
        }
      }
      if (me.cooldownB <= 0 && canAct() && Math.random() < 0.08) {
        b = true;
        markActed();
      }
      break;
    }

    case 'boxing-ko': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const { item: rival, dist: rDist } = nearestOf(me.x, me.y, rivals);
      if (rival) {
        const s = steerToward(me.x, me.y, rival.x, rival.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (rival.punchTimer > 0.05 && rDist < 85 && me.stamina > 20) {
          b = true;
        } else if (rDist < 76 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'ping-pong-pro': {
      const me = snapshot.players.find((p) => p.id === botId);
      const ball = snapshot.balls[0];
      if (!me || !ball) break;
      if (me.side === 'left' || me.side === 'right') {
        dy = clampUnit((ball.y - me.y) / 65);
      } else {
        dx = clampUnit((ball.x - me.x) / 65);
      }
      if (Math.hypot(ball.x - me.x, ball.y - me.y) < 92 && canAct()) {
        if (me.cooldownB <= 0 && Math.random() < 0.25) b = true;
        else if (me.cooldownA <= 0) a = true;
        markActed();
      }
      break;
    }

    case 'home-run-derby': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      const incoming = snapshot.pitches.find((pt) => {
        if (!pt.active) return false;
        const triggerY = 560 - pt.speed * profile.reactionTime * 0.9;
        return pt.y >= triggerY - 26 && pt.y <= 585;
      });
      if (incoming && me.cooldownA <= 0) {
        a = true;
      }
      if (me.cooldownB <= 0 && canAct() && Math.random() < 0.08) {
        b = true;
        markActed();
      }
      break;
    }

    case 'dodgeball-riot': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      rtIsAggressiveA = false;
      if (me.hasBall) {
        const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
        const { item: tgt, dist: tDist } = nearestOf(me.x, me.y, rivals);
        if (tgt) {
          const aimAng = Math.atan2(tgt.y - me.y, tgt.x - me.x);
          dx = Math.cos(aimAng);
          dy = Math.sin(aimAng);
          const angDiff = Math.abs(Math.atan2(Math.sin(aimAng - me.angle), Math.cos(aimAng - me.angle)));
          if (tDist < 540 && angDiff < 0.45 && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        }
      } else {
        rtIsOffensiveMove = false;
        const hotBall = snapshot.balls.find((bl) => bl.hot && bl.ownerId !== botId && Math.hypot(bl.x - me.x, bl.y - me.y) < 145);
        if (hotBall && me.cooldownB <= 0) {
          b = true;
        }
        const loose = snapshot.balls.filter((bl) => !bl.hot);
        const { item: pick } = nearestOf(me.x, me.y, loose);
        if (pick) {
          const s = steerToward(me.x, me.y, pick.x, pick.y, tuning);
          dx = s.dx;
          dy = s.dy;
        } else {
          const s = steerToward(me.x, me.y, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, tuning);
          dx = s.dx;
          dy = s.dy;
        }
      }
      break;
    }

    case 'sumo-clash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const dCenter = Math.hypot(me.x - ARENA_WIDTH / 2, me.y - 375);
      if (dCenter > snapshot.ringRadius * 0.72) {
        const s = steerToward(me.x, me.y, ARENA_WIDTH / 2, 375, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
        const { item: tgt, dist: rDist } = nearestOf(me.x, me.y, rivals);
        if (tgt) {
          const s = steerToward(me.x, me.y, tgt.x, tgt.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if (rDist < 155 && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          } else if (rDist < 130 && me.cooldownB <= 0 && canAct()) {
            b = true;
            markActed();
          }
        }
      }
      break;
    }

    case 'canoe-sprint': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const nextGate = snapshot.gates.find((g) => g.dist > me.dist - 15 && g.dist < me.dist + 360);
      if (nextGate) {
        dx = clampUnit((nextGate.x - me.laneX) / 85);
      }
      if (me.cooldownA <= 0) a = true;
      if (me.cooldownB <= 0 && canAct() && Math.random() < 0.08) {
        b = true;
        markActed();
      }
      break;
    }

    case 'disc-arena': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (snapshot.disc.holderId === botId) {
        dy = Math.sin(mem.driftPhase * 2) * 0.8;
        a = true;
      } else {
        const s = steerToward(me.x, me.y, snapshot.disc.x, snapshot.disc.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (Math.hypot(snapshot.disc.x - me.x, snapshot.disc.y - me.y) > 130 && me.cooldownB <= 0 && canAct()) {
          b = true;
          markActed();
        }
      }
      break;
    }

    case 'badminton-smash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const targetX = snapshot.shuttle.x;
      dx = clampUnit((targetX - me.x) / 60);
      if (Math.hypot(snapshot.shuttle.x - me.x, snapshot.shuttle.y - (me.y - 30)) < 110 && canAct()) {
        if (me.cooldownA <= 0) a = true;
        else if (me.cooldownB <= 0) b = true;
        markActed();
      }
      break;
    }

    case 'billiards-snooker': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const { item: ball } = nearestOf(me.x, me.y, snapshot.balls);
      if (ball) {
        const vx = ball.x - me.x;
        const vy = ball.y - me.y;
        const len = Math.hypot(vx, vy) || 1;
        dx = clampUnit(vx / len);
        dy = clampUnit(vy / len);
      }
      if (me.cooldownA <= 0) {
        rtHoldA = true;
        rtIsAggressiveA = false;
        if (!me.charging) a = true;
        else if (me.power < 0.72) a = true;
      }
      break;
    }

    case 'tether-joust': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const { item: tgt, dist: tDist } = nearestOf(me.x, me.y, rivals);
      if (tgt) {
        const s = steerToward(me.x, me.y, tgt.x, tgt.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (tDist < 220 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        } else if (tgt.lungeTimer > 0 && tDist < 120 && me.cooldownB <= 0) {
          b = true;
        }
      }
      break;
    }

    // ------------------------------------------------------------------
    // Pack 6 — Chaos Party & Survival Games
    // ------------------------------------------------------------------
    case 'laser-jump-rope': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      const { item: gem } = nearestOf(me.x, me.y, snapshot.gems);
      if (gem) {
        const s = steerToward(me.x, me.y, gem.x, gem.y, tuning);
        dx = s.dx;
        dy = s.dy;
      }
      const rx = me.x - ARENA_WIDTH / 2;
      const ry = me.y - 375;
      const angles = snapshot.doubleBeam ? [snapshot.beamAngle, snapshot.beamAngle + Math.PI] : [snapshot.beamAngle];
      for (const ang of angles) {
        const bx = Math.cos(ang);
        const by = Math.sin(ang);
        const proj = rx * bx + ry * by;
        const perp = Math.abs(rx * -by + ry * bx);
        if (proj > 20 && perp < 62 + profile.reactionTime * 110 && me.z <= 2 && me.cooldownA <= 0) {
          a = true;
          break;
        }
      }
      break;
    }

    case 'hot-lava-floor': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const bestPlatforms = snapshot.platforms.filter((pl) => pl.safe && !pl.sinking);
      const safePool = bestPlatforms.length > 0 ? bestPlatforms : snapshot.platforms.filter((pl) => pl.safe);
      const { item: safePlat, dist: pDist } = nearestOf(me.x, me.y, safePool);
      if (safePlat) {
        const s = steerToward(me.x, me.y, safePlat.x, safePlat.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (pDist > 75 && me.z <= 1 && me.cooldownA <= 0) a = true;
      }
      if (me.cooldownB <= 0 && canAct() && Math.random() < 0.08) {
        b = true;
        markActed();
      }
      break;
    }

    case 'bomb-tag-arena': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      if (snapshot.bombHolderId === botId) {
        const { item: tgt, dist: tDist } = nearestOf(me.x, me.y, rivals);
        if (tgt) {
          const s = steerToward(me.x, me.y, tgt.x, tgt.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if (tDist < 190 && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        }
      } else {
        const holder = snapshot.players.find((p) => p.id === snapshot.bombHolderId);
        if (holder) {
          const awayX = clampUnit((me.x - holder.x) / 100);
          const awayY = clampUnit((me.y - holder.y) / 100);
          const centerX = clampUnit((ARENA_WIDTH / 2 - me.x) / 260);
          const centerY = clampUnit((375 - me.y) / 180);
          dx = clampUnit(awayX * 0.75 + centerX * 0.35);
          dy = clampUnit(awayY * 0.75 + centerY * 0.35);
          if (Math.hypot(me.x - holder.x, me.y - holder.y) < 120) {
            if (me.cooldownB <= 0) b = true;
            else if (me.cooldownA <= 0) a = true;
          }
        }
      }
      break;
    }

    case 'musical-thrones': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      if (snapshot.phase === 'scramble') {
        const openPods = snapshot.pods.filter((pd) => !pd.occupantId || pd.occupantId === botId);
        const { item: pod, dist: pdDist } = nearestOf(me.x, me.y, openPods);
        if (pod) {
          const s = steerToward(me.x, me.y, pod.x, pod.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if (pdDist > 80 && me.cooldownA <= 0) a = true;
        }
      } else {
        const ang = mem.driftPhase + me.slotIndex;
        const tx = ARENA_WIDTH / 2 + Math.cos(ang) * 210;
        const ty = 375 + Math.sin(ang) * 145;
        const s = steerToward(me.x, me.y, tx, ty, tuning);
        dx = s.dx;
        dy = s.dy;
      }
      break;
    }

    case 'sumo-ice-drift': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const dCenter = Math.hypot(me.x - ARENA_WIDTH / 2, me.y - 375);
      if (dCenter > snapshot.iceRadius * 0.62) {
        const s = steerToward(me.x, me.y, ARENA_WIDTH / 2, 375, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
        const { item: tgt, dist: tDist } = nearestOf(me.x, me.y, rivals);
        if (tgt) {
          const s = steerToward(me.x, me.y, tgt.x, tgt.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if (tDist < 135 && me.cooldownB <= 0 && canAct()) {
            b = true;
            markActed();
          }
        }
      }
      break;
    }

    case 'meteor-dodge-x': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      const { item: nearHazard, dist: hDist } = nearestOf(me.x, me.y, snapshot.meteors);
      if (nearHazard && hDist < nearHazard.r + 50) {
        dx = clampUnit((me.x - nearHazard.x) / 50);
        dy = clampUnit((me.y - nearHazard.y) / 50);
        if (me.cooldownA <= 0) a = true;
      } else if (snapshot.craters.length > 0) {
        const { item: crater } = nearestOf(me.x, me.y, snapshot.craters);
        if (crater) {
          const s = steerToward(me.x, me.y, crater.x, crater.y, tuning);
          dx = s.dx;
          dy = s.dy;
        }
      } else {
        dx = Math.cos(mem.wanderAngle) * 0.65;
        dy = Math.sin(mem.wanderAngle) * 0.65;
      }
      break;
    }

    case 'falling-anvils': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      rtIsAggressiveA = false;
      const urgent = snapshot.anvils.filter((av) => av.progress >= 0.32 + profile.reactionTime * 0.85);
      const { item: nearHazard, dist: hDist } = nearestOf(me.x, me.y, urgent);
      if (nearHazard && hDist < nearHazard.r + (28 - profile.mistakeRate * 65)) {
        rtIsOffensiveMove = false;
        dx = clampUnit((me.x - nearHazard.x) / 45);
        dy = clampUnit((me.y - nearHazard.y) / 45);
        if (me.cooldownA <= 0 && nearHazard.progress > 0.65) a = true;
      } else {
        const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
        const { item: rival, dist: rDist } = nearestOf(me.x, me.y, rivals);
        if (rival && (rDist < 240 || profile.aggression >= 0.45)) {
          const s = steerToward(me.x, me.y, rival.x, rival.y, tuning);
          dx = s.dx;
          dy = s.dy;
          const anvilNearRival = snapshot.anvils.some((av) => Math.hypot(av.x - rival.x, av.y - rival.y) < av.r + 135);
          if (rDist < 84 && me.cooldownB <= 0 && (anvilNearRival || canAct())) {
            b = true;
            markActed();
          }
        } else {
          rtIsOffensiveMove = false;
          dx = Math.cos(mem.wanderAngle + me.slotIndex) * 0.65;
          dy = Math.sin(mem.wanderAngle + me.slotIndex) * 0.65;
        }
      }
      break;
    }

    case 'king-of-hill-neo': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const s = steerToward(me.x, me.y, snapshot.zoneX, snapshot.zoneY, tuning);
      dx = s.dx;
      dy = s.dy;
      if (s.dist > snapshot.zoneR && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      }
      if (me.inZone && me.cooldownB <= 0 && canAct() && Math.random() < 0.25) {
        b = true;
        markActed();
      }
      break;
    }

    case 'laser-maze-heist': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const { item: gem } = nearestOf(me.x, me.y, snapshot.diamonds);
      if (gem) {
        const s = steerToward(me.x, me.y, gem.x, gem.y, tuning);
        dx = s.dx;
        dy = s.dy;
      }
      for (const sw of snapshot.sweepers) {
        const bx = Math.cos(sw.angle);
        const by = Math.sin(sw.angle);
        const rx = me.x - sw.x;
        const ry = me.y - sw.y;
        const proj = Math.max(0, Math.min(sw.length, rx * bx + ry * by));
        const d = Math.hypot(me.x - (sw.x + bx * proj), me.y - (sw.y + by * proj));
        if (d < 52) {
          a = true;
          break;
        }
      }
      break;
    }

    case 'zombie-outbreak': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (me.infected) {
        const humans = snapshot.players.filter((p) => !p.infected);
        const { item: prey, dist: pDist } = nearestOf(me.x, me.y, humans);
        if (prey) {
          const s = steerToward(me.x, me.y, prey.x, prey.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if (pDist < 170 && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        }
      } else {
        const zombies = snapshot.players.filter((p) => p.infected);
        const { item: zmb, dist: zDist } = nearestOf(me.x, me.y, zombies);
        if (zmb && zDist < 170) {
          dx = clampUnit((me.x - zmb.x) / 60);
          dy = clampUnit((me.y - zmb.y) / 60);
          if (zDist < 95 && me.cooldownB <= 0) b = true;
          else if (me.cooldownA <= 0) a = true;
        } else {
          const { item: orb } = nearestOf(me.x, me.y, snapshot.cureOrbs);
          if (orb) {
            const s = steerToward(me.x, me.y, orb.x, orb.y, tuning);
            dx = s.dx;
            dy = s.dy;
          }
        }
      }
      break;
    }

    case 'seesaw-balance': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      let targetOff = -snapshot.beamTilt * 240;
      if (snapshot.coins.length > 0 && Math.abs(snapshot.beamTilt) < 0.34) {
        let bestCoin = snapshot.coins[0];
        let bestDist = Infinity;
        for (const c of snapshot.coins) {
          const d = Math.abs(c.offset - me.offset);
          if (d < bestDist) {
            bestDist = d;
            bestCoin = c;
          }
        }
        targetOff = bestCoin.offset;
      }
      dx = clampUnit((targetOff - me.offset) / 95);
      if (Math.abs(me.offset) > 300 && Math.abs(snapshot.beamTilt) > 0.25) b = true;
      break;
    }

    case 'chain-gang-climb': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const { item: nearSaw, dist: sDist } = nearestOf(me.x, me.y, snapshot.hazards);
      if (nearSaw && sDist < 110) {
        dx = clampUnit((me.x - nearSaw.x) / 45);
        dy = clampUnit((me.y - nearSaw.y) / 45);
        if (me.cooldownA <= 0) a = true;
      } else if (snapshot.stars.length > 0) {
        const { item: st } = nearestOf(me.x, me.y, snapshot.stars);
        if (st) {
          const s = steerToward(me.x, me.y, st.x, st.y, tuning);
          dx = s.dx;
          dy = s.dy;
        }
      }
      break;
    }

    case 'confetti-capture': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const tx = ARENA_WIDTH / 2 + Math.cos(mem.driftPhase + me.slotIndex * 1.4) * 320;
      const ty = 375 + Math.sin(mem.driftPhase * 1.3 + me.slotIndex) * 190;
      const s = steerToward(me.x, me.y, tx, ty, tuning);
      dx = s.dx;
      dy = s.dy;
      if (me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      } else if (me.cooldownB <= 0 && canAct()) {
        b = true;
        markActed();
      }
      break;
    }

    case 'crane-drop-chaos': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const { item: nearBall, dist: bDist } = nearestOf(me.x, me.y, snapshot.balls);
      if (nearBall && bDist < 110) {
        dx = clampUnit((me.x - nearBall.x) / 45);
        dy = clampUnit((me.y - nearBall.y) / 45);
        if (bDist < 75 && me.cooldownB <= 0) b = true;
        else if (me.cooldownA <= 0) a = true;
      } else {
        const s = steerToward(me.x, me.y, ARENA_WIDTH / 2 + Math.cos(mem.driftPhase) * 90, 375 + Math.sin(mem.driftPhase) * 90, tuning);
        dx = s.dx;
        dy = s.dy;
      }
      break;
    }

    case 'roulette-arena': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const ax = 180;
      const ay = 135;
      const aw = ARENA_WIDTH - 360;
      const ah = ARENA_HEIGHT - 230;
      const cw = aw / snapshot.cols;
      const ch = ah / snapshot.rows;
      let bestX = ARENA_WIDTH / 2;
      let bestY = 375;
      let bestD = Infinity;
      for (let r = 0; r < snapshot.rows; r++) {
        for (let c = 0; c < snapshot.cols; c++) {
          if (snapshot.tileStates[r * snapshot.cols + c] === 0) {
            const cx = ax + (c + 0.5) * cw;
            const cy = ay + (r + 0.5) * ch;
            const d = Math.hypot(cx - me.x, cy - me.y);
            if (d < bestD) {
              bestD = d;
              bestX = cx;
              bestY = cy;
            }
          }
        }
      }
      const s = steerToward(me.x, me.y, bestX, bestY, tuning);
      dx = s.dx;
      dy = s.dy;
      if (bestD > 120 && me.cooldownA <= 0) a = true;
      break;
    }

    case 'gomoku-blitz': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const sz = snapshot.size;
      const curIdx = me.cursorR * sz + me.cursorC;
      if (snapshot.cells[curIdx] === -1 && Math.random() < 0.55) {
        a = true;
      } else {
        // Seek nearest empty cell to own stones or center
        let targetR = Math.floor(sz / 2);
        let targetC = Math.floor(sz / 2);
        let bestScore = Infinity;
        for (let r = 0; r < sz; r++) {
          for (let c = 0; c < sz; c++) {
            if (snapshot.cells[r * sz + c] !== -1) continue;
            const d = Math.abs(r - me.cursorR) + Math.abs(c - me.cursorC) + Math.abs(r - 5) * 0.25 + Math.abs(c - 5) * 0.25;
            if (d < bestScore) {
              bestScore = d;
              targetR = r;
              targetC = c;
            }
          }
        }
        if (Math.abs(targetC - me.cursorC) >= Math.abs(targetR - me.cursorR) && targetC !== me.cursorC) {
          dx = Math.sign(targetC - me.cursorC);
        } else if (targetR !== me.cursorR) {
          dy = Math.sign(targetR - me.cursorR);
        }
        if (snapshot.cells[curIdx] === -1 && me.cooldownB <= 0 && Math.random() < 0.08) b = true;
      }
      break;
    }

    case 'chess-blitz': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      let targetR = me.r;
      let targetC = me.c;
      let bestDist = Infinity;
      for (const pw of snapshot.pawns) {
        const d = Math.abs(pw.r - me.r) + Math.abs(pw.c - me.c) - (pw.gold ? 1.5 : 0);
        if (d < bestDist) {
          bestDist = d;
          targetR = pw.r;
          targetC = pw.c;
        }
      }
      if (Math.abs(targetC - me.c) >= Math.abs(targetR - me.r) && targetC !== me.c) {
        dx = Math.sign(targetC - me.c);
      } else if (targetR !== me.r) {
        dy = Math.sign(targetR - me.r);
      } else {
        dx = Math.cos(mem.wanderAngle);
        dy = Math.sin(mem.wanderAngle);
      }
      if (me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      } else if (me.cooldownB <= 0 && canAct() && Math.random() < 0.35) {
        b = true;
        markActed();
      }
      break;
    }

    case 'domino-chain': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const matchIdx = me.tiles.findIndex(
        ([tA, tB]) => tA === snapshot.leftEnd || tB === snapshot.leftEnd || tA === snapshot.rightEnd || tB === snapshot.rightEnd
      );
      if (matchIdx >= 0) {
        if (matchIdx > me.cursorIdx) dx = 1;
        else if (matchIdx < me.cursorIdx) dx = -1;
        else if (me.cooldownA <= 0) a = true;
      } else if (me.cooldownB <= 0) {
        b = true;
      }
      break;
    }

    case 'hexagon-conquest': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const curIdx = me.r * snapshot.cols + me.c;
      if (snapshot.owners[curIdx] !== me.slotIndex && me.cooldownA <= 0) {
        a = true;
      } else {
        let bestR = Math.floor(snapshot.rows / 2);
        let bestC = Math.floor(snapshot.cols / 2);
        let bestD = Infinity;
        for (let r = 0; r < snapshot.rows; r++) {
          for (let c = 0; c < snapshot.cols; c++) {
            const owner = snapshot.owners[r * snapshot.cols + c];
            if (owner === me.slotIndex) continue;
            const d = Math.abs(r - me.r) + Math.abs(c - me.c) - (owner >= 0 ? 0.8 : 0);
            if (d < bestD) {
              bestD = d;
              bestR = r;
              bestC = c;
            }
          }
        }
        if (Math.abs(bestC - me.c) >= Math.abs(bestR - me.r) && bestC !== me.c) dx = Math.sign(bestC - me.c);
        else if (bestR !== me.r) dy = Math.sign(bestR - me.r);
        if (me.cooldownB <= 0 && canAct() && Math.random() < 0.3) {
          b = true;
          markActed();
        }
      }
      break;
    }

    case 'backgammon-sprint': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const chosen = me.pips[me.cursorPip] ?? snapshot.trackLen;
      if (chosen >= snapshot.trackLen) {
        dx = 1;
      } else if (me.cooldownB <= 0 && canAct() && Math.random() < 0.25) {
        b = true;
        markActed();
      } else if (me.cooldownA <= 0) {
        a = true;
      }
      break;
    }

    case 'mancala-jewels': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      let bestPit = me.cursorPit;
      let bestGems = -1;
      snapshot.pits.forEach((g, idx) => {
        if (g > bestGems) {
          bestGems = g;
          bestPit = idx;
        }
      });
      if (bestGems <= 0) {
        if (me.cooldownB <= 0) b = true;
      } else if (bestPit !== me.cursorPit) {
        const diff = (bestPit - me.cursorPit + snapshot.pits.length) % snapshot.pits.length;
        dx = diff <= snapshot.pits.length / 2 ? 1 : -1;
      } else if (me.cooldownA <= 0) {
        a = true;
      }
      break;
    }

    case 'curling-masters': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const targetX = snapshot.houseX + Math.sin(mem.driftPhase + me.slotIndex) * 34;
      dx = clampUnit((targetX - me.aimX) / 45);
      if (me.charging) {
        if (me.power < 0.72) a = true;
        else a = false; // release to throw stone!
      } else if (me.cooldownA <= 0 && Math.abs(targetX - me.aimX) < 35) {
        a = true;
      } else if (snapshot.stones.some((st) => st.ownerId === botId && Math.hypot(st.vx, st.vy) > 15)) {
        if (Math.random() < 0.45) b = true; // sweep moving stone
      }
      break;
    }

    case 'slither-feast': {
      const me = snapshot.snakes.find((s) => s.id === botId);
      if (!me || !me.alive || me.segments.length === 0) break;
      const head = me.segments[0];
      // Check wall / rival body danger ahead
      let danger = false;
      for (const other of snapshot.snakes) {
        if (!other.alive || other.id === botId) continue;
        for (let k = 0; k < other.segments.length; k += 2) {
          const seg = other.segments[k];
          if (Math.hypot(seg.x - head.x, seg.y - head.y) < 95) {
            const away = steerToward(seg.x, seg.y, head.x, head.y, tuning);
            dx = away.dx;
            dy = away.dy;
            danger = true;
            if (me.cooldownB <= 0 && canAct() && Math.random() < 0.35) {
              b = true;
              markActed();
            }
            break;
          }
        }
        if (danger) break;
      }
      if (!danger) {
        if (head.x < 95 || head.x > ARENA_WIDTH - 95 || head.y < 95 || head.y > ARENA_HEIGHT - 95) {
          const toCenter = steerToward(head.x, head.y, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, tuning);
          dx = toCenter.dx;
          dy = toCenter.dy;
        } else {
          const bigPellets = snapshot.pellets.filter((p) => p.value >= 20);
          const pool = bigPellets.length > 0 ? bigPellets : snapshot.pellets;
          const { item: pel, dist } = nearestOf(head.x, head.y, pool);
          if (pel) {
            const aim = steerToward(head.x, head.y, pel.x, pel.y, tuning, mem.wanderAngle);
            dx = aim.dx;
            dy = aim.dy;
            if (me.length > 14 && dist < 170 && pel.value >= 20) a = true;
          } else {
            dx = Math.cos(mem.wanderAngle) * tuning.moveScale;
            dy = Math.sin(mem.wanderAngle) * tuning.moveScale;
          }
        }
      }
      break;
    }

    case 'blob-devour': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const threats = snapshot.players.filter((p) => p.id !== botId && p.alive && p.mass > me.mass * 1.16);
      const { item: threat, dist: tDist } = nearestOf(me.x, me.y, threats);
      if (threat && tDist < me.r + threat.r + 125) {
        const away = steerToward(threat.x, threat.y, me.x, me.y, tuning);
        dx = away.dx;
        dy = away.dy;
        if (me.cooldownB <= 0 && canAct()) {
          b = true;
          markActed();
        }
      } else {
        const prey = snapshot.players.filter((p) => p.id !== botId && p.alive && me.mass > p.mass * 1.2);
        const { item: target, dist: pDist } = nearestOf(me.x, me.y, prey);
        if (target && pDist < 360) {
          const aim = steerToward(me.x, me.y, target.x, target.y, tuning, mem.wanderAngle);
          dx = aim.dx;
          dy = aim.dy;
          if (pDist < 140 && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        } else {
          const { item: pel } = nearestOf(me.x, me.y, snapshot.pellets);
          if (pel) {
            const aim = steerToward(me.x, me.y, pel.x, pel.y, tuning, mem.wanderAngle);
            dx = aim.dx;
            dy = aim.dy;
          }
        }
      }
      break;
    }

    case 'turf-ribbon': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const gx = Math.floor(me.x);
      const gy = Math.floor(me.y);
      const onHome = gx >= 0 && gx < snapshot.cols && gy >= 0 && gy < snapshot.rows && snapshot.cells[gy * snapshot.cols + gx] === me.slotIndex;
      if (me.x < 3 || me.x > snapshot.cols - 3 || me.y < 3 || me.y > snapshot.rows - 3) {
        const home = steerToward(me.x, me.y, snapshot.cols / 2, snapshot.rows / 2, tuning);
        dx = home.dx;
        dy = home.dy;
      } else if (!onHome && (Math.sin(mem.driftPhase * 1.7) > 0.35 || snapshot.trails.filter((t) => t === me.slotIndex).length > 16)) {
        // Loop back toward closest owned cell to lock turf safely!
        let bestDist = Infinity;
        let homeX = snapshot.cols / 2;
        let homeY = snapshot.rows / 2;
        for (let r = 0; r < snapshot.rows; r += 2) {
          for (let c = 0; c < snapshot.cols; c += 2) {
            if (snapshot.cells[r * snapshot.cols + c] === me.slotIndex) {
              const d = Math.hypot(c + 0.5 - me.x, r + 0.5 - me.y);
              if (d < bestDist) {
                bestDist = d;
                homeX = c + 0.5;
                homeY = r + 0.5;
              }
            }
          }
        }
        const back = steerToward(me.x, me.y, homeX, homeY, tuning);
        dx = back.dx;
        dy = back.dy;
      } else {
        dx = Math.cos(mem.wanderAngle);
        dy = Math.sin(mem.wanderAngle);
      }
      if (me.cooldownA <= 0 && canAct() && Math.random() < 0.28) {
        a = true;
        markActed();
      } else if (!onHome && me.cooldownB <= 0 && canAct() && Math.random() < 0.2) {
        b = true;
        markActed();
      }
      break;
    }

    case 'mine-sweep-duel': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.stunTimer > 0) break;
      const idx = me.row * snapshot.cols + me.col;
      const cur = snapshot.cells[idx];
      if (cur && cur.state === 'hidden') {
        if (canAct()) {
          // Check neighboring revealed clue counts
          let adjHint = 0;
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              const nr = me.row + dr;
              const nc = me.col + dc;
              if (nr >= 0 && nr < snapshot.rows && nc >= 0 && nc < snapshot.cols) {
                const nb = snapshot.cells[nr * snapshot.cols + nc];
                if (nb?.state === 'revealed') adjHint = Math.max(adjHint, nb.adj);
              }
            }
          }
          if (adjHint >= 2 && Math.random() < 0.35) b = true;
          else a = true;
          markActed();
        }
      } else {
        let bestC = me.col;
        let bestR = me.row;
        let bestD = Infinity;
        for (let r = 0; r < snapshot.rows; r++) {
          for (let c = 0; c < snapshot.cols; c++) {
            if (snapshot.cells[r * snapshot.cols + c]?.state === 'hidden') {
              const d = Math.abs(r - me.row) + Math.abs(c - me.col);
              if (d < bestD) {
                bestD = d;
                bestR = r;
                bestC = c;
              }
            }
          }
        }
        if (Math.abs(bestC - me.col) >= Math.abs(bestR - me.row) && bestC !== me.col) {
          dx = Math.sign(bestC - me.col);
        } else if (bestR !== me.row) {
          dy = Math.sign(bestR - me.row);
        }
      }
      break;
    }

    case 'maze-chomper': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.stunTimer > 0) break;
      const activeGhost = snapshot.ghosts.filter((g) => g.scaredTimer <= 0);
      const scaredGhost = snapshot.ghosts.filter((g) => g.scaredTimer > 0.6);
      const { item: danger, dist: dGhost } = nearestOf(me.x, me.y, activeGhost);
      const { item: prey, dist: pDist } = nearestOf(me.x, me.y, scaredGhost);
      if (me.powerTimer > 0 && prey && pDist < 6) {
        const aim = steerToward(me.x, me.y, prey.x, prey.y, tuning);
        dx = aim.dx;
        dy = aim.dy;
      } else if (danger && dGhost < 2.6) {
        const away = steerToward(danger.x, danger.y, me.x, me.y, tuning);
        dx = away.dx;
        dy = away.dy;
        if (me.cooldownB <= 0 && canAct()) {
          b = true;
          markActed();
        }
      } else {
        const powerOrbs = snapshot.pellets.filter((p) => p.power);
        const targetList = powerOrbs.length > 0 && me.powerTimer <= 0 ? powerOrbs : snapshot.pellets;
        const { item: pel } = nearestOf(me.x, me.y, targetList);
        if (pel) {
          const aim = steerToward(me.x, me.y, pel.x, pel.y, tuning, mem.wanderAngle);
          dx = aim.dx;
          dy = aim.dy;
        }
      }
      if (me.cooldownA <= 0 && canAct() && Math.random() < 0.25) {
        a = true;
        markActed();
      }
      break;
    }

    case 'block-stack': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive || me.curShape.length === 0) break;
      const cols = 10;
      const rows = 16;
      const board = Array.isArray(me.board) ? me.board : [];
      let bestCol = 4;
      let lowestTopRow = -1;
      for (let c = 0; c < cols; c++) {
        let topR = rows;
        for (let r = 0; r < rows; r++) {
          if ((board[r * cols + c] ?? 0) !== 0) {
            topR = r;
            break;
          }
        }
        if (topR > lowestTopRow) {
          lowestTopRow = topR;
          bestCol = c;
        }
      }
      const curCenter = me.curShape.reduce((acc, pt) => acc + pt.cx, 0) / me.curShape.length;
      if (Math.abs(bestCol - curCenter) > 0.8) {
        dx = Math.sign(bestCol - curCenter);
      } else if (canAct()) {
        if (Math.random() < 0.25) a = true;
        else b = true;
        markActed();
      }
      break;
    }

    case 'frog-crossing': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.stunTimer > 0) break;
      const nextRow = Math.max(0, me.row - 1);
      const nextLane = snapshot.lanes[nextRow];
      let safeToHop = true;
      if (nextLane?.kind === 'road') {
        const hitCar = nextLane.items.some((car) => me.x > car.x - 42 && me.x < car.x + car.w + 42);
        if (hitCar) {
          safeToHop = false;
          dx = me.x > ARENA_WIDTH / 2 ? -0.8 : 0.8;
        }
      } else if (nextLane?.kind === 'river') {
        const onLog = nextLane.items.find((l) => me.x > l.x + 8 && me.x < l.x + l.w - 8);
        if (!onLog && nextLane.items.length > 0) {
          safeToHop = false;
          const nearestLog = [...nextLane.items].sort((l1, l2) => Math.abs((l1.x + l1.w / 2) - me.x) - Math.abs((l2.x + l2.w / 2) - me.x))[0];
          dx = Math.sign((nearestLog.x + nearestLog.w / 2) - me.x);
        }
      } else if (nextLane?.kind === 'goal') {
        const nearestPad = [...snapshot.pads].sort((p1, p2) => Math.abs(p1.x - me.x) - Math.abs(p2.x - me.x))[0];
        if (nearestPad && Math.abs(nearestPad.x - me.x) > 40) {
          dx = Math.sign(nearestPad.x - me.x);
        }
      }
      if (safeToHop && me.hopTimer <= 0 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'barrel-tower': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.stunTimer > 0) break;
      const fl = snapshot.floors[me.floorIdx];
      const approaching = snapshot.barrels.some(
        (br) => Math.abs(br.y - me.y) < 38 && Math.abs(br.x - me.x) < 92 && Math.sign(br.vx) === Math.sign(me.x - br.x)
      );
      if (approaching && canAct()) {
        a = true;
        markActed();
      }
      if (fl && fl.ladderX.length > 0) {
        const targetLadder = [...fl.ladderX].sort((lx1, lx2) => Math.abs(lx1 - me.x) - Math.abs(lx2 - me.x))[0];
        if (Math.abs(targetLadder - me.x) > 18) {
          dx = Math.sign(targetLadder - me.x);
        } else {
          dy = -1;
        }
      }
      break;
    }

    case 'clay-skeet': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const validTargets = snapshot.targets.filter((t) => t.kind !== 'decoy');
      const golds = validTargets.filter((t) => t.kind === 'gold');
      const { item: target } = nearestOf(me.x, me.y, golds.length > 0 ? golds : validTargets);
      if (target) {
        const tx = target.x + target.vx * 0.06;
        const ty = target.y + target.vy * 0.06;
        const aim = steerToward(me.x, me.y, tx, ty, tuning);
        dx = aim.dx;
        dy = aim.dy;
        const d = Math.hypot(tx - me.x, ty - me.y);
        if (d < 52 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        } else if (d < 130 && me.cooldownB <= 0 && canAct() && validTargets.length >= 2) {
          b = true;
          markActed();
        }
      } else {
        const home = steerToward(me.x, me.y, ARENA_WIDTH / 2, ARENA_HEIGHT * 0.45, tuning);
        dx = home.dx;
        dy = home.dy;
      }
      break;
    }

    case 'skee-roll': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const bestRing = [...snapshot.rings].sort((r1, r2) => r2.points - r1.points)[0];
      const targetX = bestRing ? bestRing.x : 600;
      rtHoldA = true;
      rtIsAggressiveA = false;
      if (Math.abs(targetX - me.aimX) > 22) {
        dx = Math.sign(targetX - me.aimX);
      } else if (me.charging) {
        if (me.charge < 0.72) a = true;
        else a = false;
      } else if (me.cooldownA <= 0) {
        a = true;
      }
      break;
    }

    case 'tunnel-dig': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.stunTimer > 0) break;
      const { item: mon, dist: mDist } = nearestOf(me.x, me.y, snapshot.monsters);
      if (mon && mDist < 1.8 && canAct()) {
        const aim = steerToward(me.x, me.y, mon.x, mon.y, tuning);
        dx = aim.dx;
        dy = aim.dy;
        a = true;
        markActed();
      } else {
        const { item: gem } = nearestOf(me.x, me.y, snapshot.gems);
        if (gem) {
          const aim = steerToward(me.x, me.y, gem.x, gem.y, tuning, mem.wanderAngle);
          dx = aim.dx;
          dy = aim.dy;
          if (me.cooldownB <= 0 && canAct() && Math.random() < 0.25) {
            b = true;
            markActed();
          }
        }
      }
      break;
    }

    case 'bubble-pop-arc': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const matching = snapshot.bubbles.filter((bub) => bub.colorIdx === me.nextColorIdx);
      const { item: target } = nearestOf(me.x, 630, matching.length > 0 ? matching : snapshot.bubbles);
      if (target) {
        const desiredAngle = Math.max(-Math.PI + 0.35, Math.min(-0.35, Math.atan2(target.y - 630, target.x - me.x)));
        const diff = desiredAngle - me.aimAngle;
        if (Math.abs(diff) > 0.08) {
          dx = Math.sign(diff);
        } else if (me.cooldownA <= 0 && canAct()) {
          if (matching.length === 0 && Math.random() < 0.4) b = true;
          else a = true;
          markActed();
        }
      }
      break;
    }

    case 'pin-strike': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const standing = snapshot.pins.filter((pn) => !pn.knocked);
      const avgX = standing.length > 0
        ? standing.reduce((sum, pn) => sum + pn.x, 0) / standing.length
        : 600;
      const targetX = clampUnit((avgX - 600) / 300) * 300 + 600 + Math.sin(mem.driftPhase + me.slotIndex) * profile.aimError * 70;
      rtHoldA = true;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      if (Math.abs(targetX - me.laneX) > 22) {
        dx = Math.sign(targetX - me.laneX);
      } else if (me.charging) {
        if (me.charge < 0.72) a = true;
        else a = false;
      } else if (me.cooldownA <= 0) {
        a = true;
      }
      break;
    }

    case 'coin-dozer': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const gems = snapshot.coins.filter((c) => c.kind === 'gem');
      const targetX = gems.length > 0
        ? gems[me.slotIndex % gems.length].x
        : 600 + Math.sin(mem.driftPhase) * 260;
      if (Math.abs(targetX - me.x) > 28) {
        dx = Math.sign(targetX - me.x);
      }
      if (me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      } else if (me.megaReady && canAct()) {
        b = true;
        markActed();
      }
      break;
    }

    // ─── Pack 8–12 AI Tactics ───────────────────────────────────────────────
    case 'trap-builder-run': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (snapshot.phase === 'build') {
        const tx = 440 + ((me.slotIndex * 140) % 420);
        const ty = 435;
        const aim = steerToward(me.cursorX, me.cursorY, tx, ty, tuning);
        dx = aim.dx;
        dy = aim.dy;
        if (!me.placedThisRound && aim.dist < 65 && canAct()) {
          if (Math.random() < 0.25) b = true;
          else a = true;
          markActed();
        }
      } else if (me.alive && !me.finishedRound) {
        dx = Math.sign(snapshot.goal.x - me.x) || 1;
        const hazardAhead = snapshot.items.some(
          (it) => (it.kind === 'saw' || it.kind === 'spike') && Math.abs(it.x - (me.x + 55)) < 65 && Math.abs(it.y - me.y) < 55
        );
        if ((hazardAhead || me.y > 460) && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        } else if (me.cooldownB <= 0 && Math.random() < 0.08) {
          b = true;
        }
      }
      break;
    }

    case 'track-crafter-gp': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (snapshot.phase === 'craft') {
        if (!me.placedPiece && canAct()) {
          a = true;
          markActed();
        }
      } else {
        const node = snapshot.nodes[me.nodeIdx];
        if (node) {
          const aim = steerToward(me.x, me.y, node.x, node.y, tuning);
          dx = aim.dx;
          dy = aim.dy;
          rtHoldA = true;
          a = true;
        }
      }
      break;
    }

    case 'slingshot-fortress': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const target = snapshot.targets[me.slotIndex % Math.max(1, snapshot.targets.length)] ?? snapshot.blocks[0];
      if (target) {
        const desiredAng = Math.max(-1.1, Math.min(-0.15, Math.atan2(target.y - me.y, target.x - me.x) - 0.18));
        if (Math.abs(desiredAng - me.aimAngle) > 0.06) dy = Math.sign(desiredAng - me.aimAngle);
        if (Math.abs(0.8 - me.power) > 0.08) dx = Math.sign(0.8 - me.power);
        if (me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'rope-slice-physics': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const validRopes = snapshot.ropes.filter((r) => !r.cut && r.kind !== 'bomb');
      const targetRope = validRopes[me.slotIndex % Math.max(1, validRopes.length)];
      if (targetRope) {
        const mx = (targetRope.ax + targetRope.orbX) / 2;
        const my = (targetRope.ay + targetRope.orbY) / 2;
        const aim = steerToward(me.x, me.y, mx, my, tuning);
        dx = aim.dx;
        dy = aim.dy;
        if (aim.dist < 56 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'wobbly-timber-pull': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      const safeRows = snapshot.rows.filter((r) => {
        const count = (r.blocks[0] ? 1 : 0) + (r.blocks[1] ? 1 : 0) + (r.blocks[2] ? 1 : 0);
        return count >= 2;
      });
      const pickPool = safeRows.length > 0 ? safeRows : snapshot.rows;
      const row = pickPool[(me.slotIndex + Math.floor(mem.driftPhase)) % pickPool.length] ?? snapshot.rows[0];
      if (row) {
        const preferSide = profile.mistakeRate > 0.08 && Math.random() < profile.mistakeRate * 1.4;
        const col = preferSide
          ? (row.blocks[0] ? 0 : row.blocks[2] ? 2 : 1)
          : (row.blocks[1] ? 1 : row.blocks[0] ? 0 : 2);
        if (me.cursorCol !== col) dx = Math.sign(col - me.cursorCol);
        else if (me.cursorRow !== row.row) dy = -Math.sign(row.row - me.cursorRow);
        else if (me.cooldownA <= 0) {
          rtHoldA = true;
          a = true;
        }
      }
      if (Math.abs(snapshot.tiltAngle) > 0.14 && me.cooldownB <= 0) b = true;
      break;
    }

    case 'artillery-crater-war': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const { item: target } = nearestOf(me.x, me.y, rivals);
      if (target) {
        const desiredAng = target.x >= me.x ? -0.68 : -Math.PI + 0.68;
        if (Math.abs(desiredAng - me.aimAngle) > 0.1) dy = Math.sign(desiredAng - me.aimAngle);
        dx = Math.sin(mem.driftPhase) * 0.45;
        if (me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'bridge-load-stress': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      if (snapshot.phase === 'build') {
        const beamExists = (p1: number, p2: number) => {
          const lo = Math.min(p1, p2);
          const hi = Math.max(p1, p2);
          return snapshot.beams.some((bm) => !bm.broken && bm.a === lo && bm.b === hi);
        };
        const candidatePairs: [number, number][] = [
          [0, 1], [1, 2], [2, 3], [3, 4],
          [0, 5], [5, 1], [1, 6], [6, 2], [2, 7], [7, 3], [3, 8], [8, 4], [4, 9],
          [5, 6], [6, 7], [7, 8], [8, 9],
        ];
        let goalPin = me.cursorIdx;
        if (me.selectedFrom !== null) {
          const partner = candidatePairs.find(
            ([u, v]) => (u === me.selectedFrom || v === me.selectedFrom) && !beamExists(u, v)
          );
          goalPin = partner
            ? (partner[0] === me.selectedFrom ? partner[1] : partner[0])
            : Math.min(9, me.selectedFrom + 1);
        } else {
          const unbuilt = candidatePairs.filter(([u, v]) => !beamExists(u, v));
          const picked = unbuilt[me.slotIndex % Math.max(1, unbuilt.length)];
          goalPin = picked ? picked[0] : (me.slotIndex % 4);
        }
        if (me.mat === 'wood' && profile.aggression > 0.5 && me.cooldownB <= 0 && Math.random() < 0.25) {
          b = true;
        }
        const curRow = Math.floor(me.cursorIdx / 5);
        const curCol = me.cursorIdx % 5;
        const tgtRow = Math.floor(goalPin / 5);
        const tgtCol = goalPin % 5;
        if (curCol !== tgtCol) dx = Math.sign(tgtCol - curCol);
        else if (curRow !== tgtRow) dy = Math.sign(tgtRow - curRow);
        else if (me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'hill-torque-climb': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.stunTimer > 0) break;
      rtHoldA = true;
      a = true;
      if (Math.abs(me.angle) > 0.35) dx = -Math.sign(me.angle);
      break;
    }

    case 'three-lane-metro': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const incoming = snapshot.obstacles.find((ob) => ob.lane === me.lane && ob.z > 0.07 && ob.z < 0.36);
      if (incoming && (incoming.kind === 'train' || incoming.kind === 'lowbarrier' || incoming.kind === 'highbar')) {
        if (incoming.kind === 'lowbarrier' && me.cooldownA <= 0) {
          a = true;
        } else if (incoming.kind === 'highbar' && me.cooldownB <= 0) {
          b = true;
        } else {
          dx = me.lane === 0 ? 1 : me.lane === 2 ? -1 : me.slotIndex % 2 === 0 ? -1 : 1;
        }
      } else {
        const coin = snapshot.obstacles.find((ob) => (ob.kind === 'coin' || ob.kind === 'magnet') && ob.z > 0.12);
        if (coin && coin.lane !== me.lane) dx = Math.sign(coin.lane - me.lane);
      }
      break;
    }

    case 'tilt-labyrinth': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      const { item: goal } = nearestOf(me.x, me.y, snapshot.goals);
      if (goal) {
        let tgtX = goal.x;
        let tgtY = goal.y;
        // Detect labyrinth wall between ball and goal and steer around the open end
        const blocker = snapshot.walls.find((w) => {
          const wallMidX = w.x + w.w * 0.5;
          const crossesX = (me.x < wallMidX && goal.x > wallMidX) || (me.x > wallMidX && goal.x < wallMidX);
          const nearWallX = Math.abs(me.x - wallMidX) < 62;
          return (crossesX || nearWallX) && me.y >= w.y - 24 && me.y <= w.y + w.h + 24;
        });
        if (blocker) {
          const openBottomY = blocker.y + blocker.h + 52;
          const openTopY = blocker.y - 52;
          const goBottom = blocker.y < 220 || (openBottomY < ARENA_HEIGHT - 120 && Math.abs(me.y - openBottomY) <= Math.abs(me.y - openTopY));
          tgtX = blocker.x + blocker.w * 0.5 + (goal.x >= me.x ? -38 : 38);
          tgtY = goBottom ? openBottomY : openTopY;
        }
        const aim = steerToward(me.x, me.y, tgtX, tgtY, tuning);
        dx = aim.dx;
        dy = aim.dy;
        const nearHole = snapshot.holes.some((h) => Math.hypot(me.x - h.x, me.y - h.y) < h.r + 42);
        if (nearHole && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'lane-tower-blitz': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const threat = [...snapshot.enemies].sort((aE, bE) => aE.x - bE.x)[0];
      const tgtRow = threat ? threat.row : me.slotIndex % 4;
      const tgtCol = threat ? Math.max(0, Math.min(4, Math.floor((threat.x - 260) / 118))) : 1;
      if (me.col !== tgtCol) dx = Math.sign(tgtCol - me.col);
      else if (me.row !== tgtRow) dy = Math.sign(tgtRow - me.row);
      else if (me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'path-tower-defense': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const emptyPad = snapshot.pads.find((pd) => pd.tower === 'none') ?? snapshot.pads[me.slotIndex % snapshot.pads.length];
      if (emptyPad) {
        if (me.padIdx !== emptyPad.id) {
          dx = me.padIdx < emptyPad.id ? 1 : -1;
        } else if (me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'horde-survivor': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const { item: threat, dist: tDist } = nearestOf(me.x, me.y, snapshot.enemies);
      if (threat && tDist < 120) {
        const flee = steerToward(threat.x, threat.y, me.x, me.y, tuning);
        dx = flee.dx;
        dy = flee.dy;
        if (me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        } else if (me.cooldownB <= 0 && tDist < 70) {
          b = true;
        }
      } else {
        const { item: gem } = nearestOf(me.x, me.y, snapshot.gems);
        if (gem) {
          const aim = steerToward(me.x, me.y, gem.x, gem.y, tuning);
          dx = aim.dx;
          dy = aim.dy;
        }
      }
      break;
    }

    case 'starship-crew-chaos': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const station = snapshot.stations[me.slotIndex % snapshot.stations.length];
      if (station) {
        const d = Math.hypot(station.x - me.x, station.y - me.y);
        if (d > 24) {
          const aim = steerToward(me.x, me.y, station.x, station.y, tuning);
          dx = aim.dx;
          dy = aim.dy;
        } else {
          rtHoldA = true;
          a = true;
          const threat = snapshot.threats[0];
          if (threat) {
            const aim = steerToward(snapshot.shipX, snapshot.shipY, threat.x, threat.y, tuning);
            dx = aim.dx;
            dy = aim.dy;
          }
        }
      }
      break;
    }

    case 'swarm-herd-clash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const weakRival = snapshot.players.find((p) => p.id !== botId && me.swarmCount >= p.swarmCount + 3);
      if (weakRival && Math.hypot(weakRival.x - me.x, weakRival.y - me.y) < 320) {
        const aim = steerToward(me.x, me.y, weakRival.x, weakRival.y, tuning);
        dx = aim.dx;
        dy = aim.dy;
        if (me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      } else {
        const { item: neu } = nearestOf(me.x, me.y, snapshot.neutrals);
        if (neu) {
          const aim = steerToward(me.x, me.y, neu.x, neu.y, tuning);
          dx = aim.dx;
          dy = aim.dy;
        }
      }
      break;
    }

    case 'rail-switch-rush': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const badTrain = snapshot.trains.find((t) => t.row !== t.targetRow);
      const targetSw = badTrain
        ? snapshot.switches.find((s) => s.y === 225 + badTrain.row * 150 && s.x > badTrain.x) ?? snapshot.switches[0]
        : snapshot.switches[me.slotIndex % snapshot.switches.length];
      if (targetSw) {
        const curCol = me.cursorSwitch % 2;
        const curRow = Math.floor(me.cursorSwitch / 2);
        const tgtCol = targetSw.id % 2;
        const tgtRow = Math.floor(targetSw.id / 2);
        if (curCol !== tgtCol) dx = Math.sign(tgtCol - curCol);
        else if (curRow !== tgtRow) dy = Math.sign(tgtRow - curRow);
        else if (badTrain && !targetSw.state && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'air-traffic-landing': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const plane = snapshot.planes.find((pl) => pl.id === me.lockedPlaneId) ?? snapshot.planes[me.slotIndex % Math.max(1, snapshot.planes.length)];
      if (plane) {
        const rw = snapshot.runways.find((r) => r.kind === plane.kind);
        const dPlane = Math.hypot(plane.x - me.x, plane.y - me.y);
        if (dPlane > 80 && !me.lockedPlaneId) {
          const aim = steerToward(me.x, me.y, plane.x, plane.y, tuning);
          dx = aim.dx;
          dy = aim.dy;
        } else if (rw) {
          rtHoldA = true;
          a = true;
          const aim = steerToward(plane.x, plane.y, rw.x, rw.y, tuning);
          dx = aim.dx;
          dy = aim.dy;
        }
      }
      break;
    }

    case 'pipe-flow-sprint': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const midRow = Math.floor(snapshot.rows / 2);
      const unfilled = snapshot.pipes.findIndex((pp, idx) => !pp.filled && Math.floor(idx / snapshot.cols) === midRow);
      const tgtIdx = unfilled >= 0 ? unfilled : (me.slotIndex * 3) % (snapshot.cols * snapshot.rows);
      const tr = Math.floor(tgtIdx / snapshot.cols);
      const tc = tgtIdx % snapshot.cols;
      if (me.c !== tc) dx = Math.sign(tc - me.c);
      else if (me.r !== tr) dy = Math.sign(tr - me.r);
      else if (canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'moving-day-havoc': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (me.carryingId) {
        const tz = snapshot.truckZone;
        const aim = steerToward(me.x, me.y, tz.x + tz.w / 2, tz.y + tz.h / 2, tuning);
        dx = aim.dx;
        dy = aim.dy;
        if (aim.dist < 170 && me.cooldownB <= 0 && canAct()) {
          b = true;
          markActed();
        }
      } else {
        const loose = snapshot.items.filter((it) => !it.carrierId);
        const { item: cargo, dist } = nearestOf(me.x, me.y, loose);
        if (cargo) {
          const aim = steerToward(me.x, me.y, cargo.x, cargo.y, tuning);
          dx = aim.dx;
          dy = aim.dy;
          if (dist < 52 && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        }
      }
      break;
    }

    case 'fishing-tension-tug': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (!me.hooked) {
        const { item: fish, dist } = nearestOf(me.x, me.y, snapshot.fish);
        if (fish) {
          const aim = steerToward(me.x, me.y, fish.x, fish.y, tuning);
          dx = aim.dx;
          dy = aim.dy;
          if (dist < fish.size + 26 && me.cooldownA <= 0) {
            rtHoldA = true;
            a = true;
          }
        }
      } else if (me.tension < 0.72) {
        rtHoldA = true;
        a = true;
      } else if (me.cooldownB <= 0) {
        b = true;
      }
      break;
    }

    case 'mosaic-tile-draft': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const nonEmpty = snapshot.factories.find((f) => f.tiles.length > 0);
      if (nonEmpty) {
        if (me.factoryIdx !== nonEmpty.id && canAct()) {
          dx = 1;
          markActed();
        } else if (!nonEmpty.tiles.includes(me.pickColor) && me.cooldownB <= 0 && canAct()) {
          b = true;
          markActed();
        } else if (nonEmpty.tiles.includes(me.pickColor) && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'maze-wall-duel': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (me.wallMode && me.cooldownB <= 0 && canAct()) {
        b = true;
        markActed();
      } else if (canAct()) {
        const dr = Math.sign(me.targetR - me.r);
        if (Math.random() < 0.2) dx = me.c < 3 ? 1 : -1;
        else dy = dr;
        a = true;
        markActed();
      }
      break;
    }

    case 'corner-polyomino': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const curEmpty = snapshot.cells[me.r * snapshot.size + me.c] === -1;
      if (curEmpty && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      } else if (canAct()) {
        dx = Math.random() < 0.5 ? (me.c < snapshot.size - 2 ? 1 : -1) : 0;
        dy = dx === 0 ? (me.r < snapshot.size - 2 ? 1 : -1) : 0;
        if (Math.random() < 0.35 && me.cooldownB <= 0) b = true;
        markActed();
      }
      break;
    }

    case 'pillar-ascent-3d': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const curH = snapshot.heights[me.r * snapshot.size + me.c] ?? 0;
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      let bestDir: number[] | null = null;
      let bestH = -1;
      for (const [dr, dc] of dirs) {
        const nr = me.r + dr;
        const nc = me.c + dc;
        if (nr < 0 || nr >= snapshot.size || nc < 0 || nc >= snapshot.size) continue;
        const nh = snapshot.heights[nr * snapshot.size + nc];
        if (nh < 4 && nh <= curH + 1 && nh > bestH) {
          bestH = nh;
          bestDir = [dr, dc];
        }
      }
      if (canAct()) {
        if (bestDir && bestH > curH) {
          dy = bestDir[0];
          dx = bestDir[1];
        } else if (me.cooldownA <= 0) {
          a = true;
        } else if (bestDir) {
          dy = bestDir[0];
          dx = bestDir[1];
        }
        markActed();
      }
      break;
    }

    case 'hex-island-settlers': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (me.resources < 2 && me.cooldownB <= 0 && canAct()) {
        b = true;
        markActed();
      } else {
        const curHex = snapshot.hexes[me.cursorHex];
        if (curHex && curHex.ownerSlot === -1 && me.resources >= 2 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        } else if (canAct()) {
          dx = Math.cos(mem.wanderAngle);
          dy = Math.sin(mem.wanderAngle);
          markActed();
        }
      }
      break;
    }

    case 'hex-insect-chess': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const rivalQ = snapshot.bugs.find((bg) => bg.kind === 'queen' && bg.ownerSlot !== me.slotIndex);
      if (rivalQ && canAct()) {
        const tgtR = Math.max(0, Math.min(snapshot.rows - 1, rivalQ.r + (me.slotIndex % 2 === 0 ? 1 : -1)));
        const tgtC = rivalQ.c;
        if (me.c !== tgtC) dx = Math.sign(tgtC - me.c);
        else if (me.r !== tgtR) dy = Math.sign(tgtR - me.r);
        else if (me.cooldownA <= 0) a = true;
        markActed();
      }
      break;
    }

    case 'deep-sea-oxygen': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const shouldAscend = me.bagLoot >= 3 || snapshot.oxygen <= 12;
      if (canAct()) {
        dy = shouldAscend ? -1 : 1;
        if (me.depth > 0 && !shouldAscend && me.cooldownB <= 0) b = true;
        else a = true;
        markActed();
      }
      break;
    }

    case 'picross-nonogram': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (me.cooldownB <= 0 && canAct()) {
        b = true;
        markActed();
      } else if (me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'speed-sudoku-duel': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const emptyIdx = snapshot.grid.findIndex((v) => v === 0);
      if (emptyIdx >= 0 && canAct()) {
        const tr = Math.floor(emptyIdx / snapshot.size);
        const tc = emptyIdx % snapshot.size;
        if (me.c !== tc) dx = Math.sign(tc - me.c);
        else if (me.r !== tr) dy = Math.sign(tr - me.r);
        else {
          if (Math.random() < 0.6 && me.cooldownB <= 0) b = true;
          else if (me.cooldownA <= 0) a = true;
        }
        markActed();
      }
      break;
    }

    case 'tangram-silhouette': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const aim = steerToward(me.x, me.y, snapshot.targetX, snapshot.targetY, tuning);
      dx = aim.dx;
      dy = aim.dy;
      if (me.rot % 180 !== snapshot.targetRot % 180 && me.cooldownB <= 0 && canAct()) {
        b = true;
        markActed();
      } else if (aim.dist < 48 && me.rot % 180 === snapshot.targetRot % 180 && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'blade-fruit-slice': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const targets = snapshot.fruits.filter((f) => f.kind !== 'bomb');
      const { item: fruit, dist } = nearestOf(me.x, me.y, targets);
      if (fruit) {
        const aim = steerToward(me.x, me.y, fruit.x, fruit.y, tuning);
        dx = aim.dx;
        dy = aim.dy;
        if (dist < 110 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'peg-fever-bounce': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const target = snapshot.pegs.find((pg) => !pg.hit && pg.kind !== 'blue') ?? snapshot.pegs.find((pg) => !pg.hit);
      if (target) {
        if (Math.abs(target.x - me.aimX) > 25) dx = Math.sign(target.x - me.aimX);
        if (me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'halfpipe-skate-combo': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      dx = me.x < 600 ? 1 : -1;
      if (me.airborne && me.cooldownB <= 0 && canAct()) {
        b = true;
        markActed();
      } else if (!me.airborne && Math.abs(me.x - 600) > 210 && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'five-second-microgames': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (snapshot.microKind === 'stop' && snapshot.redLight) {
        dx = 0;
        dy = 0;
      } else if (snapshot.microKind === 'catch') {
        const aim = steerToward(me.x, me.y, snapshot.goalX, snapshot.goalY, tuning);
        dx = aim.dx;
        dy = aim.dy;
      } else if (snapshot.microKind === 'dodge') {
        const flee = steerToward(snapshot.hazardX, snapshot.hazardY, me.x, me.y, tuning);
        dx = flee.dx;
        dy = flee.dy;
      } else if (snapshot.microKind === 'mash' && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'corridor-fencing': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const goalX = me.slotIndex % 2 === 0 ? ARENA_WIDTH - 135 : 135;
      dx = Math.sign(goalX - me.x);
      const rivalClose = snapshot.players.some(
        (p) => p.id !== botId && Math.abs(p.x - me.x) < 110 && Math.abs(p.y - me.y) < 110
      );
      if (rivalClose && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      } else if (Math.random() < 0.08) {
        dy = Math.random() < 0.5 ? 1 : -1;
      }
      break;
    }

    case 'pro-darts-301': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const targetY = me.remaining301 > 70 ? snapshot.boardY - 115 : snapshot.boardY;
      const aim = steerToward(me.x, me.y, snapshot.boardX, targetY, tuning);
      dx = aim.dx;
      dy = aim.dy;
      if (aim.dist < 32 && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'wau-kite-cut': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const { item: ring } = nearestOf(me.x, me.y, snapshot.gustRings);
      const rival = snapshot.players.find((p) => p.id !== botId);
      const tx = rival && Math.hypot(rival.x - me.x, rival.y - me.y) < 220 ? rival.x : ring?.x ?? 600;
      const ty = rival && Math.hypot(rival.x - me.x, rival.y - me.y) < 220 ? rival.y + 26 : ring?.y ?? 340;
      const aim = steerToward(me.x, me.y, tx, ty, tuning);
      dx = aim.dx;
      dy = aim.dy;
      if (aim.dist < 110 && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      }
      break;
    }

    case 'five-stones-toss': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const { item: stone, dist } = nearestOf(me.x, me.y, snapshot.stones);
      if (stone) {
        const aim = steerToward(me.x, me.y, stone.x, stone.y, tuning);
        dx = aim.dx;
        dy = aim.dy;
        if (dist < 62 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      if (me.cooldownB <= 0 && Math.random() < 0.05) b = true;
      break;
    }

    case 'chapteh-juggle': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      rtIsAggressiveA = false;
      rtIsOffensiveMove = false;
      const target = [...snapshot.feathers].sort((fA, fB) => fB.y - fA.y)[0];
      if (target) {
        if (Math.abs(target.x - me.x) > 16) dx = Math.sign(target.x - me.x);
        if (Math.abs(target.x - me.x) < 76 && target.y > 410 - profile.reactionTime * 160 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'xiangqi-river-clash': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      const bestTarget = [...snapshot.targets].sort((tA, tB) => tB.pts - tA.pts)[0];
      if (bestTarget && canAct()) {
        const manhattan = Math.abs(bestTarget.r - me.r) + Math.abs(bestTarget.c - me.c);
        const range = me.piece === 'cannon' ? 2 : 1;
        if (manhattan <= range && me.cooldownA <= 0) {
          a = true;
        } else {
          if (Math.abs(bestTarget.c - me.c) >= Math.abs(bestTarget.r - me.r)) dx = Math.sign(bestTarget.c - me.c);
          else dy = Math.sign(bestTarget.r - me.r);
        }
        markActed();
      }
      break;
    }

    default: {
      // Universal fallback AI for any newly added future game without a custom tactic block:
      // Inspects generic player positions when present, stays away from arena edges, chases rivals
      // or wanders smoothly, and triggers A/B abilities scaled by Chill / Arcade / Spicy difficulty.
      const genericSnap = snapshot as unknown as {
        players?: { id: string; x?: number; y?: number; alive?: boolean }[];
      };
      const roster = Array.isArray(genericSnap.players) ? genericSnap.players : [];
      const me = roster.find((p) => p.id === botId);

      if (me && typeof me.x === 'number' && typeof me.y === 'number') {
        const margin = 95;
        if (
          me.x < margin ||
          me.x > ARENA_WIDTH - margin ||
          me.y < margin ||
          me.y > ARENA_HEIGHT - margin
        ) {
          const toCenter = steerToward(me.x, me.y, ARENA_WIDTH / 2, ARENA_HEIGHT / 2, tuning);
          dx = toCenter.dx;
          dy = toCenter.dy;
        } else {
          const rivals = roster.filter(
            (p) =>
              p.id !== botId &&
              p.alive !== false &&
              typeof p.x === 'number' &&
              typeof p.y === 'number'
          ) as { id: string; x: number; y: number }[];
          const { item: rival, dist } = nearestOf(me.x, me.y, rivals);
          if (rival && dist < 480) {
            const aim = steerToward(me.x, me.y, rival.x, rival.y, tuning, mem.wanderAngle);
            dx = aim.dx;
            dy = aim.dy;
            if (dist < 190 && canAct() && Math.random() < 0.22) {
              a = true;
              markActed();
            } else if (dist < 130 && canAct() && Math.random() < 0.14) {
              b = true;
              markActed();
            }
          } else {
            dx = Math.cos(mem.wanderAngle) * 0.78 * tuning.moveScale;
            dy = Math.sin(mem.wanderAngle) * 0.78 * tuning.moveScale;
          }
        }
      } else {
        dx = Math.cos(mem.wanderAngle) * 0.75 * tuning.moveScale;
        dy = Math.sin(mem.wanderAngle) * 0.75 * tuning.moveScale;
      }

      if (!a && !b && canAct() && Math.random() < 0.06) {
        if (Math.random() < 0.65) a = true;
        else b = true;
        markActed();
      }
      break;
    }
  }

  if (isPhase1Realtime) {
    const snapAny = snapshot as unknown as {
      round?: number;
      players?: Array<{ id: string; x?: number; y?: number; vx?: number; vy?: number }>;
    };
    if (!rtSelfPos && Array.isArray(snapAny.players)) {
      const me = snapAny.players.find((p) => p.id === botId);
      if (me && typeof me.x === 'number' && typeof me.y === 'number') {
        rtSelfPos = { x: me.x, y: me.y, vx: me.vx, vy: me.vy };
      }
    }
    const roundMarker = `${snapshot.gameId}:r${snapAny.round ?? 1}`;
    return runRealtimeBotAdapter({
      memoryKey: `${snapshot.gameId}:${botId}`,
      gameId: snapshot.gameId,
      botId,
      difficulty,
      dt,
      roundMarker,
      roundElapsedSec: rtRoundElapsedSec,
      selfPos: rtSelfPos,
      safeCenter: rtSafeCenter,
      targets: rtTargets,
      desiredMove: { dx: clampUnit(dx), dy: clampUnit(dy) },
      isBoundaryRecovery: rtIsBoundaryRecovery,
      isOffensiveMove: rtIsOffensiveMove,
      wantsActionA: a,
      isAggressiveActionA: rtIsAggressiveA,
      holdActionA: rtHoldA,
      wantsActionB: b,
      isAggressiveActionB: rtIsAggressiveB,
      discreteSteering: DISCRETE_STEERING_REALTIME_GAME_IDS.has(snapshot.gameId),
    });
  }

  return {
    dx: clampUnit(dx),
    dy: clampUnit(dy),
    a,
    b,
  };
}
