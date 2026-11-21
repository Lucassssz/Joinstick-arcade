import { useState } from 'react';
import { Gamepad2, Monitor, QrCode, Smartphone, Users, ArrowRight } from 'lucide-react';
import {
  filterGamesByPlayerMode,
  GAME_CATALOG,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import { GameId, PlayerFilterMode } from '../shared/types';
import {
  getLocalizedFilterLabel,
  getLocalizedGameMeta,
  LanguageToggle,
  useLanguage,
} from '../lib/i18n';

interface LandingViewProps {
  onHostRoom: (preferredGameId?: GameId) => void;
  onJoinController: (initialCode?: string) => void;
}

export function LandingView({ onHostRoom, onJoinController }: LandingViewProps) {
  const { lang, t } = useLanguage();
  const [quickCode, setQuickCode] = useState('');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [playerFilter, setPlayerFilter] = useState<PlayerFilterMode>('all');
  const filteredGames = filterGamesByPlayerMode(playerFilter).map((g) =>
    getLocalizedGameMeta(g, lang)
  );

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickCode.trim().toUpperCase();
    onJoinController(cleaned || undefined);
  };

  return (
    <div className="min-h-screen bg-[#121419] text-[#F4F6FA] flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="w-full border-b border-[#242934] bg-[#121419]/95 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <a
            href="#top"
            className="font-display text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            {t('JoinStick Arcade', 'JoinStick 街机派对')}
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#9CA3AF]">
            <a href="#games" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              {t('Games', '游戏列表')}
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
              {t('How It Works', '怎么玩')}
            </a>
            <button
              type="button"
              onClick={() => onJoinController()}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {t('Join Room', '加入房间')}
            </button>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <LanguageToggle />
            <button
              type="button"
              onClick={() => onHostRoom()}
              className="tactile-btn px-4 py-2 rounded-lg bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-sm font-semibold whitespace-nowrap shrink-0 shadow-[0_3px_0_#B82E17] cursor-pointer"
            >
              {t('Host Monitor', '开启大屏房间')}
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
                {t(
                  'Browser Game Monitor · Up to 8 Phone Controllers · Zero App Install',
                  '浏览器大屏主机 · 最多支持 8 部手机手柄 · 无需下载安装'
                )}
              </p>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.08] text-white max-w-2xl">
                {t(
                  'Turn every phone into a live arcade controller.',
                  '让每部手机秒变实时街机手柄。'
                )}
              </h1>

              <p className="mt-5 text-base sm:text-lg text-[#A5AEBD] leading-relaxed max-w-xl">
                {t(
                  'Launch a room on any laptop or TV browser. Friends scan the QR code with their phones and jump straight into low-latency multiplayer games with adaptive virtual joysticks and tactile action buttons.',
                  '在电脑或电视浏览器一键开房，好友手机扫码即刻加入！低延迟实时同步，虚拟摇杆和技能按键会随不同游戏自动切换。'
                )}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => onHostRoom()}
                  className="tactile-btn inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-semibold text-base shadow-[0_4px_0_#B82E17] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Monitor className="w-5 h-5" />
                  {t('Create Game Room', '创建游戏房间')}
                </button>

                <button
                  type="button"
                  onClick={() => onJoinController()}
                  className="tactile-btn inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#1E232D] hover:bg-[#272D3A] text-white border border-[#2F3747] font-semibold text-base whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Smartphone className="w-5 h-5 text-[#00C2FF]" />
                  {t('Join with Phone', '手机加入游戏')}
                </button>
              </div>
            </div>

            {/* Right Quick-Join Hardware Console Panel */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-[#1A1E26] border border-[#2A303D] p-7">
              <div>
                <div className="flex items-center justify-between text-xs font-medium text-[#9CA3AF] mb-4">
                  <span>{t('Quick Controller Connect', '快速连接手柄')}</span>
                  <span className="font-mono text-[#FFB800] tabular-nums">
                    {t('1–8 Players', '1–8 名玩家')}
                  </span>
                </div>

                <h2 className="font-display text-2xl font-bold text-white">
                  {t('Already see a room code on screen?', '已经看到大屏上的房间码了？')}
                </h2>
                <p className="mt-2 text-sm text-[#9CA3AF] leading-relaxed">
                  {t(
                    'Enter the 4-letter code shown on the host monitor to turn this device into a live wireless gamepad.',
                    '输入大屏显示的 4 位房间码，立刻把当前设备变成无线游戏手柄。'
                  )}
                </p>

                <form onSubmit={handleQuickJoin} className="mt-6 flex gap-3">
                  <input
                    type="text"
                    maxLength={4}
                    value={quickCode}
                    onChange={(e) => setQuickCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder={t('CODE', '房间码')}
                    aria-label={t('4-letter room code', '4位房间码')}
                    className="flex-1 min-w-0 h-12 px-4 rounded-xl bg-[#101217] border border-[#2F3747] focus:border-[#00C2FF] focus:outline-none font-mono text-xl font-bold tracking-[0.28em] text-center text-white placeholder:text-[#4B5563] uppercase"
                  />
                  <button
                    type="submit"
                    className="tactile-btn h-12 px-5 rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219] font-bold text-sm shadow-[0_3px_0_#007FA8] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {t('Connect', '连接')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              </div>

              <div className="mt-8 pt-6 border-t border-[#262C38] grid grid-cols-3 gap-4 text-left">
                <div>
                  <div className="font-mono text-xl font-bold text-white tabular-nums">
                    {GAME_CATALOG.length}
                  </div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">{t('Arcade Games', '款街机游戏')}</div>
                </div>
                <div>
                  <div className="font-mono text-xl font-bold text-white tabular-nums">8</div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">{t('Max Phones', '台手机同玩')}</div>
                </div>
                <div>
                  <div className="font-mono text-xl font-bold text-white tabular-nums">30Hz</div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">{t('Live Sync', '实时同步')}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Games Cartridge Showcase */}
        <section id="games" className="border-t border-[#1F242E] bg-[#151820]/70 py-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
              <div>
                <h2 className="font-display text-3xl font-extrabold text-white">
                  {t(
                    `${GAME_CATALOG.length} games built for instant couch play`,
                    `${GAME_CATALOG.length} 款客厅派对小游戏，即开即玩`
                  )}
                </h2>
                <p className="mt-2 text-sm sm:text-base text-[#9CA3AF] max-w-2xl">
                  {t(
                    'Every game adapts your phone screen automatically—swapping button labels, colors, and cooldown rings to match the action on the monitor.',
                    '每款游戏都会自动适配你的手机屏幕——按钮名称、颜色和技能冷却实时同步大屏战况。'
                  )}
                </p>
              </div>

              {/* Player-Count Suitability Filter */}
              <div
                role="tablist"
                aria-label={t('Filter games by player count', '按人数筛选游戏')}
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
                      {getLocalizedFilterLabel(opt.id, lang, false)}{' '}
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
                          alt={t(`${game.name} arcade game preview`, `${game.name} 游戏预览`)}
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
                          {t('Buttons:', '按键：')}{' '}
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
                      {t(`Host ${game.name}`, `开房玩「${game.name}」`)}
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
            {t(
              'From browser to 8-player match in three steps',
              '只需三步，开启 8 人同屏大乱斗'
            )}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="pt-5 border-t border-[#282E3B]">
              <div className="flex items-center gap-2.5 text-white font-display font-bold text-lg">
                <QrCode className="w-5 h-5 text-[#FF4D2E]" />
                <span>{t('01. Open the Monitor', '01. 打开大屏房间')}</span>
              </div>
              <p className="mt-2.5 text-sm text-[#9CA3AF] leading-relaxed">
                {t(
                  'Click Create Game Room on your computer or TV. A unique 4-letter room code and scannable QR code appear immediately.',
                  '在电脑或电视上点击「创建游戏房间」，屏幕会立刻生成专属 4 位房间码与二维码。'
                )}
              </p>
            </div>

            <div className="pt-5 border-t border-[#282E3B]">
              <div className="flex items-center gap-2.5 text-white font-display font-bold text-lg">
                <Smartphone className="w-5 h-5 text-[#00C2FF]" />
                <span>{t('02. Scan & Connect', '02. 手机扫码加入')}</span>
              </div>
              <p className="mt-2.5 text-sm text-[#9CA3AF] leading-relaxed">
                {t(
                  'Players point their phone camera at the QR code or enter the code. No download or account needed—just pick a name and color.',
                  '好友用手机扫码或输入房间码即可加入。无需下载或注册，选好昵称和颜色立刻开玩。'
                )}
              </p>
            </div>

            <div className="pt-5 border-t border-[#282E3B]">
              <div className="flex items-center gap-2.5 text-white font-display font-bold text-lg">
                <Users className="w-5 h-5 text-[#FFB800]" />
                <span>{t('03. Play & Test Solo', '03. 畅玩或单人测试')}</span>
              </div>
              <p className="mt-2.5 text-sm text-[#9CA3AF] leading-relaxed">
                {t(
                  `Switch between all ${GAME_CATALOG.length} games without re-scanning. Need to test solo? Open the built-in Test Controller Dock right inside the Host Monitor.`,
                  `全部 ${GAME_CATALOG.length} 款游戏无缝切换，无需重新扫码。一个人想玩？可以随时添加 AI 机器人或打开内置测试手柄！`
                )}
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1F242E] py-6">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B7280]">
          <span>
            {t(
              'JoinStick Arcade · Multi-Device Browser Party Console',
              'JoinStick 街机派对 · 多设备浏览器聚会游戏主机'
            )}
          </span>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => onHostRoom()}
              className="hover:text-[#D1D5DB] transition-colors cursor-pointer"
            >
              {t('Host Monitor', '大屏主机')}
            </button>
            <button
              type="button"
              onClick={() => onJoinController()}
              className="hover:text-[#D1D5DB] transition-colors cursor-pointer"
            >
              {t('Phone Controller', '手机手柄')}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
