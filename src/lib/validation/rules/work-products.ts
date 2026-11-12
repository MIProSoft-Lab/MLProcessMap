import { defaultLocale } from '../../../i18n/locales';
import { display, paths } from '../../content/files';
import type { Rule } from '../rule';

/** "P01", "P01 and P02", or "P01, P02 and P03". */
const listInProse = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

export const workProductFlow: Rule = {
  id: 'work-product-flow',
  description:
    'Every input of a version is an output of one of its processes or comes from outside (external), an external work product is not produced inside, and a work product has one name.',
  severity: 'error',
  check({ content, report }) {
    for (const version of content.versions) {
      const workProductsFile = paths.workProducts(version.id);
      const usedWorkProductIds = new Set<string>();

      for (const workProduct of content.getWorkProducts(version.id, defaultLocale)) {
        usedWorkProductIds.add(workProduct.id);
        const producerIds = workProduct.producers.map((producer) => producer.process);

        if (producerIds.length === 0 && !workProduct.external) {
          for (const consumer of workProduct.consumers) {
            report(
              paths.process(version.id, defaultLocale, consumer.process),
              `The input "${workProduct.name}" is not an output of any process of ${version.id}.`,
              `Add it to the outputs of the process that produces it, or, if it comes from outside the project, mark ${workProduct.id} as external in ${display(workProductsFile)}.`,
            );
          }
        }

        if (producerIds.length > 0 && workProduct.external) {
          report(
            workProductsFile,
            `"${workProduct.id}" is marked external, but ${listInProse(producerIds)} ${producerIds.length === 1 ? 'produces' : 'produce'} it.`,
            'Remove external: true, or remove it from the outputs of those processes.',
          );
        }
      }

      const firstNaming = new Map<string, { name: string; processId: string }>();
      for (const processId of content.processIds(version.id)) {
        const process = content.getProcess(version.id, processId, defaultLocale).data;
        for (const entry of [...process.inputs, ...process.outputs]) {
          const first = firstNaming.get(entry.workProduct);
          if (!first) {
            firstNaming.set(entry.workProduct, { name: entry.name, processId });
          } else if (first.name !== entry.name) {
            report(
              paths.process(version.id, defaultLocale, processId),
              `The work product "${entry.workProduct}" is called "${entry.name}" here, but "${first.name}" in ${first.processId}.`,
              'Use the same name in every process: the site shows a work product under one name.',
            );
          }
        }
      }

      for (const { id: workProductId } of content.workProductMeta(version.id)) {
        if (!usedWorkProductIds.has(workProductId)) {
          report(workProductsFile, `"${workProductId}" is not an input or output of any process of ${version.id}.`, 'Remove it, or use it in a process.');
        }
      }
    }
  },
};

export const workProductDeadEnds: Rule = {
  id: 'work-product-dead-ends',
  description:
    'Every work product a process produces is used by another process, except records, which are kept as evidence of what was done.',
  severity: 'warning',
  check({ content, report }) {
    for (const version of content.versions) {
      for (const workProduct of content.getWorkProducts(version.id, defaultLocale)) {
        const isDeadEnd = workProduct.type !== 'record' && !workProduct.external && workProduct.consumers.length === 0;
        if (!isDeadEnd) continue;

        for (const producer of workProduct.producers) {
          report(
            paths.process(version.id, defaultLocale, producer.process),
            `The output "${workProduct.name}" is not an input of any process.`,
            `Add it as an input of the process that uses it, or make ${workProduct.id} a record in ${display(paths.workProducts(version.id))} if it is kept as evidence.`,
          );
        }
      }
    }
  },
};
