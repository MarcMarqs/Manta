import type { APIRoute } from 'astro';
import { getBackend } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';
import { isMediaPath, mediaType } from '../../server/paths';

export const prerender = false;

/**
 * Serves an upload from the draft branch. Files aren't part of the running build until
 * the draft is published, so the editor and its preview load them through here.
 *
 * The whole file comes back in one piece, with no range support: enough for the preview,
 * where a clip is at most 25 MB, and irrelevant once published, because Cloudflare then
 * serves the file itself.
 */
export const GET: APIRoute = (ctx) =>
  handle(async () => {
    const path = ctx.url.searchParams.get('path') ?? '';
    if (!isMediaPath(path)) return json({ error: 'Not an uploaded file.' }, 400);

    const body = await (await getBackend(envOf(ctx))).readAsset(path);
    if (!body) return json({ error: 'File not found.' }, 404);

    return new Response(body, {
      headers: {
        'Content-Type': mediaType(path),
        // Upload names carry a random suffix, so a path never changes content.
        'Cache-Control': 'private, max-age=3600',
        // An uploaded SVG must not run script when opened directly.
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  });
