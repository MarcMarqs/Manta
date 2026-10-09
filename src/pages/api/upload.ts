import type { APIRoute } from 'astro';
import { getBackend, type FileChange } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';
import { IMAGE_TYPES, VIDEO_TYPES } from '../../server/paths';

export const prerender = false;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/**
 * Cloudflare serves the built site's files itself and refuses any single one over
 * 25 MiB, so a clip above that would upload, commit, and then 404 on the live site.
 * Better to stop it here, where the editor can say why.
 */
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MEDIA_MANIFEST = 'content/media.json';

const extFor = (types: Record<string, string>) =>
  Object.fromEntries(Object.entries(types).map(([ext, type]) => [type, ext === 'jpeg' ? 'jpg' : ext]));

const EXT_FOR_TYPE: Record<string, string> = extFor(IMAGE_TYPES);
const VIDEO_EXT_FOR_TYPE: Record<string, string> = extFor(VIDEO_TYPES);

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
 * Commits an upload to the draft branch straight away (the editor has already resized
 * and converted a picture), so the preview can show it before the page itself is saved.
 * Smaller copies land beside it and are recorded in content/media.json, which the site
 * reads to build a srcset.
 *
 * A video goes through the same door and the same commit, but untouched: the browser
 * cannot re-encode one the way it re-encodes a photo, so what is uploaded is what the
 * site serves.
 */
export const POST: APIRoute = (ctx) =>
  handle(async () => {
    const { name, type, data, width, variants = [] } = (await ctx.request.json()) as UploadBody;
    const video = type ? VIDEO_EXT_FOR_TYPE[type] : undefined;
    const ext = video ?? (type ? EXT_FOR_TYPE[type] : undefined);
    if (!data || !ext) return json({ error: 'Unsupported file type.' }, 400);

    const total = [data, ...variants.map((v) => v.data)].reduce((sum, d) => sum + (d.length * 3) / 4, 0);
    const limit = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (total > limit)
      return json({ error: `That file is larger than ${video ? 25 : 10} MB.` }, 413);

    const base =
      (name ?? 'image')
        .replace(/\.[^.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || (video ? 'video' : 'image');
    const dir = video ? 'public/videos/uploads' : 'public/images/uploads';
    const path = `${dir}/${base}-${crypto.randomUUID().slice(0, 6)}.${ext}`;
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

    await backend.commit(changes, `Upload ${video ? 'video' : 'image'} ${base}.${ext}`);
    return json({ src, manifest, status: await backend.status() });
  });
