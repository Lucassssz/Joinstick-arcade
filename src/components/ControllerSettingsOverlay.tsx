import {
  Gamepad2,
  Hand,
  Layers,
  Move,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  ArcadePadMode,
  CardSortMode,
  CardViewMode,
  PadMode,
  TrackpadMode,
} from '../shared/padProfiles';
import { useLanguage } from '../lib/i18n';

export type ButtonLayoutMode = 'vertical' | 'angled' | 'horizontal';

export interface ControllerPrefs {
  // === 4-Pad Auto-Match & Global Preferences ===
  autoSelectPadPerGame: boolean;
  perGamePadOverrides: Partial<Record<string, ArcadePadMode>>;
  padMode: ArcadePadMode;
  autoTapRateHz: number;
  arrowsStrictFourWay: boolean | null;
  trackpadModeOverride: TrackpadMode | null;
  trackpadHandedness: 'right' | 'left';
  trackpadTapForAOverride: boolean | null;
  trackpadSensitivity: number;
  bluetoothEnabled: boolean;

  // === Pad 4: Private Card & Tabletop Pad Preferences ===
  cardViewMode: CardViewMode;
  cardSortMode: CardSortMode;
  cardPrivacyShield: boolean;
  cardActionsSide: 'right' | 'left';

  // === Pad 1: Pro Analog Calibration ===
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
  stickSensitivity: number;

  // === Pocket Mode Integrated HUD ===
  pocketHudOpacity: number;
}

export const DEFAULT_CONTROLLER_PREFS: ControllerPrefs = {
  autoSelectPadPerGame: true,
  perGamePadOverrides: {},
  padMode: 'analog',
  autoTapRateHz: 12,
  arrowsStrictFourWay: null,
  trackpadModeOverride: null,
  trackpadHandedness: 'right',
  trackpadTapForAOverride: null,
  trackpadSensitivity: 1.2,
  bluetoothEnabled: true,

  cardViewMode: 'auto',
  cardSortMode: 'server',
  cardPrivacyShield: false,
  cardActionsSide: 'right',

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
  deadzone: 0.1,
  stickRadius: 58,
  stickSensitivity: 0.86,
  pocketHudOpacity: 0.62,
};

const STORAGE_KEY = 'joinstick_controller_prefs_v1';

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function sanitizeOverrides(
  raw: unknown
): Partial<Record<string, ArcadePadMode>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<string, ArcadePadMode>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === 'analog' || v === 'arrows' || v === 'trackpad') {
      out[k] = v;
    }
  }
  return out;
}

export function clampControllerPrefs(raw: Partial<ControllerPrefs>): ControllerPrefs {
  const layout: ButtonLayoutMode =
    raw.buttonLayout === 'vertical' ||
    raw.buttonLayout === 'angled' ||
    raw.buttonLayout === 'horizontal'
      ? raw.buttonLayout
      : DEFAULT_CONTROLLER_PREFS.buttonLayout;

  const padMode: ArcadePadMode =
    raw.padMode === 'analog' || raw.padMode === 'arrows' || raw.padMode === 'trackpad'
      ? raw.padMode
      : DEFAULT_CONTROLLER_PREFS.padMode;

  const trackpadModeOverride: TrackpadMode | null =
    raw.trackpadModeOverride === 'glide' || raw.trackpadModeOverride === 'flick'
      ? raw.trackpadModeOverride
      : null;

  const cardViewMode: CardViewMode =
    raw.cardViewMode === 'auto' || raw.cardViewMode === 'fan' || raw.cardViewMode === 'grid'
      ? raw.cardViewMode
      : DEFAULT_CONTROLLER_PREFS.cardViewMode;

  const cardSortMode: CardSortMode =
    raw.cardSortMode === 'server' || raw.cardSortMode === 'playable' || raw.cardSortMode === 'rank'
      ? raw.cardSortMode
      : DEFAULT_CONTROLLER_PREFS.cardSortMode;

  return {
    autoSelectPadPerGame:
      typeof raw.autoSelectPadPerGame === 'boolean'
        ? raw.autoSelectPadPerGame
        : DEFAULT_CONTROLLER_PREFS.autoSelectPadPerGame,
    perGamePadOverrides: sanitizeOverrides(raw.perGamePadOverrides),
    padMode,
    autoTapRateHz: Math.round(
      clamp(
        typeof raw.autoTapRateHz === 'number'
          ? raw.autoTapRateHz
          : DEFAULT_CONTROLLER_PREFS.autoTapRateHz,
        6,
        18
      )
    ),
    arrowsStrictFourWay:
      typeof raw.arrowsStrictFourWay === 'boolean' ? raw.arrowsStrictFourWay : null,
    trackpadModeOverride,
    trackpadHandedness: raw.trackpadHandedness === 'left' ? 'left' : 'right',
    trackpadTapForAOverride:
      typeof raw.trackpadTapForAOverride === 'boolean' ? raw.trackpadTapForAOverride : null,
    trackpadSensitivity: Number(
      clamp(
        typeof raw.trackpadSensitivity === 'number'
          ? raw.trackpadSensitivity
          : DEFAULT_CONTROLLER_PREFS.trackpadSensitivity,
        0.7,
        2.2
      ).toFixed(2)
    ),
    bluetoothEnabled:
      typeof raw.bluetoothEnabled === 'boolean'
        ? raw.bluetoothEnabled
        : DEFAULT_CONTROLLER_PREFS.bluetoothEnabled,

    cardViewMode,
    cardSortMode,
    cardPrivacyShield:
      typeof raw.cardPrivacyShield === 'boolean'
        ? raw.cardPrivacyShield
        : DEFAULT_CONTROLLER_PREFS.cardPrivacyShield,
    cardActionsSide: raw.cardActionsSide === 'left' ? 'left' : 'right',

    stickOffsetX: Math.round(
      clamp(
        typeof raw.stickOffsetX === 'number'
          ? raw.stickOffsetX
          : DEFAULT_CONTROLLER_PREFS.stickOffsetX,
        -24,
        110
      )
    ),
    stickOffsetY: Math.round(
      clamp(
        typeof raw.stickOffsetY === 'number'
          ? raw.stickOffsetY
          : DEFAULT_CONTROLLER_PREFS.stickOffsetY,
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
        typeof raw.stickRadius === 'number'
          ? raw.stickRadius
          : DEFAULT_CONTROLLER_PREFS.stickRadius,
        38,
        68
      )
    ),
    stickSensitivity: Number(
      clamp(
        typeof raw.stickSensitivity === 'number'
          ? raw.stickSensitivity
          : DEFAULT_CONTROLLER_PREFS.stickSensitivity,
        0.65,
        1.15
      ).toFixed(2)
    ),
    pocketHudOpacity: Number(
      clamp(
        typeof raw.pocketHudOpacity === 'number'
          ? raw.pocketHudOpacity
          : DEFAULT_CONTROLLER_PREFS.pocketHudOpacity,
        0.3,
        0.95
      ).toFixed(2)
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
  activePadMode?: PadMode;
  recommendedPadMode?: PadMode;
  connectedGamepadName?: string | null;
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
  activePadMode = 'analog',
  recommendedPadMode,
  connectedGamepadName,
}: ControllerSettingsOverlayProps) {
  const { t } = useLanguage();
  if (!open) return null;

  const update = (patch: Partial<ControllerPrefs>) => {
    onChange(clampControllerPrefs({ ...prefs, ...patch }));
  };

  const overrideCount = Object.keys(prefs.perGamePadOverrides || {}).length;
  const firstIsB = prefs.swapAB;
  const topBtnColor = firstIsB ? actionBHex : actionAHex;
  const bottomBtnColor = firstIsB ? actionAHex : actionBHex;
  const topBtnLetter = firstIsB ? 'B' : 'A';
  const bottomBtnLetter = firstIsB ? 'A' : 'B';

  const padName = (mode: PadMode) => {
    switch (mode) {
      case 'analog':
        return t('Pad 1 · Pro Stick', '1号 · 360° 摇杆');
      case 'arrows':
        return t('Pad 2 · Easy Arrows', '2号 · 简易大箭头');
      case 'trackpad':
        return t('Pad 3 · Swipe Pad', '3号 · 触控滑板');
      case 'card':
        return t('Pad 4 · Card Table', '4号 · 扑克/桌面手牌');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('Controller & 4-Pad Settings', '四合一全能手柄校准与自动匹配设置')}
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
              {t('4-Pad Controller Settings', '四合一智能手柄设置')}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#9CA3AF] truncate">
              {t(
                'Auto-matched for every game · Saved locally on your phone',
                '按 150 款游戏智能匹配最佳手柄 · 自动保存于本机'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {onEnterDragMode && activePadMode === 'analog' && (
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
        {/* TOP STRIP: Auto-Match + Hardware Gamepad Status */}
        <div className="rounded-xl bg-[#101217] border border-[#242934] p-3 grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Sparkles className="w-3.5 h-3.5 text-[#FFB800]" />
                <span>{t('Smart Auto-Match Pad Per Game', '按游戏自动匹配最佳手柄')}</span>
              </div>
              <button
                type="button"
                onClick={() => update({ autoSelectPadPerGame: !prefs.autoSelectPadPerGame })}
                className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border cursor-pointer whitespace-nowrap transition-colors ${
                  prefs.autoSelectPadPerGame
                    ? 'bg-[#10D98B]/20 border-[#10D98B] text-[#10D98B]'
                    : 'bg-[#1A1E26] border-[#2F3747] text-[#9CA3AF]'
                }`}
              >
                {prefs.autoSelectPadPerGame ? t('Auto-Match ON', '智能匹配 开') : t('Locked Pad', '锁定单手柄')}
              </button>
            </div>
            <div className="text-[11px] text-[#9CA3AF] flex flex-wrap items-center gap-2">
              <span>
                {t('Active:', '当前生效：')}{' '}
                <strong className="text-white">{padName(activePadMode)}</strong>
              </span>
              {recommendedPadMode && recommendedPadMode !== activePadMode && (
                <span>
                  · {t('Suggested:', '官方推荐：')} {padName(recommendedPadMode)}
                </span>
              )}
              {overrideCount > 0 && (
                <button
                  type="button"
                  onClick={() => update({ perGamePadOverrides: {} })}
                  className="text-[#00C2FF] hover:underline font-semibold cursor-pointer"
                >
                  {t(`Clear ${overrideCount} custom picks`, `清除 ${overrideCount} 个单游戏自定义`)}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 md:border-l md:border-[#222834] md:pl-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <Gamepad2 className="w-3.5 h-3.5 text-[#00C2FF]" />
                <span>{t('Bluetooth / USB Controller', '蓝牙 / 有线实体手柄')}</span>
              </div>
              <div className="text-[10px] text-[#9CA3AF] truncate max-w-[240px]">
                {connectedGamepadName
                  ? `${t('Connected:', '已连接：')} ${connectedGamepadName}`
                  : t('Pair Xbox, PS, Switch or 8BitDo anytime', '随时连接 Xbox / PS / Switch / 八位堂手柄即插即玩')}
              </div>
            </div>
            <button
              type="button"
              onClick={() => update({ bluetoothEnabled: !prefs.bluetoothEnabled })}
              className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold border cursor-pointer whitespace-nowrap transition-colors ${
                prefs.bluetoothEnabled
                  ? 'bg-[#00C2FF]/20 border-[#00C2FF] text-[#00C2FF]'
                  : 'bg-[#1A1E26] border-[#2F3747] text-[#9CA3AF]'
              }`}
            >
              {prefs.bluetoothEnabled ? t('Enabled', '已启用') : t('Muted', '已禁用')}
            </button>
          </div>
        </div>

        {/* Fallback Universal Pad Picker (when Auto-Match is OFF or default preference) + Live Mini Preview */}
        <div className="rounded-xl bg-[#161922] border border-[#242934] px-3 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-white">
              {prefs.autoSelectPadPerGame
                ? t('Fallback Arcade Pad (for unmapped games)', '默认兜底手柄（用于未锁定模式）')
                : t('Locked Universal Pad (used for all arcade & board games)', '全局锁定手柄（所有动作/棋盘游戏固定使用）')}
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-[#101217] border border-[#262C38]">
              {(
                [
                  { id: 'analog', en: '1 · Pro Stick', zh: '1 · 摇杆' },
                  { id: 'arrows', en: '2 · Easy Arrows', zh: '2 · 大箭头' },
                  { id: 'trackpad', en: '3 · Swipe Pad', zh: '3 · 滑控' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update({ padMode: opt.id })}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer whitespace-nowrap transition-colors ${
                    prefs.padMode === opt.id
                      ? 'bg-[#FF4D2E] text-white'
                      : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {t(opt.en, opt.zh)}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-44 sm:w-52 h-16 rounded-lg bg-[#101217] border border-[#2A303D] overflow-hidden shrink-0">
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
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accentHex }} />
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

        {/* 2x2 Modular Grid for Pad 1, Pad 2, Pad 3, Pad 4 Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* PAD 1: Stick Position & Calibration */}
          <div className="rounded-xl bg-[#1A1E26] border border-[#2A303D] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display font-bold text-xs sm:text-sm text-white">
                {t('Pad 1 · Analog Stick Calibration', '1号手柄 · 摇杆校准')}
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
                {prefs.floatingStick ? t('Floating', '随指浮动') : t('Fixed Center', '固定中心')}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#A5AEBD]">{t('Stick X', '左右偏移')}</span>
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

              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#A5AEBD]">{t('Stick Y', '上下偏移')}</span>
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

              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF]">{t('Stick Size', '摇杆大小')}</span>
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

              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF]">{t('Deadzone', '中心死区')}</span>
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
                  <span className="text-[#9CA3AF]">{t('Stick Sensitivity', '摇杆灵敏度')}</span>
                  <span className="font-mono text-white tabular-nums">
                    {Math.round(prefs.stickSensitivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.65}
                  max={1.15}
                  step={0.02}
                  value={prefs.stickSensitivity}
                  onChange={(e) => update({ stickSensitivity: Number(e.target.value) })}
                  className="w-full h-2 rounded-lg bg-[#101217] accent-[#00C2FF] cursor-pointer"
                />
              </label>

              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF]">{t('Pocket HUD Opacity', '掌机透明按键浓度')}</span>
                  <span className="font-mono text-white tabular-nums">
                    {Math.round(prefs.pocketHudOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.3}
                  max={0.95}
                  step={0.05}
                  value={prefs.pocketHudOpacity}
                  onChange={(e) => update({ pocketHudOpacity: Number(e.target.value) })}
                  className="w-full h-2 rounded-lg bg-[#101217] accent-[#10D98B] cursor-pointer"
                />
              </label>
            </div>

            <div className="pt-1.5 border-t border-[#262C38] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-white">
                  {t('A / B Button Layout', 'A / B 按键布局')}
                </span>
                <button
                  type="button"
                  onClick={() => update({ swapAB: !prefs.swapAB })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer whitespace-nowrap ${
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
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#101217] border border-[#262C38]">
                {(
                  [
                    { id: 'vertical', en: 'Up / Down', zh: '上下' },
                    { id: 'angled', en: 'Angled', zh: '斜向' },
                    { id: 'horizontal', en: 'Left / Right', zh: '左右' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update({ buttonLayout: opt.id })}
                    className={`py-1 px-2 rounded text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                      prefs.buttonLayout === opt.id
                        ? 'bg-[#FF4D2E] text-white'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {t(opt.en, opt.zh)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
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

          {/* RIGHT COLUMN: Pad 2 + Pad 3 + Pad 4 */}
          <div className="space-y-3">
            {/* PAD 2: Easy Tap Arrows + Auto-Tap */}
            <div className="rounded-xl bg-[#1A1E26] border border-[#2A303D] p-3 space-y-2">
              <h3 className="font-display font-bold text-xs sm:text-sm text-white">
                {t('Pad 2 · Easy Tap Arrows & Auto-Tap', '2号手柄 · 大箭头与自动连点')}
              </h3>
              <div className="space-y-1">
                <span className="text-[10px] text-[#9CA3AF]">
                  {t('Arrow Turn Lock', '方向按键防斜角锁')}
                </span>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#101217] border border-[#262C38]">
                  {(
                    [
                      { val: null, en: 'Auto', zh: '随游戏' },
                      { val: true, en: 'Strict 4-Way', zh: '严格四向' },
                      { val: false, en: 'Allow Diag', zh: '允许斜向' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={String(opt.val)}
                      type="button"
                      onClick={() => update({ arrowsStrictFourWay: opt.val })}
                      className={`py-1 px-1.5 rounded text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                        prefs.arrowsStrictFourWay === opt.val
                          ? 'bg-[#10D98B] text-[#0A1913]'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {t(opt.en, opt.zh)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF]">{t('Auto-Tap / Turbo Speed', '自动连点频率')}</span>
                  <span className="font-mono text-[#FFB800] tabular-nums">{prefs.autoTapRateHz} Hz</span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={18}
                  step={1}
                  value={prefs.autoTapRateHz}
                  onChange={(e) => update({ autoTapRateHz: Number(e.target.value) })}
                  className="w-full h-2 rounded-lg bg-[#101217] accent-[#FFB800] cursor-pointer"
                />
              </label>
            </div>

            {/* PAD 3: Swipe Trackpad + Triggers */}
            <div className="rounded-xl bg-[#1A1E26] border border-[#2A303D] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-xs sm:text-sm text-white">
                  {t('Pad 3 · Swipe Trackpad', '3号手柄 · 触控滑板')}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      trackpadHandedness: prefs.trackpadHandedness === 'right' ? 'left' : 'right',
                    })
                  }
                  className="px-2 py-0.5 rounded bg-[#101217] border border-[#2F3747] text-[10px] font-bold text-[#D1D5DB] inline-flex items-center gap-1 cursor-pointer"
                >
                  <Hand className="w-3 h-3 text-[#00C2FF]" />
                  <span>
                    {prefs.trackpadHandedness === 'right'
                      ? t('Triggers Right', '扳机在右')
                      : t('Triggers Left', '扳机在左')}
                  </span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#101217] border border-[#262C38]">
                {(
                  [
                    { val: null, en: 'Auto', zh: '随游戏' },
                    { val: 'glide', en: 'Glide', zh: '丝滑追踪' },
                    { val: 'flick', en: '4-Way Swipe', zh: '四向滑步' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={String(opt.val)}
                    type="button"
                    onClick={() => update({ trackpadModeOverride: opt.val })}
                    className={`py-1 px-1.5 rounded text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                      prefs.trackpadModeOverride === opt.val
                        ? 'bg-[#00C2FF] text-[#0B1219]'
                        : 'text-[#9CA3AF] hover:text-white'
                    }`}
                  >
                    {t(opt.en, opt.zh)}
                  </button>
                ))}
              </div>
              <label className="block space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF]">{t('Swipe Sensitivity', '滑动灵敏度')}</span>
                  <span className="font-mono text-white tabular-nums">
                    {Math.round(prefs.trackpadSensitivity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.7}
                  max={2.2}
                  step={0.1}
                  value={prefs.trackpadSensitivity}
                  onChange={(e) => update({ trackpadSensitivity: Number(e.target.value) })}
                  className="w-full h-2 rounded-lg bg-[#101217] accent-[#00C2FF] cursor-pointer"
                />
              </label>
            </div>

            {/* PAD 4: Private Card & Tabletop Pad */}
            <div className="rounded-xl bg-[#1A1E26] border border-[#2A303D] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-xs sm:text-sm text-white flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#FFB800]" />
                  <span>{t('Pad 4 · Card & Tabletop Pad', '4号手柄 · 扑克/桌面手牌')}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => update({ cardPrivacyShield: !prefs.cardPrivacyShield })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border inline-flex items-center gap-1 cursor-pointer ${
                    prefs.cardPrivacyShield
                      ? 'bg-[#FFB800]/20 border-[#FFB800] text-[#FFB800]'
                      : 'bg-[#101217] border-[#2F3747] text-[#9CA3AF]'
                  }`}
                >
                  <ShieldCheck className="w-3 h-3" />
                  <span>{t('Peek Shield', '防偷窥盖牌')}</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#101217] border border-[#262C38]">
                  {(
                    [
                      { id: 'auto', en: 'Auto', zh: '自动' },
                      { id: 'fan', en: 'Fan', zh: '扇形' },
                      { id: 'grid', en: 'Grid', zh: '网格' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => update({ cardViewMode: opt.id })}
                      className={`py-1 px-1 rounded text-[10px] font-bold cursor-pointer whitespace-nowrap ${
                        prefs.cardViewMode === opt.id
                          ? 'bg-[#FFB800] text-[#14120B]'
                          : 'text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      {t(opt.en, opt.zh)}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    update({ cardActionsSide: prefs.cardActionsSide === 'right' ? 'left' : 'right' })
                  }
                  className="px-2 py-1 rounded-lg bg-[#101217] border border-[#262C38] text-[10px] font-bold text-[#D1D5DB] cursor-pointer"
                >
                  {prefs.cardActionsSide === 'right'
                    ? t('Actions: Right Side', '操作按钮：右侧')
                    : t('Actions: Left Side', '操作按钮：左侧')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
