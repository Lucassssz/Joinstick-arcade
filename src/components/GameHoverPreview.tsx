import { useEffect, useRef, useState } from 'react';
import { ARENA_HEIGHT, ARENA_WIDTH, type GameId, type GameSnapshot } from '../shared/types';
import { ensureGameRendererLoaded } from '../games/rendererRegistry';
import { createRenderFxState, renderGameSnapshot } from '../games/renderers';
import { useLanguage } from '../lib/i18n';
import { GameThumbnail } from './GameThumbnail';

interface DemoClipPayload {
  gameId: GameId;
  durationMs: number;
  fps: number;
  frames: GameSnapshot[];
}

const clipCache = new Map<GameId, DemoClipPayload>();
const inflightClips = new Map<GameId, Promise<DemoClipPayload | null>>();

function fetchDemoClip(gameId: GameId): Promise<DemoClipPayload | null> {
  const cached = clipCache.get(gameId);
  if (cached) return Promise.resolve(cached);

  const existing = inflightClips.get(gameId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const [resp] = await Promise.all([
        fetch(`/api/demo-clip/${encodeURIComponent(gameId)}`),
        ensureGameRendererLoaded(gameId),
      ]);
      if (!resp.ok) return null;
      const data = (await resp.json()) as DemoClipPayload;
      if (!data || !Array.isArray(data.frames) || data.frames.length === 0) {
        return null;
      }
      clipCache.set(gameId, data);
      return data;
    } catch {
      return null;
    } finally {
      inflightClips.delete(gameId);
    }
  })();

  inflightClips.set(gameId, promise);
  return promise;
}

interface GameHoverPreviewProps {
  gameId: GameId;
  gameName: string;
  accentHex: string;
  fallbackSrc?: string;
  alt?: string;
  active: boolean;
  eager?: boolean;
  timecodePosition?: 'top-right' | 'bottom-right';
  className?: string;
}

/**
 * Displays the stylized GameThumbnail at rest, and when hovered plays a real
 * 5-second live gameplay clip directly from the game's engine and canvas renderer.
 */
export function GameHoverPreview({
  gameId,
  gameName,
  accentHex,
  fallbackSrc,
  alt,
  active,
  eager = false,
  timecodePosition = 'top-right',
  className = 'w-full h-full object-cover',
}: GameHoverPreviewProps) {
  const { lang } = useLanguage();
  const langRef = useRef(lang);
  langRef.current = lang;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [clip, setClip] = useState<DemoClipPayload | null>(() => clipCache.get(gameId) ?? null);
  const [playing, setPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Sync cached clip if gameId changes
  useEffect(() => {
    setClip(clipCache.get(gameId) ?? null);
    setPlaying(false);
    setElapsedSec(0);
  }, [gameId]);

  // Load 5-second gameplay clip on hover (instant if cached, 120ms hover-intent delay otherwise)
  useEffect(() => {
    if (!active) {
      setPlaying(false);
      setElapsedSec(0);
      return;
    }

    let cancelled = false;
    const cached = clipCache.get(gameId);
    if (cached) {
      ensureGameRendererLoaded(gameId).then(() => {
        if (!cancelled) {
          setClip(cached);
          setPlaying(true);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const timer = window.setTimeout(() => {
      fetchDemoClip(gameId).then((loaded) => {
        if (!cancelled && loaded) {
          setClip(loaded);
          setPlaying(true);
        }
      });
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, gameId]);

  // Real-time 5-second looping playback loop over the authoritative gameplay frames
  useEffect(() => {
    if (!active || !playing || !clip || clip.frames.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fx = createRenderFxState();
    const durationMs = clip.durationMs || 5000;
    const totalFrames = clip.frames.length;
    const startTime = performance.now();
    let lastRenderedIdx = -1;
    let lastSecDisplay = -1;
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = (now - startTime) % durationMs;
      const progress = elapsed / durationMs;
      const frameIdx = Math.min(totalFrames - 1, Math.floor(progress * totalFrames));

      if (frameIdx !== lastRenderedIdx) {
        lastRenderedIdx = frameIdx;
        renderGameSnapshot(ctx, clip.frames[frameIdx], fx, langRef.current);
      }

      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${progress.toFixed(4)})`;
      }

      const secInt = Math.min(5, Math.floor(elapsed / 1000) + 1);
      if (secInt !== lastSecDisplay) {
        lastSecDisplay = secInt;
        setElapsedSec(secInt);
      }

      rafId = requestAnimationFrame(tick);
    };

    // Immediately paint frame 0 so crossfade never reveals a blank canvas
    renderGameSnapshot(ctx, clip.frames[0], fx, langRef.current);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [active, playing, clip]);

  const showCanvas = active && playing && Boolean(clip);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#101217]">
      <GameThumbnail
        gameId={gameId}
        gameName={gameName}
        accentHex={accentHex}
        fallbackSrc={fallbackSrc}
        alt={alt}
        eager={eager}
        className={className}
      />

      {/* 5-Second Live In-Game Gameplay Scene Canvas */}
      <canvas
        ref={canvasRef}
        width={ARENA_WIDTH}
        height={ARENA_HEIGHT}
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
          showCanvas ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Sleek 5-Second Preview Timecode + Progress Bar */}
      {showCanvas && (
        <>
          <div
            className={`pointer-events-none absolute z-10 px-2 py-0.5 rounded-md bg-[#0B0E16]/82 backdrop-blur-xs border border-white/15 font-mono text-[10px] font-bold text-white tabular-nums shadow ${
              timecodePosition === 'bottom-right' ? 'bottom-3 right-3' : 'top-3 right-3'
            }`}
          >
            0:0{Math.max(1, Math.min(5, elapsedSec))} / 0:05
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1 bg-black/55 overflow-hidden">
            <div
              ref={progressBarRef}
              className="h-full w-full origin-left"
              style={{
                backgroundColor: accentHex,
                transform: 'scaleX(0)',
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
