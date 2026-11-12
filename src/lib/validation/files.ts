import { defaultLocale, isLocale, locales } from '../../i18n/locales';
import { display, kindOf, paths, parseYaml, type ContentFiles } from '../content/files';
import type { Reporter } from './issues';

const requiredFiles = [paths.site, paths.versions, paths.studies, paths.references, paths.ui(defaultLocale)];

export function checkFiles(files: ContentFiles, report: Reporter): boolean {
  let allReadable = true;

  for (const requiredFile of requiredFiles) {
    if (files[requiredFile] === undefined) {
      report(requiredFile, 'The required file is missing.', 'Create it, or restore it from git: the site cannot be built without it.');
      allReadable = false;
    }
  }

  for (const [file, text] of Object.entries(files)) {
    const fileKind = kindOf(file);
    if (!fileKind) {
      report(file, 'The site does not read files in this place.', 'Move the file to where its kind of content belongs, or delete it.');
      continue;
    }

    const { locale, version, id } = fileKind.groups;
    if (locale !== undefined && !isLocale(locale)) {
      report(
        file,
        `"${locale}" is not one of the languages of the site (${locales.join(', ')}).`,
        'Move the file to the folder of one of those languages, or add the language to src/i18n/locales.ts.',
      );
      continue;
    }

    const isTranslation = locale !== undefined && locale !== defaultLocale && id !== undefined;
    if (isTranslation) {
      const englishFile = fileKind.kind.name === 'process' ? paths.process(version, defaultLocale, id) : paths.lifecycle(defaultLocale, id);
      if (files[englishFile] === undefined) {
        report(
          file,
          `This file translates ${display(englishFile)}, which does not exist.`,
          'Add the English file first, or delete this translation.',
        );
      }
    }

    const parsed = parseYaml(text, fileKind.kind.schema);
    if (!parsed.ok) {
      for (const problem of parsed.problems) report(file, problem);
      allReadable = false;
    }
  }

  return allReadable;
}
