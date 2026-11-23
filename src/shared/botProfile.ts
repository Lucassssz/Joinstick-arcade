import type { BotDifficulty } from './types';

/**
 * Single source of truth for JoinStick Arcade bot cognition.
 *
 * UNIVERSAL FAIRNESS RULE:
 * Bot difficulty NEVER modifies player movement speed, weapon cooldowns,
 * knockback multipliers, health, dice rolls, card draws, or game rules.
 * Every profile controls ONLY cognitive parameters:
 *
 * - startDelay: seconds after a real-time round starts/resets before the bot
 *   takes its first aggressive action.
 * - turnDelay: total seconds a turn-based or card bot waits before committing
 *   its move on its turn (capped <= 1.5s across all difficulties so Chill
 *   never makes human players wait 2.5s per turn).
 * - decisionInterval: seconds between real-time steering/target re-evaluations
 *   (sample-and-hold cadence).
 * - reactionTime: seconds of cognitive latency before pressing an action/attack
 *   button once a trigger condition appears.
 * - mistakeRate: probability [0..1] of choosing a sub-optimal or exploratory
 *   move/target instead of the highest-scored candidate.
 * - aimError: spatial/angular aiming inaccuracy in radians / normalized arena
 *   units (applied to real-time aim vectors and target coordinates).
 * - evaluationNoise: random noise amplitude [0..1] added to normalized [0..1]
 *   candidate move scores in turn-based and card adapters.
 * - lookaheadDepth: planning depth (0 = immediate state only, 1 = 1-step
 *   lookahead / linear velocity lead, 2 = 2-step lookahead / full intercept).
 * - aggression: preference [0..1] for offensive/attack actions vs safe positioning
 *   or defensive play.
 */
export interface UniversalBotProfile {
  id: BotDifficulty;
  label: string;
  startDelay: number;
  turnDelay: number;
  decisionInterval: number;
  reactionTime: number;
  mistakeRate: number;
  aimError: number;
  evaluationNoise: number;
  lookaheadDepth: number;
  aggression: number;
}

export const UNIVERSAL_BOT_PROFILES: Record<BotDifficulty, UniversalBotProfile> = {
  chill: {
    id: 'chill',
    label: 'Chill',
    startDelay: 1.85,
    turnDelay: 1.15,
    decisionInterval: 0.30,
    reactionTime: 0.34,
    mistakeRate: 0.22,
    aimError: 0.27,
    evaluationNoise: 0.42,
    lookaheadDepth: 0,
    aggression: 0.43,
  },
  arcade: {
    id: 'arcade',
    label: 'Arcade',
    startDelay: 0.85,
    turnDelay: 0.85,
    decisionInterval: 0.22,
    reactionTime: 0.24,
    mistakeRate: 0.14,
    aimError: 0.19,
    evaluationNoise: 0.18,
    lookaheadDepth: 1,
    aggression: 0.54,
  },
  spicy: {
    id: 'spicy',
    label: 'Spicy',
    startDelay: 0.30,
    turnDelay: 0.55,
    decisionInterval: 0.11,
    reactionTime: 0.12,
    mistakeRate: 0.04,
    aimError: 0.06,
    evaluationNoise: 0.04,
    lookaheadDepth: 2,
    aggression: 0.80,
  },
};

export function getUniversalBotProfile(difficulty?: BotDifficulty | null): UniversalBotProfile {
  if (difficulty && difficulty in UNIVERSAL_BOT_PROFILES) {
    return UNIVERSAL_BOT_PROFILES[difficulty];
  }
  return UNIVERSAL_BOT_PROFILES.chill;
}
