import { describe, expect, it } from 'vitest';
import { createGlider, stepGlider, turnRadius, DEFAULT_GLIDER, type AirSample, type Controls } from './glider.ts';
import { deg } from './math.ts';

const stillAir: AirSample = { wind: { x: 0, y: 0 }, verticalAirSpeed: () => 0 };

function fly(controls: Controls, seconds: number, dt: number, air = stillAir) {
  let s = createGlider(0, 0, 1000, 0);
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) s = stepGlider(s, controls, air, dt);
  return s;
}

describe('stepGlider', () => {
  it('flies straight at trim speed and sinks without brakes', () => {
    const s = fly({ left: 0, right: 0 }, 10, 1 / 120);
    expect(s.y).toBeCloseTo(DEFAULT_GLIDER.trimSpeed * 10, 3);
    expect(s.x).toBeCloseTo(0, 6);
    expect(s.sinkRate).toBeGreaterThan(1);
    expect(s.z).toBeCloseTo(1000 - s.sinkRate * 10, 3);
  });

  it('turns right with right brake and left with left brake', () => {
    expect(fly({ left: 0, right: 0.5 }, 2, 1 / 120).bank).toBeGreaterThan(0);
    expect(fly({ left: 0.5, right: 0 }, 2, 1 / 120).bank).toBeLessThan(0);
  });

  it('sinks more and turns tighter at steeper bank', () => {
    const shallow = fly({ left: 0, right: 0.4 }, 10, 1 / 120);
    const steep = fly({ left: 0, right: 1 }, 10, 1 / 120);
    expect(steep.sinkRate).toBeGreaterThan(shallow.sinkRate * 1.5);
    expect(turnRadius(steep.airspeed, steep.bank)).toBeLessThan(turnRadius(shallow.airspeed, shallow.bank) / 2);
  });

  it('describes a circle with the theoretical turn radius', () => {
    let s = createGlider(0, 0, 1000, 0);
    const controls = { left: 0, right: 0.6 };
    for (let i = 0; i < 120 * 10; i++) s = stepGlider(s, controls, stillAir, 1 / 120);
    const r = turnRadius(s.airspeed, s.bank);
    expect(s.bank).toBeCloseTo(0.6 * DEFAULT_GLIDER.maxBank, 3);
    const center = { x: s.x + Math.cos(s.heading) * r, y: s.y - Math.sin(s.heading) * r };
    let maxError = 0;
    for (let i = 0; i < 120 * 30; i++) {
      s = stepGlider(s, controls, stillAir, 1 / 120);
      maxError = Math.max(maxError, Math.abs(Math.hypot(s.x - center.x, s.y - center.y) - r));
    }
    expect(maxError).toBeLessThan(0.2);
  });

  it('gives the same result at different time steps', () => {
    const controls = { left: 0.1, right: 0.7 };
    const a = fly(controls, 20, 1 / 60);
    const b = fly(controls, 20, 1 / 240);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1);
    expect(Math.abs(a.z - b.z)).toBeLessThan(0.2);
  });

  it('drifts with the wind and climbs in rising air', () => {
    const air: AirSample = { wind: { x: 3, y: 0 }, verticalAirSpeed: () => 2 };
    const s = fly({ left: 0, right: 0 }, 10, 1 / 120, air);
    expect(s.x).toBeCloseTo(30, 3);
    expect(s.climbRate).toBeCloseTo(2 - s.sinkRate, 6);
    expect(s.z).toBeGreaterThan(1000);
  });

  it('limits bank to the maximum', () => {
    expect(fly({ left: 0, right: 5 }, 10, 1 / 120).bank).toBeLessThanOrEqual(DEFAULT_GLIDER.maxBank + 1e-9);
    expect(DEFAULT_GLIDER.maxBank).toBeCloseTo(deg(50));
  });
});
