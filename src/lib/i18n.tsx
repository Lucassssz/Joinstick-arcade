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
      case 'solo':
        return short ? 'Solo · 1P' : 'Solo (1P)';
      case 'double':
        return short ? '2 Players' : 'Double (2P)';
      case 'multiplayer':
        return short ? '3+ Players' : 'Multiplayer (3+)';
    }
  }
  switch (id) {
    case 'all':
      return short ? '全部' : '全部游戏';
    case 'solo':
      return short ? '单人 · 1P' : '单人 (1P)';
    case 'double':
      return short ? '双人 · 2P' : '双人对战 (2P)';
    case 'multiplayer':
      return short ? '多人 3+' : '多人派对 (3+)';
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
    msg.includes('Host closed') ||
    msg.includes('Room closed')
  ) {
    return '大屏房主已结束本次游戏房间。';
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

  return text;
}
