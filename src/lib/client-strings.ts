// Interface strings in the browser. A page's script only has the strings the
// page hands it, as a list of keys in its frontmatter (or exported by the
// module that uses them, such as diagramKeys). client-strings.test.ts checks
// that every key a script uses is in its list.
import { format } from './text';

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** The lookup for a script, from the strings its page handed it. */
export function translator(strings: Record<string, string>): Translate {
  return (key, vars = {}) => {
    const text = strings[key];
    // The key itself is shown in place of a missing string; say so while developing.
    if (text === undefined && import.meta.env.DEV)
      console.error(
        `Interface string "${key}" was not handed to this script: add it to the list of keys of the page or module that uses it.`,
      );
    return format(text ?? key, vars);
  };
}
