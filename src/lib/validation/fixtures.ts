import { stringify } from 'yaml';
import type { ContentFiles } from '../content/files';

export type Fixture = Record<string, any>;

export function process(id = 'P01') {
  return {
    id,
    number: Number(id.slice(1)),
    origin: 'standards-and-literature',
    name: `Process ${id}`,
    purpose: 'Purpose.',
    outcomes: [{ id: 'a', text: 'Outcome a.' }],
    inputs: [{ workProduct: 'goals', name: 'Goals', serves: ['a'] }],
    outputs: [{ workProduct: 'plan', name: 'Plan', serves: ['a'] }],
    activities: [{ id: `${id}.1`, title: 'Activity', description: 'Does it.', primaryStudies: ['S1'], literature: ['smith2024'] }],
  };
}

export function fixture(): Fixture {
  return {
    '/content/site.yaml': { title: { en: 'PRM' }, author: 'Author', intro: { en: 'Intro.' } },
    '/content/versions.yaml': {
      default: 'v1',
      versions: [
        {
          id: 'v1',
          status: 'current',
          title: { en: 'Version 1' },
          description: { en: 'First.' },
          topology: [{ group: { en: 'All' }, columns: [['P01', 'P02']] }],
        },
      ],
    },
    '/content/studies.yaml': { studies: [{ id: 'S1', title: 'Study', year: 2024, source: 'Journal', type: 'article' }] },
    '/content/references.yaml': { references: [{ key: 'smith2024', authors: 'Smith, A.', title: 'Paper', year: 2024 }] },
    '/content/ui/en.yaml': { nav: { processes: 'Processes', count: '{n} processes' } },
    '/content/ui/es.yaml': { nav: { processes: 'Procesos', count: '{n} procesos' } },
    '/content/prm/v1/work-products.yaml': {
      workProducts: [
        { id: 'goals', type: 'information-item', external: true },
        { id: 'plan', type: 'record' },
      ],
    },
    '/content/prm/v1/processes/en/P01.yaml': process('P01'),
    '/content/prm/v1/processes/en/P02.yaml': process('P02'),
    '/content/prm/v1/processes/es/P01.yaml': { ...process('P01'), name: 'Proceso P01' },
    '/content/lifecycles/en/basic.yaml': {
      id: 'basic',
      name: 'Basic',
      prmVersion: 'v1',
      phases: [
        { id: 'start', name: 'Start', processes: ['P01'] },
        { id: 'loop', name: 'Loop', processes: ['P02'], iterative: true, returnsTo: 'start' },
      ],
    },
  };
}

export function toFiles(f: Fixture): ContentFiles {
  return Object.fromEntries(Object.entries(f).map(([path, data]) => [path, typeof data === 'string' ? data : stringify(data)]));
}
