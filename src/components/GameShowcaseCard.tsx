import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { getGameGenre } from '../shared/games';
import { getPadTutorialGuide } from '../shared/padProfiles';
import type { GameId, GameMetadata } from '../shared/types';
import { getLocalizedFilterLabel, useLanguage } from '../lib/i18n';
import { preloadGameRenderer } from '../games/rendererRegistry';
import {
  getCachedGameThumbnail,
  getStylizedGameThumbnail,
} from '../games/thumbnailGenerator';
import { GameHoverPreview, isDemoClipReady, preloadDemoClip } from './GameHoverPreview';
import { isRuleClipsReady, preloadRuleClips } from './WatchAndPlayCardCanvas';

type CardLoadPhase = 'idle' | 'loading' | 'ready';

interface GameShowcaseCardProps {
  game: GameMetadata;
  index: number;
  isSpotlight: boolean;
  isNearSpotlight: boolean;
  railRoot: HTMLElement | null;
  onHoverChange: (gameId: GameId | null) => void;
  onOpenDetails: (gameId: GameId) => void;
}

/**
 * Horizontal showcase card featuring an IntersectionObserver-driven preload pipeline
 * and animated progress bar that switches into a 'loading' visual state as automatic
 * or manual scroll shifts toward the next upcoming game.
 */
export function GameShowcaseCard({
  game,
  index,
  isSpotlight,
  isNearSpotlight,
  railRoot,
  onHoverChange,
  onOpenDetails,
}: GameShowcaseCardProps) {
  const { lang, t } = useLanguage();
  const cardRef = useRef<HTMLElement | null>(null);
  const padGuide = getPadTutorialGuide(game.id, lang);

  const checkAllCached = (id: GameId) =>
    Boolean(getCachedGameThumbnail(id)) && isDemoClipReady(id) && isRuleClipsReady(id);

  const [inPreloadZone, setInPreloadZone] = useState(false);
  const [loadPhase, setLoadPhase] = useState<CardLoadPhase>(() =>
    checkAllCached(game.id) ? 'ready' : 'idle'
  );
  const [progressRatio, setProgressRatio] = useState<number>(() =>
    checkAllCached(game.id) ? 1 : 0
  );
  const [showReadyFlash, setShowReadyFlash] = useState(false);

  // Sync phase cleanly when game id switches (e.g., filter or search updates)
  useEffect(() => {
    const cached = checkAllCached(game.id);
    setLoadPhase(cached ? 'ready' : 'idle');
    setProgressRatio(cached ? 1 : 0);
    setShowReadyFlash(false);
  }, [game.id]);

  // IntersectionObserver watching horizontal rail proximity (triggers preload 260px ahead of entering)
  useEffect(() => {
    const node = cardRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInPreloadZone(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInPreloadZone(true);
          } else {
            setInPreloadZone(false);
          }
        }
      },
      {
        root: railRoot,
        rootMargin: '0px 260px 0px 260px',
        threshold: [0, 0.25, 0.6],
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [railRoot, game.id]);

  // Trigger real predictive preloading + staged progress bar when entering preload zone or spotlight
  useEffect(() => {
    const shouldWarm = inPreloadZone || isSpotlight || isNearSpotlight;
    if (!shouldWarm) return;

    if (checkAllCached(game.id)) {
      setLoadPhase('ready');
      setProgressRatio(1);
      return;
    }

    let cancelled = false;
    setLoadPhase('loading');
    setShowReadyFlash(false);

    let doneSteps = 0;
    const totalSteps = 3;
    const initialDone =
      (getCachedGameThumbnail(game.id) ? 1 : 0) +
      (isDemoClipReady(game.id) ? 1 : 0) +
      (isRuleClipsReady(game.id) ? 1 : 0);
    setProgressRatio(Math.max(0.18, initialDone / totalSteps));

    const advanceStep = () => {
      if (cancelled) return;
      doneSteps = Math.min(totalSteps, doneSteps + 1);
      const ratio = Math.max(0.24, Math.min(0.96, doneSteps / totalSteps));
      setProgressRatio((prev) => Math.max(prev, ratio));
    };

    preloadGameRenderer(game.id);

    const thumbTask = getCachedGameThumbnail(game.id)
      ? Promise.resolve(getCachedGameThumbnail(game.id)).then((v) => {
          advanceStep();
          return v;
        })
      : getStylizedGameThumbnail(game.id, game.accentHex, getGameGenre(game.id)).then((v) => {
          advanceStep();
          return v;
        });

    const clipTask = preloadDemoClip(game.id).then((v) => {
      advanceStep();
      return v;
    });

    const ruleTask = preloadRuleClips(game.id).then((v) => {
      advanceStep();
      return v;
    });

    let flashTimer: number | undefined;
    Promise.allSettled([thumbTask, clipTask, ruleTask]).then(() => {
      if (cancelled) return;
      setProgressRatio(1);
      setLoadPhase('ready');
      setShowReadyFlash(true);
      flashTimer = window.setTimeout(() => {
        if (!cancelled) setShowReadyFlash(false);
      }, 650);
    });

    return () => {
      cancelled = true;
      if (flashTimer !== undefined) window.clearTimeout(flashTimer);
    };
  }, [inPreloadZone, isSpotlight, isNearSpotlight, game.id, game.accentHex]);

  const isLoading = loadPhase === 'loading';
  const progressPercent = Math.round(progressRatio * 100);

  return (
    <article
      ref={cardRef}
      data-game-card-idx={index}
      onMouseEnter={() => {
        preloadGameRenderer(game.id);
        void preloadDemoClip(game.id);
        void preloadRuleClips(game.id);
        onHoverChange(game.id);
      }}
      onMouseLeave={() => {
        onHoverChange(null);
      }}
      className={`group w-[290px] sm:w-[325px] shrink-0 rounded-2xl bg-[#141A26] border overflow-hidden flex flex-col justify-between transition-all shadow-lg ${
        isSpotlight
          ? 'border-[#00C2FF]/80 -translate-y-0.5 shadow-[0_12px_32px_rgba(0,194,255,0.16)]'
          : isLoading
          ? 'border-[#00C2FF]/45 shadow-[0_8px_24px_rgba(0,194,255,0.08)]'
          : 'border-[#20293B] hover:border-[#00C2FF]/50'
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpenDetails(game.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenDetails(game.id);
          }
        }}
        aria-label={t(
          `View rules and preview for ${game.name}`,
          `查看 ${game.name} 规则与演示`
        )}
        className="cursor-pointer focus:outline-none flex-1 flex flex-col"
      >
        <div className="relative aspect-video w-full bg-[#0B0E14] overflow-hidden">
          <GameHoverPreview
            gameId={game.id}
            gameName={game.name}
            accentHex={game.accentHex}
            fallbackSrc={game.coverImage}
            alt={game.name}
            active={isSpotlight}
            eager={inPreloadZone || isNearSpotlight}
            immediate={isSpotlight}
            timecodePosition="bottom-right"
            className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${
              isLoading && !isSpotlight ? 'brightness-[0.86]' : ''
            }`}
          />

          {/* Subtle Shimmer Sweep Overlay during IntersectionObserver Preload */}
          {isLoading && !isSpotlight && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-t from-[#0B0E14]/60 via-transparent to-transparent">
              <div
                className="absolute inset-y-0 left-0 w-1/2 opacity-30 card-loading-sweep"
                style={{
                  background: `linear-gradient(90deg, transparent, ${game.accentHex}88, transparent)`,
                }}
              />
            </div>
          )}

          {/* IntersectionObserver Preload Progress Bar along Bottom Edge of Preview */}
          {(isLoading || showReadyFlash) && !isSpotlight && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1.5 bg-[#090C12]/80 overflow-hidden"
            >
              <div
                className="h-full w-full origin-left transition-transform duration-250 ease-out"
                style={{
                  backgroundColor: showReadyFlash ? '#10D98B' : game.accentHex,
                  transform: `scaleX(${progressRatio.toFixed(3)})`,
                }}
              />
              {isLoading && (
                <div
                  className="absolute inset-y-0 left-0 w-1/3 card-loading-sweep"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent)',
                  }}
                />
              )}
            </div>
          )}
        </div>

        <div className="p-4 flex-1 flex flex-col justify-between">
          <div>
            <div className="text-xs font-medium text-[#9CA3AF] flex items-center gap-2 truncate">
              <span className="text-[#00C2FF] font-semibold">
                {getLocalizedFilterLabel(getGameGenre(game.id), lang, true)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">{game.category}</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#D1D5DB] tabular-nums shrink-0">
                {game.playerModeLabel}
              </span>
            </div>

            <h3 className="mt-1.5 font-display text-lg font-bold text-white group-hover:text-[#00C2FF] transition-colors truncate">
              {game.name}
            </h3>

            <p className="mt-1.5 text-xs text-[#9CA3AF] line-clamp-2 leading-relaxed">
              {game.description}
            </p>
          </div>

          <div className="mt-3 pt-2.5 border-t border-[#1F2633] flex items-center justify-between gap-2 text-xs">
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5 text-[#00C2FF] font-medium truncate">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span className="truncate">
                  {t('Loading preview…', '正在加载演示…')}
                </span>
                <span className="font-mono text-[11px] tabular-nums opacity-85">
                  {progressPercent}%
                </span>
              </span>
            ) : showReadyFlash ? (
              <span className="inline-flex items-center gap-1 text-[#10D98B] font-medium truncate">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{t('Preview ready', '演示已就绪')}</span>
              </span>
            ) : (
              <span className="text-[#9CA3AF] truncate">{padGuide.padTitle}</span>
            )}

            <span className="font-semibold text-[#00C2FF] whitespace-nowrap shrink-0 group-hover:translate-x-0.5 transition-transform">
              {t('Rules & Demo →', '规则与演示 →')}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
