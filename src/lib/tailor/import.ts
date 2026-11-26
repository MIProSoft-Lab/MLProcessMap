// Reading a model back from a file: the JSON export, or a lifecycle file (YAML)
// in the format of content/lifecycles (see export.ts).
import { phase, type Phase, type State, type Version } from './model';

/** A model read from a file, before it is checked against the PRM version. */
export type Imported = {
  version: string;
  project: string;
  description: string;
  selected: string[];
  excluded: string[];
  rationale: Record<string, string>;
  phases: Phase[];
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
    rationale: Object.fromEntries(
      (procs ?? []).filter((p) => p.included === false && p.rationale).map((p) => [str(p.id), str(p.rationale)]),
    ),
    phases,
  };
}

/**
 * The model to edit from one read from a file, in its PRM version: processes
 * the version does not have are left out and listed in `unknown`. It opens on
 * the phases when it has any.
 */
export function toState(m: Imported, v: Version): { state: State; unknown: string[] } {
  const ids = new Set(v.processes.map((p) => p.id));
  const unknown = [...new Set([...m.selected, ...m.phases.flatMap((p) => p.processes)])].filter((id) => !ids.has(id));
  return {
    state: {
      version: v.id,
      project: m.project,
      description: m.description,
      selected: new Set(m.selected.filter((id) => ids.has(id))),
      excluded: new Set(m.excluded),
      rationale: m.rationale,
      phases: m.phases,
      tab: m.phases.length ? 'phases' : 'processes',
    },
    unknown,
  };
}

/** A model from the text of a JSON or YAML file. `untitled` as in fromObject. */
export async function readModel(text: string, untitled: string): Promise<Imported> {
  text = text.replace(/^﻿/, '');
  if (/^\s*\{/.test(text)) return fromObject(JSON.parse(text), untitled);
  const { parse } = await import('yaml');
  return fromObject(parse(text), untitled);
}
