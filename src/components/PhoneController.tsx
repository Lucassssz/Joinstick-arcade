import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Bomb,
  Bot,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Crosshair,
  Crown,
  Flame,
  Footprints,
  Gauge,
  LogOut,
  Maximize2,
  Minimize2,
  Paintbrush,
  Pause,
  RefreshCw,
  RotateCcw,
  Shield,
  Target,
  Vibrate,
  Waves,
  WifiOff,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  filterGamesByPlayerMode,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import {
  ActionButtonSpec,
  ControllerInput,
  PLAYER_PALETTE,
  RemoteDirection,
  RoomSnapshot,
  ServerMessage,
} from '../shared/types';
import { ManagedWebSocket } from '../lib/ws';
import { controllerHaptics, HapticIntensity, HapticResult } from '../lib/haptics';
import {
  getLocalizedDifficulty,
  getLocalizedFilterLabel,
  getLocalizedGameMeta,
  LanguageToggle,
  translateGameText,
  translateServerMessage,
  useLanguage,
} from '../lib/i18n';

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

const QUICK_EMOTES = ['🔥', '😂', '⚡', '👑', '🎉', '👏'];

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
  const { lang, t } = useLanguage();
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
  const [passHostOpen, setPassHostOpen] = useState(false);
  const [hostToast, setHostToast] = useState<string | null>(null);
  const impactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDisconnectedRef = useRef<boolean>(false);
  const prevIsHostRef = useRef<boolean>(false);
  const hostToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setPassHostOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.selectedGameId, room?.hostPlayerId]);

  // Clear stuck touches if browser tab loses focus
  useEffect(() => {
    const onBlur = () => resetControlsState();
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-acquire Screen Wake Lock when returning to the phone browser tab
  useEffect(() => {
    if (embedded || !joinedPlayerId) return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
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
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [embedded, joinedPlayerId]);

  // Alert player immediately with a warning haptic if connection drops mid-session
  useEffect(() => {
    const selfPlayer = room?.players.find((p) => p.id === joinedPlayerId) ?? null;
    const isLost = Boolean(joinedPlayerId && room && (!wsConnected || (selfPlayer && !selfPlayer.connected)));
    if (isLost && !wasDisconnectedRef.current) {
      wasDisconnectedRef.current = true;
      resetControlsState();
      if (!embedded) {
        vibrate([110, 55, 110], { fromUserGesture: false, intensity: 'heavy', force: true });
      }
    } else if (!isLost && wasDisconnectedRef.current) {
      wasDisconnectedRef.current = false;
      if (!embedded) {
        vibrate(45, { fromUserGesture: false, intensity: 'light' });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsConnected, joinedPlayerId, room, embedded]);

  // Notify the player if they inherit Host Remote Control mid-session
  useEffect(() => {
    const isHostNow = Boolean(room && joinedPlayerId && room.hostPlayerId === joinedPlayerId);
    const wasHost = prevIsHostRef.current;
    prevIsHostRef.current = isHostNow;

    if (!wasHost && isHostNow && room && room.status !== 'SETUP') {
      setHostToast(
        lang === 'zh'
          ? '你已成为新房主！现在由你使用遥控器控制大屏。'
          : 'You are now the Room Host! Use this remote to control the TV.'
      );
      if (hostToastTimerRef.current) clearTimeout(hostToastTimerRef.current);
      hostToastTimerRef.current = setTimeout(() => setHostToast(null), 4200);
    }
  }, [room?.hostPlayerId, room?.status, joinedPlayerId, lang]);

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
            storedPlayerIdRef.current = undefined;
            joinedPlayerIdRef.current = null;
            if (!embedded) sessionStorage.removeItem(sessionKey);
            setClosedReason(msg.reason);
            setRoom(null);
            setJoinedPlayerId(null);
            break;
          case 'error':
            if (msg.code === 'ROOM_NOT_FOUND' && joinedPlayerIdRef.current) {
              storedPlayerIdRef.current = undefined;
              joinedPlayerIdRef.current = null;
              if (!embedded) sessionStorage.removeItem(sessionKey);
              setJoinedPlayerId(null);
              setRoom(null);
            }
            setErrorMsg(msg.message);
            break;
        }
      },
    });
    wsRef.current = socket;

    return () => {
      socket.close();
      wsRef.current = null;
      if (hostToastTimerRef.current) clearTimeout(hostToastTimerRef.current);
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
      setErrorMsg(
        t(
          'Enter the 4-letter room code shown on the monitor.',
          '请输入大屏上显示的 4 位房间码。'
        )
      );
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
  const gameMeta = room ? getLocalizedGameMeta(getGameMeta(room.selectedGameId), lang) : null;

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

  const handleManualReconnect = () => {
    setErrorMsg(null);
    if (!embedded) {
      controllerHaptics.unlock();
      vibrate(45, { fromUserGesture: true, intensity: 'light', force: true });
    }
    if (wsRef.current) {
      wsRef.current.reconnectNow();
    }
  };

  // Wrapper that renders full-screen & landscape-rotated on connected phones
  const renderConnectedShell = (children: ReactNode) => {
    const selfPlayer = room?.players.find((p) => p.id === joinedPlayerId) ?? null;
    const isConnectionLost = Boolean(
      joinedPlayerId && room && (!wsConnected || (selfPlayer && !selfPlayer.connected))
    );

    const statusOverlays = (
      <>
        {hostToast && !isConnectionLost && (
          <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-[65] px-4 py-2 rounded-xl bg-[#FFB800] text-[#14120B] font-display font-extrabold text-xs sm:text-sm shadow-xl inline-flex items-center gap-1.5 whitespace-nowrap">
            <Crown className="w-4 h-4 shrink-0" />
            <span>{hostToast}</span>
          </div>
        )}

        {isConnectionLost && (
          <div
            role="alert"
            aria-live="assertive"
            className="absolute inset-0 z-[70] bg-[#0B0D12]/92 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="max-w-sm w-full rounded-2xl bg-[#1A1E26] border-2 border-[#FF4D2E] p-5 text-center shadow-2xl">
              <div className="w-12 h-12 rounded-2xl bg-[#FF4D2E]/20 border border-[#FF4D2E]/50 text-[#FF4D2E] flex items-center justify-center mx-auto animate-pulse">
                <WifiOff className="w-6 h-6" />
              </div>
              <h3 className="mt-3 font-display text-xl font-extrabold text-white">
                {t('Controller Disconnected!', '手柄连接已断开！')}
              </h3>
              <p className="mt-1.5 text-xs text-[#D1D5DB] leading-relaxed">
                {t(
                  'Signal dropped — your button taps are paused while we reconnect.',
                  '网络信号中断 — 正在自动重连，重连前按键暂不生效。'
                )}
              </p>
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={handleManualReconnect}
                  className="tactile-btn w-full sm:w-auto h-11 px-5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-extrabold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t('Reconnect Now', '立即重连')}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLeave}
                  className="h-11 px-4 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-[#D1D5DB] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('Leave Room', '退出房间')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );

    if (embedded) {
      return (
        <div className="relative gamepad-surface rounded-2xl border border-[#2A303D] bg-[#121419] text-[#F4F6FA] p-3.5 overflow-hidden">
          {children}
          {statusOverlays}
        </div>
      );
    }

    if (isCssRotated) {
      return (
        <div className="fixed inset-0 bg-[#121419] overflow-hidden gamepad-surface z-50">
          <div
            className="fixed top-1/2 left-1/2 flex flex-col justify-between bg-[#121419] text-[#F4F6FA] overflow-hidden"
            style={{
              width: '100dvh',
              height: '100dvw',
              transform: 'translate(-50%, -50%) rotate(90deg)',
              padding: 'max(10px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)) max(16px, env(safe-area-inset-top))',
            }}
          >
            {children}
            {statusOverlays}
          </div>
        </div>
      );
    }

    return (
      <div
        className="fixed inset-0 w-screen h-[100dvh] flex flex-col justify-between bg-[#121419] text-[#F4F6FA] overflow-hidden gamepad-surface z-50"
        style={{
          padding: 'max(10px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left))',
        }}
      >
        {children}
        {statusOverlays}
      </div>
    );
  };

  // =====================================================================
  // STATE 1: ROOM CLOSED RECOVERY
  // =====================================================================
  if (closedReason) {
    return (
      <div className="min-h-screen bg-[#121419] text-white flex flex-col items-center justify-center p-6 text-center">
        <h2 className="font-display text-2xl font-bold">{t('Room Closed', '房间已关闭')}</h2>
        <p className="mt-2 text-sm text-[#9CA3AF] max-w-sm">
          {translateServerMessage(closedReason, lang)}
        </p>
        <button
          type="button"
          onClick={() => setClosedReason(null)}
          className="tactile-btn mt-6 px-6 py-3 rounded-xl bg-[#FF4D2E] text-white font-semibold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          {t('Join Another Room', '加入其他房间')}
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
          embedded ? 'p-4' : 'min-h-screen w-full max-w-full overflow-x-clip p-4 sm:p-5 flex flex-col justify-between'
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
                {t('Back', '返回')}
              </button>
            ) : (
              <span className="font-display font-bold text-lg">JoinStick Arcade</span>
            )}
            <div className="flex items-center gap-2.5">
              <LanguageToggle compact />
              <span className="text-xs font-medium text-[#9CA3AF] flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#10D98B]' : 'bg-[#FFB800]'}`}
                />
                {wsConnected ? t('Live', '已连接') : t('Connecting', '连接中')}
              </span>
            </div>
          </div>
        )}

        <div className="max-w-md w-full mx-auto my-auto py-4">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
            {t('Connect Your Controller', '连接手机手柄')}
          </h1>
          <p className="mt-1.5 text-sm text-[#9CA3AF]">
            {t(
              'Enter the 4-letter code on the game monitor. Your controller switches to full-screen landscape as soon as you join.',
              '输入大屏上的 4 位房间码，加入后手机将自动切换为全屏横屏手柄。'
            )}
          </p>

          <form onSubmit={handleJoinSubmit} className="mt-6 space-y-5">
            <div>
              <label
                htmlFor={`room-code-${sessionKey}`}
                className="block text-xs font-semibold text-[#A5AEBD] mb-2"
              >
                {t('Room Code', '房间码')}
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
                {t('Player Name', '玩家昵称')}
              </label>
              <input
                id={`player-name-${sessionKey}`}
                type="text"
                maxLength={14}
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder={t('Your arcade name', '输入你的昵称')}
                className="w-full h-12 px-4 rounded-xl bg-[#1A1E26] border border-[#2F3747] focus:border-[#00C2FF] focus:outline-none text-base font-medium text-white"
              />
            </div>

            <div>
              <span className="block text-xs font-semibold text-[#A5AEBD] mb-2.5">
                {t('Controller Color', '手柄配色')}
              </span>
              <div className="grid grid-cols-8 gap-2">
                {PLAYER_PALETTE.map((c) => {
                  const selected = preferredColor === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      title={c.name}
                      aria-label={t(`Select color ${c.name}`, `选择颜色 ${c.name}`)}
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

            {!wsConnected && (
              <div className="p-3 rounded-xl bg-[#FFB800]/15 border border-[#FFB800]/45 flex items-center justify-between gap-3 text-xs text-[#FDE68A]">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <WifiOff className="w-4 h-4 text-[#FFB800] shrink-0" />
                  {t('Disconnected from server — reconnecting...', '未连接到服务器 — 正在尝试重连...')}
                </span>
                <button
                  type="button"
                  onClick={handleManualReconnect}
                  className="px-2.5 py-1 rounded-lg bg-[#FFB800] text-[#14120B] font-bold shrink-0 cursor-pointer"
                >
                  {t('Retry', '重试')}
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 text-sm text-[#FF9B8A]">
                {translateServerMessage(errorMsg, lang)}
              </div>
            )}

            <button
              type="submit"
              disabled={!wsConnected}
              className="tactile-btn w-full h-13 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] disabled:opacity-50 text-white font-bold text-base shadow-[0_4px_0_#B82E17] cursor-pointer"
            >
              {wsConnected
                ? t('Join Room & Open Gamepad', '加入房间并打开手柄')
                : t('Reconnecting to Server...', '正在连接服务器...')}
            </button>
          </form>
        </div>

        {!embedded && (
          <div className="max-w-md w-full mx-auto text-center text-xs text-[#6B7280] py-2">
            {t(
              'Full-screen landscape gamepad activates automatically once connected.',
              '连接后自动切换为全屏横屏手柄。'
            )}
          </div>
        )}
      </div>
    );
  }

  const isRoomHost = room.hostPlayerId === me.id;
  const connectedHumans = room.players.filter((p) => !p.isBot && p.connected);
  const otherConnectedHumans = connectedHumans.filter((p) => p.id !== me.id);
  const readyHumans = connectedHumans.filter((p) => p.ready);
  const unreadyHumans = connectedHumans.filter((p) => !p.ready);
  const botCount = room.players.filter((p) => p.isBot).length;
  const hostPlayer = room.players.find((p) => p.id === room.hostPlayerId);

  const sendRemote = (action: RemoteDirection) => {
    if (!isRoomHost) return;
    setErrorMsg(null);
    if (!embedded) {
      controllerHaptics.unlock();
      vibrate(action === 'ok' ? 55 : 24, {
        fromUserGesture: true,
        intensity: action === 'ok' ? 'medium' : 'light',
        force: true,
      });
    }
    wsRef.current?.send({ type: 'remote:action', action });
  };

  const handlePassHost = (targetPlayerId: string) => {
    if (!isRoomHost) return;
    if (!embedded) {
      controllerHaptics.unlock();
      vibrate([35, 25, 65], { fromUserGesture: true, intensity: 'medium', force: true });
    }
    wsRef.current?.send({ type: 'room:set-host-player', playerId: targetPlayerId });
    setPassHostOpen(false);
  };

  const describeRemoteTarget = (): { kicker: string; title: string } => {
    const focus = room.remoteFocus;
    if (focus.zone === 'filter') {
      const opt = PLAYER_FILTER_OPTIONS[focus.index] ?? PLAYER_FILTER_OPTIONS[0];
      return {
        kicker: t('Filter Tab · Press OK to Apply', '筛选标签 · 按 OK 切换'),
        title: getLocalizedFilterLabel(opt.id, lang, false),
      };
    }
    if (focus.zone === 'games') {
      const list = filterGamesByPlayerMode(room.lobbyFilter);
      const rawGame = list[focus.index];
      const focusedGame = rawGame ? getLocalizedGameMeta(rawGame, lang) : gameMeta;
      return {
        kicker: t(
          `Game ${focus.index + 1}/${list.length} · Press OK to Open`,
          `游戏 ${focus.index + 1}/${list.length} · 按 OK 进入`
        ),
        title: focusedGame.name,
      };
    }
    const diffLabel = getLocalizedDifficulty(room.botDifficulty, lang).label;
    const actionLabels = [
      t(`Open ${gameMeta.name}`, `进入 ${gameMeta.name}`),
      t(`Change ${gameMeta.settingLabel}`, `切换 ${gameMeta.settingLabel}`),
      t('+ Add Robot', '+ 添加机器人'),
      t(`Bot Level: ${diffLabel}`, `机器人难度：${diffLabel}`),
      t('Room Setup / QR', '房间设置 / 二维码'),
    ];
    return {
      kicker: t('Bottom Action · Press OK', '底部功能 · 按 OK 执行'),
      title: actionLabels[focus.index] ?? actionLabels[0],
    };
  };

  const passHostOverlay = passHostOpen && isRoomHost && (
    <div className="absolute inset-0 z-50 bg-[#121419]/95 backdrop-blur-sm p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-[#FFB800]" />
          <span className="font-display text-lg font-extrabold text-white">
            {t('Pass Host Remote Control', '移交房主遥控权')}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPassHostOpen(false)}
          aria-label={t('Close Pass Host picker', '关闭移交房主弹窗')}
          className="h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto arcade-scrollbar my-3 pr-1">
        {otherConnectedHumans.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-sm text-[#9CA3AF]">
            {t('No other human players are connected right now.', '目前没有其他在线玩家。')}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {otherConnectedHumans.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePassHost(p.id)}
                className="tactile-btn min-h-[54px] px-4 py-2.5 rounded-xl bg-[#1A1E26] hover:bg-[#242A36] border border-[#2A303D] flex items-center justify-between gap-3 text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-8 h-8 rounded-lg font-mono text-xs font-black flex items-center justify-center shrink-0"
                    style={{ backgroundColor: p.color.hex, color: p.color.textOnColor }}
                  >
                    P{p.slotIndex + 1}
                  </span>
                  <span className="font-display font-bold text-base text-white truncate">
                    {p.name}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#FFB800] text-[#14120B] text-xs font-extrabold inline-flex items-center gap-1 shrink-0">
                  <Crown className="w-3.5 h-3.5" />
                  {t('Make Host', '设为房主')}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPassHostOpen(false)}
        className="h-10 w-full rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-white cursor-pointer shrink-0"
      >
        {t('Cancel', '取消')}
      </button>
    </div>
  );

  // =====================================================================
  // STATE 3A: ROOM SETUP SCREEN (Waiting for players / bots / host setup)
  // =====================================================================
  if (room.status === 'SETUP') {
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
              <div className="font-bold text-sm truncate flex items-center gap-1.5">
                <span className="truncate">{me.name}</span>
                {isRoomHost && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-[#FFB800] shrink-0">
                    <Crown className="w-3 h-3" />
                    {t('Host', '房主')}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#9CA3AF] font-mono">
                {t(`Room ${room.code} · Setup`, `房间 ${room.code} · 等待集结`)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!embedded && <LanguageToggle compact className="h-9" />}
            {!embedded && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')}
                className="h-9 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? t('Exit Full', '退出全屏') : t('Fullscreen', '全屏')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLeave}
              className="h-9 px-3 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('Leave', '退出')}
            </button>
          </div>
        </div>

        <div
          className={`flex-1 grid ${
            embedded ? 'grid-cols-1 gap-3 my-3' : 'grid-cols-2 gap-5 my-3 items-center'
          }`}
        >
          <div className="p-4 rounded-xl bg-[#1A1E26] border border-[#2A303D]">
            <div className="text-xs font-medium text-[#00C2FF]">
              {t('Step 1 · Room Setup', '第 1 步 · 房间集结')}
            </div>
            <div className="font-display text-xl font-bold text-white mt-0.5">
              {t(`Connected to Room ${room.code}`, `已连接到房间 ${room.code}`)}
            </div>
            <p className="text-xs text-[#A5AEBD] mt-1 leading-relaxed">
              {t(
                'Players are joining and bots are being configured on the monitor.',
                '玩家正在陆续加入，大屏端正在配置机器人与房主。'
              )}
            </p>

            <div className="mt-3 pt-2.5 border-t border-[#262C38] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Roster', '当前成员')}</span>
                <span className="font-semibold text-white inline-flex items-center gap-1.5">
                  {t(
                    `${connectedHumans.length} Human${connectedHumans.length === 1 ? '' : 's'}`,
                    `${connectedHumans.length} 名玩家`
                  )}
                  {botCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-[#00C2FF]">
                      · <Bot className="w-3.5 h-3.5" />{' '}
                      {t(`${botCount} Bot${botCount === 1 ? '' : 's'}`, `${botCount} 个机器人`)}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Room Host', '房主')}</span>
                <span className="font-semibold text-[#FFB800] inline-flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  {hostPlayer ? hostPlayer.name : t('Monitor', '大屏')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 justify-center">
            {isRoomHost ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!embedded) {
                      controllerHaptics.unlock();
                      vibrate(55, { fromUserGesture: true, intensity: 'medium', force: true });
                    }
                    enterFullscreenAndLandscape();
                    wsRef.current?.send({ type: 'room:enter-game-room' });
                  }}
                  className="tactile-btn w-full h-16 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-bold text-lg shadow-[0_4px_0_#B82E17] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>{t('Enter Game Room', '进入游戏厅')}</span>
                  <ArrowRight className="w-5 h-5" />
                </button>
                <p className="text-[11px] text-center text-[#9CA3AF]">
                  {t(
                    'You are the Room Host — tap when everyone has joined and bots are set.',
                    '你是房主 — 所有人加入并配好机器人后即可点击进入游戏厅。'
                  )}
                </p>
              </>
            ) : (
              <div className="p-4 rounded-xl bg-[#1A1E26] border border-[#2A303D] text-center">
                <div className="text-sm font-bold text-white">{t("You're In!", '加入成功！')}</div>
                <p className="text-xs text-[#9CA3AF] mt-1 leading-relaxed">
                  {t('Waiting for', '等待')}{' '}
                  <strong className="text-white">
                    {hostPlayer?.name ?? t('the Host', '房主')}
                  </strong>{' '}
                  {t('to finish setup and open the Game Room.', '完成设置并开启游戏厅。')}
                </p>
              </div>
            )}

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
                  className="relative w-full h-10 rounded-xl bg-[#1A1E26] border border-[#2A303D] text-xs font-medium text-[#9CA3AF] hover:text-white inline-flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  <IosHapticSwitch enabled={hapticsEnabled} />
                  <Vibrate className="w-3.5 h-3.5" />
                  <span>{t('Test Vibration / Haptics', '测试震动反馈')}</span>
                </label>
                {hapticNotice && (
                  <p className="text-[11px] text-center text-[#10D98B] leading-snug">
                    {translateServerMessage(hapticNotice, lang)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {QUICK_EMOTES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  if (!embedded) {
                    controllerHaptics.unlock();
                    vibrate(25, { fromUserGesture: true, intensity: 'light', force: true });
                  }
                  wsRef.current?.send({ type: 'player:emote', emoji });
                }}
                className="tactile-btn h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-base flex items-center justify-center cursor-pointer"
                aria-label={t(`Send ${emoji} reaction`, `发送 ${emoji} 表情`)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[#9CA3AF] truncate">
            {t('Tap emojis to pop reactions on the big screen!', '点击表情在大屏上发送互动弹幕！')}
          </span>
        </div>
      </div>
    );
  }

  // =====================================================================
  // STATE 3B: GAME ROOM — HOST BECOMES TV REMOTE / OTHERS GET READY PAD
  // =====================================================================
  if (room.status === 'LOBBY') {
    const allHumansReady = unreadyHumans.length === 0;
    const focusInfo = describeRemoteTarget();

    // --- HOST TV REMOTE CONTROL ---
    if (isRoomHost) {
      return renderConnectedShell(
        <div className="relative flex flex-col justify-between h-full w-full max-w-4xl mx-auto">
          {passHostOverlay}

          {/* Slim Remote Top Bar */}
          <div className="flex items-center justify-between gap-2 h-10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0"
                style={{ backgroundColor: me.color.hex, color: me.color.textOnColor }}
              >
                P{me.slotIndex + 1}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="font-bold text-xs sm:text-sm truncate flex items-center gap-1.5">
                  <span className="truncate">{me.name}</span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-extrabold text-[#FFB800] shrink-0">
                    <Crown className="w-3 h-3" />
                    {t('TV Remote', '大屏遥控器')}
                  </span>
                </div>
                <div className="text-[10px] text-[#9CA3AF] font-mono">
                  PIN {room.code} · {readyHumans.length}/{connectedHumans.length}{' '}
                  {t('Ready', '已准备')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {!embedded && <LanguageToggle compact />}
              {otherConnectedHumans.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPassHostOpen(true)}
                  className="tactile-btn h-8 px-2.5 rounded-lg bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B] text-xs font-extrabold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>{t('Pass Host', '移交房主')}</span>
                </button>
              )}
              {!embedded && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')}
                  className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={handleLeave}
                aria-label={t('Leave room', '退出房间')}
                className="h-8 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('Leave', '退出')}</span>
              </button>
            </div>
          </div>

          {/* Main 2-Column Host Remote Deck: Left = Tactile Cross D-Pad + OK, Right = TV Target + Ready + Pass Host */}
          <div
            className={`flex-1 grid ${
              embedded ? 'grid-cols-1 gap-3 my-2' : 'grid-cols-2 gap-5 my-2 items-center'
            } min-h-0`}
          >
            {/* LEFT HALF: Living-Room TV Remote D-Pad + Center OK */}
            <div className="flex flex-col items-center justify-center">
              <div
                className={`grid grid-cols-3 grid-rows-3 gap-2 p-2.5 rounded-[2rem] bg-[#151820] border-2 border-[#2A303D] shadow-[inset_0_4px_14px_rgba(0,0,0,0.55)] ${
                  embedded ? 'w-44 h-44' : 'w-52 h-52 sm:w-56 sm:h-56'
                }`}
              >
                <div />
                <button
                  type="button"
                  onClick={() => sendRemote('up')}
                  aria-label={t('Remote Up', '遥控器上')}
                  className="tactile-btn rounded-2xl bg-[#242A36] hover:bg-[#2E3646] active:bg-[#FFB800] active:text-[#14120B] text-white flex items-center justify-center shadow-[0_3px_0_#101217] cursor-pointer"
                >
                  <ChevronUp className="w-7 h-7 stroke-[2.8]" />
                </button>
                <div />

                <button
                  type="button"
                  onClick={() => sendRemote('left')}
                  aria-label={t('Remote Left', '遥控器左')}
                  className="tactile-btn rounded-2xl bg-[#242A36] hover:bg-[#2E3646] active:bg-[#FFB800] active:text-[#14120B] text-white flex items-center justify-center shadow-[0_3px_0_#101217] cursor-pointer"
                >
                  <ChevronLeft className="w-7 h-7 stroke-[2.8]" />
                </button>

                <button
                  type="button"
                  onClick={() => sendRemote('ok')}
                  aria-label={t('Remote OK', '遥控器确认')}
                  className="tactile-btn rounded-full bg-[#FF4D2E] hover:bg-[#FF6145] active:bg-[#FFB800] text-white font-display font-black text-base tracking-wide flex items-center justify-center shadow-[0_4px_0_#B82E17] cursor-pointer"
                >
                  OK
                </button>

                <button
                  type="button"
                  onClick={() => sendRemote('right')}
                  aria-label={t('Remote Right', '遥控器右')}
                  className="tactile-btn rounded-2xl bg-[#242A36] hover:bg-[#2E3646] active:bg-[#FFB800] active:text-[#14120B] text-white flex items-center justify-center shadow-[0_3px_0_#101217] cursor-pointer"
                >
                  <ChevronRight className="w-7 h-7 stroke-[2.8]" />
                </button>

                <div />
                <button
                  type="button"
                  onClick={() => sendRemote('down')}
                  aria-label={t('Remote Down', '遥控器下')}
                  className="tactile-btn rounded-2xl bg-[#242A36] hover:bg-[#2E3646] active:bg-[#FFB800] active:text-[#14120B] text-white flex items-center justify-center shadow-[0_3px_0_#101217] cursor-pointer"
                >
                  <ChevronDown className="w-7 h-7 stroke-[2.8]" />
                </button>
                <div />
              </div>
              <span className="mt-1.5 text-[11px] font-semibold text-[#9CA3AF]">
                {t('Control the big TV screen · Press OK to select', '方向键控制大屏 · 按 OK 确认')}
              </span>
            </div>

            {/* RIGHT HALF: Live TV Target Readout + Host Ready Button + Pass Host */}
            <div className="flex flex-col gap-2.5 justify-center min-w-0">
              <div className="p-3.5 rounded-xl bg-[#1A1E26] border border-[#2A303D]">
                <div className="text-[11px] font-bold text-[#FFB800] truncate">
                  {focusInfo.kicker}
                </div>
                <div className="font-display text-lg font-extrabold text-white truncate mt-0.5">
                  {focusInfo.title}
                </div>
                <div className="mt-2 pt-2 border-t border-[#262C38] flex items-center justify-between text-xs">
                  <span className="text-[#9CA3AF]">{t('Ready Check', '准备进度')}</span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      allHumansReady ? 'text-[#10D98B]' : 'text-[#FFB800]'
                    }`}
                  >
                    {readyHumans.length}/{connectedHumans.length} {t('Ready', '已准备')}
                    {botCount > 0
                      ? t(` (+${botCount} Bot${botCount === 1 ? '' : 's'})`, ` (+${botCount} 机器人)`)
                      : ''}
                  </span>
                </div>
              </div>

              {/* Host's own Ready Toggle */}
              <label
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!embedded) {
                    controllerHaptics.unlock();
                    vibrate(60, {
                      fromUserGesture: true,
                      intensity: 'medium',
                      force: true,
                      skipIosSwitch: true,
                    });
                  }
                  enterFullscreenAndLandscape();
                  setErrorMsg(null);
                  wsRef.current?.send({ type: 'player:ready', ready: !me.ready });
                }}
                className="relative tactile-btn w-full h-13 rounded-xl font-display font-extrabold text-base cursor-pointer transition-colors flex items-center justify-center gap-2 select-none"
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
                {me.ready && <Check className="w-5 h-5" />}
                <span>
                  {me.ready
                    ? allHumansReady
                      ? t('All Ready! Press OK to Open', '全员已准备！按 OK 开始')
                      : t('You Are Ready!', '你已准备就绪！')
                    : t('Tap to Ready Up', '点击准备')}
                </span>
              </label>

              {errorMsg && (
                <p className="text-[11px] text-center text-[#FF9B8A] font-medium leading-snug">
                  {translateServerMessage(errorMsg, lang)}
                </p>
              )}

              {otherConnectedHumans.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPassHostOpen(true)}
                  className="h-10 w-full rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#FFB800]/40 text-xs font-bold text-[#FFB800] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 text-[#FFB800]" />
                  <span>{t('Pass Host Remote to Another Player', '把房主遥控权交给其他玩家')}</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Emoji Reaction Strip */}
          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              {QUICK_EMOTES.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    if (!embedded) {
                      controllerHaptics.unlock();
                      vibrate(25, { fromUserGesture: true, intensity: 'light', force: true });
                    }
                    wsRef.current?.send({ type: 'player:emote', emoji });
                  }}
                  className="tactile-btn h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-sm flex items-center justify-center cursor-pointer"
                  aria-label={t(`Send ${emoji} reaction`, `发送 ${emoji} 表情`)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[#9CA3AF] truncate">
              {t('Only your Host Remote controls the TV screen', '当前仅你的房主遥控器可操作大屏')}
            </span>
          </div>
        </div>
      );
    }

    // --- NON-HOST PLAYER READY CONTROLLER ---
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
              <div className="text-[11px] text-[#9CA3AF] font-mono">
                {t(`Room ${room.code}`, `房间 ${room.code}`)} · {readyHumans.length}/
                {connectedHumans.length} {t('Ready', '已准备')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!embedded && <LanguageToggle compact className="h-9" />}
            {!embedded && (
              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')}
                className="h-9 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span>{isFullscreen ? t('Exit Full', '退出全屏') : t('Fullscreen', '全屏')}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLeave}
              className="h-9 px-3 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('Leave', '退出')}
            </button>
          </div>
        </div>

        <div
          className={`flex-1 grid ${
            embedded ? 'grid-cols-1 gap-3 my-3' : 'grid-cols-2 gap-5 my-3 items-center'
          }`}
        >
          <div className="p-4 rounded-xl bg-[#1A1E26] border border-[#2A303D]">
            <div className="text-xs font-semibold text-[#FFB800] inline-flex items-center gap-1">
              <Crown className="w-3.5 h-3.5" />
              <span>
                {t(
                  `${hostPlayer?.name ?? 'Host'} is picking a game`,
                  `${hostPlayer?.name ?? '房主'} 正在挑选游戏`
                )}
              </span>
            </div>
            <div className="font-display text-xl font-bold text-white mt-1">{gameMeta.name}</div>
            <p className="text-xs text-[#A5AEBD] mt-1 leading-relaxed">
              {gameMeta.controllerSchema.controlTip}
            </p>

            <div className="mt-3 pt-2.5 border-t border-[#262C38] space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Buttons', '按键')}</span>
                <span className="font-semibold text-white">
                  {gameMeta.controllerSchema.actionA.label} / {gameMeta.controllerSchema.actionB.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Ready Check', '准备进度')}</span>
                <span
                  className={`font-mono font-bold tabular-nums ${
                    allHumansReady ? 'text-[#10D98B]' : 'text-[#FFB800]'
                  }`}
                >
                  {readyHumans.length}/{connectedHumans.length} {t('Ready', '已准备')}
                  {botCount > 0
                    ? t(` (+${botCount} Bot${botCount === 1 ? '' : 's'})`, ` (+${botCount} 机器人)`)
                    : ''}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 justify-center">
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
                setErrorMsg(null);
                wsRef.current?.send({ type: 'player:ready', ready: !me.ready });
              }}
              className="relative tactile-btn w-full h-16 rounded-xl font-display font-bold text-lg cursor-pointer transition-colors flex items-center justify-center gap-2 select-none"
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
              {me.ready && <Check className="w-5 h-5" />}
              <span>
                {me.ready
                  ? allHumansReady
                    ? t('Ready! Waiting for Host', '已准备！等待房主开启')
                    : t('Ready! Waiting for Others', '已准备！等待其他玩家')
                  : t('Tap to Ready Up', '点击准备')}
              </span>
            </label>

            {errorMsg && (
              <p className="text-[11px] text-center text-[#FF9B8A] leading-snug">
                {translateServerMessage(errorMsg, lang)}
              </p>
            )}

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
                  className="relative w-full h-10 rounded-xl bg-[#1A1E26] border border-[#2A303D] text-xs font-medium text-[#9CA3AF] hover:text-white inline-flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  <IosHapticSwitch enabled={hapticsEnabled} />
                  <Vibrate className="w-3.5 h-3.5" />
                  <span>{t('Test Vibration / Haptics', '测试震动反馈')}</span>
                </label>
                {hapticNotice && (
                  <p className="text-[11px] text-center text-[#10D98B] leading-snug">
                    {translateServerMessage(hapticNotice, lang)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            {QUICK_EMOTES.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  if (!embedded) {
                    controllerHaptics.unlock();
                    vibrate(25, { fromUserGesture: true, intensity: 'light', force: true });
                  }
                  wsRef.current?.send({ type: 'player:emote', emoji });
                }}
                className="tactile-btn h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-base flex items-center justify-center cursor-pointer"
                aria-label={t(`Send ${emoji} reaction`, `发送 ${emoji} 表情`)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-[#9CA3AF] truncate">
            {keyboardProfile === 'wasd'
              ? t('WASD · Space (A) · Shift (B)', 'WASD 移动 · 空格 (A) · Shift (B)')
              : keyboardProfile === 'arrows'
              ? t('Arrows · Enter (A) · Shift (B)', '方向键 · 回车 (A) · Shift (B)')
              : t('Everyone must press Ready to start!', '需要全员点击准备后才能开始！')}
          </span>
        </div>
      </div>
    );
  }

  // =====================================================================
  // STATE 4: RESULTS SUMMARY ON PHONE (With Host Remote Controls!)
  // =====================================================================
  if (room.status === 'RESULTS') {
    const myRank = room.rankings.find((r) => r.playerId === me.id);
    const resultsOptionLabel =
      room.remoteFocus.modalIndex === 0 ? t('Play Again', '再来一局') : t('Game Room', '返回游戏厅');

    return renderConnectedShell(
      <div className="relative flex flex-col items-center justify-center h-full text-center px-4 gap-3">
        {passHostOverlay}
        {!embedded && (
          <div className="absolute top-1 right-1">
            <LanguageToggle compact />
          </div>
        )}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center font-display text-2xl font-extrabold"
          style={{ backgroundColor: me.color.hex, color: me.color.textOnColor }}
        >
          #{myRank?.rank ?? '-'}
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold">
            {myRank?.rank === 1 ? t('Victory!', '胜利！') : t('Match Complete', '本局结束')}
          </h2>
          <p className="text-sm text-[#A5AEBD] mt-0.5">
            {me.name} · {myRank?.score ?? me.score} {t('pts', '分')}
            {myRank?.highlight ? ` · ${translateGameText(myRank.highlight, lang)}` : ''}
          </p>
        </div>

        {isRoomHost ? (
          <div className="w-full max-w-md space-y-2.5">
            <div className="text-xs font-bold text-[#FFB800]">
              {t('TV Highlighted:', '大屏当前选中：')}{' '}
              <span className="text-white">{resultsOptionLabel}</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => sendRemote('left')}
                aria-label={t('Remote Left', '遥控器左')}
                className="tactile-btn h-12 w-14 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => sendRemote('ok')}
                className="tactile-btn h-12 px-8 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-black text-base shadow-[0_4px_0_#B82E17] cursor-pointer"
              >
                OK · {resultsOptionLabel}
              </button>
              <button
                type="button"
                onClick={() => sendRemote('right')}
                aria-label={t('Remote Right', '遥控器右')}
                className="tactile-btn h-12 w-14 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
            {otherConnectedHumans.length > 0 && (
              <button
                type="button"
                onClick={() => setPassHostOpen(true)}
                className="h-9 px-4 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#FFB800]/40 text-xs font-bold text-[#FFB800] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Crown className="w-3.5 h-3.5 text-[#FFB800]" />
                {t('Pass Host', '移交房主')}
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#9CA3AF]">
            {t('Waiting for', '等待')}{' '}
            <strong className="text-white">{hostPlayer?.name ?? t('the Host', '房主')}</strong>
            {t("'s remote to play again or switch games.", ' 遥控选择再来一局或切换游戏。')}
          </p>
        )}
      </div>
    );
  }

  // =====================================================================
  // STATE 4C: PAUSED SCREEN ON PHONE (Host Remote Controls!)
  // =====================================================================
  if (room.status === 'PAUSED') {
    const pauseLabels = [
      t('Resume Match', '继续比赛'),
      t('Restart', '重新开始'),
      t('Switch Game', '切换游戏'),
    ];
    const activePauseLabel = pauseLabels[room.remoteFocus.modalIndex] ?? pauseLabels[0];

    return renderConnectedShell(
      <div className="relative flex flex-col items-center justify-center h-full text-center px-4 gap-3">
        {passHostOverlay}
        {!embedded && (
          <div className="absolute top-1 right-1">
            <LanguageToggle compact />
          </div>
        )}
        <Pause className="w-10 h-10 text-[#FFB800]" />
        <h2 className="font-display text-2xl font-extrabold text-white">
          {t('Game Paused', '游戏已暂停')}
        </h2>
        {isRoomHost ? (
          <div className="w-full max-w-md space-y-2.5">
            <div className="text-xs font-bold text-[#FFB800]">
              {t('TV Highlighted:', '大屏当前选中：')}{' '}
              <span className="text-white">{activePauseLabel}</span>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => sendRemote('left')}
                aria-label={t('Remote Left', '遥控器左')}
                className="tactile-btn h-12 w-14 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={() => sendRemote('ok')}
                className="tactile-btn h-12 px-7 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-black text-base shadow-[0_4px_0_#B82E17] cursor-pointer"
              >
                OK · {activePauseLabel}
              </button>
              <button
                type="button"
                onClick={() => sendRemote('right')}
                aria-label={t('Remote Right', '遥控器右')}
                className="tactile-btn h-12 w-14 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-[#9CA3AF]">
            {t('Paused · Waiting for', '已暂停 · 等待')}{' '}
            <strong className="text-white">{hostPlayer?.name ?? t('the Host', '房主')}</strong>
          </p>
        )}
      </div>
    );
  }

  // =====================================================================
  // STATE 4B: INTERACTIVE RULES BRIEFING ON PHONE (NO COUNTDOWN — TAP READY!)
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
            <span className="text-xs text-[#9CA3AF] truncate">· {t('How to Play', '玩法说明')}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!embedded && <LanguageToggle compact />}
            <span className="font-mono text-xs font-bold text-[#10D98B] shrink-0 tabular-nums">
              {readyHumans.length}/{connectedHumans.length} {t('Ready', '已准备')}
            </span>
          </div>
        </div>

        <div
          className={`flex-1 grid ${
            embedded ? 'grid-cols-1 gap-2.5 my-2' : 'grid-cols-2 gap-4 my-2 items-center'
          }`}
        >
          <div className="p-3.5 rounded-xl bg-[#1A1E26] border border-[#2A303D] space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[#00C2FF]">
              {t('How to Win', '获胜方式')}
            </div>
            <p className="text-sm font-bold text-white leading-snug">{gameMeta.tagline}</p>
            <div className="pt-1.5 border-t border-[#262C38] space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Joystick', '摇杆')}</span>
                <span className="font-bold text-white">{schema.joystickLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Button A', 'A 键')}</span>
                <span className="font-bold" style={{ color: schema.actionA.colorHex }}>
                  {schema.actionA.label} · {schema.actionA.sublabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#9CA3AF]">{t('Button B', 'B 键')}</span>
                <span className="font-bold" style={{ color: schema.actionB.colorHex }}>
                  {schema.actionB.label} · {schema.actionB.sublabel}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 justify-center">
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
              className="relative tactile-btn w-full h-18 rounded-2xl font-display font-extrabold text-lg cursor-pointer transition-colors flex items-center justify-center gap-2 select-none"
              style={
                me.ready
                  ? {
                      backgroundColor: '#10D98B',
                      color: '#0A1913',
                      boxShadow: '0 4px 0 #0A915D',
                    }
                  : {
                      backgroundColor: '#FF4D2E',
                      color: '#FFFFFF',
                      boxShadow: '0 4px 0 #B82E17',
                    }
              }
            >
              <IosHapticSwitch enabled={!embedded && hapticsEnabled} />
              {me.ready && <Check className="w-6 h-6" />}
              <span>
                {me.ready ? t('Ready! Waiting for Others', '已准备！等待其他玩家') : t("I'm Ready!", '我准备好了！')}
              </span>
            </label>

            <p className="text-[11px] text-center text-[#A5AEBD] leading-snug">
              {me.ready
                ? t(
                    `Waiting for ${unreadyHumans.map((p) => p.name).join(', ') || 'everyone'}...`,
                    `等待 ${unreadyHumans.map((p) => p.name).join('、') || '全员'} 准备...`
                  )
                : t(
                    'Read the rules at your own pace — game starts once everyone taps Ready!',
                    '慢慢看规则 — 所有人点击「我准备好了」后即刻开始！'
                  )}
            </p>
          </div>
        </div>

        {isRoomHost ? (
          <div className="flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={() => wsRef.current?.send({ type: 'game:return-lobby' })}
              className="h-8 px-3 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[11px] font-bold text-[#D1D5DB] cursor-pointer"
            >
              {t('Back to Game Room', '返回游戏厅')}
            </button>
            <span className="text-[11px] text-[#9CA3AF] truncate hidden sm:inline">
              {t('Starts automatically when all tap Ready', '全员准备后自动开始')}
            </span>
            <button
              type="button"
              onClick={() => wsRef.current?.send({ type: 'game:dismiss-briefing' })}
              className="h-8 px-3 rounded-lg bg-[#FFB800] hover:bg-[#FFC933] text-[11px] font-extrabold text-[#14120B] cursor-pointer"
            >
              {t('Host Start Now', '房主直接开始')}
            </button>
          </div>
        ) : (
          <div className="text-center text-[11px] text-[#9CA3AF] shrink-0">
            {t(
              'Your gamepad opens automatically as soon as everyone is Ready!',
              '全员准备后手柄将自动切换为游戏模式！'
            )}
          </div>
        )}
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
      className="flex flex-col justify-between h-full w-full max-w-6xl mx-auto transition-transform duration-75"
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
              {translateGameText(me.statText, lang)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-semibold text-[#9CA3AF]">{gameMeta.name}</span>
          {!embedded && <LanguageToggle compact />}
          {isRoomHost && room.status === 'PLAYING' && (
            <button
              type="button"
              onClick={() => wsRef.current?.send({ type: 'game:pause', paused: true })}
              aria-label={t('Pause game', '暂停游戏')}
              title={t('Pause Game (Host)', '暂停游戏（房主）')}
              className="min-h-[34px] px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#FFB800] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('Pause', '暂停')}</span>
            </button>
          )}
          {!wsConnected && (
            <span className="text-[11px] font-semibold text-[#FFB800]">
              {t('Reconnecting...', '正在重连...')}
            </span>
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
              aria-label={hapticsEnabled ? t('Disable haptics', '关闭震动') : t('Enable haptics', '开启震动')}
              title={hapticsEnabled ? t('Haptics On', '震动已开启') : t('Haptics Off', '震动已关闭')}
              className={`min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center cursor-pointer ${
                hapticsEnabled
                  ? 'bg-[#1E232D] hover:bg-[#242A36] text-[#10D98B]'
                  : 'bg-[#1E232D] hover:bg-[#242A36] text-[#6B7280]'
              }`}
            >
              <Vibrate className="w-4 h-4" />
            </button>
          )}
          {!embedded && (
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')}
              className="min-h-[34px] min-w-[34px] rounded-lg bg-[#1E232D] hover:bg-[#242A36] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          )}
          <button
            type="button"
            onClick={handleLeave}
            aria-label={t('Leave room', '退出房间')}
            className="min-h-[34px] min-w-[34px] rounded-lg bg-[#1E232D] hover:bg-[#242A36] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Tactile Gamepad Deck: Joystick Anchored Left, Stacked Up-Down A/B Anchored Right */}
      <div className="flex-1 grid grid-cols-2 items-center gap-2 min-h-0">
        {/* Left Half: Generous Touch Zone with Joystick Positioned Comfortably Left */}
        <div
          onPointerDown={onStickPointerDown}
          onPointerMove={onStickPointerMove}
          onPointerUp={releaseStick}
          onPointerCancel={releaseStick}
          onLostPointerCapture={releaseStick}
          onContextMenu={(e) => e.preventDefault()}
          className={`h-full flex flex-col justify-center touch-none select-none cursor-grab active:cursor-grabbing ${
            embedded ? 'items-center' : 'items-start pl-3 sm:pl-10'
          }`}
        >
          <div className="flex flex-col items-center pointer-events-none">
            <div
              ref={stickZoneRef}
              className={`relative rounded-full bg-[#101217] border-2 flex items-center justify-center ${
                embedded ? 'w-32 h-32' : 'w-40 h-40 sm:w-44 sm:h-44'
              }`}
              style={{
                borderColor: stickActive ? me.color.hex : '#2A303D',
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
                  embedded ? 'w-14 h-14' : 'w-[74px] h-[74px] sm:w-20 sm:h-20'
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

            <span className="mt-1.5 text-[11px] font-semibold text-[#8B95A7] tracking-wide">
              {schema.joystickLabel}
            </span>
          </div>
        </div>

        {/* Right Half: Vertical Up-Down Action Buttons (A Above B) Anchored Right */}
        <div
          onContextMenu={(e) => e.preventDefault()}
          className={`h-full flex items-center touch-none select-none ${
            embedded ? 'justify-center' : 'justify-end pr-3 sm:pr-10'
          }`}
        >
          <div className={`flex flex-col items-center justify-center ${embedded ? 'gap-2.5' : 'gap-2.5 sm:gap-3.5'}`}>
            {/* Primary Action A (Top) */}
            <div className="flex flex-col items-center">
              <label
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onActionDown('a', e)}
                onPointerUp={(e) => onActionUp('a', e)}
                onPointerCancel={(e) => onActionUp('a', e)}
                onLostPointerCapture={(e) => onActionUp('a', e)}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative rounded-full flex flex-col items-center justify-center font-display font-extrabold touch-none select-none cursor-pointer ${
                  embedded ? 'w-[74px] h-[74px] text-xs' : 'w-[92px] h-[92px] sm:w-[106px] sm:h-[106px] text-sm sm:text-base'
                }`}
                style={{
                  backgroundColor: schema.actionA.colorHex,
                  color: schema.actionA.textColor,
                  transform: pressedA ? 'translateY(4px) scale(0.96)' : 'translateY(0)',
                  boxShadow: pressedA
                    ? `0 2px 0 ${schema.actionA.darkHex}`
                    : `0 6px 0 ${schema.actionA.darkHex}, 0 10px 20px rgba(0,0,0,0.48)`,
                  opacity: cdA > 0.05 && room.selectedGameId !== 'turbo-drift' ? 0.72 : 1,
                }}
              >
                <IosHapticSwitch enabled={!embedded && hapticsEnabled} />
                <ActionIcon icon={schema.actionA.icon} className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 pointer-events-none" />
                <span className="pointer-events-none leading-none">{schema.actionA.label}</span>
                {room.selectedGameId === 'turbo-drift' ? (
                  <span className="text-[10px] font-mono opacity-90 tabular-nums pointer-events-none mt-0.5">
                    {Math.round((1 - cdA) * 100)}%
                  </span>
                ) : cdA > 0.05 ? (
                  <span className="text-[10px] font-mono opacity-90 tabular-nums pointer-events-none mt-0.5">
                    {Math.round((1 - cdA) * 100)}%
                  </span>
                ) : null}
              </label>
              <span className="mt-1 text-[10px] sm:text-[11px] font-medium text-[#8B95A7] leading-none">
                {schema.actionA.sublabel}
              </span>
            </div>

            {/* Secondary Action B (Bottom) */}
            <div className="flex flex-col items-center">
              <label
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onActionDown('b', e)}
                onPointerUp={(e) => onActionUp('b', e)}
                onPointerCancel={(e) => onActionUp('b', e)}
                onLostPointerCapture={(e) => onActionUp('b', e)}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative rounded-full flex flex-col items-center justify-center font-display font-extrabold touch-none select-none cursor-pointer ${
                  embedded ? 'w-[66px] h-[66px] text-[11px]' : 'w-[80px] h-[80px] sm:w-[92px] sm:h-[92px] text-xs sm:text-sm'
                }`}
                style={{
                  backgroundColor: schema.actionB.colorHex,
                  color: schema.actionB.textColor,
                  transform: pressedB ? 'translateY(4px) scale(0.96)' : 'translateY(0)',
                  boxShadow: pressedB
                    ? `0 2px 0 ${schema.actionB.darkHex}`
                    : `0 5px 0 ${schema.actionB.darkHex}, 0 9px 18px rgba(0,0,0,0.45)`,
                  opacity: cdB > 0.05 ? 0.65 : 1,
                }}
              >
                <IosHapticSwitch enabled={!embedded && hapticsEnabled} />
                <ActionIcon icon={schema.actionB.icon} className="w-4 h-4 sm:w-5 sm:h-5 mb-0.5 pointer-events-none" />
                <span className="pointer-events-none leading-none">{schema.actionB.label}</span>
                {cdB > 0.05 && (
                  <span className="text-[10px] font-mono opacity-90 tabular-nums pointer-events-none mt-0.5">
                    {Math.round((1 - cdB) * 100)}%
                  </span>
                )}
              </label>
              <span className="mt-1 text-[10px] sm:text-[11px] font-medium text-[#8B95A7] leading-none">
                {schema.actionB.sublabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Bottom Helper Strip */}
      <div className="text-center text-[11px] text-[#6B7280] shrink-0">
        {room.status === 'COUNTDOWN'
          ? t(`Match starting in ${room.countdownValue}...`, `比赛即将在 ${room.countdownValue} 秒后开始...`)
          : !me.alive
          ? t(
              'Knocked out — watch the monitor for next round or respawn',
              '已被淘汰 — 请观看大屏等待复活或下一回合'
            )
          : keyboardProfile === 'wasd'
          ? t('Keys: W A S D · Space (A) · Left Shift (B)', '按键：W A S D · 空格 (A) · 左 Shift (B)')
          : keyboardProfile === 'arrows'
          ? t('Keys: Arrows · Enter (A) · Right Shift (B)', '按键：方向键 · 回车 (A) · 右 Shift (B)')
          : schema.controlTip}
      </div>
    </div>
  );
}
