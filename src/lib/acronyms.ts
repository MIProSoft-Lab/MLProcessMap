// Acronyms in the text of the PRM, from content/acronyms.yaml. The text keeps
// them written out as in the thesis, "Key Performance Indicators (KPIs)", and
// the site shows only the acronym, with its expansion on hover.
import { acronyms, pick, type Acronym } from './content';
import type { Locale } from '../i18n/locales';
import { escapeHtml, inline } from './text';

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// An acronym is a whole word: not part of a longer word, a hyphenated name or
// a pair such as ISO/IEC.
const before = '(?<![\\p{L}\\p{N}/-])';
const after = '(?![\\p{L}\\p{N}/-])';

interface Matcher {
  acronym: Acronym;
  /** "Expansion (ACR)" in any language, the expansion and the acronym possibly plural. */
  written: RegExp;
  bare: RegExp;
}

const matchers: Matcher[] = acronyms.map((acronym) => {
  const id = escapeRe(acronym.id);
  // inline() escapes the text first, so the expansions are matched escaped too.
  const expansions = [...new Set(Object.values(acronym.expansion))].map((e) => escapeRe(escapeHtml(e))).join('|');
  return {
    acronym,
    written: new RegExp(`(?<![\\p{L}])(?:${expansions})(?:e?s)? \\(${id}(s?)\\)`, 'giu'),
    bare: new RegExp(`${before}${id}(s?)${after}`, 'gu'),
  };
});

/**
 * Mark the acronyms in HTML from inline(): written-out ones are shortened, and
 * each becomes an <abbr> with the expansion in the locale. Tags and the text
 * inside them are left alone, so an acronym is never marked twice.
 */
export function abbreviate(html: string, locale: Locale): string {
  if (!matchers.length) return html;
  const abbr = (a: Acronym, plural: string) =>
    `<abbr class="acronym" title="${escapeHtml(pick(a.expansion, locale))}">${a.id}${plural}</abbr>`;
  // Odd items are tags or <abbr> elements already made; even ones are text.
  const split = (s: string) => s.split(/(<abbr\b[^>]*>.*?<\/abbr>|<[^>]+>)/s);
  let parts = split(html);
  for (const m of matchers) {
    parts = parts.map((part, i) => (i % 2 ? part : part.replace(m.written, (_, plural) => abbr(m.acronym, plural))));
    parts = split(parts.join(''));
    parts = parts.map((part, i) => (i % 2 ? part : part.replace(m.bare, (_, plural) => abbr(m.acronym, plural))));
    parts = split(parts.join(''));
  }
  return parts.join('');
}

/** Text of the PRM as HTML: inline emphasis and acronyms. */
export function prose(s: string, locale: Locale): string {
  return abbreviate(inline(s), locale);
}
