import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ArrowRight,
  BookOpen,
  Bot,
  ChevronDown,
  Gamepad2,
  Lock,
  Play,
  QrCode,
  SlidersHorizontal,
  Smartphone,
  X,
  Zap,
} from 'lucide-react';
import {
  BOARD_GAME_IDS,
  CARD_GAME_IDS,
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
import { getStylizedGameThumbnail } from '../games/thumbnailGenerator';
import { GameHoverPreview, preloadDemoClip } from './GameHoverPreview';
import { preloadRuleClips } from './WatchAndPlayCardCanvas';
import { RuleAnimationCard } from './RuleAnimationCard';
import { GameShowcaseCard } from './GameShowcaseCard';
import { GuestPassManagerModal, HostUnlockModal } from './HostAccessModal';
import {
  fetchHostAuthStatus,
  getHostAuthToken,
  getOwnerAdminSession,
  usePublicAccessOpen,
} from '../lib/hostAuth';
import tutorialPreviewImg from '../assets/images/ui_shot_03_game_lobby.png';

interface LandingViewProps {
  onHostRoom: (preferredGameId?: GameId) => void;
  onStartPocket: (preferredGameId?: GameId) => void;
  onJoinController: (initialCode?: string) => void;
  onOpenTutorial: () => void;
  onOpenGuideBot: (preferredGameId?: GameId) => void;
}

export function LandingView({
  onHostRoom,
  onStartPocket,
  onJoinController,
  onOpenTutorial,
  onOpenGuideBot,
}: LandingViewProps) {
  const { lang, t } = useLanguage();
  const [quickCode, setQuickCode] = useState('');
  const [playerFilter, setPlayerFilter] = useState<PlayerFilterMode>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [previewGameId, setPreviewGameId] = useState<GameId | null>(null);
  const [hoveredGameId, setHoveredGameId] = useState<GameId | null>(null);
  const [tutorialPhotoFailed, setTutorialPhotoFailed] = useState(false);

  // Horizontal Auto-Scrolling Games Rail State
  const gamesRailRef = useRef<HTMLDivElement | null>(null);
  const [railRootEl, setRailRootEl] = useState<HTMLDivElement | null>(null);
  const setGamesRailNode = useCallback((node: HTMLDivElement | null) => {
    gamesRailRef.current = node;
    setRailRootEl((prev) => (prev === node ? prev : node));
  }, []);
  const MANUAL_SCROLL_RESUME_MS = 5000;
  const virtualScrollLeftRef = useRef(0);
  const manualPauseUntilRef = useRef(0);
  const endDwellUntilRef = useRef(0);
  const smoothScrollUntilRef = useRef(0);
  const isTouchingRailRef = useRef(false);
  const lastHoverAtRef = useRef(0);
  const pointerDragRef = useRef<{
    active: boolean;
    startX: number;
    startScrollLeft: number;
    moved: boolean;
  }>({ active: false, startX: 0, startScrollLeft: 0, moved: false });
  const [activeScrollIdx, setActiveScrollIdx] = useState(0);

  // Host Unlock & Hidden Owner Settings State
  const publicAccessOpen = usePublicAccessOpen();
  const [showPlayModeModal, setShowPlayModeModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showGuestPassModal, setShowGuestPassModal] = useState(false);
  const [pendingHostGameId, setPendingHostGameId] = useState<GameId | undefined>(undefined);
  const [pendingHostTarget, setPendingHostTarget] = useState<'host' | 'pocket' | 'passes'>('host');
  const secretTapRef = useRef<{ count: number; lastAt: number }>({ count: 0, lastAt: 0 });

  useEffect(() => {
    void fetchHostAuthStatus().catch(() => {});
  }, []);

  const openHiddenOwnerSettings = useCallback(() => {
    setShowPlayModeModal(false);
    setPendingHostGameId(undefined);
    setPendingHostTarget('passes');
    const existing = getOwnerAdminSession();
    if (existing?.role === 'master') {
      setShowPinModal(false);
      setShowGuestPassModal(true);
    } else {
      setShowGuestPassModal(false);
      setShowPinModal(true);
    }
  }, []);

  const handleOwnerReauthRequest = useCallback(() => {
    setShowGuestPassModal(false);
    setPendingHostGameId(undefined);
    setPendingHostTarget('passes');
    setShowPinModal(true);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        openHiddenOwnerSettings();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openHiddenOwnerSettings]);

  const handleSecretBrandTap = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const now = Date.now();
    const prev = secretTapRef.current;
    const nextCount = now - prev.lastAt <= 2200 ? prev.count + 1 : 1;
    secretTapRef.current = { count: nextCount, lastAt: now };
    if (nextCount >= 2) {
      e.preventDefault();
    }
    if (nextCount >= 5) {
      secretTapRef.current = { count: 0, lastAt: 0 };
      openHiddenOwnerSettings();
    }
  };

  // Intersection Observer for Stats Count-Up
  const [statsAnimated, setStatsAnimated] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  const [displayGames, setDisplayGames] = useState(0);
  const [displayPhones, setDisplayPhones] = useState(0);
  const [displayHz, setDisplayHz] = useState(0);

  // Intersection Observer for Game Types Count-Up (Section 4)
  const [gameTypesAnimated, setGameTypesAnimated] = useState(false);
  const gameTypesRef = useRef<HTMLElement>(null);
  const [displayTypeCounts, setDisplayTypeCounts] = useState<number[]>([0, 0, 0, 0, 0]);

  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setIsFlipping(true);
      setTimeout(() => {
        setActiveCardIndex((prev) => (prev + 1) % 4);
        setIsFlipping(false);
      }, 350);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setStatsAnimated(true);
          }
        });
      },
      { threshold: 0.1 }
    );
    if (statsRef.current) {
      observer.observe(statsRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const totalGamesCount = GAME_CATALOG.length;

  const gameTypeCounts = useMemo(() => {
    const sportsKw =
      /volley|soccer|hockey|golf|archery|boxing|ping-pong|tennis|baseball|batting|billiards|physics|hoop|penalty|sumo|canoe|disc|badminton|snooker|joust|curling|skate|darts|slingshot|bridge|torque|rope|timber|artillery|bowling|skeet|dodgeball|home-run/i;
    const partyKw =
      /party|social|chaos|roulette|thrones|tag|truth|draw|wavelength|fib|microgame|crew|shared-ship|herd|moving|havoc|hotpot|claw|bluff|auction|red-light|kitchen|trap-builder|confetti|crane|zombie|kites?|chapteh|stones|goose/i;
    let board = 0;
    let card = 0;
    let sports = 0;
    let party = 0;
    let arcade = 0;
    for (const g of GAME_CATALOG) {
      if (BOARD_GAME_IDS.has(g.id)) {
        board++;
      } else if (CARD_GAME_IDS.has(g.id)) {
        card++;
      } else {
        const s = `${g.id} ${g.category}`;
        if (sportsKw.test(s)) sports++;
        else if (partyKw.test(s)) party++;
        else arcade++;
      }
    }
    return { arcade, board, card, sports, party };
  }, []);

  useEffect(() => {
    if (!statsAnimated) return;
    let startTime: number | null = null;
    const duration = 1200;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setDisplayGames(Math.round(easeProgress * totalGamesCount));
      setDisplayPhones(Math.round(easeProgress * 8));
      setDisplayHz(Math.round(easeProgress * 30));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [statsAnimated, totalGamesCount]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setGameTypesAnimated(true);
          }
        });
      },
      { threshold: 0.15 }
    );
    if (gameTypesRef.current) {
      observer.observe(gameTypesRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!gameTypesAnimated) return;
    const targets = [
      gameTypeCounts.arcade,
      gameTypeCounts.board,
      gameTypeCounts.card,
      gameTypeCounts.sports,
      gameTypeCounts.party,
    ];
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplayTypeCounts(targets);
      return;
    }

    let startTime: number | null = null;
    let rafId = 0;
    const duration = 1200;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      setDisplayTypeCounts(targets.map((val) => Math.round(easeProgress * val)));

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [gameTypesAnimated, gameTypeCounts]);

  const requestHost = (gameId?: GameId, target: 'host' | 'pocket' | 'passes' = 'host') => {
    if (target === 'passes') {
      openHiddenOwnerSettings();
      return;
    }

    const launchTarget = () => {
      if (target === 'pocket') {
        onStartPocket(gameId);
      } else {
        onHostRoom(gameId);
      }
    };

    const promptUnlock = () => {
      setPendingHostGameId(gameId);
      setPendingHostTarget(target);
      setShowPinModal(true);
    };

    void fetchHostAuthStatus()
      .then((status) => {
        if (status.publicAccessOpen || getHostAuthToken()) {
          launchTarget();
        } else {
          promptUnlock();
        }
      })
      .catch(() => {
        if (publicAccessOpen || getHostAuthToken()) {
          launchTarget();
        } else {
          promptUnlock();
        }
      });
  };

  const handleHostUnlocked = useCallback(() => {
    setShowPinModal(false);
    if (pendingHostTarget === 'passes') {
      setShowGuestPassModal(true);
    } else if (pendingHostTarget === 'pocket') {
      onStartPocket(pendingHostGameId);
    } else {
      onHostRoom(pendingHostGameId);
    }
  }, [pendingHostTarget, pendingHostGameId, onStartPocket, onHostRoom]);

  const filteredGames = useMemo(() => {
    const base = filterGamesByPlayerMode(playerFilter);
    return base.map((raw) => getLocalizedGameMeta(raw, lang));
  }, [playerFilter, lang]);

  const syncActiveCardFromRail = useCallback(() => {
    const el = gamesRailRef.current;
    if (!el) return;
    const cards = el.querySelectorAll<HTMLElement>('[data-game-card-idx]');
    if (cards.length === 0) return;

    const viewportCenter = el.scrollLeft + el.clientWidth * 0.5;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const cardCenter = card.offsetLeft + card.offsetWidth * 0.5;
      const d = Math.abs(cardCenter - viewportCenter);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    setActiveScrollIdx((prev) => (prev === bestIdx ? prev : bestIdx));
  }, []);

  // Reset rail position when category filter changes
  useEffect(() => {
    setActiveScrollIdx(0);
    setHoveredGameId(null);
    virtualScrollLeftRef.current = 0;
    endDwellUntilRef.current = 0;
    const el = gamesRailRef.current;
    if (el) {
      el.scrollLeft = 0;
    }
  }, [playerFilter]);

  // Predictive warming while scrolling — mirrors HostMonitor's game-chooser preloader
  // so the next coming games already have their thumbnail, 5s demo clip, and rule clips ready
  useEffect(() => {
    if (filteredGames.length === 0) return;
    const hoveredIdx = hoveredGameId
      ? filteredGames.findIndex((g) => g.id === hoveredGameId)
      : -1;
    const pivot = hoveredIdx >= 0 ? hoveredIdx : Math.min(activeScrollIdx, filteredGames.length - 1);
    const total = filteredGames.length;
    const offsets = [0, 1, 2, 3, -1];
    const seen = new Set<GameId>();

    for (const offset of offsets) {
      const idx = ((pivot + offset) % total + total) % total;
      const target = filteredGames[idx];
      if (!target || seen.has(target.id)) continue;
      seen.add(target.id);
      preloadGameRenderer(target.id);
      void getStylizedGameThumbnail(target.id, target.accentHex, getGameGenre(target.id));
      preloadDemoClip(target.id);
      preloadRuleClips(target.id);
    }
  }, [filteredGames, activeScrollIdx, hoveredGameId]);

  // Smooth automatic horizontal scrolling when no manual scroll is detected;
  // automatically resumes 5 seconds after manual scrolling stops
  useEffect(() => {
    if (filteredGames.length <= 1 || previewGameId) return;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    let rafId = 0;
    let lastTs = performance.now();
    let syncAccumulator = 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - lastTs) / 1000));
      lastTs = now;

      const el = gamesRailRef.current;
      const isActivelyInteracting =
        pointerDragRef.current.active || isTouchingRailRef.current;
      const remainingManualMs = Math.max(0, manualPauseUntilRef.current - now);
      const isPaused =
        !el ||
        document.hidden ||
        isActivelyInteracting ||
        remainingManualMs > 0;

      if (isPaused) {
        if (el) virtualScrollLeftRef.current = el.scrollLeft;
      } else {
        if (now - lastHoverAtRef.current > 1200) {
          setHoveredGameId((prev) => (prev === null ? prev : null));
        }

        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll > 8) {
          if (now < endDwellUntilRef.current) {
            rafId = requestAnimationFrame(tick);
            return;
          }
          if (virtualScrollLeftRef.current >= maxScroll - 1) {
            virtualScrollLeftRef.current = 0;
            el.scrollLeft = 0;
            syncActiveCardFromRail();
          } else {
            virtualScrollLeftRef.current = Math.min(
              maxScroll,
              virtualScrollLeftRef.current + 54 * dt
            );
            el.scrollLeft = virtualScrollLeftRef.current;
            if (virtualScrollLeftRef.current >= maxScroll - 1) {
              endDwellUntilRef.current = now + 1200;
            }
          }
          syncAccumulator += dt;
          if (syncAccumulator >= 0.12) {
            syncAccumulator = 0;
            syncActiveCardFromRail();
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [filteredGames.length, previewGameId, syncActiveCardFromRail]);

  const markManualScroll = useCallback((pauseMs = MANUAL_SCROLL_RESUME_MS) => {
    manualPauseUntilRef.current = performance.now() + pauseMs;
  }, []);

  const handleOpenCardDetails = useCallback((gameId: GameId) => {
    if (pointerDragRef.current.moved) {
      pointerDragRef.current.moved = false;
      return;
    }
    preloadGameRenderer(gameId);
    void preloadDemoClip(gameId);
    void preloadRuleClips(gameId);
    setPreviewGameId(gameId);
  }, []);

  const previewGame = previewGameId
    ? getLocalizedGameMeta(getGameMeta(previewGameId), lang)
    : null;
  const previewPadGuide = previewGame ? getPadTutorialGuide(previewGame.id, lang) : null;

  useEffect(() => {
    if (!previewGameId) return;
    preloadGameRenderer(previewGameId);
    preloadDemoClip(previewGameId);
    preloadRuleClips(previewGameId);
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

  // Computed Game Types data for Part 4 strictly matching live GAME_CATALOG counts
  const gameTypesData = useMemo(
    () => [
      {
        id: 'arcade',
        nameEn: 'Arcade & Action',
        nameZh: '街机与动作',
        count: gameTypeCounts.arcade,
        filterMode: 'arcade' as PlayerFilterMode,
      },
      {
        id: 'board',
        nameEn: 'Board Games',
        nameZh: '桌游棋牌',
        count: gameTypeCounts.board,
        filterMode: 'board' as PlayerFilterMode,
      },
      {
        id: 'card',
        nameEn: 'Card Games',
        nameZh: '纸牌派对',
        count: gameTypeCounts.card,
        filterMode: 'card' as PlayerFilterMode,
      },
      {
        id: 'sports',
        nameEn: 'Sports & Physics',
        nameZh: '体育物理',
        count: gameTypeCounts.sports,
        filterMode: 'arcade' as PlayerFilterMode,
      },
      {
        id: 'party',
        nameEn: 'Party & Social',
        nameZh: '聚会社交',
        count: gameTypeCounts.party,
        filterMode: 'all' as PlayerFilterMode,
      },
    ],
    [gameTypeCounts]
  );

  const cardsData = useMemo(
    () => [
      {
        stepEn: 'FEATURE 01',
        stepZh: '特性 01',
        titleEn: 'Scan & Join',
        titleZh: '秒速扫码加入',
        descEn: 'Point your phone camera at the big screen QR code or enter the 4-letter room code. Zero app downloads needed.',
        descZh: '使用手机相机扫描大屏二维码或输入 4 位房间码，无需下载任何 App 即可连入。',
        badgeEn: 'ROOM CODE: JUMP',
        badgeZh: '房间码示例：JUMP',
        accentHex: '#00C2FF',
        icon: QrCode,
      },
      {
        stepEn: 'FEATURE 02',
        stepZh: '特性 02',
        titleEn: 'Gamepads',
        titleZh: '智能自适应实体手柄',
        descEn: 'Your phone automatically reconfigures between pro analog sticks, D-pad arrows, glide touchpads, and card tables per game.',
        descZh: '手柄按键随当前游戏自动重构，支持摇杆、十字键、触控板及私密手牌区等多种形态。',
        badgeEn: '0 CONFIGURATION NEEDED',
        badgeZh: '零配置 · 即连即用',
        accentHex: '#FF4D2E',
        icon: Smartphone,
      },
      {
        stepEn: 'FEATURE 03',
        stepZh: '特性 03',
        titleEn: 'Game Library',
        titleZh: '丰富游戏库',
        descEn: `Browse ${totalGamesCount} arcade, board, and card party games with live 5-second video previews, player filters, and instant animated rules.`,
        descZh: `浏览 ${totalGamesCount} 款街机、桌游与纸牌派对游戏，支持 5 秒实机预览、按人数筛选与动态规则讲解。`,
        badgeEn: `${totalGamesCount} TITLES • INSTANT PLAY`,
        badgeZh: `${totalGamesCount} 款正版游戏 · 即开即玩`,
        accentHex: '#10D98B',
        icon: Gamepad2,
      },
      {
        stepEn: 'FEATURE 04',
        stepZh: '特性 04',
        titleEn: 'Offline Guide Bot',
        titleZh: '零流量平台助手',
        descEn: `Built-in instant assistant with guided menus for platform tutorials, controls, troubleshooting, and rules for all ${totalGamesCount} games—zero API usage.`,
        descZh: `内置秒答助手，通过快捷菜单手把手教你平台玩法、手柄操作、排错指南与全部 ${totalGamesCount} 款游戏规则，完全离线零流量。`,
        badgeEn: 'INSTANT ANSWERS • ZERO API',
        badgeZh: '内置菜单秒答 · 零 API 消耗',
        accentHex: '#A855F7',
        icon: Bot,
      },
    ],
    [totalGamesCount]
  );

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-clip bg-[#0B0E14] text-[#F4F6FA] flex flex-col font-sans"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif, "PingFang SC", "Microsoft YaHei"' }}
    >
      {/* Part 1: Header */}
      <header className="w-full border-b border-[#1F2633] bg-[#0B0E14]/85 backdrop-blur-xl sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a
            href="#top"
            onClick={handleSecretBrandTap}
            className="font-display text-base sm:text-xl font-extrabold tracking-tight text-white truncate min-w-0 flex items-center gap-2.5 select-none"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF4D2E] to-[#00C2FF] flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,77,46,0.3)]">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <span>{t('JoinStick Arcade', 'JoinStick 街机派对')}</span>
          </a>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageToggle compact className="sm:h-9 sm:px-2.5 sm:text-xs" />
            <button
              type="button"
              onClick={() => requestHost()}
              className="tactile-btn px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 shadow-[0_3px_0_#B82E17] inline-flex items-center gap-1.5 cursor-pointer transition-transform active:translate-y-0.5"
            >
              {!publicAccessOpen && <Lock className="w-3.5 h-3.5 text-white/80" />}
              <span>{t('Host Monitor', '开启大屏房间')}</span>
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1 w-full min-w-0">
        {/* Part 1: Hero Section */}
        <section className="relative overflow-hidden max-w-7xl mx-auto px-4 sm:px-6 pt-16 pb-24 sm:pt-24 sm:pb-32 lg:pt-32 lg:pb-36 text-center flex flex-col items-center">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-gradient-to-r from-[#FF4D2E]/15 via-[#00C2FF]/15 to-[#FF4D2E]/10 blur-[150px] rounded-full pointer-events-none -z-10" />

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#151B26] border border-[#263042] text-xs font-semibold text-[#00C2FF] mb-6 shadow-md">
            <span className="w-2 h-2 rounded-full bg-[#00C2FF] animate-pulse" />
            <span>{t('Private Couch Party Console', '私密客厅派对主机')}</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl lg:text-[4.25rem] font-extrabold tracking-tight leading-[1.08] text-white max-w-4xl text-balance">
            {t(
              'One room. Every phone. Instant party arcade.',
              '一间房，全员手机开玩。随时开局的派对街机。'
            )}
          </h1>

          <p className="mt-6 text-base sm:text-xl text-[#9CA3AF] leading-relaxed max-w-2xl text-balance">
            {t(
              `Host on any TV or laptop—or launch a room directly on your phone in Pocket Mode. Friends scan a QR code to play ${totalGamesCount} arcade, board, and card games with zero downloads.`,
              `支持电脑电视大屏开房，也支持手机掌机模式直接当主机。好友扫码无需下载即刻加入，畅玩 ${totalGamesCount} 款街机、桌游与派对卡牌。`
            )}
          </p>

          <div className="mt-10 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setShowPlayModeModal(true)}
              className="tactile-btn inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#FF4D2E] via-[#FF5E3A] to-[#FF4D2E] hover:brightness-110 text-white font-display font-extrabold text-base sm:text-lg shadow-[0_4px_0_#B82E17,0_12px_30px_rgba(255,77,46,0.28)] whitespace-nowrap cursor-pointer transition-all active:translate-y-0.5"
            >
              <Gamepad2 className="w-5 h-5" />
              <span>{t('Start Playing', '立即开玩')}</span>
              <ArrowRight className="w-4 h-4 opacity-90" />
            </button>
          </div>

          {/* Quick Controller Connect Box */}
          <div className="mt-12 max-w-md w-full bg-[#121722]/90 backdrop-blur-xl border border-[#222B3B] rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between text-xs font-medium text-[#9CA3AF] mb-3">
              <span>{t('Quick Controller Connect', '快速连接手柄')}</span>
              <span className="font-mono text-[#00C2FF]">{t('8 MAX PLAYERS', '最多 8 人联机')}</span>
            </div>
            <form onSubmit={handleQuickJoin} className="flex gap-2.5">
              <input
                type="text"
                maxLength={4}
                value={quickCode}
                onChange={(e) => setQuickCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder={t('CODE', '4位房间码')}
                aria-label={t('4-letter room code', '4位房间码')}
                className="flex-1 min-w-0 h-12 px-4 rounded-xl bg-[#0B0E14] border border-[#222B3B] focus:border-[#00C2FF] focus:outline-none font-mono text-lg font-bold tracking-[0.25em] text-center text-white placeholder:text-[#4B5563] uppercase"
              />
              <button
                type="submit"
                className="tactile-btn h-12 px-6 rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219] font-bold text-sm shadow-[0_3px_0_#007FA8] inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t('Connect', '连接')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </section>

        {/* Part 2: Stats Strip (200 Games / 8 Max Phones / 30Hz Live Sync) */}
        <section ref={statsRef} className="border-y border-[#1A2230] bg-[#10141D]/60 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="p-6 rounded-2xl bg-[#141A26] border border-[#20293B]">
              <div className="font-display text-4xl sm:text-5xl font-extrabold text-white tracking-tight tabular-nums">
                {displayGames}
              </div>
              <div className="mt-2 text-sm font-semibold text-[#FF4D2E] uppercase tracking-wider">
                {t(`${totalGamesCount} Games`, `${totalGamesCount} 款游戏`)}
              </div>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {t('Arcade, board, and card party games', '街机、桌游与纸牌派对合集')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#141A26] border border-[#20293B]">
              <div className="font-display text-4xl sm:text-5xl font-extrabold text-white tracking-tight tabular-nums">
                {displayPhones}
              </div>
              <div className="mt-2 text-sm font-semibold text-[#00C2FF] uppercase tracking-wider">
                {t('8 Max Phones', '最多 8 部手机')}
              </div>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {t('Concurrent mobile controllers per room', '每房间支持 8 人同时在线联动')}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#141A26] border border-[#20293B]">
              <div className="font-display text-4xl sm:text-5xl font-extrabold text-white tracking-tight tabular-nums">
                {displayHz}Hz
              </div>
              <div className="mt-2 text-sm font-semibold text-[#10D98B] uppercase tracking-wider">
                {t('30Hz Live Sync', '30Hz 实时同步')}
              </div>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {t('Sub-30ms touch-to-screen tactile response', '触控反馈丝滑流畅，零卡顿延迟')}
              </p>
            </div>
          </div>
        </section>

        {/* Flagship Product Showcase Section (Clean & Static with Smooth CSS Transitions) */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#151B26] border border-[#263042] text-xs font-semibold text-[#00C2FF] mb-4 shadow">
              <Zap className="w-3.5 h-3.5 text-[#00C2FF]" />
              <span>{t('Flagship Couch Console Experience', '旗舰级客厅派对主机体验')}</span>
            </div>
            <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
              {t('Designed for effortless game nights.', '为欢聚派对而生的极简操控。')}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[#9CA3AF] leading-relaxed">
              {t(
                `No console hardware required. Host on any browser, connect phones instantly, and enjoy ${totalGamesCount} arcade, board, and card games with zero lag.`,
                `无需任何额外主机硬件。任意浏览器一键开房，手机扫码秒连，${totalGamesCount} 款街机、桌游与纸牌派对游戏随心畅玩。`
              )}
            </p>
          </div>

        {/* Single Element Auto-Flipping Card Showcase */}
          <div className="relative max-w-xl mx-auto h-[420px] [perspective:1000px]">
            <div
              className="absolute inset-0 w-full h-full"
              style={{
                transform: isFlipping ? 'translateX(-60px) scale(0.97)' : 'translateX(0px) scale(1)',
                opacity: isFlipping ? 0 : 1,
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease-in-out',
              }}
            >
              <div className="absolute inset-0 w-full h-full rounded-3xl bg-[#141A26] border-2 border-[#2A354A] p-8 sm:p-10 flex flex-col justify-between shadow-2xl">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                      style={{
                        backgroundColor: `${cardsData[activeCardIndex].accentHex}18`,
                        border: `1px solid ${cardsData[activeCardIndex].accentHex}55`,
                        color: cardsData[activeCardIndex].accentHex,
                      }}
                    >
                      {(() => {
                        const IconComp = cardsData[activeCardIndex].icon;
                        return <IconComp className="w-7 h-7" />;
                      })()}
                    </div>
                    <div className="flex gap-2">
                      {cardsData.map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setIsFlipping(true);
                            setTimeout(() => {
                              setActiveCardIndex(idx);
                              setIsFlipping(false);
                            }, 250);
                          }}
                          className={`h-2 rounded-full transition-all cursor-pointer ${
                            idx === activeCardIndex ? 'w-8 bg-[#00C2FF]' : 'w-2 bg-[#2A354A]'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div
                    className="text-xs font-mono font-bold tracking-wider uppercase"
                    style={{ color: cardsData[activeCardIndex].accentHex }}
                  >
                    {lang === 'zh' ? cardsData[activeCardIndex].stepZh : cardsData[activeCardIndex].stepEn}
                  </div>
                  <h3 className="font-display text-2xl sm:text-4xl font-extrabold text-white mt-2">
                    {lang === 'zh' ? cardsData[activeCardIndex].titleZh : cardsData[activeCardIndex].titleEn}
                  </h3>
                  <p className="mt-4 text-sm sm:text-base text-[#9CA3AF] leading-relaxed">
                    {lang === 'zh' ? cardsData[activeCardIndex].descZh : cardsData[activeCardIndex].descEn}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#0B0E14] border border-[#222B3B] p-4 text-center">
                  <div
                    className="text-xs font-mono font-bold tracking-wider"
                    style={{ color: cardsData[activeCardIndex].accentHex }}
                  >
                    {lang === 'zh' ? cardsData[activeCardIndex].badgeZh : cardsData[activeCardIndex].badgeEn}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Game Types Grid Section */}
        <section ref={gameTypesRef} className="max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-[#1A2230]">
          <div className="text-center mb-10">
            <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-white">
              {t('Every kind of game night. One room.', '百变派对之夜，一个房间畅玩。')}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-[#9CA3AF]">
              {t(`Computed from ${totalGamesCount} official catalogue titles`, `基于 ${totalGamesCount} 款官方精选游戏精确统计`)}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {gameTypesData.map((type, idx) => (
              <a
                key={type.id}
                href="#games"
                onClick={() => setPlayerFilter(type.filterMode)}
                className="group w-[calc(50%-0.5rem)] sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-4rem)/5)] p-5 rounded-2xl bg-[#141A26] border border-[#20293B] hover:border-[#FF4D2E] text-center transition-all cursor-pointer shadow-lg"
              >
                <div className="font-display font-extrabold text-2xl text-white group-hover:text-[#FF4D2E] tabular-nums">
                  {displayTypeCounts[idx] ?? type.count}
                </div>
                <div className="mt-1.5 text-xs font-bold text-white">
                  {lang === 'zh' ? type.nameZh : type.nameEn}
                </div>
                <div className="mt-2 text-xs text-[#00C2FF]">
                  {t('Explore →', '浏览 →')}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Part 5: Game Library (Existing catalogue unchanged functionally) */}
        <section id="games" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-[#1A2230]">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
            <div>
              <h2 className="font-display text-3xl font-extrabold text-white">
                {t(
                  `${GAME_CATALOG.length} Games Built for Instant Couch Play`,
                  `${GAME_CATALOG.length} 款小游戏，即开即玩`
                )}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-[#9CA3AF] max-w-2xl">
                {t(
                  `Filter by player mode, tap any card for a live preview, or open Guide Bot to search all ${totalGamesCount} games instantly.`,
                  `支持按人数筛选、点击卡片看实机演示，或打开「平台助手」秒搜全部 ${totalGamesCount} 款游戏规则。`
                )}
              </p>
            </div>

            {/* Collapsible Filter */}
            <div className="flex flex-col gap-2.5 lg:items-end">
              <button
                type="button"
                onClick={() => setFilterOpen((prev) => !prev)}
                aria-expanded={filterOpen}
                aria-controls="games-filter-panel"
                className="inline-flex items-center gap-2.5 h-10 px-4 rounded-xl bg-[#121722] hover:bg-[#192030] border border-[#222B3B] text-xs font-semibold text-white whitespace-nowrap self-start lg:self-end cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#00C2FF]" />
                <span>
                  {t('Filter', '筛选')}:{' '}
                  <strong className="text-[#FF4D2E]">
                    {getLocalizedFilterLabel(playerFilter, lang, false)}
                  </strong>{' '}
                  <span className="font-mono text-[#9CA3AF] tabular-nums">
                    ({filteredGames.length})
                  </span>
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-[#9CA3AF] transition-transform duration-200 ${
                    filterOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {filterOpen && (
                <div
                  id="games-filter-panel"
                  role="tablist"
                  aria-label={t('Filter games by player mode', '按玩家模式筛选游戏')}
                  className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#121722] border border-[#222B3B]"
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
                            ? 'bg-[#FF4D2E] text-white shadow'
                            : 'text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        {getLocalizedFilterLabel(opt.id, lang, false)}{' '}
                        <span className="font-mono opacity-85 tabular-nums">({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <div className="rounded-2xl bg-[#141A26] border border-[#20293B] p-12 text-center">
              <p className="text-base font-bold text-white">
                {t('No games match your filter.', '没有找到匹配的游戏。')}
              </p>
              <button
                type="button"
                onClick={() => setPlayerFilter('all')}
                className="mt-4 px-4 py-2 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-xs font-bold cursor-pointer"
              >
                {t('Reset Filter', '重置筛选')}
              </button>
            </div>
          ) : (
            <>
              {/* Horizontal Auto-Scrolling Game Rail (Zero Play Buttons on Cards) */}
              <div
                ref={setGamesRailNode}
                onMouseLeave={() => {
                  pointerDragRef.current.active = false;
                  setHoveredGameId(null);
                }}
                onScroll={() => {
                  const el = gamesRailRef.current;
                  if (!el) return;
                  if (performance.now() < smoothScrollUntilRef.current) {
                    virtualScrollLeftRef.current = el.scrollLeft;
                  } else if (Math.abs(el.scrollLeft - virtualScrollLeftRef.current) > 3.5) {
                    virtualScrollLeftRef.current = el.scrollLeft;
                    markManualScroll(MANUAL_SCROLL_RESUME_MS);
                  }
                  syncActiveCardFromRail();
                }}
                onWheel={(e) => {
                  if (Math.abs(e.deltaX) > 1 || (e.shiftKey && Math.abs(e.deltaY) > 0)) {
                    markManualScroll(MANUAL_SCROLL_RESUME_MS);
                  }
                }}
                onTouchStart={() => {
                  isTouchingRailRef.current = true;
                  markManualScroll(MANUAL_SCROLL_RESUME_MS);
                }}
                onTouchMove={() => {
                  isTouchingRailRef.current = true;
                  markManualScroll(MANUAL_SCROLL_RESUME_MS);
                }}
                onTouchEnd={() => {
                  isTouchingRailRef.current = false;
                  markManualScroll(MANUAL_SCROLL_RESUME_MS);
                }}
                onTouchCancel={() => {
                  isTouchingRailRef.current = false;
                  markManualScroll(MANUAL_SCROLL_RESUME_MS);
                }}
                onPointerDown={(e) => {
                  const el = gamesRailRef.current;
                  if (!el || e.button !== 0) return;
                  pointerDragRef.current = {
                    active: true,
                    startX: e.clientX,
                    startScrollLeft: el.scrollLeft,
                    moved: false,
                  };
                }}
                onPointerMove={(e) => {
                  const el = gamesRailRef.current;
                  const drag = pointerDragRef.current;
                  if (!el || !drag.active) return;
                  const dx = e.clientX - drag.startX;
                  if (Math.abs(dx) > 6) {
                    drag.moved = true;
                    markManualScroll(MANUAL_SCROLL_RESUME_MS);
                    const nextLeft = drag.startScrollLeft - dx;
                    el.scrollLeft = nextLeft;
                    virtualScrollLeftRef.current = el.scrollLeft;
                    syncActiveCardFromRail();
                  }
                }}
                onPointerUp={() => {
                  if (pointerDragRef.current.moved) {
                    markManualScroll(MANUAL_SCROLL_RESUME_MS);
                  }
                  pointerDragRef.current.active = false;
                }}
                onPointerCancel={() => {
                  if (pointerDragRef.current.moved) {
                    markManualScroll(MANUAL_SCROLL_RESUME_MS);
                  }
                  pointerDragRef.current.active = false;
                }}
                className="flex gap-5 overflow-x-auto pb-4 pt-1 select-none arcade-scrollbar cursor-grab active:cursor-grabbing"
              >
                {filteredGames.map((game, idx) => {
                  const isCardHovered = hoveredGameId === game.id;
                  const isSpotlight = hoveredGameId ? isCardHovered : idx === activeScrollIdx;
                  const isNearSpotlight = Math.abs(idx - activeScrollIdx) <= 4;

                  return (
                    <GameShowcaseCard
                      key={game.id}
                      game={game}
                      index={idx}
                      isSpotlight={isSpotlight}
                      isNearSpotlight={isNearSpotlight}
                      railRoot={railRootEl}
                      onHoverChange={(id) => {
                        if (id) {
                          lastHoverAtRef.current = performance.now();
                          setHoveredGameId(id);
                        } else {
                          setHoveredGameId((prev) => (prev === game.id ? null : prev));
                        }
                      }}
                      onOpenDetails={handleOpenCardDetails}
                    />
                  );
                })}
              </div>
            </>
          )}
        </section>

        {/* Interactive Tutorial & Guide Bot Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-[#1A2230]">
          <div className="rounded-3xl bg-[#141A26] border border-[#243046] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-6 p-7 sm:p-10 lg:p-12 flex flex-col justify-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-[#00C2FF] flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{t('Platform Walkthrough', '全平台实景教程')}</span>
                  <span aria-hidden="true" className="text-[#3B4659]">·</span>
                  <span>{t('Interactive Sandbox', '互动按钮体验')}</span>
                  <span aria-hidden="true" className="text-[#3B4659]">·</span>
                  <span>{t('Offline Guide Bot', '零流量平台助手')}</span>
                </div>

                <h2 className="mt-3 font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight text-balance">
                  {t(
                    'New here? Learn every screen or ask Guide Bot.',
                    '刚来想快速上手？看实景教程或直接问助手。'
                  )}
                </h2>

                <p className="mt-4 text-sm sm:text-base text-[#9CA3AF] leading-relaxed">
                  {t(
                    `Explore real UI screenshots and our clickable button sandbox—or open Guide Bot anytime for quick tap-to-answer help on modes, controls, troubleshooting, and all ${totalGamesCount} games.`,
                    `浏览全套实机界面截图与互动体验区，或随时打开「平台助手」，点击预设选项一秒获取模式教学、手柄操控、排错技巧与全部 ${totalGamesCount} 款游戏规则。`
                  )}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onOpenTutorial}
                    className="tactile-btn inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] text-[#07151F] font-display font-extrabold text-sm sm:text-base shadow-[0_4px_0_#007FA8] cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>{t('Watch on Our Tutorial', '查看完整互动教程')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenGuideBot()}
                    className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#1A2233] hover:bg-[#243047] border border-[#00C2FF]/45 text-[#00C2FF] font-display font-bold text-sm sm:text-base cursor-pointer transition-colors"
                  >
                    <Bot className="w-4 h-4" />
                    <span>{t('Ask Guide Bot', '问平台助手')}</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 relative min-h-[240px] sm:min-h-[300px] bg-[#090C12] border-t lg:border-t-0 lg:border-l border-[#20293B] flex items-center justify-center p-3 sm:p-4">
                {tutorialPhotoFailed ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-8 text-center bg-gradient-to-br from-[#161E2E] to-[#0D1119]">
                    <BookOpen className="w-10 h-10 text-[#00C2FF]" />
                    <span className="text-sm font-semibold text-white">
                      {t('Interactive JoinStick Arcade Tutorial', 'JoinStick 街机派对全平台教程')}
                    </span>
                  </div>
                ) : (
                  <img
                    src={tutorialPreviewImg}
                    alt={t(
                      'Actual JoinStick Game Room lobby screenshot showing 200 games, Ready Check, Chaos Wheel, and 5-Game Cup',
                      'JoinStick 游戏大厅实机界面截图，展示 200 款游戏、准备确认、混沌转盘与 5 局杯赛'
                    )}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setTutorialPhotoFailed(true)}
                    className="w-full h-full object-contain rounded-xl border border-[#243046]"
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA Banner */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="rounded-3xl bg-gradient-to-r from-[#151B26] via-[#121722] to-[#151B26] border border-[#2A354A] p-8 sm:p-12 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(#00C2FF_1px,transparent_1px)] [background-size:16px_16px] opacity-10 pointer-events-none" />
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
              {t('Ready for game night?', '准备好开启派对了吗？')}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#9CA3AF] max-w-xl mx-auto">
              {t(
                'Create your private room now and turn your living room into an arcade.',
                '立即创建私密房间，让你的客厅秒变欢乐街机厅。'
              )}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => requestHost(undefined, 'host')}
                className="tactile-btn inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-bold text-base shadow-[0_4px_0_#B82E17] cursor-pointer"
              >
                {!publicAccessOpen && <Lock className="w-5 h-5" />}
                {t('Create Game Room', '创建游戏房间')}
              </button>
              <button
                type="button"
                onClick={() => requestHost(undefined, 'pocket')}
                className="tactile-btn inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913] font-extrabold text-base shadow-[0_4px_0_#0A915D] cursor-pointer"
              >
                {!publicAccessOpen && <Lock className="w-4 h-4" />}
                <Gamepad2 className="w-5 h-5" />
                {t('Pocket Mode (No Monitor)', '掌机模式（无需大屏）')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1A2230] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9CA3AF]">
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 text-center sm:text-left">
            <span>
              {t(
                'JoinStick Arcade · Multi-Device Browser Party Console',
                'JoinStick 街机派对 · 多设备浏览器聚会游戏主机'
              )}
            </span>
            <span className="hidden sm:inline text-[#3B4659]">·</span>
            <span className="text-[#CBD5E1] font-medium">
              {t('Created by Lucas Lim', '由 Lucas Lim 打造')}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <button
              type="button"
              onClick={onOpenTutorial}
              className="hover:text-[#00C2FF] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t('Tutorial', '使用教程')}</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenGuideBot()}
              className="hover:text-[#00C2FF] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>{t('Guide Bot', '平台助手')}</span>
            </button>
            <button
              type="button"
              onClick={() => requestHost(undefined, 'host')}
              className="hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              {!publicAccessOpen && <Lock className="w-3.5 h-3.5" />}
              <span>{t('Host Monitor', '大屏主机')}</span>
            </button>
            <button
              type="button"
              onClick={() => requestHost(undefined, 'pocket')}
              className="hover:text-[#10D98B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              {!publicAccessOpen && <Lock className="w-3.5 h-3.5" />}
              <span>{t('Pocket Mode', '掌机模式')}</span>
            </button>
            <button
              type="button"
              onClick={() => onJoinController()}
              className="hover:text-white transition-colors cursor-pointer"
            >
              <span>{t('Phone Controller', '手机手柄')}</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Play Mode Selector Modal (Combined from 3 Hero CTAs) */}
      {showPlayModeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="play-mode-title"
          onClick={() => setShowPlayModeModal(false)}
          className="fixed inset-0 z-50 bg-[#0B0E14]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full rounded-3xl bg-[#151B26] border-2 border-[#2A354A] shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="play-mode-title" className="font-display text-xl font-extrabold text-white">
                  {t('Choose How to Play', '选择游玩方式')}
                </h2>
                <p className="text-xs text-[#9CA3AF] mt-1">
                  {t('Host on a shared screen, run on your phone, or join a room.', '开启大屏房间、使用掌机模式，或用手机加入好友房间。')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlayModeModal(false)}
                aria-label={t('Close', '关闭')}
                className="h-9 w-9 rounded-xl bg-[#1E2636] hover:bg-[#273145] text-[#9CA3AF] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowPlayModeModal(false);
                  requestHost(undefined, 'host');
                }}
                className="w-full p-4 rounded-2xl bg-[#FF4D2E]/12 hover:bg-[#FF4D2E]/20 border border-[#FF4D2E]/40 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#FF4D2E] text-white flex items-center justify-center shrink-0 shadow-[0_3px_0_#B82E17]">
                    {publicAccessOpen ? (
                      <Play className="w-5 h-5 fill-current" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-extrabold text-white">
                      {t('Create Game Room', '创建大屏房间')}
                    </div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">
                      {t('Host on TV or laptop · QR code join', '电视或电脑开房 · 好友扫码加入')}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#FF4D2E] shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPlayModeModal(false);
                  requestHost(undefined, 'pocket');
                }}
                className="w-full p-4 rounded-2xl bg-[#10D98B]/12 hover:bg-[#10D98B]/20 border border-[#10D98B]/40 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#10D98B] text-[#071A12] flex items-center justify-center shrink-0 shadow-[0_3px_0_#0A915D]">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-extrabold text-white">
                      {t('Pocket Mode (No Monitor)', '掌机模式（无需大屏）')}
                    </div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">
                      {t('Host & play directly on your phone', '手机直接开房并显示游戏画面')}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#10D98B] shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowPlayModeModal(false);
                  onJoinController();
                }}
                className="w-full p-4 rounded-2xl bg-[#00C2FF]/10 hover:bg-[#00C2FF]/18 border border-[#00C2FF]/35 text-left flex items-center justify-between gap-3 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-xl bg-[#1E2636] border border-[#00C2FF]/50 text-[#00C2FF] flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-display text-sm font-extrabold text-white">
                      {t('Join with Phone', '手机加入游戏')}
                    </div>
                    <div className="text-xs text-[#9CA3AF] mt-0.5">
                      {t('Enter a 4-letter room code as controller', '输入 4 位房间码变身无线手柄')}
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#00C2FF] shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server-Verified Master PIN / Disposable Guest Pass Unlock Modal */}
      <HostUnlockModal
        open={showPinModal}
        target={pendingHostTarget}
        onClose={() => setShowPinModal(false)}
        onUnlocked={handleHostUnlocked}
      />

      {/* Owner Settings: Active Rooms, Access & Share, Master PIN */}
      <GuestPassManagerModal
        open={showGuestPassModal}
        onClose={() => setShowGuestPassModal(false)}
        onRequestReauth={handleOwnerReauthRequest}
      />

      {/* Unified Game Details, Live 5s Preview & Animated Rules Modal */}
      {previewGame && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="game-intro-title"
          onClick={() => setPreviewGameId(null)}
          className="fixed inset-0 z-50 bg-[#0B0E14]/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-5xl w-full rounded-3xl bg-[#151B26] border-2 border-[#2A354A] shadow-2xl overflow-hidden my-auto"
          >
            {/* Header with Live 5s Gameplay Preview */}
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5 border-b border-[#20293B] bg-[#10141D]">
              <div className="w-full sm:w-52 aspect-video rounded-xl overflow-hidden bg-[#0B0E14] border border-[#222B3B] shrink-0">
                <GameHoverPreview
                  gameId={previewGame.id}
                  gameName={previewGame.name}
                  accentHex={previewGame.accentHex}
                  fallbackSrc={previewGame.coverImage}
                  alt={previewGame.name}
                  active={true}
                  eager
                  immediate
                  timecodePosition="bottom-right"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1 pr-9">
                <div className="text-xs font-semibold text-[#00C2FF] flex items-center gap-2 flex-wrap">
                  <span>{previewGame.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{previewGame.playerModeLabel}</span>
                  {previewPadGuide && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span style={{ color: previewPadGuide.accentHex }}>{previewPadGuide.padTitle}</span>
                    </>
                  )}
                </div>
                <h2
                  id="game-intro-title"
                  className="font-display text-2xl sm:text-3xl font-extrabold text-white mt-0.5 truncate"
                >
                  {previewGame.name}
                </h2>
                <p className="text-xs sm:text-sm text-[#D1D5DB] mt-1 line-clamp-2">
                  {previewGame.description}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setPreviewGameId(null)}
                aria-label={t('Close', '关闭')}
                className="absolute top-4 right-4 h-9 w-9 rounded-xl bg-[#1E2636] hover:bg-[#273145] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Single-Screen Rules List Beside Live 2s Rule Animation & 3s Phone Controller Demo */}
            <div className="p-4 sm:p-5 max-h-[72vh] overflow-y-auto arcade-scrollbar">
              <RuleAnimationCard
                gameId={previewGame.id}
                gameName={previewGame.name}
                accentHex={previewGame.accentHex}
                rules={previewGame.rules}
              />
            </div>

            <div className="px-4 sm:px-5 py-3.5 bg-[#10141D] border-t border-[#20293B] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-[#9CA3AF]">
                <span>{previewGame.settingLabel}: </span>
                <strong className="text-white font-mono">
                  {previewGame.settingOptions.map((o) => o.label).join(' / ')}
                </strong>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const targetId = previewGame.id;
                    setPreviewGameId(null);
                    onOpenGuideBot(targetId);
                  }}
                  className="h-10 px-4 rounded-xl bg-[#182234] hover:bg-[#22304A] border border-[#00C2FF]/45 text-sm font-bold text-[#00C2FF] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                  <span>{t('Ask Guide Bot', '问平台助手')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewGameId(null)}
                  className="h-10 px-4 rounded-xl bg-[#1E2636] hover:bg-[#273145] text-sm font-bold text-white cursor-pointer"
                >
                  {t('Close', '关闭')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = previewGame.id;
                    setPreviewGameId(null);
                    requestHost(targetId, 'pocket');
                  }}
                  className="tactile-btn h-10 px-4 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913] font-display font-extrabold text-sm shadow-[0_3px_0_#0A915D] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {!publicAccessOpen && <Lock className="w-3.5 h-3.5" />}
                  <span>{t('Pocket Mode', '掌机开玩')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = previewGame.id;
                    setPreviewGameId(null);
                    requestHost(targetId, 'host');
                  }}
                  className="tactile-btn h-10 px-5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-extrabold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 cursor-pointer"
                >
                  {!publicAccessOpen && <Lock className="w-4 h-4" />}
                  <span>
                    {publicAccessOpen
                      ? t('Host Room', '大屏开玩')
                      : t('Host Room (PIN)', '大屏开玩')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
