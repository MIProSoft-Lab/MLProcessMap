// Process details for the tailoring page, which loads them when a reader
// opens a process. Text fields are HTML with the inline emphasis rendered.
import type { APIRoute } from 'astro';
import { getProcesses, getWorkProducts } from '../../../lib/content';
import { versionPaths } from '../../../lib/paths';
import { prose } from '../../../lib/acronyms';
import type { Locale } from '../../../i18n/ui';

export const getStaticPaths = versionPaths;

export const GET: APIRoute = ({ params, props }) => {
  const version = params.version!;
  const locale = props.locale as Locale;
  const wps = new Map(getWorkProducts(version, locale).map((w) => [w.id, w]));
  const processes = getProcesses(version, locale).map(({ data: p }) => ({
    id: p.id,
    name: p.name,
    origin: p.origin,
    purpose: prose(p.purpose, locale),
    outcomes: p.outcomes.map((o) => ({ id: o.id, text: prose(o.text, locale) })),
    inputs: p.inputs.map((io) => ({
      id: io.workProduct,
      name: io.name,
      serves: io.serves,
      producers: wps.get(io.workProduct)?.producers.map((l) => l.process) ?? [],
    })),
    outputs: p.outputs.map((io) => ({
      id: io.workProduct,
      name: io.name,
      serves: io.serves,
      consumers: wps.get(io.workProduct)?.consumers.map((l) => l.process).filter((c) => c !== p.id) ?? [],
    })),
    activities: p.activities.map((a) => ({ id: a.id, title: prose(a.title, locale), description: prose(a.description, locale) })),
  }));
  return new Response(JSON.stringify(processes), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
