import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Copy,
  Crown,
  ExternalLink,
  Gamepad2,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  filterGamesByPlayerMode,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BotDifficulty,
  GameId,
  GameSnapshot,
  MAX_PLAYERS_PER_ROOM,
  RoomSnapshot,
  ServerMessage,
} from '../shared/types';
import { arcadeAudio } from '../lib/audio';
import { getJoinUrl, ManagedWebSocket } from '../lib/ws';
import {
  getLocalizedDifficulty,
  getLocalizedFilterLabel,
  getLocalizedGameMeta,
  LanguageToggle,
  translateGameText,
  translateServerMessage,
  useLanguage,
} from '../lib/i18n';
import { createRenderFxState, renderGameSnapshot } from '../games/renderers';
import { TestControllerDrawer } from './TestControllerDrawer';

interface HostMonitorProps {
  initialGameId?: GameId;
  onExit: () => void;
}

interface FloatingEmote {
  id: string;
  playerName: string;
  colorHex: string;
  emoji: string;
  xPercent: number;
}

const HOST_SESSION_KEY = 'joinstick_host_session';

const DIFFICULTY_OPTIONS: { id: BotDifficulty; color: string }[] = [
  { id: 'chill', color: '#10D98B' },
  { id: 'arcade', color: '#00C2FF' },
  { id: 'spicy', color: '#FF4D2E' },
];

const NEXT_DIFFICULTY: Record<BotDifficulty, BotDifficulty> = {
  chill: 'arcade',
  arcade: 'spicy',
  spicy: 'chill',
};

function difficultyColor(d?: BotDifficulty): string {
  if (d === 'chill') return '#10D98B';
  if (d === 'spicy') return '#FF4D2E';
  return '#00C2FF';
}

export function HostMonitor({ initialGameId = 'bumper-brawl', onExit }: HostMonitorProps) {
  const { lang, t } = useLanguage();
  const langRef = useRef(lang);
  langRef.current = lang;
  const [wsConnected, setWsConnected] = useState(false);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testDrawerOpen, setTestDrawerOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([]);
  const [isMonitorFullscreen, setIsMonitorFullscreen] = useState(false);
  const [bannerToast, setBannerToast] = useState<string | null>(null);

  const wsRef = useRef<ManagedWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestSnapshotRef = useRef<GameSnapshot | null>(null);
  const fxRef = useRef(createRenderFxState());
  const prevStatusRef = useRef<string | null>(null);
  const prevHostIdRef = useRef<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedGameBtnRef = useRef<HTMLButtonElement | null>(null);

  // Manage Host WebSocket Connection
  useEffect(() => {
    const socket = new ManagedWebSocket({
      onOpen: () => {
        setWsConnected(true);
        const savedRaw = sessionStorage.getItem(HOST_SESSION_KEY);
        if (savedRaw) {
          try {
            const saved = JSON.parse(savedRaw) as { code: string; hostToken: string };
            if (saved.code && saved.hostToken) {
              socket.send({
                type: 'room:host-reattach',
                code: saved.code,
                hostToken: saved.hostToken,
              });
              return;
            }
          } catch {
            // Fall through to create new room
          }
        }
        socket.send({ type: 'room:create', preferredGameId: initialGameId });
      },
      onClose: () => {
        setWsConnected(false);
      },
      onMessage: (msg: ServerMessage) => {
        switch (msg.type) {
          case 'room:created':
            sessionStorage.setItem(
              HOST_SESSION_KEY,
              JSON.stringify({ code: msg.code, hostToken: msg.hostToken })
            );
            setRoom(msg.room);
            setErrorMsg(null);
            break;
          case 'room:snapshot':
            setRoom(msg.room);
            setErrorMsg(null);
            break;
          case 'room:emote': {
            const emoteItem: FloatingEmote = {
              id: msg.id,
              playerName: msg.playerName,
              colorHex: msg.colorHex,
              emoji: msg.emoji,
              xPercent: 14 + Math.random() * 72,
            };
            setFloatingEmotes((prev) => [...prev.slice(-14), emoteItem]);
            window.setTimeout(() => {
              setFloatingEmotes((prev) => prev.filter((item) => item.id !== emoteItem.id));
            }, 2400);
            break;
          }
          case 'game:tick':
            if (msg.snapshot) {
              latestSnapshotRef.current = msg.snapshot;
            }
            if (msg.sounds && msg.sounds.length > 0) {
              for (const s of msg.sounds) {
                arcadeAudio.play(s);
                if (s.type === 'ko' || s.type === 'pulse') {
                  fxRef.current.shake = Math.max(fxRef.current.shake, 9);
                } else if (s.type === 'bump') {
                  fxRef.current.shake = Math.max(fxRef.current.shake, 4 * (s.intensity ?? 0.5));
                }
              }
            }
            break;
          case 'error':
            if (msg.code === 'ROOM_NOT_FOUND') {
              sessionStorage.removeItem(HOST_SESSION_KEY);
              socket.send({ type: 'room:create', preferredGameId: initialGameId });
            } else {
              setErrorMsg(msg.message);
            }
            break;
        }
      },
    });
    wsRef.current = socket;

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [initialGameId]);

  // Keep free-tier HTTP hosts (e.g., Render's 15-min idle timer) awake only while a Host screen is open
  useEffect(() => {
    const ping = () => {
      fetch('/api/health', { cache: 'no-store' }).catch(() => {
        // Ignore transient network errors; WebSocket reconnect handles recovery
      });
    };
    const intervalId = window.setInterval(ping, 4 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  // Generate QR code whenever room code or language changes
  useEffect(() => {
    if (!room?.code) return;
    const url = getJoinUrl(room.code, lang);
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#121419', light: '#FFFFFF' },
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => setQrDataUrl(''));
  }, [room?.code, lang]);

  // 60fps Canvas Render Loop when in active match / briefing / countdown / paused / results
  useEffect(() => {
    if (!room || room.status === 'SETUP' || room.status === 'LOBBY') return;
    let rafId = 0;

    const renderLoop = () => {
      const canvas = canvasRef.current;
      const snap = latestSnapshotRef.current;
      if (canvas && snap) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          renderGameSnapshot(ctx, snap, fxRef.current, langRef.current);
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [room?.status]);

  // Track native Fullscreen state on the Monitor
  useEffect(() => {
    const onFsChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsMonitorFullscreen(Boolean(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  const enterMonitorFullscreen = () => {
    if (typeof document === 'undefined') return;
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
      // Browser may require a direct monitor gesture; edge-to-edge TV fullscreen layout is still active
    }
  };

  const toggleMonitorFullscreen = () => {
    if (typeof document === 'undefined') return;
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
      enterMonitorFullscreen();
    }
  };

  const showBannerToast = (text: string) => {
    setBannerToast(text);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setBannerToast(null), 3200);
  };

  // Automatically enter Fullscreen whenever entering the Game Room (SETUP -> LOBBY)
  useEffect(() => {
    if (!room) return;
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = room.status;
    if (prevStatus === 'SETUP' && room.status === 'LOBBY') {
      enterMonitorFullscreen();
    }
  }, [room?.status]);

  // Announce whenever the Host transfers control to another player
  useEffect(() => {
    if (!room) return;
    const prevHost = prevHostIdRef.current;
    prevHostIdRef.current = room.hostPlayerId;
    if (prevHost && room.hostPlayerId && prevHost !== room.hostPlayerId && room.status !== 'SETUP') {
      const nextHost = room.players.find((p) => p.id === room.hostPlayerId);
      if (nextHost) {
        showBannerToast(
          lang === 'zh'
            ? `房主遥控权限已移交给 ${nextHost.name}！现在由 TA 的手机遥控大屏。`
            : `Host control passed to ${nextHost.name}! Their phone is now the TV Remote.`
        );
      }
    }
  }, [room?.hostPlayerId, room?.status, room?.players, lang]);

  // Smoothly keep the TV-focused game card visible inside the Game Room shelf
  useEffect(() => {
    if (room?.status === 'LOBBY' && room.remoteFocus.zone === 'games') {
      focusedGameBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [room?.status, room?.remoteFocus.zone, room?.remoteFocus.index, room?.lobbyFilter]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    arcadeAudio.setMuted(next);
  };

  const handleCopyJoinLink = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(getJoinUrl(room.code, lang));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleAddBot = () => {
    arcadeAudio.unlock();
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:add-bot', difficulty: room?.botDifficulty });
  };

  const handleRemoveBot = (botId: string) => {
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:remove-bot', botId });
  };

  const handleSetBotDifficulty = (difficulty: BotDifficulty, botId?: string) => {
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:set-bot-difficulty', difficulty, botId });
  };

  const handleSetHostPlayer = (playerId: string) => {
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:set-host-player', playerId });
  };

  const handleEnterGameRoom = () => {
    arcadeAudio.unlock();
    setErrorMsg(null);
    enterMonitorFullscreen();
    wsRef.current?.send({ type: 'room:enter-game-room' });
  };

  const handleReturnSetup = () => {
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:return-setup' });
  };

  const handleStartMatch = () => {
    arcadeAudio.unlock();
    setErrorMsg(null);
    fxRef.current = createRenderFxState();
    wsRef.current?.send({ type: 'game:start' });
  };

  const handleSelectGame = (gameId: GameId, settingValue?: number) => {
    arcadeAudio.unlock();
    setErrorMsg(null);
    wsRef.current?.send({ type: 'game:select', gameId, settingValue });
  };

  const handleLeaveHost = () => {
    sessionStorage.removeItem(HOST_SESSION_KEY);
    onExit();
  };

  if (!room) {
    return (
      <div className="min-h-screen bg-[#121419] text-[#F4F6FA] flex flex-col items-center justify-center p-6">
        <div className="font-display text-2xl font-bold">
          {t('Creating Game Room...', '正在创建游戏房间...')}
        </div>
        <p className="mt-2 text-sm text-[#9CA3AF]">
          {t('Connecting to live multiplayer server', '正在连接实时多人服务器')}
        </p>
      </div>
    );
  }

  const selectedGame = getLocalizedGameMeta(getGameMeta(room.selectedGameId), lang);
  const joinUrl = getJoinUrl(room.code, lang);
  const displayJoinHost =
    typeof window !== 'undefined' ? `${window.location.host}` : 'joinstick.arcade';
  const humans = room.players.filter((p) => !p.isBot);
  const connectedHumans = humans.filter((p) => p.connected);
  const bots = room.players.filter((p) => p.isBot);
  const readyHumans = connectedHumans.filter((p) => p.ready);
  const unreadyHumans = connectedHumans.filter((p) => !p.ready);
  const canStartMatch = room.players.length > 0 && unreadyHumans.length === 0;
  const isRoomFull = room.players.length >= MAX_PLAYERS_PER_ROOM;
  const activeHostPlayer =
    room.players.find((p) => p.id === room.hostPlayerId && !p.isBot && p.connected) ?? null;
  // Once inside the Game Room / Match, ONLY the connected human Host's phone remote controls the screen!
  const isScreenRemoteLocked = Boolean(activeHostPlayer);

  const guardHostOnlyClick = (fallbackAction: () => void) => {
    if (isScreenRemoteLocked && activeHostPlayer) {
      showBannerToast(
        lang === 'zh'
          ? `大屏已锁定为 ${activeHostPlayer.name} 的手机遥控 — 请用房主方向键操作或移交房主。`
          : `Screen locked to ${activeHostPlayer.name}'s Remote — use their phone D-Pad or Pass Host.`
      );
      return;
    }
    fallbackAction();
  };

  // Shared floating Kahoot-style live reaction overlay + Host Transfer / Lock Toast
  const floatingEmoteOverlay = (
    <>
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-40">
        <AnimatePresence>
          {floatingEmotes.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 120, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: -260, scale: [0.6, 1.15, 1, 0.9] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.3, ease: 'easeOut' }}
              style={{ left: `${item.xPercent}%` }}
              className="absolute bottom-14 -translate-x-1/2 flex flex-col items-center gap-1"
            >
              <span className="text-4xl drop-shadow-lg">{item.emoji}</span>
              <span
                className="px-2.5 py-0.5 rounded-md text-xs font-extrabold shadow-md whitespace-nowrap"
                style={{ backgroundColor: item.colorHex, color: '#0B1016' }}
              >
                {item.playerName}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {bannerToast && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-[#1A1E26]/95 border-2 border-[#FFB800] text-white font-display font-bold text-sm shadow-2xl inline-flex items-center gap-2 whitespace-nowrap"
          >
            <Crown className="w-4 h-4 text-[#FFB800] shrink-0" />
            <span>{bannerToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  // =========================================================================
  // VIEW A1: KAHOOT-STYLE INTERACTIVE ROOM SETUP STAGE
  // =========================================================================
  if (room.status === 'SETUP') {
    const activeDifficultyMeta = getLocalizedDifficulty(room.botDifficulty, lang);

    return (
      <div className="min-h-screen bg-[#121419] text-[#F4F6FA] flex flex-col relative overflow-hidden">
        {/* Subtle homepage-accent ambient spotlight backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-32 -left-24 w-[460px] h-[460px] rounded-full bg-[#FF4D2E]/10 blur-[120px]" />
          <div className="absolute top-1/3 -right-24 w-[440px] h-[440px] rounded-full bg-[#00C2FF]/10 blur-[120px]" />
          <div className="absolute -bottom-32 left-1/3 w-[420px] h-[420px] rounded-full bg-[#FFB800]/8 blur-[120px]" />
          <div className="absolute top-24 left-12 w-20 h-20 rounded-2xl border-2 border-[#262C38]/70 rotate-12" />
          <div className="absolute bottom-24 right-16 w-28 h-28 rounded-full border-2 border-[#262C38]/70" />
          <div className="absolute top-1/2 left-8 w-12 h-12 rounded-lg bg-[#1A1E26]/50 -rotate-12" />
        </div>

        {floatingEmoteOverlay}

        {/* Top Bar */}
        <header className="relative z-10 border-b border-[#242934] bg-[#121419]/95 backdrop-blur-md">
          <div className="max-w-[1380px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={handleLeaveHost}
                className="min-h-[40px] px-3 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#2F3747] text-sm font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('Home', '首页')}
              </button>
              <span className="font-display text-lg font-extrabold text-white whitespace-nowrap shrink-0">
                {t('JoinStick Party Stage', 'JoinStick 派对舞台')}
              </span>
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-[#9CA3AF]">
                <span
                  className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#10D98B]' : 'bg-[#FFB800]'}`}
                />
                {wsConnected ? t('Live Room Open', '房间已开启') : t('Reconnecting...', '正在重连...')}
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <LanguageToggle className="h-10 px-3" />

              <button
                type="button"
                onClick={() => setTestDrawerOpen((v) => !v)}
                className={`tactile-btn h-10 px-4 rounded-xl text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  testDrawerOpen
                    ? 'bg-[#00C2FF] text-[#0B1219]'
                    : 'bg-[#1E232D] hover:bg-[#242A36] text-white border border-[#2F3747]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                {t('Test Controller', '测试手柄')}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? t('Unmute audio', '取消静音') : t('Mute audio', '静音')}
                className="h-10 w-10 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#2F3747] text-white flex items-center justify-center cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Main Kahoot-Style Party Stage */}
        <main className="relative z-10 flex-1 max-w-[1380px] w-full mx-auto px-6 py-7 flex flex-col gap-6">
          {/* HERO JOIN PIN + QR BANNER */}
          <section className="rounded-3xl bg-[#1A1E26] border-2 border-[#2A303D] shadow-2xl p-5 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Left: Join instructions & quick links */}
              <div className="lg:col-span-4 space-y-3 text-center lg:text-left">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#00C2FF]">
                  <Sparkles className="w-4 h-4" />
                  {t('Step 1 · Join on Your Phone', '第 1 步 · 手机扫码加入')}
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  {t('Scan QR or enter the PIN to jump in!', '扫描二维码或输入房间码立即加入！')}
                </h1>
                <p className="text-xs text-[#A5AEBD] truncate">
                  {t('Open', '在任意手机打开')}{' '}
                  <strong className="text-white">{displayJoinHost}</strong>{' '}
                  {t('on any phone', '')}
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyJoinLink}
                    className="h-10 px-4 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#10D98B]" /> : <Copy className="w-4 h-4" />}
                    {copied ? t('Link Copied!', '链接已复制！') : t('Copy Join Link', '复制加入链接')}
                  </button>
                  <a
                    href={joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-4 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-[#00C2FF] inline-flex items-center gap-1.5"
                  >
                    {t('Open Phone Tab', '新标签打开手柄')}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Center: Giant Game PIN Card */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <div className="w-full max-w-md rounded-2xl bg-white text-[#121419] px-6 py-5 shadow-[0_8px_0_rgba(0,0,0,0.35)] text-center">
                  <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#FF4D2E]">
                    {t('Game PIN', '房间码 PIN')}
                  </div>
                  <div className="mt-1 font-mono text-5xl sm:text-6xl font-black tracking-[0.26em] text-[#121419] tabular-nums pl-[0.26em]">
                    {room.code}
                  </div>
                </div>
              </div>

              {/* Right: Crisp Big QR Card */}
              <div className="lg:col-span-3 flex justify-center lg:justify-end">
                <div className="bg-white rounded-2xl p-3 shadow-[0_8px_0_rgba(0,0,0,0.35)] w-[164px] h-[164px] flex items-center justify-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={t(`QR code to join room ${room.code}`, `加入房间 ${room.code} 的二维码`)}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-[#6B7280]">{t('Loading QR...', '加载二维码...')}</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* LIVE ACTION BAR: Player Counter + Robot Assignment + Difficulty + Enter Game Room CTA */}
          <section className="rounded-2xl bg-[#151820] border border-[#262C38] px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            {/* Big Player Counter */}
            <div className="flex items-center gap-3">
              <motion.div
                key={room.players.length}
                initial={{ scale: 1.25 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 450, damping: 18 }}
                className="h-12 px-4 rounded-xl bg-[#242A36] border border-[#2F3747] text-white font-display font-extrabold text-lg inline-flex items-center gap-2 shadow-[0_4px_0_#101217]"
              >
                <Users className="w-5 h-5 text-[#FFB800]" />
                <span className="tabular-nums">
                  {room.players.length} / {MAX_PLAYERS_PER_ROOM}
                </span>
              </motion.div>
              <div className="text-xs leading-snug text-[#9CA3AF]">
                <div className="text-white font-bold text-sm">
                  {t(
                    `${humans.length} Player${humans.length === 1 ? '' : 's'} · ${bots.length} Robot${bots.length === 1 ? '' : 's'}`,
                    `${humans.length} 名玩家 · ${bots.length} 个机器人`
                  )}
                </div>
                <div>
                  {t(
                    'Players can tap emojis on their phone while waiting!',
                    '等待时玩家可在手机上发送表情互动！'
                  )}
                </div>
              </div>
            </div>

            {/* Robot Controls: + Add Robot & Chill / Arcade / Spicy */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAddBot}
                disabled={isRoomFull}
                className="tactile-btn h-12 px-4 rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] disabled:opacity-40 disabled:cursor-not-allowed text-[#0B1219] font-display font-extrabold text-sm shadow-[0_4px_0_#007FA8] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <Bot className="w-4 h-4" />
                <span>{t('Add Robot', '添加机器人')}</span>
              </button>

              <div className="flex flex-col items-start sm:items-end gap-0.5">
                <div
                  role="radiogroup"
                  aria-label={t('Robot difficulty', '机器人难度')}
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#101217] border border-[#262C39]"
                >
                  {DIFFICULTY_OPTIONS.map((opt) => {
                    const active = room.botDifficulty === opt.id;
                    const diffMeta = getLocalizedDifficulty(opt.id, lang);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => handleSetBotDifficulty(opt.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
                          active ? 'text-[#0B1016]' : 'text-[#9CA3AF] hover:text-white'
                        }`}
                        style={active ? { backgroundColor: opt.color } : undefined}
                      >
                        {diffMeta.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] text-[#9CA3AF]">{activeDifficultyMeta.hint}</span>
              </div>

              <button
                type="button"
                onClick={handleEnterGameRoom}
                disabled={room.players.length === 0}
                className="tactile-btn h-12 px-6 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-extrabold text-base shadow-[0_4px_0_#B82E17] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <span>{t('Enter Game Room', '进入游戏厅')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/45 text-sm text-[#FF9B8A] font-medium">
              {translateServerMessage(errorMsg, lang)}
            </div>
          )}

          {/* LIVE INTERACTIVE PLAYER STAGE (Spring pop-in name cards) */}
          <section className="flex-1 rounded-3xl bg-[#151820] border border-[#242934] p-6 sm:p-8 flex flex-col justify-center min-h-[260px]">
            {room.players.length === 0 ? (
              <div className="text-center max-w-lg mx-auto py-8">
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1A1E26] border border-[#2A303D] text-[#00C2FF] mb-4"
                >
                  <Smartphone className="w-8 h-8" />
                </motion.div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  {t('Waiting for players to join...', '等待玩家加入...')}
                </h2>
                <p className="mt-2 text-sm text-[#A5AEBD]">
                  {t(
                    'Scan the QR code or type PIN',
                    '使用手机扫描二维码或输入房间码'
                  )}{' '}
                  <strong className="font-mono text-white">{room.code}</strong>{' '}
                  {t(
                    'on your phone — or add AI robots to play right now!',
                    '，或者直接添加 AI 机器人立即开玩！'
                  )}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTestDrawerOpen(true)}
                    className="tactile-btn h-11 px-5 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-sm font-bold text-white inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4 text-[#00C2FF]" />
                    {t('Open Test Controller', '打开测试手柄')}
                  </button>
                  <button
                    type="button"
                    onClick={handleAddBot}
                    className="tactile-btn h-11 px-5 rounded-xl bg-[#00C2FF]/15 hover:bg-[#00C2FF]/25 border border-[#00C2FF]/40 text-sm font-bold text-[#00C2FF] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <Bot className="w-4 h-4" />
                    {t('Add a Robot', '添加机器人')}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                    {t(
                      'Players on Stage · Click “Make Host” to pick who leads the room',
                      '已上台玩家 · 点击「设为房主」指定由谁遥控大屏'
                    )}
                  </div>
                  <div className="text-xs font-mono text-[#9CA3AF] tabular-nums">
                    {t(
                      `${MAX_PLAYERS_PER_ROOM - room.players.length} open seat${MAX_PLAYERS_PER_ROOM - room.players.length === 1 ? '' : 's'}`,
                      `剩余 ${MAX_PLAYERS_PER_ROOM - room.players.length} 个空位`
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <AnimatePresence mode="popLayout">
                    {room.players.map((player) => {
                      const isHost = !player.isBot && room.hostPlayerId === player.id;
                      const botDiff = player.botDifficulty ?? room.botDifficulty;
                      return (
                        <motion.div
                          key={player.id}
                          layout
                          initial={{ scale: 0.55, opacity: 0, y: 24 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                          className={`rounded-2xl p-4 border-2 shadow-[0_6px_0_rgba(0,0,0,0.3)] flex flex-col justify-between gap-3 ${
                            isHost
                              ? 'bg-[#1F2430] border-[#FFB800]'
                              : 'bg-[#1A1E26] border-[#2A303D]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="h-8 px-2.5 rounded-lg font-mono text-xs font-black inline-flex items-center gap-1"
                              style={{
                                backgroundColor: player.color.hex,
                                color: player.color.textOnColor,
                              }}
                            >
                              {player.isBot && <Bot className="w-3.5 h-3.5" />}
                              P{player.slotIndex + 1}
                            </span>

                            {player.isBot ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  title={t('Click to change bot difficulty', '点击切换机器人难度')}
                                  onClick={() =>
                                    handleSetBotDifficulty(NEXT_DIFFICULTY[botDiff], player.id)
                                  }
                                  className="h-7 px-2 rounded-lg bg-[#101217] hover:bg-[#242A36] border border-[#262C38] text-[11px] font-extrabold cursor-pointer"
                                  style={{
                                    color: difficultyColor(botDiff),
                                  }}
                                >
                                  {getLocalizedDifficulty(botDiff, lang).label}
                                </button>
                                <button
                                  type="button"
                                  aria-label={t(`Remove ${player.name}`, `移除 ${player.name}`)}
                                  title={t(`Remove ${player.name}`, `移除 ${player.name}`)}
                                  onClick={() => handleRemoveBot(player.id)}
                                  className="h-7 w-7 rounded-lg bg-[#101217] hover:bg-[#FF4D2E] border border-[#262C38] text-[#9CA3AF] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : isHost ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFB800] text-[#14120B] text-xs font-extrabold">
                                <Crown className="w-3.5 h-3.5" />
                                {t('Host', '房主')}
                              </span>
                            ) : player.connected ? (
                              <button
                                type="button"
                                onClick={() => handleSetHostPlayer(player.id)}
                                className="h-7 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#FFB800] hover:text-[#14120B] text-[11px] font-bold text-white transition-colors cursor-pointer"
                              >
                                {t('Make Host', '设为房主')}
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-[#FFB800]">
                                {t('Offline', '离线')}
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="font-display text-xl font-extrabold text-white truncate">
                              {player.name}
                            </div>
                            <div className="text-xs text-[#A5AEBD] mt-0.5">
                              {player.isBot
                                ? t('AI Robot · Always Ready', 'AI 机器人 · 自动准备')
                                : isHost
                                ? t('Room Host · Can start games', '房主 · 可遥控选游并开始')
                                : t('Phone Controller Connected', '手机手柄已连接')}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </section>
        </main>

        <TestControllerDrawer
          roomCode={room.code}
          open={testDrawerOpen}
          onClose={() => setTestDrawerOpen(false)}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW A2: FULLSCREEN TV GAME ROOM (Controlled Exclusively by Host's Remote!)
  // =========================================================================
  if (room.status === 'LOBBY') {
    const visibleGames = filterGamesByPlayerMode(room.lobbyFilter).map((g) =>
      getLocalizedGameMeta(g, lang)
    );
    const focus = room.remoteFocus;
    const activeSettingOpt =
      selectedGame.settingOptions.find((o) => o.value === room.gameSettingValue) ??
      selectedGame.settingOptions[0];

    const tvFocusRing =
      'ring-3 ring-[#FFB800] border-[#FFB800] shadow-[0_0_26px_rgba(255,184,0,0.45)] scale-[1.03] z-10';

    return (
      <div className="fixed inset-0 h-screen w-screen bg-[#121419] text-[#F4F6FA] flex flex-col overflow-hidden select-none">
        {floatingEmoteOverlay}

        {/* Slim Fullscreen TV Console Header */}
        <header className="h-14 border-b border-[#242934] bg-[#151820] px-5 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <span className="font-display text-lg font-extrabold text-white whitespace-nowrap shrink-0">
              {t('JoinStick Game Room', 'JoinStick 游戏厅')}
            </span>
            <span className="text-xs font-mono text-[#9CA3AF] whitespace-nowrap shrink-0">
              PIN <strong className="text-white">{room.code}</strong> · {room.players.length}/
              {MAX_PLAYERS_PER_ROOM} {t('Players', '人')}
            </span>
          </div>

          {/* Center Host Remote Lock Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1A1E26] border border-[#FFB800]/55 text-xs font-bold text-[#FFB800] whitespace-nowrap">
            {activeHostPlayer ? (
              <>
                <Crown className="w-3.5 h-3.5 text-[#FFB800] shrink-0" />
                <span>
                  {t('Controlled by', '正由')}{' '}
                  <strong className="text-white">{activeHostPlayer.name}</strong>
                  {t("'s Phone Remote", ' 的手机遥控器控制')}
                </span>
                <Lock className="w-3 h-3 text-[#FFB800]/80 shrink-0" />
              </>
            ) : (
              <>
                <Gamepad2 className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />
                <span className="text-[#D1D5DB]">
                  {t(
                    'Bot-Only Spectator Mode · Mouse Control Active',
                    '纯机器人观战模式 · 可直接用鼠标控制'
                  )}
                </span>
              </>
            )}
          </div>

          {/* Passive Display Utilities Only (Language, Fullscreen, Audio, Test Pad) */}
          <div className="flex items-center gap-2 shrink-0">
            <LanguageToggle compact className="h-9" />

            <button
              type="button"
              onClick={() => setTestDrawerOpen((v) => !v)}
              className={`h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                testDrawerOpen
                  ? 'bg-[#00C2FF] text-[#0B1219]'
                  : 'bg-[#242A36] hover:bg-[#2E3646] text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              {t('Test Remote', '测试遥控器')}
            </button>

            <button
              type="button"
              onClick={toggleMonitorFullscreen}
              aria-label={
                isMonitorFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')
              }
              title={
                isMonitorFullscreen ? t('Exit Fullscreen', '退出全屏') : t('Enter Fullscreen', '进入全屏')
              }
              className={`h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isMonitorFullscreen
                  ? 'bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB]'
                  : 'bg-[#FFB800] text-[#14120B] hover:bg-[#FFC933]'
              }`}
            >
              {isMonitorFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
              <span>{isMonitorFullscreen ? t('Exit Full', '退出全屏') : t('Fullscreen', '全屏')}</span>
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t('Unmute audio', '取消静音') : t('Mute audio', '静音')}
              className="h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Main Fullscreen Console Body (Zero Page Scroll) */}
        <main className="flex-1 min-h-0 px-5 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
          {/* LEFT / CENTER (8 cols): Filter Bar + 4-Column TV Game Grid */}
          <section className="lg:col-span-8 flex flex-col min-h-0 gap-3">
            {/* Row 0: Filter Bar (zone === 'filter') */}
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div
                role="tablist"
                aria-label={t('Filter games by player count', '按游玩人数筛选游戏')}
                className="inline-flex items-center gap-1.5 p-1.5 rounded-xl bg-[#101217] border border-[#262C39]"
              >
                {PLAYER_FILTER_OPTIONS.map((opt, idx) => {
                  const isActiveFilter = room.lobbyFilter === opt.id;
                  const isRemoteFocused = focus.zone === 'filter' && focus.index === idx;
                  const count = filterGamesByPlayerMode(opt.id).length;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={isActiveFilter}
                      onClick={() =>
                        guardHostOnlyClick(() =>
                          wsRef.current?.send({
                            type: 'remote:action',
                            action: 'ok',
                          })
                        )
                      }
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-all border ${
                        isRemoteFocused
                          ? `bg-[#FFB800] text-[#14120B] ${tvFocusRing}`
                          : isActiveFilter
                          ? 'bg-[#FF4D2E] text-white border-transparent'
                          : 'bg-transparent text-[#9CA3AF] border-transparent'
                      } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {getLocalizedFilterLabel(opt.id, lang, true)}{' '}
                      <span className="font-mono opacity-80 tabular-nums">({count})</span>
                    </button>
                  );
                })}
              </div>

              <div className="text-xs text-[#9CA3AF] font-medium whitespace-nowrap hidden sm:block">
                {t('Use Host Remote', '房主遥控器')}{' '}
                <strong className="text-white">▲ ▼ ◀ ▶</strong> {t('to browse ·', '浏览 ·')}{' '}
                <strong className="text-[#FFB800]">OK</strong> {t('to select', '确认')}
              </div>
            </div>

            {/* Row 1..N: 4-Column TV Cartridge Grid (zone === 'games') */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 py-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {visibleGames.map((game, idx) => {
                  const isSelected = room.selectedGameId === game.id;
                  const isRemoteFocused = focus.zone === 'games' && focus.index === idx;
                  return (
                    <button
                      key={game.id}
                      ref={isRemoteFocused ? focusedGameBtnRef : undefined}
                      type="button"
                      onClick={() =>
                        guardHostOnlyClick(() => handleSelectGame(game.id))
                      }
                      className={`relative text-left rounded-xl overflow-hidden border-2 transition-all flex flex-col ${
                        isRemoteFocused
                          ? `bg-[#242A36] ${tvFocusRing}`
                          : isSelected
                          ? 'bg-[#202633] border-white/75'
                          : 'bg-[#1A1E26] border-[#282E3B]'
                      } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer hover:border-[#3A4356]'}`}
                    >
                      <div className="relative aspect-video w-full bg-[#101217]">
                        {!failedImages[game.id] ? (
                          <img
                            src={game.coverImage}
                            alt={game.name}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedImages((prev) => ({ ...prev, [game.id]: true }))
                            }
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-[#181C24]">
                            <Gamepad2 className="w-6 h-6" style={{ color: game.accentHex }} />
                          </div>
                        )}
                        {isRemoteFocused && (
                          <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-[#FFB800] text-[#14120B] font-mono text-[10px] font-black shadow">
                            OK
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="text-[10px] font-medium text-[#9CA3AF] truncate">
                            {game.category} · {game.playerModeLabel}
                          </div>
                          <div className="font-display font-bold text-sm text-white mt-0.5 truncate">
                            {game.name}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* RIGHT PANEL (4 cols): Highlighted Game Spotlight + Live Ready Check */}
          <section className="lg:col-span-4 flex flex-col min-h-0 gap-3.5 overflow-hidden">
            {/* Highlighted Game Card */}
            <div className="rounded-2xl bg-[#1A1E26] border border-[#282E3B] p-4 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#00C2FF] truncate">
                    {selectedGame.category} · {selectedGame.playerModeLabel}
                  </div>
                  <h2 className="font-display text-xl font-extrabold text-white truncate mt-0.5">
                    {selectedGame.name}
                  </h2>
                </div>
                <span className="font-mono text-xs font-bold text-[#FFB800] bg-[#FFB800]/12 px-2.5 py-1 rounded-lg shrink-0">
                  {activeSettingOpt?.label ?? room.gameSettingValue}
                </span>
              </div>

              <p className="text-xs text-[#A5AEBD] mt-1.5 leading-snug">{selectedGame.tagline}</p>

              <div className="mt-3 pt-3 border-t border-[#262C38] grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-[#101217] border border-[#242934] p-2">
                  <div className="text-[10px] text-[#9CA3AF]">{t('Button A', 'A 键')}</div>
                  <div
                    className="font-bold truncate"
                    style={{ color: selectedGame.controllerSchema.actionA.colorHex }}
                  >
                    {selectedGame.controllerSchema.actionA.label}
                  </div>
                </div>
                <div className="rounded-lg bg-[#101217] border border-[#242934] p-2">
                  <div className="text-[10px] text-[#9CA3AF]">{t('Button B', 'B 键')}</div>
                  <div
                    className="font-bold truncate"
                    style={{ color: selectedGame.controllerSchema.actionB.colorHex }}
                  >
                    {selectedGame.controllerSchema.actionB.label}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Ready Check Roster */}
            <div className="flex-1 min-h-0 rounded-2xl bg-[#1A1E26] border border-[#282E3B] p-4 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2.5 shrink-0">
                <h3 className="font-display text-sm font-extrabold text-white">
                  {t('Ready Check', '准备状态')}
                </h3>
                <span className="font-mono text-xs font-bold text-[#10D98B] tabular-nums">
                  {connectedHumans.length > 0
                    ? t(
                        `${readyHumans.length}/${connectedHumans.length} Phones Ready`,
                        `${readyHumans.length}/${connectedHumans.length} 名玩家已准备`
                      )
                    : t(
                        `${bots.length} Bot${bots.length === 1 ? '' : 's'} Ready`,
                        `${bots.length} 个机器人已准备`
                      )}
                </span>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5">
                {room.players.map((player) => {
                  const isHost = !player.isBot && room.hostPlayerId === player.id;
                  const botDiff = player.botDifficulty ?? room.botDifficulty;
                  return (
                    <motion.div
                      key={player.id}
                      layout
                      className={`h-10 px-3 rounded-xl border flex items-center justify-between gap-2 ${
                        player.ready && player.connected
                          ? 'bg-[#112620] border-[#10D98B]/55'
                          : 'bg-[#1E232D] border-[#2F3747]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-6 h-6 rounded-md font-mono text-[10px] font-black flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: player.color.hex,
                            color: player.color.textOnColor,
                          }}
                        >
                          P{player.slotIndex + 1}
                        </span>
                        {player.isBot && <Bot className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />}
                        {isHost && <Crown className="w-3.5 h-3.5 text-[#FFB800] shrink-0" />}
                        <span className="text-xs font-bold text-white truncate">{player.name}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {player.isBot ? (
                          <span
                            className="text-[11px] font-bold"
                            style={{
                              color: difficultyColor(botDiff),
                            }}
                          >
                            {getLocalizedDifficulty(botDiff, lang).label} · {t('Ready', '已准备')}
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-bold inline-flex items-center gap-1 ${
                              !player.connected
                                ? 'text-[#FFB800]'
                                : player.ready
                                ? 'text-[#10D98B]'
                                : 'text-[#FFB800]'
                            }`}
                          >
                            {player.connected && player.ready && <Check className="w-3.5 h-3.5" />}
                            {!player.connected
                              ? t('Offline', '离线')
                              : player.ready
                              ? t('Ready', '已准备')
                              : t('Not Ready', '未准备')}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {unreadyHumans.length > 0 && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-[#FFB800]/12 border border-[#FFB800]/35 text-[11px] text-[#FDE68A] leading-snug shrink-0">
                  {t('Waiting for', '等待')}{' '}
                  <strong className="text-white">
                    {unreadyHumans.map((p) => p.name).join(lang === 'zh' ? '、' : ', ')}
                  </strong>{' '}
                  {t('to press Ready on their phone.', '在手机上点击「准备」。')}
                </div>
              )}

              {errorMsg && (
                <div className="mt-2 p-2.5 rounded-xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/45 text-[11px] text-[#FF9B8A] shrink-0">
                  {translateServerMessage(errorMsg, lang)}
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Bottom TV Remote Action Dock (zone === 'actions', indices 0..4) */}
        <footer className="border-t border-[#242934] bg-[#151820] px-5 py-3 shrink-0">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {/* Action 0: Start / Open Game */}
            <button
              type="button"
              onClick={() => guardHostOnlyClick(handleStartMatch)}
              className={`h-12 px-4 rounded-xl font-display font-extrabold text-sm inline-flex items-center justify-center gap-2 border-2 transition-all whitespace-nowrap ${
                focus.zone === 'actions' && focus.index === 0
                  ? `bg-[#FF4D2E] text-white ${tvFocusRing}`
                  : canStartMatch
                  ? 'bg-[#FF4D2E] text-white border-transparent'
                  : 'bg-[#2A2022] text-[#FF9B8A] border-[#3F2A2C]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span className="truncate">
                {canStartMatch
                  ? t(`Open ${selectedGame.name}`, `进入 ${selectedGame.name}`)
                  : t('Waiting for Ready', '等待全员准备')}
              </span>
            </button>

            {/* Action 1: Cycle Match Setting */}
            <button
              type="button"
              onClick={() =>
                guardHostOnlyClick(() => {
                  const opts = selectedGame.settingOptions;
                  const idx = opts.findIndex((o) => o.value === room.gameSettingValue);
                  const next = opts[(idx + 1) % opts.length];
                  if (next) handleSelectGame(selectedGame.id, next.value);
                })
              }
              className={`h-12 px-3 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap ${
                focus.zone === 'actions' && focus.index === 1
                  ? `bg-[#242A36] text-white ${tvFocusRing}`
                  : 'bg-[#1E232D] text-[#D1D5DB] border-[#2F3747]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className="text-[#9CA3AF]">{selectedGame.settingLabel}:</span>
              <span className="text-[#FFB800] font-mono">
                {activeSettingOpt?.label ?? room.gameSettingValue}
              </span>
            </button>

            {/* Action 2: + Add Robot */}
            <button
              type="button"
              onClick={() => guardHostOnlyClick(handleAddBot)}
              disabled={isRoomFull && !isScreenRemoteLocked}
              className={`h-12 px-3 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap ${
                focus.zone === 'actions' && focus.index === 2
                  ? `bg-[#00C2FF] text-[#0B1219] ${tvFocusRing}`
                  : 'bg-[#1E232D] text-[#00C2FF] border-[#2F3747]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <Bot className="w-4 h-4 shrink-0" />
              <span>{isRoomFull ? t('Room Full', '房间已满') : t('Add Robot', '添加机器人')}</span>
            </button>

            {/* Action 3: Cycle Bot Difficulty */}
            <button
              type="button"
              onClick={() =>
                guardHostOnlyClick(() => handleSetBotDifficulty(NEXT_DIFFICULTY[room.botDifficulty]))
              }
              className={`h-12 px-3 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap ${
                focus.zone === 'actions' && focus.index === 3
                  ? `bg-[#242A36] text-white ${tvFocusRing}`
                  : 'bg-[#1E232D] text-[#D1D5DB] border-[#2F3747]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className="text-[#9CA3AF]">{t('Bot Level:', '机器人难度:')}</span>
              <span style={{ color: difficultyColor(room.botDifficulty) }}>
                {getLocalizedDifficulty(room.botDifficulty, lang).label}
              </span>
            </button>

            {/* Action 4: Back to Room Setup / QR */}
            <button
              type="button"
              onClick={() => guardHostOnlyClick(handleReturnSetup)}
              className={`h-12 px-3 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap col-span-2 sm:col-span-1 ${
                focus.zone === 'actions' && focus.index === 4
                  ? `bg-[#242A36] text-white ${tvFocusRing}`
                  : 'bg-[#1E232D] text-[#D1D5DB] border-[#2F3747]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <QrCode className="w-4 h-4 text-[#00C2FF] shrink-0" />
              <span>{t('Room Setup / QR', '房间设置 / 二维码')}</span>
            </button>
          </div>
        </footer>

        <TestControllerDrawer
          roomCode={room.code}
          open={testDrawerOpen}
          onClose={() => setTestDrawerOpen(false)}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW B: ACTIVE 60FPS GAME MONITOR STAGE (BRIEFING / COUNTDOWN / PLAYING / PAUSED / RESULTS)
  // =========================================================================
  const briefingReadyPercent =
    connectedHumans.length > 0
      ? Math.round((readyHumans.length / connectedHumans.length) * 100)
      : 100;

  return (
    <div className="h-screen bg-[#121419] text-[#F4F6FA] flex flex-col overflow-hidden relative">
      {floatingEmoteOverlay}

      {/* Compact Unobtrusive Top HUD Bar */}
      <header className="h-14 border-b border-[#242934] bg-[#151820] px-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-display font-extrabold text-base text-white whitespace-nowrap shrink-0">
            {selectedGame.name}
          </span>
          <span className="text-xs font-mono text-[#9CA3AF] whitespace-nowrap shrink-0">
            PIN {room.code}
          </span>

          {/* Live Player Score Strip */}
          <div className="hidden lg:flex items-center gap-3 overflow-x-auto pl-2">
            {room.players.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 text-xs whitespace-nowrap ${
                  p.alive ? 'opacity-100' : 'opacity-45'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: p.color.hex }}
                />
                {p.isBot && <Bot className="w-3 h-3 text-[#00C2FF] shrink-0" />}
                <span className="font-semibold text-white">{p.name}</span>
                <span className="font-mono text-[#9CA3AF] tabular-nums">
                  {translateGameText(p.statText, lang)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <LanguageToggle compact className="h-9" />

          <button
            type="button"
            onClick={() => setTestDrawerOpen((v) => !v)}
            className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              testDrawerOpen
                ? 'bg-[#00C2FF] text-[#0B1219]'
                : 'bg-[#242A36] hover:bg-[#2E3646] text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            {t('Test Pad', '测试手柄')}
          </button>

          <button
            type="button"
            onClick={() =>
              guardHostOnlyClick(() =>
                wsRef.current?.send({
                  type: 'game:pause',
                  paused: room.status !== 'PAUSED',
                })
              )
            }
            disabled={room.status !== 'PLAYING' && room.status !== 'PAUSED'}
            className="h-9 px-3 rounded-lg bg-[#242A36] hover:bg-[#2E3646] disabled:opacity-40 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            {room.status === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {room.status === 'PAUSED' ? t('Resume', '继续') : t('Pause', '暂停')}
          </button>

          <button
            type="button"
            onClick={toggleMonitorFullscreen}
            aria-label={
              isMonitorFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')
            }
            className="h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
          >
            {isMonitorFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? t('Unmute audio', '取消静音') : t('Mute audio', '静音')}
            className="h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() =>
              guardHostOnlyClick(() => wsRef.current?.send({ type: 'game:return-lobby' }))
            }
            className="h-9 px-3 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] whitespace-nowrap cursor-pointer"
          >
            {t('Game Room', '游戏厅')}
          </button>
        </div>
      </header>

      {/* Center Responsive 16:9 Arena Stage */}
      <div className="flex-1 relative flex items-center justify-center p-3 sm:p-5 overflow-hidden">
        <div className="relative w-full h-full max-w-[1280px] flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={ARENA_WIDTH}
            height={ARENA_HEIGHT}
            className="max-w-full max-h-full aspect-[5/3] rounded-2xl border border-[#282E3B] shadow-2xl bg-[#101217]"
          />

          {/* Interactive Rules Briefing Modal — NO Auto-Countdown! Waits until everyone taps Ready */}
          {room.status === 'BRIEFING' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0B0D12]/88 backdrop-blur-sm rounded-2xl p-4 sm:p-6 z-20">
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="max-w-3xl w-full rounded-3xl bg-[#1A1E26] border-2 border-[#2F3747] shadow-2xl overflow-hidden"
              >
                {/* Header strip with game artwork thumbnail */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 sm:p-6 border-b border-[#262C38] bg-[#151820]">
                  <div className="w-full sm:w-40 aspect-video rounded-xl overflow-hidden bg-[#101217] border border-[#2A303D] shrink-0">
                    {!failedImages[selectedGame.id] ? (
                      <img
                        src={selectedGame.coverImage}
                        alt={selectedGame.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [selectedGame.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Gamepad2 className="w-7 h-7" style={{ color: selectedGame.accentHex }} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#00C2FF]">
                      {t('How to Play', '玩法说明')} · {selectedGame.category}
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mt-0.5 truncate">
                      {selectedGame.name}
                    </h2>
                    <p className="text-sm sm:text-base text-[#D1D5DB] mt-1">{selectedGame.tagline}</p>
                  </div>
                </div>

                {/* Body: Simple Rules + Clear Phone Controls */}
                <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">
                      {t('Simple Rules', '简单规则')}
                    </h3>
                    <ul className="space-y-2.5 text-sm sm:text-[15px] text-white">
                      {selectedGame.rules.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 leading-snug">
                          <span
                            className="w-6 h-6 rounded-md font-mono text-xs font-black flex items-center justify-center shrink-0 mt-0.5"
                            style={{
                              backgroundColor: `${selectedGame.accentHex}24`,
                              color: selectedGame.accentHex,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl bg-[#101217] border border-[#262C38] p-4 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">
                        {t('Your Phone Controls', '手机按键说明')}
                      </h3>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1E232D] border-2 border-[#2F3747] flex items-center justify-center shrink-0">
                            <div className="w-4 h-4 rounded-full bg-white/90" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-[#9CA3AF]">{t('Left Joystick', '左侧摇杆')}</div>
                            <div className="text-sm font-bold text-white truncate">
                              {selectedGame.controllerSchema.joystickLabel}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full font-display font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm"
                            style={{
                              backgroundColor: selectedGame.controllerSchema.actionA.colorHex,
                              color: selectedGame.controllerSchema.actionA.textColor,
                            }}
                          >
                            A
                          </div>
                          <div className="min-w-0">
                            <div
                              className="text-sm font-extrabold leading-tight"
                              style={{ color: selectedGame.controllerSchema.actionA.colorHex }}
                            >
                              {selectedGame.controllerSchema.actionA.label}
                            </div>
                            <div className="text-xs text-[#A5AEBD] truncate">
                              {selectedGame.controllerSchema.actionA.sublabel}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full font-display font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm"
                            style={{
                              backgroundColor: selectedGame.controllerSchema.actionB.colorHex,
                              color: selectedGame.controllerSchema.actionB.textColor,
                            }}
                          >
                            B
                          </div>
                          <div className="min-w-0">
                            <div
                              className="text-sm font-extrabold leading-tight"
                              style={{ color: selectedGame.controllerSchema.actionB.colorHex }}
                            >
                              {selectedGame.controllerSchema.actionB.label}
                            </div>
                            <div className="text-xs text-[#A5AEBD] truncate">
                              {selectedGame.controllerSchema.actionB.sublabel}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 pt-3 border-t border-[#242934] text-xs text-[#A5AEBD] leading-relaxed">
                      <strong className="text-white">{t('Tip:', '小提示：')}</strong>{' '}
                      {selectedGame.controllerSchema.controlTip}
                    </p>
                  </div>
                </div>

                {/* Live Ready Progress + Per-Player Ready Chips (NO auto-countdown!) */}
                <div className="px-5 sm:px-6 py-4 bg-[#151820] border-t border-[#262C38] space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-bold text-white">
                      {connectedHumans.length > 0
                        ? t(
                            `Tap "I'm Ready!" on your phone when finished reading (${readyHumans.length}/${connectedHumans.length} Ready)`,
                            `看完规则后在手机上点击「我准备好了！」（${readyHumans.length}/${connectedHumans.length} 已准备）`
                          )
                        : t(
                            'All robots are ready — press Start Match!',
                            '所有机器人已就绪 — 点击开始比赛！'
                          )}
                    </div>
                    <span className="font-mono text-xs font-extrabold text-[#10D98B] tabular-nums">
                      {briefingReadyPercent}% {t('Ready', '已准备')}
                    </span>
                  </div>

                  {/* Smooth Progress Bar */}
                  <div className="h-2.5 w-full rounded-full bg-[#242A36] overflow-hidden">
                    <motion.div
                      className="h-full bg-[#10D98B] rounded-full"
                      initial={false}
                      animate={{ width: `${briefingReadyPercent}%` }}
                      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    />
                  </div>

                  {/* Player Ready Chips */}
                  <div className="flex flex-wrap items-center gap-2">
                    {room.players.map((p) => {
                      const isReady = p.isBot || (p.connected && p.ready);
                      return (
                        <motion.div
                          key={p.id}
                          animate={{ scale: isReady ? [1, 1.08, 1] : 1 }}
                          transition={{ duration: 0.28 }}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 ${
                            isReady
                              ? 'bg-[#10D98B]/20 border-[#10D98B] text-[#6EE7B7]'
                              : 'bg-[#1E232D] border-[#2F3747] text-[#D1D5DB]'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.color.hex }}
                          />
                          {p.isBot && <Bot className="w-3.5 h-3.5 text-[#00C2FF]" />}
                          <span>{p.name}</span>
                          {isReady ? (
                            <Check className="w-3.5 h-3.5 text-[#10D98B]" />
                          ) : (
                            <span className="text-[10px] text-[#FFB800]">
                              {t('Reading...', '阅读中...')}
                            </span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        guardHostOnlyClick(() =>
                          wsRef.current?.send({ type: 'game:return-lobby' })
                        )
                      }
                      className={`h-10 px-4 rounded-xl bg-[#242A36] text-xs font-bold text-[#D1D5DB] transition-all ${
                        room.remoteFocus.modalIndex === 1
                          ? 'ring-2 ring-[#FFB800] bg-[#2E3646] text-white'
                          : ''
                      } ${isScreenRemoteLocked ? 'cursor-default' : 'hover:bg-[#2E3646] cursor-pointer'}`}
                    >
                      {t('Back to Game Room', '返回游戏厅')}
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        guardHostOnlyClick(() => {
                          arcadeAudio.unlock();
                          wsRef.current?.send({ type: 'game:dismiss-briefing' });
                        })
                      }
                      className={`tactile-btn h-10 px-5 rounded-xl bg-[#FF4D2E] text-white font-display font-bold text-xs sm:text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 transition-all ${
                        room.remoteFocus.modalIndex === 0 ? 'ring-2 ring-[#FFB800]' : ''
                      } ${isScreenRemoteLocked ? 'cursor-default' : 'hover:bg-[#FF6145] cursor-pointer'}`}
                    >
                      <Play className="w-4 h-4 fill-current shrink-0" />
                      <span>
                        {connectedHumans.length === 0
                          ? t('Start Match', '开始比赛')
                          : t('Host Override: Start Now', '房主直接开始')}
                      </span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* 3-2-1 Countdown Overlay */}
          {room.status === 'COUNTDOWN' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 rounded-2xl pointer-events-none">
              <div className="font-mono text-xs uppercase tracking-[0.25em] text-[#FFB800] mb-2">
                {t('Get Ready', '准备开始')}
              </div>
              <motion.div
                key={room.countdownValue}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="font-display text-8xl sm:text-9xl font-extrabold text-white drop-shadow-lg tabular-nums"
              >
                {room.countdownValue > 0 ? room.countdownValue : t('GO!', '开始！')}
              </motion.div>
            </div>
          )}

          {/* Paused Overlay */}
          {room.status === 'PAUSED' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-xs rounded-2xl">
              <h2 className="font-display text-4xl font-extrabold text-white">
                {t('Game Paused', '游戏已暂停')}
              </h2>
              {activeHostPlayer && (
                <p className="mt-2 text-xs font-bold text-[#FDE68A]">
                  {t(
                    `Use ${activeHostPlayer.name}'s Remote (◀ ▶ OK)`,
                    `使用 ${activeHostPlayer.name} 的遥控器（◀ ▶ OK）选择`
                  )}
                </p>
              )}
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    guardHostOnlyClick(() =>
                      wsRef.current?.send({ type: 'game:pause', paused: false })
                    )
                  }
                  className={`tactile-btn px-6 py-3 rounded-xl bg-[#FF4D2E] text-white font-bold text-sm shadow-[0_3px_0_#B82E17] transition-all ${
                    room.remoteFocus.modalIndex === 0 ? 'ring-3 ring-[#FFB800] scale-105' : ''
                  } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {t('Resume Match', '继续比赛')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    guardHostOnlyClick(() => wsRef.current?.send({ type: 'game:restart' }))
                  }
                  className={`tactile-btn px-5 py-3 rounded-xl bg-[#242A36] text-white font-semibold text-sm transition-all ${
                    room.remoteFocus.modalIndex === 1 ? 'ring-3 ring-[#FFB800] scale-105' : ''
                  } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {t('Restart', '重新开始')}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    guardHostOnlyClick(() => wsRef.current?.send({ type: 'game:return-lobby' }))
                  }
                  className={`tactile-btn px-5 py-3 rounded-xl bg-[#1A1E26] border border-[#313847] text-[#D1D5DB] font-semibold text-sm transition-all ${
                    room.remoteFocus.modalIndex === 2 ? 'ring-3 ring-[#FFB800] scale-105' : ''
                  } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {t('Switch Game', '切换游戏')}
                </button>
              </div>
            </div>
          )}

          {/* Victory Podium Modal Overlay */}
          {room.status === 'RESULTS' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0B0D12]/82 backdrop-blur-xs rounded-2xl p-6">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                className="max-w-lg w-full rounded-3xl bg-[#1A1E26] border-2 border-[#2F3747] p-7 text-center shadow-2xl"
              >
                <Trophy className="w-11 h-11 text-[#FFB800] mx-auto" />
                <h2 className="mt-2 font-display text-3xl font-extrabold text-white">
                  {room.rankings[0]
                    ? t(`${room.rankings[0].name} Wins!`, `${room.rankings[0].name} 获胜！`)
                    : t('Match Complete', '本局结束')}
                </h2>
                <p className="text-sm text-[#9CA3AF] mt-1">
                  {selectedGame.name} · {t('Final Standings', '最终排名')}
                </p>

                <div className="mt-5 space-y-2 text-left max-h-[280px] overflow-y-auto pr-1">
                  {room.rankings.map((entry) => {
                    const isBotEntry = room.players.find((p) => p.id === entry.playerId)?.isBot;
                    return (
                      <div
                        key={entry.playerId}
                        className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#101217] border border-[#262C38]"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-sm font-bold text-[#FFB800] w-6 tabular-nums">
                            #{entry.rank}
                          </span>
                          <span
                            className="w-7 h-7 rounded-md font-mono text-xs font-bold flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: entry.color.hex,
                              color: entry.color.textOnColor,
                            }}
                          >
                            P{entry.slotIndex + 1}
                          </span>
                          {isBotEntry && <Bot className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />}
                          <span className="font-semibold text-white truncate">{entry.name}</span>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono text-sm font-bold text-white tabular-nums">
                            {entry.score} {t('pts', '分')}
                          </span>
                          <span className="text-xs text-[#A5AEBD] ml-2">
                            · {translateGameText(entry.highlight, lang)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeHostPlayer && (
                  <p className="mt-4 text-xs font-bold text-[#FFB800]">
                    {t(
                      `Use ${activeHostPlayer.name}'s Remote (◀ ▶ OK)`,
                      `使用 ${activeHostPlayer.name} 的遥控器（◀ ▶ OK）选择`
                    )}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      guardHostOnlyClick(() => {
                        fxRef.current = createRenderFxState();
                        wsRef.current?.send({ type: 'game:restart' });
                      })
                    }
                    className={`tactile-btn px-6 py-3 rounded-xl bg-[#FF4D2E] text-white font-bold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 transition-all ${
                      room.remoteFocus.modalIndex === 0 ? 'ring-3 ring-[#FFB800] scale-105' : ''
                    } ${isScreenRemoteLocked ? 'cursor-default' : 'hover:bg-[#FF6145] cursor-pointer'}`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t('Play Again', '再来一局')}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      guardHostOnlyClick(() => wsRef.current?.send({ type: 'game:return-lobby' }))
                    }
                    className={`tactile-btn px-5 py-3 rounded-xl bg-[#242A36] text-white font-semibold text-sm transition-all ${
                      room.remoteFocus.modalIndex === 1 ? 'ring-3 ring-[#FFB800] scale-105' : ''
                    } ${isScreenRemoteLocked ? 'cursor-default' : 'hover:bg-[#2E3646] cursor-pointer'}`}
                  >
                    {t('Game Room', '返回游戏厅')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      <TestControllerDrawer
        roomCode={room.code}
        open={testDrawerOpen}
        onClose={() => setTestDrawerOpen(false)}
      />
    </div>
  );
}
