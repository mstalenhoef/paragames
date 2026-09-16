export interface Site {
  id: string;
  name: string;
  terrainId: string;
  /**
   * Thermal trigger for the lessons: a thermal.kk7.ch hotspot from public/terrain/<terrainId>/meta.json,
   * in local meters relative to the terrain origin.
   */
  trigger: { x: number; y: number; ground: number };
  /** Compass bearing (degrees) from the trigger to the start position; points back toward the takeoff. */
  startBearing: number;
  /** Top of the thermals, m MSL. */
  thermalTop: number;
}

export const SITES: Site[] = [
  {
    id: 'werfenweng',
    name: 'Werfenweng',
    terrainId: 'werfenweng',
    // Hotspot p=0,79 near Wiesegg, on the glide from Bischling to the landing field.
    trigger: { x: 97, y: -333, ground: 1285 },
    startBearing: 101,
    thermalTop: 2700,
  },
  {
    id: 'ahornach',
    name: 'Ahornach',
    terrainId: 'ahornach-speikboden',
    // Hotspot p=0,82 just in front of the Ahornach takeoff.
    trigger: { x: 2237, y: 176, ground: 1380 },
    startBearing: 94,
    thermalTop: 2700,
  },
  {
    id: 'speikboden',
    name: 'Speikboden',
    terrainId: 'ahornach-speikboden',
    // Hotspot p=0,99 on the ridge east of the Speikboden takeoff.
    trigger: { x: -1790, y: -1492, ground: 2253 },
    startBearing: 295,
    thermalTop: 3600,
  },
  {
    id: 'greifenburg',
    name: 'Greifenburg',
    terrainId: 'greifenburg',
    // Hotspot p=0,94 below the Emberger Alm takeoff.
    trigger: { x: -1127, y: 10, ground: 1547 },
    startBearing: 322,
    thermalTop: 2900,
  },
];

export const findSite = (id: string | undefined): Site => SITES.find((s) => s.id === id) ?? SITES[0];
