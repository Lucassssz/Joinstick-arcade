/**
 * Cross-platform Mobile Haptic & Tactile Feedback Engine.
 *
 * How mobile browsers handle haptics:
 * 1. Android Chrome / Edge / Firefox / Samsung Internet:
 *    - Supports W3C `navigator.vibrate()`, ONLY after trusted user activation and NOT inside
 *      cross-origin iframes lacking `allow="vibrate"`.
 *    - Calling `navigator.vibrate()` too frequently cancels the previous pulse before the motor
 *      even spins up, so we enforce a priority lock window (`activeUntil`).
 * 2. iOS 17.4+ / 18+ Safari, Chrome on iOS, Firefox on iOS (all WebKit):
 *    - Apple does NOT implement `navigator.vibrate()`.
 *    - Toggling an in-viewport native `<input type="checkbox" switch>` (default appearance,
 *      `opacity: 0.001`) via a real `<label>` tap triggers the hardware Taptic Engine.
 * 3. Async WebSocket impacts when hardware vibrate is unavailable (e.g. iOS hits/KOs/fall-offs):
 *    - Plays an unlocked low-frequency sub-bass tactile thump via Web Audio API so players
 *      still feel/hear physical impacts.
 */

export type HapticIntensity = 'light' | 'medium' | 'heavy';

export interface HapticResult {
  vibrated: boolean;
  iosTaptic: boolean;
  audioThump: boolean;
  blockedByIframe: boolean;
  platform: 'ios' | 'android' | 'other';
  skippedByLock: boolean;
}

const PRIORITY_BY_INTENSITY: Record<HapticIntensity, number> = {
  light: 1,
  medium: 2,
  heavy: 3,
};

class ControllerHapticsEngine {
  private enabled = true;
  private switchLabel: HTMLLabelElement | null = null;
  private audioCtx: AudioContext | null = null;
  private isIOS = false;
  private isAndroid = false;
  private activeUntil = 0;
  private activePriority = 0;
  private lastTapticAt = 0;
  private listenersAttached = false;

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
      this.unlock();
    };
    window.addEventListener('touchstart', onGesture, { passive: true });
    window.addEventListener('touchend', onGesture, { passive: true });
    window.addEventListener('click', onGesture, { passive: true });
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
    this.enabled = enabled;
    if (!enabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore stop errors
      }
    }
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

  public unlock(): void {
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
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
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
    if (now - this.lastTapticAt < 45) return false;
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

  private playThumpNow(ctx: AudioContext, intensity: HapticIntensity): void {
    const now = ctx.currentTime;

    // Low-end sub-bass body thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';

    const startFreq = intensity === 'heavy' ? 128 : intensity === 'medium' ? 155 : 190;
    const endFreq = intensity === 'heavy' ? 38 : intensity === 'medium' ? 52 : 70;
    const dur = intensity === 'heavy' ? 0.14 : intensity === 'medium' ? 0.085 : 0.05;
    const peak = intensity === 'heavy' ? 0.38 : intensity === 'medium' ? 0.22 : 0.12;

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

  private fireTactileAudioThump(intensity: HapticIntensity): boolean {
    if (!this.audioCtx) return false;
    try {
      if (this.audioCtx.state === 'running') {
        this.playThumpNow(this.audioCtx, intensity);
        return true;
      }
      if (this.audioCtx.state === 'suspended') {
        const ctx = this.audioCtx;
        ctx
          .resume()
          .then(() => {
            if (ctx.state === 'running') {
              this.playThumpNow(ctx, intensity);
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
    intensity: HapticIntensity
  ): { value: number | number[]; totalMs: number } {
    const minPulse = intensity === 'heavy' ? 85 : intensity === 'medium' ? 60 : 42;
    if (typeof pattern === 'number') {
      const dur = Math.max(minPulse, Math.round(pattern * 1.45));
      return { value: dur, totalMs: dur };
    }
    const scaled = pattern.map((ms, idx) =>
      idx % 2 === 0
        ? Math.max(minPulse, Math.round(ms * 1.35))
        : Math.max(30, Math.round(ms))
    );
    const totalMs = scaled.reduce((sum, n) => sum + n, 0);
    return { value: scaled, totalMs };
  }

  public trigger(
    pattern: number | number[],
    options?: {
      fromUserGesture?: boolean;
      intensity?: HapticIntensity;
      force?: boolean;
      skipIosSwitch?: boolean;
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
    };

    if (!this.enabled) return result;

    const intensity: HapticIntensity =
      options?.intensity ??
      (Array.isArray(pattern) ? 'heavy' : pattern >= 42 ? 'medium' : 'light');
    const priority = PRIORITY_BY_INTENSITY[intensity];
    const now = Date.now();

    // Prevent rapid back-to-back calls (e.g. 30Hz ticks or server echo right after tap)
    // from cancelling an in-progress phone motor spin-up!
    if (!options?.force && now < this.activeUntil && priority <= this.activePriority) {
      result.skippedByLock = true;
      return result;
    }

    // 1. Native W3C Vibration API (Android Chrome / Firefox / Edge / Samsung Internet)
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !this.isIOS) {
      try {
        const { value, totalMs } = this.normalizePattern(pattern, intensity);
        const ok = navigator.vibrate(value);
        result.vibrated = Boolean(ok);
        if (result.vibrated) {
          this.activeUntil = now + Math.min(450, totalMs);
          this.activePriority = priority;
        }
      } catch {
        result.vibrated = false;
      }
    }

    // 2. iOS 17.4+/18+ Safari / WebKit Taptic Engine Switch inside user gestures
    if (!result.vibrated && this.isIOS && options?.fromUserGesture && !options?.skipIosSwitch) {
      result.iosTaptic = this.fireIosTapticSwitch();
    }

    // 3. Low-frequency tactile audio thump when native vibration didn't fire
    if (!result.vibrated) {
      if (now >= this.activeUntil || priority > this.activePriority || options?.force) {
        result.audioThump = this.fireTactileAudioThump(intensity);
        if (result.audioThump) {
          this.activeUntil = now + (intensity === 'heavy' ? 120 : 65);
          this.activePriority = priority;
        }
      }
    }

    return result;
  }

  public describeResult(res: HapticResult): string {
    if (res.blockedByIframe && !res.vibrated) {
      return 'Open the Join URL directly on your phone (via QR code) for hardware vibration.';
    }
    if (res.vibrated) {
      return 'Vibration pulse sent! If not felt, enable Touch Vibration in phone Settings & turn off Battery Saver.';
    }
    if (res.platform === 'ios') {
      return 'iOS Taptic tap fired (requires iOS 18+ & System Haptics on). Safari only vibrates on taps, not background hits.';
    }
    if (res.audioThump) {
      return 'Hardware vibrate unsupported in this browser — tactile audio thump active.';
    }
    return 'Vibration not supported on this device/browser.';
  }
}

export const controllerHaptics = new ControllerHapticsEngine();
