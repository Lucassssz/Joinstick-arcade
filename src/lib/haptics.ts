/**
 * Global Mobile Haptic & HD Rumble Tactile Feedback Service.
 *
 * Supports 3 user-selectable Haptic Intensity modes (`HapticMode`):
 * - `'default'`: Balanced W3C `navigator.vibrate()` pulses (32ms–85ms), single iOS Taptic
 *   switch tap on user gestures, and subtle WebAudio tactile fallback when hardware vibrate
 *   is unavailable.
 * - `'forceful'`: Maximum overdrive using high-torque multi-pulse `navigator.vibrate()` bursts
 *   (85ms–240ms) with `touchend`/`click` re-assertion, multi-burst iOS 18 Taptic switch pulses,
 *   and a co-firing compressed HD Rumble Speaker-Chassis Resonator (sub-bass + mechanical click).
 * - `'off'`: Completely disables all vibrations, Taptic switches, and tactile audio pulses.
 */

export type HapticMode = 'default' | 'forceful' | 'off';

export type HapticIntensity = 'light' | 'medium' | 'heavy';

export type HapticVisualPulse = 'none' | 'subtle' | 'light' | 'heavy';

export type HapticEventType =
  | 'turn-start'
  | 'turn-change'
  | 'action-required'
  | 'timer-warning'
  | 'host-alert'
  | 'round-transition'
  | 'phase-transition'
  | 'chaos-wheel'
  | 'frenzy-alert'
  | 'countdown'
  | 'go'
  | 'podium-reveal'
  | 'player-ready'
  | 'host-transfer'
  | 'impact-light'
  | 'impact-medium'
  | 'impact-heavy';

export type TactileToneProfile = 'turn' | 'tick' | 'alert' | 'warning' | 'fanfare' | 'thump';

export interface HapticPresetSpec {
  defaultPattern: number | number[];
  forcefulPattern: number | number[];
  intensity: HapticIntensity;
  visualPulse: Exclude<HapticVisualPulse, 'none'>;
  toneProfile: TactileToneProfile;
  defaultLabelEn: string;
  defaultLabelZh: string;
}

export interface HapticResult {
  vibrated: boolean;
  iosTaptic: boolean;
  audioThump: boolean;
  blockedByIframe: boolean;
  platform: 'ios' | 'android' | 'other';
  skippedByLock: boolean;
  mode: HapticMode;
  event?: HapticEventType;
}

export interface HapticNotification {
  event: HapticEventType;
  reason: string;
  intensity: HapticIntensity;
  visualPulse: Exclude<HapticVisualPulse, 'none'>;
  labelEn: string;
  labelZh: string;
  customLabel?: string;
  timestamp: number;
}

type HapticSubscriber = (notification: HapticNotification) => void;
type HapticModeSubscriber = (mode: HapticMode) => void;

const HAPTIC_MODE_STORAGE_KEY = 'joinstick_haptic_mode_v1';

const PRIORITY_BY_INTENSITY: Record<HapticIntensity, number> = {
  light: 1,
  medium: 2,
  heavy: 3,
};

export const HAPTIC_PRESETS: Record<HapticEventType, HapticPresetSpec> = {
  'turn-start': {
    defaultPattern: [36, 32, 58],
    forcefulPattern: [115, 45, 175],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'turn',
    defaultLabelEn: 'YOUR TURN!',
    defaultLabelZh: '轮到你了！',
  },
  'turn-change': {
    defaultPattern: 24,
    forcefulPattern: [80],
    intensity: 'light',
    visualPulse: 'subtle',
    toneProfile: 'tick',
    defaultLabelEn: 'Turn Changed',
    defaultLabelZh: '回合切换',
  },
  'action-required': {
    defaultPattern: [42, 30, 68],
    forcefulPattern: [110, 40, 130, 40, 175],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'alert',
    defaultLabelEn: 'ACTION REQUIRED!',
    defaultLabelZh: '请立即操作！',
  },
  'timer-warning': {
    defaultPattern: [45, 30, 45],
    forcefulPattern: [100, 35, 100, 35, 150],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'warning',
    defaultLabelEn: 'TIME RUNNING OUT!',
    defaultLabelZh: '倒计时警告！',
  },
  'host-alert': {
    defaultPattern: [34, 28, 52],
    forcefulPattern: [100, 40, 150],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'alert',
    defaultLabelEn: 'GAME ALERT',
    defaultLabelZh: '赛况提醒',
  },
  'round-transition': {
    defaultPattern: [36, 32, 56],
    forcefulPattern: [105, 45, 160],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'turn',
    defaultLabelEn: 'NEW ROUND',
    defaultLabelZh: '新一轮开始',
  },
  'phase-transition': {
    defaultPattern: [28, 28, 44],
    forcefulPattern: [90, 40, 125],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'tick',
    defaultLabelEn: 'SCREEN UPDATED',
    defaultLabelZh: '大屏状态切换',
  },
  'chaos-wheel': {
    defaultPattern: [32, 26, 54],
    forcefulPattern: [85, 35, 105, 35, 155],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'alert',
    defaultLabelEn: 'CHAOS WHEEL!',
    defaultLabelZh: '混沌转盘！',
  },
  'frenzy-alert': {
    defaultPattern: [65, 35, 95, 35, 130],
    forcefulPattern: [145, 45, 170, 45, 230],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'fanfare',
    defaultLabelEn: '2X FRENZY MODE!',
    defaultLabelZh: '双倍狂热时刻！',
  },
  countdown: {
    defaultPattern: 34,
    forcefulPattern: [85],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'tick',
    defaultLabelEn: 'GET READY...',
    defaultLabelZh: '准备开始...',
  },
  go: {
    defaultPattern: [60, 35, 105],
    forcefulPattern: [135, 45, 215],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'fanfare',
    defaultLabelEn: 'GO! GO! GO!',
    defaultLabelZh: '正式开始！',
  },
  'podium-reveal': {
    defaultPattern: [75, 40, 125],
    forcefulPattern: [145, 50, 185, 50, 245],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'fanfare',
    defaultLabelEn: 'MATCH COMPLETE!',
    defaultLabelZh: '比赛结束！',
  },
  'player-ready': {
    defaultPattern: 30,
    forcefulPattern: [85],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'tick',
    defaultLabelEn: 'READY!',
    defaultLabelZh: '已准备！',
  },
  'host-transfer': {
    defaultPattern: [50, 30, 90],
    forcefulPattern: [115, 45, 180],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'turn',
    defaultLabelEn: 'HOST REMOTE ACTIVE',
    defaultLabelZh: '已获得房主遥控器',
  },
  'impact-light': {
    defaultPattern: 28,
    forcefulPattern: [80],
    intensity: 'light',
    visualPulse: 'subtle',
    toneProfile: 'thump',
    defaultLabelEn: 'TAP',
    defaultLabelZh: '触感',
  },
  'impact-medium': {
    defaultPattern: 50,
    forcefulPattern: [115],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'thump',
    defaultLabelEn: 'HIT',
    defaultLabelZh: '碰撞',
  },
  'impact-heavy': {
    defaultPattern: [70, 35, 95],
    forcefulPattern: [145, 45, 200],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'thump',
    defaultLabelEn: 'IMPACT!',
    defaultLabelZh: '强力冲击！',
  },
};

/**
 * Maps arbitrary server reason strings or event names to a canonical `HapticEventType`.
 */
export function resolveHapticEventType(
  reason?: string,
  pattern?: number | number[]
): HapticEventType {
  if (!reason) {
    if (Array.isArray(pattern)) return 'impact-heavy';
    if (typeof pattern === 'number' && pattern >= 42) return 'impact-medium';
    return 'impact-light';
  }
  const r = reason.toLowerCase();
  if (r in HAPTIC_PRESETS) return r as HapticEventType;

  if (r === 'turn' || r === 'your-turn' || r === 'turn-start') return 'turn-start';
  if (r === 'turn-change' || r === 'next-turn') return 'turn-change';
  if (
    r === 'action-required' ||
    r === 'buy-prompt' ||
    r === 'color-pick' ||
    r === 'challenge-window' ||
    r === 'bomb-holder' ||
    r === 'tagger'
  ) {
    return 'action-required';
  }
  if (r === 'timer-warning' || r === 'hurry' || r === 'yellow-light') return 'timer-warning';
  if (
    r === 'host-alert' ||
    r === 'banner' ||
    r === 'red-light' ||
    r === 'stove-fire' ||
    r === 'fever' ||
    r === 'high-bid' ||
    r === 'board-event'
  ) {
    return 'host-alert';
  }
  if (r === 'round' || r === 'new-round' || r === 'wave' || r === 'round-transition') {
    return 'round-transition';
  }
  if (
    r === 'phase' ||
    r === 'phase-transition' ||
    r === 'briefing' ||
    r === 'lobby' ||
    r === 'pause' ||
    r === 'resume'
  ) {
    return 'phase-transition';
  }
  if (r === 'wheel' || r === 'chaos-wheel' || r === 'mutator') return 'chaos-wheel';
  if (r === 'frenzy' || r === 'frenzy-alert') return 'frenzy-alert';
  if (r === 'countdown') return 'countdown';
  if (r === 'go') return 'go';
  if (r === 'win' || r === 'finish' || r === 'podium' || r === 'results') return 'podium-reveal';
  if (r === 'ready' || r === 'player-ready' || r === 'join') return 'player-ready';
  if (r === 'host' || r === 'host-transfer') return 'host-transfer';
  if (
    r === 'ko' ||
    r === 'falloff' ||
    r === 'eliminated' ||
    r === 'knockback' ||
    r === 'goal' ||
    r === 'hit' ||
    r === 'bluff-caught'
  ) {
    return 'impact-heavy';
  }
  if (Array.isArray(pattern)) return 'impact-heavy';
  if (typeof pattern === 'number' && pattern >= 40) return 'impact-medium';
  return 'impact-light';
}

function loadInitialHapticMode(): HapticMode {
  if (typeof window === 'undefined') return 'forceful';
  try {
    const raw = window.localStorage.getItem(HAPTIC_MODE_STORAGE_KEY);
    if (raw === 'default' || raw === 'forceful' || raw === 'off') {
      return raw;
    }
  } catch {
    // Ignore storage errors
  }
  return 'forceful';
}

class ControllerHapticsEngine {
  private mode: HapticMode = loadInitialHapticMode();
  private switchLabel: HTMLLabelElement | null = null;
  private audioCtx: AudioContext | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private audioPrimed = false;
  private vibratePrimed = false;
  private isIOS = false;
  private isAndroid = false;
  private activeUntil = 0;
  private activePriority = 0;
  private lastTapticAt = 0;
  private lastAudioAt = 0;
  private pendingPatternForTouchEnd: {
    pattern: number | number[];
    expiresAt: number;
  } | null = null;
  private listenersAttached = false;
  private subscribers = new Set<HapticSubscriber>();
  private modeSubscribers = new Set<HapticModeSubscriber>();

  constructor() {
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      this.isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      this.isAndroid = /Android/i.test(ua);
    }
    this.attachGlobalUnlockListeners();
  }

  private attachGlobalUnlockListeners(): void {
    if (typeof window === 'undefined' || this.listenersAttached) return;
    this.listenersAttached = true;

    const onStartGesture = () => {
      if (this.mode !== 'off') {
        this.unlock(true);
      }
    };

    const onEndGesture = () => {
      if (this.mode === 'off') return;
      this.unlock(true);
      const pending = this.pendingPatternForTouchEnd;
      if (pending && Date.now() <= pending.expiresAt) {
        this.pendingPatternForTouchEnd = null;
        this.tryRawNavigatorVibrate(pending.pattern);
        if (this.isIOS && this.mode === 'forceful') {
          this.fireIosTapticSwitch(1);
        }
      }
    };

    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('pointerdown', onStartGesture, opts);
    window.addEventListener('touchstart', onStartGesture, opts);
    window.addEventListener('mousedown', onStartGesture, opts);
    window.addEventListener('keydown', onStartGesture, opts);
    window.addEventListener('pointerup', onEndGesture, opts);
    window.addEventListener('touchend', onEndGesture, opts);
    window.addEventListener('click', onEndGesture, opts);
  }

  private tryRawNavigatorVibrate(value: number | number[]): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return false;
    }
    try {
      let ok = navigator.vibrate(value);
      if (!ok && typeof value === 'number') {
        ok = navigator.vibrate([value]);
      }
      return Boolean(ok);
    } catch {
      return false;
    }
  }

  public subscribe(listener: HapticSubscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  public subscribeMode(listener: HapticModeSubscriber): () => void {
    this.modeSubscribers.add(listener);
    return () => {
      this.modeSubscribers.delete(listener);
    };
  }

  private notifySubscribers(notification: HapticNotification): void {
    for (const sub of this.subscribers) {
      try {
        sub(notification);
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  private notifyModeSubscribers(): void {
    for (const sub of this.modeSubscribers) {
      try {
        sub(this.mode);
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  public getMode(): HapticMode {
    return this.mode;
  }

  public setMode(nextMode: HapticMode): void {
    if (nextMode !== 'default' && nextMode !== 'forceful' && nextMode !== 'off') return;
    this.mode = nextMode;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(HAPTIC_MODE_STORAGE_KEY, nextMode);
      } catch {
        // Ignore storage errors
      }
    }
    if (nextMode === 'off') {
      this.pendingPatternForTouchEnd = null;
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(0);
        } catch {
          // Ignore stop errors
        }
      }
    } else {
      this.unlock(true);
    }
    this.notifyModeSubscribers();
  }

  public cycleMode(): HapticMode {
    const next: HapticMode =
      this.mode === 'default' ? 'forceful' : this.mode === 'forceful' ? 'off' : 'default';
    this.setMode(next);
    return next;
  }

  public getPlatform(): 'ios' | 'android' | 'other' {
    if (this.isIOS) return 'ios';
    if (this.isAndroid) return 'android';
    return 'other';
  }

  public isInIframe(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }

  public setEnabled(enabled: boolean): void {
    this.setMode(enabled ? 'forceful' : 'off');
  }

  public isEnabled(): boolean {
    return this.mode !== 'off';
  }

  public supportsNativeVibrate(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function' &&
      !this.isIOS
    );
  }

  private getMasterOutput(ctx: AudioContext): AudioNode {
    if (this.masterCompressor && this.masterCompressor.context === ctx) {
      return this.masterCompressor;
    }
    try {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-18, ctx.currentTime);
      comp.knee.setValueAtTime(10, ctx.currentTime);
      comp.ratio.setValueAtTime(8, ctx.currentTime);
      comp.attack.setValueAtTime(0.001, ctx.currentTime);
      comp.release.setValueAtTime(0.08, ctx.currentTime);
      comp.connect(ctx.destination);
      this.masterCompressor = comp;
      return comp;
    } catch {
      return ctx.destination;
    }
  }

  public unlock(fromGesture = false): void {
    if (typeof window === 'undefined' || this.mode === 'off') return;
    if (!this.audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctx) {
        try {
          this.audioCtx = new Ctx();
        } catch {
          // Ignore audio context init errors
        }
      }
    }
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      if (fromGesture && !this.audioPrimed) {
        try {
          const buffer = this.audioCtx.createBuffer(1, 1, 22050);
          const source = this.audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.audioCtx.destination);
          source.start(0);
          this.audioPrimed = true;
        } catch {
          // Ignore prime errors
        }
      }
    }
    if (
      fromGesture &&
      !this.vibratePrimed &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function' &&
      !this.isIOS
    ) {
      if (this.tryRawNavigatorVibrate(this.mode === 'forceful' ? 50 : 22)) {
        this.vibratePrimed = true;
      }
    }
    if (this.isIOS) {
      this.ensureIosSwitchElement();
    }
  }

  /**
   * Mounts an in-viewport native `<label><input type="checkbox" switch /></label>`.
   * Kept in top-level viewport (`top: 2px; left: 2px; z-index: 9999; opacity: 0.01`)
   * so iOS 17.4+ / 18+ WebKit always treats `.click()` as an active on-screen switch toggle.
   */
  private ensureIosSwitchElement(): void {
    if (typeof document === 'undefined' || this.switchLabel) return;
    const id = 'joinstick-ios-haptic-switch';
    const existing = document.getElementById(id);
    if (existing?.parentElement instanceof HTMLLabelElement) {
      this.switchLabel = existing.parentElement;
      return;
    }

    const label = document.createElement('label');
    label.htmlFor = id;
    label.setAttribute('aria-hidden', 'true');
    label.style.position = 'fixed';
    label.style.top = '2px';
    label.style.left = '2px';
    label.style.width = '28px';
    label.style.height = '18px';
    label.style.opacity = '0.01';
    label.style.pointerEvents = 'none';
    label.style.zIndex = '9999';
    label.style.margin = '0';
    label.style.padding = '0';

    const input = document.createElement('input');
    input.id = id;
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    input.style.width = '28px';
    input.style.height = '18px';
    input.style.margin = '0';

    label.appendChild(input);
    document.body.appendChild(label);
    this.switchLabel = label;
  }

  public fireIosTapticSwitch(burstCount = 1): boolean {
    if (!this.isIOS || this.mode === 'off') return false;
    const now = Date.now();
    if (now - this.lastTapticAt < 30) return false;
    this.lastTapticAt = now;
    try {
      this.ensureIosSwitchElement();
      if (this.switchLabel) {
        this.switchLabel.click();
        if (burstCount >= 2) {
          window.setTimeout(() => {
            try {
              this.switchLabel?.click();
            } catch {
              // Ignore
            }
          }, 80);
        }
        if (burstCount >= 3) {
          window.setTimeout(() => {
            try {
              this.switchLabel?.click();
            } catch {
              // Ignore
            }
          }, 160);
        }
        return true;
      }
    } catch {
      // Ignore if blocked
    }
    return false;
  }

  private playSingleResonantPulse(
    ctx: AudioContext,
    dest: AudioNode,
    startTime: number,
    startFreq: number,
    endFreq: number,
    durationSec: number,
    gainPeak: number,
    clickFreq = 1050,
    includeTransient = true
  ): void {
    // 1. Sub-bass fundamental driver
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(startFreq, startTime);
    subOsc.frequency.exponentialRampToValueAtTime(Math.max(32, endFreq), startTime + durationSec);

    subGain.gain.setValueAtTime(0.0001, startTime);
    subGain.gain.linearRampToValueAtTime(gainPeak, startTime + 0.004);
    subGain.gain.setValueAtTime(gainPeak * 0.92, startTime + durationSec * 0.45);
    subGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    subOsc.connect(subGain);
    subGain.connect(dest);
    subOsc.start(startTime);
    subOsc.stop(startTime + durationSec + 0.015);

    // 2. Warm 2nd-harmonic punch body
    const punchOsc = ctx.createOscillator();
    const punchGain = ctx.createGain();
    punchOsc.type = 'triangle';
    punchOsc.frequency.setValueAtTime(startFreq * 1.65, startTime);
    punchOsc.frequency.exponentialRampToValueAtTime(
      Math.max(48, endFreq * 1.35),
      startTime + durationSec * 0.85
    );

    punchGain.gain.setValueAtTime(0.0001, startTime);
    punchGain.gain.linearRampToValueAtTime(gainPeak * 0.72, startTime + 0.003);
    punchGain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec * 0.88);

    punchOsc.connect(punchGain);
    punchGain.connect(dest);
    punchOsc.start(startTime);
    punchOsc.stop(startTime + durationSec);

    // 3. 5ms Taptic actuator transient snap (active in Forceful mode)
    if (includeTransient) {
      const snapOsc = ctx.createOscillator();
      const snapGain = ctx.createGain();
      snapOsc.type = 'square';
      snapOsc.frequency.setValueAtTime(clickFreq, startTime);
      snapOsc.frequency.exponentialRampToValueAtTime(140, startTime + 0.008);

      snapGain.gain.setValueAtTime(0.0001, startTime);
      snapGain.gain.linearRampToValueAtTime(gainPeak * 0.45, startTime + 0.001);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.009);

      snapOsc.connect(snapGain);
      snapGain.connect(dest);
      snapOsc.start(startTime);
      snapOsc.stop(startTime + 0.011);
    }
  }

  private playThumpNow(
    ctx: AudioContext,
    intensity: HapticIntensity,
    toneProfile: TactileToneProfile = 'thump',
    isForceful = true
  ): void {
    const now = ctx.currentTime;
    const dest = isForceful ? this.getMasterOutput(ctx) : ctx.destination;
    const gainScale = isForceful ? 1.0 : 0.35;

    if (toneProfile === 'turn') {
      this.playSingleResonantPulse(
        ctx,
        dest,
        now,
        95,
        52,
        0.085,
        0.82 * gainScale,
        1100,
        isForceful
      );
      this.playSingleResonantPulse(
        ctx,
        dest,
        now + 0.11,
        130,
        62,
        0.115,
        0.95 * gainScale,
        1350,
        isForceful
      );
      return;
    }

    if (toneProfile === 'alert' || toneProfile === 'warning') {
      const count = toneProfile === 'warning' && isForceful ? 3 : 2;
      for (let i = 0; i < count; i++) {
        this.playSingleResonantPulse(
          ctx,
          dest,
          now + i * 0.095,
          toneProfile === 'warning' ? 135 : 115,
          54,
          0.075,
          0.88 * gainScale,
          1280,
          isForceful
        );
      }
      return;
    }

    if (toneProfile === 'fanfare') {
      this.playSingleResonantPulse(
        ctx,
        dest,
        now,
        90,
        44,
        0.095,
        0.92 * gainScale,
        1150,
        isForceful
      );
      this.playSingleResonantPulse(
        ctx,
        dest,
        now + 0.115,
        120,
        48,
        0.145,
        0.98 * gainScale,
        1400,
        isForceful
      );
      return;
    }

    const startFreq = intensity === 'heavy' ? 105 : intensity === 'medium' ? 118 : 132;
    const endFreq = intensity === 'heavy' ? 40 : intensity === 'medium' ? 48 : 56;
    const dur = intensity === 'heavy' ? 0.145 : intensity === 'medium' ? 0.095 : 0.068;
    const peak =
      (intensity === 'heavy' ? 0.96 : intensity === 'medium' ? 0.82 : 0.65) * gainScale;

    this.playSingleResonantPulse(ctx, dest, now, startFreq, endFreq, dur, peak, 1100, isForceful);
    if (intensity === 'heavy' && isForceful) {
      this.playSingleResonantPulse(ctx, dest, now + 0.125, 92, 38, 0.135, 0.95, 1250, true);
    }
  }

  private fireTactileAudioThump(
    intensity: HapticIntensity,
    toneProfile: TactileToneProfile = 'thump',
    isForceful = true
  ): boolean {
    const nowMs = Date.now();
    if (nowMs - this.lastAudioAt < 28) return false;
    this.lastAudioAt = nowMs;

    this.unlock();
    if (!this.audioCtx) return false;
    try {
      if (this.audioCtx.state === 'running') {
        this.playThumpNow(this.audioCtx, intensity, toneProfile, isForceful);
        return true;
      }
      if (this.audioCtx.state === 'suspended') {
        const ctx = this.audioCtx;
        ctx
          .resume()
          .then(() => {
            if (ctx.state === 'running') {
              this.playThumpNow(ctx, intensity, toneProfile, isForceful);
            }
          })
          .catch(() => {});
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  private normalizePattern(
    pattern: number | number[],
    intensity: HapticIntensity,
    isForceful: boolean
  ): { value: number | number[]; totalMs: number } {
    if (!isForceful) {
      // Default Mode: Balanced, subtle-to-medium W3C vibration pulses
      const minPulse = intensity === 'heavy' ? 70 : intensity === 'medium' ? 44 : 28;
      const scaleFactor = 1.15;
      if (typeof pattern === 'number') {
        const dur = Math.max(minPulse, Math.round(pattern * scaleFactor));
        return { value: dur, totalMs: dur };
      }
      const scaled = pattern.map((ms, idx) =>
        idx % 2 === 0
          ? Math.max(minPulse, Math.round(ms * scaleFactor))
          : Math.max(24, Math.round(ms))
      );
      const totalMs = scaled.reduce((sum, n) => sum + n, 0);
      return { value: scaled, totalMs };
    }

    // Forceful Mode: High-torque motor spin-up durations (80ms–135ms minimum) + multi-pulse bursts
    const minPulse = intensity === 'heavy' ? 130 : intensity === 'medium' ? 95 : 80;
    const scaleFactor = 1.5;
    if (typeof pattern === 'number') {
      const dur = Math.max(minPulse, Math.round(pattern * scaleFactor));
      if (intensity === 'heavy' || intensity === 'medium') {
        const arr = [dur, 38, Math.round(dur * 1.15)];
        return { value: arr, totalMs: arr[0] + arr[1] + arr[2] };
      }
      return { value: dur, totalMs: dur };
    }
    const scaled = pattern.map((ms, idx) =>
      idx % 2 === 0
        ? Math.max(minPulse, Math.round(ms * scaleFactor))
        : Math.max(35, Math.round(ms))
    );
    const totalMs = scaled.reduce((sum, n) => sum + n, 0);
    return { value: scaled, totalMs };
  }

  /**
   * Triggers a semantic haptic event (e.g., `'turn-start'`, `'host-alert'`, `'action-required'`,
   * `'round-transition'`, `'chaos-wheel'`, `'timer-warning'`) and notifies subscribed UI components.
   */
  public triggerEvent(
    reasonOrEvent: HapticEventType | string,
    customPattern?: number | number[],
    options?: {
      fromUserGesture?: boolean;
      intensity?: HapticIntensity;
      force?: boolean;
      label?: string;
      silentUi?: boolean;
    }
  ): HapticResult {
    const eventType = resolveHapticEventType(reasonOrEvent, customPattern);
    const preset = HAPTIC_PRESETS[eventType];
    const isForceful = this.mode === 'forceful';

    const presetPattern = isForceful ? preset.forcefulPattern : preset.defaultPattern;
    const usePresetPattern =
      customPattern === undefined ||
      (isForceful &&
        ((typeof customPattern === 'number' && customPattern < 65) ||
          (Array.isArray(customPattern) && customPattern[0] < 60)));
    const pattern = usePresetPattern ? presetPattern : customPattern;
    const intensity = options?.intensity ?? preset.intensity;

    const res = this.trigger(pattern, {
      fromUserGesture: options?.fromUserGesture,
      intensity,
      force: isForceful ? true : options?.force,
      toneProfile: preset.toneProfile,
    });
    res.event = eventType;

    if (this.mode !== 'off' && !options?.silentUi) {
      this.notifySubscribers({
        event: eventType,
        reason: reasonOrEvent,
        intensity,
        visualPulse: preset.visualPulse,
        labelEn: preset.defaultLabelEn,
        labelZh: preset.defaultLabelZh,
        customLabel: options?.label,
        timestamp: Date.now(),
      });
    }

    return res;
  }

  public trigger(
    pattern: number | number[],
    options?: {
      fromUserGesture?: boolean;
      intensity?: HapticIntensity;
      force?: boolean;
      skipIosSwitch?: boolean;
      toneProfile?: TactileToneProfile;
      subtle?: boolean;
    }
  ): HapticResult {
    const platform = this.getPlatform();
    const blockedByIframe = this.isInIframe();
    const result: HapticResult = {
      vibrated: false,
      iosTaptic: false,
      audioThump: false,
      blockedByIframe,
      platform,
      skippedByLock: false,
      mode: this.mode,
    };

    if (this.mode === 'off') {
      return result;
    }

    const isForceful = this.mode === 'forceful';
    this.unlock(Boolean(options?.fromUserGesture));

    const intensity: HapticIntensity =
      options?.intensity ??
      (Array.isArray(pattern) ? 'heavy' : pattern >= 42 ? 'medium' : 'light');
    const priority = PRIORITY_BY_INTENSITY[intensity];
    const now = Date.now();

    if (!options?.force && !isForceful && now < this.activeUntil && priority <= this.activePriority) {
      result.skippedByLock = true;
      return result;
    }
    if (!options?.force && isForceful && now < this.activeUntil && priority < this.activePriority) {
      result.skippedByLock = true;
      return result;
    }

    const { value, totalMs } = this.normalizePattern(pattern, intensity, isForceful);

    // In Forceful mode, queue for touchend/click re-assertion if triggered during pointerdown/touchstart
    if (isForceful && options?.fromUserGesture) {
      this.pendingPatternForTouchEnd = {
        pattern: value,
        expiresAt: now + 260,
      };
    }

    // 1. Native W3C Vibration API (Android Chrome / Firefox / Edge / Samsung Internet)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !this.isIOS) {
      result.vibrated = this.tryRawNavigatorVibrate(value);
      if (result.vibrated) {
        this.vibratePrimed = true;
        this.activeUntil = now + Math.min(420, totalMs);
        this.activePriority = priority;
      }
    }

    // 2. iOS 17.4+/18+ Safari / WebKit Taptic Engine Switch
    if (this.isIOS && !options?.skipIosSwitch && (isForceful || options?.fromUserGesture)) {
      const burstCount = isForceful
        ? intensity === 'heavy'
          ? 3
          : intensity === 'medium'
          ? 2
          : 1
        : 1;
      result.iosTaptic = this.fireIosTapticSwitch(burstCount);
    }

    // 3. WebAudio Tactile Sub-Bass & Mechanical Transient Resonator:
    // - In Forceful mode: Always co-fires compressed HD Rumble to shake the phone chassis.
    // - In Default mode: Fires as a gentle fallback only when native navigator.vibrate didn't fire.
    if (isForceful || !result.vibrated) {
      result.audioThump = this.fireTactileAudioThump(
        intensity,
        options?.toneProfile ?? 'thump',
        isForceful
      );
      if (!result.vibrated && result.audioThump) {
        this.activeUntil = now + (intensity === 'heavy' ? 140 : 80);
        this.activePriority = priority;
      }
    }

    return result;
  }

  public describeResult(res: HapticResult): string {
    if (res.mode === 'off') return 'Haptics Off';
    if (res.mode === 'forceful') return 'Forceful Haptics Active';
    return 'Default Haptics Active';
  }
}

export const controllerHaptics = new ControllerHapticsEngine();
export const globalHaptics = controllerHaptics;
