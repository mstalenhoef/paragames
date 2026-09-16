const CLIMB_THRESHOLD = 0.1;
const SINK_THRESHOLD = -2.5;
const VOLUME = 0.12;

/** Beep frequency and interval for a climb rate, following common vario conventions. */
export function beepFor(climbRate: number): { frequency: number; period: number } {
  const w = Math.min(climbRate, 6);
  return {
    frequency: 650 + 140 * w,
    period: Math.max(0.12, 0.55 - 0.075 * w),
  };
}

/**
 * Audio vario: rising beeps in lift, a low continuous tone in strong sink.
 * The AudioContext must be resumed from a user gesture (iOS).
 */
export class VarioSound {
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gain: GainNode | null = null;
  private climbRate = 0;
  private enabled = true;
  private nextBeepTime = 0;
  private timer: number | null = null;

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
    if (this.ctx && this.gain) {
      this.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.01);
    }
  }

  private schedule(): void {
    const ctx = this.ctx;
    const gain = this.gain;
    const osc = this.oscillator;
    if (!ctx || !gain || !osc || !this.enabled || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const w = this.climbRate;

    if (w >= CLIMB_THRESHOLD) {
      const lookahead = 0.1;
      if (this.nextBeepTime < now) this.nextBeepTime = now;
      while (this.nextBeepTime < now + lookahead) {
        const { frequency, period } = beepFor(w);
        const start = this.nextBeepTime;
        const length = period * 0.5;
        osc.frequency.setValueAtTime(frequency, start);
        osc.frequency.linearRampToValueAtTime(frequency * 1.04, start + length);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(VOLUME, start + 0.008);
        gain.gain.setValueAtTime(VOLUME, start + length - 0.01);
        gain.gain.linearRampToValueAtTime(0, start + length);
        this.nextBeepTime = start + period;
      }
    } else if (w <= SINK_THRESHOLD) {
      this.nextBeepTime = 0;
      osc.frequency.setTargetAtTime(Math.max(180, 380 + 40 * w), now, 0.05);
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(VOLUME * 0.5, now, 0.05);
    } else {
      this.nextBeepTime = 0;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, 0.02);
    }
  }
}
