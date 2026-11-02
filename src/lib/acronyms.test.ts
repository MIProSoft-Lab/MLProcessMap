import { describe, expect, it } from 'vitest';
import { prose } from './acronyms';

const kpi = (text = 'KPI', title = 'Key Performance Indicator') => `<abbr class="acronym" title="${title}">${text}</abbr>`;

describe('acronyms', () => {
  it('shortens a written-out acronym, also in the plural', () => {
    expect(prose('Key Performance Indicators (KPIs) and costs', 'en')).toBe(`${kpi('KPIs')} and costs`);
    expect(prose('a key performance indicator (KPI)', 'en')).toBe(`a ${kpi()}`);
  });

  it('marks a bare acronym with the expansion in the locale', () => {
    expect(prose('the KPI', 'es')).toBe(`the ${kpi('KPI', 'Indicador Clave de Rendimiento')}`);
    expect(prose('Un Modelo de Referencia de Procesos (PRM)', 'es')).toBe(
      'Un <abbr class="acronym" title="Modelo de Referencia de Procesos">PRM</abbr>',
    );
  });

  it('leaves words, names and pairs that only contain an acronym', () => {
    for (const s of ['MLOps', 'KPIX', 'CRISP-ML(Q)', 'ML-based', 'ISO/IEC', 'XAI']) expect(prose(s, 'en')).toBe(s);
  });

  it('works inside emphasis and never marks an acronym twice', () => {
    expect(prose('*the KPI*', 'en')).toBe(`<em>the ${kpi()}</em>`);
    expect(prose('KPI (KPI)', 'en')).toBe(`${kpi()} (${kpi()})`);
  });
});
