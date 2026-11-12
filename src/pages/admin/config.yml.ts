// Sveltia CMS configuration, generated so that every PRM version in
// content/versions.yaml gets its own collections in the admin panel.
import type { APIRoute } from 'astro';
import { parse, stringify } from 'yaml';
import { versions, site, pick } from '../../lib/content';
import { edition } from '../../lib/edition';
import { locales, defaultLocale } from '../../i18n/ui';

const dup = { i18n: 'duplicate' as const };
const tr = { i18n: true };

const localizedText = (name: string, label: string, widget = 'string') => ({
  name,
  label,
  widget: 'object',
  fields: locales.map((l) => ({ name: l, label: l.toUpperCase(), widget, required: l === defaultLocale })),
});

const ioFields = [
  { name: 'workProduct', label: 'Work product ID', widget: 'string', hint: 'Same ID in every process that uses this work product, e.g. raw-dataset.', ...dup },
  { name: 'name', label: 'Name', widget: 'string', ...tr },
  { name: 'description', label: 'Description', widget: 'text', required: false, ...tr },
  { name: 'serves', label: 'Supports outcomes', widget: 'list', hint: 'Outcome letters, e.g. a, b', required: false, ...dup },
  { name: 'optional', label: 'Optional', widget: 'boolean', required: false, default: false, ...dup },
];

const processFields = [
  { name: 'id', label: 'ID', widget: 'string', pattern: ['^P\\d{2}$', 'P followed by two digits, e.g. P26'], ...dup },
  { name: 'number', label: 'Number', widget: 'number', value_type: 'int', ...dup },
  {
    name: 'origin',
    label: 'Origin',
    widget: 'select',
    options: [
      { label: 'Standards and literature', value: 'standards-and-literature' },
      { label: 'Standards only', value: 'standards-only' },
      { label: 'Decomposed', value: 'decomposed' },
    ],
    ...dup,
  },
  { name: 'name', label: 'Name', widget: 'string', ...tr },
  { name: 'purpose', label: 'Purpose', widget: 'text', hint: 'Use *text* for emphasis.', ...tr },
  {
    name: 'outcomes',
    label: 'Outcomes',
    widget: 'list',
    summary: '({{fields.id}}) {{fields.text}}',
    ...tr,
    fields: [
      { name: 'id', label: 'Letter', widget: 'string', ...dup },
      { name: 'text', label: 'Text', widget: 'text', ...tr },
    ],
  },
  { name: 'inputs', label: 'Inputs', widget: 'list', summary: '{{fields.name}}', required: false, ...tr, fields: ioFields },
  { name: 'outputs', label: 'Outputs', widget: 'list', summary: '{{fields.name}}', required: false, ...tr, fields: ioFields },
  {
    name: 'activities',
    label: 'Activities',
    widget: 'list',
    summary: '{{fields.id}}. {{fields.title}}',
    ...tr,
    fields: [
      { name: 'id', label: 'ID', widget: 'string', hint: 'A1, A2, …', ...dup },
      { name: 'title', label: 'Title', widget: 'string', ...tr },
      { name: 'description', label: 'Description', widget: 'text', ...tr },
      { name: 'primaryStudies', label: 'Primary studies', widget: 'list', hint: 'P1 … P18', required: false, ...dup },
      { name: 'literature', label: 'Specialized literature', widget: 'list', hint: 'Bibliography keys from References', required: false, ...dup },
    ],
  },
  {
    name: 'standards',
    label: 'Traceability to the standards',
    widget: 'list',
    required: false,
    summary: '{{fields.standard}} {{fields.activity}} → {{fields.prmActivity}}',
    ...dup,
    fields: [
      { name: 'standard', label: 'Standard', widget: 'string' },
      { name: 'standardProcess', label: 'Standard process', widget: 'string', required: false },
      { name: 'activity', label: 'Standard activity', widget: 'string', required: false },
      { name: 'prmActivity', label: 'PRM activity', widget: 'string', required: false },
      { name: 'note', label: 'Note', widget: 'string', required: false },
    ],
  },
  {
    name: 'changes',
    label: 'Changes from the previous version',
    widget: 'list',
    required: false,
    summary: '{{fields.annotation}} ({{fields.decision}}) {{fields.text}}',
    ...tr,
    fields: [
      { name: 'annotation', label: 'Annotation ID', widget: 'string', ...dup },
      { name: 'raisedElsewhere', label: 'Raised in another process', widget: 'boolean', required: false, ...dup },
      { name: 'text', label: 'Annotation', widget: 'text', ...tr },
      { name: 'redVotes', label: 'Red votes', widget: 'number', value_type: 'int', required: false, ...dup },
      { name: 'yellowVotes', label: 'Yellow votes', widget: 'number', value_type: 'int', required: false, ...dup },
      { name: 'decision', label: 'Decision', widget: 'select', options: ['adopted', 'partial', 'rejected', 'deferred', '–'], ...dup },
      {
        name: 'changes',
        label: 'Changes made',
        widget: 'list',
        required: false,
        ...tr,
        fields: [
          { name: 'kind', label: 'Kind', widget: 'select', options: ['added', 'updated', 'removed'], ...dup },
          { name: 'target', label: 'Target', widget: 'string', required: false, hint: 'A5, Output, Outcome (c)…', ...dup },
          { name: 'text', label: 'Text', widget: 'text', ...tr },
        ],
      },
    ],
  },
];

// Interface text: one group per section of content/ui/en.yaml, so a string
// added there shows up here without changing this file.
const uiFile = import.meta.glob<string>('/content/ui/en.yaml', { query: '?raw', import: 'default', eager: true })['/content/ui/en.yaml'];
const sectionLabels: Record<string, string> = {
  nav: 'Navigation and header',
  home: 'Home page',
  origin: 'Process origins',
  map: 'Process map',
  process: 'Process page',
  decision: 'Workshop decisions',
  change: 'Workshop changes',
  wp: 'Work products',
  compare: 'Compare versions',
  lc: 'Lifecycle models',
  tailor: 'Lifecycle builder',
  modal: 'Process details window',
  tip: 'Process hover card',
  refs: 'References',
  i18n: 'Translation notice',
  footer: 'Footer',
  notFound: 'Page not found',
  edition: 'Live and thesis editions',
  language: 'Language names',
};
const uiFields = Object.entries(parse(uiFile) as Record<string, Record<string, string>>).map(([section, strings]) => ({
  name: section,
  label: sectionLabels[section] ?? section,
  widget: 'object',
  collapsed: true,
  ...tr,
  fields: Object.entries(strings).map(([key, text]) => ({
    name: key,
    label: key,
    widget: text.length > 70 ? 'text' : 'string',
    required: false,
    ...tr,
  })),
}));

const lifecycleFields = [
  { name: 'id', label: 'ID', widget: 'string', hint: 'Lowercase with hyphens; also the file name.', ...dup },
  { name: 'name', label: 'Name', widget: 'string', ...tr },
  { name: 'status', label: 'Status', widget: 'select', options: ['draft', 'published'], default: 'draft', ...dup },
  { name: 'prmVersion', label: 'PRM version', widget: 'select', options: versions.map((v) => v.id), ...dup },
  { name: 'source', label: 'Source', widget: 'string', required: false, hint: 'e.g. CRISP-DM (P14)', ...tr },
  { name: 'description', label: 'Description', widget: 'text', required: false, ...tr },
  {
    name: 'phases',
    label: 'Phases',
    widget: 'list',
    summary: '{{fields.name}}',
    ...tr,
    fields: [
      { name: 'id', label: 'ID', widget: 'string', ...dup },
      { name: 'name', label: 'Name', widget: 'string', ...tr },
      { name: 'description', label: 'Description', widget: 'text', required: false, ...tr },
      { name: 'processes', label: 'Processes', widget: 'list', hint: 'Process IDs in order, e.g. P08, P09', ...dup },
      { name: 'iterative', label: 'Repeated', widget: 'boolean', required: false, default: false, ...dup },
      { name: 'returnsTo', label: 'Returns to phase (ID)', widget: 'string', required: false, ...dup },
      { name: 'returnNote', label: 'When it returns', widget: 'string', required: false, ...tr },
    ],
  },
];

export const GET: APIRoute = () => {
  // Sveltia needs an absolute URL. Without one, as when running locally, it
  // uses the address it is served from.
  const siteUrl = import.meta.env.SITE && new URL(import.meta.env.BASE_URL.replace(/\/?$/, '/'), import.meta.env.SITE).href;
  const repo = import.meta.env.PUBLIC_REPO ?? 'OWNER/REPO';
  const config = {
    backend: {
      name: 'github',
      repo,
      branch: import.meta.env.PUBLIC_REPO_BRANCH ?? 'main',
      ...(import.meta.env.PUBLIC_CMS_AUTH_URL ? { base_url: import.meta.env.PUBLIC_CMS_AUTH_URL } : {}),
      commit_messages: {
        create: 'Create {{collection}} “{{slug}}”',
        update: 'Update {{collection}} “{{slug}}”',
        delete: 'Delete {{collection}} “{{slug}}”',
      },
    },
    // The published site, which the app icon in the header links to: the
    // domain plus the project path of a GitHub Pages site, e.g. /<repo>/.
    ...(siteUrl ? { site_url: siteUrl, display_url: siteUrl } : {}),
    // The sign-in page and the header show the site's name and icon.
    app_title: `${pick(site.title, defaultLocale)}${edition === 'thesis' ? ' · thesis edition' : ''}`,
    logo: { src: `${import.meta.env.BASE_URL.replace(/\/$/, '')}/favicon.svg` },
    media_folder: 'public/uploads',
    public_folder: '/uploads',
    i18n: { structure: 'multiple_folders', locales: [...locales], default_locale: defaultLocale },
    collections: [
      ...[...versions].reverse().map((v) => ({
        name: `processes-${v.id}`,
        label: `Processes ${v.id}`,
        label_singular: `Process ${v.id}`,
        folder: `content/prm/${v.id}/processes`,
        extension: 'yaml',
        format: 'yaml',
        identifier_field: 'id',
        slug: '{{id}}',
        summary: '{{id}} {{name}}',
        sortable_fields: { fields: ['number', 'name'], default: { field: 'number' } },
        create: true,
        delete: false,
        i18n: true,
        fields: processFields,
      })),
      {
        name: 'lifecycles',
        label: 'Lifecycle templates',
        label_singular: 'Lifecycle template',
        folder: 'content/lifecycles',
        extension: 'yaml',
        format: 'yaml',
        identifier_field: 'id',
        slug: '{{id}}',
        summary: '{{name}} ({{prmVersion}})',
        create: true,
        i18n: true,
        fields: lifecycleFields,
      },
      {
        name: 'interface',
        label: 'Interface text',
        description: 'Menus, buttons and page texts of the site. Words in braces, such as {n}, are filled in by the site: keep them as they are. A text left empty is shown in English.',
        format: 'yaml',
        i18n: true,
        files: [{ name: 'strings', label: 'Interface text', file: 'content/ui/{{locale}}.yaml', i18n: true, fields: uiFields }],
      },
      {
        name: 'settings',
        label: 'Settings and references',
        format: 'yaml',
        i18n: false,
        files: [
          {
            name: 'site',
            label: 'Site',
            file: 'content/site.yaml',
            fields: [
              localizedText('title', 'Title'),
              { name: 'author', label: 'Author', widget: 'string' },
              { name: 'orcid', label: 'Author ORCID iD', widget: 'string', required: false, hint: 'As 0000-0000-0000-0000.' },
              { name: 'email', label: 'Author email', widget: 'string', required: false, hint: 'Shown in the footer.' },
              { name: 'institution', label: 'Institution', widget: 'string', required: false },
              localizedText('institutionUrl', 'Institution website'),
              localizedText('intro', 'Introduction', 'text'),
              {
                name: 'thesis',
                label: 'Doctoral thesis',
                widget: 'object',
                required: false,
                hint: 'Shown on the home page, with the citation built from the author, title, institution and year.',
                fields: [
                  { name: 'title', label: 'Title', widget: 'string' },
                  { name: 'year', label: 'Year', widget: 'string' },
                  {
                    name: 'supervisors',
                    label: 'Supervisors',
                    widget: 'list',
                    required: false,
                    summary: '{{fields.name}}',
                    fields: [
                      { name: 'name', label: 'Name', widget: 'string' },
                      { name: 'orcid', label: 'ORCID iD', widget: 'string', required: false, hint: 'As 0000-0000-0000-0000.' },
                    ],
                  },
                ],
              },
              {
                name: 'group',
                label: 'Research group',
                widget: 'object',
                required: false,
                fields: [
                  { name: 'name', label: 'Short name', widget: 'string' },
                  localizedText('fullName', 'Full name'),
                  localizedText('description', 'Description', 'text'),
                  localizedText('url', 'Website'),
                  {
                    name: 'researchLines',
                    label: 'Research lines',
                    widget: 'list',
                    required: false,
                    summary: '{{fields.en}}',
                    fields: locales.map((l) => ({ name: l, label: l.toUpperCase(), widget: 'string', required: l === defaultLocale })),
                  },
                ],
              },
              {
                name: 'people',
                label: 'People',
                widget: 'list',
                required: false,
                hint: 'The people involved in the project, in the order they are shown on the home page.',
                summary: '{{fields.name}}',
                fields: [
                  { name: 'name', label: 'Name', widget: 'string' },
                  localizedText('role', 'Role'),
                  { name: 'url', label: 'Link', widget: 'string', required: false },
                ],
              },
              {
                name: 'timeline',
                label: 'How the PRM was built',
                widget: 'list',
                required: false,
                hint: 'The stages of the research, in order.',
                summary: '{{fields.title.en}}',
                fields: [localizedText('title', 'Title'), localizedText('text', 'Text', 'text')],
              },
            ],
          },
          {
            name: 'versions',
            label: 'PRM versions',
            file: 'content/versions.yaml',
            fields: [
              { name: 'default', label: 'Default version', widget: 'select', options: versions.map((v) => v.id) },
              {
                name: 'versions',
                label: 'Versions',
                widget: 'list',
                summary: '{{fields.id}} ({{fields.status}})',
                allow_add: false,
                hint: 'Create a new version with `npm run new-version`, which copies the process files.',
                fields: [
                  { name: 'id', label: 'ID', widget: 'string' },
                  { name: 'status', label: 'Status', widget: 'select', options: ['draft', 'current', 'superseded'] },
                  localizedText('title', 'Title'),
                  localizedText('description', 'Description', 'text'),
                  {
                    name: 'topology',
                    label: 'Process map',
                    widget: 'list',
                    fields: [
                      localizedText('group', 'Group'),
                      { name: 'columns', label: 'Columns', widget: 'list', field: { name: 'column', label: 'Column', widget: 'list', hint: 'Process IDs' } },
                    ],
                  },
                ],
              },
            ],
          },
          {
            name: 'studies',
            label: 'Primary studies',
            file: 'content/studies.yaml',
            fields: [
              {
                name: 'studies',
                label: 'Studies',
                widget: 'list',
                summary: '{{fields.id}} {{fields.title}}',
                fields: [
                  { name: 'id', label: 'ID', widget: 'string' },
                  { name: 'title', label: 'Title', widget: 'string' },
                  { name: 'year', label: 'Year', widget: 'number', value_type: 'int' },
                  { name: 'source', label: 'Found in', widget: 'string' },
                  { name: 'type', label: 'Type', widget: 'select', options: ['journal', 'conference', 'online', 'other'] },
                  { name: 'reference', label: 'Bibliography key', widget: 'string', required: false },
                ],
              },
            ],
          },
          {
            name: 'references',
            label: 'Bibliography',
            file: 'content/references.yaml',
            fields: [
              {
                name: 'references',
                label: 'References',
                widget: 'list',
                summary: '{{fields.key}}: {{fields.title}}',
                fields: [
                  { name: 'key', label: 'Key', widget: 'string' },
                  { name: 'authors', label: 'Authors', widget: 'string', hint: 'Surname, Name and Surname, Name' },
                  { name: 'title', label: 'Title', widget: 'string' },
                  { name: 'year', label: 'Year', widget: 'string' },
                  { name: 'venue', label: 'Venue', widget: 'string', required: false },
                  { name: 'publisher', label: 'Publisher', widget: 'string', required: false },
                  { name: 'doi', label: 'DOI', widget: 'string', required: false },
                  { name: 'url', label: 'URL', widget: 'string', required: false },
                ],
              },
            ],
          },
          {
            name: 'acronyms',
            label: 'Acronyms',
            file: 'content/acronyms.yaml',
            fields: [
              {
                name: 'acronyms',
                label: 'Acronyms',
                widget: 'list',
                summary: '{{fields.id}}: {{fields.expansion.en}}',
                hint: 'Text that uses an acronym shows its expansion on hover, and "Expansion (ACR)" is shortened to the acronym.',
                fields: [{ name: 'id', label: 'Acronym', widget: 'string' }, localizedText('expansion', 'Expansion')],
              },
            ],
          },
          ...versions.map((v) => ({
            name: `work-products-${v.id}`,
            label: `Work product types ${v.id}`,
            file: `content/prm/${v.id}/work-products.yaml`,
            fields: [
              {
                name: 'workProducts',
                label: 'Work products',
                widget: 'list',
                summary: '{{fields.id}} ({{fields.type}})',
                fields: [
                  { name: 'id', label: 'ID', widget: 'string' },
                  { name: 'type', label: 'Type', widget: 'select', options: ['information-item', 'artifact', 'record'] },
                  { name: 'external', label: 'Comes from outside the PRM', widget: 'boolean', required: false, default: false },
                ],
              },
            ],
          })),
        ],
      },
    ],
  };
  return new Response(stringify(config, { aliasDuplicateObjects: false }), { headers: { 'Content-Type': 'text/yaml; charset=utf-8' } });
};
