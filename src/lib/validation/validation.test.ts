import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readContentFiles } from '../content/read-files';
import { fixture, toFiles, type Fixture } from './fixtures';
import { errors, formatIssues, validate, type Issue } from './index';

const P01 = '/content/prm/v1/processes/en/P01.yaml';
const P01es = '/content/prm/v1/processes/es/P01.yaml';
const P02 = '/content/prm/v1/processes/en/P02.yaml';
const lifecycle = '/content/lifecycles/en/basic.yaml';
const workProducts = '/content/prm/v1/work-products.yaml';

/** Validates the fixture after a change to it. */
function check(change: (f: Fixture) => void = () => {}): Issue[] {
  const f = fixture();
  change(f);
  return validate(toFiles(f));
}

/** The issues as "rule: file: message". */
const summary = (issues: Issue[]) => issues.map((i) => `${i.rule}: ${i.file}: ${i.message}`);

describe('the content of the repository', () => {
  it('has no errors', () => {
    const root = fileURLToPath(new URL('../../..', import.meta.url));
    const issues = errors(validate(readContentFiles(root)));
    expect(issues, formatIssues(issues)).toEqual([]);
  });
});

describe('the fixture', () => {
  it('passes every check', () => {
    expect(summary(check())).toEqual([]);
  });
});

describe('files', () => {
  it('reports invalid YAML with the file and the line', () => {
    const issues = check((f) => (f[P01] = 'id: P01\nname: [unclosed\n'));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rule: 'files', file: P01 });
    expect(issues[0].message).toMatch(/line \d+/);
  });

  it('reports duplicate keys', () => {
    const issues = check((f) => (f[P01] = 'id: P01\nid: P02\n'));
    expect(issues[0]).toMatchObject({ rule: 'files', file: P01 });
    expect(issues[0].message).toMatch(/unique/i);
  });

  it('reports every schema problem with the path of the field', () => {
    const issues = check((f) => {
      f[P01].origin = 'somewhere';
      delete f[P01].outputs[0].name;
    });
    const messages = summary(issues).join('\n');
    expect(messages).toContain(`files: ${P01}: origin:`);
    expect(messages).toContain(`files: ${P01}: outputs[0].name:`);
  });

  it('reports problems in several files at once', () => {
    const issues = check((f) => {
      f[P01].number = 'one';
      f['/content/studies.yaml'].studies[0].year = 'recent';
    });
    expect(new Set(issues.map((i) => i.file))).toEqual(new Set([P01, '/content/studies.yaml']));
  });

  it('reports a missing required file', () => {
    expect(summary(check((f) => delete f['/content/references.yaml']))).toEqual([
      'files: /content/references.yaml: The required file is missing.',
    ]);
  });

  it('reports files the site does not read', () => {
    expect(summary(check((f) => (f['/content/prm/v1/P03.yaml'] = 'id: P03')))).toEqual([
      'files: /content/prm/v1/P03.yaml: The site does not read files in this place.',
    ]);
  });

  it('reports a language the site does not have', () => {
    const issues = check((f) => (f['/content/prm/v1/processes/de/P01.yaml'] = f[P01]));
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('"de" is not one of the languages');
  });

  it('reports a translation without an English file', () => {
    expect(summary(check((f) => (f['/content/prm/v1/processes/es/P03.yaml'] = { ...f[P01], id: 'P03' })))).toEqual([
      'files: /content/prm/v1/processes/es/P03.yaml: This file translates content/prm/v1/processes/en/P03.yaml, which does not exist.',
    ]);
  });

  it('skips the rules while a file cannot be read', () => {
    const issues = check((f) => {
      f[P01].number = 'one';
      f['/content/versions.yaml'].default = 'v9';
    });
    expect(issues.map((i) => i.rule)).toEqual(['files']);
  });
});

describe('rules', () => {
  it('versions: the default version exists', () => {
    expect(summary(check((f) => (f['/content/versions.yaml'].default = 'v9')))).toEqual([
      'versions: /content/versions.yaml: The default version "v9" is not one of the versions.',
    ]);
  });

  it('versions: "latest" is reserved', () => {
    const issues = check((f) => {
      f['/content/versions.yaml'].versions[0].id = 'latest';
      f['/content/versions.yaml'].default = 'latest';
    });
    expect(summary(issues)).toContain('versions: /content/versions.yaml: A version is called "latest", which is reserved for links to the default version.');
  });

  it('versions: the topology places every process once', () => {
    const issues = check((f) => {
      f['/content/versions.yaml'].versions[0].topology[0].columns = [['P01', 'P01']];
    });
    expect(summary(issues)).toEqual([
      'versions: /content/versions.yaml: The topology of v1 lists P01 2 times.',
      'versions: /content/versions.yaml: The topology of v1 does not list P02, so the process map does not show it.',
    ]);
  });

  it('versions: the topology lists processes that have a file', () => {
    expect(summary(check((f) => f['/content/versions.yaml'].versions[0].topology[0].columns[0].push('P03')))).toEqual([
      'versions: /content/versions.yaml: The topology of v1 lists P03, which has no process file.',
    ]);
  });

  it('process-id: the id matches the file name', () => {
    expect(summary(check((f) => (f['/content/prm/v1/processes/en/P02.yaml'].id = 'P07')))).toEqual([
      'process-id: /content/prm/v1/processes/en/P02.yaml: The id is P07, but the file is named P02.yaml.',
    ]);
  });

  it('process-outcomes: inputs and outputs serve existing outcomes', () => {
    expect(summary(check((f) => f['/content/prm/v1/processes/en/P02.yaml'].outputs[0].serves.push('z')))).toEqual([
      'process-outcomes: /content/prm/v1/processes/en/P02.yaml: The output "Plan" serves outcome (z), which this process does not have.',
    ]);
  });

  it('process-unique-ids: outcomes, activities, inputs and outputs appear once', () => {
    const issues = check((f) => {
      f[P02].outcomes.push({ id: 'a', text: 'Again.' });
      f[P02].inputs.push(f[P02].inputs[0]);
    });
    expect(summary(issues)).toEqual([
      `process-unique-ids: ${P02}: The outcome ID "a" is used more than once.`,
      `process-unique-ids: ${P02}: The work product "goals" is listed more than once among the inputs.`,
    ]);
  });

  it('outcome-evidence: every outcome is served by an output (warning)', () => {
    const issues = check((f) => {
      f[P02].outcomes.push({ id: 'b', text: 'B.' }, { id: 'c', text: 'C.' });
      f[P02].inputs[0].serves.push('b');
    });
    expect(issues.every((i) => i.severity === 'warning')).toBe(true);
    expect(summary(issues)).toEqual([
      `outcome-evidence: ${P02}: Outcome (b) is served by inputs, but by no output.`,
      `outcome-evidence: ${P02}: Outcome (c) is served by no input or output.`,
    ]);
  });

  it('work-product-flow: inputs are produced or external, and external ones are not produced', () => {
    const issues = check((f) => {
      f[workProducts].workProducts = [
        { id: 'plan', type: 'record', external: true },
        { id: 'unused', type: 'artifact' },
      ];
    });
    expect(summary(issues)).toEqual([
      `work-product-flow: ${P01}: The input "Goals" is not an output of any process of v1.`,
      `work-product-flow: ${P02}: The input "Goals" is not an output of any process of v1.`,
      `work-product-flow: ${workProducts}: "plan" is marked external, but P01 and P02 produce it.`,
      `work-product-flow: ${workProducts}: "unused" is not an input or output of any process of v1.`,
    ]);
  });

  it('work-product-flow: a work product has one name', () => {
    expect(summary(check((f) => (f[P02].outputs[0].name = 'Project plan')))).toEqual([
      `work-product-flow: ${P02}: The work product "plan" is called "Project plan" here, but "Plan" in P01.`,
    ]);
  });

  it('work-product-dead-ends: outputs other than records are used (warning)', () => {
    const issues = check((f) => (f[workProducts].workProducts[1].type = 'artifact'));
    expect(summary(issues)).toEqual([
      `work-product-dead-ends: ${P01}: The output "Plan" is not an input of any process.`,
      `work-product-dead-ends: ${P02}: The output "Plan" is not an input of any process.`,
    ]);
  });

  it('lifecycle-dataflow: inputs are available when a phase starts (warning)', () => {
    // P01 starts the lifecycle and needs a report that only P02, in the next phase, produces.
    const later = (f: Fixture) => {
      f[P01].inputs.push({ workProduct: 'report', name: 'Report', serves: ['a'] });
      f[P02].outputs.push({ workProduct: 'report', name: 'Report', serves: ['a'] });
      delete f[P01es];
    };
    // The loop phase returns to the start, so the plan is there from the second pass on.
    expect(summary(check(later))).toEqual([]);
    expect(
      summary(
        check((f) => {
          later(f);
          delete f[lifecycle].phases[1].returnsTo;
        }),
      ),
    ).toEqual([`lifecycle-dataflow: ${lifecycle}: In phase "start", P01 needs "Report", which is first produced later, in phase "loop".`]);
    expect(
      summary(
        check((f) => {
          later(f);
          f[lifecycle].phases = [f[lifecycle].phases[0]];
        }),
      ),
    ).toEqual([`lifecycle-dataflow: ${lifecycle}: In phase "start", P01 needs "Report", but no process of the lifecycle produces it.`]);
    expect(
      summary(
        check((f) => {
          later(f);
          f[P01].inputs[1].optional = true;
          f[lifecycle].phases = [f[lifecycle].phases[0]];
        }),
      ),
    ).toEqual([]);
  });

  it('citations: a study points to a known reference', () => {
    expect(summary(check((f) => (f['/content/studies.yaml'].studies[0].reference = 'nobody2020')))).toEqual([
      'citations: /content/studies.yaml: Study S1 points to reference "nobody2020", which is not in content/references.yaml.',
    ]);
  });

  it('citations: activities cite known studies and references', () => {
    const issues = check((f) => {
      f['/content/prm/v1/processes/en/P02.yaml'].activities[0].primaryStudies = ['S9'];
      f['/content/prm/v1/processes/en/P02.yaml'].activities[0].literature = ['nobody2020'];
    });
    expect(summary(issues)).toEqual([
      'citations: /content/prm/v1/processes/en/P02.yaml: Activity P02.1 cites study S9, which is not in content/studies.yaml.',
      'citations: /content/prm/v1/processes/en/P02.yaml: Activity P02.1 cites reference "nobody2020", which is not in content/references.yaml.',
    ]);
  });

  it('process-translations: a translation keeps the IDs of the English file', () => {
    expect(summary(check((f) => (f[P01es].outcomes[0].id = 'b')))).toContain(
      `process-translations: ${P01es}: The outcomes differ from the English file (here: b; in English: a).`,
    );
  });

  it('lifecycles: the PRM version exists', () => {
    expect(summary(check((f) => (f[lifecycle].prmVersion = 'v9')))).toEqual([`lifecycles: ${lifecycle}: The lifecycle uses PRM version v9, which does not exist.`]);
  });

  it('lifecycles: phases list processes of the version and return to existing phases', () => {
    const issues = check((f) => {
      f[lifecycle].phases[0].processes.push('P09');
      f[lifecycle].phases[1].returnsTo = 'nowhere';
    });
    expect(summary(issues)).toEqual([
      `lifecycles: ${lifecycle}: Phase "start" lists P09, which is not a process of v1.`,
      `lifecycles: ${lifecycle}: Phase "loop" returns to "nowhere", which is not a phase of this lifecycle.`,
    ]);
  });

  it('ui-translations: translated strings exist in English and keep the placeholders', () => {
    const issues = check((f) => {
      f['/content/ui/es.yaml'].nav.extra = 'Extra';
      f['/content/ui/es.yaml'].nav.count = '{total} procesos';
    });
    expect(summary(issues)).toEqual([
      'ui-translations: /content/ui/es.yaml: "nav.count" uses the placeholders {total}, but the English text uses {n}.',
      'ui-translations: /content/ui/es.yaml: "nav.extra" does not exist in content/ui/en.yaml.',
    ]);
  });
});

describe('formatIssues', () => {
  const issues: Issue[] = [
    { file: '/content/b.yaml', message: 'Two.', rule: 'r', severity: 'error', fix: 'Fix two.' },
    { file: '/content/a.yaml', message: 'One.', rule: 'r', severity: 'error' },
    { file: '/content/b.yaml', message: 'Three.', rule: 's', severity: 'warning' },
  ];

  it('lists errors before warnings, grouped by file, with the severity on every line', () => {
    expect(formatIssues(issues)).toBe(
      [
        'Errors (2)',
        '',
        'content/a.yaml',
        '  error   One.  [r]',
        '',
        'content/b.yaml',
        '  error   Two.  [r]',
        '          Fix: Fix two.',
        '',
        'Warnings (1)',
        '',
        'content/b.yaml',
        '  warning Three.  [s]',
      ].join('\n'),
    );
  });

  it('explains the rules that reported, when given their descriptions', () => {
    const text = formatIssues(issues, { ruleDescriptions: { s: 'What s checks.' } });
    expect(text.endsWith('About these rules:\n  s: What s checks.')).toBe(true);
  });

  it('gives every reported issue a fix', () => {
    const everything = check((f) => {
      f[P02].id = 'P07';
      f[P02].outputs[0].serves.push('z');
      f['/content/versions.yaml'].default = 'v9';
    });
    expect(everything.filter((issue) => !issue.fix)).toEqual([]);
  });
});
