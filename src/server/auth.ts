import type { AstroCookies } from 'astro';

export const SESSION_COOKIE = 'manta_session';
const SESSION_DAYS = 7;

const encoder = new TextEncoder();

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return toBase64Url(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)));
}

/** Compares without short-circuiting, so response time doesn't leak how much matched. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const signingKey = (env: Env) => env.SESSION_SECRET || env.ADMIN_PASSWORD || '';

export async function checkPassword(env: Env, input: string): Promise<boolean> {
  if (!env.ADMIN_PASSWORD) return false;
  // Hash both sides first so the comparison is fixed-length regardless of input.
  const [expected, actual] = await Promise.all([
    hmac('manta-password', env.ADMIN_PASSWORD),
    hmac('manta-password', input),
  ]);
  return constantTimeEqual(expected, actual);
}

/**
 * A session is just an expiry signed with the password, so changing ADMIN_PASSWORD
 * logs every existing session out. No server-side storage needed.
 */
export async function startSession(env: Env, cookies: AstroCookies, secure: boolean) {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const value = `${expires}.${await hmac(signingKey(env), `session:${expires}`)}`;
  cookies.set(SESSION_COOKIE, value, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function endSession(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export async function hasSession(env: Env, cookies: AstroCookies): Promise<boolean> {
  const value = cookies.get(SESSION_COOKIE)?.value;
  if (!value || !signingKey(env)) return false;
  const [expires, signature] = value.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return constantTimeEqual(signature, await hmac(signingKey(env), `session:${expires}`));
}
