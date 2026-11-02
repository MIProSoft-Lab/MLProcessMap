// Where each content file lives and what it must contain, and how a file is
// parsed. Nothing here reads the disk: the files come in as a map, from
// import.meta.glob in the site (source.ts) and from the disk in the checks
// (read-files.ts), so both read the content the same way.
import { parseDocument } from 'yaml';
import type { z } from 'astro/zod';
import {
  acronymsSchema,
  lifecycleSchema,
  processSchema,
  referencesSchema,
  siteSchema,
  studiesSchema,
  uiSchema,
  versionsSchema,
  workProductsSchema,
} from './schemas';

/** Content files by path from the repository root, e.g. "/content/site.yaml", to their text. */
export type ContentFiles = Record<string, string>;

export const paths = {
  site: '/content/site.yaml',
  versions: '/content/versions.yaml',
  studies: '/content/studies.yaml',
  references: '/content/references.yaml',
  acronyms: '/content/acronyms.yaml',
  ui: (locale: string) => `/content/ui/${locale}.yaml`,
  workProducts: (version: string) => `/content/prm/${version}/work-products.yaml`,
  processDir: (version: string, locale: string) => `/content/prm/${version}/processes/${locale}/`,
  process: (version: string, locale: string, id: string) => `/content/prm/${version}/processes/${locale}/${id}.yaml`,
  lifecycleDir: (locale: string) => `/content/lifecycles/${locale}/`,
  lifecycle: (locale: string, id: string) => `/content/lifecycles/${locale}/${id}.yaml`,
};

export interface ContentKind {
  name: string;
  /** Matches the path. Named groups (locale, version, id) are passed to the checks. */
  pattern: RegExp;
  schema: z.ZodType;
}

/** Every kind of content file. A YAML file under content/ that matches none is reported. */
export const contentKinds: ContentKind[] = [
  { name: 'site', pattern: /^\/content\/site\.yaml$/, schema: siteSchema },
  { name: 'versions', pattern: /^\/content\/versions\.yaml$/, schema: versionsSchema },
  { name: 'studies', pattern: /^\/content\/studies\.yaml$/, schema: studiesSchema },
  { name: 'references', pattern: /^\/content\/references\.yaml$/, schema: referencesSchema },
  { name: 'acronyms', pattern: /^\/content\/acronyms\.yaml$/, schema: acronymsSchema },
  { name: 'interface strings', pattern: /^\/content\/ui\/(?<locale>[^/]+)\.yaml$/, schema: uiSchema },
  { name: 'work products', pattern: /^\/content\/prm\/(?<version>[^/]+)\/work-products\.yaml$/, schema: workProductsSchema },
  {
    name: 'process',
    pattern: /^\/content\/prm\/(?<version>[^/]+)\/processes\/(?<locale>[^/]+)\/(?<id>[^/]+)\.yaml$/,
    schema: processSchema,
  },
  { name: 'lifecycle', pattern: /^\/content\/lifecycles\/(?<locale>[^/]+)\/(?<id>[^/]+)\.yaml$/, schema: lifecycleSchema },
];

/** The kind of a content file and the parts of its path, or undefined for a file that should not be there. */
export function kindOf(path: string): { kind: ContentKind; groups: Record<string, string> } | undefined {
  for (const kind of contentKinds) {
    const m = kind.pattern.exec(path);
    if (m) return { kind, groups: { ...m.groups } };
  }
  return undefined;
}

/** The path as people see it, without the leading slash. */
export function display(path: string) {
  return path.replace(/^\//, '');
}

/** The IDs of the files directly in a directory, from their names, sorted. */
export function idsIn(files: ContentFiles, dir: string): string[] {
  return Object.keys(files)
    .filter((f) => f.startsWith(dir) && !f.slice(dir.length).includes('/'))
    .map((f) => f.slice(dir.length, -'.yaml'.length))
    .sort();
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; problems: string[] };

/** Parses a file's text and checks it against a schema, collecting every problem. */
export function parseYaml<T>(text: string, schema: z.ZodType<T>): ParseResult<T> {
  const doc = parseDocument(text);
  // The parser's messages show the line in error between blank lines.
  if (doc.errors.length) return { ok: false, problems: doc.errors.map((e) => e.message.replace(/\n\s*\n/g, '\n').trimEnd()) };
  const result = schema.safeParse(doc.toJS());
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, problems: result.error.issues.map((i) => `${fieldPath(i.path)}: ${i.message}`) };
}

/** "outputs[2].serves", or "(whole file)" for a problem with the file itself. */
function fieldPath(path: PropertyKey[]) {
  if (path.length === 0) return '(whole file)';
  return path.map((p, i) => (typeof p === 'number' ? `[${p}]` : `${i ? '.' : ''}${String(p)}`)).join('');
}

/** A content file that cannot be read. The message names the file and every problem in it. */
export class ContentError extends Error {
  constructor(
    readonly file: string,
    readonly problems: string[],
  ) {
    super(`Invalid content in ${display(file)}:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    this.name = 'ContentError';
  }
}

/** Reads a file that must exist and be valid, or throws a ContentError. */
export function readFile<T>(files: ContentFiles, path: string, schema: z.ZodType<T>): T {
  const text = files[path];
  if (text === undefined) throw new ContentError(path, ['the file is missing']);
  const result = parseYaml(text, schema);
  if (!result.ok) throw new ContentError(path, result.problems);
  return result.data;
}
