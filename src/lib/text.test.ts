import { describe, expect, it } from 'vitest';
import { blocks, escapeHtml, format, inline, plain, searchKey } from './text';

describe('searchKey', () => {
  it('ignores case and accents', () => {
    expect(searchKey('Gestión de la Configuración')).toBe('gestion de la configuracion');
    expect(searchKey('Avaluació i anàlisi')).toBe('avaluacio i analisi');
  });

  it('gives the same key for composed and decomposed accents', () => {
    expect(searchKey('gestio\u0301n')).toBe(searchKey('gesti\u00f3n'));
  });

  it('keeps letters that are not accented variants', () => {
    expect(searchKey('l·l')).toBe('l·l');
  });
});

describe('format', () => {
  it('fills in the placeholders, each as often as it appears', () => {
    expect(format('{n} of {total}', { n: 2, total: 5 })).toBe('2 of 5');
    expect(format('{phase} returns to {phase}', { phase: 'Build' })).toBe('Build returns to Build');
  });

  it('keeps a value as it is written', () => {
    expect(format('Phase: {phase}', { phase: 'Cost $& review' })).toBe('Phase: Cost $& review');
    expect(format('{a} and {b}', { a: '{b}', b: 'x' })).toBe('{b} and x');
  });

  it('leaves a placeholder with no value in place', () => {
    expect(format('{n} of {total}', { n: 2 })).toBe('2 of {total}');
    expect(format('No placeholders')).toBe('No placeholders');
  });
});

describe('the emphasis marks of the content', () => {
  it('become HTML, with everything else escaped', () => {
    expect(inline('A *key* and **main** `term` <b>')).toBe('A <em>key</em> and <strong>main</strong> <code>term</code> &lt;b&gt;');
    expect(escapeHtml(`<a href="x">Tom's & co</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom&#39;s &amp; co&lt;/a&gt;');
  });

  it('are dropped for plain text', () => {
    expect(plain('A *key* and **main** `term` <b>')).toBe('A key and main term <b>');
  });

  it('keep paragraphs and line breaks', () => {
    expect(blocks('First *line*\nsecond line\n\nNext paragraph')).toBe('<p>First <em>line</em><br>second line</p><p>Next paragraph</p>');
  });
});
