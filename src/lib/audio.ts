import { SoundEvent } from '../shared/types';

class ArcadeAudioEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.14,
    freqEnd?: number,
    delay = 0
  ): void {
    if (this.muted) return;
    this.unlock();
    if (!this.ctx) return;

    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public play(event: SoundEvent): void {
    if (this.muted) return;
    switch (event.type) {
      case 'join':
        this.tone(440, 0.09, 'triangle', 0.12);
        this.tone(660, 0.14, 'triangle', 0.13, undefined, 0.07);
        break;
      case 'ready':
        this.tone(523.25, 0.08, 'sine', 0.11);
        this.tone(783.99, 0.12, 'sine', 0.11, undefined, 0.06);
        break;
      case 'countdown':
        this.tone(420, 0.13, 'square', 0.07);
        break;
      case 'go':
        this.tone(587.33, 0.09, 'square', 0.08);
        this.tone(880, 0.24, 'triangle', 0.14, undefined, 0.07);
        break;
      case 'bump': {
        const vol = 0.09 + (event.intensity ?? 0.5) * 0.1;
        this.tone(175, 0.12, 'sawtooth', vol, 58);
        break;
      }
      case 'pulse':
        this.tone(260, 0.26, 'sine', 0.16, 75);
        this.tone(520, 0.18, 'triangle', 0.09, 140);
        break;
      case 'ko':
        this.tone(360, 0.14, 'sawtooth', 0.13, 120);
        this.tone(180, 0.28, 'sawtooth', 0.14, 48, 0.09);
        break;
      case 'shoot':
        this.tone(760, 0.08, 'square', 0.055, 290);
        break;
      case 'hit':
        this.tone(240, 0.11, 'sawtooth', 0.11, 95);
        break;
      case 'pickup':
        this.tone(587, 0.08, 'triangle', 0.12);
        this.tone(880, 0.1, 'triangle', 0.12, undefined, 0.06);
        this.tone(1174, 0.14, 'triangle', 0.12, undefined, 0.12);
        break;
      case 'boost':
        this.tone(220, 0.18, 'sawtooth', 0.08, 520);
        break;
      case 'lap':
        this.tone(523, 0.09, 'triangle', 0.13);
        this.tone(659, 0.09, 'triangle', 0.13, undefined, 0.08);
        this.tone(1046, 0.18, 'triangle', 0.14, undefined, 0.16);
        break;
      case 'win':
        this.tone(523.25, 0.12, 'triangle', 0.14, undefined, 0);
        this.tone(659.25, 0.12, 'triangle', 0.14, undefined, 0.11);
        this.tone(783.99, 0.14, 'triangle', 0.15, undefined, 0.22);
        this.tone(1046.5, 0.34, 'triangle', 0.16, undefined, 0.34);
        break;
    }
  }
}

export const arcadeAudio = new ArcadeAudioEngine();
