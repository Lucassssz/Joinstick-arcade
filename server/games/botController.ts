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
}

interface DifficultyTuning {
  moveScale: number;
  abilityChance: number;
  aimJitter: number;
  reactionCooldown: number;
}

const DIFFICULTY_TUNING: Record<BotDifficulty, DifficultyTuning> = {
  chill: {
    moveScale: 0.68,
    abilityChance: 0.35,
    aimJitter: 0.34,
    reactionCooldown: 0.32,
  },
  arcade: {
    moveScale: 0.88,
    abilityChance: 0.68,
    aimJitter: 0.14,
    reactionCooldown: 0.16,
  },
  spicy: {
    moveScale: 1.0,
    abilityChance: 0.96,
    aimJitter: 0.04,
    reactionCooldown: 0.07,
  },
};

export function createBotMemory(): BotMemory {
  return {
    wanderAngle: Math.random() * Math.PI * 2,
    wanderTimer: 0.6 + Math.random() * 0.8,
    actionCooldown: 0,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
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
  mem.actionCooldown = Math.max(0, mem.actionCooldown - dt);
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
        const { item: target, dist } = nearestOf(me.x, me.y, rivals);
        if (target) {
          const s = steerToward(me.x, me.y, target.x, target.y, tuning, mem.wanderAngle);
          dx = s.dx;
          dy = s.dy;
          if (dist < 165 && me.cooldownA <= 0 && canAct() && Math.random() < 0.2) {
            a = true;
            markActed();
          } else if (dist < 110 && me.cooldownB <= 0 && canAct() && Math.random() < 0.25) {
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

      if (pickup && pDist < 220) {
        const s = steerToward(me.x, me.y, pickup.x, pickup.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else if (target) {
        const s = steerToward(me.x, me.y, target.x, target.y, tuning, mem.wanderAngle);
        if (tDist < 180) {
          // Strafe while keeping aim
          dx = s.dx * 0.4 - s.dy * 0.65 * mem.strafeDir;
          dy = s.dy * 0.4 + s.dx * 0.65 * mem.strafeDir;
        } else {
          dx = s.dx;
          dy = s.dy;
        }
        if (tDist < 480 && Math.random() < tuning.abilityChance * 0.65) a = true;
        if (tDist < 140 && me.cooldownB <= 0 && canAct() && Math.random() < 0.15) {
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
      const s = steerToward(me.x, me.y, lookAhead.x, lookAhead.y, tuning);
      dx = s.dx;
      dy = s.dy;

      // Measure upcoming corner sharpness
      const a1 = Math.atan2(lookAhead.y - me.y, lookAhead.x - me.x);
      const a2 = Math.atan2(nextPt.y - lookAhead.y, nextPt.x - lookAhead.x);
      let turn = a2 - a1;
      while (turn > Math.PI) turn -= Math.PI * 2;
      while (turn < -Math.PI) turn += Math.PI * 2;

      b = Math.abs(turn) > 0.55 && me.speed > 260 && Math.random() < tuning.abilityChance;
      a = Math.abs(turn) < 0.35 && me.nitro > 0.45 && Math.random() < tuning.abilityChance * 0.5;
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
          if ((safeDist > 68 || !currentTile) && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        }
      } else if (safeTile) {
        // Keep moving smoothly across solid hexes toward the center cluster
        const centerSolid = solidTiles.sort(
          (t1, t2) =>
            Math.hypot(t1.x - ARENA_WIDTH / 2, t1.y - ARENA_HEIGHT / 2) -
            Math.hypot(t2.x - ARENA_WIDTH / 2, t2.y - ARENA_HEIGHT / 2)
        )[0];
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
      if (rival.item && rival.dist < 85 && me.cooldownB <= 0 && canAct() && Math.random() < 0.2) {
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
        if (holder) {
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
      // Check ahead, left-turn, right-turn for walls & trail points
      const dangerAt = (ang: number, dist: number): number => {
        const tx = me.x + Math.cos(ang) * dist;
        const ty = me.y + Math.sin(ang) * dist;
        if (tx < 58 || tx > ARENA_WIDTH - 58 || ty < 58 || ty > ARENA_HEIGHT - 58) return 1000;
        let score = 0;
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
        if (ahead > 180 && leftD > 120 && rightD > 120 && me.cooldownB <= 0 && canAct()) {
          b = true;
          markActed();
        }
      } else if (Math.random() < 0.04) {
        chosenAngle += (Math.random() - 0.5) * 0.7;
      }
      dx = Math.cos(chosenAngle) * tuning.moveScale;
      dy = Math.sin(chosenAngle) * tuning.moveScale;
      if (ahead < 20 && me.cooldownA <= 0 && canAct() && Math.random() < 0.04) {
        a = true;
        markActed();
      }
      break;
    }

    case 'ricochet-tanks': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive);
      const { item: target, dist } = nearestOf(me.x, me.y, rivals);
      if (target) {
        const s = steerToward(me.x, me.y, target.x, target.y, tuning, mem.wanderAngle);
        if (dist < 220) {
          dx = -s.dy * mem.strafeDir;
          dy = s.dx * mem.strafeDir;
        } else {
          dx = s.dx;
          dy = s.dy;
        }
        if (me.cooldownA <= 0 && canAct() && Math.random() < 0.16) {
          a = true;
          markActed();
        }
        if (dist < 145 && me.cooldownB <= 0 && canAct() && Math.random() < 0.1) {
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
      // Aim for point slightly behind ball aligned with enemy goal
      const bgx = enemyGoalX - ball.x;
      const bgy = enemyGoalY - ball.y;
      const bgd = Math.hypot(bgx, bgy) || 1;
      const desiredX = ball.x - (bgx / bgd) * 34;
      const desiredY = ball.y - (bgy / bgd) * 34;
      const s = steerToward(me.x, me.y, desiredX, desiredY, tuning);
      dx = s.dx;
      dy = s.dy;
      const distBall = Math.hypot(ball.x - me.x, ball.y - me.y);
      if (distBall < 74 && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      } else if (distBall > 170 && me.cooldownB <= 0 && canAct() && Math.random() < 0.08) {
        b = true;
        markActed();
      }
      break;
    }

    case 'paint-rush': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      // Find a nearby tile NOT owned by this bot
      const cellW = ARENA_WIDTH / snapshot.cols;
      const cellH = ARENA_HEIGHT / snapshot.rows;
      let targetX = ARENA_WIDTH / 2 + Math.cos(mem.wanderAngle) * 260;
      let targetY = ARENA_HEIGHT / 2 + Math.sin(mem.wanderAngle) * 180;
      let bestScore = Infinity;
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
      const s = steerToward(me.x, me.y, targetX, targetY, tuning);
      dx = s.dx;
      dy = s.dy;
      if (me.cooldownA <= 0 && canAct() && Math.random() < 0.1) {
        a = true;
        markActed();
      } else if (me.cooldownB <= 0 && canAct() && Math.random() < 0.08) {
        b = true;
        markActed();
      }
      break;
    }

    case 'laser-gauntlet': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const { item: orb, dist: orbD } = nearestOf(me.x, me.y, snapshot.orbs);
      if (orb && orbD < 130) {
        const s = steerToward(orb.x, orb.y, me.x, me.y, tuning);
        dx = s.dx;
        dy = s.dy;
        if (orbD < 75 && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        }
      } else {
        const { item: sh } = nearestOf(me.x, me.y, snapshot.shards);
        if (sh) {
          const s = steerToward(me.x, me.y, sh.x, sh.y, tuning);
          dx = s.dx;
          dy = s.dy;
        }
      }
      if (snapshot.orbs.length >= 3 && me.cooldownB <= 0 && canAct() && Math.random() < 0.06) {
        b = true;
        markActed();
      }
      break;
    }

    case 'vault-heist': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me) break;
      if (me.carrying >= 2) {
        const s = steerToward(me.x, me.y, snapshot.portal.x, snapshot.portal.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const { item: rel } = nearestOf(me.x, me.y, snapshot.relics);
        if (rel) {
          const s = steerToward(me.x, me.y, rel.x, rel.y, tuning);
          dx = s.dx;
          dy = s.dy;
        }
      }
      const nearDrone = nearestOf(me.x, me.y, snapshot.drones.filter((d) => d.disabledTimer <= 0));
      if (nearDrone.item && nearDrone.dist < 135) {
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
      const onMySide = me.side === 'left' ? puck.x < ARENA_WIDTH * 0.55 : puck.x > ARENA_WIDTH * 0.45;
      const homeX = me.side === 'left' ? 190 : ARENA_WIDTH - 190;
      const targetX = onMySide
        ? me.side === 'left'
          ? Math.min(ARENA_WIDTH / 2 - 60, Math.max(115, puck.x + 12))
          : Math.max(ARENA_WIDTH / 2 + 60, Math.min(ARENA_WIDTH - 115, puck.x - 12))
        : homeX;
      const targetY = Math.max(96, Math.min(ARENA_HEIGHT - 96, puck.y));
      const s = steerToward(me.x, me.y, targetX, targetY, tuning);
      if (s.dist > 14) {
        dx = s.dx;
        dy = s.dy;
      }
      const pDist = Math.hypot(puck.x - me.x, puck.y - me.y);
      if (pDist < 95 && me.cooldownA <= 0 && canAct()) {
        a = true;
        markActed();
      } else if (pDist < 180 && pDist > 90 && me.cooldownB <= 0 && canAct() && Math.random() < 0.08) {
        b = true;
        markActed();
      }
      break;
    }

    case 'blade-duel': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive || me.stunTimer > 0) break;
      const rival = snapshot.players.find((p) => p.id !== botId && p.alive);
      if (rival) {
        const s = steerToward(me.x, me.y, rival.x, rival.y, tuning);
        if (s.dist > 165) {
          dx = s.dx * 0.85 - s.dy * 0.3 * mem.strafeDir;
          dy = s.dy * 0.85 + s.dx * 0.3 * mem.strafeDir;
        } else {
          dx = -s.dy * 0.7 * mem.strafeDir;
          dy = s.dx * 0.7 * mem.strafeDir;
        }
        if (rival.slashTimer > 0.05 && s.dist < 175 && me.cooldownB <= 0 && canAct()) {
          b = true;
          markActed();
        } else if (s.dist < 155 && me.cooldownA <= 0 && canAct() && Math.random() < 0.14) {
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
      const targetY = ARENA_HEIGHT / 2 + Math.sin(mem.wanderAngle * 2) * 210;
      const diffY = targetY - me.y;
      dy = Math.abs(diffY) > 16 ? Math.sign(diffY) * tuning.moveScale * 0.75 : 0;
      a = me.cooldownA <= 0 && Math.random() < tuning.abilityChance * 0.45;
      const incoming = snapshot.shells.find(
        (sh) => sh.ownerId !== me.id && Math.hypot(sh.x - me.x, sh.y - me.y) < 130
      );
      if (incoming && me.cooldownB <= 0 && canAct()) {
        b = true;
        markActed();
      }
      break;
    }

    case 'crown-heist': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.stunTimer > 0) break;
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
          if (dist < 115 && me.cooldownB <= 0 && canAct()) {
            b = true;
            markActed();
          }
        }
      } else {
        const s = steerToward(me.x, me.y, snapshot.crownX, snapshot.crownY, tuning);
        dx = s.dx;
        dy = s.dy;
        if (s.dist < 145 && me.cooldownA <= 0 && canAct() && Math.random() < 0.2) {
          a = true;
          markActed();
        }
      }
      break;
    }

    case 'freeze-tag': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || me.frozen) break;
      if (me.role === 'hunter') {
        const targets = snapshot.players.filter((p) => p.role === 'runner' && !p.frozen);
        const { item: target, dist } = nearestOf(me.x, me.y, targets);
        if (target) {
          const s = steerToward(me.x, me.y, target.x, target.y, tuning);
          dx = s.dx;
          dy = s.dy;
          if (dist < 260 && me.cooldownA <= 0 && canAct() && Math.random() < 0.14) {
            a = true;
            markActed();
          } else if (dist < 190 && me.cooldownB <= 0 && canAct() && Math.random() < 0.05) {
            b = true;
            markActed();
          }
        }
      } else {
        const hunters = snapshot.players.filter((p) => p.role === 'hunter');
        const { item: hunter, dist: hDist } = nearestOf(me.x, me.y, hunters);
        const frozenAlly = snapshot.players.find((p) => p.role === 'runner' && p.frozen);
        if (hunter && hDist < 220) {
          const d = hDist || 1;
          dx = ((me.x - hunter.x) / d) * tuning.moveScale;
          dy = ((me.y - hunter.y) / d) * tuning.moveScale;
          if (hDist < 120 && me.cooldownA <= 0 && canAct()) {
            a = true;
            markActed();
          }
        } else if (frozenAlly) {
          const s = steerToward(me.x, me.y, frozenAlly.x, frozenAlly.y, tuning);
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
      if (me.role === 'ghost') {
        const { item: near, dist } = nearestOf(me.x, me.y, hunters);
        if (near) {
          if (me.visibility > 0.65 && dist < 240) {
            const s = steerToward(near.x, near.y, me.x, me.y, tuning);
            dx = s.dx;
            dy = s.dy;
            if (me.cooldownB <= 0 && canAct()) {
              b = true;
              markActed();
            }
          } else {
            const s = steerToward(me.x, me.y, near.x, near.y, tuning);
            dx = s.dx * 0.85;
            dy = s.dy * 0.85;
            if (dist < 135 && me.cooldownA <= 0 && canAct()) {
              a = true;
              markActed();
            }
          }
        }
      } else if (ghost) {
        const s = steerToward(me.x, me.y, ghost.x, ghost.y, tuning, mem.wanderAngle);
        dx = s.dx * 0.82;
        dy = s.dy * 0.82;
        if (ghost.visibility > 0.45 && s.dist < 300 && me.cooldownA <= 0 && canAct() && Math.random() < 0.2) {
          a = true;
          markActed();
        } else if (ghost.visibility < 0.3 && me.cooldownB <= 0 && canAct() && Math.random() < 0.04) {
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
      if (downedAlly) {
        const s = steerToward(me.x, me.y, downedAlly.x, downedAlly.y, tuning);
        dx = s.dx;
        dy = s.dy;
      } else {
        const { item: threat, dist } = nearestOf(me.x, me.y, snapshot.meteors);
        if (threat) {
          const s = steerToward(me.x, me.y, threat.x, threat.y, tuning);
          if (dist < 130) {
            // Back off slightly while firing
            dx = -s.dx * 0.5;
            dy = -s.dy * 0.5;
            if (dist < 90 && me.cooldownB <= 0 && canAct()) {
              b = true;
              markActed();
            }
          } else {
            dx = s.dx;
            dy = s.dy;
          }
          a = dist < 440 && Math.random() < tuning.abilityChance * 0.8;
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
      const rivals = snapshot.players.filter((p) => p.id !== botId && p.alive && !p.falling);
      const { item: rival, dist } = nearestOf(me.x, me.y, rivals);
      if (rival && dist < 430 && me.cooldownA <= 0 && canAct() && Math.random() < 0.14) {
        const aim = steerToward(me.x, me.y, rival.x, rival.y, tuning);
        dx = aim.dx;
        dy = aim.dy;
        a = true;
        markActed();
      } else {
        const s = steerToward(me.x, me.y, cx, cy, tuning);
        if (s.dist > 36) {
          dx = s.dx * 0.7;
          dy = s.dy * 0.7;
        }
      }
      if ((me.hookedBy || (rival && dist < 105)) && me.cooldownB <= 0 && canAct()) {
        b = true;
        markActed();
      }
      break;
    }

    case 'gravity-flip': {
      const me = snapshot.players.find((p) => p.id === botId);
      if (!me || !me.alive) break;
      const mySide: 'floor' | 'ceiling' = me.gravityDir === 1 ? 'floor' : 'ceiling';
      const aheadDanger = snapshot.obstacles.find(
        (ob) => ob.x > me.x - 20 && ob.x < me.x + 195 && (ob.side === mySide || ob.side === 'mid')
      );
      if (aheadDanger) {
        if (aheadDanger.side === mySide && me.cooldownA <= 0 && canAct()) {
          a = true;
          markActed();
        } else if (me.cooldownB <= 0 && canAct()) {
          b = true;
          markActed();
        }
      } else {
        // Flip toward upcoming coins on the opposite lane when safe
        const nextCoin = snapshot.coins.find((c) => c.x > me.x + 40 && c.x < me.x + 260);
        if (nextCoin) {
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
  }

  return {
    dx: clampUnit(dx),
    dy: clampUnit(dy),
    a,
    b,
  };
}
