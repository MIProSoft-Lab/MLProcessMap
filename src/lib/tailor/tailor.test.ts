import { describe, expect, it } from 'vitest';
import { format } from '../text';
import { csv, json, lifecyclePhases, markdown, yaml } from './export';
import { fromObject, parseCsv, readModel } from './import';
import { fromHash, insertInOrder, missingInputs, phase, syncPhases, toHash, type Data, type State, type Version } from './model';

const strings: Record<string, string> = {
  'tailor.untitled': 'Untitled model',
  'tailor.phase-new': 'Phase {n}',
  'tailor.excluded': 'Excluded',
  'tailor.unassigned': 'Unassigned',
  'tailor.phase-returnsTo': 'Returns to',
  'lc.iterative': 'iterative',
};
const s = (k: string, vars: Record<string, string | number> = {}) => format(strings[k] ?? k, vars);

const proc = (id: string, inputs: string[] = []) => ({
  id,
  name: `Process ${id}`,
  origin: 'decomposed',
  purpose: `Purpose of ${id}.`,
  activities: [
    { id: 'A1', title: `First of ${id}` },
    { id: 'A2', title: `Second of ${id}` },
  ],
  inputs,
});

const v2: Version = {
  id: 'v2',
  title: 'Second',
  processes: [proc('P01'), proc('P02', ['WP1']), proc('P03', ['WP1', 'WP2', 'EXT'])],
  workProducts: {
    WP1: { name: 'Data', external: false, producers: ['P01'] },
    WP2: { name: 'Model', external: false, producers: ['P02'] },
    EXT: { name: 'Request', external: true, producers: [] },
  },
};
const v1: Version = { ...v2, id: 'v1', title: 'First', processes: [proc('P01'), proc('P02')] };

const data: Data = {
  defaultVersion: 'v2',
  base: '/en/',
  versions: [v1, v2],
  lifecycles: [
    {
      id: 'basic',
      name: 'Basic',
      version: 'v2',
      description: 'A basic lifecycle.',
      processes: ['P01', 'P03'],
      phases: [
        { id: 'one', name: 'One', processes: ['P01'] },
        { id: 'two', name: 'Two', processes: ['P03'], returnsTo: 'one' },
      ],
    },
  ],
};

/** A model with phases, a loop, an excluded activity and a left-out process. */
function model(): State {
  return {
    version: 'v2',
    project: 'Fraud detection',
    selected: new Set(['P01', 'P03']),
    excluded: new Set(['P01.A2']),
    rationale: { P02: 'Reused, "as is"' },
    phases: [
      phase({ id: 'phase-1', name: 'Build', processes: ['P01'], iterative: true }),
      phase({ id: 'phase-2', name: '', description: 'Checks', processes: ['P03'], returnsTo: 'phase-1', returnNote: 'on drift' }),
    ],
    description: 'Tailored for a bank.',
    tab: 'phases',
  };
}

describe('the model in the URL hash', () => {
  it('reads back what it writes', () => {
    const state = model();
    expect(fromHash(data, toHash(state))).toEqual(state);
  });

  it('keeps reasons only for processes left out', () => {
    const state = { ...model(), rationale: { P01: 'kept anyway', P02: 'not needed' } };
    expect(fromHash(data, toHash(state)).rationale).toEqual({ P02: 'not needed' });
  });

  it('starts from a lifecycle', () => {
    const state = fromHash(data, 'lc=basic');
    expect(state.project).toBe('Basic');
    expect([...state.selected]).toEqual(['P01', 'P03']);
    expect(state.phases.map((p) => p.id)).toEqual(['one', 'two']);
    expect(state.tab).toBe('phases');
  });

  it('selects every process by default and drops unknown ones', () => {
    expect([...fromHash(data, '').selected]).toEqual(['P01', 'P02', 'P03']);
    expect([...fromHash(data, 'v=v1&p=P01,P03,P99').selected]).toEqual(['P01']);
    expect(fromHash(data, 'v=v9').version).toBe('v2');
  });
});

describe('the phases', () => {
  it('follow the selection and drop loops to removed phases', () => {
    const state = model();
    state.selected.delete('P01');
    state.phases.shift();
    syncPhases(state, v2);
    expect(state.phases).toEqual([expect.objectContaining({ processes: ['P03'], returnsTo: '' })]);
  });

  it('take new processes in the order of the PRM', () => {
    const p = phase({ id: 'x', processes: ['P01', 'P03'] });
    insertInOrder(p, 'P02', v2);
    insertInOrder(p, 'P02', v2);
    expect(p.processes).toEqual(['P01', 'P02', 'P03']);
  });

  it('get unique IDs from their names in exports', () => {
    const state = model();
    state.phases.push(phase({ id: 'phase-3', name: 'Build' }));
    expect(lifecyclePhases(state, s).map((p) => [p.id, p.name, p.returnsTo])).toEqual([
      ['build', 'Build', undefined],
      ['phase-2', 'Phase 2', 'build'],
      ['build-2', 'Build', undefined],
    ]);
  });
});

describe('missing inputs', () => {
  it('lists inputs that no selected process produces, leaving out external ones', () => {
    const missing = missingInputs(model(), v2);
    expect([...missing.keys()]).toEqual(['WP2']);
    expect([...missing.get('WP2')!]).toEqual(['P03']);
  });
});

describe('exports', () => {
  const ctx = () => ({ state: model(), version: v2, s, link: 'https://example.org/#x' });

  it('write a Markdown checklist grouped by phase', () => {
    const md = markdown(ctx());
    expect(md).toContain('## 01 Build (↻ iterative)');
    expect(md).toContain('↩ Returns to Build: on drift');
    expect(md).toContain('- [ ] A1. First of P01\n\nExcluded: A2');
    expect(md).toContain('- P02 Process P02: Reused, "as is"');
  });

  it('quote CSV fields', () => {
    expect(csv(ctx()).split('\n')[3]).toBe('P02,"Process P02","",A1,"First of P02",no,"Reused, ""as is"""');
  });

  it('write lifecycle YAML with quotes only where needed', () => {
    const out = yaml({ ...model(), project: 'yes' }, s);
    expect(out).toContain('id: yes\nname: "yes"\n');
    expect(out).toContain('    returnsTo: build\n    returnNote: on drift\n');
  });
});

describe('importing an export', () => {
  const options = { versions: data.versions, fallback: v1, untitled: s('tailor.untitled') };
  const essentials = (m: { version: string; selected: string[]; excluded: string[]; rationale: Record<string, string>; phases: { name: string; processes: string[] }[] }) => ({
    version: m.version,
    selected: [...m.selected].sort(),
    excluded: m.excluded,
    rationale: m.rationale,
    phases: m.phases.map((p) => [p.name, p.processes]),
  });
  const expected = { version: 'v2', selected: ['P01', 'P03'], excluded: ['P01.A2'], rationale: { P02: 'Reused, "as is"' } };

  it('reads the JSON export', async () => {
    const m = await readModel(json({ state: model(), version: v2, s, link: '' }), 'model.json', options);
    expect(essentials(m)).toEqual({ ...expected, phases: [['Build', ['P01']], ['Phase 2', ['P03']]] });
    expect(m.phases[1]).toMatchObject({ returnsTo: 'build', returnNote: 'on drift' });
    expect(m.project).toBe('Fraud detection');
  });

  it('reads the YAML lifecycle file', async () => {
    const m = await readModel(yaml(model(), s), 'model.yaml', options);
    expect(essentials(m)).toEqual({ ...expected, excluded: [], rationale: {}, phases: [['Build', ['P01']], ['Phase 2', ['P03']]] });
    expect(m.phases[0].iterative).toBe(true);
  });

  it('reads the CSV export, with the version from the file name', async () => {
    const text = '﻿' + csv({ state: model(), version: v2, s });
    const m = await readModel(text, 'fraud-detection-v2.csv', options);
    expect(essentials(m)).toEqual({ ...expected, phases: [['Build', ['P01']], ['Phase 2', ['P03']]] });
    expect(m.csv).toBe(true);
    expect((await readModel(text, 'renamed.csv', options)).version).toBe('v1');
  });

  it('reads back an untitled model without a name', () => {
    expect(fromObject({ name: 'Untitled model', phases: [] }, 'Untitled model').project).toBe('');
  });

  it('rejects other files', async () => {
    await expect(readModel('{"a": 1}', 'x.json', options)).rejects.toThrow();
    await expect(readModel('process_id,name\nP01,x', 'x.csv', options)).rejects.toThrow();
  });
});

describe('the CSV reader', () => {
  it('handles quotes, line breaks and CRLF', () => {
    expect(parseCsv('a,"b, c","say ""hi"""\r\n1,"two\nlines",3\r\n')).toEqual([
      ['a', 'b, c', 'say "hi"'],
      ['1', 'two\nlines', '3'],
    ]);
  });

  it('reads files saved with semicolons', () => {
    expect(parseCsv('a;b\n1;"x;y"')).toEqual([
      ['a', 'b'],
      ['1', 'x;y'],
    ]);
  });
});
