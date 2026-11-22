import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Crown,
  Dices,
  ExternalLink,
  Flame,
  Gamepad2,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  Power,
  QrCode,
  RotateCcw,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import {
  filterGamesByPlayerMode,
  getGameGenre,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import {
  GAME_FRENZY_PERKS,
  getMutatorSpec,
  type MutatorId,
} from '../shared/modifiers';
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
import { preloadGameRenderer } from '../games/rendererRegistry';
import { ChaosWheelModal } from './ChaosWheelModal';
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

function formatResponseTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
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
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testDrawerOpen, setTestDrawerOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([]);
  const [isMonitorFullscreen, setIsMonitorFullscreen] = useState(false);
  const [bannerToast, setBannerToast] = useState<string | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [isClosingRoom, setIsClosingRoom] = useState(false);
  const [chaosWheelOpen, setChaosWheelOpen] = useState(false);
  const [matchStatsExpanded, setMatchStatsExpanded] = useState(true);
  const [liveTurnInfo, setLiveTurnInfo] = useState<{
    activePlayerId: string | null;
    turnElapsedSec: number;
    phase: string | null;
    lastClaimPlayerId: string | null;
  }>({
    activePlayerId: null,
    turnElapsedSec: 0,
    phase: null,
    lastClaimPlayerId: null,
  });

  const wsRef = useRef<ManagedWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestSnapshotRef = useRef<GameSnapshot | null>(null);
  const fxRef = useRef(createRenderFxState());
  const prevStatusRef = useRef<string | null>(null);
  const prevHostIdRef = useRef<string | null>(null);
  const prevPlayersRef = useRef<RoomSnapshot['players']>([]);
  const prevSpinSeqRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelAutoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedGameBtnRef = useRef<HTMLButtonElement | null>(null);
  const gamesGridRef = useRef<HTMLDivElement | null>(null);
  const actionsGridRef = useRef<HTMLDivElement | null>(null);
  const lastSentLayoutRef = useRef<{ gameCols: number; actionCols: number }>({
    gameCols: 0,
    actionCols: 0,
  });

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
      onStatusChange: (status) => {
        setWsConnected(status === 'connected');
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
            enterMonitorFullscreen();
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
              const snap = msg.snapshot;
              if (snap.gameId === 'color-clash' || snap.gameId === 'liars-deck') {
                const elapsed = Math.max(
                  0,
                  Number(((snap.turnTotal || 15) - (snap.turnTimeLeft || 0)).toFixed(1))
                );
                const phase = snap.gameId === 'liars-deck' ? snap.phase : 'turn';
                const lastClaim =
                  snap.gameId === 'liars-deck' ? snap.lastClaimPlayerId : null;
                setLiveTurnInfo((prev) => {
                  if (
                    prev.activePlayerId === snap.activePlayerId &&
                    Math.abs(prev.turnElapsedSec - elapsed) < 0.2 &&
                    prev.phase === phase &&
                    prev.lastClaimPlayerId === lastClaim
                  ) {
                    return prev;
                  }
                  return {
                    activePlayerId: snap.activePlayerId,
                    turnElapsedSec: elapsed,
                    phase,
                    lastClaimPlayerId: lastClaim,
                  };
                });
              } else if ('activePlayerId' in snap && typeof snap.activePlayerId === 'string') {
                const actId = snap.activePlayerId;
                setLiveTurnInfo((prev) =>
                  prev.activePlayerId === actId
                    ? prev
                    : {
                        activePlayerId: actId,
                        turnElapsedSec: 0,
                        phase: 'phase' in snap && typeof snap.phase === 'string' ? snap.phase : null,
                        lastClaimPlayerId: null,
                      }
                );
              }
            }
            if (msg.sounds && msg.sounds.length > 0) {
              for (const s of msg.sounds) {
                arcadeAudio.play(s);
                if (s.type === 'frenzy') {
                  fxRef.current.shake = Math.max(fxRef.current.shake, 16);
                } else if (s.type === 'ko' || s.type === 'pulse' || s.type === 'bluff') {
                  fxRef.current.shake = Math.max(fxRef.current.shake, 10);
                } else if (s.type === 'bump') {
                  fxRef.current.shake = Math.max(fxRef.current.shake, 4 * (s.intensity ?? 0.5));
                }
              }
            }
            break;
          case 'room:closed':
            if (closeFallbackTimerRef.current) {
              clearTimeout(closeFallbackTimerRef.current);
              closeFallbackTimerRef.current = null;
            }
            sessionStorage.removeItem(HOST_SESSION_KEY);
            onExit();
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
      if (closeFallbackTimerRef.current) {
        clearTimeout(closeFallbackTimerRef.current);
        closeFallbackTimerRef.current = null;
      }
      if (wheelAutoCloseTimerRef.current) {
        clearTimeout(wheelAutoCloseTimerRef.current);
        wheelAutoCloseTimerRef.current = null;
      }
      socket.close();
      wsRef.current = null;
    };
  }, [initialGameId]);

  // Playful BGM across the entire room (SETUP/LOBBY/BRIEFING/RESULTS), switching to competitive/frenzy BGM during gameplay
  useEffect(() => {
    if (!room) {
      arcadeAudio.setBgm(null);
      return;
    }
    if (room.status === 'PLAYING') {
      arcadeAudio.setBgm(room.frenzy.active ? 'frenzy' : 'battle');
    } else {
      arcadeAudio.setBgm('lobby');
    }
  }, [room?.status, room?.frenzy?.active]);

  // Auto-open Chaos Wheel modal whenever the wheel spins in LOBBY
  useEffect(() => {
    if (!room) return;
    if (room.status !== 'LOBBY') {
      setChaosWheelOpen(false);
      return;
    }
    if (prevSpinSeqRef.current === null) {
      prevSpinSeqRef.current = room.mutatorSpinSeq;
      return;
    }
    if (room.mutatorSpinSeq > prevSpinSeqRef.current) {
      prevSpinSeqRef.current = room.mutatorSpinSeq;
      setChaosWheelOpen(true);
      if (wheelAutoCloseTimerRef.current) clearTimeout(wheelAutoCloseTimerRef.current);
      if (room.hostPlayerId) {
        wheelAutoCloseTimerRef.current = setTimeout(() => {
          setChaosWheelOpen(false);
        }, 4200);
      }
    }
  }, [room?.mutatorSpinSeq, room?.status, room?.hostPlayerId]);

  useEffect(() => {
    setAudioBlocked(arcadeAudio.isAudioBlocked());
    const unsub = arcadeAudio.subscribeAudioState(() => {
      setAudioBlocked(arcadeAudio.isAudioBlocked());
    });
    return () => {
      unsub();
      arcadeAudio.setBgm(null);
    };
  }, []);

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

  const userExitedFullscreenRef = useRef(false);

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
      const doc = document as Document & { webkitFullscreenElement?: Element };
      if (document.fullscreenElement || doc.webkitFullscreenElement) return;
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
        msRequestFullscreen?: () => Promise<void> | void;
      };
      if (typeof el.requestFullscreen === 'function') {
        el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {});
      } else if (typeof el.webkitRequestFullscreen === 'function') {
        el.webkitRequestFullscreen();
      } else if (typeof el.msRequestFullscreen === 'function') {
        el.msRequestFullscreen();
      }
    } catch {
      // Browser may require a direct monitor gesture; global gesture listener below catches first click
    }
  };

  const toggleMonitorFullscreen = () => {
    if (typeof document === 'undefined') return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      userExitedFullscreenRef.current = true;
      if (typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      } else if (typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen();
      }
    } else {
      userExitedFullscreenRef.current = false;
      enterMonitorFullscreen();
    }
  };

  // Force Fullscreen when Join Room is created and on the first interaction if opened via direct URL
  useEffect(() => {
    enterMonitorFullscreen();
    const onFirstGesture = () => {
      if (userExitedFullscreenRef.current) return;
      const doc = document as Document & { webkitFullscreenElement?: Element };
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        enterMonitorFullscreen();
      }
    };
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('pointerdown', onFirstGesture, opts);
    window.addEventListener('touchend', onFirstGesture, opts);
    window.addEventListener('click', onFirstGesture, opts);
    window.addEventListener('keydown', onFirstGesture, opts);
    return () => {
      window.removeEventListener('pointerdown', onFirstGesture, opts);
      window.removeEventListener('touchend', onFirstGesture, opts);
      window.removeEventListener('click', onFirstGesture, opts);
      window.removeEventListener('keydown', onFirstGesture, opts);
    };
  }, []);

  const showBannerToast = (text: string) => {
    setBannerToast(text);
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => setBannerToast(null), 3200);
  };

  // Automatically enter Fullscreen whenever room status transitions (e.g. SETUP -> LOBBY)
  useEffect(() => {
    if (!room) return;
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = room.status;
    if (!userExitedFullscreenRef.current && prevStatus !== room.status) {
      enterMonitorFullscreen();
    }
  }, [room?.status]);

  // Announce whenever Host transfers control or falls back to Mouse control
  useEffect(() => {
    if (!room) return;
    const prevHost = prevHostIdRef.current;
    const prevPlayers = prevPlayersRef.current;
    prevHostIdRef.current = room.hostPlayerId;
    prevPlayersRef.current = room.players;

    if (prevHost && room.hostPlayerId && prevHost !== room.hostPlayerId) {
      const nextHost = room.players.find((p) => p.id === room.hostPlayerId);
      const prevHostNow = room.players.find((p) => p.id === prevHost);
      const prevHostWasPresent = prevPlayers.some((p) => p.id === prevHost);
      const wasDisconnect = prevHostWasPresent && (!prevHostNow || !prevHostNow.connected);
      if (nextHost) {
        showBannerToast(
          wasDisconnect
            ? lang === 'zh'
              ? `原房主已断线 — 遥控权已随机移交给 ${nextHost.name}！`
              : `Host disconnected — remote control randomly passed to ${nextHost.name}!`
            : lang === 'zh'
            ? `房主遥控权限已移交给 ${nextHost.name}！现在由 TA 的手机遥控大屏。`
            : `Host control passed to ${nextHost.name}! Their phone is now the TV Remote.`
        );
      }
    } else if (prevHost && !room.hostPlayerId) {
      showBannerToast(
        lang === 'zh'
          ? '手机控制器已全部断开 — 已解锁鼠标直接控制大屏！'
          : 'All human controllers disconnected — Mouse control enabled!'
      );
    } else if (!prevHost && room.hostPlayerId && room.status !== 'SETUP' && prevPlayers.length > 0) {
      const nextHost = room.players.find((p) => p.id === room.hostPlayerId);
      if (nextHost) {
        showBannerToast(
          lang === 'zh'
            ? `${nextHost.name} 已连接 — 已切换为手机遥控大屏！`
            : `${nextHost.name} connected — Phone Remote control active!`
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

  // Report live responsive CSS Grid column counts so Host Remote Up/Down matches visual rows on every screen size
  useEffect(() => {
    if (!wsConnected || room?.status !== 'LOBBY') {
      lastSentLayoutRef.current = { gameCols: 0, actionCols: 0 };
      return;
    }

    const measureCols = (el: HTMLElement | null, fallback: number): number => {
      if (!el) return fallback;
      const tpl = window.getComputedStyle(el).gridTemplateColumns;
      if (!tpl || tpl === 'none') return fallback;
      const count = tpl.trim().split(/\s+/).filter(Boolean).length;
      return count > 0 ? count : fallback;
    };

    const syncLayout = () => {
      const w = window.innerWidth;
      const fallbackGames = w >= 1280 ? 4 : w >= 1024 ? 3 : 2;
      const fallbackActions = w >= 1280 ? 7 : w >= 640 ? 4 : 2;
      const gameCols = measureCols(gamesGridRef.current, fallbackGames);
      const actionCols = measureCols(actionsGridRef.current, fallbackActions);
      if (
        lastSentLayoutRef.current.gameCols !== gameCols ||
        lastSentLayoutRef.current.actionCols !== actionCols
      ) {
        lastSentLayoutRef.current = { gameCols, actionCols };
        wsRef.current?.send({ type: 'room:layout', gameCols, actionCols });
      }
    };

    syncLayout();
    const rafId = window.requestAnimationFrame(syncLayout);
    window.addEventListener('resize', syncLayout);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(syncLayout);
      if (gamesGridRef.current) observer.observe(gamesGridRef.current);
      if (actionsGridRef.current) observer.observe(actionsGridRef.current);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncLayout);
      observer?.disconnect();
    };
  }, [wsConnected, room?.status, room?.code]);

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

  const handleStartTournament = () => {
    arcadeAudio.unlock();
    setErrorMsg(null);
    fxRef.current = createRenderFxState();
    wsRef.current?.send({ type: 'tournament:start' });
  };

  const handleNextTournamentGame = () => {
    arcadeAudio.unlock();
    setErrorMsg(null);
    fxRef.current = createRenderFxState();
    wsRef.current?.send({ type: 'tournament:next' });
  };

  const handleExitTournament = () => {
    setErrorMsg(null);
    wsRef.current?.send({ type: 'tournament:exit' });
  };

  const handleSpinMutator = () => {
    arcadeAudio.unlock();
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:spin-mutator' });
  };

  const handleSetMutator = (mutatorId: MutatorId) => {
    arcadeAudio.unlock();
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:set-mutator', mutatorId });
  };

  useEffect(() => {
    if (room?.selectedGameId) {
      preloadGameRenderer(room.selectedGameId);
    }
  }, [room?.selectedGameId]);

  const handleSelectGame = (gameId: GameId, settingValue?: number) => {
    arcadeAudio.unlock();
    preloadGameRenderer(gameId);
    setErrorMsg(null);
    wsRef.current?.send({ type: 'game:select', gameId, settingValue });
  };

  const handleLeaveHost = () => {
    sessionStorage.removeItem(HOST_SESSION_KEY);
    onExit();
  };

  const confirmCloseRoom = () => {
    if (isClosingRoom) return;
    setIsClosingRoom(true);
    setCloseConfirmOpen(false);
    sessionStorage.removeItem(HOST_SESSION_KEY);
    if (wsRef.current && wsConnected) {
      wsRef.current.send({ type: 'room:close' });
      closeFallbackTimerRef.current = setTimeout(() => {
        onExit();
      }, 350);
    } else {
      onExit();
    }
  };

  const handleRequestCloseRoom = () => {
    if (room && room.players.length > 0) {
      setCloseConfirmOpen(true);
    } else {
      confirmCloseRoom();
    }
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

  const audioUnlockButton =
    audioBlocked && !muted ? (
      <button
        type="button"
        onClick={() => arcadeAudio.unlock()}
        className="h-9 px-2.5 sm:px-3 rounded-lg bg-[#FFB800] hover:bg-[#FFC933] text-[#14120B] text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap animate-pulse shadow cursor-pointer shrink-0"
      >
        <Volume2 className="w-3.5 h-3.5 shrink-0" />
        <span>{t('Tap for Music', '点击开启声音')}</span>
      </button>
    ) : null;

  const isCardGameSelected =
    room.selectedGameId === 'color-clash' || room.selectedGameId === 'liars-deck';
  const totalSessionMatches = room.players.reduce(
    (max, p) => Math.max(max, p.matchStats?.matchesPlayed ?? 0),
    0
  );
  const totalSessionActions = room.players.reduce(
    (sum, p) => sum + (p.matchStats?.totalActions ?? 0),
    0
  );
  const totalCardActions = room.players.reduce(
    (sum, p) => sum + (p.matchStats?.cardActions ?? 0),
    0
  );
  const playersWithCardResp = room.players.filter(
    (p) =>
      p.matchStats?.avgCardResponseMs !== null &&
      p.matchStats?.avgCardResponseMs !== undefined &&
      (p.matchStats?.cardResponses ?? 0) > 0
  );
  const roomAvgCardResponseMs =
    playersWithCardResp.length > 0
      ? Math.round(
          playersWithCardResp.reduce((sum, p) => sum + (p.matchStats?.avgCardResponseMs ?? 0), 0) /
            playersWithCardResp.length
        )
      : null;

  const sortedStatsPlayers = [...room.players].sort((a, b) => {
    const winsDiff = (b.matchStats?.wins ?? 0) - (a.matchStats?.wins ?? 0);
    if (winsDiff !== 0) return winsDiff;
    const actionsA = isCardGameSelected
      ? a.matchStats?.cardActions ?? 0
      : a.matchStats?.totalActions ?? 0;
    const actionsB = isCardGameSelected
      ? b.matchStats?.cardActions ?? 0
      : b.matchStats?.totalActions ?? 0;
    if (actionsB !== actionsA) return actionsB - actionsA;
    if (b.score !== a.score) return b.score - a.score;
    return a.slotIndex - b.slotIndex;
  });

  // Persistent Match Statistics Overlay (tracks Wins, Total Actions, and Avg Response Time during Card Games)
  const persistentMatchStatsOverlay =
    room.players.length > 0 ? (
      <div
        className={`fixed z-30 transition-all ${
          room.status === 'LOBBY'
            ? 'bottom-18 right-3 sm:right-4'
            : 'bottom-3 right-3 sm:bottom-4 sm:right-4'
        } ${matchStatsExpanded ? 'w-[320px] sm:w-[376px]' : 'w-auto'}`}
      >
        <div className="rounded-2xl bg-[#11141C]/94 backdrop-blur-md border border-[#2B3344] shadow-[0_14px_34px_rgba(0,0,0,0.62)] overflow-hidden">
          {/* Header / Toggle Bar */}
          <button
            type="button"
            onClick={() => setMatchStatsExpanded((v) => !v)}
            className="w-full px-3.5 py-2.5 bg-[#161A24] hover:bg-[#1C212E] border-b border-[#252C3B] flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#00C2FF]/15 border border-[#00C2FF]/40 text-[#00C2FF] flex items-center justify-center shrink-0">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-xs sm:text-[13px] font-extrabold text-white truncate flex items-center gap-1.5">
                  <span>{t('Match Statistics', '对局数据统计')}</span>
                  {isCardGameSelected && (
                    <span className="text-[10px] font-mono font-bold text-[#10D98B]">
                      · {t('CARD LIVE', '卡牌实时')}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[#9CA3AF] font-mono tabular-nums truncate">
                  {t('Matches', '场次')} {totalSessionMatches} ·{' '}
                  {isCardGameSelected ? t('Card Acts', '卡牌操作') : t('Actions', '总操作')}{' '}
                  {isCardGameSelected ? totalCardActions : totalSessionActions} ·{' '}
                  {t('Avg Resp', '平均响应')} {formatResponseTime(roomAvgCardResponseMs)}
                </div>
              </div>
            </div>

            <span className="h-6 w-6 rounded-md bg-[#242A36] text-[#D1D5DB] flex items-center justify-center shrink-0">
              {matchStatsExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </span>
          </button>

          {/* Expanded Telemetry Table */}
          {matchStatsExpanded && (
            <div className="p-2.5 sm:p-3 space-y-2">
              {/* Column Headers */}
              <div className="grid grid-cols-12 items-center px-2 text-[10px] font-bold text-[#9CA3AF]">
                <div className="col-span-5">{t('Player', '玩家')}</div>
                <div className="col-span-2 text-right">{t('Wins', '胜场')}</div>
                <div className="col-span-2 text-right">{t('Actions', '操作')}</div>
                <div className="col-span-3 text-right">{t('Avg Resp', '平均响应')}</div>
              </div>

              {/* Player Performance Rows */}
              <div className="space-y-1 max-h-[196px] overflow-y-auto arcade-scrollbar pr-0.5">
                {sortedStatsPlayers.map((p) => {
                  const st = p.matchStats ?? {
                    wins: 0,
                    cardWins: 0,
                    matchesPlayed: 0,
                    totalActions: 0,
                    cardActions: 0,
                    cardResponses: 0,
                    totalCardResponseMs: 0,
                    avgCardResponseMs: null,
                    lastCardResponseMs: null,
                    fastestCardResponseMs: null,
                  };
                  const isOnCardClock =
                    room.status === 'PLAYING' &&
                    isCardGameSelected &&
                    ((room.selectedGameId === 'color-clash' &&
                      liveTurnInfo.activePlayerId === p.id) ||
                      (room.selectedGameId === 'liars-deck' &&
                        ((liveTurnInfo.phase === 'selecting' &&
                          liveTurnInfo.activePlayerId === p.id) ||
                          (liveTurnInfo.phase === 'challenge' &&
                            liveTurnInfo.lastClaimPlayerId !== p.id))));

                  const actionCount = isCardGameSelected ? st.cardActions : st.totalActions;
                  const respColor =
                    st.avgCardResponseMs === null
                      ? 'text-[#6B7280]'
                      : st.avgCardResponseMs <= 2200
                      ? 'text-[#10D98B]'
                      : st.avgCardResponseMs <= 4800
                      ? 'text-[#00C2FF]'
                      : 'text-[#FFB800]';

                  return (
                    <div
                      key={p.id}
                      className={`grid grid-cols-12 items-center px-2 py-1.5 rounded-xl border text-xs transition-colors ${
                        isOnCardClock
                          ? 'bg-[#102421] border-[#10D98B]/60'
                          : 'bg-[#161A23] border-[#232A38]'
                      }`}
                    >
                      {/* Player Name + Active Turn Clock */}
                      <div className="col-span-5 flex items-center gap-1.5 min-w-0 pr-1">
                        <span
                          className="w-5 h-5 rounded font-mono text-[10px] font-black flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: p.color.hex,
                            color: p.color.textOnColor,
                          }}
                        >
                          P{p.slotIndex + 1}
                        </span>
                        {p.isBot && <Bot className="w-3 h-3 text-[#00C2FF] shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-white text-[11px] truncate">
                            {p.name}
                          </div>
                          {isOnCardClock && (
                            <div className="text-[9px] font-mono font-bold text-[#10D98B] inline-flex items-center gap-0.5 tabular-nums">
                              <Clock className="w-2.5 h-2.5" />
                              <span>
                                {t('Turn', '思考')} {liveTurnInfo.turnElapsedSec.toFixed(1)}s
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Wins */}
                      <div className="col-span-2 text-right font-mono tabular-nums">
                        <span className="font-extrabold text-[#FFB800] text-xs">
                          {st.wins}
                        </span>
                        {st.cardWins > 0 && (
                          <div className="text-[9px] text-[#9CA3AF]">
                            {t(`Card ${st.cardWins}`, `卡牌 ${st.cardWins}`)}
                          </div>
                        )}
                      </div>

                      {/* Total Actions */}
                      <div className="col-span-2 text-right font-mono tabular-nums">
                        <span className="font-bold text-white text-xs">{actionCount}</span>
                        {!isCardGameSelected && st.cardActions > 0 && (
                          <div className="text-[9px] text-[#00C2FF]">
                            {t(`Card ${st.cardActions}`, `牌 ${st.cardActions}`)}
                          </div>
                        )}
                      </div>

                      {/* Avg Response Time during Card Games */}
                      <div className="col-span-3 text-right font-mono tabular-nums">
                        <div className={`font-extrabold text-xs ${respColor}`}>
                          {formatResponseTime(st.avgCardResponseMs)}
                        </div>
                        {st.lastCardResponseMs !== null ? (
                          <div className="text-[9px] text-[#9CA3AF]">
                            {t('Last', '最近')} {formatResponseTime(st.lastCardResponseMs)}
                          </div>
                        ) : (
                          <div className="text-[9px] text-[#6B7280]">
                            {t('Card Avg', '卡牌均时')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    ) : null;

  // Shared floating Kahoot-style live reaction overlay + Host Transfer / Lock Toast + Persistent Match Statistics
  const floatingEmoteOverlay = (
    <>
      {persistentMatchStatsOverlay}
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

      <AnimatePresence>
        {closeConfirmOpen && (
          <div className="fixed inset-0 z-[80] bg-[#0B0D12]/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.16 }}
              className="max-w-md w-full rounded-2xl bg-[#1A1E26] border-2 border-[#FF4D2E]/60 p-6 shadow-2xl text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 text-[#FF4D2E] flex items-center justify-center mx-auto">
                <Power className="w-6 h-6" />
              </div>
              <h3 className="mt-3 font-display text-xl font-extrabold text-white">
                {t('Close Entire Game Room?', '确定彻底关闭游戏房间？')}
              </h3>
              <p className="mt-1.5 text-sm text-[#A5AEBD] leading-relaxed">
                {t(
                  `This will permanently end Room ${room.code} and disconnect all connected players.`,
                  `房间 ${room.code} 将立即永久关闭，所有已连接玩家的会话都会结束。`
                )}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setCloseConfirmOpen(false)}
                  className="h-11 px-5 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-sm font-bold text-white cursor-pointer"
                >
                  {t('Cancel', '取消')}
                </button>
                <button
                  type="button"
                  onClick={confirmCloseRoom}
                  disabled={isClosingRoom}
                  className="tactile-btn h-11 px-5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-sm font-extrabold text-white shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 cursor-pointer"
                >
                  <Power className="w-4 h-4" />
                  <span>{t('Close Room', '关闭房间')}</span>
                </button>
              </div>
            </motion.div>
          </div>
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
      <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#121419] text-[#F4F6FA] flex flex-col relative">
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
          <div className="max-w-[1380px] mx-auto px-3 sm:px-6 min-h-16 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
              <button
                type="button"
                onClick={handleLeaveHost}
                className="min-h-[38px] sm:min-h-[40px] px-2.5 sm:px-3 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#2F3747] text-xs sm:text-sm font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('Home', '首页')}
              </button>
              <span className="font-display text-sm sm:text-lg font-extrabold text-white truncate">
                {t('JoinStick Party Stage', 'JoinStick 派对舞台')}
              </span>
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-[#9CA3AF] shrink-0">
                <span
                  className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#10D98B]' : 'bg-[#FFB800]'}`}
                />
                {wsConnected ? t('Live Room Open', '房间已开启') : t('Reconnecting...', '正在重连...')}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
              {audioUnlockButton}
              <LanguageToggle compact className="h-9 sm:h-10 sm:px-3" />

              <button
                type="button"
                onClick={() => setTestDrawerOpen((v) => !v)}
                className={`tactile-btn h-9 sm:h-10 px-2.5 sm:px-4 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  testDrawerOpen
                    ? 'bg-[#00C2FF] text-[#0B1219]'
                    : 'bg-[#1E232D] hover:bg-[#242A36] text-white border border-[#2F3747]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span className="hidden sm:inline">{t('Test Controller', '测试手柄')}</span>
                <span className="sm:hidden">{t('Test', '测试')}</span>
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? t('Unmute audio', '取消静音') : t('Mute audio', '静音')}
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#2F3747] text-white flex items-center justify-center cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={toggleMonitorFullscreen}
                aria-label={
                  isMonitorFullscreen
                    ? t('Exit fullscreen', '退出全屏')
                    : t('Enter fullscreen', '进入全屏')
                }
                title={
                  isMonitorFullscreen
                    ? t('Exit Fullscreen', '退出全屏')
                    : t('Fullscreen Mode', '全屏模式')
                }
                className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-[#1E232D] hover:bg-[#242A36] border border-[#2F3747] text-white flex items-center justify-center cursor-pointer"
              >
                {isMonitorFullscreen ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={handleRequestCloseRoom}
                className="h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-xs sm:text-sm font-bold text-[#FF9B8A] hover:text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                <Power className="w-4 h-4" />
                <span>{t('Close Room', '关闭房间')}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Kahoot-Style Party Stage */}
        <main className="relative z-10 flex-1 max-w-[1380px] w-full mx-auto px-4 sm:px-6 py-5 sm:py-7 flex flex-col gap-5 sm:gap-6">
          {/* HERO JOIN PIN + QR BANNER */}
          <section className="rounded-3xl bg-[#1A1E26] border-2 border-[#2A303D] shadow-2xl p-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
              {/* Left: Join instructions & quick links */}
              <div className="md:col-span-5 lg:col-span-4 space-y-3 text-center md:text-left">
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
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1">
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
              <div className="md:col-span-4 lg:col-span-5 flex flex-col items-center justify-center">
                <div className="w-full max-w-md rounded-2xl bg-white text-[#121419] px-5 py-5 shadow-[0_8px_0_rgba(0,0,0,0.35)] text-center">
                  <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#FF4D2E]">
                    {t('Game PIN', '房间码 PIN')}
                  </div>
                  <div className="mt-1 font-mono text-4xl sm:text-5xl lg:text-6xl font-black tracking-[0.22em] sm:tracking-[0.26em] text-[#121419] tabular-nums pl-[0.22em] sm:pl-[0.26em]">
                    {room.code}
                  </div>
                </div>
              </div>

              {/* Right: Crisp Big QR Card */}
              <div className="md:col-span-3 flex justify-center md:justify-end">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                                : !player.connected
                                ? t('Disconnected · Reconnecting...', '已断开 · 等待重连中...')
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

  const activeMutatorSpec = getMutatorSpec(room.activeMutator);

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
      <div className="fixed inset-0 h-dvh w-full bg-[#121419] text-[#F4F6FA] flex flex-col overflow-hidden select-none">
        {floatingEmoteOverlay}

        {/* Slim Fullscreen TV Console Header */}
        <header className="h-14 border-b border-[#242934] bg-[#151820] px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <span className="font-display text-base sm:text-lg font-extrabold text-white truncate">
              {t('JoinStick Game Room', 'JoinStick 游戏厅')}
            </span>
            <span className="text-xs font-mono text-[#9CA3AF] whitespace-nowrap shrink-0">
              PIN <strong className="text-white">{room.code}</strong> · {room.players.length}/
              {MAX_PLAYERS_PER_ROOM} {t('Players', '人')}
            </span>
          </div>

          {/* Center Host Remote Lock Indicator (shown inline on wide screens, compact on tablets) */}
          <div className="hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1A1E26] border border-[#FFB800]/55 text-xs font-bold text-[#FFB800] whitespace-nowrap">
            {!wsConnected ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-[#FF4D2E] shrink-0" />
                <span className="text-[#FF9B8A]">
                  {t('Server Reconnecting...', '服务器重连中...')}
                </span>
              </>
            ) : activeHostPlayer ? (
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
                  {humans.length > 0 && connectedHumans.length === 0
                    ? t(
                        'Controller Disconnected · Mouse Control Active',
                        '手机手柄已断开 · 已开启鼠标控制'
                      )
                    : t(
                        'Bot-Only Spectator Mode · Mouse Control Active',
                        '纯机器人观战模式 · 可直接用鼠标控制'
                      )}
                </span>
              </>
            )}
          </div>

          {/* Passive Display Utilities Only (Audio Unlock, Language, Match Stats, Fullscreen, Audio, Test Pad) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {audioUnlockButton}
            <LanguageToggle compact className="h-9" />

            <button
              type="button"
              onClick={() => setMatchStatsExpanded((v) => !v)}
              title={t('Toggle Match Statistics Overlay', '展开/收起对局数据统计')}
              className={`h-9 px-2.5 xl:px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                matchStatsExpanded
                  ? 'bg-[#00C2FF]/20 border border-[#00C2FF]/55 text-[#00C2FF]'
                  : 'bg-[#242A36] hover:bg-[#2E3646] text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{t('Stats', '数据统计')}</span>
            </button>

            <button
              type="button"
              onClick={() => setTestDrawerOpen((v) => !v)}
              title={t('Test Remote', '测试遥控器')}
              className={`h-9 px-2.5 xl:px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                testDrawerOpen
                  ? 'bg-[#00C2FF] text-[#0B1219]'
                  : 'bg-[#242A36] hover:bg-[#2E3646] text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{t('Test Remote', '测试遥控器')}</span>
              <span className="hidden sm:inline xl:hidden">{t('Test', '测试')}</span>
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
              className={`h-9 px-2.5 xl:px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
              <span className="hidden xl:inline">
                {isMonitorFullscreen ? t('Exit Full', '退出全屏') : t('Fullscreen', '全屏')}
              </span>
            </button>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? t('Unmute audio', '取消静音') : t('Mute audio', '静音')}
              className="h-9 w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleRequestCloseRoom}
              title={t('Close Entire Room', '关闭整个房间')}
              className="h-9 px-2.5 xl:px-3 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-xs font-bold text-[#FF9B8A] hover:text-white inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('Close Room', '关闭房间')}</span>
            </button>
          </div>
        </header>

        {/* Main Fullscreen Console Body (Tablet-Responsive Side-by-Side Split) */}
        <main className="flex-1 min-h-0 px-3 sm:px-5 py-3 sm:py-4 grid grid-cols-1 md:grid-cols-12 gap-3.5 sm:gap-4 xl:gap-5 overflow-hidden">
          {/* LEFT / CENTER (7-8 cols): Filter Bar + Spacious Responsive TV Game Grid */}
          <section className="md:col-span-7 lg:col-span-8 flex flex-col min-h-0 gap-2.5 sm:gap-3">
            {/* Row 0: Filter Bar (zone === 'filter') */}
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div
                role="tablist"
                aria-label={t('Filter games by player count', '按游玩人数筛选游戏')}
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#101217] border border-[#262C39]"
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
                            type: 'lobby:filter',
                            filter: opt.id,
                          })
                        )
                      }
                      className={`px-2.5 xl:px-3.5 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap transition-all border ${
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

              <div className="text-xs text-[#9CA3AF] font-medium whitespace-nowrap hidden xl:block">
                {t('Use Host Remote', '房主遥控器')}{' '}
                <strong className="text-white">▲ ▼ ◀ ▶</strong> {t('to browse ·', '浏览 ·')}{' '}
                <strong className="text-[#FFB800]">OK</strong> {t('to select', '确认')}
              </div>
            </div>

            {/* Row 1..N: Responsive Cartridge Grid (2 cols on tablet portrait, 3 on tablet landscape, 4 on wide desktop) */}
            <div className="flex-1 min-h-0 overflow-y-auto arcade-scrollbar pr-2 py-1">
              <div
                ref={gamesGridRef}
                className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5"
              >
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
                            loading="lazy"
                            decoding="async"
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
                        <span
                          className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded font-mono text-[9px] font-extrabold uppercase tracking-wider shadow ${
                            getGameGenre(game.id) === 'board'
                              ? 'bg-[#A855F7]/90 text-white'
                              : getGameGenre(game.id) === 'card'
                              ? 'bg-[#10D98B]/90 text-[#071710]'
                              : 'bg-[#101217]/85 text-[#00C2FF] border border-[#00C2FF]/35'
                          }`}
                        >
                          {getLocalizedFilterLabel(getGameGenre(game.id), lang, true)}
                        </span>
                        {isRemoteFocused && (
                          <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-[#FFB800] text-[#14120B] font-mono text-[10px] font-black shadow">
                            OK
                          </span>
                        )}
                      </div>
                      <div className="p-2.5 sm:p-3 flex-1 flex flex-col justify-between">
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

          {/* RIGHT PANEL (5 cols tablet portrait / 4 cols landscape): Spotlight + Live Ready Check */}
          <section className="md:col-span-5 lg:col-span-4 flex flex-col min-h-0 gap-3 overflow-hidden">
            {/* Compact Tablet Remote Indicator */}
            <div className="xl:hidden flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#1A1E26] border border-[#282E3B] text-[11px] font-bold shrink-0">
              {!wsConnected ? (
                <span className="inline-flex items-center gap-1.5 text-[#FF9B8A] truncate">
                  <WifiOff className="w-3.5 h-3.5 text-[#FF4D2E] shrink-0" />
                  <span>{t('Server Reconnecting...', '服务器重连中...')}</span>
                </span>
              ) : activeHostPlayer ? (
                <span className="inline-flex items-center gap-1.5 text-[#FFB800] truncate">
                  <Crown className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {t('Host Remote:', '当前房主：')}{' '}
                    <strong className="text-white">{activeHostPlayer.name}</strong>
                  </span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-[#00C2FF] truncate">
                  <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t('Mouse Control Active', '鼠标控制已开启')}</span>
                </span>
              )}
              <Lock className="w-3 h-3 text-[#9CA3AF] shrink-0" />
            </div>

            {/* Highlighted Game Card */}
            <div className="rounded-2xl bg-[#1A1E26] border border-[#282E3B] p-3.5 sm:p-4 shrink-0">
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

              {/* Active Chaos Mutator Strip */}
              <div
                onClick={() => guardHostOnlyClick(() => setChaosWheelOpen(true))}
                className={`mt-2.5 rounded-xl px-2.5 py-2 border flex items-center justify-between gap-2 transition-colors ${
                  room.activeMutator !== 'normal'
                    ? 'bg-[#101217]'
                    : 'bg-[#101217]/70 border-[#242934]'
                } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer hover:border-[#3A4356]'}`}
                style={
                  room.activeMutator !== 'normal'
                    ? { borderColor: `${activeMutatorSpec.accentHex}88` }
                    : undefined
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Dices
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: activeMutatorSpec.accentHex }}
                  />
                  <span className="text-[11px] font-bold text-[#9CA3AF] shrink-0">
                    {t('Rule:', '规则:')}
                  </span>
                  <span
                    className="text-xs font-extrabold truncate"
                    style={{ color: activeMutatorSpec.accentHex }}
                  >
                    {lang === 'zh' ? activeMutatorSpec.nameZh : activeMutatorSpec.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#9CA3AF] shrink-0">
                  {t('Chaos Wheel', '轮盘')}
                </span>
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-[#262C38] grid grid-cols-2 gap-2 text-xs">
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

              <div className="flex-1 min-h-0 overflow-y-auto arcade-scrollbar space-y-1.5 pr-1">
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

        {/* Bottom TV Remote Action Dock (zone === 'actions', indices 0..6) */}
        <footer className="border-t border-[#242934] bg-[#151820] px-3 sm:px-5 py-2.5 sm:py-3 shrink-0">
          <div ref={actionsGridRef} className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
            {/* Action 0: Start / Open Game */}
            <button
              type="button"
              onClick={() => guardHostOnlyClick(handleStartMatch)}
              className={`h-11 sm:h-12 px-3 rounded-xl font-display font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap ${
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
                  : t('Waiting Ready', '等待全员准备')}
              </span>
            </button>

            {/* Action 1: 5-Game Party Tournament */}
            <button
              type="button"
              onClick={() => guardHostOnlyClick(handleStartTournament)}
              className={`h-11 sm:h-12 px-3 rounded-xl font-display font-extrabold text-xs inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap ${
                focus.zone === 'actions' && focus.index === 1
                  ? `bg-[#FFB800] text-[#14120B] ${tvFocusRing}`
                  : canStartMatch
                  ? 'bg-[#2B2412] hover:bg-[#3A2F15] text-[#FFB800] border-[#FFB800]/60'
                  : 'bg-[#1E232D] text-[#9CA3AF] border-[#2F3747]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <Trophy className="w-4 h-4 shrink-0" />
              <span className="truncate">{t('5-Game Cup', '5局锦标赛')}</span>
            </button>

            {/* Action 2: Chaos Wheel Mutator */}
            <button
              type="button"
              onClick={() => guardHostOnlyClick(() => setChaosWheelOpen(true))}
              className={`h-11 sm:h-12 px-3 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap ${
                focus.zone === 'actions' && focus.index === 2
                  ? `bg-[#242A36] text-white ${tvFocusRing}`
                  : room.activeMutator !== 'normal'
                  ? 'bg-[#1E232D] text-white'
                  : 'bg-[#1E232D] text-[#D1D5DB] border-[#2F3747]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
              style={
                focus.zone === 'actions' && focus.index === 2
                  ? undefined
                  : room.activeMutator !== 'normal'
                  ? { borderColor: activeMutatorSpec.accentHex }
                  : undefined
              }
            >
              <Dices
                className="w-4 h-4 shrink-0"
                style={{ color: activeMutatorSpec.accentHex }}
              />
              <span
                className="truncate"
                style={
                  room.activeMutator !== 'normal'
                    ? { color: activeMutatorSpec.accentHex }
                    : undefined
                }
              >
                {room.activeMutator === 'normal'
                  ? t('Chaos Wheel', '混沌轮盘')
                  : lang === 'zh'
                  ? activeMutatorSpec.shortTagZh
                  : activeMutatorSpec.shortTag}
              </span>
            </button>

            {/* Action 3: Cycle Match Setting */}
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
              className={`h-11 sm:h-12 px-3 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap ${
                focus.zone === 'actions' && focus.index === 3
                  ? `bg-[#242A36] text-white ${tvFocusRing}`
                  : 'bg-[#1E232D] text-[#D1D5DB] border-[#2F3747]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className="text-[#9CA3AF] truncate">{selectedGame.settingLabel}:</span>
              <span className="text-[#FFB800] font-mono shrink-0">
                {activeSettingOpt?.label ?? room.gameSettingValue}
              </span>
            </button>

            {/* Action 4: + Add Robot */}
            <button
              type="button"
              onClick={() => guardHostOnlyClick(handleAddBot)}
              disabled={isRoomFull && !isScreenRemoteLocked}
              className={`h-11 sm:h-12 px-3 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap ${
                focus.zone === 'actions' && focus.index === 4
                  ? `bg-[#00C2FF] text-[#0B1219] ${tvFocusRing}`
                  : 'bg-[#1E232D] text-[#00C2FF] border-[#2F3747]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <Bot className="w-4 h-4 shrink-0" />
              <span className="truncate">
                {isRoomFull ? t('Room Full', '房间已满') : t('Add Robot', '添加机器人')}
              </span>
            </button>

            {/* Action 5: Cycle Bot Difficulty */}
            <button
              type="button"
              onClick={() =>
                guardHostOnlyClick(() => handleSetBotDifficulty(NEXT_DIFFICULTY[room.botDifficulty]))
              }
              className={`h-11 sm:h-12 px-3 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap ${
                focus.zone === 'actions' && focus.index === 5
                  ? `bg-[#242A36] text-white ${tvFocusRing}`
                  : 'bg-[#1E232D] text-[#D1D5DB] border-[#2F3747]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <span className="text-[#9CA3AF] truncate">{t('Bot:', 'AI:')}</span>
              <span style={{ color: difficultyColor(room.botDifficulty) }}>
                {getLocalizedDifficulty(room.botDifficulty, lang).label}
              </span>
            </button>

            {/* Action 6: Back to Room Setup / QR */}
            <button
              type="button"
              onClick={() => guardHostOnlyClick(handleReturnSetup)}
              className={`h-11 sm:h-12 px-3 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 border-2 transition-all whitespace-nowrap col-span-2 sm:col-span-1 ${
                focus.zone === 'actions' && focus.index === 6
                  ? `bg-[#242A36] text-white ${tvFocusRing}`
                  : 'bg-[#1E232D] text-[#D1D5DB] border-[#2F3747]'
              } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <QrCode className="w-4 h-4 text-[#00C2FF] shrink-0" />
              <span className="truncate">{t('Room Setup / QR', '房间设置 / 扫码')}</span>
            </button>
          </div>
        </footer>

        <ChaosWheelModal
          open={chaosWheelOpen}
          activeMutator={room.activeMutator}
          spinSeq={room.mutatorSpinSeq}
          remoteLocked={isScreenRemoteLocked}
          hostName={activeHostPlayer?.name}
          onSpin={() => guardHostOnlyClick(handleSpinMutator)}
          onSelectMutator={(id) => guardHostOnlyClick(() => handleSetMutator(id))}
          onClose={() => {
            if (wheelAutoCloseTimerRef.current) clearTimeout(wheelAutoCloseTimerRef.current);
            setChaosWheelOpen(false);
          }}
        />

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
  const activeTournament = room.tournament?.active ? room.tournament : null;
  const frenzyPerks = GAME_FRENZY_PERKS[room.selectedGameId];

  return (
    <div className="h-dvh w-full bg-[#121419] text-[#F4F6FA] flex flex-col overflow-hidden relative">
      {floatingEmoteOverlay}

      {/* Streamlined Top Control Header (Never Crushes Player Stats) */}
      <header className="h-12 sm:h-13 border-b border-[#242934] bg-[#151820] px-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          {activeTournament && (
            <span className="h-7 px-2 rounded-lg bg-[#FFB800]/18 border border-[#FFB800]/55 text-[#FFB800] font-mono text-[11px] font-black inline-flex items-center gap-1 shrink-0">
              <Trophy className="w-3.5 h-3.5" />
              <span>
                {activeTournament.currentGameIndex + 1}/{activeTournament.totalGames}
              </span>
            </span>
          )}
          <span className="font-display font-extrabold text-sm sm:text-base text-white truncate">
            {selectedGame.name}
          </span>
          {room.activeMutator !== 'normal' && (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#101217] border text-[10px] font-mono font-black shrink-0"
              style={{
                borderColor: `${activeMutatorSpec.accentHex}88`,
                color: activeMutatorSpec.accentHex,
              }}
            >
              {lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}
            </span>
          )}
          {room.frenzy.active && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FF4D2E]/25 border border-[#FF4D2E] text-[#FF9B8A] font-mono text-[10px] font-black shrink-0 animate-pulse">
              <Flame className="w-3 h-3 text-[#FFB800]" />
              <span>{t('FRENZY 2×', '狂热 2×')}</span>
            </span>
          )}
          <span className="text-xs font-mono text-[#9CA3AF] whitespace-nowrap shrink-0">
            · PIN <strong className="text-white">{room.code}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!wsConnected && (
            <span className="h-8 px-2.5 rounded-lg bg-[#FF4D2E]/20 border border-[#FF4D2E]/50 text-[#FF9B8A] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap">
              <WifiOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('Reconnecting...', '重连中...')}</span>
            </span>
          )}
          {wsConnected && !activeHostPlayer && (
            <span className="hidden xl:inline-flex h-8 px-2.5 rounded-lg bg-[#00C2FF]/15 border border-[#00C2FF]/40 text-[#00C2FF] text-xs font-bold items-center gap-1.5 whitespace-nowrap">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>{t('Mouse Control', '鼠标控制')}</span>
            </span>
          )}
          {audioUnlockButton}
          <LanguageToggle compact className="h-8" />

          <button
            type="button"
            onClick={() => setMatchStatsExpanded((v) => !v)}
            title={t('Toggle Match Statistics', '展开/收起对局统计')}
            aria-label={t('Toggle Match Statistics', '展开/收起对局统计')}
            className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              matchStatsExpanded
                ? 'bg-[#00C2FF]/20 border border-[#00C2FF]/55 text-[#00C2FF]'
                : 'bg-[#242A36] hover:bg-[#2E3646] text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">{t('Stats', '统计')}</span>
          </button>

          <button
            type="button"
            onClick={() => setTestDrawerOpen((v) => !v)}
            title={t('Test Pad', '测试手柄')}
            aria-label={t('Test Pad', '测试手柄')}
            className={`h-8 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              testDrawerOpen
                ? 'bg-[#00C2FF] text-[#0B1219]'
                : 'bg-[#242A36] hover:bg-[#2E3646] text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{t('Test Pad', '测试手柄')}</span>
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
            title={room.status === 'PAUSED' ? t('Resume', '继续') : t('Pause', '暂停')}
            className="h-8 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] disabled:opacity-40 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            {room.status === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {room.status === 'PAUSED' ? t('Resume', '继续') : t('Pause', '暂停')}
            </span>
          </button>

          <button
            type="button"
            onClick={toggleMonitorFullscreen}
            aria-label={
              isMonitorFullscreen ? t('Exit fullscreen', '退出全屏') : t('Enter fullscreen', '进入全屏')
            }
            className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
          >
            {isMonitorFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? t('Unmute audio', '取消静音') : t('Mute audio', '静音')}
            className="h-8 w-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() =>
              guardHostOnlyClick(() => wsRef.current?.send({ type: 'game:return-lobby' }))
            }
            className="h-8 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] whitespace-nowrap cursor-pointer"
          >
            {t('Game Room', '游戏厅')}
          </button>

          <button
            type="button"
            onClick={handleRequestCloseRoom}
            title={t('Close Entire Room', '关闭整个房间')}
            aria-label={t('Close Entire Room', '关闭整个房间')}
            className="h-8 w-8 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-[#FF9B8A] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <Power className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Redesigned Always-Visible Live Game Stats Bar (Visible across ALL screen sizes for every game!) */}
      {(() => {
        const maxLiveScore = room.players.reduce((m, p) => Math.max(m, p.score), 0);
        return (
          <div className="border-b border-[#242934] bg-[#10131A]/95 px-2.5 sm:px-5 py-1.5 shrink-0">
            <div className="max-w-[1440px] mx-auto grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-wrap items-center justify-center gap-1.5 sm:gap-2">
              {room.players.map((p) => {
                const isLeader = maxLiveScore > 0 && p.score === maxLiveScore;
                const isTurnActive =
                  room.status === 'PLAYING' && liveTurnInfo.activePlayerId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`px-2.5 py-1 rounded-lg border flex items-center justify-between lg:justify-start gap-2 text-xs whitespace-nowrap transition-all ${
                      !p.alive
                        ? 'bg-[#14171F]/60 border-[#222733] opacity-50'
                        : isTurnActive
                        ? 'bg-[#102622] border-[#10D98B] shadow-[0_0_12px_rgba(16,217,139,0.22)]'
                        : isLeader
                        ? 'bg-[#221D11] border-[#FFB800]/65'
                        : 'bg-[#171B24] border-[#262D3D]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-5 h-5 rounded font-mono text-[10px] font-black flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: p.color.hex,
                          color: p.color.textOnColor,
                        }}
                      >
                        P{p.slotIndex + 1}
                      </span>
                      {p.isBot && <Bot className="w-3 h-3 text-[#00C2FF] shrink-0" />}
                      {isLeader && <Crown className="w-3 h-3 text-[#FFB800] shrink-0" />}
                      <span className="font-bold text-white truncate max-w-[82px] sm:max-w-[112px]">
                        {p.name}
                      </span>
                      {!p.isBot && !p.connected && (
                        <span className="text-[10px] font-bold text-[#FFB800]">
                          ({t('Offline', '离线')})
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span aria-hidden="true" className="text-[#4B5563] hidden lg:inline">
                        ·
                      </span>
                      <span
                        className={`font-mono text-[11px] sm:text-xs font-extrabold tabular-nums ${
                          isTurnActive
                            ? 'text-[#10D98B]'
                            : isLeader
                            ? 'text-[#FFB800]'
                            : 'text-[#00C2FF]'
                        }`}
                      >
                        {translateGameText(p.statText, lang)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Center Responsive 16:9 Arena Stage */}
      <div className="flex-1 min-h-0 relative flex items-center justify-center p-2 sm:p-4 xl:p-5 overflow-hidden">
        <div className="relative w-full h-full max-w-[1280px] flex items-center justify-center">
          <canvas
            ref={canvasRef}
            width={ARENA_WIDTH}
            height={ARENA_HEIGHT}
            className={`max-w-full max-h-full aspect-[5/3] rounded-2xl shadow-2xl bg-[#101217] transition-all duration-300 ${
              room.frenzy.active
                ? 'border-2 border-[#FF5E1A] shadow-[0_0_45px_rgba(255,77,46,0.45)]'
                : 'border border-[#282E3B]'
            }`}
          />

          {/* Active Frenzy Fiery Edge Vignette */}
          {room.status === 'PLAYING' && room.frenzy.active && !room.frenzy.freezing && (
            <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-[#FF5E1A]/75 shadow-[inset_0_0_65px_rgba(255,77,46,0.34)] z-10 animate-pulse" />
          )}

          {/* Sequential 3.0-Second Fire Frenzy Fly-Through Overlay (Right -> Left) */}
          <AnimatePresence>
            {room.status === 'PLAYING' && room.frenzy.freezing && (
              <motion.div
                key={`frenzy-overlay-${room.frenzy.triggerCount}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(255,88,20,0.38)_0%,rgba(14,7,9,0.86)_75%)] backdrop-blur-[2px] border-4 border-[#FF5E1A] shadow-[inset_0_0_90px_rgba(255,77,46,0.5)]"
              >
                {/* Blazing Horizontal Fire Streak Lines Sweeping Right -> Left */}
                {[
                  { top: '14%', h: 'h-1', color: 'from-transparent via-[#FF8A00] to-transparent', dur: 0.75, delay: 0 },
                  { top: '27%', h: 'h-1.5', color: 'from-transparent via-[#FFE066] to-transparent', dur: 0.62, delay: 0.18 },
                  { top: '48%', h: 'h-2', color: 'from-transparent via-[#FF4D2E] to-transparent', dur: 0.7, delay: 0.08 },
                  { top: '69%', h: 'h-1.5', color: 'from-transparent via-[#FFB800] to-transparent', dur: 0.65, delay: 0.3 },
                  { top: '84%', h: 'h-1', color: 'from-transparent via-[#FF5E1A] to-transparent', dur: 0.72, delay: 0.12 },
                ].map((streak, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ x: '110%', opacity: 0 }}
                    animate={{ x: ['110%', '-110%'], opacity: [0, 0.9, 0.9, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: streak.dur,
                      delay: streak.delay,
                      ease: 'linear',
                    }}
                    style={{ top: streak.top }}
                    className={`absolute left-0 w-2/3 ${streak.h} bg-gradient-to-r ${streak.color} blur-[1px]`}
                  />
                ))}

                {/* Animated Rising & Wind-Swept Fire Ember Particles */}
                {Array.from({ length: 16 }).map((_, i) => (
                  <motion.span
                    key={i}
                    initial={{
                      y: 190 - (i % 3) * 45,
                      x: 420 + (i % 4) * 90,
                      opacity: 0,
                      scale: 0.6,
                    }}
                    animate={{
                      y: -200,
                      x: -460 - (i % 3) * 80,
                      opacity: [0, 1, 0.95, 0],
                      scale: [0.6, 1.4, 0.65],
                    }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.95 + (i % 4) * 0.2,
                      delay: (i % 6) * 0.12,
                      ease: 'easeOut',
                    }}
                    className={`absolute rounded-full ${
                      i % 3 === 0
                        ? 'w-3.5 h-3.5 bg-[#FFB800] shadow-[0_0_16px_#FFB800]'
                        : i % 3 === 1
                        ? 'w-2.5 h-2.5 bg-[#FF4D2E] shadow-[0_0_14px_#FF4D2E]'
                        : 'w-2 h-2 bg-[#FFF3B0] shadow-[0_0_12px_#FFF3B0]'
                    }`}
                  />
                ))}

                {/* STAGE 1 (First): FRENZY MODE! Sweeps in from Right -> Holds Center -> Exits Left */}
                <motion.div
                  key={`frenzy-stage1-${room.frenzy.triggerCount}`}
                  initial={{ x: '105%', opacity: 0, scale: 0.92 }}
                  animate={{
                    x: ['105%', '0%', '0%', '-105%'],
                    opacity: [0, 1, 1, 0],
                    scale: [0.92, 1.04, 1.0, 0.92],
                  }}
                  transition={{
                    duration: 1.42,
                    times: [0, 0.16, 0.78, 1],
                    ease: ['easeOut', 'linear', 'easeIn'],
                  }}
                  className="absolute inset-0 flex items-center justify-center px-4"
                >
                  <div className="relative max-w-2xl w-[92%] rounded-3xl bg-gradient-to-r from-[#2D0D09]/95 via-[#43140A]/96 to-[#1D0B0E]/95 border-2 border-[#FF8A00] px-6 py-7 sm:px-10 sm:py-9 text-center shadow-[0_0_80px_rgba(255,77,46,0.85)]">
                    {/* Trailing Fire Tail on the Right Edge */}
                    <div className="pointer-events-none absolute -right-14 inset-y-4 w-20 bg-gradient-to-l from-transparent via-[#FF5E1A]/45 to-[#FFB800]/65 blur-xl rounded-full" />
                    <div className="pointer-events-none absolute -left-8 inset-y-6 w-14 bg-gradient-to-r from-transparent to-[#FF4D2E]/50 blur-lg rounded-full" />

                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FF4D2E]/30 border border-[#FFB800]/75 text-[#FFE066] font-mono text-xs sm:text-sm font-black tracking-widest uppercase shadow-[0_0_20px_rgba(255,138,0,0.45)]">
                      <Flame className="w-4 h-4 text-[#FFB800] animate-pulse" />
                      <span>{t('FINAL STRETCH · OVERDRIVE UNLOCKED', '终局高能时刻 · 全场沸腾')}</span>
                      <Flame className="w-4 h-4 text-[#FFB800] animate-pulse" />
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-3 sm:gap-4">
                      <Flame className="w-10 h-10 sm:w-12 sm:h-12 text-[#FFB800] drop-shadow-[0_0_18px_#FF5E1A] shrink-0 animate-pulse" />
                      <h2 className="font-display text-4xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFF7CC] via-[#FFB800] to-[#FF4D2E] drop-shadow-[0_4px_24px_rgba(255,77,46,0.95)]">
                        {t('FRENZY MODE!', '烈焰狂热模式！')}
                      </h2>
                      <Flame className="w-10 h-10 sm:w-12 sm:h-12 text-[#FFB800] drop-shadow-[0_0_18px_#FF5E1A] shrink-0 animate-pulse" />
                    </div>
                  </div>
                </motion.div>

                {/* STAGE 2 (Follows): SPECIAL FEATURES Sweeps in from Right -> Holds Center -> Exits Left */}
                <motion.div
                  key={`frenzy-stage2-${room.frenzy.triggerCount}`}
                  initial={{ x: '105%', opacity: 0, scale: 0.92 }}
                  animate={{
                    x: ['105%', '0%', '0%', '-105%'],
                    opacity: [0, 1, 1, 0],
                    scale: [0.92, 1.03, 1.0, 0.92],
                  }}
                  transition={{
                    delay: 1.24,
                    duration: 1.72,
                    times: [0, 0.14, 0.82, 1],
                    ease: ['easeOut', 'linear', 'easeIn'],
                  }}
                  className="absolute inset-0 flex items-center justify-center px-4"
                >
                  <div className="relative max-w-2xl w-[92%] rounded-3xl bg-gradient-to-b from-[#33110D]/96 via-[#1B0C0E]/96 to-[#12090C]/98 border-2 border-[#FFB800] p-5 sm:p-7 text-center shadow-[0_0_80px_rgba(255,138,0,0.75)]">
                    {/* Trailing Fire Tail on the Right Edge */}
                    <div className="pointer-events-none absolute -right-14 inset-y-4 w-20 bg-gradient-to-l from-transparent via-[#FF4D2E]/45 to-[#FFB800]/65 blur-xl rounded-full" />
                    <div className="pointer-events-none absolute -left-8 inset-y-6 w-14 bg-gradient-to-r from-transparent to-[#FF8A00]/50 blur-lg rounded-full" />

                    <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-[#FF4D2E]/30 border border-[#FF8A00]/80 text-[#FFE066] font-mono text-xs font-black tracking-widest uppercase">
                      <Flame className="w-4 h-4 text-[#FF8A00] animate-pulse" />
                      <span>{t('SPECIAL FEATURES ACTIVE', '烈焰专属强化已激活')}</span>
                      <Flame className="w-4 h-4 text-[#FF8A00] animate-pulse" />
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FF4D2E]/30 to-[#FF8A00]/15 border-2 border-[#FF5E1A] px-4 py-4 flex items-center justify-center gap-2.5 shadow-[0_0_28px_rgba(255,77,46,0.35),inset_0_0_20px_rgba(255,77,46,0.25)]">
                        <Flame className="w-7 h-7 text-[#FFB800] drop-shadow-[0_0_10px_#FF5E1A] shrink-0 animate-pulse" />
                        <span className="font-display text-lg sm:text-2xl font-black text-white drop-shadow">
                          {lang === 'zh' ? frenzyPerks.perk1Zh : frenzyPerks.perk1En}
                        </span>
                      </div>

                      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#FFB800]/28 to-[#FF5E1A]/15 border-2 border-[#FFB800] px-4 py-4 flex items-center justify-center gap-2.5 shadow-[0_0_28px_rgba(255,184,0,0.3),inset_0_0_20px_rgba(255,184,0,0.22)]">
                        <Zap className="w-7 h-7 text-[#FFE066] drop-shadow-[0_0_10px_#FFB800] shrink-0 animate-pulse" />
                        <span className="font-display text-lg sm:text-2xl font-black text-white drop-shadow">
                          {lang === 'zh' ? frenzyPerks.perk2Zh : frenzyPerks.perk2En}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Bottom Fiery Fuse Progress Bar */}
                <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 w-[82%] max-w-lg text-center">
                  <div className="h-2.5 w-full rounded-full bg-[#2A1414]/90 border border-[#FF5E1A]/50 overflow-hidden p-0.5 shadow-[0_0_18px_rgba(255,77,46,0.45)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#FF4D2E] via-[#FF8A00] to-[#FFE066] transition-[width] duration-75"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            (room.frenzy.freezeRemaining / Math.max(0.1, room.frenzy.freezeTotal)) *
                              100
                          )
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] font-extrabold tracking-widest text-[#FFE066] uppercase tabular-nums drop-shadow">
                    {t(
                      `GET READY · RESUMING IN ${Math.max(1, Math.ceil(room.frenzy.freezeRemaining))}...`,
                      `全速狂飙 · ${Math.max(1, Math.ceil(room.frenzy.freezeRemaining))} 秒后继续！`
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interactive Rules Briefing Modal — NO Auto-Countdown! Waits until everyone taps Ready */}
          {room.status === 'BRIEFING' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0B0D12]/88 backdrop-blur-sm rounded-2xl p-2.5 sm:p-5 z-20">
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="max-w-3xl w-full max-h-full flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-[#1A1E26] border-2 border-[#2F3747] shadow-2xl"
              >
                {/* Tournament Progress Strip when playing 5-Game Tournament */}
                {activeTournament && (
                  <div className="px-4 sm:px-5 py-2.5 bg-[#221D11] border-b border-[#FFB800]/40 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#FFB800]">
                      <Trophy className="w-4 h-4 shrink-0" />
                      <span>
                        {t(
                          `5-GAME TOURNAMENT · GAME ${activeTournament.currentGameIndex + 1} OF ${activeTournament.totalGames}`,
                          `5局派对锦标赛 · 第 ${activeTournament.currentGameIndex + 1} / ${activeTournament.totalGames} 局`
                        )}
                      </span>
                      {activeTournament.currentGameIndex + 1 === activeTournament.totalGames && (
                        <span className="px-1.5 py-0.5 rounded bg-[#FF4D2E] text-white text-[10px] font-black">
                          {t('1.5× FINALE MARKS', '决赛 1.5× 积分')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {activeTournament.gameQueue.map((gId, idx) => {
                        const done = idx < activeTournament.currentGameIndex;
                        const current = idx === activeTournament.currentGameIndex;
                        return (
                          <span
                            key={`${gId}-${idx}`}
                            className={`w-6 h-6 rounded-md font-mono text-[10px] font-black flex items-center justify-center ${
                              current
                                ? 'bg-[#FFB800] text-[#14120B]'
                                : done
                                ? 'bg-[#10D98B]/25 text-[#10D98B] border border-[#10D98B]/50'
                                : 'bg-[#151820] text-[#6B7280] border border-[#2A303D]'
                            }`}
                          >
                            {done ? '✓' : idx + 1}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Header strip with game artwork thumbnail */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 sm:p-5 border-b border-[#262C38] bg-[#151820] shrink-0">
                  <div className="w-full sm:w-36 aspect-video rounded-xl overflow-hidden bg-[#101217] border border-[#2A303D] shrink-0">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#00C2FF]">
                        {t('How to Play', '玩法说明')} · {selectedGame.category}
                      </span>
                      {room.activeMutator !== 'normal' && (
                        <span
                          className="px-2 py-0.5 rounded bg-[#101217] border text-[10px] font-mono font-black"
                          style={{
                            borderColor: activeMutatorSpec.accentHex,
                            color: activeMutatorSpec.accentHex,
                          }}
                        >
                          {lang === 'zh' ? activeMutatorSpec.nameZh : activeMutatorSpec.name}
                        </span>
                      )}
                    </div>
                    <h2 className="font-display text-xl sm:text-3xl font-extrabold text-white mt-0.5 truncate">
                      {selectedGame.name}
                    </h2>
                    <p className="text-xs sm:text-base text-[#D1D5DB] mt-1">{selectedGame.tagline}</p>
                  </div>
                </div>

                {/* Body: Simple Rules + Clear Phone Controls (Scrollable if tablet height is tight) */}
                <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 flex-1 min-h-0 overflow-y-auto arcade-scrollbar">
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
                <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-[#151820] border-t border-[#262C38] space-y-3 shrink-0">
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
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3 px-4">
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

          {/* Victory Podium / Tournament Standings Modal Overlay */}
          {room.status === 'RESULTS' && (() => {
            const tournament = room.tournament?.active ? room.tournament : null;
            const nextGameRaw =
              tournament && !tournament.completed
                ? tournament.gameQueue[tournament.currentGameIndex + 1]
                : null;
            const nextGameMeta = nextGameRaw
              ? getLocalizedGameMeta(getGameMeta(nextGameRaw), lang)
              : null;
            const isFinaleGame =
              Boolean(tournament) &&
              tournament!.currentGameIndex + 1 >= tournament!.totalGames;
            const champ = tournament?.standings[0] ?? null;

            return (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0B0D12]/84 backdrop-blur-xs rounded-2xl p-3 sm:p-6 z-20">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                  className={`${
                    tournament ? 'max-w-2xl' : 'max-w-lg'
                  } w-full max-h-full overflow-y-auto arcade-scrollbar rounded-3xl bg-[#1A1E26] border-2 ${
                    tournament?.completed ? 'border-[#FFB800]' : 'border-[#2F3747]'
                  } p-5 sm:p-7 text-center shadow-2xl`}
                >
                  {tournament ? (
                    <>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFB800]/18 border border-[#FFB800]/50 text-[#FFB800] font-mono text-xs font-black">
                        <Trophy className="w-3.5 h-3.5" />
                        <span>
                          {tournament.completed
                            ? t('5-GAME TOURNAMENT FINAL', '5局锦标赛总决赛落幕')
                            : t(
                                `TOURNAMENT GAME ${tournament.currentGameIndex + 1}/${tournament.totalGames}`,
                                `锦标赛 第 ${tournament.currentGameIndex + 1} / ${tournament.totalGames} 局`
                              )}
                        </span>
                        {isFinaleGame && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-[#FF4D2E] text-white text-[10px]">
                            1.5× MARKS
                          </span>
                        )}
                      </div>

                      <h2 className="mt-2.5 font-display text-2xl sm:text-3xl font-extrabold text-white">
                        {tournament.completed
                          ? champ
                            ? t(
                                `👑 ${champ.name} is Grand Champion!`,
                                `👑 ${champ.name} 夺得总冠军！`
                              )
                            : t('Tournament Complete!', '锦标赛圆满结束！')
                          : room.rankings[0]
                          ? t(
                              `${room.rankings[0].name} Wins ${selectedGame.name}!`,
                              `${room.rankings[0].name} 拿下 ${selectedGame.name}！`
                            )
                          : t('Round Complete', '本局完成')}
                      </h2>

                      <p className="text-xs sm:text-sm text-[#9CA3AF] mt-1">
                        {tournament.completed
                          ? t(
                              'Cumulative Marks across all 5 random games decide the champion!',
                              '5局随机挑战累计总积分（Marks）最高者登顶总冠军！'
                            )
                          : t(
                              `This Round: ${selectedGame.name} · Highest Total Marks after 5 games wins!`,
                              `本局：${selectedGame.name} · 5局总积分（Marks）最高者夺冠！`
                            )}
                      </p>

                      {/* 5-Game Queue Progress Pills */}
                      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
                        {tournament.gameQueue.map((gId, idx) => {
                          const gMeta = getLocalizedGameMeta(getGameMeta(gId), lang);
                          const played = tournament.history[idx];
                          const isCurrent = idx === tournament.currentGameIndex;
                          return (
                            <div
                              key={`${gId}-${idx}`}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1.5 ${
                                isCurrent
                                  ? 'bg-[#262C38] border-[#FFB800] text-white'
                                  : played
                                  ? 'bg-[#101217] border-[#10D98B]/45 text-[#A7F3D0]'
                                  : 'bg-[#101217] border-[#262C38] text-[#6B7280]'
                              }`}
                            >
                              <span className="font-mono text-[10px]">#{idx + 1}</span>
                              <span className="truncate max-w-[100px]">{gMeta.name}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Cumulative Tournament Standings */}
                      <div className="mt-4 space-y-2 text-left max-h-[250px] overflow-y-auto arcade-scrollbar pr-1.5">
                        {tournament.standings.map((entry) => (
                          <div
                            key={entry.playerId}
                            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                              entry.rank === 1
                                ? 'bg-[#221D11] border-[#FFB800]/70'
                                : 'bg-[#101217] border-[#262C38]'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`font-mono text-sm font-black w-6 tabular-nums ${
                                  entry.rank === 1 ? 'text-[#FFB800]' : 'text-[#9CA3AF]'
                                }`}
                              >
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
                              {entry.isBot && <Bot className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />}
                              <div className="min-w-0">
                                <div className="font-semibold text-white truncate">{entry.name}</div>
                                <div className="text-[10px] text-[#9CA3AF]">
                                  {entry.wins > 0
                                    ? t(`${entry.wins} win${entry.wins > 1 ? 's' : ''}`, `${entry.wins} 次头名`)
                                    : t('Contender', '角逐中')}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              {entry.lastGameMarks > 0 && (
                                <span className="px-2 py-0.5 rounded-md bg-[#10D98B]/18 text-[#10D98B] font-mono text-xs font-extrabold tabular-nums">
                                  +{entry.lastGameMarks}
                                </span>
                              )}
                              <div className="text-right">
                                <span className="font-mono text-base font-black text-[#FFB800] tabular-nums">
                                  {entry.totalMarks}
                                </span>
                                <span className="text-[11px] text-[#A5AEBD] ml-1">
                                  {t('Marks', '积分')}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {nextGameMeta && (
                        <div className="mt-4 px-4 py-2.5 rounded-xl bg-[#101217] border border-[#00C2FF]/45 flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#00C2FF]">
                            {t(
                              `Up Next · Game ${tournament.currentGameIndex + 2}/${tournament.totalGames}`,
                              `下一局 · 第 ${tournament.currentGameIndex + 2}/${tournament.totalGames} 局`
                            )}
                          </span>
                          <span className="font-display font-extrabold text-sm text-white truncate">
                            {nextGameMeta.name}
                          </span>
                        </div>
                      )}

                      {activeHostPlayer && (
                        <p className="mt-3 text-xs font-bold text-[#FFB800]">
                          {t(
                            `Use ${activeHostPlayer.name}'s Remote (◀ ▶ OK)`,
                            `使用 ${activeHostPlayer.name} 的遥控器（◀ ▶ OK）选择`
                          )}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            guardHostOnlyClick(() =>
                              tournament.completed
                                ? handleStartTournament()
                                : handleNextTournamentGame()
                            )
                          }
                          className={`tactile-btn px-6 py-3 rounded-xl bg-[#FF4D2E] text-white font-bold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 transition-all ${
                            room.remoteFocus.modalIndex === 0 ? 'ring-3 ring-[#FFB800] scale-105' : ''
                          } ${isScreenRemoteLocked ? 'cursor-default' : 'hover:bg-[#FF6145] cursor-pointer'}`}
                        >
                          {tournament.completed ? (
                            <>
                              <RotateCcw className="w-4 h-4" />
                              <span>{t('New 5-Game Tournament', '再来一届 5 局锦标赛')}</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              <span>
                                {t(
                                  `Next Game (${tournament.currentGameIndex + 2}/${tournament.totalGames})`,
                                  `进入第 ${tournament.currentGameIndex + 2} 局`
                                )}
                              </span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => guardHostOnlyClick(handleExitTournament)}
                          className={`tactile-btn px-5 py-3 rounded-xl bg-[#242A36] text-white font-semibold text-sm transition-all ${
                            room.remoteFocus.modalIndex === 1 ? 'ring-3 ring-[#FFB800] scale-105' : ''
                          } ${isScreenRemoteLocked ? 'cursor-default' : 'hover:bg-[#2E3646] cursor-pointer'}`}
                        >
                          {t('Game Room', '返回游戏厅')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <Trophy className="w-11 h-11 text-[#FFB800] mx-auto" />
                      <h2 className="mt-2 font-display text-3xl font-extrabold text-white">
                        {room.rankings[0]
                          ? t(`${room.rankings[0].name} Wins!`, `${room.rankings[0].name} 获胜！`)
                          : t('Match Complete', '本局结束')}
                      </h2>
                      <p className="text-sm text-[#9CA3AF] mt-1">
                        {selectedGame.name} · {t('Final Standings', '最终排名')}
                        {room.activeMutator !== 'normal'
                          ? ` · ${lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}`
                          : ''}
                      </p>

                      <div className="mt-5 space-y-2 text-left max-h-[280px] overflow-y-auto arcade-scrollbar pr-1.5">
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
                    </>
                  )}
                </motion.div>
              </div>
            );
          })()}
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
