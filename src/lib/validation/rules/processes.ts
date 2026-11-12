import { defaultLocale } from '../../../i18n/locales';
import type { Rule } from '../rule';
import { processFiles } from '../walk';

// The site finds a process by its file name and links to it by its id.
export const processIds: Rule = {
  id: 'process-id',
  description: 'The id in a process file matches the name of the file.',
  severity: 'error',
  check({ content, report }) {
    for (const { file, id: idFromFileName, process } of processFiles(content)) {
      if (process.id !== idFromFileName) {
        report(file, `The id is ${process.id}, but the file is named ${idFromFileName}.yaml.`, `Change the id to ${idFromFileName}, or rename the file.`);
      }
    }
  },
};

export const processOutcomes: Rule = {
  id: 'process-outcomes',
  description: 'The inputs and outputs of a process serve outcomes of that process.',
  severity: 'error',
  check({ content, report }) {
    for (const { file, process } of processFiles(content)) {
      const outcomeIds = process.outcomes.map((outcome) => outcome.id);
      const workProducts = [
        ...process.inputs.map((input) => ({ kind: 'input', ...input })),
        ...process.outputs.map((output) => ({ kind: 'output', ...output })),
      ];

      for (const workProduct of workProducts) {
        for (const servedOutcomeId of workProduct.serves) {
          if (outcomeIds.includes(servedOutcomeId)) continue;
          report(
            file,
            `The ${workProduct.kind} "${workProduct.name}" serves outcome (${servedOutcomeId}), which this process does not have.`,
            `Use one of its outcomes: ${outcomeIds.map((outcomeId) => `(${outcomeId})`).join(', ')}.`,
          );
        }
      }
    }
  },
};

export const processUniqueIds: Rule = {
  id: 'process-unique-ids',
  description: 'A process names each outcome and activity once, and lists a work product once among its inputs and once among its outputs.',
  severity: 'error',
  check({ content, report }) {
    for (const { file, process } of processFiles(content)) {
      const duplicatesOf = (ids: string[]) => new Set(ids.filter((id, index) => ids.indexOf(id) !== index));

      for (const outcomeId of duplicatesOf(process.outcomes.map((outcome) => outcome.id))) {
        report(file, `The outcome ID "${outcomeId}" is used more than once.`, 'Give each outcome its own ID.');
      }

      for (const activityId of duplicatesOf(process.activities.map((activity) => activity.id))) {
        report(file, `The activity ID "${activityId}" is used more than once.`, 'Give each activity its own ID.');
      }

      for (const [listName, list] of [
        ['inputs', process.inputs],
        ['outputs', process.outputs],
      ] as const) {
        for (const workProductId of duplicatesOf(list.map((entry) => entry.workProduct))) {
          report(file, `The work product "${workProductId}" is listed more than once among the ${listName}.`, 'List it once, with every outcome it serves.');
        }
      }
    }
  },
};

// The outputs are the evidence an assessor looks at to see an outcome was
// achieved. Translations repeat the structure, so only English is checked.
export const outcomeEvidence: Rule = {
  id: 'outcome-evidence',
  description:
    'Every outcome of a process is served by at least one of its outputs, the work product an assessor would look at to see it was achieved.',
  severity: 'warning',
  check({ content, report }) {
    for (const { file, locale, process } of processFiles(content)) {
      if (locale !== defaultLocale) continue;

      const outcomesServedByOutputs = new Set(process.outputs.flatMap((output) => output.serves));
      const outcomesServedByInputs = new Set(process.inputs.flatMap((input) => input.serves));

      for (const outcome of process.outcomes) {
        if (outcomesServedByOutputs.has(outcome.id)) continue;
        const message = outcomesServedByInputs.has(outcome.id)
          ? `Outcome (${outcome.id}) is served by inputs, but by no output.`
          : `Outcome (${outcome.id}) is served by no input or output.`;
        report(file, message, `Add (${outcome.id}) to the serves of the output that shows it was achieved.`);
      }
    }
  },
};
