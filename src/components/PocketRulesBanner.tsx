import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import { Check, Loader2, RefreshCw } from 'lucide-react';
import type {
  GameId,
  GameMetadata,
  PlayerSummary,
  TournamentState,
} from '../shared/types';
import type { MutatorId, MutatorSpec } from '../shared/modifiers';
import type { PocketDirectTouchMode } from '../shared/padProfiles';
import { useLanguage } from '../lib/i18n';
import { GameThumbnail } from './GameThumbnail';

export interface PocketRulesBannerProps {
  isOpen: boolean;
  gameId: GameId;
  gameMeta: GameMetadata;
  activeSettingLabel: string | null;
  activeMutator: MutatorId;
  activeMutatorSpec: MutatorSpec;
  isCardGame: boolean;
  pocketDirectTouch: PocketDirectTouchMode | null;
  players: PlayerSummary[];
  meReady: boolean;
  isRoomHost: boolean;
  rendererLoadState: 'ready' | 'loading' | 'error';
  tournament: TournamentState | null;
  onToggleReady: () => void;
  onRetryRenderer: () => void;
  onHostStartNow: () => void;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
      : clean;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return `rgba(0, 194, 255, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const INNER_STAGGER_VARIANTS: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.045,
    },
  },
};

const INNER_BLOCK_VARIANTS: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: 'easeOut',
    },
  },
};

export function PocketRulesBanner({
  isOpen,
  gameId,
  gameMeta,
  activeSettingLabel,
  activeMutator,
  activeMutatorSpec,
  isCardGame,
  pocketDirectTouch,
  players,
  meReady,
  isRoomHost,
  rendererLoadState,
  tournament,
  onToggleReady,
  onRetryRenderer,
  onHostStartNow,
}: PocketRulesBannerProps) {
  const { lang, t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const reduced = Boolean(prefersReducedMotion);

  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setCoverFailed(false);
  }, [gameId, gameMeta.coverImage]);

  const connectedHumans = players.filter((p) => !p.isBot && p.connected);
  const readyHumans = connectedHumans.filter((p) => p.ready);
  const readyCount = readyHumans.length;
  const totalCount = connectedHumans.length;

  const schema = gameMeta.controllerSchema;
  const coachLine = gameMeta.coachLine || gameMeta.rules[0] || gameMeta.tagline;
  const accentHex = gameMeta.accentHex || '#00C2FF';
  const showDirectCover = Boolean(gameMeta.coverImage) && !coverFailed;

  const directTouchHint =
    pocketDirectTouch === 'golf-slingshot'
      ? t('Drag back anywhere to aim · Release to putt', '按住向后拉杆瞄准 · 松手推杆进洞')
      : pocketDirectTouch === 'sketch-canvas'
      ? t('Draw on board or tap a word card', '直接在白板画画或点击词卡抢答')
      : pocketDirectTouch === 'paddle-drag'
      ? t('Drag directly on the court to move & hit the puck', '直接在球场上拖动你的球拍挡球回击')
      : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key={gameId}
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.18, ease: 'easeIn' } }}
          transition={{ duration: reduced ? 0 : 0.16, ease: 'easeOut' }}
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute inset-0 z-[50] flex items-start justify-center bg-black/60 backdrop-blur-[2px] px-2.5 pt-2 pb-2.5 sm:px-4 sm:pt-3 sm:pb-4 overflow-hidden select-none pointer-events-auto touch-none"
        >
          <motion.div
            initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: -64 }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, y: -48, transition: { duration: 0.18, ease: 'easeIn' } }
            }
            transition={
              reduced ? { duration: 0 } : { type: 'spring', stiffness: 340, damping: 30 }
            }
            role="dialog"
            aria-modal="true"
            aria-label={gameMeta.name}
            className="w-full max-w-2xl max-h-[86%] rounded-2xl bg-[#10141E]/96 border-2 flex flex-col overflow-hidden"
            style={{
              borderColor: hexToRgba(accentHex, 0.72),
              boxShadow: `0 18px 48px rgba(0, 0, 0, 0.65), 0 0 28px ${hexToRgba(
                accentHex,
                0.28
              )}, inset 0 1px 0 ${hexToRgba(accentHex, 0.35)}`,
            }}
          >
            <motion.div
              initial={reduced ? false : 'hidden'}
              animate="visible"
              variants={INNER_STAGGER_VARIANTS}
              className="flex flex-col min-h-0 flex-1 overflow-hidden"
            >
              {/* Scrollable Rules Content */}
              <div className="flex-1 min-h-0 overflow-y-auto arcade-scrollbar touch-pan-y px-3 pt-2.5 pb-2 sm:px-4 sm:pt-3 sm:pb-2.5 space-y-2">
                {/* 1. Header row */}
                <motion.div
                  variants={INNER_BLOCK_VARIANTS}
                  className="flex items-center gap-2.5 pb-2 border-b border-white/10"
                >
                  <div className="relative w-14 h-9 sm:w-16 sm:h-10 rounded-xl overflow-hidden border border-white/15 bg-[#0D1017] shrink-0">
                    {showDirectCover ? (
                      <img
                        src={gameMeta.coverImage}
                        alt={gameMeta.name}
                        decoding="async"
                        onError={() => setCoverFailed(true)}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <GameThumbnail
                        gameId={gameId}
                        gameName={gameMeta.name}
                        accentHex={accentHex}
                        fallbackSrc={gameMeta.coverImage}
                        eager
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {tournament && (
                        <span className="px-1.5 py-0.5 rounded bg-[#FFB800]/20 text-[#FFB800] font-mono text-[10px] font-black shrink-0 tabular-nums">
                          🏆 {tournament.currentGameIndex + 1}/{tournament.totalGames}
                        </span>
                      )}
                      <h2 className="font-display font-extrabold text-sm sm:text-base text-white truncate">
                        {gameMeta.name}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[#9CA3AF] mt-0.5">
                      <span className="font-semibold">{gameMeta.category}</span>
                      {activeSettingLabel && (
                        <>
                          <span className="text-[#4B5563]" aria-hidden="true">·</span>
                          <span className="font-mono text-[#E5E7EB] font-bold">
                            {gameMeta.settingLabel}: {activeSettingLabel}
                          </span>
                        </>
                      )}
                      {activeMutator !== 'normal' && (
                        <>
                          <span className="text-[#4B5563]" aria-hidden="true">·</span>
                          <span
                            className="font-mono font-black"
                            style={{ color: activeMutatorSpec.accentHex }}
                          >
                            {lang === 'zh'
                              ? activeMutatorSpec.shortTagZh
                              : activeMutatorSpec.shortTag}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* 2. Coach line */}
                {coachLine && (
                  <motion.p
                    variants={INNER_BLOCK_VARIANTS}
                    className="text-base sm:text-lg font-extrabold text-white leading-snug"
                  >
                    {coachLine}
                  </motion.p>
                )}

                {/* 3. All 4 numbered rules + optional Chaos Rule */}
                <motion.div variants={INNER_BLOCK_VARIANTS} className="space-y-2">
                  {gameMeta.rules.length > 0 && (
                    <ol className="space-y-1.5 pt-1.5 border-t border-white/10">
                      {gameMeta.rules.map((rule, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs sm:text-sm text-[#E5E7EB] leading-snug"
                        >
                          <span
                            className="font-mono text-[10px] font-black tabular-nums mt-0.5 shrink-0"
                            style={{ color: accentHex }}
                          >
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <span className="flex-1">{rule}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  {activeMutator !== 'normal' && (
                    <div className="pt-1.5 border-t border-white/10 text-xs leading-snug">
                      <span
                        className="font-extrabold"
                        style={{ color: activeMutatorSpec.accentHex }}
                      >
                        {t('Chaos Rule', '混沌规则')}:{' '}
                        {lang === 'zh' ? activeMutatorSpec.nameZh : activeMutatorSpec.name}
                      </span>
                      <span className="text-[#CBD5E1]">
                        {' '}—{' '}
                        {lang === 'zh'
                          ? activeMutatorSpec.descriptionZh
                          : activeMutatorSpec.description}
                      </span>
                      {activeMutatorSpec.invertControls && (
                        <p className="text-[11px] font-extrabold text-[#FF3B9A] mt-0.5">
                          ⚠{' '}
                          {t(
                            'Mirror Curse active: Joystick directions are flipped!',
                            '镜像反转生效中：本局摇杆方向上下左右反转！'
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>

                {/* 4. Controls row */}
                <motion.div
                  variants={INNER_BLOCK_VARIANTS}
                  className="pt-1.5 border-t border-white/10"
                >
                  {isCardGame ? (
                    <p className="text-xs text-[#D1D5DB] leading-snug truncate">
                      {schema.controlTip}
                    </p>
                  ) : directTouchHint ? (
                    <p className="text-xs font-extrabold text-[#10D98B] leading-snug">
                      {directTouchHint}
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs leading-snug">
                      <span className="text-[#D1D5DB] font-semibold">
                        <span className="text-[#9CA3AF]">{t('Move', '移动')} = </span>
                        <span className="text-white font-bold">{schema.joystickLabel}</span>
                      </span>
                      <span className="text-[#4B5563]" aria-hidden="true">·</span>
                      <span
                        className="font-extrabold"
                        style={{ color: schema.actionA.colorHex }}
                      >
                        A = {schema.actionA.label}
                      </span>
                      <span className="text-[#4B5563]" aria-hidden="true">·</span>
                      <span
                        className="font-extrabold"
                        style={{ color: schema.actionB.colorHex }}
                      >
                        B = {schema.actionB.label}
                      </span>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* 5. Sticky Bottom OK Row */}
              <motion.div
                variants={INNER_BLOCK_VARIANTS}
                className="shrink-0 border-t border-white/10 bg-[#0D111A]/98 px-3 py-2 sm:px-4 sm:py-2.5 space-y-1.5"
              >
                {rendererLoadState === 'error' && (
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-[#3B1219] border border-[#FF4D2E]/60 px-2.5 py-1.5 text-[11px] font-bold text-[#FCA5A5]">
                    <span className="truncate">
                      {t('Arena load failed', '加载竞技场失败')}
                    </span>
                    <button
                      type="button"
                      onClick={onRetryRenderer}
                      className="px-2 py-0.5 rounded bg-[#FF4D2E] text-white text-[10px] font-extrabold inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" aria-hidden="true" />
                      <span>{t('Retry', '重试')}</span>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  disabled={rendererLoadState === 'loading'}
                  onClick={onToggleReady}
                  className={`relative tactile-btn w-full h-12 sm:h-13 rounded-2xl font-display font-extrabold text-base sm:text-lg cursor-pointer transition-colors flex items-center justify-center gap-2 select-none disabled:opacity-70 ${
                    meReady
                      ? 'bg-[#10D98B]/18 border border-[#10D98B]/45 text-[#6EE7B7] hover:bg-[#10D98B]/24'
                      : ''
                  }`}
                  style={
                    meReady
                      ? undefined
                      : {
                          backgroundColor: '#10D98B',
                          color: '#062016',
                          boxShadow: '0 4px 0 #0A915D',
                        }
                  }
                >
                  {rendererLoadState === 'loading' ? (
                    <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  ) : (
                    meReady && <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
                  )}
                  <span className="tabular-nums">
                    {rendererLoadState === 'loading'
                      ? t('Loading Arena...', '正在加载竞技场...')
                      : meReady
                      ? t(
                          `Waiting · ${readyCount}/${totalCount}`,
                          `等待中 · ${readyCount}/${totalCount}`
                        )
                      : 'OK'}
                  </span>
                </button>

                {meReady && (
                  <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 pt-0.5">
                    {connectedHumans.length > 0 && (
                      <div
                        className="inline-flex items-center gap-1.5"
                        aria-label={t(
                          `${readyCount} of ${totalCount} players ready`,
                          `${readyCount}/${totalCount} 名玩家已准备`
                        )}
                      >
                        {connectedHumans.map((p) => {
                          const initial = (p.name.trim()[0] || '?').toUpperCase();
                          return (
                            <span
                              key={p.id}
                              title={`${p.name} · ${
                                p.ready ? t('Ready', '已准备') : t('Reading', '阅读中')
                              }`}
                              className="w-5 h-5 rounded-full inline-flex items-center justify-center font-mono text-[10px] font-black transition-colors"
                              style={
                                p.ready
                                  ? {
                                      backgroundColor: '#10D98B',
                                      color: '#052E16',
                                      boxShadow: `0 0 0 2px ${p.color.hex}`,
                                    }
                                  : {
                                      backgroundColor: hexToRgba(p.color.hex, 0.2),
                                      color: p.color.hex,
                                      boxShadow: `inset 0 0 0 1.5px ${hexToRgba(
                                        p.color.hex,
                                        0.75
                                      )}`,
                                    }
                              }
                            >
                              {initial}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <span className="text-[10px] text-[#9CA3AF]">
                      {t('Tap to undo', '再次点击取消')}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] leading-tight">
                  <span className="text-[#A5AEBD] text-center">
                    {t(
                      'Match starts when everyone taps OK',
                      '所有人点击后即刻开始'
                    )}
                  </span>
                  {isRoomHost && (
                    <button
                      type="button"
                      disabled={rendererLoadState === 'loading'}
                      onClick={onHostStartNow}
                      className="text-[11px] font-extrabold text-[#FFB800] hover:text-[#FFD166] underline-offset-2 hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      {rendererLoadState === 'loading' && (
                        <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                      )}
                      <span>
                        {rendererLoadState === 'loading'
                          ? t('Loading...', '加载中...')
                          : t('Host Start Now', '房主直接开始')}
                      </span>
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
