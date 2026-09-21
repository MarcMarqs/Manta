import type { APIRoute } from 'astro';
import { checkPassword, startSession } from '../../server/auth';
import { envOf, handle, json } from '../../server/http';

export const prerender = false;

export const POST: APIRoute = (ctx) =>
  handle(async () => {
    const env = envOf(ctx);
    if (!env.ADMIN_PASSWORD) {
      return json({ error: 'ADMIN_PASSWORD is not set. Add it as a secret on the Worker in Cloudflare.' }, 503);
    }
    const { password } = (await ctx.request.json().catch(() => ({}))) as { password?: string };
    if (!password || !(await checkPassword(env, password))) {
      // A little friction for anyone guessing.
      await new Promise((r) => setTimeout(r, 600));
      return json({ error: 'Wrong password.' }, 401);
    }
    await startSession(env, ctx.cookies, ctx.url.protocol === 'https:');
    return json({ ok: true });
  });
