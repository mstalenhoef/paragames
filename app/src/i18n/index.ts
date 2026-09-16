import { nl } from './nl.ts';

export type MessageKey = keyof typeof nl;
export type Messages = Record<MessageKey, string>;
export type MessageParams = Record<string, string | number>;

/** Add a locale here with a catalog of type `Messages`; missing keys fail type checking. */
const catalogs = { nl } satisfies Record<string, Messages>;

export type Locale = keyof typeof catalogs;
export const DEFAULT_LOCALE: Locale = 'nl';
export const SUPPORTED_LOCALES = Object.keys(catalogs) as Locale[];

let locale: Locale = DEFAULT_LOCALE;
let messages: Messages = catalogs[locale];
const numberFormats = new Map<string, Intl.NumberFormat>();

export function isLocale(value: string | null | undefined): value is Locale {
  return value != null && value in catalogs;
}

/** Picks the first supported locale from the browser preferences. */
export function detectLocale(preferred: readonly string[] = navigator.languages): Locale {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export function setLocale(next: Locale): void {
  locale = next;
  messages = catalogs[next];
  numberFormats.clear();
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}

export function getLocale(): Locale {
  return locale;
}

export function t(key: MessageKey, params?: MessageParams): string {
  const template = messages[key] ?? nl[key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function formatNumber(value: number, fractionDigits = 0): string {
  const cacheKey = `${fractionDigits}`;
  let format = numberFormats.get(cacheKey);
  if (!format) {
    format = new Intl.NumberFormat(locale, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
    numberFormats.set(cacheKey, format);
  }
  return format.format(value);
}

export const formatMeters = (value: number): string => `${formatNumber(Math.round(value))} m`;

export function formatClimb(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : '';
  return `${sign}${formatNumber(Math.abs(rounded), 1)} m/s`;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Translates all elements with a data-i18n attribute (text) or data-i18n-aria (aria-label). */
export function translateDom(root: ParentNode): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n as MessageKey);
  });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria as MessageKey));
  });
}
