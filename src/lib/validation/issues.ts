import { display } from '../content/files';

export type Severity = 'error' | 'warning';

export interface Issue {
  file: string;
  message: string;
  fix?: string;
  rule: string;
  severity: Severity;
}

export type Reporter = (file: string, message: string, fix?: string) => void;

export class Report {
  readonly issues: Issue[] = [];

  for(rule: string, severity: Severity = 'error'): Reporter {
    return (file, message, fix) => this.issues.push({ file, message, fix, rule, severity });
  }
}

export const errors = (issues: Issue[]) => issues.filter((issue) => issue.severity === 'error');
export const warnings = (issues: Issue[]) => issues.filter((issue) => issue.severity === 'warning');

export interface Palette {
  error: (text: string) => string;
  warning: (text: string) => string;
  dim: (text: string) => string;
  bold: (text: string) => string;
}

const plain = (text: string) => text;
export const noColors: Palette = { error: plain, warning: plain, dim: plain, bold: plain };

const ansi = (open: number, close: number) => (text: string) => `\x1b[${open}m${text}\x1b[${close}m`;
export const terminalColors: Palette = { error: ansi(31, 39), warning: ansi(33, 39), dim: ansi(2, 22), bold: ansi(1, 22) };

export interface FormatOptions {
  colors?: Palette;
  /** When given, each section ends by explaining the rules that reported in it. */
  ruleDescriptions?: Record<string, string>;
}

/**
 * Example:
 *
 *     Errors (1)
 *
 *     content/prm/v1/processes/en/P02.yaml
 *       error   The id is P07, but the file is named P02.yaml.  [process-id]
 *               Fix: Change the id to P02, or rename the file.
 *
 *     Warnings (1)
 *
 *     content/prm/v1/processes/en/P17.yaml
 *       warning The output "Validation Report" is not an input of any process.  [work-product-dead-ends]
 */
export function formatIssues(issues: Issue[], { colors = noColors, ruleDescriptions }: FormatOptions = {}): string {
  const sections: [Severity, string, Issue[]][] = [
    ['error', 'Errors', errors(issues)],
    ['warning', 'Warnings', warnings(issues)],
  ];
  return sections
    .filter(([, , sectionIssues]) => sectionIssues.length > 0)
    .map(([severity, title, sectionIssues]) => {
      const heading = colors[severity](colors.bold(`${title} (${sectionIssues.length})`));
      const fileGroups = groupByFile(sectionIssues).map(([file, fileIssues]) =>
        [colors.bold(display(file)), ...fileIssues.map((issue) => formatIssue(issue, colors))].join('\n'),
      );
      const explained = ruleDescriptions ? explainRules(sectionIssues, ruleDescriptions, colors) : [];
      return [heading, ...fileGroups, ...explained].join('\n\n');
    })
    .join('\n\n');
}

const tagWidth = 'warning '.length;

function formatIssue(issue: Issue, colors: Palette): string {
  const tag = colors[issue.severity](issue.severity.padEnd(tagWidth));
  const indent = ' '.repeat(2 + tagWidth);
  const message = issue.message.replace(/\n/g, `\n${indent}`);
  const lines = [`  ${tag}${message}  ${colors.dim(`[${issue.rule}]`)}`];
  if (issue.fix) lines.push(`${indent}${colors.dim('Fix:')} ${issue.fix}`);
  return lines.join('\n');
}

function groupByFile(issues: Issue[]): [string, Issue[]][] {
  const issuesByFile = new Map<string, Issue[]>();
  for (const issue of issues) issuesByFile.set(issue.file, [...(issuesByFile.get(issue.file) ?? []), issue]);
  return [...issuesByFile.entries()].sort(([fileA], [fileB]) => fileA.localeCompare(fileB));
}

function explainRules(issues: Issue[], ruleDescriptions: Record<string, string>, colors: Palette): string[] {
  const ruleIds = [...new Set(issues.map((issue) => issue.rule))].filter((ruleId) => ruleDescriptions[ruleId]);
  if (ruleIds.length === 0) return [];
  return [[colors.dim('About these rules:'), ...ruleIds.map((ruleId) => colors.dim(`  ${ruleId}: ${ruleDescriptions[ruleId]}`))].join('\n')];
}
