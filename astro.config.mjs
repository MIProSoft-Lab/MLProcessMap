// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_URL and BASE_PATH are set by the deploy workflow. For a GitHub Pages
// project site they are https://<user>.github.io and /<repo>.
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'ignore',
  // Load a page when the pointer rests on a link to it, so following it is instant.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [
    // Only the live edition is indexed
    ...(process.env.PUBLIC_EDITION === 'thesis'
      ? []
      : [
          sitemap({
            // Leave out the redirects, the admin panel and the error page.
            filter: (page) => {
              const path = new URL(page).pathname.slice((process.env.BASE_PATH ?? '').replace(/\/$/, '').length);
              return path !== '/' && !/^\/(\w+\/latest|admin|404)(\/|$)/.test(path);
            },
          }),
        ]),
  ],
  vite: {
    server: {
      // Reload the dev server when the content files change.
      watch: { ignored: ['!**/content/**'] },
    },
  },
});
