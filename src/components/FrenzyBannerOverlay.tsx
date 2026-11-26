import { AnimatePresence, motion } from 'motion/react';
import { Flame, Zap } from 'lucide-react';
import { GAME_FRENZY_PERKS } from '../shared/modifiers';
import type { FrenzyState, GameId, RoomStatus } from '../shared/types';
import { useLanguage } from '../lib/i18n';

interface FrenzyBannerOverlayProps {
  gameId: GameId;
  status: RoomStatus;
  frenzy: FrenzyState;
  compact?: boolean;
}

export function FrenzyBannerOverlay({
  gameId,
  status,
  frenzy,
  compact = false,
}: FrenzyBannerOverlayProps) {
  const { lang, t } = useLanguage();
  const frenzyPerks = GAME_FRENZY_PERKS[gameId] || {
    perk1En: '2× SCORE BOOST',
    perk1Zh: '双倍积分狂热',
    perk2En: '1.18× SPEED RUSH',
    perk2Zh: '1.18× 极速冲刺',
  };

  return (
    <>
      {/* Active Frenzy Fiery Edge Vignette */}
      {status === 'PLAYING' && frenzy.active && !frenzy.freezing && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#FF5E1A]/80 shadow-[inset_0_0_52px_rgba(255,77,46,0.34)] z-20 animate-pulse"
        />
      )}

      {/* Sequential 3.0-Second Fire Frenzy Fly-Through Overlay (Right -> Left) */}
      <AnimatePresence>
        {status === 'PLAYING' && frenzy.freezing && (
          <motion.div
            key={`frenzy-overlay-${frenzy.triggerCount}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute inset-0 z-[35] flex items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(255,88,20,0.4)_0%,rgba(14,7,9,0.88)_75%)] backdrop-blur-[2px] border-2 sm:border-4 border-[#FF5E1A] shadow-[inset_0_0_72px_rgba(255,77,46,0.5)]"
          >
            {/* Blazing Horizontal Fire Streak Lines Sweeping Right -> Left */}
            {[
              { top: '14%', h: 'h-1', color: 'from-transparent via-[#FF8A00] to-transparent', dur: 0.75, delay: 0 },
              { top: '27%', h: 'h-1.5', color: 'from-transparent via-[#FFE066] to-transparent', dur: 0.62, delay: 0.18 },
              { top: '48%', h: 'h-2', color: 'from-transparent via-[#FF4D2E] to-transparent', dur: 0.7, delay: 0.08 },
              { top: '69%', h: 'h-1.5', color: 'from-transparent via-[#FFB800] to-transparent', dur: 0.65, delay: 0.3 },
              { top: '84%', h: 'h-1', color: 'from-transparent via-[#FF5E1A] to-transparent', dur: 0.72, delay: 0.12 },
            ].map((streak, idx) => (
              <motion.div
                key={idx}
                initial={{ x: '110%', opacity: 0 }}
                animate={{ x: ['110%', '-110%'], opacity: [0, 0.9, 0.9, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: streak.dur,
                  delay: streak.delay,
                  ease: 'linear',
                }}
                style={{ top: streak.top }}
                className={`absolute left-0 w-2/3 ${streak.h} bg-gradient-to-r ${streak.color} blur-[1px]`}
              />
            ))}

            {/* Animated Rising & Wind-Swept Fire Ember Particles */}
            {Array.from({ length: compact ? 10 : 16 }).map((_, i) => (
              <motion.span
                key={i}
                initial={{
                  y: 160 - (i % 3) * 40,
                  x: 360 + (i % 4) * 80,
                  opacity: 0,
                  scale: 0.6,
                }}
                animate={{
                  y: -180,
                  x: -380 - (i % 3) * 70,
                  opacity: [0, 1, 0.95, 0],
                  scale: [0.6, 1.35, 0.65],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 0.95 + (i % 4) * 0.2,
                  delay: (i % 6) * 0.12,
                  ease: 'easeOut',
                }}
                className={`absolute rounded-full ${
                  i % 3 === 0
                    ? 'w-3 h-3 bg-[#FFB800] shadow-[0_0_14px_#FFB800]'
                    : i % 3 === 1
                    ? 'w-2 h-2 bg-[#FF4D2E] shadow-[0_0_12px_#FF4D2E]'
                    : 'w-1.5 h-1.5 bg-[#FFF3B0] shadow-[0_0_10px_#FFF3B0]'
                }`}
              />
            ))}

            {/* STAGE 1 (First): FRENZY MODE! Sweeps in from Right -> Holds Center -> Exits Left */}
            <motion.div
              key={`frenzy-stage1-${frenzy.triggerCount}`}
              initial={{ x: '105%', opacity: 0, scale: 0.92 }}
              animate={{
                x: ['105%', '0%', '0%', '-105%'],
                opacity: [0, 1, 1, 0],
                scale: [0.92, 1.03, 1.0, 0.92],
              }}
              transition={{
                duration: 1.42,
                times: [0, 0.16, 0.78, 1],
                ease: ['easeOut', 'linear', 'easeIn'],
              }}
              className="absolute inset-0 flex items-center justify-center px-3 sm:px-4 pb-8"
            >
              <div
                className={`relative w-[92%] rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#2D0D09]/95 via-[#43140A]/96 to-[#1D0B0E]/95 border-2 border-[#FF8A00] text-center shadow-[0_0_70px_rgba(255,77,46,0.85)] ${
                  compact ? 'max-w-lg px-4 py-3.5 sm:px-7 sm:py-5' : 'max-w-2xl px-4 py-5 sm:px-10 sm:py-9'
                }`}
              >
                <div className="pointer-events-none absolute -right-12 inset-y-4 w-16 bg-gradient-to-l from-transparent via-[#FF5E1A]/45 to-[#FFB800]/65 blur-xl rounded-full" />
                <div className="pointer-events-none absolute -left-8 inset-y-6 w-12 bg-gradient-to-r from-transparent to-[#FF4D2E]/50 blur-lg rounded-full" />

                <div
                  className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#FF4D2E]/30 border border-[#FFB800]/75 text-[#FFE066] font-mono font-black tracking-widest uppercase shadow-[0_0_20px_rgba(255,138,0,0.45)] ${
                    compact ? 'px-2.5 py-0.5 text-[10px] sm:text-xs' : 'px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-sm'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-[#FFB800] animate-pulse shrink-0" />
                  <span>{t('FINAL STRETCH · OVERDRIVE UNLOCKED', '终局高能时刻 · 全场沸腾')}</span>
                  <Flame className="w-3.5 h-3.5 text-[#FFB800] animate-pulse shrink-0" />
                </div>

                <div className="mt-2 sm:mt-3 flex items-center justify-center gap-2 sm:gap-3">
                  <Flame
                    className={`${
                      compact ? 'w-6 h-6 sm:w-9 sm:h-9' : 'w-8 h-8 sm:w-12 sm:h-12'
                    } text-[#FFB800] drop-shadow-[0_0_18px_#FF5E1A] shrink-0 animate-pulse`}
                  />
                  <h2
                    className={`font-display font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFF7CC] via-[#FFB800] to-[#FF4D2E] drop-shadow-[0_4px_24px_rgba(255,77,46,0.95)] ${
                      compact ? 'text-2xl sm:text-4xl' : 'text-2xl sm:text-5xl lg:text-6xl'
                    }`}
                  >
                    {t('FRENZY MODE!', '烈焰狂热模式！')}
                  </h2>
                  <Flame
                    className={`${
                      compact ? 'w-6 h-6 sm:w-9 sm:h-9' : 'w-8 h-8 sm:w-12 sm:h-12'
                    } text-[#FFB800] drop-shadow-[0_0_18px_#FF5E1A] shrink-0 animate-pulse`}
                  />
                </div>
              </div>
            </motion.div>

            {/* STAGE 2 (Follows): SPECIAL FEATURES Sweeps in from Right -> Holds Center -> Exits Left */}
            <motion.div
              key={`frenzy-stage2-${frenzy.triggerCount}`}
              initial={{ x: '105%', opacity: 0, scale: 0.92 }}
              animate={{
                x: ['105%', '0%', '0%', '-105%'],
                opacity: [0, 1, 1, 0],
                scale: [0.92, 1.02, 1.0, 0.92],
              }}
              transition={{
                delay: 1.24,
                duration: 1.72,
                times: [0, 0.14, 0.82, 1],
                ease: ['easeOut', 'linear', 'easeIn'],
              }}
              className="absolute inset-0 flex items-center justify-center px-3 sm:px-4 pb-8"
            >
              <div
                className={`relative w-[92%] rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#33110D]/96 via-[#1B0C0E]/96 to-[#12090C]/98 border-2 border-[#FFB800] text-center shadow-[0_0_70px_rgba(255,138,0,0.75)] ${
                  compact ? 'max-w-xl p-3 sm:p-5' : 'max-w-2xl p-5 sm:p-7'
                }`}
              >
                <div className="pointer-events-none absolute -right-12 inset-y-4 w-16 bg-gradient-to-l from-transparent via-[#FF4D2E]/45 to-[#FFB800]/65 blur-xl rounded-full" />
                <div className="pointer-events-none absolute -left-8 inset-y-6 w-12 bg-gradient-to-r from-transparent to-[#FF8A00]/50 blur-lg rounded-full" />

                <div
                  className={`inline-flex items-center gap-1.5 rounded-full bg-[#FF4D2E]/30 border border-[#FF8A00]/80 text-[#FFE066] font-mono font-black tracking-widest uppercase ${
                    compact ? 'px-3 py-0.5 text-[10px] sm:text-xs' : 'px-4 py-1 text-xs'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5 text-[#FF8A00] animate-pulse" />
                  <span>{t('SPECIAL FEATURES ACTIVE', '烈焰专属强化已激活')}</span>
                  <Flame className="w-3.5 h-3.5 text-[#FF8A00] animate-pulse" />
                </div>

                <div
                  className={`grid grid-cols-2 ${
                    compact ? 'mt-2.5 gap-2 sm:gap-3' : 'mt-4 gap-3.5'
                  }`}
                >
                  <div
                    className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#FF4D2E]/30 to-[#FF8A00]/15 border-2 border-[#FF5E1A] flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,77,46,0.35),inset_0_0_18px_rgba(255,77,46,0.25)] ${
                      compact ? 'px-2.5 py-2.5 sm:px-4 sm:py-3.5' : 'px-4 py-4'
                    }`}
                  >
                    <Flame
                      className={`${
                        compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-7 h-7'
                      } text-[#FFB800] drop-shadow-[0_0_10px_#FF5E1A] shrink-0 animate-pulse`}
                    />
                    <span
                      className={`font-display font-black text-white drop-shadow leading-tight ${
                        compact ? 'text-xs sm:text-lg' : 'text-lg sm:text-2xl'
                      }`}
                    >
                      {lang === 'zh' ? frenzyPerks.perk1Zh : frenzyPerks.perk1En}
                    </span>
                  </div>

                  <div
                    className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#FFB800]/28 to-[#FF5E1A]/15 border-2 border-[#FFB800] flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,184,0,0.3),inset_0_0_18px_rgba(255,184,0,0.22)] ${
                      compact ? 'px-2.5 py-2.5 sm:px-4 sm:py-3.5' : 'px-4 py-4'
                    }`}
                  >
                    <Zap
                      className={`${
                        compact ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-7 h-7'
                      } text-[#FFE066] drop-shadow-[0_0_10px_#FFB800] shrink-0 animate-pulse`}
                    />
                    <span
                      className={`font-display font-black text-white drop-shadow leading-tight ${
                        compact ? 'text-xs sm:text-lg' : 'text-lg sm:text-2xl'
                      }`}
                    >
                      {lang === 'zh' ? frenzyPerks.perk2Zh : frenzyPerks.perk2En}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Bottom Fiery Fuse Progress Bar */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-[82%] max-w-lg text-center ${
                compact ? 'bottom-2.5 sm:bottom-4' : 'bottom-4 sm:bottom-6'
              }`}
            >
              <div className="h-2 w-full rounded-full bg-[#2A1414]/90 border border-[#FF5E1A]/50 overflow-hidden p-0.5 shadow-[0_0_18px_rgba(255,77,46,0.45)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF4D2E] via-[#FF8A00] to-[#FFE066] transition-[width] duration-75"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        (frenzy.freezeRemaining / Math.max(0.1, frenzy.freezeTotal)) * 100
                      )
                    )}%`,
                  }}
                />
              </div>
              <div className="mt-1 font-mono text-[10px] sm:text-[11px] font-extrabold tracking-widest text-[#FFE066] uppercase tabular-nums drop-shadow">
                {t(
                  `GET READY · RESUMING IN ${Math.max(1, Math.ceil(frenzy.freezeRemaining))}...`,
                  `全速狂飙 · ${Math.max(1, Math.ceil(frenzy.freezeRemaining))} 秒后继续！`
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
