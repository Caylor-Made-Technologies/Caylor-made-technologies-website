// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import site from './src/data/site.json' with { type: 'json' };

export default defineConfig({
  site: site.url,
  trailingSlash: 'always',
  output: 'static',
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  build: {
    format: 'directory',
    // Keep all CSS in files so the Content-Security-Policy needs no 'unsafe-inline'.
    inlineStylesheets: 'never',
  },
  vite: {
    build: {
      // Never inline scripts or assets as data: URLs (keeps the CSP strict).
      assetsInlineLimit: 0,
    },
  },
  devToolbar: { enabled: false },
});
