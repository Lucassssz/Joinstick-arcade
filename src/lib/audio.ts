import { SoundEvent } from '../shared/types';

export type BgmMode = 'lobby' | 'battle' | null;

// MIDI helper -> frequency in Hz
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 64-step (4 bars x 16 sixteenth-notes) Playful Party BGM in C Major (116 BPM)
const LOBBY_MELODY: (number | null)[] = [
  // Bar 1 (C)
  72, null, 76, null, 79, null, 76, 79, 81, null, 79, null, 76, null, 72, null,
  // Bar 2 (G)
  74, null, 79, null, 74, null, 71, 74, 76, null, 74, null, 71, null, 67, null,
  // Bar 3 (Am)
  72, null, 76, null, 81, null, 79, null, 76, null, 72, 74, 76, null, 79, null,
  // Bar 4 (F -> G)
  77, null, 76, null, 74, null, 72, null, 74, null, 76, null, 79, null, null, null,
];

const LOBBY_BASS: (number | null)[] = [
  // Bar 1 (C3 -> G3)
  48, null, null, null, 60, null, 48, null, 55, null, null, null, 48, null, 55, null,
  // Bar 2 (G2 -> D3)
  43, null, null, null, 55, null, 43, null, 50, null, null, null, 43, null, 47, null,
  // Bar 3 (A2 -> E3)
  45, null, null, null, 57, null, 45, null, 52, null, null, null, 45, null, 52, null,
  // Bar 4 (F2 -> G2)
  41, null, null, null, 53, null, 41, null, 43, null, null, null, 55, null, 43, 47,
];

const LOBBY_CHORDS: Record<number, number[]> = {
  0: [60, 64, 67],
  8: [60, 64, 67],
  16: [59, 62, 67],
  24: [59, 62, 67],
  32: [57, 60, 64],
  40: [57, 60, 64],
  48: [57, 60, 65],
  56: [59, 62, 67],
};

// 64-step (4 bars x 16 sixteenth-notes) Competitive Fire Battle BGM in D Minor (144 BPM)
const BATTLE_LEAD: (number | null)[] = [
  // Bar 1 (Dm)
  74, null, 77, null, 81, null, 77, 81, 82, null, 81, null, 77, null, 74, null,
  // Bar 2 (Bb -> C)
  70, null, 74, null, 77, null, 74, 77, 79, null, 77, null, 76, null, 72, null,
  // Bar 3 (Gm -> Am)
  79, null, 77, 74, 79, null, 82, null, 81, null, 79, 76, 81, null, 84, null,
  // Bar 4 (A7 / Dm tension turnaround)
  86, null, 81, null, 77, null, 81, null, 85, null, 81, 79, 76, null, 73, null,
];

const BATTLE_ARP: (number | null)[] = [
  62, 69, 74, 69, 62, 69, 74, 69, 62, 69, 74, 69, 62, 69, 74, 69,
  58, 65, 70, 65, 58, 65, 70, 65, 60, 67, 72, 67, 60, 67, 72, 67,
  55, 62, 67, 62, 55, 62, 67, 62, 57, 64, 69, 64, 57, 64, 69, 64,
  57, 64, 69, 73, 57, 64, 69, 73, 57, 64, 69, 73, 69, 64, 61, 57,
];

const BATTLE_BASS: (number | null)[] = [
  // Bar 1 (D2 gallop)
  38, 38, null, 38, 50, null, 38, 38, 38, 38, null, 38, 50, null, 38, 41,
  // Bar 2 (Bb1 -> C2)
  34, 34, null, 34, 46, null, 34, 34, 36, 36, null, 36, 48, null, 36, 40,
  // Bar 3 (G1 -> A1)
  31, 31, null, 31, 43, null, 31, 31, 33, 33, null, 33, 45, null, 33, 36,
  // Bar 4 (A1 turnaround)
  33, 33, 45, 33, 33, 33, 45, 33, 33, 45, 33, 45, 49, 45, 40, 33,
];

class ArcadeAudioEngine {
  private ctx: AudioContext | null = null;
  private masterNode: AudioNode | null = null;
  private muted = false;

  // BGM sequencer state
  private bgmMode: BgmMode = null;
  private bgmGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private bgmTimer: number | null = null;
  private nextNoteTime = 0;
  private stepIndex = 0;
  private gestureListenerBound = false;
  private visibilityListenerBound = false;
  private stateListeners = new Set<() => void>();

  private notifyStateListeners(): void {
    for (const cb of this.stateListeners) {
      try {
        cb();
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  public isAudioBlocked(): boolean {
    if (this.muted || !this.bgmMode) return false;
    return !this.ctx || this.ctx.state !== 'running';
  }

  public subscribeAudioState(cb: () => void): () => void {
    this.stateListeners.add(cb);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.bgmGain) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.setTargetAtTime(muted ? 0 : 1.15, now, 0.04);
    }
    if (!muted && this.bgmMode) {
      this.unlock();
      this.ensureSchedulerRunning();
    }
    this.notifyStateListeners();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public getBgmMode(): BgmMode {
    return this.bgmMode;
  }

  public setBgm(mode: BgmMode): void {
    if (this.bgmMode === mode) {
      if (mode) {
        this.unlock();
        this.ensureSchedulerRunning();
        if (this.isAudioBlocked()) this.bindGestureWakeup();
      }
      return;
    }
    this.bgmMode = mode;
    this.stepIndex = 0;

    if (!mode) {
      this.stopScheduler();
      this.notifyStateListeners();
      return;
    }

    this.unlock();
    if (this.ctx) {
      this.nextNoteTime = this.ctx.currentTime + 0.05;
      this.ensureSchedulerRunning();
    }
    this.bindGestureWakeup();
    this.bindVisibilityWakeup();
    this.notifyStateListeners();
  }

  private bindVisibilityWakeup(): void {
    if (this.visibilityListenerBound || typeof document === 'undefined') return;
    this.visibilityListenerBound = true;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && this.bgmMode && !this.muted) {
        this.unlock();
        this.ensureSchedulerRunning();
        if (this.isAudioBlocked()) {
          this.bindGestureWakeup();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
  }

  private bindGestureWakeup(): void {
    if (this.gestureListenerBound || typeof window === 'undefined') return;
    this.gestureListenerBound = true;
    const events = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown'] as const;
    const detach = () => {
      for (const evt of events) {
        window.removeEventListener(evt, wakeup, true);
      }
      this.gestureListenerBound = false;
    };
    const wakeup = () => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        if (this.bgmMode) {
          this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.03);
          this.ensureSchedulerRunning();
        }
        detach();
        this.notifyStateListeners();
      }
    };
    for (const evt of events) {
      window.addEventListener(evt, wakeup, { capture: true, passive: true });
    }
  }

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        // Gentle master limiter/compressor keeps BGM audible & punchy on tablet speakers without clipping
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 18;
        comp.ratio.value = 4;
        comp.attack.value = 0.004;
        comp.release.value = 0.14;
        comp.connect(this.ctx.destination);
        this.masterNode = comp;

        this.bgmGain = this.ctx.createGain();
        this.bgmGain.gain.value = this.muted ? 0 : 1.15;
        this.bgmGain.connect(this.masterNode);

        this.ctx.onstatechange = () => {
          if (this.ctx?.state === 'running') {
            if (this.bgmMode) {
              this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.03);
              this.ensureSchedulerRunning();
            }
          } else if (this.bgmMode && !this.muted) {
            this.bindGestureWakeup();
          }
          this.notifyStateListeners();
        };
      }
    }

    if (this.ctx) {
      // Prime iOS/iPadOS WebKit hardware audio channel synchronously inside gesture
      try {
        const silentBuf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(this.ctx.destination);
        src.start(0);
      } catch {
        // Ignore if context forbids buffer start before resume
      }

      if (this.ctx.state !== 'running') {
        this.ctx
          .resume()
          .then(() => {
            if (this.bgmMode) {
              this.nextNoteTime = (this.ctx?.currentTime ?? 0) + 0.04;
              this.ensureSchedulerRunning();
            }
            this.notifyStateListeners();
          })
          .catch(() => {
            this.notifyStateListeners();
          });
      }
    }
  }

  private ensureSchedulerRunning(): void {
    if (!this.bgmMode || typeof window === 'undefined') return;
    if (!this.ctx) this.unlock();
    if (!this.ctx) return;
    if (this.bgmTimer !== null) return;

    this.nextNoteTime = Math.max(this.nextNoteTime, this.ctx.currentTime + 0.04);
    this.bgmTimer = window.setInterval(() => this.pumpBgmScheduler(), 35);
  }

  private stopScheduler(): void {
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private getNoiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.noiseBuffer) return this.noiseBuffer;
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * 0.25);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  private pumpBgmScheduler(): void {
    if (!this.ctx || !this.bgmMode || this.muted) return;
    if (this.ctx.state !== 'running') return;

    const lookAhead = 0.14;
    const bpm = this.bgmMode === 'battle' ? 144 : 116;
    const stepDuration = 60 / bpm / 4; // 16th note

    // Prevent catch-up burst if tab throttled
    if (this.nextNoteTime < this.ctx.currentTime - 0.3) {
      this.nextNoteTime = this.ctx.currentTime + 0.04;
    }

    while (this.nextNoteTime < this.ctx.currentTime + lookAhead) {
      if (this.bgmMode === 'battle') {
        this.scheduleBattleStep(this.stepIndex, this.nextNoteTime, stepDuration);
      } else {
        this.scheduleLobbyStep(this.stepIndex, this.nextNoteTime, stepDuration);
      }
      this.nextNoteTime += stepDuration;
      this.stepIndex = (this.stepIndex + 1) % 64;
    }
  }

  private scheduleBgmTone(
    freq: number,
    time: number,
    duration: number,
    type: OscillatorType,
    peakGain: number,
    options?: { filterFreqStart?: number; filterFreqEnd?: number; freqEnd?: number }
  ): void {
    if (!this.ctx || !this.bgmGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (options?.freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, options.freqEnd), time + duration);
    }

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    if (options?.filterFreqStart !== undefined) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2.4;
      filter.frequency.setValueAtTime(options.filterFreqStart, time);
      if (options.filterFreqEnd !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(80, options.filterFreqEnd),
          time + duration
        );
      }
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }

    gain.connect(this.bgmGain);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private scheduleNoiseHit(
    time: number,
    duration: number,
    filterType: BiquadFilterType,
    filterFreq: number,
    peakGain: number
  ): void {
    if (!this.ctx || !this.bgmGain) return;
    const buf = this.getNoiseBuffer();
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.bgmGain);
    src.start(time);
    src.stop(time + duration + 0.01);
  }

  private scheduleLobbyStep(step: number, time: number, stepDur: number): void {
    // 1. Playful marimba-like melody
    const melodyMidi = LOBBY_MELODY[step];
    if (melodyMidi !== null) {
      const freq = midiToFreq(melodyMidi);
      this.scheduleBgmTone(freq, time, stepDur * 1.45, 'triangle', 0.085);
      this.scheduleBgmTone(freq * 2, time, stepDur * 0.65, 'sine', 0.025);
    }

    // 2. Bouncy bassline
    const bassMidi = LOBBY_BASS[step];
    if (bassMidi !== null) {
      this.scheduleBgmTone(midiToFreq(bassMidi), time, stepDur * 1.6, 'triangle', 0.105);
    }

    // 3. Light warm chord pad stabs
    const chord = LOBBY_CHORDS[step];
    if (chord) {
      for (const note of chord) {
        this.scheduleBgmTone(midiToFreq(note), time, stepDur * 3.8, 'sine', 0.026);
      }
    }

    // 4. Playful party percussion
    const barStep = step % 16;
    if (barStep === 0 || barStep === 8 || barStep === 10) {
      // Soft kick
      this.scheduleBgmTone(125, time, 0.11, 'sine', 0.09, { freqEnd: 45 });
    }
    if (barStep === 4 || barStep === 12) {
      // Woodblock / light snap
      this.scheduleBgmTone(680, time, 0.055, 'triangle', 0.032, { freqEnd: 460 });
      this.scheduleNoiseHit(time, 0.06, 'bandpass', 2400, 0.022);
    }
    if (barStep % 2 === 1) {
      // Light offbeat shaker
      this.scheduleNoiseHit(time, 0.03, 'highpass', 5800, 0.014);
    }
  }

  private scheduleBattleStep(step: number, time: number, stepDur: number): void {
    // 1. Driving filtered saw bass
    const bassMidi = BATTLE_BASS[step];
    if (bassMidi !== null) {
      this.scheduleBgmTone(midiToFreq(bassMidi), time, stepDur * 0.92, 'sawtooth', 0.095, {
        filterFreqStart: 880,
        filterFreqEnd: 200,
      });
    }

    // 2. High-energy 16th-note synth arp
    const arpMidi = BATTLE_ARP[step];
    if (arpMidi !== null) {
      this.scheduleBgmTone(midiToFreq(arpMidi), time, stepDur * 0.72, 'triangle', 0.036);
    }

    // 3. Competitive soaring lead riff
    const leadMidi = BATTLE_LEAD[step];
    if (leadMidi !== null) {
      const freq = midiToFreq(leadMidi);
      this.scheduleBgmTone(freq, time, stepDur * 1.65, 'square', 0.048, {
        filterFreqStart: 2800,
        filterFreqEnd: 1100,
      });
      this.scheduleBgmTone(freq * 1.004, time, stepDur * 1.5, 'sawtooth', 0.026, {
        filterFreqStart: 2600,
        filterFreqEnd: 1000,
      });
    }

    // 4. Punchy four-on-the-floor arcade drums
    const barStep = step % 16;
    if (barStep % 4 === 0) {
      // Driving kick
      this.scheduleBgmTone(150, time, 0.12, 'sine', 0.14, { freqEnd: 42 });
    }
    if (barStep === 4 || barStep === 12) {
      // Snappy snare
      this.scheduleBgmTone(210, time, 0.09, 'triangle', 0.075, { freqEnd: 95 });
      this.scheduleNoiseHit(time, 0.11, 'bandpass', 1900, 0.065);
    }
    if (barStep % 2 === 1) {
      // Crisp hi-hat
      this.scheduleNoiseHit(time, 0.038, 'highpass', 6500, 0.028);
    }
    if (step === 0 || step === 32) {
      // Subtle bar-turn crash cymbal accent
      this.scheduleNoiseHit(time, 0.24, 'highpass', 4200, 0.038);
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
    gain.connect(this.masterNode ?? this.ctx.destination);
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
      case 'nav':
        this.tone(540, 0.045, 'sine', 0.075, 660);
        break;
      case 'confirm':
        this.tone(523.25, 0.06, 'triangle', 0.1);
        this.tone(783.99, 0.11, 'triangle', 0.11, undefined, 0.05);
        break;
    }
  }
}

export const arcadeAudio = new ArcadeAudioEngine();
