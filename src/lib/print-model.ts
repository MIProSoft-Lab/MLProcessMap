// A lifecycle model from the builder (src/pages/[lang]/tailor.astro) in the
// printable PRM: the builder links to the printable page with its model, as it
// keeps it in its own address (src/lib/tailor/model.ts), in ?model=…, read here
// with the builder's own readers (readPhases, readRationale). The page
// then prints the processes of the model, without the activities left out,
// under the model's phases, followed by the processes left out and why.
import type { Translate } from './client-strings';
import { readPhases, readRationale, type Phase } from './tailor/model';

export interface PrintModel {
  project: string;
  description: string;
  /** The processes in the model, in the order of the PRM. */
  selected: string[];
  /** Activities left out, as "P01.A3". */
  excluded: Set<string>;
  /** Why a process was left out, by process. */
  rationale: Record<string, string>;
  phases: Phase[];
}

/** The model in the builder's address (without the "#"); only the processes in all are kept. */
export function readPrintModel(hash: string, all: string[]): PrintModel {
  const h = new URLSearchParams(hash);
  const list = (key: string) => (h.get(key) ?? '').split(',').filter(Boolean);
  const chosen = new Set(list('p'));
  return {
    project: h.get('n') ?? '',
    description: h.get('ld') ?? '',
    selected: h.has('p') ? all.filter((id) => chosen.has(id)) : [...all],
    excluded: new Set(list('x')),
    rationale: readRationale(h.get('r')),
    phases: readPhases(h.get('ph')).map((p) => ({ ...p, processes: p.processes.filter((id) => chosen.has(id) || !h.has('p')) })),
  };
}

/** The strings this module uses; the page hands them to its script. */
export const modelKeys = [
  'print.phase',
  'print.basedOn',
  'print.unassigned',
  'print.leftOut',
  'print.returnsTo',
  'print.repeats',
  'tailor.phase-new',
] as const;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};

/** The name a phase is printed with: its own, or "Phase n". */
const phaseName = (p: Phase, i: number, s: Translate) => p.name || s('tailor.phase-new', { n: i + 1 });
/** A phase's number as printed, two digits after the word: "Phase 01". */
const step = (i: number, s: Translate) => s('print.phase', { n: String(i + 1).padStart(2, '0') });

/** A group of processes in the printed model: a phase, or those in no phase. */
export interface PhaseGroup {
  /** "Phase 01", for a phase. */
  step?: string;
  title: string;
  description?: string;
  /** Whether the phase repeats, and where it returns to. */
  notes: string[];
  /** The group as the contents name it. */
  toc: string;
  processes: string[];
}

/**
 * How the model is printed, before it is put in the page: its processes in
 * groups, one for each phase and one for those in no phase (no groups when the
 * model has no phases), and the processes of the version left out of it. all
 * is every process of the version, in order.
 */
export function modelLayout(m: PrintModel, all: string[], s: Translate): { groups: PhaseGroup[]; leftOut: string[] } {
  const chosen = new Set(m.selected);
  const leftOut = all.filter((id) => !chosen.has(id));
  if (!m.phases.length) return { groups: [], leftOut };
  const groups: PhaseGroup[] = m.phases.map((p, i) => {
    const notes: string[] = [];
    if (p.iterative) notes.push(`↻ ${s('print.repeats')}`);
    const back = m.phases.findIndex((o) => o.id === p.returnsTo);
    if (back >= 0) {
      const target = `${step(back, s)} · ${phaseName(m.phases[back], back, s)}`;
      notes.push(`↩ ${s('print.returnsTo', { phase: target })}${p.returnNote ? `: ${p.returnNote}` : ''}`);
    }
    return {
      step: step(i, s),
      title: phaseName(p, i, s),
      ...(p.description && { description: p.description }),
      notes,
      toc: `${step(i, s)} · ${phaseName(p, i, s)}`,
      processes: p.processes.filter((id) => all.includes(id)),
    };
  });
  const placed = new Set(groups.flatMap((g) => g.processes));
  const rest = m.selected.filter((id) => !placed.has(id));
  if (rest.length) groups.push({ title: s('print.unassigned'), notes: [], toc: s('print.unassigned'), processes: rest });
  return { groups, leftOut };
}

/**
 * Turn the printed PRM in doc into the model, laid out by modelLayout: its name
 * on the cover, its activities only, its processes under its phases (and in
 * the contents), and the processes left out with their reasons. Which
 * processes print is left to the options, which start from those of the model.
 */
export function applyModel(doc: HTMLElement, m: PrintModel, s: Translate) {
  // The cover: the model's name and description, and the PRM it comes from.
  const cover = doc.querySelector<HTMLElement>('.pd-cover')!;
  const title = cover.querySelector('h1')!;
  const version = cover.querySelector<HTMLElement>('.pd-version')!;
  if (m.project) title.textContent = m.project;
  version.textContent = s('print.basedOn', { prm: `ML-PRM ${doc.dataset.version} · ${version.textContent}` });
  if (m.description) version.after(el('p', 'pd-model-description', m.description));

  // The activities left out.
  doc.querySelectorAll<HTMLElement>('[data-activity]').forEach((a) => (a.hidden = m.excluded.has(a.dataset.activity!)));

  const articles = new Map([...doc.querySelectorAll<HTMLElement>('.print-process')].map((a) => [a.dataset.process!, a]));
  const { groups, leftOut } = modelLayout(m, [...articles.keys()], s);
  const end = doc.querySelector('.pd-references')!;

  // The processes under their phases, then those in no phase. Each group in the
  // contents is one item, its name over its processes, so a column never splits it.
  if (groups.length) {
    const toc = doc.querySelector<HTMLElement>('.pd-toc ol')!;
    const tocItems = new Map([...toc.querySelectorAll<HTMLElement>('[data-toc]')].map((li) => [li.dataset.toc!, li]));
    for (const g of groups) {
      const heading = el('header', 'pd-phase');
      if (g.step) heading.append(el('p', 'pd-phase-step mono', g.step));
      heading.append(el('h2', 'pd-phase-title', g.title));
      if (g.description) heading.append(el('p', 'pd-phase-description', g.description));
      for (const note of g.notes) heading.append(el('p', 'pd-phase-note small', note));
      end.before(heading);
      const item = el('li', 'pd-toc-group');
      const inner = el('ol', '');
      item.append(el('p', 'pd-toc-phase', g.toc), inner);
      toc.append(item);
      for (const id of g.processes) {
        end.before(articles.get(id)!);
        inner.append(tocItems.get(id)!);
        tocItems.delete(id);
      }
    }
    // The processes outside the model keep their place in the contents, at the end.
    for (const li of tocItems.values()) toc.append(li);
  }

  // The processes left out, and why.
  if (leftOut.length) {
    const section = el('section', 'pd-left-out');
    section.append(el('h2', '', s('print.leftOut')));
    const list = el('ul', '');
    for (const id of leftOut) {
      const li = el('li', '');
      li.append(el('span', 'mono', id), ` ${articles.get(id)!.querySelector('h2')?.textContent ?? ''}`);
      if (m.rationale[id]) li.append(el('span', 'pd-reason', ` — ${m.rationale[id]}`));
      list.append(li);
    }
    section.append(list);
    end.before(section);
  }
}
