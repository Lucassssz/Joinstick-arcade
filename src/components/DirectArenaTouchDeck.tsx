import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type CardPrivateState,
  type ControllerInput,
  type DrawGuessRelaySnapshot,
  type GameId,
  type GameSnapshot,
  type MiniGolfProSnapshot,
} from '../shared/types';
import type { PocketDirectTouchMode } from '../shared/padProfiles';
import type { LocalPaddlePrediction } from '../games/arcadeMotion';
import { useLanguage } from '../lib/i18n';

const SKETCH_BRUSH_COLORS = ['#111827', '#EF4444', '#2563EB', '#10B981', '#F59E0B', '#9333EA'];

interface DirectArenaTouchDeckProps {
  mode: PocketDirectTouchMode;
  gameId: GameId;
  playerId: string;
  accentHex: string;
  snapshotRef: MutableRefObject<GameSnapshot | null>;
  cardState?: CardPrivateState | null;
  isCssRotated: boolean;
  disabled: boolean;
  cooldownA: number;
  onSendDirectInput: (patch: Partial<ControllerInput>, force?: boolean) => void;
  onPulseActionA: () => void;
  onLocalPrediction?: (pred: LocalPaddlePrediction | null) => void;
}

const GOLF_CANCEL_PULL = 22;
const GOLF_MAX_PULL = 220;

interface WallRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function raycastGolfPreview(
  startX: number,
  startY: number,
  angle: number,
  maxDist: number,
  walls: WallRect[]
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];
  let rx = startX;
  let ry = startY;
  let vx = Math.cos(angle);
  let vy = Math.sin(angle);
  let remaining = maxDist;

  // Course bounds (matching miniGolfProModule ball radius 14)
  const minX = 105;
  const maxX = ARENA_WIDTH - 105;
  const minY = 125;
  const maxY = ARENA_HEIGHT - 85;
  const padWalls = walls.map((w) => ({
    x0: w.x - 14,
    y0: w.y - 14,
    x1: w.x + w.w + 14,
    y1: w.y + w.h + 14,
  }));

  for (let bounce = 0; bounce < 2 && remaining > 4; bounce++) {
    let bestT = remaining;
    let hitAxis: 'x' | 'y' | null = null;

    // Outer bounds
    if (vx > 0.0001) {
      const t = (maxX - rx) / vx;
      if (t >= 0.5 && t < bestT) {
        bestT = t;
        hitAxis = 'x';
      }
    } else if (vx < -0.0001) {
      const t = (minX - rx) / vx;
      if (t >= 0.5 && t < bestT) {
        bestT = t;
        hitAxis = 'x';
      }
    }
    if (vy > 0.0001) {
      const t = (maxY - ry) / vy;
      if (t >= 0.5 && t < bestT) {
        bestT = t;
        hitAxis = 'y';
      }
    } else if (vy < -0.0001) {
      const t = (minY - ry) / vy;
      if (t >= 0.5 && t < bestT) {
        bestT = t;
        hitAxis = 'y';
      }
    }

    // Obstacle AABBs (slab intersection)
    for (const box of padWalls) {
      const invX = Math.abs(vx) > 0.0001 ? 1 / vx : 1e9;
      const invY = Math.abs(vy) > 0.0001 ? 1 / vy : 1e9;
      const t1 = (box.x0 - rx) * invX;
      const t2 = (box.x1 - rx) * invX;
      const t3 = (box.y0 - ry) * invY;
      const t4 = (box.y1 - ry) * invY;

      const tminX = Math.min(t1, t2);
      const tmaxX = Math.max(t1, t2);
      const tminY = Math.min(t3, t4);
      const tmaxY = Math.max(t3, t4);

      const tEnter = Math.max(tminX, tminY);
      const tExit = Math.min(tmaxX, tmaxY);

      if (tExit >= Math.max(0.5, tEnter) && tEnter >= 0.5 && tEnter < bestT) {
        bestT = tEnter;
        hitAxis = tminX > tminY ? 'x' : 'y';
      }
    }

    rx += vx * bestT;
    ry += vy * bestT;
    pts.push({ x: rx, y: ry });
    remaining -= bestT;

    if (!hitAxis) break;
    if (hitAxis === 'x') vx = -vx;
    else vy = -vy;
  }

  return pts;
}

export function DirectArenaTouchDeck({
  mode,
  gameId,
  playerId,
  accentHex,
  snapshotRef,
  cardState,
  isCssRotated,
  disabled,
  cooldownA,
  onSendDirectInput,
  onPulseActionA,
  onLocalPrediction,
}: DirectArenaTouchDeckProps) {
  const { t } = useLanguage();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activePointerIdRef = useRef<number | null>(null);
  const downWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const curWorldRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastMoveWorldRef = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastTapAtRef = useRef<number>(0);
  const lastAutoSmashAtRef = useRef<number>(0);
  const releaseSeqRef = useRef<number>(0);
  const releaseClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  const [showHint, setShowHint] = useState(true);

  const getArenaLayout = () => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) {
      return { offsetX: 0, offsetY: 0, drawW: 800, drawH: 480 };
    }
    const localW = isCssRotated ? rect.height : rect.width;
    const localH = isCssRotated ? rect.width : rect.height;
    const arenaAspect = ARENA_WIDTH / ARENA_HEIGHT;
    const boxAspect = localW / Math.max(1, localH);
    let drawW = localW;
    let drawH = localH;
    let offsetX = 0;
    let offsetY = 0;
    if (boxAspect > arenaAspect) {
      drawW = localH * arenaAspect;
      offsetX = (localW - drawW) / 2;
    } else {
      drawH = localW / arenaAspect;
      offsetY = (localH - drawH) / 2;
    }
    return { offsetX, offsetY, drawW, drawH };
  };

  const clientToWorld = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2 };
    const localX = isCssRotated ? clientY - rect.top : clientX - rect.left;
    const localY = isCssRotated ? rect.right - clientX : clientY - rect.top;
    const { offsetX, offsetY, drawW, drawH } = getArenaLayout();
    const wx = ((localX - offsetX) / Math.max(1, drawW)) * ARENA_WIDTH;
    const wy = ((localY - offsetY) / Math.max(1, drawH)) * ARENA_HEIGHT;
    return {
      x: Math.max(0, Math.min(ARENA_WIDTH, wx)),
      y: Math.max(0, Math.min(ARENA_HEIGHT, wy)),
    };
  };

  const resetPointerState = () => {
    activePointerIdRef.current = null;
    isDraggingRef.current = false;
    lastMoveWorldRef.current = null;
    onLocalPrediction?.(null);
    onSendDirectInput(
      {
        dx: 0,
        dy: 0,
        a: false,
        targetX: undefined,
        targetY: undefined,
        aimAngle: undefined,
        shootPower: undefined,
      },
      true
    );
  };

  useEffect(() => {
    setShowHint(true);
    return () => {
      if (releaseClearTimerRef.current) {
        clearTimeout(releaseClearTimerRef.current);
        releaseClearTimerRef.current = null;
      }
      resetPointerState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, mode]);

  useEffect(() => {
    if (disabled) {
      resetPointerState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  // 60fps overlay canvas for crisp slingshot trajectory / active paddle halo
  useEffect(() => {
    let rafId = 0;
    const renderOverlay = () => {
      const canvas = overlayCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
          const snap = snapshotRef.current;
          const nowSec = performance.now() * 0.001;

          if (snap && mode === 'golf-slingshot' && snap.gameId === 'mini-golf-pro') {
            const golfSnap = snap as MiniGolfProSnapshot;
            const me = golfSnap.players.find((p) => p.id === playerId);
            if (me && !me.sunk) {
              const speed = Math.hypot(me.vx, me.vy);
              const stationary = speed <= 28;
              const pulse = 0.5 + 0.5 * Math.sin(nowSec * 5.2);

              if (stationary && !isDraggingRef.current) {
                // Subtle breathing halo on your golf ball so you know you can drag anywhere to putt
                ctx.save();
                ctx.strokeStyle = accentHex;
                ctx.lineWidth = 2.5;
                ctx.globalAlpha = 0.45 + pulse * 0.35;
                ctx.beginPath();
                ctx.arc(me.x, me.y, 20 + pulse * 6, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
              }

              if (isDraggingRef.current) {
                const pullDx = downWorldRef.current.x - curWorldRef.current.x;
                const pullDy = downWorldRef.current.y - curWorldRef.current.y;
                const pullDist = Math.hypot(pullDx, pullDy);

                if (pullDist < GOLF_CANCEL_PULL) {
                  ctx.save();
                  ctx.strokeStyle = 'rgba(226, 232, 240, 0.72)';
                  ctx.lineWidth = 2;
                  ctx.setLineDash([4, 4]);
                  ctx.beginPath();
                  ctx.arc(me.x, me.y, 26, 0, Math.PI * 2);
                  ctx.stroke();

                  ctx.font = '800 12px Inter, system-ui, sans-serif';
                  ctx.textAlign = 'center';
                  ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
                  ctx.fillText(t('CANCEL', '取消'), me.x, me.y + 42);
                  ctx.restore();
                } else {
                  const power = Math.min(
                    1,
                    Math.max(0.08, (pullDist - GOLF_CANCEL_PULL) / (GOLF_MAX_PULL - GOLF_CANCEL_PULL))
                  );
                  const aimAngle = Math.atan2(pullDy, pullDx);
                  const shotColor =
                    power < 0.45 ? '#10D98B' : power < 0.78 ? '#FFB800' : '#FF4D2E';

                  // 1. Slingshot pullback elastic line from ball backward
                  const pullVisualLen = Math.min(135, 24 + power * 110);
                  const tailX = me.x - Math.cos(aimAngle) * pullVisualLen;
                  const tailY = me.y - Math.sin(aimAngle) * pullVisualLen;

                  ctx.save();
                  ctx.strokeStyle = shotColor;
                  ctx.lineWidth = 4;
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  ctx.moveTo(me.x, me.y);
                  ctx.lineTo(tailX, tailY);
                  ctx.stroke();

                  ctx.fillStyle = shotColor;
                  ctx.beginPath();
                  ctx.arc(tailX, tailY, 8, 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = '#FFFFFF';
                  ctx.lineWidth = 2;
                  ctx.stroke();

                  // 2. Curved power arc around the ball
                  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
                  ctx.lineWidth = 4;
                  ctx.beginPath();
                  ctx.arc(me.x, me.y, 24, 0, Math.PI * 2);
                  ctx.stroke();

                  ctx.strokeStyle = shotColor;
                  ctx.lineWidth = 4.5;
                  ctx.beginPath();
                  ctx.arc(me.x, me.y, 24, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * power);
                  ctx.stroke();

                  // 3. Trajectory + 1st wall bounce preview forward
                  const previewLen = 120 + power * 300;
                  const pts = raycastGolfPreview(me.x, me.y, aimAngle, previewLen, golfSnap.walls);
                  if (pts.length >= 2) {
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 3;
                    ctx.setLineDash([8, 7]);
                    ctx.globalAlpha = 0.92;
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) {
                      ctx.lineTo(pts[i].x, pts[i].y);
                    }
                    ctx.stroke();

                    if (pts.length === 3) {
                      ctx.setLineDash([]);
                      ctx.fillStyle = '#FACC15';
                      ctx.beginPath();
                      ctx.arc(pts[1].x, pts[1].y, 5, 0, Math.PI * 2);
                      ctx.fill();
                    }
                  }

                  // 4. Compact power % readout badge
                  const pctLabel = `${Math.round(power * 100)}%`;
                  const badgeY = me.y > 170 ? me.y - 44 : me.y + 44;
                  ctx.setLineDash([]);
                  ctx.globalAlpha = 1;
                  ctx.fillStyle = 'rgba(11, 14, 20, 0.9)';
                  ctx.beginPath();
                  ctx.roundRect(me.x - 28, badgeY - 12, 56, 22, 7);
                  ctx.fill();
                  ctx.strokeStyle = shotColor;
                  ctx.lineWidth = 1.75;
                  ctx.stroke();

                  ctx.fillStyle = '#FFFFFF';
                  ctx.font = '900 12px "JetBrains Mono", monospace';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(pctLabel, me.x, badgeY - 0.5);
                  ctx.restore();
                }
              }
            }
          } else if (snap && mode === 'paddle-drag') {
            const snapWithPlayers = snap as unknown as {
              players?: Array<{ id: string; x?: number; y?: number; radius?: number }>;
            };
            const me = snapWithPlayers.players?.find((p) => p.id === playerId);
            if (me && typeof me.x === 'number' && typeof me.y === 'number') {
              const r = (me.radius ?? 34) + 8;
              const pulse = 0.5 + 0.5 * Math.sin(nowSec * 5.2);
              ctx.save();
              ctx.strokeStyle = accentHex;
              ctx.lineWidth = isDraggingRef.current ? 3 : 2;
              ctx.globalAlpha = isDraggingRef.current ? 0.72 : 0.35 + pulse * 0.3;
              ctx.beginPath();
              ctx.arc(me.x, me.y, isDraggingRef.current ? r : r + pulse * 5, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
          } else if (snap && mode === 'sketch-canvas' && snap.gameId === 'draw-guess-relay') {
            const sketchSnap = snap as DrawGuessRelaySnapshot;
            const me = sketchSnap.players.find((p) => p.id === playerId);
            if (sketchSnap.phase === 'drawing') {
              if (sketchSnap.artistId === playerId) {
                ctx.save();
                ctx.strokeStyle = '#38BDF8';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([6, 5]);
                ctx.globalAlpha = 0.65;
                ctx.beginPath();
                ctx.roundRect(102, 116, 648, 458, 14);
                ctx.stroke();
                ctx.restore();
              } else if (me && !me.lockedGuess) {
                const oy = 120 + me.cursorOption * 112;
                ctx.save();
                ctx.strokeStyle = accentHex;
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.roundRect(786, oy, 330, 92, 14);
                ctx.stroke();
                ctx.restore();
              }
            }
          }
        }
      }
      rafId = requestAnimationFrame(renderOverlay);
    };

    rafId = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(rafId);
  }, [mode, playerId, accentHex, snapshotRef, t]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors on browsers without pointer capture
    }

    if (releaseClearTimerRef.current) {
      clearTimeout(releaseClearTimerRef.current);
      releaseClearTimerRef.current = null;
    }

    activePointerIdRef.current = e.pointerId;
    isDraggingRef.current = true;
    if (showHint) setShowHint(false);

    const world = clientToWorld(e.clientX, e.clientY);
    downWorldRef.current = world;
    curWorldRef.current = world;
    lastMoveWorldRef.current = { x: world.x, y: world.y, at: performance.now() };

    if (mode === 'paddle-drag') {
      const now = Date.now();
      if (now - lastTapAtRef.current <= 260 && cooldownA <= 0.05) {
        onPulseActionA();
        lastTapAtRef.current = 0;
      } else {
        lastTapAtRef.current = now;
      }
      onLocalPrediction?.({
        gameId,
        playerId,
        active: true,
        targetX: world.x,
        targetY: world.y,
        updatedAtMs: performance.now(),
      });
      onSendDirectInput(
        {
          dx: 0,
          dy: 0,
          targetX: world.x,
          targetY: world.y,
        },
        true
      );
    } else if (mode === 'sketch-canvas') {
      const snap = snapshotRef.current;
      const isArtistNow =
        snap && snap.gameId === 'draw-guess-relay'
          ? (snap as DrawGuessRelaySnapshot).artistId === playerId
          : Boolean(cardState?.isMyTurn);
      if (isArtistNow) {
        onSendDirectInput(
          {
            dx: 0,
            dy: 0,
            a: true,
            targetX: Math.max(114, Math.min(738, world.x)),
            targetY: Math.max(128, Math.min(562, world.y)),
          },
          true
        );
      } else if (world.x >= 760) {
        const optIdx = Math.max(0, Math.min(3, Math.floor((world.y - 108) / 112)));
        onSendDirectInput(
          {
            dx: 0,
            dy: 0,
            a: true,
            targetX: 900,
            targetY: 160 + optIdx * 112,
          },
          true
        );
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerIdRef.current !== e.pointerId || !isDraggingRef.current) return;
    const world = clientToWorld(e.clientX, e.clientY);
    curWorldRef.current = world;

    if (mode === 'golf-slingshot') {
      const pullDx = downWorldRef.current.x - world.x;
      const pullDy = downWorldRef.current.y - world.y;
      const pullDist = Math.hypot(pullDx, pullDy);
      if (pullDist < GOLF_CANCEL_PULL) {
        onSendDirectInput(
          {
            dx: 0,
            dy: 0,
            aimAngle: undefined,
            shootPower: 0,
          },
          false
        );
      } else {
        const power = Math.min(
          1,
          Math.max(0.08, (pullDist - GOLF_CANCEL_PULL) / (GOLF_MAX_PULL - GOLF_CANCEL_PULL))
        );
        const aimAngle = Math.atan2(pullDy, pullDx);
        onSendDirectInput(
          {
            dx: 0,
            dy: 0,
            aimAngle,
            shootPower: power,
          },
          false
        );
      }
    } else if (mode === 'sketch-canvas') {
      const snap = snapshotRef.current;
      const isArtistNow =
        snap && snap.gameId === 'draw-guess-relay'
          ? (snap as DrawGuessRelaySnapshot).artistId === playerId
          : Boolean(cardState?.isMyTurn);
      if (isArtistNow) {
        onSendDirectInput(
          {
            dx: 0,
            dy: 0,
            a: true,
            targetX: Math.max(114, Math.min(738, world.x)),
            targetY: Math.max(128, Math.min(562, world.y)),
          },
          true
        );
      }
    } else {
      const now = performance.now();
      const prev = lastMoveWorldRef.current;
      if (prev) {
        const dtSec = Math.max(0.006, (now - prev.at) / 1000);
        const speed = Math.hypot(world.x - prev.x, world.y - prev.y) / dtSec;
        if (speed > 1350 && cooldownA <= 0.05 && now - lastAutoSmashAtRef.current > 450) {
          lastAutoSmashAtRef.current = now;
          onPulseActionA();
        }
      }
      lastMoveWorldRef.current = { x: world.x, y: world.y, at: now };
      if (mode === 'paddle-drag') {
        onLocalPrediction?.({
          gameId,
          playerId,
          active: true,
          targetX: world.x,
          targetY: world.y,
          updatedAtMs: now,
        });
      }
      onSendDirectInput(
        {
          dx: 0,
          dy: 0,
          targetX: world.x,
          targetY: world.y,
        },
        true
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    const world = clientToWorld(e.clientX, e.clientY);
    curWorldRef.current = world;
    activePointerIdRef.current = null;
    isDraggingRef.current = false;
    lastMoveWorldRef.current = null;

    if (mode === 'golf-slingshot') {
      const pullDx = downWorldRef.current.x - world.x;
      const pullDy = downWorldRef.current.y - world.y;
      const pullDist = Math.hypot(pullDx, pullDy);
      if (!disabled && pullDist >= GOLF_CANCEL_PULL) {
        const power = Math.min(
          1,
          Math.max(0.08, (pullDist - GOLF_CANCEL_PULL) / (GOLF_MAX_PULL - GOLF_CANCEL_PULL))
        );
        const aimAngle = Math.atan2(pullDy, pullDx);
        releaseSeqRef.current += 1;
        onSendDirectInput(
          {
            dx: 0,
            dy: 0,
            aimAngle,
            shootPower: power,
            shootRelease: releaseSeqRef.current,
          },
          true
        );
        releaseClearTimerRef.current = setTimeout(() => {
          releaseClearTimerRef.current = null;
          if (!isDraggingRef.current) {
            onSendDirectInput(
              {
                dx: 0,
                dy: 0,
                aimAngle: undefined,
                shootPower: undefined,
              },
              true
            );
          }
        }, 120);
      } else {
        onSendDirectInput(
          {
            dx: 0,
            dy: 0,
            aimAngle: undefined,
            shootPower: undefined,
          },
          true
        );
      }
    } else if (mode === 'sketch-canvas') {
      onSendDirectInput(
        {
          dx: 0,
          dy: 0,
          a: false,
          targetX: undefined,
          targetY: undefined,
        },
        true
      );
    } else {
      if (mode === 'paddle-drag') {
        onLocalPrediction?.({
          gameId,
          playerId,
          active: false,
          targetX: world.x,
          targetY: world.y,
          updatedAtMs: performance.now(),
        });
      }
      onSendDirectInput(
        {
          dx: 0,
          dy: 0,
          targetX: undefined,
          targetY: undefined,
        },
        true
      );
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    resetPointerState();
  };

  const sketchSnap =
    mode === 'sketch-canvas' && snapshotRef.current?.gameId === 'draw-guess-relay'
      ? (snapshotRef.current as DrawGuessRelaySnapshot)
      : null;
  const isSketchArtist =
    mode === 'sketch-canvas' &&
    (sketchSnap ? sketchSnap.artistId === playerId : Boolean(cardState?.isMyTurn));

  const triggerSketchControl = (power: number) => {
    releaseSeqRef.current += 1;
    onSendDirectInput(
      {
        shootPower: power,
        shootRelease: releaseSeqRef.current,
      },
      true
    );
  };

  return (
    <div
      ref={surfaceRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onLostPointerCapture={handlePointerCancel}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0 z-[15] touch-none select-none cursor-crosshair flex items-center justify-center overflow-hidden"
    >
      <canvas
        ref={overlayCanvasRef}
        width={ARENA_WIDTH}
        height={ARENA_HEIGHT}
        className="w-full h-full object-contain pointer-events-none select-none"
      />
      {mode === 'sketch-canvas' && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="pointer-events-auto absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#0B0E14]/92 border border-white/15 shadow-xl backdrop-blur-md max-w-[96%]"
        >
          {isSketchArtist ? (
            <>
              <div className="px-2 py-0.5 rounded-lg bg-[#38BDF8]/20 border border-[#38BDF8]/45 text-[11px] font-black text-[#7DD3FC] whitespace-nowrap">
                {t('DRAW:', '请画：')} {cardState?.badgeText ?? t('Draw clue!', '请作画！')}
              </div>
              <div className="flex items-center gap-1">
                {SKETCH_BRUSH_COLORS.map((hex, idx) => {
                  const active = sketchSnap?.brushColor?.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => triggerSketchControl((idx + 0.35) / SKETCH_BRUSH_COLORS.length)}
                      aria-label={`Color ${idx + 1}`}
                      className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-transform ${
                        active ? 'border-white scale-115' : 'border-white/30'
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => triggerSketchControl(0.96)}
                className="h-6 px-2 rounded-lg bg-[#242A36] hover:bg-[#323A4A] text-[10px] font-bold text-[#F8FAFC] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('Clear', '清空')}</span>
              </button>
            </>
          ) : (
            <span className="text-[11px] font-bold text-[#E2E8F0] whitespace-nowrap">
              {sketchSnap?.players.find((p) => p.id === playerId)?.lockedGuess
                ? t('Guess locked! Waiting for reveal...', '已锁定答案，等待揭晓...')
                : t('Tap any word card on the right to guess!', '直接点击右侧词卡即可抢答！')}
            </span>
          )}
        </div>
      )}
      {showHint && mode !== 'sketch-canvas' && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-xl bg-[#0B0E14]/82 border border-white/15 text-[11px] font-bold text-[#E5E7EB] backdrop-blur-sm whitespace-nowrap shadow-lg">
          {mode === 'golf-slingshot'
            ? t('Drag back anywhere to aim · Release to putt', '按住向后拉杆瞄准 · 松手推杆进洞')
            : t('Drag directly on the court to move & hit the puck', '直接在球场上拖动你的球拍挡球回击')}
        </div>
      )}
    </div>
  );
}

interface SketchNormalDeckProps {
  playerId: string;
  accentHex: string;
  snapshotRef: MutableRefObject<GameSnapshot | null>;
  cardState?: CardPrivateState | null;
  disabled: boolean;
  onSendDirectInput: (patch: Partial<ControllerInput>, force?: boolean) => void;
}

export function SketchNormalDeck({
  playerId,
  accentHex,
  snapshotRef,
  cardState,
  disabled,
  onSendDirectInput,
}: SketchNormalDeckProps) {
  const { t, lang } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const seqRef = useRef(0);
  const [snapState, setSnapState] = useState<DrawGuessRelaySnapshot | null>(() => {
    const s = snapshotRef.current;
    return s && s.gameId === 'draw-guess-relay' ? (s as DrawGuessRelaySnapshot) : null;
  });

  useEffect(() => {
    let rafId = 0;
    let lastSig = '';
    const tick = () => {
      const s = snapshotRef.current;
      const sketch = s && s.gameId === 'draw-guess-relay' ? (s as DrawGuessRelaySnapshot) : null;
      if (sketch) {
        const sig = `${sketch.round}|${sketch.phase}|${sketch.artistId}|${sketch.brushColor}|${sketch.strokes.length}`;
        if (sig !== lastSig) {
          lastSig = sig;
          setSnapState(sketch);
        }
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#F8FAFC';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const sx = canvas.width / 624;
            const sy = canvas.height / 434;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = Math.max(4, 7 * sx);
            for (let i = 0; i < sketch.strokes.length; i++) {
              const cur = sketch.strokes[i];
              const prev = i > 0 ? sketch.strokes[i - 1] : null;
              const cx = (cur.x - 114) * sx;
              const cy = (cur.y - 128) * sy;
              if (cur.newStroke || !prev) {
                ctx.fillStyle = cur.colorHex;
                ctx.beginPath();
                ctx.arc(cx, cy, ctx.lineWidth * 0.5, 0, Math.PI * 2);
                ctx.fill();
              } else {
                const px = (prev.x - 114) * sx;
                const py = (prev.y - 128) * sy;
                ctx.strokeStyle = cur.colorHex;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(cx, cy);
                ctx.stroke();
              }
            }
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [snapshotRef]);

  const isArtist = snapState ? snapState.artistId === playerId : Boolean(cardState?.isMyTurn);
  const me = snapState?.players.find((p) => p.id === playerId);

  const clientToBoard = (clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return { x: 420, y: 340 };
    const rect = el.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
    return {
      x: 114 + nx * 624,
      y: 128 + ny * 434,
    };
  };

  const triggerArtistControl = (power: number) => {
    seqRef.current += 1;
    onSendDirectInput({ shootPower: power, shootRelease: seqRef.current }, true);
  };

  if (isArtist) {
    return (
      <div className="flex-1 min-h-0 flex flex-col gap-2 py-1 select-none">
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#131823] border border-[#38BDF8]/40 shrink-0">
          <div className="text-xs font-extrabold text-[#7DD3FC] truncate">
            {t('DRAW:', '请画：')} <span className="text-white">{cardState?.badgeText ?? '...'}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {SKETCH_BRUSH_COLORS.map((hex, idx) => {
              const active = snapState?.brushColor?.toLowerCase() === hex.toLowerCase();
              return (
                <button
                  key={hex}
                  type="button"
                  onClick={() => triggerArtistControl((idx + 0.35) / SKETCH_BRUSH_COLORS.length)}
                  className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                    active ? 'border-white scale-110' : 'border-white/25'
                  }`}
                  style={{ backgroundColor: hex }}
                />
              );
            })}
            <button
              type="button"
              onClick={() => triggerArtistControl(0.96)}
              className="h-6 px-2 rounded-lg bg-[#242A36] hover:bg-[#323A4A] text-[11px] font-bold text-white inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('Clear', '清空')}</span>
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border-2 border-[#38BDF8]/65 bg-[#F8FAFC] shadow-inner relative">
          <canvas
            ref={canvasRef}
            width={624}
            height={434}
            onPointerDown={(e) => {
              if (disabled) return;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {}
              pointerIdRef.current = e.pointerId;
              const pt = clientToBoard(e.clientX, e.clientY);
              onSendDirectInput({ dx: 0, dy: 0, a: true, targetX: pt.x, targetY: pt.y }, true);
            }}
            onPointerMove={(e) => {
              if (disabled || pointerIdRef.current !== e.pointerId) return;
              const pt = clientToBoard(e.clientX, e.clientY);
              onSendDirectInput({ dx: 0, dy: 0, a: true, targetX: pt.x, targetY: pt.y }, true);
            }}
            onPointerUp={(e) => {
              if (pointerIdRef.current !== e.pointerId) return;
              pointerIdRef.current = null;
              onSendDirectInput({ dx: 0, dy: 0, a: false, targetX: undefined, targetY: undefined }, true);
            }}
            onPointerCancel={() => {
              pointerIdRef.current = null;
              onSendDirectInput({ dx: 0, dy: 0, a: false, targetX: undefined, targetY: undefined }, true);
            }}
            className="w-full h-full touch-none cursor-crosshair block"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col justify-center gap-2 py-1 select-none">
      <div className="text-center text-xs font-bold text-[#94A3B8]">
        {me?.lockedGuess
          ? t('Answer locked! Watch the TV reveal.', '答案已锁定！请看大屏幕揭晓。')
          : t('Tap your guess below:', '点击下方你认为正确的答案：')}
      </div>
      <div className="grid grid-cols-2 gap-2.5 flex-1 min-h-0 max-h-[240px]">
        {(snapState?.options ?? []).map((opt, idx) => {
          const selected = me?.cursorOption === idx;
          const label = lang === 'zh' ? opt.zh : opt.en;
          const sub = lang === 'zh' ? opt.en : opt.zh;
          return (
            <button
              key={`${opt.en}-${idx}`}
              type="button"
              disabled={disabled || Boolean(me?.lockedGuess)}
              onClick={() => {
                onSendDirectInput({ dx: 0, dy: 0, a: true, targetX: 900, targetY: 160 + idx * 112 }, true);
                window.setTimeout(() => {
                  onSendDirectInput({ a: false, targetX: undefined, targetY: undefined }, true);
                }, 90);
              }}
              className={`rounded-2xl border-2 px-3 py-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer disabled:opacity-65 ${
                selected ? 'bg-[#172538] text-white' : 'bg-[#141822] border-[#2C3545] text-[#E5E7EB] hover:border-[#38BDF8]'
              }`}
              style={selected ? { borderColor: accentHex } : undefined}
            >
              <span className="font-display text-sm sm:text-base font-black leading-tight">
                {idx + 1}. {label}
              </span>
              <span className="text-xs font-bold text-[#FDE047] mt-0.5">{sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
