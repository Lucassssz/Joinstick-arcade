import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../../src/shared/cardLayout.ts';
import type {
  CardColor,
  CardPrivateState,
  CardShockwave,
  DarkFlipClashSnapshot,
  FlyingCardAnim,
  RankingEntry,
  SoundEvent,
} from '../../src/shared/types.ts';
import type { HapticTrigger, PlayerHudUpdate, ServerGameModule } from './engine.ts';

const TURN_LIMIT_SEC = 14.0;
const BASIC_COLORS: Exclude<CardColor, 'wild'>[] = ['red', 'blue', 'gold', 'green'];

const LIGHT_HEX: Record<Exclude<CardColor, 'wild'>, string> = {
  red: '#FF4D2E',
  blue: '#00C2FF',
  gold: '#FFB800',
  green: '#10D98B',
};

const DARK_HEX: Record<Exclude<CardColor, 'wild'>, string> = {
  red: '#EC4899',
  blue: '#22D3EE',
  gold: '#F97316',
  green: '#A855F7',
};

interface DualCard {
  id: string;
  light: { color: CardColor; value: string };
  dark: { color: CardColor; value: string };
}

interface DarkFlipPlayerInternal {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  hand: DualCard[];
  cursorIndex: number;
  score: number;
  lastAction: string | null;
  lastActionTimer: number;
  joyCooldown: number;
  colorCursor: number;
}

export interface DarkFlipClashState {
  side: 'light' | 'dark';
  deck: DualCard[];
  discardPile: DualCard[];
  topCard: DualCard;
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
  players: DarkFlipPlayerInternal[];
  winnerId: string | null;
  finishDelay: number;
  pendingSounds: SoundEvent[];
  pendingHaptics: HapticTrigger[];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function faceOf(card: DualCard, side: 'light' | 'dark') {
  return side === 'light' ? card.light : card.dark;
}

function colorHexFor(side: 'light' | 'dark', col: CardColor): string {
  if (col === 'wild') return side === 'dark' ? '#C084FC' : '#A855F7';
  return side === 'dark' ? DARK_HEX[col] : LIGHT_HEX[col];
}

function buildDualDeck(): DualCard[] {
  const lightFaces: { color: CardColor; value: string }[] = [];
  const darkFaces: { color: CardColor; value: string }[] = [];

  for (const col of BASIC_COLORS) {
    for (let n = 1; n <= 9; n++) {
      lightFaces.push({ color: col, value: String(n) });
      darkFaces.push({ color: col, value: String(n) });
    }
    lightFaces.push({ color: col, value: 'SKIP' }, { color: col, value: 'REV' }, { color: col, value: '+2' }, { color: col, value: 'FLIP' }, { color: col, value: 'FLIP' });
    darkFaces.push({ color: col, value: 'SKIP ALL' }, { color: col, value: 'REV' }, { color: col, value: '+5' }, { color: col, value: 'FLIP' }, { color: col, value: 'FLIP' });
  }
  for (let i = 0; i < 4; i++) {
    lightFaces.push({ color: 'wild', value: 'WILD' });
    darkFaces.push({ color: 'wild', value: 'WILD +3' });
  }

  const sLight = shuffle(lightFaces);
  const sDark = shuffle(darkFaces);
  const deck: DualCard[] = [];
  for (let i = 0; i < sLight.length; i++) {
    deck.push({
      id: `df_${i}_${Math.random().toString(36).slice(2, 5)}`,
      light: sLight[i],
      dark: sDark[i],
    });
  }
  return shuffle(deck);
}

function drawCard(state: DarkFlipClashState): DualCard {
  if (state.deck.length === 0) {
    if (state.discardPile.length > 1) {
      const top = state.discardPile.pop()!;
      state.deck = shuffle(state.discardPile);
      state.discardPile = [top];
    } else {
      state.deck = buildDualDeck();
    }
  }
  return state.deck.pop()!;
}

function isPlayable(state: DarkFlipClashState, card: DualCard): boolean {
  const f = faceOf(card, state.side);
  const topF = faceOf(state.topCard, state.side);
  if (state.drawPenalty > 0) {
    return f.value === '+2' || f.value === '+5' || f.value === 'WILD +3';
  }
  if (f.color === 'wild') return true;
  return f.color === state.activeColor || f.value === topF.value;
}

function pickBestColor(hand: DualCard[], side: 'light' | 'dark'): Exclude<CardColor, 'wild'> {
  const counts: Record<Exclude<CardColor, 'wild'>, number> = { red: 0, blue: 0, gold: 0, green: 0 };
  for (const c of hand) {
    const col = faceOf(c, side).color;
    if (col !== 'wild') counts[col] += 1;
  }
  return BASIC_COLORS.sort((a, b) => counts[b] - counts[a])[0];
}

function seatOf(state: DarkFlipClashState, id: string) {
  const idx = Math.max(0, state.players.findIndex((p) => p.id === id));
  return getCardSeatPosition(idx, state.players.length);
}

function setBanner(state: DarkFlipClashState, text: string, color: string, dur = 1.9) {
  state.banner = text;
  state.bannerColor = color;
  state.bannerTimer = dur;
}

function advanceTurn(state: DarkFlipClashState, steps = 1) {
  const n = state.players.length;
  state.activePlayerIndex = ((state.activePlayerIndex + state.direction * steps) % n + n) % n;
  state.awaitingColorPick = false;
  state.turnTimeLeft = TURN_LIMIT_SEC;
  state.turnCount += 1;
  state.botThinkTimer = 1.15 + Math.random() * 0.65;
}

function playCard(state: DarkFlipClashState, player: DarkFlipPlayerInternal, idx: number): boolean {
  if (state.winnerId || state.awaitingColorPick) return false;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== player.id) return false;
  const card = player.hand[idx];
  if (!card || !isPlayable(state, card)) return false;

  player.hand.splice(idx, 1);
  if (player.cursorIndex >= player.hand.length) {
    player.cursorIndex = Math.max(0, player.hand.length - 1);
  }

  const f = faceOf(card, state.side);
  state.topCard = card;
  state.discardPile.push(card);
  if (f.color !== 'wild') state.activeColor = f.color;

  player.score += f.value === 'FLIP' ? 95 : f.value === '+5' || f.value === 'WILD +3' ? 110 : 50;
  player.lastAction = f.value;
  player.lastActionTimer = 2.4;

  const seat = seatOf(state, player.id);
  state.flyingCards.push({
    id: `fly_df_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    fromX: seat.x,
    fromY: seat.y,
    toX: TABLE_CENTER_X + 74,
    toY: TABLE_CENTER_Y,
    progress: 0,
    faceUp: true,
    colorHex: colorHexFor(state.side, f.color),
    rankText: f.value,
    rotStart: -0.25,
    rotEnd: 0.14,
  });
  state.pendingSounds.push({ type: 'card', playerId: player.id });
  state.pendingHaptics.push({ playerId: player.id, pattern: 40, reason: 'confirm' });

  if (player.hand.length === 0) {
    state.winnerId = player.id;
    player.score += 800;
    setBanner(state, `${player.name} WINS DARK FLIP!`, player.colorHex, 3.6);
    state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 26, maxRadius: 340, colorHex: player.colorHex, alpha: 1 });
    state.pendingSounds.push({ type: 'win', playerId: player.id });
    return true;
  }

  if (f.value === 'FLIP') {
    state.side = state.side === 'light' ? 'dark' : 'light';
    const flippedTop = faceOf(state.topCard, state.side);
    state.activeColor = flippedTop.color === 'wild' ? pickBestColor(player.hand, state.side) : flippedTop.color;
    setBanner(
      state,
      state.side === 'dark' ? 'DARK SIDE UNLEASHED!!' : 'BACK TO LIGHT SIDE!',
      state.side === 'dark' ? '#A855F7' : '#FFB800',
      2.2
    );
    state.shockwaves.push({
      x: TABLE_CENTER_X,
      y: TABLE_CENTER_Y,
      radius: 24,
      maxRadius: 340,
      colorHex: state.side === 'dark' ? '#A855F7' : '#FFB800',
      alpha: 1,
    });
    state.pendingSounds.push({ type: 'pickup', playerId: player.id });
    advanceTurn(state, 1);
    return true;
  }

  if (f.value === 'SKIP') {
    setBanner(state, 'SKIP!', colorHexFor(state.side, state.activeColor), 1.4);
    advanceTurn(state, 2);
    return true;
  }

  if (f.value === 'SKIP ALL') {
    setBanner(state, `${player.name} SKIPPED EVERYONE! GO AGAIN!`, '#EC4899', 1.8);
    state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 20, maxRadius: 240, colorHex: '#EC4899', alpha: 0.95 });
    state.turnTimeLeft = TURN_LIMIT_SEC;
    state.botThinkTimer = 1.0;
    return true;
  }

  if (f.value === 'REV') {
    if (state.players.length <= 2) {
      advanceTurn(state, 2);
    } else {
      state.direction = state.direction === 1 ? -1 : 1;
      advanceTurn(state, 1);
    }
    setBanner(state, 'REVERSE!', colorHexFor(state.side, state.activeColor), 1.4);
    return true;
  }

  if (f.value === '+2' || f.value === '+5') {
    const add = f.value === '+5' ? 5 : 2;
    state.drawPenalty += add;
    setBanner(state, `DRAW STACK +${state.drawPenalty}!`, '#EF4444', 1.7);
    advanceTurn(state, 1);
    return true;
  }

  if (f.value === 'WILD' || f.value === 'WILD +3') {
    if (f.value === 'WILD +3') state.drawPenalty += 3;
    if (player.isBot) {
      state.activeColor = pickBestColor(player.hand, state.side);
      advanceTurn(state, 1);
    } else {
      state.awaitingColorPick = true;
      state.turnTimeLeft = Math.max(state.turnTimeLeft, 7.0);
      setBanner(state, 'PICK THE NEW COLOR!', '#A855F7', 2.0);
    }
    return true;
  }

  advanceTurn(state, 1);
  return true;
}

function drawOrPenalty(state: DarkFlipClashState, player: DarkFlipPlayerInternal) {
  if (state.winnerId) return;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== player.id) return;

  if (state.awaitingColorPick) {
    state.activeColor = pickBestColor(player.hand, state.side);
    state.awaitingColorPick = false;
    advanceTurn(state, 1);
    return;
  }

  const count = state.drawPenalty > 0 ? state.drawPenalty : 1;
  state.drawPenalty = 0;
  const seat = seatOf(state, player.id);
  for (let i = 0; i < count; i++) {
    player.hand.push(drawCard(state));
  }
  player.lastAction = `DREW +${count}`;
  player.lastActionTimer = 2.4;
  state.popups.push({ x: seat.x, y: seat.y - 44, text: `DREW +${count}`, colorHex: count > 1 ? '#EF4444' : '#FFB800', alpha: 1.4 });
  state.pendingSounds.push({ type: 'card', playerId: player.id });
  advanceTurn(state, 1);
}

function buildPrivateState(state: DarkFlipClashState, p: DarkFlipPlayerInternal): CardPrivateState {
  const active = state.players[state.activePlayerIndex];
  const isMyTurn = Boolean(active && active.id === p.id && !state.winnerId);
  const canPickColor = isMyTurn && state.awaitingColorPick;

  return {
    gameId: 'dark-flip-clash',
    playerId: p.id,
    hand: p.hand.map((c, idx) => {
      const f = faceOf(c, state.side);
      return {
        id: c.id,
        kind: 'clash',
        color: f.color,
        value: f.value,
        playable: isMyTurn && !state.awaitingColorPick && isPlayable(state, c),
        selected: idx === p.cursorIndex,
      };
    }),
    cursorIndex: p.cursorIndex,
    isMyTurn,
    isActionRequired: isMyTurn,
    turnTimeLeft: state.turnTimeLeft,
    turnTotal: state.turnTotal,
    activeColor: state.activeColor,
    awaitingColorPick: canPickColor,
    drawPenalty: state.drawPenalty,
    badgeText: state.side === 'dark' ? 'DARK SIDE · HIGH STAKES (+5)' : 'LIGHT SIDE · FLIP TO GO DARK',
    badgeColorHex: state.side === 'dark' ? '#A855F7' : '#FFB800',
    statusHint: canPickColor
      ? 'Pick the new color!'
      : isMyTurn
        ? state.drawPenalty > 0
          ? `Stack penalty or Draw +${state.drawPenalty}!`
          : `Your turn (${state.side.toUpperCase()} SIDE)! Tap a glowing card.`
        : `${active?.name ?? 'Player'}'s turn (${state.side.toUpperCase()} SIDE)`,
    statusHintZh: canPickColor
      ? '请选择新颜色！'
      : isMyTurn
        ? state.drawPenalty > 0
          ? `叠加罚牌或罚抽 +${state.drawPenalty} 张！`
          : `轮到你 (${state.side === 'dark' ? '暗面高能' : '光面'})！点按发光牌`
        : `等待 ${active?.name ?? '玩家'} 出牌`,
  };
}

export const darkFlipClashModule: ServerGameModule<DarkFlipClashState> = {
  id: 'dark-flip-clash',

  createState(players, settingValue) {
    const startCards = Math.max(5, Math.min(9, settingValue || 7));
    const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
    const deck = buildDualDeck();

    const internalPlayers: DarkFlipPlayerInternal[] = sorted.map((p) => {
      const hand: DualCard[] = [];
      for (let i = 0; i < startCards; i++) {
        const c = deck.pop();
        if (c) hand.push(c);
      }
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        isBot: p.isBot,
        hand,
        cursorIndex: 0,
        score: 0,
        lastAction: null,
        lastActionTimer: 0,
        joyCooldown: 0,
        colorCursor: 0,
      };
    });

    let topIdx = deck.findIndex((c) => c.light.color !== 'wild' && c.light.value !== 'FLIP');
    if (topIdx < 0) topIdx = 0;
    const [topCard] = deck.splice(topIdx, 1);
    const activeColor: Exclude<CardColor, 'wild'> = topCard.light.color === 'wild' ? 'red' : topCard.light.color;

    return {
      side: 'light',
      deck,
      discardPile: [topCard],
      topCard,
      activeColor,
      direction: 1,
      activePlayerIndex: 0,
      drawPenalty: 0,
      awaitingColorPick: false,
      turnTimeLeft: TURN_LIMIT_SEC,
      turnTotal: TURN_LIMIT_SEC,
      turnCount: 0,
      botThinkTimer: 1.3,
      banner: 'PLAY FLIP TO UNLEASH THE DARK SIDE!',
      bannerColor: '#A855F7',
      bannerTimer: 2.3,
      flyingCards: [],
      shockwaves: [],
      popups: [],
      players: internalPlayers,
      winnerId: null,
      finishDelay: 2.3,
      pendingSounds: [{ type: 'card' }],
      pendingHaptics: [],
    };
  },

  handleCardAction(state, playerId, action) {
    const p = state.players.find((pl) => pl.id === playerId);
    if (!p || state.winnerId) return;
    if (action.type === 'select-index' && p.hand.length > 0) {
      p.cursorIndex = Math.max(0, Math.min(p.hand.length - 1, action.index));
    } else if (action.type === 'play-card') {
      const idx = action.cardId ? p.hand.findIndex((c) => c.id === action.cardId) : p.cursorIndex;
      if (idx >= 0) playCard(state, p, idx);
    } else if (action.type === 'draw-or-pass') {
      drawOrPenalty(state, p);
    } else if (action.type === 'pick-color') {
      const active = state.players[state.activePlayerIndex];
      if (active && active.id === p.id && state.awaitingColorPick) {
        state.activeColor = action.color;
        state.awaitingColorPick = false;
        advanceTurn(state, 1);
      }
    }
  },

  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      if (!p.isBot) out[p.id] = buildPrivateState(state, p);
    }
    return out;
  },

  step(state, inputPlayers, dt) {
    const sounds = state.pendingSounds.splice(0, state.pendingSounds.length);
    const haptics = state.pendingHaptics.splice(0, state.pendingHaptics.length);

    for (let i = state.flyingCards.length - 1; i >= 0; i--) {
      state.flyingCards[i].progress += dt * 1.9;
      if (state.flyingCards[i].progress >= 1.15) state.flyingCards.splice(i, 1);
    }
    for (let i = state.shockwaves.length - 1; i >= 0; i--) {
      const sw = state.shockwaves[i];
      sw.radius += dt * 320;
      sw.alpha -= dt * 1.1;
      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) state.shockwaves.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      state.popups[i].y -= dt * 26;
      state.popups[i].alpha -= dt * 0.85;
      if (state.popups[i].alpha <= 0) state.popups.splice(i, 1);
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

    const active = state.players[state.activePlayerIndex];
    if (active) {
      state.turnTimeLeft -= dt;
      if (active.isBot) {
        state.botThinkTimer -= dt;
        if (state.botThinkTimer <= 0) {
          const playable: number[] = [];
          active.hand.forEach((c, idx) => {
            if (isPlayable(state, c)) playable.push(idx);
          });
          if (playable.length > 0) {
            // Love playing FLIP and +5!
            playable.sort((ia, ib) => {
              const va = faceOf(active.hand[ia], state.side).value;
              const vb = faceOf(active.hand[ib], state.side).value;
              const sc = (v: string) => (v === 'FLIP' ? 6 : v === '+5' || v === 'SKIP ALL' ? 5 : v === '+2' ? 4 : 2);
              return sc(vb) - sc(va);
            });
            playCard(state, active, playable[0]);
          } else {
            drawOrPenalty(state, active);
          }
        }
      } else {
        const inp = inputPlayers.find((ip) => ip.id === active.id);
        if (inp) {
          const justA = inp.input.a && !inp.prevA;
          const justB = inp.input.b && !inp.prevB;
          if (Math.abs(inp.input.dx) > 0.5 && active.joyCooldown <= 0 && active.hand.length > 0) {
            const dir = inp.input.dx > 0 ? 1 : -1;
            active.cursorIndex = (active.cursorIndex + dir + active.hand.length) % active.hand.length;
            active.joyCooldown = 0.22;
            sounds.push({ type: 'nav', playerId: active.id });
          }
          if (justA) {
            if (state.awaitingColorPick) {
              state.activeColor = pickBestColor(active.hand, state.side);
              state.awaitingColorPick = false;
              advanceTurn(state, 1);
            } else {
              playCard(state, active, active.cursorIndex);
            }
          } else if (justB) {
            drawOrPenalty(state, active);
          }
        }
      }
      if (!state.winnerId && state.turnTimeLeft <= 0) {
        drawOrPenalty(state, active);
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

  getSnapshot(state): DarkFlipClashSnapshot {
    const topF = faceOf(state.topCard, state.side);
    return {
      gameId: 'dark-flip-clash',
      side: state.side,
      activeColor: state.activeColor,
      topCard: { color: topF.color, value: topF.value },
      direction: state.direction,
      activePlayerId: state.players[state.activePlayerIndex]?.id ?? '',
      awaitingColorPick: state.awaitingColorPick,
      drawPenalty: state.drawPenalty,
      turnTimeLeft: Math.max(0, state.turnTimeLeft),
      turnTotal: state.turnTotal,
      turnCount: state.turnCount,
      deckCount: state.deck.length,
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
      })),
    };
  },

  getRankings(state): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => {
      if (a.id === state.winnerId) return -1;
      if (b.id === state.winnerId) return 1;
      if (a.hand.length !== b.hand.length) return a.hand.length - b.hand.length;
      return b.score - a.score;
    });
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: { id: `p${p.slotIndex}`, name: p.name, hex: p.colorHex, dark: p.colorHex, textOnColor: '#FFFFFF' },
      rank: idx + 1,
      score: p.score,
      highlight: p.hand.length === 0 ? 'EMPTY HAND!' : `${p.hand.length} cards left`,
    }));
  },
};

function buildHudUpdates(state: DarkFlipClashState): Record<string, PlayerHudUpdate> {
  const activeId = state.players[state.activePlayerIndex]?.id;
  const out: Record<string, PlayerHudUpdate> = {};
  for (const p of state.players) {
    out[p.id] = {
      score: p.score,
      alive: true,
      statText: `${p.hand.length} cards · ${state.side.toUpperCase()}`,
      cooldownA: p.id === activeId ? 0 : 0.6,
      cooldownB: p.id === activeId ? 0 : 0.6,
    };
  }
  return out;
}
