// The content uses a small subset of Markdown for emphasis: *em*, **strong**
// and `code`. Everything else is escaped.
export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function inline(s: string) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

/** Paragraphs separated by blank lines, line breaks kept. */
export function blocks(s: string) {
  return s
    .split(/\n{2,}/)
    .map((p) => `<p>${inline(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** An interface string with its {name} placeholders filled in. */
export function format(s: string, vars: Record<string, string | number> = {}) {
  return s.replace(/\{(\w+)\}/g, (placeholder, k) => (Object.hasOwn(vars, k) ? String(vars[k]) : placeholder));
}

/** Lowercase and without accents, so a search for "gestion" finds "gestión". */
export function searchKey(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function plain(s: string) {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1').replace(/`(.+?)`/g, '$1');
}
