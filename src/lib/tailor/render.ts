// The HTML of the lifecycle builder's lists, drawn in the browser from the
// model: a process in the list, a phase card, a process chip, the menus, the
// missing inputs and the print view. Each function only builds text; the page
// (src/pages/[lang]/tailor.astro) puts it in place and handles the events.
import type { Translate } from '../client-strings';
import { escapeHtml as esc } from '../text';
import * as exporter from './export';
import type { Data, Phase, Proc, State, Version } from './model';

/** The strings these templates use; the page hands them to its script. */
export const renderKeys = [
  'modal.details',
  'process.activities',
  'process.producedBy',
  'nav.lifecycles',
  'lc.iterative',
  'tailor.allCovered',
  'tailor.rationale',
  'tailor.start-all',
  'tailor.start-none',
  'tailor.start-note',
  'tailor.untitled',
  'tailor.unassigned',
  'tailor.unassigned-none',
  'tailor.phase-new',
  'tailor.phase-name',
  'tailor.phase-up',
  'tailor.phase-down',
  'tailor.phase-remove',
  'tailor.phase-description',
  'tailor.phase-returnsTo',
  'tailor.phase-noReturn',
  'tailor.phase-returnNote',
  'tailor.phase-drop',
  'tailor.phase-drop-touch',
  'tailor.phase-addProcess',
  'tailor.phase-unassign',
  'tailor.phase-none',
  'tailor.phase-of',
] as const;

/** What every template reads: the model, its PRM version and the strings. */
export interface View {
  state: State;
  version: Version;
  s: Translate;
}

/** A phase's position as two digits: 01, 02… */
export const step = (i: number) => String(i + 1).padStart(2, '0');

/** A phase as the menus show it: its position and name, or "Phase n" while it has none. */
export const phaseLabel = (p: Phase, i: number, s: Translate) => `${step(i)} ${p.name || s('tailor.phase-new', { n: i + 1 })}`;

const procOf = (v: View, id: string) => v.version.processes.find((p) => p.id === id);

/** The menu next to a selected process to put it in a phase, once there are phases. */
export function phaseSelect({ state, s }: View, id: string) {
  if (!state.phases.length || !state.selected.has(id)) return '';
  const current = state.phases.find((p) => p.processes.includes(id))?.id ?? '';
  const options = [`<option value="">${esc(s('tailor.phase-none'))}</option>`]
    .concat(
      state.phases.map((p, i) => `<option value="${esc(p.id)}" ${p.id === current ? 'selected' : ''}>${esc(phaseLabel(p, i, s))}</option>`),
    )
    .join('');
  return `<select class="phase-select" data-phase-of="${id}" aria-label="${esc(s('tailor.phase-of', { id }))}">${options}</select>`;
}

/** A process in the list of the first tab, with its activities and, when left out, the reason. */
export function processRow(view: View, p: Proc) {
  const { state, s } = view;
  const on = state.selected.has(p.id);
  const acts = p.activities
    .map(
      (
        a,
      ) => `<li><label><input type="checkbox" data-act="${p.id}.${a.id}" ${state.excluded.has(`${p.id}.${a.id}`) ? '' : 'checked'} ${on ? '' : 'disabled'}>
              <span class="aid">${a.id}</span> ${esc(a.title)}</label></li>`,
    )
    .join('');
  return `<li class="proc ${on ? '' : 'off'}" data-id="${p.id}">
          <div class="proc-head" data-hover-process="${p.id}" data-hover-version="${state.version}">
            <label class="proc-label"><input type="checkbox" data-proc="${p.id}" ${on ? 'checked' : ''}>
              <span class="dot origin-${p.origin}"></span><span class="num">${p.id}</span> <strong>${esc(p.name)}</strong></label>
            <span class="proc-tools">${phaseSelect(view, p.id)}
              <button type="button" class="info" data-info="${p.id}" aria-label="${esc(s('modal.details', { name: p.name }))}">i</button></span>
          </div>
          <details><summary class="small muted">${s('process.activities')} (<span data-count="${p.id}"></span>)</summary><div class="collapse-body"><ul class="acts">${acts}</ul></div></details>
          <label class="rationale small" ${on ? 'hidden' : ''}><span>${s('tailor.rationale')}</span>
            <input type="text" data-why="${p.id}" value="${esc(state.rationale[p.id] ?? '')}"></label>
        </li>`;
}

/** A process that can be dragged between phases; in a phase (from), with a button to take it out. */
export function processChip(view: View, id: string, from: string) {
  const p = procOf(view, id);
  if (!p) return '';
  const { state, s } = view;
  return `<li class="pchip origin-${p.origin}" draggable="true" data-pid="${id}" data-from="${esc(from)}" data-hover-process="${id}" data-hover-version="${state.version}">
      <span class="num">${id}</span><span class="pchip-name">${esc(p.name)}</span>
      ${from ? `<button type="button" class="pchip-x" data-unassign="${id}" data-from="${esc(from)}" aria-label="${esc(s('tailor.phase-unassign', { id }))}">×</button>` : ''}
    </li>`;
}

/**
 * A phase in the second tab. free are the selected processes in no phase, for
 * the menu that adds a process; touch says the screen cannot drag the chips.
 */
export function phaseCard(view: View, p: Phase, i: number, { free, touch }: { free: Proc[]; touch: boolean }) {
  const { state, s } = view;
  const others = state.phases
    .map((o, k) =>
      o.id === p.id ? '' : `<option value="${esc(o.id)}" ${o.id === p.returnsTo ? 'selected' : ''}>${esc(phaseLabel(o, k, s))}</option>`,
    )
    .join('');
  // The menu adds a process without a phase, or moves one here from another
  // phase, which is the way to arrange them without dragging.
  const option = (id: string) => `<option value="${id}">${id} ${esc(procOf(view, id)?.name ?? '')}</option>`;
  const group = (label: string, ids: string[]) =>
    ids.length ? `<optgroup label="${esc(label)}">${ids.map(option).join('')}</optgroup>` : '';
  const choices =
    group(
      s('tailor.phase-none'),
      free.map((f) => f.id),
    ) + state.phases.map((o, k) => (o.id === p.id ? '' : group(phaseLabel(o, k, s), o.processes))).join('');
  const add = choices
    ? `<select class="pc-add" data-add-to="${esc(p.id)}"><option value="">${esc(s('tailor.phase-addProcess'))}</option>${choices}</select>`
    : '';
  return `<li class="phase-card" data-phase="${esc(p.id)}">
          <div class="pc-head">
            <span class="pc-step">${step(i)}</span>
            <input type="text" class="pc-name" data-field="name" value="${esc(p.name)}" placeholder="${esc(s('tailor.phase-new', { n: i + 1 }))}" aria-label="${esc(s('tailor.phase-name'))}">
            <span class="pc-tools">
              <button type="button" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="${esc(s('tailor.phase-up'))}" title="${esc(s('tailor.phase-up'))}">↑</button>
              <button type="button" data-move="1" ${i === state.phases.length - 1 ? 'disabled' : ''} aria-label="${esc(s('tailor.phase-down'))}" title="${esc(s('tailor.phase-down'))}">↓</button>
              <button type="button" data-remove aria-label="${esc(s('tailor.phase-remove'))}" title="${esc(s('tailor.phase-remove'))}">✕</button>
            </span>
          </div>
          <ul class="pc-procs dropzone" data-drop="${esc(p.id)}">${p.processes.map((id) => processChip(view, id, p.id)).join('') || `<li class="pc-empty small muted">${esc(touch && add ? s('tailor.phase-drop-touch') : s('tailor.phase-drop'))}</li>`}</ul>
          ${add}
          <div class="pc-options small">
            <label><input type="checkbox" data-field="iterative" ${p.iterative ? 'checked' : ''}> ↻ ${esc(s('lc.iterative'))}</label>
            <label>↩ ${esc(s('tailor.phase-returnsTo'))}
              <select data-field="returnsTo"><option value="">${esc(s('tailor.phase-noReturn'))}</option>${others}</select></label>
            <label class="pc-note" ${p.returnsTo ? '' : 'hidden'}>${esc(s('tailor.phase-returnNote'))}
              <input type="text" data-field="returnNote" value="${esc(p.returnNote)}"></label>
          </div>
          <details class="small" ${p.description ? 'open' : ''}><summary class="muted">${esc(s('tailor.phase-description'))}</summary>
            <div class="collapse-body"><textarea data-field="description" rows="2">${esc(p.description)}</textarea></div></details>
        </li>`;
}

/** The selected processes in no phase, as chips, or a note that there are none. */
export function unassignedChips(view: View, free: Proc[]) {
  return (
    free.map((p) => processChip(view, p.id, '')).join('') ||
    `<li class="pc-empty small muted">${esc(view.s('tailor.unassigned-none'))}</li>`
  );
}

/** The inputs no selected process produces, each with buttons to add a process that does. */
export function missingList({ version, s }: View, missing: Map<string, Set<string>>) {
  return missing.size
    ? [...missing]
        .map(([wid, users]) => {
          const wp = version.workProducts[wid];
          return `<li><strong>${esc(wp.name)}</strong> <span class="muted">→ ${[...users].join(', ')}</span><br>
              <span class="muted">${s('process.producedBy')}:</span> ${wp.producers
                .map((pid) => `<button type="button" class="link" data-add="${pid}">+ ${pid}</button>`)
                .join(' ')}</li>`;
        })
        .join('')
    : `<li class="muted">${s('tailor.allCovered')}</li>`;
}

/** The "Start from" menu: every process, none, or a lifecycle template of the version. */
export function startOptions(data: Data, state: State, s: Translate) {
  const lcs = data.lifecycles.filter((l) => l.version === state.version);
  const item = (value: string, label: string) => `<li><button type="button" data-start="${esc(value)}">${esc(label)}</button></li>`;
  return (
    item('all', s('tailor.start-all')) +
    item('none', s('tailor.start-none')) +
    (lcs.length ? `<li class="menu-group">${esc(s('nav.lifecycles'))}</li>${lcs.map((l) => item(`lc:${l.id}`, l.name)).join('')}` : '') +
    `<li class="menu-foot">${esc(s('tailor.start-note'))}</li>`
  );
}

/** The page printed: the model as a checklist of activities, by phase when there are phases. */
export function printView(view: View) {
  const { state, s } = view;
  const phased = state.phases.length > 0;
  return (
    `<h1>${esc(state.project || s('tailor.untitled'))}</h1><p>PRM ${esc(state.version)}</p>` +
    exporter
      .groups(view)
      .map(
        (g) =>
          (phased
            ? `<h2>${esc(g.phase ? `${step(state.phases.indexOf(g.phase))} ${exporter.phaseName(state, g.phase, s)}` : s('tailor.unassigned'))}</h2>`
            : '') +
          g.rows
            .map(
              (x) =>
                `<h3>${x.p.id} ${esc(x.p.name)}</h3><ul>${x.activities
                  .filter((a) => a.included)
                  .map((a) => `<li>☐ ${a.id}. ${esc(a.title)}</li>`)
                  .join('')}</ul>`,
            )
            .join(''),
      )
      .join('')
  );
}
