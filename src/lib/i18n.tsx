import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { BotDifficulty, GameId, GameMetadata, PlayerFilterMode } from '../shared/types';

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
    settingOptions: { 60: '60 秒', 75: '75 秒', 90: '90 秒', 120: '120 秒' },
  },
  'treasure-dig': {
    name: '海岛寻宝挖矿',
    category: '雷达寻宝',
    tagline: '跟着冷热雷达光环找宝藏，一铲挖出黄金海盗箱！',
    description: '在阳光海滩上搜索埋藏的宝箱！越靠近黄金，光环越亮越烫（手机也会震动提醒），小心躲开红螃蟹！',
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
  if (
    msg.includes('The host monitor session ended') ||
    msg.includes('The room was closed') ||
    msg.includes('Host closed') ||
    msg.includes('Room closed')
  ) {
    return '房主已关闭本次游戏房间。';
  }

  // Haptics test notices
  if (msg.includes('Open the Join URL directly on your phone')) {
    return '请直接用手机扫描二维码打开链接以体验硬件震动反馈。';
  }
  if (msg.includes('Vibration pulse sent!')) {
    return '已发送震动测试！若无震感，请在手机设置中开启触感反馈并关闭省电模式。';
  }
  if (msg.includes('iOS Taptic tap fired')) {
    return '已触发 iOS 触感反馈（需 iOS 18+ 且开启系统触感；Safari 仅支持点击触发）。';
  }
  if (msg.includes('Hardware vibrate unsupported')) {
    return '当前浏览器不支持硬件震动，已自动启用触感音效替代。';
  }
  if (msg.includes('Vibration not supported')) {
    return '当前设备或浏览器不支持震动反馈。';
  }

  return msg;
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
