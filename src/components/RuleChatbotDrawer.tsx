import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  ChevronRight,
  Home,
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
}

export function RuleChatbotDrawer({
  isOpen,
  onClose,
  activeGameId = null,
}: RuleChatbotDrawerProps) {
  const { lang, t } = useLanguage();
  const [focusedGameId, setFocusedGameId] = useState<GameId | null>(activeGameId);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const welcome = buildWelcomeReply(activeGameId, lang);
    return [{ id: 'welcome_0', sender: 'bot', text: welcome.text, reply: welcome }];
  });
  const [inputValue, setInputValue] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevLangRef = useRef(lang);
  const prevActiveGameRef = useRef<GameId | null>(activeGameId);

  useEffect(() => {
    const gameChanged = prevActiveGameRef.current !== activeGameId;
    const langChanged = prevLangRef.current !== lang;
    if (gameChanged || langChanged) {
      prevActiveGameRef.current = activeGameId;
      prevLangRef.current = lang;
      if (gameChanged) setFocusedGameId(activeGameId);
      const nextFocus = gameChanged ? activeGameId : focusedGameId;
      const welcome = buildWelcomeReply(nextFocus, lang);
      setMessages([{ id: `welcome_${Date.now()}`, sender: 'bot', text: welcome.text, reply: welcome }]);
    }
  }, [activeGameId, lang, focusedGameId]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 40);
    return () => clearTimeout(timer);
  }, [messages, isOpen]);

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

  if (!isOpen) return null;

  const appendExchange = (userText: string, reply: RuleBotReply) => {
    if (reply.resolvedGameId) {
      setFocusedGameId(reply.resolvedGameId);
    }
    const now = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: `u_${now}`, sender: 'user', text: userText },
      { id: `b_${now + 1}`, sender: 'bot', text: reply.text, reply },
    ]);
    setInputValue('');
    setPickerOpen(false);
  };

  const submitQuestion = (questionText: string, overrideGameId?: GameId | null) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    const contextId = overrideGameId !== undefined ? overrideGameId : focusedGameId;
    const reply = answerRuleQuestion(trimmed, lang, contextId);
    appendExchange(trimmed, reply);
  };

  const handleSelectChoice = (choice: RuleBotChoice) => {
    if (choice.action === 'open-picker') {
      setPickerOpen(true);
      setPickerSearch('');
      return;
    }
    const reply = resolveGuideChoice(choice, lang, focusedGameId);
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
    const welcome = buildWelcomeReply(activeGameId, lang);
    appendExchange(t('Main Menu', '返回主菜单'), welcome);
  };

  const handleReset = () => {
    setFocusedGameId(activeGameId);
    setPickerOpen(false);
    setPickerSearch('');
    const welcome = buildWelcomeReply(activeGameId, lang);
    setMessages([{ id: `welcome_${Date.now()}`, sender: 'bot', text: welcome.text, reply: welcome }]);
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-end sm:justify-end bg-black/60 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full sm:w-[430px] h-[88dvh] sm:h-[650px] max-h-[94dvh] rounded-t-3xl sm:rounded-2xl bg-[#0E121B] border border-white/15 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-3.5 py-2.5 bg-[#141A26] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#00C2FF]/15 border border-[#00C2FF]/45 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4 text-[#00C2FF]" />
            </div>
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
            if (msg.sender === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[84%] rounded-2xl rounded-br-sm bg-[#00C2FF] text-[#08131B] px-3 py-2 text-xs font-extrabold leading-snug shadow">
                    {msg.text}
                  </div>
                </div>
              );
            }

            const reply = msg.reply;
            const isLatestBotMsg = msgIdx === messages.length - 1;

            return (
              <div key={msg.id} className="space-y-2">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#1A2233] border border-white/12 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#00C2FF]" />
                  </div>
                  <div className="flex-1 min-w-0 rounded-2xl rounded-tl-sm bg-[#161D2B] border border-white/10 px-3 py-2.5 space-y-2 shadow">
                    {reply?.title && (
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
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
                      </div>
                    )}

                    <p className="text-xs text-[#E5E7EB] leading-relaxed">{msg.text}</p>

                    {reply?.bullets && reply.bullets.length > 0 && (
                      <ol className="space-y-1.5 pt-1.5 border-t border-white/10">
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
                      </ol>
                    )}

                    {reply?.suggestedGames && reply.suggestedGames.length > 0 && (
                      <div className="pt-1.5 border-t border-white/10 grid grid-cols-1 gap-1.5">
                        {reply.suggestedGames.map((g) => (
                          <button
                            key={g.id}
                            type="button"
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
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Preset Clickable Option Cards directly beneath the latest bot reply */}
                {isLatestBotMsg && reply?.choices && reply.choices.length > 0 && (
                  <div className="pl-8 grid grid-cols-2 gap-1.5">
                    {reply.choices.map((choice) => {
                      const isFullWidth =
                        choice.action === 'menu' ||
                        choice.id.startsWith('current_') ||
                        (reply.choices!.length % 2 === 1 &&
                          choice.id === reply.choices![reply.choices!.length - 1].id);
                      const accent = choice.accentHex ?? '#00C2FF';
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          onClick={() => handleSelectChoice(choice)}
                          className={`${
                            isFullWidth ? 'col-span-2' : 'col-span-1'
                          } group px-2.5 py-2 rounded-xl bg-[#131926] hover:bg-[#1B2438] border border-white/12 hover:border-white/25 text-left flex items-center justify-between gap-1.5 cursor-pointer active:scale-[0.98] transition-all`}
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
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={listEndRef} />
        </div>

        {/* 200-Game Picker Popover (opens when tapping All Games) */}
        {pickerOpen && (
          <div className="absolute left-3 right-3 bottom-[96px] z-30 rounded-xl bg-[#121826] border border-white/15 shadow-2xl overflow-hidden">
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
              {filteredGames.map((g) => (
                <button
                  key={g.id}
                  type="button"
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
                </button>
              ))}
              {filteredGames.length === 0 && (
                <div className="py-4 text-center text-xs text-[#9CA3AF]">
                  {t('No matching games found', '未找到匹配的游戏')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bottom Shortcut Buttons (no background bar) */}
        <div className="px-3 pt-1.5 pb-1.5 flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleGoMainMenu}
            className="h-7 px-2.5 rounded-lg bg-[#1A2233] hover:bg-[#243047] border border-white/12 text-[11px] font-bold text-white inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Home className="w-3 h-3 text-[#00C2FF]" />
            <span>{t('Main Menu', '主菜单')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPickerOpen((prev) => !prev);
              setPickerSearch('');
            }}
            className="h-7 px-2.5 rounded-lg bg-[#1A2233] hover:bg-[#243047] border border-white/12 text-[11px] font-bold text-[#FFD166] inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Search className="w-3 h-3" />
            <span>{t(`All ${allGames.length} Games`, `全部 ${allGames.length} 款`)}</span>
          </button>
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
          <button
            type="submit"
            disabled={!inputValue.trim()}
            aria-label={t('Send question', '发送问题')}
            className="h-10 px-3.5 rounded-xl bg-[#00C2FF] hover:bg-[#33CEFF] disabled:opacity-40 disabled:cursor-not-allowed text-[#08131B] font-display font-black text-xs inline-flex items-center gap-1 cursor-pointer active:scale-95 transition-all shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
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
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t('Open Guide Bot', '打开平台助手')}
        title={t('Guide Bot', '平台助手')}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-[#0E1624]/95 hover:bg-[#142238] border border-[#00C2FF]/60 text-white shadow-[0_8px_24px_rgba(0,194,255,0.28)] backdrop-blur-md inline-flex items-center justify-center cursor-pointer hover:scale-105 hover:brightness-110 active:scale-95 transition-all"
      >
        <Bot className="w-5 h-5 text-[#00C2FF]" />
      </button>

      <RuleChatbotDrawer
        isOpen={open}
        onClose={handleClose}
        activeGameId={activeGameId}
      />
    </>
  );
}
