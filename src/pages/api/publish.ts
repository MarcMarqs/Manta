import type { APIRoute } from 'astro';
import { getBackend } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';

export const prerender = false;

/** Makes the draft live: moves `main` to the draft and removes the draft branch. */
export const POST: APIRoute = (ctx) =>
  handle(async () => {
    const backend = await getBackend(envOf(ctx));
    await backend.publish();
    return json({ ok: true, status: await backend.status() });
  });
