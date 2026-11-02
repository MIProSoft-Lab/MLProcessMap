// Animated opening and closing of collapsible parts of a page.
//
// A collapsible body is a wrapper without padding, border or margin (class
// collapse-body), so its height can go from zero to its content height. The
// body is hidden with the hidden attribute once closed. The same animation is
// used for <details>, whose body is a collapse-body inside the element.

const DURATION = 220;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)';
const running = new WeakMap<HTMLElement, Animation>();

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Stop the animation of body, if any, leaving it where it is. */
function stop(body: HTMLElement) {
  running.get(body)?.cancel();
  running.delete(body);
  body.style.overflow = '';
}

/**
 * Animate body to open or closed. show and hide make it visible or not
 * (the hidden attribute, or the open state of a <details>), and done runs
 * once it has settled.
 */
function animate(body: HTMLElement, open: boolean, show: () => void, hide: () => void, done?: () => void) {
  // Start from the current height, also when another animation is midway.
  // The content of a closed <details> still has a layout height in some
  // browsers, so a body that is not shown starts from zero.
  const from = body.checkVisibility?.() === false ? 0 : body.getBoundingClientRect().height;
  stop(body);
  if (open) show();
  if (reducedMotion()) {
    if (!open) hide();
    done?.();
    return;
  }
  const to = open ? body.scrollHeight : 0;
  body.style.overflow = 'hidden';
  const animation = body.animate(
    [
      { height: `${from}px`, opacity: open ? 0.4 : 1 },
      { height: `${to}px`, opacity: open ? 1 : 0 },
    ],
    { duration: DURATION, easing: EASING },
  );
  running.set(body, animation);
  animation.onfinish = () => {
    running.delete(body);
    body.style.overflow = '';
    if (!open) hide();
    done?.();
  };
}

/** Open or close a collapse-body that is shown and hidden with the hidden attribute. */
export function setBodyOpen(body: HTMLElement, open: boolean, opts: { animate?: boolean; done?: () => void } = {}) {
  const show = () => (body.hidden = false);
  const hide = () => (body.hidden = true);
  if (opts.animate === false) {
    stop(body);
    (open ? show : hide)();
    opts.done?.();
    return;
  }
  animate(body, open, show, hide, opts.done);
}

/** Open or close a <details> whose content is wrapped in a collapse-body. */
export function setDetailsOpen(details: HTMLDetailsElement, open: boolean, opts: { animate?: boolean } = {}) {
  if (open === willBeOpen(details)) return;
  const body = details.querySelector<HTMLElement>(':scope > .collapse-body');
  if (!body || opts.animate === false) {
    if (body) stop(body);
    details.classList.remove('opening');
    details.open = open;
    return;
  }
  details.classList.toggle('opening', open);
  animate(
    body,
    open,
    () => (details.open = true),
    () => (details.open = false),
    () => details.classList.remove('opening'),
  );
}

/**
 * Whether a <details> is open or opening, rather than closed or closing. A
 * closing details keeps its open attribute until its animation ends.
 */
export function willBeOpen(details: HTMLDetailsElement) {
  const body = details.querySelector<HTMLElement>(':scope > .collapse-body');
  if (details.classList.contains('opening')) return true;
  return details.open && !(body && running.has(body));
}

/** Animate every <details> with a collapse-body inside root when its summary is used. */
export function animateDetails(root: ParentNode = document) {
  root.querySelectorAll<HTMLDetailsElement>('details').forEach((details) => {
    if (!details.querySelector(':scope > .collapse-body')) return;
    details.querySelector(':scope > summary')?.addEventListener('click', (e) => {
      e.preventDefault();
      setDetailsOpen(details, !willBeOpen(details));
    });
  });
}
