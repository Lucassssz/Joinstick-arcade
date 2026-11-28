import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'motion/react';
import {
  Bot,
  ChevronRight,
  Home,
  Play,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { GameId } from '../shared/types';
import { useLanguage } from '../lib/i18n';
import {
  answerRuleQuestion,
  buildWelcomeReply,
  getAllSearchableGames,
  resolveGuideChoice,
  type RuleBotChoice,
  type RuleBotReply,
  type RuleBotSession,
  type RuleBotSuggestedGame,
} from '../lib/ruleChatbotEngine';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  reply?: RuleBotReply;
}

interface RuleChatbotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeGameId?: GameId | null;
  roomPlayerCount?: number | null;
  onSelectGame?: (gameId: GameId) => void;
}

const BOT_REPLY_VARIANTS: Variants = {
  hidden: { opacity: 0, x: -12, y: 6 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.18,
      ease: 'easeOut',
      staggerChildren: 0.035,
    },
  },
};

const BOT_BLOCK_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.16,
      ease: 'easeOut',
    },
  },
};

const SUGGESTED_LIST_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.16,
      ease: 'easeOut',
      staggerChildren: 0.03,
    },
  },
};

const SUGGESTED_CARD_VARIANTS: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 5 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.16,
      ease: 'easeOut',
    },
  },
};

const CHOICES_GRID_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.16,
      ease: 'easeOut',
      staggerChildren: 0.03,
    },
  },
};

const CHOICE_ITEM_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.16,
      ease: 'easeOut',
    },
  },
};

export function RuleChatbotDrawer({
  isOpen,
  onClose,
  activeGameId = null,
  roomPlayerCount = null,
  onSelectGame,
}: RuleChatbotDrawerProps) {
  const { lang, t } = useLanguage();
  const prefersReducedMotion = useReducedMotion();
  const reduced = Boolean(prefersReducedMotion);

  const [isDesktop, setIsDesktop] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 640px)').matches : false
  );
  const [focusedGameId, setFocusedGameId] = useState<GameId | null>(activeGameId);
  const [session, setSession] = useState<RuleBotSession>(() => ({
    lastGameId: activeGameId ?? null,
    partySize: roomPlayerCount != null && roomPlayerCount > 0 ? roomPlayerCount : null,
  }));
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const welcome = buildWelcomeReply(activeGameId, lang);
    return [{ id: 'welcome_0', sender: 'bot', text: welcome.text, reply: welcome }];
  });
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevLangRef = useRef(lang);
  const prevActiveGameRef = useRef<GameId | null>(activeGameId);
  const prevOpenRef = useRef(isOpen);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReplyRef = useRef<{ id: string; reply: RuleBotReply } | null>(null);
  const msgSeqRef = useRef(0);
  const isMountedRef = useRef(true);
  const seenMsgIdsRef = useRef<Set<string>>(new Set());

  const cancelPendingReply = () => {
    if (pendingTimerRef.current !== null) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    pendingReplyRef.current = null;
    setIsTyping(false);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 640px)');
    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pendingTimerRef.current !== null) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      pendingReplyRef.current = null;
    };
  }, []);

  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;
    if (!isOpen) {
      cancelPendingReply();
    }
    if (!wasOpen && isOpen && roomPlayerCount != null && roomPlayerCount > 0) {
      setSession((prev) => ({
        ...prev,
        partySize: roomPlayerCount,
      }));
    }
  }, [isOpen, roomPlayerCount]);

  useEffect(() => {
    const gameChanged = prevActiveGameRef.current !== activeGameId;
    const langChanged = prevLangRef.current !== lang;
    if (gameChanged || langChanged) {
      cancelPendingReply();
      prevActiveGameRef.current = activeGameId;
      prevLangRef.current = lang;
      if (gameChanged) setFocusedGameId(activeGameId);
      const nextFocus = gameChanged ? activeGameId : focusedGameId;
      setSession({
        lastGameId: nextFocus ?? null,
        lastCandidates: [],
        lastIntent: null,
        partySize: roomPlayerCount != null && roomPlayerCount > 0 ? roomPlayerCount : null,
      });
      const welcome = buildWelcomeReply(nextFocus, lang);
      seenMsgIdsRef.current.clear();
      msgSeqRef.current += 1;
      setMessages([
        {
          id: `welcome_${Date.now()}_${msgSeqRef.current}`,
          sender: 'bot',
          text: welcome.text,
          reply: welcome,
        },
      ]);
    }
  }, [activeGameId, lang, focusedGameId, roomPlayerCount]);

  useEffect(() => {
    if (!isOpen) return;
    for (const m of messages) {
      seenMsgIdsRef.current.add(m.id);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      listEndRef.current?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    }, 40);
    return () => clearTimeout(timer);
  }, [messages, isTyping, isOpen, reduced]);

  const allGames = useMemo(() => getAllSearchableGames(lang), [lang]);
  const filteredGames = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return allGames;
    return allGames.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q) ||
        g.genreLabel.toLowerCase().includes(q)
    );
  }, [allGames, pickerSearch]);

  const botOptions = {
    canSelectGame: Boolean(onSelectGame),
    roomPlayerCount: roomPlayerCount ?? null,
  };

  const appendExchange = (userText: string, reply: RuleBotReply) => {
    cancelPendingReply();
    if (reply.resolvedGameId) {
      setFocusedGameId(reply.resolvedGameId);
    }
    if (reply.session) {
      setSession(reply.session);
    }
    const now = Date.now();
    msgSeqRef.current += 1;
    const userMsgId = `u_${now}_${msgSeqRef.current}`;
    msgSeqRef.current += 1;
    const botMsgId = `b_${now}_${msgSeqRef.current}`;

    setInputValue('');
    setPickerOpen(false);

    if (reduced) {
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, sender: 'user', text: userText },
        { id: botMsgId, sender: 'bot', text: reply.text, reply },
      ]);
      return;
    }

    setMessages((prev) => [...prev, { id: userMsgId, sender: 'user', text: userText }]);
    setIsTyping(true);

    const delayMs = Math.min(450, 350 + Math.round((reply.text.length / 100) * 15));
    pendingReplyRef.current = { id: botMsgId, reply };
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = null;
      const pending = pendingReplyRef.current;
      pendingReplyRef.current = null;
      if (!pending || !isMountedRef.current) return;
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: pending.id, sender: 'bot', text: pending.reply.text, reply: pending.reply },
      ]);
    }, delayMs);
  };

  const submitQuestion = (questionText: string, overrideGameId?: GameId | null) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    const contextId = overrideGameId !== undefined ? overrideGameId : focusedGameId;
    const reply = answerRuleQuestion(trimmed, lang, contextId, session, botOptions);
    appendExchange(trimmed, reply);
  };

  const handleSelectChoice = (choice: RuleBotChoice) => {
    if (choice.action === 'open-picker') {
      setPickerOpen(true);
      setPickerSearch('');
      return;
    }
    if (choice.action === 'select-game') {
      cancelPendingReply();
      onSelectGame?.(choice.value as GameId);
      onClose();
      return;
    }
    const reply = resolveGuideChoice(choice, lang, focusedGameId, session, botOptions);
    appendExchange(choice.label, reply);
  };

  const handlePickGame = (game: RuleBotSuggestedGame) => {
    setFocusedGameId(game.id);
    setPickerOpen(false);
    setPickerSearch('');
    const prompt = lang === 'zh' ? `${game.name} 怎么玩？` : `How to play ${game.name}`;
    submitQuestion(prompt, game.id);
  };

  const handleGoMainMenu = () => {
    setPickerOpen(false);
    setSession({
      lastGameId: activeGameId ?? null,
      lastCandidates: [],
      lastIntent: 'greeting',
      partySize: session.partySize ?? (roomPlayerCount != null && roomPlayerCount > 0 ? roomPlayerCount : null),
    });
    const welcome = buildWelcomeReply(activeGameId, lang);
    appendExchange(t('Main Menu', '返回主菜单'), welcome);
  };

  const handleReset = () => {
    cancelPendingReply();
    setFocusedGameId(activeGameId);
    setSession({});
    setPickerOpen(false);
    setPickerSearch('');
    const welcome = buildWelcomeReply(activeGameId, lang);
    seenMsgIdsRef.current.clear();
    msgSeqRef.current += 1;
    setMessages([
      {
        id: `welcome_${Date.now()}_${msgSeqRef.current}`,
        sender: 'bot',
        text: welcome.text,
        reply: welcome,
      },
    ]);
  };

  const panelInitial = reduced
    ? { opacity: 1, x: 0, y: 0 }
    : isDesktop
      ? { opacity: 0, x: 36, y: 0 }
      : { opacity: 0, x: 0, y: 48 };

  const panelExit = reduced
    ? { opacity: 0, transition: { duration: 0 } }
    : isDesktop
      ? { opacity: 0, x: 24, y: 0, transition: { duration: 0.16, ease: 'easeIn' as const } }
      : { opacity: 0, x: 0, y: 24, transition: { duration: 0.16, ease: 'easeIn' as const } };

  const panelTransition = reduced
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 380, damping: 32 };

  const enablePickerLayout = !reduced && filteredGames.length <= 24;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="rule-chatbot-backdrop"
          initial={{ opacity: reduced ? 1 : 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0 : 0.15 }}
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-end sm:justify-end bg-black/60 backdrop-blur-[2px] p-0 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            key="rule-chatbot-panel"
            initial={panelInitial}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={panelExit}
            transition={panelTransition}
            className="relative w-full sm:w-[430px] h-[88dvh] sm:h-[650px] max-h-[94dvh] rounded-t-3xl sm:rounded-2xl bg-[#0E121B] border border-white/15 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-[#141A26] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <motion.div
                  animate={isTyping && !reduced ? { scale: [1, 1.09, 1] } : { scale: 1 }}
                  transition={
                    isTyping && !reduced
                      ? { duration: 0.85, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.15 }
                  }
                  className="w-8 h-8 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/45 flex items-center justify-center shrink-0"
                >
                  <Bot className="w-4 h-4 text-[#00C2FF]" />
                </motion.div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-display text-sm font-black text-white truncate">
                      {t('Guide Bot', '平台助手')}
                    </h2>
                    <span className="px-1.5 py-0.5 rounded bg-[#10D98B]/18 border border-[#10D98B]/40 font-mono text-[9px] font-black text-[#10D98B] shrink-0">
                      {t(`INSTANT · ${allGames.length} GAMES`, `秒答 · ${allGames.length}款`)}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9CA3AF] truncate">
                    {t('Platform tutorials & all game rules · Offline', '全平台使用教程 + 游戏规则 · 零流量秒回')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleReset}
                  title={t('Restart conversation', '重新开始对话')}
                  aria-label={t('Restart conversation', '重新开始对话')}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/12 text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t('Close guide bot', '关闭平台助手')}
                  className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 text-white flex items-center justify-center cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 min-h-0 overflow-y-auto arcade-scrollbar px-3 py-3 space-y-3">
              {messages.map((msg, msgIdx) => {
                const skipEntrance = reduced || seenMsgIdsRef.current.has(msg.id);

                if (msg.sender === 'user') {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={skipEntrance ? false : { opacity: 0, x: 16, y: 4 }}
                      animate={{ opacity: 1, x: 0, y: 0 }}
                      transition={
                        reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 30 }
                      }
                      className="flex justify-end"
                    >
                      <div className="max-w-[84%] rounded-2xl rounded-br-sm bg-[#00C2FF] text-[#08131B] px-3 py-2 text-xs font-extrabold leading-snug shadow">
                        {msg.text}
                      </div>
                    </motion.div>
                  );
                }

                const reply = msg.reply;
                const isLatestBotMsg = msgIdx === messages.length - 1;

                return (
                  <motion.div
                    key={msg.id}
                    initial={skipEntrance ? false : 'hidden'}
                    animate="visible"
                    variants={BOT_REPLY_VARIANTS}
                    className="space-y-2"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-6 h-6 rounded-lg bg-[#1A2233] border border-white/12 flex items-center justify-center shrink-0 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#00C2FF]" />
                      </div>
                      <div className="flex-1 min-w-0 rounded-2xl rounded-tl-sm bg-[#161D2B] border border-white/10 px-3 py-2.5 space-y-2 shadow">
                        {reply?.title && (
                          <motion.div
                            variants={BOT_BLOCK_VARIANTS}
                            className="flex flex-wrap items-center justify-between gap-1.5"
                          >
                            <span className="font-display text-xs sm:text-[13px] font-black text-white">
                              {reply.title}
                            </span>
                            {reply.metaBadges && reply.metaBadges.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1">
                                {reply.metaBadges.map((b, bi) => (
                                  <span
                                    key={bi}
                                    className="px-1.5 py-0.5 rounded font-mono text-[9px] font-black"
                                    style={
                                      b.colorHex
                                        ? {
                                            backgroundColor: `${b.colorHex}26`,
                                            color: b.colorHex,
                                            border: `1px solid ${b.colorHex}66`,
                                          }
                                        : {
                                            backgroundColor: 'rgba(255,255,255,0.08)',
                                            color: '#CBD5E1',
                                          }
                                    }
                                  >
                                    {b.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}

                        <motion.p
                          variants={BOT_BLOCK_VARIANTS}
                          className="text-xs text-[#E5E7EB] leading-relaxed"
                        >
                          {msg.text}
                        </motion.p>

                        {reply?.bullets && reply.bullets.length > 0 && (
                          <motion.ol
                            variants={BOT_BLOCK_VARIANTS}
                            className="space-y-1.5 pt-1.5 border-t border-white/10"
                          >
                            {reply.bullets.map((line, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-2 text-[11.5px] text-[#D1D5DB] leading-snug"
                              >
                                <span className="font-mono text-[10px] font-black text-[#FFB800] mt-0.5 shrink-0">
                                  {String(idx + 1).padStart(2, '0')}.
                                </span>
                                <span className="flex-1">{line}</span>
                              </li>
                            ))}
                          </motion.ol>
                        )}

                        {reply?.suggestedGames && reply.suggestedGames.length > 0 && (
                          <motion.div
                            variants={SUGGESTED_LIST_VARIANTS}
                            className="pt-1.5 border-t border-white/10 grid grid-cols-1 gap-1.5"
                          >
                            {reply.suggestedGames.map((g) => (
                              <motion.button
                                key={g.id}
                                type="button"
                                variants={SUGGESTED_CARD_VARIANTS}
                                whileTap={reduced ? undefined : { scale: 0.98 }}
                                onClick={() => handlePickGame(g)}
                                className="w-full px-2.5 py-1.5 rounded-xl bg-[#0F1420] hover:bg-[#1E273A] border border-white/10 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: g.accentHex }}
                                  />
                                  <span className="text-xs font-extrabold text-white truncate">
                                    {g.name}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono text-[#9CA3AF] shrink-0">
                                  {g.genreLabel} · {g.playerModeLabel}
                                </span>
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Preset Clickable Option Cards directly beneath the latest bot reply */}
                    {isLatestBotMsg && reply?.choices && reply.choices.length > 0 && (
                      <motion.div
                        variants={CHOICES_GRID_VARIANTS}
                        className="pl-8 grid grid-cols-2 gap-1.5"
                      >
                        {reply.choices.map((choice) => {
                          if (choice.action === 'select-game') {
                            return (
                              <motion.button
                                key={choice.id}
                                type="button"
                                variants={CHOICE_ITEM_VARIANTS}
                                whileTap={reduced ? undefined : { scale: 0.97 }}
                                onClick={() => handleSelectChoice(choice)}
                                className={`col-span-2 group px-3 py-2.5 rounded-xl bg-[#10D98B] hover:bg-[#34E8A3] text-[#052E16] text-left flex items-center justify-between gap-2 cursor-pointer transition-colors shadow-[0_6px_18px_rgba(16,217,139,0.28)]${
                                  !skipEntrance ? ' guide-select-pulse' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="font-display text-xs font-black leading-tight truncate">
                                      {choice.label}
                                    </div>
                                    {choice.sublabel && (
                                      <div className="text-[10px] font-bold text-[#052E16]/80 leading-tight truncate mt-0.5">
                                        {choice.sublabel}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-[#052E16] shrink-0 transition-transform group-hover:translate-x-0.5" />
                              </motion.button>
                            );
                          }

                          const secondaryChoices = reply.choices!.filter((c) => c.action !== 'select-game');
                          const isFullWidth =
                            choice.action === 'menu' ||
                            choice.id.startsWith('current_') ||
                            (secondaryChoices.length % 2 === 1 &&
                              choice.id === secondaryChoices[secondaryChoices.length - 1]?.id);
                          const accent = choice.accentHex ?? '#00C2FF';
                          return (
                            <motion.button
                              key={choice.id}
                              type="button"
                              variants={CHOICE_ITEM_VARIANTS}
                              whileTap={reduced ? undefined : { scale: 0.97 }}
                              onClick={() => handleSelectChoice(choice)}
                              className={`${
                                isFullWidth ? 'col-span-2' : 'col-span-1'
                              } group px-2.5 py-2 rounded-xl bg-[#131926] hover:bg-[#1B2438] border border-white/12 hover:border-white/25 text-left flex items-center justify-between gap-1.5 cursor-pointer transition-colors`}
                              style={{
                                borderLeftWidth: '3px',
                                borderLeftColor: accent,
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-[11.5px] font-extrabold text-white leading-tight truncate">
                                  {choice.label}
                                </div>
                                {choice.sublabel && (
                                  <div className="text-[10px] text-[#9CA3AF] leading-tight truncate mt-0.5">
                                    {choice.sublabel}
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-[#6B7280] group-hover:text-white shrink-0 transition-colors" />
                            </motion.button>
                          );
                        })}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}

              {/* Typing Indicator */}
              <AnimatePresence>
                {isTyping && !reduced && (
                  <motion.div
                    key="guide-bot-typing"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14, ease: 'easeOut' }}
                    aria-live="polite"
                    aria-label={t('Guide Bot is typing', '平台助手正在输入')}
                    className="flex items-start gap-2"
                  >
                    <div className="w-6 h-6 rounded-lg bg-[#1A2233] border border-white/12 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#00C2FF]" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-[#161D2B] border border-white/10 px-3.5 py-2.5 shadow inline-flex items-center gap-1.5">
                      {[0, 1, 2].map((dotIdx) => (
                        <motion.span
                          key={dotIdx}
                          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                          transition={{
                            duration: 0.65,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: dotIdx * 0.14,
                          }}
                          className="w-1.5 h-1.5 rounded-full bg-[#00C2FF]"
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={listEndRef} />
            </div>

            {/* 200-Game Picker Popover (opens when tapping All Games) */}
            <AnimatePresence>
              {pickerOpen && (
                <motion.div
                  key="guide-bot-picker"
                  initial={reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  transition={{ duration: reduced ? 0 : 0.16, ease: 'easeOut' }}
                  className="absolute left-3 right-3 bottom-[96px] z-30 rounded-xl bg-[#121826] border border-white/15 shadow-2xl overflow-hidden"
                >
                  <div className="p-2 border-b border-white/10 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-[#9CA3AF] shrink-0" />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder={t(
                        `Search any of ${allGames.length} games...`,
                        `搜索全部 ${allGames.length} 款游戏...`
                      )}
                      className="w-full bg-transparent text-xs text-white placeholder-[#6B7280] focus:outline-none"
                      autoFocus
                    />
                    {pickerSearch ? (
                      <button
                        type="button"
                        onClick={() => setPickerSearch('')}
                        aria-label={t('Clear search', '清除搜索')}
                        className="text-[#9CA3AF] hover:text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPickerOpen(false)}
                        aria-label={t('Close game picker', '关闭游戏列表')}
                        className="text-[#9CA3AF] hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="max-h-60 overflow-y-auto arcade-scrollbar p-1.5 space-y-1">
                    {filteredGames.map((g, idx) => (
                      <motion.button
                        key={g.id}
                        type="button"
                        layout={enablePickerLayout ? 'position' : false}
                        initial={reduced || idx >= 10 ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={
                          reduced || idx >= 10
                            ? { duration: 0 }
                            : { duration: 0.14, delay: idx * 0.02, ease: 'easeOut' }
                        }
                        whileTap={reduced ? undefined : { scale: 0.98 }}
                        onClick={() => handlePickGame(g)}
                        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 text-left cursor-pointer transition-colors ${
                          focusedGameId === g.id
                            ? 'bg-[#00C2FF]/15 border border-[#00C2FF]/40'
                            : 'hover:bg-white/8'
                        }`}
                      >
                        <span className="text-xs font-bold text-white truncate">{g.name}</span>
                        <span className="text-[10px] font-mono text-[#9CA3AF] shrink-0">
                          {g.genreLabel} · {g.playerModeLabel}
                        </span>
                      </motion.button>
                    ))}
                    {filteredGames.length === 0 && (
                      <div className="py-4 text-center text-xs text-[#9CA3AF]">
                        {t('No matching games found', '未找到匹配的游戏')}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bottom Shortcut Buttons (no background bar) */}
            <div className="px-3 pt-1.5 pb-1.5 flex items-center gap-1.5 shrink-0">
              <motion.button
                type="button"
                whileTap={reduced ? undefined : { scale: 0.96 }}
                onClick={handleGoMainMenu}
                className="h-7 px-2.5 rounded-lg bg-[#1A2233] hover:bg-[#243047] border border-white/12 text-[11px] font-bold text-white inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <Home className="w-3 h-3 text-[#00C2FF]" />
                <span>{t('Main Menu', '主菜单')}</span>
              </motion.button>
              <motion.button
                type="button"
                whileTap={reduced ? undefined : { scale: 0.96 }}
                onClick={() => {
                  setPickerOpen((prev) => !prev);
                  setPickerSearch('');
                }}
                className="h-7 px-2.5 rounded-lg bg-[#1A2233] hover:bg-[#243047] border border-white/12 text-[11px] font-bold text-[#FFD166] inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <Search className="w-3 h-3" />
                <span>{t(`All ${allGames.length} Games`, `全部 ${allGames.length} 款`)}</span>
              </motion.button>
            </div>

            {/* Free-Text Input Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitQuestion(inputValue);
              }}
              className="px-3 pb-3 pt-1.5 bg-[#101520] flex items-center gap-2 shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={t(
                  'Or type any question / game name...',
                  '或直接输入任意问题 / 游戏名...'
                )}
                className="flex-1 h-10 px-3 rounded-xl bg-[#181F2E] border border-white/12 focus:border-[#00C2FF] text-xs text-white placeholder-[#6B7280] focus:outline-none transition-colors"
              />
              <motion.button
                type="submit"
                disabled={!inputValue.trim()}
                whileTap={reduced || !inputValue.trim() ? undefined : { scale: 0.94 }}
                aria-label={t('Send question', '发送问题')}
                className="h-10 px-3.5 rounded-xl bg-[#00C2FF] hover:bg-[#33CEFF] disabled:opacity-40 disabled:cursor-not-allowed text-[#08131B] font-display font-black text-xs inline-flex items-center gap-1 cursor-pointer transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function RuleChatbotFloatingButton({
  activeGameId = null,
  isOpen: controlledOpen,
  onOpen,
  onClose,
}: {
  activeGameId?: GameId | null;
  isOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const { t } = useLanguage();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpen = () => {
    if (onOpen) onOpen();
    if (!isControlled) setInternalOpen(true);
  };

  const handleClose = () => {
    if (onClose) onClose();
    if (!isControlled) setInternalOpen(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.72, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 22, delay: 0.42 }}
        className="fixed bottom-4 right-4 z-50"
      >
        <button
          type="button"
          onClick={handleOpen}
          aria-label={t('Open Guide Bot', '打开平台助手')}
          title={t('Guide Bot', '平台助手')}
          className="w-12 h-12 rounded-full bg-[#0E1624]/95 hover:bg-[#142238] border border-[#00C2FF]/60 text-white shadow-[0_8px_24px_rgba(0,194,255,0.28)] backdrop-blur-md inline-flex items-center justify-center cursor-pointer hover:scale-105 hover:brightness-110 active:scale-95 transition-all"
        >
          <Bot className="w-5 h-5 text-[#00C2FF]" />
        </button>
      </motion.div>

      <RuleChatbotDrawer
        isOpen={open}
        onClose={handleClose}
        activeGameId={activeGameId}
      />
    </>
  );
}
