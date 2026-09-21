import type { APIRoute } from 'astro';
import { getBackend, type FileChange } from '../../server/backend';
import { envOf, handle, json } from '../../server/http';
import { isContentPath } from '../../server/paths';

export const prerender = false;

interface SaveBody {
  message?: string;
  changes?: ({ path: string; content: string } | { path: string; delete: true })[];
}

/** Commits every changed content file in one commit to the draft branch. */
export const POST: APIRoute = (ctx) =>
  handle(async () => {
    const body = (await ctx.request.json()) as SaveBody;
    const changes = body.changes ?? [];
    if (!changes.length) return json({ error: 'Nothing to save.' }, 400);

    const prepared: FileChange[] = [];
    for (const change of changes) {
      if (!isContentPath(change.path)) {
        return json({ error: `Not an editable content file: ${change.path}` }, 400);
      }
      if ('delete' in change) {
        prepared.push({ path: change.path, delete: true });
        continue;
      }
      try {
        JSON.parse(change.content);
      } catch {
        return json({ error: `${change.path} is not valid JSON.` }, 400);
      }
      prepared.push({ path: change.path, content: change.content, encoding: 'utf-8' });
    }

    const backend = await getBackend(envOf(ctx));
    await backend.commit(prepared, body.message?.slice(0, 200) || 'Edit content');
    return json({ ok: true, status: await backend.status() });
  });
