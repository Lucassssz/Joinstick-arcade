import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Flame, ShieldAlert, Sparkles } from 'lucide-react';
import { CardClientAction, CardColor, CardPrivateHandItem, CardPrivateState } from '../shared/types';
import { useLanguage } from '../lib/i18n';

interface CardControllerDeckProps {
  cardState: CardPrivateState | null;
  playerColorHex: string;
  embedded?: boolean;
  isCountdown?: boolean;
  countdownValue?: number;
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
  isCountdown = false,
  countdownValue = 0,
  onAction,
}: CardControllerDeckProps) {
  const { lang, t } = useLanguage();
  const seenCardIdsRef = useRef<Set<string>>(new Set());
  const [freshCardOrder, setFreshCardOrder] = useState<Record<string, number>>({});
  const [throwingCardId, setThrowingCardId] = useState<string | null>(null);
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
    // Prune played cards from seen set
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

  if (!cardState) {
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
  const handMid = (cardState.hand.length - 1) / 2;

  return (
    <div className="flex-1 flex flex-col justify-between gap-2 min-h-0">
      {/* Status Banner + Target / Active Color / Party Info + Shot-Clock */}
      <div
        className={`flex items-center justify-between gap-2 px-3 rounded-xl border shrink-0 transition-colors duration-150 ${
          embedded ? 'py-1.5' : 'py-2'
        } ${
          isDanger
            ? 'bg-[#FF3B30]/20 border-[#FF3B30] animate-pulse'
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
              {cardState.badgeText}
            </span>
          ) : null}

          <span className="text-xs sm:text-sm font-bold text-white truncate">
            {lang === 'zh' ? cardState.statusHintZh : cardState.statusHint}
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
        /* Fanned Card Hand + Right Action Column */
        <div className="flex-1 flex items-stretch gap-2.5 min-h-0">
          {/* Private Card Hand */}
          <div className="flex-1 flex items-center gap-1.5 sm:gap-2 overflow-x-auto px-2.5 py-2.5 rounded-2xl bg-[#0F131A]/85 border border-[#242B38] min-w-0">
            {cardState.hand.length === 0 ? (
              <div className="w-full text-center text-xs font-bold text-[#10D98B]">
                {t('Empty hand — waiting on final check!', '手牌已空 — 等待最终判定！')}
              </div>
            ) : (
              cardState.hand.map((card, idx) => {
                const fanOffset = idx - handMid;
                const fanRot = fanOffset * 1.65;
                const fanDrop = Math.min(8, Math.abs(fanOffset) * 1.4);
                const freshOrder = freshCardOrder[card.id];
                const isThrowing = throwingCardId === card.id;

                if (card.kind === 'clash') {
                  const colKey: CardColor = card.color ?? 'red';
                  const spec = CLASH_STYLE[colKey];
                  const isHighlighted = idx === cardState.cursorIndex;
                  const canTapPlay = cardState.isMyTurn && card.playable;
                  const val = card.value ?? '?';

                  const restTransform = isThrowing
                    ? 'translate3d(0, -34px, 0) scale(0.86) rotate(4deg)'
                    : canTapPlay
                    ? 'translate3d(0, -8px, 0) scale(1.04) rotate(0deg)'
                    : isHighlighted
                    ? `translate3d(0, ${fanDrop - 3}px, 0) rotate(${fanRot * 0.5}deg)`
                    : `translate3d(0, ${fanDrop}px, 0) rotate(${fanRot}deg)`;

                  return (
                    <div
                      key={card.id}
                      className={`shrink-0 ${freshOrder !== undefined ? 'card-deal-anim' : ''}`}
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
                            onAction({ type: 'select-index', index: idx });
                          }
                        }}
                        className={`card-hand-item relative rounded-xl flex flex-col items-center justify-between p-1.5 select-none cursor-pointer ${
                          embedded ? 'w-14 h-20' : 'w-[68px] h-[98px] sm:w-[76px] sm:h-[110px]'
                        } ${
                          canTapPlay
                            ? 'ring-2 ring-white shadow-[0_8px_18px_rgba(255,255,255,0.22)] hover:brightness-110 active:scale-95'
                            : isHighlighted
                            ? 'ring-2 ring-white/55 opacity-85'
                            : cardState.isMyTurn
                            ? 'opacity-45'
                            : 'opacity-80'
                        }`}
                        style={{
                          transform: restTransform,
                          opacity: isThrowing ? 0.15 : undefined,
                          background:
                            colKey === 'wild'
                              ? 'linear-gradient(135deg, #FF4D2E 0%, #FFB800 35%, #10D98B 70%, #00C2FF 100%)'
                              : spec.bg,
                          color: colKey === 'wild' ? '#FFFFFF' : spec.text,
                          boxShadow: `0 4px 0 ${spec.dark}`,
                        }}
                      >
                        <span className="self-start font-mono text-[10px] font-black leading-none drop-shadow">
                          {val}
                        </span>
                        <span
                          className={`font-display font-black leading-none drop-shadow text-center ${
                            val.length >= 6
                              ? 'text-[11px] sm:text-xs'
                              : val.length >= 4
                              ? 'text-xs sm:text-sm'
                              : val.length >= 2
                              ? 'text-lg sm:text-xl'
                              : 'text-2xl sm:text-3xl'
                          }`}
                        >
                          {val}
                        </span>
                        <span className="self-end font-mono text-[10px] font-black leading-none drop-shadow">
                          {val}
                        </span>
                      </button>
                    </div>
                  );
                }

                // Stylized Party Card (Boom Kittens, Property Deal, Flip Seven, Royal Bluff, Sushi Draft)
                if (card.kind === 'party') {
                  const accent = card.accentHex ?? '#FFB800';
                  const dark = card.secondaryHex ?? '#0F172A';
                  const isHighlighted = idx === cardState.cursorIndex;
                  const canTapPlay = cardState.isMyTurn && card.playable;
                  const partyTransform = isThrowing
                    ? 'translate3d(0, -34px, 0) scale(0.86) rotate(4deg)'
                    : canTapPlay
                    ? 'translate3d(0, -7px, 0) scale(1.04) rotate(0deg)'
                    : isHighlighted
                    ? `translate3d(0, ${fanDrop - 3}px, 0) rotate(${fanRot * 0.4}deg)`
                    : `translate3d(0, ${fanDrop}px, 0) rotate(${fanRot}deg)`;

                  return (
                    <div
                      key={card.id}
                      className={`shrink-0 ${freshOrder !== undefined ? 'card-deal-anim' : ''}`}
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
                            onAction({ type: 'select-index', index: idx });
                          }
                        }}
                        className={`card-hand-item relative rounded-xl flex flex-col items-center justify-between p-1.5 text-center select-none cursor-pointer ${
                          embedded ? 'w-16 h-22' : 'w-[76px] h-[104px] sm:w-[86px] sm:h-[116px]'
                        } ${
                          canTapPlay
                            ? 'ring-2 ring-white shadow-[0_8px_18px_rgba(255,255,255,0.22)] hover:brightness-110 active:scale-95'
                            : isHighlighted
                            ? 'ring-2 ring-white/55 opacity-95'
                            : 'opacity-85'
                        }`}
                        style={{
                          transform: partyTransform,
                          opacity: isThrowing ? 0.15 : undefined,
                          background: `linear-gradient(155deg, ${accent} 0%, ${dark} 100%)`,
                          color: '#FFFFFF',
                          boxShadow: `0 4px 0 rgba(0,0,0,0.5)`,
                        }}
                      >
                        <span className="self-start px-1.5 py-0.5 rounded bg-black/45 font-mono text-[9px] font-black leading-none">
                          {card.badge ?? 'CARD'}
                        </span>
                        <span className="font-display font-black text-[11px] sm:text-xs leading-tight drop-shadow px-0.5">
                          {card.title ?? ''}
                        </span>
                        <span className="font-sans text-[9px] font-bold text-white/85 leading-tight line-clamp-2">
                          {card.subtitle ?? ''}
                        </span>
                      </button>
                    </div>
                  );
                }

                // Liar's Deck Standard Playing Card
                const sym = suitSymbol(card.suit);
                const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
                const isJoker = card.rank === 'JOKER';
                const isSelected = card.selected;
                const isCursor = idx === cardState.cursorIndex;

                const liarTransform = isSelected
                  ? 'translate3d(0, -11px, 0) scale(1.06) rotate(0deg)'
                  : isCursor
                  ? `translate3d(0, ${fanDrop - 3}px, 0) rotate(${fanRot * 0.5}deg)`
                  : `translate3d(0, ${fanDrop}px, 0) rotate(${fanRot}deg)`;

                return (
                  <div
                    key={card.id}
                    className={`shrink-0 ${freshOrder !== undefined ? 'card-deal-anim' : ''}`}
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
                          onAction({ type: 'select-index', index: idx });
                        }
                      }}
                      className={`card-hand-item relative rounded-xl flex flex-col items-center justify-between p-1.5 select-none cursor-pointer bg-[#F8FAFC] border-2 active:scale-95 ${
                        embedded ? 'w-14 h-20' : 'w-[66px] h-[96px] sm:w-[74px] sm:h-[108px]'
                      } ${
                        isSelected
                          ? 'border-[#FFB800] ring-2 ring-[#FFB800] shadow-[0_8px_18px_rgba(255,184,0,0.45)]'
                          : isCursor
                          ? 'border-[#00C2FF]'
                          : 'border-[#CBD5E1]'
                      }`}
                      style={{
                        transform: liarTransform,
                        color: isJoker ? '#7C3AED' : isRed ? '#DC2626' : '#0F172A',
                        boxShadow: isSelected ? '0 5px 0 #B58100' : '0 4px 0 #94A3B8',
                      }}
                    >
                      {isSelected && (
                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#FFB800] text-[#14120B] flex items-center justify-center shadow">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </span>
                      )}
                      <span className="self-start font-mono text-[11px] font-black leading-none">
                        {isJoker ? '★' : card.rank}
                      </span>
                      <div className="flex flex-col items-center leading-none">
                        <span className="text-xl sm:text-2xl font-black">{sym}</span>
                        <span className="font-mono text-[11px] font-black mt-0.5">
                          {card.rank}
                        </span>
                      </div>
                      <span className="self-end font-mono text-[11px] font-black leading-none">
                        {sym}
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Tactile Action Buttons Column */}
          <div className={`flex flex-col justify-center gap-1.5 shrink-0 ${embedded ? 'w-32' : 'w-36 sm:w-44'}`}>
            {cardState.extraActions && cardState.extraActions.length > 0 ? (
              <div className="flex-1 grid grid-cols-1 gap-1.5 min-h-0">
                {cardState.extraActions.map((btn, i) => (
                  <button
                    key={`${btn.label}_${i}`}
                    type="button"
                    disabled={btn.disabled}
                    onClick={() => onAction(btn.action)}
                    className="tactile-btn rounded-xl px-2 py-1.5 font-display font-black text-[11px] sm:text-xs text-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    style={{
                      backgroundColor: btn.colorHex,
                      color: btn.textColor ?? '#FFFFFF',
                      boxShadow: '0 3px 0 rgba(0,0,0,0.45)',
                    }}
                  >
                    <span className="truncate">{lang === 'zh' ? btn.labelZh : btn.label}</span>
                  </button>
                ))}
              </div>
            ) : cardState.primaryBtn || cardState.secondaryBtn ? (
              <>
                {cardState.primaryBtn && (
                  <button
                    type="button"
                    disabled={cardState.primaryBtn.disabled}
                    onClick={() => onAction(cardState.primaryBtn!.action)}
                    className="tactile-btn flex-1 rounded-xl px-2 font-display font-black text-xs sm:text-sm flex items-center justify-center text-center leading-tight cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    style={{
                      backgroundColor: cardState.primaryBtn.colorHex,
                      color: cardState.primaryBtn.textColor ?? '#FFFFFF',
                      boxShadow: '0 4px 0 rgba(0,0,0,0.45)',
                    }}
                  >
                    <span>
                      {lang === 'zh' ? cardState.primaryBtn.labelZh : cardState.primaryBtn.label}
                    </span>
                  </button>
                )}
                {cardState.secondaryBtn && (
                  <button
                    type="button"
                    disabled={cardState.secondaryBtn.disabled}
                    onClick={() => onAction(cardState.secondaryBtn!.action)}
                    className="tactile-btn flex-1 rounded-xl px-2 font-display font-black text-xs sm:text-sm flex items-center justify-center text-center leading-tight cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    style={{
                      backgroundColor: cardState.secondaryBtn.colorHex,
                      color: cardState.secondaryBtn.textColor ?? '#0A1913',
                      boxShadow: '0 4px 0 rgba(0,0,0,0.4)',
                    }}
                  >
                    <span>
                      {lang === 'zh' ? cardState.secondaryBtn.labelZh : cardState.secondaryBtn.label}
                    </span>
                  </button>
                )}
              </>
            ) : isColorClash ? (
              <>
                <button
                  type="button"
                  disabled={!cardState.isMyTurn || !highlightedCard?.playable}
                  onClick={() => highlightedCard && triggerPlayWithThrowAnim(highlightedCard.id)}
                  className="tactile-btn flex-1 rounded-xl font-display font-black text-xs sm:text-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                  className="tactile-btn flex-1 rounded-xl font-display font-black text-xs sm:text-sm flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
            ) : isLiarsDeck && cardState.phase === 'challenge' && cardState.canCallBluff ? (
              <>
                <button
                  type="button"
                  onClick={() => onAction({ type: 'call-bluff' })}
                  className="tactile-btn flex-1 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-black text-xs sm:text-sm shadow-[0_4px_0_#B82E17] flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>{t('CALL BLUFF!', '抓谎！')}</span>
                </button>
                <button
                  type="button"
                  disabled={!cardState.canTrust}
                  onClick={() => onAction({ type: 'trust-claim' })}
                  className="tactile-btn flex-1 rounded-xl bg-[#10D98B] text-[#0A1913] font-display font-black text-xs sm:text-sm shadow-[0_4px_0_#0A915D] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-45"
                >
                  <Check className="w-4 h-4" />
                  <span>{t('TRUST', '信任跳过')}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!cardState.isMyTurn || cardState.hand.length === 0}
                  onClick={() => onAction({ type: 'submit-selected' })}
                  className="tactile-btn flex-1 rounded-xl font-display font-black text-xs sm:text-sm flex flex-col items-center justify-center leading-tight cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: playerColorHex,
                    color: '#FFFFFF',
                    boxShadow: '0 4px 0 rgba(0,0,0,0.45)',
                  }}
                >
                  <span>
                    {selectedLiarCount > 0
                      ? t(`PLAY ${selectedLiarCount} FACE-DOWN`, `扣出 ${selectedLiarCount} 张`)
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
                  className="tactile-btn h-10 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] font-bold text-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('Pass Turn', '过牌')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
