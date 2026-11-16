// The admin panel's field lists (src/pages/admin/config.yml.ts) are written by
// hand next to the schemas (schemas.ts). A field in only one of them is either
// one the panel cannot edit or one the site rejects, so they are compared here.
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { z } from 'astro/zod';
import { GET } from '../../pages/admin/config.yml';
import { acronymsSchema, lifecycleSchema, processSchema, referencesSchema, siteSchema, studiesSchema, versionsSchema, workProductsSchema } from './schemas';

/** The field names of a file, nested. A value without fields of its own is null. */
type Fields = { keys: Record<string, Fields | null>; open: boolean };

/** The fields a schema accepts. Lists count as their items; `open` is a text per language, which takes any language. */
function ofSchema(schema: z.ZodType): Fields | null {
  const def = schema.def as any;
  switch (def.type) {
    case 'optional':
    case 'nullable':
    case 'default':
      return ofSchema(def.innerType);
    case 'pipe':
      return ofSchema(def.in);
    case 'array':
      return ofSchema(def.element);
    case 'union':
      // Either a plain value or an object, e.g. a supervisor: the panel edits the object.
      return def.options.map(ofSchema).find((x: Fields | null) => x) ?? null;
    case 'object':
      return { keys: Object.fromEntries(Object.entries(def.shape).map(([k, v]) => [k, ofSchema(v as z.ZodType)])), open: !!def.catchall };
    default:
      return null;
  }
}

interface Field {
  name: string;
  fields?: Field[];
  field?: Field;
}

/** The fields the admin panel edits. */
function ofPanel(fields: Field[]): Fields {
  const node = (f: Field): Fields | null => (f.fields ? ofPanel(f.fields) : f.field ? node(f.field) : null);
  return { keys: Object.fromEntries(fields.map((f) => [f.name, node(f)])), open: false };
}

/** What differs between the two, as sentences. */
function differences(schema: Fields | null, panel: Fields | null, path: string): string[] {
  if (!schema || !panel) return schema || panel ? [`${path} has fields of its own only in the ${schema ? 'schema' : 'admin panel'}`] : [];
  const out: string[] = [];
  for (const k of Object.keys(schema.keys)) if (!(k in panel.keys)) out.push(`${path}.${k} is in the schema but not in the admin panel`);
  for (const k of Object.keys(panel.keys)) {
    if (k in schema.keys) out.push(...differences(schema.keys[k], panel.keys[k], `${path}.${k}`));
    else if (!schema.open) out.push(`${path}.${k} is in the admin panel but not in the schema`);
  }
  return out;
}

const config = parse(await (GET as () => Response)().text());
const collection = (name: string) => config.collections.find((c: { name: string }) => c.name === name);
const settings = (name: string) => collection('settings').files.find((f: { name: string }) => f.name === name);
const compare = (schema: z.ZodType, fields: Field[], name: string) => differences(ofSchema(schema), ofPanel(fields), name);

describe('the admin panel', () => {
  it('edits the fields of a process', () => {
    const processes = config.collections.filter((c: { name: string }) => c.name.startsWith('processes-'));
    expect(processes.length).toBeGreaterThan(0);
    for (const c of processes) expect(compare(processSchema, c.fields, c.name)).toEqual([]);
  });

  it('edits the fields of a lifecycle model', () => {
    expect(compare(lifecycleSchema, collection('lifecycles').fields, 'lifecycles')).toEqual([]);
  });

  it.each([
    ['site', siteSchema],
    ['versions', versionsSchema],
    ['studies', studiesSchema],
    ['references', referencesSchema],
    ['acronyms', acronymsSchema],
  ] as const)('edits the fields of %s', (name, schema) => {
    expect(compare(schema, settings(name).fields, name)).toEqual([]);
  });

  it('edits the fields of the work product types', () => {
    const files = collection('settings').files.filter((f: { name: string }) => f.name.startsWith('work-products-'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(compare(workProductsSchema, f.fields, f.name)).toEqual([]);
  });

  it('is compared field by field', () => {
    const schema = ofSchema(lifecycleSchema)!;
    const panel = ofPanel(collection('lifecycles').fields);
    delete panel.keys.source;
    (panel.keys.phases as Fields).keys.colour = null;
    expect(differences(schema, panel, 'lifecycles')).toEqual(['lifecycles.source is in the schema but not in the admin panel', 'lifecycles.phases.colour is in the admin panel but not in the schema']);
  });
});
