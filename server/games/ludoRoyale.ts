import type {
  BotDifficulty,
  LudoPlayerState,
  LudoRoyaleSnapshot,
  RankingEntry,
  SoundEvent,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';
import { selectTurnBasedBotMove, getTurnBotDelayMs } from './botEngine.ts';

interface LudoRoyaleState {
  round: number;
  totalRounds: number;
  turnIndex: number;
  phase: 'wait-roll' | 'rolling' | 'moving' | 'event';
  turnTimeLeft: number;
  phaseTimer: number;
  diceValue: number;
  diceRolling: boolean;
  stepsRemaining: number;
  hopProgress: number;
  movingTokenIndex: number;
  starIndices: number[];
  moveCooldowns: Record<string, number>;
  banner: string | null;
  eventText: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LudoPlayerState[];
  finished: boolean;
  botThinkTimer?: number;
}

const TRACK_LEN = 28;
const GOAL_STEP = 31;
const STAR_INDICES = [0, 7, 14, 21, 4, 11, 18, 25];
const TURN_TIMEOUT = 14;

function advanceTurn(state: LudoRoyaleState): void {
  state.turnIndex = (state.turnIndex + 1) % state.players.length;
  if (state.turnIndex === 0) {
    state.round++;
    if (state.round > state.totalRounds) {
      state.finished = true;
      state.banner = 'ROYAL MATCH COMPLETE!';
      return;
    }
  }
  state.phase = 'wait-roll';
  state.turnTimeLeft = TURN_TIMEOUT;
  state.diceRolling = false;
  state.banner = null;
  state.botThinkTimer = undefined;
  const active = state.players[state.turnIndex];
  if (active) {
    const firstActive = active.tokens.findIndex((t) => t >= 0 && t < GOAL_STEP);
    if (firstActive !== -1) active.selectedToken = firstActive;
    state.eventText = `${active.name}'s Turn — Stick/B Picks Token · Press A to Roll!`;
  }
}

export const ludoRoyaleModule: ServerGameModule<LudoRoyaleState> = {
  id: 'ludo-royale',

  createState(players: ServerPlayerInputState[], settingValue: number): LudoRoyaleState {
    const totalRounds = settingValue || 12;
    const moveCooldowns: Record<string, number> = {};
    const ludoPlayers: LudoPlayerState[] = players.map((p, idx) => {
      moveCooldowns[p.id] = 0;
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        isBot: p.isBot,
        startTrackIndex: (idx * 7) % TRACK_LEN,
        selectedToken: 0,
        tokens: [0, -1, -1],
        visualSteps: [0, -1, -1],
        finishedCount: 0,
        captures: 0,
        boostReady: true,
        score: 0,
        cooldownA: 0,
        cooldownB: 0,
      };
    });

    return {
      round: 1,
      totalRounds,
      turnIndex: 0,
      phase: 'wait-roll',
      turnTimeLeft: TURN_TIMEOUT,
      phaseTimer: 0,
      diceValue: 6,
      diceRolling: false,
      stepsRemaining: 0,
      hopProgress: 0,
      movingTokenIndex: 0,
      starIndices: [...STAR_INDICES],
      moveCooldowns,
      banner: null,
      eventText: ludoPlayers[0] ? `${ludoPlayers[0].name}'s Turn — Stick/B Picks Token · Press A to Roll!` : null,
      popups: [],
      players: ludoPlayers,
      finished: false,
    };
  },

  step(state: LudoRoyaleState, players: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];
    const inputMap = new Map(players.map((p) => [p.id, p]));

    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= dt * 28;
      state.popups[i].alpha -= dt * 0.95;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    if (state.players.length === 0) state.finished = true;

    if (!state.finished) {
      const active = state.players[state.turnIndex];
      const inp = inputMap.get(active.id);
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);
      state.moveCooldowns[active.id] = Math.max(0, (state.moveCooldowns[active.id] || 0) - dt);

      if (state.phase === 'wait-roll') {
        state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);

        if (active.isBot) {
          if (state.botThinkTimer === undefined) {
            state.botThinkTimer = getTurnBotDelayMs(inp?.botDifficulty) / 1000;
          }
          state.botThinkTimer -= dt;
          if (state.botThinkTimer <= 0) {
            state.phase = 'rolling';
            state.phaseTimer = 0.75;
            state.diceRolling = true;
            state.diceValue = 1 + Math.floor(Math.random() * 6);
            sounds.push({ type: 'confirm', playerId: active.id });
            haptics.push({ playerId: active.id, pattern: 22, reason: 'ludo-roll' });
          }
        } else {
          const stickDir =
            inp && state.moveCooldowns[active.id] <= 0 && Math.abs(inp.input.dx) > 0.45
              ? Math.sign(inp.input.dx)
              : 0;
          if (justB || stickDir !== 0) {
            const delta = stickDir !== 0 ? stickDir : 1;
            active.selectedToken = (active.selectedToken + delta + 3) % 3;
            state.moveCooldowns[active.id] = 0.22;
            const tokStatus =
              active.tokens[active.selectedToken] === -1
                ? 'In Base'
                : active.tokens[active.selectedToken] >= GOAL_STEP
                ? 'Home'
                : `Step ${active.tokens[active.selectedToken] + 1}`;
            state.eventText = `${active.name} selected Token #${active.selectedToken + 1} (${tokStatus})`;
            sounds.push({ type: 'nav', playerId: active.id });
          }

          if (justA || state.turnTimeLeft <= 0) {
            state.phase = 'rolling';
            state.phaseTimer = 0.75;
            state.diceRolling = true;
            state.diceValue = 1 + Math.floor(Math.random() * 6);
            sounds.push({ type: 'confirm', playerId: active.id });
            haptics.push({ playerId: active.id, pattern: 22, reason: 'ludo-roll' });
          }
        }
      } else if (state.phase === 'rolling') {
        state.phaseTimer -= dt;
        if (Math.random() < 0.45) {
          state.diceValue = 1 + Math.floor(Math.random() * 6);
        }
        if (state.phaseTimer <= 0) {
          state.diceRolling = false;
          let roll = 1 + Math.floor(Math.random() * 6);
          if (active.tokens.every((t) => t === -1 || t >= GOAL_STEP) && Math.random() < 0.72) {
            roll = 6;
          }
          state.diceValue = roll;

          const difficulty = inp?.botDifficulty;
          const candidates = active.tokens.map((tokenPos, tokenIdx) => {
            const canMove = tokenPos === -1 ? roll >= 5 || active.tokens.every((t) => t === -1 || t >= GOAL_STEP) : tokenPos < GOAL_STEP;
            if (!canMove) return null;
            let rawScore = tokenPos === -1 ? 30 : tokenPos * 2;
            if (tokenPos + roll >= GOAL_STEP) rawScore += 120;
            const curStep = tokenPos === -1 ? 0 : tokenPos;
            const newStep = Math.min(GOAL_STEP, curStep + roll);
            if (newStep < TRACK_LEN) {
              const absTrack = (active.startTrackIndex + newStep) % TRACK_LEN;
              if (state.starIndices.includes(absTrack)) rawScore += 40;
              for (const other of state.players) {
                if (other.id === active.id) continue;
                for (const oStep of other.tokens) {
                  if (oStep >= 0 && oStep < TRACK_LEN) {
                    if ((other.startTrackIndex + oStep) % TRACK_LEN === absTrack) {
                      rawScore += 90;
                    }
                  }
                }
              }
            }
            return { move: tokenIdx, rawScore };
          }).filter(Boolean) as { move: number; rawScore: number }[];

          const tokIdx = candidates.length > 0
            ? (active.isBot
                ? selectTurnBasedBotMove({ difficulty, candidates }) ?? candidates[0].move
                : (candidates.find((c) => c.move === active.selectedToken)?.move ?? candidates[0].move))
            : -1;
          if (tokIdx === -1) {
            state.eventText = `${active.name} rolled ${roll} — Need 5 or 6 to deploy from Base!`;
            state.phase = 'event';
            state.phaseTimer = 1.15;
          } else {
            active.selectedToken = tokIdx;
            state.movingTokenIndex = tokIdx;
            if (active.tokens[tokIdx] === -1) {
              active.tokens[tokIdx] = 0;
              active.visualSteps[tokIdx] = 0;
              active.score += 20;
              state.banner = 'TOKEN DEPLOYED!';
              state.eventText = `${active.name} rolled ${roll} & deployed Token #${tokIdx + 1} onto the track!`;
              sounds.push({ type: 'boost', playerId: active.id });
              state.phase = 'event';
              state.phaseTimer = 1.15;
            } else {
              const boostAdd = active.boostReady && roll >= 5 ? 2 : 0;
              if (boostAdd > 0) active.boostReady = false;
              const totalSteps = Math.min(GOAL_STEP - active.tokens[tokIdx], roll + boostAdd);
              state.stepsRemaining = Math.max(1, totalSteps);
              state.hopProgress = 0;
              state.phase = 'moving';
              state.eventText =
                boostAdd > 0
                  ? `${active.name} rolled ${roll} +2 ROYAL BOOST! Advancing Token #${tokIdx + 1}!`
                  : `${active.name} rolled ${roll}! Advancing Token #${tokIdx + 1}...`;
            }
          }
        }
      } else if (state.phase === 'moving') {
        const tokIdx = state.movingTokenIndex;
        state.hopProgress += dt * 4.8;
        if (state.hopProgress >= 1) {
          state.hopProgress = 0;
          active.tokens[tokIdx] = Math.min(GOAL_STEP, active.tokens[tokIdx] + 1);
          active.visualSteps[tokIdx] = active.tokens[tokIdx];
          active.score += 5;
          state.stepsRemaining--;
          sounds.push({ type: 'nav', playerId: active.id });

          if (state.stepsRemaining <= 0) {
            const curStep = active.tokens[tokIdx];
            if (curStep >= GOAL_STEP) {
              active.finishedCount = active.tokens.filter((t) => t >= GOAL_STEP).length;
              active.score += 120;
              state.banner = `TOKEN #${tokIdx + 1} HOME! (+120)`;
              state.eventText = `${active.name} escorted Token #${tokIdx + 1} to the Royal Crown!`;
              sounds.push({ type: 'lap', playerId: active.id });
              haptics.push({ playerId: active.id, pattern: [30, 20, 50], reason: 'ludo-home' });

              if (active.finishedCount >= 3) {
                active.score += 200;
                state.finished = true;
                state.banner = `${active.name} WINS LUDO ROYALE!`;
                sounds.push({ type: 'win', playerId: active.id });
                return {
                  snapshot: this.getSnapshot(state),
                  sounds,
                  haptics,
                  hudUpdates: {},
                  finished: true,
                  rankings: this.getRankings(state, players),
                };
              }
            } else if (curStep < TRACK_LEN) {
              const absTrack = (active.startTrackIndex + curStep) % TRACK_LEN;
              const isStar = state.starIndices.includes(absTrack);
              if (isStar) {
                active.boostReady = true;
                active.score += 25;
                state.banner = 'SAFE STAR TILE! (+25)';
                state.eventText = `${active.name} landed on a Safe Star Tile — Boost Charged!`;
                sounds.push({ type: 'pickup', playerId: active.id });
              } else {
                for (const other of state.players) {
                  if (other.id === active.id) continue;
                  for (let ot = 0; ot < other.tokens.length; ot++) {
                    const oStep = other.tokens[ot];
                    if (oStep >= 0 && oStep < TRACK_LEN) {
                      const oAbs = (other.startTrackIndex + oStep) % TRACK_LEN;
                      if (oAbs === absTrack) {
                        other.tokens[ot] = -1;
                        other.visualSteps[ot] = -1;
                        active.captures++;
                        active.score += 75;
                        state.banner = `CAPTURED ${other.name}! (+75)`;
                        state.eventText = `${active.name} sent ${other.name}'s Token #${ot + 1} back to Base!`;
                        sounds.push({ type: 'ko', playerId: active.id });
                        haptics.push({ playerId: active.id, pattern: [40, 25, 45], reason: 'ludo-capture' });
                      }
                    }
                  }
                }
              }
            }
            state.phase = 'event';
            state.phaseTimer = 1.25;
          }
        } else {
          active.visualSteps[tokIdx] = active.tokens[tokIdx] + state.hopProgress;
        }
      } else if (state.phase === 'event') {
        state.phaseTimer -= dt;
        if (state.phaseTimer <= 0) {
          if (state.diceValue === 6 && !state.finished) {
            state.phase = 'wait-roll';
            state.turnTimeLeft = TURN_TIMEOUT;
            state.banner = 'BONUS ROLL (6)!';
            state.eventText = `${active.name} rolled a 6 and gets a Bonus Turn!`;
          } else {
            advanceTurn(state);
          }
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const activePlayer = state.players[state.turnIndex];
    for (const p of state.players) {
      const isTurn = activePlayer && p.id === activePlayer.id && !state.finished;
      p.cooldownA = isTurn && state.phase === 'wait-roll' ? 0 : 1;
      p.cooldownB = isTurn && state.phase === 'wait-roll' ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: isTurn
          ? `YOUR TURN · Tok #${p.selectedToken + 1} · ${p.finishedCount}/3 Home`
          : `${p.finishedCount}/3 Home · ${p.captures} KOs · ${p.score} pts`,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      };
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates,
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },

  getSnapshot(state: LudoRoyaleState): LudoRoyaleSnapshot {
    return {
      gameId: 'ludo-royale',
      round: Math.min(state.round, state.totalRounds),
      totalRounds: state.totalRounds,
      activePlayerId: state.players[state.turnIndex]?.id ?? '',
      phase: state.phase,
      turnTimeLeft: state.turnTimeLeft,
      diceValue: state.diceValue,
      diceRolling: state.diceRolling,
      starIndices: state.starIndices,
      banner: state.banner,
      eventText: state.eventText,
      popups: state.popups,
      players: state.players.map((p) => ({
        ...p,
        tokens: [...p.tokens],
        visualSteps: [...p.visualSteps],
      })),
    };
  },

  getRankings(state: LudoRoyaleState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort(
      (a, b) => b.finishedCount - a.finishedCount || b.score - a.score
    );
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: p.score,
      highlight: `${p.finishedCount}/3 Home · ${p.captures} Captures`,
    }));
  },
};
