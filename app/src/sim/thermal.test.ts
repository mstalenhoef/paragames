import { describe, expect, it } from 'vitest';
import { Thermal, type ThermalConfig } from './thermal.ts';

const noWind = { x: 0, y: 0 };
const config: ThermalConfig = {
  x: 100,
  y: 200,
  baseAltitude: 1000,
  topAltitude: 2500,
  cores: [{ dx: 0, dy: 0, radius: 40, strength: 3, phase: 0 }],
  sinkRing: 1.5,
  pulsePeriod: 0,
  pulseAmplitude: 0,
};

describe('Thermal', () => {
  const thermal = new Thermal(config);

  it('has its strongest lift in the core', () => {
    const center = thermal.liftAt(100, 200, 1800, 0, noWind);
    expect(center).toBeGreaterThan(2.5);
    expect(thermal.liftAt(130, 200, 1800, 0, noWind)).toBeLessThan(center);
    expect(thermal.liftAt(160, 200, 1800, 0, noWind)).toBeLessThan(thermal.liftAt(130, 200, 1800, 0, noWind));
  });

  it('is surrounded by sinking air', () => {
    let minimum = Infinity;
    for (let d = 0; d < 400; d += 5) minimum = Math.min(minimum, thermal.liftAt(100 + d, 200, 1800, 0, noWind));
    expect(minimum).toBeLessThan(-0.5);
    expect(thermal.liftAt(2000, 200, 1800, 0, noWind)).toBe(0);
  });

  it('fades out below the base and above the top', () => {
    expect(thermal.liftAt(100, 200, 990, 0, noWind)).toBe(0);
    expect(thermal.liftAt(100, 200, 2510, 0, noWind)).toBe(0);
    expect(thermal.liftAt(100, 200, 1050, 0, noWind)).toBeLessThan(thermal.liftAt(100, 200, 1800, 0, noWind));
  });

  it('leans downwind with height', () => {
    const wind = { x: 3, y: 0 };
    const low = thermal.centerAt(1300, wind);
    const high = thermal.centerAt(2000, wind);
    expect(high.x - low.x).toBeCloseTo((700 * 3) / 3, 6);
    expect(thermal.strongestCoreAt(2000, 0, wind).x).toBeCloseTo(high.x, 6);
  });

  it('pulsates when configured', () => {
    const pulsing = new Thermal({ ...config, pulsePeriod: 60, pulseAmplitude: 0.3 });
    const a = pulsing.liftAt(100, 200, 1800, 15, noWind);
    const b = pulsing.liftAt(100, 200, 1800, 45, noWind);
    expect(a / b).toBeGreaterThan(1.5);
  });
});
