import { defaultLocale } from '../../../i18n/locales';
import type { Rule } from '../rule';
import { lifecycleFiles } from '../walk';

export const lifecycles: Rule = {
  id: 'lifecycles',
  description: 'A lifecycle uses a PRM version that exists, its phases list processes of that version, and phases return to phases that exist.',
  severity: 'error',
  check({ content, report }) {
    const versionIds = content.versions.map((version) => version.id);
    for (const { file, lifecycle } of lifecycleFiles(content)) {
      const version = lifecycle.prmVersion;
      if (!versionIds.includes(version)) {
        report(file, `The lifecycle uses PRM version ${version}, which does not exist.`, `Set prmVersion to one of: ${versionIds.join(', ')}.`);
        continue;
      }

      const processIdsOfVersion = new Set(content.processIds(version));
      const phaseIds = lifecycle.phases.map((phase) => phase.id);

      for (const phase of lifecycle.phases) {
        for (const processId of phase.processes) {
          if (!processIdsOfVersion.has(processId)) {
            report(file, `Phase "${phase.id}" lists ${processId}, which is not a process of ${version}.`, `Remove it, or correct the process ID.`);
          }
        }

        if (phase.returnsTo && !phaseIds.includes(phase.returnsTo)) {
          report(
            file,
            `Phase "${phase.id}" returns to "${phase.returnsTo}", which is not a phase of this lifecycle.`,
            `Use one of: ${phaseIds.join(', ')}.`,
          );
        }
      }
    }
  },
};

/** Phase indexes: from the phase returned to (start) to the one that returns (end). */
interface Loop {
  start: number;
  end: number;
}

// An input produced in a later phase is fine when that phase loops back here:
// it exists from the second pass on. Translations repeat the phases, so only
// English is checked.
export const lifecycleDataflow: Rule = {
  id: 'lifecycle-dataflow',
  description:
    'In a lifecycle, every required input of a process is external or produced in the same phase, an earlier one, or a later one that returns to it.',
  severity: 'warning',
  check({ content, report }) {
    for (const { file, locale, lifecycle } of lifecycleFiles(content)) {
      const version = lifecycle.prmVersion;
      // An unknown version is reported by the lifecycles rule.
      if (locale !== defaultLocale || !content.versions.some((v) => v.id === version)) continue;

      const processIdsOfVersion = new Set(content.processIds(version));
      const phaseIndexOfProcess = new Map<string, number>();
      lifecycle.phases.forEach((phase, phaseIndex) => phase.processes.forEach((processId) => phaseIndexOfProcess.set(processId, phaseIndex)));
      const workProductsById = new Map(content.getWorkProducts(version, defaultLocale).map((workProduct) => [workProduct.id, workProduct]));

      // A phase that returns to an earlier one repeats every phase in between.
      const loops: Loop[] = lifecycle.phases.flatMap((phase, end) => {
        const start = lifecycle.phases.findIndex((candidate) => candidate.id === phase.returnsTo);
        return start >= 0 && start <= end ? [{ start, end }] : [];
      });
      const isInsideLoopReaching = (phaseIndex: number, producerPhaseIndex: number) =>
        loops.some((loop) => loop.start <= phaseIndex && loop.end >= producerPhaseIndex);

      lifecycle.phases.forEach((phase, phaseIndex) => {
        for (const processId of phase.processes) {
          // An unknown process is reported by the lifecycles rule.
          if (!processIdsOfVersion.has(processId)) continue;

          for (const input of content.getProcess(version, processId, defaultLocale).data.inputs) {
            const workProduct = workProductsById.get(input.workProduct)!;
            // An input that no process produces is reported by work-product-flow.
            if (input.optional || workProduct.external || workProduct.producers.length === 0) continue;

            const producerIds = workProduct.producers.map((producer) => producer.process);
            const producerPhaseIndexes = producerIds.flatMap((producerId) =>
              phaseIndexOfProcess.has(producerId) ? [phaseIndexOfProcess.get(producerId)!] : [],
            );
            if (producerPhaseIndexes.length === 0) {
              report(
                file,
                `In phase "${phase.id}", ${processId} needs "${workProduct.name}", but no process of the lifecycle produces it.`,
                `Add one of its producers in ${version} (${producerIds.join(', ')}) to this or an earlier phase, or mark the input optional.`,
              );
              continue;
            }

            const firstProducerPhaseIndex = Math.min(...producerPhaseIndexes);
            if (firstProducerPhaseIndex <= phaseIndex || isInsideLoopReaching(phaseIndex, firstProducerPhaseIndex)) continue;
            report(
              file,
              `In phase "${phase.id}", ${processId} needs "${workProduct.name}", which is first produced later, in phase "${lifecycle.phases[firstProducerPhaseIndex].id}".`,
              'Move its producer to this or an earlier phase, or make the later phase return to this one.',
            );
          }
        }
      });
    }
  },
};
