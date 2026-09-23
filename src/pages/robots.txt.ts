import type { APIRoute } from 'astro';
import { site } from '../lib/content';

/** The editor and its API are never worth indexing, and the sitemap points at the pages. */
export const GET: APIRoute = () => {
  const base = site.url?.replace(/\/$/, '');
  const lines = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    ...(base ? ['', `Sitemap: ${base}/sitemap.xml`] : []),
  ];
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
