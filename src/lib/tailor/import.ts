// Reading a model back from a file: the JSON export, a lifecycle file (YAML)
// in the format of content/lifecycles, or the CSV export (see export.ts).
import { phase, type Phase, type Version } from './model';

/** A model read from a file, before it is checked against the PRM version. */
export type Imported = {
  version: string;
  project: string;
  description: string;
  selected: string[];
  excluded: string[];
  rationale: Record<string, string>;
  phases: Phase[];
  /** Read from a CSV file, which leaves out part of the model. */
  csv?: boolean;
};

/** An error whose message can be shown as it is. */
export class ImportError extends Error {}

const str = (x: unknown) => (x == null ? '' : String(x));

/**
 * The JSON export, or a lifecycle file (YAML) in the format of content/lifecycles.
 * `untitled` is the name the exports give a model without one, read back as no name.
 */
export function fromObject(x: any, untitled: string): Imported {
  if (!x || typeof x !== 'object' || !(Array.isArray(x.phases) || Array.isArray(x.processes))) throw new Error('Not a lifecycle model');
  const phases: Phase[] = (Array.isArray(x.phases) ? x.phases : []).map((p: any, i: number) =>
    phase({
      id: str(p?.id) || `phase-${i + 1}`,
      name: str(p?.name),
      description: str(p?.description),
      processes: Array.isArray(p?.processes) ? p.processes.map(String) : [],
      iterative: !!p?.iterative,
      returnsTo: str(p?.returnsTo),
      returnNote: str(p?.returnNote),
    }),
  );
  // A lifecycle file only lists the processes of its phases; the JSON export lists every process.
  const procs: any[] | null = Array.isArray(x.processes) ? x.processes.filter((p: any) => p && typeof p === 'object') : null;
  const kept = procs?.filter((p) => p.included !== false);
  const name = str(x.name);
  return {
    version: str(x.prmVersion),
    project: name === untitled ? '' : name,
    description: str(x.description),
    selected: kept ? kept.map((p) => str(p.id)) : phases.flatMap((p) => p.processes),
    excluded: (kept ?? []).flatMap((p) =>
      Array.isArray(p.activities) ? p.activities.filter((a: any) => a?.included === false).map((a: any) => `${p.id}.${a.id}`) : [],
    ),
    rationale: Object.fromEntries((procs ?? []).filter((p) => p.included === false && p.rationale).map((p) => [str(p.id), str(p.rationale)])),
    phases,
  };
}

/** Rows of fields; reads the CSV export and spreadsheets that save it with semicolons. */
export function parseCsv(text: string) {
  const sep = /^[^\n]*;/.test(text) && !/^[^\n]*,/.test(text) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') field += text[i++];
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some(Boolean));
}

/**
 * The CSV export. It has no PRM version, so it is taken from the file name the export
 * gives it (…-v2.csv) or else `fallback`, the version being edited, and no phase order or loops.
 */
export function fromCsv(text: string, file: string, versions: Version[], fallback: Version): Imported {
  const [head, ...lines] = parseCsv(text);
  const col = Object.fromEntries(['process_id', 'phase', 'activity_id', 'included', 'rationale'].map((k) => [k, head?.indexOf(k) ?? -1]));
  if (Object.values(col).some((i) => i < 0)) throw new Error('Not a lifecycle model');
  const named = file.match(/-([^-]+)\.csv$/i)?.[1];
  const v = versions.find((x) => x.id === named) ?? fallback;
  const yes = (x: string) => /^(yes|true|1)$/i.test(x.trim());
  const selected = new Set<string>();
  const excluded: string[] = [];
  const rationale: Record<string, string> = {};
  const phases: Phase[] = [];
  for (const r of lines) {
    const id = r[col.process_id]?.trim();
    if (!id) continue;
    const name = r[col.phase]?.trim() ?? '';
    // A process is in the model when it is in a phase or keeps an activity.
    if (name || yes(r[col.included] ?? '')) selected.add(id);
    if (!yes(r[col.included] ?? '')) excluded.push(`${id}.${r[col.activity_id]?.trim()}`);
    if (r[col.rationale]) rationale[id] = r[col.rationale];
    if (!name) continue;
    let ph = phases.find((p) => p.name === name);
    if (!ph) phases.push((ph = phase({ id: `phase-${phases.length + 1}`, name })));
    if (!ph.processes.includes(id)) ph.processes.push(id);
  }
  return {
    version: v.id,
    project: '',
    description: '',
    selected: [...selected],
    excluded: excluded.filter((key) => selected.has(key.split('.')[0])),
    rationale: Object.fromEntries(Object.entries(rationale).filter(([id]) => !selected.has(id))),
    phases,
    csv: true,
  };
}

/** A model from the text of a file of any of the formats. */
export async function readModel(text: string, file: string, options: { versions: Version[]; fallback: Version; untitled: string }): Promise<Imported> {
  text = text.replace(/^﻿/, '');
  if (/^\s*"?process_id"?[,;]/.test(text)) return fromCsv(text, file, options.versions, options.fallback);
  if (/^\s*\{/.test(text)) return fromObject(JSON.parse(text), options.untitled);
  const { parse } = await import('yaml');
  return fromObject(parse(text), options.untitled);
}
