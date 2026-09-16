import type { MessageKey } from '../i18n/index.ts';
import type { FlightSetup } from '../sim/flight.ts';
import { createRng, deg } from '../sim/math.ts';
import type { ThermalConfig } from '../sim/thermal.ts';
import type { Site } from './sites.ts';

export interface LessonAids {
  /** Heatmap of vertical air speed at the glider's altitude. */
  liftOverlay: boolean;
  coreMarker: boolean;
  circleCenter: boolean;
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
    aids: { liftOverlay: true, coreMarker: true, circleCenter: true, climbTrail: true },
    complexity: 1,
    goalGain: 400,
  },
  {
    id: 'trail',
    titleKey: 'level.trail.title',
    descriptionKey: 'level.trail.description',
    aids: { liftOverlay: false, coreMarker: false, circleCenter: true, climbTrail: true },
    complexity: 1.5,
    goalGain: 500,
  },
  {
    id: 'vario',
    titleKey: 'level.vario.title',
    descriptionKey: 'level.vario.description',
    aids: { liftOverlay: false, coreMarker: false, circleCenter: false, climbTrail: false },
    complexity: 2,
    goalGain: 600,
  },
];

const START_DISTANCE = 320;
const START_HEIGHT = 300;

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

export function goalAltitude(site: Site, lesson: Lesson): number {
  return Math.round((site.trigger.ground + START_HEIGHT + lesson.goalGain) / 50) * 50;
}

/** Builds a flight; the seed varies the thermal so it cannot be memorized. */
export function createSetup(site: Site, lesson: Lesson, seed: number): FlightSetup {
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
    air: { wind: { x: 0, y: 0 }, ambient: -0.1, thermals: [createThermal(site, lesson, seed)] },
  };
}
