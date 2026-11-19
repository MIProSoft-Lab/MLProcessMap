// What the printable PRM (src/pages/[lang]/[version]/print.astro) includes and
// how it looks, kept in the address so a configuration can be bookmarked or
// shared. Every option but the processes, the text size and the paper is a
// setting that is on or off, with a default; only what differs from the
// defaults is written:
//
//   ?p=P01,P08          only these processes (all when absent)
//   &off=cover,origin   settings turned off that are on by default
//   &on=notes           settings turned on that are off by default
//   &size=small         text size: small, normal or large
//   &paper=letter       paper size: a4 or letter
//   &ht=…, &ft=…        texts of the header and the footer, when not the page's own
//
// An address with settings (off, on, size, paper, ht or ft) gives all of them,
// as the page writes it: it means the same wherever it is opened. Without
// them, the settings are those remembered in the browser (print-page.ts), and
// the address only chooses what to print:
//
//   ?only=P08           one process, without the cover, the map and the contents
//   ?model=…            a model from the lifecycle builder (print-model.ts)

/**
 * Every setting with its default, in the order of the document, which the
 * options panel follows. A setting
 * with a parent only has an effect while the parent is on: the origin legend
 * is part of the cover, the colours of the map go with the map.
 */
export const settings = {
  // The document, in its order: the cover (its lines in their order on it), the
  // map, the acronyms, the contents; the references come at the end.
  cover: { default: true },
  author: { default: true, parent: 'cover' },
  legend: { default: false, parent: 'cover' },
  printed: { default: true, parent: 'cover' },
  map: { default: true },
  activityCount: { default: false, parent: 'map' },
  mapColour: { default: false, parent: 'map' },
  acronyms: { default: false },
  toc: { default: false },
  references: { default: false },
  // Each process, in its order: the heading (the ID, then the origin), then its parts.
  idColour: { default: false },
  origin: { default: false },
  purpose: { default: true },
  outcomes: { default: true },
  interface: { default: true },
  // Inputs and outputs in two columns; without it, outputs go below inputs.
  ioSideBySide: { default: true, parent: 'interface' },
  wpType: { default: false, parent: 'interface' },
  serves: { default: true, parent: 'interface' },
  ioDescriptions: { default: true, parent: 'interface' },
  links: { default: false, parent: 'interface' },
  activities: { default: true },
  // The box to tick comes before the ID of each activity, its description and sources after.
  checklist: { default: false, parent: 'activities' },
  descriptions: { default: true, parent: 'activities' },
  sources: { default: false, parent: 'activities' },
  standards: { default: true },
  changes: { default: false },
  notes: { default: false },
  // The page, from top to bottom, then its layout.
  header: { default: true },
  footer: { default: true },
  pageNumbers: { default: true },
  breaks: { default: true },
} as const satisfies Record<string, { default: boolean; parent?: string }>;

export type Setting = keyof typeof settings;
const names = Object.keys(settings) as Setting[];

export const sizes = ['small', 'normal', 'large'] as const;
export const papers = ['a4', 'letter'] as const;

export interface PrintOptions {
  /** The processes to print, in the order of the PRM. */
  processes: string[];
  /** The settings that are on. */
  on: Set<Setting>;
  size: (typeof sizes)[number];
  paper: (typeof papers)[number];
  /** Texts of the header and the footer; without them, the page's own (its name, its authors). */
  headerText?: string;
  footerText?: string;
}

export const defaults = (all: string[]): PrintOptions => ({
  processes: [...all],
  on: new Set(names.filter((n) => settings[n].default)),
  size: 'normal',
  paper: 'a4',
});

/** Whether a setting has an effect: it is on, and so is its parent, if it has one. */
export function isOn(o: PrintOptions, name: Setting): boolean {
  const parent = (settings[name] as { parent?: Setting }).parent;
  return o.on.has(name) && (!parent || isOn(o, parent));
}

const list = (x: string | null) => (x ? x.split(',').filter(Boolean) : []);
const known = (xs: string[]) => xs.filter((x): x is Setting => names.includes(x as Setting));
const oneOf = <T extends string>(values: readonly T[], x: string | null, fallback: T) => (values.includes(x as T) ? (x as T) : fallback);

/**
 * The options in a query string; anything missing or unknown keeps its value in
 * base: the defaults, or the settings remembered in the browser. all is every
 * process of the version, in order.
 */
export function readOptions(search: string, all: string[], base: PrintOptions = defaults(all)): PrintOptions {
  const q = new URLSearchParams(search);
  const d = base;
  const chosen = new Set(list(q.get('p')));
  const on = new Set(d.on);
  for (const n of known(list(q.get('off')))) on.delete(n);
  for (const n of known(list(q.get('on')))) on.add(n);
  return {
    processes: q.has('p') ? all.filter((id) => chosen.has(id)) : d.processes,
    on,
    size: oneOf(sizes, q.get('size'), d.size),
    paper: oneOf(papers, q.get('paper'), d.paper),
    ...((q.has('ht') || d.headerText !== undefined) && { headerText: q.get('ht') ?? d.headerText }),
    ...((q.has('ft') || d.footerText !== undefined) && { footerText: q.get('ft') ?? d.footerText }),
  };
}

/** The query string (without "?") for the options, with only what differs from the defaults. */
export function writeOptions(o: PrintOptions, all: string[]): string {
  const q = new URLSearchParams();
  if (o.processes.length !== all.length) q.set('p', o.processes.join(','));
  const off = names.filter((n) => settings[n].default && !o.on.has(n));
  const on = names.filter((n) => !settings[n].default && o.on.has(n));
  if (off.length) q.set('off', off.join(','));
  if (on.length) q.set('on', on.join(','));
  if (o.size !== 'normal') q.set('size', o.size);
  if (o.paper !== 'a4') q.set('paper', o.paper);
  if (o.headerText !== undefined) q.set('ht', o.headerText);
  if (o.footerText !== undefined) q.set('ft', o.footerText);
  return readableQuery(q);
}

/** A query string with its commas left as they are, so that lists read well in the address. */
export const readableQuery = (q: URLSearchParams) => q.toString().replace(/%2C/g, ',');

/** Whether an address gives the settings, rather than leaving them to those remembered. */
export const hasSettings = (search: string) => ['off', 'on', 'size', 'paper', 'ht', 'ft'].some((k) => new URLSearchParams(search).has(k));

/**
 * One process alone, as its page links to it: without the cover, the map and
 * the contents, and otherwise as in base (the settings remembered).
 */
export function onlyProcess(base: PrintOptions, id: string, all: string[]): PrintOptions {
  const on = new Set(base.on);
  for (const n of ['cover', 'map', 'toc'] as const) on.delete(n);
  return { ...base, on, processes: all.includes(id) ? [id] : base.processes };
}

/** The address of the printable version of one process. */
export const printHref = (base: string, id: string) => `${base}?only=${encodeURIComponent(id)}`;
