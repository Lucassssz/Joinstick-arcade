import { useState } from 'react';
import { Gamepad2, Monitor, QrCode, Smartphone, Users, ArrowRight } from 'lucide-react';
import {
  filterGamesByPlayerMode,
  GAME_CATALOG,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import { GameId, PlayerFilterMode } from '../shared/types';

interface LandingViewProps {
  onHostRoom: (preferredGameId?: GameId) => void;
  onJoinController: (initialCode?: string) => void;
}

export function LandingView({ onHostRoom, onJoinController }: LandingViewProps) {
  const [quickCode, setQuickCode] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [playerFilter, setPlayerFilter] = useState<PlayerFilterMode>('all');
  const filteredGames = filterGamesByPlayerMode(playerFilter);

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickCode.trim().toUpperCase();
    onJoinController(cleaned || undefined);
  };

  return (
    <div className="min-h-screen bg-[#121419] text-[#F4F6FA] flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="w-full border-b border-[#242934] bg-[#121419]/95 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            JoinStick Arcade
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#9CA3AF]">
            <a href="#games" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              Games
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <button
              type="button"
              onClick={() => onJoinController()}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Join Room
            </button>
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onHostRoom()}
              className="tactile-btn px-4 py-2 rounded-lg bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-sm font-semibold whitespace-nowrap shrink-0 shadow-[0_3px_0_#B82E17] cursor-pointer"
            >
              Host Monitor
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Hero Split */}
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-20 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            {/* Left Dominant Anchor */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="text-sm font-medium text-[#9CA3AF] mb-4">
                Browser Game Monitor · Up to 8 Phone Controllers · Zero App Install
              </p>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.06] text-white max-w-2xl">
                Turn every phone into a live arcade controller.
              </h1>

              <p className="mt-5 text-base sm:text-lg text-[#A5AEBD] leading-relaxed max-w-xl">
                Launch a room on any laptop or TV browser. Friends scan the QR code with their
                phones and jump straight into low-latency multiplayer games with adaptive virtual
                joysticks and tactile action buttons.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onHostRoom()}
                  className="tactile-btn inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-semibold text-base shadow-[0_4px_0_#B82E17] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Monitor className="w-5 h-5" />
                  Create Game Room
                </button>

                <button
                  type="button"
                  onClick={() => onJoinController()}
                  className="tactile-btn inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#1E232D] hover:bg-[#272D3A] text-white border border-[#2F3747] font-semibold text-base whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Smartphone className="w-5 h-5 text-[#00C2FF]" />
                  Join with Phone
                </button>
              </div>
            </div>

            {/* Right Quick-Join Hardware Console Panel */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-[#1A1E26] border border-[#2A303D] p-7">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[#9CA3AF] mb-4">
                  <span>Quick Controller Connect</span>
                  <span className="font-mono text-[#FFB800] tabular-nums">1–8 Players</span>
                </div>

                <h2 className="font-display text-2xl font-bold text-white">
                  Already see a room code on screen?
                </h2>
                <p className="mt-2 text-sm text-[#9CA3AF] leading-relaxed">
                  Enter the 4-letter code shown on the host monitor to turn this device into a live
                  wireless gamepad.
                </p>

                <form onSubmit={handleQuickJoin} className="mt-6 flex gap-3">
                  <input
                    type="text"
                    maxLength={4}
                    value={quickCode}
                    onChange={(e) => setQuickCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="CODE"
                    aria-label="4-letter room code"
                    className="flex-1 min-w-0 h-12 px-4 rounded-xl bg-[#101217] border border-[#2F3747] focus:border-[#00C2FF] focus:outline-none font-mono text-xl font-bold tracking-[0.28em] text-center text-white placeholder:text-[#4B5563] uppercase"
                  />
                  <button
                    type="submit"
                    className="tactile-btn h-12 px-5 rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219] font-bold text-sm shadow-[0_3px_0_#007FA8] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Connect
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>

              <div className="mt-8 pt-6 border-t border-[#262C38] grid grid-cols-3 gap-4 text-left">
                <div>
                  <div className="font-mono text-xl font-bold text-white tabular-nums">
                    {GAME_CATALOG.length}
                  </div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">Arcade Games</div>
                </div>
                <div>
                  <div className="font-mono text-xl font-bold text-white tabular-nums">8</div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">Max Phones</div>
                </div>
                <div>
                  <div className="font-mono text-xl font-bold text-white tabular-nums">30Hz</div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">Live Sync</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 Launch Games Cartridge Showcase */}
        <section id="games" className="border-t border-[#1F242E] bg-[#151820]/70 py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
              <div>
                <h2 className="font-display text-3xl font-extrabold text-white">
                  Nine games built for instant couch play
                </h2>
                <p className="mt-2 text-sm sm:text-base text-[#9CA3AF] max-w-2xl">
                  Every game adapts your phone screen automatically—swapping button labels, colors,
                  and cooldown rings to match the action on the monitor.
                </p>
              </div>

              {/* Player-Count Suitability Filter */}
              <div
                role="tablist"
                aria-label="Filter games by player count"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#101218] border border-[#262C39] self-start lg:self-auto"
              >
                {PLAYER_FILTER_OPTIONS.map((opt) => {
                  const active = playerFilter === opt.id;
                  const count = filterGamesByPlayerMode(opt.id).length;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setPlayerFilter(opt.id)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#FF4D2E] text-white'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {opt.label}{' '}
                      <span className="font-mono opacity-80 tabular-nums">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredGames.map((game) => (
                <article
                  key={game.id}
                  className="group rounded-2xl bg-[#1A1E26] border border-[#282E3B] overflow-hidden flex flex-col justify-between transition-colors hover:border-[#3A4356]"
                >
                  <div>
                    <div className="relative aspect-video w-full bg-[#101217] overflow-hidden">
                      {!failedImages[game.id] ? (
                        <img
                          src={game.coverImage}
                          alt={`${game.name} arcade game preview`}
                          referrerPolicy="no-referrer"
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [game.id]: true }))
                          }
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-[#181C24] text-[#9CA3AF] gap-2">
                          <Gamepad2 className="w-8 h-8" style={{ color: game.accentHex }} />
                          <span className="font-display font-bold text-white">{game.name}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1A1E26] via-transparent to-transparent opacity-80" />
                    </div>

                    <div className="p-6">
                      <div className="text-xs font-medium text-[#9CA3AF] flex items-center gap-2">
                        <span>{game.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#D1D5DB] tabular-nums">{game.playerModeLabel}</span>
                      </div>

                      <h3 className="mt-1.5 font-display text-2xl font-bold text-white">
                        {game.name}
                      </h3>

                      <p className="mt-2 text-sm text-[#A5AEBD] leading-relaxed">
                        {game.description}
                      </p>

                      <div className="mt-4 pt-4 border-t border-[#262C38] flex items-center justify-between text-xs text-[#9CA3AF]">
                        <span>
                          Buttons:{' '}
                          <strong className="text-white font-semibold">
                            {game.controllerSchema.actionA.label}
                          </strong>{' '}
                          +{' '}
                          <strong className="text-white font-semibold">
                            {game.controllerSchema.actionB.label}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 pb-6">
                    <button
                      type="button"
                      onClick={() => onHostRoom(game.id)}
                      className="tactile-btn w-full h-11 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-white font-semibold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Host {game.name}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-8">
            From browser to 8-player match in three steps
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="pt-5 border-t border-[#282E3B]">
              <div className="flex items-center gap-2.5 text-white font-display font-bold text-lg">
                <QrCode className="w-5 h-5 text-[#FF4D2E]" />
                <span>01. Open the Monitor</span>
              </div>
              <p className="mt-2.5 text-sm text-[#9CA3AF] leading-relaxed">
                Click Create Game Room on your computer or TV. A unique 4-letter room code and
                scannable QR code appear immediately.
              </p>
            </div>

            <div className="pt-5 border-t border-[#282E3B]">
              <div className="flex items-center gap-2.5 text-white font-display font-bold text-lg">
                <Smartphone className="w-5 h-5 text-[#00C2FF]" />
                <span>02. Scan & Connect</span>
              </div>
              <p className="mt-2.5 text-sm text-[#9CA3AF] leading-relaxed">
                Players point their phone camera at the QR code or enter the code. No download or
                account needed—just pick a name and color.
              </p>
            </div>

            <div className="pt-5 border-t border-[#282E3B]">
              <div className="flex items-center gap-2.5 text-white font-display font-bold text-lg">
                <Users className="w-5 h-5 text-[#FFB800]" />
                <span>03. Play & Test Solo</span>
              </div>
              <p className="mt-2.5 text-sm text-[#9CA3AF] leading-relaxed">
                Switch between all {GAME_CATALOG.length} games without re-scanning. Need to test solo? Open the built-in
                Test Controller Dock right inside the Host Monitor.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1F242E] py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B7280]">
          <span>JoinStick Arcade · Multi-Device Browser Party Console</span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => onHostRoom()}
              className="hover:text-[#D1D5DB] transition-colors cursor-pointer"
            >
              Host Monitor
            </button>
            <button
              type="button"
              onClick={() => onJoinController()}
              className="hover:text-[#D1D5DB] transition-colors cursor-pointer"
            >
              Phone Controller
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
