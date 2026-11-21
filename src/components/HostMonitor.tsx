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
  Pause,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  Settings2,
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
  PlayerFilterMode,
  RoomSnapshot,
  ServerMessage,
} from '../shared/types';
import { arcadeAudio } from '../lib/audio';
import { getJoinUrl, ManagedWebSocket } from '../lib/ws';
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

const DIFFICULTY_OPTIONS: { id: BotDifficulty; label: string; color: string; hint: string }[] = [
  { id: 'chill', label: 'Chill', color: '#10D98B', hint: 'Easy & friendly pace' },
  { id: 'arcade', label: 'Arcade', color: '#00C2FF', hint: 'Fun medium challenge' },
  { id: 'spicy', label: 'Spicy', color: '#FF4D2E', hint: 'Fast & sharp rivals' },
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

function difficultyLabel(d?: BotDifficulty): string {
  if (d === 'chill') return 'Chill';
  if (d === 'spicy') return 'Spicy';
  return 'Arcade';
}

export function HostMonitor({ initialGameId = 'bumper-brawl', onExit }: HostMonitorProps) {
  const [wsConnected, setWsConnected] = useState(false);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [testDrawerOpen, setTestDrawerOpen] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [playerFilter, setPlayerFilter] = useState<PlayerFilterMode>('all');
  const [floatingEmotes, setFloatingEmotes] = useState<FloatingEmote[]>([]);

  const wsRef = useRef<ManagedWebSocket | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const latestSnapshotRef = useRef<GameSnapshot | null>(null);
  const fxRef = useRef(createRenderFxState());

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

  // Generate QR code whenever room code changes
  useEffect(() => {
    if (!room?.code) return;
    const url = getJoinUrl(room.code);
    QRCode.toDataURL(url, {
      width: 280,
      margin: 2,
      color: { dark: '#121419', light: '#FFFFFF' },
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => setQrDataUrl(''));
  }, [room?.code]);

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
          renderGameSnapshot(ctx, snap, fxRef.current);
        }
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [room?.status]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    arcadeAudio.setMuted(next);
  };

  const handleCopyJoinLink = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(getJoinUrl(room.code));
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
      <div className="min-h-screen bg-[#111326] text-white flex flex-col items-center justify-center p-6">
        <div className="font-display text-2xl font-bold">Creating Game Room...</div>
        <p className="mt-2 text-sm text-[#A5B4FC]">Connecting to live multiplayer server</p>
      </div>
    );
  }

  const selectedGame = getGameMeta(room.selectedGameId);
  const joinUrl = getJoinUrl(room.code);
  const displayJoinHost =
    typeof window !== 'undefined' ? `${window.location.host}` : 'joinstick.arcade';
  const humans = room.players.filter((p) => !p.isBot);
  const connectedHumans = humans.filter((p) => p.connected);
  const bots = room.players.filter((p) => p.isBot);
  const readyHumans = connectedHumans.filter((p) => p.ready);
  const unreadyHumans = connectedHumans.filter((p) => !p.ready);
  const canStartMatch = room.players.length > 0 && unreadyHumans.length === 0;
  const isRoomFull = room.players.length >= MAX_PLAYERS_PER_ROOM;

  // Shared floating Kahoot-style live reaction overlay
  const floatingEmoteOverlay = (
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
  );

  // =========================================================================
  // VIEW A1: KAHOOT-STYLE INTERACTIVE ROOM SETUP STAGE
  // =========================================================================
  if (room.status === 'SETUP') {
    const activeDifficultyMeta =
      DIFFICULTY_OPTIONS.find((d) => d.id === room.botDifficulty) ?? DIFFICULTY_OPTIONS[1];

    return (
      <div className="min-h-screen bg-[#121029] text-white flex flex-col relative overflow-hidden">
        {/* Vibrant Kahoot-inspired party spotlight & geometric backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-32 -left-24 w-[480px] h-[480px] rounded-full bg-[#5B21B6]/35 blur-[110px]" />
          <div className="absolute top-1/3 -right-24 w-[460px] h-[460px] rounded-full bg-[#0284C7]/25 blur-[120px]" />
          <div className="absolute -bottom-32 left-1/3 w-[440px] h-[440px] rounded-full bg-[#FF4D2E]/20 blur-[120px]" />
          <div className="absolute top-24 left-12 w-20 h-20 rounded-2xl border-2 border-white/6 rotate-12" />
          <div className="absolute bottom-24 right-16 w-28 h-28 rounded-full border-2 border-white/6" />
          <div className="absolute top-1/2 left-8 w-12 h-12 rounded-lg bg-white/[0.03] -rotate-12" />
        </div>

        {floatingEmoteOverlay}

        {/* Top Bar */}
        <header className="relative z-10 border-b border-white/10 bg-[#0E0D22]/75 backdrop-blur-md">
          <div className="max-w-[1380px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={handleLeaveHost}
                className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Home
              </button>
              <span className="font-display text-lg font-extrabold text-white whitespace-nowrap shrink-0">
                JoinStick Party Stage
              </span>
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-[#C4B5FD]">
                <span
                  className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#10D98B]' : 'bg-[#FFB800]'}`}
                />
                {wsConnected ? 'Live Room Open' : 'Reconnecting...'}
              </span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setTestDrawerOpen((v) => !v)}
                className={`tactile-btn h-10 px-4 rounded-xl text-sm font-bold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  testDrawerOpen
                    ? 'bg-[#00C2FF] text-[#0B1219]'
                    : 'bg-white/10 hover:bg-white/15 text-white border border-white/15'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                Test Controller
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="h-10 w-10 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Main Kahoot-Style Party Stage */}
        <main className="relative z-10 flex-1 max-w-[1380px] w-full mx-auto px-6 py-7 flex flex-col gap-6">
          {/* HERO JOIN PIN + QR BANNER (Just like Kahoot's iconic top PIN banner!) */}
          <section className="rounded-3xl bg-[#1A173B]/90 border-2 border-white/15 shadow-2xl p-5 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Left: Join instructions & quick links */}
              <div className="lg:col-span-4 space-y-3 text-center lg:text-left">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#38BDF8]">
                  <Sparkles className="w-4 h-4" />
                  Step 1 · Join on Your Phone
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                  Scan QR or enter the PIN to jump in!
                </h1>
                <p className="text-xs text-[#C7D2FE] truncate">
                  Open <strong className="text-white">{displayJoinHost}</strong> on any phone
                </p>
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyJoinLink}
                    className="h-10 px-4 rounded-xl bg-white/12 hover:bg-white/20 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    {copied ? <Check className="w-4 h-4 text-[#10D98B]" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Link Copied!' : 'Copy Join Link'}
                  </button>
                  <a
                    href={joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-10 px-4 rounded-xl bg-white/12 hover:bg-white/20 text-xs font-bold text-[#38BDF8] inline-flex items-center gap-1.5"
                  >
                    Open Phone Tab
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Center: Giant Game PIN Card */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <div className="w-full max-w-md rounded-2xl bg-white text-[#111322] px-6 py-5 shadow-[0_8px_0_rgba(0,0,0,0.35)] text-center">
                  <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#4F46E5]">
                    Game PIN
                  </div>
                  <div className="mt-1 font-mono text-5xl sm:text-6xl font-black tracking-[0.26em] text-[#0F1020] tabular-nums pl-[0.26em]">
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
                      alt={`QR code to join room ${room.code}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-[#6B7280]">Loading QR...</div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* LIVE ACTION BAR: Player Counter + Robot Assignment + Difficulty + Enter Game Room CTA */}
          <section className="rounded-2xl bg-[#181636]/90 border border-white/12 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
            {/* Big Player Counter */}
            <div className="flex items-center gap-3">
              <motion.div
                key={room.players.length}
                initial={{ scale: 1.25 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 450, damping: 18 }}
                className="h-12 px-4 rounded-xl bg-[#4F46E5] text-white font-display font-extrabold text-lg inline-flex items-center gap-2 shadow-[0_4px_0_#312E81]"
              >
                <Users className="w-5 h-5" />
                <span className="tabular-nums">
                  {room.players.length} / {MAX_PLAYERS_PER_ROOM}
                </span>
              </motion.div>
              <div className="text-xs leading-snug text-[#C7D2FE]">
                <div className="text-white font-bold text-sm">
                  {humans.length} Player{humans.length === 1 ? '' : 's'} · {bots.length} Robot
                  {bots.length === 1 ? '' : 's'}
                </div>
                <div>Players can tap emojis on their phone while waiting!</div>
              </div>
            </div>

            {/* Robot Controls: + Add Robot & Chill / Arcade / Spicy */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAddBot}
                disabled={isRoomFull}
                className="tactile-btn h-12 px-4 rounded-xl bg-[#0EA5E9] hover:bg-[#38BDF8] disabled:opacity-40 disabled:cursor-not-allowed text-[#08131E] font-display font-extrabold text-sm shadow-[0_4px_0_#0369A1] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <Bot className="w-4 h-4" />
                <span>Add Robot</span>
              </button>

              <div className="flex flex-col items-start sm:items-end gap-0.5">
                <div
                  role="radiogroup"
                  aria-label="Robot difficulty"
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0E0D22] border border-white/12"
                >
                  {DIFFICULTY_OPTIONS.map((opt) => {
                    const active = room.botDifficulty === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => handleSetBotDifficulty(opt.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer ${
                          active ? 'text-[#0B1016]' : 'text-[#C7D2FE] hover:text-white'
                        }`}
                        style={active ? { backgroundColor: opt.color } : undefined}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] text-[#A5B4FC]">{activeDifficultyMeta.hint}</span>
              </div>

              <button
                type="button"
                onClick={handleEnterGameRoom}
                disabled={room.players.length === 0}
                className="tactile-btn h-12 px-6 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6548] disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-extrabold text-base shadow-[0_4px_0_#B82E17] inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
              >
                <span>Enter Game Room</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#FF4D2E]/20 border border-[#FF4D2E]/50 text-sm text-[#FFD2C9] font-medium">
              {errorMsg}
            </div>
          )}

          {/* LIVE INTERACTIVE PLAYER STAGE (Kahoot-style spring pop-in name cards!) */}
          <section className="flex-1 rounded-3xl bg-[#161433]/75 border border-white/12 p-6 sm:p-8 flex flex-col justify-center min-h-[260px]">
            {room.players.length === 0 ? (
              <div className="text-center max-w-lg mx-auto py-8">
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                  className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 text-[#38BDF8] mb-4"
                >
                  <Smartphone className="w-8 h-8" />
                </motion.div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Waiting for players to join...
                </h2>
                <p className="mt-2 text-sm text-[#C7D2FE]">
                  Scan the QR code or type PIN <strong className="font-mono text-white">{room.code}</strong> on your phone — or add AI robots to play right now!
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setTestDrawerOpen(true)}
                    className="tactile-btn h-11 px-5 rounded-xl bg-white/12 hover:bg-white/20 text-sm font-bold text-white inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4 text-[#38BDF8]" />
                    Open Test Controller
                  </button>
                  <button
                    type="button"
                    onClick={handleAddBot}
                    className="tactile-btn h-11 px-5 rounded-xl bg-[#0EA5E9]/20 hover:bg-[#0EA5E9]/30 border border-[#38BDF8]/40 text-sm font-bold text-[#7DD3FC] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <Bot className="w-4 h-4" />
                    Add a Robot
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#A5B4FC]">
                    Players on Stage · Click &ldquo;Make Host&rdquo; to pick who leads the room
                  </div>
                  <div className="text-xs font-mono text-[#A5B4FC] tabular-nums">
                    {MAX_PLAYERS_PER_ROOM - room.players.length} open seat
                    {MAX_PLAYERS_PER_ROOM - room.players.length === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <AnimatePresence mode="popLayout">
                    {room.players.map((player) => {
                      const isHost = !player.isBot && room.hostPlayerId === player.id;
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
                              ? 'bg-[#252154] border-[#FFB800]'
                              : 'bg-[#211E47] border-white/15'
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
                                  title="Click to change bot difficulty"
                                  onClick={() =>
                                    handleSetBotDifficulty(
                                      NEXT_DIFFICULTY[player.botDifficulty ?? room.botDifficulty],
                                      player.id
                                    )
                                  }
                                  className="h-7 px-2 rounded-lg bg-[#111026] hover:bg-[#19173A] text-[11px] font-extrabold cursor-pointer"
                                  style={{
                                    color: difficultyColor(player.botDifficulty ?? room.botDifficulty),
                                  }}
                                >
                                  {difficultyLabel(player.botDifficulty ?? room.botDifficulty)}
                                </button>
                                <button
                                  type="button"
                                  aria-label={`Remove ${player.name}`}
                                  title={`Remove ${player.name}`}
                                  onClick={() => handleRemoveBot(player.id)}
                                  className="h-7 w-7 rounded-lg bg-[#111026] hover:bg-[#FF4D2E] text-[#C7D2FE] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : isHost ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFB800] text-[#1A1300] text-xs font-extrabold">
                                <Crown className="w-3.5 h-3.5" />
                                Host
                              </span>
                            ) : player.connected ? (
                              <button
                                type="button"
                                onClick={() => handleSetHostPlayer(player.id)}
                                className="h-7 px-2.5 rounded-lg bg-white/10 hover:bg-[#FFB800] hover:text-[#1A1300] text-[11px] font-bold text-white transition-colors cursor-pointer"
                              >
                                Make Host
                              </button>
                            ) : (
                              <span className="text-xs font-bold text-[#FFB800]">Offline</span>
                            )}
                          </div>

                          <div>
                            <div className="font-display text-xl font-extrabold text-white truncate">
                              {player.name}
                            </div>
                            <div className="text-xs text-[#C7D2FE] mt-0.5">
                              {player.isBot
                                ? 'AI Robot · Always Ready'
                                : isHost
                                ? 'Room Host · Can start games'
                                : 'Phone Controller Connected'}
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
  // VIEW A2: REAL GAME ROOM (20 Game Cartridges + Ready Check + Robot Controls)
  // =========================================================================
  if (room.status === 'LOBBY') {
    return (
      <div className="min-h-screen bg-[#121419] text-[#F4F6FA] flex flex-col relative">
        {floatingEmoteOverlay}

        {/* Game Room Header */}
        <header className="border-b border-[#232833] bg-[#151820]">
          <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleReturnSetup}
                className="min-h-[40px] px-3.5 rounded-lg bg-[#1F2430] hover:bg-[#293040] text-sm font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Settings2 className="w-4 h-4 text-[#00C2FF]" />
                Room Setup
              </button>
              <button
                type="button"
                onClick={handleLeaveHost}
                className="min-h-[40px] px-3 rounded-lg bg-[#1A1E28] hover:bg-[#262C3A] text-xs font-medium text-[#9CA3AF] hover:text-white inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Home
              </button>
              <span className="hidden md:inline text-xs font-medium text-[#9CA3AF] whitespace-nowrap pl-1">
                PIN <strong className="font-mono text-white">{room.code}</strong> ·{' '}
                {room.players.length}/{MAX_PLAYERS_PER_ROOM} Players
                {bots.length > 0 ? ` (${bots.length} Bot${bots.length === 1 ? '' : 's'})` : ''}
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setTestDrawerOpen((v) => !v)}
                className={`tactile-btn h-10 px-4 rounded-xl text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                  testDrawerOpen
                    ? 'bg-[#00C2FF] text-[#0B1219]'
                    : 'bg-[#212633] hover:bg-[#2B3242] text-white border border-[#323A4C]'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                Test Controller
              </button>

              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="h-10 w-10 rounded-xl bg-[#212633] hover:bg-[#2B3242] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        {/* Main 12-Column Game Room Grid */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-7 grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* LEFT/CENTER COLUMN (8 cols): 20-Game Cartridge Selector & Rules */}
          <section className="lg:col-span-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Game Room · Pick a Game
                </h1>
                <p className="mt-1 text-sm text-[#9CA3AF]">
                  Choose any of the 20 games — every phone controller switches automatically!
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#9CA3AF] whitespace-nowrap tabular-nums">
                {filterGamesByPlayerMode(playerFilter).length} Games
              </span>
            </div>

            {/* Solo / Double / Multiplayer Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label="Filter lobby games by player count"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#11141B] border border-[#262C39]"
              >
                {PLAYER_FILTER_OPTIONS.map((opt) => {
                  const active = playerFilter === opt.id;
                  const count = filterGamesByPlayerMode(opt.id).length;
                  const matchesRoom =
                    (opt.id === 'solo' && room.players.length === 1) ||
                    (opt.id === 'double' && room.players.length === 2) ||
                    (opt.id === 'multiplayer' && room.players.length >= 3);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setPlayerFilter(opt.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#FF4D2E] text-white'
                          : matchesRoom
                          ? 'text-[#00C2FF] hover:text-white'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {opt.shortLabel}{' '}
                      <span className="font-mono opacity-80 tabular-nums">({count})</span>
                    </button>
                  );
                })}
              </div>

              {room.players.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setPlayerFilter(
                      room.players.length === 1
                        ? 'solo'
                        : room.players.length === 2
                        ? 'double'
                        : 'multiplayer'
                    )
                  }
                  className="text-xs font-medium text-[#00C2FF] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                >
                  Match room ({room.players.length}P)
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[425px] overflow-y-auto pr-1">
              {filterGamesByPlayerMode(playerFilter).map((game) => {
                const isSelected = room.selectedGameId === game.id;
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => handleSelectGame(game.id)}
                    className={`text-left rounded-xl overflow-hidden border transition-all cursor-pointer flex flex-col ${
                      isSelected
                        ? 'bg-[#202633] border-white/85 ring-2 ring-white/20'
                        : 'bg-[#1A1E26] border-[#282F3D] hover:border-[#3E475B]'
                    }`}
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
                      <div className="mt-1.5 text-[10px] font-semibold" style={{ color: game.accentHex }}>
                        {isSelected ? 'Selected' : 'Select'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Game Rules & Settings */}
            <div className="rounded-2xl bg-[#1A1E26] border border-[#282F3D] p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#272D3B]">
                <div>
                  <div className="text-xs font-medium text-[#9CA3AF]">
                    {selectedGame.category} · Best for {selectedGame.playerModeLabel}
                  </div>
                  <h2 className="font-display text-xl font-bold text-white mt-0.5">
                    {selectedGame.name}
                  </h2>
                  <p className="text-sm text-[#A5AEBD] mt-0.5">{selectedGame.tagline}</p>
                </div>

                {/* Match Duration / Rounds / Laps Segmented Selector */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-[#9CA3AF]">
                    {selectedGame.settingLabel}:
                  </span>
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#11141B]">
                    {selectedGame.settingOptions.map((opt) => {
                      const active = room.gameSettingValue === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => handleSelectGame(selectedGame.id, opt.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#283040] text-white'
                              : 'text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-[#9CA3AF] mb-2">How to Play</h3>
                  <ul className="space-y-1.5 text-sm text-[#D1D5DB]">
                    {selectedGame.rules.map((rule, idx) => (
                      <li key={idx} className="leading-snug">
                        {idx + 1}. {rule}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-[#13161D] p-4 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-[#9CA3AF] mb-2">Phone Buttons</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[#9CA3AF]">Joystick</span>
                        <span className="font-semibold text-white">
                          {selectedGame.controllerSchema.joystickLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#9CA3AF]">Button A</span>
                        <span
                          className="font-bold"
                          style={{ color: selectedGame.controllerSchema.actionA.colorHex }}
                        >
                          {selectedGame.controllerSchema.actionA.label} ·{' '}
                          {selectedGame.controllerSchema.actionA.sublabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[#9CA3AF]">Button B</span>
                        <span
                          className="font-bold"
                          style={{ color: selectedGame.controllerSchema.actionB.colorHex }}
                        >
                          {selectedGame.controllerSchema.actionB.label} ·{' '}
                          {selectedGame.controllerSchema.actionB.sublabel}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN (4 cols): Ready Check Roster, Robot Controls & Strict Start CTA */}
          <section className="lg:col-span-4 rounded-2xl bg-[#1A1E26] border border-[#282F3D] p-6 flex flex-col">
            {/* Compact Join PIN Bar */}
            <div className="flex items-center justify-between gap-2 pb-4 mb-4 border-b border-[#262D3B]">
              <div>
                <div className="text-[11px] font-medium text-[#9CA3AF]">Game PIN</div>
                <div className="font-mono text-2xl font-extrabold tracking-[0.2em] text-white tabular-nums">
                  {room.code}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJoinLink}
                  className="h-9 px-3 rounded-lg bg-[#242A36] hover:bg-[#2F3747] text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#10D98B]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Link'}
                </button>
                <button
                  type="button"
                  onClick={handleReturnSetup}
                  className="h-9 px-3 rounded-lg bg-[#242A36] hover:bg-[#2F3747] text-xs font-semibold text-[#00C2FF] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  QR / Host
                </button>
              </div>
            </div>

            {/* + Add Robot & Chill / Arcade / Spicy Difficulty right in Lobby Roster */}
            <div className="p-3 rounded-xl bg-[#13161D] border border-[#262C39] mb-4">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleAddBot}
                  disabled={isRoomFull}
                  className="tactile-btn h-9 px-3 rounded-lg bg-[#222938] hover:bg-[#2C3548] disabled:opacity-40 disabled:cursor-not-allowed border border-[#384359] text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-[#00C2FF]" />
                  <Bot className="w-3.5 h-3.5 text-[#00C2FF]" />
                  <span>Add Robot</span>
                </button>

                <div
                  role="radiogroup"
                  aria-label="Lobby robot difficulty"
                  className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-[#0D1016] border border-[#242B38]"
                >
                  {DIFFICULTY_OPTIONS.map((opt) => {
                    const active = room.botDifficulty === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => handleSetBotDifficulty(opt.id)}
                        className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                          active ? 'text-[#0B1016]' : 'text-[#9CA3AF] hover:text-white'
                        }`}
                        style={active ? { backgroundColor: opt.color } : undefined}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-base font-bold text-white">Ready Check</h2>
              <span className="font-mono text-xs font-semibold text-[#9CA3AF] tabular-nums">
                {connectedHumans.length > 0
                  ? `${readyHumans.length}/${connectedHumans.length} Phones Ready`
                  : `${bots.length} Bot${bots.length === 1 ? '' : 's'} Ready`}
              </span>
            </div>

            <div className="space-y-2">
              {Array.from({ length: MAX_PLAYERS_PER_ROOM }, (_, slotIdx) => {
                const player = room.players.find((p) => p.slotIndex === slotIdx);
                if (!player) {
                  return (
                    <div
                      key={slotIdx}
                      className="h-11 px-3 rounded-xl bg-[#13161D] border border-dashed border-[#262C39] flex items-center justify-between text-xs text-[#566073]"
                    >
                      <span className="font-mono">P{slotIdx + 1}</span>
                      <span>Empty slot</span>
                    </div>
                  );
                }

                const isHost = !player.isBot && room.hostPlayerId === player.id;

                return (
                  <motion.div
                    key={player.id}
                    layout
                    className={`h-11 px-3 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                      player.ready && player.connected
                        ? 'bg-[#172B24] border-[#10D98B]/55'
                        : 'bg-[#212734] border-[#30384A]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-6 h-6 rounded-md font-mono text-[11px] font-bold flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: player.color.hex,
                          color: player.color.textOnColor,
                        }}
                      >
                        P{player.slotIndex + 1}
                      </span>
                      {player.isBot && <Bot className="w-3.5 h-3.5 text-[#00C2FF] shrink-0" />}
                      {isHost && <Crown className="w-3.5 h-3.5 text-[#FFB800] shrink-0" />}
                      <span className="text-sm font-semibold text-white truncate">
                        {player.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {player.isBot ? (
                        <>
                          <button
                            type="button"
                            title="Cycle robot difficulty"
                            onClick={() =>
                              handleSetBotDifficulty(
                                NEXT_DIFFICULTY[player.botDifficulty ?? room.botDifficulty],
                                player.id
                              )
                            }
                            className="h-6 px-1.5 rounded bg-[#141821] hover:bg-[#1C2230] border border-[#2C3445] text-[10px] font-bold cursor-pointer"
                            style={{ color: difficultyColor(player.botDifficulty ?? room.botDifficulty) }}
                          >
                            {difficultyLabel(player.botDifficulty ?? room.botDifficulty)}
                          </button>
                          <button
                            type="button"
                            aria-label={`Remove ${player.name}`}
                            title={`Remove ${player.name}`}
                            onClick={() => handleRemoveBot(player.id)}
                            className="h-6 w-6 rounded bg-[#181C26] hover:bg-[#FF4D2E]/20 text-[#9CA3AF] hover:text-[#FF7A63] flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span
                          className={`text-xs font-semibold inline-flex items-center gap-1 ${
                            !player.connected
                              ? 'text-[#FFB800]'
                              : player.ready
                              ? 'text-[#10D98B]'
                              : 'text-[#FFB800]'
                          }`}
                        >
                          {player.connected && player.ready && <Check className="w-3.5 h-3.5" />}
                          {!player.connected
                            ? 'Offline'
                            : player.ready
                            ? 'Ready'
                            : 'Not Ready'}
                        </span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {unreadyHumans.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-[#FFB800]/10 border border-[#FFB800]/30 text-xs text-[#FCD34D] leading-snug">
                Waiting for{' '}
                <strong className="text-white">
                  {unreadyHumans.map((p) => p.name).join(', ')}
                </strong>{' '}
                to press <strong>Ready</strong> on their phone.
              </div>
            )}

            {errorMsg && (
              <div className="mt-3 p-3 rounded-xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 text-xs text-[#FF9B8A]">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleStartMatch}
              disabled={!canStartMatch}
              className="tactile-btn mt-4 w-full min-h-[52px] px-5 py-3.5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-sm xl:text-base shadow-[0_4px_0_#B82E17] inline-flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span className="truncate">
                {canStartMatch
                  ? `Open ${selectedGame.name}`
                  : room.players.length === 0
                  ? 'Add Players or Robots'
                  : 'Waiting for All Ready...'}
              </span>
            </button>

            {room.players.length === 0 && (
              <button
                type="button"
                onClick={() => setTestDrawerOpen(true)}
                className="mt-2.5 w-full h-10 rounded-xl bg-[#232936] hover:bg-[#2E3545] text-xs font-semibold text-[#00C2FF] cursor-pointer"
              >
                No phone handy? Open Test Controller
              </button>
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
  // VIEW B: ACTIVE 60FPS GAME MONITOR STAGE (BRIEFING / COUNTDOWN / PLAYING / PAUSED / RESULTS)
  // =========================================================================
  const briefingReadyPercent =
    connectedHumans.length > 0
      ? Math.round((readyHumans.length / connectedHumans.length) * 100)
      : 100;

  return (
    <div className="h-screen bg-[#0D0F14] text-white flex flex-col overflow-hidden relative">
      {floatingEmoteOverlay}

      {/* Compact Unobtrusive Top HUD Bar */}
      <header className="h-14 border-b border-[#222733] bg-[#14171E] px-4 flex items-center justify-between gap-4 shrink-0">
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
                <span className="font-mono text-[#9CA3AF] tabular-nums">{p.statText}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setTestDrawerOpen((v) => !v)}
            className={`h-9 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              testDrawerOpen
                ? 'bg-[#00C2FF] text-[#0B1219]'
                : 'bg-[#212633] hover:bg-[#2C3344] text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Test Pad
          </button>

          <button
            type="button"
            onClick={() =>
              wsRef.current?.send({
                type: 'game:pause',
                paused: room.status !== 'PAUSED',
              })
            }
            disabled={room.status !== 'PLAYING' && room.status !== 'PAUSED'}
            className="h-9 px-3 rounded-lg bg-[#212633] hover:bg-[#2C3344] disabled:opacity-40 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
          >
            {room.status === 'PAUSED' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {room.status === 'PAUSED' ? 'Resume' : 'Pause'}
          </button>

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="h-9 w-9 rounded-lg bg-[#212633] hover:bg-[#2C3344] text-[#D1D5DB] flex items-center justify-center cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => wsRef.current?.send({ type: 'game:return-lobby' })}
            className="h-9 px-3 rounded-lg bg-[#212633] hover:bg-[#2C3344] text-xs font-semibold text-[#D1D5DB] whitespace-nowrap cursor-pointer"
          >
            Game Room
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
            className="max-w-full max-h-full aspect-[5/3] rounded-2xl border border-[#282F3D] shadow-2xl bg-[#0D0F14]"
          />

          {/* Interactive Rules Briefing Modal — NO Auto-Countdown! Waits until everyone taps Ready */}
          {room.status === 'BRIEFING' && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#0B0D18]/86 backdrop-blur-sm rounded-2xl p-4 sm:p-6 z-20">
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="max-w-3xl w-full rounded-3xl bg-[#181A2E] border-2 border-white/15 shadow-2xl overflow-hidden"
              >
                {/* Header strip with game artwork thumbnail */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 sm:p-6 border-b border-white/10 bg-[#131426]">
                  <div className="w-full sm:w-40 aspect-video rounded-xl overflow-hidden bg-[#0E1117] border border-white/15 shrink-0">
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
                    <div className="text-xs font-bold uppercase tracking-wider text-[#38BDF8]">
                      How to Play · {selectedGame.category}
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mt-0.5 truncate">
                      {selectedGame.name}
                    </h2>
                    <p className="text-sm sm:text-base text-[#E2E8F0] mt-1">{selectedGame.tagline}</p>
                  </div>
                </div>

                {/* Body: Simple Rules + Clear Phone Controls */}
                <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#A5B4FC] mb-3">
                      Simple Rules
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

                  <div className="rounded-2xl bg-[#111322] border border-white/10 p-4 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-[#A5B4FC] mb-3">
                        Your Phone Controls
                      </h3>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1F233A] border-2 border-[#4B5580] flex items-center justify-center shrink-0">
                            <div className="w-4 h-4 rounded-full bg-white/90" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-[#A5B4FC]">Left Joystick</div>
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
                            <div className="text-xs text-[#CBD5E1] truncate">
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
                            <div className="text-xs text-[#CBD5E1] truncate">
                              {selectedGame.controllerSchema.actionB.sublabel}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 pt-3 border-t border-white/10 text-xs text-[#C7D2FE] leading-relaxed">
                      <strong className="text-white">Tip:</strong>{' '}
                      {selectedGame.controllerSchema.controlTip}
                    </p>
                  </div>
                </div>

                {/* Live Ready Progress + Per-Player Ready Chips (NO auto-countdown!) */}
                <div className="px-5 sm:px-6 py-4 bg-[#121325] border-t border-white/10 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-bold text-white">
                      {connectedHumans.length > 0
                        ? `Tap "I'm Ready!" on your phone when finished reading (${readyHumans.length}/${connectedHumans.length} Ready)`
                        : 'All robots are ready — press Start Match!'}
                    </div>
                    <span className="font-mono text-xs font-extrabold text-[#10D98B] tabular-nums">
                      {briefingReadyPercent}% Ready
                    </span>
                  </div>

                  {/* Smooth Progress Bar */}
                  <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
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
                              : 'bg-white/6 border-white/15 text-[#CBD5E1]'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: p.color.hex }}
                          />
                          {p.isBot && <Bot className="w-3.5 h-3.5 text-[#38BDF8]" />}
                          <span>{p.name}</span>
                          {isReady ? (
                            <Check className="w-3.5 h-3.5 text-[#10D98B]" />
                          ) : (
                            <span className="text-[10px] text-[#FFB800]">Reading...</span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => wsRef.current?.send({ type: 'game:return-lobby' })}
                      className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-[#E2E8F0] cursor-pointer"
                    >
                      Back to Game Room
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        arcadeAudio.unlock();
                        wsRef.current?.send({ type: 'game:dismiss-briefing' });
                      }}
                      className="tactile-btn h-10 px-5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-bold text-xs sm:text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current shrink-0" />
                      <span>
                        {connectedHumans.length === 0 ? 'Start Match' : 'Host Override: Start Now'}
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
                Get Ready
              </div>
              <motion.div
                key={room.countdownValue}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="font-display text-8xl sm:text-9xl font-extrabold text-white drop-shadow-lg tabular-nums"
              >
                {room.countdownValue > 0 ? room.countdownValue : 'GO!'}
              </motion.div>
            </div>
          )}

          {/* Paused Overlay */}
          {room.status === 'PAUSED' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-xs rounded-2xl">
              <h2 className="font-display text-4xl font-extrabold text-white">Game Paused</h2>
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => wsRef.current?.send({ type: 'game:pause', paused: false })}
                  className="tactile-btn px-6 py-3 rounded-xl bg-[#FF4D2E] text-white font-bold text-sm shadow-[0_3px_0_#B82E17] cursor-pointer"
                >
                  Resume Match
                </button>
                <button
                  type="button"
                  onClick={() => wsRef.current?.send({ type: 'game:restart' })}
                  className="tactile-btn px-5 py-3 rounded-xl bg-[#242A36] text-white font-semibold text-sm cursor-pointer"
                >
                  Restart
                </button>
                <button
                  type="button"
                  onClick={() => wsRef.current?.send({ type: 'game:return-lobby' })}
                  className="tactile-btn px-5 py-3 rounded-xl bg-[#1A1E26] border border-[#313847] text-[#D1D5DB] font-semibold text-sm cursor-pointer"
                >
                  Switch Game
                </button>
              </div>
            </div>
          )}

          {/* Victory Podium Modal Overlay */}
          {room.status === 'RESULTS' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/78 backdrop-blur-xs rounded-2xl p-6">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                className="max-w-lg w-full rounded-3xl bg-[#181A2E] border-2 border-white/15 p-7 text-center shadow-2xl"
              >
                <Trophy className="w-11 h-11 text-[#FFB800] mx-auto" />
                <h2 className="mt-2 font-display text-3xl font-extrabold text-white">
                  {room.rankings[0] ? `${room.rankings[0].name} Wins!` : 'Match Complete'}
                </h2>
                <p className="text-sm text-[#A5B4FC] mt-1">
                  {selectedGame.name} · Final Standings
                </p>

                <div className="mt-5 space-y-2 text-left max-h-[280px] overflow-y-auto pr-1">
                  {room.rankings.map((entry) => {
                    const isBotEntry = room.players.find((p) => p.id === entry.playerId)?.isBot;
                    return (
                      <div
                        key={entry.playerId}
                        className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#111322] border border-white/10"
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
                            {entry.score} pts
                          </span>
                          <span className="text-xs text-[#A5B4FC] ml-2">· {entry.highlight}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      fxRef.current = createRenderFxState();
                      wsRef.current?.send({ type: 'game:restart' });
                    }}
                    className="tactile-btn px-6 py-3 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-bold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Play Again
                  </button>

                  <button
                    type="button"
                    onClick={() => wsRef.current?.send({ type: 'game:return-lobby' })}
                    className="tactile-btn px-5 py-3 rounded-xl bg-white/12 hover:bg-white/20 text-white font-semibold text-sm cursor-pointer"
                  >
                    Switch Game
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
