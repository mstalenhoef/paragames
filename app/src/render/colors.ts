/** Diverging color scale for vertical speed: blue for sink, white around zero, yellow to red for lift. */
const STOPS: [number, [number, number, number]][] = [
  [-3, [38, 70, 150]],
  [-1.2, [90, 150, 215]],
  [0, [240, 240, 235]],
  [1, [255, 214, 70]],
  [2.2, [255, 140, 30]],
  [3.5, [210, 35, 55]],
];

export function climbColorRgb(w: number): [number, number, number] {
  if (w <= STOPS[0][0]) return STOPS[0][1];
  for (let i = 1; i < STOPS.length; i++) {
    const [w1, c1] = STOPS[i];
    if (w <= w1) {
      const [w0, c0] = STOPS[i - 1];
      const f = (w - w0) / (w1 - w0);
      return [c0[0] + (c1[0] - c0[0]) * f, c0[1] + (c1[1] - c0[1]) * f, c0[2] + (c1[2] - c0[2]) * f];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export function climbColor(w: number): number {
  const [r, g, b] = climbColorRgb(w);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

export function climbColorCss(w: number): string {
  const [r, g, b] = climbColorRgb(w);
  return `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
}
