import { defaultLocale } from '../../../i18n/locales';
import { display, paths } from '../../content/files';
import type { Rule } from '../rule';

// The topology is the layout of the process map: the processes of each column.
export const versions: Rule = {
  id: 'versions',
  description: 'The default version exists, no version is called "latest", and the topology of every version places each of its processes exactly once.',
  severity: 'error',
  check({ content, report }) {
    const versionsFile = paths.versions;
    const versionIds = content.versions.map((version) => version.id);

    if (!versionIds.includes(content.defaultVersion)) {
      report(versionsFile, `The default version "${content.defaultVersion}" is not one of the versions.`, `Set default to one of: ${versionIds.join(', ')}.`);
    }

    if (versionIds.includes('latest')) {
      report(versionsFile, 'A version is called "latest", which is reserved for links to the default version.', 'Give the version another ID.');
    }

    for (const version of content.versions) {
      const processIdsWithFile = new Set(content.processIds(version.id));
      const englishProcessDir = paths.processDir(version.id, defaultLocale);
      if (processIdsWithFile.size === 0) {
        report(
          englishProcessDir,
          `Version ${version.id} has no English process files.`,
          `Add them to ${display(englishProcessDir)}, or remove the version from ${display(versionsFile)}.`,
        );
      }

      const placedProcessIds = version.topology.flatMap((group) => group.columns.flat());
      for (const processId of new Set(placedProcessIds)) {
        if (!processIdsWithFile.has(processId)) {
          report(
            versionsFile,
            `The topology of ${version.id} lists ${processId}, which has no process file.`,
            `Remove ${processId} from the topology, or add ${display(paths.process(version.id, defaultLocale, processId))}.`,
          );
        }

        const timesPlaced = placedProcessIds.filter((placedId) => placedId === processId).length;
        if (timesPlaced > 1) {
          report(versionsFile, `The topology of ${version.id} lists ${processId} ${timesPlaced} times.`, 'Keep it in one column only.');
        }
      }

      for (const processId of processIdsWithFile) {
        if (!placedProcessIds.includes(processId)) {
          report(versionsFile, `The topology of ${version.id} does not list ${processId}, so the process map does not show it.`, `Add ${processId} to one of the columns.`);
        }
      }
    }
  },
};
