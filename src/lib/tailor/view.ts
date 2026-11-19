// Redrawing the lifecycle builder's lists replaces every row, which would close
// the open lists and drop the keyboard focus. rememberView notes both before a
// redraw and returns the way to put them back.

const ROWS = 'li.proc, li.phase-card';

/** A selector that finds a row (a process or a phase card) again after a redraw. */
const rowSelector = (row: HTMLElement) =>
  row.dataset.phase !== undefined
    ? `#phases [data-phase="${CSS.escape(row.dataset.phase)}"]`
    : `#processes [data-id="${CSS.escape(row.dataset.id!)}"]`;

/**
 * Note the open lists and the focused control in the process list (#processes)
 * and the phases (#phases). The returned function reopens them and puts the
 * focus back; when the control is gone (a removed chip, a removed phase), its
 * row's first control gets it, or fallback.
 */
export function rememberView(lists: HTMLElement[], fallback: () => HTMLElement) {
  const open = [...document.querySelectorAll<HTMLElement>('#processes details[open], #phases details[open]')].map((d) =>
    rowSelector(d.closest<HTMLElement>(ROWS)!),
  );
  const active = document.activeElement;
  const row = active instanceof HTMLElement && lists.some((l) => l.contains(active)) ? active.closest<HTMLElement>(ROWS) : null;
  // The focused control is found again by its tag and data attributes, e.g. input[data-proc="P01"].
  const focused = row && {
    row: rowSelector(row),
    el:
      active!.tagName.toLowerCase() +
      [...active!.attributes]
        .filter((a) => a.name.startsWith('data-'))
        .map((a) => `[${a.name}="${CSS.escape(a.value)}"]`)
        .join(''),
  };
  return () => {
    for (const sel of open) document.querySelector<HTMLDetailsElement>(`${sel} details`)?.setAttribute('open', '');
    if (!focused) return;
    const again =
      document.querySelector<HTMLElement>(`${focused.row} ${focused.el}`) ??
      document.querySelector<HTMLElement>(`${focused.row} :is(input, select, button:not(:disabled))`) ??
      fallback();
    again.focus();
  };
}
