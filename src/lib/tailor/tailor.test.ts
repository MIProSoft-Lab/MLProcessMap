import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { lifecycleSchema } from '../content/schemas';
import { format } from '../text';
import { json, lifecyclePhases, markdown, yaml } from './export';
import { fromObject, readModel, toState } from './import';
import {
  assignToPhase,
  fromHash,
  insertInOrder,
  inVersion,
  missingInputs,
  movePhase,
  moveProcess,
  phase,
  startFrom,
  syncPhases,
  toHash,
  type Data,
  type State,
  type Version,
} from './model';
import { missingList, phaseCard, phaseLabel, phaseSelect, processRow, startOptions } from './render';

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

  it('ignores a rationale in the link that is not an object of texts', () => {
    for (const r of ['null', '[]', '"text"', '42', '{broken']) {
      expect(fromHash(data, `r=${encodeURIComponent(r)}`).rationale).toEqual({});
    }
    expect(fromHash(data, `r=${encodeURIComponent('{"P02":"not needed","P03":5}')}`).rationale).toEqual({ P02: 'not needed' });
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

/** The processes of each phase. */
const ids = (state: State) => state.phases.map((p) => p.processes);

describe('editing the phases', () => {
  it('assign a process to one phase only, in the order of the PRM, or to none', () => {
    const state = model();
    state.selected.add('P02');
    assignToPhase(state, 'P02', 'phase-2', v2);
    expect(ids(state)).toEqual([['P01'], ['P02', 'P03']]);
    assignToPhase(state, 'P03', 'phase-1', v2);
    expect(ids(state)).toEqual([['P01', 'P03'], ['P02']]);
    assignToPhase(state, 'P02', '', v2);
    expect(ids(state)).toEqual([['P01', 'P03'], []]);
  });

  it('move a phase up or down, but not past the ends', () => {
    const state = model();
    movePhase(state, 1, -1);
    expect(state.phases.map((p) => p.id)).toEqual(['phase-2', 'phase-1']);
    movePhase(state, 0, -1);
    movePhase(state, 1, 1);
    expect(state.phases.map((p) => p.id)).toEqual(['phase-2', 'phase-1']);
  });

  it('move a dragged process before another, to the end, or out of the phases', () => {
    const state = model();
    state.phases[1].processes = ['P02', 'P03'];
    moveProcess(state, 'P01', 'phase-1', 'phase-2', 'P03');
    expect(ids(state)).toEqual([[], ['P02', 'P01', 'P03']]);
    moveProcess(state, 'P02', 'phase-2', 'phase-2');
    expect(ids(state)).toEqual([[], ['P01', 'P03', 'P02']]);
    moveProcess(state, 'P03', 'phase-2', '');
    expect(ids(state)).toEqual([[], ['P01', 'P02']]);
    moveProcess(state, 'P03', '', 'phase-1');
    expect(ids(state)).toEqual([['P03'], ['P01', 'P02']]);
  });
});

describe('replacing the model', () => {
  it('keeps the processes another version has, and no excluded activity', () => {
    const state = inVersion(model(), v1);
    expect([state.version, [...state.selected], [...state.excluded]]).toEqual(['v1', ['P01'], []]);
  });

  it('starts from every process, none, or a template with its phases', () => {
    const state = model();
    expect(startFrom(state, 'all', data)).toBeUndefined();
    expect([...state.selected, ...state.excluded]).toEqual(['P01', 'P02', 'P03']);
    startFrom(state, 'none', data);
    expect([state.selected.size, ids(state)]).toEqual([0, [[], []]]);
    expect(startFrom(state, 'lc:basic', data)?.name).toBe('Basic');
    expect([state.project, state.description, [...state.selected]]).toEqual(['Basic', 'A basic lifecycle.', ['P01', 'P03']]);
    expect(state.phases.map((p) => [p.id, p.processes, p.returnsTo])).toEqual([
      ['one', ['P01'], ''],
      ['two', ['P03'], 'one'],
    ]);
  });

  it('opens an imported model in its version, leaving out unknown processes', () => {
    const imported = { ...fromObject(JSON.parse(json({ state: model(), version: v2, s, link: '' })), 'Untitled model') };
    imported.selected.push('P99');
    const { state, unknown } = toState(imported, v1);
    expect([state.version, [...state.selected], unknown, state.tab]).toEqual(['v1', ['P01'], ['P03', 'P99'], 'phases']);
  });
});

describe('the builder templates', () => {
  const view = () => ({ state: model(), version: v2, s });

  it('number the phases and name the unnamed ones', () => {
    const { state } = view();
    expect(state.phases.map((p, i) => phaseLabel(p, i, s))).toEqual(['01 Build', '02 Phase 2']);
  });

  it('escape what the user typed', () => {
    const v = view();
    v.state.rationale.P02 = '<b>"x"</b>';
    v.state.phases[0].name = '<i>';
    const html = processRow(v, v2.processes[1]) + phaseCard(v, v.state.phases[0], 0, { free: [], touch: false });
    expect(html).not.toMatch(/<b>|<i>/);
    expect(html).toContain('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });

  it('offer the phase menu only for selected processes, once there are phases', () => {
    const v = view();
    expect(phaseSelect(v, 'P02')).toBe('');
    expect(phaseSelect(v, 'P01')).toContain('<option value="phase-1" selected>01 Build</option>');
    v.state.phases = [];
    expect(phaseSelect(v, 'P01')).toBe('');
  });

  it('point an empty phase at the menu on a touch screen', () => {
    const v = view();
    const empty = phase({ id: 'phase-3' });
    v.state.phases.push(empty);
    const free = [v2.processes[1]];
    expect(phaseCard(v, empty, 2, { free, touch: true })).toContain('tailor.phase-drop-touch');
    expect(phaseCard(v, empty, 2, { free, touch: false })).toContain('tailor.phase-drop<');
  });

  it('list the producers of missing inputs, or say there are none', () => {
    const v = view();
    expect(missingList(v, missingInputs(v.state, v2))).toContain('data-add="P02"');
    expect(missingList(v, new Map())).toContain('tailor.allCovered');
  });

  it('offer the templates of the version only', () => {
    expect(startOptions(data, model(), s)).toContain('data-start="lc:basic"');
    expect(startOptions(data, { ...model(), version: 'v1' }, s)).not.toContain('lc:basic');
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

  it('write lifecycle YAML with quotes only where needed', () => {
    const out = yaml({ ...model(), project: 'yes' }, s);
    expect(out).toContain('id: yes\nname: "yes"\n');
    expect(out).toContain('    returnsTo: build\n    returnNote: on drift\n');
  });

  it('write lifecycle YAML the site accepts when names look like numbers or dates', () => {
    const names = ['2026', '42', '1e3', '0x1F', '1.5', '2026-11-15'];
    for (const project of names) {
      const state = model();
      state.phases[0].name = project;
      const file = lifecycleSchema.parse(parse(yaml({ ...state, project, description: project }, s)));
      expect(file.name).toBe(project);
      expect(file.description).toBe(project);
      expect(file.phases[0].name).toBe(project);
      expect(file.phases[1].returnsTo).toBe(file.phases[0].id);
    }
    expect(yaml({ ...model(), project: '3D vision' }, s)).toContain('id: 3d-vision\nname: 3D vision\n');
  });
});

describe('importing an export', () => {
  const untitled = s('tailor.untitled');
  const essentials = (m: {
    version: string;
    selected: string[];
    excluded: string[];
    rationale: Record<string, string>;
    phases: { name: string; processes: string[] }[];
  }) => ({
    version: m.version,
    selected: [...m.selected].sort(),
    excluded: m.excluded,
    rationale: m.rationale,
    phases: m.phases.map((p) => [p.name, p.processes]),
  });
  const expected = { version: 'v2', selected: ['P01', 'P03'], excluded: ['P01.A2'], rationale: { P02: 'Reused, "as is"' } };

  it('reads the JSON export', async () => {
    const m = await readModel(json({ state: model(), version: v2, s, link: '' }), untitled);
    expect(essentials(m)).toEqual({
      ...expected,
      phases: [
        ['Build', ['P01']],
        ['Phase 2', ['P03']],
      ],
    });
    expect(m.phases[1]).toMatchObject({ returnsTo: 'build', returnNote: 'on drift' });
    expect(m.project).toBe('Fraud detection');
  });

  it('reads the YAML lifecycle file', async () => {
    const m = await readModel(yaml(model(), s), untitled);
    expect(essentials(m)).toEqual({
      ...expected,
      excluded: [],
      rationale: {},
      phases: [
        ['Build', ['P01']],
        ['Phase 2', ['P03']],
      ],
    });
    expect(m.phases[0].iterative).toBe(true);
  });

  it('reads back an untitled model without a name', () => {
    expect(fromObject({ name: 'Untitled model', phases: [] }, 'Untitled model').project).toBe('');
  });

  it('rejects other files', async () => {
    await expect(readModel('{"a": 1}', untitled)).rejects.toThrow();
    await expect(readModel('process_id,name\nP01,x', untitled)).rejects.toThrow();
  });
});

