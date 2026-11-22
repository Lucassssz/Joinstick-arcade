import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../../src/shared/cardLayout.ts';
import type {
  CardPrivateState,
  CardShockwave,
  FlyingCardAnim,
  LiarCard,
  LiarRank,
  LiarSuit,
  LiarsDeckSnapshot,
  RankingEntry,
  SoundEvent,
} from '../../src/shared/types.ts';
import type { HapticTrigger, PlayerHudUpdate, ServerGameModule, ServerPlayerInputState } from './engine.ts';

const TURN_LIMIT_SEC = 15.0;
const CHALLENGE_LIMIT_SEC = 6.5;
const REVEAL_DURATION_SEC = 2.8;

const TARGET_RANKS: ('A' | 'K' | 'Q' | 'J' | '10')[] = ['A', 'K', 'Q', 'J', '10'];
const SUITS: LiarSuit[] = ['spades', 'hearts', 'diamonds', 'clubs'];

interface LiarPlayerInternal {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  hand: LiarCard[];
  selectedIds: Set<string>;
  cursorIndex: number;
  score: number;
  bluffsCaught: number;
  truthsLanded: number;
  bustedCount: number;
  lastAction: string | null;
  lastActionTimer: number;
  joyCooldown: number;
  botChallengeTimer: number;
  botWantsChallenge: boolean;
}

export interface LiarsDeckState {
  settingValue: number;
  round: number;
  targetRank: 'A' | 'K' | 'Q' | 'J' | '10';
  deck: LiarCard[];
  tablePile: LiarCard[];
  lastBatch: LiarCard[];
  lastClaimPlayerId: string | null;
  lastClaimPlayerName: string | null;
  lastClaimCount: number;
  activePlayerIndex: number;
  phase: 'selecting' | 'challenge' | 'reveal';
  turnTimeLeft: number;
  turnTotal: number;
  trustedPlayerIds: Set<string>;
  revealedCards: (LiarCard & { matchesTarget: boolean })[];
  revealVerdict: 'bluff-caught' | 'truth-confirmed' | null;
  pendingNextPlayerIndex: number;
  botThinkTimer: number;
  banner: string | null;
  bannerColor: string | null;
  bannerTimer: number;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: LiarPlayerInternal[];
  winnerId: string | null;
  finishDelay: number;
  pendingSounds: SoundEvent[];
  pendingHaptics: HapticTrigger[];
}

function buildLiarDeck(playerCount: number): LiarCard[] {
  const copiesPerRank = playerCount > 4 ? 8 : 6;
  const deck: LiarCard[] = [];
  let uid = 1;
  for (const rank of TARGET_RANKS) {
    for (let i = 0; i < copiesPerRank; i++) {
      deck.push({
        id: `ld_${uid++}_${Math.random().toString(36).slice(2, 6)}`,
        rank,
        suit: SUITS[i % SUITS.length],
      });
    }
  }
  const jokers = playerCount > 4 ? 4 : 2;
  for (let j = 0; j < jokers; j++) {
    deck.push({
      id: `ld_j_${uid++}_${Math.random().toString(36).slice(2, 6)}`,
      rank: 'JOKER',
      suit: 'joker',
    });
  }
  return shuffle(deck);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function suitGlyph(suit: LiarSuit): string {
  switch (suit) {
    case 'spades':
      return '♠';
    case 'hearts':
      return '♥';
    case 'diamonds':
      return '♦';
    case 'clubs':
      return '♣';
    case 'joker':
      return '★';
  }
}

function seatOf(state: LiarsDeckState, playerId: string) {
  const idx = Math.max(0, state.players.findIndex((p) => p.id === playerId));
  return getCardSeatPosition(idx, state.players.length);
}

function setBanner(state: LiarsDeckState, text: string, colorHex: string, duration = 2.0) {
  state.banner = text;
  state.bannerColor = colorHex;
  state.bannerTimer = duration;
}

function declareWinner(state: LiarsDeckState, winner: LiarPlayerInternal) {
  if (state.winnerId) return;
  state.winnerId = winner.id;
  winner.score += 1000;
  for (const other of state.players) {
    if (other.id !== winner.id) winner.score += other.hand.length * 45;
  }
  winner.lastAction = 'EMPTY HAND!';
  winner.lastActionTimer = 5;
  setBanner(state, `${winner.name} WINS!`, winner.colorHex, 3.6);
  state.shockwaves.push({
    x: TABLE_CENTER_X,
    y: TABLE_CENTER_Y,
    radius: 25,
    maxRadius: 340,
    colorHex: winner.colorHex,
    alpha: 1,
  });
  state.pendingSounds.push({ type: 'win', playerId: winner.id });
}

function advanceTurnToSelecting(state: LiarsDeckState, nextIdx?: number) {
  const n = state.players.length;
  if (n === 0) return;
  state.activePlayerIndex =
    nextIdx !== undefined ? ((nextIdx % n) + n) % n : (state.activePlayerIndex + 1) % n;
  state.phase = 'selecting';
  state.turnTimeLeft = TURN_LIMIT_SEC;
  state.turnTotal = TURN_LIMIT_SEC;
  state.trustedPlayerIds.clear();
  state.revealedCards = [];
  state.revealVerdict = null;
  state.botThinkTimer = 0.95 + Math.random() * 0.85;
}

function startChallengeWindow(state: LiarsDeckState, claimant: LiarPlayerInternal, played: LiarCard[]) {
  state.lastBatch = played;
  state.lastClaimPlayerId = claimant.id;
  state.lastClaimPlayerName = claimant.name;
  state.lastClaimCount = played.length;
  state.phase = 'challenge';
  state.turnTimeLeft = CHALLENGE_LIMIT_SEC;
  state.turnTotal = CHALLENGE_LIMIT_SEC;
  state.trustedPlayerIds.clear();

  // Compute each bot's suspicion for this claim
  for (const p of state.players) {
    if (!p.isBot || p.id === claimant.id) continue;
    let bluffProb = 0.14;
    if (played.length === 2) bluffProb = 0.28;
    if (played.length >= 3) bluffProb = 0.48;
    if (claimant.hand.length === 0) bluffProb = Math.max(bluffProb, 0.58);
    p.botWantsChallenge = Math.random() < bluffProb;
    p.botChallengeTimer = 1.0 + Math.random() * 1.6;
  }

  setBanner(
    state,
    `${claimant.name} PLAYED ${played.length}× ${state.targetRank}!`,
    claimant.colorHex,
    2.4
  );
}

function playCardsFaceDown(state: LiarsDeckState, player: LiarPlayerInternal, cardIds: string[]): boolean {
  if (state.winnerId || state.phase !== 'selecting') return false;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== player.id) return false;

  const picked: LiarCard[] = [];
  const keep: LiarCard[] = [];
  const wantSet = new Set(cardIds.slice(0, 3));
  for (const c of player.hand) {
    if (wantSet.has(c.id)) picked.push(c);
    else keep.push(c);
  }
  if (picked.length === 0) return false;

  player.hand = keep;
  player.selectedIds.clear();
  if (player.cursorIndex >= player.hand.length) {
    player.cursorIndex = Math.max(0, player.hand.length - 1);
  }

  state.tablePile.push(...picked);
  player.score += picked.length * 35;
  player.lastAction = `${picked.length}× ${state.targetRank}?`;
  player.lastActionTimer = 2.4;

  const seat = seatOf(state, player.id);
  for (let i = 0; i < picked.length; i++) {
    state.flyingCards.push({
      id: `fly_ld_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      fromX: seat.x + (i - 1) * 16,
      fromY: seat.y,
      toX: TABLE_CENTER_X + (i - (picked.length - 1) / 2) * 26,
      toY: TABLE_CENTER_Y + 8,
      progress: -i * 0.14,
      faceUp: false,
      colorHex: player.colorHex,
      rotStart: (Math.random() - 0.5) * 0.5,
      rotEnd: (Math.random() - 0.5) * 0.25,
    });
  }

  state.popups.push({
    x: seat.x,
    y: seat.y - 48,
    text: `${player.name} PLAYED ${picked.length}× ${state.targetRank}!`,
    colorHex: player.colorHex,
    alpha: 1.5,
  });
  state.pendingSounds.push({ type: 'card', playerId: player.id });
  state.pendingHaptics.push({ playerId: player.id, pattern: 45, reason: 'confirm' });

  startChallengeWindow(state, player, picked);
  return true;
}

function triggerBluffCall(state: LiarsDeckState, challenger: LiarPlayerInternal) {
  if (state.winnerId || state.phase !== 'challenge' || !state.lastClaimPlayerId) return;
  if (challenger.id === state.lastClaimPlayerId) return;
  const claimant = state.players.find((p) => p.id === state.lastClaimPlayerId);
  if (!claimant) return;

  state.phase = 'reveal';
  state.turnTimeLeft = REVEAL_DURATION_SEC;
  state.turnTotal = REVEAL_DURATION_SEC;

  const revealed = state.lastBatch.map((c) => ({
    ...c,
    matchesTarget: c.rank === state.targetRank || c.rank === 'JOKER',
  }));
  state.revealedCards = revealed;
  const allTruth = revealed.every((c) => c.matchesTarget);

  // Spawn dramatic staggered 3D flip animations right in the center
  revealed.forEach((c, i) => {
    const offset = (i - (revealed.length - 1) / 2) * 90;
    state.flyingCards.push({
      id: `flip_${Date.now()}_${i}`,
      fromX: TABLE_CENTER_X + offset * 0.25,
      fromY: TABLE_CENTER_Y + 26,
      toX: TABLE_CENTER_X + offset,
      toY: TABLE_CENTER_Y - 10,
      progress: -i * 0.14,
      faceUp: true,
      flipping: true,
      colorHex: c.matchesTarget ? '#10D98B' : '#FF4D2E',
      rankText: c.rank,
      suitSymbol: suitGlyph(c.suit),
      rotStart: (i - (revealed.length - 1) / 2) * 0.22,
      rotEnd: (i - (revealed.length - 1) / 2) * 0.08,
    });
  });

  const pileTotal = state.tablePile.length;

  if (allTruth) {
    // Truth! Challenger eats the entire pile
    state.revealVerdict = 'truth-confirmed';
    claimant.truthsLanded += 1;
    claimant.score += 140;
    challenger.bustedCount += 1;
    challenger.hand.push(...state.tablePile.splice(0, state.tablePile.length));
    challenger.lastAction = `DREW +${pileTotal}!`;
    challenger.lastActionTimer = 3.0;

    const cSeat = seatOf(state, challenger.id);
    const sweepCount = Math.min(6, pileTotal);
    for (let s = 0; s < sweepCount; s++) {
      state.flyingCards.push({
        id: `sweep_t_${Date.now()}_${s}`,
        fromX: TABLE_CENTER_X + (s - (sweepCount - 1) / 2) * 14,
        fromY: TABLE_CENTER_Y + 22,
        toX: cSeat.x,
        toY: cSeat.y,
        progress: -1.1 - s * 0.12,
        faceUp: false,
        colorHex: challenger.colorHex,
        rotStart: (Math.random() - 0.5) * 0.35,
        rotEnd: (Math.random() - 0.5) * 0.45,
      });
    }
    state.popups.push({
      x: cSeat.x,
      y: cSeat.y - 50,
      text: `100% HONEST!`,
      colorHex: '#10D98B',
      alpha: 1.8,
    });
    setBanner(state, `TRUTH! ${challenger.name} TOOK +${pileTotal} CARDS!`, '#10D98B', 2.8);
    state.shockwaves.push({
      x: TABLE_CENTER_X,
      y: TABLE_CENTER_Y,
      radius: 20,
      maxRadius: 270,
      colorHex: '#10D98B',
      alpha: 1,
    });
    state.pendingHaptics.push({ playerId: challenger.id, pattern: [90, 40, 90], reason: 'hit' });

    if (claimant.hand.length === 0) {
      declareWinner(state, claimant);
    } else {
      const claimantIdx = state.players.findIndex((p) => p.id === claimant.id);
      state.pendingNextPlayerIndex = (claimantIdx + 1) % state.players.length;
    }
  } else {
    // Liar caught! Claimant eats the entire pile
    state.revealVerdict = 'bluff-caught';
    challenger.bluffsCaught += 1;
    challenger.score += 175;
    claimant.bustedCount += 1;
    claimant.hand.push(...state.tablePile.splice(0, state.tablePile.length));
    claimant.lastAction = 'BLUFF CAUGHT!';
    claimant.lastActionTimer = 3.0;

    const lSeat = seatOf(state, claimant.id);
    const sweepCount = Math.min(6, pileTotal);
    for (let s = 0; s < sweepCount; s++) {
      state.flyingCards.push({
        id: `sweep_l_${Date.now()}_${s}`,
        fromX: TABLE_CENTER_X + (s - (sweepCount - 1) / 2) * 14,
        fromY: TABLE_CENTER_Y + 22,
        toX: lSeat.x,
        toY: lSeat.y,
        progress: -1.1 - s * 0.12,
        faceUp: false,
        colorHex: claimant.colorHex,
        rotStart: (Math.random() - 0.5) * 0.35,
        rotEnd: (Math.random() - 0.5) * 0.45,
      });
    }
    state.popups.push({
      x: lSeat.x,
      y: lSeat.y - 50,
      text: 'BLUFF CAUGHT!',
      colorHex: '#FF4D2E',
      alpha: 1.8,
    });
    setBanner(state, `LIAR! ${claimant.name} TOOK +${pileTotal} CARDS!`, '#FF4D2E', 2.8);
    state.shockwaves.push({
      x: TABLE_CENTER_X,
      y: TABLE_CENTER_Y,
      radius: 20,
      maxRadius: 290,
      colorHex: '#FF4D2E',
      alpha: 1,
    });
    state.pendingHaptics.push({ playerId: claimant.id, pattern: [100, 45, 110], reason: 'ko' });
    state.pendingHaptics.push({ playerId: challenger.id, pattern: [50, 30, 80], reason: 'pickup' });

    const challengerIdx = state.players.findIndex((p) => p.id === challenger.id);
    state.pendingNextPlayerIndex = challengerIdx;
  }

  state.lastBatch = [];
  state.lastClaimPlayerId = null;
  state.lastClaimPlayerName = null;
  state.lastClaimCount = 0;
  state.pendingSounds.push({ type: 'bluff', playerId: challenger.id });
}

function resolveChallengeNoCall(state: LiarsDeckState) {
  if (state.winnerId || state.phase !== 'challenge') return;
  const claimant = state.players.find((p) => p.id === state.lastClaimPlayerId);
  if (claimant && claimant.hand.length === 0) {
    declareWinner(state, claimant);
    return;
  }
  setBanner(state, 'TRUSTED!', '#00C2FF', 1.2);
  // Rotate target rank if pile grows large
  if (state.tablePile.length >= 10) {
    state.round += 1;
    state.targetRank = TARGET_RANKS[(state.round - 1) % TARGET_RANKS.length];
    state.tablePile = [];
  }
  advanceTurnToSelecting(state);
}

function buildPrivateState(state: LiarsDeckState, player: LiarPlayerInternal): CardPrivateState {
  const active = state.players[state.activePlayerIndex];
  const isMySelectingTurn = state.phase === 'selecting' && active?.id === player.id && !state.winnerId;
  const canChallenge =
    state.phase === 'challenge' &&
    Boolean(state.lastClaimPlayerId) &&
    state.lastClaimPlayerId !== player.id &&
    !state.winnerId;
  const alreadyTrusted = state.trustedPlayerIds.has(player.id);
  const isActionRequired = isMySelectingTurn || (canChallenge && !alreadyTrusted);

  let statusHint = `${active?.name ?? 'Player'} is picking cards...`;
  let statusHintZh = `${active?.name ?? '玩家'} 正在思考出牌...`;

  if (state.phase === 'reveal') {
    statusHint = state.revealVerdict === 'bluff-caught' ? 'LIAR CAUGHT!' : 'TRUTH REVEALED!';
    statusHintZh = state.revealVerdict === 'bluff-caught' ? '抓谎成功！骗子收牌！' : '竟是真牌！质疑者受罚！';
  } else if (isMySelectingTurn) {
    statusHint = `Select 1–3 cards & claim ${state.targetRank}! (${Math.ceil(state.turnTimeLeft)}s)`;
    statusHintZh = `选择 1–3 张牌声称「${state.targetRank}」(${Math.ceil(state.turnTimeLeft)}秒)`;
  } else if (canChallenge) {
    statusHint = alreadyTrusted
      ? 'You trusted — waiting for others...'
      : `${state.lastClaimPlayerName} claims ${state.lastClaimCount}× ${state.targetRank}!`;
    statusHintZh = alreadyTrusted
      ? '已选择信任 — 等待其他玩家...'
      : `${state.lastClaimPlayerName} 声称出了 ${state.lastClaimCount} 张 ${state.targetRank}！`;
  } else if (state.phase === 'challenge' && state.lastClaimPlayerId === player.id) {
    statusHint = 'Hold your poker face...';
    statusHintZh = '稳住表情，等待对手反应...';
  }

  return {
    gameId: 'liars-deck',
    playerId: player.id,
    hand: player.hand.map((c, idx) => ({
      id: c.id,
      kind: 'liar',
      rank: c.rank,
      suit: c.suit,
      playable: isMySelectingTurn || idx === player.cursorIndex,
      selected: player.selectedIds.has(c.id),
    })),
    cursorIndex: player.cursorIndex,
    isMyTurn: isMySelectingTurn,
    isActionRequired,
    turnTimeLeft: state.turnTimeLeft,
    turnTotal: state.turnTotal,
    phase: state.phase,
    targetRank: state.targetRank,
    canCallBluff: canChallenge,
    canTrust: canChallenge && !alreadyTrusted,
    lastClaimSummary:
      state.lastClaimPlayerName && state.lastClaimCount > 0
        ? `${state.lastClaimPlayerName}: ${state.lastClaimCount}× ${state.targetRank}`
        : null,
    selectedCount: player.selectedIds.size,
    statusHint,
    statusHintZh,
  };
}

export const liarsDeckModule: ServerGameModule<LiarsDeckState> = {
  id: 'liars-deck',

  createState(players, settingValue) {
    const startCards = Math.max(4, Math.min(7, settingValue || 5));
    const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
    const deck = buildLiarDeck(sorted.length);

    const internalPlayers: LiarPlayerInternal[] = sorted.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      hand: [],
      selectedIds: new Set<string>(),
      cursorIndex: 0,
      score: 0,
      bluffsCaught: 0,
      truthsLanded: 0,
      bustedCount: 0,
      lastAction: null,
      lastActionTimer: 0,
      joyCooldown: 0,
      botChallengeTimer: 1.5,
      botWantsChallenge: false,
    }));

    for (let c = 0; c < startCards; c++) {
      for (const p of internalPlayers) {
        const card = deck.pop();
        if (card) p.hand.push(card);
      }
    }

    const firstRank = TARGET_RANKS[Math.floor(Math.random() * TARGET_RANKS.length)];

    // Staggered opening deal wave around the poker table
    const dealAnims: FlyingCardAnim[] = [];
    const totalDeals = Math.min(24, startCards * internalPlayers.length);
    let dealIdx = 0;
    for (let roundIdx = 0; roundIdx < startCards && dealIdx < totalDeals; roundIdx++) {
      for (let pIdx = 0; pIdx < internalPlayers.length && dealIdx < totalDeals; pIdx++) {
        const seat = getCardSeatPosition(pIdx, internalPlayers.length);
        dealAnims.push({
          id: `deal_ld_${dealIdx}`,
          fromX: TABLE_CENTER_X,
          fromY: TABLE_CENTER_Y + 26,
          toX: seat.x,
          toY: seat.y,
          progress: -dealIdx * 0.075,
          faceUp: false,
          colorHex: internalPlayers[pIdx].colorHex,
          rotStart: -0.32,
          rotEnd: (Math.random() - 0.5) * 0.45,
        });
        dealIdx++;
      }
    }

    return {
      settingValue: startCards,
      round: 1,
      targetRank: firstRank,
      deck,
      tablePile: [],
      lastBatch: [],
      lastClaimPlayerId: null,
      lastClaimPlayerName: null,
      lastClaimCount: 0,
      activePlayerIndex: 0,
      phase: 'selecting',
      turnTimeLeft: TURN_LIMIT_SEC,
      turnTotal: TURN_LIMIT_SEC,
      trustedPlayerIds: new Set<string>(),
      revealedCards: [],
      revealVerdict: null,
      pendingNextPlayerIndex: 0,
      botThinkTimer: 1.55,
      banner: `TARGET: ${firstRank}`,
      bannerColor: '#FFB800',
      bannerTimer: 2.2,
      flyingCards: dealAnims,
      shockwaves: [],
      popups: [],
      players: internalPlayers,
      winnerId: null,
      finishDelay: 2.4,
      pendingSounds: [{ type: 'card' }],
      pendingHaptics: [],
    };
  },

  addPlayer(state, player) {
    if (state.players.some((p) => p.id === player.id)) return;
    const hand: LiarCard[] = [];
    for (let i = 0; i < state.settingValue; i++) {
      if (state.deck.length === 0) {
        state.deck = buildLiarDeck(state.players.length + 1);
      }
      const card = state.deck.pop();
      if (card) hand.push(card);
    }
    state.players.push({
      id: player.id,
      slotIndex: player.slotIndex,
      name: player.name,
      colorHex: player.color.hex,
      isBot: player.isBot,
      hand,
      selectedIds: new Set<string>(),
      cursorIndex: 0,
      score: 0,
      bluffsCaught: 0,
      truthsLanded: 0,
      bustedCount: 0,
      lastAction: null,
      lastActionTimer: 0,
      joyCooldown: 0,
      botChallengeTimer: 1.5,
      botWantsChallenge: false,
    });
    state.players.sort((a, b) => a.slotIndex - b.slotIndex);
  },

  handleCardAction(state, playerId, action) {
    const player = state.players.find((p) => p.id === playerId);
    if (!player || state.winnerId) return;

    switch (action.type) {
      case 'select-index': {
        if (player.hand.length > 0) {
          player.cursorIndex = Math.max(0, Math.min(player.hand.length - 1, action.index));
        }
        break;
      }
      case 'toggle-card': {
        const active = state.players[state.activePlayerIndex];
        if (state.phase !== 'selecting' || active?.id !== player.id) return;
        const idx = player.hand.findIndex((c) => c.id === action.cardId);
        if (idx >= 0) player.cursorIndex = idx;
        if (player.selectedIds.has(action.cardId)) {
          player.selectedIds.delete(action.cardId);
        } else if (player.selectedIds.size < 3) {
          player.selectedIds.add(action.cardId);
        }
        state.pendingSounds.push({ type: 'nav', playerId: player.id });
        break;
      }
      case 'submit-selected':
      case 'play-card': {
        const active = state.players[state.activePlayerIndex];
        if (state.phase !== 'selecting' || active?.id !== player.id) return;
        let ids = [...player.selectedIds];
        if (ids.length === 0) {
          const requestedId = action.type === 'play-card' ? action.cardId : undefined;
          const fallback = requestedId
            ? player.hand.find((c) => c.id === requestedId)
            : player.hand[player.cursorIndex];
          if (fallback) ids = [fallback.id];
        }
        playCardsFaceDown(state, player, ids);
        break;
      }
      case 'call-bluff': {
        triggerBluffCall(state, player);
        break;
      }
      case 'trust-claim': {
        if (state.phase !== 'challenge' || state.lastClaimPlayerId === player.id) return;
        state.trustedPlayerIds.add(player.id);
        player.lastAction = 'TRUST';
        player.lastActionTimer = 1.4;
        state.pendingSounds.push({ type: 'nav', playerId: player.id });
        const nonClaimHumans = state.players.filter(
          (p) => !p.isBot && p.id !== state.lastClaimPlayerId
        );
        const botsWantChallenge = state.players.some(
          (p) => p.isBot && p.id !== state.lastClaimPlayerId && p.botWantsChallenge
        );
        if (!botsWantChallenge && nonClaimHumans.every((p) => state.trustedPlayerIds.has(p.id))) {
          resolveChallengeNoCall(state);
        }
        break;
      }
      case 'draw-or-pass': {
        const active = state.players[state.activePlayerIndex];
        if (state.phase === 'selecting' && active?.id === player.id) {
          player.selectedIds.clear();
          const seat = seatOf(state, player.id);
          player.lastAction = 'PASSED';
          player.lastActionTimer = 1.6;
          state.popups.push({
            x: seat.x,
            y: seat.y - 44,
            text: `${player.name} PASSED (TIMEOUT)`,
            colorHex: '#94A3B8',
            alpha: 1.2,
          });
          advanceTurnToSelecting(state);
        }
        break;
      }
    }
  },

  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      if (!p.isBot) {
        out[p.id] = buildPrivateState(state, p);
      }
    }
    return out;
  },

  step(state, inputPlayers, dt) {
    const sounds: SoundEvent[] = state.pendingSounds.splice(0, state.pendingSounds.length);
    const haptics: HapticTrigger[] = state.pendingHaptics.splice(0, state.pendingHaptics.length);

    for (let i = state.flyingCards.length - 1; i >= 0; i--) {
      state.flyingCards[i].progress += dt * (state.flyingCards[i].flipping ? 1.85 : 2.65);
      if (state.flyingCards[i].progress >= 1.15 && !state.flyingCards[i].flipping) {
        state.flyingCards.splice(i, 1);
      } else if (state.flyingCards[i].progress >= 2.25) {
        state.flyingCards.splice(i, 1);
      }
    }
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.radius += dt * 360;
      sw.alpha -= dt * 1.4;
      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) state.shockwaves.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pop = state.popups[i];
      pop.y -= dt * 24;
      pop.alpha -= dt * 0.85;
      if (pop.alpha <= 0) state.popups.splice(i, 1);
    }
    if (state.bannerTimer > 0) {
      state.bannerTimer -= dt;
      if (state.bannerTimer <= 0) state.banner = null;
    }
    for (const p of state.players) {
      if (p.lastActionTimer > 0) {
        p.lastActionTimer -= dt;
        if (p.lastActionTimer <= 0) p.lastAction = null;
      }
      if (p.joyCooldown > 0) p.joyCooldown = Math.max(0, p.joyCooldown - dt);
    }

    if (state.winnerId) {
      state.finishDelay -= dt;
      const finished = state.finishDelay <= 0;
      return {
        snapshot: this.getSnapshot(state),
        sounds,
        haptics,
        hudUpdates: buildHudUpdates(state),
        privateStates: this.getPrivateStates!(state, inputPlayers),
        finished,
        rankings: finished ? this.getRankings(state, inputPlayers) : undefined,
      };
    }

    state.turnTimeLeft -= dt;

    if (state.phase === 'selecting') {
      const active = state.players[state.activePlayerIndex];
      if (active) {
        if (active.isBot) {
          state.botThinkTimer -= dt;
          if (state.botThinkTimer <= 0) {
            const matching = active.hand.filter(
              (c) => c.rank === state.targetRank || c.rank === 'JOKER'
            );
            let toPlay: LiarCard[];
            if (matching.length > 0) {
              toPlay = matching.slice(0, Math.min(2, matching.length));
            } else {
              // Bluff 1–2 cards!
              const count = active.hand.length >= 2 && Math.random() < 0.35 ? 2 : 1;
              toPlay = active.hand.slice(0, count);
            }
            playCardsFaceDown(
              state,
              active,
              toPlay.map((c) => c.id)
            );
          }
        } else {
          // Human joystick + A/B support
          const inp = inputPlayers.find((ip) => ip.id === active.id);
          if (inp) {
            const justA = inp.input.a && !inp.prevA;
            const justB = inp.input.b && !inp.prevB;

            if (Math.abs(inp.input.dx) > 0.52 && active.joyCooldown <= 0 && active.hand.length > 0) {
              const dir = inp.input.dx > 0 ? 1 : -1;
              active.cursorIndex =
                (active.cursorIndex + dir + active.hand.length) % active.hand.length;
              active.joyCooldown = 0.22;
              sounds.push({ type: 'nav', playerId: active.id });
            }
            if (justB && active.hand[active.cursorIndex]) {
              this.handleCardAction!(
                state,
                active.id,
                { type: 'toggle-card', cardId: active.hand[active.cursorIndex].id },
                inputPlayers
              );
            } else if (justA) {
              this.handleCardAction!(state, active.id, { type: 'submit-selected' }, inputPlayers);
            }
          }
        }

        // 15s turn timeout -> pass turn to next player!
        if (state.phase === 'selecting' && state.turnTimeLeft <= 0) {
          active.selectedIds.clear();
          const seat = seatOf(state, active.id);
          active.lastAction = 'TIME OUT · PASSED!';
          active.lastActionTimer = 2.2;
          state.popups.push({
            x: seat.x,
            y: seat.y - 46,
            text: `${active.name} PASSED (TIMEOUT)`,
            colorHex: '#FF4D2E',
            alpha: 1.5,
          });
          setBanner(state, 'TIME OUT · PASSED!', '#FF4D2E', 1.6);
          sounds.push({ type: 'nav', playerId: active.id });
          advanceTurnToSelecting(state);
        }
      }
    } else if (state.phase === 'challenge') {
      // Check human button inputs (A = Trust, B = Call Bluff)
      for (const p of state.players) {
        if (p.id === state.lastClaimPlayerId) continue;
        if (p.isBot) {
          if (p.botWantsChallenge) {
            p.botChallengeTimer -= dt;
            if (p.botChallengeTimer <= 0) {
              triggerBluffCall(state, p);
              break;
            }
          }
        } else {
          const inp = inputPlayers.find((ip) => ip.id === p.id);
          if (inp) {
            const justA = inp.input.a && !inp.prevA;
            const justB = inp.input.b && !inp.prevB;
            if (justB) {
              triggerBluffCall(state, p);
              break;
            } else if (justA) {
              this.handleCardAction!(state, p.id, { type: 'trust-claim' }, inputPlayers);
            }
          }
        }
      }

      if (state.phase === 'challenge' && state.turnTimeLeft <= 0) {
        resolveChallengeNoCall(state);
      }
    } else if (state.phase === 'reveal') {
      if (state.turnTimeLeft <= 0) {
        state.round += 1;
        state.targetRank = TARGET_RANKS[(state.round - 1) % TARGET_RANKS.length];
        setBanner(state, `TARGET: ${state.targetRank}`, '#FFB800', 1.8);
        advanceTurnToSelecting(state, state.pendingNextPlayerIndex);
      }
    }

    while (state.pendingSounds.length > 0) {
      const s = state.pendingSounds.shift();
      if (s) sounds.push(s);
    }
    while (state.pendingHaptics.length > 0) {
      const h = state.pendingHaptics.shift();
      if (h) haptics.push(h);
    }

    return {
      snapshot: this.getSnapshot(state),
      sounds,
      haptics,
      hudUpdates: buildHudUpdates(state),
      privateStates: this.getPrivateStates!(state, inputPlayers),
      finished: false,
    };
  },

  getSnapshot(state): LiarsDeckSnapshot {
    return {
      gameId: 'liars-deck',
      round: state.round,
      targetRank: state.targetRank,
      activePlayerId: state.players[state.activePlayerIndex]?.id ?? '',
      lastClaimPlayerId: state.lastClaimPlayerId,
      lastClaimPlayerName: state.lastClaimPlayerName,
      lastClaimCount: state.lastClaimCount,
      phase: state.phase,
      turnTimeLeft: Math.max(0, state.turnTimeLeft),
      turnTotal: state.turnTotal,
      pileCount: state.tablePile.length,
      revealedCards: [...state.revealedCards],
      revealVerdict: state.revealVerdict,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: [...state.flyingCards],
      shockwaves: [...state.shockwaves],
      popups: [...state.popups],
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: p.isBot,
        cardCount: p.hand.length,
        bluffsCaught: p.bluffsCaught,
        truthsLanded: p.truthsLanded,
        bustedCount: p.bustedCount,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: 0,
        cooldownB: 0,
      })),
    };
  },

  getRankings(state): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => {
      if (a.id === state.winnerId) return -1;
      if (b.id === state.winnerId) return 1;
      if (a.hand.length !== b.hand.length) return a.hand.length - b.hand.length;
      if (b.score !== a.score) return b.score - a.score;
      return a.slotIndex - b.slotIndex;
    });
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: {
        id: `p${p.slotIndex}`,
        name: p.name,
        hex: p.colorHex,
        dark: p.colorHex,
        textOnColor: '#FFFFFF',
      },
      rank: idx + 1,
      score: p.score,
      highlight:
        p.hand.length === 0
          ? 'EMPTY HAND!'
          : `${p.hand.length} cards · ${p.bluffsCaught} caught`,
    }));
  },
};

function buildHudUpdates(state: LiarsDeckState): Record<string, PlayerHudUpdate> {
  const activeId = state.players[state.activePlayerIndex]?.id;
  const out: Record<string, PlayerHudUpdate> = {};
  for (const p of state.players) {
    out[p.id] = {
      score: p.score,
      alive: true,
      statText:
        state.phase === 'challenge' && state.lastClaimPlayerId !== p.id
          ? `BLUFF CHECK · ${Math.ceil(Math.max(0, state.turnTimeLeft))}s`
          : p.id === activeId && state.phase === 'selecting' && !state.winnerId
          ? `YOUR TURN · ${Math.ceil(Math.max(0, state.turnTimeLeft))}s`
          : `${p.hand.length} cards left`,
      cooldownA: 0,
      cooldownB: 0,
    };
  }
  return out;
}
