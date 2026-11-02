// Client side of the process modal (src/components/ProcessModal.astro).
// Pages create one with createProcessModal() and call open() with a process.
// The tailoring page passes hooks to show the include and activity checkboxes.
import { escapeHtml as esc } from './text';

export interface Details {
  id: string;
  name: string;
  origin: string;
  purpose: string;
  outcomes: { id: string; text: string }[];
  inputs: { id: string; name: string; serves: string[]; producers: string[] }[];
  outputs: { id: string; name: string; serves: string[]; consumers: string[] }[];
  activities: { id: string; title: string; description: string }[];
}

export interface TailorHooks {
  isIncluded(id: string): boolean;
  setIncluded(id: string, on: boolean): void;
  isActivityIncluded(key: string): boolean;
  setActivityIncluded(key: string, on: boolean): void;
}

export interface ModalOptions {
  tailor?: TailorHooks;
  /** Finds the element to focus on close when the opener was replaced meanwhile. */
  findOpener?(id: string): HTMLElement | null;
}


// One request per version and page load, shared by every modal on the page.
const cache = new Map<string, Promise<Details[]>>();

export function load(base: string, version: string) {
  if (!cache.has(version)) {
    const request = fetch(`${base}${version}/processes.json`).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json() as Promise<Details[]>;
    });
    request.catch(() => cache.delete(version));
    cache.set(version, request);
  }
  return cache.get(version)!;
}

export function createProcessModal(options: ModalOptions = {}) {
  const dialog = document.getElementById('process-modal') as HTMLDialogElement;
  const body = dialog.querySelector<HTMLElement>('.pm-body')!;
  const include = dialog.querySelector<HTMLInputElement>('.pm-include input')!;
  const goTo = dialog.querySelector<HTMLAnchorElement>('.pm-goto')!;
  const base = dialog.dataset.base!;
  const strings = JSON.parse(dialog.dataset.strings!) as Record<string, string>;
  const s = (k: string) => strings[k] ?? k;
  const { tailor } = options;

  dialog.querySelector<HTMLElement>('.pm-include')!.hidden = !tailor;

  let openId = '';
  let opener: HTMLElement | null = null;

  const chips = (ids: string[], empty: string) =>
    ids.length ? ids.map((id) => `<span class="chip"><span class="num">${id}</span></span>`).join(' ') : `<span class="muted">${empty}</span>`;
  const letters = (xs: string[]) => xs.map((x) => `<span class="pm-letter">${x}</span>`).join('');

  function render(d: Details) {
    const on = tailor ? tailor.isIncluded(d.id) : true;
    include.checked = on;
    const activity = (a: Details['activities'][number]) => {
      const key = `${d.id}.${a.id}`;
      const title = `<span class="pm-aid">${a.id}</span> <strong>${a.title}</strong>`;
      const head = tailor
        ? `<label><input type="checkbox" data-pm-act="${key}" ${on && tailor.isActivityIncluded(key) ? 'checked' : ''} ${on ? '' : 'disabled'}> ${title}</label>`
        : `<div class="pm-act-head">${title}</div>`;
      return `<li>${head}<p>${a.description}</p></li>`;
    };
    body.innerHTML = `
      <p class="pm-origin"><span class="badge origin-${d.origin}">${s(`origin.${d.origin}`)}</span></p>
      <h3 class="label">${s('process.purpose')}</h3>
      <p>${d.purpose}</p>
      <h3 class="label">${s('process.outcomes')}</h3>
      <ol class="pm-outcomes">${d.outcomes.map((o) => `<li><span class="pm-letter">${o.id}</span><span>${o.text}</span></li>`).join('')}</ol>
      <div class="pm-io">
        <div>
          <h3 class="label">${s('process.inputs')}</h3>
          <ul>${d.inputs
            .map((i) => `<li><strong>${esc(i.name)}</strong> ${letters(i.serves)}<div class="small">${s('process.producedBy')}: ${chips(i.producers, s('process.external'))}</div></li>`)
            .join('')}</ul>
        </div>
        <div>
          <h3 class="label">${s('process.outputs')}</h3>
          <ul>${d.outputs
            .map((o) => `<li><strong>${esc(o.name)}</strong> ${letters(o.serves)}<div class="small">${s('process.usedBy')}: ${chips(o.consumers, s('process.notUsed'))}</div></li>`)
            .join('')}</ul>
        </div>
      </div>
      <h3 class="label">${s('process.activities')}</h3>
      <ol class="pm-acts">${d.activities.map(activity).join('')}</ol>`;
  }

  async function open(version: string, id: string, name = '') {
    openId = id;
    if (!dialog.open) opener = document.activeElement as HTMLElement | null;
    dialog.querySelector('.pm-id')!.textContent = id;
    dialog.querySelector('.pm-title')!.textContent = name;
    goTo.href = `${base}${version}/processes/${id}/`;
    include.checked = tailor?.isIncluded(id) ?? true;
    body.innerHTML = `<p class="muted">${s('modal.loading')}</p>`;
    if (!dialog.open) dialog.showModal();
    body.scrollTop = 0;
    try {
      const d = (await load(base, version)).find((x) => x.id === id);
      if (d && openId === id) {
        dialog.querySelector('.pm-title')!.textContent = d.name;
        render(d);
      }
    } catch {
      if (openId === id) body.innerHTML = `<p class="notice">${s('modal.loadError')}</p>`;
    }
  }

  include.addEventListener('change', () => {
    if (!tailor) return;
    tailor.setIncluded(openId, include.checked);
    body.querySelectorAll<HTMLInputElement>('[data-pm-act]').forEach((a) => {
      a.disabled = !include.checked;
      a.checked = include.checked && tailor.isActivityIncluded(a.dataset.pmAct!);
    });
  });

  body.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (tailor && el.dataset.pmAct) tailor.setActivityIncluded(el.dataset.pmAct, el.checked);
  });

  dialog.querySelector('.pm-close')!.addEventListener('click', () => dialog.close());
  // Escape closes the dialog. Browsers do this for modal dialogs on their own,
  // but not all of them reliably (some skip it when the dialog was opened
  // without a fresh user gesture), so handle it here too.
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !dialog.open) return;
    e.preventDefault();
    dialog.close();
  });
  // A click on the backdrop, outside the dialog box, closes it.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    // Return focus to what opened the dialog, after the browser's own focus
    // restoration, finding it again if the page re-rendered it meanwhile.
    const id = openId;
    const target = opener?.isConnected ? opener : (options.findOpener?.(id) ?? null);
    openId = '';
    opener = null;
    setTimeout(() => target?.focus());
  });

  return { open };
}

/**
 * Open the modal from every link marked with data-process and data-version,
 * leaving modified clicks (new tab, new window) to the browser.
 */
export function openLinksInModal(root: ParentNode, modal: ReturnType<typeof createProcessModal>) {
  root.addEventListener('click', (e) => {
    const event = e as MouseEvent;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLElement>('[data-process][data-version]');
    if (!link) return;
    event.preventDefault();
    modal.open(link.dataset.version!, link.dataset.process!, link.dataset.name);
  });
}
