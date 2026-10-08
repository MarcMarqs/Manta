import type { AstroCookies } from 'astro';

export const SESSION_COOKIE = 'manta_session';
export const WORK_COOKIE = 'manta_work';
const SESSION_DAYS = 7;

/**
 * The two things a password can open, kept apart on purpose.
 *
 * 'admin' is the editor. 'work' is a private case study, whose password gets sent to
 * people outside — so it must never be the editor's, and a session for one must not
 * be a session for the other. Each is signed with its own password, which also means
 * changing one password ends only its own sessions.
 */
export type Gate = 'admin' | 'work';

const passwordFor = (env: Env, gate: Gate) => (gate === 'admin' ? env.ADMIN_PASSWORD : env.WORK_PASSWORD);
const cookieFor = (gate: Gate) => (gate === 'admin' ? SESSION_COOKIE : WORK_COOKIE);

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

// Each gate signs with its own password, so a session is only ever valid for the one
// it was issued for, even if both passwords were somehow set to the same string.
const signingKey = (env: Env, gate: Gate) => `${gate}:${env.SESSION_SECRET || passwordFor(env, gate) || ''}`;

export async function checkPassword(env: Env, input: string, gate: Gate = 'admin'): Promise<boolean> {
  const password = passwordFor(env, gate);
  if (!password) return false;
  // Hash both sides first so the comparison is fixed-length regardless of input.
  const [expected, actual] = await Promise.all([hmac('manta-password', password), hmac('manta-password', input)]);
  return constantTimeEqual(expected, actual);
}

/**
 * A session is just an expiry signed with the gate's password, so changing that password
 * logs out every session it had issued. No server-side storage needed.
 *
 * The editor's cookie is Strict, which together with the origin check shuts out
 * cross-site form posts. A private case study's is Lax, because its whole purpose is to
 * be opened from a link in somebody's mail: Strict would withhold the cookie on that
 * first click and ask for the password again every time.
 */
export async function startSession(env: Env, cookies: AstroCookies, secure: boolean, gate: Gate = 'admin') {
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  const value = `${expires}.${await hmac(signingKey(env, gate), `session:${expires}`)}`;
  cookies.set(cookieFor(gate), value, {
    httpOnly: true,
    secure,
    sameSite: gate === 'admin' ? 'strict' : 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function endSession(cookies: AstroCookies, gate: Gate = 'admin') {
  cookies.delete(cookieFor(gate), { path: '/' });
}

export async function hasSession(env: Env, cookies: AstroCookies, gate: Gate = 'admin'): Promise<boolean> {
  const value = cookies.get(cookieFor(gate))?.value;
  if (!value || !passwordFor(env, gate)) return false;
  const [expires, signature] = value.split('.');
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return constantTimeEqual(signature, await hmac(signingKey(env, gate), `session:${expires}`));
}
