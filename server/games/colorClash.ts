import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../../src/shared/cardLayout.ts';
import type {
  CardClientAction,
  CardColor,
  CardPrivateState,
  CardShockwave,
  ClashCard,
  ClashCardValue,
  ColorClashSnapshot,
  FlyingCardAnim,
  RankingEntry,
  SoundEvent,
} from '../../src/shared/types.ts';
import type { HapticTrigger, PlayerHudUpdate, ServerGameModule, ServerPlayerInputState } from './engine.ts';

const TURN_LIMIT_SEC = 15.0;

const COLOR_HEX: Record<Exclude<CardColor, 'wild'>, string> = {
  red: '#FF4D2E',
  blue: '#00C2FF',
  gold: '#FFB800',
  green: '#10D98B',
};

const BASIC_COLORS: Exclude<CardColor, 'wild'>[] = ['red', 'blue', 'gold', 'green'];

interface ClashPlayerInternal {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  hand: ClashCard[];
  cursorIndex: number;
  score: number;
  cardsPlayed: number;
  actionCardsPlayed: number;
  lastAction: string | null;
  lastActionTimer: number;
  joyCooldown: number;
  colorCursor: number;
}

export interface ColorClashState {
  settingValue: number;
  deck: ClashCard[];
  discardPile: ClashCard[];
  topCard: ClashCard;
  recentCards: { color: CardColor; value: ClashCardValue; rot: number }[];
  activeColor: Exclude<CardColor, 'wild'>;
  direction: 1 | -1;
  activePlayerIndex: number;
  drawPenalty: number;
  awaitingColorPick: boolean;
  turnTimeLeft: number;
  turnTotal: number;
  turnCount: number;
  botThinkTimer: number;
  banner: string | null;
  bannerColor: string | null;
  bannerTimer: number;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: ClashPlayerInternal[];
  winnerId: string | null;
  finishDelay: number;
  pendingSounds: SoundEvent[];
  pendingHaptics: HapticTrigger[];
}

function buildClashDeck(): ClashCard[] {
  const deck: ClashCard[] = [];
  let uid = 1;
  const push = (color: CardColor, value: ClashCardValue, count: number) => {
    for (let i = 0; i < count; i++) {
      deck.push({ id: `cc_${uid++}_${Math.random().toString(36).slice(2, 6)}`, color, value });
    }
  };
  for (const col of BASIC_COLORS) {
    const nums: ClashCardValue[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    for (const v of nums) push(col, v, 2);
    push(col, 'SKIP', 2);
    push(col, 'REV', 2);
    push(col, '+2', 2);
  }
  push('wild', 'WILD', 4);
  push('wild', '+4', 4);
  return shuffleCards(deck);
}

function shuffleCards<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function drawFromDeck(state: ColorClashState): ClashCard {
  if (state.deck.length === 0) {
    if (state.discardPile.length > 1) {
      const top = state.discardPile[state.discardPile.length - 1];
      const recycled = state.discardPile.slice(0, -1);
      state.discardPile = [top];
      state.deck = shuffleCards(recycled);
    } else {
      state.deck = buildClashDeck();
    }
  }
  return state.deck.pop() ?? { id: `cc_fb_${Date.now()}`, color: 'red', value: '5' };
}

function isCardPlayable(state: ColorClashState, card: ClashCard): boolean {
  if (state.drawPenalty > 0) {
    if (card.value === '+4') return true;
    if (card.value === '+2' && state.topCard.value === '+2') return true;
    return false;
  }
  if (card.color === 'wild') return true;
  if (card.color === state.activeColor) return true;
  if (card.value === state.topCard.value) return true;
  return false;
}

function pickBestHandColor(hand: ClashCard[]): Exclude<CardColor, 'wild'> {
  const counts: Record<Exclude<CardColor, 'wild'>, number> = {
    red: 0,
    blue: 0,
    gold: 0,
    green: 0,
  };
  for (const c of hand) {
    if (c.color !== 'wild') counts[c.color] += 1;
  }
  let best: Exclude<CardColor, 'wild'> = BASIC_COLORS[Math.floor(Math.random() * BASIC_COLORS.length)];
  let bestCount = -1;
  for (const col of BASIC_COLORS) {
    if (counts[col] > bestCount) {
      bestCount = counts[col];
      best = col;
    }
  }
  return best;
}

function seatForPlayer(state: ColorClashState, playerId: string) {
  const idx = Math.max(0, state.players.findIndex((p) => p.id === playerId));
  return getCardSeatPosition(idx, state.players.length);
}

function spawnFlyingCard(
  state: ColorClashState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  faceUp: boolean,
  card?: ClashCard
) {
  const colorHex =
    card && card.color !== 'wild' ? COLOR_HEX[card.color] : card ? '#A855F7' : '#1E293B';
  state.flyingCards.push({
    id: `fly_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fromX,
    fromY,
    toX,
    toY,
    progress: 0,
    faceUp,
    colorHex,
    rankText: card?.value,
    rotStart: (Math.random() - 0.5) * 0.45,
    rotEnd: (Math.random() - 0.5) * 0.28,
  });
}

function setBanner(state: ColorClashState, text: string, colorHex: string, duration = 1.9) {
  state.banner = text;
  state.bannerColor = colorHex;
  state.bannerTimer = duration;
}

function advanceTurn(state: ColorClashState, steps = 1) {
  const n = state.players.length;
  if (n === 0) return;
  state.activePlayerIndex = ((state.activePlayerIndex + state.direction * steps) % n + n) % n;
  state.awaitingColorPick = false;
  state.turnTimeLeft = TURN_LIMIT_SEC;
  state.turnTotal = TURN_LIMIT_SEC;
  state.turnCount += 1;
  state.botThinkTimer = 1.85 + Math.random() * 0.95;
}

function finishMatchIfEmpty(state: ColorClashState, p: ClashPlayerInternal): boolean {
  if (p.hand.length > 0) return false;
  state.winnerId = p.id;
  let bonus = 900;
  for (const other of state.players) {
    if (other.id !== p.id) {
      bonus += other.hand.length * 60;
    }
  }
  p.score += bonus;
  p.lastAction = 'EMPTY HAND!';
  p.lastActionTimer = 4;
  setBanner(state, `${p.name} WINS!`, p.colorHex, 3.5);
  state.shockwaves.push({
    x: TABLE_CENTER_X,
    y: TABLE_CENTER_Y,
    radius: 25,
    maxRadius: 340,
    colorHex: p.colorHex,
    alpha: 1,
  });
  state.pendingSounds.push({ type: 'win', playerId: p.id });
  return true;
}

function applyCardResolution(
  state: ColorClashState,
  player: ClashPlayerInternal,
  card: ClashCard,
  chosenWildColor?: Exclude<CardColor, 'wild'>
) {
  if (finishMatchIfEmpty(state, player)) return;

  if (player.hand.length === 1) {
    const seat = seatForPlayer(state, player.id);
    state.popups.push({
      x: seat.x,
      y: seat.y - 54,
      text: '1 CARD LEFT!',
      colorHex: '#FFB800',
      alpha: 1.5,
    });
    state.pendingHaptics.push({ playerId: player.id, pattern: [50, 30, 80], reason: 'pickup' });
  }

  const n = state.players.length;
  if (card.value === 'SKIP') {
    const skippedIdx = ((state.activePlayerIndex + state.direction) % n + n) % n;
    const skipped = state.players[skippedIdx];
    if (skipped) {
      skipped.lastAction = 'SKIP!';
      skipped.lastActionTimer = 2.0;
      const sSeat = seatForPlayer(state, skipped.id);
      state.popups.push({
        x: sSeat.x,
        y: sSeat.y - 46,
        text: 'SKIP!',
        colorHex: '#FF4D2E',
        alpha: 1.4,
      });
    }
    state.shockwaves.push({
      x: TABLE_CENTER_X + 68,
      y: TABLE_CENTER_Y,
      radius: 18,
      maxRadius: 190,
      colorHex: state.activeColor ? COLOR_HEX[state.activeColor] : '#FF4D2E',
      alpha: 0.9,
    });
    setBanner(state, 'SKIP!', COLOR_HEX[state.activeColor], 1.5);
    advanceTurn(state, 2);
    return;
  }

  if (card.value === 'REV') {
    if (n <= 2) {
      setBanner(state, 'REVERSE!', COLOR_HEX[state.activeColor], 1.4);
      advanceTurn(state, 2);
    } else {
      state.direction = state.direction === 1 ? -1 : 1;
      setBanner(state, 'REVERSE!', COLOR_HEX[state.activeColor], 1.5);
      advanceTurn(state, 1);
    }
    state.shockwaves.push({
      x: TABLE_CENTER_X,
      y: TABLE_CENTER_Y,
      radius: 30,
      maxRadius: 230,
      colorHex: '#00C2FF',
      alpha: 0.9,
    });
    return;
  }

  if (card.value === '+2') {
    state.drawPenalty += 2;
    setBanner(state, `STACK +${state.drawPenalty}!`, COLOR_HEX[state.activeColor], 1.6);
    state.shockwaves.push({
      x: TABLE_CENTER_X + 68,
      y: TABLE_CENTER_Y,
      radius: 20,
      maxRadius: 210,
      colorHex: '#FF4D2E',
      alpha: 0.95,
    });
    advanceTurn(state, 1);
    return;
  }

  if (card.value === 'WILD' || card.value === '+4') {
    if (card.value === '+4') {
      state.drawPenalty += 4;
    }
    if (chosenWildColor) {
      state.activeColor = chosenWildColor;
      setBanner(
        state,
        card.value === '+4' ? `STACK +${state.drawPenalty}!` : 'PICK A COLOR!',
        COLOR_HEX[chosenWildColor],
        1.5
      );
      state.shockwaves.push({
        x: TABLE_CENTER_X + 68,
        y: TABLE_CENTER_Y,
        radius: 22,
        maxRadius: 230,
        colorHex: COLOR_HEX[chosenWildColor],
        alpha: 0.95,
      });
      advanceTurn(state, 1);
      return;
    }
    // Wait for human player to tap a color on their phone!
    state.awaitingColorPick = true;
    state.turnTimeLeft = Math.max(state.turnTimeLeft, 7.0);
    setBanner(state, 'PICK A COLOR!', '#A855F7', 2.2);
    return;
  }

  advanceTurn(state, 1);
}

function executePlayCard(
  state: ColorClashState,
  player: ClashPlayerInternal,
  cardIndex: number,
  chosenWildColor?: Exclude<CardColor, 'wild'>
): boolean {
  if (state.winnerId || state.awaitingColorPick) return false;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== player.id) return false;
  const card = player.hand[cardIndex];
  if (!card || !isCardPlayable(state, card)) return false;

  player.hand.splice(cardIndex, 1);
  if (player.cursorIndex >= player.hand.length) {
    player.cursorIndex = Math.max(0, player.hand.length - 1);
  }

  player.cardsPlayed += 1;
  const isAction = card.value === 'SKIP' || card.value === 'REV' || card.value === '+2' || card.value === 'WILD' || card.value === '+4';
  if (isAction) player.actionCardsPlayed += 1;
  player.score += isAction ? 75 : 40;
  player.lastAction = card.value;
  player.lastActionTimer = 2.6;

  state.topCard = card;
  state.discardPile.push(card);
  state.recentCards.push({
    color: card.color,
    value: card.value,
    rot: (Math.random() - 0.5) * 0.34,
  });
  if (state.recentCards.length > 5) state.recentCards.shift();

  if (card.color !== 'wild') {
    state.activeColor = card.color;
  }

  const seat = seatForPlayer(state, player.id);
  spawnFlyingCard(state, seat.x, seat.y, TABLE_CENTER_X + 74, TABLE_CENTER_Y, true, card);

  state.pendingSounds.push({ type: 'card', playerId: player.id });
  state.pendingHaptics.push({ playerId: player.id, pattern: 42, reason: 'confirm' });

  applyCardResolution(state, player, card, player.isBot ? pickBestHandColor(player.hand) : chosenWildColor);
  return true;
}

function executeDrawOrPenalty(state: ColorClashState, player: ClashPlayerInternal, isTimeout = false): void {
  if (state.winnerId) return;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== player.id) return;

  if (state.awaitingColorPick) {
    const autoCol = pickBestHandColor(player.hand);
    state.activeColor = autoCol;
    state.awaitingColorPick = false;
    state.shockwaves.push({
      x: TABLE_CENTER_X + 68,
      y: TABLE_CENTER_Y,
      radius: 20,
      maxRadius: 200,
      colorHex: COLOR_HEX[autoCol],
      alpha: 0.9,
    });
    advanceTurn(state, 1);
    return;
  }

  const seat = seatForPlayer(state, player.id);

  if (isTimeout && state.drawPenalty === 0) {
    // Pass directly to next player when 15s response expires with no action
    player.lastAction = 'TIME OUT · PASSED!';
    player.lastActionTimer = 2.2;
    state.popups.push({
      x: seat.x,
      y: seat.y - 46,
      text: `${player.name} PASSED (TIMEOUT)`,
      colorHex: '#FF4D2E',
      alpha: 1.5,
    });
    setBanner(state, 'TIME OUT · PASSED!', '#FF4D2E', 1.6);
    state.pendingSounds.push({ type: 'nav', playerId: player.id });
    advanceTurn(state, 1);
    return;
  }

  const drawCount = state.drawPenalty > 0 ? state.drawPenalty : 1;
  const wasPenalty = state.drawPenalty > 0;
  state.drawPenalty = 0;

  for (let i = 0; i < drawCount; i++) {
    player.hand.push(drawFromDeck(state));
    if (i < 6) {
      state.flyingCards.push({
        id: `fly_draw_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        fromX: TABLE_CENTER_X - 108,
        fromY: TABLE_CENTER_Y,
        toX: seat.x,
        toY: seat.y,
        progress: -i * 0.14,
        faceUp: false,
        colorHex: player.colorHex,
        rotStart: -0.25 + (Math.random() - 0.5) * 0.2,
        rotEnd: (Math.random() - 0.5) * 0.45,
      });
    }
  }

  player.lastAction = `DREW +${drawCount}!`;
  player.lastActionTimer = 2.6;
  state.popups.push({
    x: seat.x,
    y: seat.y - 46,
    text: `DREW +${drawCount}!`,
    colorHex: wasPenalty ? '#FF4D2E' : '#FFB800',
    alpha: 1.4,
  });
  state.pendingSounds.push({ type: 'card', playerId: player.id });
  if (wasPenalty) {
    state.pendingHaptics.push({ playerId: player.id, pattern: [75, 35, 75], reason: 'hit' });
  }
  advanceTurn(state, 1);
}

function buildPrivateState(state: ColorClashState, player: ClashPlayerInternal): CardPrivateState {
  const active = state.players[state.activePlayerIndex];
  const isMyTurn = Boolean(active && active.id === player.id && !state.winnerId);
  const canPickColor = isMyTurn && state.awaitingColorPick;
  const isActionRequired = isMyTurn;

  let statusHint = `${active?.name ?? 'Player'}'s turn`;
  let statusHintZh = `等待 ${active?.name ?? '玩家'} 出牌`;
  if (canPickColor) {
    statusHint = 'Pick the new table color!';
    statusHintZh = '请选择新的桌面颜色！';
  } else if (isMyTurn) {
    if (state.drawPenalty > 0) {
      statusHint = `Stack +2/+4 or Draw +${state.drawPenalty}!`;
      statusHintZh = `叠加 +2/+4 或罚抽 +${state.drawPenalty} 张！`;
    } else {
      statusHint = `Your turn! Tap a glowing card (${Math.ceil(state.turnTimeLeft)}s)`;
      statusHintZh = `轮到你！点按发光卡牌出牌 (${Math.ceil(state.turnTimeLeft)}秒)`;
    }
  }

  return {
    gameId: 'color-clash',
    playerId: player.id,
    hand: player.hand.map((c, idx) => ({
      id: c.id,
      kind: 'clash',
      color: c.color,
      value: c.value,
      playable: isMyTurn && !state.awaitingColorPick && isCardPlayable(state, c),
      selected: idx === player.cursorIndex,
    })),
    cursorIndex: player.cursorIndex,
    isMyTurn,
    isActionRequired,
    turnTimeLeft: state.turnTimeLeft,
    turnTotal: state.turnTotal,
    activeColor: state.activeColor,
    awaitingColorPick: canPickColor,
    drawPenalty: state.drawPenalty,
    statusHint,
    statusHintZh,
  };
}

export const colorClashModule: ServerGameModule<ColorClashState> = {
  id: 'color-clash',

  createState(players, settingValue) {
    const startCards = Math.max(4, Math.min(10, settingValue || 7));
    const deck = buildClashDeck();
    const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);

    const internalPlayers: ClashPlayerInternal[] = sorted.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      hand: [],
      cursorIndex: 0,
      score: 0,
      cardsPlayed: 0,
      actionCardsPlayed: 0,
      lastAction: null,
      lastActionTimer: 0,
      joyCooldown: 0,
      colorCursor: 0,
    }));

    for (let c = 0; c < startCards; c++) {
      for (const p of internalPlayers) {
        const card = deck.pop();
        if (card) p.hand.push(card);
      }
    }

    // Pick a clean non-wild starting card
    let topIdx = deck.findIndex((c) => c.color !== 'wild' && !['SKIP', 'REV', '+2'].includes(c.value));
    if (topIdx < 0) topIdx = 0;
    const [topCard] = deck.splice(topIdx, 1);
    const activeColor: Exclude<CardColor, 'wild'> =
      topCard.color === 'wild' ? 'red' : topCard.color;

    // Staggered opening deal wave from the center draw deck to every seat
    const dealAnims: FlyingCardAnim[] = [];
    const totalDeals = Math.min(24, startCards * internalPlayers.length);
    let dealIdx = 0;
    for (let roundIdx = 0; roundIdx < startCards && dealIdx < totalDeals; roundIdx++) {
      for (let pIdx = 0; pIdx < internalPlayers.length && dealIdx < totalDeals; pIdx++) {
        const seat = getCardSeatPosition(pIdx, internalPlayers.length);
        dealAnims.push({
          id: `deal_cc_${dealIdx}`,
          fromX: TABLE_CENTER_X - 108,
          fromY: TABLE_CENTER_Y,
          toX: seat.x,
          toY: seat.y,
          progress: -dealIdx * 0.07,
          faceUp: false,
          colorHex: internalPlayers[pIdx].colorHex,
          rotStart: -0.28,
          rotEnd: (Math.random() - 0.5) * 0.5,
        });
        dealIdx++;
      }
    }

    return {
      settingValue: startCards,
      deck,
      discardPile: [topCard],
      topCard,
      recentCards: [{ color: topCard.color, value: topCard.value, rot: 0 }],
      activeColor,
      direction: 1,
      activePlayerIndex: 0,
      drawPenalty: 0,
      awaitingColorPick: false,
      turnTimeLeft: TURN_LIMIT_SEC,
      turnTotal: TURN_LIMIT_SEC,
      turnCount: 0,
      botThinkTimer: 2.4,
      banner: `${internalPlayers[0]?.name ?? 'P1'}'s Turn!`,
      bannerColor: COLOR_HEX[activeColor],
      bannerTimer: 2.4,
      flyingCards: dealAnims,
      shockwaves: [],
      popups: [],
      players: internalPlayers,
      winnerId: null,
      finishDelay: 2.2,
      pendingSounds: [{ type: 'card' }],
      pendingHaptics: [],
    };
  },

  addPlayer(state, player) {
    if (state.players.some((p) => p.id === player.id)) return;
    const cards: ClashCard[] = [];
    for (let i = 0; i < state.settingValue; i++) {
      cards.push(drawFromDeck(state));
    }
    state.players.push({
      id: player.id,
      slotIndex: player.slotIndex,
      name: player.name,
      colorHex: player.color.hex,
      isBot: player.isBot,
      hand: cards,
      cursorIndex: 0,
      score: 0,
      cardsPlayed: 0,
      actionCardsPlayed: 0,
      lastAction: null,
      lastActionTimer: 0,
      joyCooldown: 0,
      colorCursor: 0,
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
      case 'play-card': {
        const idx = action.cardId
          ? player.hand.findIndex((c) => c.id === action.cardId)
          : player.cursorIndex;
        if (idx >= 0) {
          executePlayCard(state, player, idx);
        }
        break;
      }
      case 'draw-or-pass': {
        executeDrawOrPenalty(state, player, false);
        break;
      }
      case 'pick-color': {
        const active = state.players[state.activePlayerIndex];
        if (!active || active.id !== player.id || !state.awaitingColorPick) return;
        state.activeColor = action.color;
        state.awaitingColorPick = false;
        setBanner(
          state,
          state.drawPenalty > 0 ? `STACK +${state.drawPenalty}!` : 'PICK A COLOR!',
          COLOR_HEX[action.color],
          1.4
        );
        state.shockwaves.push({
          x: TABLE_CENTER_X + 68,
          y: TABLE_CENTER_Y,
          radius: 20,
          maxRadius: 230,
          colorHex: COLOR_HEX[action.color],
          alpha: 0.95,
        });
        state.pendingSounds.push({ type: 'confirm', playerId: player.id });
        advanceTurn(state, 1);
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

    // Animate flying cards with smooth settle overlap
    for (let i = state.flyingCards.length - 1; i >= 0; i--) {
      state.flyingCards[i].progress += dt * 1.75;
      if (state.flyingCards[i].progress >= 1.15) {
        state.flyingCards.splice(i, 1);
      }
    }
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.radius += dt * 310;
      sw.alpha -= dt * 1.15;
      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) state.shockwaves.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      const pop = state.popups[i];
      pop.y -= dt * 26;
      pop.alpha -= dt * 0.9;
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
      const hudUpdates = buildHudUpdates(state);
      return {
        snapshot: this.getSnapshot(state),
        sounds,
        haptics,
        hudUpdates,
        privateStates: this.getPrivateStates!(state, inputPlayers),
        finished,
        rankings: finished ? this.getRankings(state, inputPlayers) : undefined,
      };
    }

    const active = state.players[state.activePlayerIndex];
    if (active) {
      state.turnTimeLeft -= dt;

      if (active.isBot) {
        state.botThinkTimer -= dt;
        if (state.botThinkTimer <= 0) {
          if (state.awaitingColorPick) {
            state.activeColor = pickBestHandColor(active.hand);
            state.awaitingColorPick = false;
            advanceTurn(state, 1);
          } else {
            // Prefer action/matching color cards over Wilds
            const playableIndices: number[] = [];
            active.hand.forEach((c, idx) => {
              if (isCardPlayable(state, c)) playableIndices.push(idx);
            });
            if (playableIndices.length > 0) {
              playableIndices.sort((ia, ib) => {
                const ca = active.hand[ia];
                const cb = active.hand[ib];
                const scoreCard = (c: ClashCard) =>
                  c.value === '+2'
                    ? 5
                    : c.value === 'SKIP' || c.value === 'REV'
                    ? 4
                    : c.color !== 'wild'
                    ? 3
                    : c.value === 'WILD'
                    ? 2
                    : 1;
                return scoreCard(cb) - scoreCard(ca);
              });
              executePlayCard(state, active, playableIndices[0]);
            } else {
              executeDrawOrPenalty(state, active, false);
            }
          }
        }
      } else {
        // Human input via Joystick / A / B (in addition to direct phone taps!)
        const inp = inputPlayers.find((ip) => ip.id === active.id);
        if (inp) {
          const justA = inp.input.a && !inp.prevA;
          const justB = inp.input.b && !inp.prevB;

          if (Math.abs(inp.input.dx) > 0.52 && active.joyCooldown <= 0 && active.hand.length > 0) {
            const dir = inp.input.dx > 0 ? 1 : -1;
            if (state.awaitingColorPick) {
              active.colorCursor = (active.colorCursor + dir + 4) % 4;
            } else {
              active.cursorIndex =
                (active.cursorIndex + dir + active.hand.length) % active.hand.length;
            }
            active.joyCooldown = 0.22;
            sounds.push({ type: 'nav', playerId: active.id });
          }

          if (justA) {
            if (state.awaitingColorPick) {
              const col = BASIC_COLORS[active.colorCursor % BASIC_COLORS.length];
              this.handleCardAction!(state, active.id, { type: 'pick-color', color: col }, inputPlayers);
            } else {
              executePlayCard(state, active, active.cursorIndex);
            }
          } else if (justB) {
            executeDrawOrPenalty(state, active, false);
          }
        }
      }

      // 15-second response timer expiration -> pass turn to next player!
      if (!state.winnerId && state.turnTimeLeft <= 0) {
        executeDrawOrPenalty(state, active, true);
      }
    }

    // Flush any pending sounds/haptics generated during this step
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

  getSnapshot(state): ColorClashSnapshot {
    return {
      gameId: 'color-clash',
      activePlayerId: state.players[state.activePlayerIndex]?.id ?? '',
      direction: state.direction,
      activeColor: state.activeColor,
      topCard: state.topCard,
      recentCards: [...state.recentCards],
      drawPenalty: state.drawPenalty,
      deckCount: state.deck.length,
      discardCount: state.discardPile.length,
      awaitingColorPick: state.awaitingColorPick,
      turnTimeLeft: Math.max(0, state.turnTimeLeft),
      turnTotal: state.turnTotal,
      turnCount: state.turnCount,
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
          : `${p.hand.length} cards · ${p.score} pts`,
    }));
  },
};

function buildHudUpdates(state: ColorClashState): Record<string, PlayerHudUpdate> {
  const activeId = state.players[state.activePlayerIndex]?.id;
  const out: Record<string, PlayerHudUpdate> = {};
  for (const p of state.players) {
    out[p.id] = {
      score: p.score,
      alive: true,
      statText:
        p.id === activeId && !state.winnerId
          ? `YOUR TURN · ${Math.ceil(Math.max(0, state.turnTimeLeft))}s`
          : `${p.hand.length} cards left`,
      cooldownA: p.id === activeId ? 0 : 0.6,
      cooldownB: p.id === activeId ? 0 : 0.6,
    };
  }
  return out;
}
