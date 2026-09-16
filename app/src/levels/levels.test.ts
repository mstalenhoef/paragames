import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Flight } from '../sim/flight.ts';
import { GridTerrain } from '../sim/terrain.ts';
import type { TerrainMeta } from '../terrain/types.ts';
import { createSetup, LESSONS } from './lessons.ts';
import { SITES } from './sites.ts';

function loadTerrain(id: string): { meta: TerrainMeta; terrain: GridTerrain } {
  const dir = new URL(`../../public/terrain/${id}/`, import.meta.url);
  const meta = JSON.parse(readFileSync(new URL('meta.json', dir), 'utf8')) as TerrainMeta;
  const buffer = readFileSync(new URL(meta.height.file, dir));
  const heights = new Float32Array(meta.height.cols * meta.height.rows);
  for (let i = 0; i < heights.length; i++) heights[i] = buffer.readUInt16LE(i * 2) / 10;
  return { meta, terrain: new GridTerrain(meta.minX, meta.maxY, meta.height.spacing, meta.height.cols, meta.height.rows, heights) };
}

describe.each(SITES)('site $id', (site) => {
  const { meta, terrain } = loadTerrain(site.terrainId);

  it('has its trigger on a kk7 hotspot', () => {
    const hotspot = meta.hotspots.find((h) => Math.hypot(h.x - site.trigger.x, h.y - site.trigger.y) < 10);
    expect(hotspot).toBeDefined();
    expect(Math.abs(hotspot!.elevation - site.trigger.ground)).toBeLessThan(15);
  });

  it('adds weaker thermals at the other hotspots', () => {
    const thermals = createSetup(site, LESSONS[0], 1, meta.hotspots).air.thermals;
    expect(thermals.length).toBeGreaterThan(3);
    const [lesson, ...others] = thermals;
    for (const t of others) {
      expect(Math.hypot(t.x - site.trigger.x, t.y - site.trigger.y)).toBeGreaterThanOrEqual(500);
      expect(t.cores[0].strength).toBeLessThan(lesson.cores[0].strength);
    }
  });

  it.each(LESSONS)('lesson $id starts clear of terrain and is climbable', (lesson) => {
    for (const seed of [1, 2, 3, 42, 1234]) {
      const setup = createSetup(site, lesson, seed, meta.hotspots);
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
