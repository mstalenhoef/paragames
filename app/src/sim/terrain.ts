export interface Terrain {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  /** Ground elevation in meters above sea level. */
  elevationAt(x: number, y: number): number;
  contains(x: number, y: number): boolean;
}

/** Regular elevation grid, row 0 at the northern edge (maxY). */
export class GridTerrain implements Terrain {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  private readonly spacing: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly heights: Float32Array;

  constructor(minX: number, maxY: number, spacing: number, cols: number, rows: number, heights: Float32Array) {
    if (heights.length !== cols * rows) throw new Error('height grid size mismatch');
    this.minX = minX;
    this.maxY = maxY;
    this.spacing = spacing;
    this.cols = cols;
    this.rows = rows;
    this.heights = heights;
    this.maxX = minX + (cols - 1) * spacing;
    this.minY = maxY - (rows - 1) * spacing;
  }

  contains(x: number, y: number): boolean {
    return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
  }

  elevationAt(x: number, y: number): number {
    const fc = Math.min(Math.max((x - this.minX) / this.spacing, 0), this.cols - 1);
    const fr = Math.min(Math.max((this.maxY - y) / this.spacing, 0), this.rows - 1);
    const c0 = Math.min(Math.floor(fc), this.cols - 2);
    const r0 = Math.min(Math.floor(fr), this.rows - 2);
    const u = fc - c0;
    const v = fr - r0;
    const h = this.heights;
    const i = r0 * this.cols + c0;
    const top = h[i] * (1 - u) + h[i + 1] * u;
    const bottom = h[i + this.cols] * (1 - u) + h[i + this.cols + 1] * u;
    return top * (1 - v) + bottom * v;
  }
}

export class FlatTerrain implements Terrain {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
  private readonly elevation: number;

  constructor(elevation = 0, halfSize = 5000) {
    this.elevation = elevation;
    this.minX = this.minY = -halfSize;
    this.maxX = this.maxY = halfSize;
  }

  contains(x: number, y: number): boolean {
    return x >= this.minX && x <= this.maxX && y >= this.minY && y <= this.maxY;
  }

  elevationAt(): number {
    return this.elevation;
  }
}
