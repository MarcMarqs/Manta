import type { APIRoute } from 'astro';
import { getBackend, type FileChange } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';
import { isMediaPath } from '../../server/paths';
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
    for (const width of manifest[src]?.sizes ?? []) {
      changes.push({ path: path.replace(/\.(\w+)$/, `-${width}.$1`), delete: true });
    }
    if (manifest[src]) {
      delete manifest[src];
      changes.push({
        path: MEDIA_MANIFEST,
        content: `${JSON.stringify(manifest, null, 2)}\n`,
        encoding: 'utf-8',
      });
    }

    await backend.commit(changes, `Delete ${path.startsWith('public/videos/') ? 'video' : 'image'} ${path.split('/').pop()}`);
    return json({ ok: true, manifest, status: await backend.status() });
  });
