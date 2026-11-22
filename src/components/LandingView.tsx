import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ChevronDown,
  Dices,
  Gamepad2,
  Info,
  Monitor,
  Play,
  QrCode,
  Search,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import {
  filterGamesByPlayerMode,
  GAME_CATALOG,
  getGameGenre,
  getGameMeta,
  PLAYER_FILTER_OPTIONS,
} from '../shared/games';
import { getPadTutorialGuide } from '../shared/padProfiles';
import { GameId, PlayerFilterMode } from '../shared/types';
import {
  getLocalizedFilterLabel,
  getLocalizedGameMeta,
  LanguageToggle,
  useLanguage,
} from '../lib/i18n';
import { preloadGameRenderer } from '../games/rendererRegistry';
import { GameHoverPreview } from './GameHoverPreview';
import { GameThumbnail } from './GameThumbnail';

interface LandingViewProps {
  onHostRoom: (preferredGameId?: GameId) => void;
  onJoinController: (initialCode?: string) => void;
}

const GAMES_PAGE_SIZE = 18;

export function LandingView({ onHostRoom, onJoinController }: LandingViewProps) {
  const { lang, t } = useLanguage();
  const [quickCode, setQuickCode] = useState('');
  const [playerFilter, setPlayerFilter] = useState<PlayerFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(GAMES_PAGE_SIZE);
  const [previewGameId, setPreviewGameId] = useState<GameId | null>(null);
  const [hoveredGameId, setHoveredGameId] = useState<GameId | null>(null);

  const filteredGames = useMemo(() => {
    const base = filterGamesByPlayerMode(playerFilter);
    const q = searchQuery.trim().toLowerCase();
    const localized = base.map((raw) => ({
      raw,
      loc: getLocalizedGameMeta(raw, lang),
    }));
    if (!q) return localized.map((item) => item.loc);
    return localized
      .filter(({ raw, loc }) => {
        const haystack = [
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
          .toLowerCase();
        return haystack.includes(q);
      })
      .map((item) => item.loc);
  }, [playerFilter, searchQuery, lang]);

  useEffect(() => {
    setVisibleCount(GAMES_PAGE_SIZE);
  }, [playerFilter, searchQuery]);

  const visibleGames = useMemo(
    () => filteredGames.slice(0, visibleCount),
    [filteredGames, visibleCount]
  );

  const handleSurpriseMe = () => {
    const pool = filteredGames.length > 0 ? filteredGames : GAME_CATALOG;
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    preloadGameRenderer(pick.id);
    setPreviewGameId(pick.id);
  };

  const previewGame = previewGameId
    ? getLocalizedGameMeta(getGameMeta(previewGameId), lang)
    : null;
  const previewPadGuide = previewGame ? getPadTutorialGuide(previewGame.id, lang) : null;

  useEffect(() => {
    if (!previewGameId) return;
    preloadGameRenderer(previewGameId);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPreviewGameId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewGameId]);

  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = quickCode.trim().toUpperCase();
    onJoinController(cleaned || undefined);
  };

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#121419] text-[#F4F6FA] flex flex-col">
      {/* 3-Zone Top Bar Contract */}
      <header className="w-full border-b border-[#242934] bg-[#121419]/95 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6">
          <a
            href="#top"
            className="font-display text-base sm:text-xl font-extrabold tracking-tight text-white truncate min-w-0"
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

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <LanguageToggle compact className="sm:h-9 sm:px-2.5 sm:text-xs" />
            <button
              type="button"
              onClick={() => onHostRoom()}
              className="tactile-btn px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 shadow-[0_3px_0_#B82E17] cursor-pointer"
            >
              {t('Host Monitor', '开启大屏房间')}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 w-full min-w-0">
        {/* Hero Split */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12 sm:pt-12 sm:pb-16 lg:pt-20 lg:pb-20">
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
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-[#1A1E26] border border-[#2A303D] p-5 sm:p-7 min-w-0">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs font-medium text-[#9CA3AF] mb-4">
                  <span>{t('Quick Controller Connect', '快速连接手柄')}</span>
                  <span className="font-mono text-[#FFB800] tabular-nums shrink-0">
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

                <form onSubmit={handleQuickJoin} className="mt-6 flex gap-2.5 sm:gap-3">
                  <input
                    type="text"
                    maxLength={4}
                    value={quickCode}
                    onChange={(e) => setQuickCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder={t('CODE', '房间码')}
                    aria-label={t('4-letter room code', '4位房间码')}
                    className="flex-1 min-w-0 h-12 px-3 sm:px-4 rounded-xl bg-[#101217] border border-[#2F3747] focus:border-[#00C2FF] focus:outline-none font-mono text-lg sm:text-xl font-bold tracking-[0.18em] sm:tracking-[0.28em] text-center text-white placeholder:text-[#4B5563] uppercase"
                  />
                  <button
                    type="submit"
                    className="tactile-btn h-12 px-4 sm:px-5 rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219] font-bold text-sm shadow-[0_3px_0_#007FA8] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
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
        <section id="games" className="border-t border-[#1F242E] bg-[#151820]/70 py-12 sm:py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
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

              {/* Filter Tabs + Quick Search + Surprise Me */}
              <div className="flex flex-col gap-3 lg:items-end">
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
                        className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                          active
                            ? opt.id === 'heritage'
                              ? 'bg-[#F59E0B] text-[#141008]'
                              : 'bg-[#FF4D2E] text-white'
                            : 'text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        {getLocalizedFilterLabel(opt.id, lang, false)}{' '}
                        <span className="font-mono opacity-80 tabular-nums">({count})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto">
                  <div className="relative flex-1 sm:w-72">
                    <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t(
                        'Search games (e.g. Congkak, 21, Guli)...',
                        '搜索游戏（如 锄大弟、21点、冲格）...'
                      )}
                      aria-label={t('Search games', '搜索游戏')}
                      className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#101218] border border-[#262C39] focus:border-[#00C2FF] focus:outline-none text-xs sm:text-sm text-white placeholder:text-[#6B7280]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label={t('Clear search', '清除搜索')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleSurpriseMe}
                    className="tactile-btn h-10 px-3.5 rounded-xl bg-[#1E232D] hover:bg-[#272E3C] border border-[#323B4D] text-xs font-bold text-[#FDE047] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Dices className="w-4 h-4" />
                    <span>{t('Surprise Me', '随机挑一款')}</span>
                  </button>
                </div>
              </div>
            </div>

            {filteredGames.length === 0 ? (
              <div className="rounded-2xl bg-[#1A1E26] border border-[#282E3B] p-10 text-center">
                <p className="text-base font-bold text-white">
                  {t('No games match your search.', '没有找到匹配的游戏。')}
                </p>
                <p className="mt-1 text-sm text-[#9CA3AF]">
                  {t(
                    'Try another title, traditional name, or clear your search filter.',
                    '试试其他名称、传统游戏名，或清空搜索条件。'
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setPlayerFilter('all');
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-xs font-bold cursor-pointer"
                >
                  {t('Reset Filters', '重置筛选')}
                </button>
              </div>
            ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {visibleGames.map((game) => {
                const isCardHovered = hoveredGameId === game.id;
                const padGuide = getPadTutorialGuide(game.id, lang);
                return (
                  <article
                    key={game.id}
                    onMouseEnter={() => {
                      preloadGameRenderer(game.id);
                      setHoveredGameId(game.id);
                    }}
                    onMouseLeave={() => {
                      setHoveredGameId((prev) => (prev === game.id ? null : prev));
                    }}
                    className="group rounded-2xl bg-[#1A1E26] border border-[#282E3B] overflow-hidden flex flex-col justify-between transition-colors hover:border-[#00C2FF]/55"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setPreviewGameId(game.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPreviewGameId(game.id);
                        }
                      }}
                      aria-label={t(
                        `View introduction and rules for ${game.name}`,
                        `查看「${game.name}」游戏介绍与玩法`
                      )}
                      className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2FF]"
                    >
                      <div className="relative aspect-video w-full bg-[#101217] overflow-hidden">
                        <GameHoverPreview
                          gameId={game.id}
                          gameName={game.name}
                          accentHex={game.accentHex}
                          fallbackSrc={game.coverImage}
                          alt={t(`${game.name} arcade game preview`, `${game.name} 游戏预览`)}
                          active={isCardHovered}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                        <span
                          className={`pointer-events-none absolute top-3 left-3 px-2 py-0.5 rounded-md font-mono text-[10px] font-extrabold uppercase tracking-wider shadow ${
                            getGameGenre(game.id) === 'board'
                              ? 'bg-[#A855F7]/90 text-white'
                              : getGameGenre(game.id) === 'card'
                              ? 'bg-[#10D98B]/90 text-[#071710]'
                              : 'bg-[#101217]/85 text-[#00C2FF] border border-[#00C2FF]/35'
                          }`}
                        >
                          {getLocalizedFilterLabel(getGameGenre(game.id), lang, true)}
                        </span>
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1A1E26] via-transparent to-transparent opacity-65" />
                      </div>

                    <div className="p-6">
                      <div className="text-xs font-medium text-[#9CA3AF] flex items-center gap-2">
                        <span>{game.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#D1D5DB] tabular-nums">{game.playerModeLabel}</span>
                      </div>

                      <h3 className="mt-1.5 font-display text-2xl font-bold text-white group-hover:text-[#00C2FF] transition-colors">
                        {game.name}
                      </h3>

                      <p className="mt-2 text-sm text-[#A5AEBD] leading-relaxed">
                        {game.description}
                      </p>

                      <div className="mt-3 rounded-xl bg-[#101217] border border-[#262C38] px-3 py-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span
                            className="inline-flex items-center gap-1.5 text-[11px] font-extrabold"
                            style={{ color: padGuide.accentHex }}
                          >
                            <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{padGuide.padTitle}</span>
                          </span>
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
                            {padGuide.presetTag}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#C7D0DE] leading-snug">
                          {padGuide.shortTutorial}
                        </p>
                      </div>

                      <div className="mt-4 pt-4 border-t border-[#262C38] flex items-center justify-between gap-2 text-xs text-[#9CA3AF]">
                        <span className="truncate">
                          {t('Buttons:', '按键：')}{' '}
                          <strong className="text-white font-semibold">
                            {game.controllerSchema.actionA.label}
                          </strong>{' '}
                          +{' '}
                          <strong className="text-white font-semibold">
                            {game.controllerSchema.actionB.label}
                          </strong>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#00C2FF] font-semibold shrink-0">
                          <Info className="w-3.5 h-3.5" />
                          <span>{t('Details', '玩法介绍')}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                    <div className="px-6 pb-6">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onHostRoom(game.id);
                        }}
                        className="tactile-btn w-full h-11 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913] font-display font-extrabold text-sm shadow-[0_3px_0_#0A915D] inline-flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        <span>{t('Play', '开始游玩')}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {visibleCount < filteredGames.length && (
              <div className="mt-8 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + GAMES_PAGE_SIZE)}
                  className="tactile-btn h-11 px-6 rounded-xl bg-[#1E232D] hover:bg-[#272F3D] border border-[#323B4D] text-sm font-bold text-white inline-flex items-center gap-2 cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4 text-[#00C2FF]" />
                  <span>
                    {t(
                      `Show More Games (${filteredGames.length - visibleCount} remaining)`,
                      `展开更多游戏（还有 ${filteredGames.length - visibleCount} 款）`
                    )}
                  </span>
                </button>
                <span className="text-xs font-mono text-[#6B7280] tabular-nums">
                  {t(
                    `Showing ${visibleGames.length} of ${filteredGames.length} games`,
                    `当前显示 ${visibleGames.length} / ${filteredGames.length} 款游戏`
                  )}
                </span>
              </div>
            )}
            </>
            )}
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B7280]">
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

      {/* Game Description & Introduction Modal */}
      <AnimatePresence>
        {previewGame && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="game-intro-title"
            onClick={() => setPreviewGameId(null)}
            className="fixed inset-0 z-50 bg-[#0B0D12]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-3xl w-full rounded-3xl bg-[#1A1E26] border-2 border-[#2F3747] shadow-2xl overflow-hidden my-auto"
            >
              {/* Modal Header */}
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 p-5 sm:p-6 border-b border-[#262C38] bg-[#151820]">
                <div className="w-full sm:w-44 aspect-video rounded-xl overflow-hidden bg-[#101217] border border-[#2A303D] shrink-0">
                  <GameThumbnail
                    gameId={previewGame.id}
                    gameName={previewGame.name}
                    accentHex={previewGame.accentHex}
                    fallbackSrc={previewGame.coverImage}
                    alt={t(`${previewGame.name} arcade game preview`, `${previewGame.name} 游戏预览`)}
                    className="w-full h-full object-cover"
                    eager
                  />
                </div>

                <div className="min-w-0 flex-1 pr-8">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#00C2FF]">
                    {previewGame.category} · {previewGame.playerModeLabel}
                  </div>
                  <h2
                    id="game-intro-title"
                    className="font-display text-2xl sm:text-3xl font-extrabold text-white mt-0.5 truncate"
                  >
                    {previewGame.name}
                  </h2>
                  <p className="text-sm text-[#D1D5DB] mt-1">{previewGame.tagline}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setPreviewGameId(null)}
                  aria-label={t('Close game introduction', '关闭游戏介绍')}
                  className="absolute top-4 right-4 h-9 w-9 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 space-y-5 max-h-[68vh] overflow-y-auto arcade-scrollbar">
                {/* Game Description + Auto-Matched Pad Type & Usage Tutorial */}
                <div className="rounded-2xl bg-[#101217] border border-[#262C38] p-4 space-y-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[#FFB800] mb-1.5">
                      {t('Game Introduction', '游戏简介')}
                    </div>
                    <p className="text-sm sm:text-[15px] text-[#E5E7EB] leading-relaxed">
                      {previewGame.description}
                    </p>
                  </div>

                  {previewPadGuide && (
                    <div className="pt-3 border-t border-[#242934] space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-display text-xs font-extrabold border"
                            style={{
                              color: previewPadGuide.accentHex,
                              borderColor: `${previewPadGuide.accentHex}55`,
                              backgroundColor: `${previewPadGuide.accentHex}18`,
                            }}
                          >
                            <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                            <span>{previewPadGuide.padTitle}</span>
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#1A1E26] border border-[#2A303D] font-mono text-[11px] font-bold text-[#D1D5DB]">
                            {previewPadGuide.presetTag}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#9CA3AF]">
                          {previewPadGuide.whyText}
                        </span>
                      </div>
                      <p className="text-xs sm:text-[13px] text-[#D1D5DB] leading-relaxed">
                        <strong className="text-white">
                          {t('Pad Usage Tutorial:', '手柄使用教程：')}
                        </strong>{' '}
                        {previewPadGuide.tutorialText}
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* How to Play Rules */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-3">
                      {t('How to Play', '玩法规则')}
                    </h3>
                    <ul className="space-y-2.5 text-sm text-white">
                      {previewGame.rules.map((rule, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 leading-snug">
                          <span
                            className="w-6 h-6 rounded-md font-mono text-xs font-black flex items-center justify-center shrink-0 mt-0.5"
                            style={{
                              backgroundColor: `${previewGame.accentHex}24`,
                              color: previewGame.accentHex,
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Phone Controls Preview */}
                  <div className="rounded-2xl bg-[#101217] border border-[#262C38] p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                          {t('Phone Controls', '手机手柄按键')}
                        </h3>
                        {previewPadGuide && (
                          <span
                            className="font-mono text-[10px] font-extrabold uppercase"
                            style={{ color: previewPadGuide.accentHex }}
                          >
                            {previewPadGuide.padShortLabel}
                          </span>
                        )}
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#1E232D] border-2 border-[#2F3747] flex items-center justify-center shrink-0">
                            <div className="w-3.5 h-3.5 rounded-full bg-white/90" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] text-[#9CA3AF]">
                              {t('Left Joystick', '左侧摇杆')}
                            </div>
                            <div className="text-sm font-bold text-white truncate">
                              {previewGame.controllerSchema.joystickLabel}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full font-display font-extrabold text-xs flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: previewGame.controllerSchema.actionA.colorHex,
                              color: previewGame.controllerSchema.actionA.textColor,
                            }}
                          >
                            A
                          </div>
                          <div className="min-w-0">
                            <div
                              className="text-sm font-extrabold leading-tight"
                              style={{ color: previewGame.controllerSchema.actionA.colorHex }}
                            >
                              {previewGame.controllerSchema.actionA.label}
                            </div>
                            <div className="text-xs text-[#A5AEBD] truncate">
                              {previewGame.controllerSchema.actionA.sublabel}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full font-display font-extrabold text-xs flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: previewGame.controllerSchema.actionB.colorHex,
                              color: previewGame.controllerSchema.actionB.textColor,
                            }}
                          >
                            B
                          </div>
                          <div className="min-w-0">
                            <div
                              className="text-sm font-extrabold leading-tight"
                              style={{ color: previewGame.controllerSchema.actionB.colorHex }}
                            >
                              {previewGame.controllerSchema.actionB.label}
                            </div>
                            <div className="text-xs text-[#A5AEBD] truncate">
                              {previewGame.controllerSchema.actionB.sublabel}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="mt-4 pt-3 border-t border-[#242934] text-xs text-[#A5AEBD] leading-relaxed">
                      <strong className="text-white">{t('Tip:', '小提示：')}</strong>{' '}
                      {previewGame.controllerSchema.controlTip}
                    </p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 sm:px-6 py-4 bg-[#151820] border-t border-[#262C38] flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[#9CA3AF]">
                  <span>{previewGame.settingLabel}: </span>
                  <strong className="text-white font-mono">
                    {previewGame.settingOptions.map((o) => o.label).join(' / ')}
                  </strong>
                </div>

                <div className="flex items-center gap-2.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setPreviewGameId(null)}
                    className="h-11 px-5 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-sm font-bold text-white cursor-pointer"
                  >
                    {t('Close', '关闭')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = previewGame.id;
                      setPreviewGameId(null);
                      onHostRoom(targetId);
                    }}
                    className="tactile-btn h-11 px-6 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913] font-display font-extrabold text-sm shadow-[0_3px_0_#0A915D] inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>{t('Play', '开始游玩')}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
