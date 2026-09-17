import { describe, expect, it } from 'vitest';
import { moveKeyBrake } from './controls.ts';

describe('moveKeyBrake', () => {
  it('pulls while the pull key is held and stays put afterwards', () => {
    let brake = 0;
    for (let i = 0; i < 60; i++) brake = moveKeyBrake(brake, true, false, 1 / 120);
    expect(brake).toBeCloseTo(0.4);
    for (let i = 0; i < 600; i++) brake = moveKeyBrake(brake, false, false, 1 / 120);
    expect(brake).toBeCloseTo(0.4);
  });

  it('releases with the release key and clamps to the brake range', () => {
    expect(moveKeyBrake(0.4, false, true, 0.25)).toBeCloseTo(0.2);
    expect(moveKeyBrake(0.1, false, true, 1)).toBe(0);
    expect(moveKeyBrake(0.9, true, false, 1)).toBe(1);
    expect(moveKeyBrake(0.5, true, true, 1)).toBe(0.5);
  });
});
