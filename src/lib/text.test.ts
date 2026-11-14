import { describe, expect, it } from 'vitest';
import { searchKey } from './text';

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
