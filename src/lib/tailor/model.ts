// The model edited on the tailoring page (src/pages/[lang]/tailor.astro): the
// processes and activities kept, the reasons for leaving processes out, and
// the lifecycle phases. It is kept in the URL hash so a model can be shared.
// Runs in the browser, so it must not import anything that only runs on the
// server.

/** A process of a PRM version, as the page receives it. */
export type Proc = {
  id: string;
  name: string;
  origin: string;
  purpose: string;
  activities: { id: string; title: string }[];
  inputs: string[];
};

export type Version = {
  id: string;
  title: string;
  processes: Proc[];
  workProducts: Record<string, { name: string; external: boolean; producers: string[] }>;
};

export type Phase = {
  id: string;
  name: string;
  description: string;
  processes: string[];
  iterative: boolean;
  returnsTo: string;
  returnNote: string;
};

export type Lifecycle = {
  id: string;
  name: string;
  version: string;
  description: string;
  processes: string[];
  phases: (Partial<Phase> & { id: string; name: string; processes: string[] })[];
};

/** Everything the page needs, for every version, embedded in the page. */
export type Data = {
  defaultVersion: string;
  base: string;
  versions: Version[];
  lifecycles: Lifecycle[];
};

export interface State {
  version: string;
  project: string;
  selected: Set<string>;
  /** Excluded activities of selected processes, as "P01.A3". */
  excluded: Set<string>;
  rationale: Record<string, string>;
  /** Lifecycle phases with the selected processes in order. */
  phases: Phase[];
  description: string;
  tab: 'processes' | 'phases';
}

/** A version, or the default one when there is no version with that ID. */
export function versionOf(data: Data, id: string) {
  return data.versions.find((v) => v.id === id) ?? data.versions.find((v) => v.id === data.defaultVersion)!;
}

export const phase = (p: Partial<Phase> & { id: string }): Phase => ({
  name: '',
  description: '',
  processes: [],
  iterative: false,
  returnsTo: '',
  returnNote: '',
  ...p,
});

export function phasesOf(lc: Lifecycle) {
  return lc.phases.map((ph) => phase({ ...ph, processes: [...ph.processes] }));
}

/** Phases in the link, in a compact form. */
export function readPhases(text: string | null): Phase[] {
  if (!text) return [];
  try {
    return (JSON.parse(text) as Record<string, any>[]).map((x) =>
      phase({
        id: String(x.i),
        name: String(x.n ?? ''),
        description: String(x.d ?? ''),
        processes: Array.isArray(x.p) ? x.p.map(String) : [],
        iterative: !!x.r,
        returnsTo: String(x.t ?? ''),
        returnNote: String(x.w ?? ''),
      }),
    );
  } catch {
    return [];
  }
}

export function writePhases(phases: Phase[]) {
  return JSON.stringify(
    phases.map((p) => ({
      i: p.id,
      n: p.name,
      ...(p.description && { d: p.description }),
      p: p.processes,
      ...(p.iterative && { r: 1 }),
      ...(p.returnsTo && { t: p.returnsTo }),
      ...(p.returnsTo && p.returnNote && { w: p.returnNote }),
    })),
  );
}

/**
 * The reasons for leaving processes out, as the link keeps them (JSON of
 * process → text). Anything else, or broken JSON, reads as no reasons.
 */
export function readRationale(text: string | null): Record<string, string> {
  try {
    const r: unknown = JSON.parse(text ?? '{}');
    if (r && typeof r === 'object' && !Array.isArray(r)) {
      return Object.fromEntries(Object.entries(r).filter(([, value]) => typeof value === 'string'));
    }
  } catch {}
  return {};
}

/** The model in a URL hash (without the "#"). */
export function fromHash(data: Data, hash: string): State {
  const h = new URLSearchParams(hash);
  const v = versionOf(data, h.get('v') ?? data.defaultVersion);
  const lc = data.lifecycles.find((l) => l.id === h.get('lc'));
  const all = v.processes.map((p) => p.id);
  const selected = h.has('p') ? h.get('p')!.split(',').filter(Boolean) : lc ? lc.processes : all;
  const rationale = readRationale(h.get('r'));
  return {
    version: v.id,
    project: h.get('n') ?? (lc && !h.has('p') ? lc.name : ''),
    selected: new Set(selected.filter((id) => all.includes(id))),
    excluded: new Set((h.get('x') ?? '').split(',').filter(Boolean)),
    rationale,
    phases: h.has('ph') ? readPhases(h.get('ph')) : lc ? phasesOf(lc) : [],
    description: h.get('ld') ?? (lc && !h.has('p') ? lc.description : ''),
    tab: h.get('t') === 'phases' || (lc && !h.has('p')) ? 'phases' : 'processes',
  };
}

/** The URL hash (without the "#") for the model. */
export function toHash(state: State) {
  const h = new URLSearchParams();
  h.set('v', state.version);
  if (state.project) h.set('n', state.project);
  h.set('p', [...state.selected].join(','));
  if (state.excluded.size) h.set('x', [...state.excluded].join(','));
  const r = Object.fromEntries(Object.entries(state.rationale).filter(([id, text]) => text && !state.selected.has(id)));
  if (Object.keys(r).length) h.set('r', JSON.stringify(r));
  if (state.phases.length) h.set('ph', writePhases(state.phases));
  if (state.description) h.set('ld', state.description);
  if (state.tab === 'phases') h.set('t', 'phases');
  return h.toString();
}

/** Keep the phases in step with the selection: only selected processes of the version, each loop to an existing phase. */
export function syncPhases(state: State, v: Version) {
  const ids = new Set(v.processes.map((p) => p.id));
  const phaseIds = new Set(state.phases.map((p) => p.id));
  for (const p of state.phases) {
    p.processes = p.processes.filter((id) => ids.has(id) && state.selected.has(id));
    if (p.returnsTo && !phaseIds.has(p.returnsTo)) p.returnsTo = '';
  }
}

export const phaseOf = (state: State, id: string) => state.phases.find((p) => p.processes.includes(id));

/** Selected processes that are in no phase. */
export const unassigned = (state: State, v: Version) => v.processes.filter((p) => state.selected.has(p.id) && !phaseOf(state, p.id));

/** Add a process to a phase in the order of the PRM, unless it is already there. */
export function insertInOrder(p: Phase, id: string, v: Version) {
  if (p.processes.includes(id)) return;
  const order = v.processes.map((x) => x.id);
  const at = p.processes.findIndex((x) => order.indexOf(x) > order.indexOf(id));
  p.processes.splice(at < 0 ? p.processes.length : at, 0, id);
}

/** Put a process in a phase (in the order of the PRM), taking it out of any other; no phase ('') leaves it unassigned. */
export function assignToPhase(state: State, id: string, phaseId: string, v: Version) {
  for (const p of state.phases) p.processes = p.processes.filter((x) => x !== id);
  const target = state.phases.find((p) => p.id === phaseId);
  if (target) insertInOrder(target, id, v);
}

/** Swap the phase at index i with the one delta places away (-1 up, 1 down). */
export function movePhase(state: State, i: number, delta: number) {
  const j = i + delta;
  if (j < 0 || j >= state.phases.length) return;
  [state.phases[i], state.phases[j]] = [state.phases[j], state.phases[i]];
}

/**
 * Move a dragged process from one phase (from, or '' for none) to another
 * (to, or '' to leave it unassigned), before the process before, or at the end.
 */
export function moveProcess(state: State, id: string, from: string, to: string, before?: string) {
  const source = state.phases.find((p) => p.id === from);
  if (source) source.processes.splice(source.processes.indexOf(id), 1);
  const target = state.phases.find((p) => p.id === to);
  if (!target) return;
  target.processes = target.processes.filter((x) => x !== id);
  const at = before ? target.processes.indexOf(before) : -1;
  target.processes.splice(at < 0 ? target.processes.length : at, 0, id);
}

/** The model in another PRM version: the processes in both versions stay selected; the activities may differ, so none is excluded. */
export function inVersion(state: State, v: Version): State {
  const ids = new Set(v.processes.map((p) => p.id));
  return { ...state, version: v.id, selected: new Set([...state.selected].filter((id) => ids.has(id))), excluded: new Set() };
}

/**
 * Start again from every process ('all'), none ('none') or a lifecycle
 * template ('lc:<id>'), which also sets the phases, the name and the
 * description. Returns the template, if it was one.
 */
export function startFrom(state: State, choice: string, data: Data): Lifecycle | undefined {
  const lc = choice.startsWith('lc:') ? data.lifecycles.find((l) => l.id === choice.slice(3)) : undefined;
  if (choice === 'all') state.selected = new Set(versionOf(data, state.version).processes.map((p) => p.id));
  else if (choice === 'none') state.selected = new Set();
  else if (lc) {
    state.selected = new Set(lc.processes);
    state.phases = phasesOf(lc);
    state.description = lc.description;
    state.project = lc.name;
  }
  state.excluded = new Set();
  syncPhases(state, versionOf(data, state.version));
  return lc;
}

export function newPhaseId(state: State) {
  let n = state.phases.length + 1;
  while (state.phases.some((p) => p.id === `phase-${n}`)) n++;
  return `phase-${n}`;
}

export function activeActivities(state: State, p: Proc) {
  return state.selected.has(p.id) ? p.activities.filter((a) => !state.excluded.has(`${p.id}.${a.id}`)) : [];
}

/** Inputs of the selected processes that no selected process produces, with the processes that need them. */
export function missingInputs(state: State, v: Version) {
  const missing = new Map<string, Set<string>>();
  for (const p of v.processes) {
    if (!state.selected.has(p.id)) continue;
    for (const wid of p.inputs) {
      const wp = v.workProducts[wid];
      if (!wp || wp.external || wp.producers.length === 0) continue;
      if (wp.producers.some((pid) => state.selected.has(pid))) continue;
      if (!missing.has(wid)) missing.set(wid, new Set());
      missing.get(wid)!.add(p.id);
    }
  }
  return missing;
}

/** Lowercase ASCII words joined by hyphens, for IDs and file names. */
export const slug = (x: string) =>
  x
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
