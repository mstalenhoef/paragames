import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Flight } from '../sim/flight.ts';
import { GridTerrain } from '../sim/terrain.ts';
import type { TerrainMeta } from '../terrain/types.ts';
import { createSetup, LESSONS } from './lessons.ts';
import { SITES } from './sites.ts';

function loadTerrain(id: string): GridTerrain {
  const dir = new URL(`../../public/terrain/${id}/`, import.meta.url);
  const meta = JSON.parse(readFileSync(new URL('meta.json', dir), 'utf8')) as TerrainMeta;
  const buffer = readFileSync(new URL(meta.height.file, dir));
  const heights = new Float32Array(meta.height.cols * meta.height.rows);
  for (let i = 0; i < heights.length; i++) heights[i] = buffer.readUInt16LE(i * 2) / 10;
  return new GridTerrain(meta.minX, meta.maxY, meta.height.spacing, meta.height.cols, meta.height.rows, heights);
}

describe.each(SITES)('site $id', (site) => {
  const terrain = loadTerrain(site.terrainId);

  it('has its trigger on the ground and inside the map', () => {
    expect(terrain.contains(site.trigger.x, site.trigger.y)).toBe(true);
    expect(Math.abs(terrain.elevationAt(site.trigger.x, site.trigger.y) - site.trigger.ground)).toBeLessThan(15);
  });

  it.each(LESSONS)('lesson $id starts clear of terrain and is climbable', (lesson) => {
    for (const seed of [1, 2, 3, 42, 1234]) {
      const setup = createSetup(site, lesson, seed);
      const { start } = setup;
      expect(start.z - terrain.elevationAt(start.x, start.y)).toBeGreaterThan(200);
      expect(setup.goalAltitude).toBeLessThan(setup.air.thermals[0].topAltitude - 300);

      // The straight line to the thermal must stay above the ground (glide at trim sink ~1.1 m/s).
      for (let f = 0; f <= 1; f += 0.05) {
        const x = start.x + (site.trigger.x - start.x) * f;
        const y = start.y + (site.trigger.y - start.y) * f;
        const glideLoss = (f * 320 * 1.2) / 10.5;
        expect(start.z - glideLoss - terrain.elevationAt(x, y)).toBeGreaterThan(100);
      }

      const flight = new Flight(setup, terrain);
      const core = flight.thermals[0].strongestCoreAt(start.z, 0, setup.air.wind);
      expect(flight.verticalAirSpeed(core.x, core.y, start.z, 0)).toBeGreaterThan(2);
    }
  });
});

it('produces different thermals for different seeds', () => {
  const a = createSetup(SITES[0], LESSONS[2], 1).air.thermals[0];
  const b = createSetup(SITES[0], LESSONS[2], 2).air.thermals[0];
  expect(a).not.toEqual(b);
});
