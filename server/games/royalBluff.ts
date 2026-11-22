import { getCardSeatPosition, TABLE_CENTER_X, TABLE_CENTER_Y } from '../../src/shared/cardLayout.ts';
import type {
  CardActionButton,
  CardPrivateState,
  CardShockwave,
  RankingEntry,
  RoyalBluffSnapshot,
  SoundEvent,
} from '../../src/shared/types.ts';
import type { HapticTrigger, PlayerHudUpdate, ServerGameModule } from './engine.ts';

const ACTION_TIME = 14.0;
const CHALLENGE_TIME = 4.6;

type CourtRole = 'DUKE' | 'CAPTAIN' | 'ASSASSIN' | 'AMBASSADOR' | 'CONTESSA';

const ROLE_META: Record<CourtRole, { subtitle: string; badge: string; accentHex: string; secondaryHex: string }> = {
  DUKE: { subtitle: 'Tax +3 Coins', badge: 'TAX', accentHex: '#A855F7', secondaryHex: '#581C87' },
  CAPTAIN: { subtitle: 'Steal 2 Coins', badge: 'STEAL', accentHex: '#00C2FF', secondaryHex: '#075985' },
  ASSASSIN: { subtitle: 'Pay 3: Strike', badge: 'HIT', accentHex: '#EF4444', secondaryHex: '#7F1D1D' },
  AMBASSADOR: { subtitle: 'Swap +1 Coin', badge: 'SWAP', accentHex: '#10D98B', secondaryHex: '#065F46' },
  CONTESSA: { subtitle: 'Blocks Assassin', badge: 'GUARD', accentHex: '#F59E0B', secondaryHex: '#92400E' },
};

const ALL_ROLES: CourtRole[] = ['DUKE', 'CAPTAIN', 'ASSASSIN', 'AMBASSADOR', 'CONTESSA'];

interface PendingClaimInternal {
  actorId: string;
  actorName: string;
  actionId: 'duke' | 'captain' | 'assassin' | 'ambassador';
  actionName: string;
  claimedRole: CourtRole;
  targetId: string | null;
  targetName: string | null;
  trustedBy: Set<string>;
}

interface RoyalPlayerInternal {
  id: string;
  slotIndex: number;
  name: string;
  colorHex: string;
  isBot?: boolean;
  coins: number;
  hiddenRoles: CourtRole[];
  revealedRoles: CourtRole[];
  score: number;
  lastAction: string | null;
  lastActionTimer: number;
}

export interface RoyalBluffState {
  round: number;
  deck: CourtRole[];
  activePlayerIndex: number;
  phase: 'action' | 'challenge' | 'resolve';
  turnTimeLeft: number;
  turnTotal: number;
  botThinkTimer: number;
  resolveTimer: number;
  pendingClaim: PendingClaimInternal | null;
  banner: string | null;
  bannerColor: string | null;
  bannerTimer: number;
  shockwaves: CardShockwave[];
  popups: { x: number; y: number; text: string; colorHex: string; alpha: number }[];
  players: RoyalPlayerInternal[];
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

function buildCourtDeck(): CourtRole[] {
  const d: CourtRole[] = [];
  for (const r of ALL_ROLES) {
    for (let i = 0; i < 4; i++) d.push(r);
  }
  return shuffle(d);
}

function seatOf(state: RoyalBluffState, id: string) {
  const idx = Math.max(0, state.players.findIndex((p) => p.id === id));
  return getCardSeatPosition(idx, state.players.length);
}

function setBanner(state: RoyalBluffState, text: string, color: string, dur = 1.9) {
  state.banner = text;
  state.bannerColor = color;
  state.bannerTimer = dur;
}

function loseInfluence(state: RoyalBluffState, victim: RoyalPlayerInternal, reason: string) {
  if (victim.hiddenRoles.length === 0) return;
  const lost = victim.hiddenRoles.pop()!;
  victim.revealedRoles.push(lost);
  victim.lastAction = `LOST ${lost}!`;
  victim.lastActionTimer = 2.8;
  const seat = seatOf(state, victim.id);
  state.shockwaves.push({ x: seat.x, y: seat.y, radius: 18, maxRadius: 210, colorHex: '#EF4444', alpha: 0.95 });
  state.popups.push({ x: seat.x, y: seat.y - 46, text: reason, colorHex: '#EF4444', alpha: 1.5 });
  state.pendingSounds.push({ type: 'ko', playerId: victim.id });
  state.pendingHaptics.push({ playerId: victim.id, pattern: [100, 35, 100], reason: 'hit' });
}

function checkWinner(state: RoyalBluffState): boolean {
  const alive = state.players.filter((p) => p.hiddenRoles.length > 0);
  if (state.players.length >= 2 && alive.length <= 1) {
    const champ = alive[0] ?? state.players[0];
    if (champ) {
      state.winnerId = champ.id;
      champ.score += 500;
      setBanner(state, `${champ.name} RULES THE COURT!`, champ.colorHex, 3.6);
      state.pendingSounds.push({ type: 'win', playerId: champ.id });
    }
    return true;
  }
  return false;
}

function advanceTurn(state: RoyalBluffState) {
  if (checkWinner(state)) return;
  const n = state.players.length;
  for (let s = 1; s <= n; s++) {
    const idx = (state.activePlayerIndex + s) % n;
    if (state.players[idx].hiddenRoles.length > 0) {
      state.activePlayerIndex = idx;
      break;
    }
  }
  state.phase = 'action';
  state.pendingClaim = null;
  state.turnTimeLeft = ACTION_TIME;
  state.turnTotal = ACTION_TIME;
  state.round += 1;
  state.botThinkTimer = 1.2 + Math.random() * 0.6;
}

function pickBestTarget(state: RoyalBluffState, actorId: string): RoyalPlayerInternal | null {
  const rivals = state.players
    .filter((p) => p.id !== actorId && p.hiddenRoles.length > 0)
    .sort((a, b) => b.hiddenRoles.length * 10 + b.coins - (a.hiddenRoles.length * 10 + a.coins));
  return rivals[0] ?? null;
}

function applyClaimEffect(state: RoyalBluffState, claim: PendingClaimInternal) {
  const actor = state.players.find((p) => p.id === claim.actorId);
  if (!actor || actor.hiddenRoles.length === 0) return;
  const target = claim.targetId ? state.players.find((p) => p.id === claim.targetId) : null;
  const seat = seatOf(state, actor.id);

  switch (claim.actionId) {
    case 'duke': {
      actor.coins += 3;
      actor.score += 80;
      actor.lastAction = 'DUKE +3 COINS';
      state.popups.push({ x: seat.x, y: seat.y - 44, text: '+3 TAX', colorHex: '#A855F7', alpha: 1.4 });
      break;
    }
    case 'captain': {
      if (target && target.hiddenRoles.length > 0) {
        const stolen = Math.min(2, target.coins);
        target.coins -= stolen;
        actor.coins += Math.max(1, stolen);
        actor.score += 95;
        actor.lastAction = `STOLE ${Math.max(1, stolen)}`;
        setBanner(state, `${actor.name} STOLE FROM ${target.name}!`, '#00C2FF', 1.7);
      }
      break;
    }
    case 'assassin': {
      if (target && target.hiddenRoles.length > 0) {
        if (target.hiddenRoles.includes('CONTESSA')) {
          target.lastAction = 'CONTESSA BLOCK!';
          target.score += 100;
          setBanner(state, `${target.name}'S CONTESSA BLOCKED THE HIT!`, '#F59E0B', 2.0);
        } else {
          loseInfluence(state, target, 'ASSASSINATED!');
          actor.score += 140;
          setBanner(state, `${actor.name} STRUCK ${target.name}!`, '#EF4444', 1.9);
        }
      }
      break;
    }
    case 'ambassador': {
      if (actor.hiddenRoles.length > 0 && state.deck.length > 0) {
        const old = actor.hiddenRoles.shift()!;
        const fresh = state.deck.pop()!;
        actor.hiddenRoles.push(fresh);
        state.deck.unshift(old);
        state.deck = shuffle(state.deck);
      }
      actor.coins += 1;
      actor.score += 70;
      actor.lastAction = 'SWAPPED +1';
      state.popups.push({ x: seat.x, y: seat.y - 44, text: 'SWAPPED +1', colorHex: '#10D98B', alpha: 1.4 });
      break;
    }
  }
  actor.lastActionTimer = 2.4;
}

function triggerAction(state: RoyalBluffState, actor: RoyalPlayerInternal, actionId: string) {
  if (state.winnerId || state.phase !== 'action') return;
  const active = state.players[state.activePlayerIndex];
  if (!active || active.id !== actor.id || actor.hiddenRoles.length === 0) return;

  // Mandatory Coup at 10+ coins
  const effectiveId = actor.coins >= 10 ? 'coup' : actionId;
  const target = pickBestTarget(state, actor.id);
  const seat = seatOf(state, actor.id);

  if (effectiveId === 'income') {
    actor.coins += 1;
    actor.score += 40;
    actor.lastAction = 'INCOME +1';
    actor.lastActionTimer = 2.2;
    state.popups.push({ x: seat.x, y: seat.y - 44, text: '+1 COIN', colorHex: '#F59E0B', alpha: 1.3 });
    state.pendingSounds.push({ type: 'card', playerId: actor.id });
    advanceTurn(state);
    return;
  }

  if (effectiveId === 'coup') {
    if (actor.coins < 7 || !target) {
      triggerAction(state, actor, 'income');
      return;
    }
    actor.coins -= 7;
    actor.score += 180;
    actor.lastAction = `COUP -> ${target.name}!`;
    actor.lastActionTimer = 2.6;
    loseInfluence(state, target, 'COUP!!');
    setBanner(state, `${actor.name} LAUNCHED A COUP ON ${target.name}!`, '#EF4444', 2.1);
    advanceTurn(state);
    return;
  }

  if (effectiveId === 'assassin' && actor.coins < 3) {
    triggerAction(state, actor, 'duke');
    return;
  }

  const claimMap: Record<string, { role: CourtRole; name: string }> = {
    duke: { role: 'DUKE', name: 'DUKE TAX (+3)' },
    captain: { role: 'CAPTAIN', name: 'CAPTAIN STEAL (2)' },
    assassin: { role: 'ASSASSIN', name: 'ASSASSIN STRIKE' },
    ambassador: { role: 'AMBASSADOR', name: 'AMBASSADOR SWAP' },
  };
  const spec = claimMap[effectiveId] ?? claimMap.duke;
  if (effectiveId === 'assassin') actor.coins -= 3;

  state.pendingClaim = {
    actorId: actor.id,
    actorName: actor.name,
    actionId: (effectiveId in claimMap ? effectiveId : 'duke') as PendingClaimInternal['actionId'],
    actionName: spec.name,
    claimedRole: spec.role,
    targetId: target?.id ?? null,
    targetName: target?.name ?? null,
    trustedBy: new Set([actor.id]),
  };
  state.phase = 'challenge';
  state.turnTimeLeft = CHALLENGE_TIME;
  state.turnTotal = CHALLENGE_TIME;
  state.botThinkTimer = 1.2 + Math.random() * 0.8;
  setBanner(state, `${actor.name} CLAIMS ${spec.role}! CHALLENGE?`, ROLE_META[spec.role].accentHex, 3.6);
  state.pendingSounds.push({ type: 'card', playerId: actor.id });
}

function resolveChallenge(state: RoyalBluffState, challenger: RoyalPlayerInternal) {
  if (state.phase !== 'challenge' || !state.pendingClaim) return;
  const claim = state.pendingClaim;
  if (challenger.id === claim.actorId || challenger.hiddenRoles.length === 0) return;

  const actor = state.players.find((p) => p.id === claim.actorId);
  if (!actor) return;

  const roleIdx = actor.hiddenRoles.indexOf(claim.claimedRole);
  if (roleIdx >= 0) {
    // Truthful! Challenger loses influence, actor swaps role & resolves action
    loseInfluence(state, challenger, 'WRONG CALL!');
    actor.score += 130;
    if (state.deck.length > 0) {
      const shown = actor.hiddenRoles.splice(roleIdx, 1)[0];
      actor.hiddenRoles.push(state.deck.pop()!);
      state.deck.unshift(shown);
      state.deck = shuffle(state.deck);
    }
    setBanner(state, `TRUTH! ${actor.name} HAD ${claim.claimedRole}!`, '#10D98B', 2.2);
    applyClaimEffect(state, claim);
  } else {
    // Caught bluffing! Actor loses influence, action cancelled
    loseInfluence(state, actor, 'BLUFF CAUGHT!');
    challenger.score += 150;
    setBanner(state, `BLUFF CAUGHT BY ${challenger.name}!`, '#EF4444', 2.2);
  }

  state.phase = 'resolve';
  state.resolveTimer = 1.5;
  state.pendingClaim = null;
}

function buildPrivateState(state: RoyalBluffState, p: RoyalPlayerInternal): CardPrivateState {
  const active = state.players[state.activePlayerIndex];
  const alive = p.hiddenRoles.length > 0;
  const isMyActionTurn = Boolean(state.phase === 'action' && active?.id === p.id && alive && !state.winnerId);
  const canChallenge = Boolean(
    state.phase === 'challenge' &&
      state.pendingClaim &&
      state.pendingClaim.actorId !== p.id &&
      alive &&
      !state.winnerId
  );

  const extraActions: CardActionButton[] = isMyActionTurn
    ? [
        {
          label: 'INCOME (+1)',
          labelZh: '收入 (+1币)',
          action: { type: 'custom', id: 'income' },
          colorHex: '#64748B',
        },
        {
          label: 'DUKE (+3)',
          labelZh: '公爵征税 (+3)',
          action: { type: 'custom', id: 'duke' },
          colorHex: '#A855F7',
        },
        {
          label: 'CAPTAIN (STEAL)',
          labelZh: '队长偷2币',
          action: { type: 'custom', id: 'captain' },
          colorHex: '#00C2FF',
        },
        {
          label: p.coins >= 7 ? 'COUP (7🪙 KO!)' : 'ASSASSIN (3🪙)',
          labelZh: p.coins >= 7 ? '政变 (7币必杀)' : '刺客 (3币)',
          action: { type: 'custom', id: p.coins >= 7 ? 'coup' : 'assassin' },
          colorHex: '#EF4444',
          disabled: p.coins < 3,
        },
      ]
    : [];

  return {
    gameId: 'royal-bluff',
    playerId: p.id,
    hand: p.hiddenRoles.map((r, idx) => ({
      id: `rb_${idx}_${r}`,
      kind: 'party',
      title: r,
      subtitle: ROLE_META[r].subtitle,
      badge: ROLE_META[r].badge,
      accentHex: ROLE_META[r].accentHex,
      secondaryHex: ROLE_META[r].secondaryHex,
      playable: false,
      selected: false,
    })),
    cursorIndex: 0,
    isMyTurn: isMyActionTurn,
    isActionRequired: isMyActionTurn || canChallenge,
    turnTimeLeft: state.turnTimeLeft,
    turnTotal: state.turnTotal,
    badgeText: `COINS: ${p.coins} · INFLUENCE: ${p.hiddenRoles.length}/2`,
    badgeColorHex: '#FFB800',
    primaryBtn: canChallenge
      ? {
          label: 'CALL BLUFF!',
          labelZh: '质疑说谎！',
          action: { type: 'call-bluff' },
          colorHex: '#EF4444',
        }
      : undefined,
    secondaryBtn: canChallenge
      ? {
          label: 'ALLOW CLAIM',
          labelZh: '放行信任',
          action: { type: 'trust-claim' },
          colorHex: '#10D98B',
        }
      : undefined,
    extraActions,
    statusHint: !alive
      ? 'Exiled from court! Watch the intrigue.'
      : canChallenge
        ? `${state.pendingClaim?.actorName} claims ${state.pendingClaim?.claimedRole}! Call Bluff?`
        : isMyActionTurn
          ? 'Your turn! Claim any role (bluffing allowed!) or take Income.'
          : `${active?.name ?? 'Noble'} is plotting...`,
    statusHintZh: !alive
      ? '已出局！观看宫廷博弈'
      : canChallenge
        ? `${state.pendingClaim?.actorName} 声称拥有 ${state.pendingClaim?.claimedRole}！质疑吗？`
        : isMyActionTurn
          ? '轮到你！可声称任意角色（允许吹牛！）或拿1币'
          : `等待 ${active?.name ?? '贵族'} 行动...`,
  };
}

export const royalBluffModule: ServerGameModule<RoyalBluffState> = {
  id: 'royal-bluff',

  createState(players) {
    const sorted = [...players].sort((a, b) => a.slotIndex - b.slotIndex);
    const deck = buildCourtDeck();

    const internalPlayers: RoyalPlayerInternal[] = sorted.map((p) => ({
      id: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      colorHex: p.color.hex,
      isBot: p.isBot,
      coins: 2,
      hiddenRoles: [deck.pop() ?? 'DUKE', deck.pop() ?? 'CAPTAIN'],
      revealedRoles: [],
      score: 0,
      lastAction: null,
      lastActionTimer: 0,
    }));

    return {
      round: 1,
      deck,
      activePlayerIndex: 0,
      phase: 'action',
      turnTimeLeft: ACTION_TIME,
      turnTotal: ACTION_TIME,
      botThinkTimer: 1.4,
      resolveTimer: 0,
      pendingClaim: null,
      banner: 'BLUFF ROLES · CATCH LIARS · RULE THE COURT!',
      bannerColor: '#A855F7',
      bannerTimer: 2.3,
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
    if (!p || p.hiddenRoles.length === 0 || state.winnerId) return;

    if (state.phase === 'action' && action.type === 'custom') {
      triggerAction(state, p, action.id);
    } else if (state.phase === 'challenge' && state.pendingClaim) {
      if (action.type === 'call-bluff') {
        resolveChallenge(state, p);
      } else if (action.type === 'trust-claim') {
        state.pendingClaim.trustedBy.add(p.id);
        const aliveOthers = state.players.filter((pl) => pl.hiddenRoles.length > 0 && pl.id !== state.pendingClaim!.actorId);
        if (aliveOthers.every((pl) => state.pendingClaim!.trustedBy.has(pl.id))) {
          applyClaimEffect(state, state.pendingClaim);
          state.phase = 'resolve';
          state.resolveTimer = 1.0;
          state.pendingClaim = null;
        }
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

    if (state.phase === 'resolve') {
      state.resolveTimer -= dt;
      if (state.resolveTimer <= 0) advanceTurn(state);
    } else if (state.phase === 'challenge' && state.pendingClaim) {
      state.turnTimeLeft -= dt;
      // Check human joystick/button inputs for challenge
      for (const inp of inputPlayers) {
        if (inp.id === state.pendingClaim.actorId) continue;
        const pl = state.players.find((x) => x.id === inp.id && x.hiddenRoles.length > 0);
        if (!pl) continue;
        if (inp.input.a && !inp.prevA) {
          resolveChallenge(state, pl);
          break;
        }
      }
      if (state.phase === 'challenge' && state.pendingClaim) {
        state.botThinkTimer -= dt;
        if (state.botThinkTimer <= 0) {
          const botChallengers = state.players.filter(
            (p) => p.isBot && p.hiddenRoles.length > 0 && p.id !== state.pendingClaim!.actorId
          );
          if (botChallengers.length > 0 && Math.random() < 0.34) {
            resolveChallenge(state, botChallengers[Math.floor(Math.random() * botChallengers.length)]);
          } else {
            state.botThinkTimer = 99;
          }
        }
      }
      if (state.phase === 'challenge' && state.pendingClaim && state.turnTimeLeft <= 0) {
        applyClaimEffect(state, state.pendingClaim);
        state.phase = 'resolve';
        state.resolveTimer = 1.0;
        state.pendingClaim = null;
      }
    } else {
      const active = state.players[state.activePlayerIndex];
      if (active && active.hiddenRoles.length > 0) {
        state.turnTimeLeft -= dt;
        if (active.isBot) {
          state.botThinkTimer -= dt;
          if (state.botThinkTimer <= 0) {
            if (active.coins >= 7) {
              triggerAction(state, active, 'coup');
            } else if (active.coins >= 3 && (active.hiddenRoles.includes('ASSASSIN') || Math.random() < 0.28)) {
              triggerAction(state, active, 'assassin');
            } else if (active.hiddenRoles.includes('DUKE') || Math.random() < 0.42) {
              triggerAction(state, active, 'duke');
            } else if (active.hiddenRoles.includes('CAPTAIN') || Math.random() < 0.35) {
              triggerAction(state, active, 'captain');
            } else {
              triggerAction(state, active, 'income');
            }
          }
        } else {
          const inp = inputPlayers.find((ip) => ip.id === active.id);
          if (inp) {
            if (inp.input.a && !inp.prevA) {
              triggerAction(state, active, active.coins >= 7 ? 'coup' : 'duke');
            } else if (inp.input.b && !inp.prevB) {
              triggerAction(state, active, 'income');
            }
          }
        }
        if (state.phase === 'action' && !state.winnerId && state.turnTimeLeft <= 0) {
          triggerAction(state, active, 'income');
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

  getSnapshot(state): RoyalBluffSnapshot {
    return {
      gameId: 'royal-bluff',
      round: state.round,
      activePlayerId: state.players[state.activePlayerIndex]?.id ?? '',
      phase: state.phase,
      turnTimeLeft: Math.max(0, state.turnTimeLeft),
      turnTotal: state.turnTotal,
      pendingClaim: state.pendingClaim
        ? {
            actorId: state.pendingClaim.actorId,
            actorName: state.pendingClaim.actorName,
            actionName: state.pendingClaim.actionName,
            claimedRole: state.pendingClaim.claimedRole,
            targetName: state.pendingClaim.targetName,
          }
        : null,
      banner: state.banner,
      bannerColor: state.bannerColor,
      shockwaves: [...state.shockwaves],
      popups: [...state.popups],
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: p.isBot,
        alive: p.hiddenRoles.length > 0,
        coins: p.coins,
        influenceLeft: p.hiddenRoles.length,
        revealedRoles: [...p.revealedRoles],
        score: p.score,
        lastAction: p.lastAction,
      })),
    };
  },

  getRankings(state): RankingEntry[] {
    const sorted = [...state.players].sort((a, b) => {
      if (b.hiddenRoles.length !== a.hiddenRoles.length) return b.hiddenRoles.length - a.hiddenRoles.length;
      if (b.score !== a.score) return b.score - a.score;
      return b.coins - a.coins;
    });
    return sorted.map((p, idx) => ({
      playerId: p.id,
      slotIndex: p.slotIndex,
      name: p.name,
      color: { id: `p${p.slotIndex}`, name: p.name, hex: p.colorHex, dark: p.colorHex, textOnColor: '#FFFFFF' },
      rank: idx + 1,
      score: p.score,
      highlight: p.hiddenRoles.length > 0 ? `${p.hiddenRoles.length} Roles · ${p.coins} Coins` : `Exiled · ${p.score} pts`,
    }));
  },
};

function buildHudUpdates(state: RoyalBluffState): Record<string, PlayerHudUpdate> {
  const activeId = state.players[state.activePlayerIndex]?.id;
  const out: Record<string, PlayerHudUpdate> = {};
  for (const p of state.players) {
    out[p.id] = {
      score: p.score,
      alive: p.hiddenRoles.length > 0,
      statText: `${p.coins} coins · ${p.hiddenRoles.length} roles`,
      cooldownA: p.id === activeId ? 0 : 0.6,
      cooldownB: p.id === activeId ? 0 : 0.6,
    };
  }
  return out;
}
