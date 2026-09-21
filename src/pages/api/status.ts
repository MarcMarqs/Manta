import type { APIRoute } from 'astro';
import { getBackend } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';

export const prerender = false;

export const GET: APIRoute = (ctx) =>
  handle(async () => json(await (await getBackend(envOf(ctx))).status()));
