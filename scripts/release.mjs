#!/usr/bin/env node
// Make a release of the live edition: check the code, bump the version, write
// the changelog from the commits since the last tag, commit, tag and push. The
// tag starts the deploy, and the workflow then publishes a GitHub release with
// the same notes.
//
//   npm run release                   next version worked out from the commits
//   npm run release -- minor          major, minor, patch or an exact version, e.g. 1.4.0
//   npm run release -- --dry-run      show the version and the notes, change nothing
//   npm run release -- --yes          push without asking
//   npm run release -- --skip-checks  do not run the checks, tests and build first
//   npm run release -- --no-edit      do not open the changelog in the editor
//
// Before committing, the new changelog entry is opened in Git's editor (set
// with `git config --global core.editor "code --wait"`, or $EDITOR) to fix
// any typos. What is saved there becomes the notes of the tag and the GitHub
// release. Closing the editor without the version heading, or answering no
// afterwards, cancels the release and puts the files back.
//
// Commit messages follow Conventional Commits (https://www.conventionalcommits.org):
// "feat: …" makes a minor release, "fix: …" a patch, and "feat!: …" or a
// "BREAKING CHANGE:" line in the body a major one.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const dryRun = flag('dry-run');
const requested = args.find((a) => !a.startsWith('--'));

const run = (cmd, cmdArgs, options = {}) => execFileSync(cmd, cmdArgs, { encoding: 'utf8', ...options });
const git = (...a) => run('git', a).trim();
const fail = (message) => {
  console.error(`release: ${message}`);
  process.exit(1);
};
// The answer, or null when there is none to read (Ctrl-D, or no terminal),
// which every question takes as no.
const ask = async (question) => {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } catch {
    console.log();
    return null;
  } finally {
    rl.close();
  }
};

// Commit types, in the order their sections appear in the changelog. Types not
// listed here go to "Other changes".
const SECTIONS = [
  ['breaking', 'Breaking changes'],
  ['feat', 'Features'],
  ['fix', 'Fixes'],
  ['content', 'Content'],
  ['perf', 'Performance'],
  ['revert', 'Reverts'],
  ['docs', 'Documentation'],
  ['maintenance', 'Maintenance'],
  ['other', 'Other changes'],
];
const ALIASES = {
  test: 'maintenance',
  tests: 'maintenance',
  refactor: 'maintenance',
  style: 'maintenance',
  build: 'maintenance',
  ci: 'maintenance',
  chore: 'maintenance',
};

// 1. The repository is ready: on main, nothing uncommitted, up to date.
const branch = git('branch', '--show-current');
if (branch !== 'main') fail(`releases are made from main, not ${branch || 'a detached HEAD'}`);
if (git('status', '--porcelain')) fail('there are uncommitted changes; commit or stash them first');
git('fetch', '--quiet', '--tags', 'origin', 'main');
if (git('rev-list', '--count', 'HEAD..origin/main') !== '0') fail('main is behind origin/main; run git pull first');

// 2. The commits since the last release.
let lastTag = null;
try {
  lastTag = git('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*');
} catch {
  // No release yet: every commit goes in.
}
const log = git('log', '--no-merges', '--format=%h%x1f%H%x1f%s%x1f%b%x1e', ...(lastTag ? [`${lastTag}..HEAD`] : []));
const commits = log
  .split('\x1e')
  .map((c) => c.trim())
  .filter(Boolean)
  .map((c) => {
    const [short, hash, subject, body = ''] = c.split('\x1f');
    const m = subject.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
    const type = m ? m[1].toLowerCase() : null;
    const breaking = Boolean(m?.[3]) || /^BREAKING[ -]CHANGE:/m.test(body);
    return { short, hash, type, scope: m?.[2], text: m ? m[4] : subject, breaking };
  })
  // Earlier release commits.
  .filter((c) => !(c.type === 'chore' && c.scope === 'release'));
if (commits.length === 0) fail(`nothing to release: no commits since ${lastTag}`);

// 3. The new version.
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const parseVersion = (v) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(v);
  return m && m.slice(1).map(Number);
};
const current = parseVersion(pkg.version) ?? fail(`package.json has a version this script cannot read: ${pkg.version}`);
const level = requested ?? (commits.some((c) => c.breaking) ? 'major' : commits.some((c) => c.type === 'feat') ? 'minor' : 'patch');
const [major, minor, patch] = current;
const next =
  { major: [major + 1, 0, 0], minor: [major, minor + 1, 0], patch: [major, minor, patch + 1] }[level] ??
  parseVersion(level) ??
  fail(`unknown version "${level}": use major, minor, patch or x.y.z`);
const newer = next[0] - major || next[1] - minor || next[2] - patch;
if (newer <= 0) fail(`${next.join('.')} is not newer than the current version ${pkg.version}`);
const version = next.join('.');
const tag = `v${version}`;
if (git('tag', '--list', tag)) fail(`the tag ${tag} already exists`);

// 4. The notes for this release.
const cff = readFileSync('CITATION.cff', 'utf8');
const repoUrl = cff.match(/^repository-code:\s*(\S+)/m)?.[1]?.replace(/\/$/, '');
const date = new Date().toISOString().slice(0, 10);
const commitLink = (c) => (repoUrl ? `[${c.short}](${repoUrl}/commit/${c.hash})` : c.short);
const groups = new Map(SECTIONS.map(([key]) => [key, new Map()]));
for (const c of commits) {
  const key = c.breaking ? 'breaking' : groups.has(c.type) ? c.type : (ALIASES[c.type] ?? 'other');
  const line = `${c.scope ? `**${c.scope}:** ` : ''}${c.text}`;
  // The admin panel makes a commit per save, so the same message can appear
  // several times: list it once, with every commit.
  const section = groups.get(key);
  section.set(line, [...(section.get(line) ?? []), commitLink(c)]);
}
const notes = SECTIONS.filter(([key]) => groups.get(key).size > 0)
  .map(([key, title]) => [`### ${title}`, '', ...[...groups.get(key)].map(([line, links]) => `- ${line} (${links.join(', ')})`)].join('\n'))
  .join('\n\n');
const heading = repoUrl && lastTag ? `## [${version}](${repoUrl}/compare/${lastTag}...${tag}) (${date})` : `## ${version} (${date})`;

console.log(`\n${lastTag ?? 'First release'} → ${tag} (${level}), ${commits.length} commits\n`);
console.log(`${heading}\n\n${notes}\n`);
if (dryRun) {
  console.log('Dry run: nothing was changed.');
  process.exit(0);
}

// 5. The checks the deploy runs, so a release that would not deploy is not tagged.
if (!flag('skip-checks')) {
  for (const script of ['format:check', 'check:content', 'check', 'test', 'build']) {
    console.log(`\n> npm run ${script}`);
    try {
      run('npm', ['run', script, '--silent'], { stdio: 'inherit' });
    } catch {
      fail(`npm run ${script} failed; nothing was changed`);
    }
  }
}

// 6. The version in package.json, package-lock.json and CITATION.cff, and the changelog.
run('npm', ['version', version, '--no-git-tag-version', '--ignore-scripts'], { stdio: 'ignore' });
let newCff = cff.replace(/^version:.*$/m, `version: ${version}`);
newCff = /^date-released:/m.test(newCff)
  ? newCff.replace(/^date-released:.*$/m, `date-released: ${date}`)
  : newCff.replace(/^version:.*$/m, `$&\ndate-released: ${date}`);
writeFileSync('CITATION.cff', newCff);

const CHANGELOG = 'CHANGELOG.md';
const changelogExisted = existsSync(CHANGELOG);
const intro =
  '# Changelog\n\nThe changes in each release of the live edition. Written by `npm run release` from the commit messages, which follow [Conventional Commits](https://www.conventionalcommits.org).\n';
const old = changelogExisted ? readFileSync(CHANGELOG, 'utf8') : intro;
const at = old.search(/^## /m);
const entry = `${heading}\n\n${notes}\n`;
writeFileSync(CHANGELOG, at < 0 ? `${old.trimEnd()}\n\n${entry}` : `${old.slice(0, at)}${entry}\n${old.slice(at)}`);
// No stdin: it would swallow what is typed for the questions below.
const prettify = () => run('npx', ['prettier', '--write', '--log-level', 'warn', CHANGELOG], { stdio: ['ignore', 'inherit', 'inherit'] });
prettify();

// Puts the files back as they were, which they were at the start: the tree was clean.
const cancel = (message) => {
  git('restore', '--source=HEAD', '--worktree', '--', 'package.json', 'package-lock.json', 'CITATION.cff');
  if (changelogExisted) git('restore', '--source=HEAD', '--worktree', '--', CHANGELOG);
  else run('rm', ['-f', CHANGELOG]);
  fail(`${message}; the release was cancelled and the files put back`);
};

// The notes under this version's heading in the changelog, up to the next version.
const notesFromChangelog = () => {
  const lines = readFileSync(CHANGELOG, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.startsWith('## ') && (l.includes(`[${version}]`) || l.split(' ')[1] === version));
  if (start < 0) return null;
  const end = lines.findIndex((l, i) => i > start && l.startsWith('## '));
  return lines
    .slice(start + 1, end < 0 ? undefined : end)
    .join('\n')
    .trim();
};

// 7. A chance to fix the notes before they are committed.
let finalNotes = notes;
if (!flag('no-edit') && process.stdin.isTTY) {
  const editor = git('var', 'GIT_EDITOR');
  console.log(`\nOpening ${CHANGELOG} in ${editor} to review the notes of ${tag}. Save and close it to continue.`);
  try {
    // Through the shell, as the editor can come with arguments, e.g. "code --wait".
    run('sh', ['-c', `${editor} "$1"`, 'sh', CHANGELOG], { stdio: 'inherit' });
  } catch {
    cancel('the editor exited with an error');
  }
  prettify();
  finalNotes = notesFromChangelog() ?? cancel(`the heading of ${version} is no longer in ${CHANGELOG}`);
  if (!finalNotes) cancel(`the notes of ${version} are empty`);
  console.log(`\n${finalNotes}\n`);
  const answer = await ask(`Commit and tag ${tag} with these notes? [Y/n] `);
  if (answer === null || /^n(o)?$/i.test(answer)) cancel('not confirmed');
}

// 8. Commit, tag and push.
git('add', 'package.json', 'package-lock.json', 'CITATION.cff', CHANGELOG);
git('commit', '--quiet', '-m', `chore(release): ${tag}`);
// verbatim: the default cleanup would drop the "### …" headings as comments.
run('git', ['tag', '--annotate', '--cleanup=verbatim', '--file', '-', tag], { input: `${tag}\n\n${finalNotes}\n` });
console.log(`\nCommitted and tagged ${tag}.`);

const push = flag('yes') || /^y(es)?$/i.test((await ask(`Push main and ${tag} to origin, which deploys the site? [y/N] `)) ?? '');
if (push) {
  // --atomic: the tag is not pushed without the commit it points to.
  run('git', ['push', '--atomic', 'origin', 'main', tag], { stdio: 'inherit' });
  console.log(`\nPushed. The deploy and the GitHub release follow in Actions.`);
} else {
  console.log(`\nNot pushed. To publish:   git push --atomic origin main ${tag}`);
  console.log(`To undo instead:          git tag -d ${tag} && git reset --hard HEAD~1`);
}
