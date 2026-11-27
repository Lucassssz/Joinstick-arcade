import { memo, useEffect, useRef, useState } from 'react';
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

const FRENZY_KEYFRAMES_CSS = `
@keyframes jsFrenzyStage1 {
  0% {
    transform: translate3d(105%, 0, 0) scale(0.92);
    opacity: 0;
  }
  15% {
    transform: translate3d(0%, 0, 0) scale(1.03);
    opacity: 1;
  }
  78% {
    transform: translate3d(0%, 0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate3d(-105%, 0, 0) scale(0.92);
    opacity: 0;
  }
}
@keyframes jsFrenzyStage2 {
  0%, 40% {
    transform: translate3d(105%, 0, 0) scale(0.92);
    opacity: 0;
  }
  52% {
    transform: translate3d(0%, 0, 0) scale(1.02);
    opacity: 1;
  }
  90% {
    transform: translate3d(0%, 0, 0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate3d(-105%, 0, 0) scale(0.92);
    opacity: 0;
  }
}
@keyframes jsFrenzyStreak {
  0% {
    transform: translate3d(120%, 0, 0);
    opacity: 0;
  }
  20% {
    opacity: 0.92;
  }
  80% {
    opacity: 0.92;
  }
  100% {
    transform: translate3d(-140%, 0, 0);
    opacity: 0;
  }
}
@keyframes jsFrenzyEmber {
  0% {
    transform: translate3d(260px, 110px, 0) scale(0.6);
    opacity: 0;
  }
  25% {
    opacity: 1;
  }
  75% {
    opacity: 0.92;
  }
  100% {
    transform: translate3d(-280px, -130px, 0) scale(1.25);
    opacity: 0;
  }
}
`;

export const FrenzyBannerOverlay = memo(function FrenzyBannerOverlay({
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

  // Latch a deterministic 3.0s client fly-through banner whenever Frenzy triggers,
  // even if high-frequency touch re-renders or late snapshots occur.
  const [localFlyActive, setLocalFlyActive] = useState(false);
  const [localProgressPct, setLocalProgressPct] = useState(100);
  const [localRemainSec, setLocalRemainSec] = useState(3);
  const lastAnnouncedKeyRef = useRef<string>('');

  useEffect(() => {
    if (status !== 'PLAYING' || (!frenzy.active && !frenzy.freezing)) {
      if (status !== 'PLAYING' && status !== 'PAUSED') {
        lastAnnouncedKeyRef.current = '';
        setLocalFlyActive(false);
      }
      return;
    }

    const triggerKey = `${gameId}-${Math.max(1, frenzy.triggerCount)}`;
    if (frenzy.freezing || lastAnnouncedKeyRef.current !== triggerKey) {
      if (lastAnnouncedKeyRef.current !== triggerKey) {
        lastAnnouncedKeyRef.current = triggerKey;
        setLocalFlyActive(true);
        const totalMs = Math.max(1800, (frenzy.freezeTotal || 3.0) * 1000);
        const startedAt = performance.now();

        const interval = window.setInterval(() => {
          const elapsed = performance.now() - startedAt;
          const remainMs = Math.max(0, totalMs - elapsed);
          setLocalProgressPct(Math.max(0, Math.min(100, (remainMs / totalMs) * 100)));
          setLocalRemainSec(Math.max(1, Math.ceil(remainMs / 1000)));
          if (remainMs <= 0) {
            window.clearInterval(interval);
            setLocalFlyActive(false);
          }
        }, 60);

        return () => window.clearInterval(interval);
      }
    }
  }, [status, gameId, frenzy.active, frenzy.freezing, frenzy.triggerCount, frenzy.freezeTotal]);

  const showFlyThrough = status === 'PLAYING' && (frenzy.freezing || localFlyActive);
  const fusePct = frenzy.freezing
    ? Math.max(
        0,
        Math.min(100, (frenzy.freezeRemaining / Math.max(0.1, frenzy.freezeTotal || 3)) * 100)
      )
    : localProgressPct;
  const fuseSecs = frenzy.freezing
    ? Math.max(1, Math.ceil(frenzy.freezeRemaining))
    : localRemainSec;

  const perk1Label = lang === 'zh' ? frenzyPerks.perk1Zh : frenzyPerks.perk1En;
  const perk2Label = lang === 'zh' ? frenzyPerks.perk2Zh : frenzyPerks.perk2En;

  return (
    <>
      <style>{FRENZY_KEYFRAMES_CSS}</style>

      {/* Active Frenzy Fiery Edge Vignette + Persistent Top-Center FRENZY TIME Banner */}
      {status === 'PLAYING' && frenzy.active && !showFlyThrough && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#FF5E1A]/85 shadow-[inset_0_0_52px_rgba(255,77,46,0.36)] z-[28] animate-pulse"
          />
          <div
            aria-live="polite"
            className="pointer-events-none absolute top-1 left-1/2 -translate-x-1/2 z-[32] flex items-center justify-center max-w-[92%]"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#2D0D09]/95 via-[#4A140B]/95 to-[#2D0D09]/95 border border-[#FFB800]/85 shadow-[0_0_22px_rgba(255,77,46,0.75)] backdrop-blur-sm">
              <Flame className="w-3.5 h-3.5 text-[#FFB800] animate-bounce shrink-0" />
              <span className="font-display font-black text-[11px] sm:text-xs tracking-wider uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#FFF3B0] via-[#FFB800] to-[#FF6B4A] whitespace-nowrap">
                {t('FRENZY TIME · 2×', '烈焰狂热时间 · 2×')}
              </span>
              <span className="hidden sm:inline text-[10px] font-mono font-bold text-[#FFE066] truncate max-w-[260px]">
                · {perk1Label} · {perk2Label}
              </span>
              <Zap className="w-3 h-3 text-[#FFE066] animate-pulse shrink-0" />
            </div>
          </div>
        </>
      )}

      {/* Sequential 3.0-Second Fire Frenzy Fly-Through Overlay (Right -> Left, Compositor-Driven) */}
      {showFlyThrough && (
        <div
          key={`frenzy-fly-${gameId}-${Math.max(1, frenzy.triggerCount)}`}
          className="pointer-events-none absolute inset-0 z-[45] flex items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(255,88,20,0.44)_0%,rgba(14,7,9,0.9)_75%)] backdrop-blur-[2px] border-2 sm:border-4 border-[#FF5E1A] shadow-[inset_0_0_72px_rgba(255,77,46,0.55)]"
        >
          {/* Blazing Horizontal Fire Streak Lines Sweeping Right -> Left */}
          {[
            { top: '14%', h: 'h-1', color: 'from-transparent via-[#FF8A00] to-transparent', dur: '0.75s', delay: '0s' },
            { top: '28%', h: 'h-1.5', color: 'from-transparent via-[#FFE066] to-transparent', dur: '0.62s', delay: '0.16s' },
            { top: '49%', h: 'h-2', color: 'from-transparent via-[#FF4D2E] to-transparent', dur: '0.7s', delay: '0.08s' },
            { top: '70%', h: 'h-1.5', color: 'from-transparent via-[#FFB800] to-transparent', dur: '0.65s', delay: '0.26s' },
            { top: '84%', h: 'h-1', color: 'from-transparent via-[#FF5E1A] to-transparent', dur: '0.72s', delay: '0.12s' },
          ].map((streak, idx) => (
            <div
              key={idx}
              style={{
                top: streak.top,
                animation: `jsFrenzyStreak ${streak.dur} linear ${streak.delay} infinite`,
              }}
              className={`absolute left-0 w-2/3 ${streak.h} bg-gradient-to-r ${streak.color} blur-[1px]`}
            />
          ))}

          {/* Animated Rising & Wind-Swept Fire Ember Particles */}
          {Array.from({ length: compact ? 10 : 14 }).map((_, i) => (
            <span
              key={i}
              style={{
                top: `${22 + ((i * 17) % 60)}%`,
                left: `${18 + ((i * 23) % 68)}%`,
                animation: `jsFrenzyEmber ${0.95 + (i % 4) * 0.18}s ease-out ${(i % 5) * 0.11}s infinite`,
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

          {/* STAGE 1 (First 1.45s): FRENZY TIME / FRENZY MODE! Sweeps in from Right -> Holds Center -> Exits Left */}
          <div
            style={{
              animation: 'jsFrenzyStage1 1.45s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
            className="absolute inset-0 flex items-center justify-center px-3 sm:px-4 pb-7"
          >
            <div
              className={`relative w-[92%] rounded-2xl sm:rounded-3xl bg-gradient-to-r from-[#2D0D09]/96 via-[#43140A]/96 to-[#1D0B0E]/96 border-2 border-[#FF8A00] text-center shadow-[0_0_70px_rgba(255,77,46,0.88)] ${
                compact ? 'max-w-lg px-4 py-3 sm:px-6 sm:py-4' : 'max-w-2xl px-4 py-5 sm:px-10 sm:py-9'
              }`}
            >
              <div className="pointer-events-none absolute -right-12 inset-y-4 w-16 bg-gradient-to-l from-transparent via-[#FF5E1A]/45 to-[#FFB800]/65 blur-xl rounded-full" />
              <div className="pointer-events-none absolute -left-8 inset-y-6 w-12 bg-gradient-to-r from-transparent to-[#FF4D2E]/50 blur-lg rounded-full" />

              <div
                className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#FF4D2E]/30 border border-[#FFB800]/80 text-[#FFE066] font-mono font-black tracking-widest uppercase shadow-[0_0_20px_rgba(255,138,0,0.45)] ${
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
                    compact ? 'w-6 h-6 sm:w-8 sm:h-8' : 'w-8 h-8 sm:w-12 sm:h-12'
                  } text-[#FFB800] drop-shadow-[0_0_18px_#FF5E1A] shrink-0 animate-pulse`}
                />
                <h2
                  className={`font-display font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFF7CC] via-[#FFB800] to-[#FF4D2E] drop-shadow-[0_4px_24px_rgba(255,77,46,0.95)] ${
                    compact ? 'text-2xl sm:text-4xl' : 'text-2xl sm:text-5xl lg:text-6xl'
                  }`}
                >
                  {t('FRENZY TIME!', '烈焰狂热时间！')}
                </h2>
                <Flame
                  className={`${
                    compact ? 'w-6 h-6 sm:w-8 sm:h-8' : 'w-8 h-8 sm:w-12 sm:h-12'
                  } text-[#FFB800] drop-shadow-[0_0_18px_#FF5E1A] shrink-0 animate-pulse`}
                />
              </div>
            </div>
          </div>

          {/* STAGE 2 (1.2s -> 3.0s): SPECIAL FEATURES Sweeps in from Right -> Holds Center -> Exits Left */}
          <div
            style={{
              animation: 'jsFrenzyStage2 3.0s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            }}
            className="absolute inset-0 flex items-center justify-center px-3 sm:px-4 pb-7"
          >
            <div
              className={`relative w-[92%] rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#33110D]/96 via-[#1B0C0E]/96 to-[#12090C]/98 border-2 border-[#FFB800] text-center shadow-[0_0_70px_rgba(255,138,0,0.78)] ${
                compact ? 'max-w-xl p-3 sm:p-4' : 'max-w-2xl p-5 sm:p-7'
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
                <span>{t('FRENZY TIME · SPECIAL BOOSTS ACTIVE', '狂热时间 · 专属强化已激活')}</span>
                <Flame className="w-3.5 h-3.5 text-[#FF8A00] animate-pulse" />
              </div>

              <div
                className={`grid grid-cols-2 ${
                  compact ? 'mt-2 gap-2 sm:gap-3' : 'mt-4 gap-3.5'
                }`}
              >
                <div
                  className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#FF4D2E]/30 to-[#FF8A00]/15 border-2 border-[#FF5E1A] flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,77,46,0.35),inset_0_0_18px_rgba(255,77,46,0.25)] ${
                    compact ? 'px-2.5 py-2 sm:px-3.5 sm:py-3' : 'px-4 py-4'
                  }`}
                >
                  <Flame
                    className={`${
                      compact ? 'w-4 h-4 sm:w-6 sm:h-6' : 'w-7 h-7'
                    } text-[#FFB800] drop-shadow-[0_0_10px_#FF5E1A] shrink-0 animate-pulse`}
                  />
                  <span
                    className={`font-display font-black text-white drop-shadow leading-tight ${
                      compact ? 'text-xs sm:text-base' : 'text-lg sm:text-2xl'
                    }`}
                  >
                    {perk1Label}
                  </span>
                </div>

                <div
                  className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#FFB800]/28 to-[#FF5E1A]/15 border-2 border-[#FFB800] flex items-center justify-center gap-2 shadow-[0_0_24px_rgba(255,184,0,0.3),inset_0_0_18px_rgba(255,184,0,0.22)] ${
                    compact ? 'px-2.5 py-2 sm:px-3.5 sm:py-3' : 'px-4 py-4'
                  }`}
                >
                  <Zap
                    className={`${
                      compact ? 'w-4 h-4 sm:w-6 sm:h-6' : 'w-7 h-7'
                    } text-[#FFE066] drop-shadow-[0_0_10px_#FFB800] shrink-0 animate-pulse`}
                  />
                  <span
                    className={`font-display font-black text-white drop-shadow leading-tight ${
                      compact ? 'text-xs sm:text-base' : 'text-lg sm:text-2xl'
                    }`}
                  >
                    {perk2Label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Fiery Fuse Progress Bar */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-[82%] max-w-lg text-center ${
              compact ? 'bottom-2 sm:bottom-3.5' : 'bottom-4 sm:bottom-6'
            }`}
          >
            <div className="h-2 w-full rounded-full bg-[#2A1414]/90 border border-[#FF5E1A]/50 overflow-hidden p-0.5 shadow-[0_0_18px_rgba(255,77,46,0.45)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FF4D2E] via-[#FF8A00] to-[#FFE066] transition-[width] duration-75"
                style={{ width: `${fusePct}%` }}
              />
            </div>
            <div className="mt-1 font-mono text-[10px] sm:text-[11px] font-extrabold tracking-widest text-[#FFE066] uppercase tabular-nums drop-shadow">
              {t(
                `GET READY · RESUMING IN ${fuseSecs}...`,
                `全速狂飙 · ${fuseSecs} 秒后继续！`
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
