import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Dices,
  Gamepad2,
  Lock,
  Pause,
  Play,
  QrCode,
  Search,
  Smartphone,
  Users,
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

interface LandingViewProps {
  onHostRoom: (preferredGameId?: GameId) => void;
  onStartPocket: (preferredGameId?: GameId) => void;
  onJoinController: (initialCode?: string) => void;
}

export function LandingView({ onHostRoom, onStartPocket, onJoinController }: LandingViewProps) {
  const { lang, t } = useLanguage();
  const [quickCode, setQuickCode] = useState('');
  const [playerFilter, setPlayerFilter] = useState<PlayerFilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewGameId, setPreviewGameId] = useState<GameId | null>(null);
  const [hoveredGameId, setHoveredGameId] = useState<GameId | null>(null);

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
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [manualPaused, setManualPaused] = useState(false);
  const [manualResumeSeconds, setManualResumeSeconds] = useState(0);
  const [activeScrollIdx, setActiveScrollIdx] = useState(0);

  // PIN Protection State for Host / Create Room / Pocket Mode
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingHostGameId, setPendingHostGameId] = useState<GameId | undefined>(undefined);
  const [pendingHostTarget, setPendingHostTarget] = useState<'host' | 'pocket'>('host');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Part 3 & 4 Scrollytelling State
  const [scrollProgress, setScrollProgress] = useState(0);
  const scrollyRef = useRef<HTMLDivElement>(null);

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
        setActiveCardIndex((prev) => (prev + 1) % 3);
        setIsFlipping(false);
      }, 350);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollyRef.current) return;
      const rect = scrollyRef.current.getBoundingClientRect();
      const windowH = window.innerHeight;
      const totalScrollable = rect.height - windowH;
      if (totalScrollable <= 0) return;
      const scrolled = windowH - rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / totalScrollable));
      setScrollProgress(progress);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
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

  const requestHost = (gameId?: GameId, target: 'host' | 'pocket' = 'host') => {
    const unlocked = sessionStorage.getItem('joystick_host_pin_unlocked') === 'true';
    if (unlocked) {
      if (target === 'pocket') {
        onStartPocket(gameId);
      } else {
        onHostRoom(gameId);
      }
    } else {
      setPendingHostGameId(gameId);
      setPendingHostTarget(target);
      setPinInput('');
      setPinError(false);
      setShowPinModal(true);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === '1234' || pinInput.trim() === '8888') {
      sessionStorage.setItem('joystick_host_pin_unlocked', 'true');
      setShowPinModal(false);
      if (pendingHostTarget === 'pocket') {
        onStartPocket(pendingHostGameId);
      } else {
        onHostRoom(pendingHostGameId);
      }
    } else {
      setPinError(true);
    }
  };

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

  // Reset rail position when category filter or search changes
  useEffect(() => {
    setActiveScrollIdx(0);
    setHoveredGameId(null);
    virtualScrollLeftRef.current = 0;
    endDwellUntilRef.current = 0;
    const el = gamesRailRef.current;
    if (el) {
      el.scrollLeft = 0;
    }
  }, [playerFilter, searchQuery]);

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
    if (!autoScrollEnabled || filteredGames.length <= 1 || previewGameId) return;
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
        const shouldShowManualPause = isActivelyInteracting || remainingManualMs > 0;
        setManualPaused((prev) => (prev === shouldShowManualPause ? prev : shouldShowManualPause));
        const nextCountdownSec = isActivelyInteracting
          ? Math.ceil(MANUAL_SCROLL_RESUME_MS / 1000)
          : remainingManualMs > 0
          ? Math.ceil(remainingManualMs / 1000)
          : 0;
        setManualResumeSeconds((prev) => (prev === nextCountdownSec ? prev : nextCountdownSec));
      } else {
        setManualPaused((prev) => (prev ? false : prev));
        setManualResumeSeconds((prev) => (prev === 0 ? prev : 0));
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
  }, [autoScrollEnabled, filteredGames.length, previewGameId, syncActiveCardFromRail]);

  const markManualScroll = useCallback((pauseMs = MANUAL_SCROLL_RESUME_MS) => {
    manualPauseUntilRef.current = performance.now() + pauseMs;
    setManualPaused(true);
    const nextSec = Math.ceil(pauseMs / 1000);
    setManualResumeSeconds((prev) => (prev === nextSec ? prev : nextSec));
  }, []);

  const scrollRailByCards = (dir: -1 | 1) => {
    const el = gamesRailRef.current;
    if (!el) return;
    markManualScroll(MANUAL_SCROLL_RESUME_MS);
    smoothScrollUntilRef.current = performance.now() + 700;
    const step = Math.min(el.clientWidth * 0.85, 680);
    const targetLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + dir * step));
    virtualScrollLeftRef.current = targetLeft;
    el.scrollTo({ left: targetLeft, behavior: 'smooth' });
  };

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

  const handleSurpriseMe = () => {
    const pool = filteredGames.length > 0 ? filteredGames : GAME_CATALOG;
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    preloadGameRenderer(pick.id);
    void preloadDemoClip(pick.id);
    void preloadRuleClips(pick.id);
    setPreviewGameId(pick.id);
  };

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
        descEn: `Browse ${totalGamesCount} arcade, board, and card party games with instant search, category filters, and detailed rules.`,
        descZh: `浏览包含 ${totalGamesCount} 款街机、桌游与纸牌的庞大游戏库，支持即时搜索、分类筛选与玩法详情。`,
        badgeEn: `${totalGamesCount} TITLES • INSTANT PLAY`,
        badgeZh: `${totalGamesCount} 款正版游戏 · 即开即玩`,
        accentHex: '#10D98B',
        icon: Gamepad2,
      },
    ],
    [totalGamesCount]
  );

  // Full Game catalog rows for Step 3 background sliding marquees
  const catalogRows = useMemo(() => {
    const third = Math.ceil(GAME_CATALOG.length / 3);
    return [
      GAME_CATALOG.slice(0, third),
      GAME_CATALOG.slice(third, third * 2),
      GAME_CATALOG.slice(third * 2),
    ];
  }, []);

  // Scrolly calculations strictly mapped to 0-0.33, 0.33-0.66, and 0.66-1.0 progress percentages
  const p = scrollProgress;
  const step1Opacity = p < 0.33 ? 1 : Math.max(0, 1 - (p - 0.33) * 6);
  const step2Opacity = p >= 0.28 && p < 0.68 ? 1 : 0;
  const step3Opacity = p >= 0.63 && p < 0.90 ? 1 : 0;
  const gameTypesOpacity = p >= 0.85 ? Math.min(1, (p - 0.85) * 6) : 0;
  const step4Opacity = gameTypesOpacity;

  // Active pad index for Step 2 strictly within 0.33 - 0.66, divided into 4 equal quarters for all 4 pads
  const activePadIndex = p < 0.4125 ? 1 : p < 0.495 ? 2 : p < 0.5775 ? 3 : 4;

  // Smooth sliding-to-left index (0 for step 1 [0-0.33], 1 for step 2 [0.33-0.66], 2 for step 3 [0.66-1.0])
  const currentStepSlide = p < 0.33 ? 0 : p < 0.66 ? 1 : 2;
  const stageTranslateX = currentStepSlide * -33.333;
  
  const stageScale = 1 + Math.max(0, Math.min(0.3, (p - 0.66) * 1.2));
  const stageOpacity = p < 0.85 ? 1 : Math.max(0, 1 - (p - 0.85) * 6.6);

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
            className="font-display text-base sm:text-xl font-extrabold tracking-tight text-white truncate min-w-0 flex items-center gap-2.5"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FF4D2E] to-[#00C2FF] flex items-center justify-center text-white shadow-[0_0_15px_rgba(255,77,46,0.3)]">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <span>{t('JoinStick Arcade', 'JoinStick 街机派对')}</span>
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

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageToggle compact className="sm:h-9 sm:px-2.5 sm:text-xs" />
            <button
              type="button"
              onClick={() => requestHost()}
              className="tactile-btn px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 shadow-[0_3px_0_#B82E17] inline-flex items-center gap-1.5 cursor-pointer transition-transform active:translate-y-0.5"
            >
              <Lock className="w-3.5 h-3.5 text-white/80" />
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
              'Turn every phone into a live arcade controller.',
              '让每部手机秒变实时街机手柄。'
            )}
          </h1>

          <p className="mt-6 text-base sm:text-xl text-[#9CA3AF] leading-relaxed max-w-2xl text-balance">
            {t(
              `Launch a secure room on any laptop or TV browser. Friends scan the QR code with their phones and jump straight into ${totalGamesCount} multiplayer games with adaptive virtual joysticks.`,
              `在电脑或电视浏览器一键开房，好友手机扫码即刻加入！低延迟实时同步，虚拟摇杆和技能按键会随 ${totalGamesCount} 款不同游戏自动切换。`
            )}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3.5 sm:gap-4">
            <button
              type="button"
              onClick={() => requestHost(undefined, 'host')}
              className="tactile-btn inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-bold text-base shadow-[0_4px_0_#B82E17] whitespace-nowrap cursor-pointer transition-transform active:translate-y-0.5"
            >
              <Lock className="w-5 h-5" />
              {t('Create Game Room', '创建大屏房间')}
            </button>

            <button
              type="button"
              onClick={() => requestHost(undefined, 'pocket')}
              className="tactile-btn inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913] font-extrabold text-base shadow-[0_4px_0_#0A915D] whitespace-nowrap cursor-pointer transition-transform active:translate-y-0.5"
            >
              <Lock className="w-4 h-4" />
              <Gamepad2 className="w-5 h-5" />
              {t('Pocket Mode (No Monitor)', '掌机模式（无需大屏）')}
            </button>

            <button
              type="button"
              onClick={() => onJoinController()}
              className="tactile-btn inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#151B26] hover:bg-[#1E2636] text-white border border-[#2A354A] font-bold text-base whitespace-nowrap cursor-pointer transition-transform active:translate-y-0.5 shadow-lg"
            >
              <Smartphone className="w-5 h-5 text-[#00C2FF]" />
              {t('Join with Phone', '手机加入游戏')}
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
                  'Explore our complete catalog of arcade, board, and card games. Filter by player count or search instantly.',
                  '探索完整的街机、桌游和纸牌游戏库。按玩家人数筛选或直接搜索。'
                )}
              </p>
            </div>

            {/* Filter Tabs + Search + Surprise Me */}
            <div className="flex flex-col gap-3 lg:items-end">
              <div
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

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full lg:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('Search games...', '搜索游戏名称...')}
                    aria-label={t('Search games', '搜索游戏')}
                    className="w-full h-10 pl-9 pr-8 rounded-xl bg-[#121722] border border-[#222B3B] focus:border-[#00C2FF] focus:outline-none text-xs sm:text-sm text-white placeholder:text-[#6B7280]"
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
                  className="tactile-btn h-10 px-4 rounded-xl bg-[#151B26] hover:bg-[#1E2636] border border-[#2A354A] text-xs font-bold text-[#00C2FF] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer shadow"
                >
                  <Dices className="w-4 h-4" />
                  <span>{t('Surprise Me', '随机挑一款')}</span>
                </button>
              </div>
            </div>
          </div>

          {filteredGames.length === 0 ? (
            <div className="rounded-2xl bg-[#141A26] border border-[#20293B] p-12 text-center">
              <p className="text-base font-bold text-white">
                {t('No games match your search.', '没有找到匹配的游戏。')}
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
              {/* Rail Controls & Spotlight Counter */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
                  <span className="font-mono font-bold text-white tabular-nums">
                    {String(Math.min(activeScrollIdx + 1, filteredGames.length)).padStart(2, '0')} /{' '}
                    {String(filteredGames.length).padStart(2, '0')}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {autoScrollEnabled && !manualPaused
                      ? t('Auto-scrolling · Manual scroll pauses for 5s', '自动横向滚动中 · 手动滑动后将暂停 5 秒')
                      : manualPaused && autoScrollEnabled
                      ? t(
                          `Paused after manual scroll · Resuming in ${Math.max(1, manualResumeSeconds)}s`,
                          `手动滑动暂停中 · ${Math.max(1, manualResumeSeconds)} 秒后恢复自动滚动`
                        )
                      : t('Auto-scroll paused · Click a card for rules & animated demo', '自动滚动已暂停 · 点击卡片查看规则与动画演示')}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setAutoScrollEnabled((prev) => !prev)}
                    className="h-9 px-3 rounded-xl bg-[#141A26] hover:bg-[#1E2636] border border-[#222B3B] text-xs font-semibold text-[#D1D5DB] hover:text-white inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors"
                  >
                    {autoScrollEnabled ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-[#00C2FF]" />
                        <span>{t('Pause Scroll', '暂停滚动')}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-[#10D98B] fill-current" />
                        <span>{t('Auto Scroll', '自动滚动')}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollRailByCards(-1)}
                    aria-label={t('Scroll games left', '向左滚动游戏')}
                    className="h-9 w-9 rounded-xl bg-[#141A26] hover:bg-[#1E2636] border border-[#222B3B] text-white inline-flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollRailByCards(1)}
                    aria-label={t('Scroll games right', '向右滚动游戏')}
                    className="h-9 w-9 rounded-xl bg-[#141A26] hover:bg-[#1E2636] border border-[#222B3B] text-white inline-flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

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

        {/* How It Works Section */}
        <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 border-t border-[#1A2230]">
          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-white mb-8">
            {t('From browser to 8-player match in three steps', '只需三步，开启 8 人同屏大乱斗')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-[#141A26] border border-[#20293B]">
              <div className="flex items-center gap-2.5 text-white font-display font-bold text-lg">
                <QrCode className="w-5 h-5 text-[#FF4D2E]" />
                <span>{t('01. Open the Monitor', '01. 打开大屏房间')}</span>
              </div>
              <p className="mt-3 text-sm text-[#9CA3AF] leading-relaxed">
                {t(
                  'Click Create Game Room on your computer or TV. Enter your Master PIN to instantly generate your 4-letter room code and QR code.',
                  '在电脑或电视上点击创建房间，输入管理密码即可立刻生成专属 4 位房间码与二维码。'
                )}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#141A26] border border-[#20293B]">
              <div className="flex items-center gap-2.5 text-white font-display font-bold text-lg">
                <Smartphone className="w-5 h-5 text-[#00C2FF]" />
                <span>{t('02. Scan & Connect', '02. 手机扫码加入')}</span>
              </div>
              <p className="mt-3 text-sm text-[#9CA3AF] leading-relaxed">
                {t(
                  'Players point their phone camera at the QR code or enter the code. No app downloads required—ready in 3 seconds.',
                  '好友用手机相机扫码或输入代码即可加入，无需下载任何 App，3 秒钟直接连上。'
                )}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#141A26] border border-[#20293B]">
              <div className="flex items-center gap-2.5 text-white font-display font-bold text-lg">
                <Users className="w-5 h-5 text-[#10D98B]" />
                <span>{t('03. Play & Test Solo', '03. 畅玩与单人测试')}</span>
              </div>
              <p className="mt-3 text-sm text-[#9CA3AF] leading-relaxed">
                {t(
                  `Switch between all ${totalGamesCount} games instantly. Need solo practice? Add AI bots or open the built-in Test Controller Dock.`,
                  `${totalGamesCount} 款游戏任意秒切。一个人想练手？随时添加 AI 机器人或打开内置测试手柄。`
                )}
              </p>
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
                <Lock className="w-5 h-5" />
                {t('Create Game Room', '创建游戏房间')}
              </button>
              <button
                type="button"
                onClick={() => requestHost(undefined, 'pocket')}
                className="tactile-btn inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913] font-extrabold text-base shadow-[0_4px_0_#0A915D] cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <Gamepad2 className="w-5 h-5" />
                {t('Pocket Mode (No Monitor)', '掌机模式（无需大屏）')}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1A2230] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#9CA3AF]">
          <span>
            {t(
              'JoinStick Arcade · Multi-Device Browser Party Console',
              'JoinStick 街机派对 · 多设备浏览器聚会游戏主机'
            )}
          </span>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => requestHost(undefined, 'host')}
              className="hover:text-white transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{t('Host Monitor', '大屏主机')}</span>
            </button>
            <button
              type="button"
              onClick={() => requestHost(undefined, 'pocket')}
              className="hover:text-[#10D98B] transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
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

      {/* PIN Verification Modal */}
      {showPinModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pin-modal-title"
          onClick={() => setShowPinModal(false)}
          className="fixed inset-0 z-50 bg-[#0B0E14]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full rounded-3xl bg-[#151B26] border-2 border-[#2A354A] shadow-2xl p-6 sm:p-8 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-[#FF4D2E]/20 border border-[#FF4D2E]/40 flex items-center justify-center mx-auto text-[#FF4D2E] mb-4">
              <Lock className="w-7 h-7" />
            </div>

            <h2 id="pin-modal-title" className="font-display text-2xl font-extrabold text-white">
              {pendingHostTarget === 'pocket'
                ? t('Enter PIN for Pocket Mode', '请输入掌机开房密码')
                : t('Enter Host Master PIN', '请输入主持管理密码')}
            </h2>
            <p className="mt-2 text-sm text-[#9CA3AF] leading-relaxed">
              {pendingHostTarget === 'pocket'
                ? t(
                    'Please enter your security PIN to create a Pocket Mode room on your phone. (Default: 1234)',
                    '请输入安全密码以在手机端创建掌机联机房。(默认: 1234)'
                  )
                : t(
                    'Please enter your security PIN to open the Host Monitor. (Default: 1234)',
                    '请输入安全密码以打开大屏主机。(默认: 1234)'
                  )}
            </p>

            <form onSubmit={handlePinSubmit} className="mt-6 space-y-4">
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="••••"
                autoFocus
                aria-label={t('Master PIN', '管理密码')}
                className="w-full h-14 rounded-xl bg-[#0B0E14] border border-[#2A354A] focus:border-[#00C2FF] focus:outline-none font-mono text-2xl font-bold tracking-[0.4em] text-center text-white placeholder:text-[#4B5563]"
              />

              {pinError && (
                <p className="text-xs font-semibold text-[#FF4D2E]">
                  {t('Incorrect PIN. Try 1234 or 8888.', '密码错误，请尝试 1234 或 8888。')}
                </p>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 h-12 rounded-xl bg-[#1E2636] hover:bg-[#273145] text-sm font-bold text-white cursor-pointer"
                >
                  {t('Cancel', '取消')}
                </button>
                <button
                  type="submit"
                  className="tactile-btn flex-1 h-12 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-sm font-bold shadow-[0_3px_0_#B82E17] cursor-pointer"
                >
                  {t('Unlock', '解锁进入')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <Lock className="w-3.5 h-3.5" />
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
                  <Lock className="w-4 h-4" />
                  <span>{t('Host Room (PIN)', '大屏开玩')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
