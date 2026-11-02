// Exports of the tailored model: a Markdown checklist, a CSV of the activities,
// the JSON of the whole model, and a lifecycle file in the format of
// content/lifecycles/<lang>/<id>.yaml. import.ts reads the JSON, CSV and YAML back.
import type { Translate } from '../lifecycle-diagram';
import { phaseOf, slug, type Phase, type State, type Version } from './model';

export interface ExportContext {
  state: State;
  /** The version of the model. */
  version: Version;
  s: Translate;
  /** Link to the model on the tailoring page. */
  link: string;
}

/** Every process of the version, with what the model keeps of it. */
export function rows({ state, version }: Pick<ExportContext, 'state' | 'version'>) {
  return version.processes.map((p) => ({
    p,
    included: state.selected.has(p.id),
    activities: p.activities.map((a) => ({ ...a, included: state.selected.has(p.id) && !state.excluded.has(`${p.id}.${a.id}`) })),
    rationale: state.rationale[p.id] ?? '',
  }));
}

export const phaseName = (state: State, p: Phase, s: Translate) => p.name || s('tailor.phase-new', { n: state.phases.indexOf(p) + 1 });

/** The included processes grouped by phase, in lifecycle order; those without a phase come last. */
export function groups(ctx: Pick<ExportContext, 'state' | 'version'>) {
  const { state } = ctx;
  const r = rows(ctx).filter((x) => x.included);
  const byId = new Map(r.map((x) => [x.p.id, x]));
  const out = state.phases.map((ph) => ({ phase: ph as Phase | null, rows: ph.processes.map((id) => byId.get(id)!).filter(Boolean) }));
  const rest = r.filter((x) => !phaseOf(state, x.p.id));
  if (rest.length || !out.length) out.push({ phase: null, rows: rest });
  return out;
}

export function markdown(ctx: ExportContext) {
  const { state, s } = ctx;
  const name = (p: Phase) => phaseName(state, p, s);
  const r = rows(ctx);
  const title = state.project || s('tailor.untitled');
  let out = `# ${title}\n\nPRM ${state.version} · ${ctx.link}\n\n`;
  if (state.description) out += `${state.description}\n\n`;
  const phased = state.phases.length > 0;
  for (const g of groups(ctx)) {
    if (phased) {
      const ph = g.phase;
      out += ph ? `## ${String(state.phases.indexOf(ph) + 1).padStart(2, '0')} ${name(ph)}${ph.iterative ? ` (↻ ${s('lc.iterative')})` : ''}\n\n` : `## ${s('tailor.unassigned')}\n\n`;
      if (ph?.description) out += `${ph.description}\n\n`;
      const back = ph?.returnsTo && state.phases.find((x) => x.id === ph.returnsTo);
      if (back) out += `↩ ${s('tailor.phase-returnsTo')} ${name(back)}${ph!.returnNote ? `: ${ph!.returnNote}` : ''}\n\n`;
    }
    for (const x of g.rows) {
      out += `${phased ? '###' : '##'} ${x.p.id} ${x.p.name}\n\n${x.p.purpose}\n\n`;
      for (const a of x.activities) if (a.included) out += `- [ ] ${a.id}. ${a.title}\n`;
      const skipped = x.activities.filter((a) => !a.included);
      if (skipped.length) out += `\n${s('tailor.excluded')}: ${skipped.map((a) => a.id).join(', ')}\n`;
      out += '\n';
    }
  }
  const excluded = r.filter((x) => !x.included);
  if (excluded.length) {
    out += `## ${s('tailor.excluded')}\n\n`;
    for (const x of excluded) out += `- ${x.p.id} ${x.p.name}${x.rationale ? `: ${x.rationale}` : ''}\n`;
  }
  return out;
}

export function csv(ctx: Omit<ExportContext, 'link'>) {
  const { state, s } = ctx;
  const q = (x: string) => `"${x.replace(/"/g, '""')}"`;
  const lines = [['process_id', 'process', 'phase', 'activity_id', 'activity', 'included', 'rationale'].join(',')];
  for (const x of rows(ctx)) {
    const ph = phaseOf(state, x.p.id);
    for (const a of x.activities) {
      lines.push([x.p.id, q(x.p.name), q(ph ? phaseName(state, ph, s) : ''), a.id, q(a.title), a.included ? 'yes' : 'no', q(x.included ? '' : x.rationale)].join(','));
    }
  }
  return lines.join('\n');
}

export function json(ctx: ExportContext) {
  const { state } = ctx;
  return JSON.stringify(
    {
      name: state.project || undefined,
      prmVersion: state.version,
      link: ctx.link,
      description: state.description || undefined,
      phases: state.phases.length ? lifecyclePhases(state, ctx.s) : undefined,
      processes: rows(ctx).map((x) => ({
        id: x.p.id,
        name: x.p.name,
        included: x.included,
        rationale: x.included ? undefined : x.rationale || undefined,
        activities: x.activities.map((a) => ({ id: a.id, title: a.title, included: a.included })),
      })),
    },
    null,
    2,
  );
}

/** Phases with readable, unique IDs made from their names, as in content/lifecycles. */
export function lifecyclePhases(state: State, s: Translate) {
  const ids = new Map<string, string>();
  for (const p of state.phases) {
    const base = slug(phaseName(state, p, s)) || 'phase';
    let id = base;
    for (let n = 2; [...ids.values()].includes(id); n++) id = `${base}-${n}`;
    ids.set(p.id, id);
  }
  return state.phases.map((p) => ({
    id: ids.get(p.id)!,
    name: phaseName(state, p, s),
    ...(p.description && { description: p.description }),
    processes: p.processes,
    ...(p.iterative && { iterative: true }),
    ...(p.returnsTo && { returnsTo: ids.get(p.returnsTo) }),
    ...(p.returnsTo && p.returnNote && { returnNote: p.returnNote }),
  }));
}

/** A lifecycle file in the format of content/lifecycles/<lang>/<id>.yaml. */
export function yaml(state: State, s: Translate) {
  // Plain scalars when they are unambiguous, double-quoted (JSON) strings otherwise.
  const q = (x: string) => (/^[\p{L}\p{N}][\p{L}\p{N} ,.()'’/&–—-]*$/u.test(x) && !/^(true|false|yes|no|on|off|null|~)$/i.test(x) ? x : JSON.stringify(x));
  const name = state.project || s('tailor.untitled');
  let out = `id: ${slug(state.project) || 'lifecycle-model'}\nname: ${q(name)}\nstatus: draft\nprmVersion: ${state.version}\n`;
  if (state.description) out += `description: ${q(state.description)}\n`;
  out += 'phases:\n';
  for (const p of lifecyclePhases(state, s)) {
    out += `  - id: ${p.id}\n    name: ${q(p.name)}\n`;
    if (p.description) out += `    description: ${q(p.description)}\n`;
    out += `    processes: [${p.processes.join(', ')}]\n`;
    if (p.iterative) out += '    iterative: true\n';
    if (p.returnsTo) out += `    returnsTo: ${p.returnsTo}\n`;
    if (p.returnNote) out += `    returnNote: ${q(p.returnNote)}\n`;
  }
  return out;
}
