export interface Site {
  id: string;
  name: string;
  terrainId: string;
  /** Thermal trigger on the ground, local meters relative to the terrain origin (see public/terrain/<id>/meta.json). */
  trigger: { x: number; y: number; ground: number };
  /** Compass bearing (degrees) from the trigger to the start position, over lower terrain. */
  startBearing: number;
  /** Top of the thermal, m MSL. */
  thermalTop: number;
}

export const SITES: Site[] = [
  {
    id: 'werfenweng',
    name: 'Werfenweng',
    terrainId: 'werfenweng',
    // Wiesegg spur between Bischling takeoff and the landing field.
    trigger: { x: 289, y: -63, ground: 1309 },
    startBearing: 129,
    thermalTop: 2700,
  },
  {
    id: 'ahornach',
    name: 'Ahornach',
    terrainId: 'ahornach-speikboden',
    // South-facing spur below the Ahornach takeoff, above Sand in Taufers.
    trigger: { x: 2134, y: -174, ground: 1162 },
    startBearing: 209,
    thermalTop: 2700,
  },
  {
    id: 'speikboden',
    name: 'Speikboden',
    terrainId: 'ahornach-speikboden',
    // South-west ridge below the Speikboden takeoff.
    trigger: { x: -1987, y: -1656, ground: 2114 },
    startBearing: 221,
    thermalTop: 3400,
  },
  {
    id: 'greifenburg',
    name: 'Greifenburg',
    terrainId: 'greifenburg',
    // South-facing spur west of the Emberger Alm takeoff.
    trigger: { x: -2496, y: -363, ground: 1317 },
    startBearing: 174,
    thermalTop: 2800,
  },
];

export const findSite = (id: string | undefined): Site => SITES.find((s) => s.id === id) ?? SITES[0];
