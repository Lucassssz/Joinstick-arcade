import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../../src/shared/cardLayout.ts';
import type {
  CardPrivateState,
  CardShockwave,
  FlyingCardAnim,
  RankingEntry,
  SoundEvent,
  SushiDraftSnapshot,
} from '../../src/shared/types.ts';
import type { HapticTrigger, PlayerHudUpdate, ServerGameModule } from './engine.ts';

const PICK_TIME = 11.0;
const PICKS_PER_ROUND = 6;

type SushiKind =
  | 'tempura'
  | 'sashimi'
  | 'dumpling'
  | 'wasabi'
  | 'nigiri2'
  | 'nigiri3'
  | 'maki2'
  | 'maki3'
  | 'pudding';

interface SushiCard {
  id: string;
  kind: SushiKind;
}

const SUSHI_META: Record<
  SushiKind,
  { title: string; subtitle: string; badge: string; accentHex: string; secondaryHex: string }
> = {
  tempura: { title: 'TEMPURA', subtitle: 'Pair = 5 pts', badge: '2x=5', accentHex: '#A855F7', secondaryHex: '#581C87' },
  sashimi: { title: 'SASHIMI', subtitle: 'Trio = 10 pts', badge: '3x=10', accentHex: '#10D98B', secondaryHex: '#065F46' },
  dumpling: { title: 'DUMPLING', subtitle: '1/3/6/10/15', badge: 'COMBO', accentHex: '#00C2FF', secondaryHex: '#075985' },
  wasabi: { title: 'WASABI', subtitle: '3x Next Nigiri', badge: '3x!', accentHex: '#84CC16', secondaryHex: '#3F6212' },
  nigiri2: { title: 'SALMON', subtitle: '+2 (6 w/Wasabi)', badge: '+2', accentHex: '#FB923C', secondaryHex: '#9A3412' },
  nigiri3: { title: 'SQUID', subtitle: '+3 (9 w/Wasabi)', badge: '+3', accentHex: '#FACC15', secondaryHex: '#854D0E' },
  maki2: { title: 'MAKI x2', subtitle: 'Most Maki = +6', badge: 'M2', accentHex: '#FF4D2E', secondaryHex: '#991B1B' },
  maki3: { title: 'MAKI x3', subtitle: 'Most Maki = +6', badge: 'M3', accentHex: '#EF4444', secondaryHex: '#7F1D1D' },
  pudding: { title: 'PUDDING', subtitle: 'End Bonus +6', badge: 'SWEET', accentHex: '#F472B6', secondaryHex: '#9D174D' },
};

interface SushiPlayerInternal {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  hand: SushiCard[];
  pickedCard: SushiCard | null;
  plate: SushiCard[];
  puddings: number;
  totalScore: number;
  cursorIndex: number;
  botPickDelay: number;
  lastAction: string | null;
  lastActionTimer: number;
  joyCooldown: number;
}

export interface SushiDraftState {
  round: number;
  totalRounds: number;
  pickStep: number;
  totalPickSteps: number;
  phase: 'picking' | 'reveal' | 'round-end';
  turnTimeLeft: number;
  turnTotal: number;
  phaseTimer: number;
  deck: SushiCard[];
  banner: string | null;
  bannerColor: string | null;
  bannerTimer: number;
  flyingCards: FlyingCardAnim[];
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: SushiPlayerInternal[];
  winnerId: string | null;
  finishDelay: number;
  pendingSounds: SoundEvent[];
  pendingHaptics: HapticTrigger[];
}

let sdSeq = 1;
function makeCard(kind: SushiKind): SushiCard {
  return { id: `sd_${sdSeq++}_${Math.random().toString(36).slice(2, 5)}`, kind };
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSushiDeck(): SushiCard[] {
  const deck: SushiCard[] = [];
  const add = (kind: SushiKind, n: number) => {
    for (let i = 0; i < n; i++) deck.push(makeCard(kind));
  };
  add('tempura', 14);
  add('sashimi', 12);
  add('dumpling', 14);
  add('wasabi', 7);
  add('nigiri2', 12);
  add('nigiri3', 8);
  add('maki2', 12);
  add('maki3', 8);
  add('pudding', 10);
  return shuffle(deck);
}

function calcPlateScore(plate: SushiCard[]): { points: number; maki: number } {
  let tempura = 0;
  let sashimi = 0;
  let dumpling = 0;
  let maki = 0;
  let points = 0;
  let pendingWasabi = 0;

  for (const c of plate) {
    switch (c.kind) {
      case 'tempura': tempura += 1; break;
      case 'sashimi': sashimi += 1; break;
      case 'dumpling': dumpling += 1; break;
      case 'wasabi': pendingWasabi += 1; break;
      case 'nigiri2': {
        points += pendingWasabi > 0 ? 6 : 2;
        if (pendingWasabi > 0) pendingWasabi -= 1;
        break;
      }
      case 'nigiri3': {
        points += pendingWasabi > 0 ? 9 : 3;
        if (pendingWasabi > 0) pendingWasabi -= 1;
        break;
      }
      case 'maki2': maki += 2; break;
      case 'maki3': maki += 3; break;
      case 'pudding': break;
    }
  }
  points += Math.floor(tempura / 2) * 5;
  points += Math.floor(sashimi / 3) * 10;
  const dumpTable = [0, 1, 3, 6, 10, 15];
  points += dumpTable[Math.min(5, dumpling)];
  return { points, maki };
}

function seatOf(state: SushiDraftState, id: string) {
  const idx = Math.max(0, state.players.findIndex((p) => p.id === id));
  return getCardSeatPosition(idx, state.players.length);
}

function setBanner(state: SushiDraftState, text: string, color: string, dur = 1.8) {
  state.banner = text;
  state.bannerColor = color;
  state.bannerTimer = dur;
}

function dealRoundHands(state: SushiDraftState) {
  if (state.deck.length < state.players.length * PICKS_PER_ROUND) {
    state.deck = buildSushiDeck();
  }
  for (const p of state.players) {
    p.plate = [];
    p.pickedCard = null;
    p.hand = [];
    p.cursorIndex = 0;
    p.botPickDelay = 0.85 + Math.random() * 1.4;
    for (let i = 0; i < PICKS_PER_ROUND; i++) {
      p.hand.push(state.deck.pop()!);
    }
  }
  state.pickStep = 1;
  state.phase = 'picking';
  state.turnTimeLeft = PICK_TIME;
  state.turnTotal = PICK_TIME;
}

function lockPick(state: SushiDraftState, p: SushiPlayerInternal, idx: number) {
  if (state.phase !== 'picking' || p.pickedCard || p.hand.length === 0) return;
  const clamped = Math.max(0, Math.min(p.hand.length - 1, idx));
  const [chosen] = p.hand.splice(clamped, 1);
  p.pickedCard = chosen;
  p.cursorIndex = Math.max(0, Math.min(p.cursorIndex, p.hand.length - 1));
  p.lastAction = 'PICK LOCKED!';
  p.lastActionTimer = 1.8;
  state.pendingSounds.push({ type: 'confirm', playerId: p.id });
  state.pendingHaptics.push({ playerId: p.id, pattern: 35, reason: 'confirm' });

  if (state.players.every((pl) => pl.pickedCard !== null)) {
    triggerReveal(state);
  }
}

function triggerReveal(state: SushiDraftState) {
  for (const p of state.players) {
    if (!p.pickedCard && p.hand.length > 0) {
      p.pickedCard = p.hand.shift()!;
    }
    if (p.pickedCard) {
      const card = p.pickedCard;
      p.plate.push(card);
      if (card.kind === 'pudding') p.puddings += 1;
      const meta = SUSHI_META[card.kind];
      p.lastAction = meta.title;
      p.lastActionTimer = 2.2;
      const seat = seatOf(state, p.id);
      state.flyingCards.push({
        id: `fly_sd_${Date.now()}_${p.slotIndex}`,
        fromX: TABLE_CENTER_X,
        fromY: TABLE_CENTER_Y,
        toX: seat.x,
        toY: seat.y,
        progress: 0,
        faceUp: true,
        colorHex: meta.accentHex,
        rankText: meta.badge,
        rotStart: -0.2,
        rotEnd: 0.1,
      });
      p.pickedCard = null;
    }
  }
  state.phase = 'reveal';
  state.phaseTimer = 1.45;
  setBanner(state, 'CONVEYOR REVEAL & PASS!', '#FF7A59', 1.4);
  state.pendingSounds.push({ type: 'card' });
}

function finishRevealStep(state: SushiDraftState) {
  if (state.pickStep >= state.totalPickSteps) {
    // Score the round + Maki leader bonus
    const makiList = state.players.map((p) => {
      const res = calcPlateScore(p.plate);
      p.totalScore += res.points;
      return { p, maki: res.maki };
    });
    makiList.sort((a, b) => b.maki - a.maki);
    if (makiList[0] && makiList[0].maki > 0) {
      makiList[0].p.totalScore += 6;
      const seat = seatOf(state, makiList[0].p.id);
      state.popups.push({ x: seat.x, y: seat.y - 46, text: 'MAKI KING +6!', colorHex: '#EF4444', alpha: 1.6 });
    }
    if (makiList[1] && makiList[1].maki > 0) {
      makiList[1].p.totalScore += 3;
    }

    if (state.round >= state.totalRounds) {
      // Pudding leader bonus
      const pudSorted = [...state.players].sort((a, b) => b.puddings - a.puddings);
      if (pudSorted[0] && pudSorted[0].puddings > 0) {
        pudSorted[0].totalScore += 6;
      }
      const winner = [...state.players].sort((a, b) => b.totalScore - a.totalScore)[0];
      if (winner) {
        state.winnerId = winner.id;
        setBanner(state, `${winner.name} SUSHI CHEF WINS (${winner.totalScore} PTS)!`, winner.colorHex, 3.6);
        state.shockwaves.push({ x: TABLE_CENTER_X, y: TABLE_CENTER_Y, radius: 26, maxRadius: 340, colorHex: winner.colorHex, alpha: 1 });
        state.pendingSounds.push({ type: 'win', playerId: winner.id });
      }
      return;
    }

    state.phase = 'round-end';
    state.phaseTimer = 2.0;
    setBanner(state, `ROUND ${state.round} SCORED! NEXT BELT...`, '#FFB800', 1.9);
    return;
  }

  // Rotate remaining hands clockwise!
  const hands = state.players.map((p) => p.hand);
  const n = state.players.length;
  for (let i = 0; i < n; i++) {
    state.players[i].hand = hands[(i - 1 + n) % n];
    state.players[i].cursorIndex = 0;
    state.players[i].botPickDelay = 0.8 + Math.random() * 1.3;
  }
  state.pickStep += 1;
  state.phase = 'picking';
  state.turnTimeLeft = PICK_TIME;
}

function pickBotCardIndex(p: SushiPlayerInternal): number {
  let bestIdx = 0;
  let bestScore = -1;
  const hasWasabi = p.plate.filter((c) => c.kind === 'wasabi').length > p.plate.filter((c) => c.kind === 'nigiri2' || c.kind === 'nigiri3').length;
  const hasTempura = p.plate.filter((c) => c.kind === 'tempura').length % 2 === 1;
  const hasSashimi = p.plate.filter((c) => c.kind === 'sashimi').length % 3;

  p.hand.forEach((c, idx) => {
    let sc = 2;
    if (c.kind === 'nigiri3') sc = hasWasabi ? 12 : 5;
    else if (c.kind === 'nigiri2') sc = hasWasabi ? 9 : 3;
    else if (c.kind === 'tempura') sc = hasTempura ? 8 : 4;
    else if (c.kind === 'sashimi') sc = hasSashimi === 2 ? 11 : hasSashimi === 1 ? 5 : 3;
    else if (c.kind === 'dumpling') sc = 5;
    else if (c.kind === 'maki3') sc = 6;
    else if (c.kind === 'wasabi') sc = 6;
    else if (c.kind === 'pudding') sc = 4;
    sc += Math.random() * 1.2;
    if (sc > bestScore) {
      bestScore = sc;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

function buildPrivateState(state: SushiDraftState, p: SushiPlayerInternal): CardPrivateState {
  const canPick = state.phase === 'picking' && !p.pickedCard && !state.winnerId;
  const platePts = calcPlateScore(p.plate).points;

  return {
    gameId: 'sushi-draft',
    playerId: p.id,
    hand: p.hand.map((c, idx) => {
      const m = SUSHI_META[c.kind];
      return {
        id: c.id,
        kind: 'party',
        title: m.title,
        subtitle: m.subtitle,
        badge: m.badge,
        accentHex: m.accentHex,
        secondaryHex: m.secondaryHex,
        playable: canPick,
        selected: idx === p.cursorIndex,
      };
    }),
    cursorIndex: p.cursorIndex,
    isMyTurn: canPick,
    isActionRequired: canPick,
    turnTimeLeft: state.turnTimeLeft,
    turnTotal: state.turnTotal,
    badgeText: `ROUND ${state.round}/${state.totalRounds} · PLATE +${platePts} · TOTAL ${p.totalScore}`,
    badgeColorHex: '#FF7A59',
    primaryBtn: {
      label: p.pickedCard ? 'PICK LOCKED!' : 'DRAFT SELECTED',
      labelZh: p.pickedCard ? '已锁定等待开牌' : '选定这张寿司',
      action: { type: 'play-card' },
      colorHex: '#FF7A59',
      disabled: !canPick,
    },
    statusHint: canPick
      ? `Pick 1 sushi to keep, pass the rest! (${Math.ceil(state.turnTimeLeft)}s)`
      : p.pickedCard
        ? 'Pick locked! Waiting for other chefs...'
        : 'Passing conveyor belt hands...',
    statusHintZh: canPick
      ? `选 1 张寿司留盘，其余传给下家！(${Math.ceil(state.turnTimeLeft)}秒)`
      : p.pickedCard
        ? '已锁定！等待其他主厨...'
        : '传送带流转中...',
  };
}

export const sushiDraftModule: ServerGameModule<SushiDraftState> = {
  id: 'sushi-draft',

  createState(players, settingValue) {
    const totalRounds = Math.max(2, Math.min(4, settingValue || 3));
    const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
    const deck = buildSushiDeck();

    const internalPlayers: SushiPlayerInternal[] = sorted.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      hand: [],
      pickedCard: null,
      plate: [],
      puddings: 0,
      totalScore: 0,
      cursorIndex: 0,
      botPickDelay: 1.0 + Math.random() * 1.2,
      lastAction: null,
      lastActionTimer: 0,
      joyCooldown: 0,
    }));

    const state: SushiDraftState = {
      round: 1,
      totalRounds,
      pickStep: 1,
      totalPickSteps: PICKS_PER_ROUND,
      phase: 'picking',
      turnTimeLeft: PICK_TIME,
      turnTotal: PICK_TIME,
      phaseTimer: 0,
      deck,
      banner: 'PICK 1 SUSHI & PASS THE HAND!',
      bannerColor: '#FF7A59',
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
    dealRoundHands(state);
    return state;
  },

  handleCardAction(state, playerId, action) {
    const p = state.players.find((pl) => pl.id === playerId);
    if (!p || state.winnerId) return;
    if (action.type === 'select-index' && p.hand.length > 0) {
      p.cursorIndex = Math.max(0, Math.min(p.hand.length - 1, action.index));
    } else if (action.type === 'play-card') {
      const idx = action.cardId ? p.hand.findIndex((c) => c.id === action.cardId) : p.cursorIndex;
      if (idx >= 0) lockPick(state, p, idx);
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

    if (state.phase === 'picking') {
      state.turnTimeLeft -= dt;
      for (const p of state.players) {
        if (p.pickedCard) continue;
        if (p.isBot) {
          p.botPickDelay -= dt;
          if (p.botPickDelay <= 0) {
            lockPick(state, p, pickBotCardIndex(p));
          }
        } else {
          const inp = inputPlayers.find((ip) => ip.id === p.id);
          if (inp) {
            if (Math.abs(inp.input.dx) > 0.5 && p.joyCooldown <= 0 && p.hand.length > 0) {
              const dir = inp.input.dx > 0 ? 1 : -1;
              p.cursorIndex = (p.cursorIndex + dir + p.hand.length) % p.hand.length;
              p.joyCooldown = 0.22;
              sounds.push({ type: 'nav', playerId: p.id });
            }
            if (inp.input.a && !inp.prevA) {
              lockPick(state, p, p.cursorIndex);
            }
          }
        }
      }
      if (state.phase === 'picking' && state.turnTimeLeft <= 0) {
        triggerReveal(state);
      }
    } else if (state.phase === 'reveal') {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) finishRevealStep(state);
    } else if (state.phase === 'round-end') {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.round += 1;
        dealRoundHands(state);
        setBanner(state, `ROUND ${state.round} — FRESH CONVEYOR!`, '#FF7A59', 1.8);
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

  getSnapshot(state): SushiDraftSnapshot {
    return {
      gameId: 'sushi-draft',
      round: state.round,
      totalRounds: state.totalRounds,
      pickStep: state.pickStep,
      totalPickSteps: state.totalPickSteps,
      phase: state.phase,
      turnTimeLeft: Math.max(0, state.turnTimeLeft),
      turnTotal: state.turnTotal,
      banner: state.banner,
      bannerColor: state.bannerColor,
      flyingCards: [...state.flyingCards],
      shockwaves: [...state.shockwaves],
      popups: [...state.popups],
      players: state.players.map((p) => {
        const res = calcPlateScore(p.plate);
        return {
          id: p.id,
          slotIndex: p.slotIndex,
          name: p.name,
          colorHex: p.colorHex,
          isBot: p.isBot,
          pickedThisStep: p.pickedCard !== null,
          plateCards: p.plate.map((c) => {
            const m = SUSHI_META[c.kind];
            return { id: c.id, kind: c.kind, label: m.title, badge: m.badge, accentHex: m.accentHex };
          }),
          makiCount: res.maki,
          puddingCount: p.puddings,
          roundScore: res.points,
          totalScore: p.totalScore,
          lastAction: p.lastAction,
        };
      }),
    };
  },

  getRankings(state): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      return b.puddings - a.puddings;
    });
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: { id: `p${p.slotIndex}`, name: p.name, hex: p.colorHex, dark: p.colorHex, textOnColor: '#FFFFFF' },
      rank: idx + 1,
      score: p.totalScore,
      highlight: `${p.totalScore} pts · ${p.puddings} Puddings`,
    }));
  },
};

function buildHudUpdates(state: SushiDraftState): Record<string, PlayerHudUpdate> {
  const out: Record<string, PlayerHudUpdate> = {};
  for (const p of state.players) {
    out[p.id] = {
      score: p.totalScore,
      alive: true,
      statText: p.pickedCard ? 'LOCKED!' : `${p.totalScore} pts · +${calcPlateScore(p.plate).points}`,
      cooldownA: p.pickedCard ? 0.8 : 0,
      cooldownB: 0.6,
    };
  }
  return out;
}
