import type { MessageKey } from '../i18n/index.ts';
import type { FlightSetup } from '../sim/flight.ts';
import { createRng, deg } from '../sim/math.ts';
import type { ThermalConfig } from '../sim/thermal.ts';
import type { ThermalHotspot } from '../terrain/types.ts';
import { applyDifficulty, findDifficulty, type DifficultyLevel } from './difficulty.ts';
import type { Site } from './sites.ts';

export interface LessonAids {
  /** Heatmap of vertical air speed at the glider's altitude. */
  liftOverlay: boolean;
  coreMarker: boolean;
  /** Color the trail by climb rate. */
  climbTrail: boolean;
}

export interface Lesson {
  id: string;
  titleKey: MessageKey;
  descriptionKey: MessageKey;
  aids: LessonAids;
  /** 0 = single round core; higher adds an offset second core, more position jitter and pulsing. */
  complexity: number;
  /** Altitude to gain above the start, before rounding the goal to 50 m. */
  goalGain: number;
}

export const LESSONS: Lesson[] = [
  {
    id: 'intro',
    titleKey: 'level.intro.title',
    descriptionKey: 'level.intro.description',
    aids: { liftOverlay: true, coreMarker: true, climbTrail: true },
    complexity: 1,
    goalGain: 400,
  },
  {
    id: 'trail',
    titleKey: 'level.trail.title',
    descriptionKey: 'level.trail.description',
    aids: { liftOverlay: false, coreMarker: false, climbTrail: true },
    complexity: 1.5,
    goalGain: 500,
  },
  {
    id: 'vario',
    titleKey: 'level.vario.title',
    descriptionKey: 'level.vario.description',
    aids: { liftOverlay: false, coreMarker: false, climbTrail: false },
    complexity: 2,
    goalGain: 600,
  },
];

const START_DISTANCE = 320;
const START_HEIGHT = 350;
/** Other hotspots closer than this to the lesson thermal are skipped so they do not merge with it. */
const MIN_HOTSPOT_SEPARATION = 500;

function createThermal(site: Site, lesson: Lesson, seed: number): ThermalConfig {
  const rng = createRng(seed);
  const between = (min: number, max: number) => min + (max - min) * rng();
  const { complexity } = lesson;
  const angle = between(0, Math.PI * 2);
  const mainStrength = between(3.6, 4.2);
  const cores = [{ dx: 0, dy: 0, radius: between(36, 46), strength: mainStrength, phase: between(0, Math.PI * 2) }];
  if (complexity > 0) {
    const distance = between(35, 45 + 15 * complexity);
    cores.push({
      dx: Math.sin(angle) * distance,
      dy: Math.cos(angle) * distance,
      radius: between(24, 34),
      strength: mainStrength * between(0.45, 0.7),
      phase: between(0, Math.PI * 2),
    });
  }
  return {
    x: site.trigger.x + between(-40, 40) * complexity,
    y: site.trigger.y + between(-40, 40) * complexity,
    baseAltitude: site.trigger.ground - 10,
    topAltitude: site.thermalTop,
    cores,
    sinkRing: between(1.0, 1.6),
    pulsePeriod: between(40, 80),
    pulseAmplitude: 0.1 + 0.05 * complexity,
  };
}

function hotspotThermals(site: Site, seed: number, hotspots: readonly ThermalHotspot[]): ThermalConfig[] {
  const rng = createRng(seed ^ 0x9e3779b9);
  return hotspots
    .filter((h) => Math.hypot(h.x - site.trigger.x, h.y - site.trigger.y) >= MIN_HOTSPOT_SEPARATION)
    .map((h) => createHotspotThermal(site, h, rng));
}

/** A weaker single-core thermal at another hotspot; strength scales with its kk7 probability. */
function createHotspotThermal(site: Site, hotspot: ThermalHotspot, rng: () => number): ThermalConfig {
  const between = (min: number, max: number) => min + (max - min) * rng();
  return {
    x: hotspot.x,
    y: hotspot.y,
    baseAltitude: hotspot.elevation - 10,
    topAltitude: Math.max(site.thermalTop, hotspot.elevation + 800),
    cores: [{ dx: 0, dy: 0, radius: between(30, 42), strength: hotspot.probability * between(2.2, 3.4), phase: between(0, Math.PI * 2) }],
    sinkRing: between(0.8, 1.3),
    pulsePeriod: between(40, 80),
    pulseAmplitude: 0.15,
  };
}

export function goalAltitude(site: Site, lesson: Lesson): number {
  return Math.round((site.trigger.ground + START_HEIGHT + lesson.goalGain) / 50) * 50;
}

/**
 * Builds a flight; the seed varies the thermals so they cannot be memorized.
 * The lesson thermal sits at the site's trigger; the other hotspots get weaker thermals.
 * Thermals are generated with hard settings and then widened/softened for the difficulty.
 */
export function createSetup(
  site: Site,
  lesson: Lesson,
  seed: number,
  hotspots: readonly ThermalHotspot[] = [],
  difficulty: DifficultyLevel = findDifficulty('hard'),
): FlightSetup {
  const bearing = deg(site.startBearing);
  const start = {
    x: site.trigger.x + Math.sin(bearing) * START_DISTANCE,
    y: site.trigger.y + Math.cos(bearing) * START_DISTANCE,
  };
  return {
    start: {
      ...start,
      z: site.trigger.ground + START_HEIGHT,
      // Head toward the trigger, slightly offset so the thermal is not hit dead center.
      heading: Math.atan2(site.trigger.x - start.x, site.trigger.y - start.y) + deg(8),
    },
    goalAltitude: goalAltitude(site, lesson),
    air: {
      wind: { x: 0, y: 0 },
      ambient: -0.1,
      thermals: [createThermal(site, lesson, seed), ...hotspotThermals(site, seed, hotspots)].map((t) => applyDifficulty(t, difficulty)),
    },
  };
}
