import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type CompetitiveSnapshot,
  type GameId,
  type GameSnapshot,
  type RoomStatus,
} from '../shared/types';
import { useLanguage } from '../lib/i18n';
import { renderGameSnapshot, type RenderFxState } from '../games/renderers';
import { preloadGameRenderer } from '../games/rendererRegistry';

interface PocketArenaCanvasProps {
  gameId: GameId;
  status: RoomStatus;
  snapshotRef: MutableRefObject<GameSnapshot | null>;
  competitiveRef: MutableRefObject<CompetitiveSnapshot | null>;
  fxRef: MutableRefObject<RenderFxState>;
  tickVersion: number;
  className?: string;
  frameClassName?: string;
  cameraFocus?: 'overview' | 'turn-focus';
}

export function PocketArenaCanvas({
  gameId,
  status,
  snapshotRef,
  competitiveRef,
  fxRef,
  tickVersion,
  className = '',
  frameClassName = '',
  cameraFocus = 'overview',
}: PocketArenaCanvasProps) {
  const { lang, t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const langRef = useRef(lang);
  const [hasSnapshot, setHasSnapshot] = useState(() => Boolean(snapshotRef.current));

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    preloadGameRenderer(gameId);
  }, [gameId]);

  useEffect(() => {
    if (snapshotRef.current && !hasSnapshot) {
      setHasSnapshot(true);
    }
  }, [tickVersion, snapshotRef, hasSnapshot]);

  useEffect(() => {
    if (status === 'SETUP' || status === 'LOBBY') return;
    let rafId = 0;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      const snap = snapshotRef.current;
      if (canvas && snap) {
        if (!hasSnapshot) setHasSnapshot(true);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderGameSnapshot(
            ctx,
            snap,
            fxRef.current,
            langRef.current,
            competitiveRef.current
          );
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [status, gameId, snapshotRef, competitiveRef, fxRef, hasSnapshot]);

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center bg-[#080A0F] overflow-hidden ${frameClassName} ${className}`}
    >
      <canvas
        ref={canvasRef}
        width={ARENA_WIDTH}
        height={ARENA_HEIGHT}
        className={`w-full h-full object-contain select-none pointer-events-none transition-transform duration-300 ease-out origin-[50%_51%] will-change-transform ${
          cameraFocus === 'turn-focus' ? 'scale-[1.26]' : 'scale-100'
        }`}
      />
      {!hasSnapshot && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#090B10]/90 text-xs font-semibold text-[#A5AEBD]">
          <Loader2 className="w-5 h-5 text-[#00C2FF] animate-spin" aria-hidden="true" />
          <span>{t('Syncing live arena…', '正在同步实时游戏画面…')}</span>
        </div>
      )}
    </div>
  );
}
