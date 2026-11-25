import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeftRight,
  Check,
  Eye,
  EyeOff,
  Flame,
  LayoutGrid,
  Maximize2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { CardClientAction, CardColor, CardPrivateHandItem, CardPrivateState } from '../shared/types';
import type { CardSortMode, CardViewMode } from '../shared/padProfiles';
import { useLanguage, translateGameText } from '../lib/i18n';

export interface PocketCardSituationPlayer {
  id: string;
  name: string;
  colorHex: string;
  stat: string;
  isActive: boolean;
  isMe: boolean;
  alive?: boolean;
}

export interface PocketCardSituation {
  activePlayerId?: string;
  activePlayerName?: string;
  activePlayerColor?: string;
  tableBadge?: { text: string; bg: string; fg: string } | null;
  tableSummary?: string;
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
  handCollapsed?: boolean;
  onToggleHandCollapsed?: () => void;
  onChangeViewMode?: (next: 'fan' | 'grid') => void;
  onCycleSortMode?: () => void;
  onTogglePrivacy?: () => void;
  onFlipActionsSide?: () => void;
  onAction: (action: CardClientAction) => void;
}

const CLASH_STYLE: Record<
  CardColor,
  { bg: string; dark: string; text: string; nameEn: string; nameZh: string }
> = {
  red: { bg: '#FF4D2E', dark: '#B82E17', text: '#FFFFFF', nameEn: 'RED', nameZh: '红' },
  blue: { bg: '#00C2FF', dark: '#007FA8', text: '#0B1219', nameEn: 'BLUE', nameZh: '蓝' },
  gold: { bg: '#FFB800', dark: '#B58100', text: '#14120B', nameEn: 'GOLD', nameZh: '黄' },
  green: { bg: '#10D98B', dark: '#0A915D', text: '#0A1913', nameEn: 'GREEN', nameZh: '绿' },
  wild: { bg: '#7C3AED', dark: '#4C1D95', text: '#FFFFFF', nameEn: 'WILD', nameZh: '万能' },
};

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
  handCollapsed = false,
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

  const renderSituationBar = () => {
    if (!pocketOverlay || !situation) return null;
    const summaryText = situation.tableSummary
      ? translateGameText(situation.tableSummary, lang)
      : situation.banner
      ? translateGameText(situation.banner, lang)
      : '';

    return (
      <div className="pointer-events-auto flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl bg-[#0D1018]/88 border border-white/12 backdrop-blur-sm shrink-0">
        {/* Table State Summary */}
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          {situation.tableBadge && (
            <span
              className="px-2 py-0.5 rounded-md font-mono text-[10px] font-black tracking-tight shrink-0 shadow-sm"
              style={{
                backgroundColor: situation.tableBadge.bg,
                color: situation.tableBadge.fg,
              }}
            >
              {translateGameText(situation.tableBadge.text, lang)}
            </span>
          )}
          {summaryText ? (
            <span className="text-[11px] font-bold text-[#E5E7EB] truncate">
              {summaryText}
            </span>
          ) : situation.activePlayerName ? (
            <span className="text-[11px] font-bold text-[#E5E7EB] truncate">
              {t('Turn:', '回合:')}{' '}
              <span style={{ color: situation.activePlayerColor ?? '#FFB800' }}>
                {situation.activePlayerName}
              </span>
            </span>
          ) : null}
        </div>

        {/* Live Players Hand/Score Status Strip */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0 max-w-[58%]">
          {situation.players.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] leading-none whitespace-nowrap transition-colors ${
                p.isActive
                  ? 'bg-[#1F2937] border-[#FFB800] text-white shadow-[0_0_8px_rgba(255,184,0,0.35)]'
                  : p.isMe
                  ? 'bg-white/10 border-white/25 text-white'
                  : 'bg-[#121620]/90 border-white/10 text-[#9CA3AF]'
              } ${p.alive === false ? 'opacity-45 line-through' : ''}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  p.isActive ? 'animate-pulse' : ''
                }`}
                style={{ backgroundColor: p.colorHex }}
              />
              <span className="font-bold max-w-[52px] truncate">
                {p.isMe ? t('You', '你') : p.name}
              </span>
              <span className="font-mono font-black text-[#F8FAFC] tabular-nums">
                {translateGameText(p.stat, lang)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

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
  const isColorClash =
    cardState.gameId === 'color-clash' || cardState.gameId === 'dark-flip-clash';
  const isLiarsDeck = cardState.gameId === 'liars-deck';
  const activeColorSpec = cardState.activeColor ? CLASH_STYLE[cardState.activeColor] : null;
  const highlightedCard = cardState.hand[cardState.cursorIndex];
  const selectedLiarCount = cardState.hand.filter((c) => c.selected).length;
  const effectiveView: 'fan' | 'grid' =
    viewMode === 'auto' ? recommendedView : viewMode;
  const isMaskActive = privacyShield && !peeking;
  const handMid = (sortedEntries.length - 1) / 2;

  // Compact overlap spacing for larger pocket hands so more cards are immediately visible
  const pocketOverlapMargin =
    pocketOverlay && effectiveView === 'fan'
      ? sortedEntries.length >= 12
        ? '-ml-4 sm:-ml-3'
        : sortedEntries.length >= 7
        ? '-ml-2.5 sm:-ml-1.5'
        : ''
      : '';

  const renderHandCards = () => {
    if (sortedEntries.length === 0) {
      const hintText =
        lang === 'zh'
          ? translateGameText(cardState.statusHintZh || cardState.statusHint, lang)
          : cardState.statusHint;
      return (
        <div className="col-span-full w-full text-center px-2 py-2 self-center">
          <div className="text-xs font-bold text-[#E2E8F0]">
            {hintText || t('Waiting on table round...', '等待本轮牌局结果...')}
          </div>
        </div>
      );
    }

    return sortedEntries.map(({ card, originalIndex }, idx) => {
      const fanOffset = idx - handMid;
      const fanRot =
        effectiveView === 'grid'
          ? 0
          : pocketOverlay
          ? Math.max(-6, Math.min(6, fanOffset * 1.1))
          : fanOffset * 1.65;
      const fanDrop =
        effectiveView === 'grid'
          ? 0
          : pocketOverlay
          ? Math.min(4, Math.abs(fanOffset) * 0.8)
          : Math.min(8, Math.abs(fanOffset) * 1.4);
      const freshOrder = freshCardOrder[card.id];
      const isThrowing = throwingCardId === card.id;
      const overlapCls = idx > 0 ? pocketOverlapMargin : '';

      if (card.kind === 'clash') {
        const colKey: CardColor = card.color ?? 'red';
        const spec = CLASH_STYLE[colKey];
        const isHighlighted = originalIndex === cardState.cursorIndex;
        const canTapPlay = cardState.isMyTurn && card.playable;
        const val = card.value ?? '?';

        const restTransform = isThrowing
          ? 'translate3d(0, -34px, 0) scale(0.86) rotate(4deg)'
          : canTapPlay
          ? 'translate3d(0, -6px, 0) scale(1.03) rotate(0deg)'
          : isHighlighted
          ? `translate3d(0, ${fanDrop - 2}px, 0) rotate(${fanRot * 0.5}deg)`
          : `translate3d(0, ${fanDrop}px, 0) rotate(${fanRot}deg)`;

        const displayVal = lang === 'zh' ? translateGameText(val, lang) : val;
        const isZhTranslated = lang === 'zh' && displayVal !== val;
        return (
          <div
            key={card.id}
            className={`shrink-0 ${overlapCls} ${canTapPlay || isHighlighted ? 'relative z-10' : 'relative'} ${
              freshOrder !== undefined ? 'card-deal-anim' : ''
            }`}
            style={
              freshOrder !== undefined
                ? { animationDelay: `${Math.min(280, freshOrder * 45)}ms` }
                : undefined
            }
          >
            <button
              type="button"
              onClick={() => {
                if (canTapPlay) {
                  triggerPlayWithThrowAnim(card.id);
                } else {
                  onAction({ type: 'select-index', index: originalIndex });
                }
              }}
              className={`card-hand-item relative rounded-xl flex flex-col items-center justify-between p-1.5 select-none cursor-pointer ${
                embedded
                  ? 'w-14 h-20'
                  : pocketOverlay
                  ? 'w-[60px] h-[84px] sm:w-[68px] sm:h-[96px]'
                  : 'w-[68px] h-[98px] sm:w-[76px] sm:h-[110px]'
              } ${
                canTapPlay
                  ? 'ring-2 ring-white shadow-[0_6px_16px_rgba(255,255,255,0.28)] hover:brightness-110 active:scale-95'
                  : isHighlighted
                  ? 'ring-2 ring-white/65 opacity-95'
                  : cardState.isMyTurn
                  ? 'opacity-80 brightness-90'
                  : 'opacity-90'
              }`}
              style={{
                transform: restTransform,
                opacity: isThrowing ? 0.15 : undefined,
                background:
                  colKey === 'wild'
                    ? 'linear-gradient(135deg, #FF4D2E 0%, #FFB800 35%, #10D98B 70%, #00C2FF 100%)'
                    : spec.bg,
                color: colKey === 'wild' ? '#FFFFFF' : spec.text,
                boxShadow: `0 4px 0 ${spec.dark}, -2px 0 6px rgba(0,0,0,0.35)`,
              }}
            >
              <span className="self-start font-mono text-[11px] font-black leading-none drop-shadow">
                {displayVal}
              </span>
              <span
                className={`font-display font-black leading-none drop-shadow text-center ${
                  isZhTranslated
                    ? displayVal.length >= 4
                      ? 'text-xs sm:text-sm'
                      : 'text-sm sm:text-base'
                    : val.length >= 6
                    ? 'text-[11px] sm:text-xs'
                    : val.length >= 4
                    ? 'text-xs sm:text-sm'
                    : val.length >= 2
                    ? 'text-lg sm:text-xl'
                    : 'text-2xl sm:text-3xl'
                }`}
              >
                {displayVal}
              </span>
              <span className="self-end font-mono text-[10px] font-black leading-none drop-shadow">
                {displayVal}
              </span>
            </button>
          </div>
        );
      }

      if (card.kind === 'party') {
        const accent = card.accentHex ?? '#FFB800';
        const dark = card.secondaryHex ?? '#0F172A';
        const isHighlighted = originalIndex === cardState.cursorIndex;
        const canTapPlay = cardState.isMyTurn && card.playable;
        const partyTransform = isThrowing
          ? 'translate3d(0, -34px, 0) scale(0.86) rotate(4deg)'
          : canTapPlay
          ? 'translate3d(0, -6px, 0) scale(1.03) rotate(0deg)'
          : isHighlighted
          ? `translate3d(0, ${fanDrop - 2}px, 0) rotate(${fanRot * 0.4}deg)`
          : `translate3d(0, ${fanDrop}px, 0) rotate(${fanRot}deg)`;

        return (
          <div
            key={card.id}
            className={`shrink-0 ${overlapCls} ${canTapPlay || isHighlighted ? 'relative z-10' : 'relative'} ${
              freshOrder !== undefined ? 'card-deal-anim' : ''
            }`}
            style={
              freshOrder !== undefined
                ? { animationDelay: `${Math.min(280, freshOrder * 45)}ms` }
                : undefined
            }
          >
            <button
              type="button"
              onClick={() => {
                if (canTapPlay) {
                  triggerPlayWithThrowAnim(card.id);
                } else {
                  onAction({ type: 'select-index', index: originalIndex });
                }
              }}
              className={`card-hand-item relative rounded-xl flex flex-col items-center justify-between p-1.5 text-center select-none cursor-pointer ${
                embedded
                  ? 'w-16 h-22'
                  : pocketOverlay
                  ? 'w-[70px] h-[86px] sm:w-[80px] sm:h-[98px]'
                  : 'w-[76px] h-[104px] sm:w-[86px] sm:h-[116px]'
              } ${
                canTapPlay
                  ? 'ring-2 ring-white shadow-[0_6px_16px_rgba(255,255,255,0.28)] hover:brightness-110 active:scale-95'
                  : isHighlighted
                  ? 'ring-2 ring-white/60 opacity-95'
                  : 'opacity-90'
              }`}
              style={{
                transform: partyTransform,
                opacity: isThrowing ? 0.15 : undefined,
                background: `linear-gradient(155deg, ${accent} 0%, ${dark} 100%)`,
                color: '#FFFFFF',
                boxShadow: '0 4px 0 rgba(0,0,0,0.5), -2px 0 6px rgba(0,0,0,0.35)',
              }}
            >
              <span className="self-start px-1.5 py-0.5 rounded bg-black/50 font-mono text-[9px] font-black leading-none max-w-full truncate">
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

      // Standard Playing Card (Liar's Deck, Big Two, Landlord Clash, Poker, Rummy, Blackjack, etc.)
      const sym = suitSymbol(card.suit);
      const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
      const isJoker = card.rank === 'JOKER';
      const isSelected = card.selected;
      const isCursor = originalIndex === cardState.cursorIndex;

      const liarTransform = isSelected
        ? 'translate3d(0, -8px, 0) scale(1.04) rotate(0deg)'
        : isCursor
        ? `translate3d(0, ${fanDrop - 2}px, 0) rotate(${fanRot * 0.5}deg)`
        : `translate3d(0, ${fanDrop}px, 0) rotate(${fanRot}deg)`;

      return (
        <div
          key={card.id}
          className={`shrink-0 ${overlapCls} ${isSelected || isCursor ? 'relative z-10' : 'relative'} ${
            freshOrder !== undefined ? 'card-deal-anim' : ''
          }`}
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
            className={`card-hand-item relative rounded-xl flex flex-col items-center justify-between p-1.5 select-none cursor-pointer bg-[#F8FAFC] border-2 active:scale-95 ${
              embedded
                ? 'w-14 h-20'
                : pocketOverlay
                ? 'w-[60px] h-[84px] sm:w-[68px] sm:h-[96px]'
                : 'w-[66px] h-[96px] sm:w-[74px] sm:h-[108px]'
            } ${
              isSelected
                ? 'border-[#FFB800] ring-2 ring-[#FFB800] shadow-[0_6px_16px_rgba(255,184,0,0.45)]'
                : isCursor
                ? 'border-[#00C2FF]'
                : 'border-[#CBD5E1]'
            }`}
            style={{
              transform: liarTransform,
              color: isJoker ? '#7C3AED' : isRed ? '#DC2626' : '#0F172A',
              boxShadow: isSelected
                ? '0 4px 0 #B58100, -2px 0 6px rgba(0,0,0,0.35)'
                : '0 4px 0 #94A3B8, -2px 0 6px rgba(0,0,0,0.3)',
            }}
          >
            {isSelected && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#FFB800] text-[#14120B] flex items-center justify-center shadow z-20">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            )}
            <div className="self-start flex flex-col items-center leading-none">
              <span className="font-mono text-[11px] font-black leading-none">
                {isJoker ? '★' : card.rank}
              </span>
              <span className="text-[10px] leading-none mt-0.5">{sym}</span>
            </div>
            <div className="flex flex-col items-center leading-none">
              <span className="text-xl sm:text-2xl font-black">{sym}</span>
              <span className="font-mono text-[11px] font-black mt-0.5">
                {card.rank}
              </span>
            </div>
            <span className="self-end font-mono text-[10px] font-black leading-none opacity-80">
              {sym}
            </span>
          </button>
        </div>
      );
    });
  };

  const renderActionButtons = () => {
    if (cardState.extraActions && cardState.extraActions.length > 0) {
      return (
        <div className="flex-1 grid grid-cols-1 gap-1.5 min-h-0">
          {cardState.extraActions.map((btn, i) => (
            <button
              key={`${btn.label}_${i}`}
              type="button"
              disabled={btn.disabled}
              onClick={() => onAction(btn.action)}
              className="tactile-btn min-h-[34px] rounded-xl px-2 py-1 font-display font-black text-[11px] sm:text-xs text-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
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
          {cardState.primaryBtn && (
            <button
              type="button"
              disabled={cardState.primaryBtn.disabled}
              onClick={() => onAction(cardState.primaryBtn!.action)}
              className="tactile-btn flex-1 min-h-[40px] rounded-xl px-2 font-display font-black text-xs sm:text-sm flex items-center justify-center text-center leading-tight cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              style={{
                backgroundColor: cardState.primaryBtn.colorHex,
                color: cardState.primaryBtn.textColor ?? '#FFFFFF',
                boxShadow: '0 4px 0 rgba(0,0,0,0.45)',
              }}
            >
              <span>
                {lang === 'zh'
                  ? translateGameText(cardState.primaryBtn.labelZh || cardState.primaryBtn.label, lang)
                  : cardState.primaryBtn.label}
              </span>
            </button>
          )}
          {cardState.secondaryBtn && (
            <button
              type="button"
              disabled={cardState.secondaryBtn.disabled}
              onClick={() => onAction(cardState.secondaryBtn!.action)}
              className="tactile-btn flex-1 min-h-[38px] rounded-xl px-2 font-display font-black text-xs sm:text-sm flex items-center justify-center text-center leading-tight cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              style={{
                backgroundColor: cardState.secondaryBtn.colorHex,
                color: cardState.secondaryBtn.textColor ?? '#0A1913',
                boxShadow: '0 4px 0 rgba(0,0,0,0.4)',
              }}
            >
              <span>
                {lang === 'zh'
                  ? translateGameText(cardState.secondaryBtn.labelZh || cardState.secondaryBtn.label, lang)
                  : cardState.secondaryBtn.label}
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
            disabled={!cardState.isMyTurn || !highlightedCard?.playable}
            onClick={() => highlightedCard && triggerPlayWithThrowAnim(highlightedCard.id)}
            className="tactile-btn flex-1 min-h-[42px] rounded-xl font-display font-black text-xs sm:text-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#10D98B',
              color: '#0A1913',
              boxShadow: '0 4px 0 #0A915D',
            }}
          >
            <Flame className="w-4 h-4" />
            <span>{t('PLAY', '出牌')}</span>
          </button>
          <button
            type="button"
            disabled={!cardState.isMyTurn}
            onClick={() => onAction({ type: 'draw-or-pass' })}
            className="tactile-btn flex-1 min-h-[40px] rounded-xl font-display font-black text-xs sm:text-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#FFB800',
              color: '#14120B',
              boxShadow: '0 4px 0 #B58100',
            }}
          >
            <span>
              {(cardState.drawPenalty ?? 0) > 0
                ? `${t('TAKE', '罚抽')} +${cardState.drawPenalty}`
                : t('DRAW 1', '摸 1 张')}
            </span>
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
            className="tactile-btn flex-1 min-h-[42px] rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-black text-xs sm:text-sm shadow-[0_4px_0_#B82E17] flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{t('CALL BLUFF!', '抓谎！')}</span>
          </button>
          <button
            type="button"
            disabled={!cardState.canTrust}
            onClick={() => onAction({ type: 'trust-claim' })}
            className="tactile-btn flex-1 min-h-[40px] rounded-xl bg-[#10D98B] text-[#0A1913] font-display font-black text-xs sm:text-sm shadow-[0_4px_0_#0A915D] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-45"
          >
            <Check className="w-4 h-4" />
            <span>{t('TRUST', '信任跳过')}</span>
          </button>
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          disabled={!cardState.isMyTurn || cardState.hand.length === 0}
          onClick={() => onAction({ type: 'submit-selected' })}
          className="tactile-btn flex-1 min-h-[42px] rounded-xl font-display font-black text-xs sm:text-sm flex flex-col items-center justify-center leading-tight cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: playerColorHex,
            color: '#FFFFFF',
            boxShadow: '0 4px 0 rgba(0,0,0,0.45)',
          }}
        >
          <span>
            {selectedLiarCount > 0
              ? t(`PLAY ${selectedLiarCount}`, `扣出 ${selectedLiarCount} 张`)
              : t('PLAY CARD', '出 1 张暗牌')}
          </span>
          <span className="text-[10px] opacity-85 font-mono">
            {t(`Claim ${cardState.targetRank ?? 'A'}`, `声称 ${cardState.targetRank ?? 'A'}`)}
          </span>
        </button>
        <button
          type="button"
          disabled={!cardState.isMyTurn}
          onClick={() => onAction({ type: 'draw-or-pass' })}
          className="tactile-btn h-9 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] font-bold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('Pass Turn', '过牌')}
        </button>
      </>
    );
  };

  // =========================================================================
  // POCKET MODE TURN-DRIVEN CAMERA & HAND VIEW:
  //   - Opponent Turn (default): Full unobstructed table overview + auto-hidden
  //     hand strip with quick "Show Hand" toggle
  //   - My Turn (or manual Show Hand): Focused center table + top situation bar
  //     + spacious Bottom Card Hand & Side Actions
  // =========================================================================
  if (pocketOverlay) {
    const hintText =
      lang === 'zh'
        ? translateGameText(cardState.statusHintZh || cardState.statusHint, lang)
        : cardState.statusHint;
    const isTurnActiveNow = Boolean(cardState.isActionRequired || cardState.isMyTurn);

    return (
      <div className="flex-1 flex flex-col justify-between gap-1 min-h-0 relative z-10 pointer-events-none">
        {/* 1. Top Situation Bar (only shown in Turn Focus / Hand Open so Full Table stays clean!) */}
        {!handCollapsed && renderSituationBar()}

        {/* 2. Open Table Camera Viewport */}
        <div className="flex-1 min-h-0" />

        {/* 3. Auto-Hidden Overview Dock (Opponent Turn) OR Active Turn Card Hand + Actions */}
        {handCollapsed ? (
          <div className="pointer-events-auto flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#0D1017]/92 border border-white/15 backdrop-blur-sm shrink-0 shadow-lg">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`px-2 py-0.5 rounded font-mono text-[10px] font-black tabular-nums shrink-0 inline-flex items-center gap-1.5 ${
                  isDanger
                    ? 'bg-[#FF3B30] text-white animate-pulse'
                    : isTurnActiveNow
                    ? 'bg-[#10D98B] text-[#0A1913]'
                    : 'bg-[#1C2230] text-[#E5E7EB] border border-white/10'
                }`}
              >
                {!isTurnActiveNow && situation?.activePlayerColor && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: situation.activePlayerColor }}
                  />
                )}
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
                  className="px-1.5 py-0.5 rounded font-mono text-[10px] font-black shrink-0"
                  style={{
                    backgroundColor: situation.tableBadge.bg,
                    color: situation.tableBadge.fg,
                  }}
                >
                  {translateGameText(situation.tableBadge.text, lang)}
                </span>
              )}

              <span className="text-xs font-bold text-white truncate">{hintText}</span>

              {!isTurnActiveNow && (
                <span className="hidden md:inline text-[10px] font-medium text-[#9CA3AF] whitespace-nowrap shrink-0">
                  · {t('Hand auto-hidden', '等待时已自动隐藏手牌')}
                </span>
              )}
            </div>

            {onToggleHandCollapsed && (
              <button
                type="button"
                onClick={onToggleHandCollapsed}
                className={`h-8 px-3 rounded-lg font-display font-black text-xs inline-flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap active:scale-95 transition-transform ${
                  isTurnActiveNow
                    ? 'bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913]'
                    : 'bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B]'
                }`}
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isTurnActiveNow
                    ? t(`Play Hand (${cardState.hand.length})`, `出牌 (${cardState.hand.length})`)
                    : t(`Show Hand (${cardState.hand.length})`, `查看手牌 (${cardState.hand.length})`)}
                </span>
              </button>
            )}
          </div>
        ) : isColorClash && cardState.awaitingColorPick ? (
          <div className="pointer-events-auto rounded-2xl bg-[#0D1017]/90 border border-white/18 p-2 backdrop-blur-sm shrink-0 space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-extrabold text-[#FFB800]">{hintText}</span>
              <span className="font-mono text-xs font-black text-white">{timeSecs}s</span>
            </div>
            <div className="grid grid-cols-4 gap-2 h-16 sm:h-20">
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
          </div>
        ) : (
          <div
            className={`flex items-stretch gap-2 shrink-0 pointer-events-none ${
              actionsSide === 'left' ? 'flex-row-reverse' : 'flex-row'
            }`}
          >
            {/* Card Hand Overlay Panel */}
            <div
              className="pointer-events-auto relative flex-1 flex flex-col rounded-2xl border border-white/18 min-w-0 backdrop-blur-sm"
              style={{
                backgroundColor: `rgba(13, 16, 23, ${Math.max(0.58, Math.min(0.92, hudOpacity + 0.08))})`,
              }}
            >
              {/* Unified Turn Status + Card Toolbar (1 compact row) */}
              <div
                className={`flex items-center justify-between gap-2 px-2.5 py-1 border-b rounded-t-2xl shrink-0 transition-colors ${
                  isDanger
                    ? 'bg-[#FF3B30]/30 border-[#FF3B30]/70'
                    : cardState.isActionRequired
                    ? 'bg-[#10D98B]/18 border-[#10D98B]/45'
                    : 'bg-black/35 border-white/10'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-black tabular-nums shrink-0 ${
                      isDanger
                        ? 'bg-[#FF3B30] text-white animate-pulse'
                        : cardState.isActionRequired
                        ? 'bg-[#10D98B] text-[#0A1913]'
                        : 'bg-[#242A36] text-[#D1D5DB]'
                    }`}
                  >
                    {cardState.isActionRequired
                      ? isDanger
                        ? `${t('HURRY!', '快出!')} ${timeSecs}s`
                        : `${t('TURN', '出牌')} ${timeSecs}s`
                      : `${timeSecs}s`}
                  </span>

                  {isColorClash && activeColorSpec ? (
                    <span
                      className="px-1.5 py-0.5 rounded font-mono text-[10px] font-black shrink-0"
                      style={{ backgroundColor: activeColorSpec.bg, color: activeColorSpec.text }}
                    >
                      {lang === 'zh' ? activeColorSpec.nameZh : activeColorSpec.nameEn}
                    </span>
                  ) : cardState.targetRank ? (
                    <span className="px-1.5 py-0.5 rounded bg-[#FFB800] text-[#14120B] font-mono text-[10px] font-black shrink-0">
                      {t('TARGET:', '目标:')} {cardState.targetRank}
                    </span>
                  ) : null}

                  {isColorClash && (cardState.drawPenalty ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-[#FF4D2E] text-white font-mono text-[10px] font-black shrink-0">
                      +{cardState.drawPenalty}
                    </span>
                  )}

                  <span className="text-[11px] font-bold text-white truncate">
                    {hintText}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {onChangeViewMode && (
                    <button
                      type="button"
                      onClick={() => onChangeViewMode(effectiveView === 'fan' ? 'grid' : 'fan')}
                      title={
                        effectiveView === 'fan'
                          ? t('Expand All Cards Grid', '展开全部手牌网格')
                          : t('Switch to Fan Strip', '切回扇形手牌条')
                      }
                      className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                        effectiveView === 'grid'
                          ? 'bg-[#FFB800] border-[#FFB800] text-[#14120B]'
                          : 'bg-[#181C26] border-[#2A303D] text-[#D1D5DB] hover:text-white'
                      }`}
                    >
                      <LayoutGrid className="w-2.5 h-2.5" />
                      <span>
                        {effectiveView === 'grid'
                          ? t('Fan', '收起')
                          : t(`All (${cardState.hand.length})`, `全览(${cardState.hand.length})`)}
                      </span>
                    </button>
                  )}

                  {onCycleSortMode && (
                    <button
                      type="button"
                      onClick={onCycleSortMode}
                      title={t('Sort Hand', '智能理牌')}
                      className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                        sortMode !== 'server'
                          ? 'bg-[#00C2FF]/20 border-[#00C2FF]/60 text-[#00C2FF]'
                          : 'bg-[#181C26] border-[#2A303D] text-[#D1D5DB] hover:text-white'
                      }`}
                    >
                      <ArrowDownUp className="w-2.5 h-2.5" />
                      <span className="hidden sm:inline">
                        {sortMode === 'playable'
                          ? t('Playable', '可出')
                          : sortMode === 'rank'
                          ? t('Rank', '点数')
                          : t('Sort', '理牌')}
                      </span>
                    </button>
                  )}

                  {onTogglePrivacy && (
                    <button
                      type="button"
                      onClick={onTogglePrivacy}
                      title={t('Toggle Privacy Cover', '切换防偷窥盖牌')}
                      className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                        privacyShield
                          ? 'bg-[#FFB800]/20 border-[#FFB800] text-[#FFB800]'
                          : 'bg-[#181C26] border-[#2A303D] text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {privacyShield ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                    </button>
                  )}

                  {onToggleHandCollapsed && (
                    <button
                      type="button"
                      onClick={onToggleHandCollapsed}
                      title={
                        isTurnActiveNow
                          ? t('Collapse hand to view full table', '收起手牌查看完整牌桌')
                          : t('Hide hand and return to full table', '隐藏手牌回到全桌视角')
                      }
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                        !isTurnActiveNow
                          ? 'bg-[#00C2FF]/20 border-[#00C2FF] text-[#00C2FF] hover:bg-[#00C2FF]/30'
                          : 'bg-[#181C26] border-[#2A303D] text-[#00C2FF] hover:text-white'
                      }`}
                    >
                      {!isTurnActiveNow ? (
                        <>
                          <EyeOff className="w-2.5 h-2.5 shrink-0" />
                          <span>{t('Hide Hand', '收起手牌')}</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="w-2.5 h-2.5 shrink-0" />
                          <span className="hidden sm:inline">{t('Full Table', '看全桌')}</span>
                        </>
                      )}
                    </button>
                  )}

                  {onFlipActionsSide && (
                    <button
                      type="button"
                      onClick={onFlipActionsSide}
                      title={t('Swap Action Buttons Left/Right', '左右切换操作按钮位置')}
                      className="px-1.5 py-0.5 rounded-md bg-[#181C26] border border-[#2A303D] text-[10px] font-bold text-[#9CA3AF] hover:text-white inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Cards Area (with generous vertical clearance so lifted cards never clip!) */}
              {isMaskActive ? (
                <div
                  onPointerDown={() => setPeeking(true)}
                  onPointerUp={() => setPeeking(false)}
                  onPointerCancel={() => setPeeking(false)}
                  onPointerLeave={() => setPeeking(false)}
                  onContextMenu={(e) => e.preventDefault()}
                  className="min-h-[104px] flex flex-col items-center justify-center p-3 text-center touch-none select-none cursor-pointer bg-[#121620]/85 rounded-b-2xl hover:bg-[#161B28]"
                >
                  <EyeOff className="w-6 h-6 text-[#FFB800] mb-1" />
                  <div className="font-display font-extrabold text-xs sm:text-sm text-white">
                    {t('Cards Hidden · Hold Here to Peek', '手牌已遮盖防偷窥 · 按住此处查看')}
                  </div>
                  <div className="text-[10px] text-[#9CA3AF]">
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
                      ? 'max-h-[45dvh] overflow-y-auto arcade-scrollbar grid grid-cols-5 sm:grid-cols-7 gap-2 px-2.5 pt-3 pb-2.5 content-start justify-items-center'
                      : 'flex items-end overflow-x-auto arcade-scrollbar px-3 pt-3 pb-2 min-h-[102px] sm:min-h-[114px]'
                  }
                >
                  {renderHandCards()}
                </div>
              )}

              {privacyShield && !isMaskActive && (
                <div className="shrink-0 h-5 bg-[#FFB800]/15 border-t border-[#FFB800]/35 text-[10px] font-bold text-[#FFB800] flex items-center justify-center rounded-b-2xl">
                  {t('Release finger to hide cards again', '松开手指即刻隐藏手牌')}
                </div>
              )}
            </div>

            {/* Side Action Buttons Beside Card Hand Overlay */}
            <div className="pointer-events-auto flex flex-col justify-center gap-1.5 shrink-0 w-[112px] sm:w-[136px] self-stretch">
              {renderActionButtons()}
            </div>
          </div>
        )}
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
          <div className="relative flex-1 flex flex-col rounded-2xl border bg-[#0F131A]/85 border-[#242B38] min-w-0 overflow-hidden">
            {/* Compact Pad 4 Card Toolbar */}
            <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 border-b border-[#1E2430] bg-[#131722] shrink-0">
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
