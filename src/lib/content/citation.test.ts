// The thesis year and the release version are written in several files that
// people copy citations from. They are compared here so they cannot drift apart.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

const cff = parse(read('CITATION.cff'));
const site = parse(read('content/site.yaml'));
const pkg = JSON.parse(read('package.json'));
const readme = read('README.md');

describe('citation metadata', () => {
  const year = cff['preferred-citation'].year;

  it('gives the same thesis year everywhere', () => {
    expect(site.thesis.year).toBe(year);
    expect(readme).toContain(`A. (${year}).`);
    expect(readme).toContain(`year   = {${year}}`);
    expect(readme).toContain(`@phdthesis{crespi${year}prm,`);
  });

  it('gives the same version in CITATION.cff and package.json', () => {
    expect(pkg.version).toBe(cff.version);
  });
});
