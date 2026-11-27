import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Dices,
  ExternalLink,
  Flame,
  Gamepad2,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  Power,
  QrCode,
  RotateCcw,
  Search,
  Share2,
  Shuffle,
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
  CARD_GAME_IDS,
  filterGamesByPlayerMode,
  getGameGenre,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import { getPadTutorialGuide } from '../shared/padProfiles';
import { GameHoverPreview, preloadDemoClip } from './GameHoverPreview';
import { GameThumbnail } from './GameThumbnail';
import { preloadRuleClips } from './WatchAndPlayCardCanvas';
import { BriefingTutorialCard } from './BriefingTutorialCard';
import { GameTutorialOverlay } from './GameTutorialOverlay';
import { CupVotingStage } from './CupVotingStage';
import { PlayerAvatar } from './PlayerAvatar';
import {
  GAME_FRENZY_PERKS,
  getMutatorSpec,
  type MutatorId,
} from '../shared/modifiers';
import {
  getTeamsForMode,
  getTeamSpec,
  TEAM_MODE_OPTIONS,
  type TeamId,
  type TeamMode,
} from '../shared/party';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BotDifficulty,
  CompetitiveSnapshot,
  GameId,
  GameSnapshot,
  MAX_PLAYERS_PER_ROOM,
  RoomSnapshot,
  ServerMessage,
} from '../shared/types';
import { arcadeAudio } from '../lib/audio';
import { getJoinUrl, ManagedWebSocket } from '../lib/ws';
import { createRoomSyncStore, useRoomSyncSnapshot } from '../lib/roomSyncStore';
import { copyRoomInvite, shareRoomInvite } from '../lib/shareInvite';
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
import { getStylizedGameThumbnail } from '../games/thumbnailGenerator';
import { ChaosWheelModal } from './ChaosWheelModal';
import { GuestPassManagerModal, HostUnlockModal } from './HostAccessModal';
import { TestControllerDrawer } from './TestControllerDrawer';
import { RuleChatbotDrawer } from './RuleChatbotDrawer';
import {
  clearHostAuthSession,
  consumeGuestSingleUseTokenLocally,
  fetchHostAuthStatus,
  getHostAuthToken,
  getOwnerAdminSession,
  getPublicAccessOpen,
  setPublicAccessOpenLocally,
} from '../lib/hostAuth';

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
  const syncStore = useMemo(() => createRoomSyncStore(), []);
  const syncState = useRoomSyncSnapshot(syncStore);
  const wsConnected = syncState.wsConnected;
  const room = syncState.room;
  const [showDisconnectBanner, setShowDisconnectBanner] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testDrawerOpen, setTestDrawerOpen] = useState(false);
  const [ruleBotOpen, setRuleBotOpen] = useState(false);
  const [showInGameTutorial, setShowInGameTutorial] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<null | 'shared' | 'copied'>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([]);
  const [isMonitorFullscreen, setIsMonitorFullscreen] = useState(false);
  const [bannerToast, setBannerToast] = useState<string | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [isClosingRoom, setIsClosingRoom] = useState(false);
  const [chaosWheelOpen, setChaosWheelOpen] = useState(false);
  const [hostUnlockNeeded, setHostUnlockNeeded] = useState(false);
  const [ownerSettingsAuthOpen, setOwnerSettingsAuthOpen] = useState(false);
  const [guestPassOpen, setGuestPassOpen] = useState(false);
  const secretTitleTapRef = useRef<{ count: number; lastAt: number }>({ count: 0, lastAt: 0 });

  const openOwnerSettingsModal = useCallback(() => {
    const existing = getOwnerAdminSession();
    if (existing?.role === 'master') {
      setOwnerSettingsAuthOpen(false);
      setGuestPassOpen(true);
    } else {
      setGuestPassOpen(false);
      setOwnerSettingsAuthOpen(true);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        openOwnerSettingsModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openOwnerSettingsModal]);

  const handleSecretTitleTap = () => {
    const now = Date.now();
    const prev = secretTitleTapRef.current;
    const nextCount = now - prev.lastAt <= 2200 ? prev.count + 1 : 1;
    secretTitleTapRef.current = { count: nextCount, lastAt: now };
    if (nextCount >= 5) {
      secretTitleTapRef.current = { count: 0, lastAt: 0 };
      openOwnerSettingsModal();
    }
  };
  const [rankShifts, setRankShifts] = useState<Record<string, number>>({});
  const [cardFlipDir, setCardFlipDir] = useState<1 | -1>(1);
  const [lobbySearchQuery, setLobbySearchQuery] = useState('');
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

  const prevRankMapRef = useRef<Record<string, number>>({});
  const rankShiftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLobbySelectionRef = useRef<{ filter: string; idx: number }>({
    filter: 'all',
    idx: -1,
  });

  const wsRef = useRef<ManagedWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestSnapshotRef = useRef<GameSnapshot | null>(null);
  const latestCompetitiveRef = useRef<CompetitiveSnapshot | null>(null);
  const fxRef = useRef(createRenderFxState());
  const prevStatusRef = useRef<string | null>(null);
  const prevHostIdRef = useRef<string | null>(null);
  const prevPlayersRef = useRef<RoomSnapshot['players']>([]);
  const prevSpinSeqRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelAutoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const actionsGridRef = useRef<HTMLDivElement | null>(null);
  const filterTabsRef = useRef<HTMLDivElement | null>(null);
  const lastSentLayoutRef = useRef<{ gameCols: number; actionCols: number }>({
    gameCols: 0,
    actionCols: 0,
  });

  const roomRef = useRef<RoomSnapshot | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const reattachRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectGraceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  // Smooth 2.5s visual grace period before surfacing a disconnect indicator so sub-second proxy handoffs stay invisible
  useEffect(() => {
    if (wsConnected) {
      if (disconnectGraceTimerRef.current) {
        clearTimeout(disconnectGraceTimerRef.current);
        disconnectGraceTimerRef.current = null;
      }
      setShowDisconnectBanner(false);
      return;
    }
    if (!room) {
      setShowDisconnectBanner(false);
      return;
    }
    disconnectGraceTimerRef.current = setTimeout(() => {
      setShowDisconnectBanner(true);
    }, 2_500);
    return () => {
      if (disconnectGraceTimerRef.current) {
        clearTimeout(disconnectGraceTimerRef.current);
        disconnectGraceTimerRef.current = null;
      }
    };
  }, [wsConnected, Boolean(room)]);

  const saveHostSession = (code: string, hostToken: string) => {
    const payload = JSON.stringify({ code, hostToken, savedAt: Date.now() });
    try {
      sessionStorage.setItem(HOST_SESSION_KEY, payload);
    } catch {
      // Ignore storage failure
    }
    try {
      localStorage.setItem(HOST_SESSION_KEY, payload);
    } catch {
      // Ignore storage failure
    }
  };

  const loadHostSession = (): { code: string; hostToken: string } | null => {
    const MAX_AGE_MS = 2 * 60 * 60 * 1000;
    const sources: (string | null)[] = [];
    try {
      sources.push(sessionStorage.getItem(HOST_SESSION_KEY));
    } catch {
      // Ignore storage failure
    }
    try {
      sources.push(localStorage.getItem(HOST_SESSION_KEY));
    } catch {
      // Ignore storage failure
    }
    for (const raw of sources) {
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as { code?: string; hostToken?: string; savedAt?: number };
        if (parsed.code && parsed.hostToken) {
          if (!parsed.savedAt || Date.now() - parsed.savedAt < MAX_AGE_MS) {
            return { code: parsed.code, hostToken: parsed.hostToken };
          }
        }
      } catch {
        // Ignore malformed entry
      }
    }
    return null;
  };

  const clearHostSession = () => {
    try {
      sessionStorage.removeItem(HOST_SESSION_KEY);
    } catch {
      // Ignore storage failure
    }
    try {
      localStorage.removeItem(HOST_SESSION_KEY);
    } catch {
      // Ignore storage failure
    }
  };

  // Acquire Screen Wake Lock on the Monitor so TVs, laptops, and tablets never sleep/suspend timers mid-party
  useEffect(() => {
    let active = true;
    const requestWakeLock = async () => {
      if (!active || typeof navigator === 'undefined') return;
      try {
        const nav = navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock && !wakeLockRef.current) {
          const lock = await nav.wakeLock.request('screen');
          if (!active) {
            lock.release().catch(() => {});
          } else {
            wakeLockRef.current = lock;
          }
        }
      } catch {
        // Wake lock optional on unsupported browsers
      }
    };

    requestWakeLock();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        wakeLockRef.current = null;
        requestWakeLock();
        if (wsRef.current && !wsRef.current.isConnected()) {
          wsRef.current.reconnectNow(false);
        } else {
          syncStore.requestSync(true);
        }
      }
    };
    const onFirstGesture = () => {
      requestWakeLock();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointerdown', onFirstGesture, { passive: true, once: true });
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointerdown', onFirstGesture);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Manage Host WebSocket Connection
  useEffect(() => {
    const clearReattachRetry = () => {
      if (reattachRetryTimerRef.current) {
        clearTimeout(reattachRetryTimerRef.current);
        reattachRetryTimerRef.current = null;
      }
    };

    const sendAttachOrCreate = (sock: ManagedWebSocket) => {
      const saved = loadHostSession();
      if (saved) {
        sock.send({
          type: 'room:host-reattach',
          code: saved.code,
          hostToken: saved.hostToken,
        });
      } else {
        clearReattachRetry();
        void fetchHostAuthStatus()
          .then((status) => {
            if (wsRef.current !== sock || !sock.isConnected() || roomRef.current) return;
            const authToken = getHostAuthToken();
            if (status.publicAccessOpen || authToken) {
              sock.send({
                type: 'room:create',
                preferredGameId: initialGameId,
                ...(authToken ? { authToken } : {}),
              });
            } else {
              setHostUnlockNeeded(true);
            }
          })
          .catch(() => {
            if (wsRef.current !== sock || !sock.isConnected() || roomRef.current) return;
            const authToken = getHostAuthToken();
            if (getPublicAccessOpen() || authToken) {
              sock.send({
                type: 'room:create',
                preferredGameId: initialGameId,
                ...(authToken ? { authToken } : {}),
              });
            } else {
              setHostUnlockNeeded(true);
            }
          });
        return;
      }
      // Safety net: if the attach/create confirmation doesn't arrive within 3s while socket is open, retry automatically
      clearReattachRetry();
      reattachRetryTimerRef.current = setTimeout(() => {
        if (wsRef.current === sock && sock.isConnected()) {
          const retrySaved = loadHostSession();
          if (retrySaved) {
            sock.send({
              type: 'room:host-reattach',
              code: retrySaved.code,
              hostToken: retrySaved.hostToken,
            });
          } else if (!roomRef.current) {
            const retryAuthToken = getHostAuthToken();
            if (!retryAuthToken && !getPublicAccessOpen()) {
              setHostUnlockNeeded(true);
              return;
            }
            sock.send({
              type: 'room:create',
              preferredGameId: initialGameId,
              ...(retryAuthToken ? { authToken: retryAuthToken } : {}),
            });
          }
        }
      }, 3_000);
    };

    const socket = new ManagedWebSocket({
      onOpen: () => {
        syncStore.setSocketStatus('connected');
        sendAttachOrCreate(socket);
      },
      onClose: () => {
        clearReattachRetry();
        syncStore.setSocketStatus('reconnecting');
      },
      onRecover: () => {
        syncStore.requestSync(true);
      },
      onPendingOpsChange: (count) => {
        syncStore.setPendingOpsCount(count);
      },
      onStatusChange: (status) => {
        syncStore.setSocketStatus(status);
      },
      onMessage: (msg: ServerMessage) => {
        switch (msg.type) {
          case 'room:created':
            clearReattachRetry();
            consumeGuestSingleUseTokenLocally();
            setHostUnlockNeeded(false);
            saveHostSession(msg.code, msg.hostToken);
            syncStore.applyRoomAuthoritative(msg.room, true);
            latestSnapshotRef.current = syncStore.latestSnapshot;
            latestCompetitiveRef.current = syncStore.latestCompetitive;
            setErrorMsg(null);
            enterMonitorFullscreen();
            break;
          case 'room:snapshot':
            clearReattachRetry();
            syncStore.applyRoomAuthoritative(msg.room);
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
          case 'game:tick': {
            if (msg.snapshot) {
              const { accepted } = syncStore.applyGameTick(msg);
              if (accepted) {
                latestSnapshotRef.current = syncStore.latestSnapshot;
                latestCompetitiveRef.current = syncStore.latestCompetitive;
                const snap = msg.snapshot;
                if (CARD_GAME_IDS.has(snap.gameId)) {
                  const sAny = snap as unknown as {
                    activePlayerId?: string;
                    turnTotal?: number;
                    turnTimeLeft?: number;
                    phase?: string;
                    lastClaimPlayerId?: string | null;
                  };
                  const elapsed = Math.max(
                    0,
                    Number(((sAny.turnTotal || 15) - (sAny.turnTimeLeft || 0)).toFixed(1))
                  );
                  const phase = sAny.phase ?? 'turn';
                  const lastClaim = sAny.lastClaimPlayerId ?? null;
                  const actId = sAny.activePlayerId ?? null;
                  setLiveTurnInfo((prev) => {
                    if (
                      prev.activePlayerId === actId &&
                      Math.abs(prev.turnElapsedSec - elapsed) < 0.2 &&
                      prev.phase === phase &&
                      prev.lastClaimPlayerId === lastClaim
                    ) {
                      return prev;
                    }
                    return {
                      activePlayerId: actId,
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
          }
          case 'room:closed':
            clearReattachRetry();
            if (closeFallbackTimerRef.current) {
              clearTimeout(closeFallbackTimerRef.current);
              closeFallbackTimerRef.current = null;
            }
            syncStore.reset();
            latestSnapshotRef.current = null;
            latestCompetitiveRef.current = null;
            exitMonitorFullscreen();
            clearHostSession();
            onExit();
            break;
          case 'error':
            if (msg.code === 'ROOM_NOT_FOUND') {
              clearReattachRetry();
              clearHostSession();
              syncStore.reset();
              latestSnapshotRef.current = null;
              latestCompetitiveRef.current = null;
              const authToken = getHostAuthToken();
              if (authToken || getPublicAccessOpen()) {
                socket.send({
                  type: 'room:create',
                  preferredGameId: initialGameId,
                  ...(authToken ? { authToken } : {}),
                });
              } else {
                setHostUnlockNeeded(true);
              }
            } else if (msg.code === 'HOST_AUTH_REQUIRED') {
              clearReattachRetry();
              clearHostAuthSession();
              setPublicAccessOpenLocally(false);
              setHostUnlockNeeded(true);
              setErrorMsg(msg.message);
            } else {
              setErrorMsg(msg.message);
            }
            break;
        }
      },
    });
    wsRef.current = socket;
    syncStore.attachSocket(socket);

    return () => {
      clearReattachRetry();
      if (closeFallbackTimerRef.current) {
        clearTimeout(closeFallbackTimerRef.current);
        closeFallbackTimerRef.current = null;
      }
      if (wheelAutoCloseTimerRef.current) {
        clearTimeout(wheelAutoCloseTimerRef.current);
        wheelAutoCloseTimerRef.current = null;
      }
      syncStore.detachSocket();
      socket.close();
      wsRef.current = null;
    };
  }, [initialGameId, syncStore]);

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

  // Keep Cloud Run / reverse-proxy HTTP hosts warm every 45s while the Host Monitor is open
  useEffect(() => {
    const ping = () => {
      fetch('/api/health', { cache: 'no-store' }).catch(() => {
        // Ignore transient network errors; WebSocket reconnect handles recovery
      });
    };
    const intervalId = window.setInterval(ping, 45_000);
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
          renderGameSnapshot(
            ctx,
            snap,
            fxRef.current,
            langRef.current,
            latestCompetitiveRef.current
          );
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

  const exitMonitorFullscreen = () => {
    if (typeof document === 'undefined') return;
    userExitedFullscreenRef.current = true;
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => Promise<void> | void;
      };
      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen();
      }
    } catch {
      // Ignore exit errors
    }
  };

  const toggleMonitorFullscreen = () => {
    if (typeof document === 'undefined') return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
    };
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      exitMonitorFullscreen();
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

  // Auto-clear stale ready-check error messages whenever the room ready condition or status changes
  const hostUnreadyIdsKey = room?.readyGate?.unreadyHumanIds?.join(',') ?? '';
  useEffect(() => {
    setErrorMsg(null);
  }, [room?.status, room?.readyGate?.allHumansReady, hostUnreadyIdsKey, room?.players.length]);

  // Announce whenever Host transfers control or falls back to Mouse control, with explicit reason
  useEffect(() => {
    if (!room) return;
    const prevHost = prevHostIdRef.current;
    const prevPlayers = prevPlayersRef.current;
    prevHostIdRef.current = room.hostPlayerId;
    prevPlayersRef.current = room.players;

    if (prevHost && room.hostPlayerId && prevHost !== room.hostPlayerId) {
      const nextHost = room.players.find((p) => p.id === room.hostPlayerId);
      const transfer =
        room.hostTransfer && room.hostTransfer.toPlayerId === room.hostPlayerId
          ? room.hostTransfer
          : null;
      const fromName =
        transfer?.fromPlayerName ||
        prevPlayers.find((p) => p.id === prevHost)?.name ||
        (lang === 'zh' ? '原房主' : 'Previous host');
      if (nextHost) {
        const slotTag = `P${nextHost.slotIndex + 1} ${nextHost.name}`;
        if (transfer?.reason === 'disconnect-timeout') {
          showBannerToast(
            lang === 'zh'
              ? `房主 ${fromName} 已离线满 15 秒 — 遥控权已按座位顺序移交给 ${slotTag}！`
              : `Host ${fromName} was offline for 15s — remote control passed in slot order to ${slotTag}!`
          );
        } else if (transfer?.reason === 'player-left') {
          showBannerToast(
            lang === 'zh'
              ? `房主 ${fromName} 已离开房间 — 遥控权已按座位顺序移交给 ${slotTag}！`
              : `Host ${fromName} left the room — remote control passed in slot order to ${slotTag}!`
          );
        } else if (transfer?.reason === 'kicked') {
          showBannerToast(
            lang === 'zh'
              ? `房主 ${fromName} 已被移出房间 — 遥控权已按座位顺序移交给 ${slotTag}！`
              : `Host ${fromName} was removed — remote control passed in slot order to ${slotTag}!`
          );
        } else if (transfer?.reason === 'real-phone-priority') {
          showBannerToast(
            lang === 'zh'
              ? `真实手机优先于测试手柄 — 房主遥控权已移交给 ${slotTag}！`
              : `Real phone prioritized over Test Controller — remote control passed to ${slotTag}!`
          );
        } else {
          showBannerToast(
            lang === 'zh'
              ? `房主遥控权限已由 ${fromName} 移交给 ${slotTag}！现在由 TA 的手机遥控大屏。`
              : `Host control passed from ${fromName} to ${slotTag}! Their phone is now the TV Remote.`
          );
        }
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
            ? `P${nextHost.slotIndex + 1} ${nextHost.name} 已连接 — 已切换为手机遥控大屏！`
            : `P${nextHost.slotIndex + 1} ${nextHost.name} connected — Phone Remote control active!`
        );
      }
    }
  }, [room?.hostPlayerId, room?.hostTransfer?.seq, room?.status, room?.players, lang]);

  // Sync 3D card flip direction & proactively warm adjacent cards' renderers + thumbnails in LOBBY
  useEffect(() => {
    if (room?.status !== 'LOBBY') {
      return;
    }
    const list = filterGamesByPlayerMode(room.lobbyFilter);
    if (list.length === 0) return;

    const currentIdx = Math.max(
      0,
      list.findIndex((g) => g.id === room.selectedGameId)
    );
    const prev = prevLobbySelectionRef.current;
    if (prev.filter === room.lobbyFilter && prev.idx >= 0 && prev.idx !== currentIdx) {
      if (prev.idx === list.length - 1 && currentIdx === 0) {
        setCardFlipDir(1);
      } else if (prev.idx === 0 && currentIdx === list.length - 1) {
        setCardFlipDir(-1);
      } else {
        setCardFlipDir(currentIdx > prev.idx ? 1 : -1);
      }
    }
    prevLobbySelectionRef.current = { filter: room.lobbyFilter, idx: currentIdx };

    // Warm neighboring cards so flipping Previous/Next feels instant
    const nextGame = list[(currentIdx + 1) % list.length];
    const prevGame = list[(currentIdx - 1 + list.length) % list.length];
    for (const neighbor of [nextGame, prevGame]) {
      if (!neighbor) continue;
      preloadGameRenderer(neighbor.id);
      void getStylizedGameThumbnail(neighbor.id, neighbor.accentHex, getGameGenre(neighbor.id));
      void preloadDemoClip(neighbor.id);
      void preloadRuleClips(neighbor.id);
    }
  }, [room?.status, room?.lobbyFilter, room?.selectedGameId]);

  // Auto-scroll the horizontal filter bar so the remote-focused or active filter tab is always centered in view
  useEffect(() => {
    if (room?.status !== 'LOBBY') return;
    const container = filterTabsRef.current;
    if (!container) return;

    const targetIdx =
      room.remoteFocus.zone === 'filter'
        ? room.remoteFocus.index
        : Math.max(
            0,
            PLAYER_FILTER_OPTIONS.findIndex((opt) => opt.id === room.lobbyFilter)
          );

    const btn = container.querySelector<HTMLElement>(`[data-filter-idx="${targetIdx}"]`);
    if (!btn) return;

    const targetLeft =
      btn.offsetLeft - container.clientWidth / 2 + btn.offsetWidth / 2;
    container.scrollTo({
      left: Math.max(0, targetLeft),
      behavior: 'smooth',
    });
  }, [
    room?.status,
    room?.lobbyFilter,
    room?.remoteFocus?.zone,
    room?.remoteFocus?.index,
  ]);

  // Keyboard Left / Right arrow flipping in LOBBY when mouse control is active
  useEffect(() => {
    if (room?.status !== 'LOBBY' || chaosWheelOpen || closeConfirmOpen) return;
    const hasConnectedHumanHost = Boolean(
      room.players.find((p) => p.id === room.hostPlayerId && !p.isBot && p.connected)
    );
    if (hasConnectedHumanHost) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement | null)?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const list = filterGamesByPlayerMode(room.lobbyFilter);
      if (list.length <= 1) return;
      e.preventDefault();
      const curIdx = Math.max(
        0,
        list.findIndex((g) => g.id === room.selectedGameId)
      );
      const dir: 1 | -1 = e.key === 'ArrowRight' ? 1 : -1;
      const nextIdx = (curIdx + dir + list.length) % list.length;
      setCardFlipDir(dir);
      arcadeAudio.unlock();
      preloadGameRenderer(list[nextIdx].id);
      wsRef.current?.send({ type: 'game:select', gameId: list[nextIdx].id });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    room?.status,
    room?.lobbyFilter,
    room?.selectedGameId,
    room?.hostPlayerId,
    room?.players,
    chaosWheelOpen,
    closeConfirmOpen,
  ]);

  // Report live responsive CSS Grid column counts for the bottom action dock
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
      const fallbackActions = w >= 1280 ? 7 : w >= 640 ? 4 : 2;
      const gameCols = 1;
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

  const handleShareInvite = async () => {
    if (!room) return;
    const result = await shareRoomInvite({
      roomCode: room.code,
      lang,
      gameName: getLocalizedGameMeta(getGameMeta(room.selectedGameId), lang).name,
    });
    if (result === 'shared' || result === 'copied') {
      setShareFeedback(result);
      setTimeout(() => setShareFeedback(null), 1800);
    }
  };

  const handleCopyJoinLink = async () => {
    if (!room) return;
    const ok = await copyRoomInvite(room.code, lang);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
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

  const handleKickPlayer = (playerId: string) => {
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:kick-player', playerId });
  };

  const handleSetBotDifficulty = (difficulty: BotDifficulty, botId?: string) => {
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:set-bot-difficulty', difficulty, botId });
  };

  const handleSetHostPlayer = (playerId: string) => {
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:set-host-player', playerId });
  };

  const handleSetTeamMode = (teamMode: TeamMode) => {
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:set-team-mode', teamMode });
  };

  const handleCyclePlayerTeam = (playerId: string, currentTeamId: TeamId | null) => {
    if (!room || room.teamMode === 'ffa') return;
    const teams = getTeamsForMode(room.teamMode);
    if (teams.length === 0) return;
    const curIdx = currentTeamId ? teams.indexOf(currentTeamId) : -1;
    const nextTeam = teams[(curIdx + 1) % teams.length];
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:set-player-team', playerId, teamId: nextTeam });
  };

  const handleShuffleTeams = () => {
    setErrorMsg(null);
    wsRef.current?.send({ type: 'room:shuffle-teams' });
  };

  const handleForceLockCupVote = () => {
    arcadeAudio.unlock();
    setErrorMsg(null);
    wsRef.current?.send({ type: 'tournament:force-lock-vote' });
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

  // Real-time player placement sorted dynamically by live game points
  const rankedLivePlayers = useMemo(() => {
    if (!room) return [];
    const sorted = [...room.players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return a.slotIndex - b.slotIndex;
    });
    return sorted.map((player, index) => {
      const prev = index > 0 ? sorted[index - 1] : null;
      const isTiedWithPrev =
        Boolean(prev) && player.score > 0 && prev!.score === player.score;
      return {
        player,
        position: index + 1,
        isTiedWithPrev,
      };
    });
  }, [room?.players]);

  // Reset placement delta history whenever a new match/game begins
  useEffect(() => {
    if (
      !room ||
      room.status === 'SETUP' ||
      room.status === 'LOBBY' ||
      room.status === 'BRIEFING' ||
      room.status === 'COUNTDOWN'
    ) {
      prevRankMapRef.current = {};
      setRankShifts({});
      if (rankShiftTimerRef.current) {
        clearTimeout(rankShiftTimerRef.current);
        rankShiftTimerRef.current = null;
      }
    }
  }, [room?.status, room?.selectedGameId]);

  // Detect real-time placement changes (▲ climbed / ▼ dropped) during active play
  useEffect(() => {
    if (!room || (room.status !== 'PLAYING' && room.status !== 'PAUSED' && room.status !== 'RESULTS')) {
      return;
    }
    const prevMap = prevRankMapRef.current;
    const nextMap: Record<string, number> = {};
    const changed: Record<string, number> = {};
    let hasChange = false;

    for (const entry of rankedLivePlayers) {
      const pid = entry.player.id;
      nextMap[pid] = entry.position;
      const prevPos = prevMap[pid];
      if (prevPos !== undefined && prevPos !== entry.position) {
        changed[pid] = prevPos - entry.position; // > 0 climbed up, < 0 dropped down
        hasChange = true;
      }
    }
    prevRankMapRef.current = nextMap;

    if (hasChange) {
      setRankShifts((prev) => ({ ...prev, ...changed }));
      if (rankShiftTimerRef.current) clearTimeout(rankShiftTimerRef.current);
      rankShiftTimerRef.current = setTimeout(() => {
        setRankShifts({});
        rankShiftTimerRef.current = null;
      }, 2200);
    }
  }, [rankedLivePlayers, room?.status]);

  useEffect(() => {
    return () => {
      if (rankShiftTimerRef.current) {
        clearTimeout(rankShiftTimerRef.current);
        rankShiftTimerRef.current = null;
      }
    };
  }, []);

  const handleLeaveHost = () => {
    exitMonitorFullscreen();
    clearHostSession();
    onExit();
  };

  const confirmCloseRoom = () => {
    if (isClosingRoom) return;
    setIsClosingRoom(true);
    setCloseConfirmOpen(false);
    exitMonitorFullscreen();
    clearHostSession();
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
        <div className="relative mb-5 flex items-center justify-center" role="status" aria-live="polite">
          <div
            aria-hidden="true"
            className="w-14 h-14 rounded-full border-4 border-[#262C38] border-t-[#00C2FF] border-r-[#00C2FF]/35 animate-spin"
          />
          <span className="sr-only">{t('Loading', '加载中')}</span>
        </div>
        <div className="font-display text-2xl font-bold text-center">
          {hostUnlockNeeded
            ? t('Host Access Required', '需要房主验证')
            : t('Creating Game Room...', '正在创建游戏房间...')}
        </div>
        <p className="mt-2 text-sm text-[#9CA3AF] text-center">
          {hostUnlockNeeded
            ? t('Enter your Master PIN or a Friend Guest Pass to open a room', '请输入房主管理密码或访客临时口令以创建房间')
            : t('Connecting to live multiplayer server', '正在连接实时多人服务器')}
        </p>

        <HostUnlockModal
          open={hostUnlockNeeded}
          target="host"
          onClose={handleLeaveHost}
          onUnlocked={() => {
            setHostUnlockNeeded(false);
            setErrorMsg(null);
            const tok = getHostAuthToken();
            if ((tok || getPublicAccessOpen()) && wsRef.current?.isConnected()) {
              wsRef.current.send({
                type: 'room:create',
                preferredGameId: initialGameId,
                ...(tok ? { authToken: tok } : {}),
              });
            }
          }}
        />
      </div>
    );
  }

  const selectedGame = getLocalizedGameMeta(getGameMeta(room.selectedGameId), lang);
  const selectedPadGuide = getPadTutorialGuide(selectedGame.id, lang);
  const joinUrl = getJoinUrl(room.code, lang);
  const displayJoinHost =
    typeof window !== 'undefined' ? `${window.location.host}` : 'joinstick.arcade';
  const humans = room.players.filter((p) => !p.isBot);
  const connectedHumans = humans.filter((p) => p.connected);
  const bots = room.players.filter((p) => p.isBot);
  const readyHumans = connectedHumans.filter((p) => p.ready);
  const unreadyHumans = connectedHumans.filter((p) => !p.ready);
  const canStartMatch = room.readyGate
    ? room.readyGate.canStart
    : room.players.length > 0 && unreadyHumans.length === 0;
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
            className="pointer-events-none fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-1.5rem)] px-4 sm:px-5 py-2.5 rounded-2xl bg-[#1A1E26]/95 border-2 border-[#FFB800] text-white font-display font-bold text-xs sm:text-sm text-center shadow-2xl inline-flex items-center gap-2"
          >
            <Crown className="w-4 h-4 text-[#FFB800] shrink-0" />
            <span className="leading-snug">{bannerToast}</span>
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

      <HostUnlockModal
        open={ownerSettingsAuthOpen}
        target="passes"
        onClose={() => setOwnerSettingsAuthOpen(false)}
        onUnlocked={() => {
          setOwnerSettingsAuthOpen(false);
          setGuestPassOpen(true);
        }}
      />

      <GuestPassManagerModal
        open={guestPassOpen}
        onClose={() => setGuestPassOpen(false)}
        onRequestReauth={() => {
          setGuestPassOpen(false);
          setOwnerSettingsAuthOpen(true);
        }}
      />
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
              <span
                onClick={handleSecretTitleTap}
                className="font-display text-sm sm:text-lg font-extrabold text-white truncate select-none"
              >
                {t('JoinStick Party Stage', 'JoinStick 派对舞台')}
              </span>
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-[#9CA3AF] shrink-0">
                {!showDisconnectBanner ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[#10D98B]" />
                    {t('Live Room Open', '房间已开启')}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => wsRef.current?.reconnectNow(true)}
                    className="inline-flex items-center gap-1.5 text-[#FFB800] hover:text-white underline underline-offset-2 cursor-pointer"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" aria-hidden="true" />
                    <span>{t('Reconnecting... Tap to retry', '正在重连... 点击重试')}</span>
                  </button>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto">
              {audioUnlockButton}
              <button
                type="button"
                onClick={() => setRuleBotOpen(true)}
                className="tactile-btn h-9 sm:h-10 px-2.5 sm:px-3.5 rounded-xl bg-[#00C2FF]/15 hover:bg-[#00C2FF]/25 border border-[#00C2FF]/45 text-[#00C2FF] text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Bot className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{t('Guide Bot', '平台助手')}</span>
                <span className="sm:hidden">{t('Guide', '助手')}</span>
              </button>
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
                    onClick={handleShareInvite}
                    className={`tactile-btn h-10 px-4 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
                      shareFeedback
                        ? 'bg-[#10D98B] text-[#0A1913]'
                        : 'bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219]'
                    }`}
                  >
                    {shareFeedback ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    {shareFeedback === 'shared'
                      ? t('Invite Shared!', '已分享邀请！')
                      : shareFeedback === 'copied'
                      ? t('Link Copied!', '链接已复制！')
                      : t('Share Invite', '一键邀请')}
                  </button>
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
                    <div className="flex flex-col items-center gap-2 text-xs text-[#6B7280]">
                      <Loader2 className="w-6 h-6 text-[#00C2FF] animate-spin" aria-hidden="true" />
                      <span>{t('Loading QR...', '加载二维码...')}</span>
                    </div>
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

          {/* FLEXIBLE TEAM MODE BAR */}
          <section className="rounded-2xl bg-[#1A1E26] border border-[#282E3B] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#9CA3AF] inline-flex items-center gap-1.5 mr-1">
                <Users className="w-3.5 h-3.5 text-[#FFB800]" />
                {t('Team Mode', '组队模式')}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {TEAM_MODE_OPTIONS.map((opt) => {
                  const active = room.teamMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSetTeamMode(opt.id)}
                      className={`h-8 px-3 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 border transition-all cursor-pointer ${
                        active
                          ? 'bg-[#FFB800] text-[#14120B] border-[#FFB800] shadow-[0_2px_0_#B38100]'
                          : 'bg-[#101217] text-[#D1D5DB] border-[#262C38] hover:border-[#3D4659] hover:text-white'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{lang === 'zh' ? opt.labelZh : opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {(() => {
                const activeTeamOpt = TEAM_MODE_OPTIONS.find((m) => m.id === room.teamMode);
                return activeTeamOpt ? (
                  <span className="text-[11px] text-[#9CA3AF] hidden sm:inline">
                    {lang === 'zh' ? activeTeamOpt.hintZh : activeTeamOpt.hint}
                  </span>
                ) : null;
              })()}
              {room.teamMode !== 'ffa' && (
                <button
                  type="button"
                  onClick={handleShuffleTeams}
                  className="tactile-btn h-8 px-3 rounded-lg bg-[#242A36] hover:bg-[#2E3646] border border-[#353E50] text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Shuffle className="w-3.5 h-3.5 text-[#00C2FF]" />
                  <span>{t('Shuffle Teams', '随机分队')}</span>
                </button>
              )}
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
                  className="mx-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-[#1A1E26] border border-[#2A303D] text-[#00C2FF] mb-5"
                >
                  <Smartphone className="w-8 h-8" />
                </motion.div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-[#00C2FF] animate-spin shrink-0" aria-hidden="true" />
                  <span>{t('Waiting for players to join...', '等待玩家加入...')}</span>
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
                      const teamSpec = room.teamMode !== 'ffa' ? getTeamSpec(player.teamId) : null;
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
                          style={
                            !isHost && teamSpec
                              ? { borderColor: `${teamSpec.colorHex}88` }
                              : undefined
                          }
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="h-7 px-2 rounded-lg font-mono text-[11px] font-black inline-flex items-center gap-1"
                                style={{
                                  backgroundColor: player.color.hex,
                                  color: player.color.textOnColor,
                                }}
                              >
                                {player.isBot && <Bot className="w-3 h-3" />}
                                P{player.slotIndex + 1}
                              </span>

                              {teamSpec && (
                                <button
                                  type="button"
                                  title={t('Click to switch team', '点击切换队伍')}
                                  onClick={() => handleCyclePlayerTeam(player.id, player.teamId)}
                                  className="h-7 px-2 rounded-lg font-mono text-[11px] font-black inline-flex items-center gap-1 border transition-transform hover:scale-105 cursor-pointer"
                                  style={{
                                    backgroundColor: `${teamSpec.colorHex}24`,
                                    borderColor: `${teamSpec.colorHex}AA`,
                                    color: teamSpec.colorHex,
                                  }}
                                >
                                  <span>{teamSpec.emoji}</span>
                                  <span>{lang === 'zh' ? teamSpec.nameZh : teamSpec.shortName}</span>
                                </button>
                              )}
                            </div>

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
                            ) : (
                              <div className="flex items-center gap-1.5">
                                {isHost ? (
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
                                <button
                                  type="button"
                                  aria-label={t(`Kick ${player.name}`, `移出 ${player.name}`)}
                                  title={t(`Kick ${player.name}`, `移出 ${player.name}`)}
                                  onClick={() => handleKickPlayer(player.id)}
                                  className="h-7 w-7 rounded-lg bg-[#101217] hover:bg-[#FF4D2E] border border-[#262C38] text-[#9CA3AF] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-3 min-w-0">
                            <PlayerAvatar
                              avatarId={player.avatarId}
                              colorHex={player.color.hex}
                              size="md"
                            />
                            <div className="min-w-0">
                              <div className="font-display text-xl font-extrabold text-white truncate">
                                {player.name}
                              </div>
                              <div className="text-xs text-[#A5AEBD] mt-0.5 truncate">
                                {player.isBot
                                  ? t('AI Robot · Always Ready', 'AI 机器人 · 自动准备')
                                  : !player.connected
                                  ? (
                                    <span className="inline-flex items-center gap-1 text-[#FFB800]">
                                      <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden="true" />
                                      <span>{t('Disconnected · Reconnecting...', '已断开 · 等待重连中...')}</span>
                                    </span>
                                  )
                                  : isHost
                                  ? t('Room Host · Can start games', '房主 · 可遥控选游并开始')
                                  : t('Phone Controller Connected', '手机手柄已连接')}
                              </div>
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
        <RuleChatbotDrawer
          isOpen={ruleBotOpen}
          onClose={() => setRuleBotOpen(false)}
          activeGameId={room.selectedGameId}
        />
      </div>
    );
  }

  const activeMutatorSpec = getMutatorSpec(room.activeMutator);

  // =========================================================================
  // VIEW A2: FULLSCREEN TV GAME ROOM (Controlled Exclusively by Host's Remote!)
  // =========================================================================
  if (room.status === 'LOBBY') {
    const baseFilterGames = filterGamesByPlayerMode(room.lobbyFilter);
    const trimmedSearch = lobbySearchQuery.trim().toLowerCase();
    const matchedGames = baseFilterGames
      .map((raw) => ({ raw, loc: getLocalizedGameMeta(raw, lang) }))
      .filter(({ raw, loc }) => {
        if (!trimmedSearch) return true;
        return [
          raw.name,
          raw.category,
          raw.tagline,
          raw.description,
          loc.name,
          loc.category,
          loc.tagline,
          loc.description,
        ]
          .join(' ')
          .toLowerCase()
          .includes(trimmedSearch);
      })
      .map((item) => item.loc);
    const visibleGames =
      matchedGames.length > 0
        ? matchedGames
        : baseFilterGames.map((g) => getLocalizedGameMeta(g, lang));
    const searchHadNoMatches = trimmedSearch.length > 0 && matchedGames.length === 0;
    const focus = room.remoteFocus;
    const activeSettingOpt =
      selectedGame.settingOptions.find((o) => o.value === room.gameSettingValue) ??
      selectedGame.settingOptions[0];

    const tvFocusRing =
      'ring-3 ring-[#FFB800] border-[#FFB800] shadow-[0_0_24px_rgba(255,184,0,0.45)] scale-[1.015] z-10';

    return (
      <div className="monitor-shell bg-[#121419] text-[#F4F6FA] flex flex-col relative select-none">
        {floatingEmoteOverlay}

        {/* Slim Fullscreen TV Console Header */}
        <header className="min-h-13 sm:min-h-14 py-1.5 border-b border-[#242934] bg-[#151820] px-2.5 sm:px-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
            <span
              onClick={handleSecretTitleTap}
              className="font-display text-sm sm:text-lg font-extrabold text-white truncate select-none"
            >
              {t('JoinStick Game Room', 'JoinStick 游戏厅')}
            </span>
            <span className="text-[11px] sm:text-xs font-mono text-[#9CA3AF] whitespace-nowrap shrink-0">
              PIN <strong className="text-white">{room.code}</strong> · {room.players.length}/
              {MAX_PLAYERS_PER_ROOM} {t('Players', '人')}
            </span>
          </div>

          {/* Center Host Remote Lock Indicator (shown inline on wide screens, compact on tablets) */}
          <div className="hidden xl:flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#1A1E26] border border-[#FFB800]/55 text-xs font-bold text-[#FFB800] whitespace-nowrap">
            {showDisconnectBanner ? (
              <button
                type="button"
                onClick={() => wsRef.current?.reconnectNow(true)}
                className="inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
              >
                <Loader2 className="w-3.5 h-3.5 text-[#FFB800] animate-spin shrink-0" aria-hidden="true" />
                <WifiOff className="w-3.5 h-3.5 text-[#FF4D2E] shrink-0" aria-hidden="true" />
                <span className="text-[#FF9B8A]">
                  {t('Reconnecting... Click to retry', '服务器重连中... 点击重试')}
                </span>
              </button>
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

          {/* Passive Display Utilities Only (Audio Unlock, Language, Fullscreen, Audio, Test Pad) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto sm:ml-0">
            {audioUnlockButton}
            <button
              type="button"
              onClick={() => setRuleBotOpen(true)}
              title={t('Guide Bot', '平台助手')}
              className="h-8 sm:h-9 px-2 sm:px-2.5 xl:px-3 rounded-lg bg-[#00C2FF]/15 hover:bg-[#00C2FF]/25 border border-[#00C2FF]/45 text-[#00C2FF] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">{t('Guide Bot', '平台助手')}</span>
              <span className="hidden sm:inline xl:hidden">{t('Guide', '助手')}</span>
            </button>
            <LanguageToggle compact className="h-8 sm:h-9" />

            <button
              type="button"
              onClick={() => setTestDrawerOpen((v) => !v)}
              title={t('Test Remote', '测试遥控器')}
              className={`h-8 sm:h-9 px-2 sm:px-2.5 xl:px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
              className={`h-8 sm:h-9 px-2 sm:px-2.5 xl:px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-white flex items-center justify-center cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleRequestCloseRoom}
              title={t('Close Entire Room', '关闭整个房间')}
              className="h-8 sm:h-9 px-2 sm:px-2.5 xl:px-3 rounded-lg bg-[#2A191B] hover:bg-[#FF4D2E] border border-[#FF4D2E]/45 text-xs font-bold text-[#FF9B8A] hover:text-white inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Power className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('Close Room', '关闭房间')}</span>
            </button>
          </div>
        </header>

        {/* Main Fullscreen Console Body (Responsive Side-by-Side on iPad/PC, Clean Vertical Scroll on Phone) */}
        <main className="monitor-main flex-1 min-h-0 px-2.5 sm:px-5 py-2.5 sm:py-3 grid grid-cols-1 md:grid-cols-12 md:grid-rows-[minmax(0,1fr)] gap-3 sm:gap-4 xl:gap-5">
          {/* LEFT / CENTER (7-8 cols): Filter Bar + Spacious Responsive TV Game Deck */}
          <section className="md:col-span-7 lg:col-span-8 flex flex-col min-h-0 gap-3 sm:gap-3.5 overflow-hidden">
            {/* Row 0: Filter Bar (zone === 'filter') — Isolated in its own padded row so its focus ring never touches the game card below */}
            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 shrink-0 pb-0.5">
              <div className="flex items-center gap-1 min-w-0 max-w-full">
                <button
                  type="button"
                  onClick={() =>
                    guardHostOnlyClick(() => {
                      const curIdx = Math.max(
                        0,
                        PLAYER_FILTER_OPTIONS.findIndex((o) => o.id === room.lobbyFilter)
                      );
                      const prevOpt =
                        PLAYER_FILTER_OPTIONS[
                          (curIdx - 1 + PLAYER_FILTER_OPTIONS.length) % PLAYER_FILTER_OPTIONS.length
                        ];
                      if (prevOpt) {
                        wsRef.current?.send({ type: 'lobby:filter', filter: prevOpt.id });
                      }
                    })
                  }
                  title={t('Previous category filter', '上一个分类筛选')}
                  aria-label={t('Previous category filter', '上一个分类筛选')}
                  className={`h-9 w-7 rounded-lg bg-[#101217] hover:bg-[#1B202B] border border-[#262C39] text-[#9CA3AF] hover:text-white flex items-center justify-center shrink-0 transition-colors ${
                    isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div
                  ref={filterTabsRef}
                  role="tablist"
                  aria-label={t('Filter games by player count', '按游玩人数筛选游戏')}
                  className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-[#101217] border border-[#262C39] overflow-x-auto no-scrollbar max-w-full min-w-0 scroll-smooth"
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
                        data-filter-idx={idx}
                        aria-selected={isActiveFilter}
                        onClick={() =>
                          guardHostOnlyClick(() =>
                            wsRef.current?.send({
                              type: 'lobby:filter',
                              filter: opt.id,
                            })
                          )
                        }
                        className={`px-2.5 xl:px-3 py-1 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 transition-all border ${
                          isRemoteFocused
                            ? 'bg-[#FFB800] text-[#14120B] ring-2 ring-[#FFB800] border-[#FFB800] shadow-[0_0_14px_rgba(255,184,0,0.45)] z-10'
                            : isActiveFilter
                            ? opt.id === 'heritage'
                              ? 'bg-[#F59E0B] text-[#141008] border-transparent'
                              : 'bg-[#FF4D2E] text-white border-transparent'
                            : 'bg-transparent text-[#9CA3AF] border-transparent hover:text-white'
                        } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {getLocalizedFilterLabel(opt.id, lang, true)}{' '}
                        <span className="font-mono opacity-80 tabular-nums">({count})</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    guardHostOnlyClick(() => {
                      const curIdx = Math.max(
                        0,
                        PLAYER_FILTER_OPTIONS.findIndex((o) => o.id === room.lobbyFilter)
                      );
                      const nextOpt =
                        PLAYER_FILTER_OPTIONS[(curIdx + 1) % PLAYER_FILTER_OPTIONS.length];
                      if (nextOpt) {
                        wsRef.current?.send({ type: 'lobby:filter', filter: nextOpt.id });
                      }
                    })
                  }
                  title={t('Next category filter', '下一个分类筛选')}
                  aria-label={t('Next category filter', '下一个分类筛选')}
                  className={`h-9 w-7 rounded-lg bg-[#101217] hover:bg-[#1B202B] border border-[#262C39] text-[#9CA3AF] hover:text-white flex items-center justify-center shrink-0 transition-colors ${
                    isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="relative flex-1 lg:flex-initial lg:w-44 xl:w-48">
                  <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={lobbySearchQuery}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLobbySearchQuery(val);
                      const q = val.trim().toLowerCase();
                      if (q && !isScreenRemoteLocked) {
                        const hit = baseFilterGames.find((raw) => {
                          const loc = getLocalizedGameMeta(raw, lang);
                          return [raw.name, raw.description, loc.name, loc.description]
                            .join(' ')
                            .toLowerCase()
                            .includes(q);
                        });
                        if (hit && hit.id !== room.selectedGameId) {
                          handleSelectGame(hit.id);
                        }
                      }
                    }}
                    placeholder={t('Quick search...', '快速搜索...')}
                    aria-label={t('Search games in lobby', '在大厅搜索游戏')}
                    className={`w-full h-8 pl-8 pr-7 rounded-lg bg-[#101217] border text-xs text-white placeholder:text-[#6B7280] focus:outline-none ${
                      searchHadNoMatches
                        ? 'border-[#FF4D2E]'
                        : 'border-[#262C39] focus:border-[#00C2FF]'
                    }`}
                  />
                  {lobbySearchQuery && (
                    <button
                      type="button"
                      onClick={() => setLobbySearchQuery('')}
                      aria-label={t('Clear search', '清除搜索')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    guardHostOnlyClick(() => {
                      const pool = visibleGames.filter((g) => g.id !== room.selectedGameId);
                      const list = pool.length > 0 ? pool : visibleGames;
                      if (list.length === 0) return;
                      const pick = list[Math.floor(Math.random() * list.length)];
                      setCardFlipDir(1);
                      handleSelectGame(pick.id);
                    })
                  }
                  title={t('Pick a random game', '随机选一款游戏')}
                  className={`h-8 px-2.5 rounded-lg bg-[#1E232D] hover:bg-[#272F3E] border border-[#30394A] text-xs font-extrabold text-[#FDE047] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    isScreenRemoteLocked ? 'cursor-default opacity-75' : 'cursor-pointer'
                  }`}
                >
                  <Dices className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('Random', '随机')}</span>
                </button>
              </div>
            </div>

            {/* Single-Card 3D Flip Game Selector (1 game card at a time; Left/Right flips to prev/next) */}
            {(() => {
              const totalVisible = visibleGames.length;
              const currentIdx = Math.max(
                0,
                visibleGames.findIndex((g) => g.id === room.selectedGameId)
              );
              const activeCardGame = visibleGames[currentIdx] ?? selectedGame;
              const prevCardGame =
                totalVisible > 1
                  ? visibleGames[(currentIdx - 1 + totalVisible) % totalVisible]
                  : null;
              const nextCardGame =
                totalVisible > 1 ? visibleGames[(currentIdx + 1) % totalVisible] : null;
              const isCardFocused = focus.zone === 'games';
              const activeGenre = getGameGenre(activeCardGame.id);
              const activeCardPadGuide = getPadTutorialGuide(activeCardGame.id, lang);

              const stepGameCard = (dir: 1 | -1) => {
                if (totalVisible <= 1) return;
                const nextIdx = (currentIdx + dir + totalVisible) % totalVisible;
                const target = visibleGames[nextIdx];
                if (!target) return;
                setCardFlipDir(dir);
                handleSelectGame(target.id);
              };

              return (
                <div className="flex-1 min-h-0 w-full flex flex-col justify-between items-center pt-2 pb-1 px-1 sm:px-2">
                  {/* 3D Flip Deck Showcase Stage — Flex-1 so the card adapts directly to available height below the filter bar */}
                  <div
                    className="relative flex-1 min-h-0 w-full max-w-[920px] flex items-center justify-center py-2 px-2 sm:px-4"
                    style={{ perspective: '1500px' }}
                  >
                    {/* Shadowed Previous Card Silhouette (Left — xl+ where width cleanly holds side deck) */}
                    {prevCardGame && (
                      <button
                        type="button"
                        onClick={() => guardHostOnlyClick(() => stepGameCard(-1))}
                        aria-label={t(`Previous: ${prevCardGame.name}`, `上一个：${prevCardGame.name}`)}
                        title={t(`Previous: ${prevCardGame.name}`, `上一个：${prevCardGame.name}`)}
                        style={{
                          transform: 'scale(0.84) rotateY(16deg)',
                        }}
                        className={`group/prev hidden xl:flex flex-col absolute left-2 z-0 w-[38%] max-w-[310px] max-h-[88%] rounded-2xl overflow-hidden border border-[#2A3142]/80 bg-[#12151C] shadow-[0_20px_48px_rgba(0,0,0,0.85)] text-left transition-all duration-300 ${
                          isScreenRemoteLocked
                            ? 'pointer-events-none opacity-65'
                            : 'opacity-70 hover:opacity-95 hover:-translate-x-1 cursor-pointer'
                        }`}
                      >
                        <div className="relative flex-1 min-h-[90px] w-full bg-[#0C0E14] overflow-hidden">
                          <GameThumbnail
                            gameId={prevCardGame.id}
                            gameName={prevCardGame.name}
                            accentHex={prevCardGame.accentHex}
                            fallbackSrc={prevCardGame.coverImage}
                            alt={prevCardGame.name}
                            className="w-full h-full object-cover brightness-[0.36] saturate-[0.65] blur-[1px] transition-all duration-300 group-hover/prev:brightness-[0.52] group-hover/prev:blur-0"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0B0D12]/35 via-[#0B0D12]/55 to-[#0B0D12]/90" />
                        </div>
                        <div className="px-3.5 py-2.5 bg-[#10131A] shrink-0">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280] truncate">
                            {prevCardGame.category}
                          </div>
                          <div className="mt-0.5 font-display text-sm font-extrabold text-[#9CA3AF] truncate group-hover/prev:text-white transition-colors">
                            {prevCardGame.name}
                          </div>
                        </div>
                      </button>
                    )}

                    {/* Shadowed Next Card Silhouette (Right — xl+ where width cleanly holds side deck) */}
                    {nextCardGame && (
                      <button
                        type="button"
                        onClick={() => guardHostOnlyClick(() => stepGameCard(1))}
                        aria-label={t(`Next: ${nextCardGame.name}`, `下一个：${nextCardGame.name}`)}
                        title={t(`Next: ${nextCardGame.name}`, `下一个：${nextCardGame.name}`)}
                        style={{
                          transform: 'scale(0.84) rotateY(-16deg)',
                        }}
                        className={`group/next hidden xl:flex flex-col absolute right-2 z-0 w-[38%] max-w-[310px] max-h-[88%] rounded-2xl overflow-hidden border border-[#2A3142]/80 bg-[#12151C] shadow-[0_20px_48px_rgba(0,0,0,0.85)] text-right transition-all duration-300 ${
                          isScreenRemoteLocked
                            ? 'pointer-events-none opacity-65'
                            : 'opacity-70 hover:opacity-95 hover:translate-x-1 cursor-pointer'
                        }`}
                      >
                        <div className="relative flex-1 min-h-[90px] w-full bg-[#0C0E14] overflow-hidden">
                          <GameThumbnail
                            gameId={nextCardGame.id}
                            gameName={nextCardGame.name}
                            accentHex={nextCardGame.accentHex}
                            fallbackSrc={nextCardGame.coverImage}
                            alt={nextCardGame.name}
                            className="w-full h-full object-cover brightness-[0.36] saturate-[0.65] blur-[1px] transition-all duration-300 group-hover/next:brightness-[0.52] group-hover/next:blur-0"
                          />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-[#0B0D12]/35 via-[#0B0D12]/55 to-[#0B0D12]/90" />
                        </div>
                        <div className="px-3.5 py-2.5 bg-[#10131A] shrink-0">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280] truncate">
                            {nextCardGame.category}
                          </div>
                          <div className="mt-0.5 font-display text-sm font-extrabold text-[#9CA3AF] truncate group-hover/next:text-white transition-colors">
                            {nextCardGame.name}
                          </div>
                        </div>
                      </button>
                    )}

                    {/* Touch/Tablet Prev Button (< xl screens where tilted side cards are hidden) */}
                    {totalVisible > 1 && !isScreenRemoteLocked && (
                      <button
                        type="button"
                        onClick={() => guardHostOnlyClick(() => stepGameCard(-1))}
                        aria-label={t('Previous game', '上一个游戏')}
                        className="xl:hidden absolute left-0 sm:left-1 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-[#101217]/90 hover:bg-[#242A36] border border-[#384257] text-white flex items-center justify-center shadow-lg cursor-pointer"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                    )}

                    {/* Center Active Game Card — Constrained to 100% of stage height so its top/bottom border is NEVER covered by the filter bar or bottom bar */}
                    <div className="relative z-20 w-full max-w-[510px] h-full max-h-[450px] min-h-[290px] flex items-center justify-center px-3 sm:px-2">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={`${room.lobbyFilter}-${activeCardGame.id}`}
                          initial={{
                            rotateY: cardFlipDir > 0 ? 86 : -86,
                            opacity: 0,
                            scale: 0.94,
                          }}
                          animate={{
                            rotateY: 0,
                            opacity: 1,
                            scale: 1,
                          }}
                          exit={{
                            rotateY: cardFlipDir > 0 ? -86 : 86,
                            opacity: 0,
                            scale: 0.94,
                          }}
                          transition={{
                            duration: 0.24,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          style={{
                            transformStyle: 'preserve-3d',
                            backfaceVisibility: 'hidden',
                          }}
                          onClick={() =>
                            guardHostOnlyClick(() => {
                              if (canStartMatch) {
                                handleStartMatch();
                              } else {
                                handleSelectGame(activeCardGame.id);
                              }
                            })
                          }
                          className={`relative z-10 w-full h-full max-h-full flex flex-col rounded-2xl sm:rounded-3xl overflow-hidden border-2 bg-[#1A1E26] shadow-[0_18px_44px_rgba(0,0,0,0.78)] transition-colors ${
                            isCardFocused
                              ? 'ring-3 ring-[#FFB800] border-[#FFB800] shadow-[0_0_24px_rgba(255,184,0,0.42)]'
                              : 'border-[#333C4F] hover:border-[#00C2FF]/65'
                          } ${isScreenRemoteLocked ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          {/* Hero Artwork Thumbnail + Auto-Playing 5s Clip — Flex-1 min-h-[115px] automatically shrinks to fit remaining height */}
                          <div className="relative w-full flex-1 min-h-[115px] bg-[#101217] overflow-hidden">
                            <GameHoverPreview
                              gameId={activeCardGame.id}
                              gameName={activeCardGame.name}
                              accentHex={activeCardGame.accentHex}
                              fallbackSrc={activeCardGame.coverImage}
                              alt={activeCardGame.name}
                              active={true}
                              eager
                              immediate
                              timecodePosition="bottom-right"
                              className="w-full h-full object-cover"
                            />

                            {/* Genre Label Top-Left */}
                            <span
                              className={`pointer-events-none absolute top-2.5 left-2.5 z-10 px-2.5 py-0.5 rounded-lg font-mono text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider shadow-md ${
                                activeGenre === 'board'
                                  ? 'bg-[#A855F7]/92 text-white'
                                  : activeGenre === 'card'
                                  ? 'bg-[#10D98B]/92 text-[#071710]'
                                  : 'bg-[#101217]/88 text-[#00C2FF] border border-[#00C2FF]/45'
                              }`}
                            >
                              {getLocalizedFilterLabel(activeGenre, lang, true)}
                            </span>

                            {/* Deck Position Counter & TV OK Badge Top-Right */}
                            <div className="pointer-events-none absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded-lg bg-[#0D1017]/85 backdrop-blur-xs border border-white/15 font-mono text-[10px] sm:text-[11px] font-bold text-white tabular-nums shadow">
                                {String(currentIdx + 1).padStart(2, '0')} /{' '}
                                {String(Math.max(1, totalVisible)).padStart(2, '0')}
                              </span>
                              {isCardFocused && (
                                <span className="px-2 py-0.5 rounded-lg bg-[#FFB800] text-[#14120B] font-mono text-[10px] sm:text-[11px] font-black shadow">
                                  OK
                                </span>
                              )}
                            </div>

                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#1A1E26] to-transparent" />
                          </div>

                          {/* Card Body Details (Shrink-0 compact block so text and Pad Guide are always crisp and visible) */}
                          <div className="px-3.5 sm:px-5 pb-3 pt-1.5 shrink-0 bg-[#1A1E26]">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-[#9CA3AF]">
                              <span className="truncate font-semibold">
                                {activeCardGame.category} · {activeCardGame.playerModeLabel}
                              </span>
                              <span
                                className="font-mono text-[11px] font-bold shrink-0"
                                style={{ color: activeCardGame.accentHex }}
                              >
                                {activeSettingOpt?.label ?? room.gameSettingValue}
                              </span>
                            </div>

                            <h2 className="mt-0.5 font-display text-lg sm:text-xl xl:text-2xl font-extrabold text-white truncate">
                              {activeCardGame.name}
                            </h2>

                            <p className="mt-0.5 text-xs text-[#B8C0CE] line-clamp-2 leading-snug">
                              {activeCardGame.description}
                            </p>

                            <div className="mt-1.5 rounded-xl bg-[#101217]/90 border border-[#262C38] px-2.5 py-1.5 flex flex-col gap-0.5">
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <span
                                  className="inline-flex items-center gap-1.5 text-[11px] font-extrabold"
                                  style={{ color: activeCardPadGuide.accentHex }}
                                >
                                  <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>{activeCardPadGuide.padTitle}</span>
                                </span>
                                <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                                  {activeCardPadGuide.presetTag}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#D1D5DB] line-clamp-1 sm:line-clamp-2 leading-snug">
                                {activeCardPadGuide.shortTutorial}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    {/* Touch/Tablet Next Button (< xl screens where tilted side cards are hidden) */}
                    {totalVisible > 1 && !isScreenRemoteLocked && (
                      <button
                        type="button"
                        onClick={() => guardHostOnlyClick(() => stepGameCard(1))}
                        aria-label={t('Next game', '下一个游戏')}
                        className="xl:hidden absolute right-0 sm:right-1 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-[#101217]/90 hover:bg-[#242A36] border border-[#384257] text-white flex items-center justify-center shadow-lg cursor-pointer"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {/* Compact Adjacent Preview + Deck Progress Bar */}
                  {totalVisible > 1 && (
                    <div className="w-full max-w-[510px] flex items-center justify-between gap-3 px-3 pt-1 text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => guardHostOnlyClick(() => stepGameCard(-1))}
                        className={`text-[#9CA3AF] inline-flex items-center gap-1 truncate max-w-[36%] transition-colors ${
                          isScreenRemoteLocked ? 'cursor-default' : 'hover:text-white cursor-pointer'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{prevCardGame?.name}</span>
                      </button>

                      <div className="flex-1 max-w-[160px] h-1.5 rounded-full bg-[#242A36] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-200"
                          style={{
                            width: `${((currentIdx + 1) / totalVisible) * 100}%`,
                            backgroundColor: activeCardGame.accentHex,
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => guardHostOnlyClick(() => stepGameCard(1))}
                        className={`text-[#9CA3AF] inline-flex items-center justify-end gap-1 truncate max-w-[36%] transition-colors ${
                          isScreenRemoteLocked ? 'cursor-default' : 'hover:text-white cursor-pointer'
                        }`}
                      >
                        <span className="truncate">{nextCardGame?.name}</span>
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* RIGHT PANEL (5 cols tablet / 4 cols landscape): Spotlight + Live Ready Check */}
          <section className="md:col-span-5 lg:col-span-4 flex flex-col min-h-0 gap-2.5 sm:gap-3 md:overflow-y-auto no-scrollbar">
            {/* Compact Tablet Remote Indicator */}
            <div className="xl:hidden flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-[#1A1E26] border border-[#282E3B] text-[11px] font-bold shrink-0">
              {showDisconnectBanner ? (
                <button
                  type="button"
                  onClick={() => wsRef.current?.reconnectNow(true)}
                  className="inline-flex items-center gap-1.5 text-[#FF9B8A] truncate cursor-pointer"
                >
                  <Loader2 className="w-3.5 h-3.5 text-[#FFB800] animate-spin shrink-0" aria-hidden="true" />
                  <WifiOff className="w-3.5 h-3.5 text-[#FF4D2E] shrink-0" aria-hidden="true" />
                  <span>{t('Reconnecting... Tap to retry', '重连中... 点击重试')}</span>
                </button>
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
            <div className="rounded-2xl bg-[#1A1E26] border border-[#282E3B] p-3 sm:p-3.5 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#00C2FF] truncate">
                    {selectedGame.category} · {selectedGame.playerModeLabel}
                  </div>
                  <h2 className="font-display text-lg sm:text-xl font-extrabold text-white truncate mt-0.5">
                    {selectedGame.name}
                  </h2>
                </div>
                <span className="font-mono text-xs font-bold text-[#FFB800] bg-[#FFB800]/12 px-2.5 py-1 rounded-lg shrink-0">
                  {activeSettingOpt?.label ?? room.gameSettingValue}
                </span>
              </div>

              <p className="text-xs text-[#A5AEBD] mt-1 leading-snug line-clamp-2">{selectedGame.tagline}</p>

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

            {/* Live Ready Check Roster + Flexible Team Mode Switcher */}
            <div className="flex-1 min-h-[180px] rounded-2xl bg-[#1A1E26] border border-[#282E3B] p-3 sm:p-3.5 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2 shrink-0">
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

              {/* Compact Team Mode Pills inside Game Room */}
              <div className="mb-2.5 pb-2 border-b border-[#262C38] flex flex-wrap items-center gap-1 shrink-0">
                {TEAM_MODE_OPTIONS.map((opt) => {
                  const active = room.teamMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSetTeamMode(opt.id)}
                      className={`h-6 px-2 rounded-md text-[10px] font-extrabold inline-flex items-center gap-1 border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#FFB800] text-[#14120B] border-[#FFB800]'
                          : 'bg-[#101217] text-[#A5AEBD] border-[#262C38] hover:text-white'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{lang === 'zh' ? opt.labelZh : opt.label}</span>
                    </button>
                  );
                })}
                {room.teamMode !== 'ffa' && (
                  <button
                    type="button"
                    onClick={handleShuffleTeams}
                    title={t('Shuffle Teams', '随机分队')}
                    className="h-6 px-2 rounded-md bg-[#242A36] hover:bg-[#2E3646] text-[10px] font-bold text-[#00C2FF] inline-flex items-center gap-1 cursor-pointer ml-auto"
                  >
                    <Shuffle className="w-3 h-3" />
                    <span>{t('Shuffle', '打乱')}</span>
                  </button>
                )}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto arcade-scrollbar space-y-1.5 pr-1">
                {room.players.map((player) => {
                  const isHost = !player.isBot && room.hostPlayerId === player.id;
                  const botDiff = player.botDifficulty ?? room.botDifficulty;
                  const teamSpec = room.teamMode !== 'ffa' ? getTeamSpec(player.teamId) : null;
                  return (
                    <motion.div
                      key={player.id}
                      layout
                      className={`h-10 px-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                        player.ready && player.connected
                          ? 'bg-[#112620] border-[#10D98B]/55'
                          : 'bg-[#1E232D] border-[#2F3747]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <PlayerAvatar
                          avatarId={player.avatarId}
                          colorHex={player.color.hex}
                          size="xs"
                        />
                        {player.isBot && <Bot className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />}
                        {isHost && <Crown className="w-3.5 h-3.5 text-[#FFB800] shrink-0" />}
                        <span className="text-xs font-bold text-white truncate">{player.name}</span>
                        {teamSpec && (
                          <button
                            type="button"
                            title={t('Click to switch team', '点击切换队伍')}
                            onClick={() => handleCyclePlayerTeam(player.id, player.teamId)}
                            className="h-5 px-1.5 rounded text-[9px] font-mono font-black inline-flex items-center gap-0.5 border shrink-0 cursor-pointer hover:scale-105 transition-transform"
                            style={{
                              backgroundColor: `${teamSpec.colorHex}22`,
                              borderColor: `${teamSpec.colorHex}99`,
                              color: teamSpec.colorHex,
                            }}
                          >
                            <span>{teamSpec.emoji}</span>
                            <span>{lang === 'zh' ? teamSpec.nameZh : teamSpec.shortName}</span>
                          </button>
                        )}
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
                          <div className="flex items-center gap-1.5">
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
                            <button
                              type="button"
                              aria-label={t(`Kick ${player.name}`, `移出 ${player.name}`)}
                              title={t(`Kick ${player.name} from room`, `将 ${player.name} 移出房间`)}
                              onClick={() => handleKickPlayer(player.id)}
                              className={`h-6 rounded-md border flex items-center justify-center transition-colors cursor-pointer ${
                                !player.connected
                                  ? 'px-1.5 bg-[#2A191B] hover:bg-[#FF4D2E] border-[#FF4D2E]/50 text-[#FF9B8A] hover:text-white text-[10px] font-extrabold gap-0.5'
                                  : 'w-6 bg-[#101217] hover:bg-[#FF4D2E] border-[#262C38] text-[#9CA3AF] hover:text-white'
                              }`}
                            >
                              <X className="w-3.5 h-3.5" />
                              {!player.connected && <span>{t('Kick', '踢出')}</span>}
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {unreadyHumans.length > 0 && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-[#FFB800]/12 border border-[#FFB800]/35 text-[11px] text-[#FDE68A] leading-snug shrink-0 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 text-[#FFB800] animate-spin shrink-0" aria-hidden="true" />
                  <span>
                    {t('Waiting for', '等待')}{' '}
                    <strong className="text-white">
                      {unreadyHumans.map((p) => p.name).join(lang === 'zh' ? '、' : ', ')}
                    </strong>{' '}
                    {t('to press Ready on their phone.', '在手机上点击「准备」。')}
                  </span>
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
        <footer className="border-t border-[#242934] bg-[#151820] px-2.5 sm:px-5 py-2.5 sm:py-3 shrink-0">
          <div ref={actionsGridRef} className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2 p-0.5">
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
              <span className="text-[#9CA3AF] truncate">{t('Bot:', '机器人:')}</span>
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
        <RuleChatbotDrawer
          isOpen={ruleBotOpen}
          onClose={() => setRuleBotOpen(false)}
          activeGameId={room.selectedGameId}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW A3: 5-GAME CUP GROUP VOTING STAGE (3 Candidate Games w/ 5s Gameplay Clips!)
  // =========================================================================
  if (room.status === 'VOTING' && room.tournament?.vote) {
    return (
      <>
        {floatingEmoteOverlay}
        <CupVotingStage
          room={room}
          isScreenRemoteLocked={isScreenRemoteLocked}
          onCastOrLockGame={(gameId) =>
            guardHostOnlyClick(() => wsRef.current?.send({ type: 'tournament:vote', gameId }))
          }
          onForceLockVote={() => guardHostOnlyClick(handleForceLockCupVote)}
          onExitCup={() => guardHostOnlyClick(handleExitTournament)}
        />
        <TestControllerDrawer
          roomCode={room.code}
          open={testDrawerOpen}
          onClose={() => setTestDrawerOpen(false)}
        />
      </>
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
  const frenzyPerks = GAME_FRENZY_PERKS[room.selectedGameId] || {
    perk1En: '2× SCORE BOOST',
    perk1Zh: '双倍积分狂热',
    perk2En: '1.18× SPEED RUSH',
    perk2Zh: '1.18× 极速冲刺',
  };

  return (
    <div className="fixed inset-0 h-dvh w-full bg-[#121419] text-[#F4F6FA] flex flex-col overflow-hidden select-none">
      {floatingEmoteOverlay}

      {/* Streamlined Top Control Header (Never Crushes Player Stats) */}
      <header className="min-h-12 py-1.5 border-b border-[#242934] bg-[#151820] px-2.5 sm:px-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
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
          <span className="text-[11px] sm:text-xs font-mono text-[#9CA3AF] whitespace-nowrap shrink-0">
            · PIN <strong className="text-white">{room.code}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto sm:ml-0">
          {showDisconnectBanner && (
            <button
              type="button"
              onClick={() => wsRef.current?.reconnectNow(true)}
              className="h-8 px-2.5 rounded-lg bg-[#FF4D2E]/20 border border-[#FF4D2E]/50 text-[#FF9B8A] hover:text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Loader2 className="w-3.5 h-3.5 text-[#FFB800] animate-spin shrink-0" aria-hidden="true" />
              <WifiOff className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{t('Reconnect', '点击重连')}</span>
            </button>
          )}
          {!showDisconnectBanner && !activeHostPlayer && (
            <span className="hidden xl:inline-flex h-8 px-2.5 rounded-lg bg-[#00C2FF]/15 border border-[#00C2FF]/40 text-[#00C2FF] text-xs font-bold items-center gap-1.5 whitespace-nowrap">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>{t('Mouse Control', '鼠标控制')}</span>
            </span>
          )}
          {audioUnlockButton}
          <LanguageToggle compact className="h-8" />

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
            onClick={() => setShowInGameTutorial(true)}
            title={t('In-Game Tutorial', '游戏教程')}
            className="h-8 px-2.5 rounded-lg bg-[#00C2FF]/20 hover:bg-[#00C2FF]/30 border border-[#00C2FF]/50 text-[#00C2FF] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span className="hidden sm:inline">{t('Tutorial', '教程')}</span>
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

      {/* Real-Time Placement Leaderboard Top Bar (Smoothly reorders live according to game points) */}
      {(() => {
        const maxLiveScore = rankedLivePlayers.reduce(
          (m, entry) => Math.max(m, entry.player.score),
          0
        );
        const showTeamBar = room.teamMode !== 'ffa' && room.teamRankings.length > 0;
        return (
          <div className="border-b border-[#242934] bg-[#10131A]/95 px-2.5 sm:px-5 py-1.5 shrink-0 space-y-1.5">
            {showTeamBar && (
              <LayoutGroup id="live-team-bar-standings">
                <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-center gap-2">
                  {room.teamRankings.map((team) => {
                    const spec = getTeamSpec(team.teamId);
                    if (!spec) return null;
                    const isLeadingTeam = team.rank === 1 && team.score > 0;
                    return (
                      <motion.div
                        key={team.teamId}
                        layout="position"
                        transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                        className={`px-2.5 py-0.5 rounded-lg border text-xs font-extrabold inline-flex items-center gap-1.5 ${
                          isLeadingTeam ? 'shadow-[0_0_12px_rgba(255,184,0,0.2)]' : ''
                        }`}
                        style={{
                          backgroundColor: `${spec.colorHex}1E`,
                          borderColor: isLeadingTeam ? '#FFB800' : `${spec.colorHex}80`,
                        }}
                      >
                        <span className="font-mono text-[10px] font-black text-[#FFB800]">
                          #{team.rank}
                        </span>
                        <span>{spec.emoji}</span>
                        <span style={{ color: spec.colorHex }}>
                          {lang === 'zh' ? spec.nameZh : spec.name}
                        </span>
                        <span className="font-mono text-white tabular-nums">
                          {team.score} {t('pts', '分')}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </LayoutGroup>
            )}

            <LayoutGroup id="live-top-bar-standings">
              <div className="monitor-standings-strip max-w-[1440px] mx-auto grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                {rankedLivePlayers.map(({ player: p, position }) => {
                  const isLeader = maxLiveScore > 0 && p.score === maxLiveScore;
                  const isTurnActive =
                    room.status === 'PLAYING' && liveTurnInfo.activePlayerId === p.id;
                  const shift = rankShifts[p.id] ?? 0;
                  const teamSpec = room.teamMode !== 'ffa' ? getTeamSpec(p.teamId) : null;
                  const rankBadgeClass =
                    position === 1 && maxLiveScore > 0
                      ? 'bg-[#FFB800] text-[#14120B]'
                      : position === 2 && maxLiveScore > 0
                      ? 'bg-[#CBD5E1] text-[#0F172A]'
                      : position === 3 && maxLiveScore > 0
                      ? 'bg-[#D97742] text-[#1A0F08]'
                      : 'bg-[#222836] text-[#9CA3AF]';

                  const statLabel = translateGameText(p.statText, lang);
                  const statAlreadyShowsScore =
                    p.score > 0 && statLabel.includes(String(p.score));

                  return (
                    <motion.div
                      key={p.id}
                      layout="position"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg border flex items-center justify-between lg:justify-start gap-1.5 sm:gap-2 text-xs whitespace-nowrap transition-colors ${
                        !p.alive
                          ? 'bg-[#14171F]/60 border-[#222733] opacity-50'
                          : shift > 0
                          ? 'bg-[#102820] border-[#10D98B] shadow-[0_0_14px_rgba(16,217,139,0.28)]'
                          : isTurnActive
                          ? 'bg-[#102622] border-[#10D98B] shadow-[0_0_12px_rgba(16,217,139,0.22)]'
                          : isLeader
                          ? 'bg-[#221D11] border-[#FFB800]/75 shadow-[0_0_12px_rgba(255,184,0,0.18)]'
                          : 'bg-[#171B24] border-[#262D3D]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {/* Real-Time Placement Rank (#1, #2, #3...) */}
                        <span
                          className={`min-w-[22px] h-5 px-1 rounded font-mono text-[10px] font-black inline-flex items-center justify-center gap-0.5 tabular-nums shrink-0 ${rankBadgeClass}`}
                        >
                          {position === 1 && maxLiveScore > 0 && (
                            <Crown className="w-2.5 h-2.5 shrink-0" />
                          )}
                          <span>#{position}</span>
                        </span>

                        {/* Live Placement Shift Flash (▲ climbed / ▼ dropped) */}
                        {shift !== 0 && (
                          <motion.span
                            key={`${p.id}-shift-${position}`}
                            initial={{ opacity: 0, y: shift > 0 ? 5 : -5, scale: 0.75 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`font-mono text-[10px] font-black leading-none shrink-0 ${
                              shift > 0 ? 'text-[#10D98B]' : 'text-[#FF6B52]'
                            }`}
                          >
                            {shift > 0 ? `▲${shift}` : `▼${Math.abs(shift)}`}
                          </motion.span>
                        )}

                        <PlayerAvatar
                          avatarId={p.avatarId}
                          colorHex={p.color.hex}
                          size="xs"
                        />
                        {teamSpec && (
                          <span
                            className="px-1 py-0.5 rounded text-[9px] font-mono font-black shrink-0"
                            style={{
                              backgroundColor: `${teamSpec.colorHex}25`,
                              color: teamSpec.colorHex,
                            }}
                          >
                            {teamSpec.emoji}
                          </span>
                        )}
                        {p.isBot && <Bot className="w-3 h-3 text-[#00C2FF] shrink-0" />}
                        <span className="font-bold text-white truncate max-w-[74px] sm:max-w-[104px]">
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
                          {statLabel}
                        </span>
                        {p.score > 0 && !statAlreadyShowsScore && (
                          <span className="font-mono text-[10px] font-bold text-[#9CA3AF] tabular-nums">
                            ({p.score} {t('pts', '分')})
                          </span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </LayoutGroup>
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
                  <div className="relative max-w-2xl w-[92%] rounded-3xl bg-gradient-to-r from-[#2D0D09]/95 via-[#43140A]/96 to-[#1D0B0E]/95 border-2 border-[#FF8A00] px-4 py-5 sm:px-10 sm:py-9 text-center shadow-[0_0_80px_rgba(255,77,46,0.85)]">
                    {/* Trailing Fire Tail on the Right Edge */}
                    <div className="pointer-events-none absolute -right-14 inset-y-4 w-20 bg-gradient-to-l from-transparent via-[#FF5E1A]/45 to-[#FFB800]/65 blur-xl rounded-full" />
                    <div className="pointer-events-none absolute -left-8 inset-y-6 w-14 bg-gradient-to-r from-transparent to-[#FF4D2E]/50 blur-lg rounded-full" />

                    <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-[#FF4D2E]/30 border border-[#FFB800]/75 text-[#FFE066] font-mono text-[11px] sm:text-sm font-black tracking-widest uppercase shadow-[0_0_20px_rgba(255,138,0,0.45)]">
                      <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FFB800] animate-pulse shrink-0" />
                      <span>{t('FINAL STRETCH · OVERDRIVE UNLOCKED', '终局高能时刻 · 全场沸腾')}</span>
                      <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FFB800] animate-pulse shrink-0" />
                    </div>

                    <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2 sm:gap-4">
                      <Flame className="w-8 h-8 sm:w-12 sm:h-12 text-[#FFB800] drop-shadow-[0_0_18px_#FF5E1A] shrink-0 animate-pulse" />
                      <h2 className="font-display text-2xl sm:text-5xl lg:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-[#FFF7CC] via-[#FFB800] to-[#FF4D2E] drop-shadow-[0_4px_24px_rgba(255,77,46,0.95)]">
                        {t('FRENZY MODE!', '烈焰狂热模式！')}
                      </h2>
                      <Flame className="w-8 h-8 sm:w-12 sm:h-12 text-[#FFB800] drop-shadow-[0_0_18px_#FF5E1A] shrink-0 animate-pulse" />
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
                className="max-w-5xl w-full max-h-full flex flex-col overflow-y-auto arcade-scrollbar rounded-2xl sm:rounded-3xl bg-[#1A1E26] border-2 border-[#2F3747] shadow-2xl"
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
                <div className="flex flex-row items-center gap-3 sm:gap-4 px-4 py-3 border-b border-[#262C38] bg-[#151820] shrink-0">
                  <div className="w-20 sm:w-28 aspect-video rounded-xl overflow-hidden bg-[#101217] border border-[#2A303D] shrink-0">
                    <GameThumbnail
                      gameId={selectedGame.id}
                      gameName={selectedGame.name}
                      accentHex={selectedGame.accentHex}
                      fallbackSrc={selectedGame.coverImage}
                      alt={selectedGame.name}
                      className="w-full h-full object-cover"
                      eager
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#00C2FF]">
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
                    <h2 className="font-display text-lg sm:text-2xl font-extrabold text-white mt-0.5 truncate">
                      {selectedGame.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-[#D1D5DB] truncate">{selectedGame.tagline}</p>
                  </div>
                </div>

                {/* Body: One-page Rule List + Animations Beside Rules (Zero Scroll Needed) */}
                <div className="p-3.5 sm:p-4 shrink-0">
                  <BriefingTutorialCard
                    gameId={selectedGame.id}
                    gameName={selectedGame.name}
                    accentHex={selectedGame.accentHex}
                    rules={selectedGame.rules}
                  />
                </div>

                {/* Live Ready Progress + Per-Player Ready Chips (NO auto-countdown!) */}
                <div className="px-4 sm:px-5 py-3 bg-[#151820] border-t border-[#262C38] space-y-2.5 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs sm:text-sm font-bold text-white">
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
                  <div className="h-2 w-full rounded-full bg-[#242A36] overflow-hidden">
                    <motion.div
                      className="h-full bg-[#10D98B] rounded-full"
                      initial={false}
                      animate={{ width: `${briefingReadyPercent}%` }}
                      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    />
                  </div>

                  {/* Player Ready Chips */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {room.players.map((p) => {
                      const isReady = p.isBot || (p.connected && p.ready);
                      const teamSpec = room.teamMode !== 'ffa' ? getTeamSpec(p.teamId) : null;
                      return (
                        <motion.div
                          key={p.id}
                          animate={{ scale: isReady ? [1, 1.08, 1] : 1 }}
                          transition={{ duration: 0.28 }}
                          className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 ${
                            isReady
                              ? 'bg-[#10D98B]/20 border-[#10D98B] text-[#6EE7B7]'
                              : 'bg-[#1E232D] border-[#2F3747] text-[#D1D5DB]'
                          }`}
                        >
                          <PlayerAvatar
                            avatarId={p.avatarId}
                            colorHex={p.color.hex}
                            size="xs"
                          />
                          {teamSpec && (
                            <span
                              className="text-[10px] font-black"
                              style={{ color: teamSpec.colorHex }}
                            >
                              {teamSpec.emoji}
                            </span>
                          )}
                          {p.isBot && <Bot className="w-3.5 h-3.5 text-[#00C2FF]" />}
                          <span>{p.name}</span>
                          {isReady ? (
                            <Check className="w-3.5 h-3.5 text-[#10D98B]" />
                          ) : !p.connected ? (
                            <span className="text-[10px] text-[#FF9B8A]">
                              {t('Offline', '离线')}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#FFB800]">
                              {t('Reading...', '阅读中...')}
                            </span>
                          )}
                          {!p.isBot && (
                            <button
                              type="button"
                              aria-label={t(`Kick ${p.name}`, `移出 ${p.name}`)}
                              title={t(`Kick ${p.name}`, `移出 ${p.name}`)}
                              onClick={() => handleKickPlayer(p.id)}
                              className="ml-0.5 h-4 w-4 rounded bg-[#101217]/80 hover:bg-[#FF4D2E] text-[#9CA3AF] hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
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
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/65 backdrop-blur-xs rounded-2xl p-3 sm:p-6 overflow-y-auto">
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
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
            const isFinaleGame =
              Boolean(tournament) &&
              tournament!.currentGameIndex + 1 >= tournament!.totalGames;
            const champ = tournament?.standings[0] ?? null;
            const isTeamMode = room.teamMode !== 'ffa';
            const cupTeamStandings = tournament?.teamStandings ?? [];
            const winningCupTeam = isTeamMode ? cupTeamStandings[0] ?? null : null;
            const winningCupTeamSpec = winningCupTeam ? getTeamSpec(winningCupTeam.teamId) : null;
            const winningMatchTeam = isTeamMode ? room.teamRankings[0] ?? null : null;
            const winningMatchTeamSpec = winningMatchTeam ? getTeamSpec(winningMatchTeam.teamId) : null;

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
                            ? t('5-GAME CUP FINAL', '5局锦标赛总决赛落幕')
                            : t(
                                `5-GAME CUP · MATCH ${tournament.currentGameIndex + 1}/${tournament.totalGames}`,
                                `5局锦标赛 · 第 ${tournament.currentGameIndex + 1} / ${tournament.totalGames} 局`
                              )}
                        </span>
                        {isFinaleGame && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-[#FF4D2E] text-white text-[10px]">
                            {t('1.5× MARKS', '1.5× 积分')}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-2.5 font-display text-2xl sm:text-3xl font-extrabold text-white">
                        {tournament.completed
                          ? winningCupTeamSpec
                            ? t(
                                `${winningCupTeamSpec.emoji} ${winningCupTeamSpec.name} Wins the Cup!`,
                                `${winningCupTeamSpec.emoji} ${winningCupTeamSpec.nameZh} 夺得锦标赛总冠军！`
                              )
                            : champ
                            ? t(
                                `👑 ${champ.name} is Grand Champion!`,
                                `👑 ${champ.name} 夺得总冠军！`
                              )
                            : t('Tournament Complete!', '锦标赛圆满结束！')
                          : winningMatchTeamSpec
                          ? t(
                              `${winningMatchTeamSpec.emoji} ${winningMatchTeamSpec.name} Wins ${selectedGame.name}!`,
                              `${winningMatchTeamSpec.emoji} ${winningMatchTeamSpec.nameZh} 拿下 ${selectedGame.name}！`
                            )
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
                              'Cumulative Marks across all 5 group-voted games decide the champion!',
                              '5局全员投票对决累计总积分（Marks）最高者登顶总冠军！'
                            )
                          : t(
                              `This Round: ${selectedGame.name} · Next game will be chosen by group vote!`,
                              `本局：${selectedGame.name} · 下一局将由全员看 5 秒实机视频投票决定！`
                            )}
                      </p>

                      {/* 5-Game Cup Progress Pills (Played + Upcoming Group Vote Slots) */}
                      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
                        {Array.from({ length: tournament.totalGames }).map((_, idx) => {
                          const gId = tournament.gameQueue[idx];
                          const gMeta = gId ? getLocalizedGameMeta(getGameMeta(gId), lang) : null;
                          const played = tournament.history[idx];
                          const isCurrent = idx === tournament.currentGameIndex;
                          return (
                            <div
                              key={`cup-slot-${idx}`}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1.5 ${
                                isCurrent
                                  ? 'bg-[#262C38] border-[#FFB800] text-white'
                                  : played
                                  ? 'bg-[#101217] border-[#10D98B]/45 text-[#A7F3D0]'
                                  : 'bg-[#101217] border-[#262C38] text-[#6B7280]'
                              }`}
                            >
                              <span className="font-mono text-[10px]">#{idx + 1}</span>
                              <span className="truncate max-w-[100px]">
                                {gMeta ? gMeta.name : t('Group Vote', '待投票')}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Cup Team Standings Breakdown when Team Mode is active */}
                      {isTeamMode && cupTeamStandings.length > 0 && (
                        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                          {cupTeamStandings.map((team) => {
                            const spec = getTeamSpec(team.teamId);
                            if (!spec) return null;
                            return (
                              <div
                                key={team.teamId}
                                className="px-3.5 py-2 rounded-xl border flex items-center justify-between gap-2"
                                style={{
                                  backgroundColor: `${spec.colorHex}18`,
                                  borderColor: team.rank === 1 ? '#FFB800' : `${spec.colorHex}75`,
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-xs font-black text-[#FFB800]">
                                    #{team.rank}
                                  </span>
                                  <span>{spec.emoji}</span>
                                  <span className="font-bold text-sm truncate" style={{ color: spec.colorHex }}>
                                    {lang === 'zh' ? spec.nameZh : spec.name}
                                  </span>
                                </div>
                                <span className="font-mono text-sm font-black text-white tabular-nums shrink-0">
                                  {team.score} {t('Marks', '积分')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Cumulative Tournament Standings */}
                      <div className="mt-4 space-y-2 text-left max-h-[240px] overflow-y-auto arcade-scrollbar pr-1.5">
                        {tournament.standings.map((entry) => {
                          const teamSpec = isTeamMode ? getTeamSpec(entry.teamId) : null;
                          return (
                            <div
                              key={entry.playerId}
                              className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                                entry.rank === 1
                                  ? 'bg-[#221D11] border-[#FFB800]/70'
                                  : 'bg-[#101217] border-[#262C38]'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={`font-mono text-sm font-black w-6 tabular-nums ${
                                    entry.rank === 1 ? 'text-[#FFB800]' : 'text-[#9CA3AF]'
                                  }`}
                                >
                                  #{entry.rank}
                                </span>
                                <PlayerAvatar
                                  avatarId={entry.avatarId}
                                  colorHex={entry.color.hex}
                                  size="sm"
                                />
                                {entry.isBot && <Bot className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />}
                                <div className="min-w-0">
                                  <div className="font-semibold text-white truncate flex items-center gap-1.5">
                                    <span className="truncate">{entry.name}</span>
                                    {teamSpec && (
                                      <span
                                        className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black shrink-0"
                                        style={{
                                          backgroundColor: `${teamSpec.colorHex}22`,
                                          color: teamSpec.colorHex,
                                        }}
                                      >
                                        {teamSpec.emoji} {lang === 'zh' ? teamSpec.nameZh : teamSpec.shortName}
                                      </span>
                                    )}
                                  </div>
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
                          );
                        })}
                      </div>

                      {!tournament.completed && (
                        <div className="mt-4 px-4 py-2.5 rounded-xl bg-[#101217] border border-[#00C2FF]/45 flex items-center justify-between gap-2 text-xs">
                          <span className="font-bold text-[#00C2FF]">
                            {t(
                              `Up Next · Match ${tournament.currentGameIndex + 2}/${tournament.totalGames}`,
                              `下一局 · 第 ${tournament.currentGameIndex + 2}/${tournament.totalGames} 局`
                            )}
                          </span>
                          <span className="font-display font-extrabold text-sm text-white truncate">
                            {t('Live 3-Game Group Vote (5s Clips)', '全员 3 选 1 实机视频投票')}
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
                              <span>{t('New 5-Game Cup', '再来一届 5 局锦标赛')}</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 fill-current" />
                              <span>
                                {t(
                                  `Vote Next Game (${tournament.currentGameIndex + 2}/${tournament.totalGames})`,
                                  `投票选第 ${tournament.currentGameIndex + 2} 局`
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
                        {winningMatchTeamSpec
                          ? t(
                              `${winningMatchTeamSpec.emoji} ${winningMatchTeamSpec.name} Wins!`,
                              `${winningMatchTeamSpec.emoji} ${winningMatchTeamSpec.nameZh} 获胜！`
                            )
                          : room.rankings[0]
                          ? t(`${room.rankings[0].name} Wins!`, `${room.rankings[0].name} 获胜！`)
                          : t('Match Complete', '本局结束')}
                      </h2>
                      <p className="text-sm text-[#9CA3AF] mt-1">
                        {selectedGame.name} · {t('Final Standings', '最终排名')}
                        {room.activeMutator !== 'normal'
                          ? ` · ${lang === 'zh' ? activeMutatorSpec.shortTagZh : activeMutatorSpec.shortTag}`
                          : ''}
                      </p>

                      {isTeamMode && room.teamRankings.length > 0 && (
                        <div className="mt-4 space-y-1.5 text-left">
                          {room.teamRankings.map((team) => {
                            const spec = getTeamSpec(team.teamId);
                            if (!spec) return null;
                            return (
                              <div
                                key={team.teamId}
                                className="flex items-center justify-between px-3.5 py-2 rounded-xl border"
                                style={{
                                  backgroundColor: `${spec.colorHex}18`,
                                  borderColor: team.rank === 1 ? '#FFB800' : `${spec.colorHex}75`,
                                }}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-xs font-black text-[#FFB800]">
                                    #{team.rank}
                                  </span>
                                  <span>{spec.emoji}</span>
                                  <span className="font-bold text-sm" style={{ color: spec.colorHex }}>
                                    {lang === 'zh' ? spec.nameZh : spec.name}
                                  </span>
                                  <span className="text-[11px] text-[#9CA3AF] truncate">
                                    ({team.memberCount} {t('players', '人')})
                                  </span>
                                </div>
                                <span className="font-mono text-sm font-black text-white tabular-nums">
                                  {team.score} {t('pts', '分')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="mt-4 space-y-2 text-left max-h-[260px] overflow-y-auto arcade-scrollbar pr-1.5">
                        {room.rankings.map((entry) => {
                          const isBotEntry = room.players.find((p) => p.id === entry.playerId)?.isBot;
                          const teamSpec = isTeamMode ? getTeamSpec(entry.teamId) : null;
                          return (
                            <div
                              key={entry.playerId}
                              className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#101217] border border-[#262C38]"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="font-mono text-sm font-bold text-[#FFB800] w-6 tabular-nums">
                                  #{entry.rank}
                                </span>
                                <PlayerAvatar
                                  avatarId={entry.avatarId}
                                  colorHex={entry.color.hex}
                                  size="sm"
                                />
                                {isBotEntry && <Bot className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />}
                                <span className="font-semibold text-white truncate">{entry.name}</span>
                                {teamSpec && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[9px] font-mono font-black shrink-0"
                                    style={{
                                      backgroundColor: `${teamSpec.colorHex}22`,
                                      color: teamSpec.colorHex,
                                    }}
                                  >
                                    {teamSpec.emoji} {lang === 'zh' ? teamSpec.nameZh : teamSpec.shortName}
                                  </span>
                                )}
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

                      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
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

      {showInGameTutorial && selectedGame && (
        <GameTutorialOverlay
          gameId={selectedGame.id}
          gameName={selectedGame.name}
          accentHex={selectedGame.accentHex}
          rules={selectedGame.rules}
          onClose={() => setShowInGameTutorial(false)}
          onPlayNow={() => setShowInGameTutorial(false)}
        />
      )}
    </div>
  );
}
