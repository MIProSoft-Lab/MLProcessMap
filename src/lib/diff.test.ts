import { describe, expect, it } from 'vitest';
import type { Process } from './content/schemas';
import { align, diffProcess, wordDiff } from './diff';

interface Item {
  id: string;
  text: string;
}
const item = (id: string, text = id): Item => ({ id, text });
const pair = (from: Item[], to: Item[]) =>
  align(
    from,
    to,
    (x) => x.id,
    (x) => x.text,
    (a, b) => a.text === b.text,
  ).map((p) => [p.status, p.from?.id, p.to?.id].filter(Boolean).join(' '));

describe('align', () => {
  it('pairs items with the same key, in the order of the new list', () => {
    expect(pair([item('a'), item('b')], [item('b'), item('a')])).toEqual(['same b b', 'same a a']);
  });

  it('marks a pair as changed when its text differs', () => {
    expect(pair([item('a', 'old text')], [item('a', 'new text')])).toEqual(['changed a a']);
  });

  it('pairs a renamed item with its previous version by its text', () => {
    const from = [item('A1', 'Collect the raw data from every source'), item('A2', 'Train the model')];
    const to = [item('A1', 'Define the goals'), item('A2', 'Collect the raw data from each source'), item('A3', 'Train the model')];
    // A1 and A2 keep their keys; nothing is left over to compare by text.
    expect(pair(from, to)).toEqual(['changed A1 A1', 'changed A2 A2', 'added A3']);
    // With new keys, the text decides.
    const renumbered = [item('B1', 'Define the goals'), item('B2', 'Collect the raw data from each source'), item('B3', 'Train the model')];
    expect(pair(from, renumbered)).toEqual(['added B1', 'changed A1 B2', 'same A2 B3']);
  });

  it('does not pair items that share half of their words or fewer', () => {
    expect(pair([item('a', 'one two')], [item('b', 'one three')])).toEqual(['added b', 'removed a']);
  });

  it('ignores case, punctuation and emphasis marks when comparing texts', () => {
    expect(pair([item('a', 'Clean the *raw* data.')], [item('b', 'clean the raw data')])).toEqual(['changed a b']);
  });

  it('pairs each old item once, with the most similar new one that asks first', () => {
    const from = [item('a', 'validate the trained model')];
    const to = [item('b', 'validate the trained model again'), item('c', 'validate the trained model')];
    expect(pair(from, to)).toEqual(['changed a b', 'added c']);
  });

  it('chooses the most similar of several candidates', () => {
    const from = [item('a', 'deploy the model to production'), item('b', 'monitor the model in production')];
    expect(pair(from, [item('c', 'monitor the model in production daily')])).toEqual(['removed a', 'changed b c']);
  });

  it('keeps a removed item at its place in the list', () => {
    expect(pair([item('a'), item('b'), item('c')], [item('a'), item('c')])).toEqual(['same a a', 'removed b', 'same c c']);
    expect(pair([item('a'), item('b')], [item('a')])).toEqual(['same a a', 'removed b']);
    expect(pair([item('a'), item('b')], [item('b')])).toEqual(['removed a', 'same b b']);
  });

  it('pairs repeated keys in order', () => {
    expect(pair([item('a', 'first'), item('a', 'second')], [item('a', 'first'), item('a', 'second')])).toEqual(['same a a', 'same a a']);
  });

  it('handles empty lists', () => {
    expect(pair([], [])).toEqual([]);
    expect(pair([], [item('a')])).toEqual(['added a']);
    expect(pair([item('a')], [])).toEqual(['removed a']);
  });
});

describe('wordDiff', () => {
  it('marks the words added and removed', () => {
    expect(wordDiff('Train the model', 'Train the final model')).toBe('Train the <ins>final </ins>model');
    expect(wordDiff('Train the model', 'Train the model')).toBe('Train the model');
  });

  it('separates a replaced word from the one that replaces it', () => {
    expect(wordDiff('the identified sources', 'the inventory of sources')).toBe(
      'the <del>identified</del> <ins>inventory of</ins> sources',
    );
    expect(wordDiff('data. Then', 'data, then')).not.toContain('</del> <ins>,');
  });

  it('escapes the text and drops the emphasis marks', () => {
    expect(wordDiff('a < b', 'a < *b*')).toBe('a &lt; b');
  });
});

describe('diffProcess', () => {
  const io = (workProduct: string, name: string, serves: string[] = []) => ({ workProduct, name, description: '', serves });
  const base = (): Process => ({
    id: 'P01',
    number: 1,
    origin: 'decomposed',
    name: 'Data collection',
    purpose: 'Collect the data.',
    outcomes: [{ id: 'a', text: 'Data is collected.' }],
    inputs: [io('plan', 'Plan')],
    outputs: [io('raw-dataset', 'Raw dataset', ['a'])],
    activities: [
      { id: 'A1', title: 'Find sources', description: 'Find the sources of data.' },
      { id: 'A2', title: 'Collect data', description: 'Collect the data from the sources.' },
    ],
  });

  it('finds no change between equal processes', () => {
    const d = diffProcess(base(), base());
    expect(d.changed).toBe(false);
    expect(d.counts).toEqual({ changed: 0, added: 0, removed: 0 });
  });

  it('counts what changed, was added and was removed', () => {
    const b = base();
    b.name = 'Data gathering';
    b.outcomes[0].id = 'b'; // A letter alone is not a change.
    b.inputs = [];
    b.outputs[0].serves = ['a', 'b'];
    b.outputs.push(io('data-log', 'Data log'));
    b.activities = [
      { id: 'A1', title: 'Agree the licences', description: 'Check the terms of use.' },
      { id: 'A2', title: 'Find sources', description: 'Find the sources of data.' }, // Renumbered only.
      { id: 'A3', title: 'Collect data', description: 'Collect and store the data from the sources.' },
    ];
    const d = diffProcess(base(), b);
    expect(d.name).toBe('changed');
    expect(d.purpose).toBe('same');
    expect(d.outcomes.map((p) => p.status)).toEqual(['same']);
    expect(d.inputs.map((p) => p.status)).toEqual(['removed']);
    expect(d.outputs.map((p) => p.status)).toEqual(['changed', 'added']);
    expect(d.activities.map((p) => `${p.status} ${p.from?.id ?? '–'} ${p.to?.id ?? '–'}`)).toEqual([
      'added – A1',
      'same A1 A2',
      'changed A2 A3',
    ]);
    expect(d.counts).toEqual({ changed: 3, added: 2, removed: 1 });
    expect(d.changed).toBe(true);
  });
});
