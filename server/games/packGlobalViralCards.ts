import type { CardPrivateHandItem, CardPrivateState } from '../../src/shared/types.ts';
import type {
  CodeGridSnapshot,
  FibPartySnapshot,
  TriviaBlitzSnapshot,
  WordPulseSnapshot,
} from '../../src/shared/packGlobalViralTypes.ts';
import { isStateFrenzyActive } from './packModuleAdapter.ts';
import type {
  CompactGameModule,
  CompactResultEntry,
  CompactSoundEvent,
} from './packModuleAdapter.ts';

function rankByScore<T extends { id: string; score: number }>(
  items: T[],
  labelFn: (item: T) => string
): CompactResultEntry[] {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  return sorted.map((it, i) => ({
    playerId: it.id,
    rank: i + 1,
    score: Math.round(it.score),
    statLabel: labelFn(it),
  }));
}

// ============================================================================
// 13. WORD PULSE (Wordle — Private Phone)
// ============================================================================
const WORD_PACKS = [
  { answer: 'MANGO', cat: 'Tropical Fruit', catZh: '热带水果', pool: ['APPLE', 'MANGO', 'PEACH', 'BERRY', 'LEMON', 'MELON'] },
  { answer: 'LASER', cat: 'Sci-Fi Tech', catZh: '科幻科技', pool: ['ROBOT', 'LASER', 'ORBIT', 'DRONE', 'CYBER', 'PULSE'] },
  { answer: 'TIGER', cat: 'Wild Animal', catZh: '野生动物', pool: ['ZEBRA', 'PANDA', 'TIGER', 'SHARK', 'EAGLE', 'KOALA'] },
  { answer: 'PIZZA', cat: 'Party Food', catZh: '派对美食', pool: ['SUSHI', 'PASTA', 'CURRY', 'PIZZA', 'STEAK', 'DONUT'] },
  { answer: 'PIANO', cat: 'Music Gear', catZh: '音乐乐器', pool: ['FLUTE', 'DRUMS', 'PIANO', 'CELLO', 'BANJO', 'ORGAN'] },
  { answer: 'STORM', cat: 'Weather', catZh: '自然天气', pool: ['CLOUD', 'FROST', 'STORM', 'SUNNY', 'FLOOD', 'BLAZE'] },
];

function scoreWordleGuess(guess: string, answer: string): ('correct' | 'present' | 'absent')[] {
  const res: ('correct' | 'present' | 'absent')[] = ['absent', 'absent', 'absent', 'absent', 'absent'];
  const used = [false, false, false, false, false];
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      res[i] = 'correct';
      used[i] = true;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (res[i] === 'correct') continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guess[i] === answer[j]) {
        res[i] = 'present';
        used[j] = true;
        break;
      }
    }
  }
  return res;
}

interface WordPulseState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  order: number[];
  roundPause: number;
  revealedWord: string | null;
  rows: WordPulseSnapshot['rows'];
  usedWords: Set<string>;
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botDelay: number;
    solved: boolean;
    lastPick: string | null;
    score: number;
  }[];
  banner: string | null;
}

export const wordPulseModule: CompactGameModule<WordPulseState, WordPulseSnapshot> = {
  id: 'word-pulse',
  init({ players, settingValue }) {
    const maxRounds = settingValue || 4;
    const order = WORD_PACKS.map((_, i) => i).sort(() => Math.random() - 0.5);
    return {
      timeLeft: 18,
      totalTime: 18,
      round: 1,
      maxRounds,
      order,
      roundPause: 0,
      revealedWord: null,
      rows: [],
      usedWords: new Set(),
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botDelay: 2.2 + Math.random() * 2.5,
        solved: false,
        lastPick: null,
        score: 0,
      })),
      banner: 'TAP A 5-LETTER WORD ON YOUR PHONE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    const pack = WORD_PACKS[state.order[(state.round - 1) % state.order.length]];

    if (state.roundPause > 0) {
      state.roundPause -= dt;
      if (state.roundPause <= 0) {
        if (state.round >= state.maxRounds) return { finished: true, sounds };
        state.round += 1;
        state.timeLeft = 18;
        state.totalTime = 18;
        state.revealedWord = null;
        state.rows = [];
        state.usedWords.clear();
        for (const p of state.players) {
          p.solved = false;
          p.lastPick = null;
          p.botDelay = 2.0 + Math.random() * 2.5;
        }
        state.banner = `ROUND ${state.round} · CRACK THE 5-LETTER WORD!`;
      }
      return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
    }

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    // Bot guesses
    for (const p of state.players) {
      if (!p.isBot || p.solved) continue;
      p.botDelay -= dt;
      if (p.botDelay <= 0) {
        p.botDelay = 2.6 + Math.random() * 2.0;
        const avail = pack.pool.filter((w) => !state.usedWords.has(w));
        if (avail.length > 0) {
          const pick = state.rows.length >= 2 && Math.random() < 0.65 ? pack.answer : avail[Math.floor(Math.random() * avail.length)];
          submitWordGuess(state, p, pick, pack.answer, mult, sounds);
        }
      }
    }

    if (state.timeLeft <= 0 || state.rows.length >= 6 || state.revealedWord) {
      state.revealedWord = pack.answer;
      state.roundPause = 2.6;
      if (!state.players.some((p) => p.solved)) {
        state.banner = `TIME UP · WORD WAS ${pack.answer}!`;
      }
    }

    return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const pack = WORD_PACKS[state.order[(state.round - 1) % state.order.length]];
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = pack.pool.map((w) => ({
        kind: 'party',
        id: `wp_${w}`,
        title: w,
        subtitle: state.usedWords.has(w) ? 'TESTED' : pack.cat,
        badge: '5-LTR',
        accentHex: state.usedWords.has(w) ? '#475569' : '#22C55E',
        playable: !state.revealedWord && !state.usedWords.has(w) && !p.solved,
        selected: false,
      }));
      out[p.id] = {
        gameId: 'word-pulse',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: !state.revealedWord && !p.solved,
        isActionRequired: !state.revealedWord && !p.solved,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        badgeText: `${pack.cat} · ${pack.catZh}`,
        badgeColorHex: '#22C55E',
        statusHint: state.revealedWord
          ? `Word cracked: ${state.revealedWord}!`
          : `Category: ${pack.cat} — Tap a 5-letter guess!`,
        statusHintZh: state.revealedWord
          ? `答案揭晓：${state.revealedWord}！`
          : `提示类别：${pack.catZh} — 点击一个 5 字母词！`,
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    if (state.revealedWord || !action || (action.type !== 'play-card' && action.type !== 'toggle-card') || !action.cardId?.startsWith('wp_')) {
      return { sounds };
    }
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.solved) return { sounds };
    const pack = WORD_PACKS[state.order[(state.round - 1) % state.order.length]];
    const word = action.cardId.slice(3);
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    if (!state.usedWords.has(word)) {
      submitWordGuess(state, p, word, pack.answer, mult, sounds);
    }
    return { sounds };
  },
  snapshot(state) {
    const pack = WORD_PACKS[state.order[(state.round - 1) % state.order.length]];
    return {
      gameId: 'word-pulse',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      maxRounds: state.maxRounds,
      attempt: state.rows.length,
      maxAttempts: 6,
      categoryHint: pack.cat,
      categoryHintZh: pack.catZh,
      revealedWord: state.revealedWord,
      rows: state.rows,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        solved: p.solved,
        lastPick: p.lastPick,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} Word Pts`);
  },
};

function submitWordGuess(
  state: WordPulseState,
  p: WordPulseState['players'][number],
  word: string,
  answer: string,
  mult: number,
  sounds: CompactSoundEvent[]
) {
  state.usedWords.add(word);
  p.lastPick = word;
  const marks = scoreWordleGuess(word, answer);
  state.rows.push({ word, marks, pickerName: p.name, pickerColor: p.colorHex });
  if (word === answer) {
    p.solved = true;
    p.score += (180 + Math.round(state.timeLeft * 6)) * mult;
    state.revealedWord = answer;
    state.roundPause = 2.6;
    state.banner = `${p.name} CRACKED "${answer}"!`;
    sounds.push({ type: 'win', playerId: p.id });
  } else {
    const hits = marks.filter((m) => m !== 'absent').length;
    p.score += hits * 10 * mult;
    sounds.push({ type: 'card', playerId: p.id });
  }
}

// ============================================================================
// 14. TRIVIA BLITZ (Kahoot! — Private Phone)
// ============================================================================
const TRIVIA_BANK = [
  {
    cat: 'POP CULTURE',
    q: 'Which planet is famous for its massive icy ring system?',
    qZh: '太阳系中哪颗行星以壮观的冰环著称？',
    opts: [
      { label: 'Mars', labelZh: '火星' },
      { label: 'Saturn', labelZh: '土星' },
      { label: 'Venus', labelZh: '金星' },
      { label: 'Mercury', labelZh: '水星' },
    ],
    ans: 1,
  },
  {
    cat: 'FOOD & ASIA',
    q: 'Which fragrant coconut-rice dish is Malaysia’s national dish?',
    qZh: '哪道椰浆饭料理被誉为马来西亚国民美食？',
    opts: [
      { label: 'Nasi Lemak', labelZh: '椰浆饭 Nasi Lemak' },
      { label: 'Bibimbap', labelZh: '韩式拌饭' },
      { label: 'Paella', labelZh: '西班牙海鲜饭' },
      { label: 'Risotto', labelZh: '意式炖饭' },
    ],
    ans: 0,
  },
  {
    cat: 'GAMING',
    q: 'What color are Pac-Man’s ghosts right after eating a Power Pellet?',
    qZh: '吃豆人吃下大力丸后，追击的幽灵会变成什么颜色？',
    opts: [
      { label: 'Bright Red', labelZh: '鲜红色' },
      { label: 'Neon Green', labelZh: '荧光绿' },
      { label: 'Dark Blue', labelZh: '深蓝色' },
      { label: 'Gold', labelZh: '金黄色' },
    ],
    ans: 2,
  },
  {
    cat: 'SCIENCE',
    q: 'How many hearts does an octopus have?',
    qZh: '一只章鱼一共有几颗心脏？',
    opts: [
      { label: '1 Heart', labelZh: '1 颗' },
      { label: '2 Hearts', labelZh: '2 颗' },
      { label: '3 Hearts', labelZh: '3 颗' },
      { label: '5 Hearts', labelZh: '5 颗' },
    ],
    ans: 2,
  },
  {
    cat: 'INTERNET',
    q: 'In the viral "2048" puzzle, what is 2 to the power of 11?',
    qZh: '在爆红益智游戏 2048 中，2 的 11 次方是多少？',
    opts: [
      { label: '1024', labelZh: '1024' },
      { label: '2048', labelZh: '2048' },
      { label: '4096', labelZh: '4096' },
      { label: '512', labelZh: '512' },
    ],
    ans: 1,
  },
  {
    cat: 'WORLD',
    q: 'Which country is home to Mount Fuji and Bullet Trains?',
    qZh: '富士山和新干线位于哪个国家？',
    opts: [
      { label: 'South Korea', labelZh: '韩国' },
      { label: 'Thailand', labelZh: '泰国' },
      { label: 'Japan', labelZh: '日本' },
      { label: 'Switzerland', labelZh: '瑞士' },
    ],
    ans: 2,
  },
  {
    cat: 'ANIMALS',
    q: 'Which land animal can sprint faster than 100 km/h?',
    qZh: '哪种陆地动物的冲刺时速能突破 100 公里？',
    opts: [
      { label: 'Cheetah', labelZh: '猎豹' },
      { label: 'Grizzly Bear', labelZh: '灰熊' },
      { label: 'Kangaroo', labelZh: '袋鼠' },
      { label: 'Hippo', labelZh: '河马' },
    ],
    ans: 0,
  },
  {
    cat: 'TECH',
    q: 'What does "HTTP" stand for at the start of web addresses?',
    qZh: '网址开头的 HTTP 第一个字母 H 代表什么？',
    opts: [
      { label: 'High', labelZh: 'High 高速' },
      { label: 'HyperText', labelZh: 'HyperText 超文本' },
      { label: 'Home', labelZh: 'Home 主页' },
      { label: 'Host', labelZh: 'Host 主机' },
    ],
    ans: 1,
  },
  {
    cat: 'MOVIES',
    q: 'Which studio created Spirited Away and My Neighbor Totoro?',
    qZh: '《千与千寻》和《龙猫》是哪家动画工作室的作品？',
    opts: [
      { label: 'Pixar', labelZh: '皮克斯' },
      { label: 'DreamWorks', labelZh: '梦工厂' },
      { label: 'Studio Ghibli', labelZh: '吉卜力工作室' },
      { label: 'Illumination', labelZh: '照明娱乐' },
    ],
    ans: 2,
  },
  {
    cat: 'MUSIC',
    q: 'How many keys are on a standard full-size piano?',
    qZh: '一架标准全尺寸钢琴共有多少个琴键？',
    opts: [
      { label: '64 Keys', labelZh: '64 键' },
      { label: '76 Keys', labelZh: '76 键' },
      { label: '88 Keys', labelZh: '88 键' },
      { label: '100 Keys', labelZh: '100 键' },
    ],
    ans: 2,
  },
];

const OPTION_COLORS = ['#EF4444', '#3B82F6', '#F59E0B', '#22C55E'];

interface TriviaState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'question' | 'reveal';
  order: number[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botDelay: number;
    answered: boolean;
    pickedIdx: number | null;
    pickTimeLeft: number;
    streak: number;
    lastGain: number;
    score: number;
  }[];
  banner: string | null;
}

export const triviaBlitzModule: CompactGameModule<TriviaState, TriviaBlitzSnapshot> = {
  id: 'trivia-blitz',
  init({ players, settingValue }) {
    const maxRounds = Math.min(TRIVIA_BANK.length, settingValue || 8);
    const order = TRIVIA_BANK.map((_, i) => i).sort(() => Math.random() - 0.5);
    return {
      timeLeft: 12,
      totalTime: 12,
      round: 1,
      maxRounds,
      phase: 'question',
      order,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botDelay: 1.8 + Math.random() * 4.5,
        answered: false,
        pickedIdx: null,
        pickTimeLeft: 0,
        streak: 0,
        lastGain: 0,
        score: 0,
      })),
      banner: 'SLAM THE RIGHT COLOR ON YOUR PHONE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const q = TRIVIA_BANK[state.order[(state.round - 1) % state.order.length]];

    if (state.phase === 'question') {
      for (const p of state.players) {
        if (p.isBot && !p.answered) {
          p.botDelay -= dt;
          if (p.botDelay <= 0) {
            p.answered = true;
            p.pickedIdx = Math.random() < 0.72 ? q.ans : Math.floor(Math.random() * 4);
            p.pickTimeLeft = state.timeLeft;
            sounds.push({ type: 'tick', playerId: p.id });
          }
        }
      }
      const allAnswered = state.players.every((p) => p.answered);
      if (state.timeLeft <= 0 || allAnswered) {
        state.phase = 'reveal';
        state.timeLeft = 3.2;
        state.totalTime = 3.2;
        const mult = frenzy ? 2 : 1;
        for (const p of state.players) {
          if (p.pickedIdx === q.ans) {
            p.streak += 1;
            const gain = Math.round((100 + p.pickTimeLeft * 8 + p.streak * 20) * mult);
            p.lastGain = gain;
            p.score += gain;
          } else {
            p.streak = 0;
            p.lastGain = 0;
          }
        }
        state.banner = `ANSWER: ${q.opts[q.ans].label}!`;
        sounds.push({ type: 'score' });
      }
    } else if (state.timeLeft <= 0) {
      if (state.round >= state.maxRounds) return { finished: true, sounds };
      state.round += 1;
      state.phase = 'question';
      state.timeLeft = 12;
      state.totalTime = 12;
      for (const p of state.players) {
        p.answered = false;
        p.pickedIdx = null;
        p.lastGain = 0;
        p.botDelay = 1.6 + Math.random() * 4.5;
      }
      state.banner = `QUESTION ${state.round} / ${state.maxRounds}`;
    }

    return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const q = TRIVIA_BANK[state.order[(state.round - 1) % state.order.length]];
    const letters = ['A', 'B', 'C', 'D'];
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = q.opts.map((o, idx) => ({
        kind: 'party',
        id: `tr_${idx}`,
        title: `${letters[idx]} · ${o.label}`,
        subtitle: o.labelZh,
        badge: letters[idx],
        accentHex: OPTION_COLORS[idx],
        playable: state.phase === 'question' && !p.answered,
        selected: p.pickedIdx === idx,
      }));
      out[p.id] = {
        gameId: 'trivia-blitz',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: state.phase === 'question' && !p.answered,
        isActionRequired: state.phase === 'question' && !p.answered,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        badgeText: p.streak >= 2 ? `🔥 STREAK ×${p.streak}` : q.cat,
        badgeColorHex: p.streak >= 2 ? '#F59E0B' : '#8B5CF6',
        statusHint:
          state.phase === 'reveal'
            ? p.lastGain > 0
              ? `CORRECT! +${p.lastGain} PTS!`
              : `Answer: ${q.opts[q.ans].label}`
            : p.answered
            ? 'Answer locked! Waiting for reveal...'
            : 'Tap the correct color tile fast!',
        statusHintZh:
          state.phase === 'reveal'
            ? p.lastGain > 0
              ? `答对了！+${p.lastGain} 分！`
              : `正确答案：${q.opts[q.ans].labelZh}`
            : p.answered
            ? '已锁定答案！等待揭晓...'
            : '快点击手机上对应的正确彩色选项！',
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    if (state.phase !== 'question' || (action.type !== 'play-card' && action.type !== 'toggle-card') || !action.cardId?.startsWith('tr_')) {
      return { sounds };
    }
    const p = state.players.find((x) => x.id === playerId);
    if (!p || p.answered) return { sounds };
    p.pickedIdx = Number(action.cardId.slice(3));
    p.answered = true;
    p.pickTimeLeft = state.timeLeft;
    sounds.push({ type: 'tick', playerId: p.id });
    return { sounds };
  },
  snapshot(state) {
    const q = TRIVIA_BANK[state.order[(state.round - 1) % state.order.length]];
    return {
      gameId: 'trivia-blitz',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      maxRounds: state.maxRounds,
      phase: state.phase,
      category: q.cat,
      question: q.q,
      questionZh: q.qZh,
      options: q.opts.map((o, i) => ({ label: o.label, labelZh: o.labelZh, colorHex: OPTION_COLORS[i] })),
      correctIdx: state.phase === 'reveal' ? q.ans : null,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        answered: p.answered,
        pickedIdx: state.phase === 'reveal' ? p.pickedIdx : null,
        streak: p.streak,
        lastGain: p.lastGain,
        score: Math.round(p.score),
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${Math.round(p.score)} Quiz Pts`);
  },
};

// ============================================================================
// 15. CODE GRID (Codenames — Private Phone)
// ============================================================================
const CODENAME_ROUNDS = [
  {
    clue: 'OCEAN',
    clueZh: '海洋',
    agents: [
      ['SHARK', '鲨鱼'],
      ['CORAL', '珊瑚'],
      ['ANCHOR', '铁锚'],
      ['WHALE', '鲸鱼'],
    ],
    neutrals: [
      ['DESERT', '沙漠'],
      ['PIANO', '钢琴'],
      ['CLOUD', '云朵'],
      ['APPLE', '苹果'],
      ['CLOCK', '时钟'],
      ['TRAIN', '火车'],
      ['CROWN', '皇冠'],
    ],
    assassin: ['SKULL', '骷髅'],
  },
  {
    clue: 'SPACE',
    clueZh: '太空',
    agents: [
      ['ROCKET', '火箭'],
      ['ORBIT', '轨道'],
      ['METEOR', '陨石'],
      ['GALAXY', '银河'],
    ],
    neutrals: [
      ['FOREST', '森林'],
      ['BREAD', '面包'],
      ['BRIDGE', '大桥'],
      ['GUITAR', '吉他'],
      ['MIRROR', '镜子'],
      ['GARDEN', '花园'],
      ['HAMMER', '铁锤'],
    ],
    assassin: ['POISON', '毒药'],
  },
  {
    clue: 'KITCHEN',
    clueZh: '厨房',
    agents: [
      ['KNIFE', '厨刀'],
      ['OVEN', '烤箱'],
      ['SPICE', '香料'],
      ['NOODLE', '面条'],
    ],
    neutrals: [
      ['CASTLE', '城堡'],
      ['TIGER', '老虎'],
      ['RIVER', '河流'],
      ['ROBOT', '机器人'],
      ['DIAMOND', '钻石'],
      ['PILLOW', '枕头'],
      ['JACKET', '夹克'],
    ],
    assassin: ['BOMB', '炸弹'],
  },
  {
    clue: 'WINTER',
    clueZh: '冬天',
    agents: [
      ['GLACIER', '冰川'],
      ['SCARF', '围巾'],
      ['PENGUIN', '企鹅'],
      ['SKI', '滑雪'],
    ],
    neutrals: [
      ['VOLCANO', '火山'],
      ['MANGO', '芒果'],
      ['CAMEL', '骆驼'],
      ['CACTUS', '仙人掌'],
      ['CANDLE', '蜡烛'],
      ['COMPASS', '罗盘'],
      ['KEY', '钥匙'],
    ],
    assassin: ['VENOM', '毒液'],
  },
];

interface CodeGridState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  roundPause: number;
  clueWord: string;
  clueWordZh: string;
  clueCount: number;
  foundCount: number;
  cards: CodeGridSnapshot['cards'];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botDelay: number;
    correctPicks: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

function buildCodeGridRound(roundIdx: number) {
  const r = CODENAME_ROUNDS[roundIdx % CODENAME_ROUNDS.length];
  const raw: CodeGridSnapshot['cards'] = [
    ...r.agents.map(([w, zh], i) => ({ id: `cg_a${i}`, word: w, wordZh: zh, kind: 'agent' as const, revealed: false, pickedByColor: null })),
    ...r.neutrals.map(([w, zh], i) => ({ id: `cg_n${i}`, word: w, wordZh: zh, kind: 'neutral' as const, revealed: false, pickedByColor: null })),
    { id: 'cg_ass', word: r.assassin[0], wordZh: r.assassin[1], kind: 'assassin' as const, revealed: false, pickedByColor: null },
  ];
  raw.sort(() => Math.random() - 0.5);
  return { clue: r.clue, clueZh: r.clueZh, count: r.agents.length, cards: raw };
}

export const codenamesGridModule: CompactGameModule<CodeGridState, CodeGridSnapshot> = {
  id: 'codenames-grid',
  init({ players, settingValue }) {
    const maxRounds = settingValue || 4;
    const rd = buildCodeGridRound(0);
    return {
      timeLeft: 18,
      totalTime: 18,
      round: 1,
      maxRounds,
      roundPause: 0,
      clueWord: rd.clue,
      clueWordZh: rd.clueZh,
      clueCount: rd.count,
      foundCount: 0,
      cards: rd.cards,
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botDelay: 2.0 + Math.random() * 2.5,
        correctPicks: 0,
        score: 0,
        lastAction: 'SCANNING',
      })),
      banner: `SPYMASTER CLUE: ${rd.clue} (${rd.count})`,
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    if (state.roundPause > 0) {
      state.roundPause -= dt;
      if (state.roundPause <= 0) {
        if (state.round >= state.maxRounds) return { finished: true, sounds };
        state.round += 1;
        const rd = buildCodeGridRound(state.round - 1);
        state.clueWord = rd.clue;
        state.clueWordZh = rd.clueZh;
        state.clueCount = rd.count;
        state.foundCount = 0;
        state.cards = rd.cards;
        state.timeLeft = 18;
        state.totalTime = 18;
        state.banner = `SPYMASTER CLUE: ${rd.clue} (${rd.count})`;
      }
      return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
    }

    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const mult = frenzy ? 2 : 1;

    for (const p of state.players) {
      if (!p.isBot) continue;
      p.botDelay -= dt;
      if (p.botDelay <= 0) {
        p.botDelay = 2.5 + Math.random() * 2.2;
        const unrevealed = state.cards.filter((c) => !c.revealed);
        const agents = unrevealed.filter((c) => c.kind === 'agent');
        const pick = agents.length > 0 && Math.random() < 0.72
          ? agents[Math.floor(Math.random() * agents.length)]
          : unrevealed[Math.floor(Math.random() * unrevealed.length)];
        if (pick) flipCodeCard(state, p, pick, mult, sounds);
      }
    }

    if (state.timeLeft <= 0 || state.foundCount >= state.clueCount) {
      for (const c of state.cards) c.revealed = true;
      state.roundPause = 2.6;
    }

    return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      const hand: CardPrivateHandItem[] = state.cards
        .filter((c) => !c.revealed)
        .slice(0, 8)
        .map((c) => ({
          kind: 'party',
          id: c.id,
          title: c.word,
          subtitle: c.wordZh,
          badge: 'CODE',
          accentHex: '#14B8A6',
          playable: state.roundPause <= 0,
          selected: false,
        }));
      out[p.id] = {
        gameId: 'codenames-grid',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: state.roundPause <= 0,
        isActionRequired: state.roundPause <= 0,
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        badgeText: `${state.clueWord} (${state.clueWordZh}) · ${state.clueCount - state.foundCount} LEFT`,
        badgeColorHex: '#14B8A6',
        statusHint: `Clue: "${state.clueWord}" — Tap matching codenames, avoid the Assassin!`,
        statusHintZh: `特工线索：「${state.clueWordZh}」— 点选关联代号，躲开刺客！`,
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    if (state.roundPause > 0 || (action.type !== 'play-card' && action.type !== 'toggle-card') || !action.cardId) {
      return { sounds };
    }
    const p = state.players.find((x) => x.id === playerId);
    const card = state.cards.find((c) => c.id === action.cardId && !c.revealed);
    const mult = isStateFrenzyActive(state) ? 2 : 1;
    if (p && card) flipCodeCard(state, p, card, mult, sounds);
    return { sounds };
  },
  snapshot(state) {
    return {
      gameId: 'codenames-grid',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      maxRounds: state.maxRounds,
      clueWord: state.clueWord,
      clueWordZh: state.clueWordZh,
      clueCount: state.clueCount,
      foundCount: state.foundCount,
      cards: state.cards,
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        correctPicks: p.correctPicks,
        score: Math.round(p.score),
        lastAction: p.lastAction,
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `${p.correctPicks} Agents Decoded`);
  },
};

function flipCodeCard(
  state: CodeGridState,
  p: CodeGridState['players'][number],
  card: CodeGridSnapshot['cards'][number],
  mult: number,
  sounds: CompactSoundEvent[]
) {
  card.revealed = true;
  card.pickedByColor = p.colorHex;
  if (card.kind === 'agent') {
    p.correctPicks += 1;
    p.score += 100 * mult;
    p.lastAction = `AGENT +${100 * mult}`;
    state.foundCount += 1;
    state.banner = `${p.name} DECODED AGENT ${card.word}!`;
    sounds.push({ type: 'score', playerId: p.id });
  } else if (card.kind === 'assassin') {
    p.score = Math.max(0, p.score - 120);
    p.lastAction = 'ASSASSIN!';
    state.banner = `💀 ${p.name} TRIGGERED THE ASSASSIN (${card.word})!`;
    state.roundPause = 2.6;
    sounds.push({ type: 'elim', playerId: p.id });
  } else {
    p.lastAction = 'NEUTRAL';
    sounds.push({ type: 'tick', playerId: p.id });
  }
}

// ============================================================================
// 16. BLUFF TRIVIA (Fibbage — Private Phone)
// ============================================================================
const FIB_BANK = [
  {
    prompt: 'In Switzerland, it is illegal to own just ONE ______ because they get lonely.',
    promptZh: '在瑞士，法律禁止只养一只 ______，因为它们会感到孤单。',
    truth: ['Guinea Pig', '豚鼠 (天竺鼠)'],
    decoys: [
      ['Goldfish', '金鱼'],
      ['Parrot', '鹦鹉'],
      ['Hamster', '仓鼠'],
      ['Penguin', '企鹅'],
      ['Llama', '羊驼'],
    ],
  },
  {
    prompt: 'Bananas are naturally slightly ______ because of their potassium content.',
    promptZh: '由于富含钾元素，香蕉天然带有一点微弱的 ______。',
    truth: ['Radioactive', '放射性'],
    decoys: [
      ['Magnetic', '磁性'],
      ['Glow-in-the-dark', '夜光性'],
      ['Electric', '导电发光'],
      ['Fireproof', '防火性'],
      ['Antigravity', '反重力'],
    ],
  },
  {
    prompt: 'The official national animal of Scotland is the ______.',
    promptZh: '苏格兰的官方国家象征动物竟然是 ______。',
    truth: ['Unicorn', '独角兽'],
    decoys: [
      ['Dragon', '火龙'],
      ['Loch Ness Monster', '尼斯湖水怪'],
      ['Golden Eagle', '金雕'],
      ['Red Fox', '赤狐'],
      ['Highland Cow', '高地长毛牛'],
    ],
  },
  {
    prompt: 'Astronauts grow up to 5 cm ______ while living aboard the Space Station.',
    promptZh: '宇航员在太空站生活期间，身体会长得 ______ 最多 5 厘米。',
    truth: ['Taller', '更高'],
    decoys: [
      ['Wider', '更宽'],
      ['Longer Fingers', '手指更长'],
      ['Bigger Feet', '脚掌更大'],
      ['Shorter', '更矮'],
      ['Heavier', '更重'],
    ],
  },
  {
    prompt: 'Honey found inside 3,000-year-old Egyptian tombs is still completely ______.',
    promptZh: '在 3000 年前的古埃及陵墓里发现的蜂蜜至今依然完全 ______。',
    truth: ['Edible', '可以食用'],
    decoys: [
      ['Liquid Blue', '呈液态蓝色'],
      ['Spicy', '带辛辣味'],
      ['Frozen Solid', '结成冰块'],
      ['Sparkling', '冒气泡'],
      ['Magnetic', '带有磁性'],
    ],
  },
];

interface FibState {
  timeLeft: number;
  totalTime: number;
  round: number;
  maxRounds: number;
  phase: 'write-fib' | 'guess-truth' | 'reveal';
  order: number[];
  boardChoices: {
    id: string;
    text: string;
    textZh: string;
    isTruth: boolean;
    authorId: string | null;
    authorName?: string;
    voterIds: string[];
  }[];
  players: {
    id: string;
    slotIndex: number;
    name: string;
    colorHex: string;
    isBot: boolean;
    botDelay: number;
    fibText: [string, string] | null;
    voteId: string | null;
    fooledCount: number;
    score: number;
    lastAction: string;
  }[];
  banner: string | null;
}

export const fibPartyModule: CompactGameModule<FibState, FibPartySnapshot> = {
  id: 'fib-party',
  init({ players, settingValue }) {
    const maxRounds = Math.min(FIB_BANK.length, settingValue || 4);
    const order = FIB_BANK.map((_, i) => i).sort(() => Math.random() - 0.5);
    return {
      timeLeft: 10,
      totalTime: 10,
      round: 1,
      maxRounds,
      phase: 'write-fib',
      order,
      boardChoices: [],
      players: players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        isBot: !!p.isBot,
        botDelay: 1.5 + Math.random() * 2.5,
        fibText: null,
        voteId: null,
        fooledCount: 0,
        score: 0,
        lastAction: 'PLOTTING LIE',
      })),
      banner: 'PHASE 1: PLANT A BELIEVABLE LIE ON YOUR PHONE!',
    };
  },
  step(state, players, dt, frenzy) {
    const sounds: CompactSoundEvent[] = [];
    state.timeLeft = Math.max(0, state.timeLeft - dt);
    const item = FIB_BANK[state.order[(state.round - 1) % state.order.length]];

    if (state.phase === 'write-fib') {
      for (const p of state.players) {
        if (p.isBot && !p.fibText) {
          p.botDelay -= dt;
          if (p.botDelay <= 0) {
            const d = item.decoys[Math.floor(Math.random() * item.decoys.length)];
            p.fibText = [d[0], d[1]];
            p.lastAction = 'LIE PLANTED';
          }
        }
      }
      if (state.timeLeft <= 0 || state.players.every((p) => p.fibText !== null)) {
        // Assemble mixed choices (unique lies + 1 truth)
        const seen = new Set<string>([item.truth[0]]);
        const choices: FibState['boardChoices'] = [
          { id: 'truth', text: item.truth[0], textZh: item.truth[1], isTruth: true, authorId: null, voterIds: [] },
        ];
        for (const p of state.players) {
          const lie = p.fibText ?? item.decoys[p.slotIndex % item.decoys.length];
          if (!seen.has(lie[0])) {
            seen.add(lie[0]);
            choices.push({
              id: `fib_${p.id}`,
              text: lie[0],
              textZh: lie[1],
              isTruth: false,
              authorId: p.id,
              authorName: p.name,
              voterIds: [],
            });
          }
        }
        // Ensure at least 4 options on screen
        for (const d of item.decoys) {
          if (choices.length >= 4) break;
          if (!seen.has(d[0])) {
            seen.add(d[0]);
            choices.push({ id: `dec_${choices.length}`, text: d[0], textZh: d[1], isTruth: false, authorId: null, voterIds: [] });
          }
        }
        choices.sort(() => Math.random() - 0.5);
        state.boardChoices = choices;
        state.phase = 'guess-truth';
        state.timeLeft = 11;
        state.totalTime = 11;
        for (const p of state.players) {
          p.voteId = null;
          p.botDelay = 1.6 + Math.random() * 3.0;
          p.lastAction = 'GUESSING';
        }
        state.banner = 'PHASE 2: SPOT THE REAL TRUTH!';
        sounds.push({ type: 'card' });
      }
    } else if (state.phase === 'guess-truth') {
      for (const p of state.players) {
        if (p.isBot && !p.voteId) {
          p.botDelay -= dt;
          if (p.botDelay <= 0) {
            const valid = state.boardChoices.filter((c) => c.authorId !== p.id);
            const pick = valid[Math.floor(Math.random() * valid.length)] ?? state.boardChoices[0];
            p.voteId = pick.id;
            pick.voterIds.push(p.id);
            p.lastAction = 'VOTED';
          }
        }
      }
      if (state.timeLeft <= 0 || state.players.every((p) => p.voteId !== null)) {
        state.phase = 'reveal';
        state.timeLeft = 3.8;
        state.totalTime = 3.8;
        const mult = frenzy ? 2 : 1;
        for (const c of state.boardChoices) {
          if (c.isTruth) {
            for (const vid of c.voterIds) {
              const vp = state.players.find((x) => x.id === vid);
              if (vp) {
                vp.score += 100 * mult;
                vp.lastAction = `TRUTH +${100 * mult}`;
              }
            }
          } else if (c.authorId && c.voterIds.length > 0) {
            const author = state.players.find((x) => x.id === c.authorId);
            if (author) {
              author.fooledCount += c.voterIds.length;
              author.score += c.voterIds.length * 75 * mult;
              author.lastAction = `FOOLED ${c.voterIds.length}!`;
            }
          }
        }
        state.banner = `THE TRUTH WAS: ${item.truth[0]}!`;
        sounds.push({ type: 'win' });
      }
    } else if (state.timeLeft <= 0) {
      if (state.round >= state.maxRounds) return { finished: true, sounds };
      state.round += 1;
      state.phase = 'write-fib';
      state.timeLeft = 10;
      state.totalTime = 10;
      state.boardChoices = [];
      for (const p of state.players) {
        p.fibText = null;
        p.voteId = null;
        p.botDelay = 1.4 + Math.random() * 2.5;
        p.lastAction = 'PLOTTING LIE';
      }
      state.banner = `ROUND ${state.round} · PLANT YOUR LIE!`;
    }

    return { finished: false, sounds, privateStates: this.getPrivateStates!(state, players) };
  },
  getPrivateStates(state) {
    const item = FIB_BANK[state.order[(state.round - 1) % state.order.length]];
    const out: Record<string, CardPrivateState> = {};
    for (const p of state.players) {
      let hand: CardPrivateHandItem[] = [];
      if (state.phase === 'write-fib') {
        hand = item.decoys.map((d, idx) => ({
          kind: 'party',
          id: `lie_${idx}`,
          title: d[0],
          subtitle: d[1],
          badge: 'DECOY',
          accentHex: '#F43F5E',
          playable: !p.fibText,
          selected: p.fibText?.[0] === d[0],
        }));
      } else if (state.phase === 'guess-truth') {
        hand = state.boardChoices
          .filter((c) => c.authorId !== p.id)
          .map((c) => ({
            kind: 'party',
            id: `vt_${c.id}`,
            title: c.text,
            subtitle: c.textZh,
            badge: 'TRUTH?',
            accentHex: '#38BDF8',
            playable: !p.voteId,
            selected: p.voteId === c.id,
          }));
      }
      out[p.id] = {
        gameId: 'fib-party',
        playerId: p.id,
        hand,
        cursorIndex: 0,
        isMyTurn: (state.phase === 'write-fib' && !p.fibText) || (state.phase === 'guess-truth' && !p.voteId),
        isActionRequired: (state.phase === 'write-fib' && !p.fibText) || (state.phase === 'guess-truth' && !p.voteId),
        turnTimeLeft: state.timeLeft,
        turnTotal: state.totalTime,
        badgeText: state.phase === 'write-fib' ? 'PLANT A LIE' : state.phase === 'guess-truth' ? 'SPOT THE TRUTH' : 'REVEAL',
        badgeColorHex: state.phase === 'write-fib' ? '#F43F5E' : '#38BDF8',
        statusHint:
          state.phase === 'write-fib'
            ? 'Tap a believable decoy lie to fool your friends!'
            : state.phase === 'guess-truth'
            ? 'Which one is the REAL fact? Tap to vote!'
            : `Truth: ${item.truth[0]}!`,
        statusHintZh:
          state.phase === 'write-fib'
            ? '点选一条以假乱真的假答案坑朋友！'
            : state.phase === 'guess-truth'
            ? '哪一条才是真正冷知识？快投票！'
            : `真相揭晓：${item.truth[1]}！`,
      };
    }
    return out;
  },
  handleCardAction(state, playerId, action) {
    const sounds: CompactSoundEvent[] = [];
    if ((action.type !== 'play-card' && action.type !== 'toggle-card') || !action.cardId) return { sounds };
    const p = state.players.find((x) => x.id === playerId);
    if (!p) return { sounds };
    const item = FIB_BANK[state.order[(state.round - 1) % state.order.length]];

    if (state.phase === 'write-fib' && !p.fibText && action.cardId.startsWith('lie_')) {
      const d = item.decoys[Number(action.cardId.slice(4))];
      if (d) {
        p.fibText = [d[0], d[1]];
        p.lastAction = 'LIE PLANTED';
        sounds.push({ type: 'tick', playerId: p.id });
      }
    } else if (state.phase === 'guess-truth' && !p.voteId && action.cardId.startsWith('vt_')) {
      const cid = action.cardId.slice(3);
      const choice = state.boardChoices.find((c) => c.id === cid && c.authorId !== p.id);
      if (choice) {
        p.voteId = choice.id;
        choice.voterIds.push(p.id);
        p.lastAction = 'VOTED';
        sounds.push({ type: 'tick', playerId: p.id });
      }
    }
    return { sounds };
  },
  snapshot(state) {
    const item = FIB_BANK[state.order[(state.round - 1) % state.order.length]];
    return {
      gameId: 'fib-party',
      timeLeft: state.timeLeft,
      totalTime: state.totalTime,
      round: state.round,
      maxRounds: state.maxRounds,
      phase: state.phase,
      prompt: item.prompt,
      promptZh: item.promptZh,
      truthAnswer: state.phase === 'reveal' ? `${item.truth[0]} (${item.truth[1]})` : null,
      choices: state.boardChoices.map((c) => ({
        id: c.id,
        text: c.text,
        textZh: c.textZh,
        isTruth: state.phase === 'reveal' ? c.isTruth : undefined,
        authorName: state.phase === 'reveal' ? c.authorName : undefined,
        voterColors:
          state.phase === 'reveal'
            ? c.voterIds.map((vid) => state.players.find((x) => x.id === vid)?.colorHex ?? '#FFFFFF')
            : [],
      })),
      players: state.players.map((p) => ({
        id: p.id,
        slotIndex: p.slotIndex,
        name: p.name,
        colorHex: p.colorHex,
        submitted: state.phase === 'write-fib' ? !!p.fibText : !!p.voteId,
        fooledCount: p.fooledCount,
        score: Math.round(p.score),
        lastAction: p.lastAction,
        cooldownA: 0,
        cooldownB: 0,
      })),
      banner: state.banner,
    };
  },
  buildResults(state) {
    return rankByScore(state.players, (p) => `Fooled ${p.fooledCount} · ${Math.round(p.score)} pts`);
  },
};
