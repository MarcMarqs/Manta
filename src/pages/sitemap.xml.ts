import type { APIRoute } from 'astro';
import { pages, projects, site, tags } from '../lib/content';

/** Every page the editor knows about. Built with the site, so it can never go stale. */
export const GET: APIRoute = () => {
  const base = site.url?.replace(/\/$/, '');
  if (!base) return new Response('Set the site address in Site & theme first.', { status: 404 });

  const tagPaths = [...tags.discipline, ...tags.engine]
    .filter((tag) => projects.some((p) => [...p.discipline, ...p.engine].includes(tag.id)))
    .map((tag) => `/tags/${tag.id}`);

  const urls = [...pages.map((page) => page.path), ...tagPaths]
    .sort()
    .map((path) => `  <url><loc>${base}${path}</loc></url>`)
    .join('\n');

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
