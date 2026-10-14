import type { APIRoute } from 'astro';
import { getBackend, type FileChange } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';
import { isMediaPath, variantSource, variantWidth } from '../../server/paths';
import { MEDIA_MANIFEST } from './upload';

export const prerender = false;

/**
 * Removes an upload from the draft branch, along with any smaller copies and its entry in
 * the media manifest. The editor refuses to delete a file that is still used somewhere,
 * and git keeps the history either way, so a mistake here is recoverable.
 *
 * A clip has neither copies nor a manifest entry, so for one of those this comes down to
 * deleting the single file.
 */
export const DELETE: APIRoute = (ctx) =>
  handle(async () => {
    const { path } = (await ctx.request.json()) as { path?: string };
    if (!path || !isMediaPath(path)) return json({ error: 'Not an uploaded file.' }, 400);

    const backend = await getBackend(envOf(ctx));
    const state = await backend.load();
    const src = path.replace(/^public/, '');

    let manifest: Record<string, { w: number; sizes: number[] }> = {};
    try {
      manifest = JSON.parse(state.files[MEDIA_MANIFEST] ?? '{}');
    } catch {}

    const changes: FileChange[] = [{ path, delete: true }];
    let manifestChanged = false;

    // A picture takes its smaller copies with it.
    for (const width of manifest[src]?.sizes ?? []) {
      changes.push({ path: path.replace(/\.(\w+)$/, `-${width}.$1`), delete: true });
    }
    if (manifest[src]) {
      delete manifest[src];
      manifestChanged = true;
    }

    // A copy deleted on its own is a width the manifest must stop claiming, or the page
    // goes on asking for a file that is not there. The library no longer offers these,
    // but anything that already removed one left the record behind.
    const parent = variantSource(path);
    const width = variantWidth(path);
    if (parent && width) {
      const parentSrc = parent.replace(/^public/, '');
      const entry = manifest[parentSrc];
      if (entry?.sizes.includes(width)) {
        entry.sizes = entry.sizes.filter((w) => w !== width);
        manifestChanged = true;
      }
    }

    if (manifestChanged) {
      changes.push({
        path: MEDIA_MANIFEST,
        content: `${JSON.stringify(manifest, null, 2)}\n`,
        encoding: 'utf-8',
      });
    }

    await backend.commit(changes, `Delete ${path.startsWith('public/videos/') ? 'video' : 'image'} ${path.split('/').pop()}`);
    return json({ ok: true, manifest, status: await backend.status() });
  });
