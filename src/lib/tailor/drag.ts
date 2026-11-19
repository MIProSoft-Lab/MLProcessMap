// Dragging the process chips of the lifecycle builder between phases, or
// within one to change their order. A chip is a .pchip with data-pid (the
// process) and data-from (its phase, or '' for none); a place to drop it is a
// .dropzone with data-drop (the phase, or '' for none).

/** The chip a drop at this point goes before, or null for the end. */
function dropBefore(zone: HTMLElement, x: number, y: number) {
  for (const c of zone.querySelectorAll<HTMLElement>('.pchip:not(.dragging)')) {
    const r = c.getBoundingClientRect();
    if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) return c;
  }
  return null;
}

/**
 * Let the chips inside panel be dragged and dropped. The places a drop would
 * go are marked as the pointer moves; onDrop gets the process, the phase it
 * came from, the phase it goes to and the process it goes before, if any.
 */
export function enableDragging(panel: HTMLElement, onDrop: (id: string, from: string, to: string, before?: string) => void) {
  let dragged: { id: string; from: string } | null = null;

  const clearMarks = () =>
    panel
      .querySelectorAll('.drop-target, .drop-before, .drop-end')
      .forEach((x) => x.classList.remove('drop-target', 'drop-before', 'drop-end'));

  panel.addEventListener('dragstart', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.pchip');
    if (!el) return;
    dragged = { id: el.dataset.pid!, from: el.dataset.from! };
    e.dataTransfer!.effectAllowed = 'move';
    e.dataTransfer!.setData('text/plain', dragged.id);
    requestAnimationFrame(() => el.classList.add('dragging'));
  });

  panel.addEventListener('dragover', (e) => {
    const zone = (e.target as HTMLElement).closest<HTMLElement>('.dropzone');
    if (!dragged || !zone) return;
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    clearMarks();
    zone.classList.add('drop-target');
    const before = dropBefore(zone, e.clientX, e.clientY);
    if (before) before.classList.add('drop-before');
    else if (zone.dataset.drop) zone.classList.add('drop-end');
  });

  panel.addEventListener('dragleave', (e) => {
    if (!(e.relatedTarget instanceof Node) || !panel.contains(e.relatedTarget)) clearMarks();
  });

  panel.addEventListener('drop', (e) => {
    const zone = (e.target as HTMLElement).closest<HTMLElement>('.dropzone');
    if (!dragged || !zone) return;
    e.preventDefault();
    const { id, from } = dragged;
    dragged = null;
    onDrop(id, from, zone.dataset.drop ?? '', dropBefore(zone, e.clientX, e.clientY)?.dataset.pid);
  });

  panel.addEventListener('dragend', () => {
    dragged = null;
    clearMarks();
    panel.querySelectorAll('.dragging').forEach((x) => x.classList.remove('dragging'));
  });
}
