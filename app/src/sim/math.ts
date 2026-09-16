export const G = 9.81;

export interface Vec2 {
  x: number;
  y: number;
}

export const deg = (degrees: number): number => (degrees * Math.PI) / 180;
export const toDeg = (radians: number): number => (radians * 180) / Math.PI;

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = clamp((v - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Normalizes an angle to [0, 2π). */
export function wrapAngle(a: number): number {
  const tau = Math.PI * 2;
  return ((a % tau) + tau) % tau;
}

/** Unit vector for a compass heading (0 = north, clockwise). */
export const headingVector = (heading: number): Vec2 => ({ x: Math.sin(heading), y: Math.cos(heading) });

/** Deterministic PRNG (mulberry32), so a flight can be replayed from its seed. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
