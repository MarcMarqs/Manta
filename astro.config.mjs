// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// Static by default: every content page is prerendered to HTML at build time.
// The adapter is here so /admin and /api/* can opt out with `prerender = false`
// and run as Worker routes, where the GitHub token stays server-side.
export default defineConfig({
  output: 'static',
  adapter: cloudflare({ imageService: 'compile' }),
});
