// What the lifecycle builder (src/pages/[lang]/tailor.astro) embeds in the
// page for its script: every PRM version with its processes and work
// products, and the lifecycle templates, in one language. Runs on the server.
import { versions, defaultVersion, getProcesses, getWorkProducts, lifecycleIds, getLifecycle, pick } from '../content';
import { href, type Locale } from '../../i18n/ui';
import { plain } from '../text';
import type { Data } from './model';

export function builderData(locale: Locale): Data {
  return {
    defaultVersion,
    base: href(locale),
    versions: versions.map((v) => ({
      id: v.id,
      title: pick(v.title, locale),
      processes: getProcesses(v.id, locale).map(({ data: p }) => ({
        id: p.id,
        name: p.name,
        origin: p.origin,
        purpose: plain(p.purpose),
        activities: p.activities.map((a) => ({ id: a.id, title: plain(a.title) })),
        inputs: p.inputs.map((i) => i.workProduct),
      })),
      workProducts: Object.fromEntries(
        getWorkProducts(v.id, locale).map((w) => [
          w.id,
          { name: w.name, external: w.external, producers: w.producers.map((p) => p.process) },
        ]),
      ),
    })),
    lifecycles: lifecycleIds().map((id) => {
      const l = getLifecycle(id, locale).data;
      return {
        id,
        name: l.name,
        version: l.prmVersion,
        description: plain(l.description),
        processes: l.phases.flatMap((p) => p.processes),
        phases: l.phases.map((ph) => ({ ...ph, description: ph.description ? plain(ph.description) : '' })),
      };
    }),
  };
}
