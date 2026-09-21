import { defineMiddleware } from 'astro:middleware';
import { hasSession } from './server/auth';
import { envOf, json } from './server/http';

const OPEN = new Set(['/api/login', '/api/session']);

export const onRequest = defineMiddleware(async (ctx, next) => {
  const { pathname } = ctx.url;
  const guarded = pathname.startsWith('/api/') || pathname === '/admin/preview';
  if (ctx.isPrerendered || !guarded) return next();

  // Anything that changes state must come from the editor's own page. Together with the
  // SameSite=Strict cookie this shuts out cross-site form posts.
  if (ctx.request.method !== 'GET' && ctx.request.headers.get('origin') !== ctx.url.origin) {
    return json({ error: 'Cross-origin request refused.' }, 403);
  }

  if (!OPEN.has(pathname) && !(await hasSession(envOf(ctx), ctx.cookies))) {
    return json({ error: 'Not signed in.' }, 401);
  }

  const response = await next();
  response.headers.set('X-Robots-Tag', 'noindex');
  return response;
});
