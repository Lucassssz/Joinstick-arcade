import { useEffect, useState } from 'react';
import { GAME_CATALOG } from '../shared/games';
import { GAME_PAD_PROFILES, getPadTutorialGuide } from '../shared/padProfiles';
import type { GameId } from '../shared/types';
import { getLocalizedGameMeta, useLanguage } from '../lib/i18n';

interface PhoneControllerDemoProps {
  gameId: GameId;
  accentHex: string;
  activeRuleText?: string;
  activeRuleIndex?: number;
  compact?: boolean;
}

/**
 * Renders a tiny animated landscape smartphone mockup right inside the briefing screen,
 * demonstrating the exact 3-second looping gesture needed for the selected game
 * and emphasizing the control matching the active rule.
 */
export function PhoneControllerDemo({
  gameId,
  accentHex,
  activeRuleText = '',
  activeRuleIndex = 0,
  compact = false,
}: PhoneControllerDemoProps) {
  const { lang, t } = useLanguage();
  const rawMeta = GAME_CATALOG.find((g) => g.id === gameId) ?? GAME_CATALOG[0];
  const meta = getLocalizedGameMeta(rawMeta, lang);
  const padProfile = GAME_PAD_PROFILES[gameId];
  const padGuide = getPadTutorialGuide(gameId, lang);

  const lowerRule = activeRuleText.toLowerCase();
  const schema = meta.controllerSchema;
  const preferUpSwipe =
    padProfile.trackpadMode === 'flick' ||
    /\b(jump|swipe up|leap|launch|flick|climb|shoot up)\b|跳|上滑|发射|爬/i.test(lowerRule);

  // Detect if the active rule specifically teaches Button A or Button B so we spotlight it cleanly
  const emphasizeB =
    lowerRule.includes(schema.actionB.label.toLowerCase()) ||
    /\(b\)|button b|press b|b 键|按 b/i.test(lowerRule) ||
    activeRuleIndex === 2;
  const emphasizeA =
    !emphasizeB &&
    (lowerRule.includes(schema.actionA.label.toLowerCase()) ||
      /\(a\)|button a|press a|a 键|按 a/i.test(lowerRule) ||
      activeRuleIndex === 1);

  // 3.0-second continuous loop phase (0..1)
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setPhase(0.55);
      return;
    }

    const LOOP_MS = 3000;
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      if (typeof document === 'undefined' || !document.hidden) {
        setPhase(((now - start) % LOOP_MS) / LOOP_MS);
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [gameId]);

  const padMode = padProfile.pad;

  // 3-Second Choreography Timeline:
  // 0.00 - 0.42: Left Zone Gesture (drag stick / tap arrow / swipe pad / pick card)
  // 0.42 - 0.74: Tap Primary Action A button (e.g. Red Dash / Jump / Fire / Play)
  // 0.74 - 1.00: Secondary Action B tap
  const isLeftPhase = phase < 0.42;
  const isAPhase = phase >= 0.42 && phase < 0.74;
  const isBPhase = phase >= 0.74;

  const leftLocal = isLeftPhase ? phase / 0.42 : 0;
  const aLocal = isAPhase ? (phase - 0.42) / 0.32 : 0;
  const bLocal = isBPhase ? (phase - 0.74) / 0.26 : 0;

  let stickDx = 0;
  let stickDy = 0;
  if (isLeftPhase) {
    if (preferUpSwipe) {
      stickDx = 0;
      stickDy = -Math.sin(leftLocal * Math.PI) * 14;
    } else {
      const ang = leftLocal * Math.PI * 1.5;
      stickDx = Math.cos(ang) * 12;
      stickDy = Math.sin(ang) * 10;
    }
  }

  const arrowActiveDir: 'up' | 'right' | 'none' = isLeftPhase
    ? preferUpSwipe
      ? 'up'
      : leftLocal < 0.5
      ? 'right'
      : 'up'
    : 'none';

  const aPressed = isAPhase && aLocal > 0.22 && aLocal < 0.78;
  const bPressed = isBPhase && bLocal > 0.22 && bLocal < 0.78;

  let fingerLeftPct = 25;
  let fingerTopPct = 52;
  if (isLeftPhase) {
    if (padMode === 'card') {
      fingerLeftPct = 34;
      fingerTopPct = 62 - Math.sin(leftLocal * Math.PI) * 18;
    } else {
      fingerLeftPct = 24 + stickDx * 0.9;
      fingerTopPct = 54 + stickDy * 1.1;
    }
  } else if (isAPhase) {
    fingerLeftPct = padMode === 'card' ? 79 : 80;
    fingerTopPct = padMode === 'card' ? 56 : 44;
  } else {
    fingerLeftPct = padMode === 'card' ? 79 : 66;
    fingerTopPct = padMode === 'card' ? 56 : 67;
  }

  const stepCaption = isLeftPhase
    ? padMode === 'card'
      ? t('1. Tap card to pick', '1. 点选卡牌')
      : preferUpSwipe
      ? t('1. Swipe up to act', '1. 向上滑动操控')
      : padMode === 'arrows'
      ? t('1. Tap direction pad', '1. 点按方向键')
      : padMode === 'trackpad'
      ? t('1. Glide thumb on pad', '1. 滑动触控板')
      : t(`1. Drag stick (${schema.joystickLabel})`, `1. 拖动摇杆 (${schema.joystickLabel})`)
    : isAPhase
    ? t(`2. Tap ${schema.actionA.label}`, `2. 点按 ${schema.actionA.label}`)
    : t(`3. Tap ${schema.actionB.label}`, `3. 点按 ${schema.actionB.label}`);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Miniature Landscape Smartphone Frame */}
      <div
        className={`relative w-full rounded-[22px] bg-[#0B0E14] border-[3px] border-[#30394D] shadow-xl overflow-hidden ${
          compact ? 'max-w-[240px] p-1.5' : 'max-w-[300px] p-2'
        }`}
      >
        <div
          aria-hidden="true"
          className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-7 rounded-full bg-[#242C3D]"
        />

        {/* Phone Inner Screen */}
        <div
          className={`relative w-full rounded-[14px] bg-[#141924] border border-[#242C3D] overflow-hidden select-none ${
            compact ? 'h-[102px]' : 'h-[138px]'
          }`}
        >
          <div className="flex items-center justify-between px-2.5 pt-1.5 text-[9px] font-mono text-[#9CA3AF]">
            <span className="truncate font-bold text-white">{meta.name}</span>
            <span className="tabular-nums text-[#00C2FF]">3.0s</span>
          </div>

          <div className="relative h-[calc(100%-22px)] px-3 pb-2 flex items-center justify-between gap-2">
            {/* LEFT CONTROL ZONE */}
            <div className="w-[46%] h-full flex items-center justify-center relative">
              {padMode === 'analog' && (
                <div
                  className={`relative w-16 h-16 rounded-full bg-[#1C2333] flex items-center justify-center transition-colors ${
                    isLeftPhase
                      ? 'border-2 border-[#00C2FF]'
                      : 'border border-[#2F3A52]'
                  }`}
                >
                  {preferUpSwipe && isLeftPhase && (
                    <div
                      aria-hidden="true"
                      className="absolute -top-2 text-[10px] font-black"
                      style={{ color: accentHex }}
                    >
                      ▲
                    </div>
                  )}
                  <div
                    className="w-7 h-7 rounded-full border-2 border-white/85 shadow-md"
                    style={{
                      backgroundColor: accentHex,
                      transform: `translate(${stickDx}px, ${stickDy}px)`,
                    }}
                  />
                </div>
              )}

              {padMode === 'arrows' && (
                <div className="grid grid-cols-3 gap-1 w-16 h-16">
                  <div />
                  <div
                    className={`rounded flex items-center justify-center text-[10px] font-black border ${
                      arrowActiveDir === 'up'
                        ? 'bg-[#FFB800] text-[#14120B] border-white'
                        : 'bg-[#1C2333] text-[#CBD5E1] border-[#2F3A52]'
                    }`}
                  >
                    ▲
                  </div>
                  <div />
                  <div className="rounded bg-[#1C2333] text-[#CBD5E1] border border-[#2F3A52] flex items-center justify-center text-[10px]">
                    ◀
                  </div>
                  <div className="rounded bg-[#10141E]" />
                  <div
                    className={`rounded flex items-center justify-center text-[10px] font-black border ${
                      arrowActiveDir === 'right'
                        ? 'bg-[#FFB800] text-[#14120B] border-white'
                        : 'bg-[#1C2333] text-[#CBD5E1] border-[#2F3A52]'
                    }`}
                  >
                    ▶
                  </div>
                  <div />
                  <div className="rounded bg-[#1C2333] text-[#CBD5E1] border border-[#2F3A52] flex items-center justify-center text-[10px]">
                    ▼
                  </div>
                  <div />
                </div>
              )}

              {padMode === 'trackpad' && (
                <div
                  className={`relative w-20 h-16 rounded-xl bg-[#1A2130] border flex items-center justify-center overflow-hidden ${
                    isLeftPhase ? 'border-[#00C2FF]' : 'border-dashed border-[#3B4863]'
                  }`}
                >
                  <div
                    className="w-2.5 h-8 rounded-full opacity-65"
                    style={{
                      background: `linear-gradient(to top, transparent, ${accentHex})`,
                      transform: preferUpSwipe
                        ? `translateY(${stickDy * 0.4}px)`
                        : `rotate(90deg) translateY(${-stickDx * 0.4}px)`,
                    }}
                  />
                  <span className="absolute bottom-1 text-[8px] font-mono text-[#94A3B8]">
                    {preferUpSwipe ? t('SWIPE', '上滑') : t('GLIDE', '滑动')}
                  </span>
                </div>
              )}

              {padMode === 'card' && (
                <div className="flex items-end justify-center gap-1 pt-2">
                  <div className="w-6 h-9 rounded bg-[#242E42] border border-white/20 -rotate-6" />
                  <div
                    className="w-7 h-10 rounded border-2 border-[#FACC15] flex items-center justify-center text-[9px] font-black text-white shadow-md transition-transform"
                    style={{
                      backgroundColor: accentHex,
                      transform: isLeftPhase
                        ? `translateY(${-Math.sin(leftLocal * Math.PI) * 10}px)`
                        : 'translateY(-3px)',
                    }}
                  >
                    A♠
                  </div>
                  <div className="w-6 h-9 rounded bg-[#242E42] border border-white/20 rotate-6" />
                </div>
              )}
            </div>

            {/* RIGHT ACTION BUTTONS ZONE */}
            <div className="w-[46%] h-full flex items-center justify-end gap-2 pr-1">
              {padMode === 'card' ? (
                <div
                  className="px-3 py-2 rounded-lg font-display font-extrabold text-[10px] tracking-wide border border-white/30 shadow transition-transform"
                  style={{
                    backgroundColor: schema.actionA.colorHex,
                    color: schema.actionA.textColor,
                    transform: aPressed || bPressed ? 'translateY(2px) scale(0.94)' : 'translateY(0)',
                  }}
                >
                  {schema.actionA.label.slice(0, 6)}
                </div>
              ) : (
                <div className="relative w-20 h-16">
                  {/* Secondary B Button */}
                  <div
                    className={`absolute bottom-0 left-0 w-8 h-8 rounded-full border flex items-center justify-center text-[8px] font-extrabold shadow transition-transform ${
                      emphasizeB || bPressed ? 'ring-2 ring-white/80 border-white' : 'border-white/30'
                    }`}
                    style={{
                      backgroundColor: schema.actionB.colorHex,
                      color: schema.actionB.textColor,
                      transform: bPressed ? 'translateY(2px) scale(0.9)' : 'scale(1)',
                    }}
                  >
                    B
                  </div>

                  {/* Primary Action A Button */}
                  <div
                    className={`absolute top-0 right-0 w-11 h-11 rounded-full border-2 flex flex-col items-center justify-center shadow-lg transition-transform ${
                      emphasizeA || aPressed ? 'ring-2 ring-white border-white' : 'border-white/50'
                    }`}
                    style={{
                      backgroundColor: schema.actionA.colorHex,
                      color: schema.actionA.textColor,
                      transform: aPressed ? 'translateY(2px) scale(0.9)' : 'scale(1)',
                    }}
                  >
                    <span className="text-[10px] font-black leading-none">A</span>
                    <span className="text-[7px] font-bold leading-none mt-0.5 max-w-[36px] truncate">
                      {schema.actionA.label}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Animated Translucent Touch Finger + Tap Ripple */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${fingerLeftPct}%`,
              top: `${fingerTopPct}%`,
            }}
          >
            {(aPressed || bPressed || (isLeftPhase && padMode === 'card')) && (
              <span
                className="absolute inset-0 -m-2 rounded-full border-2 opacity-75 animate-ping"
                style={{ borderColor: aPressed ? schema.actionA.colorHex : '#FFFFFF' }}
              />
            )}
            <span
              className={`block rounded-full border-2 border-white shadow-[0_2px_10px_rgba(0,0,0,0.65)] transition-transform ${
                aPressed || bPressed ? 'w-4 h-4 scale-90 bg-white/95' : 'w-5 h-5 bg-white/80'
              }`}
            />
          </div>

          {/* Looping 3.0-Second Bottom Progress Bar */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-[#222A3A]">
            <div
              className="h-full origin-left"
              style={{
                width: `${(phase * 100).toFixed(1)}%`,
                backgroundColor: isAPhase ? schema.actionA.colorHex : accentHex,
              }}
            />
          </div>
        </div>
      </div>

      {/* Live Unboxed 1-Line Gesture Caption */}
      <div className="mt-2.5 text-center space-y-0.5 max-w-[300px]">
        <div className="text-xs font-bold text-white truncate">{stepCaption}</div>
        {!compact && (
          <div className="text-[11px] text-[#9CA3AF] leading-snug">
            {padGuide.padTitle} · {padGuide.shortTutorial}
          </div>
        )}
      </div>
    </div>
  );
}
