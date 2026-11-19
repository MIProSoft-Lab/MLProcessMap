// The work products of a version, gathered from the inputs and outputs of its
// processes, with the type and scope set in work-products.yaml.
import type { Locale } from '../../i18n/locales';
import type { Process, WorkProductMeta, WorkProductType } from './schemas';

export interface WorkProductLink {
  process: string;
  serves: string[];
  description: string;
  optional?: boolean;
}

export interface WorkProduct {
  id: string;
  name: string;
  type: WorkProductType;
  external: boolean;
  producers: WorkProductLink[];
  consumers: WorkProductLink[];
}

/**
 * The processes linked to a process through one of its inputs or outputs: for
 * an input, those that produce it; for an output, the others that use it.
 */
export function ioLinks(wp: WorkProduct | undefined, kind: 'inputs' | 'outputs', processId: string): WorkProductLink[] {
  if (!wp) return [];
  return kind === 'inputs' ? wp.producers : wp.consumers.filter((c) => c.process !== processId);
}

export function deriveWorkProducts(processes: Process[], meta: WorkProductMeta[], locale: Locale): WorkProduct[] {
  const metaById = new Map(meta.map((w) => [w.id, w]));
  const byId = new Map<string, WorkProduct>();
  const entry = (id: string, name: string) => {
    let wp = byId.get(id);
    if (!wp) {
      const m = metaById.get(id);
      wp = { id, name, type: m?.type ?? 'information-item', external: m?.external ?? false, producers: [], consumers: [] };
      byId.set(id, wp);
    }
    return wp;
  };
  for (const p of processes) {
    for (const io of p.outputs) {
      entry(io.workProduct, io.name).producers.push({ process: p.id, serves: io.serves, description: io.description, optional: io.optional });
    }
    for (const io of p.inputs) {
      entry(io.workProduct, io.name).consumers.push({ process: p.id, serves: io.serves, description: io.description, optional: io.optional });
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, locale));
}
