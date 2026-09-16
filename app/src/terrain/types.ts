import type { LatLon } from './geo.ts';

export type MapFeatureKind = 'takeoff' | 'landing' | 'peak' | 'village';

export interface MapFeature {
  kind: MapFeatureKind;
  name: string;
  x: number;
  y: number;
  elevation: number;
}

/** Thermal trigger point from thermal.kk7.ch, derived from recorded flights. */
export interface ThermalHotspot {
  x: number;
  y: number;
  elevation: number;
  /** Probability (0..1) of finding usable lift here when flying over it. */
  probability: number;
}

/** Metadata written by scripts/build-terrain.ts next to the height grid and map image. */
export interface TerrainMeta {
  id: string;
  name: string;
  origin: LatLon;
  /** Extent in local meters (x east, y north). */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  height: {
    file: string;
    /** Little-endian uint16, elevation in decimeters, row 0 is the northern edge. */
    encoding: 'uint16le-dm';
    cols: number;
    rows: number;
    spacing: number;
  };
  image: {
    file: string;
    width: number;
    height: number;
    metersPerPixel: number;
  };
  features: MapFeature[];
  /** Sorted by probability, highest first. */
  hotspots: ThermalHotspot[];
  attribution: string[];
}
