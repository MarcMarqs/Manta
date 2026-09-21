import type { APIRoute } from 'astro';
import { getBackend } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';

export const prerender = false;

/** Throws the draft branch away. The editor then reloads content from live. */
export const POST: APIRoute = (ctx) =>
  handle(async () => {
    const backend = await getBackend(envOf(ctx));
    await backend.discard();
    return json({ ok: true });
  });
