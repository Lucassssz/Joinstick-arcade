import type { GameId, GameMetadata } from './types.ts';

export type MutatorId =
  | 'normal'
  | 'turbo'
  | 'double-pts'
  | 'early-frenzy'
  | 'inverted'
  | 'overdrive';

export interface MutatorSpec {
  id: MutatorId;
  name: string;
  nameZh: string;
  shortTag: string;
  shortTagZh: string;
  description: string;
  descriptionZh: string;
  accentHex: string;
  speedScale: number;
  scoreMult: number;
  earlyFrenzy: boolean;
  invertControls: boolean;
}

export const MUTATORS: MutatorSpec[] = [
  {
    id: 'normal',
    name: 'Classic Rules',
    nameZh: '经典规则',
    shortTag: 'CLASSIC',
    shortTagZh: '经典',
    description: 'Standard arcade speed, points, and controls.',
    descriptionZh: '标准速度、积分与正常操控。',
    accentHex: '#9CA3AF',
    speedScale: 1.0,
    scoreMult: 1,
    earlyFrenzy: false,
    invertControls: false,
  },
  {
    id: 'turbo',
    name: 'Hyper Turbo 1.35×',
    nameZh: '极速狂飙 1.35×',
    shortTag: '1.35× TURBO',
    shortTagZh: '1.35× 极速',
    description: 'Everything runs 35% faster — movement, shots, and timers!',
    descriptionZh: '全局加速 35% —— 移动、攻击与节奏全面加快！',
    accentHex: '#00C2FF',
    speedScale: 1.35,
    scoreMult: 1,
    earlyFrenzy: false,
    invertControls: false,
  },
  {
    id: 'double-pts',
    name: '2× Score Madness',
    nameZh: '双倍积分狂潮',
    shortTag: '2× POINTS',
    shortTagZh: '双倍积分',
    description: 'All points earned are doubled (stacks with Frenzy for 4×!).',
    descriptionZh: '全场得分翻倍（叠加烈焰狂热高达 4 倍积分！）。',
    accentHex: '#FFB800',
    speedScale: 1.0,
    scoreMult: 2,
    earlyFrenzy: false,
    invertControls: false,
  },
  {
    id: 'early-frenzy',
    name: 'Early Inferno',
    nameZh: '半程烈焰',
    shortTag: 'EARLY FRENZY',
    shortTagZh: '半程狂热',
    description: 'Frenzy Mode erupts halfway through the match!',
    descriptionZh: '比赛刚过半即刻引爆烈焰狂热时刻！',
    accentHex: '#FF4D2E',
    speedScale: 1.08,
    scoreMult: 1,
    earlyFrenzy: true,
    invertControls: false,
  },
  {
    id: 'inverted',
    name: 'Mirror Curse',
    nameZh: '镜像反转',
    shortTag: 'MIRRORED',
    shortTagZh: '镜像反转',
    description: 'Joystick directions are flipped upside-down & backwards!',
    descriptionZh: '所有人的摇杆方向上下左右全部反转，爆笑混战！',
    accentHex: '#FF3B9A',
    speedScale: 1.0,
    scoreMult: 1,
    earlyFrenzy: false,
    invertControls: true,
  },
  {
    id: 'overdrive',
    name: 'Golden Overdrive',
    nameZh: '黄金超载',
    shortTag: 'OVERDRIVE',
    shortTagZh: '黄金超载',
    description: '1.25× Speed + 2× Points + Early Frenzy combined!',
    descriptionZh: '1.25× 速度 + 双倍积分 + 半程狂热三合一！',
    accentHex: '#10D98B',
    speedScale: 1.25,
    scoreMult: 2,
    earlyFrenzy: true,
    invertControls: false,
  },
];

export const CHAOS_WHEEL_MUTATORS: MutatorSpec[] = MUTATORS.filter((m) => m.id !== 'normal');

export const MUTATOR_BY_ID: Record<MutatorId, MutatorSpec> = MUTATORS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<MutatorId, MutatorSpec>
);

export function getMutatorSpec(id?: MutatorId | null): MutatorSpec {
  return (id && MUTATOR_BY_ID[id]) || MUTATOR_BY_ID.normal;
}

export interface FrenzyGamePerk {
  perk1En: string;
  perk1Zh: string;
  perk2En: string;
  perk2Zh: string;
}

export const GAME_FRENZY_PERKS: Record<GameId, FrenzyGamePerk> = {
  'bumper-brawl': {
    perk1En: '2× KO POINTS',
    perk1Zh: '击飞双倍积分',
    perk2En: '1.18× HYPER PUSH',
    perk2Zh: '1.18× 狂暴冲撞',
  },
  'astro-blaster': {
    perk1En: '2× KILL SCORE',
    perk1Zh: '击落双倍得分',
    perk2En: '1.18× FIRE & FLIGHT',
    perk2Zh: '1.18× 极速连射',
  },
  'turbo-drift': {
    perk1En: 'FINAL LAP HEAT',
    perk1Zh: '冲刺狂热加速',
    perk2En: '1.18× NITRO PACE',
    perk2Zh: '1.18× 狂飙车速',
  },
  'hex-drop': {
    perk1En: '2× SURVIVAL PTS',
    perk1Zh: '存活双倍积分',
    perk2En: 'FAST CRUMBLE',
    perk2Zh: '地板极速崩塌',
  },
  'fuse-pass': {
    perk1En: '2× TAG & WIN PTS',
    perk1Zh: '传弹与胜出双倍分',
    perk2En: 'HOT SPRINT PACE',
    perk2Zh: '全速追逐狂奔',
  },
  'grid-runners': {
    perk1En: '2× ROUND PTS',
    perk1Zh: '回合双倍积分',
    perk2En: '1.18× LIGHT SPEED',
    perk2Zh: '1.18× 光速漂移',
  },
  'ricochet-tanks': {
    perk1En: '2× BANK & HIT PTS',
    perk1Zh: '反弹击杀双倍分',
    perk2En: '1.18× FAST SHELLS',
    perk2Zh: '1.18× 极速炮弹',
  },
  'turbo-striker': {
    perk1En: '2× GOAL BONUS',
    perk1Zh: '进球双倍加分',
    perk2En: '1.18× GOLDEN PACE',
    perk2Zh: '1.18× 闪电球速',
  },
  'paint-rush': {
    perk1En: '2× PAINT SCORE',
    perk1Zh: '涂色双倍得分',
    perk2En: '1.18× TURBO ROLL',
    perk2Zh: '1.18× 极速滚刷',
  },
  'laser-gauntlet': {
    perk1En: '2× STAR POINTS',
    perk1Zh: '星星双倍得分',
    perk2En: '1.18× DODGE RUSH',
    perk2Zh: '1.18× 高速闪避',
  },
  'vault-heist': {
    perk1En: '2× GEM VALUE',
    perk1Zh: '宝石双倍价值',
    perk2En: '1.18× HEIST ESCAPE',
    perk2Zh: '1.18× 极速撤离',
  },
  'hyper-pong': {
    perk1En: 'MATCH POINT HEAT',
    perk1Zh: '赛点烈焰对决',
    perk2En: '1.18× PUCK SPEED',
    perk2Zh: '1.18× 光速冰球',
  },
  'blade-duel': {
    perk1En: '2× DUEL POINTS',
    perk1Zh: '对决双倍积分',
    perk2En: '1.18× BLADE REFLEX',
    perk2Zh: '1.18× 疾风剑速',
  },
  'cannon-siege': {
    perk1En: '2× SIEGE DAMAGE PTS',
    perk1Zh: '轰炸双倍积分',
    perk2En: '1.18× RAPID FIRE',
    perk2Zh: '1.18× 连发轰击',
  },
  'crown-heist': {
    perk1En: '2× CROWN POINTS',
    perk1Zh: '皇冠双倍跳分',
    perk2En: '1.18× CHASE SPEED',
    perk2Zh: '1.18× 狂奔夺冠',
  },
  'freeze-tag': {
    perk1En: '2× SAVE & TAG PTS',
    perk1Zh: '救援抓捕双倍分',
    perk2En: '1.18× ICE SKATE',
    perk2Zh: '1.18× 冰面狂飙',
  },
  'ghost-hunt': {
    perk1En: '2× CATCH & SURVIVE',
    perk1Zh: '抓鬼生存双倍分',
    perk2En: '1.18× CHASE RUSH',
    perk2Zh: '1.18× 暗夜加速',
  },
  'meteor-swarm': {
    perk1En: '2× METEOR SCORE',
    perk1Zh: '击碎陨石双倍分',
    perk2En: '1.18× OVERCHARGE',
    perk2Zh: '1.18× 战机超频',
  },
  'hook-shot': {
    perk1En: '2× HOOK KO PTS',
    perk1Zh: '钩杀双倍积分',
    perk2En: '1.18× FAST ROPE',
    perk2Zh: '1.18× 极速飞钩',
  },
  'gravity-flip': {
    perk1En: '2× COIN & RUN PTS',
    perk1Zh: '金币与里程双倍分',
    perk2En: '1.18× TUNNEL RUSH',
    perk2Zh: '1.18× 极速隧道',
  },
  'rich-street': {
    perk1En: '2× FINAL RENT PTS',
    perk1Zh: '收租财富双倍计分',
    perk2En: 'HIGH-STAKES ROUNDS',
    perk2Zh: '决战大富翁回合',
  },
  'jungle-ladders': {
    perk1En: '2× CLIMB BONUS',
    perk1Zh: '冲刺排名双倍分',
    perk2En: 'FINAL SPRINT BOOST',
    perk2Zh: '终点极速冲刺',
  },
  'bomb-grid': {
    perk1En: '2× BLAST KO PTS',
    perk1Zh: '炸飞双倍积分',
    perk2En: '1.18× FAST FUSE',
    perk2Zh: '1.18× 急速引信',
  },
  'red-light-dash': {
    perk1En: '2× FINISH BONUS',
    perk1Zh: '冲线双倍积分',
    perk2En: '1.18× SPRINT RUSH',
    perk2Zh: '1.18× 极限冲刺',
  },
  'color-match': {
    perk1En: '2× WAVE SURVIVAL',
    perk1Zh: '过关双倍积分',
    perk2En: '1.18× SCRAMBLE SPEED',
    perk2Zh: '1.18× 极速抢位',
  },
  'kitchen-rush': {
    perk1En: '2× DISH TIPS',
    perk1Zh: '上菜双倍赏金',
    perk2En: '1.18× TURBO GRILL',
    perk2Zh: '1.18× 极速爆炒',
  },
  'treasure-dig': {
    perk1En: '2× GOLD & CROWN',
    perk1Zh: '宝藏双倍暴击',
    perk2En: '1.18× FAST DIGGING',
    perk2Zh: '1.18× 狂热挖宝',
  },
  'fruit-drop': {
    perk1En: '2× FRUIT & STAR',
    perk1Zh: '水果星星双倍分',
    perk2En: '1.18× RAIN SHOWER',
    perk2Zh: '1.18× 疯狂果雨',
  },
  'lucky-auction': {
    perk1En: '2× FINAL CHEST',
    perk1Zh: '压轴宝箱双倍分',
    perk2En: 'HIGH-STAKES BIDDING',
    perk2Zh: '终极豪赌时刻',
  },
  'pinball-clash': {
    perk1En: 'MATCH POINT HEAT',
    perk1Zh: '赛点烈焰对决',
    perk2En: '1.18× PINBALL SPEED',
    perk2Zh: '1.18× 极速弹珠',
  },
};

export const TOURNAMENT_TOTAL_GAMES = 5;
export const TOURNAMENT_MARKS_BY_RANK = [100, 70, 50, 35, 25, 18, 12, 8];

export function computeTournamentMarks(rank: number, isFinaleGame: boolean): number {
  const base = TOURNAMENT_MARKS_BY_RANK[Math.max(0, Math.min(7, rank - 1))] ?? 8;
  return isFinaleGame ? Math.round(base * 1.5) : base;
}

export function pickTournamentGameIds(
  catalog: GameMetadata[],
  playerCount: number,
  count = TOURNAMENT_TOTAL_GAMES
): GameId[] {
  const suitable = catalog.filter((g) => {
    if (playerCount <= 1) return g.suitableFor.includes('solo');
    if (playerCount === 2) return g.suitableFor.includes('double') || g.suitableFor.includes('solo');
    return g.maxPlayers >= Math.min(playerCount, 4);
  });

  const shuffle = <T,>(arr: T[]): T[] => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const picked: GameId[] = [];
  for (const g of shuffle(suitable)) {
    if (picked.length >= count) break;
    picked.push(g.id);
  }
  if (picked.length < count) {
    for (const g of shuffle(catalog)) {
      if (picked.length >= count) break;
      if (!picked.includes(g.id)) picked.push(g.id);
    }
  }
  return picked;
}
