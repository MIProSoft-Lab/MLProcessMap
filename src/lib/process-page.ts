// The process page in the browser (src/pages/[lang]/[version]/processes/[id].astro):
// the wires of the inputs and outputs diagram, the sections and columns that
// open and close, the button that opens or closes every activity, and opening
// what a link points to.
import { animateDetails, setBodyOpen, setDetailsOpen, willBeOpen } from './collapse';

const NS = 'http://www.w3.org/2000/svg';

/**
 * Route a right-angle wire from every input to the process and from the
 * process to every output of the diagram (src/components/process/Interface.astro).
 * The wires share a vertical bus in each gap. Returns the function that draws
 * them again, which also runs whenever the diagram changes size.
 */
export function flowWires(flow: HTMLElement | null) {
  const svg = flow?.querySelector<SVGSVGElement>('.wires');
  const core = flow?.querySelector<HTMLElement>('.core-box');

  function draw() {
    if (!flow || !svg || !core) return;
    svg.querySelectorAll('path.wire').forEach((p) => p.remove());
    if (getComputedStyle(svg).display === 'none') return;
    // Nothing to route while the whole section is closed or moving.
    if (flow.closest("[data-state='closed'], [data-state='moving']")) return;
    const box = flow.getBoundingClientRect();
    const c = core.getBoundingClientRect();
    const coreY = c.top + c.height / 2 - box.top;
    const wire = (d: string) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', 'wire');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1');
      path.setAttribute('marker-end', 'url(#arrow)');
      svg.appendChild(path);
    };
    // Only the columns that are open and still.
    const nodes = (kind: string) =>
      flow.querySelectorAll<HTMLElement>(`.${kind}:not([data-state='closed'], [data-state='moving']) .io-node`);
    nodes('inputs').forEach((n) => {
      const r = n.getBoundingClientRect();
      const x1 = r.right - box.left;
      const y1 = r.top - box.top + 20;
      const x2 = c.left - box.left;
      const mid = (x1 + x2) / 2;
      wire(`M${x1} ${y1} H${mid} V${coreY} H${x2 - 1}`);
    });
    nodes('outputs').forEach((n) => {
      const r = n.getBoundingClientRect();
      const x1 = c.right - box.left;
      const x2 = r.left - box.left;
      const y2 = r.top - box.top + 20;
      const mid = (x1 + x2) / 2;
      wire(`M${x1} ${coreY} H${mid} V${y2} H${x2 - 1}`);
    });
  }

  if (flow) new ResizeObserver(draw).observe(flow);
  document.fonts?.ready.then(draw);
  return draw;
}

/** Everything the process page does in the browser. */
export function initProcessPage() {
  const drawWires = flowWires(document.querySelector<HTMLElement>('.flow'));

  // Outcomes, inputs, outputs and activities each open and close on their own.
  // A column of the diagram has no wires while it is closed or moving.
  const toggles = [...document.querySelectorAll<HTMLButtonElement>('.collapse-toggle')];
  const bodyOf = (t: HTMLButtonElement) => document.getElementById(t.getAttribute('aria-controls')!)!;
  const setSection = (toggle: HTMLButtonElement, open: boolean, animate = true) => {
    const body = bodyOf(toggle);
    const part = toggle.closest<HTMLElement>('.collapsible')!;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.title = open ? toggle.dataset.collapse! : toggle.dataset.expand!;
    if (toggle.hasAttribute('aria-label')) toggle.setAttribute('aria-label', toggle.title);
    part.dataset.state = 'moving';
    drawWires();
    setBodyOpen(body, open, {
      animate,
      done: () => {
        part.dataset.state = open ? 'open' : 'closed';
        drawWires();
      },
    });
  };
  toggles.forEach((t) => t.addEventListener('click', () => setSection(t, t.getAttribute('aria-expanded') !== 'true')));

  // Every activity, and the button that opens or closes them all.
  animateDetails(document.querySelector('.activities')!);
  const button = document.querySelector<HTMLButtonElement>('.toggle-all');
  const all = [...document.querySelectorAll<HTMLDetailsElement>('.activities details')];
  const sync = () => {
    const anyOpen = all.some(willBeOpen);
    button!.textContent = anyOpen ? button!.dataset.collapse! : button!.dataset.expand!;
  };
  button?.addEventListener('click', () => {
    const open = !all.some(willBeOpen);
    all.forEach((d) => setDetailsOpen(d, open));
    sync();
  });
  all.forEach((d) => d.addEventListener('toggle', sync));

  // Open what a link points to, and the parts that contain it, on load and on in-page links.
  const openTarget = () => {
    if (!location.hash) return;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (!target) return;
    for (const t of toggles) {
      const part = t.closest('.collapsible')!;
      const inside = part.contains(target) && part !== target && !t.contains(target);
      if ((inside || part === target) && t.getAttribute('aria-expanded') !== 'true') setSection(t, true, false);
    }
    const details = target.querySelector('details') ?? target.closest('details');
    if (details) setDetailsOpen(details, true, { animate: false });
    sync();
  };
  openTarget();
  window.addEventListener('hashchange', openTarget);
}
