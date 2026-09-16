import type { MapOrientation } from '../render/flight-view.ts';

export interface Settings {
  sound: boolean;
  orientation: MapOrientation;
  siteId?: string;
}

const STORAGE_KEY = 'thermiek.settings';
const DEFAULTS: Settings = { sound: true, orientation: 'northUp' };

export function loadSettings(): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Settings>;
    return { ...DEFAULTS, ...stored };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings: Settings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
