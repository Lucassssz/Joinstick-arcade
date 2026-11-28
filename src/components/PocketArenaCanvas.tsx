import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
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
import type { LocalPaddlePrediction } from '../games/arcadeMotion';
import { isGameRendererReady, preloadRenderer } from '../games/rendererRegistry';

interface PocketArenaCanvasProps {
  gameId: GameId;
  status: RoomStatus;
  snapshotRef: MutableRefObject<GameSnapshot | null>;
  competitiveRef: MutableRefObject<CompetitiveSnapshot | null>;
  fxRef: MutableRefObject<RenderFxState>;
  tickVersion: number;
  className?: string;
  frameClassName?: string;
  cameraFocus?: 'overview' | 'table-overview-zoom' | 'turn-focus';
  highlightPlayerId?: string;
  highlightColorHex?: string;
  showYouMarker?: boolean;
  hidePlayerId?: string | null;
  localPredictionRef?: MutableRefObject<LocalPaddlePrediction | null>;
}

function drawYouBeacon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  colorHex: string,
  label: string
) {
  const nowSec = performance.now() * 0.001;
  const pulse = 0.5 + 0.5 * Math.sin(nowSec * 6.2);
  const bob = Math.sin(nowSec * 5.0) * 4;
  const ringR = 30 + pulse * 10;

  ctx.save();
  // Pulsing ground target ring around player's character
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.9 - pulse * 0.4;
  ctx.beginPath();
  ctx.arc(x, y, ringR, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.75;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.arc(x, y, 25, 0, Math.PI * 2);
  ctx.stroke();

  // Floating "▼ YOU" pill above player pod
  ctx.globalAlpha = 1;
  const tagY = Math.max(40, y - 54 + bob);
  ctx.font = '900 15px Inter, system-ui, sans-serif';
  const textW = ctx.measureText(label).width;
  const boxW = textW + 20;
  const boxH = 26;
  const boxX = Math.max(12, Math.min(ARENA_WIDTH - boxW - 12, x - boxW / 2));
  const boxY = tagY - boxH / 2;

  ctx.fillStyle = 'rgba(11, 14, 20, 0.92)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, 8);
  ctx.fill();

  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Downward pointer triangle toward character
  const ptrX = Math.max(boxX + 10, Math.min(boxX + boxW - 10, x));
  ctx.fillStyle = colorHex;
  ctx.beginPath();
  ctx.moveTo(ptrX - 6, boxY + boxH);
  ctx.lineTo(ptrX + 6, boxY + boxH);
  ctx.lineTo(ptrX, boxY + boxH + 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, boxX + boxW / 2, boxY + boxH / 2 + 0.5);
  ctx.restore();
}

function resolveYouBeaconScreenPos(
  snap: GameSnapshot,
  playerId: string
): { x: number; y: number } | null {
  const s = snap as unknown as {
    gameId?: string;
    cols?: number;
    rows?: number;
    cameraX?: number;
    cameraY?: number;
    snakes?: Array<{ id?: string; alive?: boolean; segments?: Array<{ x: number; y: number }> }>;
    players?: Array<{
      id?: string;
      x?: number;
      y?: number;
      z?: number;
      tipX?: number;
      tipY?: number;
      laneX?: number;
      alive?: boolean;
      eliminated?: boolean;
      finished?: boolean;
    }>;
  };

  if (s.gameId === 'slither-feast' && Array.isArray(s.snakes)) {
    const mine = s.snakes.find((sn) => sn.id === playerId && sn.alive !== false);
    const head = mine?.segments?.[0];
    if (head && Number.isFinite(head.x) && Number.isFinite(head.y)) {
      return { x: head.x, y: head.y };
    }
    return null;
  }

  const me = Array.isArray(s.players) ? s.players.find((p) => p.id === playerId) : undefined;
  if (!me || me.alive === false || me.eliminated === true) return null;

  let sx: number | undefined;
  let sy: number | undefined;

  if (s.gameId === 'turf-ribbon' && typeof me.x === 'number' && typeof me.y === 'number') {
    const cols = s.cols || 36;
    const rows = s.rows || 22;
    sx = 72 + me.x * ((ARENA_WIDTH - 144) / cols);
    sy = 66 + me.y * ((ARENA_HEIGHT - 102) / rows);
  } else if (s.gameId === 'maze-chomper' && typeof me.x === 'number' && typeof me.y === 'number') {
    const cols = s.cols || 19;
    const rows = s.rows || 11;
    const bw = 1045;
    const bh = 605;
    sx = (ARENA_WIDTH - bw) / 2 + me.x * (bw / cols);
    sy = 76 + me.y * (bh / rows);
  } else if (s.gameId === 'tunnel-dig' && typeof me.x === 'number' && typeof me.y === 'number') {
    const cols = s.cols || 20;
    const rows = s.rows || 12;
    const bw = 1040;
    const bh = 600;
    sx = (ARENA_WIDTH - bw) / 2 + me.x * (bw / cols);
    sy = 82 + me.y * (bh / rows);
  } else if (s.gameId === 'geo-pin-rush' && typeof me.x === 'number' && typeof me.y === 'number') {
    sx = 70 + me.x * (ARENA_WIDTH - 140);
    sy = 152 + me.y * 510;
  } else if (s.gameId === 'hotpot-rush' && typeof me.tipX === 'number' && typeof me.tipY === 'number') {
    sx = me.tipX;
    sy = me.tipY;
  } else if (s.gameId === 'pin-strike' && typeof me.laneX === 'number') {
    sx = me.laneX;
    sy = 636;
  } else if (s.gameId === 'bubble-pop-arc' && typeof me.x === 'number') {
    sx = me.x;
    sy = 632;
  } else if (s.gameId === 'coin-dozer' && typeof me.x === 'number') {
    sx = me.x;
    sy = 99;
  } else if (s.gameId === 'block-hop' && typeof me.x === 'number' && typeof me.y === 'number') {
    sx = me.x + ARENA_WIDTH * 0.45 - (s.cameraX ?? 0);
    sy = me.y + ARENA_HEIGHT * 0.56 - (s.cameraY ?? 0) - 26 - (me.z ?? 0);
  } else if (
    (s.gameId === 'platform-leap' || s.gameId === 'sky-climb') &&
    typeof me.x === 'number' &&
    typeof me.y === 'number'
  ) {
    sx = me.x;
    sy = me.y - (s.cameraY ?? 0);
  } else if (s.gameId === 'egg-rush' && typeof me.x === 'number' && typeof me.y === 'number') {
    sx = me.x - (s.cameraX ?? 0);
    sy = me.y - (me.z ?? 0);
  } else if (typeof me.x === 'number' && typeof me.y === 'number') {
    sx = me.x;
    sy = me.y;
  }

  if (
    typeof sx === 'number' &&
    typeof sy === 'number' &&
    Number.isFinite(sx) &&
    Number.isFinite(sy) &&
    sx >= 10 &&
    sx <= ARENA_WIDTH - 10 &&
    sy >= 10 &&
    sy <= ARENA_HEIGHT - 10
  ) {
    return { x: sx, y: sy };
  }
  return null;
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
  highlightPlayerId,
  highlightColorHex = '#10D98B',
  showYouMarker = false,
  hidePlayerId = null,
  localPredictionRef,
}: PocketArenaCanvasProps) {
  const { lang, t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const langRef = useRef(lang);
  const hidePlayerIdRef = useRef<string | null>(hidePlayerId);
  const markerCfgRef = useRef({
    playerId: highlightPlayerId,
    colorHex: highlightColorHex,
    show: showYouMarker,
  });
  const [hasSnapshot, setHasSnapshot] = useState(() => Boolean(snapshotRef.current));

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    hidePlayerIdRef.current = hidePlayerId ?? null;
  }, [hidePlayerId]);

  useEffect(() => {
    markerCfgRef.current = {
      playerId: highlightPlayerId,
      colorHex: highlightColorHex,
      show: showYouMarker,
    };
  }, [highlightPlayerId, highlightColorHex, showYouMarker]);

  const [rendererReady, setRendererReady] = useState<boolean>(() => isGameRendererReady(gameId));
  const [rendererError, setRendererError] = useState<boolean>(false);

  const loadGameChunk = useCallback(() => {
    if (isGameRendererReady(gameId)) {
      setRendererReady(true);
      setRendererError(false);
      return;
    }
    setRendererReady(false);
    setRendererError(false);
    preloadRenderer(gameId)
      .then(() => {
        setRendererReady(true);
        setRendererError(false);
      })
      .catch(() => {
        setRendererReady(false);
        setRendererError(true);
      });
  }, [gameId]);

  useEffect(() => {
    let active = true;
    if (isGameRendererReady(gameId)) {
      setRendererReady(true);
      setRendererError(false);
      return;
    }
    setRendererReady(false);
    setRendererError(false);
    preloadRenderer(gameId)
      .then(() => {
        if (active) {
          setRendererReady(true);
          setRendererError(false);
        }
      })
      .catch(() => {
        if (active) {
          setRendererReady(false);
          setRendererError(true);
        }
      });
    return () => {
      active = false;
    };
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
      if (canvas && snap && isGameRendererReady(snap.gameId)) {
        if (!hasSnapshot) setHasSnapshot(true);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          fxRef.current.localPrediction =
            status === 'PLAYING' ? (localPredictionRef?.current ?? null) : null;
          renderGameSnapshot(
            ctx,
            snap,
            fxRef.current,
            langRef.current,
            competitiveRef.current,
            hidePlayerIdRef.current
          );
          const marker = markerCfgRef.current;
          if (marker.show && marker.playerId) {
            const pos = resolveYouBeaconScreenPos(snap, marker.playerId);
            if (pos) {
              drawYouBeacon(
                ctx,
                pos.x,
                pos.y,
                marker.colorHex,
                langRef.current === 'zh' ? '▼ 你在这里' : '▼ YOU'
              );
            }
          }
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [status, gameId, snapshotRef, competitiveRef, fxRef, hasSnapshot, rendererReady]);

  const zoomClass =
    cameraFocus === 'turn-focus'
      ? 'scale-[1.34]'
      : cameraFocus === 'table-overview-zoom'
      ? 'scale-[1.06]'
      : 'scale-100';

  return (
    <div
      className={`relative w-full h-full flex items-center justify-center bg-[#080A0F] overflow-hidden ${frameClassName} ${className}`}
    >
      <canvas
        ref={canvasRef}
        width={ARENA_WIDTH}
        height={ARENA_HEIGHT}
        className={`w-full h-full object-contain select-none pointer-events-none transition-transform duration-300 ease-out origin-[50%_51%] will-change-transform ${zoomClass}`}
      />
      {rendererError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-[#090B10]/95 px-4 text-center text-xs font-semibold text-[#FCA5A5]">
          <span>{t('Failed to load arena module. Check your connection.', '加载竞技场模块失败，请检查网络连接。')}</span>
          <button
            type="button"
            onClick={loadGameChunk}
            className="h-8 px-3.5 rounded-lg bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('Retry', '重试')}</span>
          </button>
        </div>
      ) : (!hasSnapshot || !rendererReady) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#090B10]/90 text-xs font-semibold text-[#A5AEBD]">
          <Loader2 className="w-5 h-5 text-[#00C2FF] animate-spin" aria-hidden="true" />
          <span>{t('Syncing live arena…', '正在同步实时游戏画面…')}</span>
        </div>
      )}
    </div>
  );
}
