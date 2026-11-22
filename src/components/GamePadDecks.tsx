import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Hand,
  MousePointerClick,
  Repeat,
  Zap,
} from 'lucide-react';
import type { ControllerSchema } from '../shared/types';
import type { TrackpadMode } from '../shared/padProfiles';
import { useLanguage } from '../lib/i18n';

type ArrowDir = 'up' | 'down' | 'left' | 'right';

export interface EasyArrowsDeckProps {
  schema: ControllerSchema;
  accentHex: string;
  cooldownA: number;
  cooldownB: number;
  pressedA: boolean;
  pressedB: boolean;
  strictFourWay: boolean;
  autoTapActive: boolean;
  preferAutoTap?: boolean;
  swapAB: boolean;
  embedded?: boolean;
  disabled?: boolean;
  isTurboDrift?: boolean;
  onVectorChange: (dx: number, dy: number) => void;
  onActionDown: (which: 'a' | 'b', e: React.PointerEvent<HTMLElement>) => void;
  onActionUp: (which: 'a' | 'b', e: React.PointerEvent<HTMLElement>) => void;
  onToggleAutoTap: () => void;
  onToggleStrictFourWay: () => void;
}

export function EasyArrowsDeck({
  schema,
  accentHex,
  cooldownA,
  cooldownB,
  pressedA,
  pressedB,
  strictFourWay,
  autoTapActive,
  preferAutoTap = false,
  swapAB,
  embedded = false,
  disabled = false,
  isTurboDrift = false,
  onVectorChange,
  onActionDown,
  onActionUp,
  onToggleAutoTap,
  onToggleStrictFourWay,
}: EasyArrowsDeckProps) {
  const { t } = useLanguage();
  const dirPointersRef = useRef<Record<ArrowDir, Set<number>>>({
    up: new Set(),
    down: new Set(),
    left: new Set(),
    right: new Set(),
  });
  const orderRef = useRef<ArrowDir[]>([]);
  const [activeDirs, setActiveDirs] = useState<Record<ArrowDir, boolean>>({
    up: false,
    down: false,
    left: false,
    right: false,
  });

  const recomputeVector = () => {
    const u = dirPointersRef.current.up.size > 0;
    const d = dirPointersRef.current.down.size > 0;
    const l = dirPointersRef.current.left.size > 0;
    const r = dirPointersRef.current.right.size > 0;

    let dx = 0;
    let dy = 0;
    const visual: Record<ArrowDir, boolean> = { up: u, down: d, left: l, right: r };

    if (strictFourWay) {
      const latest = [...orderRef.current]
        .reverse()
        .find((dir) => dirPointersRef.current[dir].size > 0);
      visual.up = latest === 'up';
      visual.down = latest === 'down';
      visual.left = latest === 'left';
      visual.right = latest === 'right';
      if (latest === 'up') dy = -1;
      else if (latest === 'down') dy = 1;
      else if (latest === 'left') dx = -1;
      else if (latest === 'right') dx = 1;
    } else {
      if (l) dx -= 1;
      if (r) dx += 1;
      if (u) dy -= 1;
      if (d) dy += 1;
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
    }

    setActiveDirs(visual);
    onVectorChange(dx, dy);
  };

  useEffect(() => {
    return () => {
      dirPointersRef.current.up.clear();
      dirPointersRef.current.down.clear();
      dirPointersRef.current.left.clear();
      dirPointersRef.current.right.clear();
      orderRef.current = [];
      onVectorChange(0, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    recomputeVector();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strictFourWay]);

  const onArrowDown = (dir: ArrowDir, e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture failure on unsupported platforms
    }
    dirPointersRef.current[dir].add(e.pointerId);
    orderRef.current = orderRef.current.filter((item) => item !== dir);
    orderRef.current.push(dir);
    recomputeVector();
  };

  const onArrowUp = (dir: ArrowDir, e: React.PointerEvent<HTMLButtonElement>) => {
    if (dirPointersRef.current[dir].delete(e.pointerId)) {
      if (dirPointersRef.current[dir].size === 0) {
        orderRef.current = orderRef.current.filter((item) => item !== dir);
      }
      recomputeVector();
    }
  };

  const renderArrowBtn = (dir: ArrowDir, icon: React.ReactNode, labelText: string) => {
    const active = activeDirs[dir];
    const sizeCls = embedded
      ? 'w-14 h-12 rounded-xl'
      : 'w-[68px] h-[58px] sm:w-[78px] sm:h-[64px] rounded-2xl';
    return (
      <button
        type="button"
        onPointerDown={(e) => onArrowDown(dir, e)}
        onPointerUp={(e) => onArrowUp(dir, e)}
        onPointerCancel={(e) => onArrowUp(dir, e)}
        onLostPointerCapture={(e) => onArrowUp(dir, e)}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={labelText}
        className={`${sizeCls} flex items-center justify-center border-2 touch-none select-none cursor-pointer transition-transform duration-75`}
        style={{
          backgroundColor: active ? accentHex : '#181C24',
          borderColor: active ? '#FFFFFF' : '#2E3646',
          color: active ? '#0B1016' : '#F4F6FA',
          transform: active ? 'translateY(3px) scale(0.96)' : 'translateY(0)',
          boxShadow: active
            ? '0 1px 0 rgba(0,0,0,0.6)'
            : '0 5px 0 #0A0C10, 0 8px 16px rgba(0,0,0,0.42)',
        }}
      >
        {icon}
      </button>
    );
  };

  const firstWhich: 'a' | 'b' = swapAB ? 'b' : 'a';
  const secondWhich: 'a' | 'b' = swapAB ? 'a' : 'b';

  const renderVerbActionTile = (which: 'a' | 'b') => {
    const isA = which === 'a';
    const spec = isA ? schema.actionA : schema.actionB;
    const pressed = isA ? pressedA : pressedB;
    const cd = Math.max(0, Math.min(1, isA ? cooldownA : cooldownB));
    const showPct = isA ? isTurboDrift || cd > 0.05 : cd > 0.05;
    const isAutoPulsing = isA && autoTapActive;

    return (
      <button
        key={which}
        type="button"
        onPointerDown={(e) => onActionDown(which, e)}
        onPointerUp={(e) => onActionUp(which, e)}
        onPointerCancel={(e) => onActionUp(which, e)}
        onLostPointerCapture={(e) => onActionUp(which, e)}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative w-full flex items-center justify-between gap-2.5 rounded-2xl border-2 px-4 touch-none select-none cursor-pointer transition-transform duration-75 ${
          embedded ? 'min-h-[54px] py-2' : 'min-h-[68px] sm:min-h-[78px] py-3'
        }`}
        style={{
          backgroundColor: spec.colorHex,
          borderColor: isAutoPulsing ? '#FFFFFF' : 'rgba(255,255,255,0.22)',
          color: spec.textColor,
          transform: pressed ? 'translateY(4px) scale(0.98)' : 'translateY(0)',
          boxShadow: pressed
            ? `0 1px 0 ${spec.darkHex}`
            : `0 6px 0 ${spec.darkHex}, 0 12px 22px rgba(0,0,0,0.42)`,
          opacity: cd > 0.05 && !(isA && isTurboDrift) ? 0.72 : 1,
        }}
      >
        <div className="flex flex-col items-start text-left min-w-0 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-black/25">
              {isA ? 'A' : 'B'}
            </span>
            <span
              className={`font-display font-black leading-none truncate ${
                embedded ? 'text-sm' : 'text-base sm:text-xl'
              }`}
            >
              {spec.label}
            </span>
          </div>
          <span className="mt-1 text-[10px] sm:text-xs font-semibold opacity-85 truncate max-w-full">
            {spec.sublabel}
          </span>
        </div>

        <div className="shrink-0 flex flex-col items-end pointer-events-none">
          {showPct ? (
            <span className="font-mono text-xs sm:text-sm font-black tabular-nums px-2 py-0.5 rounded-md bg-black/25">
              {Math.round((1 - cd) * 100)}%
            </span>
          ) : (
            <span className="font-mono text-[10px] font-extrabold uppercase tracking-wider opacity-85">
              {isAutoPulsing ? t('AUTO', '连点') : t('TAP', '点击')}
            </span>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="flex-1 grid grid-cols-2 items-center gap-3 min-h-0 px-1 sm:px-4">
      {/* Left Side: Clear 4-Arrow Pad + Strict 4-Way Indicator */}
      <div className="h-full flex flex-col items-center justify-center gap-2 touch-none select-none">
        <div className="grid grid-cols-3 grid-rows-3 items-center justify-items-center gap-1.5 sm:gap-2">
          <div />
          {renderArrowBtn('up', <ArrowUp className="w-7 h-7 stroke-[2.6]" />, t('Up', '上'))}
          <div />

          {renderArrowBtn('left', <ArrowLeft className="w-7 h-7 stroke-[2.6]" />, t('Left', '左'))}
          <button
            type="button"
            onClick={onToggleStrictFourWay}
            title={t('Toggle Strict 4-Way vs Diagonal Arrows', '切换：严格四向防误触 / 允许斜向')}
            className={`rounded-xl border text-[10px] font-mono font-extrabold px-2 py-1.5 leading-tight text-center cursor-pointer transition-colors ${
              embedded ? 'w-12 h-11' : 'w-14 h-12 sm:w-16 sm:h-14'
            } ${
              strictFourWay
                ? 'bg-[#10D98B]/18 border-[#10D98B]/70 text-[#10D98B]'
                : 'bg-[#171B24] border-[#2E3646] text-[#9CA3AF] hover:text-white'
            }`}
          >
            {strictFourWay ? t('4-WAY', '四向') : t('8-WAY', '八向')}
          </button>
          {renderArrowBtn('right', <ArrowRight className="w-7 h-7 stroke-[2.6]" />, t('Right', '右'))}

          <div />
          {renderArrowBtn('down', <ArrowDown className="w-7 h-7 stroke-[2.6]" />, t('Down', '下'))}
          <div />
        </div>

        <span className="text-[11px] font-medium text-[#8B95A7] text-center">
          {strictFourWay
            ? t('Easy Arrows · 4-Way Lock', '大箭头 · 防斜角误触锁定')
            : t('Easy Arrows · Combo Diagonals', '大箭头 · 支持组合斜向')}
        </span>
      </div>

      {/* Right Side: Clear Auto-Tap Toggle + Two Large Labeled Action Tiles */}
      <div className="h-full flex flex-col items-stretch justify-center gap-2.5 max-w-xs w-full mx-auto">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-[#9CA3AF] truncate">
            {preferAutoTap
              ? t('Tip: Auto-Tap saves your thumb!', '提示：连点模式更省力！')
              : t('Tap or hold big action buttons', '大尺寸中文/英文动作按键')}
          </span>
          <button
            type="button"
            onClick={onToggleAutoTap}
            className={`min-h-[34px] px-2.5 py-1 rounded-lg border text-[11px] font-display font-extrabold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors ${
              autoTapActive
                ? 'bg-[#FFB800] border-[#FFE082] text-[#14120B] shadow-[0_2px_0_#B58100]'
                : preferAutoTap
                ? 'bg-[#1D2432] border-[#FFB800]/65 text-[#FFB800] hover:bg-[#252D3F]'
                : 'bg-[#181C24] border-[#2E3646] text-[#D1D5DB] hover:text-white'
            }`}
          >
            <Repeat className={`w-3.5 h-3.5 ${autoTapActive ? 'animate-spin' : ''}`} />
            <span>{autoTapActive ? t('Auto-Tap ON', '自动连点 开') : t('Auto-Tap', '自动连点')}</span>
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {renderVerbActionTile(firstWhich)}
          {renderVerbActionTile(secondWhich)}
        </div>
      </div>
    </div>
  );
}

export interface SwipeTrackpadDeckProps {
  schema: ControllerSchema;
  accentHex: string;
  cooldownA: number;
  cooldownB: number;
  pressedA: boolean;
  pressedB: boolean;
  trackpadMode: TrackpadMode;
  handedness: 'right' | 'left';
  tapForA: boolean;
  sensitivity: number;
  swapAB: boolean;
  isCssRotated: boolean;
  embedded?: boolean;
  disabled?: boolean;
  isTurboDrift?: boolean;
  onVectorChange: (dx: number, dy: number) => void;
  onPulseActionA: () => void;
  onActionDown: (which: 'a' | 'b', e: React.PointerEvent<HTMLElement>) => void;
  onActionUp: (which: 'a' | 'b', e: React.PointerEvent<HTMLElement>) => void;
  onToggleTrackpadMode: () => void;
  onToggleHandedness: () => void;
  onToggleTapForA: () => void;
}

export function SwipeTrackpadDeck({
  schema,
  accentHex,
  cooldownA,
  cooldownB,
  pressedA,
  pressedB,
  trackpadMode,
  handedness,
  tapForA,
  sensitivity,
  swapAB,
  isCssRotated,
  embedded = false,
  disabled = false,
  isTurboDrift = false,
  onVectorChange,
  onPulseActionA,
  onActionDown,
  onActionUp,
  onToggleTrackpadMode,
  onToggleHandedness,
  onToggleTapForA,
}: SwipeTrackpadDeckProps) {
  const { t } = useLanguage();
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const anchorScreenRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const downScreenRef = useRef<{ x: number; y: number; at: number }>({ x: 0, y: 0, at: 0 });
  const maxTravelRef = useRef<number>(0);
  const flickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [anchorLocal, setAnchorLocal] = useState<{ x: number; y: number } | null>(null);
  const [puckLocal, setPuckLocal] = useState<{ x: number; y: number } | null>(null);
  const [flickBadge, setFlickBadge] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (flickTimerRef.current) clearTimeout(flickTimerRef.current);
      pointerIdRef.current = null;
      onVectorChange(0, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toLocalDelta = (dxScreen: number, dyScreen: number) => ({
    x: isCssRotated ? dyScreen : dxScreen,
    y: isCssRotated ? -dxScreen : dyScreen,
  });

  const toLocalBoxPoint = (clientX: number, clientY: number) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: 80, y: 80 };
    if (!isCssRotated) {
      return { x: clientX - rect.left, y: clientY - rect.top };
    }
    // Container is rotated 90deg clockwise
    return {
      x: clientY - rect.top,
      y: rect.right - clientX,
    };
  };

  const handlePadDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (pointerIdRef.current !== null && pointerIdRef.current !== e.pointerId) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    pointerIdRef.current = e.pointerId;
    anchorScreenRef.current = { x: e.clientX, y: e.clientY };
    downScreenRef.current = { x: e.clientX, y: e.clientY, at: Date.now() };
    maxTravelRef.current = 0;

    const pt = toLocalBoxPoint(e.clientX, e.clientY);
    setAnchorLocal(pt);
    setPuckLocal(pt);
  };

  const handlePadMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || pointerIdRef.current !== e.pointerId) return;
    const rawTotal = Math.hypot(
      e.clientX - downScreenRef.current.x,
      e.clientY - downScreenRef.current.y
    );
    if (rawTotal > maxTravelRef.current) maxTravelRef.current = rawTotal;

    const delta = toLocalDelta(
      e.clientX - anchorScreenRef.current.x,
      e.clientY - anchorScreenRef.current.y
    );
    const pt = toLocalBoxPoint(e.clientX, e.clientY);
    setPuckLocal(pt);

    if (trackpadMode === 'glide') {
      const fullRadius = Math.max(26, 62 / Math.max(0.7, sensitivity));
      const dist = Math.hypot(delta.x, delta.y);
      if (dist < 4) {
        onVectorChange(0, 0);
        return;
      }
      const norm = Math.min(1, dist / fullRadius);
      const ang = Math.atan2(delta.y, delta.x);
      onVectorChange(Math.cos(ang) * norm, Math.sin(ang) * norm);
    } else {
      // 4-Way Flick Snap mode: emit clean step pulse and reset rolling anchor so rapid swipes chain!
      const flickThreshold = Math.max(16, 30 / Math.max(0.7, sensitivity));
      const dist = Math.hypot(delta.x, delta.y);
      if (dist >= flickThreshold) {
        let fdx = 0;
        let fdy = 0;
        let label = '→';
        if (Math.abs(delta.x) >= Math.abs(delta.y)) {
          fdx = delta.x > 0 ? 1 : -1;
          label = fdx > 0 ? '►' : '◄';
        } else {
          fdy = delta.y > 0 ? 1 : -1;
          label = fdy > 0 ? '▼' : '▲';
        }
        onVectorChange(fdx, fdy);
        setFlickBadge(label);
        anchorScreenRef.current = { x: e.clientX, y: e.clientY };
        setAnchorLocal(pt);
        if (flickTimerRef.current) clearTimeout(flickTimerRef.current);
        flickTimerRef.current = setTimeout(() => {
          setFlickBadge(null);
          onVectorChange(0, 0);
        }, 145);
      }
    }
  };

  const handlePadUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    pointerIdRef.current = null;
    setAnchorLocal(null);
    setPuckLocal(null);

    const elapsed = Date.now() - downScreenRef.current.at;
    if (tapForA && !disabled && elapsed <= 240 && maxTravelRef.current <= 14) {
      onPulseActionA();
    }

    if (trackpadMode === 'glide') {
      onVectorChange(0, 0);
    }
  };

  const firstWhich: 'a' | 'b' = swapAB ? 'b' : 'a';
  const secondWhich: 'a' | 'b' = swapAB ? 'a' : 'b';

  const renderTriggerPaddle = (which: 'a' | 'b') => {
    const isA = which === 'a';
    const spec = isA ? schema.actionA : schema.actionB;
    const pressed = isA ? pressedA : pressedB;
    const cd = Math.max(0, Math.min(1, isA ? cooldownA : cooldownB));
    const showPct = isA ? isTurboDrift || cd > 0.05 : cd > 0.05;

    return (
      <button
        key={which}
        type="button"
        onPointerDown={(e) => onActionDown(which, e)}
        onPointerUp={(e) => onActionUp(which, e)}
        onPointerCancel={(e) => onActionUp(which, e)}
        onLostPointerCapture={(e) => onActionUp(which, e)}
        onContextMenu={(e) => e.preventDefault()}
        className={`relative w-full flex-1 flex flex-col items-center justify-center rounded-2xl border-2 px-2 touch-none select-none cursor-pointer transition-transform duration-75 ${
          embedded ? 'min-h-[60px]' : 'min-h-[76px]'
        }`}
        style={{
          backgroundColor: spec.colorHex,
          borderColor: 'rgba(255,255,255,0.22)',
          color: spec.textColor,
          transform: pressed ? 'translateY(4px) scale(0.97)' : 'translateY(0)',
          boxShadow: pressed
            ? `0 1px 0 ${spec.darkHex}`
            : `0 6px 0 ${spec.darkHex}, 0 10px 20px rgba(0,0,0,0.45)`,
          opacity: cd > 0.05 && !(isA && isTurboDrift) ? 0.72 : 1,
        }}
      >
        <span className="font-mono text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-black/25 pointer-events-none">
          {isA ? 'A' : 'B'}
        </span>
        <span
          className={`mt-1 font-display font-black leading-none text-center pointer-events-none ${
            embedded ? 'text-xs' : 'text-sm sm:text-base'
          }`}
        >
          {spec.label}
        </span>
        <span className="mt-0.5 text-[9px] sm:text-[10px] font-semibold opacity-85 text-center leading-tight pointer-events-none">
          {showPct ? `${Math.round((1 - cd) * 100)}%` : spec.sublabel}
        </span>
      </button>
    );
  };

  const trackpadColumn = (
    <div className="flex-1 flex flex-col gap-1.5 min-h-0 h-full">
      <div className="flex items-center justify-between gap-1.5 shrink-0">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleTrackpadMode}
            className={`h-7 px-2.5 rounded-lg border text-[10px] font-mono font-extrabold inline-flex items-center gap-1 cursor-pointer transition-colors ${
              trackpadMode === 'flick'
                ? 'bg-[#FFB800]/20 border-[#FFB800] text-[#FFB800]'
                : 'bg-[#181C24] border-[#2E3646] text-[#00C2FF]'
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>
              {trackpadMode === 'flick'
                ? t('Mode: 4-Way Swipe', '模式：四向滑步')
                : t('Mode: Smooth Glide', '模式：丝滑追踪')}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleTapForA}
            className={`h-7 px-2 rounded-lg border text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors ${
              tapForA
                ? 'bg-[#10D98B]/20 border-[#10D98B] text-[#10D98B]'
                : 'bg-[#181C24] border-[#2E3646] text-[#9CA3AF] hover:text-white'
            }`}
          >
            <MousePointerClick className="w-3 h-3" />
            <span>{tapForA ? t('Tap = A ON', '轻点触发A 开') : t('Tap = A', '轻点=A')}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleHandedness}
          title={t('Flip Triggers Left / Right', '切换左/右手持握边')}
          className="h-7 px-2 rounded-lg bg-[#181C24] border border-[#2E3646] hover:border-[#4B5670] text-[10px] font-bold text-[#D1D5DB] inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <Hand className="w-3 h-3 text-[#00C2FF]" />
          <span>{handedness === 'right' ? t('Right Hand', '右手触发') : t('Left Hand', '左手触发')}</span>
        </button>
      </div>

      <div
        ref={surfaceRef}
        onPointerDown={handlePadDown}
        onPointerMove={handlePadMove}
        onPointerUp={handlePadUp}
        onPointerCancel={handlePadUp}
        onLostPointerCapture={handlePadUp}
        onContextMenu={(e) => e.preventDefault()}
        className="relative flex-1 min-h-[120px] rounded-2xl bg-[#101217] border-2 overflow-hidden flex flex-col items-center justify-center touch-none select-none cursor-crosshair"
        style={{
          borderColor: anchorLocal ? accentHex : '#2A303D',
          boxShadow: 'inset 0 8px 24px rgba(0,0,0,0.65)',
        }}
      >
        {/* Subtle calibration grid lines */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />

        {!anchorLocal && !flickBadge && (
          <div className="pointer-events-none text-center px-4">
            <div className="font-display font-bold text-xs sm:text-sm text-[#D1D5DB]">
              {trackpadMode === 'flick'
                ? t('Swipe anywhere to step cleanly', '任意滑动切换方向（可连续滑）')
                : t('Slide anywhere to steer smoothly', '按住任意位置滑动精准移动')}
            </div>
            <div className="mt-1 text-[10px] sm:text-[11px] text-[#6B7280]">
              {tapForA
                ? t('Quick tap fires primary action A', '轻点触控板也可直接触发 A 动作')
                : schema.joystickLabel}
            </div>
          </div>
        )}

        {flickBadge && (
          <div
            className="pointer-events-none px-4 py-2 rounded-2xl font-display text-3xl font-black shadow-xl"
            style={{ backgroundColor: accentHex, color: '#0B1016' }}
          >
            {flickBadge}
          </div>
        )}

        {/* Anchor ring & active thumb puck */}
        {anchorLocal && puckLocal && (
          <>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 w-full h-full"
            >
              <line
                x1={anchorLocal.x}
                y1={anchorLocal.y}
                x2={puckLocal.x}
                y2={puckLocal.y}
                stroke={accentHex}
                strokeWidth={3}
                strokeDasharray="4 4"
                opacity={0.75}
              />
            </svg>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed opacity-50"
              style={{ left: anchorLocal.x, top: anchorLocal.y, borderColor: accentHex }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute w-12 h-12 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-lg border-2 border-white/80"
              style={{ left: puckLocal.x, top: puckLocal.y, backgroundColor: accentHex }}
            />
          </>
        )}
      </div>
    </div>
  );

  const triggersColumn = (
    <div
      className={`flex flex-col gap-2.5 h-full shrink-0 ${
        embedded ? 'w-24' : 'w-[104px] sm:w-[132px]'
      }`}
    >
      {renderTriggerPaddle(firstWhich)}
      {renderTriggerPaddle(secondWhich)}
    </div>
  );

  return (
    <div className="flex-1 flex items-stretch gap-3 min-h-0 px-1 sm:px-3">
      {handedness === 'left' ? (
        <>
          {triggersColumn}
          {trackpadColumn}
        </>
      ) : (
        <>
          {trackpadColumn}
          {triggersColumn}
        </>
      )}
    </div>
  );
}
