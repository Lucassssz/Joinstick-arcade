import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../../src/shared/cardLayout.ts';
import type {
  BoomKittensSnapshot,
  CardClientAction,
  CardPrivateState,
  CardShockwave,
  FlyingCardAnim,
  RankingEntry,
  SoundEvent,
} from '../../src/shared/types.ts';
import type { HapticTrigger, PlayerHudUpdate, ServerGameModule } from './engine.ts';

const TURN_LIMIT_SEC = 14.0;

type KittenCardKind = 'defuse' | 'skip' | 'attack' | 'see' | 'shuffle' | 'favor' | 'tacocat' | 'boom';

interface KittenCard {
  id: string;
  kind: KittenCardKind;
}

const CARD_META: Record<
  KittenCardKind,
  { title: string; subtitle: string; badge: string; accentHex: string; secondaryHex: string }
> = {
  defuse: {
    title: 'DEFUSE',
    subtitle: 'Saves from Boom',
    badge: 'SAFE',
    accentHex: '#10D98B',
    secondaryHex: '#065F46',
  },
  skip: {
    title: 'SKIP',
    subtitle: 'End turn no draw',
    badge: 'SKIP',
    accentHex: '#00C2FF',
    secondaryHex: '#0369A1',
  },
  attack: {
    title: 'ATTACK x2',
    subtitle: 'Next draws +2',
    badge: 'ATK',
    accentHex: '#FF4D2E',
    secondaryHex: '#991B1B',
  },
  see: {
    title: 'SEE FUTURE',
    subtitle: 'Peek top 3 cards',
    badge: 'PEEK',
    accentHex: '#A855F7',
    secondaryHex: '#581C87',
  },
  shuffle: {
    title: 'SHUFFLE',
    subtitle: 'Mix the deck',
    badge: 'MIX',
    accentHex: '#F59E0B',
    secondaryHex: '#92400E',
  },
  favor: {
    title: 'FAVOR',
    subtitle: 'Steal rival card',
    badge: 'STEAL',
    accentHex: '#EC4899',
    secondaryHex: '#9D174D',
  },
  tacocat: {
    title: 'TACOCAT',
    subtitle: '+60 bonus pts',
    badge: '+60',
    accentHex: '#FACC15',
    secondaryHex: '#854D0E',
  },
  boom: {
    title: 'BOOM!',
    subtitle: 'Explodes!',
    badge: 'BOOM',
    accentHex: '#EF4444',
    secondaryHex: '#7F1D1D',
  },
};

interface BoomPlayerInternal {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  alive: boolean;
  hand: KittenCard[];
  cursorIndex: number;
  score: number;
  lastAction: string | null;
  lastActionTimer: number;
  peekNote: string | null;
  peekTimer: number;
  joyCooldown: number;
}

export interface BoomKittensState {
  round: number;
  deck: KittenCard[];
  topDiscard: { label: string; badge: string; accentHex: string } | null;
  activePlayerIndex: number;
  drawsOwed: number;
  turnTimeLeft: number;
  turnTotal: number;
  botThinkTimer: number;
  banner: string | null;
  bannerColor: string | null;
  bannerTimer: number;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: BoomPlayerInternal[];
  winnerId: string | null;
  finishDelay: number;
  pendingSounds: SoundEvent[];
  pendingHaptics: HapticTrigger[];
}

let cardSeq = 1;
function makeCard(kind: KittenCardKind): KittenCard {
  return { id: `bk_${cardSeq++}_${Math.random().toString(36).slice(2, 6)}`, kind };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildActionDeck(): KittenCard[] {
  const list: KittenCard[] = [];
  const add = (kind: KittenCardKind, n: number) => {
    for (let i = 0; i < n; i++) list.push(makeCard(kind));
  };
  add('skip', 7);
  add('attack', 6);
  add('see', 6);
  add('shuffle', 5);
  add('favor', 5);
  add('tacocat', 9);
  add('defuse', 2);
  return shuffle(list);
}

function seatOf(state: BoomKittensState, playerId: string) {
  const idx = Math.max(0, state.players.findIndex((p) => p.id === playerId));
  return getCardSeatPosition(idx, state.players.length);
}

function setBanner(state: BoomKittensState, text: string, color: string, dur = 1.9) {
  state.banner = text;
  state.bannerColor = color;
  state.bannerTimer = dur;
}

function findNextAliveIndex(state: BoomKittensState, fromIdx: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + step) % n;
    if (state.players[idx]?.alive) return idx;
  }
  return fromIdx;
}

function checkWinner(state: BoomKittensState): boolean {
  const alive = state.players.filter((p) => p.alive);
  if (state.players.length >= 2 && alive.length <= 1) {
    const champ = alive[0] ?? state.players[0];
    if (champ) {
      state.winnerId = champ.id;
      champ.score += 500;
      setBanner(state, `${champ.name} SURVIVED!`, champ.colorHex, 3.5);
      state.pendingSounds.push({ type: 'win', playerId: champ.id });
    }
    return true;
  }
  if (state.players.length === 1 && (!alive.length || state.deck.length === 0)) {
    const solo = state.players[0];
    state.winnerId = solo.id;
    if (solo.alive) solo.score += 400;
    setBanner(state, solo.alive ? 'DECK CLEARED!' : 'BOOM!', solo.alive ? '#10D98B' : '#FF4D2E', 3.0);
    state.pendingSounds.push({ type: solo.alive ? 'win' : 'ko', playerId: solo.id });
    return true;
  }
  return false;
}

function advanceTurn(state: BoomKittensState, nextDrawsOwed = 1) {
  if (checkWinner(state)) return;
  state.activePlayerIndex = findNextAliveIndex(state, state.activePlayerIndex);
  state.drawsOwed = Math.max(1, nextDrawsOwed);
  state.turnTimeLeft = TURN_LIMIT_SEC;
  state.turnTotal = TURN_LIMIT_SEC;
  state.round += 1;
  state.botThinkTimer = 1.25 + Math.random() * 0.75;
}

function playCard(state: BoomKittensState, player: BoomPlayerInternal, cardIndex: number): boolean {
  if (state.winnerId) return false;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== player.id || !player.alive) return false;
  const card = player.hand[cardIndex];
  if (!card || card.kind === 'defuse' || card.kind === 'boom') return false;

  player.hand.splice(cardIndex, 1);
  if (player.cursorIndex >= player.hand.length) {
    player.cursorIndex = Math.max(0, player.hand.length - 1);
  }

  const meta = CARD_META[card.kind];
  const seat = seatOf(state, player.id);
  state.topDiscard = { label: meta.title, badge: meta.badge, accentHex: meta.accentHex };
  state.flyingCards.push({
    id: `fly_bk_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    fromX: seat.x,
    fromY: seat.y,
    toX: TABLE_CENTER_X + 78,
    toY: TABLE_CENTER_Y,
    progress: 0,
    faceUp: true,
    colorHex: meta.accentHex,
    rankText: meta.badge,
    rotStart: (Math.random() - 0.5) * 0.4,
    rotEnd: (Math.random() - 0.5) * 0.2,
  });
  state.pendingSounds.push({ type: 'card', playerId: player.id });
  state.pendingHaptics.push({ playerId: player.id, pattern: 35, reason: 'confirm' });

  player.lastAction = meta.title;
  player.lastActionTimer = 2.4;

  switch (card.kind) {
    case 'skip': {
      player.score += 65;
      state.drawsOwed = Math.max(0, state.drawsOwed - 1);
      setBanner(state, `${player.name} SKIPPED!`, meta.accentHex, 1.5);
      state.popups.push({ x: seat.x, y: seat.y - 44, text: 'SKIP!', colorHex: meta.accentHex, alpha: 1.4 });
      if (state.drawsOwed === 0) {
        advanceTurn(state, 1);
      }
      break;
    }
    case 'attack': {
      player.score += 90;
      const nextOwed = state.drawsOwed + 1;
      setBanner(state, `ATTACK! NEXT DRAWS x${nextOwed}`, meta.accentHex, 1.8);
      state.shockwaves.push({
        x: TABLE_CENTER_X,
        y: TABLE_CENTER_Y,
        radius: 20,
        maxRadius: 230,
        colorHex: meta.accentHex,
        alpha: 0.95,
      });
      advanceTurn(state, nextOwed);
      break;
    }
    case 'see': {
      player.score += 50;
      const top3 = state.deck
        .slice(-3)
        .reverse()
        .map((c) => (c.kind === 'boom' ? 'BOOM!' : CARD_META[c.kind].badge));
      player.peekNote = `TOP 3: ${top3.length > 0 ? top3.join(' -> ') : 'EMPTY'}`;
      player.peekTimer = 9.0;
      setBanner(state, `${player.name} PEEKED FUTURE!`, meta.accentHex, 1.4);
      state.popups.push({ x: seat.x, y: seat.y - 44, text: 'PEEKED!', colorHex: meta.accentHex, alpha: 1.3 });
      break;
    }
    case 'shuffle': {
      player.score += 55;
      state.deck = shuffle(state.deck);
      setBanner(state, 'DECK SHUFFLED!', meta.accentHex, 1.4);
      state.shockwaves.push({
        x: TABLE_CENTER_X - 88,
        y: TABLE_CENTER_Y,
        radius: 18,
        maxRadius: 170,
        colorHex: meta.accentHex,
        alpha: 0.9,
      });
      break;
    }
    case 'favor': {
      const rivals = state.players.filter((p) => p.id !== player.id && p.alive && p.hand.length > 0);
      if (rivals.length > 0) {
        rivals.sort((a, b) => b.hand.length - a.hand.length);
        const victim = rivals[0];
        const stealIdx = Math.floor(Math.random() * victim.hand.length);
        const [stolen] = victim.hand.splice(stealIdx, 1);
        if (stolen) {
          player.hand.push(stolen);
          const vSeat = seatOf(state, victim.id);
          state.flyingCards.push({
            id: `fly_steal_${Date.now()}`,
            fromX: vSeat.x,
            fromY: vSeat.y,
            toX: seat.x,
            toY: seat.y,
            progress: 0,
            faceUp: false,
            colorHex: meta.accentHex,
            rotStart: 0.2,
            rotEnd: -0.2,
          });
          state.popups.push({
            x: vSeat.x,
            y: vSeat.y - 44,
            text: 'STOLEN!',
            colorHex: meta.accentHex,
            alpha: 1.4,
          });
        }
        player.score += 85;
        setBanner(state, `${player.name} STOLE FROM ${victim.name}!`, meta.accentHex, 1.7);
      } else {
        player.score += 40;
      }
      break;
    }
    case 'tacocat': {
      player.score += 60;
      state.popups.push({ x: seat.x, y: seat.y - 44, text: '+60 TACOCAT!', colorHex: meta.accentHex, alpha: 1.4 });
      break;
    }
  }
  return true;
}

function drawCardAction(state: BoomKittensState, player: BoomPlayerInternal) {
  if (state.winnerId) return;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== player.id || !player.alive) return;

  if (state.deck.length === 0) {
    // Reseed safe deck + 1 bomb so game always finishes dramatically
    const extra = buildActionDeck().slice(0, 12);
    extra.push(makeCard('boom'));
    state.deck = shuffle(extra);
  }

  const drawn = state.deck.pop()!;
  const seat = seatOf(state, player.id);

  state.flyingCards.push({
    id: `fly_bk_draw_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    fromX: TABLE_CENTER_X - 88,
    fromY: TABLE_CENTER_Y,
    toX: seat.x,
    toY: seat.y,
    progress: 0,
    faceUp: drawn.kind === 'boom',
    colorHex: drawn.kind === 'boom' ? '#EF4444' : player.colorHex,
    rankText: drawn.kind === 'boom' ? 'BOOM!' : undefined,
    rotStart: -0.25,
    rotEnd: 0.15,
  });

  if (drawn.kind === 'boom') {
    const defuseIdx = player.hand.findIndex((c) => c.kind === 'defuse');
    if (defuseIdx >= 0) {
      player.hand.splice(defuseIdx, 1);
      // Re-insert boom safely into deck at random position
      const insertAt = Math.floor(Math.random() * (state.deck.length + 1));
      state.deck.splice(insertAt, 0, drawn);
      player.score += 150;
      player.lastAction = 'DEFUSED!';
      player.lastActionTimer = 2.8;
      state.topDiscard = { label: 'DEFUSED!', badge: 'SAFE', accentHex: '#10D98B' };
      setBanner(state, `${player.name} DEFUSED THE BOOM!`, '#10D98B', 2.2);
      state.shockwaves.push({
        x: seat.x,
        y: seat.y,
        radius: 22,
        maxRadius: 240,
        colorHex: '#10D98B',
        alpha: 1,
      });
      state.popups.push({ x: seat.x, y: seat.y - 48, text: 'DEFUSED! +150', colorHex: '#10D98B', alpha: 1.6 });
      state.pendingSounds.push({ type: 'pickup', playerId: player.id });
      state.pendingHaptics.push({ playerId: player.id, pattern: [50, 30, 90], reason: 'confirm' });
    } else {
      player.alive = false;
      player.lastAction = 'BOOM!!';
      player.lastActionTimer = 4.0;
      state.topDiscard = { label: 'BOOM!!', badge: 'KO', accentHex: '#EF4444' };
      setBanner(state, `${player.name} EXPLODED!!`, '#EF4444', 2.6);
      state.shockwaves.push({
        x: seat.x,
        y: seat.y,
        radius: 28,
        maxRadius: 320,
        colorHex: '#EF4444',
        alpha: 1,
      });
      state.popups.push({ x: seat.x, y: seat.y - 48, text: 'BOOM!!', colorHex: '#EF4444', alpha: 1.7 });
      state.pendingSounds.push({ type: 'ko', playerId: player.id });
      state.pendingHaptics.push({ playerId: player.id, pattern: [120, 40, 140], reason: 'hit' });
      advanceTurn(state, 1);
      return;
    }
  } else {
    player.hand.push(drawn);
    player.score += 30;
    player.lastAction = 'DREW SAFE';
    player.lastActionTimer = 2.0;
    state.popups.push({ x: seat.x, y: seat.y - 44, text: 'SAFE DRAW', colorHex: '#10D98B', alpha: 1.2 });
    state.pendingSounds.push({ type: 'card', playerId: player.id });
  }

  state.drawsOwed = Math.max(0, state.drawsOwed - 1);
  if (state.drawsOwed === 0) {
    advanceTurn(state, 1);
  } else {
    state.turnTimeLeft = TURN_LIMIT_SEC;
    state.botThinkTimer = 1.0;
  }
}

function buildPrivateState(state: BoomKittensState, p: BoomPlayerInternal): CardPrivateState {
  const active = state.players[state.activePlayerIndex];
  const isMyTurn = Boolean(active && active.id === p.id && p.alive && !state.winnerId);
  const bombsLeft = state.deck.filter((c) => c.kind === 'boom').length;
  const riskPct = state.deck.length > 0 ? Math.round((bombsLeft / state.deck.length) * 100) : 0;

  let statusHint = !p.alive
    ? 'Exploded! Watch the survivors.'
    : isMyTurn
      ? p.peekNote ?? `Play actions or Draw (${state.drawsOwed} owed) · Boom risk ${riskPct}%`
      : `${active?.name ?? 'Player'}'s turn · Boom risk ${riskPct}%`;
  let statusHintZh = !p.alive
    ? '已爆炸！观战幸存者'
    : isMyTurn
      ? p.peekNote ?? `打出功能牌或抽牌（需抽${state.drawsOwed}张）· 爆炸率 ${riskPct}%`
      : `等待 ${active?.name ?? '玩家'} 行动 · 爆炸率 ${riskPct}%`;

  return {
    gameId: 'boom-kittens',
    playerId: p.id,
    hand: p.hand.map((c, idx) => {
      const m = CARD_META[c.kind];
      const playable = isMyTurn && c.kind !== 'defuse' && c.kind !== 'boom';
      return {
        id: c.id,
        kind: 'party',
        title: m.title,
        subtitle: m.subtitle,
        badge: m.badge,
        accentHex: m.accentHex,
        secondaryHex: m.secondaryHex,
        playable,
        selected: idx === p.cursorIndex,
      };
    }),
    cursorIndex: p.cursorIndex,
    isMyTurn,
    isActionRequired: isMyTurn,
    turnTimeLeft: state.turnTimeLeft,
    turnTotal: state.turnTotal,
    badgeText: `BOOM RISK ${riskPct}% · DECK ${state.deck.length}`,
    badgeColorHex: riskPct >= 35 ? '#EF4444' : '#F59E0B',
    primaryBtn: {
      label: state.drawsOwed > 1 ? `DRAW (${state.drawsOwed} LEFT)` : 'DRAW CARD',
      labelZh: state.drawsOwed > 1 ? `抽牌 (剩${state.drawsOwed}张)` : '安全抽牌',
      action: { type: 'draw-or-pass' },
      colorHex: '#FF4D2E',
      disabled: !isMyTurn,
    },
    secondaryBtn: {
      label: 'PLAY SELECTED',
      labelZh: '打出选中牌',
      action: { type: 'play-card' },
      colorHex: '#10D98B',
      disabled: !isMyTurn || !p.hand[p.cursorIndex] || p.hand[p.cursorIndex]?.kind === 'defuse',
    },
    statusHint,
    statusHintZh,
  };
}

export const boomKittensModule: ServerGameModule<BoomKittensState> = {
  id: 'boom-kittens',

  createState(players, settingValue) {
    const startCards = Math.max(4, Math.min(7, settingValue || 5));
    const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
    const deck = buildActionDeck();

    const internalPlayers: BoomPlayerInternal[] = sorted.map((p) => {
      const hand: KittenCard[] = [makeCard('defuse')];
      for (let i = 1; i < startCards; i++) {
        const c = deck.pop();
        if (c) hand.push(c);
      }
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        isBot: p.isBot,
        alive: true,
        hand,
        cursorIndex: 0,
        score: 0,
        lastAction: null,
        lastActionTimer: 0,
        peekNote: null,
        peekTimer: 0,
        joyCooldown: 0,
      };
    });

    // Insert Boom cards proportional to player count
    const bombCount = Math.max(2, internalPlayers.length);
    for (let i = 0; i < bombCount; i++) {
      deck.push(makeCard('boom'));
    }

    return {
      round: 1,
      deck: shuffle(deck),
      topDiscard: null,
      activePlayerIndex: 0,
      drawsOwed: 1,
      turnTimeLeft: TURN_LIMIT_SEC,
      turnTotal: TURN_LIMIT_SEC,
      botThinkTimer: 1.5,
      banner: 'AVOID THE BOOM KITTENS!',
      bannerColor: '#FF4D2E',
      bannerTimer: 2.2,
      flyingCards: [],
      shockwaves: [],
      popups: [],
      players: internalPlayers,
      winnerId: null,
      finishDelay: 2.4,
      pendingSounds: [{ type: 'card' }],
      pendingHaptics: [],
    };
  },

  handleCardAction(state, playerId, action) {
    const p = state.players.find((pl) => pl.id === playerId);
    if (!p || !p.alive || state.winnerId) return;
    if (action.type === 'select-index') {
      if (p.hand.length > 0) p.cursorIndex = Math.max(0, Math.min(p.hand.length - 1, action.index));
    } else if (action.type === 'play-card') {
      const idx = action.cardId ? p.hand.findIndex((c) => c.id === action.cardId) : p.cursorIndex;
      if (idx >= 0) playCard(state, p, idx);
    } else if (action.type === 'draw-or-pass') {
      drawCardAction(state, p);
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
      state.flyingCards[i].progress += dt * 1.85;
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
      if (p.peekTimer > 0) {
        p.peekTimer -= dt;
        if (p.peekTimer <= 0) p.peekNote = null;
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
    if (active && active.alive) {
      state.turnTimeLeft -= dt;
      if (active.isBot) {
        state.botThinkTimer -= dt;
        if (state.botThinkTimer <= 0) {
          const topIsBoom = state.deck.length > 0 && state.deck[state.deck.length - 1].kind === 'boom';
          const skipIdx = active.hand.findIndex((c) => c.kind === 'skip' || c.kind === 'attack');
          const actionIdx = active.hand.findIndex((c) => c.kind !== 'defuse' && c.kind !== 'boom');
          if ((state.drawsOwed > 1 || topIsBoom) && skipIdx >= 0 && Math.random() < 0.78) {
            playCard(state, active, skipIdx);
            state.botThinkTimer = 0.85;
          } else if (actionIdx >= 0 && Math.random() < 0.48) {
            playCard(state, active, actionIdx);
            state.botThinkTimer = 0.85;
          } else {
            drawCardAction(state, active);
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
            if (!playCard(state, active, active.cursorIndex)) {
              drawCardAction(state, active);
            }
          } else if (justB) {
            drawCardAction(state, active);
          }
        }
      }

      if (!state.winnerId && state.turnTimeLeft <= 0) {
        drawCardAction(state, active);
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

  getSnapshot(state): BoomKittensSnapshot {
    return {
      gameId: 'boom-kittens',
      round: state.round,
      activePlayerId: state.players[state.activePlayerIndex]?.id ?? '',
      turnTimeLeft: Math.max(0, state.turnTimeLeft),
      turnTotal: state.turnTotal,
      deckCount: state.deck.length,
      bombsInDeck: state.deck.filter((c) => c.kind === 'boom').length,
      drawsOwed: state.drawsOwed,
      topDiscard: state.topDiscard,
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
        alive: p.alive,
        cardCount: p.hand.length,
        defuseCount: p.hand.filter((c) => c.kind === 'defuse').length,
        score: p.score,
        lastAction: p.lastAction,
      })),
    };
  },

  getRankings(state): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return a.slotIndex - b.slotIndex;
    });
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: { id: `p${p.slotIndex}`, name: p.name, hex: p.colorHex, dark: p.colorHex, textOnColor: '#FFFFFF' },
      rank: idx + 1,
      score: p.score,
      highlight: p.alive ? `SURVIVED · ${p.score} pts` : `BOOM! · ${p.score} pts`,
    }));
  },
};

function buildHudUpdates(state: BoomKittensState): Record<string, PlayerHudUpdate> {
  const activeId = state.players[state.activePlayerIndex]?.id;
  const out: Record<string, PlayerHudUpdate> = {};
  for (const p of state.players) {
    out[p.id] = {
      score: p.score,
      alive: p.alive,
      statText: !p.alive ? 'EXPLODED' : p.id === activeId ? `DRAW x${state.drawsOwed}` : `${p.hand.length} cards`,
      cooldownA: p.id === activeId ? 0 : 0.6,
      cooldownB: p.id === activeId ? 0 : 0.6,
    };
  }
  return out;
}
