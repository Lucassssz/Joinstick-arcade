import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../../src/shared/cardLayout.ts';
import type {
  CardPrivateState,
  CardShockwave,
  FlyingCardAnim,
  PropertyDealSnapshot,
  PropertySetView,
  RankingEntry,
  SoundEvent,
} from '../../src/shared/types.ts';
import type { HapticTrigger, PlayerHudUpdate, ServerGameModule } from './engine.ts';

const TURN_LIMIT_SEC = 16.0;
const MAX_ROUNDS = 10;

type PropColor = 'red' | 'blue' | 'gold' | 'green';
const PROP_COLORS: PropColor[] = ['red', 'blue', 'gold', 'green'];
const PROP_HEX: Record<PropColor, { hex: string; dark: string; label: string }> = {
  red: { hex: '#FF4D2E', dark: '#991B1B', label: 'RED AVE' },
  blue: { hex: '#00C2FF', dark: '#075985', label: 'BLUE PLAZA' },
  gold: { hex: '#FFB800', dark: '#92400E', label: 'GOLD TOWER' },
  green: { hex: '#10D98B', dark: '#065F46', label: 'EMERALD PARK' },
};

type DealCardKind =
  | { type: 'prop'; color: PropColor }
  | { type: 'wild-prop' }
  | { type: 'cash'; value: number }
  | { type: 'pass-go' }
  | { type: 'rent' }
  | { type: 'sly-deal' }
  | { type: 'debt' }
  | { type: 'deal-breaker' };

interface DealCard {
  id: string;
  kind: DealCardKind;
}

interface PropertyDealPlayerInternal {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  hand: DealCard[];
  bankCash: number;
  props: Record<PropColor, number>;
  cursorIndex: number;
  score: number;
  lastAction: string | null;
  lastActionTimer: number;
  joyCooldown: number;
}

export interface PropertyDealState {
  targetSets: number;
  round: number;
  maxRounds: number;
  turnsInRound: number;
  deck: DealCard[];
  activePlayerIndex: number;
  playsLeft: number;
  turnTimeLeft: number;
  turnTotal: number;
  botThinkTimer: number;
  lastPlayedCard: { title: string; subtitle: string; badge: string; accentHex: string } | null;
  banner: string | null;
  bannerColor: string | null;
  bannerTimer: number;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: PropertyDealPlayerInternal[];
  winnerId: string | null;
  finishDelay: number;
  pendingSounds: SoundEvent[];
  pendingHaptics: HapticTrigger[];
}

let pdSeq = 1;
function makeCard(kind: DealCardKind): DealCard {
  return { id: `pd_${pdSeq++}_${Math.random().toString(36).slice(2, 5)}`, kind };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDealDeck(): DealCard[] {
  const deck: DealCard[] = [];
  for (const color of PROP_COLORS) {
    for (let i = 0; i < 6; i++) deck.push(makeCard({ type: 'prop', color }));
  }
  for (let i = 0; i < 5; i++) deck.push(makeCard({ type: 'wild-prop' }));
  for (let i = 0; i < 6; i++) deck.push(makeCard({ type: 'cash', value: 2 }));
  for (let i = 0; i < 5; i++) deck.push(makeCard({ type: 'cash', value: 3 }));
  for (let i = 0; i < 4; i++) deck.push(makeCard({ type: 'cash', value: 5 }));
  for (let i = 0; i < 7; i++) deck.push(makeCard({ type: 'pass-go' }));
  for (let i = 0; i < 6; i++) deck.push(makeCard({ type: 'rent' }));
  for (let i = 0; i < 5; i++) deck.push(makeCard({ type: 'sly-deal' }));
  for (let i = 0; i < 5; i++) deck.push(makeCard({ type: 'debt' }));
  for (let i = 0; i < 3; i++) deck.push(makeCard({ type: 'deal-breaker' }));
  return shuffle(deck);
}

function drawCard(state: PropertyDealState): DealCard {
  if (state.deck.length === 0) state.deck = buildDealDeck();
  return state.deck.pop()!;
}

function cardDisplay(card: DealCard): { title: string; subtitle: string; badge: string; accentHex: string; secondaryHex: string } {
  const k = card.kind;
  switch (k.type) {
    case 'prop': {
      const m = PROP_HEX[k.color];
      return { title: m.label, subtitle: '2 = Full Set', badge: 'PROP', accentHex: m.hex, secondaryHex: m.dark };
    }
    case 'wild-prop':
      return { title: 'WILD DEED', subtitle: 'Fits any set', badge: 'WILD', accentHex: '#A855F7', secondaryHex: '#581C87' };
    case 'cash':
      return { title: `BANK $${k.value}M`, subtitle: 'Cash Vault', badge: `$${k.value}M`, accentHex: '#10D98B', secondaryHex: '#065F46' };
    case 'pass-go':
      return { title: 'PASS GO', subtitle: 'Draw +2 cards', badge: '+2', accentHex: '#38BDF8', secondaryHex: '#0369A1' };
    case 'rent':
      return { title: 'COLLECT RENT', subtitle: 'Tax all rivals', badge: 'RENT', accentHex: '#F59E0B', secondaryHex: '#92400E' };
    case 'sly-deal':
      return { title: 'SLY DEAL', subtitle: 'Steal 1 deed', badge: 'STEAL', accentHex: '#EC4899', secondaryHex: '#9D174D' };
    case 'debt':
      return { title: 'DEBT COLLECT', subtitle: 'Take $4M cash', badge: '$4M', accentHex: '#F97316', secondaryHex: '#9A3412' };
    case 'deal-breaker':
      return { title: 'DEAL BREAKER', subtitle: 'Heist top deed!', badge: 'HEIST', accentHex: '#EF4444', secondaryHex: '#7F1D1D' };
  }
}

function countCompletedSets(p: PropertyDealPlayerInternal): number {
  let sets = 0;
  for (const col of PROP_COLORS) {
    sets += Math.floor(p.props[col] / 2);
  }
  return sets;
}

function recomputeScore(p: PropertyDealPlayerInternal) {
  const sets = countCompletedSets(p);
  const totalProps = PROP_COLORS.reduce((s, c) => s + p.props[c], 0);
  p.score = sets * 300 + totalProps * 60 + p.bankCash * 15;
}

function seatOf(state: PropertyDealState, id: string) {
  const idx = Math.max(0, state.players.findIndex((p) => p.id === id));
  return getCardSeatPosition(idx, state.players.length);
}

function setBanner(state: PropertyDealState, text: string, color: string, dur = 1.8) {
  state.banner = text;
  state.bannerColor = color;
  state.bannerTimer = dur;
}

function startNextTurn(state: PropertyDealState) {
  if (state.winnerId) return;
  const n = state.players.length;
  state.activePlayerIndex = (state.activePlayerIndex + 1) % n;
  state.turnsInRound += 1;
  if (state.turnsInRound >= n) {
    state.turnsInRound = 0;
    state.round += 1;
    if (state.round > state.maxRounds) {
      const sorted = [...state.players].sort((a, b) => b.score - a.score);
      state.winnerId = sorted[0]?.id ?? null;
      if (sorted[0]) {
        setBanner(state, `${sorted[0].name} TYCOON WINS!`, sorted[0].colorHex, 3.5);
        state.pendingSounds.push({ type: 'win', playerId: sorted[0].id });
      }
      return;
    }
  }
  const active = state.players[state.activePlayerIndex];
  if (active) {
    // Draw 2 cards at start of turn (cap at 7)
    const drawN = active.hand.length === 0 ? 4 : 2;
    const seat = seatOf(state, active.id);
    for (let i = 0; i < drawN && active.hand.length < 7; i++) {
      active.hand.push(drawCard(state));
      state.flyingCards.push({
        id: `fly_pd_d_${Date.now()}_${i}`,
        fromX: TABLE_CENTER_X - 104,
        fromY: TABLE_CENTER_Y,
        toX: seat.x,
        toY: seat.y,
        progress: -i * 0.14,
        faceUp: false,
        colorHex: active.colorHex,
        rotStart: -0.2,
        rotEnd: 0.15,
      });
    }
  }
  state.playsLeft = 3;
  state.turnTimeLeft = TURN_LIMIT_SEC;
  state.turnTotal = TURN_LIMIT_SEC;
  state.botThinkTimer = 1.0 + Math.random() * 0.55;
}

function playDealCard(state: PropertyDealState, player: PropertyDealPlayerInternal, cardIndex: number): boolean {
  if (state.winnerId || state.playsLeft <= 0) return false;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== player.id) return false;
  const card = player.hand[cardIndex];
  if (!card) return false;

  player.hand.splice(cardIndex, 1);
  if (player.cursorIndex >= player.hand.length) {
    player.cursorIndex = Math.max(0, player.hand.length - 1);
  }
  state.playsLeft -= 1;

  const disp = cardDisplay(card);
  const seat = seatOf(state, player.id);
  state.lastPlayedCard = {
    title: disp.title,
    subtitle: disp.subtitle,
    badge: disp.badge,
    accentHex: disp.accentHex,
  };
  state.flyingCards.push({
    id: `fly_pd_p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
    fromX: seat.x,
    fromY: seat.y,
    toX: TABLE_CENTER_X + 76,
    toY: TABLE_CENTER_Y,
    progress: 0,
    faceUp: true,
    colorHex: disp.accentHex,
    rankText: disp.badge,
    rotStart: -0.2,
    rotEnd: 0.12,
  });
  state.pendingSounds.push({ type: 'card', playerId: player.id });
  state.pendingHaptics.push({ playerId: player.id, pattern: 38, reason: 'confirm' });

  const k = card.kind;
  switch (k.type) {
    case 'prop': {
      player.props[k.color] += 1;
      const done = player.props[k.color] % 2 === 0;
      player.lastAction = done ? `SET COMPLETE!` : PROP_HEX[k.color].label;
      state.popups.push({
        x: seat.x,
        y: seat.y - 46,
        text: done ? 'FULL SET!' : `+1 ${k.color.toUpperCase()}`,
        colorHex: disp.accentHex,
        alpha: 1.45,
      });
      if (done) {
        state.shockwaves.push({ x: seat.x, y: seat.y, radius: 18, maxRadius: 210, colorHex: disp.accentHex, alpha: 0.95 });
        state.pendingSounds.push({ type: 'pickup', playerId: player.id });
      }
      break;
    }
    case 'wild-prop': {
      // Auto-place onto an odd-count set to finish it, else least populated color
      const oddColor = PROP_COLORS.find((c) => player.props[c] % 2 === 1);
      const bestColor = oddColor ?? PROP_COLORS[Math.floor(Math.random() * PROP_COLORS.length)];
      player.props[bestColor] += 1;
      const done = player.props[bestColor] % 2 === 0;
      player.lastAction = done ? 'WILD FULL SET!' : 'WILD DEED!';
      state.popups.push({
        x: seat.x,
        y: seat.y - 46,
        text: done ? 'WILD SET!' : `WILD ${bestColor.toUpperCase()}`,
        colorHex: '#A855F7',
        alpha: 1.5,
      });
      if (done) state.pendingSounds.push({ type: 'pickup', playerId: player.id });
      break;
    }
    case 'cash': {
      player.bankCash += k.value;
      player.lastAction = `BANKED $${k.value}M`;
      state.popups.push({ x: seat.x, y: seat.y - 44, text: `+$${k.value}M`, colorHex: '#10D98B', alpha: 1.35 });
      break;
    }
    case 'pass-go': {
      for (let i = 0; i < 2 && player.hand.length < 7; i++) {
        player.hand.push(drawCard(state));
      }
      player.lastAction = 'PASS GO +2';
      setBanner(state, `${player.name} PASSED GO (+2)!`, '#38BDF8', 1.4);
      break;
    }
    case 'rent': {
      const maxColorCount = Math.max(1, ...PROP_COLORS.map((c) => player.props[c]));
      const rentDue = Math.min(6, maxColorCount * 2);
      let collected = 0;
      for (const rival of state.players) {
        if (rival.id === player.id) continue;
        const pay = Math.min(rival.bankCash, rentDue);
        rival.bankCash -= pay;
        collected += pay;
        recomputeScore(rival);
      }
      const totalGain = Math.max(2, collected);
      player.bankCash += totalGain;
      player.lastAction = `RENT +$${totalGain}M`;
      setBanner(state, `${player.name} COLLECTED $${totalGain}M RENT!`, '#F59E0B', 1.7);
      state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 22, maxRadius: 240, colorHex: '#F59E0B', alpha: 0.9 });
      break;
    }
    case 'sly-deal': {
      const rivals = state.players.filter(
        (r) => r.id !== player.id && PROP_COLORS.some((c) => r.props[c] % 2 === 1 || r.props[c] > 0)
      );
      if (rivals.length > 0) {
        const victim = rivals[Math.floor(Math.random() * rivals.length)];
        const col =
          PROP_COLORS.find((c) => victim.props[c] % 2 === 1) ??
          PROP_COLORS.find((c) => victim.props[c] > 0)!;
        victim.props[col] -= 1;
        player.props[col] += 1;
        recomputeScore(victim);
        const vSeat = seatOf(state, victim.id);
        state.popups.push({ x: vSeat.x, y: vSeat.y - 44, text: 'DEED STOLEN!', colorHex: '#EC4899', alpha: 1.5 });
        player.lastAction = `STOLE ${col.toUpperCase()}!`;
        setBanner(state, `SLY DEAL! ${player.name} STOLE FROM ${victim.name}!`, '#EC4899', 1.9);
      } else {
        player.bankCash += 2;
        player.lastAction = 'BANKED $2M';
      }
      break;
    }
    case 'debt': {
      const rivals = state.players.filter((r) => r.id !== player.id).sort((a, b) => b.bankCash - a.bankCash);
      if (rivals[0]) {
        const pay = Math.min(rivals[0].bankCash, 4);
        rivals[0].bankCash -= pay;
        player.bankCash += Math.max(2, pay);
        recomputeScore(rivals[0]);
        player.lastAction = `DEBT +$${Math.max(2, pay)}M`;
        setBanner(state, `${player.name} COLLECTED DEBT FROM ${rivals[0].name}!`, '#F97316', 1.7);
      } else {
        player.bankCash += 4;
      }
      break;
    }
    case 'deal-breaker': {
      const rivals = state.players
        .filter((r) => r.id !== player.id && PROP_COLORS.some((c) => r.props[c] >= 2))
        .sort((a, b) => countCompletedSets(b) - countCompletedSets(a));
      if (rivals[0]) {
        const victim = rivals[0];
        const col = PROP_COLORS.find((c) => victim.props[c] >= 2)!;
        victim.props[col] -= 2;
        player.props[col] += 2;
        recomputeScore(victim);
        player.lastAction = 'DEAL BREAKER!!';
        setBanner(state, `DEAL BREAKER! ${player.name} HEISTED A FULL SET!`, '#EF4444', 2.2);
        state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 30, maxRadius: 310, colorHex: '#EF4444', alpha: 1 });
        state.pendingSounds.push({ type: 'ko', playerId: player.id });
      } else {
        player.bankCash += 5;
        player.lastAction = 'BANKED $5M';
      }
      break;
    }
  }

  player.lastActionTimer = 2.6;
  recomputeScore(player);

  if (countCompletedSets(player) >= state.targetSets) {
    state.winnerId = player.id;
    player.score += 500;
    setBanner(state, `${player.name} WINS WITH ${countCompletedSets(player)} SETS!`, player.colorHex, 3.6);
    state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 28, maxRadius: 340, colorHex: player.colorHex, alpha: 1 });
    state.pendingSounds.push({ type: 'win', playerId: player.id });
    return true;
  }

  if (state.playsLeft <= 0 || player.hand.length === 0) {
    startNextTurn(state);
  }
  return true;
}

function buildPrivateState(state: PropertyDealState, p: PropertyDealPlayerInternal): CardPrivateState {
  const active = state.players[state.activePlayerIndex];
  const isMyTurn = Boolean(active && active.id === p.id && !state.winnerId);
  const sets = countCompletedSets(p);

  return {
    gameId: 'property-deal',
    playerId: p.id,
    hand: p.hand.map((c, idx) => {
      const d = cardDisplay(c);
      return {
        id: c.id,
        kind: 'party',
        title: d.title,
        subtitle: d.subtitle,
        badge: d.badge,
        accentHex: d.accentHex,
        secondaryHex: d.secondaryHex,
        playable: isMyTurn && state.playsLeft > 0,
        selected: idx === p.cursorIndex,
      };
    }),
    cursorIndex: p.cursorIndex,
    isMyTurn,
    isActionRequired: isMyTurn,
    turnTimeLeft: state.turnTimeLeft,
    turnTotal: state.turnTotal,
    badgeText: `SETS ${sets}/${state.targetSets} · BANK $${p.bankCash}M · PLAYS ${isMyTurn ? state.playsLeft : 0}`,
    badgeColorHex: '#10D98B',
    primaryBtn: {
      label: 'END TURN',
      labelZh: '结束回合',
      action: { type: 'draw-or-pass' },
      colorHex: '#0EA5E9',
      disabled: !isMyTurn,
    },
    secondaryBtn: {
      label: 'PLAY CARD',
      labelZh: '打出选中牌',
      action: { type: 'play-card' },
      colorHex: '#10D98B',
      disabled: !isMyTurn || p.hand.length === 0,
    },
    statusHint: isMyTurn
      ? `Your turn! Tap up to ${state.playsLeft} cards to build ${state.targetSets} sets.`
      : `${active?.name ?? 'Player'} is making deals...`,
    statusHintZh: isMyTurn
      ? `轮到你！点按打出最多 ${state.playsLeft} 张牌凑齐 ${state.targetSets} 套地产`
      : `等待 ${active?.name ?? '玩家'} 交易中...`,
  };
}

export const propertyDealModule: ServerGameModule<PropertyDealState> = {
  id: 'property-deal',

  createState(players, settingValue) {
    const targetSets = Math.max(2, Math.min(4, settingValue || 3));
    const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
    const deck = buildDealDeck();

    const internalPlayers: PropertyDealPlayerInternal[] = sorted.map((p) => {
      const hand: DealCard[] = [];
      for (let i = 0; i < 5; i++) {
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
        bankCash: 4,
        props: { red: 0, blue: 0, gold: 0, green: 0 },
        cursorIndex: 0,
        score: 60,
        lastAction: null,
        lastActionTimer: 0,
        joyCooldown: 0,
      };
    });

    return {
      targetSets,
      round: 1,
      maxRounds: MAX_ROUNDS,
      turnsInRound: 0,
      deck,
      activePlayerIndex: 0,
      playsLeft: 3,
      turnTimeLeft: TURN_LIMIT_SEC,
      turnTotal: TURN_LIMIT_SEC,
      botThinkTimer: 1.1,
      lastPlayedCard: null,
      banner: `FIRST TO ${targetSets} PROPERTY SETS WINS!`,
      bannerColor: '#10D98B',
      bannerTimer: 2.3,
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
    if (!p || state.winnerId) return;
    if (action.type === 'select-index') {
      if (p.hand.length > 0) p.cursorIndex = Math.max(0, Math.min(p.hand.length - 1, action.index));
    } else if (action.type === 'play-card') {
      const idx = action.cardId ? p.hand.findIndex((c) => c.id === action.cardId) : p.cursorIndex;
      if (idx >= 0) playDealCard(state, p, idx);
    } else if (action.type === 'draw-or-pass') {
      const active = state.players[state.activePlayerIndex];
      if (active && active.id === p.id) startNextTurn(state);
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
      sw.radius += dt * 310;
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
          if (state.playsLeft > 0 && active.hand.length > 0) {
            // Prioritize Deal Breaker > Property/Wild > Pass Go > Sly Deal > Rent/Debt > Cash
            const priority = (c: DealCard) => {
              switch (c.kind.type) {
                case 'deal-breaker': return 7;
                case 'wild-prop': return 6;
                case 'prop': return 5;
                case 'pass-go': return 4;
                case 'sly-deal': return 3;
                case 'rent': return 2;
                case 'debt': return 2;
                case 'cash': return 1;
              }
            };
            let bestIdx = 0;
            let bestP = -1;
            active.hand.forEach((c, idx) => {
              const p = priority(c);
              if (p > bestP) {
                bestP = p;
                bestIdx = idx;
              }
            });
            playDealCard(state, active, bestIdx);
            state.botThinkTimer = 0.75 + Math.random() * 0.4;
          } else {
            startNextTurn(state);
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
          if (justA) playDealCard(state, active, active.cursorIndex);
          else if (justB) startNextTurn(state);
        }
      }

      if (!state.winnerId && state.turnTimeLeft <= 0) {
        startNextTurn(state);
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

  getSnapshot(state): PropertyDealSnapshot {
    return {
      gameId: 'property-deal',
      round: state.round,
      maxRounds: state.maxRounds,
      targetSets: state.targetSets,
      activePlayerId: state.players[state.activePlayerIndex]?.id ?? '',
      playsLeft: state.playsLeft,
      turnTimeLeft: Math.max(0, state.turnTimeLeft),
      turnTotal: state.turnTotal,
      deckCount: state.deck.length,
      lastPlayedCard: state.lastPlayedCard,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: [...state.flyingCards],
      shockwaves: [...state.shockwaves],
      popups: [...state.popups],
      players: state.players.map((p) => {
        const properties: PropertySetView[] = PROP_COLORS.filter((c) => p.props[c] > 0).map((c) => ({
          color: c,
          count: p.props[c],
          complete: p.props[c] >= 2,
        }));
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          isBot: p.isBot,
          cardCount: p.hand.length,
          bankCash: p.bankCash,
          setsCompleted: countCompletedSets(p),
          properties,
          score: p.score,
          lastAction: p.lastAction,
        };
      }),
    };
  },

  getRankings(state): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => {
      if (a.id === state.winnerId) return -1;
      if (b.id === state.winnerId) return 1;
      const sa = countCompletedSets(a);
      const sb = countCompletedSets(b);
      if (sb !== sa) return sb - sa;
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
      highlight: `${countCompletedSets(p)} Sets · $${p.bankCash}M Bank`,
    }));
  },
};

function buildHudUpdates(state: PropertyDealState): Record<string, PlayerHudUpdate> {
  const activeId = state.players[state.activePlayerIndex]?.id;
  const out: Record<string, PlayerHudUpdate> = {};
  for (const p of state.players) {
    out[p.id] = {
      score: p.score,
      alive: true,
      statText: `${countCompletedSets(p)}/${state.targetSets} sets · $${p.bankCash}M`,
      cooldownA: p.id === activeId ? 0 : 0.6,
      cooldownB: p.id === activeId ? 0 : 0.6,
    };
  }
  return out;
}
