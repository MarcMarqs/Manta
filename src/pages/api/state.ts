import type { APIRoute } from 'astro';
import { getBackend } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';

export const prerender = false;

/** Everything the editor needs in one call: all content files, the image list, and publish status. */
export const GET: APIRoute = (ctx) =>
  handle(async () => {
    const backend = await getBackend(envOf(ctx));
    const [state, status] = await Promise.all([backend.load(), backend.status()]);
    return json({ ...state, status });
  });
