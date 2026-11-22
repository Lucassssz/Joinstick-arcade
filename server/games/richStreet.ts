import type {
  RankingEntry,
  RichStreetPlayerState,
  RichStreetSnapshot,
  RichStreetTileState,
  SoundEvent,
} from '../../src/shared/types.ts';
import type {
  HapticTrigger,
  PlayerHudUpdate,
  ServerGameModule,
  ServerPlayerInputState,
  StepOutput,
} from './engine.ts';

interface RichStreetState {
  round: number;
  totalRounds: number;
  turnIndex: number;
  phase: 'wait-roll' | 'rolling' | 'moving' | 'decision' | 'event';
  turnTimeLeft: number;
  phaseTimer: number;
  dice: [number, number];
  diceRolling: boolean;
  stepsRemaining: number;
  hopProgress: number;
  jackpotPool: number;
  decisionTileIndex: number | null;
  decisionAction: 'buy' | 'upgrade' | null;
  decisionCost: number;
  banner: string | null;
  eventText: string | null;
  tiles: RichStreetTileState[];
  players: RichStreetPlayerState[];
  finished: boolean;
}

const BOARD_TEMPLATE: Omit<RichStreetTileState, 'ownerId' | 'ownerColor' | 'level'>[] = [
  { index: 0, kind: 'go', name: 'GO +$200', groupColor: '#10D98B', price: 0, baseRent: 0 },
  { index: 1, kind: 'property', name: 'Sunny Cafe', groupColor: '#FF7A1A', price: 120, baseRent: 45 },
  { index: 2, kind: 'property', name: 'Boba Alley', groupColor: '#FF7A1A', price: 140, baseRent: 55 },
  { index: 3, kind: 'chance', name: 'Lucky Card', groupColor: '#00C2FF', price: 0, baseRent: 0 },
  { index: 4, kind: 'property', name: 'Pixel Arcade', groupColor: '#00C2FF', price: 180, baseRent: 70 },
  { index: 5, kind: 'property', name: 'Neon Cinema', groupColor: '#00C2FF', price: 200, baseRent: 80 },
  { index: 6, kind: 'jail', name: 'Chill Jail', groupColor: '#94A3B8', price: 0, baseRent: 0 },
  { index: 7, kind: 'property', name: 'Ramen Row', groupColor: '#FF3B9A', price: 220, baseRent: 90 },
  { index: 8, kind: 'property', name: 'Sushi Pier', groupColor: '#FF3B9A', price: 240, baseRent: 100 },
  { index: 9, kind: 'tax', name: 'City Tax', groupColor: '#FF4D2E', price: 0, baseRent: 120 },
  { index: 10, kind: 'property', name: 'Sky Park', groupColor: '#10D98B', price: 260, baseRent: 110 },
  { index: 11, kind: 'property', name: 'Botanic Dome', groupColor: '#10D98B', price: 280, baseRent: 120 },
  { index: 12, kind: 'jackpot', name: 'Free Jackpot', groupColor: '#FFB800', price: 0, baseRent: 0 },
  { index: 13, kind: 'property', name: 'Harbor Mall', groupColor: '#528BFF', price: 300, baseRent: 130 },
  { index: 14, kind: 'property', name: 'Marina Club', groupColor: '#528BFF', price: 320, baseRent: 140 },
  { index: 15, kind: 'chance', name: 'Lucky Card', groupColor: '#00C2FF', price: 0, baseRent: 0 },
  { index: 16, kind: 'property', name: 'Gold Plaza', groupColor: '#FFB800', price: 350, baseRent: 160 },
  { index: 17, kind: 'property', name: 'Crown Hotel', groupColor: '#FFB800', price: 380, baseRent: 180 },
  { index: 18, kind: 'tax', name: 'Luxury Fee', groupColor: '#FF4D2E', price: 0, baseRent: 150 },
  { index: 19, kind: 'property', name: 'Star Tower', groupColor: '#9EE622', price: 400, baseRent: 195 },
  { index: 20, kind: 'property', name: 'Diamond Ave', groupColor: '#9EE622', price: 440, baseRent: 220 },
  { index: 21, kind: 'chance', name: 'Lucky Card', groupColor: '#00C2FF', price: 0, baseRent: 0 },
  { index: 22, kind: 'property', name: 'Royal Palace', groupColor: '#FF4D2E', price: 480, baseRent: 245 },
  { index: 23, kind: 'property', name: 'Grand Spire', groupColor: '#FF4D2E', price: 520, baseRent: 270 },
];

const START_CASH = 1200;
const ROLL_TIMEOUT = 14;
const DECISION_TIMEOUT = 12;

function refreshMonopolies(state: RichStreetState): void {
  const propGroups = new Map<string, RichStreetTileState[]>();
  for (const t of state.tiles) {
    if (t.kind !== 'property') continue;
    const arr = propGroups.get(t.groupColor) ?? [];
    arr.push(t);
    propGroups.set(t.groupColor, arr);
  }
  for (const groupTiles of propGroups.values()) {
    const firstOwner = groupTiles[0]?.ownerId;
    const isMonopoly = Boolean(firstOwner && groupTiles.length >= 2 && groupTiles.every((gt) => gt.ownerId === firstOwner));
    for (const gt of groupTiles) {
      gt.monopoly = isMonopoly;
    }
  }
}

function recalcWealth(state: RichStreetState): void {
  refreshMonopolies(state);
  for (const p of state.players) {
    let propVal = 0;
    let count = 0;
    for (const t of state.tiles) {
      if (t.ownerId === p.id) {
        count++;
        propVal += Math.round(t.price * (1 + (t.level - 1) * 0.65));
      }
    }
    p.propertiesOwned = count;
    p.netWorth = Math.max(0, Math.round(p.cash + propVal));
  }
}

function getRent(tile: RichStreetTileState): number {
  const base =
    tile.level <= 1 ? tile.baseRent : tile.level === 2 ? Math.round(tile.baseRent * 1.9) : Math.round(tile.baseRent * 3.1);
  return tile.monopoly ? base * 2 : base;
}

function advanceTurn(state: RichStreetState): void {
  const activeCount = state.players.filter((p) => !p.bankrupt).length;
  if ((state.players.length > 1 && activeCount <= 1) || activeCount === 0) {
    state.finished = true;
    state.banner = 'MATCH COMPLETE';
    return;
  }

  let tries = 0;
  let nextIdx = state.turnIndex;
  let wrapped = false;
  do {
    nextIdx = (nextIdx + 1) % state.players.length;
    if (nextIdx === 0) wrapped = true;
    tries++;
  } while (state.players[nextIdx].bankrupt && tries <= state.players.length);

  if (wrapped) {
    state.round++;
    if (state.round > state.totalRounds) {
      state.round = state.totalRounds;
      state.finished = true;
      state.banner = 'FINAL WEALTH COUNT!';
      return;
    }
  }

  state.turnIndex = nextIdx;
  const active = state.players[state.turnIndex];
  state.phase = 'wait-roll';
  state.turnTimeLeft = ROLL_TIMEOUT;
  state.decisionTileIndex = null;
  state.decisionAction = null;
  state.decisionCost = 0;
  state.diceRolling = false;
  state.banner = null;
  if (active.jailTurns > 0) {
    state.eventText = `${active.name}: Roll to break out of Jail!`;
  } else {
    state.eventText = `${active.name}'s Turn — Press A to Roll!`;
  }
}

function startRoll(
  state: RichStreetState,
  active: RichStreetPlayerState,
  sounds: SoundEvent[],
  haptics: HapticTrigger[]
): void {
  state.phase = 'rolling';
  state.phaseTimer = 1.15;
  state.diceRolling = true;
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  state.dice = [d1, d2];
  sounds.push({ type: 'confirm', playerId: active.id });
  haptics.push({ playerId: active.id, pattern: 22, reason: 'dice-roll' });
}

function handleLanding(
  state: RichStreetState,
  active: RichStreetPlayerState,
  sounds: SoundEvent[],
  haptics: HapticTrigger[]
): void {
  const tile = state.tiles[active.tileIndex];

  if (tile.kind === 'go') {
    active.cash += 150;
    state.eventText = `${active.name} landed on GO! +$150 Bonus!`;
    sounds.push({ type: 'pickup', playerId: active.id });
    state.phase = 'event';
    state.phaseTimer = 2.3;
    recalcWealth(state);
    return;
  }

  if (tile.kind === 'jackpot') {
    const win = state.jackpotPool;
    active.cash += win;
    state.jackpotPool = 200;
    state.banner = `JACKPOT +$${win}!`;
    state.eventText = `${active.name} won the $${win} City Jackpot!`;
    sounds.push({ type: 'win', playerId: active.id });
    haptics.push({ playerId: active.id, pattern: [30, 40, 50], reason: 'jackpot' });
    state.phase = 'event';
    state.phaseTimer = 2.7;
    recalcWealth(state);
    return;
  }

  if (tile.kind === 'jail') {
    active.jailTurns = 1;
    state.eventText = `${active.name} visited Chill Jail! Next turn rolls to exit.`;
    sounds.push({ type: 'bump', playerId: active.id });
    state.phase = 'event';
    state.phaseTimer = 2.2;
    recalcWealth(state);
    return;
  }

  if (tile.kind === 'tax') {
    const fee = tile.baseRent;
    active.cash = Math.max(0, active.cash - fee);
    state.jackpotPool += fee;
    state.eventText = `${active.name} paid $${fee} to Jackpot Pool!`;
    sounds.push({ type: 'hit', playerId: active.id });
    haptics.push({ playerId: active.id, pattern: 35, reason: 'tax' });
    state.phase = 'event';
    state.phaseTimer = 2.3;
    recalcWealth(state);
    return;
  }

  if (tile.kind === 'chance') {
    const roll = Math.floor(Math.random() * 5);
    if (roll === 0) {
      active.cash += 200;
      state.eventText = `Lucky Card: Street Festival! ${active.name} +$200`;
      sounds.push({ type: 'pickup', playerId: active.id });
    } else if (roll === 1) {
      active.rentShield = true;
      state.eventText = `Lucky Card: ${active.name} gained a Free Rent Shield!`;
      sounds.push({ type: 'boost', playerId: active.id });
    } else if (roll === 2) {
      let stolen = 0;
      for (const other of state.players) {
        if (other.id !== active.id && !other.bankrupt) {
          const take = Math.min(60, other.cash);
          other.cash -= take;
          stolen += take;
        }
      }
      active.cash += Math.max(80, stolen);
      state.eventText = `Lucky Card: Party Gift! ${active.name} +$${Math.max(80, stolen)}`;
      sounds.push({ type: 'pickup', playerId: active.id });
    } else if (roll === 3) {
      const owned = state.tiles.filter((t) => t.ownerId === active.id && t.level < 3);
      if (owned.length > 0) {
        const chosen = owned[Math.floor(Math.random() * owned.length)];
        chosen.level = Math.min(3, chosen.level + 1);
        state.banner = 'FREE UPGRADE!';
        state.eventText = `Lucky Card: Property Boom! ${chosen.name} Lv.${chosen.level}`;
        sounds.push({ type: 'boost', playerId: active.id });
      } else {
        active.cash += 160;
        state.eventText = `Lucky Card: Tax Rebate! ${active.name} +$160`;
        sounds.push({ type: 'pickup', playerId: active.id });
      }
    } else {
      const fee = 90;
      active.cash = Math.max(0, active.cash - fee);
      state.jackpotPool += fee;
      state.eventText = `Lucky Card: Parking Ticket! -$${fee} to Jackpot`;
      sounds.push({ type: 'bump', playerId: active.id });
    }
    state.phase = 'event';
    state.phaseTimer = 2.5;
    recalcWealth(state);
    return;
  }

  // Property tile
  if (!tile.ownerId) {
    if (active.cash >= tile.price) {
      state.phase = 'decision';
      state.decisionTileIndex = tile.index;
      state.decisionAction = 'buy';
      state.decisionCost = tile.price;
      state.turnTimeLeft = DECISION_TIMEOUT;
      state.eventText = `Buy ${tile.name} for $${tile.price}? (A: Buy / B: Skip)`;
    } else {
      state.eventText = `${active.name} can't afford ${tile.name} ($${tile.price})`;
      state.phase = 'event';
      state.phaseTimer = 2.0;
    }
    recalcWealth(state);
    return;
  }

  if (tile.ownerId === active.id) {
    const upgradeCost = Math.round(tile.price * 0.65);
    if (tile.level < 3 && active.cash >= upgradeCost) {
      state.phase = 'decision';
      state.decisionTileIndex = tile.index;
      state.decisionAction = 'upgrade';
      state.decisionCost = upgradeCost;
      state.turnTimeLeft = DECISION_TIMEOUT;
      state.eventText = `Upgrade ${tile.name} to Lv.${tile.level + 1} for $${upgradeCost}?`;
    } else {
      active.cash += 50;
      state.eventText = `${active.name} visited own ${tile.name}! +$50 VIP bonus`;
      sounds.push({ type: 'pickup', playerId: active.id });
      state.phase = 'event';
      state.phaseTimer = 2.0;
    }
    recalcWealth(state);
    return;
  }

  // Owned by a rival -> Pay rent!
  const owner = state.players.find((p) => p.id === tile.ownerId);
  if (active.rentShield) {
    active.rentShield = false;
    state.eventText = `${active.name}'s Rent Shield blocked rent on ${tile.name}!`;
    sounds.push({ type: 'pulse', playerId: active.id });
    state.phase = 'event';
    state.phaseTimer = 2.3;
    recalcWealth(state);
    return;
  }

  const rent = getRent(tile);
  const paid = Math.min(active.cash, rent);
  active.cash -= paid;
  if (owner && !owner.bankrupt) {
    owner.cash += paid;
    sounds.push({ type: 'pickup', playerId: owner.id });
  }
  sounds.push({ type: 'hit', playerId: active.id });
  haptics.push({ playerId: active.id, pattern: [35, 30, 35], reason: 'pay-rent' });

  if (active.cash <= 0 && active.propertiesOwned === 0 && state.players.length > 1) {
    active.bankrupt = true;
    state.eventText = `${active.name} paid $${paid} rent & went bankrupt!`;
  } else {
    state.eventText = `${active.name} paid $${paid}${tile.monopoly ? ' (2X MONOPOLY!)' : ''} rent to ${owner?.name ?? 'Rival'}!`;
  }
  state.phase = 'event';
  state.phaseTimer = 2.5;
  recalcWealth(state);
}

export const richStreetModule: ServerGameModule<RichStreetState> = {
  id: 'rich-street',

  createState(players, settingValue) {
    const totalRounds = Math.max(4, Math.min(16, settingValue || 8));
    const tiles: RichStreetTileState[] = BOARD_TEMPLATE.map((t) => ({
      ...t,
      ownerId: null,
      ownerColor: null,
      level: 0,
    }));

    const boardPlayers: RichStreetPlayerState[] = players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      tileIndex: 0,
      visualTile: 0,
      cash: START_CASH,
      netWorth: START_CASH,
      propertiesOwned: 0,
      jailTurns: 0,
      luckyCharge: 40,
      rentShield: false,
      bankrupt: false,
      cooldownA: 0,
      cooldownB: 0,
    }));

    const first = boardPlayers[0];
    return {
      round: 1,
      totalRounds,
      turnIndex: 0,
      phase: 'wait-roll',
      turnTimeLeft: ROLL_TIMEOUT,
      phaseTimer: 0,
      dice: [3, 4],
      diceRolling: false,
      stepsRemaining: 0,
      hopProgress: 0,
      jackpotPool: 250,
      decisionTileIndex: null,
      decisionAction: null,
      decisionCost: 0,
      banner: null,
      eventText: first ? `${first.name}'s Turn — Press A to Roll!` : null,
      tiles,
      players: boardPlayers,
      finished: false,
    };
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    if (state.players.length === 0) {
      state.finished = true;
    }

    if (!state.finished) {
      const active = state.players[state.turnIndex];
      const inputState = players.find((p) => p.id === active.id);
      const justA = Boolean(inputState && inputState.input.a && !inputState.prevA);
      const justB = Boolean(inputState && inputState.input.b && !inputState.prevB);

      if (state.phase === 'wait-roll') {
        state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);

        // Press B when Lucky Bar is full to activate Rent Shield + $80 bonus
        if (justB && active.luckyCharge >= 100) {
          active.luckyCharge = 0;
          active.rentShield = true;
          active.cash += 80;
          state.eventText = `${active.name} used Lucky Perk! Rent Shield + $80`;
          sounds.push({ type: 'boost', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: 25, reason: 'lucky-perk' });
          recalcWealth(state);
        }

        if (justA || state.turnTimeLeft <= 0) {
          startRoll(state, active, sounds, haptics);
        }
      } else if (state.phase === 'rolling') {
        state.phaseTimer -= dt;
        // Visually tumble dice while rolling
        if (Math.random() < 0.45) {
          state.dice = [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)];
        }
        if (state.phaseTimer <= 0) {
          state.diceRolling = false;
          const d1 = 1 + Math.floor(Math.random() * 6);
          const d2 = 1 + Math.floor(Math.random() * 6);
          state.dice = [d1, d2];
          active.luckyCharge = Math.min(100, active.luckyCharge + 35);

          if (active.jailTurns > 0) {
            active.jailTurns = 0;
            const total = Math.max(2, Math.floor((d1 + d2) / 2));
            state.stepsRemaining = total;
            state.hopProgress = 0;
            state.phase = 'moving';
            state.eventText = `${active.name} left Jail & moves ${total} spaces!`;
          } else {
            const total = d1 + d2;
            state.stepsRemaining = total;
            state.hopProgress = 0;
            state.phase = 'moving';
            state.eventText = `${active.name} rolled ${d1} + ${d2} = ${total}!`;
          }
          sounds.push({ type: 'bump', playerId: active.id });
        }
      } else if (state.phase === 'moving') {
        state.hopProgress += dt * 3.6;
        if (state.hopProgress >= 1) {
          state.hopProgress = 0;
          active.tileIndex = (active.tileIndex + 1) % state.tiles.length;
          active.visualTile = active.tileIndex;
          state.stepsRemaining--;
          sounds.push({ type: 'nav', playerId: active.id });

          if (active.tileIndex === 0 && state.stepsRemaining > 0) {
            active.cash += 200;
            state.eventText = `${active.name} passed GO! +$200`;
            sounds.push({ type: 'pickup', playerId: active.id });
            recalcWealth(state);
          }

          if (state.stepsRemaining <= 0) {
            handleLanding(state, active, sounds, haptics);
          }
        } else {
          active.visualTile = (active.tileIndex + state.hopProgress) % state.tiles.length;
        }
      } else if (state.phase === 'decision') {
        state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
        const tile = state.decisionTileIndex !== null ? state.tiles[state.decisionTileIndex] : null;
        if (justA && tile && active.cash >= state.decisionCost) {
          active.cash -= state.decisionCost;
          if (state.decisionAction === 'buy') {
            tile.ownerId = active.id;
            tile.ownerColor = active.colorHex;
            tile.level = 1;
            state.eventText = `${active.name} bought ${tile.name}!`;
          } else {
            tile.level = Math.min(3, tile.level + 1);
            state.eventText = `${active.name} upgraded ${tile.name} to Lv.${tile.level}!`;
          }
          sounds.push({ type: 'pickup', playerId: active.id });
          haptics.push({ playerId: active.id, pattern: [20, 25, 35], reason: 'buy-property' });
          recalcWealth(state);
          state.phase = 'event';
          state.phaseTimer = 2.0;
        } else if (justB || state.turnTimeLeft <= 0) {
          state.eventText = `${active.name} saved cash and skipped.`;
          sounds.push({ type: 'nav', playerId: active.id });
          state.phase = 'event';
          state.phaseTimer = 1.5;
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
      p.cooldownA = isTurn && (state.phase === 'wait-roll' || state.phase === 'decision') ? 0 : 1;
      p.cooldownB =
        isTurn && (state.phase === 'decision' || (state.phase === 'wait-roll' && p.luckyCharge >= 100)) ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.netWorth,
        alive: !p.bankrupt,
        statText: p.bankrupt
          ? 'Bankrupt'
          : isTurn
            ? state.phase === 'decision'
              ? `BUY $${state.decisionCost}? A/B`
              : `YOUR TURN · $${p.cash}`
            : `$${p.cash} · ${p.propertiesOwned} shops`,
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

  getSnapshot(state): RichStreetSnapshot {
    return {
      gameId: 'rich-street',
      round: state.round,
      totalRounds: state.totalRounds,
      activePlayerId: state.players[state.turnIndex]?.id ?? '',
      phase: state.phase,
      turnTimeLeft: state.turnTimeLeft,
      dice: [...state.dice] as [number, number],
      diceRolling: state.diceRolling,
      jackpotPool: state.jackpotPool,
      decisionTileIndex: state.decisionTileIndex,
      decisionAction: state.decisionAction,
      decisionCost: state.decisionCost,
      banner: state.banner,
      eventText: state.eventText,
      tiles: state.tiles.map((t) => ({ ...t })),
      players: state.players.map((p) => ({ ...p })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    recalcWealth(state);
    const sorted = [...state.players].sort((a, b) => b.netWorth - a.netWorth || b.cash - a.cash);
    return sorted.map((bp, idx) => {
      const meta = players.find((p) => p.id === bp.id);
      return {
        playerId: bp.id,
        slotIndex: bp.slotIndex,
        name: bp.name,
        color: meta?.color ?? {
          id: 'amber',
          name: 'Gold',
          hex: bp.colorHex,
          dark: '#B58100',
          textOnColor: '#14120B',
        },
        rank: idx + 1,
        score: bp.netWorth,
        highlight: `$${bp.cash} cash · ${bp.propertiesOwned} shops`,
      };
    });
  },
};
