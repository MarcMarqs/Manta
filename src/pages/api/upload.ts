import type { APIRoute } from 'astro';
import { getBackend, type FileChange } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';
import { IMAGE_TYPES } from '../../server/paths';

export const prerender = false;

const MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_MANIFEST = 'content/media.json';

const EXT_FOR_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(IMAGE_TYPES).map(([ext, type]) => [type, ext === 'jpeg' ? 'jpg' : ext]),
);

interface UploadBody {
  name?: string;
  type?: string;
  /** Base64 of the largest copy. */
  data?: string;
  /** Intrinsic width of that copy. */
  width?: number;
  /** Smaller copies the browser produced, largest first or last, order doesn't matter. */
  variants?: { width: number; data: string }[];
}

/**
 * Commits an image to the draft branch straight away (the editor has already resized and
 * converted it), so the preview can show it before the page itself is saved. Smaller
 * copies land beside it and are recorded in content/media.json, which the site reads to
 * build a srcset.
 */
export const POST: APIRoute = (ctx) =>
  handle(async () => {
    const { name, type, data, width, variants = [] } = (await ctx.request.json()) as UploadBody;
    const ext = type ? EXT_FOR_TYPE[type] : undefined;
    if (!data || !ext) return json({ error: 'Unsupported image type.' }, 400);

    const total = [data, ...variants.map((v) => v.data)].reduce((sum, d) => sum + (d.length * 3) / 4, 0);
    if (total > MAX_BYTES) return json({ error: 'Image is larger than 10 MB.' }, 413);

    const base =
      (name ?? 'image')
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'image';
    const path = `public/images/uploads/${base}-${crypto.randomUUID().slice(0, 6)}.${ext}`;
    const src = path.replace(/^public/, '');

    const changes: FileChange[] = [{ path, content: data, encoding: 'base64' }];
    for (const variant of variants) {
      changes.push({
        path: path.replace(/\.(\w+)$/, `-${variant.width}.$1`),
        content: variant.data,
        encoding: 'base64',
      });
    }

    const backend = await getBackend(envOf(ctx));

    // Record the sizes alongside the files, in the same commit, so the two can't drift.
    let manifest: Record<string, { w: number; sizes: number[] }> = {};
    if (width && variants.length) {
      const state = await backend.load();
      try {
        manifest = JSON.parse(state.files[MEDIA_MANIFEST] ?? '{}');
      } catch {}
      manifest[src] = { w: width, sizes: variants.map((v) => v.width).sort((a, b) => a - b) };
      changes.push({
        path: MEDIA_MANIFEST,
        content: `${JSON.stringify(manifest, null, 2)}\n`,
        encoding: 'utf-8',
      });
    }

    await backend.commit(changes, `Upload image ${base}.${ext}`);
    return json({ src, manifest, status: await backend.status() });
  });
