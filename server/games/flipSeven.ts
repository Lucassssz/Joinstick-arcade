import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../../src/shared/cardLayout.ts';
import type {
  CardPrivateState,
  CardShockwave,
  FlipSevenSnapshot,
  FlyingCardAnim,
  RankingEntry,
  SoundEvent,
} from '../../src/shared/types.ts';
import type { HapticTrigger, PlayerHudUpdate, ServerGameModule } from './engine.ts';

const TURN_LIMIT_SEC = 12.0;
const TOTAL_ROUNDS = 5;

type FlipCard =
  | { kind: 'number'; value: number }
  | { kind: 'bonus'; value: number }
  | { kind: 'mult2' }
  | { kind: 'shield' };

interface FlipPlayerInternal {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  status: 'active' | 'stayed' | 'busted' | 'flip7';
  numberCards: number[];
  bonusTotal: number;
  hasMultiplier: boolean;
  hasSecondChance: boolean;
  totalScore: number;
  lastAction: string | null;
  lastActionTimer: number;
}

export interface FlipSevenState {
  round: number;
  totalRounds: number;
  targetScore: number;
  deck: FlipCard[];
  activePlayerIndex: number;
  turnTimeLeft: number;
  turnTotal: number;
  botThinkTimer: number;
  roundPauseTimer: number;
  lastFlipped: { label: string; subtitle: string; accentHex: string } | null;
  banner: string | null;
  bannerColor: string | null;
  bannerTimer: number;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: FlipPlayerInternal[];
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

function buildFlipDeck(): FlipCard[] {
  const deck: FlipCard[] = [{ kind: 'number', value: 0 }];
  // Pyramid distribution: N copies of card N (1..12)
  for (let n = 1; n <= 12; n++) {
    for (let c = 0; c < n; c++) {
      deck.push({ kind: 'number', value: n });
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ kind: 'bonus', value: 4 });
  for (let i = 0; i < 3; i++) deck.push({ kind: 'bonus', value: 6 });
  for (let i = 0; i < 3; i++) deck.push({ kind: 'mult2' });
  for (let i = 0; i < 4; i++) deck.push({ kind: 'shield' });
  return shuffle(deck);
}

function drawFlipCard(state: FlipSevenState): FlipCard {
  if (state.deck.length === 0) state.deck = buildFlipDeck();
  return state.deck.pop()!;
}

function calcRoundPoints(p: FlipPlayerInternal): number {
  if (p.status === 'busted') return 0;
  const numSum = p.numberCards.reduce((a, b) => a + b, 0);
  const multSum = p.hasMultiplier ? numSum * 2 : numSum;
  const jackpot = p.status === 'flip7' ? 35 : 0;
  return multSum + p.bonusTotal + jackpot;
}

function seatOf(state: FlipSevenState, id: string) {
  const idx = Math.max(0, state.players.findIndex((p) => p.id === id));
  return getCardSeatPosition(idx, state.players.length);
}

function setBanner(state: FlipSevenState, text: string, color: string, dur = 1.9) {
  state.banner = text;
  state.bannerColor = color;
  state.bannerTimer = dur;
}

function finishRound(state: FlipSevenState) {
  for (const p of state.players) {
    const pts = calcRoundPoints(p);
    p.totalScore += pts;
  }
  const leader = [...state.players].sort((a, b) => b.totalScore - a.totalScore)[0];
  if ((leader && leader.totalScore >= state.targetScore) || state.round >= state.totalRounds) {
    if (leader) {
      state.winnerId = leader.id;
      setBanner(state, `${leader.name} WINS (${leader.totalScore} PTS)!`, leader.colorHex, 3.6);
      state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 26, maxRadius: 340, colorHex: leader.colorHex, alpha: 1 });
      state.pendingSounds.push({ type: 'win', playerId: leader.id });
    }
    return;
  }
  state.roundPauseTimer = 2.0;
  setBanner(state, `ROUND ${state.round} COMPLETE!`, '#FFB800', 1.9);
}

function startNewRound(state: FlipSevenState) {
  state.round += 1;
  for (const p of state.players) {
    p.status = 'active';
    p.numberCards = [];
    p.bonusTotal = 0;
    p.hasMultiplier = false;
    p.hasSecondChance = false;
    p.lastAction = null;
  }
  // Deal 1 opening number card to each player
  for (const p of state.players) {
    let card = drawFlipCard(state);
    while (card.kind !== 'number') {
      state.deck.unshift(card);
      card = drawFlipCard(state);
    }
    p.numberCards.push(card.value);
  }
  state.activePlayerIndex = (state.round - 1) % state.players.length;
  state.turnTimeLeft = TURN_LIMIT_SEC;
  state.botThinkTimer = 1.1;
  setBanner(state, `ROUND ${state.round} — HIT OR STAY!`, '#00C2FF', 1.7);
}

function advanceTurn(state: FlipSevenState) {
  const n = state.players.length;
  for (let s = 1; s <= n; s++) {
    const idx = (state.activePlayerIndex + s) % n;
    if (state.players[idx]?.status === 'active') {
      state.activePlayerIndex = idx;
      state.turnTimeLeft = TURN_LIMIT_SEC;
      state.botThinkTimer = 1.0 + Math.random() * 0.55;
      return;
    }
  }
  finishRound(state);
}

function doHit(state: FlipSevenState, player: FlipPlayerInternal) {
  if (state.winnerId || state.roundPauseTimer > 0) return;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== player.id || player.status !== 'active') return;

  const card = drawFlipCard(state);
  const seat = seatOf(state, player.id);

  if (card.kind === 'number') {
    const isDup = player.numberCards.includes(card.value);
    state.lastFlipped = {
      label: String(card.value),
      subtitle: isDup ? 'DUPLICATE!' : 'UNIQUE NUMBER',
      accentHex: isDup ? '#EF4444' : '#00C2FF',
    };
    state.flyingCards.push({
      id: `fly_f7_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      fromX: TABLE_CENTER_X - 88,
      fromY: TABLE_CENTER_Y,
      toX: seat.x,
      toY: seat.y,
      progress: 0,
      faceUp: true,
      colorHex: isDup ? '#EF4444' : '#00C2FF',
      rankText: String(card.value),
      rotStart: -0.22,
      rotEnd: 0.14,
    });

    if (isDup) {
      if (player.hasSecondChance) {
        player.hasSecondChance = false;
        player.lastAction = 'SHIELD SAVED!';
        setBanner(state, `${player.name}'S SHIELD SAVED THEM!`, '#10D98B', 1.8);
        state.popups.push({ x: seat.x, y: seat.y - 46, text: 'SHIELDED!', colorHex: '#10D98B', alpha: 1.5 });
        state.pendingSounds.push({ type: 'pickup', playerId: player.id });
      } else {
        player.status = 'busted';
        player.lastAction = `BUST (${card.value})!`;
        setBanner(state, `${player.name} BUSTED ON ${card.value}!`, '#EF4444', 1.8);
        state.shockwaves.push({ x: seat.x, y: seat.y, radius: 18, maxRadius: 210, colorHex: '#EF4444', alpha: 0.95 });
        state.popups.push({ x: seat.x, y: seat.y - 46, text: `BUSTED!`, colorHex: '#EF4444', alpha: 1.5 });
        state.pendingSounds.push({ type: 'ko', playerId: player.id });
        state.pendingHaptics.push({ playerId: player.id, pattern: [90, 30, 90], reason: 'hit' });
      }
    } else {
      player.numberCards.push(card.value);
      player.numberCards.sort((a, b) => a - b);
      player.lastAction = `FLIPPED ${card.value}`;
      state.pendingSounds.push({ type: 'card', playerId: player.id });
      state.pendingHaptics.push({ playerId: player.id, pattern: 36, reason: 'confirm' });

      if (player.numberCards.length >= 7) {
        player.status = 'flip7';
        player.lastAction = 'FLIP 7!! +35!';
        setBanner(state, `FLIP 7 JACKPOT!! ${player.name} +35 BONUS!`, '#FFB800', 2.4);
        state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 24, maxRadius: 330, colorHex: '#FFB800', alpha: 1 });
        state.pendingSounds.push({ type: 'win', playerId: player.id });
        finishRound(state);
        return;
      }
    }
  } else if (card.kind === 'bonus') {
    player.bonusTotal += card.value;
    player.lastAction = `+${card.value} BONUS`;
    state.lastFlipped = { label: `+${card.value}`, subtitle: 'BONUS MOD', accentHex: '#F59E0B' };
    state.popups.push({ x: seat.x, y: seat.y - 44, text: `+${card.value} BONUS`, colorHex: '#F59E0B', alpha: 1.4 });
    state.pendingSounds.push({ type: 'pickup', playerId: player.id });
  } else if (card.kind === 'mult2') {
    player.hasMultiplier = true;
    player.lastAction = 'x2 MULT!';
    state.lastFlipped = { label: 'x2', subtitle: 'DOUBLE SCORE', accentHex: '#A855F7' };
    state.popups.push({ x: seat.x, y: seat.y - 44, text: 'x2 MULTIPLIER!', colorHex: '#A855F7', alpha: 1.5 });
    state.pendingSounds.push({ type: 'pickup', playerId: player.id });
  } else {
    player.hasSecondChance = true;
    player.lastAction = 'SHIELD!';
    state.lastFlipped = { label: 'SHIELD', subtitle: '2ND CHANCE', accentHex: '#10D98B' };
    state.popups.push({ x: seat.x, y: seat.y - 44, text: '2ND CHANCE!', colorHex: '#10D98B', alpha: 1.5 });
    state.pendingSounds.push({ type: 'pickup', playerId: player.id });
  }

  player.lastActionTimer = 2.4;
  advanceTurn(state);
}

function doStay(state: FlipSevenState, player: FlipPlayerInternal) {
  if (state.winnerId || state.roundPauseTimer > 0) return;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== player.id || player.status !== 'active') return;
  player.status = 'stayed';
  const pts = calcRoundPoints(player);
  player.lastAction = `BANKED +${pts}`;
  player.lastActionTimer = 2.5;
  const seat = seatOf(state, player.id);
  state.popups.push({ x: seat.x, y: seat.y - 44, text: `STAY +${pts}`, colorHex: '#10D98B', alpha: 1.4 });
  state.pendingSounds.push({ type: 'confirm', playerId: player.id });
  state.pendingHaptics.push({ playerId: player.id, pattern: 40, reason: 'confirm' });
  advanceTurn(state);
}

function buildPrivateState(state: FlipSevenState, p: FlipPlayerInternal): CardPrivateState {
  const active = state.players[state.activePlayerIndex];
  const isMyTurn = Boolean(active && active.id === p.id && p.status === 'active' && !state.winnerId && state.roundPauseTimer <= 0);
  const pts = calcRoundPoints(p);

  return {
    gameId: 'flip-seven',
    playerId: p.id,
    hand: p.numberCards.map((val, idx) => ({
      id: `f7_n_${idx}_${val}`,
      kind: 'party',
      title: String(val),
      subtitle: `${p.numberCards.length}/7 unique`,
      badge: `#${val}`,
      accentHex: val >= 9 ? '#F59E0B' : val >= 5 ? '#00C2FF' : '#10D98B',
      secondaryHex: '#0F172A',
      playable: false,
      selected: false,
    })),
    cursorIndex: 0,
    isMyTurn,
    isActionRequired: isMyTurn,
    turnTimeLeft: state.turnTimeLeft,
    turnTotal: state.turnTotal,
    badgeText: `${p.numberCards.length}/7 CARDS · +${pts} PTS${p.hasSecondChance ? ' · SHIELD' : ''}${p.hasMultiplier ? ' · x2' : ''}`,
    badgeColorHex: p.status === 'busted' ? '#EF4444' : '#FFB800',
    primaryBtn: {
      label: 'HIT (FLIP CARD)',
      labelZh: '要牌 (翻一张)',
      action: { type: 'custom', id: 'hit' },
      colorHex: '#FF4D2E',
      disabled: !isMyTurn,
    },
    secondaryBtn: {
      label: `STAY (+${pts} PTS)`,
      labelZh: `停牌 (锁定 +${pts}分)`,
      action: { type: 'custom', id: 'stay' },
      colorHex: '#10D98B',
      disabled: !isMyTurn,
    },
    statusHint:
      p.status === 'busted'
        ? 'Busted this round! Wait for next round.'
        : p.status === 'stayed'
          ? `Banked +${pts} pts safely!`
          : isMyTurn
            ? `HIT for more points or STAY to lock +${pts} pts!`
            : `${active?.name ?? 'Player'} is deciding...`,
    statusHintZh:
      p.status === 'busted'
        ? '本局爆牌！等待下一轮'
        : p.status === 'stayed'
          ? `已安全锁定 +${pts} 分！`
          : isMyTurn
            ? `选择“要牌”博高分，或“停牌”锁定 +${pts} 分！`
            : `等待 ${active?.name ?? '玩家'} 决策中...`,
  };
}

export const flipSevenModule: ServerGameModule<FlipSevenState> = {
  id: 'flip-seven',

  createState(players, settingValue) {
    const targetScore = Math.max(80, Math.min(200, settingValue || 120));
    const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
    const deck = buildFlipDeck();

    const internalPlayers: FlipPlayerInternal[] = sorted.map((p) => {
      let card = deck.pop()!;
      while (card.kind !== 'number') {
        deck.unshift(card);
        card = deck.pop()!;
      }
      return {
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.color.hex,
        isBot: p.isBot,
        status: 'active',
        numberCards: [card.value],
        bonusTotal: 0,
        hasMultiplier: false,
        hasSecondChance: false,
        totalScore: 0,
        lastAction: null,
        lastActionTimer: 0,
      };
    });

    return {
      round: 1,
      totalRounds: TOTAL_ROUNDS,
      targetScore,
      deck,
      activePlayerIndex: 0,
      turnTimeLeft: TURN_LIMIT_SEC,
      turnTotal: TURN_LIMIT_SEC,
      botThinkTimer: 1.2,
      roundPauseTimer: 0,
      lastFlipped: null,
      banner: 'FLIP 7 UNIQUE CARDS WITHOUT DUPLICATES!',
      bannerColor: '#FFB800',
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
    if (action.type === 'play-card' || (action.type === 'custom' && action.id === 'hit')) {
      doHit(state, p);
    } else if (action.type === 'draw-or-pass' || (action.type === 'custom' && action.id === 'stay')) {
      doStay(state, p);
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
      state.flyingCards[i].progress += dt * 1.95;
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

    if (state.roundPauseTimer > 0) {
      state.roundPauseTimer -= dt;
      if (state.roundPauseTimer <= 0) startNewRound(state);
    } else {
      const active = state.players[state.activePlayerIndex];
      if (active && active.status === 'active') {
        state.turnTimeLeft -= dt;
        if (active.isBot) {
          state.botThinkTimer -= dt;
          if (state.botThinkTimer <= 0) {
            const pts = calcRoundPoints(active);
            const count = active.numberCards.length;
            const shouldStay = !active.hasSecondChance && ((count >= 4 && pts >= 24) || count >= 5);
            if (shouldStay && Math.random() < 0.72) doStay(state, active);
            else doHit(state, active);
          }
        } else {
          const inp = inputPlayers.find((ip) => ip.id === active.id);
          if (inp) {
            if (inp.input.a && !inp.prevA) doHit(state, active);
            else if (inp.input.b && !inp.prevB) doStay(state, active);
          }
        }
        if (!state.winnerId && state.roundPauseTimer <= 0 && state.turnTimeLeft <= 0) {
          doStay(state, active);
        }
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

  getSnapshot(state): FlipSevenSnapshot {
    return {
      gameId: 'flip-seven',
      round: state.round,
      totalRounds: state.totalRounds,
      targetScore: state.targetScore,
      activePlayerId: state.players[state.activePlayerIndex]?.id ?? '',
      turnTimeLeft: Math.max(0, state.turnTimeLeft),
      turnTotal: state.turnTotal,
      deckCount: state.deck.length,
      lastFlipped: state.lastFlipped,
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
        status: p.status,
        numberCards: [...p.numberCards],
        bonusTotal: p.bonusTotal,
        hasMultiplier: p.hasMultiplier,
        hasSecondChance: p.hasSecondChance,
        roundPoints: calcRoundPoints(p),
        totalScore: p.totalScore,
        lastAction: p.lastAction,
      })),
    };
  },

  getRankings(state): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return a.slotIndex - b.slotIndex;
    });
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: { id: `p${p.slotIndex}`, name: p.name, hex: p.colorHex, dark: p.colorHex, textOnColor: '#FFFFFF' },
      rank: idx + 1,
      score: p.totalScore,
      highlight: `${p.totalScore} pts total`,
    }));
  },
};

function buildHudUpdates(state: FlipSevenState): Record<string, PlayerHudUpdate> {
  const activeId = state.players[state.activePlayerIndex]?.id;
  const out: Record<string, PlayerHudUpdate> = {};
  for (const p of state.players) {
    out[p.id] = {
      score: p.totalScore,
      alive: p.status !== 'busted',
      statText: `${p.totalScore} pts · +${calcRoundPoints(p)}`,
      cooldownA: p.id === activeId ? 0 : 0.6,
      cooldownB: p.id === activeId ? 0 : 0.6,
    };
  }
  return out;
}
