import { describe, expect, it } from 'vitest';
import { detectLocale, formatClimb, formatDuration, formatMeters, formatNumber, t } from './index.ts';

describe('i18n', () => {
  it('interpolates parameters', () => {
    expect(t('level.intro.description', { goal: '2.400 m' })).toContain('2.400 m');
  });

  it('formats numbers the Dutch way', () => {
    expect(formatNumber(2400)).toBe('2.400');
    expect(formatNumber(1.25, 1)).toMatch(/^1,[23]$/);
    expect(formatMeters(1834.4)).toBe('1.834 m');
    expect(formatClimb(1.26)).toBe('+1,3 m/s');
    expect(formatClimb(-0.04)).toBe('0,0 m/s');
    expect(formatDuration(125)).toBe('2:05');
  });

  it('falls back to Dutch for unsupported languages', () => {
    expect(detectLocale(['fr-FR', 'nl-BE'])).toBe('nl');
    expect(detectLocale(['de'])).toBe('nl');
  });
});
