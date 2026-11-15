import { describe, expect, it } from 'vitest';
import { format, searchKey } from './text';

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
