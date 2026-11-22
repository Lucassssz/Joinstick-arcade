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
  Dices,
  Flame,
  Footprints,
  Gauge,
  LogOut,
  Maximize2,
  Minimize2,
  Move,
  Paintbrush,
  Pause,
  Power,
  RefreshCw,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Target,
  Trophy,
  Vibrate,
  Waves,
  WifiOff,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import {
  clampControllerPrefs,
  ControllerPrefs,
  ControllerSettingsOverlay,
  DEFAULT_CONTROLLER_PREFS,
  loadControllerPrefs,
  saveControllerPrefs,
} from './ControllerSettingsOverlay';
import {
  filterGamesByPlayerMode,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import { getMutatorSpec } from '../shared/modifiers';
import { CardControllerDeck } from './CardControllerDeck';
import {
  ActionButtonSpec,
  CardClientAction,
  CardPrivateState,
  ControllerInput,
  PLAYER_PALETTE,
  RemoteDirection,
  RoomSnapshot,
  ServerMessage,
} from '../shared/types';
import { ManagedWebSocket } from '../lib/ws';
import {
  controllerHaptics,
  HapticEventType,
  HapticIntensity,
  HapticMode,
  HapticResult,
} from '../lib/haptics';
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
  return controllerHaptics.trigger(pattern, {
    ...options,
    force: options?.force ?? true,
  });
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
  const [hapticMode, setHapticMode] = useState<HapticMode>(() => controllerHaptics.getMode());
  const [impactPulse, setImpactPulse] = useState<'none' | 'subtle' | 'light' | 'heavy'>('none');
  const [tactileCue, setTactileCue] = useState<{ label: string; event: HapticEventType } | null>(
    null
  );
  const [passHostOpen, setPassHostOpen] = useState(false);
  const [closeRoomConfirmOpen, setCloseRoomConfirmOpen] = useState(false);
  const [hostToast, setHostToast] = useState<string | null>(null);
  const [controllerPrefs, setControllerPrefs] = useState<ControllerPrefs>(() => loadControllerPrefs());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [repositionMode, setRepositionMode] = useState(false);
  const [cardState, setCardState] = useState<CardPrivateState | null>(null);
  const [manualReconnecting, setManualReconnecting] = useState(false);
  const [floatingOriginOffset, setFloatingOriginOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const impactTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tactileCueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDisconnectedRef = useRef<boolean>(false);
  const prevIsHostRef = useRef<boolean>(false);
  const prevCardDangerRef = useRef<boolean>(false);
  const hostToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReconnectTapRef = useRef<number>(0);
  const controllerPrefsRef = useRef<ControllerPrefs>(controllerPrefs);
  const userExitedPhoneFsRef = useRef<boolean>(false);
  const stickAtRimRef = useRef<boolean>(false);
  const lastRimHapticAtRef = useRef<number>(0);
  const dragTargetRef = useRef<{
    target: 'stick' | 'buttons';
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

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
  const roomRef = useRef<RoomSnapshot | null>(room);
  const joinedPlayerIdRef = useRef<string | null>(joinedPlayerId);
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
    roomRef.current = room;
  }, [room]);
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
  useEffect(() => {
    controllerPrefsRef.current = controllerPrefs;
  }, [controllerPrefs]);

  const updateControllerPrefs = (next: ControllerPrefs) => {
    const clamped = clampControllerPrefs(next);
    controllerPrefsRef.current = clamped;
    setControllerPrefs(clamped);
    saveControllerPrefs(clamped);
  };

  const handleSetHapticMode = (nextMode: HapticMode) => {
    controllerHaptics.setMode(nextMode);
    setHapticMode(nextMode);
    const labelText =
      nextMode === 'forceful'
        ? t('Haptic Intensity: Forceful', '震动强度：强力 (Forceful)')
        : nextMode === 'default'
        ? t('Haptic Intensity: Default', '震动强度：标准 (Default)')
        : t('Haptic Intensity: Off', '震动强度：已关闭 (Off)');
    setTactileCue({
      label: labelText,
      event: nextMode === 'forceful' ? 'turn-start' : 'host-alert',
    });
    if (tactileCueTimerRef.current) clearTimeout(tactileCueTimerRef.current);
    tactileCueTimerRef.current = setTimeout(() => setTactileCue(null), 1650);

    if (!embedded && nextMode !== 'off') {
      controllerHaptics.unlock(true);
      vibrate(nextMode === 'forceful' ? [120, 42, 180] : [42, 28, 60], {
        fromUserGesture: true,
        intensity: nextMode === 'forceful' ? 'heavy' : 'medium',
        force: true,
      });
    }
  };

  const handleCycleHapticMode = () => {
    const next: HapticMode =
      hapticMode === 'default' ? 'forceful' : hapticMode === 'forceful' ? 'off' : 'default';
    handleSetHapticMode(next);
  };

  const renderHapticModeButton = (compact = false) => {
    if (embedded) return null;
    const modeLabel =
      hapticMode === 'forceful'
        ? t('Forceful', '强力')
        : hapticMode === 'default'
        ? t('Default', '标准')
        : t('Off', '关');
    const colorClass =
      hapticMode === 'forceful'
        ? 'bg-[#10D98B]/20 border-[#10D98B]/70 text-[#10D98B]'
        : hapticMode === 'default'
        ? 'bg-[#00C2FF]/15 border-[#00C2FF]/60 text-[#00C2FF]'
        : 'bg-[#1E232D] border-[#2F3747] text-[#6B7280]';
    return (
      <label
        role="button"
        tabIndex={0}
        onClick={handleCycleHapticMode}
        aria-label={`${t('Haptic Intensity', '震动强度')}: ${modeLabel}`}
        title={`${t('Haptic Intensity (Tap to switch Default / Forceful / Off)', '震动强度（点击切换 标准 / 强力 / 关闭）')}: ${modeLabel}`}
        className={`relative ${
          compact ? 'min-h-[34px] px-2' : 'h-8 sm:h-9 px-2.5'
        } rounded-lg border text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer select-none transition-colors ${colorClass}`}
      >
        <IosHapticSwitch enabled={hapticMode !== 'off'} />
        <Vibrate className="w-3.5 h-3.5 shrink-0" />
        <span className="font-mono text-[10px] font-extrabold">{modeLabel}</span>
      </label>
    );
  };

  const handleResetControllerPrefs = () => {
    updateControllerPrefs(DEFAULT_CONTROLLER_PREFS);
    if (!embedded) {
      controllerHaptics.unlock();
      vibrate(35, { fromUserGesture: true, intensity: 'light', force: true });
    }
  };

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
      const doc = document as Document & { webkitFullscreenElement?: Element };
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
        msRequestFullscreen?: () => Promise<void> | void;
      };
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        if (typeof el.requestFullscreen === 'function') {
          el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {});
        } else if (typeof el.webkitRequestFullscreen === 'function') {
          el.webkitRequestFullscreen();
        } else if (typeof el.msRequestFullscreen === 'function') {
          el.msRequestFullscreen();
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
      userExitedPhoneFsRef.current = true;
      if (typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen();
      }
    } else {
      userExitedPhoneFsRef.current = false;
      enterFullscreenAndLandscape();
    }
  };

  // Automatically force Fullscreen on the phone browser on mount and on the first touch gesture
  useEffect(() => {
    if (embedded) return;
    enterFullscreenAndLandscape();
    const onGesture = () => {
      if (userExitedPhoneFsRef.current) return;
      const doc = document as Document & { webkitFullscreenElement?: Element };
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        enterFullscreenAndLandscape();
      }
    };
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('pointerdown', onGesture, opts);
    window.addEventListener('touchend', onGesture, opts);
    window.addEventListener('click', onGesture, opts);
    return () => {
      window.removeEventListener('pointerdown', onGesture, opts);
      window.removeEventListener('touchend', onGesture, opts);
      window.removeEventListener('click', onGesture, opts);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedded]);

  const sessionKey = useMemo(
    () => (embedded ? `joinstick_sim_${defaultName || 'p1'}` : 'joinstick_player_id'),
    [embedded, defaultName]
  );
  const roomCodeSessionKey = `${sessionKey}_room`;

  const ensureWakeLock = () => {
    if (embedded || wakeLockRef.current || typeof navigator === 'undefined') return;
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

  // Persistent playerId & roomCode for instant reconnects
  const storedPlayerIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!embedded) {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved) storedPlayerIdRef.current = saved;
      const savedRoom = sessionStorage.getItem(roomCodeSessionKey);
      if (savedRoom && savedRoom.length === 4 && !roomCodeRef.current) {
        roomCodeRef.current = savedRoom;
        setRoomCode(savedRoom);
      }
    }
  }, [embedded, sessionKey, roomCodeSessionKey]);

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
    setFloatingOriginOffset({ x: 0, y: 0 });
    setPressedA(false);
    setPressedB(false);
    sendCurrentInput(true);
  };

  useEffect(() => {
    resetControlsState();
    setPassHostOpen(false);
    setCloseRoomConfirmOpen(false);
    setRepositionMode(false);
    if (room?.status !== 'PLAYING' && room?.status !== 'COUNTDOWN') {
      setCardState(null);
    }
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

  // Subscribe to global haptic service to synchronize visual tactile edge pulse & host event cues
  useEffect(() => {
    if (embedded) return;
    const CUE_EVENTS = new Set<HapticEventType>([
      'turn-start',
      'action-required',
      'timer-warning',
      'host-alert',
      'round-transition',
      'chaos-wheel',
      'frenzy-alert',
    ]);
    return controllerHaptics.subscribe((notif) => {
      setImpactPulse(notif.visualPulse);
      if (impactTimerRef.current) clearTimeout(impactTimerRef.current);
      const duration =
        notif.visualPulse === 'heavy' ? 180 : notif.visualPulse === 'light' ? 120 : 90;
      impactTimerRef.current = setTimeout(() => setImpactPulse('none'), duration);

      const cueText = notif.customLabel || (lang === 'zh' ? notif.labelZh : notif.labelEn);
      if (cueText && CUE_EVENTS.has(notif.event)) {
        setTactileCue({ label: cueText, event: notif.event });
        if (tactileCueTimerRef.current) clearTimeout(tactileCueTimerRef.current);
        tactileCueTimerRef.current = setTimeout(() => setTactileCue(null), 1550);
      }
    });
  }, [embedded, lang]);

  // Notify the player if they inherit Host Remote Control mid-session
  useEffect(() => {
    const isHostNow = Boolean(room && joinedPlayerId && room.hostPlayerId === joinedPlayerId);
    const wasHost = prevIsHostRef.current;
    prevIsHostRef.current = isHostNow;

    if (!wasHost && isHostNow && room && room.status !== 'SETUP') {
      if (!embedded) {
        controllerHaptics.triggerEvent('host-alert', [28, 24, 38], {
          fromUserGesture: false,
        });
      }
      setHostToast(
        lang === 'zh'
          ? '你已成为新房主！现在由你使用遥控器控制大屏。'
          : 'You are now the Room Host! Use this remote to control the TV.'
      );
      if (hostToastTimerRef.current) clearTimeout(hostToastTimerRef.current);
      hostToastTimerRef.current = setTimeout(() => setHostToast(null), 4200);
    }
  }, [room?.hostPlayerId, room?.status, joinedPlayerId, lang, embedded]);

  // Keep container/session warm during long controller play sessions
  useEffect(() => {
    if (embedded || !joinedPlayerId) return;
    const id = window.setInterval(() => {
      fetch('/api/health', { cache: 'no-store' }).catch(() => {});
    }, 4 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [embedded, joinedPlayerId]);

  // Safety net: if WebSocket is open while server snapshot still marks us disconnected, re-send room:join
  useEffect(() => {
    if (!wsConnected || !joinedPlayerId || !room) return;
    const self = room.players.find((p) => p.id === joinedPlayerId);
    if (!self || self.connected) {
      setManualReconnecting(false);
      return;
    }
    const timer = window.setInterval(() => {
      const codeNow = (roomRef.current?.code || roomCodeRef.current || '').trim().toUpperCase();
      if (wsRef.current?.isConnected() && storedPlayerIdRef.current && codeNow.length === 4) {
        wsRef.current.send({
          type: 'room:join',
          code: codeNow,
          name: playerNameRef.current.trim() || 'Player',
          playerId: storedPlayerIdRef.current,
          preferredColorId: preferredColorRef.current,
        });
      }
    }, 1_400);
    return () => window.clearInterval(timer);
  }, [wsConnected, joinedPlayerId, room]);

  // Manage WebSocket connection
  useEffect(() => {
    const socket = new ManagedWebSocket({
      onOpen: () => {
        setWsConnected(true);
        const savedRoom = !embedded ? sessionStorage.getItem(roomCodeSessionKey) || '' : '';
        const codeNow = (roomRef.current?.code || roomCodeRef.current || savedRoom).trim().toUpperCase();
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
      onStatusChange: (status) => {
        setWsConnected(status === 'connected');
      },
      onMessage: (msg: ServerMessage) => {
        switch (msg.type) {
          case 'room:joined':
            storedPlayerIdRef.current = msg.playerId;
            joinedPlayerIdRef.current = msg.playerId;
            roomRef.current = msg.room;
            roomCodeRef.current = msg.room.code;
            setRoomCode(msg.room.code);
            if (!embedded) {
              sessionStorage.setItem(sessionKey, msg.playerId);
              sessionStorage.setItem(roomCodeSessionKey, msg.room.code);
              if (!userExitedPhoneFsRef.current) {
                enterFullscreenAndLandscape();
              }
              controllerHaptics.triggerEvent('player-ready', [85, 35, 115], {
                fromUserGesture: false,
              });
            }
            if (manualReconnectTimerRef.current) {
              clearTimeout(manualReconnectTimerRef.current);
              manualReconnectTimerRef.current = null;
            }
            setManualReconnecting(false);
            setJoinedPlayerId(msg.playerId);
            setRoom(msg.room);
            setCardState(null);
            setErrorMsg(null);
            setClosedReason(null);
            break;
          case 'room:snapshot':
            roomRef.current = msg.room;
            setRoom(msg.room);
            break;
          case 'player:card-state':
            setCardState(msg.cardState);
            break;
          case 'player:haptic':
            if (!embedded) {
              controllerHaptics.triggerEvent(
                msg.event || msg.reason || 'impact-medium',
                msg.pattern,
                {
                  fromUserGesture: false,
                  intensity: msg.intensity,
                  label: msg.label,
                }
              );
            }
            break;
          case 'room:closed':
            storedPlayerIdRef.current = undefined;
            joinedPlayerIdRef.current = null;
            roomRef.current = null;
            if (!embedded) {
              sessionStorage.removeItem(sessionKey);
              sessionStorage.removeItem(roomCodeSessionKey);
            }
            setManualReconnecting(false);
            setClosedReason(msg.reason);
            setRoom(null);
            setCardState(null);
            setJoinedPlayerId(null);
            break;
          case 'error':
            setManualReconnecting(false);
            if (msg.code === 'ROOM_NOT_FOUND' && joinedPlayerIdRef.current) {
              storedPlayerIdRef.current = undefined;
              joinedPlayerIdRef.current = null;
              roomRef.current = null;
              if (!embedded) {
                sessionStorage.removeItem(sessionKey);
                sessionStorage.removeItem(roomCodeSessionKey);
              }
              setJoinedPlayerId(null);
              setRoom(null);
              setCardState(null);
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
      if (manualReconnectTimerRef.current) clearTimeout(manualReconnectTimerRef.current);
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
    const now = Date.now();
    if (now - lastReconnectTapRef.current < 280) return;
    lastReconnectTapRef.current = now;
    wsRef.current?.send({ type: 'player:leave' });
    storedPlayerIdRef.current = undefined;
    joinedPlayerIdRef.current = null;
    roomRef.current = null;
    if (!embedded) {
      sessionStorage.removeItem(sessionKey);
      sessionStorage.removeItem(roomCodeSessionKey);
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
    setCardState(null);
    if (onExit) onExit();
  };

  const me = room?.players.find((p) => p.id === joinedPlayerId) ?? null;
  const gameMeta = room ? getLocalizedGameMeta(getGameMeta(room.selectedGameId), lang) : null;
  const isCardGame = Boolean(
    room && (room.selectedGameId === 'color-clash' || room.selectedGameId === 'liars-deck')
  );
  const isCardRedWarning = Boolean(
    isCardGame &&
      room?.status === 'PLAYING' &&
      cardState?.isActionRequired &&
      cardState.turnTimeLeft > 0 &&
      cardState.turnTimeLeft <= 5.0
  );

  useEffect(() => {
    if (isCardRedWarning && !prevCardDangerRef.current && !embedded) {
      controllerHaptics.triggerEvent('timer-warning', [38, 28, 38], {
        fromUserGesture: false,
        label: lang === 'zh' ? '⏱ 回合即将超时！' : '⏱ 5s Left on Turn!',
      });
    }
    prevCardDangerRef.current = isCardRedWarning;
  }, [isCardRedWarning, embedded, lang]);

  const sendCardAction = (action: CardClientAction) => {
    if (!embedded) {
      controllerHaptics.unlock();
      vibrate(32, { fromUserGesture: true, intensity: 'light' });
    }
    wsRef.current?.send({ type: 'card:action', action });
  };

  // --- Multi-touch Analog Joystick Pointer Handlers (Rotation-Aware + Calibrated!) ---
  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const activePrefs = controllerPrefsRef.current;
    const maxStickRadius = embedded ? 38 : activePrefs.stickRadius;
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
    const deadzone = embedded ? 0.08 : activePrefs.deadzone;
    const adjMag = normMag < deadzone ? 0 : (normMag - deadzone) / (1 - deadzone);

    // Physical rim-detent haptic feedback when slamming the joystick against the outer gate
    if (!embedded) {
      if (normMag >= 0.94 && !stickAtRimRef.current) {
        stickAtRimRef.current = true;
        const now = Date.now();
        if (now - lastRimHapticAtRef.current > 140) {
          lastRimHapticAtRef.current = now;
          vibrate(65, { fromUserGesture: true, intensity: 'light' });
        }
      } else if (normMag < 0.78) {
        stickAtRimRef.current = false;
      }
    }

    inputRef.current.dx = Math.cos(angle) * adjMag;
    inputRef.current.dy = Math.sin(angle) * adjMag;
    setKnobOffset({ x: ox, y: oy });
    sendCurrentInput(true);
  };

  const onStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (repositionMode || settingsOpen) return;
    if (stickPointerId.current !== null && stickPointerId.current !== e.pointerId) return;
    // Do NOT call e.preventDefault() here — `.gamepad-surface` uses CSS `touch-action: none`,
    // and keeping pointerdown non-cancelled allows Android Chrome & iOS Safari to grant sticky
    // User Activation for hardware vibration and audio unlock!
    if (!embedded) {
      ensureWakeLock();
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
      const baseCx = rect.left + rect.width / 2;
      const baseCy = rect.top + rect.height / 2;
      if (!embedded && controllerPrefsRef.current.floatingStick) {
        const dxScreen = e.clientX - baseCx;
        const dyScreen = e.clientY - baseCy;
        const localDx = isCssRotatedRef.current ? dyScreen : dxScreen;
        const localDy = isCssRotatedRef.current ? -dxScreen : dyScreen;
        const clampedOx = Math.max(-44, Math.min(84, localDx));
        const clampedOy = Math.max(-44, Math.min(44, localDy));
        setFloatingOriginOffset({ x: clampedOx, y: clampedOy });
        const screenDx = isCssRotatedRef.current ? -clampedOy : clampedOx;
        const screenDy = isCssRotatedRef.current ? clampedOx : clampedOy;
        stickCenterRef.current = { x: baseCx + screenDx, y: baseCy + screenDy };
      } else {
        setFloatingOriginOffset({ x: 0, y: 0 });
        stickCenterRef.current = { x: baseCx, y: baseCy };
      }
    } else {
      stickCenterRef.current = { x: e.clientX, y: e.clientY };
    }
    setStickActive(true);
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const onStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (repositionMode || settingsOpen) return;
    if (stickPointerId.current !== e.pointerId) return;
    updateStickFromPointer(e.clientX, e.clientY);
  };

  const releaseStick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    stickPointerId.current = null;
    setStickActive(false);
    setKnobOffset({ x: 0, y: 0 });
    setFloatingOriginOffset({ x: 0, y: 0 });
    inputRef.current.dx = 0;
    inputRef.current.dy = 0;
    sendCurrentInput(true);
  };

  // --- Direct Drag-to-Reposition Calibration Handlers ---
  const startRepositionDrag = (
    target: 'stick' | 'buttons',
    e: React.PointerEvent<HTMLElement>
  ) => {
    if (!repositionMode) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    const cur = controllerPrefsRef.current;
    dragTargetRef.current = {
      target,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: target === 'stick' ? cur.stickOffsetX : cur.buttonsOffsetX,
      origY: target === 'stick' ? cur.stickOffsetY : cur.buttonsOffsetY,
    };
  };

  const moveRepositionDrag = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragTargetRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();
    const dxScreen = e.clientX - drag.startX;
    const dyScreen = e.clientY - drag.startY;
    const localDx = isCssRotatedRef.current ? dyScreen : dxScreen;
    const localDy = isCssRotatedRef.current ? -dxScreen : dyScreen;
    const cur = controllerPrefsRef.current;
    if (drag.target === 'stick') {
      updateControllerPrefs({
        ...cur,
        stickOffsetX: drag.origX + localDx,
        stickOffsetY: drag.origY + localDy,
      });
    } else {
      updateControllerPrefs({
        ...cur,
        buttonsOffsetX: drag.origX + localDx,
        buttonsOffsetY: drag.origY + localDy,
      });
    }
  };

  const endRepositionDrag = (e: React.PointerEvent<HTMLElement>) => {
    if (dragTargetRef.current?.pointerId === e.pointerId) {
      dragTargetRef.current = null;
    }
  };

  // --- Multi-touch Action Button Handlers ---
  const onActionDown = (which: 'a' | 'b', e: React.PointerEvent<HTMLElement>) => {
    if (repositionMode || settingsOpen) return;
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
      ensureWakeLock();
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
    const now = Date.now();
    // Prevent duplicate firing when pointerUp + synthesized click both fire on mobile
    if (now - lastReconnectTapRef.current < 280) return;
    lastReconnectTapRef.current = now;

    setErrorMsg(null);
    setManualReconnecting(true);
    if (manualReconnectTimerRef.current) clearTimeout(manualReconnectTimerRef.current);
    manualReconnectTimerRef.current = setTimeout(() => {
      setManualReconnecting(false);
    }, 1_800);

    if (!embedded) {
      ensureWakeLock();
      controllerHaptics.unlock();
      vibrate(45, { fromUserGesture: true, intensity: 'light', force: true });
      fetch('/api/health', { cache: 'no-store' }).catch(() => {});
    }

    const ws = wsRef.current;
    if (!ws) return;

    const savedRoom = !embedded ? sessionStorage.getItem(roomCodeSessionKey) || '' : '';
    const codeNow = (roomRef.current?.code || roomCodeRef.current || savedRoom).trim().toUpperCase();

    if (ws.isConnected() && codeNow.length === 4 && storedPlayerIdRef.current) {
      // Socket is already open — immediately re-attach the player without dropping TCP first!
      ws.send({
        type: 'room:join',
        code: codeNow,
        name: playerNameRef.current.trim() || 'Player',
        playerId: storedPlayerIdRef.current,
        preferredColorId: preferredColorRef.current,
      });
      // If server doesn't confirm re-join within 900ms, force a clean WebSocket reset
      window.setTimeout(() => {
        const selfNow = roomRef.current?.players.find((p) => p.id === joinedPlayerIdRef.current);
        if (!selfNow || !selfNow.connected) {
          wsRef.current?.reconnectNow(true);
        }
      }, 900);
      return;
    }

    ws.reconnectNow(true);
  };

  // Wrapper that renders full-screen & landscape-rotated on connected phones
  const renderConnectedShell = (children: ReactNode) => {
    const selfPlayer = room?.players.find((p) => p.id === joinedPlayerId) ?? null;
    const isConnectionLost = Boolean(
      joinedPlayerId && room && (!wsConnected || (selfPlayer && !selfPlayer.connected))
    );

    const statusOverlays = (
      <>
        {!embedded && impactPulse !== 'none' && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[63] rounded-none transition-opacity duration-75"
            style={{
              boxShadow:
                impactPulse === 'heavy'
                  ? `inset 0 0 0 4px #FF4D2E, inset 0 0 44px rgba(255, 77, 46, 0.75)`
                  : impactPulse === 'light'
                  ? `inset 0 0 0 3px ${selfPlayer?.color.hex ?? '#00C2FF'}, inset 0 0 28px ${selfPlayer?.color.hex ?? '#00C2FF'}88`
                  : `inset 0 0 0 2px ${selfPlayer?.color.hex ?? '#00C2FF'}99, inset 0 0 18px ${selfPlayer?.color.hex ?? '#00C2FF'}55`,
            }}
          />
        )}

        {hostToast && !isConnectionLost && (
          <div className="pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-[65] px-4 py-2 rounded-xl bg-[#FFB800] text-[#14120B] font-display font-extrabold text-xs sm:text-sm shadow-xl inline-flex items-center gap-1.5 whitespace-nowrap">
            <Crown className="w-4 h-4 shrink-0" />
            <span>{hostToast}</span>
          </div>
        )}

        {!hostToast && !isConnectionLost && tactileCue && (
          <div
            className={`pointer-events-none absolute top-2.5 left-1/2 -translate-x-1/2 z-[64] px-3.5 py-1.5 rounded-xl font-display font-extrabold text-[11px] sm:text-xs shadow-lg inline-flex items-center gap-1.5 whitespace-nowrap border backdrop-blur-md transition-opacity ${
              tactileCue.event === 'turn-start' || tactileCue.event === 'action-required'
                ? 'bg-[#10D98B]/95 border-[#A7F3D0] text-[#071A12]'
                : tactileCue.event === 'timer-warning' || tactileCue.event === 'frenzy-alert'
                ? 'bg-[#FF4D2E]/95 border-[#FFB4A6] text-white'
                : 'bg-[#1A1E26]/95 border-[#00C2FF]/60 text-[#F4F6FA]'
            }`}
          >
            <Vibrate className="w-3.5 h-3.5 shrink-0 animate-pulse" />
            <span>{translateGameText(tactileCue.label, lang)}</span>
          </div>
        )}

        {isConnectionLost && (
          <div
            role="alert"
            aria-live="assertive"
            style={{ touchAction: 'manipulation' }}
            className="pointer-events-auto absolute inset-0 z-[80] bg-[#0B0D12]/92 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div
              style={{ touchAction: 'manipulation' }}
              className="max-w-sm w-full rounded-2xl bg-[#1A1E26] border-2 border-[#FF4D2E] p-5 text-center shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#FF4D2E]/20 border border-[#FF4D2E]/50 text-[#FF4D2E] flex items-center justify-center mx-auto animate-pulse">
                <WifiOff className="w-6 h-6" />
              </div>
              <h3 className="mt-3 font-display text-xl font-extrabold text-white">
                {t('Controller Disconnected!', '手柄连接已断开！')}
              </h3>
              <p className="mt-1.5 text-xs text-[#D1D5DB] leading-relaxed">
                {manualReconnecting
                  ? t(
                      'Establishing fresh link to the game room...',
                      '正在快速建立新连接并恢复您的座位...'
                    )
                  : t(
                      'Signal dropped — your button taps are paused while we reconnect.',
                      '网络信号中断 — 正在自动重连，重连前按键暂不生效。'
                    )}
              </p>
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <button
                  type="button"
                  style={{ touchAction: 'manipulation' }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    handleManualReconnect();
                  }}
                  onClick={handleManualReconnect}
                  className="tactile-btn pointer-events-auto w-full sm:w-auto h-11 px-5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] active:scale-95 text-white font-display font-extrabold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    {manualReconnecting
                      ? t('Reconnecting...', '正在重连...')
                      : t('Reconnect Now', '立即重连')}
                  </span>
                </button>
                <button
                  type="button"
                  style={{ touchAction: 'manipulation' }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    handleLeave();
                  }}
                  onClick={handleLeave}
                  className="pointer-events-auto h-11 px-4 rounded-xl bg-[#242A36] hover:bg-[#2E3646] active:scale-95 text-xs font-bold text-[#D1D5DB] inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('Leave Room', '退出房间')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
        <ControllerSettingsOverlay
          open={settingsOpen && !embedded}
          prefs={controllerPrefs}
          onChange={updateControllerPrefs}
          onReset={handleResetControllerPrefs}
          onEnterDragMode={
            room && (room.status === 'PLAYING' || room.status === 'COUNTDOWN')
              ? () => {
                  resetControlsState();
                  setSettingsOpen(false);
                  setRepositionMode(true);
                }
              : undefined
          }
          onClose={() => setSettingsOpen(false)}
          hapticMode={hapticMode}
          onHapticModeChange={handleSetHapticMode}
          accentHex={selfPlayer?.color.hex ?? '#00C2FF'}
          actionALabel={gameMeta?.controllerSchema.actionA.label ?? 'A'}
          actionBLabel={gameMeta?.controllerSchema.actionB.label ?? 'B'}
          actionAHex={gameMeta?.controllerSchema.actionA.colorHex ?? '#FF4D2E'}
          actionBHex={gameMeta?.controllerSchema.actionB.colorHex ?? '#00C2FF'}
        />
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
                  style={{ touchAction: 'manipulation' }}
                  onPointerUp={handleManualReconnect}
                  onClick={handleManualReconnect}
                  className="px-2.5 py-1 rounded-lg bg-[#FFB800] text-[#14120B] font-bold shrink-0 cursor-pointer active:scale-95"
                >
                  {manualReconnecting ? t('Retrying...', '重试中...') : t('Retry', '重试')}
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

  const handleConfirmCloseRoom = () => {
    if (!isRoomHost) return;
    if (!embedded) {
      controllerHaptics.unlock();
      vibrate([65, 35, 95], { fromUserGesture: true, intensity: 'heavy', force: true });
    }
    setCloseRoomConfirmOpen(false);
    wsRef.current?.send({ type: 'room:close' });
  };

  const activeMutatorSpec = getMutatorSpec(room.activeMutator);
  const activeTournament = room.tournament?.active ? room.tournament : null;

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
    const mutatorLabel =
      room.activeMutator === 'normal'
        ? t('Spin Chaos Wheel', '转动混沌轮盘')
        : `${t('Chaos Wheel:', '混沌轮盘:')} ${lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}`;
    const actionLabels = [
      t(`Open ${gameMeta.name}`, `进入 ${gameMeta.name}`),
      t('Start 5-Game Tournament', '开启 5 局锦标赛'),
      mutatorLabel,
      t(`Change ${gameMeta.settingLabel}`, `切换 ${gameMeta.settingLabel}`),
      t('+ Add Robot', '+ 添加机器人'),
      t(`Bot Level: ${diffLabel}`, `机器人难度：${diffLabel}`),
      t('Room Setup / QR', '房间设置 / 扫码'),
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

  const closeRoomOverlay = closeRoomConfirmOpen && isRoomHost && (
    <div className="absolute inset-0 z-50 bg-[#121419]/95 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center">
      <div className="max-w-sm w-full rounded-2xl bg-[#1A1E26] border-2 border-[#FF4D2E]/60 p-5 shadow-2xl space-y-3">
        <div className="w-11 h-11 rounded-2xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 text-[#FF4D2E] flex items-center justify-center mx-auto">
          <Power className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-display text-lg font-extrabold text-white">
            {t('Close Entire Game Room?', '确定彻底关闭游戏房间？')}
          </h3>
          <p className="mt-1 text-xs text-[#A5AEBD] leading-relaxed">
            {t(
              `This will permanently close Room ${room.code} on the TV and disconnect all players.`,
              `大屏上的房间 ${room.code} 将立即永久关闭，所有玩家都会断开连接。`
            )}
          </p>
        </div>
        <div className="pt-1 flex items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={() => setCloseRoomConfirmOpen(false)}
            className="h-10 px-4 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-white cursor-pointer flex-1"
          >
            {t('Cancel', '取消')}
          </button>
          <button
            type="button"
            onClick={handleConfirmCloseRoom}
            className="tactile-btn h-10 px-4 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-xs font-extrabold text-white shadow-[0_3px_0_#B82E17] inline-flex items-center justify-center gap-1.5 cursor-pointer flex-1"
          >
            <Power className="w-3.5 h-3.5" />
            <span>{t('Close Room', '关闭房间')}</span>
          </button>
        </div>
      </div>
    </div>
  );

  // =====================================================================
  // STATE 3A: ROOM SETUP SCREEN (Waiting for players / bots / host setup)
  // =====================================================================
  if (room.status === 'SETUP') {
    return renderConnectedShell(
      <div className="relative flex flex-col justify-between h-full w-full max-w-3xl mx-auto">
        {closeRoomOverlay}
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
            {renderHapticModeButton(false)}
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
            {isRoomHost && (
              <button
                type="button"
                onClick={() => setCloseRoomConfirmOpen(true)}
                aria-label={t('Close Entire Room', '关闭整个房间')}
                title={t('Close Entire Room', '关闭整个房间')}
                className="h-9 w-9 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <Power className="w-4 h-4" />
              </button>
            )}
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
          {closeRoomOverlay}

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
              {renderHapticModeButton(true)}
              {!embedded && (
                <button
                  type="button"
                  onClick={() => {
                    resetControlsState();
                    setSettingsOpen(true);
                  }}
                  aria-label={t('Controller settings', '手柄设置')}
                  title={t('Joystick & Button Calibration', '摇杆与按键位置校准')}
                  className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#00C2FF] flex items-center justify-center cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
              )}
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
              <button
                type="button"
                onClick={() => setCloseRoomConfirmOpen(true)}
                aria-label={t('Close Entire Room', '关闭整个房间')}
                title={t('Close Entire Room', '关闭整个房间')}
                className="h-8 w-8 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <Power className="w-3.5 h-3.5" />
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
                <div className="mt-2 pt-2 border-t border-[#262C38] flex items-center justify-between text-xs gap-2">
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
                {room.activeMutator !== 'normal' && (
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className="text-[#9CA3AF] inline-flex items-center gap-1">
                      <Dices className="w-3 h-3" style={{ color: activeMutatorSpec.accentHex }} />
                      {t('Active Rule', '当前规则')}
                    </span>
                    <span className="font-bold" style={{ color: activeMutatorSpec.accentHex }}>
                      {lang === 'zh' ? activeMutatorSpec.nameZh : activeMutatorSpec.name}
                    </span>
                  </div>
                )}
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
                <IosHapticSwitch enabled={!embedded && hapticMode !== 'off'} />
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
                  <span>{t('Pass Host', '移交房主')}</span>
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
            {renderHapticModeButton(false)}
            {!embedded && (
              <button
                type="button"
                onClick={() => {
                  resetControlsState();
                  setSettingsOpen(true);
                }}
                aria-label={t('Controller settings', '手柄设置')}
                title={t('Joystick & Button Calibration', '摇杆与按键位置校准')}
                className="h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#00C2FF] flex items-center justify-center cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}
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
              {room.activeMutator !== 'normal' && (
                <div className="flex items-center justify-between">
                  <span className="text-[#9CA3AF] inline-flex items-center gap-1">
                    <Dices className="w-3 h-3" style={{ color: activeMutatorSpec.accentHex }} />
                    {t('Chaos Rule', '混沌规则')}
                  </span>
                  <span className="font-bold" style={{ color: activeMutatorSpec.accentHex }}>
                    {lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}
                  </span>
                </div>
              )}
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
              <IosHapticSwitch enabled={!embedded && hapticMode !== 'off'} />
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
  // STATE 4: RESULTS SUMMARY ON PHONE (With Host Remote & Tournament Marks!)
  // =====================================================================
  if (room.status === 'RESULTS') {
    const myRank = room.rankings.find((r) => r.playerId === me.id);
    const myStanding = activeTournament?.standings.find((s) => s.playerId === me.id) ?? null;

    const resultsOptionLabel = activeTournament
      ? room.remoteFocus.modalIndex === 0
        ? activeTournament.completed
          ? t('New Tournament', '再来一届锦标赛')
          : t(
              `Next (${activeTournament.currentGameIndex + 2}/${activeTournament.totalGames})`,
              `下一局 (${activeTournament.currentGameIndex + 2}/${activeTournament.totalGames})`
            )
        : t('Game Room', '返回游戏厅')
      : room.remoteFocus.modalIndex === 0
      ? t('Play Again', '再来一局')
      : t('Game Room', '返回游戏厅');

    return renderConnectedShell(
      <div className="relative flex flex-col items-center justify-center h-full text-center px-4 gap-2.5">
        {passHostOverlay}
        {closeRoomOverlay}
        <div className="absolute top-1 right-1 flex items-center gap-1.5">
          {!embedded && <LanguageToggle compact />}
          {isRoomHost && (
            <button
              type="button"
              onClick={() => setCloseRoomConfirmOpen(true)}
              aria-label={t('Close Entire Room', '关闭整个房间')}
              title={t('Close Entire Room', '关闭整个房间')}
              className="h-8 w-8 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {activeTournament && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFB800]/18 border border-[#FFB800]/50 text-[#FFB800] font-mono text-[11px] font-black">
            <Trophy className="w-3.5 h-3.5" />
            <span>
              {activeTournament.completed
                ? t('5-GAME TOURNAMENT FINAL', '5局锦标赛总决赛')
                : t(
                    `TOURNAMENT ${activeTournament.currentGameIndex + 1}/${activeTournament.totalGames}`,
                    `锦标赛 第 ${activeTournament.currentGameIndex + 1}/${activeTournament.totalGames} 局`
                  )}
            </span>
          </div>
        )}
        <div
          className="w-13 h-13 rounded-2xl flex items-center justify-center font-display text-2xl font-extrabold"
          style={{ backgroundColor: me.color.hex, color: me.color.textOnColor }}
        >
          #{activeTournament?.completed && myStanding ? myStanding.rank : myRank?.rank ?? '-'}
        </div>
        <div>
          <h2 className="font-display text-2xl font-extrabold">
            {activeTournament?.completed
              ? myStanding?.rank === 1
                ? t('Grand Champion!', '荣耀夺冠！')
                : t('Tournament Complete', '锦标赛结束')
              : myRank?.rank === 1
              ? t('Victory!', '胜利！')
              : t('Match Complete', '本局结束')}
          </h2>
          <p className="text-sm text-[#A5AEBD] mt-0.5">
            {me.name} · {myRank?.score ?? me.score} {t('pts', '分')}
            {myRank?.highlight ? ` · ${translateGameText(myRank.highlight, lang)}` : ''}
          </p>
          {myStanding && (
            <div className="mt-1.5 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#1A1E26] border border-[#2F3747] text-xs font-mono">
              <span className="text-[#10D98B] font-extrabold">
                +{myStanding.lastGameMarks} {t('Marks', '积分')}
              </span>
              <span className="text-[#6B7280]">·</span>
              <span className="text-[#FFB800] font-black">
                {t('Total', '累计')}: {myStanding.totalMarks} (#{myStanding.rank})
              </span>
            </div>
          )}
        </div>

        {isRoomHost ? (
          <div className="w-full max-w-md space-y-2">
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
                className="tactile-btn h-12 px-7 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-black text-base shadow-[0_4px_0_#B82E17] cursor-pointer"
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
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => setPassHostOpen(true)}
                  className="h-9 px-4 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#FFB800]/40 text-xs font-bold text-[#FFB800] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Crown className="w-3.5 h-3.5 text-[#FFB800]" />
                  {t('Pass Host', '移交房主')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#9CA3AF]">
            {t('Waiting for', '等待')}{' '}
            <strong className="text-white">{hostPlayer?.name ?? t('the Host', '房主')}</strong>
            {activeTournament
              ? t("'s remote for next tournament game.", ' 遥控进入下一局锦标赛。')
              : t("'s remote to play again or switch games.", ' 遥控选择再来一局或切换游戏。')}
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
        {closeRoomOverlay}
        <div className="absolute top-1 right-1 flex items-center gap-1.5">
          {!embedded && <LanguageToggle compact />}
          {isRoomHost && (
            <button
              type="button"
              onClick={() => setCloseRoomConfirmOpen(true)}
              aria-label={t('Close Entire Room', '关闭整个房间')}
              title={t('Close Entire Room', '关闭整个房间')}
              className="h-8 w-8 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
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
            {activeTournament && (
              <span className="px-1.5 py-0.5 rounded bg-[#FFB800]/20 text-[#FFB800] font-mono text-[10px] font-black shrink-0">
                🏆 {activeTournament.currentGameIndex + 1}/{activeTournament.totalGames}
              </span>
            )}
            <span className="font-display font-bold text-base text-white truncate">
              {gameMeta.name}
            </span>
            <span className="text-xs text-[#9CA3AF] truncate hidden sm:inline">
              · {t('How to Play', '玩法说明')}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!embedded && <LanguageToggle compact />}
            {renderHapticModeButton(true)}
            {!embedded && (
              <button
                type="button"
                onClick={() => {
                  resetControlsState();
                  setSettingsOpen(true);
                }}
                aria-label={t('Controller settings', '手柄设置')}
                title={t('Joystick & Button Calibration', '摇杆与按键位置校准')}
                className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#00C2FF] flex items-center justify-center cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
              </button>
            )}
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#00C2FF]">
                {t('How to Win', '获胜方式')}
              </span>
              {room.activeMutator !== 'normal' && (
                <span
                  className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-[#101217]"
                  style={{ color: activeMutatorSpec.accentHex }}
                >
                  {lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}
                </span>
              )}
            </div>
            <p className="text-sm font-bold text-white leading-snug">{gameMeta.tagline}</p>
            {activeMutatorSpec.invertControls && (
              <p className="text-[11px] font-extrabold text-[#FF3B9A] leading-tight">
                ⚠ {t('Mirror Curse active: Joystick directions are flipped!', '镜像反转生效中：本局摇杆方向上下左右反转！')}
              </p>
            )}
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
              <IosHapticSwitch enabled={!embedded && hapticMode !== 'off'} />
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

  const firstAction: 'a' | 'b' = !embedded && controllerPrefs.swapAB ? 'b' : 'a';
  const secondAction: 'a' | 'b' = firstAction === 'a' ? 'b' : 'a';

  const renderActionButton = (which: 'a' | 'b', extraClass = '') => {
    const isA = which === 'a';
    const spec = isA ? schema.actionA : schema.actionB;
    const pressed = isA ? pressedA : pressedB;
    const cd = isA ? cdA : cdB;
    const sizeClass = embedded
      ? isA
        ? 'w-[74px] h-[74px] text-xs'
        : 'w-[66px] h-[66px] text-[11px]'
      : isA
      ? 'w-[92px] h-[92px] sm:w-[106px] sm:h-[106px] text-sm sm:text-base'
      : 'w-[80px] h-[80px] sm:w-[92px] sm:h-[92px] text-xs sm:text-sm';

    const showCharge = isA
      ? room.selectedGameId === 'turbo-drift' || cd > 0.05
      : cd > 0.05;

    return (
      <div key={which} className={`flex flex-col items-center ${extraClass}`}>
        <label
          role="button"
          tabIndex={0}
          onPointerDown={(e) => onActionDown(which, e)}
          onPointerUp={(e) => onActionUp(which, e)}
          onPointerCancel={(e) => onActionUp(which, e)}
          onLostPointerCapture={(e) => onActionUp(which, e)}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative rounded-full flex flex-col items-center justify-center font-display font-extrabold touch-none select-none cursor-pointer ${sizeClass}`}
          style={{
            backgroundColor: spec.colorHex,
            color: spec.textColor,
            transform: pressed ? 'translateY(4px) scale(0.96)' : 'translateY(0)',
            boxShadow: pressed
              ? `0 2px 0 ${spec.darkHex}`
              : `0 ${isA ? 6 : 5}px 0 ${spec.darkHex}, 0 ${isA ? 10 : 9}px 18px rgba(0,0,0,0.46)`,
            opacity: isA
              ? cd > 0.05 && room.selectedGameId !== 'turbo-drift'
                ? 0.72
                : 1
              : cd > 0.05
              ? 0.65
              : 1,
          }}
        >
          <IosHapticSwitch enabled={!embedded && !repositionMode && hapticMode !== 'off'} />
          <ActionIcon
            icon={spec.icon}
            className={`${isA ? 'w-5 h-5 sm:w-6 sm:h-6' : 'w-4 h-4 sm:w-5 sm:h-5'} mb-0.5 pointer-events-none`}
          />
          <span className="pointer-events-none leading-none">{spec.label}</span>
          {showCharge && (
            <span className="text-[10px] font-mono opacity-90 tabular-nums pointer-events-none mt-0.5">
              {Math.round((1 - cd) * 100)}%
            </span>
          )}
        </label>
        <span className="mt-1 text-[10px] sm:text-[11px] font-medium text-[#8B95A7] leading-none">
          {spec.sublabel}
        </span>
      </div>
    );
  };

  return renderConnectedShell(
    <div
      className={`relative flex flex-col justify-between h-full w-full max-w-6xl mx-auto transition-transform duration-75 ${
        isCardRedWarning ? 'p-1.5' : ''
      }`}
      style={{
        transform:
          impactPulse === 'heavy'
            ? 'translate3d(4px, -2px, 0) scale(0.992)'
            : impactPulse === 'light'
            ? 'translate3d(1.5px, 0, 0)'
            : 'translate3d(0, 0, 0)',
        boxShadow: isCardRedWarning
          ? 'inset 0 0 0 4px #FF3B30, inset 0 0 38px rgba(255, 59, 48, 0.72), 0 0 22px rgba(255, 59, 48, 0.55)'
          : impactPulse === 'heavy'
          ? 'inset 0 0 0 3px rgba(255, 77, 46, 0.75)'
          : impactPulse === 'light'
          ? `inset 0 0 0 2px ${me.color.hex}`
          : impactPulse === 'subtle'
          ? `inset 0 0 0 1.5px ${me.color.hex}99`
          : 'none',
        borderRadius: '14px',
      }}
    >
      {isCardRedWarning && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[14px] border-4 border-[#FF3B30] shadow-[inset_0_0_44px_rgba(255,59,48,0.82)] animate-pulse z-20"
        />
      )}
      {/* Compact Top Status Bar OR Live Drag-Reposition Toolbar */}
      {repositionMode && !embedded && !isCardGame ? (
        <div className="flex items-center justify-between gap-2 h-10 shrink-0 px-2 rounded-xl bg-[#1A1E26] border border-[#00C2FF]/60 z-30">
          <div className="flex items-center gap-2 min-w-0">
            <Move className="w-4 h-4 text-[#00C2FF] shrink-0" />
            <span className="text-xs font-bold text-white truncate">
              {t(
                'Drag the joystick or A/B buttons to fit your thumbs',
                '直接拖动摇杆或 A/B 按键到最顺手的位置'
              )}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleResetControllerPrefs}
              className="h-7 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[11px] font-bold text-[#D1D5DB] inline-flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{t('Reset', '重置')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRepositionMode(false);
                setSettingsOpen(true);
              }}
              className="h-7 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[11px] font-bold text-[#00C2FF] inline-flex items-center gap-1 cursor-pointer"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>{t('Sliders', '详细设置')}</span>
            </button>
            <button
              type="button"
              onClick={() => setRepositionMode(false)}
              className="h-7 px-3 rounded-lg bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913] text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{t('Done', '完成')}</span>
            </button>
          </div>
        </div>
      ) : (
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

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {room.frenzy.active && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FF4D2E]/25 border border-[#FF4D2E] text-[#FF9B8A] font-mono text-[10px] font-black animate-pulse">
                <Flame className="w-3 h-3 text-[#FFB800]" />
                <span>{t('2× FRENZY', '2× 狂热')}</span>
              </span>
            )}
            {activeMutatorSpec.invertControls && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FF3B9A]/20 border border-[#FF3B9A]/70 text-[#FF8DC7] font-mono text-[10px] font-black">
                {t('MIRROR', '反转')}
              </span>
            )}
            {activeTournament && (
              <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FFB800]/18 text-[#FFB800] font-mono text-[10px] font-black">
                🏆 {activeTournament.currentGameIndex + 1}/{activeTournament.totalGames}
              </span>
            )}
            <span className="text-[11px] font-semibold text-[#9CA3AF] hidden md:inline">
              {gameMeta.name}
            </span>
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
            {renderHapticModeButton(true)}
            {!embedded && !isCardGame && (
              <button
                type="button"
                onClick={() => {
                  resetControlsState();
                  setSettingsOpen(true);
                }}
                aria-label={t('Controller settings & calibration', '手柄位置与按键校准')}
                title={t('Calibrate Joystick & Buttons', '校准摇杆与按键位置')}
                className="min-h-[34px] min-w-[34px] rounded-lg bg-[#1E232D] hover:bg-[#242A36] text-[#00C2FF] flex items-center justify-center cursor-pointer"
              >
                <SlidersHorizontal className="w-4 h-4" />
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
      )}

      {isCardGame ? (
        <CardControllerDeck
          cardState={cardState}
          playerColorHex={me.color.hex}
          embedded={embedded}
          isCountdown={room.status === 'COUNTDOWN'}
          countdownValue={room.countdownValue}
          onAction={sendCardAction}
        />
      ) : (
        /* Main Tactile Gamepad Deck: Joystick Anchored Left, Customizable Up-Down/Angled/Horizontal A/B Anchored Right */
        <div className="flex-1 grid grid-cols-2 items-center gap-2 min-h-0">
          {/* Left Half: Generous Touch Zone with Calibrated Virtual Joystick */}
          <div
            onPointerDown={onStickPointerDown}
            onPointerMove={onStickPointerMove}
            onPointerUp={releaseStick}
            onPointerCancel={releaseStick}
            onLostPointerCapture={releaseStick}
            onContextMenu={(e) => e.preventDefault()}
            className={`h-full flex flex-col justify-center touch-none select-none ${
              repositionMode ? '' : 'cursor-grab active:cursor-grabbing'
            } ${embedded ? 'items-center' : 'items-start pl-3 sm:pl-10'}`}
          >
            <div
              onPointerDown={(e) => startRepositionDrag('stick', e)}
              onPointerMove={moveRepositionDrag}
              onPointerUp={endRepositionDrag}
              onPointerCancel={endRepositionDrag}
              onLostPointerCapture={endRepositionDrag}
              className={`relative flex flex-col items-center ${
                repositionMode
                  ? 'pointer-events-auto cursor-move rounded-3xl p-2 border-2 border-dashed border-[#00C2FF] bg-[#00C2FF]/10'
                  : 'pointer-events-none'
              }`}
              style={{
                transform: `translate3d(${(embedded ? 0 : controllerPrefs.stickOffsetX) + floatingOriginOffset.x}px, ${(embedded ? 0 : controllerPrefs.stickOffsetY) + floatingOriginOffset.y}px, 0) scale(${embedded ? 1 : controllerPrefs.stickScale})`,
              }}
            >
              {repositionMode && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#00C2FF] text-[#0B1219] font-mono text-[9px] font-black uppercase tracking-wider whitespace-nowrap shadow">
                  {t('Drag Stick', '拖动摇杆')}
                </span>
              )}
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

          {/* Right Half: Calibrated Action Buttons A & B */}
          <div
            onContextMenu={(e) => e.preventDefault()}
            className={`h-full flex items-center touch-none select-none ${
              embedded ? 'justify-center' : 'justify-end pr-3 sm:pr-10'
            }`}
          >
            <div
              onPointerDown={(e) => startRepositionDrag('buttons', e)}
              onPointerMove={moveRepositionDrag}
              onPointerUp={endRepositionDrag}
              onPointerCancel={endRepositionDrag}
              onLostPointerCapture={endRepositionDrag}
              className={`relative flex items-center justify-center ${
                !embedded && controllerPrefs.buttonLayout === 'horizontal' ? 'flex-row' : 'flex-col'
              } ${
                repositionMode
                  ? 'cursor-move rounded-3xl p-2.5 border-2 border-dashed border-[#FF4D2E] bg-[#FF4D2E]/10'
                  : ''
              }`}
              style={{
                gap: embedded ? '10px' : `${controllerPrefs.buttonGap}px`,
                transform: `translate3d(${embedded ? 0 : controllerPrefs.buttonsOffsetX}px, ${embedded ? 0 : controllerPrefs.buttonsOffsetY}px, 0) scale(${embedded ? 1 : controllerPrefs.buttonsScale})`,
              }}
            >
              {repositionMode && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#FF4D2E] text-white font-mono text-[9px] font-black uppercase tracking-wider whitespace-nowrap shadow">
                  {t('Drag Buttons', '拖动按键')}
                </span>
              )}
              {renderActionButton(
                firstAction,
                !embedded && controllerPrefs.buttonLayout === 'angled'
                  ? '-translate-x-3.5'
                  : !embedded && controllerPrefs.buttonLayout === 'horizontal'
                  ? 'mt-3'
                  : ''
              )}
              {renderActionButton(
                secondAction,
                !embedded && controllerPrefs.buttonLayout === 'angled'
                  ? 'translate-x-3.5'
                  : !embedded && controllerPrefs.buttonLayout === 'horizontal'
                  ? '-mt-3'
                  : ''
              )}
            </div>
          </div>
        </div>
      )}

      {/* Subtle Bottom Helper Strip */}
      <div className="text-center text-[11px] text-[#6B7280] shrink-0">
        {room.status === 'COUNTDOWN'
          ? t(`Match starting in ${room.countdownValue}...`, `比赛即将在 ${room.countdownValue} 秒后开始...`)
          : isCardGame
          ? keyboardProfile === 'wasd'
            ? t('Tap cards above or use A/D · Space (A) · Left Shift (B)', '点击上方手牌或使用 A/D · 空格 (A) · 左 Shift (B)')
            : keyboardProfile === 'arrows'
            ? t('Tap cards above or use Arrows · Enter (A) · Right Shift (B)', '点击上方手牌或使用方向键 · 回车 (A) · 右 Shift (B)')
            : t('Secret hand · 15s turn clock · Auto-passes on timeout', '私密手牌 · 每回合限时 15 秒 · 超时自动过牌')
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
