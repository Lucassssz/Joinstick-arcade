import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { BotDifficulty, GameId, GameMetadata, PlayerFilterMode } from '../shared/types';
import { PACK_MALAYSIAN_GAME_CATALOG, PACK_MALAYSIAN_ZH } from '../shared/packMalaysianCatalog';
import {
  PACK_CHINESE_VIRAL_GAME_CATALOG,
  PACK_CHINESE_VIRAL_ZH,
} from '../shared/packChineseViralCatalog';
import {
  PACK_GLOBAL_VIRAL_GAME_CATALOG,
  PACK_GLOBAL_VIRAL_ZH,
} from '../shared/packGlobalViralCatalog';
import {
  PACK_RETRO_ARCADE_GAME_CATALOG,
  PACK_RETRO_ARCADE_ZH,
} from '../shared/packRetroArcadeCatalog';
import {
  PACK_SPORTS_PHYSICS_GAME_CATALOG,
  PACK_SPORTS_PHYSICS_ZH,
} from '../shared/packSportsPhysicsCatalog';
import {
  PACK_CHAOS_SURVIVAL_GAME_CATALOG,
  PACK_CHAOS_SURVIVAL_ZH,
} from '../shared/packChaosSurvivalCatalog';
import {
  PACK_STRATEGY_CLASSICS_CATALOG,
  PACK_STRATEGY_CLASSICS_ZH,
} from '../shared/packStrategyClassicsCatalog';
import {
  PACK_PHYSICS_BUILDER_GAME_CATALOG,
  PACK_PHYSICS_BUILDER_ZH,
} from '../shared/packPhysicsBuilderCatalog';
import {
  PACK_CREW_DEFENSE_GAME_CATALOG,
  PACK_CREW_DEFENSE_ZH,
} from '../shared/packCrewDefenseCatalog';
import {
  PACK_TABLETOP_GEMS_GAME_CATALOG,
  PACK_TABLETOP_GEMS_ZH,
} from '../shared/packTabletopGemsCatalog';
import {
  PACK_MIND_LOGIC_GAME_CATALOG,
  PACK_MIND_LOGIC_ZH,
} from '../shared/packMindLogicCatalog';
import {
  PACK_CULT_HERITAGE_GAME_CATALOG,
  PACK_CULT_HERITAGE_ZH,
} from '../shared/packCultHeritageCatalog';

export type Language = 'en' | 'zh';

const LANG_STORAGE_KEY = 'joinstick_lang';

interface LanguageContextValue {
  lang: Language;
  isZh: boolean;
  setLang: (next: Language) => void;
  toggleLang: () => void;
  t: (en: string, zh: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  isZh: false,
  setLang: () => {},
  toggleLang: () => {},
  t: (en) => en,
});

function readInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  try {
    const params = new URLSearchParams(window.location.search);
    const langParam = (params.get('lang') || '').toLowerCase();
    if (langParam === 'zh' || langParam === 'cn') return 'zh';
    if (langParam === 'en') return 'en';

    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // Ignore storage access failures
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(readInitialLanguage);

  const setLang = (next: Language) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
  };

  const toggleLang = () => {
    setLang(lang === 'en' ? 'zh' : 'en');
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    }
  }, [lang]);

  // Sync across tabs in the same browser automatically
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_STORAGE_KEY && (e.newValue === 'en' || e.newValue === 'zh')) {
        setLangState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const t = (en: string, zh: string) => (lang === 'zh' ? zh : en);

  return (
    <LanguageContext.Provider value={{ lang, isZh: lang === 'zh', setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

export function LanguageToggle({
  compact = false,
  className = '',
}: {
  compact?: boolean;
  className?: string;
}) {
  const { lang, toggleLang } = useLanguage();
  const isZh = lang === 'zh';

  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={isZh ? 'Switch language to English' : '切换为中文'}
      title={isZh ? 'Switch to English' : '切换为中文'}
      className={`inline-flex items-center justify-center rounded-lg bg-[#1E232D] hover:bg-[#242A36] border border-[#2F3747] font-mono font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none ${
        compact ? 'h-8 px-2 text-[11px] gap-1' : 'h-9 px-2.5 text-xs gap-1'
      } ${className}`}
    >
      <span className={!isZh ? 'text-white' : 'text-[#6B7280]'}>EN</span>
      <span className="text-[#4B5563]">/</span>
      <span className={isZh ? 'text-[#00C2FF]' : 'text-[#6B7280]'}>CN</span>
    </button>
  );
}

export function getLocalizedFilterLabel(
  id: PlayerFilterMode,
  lang: Language,
  short = false
): string {
  if (lang === 'en') {
    switch (id) {
      case 'all':
        return short ? 'All' : 'All Games';
      case 'heritage':
        return short ? 'MY Classics' : 'Malaysian Classics';
      case 'arcade':
        return short ? 'Arcade' : 'Arcade Games';
      case 'board':
        return short ? 'Board' : 'Board Games';
      case 'card':
        return short ? 'Cards' : 'Card Games';
      case 'solo':
        return short ? '1P' : 'Solo (1P)';
      case 'double':
        return short ? '2P' : 'Double (2P)';
      case 'multiplayer':
        return short ? '3+P' : 'Multiplayer (3+)';
    }
  }
  switch (id) {
    case 'all':
      return short ? '全部' : '全部游戏';
    case 'heritage':
      return short ? '大马经典' : '马来西亚经典';
    case 'arcade':
      return short ? '街机' : '街机竞技';
    case 'board':
      return short ? '桌游' : '棋盘桌游';
    case 'card':
      return short ? '卡牌' : '派对卡牌';
    case 'solo':
      return short ? '1P' : '单人 (1P)';
    case 'double':
      return short ? '2P' : '双人对战 (2P)';
    case 'multiplayer':
      return short ? '3+P' : '多人派对 (3+)';
  }
}

export function getLocalizedDifficulty(
  d: BotDifficulty | undefined,
  lang: Language
): { label: string; hint: string } {
  const diff = d ?? 'arcade';
  if (lang === 'en') {
    if (diff === 'chill') return { label: 'Chill', hint: 'Easy & friendly pace' };
    if (diff === 'spicy') return { label: 'Spicy', hint: 'Fast & sharp rivals' };
    return { label: 'Arcade', hint: 'Fun medium challenge' };
  }
  if (diff === 'chill') return { label: '轻松', hint: '节奏友好，新手推荐' };
  if (diff === 'spicy') return { label: '狂飙', hint: '反应敏捷，高能对手' };
  return { label: '街机', hint: '趣味适中，欢乐对抗' };
}

interface GameTranslationZh {
  name: string;
  category: string;
  tagline: string;
  description: string;
  playerModeLabel: string;
  rules: string[];
  joystickLabel: string;
  actionALabel: string;
  actionASublabel: string;
  actionBLabel: string;
  actionBSublabel: string;
  controlTip: string;
  settingLabel: string;
  settingOptions: Record<number, string>;
}

const GAME_ZH: Record<GameId, GameTranslationZh> = {
  'bumper-brawl': {
    name: '碰碰大乱斗',
    category: '相扑撞击',
    tagline: '把其他玩家撞出不断缩小的擂台！',
    description: '在不断缩小的圆形擂台上，用冲刺和冲击波把好友撞下去，成为最后的赢家。',
    playerModeLabel: '2人 · 3–8人',
    rules: [
      '用摇杆移动，稳稳留在圆圈擂台内。',
      '按「冲刺 (A)」猛撞其他玩家。',
      '按「震波 (B)」把周围的所有人弹开。',
      '最后留在擂台上的玩家获胜！',
    ],
    joystickLabel: '移动',
    actionALabel: '冲刺',
    actionASublabel: '极速撞击',
    actionBLabel: '震波',
    actionBSublabel: '范围弹飞',
    controlTip: '在擂台边缘使用冲刺和震波，一击把对手送出场外！',
    settingLabel: '回合数',
    settingOptions: { 3: '3 回合', 5: '5 回合', 1: '1 局快战' },
  },
  'astro-blaster': {
    name: '星际战机',
    category: '太空激战',
    tagline: '驾驶飞船穿梭太空，击落所有对手！',
    description: '躲避漂浮的陨石，拾取护盾和加速道具，在倒计时结束前拿下最高击杀分。',
    playerModeLabel: '2人 · 3–8人',
    rules: [
      '用摇杆控制飞船飞行并瞄准方向。',
      '按住「开火 (A)」向其他飞船发射激光。',
      '按「加速 (B)」瞬间疾飞躲避敌方子弹。',
      '拾取发光道具强化战力——得分最高者获胜！',
    ],
    joystickLabel: '飞行与瞄准',
    actionALabel: '开火',
    actionASublabel: '发射激光',
    actionBLabel: '加速',
    actionBSublabel: '极速闪避',
    controlTip: '躲在陨石后面掩护，关键时刻按加速甩开激光！',
    settingLabel: '比赛时长',
    settingOptions: { 60: '60 秒', 75: '75 秒', 90: '90 秒', 120: '120 秒' },
  },
  'turbo-drift': {
    name: '极速漂移',
    category: '赛车竞速',
    tagline: '弯道漂移积攒氮气，冲过加速带夺冠！',
    description: '最多支持 8 人的俯视角狂飙赛车。过弯漂移积满氮气，直道爆发冲刺第一个冲线。',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '沿赛道方向推动摇杆即可自动行驶和转向。',
      '过弯时按住「漂移 (B)」丝滑过弯并充能氮气。',
      '在直道按「氮气 (A)」开启超级加速冲刺。',
      '最先跑完所有圈数的玩家赢得冠军！',
    ],
    joystickLabel: '驾驶转向',
    actionALabel: '氮气',
    actionASublabel: '极速爆发',
    actionBLabel: '漂移',
    actionBSublabel: '急弯充能',
    controlTip: '压过赛道上的黄色箭头，可以免费获得加速！',
    settingLabel: '比赛圈数',
    settingOptions: { 3: '3 圈', 5: '5 圈', 2: '2 圈快赛' },
  },
  'hex-drop': {
    name: '蜂巢坠落',
    category: '地板生存',
    tagline: '别停下——踩过的每块地板都会立刻掉落！',
    description: '在脚下不断崩塌的蜂巢地板上狂奔！跳过空洞、推开对手，成为最后站立的人。',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '保持奔跑！你踩过的每一块六角砖很快就会消失。',
      '按「跳跃 (A)」飞跃脚下的大洞。',
      '按「推人 (B)」把旁边的对手撞下深渊。',
      '最后没有掉落的玩家赢得本回合！',
    ],
    joystickLabel: '奔跑',
    actionALabel: '跳跃',
    actionASublabel: '跨越缺口',
    actionBLabel: '推人',
    actionBSublabel: '撞开对手',
    controlTip: '留好跳跃冷却，专门用来越过宽大的空洞！',
    settingLabel: '回合数',
    settingOptions: { 3: '3 回合', 5: '5 回合', 1: '1 局快战' },
  },
  'fuse-pass': {
    name: '炸弹传递',
    category: '烫手山芋',
    tagline: '在炸弹爆炸前，赶紧把它传给别人！',
    description: '每局一名玩家持有发光炸弹。加速追逐、拍肩传给别人，坚持活到最后就是赢家！',
    playerModeLabel: '3–8人派对',
    rules: [
      '一名玩家手持定时炸弹——拿炸弹的人跑得会更快一点。',
      '撞到其他玩家或按「传弹 (B)」把炸弹甩给对方。',
      '按「疾跑 (A)」加速逃命并绕着柱子躲藏。',
      '倒计时归零炸弹引爆——活到最后的人获胜！',
    ],
    joystickLabel: '奔跑走位',
    actionALabel: '疾跑',
    actionASublabel: '瞬间提速',
    actionBLabel: '传弹',
    actionBSublabel: '快速甩出',
    controlTip: '靠近对手时立刻按传弹，瞬间把炸弹塞给对方！',
    settingLabel: '回合数',
    settingOptions: { 3: '3 回合', 5: '5 回合', 1: '1 局快战' },
  },
  'grid-runners': {
    name: '霓虹光轮',
    category: '光迹摩托',
    tagline: '留下发光尾迹围堵对手，绝不撞墙！',
    description: '驾驶永不停歇的霓虹摩托。抢先切线封住好友去路，被困时还能一跃翻墙逃生！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '用摇杆控制摩托转向——车辆会自动持续前进。',
      '千万不要撞上任何发光光墙或场地边界！',
      '按「加速 (A)」抢先超车，切线拦截其他玩家。',
      '被围死时按「跃墙 (B)」直接飞跃光墙逃出生天！',
    ],
    joystickLabel: '控制转向',
    actionALabel: '加速',
    actionASublabel: '极速超车',
    actionBLabel: '跃墙',
    actionBSublabel: '翻越光墙',
    controlTip: '被困在死胡同里？按跃墙直接跳过发光轨迹！',
    settingLabel: '回合数',
    settingOptions: { 3: '3 回合', 5: '5 回合', 1: '1 局快战' },
  },
  'ricochet-tanks': {
    name: '弹射坦克',
    category: '坦克迷宫',
    tagline: '炮弹碰墙会反弹，还能埋下隐藏地雷！',
    description: '在迷宫墙壁间驾驶迷你坦克。利用墙壁反弹精准打击躲在转角后的对手！',
    playerModeLabel: '2人 · 3–8人',
    rules: [
      '用摇杆驾驶坦克并瞄准炮口方向。',
      '按「炮弹 (A)」开火——炮弹碰到墙壁会自动反弹！',
      '按「地雷 (B)」在身后埋下一颗隐蔽炸弹。',
      '时间结束时积分最高的玩家获胜！',
    ],
    joystickLabel: '驾驶与瞄准',
    actionALabel: '炮弹',
    actionASublabel: '反弹射击',
    actionBLabel: '地雷',
    actionBSublabel: '布雷伏击',
    controlTip: '用墙壁反弹炮弹击中对手，可获得额外高分奖励！',
    settingLabel: '比赛时长',
    settingOptions: { 60: '60 秒', 90: '90 秒', 120: '120 秒' },
  },
  'turbo-striker': {
    name: '爆裂足球',
    category: '团队足球',
    tagline: '快节奏街机足球，爆射破门加滑铲抢断！',
    description: '自动分为红蓝两队！把球踢进对方球门，用滑铲抢断对手的进攻，赢下比赛！',
    playerModeLabel: '2人 · 3–8人',
    rules: [
      '红队攻打右侧球门，蓝队攻打左侧球门。',
      '跑向足球即可带球前进。',
      '靠近足球按「射门 (A)」轰出超级大力射门！',
      '按「铲球 (B)」向前突进抢断对手脚下的球！',
    ],
    joystickLabel: '奔跑与瞄准',
    actionALabel: '射门',
    actionASublabel: '大力爆射',
    actionBLabel: '铲球',
    actionBSublabel: '极速抢断',
    controlTip: '先绕到足球后方对准球门，再按射门精准破门！',
    settingLabel: '比赛时长',
    settingOptions: { 60: '60 秒', 90: '90 秒', 120: '120 秒' },
  },
  'paint-rush': {
    name: '涂色狂潮',
    category: '地盘涂色',
    tagline: '尽情奔跑，把整个场地涂成你的颜色！',
    description: '滚过地板涂上专属色彩，覆盖对手的领地。倒计时归零时占领面积最大的人获胜！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '到处奔跑即可将地板涂成你的颜色。',
      '你可以直接覆盖其他玩家涂过的颜色！',
      '按「泼墨 (A)」在周围炸开一大片颜料炸弹。',
      '按「滑行 (B)」极速冲刺——结束时面积最大者获胜！',
    ],
    joystickLabel: '涂色移动',
    actionALabel: '泼墨',
    actionASublabel: '颜料炸弹',
    actionBLabel: '滑行',
    actionBSublabel: '极速冲刺',
    controlTip: '倒计时最后几秒放一发泼墨，瞬间反超抢占大片领地！',
    settingLabel: '比赛时长',
    settingOptions: { 45: '45 秒', 60: '60 秒', 90: '90 秒' },
  },
  'laser-gauntlet': {
    name: '激光试炼',
    category: '激光闪避',
    tagline: '躲避旋转 Boss 激光，疯狂收集金色星星！',
    description: '巨型机械核心会发射预警激光与能量环。瞬移穿过光束、连击摘星冲击高分！',
    playerModeLabel: '单人 · 1P挑战',
    rules: [
      '看到高亮预警线后迅速闪开，激光马上就会发射！',
      '收集金色星星可以叠加连击高分。',
      '按「闪现 (A)」无敌瞬移，直接穿过激光束！',
      '按「电磁 (B)」让 Boss 减速并清除附近危险光球！',
    ],
    joystickLabel: '移动闪避',
    actionALabel: '闪现',
    actionASublabel: '无敌穿光',
    actionBLabel: '电磁',
    actionBSublabel: '减速清场',
    controlTip: '激光发射前总会先出现细预警线——看准时机闪现穿过去！',
    settingLabel: '挑战时长',
    settingOptions: { 60: '60 秒', 75: '75 秒', 90: '90 秒' },
  },
  'vault-heist': {
    name: '金库大劫案',
    category: '夺宝潜行',
    tagline: '穿越陷阱收集绿宝石，带回中央传送门得分！',
    description: '绕过地刺、激光与巡逻无人机抢夺发光宝石。一次带回多颗宝石可赢取翻倍大奖！',
    playerModeLabel: '单人 · 2人夺宝',
    rules: [
      '拾取绿色宝石并搬运回场地中央的发光圆阵。',
      '一次携带多颗宝石送回，可获得超高连携加分！',
      '按「疾冲 (A)」快速冲过陷阱区域。',
      '按「黑客 (B)」暂时瘫痪周围的地刺、激光和无人机！',
    ],
    joystickLabel: '潜行奔跑',
    actionALabel: '疾冲',
    actionASublabel: '快速突进',
    actionBLabel: '黑客',
    actionBSublabel: '关闭陷阱',
    controlTip: '穿过激光前先按黑客，直接让激光和警卫停机！',
    settingLabel: '游戏时长',
    settingOptions: { 60: '60 秒', 75: '75 秒', 90: '90 秒' },
  },
  'hyper-pong': {
    name: '霓虹冰球',
    category: '桌上冰球',
    tagline: '超级重击加磁力弧线球，畅爽 1v1 对决！',
    description: '在己方半场自由移动球拍，用超高速扣杀和弧线回拉将发光冰球打入对方球门！',
    playerModeLabel: '双人对决 (1v1)',
    rules: [
      '在己方半场内自由移动你的球拍。',
      '击球瞬间按「重击 (A)」打出超高速暴扣！',
      '按「弧线 (B)」磁力拉回冰球并打出诡异弧线。',
      '率先达到目标进球数的玩家赢得胜利！',
    ],
    joystickLabel: '移动球拍',
    actionALabel: '重击',
    actionASublabel: '极速扣杀',
    actionBLabel: '弧线',
    actionBSublabel: '磁力拉球',
    controlTip: '利用两侧发光弹板反弹冰球，打出刁钻进球！',
    settingLabel: '获胜球数',
    settingOptions: { 5: '先到 5 球', 7: '先到 7 球', 9: '先到 9 球' },
  },
  'blade-duel': {
    name: '光刃对决',
    category: '一击必杀',
    tagline: '一剑定胜负——极速拔刀斩，或格挡反杀！',
    description: '霓虹道场 1v1 剑术决斗！一记利落斩击即刻取胜，精准格挡还能震晕对手反击！',
    playerModeLabel: '双人对决 (1v1)',
    rules: [
      '用摇杆瞄准方向，按「斩击 (A)」向前突刺挥剑。',
      '对手出剑时按「格挡 (B)」完美弹反并震晕对方！',
      '技能冷却时可以躲在道场石柱后方周旋。',
      '最先赢下目标回合数的剑客获得最终胜利！',
    ],
    joystickLabel: '走位瞄准',
    actionALabel: '斩击',
    actionASublabel: '拔刀突刺',
    actionBLabel: '格挡',
    actionBSublabel: '弹反震晕',
    controlTip: '等对手冲刺扑来时按下格挡，趁他眩晕一剑制胜！',
    settingLabel: '获胜回合',
    settingOptions: { 3: '先胜 3 局', 5: '先胜 5 局', 7: '先胜 7 局' },
  },
  'cannon-siege': {
    name: '攻城炮战',
    category: '城堡攻防',
    tagline: '轰穿对手城墙，摧毁敌方发光核心！',
    description: '上下滑动战炮，轰碎对手的护城砖墙，还能举盾把飞来的炮弹直接弹回去！',
    playerModeLabel: '双人对决 (1v1)',
    rules: [
      '上下推动摇杆移动战炮并调整炮口角度。',
      '按「开炮 (A)」发射炮弹击碎敌方城墙砖块。',
      '按「护盾 (B)」把飞来的炮弹直接反弹给对手！',
      '率先击破敌方核心（或时间到时血量更高）即可获胜！',
    ],
    joystickLabel: '移动瞄准',
    actionALabel: '开炮',
    actionASublabel: '发射炮弹',
    actionBLabel: '护盾',
    actionBSublabel: '反弹炮弹',
    controlTip: '持续轰击同一块城墙，打通一条直指核心的通道！',
    settingLabel: '游戏时长',
    settingOptions: { 60: '60 秒', 75: '75 秒', 90: '90 秒' },
  },
  'crown-heist': {
    name: '皇冠争夺战',
    category: '抢夺守擂',
    tagline: '抢到金皇冠并死守到底，每秒狂涨积分！',
    description: '场地中央放着一顶闪耀皇冠。戴上它就能每秒加分，但全场玩家都会追着你来抢！',
    playerModeLabel: '3–8人派对',
    rules: [
      '跑过去碰到金皇冠即可戴上，每秒持续获得积分。',
      '撞向或按「抢夺 (A)」冲刺扑向皇冠持有者即可抢走！',
      '按「弹开 (B)」把身后的追兵统统推远。',
      '倒计时结束时积分最高的玩家登基获胜！',
    ],
    joystickLabel: '奔跑转向',
    actionALabel: '抢夺',
    actionASublabel: '突进抢冠',
    actionBLabel: '弹开',
    actionBSublabel: '震飞追兵',
    controlTip: '戴上皇冠后绕着弹柱走位，让追兵扑个空！',
    settingLabel: '比赛时长',
    settingOptions: { 45: '45 秒', 60: '60 秒', 90: '90 秒' },
  },
  'freeze-tag': {
    name: '冰冻大作战',
    category: '冰上追逐',
    tagline: '躲避冰霜猎手，触碰被冻住的队友就能解救！',
    description: '一名冰霜猎手负责把所有人冻成冰块；逃生者可以滑过去碰一下队友瞬间解冻！',
    playerModeLabel: '3–8人派对',
    rules: [
      '猎手：碰到逃生者或发射「冰箭 (A)」将他们冻成冰块。',
      '逃生者：滑过去触碰被冰冻的队友就能解救并拿高分！',
      '按「技能 (B)」释放冰霜陷阱（猎手）或滑步逃脱（逃生者）。',
      '猎手冻住所有人即胜；时间到还有逃生者自由则逃生者胜！',
    ],
    joystickLabel: '冰面滑行',
    actionALabel: '爆发',
    actionASublabel: '冰箭 / 疾跑',
    actionBLabel: '绝招',
    actionBSublabel: '陷阱 / 滑步',
    controlTip: '主动去解救被冻住的队友，能拿到超高奖励积分！',
    settingLabel: '单局时长',
    settingOptions: { 45: '45 秒', 60: '60 秒', 75: '75 秒' },
  },
  'ghost-hunt': {
    name: '捉鬼迷宫',
    category: '暗夜捉迷藏',
    tagline: '在黑暗中晃动手电筒，揪出潜伏的幽灵！',
    description: '一只狡猾的幽灵躲在暗黑迷宫里！猎人们用手电照出幽灵并用光网将其捕获。',
    playerModeLabel: '3–8人派对',
    rules: [
      '猎人：转动手电筒照出幽灵，再按「行动 (A)」发射光网！',
      '猎人：按「脉冲 (B)」发射雷达波，探测幽灵的藏身方向。',
      '幽灵：隐身在暗处，按 A 突袭猎人，按 B 闪现逃脱。',
      '抓到幽灵则猎人获胜；幽灵撑到 0:00 即大获全胜！',
    ],
    joystickLabel: '移动与照射',
    actionALabel: '行动',
    actionASublabel: '光网 / 突袭',
    actionBLabel: '脉冲',
    actionBSublabel: '雷达 / 闪现',
    controlTip: '猎人尽量结伴同行，别让幽灵从背后偷袭！',
    settingLabel: '追捕时长',
    settingOptions: { 60: '60 秒', 75: '75 秒', 90: '90 秒' },
  },
  'meteor-swarm': {
    name: '陨石防卫战',
    category: '合作守卫',
    tagline: '齐心协力守护能量核心，击碎来袭陨石！',
    description: '全员驾驶战机并肩作战，在陨石和外星飞碟撞毁中央能量核心前将它们全部击碎！',
    playerModeLabel: '单人 · 2人 · 多人合作',
    rules: [
      '击碎飞向中央能量核心的陨石和外星 UFO。',
      '按住「开火 (A)」连射激光；按「新星 (B)」震退靠近的陨石。',
      '如果队友被击落，飞到他身边就能立刻复活他！',
      '一起守住能量核心直到 0:00 就能共同获胜！',
    ],
    joystickLabel: '飞行瞄准',
    actionALabel: '开火',
    actionASublabel: '激光连射',
    actionBLabel: '新星',
    actionBSublabel: '护盾震退',
    controlTip: '大陨石会分裂成小石块——石头太多太近时快按新星震开！',
    settingLabel: '防守时长',
    settingOptions: { 60: '60 秒', 75: '75 秒', 90: '90 秒' },
  },
  'hook-shot': {
    name: '浮岛钩爪战',
    category: '天空浮岛',
    tagline: '发射钩爪，把对手从空中浮岛拽进深渊！',
    description: '在 5 座天空浮岛之间展开激战！隔空发射钩爪把对手拉进裂谷，或格挡反制！',
    playerModeLabel: '2人 · 3–8人',
    rules: [
      '用摇杆瞄准，按「钩爪 (A)」隔空射出抓钩。',
      '勾中对手后会把他笔直拉向你——直接拽下悬崖！',
      '按「格挡 (B)」扯断飞来的钩爪并震开身边的对手。',
      '每次击落对手得 +100 分——得分最高者获胜！',
    ],
    joystickLabel: '移动瞄准',
    actionALabel: '钩爪',
    actionASublabel: '隔空抓取',
    actionBLabel: '格挡',
    actionBSublabel: '断钩弹飞',
    controlTip: '站在另一座浮岛边缘出钩，能直接把对手拉进中间深坑！',
    settingLabel: '比赛时长',
    settingOptions: { 60: '60 秒', 75: '75 秒', 90: '90 秒' },
  },
  'gravity-flip': {
    name: '重力翻转',
    category: '极速跑酷',
    tagline: '在地板和天花板间上下翻转，躲避旋转锯齿！',
    description: '在充满锯齿、激光门和金币的霓虹隧道中极速狂奔！一键翻转重力避开所有障碍！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '按「翻转 (A)」瞬间在地板和天花板之间上下切换！',
      '左右推摇杆微调位置，躲避障碍并狂吃金币。',
      '按「穿行 (B)」化作虚影，无伤穿过锯齿和激光！',
      '别被障碍挤出屏幕左侧——得分最高者获胜！',
    ],
    joystickLabel: '左右微调',
    actionALabel: '翻转',
    actionASublabel: '天地切换',
    actionBLabel: '穿行',
    actionBSublabel: '虚影无敌',
    controlTip: '上下同时被封路？立刻按穿行直接无伤穿过去！',
    settingLabel: '奔跑时长',
    settingOptions: { 45: '45 秒', 60: '60 秒', 90: '90 秒' },
  },
  'rich-street': {
    name: '富豪大街',
    category: '大富翁棋盘',
    tagline: '掷骰子买商铺、建黄金高塔、狂收过路费！',
    description: '快节奏大富翁城市棋盘！轮流掷骰子绕 24 格热闹街区前进，购买并升级商铺，成为全场首富。',
    playerModeLabel: '2人 · 3–8人棋盘',
    rules: [
      '轮到你时，按「掷骰 / 购买 (A)」掷出骰子在城市棋盘前进。',
      '走到空商铺？按 A 立即买下，或按 B 跳过保留现金。',
      '走到自己的商铺可升级建筑——对手路过要付超高租金！',
      '幸运能量满格时，掷骰前按 B 可触发免租护盾和奖金！',
    ],
    joystickLabel: '棋盘视角',
    actionALabel: '掷骰/买',
    actionASublabel: '前进建楼',
    actionBLabel: '跳过/幸运',
    actionBSublabel: '放弃或护盾',
    controlTip: '前期多买地并升级商铺，最终总资产最高者赢得冠军！',
    settingLabel: '游戏回合',
    settingOptions: { 6: '6 回合', 8: '8 回合', 10: '10 回合', 14: '14 回合' },
  },
  'jungle-ladders': {
    name: '丛林蛇梯棋',
    category: '蛇梯棋盘',
    tagline: '爬上巨型竹梯一路飙升，小心躲开调皮丛林蛇！',
    description: '经典 1 到 100 格蛇梯大冒险！结合能量条掷骰子、神秘问号格和香蕉皮陷阱，最先到达终点获胜！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '轮到你时，看准能量条按「掷骰 (A)」决定步数向前跳。',
      '踩到竹梯底部，直接顺着梯子大幅爬升！',
      '小心别踩到蛇头——不然会一路滑回下方！',
      '踩中蓝色问号格可充能「妙计 (B)」：骰子+2 并在身后丢香蕉皮！',
    ],
    joystickLabel: '准备掷骰',
    actionALabel: '掷骰',
    actionASublabel: '定格点数',
    actionBLabel: '妙计',
    actionBSublabel: '+2与香蕉',
    controlTip: '等能量条涨到绿色高处时按下掷骰，更容易掷出大点数！',
    settingLabel: '终点格数',
    settingOptions: { 50: '50 格（快赛）', 100: '100 格（经典）' },
  },
  'bomb-grid': {
    name: '炸弹迷宫',
    category: '爆破派对',
    tagline: '炸开木箱抢强化道具，还能一脚把炸弹踢出去！',
    description: '经典炸弹人迷宫大作战！放下炸弹炸开木箱收集火焰和加速道具，把对手困在转角！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '在迷宫中奔跑，按「放弹 (A)」在脚下放置定时炸弹。',
      '放完炸弹记得立刻躲进侧边通道，避开十字火焰！',
      '炸碎木箱收集更大火焰、更多炸弹和极速道具。',
      '靠近炸弹按「踢弹 (B)」，直接把炸弹顺着走廊踢飞！',
    ],
    joystickLabel: '迷宫奔跑',
    actionALabel: '放弹',
    actionASublabel: '放置炸弹',
    actionBLabel: '踢弹',
    actionBSublabel: '踢飞炸弹',
    controlTip: '放下炸弹后立刻拐进旁边的安全通道！',
    settingLabel: '回合数',
    settingOptions: { 3: '3 回合', 5: '5 回合', 1: '1 局快战' },
  },
  'red-light-dash': {
    name: '红绿灯冲刺',
    category: '木头人竞速',
    tagline: '绿灯全力狂奔——红灯一亮立刻定格不动！',
    description: '向终点的红绿灯机器人全力冲刺！绿灯狂跑、黄灯急刹、红灯一动就会被激光打回起点！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '绿灯亮起时，向右推动摇杆全力冲向终点线。',
      '黄灯代表准备刹车——务必在变红灯前松开摇杆！',
      '红灯时乱动会被激光打退，除非提前开了「护盾 (B)」！',
      '绿灯时按「冲刺 (A)」触发爆发加速甩开所有人！',
    ],
    joystickLabel: '奔跑急停',
    actionALabel: '冲刺',
    actionASublabel: '极速爆发',
    actionBLabel: '护盾',
    actionBSublabel: '抵挡激光',
    controlTip: '一看到黄灯立刻松手停步，稳稳冲线最保险！',
    settingLabel: '比赛局数',
    settingOptions: { 3: '3 局竞速', 5: '5 局竞速', 1: '1 局快赛' },
  },
  'color-match': {
    name: '色彩记忆舞池',
    category: '记忆地板',
    tagline: '看准目标颜色和图案，在地板掉落前冲上去！',
    description: '记下顶部播报的目标颜色与符号，在倒计时结束前抢占安全舞砖，还能把好友挤下去！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '看清顶部大牌子提示的目标「颜色 + 图案」。',
      '在倒计时归零前站到对应舞砖上——其他地板会瞬间掉落！',
      '按「跳跃 (A)」灵活越过空洞或其他玩家。',
      '按「推挤 (B)」把对手撞下最后的安全地板！',
    ],
    joystickLabel: '舞池奔跑',
    actionALabel: '跳跃',
    actionASublabel: '快速跃起',
    actionBLabel: '推挤',
    actionBSublabel: '撞开对手',
    controlTip: '每波倒计时都会变快——平时待在舞池中央最容易抢位！',
    settingLabel: '挑战波次',
    settingOptions: { 6: '6 波', 8: '8 波', 10: '10 波' },
  },
  'kitchen-rush': {
    name: '疯狂厨房',
    category: '料理派对',
    tagline: '拿食材、上烤炉、把香喷喷的美食直接甩上餐台！',
    description: '汉堡、披萨、玉米卷订单源源不断！抢拿新鲜食材快速烤熟，把热腾腾的餐盘抛上出餐台赢高分！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '看顶部订单需求（汉堡、披萨或玉米卷）。',
      '走到左侧对应食材箱，按「烹饪 (A)」拿取生食材。',
      '到中间烤炉按「烹饪 (A)」快速烤熟，烤好后再按 A 端起！',
      '送到右侧出餐台按 A 上菜——或者按「抛盘 (B)」直接飞盘上菜！',
    ],
    joystickLabel: '厨房奔跑',
    actionALabel: '烹饪',
    actionASublabel: '拿取/上菜',
    actionBLabel: '抛盘',
    actionBSublabel: '冲刺/甩盘',
    controlTip: '端着熟食面向右侧出餐台直接按抛盘，省下跑路时间狂刷分！',
    settingLabel: '营业时长',
    settingOptions: { 60: '60 秒', 75: '75 秒', 80: '80 秒', 90: '90 秒', 120: '120 秒' },
  },
  'treasure-dig': {
    name: '海岛寻宝挖矿',
    category: '雷达寻宝',
    tagline: '跟着冷热雷达光环找宝藏，一铲挖出黄金海盗箱！',
    description: '在阳光海滩上搜索埋藏的宝箱！越靠近黄金，光环越亮越烫，小心躲开红螃蟹！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '在海滩上走动——离宝藏越近，脚下光环越红越亮！',
      '光环发烫时按「挖掘 (A)」挖出金币、宝石或皇冠！',
      '按「雷达 (B)」发射声呐直接显形附近 X 标记，还能震晕红螃蟹！',
      '时间结束时挖到宝藏总价值最高者获胜！',
    ],
    joystickLabel: '海滩搜索',
    actionALabel: '挖掘',
    actionASublabel: '挖出宝箱',
    actionBLabel: '雷达',
    actionBSublabel: '扫描晕蟹',
    controlTip: '光环变暖时开一次雷达，直接看清红叉位置精准开挖！',
    settingLabel: '寻宝时长',
    settingOptions: { 60: '60 秒', 75: '75 秒', 90: '90 秒' },
  },
  'fruit-drop': {
    name: '水果大接龙',
    category: '高空接果',
    tagline: '接住漫天飞落的水果和彩虹星，把炸弹扇飞！',
    description: '菠萝、西瓜、彩虹星从天而降！连击接果冲上 5 倍高分，顺手把刺球炸弹弹飞保护连击！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '左右推摇杆移动果篮，接住天上掉下来的新鲜水果。',
      '连续接中水果可叠加最高 5 倍连击得分！',
      '按「冲刺 (A)」飞扑抢接高分彩虹星星。',
      '躲开刺球炸弹——或者按「反弹 (B)」直接把炸弹拍飞得分！',
    ],
    joystickLabel: '移动果篮',
    actionALabel: '冲刺',
    actionASublabel: '飞扑抢星',
    actionBLabel: '反弹',
    actionBSublabel: '拍飞炸弹',
    controlTip: '保住 5 倍连击最重要，看到炸弹赶紧按反弹拍飞！',
    settingLabel: '比赛时长',
    settingOptions: { 45: '45 秒', 60: '60 秒', 90: '90 秒' },
  },
  'lucky-auction': {
    name: '幸运大拍卖',
    category: '盲盒竞拍',
    tagline: '细读线索抢拍神秘宝箱，千万别高价买到小黄鸭！',
    description: '神秘宝箱轮番登上拍卖舞台！根据线索叫价抢夺钻石与皇冠，或果断放弃避免冤大头买到搞笑橡皮鸭！',
    playerModeLabel: '2人 · 3–8人竞拍',
    rules: [
      '阅读舞台上的神秘线索，猜猜箱子里是天价宝石还是小黄鸭！',
      '左右推摇杆调节出价，按「出价 (A)」举牌压过对手！',
      '觉得太贵就按「放弃 (B)」保住现金，等下一个更好的宝箱。',
      '全部拍完后，剩余现金 + 宝藏总价值最高者获胜！',
    ],
    joystickLabel: '调节报价',
    actionALabel: '出价',
    actionASublabel: '举牌加价',
    actionBLabel: '放弃',
    actionBSublabel: '本轮观望',
    controlTip: '直接快速按出价 (A) 即可自动比当前最高价多加 $50！',
    settingLabel: '拍卖轮数',
    settingOptions: { 5: '5 个宝箱', 6: '6 个宝箱', 7: '7 个宝箱', 9: '9 个宝箱' },
  },
  'pinball-clash': {
    name: '弹珠对决',
    category: '双人弹珠',
    tagline: '双人同台机械弹珠对轰，触发黄金双球狂飙！',
    description: '在霓虹弹珠台上 1v1 激情对决！滑动机械弹板大力抽射银球，撞满中央弹柱召唤黄金多球！',
    playerModeLabel: '双人对战 (1v1)',
    rules: [
      '上下推动摇杆，沿球门滑动你的机械弹板。',
      '弹珠贴近瞬间按「弹射 (A)」轰出超高速暴击球！',
      '按「震波 (B)」释放磁力波弹开高速来球。',
      '撞击中央发光弹柱充能黄金双球——先达目标进球数获胜！',
    ],
    joystickLabel: '滑动弹板',
    actionALabel: '弹射',
    actionASublabel: '强力抽球',
    actionBLabel: '震波',
    actionBSublabel: '磁力弹开',
    controlTip: '算准弹珠撞板瞬间按弹射，能打出极速角度球！',
    settingLabel: '获胜进球',
    settingOptions: { 5: '先得 5 球', 7: '先得 7 球', 9: '先得 9 球' },
  },
  'color-clash': {
    name: '变色狂潮',
    category: '派对卡牌',
    tagline: '颜色数字精准接龙，连环 +2/+4 甩光手牌！',
    description: '每部手机都是专属私密手牌！匹配中央牌面的颜色或符号，用反转、跳过和加牌炸弹轰炸好友，15 秒倒计时内先出完手牌即获胜。',
    playerModeLabel: '2人 · 3–8人卡牌',
    rules: [
      '私密手牌只显示在你的手机上——直接点击高亮卡牌（或摇杆 + A）出牌！',
      '每回合限时 15 秒：超时未出牌将自动跳过并移交下一位玩家。',
      '打出 +2 或变色 +4 可叠加罚抽张数，或自由指定桌面新颜色！',
      '最先出光手牌的玩家立刻赢得本局胜利！',
    ],
    joystickLabel: '选牌',
    actionALabel: '出牌',
    actionASublabel: '打出此牌',
    actionBLabel: '摸牌',
    actionBSublabel: '摸牌/跳过',
    controlTip: '直接点按手机屏幕上的发光手牌，即可极速飞牌上桌！',
    settingLabel: '初始手牌',
    settingOptions: { 5: '5 张（快节奏）', 7: '7 张（经典）', 9: '9 张（持久战）' },
  },
  'liars-deck': {
    name: '欺诈牌局',
    category: '心理吹牛牌',
    tagline: '暗牌盲出强装镇定，抓出桌上的超级大骗子！',
    description: '每位玩家只能在手机查看自己的底牌！轮流朝牌桌扣出 1–3 张暗牌并声称符合桌面目标点数，随时拍下「抓谎」大屏开牌揭穿真相！',
    playerModeLabel: '2人 · 3–8人欺诈',
    rules: [
      '留意大屏桌面目标点数（如 A 或 K）——小丑牌 JOKER 永远算作万能真牌！',
      '轮到你时有 15 秒选择 1–3 张卡牌扣牌出击（说真话或偷梁换柱都行）。',
      '出牌后对手可点击「抓谎！」——说谎者将吞下桌面全部牌堆！',
      '若对方出的是真牌，质疑者吞下全部牌堆！先清空手牌者夺冠！',
    ],
    joystickLabel: '挑牌',
    actionALabel: '出牌',
    actionASublabel: '出牌/信任',
    actionBLabel: '抓谎!',
    actionBSublabel: '选牌/质疑',
    controlTip: '守住表情！你可以一口气扣出最多 3 张牌冒充桌面目标牌。',
    settingLabel: '初始手牌',
    settingOptions: { 4: '4 张（快局）', 5: '5 张（标准）', 6: '6 张（高赌注）' },
  },
  'volley-smash': {
    name: '霓虹排球',
    category: '沙滩排球',
    tagline: '垫球传球配合，跃起轰出烈焰扣杀！',
    description: '红蓝两队沙滩排球激战！紧盯沙地落点光圈，高抛垫球助攻队友，跃至网前轰出势不可挡的烈焰暴扣！',
    playerModeLabel: '2人 · 3–8人团队',
    rules: [
      '红队镇守左侧球场，蓝队镇守右侧球场。',
      '移动到发光落点光圈下方，在排球落地前将球救起！',
      '按「垫球 (A)」将排球高高托过球网或传给队友。',
      '贴近排球按「暴扣 (B)」腾空跃起，朝对方半场轰出烈焰重扣！',
    ],
    joystickLabel: '移动与瞄准',
    actionALabel: '垫球',
    actionASublabel: '高吊过网',
    actionBLabel: '暴扣',
    actionBSublabel: '腾空重扣',
    controlTip: '盯紧沙地上的脉冲光圈，提前站位即可稳稳接住来球！',
    settingLabel: '获胜分数',
    settingOptions: { 5: '先得 5 分', 7: '先得 7 分', 9: '先得 9 分' },
  },
  'lava-hopper': {
    name: '熔岩跳台',
    category: '火山求生',
    tagline: '在不断下沉的火山石柱间飞跃，震波把对手震入岩浆！',
    description: '玄武岩石柱随时会闪烁警报并沉入滚烫岩浆！飞跃岩浆裂隙、抢夺火焰宝石，落地释放震波把对手震落石台！',
    playerModeLabel: '单人 · 2人 · 3–8人',
    rules: [
      '留在稳固的石柱上——闪烁红光的石柱即将沉入岩浆！',
      '推摇杆瞄准并按「飞跃 (A)」跨过岩浆跳上安全石柱。',
      '拾取石柱上的火焰宝石可获 +60 额外积分。',
      '按「震地 (B)」释放强力冲击波，把身旁的对手震向岩浆边缘！',
    ],
    joystickLabel: '移动与起跳方向',
    actionALabel: '飞跃',
    actionASublabel: '跨跳岩浆',
    actionBLabel: '震地',
    actionBSublabel: '冲击推人',
    controlTip: '脚下石柱一旦闪红立刻按飞跃跳走，抢吃金色宝石拿高分！',
    settingLabel: '比赛时长',
    settingOptions: { 45: '45 秒', 60: '60 秒', 90: '90 秒' },
  },
  'ludo-royale': {
    name: '皇家飞行棋',
    category: '飞行棋盘',
    tagline: '率领三枚棋子环游星光赛道，踩回对手冲向终点！',
    description: '经典飞行棋派对加强版！掷骰率领 3 枚棋子沿 28 格星光环道冲向本方终点，踩中普通格上的对手将其遣返基地，停在金星安全格稳步推进！',
    playerModeLabel: '2人 · 3–8人桌游',
    rules: [
      '轮到你时，按「掷骰 (A)」投出骰子并推进当前选中的棋子。',
      '掷骰前按「换子/+2 (B)」可切换要移动的棋子（或激活 +2 星光加速！）。',
      '精准落在普通格上的对手棋子上，可将其踩回起点并赢取 +80 分！',
      '金星格为安全区——率先将 3 枚棋子送达终点（或总分最高）获胜！',
    ],
    joystickLabel: '选择棋子',
    actionALabel: '掷骰',
    actionASublabel: '掷骰前进',
    actionBLabel: '换子/+2',
    actionBSublabel: '切换棋子 · 加速',
    controlTip: '掷骰前按 B 可在你的 3 枚棋子间切换，或开启 +2 步冲刺！',
    settingLabel: '对局轮数',
    settingOptions: { 6: '6 回合', 8: '8 回合', 12: '12 回合' },
  },
  'star-party-board': {
    name: '星光派对岛',
    category: '海岛星盘',
    tagline: '环游热带海岛收集金币，抢先前往星坛兑换金星！',
    description: '马里奥派对风海岛桌游！跳跃金币格、幸运宝箱与决斗格积累金币；路过闪耀的黄金星坛时，花费 20 金币即可夺取金星！',
    playerModeLabel: '单人 · 2人 · 3–8人桌游',
    rules: [
      '轮到你时，按「敲击骰子 (A)」沿 20 格海岛环道前进。',
      '携带 20+ 金币路过或停在黄金星坛时，将自动购买一颗金星！',
      '每颗金星被买走后，黄金星坛会随机传送到海岛的新位置。',
      '拥有 10+ 金币时，掷骰前按「双倍糖果 (B)」可在本回合投出双倍步数！',
    ],
    joystickLabel: '海岛视野',
    actionALabel: '敲击骰子',
    actionASublabel: '掷骰前进',
    actionBLabel: '双倍糖果',
    actionBSublabel: '双倍步数 (10币)',
    controlTip: '存够 20 金币直奔黄金星坛——离星坛很近时按 B 开启双倍步数抢星！',
    settingLabel: '回合数',
    settingOptions: { 6: '6 回合', 8: '8 回合', 10: '10 回合' },
  },
  'reversi-clash': {
    name: '翻转黑白棋',
    category: '策略翻转棋',
    tagline: '夹击对手棋子，一招翻转整排能量圆盘！',
    description: '支持 2 至 8 人的 8×8 战术翻转棋！落子夹住横、竖、斜线上的对手棋子，瞬间将整条连线翻转为你的颜色。',
    playerModeLabel: '2人 · 3–8人桌游',
    rules: [
      '用摇杆在 8×8 棋盘上移动你的发光准星。',
      '高亮格子会显示可翻转的棋子数——按「落子 (A)」放下棋子并翻转！',
      '按「新星翻转 (B)」可在准星周围释放 3×3 十字强制翻转炸弹（每局 1 次）！',
      '占领四个角落格可获额外高额加分——最终棋子与积分最高者获胜！',
    ],
    joystickLabel: '移动准星',
    actionALabel: '落子',
    actionASublabel: '落子翻转',
    actionBLabel: '新星翻转',
    actionBSublabel: '3×3 十字翻转',
    controlTip: '棋盘四角永远不会被夹击翻转——一旦角落亮起请立刻抢占！',
    settingLabel: '总手数',
    settingOptions: { 16: '16 手（快局）', 24: '24 手（标准）', 32: '32 手（持久）' },
  },
  'four-in-a-row': {
    name: '四子连珠',
    category: '重力连珠棋',
    tagline: '左右滑动悬浮投币器，达成横竖斜四子连线！',
    description: '巨型 7×6 垂直霓虹重力棋架！将彩色圆盘投入立柱，率先连成横、竖或斜向 4 子即可斩获高分并触发消除连击！',
    playerModeLabel: '2人 · 3–8人桌游',
    rules: [
      '轮到你时，左右推摇杆将悬浮投币器对准第 1–7 列。',
      '按「投子 (A)」释放圆盘，圆盘会落入该列最底部的空位。',
      '在横、竖或斜向连成 4 枚同色棋子即可斩获 +150 连珠高分！',
      '按「重锤 (B)」投下粉碎铁砧，直接砸碎该列最上方的一枚对手棋子！',
    ],
    joystickLabel: '左右选列',
    actionALabel: '投子',
    actionASublabel: '落下棋子',
    actionBLabel: '重锤',
    actionBSublabel: '砸碎对手棋子',
    controlTip: '留意对手的 3 连线，果断投子或用重锤砸碎他们的决胜位！',
    settingLabel: '获胜连珠数',
    settingOptions: { 2: '先达成 2 次连珠', 3: '先达成 3 次连珠', 5: '先达成 5 次连珠' },
  },
  'naval-salvo': {
    name: '深海战舰',
    category: '雷达海战棋',
    tagline: '锁定神秘海域坐标，声呐探测击沉敌方黄金旗舰！',
    description: '8×6 战术雷达海战棋盘！移动准星锁定未知海域，发射鱼雷齐射揭开隐藏战列舰与黄金旗舰，小心避开深海鱼雷水雷！',
    playerModeLabel: '单人 · 2人 · 3–8人桌游',
    rules: [
      '轮到你时，用摇杆在 8×6 海洋雷达网格上移动瞄准准星。',
      '对准任何未揭开的海域按「开火 (A)」发射鱼雷轰击！',
      '命中战舰得 +90 分（命中黄金旗舰 +180 分）——误中深海水雷扣 35 分。',
      '按「声呐 (B)」扫描 3×3 海域，直接显示周围隐藏的舰船格数量！',
    ],
    joystickLabel: '瞄准雷达网格',
    actionALabel: '开火',
    actionASublabel: '鱼雷轰击',
    actionBLabel: '声呐',
    actionBSublabel: '扫描 3×3 海域',
    controlTip: '一旦命中战舰，立刻轰击它上下左右的相邻格——战舰都是连续排列的！',
    settingLabel: '齐射轮数',
    settingOptions: { 6: '6 回合', 8: '8 回合', 10: '10 回合' },
  },
  'neon-checkers': {
    name: '霓虹跳王棋',
    category: '跳棋桌游',
    tagline: '斜向飞跳过对手棋子，冲抵底线加冕无敌王棋！',
    description: '8×8 霓虹西洋跳棋！选择高亮跳跃路线越过并吃掉对手棋子，抵达对岸底线即可加冕黄金王棋，纵横四方无限跳吃！',
    playerModeLabel: '2人 · 3–8人桌游',
    rules: [
      '轮到你时，左右推摇杆在棋盘高亮显示的可行路线间切换。',
      '金色箭头代表可跳吃对手棋子——按「走子/跳吃 (A)」立即执行该路线！',
      '冲到对面底线即可加冕为「王棋 KING」，可向四个斜角方向自由进退跳吃！',
      '按「即时封王 (B)」可直接将当前棋子晋升为黄金王棋（每局 1 次）！',
    ],
    joystickLabel: '切换走子路线',
    actionALabel: '走子/跳吃',
    actionASublabel: '执行高亮路线',
    actionBLabel: '即时封王',
    actionBSublabel: '晋升黄金王棋',
    controlTip: '左右推摇杆预览棋盘上的发光箭头，优先选择金色跳吃路线拿高分！',
    settingLabel: '对局手数',
    settingOptions: { 16: '16 手（快局）', 24: '24 手（经典）', 32: '32 手（持久）' },
  },
  'carrom-arena': {
    name: '卡罗姆弹盘',
    category: '桌面弹指棋',
    tagline: '激光瞄准母球角度，一指弹射将红后打入四角球袋！',
    description: '经典实木卡罗姆桌面弹球棋！沿底线滑动母球并调节激光瞄准线，将银币、金币与高分红后撞入四个角落球袋！',
    playerModeLabel: '单人 · 2人 · 3–8人桌游',
    rules: [
      '轮到你时，左右推摇杆调整母球的激光瞄准角度。',
      '上下推摇杆可沿底线平移母球的发球位置。',
      '按「弹射 (A)」击出母球——打进银币 (+50)、金币 (+90) 或中心红后 (+180)！',
      '按「旋风重击 (B)」轰出超高速旋转母球，撞散中圈球堆！',
    ],
    joystickLabel: '平移与瞄准激光',
    actionALabel: '弹射',
    actionASublabel: '发射母球',
    actionBLabel: '旋风重击',
    actionBSublabel: '超强冲力球',
    controlTip: '瞄准中央红后周围的球堆大力弹射，一杆将多枚棋子撞入四角球袋！',
    settingLabel: '回合数',
    settingOptions: { 5: '5 回合', 6: '6 回合', 7: '7 回合', 10: '10 回合' },
  },
  'dungeon-crawl-board': {
    name: '地城勇者棋',
    category: '冒险棋盘',
    tagline: '掷骰探索螺旋地城，击败怪物挑战中央巨龙领主！',
    description: '桌面 RPG 冒险棋盘！掷骰穿梭怪物房间、黄金宝箱与营火，积攒攻击力与战利品，投出战斗骰子讨伐中央巨龙 Boss！',
    playerModeLabel: '单人 · 2人 · 3–8人桌游',
    rules: [
      '轮到你时，按「掷骰/出击 (A)」投出移动骰子沿螺旋地城前进。',
      '踏上怪物或巨龙 Boss 格时，按 A 投出战斗骰（骰点 + 攻击加成 vs 怪物战力）！',
      '宝箱格奖励金币与武器升级（+1 攻击）；营火格恢复全部生命红心。',
      '按「勇者药水 (B)」立即恢复 +2 红心，并在本回合获得 +3 战斗爆发力！',
    ],
    joystickLabel: '地城地图',
    actionALabel: '掷骰/出击',
    actionASublabel: '前进与战斗',
    actionBLabel: '勇者药水',
    actionBSublabel: '回血 +3 战力',
    controlTip: '把勇者药水 (B) 留到挑战高级怪物或中央巨龙领主时使用，一击赢取巨额赏金！',
    settingLabel: '冒险轮数',
    settingOptions: { 6: '6 回合', 8: '8 回合', 10: '10 回合' },
  },
  'boom-kittens': {
    name: '拆弹猫咪',
    category: '爆弹卡牌',
    tagline: '打出功能牌甩锅避开炸弹，关键时刻拆弹绝地求生！',
    description: '超刺激摸牌躲炸弹派对卡牌！用跳过、双倍攻击、透视未来、洗牌与讨债牌避开隐藏在牌堆里的炸弹，抽到炸弹没有拆弹牌即刻出局！',
    playerModeLabel: '2人 · 3–8人卡牌',
    rules: [
      '你的私密手牌显示在手机上。轮到你时点击发光功能牌即可打出。',
      '跳过可免摸牌，攻击×2 逼下家连摸两张，透视未来可偷看牌堆顶部是否有炸弹！',
      '出完功能牌后点击「结束回合并摸牌」从中央牌堆摸一张牌。',
      '摸到炸弹牌将自动消耗拆弹牌化险为夷，无拆弹牌则爆炸淘汰——最后幸存者获胜！',
    ],
    joystickLabel: '选择手牌',
    actionALabel: '打出功能牌',
    actionASublabel: '发动技能',
    actionBLabel: '摸牌结束',
    actionBSublabel: '抽取牌堆',
    controlTip: '牌堆越薄炸弹概率越高，把跳过和双倍攻击留到决赛圈甩给对手！',
    settingLabel: '炸弹烈度',
    settingOptions: { 1: '标准炸弹', 2: '双倍高危', 3: '极速爆裂' },
  },
  'property-deal': {
    name: '地产大亨牌',
    category: '地产交易牌',
    tagline: '每回合最多出 3 张牌：集齐同色地产、狂收租金、妙手窃地！',
    description: '快节奏大富翁交易卡牌！打出地产卡凑齐 3 张同色成套地产，存入现金防破产，发动收租、讨债与妙手窃地抢夺对手核心地块！',
    playerModeLabel: '单人 · 2人 · 3–8人卡牌',
    rules: [
      '每回合自动摸 2 张牌，最多可从手机手牌打出 3 张牌！',
      '点击地产牌建造同色地块（集齐 3 张同色 = 1 套完整地产），现金牌存入银行。',
      '功能牌：过起点 (+2牌)、收租金、讨债 ($5M)、妙手窃地（直接偷取对手一块地）！',
      '率先凑齐目标套数完整地产（或总资产最高）的大亨获胜！',
    ],
    joystickLabel: '选择手牌',
    actionALabel: '打出卡牌',
    actionASublabel: '每回合3张',
    actionBLabel: '结束回合',
    actionBSublabel: '轮到下家',
    controlTip: '先打过起点补牌扩大选择，再用妙手窃地补齐你的最后一块成套地产！',
    settingLabel: '获胜套数',
    settingOptions: { 2: '先凑齐 2 套地产', 3: '先凑齐 3 套地产' },
  },
  'flip-seven': {
    name: '七连翻牌',
    category: '搏命摸牌',
    tagline: '连翻不重复数字冲刺七连大奖，贪心抽到重复数字立刻爆牌！',
    description: '风靡桌游圈的搏命摸牌派对游戏！点击要牌翻开 0–12 数字牌、×2 倍率与免爆护盾，或者见好就收安全锁分——凑齐 7 张不重复数字直接斩获 +35 超级大奖！',
    playerModeLabel: '单人 · 2人 · 3–8人卡牌',
    rules: [
      '轮到你时，点击「要牌」继续翻开新牌，或点击「停牌锁分」安全存下本轮得分。',
      '每张不重复的数字牌 (0–12) 都会累加本轮积分——翻到重复数字立刻爆牌归零！',
      '免爆护盾可自动抵挡 1 次重复爆牌；×2 倍率卡让本轮总分直接翻倍！',
      '单轮集齐 7 张不重复数字立即触发「七连翻牌」+35 分超级大奖！',
    ],
    joystickLabel: '牌堆聚焦',
    actionALabel: '要牌搏命',
    actionASublabel: '翻开新牌',
    actionBLabel: '停牌锁分',
    actionBSublabel: '安全落袋',
    controlTip: '牌堆里大数字 (9–12) 张数更多、更容易重复，没护盾时记得见好就收！',
    settingLabel: '对局轮数',
    settingOptions: { 3: '3 轮', 4: '4 轮', 5: '5 轮' },
  },
  'royal-bluff': {
    name: '宫廷心机牌',
    category: '身份吹牛牌',
    tagline: '手握两张秘密身份牌，大胆假冒公爵刺客掠夺金币，敢不敢抓谎？',
    description: '经典政变风格身份推理吹牛卡牌！每人私密持有两张宫廷角色，可自由宣称任意角色发动技能，对手可选择信任或一键「抓谎」展开生死摊牌！',
    playerModeLabel: '2人 · 3–8人卡牌',
    rules: [
      '开局在手机上获得 2 张秘密宫廷身份牌与 2 枚金币。',
      '轮到你时可发动任意技能（即使手里没有该角色也能吹牛）：公爵+3金、船长偷2金、刺客3金暗杀、大使换牌，或安全领1金/7金政变！',
      '质疑窗口期，其他玩家可点击「抓谎！」——吹牛被抓失去 1 张身份，抓错则质疑者失去 1 张身份！',
      '最后保有秘密身份（或财富最高）的宫廷谋士获胜！',
    ],
    joystickLabel: '选择行动',
    actionALabel: '宣称发动',
    actionASublabel: '执行技能',
    actionBLabel: '抓谎质疑',
    actionBSublabel: '揭穿吹牛',
    controlTip: '前期假冒公爵狂拿 3 金币攒够 7 金，直接发动无法阻挡的皇家政变！',
    settingLabel: '初始金币',
    settingOptions: { 2: '经典 (2金币)', 4: '快节奏 (4金币)' },
  },
  'dark-flip-clash': {
    name: '暗面翻转牌',
    category: '双面色牌',
    tagline: '光明面畅快出牌，一张翻转牌瞬间把全场拖入狂暴暗黑面！',
    description: '双面翻转色彩卡牌大战！每张手牌都有光明面与暗黑面，打出「翻转 FLIP」即可令所有玩家手牌与桌面瞬间反转至暗黑面，释放 +5 罚抽与全员跳过！',
    playerModeLabel: '单人 · 2人 · 3–8人卡牌',
    rules: [
      '在手机上打出与中央弃牌同颜色或同数字/符号的手牌。',
      '随时打出「翻转 FLIP」牌，将全桌和所有人手牌在光明面与暗黑面之间瞬间切换！',
      '暗黑面藏着超强神牌：罚抽 +5、全员跳过（你立刻再出一回合）、暗黑万能 +3！',
      '率先清空手中所有手牌的玩家获胜！',
    ],
    joystickLabel: '选择手牌',
    actionALabel: '打出卡牌',
    actionASublabel: '同色或翻转',
    actionBLabel: '摸牌/罚抽',
    actionBSublabel: '抽取牌堆',
    controlTip: '手里留一张 FLIP 翻转牌，在对手快赢时瞬间切入暗黑面送他 +5 大礼！',
    settingLabel: '初始手牌',
    settingOptions: { 5: '5 张（极速）', 6: '6 张（标准）', 7: '7 张（经典）' },
  },
  'sushi-draft': {
    name: '回转寿司牌',
    category: '传牌轮抽',
    tagline: '全员同时挑 1 张寿司凑绝味套餐，翻开计分后把剩牌传给下家！',
    description: '零等待全员同步轮抽派对卡牌！所有人同时在手机上秘密挑选 1 张寿司，翻上大屏回转餐盘并把剩余手牌顺时针传递，凑出天妇罗、刺身与芥末三倍神仙连击！',
    playerModeLabel: '单人 · 2人 · 3–8人卡牌',
    rules: [
      '全员同步出牌零等待！在手机上点击 1 张寿司牌锁定到你的餐盘。',
      '全员选好后大屏同时揭晓，剩余手牌顺时针传给下一位食客！',
      '组合高分套餐：2×天妇罗(5分)、3×刺身(10分)、芥末×握寿司(3倍分！)、饺子递增(最高15分)、最多寿司卷(+6分)！',
      '3 轮回转盛宴结束后总分最高的美食家夺冠！',
    ],
    joystickLabel: '浏览手牌',
    actionALabel: '锁定寿司',
    actionASublabel: '放入餐盘',
    actionBLabel: '快速选牌',
    actionBSublabel: '智能推荐',
    controlTip: '先拿「芥末 Wasabi」再挑 3 分鱿鱼握寿司，直接三倍暴击狂揽 9 分！',
    settingLabel: '盛宴轮数',
    settingOptions: { 2: '2 轮（快局）', 3: '3 轮（经典）' },
  },
  ...(Object.fromEntries(
    PACK_MALAYSIAN_GAME_CATALOG.map((meta) => {
      const zh = PACK_MALAYSIAN_ZH[meta.id as keyof typeof PACK_MALAYSIAN_ZH];
      const optMap: Record<number, string> = {};
      meta.settingOptions.forEach((opt, idx) => {
        optMap[opt.value] = zh.settingOptions[idx] ?? opt.label;
      });
      return [
        meta.id,
        {
          name: zh.name,
          category: zh.category,
          tagline: zh.tagline,
          description: zh.description,
          playerModeLabel: zh.playerModeLabel,
          rules: zh.rules,
          joystickLabel: zh.joystickLabel,
          actionALabel: zh.actionA.label,
          actionASublabel: zh.actionA.sublabel,
          actionBLabel: zh.actionB.label,
          actionBSublabel: zh.actionB.sublabel,
          controlTip: zh.controlTip,
          settingLabel: zh.settingLabel,
          settingOptions: optMap,
        } satisfies GameTranslationZh,
      ];
    })
  ) as Record<keyof typeof PACK_MALAYSIAN_ZH, GameTranslationZh>),
  ...(Object.fromEntries(
    PACK_CHINESE_VIRAL_GAME_CATALOG.map((meta) => {
      const zh = PACK_CHINESE_VIRAL_ZH[meta.id as keyof typeof PACK_CHINESE_VIRAL_ZH];
      const optMap: Record<number, string> = {};
      meta.settingOptions.forEach((opt) => {
        optMap[opt.value] = opt.label
          .replace(/\s*(?:sec|s)$/i, ' 秒')
          .replace(/Rounds/g, '局')
          .replace(/Dice/g, '颗骰子')
          .replace('Sprint', '极速冲刺')
          .replace('Standard', '标准赛道')
          .replace('Marathon', '超长狂飙')
          .replace('Fast', '极速')
          .replace('Normal', '标准')
          .replace('Relaxed', '休闲')
          .replace('Chill', '轻松')
          .replace('Blitz', '闪电');
      });
      return [
        meta.id,
        {
          name: zh.name,
          category: zh.category,
          tagline: zh.tagline,
          description: zh.description,
          playerModeLabel: meta.playerModeLabel
            .replace(/1P/g, '单人')
            .replace(/2P/g, '双人')
            .replace(/3–8P/g, '3–8人')
            .replace(/3–4P/g, '3–4人')
            .replace(/4–8P/g, '4–8人'),
          rules: zh.rules,
          joystickLabel: zh.joystickLabel,
          actionALabel: zh.actionA[0],
          actionASublabel: zh.actionA[1],
          actionBLabel: zh.actionB[0],
          actionBSublabel: zh.actionB[1],
          controlTip: zh.controlTip,
          settingLabel: zh.settingLabel,
          settingOptions: optMap,
        } satisfies GameTranslationZh,
      ];
    })
  ) as Record<keyof typeof PACK_CHINESE_VIRAL_ZH, GameTranslationZh>),
  ...(Object.fromEntries(
    PACK_GLOBAL_VIRAL_GAME_CATALOG.map((meta) => {
      const zh = PACK_GLOBAL_VIRAL_ZH[meta.id as keyof typeof PACK_GLOBAL_VIRAL_ZH];
      const optMap: Record<number, string> = {};
      meta.settingOptions.forEach((opt) => {
        optMap[opt.value] = opt.label
          .replace(/\s*(?:sec|s)$/i, ' 秒')
          .replace(/Rounds/g, '回合')
          .replace(/Steps/g, '级玻璃')
          .replace(/Qs/g, '题');
      });
      return [
        meta.id,
        {
          name: zh.name,
          category: zh.category,
          tagline: zh.tagline,
          description: zh.description,
          playerModeLabel: meta.playerModeLabel
            .replace(/1P/g, '单人')
            .replace(/2P/g, '双人')
            .replace(/3–8P/g, '3–8人'),
          rules: zh.rules,
          joystickLabel: zh.joystickLabel,
          actionALabel: zh.actionALabel,
          actionASublabel: zh.actionASub,
          actionBLabel: zh.actionBLabel,
          actionBSublabel: zh.actionBSub,
          controlTip: zh.controlTip,
          settingLabel: meta.settingLabel
            .replace('Climb Time', '攀登时长')
            .replace('Match Time', '对战时长')
            .replace('Bridge Length', '玻璃桥长度')
            .replace('Rounds', '回合数')
            .replace('Flight Time', '飞行时长')
            .replace('Run Time', '奔跑时长')
            .replace('Blitz Time', '限时赛程')
            .replace('Questions', '题目数量'),
          settingOptions: optMap,
        } satisfies GameTranslationZh,
      ];
    })
  ) as Record<keyof typeof PACK_GLOBAL_VIRAL_ZH, GameTranslationZh>),
  ...(Object.fromEntries(
    PACK_RETRO_ARCADE_GAME_CATALOG.map((meta) => {
      const zh = PACK_RETRO_ARCADE_ZH[meta.id as keyof typeof PACK_RETRO_ARCADE_ZH];
      const optMap: Record<number, string> = {};
      meta.settingOptions.forEach((opt) => {
        optMap[opt.value] = opt.label
          .replace(/\s*(?:sec|s)$/i, ' 秒')
          .replace(/Frames/g, '局');
      });
      return [
        meta.id,
        {
          name: zh.name,
          category: zh.category,
          tagline: zh.tagline,
          description: zh.description,
          playerModeLabel: meta.playerModeLabel
            .replace(/1P/g, '单人')
            .replace(/2P/g, '双人')
            .replace(/3–8P/g, '3–8人'),
          rules: zh.rules,
          joystickLabel: zh.joystickLabel,
          actionALabel: zh.actionALabel,
          actionASublabel: zh.actionASub,
          actionBLabel: zh.actionBLabel,
          actionBSublabel: zh.actionBSub,
          controlTip: zh.controlTip,
          settingLabel: meta.settingLabel
            .replace('Match Time', '对战时长')
            .replace('Song Length', '曲目时长')
            .replace('Build Time', '叠楼时长')
            .replace('Frames', '保龄球局数'),
          settingOptions: optMap,
        } satisfies GameTranslationZh,
      ];
    })
  ) as Record<keyof typeof PACK_RETRO_ARCADE_ZH, GameTranslationZh>),
  ...(Object.fromEntries(
    PACK_SPORTS_PHYSICS_GAME_CATALOG.map((meta) => {
      const zh = PACK_SPORTS_PHYSICS_ZH[meta.id as keyof typeof PACK_SPORTS_PHYSICS_ZH];
      const optMap: Record<number, string> = {};
      meta.settingOptions.forEach((opt) => {
        optMap[opt.value] = opt.label.replace(/s$/i, ' 秒');
      });
      return [
        meta.id,
        {
          name: zh.name,
          category: zh.category,
          tagline: zh.tagline,
          description: zh.description,
          playerModeLabel: meta.playerModeLabel
            .replace(/1P/g, '单人')
            .replace(/2P/g, '双人')
            .replace(/3–8P/g, '3–8人')
            .replace(/3–4P/g, '3–4人'),
          rules: zh.rules,
          joystickLabel: zh.joystickLabel,
          actionALabel: zh.actionALabel,
          actionASublabel: zh.actionASub,
          actionBLabel: zh.actionBLabel,
          actionBSublabel: zh.actionBSub,
          controlTip: zh.controlTip,
          settingLabel: meta.settingLabel
            .replace('Course Time', '球场限时')
            .replace('Match Time', '对战时长'),
          settingOptions: optMap,
        } satisfies GameTranslationZh,
      ];
    })
  ) as Record<keyof typeof PACK_SPORTS_PHYSICS_ZH, GameTranslationZh>),
  ...(Object.fromEntries(
    PACK_CHAOS_SURVIVAL_GAME_CATALOG.map((meta) => {
      const zh = PACK_CHAOS_SURVIVAL_ZH[meta.id as keyof typeof PACK_CHAOS_SURVIVAL_ZH];
      const optMap: Record<number, string> = {};
      meta.settingOptions.forEach((opt) => {
        optMap[opt.value] = opt.label.replace(/s$/i, ' 秒');
      });
      return [
        meta.id,
        {
          name: zh.name,
          category: zh.category,
          tagline: zh.tagline,
          description: zh.description,
          playerModeLabel: meta.playerModeLabel
            .replace(/1P/g, '单人')
            .replace(/2P/g, '双人')
            .replace(/3–8P/g, '3–8人'),
          rules: zh.rules,
          joystickLabel: zh.joystickLabel,
          actionALabel: zh.actionALabel,
          actionASublabel: zh.actionASub,
          actionBLabel: zh.actionBLabel,
          actionBSublabel: zh.actionBSub,
          controlTip: zh.controlTip,
          settingLabel: meta.settingLabel.replace('Match Time', '对战时长'),
          settingOptions: optMap,
        } satisfies GameTranslationZh,
      ];
    })
  ) as Record<keyof typeof PACK_CHAOS_SURVIVAL_ZH, GameTranslationZh>),
  ...(Object.fromEntries(
    PACK_STRATEGY_CLASSICS_CATALOG.map((meta) => {
      const zh = PACK_STRATEGY_CLASSICS_ZH[meta.id as keyof typeof PACK_STRATEGY_CLASSICS_ZH];
      const optMap: Record<number, string> = {};
      meta.settingOptions.forEach((opt) => {
        optMap[opt.value] = opt.label
          .replace(/s$/i, ' 秒')
          .replace(/Rounds/g, '回合')
          .replace(/Hands/g, '手')
          .replace(/Clashes/g, '轮对决');
      });
      return [
        meta.id,
        {
          name: zh.name,
          category: zh.category,
          tagline: zh.tagline,
          description: zh.description,
          playerModeLabel: meta.playerModeLabel
            .replace(/1P/g, '单人')
            .replace(/2–8P/g, '2–8人')
            .replace(/2P/g, '双人')
            .replace(/3–8P/g, '3–8人'),
          rules: zh.rules,
          joystickLabel: zh.joystickLabel,
          actionALabel: zh.actionA[0],
          actionASublabel: zh.actionA[1],
          actionBLabel: zh.actionB[0],
          actionBSublabel: zh.actionB[1],
          controlTip: zh.controlTip,
          settingLabel: meta.settingLabel
            .replace('Match Time', '对战时长')
            .replace('Rounds', '回合数')
            .replace('Hands', '发牌局数')
            .replace('Clashes', '对决轮数'),
          settingOptions: optMap,
        } satisfies GameTranslationZh,
      ];
    })
  ) as Record<keyof typeof PACK_STRATEGY_CLASSICS_ZH, GameTranslationZh>),
  ...(Object.fromEntries(
    [
      { cat: PACK_PHYSICS_BUILDER_GAME_CATALOG, zhMap: PACK_PHYSICS_BUILDER_ZH as Record<string, any> },
      { cat: PACK_CREW_DEFENSE_GAME_CATALOG, zhMap: PACK_CREW_DEFENSE_ZH as Record<string, any> },
      { cat: PACK_TABLETOP_GEMS_GAME_CATALOG, zhMap: PACK_TABLETOP_GEMS_ZH as Record<string, any> },
      { cat: PACK_MIND_LOGIC_GAME_CATALOG, zhMap: PACK_MIND_LOGIC_ZH as Record<string, any> },
      { cat: PACK_CULT_HERITAGE_GAME_CATALOG, zhMap: PACK_CULT_HERITAGE_ZH as Record<string, any> },
    ].flatMap(({ cat, zhMap }) =>
      cat.map((meta) => {
        const zh = zhMap[meta.id];
        const optMap: Record<number, string> = {};
        meta.settingOptions.forEach((opt) => {
          optMap[opt.value] = opt.label
            .replace(/s$/i, ' 秒')
            .replace(/Rounds/g, '回合');
        });
        return [
          meta.id,
          {
            name: zh.name,
            category: zh.category,
            tagline: zh.tagline,
            description: zh.description,
            playerModeLabel: meta.playerModeLabel
              .replace(/1P/g, '单人')
              .replace(/2–8P/g, '2–8人')
              .replace(/2P/g, '双人')
              .replace(/3–8P/g, '3–8人'),
            rules: zh.rules,
            joystickLabel: zh.joystickLabel,
            actionALabel: zh.actionA[0],
            actionASublabel: zh.actionA[1],
            actionBLabel: zh.actionB[0],
            actionBSublabel: zh.actionB[1],
            controlTip: zh.controlTip,
            settingLabel: meta.settingLabel.replace('Match Time', '对战时长'),
            settingOptions: optMap,
          } satisfies GameTranslationZh,
        ];
      })
    )
  ) as Record<
    | keyof typeof PACK_PHYSICS_BUILDER_ZH
    | keyof typeof PACK_CREW_DEFENSE_ZH
    | keyof typeof PACK_TABLETOP_GEMS_ZH
    | keyof typeof PACK_MIND_LOGIC_ZH
    | keyof typeof PACK_CULT_HERITAGE_ZH,
    GameTranslationZh
  >),
};

export function getLocalizedGameMeta(game: GameMetadata, lang: Language): GameMetadata {
  if (lang === 'en') return game;
  const zh = GAME_ZH[game.id];
  if (!zh) return game;

  return {
    ...game,
    name: zh.name,
    category: zh.category,
    tagline: zh.tagline,
    description: zh.description,
    playerModeLabel: zh.playerModeLabel,
    rules: zh.rules,
    controllerSchema: {
      ...game.controllerSchema,
      joystickLabel: zh.joystickLabel,
      actionA: {
        ...game.controllerSchema.actionA,
        label: zh.actionALabel,
        sublabel: zh.actionASublabel,
      },
      actionB: {
        ...game.controllerSchema.actionB,
        label: zh.actionBLabel,
        sublabel: zh.actionBSublabel,
      },
      controlTip: zh.controlTip,
    },
    settingLabel: zh.settingLabel,
    settingOptions: game.settingOptions.map((opt) => ({
      ...opt,
      label: zh.settingOptions[opt.value] ?? opt.label,
    })),
  };
}

export function translateServerMessage(msg: string, lang: Language): string {
  if (lang === 'en' || !msg) return msg;

  // Room not found (with code)
  const notFound = msg.match(/^Room "([^"]+)" was not found/i);
  if (notFound) return `未找到房间「${notFound[1]}」，请检查大屏上的 4 位房间码。`;
  if (msg.includes('Room not found')) return '未找到该房间，请检查 4 位房间码是否正确。';

  // Room full
  const alreadyFull = msg.match(/^Room ([A-Z0-9]+) already has all (\d+) players/i);
  if (alreadyFull) return `房间 ${alreadyFull[1]} 已满（最多 ${alreadyFull[2]} 名玩家）。`;
  const roomHasAll = msg.match(/^Room already has all (\d+) players/i);
  if (roomHasAll) return `房间已满（最多 ${roomHasAll[1]} 名玩家）。`;
  if (msg.includes('Room is full')) return '房间已满（最多 8 名玩家）。';

  // Waiting for Ready (preserving player names)
  const waitEveryone = msg.match(/Everyone must press Ready on their phone first\. Waiting for:\s*(.+)$/i);
  if (waitEveryone) return `请先等待所有手机玩家点击「准备」。未准备：${waitEveryone[1]}`;
  const waitSpecific = msg.match(/^Waiting for (.+) to press Ready on their phone!?$/i);
  if (waitSpecific) return `等待 ${waitSpecific[1]} 在手机上点击「准备」！`;
  if (msg.includes('Waiting for') && msg.includes('Ready')) {
    return '请等待所有手机玩家点击「准备」后再开始！';
  }

  // Room / host / bot / session messages
  if (msg.includes('Invalid message format')) return '消息格式无效。';
  if (msg.includes('Previous room expired')) return '原房间已过期，正在创建新房间。';
  if (msg.includes('Only a connected human player can be chosen as the Room Host')) {
    return '只能指定在线的真人玩家担任房主。';
  }
  if (msg.includes('before entering the Game Room')) {
    return '进入游戏厅前，请至少连接 1 名玩家或添加 1 个机器人。';
  }
  if (msg.includes('Robots can only be added')) {
    return '只能在房间集结页或游戏厅内添加机器人。';
  }
  if (msg.includes('before starting') || msg.includes('Need at least 1 player')) {
    return '开始游戏前，请至少连接 1 名玩家或添加 1 个机器人。';
  }
  if (msg.includes('Only the Room Host')) return '仅房主可以控制大屏或开始游戏。';
  if (msg.includes('removed from the room')) return '你已被房主移出房间。';
  if (
    msg.includes('The host monitor session ended') ||
    msg.includes('The room was closed') ||
    msg.includes('Host closed') ||
    msg.includes('Room closed')
  ) {
    return '房主已关闭本次游戏房间。';
  }

  return translateGameText(msg, lang);
}

const EXACT_GAME_TEXT_ZH: Record<string, string> = {
  // Room / lobby status
  'In Setup': '集结中',
  'In Lobby': '大厅中',
  'Bot Ready': '机器人已准备',
  'Waiting for Ready': '等待准备',
  Ready: '已准备',
  'Reading Rules': '阅读规则中',
  'Get Ready!': '准备开始！',

  // Common player state badges & banners
  'Respawning...': '复活中...',
  'OFF TRACK · Respawning': '冲出赛道 · 复活中',
  'Ring Out!': '掉出擂台！',
  'Double Ring Out!': '双双出界！',
  'Fell Into the Abyss!': '跌入深渊！',
  'Everyone Dropped!': '全员掉落！',
  'BOOM! Fuse Detonated!': '轰！炸弹引爆！',
  'Everyone Blasted!': '全员被炸飞！',
  'Derezzed!': '光迹撞毁！',
  'Double Crash!': '双双撞毁！',
  'BLUE TEAM SCORES!': '蓝队进球！',
  'RED TEAM SCORES!': '红队进球！',
  'DOUBLE KO!': '双杀出局！',
  'DRAW — NEXT ROUND': '平局 — 进入下一回合',
  'CROWNED!': '持有皇冠！',
  'FROZEN!': '已被冰冻！',
  DOWNED: '倒地求救',
  'REVIVE!': '快救我！',
  'THAW ME!': '快解冻！',
  'STUNNED!': '已眩晕！',
  HUNTER: '追捕者',
  BOMB: '炸弹',
  HOP: '跳跃',
  RED: '红队',
  BLUE: '蓝队',
  OUT: '出局',
  BANK: '金库',
  'EMP SLOW-MO': '电磁减速',
  '1 CARD LEFT!': '只剩 1 张！',
  'EMPTY HAND!': '清空手牌！',
  'TIME OUT · PASSED!': '超时 · 自动过牌！',
  'SKIP!': '跳过回合！',
  'REVERSE!': '方向反转！',
  'BLUFF CAUGHT!': '抓谎成功！',
  '100% HONEST!': '货真价实！',
  'TRUSTED!': '全员信任！',
  'PICK A COLOR!': '选择新颜色！',
  'CHALLENGE WINDOW!': '质疑抓谎窗口！',
  DECK: '牌库',
  PILE: '牌堆',
  TARGET: '目标',
  'VAULT HEIST': '金库大劫案',
  'BRING GEMS TO CENTER': '把宝石送回中心',
  'HYPER PONG': '超级霓虹乒乓',
  'CROWN HEIST': '皇冠争夺战',
  'FREEZE TAG': '冰冻捉迷藏',
  'GHOST HUNT': '幽灵大追捕',
  'HOOK SHOT': '钩爪大乱斗',
  'YANK RIVALS OFF!': '把对手勾下悬崖！',
  'GRAVITY FLIP': '重力翻转',
  '1st': '第1名',
  '2nd': '第2名',
  '3rd': '第3名',

  // New 10 games exact labels
  'RICH STREET': '富豪大街',
  'CITY WEALTH': '城市财富榜',
  'JUNGLE LADDERS': '丛林蛇梯棋',
  'MATCH COMPLETE': '比赛结束',
  'FINAL WEALTH COUNT!': '最终资产结算！',
  'GO +$200': '起点 +$200',
  'Sunny Cafe': '阳光咖啡馆',
  'Boba Alley': '奶茶一条街',
  'Lucky Card': '幸运机遇卡',
  'Pixel Arcade': '像素游戏厅',
  'Neon Cinema': '霓虹电影院',
  'Chill Jail': '悠闲禁闭室',
  'Ramen Row': '拉面美食街',
  'Sushi Pier': '寿司海鲜港',
  'City Tax': '城市市政税',
  'Sky Park': '空中大公园',
  'Botanic Dome': '植物玻璃穹',
  'Free Jackpot': '免费大彩池',
  'Harbor Mall': '海港购物城',
  'Marina Club': '游艇俱乐部',
  'Gold Plaza': '黄金大广场',
  'Crown Hotel': '皇冠大酒店',
  'Luxury Fee': '奢华消费税',
  'Star Tower': '星光摩天楼',
  'Diamond Ave': '钻石大道',
  'Royal Palace': '皇家宫殿',
  'Grand Spire': '云端双子塔',
  Bankrupt: '已破产',
  Eliminated: '已出局',
  shops: '间商铺',
  cash: '现金',
  loot: '宝藏',
  WORTH: '总资产',
  PASSED: '已放弃',
  'LEADING!': '当前最高！',
  OFFER: '出价',
  'CURRENT TOP BID': '当前最高出价',
  'NO BIDS YET — PRESS A!': '暂无出价 — 按 A 举牌！',
  'Royal Vault Box': '皇家金库盒',
  'Velvet Crown Case': '天鹅绒皇冠盒',
  'Crystal Lockbox': '水晶密码箱',
  'Pirate Oak Chest': '海盗橡木箱',
  'Mystery Party Box': '神秘派对盲盒',
  'Gilded Mystery Box': '镀金神秘箱',
  'Starlight Coffer': '星光藏宝箱',
  'Old Harbor Trunk': '老港口旧皮箱',
  'Royal Question Box': '皇家问号箱',
  'Heavy & sparkles inside!': '沉甸甸的，里面闪闪发光！',
  'Feels solid gold!': '手感像纯金一样重！',
  'Glowing bright red!': '透着耀眼的红宝石光！',
  'Clinks like coins!': '摇起来叮当作响像金币！',
  'Suspiciously squeaky...': '怎么捏起来嘎嘎响……',
  'Light... or hollow gem?': '好轻……是空心宝石还是整蛊？',
  'Humming with luxury!': '散发着奢华的宝光！',
  'Smells like treasure!': '闻起来全是宝藏的味道！',
  'Might be priceless... or quack!': '可能价值连城……也可能嘎嘎叫！',
  'FLOOR DROPPED!': '错误地板已掉落！',
  'STAND ON RED!': '快站上红色星形！',
  'STAND ON BLUE!': '快站上蓝色月亮！',
  'STAND ON GOLD!': '快站上金色菱形！',
  'STAND ON MINT!': '快站上绿色闪电！',
  'Fell — Next Wave!': '已掉落 — 下波复活！',
  'MAZE CLEARED!': '迷宫全清！',
  'GREEN LIGHT — RUN!': '绿灯 — 快跑！',
  'YELLOW — SLOW DOWN!': '黄灯 — 准备急停！',
  'RED LIGHT — FREEZE!': '红灯 — 禁止移动！',
  BURGER: '汉堡',
  PIZZA: '披萨',
  TACO: '玉米卷',
  GRILL: '烤炉',
  SERVE: '出餐台',
  'A / TOSS B': '按A 或 B抛盘',
  'HOT!': '超近！快挖！',
  Warm: '接近中',
  Cold: '较远',
  'PINCHED!': '被螃蟹夹了！',
  'LEFT GOAL!': '左方进球！',
  'RIGHT GOAL!': '右方进球！',
  'BALL LOST!': '漏球了！',
  'GOLDEN MULTIBALL!': '黄金双球时刻！',
  'TRIPLE MULTIBALL!': '三重黄金弹珠！',
  'MULTIBALL CHARGE': '多球充能',

  // Upgraded mini-game popups & badges
  'TITAN SIZE!': '泰坦巨化！',
  'MEGA PULSE!': '超级震波！',
  '+75 STAR!': '+75 星星！',
  'GRAVITY VORTEX!': '引力漩涡！',
  'SHIELD!': '护盾！',
  'RAPID FIRE!': '极速连射！',
  'TRIPLE LASER!': '三向激光！',
  'HYPER BEAM!': '穿透激光！',
  '+1 HP!': '+1 生命！',
  '+55 CRYSTAL!': '+55 晶体！',
  '+100 ELIM!': '+100 击毁！',
  '+100 SHOVE KO!': '+100 推落淘汰！',
  '+45 GOLD!': '+45 黄金！',
  'SPRING JUMP!': '弹簧飞跃！',
  'TURBO BOOTS!': '疾风战靴！',
  'PASS SHIELD!': '免疫护盾！',
  '+2.5s CHILL!': '+2.5秒 缓爆！',
  'BLOCKED!': '已格挡！',
  'CLUTCH PASS! +65': '极限传弹！+65',
  'RECHARGED!': '能量回满！',
  'EMP CLEAR!': '电磁清障！',
  '+75 DATA!': '+75 数据！',
  'NEAR MISS! +15': '擦身闪避！+15',
  'TRIPLE SHOT!': '三连炮！',
  'TURBO TREADS!': '极速履带！',
  'ARMOR SHIELD!': '装甲护盾！',
  '+50 CRATE!': '+50 补给箱！',
  'BANK HIT!': '反弹命中！',
  'MEGA KICK!': '超级重炮踢！',
  'TURBO SPRINT!': '极速冲刺！',
  'GOLD BALL!': '黄金双球！',
  '+1 GOLD BALL!': '+1 金球加成！',
  'GOLDEN TIME  2X': '黄金时间 2倍！',
  '+25 GOLD!': '+25 黄金格！',
  'MEGA ROLLER!': '巨型滚刷！',
  'TURBO PAINT!': '极速涂装！',
  'MEGA SPLASH!': '超级泼墨！',
  'SHARD MAGNET!': '碎片磁铁！',
  'ENERGY SHIELD!': '能量护盾！',
  '+80 STAR!': '+80 星星！',
  'SHIELD SAVED!': '护盾挡下一击！',
  'GOLD CROWN!': '黄金皇冠！',
  'EMP READY!': '电磁充能！',
  'GHOST CLOAK!': '幽灵隐身斗篷！',
  'MULTI PUCK!': '多重冰球！',
  'GIANT MALLET!': '巨型球槌！',
  'FIREBALL!': '烈焰火球！',
  'BLADE WAVE!': '剑气斩！',
  'WIND STEP!': '疾风步！',
  'RING OUT!': '跌出擂台！',
  'DEFLECT +45': '弹反剑气 +45',
  'WAVE KO!': '剑气击杀！',
  'PARRY +40': '完美格挡 +40',
  'HEAVY SHELL x2!': '重型炮弹 x2！',
  '+80 & REPAIR!': '+80 并修复核心！',
  'DEFLECT +25': '反弹炮弹 +25',
  '+45 GOLD': '+45 金币',
  'ROYAL BOOST!': '皇家加速！',
  'SHOCK READY!': '震波充能！',
  'CROWNED +20': '戴上皇冠 +20',
  'STEAL +30!': '夺冠成功 +30！',
  'STAR THAW +75!': '全员解冻 +75！',
  '+45 STAR!': '+45 星星！',
  'BOLT READY +45': '冰箭就绪 +45',
  'TURBO SKATES!': '极速冰鞋！',
  'THAW +85!': '成功解救 +85！',
  'SUPER FLARE!': '超级照明弹！',
  'DENIED +40': '抢夺销毁 +40',
  'ECTO HEAL +1!': '灵质回血 +1！',
  'ECTO +40': '灵质充能 +40',
  '4-WAY LASER!': '四向散射！',
  'CORE +2 HP!': '核心修复 +2！',
  'OVERCHARGE!': '火力超载！',
  'LONG HOOK!': '超长飞爪！',
  'ANCHOR BOOST!': '锚点疾风！',
  '+100 KO!': '+100 击杀！',
  '+60 GOLD!': '+60 金币！',
  'BOOST GATE +55!': '加速门 +55！',
  'COIN MAGNET!': '金币磁铁！',
  'OVERDRIVE!': '超级加速！',
  'FREE UPGRADE!': '免费升级！',
  'LEAF SHIELD SAVED!': '树叶护盾挡灾！',
  'GOLDEN VINE + SHIELD!': '金藤飞跃 + 护盾！',
  'PERFECT ROLL +2!': '完美蓄力 +2！',
  'FLAME +1!': '火力 +1！',
  'BOMB +1!': '炸弹 +1！',
  'SPEED +1!': '移速 +1！',
  'BLAST SHIELD!': '防爆护盾！',
  'MEGA BOMB x2!': '超级炸弹 x2！',
  '+120 KO!': '+120 炸飞击杀！',
  'FAKE OUT — RUN!': '假动作 — 继续跑！',
  '+35 SPRINT!': '+35 冲刺回满！',
  'SHIELDED!': '护盾格挡！',
  'ZAPPED!': '红灯被电！',
  'TURBO DANCE!': '极速舞步！',
  'SHOCK READY +45!': '推人充能 +45！',
  'SPEED BOOTS!': '主厨加速靴！',
  'TREASURE MAP!': '藏宝图显形！',
  'GOLD MAGNET!': '寻宝磁铁！',
  'FRUIT FEVER RAIN!': '水果狂热雨！',
  'BASKET MAGNET!': '果篮磁铁！',
  '2X GOLDEN GAVEL': '2倍黄金拍卖！',
  'JACKPOT +80 GIANT!': '大奖 +80 巨型弹板！',
  GIANT: '巨型',
  VIP: '贵宾',

  // Server room / live alert strings
  'HOST REMOTE ACTIVE': '房主手机遥控已激活',
  'GAME ROOM': '游戏厅',
  'MATCH PAUSED': '比赛已暂停',
  'MATCH RESUMED': '比赛已恢复',
  'RULES BRIEFING': '规则说明',
  'GO! GO! GO!': '出发！冲啊！',
  'FRENZY GO!': '狂热开局！',
  '2X FRENZY MODE!': '2× 狂热模式！',
  'MATCH COMPLETE!': '比赛结束！',
  'TURN CHANGED': '回合切换',
  'YOUR TURN!': '轮到你了！',
  'CHALLENGE OR TRUST!': '质疑或信任！',
  'FEVER TIME!': '狂热水果雨！',
  'YELLOW LIGHT — SLOW!': '黄灯 — 准备急停！',
  'CHEST REVEAL!': '宝箱揭晓！',
  'LOADING ARENA MODULE...': '正在加载竞技场模块...',
  'Pick Next Game!': '选择下一局游戏！',
  'Voting...': '投票中...',

  // Canvas & Powerup badges
  MAG: '磁铁',
  OVR: '超载',
  BIG: '巨化',
  ZAP: '震波',
  SPD: '加速',
  SHK: '震波',
  MAP: '藏宝图',
  HEAL: '治疗',
  SHIELD: '护盾',
  'BANK 2X': '2倍金库',
  '×2 BALL': '双倍球',
  WIND: '风向',
  '↺ HOOK': '↺ 弧线',
  '↻ HOOK': '↻ 弧线',
  'HOOK+': '长爪',
  'SPD+': '加速',
  TRASH: '垃圾桶',
  CHOP: '切菜台',
  STOVE: '灶台',
  'READY ★': '可出餐 ★',
  CHOPPED: '已切好',
  RAW: '生肉',
  'VIP ★': '贵宾 ★',
  '1. GRAB ▶': '1. 拿食材 ▶',
  '2. CHOP 🔪 ▶': '2. 切配 🔪 ▶',
  '3. GRILL 🍳 ▶': '3. 煎烤 🍳 ▶',
  '🔪CHOP → 🍳COOK': '🔪切菜 → 🍳下锅',
  '🔥 TAP A/B!': '🔥 连按 A/B 灭火!',
  '⚠ BURNING!': '⚠ 快烧焦了!',

  // Clash / Card Values & Colors
  SKIP: '跳过',
  REV: '反转',
  WILD: '万能',
  FLIP: '翻转',
  'SKIP ALL': '全员跳过',
  'WILD +3': '万能+3',
  'DRAW +1': '罚抽+1',
  'DRAW +2': '罚抽+2',
  'DRAW +4': '罚抽+4',
  GOLD: '金色',
  GREEN: '绿色',
  PURPLE: '紫色',
  TEAL: '青色',
  PINK: '粉色',
  ORANGE: '橙色',
  DARK: '暗黑面',
  LIGHT: '光明面',
  'JOKER = WILD': '大小王 = 万能牌',
  TURN: '出牌',
  RENT: '收租',
  CW: '顺时针',
  CCW: '逆时针',
  'DARK SIDE ACTIVE (+5 / SKIP ALL)': '暗黑面激活（+5 / 全员跳过）',
  'LIGHT SIDE ACTIVE': '光明面激活',
  'PICK 1 & PASS': '选1张传牌',

  // Boom Kittens, Property Deal, Flip 7, Royal Bluff, Sushi Draft
  SAFE: '安全',
  ATK: '攻击',
  KO: '淘汰',
  MIX: '洗牌',
  PEEK: '偷看',
  STEAL: '偷牌',
  BOOM: '炸弹',
  PROP: '地产',
  HEIST: '大劫',
  GUARD: '防御',
  HIT: '袭击',
  SWAP: '换牌',
  TAX: '征税',
  DEFUSE: '拆弹',
  'DEFUSE!': '拆弹成功！',
  'Saves from Boom': '可拆炸弹保命',
  'End turn no draw': '结束回合免摸牌',
  'ATTACK x2': '攻击 x2',
  'Next draws +2': '下家多摸2张',
  'SEE FUTURE': '预见未来',
  'Peek top 3 cards': '偷看牌顶3张',
  SHUFFLE: '洗乱牌堆',
  'Mix the deck': '打乱牌堆顺序',
  FAVOR: '强索手牌',
  'Steal rival card': '抢走对手1张牌',
  TACOCAT: '玉米卷猫',
  '+60 bonus pts': '额外 +60 分',
  'BOOM!': '轰炸！',
  'Explodes!': '抽到直接爆炸！',
  'PEEKED!': '已偷看牌顶！',
  'STOLEN!': '偷牌成功！',
  '+60 TACOCAT!': '+60 玉米卷猫！',
  'DEFUSED!': '拆弹成功！',
  'DEFUSED! +150': '拆弹成功！+150',
  'BOOM!!': '轰！！炸弹引爆！',
  'DREW SAFE': '安全摸牌',
  'SAFE DRAW': '安全摸牌',
  'EXPLODED!': '已爆炸出局！',
  'AVOID THE BOOM KITTENS!': '躲避炸弹猫，活到最后！',
  'BOOM DECK': '炸弹牌堆',
  ACTION: '行动卡',
  'DISCARD PILE': '弃牌堆',
  'LAST ACTION': '最近行动',
  'PLAY SELECTED': '打出选中牌',
  'RED AVE': '红霓大街',
  'BLUE PLAZA': '蓝调广场',
  'GOLD TOWER': '黄金大厦',
  'EMERALD PARK': '翡翠公园',
  '2 = Full Set': '2张即成套',
  'WILD DEED': '万能地契',
  'Fits any set': '可配任意套组',
  'Cash Vault': '现金金库',
  'PASS GO': '经过起点',
  'Draw +2 cards': '立即摸2张牌',
  'COLLECT RENT': '全员收租',
  'Tax all rivals': '向所有对手收租',
  'SLY DEAL': '暗度陈仓',
  'Steal 1 deed': '偷取对手1张地契',
  'DEBT COLLECT': '强力催债',
  'Take $4M cash': '收取 $4M 现金',
  $4M: '$4M 资金',
  'DEAL BREAKER': '强制夺套',
  'Heist top deed!': '抢夺对手整套地产！',
  DEEDS: '地契',
  PROPERTY: '地产区',
  'PLAY UP TO 3/TURN': '每回合最多出3张',
  DEAL: '交易',
  'No deeds placed yet': '暂未摆出地契',
  'END TURN': '结束回合',
  'PLAY CARD': '打出卡牌',
  'PASS GO +2': '经过起点 +2张',
  'DEED STOLEN!': '地契被偷走！',
  'BANKED $2M': '存入 $2M',
  'DEAL BREAKER!!': '强制夺走全套！',
  'BANKED $5M': '存入 $5M',
  'FLIP 7': '翻牌 7',
  GOAL: '目标',
  'NO DUPLICATES!': '切忌重复数字！',
  'BUSTED!': '爆牌了！',
  'x2 MULT!': '积分翻倍！',
  'DOUBLE SCORE': '本轮得分翻倍',
  x2: '×2',
  'x2 MULTIPLIER!': '×2 积分倍率！',
  '2ND CHANCE': '复活护盾',
  '2ND CHANCE!': '获得护盾免爆！',
  'BONUS MOD': '加分卡',
  'FLIP 7!! +35!': '凑齐7张不重！+35！',
  'FLIP 7 UNIQUE CARDS WITHOUT DUPLICATES!': '翻出7张不重复数字即获大奖！',
  DUKE: '公爵',
  ASSASSIN: '刺客',
  AMBASSADOR: '大使',
  CAPTAIN: '船长',
  CONTESSA: '女伯爵',
  INCOME: '基础收入',
  COUP: '政变',
  ROYAL: '皇家',
  'BLUFF COURT': '宫廷吹牛',
  SECRET: '暗牌',
  EXILED: '已被放逐',
  'CHALLENGE WINDOW OPEN!': '质疑窗口开启！',
  'ROYAL COURT IN SESSION': '宫廷议政进行中',
  'Tax +3 Coins': '收税 +3 金币',
  'Steal 2 Coins': '抢劫 2 金币',
  'Pay 3: Strike': '付3金币暗杀',
  'Swap +1 Coin': '换牌 +1 金币',
  'Blocks Assassin': '抵挡刺客暗杀',
  'DUKE +3 COINS': '公爵征税 +3 金币',
  '+3 TAX': '+3 税收',
  'CONTESSA BLOCK!': '女伯爵成功挡杀！',
  'SWAPPED +1': '大使换牌 +1',
  'INCOME +1': '基础收入 +1',
  '+1 COIN': '+1 金币',
  'DUKE TAX (+3)': '公爵征税 (+3)',
  'CAPTAIN STEAL (2)': '船长抢劫 (2)',
  'ASSASSIN STRIKE': '刺客暗杀',
  'AMBASSADOR SWAP': '大使换牌',
  'INCOME (+1)': '领取收入 (+1)',
  'DUKE (+3)': '公爵 (+3)',
  'CAPTAIN (STEAL)': '船长 (抢劫)',
  'CALL BLUFF!': '当场拆穿！',
  'ALLOW CLAIM': '放行相信',
  'BLUFF ROLES · CATCH LIARS · RULE THE COURT!': '伪装身份 · 抓捕谎言 · 称霸宫廷！',
  'SUSHI BAR': '回转寿司台',
  'Dish chosen!': '已选好菜品！',
  'Picking sushi...': '挑选寿司中...',
  TEMPURA: '天妇罗',
  'Pair = 5 pts': '每对 = 5 分',
  '2x=5': '2份=5',
  SASHIMI: '刺身拼盘',
  'Trio = 10 pts': '每3份 = 10 分',
  '3x=10': '3份=10',
  DUMPLING: '日式煎饺',
  COMBO: '连吃加分',
  WASABI: '山葵酱',
  '3x Next Nigiri': '下个握寿司×3',
  '3x!': '3倍!',
  SALMON: '三文鱼寿司',
  '+2 (6 w/Wasabi)': '+2分 (蘸山葵6分)',
  SQUID: '鱿鱼寿司',
  '+3 (9 w/Wasabi)': '+3分 (蘸山葵9分)',
  'MAKI x2': '双卷寿司',
  'Most Maki = +6': '卷王得 +6 分',
  M2: '2卷',
  'MAKI x3': '三卷寿司',
  M3: '3卷',
  PUDDING: '焦糖布丁',
  'End Bonus +6': '终局最多 +6',
  SWEET: '甜品',
  'PICK LOCKED!': '选牌已锁定！',
  'MAKI KING +6!': '寿司卷王 +6！',
  'PICK 1 SUSHI & PASS THE HAND!': '选1份寿司并把牌传给下家！',
  TRUST: '选择信任',

  // Board games (Pack 1)
  'LUDO ROYALE': '皇家飞行棋',
  'ROYAL MATCH COMPLETE!': '皇家对局结束！',
  'TOKEN DEPLOYED!': '棋子成功起飞！',
  'SAFE STAR TILE! (+25)': '安全星格！(+25)',
  'BONUS ROLL (6)!': '掷出6点 · 再掷一次！',
  'STAR PARTY': '星光派对棋',
  'STAR PARTY FINALE!': '星光派对大结局！',
  '2X DOUBLE CANDY!': '2× 双倍骰子糖！',
  '★ GOLDEN STAR!': '★ 夺得黄金星星！',
  'LUCKY FOUNTAIN +12!': '幸运喷泉 +12 金币！',
  'FREE 2X CANDY!': '免费获得 2× 双倍糖！',
  'REVERSI CLASH': '霓虹黑白棋',
  'BOARD COMPLETE!': '棋盘对决结束！',
  'CONNECT 4 DROP': '重力四子棋',
  'RACK SHIFTED DOWN!': '棋架整体下移！',
  'RACK COMPLETE — FINAL SCORE!': '棋架填满 — 最终结算！',
  'ANVIL CRUSH!': '铁砧砸落清列！',
  'BATTLESHIP SALVO': '海战声呐齐射',
  'ALL FLEETS SUNK!': '敌方舰队全灭！',
  'SALVO OPERATION COMPLETE!': '海上齐射行动完成！',
  'GOLDEN FLAGSHIP SUNK! +90': '击沉黄金旗舰！+90',
  'DIRECT TORPEDO HIT! +45': '鱼雷直接命中！+45',
  'SEA MINE DETONATED! -15': '触雷爆炸！-15',
  'KING JUMP CHECKERS': '王冠跳棋对决',
  'CROWN KING BOOST!': '加冕成王增益！',
  'CHECKERS CLASH COMPLETE!': '跳棋对决结束！',
  'JUMP CAPTURE! +40': '连跳吃子！+40',
  'CARROM STRIKER': '霓虹卡罗姆弹珠',
  'POWER SPIN SHOT!': '强力旋球击球！',
  '👑 RED QUEEN POCKETED! +50': '👑 红皇后入袋！+50',
  'ALL PUCKS POCKETED!': '全盘母球入袋！',
  'CARROM MATCH COMPLETE!': '卡罗姆比赛结束！',
  'DUNGEON QUEST': '地牢勇者探险',
  'DUNGEON QUEST COMPLETE!': '地牢探险通关！',
  'HERO POTION (+4 HP / +2 ATK)!': '勇者药水（+4血 / +2攻）！',
  'GUILD GATE': '公会大门',
  SLIME: '史莱姆',
  'IRON CHEST': '铁宝箱',
  GOBLIN: '哥布林',
  CAMPFIRE: '营地篝火',
  'SPIKE PIT': '尖刺陷阱',
  SKELETON: '骷髅兵',
  'GOLD CHEST': '黄金宝箱',
  'ORC BRUTE': '兽人狂战士',
  SHRINE: '治愈神龛',
  'DARK MAGE': '暗黑法师',
  'FIRE RUNE': '烈焰符文',
  'RELIC VAULT': '圣物宝库',
  MINOTAUR: '牛头人',
  SANCTUARY: '圣殿营地',
  GOLEM: '岩石魔像',
  'ROYAL HOARD': '皇家宝藏',
  DRAKE: '飞龙',
  ALTAR: '祈福祭坛',
  'DRAGON BOSS': '终极巨龙BOSS',

  // Pack 2: Chinese Viral Arcade & Cards
  'MELON MERGE': '合成大西瓜',
  'DROP & MERGE INTO A GIANT MELON!': '精准投放合成大西瓜！',
  'TILE TRIPLE': '羊了个羊三消',
  'MATCH 3 IDENTICAL TILES — DON’T FILL YOUR TRAY!': '三消相同方块 — 千万别塞满槽位！',
  "MATCH 3 IDENTICAL TILES — DON'T FILL YOUR TRAY!": '三消相同方块 — 千万别塞满槽位！',
  'BLOCK HOP': '跳一跳霓虹',
  'HOLD A TO CHARGE JUMP — LAND ON CENTER FOR STREAKS!': '长按 A 蓄力跳跃 — 落中靶心连击翻倍！',
  'PLATFORM LEAP': '疯狂往上跳',
  'CLIMB HIGHER THAN THE RISING NEON LAVA!': '不断向上跃升，逃离上升岩浆！',
  'HEAD BOUNCE!': '踩头弹跳！',
  'EGG RUSH': '蛋仔冲冲冲',
  'BOUNCE, ROLL & BLAST THROUGH THE FINISH GATE!': '翻滚冲撞冲向终点线！',
  'GOOSE ALERT': '鹅鸭杀潜行',
  KITCHEN: '厨房',
  LIBRARY: '图书馆',
  BOILER: '锅炉房',
  GARDEN: '花园',
  'BELL TOWER': '钟楼',
  VAULT: '金库',
  'GEESE: REPAIR ALL 6 STATIONS! DUCKS: STRIKE IN STEALTH!': '大鹅：修好6处设备！坏鸭：暗中偷袭破坏！',
  'SABOTAGE!': '破坏警报！',
  'DUCK SPOTTED!': '发现坏鸭！',
  'QUACKED!': '嘎嘎遭袭击！',
  'GEESE WIN! MANOR SECURED!': '大鹅阵营胜利！庄园已守住！',
  'DUCKS WIN! FLOCK ELIMINATED!': '坏鸭阵营胜利！鹅群已全灭！',
  'HOTPOT RUSH': '火锅捞捞乐',
  'SNATCH GOLDEN COOKED WAGYU — DODGE FIERY CHILIES!': '抢夹黄金熟和牛 — 躲避暴辣红椒！',
  'SO SPICY! -60': '太辣了！-60',
  'CLAW MANIA': '抓娃娃狂潮',
  'DROP YOUR CLAW ON GOLDEN DRAGONS & PLUSHIES!': '对准金龙和玩偶下爪！',
  'BOOM! -100': '炸弹！-100',
  'OTHER PLAYERS: PRESS A TO VOTE DONE!': '其余玩家：按 A 投票确认完成！',
  'LANDLORD (地主)': '地主',
  'PEASANT (农民)': '农民',
  BIDDING: '抢地主中',
  'BIDDING FOR LANDLORD (1× — 3×)': '叫分抢地主（1× — 3×）',
  'FREE LEAD — PLAY ANY COMBO': '自由出牌 — 任意牌型领出',
  'ROCKET! 王炸 ×2': '王炸！！倍数 ×2',
  PASS: '不出',
  'BID 1×': '叫1分',
  'BID 2×': '叫2分',
  'BID 3×': '叫3分',
  'PASS BID': '不叫',
  'SMART PLAY': '智能出牌',
  DRAGON: '箭牌/中发白',
  WAN: '万字牌',
  'HU READY! 可胡': '听牌可胡！',
  'EXHAUSTIVE DRAW! 流局': '流局平盘！',
  'HU! 胡牌': '胡牌大胜！',
  'PURE MODE 齋': '纯斋模式',
  '1s ARE WILD': '1点当万能',
  'PURE 齋': '纯斋无万能',
  '1s WILD': '1点万能',
  'OPENING BID...': '首家叫骰中...',
  'CALL LIAR! 开骰': '开骰拆穿！',
  CLUE: '线索词',
  VOTE: '投票',
  'CLUE PHASE': '发言线索阶段',
  'VOTE OUT THE SPY!': '投票揪出谁是卧底！',
  'CHECK YOUR SECRET WORD ON YOUR PHONE': '请在手机查看你的秘密词语',
  'CLUES ARE IN! VOTE OUT THE SPY!': '线索已亮明！请投票投出卧底！',
  WEREWOLF: '狼人',
  SEER: '预言家',
  VILLAGER: '村民',
  'HUNT TARGET': '袭击目标',
  'PEEK ROLE': '查验身份',
  'EXILE VOTE': '放逐投票',
  'VILLAGE WINS! ALL WEREWOLVES EXILED!': '好人阵营获胜！所有狼人已被放逐！',
  'WEREWOLVES WIN THE MIDNIGHT HUNT!': '狼人阵营获胜！主宰午夜！',
  'NIGHT 1 — CHECK YOUR SECRET ROLE & ACT!': '第1夜 — 查看底牌并执行夜晚行动！',
  'MATCH THE GOLD ENDING LETTER / CHARACTER!': '接上金色尾字或英文首字母！',
  'WRONG LINK!': '接龙不匹配！',
  'TIME OUT!': '超时断链！',

  // Pack 3: Global Viral Arcade & Cards
  'CLIMB TO THE SKY!': '一路攀爬冲向云霄！',
  'CUT OFF RIVALS TO BURST LOOT!': '绕行拦截对手撞碎得分！',
  'ABSORB PELLETS & DEVOUR SMALLER RIVALS!': '吞噬光点变大并吃掉小玩家！',
  'LOOP BACK HOME TO CLAIM TURF!': '画圈闭合领地霸占全图！',
  'CHOOSE LEFT OR RIGHT GLASS — ONE HOLDS!': '二选一玻璃桥 — 只有一边踩不碎！',
  'ROUND 1 · PULL ON THE GOLD PULSE!': '第1局 · 趁金光脉冲猛拉绳！',
  'FLAP THROUGH PIPES & GRAB GOLD RINGS!': '穿梭霓虹水管收集金环！',
  'LEAP CACTI & DUCK PTERODACTYLS!': '跳仙人掌、低头躲翼龙！',
  'MERGE!': '合并升级！',
  'SLIDE & MERGE TO 2048!': '滑动合成冲刺 2048！',
  'BOARD RESET': '棋盘刷新重开',
  'DIG SAFE CELLS · FLAG MINES FOR +60!': '排雷挖格 · 插旗标雷 +60！',
  'DROP YOUR PIN ON THE WORLD MAP!': '在世界地图投下精准图钉！',
  'DIAL YOUR NEEDLE TO THE SECRET ZONE!': '转动指针命中隐藏共鸣区！',
  '5-LTR': '5字母词',
  'TAP A 5-LETTER WORD ON YOUR PHONE!': '在手机点选5字母谜底单词！',
  'POP CULTURE': '流行文化',
  'FOOD & ASIA': '亚洲美食',
  GAMING: '电子游戏',
  SCIENCE: '科学常识',
  INTERNET: '互联网',
  WORLD: '世界地理',
  ANIMALS: '动物百科',
  TECH: '前沿科技',
  MOVIES: '电影娱乐',
  MUSIC: '音乐艺术',
  'Tropical Fruit': '热带水果',
  'Sci-Fi Tech': '科幻科技',
  'Wild Animal': '野生动物',
  'Party Food': '派对美食',
  'Music Gear': '音乐乐器',
  Weather: '自然天气',
  Mars: '火星',
  Saturn: '土星',
  Venus: '金星',
  Mercury: '水星',
  'Nasi Lemak': '椰浆饭',
  Bibimbap: '韩式拌饭',
  Paella: '西班牙海鲜饭',
  Risotto: '意式炖饭',
  'Bright Red': '亮红色',
  'Neon Green': '霓虹绿',
  'Dark Blue': '深蓝色',
  Gold: '金色',
  '1 Heart': '1颗心',
  '2 Hearts': '2颗心',
  '3 Hearts': '3颗心',
  '5 Hearts': '5颗心',
  'South Korea': '韩国',
  Thailand: '泰国',
  Japan: '日本',
  Switzerland: '瑞士',
  Cheetah: '猎豹',
  'Grizzly Bear': '灰熊',
  Kangaroo: '袋鼠',
  Hippo: '河马',
  High: '高',
  HyperText: '超文本',
  Home: '首页',
  Host: '主机',
  Pixar: '皮克斯',
  DreamWorks: '梦工厂',
  'Studio Ghibli': '吉卜力工作室',
  Illumination: '照明娱乐',
  '64 Keys': '64键',
  '76 Keys': '76键',
  '88 Keys': '88键',
  '100 Keys': '100键',
  'SLAM THE RIGHT COLOR ON YOUR PHONE!': '在手机极速拍下正确答案颜色！',
  CODE: '特工代号',
  SCANNING: '破译扫描中',
  'ASSASSIN!': '踩到黑衣刺客！',
  NEUTRAL: '路人卡',
  DECOY: '假答案',
  'TRUTH?': '是真相？',
  'PLOTTING LIE': '编造假答案中',
  'LIE PLANTED': '已埋下假答案',
  GUESSING: '辨真伪投票中',
  VOTED: '已投票',
  'PLANT A LIE': '编一条假知识',
  'SPOT THE TRUTH': '揪出唯一真相',
  REVEAL: '真相揭晓',
  'PHASE 1: PLANT A BELIEVABLE LIE ON YOUR PHONE!': '第1步：在手机挑选以假乱真的假答案！',
  'PHASE 2: SPOT THE REAL TRUTH!': '第2步：慧眼识破谎言找出真相！',
  'CHECK YOUR PHONE · PICK A SNEAKY LIE!': '查看手机 · 选一个坑人的假答案！',
  '✓ REAL TRUTH': '✓ 真正冷知识',

  // Pack 4: Malaysian Classics
  'FAR END — TOUCH & RETURN': '底线区 — 摸线即返！',
  'START & HOME GOAL': '起点与返程终点线',
  'TAGGED!': '被抓住了！',
  'OFF DESK!': '掉出课桌！',
  'OUT OF RPM!': '陀螺停转！',
  'KNOCK MARBLES OUT OF THE RING!': '将弹珠撞出圆圈之外！',
  'SEPAK TAKRAW · 3 TOUCHES!': '藤球对决 · 最多3次触球！',
  'LIPAT SPIKE!': '腾空倒钩扣杀！',
  'OVER 3 TOUCHES! RIGHT POINT!': '超3次触球犯规！右队得分！',
  'OVER 3 TOUCHES! LEFT POINT!': '超3次触球犯规！左队得分！',
  'DODGE!': '极限闪避！',
  'STOMPED! +240': '精准踩鞋！+240',
  'ROUND 2 · RUMAH TERBAKAR!': '第2回合 · 烧屋禁坑开启！',
  'CONGKAK · SOW CLOCKWISE!': '播棋 · 顺时针播种收珠！',
  'FREE TURN!': '再走一轮！',
  Spectator: '观战中',
  'OPEN WITH 3♦!': '必须包含 ♦3 首出！',
  'TOP-CARD GUARD ACTIVE!': '下家报单 — 顶大警戒中！',
  'LEAD 3♦': '♦3 首出',
  'FREE LEAD': '自由领出',
  'INVALID COMBO!': '无效牌型组合！',
  'SMART HINT': '智能选牌',
  'PASS TRICK': '过牌不出',
  'STRAIGHT FLUSH!': '同花顺！',
  'STRAIGHT (蛇)': '顺子（蛇）',
  'BANKER (庄)': '庄家',
  'HIT!': '要牌！',
  'RUN (PUSH)': '15点平跑',
  'RUN (15点跑)': '15点走人',
  STAND: '停牌不摸',
  'HIT (+1 CARD)': '加摸1张',
  '15-PT RUN (跑)': '15点跑路',
  'OPEN 3+ CARDS': '开3张+闲家',
  'OPEN ALL': '全开比牌',
  'PURE NGAU': '纯牛无赖子',
  '3 ↔ 6 WILD ON': '3/6 互换赖子开',
  'NO NGAU': '无牛散牌',
  'FIVE GONG ×5!': '五公 ×5 倍！',
  'NGAU TUNG ×2!': '牛冬 ×2 倍！',
  'AUTO BEST NGAU': '一键最优牛',
  'READY!': '已准备！',
  'LOCKED!': '已锁定！',

  // Pack 5, 6, 7: Retro, Sports, Chaos, Strategy Classics
  'GRAB CORNER ORBS TO CHOMP GHOSTS!': '吃角落能量豆反杀霓虹幽灵！',
  'FRESH PELLET WAVE SPAWNED!': '新一波能量豆已刷新！',
  'SHATTER BRICKS & UNLEASH LASER PADDLES!': '击碎砖块激活激光挡板！',
  'NEW NEON BRICK WALL!': '全新霓虹砖墙降临！',
  'MULTI-BALL UNLEASHED!': '多球分裂爆发！',
  'WAVE 1 · BLAST THE ALIEN ARMADA!': '第1波 · 轰爆外星舰队！',
  'MYSTERY GOLDEN UFO SPOTTED (+150)!': '神秘黄金飞碟出没 (+150)！',
  'CLEAR MULTI-LINES TO SEND GARBAGE!': '一次消多行向对手空投垃圾行！',
  'DODGE TRAFFIC · RIDE LOGS TO GOLDEN LILY PADS!': '躲避车流 · 踏木头冲向金莲座！',
  'CLIMB LADDERS & VAULT ROLLING BARRELS!': '爬梯登顶 · 跳越滚落铁桶！',
  'WHACK MOLES & GOLDEN KINGS · DODGE BOMBS!': '痛打地鼠与金冠王 · 小心炸弹！',
  'BOOM -45': '炸弹 -45',
  'AIM THE LANE & SLAM BEAT ON THE GLOW LINE!': '踩准节拍音轨在光线下重击！',
  'SNIPE FLYING CLAYS & GOLDEN SAUCERS!': '狙击飞盘与黄金飞碟！',
  'BANK SHOTS & POWER SMASHES!': '墙壁反弹球与强力重击！',
  'HOLD ROLL TO HIT THE 100-PT CORNER RINGS!': '长按蓄力投进角落 100 分洞！',
  'DROP BLOCKS FLUSH FOR GOLDEN STREAKS!': '稳稳对齐盖楼赢取黄金连击！',
  'DRILL FOR DEEP DIAMONDS & CRUSH MONSTERS!': '深钻挖钻石并砸碎地底怪物！',
  'BOULDER CRUSH (+150)!': '巨石砸怪 (+150)！',
  'MATCH 3+ BUBBLES FOR CLUSTER POPS!': '三消同色泡泡连锁爆破！',
  'FRESH CRYSTAL WAVE!': '全新水晶泡泡阵刷新！',
  'ADD HOOK SPIN & BLAST ALL 10 PINS!': '加弧线旋转全倒 10 个瓶！',
  'DROP COINS & TRIGGER GEM AVALANCHES!': '投币推落红宝石狂潮！',
  'HOLD A TO CHARGE — HIT THE SWEET SPOT!': '长按 A 蓄力 — 命中黄金投篮区！',
  'AIM TOP CORNERS & STRIKE PAST THE KEEPER!': '瞄准死角破门得分！',
  'HOLE 1 — BANK OFF WALLS TO SINK THE CUP!': '第1洞 — 利用墙面反弹一杆进洞！',
  'AIM UPWIND & RELEASE (A) FOR 100-PT BULLSEYES!': '留意风向拉弓瞄准靶心 100 分！',
  'GUARD COUNTER-HOOKS TO SCORE KNOCKOUTS!': '防御反击重拳 KO 对手！',
  'KO +150!': '击倒 KO +150！',
  'PRESS A FOR SMASH · B FOR CURVE SPIN!': 'A 猛扣杀 · B 搓旋转球！',
  'SWING (A) WHEN THE BALL ENTERS THE PLATE RING!': '球进本垒圈时按 A 挥棒！',
  'GRAB DODGEBALLS — PRESS B TO CATCH HOT THROWS!': '抢球砸人 — 按 B 空手接烈焰球！',
  'DOSUKOI! BLAST RIVALS OFF THE GOLDEN DOHYO!': '相扑突进！把对手推出黄金土俵！',
  'TAP PADDLE (A) & STEER THROUGH GREEN GATES!': '划桨加速穿越绿色旗门！',
  'CATCH THE HYPER DISC & CURVE THROW INTO THE RIVAL GOAL!': '接住飞盘弧线抛进敌方球门！',
  'LEAP AT THE NET WITH A FOR LIGHTNING SMASHES!': '网前按 A 起跳闪电劈杀！',
  'POCKET COLORED BALLS & GOLDEN +150 8-BALLS!': '击落彩球与 +150 黄金8号球！',
  'FRESH RACK SPAWNED!': '新球阵已摆好！',
  'LUNGE (A) TO IMPALE FLANKS · SHIELD (B) TO PARRY!': 'A 长枪突刺 · B 举盾格挡！',
  'HOP THE LASER BEAM & SNATCH GEMS!': '跳越旋转激光抢宝石！',
  'LEAP TO GREEN ISLANDS BEFORE RED ONES SINK!': '红岛下沉前快跳往绿岛！',
  'PASS THE TICKING BOMB BEFORE 0.0s!': '倒计时归零前把炸弹传给别人！',
  'ORBIT THE RING — DIVE INTO GREEN PODS WHEN ALARM DROPS!': '绕圈抢位 — 警报响起快钻进绿舱！',
  'SCRAMBLE! CLAIM A GLOWING THRONE!': '抢椅子！快占领发光王座！',
  'DANCE AROUND THE ARENA!': '全场霓虹热舞！',
  'ZERO FRICTION! DRIFT & BUMP RIVALS OFF THE GLACIER!': '零摩擦冰面漂移，把对手撞下冰川！',
  'DODGE RED RINGS — COLLECT GOLDEN STAR CORES!': '躲避红圈 — 抢占金星核心！',
  'HOLD THE MOVING GOLDEN CROWN ZONE!': '站稳移动黄金皇冠圈内加分！',
  'HOLD DUCK (A) UNDER RED LASERS & SNATCH DIAMONDS!': '按住 A 下蹲躲激光抢钻石！',
  'PATIENT ZERO HUNTING! SURVIVE OR INFECT EVERYONE!': '零号病人来袭！逃生或感染全员！',
  'SHOVE (B) RIVALS UNDER FALLING ANVIL SHADOWS!': '按 B 把对手推进下坠铁砧阴影下！',
  'BALANCE THE SKY SEESAW & HOLD GRIP (B) ON STEEP SLOPES!': '空中跷跷板保持平衡，斜坡按 B 抓紧！',
  'DODGE CANYON BUZZ-SAWS & RIDE THE ELASTIC TETHER!': '借弹力绳甩飞躲避峡谷锯片！',
  'PAINT FLOOR TILES & DROP CONFETTI BOMBS (A)!': '疯狂涂鸦地板并投放彩带炸弹(A)！',
  'EVADE SWINGING STEEL WRECKING BALLS!': '躲避摆动的重型钢制破坏球！',
  'RUN OFF BLINKING RED TRAPDOORS BEFORE THEY DROP!': '离开闪烁红门 — 地板马上塌陷！',
  'TRAPDOORS OPENED!': '陷阱地板开启！',
  'FIND A SOLID GREEN SQUARE!': '快找稳固绿格子站稳！',
  'DROP STONES TO LINK 3, 4 & 5-IN-A-ROW!': '落子连珠冲刺三连、四连、五子连线！',
  'BOARD FULL — FRESH GOMOKU ROUND!': '棋盘已满 — 开启新一轮五子棋！',
  'CAPTURE GOLD PAWNS & LEAP OVER RIVALS!': '操控骑士L跳吃金币并跨步抢旗！',
  'CONNECT MATCHING PIPS TO EXTEND THE DOMINO CHAIN!': '接上对应点数延展多米诺长龙！',
  'CLAIM HONEYCOMB TILES (A) & CONVERT RIVALS (B)!': '按 A 占领蜂窝格，按 B 转化邻格！',
  'PICK A RUNNER & ROLL DICE (A) TO RACE PAST POINT 24!': '选棋掷骰全速向24点终点归位！',
  'SCOOP GLOWING PITS (A) TO SOW & CAPTURE OPPOSITE GEMS!': '按 A 捞穴撒宝并吃光对岸宝石！',
  'HOLD A TO CHARGE GRANITE STONE — SWEEP (B) INTO THE GOLD BUTTON!': '按 A 蓄力推石壶 — 按 B 猛烈扫冰！',
  'SELECT 3-OF-A-KIND OR 3-CARD RUNS ON YOUR PHONE & TAP MELD!': '在手机凑齐三条或同花顺点击凑组！',
  'MELD 3+': '亮牌凑组',
  'SWAP 1': '换1张',
  'SWEPT CLEAN TRICK +80!': '清空红心完美拿墩 +80！',
  'ROYAL FLUSH': '皇家同花顺',
  'STRAIGHT FLUSH': '同花顺',
  'FOUR OF A KIND': '四条炸弹',
  'FULL HOUSE': '葫芦三带二',
  FLUSH: '同花',
  STRAIGHT: '顺子',
  'THREE OF A KIND': '三条',
  'TWO PAIR': '两对',
  'ONE PAIR': '一对',
  'HIGH CARD': '高牌',
  'FOUR OF A KIND!': '四条炸弹！',
  'FULL HOUSE!': '葫芦！',
  'FLUSH!': '同花！',
  'STRAIGHT!': '顺子！',
  LOCKED: '已锁牌',
  'DRAWING...': '选牌换牌中...',
  READY: '已出牌',
  'SELECT WEAK CARDS TO SWAP OR LOCK YOUR 5-CARD POKER HAND!': '换掉弱牌或直接锁定5张扑克牌型！',
  'LOCK HAND': '锁牌摊牌',
  'SWAP SELECTED': '换掉选中',
  'FIRE > NATURE > FROST > FIRE · PICK YOUR ELEMENT!': '火 克 自然 · 自然 克 冰 · 冰 克 火 · 选元素！',
  'ELEMENTS REVEALED!': '元素揭晓对决！',
  ARCANA: '奥术牌',
  FIRE: '火',
  NATURE: '自然',
  FROST: '冰',
  SUN: '太阳',
  'Wild Trump': '万能王牌',
  'Beats Nature': '克制自然',
  'Beats Frost': '克制寒冰',
  'Beats Fire': '克制火焰',
  'PICK 2 CARDS CLOSEST TO NATURAL 9 (MOD 10)!': '选2张牌个位相加最接近9点！',
  'BET 2 CARDS': '亮2张牌',
  'FLIP MATCHING PAIRS ACROSS THE 12-CARD BOARD!': '翻开配对消除12张记忆卡！',
  'BOARD CLEARED — FRESH 12 CARDS DEALT!': '全部消除 — 新一轮12张牌洗好！',
  'PLAY CARDS TO CLAIM BOARD NUMBERS — JACKS ARE WILD!': '出牌占领对应大屏数字格 — J 万能！',
  'FULL SEQUENCE BOARD — FRESH GRID RESET!': '序列盘满 — 全新棋盘重置！',
  'SWAP HAND': '换一张牌',

  // Misc player names/bot colors fallback
  Pilot: '飞行员',
  Racer: '赛车手',
  Player: '玩家',
  'Coral Red': '珊瑚红',
  Tangerine: '活力橙',
  'Arcade Lime': '电玩绿',
  Magenta: '霓虹粉',
  Cyan: '青蓝',

  // Final audit additions (Kitchen, Arena Popups, Malaysian, GeoPin, Fibbage, Chaos Wheel)
  BANKER: '庄家',
  NGAU: '牛牛',
  HINT: '提示',
  'BLUE TEAM': '蓝队',
  'RED TEAM': '红队',
  '+1 ♥ LIFE!': '+1 ♥ 生命！',
  '+20 BLOCK': '+20 冰块！',
  '+35 GEM!': '+35 宝石！',
  'LAVA KO!': '掉入岩浆出局！',
  'FROZEN +65!': '成功冰冻 +65！',
  'FULL ♥ +40': '满血复活 +40！',
  'HOLO RETURN!': '全息回球！',
  'TURBO SPIKE!': '极速重扣！',
  'HOLO-KEEPER ZONE (SPIKE TO SCORE!)': '全息守门区（扣杀破门！）',
  'RUNNERS: THAW FROZEN FRIENDS!': '逃跑者：快解救被冰冻的队友！',
  'SWEEP FLASHLIGHTS TO EXPOSE THE PHANTOM!': '扫射强光手电找出隐身幽灵！',
  'PASS THE BOMB BEFORE IT BLOWS!': '倒计时爆炸前把炸弹传出去！',
  'PLAY FLIP TO UNLEASH THE DARK SIDE!': '打出翻转牌切换暗黑面！',
  'CHOPPED! → GRILL': '切好了！→ 快下锅煎烤',
  'COOKED! GRAB IT!': '煎好了！快拿去上菜！',
  'PREP READY!': '备菜完成！',
  TRASHED: '已丢弃',
  '🔥 STOVE FIRE! TAP A/B!': '🔥 灶台起火！快按 A/B 灭火！',
  '🧯 FIRE OUT +30!': '🧯 成功灭火 +30！',
  '🫧 CLEAN DISHES +45!': '🫧 洗净餐盘 +45！',
  'FAR ZONE! +120': '远端突围！+120',
  'FULL CROSSING! +280': '全线冲关！+280',
  'TINDIH PIN! +240': '成功压制！+240',
  'Petronas Twin Towers': '吉隆坡双子塔',
  'Shibuya Crossing & Mt. Fuji': '涩谷十字路口与富士山',
  'Eiffel Tower & Seine': '埃菲尔铁塔与塞纳河',
  'Statue of Liberty': '自由女神像',
  'Great Pyramids of Giza': '吉萨大金字塔',
  'Sydney Opera House': '悉尼歌剧院',
  'Christ the Redeemer': '里约救世基督像',
  'Great Wall & Forbidden City': '万里长城与故宫',
  'Big Ben & Tower Bridge': '大本钟与伦敦塔桥',
  'Marina Bay Sands': '新加坡滨海湾金沙',
  'Guinea Pig': '豚鼠 (天竺鼠)',
  Radioactive: '放射性',
  Unicorn: '独角兽',
  Taller: '更高',
  Edible: '可以食用',
  'HYPER TURBO 1.35×': '极速狂飙 1.35×',
  '2× SCORE MADNESS': '双倍积分狂潮',
  'EARLY INFERNO': '半程烈焰',
  'MIRROR CURSE': '镜像反转',
  'GOLDEN OVERDRIVE': '黄金超载',
  'Kuala Lumpur, Malaysia': '马来西亚 · 吉隆坡',
  'Tokyo, Japan': '日本 · 东京',
  'Paris, France': '法国 · 巴黎',
  'New York, USA': '美国 · 纽约',
  'Cairo, Egypt': '埃及 · 开罗',
  'Sydney, Australia': '澳大利亚 · 悉尼',
  'Rio de Janeiro, Brazil': '巴西 · 里约热内卢',
  'Beijing, China': '中国 · 北京',
  'London, UK': '英国 · 伦敦',
  Singapore: '新加坡',
  'PASS THE BOMB!': '快把炸弹传出去！',
  'YOU ARE IT!': '你是追捕者！',
  '🔥 STOVE FIRE!': '🔥 灶台着火！',
  'SUDDEN DEATH SHRINK!': '决胜时刻 — 缩圈开始！',
  'BIG JOKER': '大王',
  'SM JOKER': '小王',
  'LANDLORD 地主': '地主',
  'UNDERCOVER SPY!': '卧底身份！',
  CIVILIAN: '平民',
  ELIMINATED: '已被放逐',
  CRACKED: '已破译',
  'Pick the new table color!': '请选择新的牌桌颜色！',
  'Hold your poker face...': '保持扑克脸别露馅……',
  'ARRANGING...': '理牌中...',
  '5-CARD BUST!': '五张爆牌！',
  'BUST!': '爆牌！',
  PUSH: '平局',
  'SET COMPLETE!': '凑齐整套！',
  'WILD FULL SET!': '万能补齐整套！',
  'WILD DEED!': '万能地契！',
  'BOARD CLEARED': '全盘清空',
  'FRESH ROUND': '新一轮开始',
  'MATCH POINT!': '赛点时刻！',
  'BAN BAN ×3!': '双A/双十天牌 ×3！',
  '7-7-7 JACKPOT ×7!': '7-7-7 豹子大奖 ×7！',
  'BAN LUCK ×2!': '21点天牌 ×2！',
  '5-CARD BUST ×2!': '五张爆牌 ×2！',
  'WU LONG 21 ×3!': '五龙21点 ×3！',
  'WU LONG ×2!': '五龙过关 ×2！',
  'NEED 16+ TO STAND': '需满 16 点才能停牌',
  '1 CARD!': '剩 1 张牌！',
  WHITE: '白板',
  'OVERTIME!': '加时赛！',
  'FINAL SPRINT!': '最后冲刺！',
  'ROUND 1': '第 1 回合',
  'HOST DISCONNECTED': '房主已断开',
};

function translateOrdinalZh(ord: string): string {
  const m = ord.match(/^(\d+)(?:st|nd|rd|th)$/i);
  return m ? `第${m[1]}名` : ord;
}

export function translateGameText(text: string, lang: Language): string {
  if (lang === 'en' || !text) return text;
  const trimmed = text.trim();
  if (EXACT_GAME_TEXT_ZH[trimmed]) return EXACT_GAME_TEXT_ZH[trimmed];

  // 4th, 5th, 6th, 7th, 8th...
  if (/^\d+(st|nd|rd|th)$/i.test(trimmed)) return translateOrdinalZh(trimmed);

  let m: RegExpMatchArray | null;

  // --- Canvas HUD Chips & Top Bars ---
  if ((m = trimmed.match(/^ROUND\s+(\d+)\/(\d+)\s+·\s+(\d+)s$/i))) {
    return `第 ${m[1]}/${m[2]} 回合 · ${m[3]}秒`;
  }
  if ((m = trimmed.match(/^ROUND\s+(\d+)\/(\d+)$/i))) {
    return `第 ${m[1]}/${m[2]} 回合`;
  }
  if ((m = trimmed.match(/^ROUND\s+(\d+)$/i))) {
    return `第 ${m[1]} 回合`;
  }
  if ((m = trimmed.match(/^TIME\s+(\d+:\d+)$/i))) {
    return `时间 ${m[1]}`;
  }
  if ((m = trimmed.match(/^LAP\s+(\d+)\/(\d+)\s+·\s+([\d.]+)s$/i))) {
    return `第 ${m[1]}/${m[2]} 圈 · ${m[3]}秒`;
  }
  if ((m = trimmed.match(/^RACE ENDING IN\s+(\d+)s$/i))) {
    return `比赛将在 ${m[1]} 秒后结束`;
  }
  if ((m = trimmed.match(/^FUSE\s+([\d.]+)s$/i))) {
    return `引信 ${m[1]}秒`;
  }
  if ((m = trimmed.match(/^RED\s+(\d+)$/i))) {
    return `红队 ${m[1]}`;
  }
  if ((m = trimmed.match(/^(\d+)\s+BLUE$/i))) {
    return `${m[1]} 蓝队`;
  }
  if ((m = trimmed.match(/^WAVE\s+(\d+)$/i))) {
    return `第 ${m[1]} 波`;
  }
  if ((m = trimmed.match(/^(\d+)\s+PTS$/i))) {
    return `${m[1]} 分`;
  }
  if ((m = trimmed.match(/^FIRST TO\s+(\d+)$/i))) {
    return `先赢 ${m[1]} 分`;
  }
  if ((m = trimmed.match(/^LEFT CORE\s+(\d+)$/i))) {
    return `左核心 ${m[1]}`;
  }
  if ((m = trimmed.match(/^RIGHT CORE\s+(\d+)$/i))) {
    return `右核心 ${m[1]}`;
  }
  if ((m = trimmed.match(/^LEAD:\s*(.+)$/i))) {
    return `领先：${m[1]}`;
  }
  if ((m = trimmed.match(/^FROZEN\s+(\d+)\/(\d+)$/i))) {
    return `已冰冻 ${m[1]}/${m[2]}`;
  }
  if ((m = trimmed.match(/^PHANTOM HP\s+(\d+)$/i))) {
    return `幽灵血量 ${m[1]}`;
  }
  if ((m = trimmed.match(/^TEAM\s+(\d+)$/i))) {
    return `团队分 ${m[1]}`;
  }
  if ((m = trimmed.match(/^SPEED\s+(\d+)$/i))) {
    return `速度 ${m[1]}`;
  }
  if ((m = trimmed.match(/^Bag\s+(\d+)$/i))) {
    return `携带 ${m[1]}`;
  }
  if ((m = trimmed.match(/^(\d+)s$/i))) {
    return `${m[1]}秒`;
  }

  // --- In-Game Center Banners ---
  if ((m = trimmed.match(/^(.+)\s+Wins Round\s+(\d+)!?$/i))) {
    return `${m[1]} 赢得第 ${m[2]} 回合！`;
  }
  if ((m = trimmed.match(/^(.+)\s+Survived!$/i))) {
    return `${m[1]} 存活获胜！`;
  }
  if ((m = trimmed.match(/^Time Up\s+[—-]\s+(\d+)\s+Survived$/i))) {
    return `时间到 — ${m[1]} 人存活`;
  }
  if ((m = trimmed.match(/^(.+)\s+Cleared the Grid!$/i))) {
    return `${m[1]} 称霸光迹网格！`;
  }
  if ((m = trimmed.match(/^2X BLUE GOAL!\s+(.+)$/i))) {
    return `双倍蓝队进球！${m[1]}`;
  }
  if (/^2X BLUE GOAL!$/i.test(trimmed)) {
    return '双倍蓝队进球！';
  }
  if ((m = trimmed.match(/^2X RED GOAL!\s+(.+)$/i))) {
    return `双倍红队进球！${m[1]}`;
  }
  if (/^2X RED GOAL!$/i.test(trimmed)) {
    return '双倍红队进球！';
  }
  if ((m = trimmed.match(/^BLUE GOAL!\s+(.+)$/i))) {
    return `蓝队进球！${m[1]}`;
  }
  if ((m = trimmed.match(/^RED GOAL!\s+(.+)$/i))) {
    return `红队进球！${m[1]}`;
  }
  if ((m = trimmed.match(/^(.+)\s+STRIKES TRUE!$/i))) {
    return `${m[1]} 一击制胜！`;
  }
  if ((m = trimmed.match(/^(.+)\s+SCORES!$/i))) {
    return `${m[1]} 得分！`;
  }
  if ((m = trimmed.match(/^(.+)\s+THAWED\s+(.+)!$/i))) {
    return `${m[1]} 解冻了 ${m[2]}！`;
  }
  if ((m = trimmed.match(/^(.+)\s+WAS HAUNTED!$/i))) {
    return `${m[1]} 被幽灵吓倒了！`;
  }

  // --- Player statText & Victory highlight patterns ---
  if ((m = trimmed.match(/^(\d+(?:st|nd|rd|th))\s+·\s+FINISHED$/i))) {
    return `${translateOrdinalZh(m[1])} · 已完赛`;
  }
  if ((m = trimmed.match(/^(\d+(?:st|nd|rd|th))\s+·\s+Lap\s+(\d+)\/(\d+)$/i))) {
    return `${translateOrdinalZh(m[1])} · 第 ${m[2]}/${m[3]} 圈`;
  }
  if ((m = trimmed.match(/^Finished\s+(.+)$/i))) {
    return `完赛用时 ${m[1]}`;
  }
  if ((m = trimmed.match(/^Lap\s+(\d+)\/(\d+)$/i))) {
    return `第 ${m[1]}/${m[2]} 圈`;
  }
  if ((m = trimmed.match(/^HP\s+(\d+)\/(\d+)\s+·\s+(\d+)\s+Elim$/i))) {
    return `血量 ${m[1]}/${m[2]} · ${m[3]} 击杀`;
  }
  if ((m = trimmed.match(/^HP\s+(\d+)\/(\d+)\s+·\s+(\d+)x$/i))) {
    return `血量 ${m[1]}/${m[2]} · ${m[3]}倍连击`;
  }
  if ((m = trimmed.match(/^HP\s+(\d+)\s+·\s+(\d+)x$/i))) {
    return `血量 ${m[1]} · ${m[2]}x`;
  }
  if ((m = trimmed.match(/^HP\s+(\d+)$/i))) {
    return `血量 ${m[1]}`;
  }
  if ((m = trimmed.match(/^(\d+)\s+KO\s+·\s+(\d+)\s+pts$/i))) {
    return `${m[1]} 击倒 · ${m[2]} 分`;
  }
  if ((m = trimmed.match(/^(\d+)W\s+·\s+(\d+)\s+pts$/i))) {
    return `${m[1]} 胜 · ${m[2]} 分`;
  }
  if ((m = trimmed.match(/^OUT\s+·\s+(\d+)\s+pts$/i))) {
    return `已出局 · ${m[1]} 分`;
  }
  if ((m = trimmed.match(/^BOMB!\s+([\d.]+)s$/i))) {
    return `炸弹！${m[1]}秒`;
  }
  if ((m = trimmed.match(/^SAFE\s+·\s+(\d+)\s+pts$/i))) {
    return `安全 · ${m[1]} 分`;
  }
  if ((m = trimmed.match(/^RESPAWN\s+([\d.]+)s$/i))) {
    return `复活倒计时 ${m[1]}秒`;
  }
  if ((m = trimmed.match(/^(RED|BLUE)\s+·\s+(\d+-\d+)\s+·\s+(\d+)G$/i))) {
    const team = m[1].toUpperCase() === 'RED' ? '红队' : '蓝队';
    return `${team} · ${m[2]} · ${m[3]}球`;
  }
  if ((m = trimmed.match(/^(RED|BLUE)\s+·\s+(\d+)\s+goals?$/i))) {
    const team = m[1].toUpperCase() === 'RED' ? '红队' : '蓝队';
    return `${team} · ${m[2]} 粒进球`;
  }
  if ((m = trimmed.match(/^([\d.]+)%\s+turf$/i))) {
    return `${m[1]}% 地盘`;
  }
  if ((m = trimmed.match(/^Bag\s+(\d+)\s+·\s+Banked\s+(\d+)$/i))) {
    return `携带 ${m[1]} · 已存 ${m[2]}`;
  }
  if ((m = trimmed.match(/^(\d+)\s+relics banked$/i))) {
    return `已存入 ${m[1]} 颗宝石`;
  }
  if ((m = trimmed.match(/^Wins\s+(\d+)\/(\d+)\s+·\s+(\d+)\s+Parries$/i))) {
    return `${m[1]}/${m[2]} 胜 · ${m[3]} 格挡`;
  }
  if ((m = trimmed.match(/^(\d+)\s+wins?\s+·\s+(\d+)\s+parries$/i))) {
    return `${m[1]} 胜 · ${m[2]} 次格挡`;
  }
  if ((m = trimmed.match(/^Core\s+(\d+)\/(\d+)\s+·\s+(\d+)\s+KOs$/i))) {
    return `核心 ${m[1]}/${m[2]} · ${m[3]} 击毁`;
  }
  if ((m = trimmed.match(/^Core\s+HP\s+(\d+)\/(\d+)$/i))) {
    return `核心血量 ${m[1]}/${m[2]}`;
  }
  if ((m = trimmed.match(/^Core\s+(\d+)\/(\d+)$/i))) {
    return `核心 ${m[1]}/${m[2]}`;
  }
  if ((m = trimmed.match(/^(\d+)\s+Steals$/i))) {
    return `${m[1]} 次抢夺`;
  }
  if ((m = trimmed.match(/^(\d+)\s+pts\s+·\s+(\d+)\s+steals$/i))) {
    return `${m[1]} 分 · ${m[2]} 次抢夺`;
  }
  if ((m = trimmed.match(/^(\d+)m\s+·\s+(\d+)\s+Coins?$/i))) {
    return `${m[1]}米 · ${m[2]} 金币`;
  }
  if ((m = trimmed.match(/^Hunter\s+·\s+(\d+)\s+Frozen$/i))) {
    return `追捕者 · 冰冻 ${m[1]} 人`;
  }
  if ((m = trimmed.match(/^Runner\s+·\s+(\d+)\s+Saves$/i))) {
    return `逃跑者 · 解救 ${m[1]} 次`;
  }
  if ((m = trimmed.match(/^(\d+)\s+destroyed\s+·\s+Core\s+(\d+)\/(\d+)$/i))) {
    return `击毁 ${m[1]} 颗 · 核心 ${m[2]}/${m[3]}`;
  }
  if ((m = trimmed.match(/^(\d+)\s+Pit KOs$/i))) {
    return `${m[1]} 次拉落深坑`;
  }
  if ((m = trimmed.match(/^(\d+)\s+grapple KOs$/i))) {
    return `${m[1]} 次钩爪击杀`;
  }
  if ((m = trimmed.match(/^Phantom HP\s+(\d+)\/(\d+)$/i))) {
    return `幽灵血量 ${m[1]}/${m[2]}`;
  }
  if ((m = trimmed.match(/^Hunter HP\s+(\d+)\/(\d+)$/i))) {
    return `猎人血量 ${m[1]}/${m[2]}`;
  }
  if ((m = trimmed.match(/^Phantom\s+·\s+(\d+)\s+pts$/i))) {
    return `幽灵 · ${m[1]} 分`;
  }
  if ((m = trimmed.match(/^Hunter\s+·\s+(\d+)\s+pts$/i))) {
    return `猎人 · ${m[1]} 分`;
  }
  if ((m = trimmed.match(/^Wave\s+(\d+)\s+·\s+(\d+)\s+pts$/i))) {
    return `第 ${m[1]} 波 · ${m[2]} 分`;
  }
  if ((m = trimmed.match(/^(\d+)\s+goals\s+\(([^)]+)\)$/i))) {
    return `${m[1]} 球 (${m[2]})`;
  }
  if ((m = trimmed.match(/^(\d+)\s+KO\s+\((\d+)\s+bank\)$/i))) {
    return `${m[1]} 击杀（${m[2]} 次反弹）`;
  }
  if ((m = trimmed.match(/^(\d+)\s+KOs?$/i))) {
    return `${m[1]} 击杀`;
  }
  if ((m = trimmed.match(/^(\d+)\s+Elims?$/i))) {
    return `${m[1]} 淘汰`;
  }
  if ((m = trimmed.match(/^(\d+)\s+wins?$/i))) {
    return `${m[1]} 胜`;
  }
  if ((m = trimmed.match(/^(\d+)\s+pass(?:es)?$/i))) {
    return `传递 ${m[1]} 次`;
  }

  // --- New 10 games dynamic patterns ---
  if ((m = trimmed.match(/^ROUND\s+(\d+)\/(\d+)\s+·\s+POT\s+\$(\d+)$/i))) {
    return `第 ${m[1]}/${m[2]} 回合 · 彩池 $${m[3]}`;
  }
  if ((m = trimmed.match(/^PRESS A TO ROLL\s+\((\d+)s\)$/i))) {
    return `按 A 掷骰子 (${m[1]}秒)`;
  }
  if ((m = trimmed.match(/^A: BUY\/UPGRADE \(\$(\d+)\)\s+·\s+B: SKIP \((\d+)s\)$/i))) {
    return `A 购买/升级 ($${m[1]}) · B 跳过 (${m[2]}秒)`;
  }
  if ((m = trimmed.match(/^JACKPOT \+\$(\d+)!$/i))) {
    return `中大奖 +$${m[1]}！`;
  }
  if ((m = trimmed.match(/^BUY \$(\d+)\? A\/B$/i))) {
    return `买 $${m[1]}? 按A/B`;
  }
  if ((m = trimmed.match(/^YOUR TURN · \$(\d+)$/i))) {
    return `你的回合 · $${m[1]}`;
  }
  if ((m = trimmed.match(/^\$(\d+) · (\d+) shops$/i))) {
    return `$${m[1]} · ${m[2]} 间铺`;
  }
  if ((m = trimmed.match(/^\$(\d+) cash · (\d+) shops$/i))) {
    return `$${m[1]} 现金 · ${m[2]} 间商铺`;
  }
  if ((m = trimmed.match(/^(.+)'s Turn — Press A to Roll!$/i))) {
    return `轮到 ${m[1]} — 按 A 掷骰！`;
  }
  if ((m = trimmed.match(/^(.+) rolled (\d+) \+ (\d+) = (\d+)!$/i))) {
    return `${m[1]} 掷出了 ${m[2]} + ${m[3]} = ${m[4]} 点！`;
  }
  if ((m = trimmed.match(/^(.+) rolled a (\d+)!$/i))) {
    return `${m[1]} 掷出了 ${m[2]} 点！`;
  }
  if ((m = trimmed.match(/^(.+) rolled (\d+) \+ 2 Boost = (\d+)!$/i))) {
    return `${m[1]} 掷出 ${m[2]} +2 加速 = ${m[3]} 步！`;
  }
  if ((m = trimmed.match(/^(.+) bought (.+)!$/i))) {
    return `${m[1]} 买下了 ${translateGameText(m[2], lang)}！`;
  }
  if ((m = trimmed.match(/^(.+) upgraded (.+) to Lv\.(\d+)!$/i))) {
    return `${m[1]} 将 ${translateGameText(m[2], lang)} 升至 ${m[3]} 级！`;
  }
  if ((m = trimmed.match(/^(.+) paid \$(\d+) rent to (.+)!$/i))) {
    return `${m[1]} 向 ${m[3]} 支付 $${m[2]} 租金！`;
  }
  if ((m = trimmed.match(/^(.+) passed GO! \+\$200$/i))) {
    return `${m[1]} 经过起点！+$200`;
  }
  if ((m = trimmed.match(/^POWER ROLL · (\d+)s$/i))) {
    return `蓄力掷骰 · ${m[1]}秒`;
  }
  if ((m = trimmed.match(/^LADDER! #(\d+) → #(\d+)$/i))) {
    return `爬梯大捷！#${m[1]} → #${m[2]}`;
  }
  if ((m = trimmed.match(/^SNAKE! #(\d+) → #(\d+)$/i))) {
    return `踩到蛇啦！#${m[1]} → #${m[2]}`;
  }
  if ((m = trimmed.match(/^(.+) REACHED #(\d+)!$/i))) {
    return `${m[1]} 率先抵达 #${m[2]}！`;
  }
  if ((m = trimmed.match(/^YOUR TURN · #(\d+)\/(\d+)$/i))) {
    return `你的回合 · #${m[1]}/${m[2]}`;
  }
  if ((m = trimmed.match(/^Tile #(\d+)\/(\d+)$/i))) {
    return `第 #${m[1]}/${m[2]} 格`;
  }
  if ((m = trimmed.match(/^Tile #(\d+) · (\d+) climbs$/i))) {
    return `第 #${m[1]} 格 · 爬梯 ${m[2]} 次`;
  }
  if ((m = trimmed.match(/^(.+) WINS ROUND (\d+)!$/i))) {
    return `${m[1]} 赢得第 ${m[2]} 回合！`;
  }
  if ((m = trimmed.match(/^ROUND (\d+) DRAW!$/i))) {
    return `第 ${m[1]} 回合平局！`;
  }
  if ((m = trimmed.match(/^(\d+) wins · (\d+) KOs$/i))) {
    return `${m[1]} 胜 · ${m[2]} 击杀`;
  }
  if ((m = trimmed.match(/^(\d+) pts · (\d+)B\/(\d+)F$/i))) {
    return `${m[1]} 分 · ${m[2]}弹/${m[3]}火`;
  }
  if ((m = trimmed.match(/^RACE (\d+)\/(\d+)$/i))) {
    return `第 ${m[1]}/${m[2]} 局`;
  }
  if ((m = trimmed.match(/^RACE (\d+) — GO!$/i))) {
    return `第 ${m[1]} 局 — 开跑！`;
  }
  if ((m = trimmed.match(/^RACE (\d+) COMPLETE!$/i))) {
    return `第 ${m[1]} 局结束！`;
  }
  if ((m = trimmed.match(/^(.+) FINISHED 1ST!$/i))) {
    return `${m[1]} 第一个冲线！`;
  }
  if ((m = trimmed.match(/^FINISHED #(\d+)$/i))) {
    return `第 ${m[1]} 名完赛`;
  }
  if ((m = trimmed.match(/^(\d+)% · (\d+) pts$/i))) {
    return `进度 ${m[1]}% · ${m[2]} 分`;
  }
  if ((m = trimmed.match(/^(GREEN LIGHT — RUN!|YELLOW — SLOW DOWN!|RED LIGHT — FREEZE!) · (\d+)s$/i))) {
    return `${translateGameText(m[1], lang)} · ${m[2]}秒`;
  }
  if ((m = trimmed.match(/^WAVE (\d+)\/(\d+) · ([\d.]+)s$/i))) {
    return `第 ${m[1]}/${m[2]} 波 · ${m[3]}秒`;
  }
  if ((m = trimmed.match(/^(\d+) pts · (\d+) waves$/i))) {
    return `${m[1]} 分 · 存活 ${m[2]} 波`;
  }
  if ((m = trimmed.match(/^(\d+)\/(\d+) waves safe$/i))) {
    return `安全通过 ${m[1]}/${m[2]} 波`;
  }
  if ((m = trimmed.match(/^TIME (\d+)s$/i))) {
    return `时间 ${m[1]}秒`;
  }
  if ((m = trimmed.match(/^(\d+) pts · (\d+) served$/i))) {
    return `${m[1]} 分 · 上菜 ${m[2]} 份`;
  }
  if ((m = trimmed.match(/^(\d+) dishes served$/i))) {
    return `共上菜 ${m[1]} 份`;
  }
  if ((m = trimmed.match(/^(\d+)g · (HOT!|Warm|Cold)$/i))) {
    return `${m[1]}金 · ${translateGameText(m[2], lang)}`;
  }
  if ((m = trimmed.match(/^(\d+) chests found$/i))) {
    return `挖出 ${m[1]} 个宝箱`;
  }
  if ((m = trimmed.match(/^CROWN \+(\d+)!$/i))) {
    return `皇冠 +${m[1]}！`;
  }
  if ((m = trimmed.match(/^GEM \+(\d+)!$/i))) {
    return `宝石 +${m[1]}！`;
  }
  if ((m = trimmed.match(/^\+(\d+) GOLD!$/i))) {
    return `黄金 +${m[1]}！`;
  }
  if ((m = trimmed.match(/^SWAT \+35!$/i))) {
    return `拍飞 +35！`;
  }
  if ((m = trimmed.match(/^BOOM -50!$/i))) {
    return `炸到啦 -50！`;
  }
  if ((m = trimmed.match(/^(\d+) pts · x(\d+)$/i))) {
    return `${m[1]} 分 · ${m[2]}倍连击`;
  }
  if ((m = trimmed.match(/^(\d+) fruits caught$/i))) {
    return `接住 ${m[1]} 个水果`;
  }
  if ((m = trimmed.match(/^CHEST (\d+)\/(\d+) · (\d+)s$/i))) {
    return `第 ${m[1]}/${m[2]} 宝箱 · ${m[3]}秒`;
  }
  if ((m = trimmed.match(/^CHEST (\d+) OF (\d+)$/i))) {
    return `第 ${m[1]} / ${m[2]} 号神秘宝箱`;
  }
  if ((m = trimmed.match(/^(.+) BID \$(\d+)!$/i))) {
    return `${m[1]} 出价 $${m[2]}！`;
  }
  if ((m = trimmed.match(/^TOP BID \$(\d+)!$/i))) {
    return `当前最高 $${m[1]}！`;
  }
  if ((m = trimmed.match(/^PASSED · \$(\d+)$/i))) {
    return `已放弃 · $${m[1]}`;
  }
  if ((m = trimmed.match(/^\$(\d+) cash · Worth \$(\d+)$/i))) {
    return `现金 $${m[1]} · 总值 $${m[2]}`;
  }
  if ((m = trimmed.match(/^\$(\d+) cash \+ \$(\d+) loot$/i))) {
    return `$${m[1]} 现金 + $${m[2]} 宝藏`;
  }
  if ((m = trimmed.match(/^(.+) paid \$(\d+) \(2X MONOPOLY!\) rent to (.+)!$/i))) {
    return `${m[1]} 向 ${m[3]} 支付 $${m[2]} 租金（2倍垄断）！`;
  }
  if ((m = trimmed.match(/^Lucky Card: Property Boom! (.+) Lv\.(\d+)$/i))) {
    return `幸运卡：地产爆发！${translateGameText(m[1], lang)} 升至 ${m[2]} 级`;
  }
  if ((m = trimmed.match(/^Lucky Card: Tax Rebate! (.+) \+\$160$/i))) {
    return `幸运卡：退税福利！${m[1]} +$160`;
  }
  if ((m = trimmed.match(/^(.+) got a Leaf Shield & swung to #(\d+)!$/i))) {
    return `${m[1]} 获得树叶护盾并飞跃至 #${m[2]}！`;
  }
  if ((m = trimmed.match(/^(.+) found a Leaf Shield on Mystery Tile!$/i))) {
    return `${m[1]} 在神秘格获得了树叶护盾！`;
  }
  if ((m = trimmed.match(/^(.+)'s Leaf Shield blocked a Banana slip!$/i))) {
    return `${m[1]} 的树叶护盾挡住了香蕉滑倒！`;
  }
  if ((m = trimmed.match(/^(.+)'s Leaf Shield chased away the Snake!$/i))) {
    return `${m[1]} 的树叶护盾赶走了丛林巨蛇！`;
  }
  if ((m = trimmed.match(/^ROUND (\d+)\/(\d+) · (\d+)s · SHRINK!$/i))) {
    return `第 ${m[1]}/${m[2]} 回合 · ${m[3]}秒 · 缩圈!`;
  }
  if ((m = trimmed.match(/^SPEED ROUND — WAVE (\d+)!$/i))) {
    return `极速轮 — 第 ${m[1]} 波！`;
  }
  if ((m = trimmed.match(/^VIP \+(\d+)!$/i))) {
    return `贵宾单 +${m[1]}！`;
  }
  if ((m = trimmed.match(/^\+(\d+) x(\d+)!$/i))) {
    return `+${m[1]} (${m[2]}连击)！`;
  }
  if ((m = trimmed.match(/^2X GOLDEN GAVEL · CHEST (\d+)\/(\d+)!$/i))) {
    return `2倍黄金拍卖 · 第 ${m[1]}/${m[2]} 宝箱！`;
  }
  if ((m = trimmed.match(/^(.+) PASSED EARLY \(\+\$60\)!$/i))) {
    return `${m[1]} 抢先弃拍 (+$60)！`;
  }
  if ((m = trimmed.match(/^QUACK! (.+) paid \$(\d+) for a Duck \(\$(\d+)\)!$/i))) {
    return `嘎嘎！${m[1]} 花 $${m[2]} 拍下小黄鸭 ($${m[3]})！`;
  }
  if ((m = trimmed.match(/^(.+) WON \$(\d+) \(([+-]\$\d+)\)!$/i))) {
    return `${m[1]} 赢得 $${m[2]} (${m[3]})！`;
  }
  if ((m = trimmed.match(/^NO BIDS! Chest held \$(\d+)!$/i))) {
    return `流拍！宝箱里藏着 $${m[1]}！`;
  }
  if ((m = trimmed.match(/^(\d+)\s+—\s+(\d+)\s+\(FIRST TO (\d+)\)$/i))) {
    return `${m[1]}  —  ${m[2]}  (先得 ${m[3]} 球)`;
  }
  if ((m = trimmed.match(/^(\d+) goals · (\d+) pts$/i))) {
    return `${m[1]} 球 · ${m[2]} 分`;
  }
  if ((m = trimmed.match(/^(\d+) cards left$/i))) {
    return `剩余 ${m[1]} 张`;
  }
  if ((m = trimmed.match(/^(\d+) cards · (\d+) pts$/i))) {
    return `${m[1]} 张牌 · ${m[2]} 分`;
  }
  if ((m = trimmed.match(/^(\d+) cards · (\d+) caught$/i))) {
    return `${m[1]} 张牌 · 抓谎 ${m[2]} 次`;
  }
  if ((m = trimmed.match(/^YOUR TURN · (\d+)s$/i))) {
    return `轮到你 · ${m[1]}秒`;
  }
  if ((m = trimmed.match(/^BLUFF CHECK · (\d+)s$/i))) {
    return `抓谎时刻 · ${m[1]}秒`;
  }
  if ((m = trimmed.match(/^(.+) PLAYED (\d+)× ([A-Z0-9]+)!$/i))) {
    return `${m[1]} 扣出了 ${m[2]} 张「${m[3]}」！`;
  }
  if ((m = trimmed.match(/^(.+) CALLED BLUFF!$/i))) {
    return `${m[1]} 大喊：抓谎！！`;
  }
  if ((m = trimmed.match(/^LIAR! (.+) TOOK \+(\d+) CARDS!$/i))) {
    return `抓谎成功！${m[1]} 吞下 +${m[2]} 张牌！`;
  }
  if ((m = trimmed.match(/^TRUTH! (.+) TOOK \+(\d+) CARDS!$/i))) {
    return `竟是真牌！${m[1]} 吞下 +${m[2]} 张牌！`;
  }
  if ((m = trimmed.match(/^STACK \+(\d+)!$/i))) {
    return `连环加牌 +${m[1]}！`;
  }
  if ((m = trimmed.match(/^DREW \+(\d+)!$/i))) {
    return `罚抽 +${m[1]} 张！`;
  }
  if ((m = trimmed.match(/^(.+) PASSED \(TIMEOUT\)$/i))) {
    return `${m[1]} 超时自动过牌`;
  }
  if ((m = trimmed.match(/^\+(\d+)!$/i))) {
    return `+${m[1]}！`;
  }
  if ((m = trimmed.match(/^(\d+) pts$/i))) {
    return `${m[1]} 分`;
  }
  if ((m = trimmed.match(/^ROUND (\d+)$/i))) {
    return `第 ${m[1]} 回合`;
  }
  if ((m = trimmed.match(/^NEW BID \$(\d+)!$/i))) {
    return `最新出价 $${m[1]}！`;
  }

  // --- Card Deck & Card Private States (Packs 1–7) ---
  if ((m = trimmed.match(/^BOOM RISK (\d+)% · DECK (\d+)$/i))) {
    return `爆炸风险 ${m[1]}% · 牌库 ${m[2]} 张`;
  }
  if ((m = trimmed.match(/^BOOM DECK:\s*(\d+)$/i))) {
    return `炸弹牌库：${m[1]} 张`;
  }
  if ((m = trimmed.match(/^BOMBS HIDDEN:\s*(\d+)\s+·\s+RISK\s+(\d+)%$/i))) {
    return `暗藏炸弹：${m[1]} · 爆率 ${m[2]}%`;
  }
  if ((m = trimmed.match(/^DRAWS OWED:\s*x(\d+)$/i))) {
    return `待摸次数：×${m[1]}`;
  }
  if ((m = trimmed.match(/^DRAW \((\d+) LEFT\)$/i))) {
    return `摸牌 (还需 ${m[1]} 张)`;
  }
  if ((m = trimmed.match(/^DRAW x(\d+)$/i))) {
    return `连摸 ×${m[1]}`;
  }
  if ((m = trimmed.match(/^DREW \+(\d+)$/i))) {
    return `摸了 +${m[1]} 张`;
  }
  if ((m = trimmed.match(/^DEFUSE x(\d+)$/i))) {
    return `拆弹卡 ×${m[1]}`;
  }
  if ((m = trimmed.match(/^DECK:\s*(\d+)$/i))) {
    return `牌库：${m[1]} 张`;
  }
  if ((m = trimmed.match(/^SETS (\d+)\/(\d+) · BANK \$(\d+)M · PLAYS (\d+)$/i))) {
    return `套组 ${m[1]}/${m[2]} · 资金 $${m[3]}M · 可出 ${m[4]} 张`;
  }
  if ((m = trimmed.match(/^GOAL:\s*(\d+)\s+FULL SETS\s+·\s+PLAYS LEFT:\s*(\d+)$/i))) {
    return `目标：${m[1]} 套全产 · 剩余可出 ${m[2]} 张`;
  }
  if ((m = trimmed.match(/^FIRST TO (\d+) PROPERTY SETS WINS!$/i))) {
    return `率先凑齐 ${m[1]} 套地产获胜！`;
  }
  if ((m = trimmed.match(/^(\d+) Sets · \$(\d+)M Bank$/i))) {
    return `${m[1]} 套地产 · $${m[2]}M 银行`;
  }
  if ((m = trimmed.match(/^(\d+)\/(\d+) sets · \$(\d+)M$/i))) {
    return `${m[1]}/${m[2]} 套 · $${m[3]}M`;
  }
  if ((m = trimmed.match(/^\$(\d+)M · (\d+)\/(\d+) SETS$/i))) {
    return `$${m[1]}M · ${m[2]}/${m[3]} 套`;
  }
  if ((m = trimmed.match(/^WILD ([A-Z]+)$/i))) {
    return `万能${translateGameText(m[1], lang)}`;
  }
  if ((m = trimmed.match(/^BANKED \$(\d+)M$/i))) {
    return `存入 $${m[1]}M`;
  }
  if ((m = trimmed.match(/^\+\$(\d+)M$/i))) {
    return `+$${m[1]}M`;
  }
  if ((m = trimmed.match(/^RENT \+\$(\d+)M$/i))) {
    return `收租 +$${m[1]}M`;
  }
  if ((m = trimmed.match(/^STOLE ([A-Z]+)!$/i))) {
    return `偷走${translateGameText(m[1], lang)}地契！`;
  }
  if ((m = trimmed.match(/^DEBT \+\$(\d+)M$/i))) {
    return `讨债 +$${m[1]}M`;
  }
  if ((m = trimmed.match(/^(\d+)\/7 CARDS · \+(\d+) PTS$/i))) {
    return `${m[1]}/7 张不重 · +${m[2]} 分`;
  }
  if ((m = trimmed.match(/^(\d+)\/7 unique$/i))) {
    return `${m[1]}/7 张不同`;
  }
  if ((m = trimmed.match(/^FLIP 7 UNIQUE = \+(\d+) JACKPOT · GOAL (\d+) PTS$/i))) {
    return `7张不重 = +${m[1]} 大奖 · 目标 ${m[2]} 分`;
  }
  if ((m = trimmed.match(/^(\d+) pts total$/i))) {
    return `累计 ${m[1]} 分`;
  }
  if ((m = trimmed.match(/^(\d+) pts · \+(\d+)$/i))) {
    return `${m[1]} 分 · +${m[2]}`;
  }
  if ((m = trimmed.match(/^(\d+) PTS \(\+(\d+)\)$/i))) {
    return `${m[1]} 分 (+${m[2]})`;
  }
  if ((m = trimmed.match(/^FLIPPED (\d+)$/i))) {
    return `翻出 ${m[1]}`;
  }
  if ((m = trimmed.match(/^BUST \((\d+)\)!$/i))) {
    return `撞牌爆了 (${m[1]})！`;
  }
  if ((m = trimmed.match(/^\+(\d+) BONUS$/i))) {
    return `+${m[1]} 加分`;
  }
  if ((m = trimmed.match(/^BANKED \+(\d+)$/i))) {
    return `安全入账 +${m[1]}`;
  }
  if ((m = trimmed.match(/^STAY \+(\d+)$/i))) {
    return `见好就收 +${m[1]}`;
  }
  if ((m = trimmed.match(/^HIT \(FLIP CARD\)$/i))) {
    return '继续翻牌 (+1张)';
  }
  if ((m = trimmed.match(/^STAY \(\+(\d+) PTS\)$/i))) {
    return `收手 (+${m[1]} 分)`;
  }
  if ((m = trimmed.match(/^COINS: (\d+) · INFLUENCE: (\d+)\/2$/i))) {
    return `金币：${m[1]} · 势力：${m[2]}/2`;
  }
  if ((m = trimmed.match(/^COURT ROUND (\d+)$/i))) {
    return `宫廷第 ${m[1]} 轮`;
  }
  if ((m = trimmed.match(/^ALIVE:\s*(\d+)$/i))) {
    return `存活：${m[1]} 人`;
  }
  if ((m = trimmed.match(/^(.+) CLAIMS$/i))) {
    return `${m[1]} 宣称`;
  }
  if ((m = trimmed.match(/^Roles · (\d+) Coins$/i))) {
    return `亮牌 · ${m[1]} 金币`;
  }
  if ((m = trimmed.match(/^Exiled · (\d+) pts$/i))) {
    return `已放逐 · ${m[1]} 分`;
  }
  if ((m = trimmed.match(/^(\d+) coins · (\d+) roles$/i))) {
    return `${m[1]} 金币 · ${m[2]} 张身份`;
  }
  if ((m = trimmed.match(/^(\d+) COINS$/i))) {
    return `${m[1]} 金币`;
  }
  if ((m = trimmed.match(/^COUP -> (.+)!$/i))) {
    return `政变消灭 -> ${m[1]}！`;
  }
  if ((m = trimmed.match(/^STOLE (\d+)$/i))) {
    return `抢劫 +${m[1]} 金币`;
  }
  if ((m = trimmed.match(/^LOST (\d+)!$/i))) {
    return `失去 ${m[1]}！`;
  }
  if ((m = trimmed.match(/^ROUND (\d+)\/(\d+) · PLATE \+(\d+) · TOTAL (\d+)$/i))) {
    return `第 ${m[1]}/${m[2]} 轮 · 本盘 +${m[3]} · 总分 ${m[4]}`;
  }
  if ((m = trimmed.match(/^PICK (\d+)\/(\d+) · (\d+)s TO DRAFT$/i))) {
    return `第 ${m[1]}/${m[2]} 选 · 还剩 ${m[3]} 秒选牌`;
  }
  if ((m = trimmed.match(/^PICK (\d+)\/(\d+) · REVEALING PLATES!$/i))) {
    return `第 ${m[1]}/${m[2]} 选 · 正在结算餐盘！`;
  }
  if ((m = trimmed.match(/^STEP (\d+)\/(\d+)$/i))) {
    return `第 ${m[1]}/${m[2]} 步`;
  }
  if ((m = trimmed.match(/^(\d+) pts · (\d+) Puddings$/i))) {
    return `${m[1]} 分 · ${m[2]} 份布丁`;
  }
  if ((m = trimmed.match(/^(\d+) CARDS$/i))) {
    return `${m[1]} 张牌`;
  }
  if ((m = trimmed.match(/^(\d+) cards · ([A-Z]+)$/i))) {
    return `${m[1]} 张牌 · ${translateGameText(m[2], lang)}`;
  }
  if ((m = trimmed.match(/^PENALTY STACK:\s*\+(\d+)$/i))) {
    return `加牌罚抽堆：+${m[1]}`;
  }
  if ((m = trimmed.match(/^ACTIVE COLOR:\s*(.+)$/i))) {
    return `当前颜色：${translateGameText(m[1], lang)}`;
  }
  if ((m = trimmed.match(/^DIR:\s*(CW|CCW)$/i))) {
    return `方向：${translateGameText(m[1], lang)}`;
  }
  if ((m = trimmed.match(/^([↻↺])\s*(\d+)s TURN\s+·\s+#(\d+)$/i))) {
    return `${m[1]} ${m[2]}秒回合 · 第${m[3]}轮`;
  }
  if ((m = trimmed.match(/^ROUND (\d+) · BLUFF CHECK (\d+)s$/i))) {
    return `第 ${m[1]} 轮 · 抓谎时刻 ${m[2]}秒`;
  }
  if ((m = trimmed.match(/^ROUND (\d+) · (\d+)s TURN$/i))) {
    return `第 ${m[1]} 轮 · ${m[2]}秒出牌`;
  }
  if ((m = trimmed.match(/^Select 1[–-]3 cards & claim ([A-Z0-9]+)! \((\d+)s\)$/i))) {
    return `选 1–3 张牌并宣称「${m[1]}」！(${m[2]}秒)`;
  }
  if ((m = trimmed.match(/^(\d+)× ([A-Z0-9]+)\?$/i))) {
    return `${m[1]} 张 ${m[2]}?`;
  }
  if ((m = trimmed.match(/^Stack \+2\/\+4 or Draw \+(\d+)!$/i))) {
    return `接力 +2/+4 或罚摸 +${m[1]} 张！`;
  }
  if ((m = trimmed.match(/^Your turn! Tap a glowing card \((\d+)s\)$/i))) {
    return `轮到你了！点击高亮卡牌 (${m[1]}秒)`;
  }

  // --- Pack 1 New 8 Board Games ---
  if ((m = trimmed.match(/^TURN:\s*(.+)\s+\((\d+)s\)$/i))) {
    return `当前回合：${m[1]} (${m[2]}秒)`;
  }
  if ((m = trimmed.match(/^ROUND (\d+)\/(\d+) · STAR (\d+) AWAY$/i))) {
    return `第 ${m[1]}/${m[2]} 轮 · 距星星 ${m[3]} 格`;
  }
  if ((m = trimmed.match(/^GOAL:\s*(\d+) CONNECTS$/i))) {
    return `目标：${m[1]} 次四连`;
  }
  if ((m = trimmed.match(/^FLEET HULLS LEFT:\s*(\d+)$/i))) {
    return `剩余舰体格：${m[1]}`;
  }
  if ((m = trimmed.match(/^ROUND (\d+)\/(\d+) · BOSS ♥(\d+)\/(\d+)$/i))) {
    return `第 ${m[1]}/${m[2]} 轮 · 巨龙 ♥${m[3]}/${m[4]}`;
  }
  if ((m = trimmed.match(/^TURN (\d+)\/(\d+)$/i))) {
    return `第 ${m[1]}/${m[2]} 步`;
  }
  if ((m = trimmed.match(/^(.+):\s*(\d+) Discs$/i))) {
    return `${m[1]}：${m[2]} 棋`;
  }
  if ((m = trimmed.match(/^YOUR TURN · (\d+) Discs$/i))) {
    return `你的回合 · ${m[1]} 棋`;
  }
  if ((m = trimmed.match(/^(\d+) Discs(?: Owned)? · (\d+) Flips$/i))) {
    return `${m[1]} 枚棋子 · 翻转 ${m[2]} 次`;
  }
  if ((m = trimmed.match(/^NOVA FLIP \((\d+)\)!$/i))) {
    return `超新星大反转 (${m[1]})！`;
  }
  if ((m = trimmed.match(/^💥 (.+) detonated a 3x3 Nova Flip Bomb!$/i))) {
    return `💥 ${m[1]} 引爆了 3×3 超新星反转炸弹！`;
  }
  if ((m = trimmed.match(/^CONNECTED 4! \((\d+)\/(\d+)\)$/i))) {
    return `四子连线！(${m[1]}/${m[2]})`;
  }
  if ((m = trimmed.match(/^(.+) CONNECTED 4! \((\d+)\/(\d+)\)$/i))) {
    return `${m[1]} 完成四子连线！(${m[2]}/${m[3]})`;
  }
  if ((m = trimmed.match(/^(\d+) Connects · (\d+) Tokens$/i))) {
    return `${m[1]} 次连线 · 落子 ${m[2]} 枚`;
  }
  if ((m = trimmed.match(/^(\d+)\/3 Home · (\d+) Captures$/i))) {
    return `${m[1]}/3 归位 · 踩吃 ${m[2]} 次`;
  }
  if ((m = trimmed.match(/^TOKEN #(\d+) HOME! \(\+120\)$/i))) {
    return `#${m[1]}号棋子入库！(+120)`;
  }
  if ((m = trimmed.match(/^(.+) WINS LUDO ROYALE!$/i))) {
    return `${m[1]} 赢得皇家飞行棋冠军！`;
  }
  if ((m = trimmed.match(/^CAPTURED (.+)! \(\+75\)$/i))) {
    return `踩吃 ${m[1]}！(+75)`;
  }
  if ((m = trimmed.match(/^(\d+) Direct Hits · (\d+) pts$/i))) {
    return `${m[1]} 次命中 · ${m[2]} 分`;
  }
  if ((m = trimmed.match(/^SONAR PING:\s*(\d+) TARGETS?$/i))) {
    return `声呐扫描：发现 ${m[1]} 个目标`;
  }
  if ((m = trimmed.match(/^(\d+) Captures · (\d+) Kings$/i))) {
    return `吃子 ${m[1]} · 升王 ${m[2]}`;
  }
  if ((m = trimmed.match(/^(.+) CROWNED A KING!$/i))) {
    return `${m[1]} 棋子加冕为王！`;
  }
  if ((m = trimmed.match(/^(\d+) Pucks Pocketed · (\d+) Queens$/i))) {
    return `入袋 ${m[1]} 球 · 红后 ${m[2]} 次`;
  }
  if ((m = trimmed.match(/^POCKETED \+(\d+)!$/i))) {
    return `进袋 +${m[1]}！`;
  }
  if ((m = trimmed.match(/^(\d+) Golden Stars · (\d+) Coins$/i))) {
    return `${m[1]} 颗金星 · ${m[2]} 金币`;
  }
  if ((m = trimmed.match(/^(.+) GOT A GOLDEN STAR!$/i))) {
    return `${m[1]} 获得了黄金星星！`;
  }
  if ((m = trimmed.match(/^ZAP TRAP -(\d+)!$/i))) {
    return `踩到电击陷阱 -${m[1]}！`;
  }
  if ((m = trimmed.match(/^STOLE (\d+) COINS!$/i))) {
    return `偷走 ${m[1]} 金币！`;
  }
  if ((m = trimmed.match(/^(\d+) Gold · (\d+) Monsters Slain$/i))) {
    return `${m[1]} 金币 · 斩怪 ${m[2]} 只`;
  }
  if ((m = trimmed.match(/^⚔️ ENCOUNTER:\s*(.+?)\s+\(PWR (\d+)\)!$/i))) {
    return `⚔️ 遭遇战：${translateGameText(m[1], lang)}（战力 ${m[2]}）！`;
  }
  if ((m = trimmed.match(/^⚔ (.+) \(1-6 \+(\d+)\) VS (.+?) \(PWR (\d+)\) — PRESS A TO STRIKE!$/i))) {
    return `⚔ ${m[1]} (1-6 +${m[2]}) 对战 ${translateGameText(m[3], lang)} (战力 ${m[4]}) — 按 A 出击！`;
  }
  if ((m = trimmed.match(/^SLAIN (.+?)! \+(\d+)G$/i))) {
    return `斩杀 ${translateGameText(m[1], lang)}！+${m[2]}金`;
  }
  if ((m = trimmed.match(/^GRAZED (.+?) \(\+15G, -2 HP\)$/i))) {
    return `激战 ${translateGameText(m[1], lang)} (+15金, -2血)`;
  }
  if ((m = trimmed.match(/^TREASURE \+(\d+)G & \+1 ATK!$/i))) {
    return `宝箱 +${m[1]}金 且 +1 攻击！`;
  }
  if ((m = trimmed.match(/^HEALED \+(\d+)G!$/i))) {
    return `营地回满血 +${m[1]}金！`;
  }
  if ((m = trimmed.match(/^⚠️ (.+) triggered (.+?) \(-(\d+) HP\)!$/i))) {
    return `⚠️ ${m[1]} 触发了 ${translateGameText(m[2], lang)} (-${m[3]} 生命)！`;
  }
  if ((m = trimmed.match(/^(.+?) \(-(\d+) HP\)!$/i))) {
    return `${translateGameText(m[1], lang)} (-${m[2]} 生命)！`;
  }
  if ((m = trimmed.match(/^DRAGON HIT FOR (\d+) DMG!$/i))) {
    return `重创巨龙 ${m[1]} 点伤害！`;
  }
  if ((m = trimmed.match(/^(.+) SLEW THE DRAGON BOSS!$/i))) {
    return `${m[1]} 屠龙成功！`;
  }
  if ((m = trimmed.match(/^([A-Za-z0-9_ ()♥+-]+)\s*\((\d+) LEFT\)$/i))) {
    return `${translateGameText(m[1], lang)} (${m[2]} 剩)`;
  }

  // --- Packs 2–7 Dynamic Canvas Chips, Banners & Results ---
  if ((m = trimmed.match(/^RD (\d+)\/(\d+)$/i))) {
    return `第 ${m[1]}/${m[2]} 轮`;
  }
  if ((m = trimmed.match(/^RD (\d+)\/(\d+) · ×(\d+)$/i))) {
    return `第 ${m[1]}/${m[2]} 轮 · ×${m[3]}`;
  }
  if ((m = trimmed.match(/^RD (\d+) · (\d+)s$/i))) {
    return `第 ${m[1]} 轮 · ${m[2]}秒`;
  }
  if ((m = trimmed.match(/^R(\d+)\/(\d+) · (\d+)s$/i))) {
    return `第 ${m[1]}/${m[2]} 轮 · ${m[3]}秒`;
  }
  if ((m = trimmed.match(/^Q(\d+)\/(\d+) · (\d+)s$/i))) {
    return `第 ${m[1]}/${m[2]} 题 · ${m[3]}秒`;
  }
  if ((m = trimmed.match(/^QUESTION (\d+) \/ (\d+)$/i))) {
    return `第 ${m[1]} / ${m[2]} 题`;
  }
  if ((m = trimmed.match(/^WAVE (\d+) · (\d+)s$/i))) {
    return `第 ${m[1]} 波 · ${m[2]}秒`;
  }
  if ((m = trimmed.match(/^FRAME (\d+)\/(\d+) · (\d+)s$/i))) {
    return `第 ${m[1]}/${m[2]} 格 · ${m[3]}秒`;
  }
  if ((m = trimmed.match(/^HOLE (\d+) · (\d+)s$/i))) {
    return `第 ${m[1]} 洞 · ${m[2]}秒`;
  }
  if ((m = trimmed.match(/^TRICK (\d+) · (\d+)s$/i))) {
    return `第 ${m[1]} 墩 · ${m[2]}秒`;
  }
  if ((m = trimmed.match(/^HAND (\d+) · (\d+)s$/i))) {
    return `第 ${m[1]} 局 · ${m[2]}秒`;
  }
  if ((m = trimmed.match(/^CLASH (\d+) · (\d+)s$/i))) {
    return `第 ${m[1]} 阵 · ${m[2]}秒`;
  }
  if ((m = trimmed.match(/^ENDS (\d+) · (\d+) · (\d+)s$/i))) {
    return `第 ${m[1]}·${m[2]} 局 · ${m[3]}秒`;
  }
  if ((m = trimmed.match(/^LEFT (\d+) — (\d+) RIGHT$/i))) {
    return `左队 ${m[1]} — ${m[2]} 右队`;
  }
  if ((m = trimmed.match(/^LEFT (\d+) — (\d+) RIGHT \(TO (\d+)\)$/i))) {
    return `左队 ${m[1]} — ${m[2]} 右队 (先到 ${m[3]} 分)`;
  }
  if ((m = trimmed.match(/^SKY CLIMB · (\d+)s$/i))) {
    return `冲向云霄 · ${m[1]}秒`;
  }
  if ((m = trimmed.match(/^GLASS BRIDGE · (\d+)s$/i))) {
    return `玻璃桥求生 · ${m[1]}秒`;
  }
  if ((m = trimmed.match(/^(\d+)m · (\d+) SPD$/i))) {
    return `${m[1]}米 · 速度 ${m[2]}`;
  }
  if ((m = trimmed.match(/^MINES LEFT:\s*(\d+)$/i))) {
    return `剩余地雷：${m[1]}`;
  }
  if ((m = trimmed.match(/^TASKS (\d+)\/(\d+)$/i))) {
    return `任务 ${m[1]}/${m[2]}`;
  }
  if ((m = trimmed.match(/^ARTIST:\s*(.+?)\s+·\s+RD (\d+)\/(\d+)$/i))) {
    return `灵魂画手：${m[1]} · 第 ${m[2]}/${m[3]} 轮`;
  }
  if ((m = trimmed.match(/^WORD CHAIN · (\d+) LINKS$/i))) {
    return `词语接龙 · ${m[1]} 连击`;
  }
  if ((m = trimmed.match(/^MIDNIGHT WEREWOLF · DAY (\d+)$/i))) {
    return `午夜狼人杀 · 第 ${m[1]} 天`;
  }
  if ((m = trimmed.match(/^NIGHT (\d+)$/i))) {
    return `第 ${m[1]} 夜`;
  }
  if ((m = trimmed.match(/^DAY (\d+) VOTE$/i))) {
    return `第 ${m[1]} 天投票`;
  }
  if ((m = trimmed.match(/^SPY WORD RD (\d+)\/(\d+)$/i))) {
    return `谁是卧底 · 第 ${m[1]}/${m[2]} 轮`;
  }
  if ((m = trimmed.match(/^CIVILIAN:\s*(.+)$/i))) {
    return `平民词：${m[1]}`;
  }
  if ((m = trimmed.match(/^SPY:\s*(.+)$/i))) {
    return `卧底词：${m[1]}`;
  }
  if ((m = trimmed.match(/^TAVERN DICE RD (\d+)$/i))) {
    return `大话骰 · 第 ${m[1]} 轮`;
  }
  if ((m = trimmed.match(/^ACTUAL MATCHING:\s*(\d+) DICE$/i))) {
    return `开骰结果：共 ${m[1]} 颗匹配`;
  }
  if ((m = trimmed.match(/^(.+) · (PURE 齋|1s WILD)$/i))) {
    return `${m[1]} · ${translateGameText(m[2], lang)}`;
  }
  if ((m = trimmed.match(/^MAHJONG RD (\d+)\/(\d+) · WALL (\d+)$/i))) {
    return `麻将第 ${m[1]}/${m[2]} 局 · 余牌 ${m[3]}`;
  }
  if ((m = trimmed.match(/^WALL:\s*(\d+) TILES$/i))) {
    return `牌墙余 ${m[1]} 张`;
  }
  if ((m = trimmed.match(/^LAST DISCARD · (.+)$/i))) {
    return `刚打出 · ${m[1]}`;
  }
  if ((m = trimmed.match(/^CONGKAK RD (\d+)\/(\d+)$/i))) {
    return `马来播棋 · 第 ${m[1]}/${m[2]} 轮`;
  }
  if ((m = trimmed.match(/^GULI LEFT:\s*(\d+)$/i))) {
    return `余弹珠：${m[1]} 颗`;
  }
  if ((m = trimmed.match(/^WASH \((\d+)\) \+45$/i))) {
    return `洗盘 (${m[1]}) +45`;
  }
  if ((m = trimmed.match(/^PLATES:\s*(\d+)$/i))) {
    return `净盘：${m[1]}`;
  }
  if ((m = trimmed.match(/^SECRET:\s*(.+)$/i))) {
    return `底牌：${m[1]}`;
  }
  if ((m = trimmed.match(/^LINK:\s*(.+?)\s*\/\s*(.+)$/i))) {
    return `接龙字：${m[1]} / ${m[2]}`;
  }
  if ((m = trimmed.match(/^🔥 STREAK ×(\d+)$/i))) {
    return `🔥 连胜 ×${m[1]}`;
  }
  if ((m = trimmed.match(/^BEAT:\s*(.+)$/i))) {
    return `需压过：${translateGameText(m[1], lang)}`;
  }
  if ((m = trimmed.match(/^LOCK:\s*(.+)$/i))) {
    return `锁定：${translateGameText(m[1], lang)}`;
  }
  if ((m = trimmed.match(/^锁定:\s*(.+)$/))) {
    return `锁定：${translateGameText(m[1], lang)}`;
  }
  if ((m = trimmed.match(/^已锁定：(.+)$/))) {
    return `已锁定：${translateGameText(m[1], lang)}`;
  }
  if ((m = trimmed.match(/^LOCK 3 BASE \((\d+)\/3\)$/i))) {
    return `锁定3张底牌 (${m[1]}/3)`;
  }
  if ((m = trimmed.match(/^BET (\d+)$/i))) {
    return `下注 ${m[1]}`;
  }
  if ((m = trimmed.match(/^(\d+) MELDS$/i))) {
    return `${m[1]} 组`;
  }
  if ((m = trimmed.match(/^(\d+) SEQ$/i))) {
    return `${m[1]} 连线`;
  }
  if ((m = trimmed.match(/^(\d+) Chips$/i))) {
    return `${m[1]} 筹码`;
  }
  if ((m = trimmed.match(/^(\d+) CNY Chips$/i))) {
    return `${m[1]} 新年筹码`;
  }
  if ((m = trimmed.match(/^(\d+) Cards(?: Left)?$/i))) {
    return `余 ${m[1]} 张牌`;
  }
  if ((m = trimmed.match(/^(\d+) DICE · (\d+)$/i))) {
    return `${m[1]} 颗骰 · ${m[2]} 分`;
  }
  if ((m = trimmed.match(/^(\d+) VOTES · (\d+)$/i))) {
    return `${m[1]} 票 · ${m[2]} 分`;
  }
  if ((m = trimmed.match(/^(\d+) VOTES$/i))) {
    return `${m[1]} 票`;
  }
  if ((m = trimmed.match(/^(\d+) CHIPS(?: · BET (\d+))?(?: \(([+-]?\d+)\))?$/i))) {
    const betPart = m[2] ? ` · 注${m[2]}` : '';
    const diffPart = m[3] ? ` (${m[3]})` : '';
    return `${m[1]} 筹码${betPart}${diffPart}`;
  }
  if ((m = trimmed.match(/^PAIR ([A-Z0-9]+)s ×3!$/i))) {
    return `对 ${m[1]} ×3！`;
  }
  if ((m = trimmed.match(/^PAIR ([A-Z0-9]+)s$/i))) {
    return `对 ${m[1]}`;
  }
  if ((m = trimmed.match(/^TRIPLE ([A-Z0-9]+)s$/i))) {
    return `三张 ${m[1]}`;
  }
  if ((m = trimmed.match(/^FOUR ([A-Z0-9]+)s!?$/i))) {
    return `四条 ${m[1]} 炸弹`;
  }
  if ((m = trimmed.match(/^FULL HOUSE ([A-Z0-9]+)s$/i))) {
    return `葫芦 (${m[1]}带2)`;
  }
  if ((m = trimmed.match(/^FLUSH (.+)$/i))) {
    return `同花 ${m[1]}`;
  }
  if ((m = trimmed.match(/^NGAU (\d+) ×(\d+)$/i))) {
    return `牛 ${m[1]} ×${m[2]}`;
  }
  if ((m = trimmed.match(/^NGAU (\d+)$/i))) {
    return `牛 ${m[1]}`;
  }
  if ((m = trimmed.match(/^STAND \((\d+)\)$/i))) {
    return `停牌 (${m[1]}点)`;
  }
  if ((m = trimmed.match(/^BANKER (.+)'S TURN \(庄家操作\)!$/i))) {
    return `庄家 ${m[1]} 的回合！`;
  }
  if ((m = trimmed.match(/^BANKER (.+)$/i))) {
    return `庄家：${translateGameText(m[1], lang)}`;
  }
  if ((m = trimmed.match(/^庄 (.+)$/))) {
    return `庄 ${translateGameText(m[1], lang)}`;
  }
  if ((m = trimmed.match(/^(\d+)-CARD STRAIGHT$/i))) {
    return `${m[1]} 张顺子`;
  }
  if ((m = trimmed.match(/^BOMB ([A-Z0-9]+)×4!$/i))) {
    return `四条炸弹 ${m[1]}×4！`;
  }
  if ((m = trimmed.match(/^LIE BY (.+)$/i))) {
    return `${m[1]} 的假答案`;
  }
  if ((m = trimmed.match(/^(.+) WINS THE POT WITH (.+)!$/i))) {
    return `${m[1]} 凭「${translateGameText(m[2], lang)}」赢下奖池！`;
  }
  if ((m = trimmed.match(/^FOOLED (\d+)!$/i))) {
    return `骗到 ${m[1]} 人！`;
  }
  if ((m = trimmed.match(/^TRUTH \+(\d+)$/i))) {
    return `找对真相 +${m[1]}`;
  }
  if ((m = trimmed.match(/^AGENT \+(\d+)$/i))) {
    return `特工命中 +${m[1]}`;
  }
  if ((m = trimmed.match(/^(.+) DECODED AGENT (.+)!$/i))) {
    return `${m[1]} 破译特工词「${m[2]}」！`;
  }
  if ((m = trimmed.match(/^💀 (.+) TRIGGERED THE ASSASSIN \((.+)\)!$/i))) {
    return `💀 ${m[1]} 踩中刺客暗雷（${m[2]}）！`;
  }
  if ((m = trimmed.match(/^ANSWER:\s*(.+?)!$/i))) {
    return `答案揭晓：${translateGameText(m[1], lang)}！`;
  }
  if ((m = trimmed.match(/^THE TRUTH WAS:\s*(.+?)!$/i))) {
    return `真实冷知识：${translateGameText(m[1], lang)}！`;
  }
  if ((m = trimmed.match(/^TIME UP · WORD WAS (.+)!$/i))) {
    return `时间到 · 谜底单词是 ${m[1]}！`;
  }
  if ((m = trimmed.match(/^ROUND (\d+) · CRACK THE 5-LETTER WORD!$/i))) {
    return `第 ${m[1]} 轮 · 破译 5 字母单词！`;
  }
  if ((m = trimmed.match(/^ROUND (\d+) · PLANT YOUR LIE!$/i))) {
    return `第 ${m[1]} 轮 · 埋下假答案陷阱！`;
  }
  if ((m = trimmed.match(/^ROUND (\d+) · PIN THE LANDMARK!$/i))) {
    return `第 ${m[1]} 轮 · 地图标出地标！`;
  }
  if ((m = trimmed.match(/^ROUND (\d+) · SYNC MINDS!$/i))) {
    return `第 ${m[1]} 轮 · 心灵共鸣同频！`;
  }
  if ((m = trimmed.match(/^TARGET REVEALED · (\d+)%!$/i))) {
    return `目标揭晓 · ${m[1]}%！`;
  }
  if ((m = trimmed.match(/^([A-D]) · (.+)$/))) {
    return `${m[1]} · ${translateGameText(m[2], lang)}`;
  }

  // --- Shared Rank/Stat Highlights Across Packs 2–7 ---
  if ((m = trimmed.match(/^(\d+)m Peak$/i))) return `最高 ${m[1]}米`;
  if ((m = trimmed.match(/^(\d+) Cuts · (\d+) Len$/i))) return `拦截 ${m[1]} · 长度 ${m[2]}`;
  if ((m = trimmed.match(/^(\d+) Eats · (\d+) Mass$/i))) return `吞噬 ${m[1]} · 体积 ${m[2]}`;
  if ((m = trimmed.match(/^(\d+) Slices · (\d+) pts$/i))) return `切分 ${m[1]} · ${m[2]} 分`;
  if ((m = trimmed.match(/^(LEFT|RIGHT) · (\d+) Pulls$/i))) {
    return `${m[1].toUpperCase() === 'LEFT' ? '左队' : '右队'} · 拉力 ${m[2]}`;
  }
  if ((m = trimmed.match(/^(\d+) Pipes Cleared$/i))) return `穿过 ${m[1]} 根管`;
  if ((m = trimmed.match(/^(\d+) Dash Pts$/i))) return `冲刺 ${m[1]} 分`;
  if ((m = trimmed.match(/^Max Tile (\d+)$/i))) return `最大方块 ${m[1]}`;
  if ((m = trimmed.match(/^(\d+) Mines Flagged$/i))) return `标雷 ${m[1]} 颗`;
  if ((m = trimmed.match(/^(\d+) Geo Pts$/i))) return `地理 ${m[1]} 分`;
  if ((m = trimmed.match(/^(\d+) Mind Pts$/i))) return `默契 ${m[1]} 分`;
  if ((m = trimmed.match(/^(\d+) Word Pts$/i))) return `猜词 ${m[1]} 分`;
  if ((m = trimmed.match(/^(\d+) Quiz Pts$/i))) return `问答 ${m[1]} 分`;
  if ((m = trimmed.match(/^(\d+) Agents Decoded$/i))) return `破译 ${m[1]} 名特工`;
  if ((m = trimmed.match(/^Fooled (\d+) · (\d+) pts$/i))) return `坑到 ${m[1]} 人 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) Ghosts Eaten$/i))) return `吃掉 ${m[1]} 只幽灵`;
  if ((m = trimmed.match(/^(\d+) Bricks Smashed$/i))) return `击碎 ${m[1]} 块砖`;
  if ((m = trimmed.match(/^(\d+) Aliens Blasted$/i))) return `击落 ${m[1]} 艘外星机`;
  if ((m = trimmed.match(/^(\d+) Lines Cleared$/i))) return `消除 ${m[1]} 行`;
  if ((m = trimmed.match(/^(\d+) Crossings$/i))) return `成功过河 ${m[1]} 次`;
  if ((m = trimmed.match(/^(\d+) Summits$/i))) return `登顶 ${m[1]} 次`;
  if ((m = trimmed.match(/^(\d+) Whack Pts$/i))) return `打地鼠 ${m[1]} 分`;
  if ((m = trimmed.match(/^Max Combo ×(\d+)$/i))) return `最高连击 ×${m[1]}`;
  if ((m = trimmed.match(/^(\d+) Skeet Pts$/i))) return `飞碟 ${m[1]} 分`;
  if ((m = trimmed.match(/^(LEFT|RIGHT) · (\d+) Goals$/i))) {
    return `${m[1].toUpperCase() === 'LEFT' ? '左队' : '右队'} · ${m[2]} 球`;
  }
  if ((m = trimmed.match(/^(\d+) Tickets$/i))) return `${m[1]} 张奖券`;
  if ((m = trimmed.match(/^(\d+) Floors Stacked$/i))) return `叠高 ${m[1]} 层`;
  if ((m = trimmed.match(/^(\d+) Gem Pts$/i))) return `宝石 ${m[1]} 分`;
  if ((m = trimmed.match(/^(\d+) Bubbles Popped$/i))) return `消泡 ${m[1]} 颗`;
  if ((m = trimmed.match(/^(\d+) Strikes$/i))) return `${m[1]} 次全倒`;
  if ((m = trimmed.match(/^(\d+) Gems · (\d+) pts$/i))) return `${m[1]} 宝石 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) buckets · (\d+) pts$/i))) return `投进 ${m[1]} 球 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) pts · Hole (\d+)$/i))) return `${m[1]} 分 · 第 ${m[2]} 洞`;
  if ((m = trimmed.match(/^Best Ring ([^·]+) · (\d+) pts$/i))) return `最佳 ${m[1]} 环 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) HRs · (\d+)ft best$/i))) return `${m[1]} 本垒打 · 最远 ${m[2]}尺`;
  if ((m = trimmed.match(/^(\d+) hits · (\d+) pts$/i))) return `击中 ${m[1]} 次 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) ring-outs · (\d+) pts$/i))) return `推落 ${m[1]} 人 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+)m · (\d+) gates$/i))) return `${m[1]}米 · 过 ${m[2]} 门`;
  if ((m = trimmed.match(/^(\d+) potted · (\d+) pts$/i))) return `进袋 ${m[1]} 球 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) unhorses · (\d+) pts$/i))) return `刺落 ${m[1]} 次 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) jumps · (\d+) pts$/i))) return `跳越 ${m[1]} 次 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) crown pts$/i))) return `皇冠 ${m[1]} 分`;
  if ((m = trimmed.match(/^(\d+) tags · (\d+) pts$/i))) return `感染 ${m[1]} 次 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) tiles · (\d+) pts$/i))) return `出牌 ${m[1]} 格 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) chains · (\d+) pts$/i))) return `连珠 ${m[1]} 次 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) captures · (\d+) pts$/i))) return `吃子 ${m[1]} 枚 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) played · (\d+) pts$/i))) return `接龙 ${m[1]} 张 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) hexes · (\d+) pts$/i))) return `占格 ${m[1]} 块 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) borne off · (\d+) pts$/i))) return `归位 ${m[1]} 枚 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) curl pts$/i))) return `冰壶 ${m[1]} 分`;
  if ((m = trimmed.match(/^(\d+) melds · (\d+) pts$/i))) return `凑组 ${m[1]} 次 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) tricks · (\d+) pts$/i))) return `赢墩 ${m[1]} 次 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) clashes · (\d+) pts$/i))) return `胜阵 ${m[1]} 次 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) wins · (\d+) chips$/i))) return `${m[1]} 胜 · ${m[2]} 筹码`;
  if ((m = trimmed.match(/^(\d+) pairs · (\d+) pts$/i))) return `配对 ${m[1]} 对 · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) sequences · (\d+) pts$/i))) return `四连 ${m[1]} 次 · ${m[2]} 分`;
  if ((m = trimmed.match(/^Guard · (\d+) Tags$/i))) return `守卫 · 抓捕 ${m[1]} 人`;
  if ((m = trimmed.match(/^Runner · (\d+) Runs$/i))) return `跑者 · 冲线 ${m[1]} 次`;
  if ((m = trimmed.match(/^(\d+) Runs · (\d+) Tags$/i))) return `冲线 ${m[1]} · 抓捕 ${m[2]}`;
  if ((m = trimmed.match(/^(\d+) Tindih Pins$/i))) return `压制 ${m[1]} 次`;
  if ((m = trimmed.match(/^RPM (\d+)%$/i))) return `转速 ${m[1]}%`;
  if ((m = trimmed.match(/^(\d+) Ring-Outs$/i))) return `撞飞 ${m[1]} 次`;
  if ((m = trimmed.match(/^(\d+) Marbles$/i))) return `${m[1]} 颗弹珠`;
  if ((m = trimmed.match(/^(\d+) Guli Claimed$/i))) return `赢得 ${m[1]} 颗弹珠`;
  if ((m = trimmed.match(/^(LEFT|RIGHT) · (\d+-\d+)$/i))) {
    return `${m[1].toUpperCase() === 'LEFT' ? '左队' : '右队'} · ${m[2]}`;
  }
  if ((m = trimmed.match(/^Left (\d+)$/i))) return `左队 ${m[1]}`;
  if ((m = trimmed.match(/^Right (\d+)$/i))) return `右队 ${m[1]}`;
  if ((m = trimmed.match(/^(\d+) Steps Left$/i))) return `还剩 ${m[1]} 步`;
  if ((m = trimmed.match(/^(\d+) Stomps$/i))) return `踩鞋 ${m[1]} 次`;
  if ((m = trimmed.match(/^(\d+) Shoe Stomps$/i))) return `踩鞋 ${m[1]} 次`;
  if ((m = trimmed.match(/^Rumah:\s*(\d+) · (\d+) Tembak$/i))) return `大仓：${m[1]} · 吃子 ${m[2]}`;
  if ((m = trimmed.match(/^(\d+) in Rumah · (\d+) Tembak$/i))) return `大仓 ${m[1]} 颗 · 吃子 ${m[2]}`;
  if ((m = trimmed.match(/^(.+) READY$/i))) return `${m[1]} 已准备`;
  if ((m = trimmed.match(/^READY (\d+)\.\.\.$/i))) return `倒计时 ${m[1]}...`;
  if ((m = trimmed.match(/^CHAOS:\s*(.+)$/i))) return `混沌事件：${translateGameText(m[1], lang)}`;
  if ((m = trimmed.match(/^HIGH BID:\s*\$(\d+)$/i))) return `最高出价：$${m[1]}`;
  if ((m = trimmed.match(/^RIGHT SCORES! (\d+) - (\d+)$/i))) return `右队得分！${m[1]} - ${m[2]}`;
  if ((m = trimmed.match(/^LEFT SCORES! (\d+) - (\d+)$/i))) return `左队得分！${m[1]} - ${m[2]}`;
  if ((m = trimmed.match(/^RIGHT SQUAD GOAL! \((\d+) - (\d+)\)$/i))) return `右队进球！(${m[1]} - ${m[2]})`;
  if ((m = trimmed.match(/^LEFT SQUAD GOAL! \((\d+) - (\d+)\)$/i))) return `左队进球！(${m[1]} - ${m[2]})`;
  if ((m = trimmed.match(/^ROUND (\d+) · TINDIH TO WIN!$/i))) return `第 ${m[1]} 轮 · 压制对手橡胶擦！`;
  if ((m = trimmed.match(/^ROUND (\d+) · GASING PANGKAH!$/i))) return `第 ${m[1]} 轮 · 传统陀螺对撞！`;
  if ((m = trimmed.match(/^TEMBAK \+(\d+)!$/i))) return `吃光对岸 +${m[1]}！`;
  if ((m = trimmed.match(/^TEMBAK CAPTURE! \+(\d+) MARBLES!$/i))) return `对岸包抄吃子！+${m[1]} 颗弹珠！`;
  if ((m = trimmed.match(/^GOLD GULI! \+(\d+)$/i))) return `黄金弹珠！+${m[1]}`;
  if ((m = trimmed.match(/^(.+) · JALAN TERUS \(FREE TURN!\)$/i))) return `${m[1]} · 连走一轮！`;
  if ((m = trimmed.match(/^ROUND (\d+) · HEAVE!$/i))) return `第 ${m[1]} 局 · 拔河拉绳！`;
  if ((m = trimmed.match(/^WINS ROUND (\d+)!$/i))) return `赢得第 ${m[1]} 局！`;
  if ((m = trimmed.match(/^(.+) DEVOURED (.+)!$/i))) return `${m[1]} 吞掉了 ${m[2]}！`;
  if ((m = trimmed.match(/^DEVOURED (.+)!$/i))) return `吞噬了 ${m[1]}！`;
  if ((m = trimmed.match(/^(.+) CUT OFF (.+)!$/i))) return `${m[1]} 拦截撞爆了 ${m[2]}！`;
  if ((m = trimmed.match(/^CUT OFF (.+)!$/i))) return `拦截撞爆了 ${m[1]}！`;
  if ((m = trimmed.match(/^(.+) SHATTERED STEP (\d+)!$/i))) return `${m[1]} 踩碎了第 ${m[2]} 块玻璃！`;
  if ((m = trimmed.match(/^SHATTERED STEP (\d+)!$/i))) return `踩碎第 ${m[1]} 块玻璃！`;
  if ((m = trimmed.match(/^(.+) REACHED 2048!$/i))) return `${m[1]} 成功合成 2048！`;
  if ((m = trimmed.match(/^(.+) FROZE (.+)!$/i))) return `${m[1]} 冰冻了 ${m[2]}！`;
  if ((m = trimmed.match(/^FROZE (.+)!$/i))) return `冰冻了 ${m[1]}！`;
  if ((m = trimmed.match(/^(.+) FLAGGED A MINE \(\+(\d+)\)!$/i))) return `${m[1]} 精准标雷 (+${m[2]})！`;
  if ((m = trimmed.match(/^FLAGGED A MINE \(\+(\d+)\)!$/i))) return `精准标雷 (+${m[1]})！`;
  if ((m = trimmed.match(/^BOOM! (.+) HIT A MINE!$/i))) return `轰！${m[1]} 踩中地雷！`;

  // --- Comprehensive Game Audit Additions (All 150 Games) ---
  if ((m = trimmed.match(/^(RED TEAM|BLUE TEAM|HOLO-CPU):\s*(\d+)\/(\d+)$/i))) {
    const tName = m[1].toUpperCase() === 'RED TEAM' ? '红队' : m[1].toUpperCase() === 'BLUE TEAM' ? '蓝队' : '全息AI';
    return `${tName}：${m[2]}/${m[3]}`;
  }
  if ((m = trimmed.match(/^TIME:\s*(\d+)s$/i))) return `时间：${m[1]}秒`;
  if ((m = trimmed.match(/^FUSE ([\d.]+)s · (\d+)s$/i))) return `引信 ${m[1]}秒 · ${m[2]}秒`;
  if ((m = trimmed.match(/^([\d.]+)s · (\d+)s$/i))) return `${m[1]}秒 · ${m[2]}秒`;
  if ((m = trimmed.match(/^(MUSIC|PODS|WAIT|ALARM|DROP|SAFE|ROUND|HUNT|FREEZE|RUN|DANCE|STOP) · (\d+)s$/i))) {
    const phaseMap: Record<string, string> = {
      MUSIC: '音乐响起',
      PODS: '抢座时刻',
      WAIT: '准备阶段',
      ALARM: '警报拉响',
      DROP: '坠落危机',
      SAFE: '安全期',
      ROUND: '回合中',
      HUNT: '狩猎中',
      FREEZE: '静止',
      RUN: '奔跑',
      DANCE: '热舞',
      STOP: '停下',
    };
    return `${phaseMap[m[1].toUpperCase()] ?? m[1]} · ${m[2]}秒`;
  }
  if ((m = trimmed.match(/^LEFT\s+(\d+)\s+[—-]\s+(\d+)\s+RIGHT\s+\(TO\s+(\d+)\)$/i))) {
    return `左队 ${m[1]} — ${m[2]} 右队 (先到 ${m[3]} 分)`;
  }
  if ((m = trimmed.match(/^(\d+)\s+[–—-]\s+(\d+)$/))) return `${m[1]} – ${m[2]}`;
  if ((m = trimmed.match(/^(TRUTH|DARE)( ×2 STAKES!)? · VOTES (\d+)\/(\d+)$/i))) {
    const kind = m[1].toUpperCase() === 'DARE' ? '大冒险' : '真心话';
    const mult = m[2] ? ' ×2倍积分！' : '';
    return `${kind}${mult} · 投票 ${m[3]}/${m[4]}`;
  }
  if ((m = trimmed.match(/^(P\d+\s+.+?):\s*(\d+)\/(\d+)\s+·\s+(\d+)pt$/i))) {
    return `${m[1]}：${m[2]}/${m[3]} · ${m[4]}分`;
  }
  if ((m = trimmed.match(/^(.+?):\s*(\d+)\s+Discs\s+\((\d+)s\)$/i))) {
    return `${m[1]}：${m[2]} 棋 (${m[3]}秒)`;
  }
  if ((m = trimmed.match(/^(P\d+\s+.+?):\s*(\d+)pt\s+\((\d+)H\)$/i))) {
    return `${m[1]}：${m[2]}分 (${m[3]}击)`;
  }
  if ((m = trimmed.match(/^(P\d+\s+.+?):\s*(\d+)P\s+·\s+(\d+)KO$/i))) {
    return `${m[1]}：${m[2]}子 · ${m[3]}吃子`;
  }
  if ((m = trimmed.match(/^(P\d+\s+.+?):\s*(\d+)pt\s+\((\d+)\)$/i))) {
    return `${m[1]}：${m[2]}分 (${m[3]}袋)`;
  }
  if ((m = trimmed.match(/^(\d+) TILES · (\d+)$/i))) return `${m[1]} 张牌 · ${m[2]} 分`;
  if ((m = trimmed.match(/^STREAK (\d+) · (\d+)$/i))) return `连胜 ${m[1]} · ${m[2]} 分`;
  if ((m = trimmed.match(/^(\d+) Elim(?:s)?$/i))) return `${m[1]} 淘汰`;
  if ((m = trimmed.match(/^(\d+) KO(?:s)?$/i))) return `${m[1]} 击倒`;
  if ((m = trimmed.match(/^(.+?) · Wins (\d+)\/(\d+)$/i))) return `${m[1]} · 胜 ${m[2]}/${m[3]}`;
  if ((m = trimmed.match(/^(.+?) WINS ON LIFE!$/i))) return `${m[1]} 凭借剩余生命获胜！`;
  if ((m = trimmed.match(/^(Volcano Survivor|Melted) · (\d+) Fire Gems$/i))) {
    return `${m[1] === 'Melted' ? '已熔毁' : '火山幸存者'} · ${m[2]} 火宝石`;
  }
  if ((m = trimmed.match(/^(.+) · (\d+) pts · (\d+) served$/i))) {
    return `${m[1]} · ${m[2]} 分 · 上菜 ${m[3]} 份`;
  }
  if ((m = trimmed.match(/^(\d+) served · (.+)$/i))) {
    return `上菜 ${m[1]} 份 · ${m[2]}`;
  }
  if ((m = trimmed.match(/^(.+?) Team · (\d+) pts · (\d+) touches$/i))) {
    return `${m[1].toUpperCase() === 'RED' ? '红队' : '蓝队'} · ${m[2]} 分 · 触球 ${m[3]} 次`;
  }
  if ((m = trimmed.match(/^(RED|BLUE) · (\d+-\d+) · (\d+) pts$/i))) {
    return `${m[1].toUpperCase() === 'RED' ? '红队' : '蓝队'} · ${m[2]} · ${m[3]} 分`;
  }
  if ((m = trimmed.match(/^♥(\d+) · ⚔\+(\d+) · (\d+)G$/i))) {
    return `♥${m[1]} · ⚔+${m[2]} · ${m[3]}金`;
  }
  if ((m = trimmed.match(/^YOUR TURN · ♥(\d+) · ⚔\+(\d+) · (\d+)G$/i))) {
    return `你的回合 · ♥${m[1]} · ⚔+${m[2]} · ${m[3]}金`;
  }
  if ((m = trimmed.match(/^YOUR TURN · (.+)$/i))) {
    return `你的回合 · ${translateGameText(m[1], lang)}`;
  }

  // Board & Card turn prompts / events
  if ((m = trimmed.match(/^(.+) launched the Carrom Striker!$/i))) return `${m[1]} 弹射了克朗母球！`;
  if ((m = trimmed.match(/^👑 (.+) sank the Red Queen Puck \(\+50 pts\)!$/i))) return `👑 ${m[1]} 将红皇后入袋 (+50 分)！`;
  if ((m = trimmed.match(/^(.+) pocketed a ([A-Z]+) puck \(\+(\d+) pts\)!$/i))) {
    const pKind = m[2] === 'WHITE' ? '白' : m[2] === 'BLACK' ? '黑' : m[2] === 'RED' ? '红' : m[2];
    return `${m[1]} 将${pKind}子入袋 (+${m[3]} 分)！`;
  }
  if ((m = trimmed.match(/^(.+)'s Turn — Aim & Flick Striker!$/i))) return `轮到 ${m[1]} — 瞄准并弹射母球！`;
  if ((m = trimmed.match(/^(.+)'s Turn — Aim & Press A to Flick Striker!$/i))) return `轮到 ${m[1]} — 瞄准并按 A 弹射母球！`;
  if ((m = trimmed.match(/^(.+)'s turn$/i))) return `轮到 ${m[1]}`;
  if ((m = trimmed.match(/^(.+)'s Turn!$/i))) return `轮到 ${m[1]}！`;
  if ((m = trimmed.match(/^(.+)'s Turn — Press A to Roll or B for Hero Potion!$/i))) return `轮到 ${m[1]} — 按 A 掷骰，按 B 喝勇者药水！`;
  if ((m = trimmed.match(/^🧪 (.+) drank a Hero Potion \(\+4 HP & \+2 Attack Power\)!$/i))) return `🧪 ${m[1]} 喝下勇者药水 (+4 生命 / +2 攻击力)！`;
  if ((m = trimmed.match(/^(.+) rolled (\d+)! Advancing deeper into the crypt\.\.\.$/i))) return `${m[1]} 掷出 ${m[2]} 点！正深入地牢……`;
  if ((m = trimmed.match(/^(.+) encountered (.+?)! Press A to Strike!$/i))) return `${m[1]} 遭遇了 ${translateGameText(m[2], lang)}！按 A 攻击！`;
  if ((m = trimmed.match(/^💎 (.+) looted (.+?) \(\+(\d+) Gold & \+1 Sword ATK\)!$/i))) return `💎 ${m[1]} 洗劫了 ${translateGameText(m[2], lang)} (+${m[3]} 金币 & +1 攻击)！`;
  if ((m = trimmed.match(/^🔥 (.+) rested at (.+?) \(Full HP & \+(\d+) Gold\)!$/i))) return `🔥 ${m[1]} 在 ${translateGameText(m[2], lang)} 休整 (满血 & +${m[3]} 金币)！`;
  if ((m = trimmed.match(/^🐉 (.+) struck the Dragon Boss for (\d+) DMG \(\+(\d+) Gold\)!$/i))) return `🐉 ${m[1]} 重创终极巨龙 ${m[2]} 点伤害 (+${m[3]} 金币)！`;
  if ((m = trimmed.match(/^⚔️ (.+) rolled (\d+)\+(\d+)=(\d+) & slew (.+?) \(\+(\d+) Gold\)!$/i))) {
    return `⚔️ ${m[1]} 掷出 ${m[2]}+${m[3]}=${m[4]} 斩杀了 ${translateGameText(m[5], lang)} (+${m[6]} 金币)！`;
  }
  if ((m = trimmed.match(/^🛡️ (.+) rolled (\d+) vs (\d+) — took 2 damage but grabbed 15 Gold!$/i))) {
    return `🛡️ ${m[1]} 掷出 ${m[2]} 对阵 ${m[3]} — 受伤 -2 但抢到 15 金币！`;
  }
  if ((m = trimmed.match(/^⚡ (.+) scored a 4-IN-A-ROW Connect!$/i))) return `⚡ ${m[1]} 达成了四子连线！`;
  if ((m = trimmed.match(/^🔨 (.+) crushed Column (\d+) with an Anvil Token!$/i))) return `🔨 ${m[1]} 用铁砧震碎并清空了第 ${m[2]} 列！`;
  if ((m = trimmed.match(/^(.+) dropped a token in Column (\d+)!$/i))) return `${m[1]} 将棋子投入了第 ${m[2]} 列！`;
  if ((m = trimmed.match(/^(.+) wins Jungle Ladders!$/i))) return `${m[1]} 赢得丛林蛇梯棋冠军！`;
  if ((m = trimmed.match(/^WHOA! (.+) slipped on a Banana to #(\d+)!$/i))) return `哎呀！${m[1]} 踩到香蕉滑到了 #${m[2]}！`;
  if ((m = trimmed.match(/^(.+) climbs a bamboo ladder to #(\d+)!$/i))) return `${m[1]} 顺着竹梯一路爬到了 #${m[2]}！`;
  if ((m = trimmed.match(/^OH NO! (.+) slid down a snake to #(\d+)!$/i))) return `糟糕！${m[1]} 被蛇咬滑落到 #${m[2]}！`;
  if ((m = trimmed.match(/^(.+) found a Mystery Tile! TRICK \(B\) Ready!$/i))) return `${m[1]} 踩中神秘格！陷阱道具 (B) 已就绪！`;
  if ((m = trimmed.match(/^(.+) activated TRICK! \+2 Roll Boost & Banana Trap!$/i))) return `${m[1]} 发动整蛊！掷骰 +2 并布下香蕉陷阱！`;
  if ((m = trimmed.match(/^(.+) is picking cards\.\.\.$/i))) return `${m[1]} 正在选牌中……`;
  if ((m = trimmed.match(/^TARGET:\s*(.+)$/i))) return `目标牌面：${m[1]}`;
  if ((m = trimmed.match(/^(.+)'s Turn — Stick\/B Picks Token · Press A to Roll!$/i))) return `轮到 ${m[1]} — 摇杆/B 选棋子 · 按 A 掷骰！`;
  if ((m = trimmed.match(/^(.+) selected Token #(\d+) \((.+)\)$/i))) return `${m[1]} 选择了 #${m[2]} 号棋子 (${translateGameText(m[3], lang)})`;
  if ((m = trimmed.match(/^(.+) rolled (\d+) — Need 5 or 6 to deploy from Base!$/i))) return `${m[1]} 掷出 ${m[2]} — 需掷出 5 或 6 才能起飞！`;
  if ((m = trimmed.match(/^(.+) rolled (\d+) & deployed Token #(\d+) onto the track!$/i))) return `${m[1]} 掷出 ${m[2]} 点，#${m[3]} 号棋子成功起飞！`;
  if ((m = trimmed.match(/^(.+) escorted Token #(\d+) to the Royal Crown!$/i))) return `${m[1]} 护送 #${m[2]} 号棋子抵达皇家终点！`;
  if ((m = trimmed.match(/^(.+) landed on a Safe Star Tile — Boost Charged!$/i))) return `${m[1]} 落在安全星格 — 加速能量已充能！`;
  if ((m = trimmed.match(/^(.+) sent (.+)'s Token #(\d+) back to Base!$/i))) return `${m[1]} 将 ${m[2]} 的 #${m[3]} 号棋子撞回基地！`;
  if ((m = trimmed.match(/^(.+) rolled a 6 and gets a Bonus Turn!$/i))) return `${m[1]} 掷出 6 点，获得额外一回合！`;
  if ((m = trimmed.match(/^📡 (.+) scanned 3x3 sector \((\d+),(\d+)\) — (\d+) hidden hulls?!$/i))) {
    return `📡 ${m[1]} 扫描 3×3 海域 (${m[2]},${m[3]}) — 探测到 ${m[4]} 个隐藏目标！`;
  }
  if ((m = trimmed.match(/^💥 (.+) destroyed a Golden Flagship at \((\d+),(\d+)\)!$/i))) return `💥 ${m[1]} 在 (${m[2]},${m[3]}) 摧毁了黄金旗舰！`;
  if ((m = trimmed.match(/^🎯 (.+) hit an armored warship at \((\d+),(\d+)\)!$/i))) return `🎯 ${m[1]} 在 (${m[2]},${m[3]}) 命中了一艘装甲战舰！`;
  if ((m = trimmed.match(/^💣 (.+) triggered a Sea Mine at \((\d+),(\d+)\)!$/i))) return `💣 ${m[1]} 在 (${m[2]},${m[3]}) 误触水雷！`;
  if ((m = trimmed.match(/^🌊 (.+) splashed open water at \((\d+),(\d+)\)\.$/i))) return `🌊 ${m[1]} 炮击 (${m[2]},${m[3]}) 仅击中空海域。`;
  if ((m = trimmed.match(/^👑 (.+) promoted a piece to a Shielded King!$/i))) return `👑 ${m[1]} 将一枚棋子晋升为带盾王棋！`;
  if ((m = trimmed.match(/^⚡ (.+) jumped & captured an enemy checker!$/i))) return `⚡ ${m[1]} 飞跃并吃掉了敌方棋子！`;
  if ((m = trimmed.match(/^(.+) moved to \((\d+),(\d+)\)\.$/i))) return `${m[1]} 移动到了 (${m[2]},${m[3]})。`;
  if ((m = trimmed.match(/^(.+) placed at \((\d+),(\d+)\) & flipped (\d+) discs?!$/i))) {
    return `${m[1]} 落子 (${m[2]},${m[3]}) 并翻转了 ${m[4]} 枚棋子！`;
  }

  // Rich Street & Star Party
  if ((m = trimmed.match(/^(.+): Roll to break out of Jail!$/i))) return `${m[1]}：掷骰尝试离开禁闭室！`;
  if ((m = trimmed.match(/^(.+) landed on GO! \+\$150 Bonus!$/i))) return `${m[1]} 精准停在起点！+$150 奖金！`;
  if ((m = trimmed.match(/^(.+) won the \$(\d+) City Jackpot!$/i))) return `${m[1]} 赢走了 $${m[2]} 城市大彩池！`;
  if ((m = trimmed.match(/^(.+) visited Chill Jail! Next turn rolls to exit\.$/i))) return `${m[1]} 进了悠闲禁闭室！下回合掷骰离开。`;
  if ((m = trimmed.match(/^(.+) paid \$(\d+) to Jackpot Pool!$/i))) return `${m[1]} 向大彩池缴纳了 $${m[2]} 税费！`;
  if ((m = trimmed.match(/^Lucky Card: Street Festival! (.+) \+\$200$/i))) return `幸运卡：街头嘉年华！${m[1]} +$200`;
  if ((m = trimmed.match(/^Lucky Card: (.+) gained a Free Rent Shield!$/i))) return `幸运卡：${m[1]} 获得免费免租护盾！`;
  if ((m = trimmed.match(/^Lucky Card: Party Gift! (.+) \+\$(\d+)$/i))) return `幸运卡：派对红包！${m[1]} +$${m[2]}`;
  if ((m = trimmed.match(/^Lucky Card: Parking Ticket! -\$(\d+) to Jackpot$/i))) return `幸运卡：违停罚单！-$${m[1]} 充入大彩池`;
  if ((m = trimmed.match(/^Buy (.+?) for \$(\d+)\? \(A: Buy \/ B: Skip\)$/i))) {
    return `花 $${m[2]} 买下 ${translateGameText(m[1], lang)}？(A 购买 / B 跳过)`;
  }
  if ((m = trimmed.match(/^(.+) can't afford (.+?) \(\$(\d+)\)$/i))) {
    return `${m[1]} 现金不足，买不起 ${translateGameText(m[2], lang)} ($${m[3]})`;
  }
  if ((m = trimmed.match(/^Upgrade (.+?) to Lv\.(\d+) for \$(\d+)\?$/i))) {
    return `花 $${m[3]} 将 ${translateGameText(m[1], lang)} 升到 ${m[2]} 级？`;
  }
  if ((m = trimmed.match(/^(.+) visited own (.+?)! \+\$50 VIP bonus$/i))) {
    return `${m[1]} 回到自家 ${translateGameText(m[2], lang)}！+$50 贵宾分红`;
  }
  if ((m = trimmed.match(/^(.+)'s Rent Shield blocked rent on (.+?)!$/i))) {
    return `${m[1]} 的免租护盾抵挡了 ${translateGameText(m[2], lang)} 的租金！`;
  }
  if ((m = trimmed.match(/^(.+) paid \$(\d+) rent & went bankrupt!$/i))) return `${m[1]} 支付 $${m[2]} 租金后资金耗尽破产！`;
  if ((m = trimmed.match(/^(.+) used Lucky Perk! Rent Shield \+ \$80$/i))) return `${m[1]} 启动幸运特权！免租盾 + $80`;
  if ((m = trimmed.match(/^(.+) left Jail & moves (\d+) spaces!$/i))) return `${m[1]} 离开禁闭室并前进 ${m[2]} 步！`;
  if ((m = trimmed.match(/^(.+) saved cash and skipped\.$/i))) return `${m[1]} 保留现金，选择跳过。`;
  if ((m = trimmed.match(/^(.+)'s Turn — Press A to Roll or B for 2X Candy!$/i))) return `轮到 ${m[1]} — 按 A 掷骰，按 B 用双倍糖果！`;
  if ((m = trimmed.match(/^(.+) spent 5 Coins on 2X Double Dice Candy!$/i))) return `${m[1]} 花 5 金币买了 2× 双倍骰子糖！`;
  if ((m = trimmed.match(/^(.+) rolled (\d+)! Hopping across Star Island\.\.\.$/i))) return `${m[1]} 掷出 ${m[2]} 点！正穿梭星光岛……`;
  if ((m = trimmed.match(/^🌟 (.+) traded (\d+) Coins for a Golden Star!$/i))) return `🌟 ${m[1]} 用 ${m[2]} 金币兑换了一颗黄金星星！`;
  if ((m = trimmed.match(/^(.+) landed on a Blue Coin Tile \(\+6 Coins\)!$/i))) return `${m[1]} 停在蓝金币格 (+6 金币)！`;
  if ((m = trimmed.match(/^(.+) hit the Lucky Jackpot Fountain \(\+12 Coins\)!$/i))) return `${m[1]} 触发幸运喷泉大奖 (+12 金币)！`;
  if ((m = trimmed.match(/^(.+) found a Free 2X Candy & \+5 Coins!$/i))) return `${m[1]} 捡到免费双倍糖果并获 +5 金币！`;
  if ((m = trimmed.match(/^(.+) stepped on a Zap Trap \(-(\d+) Coins\)!$/i))) return `${m[1]} 踩中电击陷阱 (-${m[2]} 金币)！`;
  if ((m = trimmed.match(/^(.+) raided (.+) for (\d+) Coins!$/i))) return `${m[1]} 劫掠了 ${m[2]} 的 ${m[3]} 枚金币！`;
  if ((m = trimmed.match(/^(.+) won the Duel Tile bonus \(\+8 Coins\)!$/i))) return `${m[1]} 赢得决斗格奖励 (+8 金币)！`;

  // Packs 1–7 Dynamic Banners, Popups, Cards & Stats
  if ((m = trimmed.match(/^(.+) CRAFTED A GIANT WATERMELON!$/i))) return `${m[1]} 成功合成了巨型大西瓜！`;
  if ((m = trimmed.match(/^(.+) CLEARED A FULL STACK! \+500!$/i))) return `${m[1]} 清空整叠三消方块！+500！`;
  if ((m = trimmed.match(/^(.+) FINISHED #(\d+)!$/i))) return `${m[1]} 冲线获得第 #${m[2]} 名！`;
  if ((m = trimmed.match(/^BOOM! (.+) — (.+)!$/i))) return `轰！${m[1]} 炸裂 — ${translateGameText(m[2], lang)}！`;
  if ((m = trimmed.match(/^(.+) NAILED IT! \+(\d+) PTS!$/i))) return `${m[1]} 答对爆分！+${m[2]} 分！`;
  if ((m = trimmed.match(/^ROUND (\d+)\/(\d+) — PASS FAST!$/i))) return `第 ${m[1]}/${m[2]} 轮 — 快传炸弹！`;
  if ((m = trimmed.match(/^(.+) IS DRAWING:\s*(.+)$/i))) return `${m[1]} 正在画：${m[2]}`;
  if ((m = trimmed.match(/^(.+) IS SKETCHING — GUESS FAST!$/i))) return `${m[1]} 正在灵魂作画 — 赶快抢答！`;
  if ((m = trimmed.match(/^ROUND (\d+)\/(\d+) — BID FOR LANDLORD!$/i))) return `第 ${m[1]}/${m[2]} 局 — 叫分抢地主！`;
  if ((m = trimmed.match(/^(.+) IS LANDLORD \(×(\d+)\)!$/i))) return `${m[1]} 成为地主（倍数 ×${m[2]}）！`;
  if ((m = trimmed.match(/^(.+) TABLE ×(\d+)!$/i))) return `${translateGameText(m[1], lang)} · 牌桌 ×${m[2]}！`;
  if ((m = trimmed.match(/^LANDLORD (.+) WINS! \+(\d+)!$/i))) return `地主 ${m[1]} 获胜！+${m[2]}！`;
  if ((m = trimmed.match(/^PEASANTS WIN! \+(\d+) EACH!$/i))) return `农民获胜！每人 +${m[1]}！`;
  if ((m = trimmed.match(/^MAHJONG ROUND (\d+)\/(\d+) — BUILD 2 MELDS \+ 1 PAIR!$/i))) return `麻将第 ${m[1]}/${m[2]} 局 — 凑两副加一对胡牌！`;
  if ((m = trimmed.match(/^ROUND (\d+) — SHAKE & BID! \(1s ARE WILD\)$/i))) return `第 ${m[1]} 轮 — 摇骰叫点（1点万能）！`;
  if ((m = trimmed.match(/^BID (\d+)× (.+)$/i))) return `叫 ${m[1]} 个 ${m[2]}`;
  if ((m = trimmed.match(/^BID (\d+)×$/i))) return `叫 ${m[1]} 倍`;
  if ((m = trimmed.match(/^ROUND (\d+)\/(\d+) — CHECK YOUR SECRET WORD & PICK A CLUE!$/i))) return `第 ${m[1]}/${m[2]} 轮 — 查看密词并提交线索！`;
  if ((m = trimmed.match(/^SPY CAUGHT! (.+) WAS THE UNDERCOVER!$/i))) return `揪出卧底！${m[1]} 就是潜伏的卧底！`;
  if ((m = trimmed.match(/^WRONG VOTE! (.+) ESCAPED UNDETECTED!$/i))) return `投错了！卧底 ${m[1]} 逃出生天！`;
  if ((m = trimmed.match(/^NIGHT (\d+) FALLS — SPECIAL ROLES ACT!$/i))) return `第 ${m[1]} 夜降临 — 特殊身份请行动！`;
  if ((m = trimmed.match(/^(.+) LINKED:\s*(.+)$/i))) return `${m[1]} 成功接龙：${m[2]}`;
  if ((m = trimmed.match(/^(.+) BROKE THE CHAIN!$/i))) return `${m[1]} 接龙失败断链了！`;
  if ((m = trimmed.match(/^(.+) TIMED OUT!$/i))) return `${m[1]} 思考超时！`;
  if ((m = trimmed.match(/^HU! \+(\d+)$/i))) return `胡牌！+${m[1]}`;
  if ((m = trimmed.match(/^PONG (.+)!$/i))) return `碰 ${m[1]}！`;
  if ((m = trimmed.match(/^DISCARD (.+)$/i))) return `打出 ${m[1]}`;
  if ((m = trimmed.match(/^SOW PIT (\d+)$/i))) return `播种第 ${m[1]} 坑`;
  if ((m = trimmed.match(/^\+(\d+) WIN!$/i))) return `+${m[1]} 胜！`;
  if ((m = trimmed.match(/^(.+) HIT A VIRUS!$/i))) return `${m[1]} 撞上病毒分裂了！`;
  if ((m = trimmed.match(/^(.+) SLICED (.+)'S RIBBON!$/i))) return `${m[1]} 切断了 ${m[2]} 的丝带！`;
  if ((m = trimmed.match(/^(.+) CROSSED THE GLASS BRIDGE!$/i))) return `${m[1]} 成功闯过玻璃桥！`;
  if ((m = trimmed.match(/^(.+) CRACKED "(.+)"!$/i))) return `${m[1]} 成功破译「${m[2]}」！`;
  if ((m = trimmed.match(/^SPYMASTER CLUE:\s*(.+)$/i))) return `队长密令线索：${m[1]}`;
  if ((m = trimmed.match(/^Clue:\s*"([^"]+)"\s*—\s*Tap matching codenames, avoid the Assassin!$/i))) {
    return `线索「${m[1]}」— 点选匹配特工词，切勿误触黑衣刺客！`;
  }
  if ((m = trimmed.match(/^(.+) · (\d+) LEFT$/i))) return `${m[1]} · 剩余 ${m[2]} 词`;
  if ((m = trimmed.match(/^ROUND (\d+) · GALAH PANJANG!$/i))) return `第 ${m[1]} 局 · 马来过五关！`;
  if ((m = trimmed.match(/^(.+) HOLDS 3♦ · LEADS FIRST!$/i))) return `${m[1]} 手持 ♦3 · 先手领出！`;
  if ((m = trimmed.match(/^(.+) WINS TRICK · FREE LEAD!$/i))) return `${m[1]} 赢下本墩 · 自由领出！`;
  if ((m = trimmed.match(/^(.+) CLEARED ALL 13! \+(\d+) PTS!$/i))) return `${m[1]} 清空 13 张手牌！+${m[2]} 分！`;
  if ((m = trimmed.match(/^ROUND (\d+) · PICK 3 CARDS = MULTIPLE OF 10!$/i))) return `第 ${m[1]} 局 · 挑 3 张牌凑成 10 的倍数！`;
  if ((m = trimmed.match(/^SHOWDOWN! BANKER HAS (.+)$/i))) return `全员亮牌！庄家亮出 ${translateGameText(m[1], lang)}`;
  if ((m = trimmed.match(/^(.+) POWERED UP! CHOMP GHOSTS!$/i))) return `${m[1]} 能量觉醒！反杀吞噬幽灵！`;
  if ((m = trimmed.match(/^(.+) CHOMPED A GHOST \(\+(\d+)\)!$/i))) return `${m[1]} 吃掉了一只幽灵 (+${m[2]})！`;
  if ((m = trimmed.match(/^WAVE (\d+) INCOMING!$/i))) return `第 ${m[1]} 波敌军来袭！`;
  if ((m = trimmed.match(/^(.+) CLEARED (\d+) LINES! GARBAGE SENT!$/i))) return `${m[1]} 连消 ${m[2]} 行！向对手空投垃圾行！`;
  if ((m = trimmed.match(/^(.+) REACHED THE LILY PAD \(\+(\d+)\)!$/i))) return `${m[1]} 成功跳上金莲座 (+${m[2]})！`;
  if ((m = trimmed.match(/^(.+) REACHED THE CROWN SUMMIT \(\+(\d+)\)!$/i))) return `${m[1]} 率先登顶夺冠 (+${m[2]})！`;
  if ((m = trimmed.match(/^(.+) SANK A 100-PT JACKPOT!$/i))) return `${m[1]} 投入 100 分超级大奖洞！`;
  if ((m = trimmed.match(/^⚡ STRIKE! (.+) \(\+(\d+)\)!$/i))) return `⚡ 全倒 STRIKE！${m[1]} (+${m[2]})！`;
  if ((m = trimmed.match(/^(.+) DROPPED A GIANT MEGA COIN!$/i))) return `${m[1]} 投下巨型超级金币！`;
  if ((m = trimmed.match(/^💎 (.+) SCORED A RUBY GEM \(\+(\d+)\)!$/i))) return `💎 ${m[1]} 推落红宝石大奖 (+${m[2]})！`;
  if ((m = trimmed.match(/^(.+) SUNK HOLE (\d+)! \+(\d+)$/i))) return `${m[1]} 攻克第 ${m[2]} 洞！+${m[3]}`;
  if ((m = trimmed.match(/^HOLE (\d+) — TEE OFF!$/i))) return `第 ${m[1]} 洞 — 挥杆开球！`;
  if ((m = trimmed.match(/^(.+) HIT GOLD BULLSEYE!$/i))) return `${m[1]} 正中黄金十环靶心！`;
  if ((m = trimmed.match(/^(.+) KNOCKED OUT (.+)!$/i))) return `${m[1]} 重拳击倒了 ${m[2]}！`;
  if ((m = trimmed.match(/^(.+) WINS THE RALLY! \+(\d+)$/i))) return `${m[1]} 赢下本回合对抽！+${m[2]}`;
  if ((m = trimmed.match(/^(.+) CRUSHED A (\d+)FT MOONSHOT!$/i))) return `${m[1]} 轰出 ${m[2]} 尺超级本垒打！`;
  if ((m = trimmed.match(/^(.+) CAUGHT A BLAZING BALL!$/i))) return `${m[1]} 空手接住烈焰躲避球！`;
  if ((m = trimmed.match(/^(.+) BLASTED (.+)!$/i))) return `${m[1]} 一球砸飞了 ${m[2]}！`;
  if ((m = trimmed.match(/^(.+) RINGED OUT (.+)! \+(\d+)$/i))) return `${m[1]} 把 ${m[2]} 推出了土俵 (+${m[3]})！`;
  if ((m = trimmed.match(/^(.+) CROSSED THE FINISH!$/i))) return `${m[1]} 划过终点线夺冠！`;
  if ((m = trimmed.match(/^(LEFT TEAM|RIGHT TEAM) GOAL! \+(\d+)$/i))) {
    return `${m[1].toUpperCase() === 'LEFT TEAM' ? '左队' : '右队'} 破门得分！+${m[2]}`;
  }
  if ((m = trimmed.match(/^(LEFT TEAM|RIGHT TEAM) SHUTTLE WINNER! \+(\d+)$/i))) {
    return `${m[1].toUpperCase() === 'LEFT TEAM' ? '左队' : '右队'} 赢下羽球回合！+${m[2]}`;
  }
  if ((m = trimmed.match(/^(.+) POTTED \+(\d+)!$/i))) return `${m[1]} 精彩落袋 +${m[2]}！`;
  if ((m = trimmed.match(/^(.+) UNHORSED (.+)! \+(\d+)$/i))) return `${m[1]} 挑落马下 ${m[2]}！+${m[3]}`;
  if ((m = trimmed.match(/^(.+) GOT ZAPPED BY THE LASER!$/i))) return `${m[1]} 被旋转激光电到了！`;
  if ((m = trimmed.match(/^(.+) FELL INTO THE LAVA!$/i))) return `${m[1]} 跌入了滚烫岩浆！`;
  if ((m = trimmed.match(/^(.+) PASSED THE BOMB TO (.+)!$/i))) return `${m[1]} 把定时炸弹传给了 ${m[2]}！`;
  if ((m = trimmed.match(/^KABOOM! (.+) BLEW UP!$/i))) return `轰隆！${m[1]} 的炸弹引爆了！`;
  if ((m = trimmed.match(/^(.+) MISSED A THRONE!$/i))) return `${m[1]} 没抢到王座被淘汰！`;
  if ((m = trimmed.match(/^(.+) SLID (.+) INTO THE SEA!$/i))) return `${m[1]} 把 ${m[2]} 撞进了冰海！`;
  if ((m = trimmed.match(/^(.+) GRABBED A GOLD STAR CORE!$/i))) return `${m[1]} 抢到了金星核心！`;
  if ((m = trimmed.match(/^(.+) TRIPPED THE VAULT ALARM!$/i))) return `${m[1]} 触发了金库红外警报！`;
  if ((m = trimmed.match(/^(.+) INFECTED (.+)!$/i))) return `${m[1]} 感染了 ${m[2]}！`;
  if ((m = trimmed.match(/^NEW WAVE! (.+) IS PATIENT ZERO!$/i))) return `新一波来袭！${m[1]} 成为零号病人！`;
  if ((m = trimmed.match(/^(.+) TRAPPED (.+) UNDER AN ANVIL!$/i))) return `${m[1]} 把 ${m[2]} 推进了铁砧砸落区！`;
  if ((m = trimmed.match(/^(.+) SLID OFF THE SEESAW!$/i))) return `${m[1]} 从空中跷跷板滑落了！`;
  if ((m = trimmed.match(/^(.+) HIT A CANYON SAW!$/i))) return `${m[1]} 撞上了峡谷电锯！`;
  if ((m = trimmed.match(/^(.+) GOT WRECKED!$/i))) return `${m[1]} 被大铁球砸飞了！`;
  if ((m = trimmed.match(/^(.+) DROPPED THROUGH A TRAPDOOR!$/i))) return `${m[1]} 从陷阱地板掉了下去！`;
  if ((m = trimmed.match(/^(.+) HIT 5-IN-A-ROW! \+(\d+)$/i))) return `${m[1]} 连成五子连珠！+${m[2]}`;
  if ((m = trimmed.match(/^(.+) KNIGHT-CHECKED (.+)!$/i))) return `${m[1]} 骑士跳吃击败 ${m[2]}！`;
  if ((m = trimmed.match(/^(.+) SNAPPED \[(\d+)\|(\d+)\] \(\+(\d+)\)$/i))) return `${m[1]} 接上骨牌 [${m[2]}|${m[3]}] (+${m[4]})`;
  if ((m = trimmed.match(/^(.+) BLOT-BUMPED (.+)! \+(\d+)$/i))) return `${m[1]} 撞飞了 ${m[2]} 的单子！+${m[3]}`;
  if ((m = trimmed.match(/^(.+) BORE OFF A CHECKER! \+(\d+)$/i))) return `${m[1]} 成功将棋子归位！+${m[2]}`;
  if ((m = trimmed.match(/^(.+) CAPTURED \+(\d+) OPPOSITE GEMS!$/i))) return `${m[1]} 横扫抢走对岸 +${m[2]} 颗宝石！`;
  if ((m = trimmed.match(/^(.+) SUMMONED A GEM SHOWER!$/i))) return `${m[1]} 触发宝石暴雨！`;
  if ((m = trimmed.match(/^Tap 3 matching ranks OR 3-card suited sequence, then tap MELD 3\+!$/i))) {
    return '点选 3 张同点（三条）或同花顺后点击「亮牌凑组」！';
  }
  if ((m = trimmed.match(/^(.+) LAID A MELD \(\+(\d+)\)!$/i))) return `${m[1]} 亮出一组牌 (+${m[2]})！`;
  if ((m = trimmed.match(/^TRICK (\d+)\/(\d+) — PICK YOUR CARD!$/i))) return `第 ${m[1]}/${m[2]} 墩 — 请出牌！`;
  if ((m = trimmed.match(/^(.+) WON THE TRICK! \+(\d+)$/i))) return `${m[1]} 赢下本墩！+${m[2]}`;
  if ((m = trimmed.match(/^HAND (\d+)\/(\d+) — DRAW OR LOCK!$/i))) return `第 ${m[1]}/${m[2]} 手 — 换牌或锁牌！`;
  if ((m = trimmed.match(/^CLASH (\d+)\/(\d+) — CAST AN ELEMENT!$/i))) return `第 ${m[1]}/${m[2]} 轮 — 释放元素牌！`;
  if ((m = trimmed.match(/^ROUND (\d+)\/(\d+) — FORM YOUR BEST 2-CARD PAIR!$/i))) return `第 ${m[1]}/${m[2]} 轮 — 选2张牌凑近9点！`;
  if ((m = trimmed.match(/^(.+) SWEPT WITH (\d+) \((NATURAL 9!|HIGH)\)!$/i))) {
    return `${m[1]} 以 ${m[2]} 点（${m[3] === 'HIGH' ? '最大' : '天生9点！'}）横扫全场！`;
  }
  if ((m = trimmed.match(/^Select exactly 2 cards whose mod-10 total gets closest to 9!$/i))) {
    return '选 2 张牌使个位数总和最接近 9 点！';
  }
  if ((m = trimmed.match(/^Tap 2 cards to match symbols! Watch TV flips to steal pairs!$/i))) {
    return '点选 2 张配对翻牌！留心大屏翻开的牌偷对子！';
  }
  if ((m = trimmed.match(/^(.+) MATCHED (.+) \(\+(\d+)\)!$/i))) return `${m[1]} 配对成功 ${m[2]} (+${m[3]})！`;
  if ((m = trimmed.match(/^Tap any numbered card to claim a matching TV square \(J = Wild Steal\)!$/i))) {
    return '点击任意数字牌占领大屏同号格（J 为万能抢占）！';
  }
  if ((m = trimmed.match(/^(.+) RECYCLED DEAD \[(.+)\] \(\+(\d+)\)$/i))) return `${m[1]} 回收了废牌 [${m[2]}] (+${m[3]})`;
  if ((m = trimmed.match(/^PLAY (.+)$/i))) return `出牌 ${translateGameText(m[1], lang)}`;
  if ((m = trimmed.match(/^(.+) FIXED!$/i))) return `${translateGameText(m[1], lang)} 修复完成！`;
  if ((m = trimmed.match(/^PONG 碰 (.+)$/i))) return `碰 ${m[1]}`;
  if ((m = trimmed.match(/^(.+) PONG! 碰!$/i))) return `${m[1]} 碰牌！`;
  if ((m = trimmed.match(/^(.+) DRAGON \(一条龙\) INSTANT WIN!$/i))) return `${m[1]} 一条龙秒赢全场！`;
  if ((m = trimmed.match(/^ROUND (\d+) · (.+) IS BANKER \(庄家\)!$/i))) return `第 ${m[1]} 局 · ${m[2]} 坐庄！`;
  if ((m = trimmed.match(/^LEN (\d+)$/i))) return `长度 ${m[1]}`;
  if ((m = trimmed.match(/^(.+) \((\d+)\) · (\d+) LEFT$/i))) return `${m[1]} (${m[2]}) · 剩 ${m[3]} 张`;
  if ((m = trimmed.match(/^⚡ STRIKE! (.+) \(\+(\d+)\)$/i))) return `⚡ 全倒 STRIKE！${m[1]} (+${m[2]})`;
  if ((m = trimmed.match(/^POW -(\d+)!$/i))) return `重击 -${m[1]}！`;
  if ((m = trimmed.match(/^BANK \$(\d+)M$/i))) return `存入 $${m[1]}M`;
  if ((m = trimmed.match(/^Col (\d+)$/i))) return `第 ${m[1]} 列`;
  if ((m = trimmed.match(/^(\d+) CARDS · (.+)$/i))) return `${m[1]} 张牌 · ${translateGameText(m[2], lang)}`;
  if ((m = trimmed.match(/^RUN \((\d+)\)$/i))) return `跑路 (${m[1]})`;
  if ((m = trimmed.match(/^(\d+) PIN$/i))) return `压制 ${m[1]} 次`;
  if ((m = trimmed.match(/^(\d+) RPM$/i))) return `转速 ${m[1]}`;
  if ((m = trimmed.match(/^(\d+) STEPS$/i))) return `剩 ${m[1]} 步`;

  if (trimmed === 'Your Turn!' || trimmed === 'Card Turn!') {
    return '⚡ 轮到你了！';
  }
  if (trimmed === 'Action Required!') {
    return '🔔 请立即操作！';
  }
  if (trimmed === 'Choose a Color!') {
    return '🎨 请选择颜色！';
  }
  if (trimmed === 'Bluff Window!') {
    return '🕵️ 抓谎时机！';
  }
  if (trimmed === 'Buy or Pass!') {
    return '🏠 买房或跳过！';
  }
  if (trimmed === 'YOU HAVE THE BOMB!') {
    return '💣 炸弹在你手里！';
  }
  if (trimmed === 'YOU ARE THE TAGGER!') {
    return '❄️ 你是追捕者！';
  }
  if (trimmed === 'RED LIGHT — FREEZE!') {
    return '🛑 红灯 — 立即停下！';
  }
  if (trimmed === 'YELLOW LIGHT — SLOW!') {
    return '⚠️ 黄灯 — 准备急停！';
  }
  if (trimmed === 'STOVE ON FIRE!') {
    return '🔥 灶台着火啦！';
  }
  if (trimmed === 'FEVER TIME!') {
    return '🍓 狂热水果雨！';
  }
  if (trimmed === 'CHEST REVEAL!') {
    return '💎 宝箱揭晓！';
  }
  if (trimmed === 'CHAOS WHEEL!') {
    return '🎲 混沌大转盘！';
  }
  if (trimmed === 'GAME PAUSED') {
    return '⏸ 游戏已暂停';
  }
  if (trimmed === 'RESUMING') {
    return '▶ 继续游戏';
  }

  return text;
}
