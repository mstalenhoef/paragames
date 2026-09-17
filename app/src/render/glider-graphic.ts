import type { Graphics } from 'pixi.js';

export type GliderDesignId = 'ice' | 'dream' | 'sunset';

/** Colour schemes of the Swing Serac RS, as seen from above. */
export interface GliderDesign {
  id: GliderDesignId;
  name: string;
  /** Top surface. */
  main: number;
  /** Leading-edge band and the swoosh on each half. */
  accent: number;
  /** Band along the trailing edge. */
  trailing: number;
}

export const GLIDER_DESIGNS: GliderDesign[] = [
  { id: 'ice', name: 'Ice', main: 0xe8e8e4, accent: 0xd81a1a, trailing: 0xe8e8e4 },
  { id: 'dream', name: 'Dream', main: 0x88cc1c, accent: 0x1d6296, trailing: 0xe4e4de },
  { id: 'sunset', name: 'Sunset', main: 0xd8692a, accent: 0x1d6296, trailing: 0xe4e4de },
];

export const DEFAULT_GLIDER_DESIGN: GliderDesignId = 'ice';

export const findGliderDesign = (id: string | undefined): GliderDesign =>
  GLIDER_DESIGNS.find((d) => d.id === id) ?? GLIDER_DESIGNS.find((d) => d.id === DEFAULT_GLIDER_DESIGN)!;

// Serac RS planform in screen pixels: projected span ≈ 3,5 × root chord, 42 cells.
const SPAN = 54;
const ROOT_CHORD = 16;
const TIP_CHORD = 0.3;
const CELLS = 42;
const SAMPLES = 24;
const OUTLINE = 0x1a1a1a;

/** Chord at span position x (px): elliptical with a blunt tip. */
function chord(x: number): number {
  const u = Math.min(1, Math.abs((2 * x) / SPAN));
  return ROOT_CHORD * (TIP_CHORD + (1 - TIP_CHORD) * Math.sqrt(1 - u * u));
}

/** Leading edge y (px, nose up = negative), slightly swept back toward the tips. */
function leadingEdge(x: number): number {
  const u = Math.min(1, Math.abs((2 * x) / SPAN));
  return -ROOT_CHORD * 0.45 + ROOT_CHORD * 0.35 * (1 - Math.sqrt(1 - u * u));
}

/** Point at span position x and chord fraction f (0 = leading edge, 1 = trailing edge). */
const at = (x: number, f: number): [number, number] => [x, leadingEdge(x) + f * chord(x)];

/** Span-wise band between two chord fractions over the whole wing. */
function bandPoints(f1: number, f2: number): number[] {
  const front: number[] = [];
  const back: number[] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const x = -SPAN / 2 + (SPAN * i) / SAMPLES;
    front.push(...at(x, f1));
    const xb = SPAN / 2 - (SPAN * i) / SAMPLES;
    back.push(...at(xb, f2));
  }
  return [...front, ...back];
}

/** Tapering stroke along a path of [x, f] points given as a function of t (0..1). */
function taperedStroke(path: (t: number) => [number, number], width: (t: number) => number, steps = 12): number[] {
  const left: number[] = [];
  const right: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const [x, f] = path(t);
    const [px, py] = at(x, f);
    const [nx, ny] = at(...path(Math.min(1, t + 0.01)));
    const [ox, oy] = at(...path(Math.max(0, t - 0.01)));
    // Normal to the path direction.
    const dx = nx - ox;
    const dy = ny - oy;
    const len = Math.hypot(dx, dy) || 1;
    const w = width(t) / 2;
    left.push(px - (dy / len) * w, py + (dx / len) * w);
    right.unshift(px + (dy / len) * w, py - (dx / len) * w);
  }
  return [...left, ...right];
}

/** Draws a Swing Serac RS seen from above, nose pointing up, centred on the wing. */
export function drawGlider(g: Graphics, design: GliderDesign): void {
  g.clear();

  // Heading pointer ahead of the wing.
  const nose = leadingEdge(0);
  g.poly([0, nose - 12, -5, nose - 4, 5, nose - 4]).fill({ color: 0xffffff, alpha: 0.9 }).stroke({ width: 1, color: OUTLINE });

  // Pilot, hanging below and slightly behind the wing.
  g.circle(0, nose + ROOT_CHORD + 3, 3).fill({ color: 0x1e3a8a }).stroke({ width: 1, color: 0xffffff });

  const outline = bandPoints(0, 1);
  g.poly(outline).fill({ color: design.main });
  g.poly(bandPoints(0.78, 1)).fill({ color: design.trailing });
  g.poly(bandPoints(0, 0.22)).fill({ color: design.accent });
  g.poly(bandPoints(0.22, 0.29)).fill({ color: OUTLINE });

  for (const side of [-1, 1]) {
    // Swoosh running toward the tip just behind the leading-edge stripes: thin start, widest early, pointed end…
    g.poly(
      taperedStroke(
        (t) => [side * SPAN * (0.08 + 0.39 * t), 0.4 + 0.06 * t],
        (t) => 3 * (t < 0.2 ? 0.2 + (0.8 * t) / 0.2 : 1 - (0.9 * (t - 0.2)) / 0.8),
      ),
    ).fill({ color: design.accent });
    // …with a branch curving back toward the trailing edge.
    g.poly(
      taperedStroke(
        (t) => [side * SPAN * (0.15 + 0.15 * t), 0.43 + 0.45 * t ** 1.4],
        (t) => 2.4 * (1 - 0.85 * t),
      ),
    ).fill({ color: design.accent });
  }

  // Cell ribs (every third of the 42 cells).
  for (let cell = 3; cell < CELLS; cell += 3) {
    const x = -SPAN / 2 + (SPAN * cell) / CELLS;
    g.moveTo(...at(x, 0.02)).lineTo(...at(x, 0.98)).stroke({ width: 0.6, color: OUTLINE, alpha: 0.18 });
  }

  g.poly(outline).stroke({ width: 1.2, color: OUTLINE, alpha: 0.85, join: 'round' });
}
