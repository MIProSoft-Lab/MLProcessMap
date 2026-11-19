// What the lifecycle builder keeps in or hands to the browser: the last model
// edited, and the files it exports.

const STORE = 'prm-tool:tailor:last';

/**
 * The last model edited, as its URL hash, kept in the browser to offer it
 * again on a visit that starts without one. Storage can be blocked, and the
 * builder works without it.
 */
export const lastModel = {
  get() {
    try {
      return localStorage.getItem(STORE);
    } catch {
      return null;
    }
  },
  set(hash: string | null) {
    try {
      if (hash === null) localStorage.removeItem(STORE);
      else localStorage.setItem(STORE, hash);
    } catch {}
  },
};

/** Save text as a file with this name and media type. */
export function download(name: string, type: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
