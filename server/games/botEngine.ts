import type { BotDifficulty, ControllerInput } from '../../src/shared/types.ts';
import { getUniversalBotProfile, type UniversalBotProfile } from '../../src/shared/botProfile.ts';

export type BotAdapterKind = 'real-time' | 'turn-based' | 'card';

/**
 * Per-bot cognitive state for the Universal Real-Time Adapter.
 * Uses accumulated `dt` (`clockSec` and `roundElapsedSec`) so behavior is
 * 100% identical in live 30Hz matches and fast-forwarded simulation tests.
 */
interface RealtimeBotMemory {
  lastGameId: string;
  roundMarker: string;
  clockSec: number;
  roundElapsedSec: number;
  lastDecisionTime: number;
  heldDx: number;
  heldDy: number;
  wanderAngle: number;
  orbitDir: number;
  opponentHasMoved: boolean;
  pendingA: boolean;
  readyAtA: number;
  cooldownUntilA: number;
  pendingB: boolean;
  readyAtB: number;
  cooldownUntilB: number;
}

const realtimeMemoryMap = new Map<string, RealtimeBotMemory>();

export function clearRealtimeBotMemory(keyPrefix?: string): void {
  if (!keyPrefix) {
    realtimeMemoryMap.clear();
    return;
  }
  for (const key of realtimeMemoryMap.keys()) {
    if (key.startsWith(keyPrefix)) {
      realtimeMemoryMap.delete(key);
    }
  }
}

function getOrCreateMemory(
  key: string,
  gameId: string,
  roundMarker: string,
  seedAngle: number,
): RealtimeBotMemory {
  let mem = realtimeMemoryMap.get(key);
  if (!mem || mem.lastGameId !== gameId || mem.roundMarker !== roundMarker) {
    mem = {
      lastGameId: gameId,
      roundMarker,
      clockSec: 0,
      roundElapsedSec: 0,
      lastDecisionTime: -999,
      heldDx: 0,
      heldDy: 0,
      wanderAngle: seedAngle,
      orbitDir: seedAngle % 2 > 1 ? 1 : -1,
      opponentHasMoved: false,
      pendingA: false,
      readyAtA: 0,
      cooldownUntilA: 0,
      pendingB: false,
      readyAtB: 0,
      cooldownUntilB: 0,
    };
    realtimeMemoryMap.set(key, mem);
    if (realtimeMemoryMap.size > 1024) {
      const oldestKey = realtimeMemoryMap.keys().next().value;
      if (oldestKey) realtimeMemoryMap.delete(oldestKey);
    }
  }
  return mem;
}

export interface RealtimeTargetPoint {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  weight?: number;
  isAggressiveTarget?: boolean;
}

export interface RealtimeBotAdapterInput {
  /** Unique key for this bot instance (e.g., `${gameId}:${botId}`) */
  memoryKey: string;
  gameId: string;
  botId: string;
  difficulty?: BotDifficulty;
  /** Simulation step delta time in seconds */
  dt: number;
  /** Round/phase identifier; when it changes, startDelay resets */
  roundMarker?: string;
  /** Optional explicit elapsed seconds in current round (if known from game snapshot) */
  roundElapsedSec?: number;
  /** Bot's current position and velocity (if applicable) */
  selfPos?: { x: number; y: number; vx?: number; vy?: number };
  /** Safe / center anchor point (used for safe positioning or boundary recovery) */
  safeCenter?: { x: number; y: number; safeRadius?: number };
  /** Optional structured targets (opponents, pickups, objectives) for lookahead intercept */
  targets?: RealtimeTargetPoint[];
  /** Raw desired steering vector computed by the game's sensor translator */
  desiredMove: { dx: number; dy: number };
  /** True when the bot is actively rescuing itself from an arena hazard / ring boundary */
  isBoundaryRecovery?: boolean;
  /** Whether the desired move is an offensive/attack pursuit toward another player */
  isOffensiveMove?: boolean;
  /** Whether the game's sensor translator wants to press Action A */
  wantsActionA: boolean;
  /** Whether Action A is an aggressive attack (vs a required jump/survival input) */
  isAggressiveActionA?: boolean;
  /** Whether the game's sensor translator wants to press Action B */
  wantsActionB?: boolean;
  /** Whether Action B is an aggressive attack */
  isAggressiveActionB?: boolean;
  /** True for lane/grid/cursor real-time games where dx/dy should not be rotated by 2D angular aimError */
  discreteSteering?: boolean;
}

/**
 * ADAPTER 1: Universal Real-Time Arcade Bot Adapter
 *
 * Applies the 8 universal cognitive parameters (`startDelay`, `decisionInterval`,
 * `reactionTime`, `mistakeRate`, `aimError`, `evaluationNoise`, `lookaheadDepth`, `aggression`)
 * to any real-time arcade game's raw sensor output.
 *
 * Fairness guarantee: never modifies max movement speed, cooldowns, knockback, or rules.
 */
export function runRealtimeBotAdapter(input: RealtimeBotAdapterInput): ControllerInput {
  const profile = getUniversalBotProfile(input.difficulty);
  const roundMarker = input.roundMarker ?? 'r1';
  const seedHash = hashString(`${input.memoryKey}:${input.botId}`);
  const mem = getOrCreateMemory(
    input.memoryKey,
    input.gameId,
    roundMarker,
    (seedHash % 628) / 100,
  );

  const stepDt = Math.max(0.001, Math.min(0.25, input.dt || 0.033));
  mem.clockSec += stepDt;
  mem.roundElapsedSec =
    typeof input.roundElapsedSec === 'number'
      ? Math.max(0, input.roundElapsedSec)
      : mem.roundElapsedSec + stepDt;

  const inStartDelay = mem.roundElapsedSec < profile.startDelay;
  const isOffensiveMove = input.isOffensiveMove ?? true;
  const isAggressiveA = input.isAggressiveActionA ?? true;
  const isAggressiveB = input.isAggressiveActionB ?? true;
  const hasExplicitTargets = Boolean(input.targets && input.targets.length > 0);

  // Check if the bot is near the danger boundary of the arena
  let nearDangerBoundary = Boolean(input.isBoundaryRecovery);
  let criticalBoundary = false;
  let toCenterX = 0;
  let toCenterY = 0;
  let distFromCenter = 0;
  let safeRadius = 240;

  if (input.selfPos && input.safeCenter) {
    toCenterX = input.safeCenter.x - input.selfPos.x;
    toCenterY = input.safeCenter.y - input.selfPos.y;
    distFromCenter = Math.hypot(toCenterX, toCenterY);
    safeRadius = input.safeCenter.safeRadius ?? 240;
    if (distFromCenter > safeRadius * 0.72) {
      nearDangerBoundary = true;
    }
    if (distFromCenter > safeRadius * 0.84) {
      criticalBoundary = true;
    }
  }

  // If the game sensor explicitly commands an immediate stop (e.g., Red Light in red-light-dash)
  // and no pursuit targets are active, respect the stop.
  const wantsExplicitStop =
    Math.hypot(input.desiredMove.dx, input.desiredMove.dy) < 0.02 &&
    !hasExplicitTargets &&
    !nearDangerBoundary;

  // Latch opponentHasMoved as soon as any rival player begins actively steering
  if (
    !mem.opponentHasMoved &&
    input.targets &&
    input.targets.some((t) => t.isAggressiveTarget && Math.hypot(t.vx ?? 0, t.vy ?? 0) > 25)
  ) {
    mem.opponentHasMoved = true;
  }

  // Check whether all aggressive targets have remained unmoving since round start during the opening grace window
  const hasStationaryOpponentInOpening =
    !mem.opponentHasMoved &&
    mem.roundElapsedSec < profile.startDelay * 8.5 &&
    Boolean(input.targets && input.targets.some((t) => t.isAggressiveTarget));

  // Re-evaluate steering vector once per decisionInterval (or immediately on critical boundary recovery)
  const decisionDue =
    mem.clockSec - mem.lastDecisionTime >= profile.decisionInterval ||
    (criticalBoundary && mem.clockSec - mem.lastDecisionTime >= profile.decisionInterval * 0.5) ||
    (wantsExplicitStop && (mem.heldDx !== 0 || mem.heldDy !== 0));

  if (decisionDue) {
    mem.lastDecisionTime = mem.clockSec;

    let baseDx = input.desiredMove.dx;
    let baseDy = input.desiredMove.dy;

    if (wantsExplicitStop) {
      mem.heldDx = 0;
      mem.heldDy = 0;
    } else if (input.discreteSteering) {
      // Discrete lane / grid / axis real-time games: apply startDelay and mistakeRate without 2D angular rotation
      if (inStartDelay && isOffensiveMove) {
        mem.heldDx = 0;
        mem.heldDy = 0;
      } else if (Math.random() < profile.mistakeRate * 0.65) {
        mem.heldDx = 0;
        mem.heldDy = 0;
      } else {
        mem.heldDx = Math.max(-1, Math.min(1, Number(baseDx.toFixed(3))));
        mem.heldDy = Math.max(-1, Math.min(1, Number(baseDy.toFixed(3))));
      }
    } else {
      // Decide whether this decision window is aggressive or safe/objective-focused
      const shouldMistake = Math.random() < profile.mistakeRate;
      const wantsAggressiveEngagement =
        !hasStationaryOpponentInOpening && Math.random() <= profile.aggression;

      // 1. If structured targets + selfPos are provided and not in boundary recovery, compute lookahead intercept
      if (!nearDangerBoundary && input.selfPos && input.targets && input.targets.length > 0) {
        const objectiveTargets = input.targets.filter((t) => !t.isAggressiveTarget);
        const aggressiveTargets = input.targets.filter((t) => t.isAggressiveTarget);

        // When playing safe, during startDelay, or when opponent hasn't moved yet in opening, prefer objective targets
        const pool =
          !inStartDelay &&
          !hasStationaryOpponentInOpening &&
          (wantsAggressiveEngagement || objectiveTargets.length === 0)
            ? input.targets
            : objectiveTargets;

        if (pool.length > 0) {
          const scored = pool.map((t, idx) => {
            const dist = Math.hypot(t.x - input.selfPos!.x, t.y - input.selfPos!.y);
            const w = t.weight ?? 1;
            return { t, idx, score: w / Math.max(24, dist) };
          });
          scored.sort((a, b) => b.score - a.score);

          // Apply mistakeRate to target selection when multiple targets exist
          let chosen = scored[0].t;
          if (scored.length > 1 && shouldMistake) {
            const altIdx = 1 + Math.floor(Math.random() * (scored.length - 1));
            chosen = scored[altIdx].t;
          }

          // Apply lookaheadDepth velocity prediction (0 = no lead, 1 = 0.18s lead, 2 = 0.34s intercept)
          const leadSec = profile.lookaheadDepth === 0 ? 0 : profile.lookaheadDepth === 1 ? 0.18 : 0.34;
          const predX = chosen.x + (chosen.vx ?? 0) * leadSec;
          const predY = chosen.y + (chosen.vy ?? 0) * leadSec;
          const selfCompX = profile.lookaheadDepth >= 2 ? (input.selfPos.vx ?? 0) * 0.10 : 0;
          const selfCompY = profile.lookaheadDepth >= 2 ? (input.selfPos.vy ?? 0) * 0.10 : 0;
          baseDx = predX - (input.selfPos.x + selfCompX);
          baseDy = predY - (input.selfPos.y + selfCompY);
        } else if (aggressiveTargets.length > 0) {
          baseDx = 0;
          baseDy = 0;
        }
      }

      // 2. Apply startDelay, mistakeRate, and aggression
      if (nearDangerBoundary && input.selfPos && input.safeCenter) {
        // Steer back toward safe center when near the edge, unless a mistake happens on non-critical boundary
        if (!criticalBoundary && shouldMistake && Math.random() < 0.4) {
          const centerAngle = Math.atan2(toCenterY, toCenterX) + mem.orbitDir * 0.85;
          baseDx = Math.cos(centerAngle);
          baseDy = Math.sin(centerAngle);
        } else {
          baseDx = toCenterX;
          baseDy = toCenterY;
        }
      } else if ((inStartDelay || hasStationaryOpponentInOpening) && isOffensiveMove) {
        // During round startDelay (or against an unmoving player in the opening window), move to inner center & hold
        if (input.selfPos && input.safeCenter) {
          if (distFromCenter > safeRadius * 0.26) {
            baseDx = toCenterX;
            baseDy = toCenterY;
          } else {
            baseDx = 0;
            baseDy = 0;
          }
        } else {
          baseDx = 0;
          baseDy = 0;
        }
      } else if (inStartDelay && !isOffensiveMove && mem.roundElapsedSec < profile.reactionTime * 1.4) {
        // Brief reaction delay at race/objective round start so bot never launches at t = 0.00s
        baseDx = 0;
        baseDy = 0;
      } else if (hasExplicitTargets || input.safeCenter) {
        // Arena combat / multi-target game with safeCenter or explicit targets
        const shouldPlaySafe = isOffensiveMove && !wantsAggressiveEngagement;

        if (shouldMistake) {
          if (Math.random() < 0.38) {
            baseDx = 0;
            baseDy = 0;
          } else {
            mem.wanderAngle += (Math.random() - 0.5) * 2.4;
            const curAngle = Math.hypot(baseDx, baseDy) > 0.05 ? Math.atan2(baseDy, baseDx) : mem.wanderAngle;
            const deviation = (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random() * 1.15);
            baseDx = Math.cos(curAngle + deviation);
            baseDy = Math.sin(curAngle + deviation);
          }
        } else if (shouldPlaySafe && input.selfPos && input.safeCenter) {
          // Non-aggressive window: patrol inner center (inside 0.32 * safeRadius) or coast briefly
          const centerAngle = Math.atan2(toCenterY, toCenterX);
          if (distFromCenter > safeRadius * 0.32) {
            const inwardOrbit = centerAngle + mem.orbitDir * 0.45;
            baseDx = Math.cos(inwardOrbit);
            baseDy = Math.sin(inwardOrbit);
          } else if (Math.random() < 0.45) {
            baseDx = 0;
            baseDy = 0;
          } else {
            const innerOrbit = centerAngle + mem.orbitDir * 1.25;
            baseDx = Math.cos(innerOrbit);
            baseDy = Math.sin(innerOrbit);
          }
        }
      } else {
        // Objective / waypoint / ball vector computed by the game's sensor translator:
        // On a mistake roll, apply sloppy cornering/aim deviation or brief hesitation without wandering off-objective
        if (shouldMistake && Math.hypot(baseDx, baseDy) > 0.05) {
          const curAngle = Math.atan2(baseDy, baseDx);
          const sloppyOffset = (Math.random() < 0.5 ? 1 : -1) * (0.28 + profile.aimError * 0.75);
          baseDx = Math.cos(curAngle + sloppyOffset);
          baseDy = Math.sin(curAngle + sloppyOffset);
        }
      }

      // 3. Apply aimError angular inaccuracy while preserving full legal movement speed
      const mag = Math.hypot(baseDx, baseDy);
      if (mag > 0.05) {
        const rawAngle = Math.atan2(baseDy, baseDx);
        const errScale = criticalBoundary ? 0.55 : 1.0;
        const angularJitter = (Math.random() * 2 - 1) * profile.aimError * errScale;
        const finalAngle = rawAngle + angularJitter;
        const legalMag = mag >= 0.35 ? 1.0 : mag;
        mem.heldDx = Number((Math.cos(finalAngle) * legalMag).toFixed(3));
        mem.heldDy = Number((Math.sin(finalAngle) * legalMag).toFixed(3));
      } else {
        mem.heldDx = 0;
        mem.heldDy = 0;
      }
    }
  }

  // 4. Evaluate Action A and Action B with startDelay, reactionTime, mistakeRate, and aggression
  const suppressOffensiveButtons = inStartDelay || hasStationaryOpponentInOpening;
  const fireA = evaluateButtonReaction(
    input.wantsActionA,
    isAggressiveA,
    suppressOffensiveButtons,
    mem.clockSec,
    profile,
    mem,
    'A',
  );
  const fireB = evaluateButtonReaction(
    Boolean(input.wantsActionB),
    isAggressiveB,
    suppressOffensiveButtons,
    mem.clockSec,
    profile,
    mem,
    'B',
  );

  return {
    dx: mem.heldDx,
    dy: mem.heldDy,
    a: fireA,
    b: fireB,
  };
}

function evaluateButtonReaction(
  wantsAction: boolean,
  isAggressive: boolean,
  inStartDelay: boolean,
  clockSec: number,
  profile: UniversalBotProfile,
  mem: RealtimeBotMemory,
  btn: 'A' | 'B',
): boolean {
  const pendingKey = btn === 'A' ? 'pendingA' : 'pendingB';
  const readyKey = btn === 'A' ? 'readyAtA' : 'readyAtB';
  const cooldownKey = btn === 'A' ? 'cooldownUntilA' : 'cooldownUntilB';

  if (inStartDelay && isAggressive) {
    mem[pendingKey] = false;
    return false;
  }

  // Latch a new reaction window when wantsAction triggers and button is off cognitive cooldown
  if (wantsAction && !mem[pendingKey] && clockSec >= mem[cooldownKey]) {
    mem[pendingKey] = true;
    const jitter = 0.85 + Math.random() * 0.3;
    mem[readyKey] = clockSec + profile.reactionTime * jitter;
  }

  // Once latched, let the cognitive reaction timer run to completion
  if (mem[pendingKey] && clockSec >= mem[readyKey]) {
    mem[pendingKey] = false;
    mem[cooldownKey] = clockSec + profile.reactionTime * 0.7;
    const passesMistake = Math.random() >= profile.mistakeRate * 0.75;
    const passesAggression = !isAggressive || Math.random() <= Math.min(1, profile.aggression + 0.18);
    if (passesMistake && passesAggression) {
      return true;
    }
  }

  return false;
}

/**
 * Helper to compute the total turn think delay (in milliseconds) for Turn-Based and Card games.
 * Enforces User Adjustment #4: total bot think delay never exceeds ~1.5 seconds on any difficulty.
 */
export function getTurnBotDelayMs(difficulty?: BotDifficulty): number {
  const profile = getUniversalBotProfile(difficulty);
  const rawMs = profile.turnDelay * 1000 * (0.92 + Math.random() * 0.16);
  return Math.min(1450, Math.max(280, Math.round(rawMs)));
}

export interface ScoredCandidateMove<TMove> {
  move: TMove;
  rawScore: number;
  lookaheadScore?: number;
  isAggressive?: boolean;
}

export interface TurnBasedBotAdapterInput<TMove> {
  difficulty?: BotDifficulty;
  candidates: ScoredCandidateMove<TMove>[];
  scoreMove?: (move: TMove, lookaheadDepth: number, profile: UniversalBotProfile) => number;
}

/**
 * ADAPTER 2: Universal Turn-Based Board Game Bot Adapter
 *
 * Enforces User Adjustment #5:
 * Normalizes all move scores to `[0..1]` BEFORE adding `profile.evaluationNoise`,
 * then applies `profile.mistakeRate`.
 */
export function selectTurnBasedBotMove<TMove>(input: TurnBasedBotAdapterInput<TMove>): TMove | null {
  const { candidates } = input;
  if (!candidates || candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].move;

  const profile = getUniversalBotProfile(input.difficulty);

  const rawScores = candidates.map((c) => {
    let base = input.scoreMove ? input.scoreMove(c.move, profile.lookaheadDepth, profile) : c.rawScore;
    if (typeof c.lookaheadScore === 'number' && profile.lookaheadDepth > 0) {
      const lookWeight = profile.lookaheadDepth === 1 ? 0.45 : 0.9;
      base += c.lookaheadScore * lookWeight;
    }
    if (c.isAggressive) {
      base += (profile.aggression - 0.5) * Math.max(1, Math.abs(base) * 0.25);
    }
    return base;
  });

  // Normalize scores to [0..1] BEFORE adding evaluationNoise
  let minScore = Infinity;
  let maxScore = -Infinity;
  for (const s of rawScores) {
    if (s < minScore) minScore = s;
    if (s > maxScore) maxScore = s;
  }
  const span = maxScore - minScore;

  const noisyRanked = candidates.map((c, idx) => {
    const normalized = span > 1e-6 ? (rawScores[idx] - minScore) / span : 0.5;
    const noise = (Math.random() * 2 - 1) * profile.evaluationNoise;
    return {
      move: c.move,
      normalizedScore: normalized,
      finalScore: normalized + noise,
    };
  });

  noisyRanked.sort((a, b) => b.finalScore - a.finalScore);

  if (noisyRanked.length > 1 && Math.random() < profile.mistakeRate) {
    const maxFallbackIdx = Math.min(noisyRanked.length - 1, Math.max(1, Math.ceil(noisyRanked.length * 0.6)));
    const fallbackIdx = 1 + Math.floor(Math.random() * maxFallbackIdx);
    return noisyRanked[fallbackIdx].move;
  }

  return noisyRanked[0].move;
}

export interface CardBotAdapterInput<TMove, TPublicView, TPrivateSeatView> {
  difficulty?: BotDifficulty;
  publicView: TPublicView;
  privateSeatView: TPrivateSeatView;
  legalMoves: TMove[];
  scoreMove: (
    move: TMove,
    publicView: TPublicView,
    privateSeatView: TPrivateSeatView,
    profile: UniversalBotProfile,
  ) => { score: number; lookaheadScore?: number; isAggressive?: boolean };
}

/**
 * ADAPTER 3: Universal Hidden-Information Card & Party Bot Adapter
 *
 * Enforces legal seat visibility (only `publicView` + `privateSeatView`) and normalizes
 * candidate scores to `[0..1]` BEFORE adding `profile.evaluationNoise`.
 */
export function selectCardBotMove<TMove, TPublicView, TPrivateSeatView>(
  input: CardBotAdapterInput<TMove, TPublicView, TPrivateSeatView>,
): TMove | null {
  if (!input.legalMoves || input.legalMoves.length === 0) return null;
  if (input.legalMoves.length === 1) return input.legalMoves[0];

  const profile = getUniversalBotProfile(input.difficulty);
  const candidates: ScoredCandidateMove<TMove>[] = input.legalMoves.map((move) => {
    const res = input.scoreMove(move, input.publicView, input.privateSeatView, profile);
    return {
      move,
      rawScore: res.score,
      lookaheadScore: res.lookaheadScore,
      isAggressive: res.isAggressive,
    };
  });

  return selectTurnBasedBotMove({
    difficulty: input.difficulty,
    candidates,
  });
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
