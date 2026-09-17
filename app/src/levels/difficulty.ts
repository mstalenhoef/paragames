import type { MessageKey } from '../i18n/index.ts';
import type { ThermalConfig } from '../sim/thermal.ts';

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

/** Applies a difficulty to a thermal generated with hard settings. */
export function applyDifficulty(thermal: ThermalConfig, level: DifficultyLevel): ThermalConfig {
  return {
    ...thermal,
    cores: thermal.cores.map((core) => ({ ...core, radius: core.radius * level.radiusScale })),
    sinkRing: thermal.sinkRing * level.sinkRingScale,
    falloff: level.falloff,
  };
}
