import {
  BOARD_GAME_IDS,
  CARD_GAME_IDS,
  GAME_CATALOG,
  getGameGenre,
  getGameMeta,
  HERITAGE_GAME_IDS,
} from '../shared/games';
import { getPadTutorialGuide } from '../shared/padProfiles';
import type { GameId, GameMetadata } from '../shared/types';
import { getLocalizedGameMeta, type Language } from './i18n';

export interface RuleBotSuggestedGame {
  id: GameId;
  name: string;
  genreLabel: string;
  playerModeLabel: string;
  accentHex: string;
}

export interface RuleBotMetaBadge {
  label: string;
  colorHex?: string;
}

export interface RuleBotChoice {
  id: string;
  label: string;
  sublabel?: string;
  accentHex?: string;
  action: 'menu' | 'category' | 'topic' | 'open-picker' | 'prompt';
  value: string;
}

export interface RuleBotReply {
  title?: string;
  text: string;
  bullets?: string[];
  metaBadges?: RuleBotMetaBadge[];
  resolvedGameId?: GameId | null;
  suggestedGames?: RuleBotSuggestedGame[];
  choices?: RuleBotChoice[];
  quickPrompts: string[];
}

interface GuideTopicEntry {
  id: string;
  category: GuideCategoryId;
  keywords: string[];
  labelEn: string;
  labelZh: string;
  subEn: string;
  subZh: string;
  titleEn: string;
  titleZh: string;
  textEn: string;
  textZh: string;
  bulletsEn: string[];
  bulletsZh: string[];
  nextTopicIds?: string[];
}

type GuideCategoryId =
  | 'getting-started'
  | 'game-rules'
  | 'controls'
  | 'party-features'
  | 'hosting-lobby'
  | 'troubleshooting';

interface GuideCategoryMeta {
  id: GuideCategoryId;
  labelEn: string;
  labelZh: string;
  subEn: string;
  subZh: string;
  accentHex: string;
  introEn: string;
  introZh: string;
}

const GUIDE_CATEGORIES: GuideCategoryMeta[] = [
  {
    id: 'getting-started',
    labelEn: 'Getting Started & Modes',
    labelZh: '新手入门与游玩模式',
    subEn: 'TV Host, Pocket, Join & Solo',
    subZh: '大屏模式、口袋模式、加入与单人',
    accentHex: '#00C2FF',
    introEn: 'Here are the quickest guides to starting or joining a session. Pick a topic below:',
    introZh: '这里是最快上手的平台开玩指南，请选择你想了解的主题：',
  },
  {
    id: 'game-rules',
    labelEn: 'Game Rules & Finder',
    labelZh: '游戏规则与找游戏',
    subEn: 'Browse & learn all 200 games',
    subZh: '搜索并学习全部 200 款游戏',
    accentHex: '#FFB800',
    introEn: 'Pick a game directly from our 200-game catalog, browse by genre or player count, or type any game name below!',
    introZh: '你可以直接从 200 款游戏中搜索选择、按类型或人数筛选，或直接输入游戏名称提问！',
  },
  {
    id: 'controls',
    labelEn: 'Controls & Phone Pads',
    labelZh: '手柄操作与卡牌手势',
    subEn: '4 Pads, Cards, Setup & Keys',
    subZh: '4种手柄、卡牌手势、自定义与键盘',
    accentHex: '#10D98B',
    introEn: 'Learn how each phone controller pad works and how to customize it for comfort:',
    introZh: '了解不同手机手柄的操作方式，以及如何自定义最顺手的布局：',
  },
  {
    id: 'party-features',
    labelEn: 'Party Modes & Features',
    labelZh: '特色玩法与派对功能',
    subEn: 'Cup, Chaos Wheel, Frenzy, Bots',
    subZh: '五局杯赛、混沌轮盘、狂热、机器人',
    accentHex: '#A855F7',
    introEn: 'Discover the special party modes and twists built into the platform:',
    introZh: '探索平台内置的派对特色模式与趣味机制：',
  },
  {
    id: 'hosting-lobby',
    labelEn: 'Hosting & Lobby Guide',
    labelZh: '建房邀请与大厅设置',
    subEn: 'QR Invite, Ready, Settings, Lang',
    subZh: '二维码邀请、准备开局、局数与语言',
    accentHex: '#F97316',
    introEn: 'Everything you need to run a smooth room as Host or player:',
    introZh: '房主与玩家管理房间、邀请好友与调整设置的实用指南：',
  },
  {
    id: 'troubleshooting',
    labelEn: 'Quick Fixes & Help',
    labelZh: '常见问题与故障排查',
    subEn: 'Sound, Reconnect, Inverted, Fit',
    subZh: '没声音、断线重连、反向操作、适配',
    accentHex: '#FF4D2E',
    introEn: 'Running into a snag? Pick what happened for an instant fix:',
    introZh: '遇到小问题了？选择下面的情况查看秒解方法：',
  },
];

const GUIDE_TOPICS: GuideTopicEntry[] = [
  // ---- 1. GETTING STARTED & MODES ----
  {
    id: 'tv-host-mode',
    category: 'getting-started',
    keywords: ['tv mode', 'host mode', 'big screen', 'laptop', 'dual screen', 'monitor', '大屏', '电视', '主持模式', '投屏'],
    labelEn: 'TV Host Mode Step-by-Step',
    labelZh: '大屏主持模式教程',
    subEn: 'Laptop / TV + phone remotes',
    subZh: '电脑电视当主屏 + 手机当手柄',
    titleEn: 'TV / Big-Screen Host Mode',
    titleZh: '大屏 / 电视主持模式',
    textEn:
      'TV Host Mode turns a laptop, tablet, or TV into the shared main arena while 1–8 friends use their phones as private wireless controllers.',
    textZh:
      '大屏主持模式会把电脑、平板或电视变成共享主屏幕，1–8 位好友用各自手机扫码即可变成无线手柄或私密手牌器。',
    bulletsEn: [
      'Tap "Host Arena" on your big screen (laptop/TV) to create a live room with a 4-letter Room Code and QR code.',
      'Friends scan the QR code or tap "Join Room" on their phone and enter the 4-letter code—no account or download needed.',
      'Use the Host Remote or mouse to pick from 200 games, adjust rounds/bots, and start once everyone taps Ready.',
      'In card games, the shared table stays on the TV while your private hand appears only on your phone!',
    ],
    bulletsZh: [
      '在电脑或电视上点击“大屏主持”，系统会自动生成 4 位房间码与二维码。',
      '好友用手机扫码或在首页点击“加入房间”输入房间码，无需注册或下载 App。',
      '在大厅从 200 款游戏中挑选项目、调整回合或添加机器人，所有人点“准备”后即可开局。',
      '玩卡牌游戏时，大屏显示公共牌桌，个人底牌仅显示在各自手机上，不怕偷看！',
    ],
    nextTopicIds: ['pocket-mode', 'tv-vs-pocket', 'join-room'],
  },
  {
    id: 'pocket-mode',
    category: 'getting-started',
    keywords: ['pocket', 'pocket mode', 'phone only', 'no tv', 'single device', '口袋', '口袋模式', '手机玩', '无电视'],
    labelEn: 'Pocket Mode Step-by-Step',
    labelZh: '口袋模式教程',
    subEn: 'Play phone-only without a TV',
    subZh: '不用电视，人人手机直接玩',
    titleEn: 'Pocket Mode (Phone-Only Play)',
    titleZh: '口袋模式（纯手机游玩）',
    textEn:
      'Pocket Mode lets everyone play directly on their own phone—no TV or laptop needed! Every player sees the live game arena or card table right above or behind their touch controls.',
    textZh:
      '口袋模式让每位玩家直接用手机游玩，完全不需要电视或电脑大屏！实时竞技画面和牌桌会直接同步显示在你手机上。',
    bulletsEn: [
      'Tap "Pocket Mode" on the home screen to open a phone-hosted room instantly.',
      'Share the room invite link, QR code, or 4-letter code from the top bar so friends can join on their own phones.',
      'Pick any of the 200 games, add AI Bots if you want extra players, tap Ready, and hit Start!',
      'During card games, all solid-color cards stay visible without scrolling, with your compact status chip on the left and Draw/Action buttons on the bottom-right.',
    ],
    bulletsZh: [
      '在首页点击“口袋模式”，立刻开启由手机主持的便携房间。',
      '点击顶部二维码或分享按钮，把 4 位房间码或链接发给好友加入。',
      '自由挑选全部 200 款游戏、可随时添加机器人补位，点“准备”后由房主点击“开始”！',
      '玩卡牌时，全部实色手牌完整展示免滑动，左下角显示迷你个人状态条，右下角固定摸牌与出牌键。',
    ],
    nextTopicIds: ['tv-vs-pocket', 'card-pad-guide', 'solo-bots'],
  },
  {
    id: 'tv-vs-pocket',
    category: 'getting-started',
    keywords: ['compare', 'difference', 'which mode', 'vs', '区别', '选哪个', '对比'],
    labelEn: 'TV Mode vs. Pocket Mode',
    labelZh: '大屏模式 vs 口袋模式',
    subEn: 'Which one should we pick?',
    subZh: '什么时候选哪种模式？',
    titleEn: 'TV Host Mode vs. Pocket Mode',
    titleZh: '大屏模式 vs 口袋模式对比',
    textEn: 'Both modes support all 200 games and 1–8 players—just pick the one that fits where you are hanging out:',
    textZh: '两种模式都完整支持全部 200 款游戏与 1–8 人联机，按当下聚会场景选择即可：',
    bulletsEn: [
      'Pick TV Host Mode when everyone is gathered in a living room or classroom around a shared TV, projector, or laptop—phones stay clean as dedicated controllers.',
      'Pick Pocket Mode when you are at a café, traveling, or playing remotely with no shared TV—each phone displays both the live game and controls together.',
      'Pro tip: you can even practice solo in Pocket Mode with AI Bots anywhere!',
    ],
    bulletsZh: [
      '客厅聚会、教室或有电脑/电视大屏时选【大屏主持模式】：大家一起看大屏，手机专注当手柄或私密看底牌。',
      '咖啡厅、外出途中或异地联机没有大屏时选【口袋模式】：每台手机同时显示实时战况与操作区。',
      '小技巧：一个人随时也能开口袋模式加机器人练手！',
    ],
    nextTopicIds: ['pocket-mode', 'tv-host-mode', 'join-room'],
  },
  {
    id: 'join-room',
    category: 'getting-started',
    keywords: ['join', 'qr', 'room code', 'code', 'connect', '加入', '房间码', '扫码', '联机'],
    labelEn: 'How to Join a Friend’s Room',
    labelZh: '如何加入好友房间',
    subEn: 'QR scan or 4-letter code',
    subZh: '扫码或输入 4 位房间码',
    titleEn: 'How to Join a Room in 5 Seconds',
    titleZh: '5 秒快速加入房间',
    textEn: 'No sign-up or app download required—friends join straight in their mobile browser:',
    textZh: '无需注册账号或下载安装，浏览器打开即连：',
    bulletsEn: [
      'Method 1 (Fastest): Point your phone camera at the host’s QR code—it auto-fills the room code for you.',
      'Method 2: Open the app, tap "Join Room", and type the 4-letter Room Code shown in the lobby.',
      'Choose your nickname, color, and avatar, then tap "Join" and hit "Ready" in the lobby!',
    ],
    bulletsZh: [
      '方式一（最快）：直接用手机相机扫描房主屏幕上的二维码，自动填入房间码。',
      '方式二：打开首页点击“加入房间”，输入大厅显示的 4 位字母数字房间码。',
      '挑选你的昵称、专属颜色和头像，进入大厅后点击“准备”即可等待开局！',
    ],
    nextTopicIds: ['invite-friends', 'ready-start', 'fix-reconnect'],
  },
  {
    id: 'solo-bots',
    category: 'getting-started',
    keywords: ['solo', 'single player', 'bot', 'bots', 'ai player', 'practice', '单人', '一个人', '机器人', '人机'],
    labelEn: 'How to Play Solo with Bots',
    labelZh: '单人游玩与添加机器人',
    subEn: 'Play alone or fill empty seats',
    subZh: '一个人也能玩满人派对局',
    titleEn: 'Playing Solo & Adding AI Bots',
    titleZh: '单人游玩与添加 AI 机器人',
    textEn: 'You never need a full group to enjoy the platform—play 1P games or fill seats with smart AI Bots!',
    textZh: '一个人随时也能畅玩！直接挑单人游戏，或在大厅一键加满智能机器人陪玩。',
    bulletsEn: [
      'Filter by "Solo (1P)" in the game browser to find games built for single-player high-score runs.',
      'For multiplayer arcade, board, or card games, tap "Add Bot" in the Host or Pocket lobby to add up to 7 AI rivals.',
      'Tap the Bot Difficulty badge in the lobby to switch between Chill, Arcade, and Spicy AI.',
      'You can remove bots anytime before starting when real friends arrive.',
    ],
    bulletsZh: [
      '在游戏列表中筛选“单人 (1P)”即可找到适合独自冲分的小游戏。',
      '想玩多人卡牌、棋盘或乱斗游戏时，在大厅点击“添加机器人”即可补满对手。',
      '点击大厅里的机器人难度按钮，可在【轻松 / 街机 / 狂暴】三档 AI 间切换。',
      '好友加入后，随时可以点击移除机器人腾出位置。',
    ],
    nextTopicIds: ['teams-bots', 'pocket-mode'],
  },

  // ---- 3. CONTROLS & PHONE PADS ----
  {
    id: 'four-pads',
    category: 'controls',
    keywords: ['4 pad', 'four pad', 'pad type', 'analog', 'arrows', 'trackpad', 'joystick', '手柄', '四种手柄', '摇杆', '方向键', '触控板'],
    labelEn: 'The 4 Phone Pads Explained',
    labelZh: '4 种手机手柄详解',
    subEn: 'Analog, Arrows, Trackpad, Cards',
    subZh: '摇杆、大箭头、滑屏板、卡牌桌',
    titleEn: 'The 4 Smart Controller Pads',
    titleZh: '4 种智能自适应手机手柄',
    textEn: 'The platform automatically picks the best controller layout for each of the 200 games:',
    textZh: '系统会根据当前所玩游戏自动为你匹配最顺手的手柄形态（也可以手动切换）：',
    bulletsEn: [
      'Pad 1 · Pro Analog Stick: Smooth 360° virtual joystick + big A & B action buttons for free-movement arcade & sports games.',
      'Pad 2 · Easy Arrows: Crisp Up/Down/Left/Right directional keys (with optional 4-Way Lock) + big A & B buttons—ideal for grids, lanes, and board games.',
      'Pad 3 · Swipe Trackpad: Slide or flick anywhere on the touch zone to aim, steer, or launch (great for slingshot, billiards, carrom, and quick reflex games).',
      'Pad 4 · Private Card Deck: Dedicated solid-color hand fan with tap/flick play, bottom-right action buttons, and a compact bottom-left personal status chip.',
    ],
    bulletsZh: [
      '1号 · 专业摇杆手柄：360° 顺滑虚拟摇杆 + 超大 A / B 键，适合自由走位街机与体育对抗。',
      '2号 · 简易大箭头：清晰上下左右大方向键（带四向防误触锁）+ A / B 键，最适合格子棋盘与跑道。',
      '3号 · 滑动触控板：单指拖动或轻甩瞄准出击，适合弹射、台球、康乐棋与快反应游戏。',
      '4号 · 私密卡牌手牌器：实色全可见扇形手牌 + 右下角摸牌/出牌键 + 左下角迷你状态条。',
    ],
    nextTopicIds: ['card-pad-guide', 'customize-pad', 'keyboard-controls'],
  },
  {
    id: 'card-pad-guide',
    category: 'controls',
    keywords: ['card pad', 'card control', 'flick', 'swipe card', 'draw button', 'status chip', '卡牌操作', '出牌', '摸牌', '手牌', '状态条'],
    labelEn: 'How Pocket Card Games Work',
    labelZh: '口袋模式卡牌操作指南',
    subEn: 'Tap/flick cards, Draw, Status Chip',
    subZh: '出牌手势、右下摸牌、左下状态条',
    titleEn: 'Pocket Mode Card Game Controls',
    titleZh: '口袋模式卡牌操作详解',
    textEn: 'Every card game in Pocket Mode uses a clean, no-scroll table layout designed for phone screens:',
    textZh: '口袋模式下的全部卡牌游戏均采用免滑动一屏可见设计，单手也能轻松掌控全局：',
    bulletsEn: [
      'All Cards Visible: Your hand automatically scales and overlaps neatly in solid color so every card stays visible with zero horizontal scrolling.',
      'Play a Card: Tap a glowing playable card to select and confirm, flick it upward toward the table, or tap the Play button on the bottom-right.',
      'Draw / Pass / Special Actions: Always anchored in the bottom-right corner next to your hand.',
      'Personal Status Chip (Bottom-Left): Shows your avatar, turn countdown, chips/score, and active tag (UNO!, BUST, STAY, FOLD) in a tiny footprint—tap it anytime to open full details!',
    ],
    bulletsZh: [
      '手牌全可见免滑动：所有实色卡牌会自动计算间距完整呈现在屏幕下方，无需左右滑动。',
      '快捷出牌：点击高亮可出的卡牌（点选确认）、向上轻滑甩出，或按右下角出牌键。',
      '摸牌与动作键：统一固定在右下角手牌旁，伸手即点不遮挡牌桌。',
      '迷你个人状态条（左下角）：极简展示你的头像、回合计时、筹码/分值与状态标记（UNO!、爆牌、停牌、弃牌），点击即可展开查看完整信息！',
    ],
    nextTopicIds: ['four-pads', 'customize-pad'],
  },
  {
    id: 'customize-pad',
    category: 'controls',
    keywords: ['customize', 'pad setup', 'opacity', 'hud', 'handedness', 'left hand', 'sensitivity', '校准', '透明度', '左手', '灵敏度', '按键设置'],
    labelEn: 'Customize My Controller Pad',
    labelZh: '自定义手柄与透明度设置',
    subEn: 'Pad Setup, HUD opacity, handedness',
    subZh: '按键布局、透明度、左右手与灵敏度',
    titleEn: 'Customizing Your Phone Controller',
    titleZh: '自定义你的手机手柄设置',
    textEn: 'You can tailor your controls anytime—even mid-match—without leaving the room:',
    textZh: '随时随地（甚至比赛中途）都可以微调最适合你的操作手感：',
    bulletsEn: [
      'Open "Pad Setup" (sliders icon in the lobby or inside the in-game Quick Menu).',
      'Switch between Analog Stick, Easy Arrows, or Swipe Trackpad whenever you prefer a different feel.',
      'Toggle Left-Handed / Right-Handed mode, adjust joystick size/sensitivity, or enable Auto-Tap.',
      'In Pocket Mode, tap "HUD %" in the Quick Menu to cycle button transparency so you can see more of the live arena.',
    ],
    bulletsZh: [
      '点击大厅右上角或比赛快捷菜单中的“按键设置（滑块图标）”。',
      '可自由切换摇杆、大箭头或滑动触控板，并调节摇杆大小、灵敏度与自动连点。',
      '支持左右手布局互换，习惯左手或右手操作都能顺手。',
      '口袋模式下点击菜单里的“透明度 %”可调整虚拟按键透明度，视野更通透。',
    ],
    nextTopicIds: ['four-pads', 'fix-screen-layout', 'fix-inverted'],
  },
  {
    id: 'keyboard-controls',
    category: 'controls',
    keywords: ['keyboard', 'wasd', 'arrow key', 'space', 'shift', 'laptop control', 'test controller', '键盘', '电脑操作', '测试手柄'],
    labelEn: 'Keyboard & Laptop Controls',
    labelZh: '电脑键盘与测试手柄操作',
    subEn: 'WASD / Arrow keys + Test Remote',
    subZh: 'WASD / 方向键与测试遥控器',
    titleEn: 'Playing or Testing with a Keyboard',
    titleZh: '电脑键盘与内置测试手柄指南',
    textEn: 'Playing on a laptop or trying a game solo with the built-in Test Controller? Keyboard shortcuts work automatically!',
    textZh: '在电脑上试玩或使用主屏内置的“测试手柄”时，可以直接使用键盘操作：',
    bulletsEn: [
      'WASD Profile: Move with W A S D · Button A = Space · Button B = Left Shift.',
      'Arrows Profile: Move with Arrow Keys · Button A = Enter · Button B = Right Shift.',
      'In Card Games: Use A/D or Left/Right Arrows to highlight cards, Space/Enter to play, and Shift to Draw/Pass—or simply click cards directly with your mouse.',
      'In TV Host Mode, click "Test Controller" in the top bar to open an embedded phone controller right beside the arena.',
    ],
    bulletsZh: [
      'WASD 方案：W A S D 移动 · 空格键 = A 键 · 左 Shift = B 键。',
      '方向键方案：上下左右方向键移动 · 回车键 = A 键 · 右 Shift = B 键。',
      '卡牌游戏：可用 A/D 或左右方向键切牌，空格/回车出牌，Shift 摸牌/过牌，也可以直接鼠标点击手牌。',
      '大屏主持模式下点击右上角“测试手柄”，无需掏出手机就能在同屏试玩。',
    ],
    nextTopicIds: ['four-pads', 'customize-pad'],
  },

  // ---- 4. PARTY MODES & FEATURES ----
  {
    id: 'cup-mode',
    category: 'party-features',
    keywords: ['cup', 'tournament', '5-game', 'five game', 'vote', 'podium', '杯赛', '五局', '锦标赛', '投票'],
    labelEn: '5-Game Cup Tournament & Voting',
    labelZh: '五局派对杯赛与投票',
    subEn: 'Chain 5 games for the grand trophy',
    subZh: '连战五局投票选游，争夺总冠军',
    titleEn: '5-Game Party Cup Mode',
    titleZh: '五局派对杯赛模式',
    textEn: 'Cup Mode chains 5 different games into a full party championship where players vote on what to play next!',
    textZh: '五局杯赛将 5 款不同游戏串联成完整锦标赛，每局之间由全员投票决定下一场玩什么！',
    bulletsEn: [
      'Toggle "5-Game Cup" in the Host or Pocket lobby before starting.',
      'Between rounds, 3 candidate games appear with live previews—every player votes right from their phone.',
      'Each match awards Cup points by rank so consistency and clutch wins both matter.',
      'After Game 5, a grand podium ceremony crowns the overall Cup Champion!',
    ],
    bulletsZh: [
      '开局前在主机或口袋大厅开启“五局杯赛”开关。',
      '每局结束后会出现 3 款候选游戏及实机预览，所有玩家在手机上投票表决。',
      '每场按最终名次累计杯赛积分，稳健发挥和绝杀逆转都很关键。',
      '第 5 局收官后将开启总分领奖台，加冕全场杯赛冠军！',
    ],
    nextTopicIds: ['chaos-wheel', 'frenzy-time', 'teams-bots'],
  },
  {
    id: 'chaos-wheel',
    category: 'party-features',
    keywords: ['chaos', 'mutator', 'wheel', 'mirror', 'low gravity', 'hyper speed', 'giant', '混沌', '突变', '轮盘', '镜像', '低重力'],
    labelEn: 'Chaos Wheel & Round Mutators',
    labelZh: '混沌轮盘与趣味规则突变',
    subEn: 'Low Gravity, Hyper Speed, Mirror Curse',
    subZh: '低重力、极速、巨型与镜像反转',
    titleEn: 'Chaos Wheel & Round Mutators',
    titleZh: '混沌轮盘与趣味词条突变',
    textEn: 'Spin the Chaos Wheel in the lobby to add hilarious physics or rule twists to any game!',
    textZh: '在大厅转动混沌轮盘，可为任意游戏叠加意想不到的物理或规则突变词条！',
    bulletsEn: [
      'Low Gravity: Knockbacks and jumps send players floating across the arena.',
      'Hyper Speed: 1.45× movement speed for wild, high-reflex showdowns.',
      'Giant Mode: Oversized characters with booming heavy collisions.',
      'Mirror Curse: Flips joystick directions upside-down and left-to-right—watch for the pink warning banner!',
    ],
    bulletsZh: [
      '低重力漂浮：撞飞和跳跃都会滑翔超远距离。',
      '极速狂飙：全体移速飙升至 1.45 倍，极速反应大乱斗。',
      '巨型乱斗：角色体型巨化，正面碰撞冲击力拉满。',
      '镜像反转：摇杆上下左右完全反向！看到粉色警告提示时千万别按反了。',
    ],
    nextTopicIds: ['frenzy-time', 'cup-mode', 'fix-inverted'],
  },
  {
    id: 'frenzy-time',
    category: 'party-features',
    keywords: ['frenzy', 'overdrive', 'final stretch', 'double points', '狂热', '冲刺', '最后阶段', '双倍'],
    labelEn: 'Frenzy Time (Final Overdrive)',
    labelZh: '狂热时间（终盘冲刺）',
    subEn: 'Late-match comeback boost',
    subZh: '比赛尾声高燃提速与翻盘机制',
    titleEn: 'Frenzy Time Overdrive',
    titleZh: '狂热时间（Frenzy Time）',
    textEn: 'During the final stretch of Arcade matches, Frenzy Time ignites across both TV and Pocket Mode screens! Board & Card games skip Frenzy so turn flow stays calm and focused.',
    textZh: '街机（Arcade）模式进入最后冲刺阶段时，大屏与口袋模式都会同步触发狂热时间高能横幅！棋盘与卡牌游戏不会触发狂热打断，保持专注流畅的回合节奏。',
    bulletsEn: [
      'A glowing Frenzy Time banner flashes automatically near the end of Arcade matches.',
      'Match pace and scoring stakes ramp up to 2× so trailing players can pull off last-second comebacks.',
      'Board & Card games intentionally stay Frenzy-free so strategy, voting, and card plays are never interrupted.',
    ],
    bulletsZh: [
      '街机游戏进入终盘倒计时时，屏幕会闪现狂热时间横幅提醒全员。',
      '最后阶段节奏与得分全面翻倍（2×），落后玩家依然能抓住机会绝地翻盘。',
      '棋盘与卡牌类游戏默认关闭狂热打断，保证思考、出牌与投票体验流畅不混乱。',
    ],
    nextTopicIds: ['chaos-wheel', 'cup-mode'],
  },
  {
    id: 'teams-bots',
    category: 'party-features',
    keywords: ['team', 'teams', '2v2', 'difficulty', 'chill', 'spicy', '组队', '团队', '难度', '阵营'],
    labelEn: 'Teams Mode & Bot Difficulty',
    labelZh: '组队阵营与机器人难度',
    subEn: 'Free-for-All, 2 Teams, 3 AI levels',
    subZh: '混战、分队对抗与三档 AI 强度',
    titleEn: 'Teams Mode & Bot Difficulty',
    titleZh: '团队分队与 AI 机器人难度',
    textEn: 'Switch between Free-for-All and Team play, and tune AI Bot toughness to match your group:',
    textZh: '在大厅可随时切换个人混战或团队对抗，并按玩家水平调整机器人强度：',
    bulletsEn: [
      'Team Mode: Toggle between Free-for-All and 2-Team / Squad modes in the lobby—tap a player’s team badge to swap sides.',
      'Chill AI: Relaxed pace—great for kids, beginners, and learning new games.',
      'Arcade AI: Balanced party challenge for casual groups.',
      'Spicy AI: Sharp, aggressive rivals for experienced players!',
    ],
    bulletsZh: [
      '团队模式：在大厅切换个人混战或分队模式，点击玩家队伍标记即可自由换边。',
      '轻松 AI（Chill）：节奏温和，最适合新手和小朋友上手。',
      '街机 AI（Arcade）：均衡耐玩，适合普通朋友聚会。',
      '狂暴 AI（Spicy）：反应迅猛、策略犀利，适合高手挑战！',
    ],
    nextTopicIds: ['solo-bots', 'cup-mode'],
  },
  {
    id: 'emotes-reactions',
    category: 'party-features',
    keywords: ['emote', 'emoji', 'reaction', 'taunt', '表情', '互动', '弹幕'],
    labelEn: 'Quick Emotes & Reactions',
    labelZh: '快捷表情与实时互动',
    subEn: 'Send live reactions mid-match',
    subZh: '对局中一键发送飘屏表情',
    titleEn: 'Live Emotes & Reactions',
    titleZh: '实时快捷表情互动',
    textEn: 'Celebrate clutch plays or tease your friends mid-match with live floating emotes:',
    textZh: '打出了神操作或想调侃好友？随时发送实时飘屏表情活跃气氛：',
    bulletsEn: [
      'Tap the smiley / emote button in the top bar of your phone controller.',
      'Pick any reaction emoji—it pops up live across the TV arena and every player’s screen!',
    ],
    bulletsZh: [
      '点击手机手柄顶部栏的笑脸表情图标。',
      '选择任意表情即可瞬间弹出在电视大屏和所有好友屏幕上！',
    ],
    nextTopicIds: ['invite-friends', 'lang-sound-fullscreen'],
  },

  // ---- 5. HOSTING & LOBBY GUIDE ----
  {
    id: 'invite-friends',
    category: 'hosting-lobby',
    keywords: ['invite', 'share', 'link', 'copy', 'qr code', '邀请', '分享', '链接', '复制'],
    labelEn: 'How to Invite Friends',
    labelZh: '如何邀请好友进房',
    subEn: 'QR code, direct link & room code',
    subZh: '二维码、直达链接与 4 位房间码',
    titleEn: 'Inviting Friends to Your Room',
    titleZh: '邀请好友加入房间',
    textEn: 'There are 3 super fast ways to bring friends into your room:',
    textZh: '三种方式一键拉好友进房，几秒就能满员开局：',
    bulletsEn: [
      'QR Code: Open the QR panel in the Host or Pocket lobby so nearby friends can scan with their camera.',
      'Share / Copy Invite Link: Tap the Share or Copy button—the link automatically opens straight into your room!',
      '4-Letter Room Code: Read the 4-letter code aloud so friends can type it on the Join screen.',
    ],
    bulletsZh: [
      '二维码直扫：在主机或口袋大厅打开二维码，身旁好友用相机一扫即进。',
      '分享 / 复制邀请链接：点击分享或复制发到聊天群，好友点开链接自动进房！',
      '口报 4 位房间码：把顶部 4 位代码告诉好友，在首页点“加入房间”输入即可。',
    ],
    nextTopicIds: ['ready-start', 'join-room', 'game-settings'],
  },
  {
    id: 'ready-start',
    category: 'hosting-lobby',
    keywords: ['ready', 'start match', 'begin', 'kick', 'host control', '准备', '开始游戏', '开局', '踢人'],
    labelEn: 'Ready-Up & Starting Matches',
    labelZh: '准备机制与房主开局',
    subEn: 'How the lobby starts cleanly',
    subZh: '如何确认准备与开始比赛',
    titleEn: 'Ready-Up & Starting a Match',
    titleZh: '准备机制与开始比赛',
    textEn: 'Every match starts smoothly once players confirm they are ready:',
    textZh: '所有真人玩家确认准备后，房主即可一键发车：',
    bulletsEn: [
      'Each human player taps "Tap Ready" at the bottom of their phone lobby (AI Bots are automatically ready).',
      'Once everyone is green/ready, the Host taps "Start" to launch the countdown!',
      'If someone stepped away, the Host can remove or replace them with a Bot from the player list so the group never gets stuck.',
    ],
    bulletsZh: [
      '每位真人玩家在手机大厅底部点击“点击准备”（机器人默认自动准备）。',
      '全员显示绿色已准备后，房主点击“开始”即刻进入倒计时开局！',
      '如果有人暂时离开，房主可在玩家列表中移除或换上机器人，不耽误大家开玩。',
    ],
    nextTopicIds: ['game-settings', 'fix-cant-start', 'invite-friends'],
  },
  {
    id: 'game-settings',
    category: 'hosting-lobby',
    keywords: ['change game', 'switch game', 'rounds', 'setting', 'filter', '换游戏', '切游戏', '局数', '筛选'],
    labelEn: 'Changing Games & Match Settings',
    labelZh: '切换游戏与调整回合设置',
    subEn: 'Filter 200 games, rounds & rules',
    subZh: '筛选 200 款游戏、局数与规则',
    titleEn: 'Picking Games & Custom Match Settings',
    titleZh: '挑选游戏与自定义比赛设置',
    textEn: 'You can switch between all 200 games in seconds right inside the lobby:',
    textZh: '在大厅中无需重新建房，几秒就能切换全部 200 款游戏并调整规则：',
    bulletsEn: [
      'Use the genre & player filters (All, Arcade, Board, Cards, Malaysian Classics, 1P, 2P, 3+P) or the search bar to find games fast.',
      'Tap "Random / Shuffle" if the group can’t decide!',
      'Every game has its own Match Setting chip (such as number of rounds, target points, or deck rule)—tap it before starting to customize match length.',
    ],
    bulletsZh: [
      '利用分类标签（街机、棋盘、卡牌、马来西亚经典、单人、双人、多人）或搜索框快速找游戏。',
      '大家拿不定主意时，点“随机抽选”一键盲盒开玩！',
      '每款游戏都有专属设置项（如回合数、目标分或特殊规则），开局前点击即可调整时长与节奏。',
    ],
    nextTopicIds: ['cup-mode', 'lang-sound-fullscreen'],
  },
  {
    id: 'lang-sound-fullscreen',
    category: 'hosting-lobby',
    keywords: ['language', 'chinese', 'english', 'fullscreen', 'sound', 'mute', '语言', '中文', '英文', '全屏', '音效', '静音'],
    labelEn: 'Language, Sound & Fullscreen',
    labelZh: '语言切换、音效与全屏',
    subEn: 'EN / 中文, Audio & Fullscreen',
    subZh: '中英双语、静音与沉浸全屏',
    titleEn: 'Language, Audio & Fullscreen Controls',
    titleZh: '中英文切换、音效与全屏设置',
    textEn: 'Quick display and sound utilities live right in the top bar (or Quick Menu in Pocket Mode):',
    textZh: '语言、音效和全屏开关都在顶部快捷栏（口袋模式下在右上角菜单内）：',
    bulletsEn: [
      'Language Toggle (EN / 中文): Switches every screen, game title, rulebook, canvas label, and this Guide Bot instantly.',
      'Sound / Mute Toggle: Turn arcade sound effects on or off individually on each device.',
      'Fullscreen Button: Expands the game to hide browser address bars—strongly recommended on phones!',
    ],
    bulletsZh: [
      '语言切换（EN / 中文）：一键切换全平台界面、200 款游戏名、画布文字与本助手的语言。',
      '音效开关：每台设备都可以独立开启或静音，互不干扰。',
      '全屏按钮：隐藏手机浏览器地址栏，大幅增加有效画面空间（强烈推荐开启！）。',
    ],
    nextTopicIds: ['fix-sound', 'fix-screen-layout'],
  },

  // ---- 6. QUICK FIXES & TROUBLESHOOTING ----
  {
    id: 'fix-reconnect',
    category: 'troubleshooting',
    keywords: ['disconnect', 'reconnect', 'lag', 'connection', 'wifi', 'dropped', '断线', '重连', '卡顿', '连不上', '掉线'],
    labelEn: 'Disconnected or Reconnecting',
    labelZh: '断线或一直显示重连',
    subEn: 'How to jump right back in',
    subZh: '快速恢复连接不丢局',
    titleEn: 'Fix: Disconnected or Reconnecting',
    titleZh: '排查：断线或卡在重连中',
    textEn: 'If a phone locks or switches apps, the room automatically tries to reconnect your seat:',
    textZh: '如果手机息屏或切出后台，系统会自动尝试为你恢复原有座位：',
    bulletsEn: [
      'Tap the yellow "Reconnecting... Tap to retry" banner if it appears to force an instant reconnect.',
      'Avoid switching apps or locking your screen mid-round—mobile browsers pause background tabs.',
      'If the page froze completely, refresh the browser and re-enter the same 4-letter Room Code to rejoin.',
    ],
    bulletsZh: [
      '若顶部出现黄色“正在重连... 点击重试”提示，直接点击即可立即重连。',
      '对局中尽量不要切出浏览器或锁屏，手机系统会自动暂停后台连接。',
      '如果画面完全卡住，刷新页面后重新输入原 4 位房间码即可回到房间。',
    ],
    nextTopicIds: ['fix-cant-start', 'fix-screen-layout'],
  },
  {
    id: 'fix-sound',
    category: 'troubleshooting',
    keywords: ['no sound', 'audio', 'silent', 'volume', 'music', '没声音', '无声', '听不到', '声音'],
    labelEn: 'No Sound or Music Playing',
    labelZh: '听不到声音或音效没响',
    subEn: 'Browser audio unlock checklist',
    subZh: '手机与浏览器声音解锁方法',
    titleEn: 'Fix: No Sound or Music',
    titleZh: '排查：没有声音或音效',
    textEn: 'Mobile browsers block audio until you tap once—here is how to restore sound in seconds:',
    textZh: '手机浏览器默认需要用户主动点击一次才会解锁音频，请按以下 3 步检查：',
    bulletsEn: [
      'Check the Sound icon in the top bar (or Pocket Quick Menu) and make sure it is NOT set to Muted.',
      'On iPhone, check the physical side silent/ring switch—flip it off silent mode so web audio plays.',
      'Tap anywhere on the screen or tap the "Unlock Audio" button on the Host monitor to wake browser audio.',
    ],
    bulletsZh: [
      '检查顶部栏（或口袋模式右上角快捷菜单）里的音效图标，确认没有处于“静音”状态。',
      'iPhone 用户请检查机身左侧的实体静音拨片，需关闭静音模式网页音效才会出声。',
      '点击屏幕任意位置或大屏端“开启音效”按钮即可激活浏览器声音。',
    ],
    nextTopicIds: ['lang-sound-fullscreen', 'fix-screen-layout'],
  },
  {
    id: 'fix-inverted',
    category: 'troubleshooting',
    keywords: ['inverted', 'reversed', 'wrong direction', 'backwards', 'opposite', '反向', '反转', '方向错了', '按反'],
    labelEn: 'Why Are My Controls Reversed?!',
    labelZh: '为什么方向操作全反了？',
    subEn: 'Mirror Curse & orientation tips',
    subZh: '镜像反转词条与手柄检查',
    titleEn: 'Fix: Controls Feel Reversed / Inverted',
    titleZh: '排查：摇杆或方向键反了',
    textEn: '99% of the time, reversed movement is actually an intentional party twist!',
    textZh: '绝大多数时候，方向变反是因为本局抽到了趣味惩罚词条：',
    bulletsEn: [
      'Check for the pink "Mirror Curse" Chaos Mutator badge—it intentionally flips Up/Down and Left/Right for that round!',
      'To turn it off for the next round, open the Chaos Wheel in the lobby and select "Normal".',
      'If Mirror Curse is NOT active, open Pad Setup to verify your pad type and Left/Right-Handed layout.',
    ],
    bulletsZh: [
      '请先看顶部或规则栏是否有粉色“镜像反转（Mirror Curse）”混沌词条——它会在本局故意把上下左右全部反转！',
      '下一局想关闭反转，只需在大厅打开混沌轮盘切回“标准模式（Normal）”。',
      '如果并非镜像反转，请点开“按键设置”检查当前手柄模式与左右手设置。',
    ],
    nextTopicIds: ['chaos-wheel', 'customize-pad'],
  },
  {
    id: 'fix-screen-layout',
    category: 'troubleshooting',
    keywords: ['cramped', 'small screen', 'cut off', 'portrait', 'landscape', 'rotate', 'overlap', '遮挡', '太小', '横屏', '竖屏', '显示不全'],
    labelEn: 'Phone Screen Feels Cramped',
    labelZh: '手机画面太挤或显示不全',
    subEn: 'Fullscreen, rotate & HUD tips',
    subZh: '全屏、横屏与透明度优化技巧',
    titleEn: 'Fix: Cramped Screen or Cut-Off Layout',
    titleZh: '优化：手机画面显得太挤或显示不全',
    textEn: 'A couple of quick taps instantly give you much more breathing room on any phone:',
    textZh: '调整下面几个设置，立刻让手机游玩视野宽敞一倍：',
    bulletsEn: [
      'Tap Fullscreen (expand icon in the top bar or Quick Menu) to hide the browser URL and bottom bars.',
      'Rotate your phone to Landscape for wide action arenas and card tables—your hand cards automatically expand and stay 100% visible with zero scrolling.',
      'In Pocket Mode action games, lower the "HUD %" opacity in the Quick Menu so controls stay subtle over the arena.',
      'In Pocket Card Games, your personal status sits compactly on the bottom-left (tap it to peek full details without covering the table!).',
    ],
    bulletsZh: [
      '点击顶部栏或快捷菜单里的“全屏”按钮，隐藏浏览器地址栏和底部导航条。',
      '玩横版街机或卡牌桌游时，把手机横屏放置视野最好——卡牌会自动自适应铺开，无需左右滑动。',
      '口袋模式动作游戏中，可在快捷菜单调低“透明度 %”，让虚拟摇杆和按键更通透。',
      '口袋模式卡牌中，个人状态已浓缩在左下角，点击即可临时展开全部详情且不遮牌桌！',
    ],
    nextTopicIds: ['customize-pad', 'card-pad-guide'],
  },
  {
    id: 'fix-cant-start',
    category: 'troubleshooting',
    keywords: ['wont start', 'cant start', 'stuck lobby', 'waiting', 'not ready', '开始不了', '点不了开始', '卡在大厅', '无法开始'],
    labelEn: 'Match Won’t Start in Lobby',
    labelZh: '大厅点不了开始 / 卡在等待',
    subEn: 'Ready check & minimum players',
    subZh: '全员准备与最低人数检查',
    titleEn: 'Fix: Match Won’t Start in Lobby',
    titleZh: '排查：大厅无法开始比赛',
    textEn: 'Check these 3 quick items if the Start button isn’t launching yet:',
    textZh: '如果点击“开始”没反应或按钮偏灰，请依次检查以下 3 项：',
    bulletsEn: [
      'All human players must tap "Tap Ready" (green check) before the Host starts.',
      'Make sure the room meets the game’s minimum player count—if you need more players, tap "Add Bot" in the lobby!',
      'Only the Room Host (marked with the crown icon) can tap Start. If the host left, host control transfers automatically to the next player.',
    ],
    bulletsZh: [
      '所有真人玩家都需要先点击底部的“点击准备”变为绿色状态。',
      '确认当前人数已达到该游戏的最低开局人数——人不够时点击“添加机器人”即可补满！',
      '只有带皇冠标记的房主才能点击“开始”；若原房主退出，房主权限会自动移交给下一位玩家。',
    ],
    nextTopicIds: ['ready-start', 'solo-bots'],
  },
];

const GAME_ALIASES: Partial<Record<GameId, string[]>> = {
  'color-clash': ['uno', 'color clash', '色彩风暴', '乌诺', '变色牌', '抽牌'],
  'dark-flip-clash': ['uno flip', 'dark flip', 'flip clash', '暗面翻牌', '双面牌', '翻转牌'],
  'liars-deck': ['liar', 'liars bar', 'liar bar', 'liars deck', 'bluff deck', '骗子酒馆', '说谎牌桌', '吹牛牌'],
  'boom-kittens': ['exploding kittens', 'boom kittens', 'kittens', '炸弹猫', '爆炸猫'],
  'property-deal': ['monopoly deal', 'property deal', '地产大亨', '大富翁卡牌', '收租'],
  'flip-seven': ['flip 7', 'flip seven', '翻七', '翻7'],
  'royal-bluff': ['coup', 'royal bluff', '政变', '宫廷暗战'],
  'sushi-draft': ['sushi go', 'sushi draft', '寿司', '旋转寿司'],
  'big-two-royale': ['big two', 'big 2', 'chor dai di', 'dai di', '锄大地', '大老二', '大老2'],
  'lucky-21': ['blackjack', '21', 'ban luck', '21点', '廿一点', '黑杰克'],
  'ten-pair-showdown': ['ngau', 'niu niu', 'niuniu', 'bull', '斗牛', '牛牛'],
  'landlord-clash': ['dou dizhu', 'doudizhu', 'landlord', '斗地主'],
  'speed-mahjong': ['mahjong', '麻将', '雀魂', '碰杠胡'],
  'liars-dice-tavern': ['liars dice', 'tavern dice', '大话骰', '吹牛骰', '摇骰'],
  'undercover-word': ['spy', 'undercover', 'who is spy', '谁是卧底', '卧底'],
  'midnight-werewolf': ['werewolf', 'mafia', '狼人杀', '狼人'],
  'idiom-chain': ['idiom', 'word chain', '成语接龙', '词语接龙'],
  'word-pulse': ['wordle', '猜词', '字母词'],
  'trivia-blitz': ['trivia', 'quiz', '问答', '抢答'],
  'codenames-grid': ['codenames', '行动代号', '代号'],
  'fib-party': ['fibbage', 'fib', '瞎编', '真假话'],
  'rummy-royale': ['rummy', '拉米'],
  'hearts-breaker': ['hearts', '红心大战'],
  'spades-bidding': ['spades', '黑桃'],
  'poker-showdown': ['poker', 'texas', 'holdem', '德州扑克', '扑克'],
  'baccarat-club': ['baccarat', '百家乐'],
  'tarot-arcana': ['tarot', '塔罗'],
  'memory-pairs': ['memory', 'match pairs', '翻牌记忆', '记忆配对'],
  'sequence-jack': ['sequence', '序列'],
  'bumper-brawl': ['bumper', 'sumo', '碰碰', '撞飞'],
  'astro-blaster': ['astro', 'spaceship', 'shooter', '太空射击'],
  'turbo-drift': ['drift', 'racing', 'car race', '赛车', '漂移'],
  'ludo-royale': ['ludo', '飞行棋'],
  'rich-street': ['monopoly', 'rich street', '大富翁'],
  'jungle-ladders': ['snakes and ladders', 'snake ladder', '蛇梯棋'],
  'gomoku-blitz': ['gomoku', 'five in a row', '五子棋'],
  'chess-blitz': ['chess', '国际象棋'],
  'xiangqi-river-clash': ['xiangqi', 'chinese chess', '象棋', '中国象棋'],
  'reversi-clash': ['reversi', 'othello', '黑白棋', '翻转棋'],
  'four-in-a-row': ['connect 4', 'connect four', '四子棋'],
  'pit-harvest': ['congkak', 'mancala', '播棋'],
  'wau-kite-cut': ['wau', 'kite', '风筝'],
  'chapteh-juggle': ['chapteh', 'jianzi', '踢毽子', '毽子'],
  'five-stones-toss': ['five stones', 'batu seremban', '抓石子'],
  'carrom-arena': ['carrom', '康乐棋'],
  'melon-merge': ['suika', 'watermelon', '合成大西瓜', '大西瓜'],
  'tile-triple': ['sheep', 'match 3', '羊了个羊', '三消'],
  'hotpot-rush': ['hotpot', '火锅', '抢火锅'],
  'slither-feast': ['slither', 'snake', '贪吃蛇'],
  'flappy-flock': ['flappy', '笨鸟先飞'],
  'dino-dash': ['dino', 'dinosaur', '小恐龙'],
  'red-light-dash': ['red light', 'squid', '木头人', '一二三木头人'],
  'glass-bridge': ['glass bridge', '玻璃桥'],
};

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’`\-_.,!?！？，。、:：;；()（）[\]【】]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactText(input: string): string {
  return normalizeText(input).replace(/\s+/g, '');
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[b.length];
}

interface IndexedGame {
  id: GameId;
  en: GameMetadata;
  zh: GameMetadata;
  genre: 'arcade' | 'board' | 'card';
  isHeritage: boolean;
  aliases: string[];
  searchNorms: string[];
}

let cachedIndex: IndexedGame[] | null = null;

function getGameIndex(): IndexedGame[] {
  if (cachedIndex) return cachedIndex;
  cachedIndex = GAME_CATALOG.map((base) => {
    const en = getLocalizedGameMeta(base, 'en');
    const zh = getLocalizedGameMeta(base, 'zh');
    const aliases = GAME_ALIASES[base.id] ?? [];
    const rawTerms = [base.id.replace(/-/g, ' '), en.name, zh.name, ...aliases];
    const searchNorms = Array.from(
      new Set(rawTerms.map(normalizeText).filter((t) => t.length >= 2))
    );
    return {
      id: base.id,
      en,
      zh,
      genre: getGameGenre(base.id),
      isHeritage: HERITAGE_GAME_IDS.has(base.id),
      aliases,
      searchNorms,
    };
  });
  return cachedIndex;
}

function genreLabelFor(genre: 'arcade' | 'board' | 'card', lang: Language): string {
  if (lang === 'zh') {
    return genre === 'card' ? '卡牌' : genre === 'board' ? '棋盘' : '街机';
  }
  return genre === 'card' ? 'Card' : genre === 'board' ? 'Board' : 'Arcade';
}

function toSuggestedGame(item: IndexedGame, lang: Language): RuleBotSuggestedGame {
  const meta = lang === 'zh' ? item.zh : item.en;
  return {
    id: item.id,
    name: meta.name,
    genreLabel: genreLabelFor(item.genre, lang),
    playerModeLabel: meta.playerModeLabel,
    accentHex: meta.accentHex,
  };
}

function buildMainMenuChoices(activeGameId: GameId | null | undefined, lang: Language): RuleBotChoice[] {
  const choices: RuleBotChoice[] = [];
  if (activeGameId) {
    const meta = getLocalizedGameMeta(getGameMeta(activeGameId), lang);
    choices.push({
      id: `current_${activeGameId}`,
      label: lang === 'zh' ? `当前游戏：${meta.name}` : `Current Game: ${meta.name}`,
      sublabel: lang === 'zh' ? '查看本局规则与操作' : 'Rules & controls for this match',
      accentHex: meta.accentHex,
      action: 'prompt',
      value: lang === 'zh' ? `${meta.name} 怎么玩？` : `How to play ${meta.name}`,
    });
  }
  for (const cat of GUIDE_CATEGORIES) {
    choices.push({
      id: `cat_${cat.id}`,
      label: lang === 'zh' ? cat.labelZh : cat.labelEn,
      sublabel: lang === 'zh' ? cat.subZh : cat.subEn,
      accentHex: cat.accentHex,
      action: 'category',
      value: cat.id,
    });
  }
  return choices;
}

function mainMenuChoice(lang: Language): RuleBotChoice {
  return {
    id: 'back_main_menu',
    label: lang === 'zh' ? '← 返回主菜单' : '← Back to Main Menu',
    sublabel: lang === 'zh' ? '查看全部教程分类' : 'See all help categories',
    accentHex: '#94A3B8',
    action: 'menu',
    value: 'main',
  };
}

function buildCategoryReply(categoryId: GuideCategoryId, lang: Language): RuleBotReply {
  const cat = GUIDE_CATEGORIES.find((c) => c.id === categoryId) ?? GUIDE_CATEGORIES[0];

  if (categoryId === 'game-rules') {
    const total = GAME_CATALOG.length;
    const choices: RuleBotChoice[] = [
      {
        id: 'pick_200',
        label: lang === 'zh' ? `搜索全部 ${total} 款游戏` : `Pick from All ${total} Games`,
        sublabel: lang === 'zh' ? '打开完整游戏列表' : 'Open searchable catalog',
        accentHex: '#00C2FF',
        action: 'open-picker',
        value: 'picker',
      },
      {
        id: 'browse_card',
        label: lang === 'zh' ? '卡牌游戏推荐' : 'Card Games',
        sublabel: lang === 'zh' ? 'UNO、骗子酒馆、21点、斗牛' : 'UNO, Liar’s Deck, 21, Poker',
        accentHex: '#FFB800',
        action: 'prompt',
        value: lang === 'zh' ? '推荐卡牌游戏' : 'Recommend card games',
      },
      {
        id: 'browse_board',
        label: lang === 'zh' ? '棋盘与桌游' : 'Board & Tabletop',
        sublabel: lang === 'zh' ? '大富翁、五子棋、飞行棋、象棋' : 'Ludo, Gomoku, Chess, Monopoly',
        accentHex: '#A855F7',
        action: 'prompt',
        value: lang === 'zh' ? '推荐棋盘游戏' : 'Recommend board games',
      },
      {
        id: 'browse_arcade',
        label: lang === 'zh' ? '爽快街机动作' : 'Fast Arcade Games',
        sublabel: lang === 'zh' ? '碰碰乱斗、赛车、射击、大西瓜' : 'Bumper Brawl, Drift, Shooters',
        accentHex: '#10D98B',
        action: 'prompt',
        value: lang === 'zh' ? '推荐街机游戏' : 'Recommend arcade games',
      },
      {
        id: 'browse_heritage',
        label: lang === 'zh' ? '马来西亚与新年经典' : 'Malaysian & Heritage',
        sublabel: lang === 'zh' ? '康乐棋、播棋、风筝、锄大地' : 'Carrom, Congkak, Wau, Big Two',
        accentHex: '#F97316',
        action: 'prompt',
        value: lang === 'zh' ? '推荐马来西亚经典' : 'Recommend Malaysian classics',
      },
      {
        id: 'browse_2p',
        label: lang === 'zh' ? '双人 / 单人精选' : 'Solo & 2-Player Picks',
        sublabel: lang === 'zh' ? '1–2 人随时开玩' : 'Great for 1–2 players',
        accentHex: '#EC4899',
        action: 'prompt',
        value: lang === 'zh' ? '推荐双人游戏' : 'Recommend 2-player games',
      },
      mainMenuChoice(lang),
    ];

    return {
      title: lang === 'zh' ? `${cat.labelZh}（${total} 款）` : `${cat.labelEn} (${total} Games)`,
      text: lang === 'zh' ? cat.introZh : cat.introEn,
      choices,
      quickPrompts:
        lang === 'zh'
          ? ['色彩风暴(UNO)怎么玩？', '骗子酒馆规则', '推荐单人游戏', '返回主菜单']
          : ['How to play Color Clash', 'Liar’s Deck rules', 'Recommend solo games', 'Main menu'],
    };
  }

  const topics = GUIDE_TOPICS.filter((t) => t.category === categoryId);
  const choices: RuleBotChoice[] = [
    ...topics.map((topic) => ({
      id: `topic_${topic.id}`,
      label: lang === 'zh' ? topic.labelZh : topic.labelEn,
      sublabel: lang === 'zh' ? topic.subZh : topic.subEn,
      accentHex: cat.accentHex,
      action: 'topic' as const,
      value: topic.id,
    })),
    mainMenuChoice(lang),
  ];

  return {
    title: lang === 'zh' ? cat.labelZh : cat.labelEn,
    text: lang === 'zh' ? cat.introZh : cat.introEn,
    choices,
    quickPrompts:
      lang === 'zh' ? ['返回主菜单', '搜索游戏规则'] : ['Main menu', 'Find a game'],
  };
}

function buildTopicReply(topic: GuideTopicEntry, lang: Language): RuleBotReply {
  const cat = GUIDE_CATEGORIES.find((c) => c.id === topic.category);
  const nextChoices: RuleBotChoice[] = [];

  if (topic.nextTopicIds) {
    for (const nextId of topic.nextTopicIds) {
      const target = GUIDE_TOPICS.find((t) => t.id === nextId);
      if (target) {
        const targetCat = GUIDE_CATEGORIES.find((c) => c.id === target.category);
        nextChoices.push({
          id: `next_${target.id}`,
          label: lang === 'zh' ? target.labelZh : target.labelEn,
          sublabel: lang === 'zh' ? target.subZh : target.subEn,
          accentHex: targetCat?.accentHex ?? '#00C2FF',
          action: 'topic',
          value: target.id,
        });
      }
    }
  }
  if (cat) {
    nextChoices.push({
      id: `more_${cat.id}`,
      label: lang === 'zh' ? `更多：${cat.labelZh}` : `More: ${cat.labelEn}`,
      accentHex: cat.accentHex,
      action: 'category',
      value: cat.id,
    });
  }
  nextChoices.push(mainMenuChoice(lang));

  return {
    title: lang === 'zh' ? topic.titleZh : topic.titleEn,
    text: lang === 'zh' ? topic.textZh : topic.textEn,
    bullets: lang === 'zh' ? topic.bulletsZh : topic.bulletsEn,
    metaBadges: cat
      ? [{ label: lang === 'zh' ? cat.labelZh : cat.labelEn, colorHex: cat.accentHex }]
      : undefined,
    choices: nextChoices,
    quickPrompts:
      lang === 'zh'
        ? ['返回主菜单', '推荐卡牌游戏', '口袋模式教程']
        : ['Main menu', 'Recommend card games', 'Pocket Mode guide'],
  };
}

function findMatchingGames(query: string): { best: IndexedGame | null; runnersUp: IndexedGame[]; score: number } {
  const norm = normalizeText(query);
  const compact = compactText(query);
  if (!norm) return { best: null, runnersUp: [], score: 0 };

  const queryTokens = norm.split(' ').filter((w) => w.length >= 2);
  const scored: { item: IndexedGame; score: number }[] = [];

  for (const item of getGameIndex()) {
    let bestScore = 0;

    for (const term of item.searchNorms) {
      const termCompact = term.replace(/\s+/g, '');
      if (norm === term || compact === termCompact) {
        bestScore = Math.max(bestScore, 120);
        continue;
      }
      const isShortAscii = /^[a-z0-9]+$/.test(termCompact) && termCompact.length <= 3;
      if (isShortAscii) {
        const boundaryRe = new RegExp(`(^|\\s)${termCompact}($|\\s)`, 'i');
        if (boundaryRe.test(norm)) {
          bestScore = Math.max(bestScore, 95);
        }
      } else if (norm.includes(term) || (termCompact.length >= 2 && compact.includes(termCompact))) {
        bestScore = Math.max(bestScore, 82 + Math.min(20, termCompact.length * 2));
      }

      const termTokens = term.split(' ').filter((w) => w.length >= 3);
      if (termTokens.length > 0 && queryTokens.length > 0) {
        let hits = 0;
        let fuzzyHits = 0;
        for (const tt of termTokens) {
          if (queryTokens.includes(tt)) {
            hits += 1;
          } else if (tt.length >= 4) {
            const close = queryTokens.some((qt) => qt.length >= 4 && levenshtein(qt, tt) <= 1);
            if (close) fuzzyHits += 1;
          }
        }
        const totalHitRatio = (hits + fuzzyHits * 0.85) / termTokens.length;
        if (hits > 0 || fuzzyHits > 0) {
          const tokenScore = totalHitRatio * 75 + hits * 8;
          if (totalHitRatio >= 0.5 || hits >= 2) {
            bestScore = Math.max(bestScore, tokenScore);
          }
        }
      }
    }

    if (bestScore >= 45) {
      scored.push({ item, score: bestScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  if (scored.length === 0) return { best: null, runnersUp: [], score: 0 };
  return {
    best: scored[0].item,
    runnersUp: scored.slice(1, 5).map((s) => s.item),
    score: scored[0].score,
  };
}

function matchGuideTopic(query: string): GuideTopicEntry | null {
  const norm = normalizeText(query);
  const compact = compactText(query);
  let best: GuideTopicEntry | null = null;
  let bestScore = 0;

  for (const topic of GUIDE_TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      const kwNorm = normalizeText(kw);
      const kwCompact = kwNorm.replace(/\s+/g, '');
      if (norm.includes(kwNorm) || (kwCompact.length >= 2 && compact.includes(kwCompact))) {
        score += kwCompact.length >= 5 ? 3 : 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = topic;
    }
  }

  return bestScore >= 2 ? best : null;
}

type Intent = 'greeting' | 'recommend' | 'controls' | 'settings' | 'players' | 'rules' | 'unknown';

function detectIntent(query: string): Intent {
  const norm = normalizeText(query);
  const compact = compactText(query);

  if (
    /^(hi|hello|hey|yo|help|start|menu|mainmenu|backtomainmenu|你好|嗨|哈喽|帮助|菜单|主菜单|返回主菜单)$/.test(
      compact
    )
  ) {
    return 'greeting';
  }
  if (
    /(recommend|suggest|best game|fun game|what game|which game|list.*game|find.*game|any.*game|推荐|好玩|有什么游戏|找游戏|哪些游戏|适合几人)/.test(
      norm
    )
  ) {
    return 'recommend';
  }
  if (
    /(control|button|joystick|pad|arrow|swipe|flick|how to move|how do i move|tap|key|操作|按键|摇杆|手柄|怎么按|怎么移|怎么出牌|怎么控制)/.test(
      norm
    )
  ) {
    return 'controls';
  }
  if (
    /(how to win|how do i win|win condition|scoring|score|point|round|setting|option|duration|goal|objective|怎么赢|获胜|胜负|计分|得分|分数|回合|设置|目标)/.test(
      norm
    )
  ) {
    return 'settings';
  }
  if (
    /(how many player|player count|max player|min player|can i play solo|2 player|two player|几人|人数|最多几|最少几|能单人|几个人)/.test(
      norm
    )
  ) {
    return 'players';
  }
  if (/(rule|how to play|explain|teach|guide|what is|about|玩法|规则|怎么玩|教学|介绍|是什么)/.test(norm)) {
    return 'rules';
  }
  return 'unknown';
}

function buildGameFollowUpChoices(meta: GameMetadata, lang: Language, currentIntent: Intent): RuleBotChoice[] {
  const list: RuleBotChoice[] = [];
  if (currentIntent !== 'rules') {
    list.push({
      id: `g_rules_${meta.id}`,
      label: lang === 'zh' ? '查看完整规则' : 'Full Rules',
      accentHex: '#FFB800',
      action: 'prompt',
      value: lang === 'zh' ? `${meta.name} 怎么玩？` : `How to play ${meta.name}`,
    });
  }
  if (currentIntent !== 'controls') {
    list.push({
      id: `g_ctrl_${meta.id}`,
      label: lang === 'zh' ? '查看操作指南' : 'Controls & Pad',
      accentHex: '#10D98B',
      action: 'prompt',
      value: lang === 'zh' ? `${meta.name} 怎么操作？` : `Controls for ${meta.name}`,
    });
  }
  if (currentIntent !== 'settings') {
    list.push({
      id: `g_win_${meta.id}`,
      label: lang === 'zh' ? '胜负与设置' : 'Win & Settings',
      accentHex: '#00C2FF',
      action: 'prompt',
      value: lang === 'zh' ? `${meta.name} 怎么赢？` : `How to win ${meta.name}`,
    });
  }
  list.push({
    id: `g_sim_${meta.id}`,
    label: lang === 'zh' ? '推荐类似游戏' : 'Similar Games',
    accentHex: '#A855F7',
    action: 'prompt',
    value: lang === 'zh' ? '推荐类似游戏' : 'Recommend similar games',
  });
  list.push(mainMenuChoice(lang));
  return list;
}

function buildGameRulesReply(item: IndexedGame, lang: Language, intent: Intent): RuleBotReply {
  const meta = lang === 'zh' ? item.zh : item.en;
  const padGuide = getPadTutorialGuide(item.id, lang);
  const schema = meta.controllerSchema;
  const isCard = CARD_GAME_IDS.has(item.id);
  const isBoard = BOARD_GAME_IDS.has(item.id);

  const metaBadges: RuleBotMetaBadge[] = [
    { label: genreLabelFor(item.genre, lang), colorHex: meta.accentHex },
    { label: meta.playerModeLabel },
    { label: padGuide.padShortLabel },
  ];

  const choices = buildGameFollowUpChoices(meta, lang, intent === 'unknown' ? 'rules' : intent);
  const quickPrompts =
    lang === 'zh'
      ? ['返回主菜单', '搜索其他游戏', '自定义手柄']
      : ['Main menu', 'Pick another game', 'Customize pad'];

  if (intent === 'controls') {
    const bullets: string[] = [];
    if (isCard) {
      bullets.push(lang === 'zh' ? `操作提示：${schema.controlTip}` : `Card Controls: ${schema.controlTip}`);
      bullets.push(
        lang === 'zh'
          ? '口袋模式：所有实色手牌完整展示无需滑动，点击或向上甩牌出牌，右下角摸牌/确认，左下角迷你状态条显示回合与筹码。'
          : 'Pocket Mode: all solid cards stay visible with zero scrolling—tap or flick upward to play, use the bottom-right buttons to Draw/Act, and tap the bottom-left mini status chip for full stats.'
      );
    } else {
      bullets.push(
        lang === 'zh'
          ? `推荐手柄：${padGuide.padTitle}（${padGuide.presetTag}）`
          : `Recommended Pad: ${padGuide.padTitle} (${padGuide.presetTag})`
      );
      bullets.push(
        lang === 'zh'
          ? `方向控制：${schema.joystickLabel}`
          : `Movement / Aim: ${schema.joystickLabel}`
      );
      bullets.push(
        lang === 'zh'
          ? `A 键：${schema.actionA.label} — ${schema.actionA.sublabel}`
          : `Button A: ${schema.actionA.label} — ${schema.actionA.sublabel}`
      );
      bullets.push(
        lang === 'zh'
          ? `B 键：${schema.actionB.label} — ${schema.actionB.sublabel}`
          : `Button B: ${schema.actionB.label} — ${schema.actionB.sublabel}`
      );
      if (schema.controlTip) {
        bullets.push(lang === 'zh' ? `技巧：${schema.controlTip}` : `Tip: ${schema.controlTip}`);
      }
    }

    return {
      title: lang === 'zh' ? `${meta.name} · 操作指南` : `${meta.name} · Controls`,
      text: padGuide.shortTutorial,
      bullets,
      metaBadges,
      resolvedGameId: item.id,
      choices,
      quickPrompts,
    };
  }

  if (intent === 'settings') {
    const optionList = meta.settingOptions.map((o) => o.label).join(' / ');
    const bullets = [
      ...(meta.rules.length > 0 ? [meta.rules[meta.rules.length - 1]] : []),
      lang === 'zh'
        ? `局数 / 模式设置（${meta.settingLabel}）：${optionList}`
        : `Match Setting (${meta.settingLabel}): ${optionList}`,
      lang === 'zh'
        ? `支持人数：${meta.minPlayers}–${meta.maxPlayers} 人（${meta.playerModeLabel}），大厅可加机器人补位。`
        : `Players: ${meta.minPlayers}–${meta.maxPlayers} (${meta.playerModeLabel}). You can add AI Bots in the lobby anytime.`,
    ];

    return {
      title: lang === 'zh' ? `${meta.name} · 胜负与设置` : `${meta.name} · Win & Settings`,
      text: meta.tagline,
      bullets,
      metaBadges,
      resolvedGameId: item.id,
      choices,
      quickPrompts,
    };
  }

  if (intent === 'players') {
    const canSolo = meta.suitableFor.includes('solo') || meta.minPlayers <= 1;
    return {
      title: lang === 'zh' ? `${meta.name} · 人数说明` : `${meta.name} · Player Count`,
      text:
        lang === 'zh'
          ? `${meta.name} 支持 ${meta.minPlayers} 至 ${meta.maxPlayers} 人游玩（${meta.playerModeLabel}）。${
              canSolo
                ? '非常适合单人直接开玩！'
                : '如果是单人或人数不够，在大厅添加 AI 机器人即可立即开局。'
            }`
          : `${meta.name} supports ${meta.minPlayers} to ${meta.maxPlayers} players (${meta.playerModeLabel}). ${
              canSolo
                ? 'It works great solo!'
                : 'If you are playing solo or short on players, just add AI Bots in the lobby to fill seats.'
            }`,
      bullets: [
        lang === 'zh'
          ? `游戏类型：${genreLabelFor(item.genre, lang)} · ${meta.category}`
          : `Type: ${genreLabelFor(item.genre, lang)} · ${meta.category}`,
        lang === 'zh'
          ? '口袋模式与大屏主持模式均支持。'
          : 'Playable in both Pocket Mode and TV Host Mode.',
      ],
      metaBadges,
      resolvedGameId: item.id,
      choices,
      quickPrompts,
    };
  }

  const extraHint = isCard
    ? lang === 'zh'
      ? `操作提示：${schema.controlTip}`
      : `Controls: ${schema.controlTip}`
    : isBoard
    ? lang === 'zh'
      ? `操作：${schema.joystickLabel} + A键（${schema.actionA.label}）`
      : `Controls: ${schema.joystickLabel} + A (${schema.actionA.label})`
    : lang === 'zh'
    ? `操作：${schema.joystickLabel}，A键 ${schema.actionA.label}，B键 ${schema.actionB.label}`
    : `Controls: ${schema.joystickLabel} · A: ${schema.actionA.label} · B: ${schema.actionB.label}`;

  return {
    title: meta.name,
    text: meta.description || meta.tagline,
    bullets: [...meta.rules, extraHint],
    metaBadges,
    resolvedGameId: item.id,
    choices,
    quickPrompts,
  };
}

function buildRecommendationReply(query: string, lang: Language, activeGameId?: GameId | null): RuleBotReply {
  const norm = normalizeText(query);
  const index = getGameIndex();

  const wantsCard = /(card|uno|poker|deck|mahjong|卡牌|扑克|打牌|纸牌|麻将)/.test(norm);
  const wantsBoard = /(board|chess|tabletop|grid|dice|棋盘|桌游|象棋|棋)/.test(norm);
  const wantsArcade = /(arcade|action|fast|race|sport|shooter|街机|动作|竞速|射击|反应)/.test(norm);
  const wantsHeritage = /(malaysia|heritage|cny|classic|tradition|马来西亚|大马|经典|新年|传统)/.test(norm);
  const wantsSolo = /(solo|1p|single|alone|one player|单人|一个人|独自)/.test(norm);
  const wantsTwo = /(2p|2 player|two player|couple|duel|double|双人|两人|两个人|对战)/.test(norm);
  const wantsMulti = /(party|multiplayer|group|friends|3\+|4 player|多人|聚会|派对|朋友)/.test(norm);
  const wantsSimilar = /(similar|like this|more like|类似|差不多)/.test(norm);

  let pool = index;
  let filterLabelEn = 'Popular Party Picks';
  let filterLabelZh = '热门派对推荐';

  if (wantsSimilar && activeGameId) {
    const activeItem = index.find((g) => g.id === activeGameId);
    if (activeItem) {
      pool = index.filter((g) => g.id !== activeGameId && g.genre === activeItem.genre);
      filterLabelEn = `More ${genreLabelFor(activeItem.genre, 'en')} Games Like ${activeItem.en.name}`;
      filterLabelZh = `和 ${activeItem.zh.name} 类似的${genreLabelFor(activeItem.genre, 'zh')}游戏`;
    }
  } else {
    if (wantsCard) {
      pool = pool.filter((g) => g.genre === 'card');
      filterLabelEn = 'Card Games';
      filterLabelZh = '热门卡牌游戏';
    } else if (wantsBoard) {
      pool = pool.filter((g) => g.genre === 'board');
      filterLabelEn = 'Board & Tabletop Games';
      filterLabelZh = '热门棋盘桌游';
    } else if (wantsArcade) {
      pool = pool.filter((g) => g.genre === 'arcade');
      filterLabelEn = 'Fast Arcade Games';
      filterLabelZh = '爽快街机游戏';
    } else if (wantsHeritage) {
      pool = pool.filter((g) => g.isHeritage);
      filterLabelEn = 'Malaysian & Heritage Classics';
      filterLabelZh = '马来西亚与传统经典';
    }

    if (wantsSolo) {
      const soloFiltered = pool.filter((g) => g.en.suitableFor.includes('solo') || g.en.minPlayers <= 1);
      if (soloFiltered.length > 0) pool = soloFiltered;
      filterLabelEn = `${filterLabelEn} (Solo)`;
      filterLabelZh = `${filterLabelZh}（单人可玩）`;
    } else if (wantsTwo) {
      const twoFiltered = pool.filter((g) => g.en.suitableFor.includes('double'));
      if (twoFiltered.length > 0) pool = twoFiltered;
      filterLabelEn = `${filterLabelEn} (2 Players)`;
      filterLabelZh = `${filterLabelZh}（双人对战）`;
    } else if (wantsMulti) {
      const multiFiltered = pool.filter((g) => g.en.suitableFor.includes('multiplayer'));
      if (multiFiltered.length > 0) pool = multiFiltered;
      filterLabelEn = `${filterLabelEn} (Multiplayer)`;
      filterLabelZh = `${filterLabelZh}（多人聚会）`;
    }
  }

  const picks = pool.slice(0, 6);
  const suggestedGames = picks.map((p) => toSuggestedGame(p, lang));

  return {
    title: lang === 'zh' ? filterLabelZh : filterLabelEn,
    text:
      lang === 'zh'
        ? `在 ${GAME_CATALOG.length} 款游戏中为你找到 ${pool.length} 款匹配项目！点击任意游戏立刻查看规则与操作：`
        : `Found ${pool.length} matching games across our ${GAME_CATALOG.length}-game catalog! Tap any game below to view its rules & controls:`,
    suggestedGames,
    choices: [
      {
        id: 'rec_picker',
        label: lang === 'zh' ? `搜索全部 ${GAME_CATALOG.length} 款` : `Browse All ${GAME_CATALOG.length} Games`,
        accentHex: '#00C2FF',
        action: 'open-picker',
        value: 'picker',
      },
      mainMenuChoice(lang),
    ],
    quickPrompts:
      lang === 'zh'
        ? ['推荐卡牌游戏', '推荐棋盘游戏', '推荐马来西亚经典', '返回主菜单']
        : ['Recommend card games', 'Recommend board games', 'Malaysian classics', 'Main menu'],
  };
}

export function buildWelcomeReply(activeGameId: GameId | null | undefined, lang: Language): RuleBotReply {
  const totalGames = GAME_CATALOG.length;
  return {
    title:
      lang === 'zh'
        ? '你好，很高兴见到你！'
        : 'Nice to meet you!',
    text:
      lang === 'zh'
        ? `今天我可以帮你什么？请选择下方任意分类快速了解整个平台的使用教程与全部 ${totalGames} 款游戏规则，或直接输入问题：`
        : `How can I help you today? Tap any category below for step-by-step platform tutorials and rules for all ${totalGames} games—or type any question below:`,
    choices: buildMainMenuChoices(activeGameId, lang),
    quickPrompts:
      lang === 'zh'
        ? ['口袋模式怎么玩？', '色彩风暴(UNO)规则', '没有声音怎么办？']
        : ['How does Pocket Mode work?', 'Color Clash (UNO) rules', 'No sound fix'],
  };
}

export function resolveGuideChoice(
  choice: RuleBotChoice,
  lang: Language,
  contextGameId?: GameId | null
): RuleBotReply {
  if (choice.action === 'menu') {
    return buildWelcomeReply(contextGameId, lang);
  }
  if (choice.action === 'category') {
    return buildCategoryReply(choice.value as GuideCategoryId, lang);
  }
  if (choice.action === 'topic') {
    const found = GUIDE_TOPICS.find((t) => t.id === choice.value);
    if (found) return buildTopicReply(found, lang);
  }
  return answerRuleQuestion(choice.value, lang, contextGameId);
}

export function answerRuleQuestion(
  rawQuery: string,
  lang: Language,
  contextGameId?: GameId | null
): RuleBotReply {
  const query = rawQuery.trim();
  if (!query) return buildWelcomeReply(contextGameId, lang);

  const intent = detectIntent(query);
  const gameMatch = findMatchingGames(query);
  const topicMatch = matchGuideTopic(query);

  if (intent === 'greeting') {
    return buildWelcomeReply(contextGameId, lang);
  }

  // 1. Explicit recommendations
  if (intent === 'recommend' && (!gameMatch.best || gameMatch.score < 95)) {
    return buildRecommendationReply(query, lang, contextGameId);
  }

  // 2. Explicit game mentioned in query (high confidence)
  if (gameMatch.best && gameMatch.score >= 70) {
    const reply = buildGameRulesReply(gameMatch.best, lang, intent === 'unknown' ? 'rules' : intent);
    if (gameMatch.runnersUp.length > 0 && gameMatch.score < 105) {
      reply.suggestedGames = gameMatch.runnersUp.slice(0, 3).map((g) => toSuggestedGame(g, lang));
    }
    return reply;
  }

  // 3. Platform tutorial or troubleshooting topic match
  if (topicMatch) {
    return buildTopicReply(topicMatch, lang);
  }

  // 4. Follow-up question about currently active/remembered game
  if (
    contextGameId &&
    (intent === 'controls' || intent === 'settings' || intent === 'players' || intent === 'rules')
  ) {
    const ctxItem = getGameIndex().find((g) => g.id === contextGameId);
    if (ctxItem) {
      return buildGameRulesReply(ctxItem, lang, intent);
    }
  }

  // 5. Moderate fuzzy game match
  if (gameMatch.best && gameMatch.score >= 45) {
    const reply = buildGameRulesReply(gameMatch.best, lang, intent === 'unknown' ? 'rules' : intent);
    if (gameMatch.runnersUp.length > 0) {
      reply.suggestedGames = gameMatch.runnersUp.slice(0, 3).map((g) => toSuggestedGame(g, lang));
    }
    return reply;
  }

  // 6. Helpful smart fallback back to the 6 preset categories
  return {
    title: lang === 'zh' ? '不太确定你想问什么 — 可以直接点下面分类！' : 'Not sure what you meant—pick a category below!',
    text:
      lang === 'zh'
        ? `你可以点选下方任意教程分类，或直接输入 ${GAME_CATALOG.length} 款游戏中的任意名称（如“UNO”、“骗子酒馆”、“21点”、“五子棋”）：`
        : `Tap any guide category below, or type any of our ${GAME_CATALOG.length} game names (like “Color Clash”, “Liar’s Deck”, “Lucky 21”, or “Bumper Brawl”):`,
    choices: buildMainMenuChoices(contextGameId, lang),
    quickPrompts:
      lang === 'zh'
        ? ['新手入门教程', '200 款游戏规则', '常见问题排查']
        : ['Getting started', '200 game rules', 'Quick fixes'],
  };
}

export function getAllSearchableGames(lang: Language): RuleBotSuggestedGame[] {
  return getGameIndex().map((item) => toSuggestedGame(item, lang));
}
