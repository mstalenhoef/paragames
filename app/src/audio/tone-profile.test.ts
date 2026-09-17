import { describe, expect, it } from 'vitest';
import profileText from './Skytraxx.vtp?raw';
import { parseToneProfile, sampleCurve, toneFor, varioTone } from './tone-profile.ts';

describe('tone profile', () => {
  const profile = parseToneProfile(profileText);
  const thresholds = { climb: 0.1, sink: -2.5 };

  it('interpolates linearly and clamps at the ends', () => {
    const curve = [
      { climb: 0, value: 100 },
      { climb: 2, value: 300 },
    ];
    expect(sampleCurve(curve, 1)).toBe(200);
    expect(sampleCurve(curve, -5)).toBe(100);
    expect(sampleCurve(curve, 9)).toBe(300);
  });

  it('treats duplicate climb rates as a step', () => {
    const curve = [
      { climb: -1, value: 1 },
      { climb: -0.5, value: 1 },
      { climb: -0.5, value: 0.05 },
      { climb: 1, value: 0.05 },
    ];
    expect(sampleCurve(curve, -0.51)).toBe(1);
    expect(sampleCurve(curve, -0.5)).toBe(0.05);
    expect(sampleCurve(curve, 0)).toBe(0.05);
  });

  it('reads Skytraxx.vtp without a gain curve', () => {
    expect(profile.gain).toBeUndefined();
    const climbing = toneFor(profile, 2);
    expect(climbing.frequency).toBeGreaterThan(843);
    expect(climbing.frequency).toBeLessThan(907);
    expect(climbing.dutyCycle).toBeGreaterThan(0.36);
    expect(climbing.dutyCycle).toBeLessThan(0.4);
    expect(climbing.gain).toBe(1);
    // Negative durations in the sink range become a usable period; duty cycle 1 makes it continuous anyway.
    expect(toneFor(profile, -8).period).toBeGreaterThan(0);
    expect(toneFor(profile, -3).dutyCycle).toBe(1);
  });

  it('is silent between the sink and climb thresholds', () => {
    expect(varioTone(profile, 0.09, thresholds)).toBeNull();
    expect(varioTone(profile, -1.2, thresholds)).toBeNull();
    expect(varioTone(profile, -2.49, thresholds)).toBeNull();
    expect(varioTone(profile, 0.1, thresholds)?.dutyCycle).toBeLessThan(1);
    expect(varioTone(profile, -2.5, thresholds)?.dutyCycle).toBe(1);
  });

  it('accepts duty cycles in percent and rejects invalid profiles', () => {
    const percent = parseToneProfile(
      JSON.stringify({ version: 1, frequency: [{ climb: 0, value: 700 }], duration: [{ climb: 0, value: 500 }], dutycycle: [{ climb: 0, value: 50 }] }),
    );
    expect(toneFor(percent, 0).dutyCycle).toBe(0.5);
    expect(() => parseToneProfile('{"version": 2}')).toThrow(/version/);
    expect(() => parseToneProfile('{"version": 1, "frequency": []}')).toThrow(/frequency/);
  });
});
