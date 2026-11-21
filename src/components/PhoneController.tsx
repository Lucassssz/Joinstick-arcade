import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUp,
  Bomb,
  Check,
  Crosshair,
  Flame,
  Footprints,
  Gauge,
  LogOut,
  Maximize2,
  Minimize2,
  Paintbrush,
  RotateCcw,
  Shield,
  Target,
  Vibrate,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';
import { getGameMeta } from '../shared/games';
import {
  ActionButtonSpec,
  ControllerInput,
  PLAYER_PALETTE,
  RoomSnapshot,
  ServerMessage,
} from '../shared/types';
import { ManagedWebSocket } from '../lib/ws';
import { controllerHaptics, HapticIntensity, HapticResult } from '../lib/haptics';

/**
 * Centralized controller vibration utility backed by `window.navigator.vibrate`.
 * Falls back cleanly to iOS Taptic switch / tactile audio thump via `controllerHaptics`
 * when `window.navigator.vibrate` is unavailable (e.g., iOS WebKit).
 */
export function vibrate(
  pattern: number | number[],
  options?: {
    fromUserGesture?: boolean;
    intensity?: HapticIntensity;
    force?: boolean;
    skipIosSwitch?: boolean;
  }
): HapticResult {
  if (!controllerHaptics.isEnabled()) {
    return {
      vibrated: false,
      iosTaptic: false,
      audioThump: false,
      blockedByIframe: controllerHaptics.isInIframe(),
      platform: controllerHaptics.getPlatform(),
      skippedByLock: false,
    };
  }

  // Invoke window.navigator.vibrate directly when forcing a user-initiated test/confirm pattern,
  // otherwise coordinate with priority lock & cross-platform fallbacks in controllerHaptics.
  if (
    options?.force &&
    typeof window !== 'undefined' &&
    window.navigator &&
    typeof window.navigator.vibrate === 'function' &&
    controllerHaptics.getPlatform() !== 'ios'
  ) {
    try {
      const ok = window.navigator.vibrate(pattern);
      if (ok) {
        return {
          vibrated: true,
          iosTaptic: false,
          audioThump: false,
          blockedByIframe: controllerHaptics.isInIframe(),
          platform: controllerHaptics.getPlatform(),
          skippedByLock: false,
        };
      }
    } catch {
      // Fall through to controllerHaptics fallback
    }
  }

  return controllerHaptics.trigger(pattern, options);
}

export interface PhoneControllerProps {
  initialRoomCode?: string;
  defaultName?: string;
  autoJoin?: boolean;
  embedded?: boolean;
  keyboardProfile?: 'wasd' | 'arrows' | 'none';
  onExit?: () => void;
}

const CALLSIGNS = [
  'Viper',
  'Turbo',
  'Pixel',
  'Blitz',
  'Nova',
  'Drift',
  'Spark',
  'Echo',
];

function ActionIcon({ icon, className }: { icon: ActionButtonSpec['icon']; className?: string }) {
  switch (icon) {
    case 'zap':
      return <Zap className={className} />;
    case 'waves':
      return <Waves className={className} />;
    case 'crosshair':
      return <Crosshair className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'gauge':
      return <Gauge className={className} />;
    case 'wind':
      return <Wind className={className} />;
    case 'arrow-up':
      return <ArrowUp className={className} />;
    case 'bomb':
      return <Bomb className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'shield':
      return <Shield className={className} />;
    case 'paintbrush':
      return <Paintbrush className={className} />;
    case 'footprints':
      return <Footprints className={className} />;
  }
}

/**
 * Native HTML `<input type="checkbox" switch>` placed inside a `<label>` button.
 * On iOS 18+ Safari/WebKit, tapping a `<label>` that toggles a native-appearance switch
 * directly triggers the hardware Taptic Engine with a 100% browser-trusted gesture.
 */
function IosHapticSwitch({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <input
      ref={(el) => {
        if (el) el.setAttribute('switch', '');
      }}
      type="checkbox"
      tabIndex={-1}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full opacity-0 pointer-events-none m-0"
    />
  );
}

export function PhoneController({
  initialRoomCode = '',
  defaultName,
  autoJoin = false,
  embedded = false,
  keyboardProfile = 'none',
  onExit,
}: PhoneControllerProps) {
  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase());
  const [playerName, setPlayerName] = useState(
    () => defaultName || CALLSIGNS[Math.floor(Math.random() * CALLSIGNS.length)]
  );
  const [preferredColor, setPreferredColor] = useState(PLAYER_PALETTE[0].id);

  const [wsConnected, setWsConnected] = useState(false);
  const [joinedPlayerId, setJoinedPlayerId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [closedReason, setClosedReason] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [hapticNotice, setHapticNotice] = useState<string | null>(null);
  const [impactPulse, setImpactPulse] = useState<'none' | 'light' | 'heavy'>('none');
  const impactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Viewport tracking for automatic CSS landscape rotation on portrait phones
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 800,
    h: typeof window !== 'undefined' ? window.innerHeight : 600,
  }));

  // Visual state for analog joystick + buttons
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stickActive, setStickActive] = useState(false);
  const [pressedA, setPressedA] = useState(false);
  const [pressedB, setPressedB] = useState(false);

  // Refs synced with latest state so WebSocket/pointer closures are never stale
  const wsRef = useRef<ManagedWebSocket | null>(null);
  const joinedPlayerIdRef = useRef<string | null>(null);
  const roomCodeRef = useRef<string>(roomCode);
  const playerNameRef = useRef<string>(playerName);
  const preferredColorRef = useRef<string>(preferredColor);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const inputRef = useRef<ControllerInput>({ dx: 0, dy: 0, a: false, b: false });
  const lastSentRef = useRef<string>('');
  const lastSentAtRef = useRef<number>(0);

  const stickPointerId = useRef<number | null>(null);
  const stickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const btnAPointers = useRef<Set<number>>(new Set());
  const btnBPointers = useRef<Set<number>>(new Set());
  const keysDownRef = useRef<Set<string>>(new Set());

  const isCssRotated = !embedded && viewport.w < viewport.h && viewport.w <= 960;
  const isCssRotatedRef = useRef<boolean>(isCssRotated);

  useEffect(() => {
    joinedPlayerIdRef.current = joinedPlayerId;
  }, [joinedPlayerId]);
  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);
  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);
  useEffect(() => {
    preferredColorRef.current = preferredColor;
  }, [preferredColor]);
  useEffect(() => {
    isCssRotatedRef.current = isCssRotated;
  }, [isCssRotated]);

  // Listen to resize, orientationchange, and fullscreen changes
  useEffect(() => {
    if (embedded) return;
    const onResize = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    const onFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [embedded]);

  const enterFullscreenAndLandscape = () => {
    if (embedded || typeof document === 'undefined') return;
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (!document.fullscreenElement) {
        if (typeof el.requestFullscreen === 'function') {
          el.requestFullscreen().catch(() => {});
        } else if (typeof el.webkitRequestFullscreen === 'function') {
          el.webkitRequestFullscreen();
        }
      }
    } catch {
      // Fullscreen may not be supported on iOS Safari; CSS full-viewport rotation handles it
    }

    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientation && typeof orientation.lock === 'function') {
        orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Orientation lock unsupported; CSS auto-rotation handles portrait devices
    }

    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
      };
      if (nav.wakeLock && !wakeLockRef.current) {
        nav.wakeLock
          .request('screen')
          .then((lock) => {
            wakeLockRef.current = lock;
          })
          .catch(() => {});
      }
    } catch {
      // Wake lock optional
    }
  };

  const toggleFullscreen = () => {
    if (embedded || typeof document === 'undefined') return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      if (typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen();
      }
    } else {
      enterFullscreenAndLandscape();
    }
  };

  const sessionKey = useMemo(
    () => (embedded ? `joinstick_sim_${defaultName || 'p1'}` : 'joinstick_player_id'),
    [embedded, defaultName]
  );

  // Persistent playerId for reconnects
  const storedPlayerIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!embedded) {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved) storedPlayerIdRef.current = saved;
    }
  }, [embedded, sessionKey]);

  const sendCurrentInput = (force = false) => {
    const ws = wsRef.current;
    if (!ws || !joinedPlayerIdRef.current) return;
    const inp = inputRef.current;
    const rounded = {
      dx: Math.round(inp.dx * 100) / 100,
      dy: Math.round(inp.dy * 100) / 100,
      a: inp.a,
      b: inp.b,
    };
    const key = `${rounded.dx}|${rounded.dy}|${rounded.a ? 1 : 0}|${rounded.b ? 1 : 0}`;
    const now = Date.now();
    const isActive = rounded.dx !== 0 || rounded.dy !== 0 || rounded.a || rounded.b;

    // Resend immediately on any change, or heartbeat every 120ms while actively holding controls
    if (!force && key === lastSentRef.current && (!isActive || now - lastSentAtRef.current < 120)) {
      return;
    }
    lastSentRef.current = key;
    lastSentAtRef.current = now;
    ws.send({ type: 'controller:input', input: rounded });
  };

  // Reset all pointer & button locks cleanly whenever game or room status transitions
  const resetControlsState = () => {
    stickPointerId.current = null;
    btnAPointers.current.clear();
    btnBPointers.current.clear();
    keysDownRef.current.clear();
    inputRef.current = { dx: 0, dy: 0, a: false, b: false };
    lastSentRef.current = '';
    setStickActive(false);
    setKnobOffset({ x: 0, y: 0 });
    setPressedA(false);
    setPressedB(false);
    sendCurrentInput(true);
  };

  useEffect(() => {
    resetControlsState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.selectedGameId]);

  // Clear stuck touches if browser tab loses focus
  useEffect(() => {
    const onBlur = () => resetControlsState();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Manage WebSocket connection
  useEffect(() => {
    const socket = new ManagedWebSocket({
      onOpen: () => {
        setWsConnected(true);
        const codeNow = roomCodeRef.current.trim().toUpperCase();
        if (storedPlayerIdRef.current && codeNow.length === 4) {
          socket.send({
            type: 'room:join',
            code: codeNow,
            name: playerNameRef.current.trim() || 'Player',
            playerId: storedPlayerIdRef.current,
            preferredColorId: preferredColorRef.current,
          });
        } else if (autoJoin && initialRoomCode.length === 4) {
          socket.send({
            type: 'room:join',
            code: initialRoomCode.toUpperCase(),
            name: playerNameRef.current.trim() || 'Player',
            preferredColorId: preferredColorRef.current,
          });
        }
      },
      onClose: () => {
        setWsConnected(false);
      },
      onMessage: (msg: ServerMessage) => {
        switch (msg.type) {
          case 'room:joined':
            storedPlayerIdRef.current = msg.playerId;
            joinedPlayerIdRef.current = msg.playerId;
            if (!embedded) sessionStorage.setItem(sessionKey, msg.playerId);
            setJoinedPlayerId(msg.playerId);
            setRoom(msg.room);
            setErrorMsg(null);
            setClosedReason(null);
            break;
          case 'room:snapshot':
            setRoom(msg.room);
            break;
          case 'player:haptic':
            if (!embedded) {
              const heavyReasons = new Set([
                'ko',
                'falloff',
                'eliminated',
                'knockback',
                'goal',
                'hit',
                'win',
                'finish',
                'go',
              ]);
              const isHeavy =
                Array.isArray(msg.pattern) || (msg.reason ? heavyReasons.has(msg.reason) : false);
              vibrate(msg.pattern, {
                fromUserGesture: false,
                intensity: isHeavy ? 'heavy' : 'medium',
              });
              setImpactPulse(isHeavy ? 'heavy' : 'light');
              if (impactTimerRef.current) clearTimeout(impactTimerRef.current);
              impactTimerRef.current = setTimeout(() => setImpactPulse('none'), isHeavy ? 180 : 110);
            }
            break;
          case 'room:closed':
            setClosedReason(msg.reason);
            setRoom(null);
            setJoinedPlayerId(null);
            joinedPlayerIdRef.current = null;
            break;
          case 'error':
            setErrorMsg(msg.message);
            break;
        }
      },
    });
    wsRef.current = socket;

    return () => {
      socket.close();
      wsRef.current = null;
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Periodic 30Hz input pump while connected
  useEffect(() => {
    if (!joinedPlayerId) return;
    const id = setInterval(() => {
      sendCurrentInput(false);
    }, 33);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joinedPlayerId]);

  // Optional Keyboard Support for Desktop Test Controller Mode
  useEffect(() => {
    if (keyboardProfile === 'none' || !joinedPlayerId) return;

    const recomputeKeyboard = () => {
      const keys = keysDownRef.current;
      let dx = 0;
      let dy = 0;
      let a = false;
      let b = false;

      if (keyboardProfile === 'wasd') {
        if (keys.has('KeyA')) dx -= 1;
        if (keys.has('KeyD')) dx += 1;
        if (keys.has('KeyW')) dy -= 1;
        if (keys.has('KeyS')) dy += 1;
        a = keys.has('Space') || keys.has('KeyJ');
        b = keys.has('ShiftLeft') || keys.has('KeyK');
      } else if (keyboardProfile === 'arrows') {
        if (keys.has('ArrowLeft')) dx -= 1;
        if (keys.has('ArrowRight')) dx += 1;
        if (keys.has('ArrowUp')) dy -= 1;
        if (keys.has('ArrowDown')) dy += 1;
        a = keys.has('Enter') || keys.has('Slash');
        b = keys.has('ShiftRight') || keys.has('Period');
      }

      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }

      inputRef.current = { dx, dy, a, b };
      setKnobOffset({ x: dx * 38, y: dy * 38 });
      setStickActive(len > 0);
      setPressedA(a);
      setPressedB(b);
      sendCurrentInput(true);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const watched =
        keyboardProfile === 'wasd'
          ? ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'KeyJ', 'KeyK']
          : ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', 'ShiftRight', 'Slash', 'Period'];
      if (!watched.includes(e.code)) return;
      e.preventDefault();
      if (!keysDownRef.current.has(e.code)) {
        keysDownRef.current.add(e.code);
        recomputeKeyboard();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (keysDownRef.current.has(e.code)) {
        keysDownRef.current.delete(e.code);
        recomputeKeyboard();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyboardProfile, joinedPlayerId]);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = roomCode.trim().toUpperCase();
    if (cleaned.length !== 4) {
      setErrorMsg('Enter the 4-letter room code shown on the monitor.');
      return;
    }
    setErrorMsg(null);
    if (!embedded) {
      controllerHaptics.unlock();
      vibrate(45, { fromUserGesture: true, intensity: 'light' });
    }
    enterFullscreenAndLandscape();
    wsRef.current?.send({
      type: 'room:join',
      code: cleaned,
      name: playerName.trim() || 'Player',
      playerId: storedPlayerIdRef.current,
      preferredColorId: preferredColor,
    });
  };

  const handleLeave = () => {
    wsRef.current?.send({ type: 'player:leave' });
    storedPlayerIdRef.current = undefined;
    joinedPlayerIdRef.current = null;
    if (!embedded) {
      sessionStorage.removeItem(sessionKey);
      try {
        const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
        orientation?.unlock?.();
        if (document.fullscreenElement) {
          document.exitFullscreen?.().catch(() => {});
        }
      } catch {
        // Ignore unlock/exit errors
      }
    }
    setJoinedPlayerId(null);
    setRoom(null);
    if (onExit) onExit();
  };

  const me = room?.players.find((p) => p.id === joinedPlayerId) ?? null;
  const gameMeta = room ? getGameMeta(room.selectedGameId) : null;

  // --- Multi-touch Analog Joystick Pointer Handlers (Rotation-Aware!) ---
  const maxStickRadius = embedded ? 38 : 54;

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const dxScreen = clientX - stickCenterRef.current.x;
    const dyScreen = clientY - stickCenterRef.current.y;

    // When container is CSS-rotated 90deg clockwise (portrait phone forced to landscape),
    // inverse-rotate viewport pointer delta into local landscape joystick coordinates:
    // localX = dyScreen, localY = -dxScreen
    const localDx = isCssRotatedRef.current ? dyScreen : dxScreen;
    const localDy = isCssRotatedRef.current ? -dxScreen : dyScreen;

    const dist = Math.hypot(localDx, localDy);
    const clamped = Math.min(dist, maxStickRadius);
    const angle = Math.atan2(localDy, localDx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;

    const normMag = clamped / maxStickRadius;
    const deadzone = 0.08;
    const adjMag = normMag < deadzone ? 0 : (normMag - deadzone) / (1 - deadzone);

    inputRef.current.dx = Math.cos(angle) * adjMag;
    inputRef.current.dy = Math.sin(angle) * adjMag;
    setKnobOffset({ x: ox, y: oy });
    sendCurrentInput(true);
  };

  const onStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== null && stickPointerId.current !== e.pointerId) return;
    // Do NOT call e.preventDefault() here — `.gamepad-surface` uses CSS `touch-action: none`,
    // and keeping pointerdown non-cancelled allows Android Chrome & iOS Safari to grant sticky
    // User Activation for hardware vibration and audio unlock!
    if (!embedded) {
      controllerHaptics.unlock();
      vibrate(42, { fromUserGesture: true, intensity: 'light' });
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some mobile browsers skip pointer capture; still works via zone events
    }
    stickPointerId.current = e.pointerId;
    const rect = stickZoneRef.current?.getBoundingClientRect();
    if (rect) {
      stickCenterRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    } else {
      stickCenterRef.current = { x: e.clientX, y: e.clientY };
    }
    setStickActive(true);
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const onStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const releaseStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    stickPointerId.current = null;
    setStickActive(false);
    setKnobOffset({ x: 0, y: 0 });
    inputRef.current.dx = 0;
    inputRef.current.dy = 0;
    sendCurrentInput(true);
  };

  // --- Multi-touch Action Button Handlers ---
  const onActionDown = (which: 'a' | 'b', e: React.PointerEvent<HTMLElement>) => {
    // Do NOT call e.preventDefault() — lets `<label><input switch /></label>` natively trigger
    // iOS 18 Taptic Engine AND lets Android Chrome grant trusted user activation for navigator.vibrate().
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    if (which === 'a') {
      btnAPointers.current.add(e.pointerId);
      inputRef.current.a = true;
      setPressedA(true);
    } else {
      btnBPointers.current.add(e.pointerId);
      inputRef.current.b = true;
      setPressedB(true);
    }
    if (!embedded) {
      controllerHaptics.unlock();
      vibrate(65, { fromUserGesture: true, intensity: 'medium' });
    }
    sendCurrentInput(true);
  };

  const onActionUp = (which: 'a' | 'b', e: React.PointerEvent<HTMLElement>) => {
    if (which === 'a') {
      btnAPointers.current.delete(e.pointerId);
      if (btnAPointers.current.size === 0) {
        inputRef.current.a = false;
        setPressedA(false);
      }
    } else {
      btnBPointers.current.delete(e.pointerId);
      if (btnBPointers.current.size === 0) {
        inputRef.current.b = false;
        setPressedB(false);
      }
    }
    sendCurrentInput(true);
  };

  // Wrapper that renders full-screen & landscape-rotated on connected phones
  const renderConnectedShell = (children: ReactNode) => {
    if (embedded) {
      return (
        <div className="gamepad-surface rounded-2xl border border-[#2C3342] bg-[#14171E] text-white p-3.5 overflow-hidden">
          {children}
        </div>
      );
    }

    if (isCssRotated) {
      return (
        <div className="fixed inset-0 bg-[#14171E] overflow-hidden gamepad-surface z-50">
          <div
            className="fixed top-1/2 left-1/2 flex flex-col justify-between bg-[#14171E] text-white overflow-hidden"
            style={{
              width: '100dvh',
              height: '100dvw',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              padding: 'max(10px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)) max(16px, env(safe-area-inset-top))',
            }}
          >
            {children}
          </div>
        </div>
      );
    }

    return (
      <div
        className="fixed inset-0 w-screen h-[100dvh] flex flex-col justify-between bg-[#14171E] text-white overflow-hidden gamepad-surface z-50"
        style={{
          padding: 'max(10px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left))',
        }}
      >
        {children}
      </div>
    );
  };

  // =====================================================================
  // STATE 1: ROOM CLOSED RECOVERY
  // =====================================================================
  if (closedReason) {
    return (
      <div className="min-h-screen bg-[#121419] text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-display text-2xl font-bold">Room Closed</h2>
        <p className="mt-2 text-sm text-[#9CA3AF] max-w-sm">{closedReason}</p>
        <button
          type="button"
          onClick={() => setClosedReason(null)}
          className="tactile-btn mt-6 px-6 py-3 rounded-xl bg-[#FF4D2E] text-white font-semibold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Join Another Room
        </button>
      </div>
    );
  }

  // =====================================================================
  // STATE 2: JOIN ROOM FORM (Not yet joined)
  // =====================================================================
  if (!room || !me || !gameMeta) {
    return (
      <div
        className={`${
          embedded ? 'p-4' : 'min-h-screen p-5 flex flex-col justify-between'
        } bg-[#121419] text-white`}
      >
        {!embedded && (
          <div className="max-w-md w-full mx-auto flex items-center justify-between h-12">
            {onExit ? (
              <button
                type="button"
                onClick={onExit}
                className="min-h-[44px] min-w-[44px] -ml-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#9CA3AF] hover:text-white cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <span className="font-display font-bold text-lg">JoinStick Arcade</span>
            )}
            <span className="text-xs font-medium text-[#9CA3AF] flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#10D98B]' : 'bg-[#FFB800]'}`}
              />
              {wsConnected ? 'Live' : 'Connecting'}
            </span>
          </div>
        )}

        <div className="max-w-md w-full mx-auto my-auto py-4">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            Connect Your Controller
          </h1>
          <p className="mt-1.5 text-sm text-[#9CA3AF]">
            Enter the 4-letter code on the game monitor. Your controller switches to full-screen
            landscape as soon as you join.
          </p>

          <form onSubmit={handleJoinSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor={`room-code-${sessionKey}`}
                className="block text-xs font-semibold text-[#A5AEBD] mb-2"
              >
                Room Code
              </label>
              <input
                id={`room-code-${sessionKey}`}
                type="text"
                maxLength={4}
                autoComplete="off"
                value={roomCode}
                onChange={(e) =>
                  setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                placeholder="ABCD"
                className="w-full h-14 px-4 rounded-xl bg-[#1A1E26] border border-[#2F3747] focus:border-[#00C2FF] focus:outline-none font-mono text-2xl font-bold tracking-[0.35em] text-center text-white uppercase"
              />
            </div>

            <div>
              <label
                htmlFor={`player-name-${sessionKey}`}
                className="block text-xs font-semibold text-[#A5AEBD] mb-2"
              >
                Player Name
              </label>
              <input
                id={`player-name-${sessionKey}`}
                type="text"
                maxLength={14}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Your arcade name"
                className="w-full h-12 px-4 rounded-xl bg-[#1A1E26] border border-[#2F3747] focus:border-[#00C2FF] focus:outline-none text-base font-medium text-white"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#A5AEBD] mb-2.5">
                Controller Color
              </span>
              <div className="grid grid-cols-8 gap-2">
                {PLAYER_PALETTE.map((c) => {
                  const selected = preferredColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      title={c.name}
                      aria-label={`Select color ${c.name}`}
                      onClick={() => setPreferredColor(c.id)}
                      className={`h-10 rounded-lg transition-transform flex items-center justify-center cursor-pointer ${
                        selected
                          ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-[#121419]'
                          : 'opacity-80 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c.hex }}
                    >
                      {selected && <Check className="w-4 h-4" style={{ color: c.textOnColor }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 text-sm text-[#FF9B8A]">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={!wsConnected}
              className="tactile-btn w-full h-13 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] disabled:opacity-50 text-white font-bold text-base shadow-[0_4px_0_#B82E17] cursor-pointer"
            >
              Join Room & Open Gamepad
            </button>
          </form>
        </div>

        {!embedded && (
          <div className="max-w-md w-full mx-auto text-center text-xs text-[#6B7280] py-2">
            Full-screen landscape gamepad activates automatically once connected.
          </div>
        )}
      </div>
    );
  }

  // =====================================================================
  // STATE 3: LOBBY WAITING SCREEN (Full-screen landscape-ready on phones!)
  // =====================================================================
  if (room.status === 'LOBBY') {
    return renderConnectedShell(
      <div className="flex flex-col justify-between h-full w-full max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 h-11 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-8 h-8 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0"
              style={{ backgroundColor: me.color.hex, color: me.color.textOnColor }}
            >
              P{me.slotIndex + 1}
            </span>
            <div className="min-w-0 leading-tight">
              <div className="font-bold text-sm truncate">{me.name}</div>
              <div className="text-[11px] text-[#9CA3AF] font-mono">Room {room.code}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!embedded && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                className="h-9 px-2.5 rounded-lg bg-[#222733] hover:bg-[#2B3140] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLeave}
              className="h-9 px-3 rounded-lg bg-[#222733] hover:bg-[#2B3140] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Leave
            </button>
          </div>
        </div>

        <div
          className={`flex-1 grid ${
            embedded ? 'grid-cols-1 gap-3 my-3' : 'grid-cols-2 gap-5 my-3 items-center'
          }`}
        >
          <div className="p-4 rounded-xl bg-[#1C2029] border border-[#2B3140]">
            <div className="text-xs font-medium text-[#9CA3AF]">
              Selected Game · {gameMeta.category}
            </div>
            <div className="font-display text-xl font-bold text-white mt-0.5">{gameMeta.name}</div>
            <p className="text-xs text-[#A5AEBD] mt-1 leading-relaxed">
              {gameMeta.controllerSchema.controlTip}
            </p>

            <div className="mt-3 pt-2.5 border-t border-[#2A303D] flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">Buttons</span>
              <span className="font-semibold text-white">
                {gameMeta.controllerSchema.actionA.label} / {gameMeta.controllerSchema.actionB.label}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 justify-center">
            <label
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!embedded) {
                  controllerHaptics.unlock();
                  vibrate(65, {
                    fromUserGesture: true,
                    intensity: 'medium',
                    force: true,
                    skipIosSwitch: true,
                  });
                }
                enterFullscreenAndLandscape();
                wsRef.current?.send({ type: 'player:ready', ready: !me.ready });
              }}
              className="relative tactile-btn w-full h-16 rounded-xl font-display font-bold text-lg cursor-pointer transition-colors flex items-center justify-center select-none"
              style={
                me.ready
                  ? {
                      backgroundColor: '#10D98B',
                      color: '#0A1913',
                      boxShadow: '0 4px 0 #0A915D',
                    }
                  : {
                      backgroundColor: me.color.hex,
                      color: me.color.textOnColor,
                      boxShadow: `0 4px 0 ${me.color.dark}`,
                    }
              }
            >
              <IosHapticSwitch enabled={!embedded && hapticsEnabled} />
              <span>{me.ready ? 'Ready! Waiting for Host' : 'Tap to Ready Up'}</span>
            </label>

            {!embedded && (
              <div className="space-y-1.5">
                <label
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    controllerHaptics.unlock();
                    const res = vibrate([120, 60, 180], {
                      fromUserGesture: true,
                      intensity: 'heavy',
                      force: true,
                      skipIosSwitch: true,
                    });
                    setImpactPulse('heavy');
                    setTimeout(() => setImpactPulse('none'), 220);
                    setHapticNotice(controllerHaptics.describeResult(res));
                  }}
                  className="relative w-full h-10 rounded-xl bg-[#1C2029] border border-[#2B3140] text-xs font-medium text-[#9CA3AF] hover:text-white inline-flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  <IosHapticSwitch enabled={hapticsEnabled} />
                  <Vibrate className="w-3.5 h-3.5" />
                  <span>Test Vibration / Haptics</span>
                </label>
                {hapticNotice && (
                  <p className="text-[11px] text-center text-[#10D98B] leading-snug">
                    {hapticNotice}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-[11px] text-[#6B7280] shrink-0">
          {keyboardProfile === 'wasd'
            ? 'Keyboard active: W A S D to move · Space (A) · Left Shift (B)'
            : keyboardProfile === 'arrows'
            ? 'Keyboard active: Arrow Keys to move · Enter (A) · Right Shift (B)'
            : 'Hold your phone horizontally — your joystick opens automatically when the host starts.'}
        </div>
      </div>
    );
  }

  // =====================================================================
  // STATE 4: RESULTS SUMMARY ON PHONE (Full-screen landscape-ready)
  // =====================================================================
  if (room.status === 'RESULTS') {
    const myRank = room.rankings.find((r) => r.playerId === me.id);
    return renderConnectedShell(
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center font-display text-2xl font-extrabold"
          style={{ backgroundColor: me.color.hex, color: me.color.textOnColor }}
        >
          #{myRank?.rank ?? '-'}
        </div>
        <h2 className="font-display text-2xl font-extrabold mt-2.5">
          {myRank?.rank === 1 ? 'Victory!' : 'Match Complete'}
        </h2>
        <p className="text-sm text-[#A5AEBD] mt-1">
          {me.name} · {myRank?.score ?? me.score} pts · {myRank?.highlight ?? ''}
        </p>
        <p className="text-xs text-[#6B7280] mt-3">
          Waiting for the host to start a rematch or switch games.
        </p>
      </div>
    );
  }

  // =====================================================================
  // STATE 4B: PRE-MATCH OBJECTIVE & CONTROLS BRIEFING ON PHONE
  // =====================================================================
  if (room.status === 'BRIEFING') {
    const schema = gameMeta.controllerSchema;
    return renderConnectedShell(
      <div className="flex flex-col justify-between h-full w-full max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-3 h-10 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-7 h-7 rounded-md font-mono font-bold text-xs flex items-center justify-center shrink-0"
              style={{ backgroundColor: me.color.hex, color: me.color.textOnColor }}
            >
              P{me.slotIndex + 1}
            </span>
            <span className="font-display font-bold text-base text-white truncate">
              {gameMeta.name}
            </span>
            <span className="text-xs text-[#9CA3AF] truncate">· How to Play</span>
          </div>
          <span className="font-mono text-xs font-bold text-[#FFB800] shrink-0 tabular-nums">
            Starting in {room.countdownValue}s
          </span>
        </div>

        <div
          className={`flex-1 grid ${
            embedded ? 'grid-cols-1 gap-2.5 my-2' : 'grid-cols-2 gap-4 my-2 items-center'
          }`}
        >
          <div className="p-3.5 rounded-xl bg-[#1A1E27] border border-[#2A3142]">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Objective
            </div>
            <p className="mt-1 text-sm font-semibold text-white leading-snug">
              {gameMeta.tagline}
            </p>
            <p className="mt-2 text-xs text-[#A5AEBD] leading-relaxed">
              {schema.controlTip}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#1A1E27] border border-[#2A3142] space-y-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
              Your Controls
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">Left Joystick</span>
              <span className="font-bold text-white">{schema.joystickLabel}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">Button A</span>
              <span className="font-bold" style={{ color: schema.actionA.colorHex }}>
                {schema.actionA.label} · {schema.actionA.sublabel}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#9CA3AF]">Button B</span>
              <span className="font-bold" style={{ color: schema.actionB.colorHex }}>
                {schema.actionB.label} · {schema.actionB.sublabel}
              </span>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-[#8B95A7] shrink-0">
          Your live gamepad opens automatically when the countdown begins.
        </div>
      </div>
    );
  }

  // =====================================================================
  // STATE 5: LIVE GAME-ADAPTIVE MULTI-TOUCH GAMEPAD (FULLSCREEN LANDSCAPE)
  // =====================================================================
  const schema = gameMeta.controllerSchema;
  const cdA = Math.max(0, Math.min(1, me.cooldownA));
  const cdB = Math.max(0, Math.min(1, me.cooldownB));

  return renderConnectedShell(
    <div
      className="flex flex-col justify-between h-full w-full max-w-4xl mx-auto transition-transform duration-75"
      style={{
        transform:
          impactPulse === 'heavy'
            ? 'translate3d(4px, -2px, 0) scale(0.992)'
            : impactPulse === 'light'
            ? 'translate3d(2px, 0, 0)'
            : 'translate3d(0, 0, 0)',
        boxShadow:
          impactPulse === 'heavy'
            ? 'inset 0 0 0 3px rgba(255, 77, 46, 0.75)'
            : impactPulse === 'light'
            ? `inset 0 0 0 2px ${me.color.hex}`
            : 'none',
        borderRadius: '14px',
      }}
    >
      {/* Compact Top Status Bar */}
      <div className="flex items-center justify-between gap-3 h-10 shrink-0 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-7 h-7 rounded-md font-mono font-bold text-xs flex items-center justify-center shrink-0"
            style={{ backgroundColor: me.color.hex, color: me.color.textOnColor }}
          >
            P{me.slotIndex + 1}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-xs font-bold text-white truncate">{me.name}</div>
            <div className="text-[11px] font-mono text-[#9CA3AF] truncate tabular-nums">
              {me.statText}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-[#9CA3AF]">
            {gameMeta.name}
          </span>
          {!wsConnected && (
            <span className="text-[11px] font-semibold text-[#FFB800]">Reconnecting...</span>
          )}
          {!embedded && (
            <button
              type="button"
              onClick={() => {
                const next = !hapticsEnabled;
                setHapticsEnabled(next);
                controllerHaptics.setEnabled(next);
                if (next) {
                  controllerHaptics.unlock();
                  vibrate([90, 45, 120], {
                    fromUserGesture: true,
                    intensity: 'heavy',
                    force: true,
                  });
                }
              }}
              aria-label={hapticsEnabled ? 'Disable haptics' : 'Enable haptics'}
              title={hapticsEnabled ? 'Haptics On' : 'Haptics Off'}
              className={`min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center cursor-pointer ${
                hapticsEnabled
                  ? 'bg-[#202531] text-[#10D98B]'
                  : 'bg-[#202531] text-[#6B7280]'
              }`}
            >
              <Vibrate className="w-4 h-4" />
            </button>
          )}
          {!embedded && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              className="min-h-[34px] min-w-[34px] rounded-lg bg-[#202531] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={handleLeave}
            aria-label="Leave room"
            className="min-h-[34px] min-w-[34px] rounded-lg bg-[#202531] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Tactile Gamepad Deck: Dedicated Left & Right Halves (Zero Overlap!) */}
      <div className="flex-1 grid grid-cols-2 items-center gap-4 min-h-0">
        {/* Left Half: Generous Touch Zone for 360° Analog Virtual Joystick */}
        <div
          onPointerDown={onStickPointerDown}
          onPointerMove={onStickPointerMove}
          onPointerUp={releaseStick}
          onPointerCancel={releaseStick}
          onLostPointerCapture={releaseStick}
          onContextMenu={(e) => e.preventDefault()}
          className="h-full flex flex-col items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
        >
          <div
            ref={stickZoneRef}
            className={`relative rounded-full bg-[#0D0F14] border-2 flex items-center justify-center pointer-events-none ${
              embedded ? 'w-32 h-32' : 'w-44 h-44 sm:w-48 sm:h-48'
            }`}
            style={{
              borderColor: stickActive ? me.color.hex : '#2B3240',
              boxShadow: 'inset 0 6px 18px rgba(0,0,0,0.65)',
            }}
          >
            {/* Subtle directional crosshairs */}
            <div className="absolute inset-4 rounded-full border border-dashed border-white/10" />
            <div className="absolute w-px h-3/4 bg-white/5" />
            <div className="absolute h-px w-3/4 bg-white/5" />

            {/* Movable tactile thumbstick knob */}
            <div
              className={`rounded-full flex items-center justify-center ${
                embedded ? 'w-14 h-14' : 'w-20 h-20'
              }`}
              style={{
                transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
                backgroundColor: me.color.hex,
                boxShadow: `0 6px 0 ${me.color.dark}, 0 10px 20px rgba(0,0,0,0.5)`,
              }}
            >
              <div className="w-1/2 h-1/2 rounded-full bg-black/20 border border-white/25" />
            </div>
          </div>

          <span className="mt-2 text-[11px] font-semibold text-[#8B95A7] tracking-wide pointer-events-none">
            {schema.joystickLabel}
          </span>
        </div>

        {/* Right Half: Game-Adaptive Action Buttons A & B */}
        <div
          onContextMenu={(e) => e.preventDefault()}
          className="h-full flex items-center justify-center touch-none select-none"
        >
          <div className={`flex items-center justify-center ${embedded ? 'gap-3' : 'gap-6'}`}>
            {/* Secondary Action B */}
            <div className="flex flex-col items-center mt-4">
              <label
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onActionDown('b', e)}
                onPointerUp={(e) => onActionUp('b', e)}
                onPointerCancel={(e) => onActionUp('b', e)}
                onLostPointerCapture={(e) => onActionUp('b', e)}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative rounded-full flex flex-col items-center justify-center font-display font-extrabold touch-none select-none cursor-pointer ${
                  embedded ? 'w-20 h-20 text-xs' : 'w-26 h-26 sm:w-28 sm:h-28 text-sm'
                }`}
                style={{
                  backgroundColor: schema.actionB.colorHex,
                  color: schema.actionB.textColor,
                  transform: pressedB ? 'translateY(4px) scale(0.96)' : 'translateY(0)',
                  boxShadow: pressedB
                    ? `0 2px 0 ${schema.actionB.darkHex}`
                    : `0 6px 0 ${schema.actionB.darkHex}, 0 10px 20px rgba(0,0,0,0.45)`,
                  opacity: cdB > 0.05 ? 0.65 : 1,
                }}
              >
                <IosHapticSwitch enabled={!embedded && hapticsEnabled} />
                <ActionIcon icon={schema.actionB.icon} className="w-5 h-5 mb-0.5 pointer-events-none" />
                <span className="pointer-events-none">{schema.actionB.label}</span>
                {cdB > 0.05 && (
                  <span className="text-[10px] font-mono opacity-90 tabular-nums pointer-events-none">
                    {Math.round((1 - cdB) * 100)}%
                  </span>
                )}
              </label>
              <span className="mt-2 text-[11px] font-medium text-[#8B95A7]">
                {schema.actionB.sublabel}
              </span>
            </div>

            {/* Primary Action A */}
            <div className="flex flex-col items-center -mt-4">
              <label
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onActionDown('a', e)}
                onPointerUp={(e) => onActionUp('a', e)}
                onPointerCancel={(e) => onActionUp('a', e)}
                onLostPointerCapture={(e) => onActionUp('a', e)}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative rounded-full flex flex-col items-center justify-center font-display font-extrabold touch-none select-none cursor-pointer ${
                  embedded ? 'w-22 h-22 text-xs' : 'w-30 h-30 sm:w-32 sm:h-32 text-base'
                }`}
                style={{
                  backgroundColor: schema.actionA.colorHex,
                  color: schema.actionA.textColor,
                  transform: pressedA ? 'translateY(4px) scale(0.96)' : 'translateY(0)',
                  boxShadow: pressedA
                    ? `0 2px 0 ${schema.actionA.darkHex}`
                    : `0 7px 0 ${schema.actionA.darkHex}, 0 12px 24px rgba(0,0,0,0.48)`,
                  opacity: cdA > 0.05 && room.selectedGameId !== 'turbo-drift' ? 0.72 : 1,
                }}
              >
                <IosHapticSwitch enabled={!embedded && hapticsEnabled} />
                <ActionIcon icon={schema.actionA.icon} className="w-6 h-6 mb-0.5 pointer-events-none" />
                <span className="pointer-events-none">{schema.actionA.label}</span>
                {room.selectedGameId === 'turbo-drift' ? (
                  <span className="text-[10px] font-mono opacity-90 tabular-nums pointer-events-none">
                    {Math.round((1 - cdA) * 100)}%
                  </span>
                ) : cdA > 0.05 ? (
                  <span className="text-[10px] font-mono opacity-90 tabular-nums pointer-events-none">
                    {Math.round((1 - cdA) * 100)}%
                  </span>
                ) : null}
              </label>
              <span className="mt-2 text-[11px] font-medium text-[#8B95A7]">
                {schema.actionA.sublabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Bottom Helper Strip */}
      <div className="text-center text-[11px] text-[#6B7280] shrink-0">
        {room.status === 'COUNTDOWN'
          ? `Match starting in ${room.countdownValue}...`
          : room.status === 'PAUSED'
          ? 'Game paused on monitor'
          : !me.alive
          ? 'Knocked out — watch the monitor for next round or respawn'
          : keyboardProfile === 'wasd'
          ? 'Keys: W A S D · Space (A) · Left Shift (B)'
          : keyboardProfile === 'arrows'
          ? 'Keys: Arrows · Enter (A) · Right Shift (B)'
          : schema.controlTip}
      </div>
    </div>
  );
}
