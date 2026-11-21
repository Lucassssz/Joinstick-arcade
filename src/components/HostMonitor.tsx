import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Gamepad2,
  Pause,
  Play,
  RotateCcw,
  Smartphone,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  filterGamesByPlayerMode,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
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

const HOST_SESSION_KEY = 'joinstick_host_session';

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
            break;
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
      width: 240,
      margin: 2,
      color: { dark: '#121419', light: '#F8FAFC' },
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => setQrDataUrl(''));
  }, [room?.code]);

  // 60fps Canvas Render Loop when in active match / countdown / paused / results
  useEffect(() => {
    if (!room || room.status === 'LOBBY') return;
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

  // Allow host keyboard Enter/Space to skip the pre-match briefing immediately
  useEffect(() => {
    if (room?.status !== 'BRIEFING') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        const target = e.target as HTMLElement | null;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        arcadeAudio.unlock();
        wsRef.current?.send({ type: 'game:dismiss-briefing' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      <div className="min-h-screen bg-[#121419] text-white flex flex-col items-center justify-center p-6">
        <div className="font-display text-2xl font-bold">Creating Game Room...</div>
        <p className="mt-2 text-sm text-[#9CA3AF]">Connecting to live multiplayer server</p>
      </div>
    );
  }

  const selectedGame = getGameMeta(room.selectedGameId);
  const joinUrl = getJoinUrl(room.code);
  const connectedCount = room.players.filter((p) => p.connected).length;

  // =========================================================================
  // VIEW A: HOST LOBBY (QR Code + 3 Game Cartridges + 8-Player Roster)
  // =========================================================================
  if (room.status === 'LOBBY') {
    return (
      <div className="min-h-screen bg-[#121419] text-[#F4F6FA] flex flex-col">
        {/* Compact Lobby Header */}
        <header className="border-b border-[#232833] bg-[#151820]">
          <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-6">
            <div className="flex items-center gap-4 min-w-0">
              <button
                type="button"
                onClick={handleLeaveHost}
                className="min-h-[40px] px-3 rounded-lg bg-[#1F2430] hover:bg-[#293040] text-sm font-medium text-[#D1D5DB] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Home
              </button>
              <span className="font-display text-lg font-extrabold text-white whitespace-nowrap shrink-0">
                JoinStick Monitor
              </span>
              <span className="hidden sm:inline text-xs font-medium text-[#9CA3AF] whitespace-nowrap">
                Room <strong className="font-mono text-white">{room.code}</strong> ·{' '}
                {connectedCount}/{MAX_PLAYERS_PER_ROOM} Players
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

        {/* Main 12-Column Lobby Grid */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-7 grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
          {/* LEFT COLUMN (3 cols): QR Code & Room Pairing Hardware Card */}
          <section className="lg:col-span-3 rounded-2xl bg-[#1A1E26] border border-[#282F3D] p-6 flex flex-col">
            <div className="flex items-center justify-between text-xs font-medium text-[#9CA3AF]">
              <span>Scan to Join</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-[#10D98B]' : 'bg-[#FFB800]'}`}
                />
                {wsConnected ? 'Live' : 'Reconnecting'}
              </span>
            </div>

            <div className="mt-4 bg-[#F8FAFC] rounded-xl p-3.5 flex items-center justify-center aspect-square">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={`QR code to join room ${room.code}`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-xs text-[#6B7280]">Generating QR...</div>
              )}
            </div>

            <div className="mt-5 text-center">
              <div className="text-xs font-medium text-[#9CA3AF]">Room Code</div>
              <div className="mt-1 font-mono text-4xl font-extrabold tracking-[0.22em] text-white tabular-nums">
                {room.code}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopyJoinLink}
                className="h-10 rounded-xl bg-[#242A36] hover:bg-[#2F3747] text-xs font-semibold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#10D98B]" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <a
                href={joinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 rounded-xl bg-[#242A36] hover:bg-[#2F3747] text-xs font-semibold text-[#00C2FF] inline-flex items-center justify-center gap-1.5"
              >
                Open Tab
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </section>

          {/* CENTER COLUMN (6 cols): Game Cartridge Selector & Rules */}
          <section className="lg:col-span-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
                  Select an Arcade Game
                </h1>
                <p className="mt-1 text-sm text-[#9CA3AF]">
                  Filter by player count — all connected phones adapt automatically.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#9CA3AF] whitespace-nowrap tabular-nums">
                {filterGamesByPlayerMode(playerFilter).length} Titles
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
                  Match lobby ({room.players.length}P)
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[415px] overflow-y-auto pr-1">
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

            {/* Selected Game Briefing & Match Settings */}
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
                  <h3 className="text-xs font-semibold text-[#9CA3AF] mb-2">How to Win</h3>
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
                    <h3 className="text-xs font-semibold text-[#9CA3AF] mb-2">
                      Phone Controller Mapping
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-[#9CA3AF]">Left Thumbstick</span>
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

          {/* RIGHT COLUMN (3 cols): 8-Slot Player Roster & Start CTA */}
          <section className="lg:col-span-3 rounded-2xl bg-[#1A1E26] border border-[#282F3D] p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-white">Players</h2>
              <span className="font-mono text-xs font-semibold text-[#9CA3AF] tabular-nums">
                {room.players.length} / {MAX_PLAYERS_PER_ROOM}
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
                      <span>Waiting for phone...</span>
                    </div>
                  );
                }

                return (
                  <div
                    key={player.id}
                    className="h-11 px-3 rounded-xl bg-[#212734] border border-[#30384A] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-6 h-6 rounded-md font-mono text-[11px] font-bold flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: player.color.hex,
                          color: player.color.textOnColor,
                        }}
                      >
                        P{player.slotIndex + 1}
                      </span>
                      <span className="text-sm font-semibold text-white truncate">
                        {player.name}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-semibold shrink-0 ${
                        !player.connected
                          ? 'text-[#FFB800]'
                          : player.ready
                          ? 'text-[#10D98B]'
                          : 'text-[#9CA3AF]'
                      }`}
                    >
                      {!player.connected ? 'Offline' : player.ready ? 'Ready' : 'Joined'}
                    </span>
                  </div>
                );
              })}
            </div>

            {errorMsg && (
              <div className="mt-4 p-3 rounded-xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 text-xs text-[#FF9B8A]">
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleStartMatch}
              disabled={room.players.length === 0}
              className="tactile-btn mt-5 w-full min-h-[52px] px-5 py-3.5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] disabled:opacity-40 disabled:cursor-not-allowed text-white font-display font-bold text-sm xl:text-base shadow-[0_4px_0_#B82E17] inline-flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current shrink-0" />
              <span className="truncate">Start {selectedGame.name}</span>
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
  // VIEW B: ACTIVE 60FPS GAME MONITOR STAGE (COUNTDOWN / PLAYING / PAUSED / RESULTS)
  // =========================================================================
  return (
    <div className="h-screen bg-[#0D0F14] text-white flex flex-col overflow-hidden">
      {/* Compact Unobtrusive Top HUD Bar */}
      <header className="h-14 border-b border-[#222733] bg-[#14171E] px-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-display font-extrabold text-base text-white whitespace-nowrap shrink-0">
            {selectedGame.name}
          </span>
          <span className="text-xs font-mono text-[#9CA3AF] whitespace-nowrap shrink-0">
            Room {room.code}
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
            Lobby
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

          {/* Pre-Match Objective & Controls Briefing Modal */}
          {room.status === 'BRIEFING' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/78 backdrop-blur-xs rounded-2xl p-4 sm:p-6 z-20">
              <div className="max-w-2xl w-full rounded-2xl bg-[#181C24] border border-[#313A4B] shadow-2xl overflow-hidden">
                {/* Header strip with game artwork thumbnail */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 sm:p-6 border-b border-[#272E3D] bg-[#14171F]">
                  <div className="w-full sm:w-36 aspect-video rounded-xl overflow-hidden bg-[#0E1117] border border-[#2A3140] shrink-0">
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
                    <div className="text-xs font-medium text-[#9CA3AF]">
                      How to Play · {selectedGame.category} · {selectedGame.playerModeLabel}
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mt-0.5 truncate">
                      {selectedGame.name}
                    </h2>
                    <p className="text-sm text-[#B8C0CE] mt-1">{selectedGame.tagline}</p>
                  </div>
                </div>

                {/* Body: Objective + Visual Phone Controls */}
                <div className="p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] mb-2.5">
                      Objective & Rules
                    </h3>
                    <ul className="space-y-2 text-sm text-[#E2E8F0]">
                      {selectedGame.rules.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-2 leading-snug">
                          <span
                            className="font-mono text-xs font-bold mt-0.5 shrink-0"
                            style={{ color: selectedGame.accentHex }}
                          >
                            0{idx + 1}
                          </span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl bg-[#11141B] border border-[#262C39] p-4 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">
                        Phone Controller
                      </h3>

                      <div className="space-y-3">
                        {/* Left Thumbstick */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1C222E] border-2 border-[#3C465A] flex items-center justify-center shrink-0">
                            <div className="w-4 h-4 rounded-full bg-white/85" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-[#9CA3AF]">Left Joystick</div>
                            <div className="text-sm font-bold text-white truncate">
                              {selectedGame.controllerSchema.joystickLabel}
                            </div>
                          </div>
                        </div>

                        {/* Action Button A */}
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
                            <div className="text-xs text-[#B8C0CE] truncate">
                              {selectedGame.controllerSchema.actionA.sublabel}
                            </div>
                          </div>
                        </div>

                        {/* Action Button B */}
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
                            <div className="text-xs text-[#B8C0CE] truncate">
                              {selectedGame.controllerSchema.actionB.sublabel}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 pt-3 border-t border-[#222835] text-xs text-[#9CA3AF] leading-relaxed">
                      <strong className="text-white">Tip:</strong>{' '}
                      {selectedGame.controllerSchema.controlTip}
                    </p>
                  </div>
                </div>

                {/* Footer Action Bar */}
                <div className="px-5 sm:px-6 py-4 bg-[#14171F] border-t border-[#272E3D] flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-xs text-[#9CA3AF] tabular-nums">
                    Auto-starting in{' '}
                    <strong className="text-[#FFB800]">{room.countdownValue}s</strong>
                  </span>

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => wsRef.current?.send({ type: 'game:return-lobby' })}
                      className="h-11 px-4 rounded-xl bg-[#222734] hover:bg-[#2C3344] text-xs font-semibold text-[#D1D5DB] cursor-pointer"
                    >
                      Back to Lobby
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        arcadeAudio.unlock();
                        wsRef.current?.send({ type: 'game:dismiss-briefing' });
                      }}
                      className="tactile-btn h-11 px-6 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-bold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current shrink-0" />
                      <span>Got It — Start Now</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3-2-1 Countdown Overlay */}
          {room.status === 'COUNTDOWN' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 rounded-2xl pointer-events-none">
              <div className="font-mono text-xs uppercase tracking-[0.25em] text-[#FFB800] mb-2">
                Get Ready
              </div>
              <div className="font-display text-8xl sm:text-9xl font-extrabold text-white drop-shadow-lg tabular-nums">
                {room.countdownValue > 0 ? room.countdownValue : 'GO!'}
              </div>
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/75 backdrop-blur-xs rounded-2xl p-6">
              <div className="max-w-lg w-full rounded-2xl bg-[#181C24] border border-[#313847] p-7 text-center shadow-2xl">
                <Trophy className="w-10 h-10 text-[#FFB800] mx-auto" />
                <h2 className="mt-2 font-display text-3xl font-extrabold text-white">
                  {room.rankings[0] ? `${room.rankings[0].name} Wins!` : 'Match Complete'}
                </h2>
                <p className="text-sm text-[#9CA3AF] mt-1">
                  {selectedGame.name} · Final Standings
                </p>

                <div className="mt-5 space-y-2 text-left">
                  {room.rankings.map((entry) => (
                    <div
                      key={entry.playerId}
                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#12151C] border border-[#262C39]"
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
                        <span className="font-semibold text-white truncate">{entry.name}</span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-sm font-bold text-white tabular-nums">
                          {entry.score} pts
                        </span>
                        <span className="text-xs text-[#9CA3AF] ml-2">· {entry.highlight}</span>
                      </div>
                    </div>
                  ))}
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
                    className="tactile-btn px-5 py-3 rounded-xl bg-[#242A36] hover:bg-[#2F3747] text-white font-semibold text-sm cursor-pointer"
                  >
                    Switch Game
                  </button>
                </div>
              </div>
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
