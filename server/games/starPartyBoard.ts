import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type RankingEntry,
  type SoundEvent,
  type StarPartyPlayerState,
  type StarPartyBoardSnapshot,
  type StarPartyTileState,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface StarPartyState {
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
  starTileIndex: number;
  starCost: number;
  tiles: StarPartyTileState[];
  banner: string | null;
  eventText: string | null;
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: StarPartyPlayerState[];
  finished: boolean;
}

const TOTAL_TILES = 20;
const STAR_COST = 20;
const TURN_TIMEOUT = 14;

function buildIslandTiles(): StarPartyTileState[] {
  const cx = ARENA_WIDTH / 2;
  const cy = ARENA_HEIGHT / 2 + 18;
  const rx = 390;
  const ry = 215;
  const kinds: StarPartyTileState['kind'][] = [
    'coin', 'coin', 'boost', 'coin', 'trap',
    'lucky', 'coin', 'duel', 'coin', 'trap',
    'coin', 'boost', 'coin', 'lucky', 'trap',
    'coin', 'duel', 'coin', 'boost', 'lucky',
  ];
  const labels: Record<StarPartyTileState['kind'], string> = {
    coin: '+6 COINS',
    lucky: 'LUCKY +12',
    trap: 'ZAP -6',
    boost: 'CANDY +2X',
    duel: 'STEAL +8',
  };

  return Array.from({ length: TOTAL_TILES }, (_, index) => {
    const angle = (index / TOTAL_TILES) * Math.PI * 2 - Math.PI / 2;
    const wobble = Math.sin(index * 1.6) * 18;
    const x = Math.round(cx + Math.cos(angle) * (rx + wobble));
    const y = Math.round(cy + Math.sin(angle) * (ry + wobble * 0.6));
    const kind = kinds[index % kinds.length];
    return {
      index,
      x,
      y,
      kind,
      label: labels[kind],
    };
  });
}

function syncScore(p: StarPartyPlayerState): void {
  p.score = p.stars * 100 + p.coins;
}

function advanceTurn(state: StarPartyState): void {
  state.turnIndex = (state.turnIndex + 1) % state.players.length;
  if (state.turnIndex === 0) {
    state.round++;
    if (state.round > state.totalRounds) {
      state.finished = true;
      state.banner = 'STAR PARTY FINALE!';
      return;
    }
  }
  state.phase = 'wait-roll';
  state.turnTimeLeft = TURN_TIMEOUT;
  state.diceRolling = false;
  state.banner = null;
  const active = state.players[state.turnIndex];
  if (active) {
    state.eventText = `${active.name}'s Turn — Press A to Roll or B for 2X Candy!`;
  }
}

export const starPartyBoardModule: ServerGameModule<StarPartyState> = {
  id: 'star-party-board',

  createState(players: ServerPlayerInputState[], settingValue: number): StarPartyState {
    const totalRounds = settingValue || 10;
    const tiles = buildIslandTiles();
    const partyPlayers: StarPartyPlayerState[] = players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      tileIndex: 0,
      visualTile: 0,
      stars: 0,
      coins: 14,
      candyActive: false,
      score: 14,
      cooldownA: 0,
      cooldownB: 0,
    }));

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
      starTileIndex: 7,
      starCost: STAR_COST,
      tiles,
      banner: null,
      eventText: partyPlayers[0] ? `${partyPlayers[0].name}'s Turn — Roll for the Golden Star!` : null,
      popups: [],
      players: partyPlayers,
      finished: false,
    };
  },

  step(state: StarPartyState, players: ServerPlayerInputState[], dt: number): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= dt * 30;
      state.popups[i].alpha -= dt * 0.95;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
    }

    if (state.players.length === 0) state.finished = true;

    if (!state.finished) {
      const active = state.players[state.turnIndex];
      const inp = players.find((p) => p.id === active.id);
      const justA = Boolean(inp && inp.input.a && !inp.prevA);
      const justB = Boolean(inp && inp.input.b && !inp.prevB);

      if (state.phase === 'wait-roll') {
        state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);

        if (justB && !active.candyActive && active.coins >= 5) {
          active.coins -= 5;
          active.candyActive = true;
          syncScore(active);
          state.banner = '2X DOUBLE CANDY!';
          state.eventText = `${active.name} spent 5 Coins on 2X Double Dice Candy!`;
          sounds.push({ type: 'boost', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: 25, reason: 'star-candy' });
        }

        if (justA || state.turnTimeLeft <= 0) {
          state.phase = 'rolling';
          state.phaseTimer = 0.85;
          state.diceRolling = true;
          state.diceValue = 1 + Math.floor(Math.random() * 6);
          sounds.push({ type: 'confirm', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: 20, reason: 'star-roll' });
        }
      } else if (state.phase === 'rolling') {
        state.phaseTimer -= dt;
        if (Math.random() < 0.45) {
          state.diceValue = 1 + Math.floor(Math.random() * 6);
        }
        if (state.phaseTimer <= 0) {
          state.diceRolling = false;
          const baseRoll = 1 + Math.floor(Math.random() * 6);
          const finalRoll = active.candyActive ? baseRoll * 2 : baseRoll;
          active.candyActive = false;
          state.diceValue = finalRoll;
          state.stepsRemaining = finalRoll;
          state.hopProgress = 0;
          state.phase = 'moving';
          state.eventText = `${active.name} rolled ${finalRoll}! Hopping across Star Island...`;
          sounds.push({ type: 'bump', playerId: active.id });
        }
      } else if (state.phase === 'moving') {
        state.hopProgress += dt * 4.4;
        if (state.hopProgress >= 1) {
          state.hopProgress = 0;
          active.tileIndex = (active.tileIndex + 1) % TOTAL_TILES;
          active.visualTile = active.tileIndex;
          state.stepsRemaining--;
          sounds.push({ type: 'nav', playerId: active.id });

          // Passing or landing on the Golden Star Shrine!
          if (active.tileIndex === state.starTileIndex && active.coins >= state.starCost) {
            active.coins -= state.starCost;
            active.stars += 1;
            syncScore(active);
            const starTile = state.tiles[state.starTileIndex];
            state.popups.push({
              x: starTile.x,
              y: starTile.y - 24,
              text: '★ GOLDEN STAR!',
              colorHex: '#FFB800',
              alpha: 1,
            });
            state.starTileIndex = (state.starTileIndex + 7 + Math.floor(Math.random() * 5)) % TOTAL_TILES;
            state.banner = `${active.name} GOT A GOLDEN STAR!`;
            state.eventText = `🌟 ${active.name} traded ${state.starCost} Coins for a Golden Star!`;
            sounds.push({ type: 'lap', playerId: active.id });
            haptics.push({ playerId: active.id, pattern: [40, 25, 65], reason: 'golden-star' });
          }

          if (state.stepsRemaining <= 0) {
            const tile = state.tiles[active.tileIndex];
            if (tile.kind === 'coin') {
              active.coins += 6;
              state.eventText = `${active.name} landed on a Blue Coin Tile (+6 Coins)!`;
              sounds.push({ type: 'pickup', playerId: active.id });
            } else if (tile.kind === 'lucky') {
              active.coins += 12;
              state.banner = 'LUCKY FOUNTAIN +12!';
              state.eventText = `${active.name} hit the Lucky Jackpot Fountain (+12 Coins)!`;
              sounds.push({ type: 'boost', playerId: active.id });
            } else if (tile.kind === 'boost') {
              active.coins += 5;
              active.candyActive = true;
              state.banner = 'FREE 2X CANDY!';
              state.eventText = `${active.name} found a Free 2X Candy & +5 Coins!`;
              sounds.push({ type: 'pickup', playerId: active.id });
            } else if (tile.kind === 'trap') {
              const lost = Math.min(6, active.coins);
              active.coins -= lost;
              state.banner = `ZAP TRAP -${lost}!`;
              state.eventText = `${active.name} stepped on a Zap Trap (-${lost} Coins)!`;
              sounds.push({ type: 'hit', playerId: active.id });
            } else if (tile.kind === 'duel') {
              // Steal coins from richest rival
              const rivals = state.players.filter((p) => p.id !== active.id && p.coins > 0);
              rivals.sort((a, b) => b.coins - a.coins);
              if (rivals.length > 0) {
                const target = rivals[0];
                const stolen = Math.min(8, target.coins);
                target.coins -= stolen;
                active.coins += stolen;
                syncScore(target);
                state.banner = `STOLE ${stolen} COINS!`;
                state.eventText = `${active.name} raided ${target.name} for ${stolen} Coins!`;
                sounds.push({ type: 'ko', playerId: active.id });
              } else {
                active.coins += 8;
                state.eventText = `${active.name} won the Duel Tile bonus (+8 Coins)!`;
              }
            }
            syncScore(active);
            state.phase = 'event';
            state.phaseTimer = 1.35;
          }
        }
      } else if (state.phase === 'event') {
        state.phaseTimer -= dt;
        if (state.phaseTimer <= 0) {
          advanceTurn(state);
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    const activePlayer = state.players[state.turnIndex];
    for (const p of state.players) {
      const isTurn = activePlayer && p.id === activePlayer.id && !state.finished;
      p.cooldownA = isTurn && state.phase === 'wait-roll' ? 0 : 1;
      p.cooldownB = isTurn && state.phase === 'wait-roll' && !p.candyActive && p.coins >= 5 ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.score,
        alive: true,
        statText: isTurn
          ? `YOUR TURN · ★${p.stars} · ${p.coins} Coins`
          : `★${p.stars} Stars · ${p.coins} Coins`,
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

  getSnapshot(state: StarPartyState): StarPartyBoardSnapshot {
    return {
      gameId: 'star-party-board',
      round: Math.min(state.round, state.totalRounds),
      totalRounds: state.totalRounds,
      activePlayerId: state.players[state.turnIndex]?.id ?? '',
      phase: state.phase,
      turnTimeLeft: state.turnTimeLeft,
      diceValue: state.diceValue,
      diceRolling: state.diceRolling,
      starTileIndex: state.starTileIndex,
      starCost: state.starCost,
      tiles: state.tiles,
      banner: state.banner,
      eventText: state.eventText,
      popups: state.popups,
      players: state.players.map((p) => ({ ...p })),
    };
  },

  getRankings(state: StarPartyState, players: ServerPlayerInputState[]): RankingEntry[] {
    const colorMap = new Map(players.map((p) => [p.id, p.color]));
    const sorted = [...state.players].sort((a, b) => b.stars - a.stars || b.coins - a.coins);
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: colorMap.get(p.id)!,
      rank: idx + 1,
      score: p.score,
      highlight: `${p.stars} Golden Stars · ${p.coins} Coins`,
    }));
  },
};
