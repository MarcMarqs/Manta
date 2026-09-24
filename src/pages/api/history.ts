import type { APIRoute } from 'astro';
import { getBackend } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';

export const prerender = false;

/** Recent saved versions of the content, newest first. */
export const GET: APIRoute = (ctx) =>
  handle(async () => json({ versions: await (await getBackend(envOf(ctx))).history() }));

/** Puts an earlier version back on the draft, as a new commit on top. */
export const POST: APIRoute = (ctx) =>
  handle(async () => {
    const { sha } = (await ctx.request.json()) as { sha?: string };
    if (!sha || !/^[0-9a-f]{7,40}$/.test(sha)) return json({ error: 'Not a valid version id.' }, 400);

    const backend = await getBackend(envOf(ctx));
    await backend.restore(sha);
    return json({ ok: true, status: await backend.status() });
  });
