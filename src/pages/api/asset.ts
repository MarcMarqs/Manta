import type { APIRoute } from 'astro';
import { getBackend } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';
import { imageType, isImagePath } from '../../server/paths';

export const prerender = false;

/**
 * Serves an image from the draft branch. Uploads aren't part of the running build
 * until the draft is published, so the editor and its preview load them through here.
 */
export const GET: APIRoute = (ctx) =>
  handle(async () => {
    const path = ctx.url.searchParams.get('path') ?? '';
    if (!isImagePath(path)) return json({ error: 'Not an image path.' }, 400);

    const body = await (await getBackend(envOf(ctx))).readAsset(path);
    if (!body) return json({ error: 'Image not found.' }, 404);

    return new Response(body, {
      headers: {
        'Content-Type': imageType(path),
        // Upload names carry a random suffix, so a path never changes content.
        'Cache-Control': 'private, max-age=3600',
        // An uploaded SVG must not run script when opened directly.
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    });
  });
