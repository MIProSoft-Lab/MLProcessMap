// The printable PRM in the browser (src/pages/[lang]/[version]/print.astro):
// the options panel, kept in step with the address, and the document showing
// only what the options include. Everything is in the page already; the
// options only show or hide it and change its look, and the browser prints it.
import { translator } from './client-strings';
import { format } from './text';
import {
  defaults,
  hasSettings,
  isOn,
  onlyProcess,
  readableQuery,
  readOptions,
  settings,
  writeOptions,
  type PrintOptions,
  type Setting,
} from './print-options';
import { applyModel, modelKeys, readPrintModel } from './print-model';

/** The strings this script uses, with those of print-model.ts; the page hands them to it. */
export const printKeys = ['print.selected', 'print.printed', ...modelKeys] as const;

/**
 * The settings last used, remembered in the browser (not which processes): an
 * address without settings starts from them. Storage can be blocked, and the
 * page works without it.
 */
const STORE = 'prm-tool:print:settings';
const remembered = {
  get(all: string[]) {
    try {
      const stored = localStorage.getItem(STORE);
      return stored === null ? null : readOptions(stored, all);
    } catch {
      return null;
    }
  },
  set(o: PrintOptions, all: string[]) {
    try {
      localStorage.setItem(STORE, writeOptions({ ...o, processes: all }, all));
    } catch {}
  },
};

const PAGE: Record<PrintOptions['paper'], string> = { a4: 'A4', letter: 'letter' };
const names = Object.keys(settings) as Setting[];

/** A text as a CSS string, for content: quotes and backslashes escaped, on one line. */
export const cssString = (text: string) => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s+/g, ' ')}"`;

/**
 * How the pages are laid out: their margins, and the colour and font of what
 * is printed in them. print.css sets them on the document (--page-margin-block,
 * --page-margin-inline, --muted, --mono), and pageLook reads them from there,
 * so they are written in one place.
 */
export interface PageLook {
  marginBlock: string;
  marginInline: string;
  colour: string;
  font: string;
}

export function pageLook(doc: HTMLElement): PageLook {
  const style = getComputedStyle(doc);
  const value = (name: string) => style.getPropertyValue(name).trim();
  return {
    marginBlock: value('--page-margin-block'),
    marginInline: value('--page-margin-inline'),
    colour: value('--muted'),
    font: value('--mono'),
  };
}

/**
 * The page rules for the options: the paper size and margins, and what goes in
 * the margins of every page: the header at the top left, the footer at the
 * bottom left and the page numbers at the bottom right. texts are the header
 * and footer to print, the user's or the page's own. @page cannot be switched
 * with a class, so it is written into a style element of its own.
 *
 * Both margins always hold something of the page's own, a space when there is
 * nothing to show: Chrome and Edge leave out their header (date and title) and
 * footer (address) where a page fills a margin box, even with Headers and
 * footers ticked in the print dialog. An empty string does not count, and
 * prints blank pages.
 *
 * Firefox ignores margin boxes, so neither the header and footer nor the page
 * numbers print there. It leaves out its own header and footer where the page
 * margin is too small to hold them (since Firefox 48), so in Firefox only the
 * top and bottom margins are 0, and print.css gives the document that space
 * back as padding repeated on every page. Safari does neither, so the panel says
 * how to turn the headers off there.
 */
export function pageRules(o: PrintOptions, texts: { header: string; footer: string }, look: PageLook) {
  const marginText = `font: 7.5pt ${look.font}; color: ${look.colour};`;
  const text = (t: string) => `content: ${cssString(t.trim() || ' ')}; ${marginText}`;
  const top = isOn(o, 'header') ? text(texts.header) : 'content: " ";';
  const footer = isOn(o, 'footer') && texts.footer.trim() ? ` @bottom-left { ${text(texts.footer)} }` : '';
  const numbers = isOn(o, 'pageNumbers') ? `content: counter(page) " / " counter(pages); ${marginText}` : 'content: " ";';
  return (
    `@page { size: ${PAGE[o.paper]}; margin: ${look.marginBlock} ${look.marginInline};` +
    ` @top-left { ${top} } @top-right { content: " "; }${footer} @bottom-right { ${numbers} } }` +
    ` @supports (-moz-appearance: none) { @page { margin-top: 0; margin-bottom: 0; } }`
  );
}

/**
 * Show in the printed document (#doc) what the options include, in the look
 * they choose: the settings without effect in data-off (print.css hides what
 * they include), the processes, their entries in the contents and on the map,
 * the references and acronyms of the processes printed, and a notice when
 * there is nothing to print.
 */
export function renderDocument(doc: HTMLElement, options: PrintOptions) {
  doc.dataset.off = names.filter((n) => !isOn(options, n)).join(' ');
  doc.dataset.size = options.size;

  const chosen = new Set(options.processes);
  doc.querySelectorAll<HTMLElement>('.print-process').forEach((el) => (el.hidden = !chosen.has(el.dataset.process!)));
  doc.querySelectorAll<HTMLElement>('[data-toc]').forEach((el) => (el.hidden = !chosen.has(el.dataset.toc!)));
  // The map keeps every process, and greys out those left out.
  doc.querySelectorAll<HTMLElement>('.topology li[data-id]').forEach((el) => el.classList.toggle('left-out', !chosen.has(el.dataset.id!)));
  // Only the references and acronyms of the printed processes, and a list only when it has any.
  doc.querySelectorAll<HTMLElement>('[data-cited-by]').forEach((el) => {
    el.hidden = !el.dataset.citedBy!.split(' ').some((id) => chosen.has(id));
  });
  doc.querySelectorAll<HTMLElement>('.pd-ref-group').forEach((g) => (g.hidden = !g.querySelector('[data-cited-by]:not([hidden])')));
  doc.querySelectorAll<HTMLElement>('.pd-references, .pd-acronyms').forEach((section) => {
    section.classList.toggle('none-cited', !section.querySelector('[data-cited-by]:not([hidden])'));
  });

  // With nothing to print, say so instead of a blank page.
  const somePart = (['cover', 'map', 'toc'] as const).some((n) => isOn(options, n));
  doc.querySelector<HTMLElement>('#print-empty')!.hidden = somePart || chosen.size > 0;
}

export function initPrintPage() {
  const doc = document.getElementById('doc')!;
  const form = document.getElementById('print-options') as HTMLFormElement;
  const s = translator(JSON.parse(doc.dataset.strings!));
  const look = pageLook(doc);
  const processBoxes = [...form.querySelectorAll<HTMLInputElement>('[data-process-option]')];
  const all = processBoxes.map((x) => x.dataset.processOption!);
  const settingBoxes = [...form.querySelectorAll<HTMLInputElement>('[data-setting]')];
  const size = form.elements.namedItem('size') as HTMLSelectElement;
  const paper = form.elements.namedItem('paper') as HTMLSelectElement;
  // The header and footer texts, with the page's own as their default (data-default).
  const textFields = {
    headerText: form.elements.namedItem('headerText') as HTMLInputElement,
    footerText: form.elements.namedItem('footerText') as HTMLInputElement,
  };
  const textOf = (key: keyof typeof textFields) => options[key] ?? textFields[key].dataset.default!;

  // The options: those the address gives, or those remembered and what the
  // address chooses to print (one process, or a model from the builder).
  const query = new URLSearchParams(location.search);
  const base = hasSettings(location.search) ? defaults(all) : (remembered.get(all) ?? defaults(all));
  let options = readOptions(location.search, all, base);
  const only = query.get('only');
  if (only) options = onlyProcess(options, only, all);
  const modelParam = query.get('model');
  if (modelParam !== null) {
    const m = readPrintModel(modelParam, all);
    applyModel(doc, m, s);
    if (!query.has('p')) options = { ...options, processes: m.selected };
    // The model's name heads its pages, unless the header has a text of its own.
    if (m.project) textFields.headerText.dataset.default = `${m.project} · ML-PRM ${doc.dataset.version}`;
  }

  /** Put the options in the panel. A setting is greyed out while its parent is off. */
  function showOptions() {
    for (const box of settingBoxes) {
      const name = box.dataset.setting as Setting;
      box.checked = options.on.has(name);
      const parent = box.dataset.parent as Setting | undefined;
      box.disabled = !!parent && !isOn(options, parent);
    }
    const chosen = new Set(options.processes);
    for (const box of processBoxes) box.checked = chosen.has(box.dataset.processOption!);
    size.value = options.size;
    paper.value = options.paper;
    for (const [key, field] of Object.entries(textFields) as [keyof typeof textFields, HTMLInputElement][]) {
      // Only when it differs, so that typing keeps its place in the field.
      if (field.value !== textOf(key)) field.value = textOf(key);
      field.disabled = !isOn(options, key === 'headerText' ? 'header' : 'footer');
    }
    const count = document.getElementById('print-count')!;
    count.textContent = format(count.dataset.text!, { n: options.processes.length, total: all.length });
  }

  /** The document and its page rules for the options. */
  function showDocument() {
    renderDocument(doc, options);
    document.getElementById('print-page-size')!.textContent = pageRules(
      options,
      { header: textOf('headerText'), footer: textOf('footerText') },
      look,
    );
  }

  function update(next: PrintOptions) {
    options = next;
    showOptions();
    showDocument();
    remembered.set(options, all);
    // The address gives every setting; a model from the builder stays in it.
    const params = new URLSearchParams(writeOptions(options, all));
    if (modelParam !== null) params.set('model', modelParam);
    const search = readableQuery(params);
    history.replaceState(history.state, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`);
  }

  form.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    const next: PrintOptions = { ...options, on: new Set(options.on) };
    if (el instanceof HTMLInputElement && el.dataset.setting) {
      const name = el.dataset.setting as Setting;
      if (el.checked) next.on.add(name);
      else next.on.delete(name);
    } else if (el instanceof HTMLInputElement && el.dataset.processOption) {
      const chosen = new Set(processBoxes.filter((b) => b.checked).map((b) => b.dataset.processOption!));
      next.processes = all.filter((id) => chosen.has(id));
    } else if (el === size) {
      next.size = size.value as PrintOptions['size'];
    } else if (el === paper) {
      next.paper = paper.value as PrintOptions['paper'];
    }
    update(next);
  });

  // The texts change the page as they are typed; the page's own text is not kept in the address.
  form.addEventListener('input', (e) => {
    const field = e.target as HTMLInputElement;
    if (field !== textFields.headerText && field !== textFields.footerText) return;
    const key = field.name as keyof typeof textFields;
    const next: PrintOptions = { ...options };
    if (field.value === field.dataset.default) delete next[key];
    else next[key] = field.value;
    update(next);
  });

  form.querySelector('[data-all]')!.addEventListener('click', () => update({ ...options, processes: [...all] }));
  form.querySelector('[data-none]')!.addEventListener('click', () => update({ ...options, processes: [] }));
  document.getElementById('print-reset')!.addEventListener('click', () => update(defaults(all)));
  document.getElementById('print-now')!.addEventListener('click', () => window.print());

  // When and where it was printed, under the cover.
  document.getElementById('printed')!.textContent = s('print.printed', {
    date: new Date().toLocaleDateString(doc.dataset.locale, { year: 'numeric', month: 'long', day: 'numeric' }),
    url: `${location.origin}${location.pathname}`,
  });

  showOptions();
  showDocument();
}
