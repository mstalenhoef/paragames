import defaultProfileText from './Skytraxx.vtp?raw';
import { parseToneProfile, varioTone, type ToneProfile, type VarioThresholds } from './tone-profile.ts';

const VOLUME = 0.12;
/** How far ahead beeps are scheduled; the scheduler runs every 25 ms. */
const LOOKAHEAD = 0.1;
const MIN_BEEP_LENGTH = 0.02;
const EDGE_RAMP = 0.005;
const DEFAULT_THRESHOLDS: VarioThresholds = { climb: 0.1, sink: -2.5 };

/**
 * Audio vario driven by a tone profile (.vtp): beeps whose pitch, rate and length follow
 * the climb rate, or a continuous tone where the profile's duty cycle is 1.
 * Silent between the sink and climb thresholds.
 * The AudioContext must be resumed from a user gesture (iOS).
 */
export class VarioSound {
  private readonly profile: ToneProfile;
  private readonly thresholds: VarioThresholds;
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private climbRate = 0;
  private enabled = true;
  private continuous = false;
  private nextBeepTime = 0;
  private timer: number | null = null;

  constructor(profile: ToneProfile = parseToneProfile(defaultProfileText), thresholds: VarioThresholds = DEFAULT_THRESHOLDS) {
    this.profile = profile;
    this.thresholds = thresholds;
  }

  /** Call from a user gesture handler. */
  async unlock(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.ctx.destination);
      this.oscillator = this.ctx.createOscillator();
      this.oscillator.type = 'triangle';
      this.oscillator.connect(this.gain);
      this.oscillator.start();
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.silence();
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.silence();
  }

  update(climbRate: number): void {
    this.climbRate = climbRate;
  }

  private silence(): void {
    if (this.ctx && this.gain && this.oscillator) {
      const now = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setTargetAtTime(0, now, 0.01);
      this.oscillator.frequency.cancelScheduledValues(now);
    }
    this.continuous = false;
    this.nextBeepTime = 0;
  }

  private schedule(): void {
    const ctx = this.ctx;
    const gain = this.gain?.gain;
    const frequency = this.oscillator?.frequency;
    if (!ctx || !gain || !frequency || !this.enabled || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const tone = varioTone(this.profile, this.climbRate, this.thresholds);

    if (!tone) {
      if (this.continuous) {
        this.continuous = false;
        gain.cancelScheduledValues(now);
        frequency.cancelScheduledValues(now);
        gain.setTargetAtTime(0, now, EDGE_RAMP);
      }
      // Scheduled beeps play out; the next one starts as soon as the climb threshold is reached.
      if (this.nextBeepTime < now) this.nextBeepTime = 0;
      return;
    }
    const level = VOLUME * tone.gain;

    if (tone.dutyCycle >= 0.999) {
      if (!this.continuous) {
        // Drop beeps that were scheduled ahead and switch to a steady tone.
        gain.cancelScheduledValues(now);
        frequency.cancelScheduledValues(now);
        this.continuous = true;
      }
      frequency.setTargetAtTime(tone.frequency, now, 0.02);
      gain.setTargetAtTime(level, now, 0.01);
      return;
    }

    if (this.continuous) {
      this.continuous = false;
      gain.cancelScheduledValues(now);
      frequency.cancelScheduledValues(now);
      gain.setTargetAtTime(0, now, EDGE_RAMP);
      this.nextBeepTime = now + 4 * EDGE_RAMP;
    }
    if (this.nextBeepTime < now) this.nextBeepTime = now;

    while (this.nextBeepTime < now + LOOKAHEAD) {
      const start = this.nextBeepTime;
      const length = Math.max(MIN_BEEP_LENGTH, tone.period * tone.dutyCycle);
      const ramp = Math.min(EDGE_RAMP, length / 4);
      frequency.setValueAtTime(tone.frequency, start);
      gain.setValueAtTime(0, start);
      gain.linearRampToValueAtTime(level, start + ramp);
      gain.setValueAtTime(level, start + length - ramp);
      gain.linearRampToValueAtTime(0, start + length);
      this.nextBeepTime = start + Math.max(tone.period, length + MIN_BEEP_LENGTH);
    }
  }
}
