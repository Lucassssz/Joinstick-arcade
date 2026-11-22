import { useEffect, useRef, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { getGameGenre } from '../shared/games';
import type { GameId } from '../shared/types';
import {
  getCachedGameThumbnail,
  getStylizedGameThumbnail,
} from '../games/thumbnailGenerator';

interface GameThumbnailProps {
  gameId: GameId;
  gameName: string;
  accentHex: string;
  fallbackSrc?: string;
  alt?: string;
  className?: string;
  eager?: boolean;
}

/**
 * Renders a stylized promotional thumbnail captured directly from inside the real game engine.
 * Lazily triggers offscreen capture via IntersectionObserver and caches the resulting data URL.
 */
export function GameThumbnail({
  gameId,
  gameName,
  accentHex,
  fallbackSrc,
  alt,
  className = 'w-full h-full object-cover',
  eager = false,
}: GameThumbnailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [src, setSrc] = useState<string | null>(() => getCachedGameThumbnail(gameId));
  const [visible, setVisible] = useState<boolean>(eager || Boolean(getCachedGameThumbnail(gameId)));
  const [failed, setFailed] = useState(false);

  // Keep state synced when gameId prop changes (e.g., modal/rules hero switches game)
  useEffect(() => {
    const cached = getCachedGameThumbnail(gameId);
    setSrc(cached);
    setFailed(false);
    if (cached || eager) {
      setVisible(true);
    }
  }, [gameId, eager]);

  useEffect(() => {
    if (visible || src) return;
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '220px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, src]);

  useEffect(() => {
    if (!visible || src) return;
    let cancelled = false;
    const genre = getGameGenre(gameId);
    getStylizedGameThumbnail(gameId, accentHex, genre).then((url) => {
      if (cancelled) return;
      if (url) {
        setSrc(url);
      } else if (fallbackSrc) {
        setSrc(fallbackSrc);
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, src, gameId, accentHex, fallbackSrc]);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-[#101217]">
      {src && !failed ? (
        <img
          src={src}
          alt={alt ?? `${gameName} in-game preview`}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (fallbackSrc && src !== fallbackSrc) {
              setSrc(fallbackSrc);
            } else {
              setFailed(true);
            }
          }}
          className={`${className} animate-[fadeIn_220ms_ease-out]`}
        />
      ) : (
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-1.5"
          style={{
            background: `radial-gradient(circle at 50% 35%, ${accentHex}2E 0%, #141822 68%, #0C0F16 100%)`,
          }}
        >
          <Gamepad2 className="w-6 h-6 opacity-75 animate-pulse" style={{ color: accentHex }} />
          <span className="font-display text-[11px] font-bold text-white/75 px-2 text-center truncate max-w-full">
            {gameName}
          </span>
        </div>
      )}
    </div>
  );
}
