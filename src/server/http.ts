import type { APIContext } from 'astro';
import { ConfigError } from './backend';
import { GitHubError } from './github';

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export const envOf = (ctx: Pick<APIContext, 'locals'>): Env => ctx.locals.runtime?.env ?? ({} as Env);

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
