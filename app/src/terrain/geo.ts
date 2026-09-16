/**
 * Local tangent-plane projection around a reference point.
 * x points east, y points north, both in meters. Accurate enough for maps of ~10 km.
 */
export interface LatLon {
  lat: number;
  lon: number;
}

export interface LocalProjection {
  toLocal(p: LatLon): { x: number; y: number };
  toLatLon(x: number, y: number): LatLon;
}

export function createProjection(origin: LatLon): LocalProjection {
  const phi = (origin.lat * Math.PI) / 180;
  const metersPerDegLat = 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi);
  const metersPerDegLon = 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi);
  return {
    toLocal: (p) => ({
      x: (p.lon - origin.lon) * metersPerDegLon,
      y: (p.lat - origin.lat) * metersPerDegLat,
    }),
    toLatLon: (x, y) => ({
      lat: origin.lat + y / metersPerDegLat,
      lon: origin.lon + x / metersPerDegLon,
    }),
  };
}
