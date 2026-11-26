import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crown,
  Dices,
  Flame,
  Gamepad2,
  HelpCircle,
  Lock,
  Maximize2,
  Pause,
  Play,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Share2,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  Trophy,
  Tv,
  Users,
  Volume2,
  X,
  Zap,
  ZoomIn,
} from 'lucide-react';
import { GameId } from '../shared/types';
import { LanguageToggle, useLanguage } from '../lib/i18n';
import {
  fetchHostAuthStatus,
  getHostAuthToken,
  usePublicAccessOpen,
} from '../lib/hostAuth';
import { HostUnlockModal } from './HostAccessModal';

import shotRoomSetup from '../assets/images/ui_shot_01_room_setup.png';
import shotRobotsTeams from '../assets/images/ui_shot_02_robots_teams.png';
import shotGameLobby from '../assets/images/ui_shot_03_game_lobby.png';
import shotPhoneRemote from '../assets/images/ui_shot_04_phone_remote.png';
import shotRulesBriefing from '../assets/images/ui_shot_05_live_match.png';
import shotPhoneBriefing from '../assets/images/ui_shot_06_phone_gamepad.png';
import shotPocketMode from '../assets/images/ui_shot_07_pocket_mode.png';
import shotLiveArena from '../assets/images/ui_shot_08_active_arena.png';
import shotActiveGamepad from '../assets/images/ui_shot_09_active_gamepad.png';

interface TutorialViewProps {
  onBack: () => void;
  onHostRoom: (preferredGameId?: GameId) => void;
  onStartPocket: (preferredGameId?: GameId) => void;
  onJoinController: (initialCode?: string) => void;
}

type ButtonScreenCategory =
  | 'all'
  | 'home'
  | 'setup'
  | 'lobby'
  | 'match'
  | 'phone';

interface ButtonGuideItem {
  id: string;
  screen: Exclude<ButtonScreenCategory, 'all'>;
  nameEn: string;
  nameZh: string;
  locationEn: string;
  locationZh: string;
  descEn: string;
  descZh: string;
  tipEn: string;
  tipZh: string;
  accent: string;
  icon: typeof Gamepad2;
}

interface SandboxBot {
  id: string;
  name: string;
  color: string;
  emoji: string;
}

interface FloatingReaction {
  id: number;
  emoji: string;
  leftPct: number;
}

interface ChapterScreenshot {
  id: string;
  labelEn: string;
  labelZh: string;
  src: string;
  altEn: string;
  altZh: string;
  captionEn: string;
  captionZh: string;
}

const BOT_PRESETS: Omit<SandboxBot, 'id'>[] = [
  { name: 'Bot Alpha', color: '#00C2FF', emoji: '🐱' },
  { name: 'Bot Beta', color: '#10D98B', emoji: '🦖' },
  { name: 'Bot Pixel', color: '#FFB800', emoji: '🤖' },
  { name: 'Bot Nova', color: '#A855F7', emoji: '👾' },
  { name: 'Bot Turbo', color: '#EC4899', emoji: '🚀' },
];

const CHAOS_MUTATORS = [
  {
    id: 'low-gravity',
    nameEn: 'Low Gravity',
    nameZh: '低重力漂浮',
    descEn: 'Knocks and jumps send players gliding across the arena.',
    descZh: '碰撞与跳跃会产生超远浮空效果，全场飘逸乱飞。',
    color: '#00C2FF',
  },
  {
    id: 'hyper-speed',
    nameEn: 'Hyper Speed',
    nameZh: '极速狂飙',
    descEn: '1.45× movement speed for frantic high-reflex showdowns.',
    descZh: '全体移速提升至 1.45 倍，考验极限反应。',
    color: '#FF4D2E',
  },
  {
    id: 'giant-mode',
    nameEn: 'Giant Mode',
    nameZh: '巨型乱斗',
    descEn: 'Every player scales up for chaotic heavy collisions.',
    descZh: '所有角色体型放大，正面冲撞威力倍增。',
    color: '#FFB800',
  },
  {
    id: 'reverse-controls',
    nameEn: 'Mirror Controls',
    nameZh: '方向反转',
    descEn: 'Left is right and up is down—instant couch laughter.',
    descZh: '上下左右全部镜像反转，瞬间引爆客厅笑声。',
    color: '#A855F7',
  },
  {
    id: 'double-points',
    nameEn: '2× Score Frenzy',
    nameZh: '双倍积分狂潮',
    descEn: 'Every goal, knockout, and coin counts double.',
    descZh: '本回合所有得分、淘汰与金币全部双倍计算。',
    color: '#10D98B',
  },
];

function ScreenshotFrame({
  src,
  alt,
  caption,
  zoomLabel,
  onZoom,
}: {
  src: string;
  alt: string;
  caption: string;
  zoomLabel: string;
  onZoom?: (data: { src: string; alt: string; caption: string }) => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <figure className="group relative w-full overflow-hidden rounded-2xl bg-[#0B0E14] border border-[#263248] shadow-xl">
      <div className="relative w-full aspect-video overflow-hidden bg-[#090C12]">
        {failed ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center bg-gradient-to-br from-[#161E2E] via-[#101521] to-[#1A1624]">
            <div className="w-12 h-12 rounded-2xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/35 flex items-center justify-center text-[#FF4D2E]">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-white max-w-xs">{alt}</p>
          </div>
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            onClick={() => onZoom?.({ src, alt, caption })}
            className="w-full h-full object-contain bg-[#090C12] cursor-zoom-in transition-transform duration-300 group-hover:scale-[1.01]"
          />
        )}

        {onZoom && !failed && (
          <button
            type="button"
            onClick={() => onZoom({ src, alt, caption })}
            className="absolute top-3 right-3 h-8 px-2.5 rounded-lg bg-[#0B0E14]/85 hover:bg-[#151C29] border border-[#2A364D] text-[11px] font-semibold text-[#E5E7EB] inline-flex items-center gap-1.5 backdrop-blur-md cursor-pointer transition-colors"
          >
            <ZoomIn className="w-3.5 h-3.5 text-[#00C2FF]" />
            <span>{zoomLabel}</span>
          </button>
        )}
      </div>

      <figcaption className="px-4 py-2.5 bg-[#101520] border-t border-[#1F2838] text-xs font-medium text-[#CBD5E1] flex items-center justify-between gap-2">
        <span className="truncate">{caption}</span>
      </figcaption>
    </figure>
  );
}

export function TutorialView({
  onBack,
  onHostRoom,
  onStartPocket,
  onJoinController,
}: TutorialViewProps) {
  const { lang, t } = useLanguage();
  const publicAccessOpen = usePublicAccessOpen();

  // Host launch unlock state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<'host' | 'pocket'>('host');

  // Walkthrough chapter + per-chapter screenshot tab state
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [activeShotIdx, setActiveShotIdx] = useState(0);
  const [lightboxData, setLightboxData] = useState<{
    src: string;
    alt: string;
    caption: string;
  } | null>(null);

  // Interactive Sandbox state
  const [sandboxBots, setSandboxBots] = useState<SandboxBot[]>([
    { id: 'bot-1', name: 'Bot Alpha', color: '#00C2FF', emoji: '🐱' },
    { id: 'bot-2', name: 'Bot Beta', color: '#10D98B', emoji: '🦖' },
  ]);
  const [botDifficulty, setBotDifficulty] = useState<'chill' | 'arcade' | 'spicy'>('arcade');
  const [teamMode, setTeamMode] = useState<'ffa' | 'teams2' | '1vsAll'>('ffa');
  const [chaosIndex, setChaosIndex] = useState<number | null>(null);
  const [isSpinningChaos, setIsSpinningChaos] = useState(false);
  const [padStyle, setPadStyle] = useState<'joystick' | 'arrows' | 'swipe'>('joystick');
  const [avatarPos, setAvatarPos] = useState({ x: 50, y: 50 });
  const [avatarBurst, setAvatarBurst] = useState<string | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [stickKnob, setStickKnob] = useState<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const stickBaseRef = useRef<HTMLDivElement | null>(null);
  const stickVecRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [swipeCursor, setSwipeCursor] = useState<{ x: number; y: number; active: boolean }>({
    x: 50,
    y: 50,
    active: false,
  });
  const swipeLastRef = useRef<{ x: number; y: number } | null>(null);
  const [sandboxLog, setSandboxLog] = useState<{ en: string; zh: string }>({
    en: 'Click any control above to see how JoinStick Arcade reacts in a real match.',
    zh: '点击上方任意按钮，立即体验 JoinStick 街机派对在真实房间中的即时反馈。',
  });
  const reactionIdRef = useRef(1);

  // Complete Button Directory filter state
  const [buttonFilter, setButtonFilter] = useState<ButtonScreenCategory>('all');
  const [buttonSearch, setButtonSearch] = useState('');

  useEffect(() => {
    void fetchHostAuthStatus().catch(() => {});
  }, []);

  useEffect(() => {
    setActiveShotIdx(0);
  }, [activeChapterIdx]);

  useEffect(() => {
    if (!lightboxData) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxData(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxData]);

  const requestLaunch = (target: 'host' | 'pocket') => {
    const token = getHostAuthToken();
    if (token || publicAccessOpen) {
      if (target === 'pocket') {
        onStartPocket();
      } else {
        onHostRoom();
      }
      return;
    }
    setPendingTarget(target);
    setShowPinModal(true);
  };

  const handleUnlocked = () => {
    setShowPinModal(false);
    if (pendingTarget === 'pocket') {
      onStartPocket();
    } else {
      onHostRoom();
    }
  };

  const chapters = useMemo<
    {
      num: string;
      tabEn: string;
      tabZh: string;
      titleEn: string;
      titleZh: string;
      subtitleEn: string;
      subtitleZh: string;
      shots: ChapterScreenshot[];
      steps: { labelEn: string; labelZh: string; detailEn: string; detailZh: string }[];
      tipEn: string;
      tipZh: string;
    }[]
  >(
    () => [
      {
        num: '01',
        tabEn: 'Create & Join',
        tabZh: '创建与加入',
        titleEn: 'Create a Room & Scan QR / Enter PIN',
        titleZh: '创建大屏房间，扫码或输房间码加入',
        subtitleEn: 'Actual JoinStick Party Stage screen when you open a big-screen room.',
        subtitleZh: '点击创建大屏房间后的真实界面，支持二维码、4 位房间码与一键分享链接。',
        shots: [
          {
            id: 'room-setup',
            labelEn: 'Room Setup Screen',
            labelZh: '房间创建界面',
            src: shotRoomSetup,
            altEn: 'JoinStick Party Stage room setup UI showing Game PIN, QR code, Share Invite, Add Robot, Team Mode, and Enter Game Room',
            altZh: 'JoinStick 房间设置实机截图，显示 4 位房间码、二维码、分享邀请、添加机器人与进入游戏大厅按钮',
            captionEn: 'Exact Platform UI · JoinStick Party Stage (Game PIN, QR Code, Share Invite & Test Controller)',
            captionZh: '实机界面截图 · JoinStick 房间准备舞台（4 位房间码、二维码、分享邀请与测试手柄）',
          },
        ],
        steps: [
          {
            labelEn: 'Click Start Playing → Create Game Room',
            labelZh: '点击首页「立即开玩」→「创建大屏房间」',
            detailEn:
              'Your browser opens JoinStick Party Stage with a unique 4-letter GAME PIN and scannable QR code on the right.',
            detailZh:
              '浏览器会立即生成专属 4 位 GAME PIN 与右侧高清二维码；若平台处于锁定状态，输入房主密码或访客码即可进入。',
          },
          {
            labelEn: 'Use Share Invite, Copy Join Link, or Open Phone Tab',
            labelZh: '点击「分享邀请」「复制加入链接」或让好友直接扫码',
            detailEn:
              'Friends scan the QR code with their phone camera or tap your shared link—up to 8 players join in 3 seconds with zero downloads.',
            detailZh:
              '好友用手机相机扫码或点开群聊链接，无需下载 App，最多 8 部手机 3 秒直连并显示在下方玩家席位中。',
          },
          {
            labelEn: 'Solo on one laptop? Click Test Controller at top-right',
            labelZh: '只有一台电脑想试玩？点击右上角「测试手柄」',
            detailEn:
              'Test Controller opens an interactive built-in gamepad right inside the host screen so you can try any game without a phone.',
            detailZh:
              '顶部「测试手柄」按钮会在大屏侧边展开虚拟手柄，支持鼠标与键盘操控，随时独自练手。',
          },
        ],
        tipEn:
          'The first human player to join (P1 Alex with the gold Host crown) automatically controls the TV lobby from their phone.',
        tipZh:
          '首位连入的真人玩家（带金色 Host 皇冠标记）会自动获得手机遥控器权限，可直接在沙发上操控大屏选游戏。',
      },
      {
        num: '02',
        tabEn: 'Robots & Teams',
        tabZh: '机器人与组队',
        titleEn: 'Add AI Robots, Tune Difficulty & Build Teams',
        titleZh: '一键添加 AI 机器人、切难度与红蓝分队',
        subtitleEn: 'See the exact Room Setup bar with 3 AI bots, Spicy difficulty, and 2 Teams active.',
        subtitleZh: '实机展示添加 3 名 AI 机器人、切换高能难度并开启 2 支战队（红队 vs 蓝队）的真实效果。',
        shots: [
          {
            id: 'robots-teams',
            labelEn: 'Robots & 2 Teams UI',
            labelZh: '机器人与分队界面',
            src: shotRobotsTeams,
            altEn: 'JoinStick Room Setup UI with 1 human host and 3 Spicy AI robots split into Red and Blue teams',
            altZh: 'JoinStick 房间设置实机截图：1 名真人房主 + 3 名高能 AI 机器人已分配至红蓝两队',
            captionEn: 'Exact Platform UI · + Add Robot, Chill / Arcade / Spicy AI, Team Mode & Shuffle Teams',
            captionZh: '实机界面截图 · 添加机器人、休闲/街机/高能 AI 难度、组队模式与随机洗牌分队',
          },
        ],
        steps: [
          {
            labelEn: 'Click + Add Robot to fill up to 8 seats instantly',
            labelZh: '点击蓝色「+ 添加机器人」按钮快速补位（上限 8 人）',
            detailEn:
              'Each click adds an AI robot (Bot Alpha, Bot Beta, Bot Pixel…) with its own avatar and color. Bots are Always Ready and work in all 200 games.',
            detailZh:
              '每点一次加入一名自带头像与配色的 AI 机器人，状态默认「随时就绪」，全面支持 200 款街机、桌游与纸牌。',
          },
          {
            labelEn: 'Select AI Difficulty: Chill, Arcade, or Spicy',
            labelZh: '在右侧切换机器人难度：休闲 / 街机 / 高能',
            detailEn:
              'Chill gives relaxed family pacing, Arcade offers balanced party fun, and Spicy turns bots into fast & sharp competitive rivals.',
            detailZh:
              '「休闲」适合轻松破冰，「街机」势均力敌，「高能」则让机器人具备极速反应与精准走位。',
          },
          {
            labelEn: 'Choose Team Mode: Solo FFA, 2–4 Teams, or 1 vs All',
            labelZh: '在 TEAM MODE 栏切换个人混战、2～4 队或 1 对多',
            detailEn:
              'Pick 2 Teams, 3 Teams, 4 Teams, or 1 vs All, and click Shuffle Teams on the right to remix squads in one tap. Click × on any card to remove a bot.',
            detailZh:
              '切换为 2～4 队或 1 对多后，右侧会出现「随机分队」按钮一键重排阵营；点卡片右上角 × 可随时移除机器人。',
          },
        ],
        tipEn:
          'When everyone (and your bots) are seated, click the orange Enter Game Room → button to open the 200-game lobby.',
        tipZh:
          '人数与机器人就绪后，点击橙色「进入游戏大厅 →」按钮即可带着全员进入 200 款游戏精选舞台。',
      },
      {
        num: '03',
        tabEn: 'Game Lobby',
        tabZh: '游戏大厅',
        titleEn: 'Browse 200 Games, Chaos Wheel & 5-Game Cup',
        titleZh: '200 款游戏秒切、混沌转盘与 5 局杯赛',
        subtitleEn: 'Every lobby button visible on one clean TV screen—with live animated game previews.',
        subtitleZh: '真实 JoinStick 游戏大厅界面：分类筛选、即时搜索、实机预览、准备状态与底部工具栏一览无余。',
        shots: [
          {
            id: 'game-lobby',
            labelEn: 'Game Room Lobby UI',
            labelZh: '游戏大厅主界面',
            src: shotGameLobby,
            altEn: 'JoinStick Game Room Lobby UI showing Bumper Brawl live preview, category tabs, Ready Check panel, Open Bumper Brawl, 5-Game Cup, Chaos Wheel, and Add Robot',
            altZh: 'JoinStick 游戏大厅实机截图，显示游戏分类、实机演示卡片、准备状态栏、开始游戏、5 局杯赛与混沌转盘',
            captionEn: 'Exact Platform UI · JoinStick Game Room (200 Games, Ready Check, 5-Game Cup & Chaos Wheel)',
            captionZh: '实机界面截图 · JoinStick 游戏大厅（200 款游戏、准备确认、5 局杯赛与混沌转盘）',
          },
        ],
        steps: [
          {
            labelEn: 'Filter by All (200), MY Classics, Arcade, Board, Cards, or Quick Search',
            labelZh: '顶部按全部分类、马新经典、街机、桌游、卡牌筛选或关键词搜索',
            detailEn:
              'The center spotlight plays a live 5-second gameplay clip, shows the matched phone pad type (e.g. Pad 1 · Pro Stick), and lists Button A / Button B actions.',
            detailZh:
              '中央主卡片会自动播放 5 秒实机演示，并清晰标出适配的手机手柄类型以及 A / B 键功能，也能点「随机」让系统帮挑。',
          },
          {
            labelEn: 'Use the Bottom Bar: 5-Game Cup, Chaos Wheel & Rounds',
            labelZh: '底部功能栏一键开启「5 局杯赛」「混沌转盘」与「回合设置」',
            detailEn:
              'Start a 5-Game Cup tournament with cumulative points, spin Chaos Wheel for wild match rules, tweak Rounds, add bots, or jump back to Room Setup / QR.',
            detailZh:
              '点击「5 局杯赛」开启多轮积分总冠军赛，点击「混沌转盘」抽取随机疯狂词条，也可随时改回合数、加机器人或返回二维码页。',
          },
          {
            labelEn: 'Watch Ready Check & press Open [Game] (or OK on Phone Remote)',
            labelZh: '查看右侧「准备确认」，点击左下角橙色按钮或手机按 OK 开赛',
            detailEn:
              'Human phones show Not Ready → Ready in real time while AI bots stay Ready. Once ready, hit Open Bumper Brawl (or tap OK on the Host Phone Remote).',
            detailZh:
              '右侧实时显示每位真人玩家的准备进度（AI 自动就绪），全员就绪后点击左下角橙色开赛按钮或在房主手机上按 OK 即可进场。',
          },
        ],
        tipEn:
          'Top bar shows "Controlled by Alex’s Phone Remote" so everyone knows who currently holds the couch remote—plus Test Remote, Fullscreen, Audio, and Close Room.',
        tipZh:
          '顶部居中会显示当前持有手机遥控器的房主姓名，右侧还提供「测试遥控」「全屏」「音效」与「关闭房间」快捷控制。',
      },
      {
        num: '04',
        tabEn: 'Live Match',
        tabZh: '规则与实战',
        titleEn: 'Pre-Match Rules Briefing & Live Arena HUD',
        titleZh: '赛前动图规则讲解与实时对战大屏',
        subtitleEn: 'Toggle between the Pre-Match Rules screen and Live In-Match Arena screenshots below.',
        subtitleZh: '可在下方切换查看「实时对战赛场」与「赛前动图规则讲解」两张真实平台截图。',
        shots: [
          {
            id: 'live-arena',
            labelEn: 'Live Arena Match',
            labelZh: '实时对战画面',
            src: shotLiveArena,
            altEn: 'Live Bumper Brawl match on JoinStick Host Monitor with 4 players battling inside the shrinking arena, live scores, Test Pad, Tutorial, Pause, and Game Room HUD',
            altZh: 'JoinStick 实机对战画面：4 位玩家在竞技场内激战，顶部展示实时比分、测试手柄、教程、暂停与返回大厅按钮',
            captionEn: 'Exact Platform UI · Live Match Arena (Scoreboard HUD, Round Timer, Test Pad, Tutorial & Pause)',
            captionZh: '实机界面截图 · 实时对战大屏（顶部计分板、回合倒计时、测试手柄、教程与暂停控制）',
          },
          {
            id: 'rules-briefing',
            labelEn: 'Pre-Match Rules Briefing',
            labelZh: '赛前规则引导页',
            src: shotRulesBriefing,
            altEn: 'JoinStick Pre-Match Rules Briefing UI showing 4 numbered rules, animated 2s rule clip, 3s phone control loop, and Host Override Start Now',
            altZh: 'JoinStick 赛前规则引导实机截图：4 条编号规则、2 秒动图演示、3 秒手机操控动画与房主直接开始按钮',
            captionEn: 'Exact Platform UI · Pre-Match Rules Briefing (Rule Clips, Phone Control Loop & Host Override)',
            captionZh: '实机界面截图 · 赛前规则讲解页（动图规则片段、手机按键循环演示与房主立即开始）',
          },
        ],
        steps: [
          {
            labelEn: 'Every game starts with a crystal-clear Rules & Control Briefing',
            labelZh: '每局开始前自动展示「玩法规则 + 动图演示 + 手机按键循环」',
            detailEn:
              'New players see numbered rules, a 2-second live clip, and a 3-second phone finger animation before tapping "I’m Ready!"—or click Host Override: Start Now.',
            detailZh:
              '即使没玩过的新朋友，也能在几秒内通过动图和手机按键演示秒懂玩法；房主随时可点「房主直接开始」跳过等待。',
          },
          {
            labelEn: 'Live Match Top HUD keeps controls 1 click away',
            labelZh: '对战中顶部工具栏随时可用：测试手柄 / 教程 / 暂停 / 返回大厅',
            detailEn:
              'See live rankings & scores for all players (#1–#8), open Tutorial anytime to review rules, Pause for a break, toggle sound/fullscreen, or return to Game Room.',
            detailZh:
              '顶部实时滚动全员排名与得分，途中可随时点「教程」回看规则、点「暂停」中场休息，或点「返回大厅」秒换游戏。',
          },
          {
            labelEn: 'Instant Rematch or Switch Game right after the podium',
            labelZh: '赛后领奖台一键「再来一局」「切换游戏」或「返回大厅」',
            detailEn:
              'After the round ends, everyone sees the podium scoreboard and can rematch immediately without re-scanning QR codes.',
            detailZh:
              '比赛结束立刻呈现积分领奖台，全员无需重新扫码，一键即可原地复赛或切换下一款游戏。',
          },
        ],
        tipEn:
          'Even mid-match, clicking Test Pad on the monitor lets you jump in with keyboard/mouse if someone hands off their turn.',
        tipZh:
          '哪怕比赛已经开始，点击大屏顶部的「测试手柄」也能随时调出内置虚拟手柄辅助试玩。',
      },
      {
        num: '05',
        tabEn: 'Phone Controls',
        tabZh: '手机手柄与遥控',
        titleEn: 'Phone Gamepad, Host TV Remote & Pad Switcher',
        titleZh: '手机实机手柄、客厅遥控器与 3 种操控模式',
        subtitleEn: 'Switch between all 3 actual smartphone screens below to inspect every phone button.',
        subtitleZh: '点击下方标签可切换查看「对战手柄」「房主客厅遥控器」「赛前手柄切换页」三张真实手机截图。',
        shots: [
          {
            id: 'active-gamepad',
            labelEn: 'In-Game Phone Gamepad',
            labelZh: '对战中手机手柄',
            src: shotActiveGamepad,
            altEn: 'Actual JoinStick Phone Gamepad UI in landscape showing 360 degree virtual joystick, DASH and PULSE action buttons, 1 Stick / 2 Arrows / 3 Swipe bar, Pause, Calibration, and Turbo',
            altZh: 'JoinStick 手机实机横屏手柄界面：360° 虚拟摇杆、DASH 与 PULSE 动作键、摇杆/方向键/滑动切换栏与设置图标',
            captionEn: 'Exact Phone UI · Live Gamepad (360° Stick, DASH/PULSE, 1·Stick / 2·Arrows / 3·Swipe, Pause & Turbo)',
            captionZh: '手机实机截图 · 对战手柄（360° 摇杆、DASH/PULSE 键、3 种布局秒切、暂停与连发模式）',
          },
          {
            id: 'phone-remote',
            labelEn: 'Host TV Remote',
            labelZh: '房主客厅遥控器',
            src: shotPhoneRemote,
            altEn: 'Actual JoinStick Host Phone TV Remote UI showing directional D-Pad with orange OK button, Kick / Host transfer, All Ready status, and live emoji reaction bar',
            altZh: 'JoinStick 房主手机客厅遥控器实机截图：十字方向键与橙色 OK 键、踢人/移交房主、全员就绪按钮与底部表情栏',
            captionEn: 'Exact Phone UI · Host TV Remote (D-Pad + OK, Kick / Host, Ready Check & Emoji Reactions)',
            captionZh: '手机实机截图 · 房主电视遥控器（方向键 + OK、踢人/移交房主、准备状态与底部互动表情）',
          },
          {
            id: 'phone-briefing',
            labelEn: 'Pre-Match Pad Picker',
            labelZh: '赛前规则与选布局',
            src: shotPhoneBriefing,
            altEn: 'Actual JoinStick Phone pre-match Rules and Controls screen with 1 Stick / 2 Arrows / 3 Swipe selector and I am Ready button',
            altZh: 'JoinStick 手机赛前规则确认实机截图：显示玩法步骤、自动匹配手柄提示、3 种按键切换与「我准备好了」大按钮',
            captionEn: 'Exact Phone UI · Pre-Match Rules & Auto-Matched Pad Selector ("I’m Ready!" + Host Start Now)',
            captionZh: '手机实机截图 · 赛前规则与操控布局切换（点击「我准备好了！」立即通知房主）',
          },
        ],
        steps: [
          {
            labelEn: 'Switch between 1·Stick, 2·Arrows, and 3·Swipe anytime',
            labelZh: '顶部一键秒切「1·摇杆」「2·方向键」「3·滑动」三种手感',
            detailEn:
              'Every player independently chooses their favorite movement layout right on the top bar—plus tap the sliders icon to adjust size, opacity, and haptics, or toggle Turbo.',
            detailZh:
              '每位玩家可在手机顶部随时切换最顺手的移动方式，点击调节图标还能微调大小、透明度与震动，甚至开启 Turbo 连发。',
          },
          {
            labelEn: 'In the Lobby, Host’s phone becomes a Couch TV Remote',
            labelZh: '进入大厅时，房主手机自动变身「客厅电视遥控器」',
            detailEn:
              'Use the big D-Pad + OK button to browse all 200 games on the TV, tap Kick / Host (gold button) to transfer remote control or remove inactive players, and fire bottom emojis.',
            detailZh:
              '用大号十字方向键与橙色 OK 键隔空翻选 200 款游戏；金色「Kick / Host」键可移交房主或管理成员，左下角随时向大屏发表情。',
          },
          {
            labelEn: 'Tap I’m Ready! on the Pre-Match screen (or Pause mid-match)',
            labelZh: '赛前轻点「我准备好了！」，局内也可直接点暂停或发表情',
            detailEn:
              'Each game automatically labels your A & B buttons (e.g. DASH / PULSE) so you never have to memorize abstract controls.',
            detailZh:
              '每款游戏都会自动给 A / B 键标上具体技能名称（如 DASH 冲刺 / PULSE 冲击波），上手零记忆负担。',
          },
        ],
        tipEn:
          'Non-host players can also send live 🔥 😂 ⚡ 👑 🎉 👏 emoji reactions onto the big TV while waiting in the lobby.',
        tipZh:
          '非房主玩家在等待开局时，同样可以在手机端点击 🔥 😂 ⚡ 👑 🎉 👏 向客厅电视发射弹幕表情。',
      },
      {
        num: '06',
        tabEn: 'Pocket Mode',
        tabZh: '掌机模式',
        titleEn: 'Pocket Mode — Host & Play Directly on Your Phone',
        titleZh: '掌机模式：无需电视电脑，手机直接开房畅玩',
        subtitleEn: 'Actual Pocket Mode smartphone interface hosting a full multiplayer room anywhere.',
        subtitleZh: '真实手机掌机模式截图：自带 200 款游戏浏览、筛选、混沌转盘、杯赛与回合设置，随时随地开黑。',
        shots: [
          {
            id: 'pocket-mode',
            labelEn: 'Pocket Mode Lobby UI',
            labelZh: '掌机模式大厅实机',
            src: shotPocketMode,
            altEn: 'Actual JoinStick Pocket Mode smartphone UI showing landscape game carousel, Search, Filter, Random, Chaos, Cup, Round options, Tap Ready, and Start button',
            altZh: 'JoinStick 掌机模式手机实机截图：横屏游戏卡片、搜索、筛选、随机、混沌、杯赛、回合档位与准备开始按钮',
            captionEn: 'Exact Phone UI · Pocket Mode (Full 200-Game Host Console Inside Your Smartphone)',
            captionZh: '手机实机截图 · 掌机模式（无需大屏，手机横屏即刻化身完整 200 款游戏主机）',
          },
        ],
        steps: [
          {
            labelEn: 'Open Start Playing → Pocket Mode (No Monitor)',
            labelZh: '在首页点击「立即开玩」→「掌机模式（无需大屏）」',
            detailEn:
              'Pick your callsign, avatar, and controller color, then tap Create Pocket Room. Your phone generates a real room code (e.g. E9WA) right in the top bar.',
            detailZh:
              '选好昵称、头像与颜色并点击「创建掌机房间」，手机顶部立即生成 4 位房间码，直接进入横屏掌机大厅。',
          },
          {
            labelEn: 'All Host Tools Built In: Search, Filter, Random, Chaos & Cup',
            labelZh: '完整保留搜索、筛选、随机、混沌转盘、杯赛与回合档位',
            detailEn:
              'Swipe through game cards, choose 3 Rounds / 5 Rounds / 1 Quick Round at the bottom, and tap Share to invite nearby friends onto their own phones.',
            detailZh:
              '横滑挑选全部 200 款游戏，底部一键切回合数，点顶部「分享」即可让身旁朋友用各自手机连入同玩。',
          },
          {
            labelEn: 'Tap Ready → ▶ Start to play with translucent controls over the arena',
            labelZh: '点击「准备」→「▶ 开始」，半透明手柄直接叠加在实时赛场上',
            detailEn:
              'No TV, laptop, or projector needed—ideal for cafés, road trips, dorms, or quick solo robot matches.',
            detailZh:
              '不需要电视、电脑或投影仪，咖啡厅小聚、旅途候车或宿舍开黑掏出手机就能立即开打。',
          },
        ],
        tipEn:
          'Rotate your phone horizontally in Pocket Mode—the live arena renders fullscreen behind your translucent thumbstick and buttons.',
        tipZh:
          '掌机模式下建议横屏握持，赛场画面会铺满整个屏幕，半透明按键不遮挡视野。',
      },
    ],
    []
  );

  const buttonDirectory = useMemo<ButtonGuideItem[]>(
    () => [
      // Homepage
      {
        id: 'start-playing',
        screen: 'home',
        nameEn: 'Start Playing',
        nameZh: '立即开玩',
        locationEn: 'Homepage Hero',
        locationZh: '首页主视觉区',
        descEn:
          'Opens the Play Mode chooser so you can launch Create Game Room (TV/Laptop), Pocket Mode (Phone-only host), or Join with Phone.',
        descZh:
          '打开游玩方式选择框，一键选择「创建大屏房间」「掌机模式（无需大屏）」或「手机加入游戏」。',
        tipEn: 'Best starting point whether you are hosting on a TV or joining from a phone.',
        tipZh: '无论大屏开房还是手机直连，从这里出发最省心。',
        accent: '#FF4D2E',
        icon: Play,
      },
      {
        id: 'quick-connect',
        screen: 'home',
        nameEn: 'Quick Controller Connect',
        nameZh: '快速连接手柄',
        locationEn: 'Homepage Hero',
        locationZh: '首页房间码输入框',
        descEn:
          'Type any active 4-letter GAME PIN and press Connect to jump straight into that room as a wireless phone controller.',
        descZh:
          '输入任意正在运行房间的 4 位房间码并点击「连接」，无需扫码直接进入手柄页面。',
        tipEn: 'Room codes are case-insensitive and never use confusing letters.',
        tipZh: '房间码不区分大小写，输入后立即直达入场设置。',
        accent: '#00C2FF',
        icon: Smartphone,
      },
      {
        id: 'surprise-me',
        screen: 'home',
        nameEn: 'Surprise Me & Game Preview',
        nameZh: '随机挑一款与游戏预览',
        locationEn: 'Homepage Game Library',
        locationZh: '首页游戏库区域',
        descEn:
          'Filter all 200 titles by player count, search by keyword, or click Surprise Me to open a random game’s live 5s video demo and animated rules.',
        descZh:
          '支持按人数筛选或关键词搜索 200 款游戏；点击「随机挑一款」立刻展示随机游戏的 5 秒实机演示与动态规则。',
        tipEn: 'You can launch Host Room or Pocket Mode directly for that game from its preview modal.',
        tipZh: '在预览弹窗右下角可直接指定该游戏启动大屏房间或掌机模式。',
        accent: '#10D98B',
        icon: Dices,
      },
      // Room Setup
      {
        id: 'qr-pin',
        screen: 'setup',
        nameEn: 'GAME PIN & QR Code',
        nameZh: '4 位 GAME PIN 与二维码',
        locationEn: 'Room Setup (Party Stage)',
        locationZh: '房间准备舞台页',
        descEn:
          'Displays your live room’s scannable QR code and big-font 4-letter GAME PIN so friends join with any phone camera in seconds.',
        descZh:
          '大屏醒目展示专属二维码与超大号 4 位房间码，好友打开手机相机一扫即可加入。',
        tipEn: 'Works across iOS Safari, Android Chrome, and tablet browsers with zero downloads.',
        tipZh: '全面兼容 iOS Safari、安卓 Chrome 及平板浏览器，无需安装。',
        accent: '#00C2FF',
        icon: QrCode,
      },
      {
        id: 'share-invite',
        screen: 'setup',
        nameEn: 'Share Invite / Copy Join Link / Open Phone Tab',
        nameZh: '分享邀请 / 复制加入链接 / 打开手机标签页',
        locationEn: 'Room Setup (Party Stage)',
        locationZh: '房间准备舞台左侧',
        descEn:
          'Triggers native system share, copies a one-tap join URL, or opens a local controller tab right beside your host window for fast testing.',
        descZh:
          '一键调起系统分享、复制免输码直连链接，或直接在当前浏览器新开一个手机手柄标签页方便测试。',
        tipEn: 'Great for large living rooms, projectors, or WhatsApp/WeChat group chats.',
        tipZh: '非常适合投影仪大客厅或直接发到微信、WhatsApp 群聊邀人。',
        accent: '#00C2FF',
        icon: Share2,
      },
      {
        id: 'add-robot',
        screen: 'setup',
        nameEn: '+ Add Robot',
        nameZh: '+ 添加机器人',
        locationEn: 'Room Setup & Game Lobby',
        locationZh: '房间准备页与游戏大厅',
        descEn:
          'Adds an AI-controlled contender (Bot Alpha, Bot Beta, Bot Pixel…) up to 8 total seats. Click × on any bot card to remove it anytime.',
        descZh:
          '向房间添加一名 AI 电脑玩家（总人数上限 8 人），随时可点击机器人卡片右上角 × 清理空位。',
        tipEn: 'AI robots are Always Ready and adapt automatically across all 200 games.',
        tipZh: 'AI 机器人默认「随时就绪」，全面支持 200 款游戏自动参战。',
        accent: '#10D98B',
        icon: Bot,
      },
      {
        id: 'bot-difficulty',
        screen: 'setup',
        nameEn: 'Bot Difficulty (Chill / Arcade / Spicy)',
        nameZh: '机器人难度（休闲 / 街机 / 高能）',
        locationEn: 'Room Setup & Lobby Bottom Bar',
        locationZh: '房间准备页与大厅底部栏',
        descEn:
          'Controls AI reaction speed, dodging, aiming, and tactical intensity across the whole room.',
        descZh:
          '统一调节房间内所有 AI 机器人的反应速度、瞄准精度、走位躲避与策略激进程度。',
        tipEn: 'Start on Arcade for balanced party duels, then switch to Spicy for sharp rivals.',
        tipZh: '默认「街机」最适合朋友聚会，想体验高手对决就切到「高能」。',
        accent: '#FFB800',
        icon: Flame,
      },
      {
        id: 'team-mode',
        screen: 'setup',
        nameEn: 'Team Mode & Shuffle Teams',
        nameZh: '组队模式与随机分队',
        locationEn: 'Room Setup & Lobby Ready Panel',
        locationZh: '房间准备页与大厅右侧',
        descEn:
          'Switches between Solo FFA, 2 Teams, 3 Teams, 4 Teams, or 1 vs All—with a Shuffle Teams button to rebalance squads in one tap.',
        descZh:
          '在个人混战、2～4 支战队对抗以及 1 对多非对称追逐赛之间一键切换，并支持一键随机洗牌分队。',
        tipEn: 'Click any player’s RED/BLUE badge on stage to swap them between teams manually.',
        tipZh: '点击玩家卡片上的红/蓝队伍标签也可手动调换阵营。',
        accent: '#A855F7',
        icon: Users,
      },
      {
        id: 'test-controller',
        screen: 'setup',
        nameEn: 'Test Controller / Test Remote / Test Pad',
        nameZh: '测试手柄 / 测试遥控 / 局内测试手柄',
        locationEn: 'Host Monitor Top Bar',
        locationZh: '大屏顶部工具栏',
        descEn:
          'Opens an interactive on-screen virtual phone controller right inside the Host Monitor so you can browse games or play solo on one computer.',
        descZh:
          '直接在大屏界面侧边展开内置虚拟手机手柄或遥控器，无需额外手机也能在单台电脑上完整游玩。',
        tipEn: 'Supports both mouse clicks and keyboard controls (WASD / Arrow keys + Space).',
        tipZh: '同时支持鼠标点击与键盘方向键 / WASD + 空格键操控。',
        accent: '#FF4D2E',
        icon: Gamepad2,
      },
      {
        id: 'enter-game-room',
        screen: 'setup',
        nameEn: 'Enter Game Room →',
        nameZh: '进入游戏大厅 →',
        locationEn: 'Room Setup (Party Stage)',
        locationZh: '房间准备舞台右侧橙色按钮',
        descEn:
          'Moves all seated phone players and AI robots from the check-in stage into the 200-game JoinStick Game Room.',
        descZh:
          '将已加入的所有手机玩家与 AI 机器人一同带入 200 款游戏精选大厅。',
        tipEn: 'Late friends can still join anytime—your 4-letter PIN stays visible in the top bar.',
        tipZh: '进大厅后 4 位房间码依然常驻顶部，迟到的朋友随时都能中途加入。',
        accent: '#FF4D2E',
        icon: ArrowRight,
      },
      // Game Lobby
      {
        id: 'game-settings',
        screen: 'lobby',
        nameEn: 'Rounds / Match Settings',
        nameZh: '回合与赛制设置',
        locationEn: 'Game Lobby Bottom Bar',
        locationZh: '游戏大厅底部控制栏',
        descEn:
          'Cycles the selected game’s match rule—such as 3 Rounds, 5 Rounds, 1 Quick Round, score targets, or timers—before opening.',
        descZh:
          '开局前一键切换当前游戏的胜负档位，例如 3 回合、5 回合、1 局快赛或目标分数。',
        tipEn: 'Every game has tailored options matched to its pacing.',
        tipZh: '每款游戏都内置了最贴合自身节奏的专属档位选项。',
        accent: '#00C2FF',
        icon: Settings,
      },
      {
        id: 'chaos-wheel',
        screen: 'lobby',
        nameEn: 'Chaos Wheel',
        nameZh: '混沌转盘',
        locationEn: 'Game Lobby Bottom Bar',
        locationZh: '游戏大厅底部功能栏',
        descEn:
          'Spins an animated party wheel that applies a wild gameplay modifier (Low Gravity, Hyper Speed, Giant Mode, Mirror Controls, etc.) to the next match.',
        descZh:
          '转动趣味特效转盘，为下一局注入低重力、极速、巨型或方向反转等意想不到的派对词条。',
        tipEn: 'Spin it whenever a rematch needs an instant burst of couch chaos.',
        tipZh: '再来一局前转一下，瞬间让老游戏玩出爆笑新花样。',
        accent: '#FFB800',
        icon: Sparkles,
      },
      {
        id: 'cup-mode',
        screen: 'lobby',
        nameEn: '5-Game Cup',
        nameZh: '5 局杯赛锦标赛',
        locationEn: 'Game Lobby Bottom Bar',
        locationZh: '游戏大厅底部金色按钮',
        descEn:
          'Starts a structured multi-game championship where points carry over across rounds and players vote on the next game from their phones.',
        descZh:
          '开启多轮积分总冠军赛：每轮名次累计总分，回合间全员通过手机投票选出下一战游戏。',
        tipEn: 'Ends with a full podium celebration crowning the night’s overall champion.',
        tipZh: '全部回合战罢会自动呈现总积分领奖台，加冕整晚派对冠军。',
        accent: '#FFB800',
        icon: Trophy,
      },
      {
        id: 'ready-check',
        screen: 'lobby',
        nameEn: 'Ready Check & Open [Game]',
        nameZh: '准备确认与开始游戏',
        locationEn: 'Game Lobby Right & Bottom-Left',
        locationZh: '游戏大厅右侧与左下角',
        descEn:
          'Tracks which human phones have tapped Ready (bots are always Ready). Once ready, click Open [Game] or press OK on the Host Phone Remote.',
        descZh:
          '实时显示每位真人玩家的准备状态（AI 自动就绪）；全员准备后点左下角橙色按钮或手机按 OK 立即开赛。',
        tipEn: 'You can also click Room Setup / QR at bottom-right to show the big QR code again.',
        tipZh: '随时可点右下角「房间设置 / 二维码」快速回到扫码大屏页。',
        accent: '#10D98B',
        icon: CheckCircle2,
      },
      {
        id: 'pass-host',
        screen: 'lobby',
        nameEn: 'Kick / Host (Pass Remote)',
        nameZh: '踢人 / 移交房主控制权',
        locationEn: 'Phone Remote Top Bar & Stage',
        locationZh: '房主手机顶部金色按钮 / 准备舞台',
        descEn:
          'Lets the current host transfer the TV Remote crown to another connected player or remove an AFK player from the room.',
        descZh:
          '允许当前房主将手机遥控器皇冠权限移交给另一位玩家，或将离线挂机的玩家请出房间。',
        tipEn: 'Look for the gold crown icon beside the active remote holder’s name.',
        tipZh: '当前持有手机遥控权的玩家姓名旁会显示金色皇冠标记。',
        accent: '#FFB800',
        icon: Crown,
      },
      {
        id: 'audio-fullscreen',
        screen: 'lobby',
        nameEn: 'Audio, Fullscreen & Close Room',
        nameZh: '音效、全屏与关闭房间',
        locationEn: 'Host Monitor Top-Right',
        locationZh: '大屏顶部右上角',
        descEn:
          'Mutes/unmutes arcade sound & music, toggles edge-to-edge TV Fullscreen mode, or cleanly closes the active room and disconnects all devices.',
        descZh:
          '一键静音或恢复街机音效、切换无边框沉浸式全屏展示，或一键结束并关闭当前联机房间。',
        tipEn: 'Fullscreen hides browser tabs and address bars for a true living-room console feel.',
        tipZh: '开启全屏可隐藏浏览器标签栏，客厅电视观感媲美主机。',
        accent: '#9CA3AF',
        icon: Volume2,
      },
      // In-Match & Results
      {
        id: 'pause-resume',
        screen: 'match',
        nameEn: 'Tutorial, Pause & Game Room',
        nameZh: '局内教程、暂停与返回大厅',
        locationEn: 'In-Match Top HUD',
        locationZh: '对战画面顶部控制栏',
        descEn:
          'Opens the animated Tutorial rules overlay mid-match, pauses live gameplay for snack breaks, or returns everyone straight to the Game Room.',
        descZh:
          '对战中随时点「教程」回看玩法动图、点「暂停」中场休息，或点「返回大厅」直接换下一款游戏。',
        tipEn: 'All player phones stay seamlessly connected during pauses and game switches.',
        tipZh: '暂停、看教程或切换游戏期间，所有手机连接都保持不断线。',
        accent: '#00C2FF',
        icon: Pause,
      },
      {
        id: 'host-override',
        screen: 'match',
        nameEn: 'Host Override: Start Now / Rematch',
        nameZh: '房主直接开始 / 再来一局',
        locationEn: 'Pre-Match Briefing & Scoreboard',
        locationZh: '赛前规则页与赛后结算页',
        descEn:
          'Skips waiting for Ready taps on the Rules Briefing screen to launch the 3-2-1 countdown immediately; after matches, triggers instant Rematch.',
        descZh:
          '在规则引导页点击即可跳过等待、立刻进入 3-2-1 倒计时；赛后结算页支持一键原地复赛。',
        tipEn: 'Available on both the Host Monitor and the Host’s smartphone screen.',
        tipZh: '大屏端与房主手机端均提供快捷触发按钮。',
        accent: '#FF4D2E',
        icon: RefreshCw,
      },
      // Phone Controller & Pocket Mode
      {
        id: 'host-remote',
        screen: 'phone',
        nameEn: 'Host TV Remote (D-Pad + OK)',
        nameZh: '房主客厅遥控器（方向键 + OK）',
        locationEn: 'First Player’s Phone in Lobby',
        locationZh: '房主手机在大厅阶段自动显示',
        descEn:
          'Turns the host’s phone into a couch TV remote with directional arrows and an orange OK button to browse all 200 games and launch matches.',
        descZh:
          '当房间处于大厅界面时，房主手机会自动切换为大屏遥控器，躺在沙发上就能翻选 200 款游戏并按 OK 开局。',
        tipEn: 'Never walk back to the laptop between rounds again.',
        tipZh: '整晚聚会无需起身走到电脑前操作鼠标。',
        accent: '#FF4D2E',
        icon: Tv,
      },
      {
        id: 'pad-calibration',
        screen: 'phone',
        nameEn: '1·Stick / 2·Arrows / 3·Swipe, Calibration & Turbo',
        nameZh: '摇杆 / 方向键 / 滑动切换、校准与连发',
        locationEn: 'Phone Gamepad Top Bar',
        locationZh: '手机对战手柄顶部控制栏',
        descEn:
          'Switch movement style live mid-match (1·Stick, 2·Arrows, 3·Swipe), tap the sliders icon for size/opacity/haptics calibration, or toggle Turbo.',
        descZh:
          '局内顶部随时秒切 1·摇杆、2·方向键、3·滑动触控，点调节图标自定义按键大小、透明度与震动，还可开关 Turbo 连发。',
        tipEn: 'Every player’s preferences are saved automatically on their own phone.',
        tipZh: '个性化手感会自动保存在各自手机本机，后续每局自动沿用。',
        accent: '#00C2FF',
        icon: Sliders,
      },
      {
        id: 'emoji-reactions',
        screen: 'phone',
        nameEn: 'Live Emoji Reactions',
        nameZh: '实时大屏互动表情',
        locationEn: 'Phone Remote Bottom Bar & Gamepad Top',
        locationZh: '手机遥控底部 / 手柄顶部表情键',
        descEn:
          'Launches animated emoji bursts (🔥 😂 ⚡ 👑 🎉 👏) straight onto the big TV monitor in your player color.',
        descZh:
          '轻点表情图标即可把带有你专属配色的动态表情（🔥 😂 ⚡ 👑 🎉 👏）实时弹射到客厅大屏上。',
        tipEn: 'Spam celebration crowns when you pull off a comeback win!',
        tipZh: '逆风翻盘后狂发皇冠与火焰表情，拉满客厅氛围！',
        accent: '#FFB800',
        icon: Zap,
      },
      {
        id: 'pocket-mode-btn',
        screen: 'phone',
        nameEn: 'Pocket Mode (No Monitor)',
        nameZh: '掌机模式（无需大屏）',
        locationEn: 'Homepage Play Mode / Footer',
        locationZh: '首页立即开玩 / 页脚',
        descEn:
          'Creates a full multiplayer room directly on your smartphone with game browsing, Chaos Wheel, Cup Mode, and live gameplay behind translucent controls.',
        descZh:
          '直接在智能手机上创建完整主机房间，自带游戏浏览、混沌转盘、杯赛以及半透明手柄叠加赛场画面，无需电视或电脑。',
        tipEn: 'Friends can still join your Pocket Mode room on their own phones using your 4-letter PIN.',
        tipZh: '好友依然可以通过你手机顶部的 4 位房间码连入你的掌机房间同玩。',
        accent: '#10D98B',
        icon: Maximize2,
      },
      {
        id: 'in-game-help',
        screen: 'phone',
        nameEn: 'I’m Ready! & Auto-Matched Pad',
        nameZh: '「我准备好了！」与智能适配提示',
        locationEn: 'Pre-Match Phone Rules Screen',
        locationZh: '每局赛前手机端规则页面',
        descEn:
          'Shows the current game’s 4 rules, Button A/B labels, and auto-matched pad type before the countdown starts. Tap I’m Ready! when set.',
        descZh:
          '开赛前在手机同步展示 4 条核心规则、A/B 键技能名称与自动匹配的手柄形态，看完点击大按钮即可准备就绪。',
        tipEn: 'Even first-time guests master any of the 200 games in seconds.',
        tipZh: '就算第一次玩的新朋友，也能在几秒内看懂 200 款游戏任意玩法。',
        accent: '#10D98B',
        icon: HelpCircle,
      },
    ],
    []
  );

  const filteredButtons = useMemo(() => {
    const q = buttonSearch.trim().toLowerCase();
    return buttonDirectory.filter((item) => {
      if (buttonFilter !== 'all' && item.screen !== buttonFilter) return false;
      if (!q) return true;
      const hay = [
        item.nameEn,
        item.nameZh,
        item.locationEn,
        item.locationZh,
        item.descEn,
        item.descZh,
        item.tipEn,
        item.tipZh,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [buttonDirectory, buttonFilter, buttonSearch]);

  const activeChapter = chapters[activeChapterIdx];
  const activeShot = activeChapter.shots[activeShotIdx] || activeChapter.shots[0];

  // Interactive Sandbox Actions
  const handleAddSandboxBot = () => {
    if (sandboxBots.length >= 5) {
      setSandboxLog({
        en: 'Sandbox room is full (You + 5 AI bots = 6 players). In a real room, up to 8 total players can join!',
        zh: '体验房间已满（你 + 5 名 AI = 6 人）。真实房间最多支持 8 名真人与机器人同场！',
      });
      return;
    }
    const usedNames = new Set(sandboxBots.map((b) => b.name));
    const nextPreset =
      BOT_PRESETS.find((p) => !usedNames.has(p.name)) ||
      BOT_PRESETS[sandboxBots.length % BOT_PRESETS.length];
    const nextBot: SandboxBot = {
      id: `bot-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      ...nextPreset,
    };
    setSandboxBots((prev) => [...prev, nextBot]);
    setSandboxLog({
      en: `Added ${nextBot.name}! Real AI bots automatically adapt to all 200 games and stay Always Ready.`,
      zh: `已添加机器人 ${nextBot.name}！真实房间中的 AI 会自动适配全部 200 款游戏并默认就绪。`,
    });
  };

  const handleRemoveSandboxBot = (id: string, name: string) => {
    setSandboxBots((prev) => prev.filter((b) => b.id !== id));
    setSandboxLog({
      en: `Removed ${name}. You can add or remove bots anytime between matches without closing the room.`,
      zh: `已移除 ${name}。在任意回合间隙都可以随时增减机器人，无需重建房间。`,
    });
  };

  const handleDifficultyChange = (level: 'chill' | 'arcade' | 'spicy') => {
    setBotDifficulty(level);
    const notes: Record<'chill' | 'arcade' | 'spicy', { en: string; zh: string }> = {
      chill: {
        en: 'Bot Difficulty set to Chill — relaxed pacing, great for family nights and first-time players.',
        zh: '机器人难度已设为「休闲」— 节奏温和友好，非常适合家庭聚会和新手上手。',
      },
      arcade: {
        en: 'Bot Difficulty set to Arcade — fun medium challenge with balanced reflexes.',
        zh: '机器人难度已设为「街机」— 反应均衡且懂得配合目标，最适合朋友派对。',
      },
      spicy: {
        en: 'Bot Difficulty set to Spicy — fast & sharp rivals for high-intensity showdowns!',
        zh: '机器人难度已设为「高能」— 极限闪避、激进冲刺，带来硬核高手级对抗体验！',
      },
    };
    setSandboxLog(notes[level]);
  };

  const handleTeamModeChange = (mode: 'ffa' | 'teams2' | '1vsAll') => {
    setTeamMode(mode);
    const notes: Record<'ffa' | 'teams2' | '1vsAll', { en: string; zh: string }> = {
      ffa: {
        en: 'Team Mode: Solo FFA — every player fights for themselves on the scoreboard.',
        zh: '组队模式：个人混战 — 每位玩家各自为战，凭实力争夺积分榜第一。',
      },
      teams2: {
        en: 'Team Mode: 2 Teams — players & bots split into RED Squad vs BLUE Squad.',
        zh: '组队模式：2 支战队 — 真人与机器人分为红蓝两队，共享团队得分与胜利。',
      },
      '1vsAll': {
        en: 'Team Mode: 1 vs All — one Solo Boss faces the entire united party squad!',
        zh: '组队模式：1 对多 — 一位大魔王玩家迎战其余所有人的联合围剿！',
      },
    };
    setSandboxLog(notes[mode]);
  };

  const handleSpinChaos = () => {
    if (isSpinningChaos) return;
    setIsSpinningChaos(true);
    let ticks = 0;
    const interval = window.setInterval(() => {
      ticks += 1;
      const randomIdx = Math.floor(Math.random() * CHAOS_MUTATORS.length);
      setChaosIndex(randomIdx);
      if (ticks >= 10) {
        window.clearInterval(interval);
        const finalIdx = Math.floor(Math.random() * CHAOS_MUTATORS.length);
        setChaosIndex(finalIdx);
        setIsSpinningChaos(false);
        const picked = CHAOS_MUTATORS[finalIdx];
        setSandboxLog({
          en: `Chaos Wheel landed on ${picked.nameEn}! ${picked.descEn}`,
          zh: `混沌转盘抽中「${picked.nameZh}」！${picked.descZh}`,
        });
      }
    }, 75);
  };

  useEffect(() => {
    if (!stickKnob.active) return;
    let rafId = 0;
    const step = () => {
      const { dx, dy } = stickVecRef.current;
      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
        setAvatarPos((prev) => ({
          x: Math.max(14, Math.min(86, prev.x + dx * 2.1)),
          y: Math.max(18, Math.min(82, prev.y + dy * 2.1)),
        }));
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [stickKnob.active]);

  const updateStickFromPointer = (clientX: number, clientY: number) => {
    const el = stickBaseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.34;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    const nx = dx / maxR;
    const ny = dy / maxR;
    stickVecRef.current = { dx: nx, dy: ny };
    setStickKnob({ x: dx, y: dy, active: true });
    // Also apply an immediate small nudge so quick taps move visibly
    if (dist > 6) {
      setAvatarPos((prev) => ({
        x: Math.max(14, Math.min(86, prev.x + nx * 3.5)),
        y: Math.max(18, Math.min(82, prev.y + ny * 3.5)),
      }));
    }
  };

  const releaseStick = () => {
    stickVecRef.current = { dx: 0, dy: 0 };
    setStickKnob({ x: 0, y: 0, active: false });
  };

  const nudgeAvatar = (dx: number, dy: number, dirLabelEn: string, dirLabelZh: string) => {
    setAvatarPos((prev) => ({
      x: Math.max(14, Math.min(86, prev.x + dx)),
      y: Math.max(18, Math.min(82, prev.y + dy)),
    }));
    setSandboxLog({
      en: `Moved ${dirLabelEn} using 2·Arrows D-Pad — crisp 4-way steering synced at 30Hz.`,
      zh: `使用 2·方向键向${dirLabelZh}移动 — 清脆四向操控，30Hz 实时同步至大屏。`,
    });
  };

  const triggerPadButton = (btn: 'A' | 'B') => {
    setAvatarBurst(btn);
    window.setTimeout(() => setAvatarBurst(null), 320);
    if (btn === 'A') {
      setSandboxLog({
        en: 'Button A (DASH / Action) pressed! Each game labels A with its signature primary move.',
        zh: '按下了 A 键（DASH 冲刺 / 主技能）！每款游戏都会自动给 A 键标注核心动作名称。',
      });
    } else {
      setSandboxLog({
        en: 'Button B (PULSE / Special) pressed! Use B for shockwaves, boosts, shields, or special moves.',
        zh: '按下了 B 键（PULSE 冲击波 / 特殊技）！用于爆发击飞、加速护盾或专属道具触发。',
      });
    }
  };

  const triggerReaction = (emoji: string) => {
    const id = reactionIdRef.current++;
    const leftPct = 18 + Math.random() * 64;
    setFloatingReactions((prev) => [...prev.slice(-6), { id, emoji, leftPct }]);
    setSandboxLog({
      en: `Sent ${emoji} Live Reaction! In a real room, your reaction floats across the TV in your player color.`,
      zh: `已发送实时表情 ${emoji}！在真实房间中，你的专属表情会带颜色飘过电视大屏。`,
    });
    window.setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1200);
  };

  const sandboxRoster = useMemo(() => {
    const hostEntry = {
      id: 'host-you',
      name: t('You (Host)', '你（房主）'),
      color: '#FF4D2E',
      emoji: '👑',
      isBot: false,
    };
    return [hostEntry, ...sandboxBots.map((b) => ({ ...b, isBot: true }))];
  }, [sandboxBots, t]);

  const getTeamLabel = (idx: number) => {
    if (teamMode === 'ffa') return null;
    if (teamMode === '1vsAll') {
      return idx === 0
        ? { text: t('BOSS', '大魔王'), color: '#FF4D2E' }
        : { text: t('SQUAD', '联合小队'), color: '#00C2FF' };
    }
    return idx % 2 === 0
      ? { text: t('RED', '红队'), color: '#FF4D2E' }
      : { text: t('BLUE', '蓝队'), color: '#00C2FF' };
  };

  const activeChaos = chaosIndex !== null ? CHAOS_MUTATORS[chaosIndex] : null;

  const filterTabs: { id: ButtonScreenCategory; labelEn: string; labelZh: string }[] = [
    { id: 'all', labelEn: 'All Buttons', labelZh: '全部按钮' },
    { id: 'home', labelEn: 'Homepage', labelZh: '首页' },
    { id: 'setup', labelEn: 'Room Setup', labelZh: '房间设置' },
    { id: 'lobby', labelEn: 'Game Lobby', labelZh: '游戏大厅' },
    { id: 'match', labelEn: 'In-Match', labelZh: '对战与结算' },
    { id: 'phone', labelEn: 'Phone & Pocket', labelZh: '手机与掌机' },
  ];

  return (
    <div
      className="min-h-screen w-full max-w-full overflow-x-clip bg-[#0B0E14] text-[#F4F6FA] flex flex-col font-sans"
      style={{ fontFamily: 'system-ui, -apple-system, sans-serif, "PingFang SC", "Microsoft YaHei"' }}
    >
      {/* Clean Single-Row Top Bar */}
      <header className="w-full border-b border-[#1F2633] bg-[#0B0E14]/90 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="h-9 px-3 rounded-xl bg-[#151B26] hover:bg-[#1E2636] border border-[#263042] text-xs font-semibold text-[#D1D5DB] hover:text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('Home', '返回首页')}</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FF4D2E] to-[#00C2FF] flex items-center justify-center text-white shrink-0">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <span className="font-display text-base font-extrabold tracking-tight text-white truncate">
                {t('JoinStick Tutorial', 'JoinStick 使用教程')}
              </span>
            </div>
          </div>

          <nav
            aria-label={t('Tutorial sections', '教程章节导航')}
            className="hidden md:flex items-center gap-6 text-xs font-semibold text-[#9CA3AF]"
          >
            <a
              href="#walkthrough"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t('UI Screenshots', '实机界面指南')}
            </a>
            <a
              href="#sandbox"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t('Interactive Sandbox', '互动按钮体验')}
            </a>
            <a
              href="#buttons"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {t('All Button Functions', '全平台按钮大全')}
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <LanguageToggle compact className="sm:h-9 sm:px-2.5 sm:text-xs" />
            <button
              type="button"
              onClick={() => requestLaunch('host')}
              className="tactile-btn px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 shadow-[0_3px_0_#B82E17] inline-flex items-center gap-1.5 cursor-pointer"
            >
              {!publicAccessOpen && <Lock className="w-3.5 h-3.5 text-white/80" />}
              <span>{t('Host Room', '开启房间')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full">
        {/* Hero Section: Editorial 2-Column Split with Actual Platform UI Screenshot */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-16 sm:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-5 flex flex-col justify-center">
              <div className="text-xs font-semibold tracking-wider uppercase text-[#00C2FF] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>{t('Real Platform UI Guide', '实机界面图文指南')}</span>
                <span aria-hidden="true" className="text-[#3B4659]">·</span>
                <span>{t('6 Interactive Chapters', '6 大操作章节')}</span>
                <span aria-hidden="true" className="text-[#3B4659]">·</span>
                <span>{t(`${buttonDirectory.length} Buttons Explained`, `${buttonDirectory.length} 项按钮详解`)}</span>
              </div>

              <h1 className="mt-4 font-display text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-white text-balance">
                {t(
                  'Master JoinStick Arcade in 2 Minutes.',
                  '2 分钟玩转 JoinStick 街机派对。'
                )}
              </h1>

              <p className="mt-5 text-base sm:text-lg text-[#9CA3AF] leading-relaxed">
                {t(
                  'Explore actual screenshots of every JoinStick Arcade screen—from Room Setup and AI Robots to the 200-Game Lobby, Phone Remote, Gamepad, and Pocket Mode—plus click real buttons live in our sandbox.',
                  '全套真实平台界面高清截图，带你逐一认识创建房间、添加 AI 机器人、200 款游戏大厅、手机遥控器、横屏手柄与掌机模式的每一个按钮，还能在互动体验区亲手试按。'
                )}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="#walkthrough"
                  className="tactile-btn inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-bold text-sm shadow-[0_3px_0_#B82E17] whitespace-nowrap"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{t('View UI Walkthrough', '浏览实机截图教程')}</span>
                </a>
                <a
                  href="#sandbox"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-[#151B26] hover:bg-[#1E2636] border border-[#2A354A] text-white font-semibold text-sm whitespace-nowrap transition-colors"
                >
                  <Gamepad2 className="w-4 h-4 text-[#00C2FF]" />
                  <span>{t('Try Button Sandbox', '亲手体验按钮')}</span>
                </a>
              </div>

              <div className="mt-8 pt-6 border-t border-[#1F2633] grid grid-cols-3 gap-4">
                <div>
                  <div className="font-display text-xl sm:text-2xl font-extrabold text-white tabular-nums">
                    9
                  </div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">
                    {t('Real UI Captures', '实机高清截图')}
                  </div>
                </div>
                <div>
                  <div className="font-display text-xl sm:text-2xl font-extrabold text-[#00C2FF] tabular-nums">
                    1–8P
                  </div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">
                    {t('Phones + AI Bots', '真人或 AI 同场')}
                  </div>
                </div>
                <div>
                  <div className="font-display text-xl sm:text-2xl font-extrabold text-[#10D98B] tabular-nums">
                    200
                  </div>
                  <div className="text-xs text-[#9CA3AF] mt-0.5">
                    {t('Built-In Games', '内置派对游戏')}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col justify-center">
              <ScreenshotFrame
                src={shotGameLobby}
                alt={t(
                  'Actual screenshot of the JoinStick Game Room lobby showing 200 games, Ready Check, 5-Game Cup, Chaos Wheel, and live preview',
                  'JoinStick 游戏大厅真实截图，展示 200 款游戏列表、准备确认、5 局杯赛、混沌转盘与实机演示'
                )}
                caption={t(
                  'Actual Platform UI · JoinStick Game Room Lobby (Click image to zoom full screen)',
                  '实机界面截图 · JoinStick 游戏大厅主画面（点击图片可放大高清查看）'
                )}
                zoomLabel={t('Zoom', '放大查看')}
                onZoom={setLightboxData}
              />
            </div>
          </div>
        </section>

        {/* Section 1: Interactive 6-Chapter Actual UI Screenshot Walkthrough */}
        <section
          id="walkthrough"
          className="border-t border-[#1A2230] bg-[#0F131C]/70 py-16 sm:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#FF4D2E]">
                  {t('Step-by-Step Real UI Walkthrough', '实机界面分步教程')}
                </div>
                <h2 className="mt-2 font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {t(
                    'Every Screen of JoinStick Arcade, Captured Live',
                    '6 大核心界面实拍，照着点就能上手'
                  )}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono text-[#9CA3AF] tabular-nums mr-1">
                  {activeChapter.num} / 0{chapters.length}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setActiveChapterIdx((prev) =>
                      prev === 0 ? chapters.length - 1 : prev - 1
                    )
                  }
                  aria-label={t('Previous chapter', '上一章')}
                  className="h-10 w-10 rounded-xl bg-[#151B26] hover:bg-[#1E2636] border border-[#263042] text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveChapterIdx((prev) => (prev + 1) % chapters.length)
                  }
                  aria-label={t('Next chapter', '下一章')}
                  className="h-10 w-10 rounded-xl bg-[#151B26] hover:bg-[#1E2636] border border-[#263042] text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chapter Selector Strip */}
            <div
              role="tablist"
              aria-label={t('Tutorial chapters', '教程章节选择')}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-8"
            >
              {chapters.map((chap, idx) => {
                const isActive = idx === activeChapterIdx;
                return (
                  <button
                    key={chap.num}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveChapterIdx(idx)}
                    className={`px-3.5 py-3 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[#171E2C] border-[#FF4D2E] text-white shadow-[0_6px_20px_rgba(255,77,46,0.14)]'
                        : 'bg-[#121722] border-[#1F2633] text-[#9CA3AF] hover:text-white hover:border-[#2E394E]'
                    }`}
                  >
                    <div
                      className={`text-[11px] font-mono font-bold tabular-nums ${
                        isActive ? 'text-[#FF4D2E]' : 'text-[#6B7280]'
                      }`}
                    >
                      {chap.num}
                    </div>
                    <div className="text-xs sm:text-sm font-bold mt-0.5 truncate">
                      {lang === 'zh' ? chap.tabZh : chap.tabEn}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Chapter Stage */}
            <div className="rounded-3xl bg-[#141A26] border border-[#222C3F] p-5 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-7 space-y-4">
                  <ScreenshotFrame
                    src={activeShot.src}
                    alt={lang === 'zh' ? activeShot.altZh : activeShot.altEn}
                    caption={lang === 'zh' ? activeShot.captionZh : activeShot.captionEn}
                    zoomLabel={t('Zoom', '放大查看')}
                    onZoom={setLightboxData}
                  />

                  {/* Multi-Screenshot Switcher when a chapter has multiple views */}
                  {activeChapter.shots.length > 1 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-[#9CA3AF] mr-1">
                        {t('Switch Screen:', '切换截图视角：')}
                      </span>
                      {activeChapter.shots.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveShotIdx(idx)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            idx === activeShotIdx
                              ? 'bg-[#00C2FF] text-[#07151F]'
                              : 'bg-[#0D1119] border border-[#243045] text-[#CBD5E1] hover:text-white'
                          }`}
                        >
                          {lang === 'zh' ? s.labelZh : s.labelEn}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t border-[#20293B] flex items-start gap-3">
                    <Sparkles className="w-4 h-4 text-[#FFB800] shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm text-[#D1D5DB] leading-relaxed">
                      <span className="font-bold text-[#FFB800] mr-1.5">
                        {t('Pro Tip:', '实用技巧：')}
                      </span>
                      {lang === 'zh' ? activeChapter.tipZh : activeChapter.tipEn}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-mono font-bold text-[#00C2FF] uppercase tracking-wider">
                      {t(`Chapter ${activeChapter.num}`, `第 ${activeChapter.num} 章`)}
                    </div>
                    <h3 className="mt-1.5 font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-balance">
                      {lang === 'zh' ? activeChapter.titleZh : activeChapter.titleEn}
                    </h3>
                    <p className="mt-2 text-sm text-[#9CA3AF]">
                      {lang === 'zh' ? activeChapter.subtitleZh : activeChapter.subtitleEn}
                    </p>

                    <ol className="mt-6 space-y-5">
                      {activeChapter.steps.map((step, sIdx) => (
                        <li
                          key={sIdx}
                          className="flex items-start gap-3.5 pb-5 border-b border-[#1F2737] last:border-b-0 last:pb-0"
                        >
                          <div className="w-7 h-7 rounded-lg bg-[#0B0E14] border border-[#2A354A] text-xs font-mono font-bold text-[#FF4D2E] flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                            {sIdx + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm sm:text-base font-bold text-white">
                              {lang === 'zh' ? step.labelZh : step.labelEn}
                            </div>
                            <p className="mt-1 text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
                              {lang === 'zh' ? step.detailZh : step.detailEn}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="mt-6 pt-5 border-t border-[#20293B] flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveChapterIdx((prev) =>
                          prev === 0 ? chapters.length - 1 : prev - 1
                        )
                      }
                      className="h-10 px-4 rounded-xl bg-[#1A2232] hover:bg-[#232D42] text-xs font-semibold text-[#D1D5DB] hover:text-white inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>{t('Previous', '上一章')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveChapterIdx((prev) => (prev + 1) % chapters.length)
                      }
                      className="tactile-btn h-10 px-5 rounded-xl bg-[#00C2FF] hover:bg-[#29CEFF] text-[#08131B] text-xs font-extrabold inline-flex items-center gap-1.5 shadow-[0_3px_0_#007FA8] cursor-pointer"
                    >
                      <span>
                        {activeChapterIdx === chapters.length - 1
                          ? t('Back to Chapter 01', '回到第 01 章')
                          : t('Next Chapter', '下一章')}
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Interactive Live Sandbox ("Try Every Core Button Yourself") */}
        <section id="sandbox" className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-3xl mb-10">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#10D98B]">
              {t('Hands-On Interactive Playground', '互动实操体验区')}
            </div>
            <h2 className="mt-2 font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {t(
                'Don’t Just Read — Click & Test Real Room Buttons Live.',
                '光看截图还不够？直接上手点一点真实功能。'
              )}
            </h2>
            <p className="mt-2 text-sm sm:text-base text-[#9CA3AF]">
              {t(
                'Try adding AI robots, toggling teams, spinning the Chaos Wheel, and moving a live character with our simulated phone controller.',
                '试着添加 AI 机器人、切换红蓝战队、转动混沌转盘，或者直接按右侧模拟手机手柄控制角色移动与发送表情。'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Sandbox Panel: Room Setup & Chaos Simulator */}
            <div className="lg:col-span-6 rounded-3xl bg-[#141A26] border border-[#222C3F] p-5 sm:p-6 flex flex-col justify-between gap-6">
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#20293B]">
                  <div>
                    <div className="text-xs font-semibold text-[#00C2FF]">
                      {t('Mini Room Simulator', '模拟大屏房间')}
                    </div>
                    <h3 className="font-display text-lg font-extrabold text-white mt-0.5">
                      {t('Robots, Teams & Chaos Wheel', '机器人、组队与混沌转盘')}
                    </h3>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#9CA3AF]">{t('DEMO PIN', '演示房间码')}</div>
                    <div className="font-mono text-base font-extrabold tracking-[0.2em] text-white">
                      P2KR
                    </div>
                  </div>
                </div>

                {/* Roster Grid */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold text-[#D1D5DB] tabular-nums">
                      {t(
                        `Room Roster (${sandboxRoster.length} / 6 in demo)`,
                        `房间玩家（演示上限 ${sandboxRoster.length} / 6 人）`
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={handleAddSandboxBot}
                      className="tactile-btn h-8 px-3.5 rounded-lg bg-[#00C2FF] hover:bg-[#29CEFF] text-[#07151F] text-xs font-extrabold inline-flex items-center gap-1.5 shadow-[0_2px_0_#007FA8] cursor-pointer whitespace-nowrap"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>{t('+ Add Robot', '+ 添加机器人')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {sandboxRoster.map((member, idx) => {
                      const teamTag = getTeamLabel(idx);
                      return (
                        <div
                          key={member.id}
                          className="p-2.5 rounded-xl bg-[#0D1119] border border-[#20293B] flex items-center justify-between gap-2 min-w-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                              style={{
                                backgroundColor: `${member.color}22`,
                                border: `1px solid ${member.color}66`,
                              }}
                            >
                              {member.emoji}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {member.name}
                              </div>
                              <div className="text-[10px] font-semibold flex items-center gap-1.5">
                                <span className="text-[#9CA3AF]">
                                  {member.isBot ? t('AI Bot', 'AI') : t('Host', '房主')}
                                </span>
                                {teamTag && (
                                  <>
                                    <span className="text-[#3B4659]">·</span>
                                    <span style={{ color: teamTag.color }}>{teamTag.text}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {member.isBot && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSandboxBot(member.id, member.name)}
                              aria-label={t(`Remove ${member.name}`, `移除 ${member.name}`)}
                              className="w-6 h-6 rounded-md hover:bg-[#1E2636] text-[#6B7280] hover:text-[#FF4D2E] flex items-center justify-center shrink-0 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bot Difficulty + Team Mode controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1F2737]">
                  <div>
                    <div className="text-xs font-semibold text-[#9CA3AF] mb-2">
                      {t('Bot Difficulty', '机器人难度')}
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0D1119] border border-[#20293B]">
                      {(
                        [
                          { id: 'chill', en: 'Chill', zh: '休闲' },
                          { id: 'arcade', en: 'Arcade', zh: '街机' },
                          { id: 'spicy', en: 'Spicy', zh: '高能' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleDifficultyChange(opt.id)}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            botDifficulty === opt.id
                              ? 'bg-[#FF4D2E] text-white'
                              : 'text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          {lang === 'zh' ? opt.zh : opt.en}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-[#9CA3AF] mb-2">
                      {t('Team Mode', '组队模式')}
                    </div>
                    <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0D1119] border border-[#20293B]">
                      {(
                        [
                          { id: 'ffa', en: 'Solo FFA', zh: '混战' },
                          { id: 'teams2', en: '2 Teams', zh: '2 队' },
                          { id: '1vsAll', en: '1 vs All', zh: '1 对多' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleTeamModeChange(opt.id)}
                          className={`py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            teamMode === opt.id
                              ? 'bg-[#FFB800] text-[#1A1200]'
                              : 'text-[#9CA3AF] hover:text-white'
                          }`}
                        >
                          {lang === 'zh' ? opt.zh : opt.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Chaos Wheel Interactive Bar */}
              <div className="pt-4 border-t border-[#20293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#9CA3AF]">
                    {t('Chaos Wheel Mutator', '混沌转盘当前词条')}
                  </div>
                  <div
                    className="text-sm font-extrabold mt-0.5 truncate"
                    style={{ color: activeChaos ? activeChaos.color : '#FFFFFF' }}
                  >
                    {activeChaos
                      ? lang === 'zh'
                        ? activeChaos.nameZh
                        : activeChaos.nameEn
                      : t('Classic Rules (Spin to randomize!)', '经典规则（点击右侧转盘抽取词条）')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSpinChaos}
                  disabled={isSpinningChaos}
                  className="tactile-btn h-10 px-4 rounded-xl bg-[#FFB800] hover:bg-[#FFC733] disabled:opacity-70 text-[#1A1200] text-xs font-extrabold inline-flex items-center justify-center gap-2 shadow-[0_3px_0_#B37D00] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Sparkles className={`w-4 h-4 ${isSpinningChaos ? 'animate-spin' : ''}`} />
                  <span>
                    {isSpinningChaos
                      ? t('Spinning...', '抽取中...')
                      : t('Spin Chaos Wheel', '转动混沌转盘')}
                  </span>
                </button>
              </div>
            </div>

            {/* Right Sandbox Panel: Interactive Phone Controller & Live Arena Preview */}
            <div className="lg:col-span-6 rounded-3xl bg-[#141A26] border border-[#222C3F] p-5 sm:p-6 flex flex-col justify-between gap-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#20293B]">
                <div>
                  <div className="text-xs font-semibold text-[#FF4D2E]">
                    {t('Mini Phone Controller', '模拟手机手柄')}
                  </div>
                  <h3 className="font-display text-lg font-extrabold text-white mt-0.5">
                    {t('Test Controls & Live Reactions', '测试按键布局与大屏表情')}
                  </h3>
                </div>

                {/* Layout Calibration Toggle */}
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0D1119] border border-[#20293B]">
                  {(
                    [
                      { id: 'joystick', en: '1·Stick', zh: '1·摇杆' },
                      { id: 'arrows', en: '2·Arrows', zh: '2·方向键' },
                      { id: 'swipe', en: '3·Swipe', zh: '3·滑动' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => {
                        setPadStyle(mode.id);
                        setSandboxLog({
                          en: `Switched controller layout to ${mode.en}. Every player can pick their own style right on their phone top bar.`,
                          zh: `已将手机手柄切换为「${mode.zh}」模式。每位玩家都能在手机顶部随时独立切换。`,
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                        padStyle === mode.id
                          ? 'bg-[#FF4D2E] text-white'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {lang === 'zh' ? mode.zh : mode.en}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mini Arena Screen */}
              <div className="relative h-40 sm:h-44 rounded-2xl bg-[#090D14] border border-[#20293B] overflow-hidden select-none">
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, #23304A 1px, transparent 1px), linear-gradient(to bottom, #23304A 1px, transparent 1px)',
                    backgroundSize: '28px 28px',
                  }}
                />
                <div className="absolute top-2.5 left-3 text-[11px] font-mono text-[#6B7280]">
                  {t('LIVE TV ARENA PREVIEW', '模拟大屏赛场画面')}
                </div>
                {activeChaos && (
                  <div
                    className="absolute top-2.5 right-3 text-[11px] font-mono font-bold"
                    style={{ color: activeChaos.color }}
                  >
                    {lang === 'zh' ? activeChaos.nameZh : activeChaos.nameEn}
                  </div>
                )}

                {/* Player Avatar */}
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-150 ease-out"
                  style={{ left: `${avatarPos.x}%`, top: `${avatarPos.y}%` }}
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold shadow-[0_0_24px_rgba(255,77,46,0.45)] border-2 transition-transform ${
                      avatarBurst === 'A'
                        ? 'scale-125 border-[#FFB800] bg-[#FF4D2E]'
                        : avatarBurst === 'B'
                        ? 'scale-110 border-[#FFB800] bg-[#FFB800]'
                        : 'scale-100 border-white bg-[#FF4D2E]'
                    }`}
                  >
                    {avatarBurst === 'A' ? '⚡' : avatarBurst === 'B' ? '💥' : '👑'}
                  </div>
                </div>

                {/* Floating Reactions */}
                {floatingReactions.map((r) => (
                  <div
                    key={r.id}
                    className="absolute bottom-3 text-2xl pointer-events-none animate-bounce"
                    style={{ left: `${r.leftPct}%` }}
                  >
                    {r.emoji}
                  </div>
                ))}
              </div>

              {/* Interactive Touch Pad Controls */}
              <div className="grid grid-cols-2 gap-4 items-center min-h-[150px]">
                {/* Left: Active Movement Pad (switches cleanly between 1·Stick, 2·Arrows, 3·Swipe) */}
                <div className="flex flex-col items-center justify-center gap-2">
                  {padStyle === 'joystick' && (
                    <>
                      <div
                        ref={stickBaseRef}
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          updateStickFromPointer(e.clientX, e.clientY);
                          setSandboxLog({
                            en: 'Dragging 1·Stick (360° Pro Stick) — smooth analog movement synced at 30Hz to the TV.',
                            zh: '正在拖动 1·摇杆（360° 虚拟摇杆）— 全向丝滑走位，30Hz 实时同步到大屏。',
                          });
                        }}
                        onPointerMove={(e) => {
                          if (!stickKnob.active) return;
                          updateStickFromPointer(e.clientX, e.clientY);
                        }}
                        onPointerUp={releaseStick}
                        onPointerCancel={releaseStick}
                        role="slider"
                        aria-label={t('Interactive 360 degree virtual joystick', '互动 360 度虚拟摇杆')}
                        aria-valuetext={stickKnob.active ? 'active' : 'centered'}
                        className="relative w-32 h-32 rounded-full bg-[#0C1018] border-2 border-[#2A364E] flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing shadow-inner"
                      >
                        {/* Subtle crosshair + inner ring matching real Phone Gamepad */}
                        <div className="absolute inset-3 rounded-full border border-dashed border-[#243045] pointer-events-none" />
                        <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-[#1D2738] pointer-events-none" />
                        <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-[#1D2738] pointer-events-none" />
                        {/* Tactile Red Joystick Knob */}
                        <div
                          className={`w-12 h-12 rounded-full bg-[#FF4D2E] border-2 border-[#FF856E] shadow-[0_4px_14px_rgba(255,77,46,0.5)] flex items-center justify-center pointer-events-none ${
                            stickKnob.active ? '' : 'transition-transform duration-150 ease-out'
                          }`}
                          style={{
                            transform: `translate(${stickKnob.x}px, ${stickKnob.y}px)`,
                          }}
                        >
                          <div className="w-5 h-5 rounded-full bg-[#D93B20] border border-white/25" />
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-[#9CA3AF]">
                        {t('Drag 360° Stick', '拖动 360° 摇杆')}
                      </span>
                    </>
                  )}

                  {padStyle === 'arrows' && (
                    <>
                      <div className="grid grid-cols-3 gap-1.5 w-32">
                        <div />
                        <button
                          type="button"
                          onClick={() => nudgeAvatar(0, -16, 'Up', '上')}
                          aria-label={t('Move Up', '向上移动')}
                          className="h-10 rounded-xl bg-[#1A2232] hover:bg-[#26324A] active:bg-[#00C2FF] active:text-[#07151F] active:scale-95 border border-[#2C374F] text-white flex items-center justify-center cursor-pointer transition-all"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => nudgeAvatar(-16, 0, 'Left', '左')}
                          aria-label={t('Move Left', '向左移动')}
                          className="h-10 rounded-xl bg-[#1A2232] hover:bg-[#26324A] active:bg-[#00C2FF] active:text-[#07151F] active:scale-95 border border-[#2C374F] text-white flex items-center justify-center cursor-pointer transition-all"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div className="h-10 rounded-xl bg-[#0D1119] border border-[#20293B] flex items-center justify-center text-xs font-mono text-[#00C2FF]">
                          +
                        </div>
                        <button
                          type="button"
                          onClick={() => nudgeAvatar(16, 0, 'Right', '右')}
                          aria-label={t('Move Right', '向右移动')}
                          className="h-10 rounded-xl bg-[#1A2232] hover:bg-[#26324A] active:bg-[#00C2FF] active:text-[#07151F] active:scale-95 border border-[#2C374F] text-white flex items-center justify-center cursor-pointer transition-all"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => nudgeAvatar(0, 16, 'Down', '下')}
                          aria-label={t('Move Down', '向下移动')}
                          className="h-10 rounded-xl bg-[#1A2232] hover:bg-[#26324A] active:bg-[#00C2FF] active:text-[#07151F] active:scale-95 border border-[#2C374F] text-white flex items-center justify-center cursor-pointer transition-all"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <div />
                      </div>
                      <span className="text-[11px] font-medium text-[#9CA3AF]">
                        {t('Tap Easy Arrows', '点击四向方向键')}
                      </span>
                    </>
                  )}

                  {padStyle === 'swipe' && (
                    <>
                      <div
                        onPointerDown={(e) => {
                          e.currentTarget.setPointerCapture(e.pointerId);
                          const rect = e.currentTarget.getBoundingClientRect();
                          const px = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
                          const py = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
                          swipeLastRef.current = { x: e.clientX, y: e.clientY };
                          setSwipeCursor({ x: px, y: py, active: true });
                          // Quick tap also nudges toward tapped side
                          const relX = (px - 50) / 50;
                          const relY = (py - 50) / 50;
                          setAvatarPos((prev) => ({
                            x: Math.max(14, Math.min(86, prev.x + relX * 8)),
                            y: Math.max(18, Math.min(82, prev.y + relY * 8)),
                          }));
                          setSandboxLog({
                            en: 'Gliding on 3·Swipe Trackpad — slide your thumb in any direction for effortless one-hand control.',
                            zh: '正在使用 3·滑动触控板 — 单指任意方向滑动即可流畅控制角色走位。',
                          });
                        }}
                        onPointerMove={(e) => {
                          if (!swipeLastRef.current) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const dx = e.clientX - swipeLastRef.current.x;
                          const dy = e.clientY - swipeLastRef.current.y;
                          swipeLastRef.current = { x: e.clientX, y: e.clientY };
                          const px = Math.max(8, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
                          const py = Math.max(8, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
                          setSwipeCursor({ x: px, y: py, active: true });
                          setAvatarPos((prev) => ({
                            x: Math.max(14, Math.min(86, prev.x + dx * 0.55)),
                            y: Math.max(18, Math.min(82, prev.y + dy * 0.55)),
                          }));
                        }}
                        onPointerUp={() => {
                          swipeLastRef.current = null;
                          setSwipeCursor((prev) => ({ ...prev, active: false }));
                        }}
                        onPointerCancel={() => {
                          swipeLastRef.current = null;
                          setSwipeCursor((prev) => ({ ...prev, active: false }));
                        }}
                        className="relative w-36 h-32 rounded-2xl bg-[#0C1018] border-2 border-[#00C2FF]/45 overflow-hidden touch-none select-none cursor-crosshair shadow-inner"
                      >
                        <div
                          className="absolute inset-0 opacity-25 pointer-events-none"
                          style={{
                            backgroundImage: 'radial-gradient(#00C2FF 1px, transparent 1px)',
                            backgroundSize: '14px 14px',
                          }}
                        />
                        <ArrowUp className="w-3.5 h-3.5 text-[#00C2FF]/45 absolute top-1.5 left-1/2 -translate-x-1/2 pointer-events-none" />
                        <ArrowDown className="w-3.5 h-3.5 text-[#00C2FF]/45 absolute bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none" />
                        <ArrowLeft className="w-3.5 h-3.5 text-[#00C2FF]/45 absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <ArrowRight className="w-3.5 h-3.5 text-[#00C2FF]/45 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />

                        <div
                          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none transition-all duration-75 ${
                            swipeCursor.active
                              ? 'w-7 h-7 bg-[#00C2FF]/35 border-2 border-[#00C2FF] shadow-[0_0_14px_rgba(0,194,255,0.65)]'
                              : 'w-4 h-4 bg-[#00C2FF]/30 border border-[#00C2FF]/60'
                          }`}
                          style={{ left: `${swipeCursor.x}%`, top: `${swipeCursor.y}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-[#00C2FF]">
                        {t('Slide Trackpad', '在触控区滑动控制')}
                      </span>
                    </>
                  )}
                </div>

                {/* Right: DASH (A) & PULSE (B) Action Buttons matching actual phone UI */}
                <div className="flex items-center justify-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => triggerPadButton('B')}
                    className="tactile-btn w-15 h-15 rounded-full bg-[#FFB800] hover:bg-[#FFC733] text-[#1A1200] font-display font-extrabold text-xs shadow-[0_4px_0_#B37D00] active:translate-y-0.5 cursor-pointer flex flex-col items-center justify-center leading-tight"
                  >
                    <span>PULSE</span>
                    <span className="text-[10px] opacity-80">B</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerPadButton('A')}
                    className="tactile-btn w-16 h-16 rounded-full bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-extrabold text-xs shadow-[0_4px_0_#B82E17] active:translate-y-0.5 cursor-pointer flex flex-col items-center justify-center leading-tight"
                  >
                    <span>DASH</span>
                    <span className="text-[10px] opacity-85">A</span>
                  </button>
                </div>
              </div>

              {/* Live Emoji Reaction Strip */}
              <div className="pt-3 border-t border-[#20293B] flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#9CA3AF]">
                  {t('Send TV Reaction:', '发送大屏表情：')}
                </span>
                <div className="flex items-center gap-1.5">
                  {['🔥', '😂', '⚡', '👑', '🎉', '👏'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => triggerReaction(emoji)}
                      className="w-9 h-9 rounded-xl bg-[#0D1119] hover:bg-[#1D2638] border border-[#222B3B] text-base flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Live Contextual Action Feedback Bar */}
          <div className="mt-4 rounded-2xl bg-[#111622] border border-[#222C3F] px-5 py-4 flex items-start sm:items-center gap-3">
            <Zap className="w-4 h-4 text-[#00C2FF] shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-xs sm:text-sm text-[#E5E7EB] leading-relaxed">
              <span className="font-bold text-[#00C2FF] mr-2">
                {t('What That Button Does:', '功能说明：')}
              </span>
              {lang === 'zh' ? sandboxLog.zh : sandboxLog.en}
            </p>
          </div>
        </section>

        {/* Section 3: Complete Platform Button Directory */}
        <section
          id="buttons"
          className="border-t border-[#1A2230] bg-[#0F131C]/70 py-16 sm:py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-[#00C2FF]">
                  {t('Complete Button Reference', '全平台按钮功能手册')}
                </div>
                <h2 className="mt-2 font-display text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {t(
                    'Every Button Across JoinStick Arcade, Explained',
                    '每一个按钮的作用，在这里都能一键查到'
                  )}
                </h2>
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={buttonSearch}
                  onChange={(e) => setButtonSearch(e.target.value)}
                  placeholder={t('Search buttons (e.g. Robot, Cup)...', '搜索按钮（如：机器人、杯赛）...')}
                  aria-label={t('Search platform buttons', '搜索平台按钮')}
                  className="w-full h-10 pl-10 pr-8 rounded-xl bg-[#141A26] border border-[#263042] focus:border-[#00C2FF] focus:outline-none text-xs sm:text-sm text-white placeholder:text-[#6B7280]"
                />
                {buttonSearch && (
                  <button
                    type="button"
                    onClick={() => setButtonSearch('')}
                    aria-label={t('Clear search', '清除搜索')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Screen Filter Tabs */}
            <div
              role="tablist"
              aria-label={t('Filter buttons by screen', '按界面筛选按钮')}
              className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[#141A26] border border-[#222C3F] mb-8 w-fit max-w-full"
            >
              {filterTabs.map((tab) => {
                const active = buttonFilter === tab.id;
                const count =
                  tab.id === 'all'
                    ? buttonDirectory.length
                    : buttonDirectory.filter((b) => b.screen === tab.id).length;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setButtonFilter(tab.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#FF4D2E] text-white'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {lang === 'zh' ? tab.labelZh : tab.labelEn}{' '}
                    <span className="font-mono opacity-80 tabular-nums">({count})</span>
                  </button>
                );
              })}
            </div>

            {filteredButtons.length === 0 ? (
              <div className="rounded-2xl bg-[#141A26] border border-[#222C3F] p-10 text-center">
                <p className="text-sm font-bold text-white">
                  {t('No matching buttons found.', '没有找到匹配的按钮说明。')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setButtonSearch('');
                    setButtonFilter('all');
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white text-xs font-bold cursor-pointer"
                >
                  {t('Show All Buttons', '显示全部按钮')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredButtons.map((item) => {
                  const IconComp = item.icon;
                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl bg-[#141A26] border border-[#222C3F] p-5 flex items-start gap-4 hover:border-[#32405A] transition-colors"
                    >
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: `${item.accent}1A`,
                          border: `1px solid ${item.accent}4D`,
                          color: item.accent,
                        }}
                      >
                        <IconComp className="w-5 h-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold text-[#9CA3AF] flex flex-wrap items-center gap-x-2">
                          <span style={{ color: item.accent }}>
                            {lang === 'zh' ? item.locationZh : item.locationEn}
                          </span>
                        </div>
                        <h3 className="font-display text-base sm:text-lg font-extrabold text-white mt-0.5">
                          {lang === 'zh' ? item.nameZh : item.nameEn}
                        </h3>
                        <p className="mt-1.5 text-xs sm:text-sm text-[#D1D5DB] leading-relaxed">
                          {lang === 'zh' ? item.descZh : item.descEn}
                        </p>
                        <div className="mt-3 pt-2.5 border-t border-[#1F2737] text-xs text-[#9CA3AF]">
                          <span className="font-semibold text-[#00C2FF] mr-1.5">
                            {t('Tip:', '小提示：')}
                          </span>
                          {lang === 'zh' ? item.tipZh : item.tipEn}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Final Launch CTA Banner */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
          <div className="rounded-3xl bg-[#141A26] border border-[#263247] p-8 sm:p-12 text-center">
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-white">
              {t('Ready to launch your first match?', '已经全学会了？立刻开启你的第一场派对！')}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#9CA3AF] max-w-xl mx-auto">
              {t(
                'Open a big-screen room, try Pocket Mode on your phone, or connect to a friend’s room right now.',
                '开启电视或电脑大屏房间、随时启动手机掌机模式，或直接输入房间码加入好友的对局。'
              )}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => requestLaunch('host')}
                className="tactile-btn inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-bold text-sm sm:text-base shadow-[0_4px_0_#B82E17] cursor-pointer"
              >
                {!publicAccessOpen && <Lock className="w-4 h-4" />}
                <span>{t('Create Game Room', '创建大屏房间')}</span>
              </button>
              <button
                type="button"
                onClick={() => requestLaunch('pocket')}
                className="tactile-btn inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#071A12] font-display font-extrabold text-sm sm:text-base shadow-[0_4px_0_#0A915D] cursor-pointer"
              >
                {!publicAccessOpen && <Lock className="w-4 h-4" />}
                <Gamepad2 className="w-4 h-4" />
                <span>{t('Pocket Mode', '掌机模式')}</span>
              </button>
              <button
                type="button"
                onClick={() => onJoinController()}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#1B2333] hover:bg-[#242F44] border border-[#2E3B54] text-white font-semibold text-sm sm:text-base cursor-pointer transition-colors"
              >
                <Smartphone className="w-4 h-4 text-[#00C2FF]" />
                <span>{t('Join with Phone', '手机加入游戏')}</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#1A2230] py-7">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#9CA3AF]">
          <div className="flex items-center gap-2.5">
            <span>{t('JoinStick Arcade · Interactive Tutorial', 'JoinStick 街机派对 · 全平台互动教程')}</span>
            <span className="text-[#3B4659]">·</span>
            <span className="text-[#CBD5E1] font-medium">
              {t('Created by Lucas Lim', '由 Lucas Lim 打造')}
            </span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-[#00C2FF] hover:text-white font-semibold cursor-pointer transition-colors"
          >
            {t('← Back to Homepage', '← 返回首页')}
          </button>
        </div>
      </footer>

      {/* Fullscreen Screenshot Lightbox */}
      {lightboxData && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxData(null)}
          className="fixed inset-0 z-50 bg-[#05070B]/92 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-6xl w-full rounded-2xl bg-[#0F141E] border border-[#2B374F] overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-[#1F293B] flex items-center justify-between gap-3">
              <span className="text-xs sm:text-sm font-semibold text-[#E5E7EB] truncate">
                {lightboxData.caption}
              </span>
              <button
                type="button"
                onClick={() => setLightboxData(null)}
                aria-label={t('Close preview', '关闭大图预览')}
                className="h-8 w-8 rounded-lg bg-[#1A2232] hover:bg-[#26324A] text-[#CBD5E1] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-[#090C12] flex items-center justify-center max-h-[82vh] overflow-hidden">
              <img
                src={lightboxData.src}
                alt={lightboxData.alt}
                referrerPolicy="no-referrer"
                className="max-h-[82vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}

      <HostUnlockModal
        open={showPinModal}
        target={pendingTarget}
        onClose={() => setShowPinModal(false)}
        onUnlocked={handleUnlocked}
      />
    </div>
  );
}
