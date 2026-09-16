import { describe, expect, it } from 'vitest';
import { FixedStepper, Flight, type FlightSetup } from './flight.ts';
import { FlatTerrain } from './terrain.ts';

const thermalSetup = (overrides: Partial<FlightSetup> = {}): FlightSetup => ({
  start: { x: 0, y: 0, z: 1500, heading: 0 },
  goalAltitude: 2400,
  air: {
    wind: { x: 0, y: 0 },
    ambient: -0.1,
    thermals: [
      {
        x: 0,
        y: 0,
        baseAltitude: 1000,
        topAltitude: 2600,
        cores: [{ dx: 0, dy: 0, radius: 40, strength: 3, phase: 0 }],
        sinkRing: 1.5,
        pulsePeriod: 0,
        pulseAmplitude: 0,
      },
    ],
  },
  ...overrides,
});

/** Circles for a while and returns the altitude change. */
function circle(setup: FlightSetup, brake: number, seconds: number): number {
  const flight = new Flight(setup, new FlatTerrain(800));
  for (let i = 0; i < seconds * 120; i++) flight.step({ left: 0, right: brake });
  return flight.glider.z - setup.start.z;
}

describe('Flight', () => {
  it('climbs when circling close to the core', () => {
    // Start offset so that the circle (radius ~20 m) is centered on the core.
    const setup = thermalSetup({ start: { x: -20, y: 0, z: 1500, heading: 0 } });
    expect(circle(setup, 0.6, 60)).toBeGreaterThan(20);
  });

  it('climbs less when the circle is off-center', () => {
    const centered = circle(thermalSetup({ start: { x: -20, y: 0, z: 1500, heading: 0 } }), 0.6, 60);
    const offCenter = circle(thermalSetup({ start: { x: -80, y: 0, z: 1500, heading: 0 } }), 0.6, 60);
    expect(offCenter).toBeLessThan(centered - 30);
  });

  it('lands when reaching the ground', () => {
    const flight = new Flight(thermalSetup({ start: { x: 3000, y: 0, z: 850, heading: Math.PI / 2 } }), new FlatTerrain(800, 10000));
    for (let i = 0; i < 120 * 120 && flight.status === 'flying'; i++) flight.step({ left: 0, right: 0 });
    expect(flight.status).toBe('landed');
    expect(flight.glider.z).toBe(800);
  });

  it('reaches the goal altitude', () => {
    const flight = new Flight(thermalSetup({ goalAltitude: 1510, start: { x: -20, y: 0, z: 1500, heading: 0 } }), new FlatTerrain(800));
    for (let i = 0; i < 120 * 120 && flight.status === 'flying'; i++) flight.step({ left: 0, right: 0.6 });
    expect(flight.status).toBe('goal');
  });

  it('ends when leaving the map', () => {
    const flight = new Flight(thermalSetup({ start: { x: 0, y: 950, z: 1500, heading: 0 } }), new FlatTerrain(800, 1000));
    for (let i = 0; i < 120 * 30 && flight.status === 'flying'; i++) flight.step({ left: 0, right: 0 });
    expect(flight.status).toBe('outOfMap');
  });

  it('records a trail and filters the vario', () => {
    const flight = new Flight(thermalSetup({ start: { x: -20, y: 0, z: 1500, heading: 0 } }), new FlatTerrain(800));
    for (let i = 0; i < 120 * 10; i++) flight.step({ left: 0, right: 0.6 });
    expect(flight.trail.length).toBeGreaterThanOrEqual(20);
    expect(Math.abs(flight.vario - flight.glider.climbRate)).toBeLessThan(1);
  });
});

describe('FixedStepper', () => {
  it('runs the same number of steps regardless of frame rate', () => {
    const count = (fps: number) => {
      const stepper = new FixedStepper(1 / 120);
      let steps = 0;
      for (let i = 0; i < fps * 2; i++) stepper.advance(1 / fps, () => steps++);
      return steps;
    };
    expect(Math.abs(count(60) - count(144))).toBeLessThanOrEqual(1);
    expect(Math.abs(count(60) - 240)).toBeLessThanOrEqual(1);
  });
});
