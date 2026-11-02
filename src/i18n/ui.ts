// Interface strings, read from content/ui/<locale>.yaml so they can be
// translated from the admin panel. English is the reference: a string missing
// in another language is shown in English. The PRM content is in content/ too.
import { content } from '../lib/content';
import { format } from '../lib/text';
import { defaultLocale, locales, type Locale } from './locales';

export { defaultLocale, isLocale, locales, type Locale } from './locales';

/** A string's "section.key", e.g. "nav.processes", as in content/ui/en.yaml. */
export type UiKey = string;

/** The strings of a language as "section.key" → text. */
function read(locale: Locale): Record<UiKey, string> {
  const strings = content.uiStrings(locale);
  if (strings === undefined && locale === defaultLocale) throw new Error(`content/ui/${locale}.yaml is missing`);
  return strings ?? {};
}

const ui = Object.fromEntries(locales.map((l) => [l, read(l)])) as Record<Locale, Record<UiKey, string>>;
const en = ui[defaultLocale];

/** Name of each language in that language, for the language menu. */
export const languageNames = Object.fromEntries(locales.map((l) => [l, ui[l]['language.name'] ?? l.toUpperCase()])) as Record<Locale, string>;

/** Name of a language as it appears inside a sentence of a locale. */
export function languageIn(locale: Locale, of: Locale) {
  return ui[locale][`language.${of}`] ?? en[`language.${of}`] ?? of;
}

export function useTranslations(locale: Locale) {
  return (key: UiKey, vars: Record<string, string | number> = {}) => {
    const s = ui[locale][key] ?? en[key];
    if (s === undefined) throw new Error(`Unknown interface string "${key}": add it to content/ui/${defaultLocale}.yaml`);
    return format(s, vars);
  };
}

/** Absolute path inside the site, honoring the configured base path. */
export function href(...segments: string[]) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const path = segments.filter(Boolean).join('/');
  return `${base}/${path}${path && !path.includes('#') && !path.includes('?') ? '/' : ''}`;
}
