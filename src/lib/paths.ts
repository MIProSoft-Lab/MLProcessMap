import { href, locales, type Locale } from '../i18n/ui';
import { versions, processIds, lifecycleIds } from './content';

/**
 * The same page in every PRM version, for the version menu of the layout:
 * version → address of <locale>/<version>/<segments>. A version that does not
 * have the page (exists returns false) links to its process map instead.
 */
export function versionLinks(locale: Locale, segments: string[] = [], exists: (version: string) => boolean = () => true) {
  return Object.fromEntries(versions.map((v) => [v.id, exists(v.id) ? href(locale, v.id, ...segments) : href(locale, v.id)]));
}

export function localePaths() {
  return locales.map((lang) => ({ params: { lang }, props: { locale: lang } }));
}

export function versionPaths() {
  return locales.flatMap((lang) => versions.map((v) => ({ params: { lang, version: v.id }, props: { locale: lang } })));
}

export function processPaths() {
  return locales.flatMap((lang) =>
    versions.flatMap((v) => processIds(v.id).map((id) => ({ params: { lang, version: v.id, id }, props: { locale: lang } }))),
  );
}

/** Every ordered pair of versions, older first, as "v1-vs-v2". */
export function versionPairs() {
  return versions.flatMap((a, i) => versions.slice(i + 1).map((b) => ({ from: a.id, to: b.id, slug: `${a.id}-vs-${b.id}` })));
}

export function comparePaths() {
  return locales.flatMap((lang) => versionPairs().map((pair) => ({ params: { lang, pair: pair.slug }, props: { locale: lang, ...pair } })));
}

export function compareProcessPaths() {
  return locales.flatMap((lang) =>
    versionPairs().flatMap((pair) => {
      const ids = new Set([...processIds(pair.from), ...processIds(pair.to)]);
      return [...ids].map((id) => ({ params: { lang, pair: pair.slug, id }, props: { locale: lang, ...pair } }));
    }),
  );
}

export function lifecyclePaths() {
  return locales.flatMap((lang) => lifecycleIds().map((id) => ({ params: { lang, id }, props: { locale: lang } })));
}
