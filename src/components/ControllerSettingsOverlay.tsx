import { Move, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export type ButtonLayoutMode = 'vertical' | 'angled' | 'horizontal';

export interface ControllerPrefs {
  stickOffsetX: number;
  stickOffsetY: number;
  stickScale: number;
  buttonsOffsetX: number;
  buttonsOffsetY: number;
  buttonsScale: number;
  buttonLayout: ButtonLayoutMode;
  buttonGap: number;
  swapAB: boolean;
  floatingStick: boolean;
  deadzone: number;
  stickRadius: number;
}

export const DEFAULT_CONTROLLER_PREFS: ControllerPrefs = {
  stickOffsetX: 0,
  stickOffsetY: 0,
  stickScale: 1,
  buttonsOffsetX: 0,
  buttonsOffsetY: 0,
  buttonsScale: 1,
  buttonLayout: 'vertical',
  buttonGap: 12,
  swapAB: false,
  floatingStick: false,
  deadzone: 0.08,
  stickRadius: 54,
};

const STORAGE_KEY = 'joinstick_controller_prefs_v1';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function clampControllerPrefs(raw: Partial<ControllerPrefs>): ControllerPrefs {
  const layout: ButtonLayoutMode =
    raw.buttonLayout === 'vertical' ||
    raw.buttonLayout === 'angled' ||
    raw.buttonLayout === 'horizontal'
      ? raw.buttonLayout
      : DEFAULT_CONTROLLER_PREFS.buttonLayout;

  return {
    stickOffsetX: Math.round(
      clamp(
        typeof raw.stickOffsetX === 'number' ? raw.stickOffsetX : DEFAULT_CONTROLLER_PREFS.stickOffsetX,
        -24,
        110
      )
    ),
    stickOffsetY: Math.round(
      clamp(
        typeof raw.stickOffsetY === 'number' ? raw.stickOffsetY : DEFAULT_CONTROLLER_PREFS.stickOffsetY,
        -44,
        44
      )
    ),
    stickScale: Number(
      clamp(
        typeof raw.stickScale === 'number' ? raw.stickScale : DEFAULT_CONTROLLER_PREFS.stickScale,
        0.8,
        1.25
      ).toFixed(2)
    ),
    buttonsOffsetX: Math.round(
      clamp(
        typeof raw.buttonsOffsetX === 'number'
          ? raw.buttonsOffsetX
          : DEFAULT_CONTROLLER_PREFS.buttonsOffsetX,
        -110,
        24
      )
    ),
    buttonsOffsetY: Math.round(
      clamp(
        typeof raw.buttonsOffsetY === 'number'
          ? raw.buttonsOffsetY
          : DEFAULT_CONTROLLER_PREFS.buttonsOffsetY,
        -44,
        44
      )
    ),
    buttonsScale: Number(
      clamp(
        typeof raw.buttonsScale === 'number'
          ? raw.buttonsScale
          : DEFAULT_CONTROLLER_PREFS.buttonsScale,
        0.8,
        1.25
      ).toFixed(2)
    ),
    buttonLayout: layout,
    buttonGap: Math.round(
      clamp(
        typeof raw.buttonGap === 'number' ? raw.buttonGap : DEFAULT_CONTROLLER_PREFS.buttonGap,
        4,
        28
      )
    ),
    swapAB: typeof raw.swapAB === 'boolean' ? raw.swapAB : DEFAULT_CONTROLLER_PREFS.swapAB,
    floatingStick:
      typeof raw.floatingStick === 'boolean'
        ? raw.floatingStick
        : DEFAULT_CONTROLLER_PREFS.floatingStick,
    deadzone: Number(
      clamp(
        typeof raw.deadzone === 'number' ? raw.deadzone : DEFAULT_CONTROLLER_PREFS.deadzone,
        0.04,
        0.22
      ).toFixed(2)
    ),
    stickRadius: Math.round(
      clamp(
        typeof raw.stickRadius === 'number' ? raw.stickRadius : DEFAULT_CONTROLLER_PREFS.stickRadius,
        38,
        68
      )
    ),
  };
}

export function loadControllerPrefs(): ControllerPrefs {
  if (typeof window === 'undefined') return DEFAULT_CONTROLLER_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONTROLLER_PREFS;
    const parsed = JSON.parse(raw) as Partial<ControllerPrefs>;
    return clampControllerPrefs(parsed);
  } catch {
    return DEFAULT_CONTROLLER_PREFS;
  }
}

export function saveControllerPrefs(prefs: ControllerPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clampControllerPrefs(prefs)));
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

interface ControllerSettingsOverlayProps {
  open: boolean;
  prefs: ControllerPrefs;
  onChange: (next: ControllerPrefs) => void;
  onReset: () => void;
  onEnterDragMode?: () => void;
  onClose: () => void;
  accentHex: string;
  actionALabel: string;
  actionBLabel: string;
  actionAHex: string;
  actionBHex: string;
}

export function ControllerSettingsOverlay({
  open,
  prefs,
  onChange,
  onReset,
  onEnterDragMode,
  onClose,
  accentHex,
  actionALabel,
  actionBLabel,
  actionAHex,
  actionBHex,
}: ControllerSettingsOverlayProps) {
  const { t } = useLanguage();
  if (!open) return null;

  const update = (patch: Partial<ControllerPrefs>) => {
    onChange(clampControllerPrefs({ ...prefs, ...patch }));
  };

  const firstIsB = prefs.swapAB;
  const topBtnColor = firstIsB ? actionBHex : actionAHex;
  const bottomBtnColor = firstIsB ? actionAHex : actionBHex;
  const topBtnLetter = firstIsB ? 'B' : 'A';
  const bottomBtnLetter = firstIsB ? 'A' : 'B';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Controller Calibration & Layout Settings', '手柄校准与布局设置')}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute inset-0 z-[60] bg-[#0B0D12]/94 backdrop-blur-md p-3 sm:p-4 flex flex-col justify-between gap-2.5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 border-b border-[#242934] pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#1E232D] border border-[#2F3747] flex items-center justify-center text-[#00C2FF] shrink-0">
            <SlidersHorizontal className="w-4 h-4" />
          </div>
          <div className="min-w-0 leading-tight">
            <h2 className="font-display font-extrabold text-sm sm:text-base text-white truncate">
              {t('Controller Settings & Calibration', '手柄位置校准与按键设置')}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#9CA3AF] truncate">
              {t(
                'Saved locally on your phone for every match',
                '自动保存在本机，所有游戏局内实时生效'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {onEnterDragMode && (
            <button
              type="button"
              onClick={onEnterDragMode}
              className="tactile-btn h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg bg-[#00C2FF] hover:bg-[#29CEFF] text-[#0B1219] font-display font-extrabold text-xs inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Move className="w-3.5 h-3.5" />
              <span>{t('Drag on Pad', '直接拖动位置')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onReset}
            className="h-8 sm:h-9 px-2.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-bold text-[#D1D5DB] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('Reset', '重置')}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close settings', '关闭设置')}
            className="h-8 sm:h-9 px-3 rounded-lg bg-[#FF4D2E] hover:bg-[#FF6145] text-xs font-extrabold text-white inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" />
            <span>{t('Done', '完成')}</span>
          </button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto arcade-scrollbar pr-1 space-y-3">
        {/* Live Mini Controller Placement Preview */}
        <div className="rounded-xl bg-[#101217] border border-[#242934] px-3 py-2 flex items-center justify-between gap-3">
          <div className="text-[11px] text-[#9CA3AF] leading-snug">
            <div className="font-bold text-white">
              {t('Live Layout Preview', '实时布局预览')}
            </div>
            <div>
              {prefs.floatingStick
                ? t('Floating Stick', '随指浮动摇杆')
                : t('Fixed Stick', '固定位置摇杆')}{' '}
              · {t('Deadzone', '死区')} {Math.round(prefs.deadzone * 100)}%
            </div>
          </div>

          <div className="relative w-44 sm:w-52 h-16 rounded-lg bg-[#161922] border border-[#2A303D] overflow-hidden shrink-0">
            {/* Mini Joystick */}
            <div
              className="absolute top-1/2 left-4 rounded-full border-2 flex items-center justify-center transition-transform duration-75"
              style={{
                width: `${Math.round(28 * prefs.stickScale)}px`,
                height: `${Math.round(28 * prefs.stickScale)}px`,
                borderColor: accentHex,
                transform: `translate(${Math.round(prefs.stickOffsetX * 0.28)}px, calc(-50% + ${Math.round(prefs.stickOffsetY * 0.25)}px))`,
              }}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: accentHex }}
              />
            </div>

            {/* Mini A/B Buttons */}
            <div
              className={`absolute top-1/2 right-4 flex items-center justify-center transition-transform duration-75 ${
                prefs.buttonLayout === 'horizontal' ? 'flex-row' : 'flex-col'
              }`}
              style={{
                gap: `${Math.max(2, Math.round(prefs.buttonGap * 0.25))}px`,
                transform: `translate(${Math.round(prefs.buttonsOffsetX * 0.28)}px, calc(-50% + ${Math.round(prefs.buttonsOffsetY * 0.25)}px))`,
              }}
            >
              <div
                className={`rounded-full font-mono text-[8px] font-black text-white flex items-center justify-center ${
                  prefs.buttonLayout === 'angled' ? '-translate-x-1.5' : ''
                }`}
                style={{
                  width: `${Math.round(16 * prefs.buttonsScale)}px`,
                  height: `${Math.round(16 * prefs.buttonsScale)}px`,
                  backgroundColor: topBtnColor,
                }}
              >
                {topBtnLetter}
              </div>
              <div
                className={`rounded-full font-mono text-[8px] font-black text-white flex items-center justify-center ${
                  prefs.buttonLayout === 'angled' ? 'translate-x-1.5' : ''
                }`}
                style={{
                  width: `${Math.round(14 * prefs.buttonsScale)}px`,
                  height: `${Math.round(14 * prefs.buttonsScale)}px`,
                  backgroundColor: bottomBtnColor,
                }}
              >
                {bottomBtnLetter}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* LEFT: Joystick Calibration & Positioning */}
          <div className="rounded-xl bg-[#1A1E26] border border-[#2A303D] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-xs sm:text-sm text-white">
                {t('Joystick Position & Calibration', '摇杆位置与灵敏度校准')}
              </h3>
              <button
                type="button"
                onClick={() => update({ floatingStick: !prefs.floatingStick })}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  prefs.floatingStick
                    ? 'bg-[#00C2FF]/20 border-[#00C2FF] text-[#00C2FF]'
                    : 'bg-[#101217] border-[#2F3747] text-[#D1D5DB]'
                }`}
              >
                {prefs.floatingStick ? t('Mode: Floating', '模式：随指浮动') : t('Mode: Fixed', '模式：固定中心')}
              </button>
            </div>

            {/* Stick X */}
            <label className="block space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A5AEBD]">{t('Horizontal Position (Left ↔ Center)', '左右位置（靠左 ↔ 靠中）')}</span>
                <span className="font-mono text-white tabular-nums">{prefs.stickOffsetX}px</span>
              </div>
              <input
                type="range"
                min={-24}
                max={110}
                step={2}
                value={prefs.stickOffsetX}
                onChange={(e) => update({ stickOffsetX: Number(e.target.value) })}
                className="w-full h-2 rounded-lg bg-[#101217] accent-[#00C2FF] cursor-pointer"
              />
            </label>

            {/* Stick Y */}
            <label className="block space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A5AEBD]">{t('Vertical Position (Up ↔ Down)', '上下高度（偏上 ↔ 偏下）')}</span>
                <span className="font-mono text-white tabular-nums">{prefs.stickOffsetY}px</span>
              </div>
              <input
                type="range"
                min={-44}
                max={44}
                step={2}
                value={prefs.stickOffsetY}
                onChange={(e) => update({ stickOffsetY: Number(e.target.value) })}
                className="w-full h-2 rounded-lg bg-[#101217] accent-[#00C2FF] cursor-pointer"
              />
            </label>

            {/* Stick Size */}
            <label className="block space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A5AEBD]">{t('Joystick Size', '摇杆大小')}</span>
                <span className="font-mono text-white tabular-nums">
                  {Math.round(prefs.stickScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.8}
                max={1.25}
                step={0.05}
                value={prefs.stickScale}
                onChange={(e) => update({ stickScale: Number(e.target.value) })}
                className="w-full h-2 rounded-lg bg-[#101217] accent-[#00C2FF] cursor-pointer"
              />
            </label>

            {/* Calibration: Deadzone & Sensitivity Throw */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-[#262C38]">
              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF]">{t('Center Deadzone', '中心防误触死区')}</span>
                  <span className="font-mono text-white tabular-nums">
                    {Math.round(prefs.deadzone * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.04}
                  max={0.22}
                  step={0.02}
                  value={prefs.deadzone}
                  onChange={(e) => update({ deadzone: Number(e.target.value) })}
                  className="w-full h-2 rounded-lg bg-[#101217] accent-[#FFB800] cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF]">{t('Throw Range', '摇杆行程')}</span>
                  <span className="font-mono text-white tabular-nums">{prefs.stickRadius}px</span>
                </div>
                <input
                  type="range"
                  min={38}
                  max={68}
                  step={2}
                  value={prefs.stickRadius}
                  onChange={(e) => update({ stickRadius: Number(e.target.value) })}
                  className="w-full h-2 rounded-lg bg-[#101217] accent-[#FFB800] cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* RIGHT: A / B Button Layout & Positioning */}
          <div className="rounded-xl bg-[#1A1E26] border border-[#2A303D] p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-xs sm:text-sm text-white">
                {t('A / B Button Positioning', 'A / B 按键位置与排列')}
              </h3>
              <button
                type="button"
                onClick={() => update({ swapAB: !prefs.swapAB })}
                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer whitespace-nowrap ${
                  prefs.swapAB
                    ? 'bg-[#FF4D2E]/20 border-[#FF4D2E] text-[#FF9B8A]'
                    : 'bg-[#101217] border-[#2F3747] text-[#D1D5DB]'
                }`}
              >
                {prefs.swapAB
                  ? t(`Swapped (${actionBLabel}/${actionALabel})`, '已对调 A / B')
                  : t(`Order: ${actionALabel} / ${actionBLabel}`, '默认 A / B')}
              </button>
            </div>

            {/* Arrangement Mode */}
            <div
              role="radiogroup"
              aria-label={t('Button layout arrangement', '按键排列方式')}
              className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#101217] border border-[#262C38]"
            >
              {(
                [
                  { id: 'vertical', en: 'Up / Down', zh: '上下排列' },
                  { id: 'angled', en: 'Angled', zh: '斜向梯形' },
                  { id: 'horizontal', en: 'Left / Right', zh: '左右并排' },
                ] as const
              ).map((opt) => {
                const active = prefs.buttonLayout === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update({ buttonLayout: opt.id })}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[#FF4D2E] text-white'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {t(opt.en, opt.zh)}
                  </button>
                );
              })}
            </div>

            {/* Buttons X */}
            <label className="block space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A5AEBD]">{t('Horizontal Position (Center ↔ Right)', '左右位置（靠中 ↔ 靠右）')}</span>
                <span className="font-mono text-white tabular-nums">{prefs.buttonsOffsetX}px</span>
              </div>
              <input
                type="range"
                min={-110}
                max={24}
                step={2}
                value={prefs.buttonsOffsetX}
                onChange={(e) => update({ buttonsOffsetX: Number(e.target.value) })}
                className="w-full h-2 rounded-lg bg-[#101217] accent-[#FF4D2E] cursor-pointer"
              />
            </label>

            {/* Buttons Y */}
            <label className="block space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#A5AEBD]">{t('Vertical Position (Up ↔ Down)', '上下高度（偏上 ↔ 偏下）')}</span>
                <span className="font-mono text-white tabular-nums">{prefs.buttonsOffsetY}px</span>
              </div>
              <input
                type="range"
                min={-44}
                max={44}
                step={2}
                value={prefs.buttonsOffsetY}
                onChange={(e) => update({ buttonsOffsetY: Number(e.target.value) })}
                className="w-full h-2 rounded-lg bg-[#101217] accent-[#FF4D2E] cursor-pointer"
              />
            </label>

            {/* Button Size & Spacing */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-[#262C38]">
              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF]">{t('Button Size', '按键大小')}</span>
                  <span className="font-mono text-white tabular-nums">
                    {Math.round(prefs.buttonsScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={1.25}
                  step={0.05}
                  value={prefs.buttonsScale}
                  onChange={(e) => update({ buttonsScale: Number(e.target.value) })}
                  className="w-full h-2 rounded-lg bg-[#101217] accent-[#FF4D2E] cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF]">{t('Button Gap', '按键间距')}</span>
                  <span className="font-mono text-white tabular-nums">{prefs.buttonGap}px</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={28}
                  step={2}
                  value={prefs.buttonGap}
                  onChange={(e) => update({ buttonGap: Number(e.target.value) })}
                  className="w-full h-2 rounded-lg bg-[#101217] accent-[#FF4D2E] cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
