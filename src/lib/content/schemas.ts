// The shape of every content file. The types the pages use are inferred from
// these schemas, so a field is added here and nowhere else in the code. The
// field list of the admin panel is in src/pages/admin/config.yml.ts.
import { z } from 'astro/zod';

const localized = z.object({ en: z.string() }).catchall(z.string());
const processId = z.string().regex(/^P\d{2}$/);

const ioSchema = z.object({
  workProduct: z.string(),
  name: z.string(),
  description: z.string().default(''),
  serves: z.array(z.string()).default([]),
  optional: z.boolean().optional(),
});

const activitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  primaryStudies: z.array(z.string()).optional(),
  literature: z.array(z.string()).optional(),
});

const traceSchema = z.object({
  standard: z.string(),
  standardProcess: z.string().optional(),
  activity: z.string(),
  prmActivity: z.string().optional(),
  note: z.string().optional(),
});

const changeSchema = z.object({
  annotation: z.string(),
  raisedElsewhere: z.boolean().optional(),
  text: z.string(),
  redVotes: z.number().nullable().optional(),
  yellowVotes: z.number().nullable().optional(),
  decision: z.string(),
  changes: z
    .array(z.object({ kind: z.enum(['added', 'updated', 'removed']), target: z.string().optional(), text: z.string() }))
    .default([]),
});

export const processSchema = z.object({
  id: processId,
  number: z.number(),
  origin: z.enum(['standards-and-literature', 'standards-only', 'decomposed']),
  name: z.string(),
  purpose: z.string(),
  outcomes: z.array(z.object({ id: z.string(), text: z.string() })),
  inputs: z.array(ioSchema).default([]),
  outputs: z.array(ioSchema).default([]),
  activities: z.array(activitySchema),
  standards: z.array(traceSchema).optional(),
  changes: z.array(changeSchema).optional(),
});

export const versionsSchema = z.object({
  default: z.string(),
  versions: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['draft', 'current', 'superseded']),
      title: localized,
      description: localized,
      topology: z.array(z.object({ group: localized, columns: z.array(z.array(processId)) })),
    }),
  ),
});

export const workProductsSchema = z.object({
  workProducts: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['information-item', 'artifact', 'record']),
      external: z.boolean().default(false),
    }),
  ),
});

export const lifecycleSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['draft', 'published']).default('draft'),
  prmVersion: z.string(),
  description: z.string().default(''),
  source: z.string().optional(),
  phases: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      processes: z.array(processId),
      iterative: z.boolean().optional(),
      returnsTo: z.string().optional(),
      returnNote: z.string().optional(),
    }),
  ),
});

export const studiesSchema = z.object({
  studies: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      year: z.number(),
      source: z.string(),
      type: z.string(),
      reference: z.string().nullable().optional(),
    }),
  ),
});

export const referencesSchema = z.object({
  references: z.array(
    z.object({
      key: z.string(),
      authors: z.string().default(''),
      title: z.string().default(''),
      year: z.union([z.string(), z.number()]).transform(String).default(''),
      venue: z.string().optional(),
      publisher: z.string().optional(),
      doi: z.string().optional(),
      url: z.string().optional(),
    }),
  ),
});

export const acronymsSchema = z.object({
  acronyms: z.array(
    z.object({
      id: z.string(),
      expansion: localized,
    }),
  ),
});

export const siteSchema = z.object({
  title: localized,
  author: z.string(),
  // Contact address of the author, shown in the footer.
  email: z.string().optional(),
  institution: z.string().optional(),
  intro: localized,
  // The doctoral thesis the site is part of, shown on the home page.
  thesis: z
    .object({
      title: z.string(),
      year: z.union([z.string(), z.number()]).transform(String),
      supervisors: z.array(z.string()).default([]),
    })
    .optional(),
  // The research group behind the PRM.
  group: z
    .object({
      name: z.string(),
      fullName: localized,
      description: localized,
      url: localized.optional(),
      researchLines: z.array(localized).default([]),
    })
    .optional(),
  // The people involved in the project, in the order they are shown.
  people: z
    .array(
      z.object({
        name: z.string(),
        role: localized,
        url: z.string().optional(),
      }),
    )
    .default([]),
  // The stages of the research that produced the PRM, in order.
  timeline: z
    .array(
      z.object({
        title: localized,
        text: localized,
      }),
    )
    .default([]),
});

/** Interface strings: sections of "key: text". An empty file has none. */
export const uiSchema = z
  .record(z.string(), z.record(z.string(), z.string()))
  .nullable()
  .transform((x) => x ?? {});

export type Process = z.infer<typeof processSchema>;
export type Activity = Process['activities'][number];
export type Lifecycle = z.infer<typeof lifecycleSchema>;
export type Version = z.infer<typeof versionsSchema>['versions'][number];
export type Study = z.infer<typeof studiesSchema>['studies'][number];
export type Reference = z.infer<typeof referencesSchema>['references'][number];
export type Acronym = z.infer<typeof acronymsSchema>['acronyms'][number];
export type WorkProductMeta = z.infer<typeof workProductsSchema>['workProducts'][number];
export type WorkProductType = WorkProductMeta['type'];
