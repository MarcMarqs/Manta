import type { APIRoute } from 'astro';
import { endSession } from '../../server/auth';
import { json } from '../../server/http';

export const prerender = false;

export const POST: APIRoute = ({ cookies }) => {
  endSession(cookies);
  return json({ ok: true });
};
