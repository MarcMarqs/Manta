import { defineMiddleware } from 'astro:middleware';
import type { APIContext } from 'astro';
import { hasSession } from './server/auth';
import { envOf, json } from './server/http';

const OPEN = new Set(['/api/login', '/api/session']);

const isEditorPath = (pathname: string) =>
  pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/api/');

/** The site's own 404 page, so a blocked editor URL looks like any other missing page. */
async function notFound(ctx: APIContext): Promise<Response> {
  try {
    const page = await envOf(ctx).ASSETS?.fetch(new URL('/404', ctx.url));
    if (page?.ok) {
      return new Response(page.body, {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }
  } catch {}
  return new Response('Not found', { status: 404 });
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = ctx.url;
  if (ctx.isPrerendered || !isEditorPath(pathname)) return next();

  // On the public domain the editor doesn't exist. Checked before anything else, so
  // not even the login page or an error message gives it away.
  const adminHost = envOf(ctx).ADMIN_HOST;
  if (adminHost && ctx.url.hostname !== adminHost) return notFound(ctx);

  const guarded = pathname.startsWith('/api/') || pathname === '/admin/preview';
  if (guarded) {
    // Anything that changes state must come from the editor's own page. Together with
    // the SameSite=Strict cookie this shuts out cross-site form posts.
    if (ctx.request.method !== 'GET' && ctx.request.headers.get('origin') !== ctx.url.origin) {
      return json({ error: 'Cross-origin request refused.' }, 403);
    }
    if (!OPEN.has(pathname) && !(await hasSession(envOf(ctx), ctx.cookies))) {
      return json({ error: 'Not signed in.' }, 401);
    }
  }

  const response = await next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
});
