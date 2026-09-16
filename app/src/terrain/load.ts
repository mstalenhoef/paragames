import { GridTerrain } from '../sim/terrain.ts';
import type { TerrainMeta } from './types.ts';

export interface LoadedTerrain {
  meta: TerrainMeta;
  terrain: GridTerrain;
  imageUrl: string;
}

export async function loadTerrain(id: string): Promise<LoadedTerrain> {
  const base = `${import.meta.env.BASE_URL}terrain/${id}/`;
  const metaResponse = await fetch(`${base}meta.json`);
  if (!metaResponse.ok) throw new Error(`terrain ${id}: HTTP ${metaResponse.status}`);
  const meta = (await metaResponse.json()) as TerrainMeta;

  const heightResponse = await fetch(base + meta.height.file);
  if (!heightResponse.ok) throw new Error(`terrain ${id} heights: HTTP ${heightResponse.status}`);
  const view = new DataView(await heightResponse.arrayBuffer());
  const { cols, rows, spacing } = meta.height;
  const heights = new Float32Array(cols * rows);
  for (let i = 0; i < heights.length; i++) heights[i] = view.getUint16(i * 2, true) / 10;

  return {
    meta,
    terrain: new GridTerrain(meta.minX, meta.maxY, spacing, cols, rows, heights),
    imageUrl: base + meta.image.file,
  };
}
