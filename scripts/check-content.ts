import { fileURLToPath } from 'node:url';
import { readContentFiles } from '../src/lib/content/read-files';
import { errors, formatIssues, noColors, ruleDescriptions, rules, terminalColors, validate, warnings } from '../src/lib/validation';

const root = fileURLToPath(new URL('..', import.meta.url));
const files = readContentFiles(root);
const issues = validate(files);

// https://no-color.org
const colors = process.stderr.isTTY && !process.env.NO_COLOR ? terminalColors : noColors;

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
const checked = `${plural(Object.keys(files).length, 'file')} checked with ${plural(rules.length, 'rule')}`;

if (issues.length === 0) {
  console.log(`Content OK: ${checked}.`);
} else {
  const errorCount = errors(issues).length;
  const warningCount = warnings(issues).length;
  const affectedFiles = new Set(issues.map((issue) => issue.file)).size;
  const counts = `${plural(errorCount, 'error')} and ${plural(warningCount, 'warning')} in ${plural(affectedFiles, 'file')}`;
  const verdict = errorCount > 0 ? colors.error(colors.bold(`Failed: ${counts}.`)) : colors.warning(colors.bold(`Passed with warnings: ${counts}.`));
  console.error(`${formatIssues(issues, { colors, ruleDescriptions })}\n\n${verdict} ${colors.dim(`(${checked})`)}`);
  if (errorCount > 0) process.exitCode = 1;
}
