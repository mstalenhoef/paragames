/**
 * Vario tone profile (.vtp): curves over climb rate (m/s) for frequency (Hz),
 * cycle duration (ms), duty cycle (0..1, 1 = continuous tone) and optionally gain (0..1).
 * Values are interpolated linearly; two points with the same climb rate form a step.
 */
export interface CurvePoint {
  climb: number;
  value: number;
}

export interface ToneProfile {
  version: 1;
  frequency: CurvePoint[];
  duration: CurvePoint[];
  dutycycle: CurvePoint[];
  /** Missing in some profiles (e.g. Skytraxx); defaults to full volume. */
  gain?: CurvePoint[];
}

/** Climb rates between the thresholds are silent, like the audio thresholds on a real vario. */
export interface VarioThresholds {
  /** Beeping starts at this climb rate (m/s). */
  climb: number;
  /** The sink tone starts at this climb rate (m/s, negative). */
  sink: number;
}

export interface Tone {
  frequency: number;
  /** Length of one beep cycle in seconds. */
  period: number;
  dutyCycle: number;
  gain: number;
}

const REQUIRED_CURVES = ['frequency', 'duration', 'dutycycle'] as const;
/** Shortest usable beep cycle; some profiles contain zero or negative durations in the continuous-tone range. */
const MIN_PERIOD = 0.05;

export function parseToneProfile(text: string): ToneProfile {
  const data = JSON.parse(text) as Partial<ToneProfile>;
  if (data.version !== 1) throw new Error(`unsupported tone profile version: ${String(data.version)}`);
  for (const name of [...REQUIRED_CURVES, 'gain'] as const) {
    const points = data[name];
    if (name === 'gain' && points === undefined) continue;
    if (!Array.isArray(points) || points.length === 0) throw new Error(`tone profile: missing curve "${name}"`);
    for (let i = 0; i < points.length; i++) {
      if (!Number.isFinite(points[i].climb) || !Number.isFinite(points[i].value)) throw new Error(`tone profile: invalid point in "${name}"`);
      if (i > 0 && points[i].climb < points[i - 1].climb) throw new Error(`tone profile: "${name}" is not sorted by climb`);
    }
  }
  // Duty cycles are fractions; accept profiles that store them as 0..100.
  if (data.dutycycle!.some((p) => p.value > 1)) data.dutycycle = data.dutycycle!.map((p) => ({ ...p, value: p.value / 100 }));
  return data as ToneProfile;
}

/** Piecewise linear lookup, clamped at both ends. At a step, the later point wins. */
export function sampleCurve(points: readonly CurvePoint[], climb: number): number {
  if (climb <= points[0].climb) return points[0].value;
  const last = points[points.length - 1];
  if (climb >= last.climb) return last.value;
  let i = 0;
  while (i + 1 < points.length && points[i + 1].climb <= climb) i++;
  const a = points[i];
  const b = points[i + 1];
  return a.value + ((b.value - a.value) * (climb - a.climb)) / (b.climb - a.climb);
}

export function toneFor(profile: ToneProfile, climb: number): Tone {
  return {
    frequency: sampleCurve(profile.frequency, climb),
    period: Math.max(MIN_PERIOD, sampleCurve(profile.duration, climb) / 1000),
    dutyCycle: Math.min(1, Math.max(0, sampleCurve(profile.dutycycle, climb))),
    gain: profile.gain ? Math.min(1, Math.max(0, sampleCurve(profile.gain, climb))) : 1,
  };
}

/** Tone for a climb rate, or null when it lies in the silent band between the thresholds. */
export function varioTone(profile: ToneProfile, climb: number, thresholds: VarioThresholds): Tone | null {
  if (climb < thresholds.climb && climb > thresholds.sink) return null;
  return toneFor(profile, climb);
}
