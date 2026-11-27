import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeftRight,
  Check,
  Eye,
  EyeOff,
  Flame,
  Hand,
  Layers,
  LayoutGrid,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { CardClientAction, CardColor, CardPrivateHandItem, CardPrivateState } from '../shared/types';
import type { CardSortMode, CardViewMode } from '../shared/padProfiles';
import { useLanguage, translateGameText } from '../lib/i18n';
import { PlayerAvatar } from './PlayerAvatar';

export interface PocketCardSituationPlayer {
  id: string;
  name: string;
  avatarId?: string;
  colorHex: string;
  stat: string;
  cardCount?: number | null;
  lastAction?: string | null;
  statusTag?: string | null;
  statusTone?: 'danger' | 'warn' | 'good' | 'neutral';
  isActive: boolean;
  isMe: boolean;
  alive?: boolean;
}

export interface PocketCenterPileCard {
  kind: 'clash' | 'bluff' | 'party';
  colorKey?: 'red' | 'blue' | 'gold' | 'green' | 'wild';
  activeColorKey?: 'red' | 'blue' | 'gold' | 'green' | 'wild';
  mainText: string;
  subText?: string;
  badgeText?: string;
  accentHex?: string;
  pileCount?: number;
}

export interface PocketCardSituation {
  gameId?: string;
  activePlayerId?: string;
  activePlayerName?: string;
  activePlayerColor?: string;
  direction?: 1 | -1;
  deckCount?: number | null;
  activeColorKey?: 'red' | 'blue' | 'gold' | 'green' | 'wild' | null;
  centerPileCard?: PocketCenterPileCard | null;
  canDrawDeck?: boolean;
  tableBadge?: { text: string; bg: string; fg: string } | null;
  tableSummary?: string;
  lastMoveText?: string | null;
  banner?: string | null;
  players: PocketCardSituationPlayer[];
}

interface CardControllerDeckProps {
  cardState: CardPrivateState | null;
  playerColorHex: string;
  embedded?: boolean;
  pocketOverlay?: boolean;
  hudOpacity?: number;
  isCountdown?: boolean;
  countdownValue?: number;
  viewMode?: CardViewMode;
  recommendedView?: 'fan' | 'grid';
  sortMode?: CardSortMode;
  privacyShield?: boolean;
  actionsSide?: 'right' | 'left';
  situation?: PocketCardSituation | null;
  pocketTableSlot?: ReactNode;
  handCollapsed?: boolean;
  coachTip?: string | null;
  onDismissCoach?: () => void;
  onToggleHandCollapsed?: () => void;
  onChangeViewMode?: (next: 'fan' | 'grid') => void;
  onCycleSortMode?: () => void;
  onTogglePrivacy?: () => void;
  onFlipActionsSide?: () => void;
  onAction: (action: CardClientAction) => void;
}

const CLASH_STYLE: Record<
  CardColor,
  {
    bg: string;
    dark: string;
    text: string;
    ring: string;
    glow: string;
    feltGradient: string;
    nameEn: string;
    nameZh: string;
  }
> = {
  red: {
    bg: '#FF4D2E',
    dark: '#B82E17',
    text: '#FFFFFF',
    ring: '#FF6B52',
    glow: 'rgba(255, 77, 46, 0.36)',
    feltGradient: 'radial-gradient(ellipse at 50% 44%, rgba(185, 38, 22, 0.42) 0%, rgba(15, 20, 32, 0.94) 68%, #090C12 100%)',
    nameEn: 'RED',
    nameZh: '红',
  },
  blue: {
    bg: '#00C2FF',
    dark: '#007FA8',
    text: '#0B1219',
    ring: '#38D4FF',
    glow: 'rgba(0, 194, 255, 0.36)',
    feltGradient: 'radial-gradient(ellipse at 50% 44%, rgba(0, 132, 194, 0.42) 0%, rgba(14, 21, 35, 0.94) 68%, #090C12 100%)',
    nameEn: 'BLUE',
    nameZh: '蓝',
  },
  gold: {
    bg: '#FFB800',
    dark: '#B58100',
    text: '#14120B',
    ring: '#FFD166',
    glow: 'rgba(255, 184, 0, 0.34)',
    feltGradient: 'radial-gradient(ellipse at 50% 44%, rgba(180, 120, 0, 0.38) 0%, rgba(17, 20, 30, 0.94) 68%, #090C12 100%)',
    nameEn: 'GOLD',
    nameZh: '黄',
  },
  green: {
    bg: '#10D98B',
    dark: '#0A915D',
    text: '#0A1913',
    ring: '#34E89E',
    glow: 'rgba(16, 217, 139, 0.35)',
    feltGradient: 'radial-gradient(ellipse at 50% 44%, rgba(13, 148, 94, 0.42) 0%, rgba(13, 22, 30, 0.94) 68%, #090C12 100%)',
    nameEn: 'GREEN',
    nameZh: '绿',
  },
  wild: {
    bg: '#7C3AED',
    dark: '#4C1D95',
    text: '#FFFFFF',
    ring: '#A78BFA',
    glow: 'rgba(124, 58, 237, 0.38)',
    feltGradient: 'radial-gradient(ellipse at 50% 44%, rgba(109, 40, 217, 0.42) 0%, rgba(15, 19, 32, 0.94) 68%, #090C12 100%)',
    nameEn: 'WILD',
    nameZh: '万能',
  },
};

const DEFAULT_TABLE_FELT =
  'radial-gradient(ellipse at 50% 44%, rgba(16, 124, 92, 0.34) 0%, rgba(13, 21, 33, 0.94) 68%, #080B11 100%)';

const RANK_SORT_ORDER: Record<string, number> = {
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
  '2': 15,
  JOKER: 16,
};

function cardSortWeight(card: CardPrivateHandItem): number {
  if (card.rank && RANK_SORT_ORDER[card.rank] !== undefined) {
    return RANK_SORT_ORDER[card.rank] * 10 + (card.suit ? card.suit.charCodeAt(0) % 7 : 0);
  }
  if (card.value) {
    const n = Number(card.value);
    if (!Number.isNaN(n)) return n * 10;
    return card.value.charCodeAt(0) * 10;
  }
  return (card.title ?? card.badge ?? card.id).charCodeAt(0) * 10;
}

function suitSymbol(suit?: CardPrivateHandItem['suit']): string {
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
    default:
      return '';
  }
}

export function CardControllerDeck({
  cardState,
  playerColorHex,
  embedded = false,
  pocketOverlay = false,
  hudOpacity = 0.78,
  isCountdown = false,
  countdownValue = 0,
  viewMode = 'auto',
  recommendedView = 'fan',
  sortMode = 'server',
  privacyShield = false,
  actionsSide = 'right',
  situation = null,
  pocketTableSlot = null,
  handCollapsed = false,
  coachTip = null,
  onDismissCoach,
  onToggleHandCollapsed,
  onChangeViewMode,
  onCycleSortMode,
  onTogglePrivacy,
  onFlipActionsSide,
  onAction,
}: CardControllerDeckProps) {
  const { lang, t } = useLanguage();
  const seenCardIdsRef = useRef<Set<string>>(new Set());
  const [freshCardOrder, setFreshCardOrder] = useState<Record<string, number>>({});
  const [throwingCardId, setThrowingCardId] = useState<string | null>(null);
  const [peeking, setPeeking] = useState(false);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragDeltaY, setDragDeltaY] = useState<number>(0);
  const dragStartRef = useRef<{ cardId: string; startY: number; playable: boolean } | null>(null);
  const throwTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cardState) {
      seenCardIdsRef.current.clear();
      setFreshCardOrder({});
      setThrowingCardId(null);
      return;
    }

    const newlyArrived: Record<string, number> = {};
    let order = 0;
    const currentIds = new Set<string>();
    for (const c of cardState.hand) {
      currentIds.add(c.id);
      if (!seenCardIdsRef.current.has(c.id)) {
        newlyArrived[c.id] = order++;
        seenCardIdsRef.current.add(c.id);
      }
    }
    for (const id of Array.from(seenCardIdsRef.current)) {
      if (!currentIds.has(id)) seenCardIdsRef.current.delete(id);
    }

    if (order > 0) {
      setFreshCardOrder((prev) => ({ ...prev, ...newlyArrived }));
      const clearTimer = setTimeout(() => {
        setFreshCardOrder((prev) => {
          const next = { ...prev };
          for (const k of Object.keys(newlyArrived)) delete next[k];
          return next;
        });
      }, 520);
      return () => clearTimeout(clearTimer);
    }
  }, [cardState]);

  useEffect(() => {
    return () => {
      if (throwTimerRef.current) clearTimeout(throwTimerRef.current);
    };
  }, []);

  const triggerPlayWithThrowAnim = (cardId: string) => {
    setThrowingCardId(cardId);
    if (throwTimerRef.current) clearTimeout(throwTimerRef.current);
    throwTimerRef.current = setTimeout(() => setThrowingCardId(null), 180);
    onAction({ type: 'play-card', cardId });
  };

  useEffect(() => {
    if (!privacyShield) setPeeking(false);
  }, [privacyShield]);

  const handList = cardState?.hand ?? [];
  const sortedEntries = useMemo(() => {
    const base = handList.map((card, originalIndex) => ({ card, originalIndex }));
    if (sortMode === 'server') return base;
    if (sortMode === 'playable') {
      return [...base].sort((a, b) => {
        if (a.card.playable !== b.card.playable) return a.card.playable ? -1 : 1;
        return cardSortWeight(a.card) - cardSortWeight(b.card);
      });
    }
    return [...base].sort((a, b) => cardSortWeight(a.card) - cardSortWeight(b.card));
  }, [handList, sortMode]);

  if (!cardState) {
    if (pocketOverlay) {
      return (
        <div className="flex-1 flex flex-col justify-end min-h-0 relative z-10 pointer-events-none gap-1 pb-0.5">
          <div className="pointer-events-auto flex items-center justify-center gap-3 rounded-xl bg-[#0D1017]/90 backdrop-blur-sm border border-white/15 px-4 py-2 text-left shrink-0">
            <Sparkles className="w-4 h-4 text-[#FFB800] animate-pulse shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-xs sm:text-sm font-bold text-white truncate">
                {isCountdown
                  ? t(`Dealing secret cards in ${countdownValue}...`, `${countdownValue} 秒后秘密发牌...`)
                  : t('Shuffling your private hand...', '正在为你秘密发牌...')}
              </p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="flex-1 flex flex-col items-center justify-center rounded-2xl bg-[#161922] border border-[#2A303D] p-4 text-center">
        <Sparkles className="w-7 h-7 text-[#FFB800] animate-pulse" />
        <p className="mt-2 font-display text-base font-bold text-white">
          {isCountdown
            ? t(`Dealing secret cards in ${countdownValue}...`, `${countdownValue} 秒后秘密发牌...`)
            : t('Shuffling your private hand...', '正在为你秘密发牌...')}
        </p>
        <p className="mt-1 text-xs text-[#9CA3AF]">
          {t('Only your screen can see your cards!', '你的手牌仅显示在你自己的手机上！')}
        </p>
      </div>
    );
  }

  const isDanger =
    cardState.isActionRequired && cardState.turnTimeLeft > 0 && cardState.turnTimeLeft <= 5.0;
  const timeSecs = Math.max(0, Math.ceil(cardState.turnTimeLeft));
  const turnProgressPct =
    cardState.turnTotal > 0
      ? Math.max(0, Math.min(100, (cardState.turnTimeLeft / cardState.turnTotal) * 100))
      : 100;
  const isColorClash =
    cardState.gameId === 'color-clash' || cardState.gameId === 'dark-flip-clash';
  const isLiarsDeck = cardState.gameId === 'liars-deck';
  const activeColorKey = cardState.activeColor ?? situation?.activeColorKey ?? null;
  const activeColorSpec = activeColorKey ? CLASH_STYLE[activeColorKey] : null;
  const highlightedCard = cardState.hand[cardState.cursorIndex];
  const selectedLiarCount = cardState.hand.filter((c) => c.selected).length;

  const effectiveView: 'fan' | 'grid' = pocketOverlay
    ? viewMode === 'grid'
      ? 'grid'
      : 'fan'
    : viewMode === 'auto'
    ? recommendedView
    : viewMode;
  const isMaskActive = privacyShield && !peeking;
  const handMid = (sortedEntries.length - 1) / 2;

  // Dynamic UNO-style curved fan overlap calculation for Pocket Mode
  const getPocketFanMetrics = (count: number) => {
    if (count >= 14) return { marginCls: '-ml-7 sm:-ml-5', maxDeg: 18, arcDrop: 12 };
    if (count >= 11) return { marginCls: '-ml-6 sm:-ml-4', maxDeg: 16, arcDrop: 10 };
    if (count >= 8) return { marginCls: '-ml-4 sm:-ml-3', maxDeg: 14, arcDrop: 8 };
    if (count >= 5) return { marginCls: '-ml-2.5 sm:-ml-1.5', maxDeg: 11, arcDrop: 6 };
    return { marginCls: '-ml-1 sm:ml-0', maxDeg: 7, arcDrop: 4 };
  };

  const fanMetrics = getPocketFanMetrics(sortedEntries.length);

  // Flick-up gesture handlers for UNO-style swipe-to-play
  const handleCardPointerDown = (
    e: React.PointerEvent,
    card: CardPrivateHandItem,
    canTapPlay: boolean
  ) => {
    if (!pocketOverlay || effectiveView === 'grid') return;
    dragStartRef.current = {
      cardId: card.id,
      startY: e.clientY,
      playable: canTapPlay,
    };
    setDraggedCardId(card.id);
    setDragDeltaY(0);
  };

  const handleCardPointerMove = (e: React.PointerEvent, cardId: string) => {
    if (!dragStartRef.current || dragStartRef.current.cardId !== cardId) return;
    const dy = Math.min(12, Math.max(-75, e.clientY - dragStartRef.current.startY));
    setDragDeltaY(dy);
  };

  const handleCardPointerEnd = (card: CardPrivateHandItem, canTapPlay: boolean) => {
    if (dragStartRef.current && dragStartRef.current.cardId === card.id) {
      const flickedUp = dragDeltaY <= -36;
      dragStartRef.current = null;
      setDraggedCardId(null);
      setDragDeltaY(0);
      if (flickedUp && canTapPlay) {
        triggerPlayWithThrowAnim(card.id);
        return true;
      }
    }
    return false;
  };

  // =========================================================================
  // RENDER HAND CARDS (UNO Curved Fan with Playable Elevation or Grid)
  // =========================================================================
  const renderHandCards = () => {
    if (sortedEntries.length === 0) {
      const hintText =
        lang === 'zh'
          ? translateGameText(cardState.statusHintZh || cardState.statusHint, lang)
          : cardState.statusHint;
      return (
        <div className="col-span-full w-full text-center px-3 py-3 self-center">
          <div className="text-xs sm:text-sm font-bold text-[#E2E8F0]">
            {hintText || t('Waiting on table round...', '等待本轮牌局结果...')}
          </div>
        </div>
      );
    }

    return sortedEntries.map(({ card, originalIndex }, idx) => {
      const normalizedOffset =
        sortedEntries.length > 1 ? (idx - handMid) / Math.max(1, handMid) : 0; // -1 .. +1
      const fanRot =
        effectiveView === 'grid'
          ? 0
          : pocketOverlay
          ? normalizedOffset * fanMetrics.maxDeg
          : (idx - handMid) * 1.65;
      const fanDrop =
        effectiveView === 'grid'
          ? 0
          : pocketOverlay
          ? Math.pow(Math.abs(normalizedOffset), 1.55) * fanMetrics.arcDrop
          : Math.min(8, Math.abs(idx - handMid) * 1.4);

      const freshOrder = freshCardOrder[card.id];
      const isThrowing = throwingCardId === card.id;
      const isDraggingThis = draggedCardId === card.id;
      const dragOffset = isDraggingThis ? dragDeltaY : 0;
      const overlapCls =
        pocketOverlay && effectiveView === 'fan' && idx > 0 ? fanMetrics.marginCls : '';

      // 1. UNO / Color Clash Cards
      if (card.kind === 'clash') {
        const colKey: CardColor = card.color ?? 'red';
        const spec = CLASH_STYLE[colKey];
        const isHighlighted = originalIndex === cardState.cursorIndex;
        const canTapPlay = cardState.isMyTurn && card.playable;
        const isDimmedUnplayable = cardState.isMyTurn && !card.playable;
        const val = card.value ?? '?';

        // UNO Mobile Elevation: Playable cards step up (-12px), selected/cursor steps up (-18px), unplayable sits lower (+4px)
        const baseLift = isThrowing
          ? -44
          : canTapPlay
          ? isHighlighted
            ? -18
            : -12
          : isDimmedUnplayable
          ? 5
          : isHighlighted
          ? -6
          : 0;

        const restTransform = isThrowing
          ? 'translate3d(0, -48px, 0) scale(0.84) rotate(6deg)'
          : `translate3d(0, ${fanDrop + baseLift + dragOffset}px, 0) scale(${
              canTapPlay && isHighlighted ? 1.08 : canTapPlay ? 1.04 : isDimmedUnplayable ? 0.96 : 1
            }) rotate(${canTapPlay && isHighlighted ? fanRot * 0.35 : fanRot}deg)`;

        const displayVal = lang === 'zh' ? translateGameText(val, lang) : val;
        const isZhTranslated = lang === 'zh' && displayVal !== val;

        return (
          <div
            key={card.id}
            className={`shrink-0 transition-transform duration-150 ${overlapCls} ${
              isHighlighted
                ? 'relative z-30'
                : canTapPlay
                ? 'relative z-20'
                : 'relative z-10'
            } ${freshOrder !== undefined ? 'card-deal-anim' : ''}`}
            style={
              freshOrder !== undefined
                ? { animationDelay: `${Math.min(280, freshOrder * 45)}ms` }
                : undefined
            }
          >
            <button
              type="button"
              onPointerDown={(e) => handleCardPointerDown(e, card, canTapPlay)}
              onPointerMove={(e) => handleCardPointerMove(e, card.id)}
              onPointerUp={() => {
                const handled = handleCardPointerEnd(card, canTapPlay);
                if (!handled) {
                  if (canTapPlay) {
                    triggerPlayWithThrowAnim(card.id);
                  } else {
                    onAction({ type: 'select-index', index: originalIndex });
                  }
                }
              }}
              onPointerCancel={() => {
                dragStartRef.current = null;
                setDraggedCardId(null);
                setDragDeltaY(0);
              }}
              className={`card-hand-item relative rounded-2xl flex flex-col items-center justify-between p-1.5 select-none cursor-pointer touch-pan-x ${
                embedded
                  ? 'w-14 h-20'
                  : pocketOverlay
                  ? 'w-[62px] h-[90px] sm:w-[74px] sm:h-[106px]'
                  : 'w-[68px] h-[98px] sm:w-[76px] sm:h-[110px]'
              } ${
                canTapPlay
                  ? 'ring-[2.5px] ring-white shadow-[0_10px_22px_rgba(0,0,0,0.55),0_0_16px_rgba(255,255,255,0.35)] hover:brightness-110 active:scale-95'
                  : isHighlighted
                  ? 'ring-2 ring-white/80 opacity-95'
                  : isDimmedUnplayable
                  ? 'opacity-55 brightness-75 border border-black/40'
                  : 'opacity-90 border border-white/25'
              }`}
              style={{
                transform: restTransform,
                opacity: isThrowing ? 0.15 : undefined,
                background:
                  colKey === 'wild'
                    ? 'linear-gradient(135deg, #FF4D2E 0%, #FFB800 35%, #10D98B 70%, #00C2FF 100%)'
                    : spec.bg,
                color: colKey === 'wild' ? '#FFFFFF' : spec.text,
                boxShadow: `0 5px 0 ${spec.dark}, -3px 0 10px rgba(0,0,0,0.45)`,
              }}
            >
              {/* Classic UNO Inner Oval Emblem */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-1.5 rounded-full border border-white/30 bg-white/12 -rotate-[22deg]"
              />
              <span className="relative z-10 self-start font-mono text-[11px] sm:text-xs font-black leading-none drop-shadow">
                {displayVal}
              </span>
              <span
                className={`relative z-10 font-display font-black leading-none drop-shadow text-center ${
                  isZhTranslated
                    ? displayVal.length >= 4
                      ? 'text-xs sm:text-sm'
                      : 'text-sm sm:text-base'
                    : val.length >= 6
                    ? 'text-[11px] sm:text-xs'
                    : val.length >= 4
                    ? 'text-xs sm:text-sm'
                    : val.length >= 2
                    ? 'text-xl sm:text-2xl'
                    : 'text-2xl sm:text-3xl'
                }`}
              >
                {displayVal}
              </span>
              <span className="relative z-10 self-end font-mono text-[10px] sm:text-[11px] font-black leading-none drop-shadow rotate-180">
                {displayVal}
              </span>
            </button>
          </div>
        );
      }

      // 2. Party / Tactical Action Cards (Boom Kittens, Property Deal, Royal Bluff, Sushi Draft, etc.)
      if (card.kind === 'party') {
        const accent = card.accentHex ?? '#FFB800';
        const dark = card.secondaryHex ?? '#0F172A';
        const isHighlighted = originalIndex === cardState.cursorIndex;
        const canTapPlay = cardState.isMyTurn && card.playable;
        const isDimmedUnplayable = cardState.isMyTurn && !card.playable;
        const baseLift = isThrowing
          ? -44
          : canTapPlay
          ? isHighlighted
            ? -16
            : -10
          : isDimmedUnplayable
          ? 4
          : isHighlighted
          ? -6
          : 0;

        const partyTransform = isThrowing
          ? 'translate3d(0, -44px, 0) scale(0.86) rotate(4deg)'
          : `translate3d(0, ${fanDrop + baseLift + dragOffset}px, 0) scale(${
              canTapPlay && isHighlighted ? 1.06 : canTapPlay ? 1.03 : 1
            }) rotate(${canTapPlay && isHighlighted ? fanRot * 0.35 : fanRot}deg)`;

        return (
          <div
            key={card.id}
            className={`shrink-0 transition-transform duration-150 ${overlapCls} ${
              isHighlighted
                ? 'relative z-30'
                : canTapPlay
                ? 'relative z-20'
                : 'relative z-10'
            } ${freshOrder !== undefined ? 'card-deal-anim' : ''}`}
            style={
              freshOrder !== undefined
                ? { animationDelay: `${Math.min(280, freshOrder * 45)}ms` }
                : undefined
            }
          >
            <button
              type="button"
              onPointerDown={(e) => handleCardPointerDown(e, card, canTapPlay)}
              onPointerMove={(e) => handleCardPointerMove(e, card.id)}
              onPointerUp={() => {
                const handled = handleCardPointerEnd(card, canTapPlay);
                if (!handled) {
                  if (canTapPlay) {
                    triggerPlayWithThrowAnim(card.id);
                  } else {
                    onAction({ type: 'select-index', index: originalIndex });
                  }
                }
              }}
              onPointerCancel={() => {
                dragStartRef.current = null;
                setDraggedCardId(null);
                setDragDeltaY(0);
              }}
              className={`card-hand-item relative rounded-2xl flex flex-col items-center justify-between p-1.5 text-center select-none cursor-pointer touch-pan-x ${
                embedded
                  ? 'w-16 h-22'
                  : pocketOverlay
                  ? 'w-[70px] h-[90px] sm:w-[82px] sm:h-[106px]'
                  : 'w-[76px] h-[104px] sm:w-[86px] sm:h-[116px]'
              } ${
                canTapPlay
                  ? 'ring-[2.5px] ring-white shadow-[0_10px_20px_rgba(0,0,0,0.5),0_0_15px_rgba(255,255,255,0.3)] hover:brightness-110 active:scale-95'
                  : isHighlighted
                  ? 'ring-2 ring-white/70 opacity-95'
                  : isDimmedUnplayable
                  ? 'opacity-55 brightness-75'
                  : 'opacity-90 border border-white/20'
              }`}
              style={{
                transform: partyTransform,
                opacity: isThrowing ? 0.15 : undefined,
                background: `linear-gradient(155deg, ${accent} 0%, ${dark} 100%)`,
                color: '#FFFFFF',
                boxShadow: '0 5px 0 rgba(0,0,0,0.55), -3px 0 8px rgba(0,0,0,0.4)',
              }}
            >
              <span className="self-start px-1.5 py-0.5 rounded bg-black/55 font-mono text-[9px] font-black leading-none max-w-full truncate">
                {translateGameText(card.badge ?? 'CARD', lang)}
              </span>
              <span className="font-display font-black text-[11px] sm:text-xs leading-tight drop-shadow px-0.5 line-clamp-2">
                {translateGameText(card.title ?? '', lang)}
              </span>
              <span className="font-sans text-[9px] font-bold text-white/90 leading-tight line-clamp-2">
                {translateGameText(card.subtitle ?? '', lang)}
              </span>
            </button>
          </div>
        );
      }

      // 3. Standard Playing Card (Liar's Deck, Big Two, Landlord Clash, Poker, Rummy, Blackjack, etc.)
      const sym = suitSymbol(card.suit);
      const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
      const isJoker = card.rank === 'JOKER';
      const isSelected = card.selected;
      const isCursor = originalIndex === cardState.cursorIndex;
      const baseLift = isSelected ? -18 : isCursor ? -8 : cardState.isMyTurn && card.playable ? -5 : 0;

      const liarTransform = `translate3d(0, ${fanDrop + baseLift + dragOffset}px, 0) scale(${
        isSelected ? 1.07 : isCursor ? 1.02 : 1
      }) rotate(${isSelected ? 0 : fanRot}deg)`;

      return (
        <div
          key={card.id}
          className={`shrink-0 transition-transform duration-150 ${overlapCls} ${
            isSelected
              ? 'relative z-30'
              : isCursor
              ? 'relative z-20'
              : 'relative z-10'
          } ${freshOrder !== undefined ? 'card-deal-anim' : ''}`}
          style={
            freshOrder !== undefined
              ? { animationDelay: `${Math.min(280, freshOrder * 45)}ms` }
              : undefined
          }
        >
          <button
            type="button"
            onClick={() => {
              if (cardState.isMyTurn) {
                onAction({ type: 'toggle-card', cardId: card.id });
              } else {
                onAction({ type: 'select-index', index: originalIndex });
              }
            }}
            className={`card-hand-item relative rounded-2xl flex flex-col items-center justify-between p-1.5 select-none cursor-pointer bg-[#F8FAFC] border-2 active:scale-95 ${
              embedded
                ? 'w-14 h-20'
                : pocketOverlay
                ? 'w-[60px] h-[90px] sm:w-[72px] sm:h-[106px]'
                : 'w-[66px] h-[96px] sm:w-[74px] sm:h-[108px]'
            } ${
              isSelected
                ? 'border-[#FFB800] ring-2 ring-[#FFB800] shadow-[0_10px_22px_rgba(255,184,0,0.48)]'
                : isCursor
                ? 'border-[#00C2FF]'
                : 'border-[#CBD5E1]'
            }`}
            style={{
              transform: liarTransform,
              color: isJoker ? '#7C3AED' : isRed ? '#DC2626' : '#0F172A',
              boxShadow: isSelected
                ? '0 5px 0 #B58100, -3px 0 8px rgba(0,0,0,0.38)'
                : '0 4px 0 #94A3B8, -2px 0 8px rgba(0,0,0,0.35)',
            }}
          >
            {isSelected && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#FFB800] text-[#14120B] flex items-center justify-center shadow z-20">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            )}
            <div className="self-start flex flex-col items-center leading-none">
              <span className="font-mono text-[11px] sm:text-xs font-black leading-none">
                {isJoker ? '★' : card.rank}
              </span>
              <span className="text-[10px] leading-none mt-0.5">{sym}</span>
            </div>
            <div className="flex flex-col items-center leading-none">
              <span className="text-xl sm:text-2xl font-black">{sym}</span>
              <span className="font-mono text-[11px] font-black mt-0.5">{card.rank}</span>
            </div>
            <span className="self-end font-mono text-[10px] font-black leading-none opacity-80 rotate-180">
              {sym}
            </span>
          </button>
        </div>
      );
    });
  };

  // =========================================================================
  // RENDER ACTION BUTTONS (Supports both Corner Thumb Pill Mode & Standard Bar)
  // =========================================================================
  const renderActionButtons = (horizontal = false) => {
    const btnSizeCls = horizontal
      ? 'h-9 px-3.5 rounded-xl font-display font-black text-xs inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-transform'
      : 'tactile-btn flex-1 min-h-[40px] rounded-xl px-2 font-display font-black text-xs sm:text-sm flex items-center justify-center text-center leading-tight cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95';

    if (cardState.extraActions && cardState.extraActions.length > 0) {
      if (horizontal) {
        return (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {cardState.extraActions.map((btn, i) => (
              <button
                key={`${btn.label}_${i}`}
                type="button"
                disabled={btn.disabled}
                onClick={() => onAction(btn.action)}
                className={btnSizeCls}
                style={{
                  backgroundColor: btn.colorHex,
                  color: btn.textColor ?? '#FFFFFF',
                  boxShadow: '0 3px 0 rgba(0,0,0,0.45)',
                }}
              >
                <span className="truncate max-w-[130px]">
                  {lang === 'zh'
                    ? translateGameText(btn.labelZh || btn.label, lang)
                    : btn.label}
                </span>
              </button>
            ))}
          </div>
        );
      }
      return (
        <div className="flex-1 grid grid-cols-1 gap-1.5 min-h-0">
          {cardState.extraActions.map((btn, i) => (
            <button
              key={`${btn.label}_${i}`}
              type="button"
              disabled={btn.disabled}
              onClick={() => onAction(btn.action)}
              className="tactile-btn min-h-[40px] rounded-xl px-2.5 py-1 font-display font-black text-xs sm:text-sm text-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              style={{
                backgroundColor: btn.colorHex,
                color: btn.textColor ?? '#FFFFFF',
                boxShadow: '0 3px 0 rgba(0,0,0,0.45)',
              }}
            >
              <span className="truncate">
                {lang === 'zh'
                  ? translateGameText(btn.labelZh || btn.label, lang)
                  : btn.label}
              </span>
            </button>
          ))}
        </div>
      );
    }

    if (cardState.primaryBtn || cardState.secondaryBtn) {
      return (
        <>
          {cardState.secondaryBtn && (
            <button
              type="button"
              disabled={cardState.secondaryBtn.disabled}
              onClick={() => onAction(cardState.secondaryBtn!.action)}
              className={btnSizeCls}
              style={{
                backgroundColor: cardState.secondaryBtn.colorHex,
                color: cardState.secondaryBtn.textColor ?? '#0A1913',
                boxShadow: horizontal ? '0 3px 0 rgba(0,0,0,0.4)' : '0 4px 0 rgba(0,0,0,0.4)',
              }}
            >
              <span>
                {lang === 'zh'
                  ? translateGameText(
                      cardState.secondaryBtn.labelZh || cardState.secondaryBtn.label,
                      lang
                    )
                  : cardState.secondaryBtn.label}
              </span>
            </button>
          )}
          {cardState.primaryBtn && (
            <button
              type="button"
              disabled={cardState.primaryBtn.disabled}
              onClick={() => onAction(cardState.primaryBtn!.action)}
              className={btnSizeCls}
              style={{
                backgroundColor: cardState.primaryBtn.colorHex,
                color: cardState.primaryBtn.textColor ?? '#FFFFFF',
                boxShadow: horizontal ? '0 3px 0 rgba(0,0,0,0.45)' : '0 4px 0 rgba(0,0,0,0.45)',
              }}
            >
              <span>
                {lang === 'zh'
                  ? translateGameText(
                      cardState.primaryBtn.labelZh || cardState.primaryBtn.label,
                      lang
                    )
                  : cardState.primaryBtn.label}
              </span>
            </button>
          )}
        </>
      );
    }

    if (isColorClash) {
      return (
        <>
          <button
            type="button"
            disabled={!cardState.isMyTurn}
            onClick={() => onAction({ type: 'draw-or-pass' })}
            className={btnSizeCls}
            style={{
              backgroundColor: '#FFB800',
              color: '#14120B',
              boxShadow: horizontal ? '0 3px 0 #B58100' : '0 4px 0 #B58100',
            }}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>
              {(cardState.drawPenalty ?? 0) > 0
                ? `${t('TAKE', '罚抽')} +${cardState.drawPenalty}`
                : t('DRAW 1', '摸 1 张')}
            </span>
          </button>
          <button
            type="button"
            disabled={!cardState.isMyTurn || !highlightedCard?.playable}
            onClick={() => highlightedCard && triggerPlayWithThrowAnim(highlightedCard.id)}
            className={btnSizeCls}
            style={{
              backgroundColor: '#10D98B',
              color: '#0A1913',
              boxShadow: horizontal ? '0 3px 0 #0A915D' : '0 4px 0 #0A915D',
            }}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>{t('PLAY CARD', '出牌')}</span>
          </button>
        </>
      );
    }

    if (isLiarsDeck && cardState.phase === 'challenge' && cardState.canCallBluff) {
      return (
        <>
          <button
            type="button"
            onClick={() => onAction({ type: 'call-bluff' })}
            className={`${btnSizeCls} bg-[#FF4D2E] hover:bg-[#FF6145] text-white shadow-[0_3px_0_#B82E17] animate-pulse`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t('CALL LIAR!', '抓谎！')}</span>
          </button>
          <button
            type="button"
            disabled={!cardState.canTrust}
            onClick={() => onAction({ type: 'trust-claim' })}
            className={`${btnSizeCls} bg-[#10D98B] text-[#0A1913] shadow-[0_3px_0_#0A915D]`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>{t('TRUST', '信任跳过')}</span>
          </button>
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          disabled={!cardState.isMyTurn}
          onClick={() => onAction({ type: 'draw-or-pass' })}
          className={`${btnSizeCls} bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] shadow-[0_3px_0_rgba(0,0,0,0.4)]`}
        >
          {t('Pass', '过牌')}
        </button>
        <button
          type="button"
          disabled={!cardState.isMyTurn || cardState.hand.length === 0}
          onClick={() => onAction({ type: 'submit-selected' })}
          className={btnSizeCls}
          style={{
            backgroundColor: playerColorHex,
            color: '#FFFFFF',
            boxShadow: horizontal ? '0 3px 0 rgba(0,0,0,0.45)' : '0 4px 0 rgba(0,0,0,0.45)',
          }}
        >
          <span>
            {selectedLiarCount > 0
              ? t(`PLAY ${selectedLiarCount}`, `扣出 ${selectedLiarCount} 张`)
              : t('PLAY CARD', '出 1 张暗牌')}
          </span>
          <span className="text-[10px] opacity-90 font-mono">
            ({cardState.targetRank ?? 'A'})
          </span>
        </button>
      </>
    );
  };

  // =========================================================================
  // ZONE A — UNO MOBILE TOP OPPONENT ARC (Avatars, Turn Rings, Mini Card Fan & UNO! Badge)
  // =========================================================================
  const renderUnoOpponentArc = () => {
    const opponents = situation?.players.filter((p) => !p.isMe) ?? [];

    return (
      <div className="pointer-events-auto w-full shrink-0 px-2 pt-0.5 flex items-center justify-center gap-1.5 sm:gap-2.5 overflow-x-auto arcade-scrollbar">
        {opponents.length === 0 ? (
          <div className="px-3 py-1 rounded-full bg-black/45 border border-white/10 text-[11px] font-bold text-[#9CA3AF]">
            {t('Solo Practice Table', '单人牌桌练习')}
          </div>
        ) : (
          opponents.map((p, idx) => {
            const count = typeof p.cardCount === 'number' ? p.cardCount : null;
            const isUnoDanger = count === 1 || p.statusTag === 'UNO!';
            const fanSlices = count !== null ? Math.min(4, Math.max(1, count)) : 2;
            const arcOffsetCls =
              opponents.length >= 3 && (idx === 0 || idx === opponents.length - 1)
                ? 'translate-y-1'
                : '';

            return (
              <div
                key={p.id}
                className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-2xl border backdrop-blur-md shrink-0 transition-all duration-200 ${arcOffsetCls} ${
                  p.isActive
                    ? 'bg-[#172235]/95 border-[#FFB800] shadow-[0_0_16px_rgba(255,184,0,0.42)] scale-[1.03]'
                    : 'bg-[#0C1018]/85 border-white/12'
                } ${p.alive === false ? 'opacity-45 grayscale' : ''}`}
              >
                {/* Avatar with glowing active turn ring */}
                <div className="relative shrink-0">
                  <div
                    className={`rounded-full p-0.5 ${
                      p.isActive
                        ? 'ring-2 ring-[#FFB800] shadow-[0_0_10px_#FFB800]'
                        : ''
                    }`}
                  >
                    <PlayerAvatar
                      avatarId={p.avatarId || 'fox'}
                      colorHex={p.colorHex}
                      size="xs"
                    />
                  </div>
                  {p.isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10D98B] ring-2 ring-[#0C1018]"
                    />
                  )}
                </div>

                {/* Name + Last Action / Status */}
                <div className="min-w-0 leading-tight">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[11px] font-extrabold text-white truncate max-w-[66px] sm:max-w-[84px] ${
                        p.alive === false ? 'line-through' : ''
                      }`}
                    >
                      {p.name}
                    </span>
                    {isUnoDanger && (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#FF3B30] text-white font-display text-[9px] font-black tracking-tight animate-bounce shadow">
                        UNO!
                      </span>
                    )}
                    {!isUnoDanger && p.statusTag && (
                      <span className="px-1 py-0.2 rounded bg-white/10 text-[9px] font-mono font-black text-[#FFD166] whitespace-nowrap">
                        {translateGameText(p.statusTag, lang)}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono font-bold text-[#9CA3AF] truncate max-w-[86px] tabular-nums">
                    {p.lastAction
                      ? translateGameText(p.lastAction, lang)
                      : translateGameText(p.stat, lang)}
                  </div>
                </div>

                {/* Mini Fanned Card-Back Stack + Big Card Count Badge */}
                {count !== null && (
                  <div className="relative flex items-center pl-1 shrink-0">
                    <div className="relative w-5 h-6 flex items-center justify-center">
                      {Array.from({ length: fanSlices }).map((_, sIdx) => (
                        <span
                          key={sIdx}
                          aria-hidden="true"
                          className="absolute w-3.5 h-5 rounded-[4px] bg-gradient-to-br from-[#FF4D2E] via-[#1E2638] to-[#0B0F19] border border-white/45 shadow-sm"
                          style={{
                            transform: `rotate(${(sIdx - (fanSlices - 1) / 2) * 10}deg) translateX(${
                              (sIdx - (fanSlices - 1) / 2) * 1.5
                            }px)`,
                          }}
                        />
                      ))}
                      <span
                        className={`relative z-10 px-1 min-w-[18px] h-[18px] rounded-full font-mono text-[10px] font-black tabular-nums flex items-center justify-center shadow ${
                          isUnoDanger
                            ? 'bg-[#FF3B30] text-white ring-1 ring-white'
                            : 'bg-[#0B0F19]/90 text-[#FFB800] border border-[#FFB800]/60'
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  // =========================================================================
  // ZONE B — UNO MOBILE CENTER ARENA OVERLAY (360° Direction Ring, Interactive Draw Deck, Active Pile & Wild Wheel)
  // =========================================================================
  const renderUnoCenterTableControls = () => {
    const centerCard = situation?.centerPileCard;
    const isClockwise = (situation?.direction ?? 1) === 1;
    const canDrawNow = Boolean(
      cardState.isMyTurn && (isColorClash || situation?.canDrawDeck)
    );
    const ringHex = activeColorSpec?.ring ?? playerColorHex ?? '#00C2FF';
    const penaltyCount = cardState.drawPenalty ?? 0;

    return (
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-2">
        {/* Top Live Turn & Direction Pill on Felt */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#090D16]/82 border border-white/15 backdrop-blur-md shadow-lg">
          <span
            className="inline-flex items-center gap-1 font-mono text-[11px] font-black"
            style={{ color: ringHex }}
          >
            {isClockwise ? (
              <RotateCw className="w-3.5 h-3.5" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>{isClockwise ? t('CLOCKWISE', '顺时针') : t('REVERSE', '逆时针')}</span>
          </span>

          {situation?.tableBadge && (
            <>
              <span className="text-white/25">·</span>
              <span
                className="px-2 py-0.5 rounded-full font-mono text-[10px] font-black shadow-sm"
                style={{
                  backgroundColor: situation.tableBadge.bg,
                  color: situation.tableBadge.fg,
                }}
              >
                {translateGameText(situation.tableBadge.text, lang)}
              </span>
            </>
          )}

          {situation?.lastMoveText && (
            <>
              <span className="text-white/25 hidden sm:inline">·</span>
              <span className="text-[11px] font-bold text-[#E5E7EB] truncate max-w-[160px] sm:max-w-[240px]">
                {translateGameText(situation.lastMoveText, lang)}
              </span>
            </>
          )}
        </div>

        {/* Center Interactive UNO Draw Deck + Active Discard Pile (for Shedding / Bluff / Party Deck games) */}
        {centerCard && !(isColorClash && cardState.awaitingColorPick) && (
          <div className="relative flex items-center justify-center my-auto">
            {/* 360° Glowing Turn Direction Orbit Ring */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-5 sm:-inset-7 rounded-full border-2 border-dashed opacity-55 transition-colors duration-300"
              style={{
                borderColor: ringHex,
                boxShadow: `0 0 36px ${activeColorSpec?.glow ?? 'rgba(0,194,255,0.22)'}`,
              }}
            />

            <div className="pointer-events-auto relative z-10 flex items-center gap-4 sm:gap-6 px-4 py-2.5 rounded-3xl bg-transparent">
              {/* LEFT: Interactive 3D Draw Pile (Tap directly on the table to Draw!) */}
              {(typeof situation?.deckCount === 'number' || isColorClash) && (
                <button
                  type="button"
                  disabled={!canDrawNow}
                  onClick={() => onAction({ type: 'draw-or-pass' })}
                  title={
                    canDrawNow
                      ? t('Tap deck to draw a card', '点击牌堆摸牌')
                      : t('Draw Pile', '摸牌堆')
                  }
                  className={`group relative w-[56px] h-[80px] sm:w-[66px] sm:h-[94px] rounded-2xl border-2 flex flex-col items-center justify-between p-1.5 select-none transition-transform ${
                    canDrawNow
                      ? 'cursor-pointer border-[#FFB800] ring-2 ring-[#FFB800]/70 shadow-[0_6px_0_#78350F,0_0_20px_rgba(255,184,0,0.5)] hover:-translate-y-1 active:scale-95'
                      : 'cursor-default border-white/25 opacity-90 shadow-[0_5px_0_#0F172A]'
                  }`}
                  style={{
                    background:
                      'linear-gradient(145deg, #1E293B 0%, #0F172A 55%, #1E1B4B 100%)',
                  }}
                >
                  {/* 3D Stack Depth Layers */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-1 -top-1 inset-0 rounded-2xl border border-white/15 bg-[#1E293B]/60 -z-10"
                  />
                  <span className="font-mono text-[9px] font-black text-[#94A3B8] uppercase">
                    {t('DECK', '牌堆')}
                  </span>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#FF4D2E]/90 border-2 border-white/80 flex items-center justify-center -rotate-12 shadow">
                    <span className="font-display text-[10px] font-black text-white tracking-tighter">
                      UNO
                    </span>
                  </div>
                  <span className="px-1.5 py-0.2 rounded bg-black/60 font-mono text-[10px] font-black text-white tabular-nums">
                    {typeof situation?.deckCount === 'number' ? situation.deckCount : '∞'}
                  </span>

                  {canDrawNow && (
                    <span className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#FFB800] text-[#14120B] font-display text-[9px] font-black whitespace-nowrap shadow-md">
                      {penaltyCount > 0
                        ? `${t('TAKE', '罚抽')} +${penaltyCount}`
                        : t('TAP DRAW', '点击摸牌')}
                    </span>
                  )}
                </button>
              )}

              {/* RIGHT: Active Discard / Claim Pile Card */}
              <div className="relative flex flex-col items-center">
                {centerCard.kind === 'clash' ? (
                  (() => {
                    const colSpec =
                      CLASH_STYLE[centerCard.colorKey ?? 'red'] ?? CLASH_STYLE.red;
                    const activeSpec =
                      CLASH_STYLE[centerCard.activeColorKey ?? centerCard.colorKey ?? 'red'] ??
                      colSpec;
                    const displayMain =
                      lang === 'zh'
                        ? translateGameText(centerCard.mainText, lang)
                        : centerCard.mainText;
                    return (
                      <div
                        className="relative w-[62px] h-[86px] sm:w-[72px] sm:h-[100px] rounded-2xl p-1.5 flex flex-col items-center justify-between ring-2 ring-white shadow-2xl rotate-[3deg]"
                        style={{
                          background:
                            centerCard.colorKey === 'wild'
                              ? 'linear-gradient(135deg, #FF4D2E 0%, #FFB800 35%, #10D98B 70%, #00C2FF 100%)'
                              : activeSpec.bg,
                          color: activeSpec.text,
                          boxShadow: `0 6px 0 ${activeSpec.dark}, 0 0 24px ${activeSpec.glow}`,
                        }}
                      >
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-1.5 rounded-full border border-white/35 bg-white/15 -rotate-[22deg]"
                        />
                        <span className="relative z-10 self-start font-mono text-[10px] font-black leading-none">
                          {displayMain}
                        </span>
                        <span className="relative z-10 font-display text-xl sm:text-2xl font-black leading-none drop-shadow">
                          {displayMain}
                        </span>
                        <span className="relative z-10 self-end font-mono text-[10px] font-black leading-none rotate-180">
                          {displayMain}
                        </span>
                      </div>
                    );
                  })()
                ) : (
                  <div
                    className="relative min-w-[68px] h-[84px] sm:min-w-[80px] sm:h-[96px] px-2.5 py-1.5 rounded-2xl border-2 border-white/80 flex flex-col items-center justify-between text-center shadow-2xl rotate-[2deg]"
                    style={{
                      background: `linear-gradient(150deg, ${
                        centerCard.accentHex ?? '#FFB800'
                      } 0%, #111827 100%)`,
                      color: '#FFFFFF',
                    }}
                  >
                    {centerCard.badgeText && (
                      <span className="px-1.5 py-0.5 rounded bg-black/55 font-mono text-[9px] font-black uppercase">
                        {translateGameText(centerCard.badgeText, lang)}
                      </span>
                    )}
                    <span className="font-display text-xl sm:text-2xl font-black leading-tight drop-shadow">
                      {translateGameText(centerCard.mainText, lang)}
                    </span>
                    {centerCard.subText && (
                      <span className="text-[9px] font-bold text-white/90 truncate max-w-[110px]">
                        {translateGameText(centerCard.subText, lang)}
                      </span>
                    )}
                  </div>
                )}

                {penaltyCount > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 px-2 py-0.5 rounded-full bg-[#FF3B30] text-white font-mono text-xs font-black ring-2 ring-white shadow-lg animate-bounce">
                    +{penaltyCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4-Quadrant UNO Wild Color Wheel Modal directly over the Center Table when choosing Wild Color */}
        {isColorClash && cardState.awaitingColorPick && (
          <div className="pointer-events-auto my-auto flex flex-col items-center gap-2 px-4 py-3 rounded-3xl bg-[#0B0F19]/92 border-2 border-white/25 backdrop-blur-md shadow-2xl">
            <span className="font-display text-xs sm:text-sm font-black uppercase tracking-wider text-white">
              {t('Pick Active Table Color', '选择当前牌桌颜色')}
            </span>
            <div className="grid grid-cols-2 gap-2.5 w-36 h-36 sm:w-44 sm:h-44 p-2 rounded-full bg-[#141A29] border-2 border-white/20 shadow-inner">
              {(['red', 'blue', 'gold', 'green'] as const).map((col) => {
                const spec = CLASH_STYLE[col];
                const cornerCls =
                  col === 'red'
                    ? 'rounded-tl-full rounded-br-xl'
                    : col === 'blue'
                    ? 'rounded-tr-full rounded-bl-xl'
                    : col === 'gold'
                    ? 'rounded-bl-full rounded-tr-xl'
                    : 'rounded-br-full rounded-tl-xl';
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => onAction({ type: 'pick-color', color: col })}
                    className={`tactile-btn ${cornerCls} font-display font-black text-xs sm:text-sm flex items-center justify-center cursor-pointer active:scale-90 transition-transform ring-2 ring-white/40 hover:ring-white`}
                    style={{
                      backgroundColor: spec.bg,
                      color: spec.text,
                      boxShadow: `0 4px 0 ${spec.dark}`,
                    }}
                  >
                    <span>{lang === 'zh' ? spec.nameZh : spec.nameEn}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom-of-Table Coach / Hint Pill */}
        {coachTip ? (
          <div className="pointer-events-auto flex items-center gap-2 px-3 py-1 rounded-full bg-[#090D16]/88 border border-[#00C2FF]/45 text-[11px] shadow-md max-w-[92%]">
            <Sparkles className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />
            <span className="font-bold text-[#E0F2FE] truncate">{coachTip}</span>
            {onDismissCoach && (
              <button
                type="button"
                onClick={onDismissCoach}
                aria-label={t('Dismiss tip', '关闭提示')}
                className="text-[#9CA3AF] hover:text-white shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div />
        )}
      </div>
    );
  };

  // =========================================================================
  // POCKET MODE — FULL-SCREEN UNIFIED UNO MOBILE TABLE & CURVED CARD FAN PAD
  // =========================================================================
  if (pocketOverlay) {
    const hintText =
      lang === 'zh'
        ? translateGameText(cardState.statusHintZh || cardState.statusHint, lang)
        : cardState.statusHint;
    const isTurnActiveNow = Boolean(cardState.isActionRequired || cardState.isMyTurn);
    const tableFeltBg = activeColorSpec?.feltGradient ?? DEFAULT_TABLE_FELT;

    // Collapsed Hand Mode (Full Table Inspection)
    if (handCollapsed) {
      const overviewLine = situation?.lastMoveText
        ? translateGameText(situation.lastMoveText, lang)
        : hintText;

      return (
        <div className="flex-1 flex flex-col justify-between min-h-0 relative z-10 pointer-events-none">
          {renderUnoOpponentArc()}

          <div className="pointer-events-auto flex items-center justify-between gap-2 px-3 py-1.5 rounded-2xl bg-[#0D1017]/94 border border-white/15 backdrop-blur-md shrink-0 shadow-xl">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`px-2.5 py-0.5 rounded-lg font-mono text-xs font-black tabular-nums shrink-0 inline-flex items-center gap-1.5 ${
                  isDanger
                    ? 'bg-[#FF3B30] text-white animate-pulse'
                    : isTurnActiveNow
                    ? 'bg-[#10D98B] text-[#0A1913]'
                    : 'bg-[#1C2230] text-[#E5E7EB] border border-white/10'
                }`}
              >
                <span>
                  {isTurnActiveNow
                    ? t(`YOUR TURN · ${timeSecs}s`, `轮到你 · ${timeSecs}s`)
                    : situation?.activePlayerName
                    ? `${situation.activePlayerName} · ${timeSecs}s`
                    : `${timeSecs}s`}
                </span>
              </span>

              {situation?.tableBadge && (
                <span
                  className="px-2 py-0.5 rounded-md font-mono text-[11px] font-black shrink-0"
                  style={{
                    backgroundColor: situation.tableBadge.bg,
                    color: situation.tableBadge.fg,
                  }}
                >
                  {translateGameText(situation.tableBadge.text, lang)}
                </span>
              )}

              <span className="text-xs sm:text-sm font-bold text-white truncate">
                {overviewLine}
              </span>
            </div>

            {onToggleHandCollapsed && (
              <button
                type="button"
                onClick={onToggleHandCollapsed}
                className={`h-8 px-3.5 rounded-xl font-display font-black text-xs inline-flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap active:scale-95 transition-transform ${
                  isTurnActiveNow
                    ? 'bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913]'
                    : 'bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B]'
                }`}
              >
                <Hand className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isTurnActiveNow
                    ? t(`Show Hand (${cardState.hand.length})`, `展开手牌 (${cardState.hand.length})`)
                    : t(`Hand (${cardState.hand.length})`, `手牌 (${cardState.hand.length})`)}
                </span>
              </button>
            )}
          </div>
        </div>
      );
    }

    // Full Unified UNO Mobile Card Table View
    return (
      <div
        className="flex-1 flex flex-col justify-between min-h-0 relative z-10 rounded-2xl overflow-hidden pointer-events-auto"
        style={{ background: pocketTableSlot ? 'transparent' : tableFeltBg }}
      >
        {/* Full-bleed live table slot behind all zones so cards float directly on the table */}
        {pocketTableSlot && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            {pocketTableSlot}
          </div>
        )}

        {/* ZONE A: Top Opponent Arc */}
        <div className="relative z-10 shrink-0">
          {renderUnoOpponentArc()}
        </div>

        {/* ZONE B: Center Table Felt + Interactive UNO Deck & Discard Overlay */}
        <div className="relative z-10 flex-1 min-h-[110px] w-full overflow-hidden pointer-events-none">
          {renderUnoCenterTableControls()}
        </div>

        {/* ZONE C: Bottom UNO-Style Curved Hand Fan + Corner Thumb Action Dock (Transparent behind cards) */}
        <div
          className="relative z-10 w-full shrink-0 flex flex-col justify-end bg-transparent"
          style={{
            opacity: Math.max(0.88, Math.min(1, hudOpacity + 0.2)),
          }}
        >
          {/* Live Shot-Clock Progress Line along Top Edge of Hand Dock */}
          <div className="w-full h-1 bg-transparent overflow-hidden shrink-0">
            <div
              className={`h-full transition-all duration-200 ${
                isDanger
                  ? 'bg-[#FF3B30]'
                  : isTurnActiveNow
                  ? 'bg-[#10D98B]'
                  : 'bg-[#00C2FF]/50'
              }`}
              style={{ width: `${turnProgressPct}%` }}
            />
          </div>

          {/* Thumb Control Bar: Left Status/Timer + Utility Chips + Right Primary/Secondary Action Pills */}
          <div className="flex items-center justify-between gap-1.5 px-2.5 pt-1.5 pb-0.5 shrink-0 overflow-x-auto arcade-scrollbar">
            {/* Left Thumb Zone: Turn Badge + Hint + Quick Hand Tools */}
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`px-2.5 py-0.5 rounded-lg font-mono text-[11px] font-black tabular-nums shrink-0 inline-flex items-center gap-1 ${
                  isDanger
                    ? 'bg-[#FF3B30] text-white animate-pulse shadow-[0_0_12px_rgba(255,59,48,0.7)]'
                    : isTurnActiveNow
                    ? 'bg-[#10D98B] text-[#0A1913] shadow-[0_0_10px_rgba(16,217,139,0.45)]'
                    : 'bg-[#1E2534] text-[#D1D5DB]'
                }`}
              >
                {isTurnActiveNow
                  ? isDanger
                    ? `${t('HURRY!', '快出!')} ${timeSecs}s`
                    : `${t('YOUR TURN', '你的回合')} · ${timeSecs}s`
                  : `${situation?.activePlayerName ? `${situation.activePlayerName} · ` : ''}${timeSecs}s`}
              </span>

              {cardState.hand.length === 1 && (
                <span className="px-2 py-0.5 rounded-full bg-[#FF3B30] text-white font-display text-[10px] font-black tracking-wider animate-pulse shrink-0">
                  UNO!
                </span>
              )}

              <span className="text-xs font-bold text-[#F3F4F6] truncate max-w-[145px] sm:max-w-[230px]">
                {hintText}
              </span>
            </div>

            {/* Right Thumb Zone: Action Pills + Compact Hand Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {!(isColorClash && cardState.awaitingColorPick) && renderActionButtons(true)}

              <div className="h-4 w-px bg-white/15 mx-0.5 shrink-0" />

              {onCycleSortMode && (
                <button
                  type="button"
                  onClick={onCycleSortMode}
                  title={t('Sort Hand', '智能理牌')}
                  className={`h-7 px-2 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    sortMode !== 'server'
                      ? 'bg-[#00C2FF]/20 border-[#00C2FF]/60 text-[#00C2FF]'
                      : 'bg-[#171C28] border-white/12 text-[#D1D5DB] hover:text-white'
                  }`}
                >
                  <ArrowDownUp className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    {sortMode === 'playable'
                      ? t('Playable', '可出')
                      : sortMode === 'rank'
                      ? t('Rank', '点数')
                      : t('Sort', '理牌')}
                  </span>
                </button>
              )}

              {onChangeViewMode && (
                <button
                  type="button"
                  onClick={() => onChangeViewMode(effectiveView === 'fan' ? 'grid' : 'fan')}
                  title={
                    effectiveView === 'fan'
                      ? t('Switch to All-Cards Grid', '展开全部手牌网格')
                      : t('Switch to UNO Curved Fan', '切回扇形手牌')
                  }
                  className={`h-7 px-2 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    effectiveView === 'grid'
                      ? 'bg-[#FFB800] border-[#FFB800] text-[#14120B]'
                      : 'bg-[#171C28] border-white/12 text-[#D1D5DB] hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span className="hidden sm:inline">
                    {effectiveView === 'grid' ? t('Fan', '扇形') : t('Grid', '网格')}
                  </span>
                </button>
              )}

              {onTogglePrivacy && (
                <button
                  type="button"
                  onClick={onTogglePrivacy}
                  title={t('Toggle Privacy Cover', '切换防偷窥盖牌')}
                  className={`h-7 px-2 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                    privacyShield
                      ? 'bg-[#FFB800]/20 border-[#FFB800] text-[#FFB800]'
                      : 'bg-[#171C28] border-white/12 text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {privacyShield ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              )}

              {onToggleHandCollapsed && (
                <button
                  type="button"
                  onClick={onToggleHandCollapsed}
                  title={t('Minimize hand to inspect full table', '收起手牌查看完整桌面')}
                  className="h-7 px-2 rounded-lg border bg-[#171C28] border-white/12 text-[10px] font-bold text-[#00C2FF] hover:text-white inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  {handCollapsed ? (
                    <Maximize2 className="w-3 h-3 shrink-0" />
                  ) : (
                    <Minimize2 className="w-3 h-3 shrink-0" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* UNO-Style Curved Hand Fan or Full Grid */}
          <div
            className={
              effectiveView === 'grid'
                ? 'h-[154px] sm:h-[188px] w-full flex flex-col'
                : 'h-[112px] sm:h-[132px] w-full flex flex-col'
            }
          >
            {isMaskActive ? (
              <div
                onPointerDown={() => setPeeking(true)}
                onPointerUp={() => setPeeking(false)}
                onPointerCancel={() => setPeeking(false)}
                onPointerLeave={() => setPeeking(false)}
                onContextMenu={(e) => e.preventDefault()}
                className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 text-center touch-none select-none cursor-pointer bg-[#121620]/90 hover:bg-[#161B28]"
              >
                <EyeOff className="w-5 h-5 text-[#FFB800] mb-0.5" />
                <div className="font-display font-extrabold text-xs sm:text-sm text-white">
                  {t('Cards Hidden · Hold Here to Peek', '手牌已遮盖防偷窥 · 按住此处查看')}
                </div>
                <div className="text-[11px] text-[#9CA3AF]">
                  {t(
                    `${cardState.hand.length} cards in hand — lifts while held`,
                    `共 ${cardState.hand.length} 张牌 — 松手自动隐藏`
                  )}
                </div>
              </div>
            ) : (
              <div
                className={
                  effectiveView === 'grid'
                    ? 'flex-1 min-h-0 w-full overflow-y-auto arcade-scrollbar grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1.5 px-3 pt-2 pb-1.5 content-start justify-items-center'
                    : 'flex-1 min-h-0 w-full flex items-end justify-start sm:justify-center overflow-x-auto arcade-scrollbar px-4 pt-5 pb-2'
                }
              >
                {renderHandCards()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // STANDARD CONTROLLER MODE (Dual-Screen Phone / Embedded Test Controller)
  // =========================================================================
  return (
    <div className="flex-1 flex flex-col justify-between gap-2 min-h-0">
      {/* Status Banner + Target / Active Color / Party Info + Shot-Clock */}
      <div
        className={`flex items-center justify-between gap-2 px-3 rounded-xl border shrink-0 transition-colors duration-150 ${
          embedded ? 'py-1.5' : 'py-2'
        } ${
          isDanger
            ? 'bg-[#FF3B30]/25 border-[#FF3B30] animate-pulse'
            : cardState.isActionRequired
            ? 'bg-[#10D98B]/12 border-[#10D98B]/60'
            : 'bg-[#171B24] border-[#2A303D]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isDanger ? (
            <AlertTriangle className="w-4 h-4 text-[#FF3B30] shrink-0" />
          ) : isColorClash && activeColorSpec ? (
            <span
              className="px-2 py-0.5 rounded-md font-mono text-[10px] font-black shrink-0 transition-colors duration-200"
              style={{ backgroundColor: activeColorSpec.bg, color: activeColorSpec.text }}
            >
              {lang === 'zh' ? activeColorSpec.nameZh : activeColorSpec.nameEn}
            </span>
          ) : cardState.targetRank ? (
            <span className="px-2 py-0.5 rounded-md bg-[#FFB800] text-[#14120B] font-mono text-[11px] font-black shrink-0">
              {t('CLAIM:', '目标:')} {cardState.targetRank}
            </span>
          ) : cardState.badgeText ? (
            <span
              className="px-2 py-0.5 rounded-md font-mono text-[10px] font-black shrink-0 text-[#0B1219]"
              style={{ backgroundColor: cardState.badgeColorHex ?? '#FFB800' }}
            >
              {translateGameText(cardState.badgeText, lang)}
            </span>
          ) : null}

          <span className="text-xs sm:text-sm font-bold text-white truncate">
            {lang === 'zh'
              ? translateGameText(cardState.statusHintZh || cardState.statusHint, lang)
              : cardState.statusHint}
          </span>

          {isColorClash && (cardState.drawPenalty ?? 0) > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-[#FF4D2E] text-white font-mono text-[10px] font-black shrink-0">
              +{cardState.drawPenalty}
            </span>
          )}
        </div>

        <div
          className={`px-2.5 py-0.5 rounded-lg font-mono text-xs font-black tabular-nums shrink-0 transition-colors duration-150 ${
            isDanger
              ? 'bg-[#FF3B30] text-white shadow-[0_0_12px_rgba(255,59,48,0.8)]'
              : cardState.isActionRequired
              ? 'bg-[#10D98B] text-[#0A1913]'
              : 'bg-[#242A36] text-[#D1D5DB]'
          }`}
        >
          {isDanger ? `${t('HURRY!', '快出牌!')} ${timeSecs}s` : `${timeSecs}s`}
        </div>
      </div>

      {/* Wild Color Picker Overlay when Color Clash needs a color */}
      {isColorClash && cardState.awaitingColorPick ? (
        <div className="flex-1 grid grid-cols-4 gap-2.5 py-1 min-h-0">
          {(['red', 'blue', 'gold', 'green'] as const).map((col, idx) => {
            const spec = CLASH_STYLE[col];
            return (
              <button
                key={col}
                type="button"
                onClick={() => onAction({ type: 'pick-color', color: col })}
                className="tactile-btn swatch-pop-anim rounded-2xl font-display font-black text-sm sm:text-lg flex flex-col items-center justify-center cursor-pointer active:scale-95"
                style={{
                  backgroundColor: spec.bg,
                  color: spec.text,
                  boxShadow: `0 5px 0 ${spec.dark}`,
                  animationDelay: `${idx * 45}ms`,
                }}
              >
                <span>{lang === 'zh' ? spec.nameZh : spec.nameEn}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div
          className={`flex-1 flex items-stretch gap-2.5 min-h-0 ${
            actionsSide === 'left' ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <div className="relative flex-1 flex flex-col rounded-2xl bg-transparent min-w-0 overflow-hidden">
            {/* Compact Pad 4 Card Toolbar */}
            <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 bg-transparent shrink-0">
              <div className="flex items-center gap-1">
                {onChangeViewMode && (
                  <div className="inline-flex items-center p-0.5 rounded-md bg-[#0B0E14] border border-[#242934]">
                    <button
                      type="button"
                      onClick={() => onChangeViewMode('fan')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap cursor-pointer ${
                        effectiveView === 'fan'
                          ? 'bg-[#FFB800] text-[#14120B]'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {t('Fan', '扇形')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeViewMode('grid')}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                        effectiveView === 'grid'
                          ? 'bg-[#FFB800] text-[#14120B]'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      <LayoutGrid className="w-2.5 h-2.5" />
                      <span>{t('Grid', '网格')}</span>
                    </button>
                  </div>
                )}

                {onCycleSortMode && (
                  <button
                    type="button"
                    onClick={onCycleSortMode}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      sortMode !== 'server'
                        ? 'bg-[#00C2FF]/20 border-[#00C2FF]/60 text-[#00C2FF]'
                        : 'bg-[#181C26] border-[#2A303D] text-[#D1D5DB] hover:text-white'
                    }`}
                  >
                    <ArrowDownUp className="w-2.5 h-2.5" />
                    <span>
                      {sortMode === 'playable'
                        ? t('Sort: Playable', '排序: 可出')
                        : sortMode === 'rank'
                        ? t('Sort: Rank', '排序: 点数')
                        : t('Sort', '理牌')}
                    </span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                {onTogglePrivacy && (
                  <button
                    type="button"
                    onClick={onTogglePrivacy}
                    className={`px-2 py-0.5 rounded-md border text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                      privacyShield
                        ? 'bg-[#FFB800]/20 border-[#FFB800] text-[#FFB800]'
                        : 'bg-[#181C26] border-[#2A303D] text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {privacyShield ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                    <span>{privacyShield ? t('Peek Shield', '盖牌保护') : t('Show', '明牌')}</span>
                  </button>
                )}

                {onFlipActionsSide && (
                  <button
                    type="button"
                    onClick={onFlipActionsSide}
                    title={t('Swap Action Buttons Left/Right', '左右切换出牌按钮位置')}
                    className="px-1.5 py-0.5 rounded-md bg-[#181C26] border border-[#2A303D] text-[10px] font-bold text-[#9CA3AF] hover:text-white inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                  >
                    <ArrowLeftRight className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            {isMaskActive ? (
              <div
                onPointerDown={() => setPeeking(true)}
                onPointerUp={() => setPeeking(false)}
                onPointerCancel={() => setPeeking(false)}
                onPointerLeave={() => setPeeking(false)}
                onContextMenu={(e) => e.preventDefault()}
                className="flex-1 flex flex-col items-center justify-center p-4 text-center touch-none select-none cursor-pointer bg-[#121620] hover:bg-[#161B28]"
              >
                <EyeOff className="w-8 h-8 text-[#FFB800] mb-1.5" />
                <div className="font-display font-extrabold text-sm text-white">
                  {t('Cards Hidden · Hold Here to Peek', '手牌已遮盖防偷窥 · 按住此处查看')}
                </div>
                <div className="mt-0.5 text-[11px] text-[#9CA3AF]">
                  {t(
                    `${cardState.hand.length} cards in hand — lifts while your finger holds`,
                    `共 ${cardState.hand.length} 张牌 — 松手即刻自动隐藏`
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`flex-1 min-h-0 px-2.5 pt-3 pb-2.5 ${
                  effectiveView === 'grid'
                    ? 'overflow-y-auto arcade-scrollbar grid grid-cols-4 sm:grid-cols-6 gap-2 content-start justify-items-center'
                    : 'flex items-center gap-1.5 sm:gap-2 overflow-x-auto'
                }`}
              >
                {renderHandCards()}
              </div>
            )}

            {privacyShield && (
              <button
                type="button"
                onPointerDown={() => setPeeking(true)}
                onPointerUp={() => setPeeking(false)}
                onPointerCancel={() => setPeeking(false)}
                onPointerLeave={() => setPeeking(false)}
                onContextMenu={(e) => e.preventDefault()}
                className="shrink-0 h-8 bg-[#181D29] border-t border-[#2A303D] text-[11px] font-bold text-[#FFB800] flex items-center justify-center gap-1.5 touch-none select-none cursor-pointer"
              >
                {peeking ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>
                  {peeking
                    ? t('Peeking — release to hide', '正在查看 — 松开手指立即隐藏')
                    : t('Hold to Peek at Secret Cards', '按住此处查看秘密手牌')}
                </span>
              </button>
            )}
          </div>

          <div
            className={`flex flex-col justify-center gap-1.5 shrink-0 ${
              embedded ? 'w-32' : 'w-36 sm:w-44'
            }`}
          >
            {renderActionButtons()}
          </div>
        </div>
      )}
    </div>
  );
}
