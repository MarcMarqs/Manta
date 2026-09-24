import type { Status, Version } from '../server/backend';

export type { Status, Version };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`);
  return data as T;
}

export interface LoadedState {
  branch: string;
  files: Record<string, string>;
  images: string[];
  status: Status;
}

/** content/media.json: which widths exist for each uploaded image. */
export type MediaManifest = Record<string, { w: number; sizes: number[] }>;

export type SaveChange = { path: string; content: string } | { path: string; delete: true };

export const api = {
  session: () => call<{ authed: boolean; passwordConfigured: boolean }>('GET', '/api/session'),
  login: (password: string) => call<{ ok: true }>('POST', '/api/login', { password }),
  logout: () => call<{ ok: true }>('POST', '/api/logout', {}),
  state: () => call<LoadedState>('GET', '/api/state'),
  status: () => call<Status>('GET', '/api/status'),
  save: (changes: SaveChange[], message: string) =>
    call<{ ok: true; status: Status }>('POST', '/api/save', { changes, message }),
  upload: (name: string, image: { type: string; data: string; width?: number; variants: { width: number; data: string }[] }) =>
    call<{ src: string; manifest?: MediaManifest; status: Status }>('POST', '/api/upload', { name, ...image }),
  deleteImage: (path: string) =>
    call<{ ok: true; manifest?: MediaManifest; status: Status }>('DELETE', '/api/image', { path }),
  history: () => call<{ versions: Version[] }>('GET', '/api/history'),
  restore: (sha: string) => call<{ ok: true; status: Status }>('POST', '/api/history', { sha }),
  publish: () => call<{ ok: true; status: Status }>('POST', '/api/publish', {}),
  discard: () => call<{ ok: true }>('POST', '/api/discard', {}),
  preview: async (payload: unknown): Promise<string> => {
    const res = await fetch('/admin/preview', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new ApiError(res.status, `Preview failed (${res.status})`);
    return res.text();
  },
};

/** Editor-side URL for an image: site images go through the API so draft uploads show. */
export const assetUrl = (src: string) =>
  src?.startsWith('/images/') ? `/api/asset?path=${encodeURIComponent(`public${src}`)}` : src;
