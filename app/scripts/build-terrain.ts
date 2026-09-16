/**
 * Builds terrain assets for a flying site:
 *  - height.bin: elevation grid (uint16 LE, decimeters, north row first)
 *  - map.webp: shaded relief with elevation tint and contour lines
 *  - meta.json: extent, grid layout and map features
 *
 * Elevation source: AWS Terrain Tiles (Terrarium encoding), cached in .cache/tiles.
 * Usage: npm run terrain [site-id ...]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createProjection, type LatLon } from '../src/terrain/geo.ts';
import type { MapFeature, TerrainMeta } from '../src/terrain/types.ts';

interface SiteConfig {
  id: string;
  name: string;
  origin: LatLon;
  halfWidth: number;
  halfHeight: number;
  heightSpacing: number;
  imageMetersPerPixel: number;
  zoom: number;
  features: (Omit<MapFeature, 'x' | 'y' | 'elevation'> & LatLon)[];
  /** Box-blur passes over the elevation before shading; hides resampling stripes in coarser source data. */
  shadingSmoothing: number;
  /** Elevation data sources in the Terrain Tiles for this area. */
  elevationAttribution: string;
}

const WERFENWENG: SiteConfig = {
  id: 'werfenweng',
  name: 'Werfenweng',
  origin: { lat: 47.468, lon: 13.275 },
  halfWidth: 4000,
  halfHeight: 4000,
  heightSpacing: 10,
  imageMetersPerPixel: 4,
  zoom: 14,
  // Selected from OpenStreetMap (© OpenStreetMap contributors, ODbL).
  features: [
    { kind: 'takeoff', name: 'Bischling West', lat: 47.46233, lon: 13.29706 },
    { kind: 'takeoff', name: 'Bischling Süd', lat: 47.46148, lon: 13.29807 },
    { kind: 'takeoff', name: 'Bischling Ost', lat: 47.46394, lon: 13.29915 },
    { kind: 'landing', name: 'Landeplatz', lat: 47.4596, lon: 13.26962 },
    { kind: 'village', name: 'Werfenweng', lat: 47.46155, lon: 13.25678 },
    { kind: 'village', name: 'Zaglau', lat: 47.45831, lon: 13.27467 },
    { kind: 'village', name: 'Wengerau', lat: 47.47635, lon: 13.27037 },
    { kind: 'village', name: 'Eulersberg', lat: 47.44877, lon: 13.25654 },
    { kind: 'peak', name: 'Bischlingshöhe', lat: 47.46262, lon: 13.29826 },
    { kind: 'peak', name: 'Wiesegg', lat: 47.46743, lon: 13.27884 },
    { kind: 'peak', name: 'Hirschkogel', lat: 47.47643, lon: 13.25418 },
    { kind: 'peak', name: 'Ladenberg', lat: 47.47019, lon: 13.30237 },
    { kind: 'peak', name: 'Frommerkogel', lat: 47.46551, lon: 13.32739 },
    { kind: 'peak', name: 'Donneregg', lat: 47.4464, lon: 13.2875 },
    { kind: 'peak', name: 'Eiskogel', lat: 47.49657, lon: 13.28203 },
    { kind: 'peak', name: 'Hochthron', lat: 47.49243, lon: 13.24296 },
    { kind: 'peak', name: 'Napf', lat: 47.49421, lon: 13.29189 },
  ],
  shadingSmoothing: 0,
  elevationAttribution: 'data © Land Salzburg / data.gv.at, CC BY 4.0',
};

const AHORNACH_SPEIKBODEN: SiteConfig = {
  id: 'ahornach-speikboden',
  name: 'Ahornach / Speikboden',
  origin: { lat: 46.925, lon: 11.932 },
  halfWidth: 5000,
  halfHeight: 4000,
  heightSpacing: 10,
  imageMetersPerPixel: 4,
  zoom: 14,
  // Selected from OpenStreetMap (© OpenStreetMap contributors, ODbL).
  features: [
    { kind: 'takeoff', name: 'Ahornach', lat: 46.92631, lon: 11.96764 },
    { kind: 'takeoff', name: 'Speikboden', lat: 46.91496, lon: 11.89777 },
    { kind: 'landing', name: 'Landeplatz', lat: 46.91193, lon: 11.96127 },
    { kind: 'village', name: 'Sand in Taufers', lat: 46.91924, lon: 11.95518 },
    { kind: 'village', name: 'Ahornach', lat: 46.92596, lon: 11.97737 },
    { kind: 'village', name: 'Mühlen', lat: 46.89916, lon: 11.94291 },
    { kind: 'village', name: 'Luttach', lat: 46.95106, lon: 11.92122 },
    { kind: 'peak', name: 'Speikboden', lat: 46.91818, lon: 11.89026 },
    { kind: 'peak', name: 'Sonnklar Nock', lat: 46.91523, lon: 11.90787 },
    { kind: 'peak', name: 'Großer Nock', lat: 46.92697, lon: 11.88848 },
    { kind: 'peak', name: 'Hühnerspiel', lat: 46.9243, lon: 11.91225 },
    { kind: 'peak', name: 'Steiner Holm', lat: 46.9495, lon: 11.95021 },
    { kind: 'peak', name: 'Kleines Jöchl', lat: 46.94245, lon: 11.97885 },
  ],
  shadingSmoothing: 3,
  elevationAttribution: 'EU-DEM, produced using Copernicus data',
};

const GREIFENBURG: SiteConfig = {
  id: 'greifenburg',
  name: 'Greifenburg',
  origin: { lat: 46.768, lon: 13.175 },
  halfWidth: 5000,
  halfHeight: 4000,
  heightSpacing: 10,
  imageMetersPerPixel: 4,
  zoom: 14,
  // Selected from OpenStreetMap (© OpenStreetMap contributors, ODbL).
  features: [
    { kind: 'takeoff', name: 'Emberger Alm', lat: 46.77715, lon: 13.14992 },
    { kind: 'takeoff', name: 'Rottenstein', lat: 46.76847, lon: 13.2267 },
    { kind: 'landing', name: 'Landeplatz', lat: 46.74648, lon: 13.19194 },
    { kind: 'village', name: 'Greifenburg', lat: 46.75061, lon: 13.18041 },
    { kind: 'village', name: 'Berg', lat: 46.74747, lon: 13.13627 },
    { kind: 'village', name: 'Bruggen', lat: 46.73956, lon: 13.19447 },
    { kind: 'peak', name: 'Gaugen', lat: 46.78675, lon: 13.20918 },
    { kind: 'peak', name: 'Dolzer', lat: 46.78793, lon: 13.20322 },
    { kind: 'peak', name: 'Kreuzkofel', lat: 46.77758, lon: 13.22368 },
    { kind: 'peak', name: 'Naßfeldriegel', lat: 46.78456, lon: 13.14676 },
    { kind: 'peak', name: 'Hochtristen', lat: 46.79542, lon: 13.13543 },
    { kind: 'peak', name: 'Schwarzstein', lat: 46.79936, lon: 13.15158 },
  ],
  shadingSmoothing: 0,
  elevationAttribution: 'data © Land Kärnten / data.gv.at, CC BY 4.0',
};

const SITES = [WERFENWENG, AHORNACH_SPEIKBODEN, GREIFENBURG];

const TILE_SIZE = 256;
const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium';
const root = path.resolve(import.meta.dirname, '..');

class TerrariumSource {
  private tiles = new Map<string, Float32Array>();
  private readonly zoom: number;

  constructor(zoom: number) {
    this.zoom = zoom;
  }

  static tileXY(p: LatLon, zoom: number): { x: number; y: number } {
    const n = 2 ** zoom * TILE_SIZE;
    const latRad = (p.lat * Math.PI) / 180;
    return {
      x: ((p.lon + 180) / 360) * n,
      y: ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
    };
  }

  async load(nw: LatLon, se: LatLon): Promise<void> {
    const a = TerrariumSource.tileXY(nw, this.zoom);
    const b = TerrariumSource.tileXY(se, this.zoom);
    for (let ty = Math.floor(a.y / TILE_SIZE) - 1; ty <= Math.floor(b.y / TILE_SIZE) + 1; ty++) {
      for (let tx = Math.floor(a.x / TILE_SIZE) - 1; tx <= Math.floor(b.x / TILE_SIZE) + 1; tx++) {
        this.tiles.set(`${tx}/${ty}`, await this.fetchTile(tx, ty));
      }
    }
  }

  private async fetchTile(tx: number, ty: number): Promise<Float32Array> {
    const file = path.join(root, '.cache/tiles', String(this.zoom), String(tx), `${ty}.png`);
    if (!existsSync(file)) {
      const url = `${TILE_URL}/${this.zoom}/${tx}/${ty}.png`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, Buffer.from(await res.arrayBuffer()));
      console.log(`downloaded ${url}`);
    }
    const { data, info } = await sharp(await readFile(file)).raw().toBuffer({ resolveWithObject: true });
    const out = new Float32Array(TILE_SIZE * TILE_SIZE);
    for (let i = 0; i < out.length; i++) {
      const o = i * info.channels;
      out[i] = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
    }
    return out;
  }

  private pixel(px: number, py: number): number {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    const tile = this.tiles.get(`${tx}/${ty}`);
    if (!tile) throw new Error(`tile ${tx}/${ty} not loaded`);
    return tile[(py - ty * TILE_SIZE) * TILE_SIZE + (px - tx * TILE_SIZE)];
  }

  elevation(p: LatLon): number {
    const { x, y } = TerrariumSource.tileXY(p, this.zoom);
    // Pixel centers sit at +0.5.
    const fx = x - 0.5;
    const fy = y - 0.5;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const u = fx - x0;
    const v = fy - y0;
    const top = this.pixel(x0, y0) * (1 - u) + this.pixel(x0 + 1, y0) * u;
    const bottom = this.pixel(x0, y0 + 1) * (1 - u) + this.pixel(x0 + 1, y0 + 1) * u;
    return top * (1 - v) + bottom * v;
  }
}

const TINT_STOPS: [number, [number, number, number]][] = [
  [500, [176, 202, 138]],
  [900, [168, 198, 128]],
  [1200, [126, 164, 100]],
  [1600, [138, 166, 108]],
  [1900, [184, 186, 156]],
  [2200, [204, 200, 190]],
  [2500, [238, 238, 236]],
];
const ROCK: [number, number, number] = [176, 170, 164];

function tint(elevation: number): [number, number, number] {
  if (elevation <= TINT_STOPS[0][0]) return TINT_STOPS[0][1];
  for (let i = 1; i < TINT_STOPS.length; i++) {
    const [e1, c1] = TINT_STOPS[i];
    if (elevation <= e1) {
      const [e0, c0] = TINT_STOPS[i - 1];
      const t = (elevation - e0) / (e1 - e0);
      return [0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * t) as [number, number, number];
    }
  }
  return TINT_STOPS[TINT_STOPS.length - 1][1];
}

/** Separable 3x3 box blur in place; edges are left untouched. */
function boxBlur(data: Float32Array, w: number, h: number): void {
  const tmp = new Float32Array(data);
  for (let y = 0; y < h; y++) {
    for (let x = 1; x < w - 1; x++) tmp[y * w + x] = (data[y * w + x - 1] + data[y * w + x] + data[y * w + x + 1]) / 3;
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 0; x < w; x++) data[y * w + x] = (tmp[(y - 1) * w + x] + tmp[y * w + x] + tmp[(y + 1) * w + x]) / 3;
  }
}

async function build(site: SiteConfig): Promise<void> {
  const projection = createProjection(site.origin);
  const minX = -site.halfWidth;
  const maxX = site.halfWidth;
  const minY = -site.halfHeight;
  const maxY = site.halfHeight;

  const source = new TerrariumSource(site.zoom);
  await source.load(projection.toLatLon(minX, maxY), projection.toLatLon(maxX, minY));
  const elevationAt = (x: number, y: number) => source.elevation(projection.toLatLon(x, y));

  const outDir = path.join(root, 'public/terrain', site.id);
  await mkdir(outDir, { recursive: true });

  // Height grid.
  const cols = Math.round((maxX - minX) / site.heightSpacing) + 1;
  const rows = Math.round((maxY - minY) / site.heightSpacing) + 1;
  const grid = Buffer.alloc(cols * rows * 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const e = elevationAt(minX + c * site.heightSpacing, maxY - r * site.heightSpacing);
      grid.writeUInt16LE(Math.round(Math.max(0, e) * 10), (r * cols + c) * 2);
    }
  }
  await writeFile(path.join(outDir, 'height.bin'), grid);

  // Map image.
  const mpp = site.imageMetersPerPixel;
  const width = Math.round((maxX - minX) / mpp);
  const height = Math.round((maxY - minY) / mpp);
  const elev = new Float32Array((width + 2) * (height + 2));
  const at = (px: number, py: number) => elev[(py + 1) * (width + 2) + (px + 1)];
  for (let py = -1; py <= height; py++) {
    for (let px = -1; px <= width; px++) {
      elev[(py + 1) * (width + 2) + (px + 1)] = elevationAt(minX + (px + 0.5) * mpp, maxY - (py + 0.5) * mpp);
    }
  }
  for (let pass = 0; pass < site.shadingSmoothing; pass++) boxBlur(elev, width + 2, height + 2);

  const sunAzimuth = (315 * Math.PI) / 180;
  const sunAltitude = (45 * Math.PI) / 180;
  const sun = [Math.sin(sunAzimuth) * Math.cos(sunAltitude), Math.cos(sunAzimuth) * Math.cos(sunAltitude), Math.sin(sunAltitude)];
  const rgb = Buffer.alloc(width * height * 3);
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const e = at(px, py);
      const dzdx = (at(px + 1, py) - at(px - 1, py)) / (2 * mpp);
      const dzdy = (at(px, py - 1) - at(px, py + 1)) / (2 * mpp); // north is up
      const len = Math.hypot(dzdx, dzdy, 1);
      const shade = Math.max(0, (-dzdx * sun[0] - dzdy * sun[1] + sun[2]) / len);
      const slope = Math.atan(Math.hypot(dzdx, dzdy));

      let color = tint(e);
      const rock = Math.min(1, Math.max(0, (slope - 0.6) / 0.35));
      color = [0, 1, 2].map((k) => color[k] + (ROCK[k] - color[k]) * rock) as [number, number, number];

      let light = 0.45 + 0.75 * shade;
      const minorLevel = Math.floor(e / 50);
      const crossesMinor = Math.floor(at(px + 1, py) / 50) !== minorLevel || Math.floor(at(px, py + 1) / 50) !== minorLevel;
      if (crossesMinor) {
        const major = Math.floor(Math.max(e, at(px + 1, py), at(px, py + 1)) / 50) % 5 === 0;
        light *= major ? 0.68 : 0.85;
      }

      const o = (py * width + px) * 3;
      for (let k = 0; k < 3; k++) rgb[o + k] = Math.min(255, Math.round(color[k] * light));
    }
  }
  await sharp(rgb, { raw: { width, height, channels: 3 } })
    .webp({ quality: 82 })
    .toFile(path.join(outDir, 'map.webp'));

  const meta: TerrainMeta = {
    id: site.id,
    name: site.name,
    origin: site.origin,
    minX,
    maxX,
    minY,
    maxY,
    height: { file: 'height.bin', encoding: 'uint16le-dm', cols, rows, spacing: site.heightSpacing },
    image: { file: 'map.webp', width, height, metersPerPixel: mpp },
    features: site.features.map(({ lat, lon, ...f }) => {
      const { x, y } = projection.toLocal({ lat, lon });
      return { ...f, x: Math.round(x), y: Math.round(y), elevation: Math.round(elevationAt(x, y)) };
    }),
    attribution: [
      `Terrain: AWS Terrain Tiles (Mapzen), incl. ${site.elevationAttribution}`,
      'Map features: © OpenStreetMap contributors, ODbL',
    ],
  };
  await writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(`${site.id}: grid ${cols}x${rows}, image ${width}x${height}`);
  for (const f of meta.features) console.log(`  ${f.kind.padEnd(8)} ${f.name.padEnd(16)} x=${f.x} y=${f.y} ele=${f.elevation}`);
}

const requested = process.argv.slice(2);
const unknown = requested.filter((id) => !SITES.some((site) => site.id === id));
if (unknown.length > 0) throw new Error(`unknown site(s): ${unknown.join(', ')}`);
for (const site of SITES) {
  if (requested.length === 0 || requested.includes(site.id)) await build(site);
}
