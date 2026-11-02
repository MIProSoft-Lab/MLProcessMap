// The content as the pages see it, built from a map of files. Each file is
// parsed once, on first use; a file that does not match its schema throws a
// ContentError that names the file and the fields.
import { defaultLocale, type Locale } from '../../i18n/locales';
import { idsIn, paths, readFile, type ContentFiles } from './files';
import {
  lifecycleSchema,
  processSchema,
  referencesSchema,
  acronymsSchema,
  siteSchema,
  studiesSchema,
  uiSchema,
  versionsSchema,
  workProductsSchema,
  type Lifecycle,
  type Process,
  type Version,
  type WorkProductMeta,
} from './schemas';
import { deriveWorkProducts, type WorkProduct } from './work-products';
import type { z } from 'astro/zod';

export interface Localized<T> {
  data: T;
  /** False when the locale has no file and the English text is shown. */
  translated: boolean;
}

export type Content = ReturnType<typeof createContent>;

export function createContent(files: ContentFiles) {
  const cache = new Map<string, unknown>();
  function load<T>(path: string, schema: z.ZodType<T>): T {
    if (!cache.has(path)) cache.set(path, readFile(files, path, schema));
    return cache.get(path) as T;
  }

  /** The file of the locale, or the English one marked as untranslated. */
  function localized<T>(path: (locale: string) => string, locale: Locale, schema: z.ZodType<T>): Localized<T> | undefined {
    if (files[path(locale)] !== undefined) return { data: load(path(locale), schema), translated: true };
    if (files[path(defaultLocale)] !== undefined) return { data: load(path(defaultLocale), schema), translated: locale === defaultLocale };
    return undefined;
  }

  const site = load(paths.site, siteSchema);
  const versionsFile = load(paths.versions, versionsSchema);
  const versions = versionsFile.versions;
  const studies = load(paths.studies, studiesSchema).studies;
  const references = load(paths.references, referencesSchema).references;
  // Optional: without the file, no text is marked as an acronym.
  const acronyms = files[paths.acronyms] !== undefined ? load(paths.acronyms, acronymsSchema).acronyms : [];

  function getVersion(id: string): Version {
    const v = versions.find((v) => v.id === id);
    if (!v) throw new Error(`Unknown PRM version ${id}`);
    return v;
  }

  /** The processes of a version: those with an English file. */
  function processIds(version: string): string[] {
    return idsIn(files, paths.processDir(version, defaultLocale));
  }

  function getProcess(version: string, id: string, locale: Locale): Localized<Process> {
    const p = localized((l) => paths.process(version, l, id), locale, processSchema);
    if (!p) throw new Error(`Unknown process ${version}/${id}`);
    return p;
  }

  function getProcesses(version: string, locale: Locale): Localized<Process>[] {
    return processIds(version).map((id) => getProcess(version, id, locale));
  }

  /** The lifecycles: those with an English file. */
  function lifecycleIds(): string[] {
    return idsIn(files, paths.lifecycleDir(defaultLocale));
  }

  function getLifecycle(id: string, locale: Locale): Localized<Lifecycle> {
    const l = localized((loc) => paths.lifecycle(loc, id), locale, lifecycleSchema);
    if (!l) throw new Error(`Unknown lifecycle ${id}`);
    return l;
  }

  /** The type and scope of the work products of a version, from work-products.yaml. */
  function workProductMeta(version: string): WorkProductMeta[] {
    const path = paths.workProducts(version);
    return files[path] !== undefined ? load(path, workProductsSchema).workProducts : [];
  }

  /** Work products of a version, with the processes that produce and use them. */
  function getWorkProducts(version: string, locale: Locale): WorkProduct[] {
    return deriveWorkProducts(getProcesses(version, locale).map((p) => p.data), workProductMeta(version), locale);
  }

  /** The interface strings of a language as "section.key" → text, or undefined when it has no file. */
  function uiStrings(locale: string): Record<string, string> | undefined {
    if (files[paths.ui(locale)] === undefined) return undefined;
    const sections = load(paths.ui(locale), uiSchema);
    const out: Record<string, string> = {};
    for (const [section, entries] of Object.entries(sections)) {
      for (const [key, text] of Object.entries(entries)) out[`${section}.${key}`] = text;
    }
    return out;
  }

  return {
    site,
    versions,
    defaultVersion: versionsFile.default,
    studies,
    references,
    acronyms,
    getVersion,
    processIds,
    getProcess,
    getProcesses,
    lifecycleIds,
    getLifecycle,
    workProductMeta,
    getWorkProducts,
    uiStrings,
  };
}
