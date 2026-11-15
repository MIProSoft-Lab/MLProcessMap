import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { translator } from './client-strings';
import { diagramKeys } from './lifecycle-diagram';
import { modalKeys } from './process-modal';
import { exportKeys } from './tailor/export';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');

/** The keys a script asks for: s('section.key') or t('section.key'), and the origins for s(`origin.${...}`). */
function used(code: string) {
  const keys = [...code.matchAll(/\b[st]\(\s*'([a-z]+\.[\w-]+)'/gi)].map((m) => m[1]);
  if (/\b[st]\(`origin\.\$\{/.test(code)) keys.push('origin.standards-and-literature', 'origin.standards-only', 'origin.decomposed');
  return [...new Set(keys)];
}

/** An Astro file's list of keys, with the lists it spreads in, and its script. */
function page(path: string, lists: Record<string, string[]> = {}) {
  const text = read(path);
  const list = text.match(/const keys: UiKey\[\] = \[([\s\S]*?)\n\];/)![1];
  const keys = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  for (const [, name] of list.matchAll(/\.\.\.(\w+)/g)) keys.push(...lists[name]);
  return { keys, script: text.slice(text.indexOf('<script>')) };
}

describe('the strings handed to the scripts', () => {
  it('cover what the lifecycle diagram uses', () => {
    expect(diagramKeys).toEqual(expect.arrayContaining(used(read('lib/lifecycle-diagram.ts'))));
  });

  it('cover what the exports use', () => {
    expect(exportKeys).toEqual(expect.arrayContaining(used(read('lib/tailor/export.ts'))));
  });

  it('cover what the process modal uses', () => {
    expect(modalKeys).toEqual(expect.arrayContaining(used(read('lib/process-modal.ts'))));
  });

  it('cover what the process card uses', () => {
    const { keys, script } = page('components/ProcessHover.astro');
    expect(keys).toEqual(expect.arrayContaining(used(script)));
  });

  it('cover what the lifecycle builder uses', () => {
    const { keys, script } = page('pages/[lang]/tailor.astro', { diagramKeys, exportKeys });
    expect(keys).toEqual(expect.arrayContaining(used(script)));
  });
});

describe('translator', () => {
  it('fills in a string, and reports one it was not handed', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const s = translator({ 'tip.counts': '{n} activities' });
    expect(s('tip.counts', { n: 3 })).toBe('3 activities');
    expect(error).not.toHaveBeenCalled();
    expect(s('tip.missing')).toBe('tip.missing');
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
