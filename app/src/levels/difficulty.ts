import type { MessageKey } from '../i18n/index.ts';
import { DEFAULT_GLIDER, steadyTurn, type GliderParams } from '../sim/glider.ts';
import { Thermal, type ThermalConfig } from '../sim/thermal.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyLevel {
  id: Difficulty;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
  /** Multiplier for all core radii (hard = 1). */
  radiusScale: number;
  /** Multiplier for the sink ring strength (hard = 1, easy = no ring). */
  sinkRingScale: number;
  /** Lift fall-off exponent: 2 is a Gaussian (hard); lower values drop off more gradually toward the edge. */
  falloff: number;
}

export const DIFFICULTIES: DifficultyLevel[] = [
  { id: 'easy', labelKey: 'difficulty.easy', descriptionKey: 'difficulty.easy.description', radiusScale: 3, sinkRingScale: 0, falloff: 1.3 },
  { id: 'medium', labelKey: 'difficulty.medium', descriptionKey: 'difficulty.medium.description', radiusScale: 2, sinkRingScale: 0.5, falloff: 1.65 },
  { id: 'hard', labelKey: 'difficulty.hard', descriptionKey: 'difficulty.hard.description', radiusScale: 1, sinkRingScale: 1, falloff: 2 },
];

export const DEFAULT_DIFFICULTY: Difficulty = 'medium';

export function findDifficulty(id: string | undefined): DifficultyLevel {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES.find((d) => d.id === DEFAULT_DIFFICULTY)!;
}

/** One-sided brake positions used to estimate the best circle in a thermal. */
const CIRCLE_BRAKES = [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.95];
const CIRCLE_SAMPLES = 16;
const CENTER_STEP = 10;

interface CircleOption {
  /** Average lift from the cores along the circle, at strength scale 1. */
  coreLift: number;
  /** Average sink from the sink ring along the circle (positive). */
  ringSink: number;
  gliderSink: number;
}

/**
 * Average lift along every candidate circle (center on a grid around the thermal, radius from
 * CIRCLE_BRAKES), split into the part that scales with core strength and the sink ring part.
 * Evaluated at mid height, without wind and pulsation.
 */
function circleOptions(config: ThermalConfig, glider: GliderParams): CircleOption[] {
  const z = (config.baseAltitude + config.topAltitude) / 2;
  const still = { x: 0, y: 0 };
  const steady = { ...config, pulseAmplitude: 0 };
  const cores = new Thermal({ ...steady, sinkRing: 0 });
  const ring = new Thermal({ ...steady, cores: steady.cores.map((c) => ({ ...c, strength: 0 })) });
  const extent = Math.max(...config.cores.map((c) => Math.hypot(c.dx, c.dy))) + 40;
  const turns = CIRCLE_BRAKES.map((brake) => steadyTurn(brake, glider));

  const options: CircleOption[] = [];
  for (let cx = -extent; cx <= extent; cx += CENTER_STEP) {
    for (let cy = -extent; cy <= extent; cy += CENTER_STEP) {
      for (const turn of turns) {
        let coreLift = 0;
        let ringSink = 0;
        for (let i = 0; i < CIRCLE_SAMPLES; i++) {
          const a = (2 * Math.PI * i) / CIRCLE_SAMPLES;
          const x = config.x + cx + Math.cos(a) * turn.radius;
          const y = config.y + cy + Math.sin(a) * turn.radius;
          coreLift += cores.liftAt(x, y, z, 0, still);
          ringSink -= ring.liftAt(x, y, z, 0, still);
        }
        options.push({ coreLift: coreLift / CIRCLE_SAMPLES, ringSink: ringSink / CIRCLE_SAMPLES, gliderSink: turn.sinkRate });
      }
    }
  }
  return options;
}

const bestClimb = (options: CircleOption[], strengthScale: number): number =>
  Math.max(...options.map((o) => strengthScale * o.coreLift - o.ringSink - o.gliderSink));

/**
 * Strength factor (at most 1) that gives the reshaped thermal the same best circling climb
 * as the original hard thermal, so wider thermals are easier to center but not faster.
 */
export function matchingStrengthScale(hard: ThermalConfig, reshaped: ThermalConfig, glider = DEFAULT_GLIDER): number {
  const target = bestClimb(circleOptions(hard, glider), 1);
  const options = circleOptions(reshaped, glider);
  if (bestClimb(options, 1) <= target) return 1;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (low + high) / 2;
    if (bestClimb(options, mid) > target) high = mid;
    else low = mid;
  }
  return low;
}

/** Applies a difficulty to a thermal generated with hard settings. */
export function applyDifficulty(thermal: ThermalConfig, level: DifficultyLevel, glider = DEFAULT_GLIDER): ThermalConfig {
  const reshaped: ThermalConfig = {
    ...thermal,
    cores: thermal.cores.map((core) => ({ ...core, radius: core.radius * level.radiusScale })),
    sinkRing: thermal.sinkRing * level.sinkRingScale,
    falloff: level.falloff,
  };
  if (level.radiusScale === 1 && level.sinkRingScale === 1 && level.falloff === 2) return reshaped;
  const strengthScale = matchingStrengthScale({ ...thermal, falloff: 2 }, reshaped, glider);
  return { ...reshaped, cores: reshaped.cores.map((core) => ({ ...core, strength: core.strength * strengthScale })) };
}
