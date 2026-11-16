import { describe, expect, it } from 'vitest';
import { diagramSvgs, lifecycleLoops, type DiagramInput, type Translate } from './lifecycle-diagram';

// Shows the key and its values, so the tests can tell which string was used.
const t: Translate = (key, vars = {}) => `${key}(${Object.values(vars).join('|')})`;
const proc = (id: string) => ({ id, name: `Name of ${id}`, origin: 'decomposed', purpose: `Purpose of ${id}` });
const count = (text: string, part: string) => text.split(part).length - 1;

describe('lifecycleLoops', () => {
  it('numbers the returns to another phase in order', () => {
    const loops = lifecycleLoops([{ id: 'a' }, { id: 'b', returnsTo: 'a', returnNote: 'on drift' }, { id: 'c', returnsTo: 'a' }]);
    expect(loops).toEqual([
      { from: 1, to: 0, note: 'on drift', label: 'L1' },
      { from: 2, to: 0, note: undefined, label: 'L2' },
    ]);
  });

  it('leaves out a return to the same phase or to one that does not exist', () => {
    expect(lifecycleLoops([{ id: 'a', returnsTo: 'a' }, { id: 'b', returnsTo: 'gone' }, { id: 'c', returnsTo: '' }])).toEqual([]);
  });

  it('accepts a return to a later phase', () => {
    expect(lifecycleLoops([{ id: 'a', returnsTo: 'b' }, { id: 'b' }])).toEqual([{ from: 0, to: 1, note: undefined, label: 'L1' }]);
  });
});

describe('diagramSvgs', () => {
  const input = (): DiagramInput => ({
    name: 'M & M',
    version: 'v2',
    procHref: (id) => `/v2/processes/${id}/`,
    phases: [
      { id: 'plan', name: 'Plan <it>', procs: [proc('P01'), proc('P02')] },
      { id: 'build', name: 'Build', iterative: true, returnsTo: 'plan', returnNote: 'on "drift"', procs: [proc('P03')] },
      { id: 'run', name: 'Run', returnsTo: 'run', procs: [] },
    ],
  });
  const svgs = diagramSvgs(input(), t);

  it('draws the model twice, across and down', () => {
    expect(count(svgs, '<svg ')).toBe(2);
    expect(svgs).toContain('class="diagram diagram-h"');
    expect(svgs).toContain('class="diagram diagram-v"');
    expect(count(svgs, '<svg ')).toBe(count(svgs, '</svg>'));
    expect(count(svgs, '<g ')).toBe(count(svgs, '</g>'));
  });

  it('draws each phase with its number and its processes as links', () => {
    expect(count(svgs, 'class="phase"')).toBe(6);
    for (const n of ['01', '02', '03']) expect(count(svgs, `>${n}</text>`)).toBe(2);
    expect(count(svgs, 'href="/v2/processes/P03/"')).toBe(2);
    expect(count(svgs, 'class="tag origin-decomposed"')).toBe(6);
    expect(svgs).toContain('data-process="P01" data-version="v2"');
  });

  it('draws a loop for a return to another phase, with its note', () => {
    expect(count(svgs, 'class="loop"')).toBe(2);
    expect(svgs).toContain('data-from="1" data-to="0"');
    expect(svgs).toContain('data-tip-title="L1 · Build → Plan &lt;it&gt;"');
    expect(svgs).toContain('data-tip-body="on &quot;drift&quot;"');
  });

  it('marks as repeated a phase that is iterative or returns to itself', () => {
    expect(count(svgs, 'class="repeat"')).toBe(4);
    expect(svgs).toContain('data-tip-title="↻ Build"');
    expect(svgs).toContain('data-tip-title="↻ Run"');
    expect(svgs).not.toContain('data-tip-title="↻ Plan');
  });

  it('describes the phases and their loops in the tips', () => {
    expect(svgs).toContain('lc.tipProcesses(2)\nlc.tipReceives(L1|Build)"');
    expect(svgs).toContain('lc.tipProcesses(1)\nlc.legendRepeated()\nlc.tipReturns(L1|Plan &lt;it&gt;)"');
  });

  it('escapes the names', () => {
    expect(svgs).toContain('lc.diagram(M &amp; M)</title>');
    expect(svgs).toContain('>Plan &lt;it&gt;</text>');
    expect(svgs).not.toContain('<it>');
  });

  it('wraps a long phase name over several lines and makes room for many processes', () => {
    const long = input();
    long.phases[0].name = 'Understanding of the business problem and its data';
    long.phases[0].procs = Array.from({ length: 12 }, (_, i) => proc(`P${String(i + 10)}`));
    const out = diagramSvgs(long, t);
    expect(out).not.toContain('>Understanding of the business problem and its data<');
    expect(out).toContain('Understanding of');
    expect(count(out, 'class="tag origin-decomposed"')).toBe(26);
    const height = (s: string) => Number(s.match(/diagram-h" viewBox="0 0 \d+ (\d+)"/)![1]);
    expect(height(out)).toBeGreaterThan(height(svgs));
  });

  it('draws a model without phases', () => {
    const empty = diagramSvgs({ ...input(), phases: [] }, t);
    expect(count(empty, '<svg ')).toBe(2);
    expect(empty).not.toContain('class="phase"');
  });
});
