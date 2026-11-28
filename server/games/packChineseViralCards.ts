import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../../src/shared/cardLayout.ts';
import type {
  BotDifficulty,
  CardActionButton,
  CardClientAction,
  CardPrivateHandItem,
  CardPrivateState,
  CardShockwave,
  FlyingCardAnim,
  IdiomChainSnapshot,
  LandlordCardView,
  LandlordClashSnapshot,
  LiarsDiceTavernSnapshot,
  LiarSuit,
  MahjongTileView,
  MidnightWerewolfSnapshot,
  PlayingCardRank,
  SpeedMahjongSnapshot,
  UndercoverWordSnapshot,
} from '../../src/shared/types.ts';
import { getUniversalBotProfile, UNIVERSAL_BOT_PROFILES } from '../../src/shared/botProfile.ts';
import { isStateFrenzyActive } from './packModuleAdapter.ts';
import type {
  CompactGameInitContext as GameInitContext,
  CompactGameModule as ServerGameModule,
  CompactResultEntry as GameResultEntry,
  CompactSoundEvent as SoundEvent,
} from './packModuleAdapter.ts';

function buildRankings(entries: { id: string; score: number; stat: string }[]): GameResultEntry[] {
  return [...entries]
    .sort((a, b) => b.score - a.score)
    .map((e, i) => ({ playerId: e.id, rank: i + 1, score: Math.round(e.score), statLabel: e.stat }));
}

function tickCardFx(
  flyingCards: FlyingCardAnim[],
  shockwaves: CardShockwave[],
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[],
  dt: number
) {
  for (let i = flyingCards.length - 1; i >= 0; i--) {
    flyingCards[i].progress += dt * 2.8;
    if (flyingCards[i].progress >= 1) flyingCards.splice(i, 1);
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    const sw = shockwaves[i];
    sw.radius += (sw.maxRadius - sw.radius) * Math.min(1, dt * 6);
    sw.alpha -= dt * 1.6;
    if (sw.alpha <= 0) shockwaves.splice(i, 1);
  }
  for (let i = popups.length - 1; i >= 0; i--) {
    popups[i].y -= dt * 24;
    popups[i].alpha -= dt * 0.9;
    if (popups[i].alpha <= 0) popups.splice(i, 1);
  }
}

// ============================================================
// 69. LANDLORD CLASH (斗地主)
// ============================================================
const DDZ_RANK_VAL: Record<PlayingCardRank, number> = {
  '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 11, Q: 12, K: 13, A: 14, '2': 15, JOKER: 16,
};

function ddzCardWeight(c: LandlordCardView): number {
  if (c.rank === 'JOKER') return c.jokerKind === 'big' ? 17 : 16;
  return DDZ_RANK_VAL[c.rank];
}

interface DdzComboEval {
  type: 'single' | 'pair' | 'triple' | 'triple1' | 'straight' | 'bomb' | 'rocket';
  power: number;
  length: number;
  label: string;
}

function evalDdzCombo(cards: LandlordCardView[]): DdzComboEval | null {
  const n = cards.length;
  if (n === 0) return null;
  const sorted = [...cards].sort((a, b) => ddzCardWeight(a) - ddzCardWeight(b));
  const weights = sorted.map(ddzCardWeight);

  if (n === 2 && weights[0] === 16 && weights[1] === 17) {
    return { type: 'rocket', power: 999, length: 2, label: 'ROCKET! 王炸 ×2' };
  }
  if (n === 1) {
    return { type: 'single', power: weights[0], length: 1, label: `${sorted[0].rank === 'JOKER' ? (sorted[0].jokerKind === 'big' ? 'BIG JOKER' : 'SM JOKER') : sorted[0].rank}` };
  }
  if (n === 2 && weights[0] === weights[1]) {
    return { type: 'pair', power: weights[0], length: 2, label: `PAIR ${sorted[0].rank}s` };
  }
  if (n === 3 && weights[0] === weights[2]) {
    return { type: 'triple', power: weights[0], length: 3, label: `TRIPLE ${sorted[0].rank}s` };
  }
  if (n === 4) {
    if (weights[0] === weights[3]) {
      return { type: 'bomb', power: 500 + weights[0], length: 4, label: `BOMB ${sorted[0].rank}×4!` };
    }
    if (weights[0] === weights[2] || weights[1] === weights[3]) {
      const tripW = weights[1];
      return { type: 'triple1', power: tripW, length: 4, label: '3 + 1' };
    }
  }
  if (n >= 5) {
    // Straight (3..A only, no 2s or Jokers)
    let isStraight = weights[n - 1] <= 14;
    for (let i = 1; i < n && isStraight; i++) {
      if (weights[i] !== weights[i - 1] + 1) isStraight = false;
    }
    if (isStraight) {
      return { type: 'straight', power: weights[n - 1], length: n, label: `${n}-CARD STRAIGHT` };
    }
  }
  return null;
}

function canBeatDdz(play: DdzComboEval, table: DdzComboEval | null): boolean {
  if (!table) return true;
  if (play.type === 'rocket') return true;
  if (table.type === 'rocket') return false;
  if (play.type === 'bomb' && table.type !== 'bomb') return true;
  if (play.type === table.type && play.length === table.length && play.power > table.power) return true;
  return false;
}

function createDdzDeck(): LandlordCardView[] {
  const suits: Exclude<LiarSuit, 'joker'>[] = ['spades', 'hearts', 'clubs', 'diamonds'];
  const ranks: Exclude<PlayingCardRank, 'JOKER'>[] = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const deck: LandlordCardView[] = [];
  let seq = 0;
  for (const r of ranks) {
    for (const s of suits) deck.push({ id: `ddz_${seq++}`, rank: r, suit: s });
  }
  deck.push({ id: `ddz_${seq++}`, rank: 'JOKER', suit: 'joker', jokerKind: 'small' });
  deck.push({ id: `ddz_${seq++}`, rank: 'JOKER', suit: 'joker', jokerKind: 'big' });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

interface DdzSeat {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  isLandlord: boolean;
  hand: LandlordCardView[];
  selectedIds: Set<string>;
  bidValue: number;
  passedTrick: boolean;
  score: number;
  lastAction: string | null;
}

interface LandlordClashState {
  round: number;
  totalRounds: number;
  phase: 'bidding' | 'playing' | 'round-over';
  seats: DdzSeat[];
  activeIdx: number;
  landlordId: string | null;
  highestBid: number;
  highestBidderId: string | null;
  bidsDone: number;
  multiplier: number;
  kittyCards: LandlordCardView[];
  kittyRevealed: boolean;
  tableCards: LandlordCardView[];
  tableEval: DdzComboEval | null;
  trickOwnerId: string | null;
  turnTimeLeft: number;
  turnTotal: number;
  botThinkTimer: number;
  roundDelayTimer: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pendingSounds: SoundEvent[];
}

function dealDdzRound(state: LandlordClashState) {
  const deck = createDdzDeck();
  state.kittyCards = deck.slice(0, 3);
  state.kittyRevealed = false;
  const dealPool = deck.slice(3);
  const perPlayer = Math.floor(dealPool.length / state.seats.length);
  state.seats.forEach((s, idx) => {
    s.isLandlord = false;
    s.hand = dealPool
      .slice(idx * perPlayer, (idx + 1) * perPlayer)
      .sort((a, b) => ddzCardWeight(a) - ddzCardWeight(b));
    s.selectedIds.clear();
    s.bidValue = -1;
    s.passedTrick = false;
    s.lastAction = null;
  });
  state.phase = 'bidding';
  state.activeIdx = (state.round - 1) % state.seats.length;
  state.landlordId = null;
  state.highestBid = 0;
  state.highestBidderId = null;
  state.bidsDone = 0;
  state.multiplier = 1;
  state.tableCards = [];
  state.tableEval = null;
  state.trickOwnerId = null;
  state.turnTotal = 11;
  state.turnTimeLeft = 11;
  state.botThinkTimer = 0.52;
  state.banner = `ROUND ${state.round}/${state.totalRounds} — BID FOR LANDLORD!`;
  state.bannerColor = '#F59E0B';
}

function finalizeDdzBid(state: LandlordClashState) {
  const winnerId = state.highestBidderId ?? state.seats[0].id;
  const ll = state.seats.find((s) => s.id === winnerId) ?? state.seats[0];
  ll.isLandlord = true;
  ll.hand = [...ll.hand, ...state.kittyCards].sort((a, b) => ddzCardWeight(a) - ddzCardWeight(b));
  state.landlordId = ll.id;
  state.multiplier = Math.max(1, state.highestBid);
  state.kittyRevealed = true;
  state.phase = 'playing';
  state.activeIdx = state.seats.indexOf(ll);
  state.turnTotal = 14;
  state.turnTimeLeft = 14;
  state.botThinkTimer = 0.55;
  state.banner = `${ll.name} IS LANDLORD (×${state.multiplier})!`;
  state.bannerColor = '#DC2626';
  state.pendingSounds.push({ type: 'score', playerId: ll.id });
}

function findLowestValidDdzPlay(hand: LandlordCardView[], tableEval: DdzComboEval | null): LandlordCardView[] | null {
  const sorted = [...hand].sort((a, b) => ddzCardWeight(a) - ddzCardWeight(b));
  if (!tableEval) {
    // Lead lowest pair or single
    for (let i = 0; i < sorted.length - 1; i++) {
      if (ddzCardWeight(sorted[i]) === ddzCardWeight(sorted[i + 1])) return [sorted[i], sorted[i + 1]];
    }
    return sorted.length > 0 ? [sorted[0]] : null;
  }
  if (tableEval.type === 'single') {
    const hit = sorted.find((c) => ddzCardWeight(c) > tableEval.power);
    if (hit) return [hit];
  } else if (tableEval.type === 'pair') {
    for (let i = 0; i < sorted.length - 1; i++) {
      if (ddzCardWeight(sorted[i]) === ddzCardWeight(sorted[i + 1]) && ddzCardWeight(sorted[i]) > tableEval.power) {
        return [sorted[i], sorted[i + 1]];
      }
    }
  } else if (tableEval.type === 'triple') {
    for (let i = 0; i < sorted.length - 2; i++) {
      if (ddzCardWeight(sorted[i]) === ddzCardWeight(sorted[i + 2]) && ddzCardWeight(sorted[i]) > tableEval.power) {
        return [sorted[i], sorted[i + 1], sorted[i + 2]];
      }
    }
  } else if (tableEval.type === 'triple1') {
    for (let i = 0; i < sorted.length - 2; i++) {
      if (ddzCardWeight(sorted[i]) === ddzCardWeight(sorted[i + 2]) && ddzCardWeight(sorted[i]) > tableEval.power) {
        const kicker = sorted.find((c) => c !== sorted[i] && c !== sorted[i + 1] && c !== sorted[i + 2]);
        if (kicker) return [sorted[i], sorted[i + 1], sorted[i + 2], kicker];
      }
    }
  } else if (tableEval.type === 'straight') {
    const uniqByW = new Map<number, LandlordCardView>();
    for (const c of sorted) {
      const w = ddzCardWeight(c);
      if (w <= 14 && !uniqByW.has(w)) uniqByW.set(w, c);
    }
    for (let top = tableEval.power + 1; top <= 14; top++) {
      const seq: LandlordCardView[] = [];
      for (let w = top - tableEval.length + 1; w <= top; w++) {
        const hit = uniqByW.get(w);
        if (hit) seq.push(hit);
      }
      if (seq.length === tableEval.length) return seq;
    }
  }
  // Check Bomb or Rocket
  for (let i = 0; i < sorted.length - 3; i++) {
    if (ddzCardWeight(sorted[i]) === ddzCardWeight(sorted[i + 3])) {
      const bomb = sorted.slice(i, i + 4);
      const ev = evalDdzCombo(bomb);
      if (ev && canBeatDdz(ev, tableEval)) return bomb;
    }
  }
  const jokers = sorted.filter((c) => c.rank === 'JOKER');
  if (jokers.length === 2) return jokers;
  return null;
}

function applyDdzPlay(state: LandlordClashState, seat: DdzSeat, cards: LandlordCardView[], frenzy: boolean): boolean {
  const ev = evalDdzCombo(cards);
  if (!ev || !canBeatDdz(ev, state.tableEval)) return false;

  const ids = new Set(cards.map((c) => c.id));
  seat.hand = seat.hand.filter((c) => !ids.has(c.id));
  seat.selectedIds.clear();
  seat.passedTrick = false;
  seat.lastAction = ev.label;
  state.tableCards = cards;
  state.tableEval = ev;
  state.trickOwnerId = seat.id;

  if (ev.type === 'bomb' || ev.type === 'rocket') {
    state.multiplier *= frenzy ? 4 : 2;
    state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 24, maxRadius: 340, colorHex: '#FACC15', alpha: 1 });
    state.banner = `${ev.label} TABLE ×${state.multiplier}!`;
    state.bannerColor = '#FACC15';
  }
  const pos = getCardSeatPosition(state.seats.indexOf(seat), state.seats.length);
  state.flyingCards.push({
    id: `fly_${Date.now()}_${Math.random()}`,
    fromX: pos.x,
    fromY: pos.y,
    toX: TABLE_CENTER_X,
    toY: TABLE_CENTER_Y,
    progress: 0,
    faceUp: true,
    colorHex: seat.colorHex,
    rankText: ev.label.slice(0, 6),
    rotStart: -0.25,
    rotEnd: 0,
  });
  state.pendingSounds.push({ type: 'score', playerId: seat.id });

  if (seat.hand.length === 0) {
    const base = 180 * state.multiplier;
    if (seat.isLandlord) {
      seat.score += base * 2;
      state.banner = `LANDLORD ${seat.name} WINS! +${base * 2}!`;
    } else {
      for (const s of state.seats) {
        if (!s.isLandlord) s.score += base;
      }
      state.banner = `PEASANTS WIN! +${base} EACH!`;
    }
    state.bannerColor = '#10D98B';
    state.phase = 'round-over';
    state.roundDelayTimer = 1.8;
    state.pendingSounds.push({ type: 'win', playerId: seat.id });
    return true;
  }

  state.activeIdx = (state.activeIdx + 1) % state.seats.length;
  state.turnTimeLeft = state.turnTotal;
  state.botThinkTimer = 0.48;
  return true;
}

function applyDdzPass(state: LandlordClashState, seat: DdzSeat) {
  seat.passedTrick = true;
  seat.selectedIds.clear();
  seat.lastAction = 'PASS';
  state.activeIdx = (state.activeIdx + 1) % state.seats.length;
  if (state.seats[state.activeIdx].id === state.trickOwnerId) {
    state.tableCards = [];
    state.tableEval = null;
    for (const s of state.seats) s.passedTrick = false;
  }
  state.turnTimeLeft = state.turnTotal;
  state.botThinkTimer = 0.42;
}

export const landlordClashModule: ServerGameModule<LandlordClashState, LandlordClashSnapshot> = {
  id: 'landlord-clash',
  init(ctx): LandlordClashState {
    const totalRounds = ctx.settingValue || 3;
    const seats: DdzSeat[] = ctx.players.slice(0, 4).map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.colorHex,
      isBot: p.isBot,
      isLandlord: false,
      hand: [],
      selectedIds: new Set(),
      bidValue: -1,
      passedTrick: false,
      score: 0,
      lastAction: null,
    }));
    const st: LandlordClashState = {
      round: 1,
      totalRounds,
      phase: 'bidding',
      seats,
      activeIdx: 0,
      landlordId: null,
      highestBid: 0,
      highestBidderId: null,
      bidsDone: 0,
      multiplier: 1,
      kittyCards: [],
      kittyRevealed: false,
      tableCards: [],
      tableEval: null,
      trickOwnerId: null,
      turnTimeLeft: 12,
      turnTotal: 12,
      botThinkTimer: 0.85,
      roundDelayTimer: 0,
      banner: null,
      bannerColor: null,
      flyingCards: [],
      shockwaves: [],
      popups: [],
      pendingSounds: [],
    };
    dealDdzRound(st);
    return st;
  },
  getPrivateStates(state): Record<string, CardPrivateState> {
    const out: Record<string, CardPrivateState> = {};
    const active = state.seats[state.activeIdx];
    for (const seat of state.seats) {
      const isTurn = active?.id === seat.id && state.phase !== 'round-over';
      const hand: CardPrivateHandItem[] = seat.hand.map((c) => ({
        id: c.id,
        kind: 'liar',
        rank: c.rank,
        suit: c.suit,
        playable: isTurn && state.phase === 'playing',
        selected: seat.selectedIds.has(c.id),
      }));
      const extraActions: CardActionButton[] = [];
      let primaryBtn: CardActionButton | undefined;
      let secondaryBtn: CardActionButton | undefined;
      if (state.phase === 'bidding' && isTurn) {
        if (state.highestBid < 1) extraActions.push({ label: 'BID 1×', labelZh: '叫1分', action: { type: 'custom', id: 'bid', payload: '1' }, colorHex: '#10D98B', textColor: '#052E16' });
        if (state.highestBid < 2) extraActions.push({ label: 'BID 2×', labelZh: '叫2分', action: { type: 'custom', id: 'bid', payload: '2' }, colorHex: '#F59E0B', textColor: '#141008' });
        if (state.highestBid < 3) extraActions.push({ label: 'BID 3×', labelZh: '叫3分(抢)', action: { type: 'custom', id: 'bid', payload: '3' }, colorHex: '#DC2626', textColor: '#FFFFFF' });
        secondaryBtn = { label: 'PASS BID', labelZh: '不叫', action: { type: 'custom', id: 'bid', payload: '0' }, colorHex: '#475569', textColor: '#FFFFFF' };
      } else if (state.phase === 'playing' && isTurn) {
        const selCards = seat.hand.filter((c) => seat.selectedIds.has(c.id));
        const selEval = evalDdzCombo(selCards);
        const canSubmit = Boolean(selEval && canBeatDdz(selEval, state.tableEval));
        primaryBtn = { label: 'PLAY SELECTED', labelZh: '出牌', action: { type: 'submit-selected' }, colorHex: '#10D98B', textColor: '#052E16', disabled: !canSubmit };
        extraActions.push({ label: 'SMART PLAY', labelZh: '智能出牌', action: { type: 'custom', id: 'smart-play' }, colorHex: '#38BDF8', textColor: '#082F49' });
        if (state.tableEval) {
          secondaryBtn = { label: 'PASS', labelZh: '不出', action: { type: 'draw-or-pass' }, colorHex: '#EF4444', textColor: '#FFFFFF' };
        }
      }
      out[seat.id] = {
        gameId: 'landlord-clash',
        playerId: seat.id,
        hand,
        cursorIndex: 0,
        isMyTurn: isTurn,
        isActionRequired: isTurn,
        turnTimeLeft: state.turnTimeLeft,
        turnTotal: state.turnTotal,
        selectedCount: seat.selectedIds.size,
        badgeText: seat.isLandlord ? 'LANDLORD (地主)' : state.landlordId ? 'PEASANT (农民)' : 'BIDDING',
        badgeColorHex: seat.isLandlord ? '#DC2626' : '#10B981',
        primaryBtn,
        secondaryBtn,
        extraActions,
        statusHint: isTurn
          ? state.phase === 'bidding'
            ? 'Bid 1–3× to become Landlord!'
            : 'Tap cards & press PLAY (or SMART PLAY)!'
          : `Waiting for ${active?.name ?? ''}...`,
        statusHintZh: isTurn
          ? state.phase === 'bidding'
            ? '叫分 1–3 倍抢地主！'
            : '点选牌型后按出牌（或一键出牌）！'
          : `等待 ${active?.name ?? ''} 出牌...`,
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action, players) {
    const seat = state.seats.find((s) => s.id === playerId);
    const active = state.seats[state.activeIdx];
    if (!seat || !active || active.id !== playerId) return { sounds: [] };

    if (action.type === 'toggle-card' || action.type === 'play-card') {
      const cid = action.cardId;
      if (cid) {
        if (seat.selectedIds.has(cid)) seat.selectedIds.delete(cid);
        else seat.selectedIds.add(cid);
      }
    } else if (action.type === 'custom' && action.id === 'bid' && state.phase === 'bidding') {
      const val = Number(action.payload ?? 0);
      seat.bidValue = val;
      seat.lastAction = val > 0 ? `BID ${val}×` : 'PASS';
      if (val > state.highestBid) {
        state.highestBid = val;
        state.highestBidderId = seat.id;
      }
      state.bidsDone++;
      if (val >= 3 || state.bidsDone >= state.seats.length) {
        finalizeDdzBid(state);
      } else {
        state.activeIdx = (state.activeIdx + 1) % state.seats.length;
        state.turnTimeLeft = state.turnTotal;
        state.botThinkTimer = 0.48;
      }
    } else if (action.type === 'submit-selected' && state.phase === 'playing') {
      const picked = seat.hand.filter((c) => seat.selectedIds.has(c.id));
      applyDdzPlay(state, seat, picked, isStateFrenzyActive(state));
    } else if (action.type === 'custom' && action.id === 'smart-play' && state.phase === 'playing') {
      const valid = findLowestValidDdzPlay(seat.hand, state.tableEval);
      if (valid) applyDdzPlay(state, seat, valid, isStateFrenzyActive(state));
      else if (state.tableEval) applyDdzPass(state, seat);
    } else if (action.type === 'draw-or-pass' && state.phase === 'playing' && state.tableEval) {
      applyDdzPass(state, seat);
    }
    const sounds = state.pendingSounds.splice(0);
    return { sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  step(state, players, dt, frenzyActive) {
    tickCardFx(state.flyingCards, state.shockwaves, state.popups, dt);
    if (state.phase === 'round-over') {
      state.roundDelayTimer -= dt;
      if (state.roundDelayTimer <= 0) {
        if (state.round >= state.totalRounds) return { finished: true, sounds: state.pendingSounds.splice(0) };
        state.round++;
        dealDdzRound(state);
      }
      return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
    }

    const active = state.seats[state.activeIdx];
    const inp = players.find((p) => p.id === active?.id);
    const isBot = Boolean(inp?.isBot || active?.isBot);
    state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
    if (isBot) state.botThinkTimer -= dt;

    if (active && (state.turnTimeLeft <= 0 || (isBot && state.botThinkTimer <= 0))) {
      if (state.phase === 'bidding') {
        const highCount = active.hand.filter((c) => ddzCardWeight(c) >= 15).length;
        const bid = highCount >= 2 && state.highestBid < 3 ? Math.min(3, state.highestBid + 1) : 0;
        active.bidValue = bid;
        active.lastAction = bid > 0 ? `BID ${bid}×` : 'PASS';
        if (bid > state.highestBid) {
          state.highestBid = bid;
          state.highestBidderId = active.id;
        }
        state.bidsDone++;
        if (bid >= 3 || state.bidsDone >= state.seats.length) finalizeDdzBid(state);
        else {
          state.activeIdx = (state.activeIdx + 1) % state.seats.length;
          state.turnTimeLeft = state.turnTotal;
          state.botThinkTimer = 0.48;
        }
      } else {
        const valid = findLowestValidDdzPlay(active.hand, state.tableEval);
        if (valid) applyDdzPlay(state, active, valid, frenzyActive);
        else if (state.tableEval) applyDdzPass(state, active);
        else if (active.hand[0]) applyDdzPlay(state, active, [active.hand[0]], frenzyActive);
      }
      return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
    }

    return { finished: false, sounds: state.pendingSounds.splice(0) };
  },
  snapshot(state): LandlordClashSnapshot {
    const owner = state.seats.find((s) => s.id === state.trickOwnerId);
    return {
      gameId: 'landlord-clash',
      round: state.round,
      totalRounds: state.totalRounds,
      phase: state.phase,
      activePlayerId: state.seats[state.activeIdx]?.id ?? '',
      landlordId: state.landlordId,
      multiplier: state.multiplier,
      kittyCards: state.kittyRevealed ? state.kittyCards : [],
      kittyRevealed: state.kittyRevealed,
      tableComboName: state.tableEval?.label ?? null,
      tableCards: state.tableCards,
      trickOwnerName: owner?.name ?? null,
      turnTimeLeft: state.turnTimeLeft,
      turnTotal: state.turnTotal,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: state.flyingCards.map((f) => ({ ...f })),
      shockwaves: state.shockwaves.map((s) => ({ ...s })),
      popups: state.popups.map((p) => ({ ...p })),
      players: state.seats.map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        colorHex: s.colorHex,
        isBot: s.isBot,
        isLandlord: s.isLandlord,
        cardCount: s.hand.length,
        bidValue: s.bidValue,
        passedTrick: s.passedTrick,
        score: s.score,
        lastAction: s.lastAction,
      })),
    };
  },
  buildResults(state) {
    return buildRankings(state.seats.map((s) => ({ id: s.id, score: s.score, stat: `${s.score} pts` })));
  },
};

// ============================================================
// 70. SPEED MAHJONG (雀魂极速麻将 — 7-Tile Express 1-Suit + Dragons)
// ============================================================
const WAN_LABELS = ['', '一万', '二万', '三万', '四万', '五万', '六万', '七万', '八万', '九万'];
const DRAGON_LABELS = ['', '中', '發', '白'];
const DRAGON_EN = ['', 'RED', 'GREEN', 'WHITE'];

function tileKey(t: MahjongTileView): number {
  return t.suit === 'wan' ? t.value : 10 + t.value; // 1..9 for wan, 11..13 for dragons
}

function canHu8Tiles(tiles: MahjongTileView[], meldsCount: number): boolean {
  // Need (2 - meldsCount) melds + 1 pair from hand!
  const needMelds = 2 - meldsCount;
  const counts = new Map<number, number>();
  for (const t of tiles) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);

  const checkMelds = (rem: Map<number, number>, left: number): boolean => {
    if (left === 0) {
      for (const v of rem.values()) if (v !== 0) return false;
      return true;
    }
    const first = [...rem.entries()].find(([, v]) => v > 0)?.[0];
    if (first === undefined) return false;
    // Try Pong
    if ((rem.get(first) ?? 0) >= 3) {
      rem.set(first, (rem.get(first) ?? 0) - 3);
      if (checkMelds(rem, left - 1)) return true;
      rem.set(first, (rem.get(first) ?? 0) + 3);
    }
    // Try Chow (only wan 1..7)
    if (first <= 7 && (rem.get(first + 1) ?? 0) > 0 && (rem.get(first + 2) ?? 0) > 0) {
      rem.set(first, (rem.get(first) ?? 0) - 1);
      rem.set(first + 1, (rem.get(first + 1) ?? 0) - 1);
      rem.set(first + 2, (rem.get(first + 2) ?? 0) - 1);
      if (checkMelds(rem, left - 1)) return true;
      rem.set(first, (rem.get(first) ?? 0) + 1);
      rem.set(first + 1, (rem.get(first + 1) ?? 0) + 1);
      rem.set(first + 2, (rem.get(first + 2) ?? 0) + 1);
    }
    return false;
  };

  for (const [k, v] of counts) {
    if (v >= 2) {
      const copy = new Map(counts);
      copy.set(k, v - 2);
      if (checkMelds(copy, needMelds)) return true;
    }
  }
  return false;
}

function createMahjongWall(): MahjongTileView[] {
  const wall: MahjongTileView[] = [];
  let seq = 0;
  for (let copy = 0; copy < 6; copy++) {
    for (let v = 1; v <= 9; v++) {
      wall.push({ id: `mj_${seq++}`, suit: 'wan', value: v, label: WAN_LABELS[v], sublabel: `${v}W` });
    }
  }
  for (let copy = 0; copy < 4; copy++) {
    for (let d = 1; d <= 3; d++) {
      wall.push({ id: `mj_${seq++}`, suit: 'dragon', value: d, label: DRAGON_LABELS[d], sublabel: DRAGON_EN[d] });
    }
  }
  for (let i = wall.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

interface MjSeat {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
  hand: MahjongTileView[];
  melds: MahjongTileView[][];
  discards: MahjongTileView[];
  score: number;
  lastAction: string | null;
}

interface SpeedMahjongState {
  round: number;
  totalRounds: number;
  seats: MjSeat[];
  wall: MahjongTileView[];
  activeIdx: number;
  lastDiscard: MahjongTileView | null;
  lastDiscardBy: string | null;
  winnerHand: MahjongTileView[] | null;
  winnerLabel: string | null;
  roundOverTimer: number;
  turnTimeLeft: number;
  turnTotal: number;
  botTimer: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pendingSounds: SoundEvent[];
}

function startMjRound(state: SpeedMahjongState) {
  state.wall = createMahjongWall();
  state.lastDiscard = null;
  state.lastDiscardBy = null;
  state.winnerHand = null;
  state.winnerLabel = null;
  state.roundOverTimer = 0;
  state.activeIdx = (state.round - 1) % state.seats.length;
  for (const s of state.seats) {
    s.melds = [];
    s.discards = [];
    s.lastAction = null;
    s.hand = state.wall.splice(0, 7).sort((a, b) => tileKey(a) - tileKey(b));
  }
  // Active player draws 8th tile
  const drawn = state.wall.pop();
  if (drawn) state.seats[state.activeIdx].hand.push(drawn);
  state.turnTotal = 14;
  state.turnTimeLeft = 14;
  state.botTimer = 0.9;
  state.banner = `MAHJONG ROUND ${state.round}/${state.totalRounds} — BUILD 2 MELDS + 1 PAIR!`;
  state.bannerColor = '#10B981';
}

function advanceMjTurn(state: SpeedMahjongState) {
  state.activeIdx = (state.activeIdx + 1) % state.seats.length;
  const next = state.seats[state.activeIdx];
  const drawn = state.wall.pop();
  if (!drawn) {
    state.banner = 'EXHAUSTIVE DRAW! 流局';
    state.bannerColor = '#94A3B8';
    state.roundOverTimer = 2.6;
    return;
  }
  next.hand.push(drawn);
  next.hand.sort((a, b) => tileKey(a) - tileKey(b));
  state.turnTimeLeft = state.turnTotal;
  state.botTimer = 0.9;
}

export const speedMahjongModule: ServerGameModule<SpeedMahjongState, SpeedMahjongSnapshot> = {
  id: 'speed-mahjong',
  init(ctx): SpeedMahjongState {
    const seats: MjSeat[] = ctx.players.slice(0, 4).map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.colorHex,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
      hand: [],
      melds: [],
      discards: [],
      score: 0,
      lastAction: null,
    }));
    const st: SpeedMahjongState = {
      round: 1,
      totalRounds: ctx.settingValue || 3,
      seats,
      wall: [],
      activeIdx: 0,
      lastDiscard: null,
      lastDiscardBy: null,
      winnerHand: null,
      winnerLabel: null,
      roundOverTimer: 0,
      turnTimeLeft: 14,
      turnTotal: 14,
      botTimer: 0.9,
      banner: null,
      bannerColor: null,
      flyingCards: [],
      shockwaves: [],
      popups: [],
      pendingSounds: [],
    };
    startMjRound(st);
    return st;
  },
  getPrivateStates(state): Record<string, CardPrivateState> {
    const out: Record<string, CardPrivateState> = {};
    const active = state.seats[state.activeIdx];
    for (const seat of state.seats) {
      const isTurn = active?.id === seat.id && state.roundOverTimer <= 0;
      const canSelfHu = isTurn && canHu8Tiles(seat.hand, seat.melds.length);
      const canRonHu =
        !isTurn &&
        state.roundOverTimer <= 0 &&
        Boolean(state.lastDiscard) &&
        canHu8Tiles([...seat.hand, state.lastDiscard!], seat.melds.length);
      const canPong =
        !isTurn &&
        state.roundOverTimer <= 0 &&
        Boolean(state.lastDiscard) &&
        seat.hand.filter((t) => tileKey(t) === tileKey(state.lastDiscard!)).length >= 2;

      const extraActions: CardActionButton[] = [];
      if (canSelfHu || canRonHu) {
        extraActions.push({
          label: 'HU! 胡牌',
          labelZh: '胡牌！(HU)',
          action: { type: 'custom', id: 'hu' },
          colorHex: '#F59E0B',
          textColor: '#141008',
        });
      }
      if (canPong) {
        extraActions.push({
          label: `PONG 碰 ${state.lastDiscard?.label}`,
          labelZh: `碰 ${state.lastDiscard?.label}`,
          action: { type: 'custom', id: 'pong' },
          colorHex: '#10D98B',
          textColor: '#052E16',
        });
      }

      out[seat.id] = {
        gameId: 'speed-mahjong',
        playerId: seat.id,
        hand: seat.hand.map((t) => ({
          id: t.id,
          kind: 'party',
          title: t.label,
          subtitle: t.sublabel,
          badge: t.suit === 'dragon' ? 'DRAGON' : 'WAN',
          accentHex: t.suit === 'dragon' ? '#DC2626' : '#059669',
          playable: isTurn,
          selected: false,
        })),
        cursorIndex: 0,
        isMyTurn: isTurn || canRonHu || canPong,
        isActionRequired: isTurn || canRonHu || canPong,
        turnTimeLeft: state.turnTimeLeft,
        turnTotal: state.turnTotal,
        badgeText: canSelfHu || canRonHu ? 'HU READY! 可胡' : `${seat.melds.length} MELDS`,
        badgeColorHex: canSelfHu || canRonHu ? '#F59E0B' : '#10B981',
        extraActions,
        statusHint: isTurn
          ? canSelfHu
            ? 'Press HU! to win or tap a tile to discard!'
            : 'Tap any tile on your phone to discard!'
          : canPong
          ? 'Tap PONG to claim the last discard!'
          : `Waiting for ${active?.name ?? ''}...`,
        statusHintZh: isTurn
          ? canSelfHu
            ? '可自摸胡牌！按「胡」获胜或打出一张牌！'
            : '点击手机上的任意麻将牌打出！'
          : canPong
          ? '点击「碰」抢下刚打出的牌！'
          : `等待 ${active?.name ?? ''} 出牌...`,
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action, players) {
    if (state.roundOverTimer > 0) return { sounds: [] };
    const seat = state.seats.find((s) => s.id === playerId);
    if (!seat) return { sounds: [] };
    const isTurn = state.seats[state.activeIdx]?.id === playerId;

    if (action.type === 'custom' && action.id === 'hu') {
      const fullHand = isTurn ? seat.hand : state.lastDiscard ? [...seat.hand, state.lastDiscard] : seat.hand;
      if (canHu8Tiles(fullHand, seat.melds.length)) {
        const hasDragon = fullHand.filter((t) => t.suit === 'dragon').length >= 3;
        const pts = (isTurn ? 320 : 240) * (hasDragon ? 2 : 1) * (isStateFrenzyActive(state) ? 2 : 1);
        seat.score += pts;
        seat.lastAction = `HU! +${pts}`;
        state.winnerHand = [...fullHand, ...seat.melds.flat()];
        state.winnerLabel = `${seat.name} ${isTurn ? 'SELF-DRAW HU! 自摸' : 'HU! 胡牌'} (+${pts})`;
        state.banner = state.winnerLabel;
        state.bannerColor = '#F59E0B';
        state.roundOverTimer = 3.2;
        state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 24, maxRadius: 340, colorHex: '#F59E0B', alpha: 1 });
        state.pendingSounds.push({ type: 'win', playerId: seat.id });
      }
    } else if (action.type === 'custom' && action.id === 'pong' && state.lastDiscard && !isTurn) {
      const targetKey = tileKey(state.lastDiscard);
      const matches = seat.hand.filter((t) => tileKey(t) === targetKey).slice(0, 2);
      if (matches.length === 2) {
        const remIds = new Set(matches.map((m) => m.id));
        seat.hand = seat.hand.filter((t) => !remIds.has(t.id));
        seat.melds.push([...matches, state.lastDiscard]);
        seat.score += 30;
        seat.lastAction = `PONG ${state.lastDiscard.label}! +30`;
        state.lastDiscard = null;
        state.activeIdx = state.seats.indexOf(seat);
        state.turnTimeLeft = state.turnTotal;
        state.botTimer = 0.75;
        state.banner = `${seat.name} PONG! 碰!`;
        state.pendingSounds.push({ type: 'score', playerId: seat.id });
      }
    } else if ((action.type === 'play-card' || action.type === 'toggle-card') && isTurn && action.cardId) {
      const idx = seat.hand.findIndex((t) => t.id === action.cardId);
      if (idx >= 0) {
        const [disc] = seat.hand.splice(idx, 1);
        seat.discards.push(disc);
        seat.lastAction = `DISCARD ${disc.label}`;
        state.lastDiscard = disc;
        state.lastDiscardBy = seat.name;
        state.pendingSounds.push({ type: 'tick', playerId: seat.id });
        advanceMjTurn(state);
      }
    }
    return { sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
  },
  step(state, players, dt, frenzyActive) {
    tickCardFx(state.flyingCards, state.shockwaves, state.popups, dt);
    if (state.roundOverTimer > 0) {
      state.roundOverTimer -= dt;
      if (state.roundOverTimer <= 0) {
        if (state.round >= state.totalRounds) return { finished: true, sounds: state.pendingSounds.splice(0) };
        state.round++;
        startMjRound(state);
        return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
      }
      return { finished: false, sounds: state.pendingSounds.splice(0) };
    }

    const active = state.seats[state.activeIdx];
    const inp = players.find((p) => p.id === active?.id);
    const isBot = Boolean(inp?.isBot || active?.isBot);
    state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
    if (isBot) state.botTimer -= dt;

    if (active && (state.turnTimeLeft <= 0 || (isBot && state.botTimer <= 0))) {
      // Allow bots to claim Ron Hu or Pong on the latest discard before drawing
      if (state.lastDiscard) {
        const disc = state.lastDiscard;
        const ronBot = state.seats.find(
          (s) => s.id !== active.id && s.isBot && s.name !== state.lastDiscardBy && canHu8Tiles([...s.hand, disc], s.melds.length)
        );
        if (ronBot) {
          const fullHand = [...ronBot.hand, disc];
          const pts = 240 * (frenzyActive ? 2 : 1);
          ronBot.score += pts;
          ronBot.lastAction = `RON HU! +${pts}`;
          state.winnerHand = [...fullHand, ...ronBot.melds.flat()];
          state.winnerLabel = `${ronBot.name} HU! 胡牌 (+${pts})`;
          state.banner = state.winnerLabel;
          state.bannerColor = '#F59E0B';
          state.roundOverTimer = 2.6;
          state.pendingSounds.push({ type: 'win', playerId: ronBot.id });
          return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
        }
        const discKey = tileKey(disc);
        const pongBot = state.seats.find(
          (s) =>
            s.id !== active.id &&
            s.isBot &&
            s.name !== state.lastDiscardBy &&
            s.hand.filter((t) => tileKey(t) === discKey).length >= 2
        );
        const pongProb = pongBot
          ? Math.max(
              0.05,
              Math.min(
                0.98,
                0.72 +
                  (UNIVERSAL_BOT_PROFILES.arcade.evaluationNoise -
                    getUniversalBotProfile(pongBot.botDifficulty).evaluationNoise) *
                    0.75
              )
            )
          : 0.72;
        if (pongBot && Math.random() < pongProb) {
          const matches = pongBot.hand.filter((t) => tileKey(t) === discKey).slice(0, 2);
          const remIds = new Set(matches.map((m) => m.id));
          pongBot.hand = pongBot.hand.filter((t) => !remIds.has(t.id));
          pongBot.melds.push([...matches, disc]);
          pongBot.score += 30;
          pongBot.lastAction = `PONG ${disc.label}! +30`;
          state.lastDiscard = null;
          state.activeIdx = state.seats.indexOf(pongBot);
          state.turnTimeLeft = state.turnTotal;
          state.botTimer = 0.65;
          state.banner = `${pongBot.name} PONG! 碰!`;
          state.pendingSounds.push({ type: 'score', playerId: pongBot.id });
          return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
        }
      }

      if (canHu8Tiles(active.hand, active.melds.length)) {
        const pts = 320 * (frenzyActive ? 2 : 1);
        active.score += pts;
        active.lastAction = `HU! +${pts}`;
        state.winnerHand = [...active.hand, ...active.melds.flat()];
        state.winnerLabel = `${active.name} SELF-DRAW HU! 自摸 (+${pts})`;
        state.banner = state.winnerLabel;
        state.bannerColor = '#F59E0B';
        state.roundOverTimer = 2.6;
        state.pendingSounds.push({ type: 'win', playerId: active.id });
      } else if (active.hand.length > 0) {
        // Smart bot discard: drop isolated tile
        const counts = new Map<number, number>();
        for (const t of active.hand) counts.set(tileKey(t), (counts.get(tileKey(t)) ?? 0) + 1);
        let dropIdx = 0;
        let minSupport = 99;
        active.hand.forEach((t, i) => {
          const k = tileKey(t);
          const sup = (counts.get(k) ?? 0) * 2 + (t.suit === 'wan' ? (counts.get(k - 1) ?? 0) + (counts.get(k + 1) ?? 0) : 0);
          if (sup < minSupport) {
            minSupport = sup;
            dropIdx = i;
          }
        });
        const [disc] = active.hand.splice(dropIdx, 1);
        active.discards.push(disc);
        active.lastAction = `DISCARD ${disc.label}`;
        state.lastDiscard = disc;
        state.lastDiscardBy = active.name;
        state.pendingSounds.push({ type: 'tick', playerId: active.id });
        advanceMjTurn(state);
      }
      return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
    }
    return { finished: false, sounds: state.pendingSounds.splice(0) };
  },
  snapshot(state): SpeedMahjongSnapshot {
    return {
      gameId: 'speed-mahjong',
      round: state.round,
      totalRounds: state.totalRounds,
      activePlayerId: state.seats[state.activeIdx]?.id ?? '',
      wallRemaining: state.wall.length,
      lastDiscard: state.lastDiscard,
      lastDiscardBy: state.lastDiscardBy,
      winnerHand: state.winnerHand,
      winnerLabel: state.winnerLabel,
      turnTimeLeft: state.turnTimeLeft,
      turnTotal: state.turnTotal,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: state.flyingCards.map((f) => ({ ...f })),
      shockwaves: state.shockwaves.map((s) => ({ ...s })),
      popups: state.popups.map((p) => ({ ...p })),
      players: state.seats.map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        colorHex: s.colorHex,
        isBot: s.isBot,
        tileCount: s.hand.length,
        melds: s.melds,
        discards: s.discards.slice(-6),
        readyTenpai: false,
        score: s.score,
        lastAction: s.lastAction,
      })),
    };
  },
  buildResults(state) {
    return buildRankings(state.seats.map((s) => ({ id: s.id, score: s.score, stat: `${s.score} pts` })));
  },
};

// ============================================================
// 71. TAVERN DICE (大话骰 / 吹牛骰子)
// ============================================================
const DICE_GLYPHS = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

interface TavernSeat {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  botDifficulty?: BotDifficulty;
  dice: number[];
  alive: boolean;
  score: number;
  lastAction: string | null;
}

interface TavernDiceState {
  round: number;
  totalRounds: number;
  phase: 'bidding' | 'reveal';
  seats: TavernSeat[];
  activeIdx: number;
  currentBidQty: number;
  currentBidFace: number;
  pureMode: boolean;
  lastBidderId: string | null;
  totalMatchingDice: number | null;
  turnTimeLeft: number;
  turnTotal: number;
  botTimer: number;
  revealTimer: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pendingSounds: SoundEvent[];
}

function rollTavernRound(state: TavernDiceState) {
  for (const s of state.seats) {
    if (!s.alive) continue;
    const count = s.dice.length;
    s.dice = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * 6)).sort((a, b) => a - b);
    s.lastAction = null;
  }
  state.phase = 'bidding';
  state.currentBidQty = 0;
  state.currentBidFace = 2;
  state.pureMode = false;
  state.lastBidderId = null;
  state.totalMatchingDice = null;
  while (!state.seats[state.activeIdx]?.alive) {
    state.activeIdx = (state.activeIdx + 1) % state.seats.length;
  }
  state.turnTotal = 14;
  state.turnTimeLeft = 14;
  state.botTimer = 0.95;
  state.banner = `ROUND ${state.round} — SHAKE & BID! (1s ARE WILD)`;
  state.bannerColor = '#F59E0B';
}

function resolveLiarCall(state: TavernDiceState, caller: TavernSeat, frenzy: boolean) {
  const bidder = state.seats.find((s) => s.id === state.lastBidderId) ?? state.seats[0];
  let total = 0;
  for (const s of state.seats) {
    if (!s.alive) continue;
    for (const d of s.dice) {
      if (d === state.currentBidFace || (!state.pureMode && d === 1)) total++;
    }
  }
  state.totalMatchingDice = total;
  state.phase = 'reveal';
  state.revealTimer = 3.4;

  const bidSucceeded = total >= state.currentBidQty;
  const loser = bidSucceeded ? caller : bidder;
  const winner = bidSucceeded ? bidder : caller;
  const pts = frenzy ? 320 : 180;
  winner.score += pts;
  loser.dice.pop();
  if (loser.dice.length === 0) loser.alive = false;

  state.banner = bidSucceeded
    ? `FOUND ${total}×${DICE_GLYPHS[state.currentBidFace]}! ${bidder.name} WINS! ${caller.name} LOSES A DIE!`
    : `ONLY ${total}×${DICE_GLYPHS[state.currentBidFace]}! BLUFF BUSTED BY ${caller.name}!`;
  state.bannerColor = bidSucceeded ? '#10D98B' : '#EF4444';
  state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 24, maxRadius: 340, colorHex: state.bannerColor, alpha: 1 });
  state.pendingSounds.push({ type: bidSucceeded ? 'score' : 'hit', playerId: winner.id });
}

function nextAliveTavernIdx(state: TavernDiceState, from: number): number {
  let idx = (from + 1) % state.seats.length;
  for (let i = 0; i < state.seats.length; i++) {
    if (state.seats[idx].alive) return idx;
    idx = (idx + 1) % state.seats.length;
  }
  return from;
}

export const liarsDiceTavernModule: ServerGameModule<TavernDiceState, LiarsDiceTavernSnapshot> = {
  id: 'liars-dice-tavern',
  init(ctx): TavernDiceState {
    const startDice = ctx.settingValue || 4;
    const seats: TavernSeat[] = ctx.players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.colorHex,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
      dice: Array.from({ length: startDice }, () => 1 + Math.floor(Math.random() * 6)),
      alive: true,
      score: 0,
      lastAction: null,
    }));
    const st: TavernDiceState = {
      round: 1,
      totalRounds: 6,
      phase: 'bidding',
      seats,
      activeIdx: 0,
      currentBidQty: 0,
      currentBidFace: 2,
      pureMode: false,
      lastBidderId: null,
      totalMatchingDice: null,
      turnTimeLeft: 14,
      turnTotal: 14,
      botTimer: 0.95,
      revealTimer: 0,
      banner: null,
      bannerColor: null,
      flyingCards: [],
      shockwaves: [],
      popups: [],
      pendingSounds: [],
    };
    rollTavernRound(st);
    return st;
  },
  getPrivateStates(state): Record<string, CardPrivateState> {
    const out: Record<string, CardPrivateState> = {};
    const active = state.seats[state.activeIdx];
    const totalDice = Math.max(
      2,
      state.seats.reduce((sum, s) => sum + (s.alive ? s.dice.length : 0), 0)
    );
    const minQty = Math.min(
      totalDice,
      Math.max(2, state.currentBidQty === 0 ? Math.max(2, state.seats.filter((s) => s.alive).length) : state.currentBidQty)
    );

    for (const seat of state.seats) {
      const isTurn = seat.alive && active?.id === seat.id && state.phase === 'bidding';
      const hand: CardPrivateHandItem[] = seat.dice.map((d, i) => ({
        id: `d_${seat.id}_${i}`,
        kind: 'party',
        title: DICE_GLYPHS[d],
        subtitle: d === 1 && !state.pureMode ? 'WILD 1' : `DIE ${d}`,
        badge: d === 1 && !state.pureMode ? 'WILD' : String(d),
        accentHex: d === 1 ? '#F59E0B' : '#334155',
        playable: false,
        selected: false,
      }));
      const extraActions: CardActionButton[] = [];
      let secondaryBtn: CardActionButton | undefined;
      if (isTurn) {
        const nextQty = state.currentBidQty === 0 ? minQty : state.currentBidQty + 1;
        const nextFace = state.currentBidQty === 0 ? 3 : state.currentBidFace < 6 ? state.currentBidFace + 1 : 2;
        if (nextQty <= totalDice) {
          extraActions.push({
            label: `BID ${nextQty}× ${DICE_GLYPHS[state.currentBidFace]}`,
            labelZh: `叫 ${nextQty}个${state.currentBidFace}`,
            action: { type: 'custom', id: 'bid', payload: `${nextQty}:${state.currentBidFace}` },
            colorHex: '#10D98B',
            textColor: '#052E16',
          });
        }
        if (state.currentBidQty > 0 && state.currentBidFace < 6) {
          extraActions.push({
            label: `BID ${state.currentBidQty}× ${DICE_GLYPHS[nextFace]}`,
            labelZh: `叫 ${state.currentBidQty}个${nextFace}`,
            action: { type: 'custom', id: 'bid', payload: `${state.currentBidQty}:${nextFace}` },
            colorHex: '#38BDF8',
            textColor: '#082F49',
          });
        }
        if (nextQty + 1 <= totalDice) {
          extraActions.push({
            label: `BID ${nextQty + 1}× ⚅`,
            labelZh: `加码 ${nextQty + 1}个6`,
            action: { type: 'custom', id: 'bid', payload: `${nextQty + 1}:6` },
            colorHex: '#F59E0B',
            textColor: '#141008',
          });
        }
        if (state.currentBidQty > 0) {
          secondaryBtn = {
            label: 'CALL LIAR! 开骰',
            labelZh: '开骰抓吹牛！',
            action: { type: 'call-bluff' },
            colorHex: '#EF4444',
            textColor: '#FFFFFF',
          };
        }
      }
      out[seat.id] = {
        gameId: 'liars-dice-tavern',
        playerId: seat.id,
        hand,
        cursorIndex: 0,
        isMyTurn: isTurn,
        isActionRequired: isTurn,
        turnTimeLeft: state.turnTimeLeft,
        turnTotal: state.turnTotal,
        badgeText: state.pureMode ? 'PURE MODE 齋' : '1s ARE WILD',
        badgeColorHex: '#F59E0B',
        extraActions,
        secondaryBtn,
        statusHint: isTurn
          ? 'Raise the bid or CALL LIAR to open all cups!'
          : `Secret Dice (${seat.dice.length}) · Waiting for ${active?.name ?? ''}`,
        statusHintZh: isTurn
          ? '加注叫骰，或点击「开骰」拆穿吹牛！'
          : `秘密骰子 (${seat.dice.length} 颗) · 等待 ${active?.name ?? ''}`,
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action, players) {
    if (state.phase !== 'bidding') return { sounds: [] };
    const seat = state.seats.find((s) => s.id === playerId);
    if (!seat || state.seats[state.activeIdx]?.id !== playerId) return { sounds: [] };

    const totalDice = Math.max(
      2,
      state.seats.reduce((sum, s) => sum + (s.alive ? s.dice.length : 0), 0)
    );
    if (action.type === 'call-bluff' && state.currentBidQty > 0) {
      resolveLiarCall(state, seat, isStateFrenzyActive(state));
    } else if (action.type === 'custom' && action.id === 'bid' && action.payload) {
      const [qStr, fStr] = action.payload.split(':');
      const q = Number(qStr);
      const f = Number(fStr);
      if (
        Number.isFinite(q) &&
        Number.isFinite(f) &&
        q >= 1 &&
        q <= totalDice &&
        f >= 1 &&
        f <= 6 &&
        (q > state.currentBidQty || (q === state.currentBidQty && f > state.currentBidFace))
      ) {
        state.currentBidQty = q;
        state.currentBidFace = f;
        if (f === 1) state.pureMode = true;
        state.lastBidderId = seat.id;
        seat.lastAction = `${q}×${DICE_GLYPHS[f]}`;
        state.activeIdx = nextAliveTavernIdx(state, state.activeIdx);
        state.turnTimeLeft = state.turnTotal;
        state.botTimer = 0.9;
        state.pendingSounds.push({ type: 'tick', playerId: seat.id });
      }
    }
    return { sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
  },
  step(state, players, dt, frenzyActive) {
    tickCardFx(state.flyingCards, state.shockwaves, state.popups, dt);
    if (state.phase === 'reveal') {
      state.revealTimer -= dt;
      if (state.revealTimer <= 0) {
        const alive = state.seats.filter((s) => s.alive);
        if (alive.length <= 1 || state.round >= state.totalRounds) {
          for (const s of alive) s.score += 300;
          return { finished: true, sounds: state.pendingSounds.splice(0) };
        }
        state.round++;
        rollTavernRound(state);
        return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
      }
      return { finished: false, sounds: state.pendingSounds.splice(0) };
    }

    const active = state.seats[state.activeIdx];
    const inp = players.find((p) => p.id === active?.id);
    const isBot = Boolean(inp?.isBot || active?.isBot);
    state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
    if (isBot) state.botTimer -= dt;

    if (active && (state.turnTimeLeft <= 0 || (isBot && state.botTimer <= 0))) {
      const totalDice = state.seats.reduce((sum, s) => sum + (s.alive ? s.dice.length : 0), 0);
      const expectedMax = Math.ceil(totalDice * 0.42);
      const nextQty = state.currentBidQty === 0 ? Math.max(2, Math.floor(totalDice * 0.25)) : state.currentBidQty + 1;
      const challengeProb = Math.max(
        0.05,
        Math.min(
          0.95,
          0.28 +
            (UNIVERSAL_BOT_PROFILES.arcade.evaluationNoise -
              getUniversalBotProfile(active.botDifficulty).evaluationNoise) *
              0.5
        )
      );
      if (state.currentBidQty > 0 && (state.currentBidQty >= expectedMax || nextQty > totalDice || Math.random() < challengeProb)) {
        resolveLiarCall(state, active, frenzyActive);
      } else {
        const bestFace = [2, 3, 4, 5, 6].sort(
          (a, b) => active.dice.filter((d) => d === b).length - active.dice.filter((d) => d === a).length
        )[0];
        state.currentBidQty = Math.min(totalDice, nextQty);
        state.currentBidFace = bestFace;
        state.lastBidderId = active.id;
        active.lastAction = `${state.currentBidQty}×${DICE_GLYPHS[bestFace]}`;
        state.activeIdx = nextAliveTavernIdx(state, state.activeIdx);
        state.turnTimeLeft = state.turnTotal;
        state.botTimer = 0.95;
        state.pendingSounds.push({ type: 'tick', playerId: active.id });
      }
      return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
    }

    return { finished: false, sounds: state.pendingSounds.splice(0) };
  },
  snapshot(state): LiarsDiceTavernSnapshot {
    const bidder = state.seats.find((s) => s.id === state.lastBidderId);
    return {
      gameId: 'liars-dice-tavern',
      round: state.round,
      totalRounds: state.totalRounds,
      phase: state.phase,
      activePlayerId: state.seats[state.activeIdx]?.id ?? '',
      currentBidQty: state.currentBidQty,
      currentBidFace: state.currentBidFace,
      pureMode: state.pureMode,
      lastBidderName: bidder?.name ?? null,
      totalMatchingDice: state.totalMatchingDice,
      turnTimeLeft: state.turnTimeLeft,
      turnTotal: state.turnTotal,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: state.flyingCards.map((f) => ({ ...f })),
      shockwaves: state.shockwaves.map((s) => ({ ...s })),
      popups: state.popups.map((p) => ({ ...p })),
      players: state.seats.map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        colorHex: s.colorHex,
        isBot: s.isBot,
        diceCount: s.dice.length,
        revealedDice: state.phase === 'reveal' ? [...s.dice] : [],
        alive: s.alive,
        score: s.score,
        lastAction: s.lastAction,
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.seats.map((s) => ({ id: s.id, score: s.score + s.dice.length * 40, stat: `${s.dice.length} Dice · ${s.score} pts` }))
    );
  },
};

// ============================================================
// 72. SPY WORD (谁是卧底)
// ============================================================
const SPY_WORD_PAIRS: {
  civ: string;
  spy: string;
  cluesCiv: string[];
  cluesSpy: string[];
}[] = [
  {
    civ: 'Milk Tea 奶茶',
    spy: 'Latte Coffee 拿铁咖啡',
    cluesCiv: ['Sweet & Creamy 甜香顺滑', 'Popular with Pearls 常加珍珠', 'Afternoon Treat 下午茶最爱', 'Served Cold or Hot 冷热皆宜'],
    cluesSpy: ['Rich Aroma 浓郁香气', 'Morning Wake-Up 早晨提神', 'Served Cold or Hot 冷热皆宜', 'Cafe Classic 咖啡馆必备'],
  },
  {
    civ: 'Hotpot 火锅',
    spy: 'Korean BBQ 烤肉',
    cluesCiv: ['Great with Friends 聚会必吃', 'Dipping Sauce 灵魂蘸料', 'Boiling Pot 越煮越香', 'Sliced Beef 必点肥牛'],
    cluesSpy: ['Great with Friends 聚会必吃', 'Sizzling Grill 滋滋冒油', 'Smoky Flavor 炭火香气', 'Sliced Beef 必点肥牛'],
  },
  {
    civ: 'Panda 大熊猫',
    spy: 'Koala 考拉',
    cluesCiv: ['Loves Eating Plants 爱吃植物', 'Black & White 黑白配色', 'Cute & Sleepy 呆萌爱睡', 'National Icon 国宝萌宠'],
    cluesSpy: ['Loves Eating Plants 爱吃植物', 'Lives in Trees 挂在树上', 'Cute & Sleepy 呆萌爱睡', 'Grey & Fluffy 毛茸茸'],
  },
  {
    civ: 'Watermelon 西瓜',
    spy: 'Mango 芒果',
    cluesCiv: ['Summer Fruit 夏日解暑', 'Juicy & Sweet 清甜多汁', 'Green Outside 绿皮红瓤', 'Chilled Slice 冰镇超爽'],
    cluesSpy: ['Summer Fruit 夏日解暑', 'Juicy & Sweet 清甜多汁', 'Golden Yellow 金黄果肉', 'Tropical Scent 热带果香'],
  },
  {
    civ: 'KTV 卡拉OK',
    spy: 'Cinema 电影院',
    cluesCiv: ['Private Room 好友包厢', 'Night Hangout 夜间娱乐', 'Big Screen 大屏幕体验', 'Sing Out Loud 放声嗨唱'],
    cluesSpy: ['Dark Room 关灯沉浸', 'Night Hangout 夜间娱乐', 'Big Screen 大屏幕体验', 'Popcorn Snack 爆米花标配'],
  },
];

interface SpySeat {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  isSpy: boolean;
  alive: boolean;
  clueSubmitted: string | null;
  voteTargetId: string | null;
  score: number;
}

interface SpyWordState {
  round: number;
  totalRounds: number;
  phase: 'clue' | 'vote' | 'reveal';
  pairIdx: number;
  seats: SpySeat[];
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pendingSounds: SoundEvent[];
}

function setupSpyRound(state: SpyWordState) {
  state.pairIdx = Math.floor(Math.random() * SPY_WORD_PAIRS.length);
  const spyIndex = Math.floor(Math.random() * state.seats.length);
  state.seats.forEach((s, i) => {
    s.isSpy = i === spyIndex;
    s.alive = true;
    s.clueSubmitted = null;
    s.voteTargetId = null;
  });
  state.phase = 'clue';
  state.turnTotal = 14;
  state.turnTimeLeft = 14;
  state.banner = `ROUND ${state.round}/${state.totalRounds} — CHECK YOUR SECRET WORD & PICK A CLUE!`;
  state.bannerColor = '#8B5CF6';
}

function resolveSpyVote(state: SpyWordState, frenzy: boolean) {
  const tally = new Map<string, number>();
  for (const s of state.seats) {
    if (s.voteTargetId) tally.set(s.voteTargetId, (tally.get(s.voteTargetId) ?? 0) + 1);
  }
  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const exiledId = sorted[0]?.[0];
  const exiled = state.seats.find((s) => s.id === exiledId);
  const spy = state.seats.find((s) => s.isSpy);
  const mult = frenzy ? 2 : 1;

  if (exiled && exiled.isSpy) {
    for (const s of state.seats) if (!s.isSpy) s.score += 220 * mult;
    state.banner = `SPY CAUGHT! ${exiled.name} WAS THE UNDERCOVER!`;
    state.bannerColor = '#10D98B';
    state.pendingSounds.push({ type: 'win' });
  } else {
    if (spy) spy.score += 360 * mult;
    state.banner = `WRONG VOTE! ${spy?.name ?? 'THE SPY'} ESCAPED UNDETECTED!`;
    state.bannerColor = '#EF4444';
    state.pendingSounds.push({ type: 'hit' });
  }
  state.phase = 'reveal';
  state.turnTotal = 4.0;
  state.turnTimeLeft = 4.0;
}

export const undercoverWordModule: ServerGameModule<SpyWordState, UndercoverWordSnapshot> = {
  id: 'undercover-word',
  init(ctx): SpyWordState {
    const seats: SpySeat[] = ctx.players.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.colorHex,
      isBot: p.isBot,
      isSpy: false,
      alive: true,
      clueSubmitted: null,
      voteTargetId: null,
      score: 0,
    }));
    const st: SpyWordState = {
      round: 1,
      totalRounds: ctx.settingValue || 3,
      phase: 'clue',
      pairIdx: 0,
      seats,
      turnTimeLeft: 14,
      turnTotal: 14,
      banner: null,
      bannerColor: null,
      flyingCards: [],
      shockwaves: [],
      popups: [],
      pendingSounds: [],
    };
    setupSpyRound(st);
    return st;
  },
  getPrivateStates(state): Record<string, CardPrivateState> {
    const out: Record<string, CardPrivateState> = {};
    const pair = SPY_WORD_PAIRS[state.pairIdx];
    for (const seat of state.seats) {
      const myWord = seat.isSpy ? pair.spy : pair.civ;
      const cluePool = seat.isSpy ? pair.cluesSpy : pair.cluesCiv;
      const hand: CardPrivateHandItem[] =
        state.phase === 'clue'
          ? cluePool.map((cl, i) => ({
              id: `cl_${i}`,
              kind: 'party',
              title: cl.split(' ')[0],
              subtitle: cl,
              badge: 'CLUE',
              accentHex: '#8B5CF6',
              playable: !seat.clueSubmitted,
              selected: seat.clueSubmitted === cl,
            }))
          : state.phase === 'vote'
          ? state.seats
              .filter((o) => o.id !== seat.id)
              .map((o) => ({
                id: `vt_${o.id}`,
                kind: 'party',
                title: o.name,
                subtitle: o.clueSubmitted ?? 'Silent',
                badge: 'VOTE',
                accentHex: o.colorHex,
                playable: !seat.voteTargetId,
                selected: seat.voteTargetId === o.id,
              }))
          : [];

      out[seat.id] = {
        gameId: 'undercover-word',
        playerId: seat.id,
        hand,
        cursorIndex: 0,
        isMyTurn: (state.phase === 'clue' && !seat.clueSubmitted) || (state.phase === 'vote' && !seat.voteTargetId),
        isActionRequired: (state.phase === 'clue' && !seat.clueSubmitted) || (state.phase === 'vote' && !seat.voteTargetId),
        turnTimeLeft: state.turnTimeLeft,
        turnTotal: state.turnTotal,
        badgeText: `SECRET: ${myWord}`,
        badgeColorHex: '#8B5CF6',
        statusHint:
          state.phase === 'clue'
            ? `Your secret word: ${myWord} — Tap a clue card!`
            : state.phase === 'vote'
            ? 'Tap who you think is the hidden SPY!'
            : 'Revealing secret words on TV...',
        statusHintZh:
          state.phase === 'clue'
            ? `你的秘密词：${myWord} — 点击一张线索卡发言！`
            : state.phase === 'vote'
            ? '点击你怀疑的卧底玩家进行投票！'
            : '大屏正在揭晓卧底与秘密词...',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action, players) {
    const seat = state.seats.find((s) => s.id === playerId);
    if (!seat || (action.type !== 'play-card' && action.type !== 'toggle-card') || !action.cardId) {
      return { sounds: [] };
    }
    const pair = SPY_WORD_PAIRS[state.pairIdx];
    if (state.phase === 'clue' && !seat.clueSubmitted && action.cardId.startsWith('cl_')) {
      const idx = Number(action.cardId.slice(3));
      const pool = seat.isSpy ? pair.cluesSpy : pair.cluesCiv;
      seat.clueSubmitted = pool[idx] ?? pool[0];
      state.pendingSounds.push({ type: 'tick', playerId: seat.id });
    } else if (state.phase === 'vote' && !seat.voteTargetId && action.cardId.startsWith('vt_')) {
      seat.voteTargetId = action.cardId.slice(3);
      state.pendingSounds.push({ type: 'tick', playerId: seat.id });
    }
    return { sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
  },
  step(state, players, dt, frenzyActive) {
    tickCardFx(state.flyingCards, state.shockwaves, state.popups, dt);
    state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
    const pair = SPY_WORD_PAIRS[state.pairIdx];
    const botIds = new Set(players.filter((p) => p.isBot).map((p) => p.id));

    if (state.phase === 'clue') {
      // Bots submit clues quickly
      if (state.turnTimeLeft < state.turnTotal - 1.5) {
        for (const s of state.seats) {
          if (!s.clueSubmitted && (s.isBot || botIds.has(s.id))) {
            const pool = s.isSpy ? pair.cluesSpy : pair.cluesCiv;
            s.clueSubmitted = pool[Math.floor(Math.random() * pool.length)];
          }
        }
      }
      if (state.turnTimeLeft <= 0 || state.seats.every((s) => Boolean(s.clueSubmitted))) {
        for (const s of state.seats) {
          if (!s.clueSubmitted) s.clueSubmitted = (s.isSpy ? pair.cluesSpy : pair.cluesCiv)[0];
        }
        state.phase = 'vote';
        state.turnTotal = 14;
        state.turnTimeLeft = 14;
        state.banner = 'CLUES ARE IN! VOTE OUT THE SPY!';
        return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
      }
    } else if (state.phase === 'vote') {
      if (state.turnTimeLeft < state.turnTotal - 2.0) {
        for (const s of state.seats) {
          if (!s.voteTargetId && (s.isBot || botIds.has(s.id))) {
            const others = state.seats.filter((o) => o.id !== s.id);
            const pick = others[Math.floor(Math.random() * others.length)];
            s.voteTargetId = pick?.id ?? null;
          }
        }
      }
      if (state.turnTimeLeft <= 0 || state.seats.every((s) => Boolean(s.voteTargetId))) {
        resolveSpyVote(state, frenzyActive);
        return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
      }
    } else if (state.turnTimeLeft <= 0) {
      if (state.round >= state.totalRounds) return { finished: true, sounds: state.pendingSounds.splice(0) };
      state.round++;
      setupSpyRound(state);
      return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
    }
    return { finished: false, sounds: state.pendingSounds.splice(0) };
  },
  snapshot(state): UndercoverWordSnapshot {
    const pair = SPY_WORD_PAIRS[state.pairIdx];
    const votesByTarget = new Map<string, number>();
    for (const s of state.seats) {
      if (s.voteTargetId) votesByTarget.set(s.voteTargetId, (votesByTarget.get(s.voteTargetId) ?? 0) + 1);
    }
    return {
      gameId: 'undercover-word',
      round: state.round,
      totalRounds: state.totalRounds,
      phase: state.phase,
      civilianWordRevealed: state.phase === 'reveal' ? pair.civ : null,
      spyWordRevealed: state.phase === 'reveal' ? pair.spy : null,
      turnTimeLeft: state.turnTimeLeft,
      turnTotal: state.turnTotal,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: state.flyingCards.map((f) => ({ ...f })),
      shockwaves: state.shockwaves.map((s) => ({ ...s })),
      popups: state.popups.map((p) => ({ ...p })),
      players: state.seats.map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        colorHex: s.colorHex,
        isBot: s.isBot,
        alive: s.alive,
        clueSubmitted: s.clueSubmitted,
        votesReceived: votesByTarget.get(s.id) ?? 0,
        hasVoted: Boolean(s.voteTargetId),
        revealedRole: state.phase === 'reveal' ? (s.isSpy ? 'spy' : 'civilian') : null,
        score: s.score,
      })),
    };
  },
  buildResults(state) {
    return buildRankings(state.seats.map((s) => ({ id: s.id, score: s.score, stat: `${s.score} pts` })));
  },
};

// ============================================================
// 73. MIDNIGHT WEREWOLF (狼人杀极速版)
// ============================================================
type WolfRole = 'werewolf' | 'seer' | 'guard' | 'villager';

interface WolfSeat {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  role: WolfRole;
  alive: boolean;
  nightTargetId: string | null;
  seerIntel: string | null;
  seerIntelZh: string | null;
  voteTargetId: string | null;
  score: number;
}

interface MidnightWerewolfState {
  dayNumber: number;
  nightDuration: number;
  phase: 'night' | 'dawn' | 'vote' | 'end';
  dawnReport: string | null;
  seats: WolfSeat[];
  turnTimeLeft: number;
  turnTotal: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pendingSounds: SoundEvent[];
}

function checkWolfWinner(state: MidnightWerewolfState, frenzy: boolean): boolean {
  const wolves = state.seats.filter((s) => s.alive && s.role === 'werewolf');
  const village = state.seats.filter((s) => s.alive && s.role !== 'werewolf');
  const mult = frenzy ? 2 : 1;
  if (wolves.length === 0) {
    for (const s of state.seats) if (s.role !== 'werewolf') s.score += 360 * mult;
    state.banner = 'VILLAGE WINS! ALL WEREWOLVES EXILED!';
    state.bannerColor = '#10D98B';
    state.phase = 'end';
    state.turnTimeLeft = 3.2;
    state.pendingSounds.push({ type: 'win' });
    return true;
  }
  if (wolves.length >= village.length) {
    for (const s of state.seats) if (s.role === 'werewolf') s.score += 420 * mult;
    state.banner = 'WEREWOLVES WIN THE MIDNIGHT HUNT!';
    state.bannerColor = '#EF4444';
    state.phase = 'end';
    state.turnTimeLeft = 3.2;
    state.pendingSounds.push({ type: 'elim' });
    return true;
  }
  return false;
}

export const midnightWerewolfModule: ServerGameModule<MidnightWerewolfState, MidnightWerewolfSnapshot> = {
  id: 'midnight-werewolf',
  init(ctx): MidnightWerewolfState {
    const nightDuration = ctx.settingValue || 12;
    const n = ctx.players.length;
    const wolfCount = n >= 6 ? 2 : 1;
    const roles: WolfRole[] = [];
    for (let i = 0; i < wolfCount; i++) roles.push('werewolf');
    if (roles.length < n) roles.push('seer');
    if (roles.length < n) roles.push('guard');
    while (roles.length < n) roles.push('villager');
    for (let i = roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roles[i], roles[j]] = [roles[j], roles[i]];
    }
    return {
      dayNumber: 1,
      nightDuration,
      phase: 'night',
      dawnReport: null,
      seats: ctx.players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: p.isBot,
        role: roles[i],
        alive: true,
        nightTargetId: null,
        seerIntel: null,
        seerIntelZh: null,
        voteTargetId: null,
        score: 0,
      })),
      turnTimeLeft: nightDuration,
      turnTotal: nightDuration,
      banner: 'NIGHT 1 — CHECK YOUR SECRET ROLE & ACT!',
      bannerColor: '#6366F1',
      flyingCards: [],
      shockwaves: [],
      popups: [],
      pendingSounds: [],
    };
  },
  getPrivateStates(state): Record<string, CardPrivateState> {
    const out: Record<string, CardPrivateState> = {};
    const roleLabelEn: Record<WolfRole, string> = {
      werewolf: 'WEREWOLF',
      seer: 'SEER',
      guard: 'GUARD',
      villager: 'VILLAGER',
    };
    const roleLabelZh: Record<WolfRole, string> = {
      werewolf: '狼人',
      seer: '预言家',
      guard: '守卫',
      villager: '村民',
    };
    for (const seat of state.seats) {
      const canActNight =
        state.phase === 'night' && seat.alive && seat.role !== 'villager' && !seat.nightTargetId;
      const canVote = state.phase === 'vote' && seat.alive && !seat.voteTargetId;
      const targets = state.seats.filter((o) => o.alive && (seat.role === 'guard' || o.id !== seat.id));

      const hand: CardPrivateHandItem[] =
        canActNight || canVote
          ? targets.map((t) => ({
              id: `tg_${t.id}`,
              kind: 'party',
              title: t.name,
              subtitle:
                state.phase === 'night'
                  ? seat.role === 'werewolf'
                    ? 'HUNT TARGET'
                    : seat.role === 'seer'
                    ? 'PEEK ROLE'
                    : 'SHIELD'
                  : 'EXILE VOTE',
              badge: `P${t.slotIndex + 1}`,
              accentHex: t.colorHex,
              playable: true,
              selected: false,
            }))
          : [];

      out[seat.id] = {
        gameId: 'midnight-werewolf',
        playerId: seat.id,
        hand,
        cursorIndex: 0,
        isMyTurn: canActNight || canVote,
        isActionRequired: canActNight || canVote,
        turnTimeLeft: state.turnTimeLeft,
        turnTotal: state.turnTotal,
        badgeText: roleLabelEn[seat.role],
        badgeColorHex: seat.role === 'werewolf' ? '#EF4444' : seat.role === 'seer' ? '#A855F7' : '#38BDF8',
        statusHint: seat.seerIntel
          ? `SEER VISION: ${seat.seerIntel}`
          : canActNight
          ? `Night Action (${roleLabelEn[seat.role]}): Tap a player!`
          : canVote
          ? 'Day Vote: Tap who you want to exile!'
          : !seat.alive
          ? 'Eliminated — Watch the village debate!'
          : 'Waiting for the village...',
        statusHintZh: seat.seerIntelZh
          ? `预言家查验：${seat.seerIntelZh}`
          : canActNight
          ? `黑夜行动（${roleLabelZh[seat.role]}）：点击目标玩家！`
          : canVote
          ? '白天投票：点击你想放逐的玩家！'
          : !seat.alive
          ? '已出局 — 观看村庄辩论！'
          : '等待村庄进入下一阶段...',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action, players) {
    const seat = state.seats.find((s) => s.id === playerId);
    if (!seat || !seat.alive || (action.type !== 'play-card' && action.type !== 'toggle-card') || !action.cardId?.startsWith('tg_')) {
      return { sounds: [] };
    }
    const targetId = action.cardId.slice(3);
    if (state.phase === 'night' && seat.role !== 'villager' && !seat.nightTargetId) {
      seat.nightTargetId = targetId;
      if (seat.role === 'seer') {
        const tgt = state.seats.find((s) => s.id === targetId);
        if (tgt) {
          seat.seerIntel = `${tgt.name} IS ${tgt.role === 'werewolf' ? 'WEREWOLF!' : 'GOOD!'}`;
          seat.seerIntelZh = `${tgt.name} 是${tgt.role === 'werewolf' ? '狼人！' : '好人！'}`;
        }
      }
      state.pendingSounds.push({ type: 'tick', playerId: seat.id });
    } else if (state.phase === 'vote' && !seat.voteTargetId) {
      seat.voteTargetId = targetId;
      state.pendingSounds.push({ type: 'tick', playerId: seat.id });
    }
    return { sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
  },
  step(state, players, dt, frenzyActive) {
    tickCardFx(state.flyingCards, state.shockwaves, state.popups, dt);
    state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt);
    const botIds = new Set(players.filter((p) => p.isBot).map((p) => p.id));

    if (state.phase === 'night') {
      if (state.turnTimeLeft < state.turnTotal - 1.5) {
        for (const s of state.seats) {
          if (s.alive && s.role !== 'villager' && !s.nightTargetId && (s.isBot || botIds.has(s.id))) {
            const pool = state.seats.filter((o) => o.alive && o.id !== s.id && (s.role !== 'werewolf' || o.role !== 'werewolf'));
            const pick = pool[Math.floor(Math.random() * pool.length)];
            s.nightTargetId = pick?.id ?? null;
          }
        }
      }
      const allActed = state.seats.every((s) => !s.alive || s.role === 'villager' || Boolean(s.nightTargetId));
      if (state.turnTimeLeft <= 0 || allActed) {
        const wolfTarget = state.seats.find((s) => s.alive && s.role === 'werewolf' && s.nightTargetId)?.nightTargetId;
        const guardTarget = state.seats.find((s) => s.alive && s.role === 'guard' && s.nightTargetId)?.nightTargetId;
        if (wolfTarget && wolfTarget !== guardTarget) {
          const victim = state.seats.find((s) => s.id === wolfTarget);
          if (victim) {
            victim.alive = false;
            state.dawnReport = `DAWN REPORT: ${victim.name} WAS ELIMINATED OVERNIGHT!`;
          }
        } else {
          state.dawnReport = 'PEACEFUL NIGHT! NOBODY WAS ELIMINATED!';
          const guard = state.seats.find((s) => s.alive && s.role === 'guard');
          if (guard && wolfTarget && wolfTarget === guardTarget) guard.score += 120;
        }
        state.banner = state.dawnReport;
        state.bannerColor = '#F59E0B';
        if (!checkWolfWinner(state, frenzyActive)) {
          state.phase = 'vote';
          state.turnTotal = 16;
          state.turnTimeLeft = 16;
          for (const s of state.seats) s.voteTargetId = null;
        }
        return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
      }
    } else if (state.phase === 'vote') {
      if (state.turnTimeLeft < state.turnTotal - 2.0) {
        for (const s of state.seats) {
          if (s.alive && !s.voteTargetId && (s.isBot || botIds.has(s.id))) {
            const pool = state.seats.filter((o) => o.alive && o.id !== s.id);
            s.voteTargetId = pool[Math.floor(Math.random() * pool.length)]?.id ?? null;
          }
        }
      }
      const allVoted = state.seats.every((s) => !s.alive || Boolean(s.voteTargetId));
      if (state.turnTimeLeft <= 0 || allVoted) {
        const counts = new Map<string, number>();
        for (const s of state.seats) {
          if (s.alive && s.voteTargetId) counts.set(s.voteTargetId, (counts.get(s.voteTargetId) ?? 0) + 1);
        }
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        if (top) {
          const exiled = state.seats.find((s) => s.id === top[0]);
          if (exiled) {
            exiled.alive = false;
            state.dawnReport = `VILLAGE EXILED ${exiled.name}!`;
            state.banner = state.dawnReport;
          }
        }
        if (!checkWolfWinner(state, frenzyActive)) {
          state.dayNumber++;
          state.phase = 'night';
          state.turnTotal = state.nightDuration;
          state.turnTimeLeft = state.nightDuration;
          for (const s of state.seats) s.nightTargetId = null;
          state.banner = `NIGHT ${state.dayNumber} FALLS — SPECIAL ROLES ACT!`;
          state.bannerColor = '#6366F1';
        }
        return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
      }
    } else if (state.phase === 'end' && state.turnTimeLeft <= 0) {
      return { finished: true, sounds: state.pendingSounds.splice(0) };
    }
    return { finished: false, sounds: state.pendingSounds.splice(0) };
  },
  snapshot(state): MidnightWerewolfSnapshot {
    const votes = new Map<string, number>();
    for (const s of state.seats) {
      if (s.alive && s.voteTargetId) votes.set(s.voteTargetId, (votes.get(s.voteTargetId) ?? 0) + 1);
    }
    return {
      gameId: 'midnight-werewolf',
      dayNumber: state.dayNumber,
      phase: state.phase,
      dawnReport: state.dawnReport,
      turnTimeLeft: state.turnTimeLeft,
      turnTotal: state.turnTotal,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: state.flyingCards.map((f) => ({ ...f })),
      shockwaves: state.shockwaves.map((s) => ({ ...s })),
      popups: state.popups.map((p) => ({ ...p })),
      players: state.seats.map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        colorHex: s.colorHex,
        isBot: s.isBot,
        alive: s.alive,
        actedNight: Boolean(s.nightTargetId),
        hasVoted: Boolean(s.voteTargetId),
        votesReceived: votes.get(s.id) ?? 0,
        revealedRole: state.phase === 'end' || !s.alive ? s.role : null,
        score: s.score,
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.seats.map((s) => ({ id: s.id, score: s.score + (s.alive ? 80 : 0), stat: `${s.role.toUpperCase()} · ${s.score} pts` }))
    );
  },
};

// ============================================================
// 74. WORD CHAIN (成语/词语接龙)
// ============================================================
const CHAIN_LINKS: { en: string; zh: string; nextEn: string; nextZh: string; decoys: { en: string; zh: string }[] }[] = [
  {
    en: 'DRAGON', zh: '一马当先', nextEn: 'NEON', nextZh: '先见之明',
    decoys: [{ en: 'TIGER', zh: '画龙点睛' }, { en: 'CLOUD', zh: '步步高升' }, { en: 'SPARK', zh: '水落石出' }],
  },
  {
    en: 'NEON', zh: '先见之明', nextEn: 'NIGHT', nextZh: '明察秋毫',
    decoys: [{ en: 'FLAME', zh: '一帆风顺' }, { en: 'RIVER', zh: '花好月圆' }, { en: 'APPLE', zh: '万事如意' }],
  },
  {
    en: 'NIGHT', zh: '明察秋毫', nextEn: 'TIGER', nextZh: '毫不犹豫',
    decoys: [{ en: 'STAR', zh: '金玉满堂' }, { en: 'OCEAN', zh: '心想事成' }, { en: 'CROWN', zh: '龙马精神' }],
  },
  {
    en: 'TIGER', zh: '毫不犹豫', nextEn: 'ROCKET', nextZh: '豫章故郡',
    decoys: [{ en: 'MELON', zh: '欢天喜地' }, { en: 'LASER', zh: '大展宏图' }, { en: 'PEARL', zh: '春暖花开' }],
  },
  {
    en: 'ROCKET', zh: '金玉满堂', nextEn: 'THUNDER', nextZh: '堂堂正正',
    decoys: [{ en: 'MAGIC', zh: '飞黄腾达' }, { en: 'LOTUS', zh: '风调雨顺' }, { en: 'COMET', zh: '吉祥如意' }],
  },
  {
    en: 'THUNDER', zh: '堂堂正正', nextEn: 'RAINBOW', nextZh: '正大光明',
    decoys: [{ en: 'PANDA', zh: '喜气洋洋' }, { en: 'STORM', zh: '招财进宝' }, { en: 'BLAZE', zh: '福星高照' }],
  },
  {
    en: 'RAINBOW', zh: '正大光明', nextEn: 'WIZARD', nextZh: '明目张胆',
    decoys: [{ en: 'JADE', zh: '年年有余' }, { en: 'FROST', zh: '恭喜发财' }, { en: 'ORBIT', zh: '五福临门' }],
  },
  {
    en: 'WIZARD', zh: '龙马精神', nextEn: 'DRAGON', nextZh: '神采飞扬',
    decoys: [{ en: 'BREEZE', zh: '一帆风顺' }, { en: 'FLARE', zh: '步步高升' }, { en: 'PHOENIX', zh: '万事大吉' }],
  },
];

interface ChainSeat {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  alive: boolean;
  streak: number;
  score: number;
  lastAction: string | null;
}

interface IdiomChainState {
  round: number;
  baseTurnTime: number;
  seats: ChainSeat[];
  activeIdx: number;
  linkIdx: number;
  choices: { id: string; en: string; zh: string; correct: boolean }[];
  history: { en: string; zh: string; byName: string; colorHex: string }[];
  chainLength: number;
  turnTimeLeft: number;
  turnTotal: number;
  botTimer: number;
  banner: string | null;
  bannerColor: string | null;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  pendingSounds: SoundEvent[];
}

function prepChainChoices(state: IdiomChainState) {
  const link = CHAIN_LINKS[state.linkIdx % CHAIN_LINKS.length];
  const raw = [
    { id: 'ch_ok', en: link.nextEn, zh: link.nextZh, correct: true },
    ...link.decoys.map((d, i) => ({ id: `ch_no_${i}`, en: d.en, zh: d.zh, correct: false })),
  ];
  for (let i = raw.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [raw[i], raw[j]] = [raw[j], raw[i]];
  }
  state.choices = raw;
  state.turnTotal = Math.max(3.5, state.baseTurnTime - state.chainLength * 0.25);
  state.turnTimeLeft = state.turnTotal;
  state.botTimer = 1.1 + Math.random() * 0.7;
}

function advanceChainPlayer(state: IdiomChainState) {
  for (let i = 1; i <= state.seats.length; i++) {
    const idx = (state.activeIdx + i) % state.seats.length;
    if (state.seats[idx].alive) {
      state.activeIdx = idx;
      return;
    }
  }
}

export const idiomChainModule: ServerGameModule<IdiomChainState, IdiomChainSnapshot> = {
  id: 'idiom-chain',
  init(ctx): IdiomChainState {
    const baseTurnTime = ctx.settingValue || 8;
    const st: IdiomChainState = {
      round: 1,
      baseTurnTime,
      seats: ctx.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: p.isBot,
        botDifficulty: p.botDifficulty,
        alive: true,
        streak: 0,
        score: 0,
        lastAction: null,
      })),
      activeIdx: 0,
      linkIdx: 0,
      choices: [],
      history: [],
      chainLength: 0,
      turnTimeLeft: baseTurnTime,
      turnTotal: baseTurnTime,
      botTimer: 1.2,
      banner: 'MATCH THE GOLD ENDING LETTER / CHARACTER!',
      bannerColor: '#F97316',
      flyingCards: [],
      shockwaves: [],
      popups: [],
      pendingSounds: [],
    };
    prepChainChoices(st);
    return st;
  },
  getPrivateStates(state): Record<string, CardPrivateState> {
    const out: Record<string, CardPrivateState> = {};
    const active = state.seats[state.activeIdx];
    const link = CHAIN_LINKS[state.linkIdx % CHAIN_LINKS.length];
    const endEn = link.en.slice(-1);
    const endZh = link.zh.slice(-1);

    for (const seat of state.seats) {
      const isTurn = seat.alive && active?.id === seat.id;
      out[seat.id] = {
        gameId: 'idiom-chain',
        playerId: seat.id,
        hand: isTurn
          ? state.choices.map((c) => ({
              id: c.id,
              kind: 'party',
              title: c.zh,
              subtitle: c.en,
              badge: `${c.en[0]} / ${c.zh[0]}`,
              accentHex: '#F97316',
              playable: true,
              selected: false,
            }))
          : [],
        cursorIndex: 0,
        isMyTurn: isTurn,
        isActionRequired: isTurn,
        turnTimeLeft: state.turnTimeLeft,
        turnTotal: state.turnTotal,
        badgeText: `LINK: ${endEn} / ${endZh}`,
        badgeColorHex: '#FACC15',
        statusHint: isTurn
          ? `Pick the word starting with "${endEn}" / "${endZh}"!`
          : `Watching ${active?.name ?? ''}...`,
        statusHintZh: isTurn
          ? `选出以「${endZh}」/「${endEn}」开头的接龙词！`
          : `正在观看 ${active?.name ?? ''} 接龙...`,
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action, players) {
    const active = state.seats[state.activeIdx];
    if (!active || active.id !== playerId || (action.type !== 'play-card' && action.type !== 'toggle-card') || !action.cardId) {
      return { sounds: [] };
    }
    const picked = state.choices.find((c) => c.id === action.cardId);
    if (!picked) return { sounds: [] };

    if (picked.correct) {
      active.streak++;
      const mult = isStateFrenzyActive(state) ? 2 : 1;
      const pts = (110 + active.streak * 25) * mult;
      active.score += pts;
      active.lastAction = `${picked.zh} +${pts}`;
      state.history.push({ en: picked.en, zh: picked.zh, byName: active.name, colorHex: active.colorHex });
      if (state.history.length > 5) state.history.shift();
      state.chainLength++;
      state.linkIdx = (state.linkIdx + 1) % CHAIN_LINKS.length;
      state.banner = `${active.name} LINKED: ${picked.zh} (${picked.en})!`;
      state.bannerColor = '#10D98B';
      state.pendingSounds.push({ type: 'score', playerId: active.id });
      advanceChainPlayer(state);
      prepChainChoices(state);
    } else {
      active.alive = false;
      active.lastAction = 'WRONG LINK!';
      state.banner = `${active.name} BROKE THE CHAIN!`;
      state.bannerColor = '#EF4444';
      state.pendingSounds.push({ type: 'elim', playerId: active.id });
      advanceChainPlayer(state);
      prepChainChoices(state);
    }
    return { sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
  },
  step(state, players, dt, frenzyActive) {
    tickCardFx(state.flyingCards, state.shockwaves, state.popups, dt);
    const alive = state.seats.filter((s) => s.alive);
    if ((state.seats.length > 1 && alive.length <= 1) || alive.length === 0 || state.chainLength >= 18) {
      for (const s of alive) s.score += 250;
      return { finished: true, sounds: state.pendingSounds.splice(0) };
    }

    const active = state.seats[state.activeIdx];
    const inp = players.find((p) => p.id === active?.id);
    const isBot = Boolean(inp?.isBot || active?.isBot);
    state.turnTimeLeft = Math.max(0, state.turnTimeLeft - dt * (frenzyActive ? 1.3 : 1));
    if (isBot) state.botTimer -= dt;

    if (active && isBot && state.botTimer <= 0) {
      const botDifficulty = (active as { botDifficulty?: BotDifficulty }).botDifficulty ?? inp?.botDifficulty;
      const accuracyProb = Math.max(
        0.05,
        Math.min(
          0.98,
          0.82 +
            (UNIVERSAL_BOT_PROFILES.arcade.evaluationNoise -
              getUniversalBotProfile(botDifficulty).evaluationNoise) *
              0.75
        )
      );
      const smartPick = Math.random() < accuracyProb ? state.choices.find((c) => c.correct) : state.choices[0];
      if (smartPick) {
        const res = this.handleCardAction!(state, active.id, { type: 'play-card', cardId: smartPick.id }, players);
        return { finished: false, sounds: res.sounds, privateStates: res.privateStates };
      }
    } else if (active && state.turnTimeLeft <= 0) {
      active.alive = false;
      active.lastAction = 'TIME OUT!';
      state.banner = `${active.name} TIMED OUT!`;
      state.bannerColor = '#EF4444';
      state.pendingSounds.push({ type: 'elim', playerId: active.id });
      advanceChainPlayer(state);
      prepChainChoices(state);
      return { finished: false, sounds: state.pendingSounds.splice(0), privateStates: this.getPrivateStates!(state, players) };
    }
    return { finished: false, sounds: state.pendingSounds.splice(0) };
  },
  snapshot(state): IdiomChainSnapshot {
    const link = CHAIN_LINKS[state.linkIdx % CHAIN_LINKS.length];
    return {
      gameId: 'idiom-chain',
      round: state.round,
      activePlayerId: state.seats[state.activeIdx]?.id ?? '',
      anchorEn: link.en,
      anchorZh: link.zh,
      linkHintEn: link.en.slice(-1),
      linkHintZh: link.zh.slice(-1),
      history: state.history,
      chainLength: state.chainLength,
      turnTimeLeft: state.turnTimeLeft,
      turnTotal: state.turnTotal,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: state.flyingCards.map((f) => ({ ...f })),
      shockwaves: state.shockwaves.map((s) => ({ ...s })),
      popups: state.popups.map((p) => ({ ...p })),
      players: state.seats.map((s) => ({
        id: s.id,
        slotIndex: s.slotIndex,
        name: s.name,
        colorHex: s.colorHex,
        isBot: s.isBot,
        alive: s.alive,
        streak: s.streak,
        score: s.score,
        lastAction: s.lastAction,
      })),
    };
  },
  buildResults(state) {
    return buildRankings(
      state.seats.map((s) => ({ id: s.id, score: s.score, stat: `${s.streak} Chain Streak` }))
    );
  },
};
