import type { APIRoute } from 'astro';
import { getBackend } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';
import { IMAGE_TYPES } from '../../server/paths';

export const prerender = false;

const MAX_BYTES = 10 * 1024 * 1024;

const EXT_FOR_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGE_TYPES).map(([ext, type]) => [type, ext === 'jpeg' ? 'jpg' : ext]),
);

/**
 * Commits an image to the draft branch straight away (the editor has already resized
 * and converted it), so the preview can show it before the page itself is saved.
 */
export const POST: APIRoute = (ctx) =>
  handle(async () => {
    const { name, type, data } = (await ctx.request.json()) as { name?: string; type?: string; data?: string };
    const ext = type ? EXT_FOR_TYPE[type] : undefined;
    if (!data || !ext) return json({ error: 'Unsupported image type.' }, 400);
    if ((data.length * 3) / 4 > MAX_BYTES) return json({ error: 'Image is larger than 10 MB.' }, 413);

    const base =
      (name ?? 'image')
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'image';
    const suffix = crypto.randomUUID().slice(0, 6);
    const path = `public/images/uploads/${base}-${suffix}.${ext}`;

    const backend = await getBackend(envOf(ctx));
    await backend.commit([{ path, content: data, encoding: 'base64' }], `Upload image ${base}.${ext}`);
    return json({ src: path.replace(/^public/, ''), status: await backend.status() });
  });
