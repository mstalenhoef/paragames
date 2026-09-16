import { describe, expect, it } from 'vitest';
import { GridTerrain } from './terrain.ts';

describe('GridTerrain', () => {
  // 3x2 grid, spacing 10, north row first.
  const terrain = new GridTerrain(0, 10, 10, 3, 2, new Float32Array([100, 200, 300, 0, 100, 200]));

  it('computes its extent', () => {
    expect([terrain.minX, terrain.maxX, terrain.minY, terrain.maxY]).toEqual([0, 20, 0, 10]);
  });

  it('interpolates bilinearly with row 0 in the north', () => {
    expect(terrain.elevationAt(0, 10)).toBe(100);
    expect(terrain.elevationAt(0, 0)).toBe(0);
    expect(terrain.elevationAt(5, 5)).toBeCloseTo(100);
    expect(terrain.elevationAt(20, 10)).toBe(300);
  });

  it('clamps outside the grid', () => {
    expect(terrain.elevationAt(-50, 50)).toBe(100);
    expect(terrain.contains(-1, 5)).toBe(false);
  });
});
