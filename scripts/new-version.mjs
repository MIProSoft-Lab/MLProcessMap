#!/usr/bin/env node
// Create a new PRM version as a copy of an existing one.
//
//   npm run new-version -- v3            copy the default version to v3
//   npm run new-version -- v3 --from v1  copy v1 to v3
//
// The new version is added to content/versions.yaml as a draft, so it is
// published but not the default until its status and the default change.
import { cpSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const fromIndex = args.indexOf('--from');
const versionsPath = 'content/versions.yaml';
const doc = parseDocument(readFileSync(versionsPath, 'utf8'));
const from = fromIndex >= 0 ? args[fromIndex + 1] : doc.get('default');

if (!id || !/^[a-z0-9.-]+$/.test(id)) {
  console.error('Usage: npm run new-version -- <id> [--from <version>]');
  process.exit(1);
}
if (existsSync(`content/prm/${id}`)) {
  console.error(`content/prm/${id} already exists`);
  process.exit(1);
}
if (!existsSync(`content/prm/${from}`)) {
  console.error(`content/prm/${from} does not exist`);
  process.exit(1);
}

cpSync(`content/prm/${from}`, `content/prm/${id}`, { recursive: true });

// The workshop annotations belong to the version they produced, not the copy.
for (const locale of readdirSync(`content/prm/${id}/processes`)) {
  const dir = join(`content/prm/${id}/processes`, locale);
  for (const file of readdirSync(dir)) {
    const path = join(dir, file);
    const p = parseDocument(readFileSync(path, 'utf8'));
    if (p.has('changes')) {
      p.delete('changes');
      writeFileSync(path, p.toString({ lineWidth: 100 }));
    }
  }
}

// toJS resolves the YAML aliases of the topology.
const source = doc.toJS().versions.find((v) => v.id === from);
const copy = doc.createNode({
  id,
  status: 'draft',
  title: { en: `Version ${id}` },
  description: { en: `Draft based on ${from}.` },
  topology: source.topology,
});
doc.get('versions').add(copy);
writeFileSync(versionsPath, doc.toString({ lineWidth: 100 }));
console.log(`Created content/prm/${id} from ${from} and added ${id} to ${versionsPath} as a draft.`);
