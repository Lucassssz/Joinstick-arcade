import type {
  AuctionPlayerState,
  LuckyAuctionSnapshot,
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

interface ChestDef {
  label: string;
  clue: string;
  visual: 'royal' | 'wooden' | 'mystery' | 'crystal';
  prize: 'diamond' | 'crown' | 'gold' | 'ruby' | 'duck';
  value: number;
}

interface InternalBidder extends AuctionPlayerState {
  adjustCd: number;
}

interface LuckyAuctionState {
  round: number;
  totalRounds: number;
  phase: 'bidding' | 'reveal';
  timer: number;
  currentChest: ChestDef;
  multiplier: number;
  firstPassClaimed: boolean;
  highestBid: number;
  highestBidderId: string | null;
  banner: string | null;
  players: InternalBidder[];
  finished: boolean;
}

const CHEST_POOL: ChestDef[] = [
  { label: 'Royal Vault Box', clue: 'Heavy & sparkles inside!', visual: 'royal', prize: 'diamond', value: 450 },
  { label: 'Velvet Crown Case', clue: 'Feels solid gold!', visual: 'royal', prize: 'crown', value: 400 },
  { label: 'Crystal Lockbox', clue: 'Glowing bright red!', visual: 'crystal', prize: 'ruby', value: 320 },
  { label: 'Pirate Oak Chest', clue: 'Clinks like coins!', visual: 'wooden', prize: 'gold', value: 260 },
  { label: 'Mystery Party Box', clue: 'Suspiciously squeaky...', visual: 'mystery', prize: 'duck', value: 40 },
  { label: 'Gilded Mystery Box', clue: 'Light... or hollow gem?', visual: 'mystery', prize: 'duck', value: 50 },
  { label: 'Starlight Coffer', clue: 'Humming with luxury!', visual: 'crystal', prize: 'diamond', value: 480 },
  { label: 'Old Harbor Trunk', clue: 'Smells like treasure!', visual: 'wooden', prize: 'gold', value: 290 },
  { label: 'Royal Question Box', clue: 'Might be priceless... or quack!', visual: 'royal', prize: 'crown', value: 380 },
];

const START_CASH = 900;

function pickChest(): ChestDef {
  const base = CHEST_POOL[Math.floor(Math.random() * CHEST_POOL.length)];
  const variance = base.prize === 'duck' ? 0 : Math.round((Math.random() - 0.5) * 60 / 10) * 10;
  return { ...base, value: Math.max(30, base.value + variance) };
}

function startAuctionRound(state: LuckyAuctionState): void {
  state.currentChest = pickChest();
  state.multiplier = state.round === state.totalRounds || Math.random() < 0.32 ? 2 : 1;
  state.firstPassClaimed = false;
  state.phase = 'bidding';
  state.timer = 10.5;
  state.highestBid = 0;
  state.highestBidderId = null;
  state.banner =
    state.multiplier > 1
      ? `2X GOLDEN GAVEL · CHEST ${state.round}/${state.totalRounds}!`
      : `CHEST ${state.round} OF ${state.totalRounds}`;
  for (const p of state.players) {
    p.passed = false;
    p.draftBid = Math.min(p.cash, 50);
  }
}

export const luckyAuctionModule: ServerGameModule<LuckyAuctionState> = {
  id: 'lucky-auction',

  createState(players, settingValue) {
    const totalRounds = Math.max(4, Math.min(10, settingValue || 6));
    const list: InternalBidder[] = players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      cash: START_CASH,
      treasureValue: 0,
      totalWorth: START_CASH,
      itemsWon: 0,
      draftBid: 50,
      passed: false,
      cooldownA: 0,
      cooldownB: 0,
      adjustCd: 0,
    }));

    const state: LuckyAuctionState = {
      round: 1,
      totalRounds,
      phase: 'bidding',
      timer: 10.5,
      currentChest: pickChest(),
      multiplier: 1,
      firstPassClaimed: false,
      highestBid: 0,
      highestBidderId: null,
      banner: null,
      players: list,
      finished: false,
    };
    startAuctionRound(state);
    return state;
  },

  step(state, players, dt): StepOutput {
    const sounds: SoundEvent[] = [];
    const haptics: HapticTrigger[] = [];

    if (!state.finished) {
      state.timer = Math.max(0, state.timer - dt);

      if (state.phase === 'bidding') {
        if (state.timer < 9.3) state.banner = null;

        for (const p of state.players) {
          p.adjustCd = Math.max(0, p.adjustCd - dt);
          if (p.passed) continue;

          const minValid = Math.min(p.cash, state.highestBid + 50);
          if (p.draftBid < minValid) p.draftBid = minValid;
          if (p.draftBid > p.cash) p.draftBid = p.cash;

          const inp = players.find((x) => x.id === p.id);
          if (!inp) continue;
          const { dx, a, b } = inp.input;

          if (Math.abs(dx) > 0.45 && p.adjustCd <= 0) {
            p.draftBid = Math.max(minValid, Math.min(p.cash, p.draftBid + (dx > 0 ? 50 : -50)));
            p.adjustCd = 0.22;
            sounds.push({ type: 'nav', playerId: p.id });
          }

          // Action A: Place bid!
          if (a && !inp.prevA) {
            const bidAmt = Math.max(state.highestBid + 50, p.draftBid);
            if (p.cash >= bidAmt && state.highestBidderId !== p.id) {
              state.highestBid = bidAmt;
              state.highestBidderId = p.id;
              if (state.timer < 3.6) state.timer = 3.6;
              state.banner = `${p.name} BID $${bidAmt}!`;
              sounds.push({ type: 'confirm', playerId: p.id });
              haptics.push({ playerId: p.id, pattern: 22, reason: 'bid' });
            }
          }

          // Action B: Pass this chest (first pass after a bid claims +$60 tactical rebate!)
          if (b && !inp.prevB && state.highestBidderId !== p.id) {
            p.passed = true;
            if (!state.firstPassClaimed && state.highestBid > 0) {
              state.firstPassClaimed = true;
              p.cash += 60;
              state.banner = `${p.name} PASSED EARLY (+$60)!`;
            }
            sounds.push({ type: 'nav', playerId: p.id });
            haptics.push({ playerId: p.id, pattern: 14, reason: 'pass' });
          }
        }

        // End bidding early if everyone else passed or can't beat the top bid
        const canStillBeat = state.players.some(
          (p) => !p.passed && p.id !== state.highestBidderId && p.cash >= state.highestBid + 50
        );
        const allPassed = state.players.every((p) => p.passed);

        if (state.timer <= 0 || allPassed || (state.highestBidderId && !canStillBeat)) {
          state.phase = 'reveal';
          state.timer = 3.2;
          const winner = state.players.find((p) => p.id === state.highestBidderId);
          const payout = state.currentChest.value * state.multiplier;
          if (winner) {
            winner.cash = Math.max(0, winner.cash - state.highestBid);
            winner.treasureValue += payout;
            winner.totalWorth = winner.cash + winner.treasureValue;
            winner.itemsWon++;
            const profit = payout - state.highestBid;
            state.banner =
              state.currentChest.prize === 'duck'
                ? `QUACK! ${winner.name} paid $${state.highestBid} for a Duck ($${payout})!`
                : `${winner.name} WON $${payout} (${profit >= 0 ? `+$${profit}` : `-$${Math.abs(profit)}`})!`;
            sounds.push({ type: state.currentChest.prize === 'duck' ? 'hit' : 'win', playerId: winner.id });
            haptics.push({
              playerId: winner.id,
              pattern: state.currentChest.prize === 'duck' ? [45, 35, 45] : [25, 25, 50],
              reason: 'auction-result',
            });
          } else {
            state.banner = `NO BIDS! Chest held $${payout}!`;
            sounds.push({ type: 'bump' });
          }
        }
      } else if (state.phase === 'reveal') {
        if (state.timer <= 0) {
          if (state.round >= state.totalRounds) {
            state.finished = true;
          } else {
            state.round++;
            startAuctionRound(state);
          }
        }
      }
    }

    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of state.players) {
      p.totalWorth = p.cash + p.treasureValue;
      const canBid =
        state.phase === 'bidding' &&
        !p.passed &&
        state.highestBidderId !== p.id &&
        p.cash >= state.highestBid + 50;
      p.cooldownA = canBid ? 0 : 1;
      p.cooldownB = state.phase === 'bidding' && !p.passed && state.highestBidderId !== p.id ? 0 : 1;
      hudUpdates[p.id] = {
        score: p.totalWorth,
        alive: true,
        statText: p.passed
          ? `PASSED · $${p.cash}`
          : state.highestBidderId === p.id
            ? `TOP BID $${state.highestBid}!`
            : `$${p.cash} cash · Worth $${p.totalWorth}`,
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

  getSnapshot(state): LuckyAuctionSnapshot {
    const bidder = state.players.find((p) => p.id === state.highestBidderId);
    return {
      gameId: 'lucky-auction',
      round: state.round,
      totalRounds: state.totalRounds,
      phase: state.phase,
      timer: state.timer,
      chestLabel: state.currentChest.label,
      chestClue: state.currentChest.clue,
      chestVisual: state.currentChest.visual,
      revealedPrize: state.phase === 'reveal' ? state.currentChest.prize : null,
      revealedValue: state.phase === 'reveal' ? state.currentChest.value * state.multiplier : 0,
      highestBid: state.highestBid,
      highestBidderId: state.highestBidderId,
      highestBidderName: bidder?.name ?? null,
      highestBidderColor: bidder?.colorHex ?? null,
      multiplier: state.multiplier,
      banner: state.banner,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: p.isBot,
        cash: p.cash,
        treasureValue: p.treasureValue,
        totalWorth: p.totalWorth,
        itemsWon: p.itemsWon,
        draftBid: p.draftBid,
        passed: p.passed,
        cooldownA: p.cooldownA,
        cooldownB: p.cooldownB,
      })),
    };
  },

  getRankings(state, players): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => b.totalWorth - a.totalWorth || b.treasureValue - a.treasureValue);
    return sorted.map((ap, idx) => {
      const meta = players.find((p) => p.id === ap.id);
      return {
        playerId: ap.id,
        slotIndex: ap.slotIndex,
        name: ap.name,
        color: meta?.color ?? {
          id: 'amber',
          name: 'Gold',
          hex: ap.colorHex,
          dark: '#B58100',
          textOnColor: '#14120B',
        },
        rank: idx + 1,
        score: ap.totalWorth,
        highlight: `$${ap.cash} cash + $${ap.treasureValue} loot`,
      };
    });
  },
};
