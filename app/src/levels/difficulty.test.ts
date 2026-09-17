import { describe, expect, it } from 'vitest';
import { Flight, type FlightSetup } from '../sim/flight.ts';
import { DEFAULT_GLIDER, turnRadius } from '../sim/glider.ts';
import { FlatTerrain } from '../sim/terrain.ts';
import { Thermal } from '../sim/thermal.ts';
import { DIFFICULTIES, findDifficulty } from './difficulty.ts';
import { createSetup, LESSONS } from './lessons.ts';
import { SITES } from './sites.ts';

const [easy, medium, hard] = DIFFICULTIES;
const setupFor = (difficulty = hard, seed = 7) => createSetup(SITES[0], LESSONS[0], seed, [], difficulty);

describe('difficulty', () => {
  it('keeps hard identical to the base thermal settings', () => {
    const thermal = setupFor(hard).air.thermals[0];
    expect(thermal.falloff).toBe(2);
    expect(thermal.sinkRing).toBeGreaterThan(0.9);
  });

  it('makes easy thermals three times wider without a sink ring', () => {
    const hardThermal = setupFor(hard).air.thermals[0];
    const easyThermal = setupFor(easy).air.thermals[0];
    expect(easyThermal.sinkRing).toBe(0);
    easyThermal.cores.forEach((core, i) => expect(core.radius).toBeCloseTo(hardThermal.cores[i].radius * 3));
    expect(easyThermal.x).toBe(hardThermal.x);
    expect(easyThermal.cores[0].strength).toBeLessThan(hardThermal.cores[0].strength);
  });

  it('puts medium between easy and hard', () => {
    expect(medium.radiusScale).toBeGreaterThan(hard.radiusScale);
    expect(medium.radiusScale).toBeLessThan(easy.radiusScale);
    expect(medium.sinkRingScale).toBeGreaterThan(easy.sinkRingScale);
    expect(medium.sinkRingScale).toBeLessThan(hard.sinkRingScale);
    expect(medium.falloff).toBeGreaterThan(easy.falloff);
    expect(medium.falloff).toBeLessThan(hard.falloff);
  });

  it('never has sinking air around an easy thermal', () => {
    const thermal = new Thermal(setupFor(easy).air.thermals[0]);
    const { x, y } = thermal.config;
    for (let d = 0; d < 1500; d += 10) expect(thermal.liftAt(x + d, y, 1800, 0, { x: 0, y: 0 })).toBeGreaterThanOrEqual(0);
  });

  it('drops off more gradually toward the edge on easier levels', () => {
    // Relative lift at twice the (scaled) core radius, single round core.
    const relativeLift = (level = hard) => {
      const base = setupFor(level).air.thermals[0];
      const config = { ...base, cores: [base.cores[0]], sinkRing: 0 };
      const thermal = new Thermal(config);
      const center = thermal.liftAt(config.x, config.y, 1990, 0, { x: 0, y: 0 });
      const r = config.cores[0].radius;
      return thermal.liftAt(config.x + 2 * r, config.y, 1990, 0, { x: 0, y: 0 }) / center;
    };
    expect(relativeLift(easy)).toBeGreaterThan(relativeLift(medium));
    expect(relativeLift(medium)).toBeGreaterThan(relativeLift(hard));
  });

  it('forgives an off-center circle more on easier levels', () => {
    const lossWhenOffCenter = (level = hard) => {
      const climb = (offset: number) => {
        const setup = setupFor(level);
        const probe = new Flight(setup, new FlatTerrain(0));
        const core = probe.thermals[0].strongestCoreAt(1700, 0, setup.air.wind);
        const flight = new Flight({ ...setup, goalAltitude: 9999, start: { x: core.x - 19 + offset, y: core.y, z: 1700, heading: 0 } }, new FlatTerrain(0));
        for (let i = 0; i < 120 * 60; i++) flight.step({ left: 0, right: 0.6 });
        return (flight.glider.z - 1700) / 60;
      };
      return climb(0) - climb(60);
    };
    expect(lossWhenOffCenter(easy)).toBeLessThan(lossWhenOffCenter(medium));
    expect(lossWhenOffCenter(medium)).toBeLessThan(lossWhenOffCenter(hard));
  });

  it.each([
    { lesson: 0, seed: 1 },
    { lesson: 1, seed: 42 },
    { lesson: 2, seed: 1234 },
  ])('does not climb faster than hard when circling optimally (lesson $lesson, seed $seed)', ({ lesson, seed }) => {
    const hardBest = bestSimulatedClimb(createSetup(SITES[0], LESSONS[lesson], seed, [], hard));
    for (const level of [easy, medium]) {
      const best = bestSimulatedClimb(createSetup(SITES[0], LESSONS[lesson], seed, [], level));
      expect(best).toBeLessThanOrEqual(hardBest + 0.1);
      expect(best).toBeGreaterThan(hardBest - 0.35);
    }
  });

  it('falls back to medium for unknown values', () => {
    expect(findDifficulty(undefined).id).toBe('medium');
    expect(findDifficulty('extreme').id).toBe('medium');
  });
});

/** Best climb rate over a range of one-sided brake positions and circle centers near the strongest core. */
function bestSimulatedClimb(base: FlightSetup): number {
  const setup = { ...base, goalAltitude: 9999 };
  const core = new Flight(setup, new FlatTerrain(0)).thermals[0].strongestCoreAt(1990, 0, setup.air.wind);
  let best = -Infinity;
  for (let brake = 0.25; brake <= 0.95; brake += 0.1) {
    const r = turnRadius(DEFAULT_GLIDER.trimSpeed, brake * DEFAULT_GLIDER.maxBank);
    for (let ox = -60; ox <= 60; ox += 20) {
      for (let oy = -60; oy <= 60; oy += 20) {
        const flight = new Flight({ ...setup, start: { x: core.x + ox - r, y: core.y + oy, z: 1990, heading: 0 } }, new FlatTerrain(0));
        for (let i = 0; i < 120 * 10; i++) flight.step({ left: 0, right: brake });
        const z0 = flight.glider.z;
        for (let i = 0; i < 120 * 30; i++) flight.step({ left: 0, right: brake });
        best = Math.max(best, (flight.glider.z - z0) / 30);
      }
    }
  }
  return best;
}
