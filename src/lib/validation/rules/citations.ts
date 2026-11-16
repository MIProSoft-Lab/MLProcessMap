import { display, paths } from '../../content/files';
import type { Rule } from '../rule';
import { processFiles } from '../walk';

export const citations: Rule = {
  id: 'citations',
  description: 'Activities cite studies in studies.yaml and references in references.yaml, and a study points to a reference that exists.',
  severity: 'error',
  check({ content, report }) {
    const knownStudyIds = new Set(content.studies.map((study) => study.id));
    const knownReferenceKeys = new Set(content.references.map((reference) => reference.key));
    const studiesFile = display(paths.studies);
    const referencesFile = display(paths.references);

    for (const study of content.studies) {
      if (study.reference && !knownReferenceKeys.has(study.reference)) {
        report(
          paths.studies,
          `Study ${study.id} points to reference "${study.reference}", which is not in ${referencesFile}.`,
          `Add the reference to ${referencesFile}, or correct the key.`,
        );
      }
    }

    for (const { file, process } of processFiles(content)) {
      for (const activity of process.activities) {
        for (const studyId of activity.primaryStudies ?? []) {
          if (!knownStudyIds.has(studyId)) {
            report(file, `Activity ${activity.id} cites study ${studyId}, which is not in ${studiesFile}.`, `Add the study to ${studiesFile}, or correct the ID.`);
          }
        }

        for (const referenceKey of activity.literature ?? []) {
          if (!knownReferenceKeys.has(referenceKey)) {
            report(
              file,
              `Activity ${activity.id} cites reference "${referenceKey}", which is not in ${referencesFile}.`,
              `Add the reference to ${referencesFile}, or correct the key.`,
            );
          }
        }
      }
    }
  },
};
