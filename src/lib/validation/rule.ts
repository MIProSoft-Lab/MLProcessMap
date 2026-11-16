import type { ContentFiles } from '../content/files';
import type { Content } from '../content/model';
import type { Reporter, Severity } from './issues';

export interface RuleContext {
  files: ContentFiles;
  content: Content;
  report: Reporter;
}

export interface Rule {
  id: string;
  description: string;
  severity: Severity;
  check(ctx: RuleContext): void;
}
