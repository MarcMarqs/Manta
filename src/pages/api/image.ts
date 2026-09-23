import type { APIRoute } from 'astro';
import { getBackend } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';
import { isImagePath } from '../../server/paths';

export const prerender = false;

/**
 * Removes an uploaded image from the draft branch. The editor refuses to delete an image
 * that is still used somewhere, and git keeps the history either way, so a mistake here
 * is recoverable.
 */
export const DELETE: APIRoute = (ctx) =>
  handle(async () => {
    const { path } = (await ctx.request.json()) as { path?: string };
    if (!path || !isImagePath(path)) return json({ error: 'Not an image path.' }, 400);

    const backend = await getBackend(envOf(ctx));
    await backend.commit([{ path, delete: true }], `Delete image ${path.split('/').pop()}`);
    return json({ ok: true, status: await backend.status() });
  });
