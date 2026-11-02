// The content of the site, read from content/. Every page imports from here,
// so a broken edit fails the build with a message that names the file and the
// field. The checks of the whole content are in src/lib/validation.
import { defaultLocale, type Locale } from '../../i18n/locales';
import { createContent } from './model';
import { contentFiles } from './source';

export const content = createContent(contentFiles);

export const {
  site,
  versions,
  defaultVersion,
  studies,
  references,
  acronyms,
  getVersion,
  processIds,
  getProcess,
  getProcesses,
  lifecycleIds,
  getLifecycle,
  getWorkProducts,
} = content;

export { contentFiles };
export type { Localized } from './model';
export type { WorkProduct, WorkProductLink } from './work-products';
export type { Acronym, Activity, Lifecycle, Process, Reference, Study, Version, WorkProductType } from './schemas';

/** Pick the text for a locale from a localized map, falling back to English. */
export function pick(map: Record<string, string>, locale: Locale): string {
  return map[locale] ?? map[defaultLocale];
}
