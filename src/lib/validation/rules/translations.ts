import { defaultLocale, locales } from '../../../i18n/locales';
import { display, paths } from '../../content/files';
import type { Process } from '../../content/schemas';
import type { Rule } from '../rule';
import { processFiles } from '../walk';

/** Only the text is translated, so these must match exactly and in order. */
function idsOf(process: Process): Record<string, string[]> {
  return {
    outcomes: process.outcomes.map((outcome) => outcome.id),
    activities: process.activities.map((activity) => activity.id),
    inputs: process.inputs.map((input) => input.workProduct),
    outputs: process.outputs.map((output) => output.workProduct),
  };
}

export const processTranslations: Rule = {
  id: 'process-translations',
  description: 'A translated process has the same outcomes, activities, inputs and outputs as the English one.',
  severity: 'error',
  check({ content, report }) {
    for (const { file, version, locale, id: processId, process } of processFiles(content)) {
      if (locale === defaultLocale) continue;

      const englishFile = display(paths.process(version, defaultLocale, processId));
      const englishIds = idsOf(content.getProcess(version, processId, defaultLocale).data);
      const translatedIds = idsOf(process);

      for (const part of Object.keys(englishIds)) {
        const here = translatedIds[part].join(', ') || 'none';
        const inEnglish = englishIds[part].join(', ') || 'none';
        if (here === inEnglish) continue;
        report(
          file,
          `The ${part} differ from the English file (here: ${here}; in English: ${inEnglish}).`,
          `A translation only changes the text: keep the IDs and order of ${englishFile}.`,
        );
      }
    }
  },
};

/** `placeholdersOf('{n} of {total} processes')` is `"n, total"`. */
const placeholdersOf = (text: string) =>
  [...text.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(', ');

// The site fills in only the placeholders of the English text.
export const uiTranslations: Rule = {
  id: 'ui-translations',
  description: 'Translated interface strings exist in English and use the same {placeholders}.',
  severity: 'error',
  check({ content, report }) {
    const englishStrings = content.uiStrings(defaultLocale) ?? {};
    const englishFile = display(paths.ui(defaultLocale));

    for (const locale of locales) {
      if (locale === defaultLocale) continue;

      const file = paths.ui(locale);

      for (const [key, translatedText] of Object.entries(content.uiStrings(locale) ?? {})) {
        const englishText = englishStrings[key];
        if (englishText === undefined) {
          report(file, `"${key}" does not exist in ${englishFile}.`, `Add it to ${englishFile} first, or remove it here.`);
          continue;
        }

        const translatedPlaceholders = placeholdersOf(translatedText);
        const englishPlaceholders = placeholdersOf(englishText);
        if (translatedPlaceholders !== englishPlaceholders) {
          report(
            file,
            `"${key}" uses the placeholders {${translatedPlaceholders || 'none'}}, but the English text uses {${englishPlaceholders || 'none'}}.`,
            'Use the same placeholders as the English text, which the site fills in.',
          );
        }
      }
    }
  },
};
