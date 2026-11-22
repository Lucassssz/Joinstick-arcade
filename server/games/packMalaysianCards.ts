import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../../src/shared/cardLayout.ts';
import {
  PLAYER_PALETTE,
  type BigTwoRoyaleSnapshot,
  type CardActionButton,
  type CardClientAction,
  type CardPrivateState,
  type CardShockwave,
  type FlyingCardAnim,
  type Lucky21Snapshot,
  type RankingEntry,
  type SoundEvent,
  type StandardCardView,
  type TenPairShowdownSnapshot,
} from '../../src/shared/types.ts';
import type { PlayerHudUpdate, ServerGameModule, ServerPlayerInputState, StepOutput } from './engine.ts';

type Rank52 = StandardCardView['rank'];
type Suit52 = StandardCardView['suit'];

const RANKS_52: Rank52[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
// Authentic Malaysian Chor Dai Di Suit Order: ♦ < ♣ < ♥ < ♠
const SUITS_MY: Suit52[] = ['diamonds', 'clubs', 'hearts', 'spades'];

function createDeck52(prefix: string): StandardCardView[] {
  const deck: StandardCardView[] = [];
  let uid = 1;
  for (const suit of SUITS_MY) {
    for (const rank of RANKS_52) {
      deck.push({ id: `${prefix}_${uid++}_${rank}_${suit[0]}`, rank, suit });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function bigTwoRankVal(r: Rank52): number {
  return RANKS_52.indexOf(r); // 0 ('3') .. 12 ('2')
}

function bigTwoSuitVal(s: Suit52): number {
  return SUITS_MY.indexOf(s); // 0 ♦, 1 ♣, 2 ♥, 3 ♠
}

function bigTwoCardPower(c: StandardCardView): number {
  return bigTwoRankVal(c.rank) * 4 + bigTwoSuitVal(c.suit);
}

function suitGlyph(s: Suit52): string {
  return s === 'spades' ? '♠' : s === 'hearts' ? '♥' : s === 'clubs' ? '♣' : '♦';
}

function stepVisuals(
  flying: FlyingCardAnim[],
  waves: CardShockwave[],
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[],
  dt: number
) {
  for (let i = flying.length - 1; i >= 0; i--) {
    flying[i].progress += dt * 2.8;
    if (flying[i].progress >= 1) flying.splice(i, 1);
  }
  for (let i = waves.length - 1; i >= 0; i--) {
    waves[i].radius += 260 * dt;
    waves[i].alpha -= dt * 1.4;
    if (waves[i].alpha <= 0) waves.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    popups[i].y -= 26 * dt;
    popups[i].alpha -= dt * 0.72;
    if (popups[i].alpha <= 0) popups.splice(i, 1);
  }
}

// ============================================================================
// 8. BIG TWO ROYALE (Chor Dai Di / 锄大弟 — Authentic Malaysian Rules!)
// ============================================================================
type BigTwoComboKind = 'single' | 'pair' | 'triple' | 'straight' | 'flush' | 'full-house' | 'four-kind' | 'straight-flush';

interface BigTwoEvaluatedHand {
  kind: BigTwoComboKind;
  count: number;
  categoryRank: number; // 0 for 1/2/3 card; 1..5 for 5-card hands
  primaryKey: number; // Main tie-breaker
  secondaryKey: number;
  label: string;
}

const STRAIGHT_SEQ_VALS: Record<Rank52, number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
};

function evaluateBigTwoCombo(cards: StandardCardView[]): BigTwoEvaluatedHand | null {
  const n = cards.length;
  if (n === 0) return null;
  const sorted = [...cards].sort((a, b) => bigTwoCardPower(a) - bigTwoCardPower(b));

  if (n === 1) {
    const c = sorted[0];
    return {
      kind: 'single',
      count: 1,
      categoryRank: 0,
      primaryKey: bigTwoCardPower(c),
      secondaryKey: 0,
      label: `${c.rank}${suitGlyph(c.suit)}`,
    };
  }
  if (n === 2) {
    if (sorted[0].rank !== sorted[1].rank) return null;
    return {
      kind: 'pair',
      count: 2,
      categoryRank: 0,
      primaryKey: bigTwoCardPower(sorted[1]),
      secondaryKey: 0,
      label: `PAIR ${sorted[0].rank}s`,
    };
  }
  if (n === 3) {
    if (sorted[0].rank !== sorted[1].rank || sorted[1].rank !== sorted[2].rank) return null;
    return {
      kind: 'triple',
      count: 3,
      categoryRank: 0,
      primaryKey: bigTwoRankVal(sorted[0].rank),
      secondaryKey: 0,
      label: `TRIPLE ${sorted[0].rank}s`,
    };
  }
  if (n !== 5) return null;

  const isFlush = sorted.every((c) => c.suit === sorted[0].suit);
  const rankCounts = new Map<Rank52, StandardCardView[]>();
  for (const c of sorted) {
    const arr = rankCounts.get(c.rank) ?? [];
    arr.push(c);
    rankCounts.set(c.rank, arr);
  }

  // Check Straight (handles 3-4-5-6-7 .. 10-J-Q-K-A, A-2-3-4-5, 2-3-4-5-6)
  let isStraight = false;
  let straightHighPower = bigTwoCardPower(sorted[4]);
  if (rankCounts.size === 5) {
    const nums = sorted.map((c) => STRAIGHT_SEQ_VALS[c.rank]).sort((a, b) => a - b);
    const isNormal = nums.every((v, idx) => idx === 0 || v === nums[idx - 1] + 1);
    const isRoyalHigh = nums[0] === 1 && nums[1] === 10 && nums[2] === 11 && nums[3] === 12 && nums[4] === 13;
    if (isNormal || isRoyalHigh) {
      isStraight = true;
      straightHighPower = bigTwoCardPower(sorted[4]);
    }
  }

  if (isStraight && isFlush) {
    return {
      kind: 'straight-flush',
      count: 5,
      categoryRank: 5,
      primaryKey: straightHighPower,
      secondaryKey: bigTwoSuitVal(sorted[0].suit),
      label: 'STRAIGHT FLUSH!',
    };
  }

  // Four of a Kind + 1 (铁支)
  for (const [r, group] of rankCounts.entries()) {
    if (group.length === 4) {
      return {
        kind: 'four-kind',
        count: 5,
        categoryRank: 4,
        primaryKey: bigTwoRankVal(r),
        secondaryKey: 0,
        label: `FOUR ${r}s!`,
      };
    }
  }

  // Full House (夫佬)
  if (rankCounts.size === 2) {
    for (const [r, group] of rankCounts.entries()) {
      if (group.length === 3) {
        return {
          kind: 'full-house',
          count: 5,
          categoryRank: 3,
          primaryKey: bigTwoRankVal(r),
          secondaryKey: 0,
          label: `FULL HOUSE ${r}s`,
        };
      }
    }
  }

  // Flush (花 — Authentic Malaysian tiebreak: Suit first, then highest card!)
  if (isFlush) {
    return {
      kind: 'flush',
      count: 5,
      categoryRank: 2,
      primaryKey: bigTwoSuitVal(sorted[0].suit) * 100 + bigTwoRankVal(sorted[4].rank),
      secondaryKey: bigTwoCardPower(sorted[4]),
      label: `FLUSH ${suitGlyph(sorted[0].suit)}`,
    };
  }

  if (isStraight) {
    return {
      kind: 'straight',
      count: 5,
      categoryRank: 1,
      primaryKey: straightHighPower,
      secondaryKey: 0,
      label: 'STRAIGHT (蛇)',
    };
  }

  return null;
}

function canBeatBigTwo(play: BigTwoEvaluatedHand, table: BigTwoEvaluatedHand | null): boolean {
  if (!table) return true;
  if (play.count !== table.count) return false;
  if (play.categoryRank !== table.categoryRank) return play.categoryRank > table.categoryRank;
  if (play.primaryKey !== table.primaryKey) return play.primaryKey > table.primaryKey;
  return play.secondaryKey > table.secondaryKey;
}

function findLowestWinningBigTwoPlay(
  hand: StandardCardView[],
  tableEval: BigTwoEvaluatedHand | null,
  mustInclude3D: boolean,
  topCardGuard: boolean
): StandardCardView[] | null {
  const sorted = [...hand].sort((a, b) => bigTwoCardPower(a) - bigTwoCardPower(b));
  const has3D = (arr: StandardCardView[]) => !mustInclude3D || arr.some((c) => c.rank === '3' && c.suit === 'diamonds');

  const candidates: StandardCardView[][] = [];

  // Singles
  if (!tableEval || tableEval.count === 1) {
    if (topCardGuard && sorted.length > 0) {
      // Authentic Malaysian 顶大 (Top-Card Guard) when next player has 1 card left!
      const top = [sorted[sorted.length - 1]];
      if (has3D(top)) candidates.push(top);
    } else {
      for (const c of sorted) {
        if (has3D([c])) candidates.push([c]);
      }
    }
  }

  // Pairs & Triples
  const byRank = new Map<Rank52, StandardCardView[]>();
  for (const c of sorted) {
    const arr = byRank.get(c.rank) ?? [];
    arr.push(c);
    byRank.set(c.rank, arr);
  }
  if (!tableEval || tableEval.count === 2) {
    for (const grp of byRank.values()) {
      if (grp.length >= 2) {
        const pair = [grp[0], grp[1]];
        if (has3D(pair)) candidates.push(pair);
        if (grp.length >= 3) {
          const p2 = [grp[0], grp[grp.length - 1]];
          if (has3D(p2)) candidates.push(p2);
        }
      }
    }
  }
  if (!tableEval || tableEval.count === 3) {
    for (const grp of byRank.values()) {
      if (grp.length >= 3) {
        const tri = grp.slice(0, 3);
        if (has3D(tri)) candidates.push(tri);
      }
    }
  }

  // 5-Card Combos (Full House, Flush, Straight, Four-of-a-Kind)
  if (!tableEval || tableEval.count === 5) {
    // Flushes
    for (const suit of SUITS_MY) {
      const suited = sorted.filter((c) => c.suit === suit);
      if (suited.length >= 5) {
        const combo = suited.slice(0, 5);
        if (has3D(combo)) candidates.push(combo);
      }
    }
    // Full houses
    const trips = [...byRank.values()].filter((g) => g.length >= 3);
    const pairs = [...byRank.values()].filter((g) => g.length >= 2);
    for (const t of trips) {
      for (const pr of pairs) {
        if (t[0].rank === pr[0].rank) continue;
        const fh = [...t.slice(0, 3), ...pr.slice(0, 2)];
        if (has3D(fh)) candidates.push(fh);
      }
    }
    // Four of a kind
    const quads = [...byRank.values()].filter((g) => g.length === 4);
    for (const q of quads) {
      const kicker = sorted.find((c) => c.rank !== q[0].rank);
      if (kicker) {
        const fk = [...q, kicker];
        if (has3D(fk)) candidates.push(fk);
      }
    }
    // Simple straights
    const uniqueByRank = [...byRank.values()].map((g) => g[0]);
    if (uniqueByRank.length >= 5) {
      const bySeq = [...uniqueByRank].sort((a, b) => STRAIGHT_SEQ_VALS[a.rank] - STRAIGHT_SEQ_VALS[b.rank]);
      for (let i = 0; i <= bySeq.length - 5; i++) {
        const slice = bySeq.slice(i, i + 5);
        if (evaluateBigTwoCombo(slice) && has3D(slice)) candidates.push(slice);
      }
    }
  }

  let best: { cards: StandardCardView[]; evalH: BigTwoEvaluatedHand } | null = null;
  for (const cand of candidates) {
    const ev = evaluateBigTwoCombo(cand);
    if (!ev || !canBeatBigTwo(ev, tableEval)) continue;
    // Prefer shedding 5-card or pairs on free leads!
    if (!tableEval && best) {
      if (cand.length > best.cards.length) {
        best = { cards: cand, evalH: ev };
        continue;
      }
      if (cand.length < best.cards.length) continue;
    }
    if (
      !best ||
      ev.categoryRank < best.evalH.categoryRank ||
      (ev.categoryRank === best.evalH.categoryRank && ev.primaryKey < best.evalH.primaryKey)
    ) {
      best = { cards: cand, evalH: ev };
    }
  }
  return best?.cards ?? null;
}

interface BigTwoSeat {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot: boolean;
  hand: StandardCardView[];
  selectedIds: Set<string>;
  passedTrick: boolean;
  score: number;
  lastAction: string | null;
}

interface BigTwoInternal {
  round: number;
  totalRounds: number;
  seats: BigTwoSeat[];
  activeIdx: number;
  trickOwnerId: string | null;
  tableCards: StandardCardView[];
  tableEval: BigTwoEvaluatedHand | null;
  mustInclude3D: boolean;
  turnTimeLeft: number;
  turnTotal: number;
  botThinkTimer: number;
  banner: string | null;
  bannerColor: string | null;
  bannerTimer: number;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pendingSounds: SoundEvent[];
  finished: boolean;
  roundCooldown: number;
}

function dealBigTwoRound(state: BigTwoInternal) {
  const deck = createDeck52(`b2r${state.round}`);
  let starter = 0;
  state.seats.forEach((seat, idx) => {
    seat.hand = deck.slice(idx * 13, (idx + 1) * 13).sort((a, b) => bigTwoCardPower(a) - bigTwoCardPower(b));
    seat.selectedIds.clear();
    seat.passedTrick = false;
    seat.lastAction = null;
    if (seat.hand.some((c) => c.rank === '3' && c.suit === 'diamonds')) {
      starter = idx;
    }
  });
  state.activeIdx = starter;
  state.trickOwnerId = null;
  state.tableCards = [];
  state.tableEval = null;
  state.mustInclude3D = true;
  state.turnTimeLeft = 18;
  state.turnTotal = 18;
  state.botThinkTimer = 1.05;
  state.banner = `${state.seats[starter].name} HOLDS 3♦ · LEADS FIRST!`;
  state.bannerColor = '#FFB800';
  state.bannerTimer = 2.4;

  // Check for legendary 13-card Dragon (一条龙: all 13 distinct ranks 3..2)!
  for (const seat of state.seats) {
    const distinct = new Set(seat.hand.map((c) => c.rank));
    if (distinct.size === 13) {
      seat.score += 780;
      seat.hand = [];
      state.banner = `${seat.name} DRAGON (一条龙) INSTANT WIN!`;
      state.bannerColor = '#FFB800';
      state.bannerTimer = 3.0;
      state.roundCooldown = 2.6;
      break;
    }
  }
}

function advanceBigTwoTurn(state: BigTwoInternal) {
  const n = state.seats.length;
  for (let step = 1; step <= n; step++) {
    const nextIdx = (state.activeIdx + step) % n;
    const seat = state.seats[nextIdx];
    if (seat.id === state.trickOwnerId) {
      // Everyone else passed -> trick owner leads fresh!
      state.activeIdx = nextIdx;
      state.tableCards = [];
      state.tableEval = null;
      state.trickOwnerId = null;
      state.seats.forEach((s) => (s.passedTrick = false));
      state.turnTimeLeft = state.turnTotal;
      state.botThinkTimer = 0.95;
      state.banner = `${seat.name} WINS TRICK · FREE LEAD!`;
      state.bannerColor = seat.colorHex;
      state.bannerTimer = 1.6;
      return;
    }
    if (!seat.passedTrick) {
      state.activeIdx = nextIdx;
      state.turnTimeLeft = state.turnTotal;
      state.botThinkTimer = 0.95;
      return;
    }
  }
}

function executeBigTwoPlay(state: BigTwoInternal, seat: BigTwoSeat, cards: StandardCardView[]): boolean {
  const ev = evaluateBigTwoCombo(cards);
  if (!ev) return false;
  if (state.mustInclude3D && !cards.some((c) => c.rank === '3' && c.suit === 'diamonds')) return false;
  if (!canBeatBigTwo(ev, state.tableEval)) return false;

  // Check Top-Card Guard (顶大): if next player has 1 card left and playing single, must play highest single!
  const nextSeat = state.seats[(state.seats.indexOf(seat) + 1) % state.seats.length];
  if (nextSeat && nextSeat.hand.length === 1 && ev.count === 1) {
    const highestCard = seat.hand[seat.hand.length - 1];
    if (highestCard && cards[0].id !== highestCard.id) {
      return false;
    }
  }

  const playedSet = new Set(cards.map((c) => c.id));
  seat.hand = seat.hand.filter((c) => !playedSet.has(c.id));
  seat.selectedIds.clear();
  seat.lastAction = ev.label;
  state.tableCards = cards;
  state.tableEval = ev;
  state.trickOwnerId = seat.id;
  state.mustInclude3D = false;

  const seatIdx = state.seats.indexOf(seat);
  const pos = getCardSeatPosition(seatIdx, state.seats.length);
  state.flyingCards.push({
    id: `fly_${Date.now()}_${Math.random()}`,
    fromX: pos.x,
    fromY: pos.y,
    toX: TABLE_CENTER_X,
    toY: TABLE_CENTER_Y,
    progress: 0,
    colorHex: seat.colorHex,
    rankText: ev.label,
    faceUp: true,
    rotStart: -0.25,
    rotEnd: 0,
  });
  state.pendingSounds.push({ type: 'card', playerId: seat.id });

  if (seat.hand.length === 0) {
    // Authentic Malaysian CNY Penalty Scoring (炒两倍 / 全炒三倍 + 2♠ bonus!)
    let wonPts = 0;
    for (const other of state.seats) {
      if (other.id === seat.id) continue;
      const rem = other.hand.length;
      let mult = 1;
      if (rem >= 13) mult = 3; // 全炒 ×3!
      else if (rem >= 10) mult = 2; // 炒 ×2!
      if (other.hand.some((c) => c.rank === '2' && c.suit === 'spades')) mult *= 2; // Holding 2♠!
      const penalty = rem * 20 * mult;
      wonPts += penalty;
      other.lastAction = mult >= 2 ? `-${penalty} (×${mult} 炒!)` : `-${penalty}`;
    }
    seat.score += wonPts;
    state.banner = `${seat.name} CLEARED ALL 13! +${wonPts} PTS!`;
    state.bannerColor = seat.colorHex;
    state.bannerTimer = 3.0;
    state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 24, maxRadius: 340, colorHex: seat.colorHex, alpha: 1 });
    state.pendingSounds.push({ type: 'win', playerId: seat.id });
    state.roundCooldown = 2.8;
    return true;
  }

  advanceBigTwoTurn(state);
  return true;
}

export const bigTwoRoyaleModule: ServerGameModule<BigTwoInternal> = {
  id: 'big-two-royale',
  createState(players, settingValue) {
    // Authentic 4-seat Chor Dai Di table (bots automatically fill to 4 seats for exact 13-card deal!)
    const seats: BigTwoSeat[] = [];
    const botNames = ['AH KOW AI', 'MEI LING AI', 'UNCLE TAN AI', 'JASON AI'];
    for (let i = 0; i < 4; i++) {
      const p = players[i];
      seats.push({
        id: p?.id ?? `b2_bot_${i}`,
        slotIndex: p?.slotIndex ?? i,
        name: p?.name ?? botNames[i],
        colorHex: p?.color.hex ?? PLAYER_PALETTE[i % PLAYER_PALETTE.length].hex,
        isBot: !p || Boolean(p.isBot),
        hand: [],
        selectedIds: new Set(),
        passedTrick: false,
        score: 0,
        lastAction: null,
      });
    }
    const state: BigTwoInternal = {
      round: 1,
      totalRounds: Math.max(1, settingValue || 1),
      seats,
      activeIdx: 0,
      trickOwnerId: null,
      tableCards: [],
      tableEval: null,
      mustInclude3D: true,
      turnTimeLeft: 18,
      turnTotal: 18,
      botThinkTimer: 1.0,
      banner: null,
      bannerColor: null,
      bannerTimer: 0,
      flyingCards: [],
      shockwaves: [],
      popups: [],
      pendingSounds: [],
      finished: false,
      roundCooldown: 0,
    };
    dealBigTwoRound(state);
    return state;
  },
  handleCardAction(state, playerId, action) {
    if (state.finished || state.roundCooldown > 0) return;
    const seatIdx = state.seats.findIndex((s) => s.id === playerId);
    if (seatIdx < 0) return;
    const seat = state.seats[seatIdx];

    if (action.type === 'toggle-card') {
      if (seat.selectedIds.has(action.cardId)) seat.selectedIds.delete(action.cardId);
      else if (seat.selectedIds.size < 5) seat.selectedIds.add(action.cardId);
      return;
    }

    if (seatIdx !== state.activeIdx) return;

    const nextSeat = state.seats[(seatIdx + 1) % state.seats.length];
    const topCardGuard = Boolean(nextSeat && nextSeat.hand.length === 1);

    if (action.type === 'custom' && action.id === 'smart-hint') {
      const suggestion = findLowestWinningBigTwoPlay(seat.hand, state.tableEval, state.mustInclude3D, topCardGuard);
      seat.selectedIds.clear();
      if (suggestion) {
        suggestion.forEach((c) => seat.selectedIds.add(c.id));
        state.pendingSounds.push({ type: 'nav', playerId });
      }
      return;
    }

    if (action.type === 'submit-selected' || action.type === 'play-card') {
      const chosen = seat.hand.filter((c) => seat.selectedIds.has(c.id));
      if (chosen.length > 0 && executeBigTwoPlay(state, seat, chosen)) {
        return;
      }
      // Fallback: if single tap or invalid, guide player with smart hint
      state.popups.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y - 120, text: 'INVALID COMBO!', colorHex: '#FF4D2E', alpha: 1 });
      return;
    }

    if (action.type === 'draw-or-pass') {
      if (!state.tableEval) return; // Cannot pass on a free lead
      seat.passedTrick = true;
      seat.selectedIds.clear();
      seat.lastAction = 'PASS';
      state.pendingSounds.push({ type: 'nav', playerId });
      advanceBigTwoTurn(state);
    }
  },
  getPrivateStates(state, players): Record<string, CardPrivateState> {
    const out: Record<string, CardPrivateState> = {};
    const activeSeat = state.seats[state.activeIdx];
    for (const p of players) {
      const seatIdx = state.seats.findIndex((s) => s.id === p.id);
      if (seatIdx < 0) continue;
      const seat = state.seats[seatIdx];
      const isMyTurn = seatIdx === state.activeIdx && state.roundCooldown <= 0;
      const nextSeat = state.seats[(seatIdx + 1) % state.seats.length];
      const topGuard = Boolean(nextSeat && nextSeat.hand.length === 1);
      const selectedCards = seat.hand.filter((c) => seat.selectedIds.has(c.id));
      const evalSelected = evaluateBigTwoCombo(selectedCards);
      const validPlay =
        Boolean(evalSelected) &&
        (!state.mustInclude3D || selectedCards.some((c) => c.rank === '3' && c.suit === 'diamonds')) &&
        canBeatBigTwo(evalSelected!, state.tableEval) &&
        !(topGuard && evalSelected!.count === 1 && selectedCards[0].id !== seat.hand[seat.hand.length - 1]?.id);

      const extraActions: CardActionButton[] = [
        {
          label: validPlay && evalSelected ? `PLAY ${evalSelected.label}` : 'PLAY SELECTED',
          labelZh: validPlay && evalSelected ? `出牌 ${evalSelected.label}` : '打出选中牌',
          action: { type: 'submit-selected' },
          colorHex: '#DC2626',
          textColor: '#FFFFFF',
          disabled: !isMyTurn || !validPlay,
        },
        {
          label: 'SMART HINT',
          labelZh: '智能选牌',
          action: { type: 'custom', id: 'smart-hint' },
          colorHex: '#FFB800',
          textColor: '#14120B',
          disabled: !isMyTurn,
        },
        {
          label: 'PASS TRICK',
          labelZh: '过牌 (Pass)',
          action: { type: 'draw-or-pass' },
          colorHex: '#334155',
          textColor: '#FFFFFF',
          disabled: !isMyTurn || !state.tableEval,
        },
      ];

      out[p.id] = {
        gameId: 'big-two-royale',
        playerId: p.id,
        hand: seat.hand.map((c) => ({
          id: c.id,
          kind: 'liar',
          rank: c.rank,
          suit: c.suit,
          playable: isMyTurn,
          selected: seat.selectedIds.has(c.id),
        })),
        cursorIndex: 0,
        isMyTurn,
        isActionRequired: isMyTurn,
        turnTimeLeft: state.turnTimeLeft,
        turnTotal: state.turnTotal,
        badgeText: state.tableEval ? `BEAT: ${state.tableEval.label}` : state.mustInclude3D ? 'LEAD 3♦' : 'FREE LEAD',
        badgeColorHex: '#FFB800',
        extraActions,
        statusHint: isMyTurn
          ? topGuard
            ? 'TOP-CARD GUARD! Next player has 1 card left!'
            : 'Tap cards to build a combo or press Smart Hint!'
          : `Waiting for ${activeSeat?.name ?? 'table'}...`,
        statusHintZh: isMyTurn
          ? topGuard
            ? '注意顶大！下家只剩 1 张牌！'
            : '点击手牌组合牌型，或按「智能选牌」一键出牌！'
          : `等待 ${activeSeat?.name ?? '牌桌'} 出牌...`,
      };
    }
    return out;
  },
  step(state, players, dt): StepOutput {
    stepVisuals(state.flyingCards, state.shockwaves, state.popups, dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }

    if (!state.finished) {
      if (state.roundCooldown > 0) {
        state.roundCooldown -= dt;
        if (state.roundCooldown <= 0) {
          if (state.round < state.totalRounds) {
            state.round += 1;
            dealBigTwoRound(state);
          } else {
            state.finished = true;
          }
        }
      } else {
        const seat = state.seats[state.activeIdx];
        state.turnTimeLeft -= dt;

        const doAutoMove = () => {
          const nextSeat = state.seats[(state.activeIdx + 1) % state.seats.length];
          const topGuard = Boolean(nextSeat && nextSeat.hand.length === 1);
          const best = findLowestWinningBigTwoPlay(seat.hand, state.tableEval, state.mustInclude3D, topGuard);
          if (best && executeBigTwoPlay(state, seat, best)) {
            return;
          }
          if (state.tableEval) {
            seat.passedTrick = true;
            seat.lastAction = 'PASS';
            advanceBigTwoTurn(state);
          } else if (seat.hand.length > 0) {
            executeBigTwoPlay(state, seat, [seat.hand[0]]);
          }
        };

        if (seat.isBot) {
          state.botThinkTimer -= dt;
          if (state.botThinkTimer <= 0) doAutoMove();
        } else if (state.turnTimeLeft <= 0) {
          doAutoMove();
        }
      }
    }

    const sounds = state.pendingSounds.splice(0);
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of players) {
      const s = state.seats.find((x) => x.id === p.id);
      if (s) {
        hudUpdates[p.id] = {
          score: s.score,
          alive: true,
          statText: `${s.hand.length} Cards`,
          cooldownA: 0,
          cooldownB: 0,
        };
      }
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics: [],
      hudUpdates,
      privateStates: this.getPrivateStates!(state, players),
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },
  getSnapshot(state): BigTwoRoyaleSnapshot {
    const activeSeat = state.seats[state.activeIdx];
    const nextSeat = state.seats[(state.activeIdx + 1) % state.seats.length];
    return {
      gameId: 'big-two-royale',
      round: state.round,
      totalRounds: state.totalRounds,
      activePlayerId: activeSeat?.id ?? '',
      trickOwnerId: state.trickOwnerId,
      trickOwnerName: state.seats.find((s) => s.id === state.trickOwnerId)?.name ?? null,
      tableComboName: state.tableEval?.label ?? null,
      tableCards: state.tableCards,
      mustInclude3D: state.mustInclude3D,
      topCardGuardActive: Boolean(nextSeat && nextSeat.hand.length === 1),
      turnTimeLeft: state.turnTimeLeft,
      turnTotal: state.turnTotal,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: state.flyingCards,
      shockwaves: state.shockwaves,
      popups: state.popups,
      players: state.seats.map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        colorHex: s.colorHex,
        isBot: s.isBot,
        cardCount: s.hand.length,
        passedTrick: s.passedTrick,
        score: s.score,
        lastAction: s.lastAction,
        oneCardWarning: s.hand.length === 1,
      })),
    };
  },
  getRankings(state, players) {
    return state.seats
      .filter((s) => players.some((p) => p.id === s.id))
      .sort((a, b) => b.score - a.score)
      .map((s, idx) => ({
        playerId: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        color: players.find((p) => p.id === s.id)?.color ?? players[0].color,
        rank: idx + 1,
        score: s.score,
        highlight: `${s.hand.length} Cards Left`,
      }));
  },
};

// ============================================================================
// 9. LUCKY 21 (21点 / Ban Luck / 廿一点 — Authentic Malaysian CNY Rules!)
// ============================================================================
interface BanLuckEval {
  value: number;
  tier: number; // 0 bust, 1 normal, 2 wu-long(<=20), 3 wu-long-21, 4 ban-luck, 5 ban-ban, 6 triple-7
  multiplier: number; // Positive for win mult, 2 for 5-card bust penalty!
  tag: string | null;
  isFiveCardBust: boolean;
}

function evaluateBanLuckHand(cards: StandardCardView[]): BanLuckEval {
  const n = cards.length;
  const aces = cards.filter((c) => c.rank === 'A').length;
  let base = 0;
  for (const c of cards) {
    if (c.rank === 'A') continue;
    if (c.rank === 'J' || c.rank === 'Q' || c.rank === 'K' || c.rank === '10') base += 10;
    else base += Number(c.rank);
  }

  // Authentic Malaysian Ban Luck Ace Value Rules by Card Count!
  // 2 cards: A = 10 or 11; 3 cards: A = 1 or 10; 4-5 cards: A = 1!
  let bestVal = base;
  if (aces > 0) {
    if (n === 2) {
      if (aces === 2) {
        return { value: 21, tier: 5, multiplier: 3, tag: 'BAN BAN ×3!', isFiveCardBust: false };
      }
      bestVal = base + 11 <= 21 ? base + 11 : base + 10;
    } else if (n === 3) {
      const options = [0];
      for (let i = 0; i < aces; i++) {
        const next: number[] = [];
        for (const o of options) {
          next.push(o + 1);
          next.push(o + 10);
        }
        options.length = 0;
        options.push(...next);
      }
      const valid = options.map((o) => base + o).filter((v) => v <= 21);
      bestVal = valid.length > 0 ? Math.max(...valid) : Math.min(...options.map((o) => base + o));
    } else {
      // 4 or 5 cards: Aces strictly count as 1!
      bestVal = base + aces;
    }
  }

  // Legendary 7-7-7 (×7 Jackpot!)
  if (n === 3 && cards.every((c) => c.rank === '7')) {
    return { value: 21, tier: 6, multiplier: 7, tag: '7-7-7 JACKPOT ×7!', isFiveCardBust: false };
  }
  // 2-card Ban Luck (A + 10/J/Q/K = ×2!)
  if (n === 2 && aces === 1 && base === 10) {
    return { value: 21, tier: 4, multiplier: 2, tag: 'BAN LUCK ×2!', isFiveCardBust: false };
  }
  // Five-Card Charlie (五龙) or 5th-Card Bust Trap (×2 Penalty!)
  if (n >= 5) {
    if (bestVal > 21) {
      return { value: bestVal, tier: 0, multiplier: 2, tag: '5-CARD BUST ×2!', isFiveCardBust: true };
    }
    if (bestVal === 21) {
      return { value: 21, tier: 3, multiplier: 3, tag: 'WU LONG 21 ×3!', isFiveCardBust: false };
    }
    return { value: bestVal, tier: 2, multiplier: 2, tag: 'WU LONG ×2!', isFiveCardBust: false };
  }
  if (bestVal > 21) {
    return { value: bestVal, tier: 0, multiplier: 1, tag: 'BUST!', isFiveCardBust: false };
  }
  return { value: bestVal, tier: 1, multiplier: 1, tag: null, isFiveCardBust: false };
}

interface Lucky21Seat {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot: boolean;
  chips: number;
  bet: number;
  betLocked: boolean;
  hand: StandardCardView[];
  revealed: boolean;
  status: Lucky21Snapshot['players'][number]['status'];
  lastDelta: number;
  lastAction: string | null;
}

interface Lucky21Internal {
  round: number;
  totalRounds: number;
  deck: StandardCardView[];
  seats: Lucky21Seat[];
  bankerIdx: number;
  activeIdx: number;
  phase: Lucky21Snapshot['phase'];
  turnTimeLeft: number;
  turnTotal: number;
  botThinkTimer: number;
  banner: string | null;
  bannerColor: string | null;
  bannerTimer: number;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pendingSounds: SoundEvent[];
  finished: boolean;
}

function settlePairBanLuck(state: Lucky21Internal, banker: Lucky21Seat, seat: Lucky21Seat) {
  if (seat.status === 'settled' || seat.id === banker.id) return;
  seat.revealed = true;
  if (seat.status === 'escaped') {
    seat.lastDelta = 0;
    seat.lastAction = 'RUN (PUSH)';
    seat.status = 'settled';
    return;
  }
  const bEv = evaluateBanLuckHand(banker.hand);
  const pEv = evaluateBanLuckHand(seat.hand);
  let delta = 0; // Positive = player wins from banker

  if (pEv.isFiveCardBust && !bEv.isFiveCardBust) {
    delta = -seat.bet * 2;
  } else if (bEv.isFiveCardBust && !pEv.isFiveCardBust) {
    delta = seat.bet * 2;
  } else if (pEv.tier === 0 && bEv.tier === 0) {
    delta = 0; // Authentic Malaysian Double Bust = Push!
  } else if (pEv.tier > bEv.tier) {
    delta = seat.bet * pEv.multiplier;
  } else if (bEv.tier > pEv.tier) {
    delta = -seat.bet * bEv.multiplier;
  } else if (pEv.tier === 1 && bEv.tier === 1) {
    if (pEv.value > bEv.value) delta = seat.bet;
    else if (bEv.value > pEv.value) delta = -seat.bet;
  }

  seat.chips += delta;
  banker.chips -= delta;
  seat.lastDelta = delta;
  seat.lastAction = delta > 0 ? `+${delta} WIN!` : delta < 0 ? `${delta}` : 'PUSH';
  seat.status = 'settled';
}

function startLucky21Round(state: Lucky21Internal) {
  state.deck = createDeck52(`l21_r${state.round}`);
  state.bankerIdx = (state.round - 1) % state.seats.length;
  state.phase = 'betting';
  state.turnTimeLeft = 8;
  state.turnTotal = 8;
  state.botThinkTimer = 0.7;

  state.seats.forEach((s, idx) => {
    s.hand = [];
    s.revealed = false;
    s.lastDelta = 0;
    s.lastAction = idx === state.bankerIdx ? 'BANKER (庄)' : null;
    s.bet = 100;
    s.betLocked = idx === state.bankerIdx || s.isBot;
    s.status = 'betting';
  });
  state.banner = `ROUND ${state.round} · ${state.seats[state.bankerIdx].name} IS BANKER (庄家)!`;
  state.bannerColor = '#FFB800';
  state.bannerTimer = 2.0;
}

function dealLucky21Hands(state: Lucky21Internal) {
  for (const s of state.seats) {
    s.hand = [state.deck.pop()!, state.deck.pop()!];
    s.status = 'playing';
  }
  const banker = state.seats[state.bankerIdx];
  const bEv = evaluateBanLuckHand(banker.hand);

  // Instant reveal if Banker gets Ban Ban or Ban Luck!
  if (bEv.tier >= 4) {
    banker.revealed = true;
    for (const s of state.seats) {
      if (s.id !== banker.id) settlePairBanLuck(state, banker, s);
    }
    state.phase = 'settle';
    state.turnTimeLeft = 3.2;
    state.banner = `BANKER ${bEv.tag}`;
    state.bannerColor = '#FF4D2E';
    state.bannerTimer = 3.0;
    state.pendingSounds.push({ type: 'win', playerId: banker.id });
    return;
  }

  // Instant reveal for Players who got Ban Ban or Ban Luck
  for (const s of state.seats) {
    if (s.id === banker.id) continue;
    const pEv = evaluateBanLuckHand(s.hand);
    if (pEv.tier >= 4) {
      settlePairBanLuck(state, banker, s);
      state.pendingSounds.push({ type: 'pickup', playerId: s.id });
    }
  }

  // Advance to first unsettled player
  state.phase = 'player-turns';
  advanceLucky21Turn(state, state.bankerIdx);
}

function advanceLucky21Turn(state: Lucky21Internal, fromIdx: number) {
  const n = state.seats.length;
  for (let step = 1; step < n; step++) {
    const idx = (fromIdx + step) % n;
    if (idx === state.bankerIdx) break;
    if (state.seats[idx].status === 'playing') {
      state.activeIdx = idx;
      state.turnTimeLeft = 14;
      state.turnTotal = 14;
      state.botThinkTimer = 0.85;
      return;
    }
  }
  // All players done -> Banker's turn!
  const banker = state.seats[state.bankerIdx];
  const anyUnsettled = state.seats.some((s) => s.id !== banker.id && s.status !== 'settled');
  if (!anyUnsettled) {
    banker.revealed = true;
    state.phase = 'settle';
    state.turnTimeLeft = 3.0;
    return;
  }
  state.phase = 'banker-turn';
  state.activeIdx = state.bankerIdx;
  state.turnTimeLeft = 15;
  state.turnTotal = 15;
  state.botThinkTimer = 0.9;
  state.banner = `BANKER ${banker.name}'S TURN (庄家操作)!`;
  state.bannerColor = '#FFB800';
  state.bannerTimer = 1.8;
}

export const lucky21Module: ServerGameModule<Lucky21Internal> = {
  id: 'lucky-21',
  createState(players, settingValue) {
    const seats: Lucky21Seat[] = players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: Boolean(p.isBot),
      chips: 1000,
      bet: 100,
      betLocked: false,
      hand: [],
      revealed: false,
      status: 'betting',
      lastDelta: 0,
      lastAction: null,
    }));
    if (seats.length < 2) {
      seats.push({
        id: 'l21_dealer_bot',
        slotIndex: 1,
        name: 'CNY BANKER AI',
        colorHex: '#FFB800',
        isBot: true,
        chips: 1000,
        bet: 100,
        betLocked: true,
        hand: [],
        revealed: false,
        status: 'betting',
        lastDelta: 0,
        lastAction: null,
      });
    }
    const state: Lucky21Internal = {
      round: 1,
      totalRounds: Math.max(2, settingValue || 4),
      deck: [],
      seats,
      bankerIdx: 0,
      activeIdx: 0,
      phase: 'betting',
      turnTimeLeft: 8,
      turnTotal: 8,
      botThinkTimer: 0.7,
      banner: null,
      bannerColor: null,
      bannerTimer: 0,
      flyingCards: [],
      shockwaves: [],
      popups: [],
      pendingSounds: [],
      finished: false,
    };
    startLucky21Round(state);
    return state;
  },
  handleCardAction(state, playerId, action) {
    if (state.finished || state.phase === 'settle') return;
    const seatIdx = state.seats.findIndex((s) => s.id === playerId);
    if (seatIdx < 0) return;
    const seat = state.seats[seatIdx];
    const banker = state.seats[state.bankerIdx];

    if (state.phase === 'betting') {
      if (action.type === 'custom' && action.id.startsWith('bet-')) {
        seat.bet = Number(action.id.replace('bet-', '')) || 100;
        seat.betLocked = true;
        seat.lastAction = `BET ${seat.bet}`;
        state.pendingSounds.push({ type: 'confirm', playerId });
      }
      return;
    }

    if (seatIdx !== state.activeIdx) return;
    const ev = evaluateBanLuckHand(seat.hand);

    if (action.type === 'custom' && action.id === 'hit') {
      if (seat.hand.length >= 5) return;
      const drawn = state.deck.pop();
      if (drawn) seat.hand.push(drawn);
      seat.lastAction = 'HIT!';
      state.pendingSounds.push({ type: 'card', playerId });
      const nextEv = evaluateBanLuckHand(seat.hand);
      if (seat.id === banker.id) {
        if (nextEv.tier === 0 || seat.hand.length >= 5 || nextEv.tier >= 2) {
          banker.revealed = true;
          for (const s of state.seats) settlePairBanLuck(state, banker, s);
          state.phase = 'settle';
          state.turnTimeLeft = 3.2;
        }
      } else {
        if (nextEv.tier === 0) {
          seat.status = 'busted';
          seat.lastAction = nextEv.isFiveCardBust ? '5-CARD BUST!' : 'BUST!';
          advanceLucky21Turn(state, seatIdx);
        } else if (nextEv.tier >= 2 || seat.hand.length >= 5) {
          seat.status = 'stood';
          settlePairBanLuck(state, banker, seat);
          advanceLucky21Turn(state, seatIdx);
        }
      }
      return;
    }

    if (action.type === 'custom' && action.id === 'run-15') {
      if (seat.hand.length === 2 && ev.value === 15) {
        if (seat.id === banker.id) {
          // Banker calls 15-point escape against all unsettled players!
          for (const s of state.seats) {
            if (s.id !== banker.id && s.status !== 'settled') {
              s.status = 'escaped';
              settlePairBanLuck(state, banker, s);
            }
          }
          banker.revealed = true;
          state.phase = 'settle';
          state.turnTimeLeft = 3.0;
        } else {
          seat.status = 'escaped';
          seat.revealed = true;
          seat.lastAction = 'RUN (15点跑)';
          advanceLucky21Turn(state, seatIdx);
        }
        state.pendingSounds.push({ type: 'pulse', playerId });
      }
      return;
    }

    if (action.type === 'custom' && action.id === 'stand') {
      if (ev.value < 16) return; // Authentic Malaysian Minimum 16 rule!
      seat.status = 'stood';
      seat.lastAction = 'STAND';
      state.pendingSounds.push({ type: 'confirm', playerId });
      advanceLucky21Turn(state, seatIdx);
      return;
    }

    if (seat.id === banker.id && action.type === 'custom' && action.id === 'open-3plus') {
      if (ev.value < 16) return;
      for (const s of state.seats) {
        if (s.id !== banker.id && s.status !== 'settled' && s.hand.length >= 3) {
          settlePairBanLuck(state, banker, s);
        }
      }
      state.pendingSounds.push({ type: 'bluff', playerId });
      const stillOpen = state.seats.some((s) => s.id !== banker.id && s.status !== 'settled');
      if (!stillOpen) {
        banker.revealed = true;
        state.phase = 'settle';
        state.turnTimeLeft = 3.2;
      }
      return;
    }

    if (seat.id === banker.id && action.type === 'custom' && action.id === 'open-all') {
      if (ev.value < 16) return;
      banker.revealed = true;
      for (const s of state.seats) settlePairBanLuck(state, banker, s);
      state.phase = 'settle';
      state.turnTimeLeft = 3.2;
      state.pendingSounds.push({ type: 'confirm', playerId });
    }
  },
  getPrivateStates(state, players): Record<string, CardPrivateState> {
    const out: Record<string, CardPrivateState> = {};
    const banker = state.seats[state.bankerIdx];
    const activeSeat = state.seats[state.activeIdx];

    for (const p of players) {
      const seatIdx = state.seats.findIndex((s) => s.id === p.id);
      if (seatIdx < 0) continue;
      const seat = state.seats[seatIdx];
      const isBanker = seatIdx === state.bankerIdx;
      const ev = seat.hand.length > 0 ? evaluateBanLuckHand(seat.hand) : null;
      const isMyTurn =
        (state.phase === 'betting' && !seat.betLocked) ||
        ((state.phase === 'player-turns' || state.phase === 'banker-turn') && seatIdx === state.activeIdx);

      const extraActions: CardActionButton[] = [];
      if (state.phase === 'betting' && !isBanker) {
        for (const amt of [50, 100, 200]) {
          extraActions.push({
            label: `BET ${amt}`,
            labelZh: `下注 ${amt}`,
            action: { type: 'custom', id: `bet-${amt}` },
            colorHex: amt === 200 ? '#E11D48' : amt === 100 ? '#FFB800' : '#10D98B',
            textColor: amt === 200 ? '#FFFFFF' : '#14120B',
            disabled: seat.betLocked,
          });
        }
      } else if (isMyTurn && ev) {
        extraActions.push({
          label: 'HIT (+1 CARD)',
          labelZh: '要牌 (+1张)',
          action: { type: 'custom', id: 'hit' },
          colorHex: '#10D98B',
          textColor: '#0A1913',
          disabled: seat.hand.length >= 5,
        });
        if (seat.hand.length === 2 && ev.value === 15) {
          extraActions.push({
            label: '15-PT RUN (跑)',
            labelZh: '15点跑 (平局)',
            action: { type: 'custom', id: 'run-15' },
            colorHex: '#00C2FF',
            textColor: '#0B1219',
          });
        }
        if (isBanker) {
          const has3Plus = state.seats.some((s) => s.id !== banker.id && s.status !== 'settled' && s.hand.length >= 3);
          if (has3Plus) {
            extraActions.push({
              label: 'OPEN 3+ CARDS',
              labelZh: '单开3张闲家',
              action: { type: 'custom', id: 'open-3plus' },
              colorHex: '#A855F7',
              textColor: '#FFFFFF',
              disabled: ev.value < 16,
            });
          }
          extraActions.push({
            label: 'OPEN ALL',
            labelZh: '全开亮牌',
            action: { type: 'custom', id: 'open-all' },
            colorHex: '#FFB800',
            textColor: '#14120B',
            disabled: ev.value < 16,
          });
        } else {
          extraActions.push({
            label: ev.value < 16 ? 'NEED 16+ TO STAND' : `STAND (${ev.value})`,
            labelZh: ev.value < 16 ? '满16点才能停牌' : `停牌 (${ev.value}点)`,
            action: { type: 'custom', id: 'stand' },
            colorHex: '#FFB800',
            textColor: '#14120B',
            disabled: ev.value < 16,
          });
        }
      }

      out[p.id] = {
        gameId: 'lucky-21',
        playerId: p.id,
        hand: seat.hand.map((c) => ({
          id: c.id,
          kind: 'liar',
          rank: c.rank,
          suit: c.suit,
          playable: false,
          selected: false,
        })),
        cursorIndex: 0,
        isMyTurn,
        isActionRequired: isMyTurn,
        turnTimeLeft: state.turnTimeLeft,
        turnTotal: state.turnTotal,
        badgeText: ev ? `${isBanker ? '庄 ' : ''}${ev.tag ?? `${ev.value} PTS`}` : isBanker ? 'BANKER (庄)' : `BET ${seat.bet}`,
        badgeColorHex: isBanker ? '#FFB800' : '#E11D48',
        extraActions: extraActions.length > 0 ? extraActions : undefined,
        statusHint:
          state.phase === 'betting'
            ? isBanker
              ? 'You are Banker (庄家) — waiting for player bets!'
              : 'Pick your Angpao Bet!'
            : isMyTurn
              ? isBanker
                ? 'Hit, Open 3+ card players, or Open All (min 16)!'
                : 'Hit or Stand (min 16 — watch out for 5th-card bust ×2!)'
              : `Waiting on ${activeSeat?.name ?? 'table'}...`,
        statusHintZh:
          state.phase === 'betting'
            ? isBanker
              ? '本局你坐庄 — 等待闲家下注！'
              : '请选择本局红包注额！'
            : isMyTurn
              ? isBanker
                ? '满16点可单开3张闲家或全开！'
                : '满16点可停牌，2张15点可喊跑！'
              : `等待 ${activeSeat?.name ?? '牌桌'} 操作...`,
      };
    }
    return out;
  },
  step(state, players, dt): StepOutput {
    stepVisuals(state.flyingCards, state.shockwaves, state.popups, dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }

    if (!state.finished) {
      state.turnTimeLeft -= dt;

      if (state.phase === 'betting') {
        const allLocked = state.seats.every((s) => s.betLocked);
        if (allLocked || state.turnTimeLeft <= 0) {
          dealLucky21Hands(state);
        }
      } else if (state.phase === 'player-turns' || state.phase === 'banker-turn') {
        const seat = state.seats[state.activeIdx];
        const doBotAction = () => {
          const ev = evaluateBanLuckHand(seat.hand);
          if (seat.hand.length === 2 && ev.value === 15 && Math.random() < 0.45) {
            this.handleCardAction!(state, seat.id, { type: 'custom', id: 'run-15' }, players);
          } else if (ev.value < 16 || (ev.value === 16 && seat.hand.length >= 3 && Math.random() < 0.45)) {
            this.handleCardAction!(state, seat.id, { type: 'custom', id: 'hit' }, players);
          } else if (state.phase === 'banker-turn') {
            this.handleCardAction!(state, seat.id, { type: 'custom', id: 'open-all' }, players);
          } else {
            this.handleCardAction!(state, seat.id, { type: 'custom', id: 'stand' }, players);
          }
        };

        if (seat.isBot) {
          state.botThinkTimer -= dt;
          if (state.botThinkTimer <= 0) {
            state.botThinkTimer = 0.75;
            doBotAction();
          }
        } else if (state.turnTimeLeft <= 0) {
          doBotAction();
        }
      } else if (state.phase === 'settle') {
        if (state.turnTimeLeft <= 0) {
          if (state.round < state.totalRounds) {
            state.round += 1;
            startLucky21Round(state);
          } else {
            state.finished = true;
            state.pendingSounds.push({ type: 'win' });
          }
        }
      }
    }

    const sounds = state.pendingSounds.splice(0);
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of players) {
      const s = state.seats.find((x) => x.id === p.id);
      if (s) {
        hudUpdates[p.id] = {
          score: s.chips,
          alive: true,
          statText: `${s.chips} Chips`,
          cooldownA: 0,
          cooldownB: 0,
        };
      }
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics: [],
      hudUpdates,
      privateStates: this.getPrivateStates!(state, players),
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },
  getSnapshot(state): Lucky21Snapshot {
    const banker = state.seats[state.bankerIdx];
    return {
      gameId: 'lucky-21',
      round: state.round,
      totalRounds: state.totalRounds,
      phase: state.phase,
      bankerId: banker?.id ?? '',
      activePlayerId: state.seats[state.activeIdx]?.id ?? '',
      turnTimeLeft: state.turnTimeLeft,
      turnTotal: state.turnTotal,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: state.flyingCards,
      shockwaves: state.shockwaves,
      popups: state.popups,
      players: state.seats.map((s, idx) => {
        const ev = s.hand.length > 0 ? evaluateBanLuckHand(s.hand) : null;
        return {
          id: s.id,
          slotIndex: s.slotIndex,
          name: s.name,
          colorHex: s.colorHex,
          isBot: s.isBot,
          isBanker: idx === state.bankerIdx,
          chips: s.chips,
          bet: s.bet,
          cardCount: s.hand.length,
          revealed: s.revealed,
          cards: s.revealed ? s.hand : [],
          handValue: s.revealed && ev ? ev.value : null,
          specialTag: s.revealed && ev ? ev.tag : null,
          status: s.status,
          lastDelta: s.lastDelta,
          lastAction: s.lastAction,
        };
      }),
    };
  },
  getRankings(state, players) {
    return state.seats
      .filter((s) => players.some((p) => p.id === s.id))
      .sort((a, b) => b.chips - a.chips)
      .map((s, idx) => ({
        playerId: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        color: players.find((p) => p.id === s.id)?.color ?? players[0].color,
        rank: idx + 1,
        score: s.chips,
        highlight: `${s.chips} CNY Chips`,
      }));
  },
};

// ============================================================================
// 10. TEN-PAIR SHOWDOWN (Ngau / 斗牛 — Authentic Malaysian CNY Rules!)
// ============================================================================
interface NgauEval {
  tier: number; // 0 No Ngau, 1..9 Ngau 1..9, 10 Ngau Tung, 11 Pair Ngau, 12 Five Gong
  multiplier: number;
  label: string;
  highCardPower: number;
  baseCards: StandardCardView[];
  pairCards: StandardCardView[];
}

function ngauPointOptions(rank: Rank52, wild36: boolean): number[] {
  if (rank === 'A') return [1];
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return [10];
  if (wild36 && (rank === '3' || rank === '6')) return [3, 6];
  return [Number(rank)];
}

function ngauCardTiePower(c: StandardCardView): number {
  const rankOrder: Rank52[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  return rankOrder.indexOf(c.rank) * 4 + bigTwoSuitVal(c.suit);
}

function evaluateNgauSplit(
  base: StandardCardView[],
  pair: StandardCardView[],
  wild36: boolean
): NgauEval {
  const all = [...base, ...pair];
  const highCardPower = Math.max(...all.map(ngauCardTiePower));

  // Legendary Five Gong (五公 — 5 J/Q/K picture cards = ×5!)
  if (all.every((c) => c.rank === 'J' || c.rank === 'Q' || c.rank === 'K')) {
    return {
      tier: 12,
      multiplier: 5,
      label: 'FIVE GONG ×5!',
      highCardPower,
      baseCards: base,
      pairCards: pair,
    };
  }

  // Verify 3-card base sums to a multiple of 10
  let baseValid = false;
  for (const a of ngauPointOptions(base[0].rank, wild36)) {
    for (const b of ngauPointOptions(base[1].rank, wild36)) {
      for (const c of ngauPointOptions(base[2].rank, wild36)) {
        if ((a + b + c) % 10 === 0) baseValid = true;
      }
    }
  }

  if (!baseValid) {
    return {
      tier: 0,
      multiplier: 1,
      label: 'NO NGAU',
      highCardPower,
      baseCards: base,
      pairCards: pair,
    };
  }

  // Pair Ngau (对子牛 = ×3!)
  if (pair[0].rank === pair[1].rank) {
    return {
      tier: 11,
      multiplier: 3,
      label: `PAIR ${pair[0].rank}s ×3!`,
      highCardPower: ngauCardTiePower(pair[0]) + 100,
      baseCards: base,
      pairCards: pair,
    };
  }

  // Best 2-card score (with optional 3/6 wild swap)
  let bestRem = 0;
  for (const x of ngauPointOptions(pair[0].rank, wild36)) {
    for (const y of ngauPointOptions(pair[1].rank, wild36)) {
      const mod = (x + y) % 10;
      const pts = mod === 0 ? 10 : mod;
      if (pts > bestRem) bestRem = pts;
    }
  }

  if (bestRem === 10) {
    return {
      tier: 10,
      multiplier: 2,
      label: 'NGAU TUNG ×2!',
      highCardPower,
      baseCards: base,
      pairCards: pair,
    };
  }
  return {
    tier: bestRem,
    multiplier: bestRem >= 8 ? 2 : 1,
    label: bestRem >= 8 ? `NGAU ${bestRem} ×2` : `NGAU ${bestRem}`,
    highCardPower,
    baseCards: base,
    pairCards: pair,
  };
}

function findBestNgauSplit(hand: StandardCardView[], wild36: boolean): NgauEval {
  let best: NgauEval | null = null;
  for (let i = 0; i < 5; i++) {
    for (let j = i + 1; j < 5; j++) {
      for (let k = j + 1; k < 5; k++) {
        const base = [hand[i], hand[j], hand[k]];
        const pair = hand.filter((_, idx) => idx !== i && idx !== j && idx !== k);
        const ev = evaluateNgauSplit(base, pair, wild36);
        if (
          !best ||
          ev.tier > best.tier ||
          (ev.tier === best.tier && ev.highCardPower > best.highCardPower)
        ) {
          best = ev;
        }
      }
    }
  }
  return best!;
}

interface TenPairSeat {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot: boolean;
  chips: number;
  bet: number;
  hand: StandardCardView[];
  selectedBaseIds: Set<string>;
  lockedIn: boolean;
  evalResult: NgauEval | null;
  lastDelta: number;
  lastAction: string | null;
}

interface TenPairInternal {
  round: number;
  totalRounds: number;
  wild36Enabled: boolean;
  seats: TenPairSeat[];
  bankerIdx: number;
  phase: TenPairShowdownSnapshot['phase'];
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  bannerTimer: number;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pendingSounds: SoundEvent[];
  finished: boolean;
}

function startNgauRound(state: TenPairInternal) {
  const deck = createDeck52(`ngau_r${state.round}`);
  state.bankerIdx = (state.round - 1) % state.seats.length;
  state.phase = 'arrange';
  state.turnTimeLeft = 16;
  state.turnTotal = 16;

  state.seats.forEach((s, idx) => {
    s.hand = deck.slice(idx * 5, (idx + 1) * 5);
    s.selectedBaseIds.clear();
    s.lockedIn = false;
    s.evalResult = null;
    s.lastDelta = 0;
    s.lastAction = idx === state.bankerIdx ? 'BANKER (庄)' : 'ARRANGING...';
  });
  state.banner = `ROUND ${state.round} · PICK 3 CARDS = MULTIPLE OF 10!`;
  state.bannerColor = '#F59E0B';
  state.bannerTimer = 2.2;
}

function settleNgauRound(state: TenPairInternal) {
  for (const s of state.seats) {
    if (!s.evalResult) {
      s.evalResult = findBestNgauSplit(s.hand, state.wild36Enabled);
      s.lockedIn = true;
    }
  }
  const banker = state.seats[state.bankerIdx];
  const bEv = banker.evalResult!;
  for (const s of state.seats) {
    if (s.id === banker.id) continue;
    const pEv = s.evalResult!;
    const playerWins =
      pEv.tier > bEv.tier || (pEv.tier === bEv.tier && pEv.highCardPower > bEv.highCardPower);
    const mult = playerWins ? pEv.multiplier : bEv.multiplier;
    const delta = (playerWins ? 1 : -1) * s.bet * mult;
    s.chips += delta;
    banker.chips -= delta;
    s.lastDelta = delta;
    s.lastAction = delta > 0 ? `+${delta} (${pEv.label})` : `${delta}`;
  }
  banker.lastAction = `BANKER ${bEv.label}`;
  state.phase = 'reveal';
  state.turnTimeLeft = 3.8;
  state.banner = `SHOWDOWN! BANKER HAS ${bEv.label}`;
  state.bannerColor = '#F59E0B';
  state.bannerTimer = 3.2;
  state.pendingSounds.push({ type: 'confirm' });
}

export const tenPairShowdownModule: ServerGameModule<TenPairInternal> = {
  id: 'ten-pair-showdown',
  createState(players, settingValue) {
    const seats: TenPairSeat[] = players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: Boolean(p.isBot),
      chips: 1000,
      bet: 100,
      hand: [],
      selectedBaseIds: new Set(),
      lockedIn: false,
      evalResult: null,
      lastDelta: 0,
      lastAction: null,
    }));
    if (seats.length < 2) {
      seats.push({
        id: 'ngau_bot_1',
        slotIndex: 1,
        name: 'OX MASTER AI',
        colorHex: '#F59E0B',
        isBot: true,
        chips: 1000,
        bet: 100,
        hand: [],
        selectedBaseIds: new Set(),
        lockedIn: false,
        evalResult: null,
        lastDelta: 0,
        lastAction: null,
      });
    }
    const state: TenPairInternal = {
      round: 1,
      totalRounds: 4,
      wild36Enabled: settingValue !== 0,
      seats,
      bankerIdx: 0,
      phase: 'arrange',
      turnTimeLeft: 16,
      turnTotal: 16,
      banner: null,
      bannerColor: null,
      bannerTimer: 0,
      flyingCards: [],
      shockwaves: [],
      popups: [],
      pendingSounds: [],
      finished: false,
    };
    startNgauRound(state);
    return state;
  },
  handleCardAction(state, playerId, action) {
    if (state.finished || state.phase !== 'arrange') return;
    const seat = state.seats.find((s) => s.id === playerId);
    if (!seat || seat.lockedIn) return;

    if (action.type === 'toggle-card') {
      if (seat.selectedBaseIds.has(action.cardId)) seat.selectedBaseIds.delete(action.cardId);
      else if (seat.selectedBaseIds.size < 3) seat.selectedBaseIds.add(action.cardId);
      return;
    }

    if (action.type === 'custom' && action.id === 'auto-best') {
      seat.evalResult = findBestNgauSplit(seat.hand, state.wild36Enabled);
      seat.selectedBaseIds = new Set(seat.evalResult.baseCards.map((c) => c.id));
      seat.lockedIn = true;
      seat.lastAction = 'READY!';
      state.pendingSounds.push({ type: 'confirm', playerId });
      return;
    }

    if (action.type === 'submit-selected' || (action.type === 'custom' && action.id === 'lock-split')) {
      if (seat.selectedBaseIds.size === 3) {
        const base = seat.hand.filter((c) => seat.selectedBaseIds.has(c.id));
        const pair = seat.hand.filter((c) => !seat.selectedBaseIds.has(c.id));
        seat.evalResult = evaluateNgauSplit(base, pair, state.wild36Enabled);
      } else {
        seat.evalResult = findBestNgauSplit(seat.hand, state.wild36Enabled);
      }
      seat.lockedIn = true;
      seat.lastAction = 'LOCKED!';
      state.pendingSounds.push({ type: 'confirm', playerId });
    }
  },
  getPrivateStates(state, players): Record<string, CardPrivateState> {
    const out: Record<string, CardPrivateState> = {};
    for (const p of players) {
      const seat = state.seats.find((s) => s.id === p.id);
      if (!seat) continue;
      const isArrange = state.phase === 'arrange' && !seat.lockedIn;
      const previewEval =
        seat.selectedBaseIds.size === 3
          ? evaluateNgauSplit(
              seat.hand.filter((c) => seat.selectedBaseIds.has(c.id)),
              seat.hand.filter((c) => !seat.selectedBaseIds.has(c.id)),
              state.wild36Enabled
            )
          : null;

      out[p.id] = {
        gameId: 'ten-pair-showdown',
        playerId: p.id,
        hand: seat.hand.map((c) => ({
          id: c.id,
          kind: 'liar',
          rank: c.rank,
          suit: c.suit,
          playable: isArrange,
          selected: seat.selectedBaseIds.has(c.id),
        })),
        cursorIndex: 0,
        isMyTurn: isArrange,
        isActionRequired: isArrange,
        turnTimeLeft: state.turnTimeLeft,
        turnTotal: state.turnTotal,
        badgeText: previewEval
          ? previewEval.label
          : state.wild36Enabled
            ? '3 ↔ 6 WILD ON'
            : 'PURE NGAU',
        badgeColorHex: '#F59E0B',
        extraActions: [
          {
            label: previewEval ? `LOCK: ${previewEval.label}` : `LOCK 3 BASE (${seat.selectedBaseIds.size}/3)`,
            labelZh: previewEval ? `锁定: ${previewEval.label}` : `锁定 3 张底牌 (${seat.selectedBaseIds.size}/3)`,
            action: { type: 'custom', id: 'lock-split' },
            colorHex: '#F59E0B',
            textColor: '#14120B',
            disabled: !isArrange || seat.selectedBaseIds.size !== 3,
          },
          {
            label: 'AUTO BEST NGAU',
            labelZh: '一键最优牛',
            action: { type: 'custom', id: 'auto-best' },
            colorHex: '#10D98B',
            textColor: '#0A1913',
            disabled: !isArrange,
          },
        ],
        statusHint: isArrange
          ? 'Tap 3 cards totaling 10/20/30, or hit Auto Best Ngau!'
          : seat.evalResult
            ? `Locked: ${seat.evalResult.label}`
            : 'Waiting for table reveal...',
        statusHintZh: isArrange
          ? '点击 3 张凑成 10 的倍数，或按「一键最优牛」！'
          : seat.evalResult
            ? `已锁定：${seat.evalResult.label}`
            : '等待全桌开牌比大小...',
      };
    }
    return out;
  },
  step(state, players, dt): StepOutput {
    stepVisuals(state.flyingCards, state.shockwaves, state.popups, dt);
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }

    if (!state.finished) {
      state.turnTimeLeft -= dt;
      if (state.phase === 'arrange') {
        // Bots lock in smoothly after ~1.6s
        if (state.turnTimeLeft < state.turnTotal - 1.6) {
          for (const s of state.seats) {
            if (s.isBot && !s.lockedIn) {
              s.evalResult = findBestNgauSplit(s.hand, state.wild36Enabled);
              s.lockedIn = true;
              s.lastAction = 'READY!';
            }
          }
        }
        if (state.seats.every((s) => s.lockedIn) || state.turnTimeLeft <= 0) {
          settleNgauRound(state);
        }
      } else if (state.phase === 'reveal') {
        if (state.turnTimeLeft <= 0) {
          if (state.round < state.totalRounds) {
            state.round += 1;
            startNgauRound(state);
          } else {
            state.finished = true;
            state.pendingSounds.push({ type: 'win' });
          }
        }
      }
    }

    const sounds = state.pendingSounds.splice(0);
    const hudUpdates: Record<string, PlayerHudUpdate> = {};
    for (const p of players) {
      const s = state.seats.find((x) => x.id === p.id);
      if (s) {
        hudUpdates[p.id] = {
          score: s.chips,
          alive: true,
          statText: `${s.chips} Chips`,
          cooldownA: 0,
          cooldownB: 0,
        };
      }
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics: [],
      hudUpdates,
      privateStates: this.getPrivateStates!(state, players),
      finished: state.finished,
      rankings: state.finished ? this.getRankings(state, players) : undefined,
    };
  },
  getSnapshot(state): TenPairShowdownSnapshot {
    const showAll = state.phase !== 'arrange';
    return {
      gameId: 'ten-pair-showdown',
      round: state.round,
      totalRounds: state.totalRounds,
      wild36Enabled: state.wild36Enabled,
      phase: state.phase,
      bankerId: state.seats[state.bankerIdx]?.id ?? '',
      turnTimeLeft: state.turnTimeLeft,
      turnTotal: state.turnTotal,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: state.flyingCards,
      shockwaves: state.shockwaves,
      popups: state.popups,
      players: state.seats.map((s, idx) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        colorHex: s.colorHex,
        isBot: s.isBot,
        isBanker: idx === state.bankerIdx,
        chips: s.chips,
        bet: s.bet,
        lockedIn: s.lockedIn,
        revealed: showAll,
        baseCards: showAll && s.evalResult ? s.evalResult.baseCards : [],
        pairCards: showAll && s.evalResult ? s.evalResult.pairCards : [],
        rankLabel: showAll && s.evalResult ? s.evalResult.label : null,
        multiplier: showAll && s.evalResult ? s.evalResult.multiplier : 1,
        lastDelta: s.lastDelta,
        lastAction: s.lastAction,
      })),
    };
  },
  getRankings(state, players) {
    return state.seats
      .filter((s) => players.some((p) => p.id === s.id))
      .sort((a, b) => b.chips - a.chips)
      .map((s, idx) => ({
        playerId: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        color: players.find((p) => p.id === s.id)?.color ?? players[0].color,
        rank: idx + 1,
        score: s.chips,
        highlight: `${s.chips} CNY Chips`,
      }));
  },
};
