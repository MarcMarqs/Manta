import type { APIRoute } from 'astro';
import { hasSession } from '../../server/auth';
import { envOf, json } from '../../server/http';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const env = envOf(ctx);
  return json({
    authed: await hasSession(env, ctx.cookies),
    passwordConfigured: Boolean(env.ADMIN_PASSWORD),
  });
};
