// The search fields of the process map, the work products and the references,
// in the browser. Each page matches its own items; these are the parts they
// share: the words of a query, the query kept in the address, the count of
// matches and the item an address points at.
import { format, searchKey } from './text';

/** The words of a query, lowercase and without accents like the texts they are matched against. */
export function queryWords(query: string) {
  return searchKey(query).split(/\s+/).filter(Boolean);
}

/**
 * Run apply whenever the search field changes. The query is kept in the
 * address (?q=…), so it is still there on coming back to the page, and is
 * put back in the field on load. apply runs on load when there is a query,
 * or always with applyOnLoad.
 */
export function bindSearch(input: HTMLInputElement, apply: () => void, { applyOnLoad = false } = {}) {
  input.value = new URLSearchParams(location.search).get('q') ?? '';
  input.addEventListener('input', () => {
    apply();
    const url = new URL(location.href);
    if (input.value.trim()) url.searchParams.set('q', input.value);
    else url.searchParams.delete('q');
    history.replaceState(history.state, '', url);
  });
  if (applyOnLoad || input.value) apply();
}

/**
 * "n of total" in the count next to a search field (its data-text, e.g.
 * "{n} of {total} processes"), or nothing while there is no query.
 */
export function showCount(count: HTMLElement, words: string[], n: number, total: number) {
  count.textContent = words.length ? format(count.dataset.text!, { n, total }) : '';
}

/** Mark the element the address points at (#id) with the class highlight, and return it. */
export function highlightTarget() {
  const target = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  target?.classList.add('highlight');
  return target;
}
