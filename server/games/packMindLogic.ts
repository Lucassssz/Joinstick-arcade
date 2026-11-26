import { ARENA_HEIGHT, ARENA_WIDTH } from '../../src/shared/types.ts';
import type {
  CardPrivateHandItem,
  CardPrivateState,
} from '../../src/shared/types.ts';
import type {
  DeepSeaOxygenSnapshot,
  FireworkHintsSnapshot,
  OneCardCourtSnapshot,
  PicrossNonogramSnapshot,
  RowSixBustSnapshot,
  SilentSyncSnapshot,
  SpeedSudokuDuelSnapshot,
  TangramSilhouetteSnapshot,
  TunnelSaboteurSnapshot,
  WordTileCrossroadsSnapshot,
} from '../../src/shared/packMindLogicTypes.ts';
import { isStateFrenzyActive } from './packModuleAdapter.ts';
import type {
  CompactGameModule,
  CompactResultEntry,
  CompactSoundEvent,
} from './packModuleAdapter.ts';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rankByScore<T extends { id: string; score: number }>(
  items: T[],
  labelFn: (item: T) => string
): CompactResultEntry[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  return sorted.map((it, i) => ({
    playerId: it.id,
    rank: i + 1,
    score: Math.round(it.score),
    statLabel: labelFn(it),
  }));
}

type FWColor = 'red' | 'blue' | 'gold' | 'green';
const FW_COLORS: FWColor[] = ['red', 'blue', 'gold', 'green'];
const FW_HEX: Record<FWColor, string> = {
  red: '#FF4D2E',
  blue: '#00C2FF',
  gold: '#FFB800',
  green: '#10D98B',
};

// ============================================================================
// 1. ROW SIX BUST (6 Nimmt! Style — Pad 4 Card)
// ============================================================================
interface RowSixState {
  timeLeft: number;
  totalTime: number;
  round: number;
  roundTimer: number;
  rows: { id: number; cards: { val: number; bulls: number }[] }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    hand: { id: string; val: number; bulls: number }[];
    picked: { id: string; val: number; bulls: number } | null;
    bullsTaken: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function bullsForVal(val: number): number {
  if (val % 11 === 0) return 5;
  if (val % 10 === 0) return 3;
  if (val % 5 === 0) return 2;
  return 1;
}

function makeBullHand(count = 6): { id: string; val: number; bulls: number }[] {
  return Array.from({ length: count }, () => {
    const val = 2 + Math.floor(Math.random() * 59);
    return { id: `bull_${val}_${Math.random().toString(36).slice(2, 6)}`, val, bulls: bullsForVal(val) };
  }).sort((a, b) => a.val - b.val);
}

function makeFreshBullRows(): RowSixState['rows'] {
  return [8, 17, 29, 41].map((v, id) => ({
    id,
    cards: [{ val: v + Math.floor(Math.random() * 4), bulls: 1 }],
  }));
}

function resolveRowSixTurn(state: RowSixState, mult: number, sounds: CompactSoundEvent[]) {
  const submissions = state.players
    .map((p) => {
      const card = p.picked ?? p.hand[0] ?? { id: 'fb', val: 30, bulls: 2 };
      p.hand = p.hand.filter((c) => c.id !== card.id);
      while (p.hand.length < 6) p.hand.push(...makeBullHand(1));
      p.picked = null;
      return { p, card };
    })
    .sort((a, b) => a.card.val - b.card.val);

  for (const { p, card } of submissions) {
    let bestRow: RowSixState['rows'][0] | null = null;
    let bestTop = -1;
    for (const row of state.rows) {
      const top = row.cards[row.cards.length - 1].val;
      if (top < card.val && top > bestTop) {
        bestTop = top;
        bestRow = row;
      }
    }
    if (!bestRow) {
      // Lower than all rows — collect lowest-bull row
      const sortedRows = [...state.rows].sort(
        (a, b) => a.cards.reduce((s, c) => s + c.bulls, 0) - b.cards.reduce((s, c) => s + c.bulls, 0)
      );
      const target = sortedRows[0];
      const bullSum = target.cards.reduce((s, c) => s + c.bulls, 0);
      p.bullsTaken += bullSum;
      p.score = Math.max(0, p.score - bullSum * 10);
      p.lastAction = `ATE ${bullSum}🐂`;
      target.cards = [{ val: card.val, bulls: card.bulls }];
      sounds.push({ type: 'hit', playerId: p.id });
    } else if (bestRow.cards.length >= 5) {
      const bullSum = bestRow.cards.reduce((s, c) => s + c.bulls, 0);
      p.bullsTaken += bullSum;
      p.score = Math.max(0, p.score - bullSum * 12);
      p.lastAction = `6TH! -${bullSum}🐂`;
      bestRow.cards = [{ val: card.val, bulls: card.bulls }];
      state.banner = `${p.name} LANDED 6TH IN ROW ${bestRow.id + 1}! (${bullSum} BULLS)`;
      sounds.push({ type: 'elim', playerId: p.id });
    } else {
      bestRow.cards.push({ val: card.val, bulls: card.bulls });
      const gained = 45 * mult;
      p.score += gained;
      p.lastAction = `SAFE +${gained}`;
      sounds.push({ type: 'score', playerId: p.id });
    }
  }
  state.round += 1;
  state.roundTimer = 8.0;
}

export const rowSixBustModule: CompactGameModule<RowSixState, RowSixBustSnapshot> = {
  id: 'row-six-bust',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      round: 1,
      roundTimer: 8.0,
      rows: makeFreshBullRows(),
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.4 + Math.random() * 1.8,
        hand: makeBullHand(6),
        picked: null,
        bullsTaken: 0,
        score: 80,
        lastAction: 'PICKING',
      })),
      banner: 'PLAY SECRET CARDS TO FIT ROWS 1–5 — NEVER BE THE 6TH CARD!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;
    state.roundTimer -= dt * (frenzy ? 1.3 : 1);

    for (const p of state.players) {
      if (!p.isBot || p.picked) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        // Choose card just above a short row if possible
        let pick = p.hand[Math.floor(Math.random() * p.hand.length)];
        for (const c of p.hand) {
          const safeRow = state.rows.find(
            (r) => r.cards.length < 4 && r.cards[r.cards.length - 1].val < c.val && c.val - r.cards[r.cards.length - 1].val <= 12
          );
          if (safeRow) {
            pick = c;
            break;
          }
        }
        p.picked = pick;
        p.lastAction = 'READY';
        p.botTimer = 1.5 + Math.random() * 1.8;
      }
    }

    if (state.roundTimer <= 0 || state.players.every((p) => p.picked !== null)) {
      resolveRowSixTurn(state, mult, sounds);
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = p.hand.map((c) => ({
        id: c.id,
        kind: 'party',
        title: `#${c.val}`,
        subtitle: `${c.bulls} 🐂`,
        badge: p.picked?.id === c.id ? 'LOCKED' : 'PLAY',
        accentHex: c.bulls >= 3 ? '#EF4444' : c.bulls === 2 ? '#F59E0B' : '#38BDF8',
        playable: !p.picked,
        selected: p.picked?.id === c.id,
      }));
      out[p.id] = {
        gameId: 'row-six-bust',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: !p.picked,
        isActionRequired: !p.picked,
        turnTimeLeft: state.roundTimer,
        turnTotal: 8,
        secondaryBtn: {
          label: 'AUTO SAFE PICK',
          labelZh: '快选安全牌',
          action: { type: 'draw-or-pass' },
          colorHex: '#38BDF8',
          textColor: '#07131D',
          disabled: !!p.picked,
        },
        statusHint: 'Tap a card above an open TV row (avoid 5-card rows or lowest card)!',
        statusHintZh: '选一张比某排尾牌稍大的数字卡，避开已满 5 张的爆牛排！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.picked) return { sounds };
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId) {
      const card = p.hand.find((c) => c.id === action.cardId);
      if (card) {
        p.picked = card;
        p.lastAction = 'READY';
        sounds.push({ type: 'card', playerId: p.id });
      }
    } else if (action.type === 'draw-or-pass') {
      p.picked = p.hand[Math.floor(p.hand.length / 2)] ?? p.hand[0];
      p.lastAction = 'READY';
      sounds.push({ type: 'card', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'row-six-bust',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      rows: state.rows,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        picked: !!p.picked,
        bullsTaken: p.bullsTaken,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: p.picked ? 1 : 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.bullsTaken} bulls · ${p.score} pts`);
  },
};

// ============================================================================
// 2. SILENT SYNC (The Mind Style — Pad 4 Card)
// ============================================================================
interface SilentSyncState {
  timeLeft: number;
  totalTime: number;
  level: number;
  lastPlayedNum: number;
  streak: number;
  mistakes: number;
  levelElapsed: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botCheckCd: number;
    hand: { id: string; num: number }[];
    synced: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function dealSilentSyncLevel(state: SilentSyncState) {
  const count = clamp(1 + Math.min(3, state.level), 2, 4);
  const nums = Array.from({ length: 99 }, (_, i) => i + 1);
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  let ptr = 0;
  state.lastPlayedNum = 0;
  state.levelElapsed = 0;
  for (const p of state.players) {
    p.hand = nums
      .slice(ptr, ptr + count)
      .sort((a, b) => a - b)
      .map((num) => ({ id: `ss_${state.level}_${num}`, num }));
    ptr += count;
    p.lastAction = `${p.hand.length} LEFT`;
  }
}

function playSilentCard(
  state: SilentSyncState,
  p: SilentSyncState['players'][0],
  cardId: string,
  mult: number,
  sounds: CompactSoundEvent[]
) {
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return;
  const card = p.hand[idx];
  p.hand.splice(idx, 1);

  const lowerExists = state.players.some((other) => other.hand.some((c) => c.num < card.num));
  if (lowerExists) {
    state.mistakes += 1;
    state.streak = 0;
    p.score = Math.max(0, p.score - 15);
    p.lastAction = `OUT OF ORDER (#${card.num})`;
    state.banner = `${p.name} DROPPED #${card.num} TOO EARLY — LOWER CARDS STILL HELD!`;
    // Burn lower cards cleanly so game flows
    for (const other of state.players) {
      other.hand = other.hand.filter((c) => c.num > card.num);
    }
    sounds.push({ type: 'hit', playerId: p.id });
  } else {
    state.streak += 1;
    p.synced += 1;
    const pts = (55 + Math.min(4, state.streak) * 15) * mult;
    p.score += pts;
    p.lastAction = `SYNCED #${card.num}`;
    state.banner = `${p.name} TELEPATHY SYNC #${card.num}! +${pts}`;
    sounds.push({ type: 'score', playerId: p.id });
  }
  state.lastPlayedNum = card.num;

  if (state.players.every((pl) => pl.hand.length === 0)) {
    for (const pl of state.players) {
      pl.score += 120 * mult;
    }
    state.level += 1;
    dealSilentSyncLevel(state);
    state.banner = `LEVEL ${state.level} SYNCED! +${120 * mult} TEAM BONUS!`;
    sounds.push({ type: 'win' });
  }
}

export const silentSyncModule: CompactGameModule<SilentSyncState, SilentSyncSnapshot> = {
  id: 'silent-sync',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const state: SilentSyncState = {
      timeLeft: totalTime,
      totalTime,
      level: 1,
      lastPlayedNum: 0,
      streak: 0,
      mistakes: 0,
      levelElapsed: 0,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botCheckCd: 0.4,
        hand: [],
        synced: 0,
        score: 0,
        lastAction: 'SYNCING',
      })),
      banner: 'SILENTLY PLAY YOUR LOWEST CARD IN ASCENDING ORDER (1→99)!',
    };
    dealSilentSyncLevel(state);
    return state;
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    state.levelElapsed += dt;
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      if (!p.isBot || p.hand.length === 0) continue;
      const lowest = p.hand[0];
      const gap = Math.max(1, lowest.num - state.lastPlayedNum);
      const waitNeeded = gap * 0.12;
      p.botCheckCd -= dt;
      if (p.botCheckCd <= 0) {
        p.botCheckCd = 0.45;
        if (state.levelElapsed >= waitNeeded || Math.random() < 0.08) {
          playSilentCard(state, p, lowest.id, mult, sounds);
          state.levelElapsed = 0;
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = p.hand.map((c, idx) => ({
        id: c.id,
        kind: 'party',
        title: `#${c.num}`,
        subtitle: idx === 0 ? 'YOUR LOWEST' : `Gap +${c.num - state.lastPlayedNum}`,
        badge: idx === 0 ? 'DROP NEXT' : 'WAIT',
        accentHex: idx === 0 ? '#38BDF8' : '#64748B',
        playable: p.hand.length > 0,
        selected: idx === 0,
      }));
      out[p.id] = {
        gameId: 'silent-sync',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: p.hand.length > 0,
        isActionRequired: p.hand.length > 0,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        badgeText: `TOP: #${state.lastPlayedNum}`,
        badgeColorHex: '#38BDF8',
        primaryBtn: p.hand[0]
          ? {
              label: `DROP LOWEST (#${p.hand[0].num})`,
              labelZh: `打出最小牌 (#${p.hand[0].num})`,
              action: { type: 'play-card', cardId: p.hand[0].id },
              colorHex: '#38BDF8',
              textColor: '#07131D',
            }
          : undefined,
        statusHint: `Count silently above #${state.lastPlayedNum}—tap your lowest card when ready!`,
        statusHintZh: `心里默数当前 #${state.lastPlayedNum} 之后的节奏，时机一到立刻打出最小牌！`,
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.hand.length === 0) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    const cardId =
      (action.type === 'play-card' || action.type === 'toggle-card') && action.cardId
        ? action.cardId
        : p.hand[0].id;
    playSilentCard(state, p, cardId, mult, sounds);
    state.levelElapsed = 0;
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'silent-sync',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      level: state.level,
      lastPlayedNum: state.lastPlayedNum,
      streak: state.streak,
      mistakes: state.mistakes,
      cardsRemaining: state.players.reduce((s, p) => s + p.hand.length, 0),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        cardsLeft: p.hand.length,
        synced: p.synced,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.synced} synced · ${p.score} pts`);
  },
};

// ============================================================================
// 3. DEEP SEA OXYGEN (Deep Sea Adventure Style — Pad 2 Board)
// ============================================================================
interface DeepSeaState {
  timeLeft: number;
  totalTime: number;
  oxygen: number;
  maxOxygen: number;
  oxygenDrainAccum: number;
  depths: { depth: number; treasure: number }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    depth: number;
    bagLoot: number;
    divingDown: boolean;
    banked: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function makeSeaDepths(): { depth: number; treasure: number }[] {
  return Array.from({ length: 10 }, (_, idx) => ({
    depth: idx + 1,
    treasure: 1 + Math.floor(idx / 3),
  }));
}

export const deepSeaOxygenModule: CompactGameModule<DeepSeaState, DeepSeaOxygenSnapshot> = {
  id: 'deep-sea-oxygen',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      oxygen: 25,
      maxOxygen: 25,
      oxygenDrainAccum: 0,
      depths: makeSeaDepths(),
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        depth: 0,
        bagLoot: 0,
        divingDown: true,
        banked: 0,
        score: 0,
        stepCd: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'DIVE FOR TREASURE · TURN BACK (B) BEFORE SHARED OXYGEN HITS 0!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    const totalCarried = state.players.reduce((s, p) => s + p.bagLoot, 0);
    state.oxygenDrainAccum += dt * (1.0 + totalCarried * 0.28);
    if (state.oxygenDrainAccum >= 1.15) {
      state.oxygenDrainAccum = 0;
      state.oxygen = Math.max(0, state.oxygen - 1);
      if (state.oxygen <= 0) {
        for (const p of state.players) {
          if (p.depth > 0) p.bagLoot = 0;
          p.depth = 0;
          p.divingDown = true;
        }
        state.oxygen = state.maxOxygen;
        state.depths = makeSeaDepths();
        state.banner = 'OXYGEN DEPLETED! STRANDED DIVERS DROPPED THEIR LOOT!';
        sounds.push({ type: 'elim' });
      }
    }

    for (const p of state.players) {
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (bDown && !p.prevB && p.cdB <= 0) {
        if (p.depth > 0 && state.depths[p.depth - 1].treasure > 0 && p.divingDown) {
          const lootVal = state.depths[p.depth - 1].treasure;
          p.bagLoot += lootVal;
          state.depths[p.depth - 1].treasure = 0;
          p.score += 20 * mult;
          sounds.push({ type: 'pickup', playerId: p.id });
        } else {
          p.divingDown = !p.divingDown;
          sounds.push({ type: 'tick', playerId: p.id });
        }
        p.cdB = 0.25;
      }

      const wantStep = (p.stepCd <= 0 && Math.abs(my) > 0.38) || (aDown && !p.prevA && p.cdA <= 0);
      if (wantStep) {
        let dir = p.divingDown ? 1 : -1;
        if (Math.abs(my) > 0.38) dir = my > 0 ? 1 : -1;
        if (dir < 0) p.divingDown = false;
        p.depth = clamp(p.depth + dir, 0, state.depths.length);
        p.stepCd = 0.22;
        p.cdA = 0.22;
        if (p.depth > 0 && state.depths[p.depth - 1].treasure > 0 && p.divingDown) {
          const val = state.depths[p.depth - 1].treasure;
          p.bagLoot += val;
          state.depths[p.depth - 1].treasure = 0;
          p.score += 18 * mult;
          sounds.push({ type: 'pickup', playerId: p.id });
        } else if (p.depth === 0 && p.bagLoot > 0) {
          const banked = p.bagLoot * 65 * mult;
          p.banked += p.bagLoot;
          p.score += banked;
          p.bagLoot = 0;
          p.divingDown = true;
          state.banner = `${p.name} RETURNED TO SUBMARINE! +${banked} TREASURE!`;
          sounds.push({ type: 'score', playerId: p.id });
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'deep-sea-oxygen',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      oxygen: state.oxygen,
      maxOxygen: state.maxOxygen,
      depths: state.depths,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        depth: p.depth,
        bagLoot: p.bagLoot,
        divingDown: p.divingDown,
        banked: p.banked,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.22, 0, 1),
        cooldownB: clamp(p.cdB / 0.25, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.banked} chests · ${p.score} pts`);
  },
};

// ============================================================================
// 4. ONE CARD COURT (Love Letter Style — Pad 4 Card)
// ============================================================================
const COURT_ROLES = [
  { name: 'Guard', val: 1, hint: 'Challenge Rival' },
  { name: 'Priest', val: 2, hint: 'Peek & Shield' },
  { name: 'Baron', val: 3, hint: 'Clash Rank' },
  { name: 'Handmaid', val: 4, hint: 'Royal Ward' },
  { name: 'Prince', val: 5, hint: 'Force Swap' },
  { name: 'King', val: 6, hint: 'High Rank' },
  { name: 'Countess', val: 7, hint: 'Noble Lead' },
  { name: 'Princess', val: 8, hint: 'Crown Keep' },
];

interface CourtCard {
  id: string;
  name: string;
  val: number;
  hint: string;
}

function drawCourtCard(): CourtCard {
  const r = COURT_ROLES[Math.floor(Math.random() * COURT_ROLES.length)];
  return { id: `cc_${r.val}_${Math.random().toString(36).slice(2, 6)}`, ...r };
}

interface OneCardCourtState {
  timeLeft: number;
  totalTime: number;
  round: number;
  phase: 'play' | 'showdown';
  phaseTimer: number;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    hand: CourtCard[];
    shielded: boolean;
    playedCard: string | null;
    favors: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function playCourtCard(
  state: OneCardCourtState,
  p: OneCardCourtState['players'][0],
  cardId: string,
  mult: number,
  sounds: CompactSoundEvent[]
) {
  if (p.playedCard) return;
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return;
  const card = p.hand[idx];
  p.hand.splice(idx, 1);
  p.playedCard = `${card.name} (${card.val})`;
  if (card.val === 4 || card.val === 2) p.shielded = true;
  if (card.val === 1 || card.val === 3) {
    p.score += 35 * mult;
    p.lastAction = `${card.name.toUpperCase()} +${35 * mult}`;
  } else {
    p.lastAction = `PLAYED ${card.name.toUpperCase()}`;
  }
  sounds.push({ type: 'card', playerId: p.id });
}

export const oneCardCourtModule: CompactGameModule<OneCardCourtState, OneCardCourtSnapshot> = {
  id: 'one-card-court',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      round: 1,
      phase: 'play',
      phaseTimer: 9.0,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.5 + Math.random() * 1.8,
        hand: [drawCourtCard(), drawCourtCard()],
        shielded: false,
        playedCard: null,
        favors: 0,
        score: 0,
        lastAction: 'CHOOSING',
      })),
      banner: 'PLAY 1 COURT CARD · KEEP YOUR HIGHEST SECRET FOR SHOWDOWN!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    if (state.phase === 'showdown') {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) {
        state.round += 1;
        state.phase = 'play';
        state.phaseTimer = 9.0;
        for (const p of state.players) {
          p.hand = [drawCourtCard(), drawCourtCard()];
          p.shielded = false;
          p.playedCard = null;
          p.botTimer = 1.4 + Math.random() * 1.8;
          p.lastAction = 'CHOOSING';
        }
        state.banner = `COURT ROUND ${state.round} — PROTECT YOUR ROYAL SECRET!`;
      }
      return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
    }

    state.phaseTimer -= dt * (frenzy ? 1.25 : 1);
    for (const p of state.players) {
      if (!p.isBot || p.playedCard) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        const sorted = [...p.hand].sort((a, b) => a.val - b.val);
        const drop = sorted[0];
        if (drop) playCourtCard(state, p, drop.id, mult, sounds);
      }
    }

    if (state.phaseTimer <= 0 || state.players.every((p) => p.playedCard !== null)) {
      state.phase = 'showdown';
      state.phaseTimer = 2.6;
      let bestVal = -1;
      let winner: OneCardCourtState['players'][0] | null = null;
      for (const p of state.players) {
        const held = p.hand[0] ?? { name: 'Guard', val: 1 };
        const val = held.val + (p.shielded ? 1 : 0);
        if (val > bestVal) {
          bestVal = val;
          winner = p;
        }
      }
      if (winner) {
        winner.favors += 1;
        const pts = 150 * mult;
        winner.score += pts;
        winner.lastAction = 'ROYAL FAVOR!';
        state.banner = `${winner.name} WON THE ROYAL COURT! +${pts}`;
        sounds.push({ type: 'score', playerId: winner.id });
      }
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = p.hand.map((c) => ({
        id: c.id,
        kind: 'party',
        title: `${c.name.toUpperCase()} (${c.val})`,
        subtitle: c.hint,
        badge: p.playedCard ? 'KEPT SECRET' : 'PLAY THIS',
        accentHex: c.val >= 6 ? '#FACC15' : '#EC4899',
        playable: state.phase === 'play' && !p.playedCard && p.hand.length > 1,
        selected: false,
      }));
      out[p.id] = {
        gameId: 'one-card-court',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: state.phase === 'play' && !p.playedCard,
        isActionRequired: state.phase === 'play' && !p.playedCard,
        turnTimeLeft: state.phaseTimer,
        turnTotal: 9,
        secondaryBtn: {
          label: 'WARD SHIELD',
          labelZh: '护盾守秘',
          action: { type: 'draw-or-pass' },
          colorHex: '#38BDF8',
          textColor: '#07131D',
          disabled: !!p.playedCard || state.phase !== 'play',
        },
        statusHint: 'Play 1 Court Card—keep your highest Rank hidden for Showdown!',
        statusHintZh: '打出 1 张宫廷牌，把点数最大的皇室密牌留在手里决胜！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    if (state.phase !== 'play') return { sounds };
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.playedCard) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId) {
      playCourtCard(state, p, action.cardId, mult, sounds);
    } else if (action.type === 'draw-or-pass' && p.hand.length > 0) {
      p.shielded = true;
      const lowest = [...p.hand].sort((a, b) => a.val - b.val)[0];
      if (lowest) playCourtCard(state, p, lowest.id, mult, sounds);
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'one-card-court',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      phase: state.phase,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        shielded: p.shielded,
        playedCard: p.playedCard,
        favors: p.favors,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: p.playedCard ? 1 : 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.favors} favors · ${p.score} pts`);
  },
};

// ============================================================================
// 5. FIREWORK HINTS (Hanabi Style — Pad 4 Card)
// ============================================================================
interface FireworkCard {
  id: string;
  color: FWColor;
  num: number;
  hinted: boolean;
}

function drawFireworkCard(): FireworkCard {
  return {
    id: `fw_${Math.random().toString(36).slice(2, 8)}`,
    color: FW_COLORS[Math.floor(Math.random() * 4)],
    num: 1 + Math.floor(Math.random() * 5),
    hinted: false,
  };
}

interface FireworkState {
  timeLeft: number;
  totalTime: number;
  hintTokens: number;
  fuseLives: number;
  stacks: Record<FWColor, number>;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    actionCd: number;
    hand: FireworkCard[];
    hintsGiven: number;
    launched: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function launchFirework(
  state: FireworkState,
  p: FireworkState['players'][0],
  cardId: string,
  mult: number,
  sounds: CompactSoundEvent[]
) {
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return;
  const card = p.hand[idx];
  p.hand.splice(idx, 1);
  p.hand.push(drawFireworkCard());

  const needed = state.stacks[card.color] + 1;
  if (card.num === needed) {
    state.stacks[card.color] = card.num;
    p.launched += 1;
    const finale = card.num === 5;
    const pts = (finale ? 200 : 95) * mult;
    p.score += pts;
    p.lastAction = `${card.color.toUpperCase()} #${card.num}`;
    if (finale) {
      state.stacks[card.color] = 0;
      state.banner = `${p.name} LAUNCHED GRAND FINALE #5! +${pts}`;
    } else {
      state.banner = `${p.name} LIT ${card.color.toUpperCase()} ROCKET #${card.num}! +${pts}`;
    }
    sounds.push({ type: 'score', playerId: p.id });
  } else {
    state.fuseLives = Math.max(1, state.fuseLives - 1);
    p.score = Math.max(0, p.score - 15);
    p.lastAction = 'MISFIRE!';
    sounds.push({ type: 'hit', playerId: p.id });
  }
}

export const fireworkHintsModule: CompactGameModule<FireworkState, FireworkHintsSnapshot> = {
  id: 'firework-hints',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      hintTokens: 5,
      fuseLives: 3,
      stacks: { red: 0, blue: 0, gold: 0, green: 0 },
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.6 + Math.random() * 1.6,
        actionCd: 0,
        hand: Array.from({ length: 5 }, () => drawFireworkCard()),
        hintsGiven: 0,
        launched: 0,
        score: 0,
        lastAction: 'READY',
      })),
      banner: 'LAUNCH COLOR ROCKETS IN STRICT 1→2→3→4→5 SEQUENCE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.actionCd = Math.max(0, p.actionCd - dt);
      if (!p.isBot) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        p.botTimer = 1.9 + Math.random() * 1.7;
        const playable = p.hand.find((c) => state.stacks[c.color] + 1 === c.num);
        if (playable) {
          launchFirework(state, p, playable.id, mult, sounds);
        } else {
          state.hintTokens = Math.min(8, state.hintTokens + 1);
          p.hintsGiven += 1;
          p.score += 30 * mult;
          p.hand[0] = drawFireworkCard();
          p.lastAction = 'GAVE HINT';
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = p.hand.map((c) => {
        const nextNeeded = state.stacks[c.color] + 1 === c.num;
        return {
          id: c.id,
          kind: 'party',
          title: `${c.color.toUpperCase()} #${c.num}`,
          subtitle: nextNeeded ? 'READY TO LAUNCH!' : `Need #${state.stacks[c.color] + 1}`,
          badge: nextNeeded ? 'FIRE!' : 'HOLD',
          accentHex: FW_HEX[c.color],
          playable: true,
          selected: nextNeeded,
        };
      });
      out[p.id] = {
        gameId: 'firework-hints',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: true,
        isActionRequired: true,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        badgeText: `HINTS: ${state.hintTokens}`,
        badgeColorHex: '#FACC15',
        secondaryBtn: {
          label: 'GIVE HINT (+30)',
          labelZh: '给出线索 (+30)',
          action: { type: 'draw-or-pass' },
          colorHex: '#38BDF8',
          textColor: '#07131D',
        },
        statusHint: 'Launch glowing cards matching the NEXT 1→5 step on TV, or GIVE HINT!',
        statusHintZh: '点击亮起可接龙的烟花卡按 1→5 发射升空，或发线索换新牌！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.actionCd > 0) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    p.actionCd = 0.4;
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId) {
      launchFirework(state, p, action.cardId, mult, sounds);
    } else if (action.type === 'draw-or-pass') {
      state.hintTokens = Math.min(8, state.hintTokens + 1);
      p.hintsGiven += 1;
      p.score += 30 * mult;
      p.hand[Math.floor(Math.random() * p.hand.length)] = drawFireworkCard();
      p.lastAction = 'HINT +30';
      sounds.push({ type: 'card', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'firework-hints',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      hintTokens: state.hintTokens,
      fuseLives: state.fuseLives,
      stacks: FW_COLORS.map((color) => ({ color, topVal: state.stacks[color] })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        hintsGiven: p.hintsGiven,
        launched: p.launched,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: clamp(p.actionCd / 0.4, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.launched} rockets · ${p.score} pts`);
  },
};

// ============================================================================
// 6. TUNNEL SABOTEUR (Saboteur Style — Pad 4 Card)
// ============================================================================
type MineCardKind = 'tunnel' | 'dynamite' | 'sabotage' | 'gold-map';

interface MineCard {
  id: string;
  kind: MineCardKind;
  title: string;
  pts: number;
}

function drawMineCard(): MineCard {
  const r = Math.random();
  if (r < 0.56) return { id: `mn_${Math.random().toString(36).slice(2, 7)}`, kind: 'tunnel', title: 'DIG TUNNEL', pts: 45 };
  if (r < 0.76) return { id: `mn_${Math.random().toString(36).slice(2, 7)}`, kind: 'dynamite', title: 'DYNAMITE', pts: 65 };
  if (r < 0.9) return { id: `mn_${Math.random().toString(36).slice(2, 7)}`, kind: 'sabotage', title: 'CAVE-IN', pts: 40 };
  return { id: `mn_${Math.random().toString(36).slice(2, 7)}`, kind: 'gold-map', title: 'GOLD VEIN', pts: 90 };
}

interface TunnelSaboteurState {
  timeLeft: number;
  totalTime: number;
  cols: number;
  rows: number;
  tunnelCells: ('empty' | 'path' | 'rock' | 'gold')[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    actionCd: number;
    hand: MineCard[];
    digs: number;
    goldFound: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function makeFreshCavern(cols: number, rows: number): ('empty' | 'path' | 'rock' | 'gold')[] {
  const cells: ('empty' | 'path' | 'rock' | 'gold')[] = new Array(cols * rows).fill('empty');
  cells[cols] = 'path';
  cells[cols * 2] = 'path';
  for (let r = 0; r < rows; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (Math.random() < 0.28) cells[r * cols + c] = 'rock';
    }
    cells[r * cols + (cols - 1)] = r === 1 || r === 2 ? 'gold' : 'rock';
  }
  return cells;
}

function playMineCard(
  state: TunnelSaboteurState,
  p: TunnelSaboteurState['players'][0],
  cardId: string,
  mult: number,
  sounds: CompactSoundEvent[]
) {
  const idx = p.hand.findIndex((c) => c.id === cardId);
  if (idx < 0) return;
  const card = p.hand[idx];
  p.hand[idx] = drawMineCard();

  if (card.kind === 'sabotage') {
    const pathCells = state.tunnelCells
      .map((v, i) => (v === 'path' && i % state.cols > 0 ? i : -1))
      .filter((i) => i >= 0);
    if (pathCells.length > 0) {
      state.tunnelCells[pathCells[Math.floor(Math.random() * pathCells.length)]] = 'rock';
    }
    p.score += card.pts * mult;
    p.lastAction = 'CAVE-IN!';
    sounds.push({ type: 'hit', playerId: p.id });
    return;
  }

  // Dig forward along earliest empty/rock cell toward gold
  let targetIdx = state.tunnelCells.findIndex((v) => v === 'gold');
  const openDig = state.tunnelCells.findIndex((v, i) => {
    const col = i % state.cols;
    return col > 0 && (v === 'empty' || (card.kind === 'dynamite' && v === 'rock'));
  });

  if (openDig >= 0) {
    state.tunnelCells[openDig] = 'path';
    p.digs += 1;
    p.score += card.pts * mult;
    p.lastAction = card.title;
    sounds.push({ type: 'pickup', playerId: p.id });

    if (openDig % state.cols >= state.cols - 2 && targetIdx >= 0) {
      state.tunnelCells[targetIdx] = 'path';
      p.goldFound += 1;
      const bonus = 180 * mult;
      p.score += bonus;
      p.lastAction = 'STRUCK GOLD!';
      state.banner = `${p.name} STRUCK THE GOLD VEIN! +${bonus}`;
      sounds.push({ type: 'score', playerId: p.id });
    }
  } else {
    state.tunnelCells = makeFreshCavern(state.cols, state.rows);
    p.score += 75 * mult;
    state.banner = 'GOLD VEIN MINED — FRESH CAVERN OPENED!';
  }
}

export const tunnelSaboteurModule: CompactGameModule<TunnelSaboteurState, TunnelSaboteurSnapshot> = {
  id: 'tunnel-saboteur',
  init({ players, settingValue }) {
    const cols = 7;
    const rows = 4;
    const totalTime = settingValue || 90;
    return {
      timeLeft: totalTime,
      totalTime,
      cols,
      rows,
      tunnelCells: makeFreshCavern(cols, rows),
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.6 + Math.random() * 1.6,
        actionCd: 0,
        hand: Array.from({ length: 4 }, () => drawMineCard()),
        digs: 0,
        goldFound: 0,
        score: 0,
        lastAction: 'MINING',
      })),
      banner: 'DIG TUNNELS TOWARD THE EASTERN GOLD VEINS (+180)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.actionCd = Math.max(0, p.actionCd - dt);
      if (!p.isBot) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        p.botTimer = 1.6 + Math.random() * 1.6;
        const pick = p.hand.find((c) => c.kind !== 'sabotage') ?? p.hand[0];
        if (pick) playMineCard(state, p, pick.id, mult, sounds);
      }
    }

    if (!state.tunnelCells.some((v) => v === 'gold')) {
      state.tunnelCells = makeFreshCavern(state.cols, state.rows);
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = p.hand.map((c) => ({
        id: c.id,
        kind: 'party',
        title: c.title,
        subtitle: c.kind === 'sabotage' ? 'Block rival tunnel' : `+${c.pts} dig`,
        badge: c.kind.toUpperCase(),
        accentHex: c.kind === 'gold-map' ? '#FACC15' : c.kind === 'sabotage' ? '#EF4444' : '#F59E0B',
        playable: true,
        selected: false,
      }));
      out[p.id] = {
        gameId: 'tunnel-saboteur',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: true,
        isActionRequired: true,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        secondaryBtn: {
          label: 'REFILL HAND',
          labelZh: '重抽矿卡',
          action: { type: 'draw-or-pass' },
          colorHex: '#10D98B',
          textColor: '#0A1913',
        },
        statusHint: 'Play DIG TUNNEL & DYNAMITE cards to carve right toward the Gold!',
        statusHintZh: '打出掘进或炸药卡向右挖穿岩壁直达黄金矿脉！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.actionCd > 0) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    p.actionCd = 0.4;
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId) {
      playMineCard(state, p, action.cardId, mult, sounds);
    } else if (action.type === 'draw-or-pass') {
      p.hand = Array.from({ length: 4 }, () => drawMineCard());
      p.lastAction = 'REFILLED';
      sounds.push({ type: 'card', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'tunnel-saboteur',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      cols: state.cols,
      rows: state.rows,
      tunnelCells: state.tunnelCells,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        digs: p.digs,
        goldFound: p.goldFound,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: clamp(p.actionCd / 0.4, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.goldFound} gold · ${p.score} pts`);
  },
};

// ============================================================================
// 7. PICROSS NONOGRAM RACE (Picross Style — Pad 2 Board)
// ============================================================================
const PICROSS_PATTERNS: number[][] = [
  // Heart
  [0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0],
  // Crown / Trophy
  [1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0],
  // Rocket
  [0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 0, 1],
  // Smile
  [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0],
];

function computeClues(solution: number[], size: number): { rowClues: string[]; colClues: string[] } {
  const runLine = (vals: number[]) => {
    const out: number[] = [];
    let run = 0;
    for (const v of vals) {
      if (v === 1) run++;
      else if (run > 0) {
        out.push(run);
        run = 0;
      }
    }
    if (run > 0) out.push(run);
    return out.length > 0 ? out.join(' ') : '0';
  };
  const rowClues = Array.from({ length: size }, (_, r) => runLine(solution.slice(r * size, (r + 1) * size)));
  const colClues = Array.from({ length: size }, (_, c) =>
    runLine(Array.from({ length: size }, (__, r) => solution[r * size + c]))
  );
  return { rowClues, colClues };
}

interface PicrossState {
  timeLeft: number;
  totalTime: number;
  size: number;
  puzzleIndex: number;
  solution: number[];
  rowClues: string[];
  colClues: string[];
  revealed: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    hits: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function loadPicrossPuzzle(state: PicrossState, idx: number) {
  state.puzzleIndex = idx % PICROSS_PATTERNS.length;
  state.solution = [...PICROSS_PATTERNS[state.puzzleIndex]];
  const clues = computeClues(state.solution, state.size);
  state.rowClues = clues.rowClues;
  state.colClues = clues.colClues;
  state.revealed = new Array(state.size * state.size).fill(-1);
}

export const picrossNonogramModule: CompactGameModule<PicrossState, PicrossNonogramSnapshot> = {
  id: 'picross-nonogram',
  init({ players, settingValue }) {
    const size = 5;
    const totalTime = settingValue || 90;
    const sol = [...PICROSS_PATTERNS[0]];
    const clues = computeClues(sol, size);
    return {
      timeLeft: totalTime,
      totalTime,
      size,
      puzzleIndex: 0,
      solution: sol,
      rowClues: clues.rowClues,
      colClues: clues.colClues,
      revealed: new Array(size * size).fill(-1),
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: i % size,
        c: Math.floor(i / size) % size,
        hits: 0,
        score: 0,
        stepCd: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'READ ROW & COL CLUES — PAINT PIXEL ART CELLS WITH (A)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCd <= 0 && (Math.abs(mx) > 0.35 || Math.abs(my) > 0.35)) {
        if (Math.abs(mx) >= Math.abs(my)) p.c = clamp(p.c + Math.sign(mx), 0, state.size - 1);
        else p.r = clamp(p.r + Math.sign(my), 0, state.size - 1);
        p.stepCd = 0.14;
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        // Scan hint: snap cursor to an unsolved pixel cell
        const idx = state.solution.findIndex((v, i) => v === 1 && state.revealed[i] === -1);
        if (idx >= 0) {
          p.r = Math.floor(idx / state.size);
          p.c = idx % state.size;
        }
        p.cdB = 2.0;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const idx = p.r * state.size + p.c;
        if (state.revealed[idx] === -1) {
          if (state.solution[idx] === 1) {
            state.revealed[idx] = p.slotIndex;
            p.hits += 1;
            const pts = 65 * mult;
            p.score += pts;
            p.cdA = frenzy ? 0.18 : 0.3;
            sounds.push({ type: 'score', playerId: p.id });

            const solvedAll = state.solution.every((v, i) => v === 0 || state.revealed[i] >= 0);
            if (solvedAll) {
              const clearBonus = 150 * mult;
              p.score += clearBonus;
              state.banner = `${p.name} SOLVED THE PIXEL SPRITE! +${clearBonus}`;
              loadPicrossPuzzle(state, state.puzzleIndex + 1);
            }
          } else {
            state.revealed[idx] = -2;
            p.score = Math.max(0, p.score - 10);
            p.cdA = 0.5;
            sounds.push({ type: 'hit', playerId: p.id });
          }
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'picross-nonogram',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      size: state.size,
      puzzleIndex: state.puzzleIndex,
      rowClues: state.rowClues,
      colClues: state.colClues,
      revealed: state.revealed,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: p.r,
        c: p.c,
        hits: p.hits,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.3, 0, 1),
        cooldownB: clamp(p.cdB / 2.0, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.hits} pixels · ${p.score} pts`);
  },
};

// ============================================================================
// 8. SPEED SUDOKU DUEL (6x6 Mini Sudoku — Pad 2 Board)
// ============================================================================
const SUDOKU_6X6_SOLUTIONS: number[][] = [
  [
    1, 2, 3, 4, 5, 6,
    4, 5, 6, 1, 2, 3,
    2, 3, 4, 5, 6, 1,
    5, 6, 1, 2, 3, 4,
    3, 1, 2, 6, 4, 5,
    6, 4, 5, 3, 1, 2,
  ],
  [
    6, 5, 4, 3, 2, 1,
    3, 2, 1, 6, 5, 4,
    5, 4, 3, 2, 1, 6,
    2, 1, 6, 5, 4, 3,
    4, 6, 5, 1, 3, 2,
    1, 3, 2, 4, 6, 5,
  ],
];

interface SpeedSudokuState {
  timeLeft: number;
  totalTime: number;
  size: number;
  puzzleIdx: number;
  solution: number[];
  grid: number[];
  lockedMask: boolean[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    r: number;
    c: number;
    pickNum: number;
    solves: number;
    score: number;
    stepCd: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function loadSudokuPuzzle(state: SpeedSudokuState, idx: number) {
  state.puzzleIdx = idx % SUDOKU_6X6_SOLUTIONS.length;
  state.solution = [...SUDOKU_6X6_SOLUTIONS[state.puzzleIdx]];
  state.grid = state.solution.map((v, i) => ((i * 7 + idx) % 3 === 0 ? 0 : v));
  state.lockedMask = state.grid.map((v) => v !== 0);
}

export const speedSudokuDuelModule: CompactGameModule<SpeedSudokuState, SpeedSudokuDuelSnapshot> = {
  id: 'speed-sudoku-duel',
  init({ players, settingValue }) {
    const size = 6;
    const totalTime = settingValue || 90;
    const state: SpeedSudokuState = {
      timeLeft: totalTime,
      totalTime,
      size,
      puzzleIdx: 0,
      solution: [],
      grid: [],
      lockedMask: [],
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: i % size,
        c: Math.floor(i / size) % size,
        pickNum: 1,
        solves: 0,
        score: 0,
        stepCd: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'CYCLE DIGITS 1–6 (B) & FILL EMPTY SUDOKU CELLS (A)!',
    };
    loadSudokuPuzzle(state, 0);
    return state;
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.stepCd = Math.max(0, p.stepCd - dt);
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      if (p.stepCd <= 0 && (Math.abs(mx) > 0.35 || Math.abs(my) > 0.35)) {
        if (Math.abs(mx) >= Math.abs(my)) p.c = clamp(p.c + Math.sign(mx), 0, state.size - 1);
        else p.r = clamp(p.r + Math.sign(my), 0, state.size - 1);
        p.stepCd = 0.14;
      }

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.pickNum = (p.pickNum % 6) + 1;
        p.cdB = 0.12;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      if (aDown && !p.prevA && p.cdA <= 0) {
        const idx = p.r * state.size + p.c;
        if (state.grid[idx] === 0) {
          if (state.solution[idx] === p.pickNum) {
            state.grid[idx] = p.pickNum;
            p.solves += 1;
            const pts = 75 * mult;
            p.score += pts;
            p.cdA = frenzy ? 0.18 : 0.32;
            sounds.push({ type: 'score', playerId: p.id });

            if (state.grid.every((v) => v !== 0)) {
              const clearBonus = 160 * mult;
              p.score += clearBonus;
              state.banner = `${p.name} COMPLETED 6×6 SUDOKU! +${clearBonus}`;
              loadSudokuPuzzle(state, state.puzzleIdx + 1);
            }
          } else {
            p.score = Math.max(0, p.score - 10);
            p.cdA = 0.4;
            sounds.push({ type: 'hit', playerId: p.id });
          }
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'speed-sudoku-duel',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      size: state.size,
      grid: state.grid,
      lockedMask: state.lockedMask,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        r: p.r,
        c: p.c,
        pickNum: p.pickNum,
        solves: p.solves,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.32, 0, 1),
        cooldownB: clamp(p.cdB / 0.12, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.solves} digits · ${p.score} pts`);
  },
};

// ============================================================================
// 9. WORD TILE CROSSROADS (Scrabble Style — Pad 4 Card)
// ============================================================================
const WORD_POOL = ['STAR', 'GOLD', 'FIRE', 'RUSH', 'GAME', 'CUBE', 'QUIZ', 'WAVE', 'KING', 'NOVA', 'BOLT', 'COIN'];

interface WordTileState {
  timeLeft: number;
  totalTime: number;
  targets: { word: string; filled: boolean[]; claimedBy: string | null; bonus: number }[];
  playedLetters: string[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botTimer: number;
    actionCd: number;
    rack: { id: string; letter: string }[];
    wordsBuilt: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function makeRackForTargets(targets: WordTileState['targets']): { id: string; letter: string }[] {
  const needed = targets.flatMap((t) => t.word.split('')).filter((_, i) => i % 2 === 0 || Math.random() < 0.7);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letters: string[] = [];
  for (let i = 0; i < 4 && needed.length > 0; i++) {
    letters.push(needed[Math.floor(Math.random() * needed.length)]);
  }
  while (letters.length < 7) {
    letters.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
  }
  return letters.map((letter) => ({ id: `wt_${letter}_${Math.random().toString(36).slice(2, 6)}`, letter }));
}

function makeWordTargets() {
  const shuffled = [...WORD_POOL].sort(() => Math.random() - 0.5).slice(0, 3);
  return shuffled.map((word) => ({
    word,
    filled: new Array(word.length).fill(false),
    claimedBy: null as string | null,
    bonus: 140,
  }));
}

function playWordTile(
  state: WordTileState,
  p: WordTileState['players'][0],
  tileId: string,
  mult: number,
  sounds: CompactSoundEvent[]
): boolean {
  const idx = p.rack.findIndex((t) => t.id === tileId);
  if (idx < 0) return false;
  const letter = p.rack[idx].letter;

  for (const t of state.targets) {
    if (t.claimedBy) continue;
    const pos = t.word.split('').findIndex((ch, ci) => ch === letter && !t.filled[ci]);
    if (pos >= 0) {
      t.filled[pos] = true;
      state.playedLetters.push(letter);
      if (state.playedLetters.length > 10) state.playedLetters.shift();
      p.rack[idx] = makeRackForTargets(state.targets)[0];

      if (t.filled.every(Boolean)) {
        t.claimedBy = p.name;
        p.wordsBuilt += 1;
        const pts = t.bonus * mult;
        p.score += pts;
        p.lastAction = `SPELLED ${t.word}!`;
        state.banner = `${p.name} COMPLETED "${t.word}"! +${pts}`;
        sounds.push({ type: 'score', playerId: p.id });
      } else {
        const pts = 35 * mult;
        p.score += pts;
        p.lastAction = `TILE [${letter}]`;
        sounds.push({ type: 'card', playerId: p.id });
      }
      return true;
    }
  }
  return false;
}

export const wordTileCrossroadsModule: CompactGameModule<WordTileState, WordTileCrossroadsSnapshot> = {
  id: 'word-tile-crossroads',
  init({ players, settingValue }) {
    const totalTime = settingValue || 90;
    const targets = makeWordTargets();
    return {
      timeLeft: totalTime,
      totalTime,
      targets,
      playedLetters: [],
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botTimer: 1.5 + Math.random() * 1.5,
        actionCd: 0,
        rack: makeRackForTargets(targets),
        wordsBuilt: 0,
        score: 0,
        lastAction: 'BUILDING',
      })),
      banner: 'TAP HIGHLIGHTED LETTER TILES TO SPELL SHARED TARGET WORDS (+140)!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    if (state.targets.every((t) => t.claimedBy !== null)) {
      state.targets = makeWordTargets();
      state.banner = 'NEW TARGET WORDS REVEALED!';
    }

    for (const p of state.players) {
      p.actionCd = Math.max(0, p.actionCd - dt);
      if (!p.isBot) continue;
      p.botTimer -= dt;
      if (p.botTimer <= 0) {
        p.botTimer = 1.7 + Math.random() * 1.7;
        const neededChars = new Set(
          state.targets.flatMap((t) => (t.claimedBy ? [] : t.word.split('').filter((_, ci) => !t.filled[ci])))
        );
        const match = p.rack.find((t) => neededChars.has(t.letter));
        if (match) {
          playWordTile(state, p, match.id, mult, sounds);
        } else {
          p.rack = makeRackForTargets(state.targets);
          p.lastAction = 'SWAPPED';
        }
      }
    }

    return { finished: state.timeLeft <= 0, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    const neededChars = new Set(
      state.targets.flatMap((t) => (t.claimedBy ? [] : t.word.split('').filter((_, ci) => !t.filled[ci])))
    );
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = p.rack.map((t) => {
        const fits = neededChars.has(t.letter);
        return {
          id: t.id,
          kind: 'party',
          title: t.letter,
          subtitle: fits ? 'FITS WORD!' : 'Hold / Swap',
          badge: fits ? '+35' : 'TILE',
          accentHex: fits ? '#22C55E' : '#475569',
          playable: fits,
          selected: fits,
        };
      });
      out[p.id] = {
        gameId: 'word-tile-crossroads',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: true,
        isActionRequired: true,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        secondaryBtn: {
          label: 'SWAP RACK',
          labelZh: '换一架字母',
          action: { type: 'draw-or-pass' },
          colorHex: '#FFB800',
          textColor: '#14120B',
        },
        statusHint: 'Tap glowing GREEN letters to complete target words, or SWAP RACK!',
        statusHintZh: '点击高亮绿色字母镶嵌拼出大屏目标单词，不够顺手可点「换一架字母」！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.actionCd > 0) return { sounds };
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    p.actionCd = 0.35;
    if ((action.type === 'play-card' || action.type === 'toggle-card') && action.cardId) {
      if (!playWordTile(state, p, action.cardId, mult, sounds)) {
        sounds.push({ type: 'tick', playerId: p.id });
      }
    } else if (action.type === 'draw-or-pass') {
      p.rack = makeRackForTargets(state.targets);
      p.lastAction = 'NEW RACK';
      sounds.push({ type: 'card', playerId: p.id });
    }
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'word-tile-crossroads',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      targetWords: state.targets.map((t) => ({
        word: t.word
          .split('')
          .map((ch, i) => (t.filled[i] ? ch : `(${ch})`))
          .join(' '),
        claimedBy: t.claimedBy,
        bonus: t.bonus,
      })),
      playedLetters: state.playedLetters,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        wordsBuilt: p.wordsBuilt,
        score: p.score,
        lastAction: p.lastAction,
        cooldownA: clamp(p.actionCd / 0.35, 0, 1),
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.wordsBuilt} words · ${p.score} pts`);
  },
};

// ============================================================================
// 10. TANGRAM SILHOUETTE SPRINT (Pad 3 Direct Touch/Swipe)
// ============================================================================
const TANGRAM_SHAPES: TangramSilhouetteSnapshot['shapeKind'][] = [
  'triangle',
  'diamond',
  'parallelogram',
  'square',
];

interface TangramState {
  timeLeft: number;
  totalTime: number;
  puzzlesSolved: number;
  targetX: number;
  targetY: number;
  targetRot: number;
  shapeKind: TangramSilhouetteSnapshot['shapeKind'];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    x: number;
    y: number;
    rot: number;
    matches: number;
    score: number;
    cdA: number;
    cdB: number;
    prevA: boolean;
    prevB: boolean;
  }[];
  banner: string | null;
}

function spawnTangramTarget(state: TangramState) {
  state.targetX = 320 + Math.random() * (ARENA_WIDTH - 640);
  state.targetY = 180 + Math.random() * (ARENA_HEIGHT - 380);
  state.targetRot = Math.floor(Math.random() * 4) * 45;
  state.shapeKind = TANGRAM_SHAPES[Math.floor(Math.random() * TANGRAM_SHAPES.length)];
}

export const tangramSilhouetteModule: CompactGameModule<TangramState, TangramSilhouetteSnapshot> = {
  id: 'tangram-silhouette',
  init({ players, settingValue }) {
    const totalTime = settingValue || 75;
    const state: TangramState = {
      timeLeft: totalTime,
      totalTime,
      puzzlesSolved: 0,
      targetX: 600,
      targetY: 340,
      targetRot: 45,
      shapeKind: 'triangle',
      players: players.map((p, i) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: 240 + (i % 4) * 220,
        y: 440 + Math.floor(i / 4) * 90,
        rot: 0,
        matches: 0,
        score: 0,
        cdA: 0,
        cdB: 0,
        prevA: false,
        prevB: false,
      })),
      banner: 'GLIDE SHAPE OVER THE WHITE SILHOUETTE · ROTATE (B) · SNAP LOCK (A)!',
    };
    spawnTangramTarget(state);
    return state;
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      p.cdA = Math.max(0, p.cdA - dt);
      p.cdB = Math.max(0, p.cdB - dt);

      const inp = players.find((x) => x.id === p.id)?.input;
      const mx = inp?.moveX ?? 0;
      const my = inp?.moveY ?? 0;
      const aDown = !!inp?.actionA;
      const bDown = !!inp?.actionB;

      p.x = clamp(p.x + mx * (frenzy ? 430 : 350) * dt, 120, ARENA_WIDTH - 120);
      p.y = clamp(p.y + my * (frenzy ? 430 : 350) * dt, 130, ARENA_HEIGHT - 130);

      if (bDown && !p.prevB && p.cdB <= 0) {
        p.rot = (p.rot + 45) % 180;
        p.cdB = 0.14;
        sounds.push({ type: 'tick', playerId: p.id });
      }

      const dist = Math.hypot(p.x - state.targetX, p.y - state.targetY);
      const rotMatch = p.rot % 180 === state.targetRot % 180;
      const snapRadius = frenzy ? 72 : 52;

      if ((aDown && !p.prevA && p.cdA <= 0) || (frenzy && dist < 34 && rotMatch)) {
        if (dist < snapRadius && (rotMatch || frenzy)) {
          p.matches += 1;
          state.puzzlesSolved += 1;
          const pts = 180 * mult;
          p.score += pts;
          p.cdA = 0.35;
          state.banner = `${p.name} SNAPPED TANGRAM SILHOUETTE! +${pts}`;
          sounds.push({ type: 'score', playerId: p.id });
          spawnTangramTarget(state);
        } else {
          p.cdA = 0.2;
          sounds.push({ type: 'hit', playerId: p.id });
        }
      }

      p.prevA = aDown;
      p.prevB = bDown;
    }

    return { finished: state.timeLeft <= 0, sounds };
  },
  snapshot(state) {
    return {
      gameId: 'tangram-silhouette',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      puzzlesSolved: state.puzzlesSolved,
      targetX: state.targetX,
      targetY: state.targetY,
      targetRot: state.targetRot,
      shapeKind: state.shapeKind,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        x: p.x,
        y: p.y,
        rot: p.rot,
        matches: p.matches,
        score: p.score,
        cooldownA: clamp(p.cdA / 0.35, 0, 1),
        cooldownB: clamp(p.cdB / 0.14, 0, 1),
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.matches} snaps · ${p.score} pts`);
  },
};
