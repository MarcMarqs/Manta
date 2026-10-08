import type { APIContext } from 'astro';
import { ConfigError } from './backend';
import { GitHubError } from './github';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const envOf = (ctx: Pick<APIContext, 'locals'>): Env => ctx.locals.runtime?.env ?? ({} as Env);

/**
 * The site's own 404 page, so a page that declines to exist looks like any other
 * missing one.
 *
 * It is fetched from the asset server rather than rewritten to, because /404 is
 * prerendered: by the time a request arrives it is a file, and an on-demand route is
 * not allowed to render it. In dev there is no asset binding, hence the fallback.
 */
export async function notFound(env: Env, url: URL): Promise<Response> {
  try {
    const page = await env.ASSETS?.fetch(new URL('/404', url));
    if (page?.ok) {
      return new Response(page.body, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  } catch {}
  return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

/** Runs a handler and turns thrown errors into a JSON `{ error }` the editor can show. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      err instanceof ConfigError ? 503 : err instanceof GitHubError && err.status < 500 ? err.status : 500;
    console.error(err);
    return json({ error: message }, status);
  }
}
