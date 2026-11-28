import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
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

// Strict browser LRU clip cache so browsing 200 games never leaks RAM
const MAX_CLIENT_CLIP_CACHE = 18;
const clipCache = new Map<GameId, DemoClipPayload>();
const inflightClips = new Map<GameId, Promise<DemoClipPayload | null>>();

function getCachedClip(gameId: GameId): DemoClipPayload | null {
  const hit = clipCache.get(gameId);
  if (!hit) return null;
  // Refresh recency
  clipCache.delete(gameId);
  clipCache.set(gameId, hit);
  return hit;
}

function putCachedClip(gameId: GameId, data: DemoClipPayload): void {
  if (clipCache.has(gameId)) {
    clipCache.delete(gameId);
  } else if (clipCache.size >= MAX_CLIENT_CLIP_CACHE) {
    const oldest = clipCache.keys().next().value;
    if (oldest) clipCache.delete(oldest);
  }
  clipCache.set(gameId, data);
}

async function fetchDemoClip(
  gameId: GameId,
  signal?: AbortSignal
): Promise<DemoClipPayload | null> {
  const cached = getCachedClip(gameId);
  if (cached) return cached;

  let task = inflightClips.get(gameId);
  if (!task) {
    task = (async () => {
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
        putCachedClip(gameId, data);
        return data;
      } catch {
        return null;
      } finally {
        inflightClips.delete(gameId);
      }
    })();
    inflightClips.set(gameId, task);
  }

  const result = await task;
  if (signal?.aborted) return null;
  return result;
}

export function isDemoClipReady(gameId: GameId): boolean {
  return clipCache.has(gameId);
}

export async function preloadDemoClip(gameId: GameId): Promise<boolean> {
  if (getCachedClip(gameId)) return true;
  const loaded = await fetchDemoClip(gameId);
  return Boolean(loaded);
}

interface GameHoverPreviewProps {
  gameId: GameId;
  gameName: string;
  accentHex: string;
  fallbackSrc?: string;
  alt?: string;
  active: boolean;
  eager?: boolean;
  immediate?: boolean;
  timecodePosition?: 'top-right' | 'bottom-right';
  className?: string;
}

/**
 * Displays the stylized GameThumbnail at rest, and when active/hovered plays a real
 * 5-second live gameplay clip directly from the game's engine and canvas renderer.
 * Uses bounded LRU memory, AbortController cancellation, and visibility pausing.
 */
export function GameHoverPreview({
  gameId,
  gameName,
  accentHex,
  fallbackSrc,
  alt,
  active,
  eager = false,
  immediate = false,
  timecodePosition = 'top-right',
  className = 'w-full h-full object-cover',
}: GameHoverPreviewProps) {
  const { lang } = useLanguage();
  const langRef = useRef(lang);
  langRef.current = lang;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressBarRef = useRef<HTMLDivElement | null>(null);
  const [clip, setClip] = useState<DemoClipPayload | null>(() => getCachedClip(gameId));
  const [playing, setPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // Sync cached clip if gameId changes
  useEffect(() => {
    setClip(getCachedClip(gameId));
    setPlaying(false);
    setElapsedSec(0);
  }, [gameId]);

  // Load 5-second gameplay clip with AbortController so fast card flips cancel stale requests
  useEffect(() => {
    if (!active) {
      setPlaying(false);
      setElapsedSec(0);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const cached = getCachedClip(gameId);
    if (cached) {
      ensureGameRendererLoaded(gameId).then(() => {
        if (!cancelled) {
          setClip(cached);
          setPlaying(true);
        }
      });
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const startFetch = () => {
      fetchDemoClip(gameId, controller.signal).then((loaded) => {
        if (!cancelled && loaded) {
          setClip(loaded);
          setPlaying(true);
        }
      });
    };

    if (immediate) {
      startFetch();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }

    const timer = window.setTimeout(startFetch, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, gameId, immediate]);

  // Real-time 5-second looping playback loop over authoritative gameplay frames
  // Automatically pauses when the browser tab is hidden to save CPU/GPU.
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
      if (typeof document !== 'undefined' && document.hidden) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      const elapsed = Math.max(0, now - startTime) % durationMs;
      const progress = elapsed / durationMs;
      const frameIdx = Math.max(0, Math.min(totalFrames - 1, Math.floor(progress * totalFrames)));

      if (frameIdx !== lastRenderedIdx) {
        lastRenderedIdx = frameIdx;
        const frame = clip.frames[frameIdx];
        if (frame) {
          renderGameSnapshot(ctx, frame, fx, langRef.current);
        }
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

    if (clip.frames[0]) {
      renderGameSnapshot(ctx, clip.frames[0], fx, langRef.current);
    }
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

      {/* Buffering Progress Sweep while active 5s clip streams in */}
      {active && !showCanvas && (
        <>
          <div
            className={`pointer-events-none absolute z-10 px-2 py-0.5 rounded-md bg-[#0B0E16]/85 backdrop-blur-xs border border-white/15 font-mono text-[10px] font-bold text-[#00C2FF] inline-flex items-center gap-1 shadow ${
              timecodePosition === 'bottom-right' ? 'bottom-3 right-3' : 'top-3 right-3'
            }`}
          >
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{lang === 'zh' ? '加载实机演示' : 'Loading 5s clip'}</span>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1 bg-black/60 overflow-hidden">
            <div
              className="h-full w-1/2 rounded-full card-loading-sweep"
              style={{
                background: `linear-gradient(90deg, transparent, ${accentHex}, #00C2FF, transparent)`,
              }}
            />
          </div>
        </>
      )}

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
