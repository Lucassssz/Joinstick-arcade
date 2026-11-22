/**
 * Global Mobile Haptic & Tactile Feedback Service.
 *
 * Bridges authoritative Host UI events (turn transitions, action prompts, round banners,
 * countdowns, Chaos Wheel spins, hazard alerts) and direct controller interactions to
 * player smartphones using a 3-tier cross-platform pipeline:
 *
 * 1. Android Chrome / Edge / Firefox / Samsung Internet:
 *    - W3C `navigator.vibrate()` with priority-aware motor lock windows (`activeUntil`)
 *      so rapid ticks never cancel an in-progress vibration pulse.
 * 2. iOS 17.4+ / 18+ Safari & WebKit:
 *    - Native in-viewport `<input type="checkbox" switch>` Taptic Engine trigger on user gestures.
 * 3. Multi-Profile WebAudio Tactile Synthesizer (Universal Fallback):
 *    - When hardware vibration is unavailable for async WebSocket host events (e.g., iOS background
 *      turn transitions or game alerts), synthesizes a subtle low-frequency resonant tactile pulse
 *      tailored to the semantic event type (`turn-start`, `host-alert`, `timer-warning`, `thump`).
 */

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
  pattern: number | number[];
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

const PRIORITY_BY_INTENSITY: Record<HapticIntensity, number> = {
  light: 1,
  medium: 2,
  heavy: 3,
};

export const HAPTIC_PRESETS: Record<HapticEventType, HapticPresetSpec> = {
  'turn-start': {
    pattern: [26, 36, 46],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'turn',
    defaultLabelEn: 'YOUR TURN!',
    defaultLabelZh: '轮到你了！',
  },
  'turn-change': {
    pattern: 18,
    intensity: 'light',
    visualPulse: 'subtle',
    toneProfile: 'tick',
    defaultLabelEn: 'Turn Changed',
    defaultLabelZh: '回合切换',
  },
  'action-required': {
    pattern: [34, 28, 54],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'alert',
    defaultLabelEn: 'ACTION REQUIRED!',
    defaultLabelZh: '请立即操作！',
  },
  'timer-warning': {
    pattern: [38, 28, 38],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'warning',
    defaultLabelEn: 'TIME RUNNING OUT!',
    defaultLabelZh: '倒计时警告！',
  },
  'host-alert': {
    pattern: [26, 26, 40],
    intensity: 'medium',
    visualPulse: 'subtle',
    toneProfile: 'alert',
    defaultLabelEn: 'GAME ALERT',
    defaultLabelZh: '赛况提醒',
  },
  'round-transition': {
    pattern: [28, 32, 44],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'turn',
    defaultLabelEn: 'NEW ROUND',
    defaultLabelZh: '新一轮开始',
  },
  'phase-transition': {
    pattern: [22, 28, 34],
    intensity: 'light',
    visualPulse: 'subtle',
    toneProfile: 'tick',
    defaultLabelEn: 'SCREEN UPDATED',
    defaultLabelZh: '大屏状态切换',
  },
  'chaos-wheel': {
    pattern: [24, 24, 42],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'alert',
    defaultLabelEn: 'CHAOS WHEEL!',
    defaultLabelZh: '混沌转盘！',
  },
  'frenzy-alert': {
    pattern: [60, 35, 95, 35, 120],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'fanfare',
    defaultLabelEn: '2X FRENZY MODE!',
    defaultLabelZh: '双倍狂热时刻！',
  },
  countdown: {
    pattern: 32,
    intensity: 'light',
    visualPulse: 'subtle',
    toneProfile: 'tick',
    defaultLabelEn: 'GET READY...',
    defaultLabelZh: '准备开始...',
  },
  go: {
    pattern: [55, 35, 95],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'fanfare',
    defaultLabelEn: 'GO! GO! GO!',
    defaultLabelZh: '正式开始！',
  },
  'podium-reveal': {
    pattern: [70, 40, 120],
    intensity: 'heavy',
    visualPulse: 'heavy',
    toneProfile: 'fanfare',
    defaultLabelEn: 'MATCH COMPLETE!',
    defaultLabelZh: '比赛结束！',
  },
  'player-ready': {
    pattern: 20,
    intensity: 'light',
    visualPulse: 'subtle',
    toneProfile: 'tick',
    defaultLabelEn: 'READY!',
    defaultLabelZh: '已准备！',
  },
  'host-transfer': {
    pattern: [45, 30, 85],
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'turn',
    defaultLabelEn: 'HOST REMOTE ACTIVE',
    defaultLabelZh: '已获得房主遥控器',
  },
  'impact-light': {
    pattern: 24,
    intensity: 'light',
    visualPulse: 'subtle',
    toneProfile: 'thump',
    defaultLabelEn: 'TAP',
    defaultLabelZh: '触感',
  },
  'impact-medium': {
    pattern: 45,
    intensity: 'medium',
    visualPulse: 'light',
    toneProfile: 'thump',
    defaultLabelEn: 'HIT',
    defaultLabelZh: '碰撞',
  },
  'impact-heavy': {
    pattern: [65, 35, 85],
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

class ControllerHapticsEngine {
  private readonly enabled = true;
  private switchLabel: HTMLLabelElement | null = null;
  private audioCtx: AudioContext | null = null;
  private audioPrimed = false;
  private vibratePrimed = false;
  private isIOS = false;
  private isAndroid = false;
  private activeUntil = 0;
  private activePriority = 0;
  private lastTapticAt = 0;
  private lastAudioAt = 0;
  private listenersAttached = false;
  private subscribers = new Set<HapticSubscriber>();

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
    const onGesture = () => {
      this.unlock(true);
    };
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    window.addEventListener('pointerdown', onGesture, opts);
    window.addEventListener('pointerup', onGesture, opts);
    window.addEventListener('touchstart', onGesture, opts);
    window.addEventListener('touchend', onGesture, opts);
    window.addEventListener('mousedown', onGesture, opts);
    window.addEventListener('keydown', onGesture, opts);
    window.addEventListener('click', onGesture, opts);
  }

  public subscribe(listener: HapticSubscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
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

  public setEnabled(_enabled: boolean): void {
    // Force Haptic mode: haptics remain permanently enabled for all players
    this.unlock();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public supportsNativeVibrate(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function' &&
      !this.isIOS
    );
  }

  public unlock(fromGesture = false): void {
    if (typeof window === 'undefined') return;
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
      // Play a 1-sample silent buffer on first user gesture so iOS/Android permanently unlock audio
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
    // Prime navigator.vibrate on the very first touch so mobile browsers grant sticky activation
    if (
      fromGesture &&
      !this.vibratePrimed &&
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function' &&
      !this.isIOS
    ) {
      try {
        navigator.vibrate(12);
        this.vibratePrimed = true;
      } catch {
        // Ignore prime errors
      }
    }
    if (this.isIOS) {
      this.ensureIosSwitchElement();
    }
  }

  /**
   * Mounts an in-viewport native `<label><input type="checkbox" switch /></label>`.
   * CRITICAL for iOS 18 WebKit:
   * - Must stay inside viewport (`top: 0; left: 0`), NOT `-9999px`
   * - Must keep native `appearance` (NOT `appearance: none`)
   * - Must NOT use `display: none` or `visibility: hidden`
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
    label.style.top = '0px';
    label.style.left = '0px';
    label.style.width = '52px';
    label.style.height = '32px';
    label.style.opacity = '0.001';
    label.style.pointerEvents = 'none';
    label.style.zIndex = '-1';
    label.style.margin = '0';
    label.style.padding = '0';

    const input = document.createElement('input');
    input.id = id;
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    input.style.width = '52px';
    input.style.height = '32px';
    input.style.margin = '0';

    label.appendChild(input);
    document.body.appendChild(label);
    this.switchLabel = label;
  }

  public fireIosTapticSwitch(): boolean {
    if (!this.isIOS) return false;
    const now = Date.now();
    if (now - this.lastTapticAt < 40) return false;
    this.lastTapticAt = now;
    try {
      this.ensureIosSwitchElement();
      if (this.switchLabel) {
        this.switchLabel.click();
        return true;
      }
    } catch {
      // Ignore if blocked
    }
    return false;
  }

  private playThumpNow(
    ctx: AudioContext,
    intensity: HapticIntensity,
    toneProfile: TactileToneProfile = 'thump'
  ): void {
    const now = ctx.currentTime;

    if (toneProfile === 'turn') {
      // Rising two-pulse tactile cue for turn transitions
      const freqs = [115, 165];
      freqs.forEach((f, idx) => {
        const start = now + idx * 0.055;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, start);
        osc.frequency.exponentialRampToValueAtTime(f * 0.55, start + 0.048);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.22, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.048);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.055);
      });
      return;
    }

    if (toneProfile === 'alert' || toneProfile === 'warning') {
      // Subtle double tactile pulse for host alerts & timer warnings
      const baseFreq = toneProfile === 'warning' ? 148 : 132;
      for (let i = 0; i < 2; i++) {
        const start = now + i * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, start);
        osc.frequency.exponentialRampToValueAtTime(62, start + 0.05);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(0.2, start + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.055);
      }
      return;
    }

    // Standard low-end sub-bass body thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';

    const startFreq = intensity === 'heavy' ? 128 : intensity === 'medium' ? 155 : 185;
    const endFreq = intensity === 'heavy' ? 38 : intensity === 'medium' ? 52 : 68;
    const dur = intensity === 'heavy' ? 0.14 : intensity === 'medium' ? 0.08 : 0.045;
    const peak = intensity === 'heavy' ? 0.36 : intensity === 'medium' ? 0.22 : 0.12;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + dur);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private fireTactileAudioThump(
    intensity: HapticIntensity,
    toneProfile: TactileToneProfile = 'thump'
  ): boolean {
    const nowMs = Date.now();
    if (nowMs - this.lastAudioAt < 35) return false;
    this.lastAudioAt = nowMs;

    this.unlock();
    if (!this.audioCtx) return false;
    try {
      if (this.audioCtx.state === 'running') {
        this.playThumpNow(this.audioCtx, intensity, toneProfile);
        return true;
      }
      if (this.audioCtx.state === 'suspended') {
        const ctx = this.audioCtx;
        ctx
          .resume()
          .then(() => {
            if (ctx.state === 'running') {
              this.playThumpNow(ctx, intensity, toneProfile);
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
    subtle = false
  ): { value: number | number[]; totalMs: number } {
    const minPulse = subtle ? 26 : intensity === 'heavy' ? 85 : intensity === 'medium' ? 50 : 35;
    const scaleFactor = subtle ? 1.15 : 1.3;
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
    const pattern = customPattern ?? preset.pattern;
    const intensity = options?.intensity ?? preset.intensity;
    const isSubtleEvent =
      eventType === 'turn-change' ||
      eventType === 'phase-transition' ||
      eventType === 'player-ready' ||
      eventType === 'host-alert' ||
      eventType === 'turn-start';

    const res = this.trigger(pattern, {
      fromUserGesture: options?.fromUserGesture,
      intensity,
      // Always force important semantic host events so they never get dropped
      force:
        options?.force ??
        (eventType === 'turn-start' ||
          eventType === 'action-required' ||
          eventType === 'timer-warning' ||
          eventType === 'go' ||
          eventType === 'frenzy-alert' ||
          eventType === 'podium-reveal'),
      toneProfile: preset.toneProfile,
      subtle: isSubtleEvent,
    });
    res.event = eventType;

    if (!options?.silentUi) {
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
    this.unlock(Boolean(options?.fromUserGesture));

    const platform = this.getPlatform();
    const blockedByIframe = this.isInIframe();
    const result: HapticResult = {
      vibrated: false,
      iosTaptic: false,
      audioThump: false,
      blockedByIframe,
      platform,
      skippedByLock: false,
    };

    const intensity: HapticIntensity =
      options?.intensity ??
      (Array.isArray(pattern) ? 'heavy' : pattern >= 42 ? 'medium' : 'light');
    const priority = PRIORITY_BY_INTENSITY[intensity];
    const now = Date.now();

    // Prevent lower-priority background ticks from cutting off an active heavy vibration pulse
    if (!options?.force && now < this.activeUntil && priority < this.activePriority) {
      result.skippedByLock = true;
      return result;
    }

    // 1. Native W3C Vibration API (Android Chrome / Firefox / Edge / Samsung Internet)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !this.isIOS) {
      try {
        const { value, totalMs } = this.normalizePattern(pattern, intensity, options?.subtle);
        const ok = navigator.vibrate(value);
        result.vibrated = Boolean(ok);
        if (result.vibrated) {
          this.vibratePrimed = true;
          this.activeUntil = now + Math.min(360, totalMs);
          this.activePriority = priority;
        }
      } catch {
        result.vibrated = false;
      }
    }

    // 2. iOS 17.4+/18+ Safari / WebKit Taptic Engine Switch
    if (this.isIOS && !options?.skipIosSwitch) {
      result.iosTaptic = this.fireIosTapticSwitch();
    }

    // 3. Forced Low-Frequency Tactile Sub-Bass Synthesizer:
    // Always co-fires so phones with OS vibration muted, Battery Saver enabled, or iOS WebKit
    // still produce an unmistakable physical + acoustic tactile thump automatically.
    result.audioThump = this.fireTactileAudioThump(intensity, options?.toneProfile ?? 'thump');
    if (!result.vibrated && result.audioThump) {
      this.activeUntil = now + (intensity === 'heavy' ? 110 : 60);
      this.activePriority = priority;
    }

    return result;
  }

  public describeResult(res: HapticResult): string {
    if (res.vibrated || res.iosTaptic || res.audioThump) {
      return 'Force Haptics Active!';
    }
    return 'Force Haptics Active!';
  }
}

export const controllerHaptics = new ControllerHapticsEngine();
export const globalHaptics = controllerHaptics;

