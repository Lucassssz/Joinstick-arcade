import { useState, useEffect } from 'react';
import { GAME_CATALOG } from '../shared/games';
import { GameId } from '../shared/types';
import { getLocalizedGameMeta, useLanguage } from '../lib/i18n';
import { WatchAndPlayCardCanvas } from './WatchAndPlayCardCanvas';
import { PhoneControllerDemo } from './PhoneControllerDemo';

interface RuleAnimationCardProps {
  gameId: GameId;
  gameName: string;
  accentHex: string;
  rules: string[];
}

export function RuleAnimationCard({
  gameId,
  accentHex,
  rules,
}: RuleAnimationCardProps) {
  const { lang, t } = useLanguage();
  const rawMeta = GAME_CATALOG.find((g) => g.id === gameId) ?? GAME_CATALOG[0];
  const gameMeta = getLocalizedGameMeta(rawMeta, lang);
  const [activeRuleIdx, setActiveRuleIdx] = useState(0);
  const [pausedByHover, setPausedByHover] = useState(false);

  // Reset active rule index when game switches
  useEffect(() => {
    setActiveRuleIdx(0);
  }, [gameId]);

  const displayedRules = rules.slice(0, 4);

  // Smooth 2.5-second spotlight cycle across the rule list and real-engine animations
  useEffect(() => {
    if (displayedRules.length <= 1 || pausedByHover) return;
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    const timer = window.setInterval(() => {
      setActiveRuleIdx((prev) => (prev + 1) % displayedRules.length);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [displayedRules.length, gameId, pausedByHover]);

  const safeIdx = Math.min(activeRuleIdx, Math.max(0, displayedRules.length - 1));
  const activeRuleText = displayedRules[safeIdx] ?? '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
      {/* LEFT: Complete Single-Page List of Rules (Zero Scrolling) */}
      <div
        onMouseLeave={() => setPausedByHover(false)}
        className="lg:col-span-5 flex flex-col justify-between rounded-2xl bg-[#10131B] border border-[#252D3D] p-3.5"
      >
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              {t('Game Rules', '玩法规则列表')}
            </span>
            <span className="font-mono text-[11px] text-[#00C2FF] font-bold tabular-nums">
              {safeIdx + 1} / {Math.max(1, displayedRules.length)}
            </span>
          </div>

          <div className="space-y-1.5">
            {displayedRules.map((rule, idx) => {
              const isActive = idx === safeIdx;
              return (
                <button
                  key={`${gameId}-rule-${idx}`}
                  type="button"
                  onClick={() => {
                    setActiveRuleIdx(idx);
                    setPausedByHover(true);
                  }}
                  onMouseEnter={() => {
                    setActiveRuleIdx(idx);
                    setPausedByHover(true);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl border transition-colors flex items-start gap-2.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2FF] ${
                    isActive
                      ? 'bg-[#161E2E] border-[#00C2FF] text-white'
                      : 'bg-[#131722] border-[#222938] text-[#CBD5E1] hover:border-[#3A465E] hover:text-white'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded-md font-mono text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5 tabular-nums"
                    style={{
                      backgroundColor: isActive ? accentHex : '#1E2636',
                      color: isActive ? '#0B0E14' : '#94A3B8',
                    }}
                  >
                    {idx + 1}
                  </span>
                  <span className={`text-xs leading-snug ${isActive ? 'font-semibold text-white' : 'font-normal'}`}>
                    {rule}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Clean Unboxed Action Key Reference */}
        <div className="mt-3 pt-2.5 border-t border-[#202736] flex items-center justify-between gap-2 text-[11px] text-[#9CA3AF]">
          <span className="truncate">
            <strong style={{ color: gameMeta.controllerSchema.actionA.colorHex }}>
              A · {gameMeta.controllerSchema.actionA.label}
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span className="truncate">
            <strong style={{ color: gameMeta.controllerSchema.actionB.colorHex }}>
              B · {gameMeta.controllerSchema.actionB.label}
            </strong>
          </span>
        </div>
      </div>

      {/* RIGHT (Beside the Rules): Real-Engine 2s Rule Animation + 3-Second Phone Demo */}
      <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-stretch">
        {/* 1. Real In-Game 2-Second Rule Clip */}
        <div className="rounded-2xl bg-[#10131B] border border-[#252D3D] p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                {t('In-Game Rule Clip', '实机规则演示')}
              </span>
              <span
                className="font-mono text-[11px] font-bold tabular-nums"
                style={{ color: accentHex }}
              >
                {t(`Rule 0${safeIdx + 1} · 2s`, `规则 0${safeIdx + 1} · 2秒`)}
              </span>
            </div>

            <div className="rounded-xl overflow-hidden border border-[#242C3D] bg-[#0C0F16]">
              <WatchAndPlayCardCanvas
                gameId={gameId}
                category={gameMeta.category}
                accentHex={accentHex}
                ruleText={activeRuleText}
                ruleIndex={safeIdx}
                totalRules={displayedRules.length}
                actionALabel={gameMeta.controllerSchema.actionA.label}
                actionAColor={gameMeta.controllerSchema.actionA.colorHex}
                actionBLabel={gameMeta.controllerSchema.actionB.label}
                actionBColor={gameMeta.controllerSchema.actionB.colorHex}
                active
              />
            </div>
          </div>

          <p className="mt-2.5 text-xs font-medium text-[#E2E8F0] leading-snug line-clamp-2">
            {activeRuleText}
          </p>
        </div>

        {/* 2. Looping 3-Second Phone Controller Demo */}
        <div className="rounded-2xl bg-[#10131B] border border-[#252D3D] p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-white">
              {t('Phone Controls', '手机操控演示')}
            </span>
            <span className="font-mono text-[11px] text-[#00C2FF] font-semibold tabular-nums">
              {t('3s Loop', '3秒循环')}
            </span>
          </div>

          <div className="my-auto">
            <PhoneControllerDemo
              gameId={gameId}
              accentHex={accentHex}
              activeRuleText={activeRuleText}
              activeRuleIndex={safeIdx}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
