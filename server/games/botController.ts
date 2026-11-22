import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type BotDifficulty,
  type ControllerInput,
  type GameSnapshot,
} from '../../src/shared/types.ts';

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

const DIFFICULTY_TUNING: Record<BotDifficulty, DifficultyTuning> = {
  chill: {
    moveScale: 0.56,
    abilityChance: 0.22,
    aimJitter: 0.42,
    reactionCooldown: 0.55,
    reflexFactor: 0.45,
  },
  arcade: {
    moveScale: 0.74,
    abilityChance: 0.44,
    aimJitter: 0.24,
    reactionCooldown: 0.3,
    reflexFactor: 0.68,
  },
  spicy: {
    moveScale: 0.88,
    abilityChance: 0.72,
    aimJitter: 0.11,
    reactionCooldown: 0.15,
    reflexFactor: 0.86,
  },
};

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
  tuning: DifficultyTuning,
  jitterSeed = 0
): { dx: number; dy: number; dist: number; angle: number } {
  const rx = toX - fromX;
  const ry = toY - fromY;
  const dist = Math.hypot(rx, ry);
  if (dist < 1) return { dx: 0, dy: 0, dist: 0, angle: 0 };
  const baseAngle = Math.atan2(ry, rx);
  const angle = baseAngle + Math.sin(jitterSeed) * tuning.aimJitter;
  return {
    dx: Math.cos(angle) * tuning.moveScale,
    dy: Math.sin(angle) * tuning.moveScale,
    dist,
    angle,
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

  const tuning = DIFFICULTY_TUNING[difficulty] ?? DIFFICULTY_TUNING.arcade;
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

  const canAct = () => mem.actionCooldown <= 0 && Math.random() < tuning.abilityChance;
  const markActed = () => {
    mem.actionCooldown = tuning.reactionCooldown;
  };

  let dx = 0;
  let dy = 0;
  let a = false;
  let b = false;

  switch (snapshot.gameId) {
    case 'bumper-brawl': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const distCenter = Math.hypot(me.x - snapshot.ringCenterX, me.y - snapshot.ringCenterY);
      if (distCenter > snapshot.ringRadius * 0.76) {
        const s = steerToward(me.x, me.y, snapshot.ringCenterX, snapshot.ringCenterY, tuning);
        dx = s.dx;
        dy = s.dy;
        if (distCenter > snapshot.ringRadius * 0.9 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      } else {
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const { item: pwr, dist: pwrDist } = nearestOf(me.x, me.y, snapshot.powerups ?? []);
      const pwrSafe =
        pwr && Math.hypot(pwr.x - snapshot.ringCenterX, pwr.y - snapshot.ringCenterY) < snapshot.ringRadius * 0.82;
      const { item: target, dist } = nearestOf(me.x, me.y, rivals);
      if (pwr && pwrSafe && pwrDist < 220) {
        const s = steerToward(me.x, me.y, pwr.x, pwr.y, tuning, mem.driftPhase * 0.5);
        dx = s.dx;
        dy = s.dy;
      } else if (target) {
        const s = steerToward(me.x, me.y, target.x, target.y, tuning, mem.driftPhase);
        dx = s.dx;
        dy = s.dy;
        if (dist < 160 && me.cooldownA <= 0 && canAct() && Math.random() < 0.14) {
          a = true;
          markActed();
        } else if (dist < 105 && me.cooldownB <= 0 && canAct() && Math.random() < 0.18) {
          b = true;
          markActed();
        }
      } else {
        const s = steerToward(me.x, me.y, snapshot.ringCenterX, snapshot.ringCenterY, tuning);
        dx = s.dx * 0.4;
        dy = s.dy * 0.4;
      }
      }
      break;
    }

    case 'astro-blaster': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const { item: pickup, dist: pDist } = nearestOf(me.x, me.y, snapshot.pickups);
      const { item: target, dist: tDist } = nearestOf(me.x, me.y, rivals);

      if (pickup && pDist < 200) {
        const s = steerToward(me.x, me.y, pickup.x, pickup.y, tuning, mem.driftPhase * 0.4);
        dx = s.dx;
        dy = s.dy;
      } else if (target) {
        const s = steerToward(me.x, me.y, target.x, target.y, tuning, mem.driftPhase);
        if (tDist < 175) {
          // Strafe while keeping aim
          dx = s.dx * 0.4 - s.dy * 0.6 * mem.strafeDir;
          dy = s.dy * 0.4 + s.dx * 0.6 * mem.strafeDir;
        } else {
          dx = s.dx;
          dy = s.dy;
        }
        if (tDist < 450 && Math.random() < tuning.abilityChance * 0.46) a = true;
        if (tDist < 135 && me.cooldownB <= 0 && canAct() && Math.random() < 0.12) {
          b = true;
          markActed();
        }
      } else {
        dx = Math.cos(mem.wanderAngle) * tuning.moveScale * 0.6;
        dy = Math.sin(mem.wanderAngle) * tuning.moveScale * 0.6;
      }
      break;
    }

    case 'turbo-drift': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.finished || me.falling || snapshot.trackPoints.length === 0) break;
      const pts = snapshot.trackPoints;
      // Find closest waypoint and aim 2 waypoints ahead
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
      const nextPt = pts[(bestIdx + 4) % pts.length];
      let aimX = lookAhead.x;
      let aimY = lookAhead.y;
      const { item: nearCoin, dist: cDist } = nearestOf(me.x, me.y, snapshot.coins ?? []);
      if (nearCoin && cDist < 105 && Math.random() < tuning.reflexFactor) {
        aimX = lookAhead.x * 0.68 + nearCoin.x * 0.32;
        aimY = lookAhead.y * 0.68 + nearCoin.y * 0.32;
      }
      const { item: nearOil, dist: oDist } = nearestOf(me.x, me.y, snapshot.oils ?? []);
      if (nearOil && oDist < 84) {
        aimX += (me.x - nearOil.x) * 0.7;
        aimY += (me.y - nearOil.y) * 0.7;
      }
      const s = steerToward(me.x, me.y, aimX, aimY, tuning, mem.driftPhase * 0.35);
      dx = s.dx;
      dy = s.dy;

      // Measure upcoming corner sharpness
      const a1 = Math.atan2(lookAhead.y - me.y, lookAhead.x - me.x);
      const a2 = Math.atan2(nextPt.y - lookAhead.y, nextPt.x - lookAhead.x);
      let turn = a2 - a1;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;

      b = Math.abs(turn) > 0.58 && me.speed > 265 && Math.random() < tuning.abilityChance * 0.75;
      a = Math.abs(turn) < 0.32 && me.nitro > 0.5 && Math.random() < tuning.abilityChance * 0.35;
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
      const lookDist = difficulty === 'chill' ? 148 : difficulty === 'arcade' ? 168 : 184;
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
      // Deliberate board-game thinking delay via turnTimeLeft (ROLL_TIMEOUT = 14, DECISION_TIMEOUT = 12)
      if (snapshot.phase === 'wait-roll' && snapshot.turnTimeLeft < 11.6 && mem.actionCooldown <= 0) {
        if (me.luckyCharge >= 100 && !me.rentShield && Math.random() < tuning.abilityChance) {
          b = true;
          mem.actionCooldown = 1.05;
        } else {
          a = true;
          mem.actionCooldown = 1.15;
        }
      } else if (snapshot.phase === 'decision' && snapshot.turnTimeLeft < 9.8 && mem.actionCooldown <= 0) {
        const keepBuffer = difficulty === 'chill' ? 360 : difficulty === 'arcade' ? 220 : 120;
        const canAffordComfortably = me.cash - snapshot.decisionCost >= keepBuffer;
        if (canAffordComfortably || (snapshot.decisionAction === 'buy' && me.propertiesOwned < 2 && me.cash >= snapshot.decisionCost)) {
          a = true;
        } else {
          b = true;
        }
        mem.actionCooldown = 1.15;
      }
      break;
    }

    case 'jungle-ladders': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || snapshot.activePlayerId !== botId) break;
      // Deliberate board-game thinking delay via turnTimeLeft (TURN_TIMEOUT = 14)
      if (snapshot.phase === 'wait-roll' && snapshot.turnTimeLeft < 11.6 && mem.actionCooldown <= 0) {
        if (me.trickReady && !me.boostQueued && Math.random() < tuning.abilityChance) {
          b = true;
          mem.actionCooldown = 1.0;
        } else {
          const goodTiming =
            difficulty === 'spicy'
              ? snapshot.powerMeter > 0.68
              : difficulty === 'arcade'
                ? snapshot.powerMeter > 0.5
                : true;
          if (goodTiming || snapshot.turnTimeLeft < 8.8) {
            a = true;
            mem.actionCooldown = 1.15;
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
        const brakeThresh = difficulty === 'spicy' ? 0.52 : difficulty === 'arcade' ? 0.36 : 0.24;
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
        mem.colorReactionTimer = difficulty === 'chill' ? 0.45 : difficulty === 'arcade' ? 0.25 : 0.11;
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

      const vipOrder = difficulty === 'chill' && Math.random() < 0.5 ? undefined : snapshot.orders.find((o) => o.vip);
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
        const tossRange = difficulty === 'spicy' ? 320 : difficulty === 'arcade' ? 220 : 130;
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
        const revealed = snapshot.spots.filter((s) => s.revealedTimer > 0);
        const targetList =
          revealed.length > 0
            ? revealed
            : difficulty === 'spicy' && me.heat > 0.62
              ? snapshot.spots
              : [];
        const { item: spot, dist: spotDist } = nearestOf(me.x, me.y, targetList);
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
      if (snapshot.phase === 'wait-roll' && snapshot.turnTimeLeft < 11.8 && mem.actionCooldown <= 0) {
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
      if (snapshot.turnTimeLeft < 12.2 && mem.actionCooldown <= 0) {
        const bestMove = [...snapshot.validMoves].sort((m1, m2) => m2.flips - m1.flips)[0];
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
      if (snapshot.turnTimeLeft < 11.4 && mem.actionCooldown <= 0) {
        const targetCol = Math.max(0, Math.min(snapshot.cols - 1, Math.round(3 + Math.sin(mem.wanderAngle) * 2)));
        if (me.hoverCol !== targetCol && snapshot.turnTimeLeft > 8.5) {
          dx = Math.sign(targetCol - me.hoverCol);
          mem.actionCooldown = 0.28;
        } else {
          if (me.anvilCharges > 0 && Math.random() < 0.2) {
            b = true;
          } else {
            a = true;
          }
          mem.actionCooldown = 1.0;
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
      const targetPuck = snapshot.pucks.find((pk) => pk.kind === 'queen') || snapshot.pucks[0];
      if (targetPuck) {
        const desiredAngle = Math.atan2(targetPuck.y - snapshot.striker.y, targetPuck.x - snapshot.striker.x);
        const diff = desiredAngle - me.aimAngle;
        if (Math.abs(diff) > 0.08 && snapshot.turnTimeLeft > 8.0) {
          dx = Math.sign(diff) * 0.7;
        } else if (snapshot.turnTimeLeft < 11.2 && mem.actionCooldown <= 0) {
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

  return {
    dx: clampUnit(dx),
    dy: clampUnit(dy),
    a,
    b,
  };
}
