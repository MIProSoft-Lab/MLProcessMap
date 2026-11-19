import { describe, expect, it } from 'vitest';
import { defaults, hasSettings, isOn, onlyProcess, printHref, readOptions, settings, writeOptions, type Setting } from './print-options';
import { modelLayout, readPrintModel } from './print-model';
import { format } from './text';

const all = ['P01', 'P02', 'P03'];

describe('the options of the printable version', () => {
  it('start from the defaults, and write nothing for them', () => {
    const d = defaults(all);
    expect(readOptions('', all)).toEqual(d);
    expect(writeOptions(d, all)).toBe('');
    expect([d.on.has('cover'), d.on.has('author'), d.on.has('map'), d.on.has('mapColour'), d.on.has('toc')]).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect([d.on.has('origin'), d.on.has('idColour'), d.on.has('sources'), d.on.has('checklist'), d.on.has('notes')]).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('read back what they write, with settings turned off and on', () => {
    const o = defaults(all);
    o.processes = ['P01', 'P03'];
    o.on.delete('map');
    o.on.delete('purpose');
    o.on.add('notes');
    o.size = 'small';
    expect(writeOptions(o, all)).toBe('p=P01,P03&off=map,purpose&on=notes&size=small');
    expect(readOptions(writeOptions(o, all), all)).toEqual(o);
  });

  it('keep the processes in the order of the PRM and drop unknown ones', () => {
    expect(readOptions('p=P03,P99,P01', all).processes).toEqual(['P01', 'P03']);
    expect(readOptions('p=', all).processes).toEqual([]);
  });

  it('ignore unknown settings and values', () => {
    const o = readOptions('off=cover,nothing&on=whatever&size=huge&paper=a3', all);
    expect(o.on.has('cover')).toBe(false);
    expect([o.size, o.paper]).toEqual(['normal', 'a4']);
    expect(o.on.size).toBe(defaults(all).on.size - 1);
  });

  it('count a setting only while its parent is on', () => {
    const o = readOptions('off=map&on=mapColour', all);
    expect([o.on.has('mapColour'), isOn(o, 'mapColour')]).toEqual([true, false]);
    expect(isOn(readOptions('off=cover', all), 'author')).toBe(false);
    // The colour of the ID does not depend on showing the origin.
    expect(isOn(readOptions('on=idColour', all), 'idColour')).toBe(true);
    expect(isOn(readOptions('off=activities&on=checklist', all), 'checklist')).toBe(false);
  });

  it('name only settings that exist as parents', () => {
    for (const [name, s] of Object.entries(settings)) {
      const parent = (s as { parent?: string }).parent;
      if (parent) expect(Object.keys(settings), name).toContain(parent as Setting);
    }
  });

  it('link to one process without the parts about the whole PRM', () => {
    expect(printHref('/en/v2/print/', 'P08')).toBe('/en/v2/print/?only=P08');
    const remembered = readOptions('size=large&on=notes', all);
    const one = onlyProcess(remembered, 'P02', all);
    expect([one.processes, one.size, one.on.has('notes'), one.on.has('cover'), one.on.has('map')]).toEqual([
      ['P02'],
      'large',
      true,
      false,
      false,
    ]);
  });
});

describe('the page rules of the printable version', () => {
  const texts = { header: 'ML-PRM · v2', footer: 'MIProSoft' };
  const look = { marginBlock: '20mm', marginInline: '15mm', colour: '#5a6051', font: 'monospace' };

  it('set the paper and margins, with the header, the footer and the page numbers in them', async () => {
    const { pageRules } = await import('./print-page');
    const rules = pageRules(defaults(all), texts, look);
    expect(rules).toMatch(/^@page \{ size: A4; margin: 20mm 15mm;/);
    expect(rules).toContain('@top-left { content: "ML-PRM · v2";');
    expect(rules).toContain('@bottom-left { content: "MIProSoft";');
    expect(rules).toMatch(/@bottom-right \{ content: counter\(page\) " \/ " counter\(pages\)/);
  });

  it('keep both margins filled with a space when they have nothing to show', async () => {
    const { pageRules } = await import('./print-page');
    const rules = pageRules(readOptions('paper=letter&off=pageNumbers,header,footer', all), texts, look);
    expect(rules).toBe(
      '@page { size: letter; margin: 20mm 15mm; @top-left { content: " "; } @top-right { content: " "; } @bottom-right { content: " "; } }' +
        ' @supports (-moz-appearance: none) { @page { margin-top: 0; margin-bottom: 0; } }',
    );
  });

  it('escape the texts the user types', async () => {
    const { cssString } = await import('./print-page');
    expect(cssString('Say "hi" \\ bye\nnow')).toBe('"Say \\"hi\\" \\\\ bye now"');
  });

  it('keep header and footer texts in the address only when they are written', () => {
    const o = { ...defaults(all), headerText: 'Acme · tailored PRM', footerText: '' };
    expect(writeOptions(o, all)).toBe('ht=Acme+%C2%B7+tailored+PRM&ft=');
    expect(readOptions(writeOptions(o, all), all)).toEqual(o);
    expect(readOptions('', all).headerText).toBeUndefined();
  });
});

describe('remembered settings', () => {
  it('apply only to an address that gives no settings of its own', () => {
    expect([hasSettings(''), hasSettings('?only=P01'), hasSettings('?p=P01'), hasSettings('?model=v%3Dv2')]).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect([hasSettings('?off=map'), hasSettings('?size=small'), hasSettings('?ht=Acme')]).toEqual([true, true, true]);
  });

  it('are the base an address adds to', () => {
    const base = readOptions('on=notes&ht=Acme', all);
    const o = readOptions('p=P01', all, base);
    expect([o.processes, o.on.has('notes'), o.headerText]).toEqual([['P01'], true, 'Acme']);
  });
});

describe('a model from the lifecycle builder', () => {
  const hash = new URLSearchParams({
    v: 'v2',
    n: 'Fraud detection',
    p: 'P01,P03,P99',
    x: 'P01.A2',
    r: JSON.stringify({ P02: 'Not needed', P03: 5 }),
    ph: JSON.stringify([{ i: 'build', n: 'Build', p: ['P03', 'P02'], r: 1 }]),
    ld: 'For a bank.',
  }).toString();

  it('reads the processes, activities, reasons and phases of the model', () => {
    const m = readPrintModel(hash, all);
    expect([m.project, m.description, m.selected, [...m.excluded], m.rationale]).toEqual([
      'Fraud detection',
      'For a bank.',
      ['P01', 'P03'],
      ['P01.A2'],
      { P02: 'Not needed' },
    ]);
    // A phase keeps only the processes of the model.
    expect(m.phases.map((p) => [p.name, p.processes, p.iterative])).toEqual([['Build', ['P03'], true]]);
  });

  // The strings as the page hands them over, in English.
  const strings: Record<string, string> = {
    'print.phase': 'Phase {n}',
    'print.repeats': 'This phase can be repeated',
    'print.returnsTo': 'Returns to {phase}',
    'print.unassigned': 'Not in a phase',
    'tailor.phase-new': 'Phase {n}',
  };
  const s = (key: string, vars: Record<string, string | number> = {}) => format(strings[key] ?? key, vars);

  it('lays the model out by phase, with the processes in no phase last and those left out apart', () => {
    const phases = JSON.stringify([
      { i: 'a', n: 'Build', p: ['P02'], r: 1 },
      { i: 'b', n: '', d: 'Checks', p: ['P01'], t: 'a', w: 'on drift' },
    ]);
    const m = readPrintModel(new URLSearchParams({ p: 'P01,P02,P03', ph: phases }).toString(), [...all, 'P04']);
    const { groups, leftOut } = modelLayout(m, [...all, 'P04'], s);
    expect(groups).toEqual([
      { step: 'Phase 01', title: 'Build', notes: ['↻ This phase can be repeated'], toc: 'Phase 01 · Build', processes: ['P02'] },
      {
        step: 'Phase 02',
        title: 'Phase 2',
        description: 'Checks',
        notes: ['↩ Returns to Phase 01 · Build: on drift'],
        toc: 'Phase 02 · Phase 2',
        processes: ['P01'],
      },
      { title: 'Not in a phase', notes: [], toc: 'Not in a phase', processes: ['P03'] },
    ]);
    expect(leftOut).toEqual(['P04']);
  });

  it('keeps the processes in the order of the PRM when the model has no phases', () => {
    const m = readPrintModel('p=P03,P01', all);
    expect(modelLayout(m, all, s)).toEqual({ groups: [], leftOut: ['P02'] });
  });

  it('takes every process when the model does not list them, and survives a broken reason', () => {
    const m = readPrintModel('r=%7Bbroken', all);
    expect([m.selected, m.rationale, m.phases]).toEqual([all, {}, []]);
  });
});

describe('the parts of the printable version', () => {
  it('are each a setting, hidden by print.css when it is off', async () => {
    const fs = await import('node:fs');
    const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const css = read('styles/print.css');
    const markup = ['components/print/PrintProcess.astro', 'pages/[lang]/[version]/print.astro', 'components/Topology.astro']
      .map(read)
      .join('');
    const parts = new Set([...markup.matchAll(/data-part="(\w+)"/g)].map((m) => m[1]));
    expect(parts.size).toBeGreaterThan(20);
    for (const part of parts) {
      expect(Object.keys(settings), part).toContain(part);
      expect(css, part).toContain(`[data-off~='${part}'] [data-part='${part}']`);
    }
  });

  it('come in the order of the settings, which the options panel follows', async () => {
    const fs = await import('node:fs');
    const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    const order = Object.keys(settings);
    for (const file of ['pages/[lang]/[version]/print.astro', 'components/print/PrintProcess.astro']) {
      const parts = [...new Set([...read(file).matchAll(/data-part="(\w+)"/g)].map((m) => m[1]))];
      expect(parts, file).toEqual(order.filter((name) => parts.includes(name)));
    }
  });
});
