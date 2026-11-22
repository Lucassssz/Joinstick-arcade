import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Dices, Flame, RotateCcw, Sparkles, X } from 'lucide-react';
import {
  CHAOS_WHEEL_MUTATORS,
  getMutatorSpec,
  MUTATORS,
  type MutatorId,
} from '../shared/modifiers';
import { useLanguage } from '../lib/i18n';

interface ChaosWheelModalProps {
  open: boolean;
  activeMutator: MutatorId;
  spinSeq: number;
  remoteLocked: boolean;
  hostName?: string;
  onSpin: () => void;
  onSelectMutator: (id: MutatorId) => void;
  onClose: () => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDegFromTop: number) {
  const rad = ((angleDegFromTop - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function createSlicePath(
  cx: number,
  cy: number,
  r: number,
  startDegFromTop: number,
  endDegFromTop: number
) {
  const start = polarToCartesian(cx, cy, r, endDegFromTop);
  const end = polarToCartesian(cx, cy, r, startDegFromTop);
  const largeArc = endDegFromTop - startDegFromTop <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function ChaosWheelModal({
  open,
  activeMutator,
  spinSeq,
  remoteLocked,
  hostName,
  onSpin,
  onSelectMutator,
  onClose,
}: ChaosWheelModalProps) {
  const { lang, t } = useLanguage();
  const slices = CHAOS_WHEEL_MUTATORS;
  const sliceAngle = 360 / slices.length;

  const [wheelAngle, setWheelAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const prevSpinSeqRef = useRef(spinSeq);
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const idx = slices.findIndex((s) => s.id === activeMutator);
    const targetIdx = idx >= 0 ? idx : 0;
    const alignedMod = (360 - targetIdx * sliceAngle) % 360;

    if (spinSeq !== prevSpinSeqRef.current) {
      prevSpinSeqRef.current = spinSeq;
      setSpinning(true);
      setWheelAngle((prev) => {
        const currentFloor = Math.floor(prev / 360) * 360;
        let next = currentFloor + 1440 + alignedMod;
        if (next <= prev + 720) next += 360;
        return next;
      });
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
      spinTimerRef.current = setTimeout(() => {
        setSpinning(false);
      }, 2150);
    } else if (!spinning && idx >= 0) {
      setWheelAngle((prev) => {
        const currentFloor = Math.floor(prev / 360) * 360;
        return currentFloor + alignedMod;
      });
    }
  }, [spinSeq, activeMutator, sliceAngle, slices, spinning]);

  useEffect(() => {
    return () => {
      if (spinTimerRef.current) clearTimeout(spinTimerRef.current);
    };
  }, []);

  const currentSpec = useMemo(() => getMutatorSpec(activeMutator), [activeMutator]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[75] bg-[#0B0D12]/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ duration: 0.18 }}
            className="max-w-4xl w-full max-h-[92dvh] flex flex-col overflow-hidden rounded-3xl bg-[#1A1E26] border-2 border-[#2F3747] shadow-2xl"
          >
            {/* Header */}
            <div className="px-5 py-3.5 bg-[#151820] border-b border-[#262C38] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#FF4D2E]/15 border border-[#FF4D2E]/40 text-[#FF4D2E] flex items-center justify-center shrink-0">
                  <Dices className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-display text-lg sm:text-xl font-extrabold text-white truncate">
                    {t('Pre-Match Chaos Wheel', '赛前混沌规则轮盘')}
                  </h2>
                  <p className="text-xs text-[#9CA3AF] truncate">
                    {t(
                      'Spin a wild global rule that applies across every game until changed!',
                      '转动轮盘抽取全局狂欢规则，生效于接下来每一局游戏！'
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label={t('Close Chaos Wheel', '关闭轮盘')}
                className="h-9 w-9 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-[#D1D5DB] hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto arcade-scrollbar grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              {/* Left: SVG Wheel + Spin Controls */}
              <div className="lg:col-span-6 flex flex-col items-center">
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
                  {/* Top Pointer */}
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none">
                    <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-[#FFB800] drop-shadow-[0_3px_6px_rgba(0,0,0,0.65)]" />
                  </div>

                  {/* Outer Wheel Rim */}
                  <div
                    className="w-full h-full rounded-full p-2 bg-[#101217] border-4 border-[#2F3747] shadow-[0_12px_32px_rgba(0,0,0,0.55)] relative"
                    style={{
                      boxShadow: spinning
                        ? '0 0 36px rgba(255, 184, 0, 0.32), 0 12px 32px rgba(0,0,0,0.6)'
                        : `0 0 24px ${currentSpec.accentHex}33, 0 12px 32px rgba(0,0,0,0.55)`,
                    }}
                  >
                    <svg
                      viewBox="0 0 240 240"
                      className="w-full h-full"
                      style={{
                        transform: `rotate(${wheelAngle}deg)`,
                        transition: spinning
                          ? 'transform 2.1s cubic-bezier(0.14, 0.85, 0.18, 1)'
                          : 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    >
                      {slices.map((mut, i) => {
                        const start = i * sliceAngle - sliceAngle / 2;
                        const end = i * sliceAngle + sliceAngle / 2;
                        const midAngle = i * sliceAngle;
                        const labelPos = polarToCartesian(120, 120, 74, midAngle);
                        const isSelected = mut.id === activeMutator;
                        return (
                          <g key={mut.id}>
                            <path
                              d={createSlicePath(120, 120, 114, start, end)}
                              fill={mut.accentHex}
                              fillOpacity={isSelected ? 0.96 : 0.78}
                              stroke="#101217"
                              strokeWidth="3"
                            />
                            <text
                              x={labelPos.x}
                              y={labelPos.y}
                              fill="#0B1016"
                              fontSize="10.5"
                              fontWeight="900"
                              textAnchor="middle"
                              dominantBaseline="middle"
                              transform={`rotate(${midAngle}, ${labelPos.x}, ${labelPos.y})`}
                            >
                              {lang === 'zh' ? mut.shortTagZh : mut.shortTag}
                            </text>
                          </g>
                        );
                      })}
                      <circle cx="120" cy="120" r="24" fill="#151820" stroke="#F4F6FA" strokeWidth="3" />
                      <text
                        x="120"
                        y="121"
                        fill="#FFB800"
                        fontSize="11"
                        fontWeight="900"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {t('CHAOS', '混沌')}
                      </text>
                    </svg>
                  </div>
                </div>

                {/* Landed Rule Banner */}
                <div
                  className="mt-4 w-full rounded-2xl bg-[#101217] border-2 px-4 py-3 text-center transition-colors"
                  style={{ borderColor: `${currentSpec.accentHex}88` }}
                >
                  <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#9CA3AF]">
                    <Sparkles className="w-3.5 h-3.5" style={{ color: currentSpec.accentHex }} />
                    <span>{t('Active Room Rule', '当前全局规则')}</span>
                  </div>
                  <div
                    className="font-display text-lg font-extrabold mt-0.5"
                    style={{ color: currentSpec.accentHex }}
                  >
                    {lang === 'zh' ? currentSpec.nameZh : currentSpec.name}
                  </div>
                  <p className="text-xs text-[#D1D5DB] mt-0.5 leading-snug">
                    {lang === 'zh' ? currentSpec.descriptionZh : currentSpec.description}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2.5 w-full">
                  <button
                    type="button"
                    onClick={onSpin}
                    disabled={spinning}
                    className="tactile-btn flex-1 min-w-[160px] h-11 px-5 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] disabled:opacity-60 text-white font-display font-extrabold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Flame className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} />
                    <span>
                      {spinning
                        ? t('Spinning...', '轮盘飞转中...')
                        : t('Spin Chaos Wheel!', '转动混沌轮盘！')}
                    </span>
                  </button>

                  {activeMutator !== 'normal' && (
                    <button
                      type="button"
                      onClick={() => onSelectMutator('normal')}
                      className="h-11 px-4 rounded-xl bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('Classic', '恢复经典')}</span>
                    </button>
                  )}
                </div>

                {remoteLocked && hostName && (
                  <p className="mt-2 text-[11px] text-[#FFB800] text-center">
                    {t(
                      `Host ${hostName} can also press OK on Chaos Wheel using their phone remote.`,
                      `房主 ${hostName} 也可以直接用手机遥控器选中轮盘按 OK 抽奖！`
                    )}
                  </p>
                )}
              </div>

              {/* Right: All 6 Mutator Rule Cards */}
              <div className="lg:col-span-6 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] mb-1">
                  {t('All Mutators (Click to pick directly)', '全部规则（也可直接点选）')}
                </div>
                {MUTATORS.map((mut) => {
                  const selected = mut.id === activeMutator;
                  return (
                    <button
                      key={mut.id}
                      type="button"
                      onClick={() => onSelectMutator(mut.id)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-start justify-between gap-3 cursor-pointer ${
                        selected
                          ? 'bg-[#202633]'
                          : 'bg-[#151820] border-[#262C38] hover:border-[#3A4356]'
                      }`}
                      style={selected ? { borderColor: mut.accentHex } : undefined}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: mut.accentHex }}
                          />
                          <span className="font-display font-extrabold text-sm text-white">
                            {lang === 'zh' ? mut.nameZh : mut.name}
                          </span>
                          <span
                            className="font-mono text-[10px] font-black px-1.5 py-0.5 rounded bg-[#101217]"
                            style={{ color: mut.accentHex }}
                          >
                            {lang === 'zh' ? mut.shortTagZh : mut.shortTag}
                          </span>
                        </div>
                        <p className="text-xs text-[#A5AEBD] mt-1 leading-snug">
                          {lang === 'zh' ? mut.descriptionZh : mut.description}
                        </p>
                      </div>
                      {selected && (
                        <span
                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: mut.accentHex, color: '#0B1016' }}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-[#151820] border-t border-[#262C38] flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="tactile-btn h-10 px-6 rounded-xl bg-[#10D98B] hover:bg-[#22E89B] text-[#0A1913] font-display font-extrabold text-sm inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.6]" />
                <span>{t('Done', '确定')}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
