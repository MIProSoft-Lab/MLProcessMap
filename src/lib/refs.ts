import { references, studies, type Reference } from './content';

export const referenceByKey = new Map(references.map((r) => [r.key, r]));
export const studyById = new Map(studies.map((s) => [s.id, s]));

/** The short citation of a primary study (P10 → "Akkiraju et al., 2020"), when it has a reference. */
export function studyCite(id: string) {
  const study = studyById.get(id);
  return study?.reference ? shortCite(referenceByKey.get(study.reference)) : undefined;
}

/** "Khan et al., 2024" style label for a bibliography entry. */
export function shortCite(r: Reference | undefined, key = '') {
  if (!r) return key;
  const authors = r.authors.split(/\s+and\s+/).filter(Boolean);
  const surname = (a: string) => (a.includes(',') ? a.split(',')[0] : a).trim();
  let who = authors.length === 0 ? r.title : surname(authors[0]);
  if (authors.length === 2) who += ` & ${surname(authors[1])}`;
  if (authors.length > 2) who += ' et al.';
  return r.year ? `${who}, ${r.year}` : who;
}

/** "Ana" → "A.", "Kai-Uwe" → "K.-U.", "Marco A.S." → "M. A. S.", particles such as "de" kept. */
function initials(given: string) {
  return given
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) =>
      /^\p{Ll}/u.test(w)
        ? w
        : w
            .split('-')
            .map((p) => `${p[0]}.`)
            .join('-'),
    )
    .join(' ');
}

/** "Surname, Given and Other, Name" → "Surname, G., & Other, N."; names without a comma, such as organizations, kept. */
export function formatAuthors(authors: string) {
  const names = authors
    .split(/\s+and\s+/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      const comma = a.indexOf(',');
      if (comma < 0) return a;
      const given = initials(a.slice(comma + 1));
      return given ? `${a.slice(0, comma).trim()}, ${given}` : a.slice(0, comma).trim();
    });
  if (names.length < 2) return names.join('');
  if (names.length === 2) return `${names[0]}, & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, & ${names[names.length - 1]}`;
}

/** The text followed by a full stop, unless it already ends in a stop, question or exclamation mark. */
const sentence = (s: string) => (/[.?!]$/.test(s) ? s : `${s}.`);

/**
 * "Authors (Year). Title. *Venue*. Publisher." Without title and year, for a
 * listing that shows them on its own.
 */
export function fullCite(r: Reference, { title = true } = {}) {
  const authors = r.authors && formatAuthors(r.authors);
  const head = title ? [authors, r.year && `(${r.year})`].filter(Boolean).join(' ') : authors;
  const parts = [
    head && sentence(head),
    title && r.title && sentence(r.title),
    r.venue && (/\.$/.test(r.venue) ? `*${r.venue}*` : `*${r.venue}*.`),
    r.publisher && sentence(r.publisher),
  ];
  return parts.filter(Boolean).join(' ');
}

export function referenceUrl(r: Reference) {
  if (r.doi) return `https://doi.org/${r.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, '')}`;
  return r.url;
}
