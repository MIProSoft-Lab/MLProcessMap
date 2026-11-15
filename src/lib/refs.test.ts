import { describe, expect, it } from 'vitest';
import type { Reference } from './content/schemas';
import { fullCite, referenceUrl, shortCite } from './refs';

const ref = (r: Partial<Reference>): Reference => ({ key: 'k', authors: '', title: '', year: '', ...r });

describe('shortCite', () => {
  it('names one or two authors, and the first of more', () => {
    expect(shortCite(ref({ authors: 'Khan, Arif', year: '2024' }))).toBe('Khan, 2024');
    expect(shortCite(ref({ authors: 'Khan, Arif and Lee, Min', year: '2024' }))).toBe('Khan & Lee, 2024');
    expect(shortCite(ref({ authors: 'Khan, Arif and Lee, Min and Ruiz, Ana', year: '2024' }))).toBe('Khan et al., 2024');
  });

  it('keeps an author written without a comma, such as an organization', () => {
    expect(shortCite(ref({ authors: 'ISO/IEC', year: '2022' }))).toBe('ISO/IEC, 2022');
  });

  it('uses the title when there are no authors, and leaves out a missing year', () => {
    expect(shortCite(ref({ title: 'Machine learning guide', year: '2020' }))).toBe('Machine learning guide, 2020');
    expect(shortCite(ref({ authors: 'Khan, Arif' }))).toBe('Khan');
  });

  it('shows the key of a reference that is not in the bibliography', () => {
    expect(shortCite(undefined, 'khan2024')).toBe('khan2024');
  });
});

describe('fullCite', () => {
  it('joins the parts that are present', () => {
    expect(fullCite(ref({ authors: 'Khan, Arif', year: '2024', title: 'A study', venue: 'Journal of Tests', publisher: 'ACM' }))).toBe('Khan, Arif (2024) A study. *Journal of Tests*. ACM.');
    expect(fullCite(ref({ title: 'A study' }))).toBe('A study.');
  });
});

describe('referenceUrl', () => {
  it('links a DOI, written with or without its address', () => {
    expect(referenceUrl(ref({ doi: '10.1000/xyz' }))).toBe('https://doi.org/10.1000/xyz');
    expect(referenceUrl(ref({ doi: 'https://doi.org/10.1000/xyz' }))).toBe('https://doi.org/10.1000/xyz');
    expect(referenceUrl(ref({ doi: 'http://dx.doi.org/10.1000/xyz' }))).toBe('https://doi.org/10.1000/xyz');
  });

  it('prefers the DOI to the URL, and has neither for some references', () => {
    expect(referenceUrl(ref({ doi: '10.1000/xyz', url: 'https://example.org' }))).toBe('https://doi.org/10.1000/xyz');
    expect(referenceUrl(ref({ url: 'https://example.org' }))).toBe('https://example.org');
    expect(referenceUrl(ref({}))).toBeUndefined();
  });
});
