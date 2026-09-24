import type { Backend, ContentState, FileChange, Status, Version } from './backend';
import { isContentPath, isImagePath } from './paths';

const LIVE = 'main';
const DRAFT = 'draft';

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface TreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
}

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * Content lives in the repo. Edits are committed to a `draft` branch (which Cloudflare
 * deploys to its own preview URL); publishing moves `main` to match it.
 */
export class GitHubBackend implements Backend {
  kind = 'github' as const;

  constructor(
    private token: string,
    private repo: string,
    private env: Env,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown, accept?: string): Promise<T> {
    const res = await fetch(`https://api.github.com/repos/${this.repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: accept ?? 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'manta-editor',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const detail = await res.text();
      let message = detail;
      try {
        message = JSON.parse(detail).message ?? detail;
      } catch {}
      throw new GitHubError(res.status, `GitHub ${method} ${path} failed (${res.status}): ${message}`);
    }
    if (res.status === 204) return null as T;
    return (accept?.includes('raw') ? res.arrayBuffer() : res.json()) as Promise<T>;
  }

  /** Head commit of a branch, or null if the branch doesn't exist. */
  private async head(branch: string): Promise<string | null> {
    try {
      const ref = await this.request<{ object: { sha: string } }>('GET', `/git/ref/heads/${branch}`);
      return ref.object.sha;
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return null;
      throw err;
    }
  }

  private async ensureDraft(): Promise<string> {
    const existing = await this.head(DRAFT);
    if (existing) return existing;
    const live = await this.head(LIVE);
    if (!live) throw new GitHubError(404, `The ${LIVE} branch doesn't exist yet. Push the project first.`);
    await this.request('POST', '/git/refs', { ref: `refs/heads/${DRAFT}`, sha: live });
    return live;
  }

  async load(): Promise<ContentState> {
    const draft = await this.head(DRAFT);
    const branch = draft ? DRAFT : LIVE;
    const sha = draft ?? (await this.head(LIVE));
    if (!sha) throw new GitHubError(404, `The ${LIVE} branch doesn't exist yet. Push the project first.`);

    const tree = await this.request<{ tree: TreeEntry[] }>('GET', `/git/trees/${sha}?recursive=1`);
    const blobs = tree.tree.filter((e) => e.type === 'blob');

    const contentEntries = blobs.filter((e) => isContentPath(e.path));
    const files: Record<string, string> = {};
    await Promise.all(
      contentEntries.map(async (entry) => {
        const blob = await this.request<{ content: string }>('GET', `/git/blobs/${entry.sha}`);
        files[entry.path] = decodeBase64Utf8(blob.content);
      }),
    );

    const images = blobs
      .filter((e) => isImagePath(e.path))
      .map((e) => e.path.replace(/^public/, ''))
      .sort();

    return { branch, files, images };
  }

  /** All changes land as one commit, so one save triggers one preview build. */
  async commit(changes: FileChange[], message: string): Promise<void> {
    const parent = await this.ensureDraft();
    const parentCommit = await this.request<{ tree: { sha: string } }>('GET', `/git/commits/${parent}`);

    const tree = await Promise.all(
      changes.map(async (change) => {
        if ('delete' in change) {
          return { path: change.path, mode: '100644', type: 'blob', sha: null };
        }
        const blob = await this.request<{ sha: string }>('POST', '/git/blobs', {
          content: change.content,
          encoding: change.encoding,
        });
        return { path: change.path, mode: '100644', type: 'blob', sha: blob.sha };
      }),
    );

    const newTree = await this.request<{ sha: string }>('POST', '/git/trees', {
      base_tree: parentCommit.tree.sha,
      tree,
    });
    const commit = await this.request<{ sha: string }>('POST', '/git/commits', {
      message,
      tree: newTree.sha,
      parents: [parent],
    });
    await this.request('PATCH', `/git/refs/heads/${DRAFT}`, { sha: commit.sha });
  }

  async status(): Promise<Status> {
    const base: Status = {
      backend: 'github',
      draftExists: false,
      ahead: 0,
      behind: 0,
      changedFiles: [],
      previewUrl: this.env.PREVIEW_URL || null,
      liveUrl: this.env.LIVE_URL || null,
    };
    if (!(await this.head(DRAFT))) return base;

    const compare = await this.request<{
      ahead_by: number;
      behind_by: number;
      files?: { filename: string }[];
    }>('GET', `/compare/${LIVE}...${DRAFT}`);

    return {
      ...base,
      draftExists: true,
      ahead: compare.ahead_by,
      behind: compare.behind_by,
      changedFiles: (compare.files ?? []).map((f) => f.filename),
    };
  }

  async publish(): Promise<void> {
    const draft = await this.head(DRAFT);
    if (!draft) return;

    const compare = await this.request<{ ahead_by: number; behind_by: number }>(
      'GET',
      `/compare/${LIVE}...${DRAFT}`,
    );
    if (compare.ahead_by === 0) {
      await this.request('DELETE', `/git/refs/heads/${DRAFT}`);
      return;
    }

    if (compare.behind_by === 0) {
      // Live hasn't moved since the draft started: fast-forward, no merge commit.
      await this.request('PATCH', `/git/refs/heads/${LIVE}`, { sha: draft, force: false });
    } else {
      // Live moved (e.g. a code change was pushed): merge the draft in.
      try {
        await this.request('POST', '/merges', {
          base: LIVE,
          head: DRAFT,
          commit_message: 'Publish from Manta editor',
        });
      } catch (err) {
        if (err instanceof GitHubError && err.status === 409) {
          throw new GitHubError(
            409,
            'The draft conflicts with changes made on the live site since it was started. Discard the draft and redo the edit, or resolve it in git.',
          );
        }
        throw err;
      }
    }

    // A fresh draft is cut from live on the next save, so it always starts current.
    await this.request('DELETE', `/git/refs/heads/${DRAFT}`);
  }

  async history(): Promise<Version[]> {
    const branch = (await this.head(DRAFT)) ? DRAFT : LIVE;
    const commits = await this.request<
      {
        sha: string;
        commit: { message: string; author: { name: string; date: string } };
      }[]
    >('GET', `/commits?sha=${branch}&path=content&per_page=25`);

    return commits.map((c) => ({
      sha: c.sha,
      // Just the summary line; the editor writes one-line messages anyway.
      message: c.commit.message.split('\n')[0],
      date: c.commit.author.date,
      author: c.commit.author.name,
    }));
  }

  /** Copies that commit's content files onto the draft, removing any added since. */
  async restore(sha: string): Promise<void> {
    const commit = await this.request<{ tree: { sha: string } }>('GET', `/git/commits/${sha}`);
    const tree = await this.request<{ tree: TreeEntry[] }>('GET', `/git/trees/${commit.tree.sha}?recursive=1`);
    const wanted = tree.tree.filter((e) => e.type === 'blob' && isContentPath(e.path));

    const changes: FileChange[] = await Promise.all(
      wanted.map(async (entry) => {
        const blob = await this.request<{ content: string }>('GET', `/git/blobs/${entry.sha}`);
        return { path: entry.path, content: decodeBase64Utf8(blob.content), encoding: 'utf-8' as const };
      }),
    );

    const current = await this.load();
    const keep = new Set(wanted.map((e) => e.path));
    for (const path of Object.keys(current.files)) {
      if (!keep.has(path)) changes.push({ path, delete: true });
    }

    await this.commit(changes, `Restore content from ${sha.slice(0, 7)}`);
  }

  async discard(): Promise<void> {
    if (await this.head(DRAFT)) await this.request('DELETE', `/git/refs/heads/${DRAFT}`);
  }

  async readAsset(path: string): Promise<ArrayBuffer | null> {
    const ref = (await this.head(DRAFT)) ? DRAFT : LIVE;
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    try {
      return await this.request<ArrayBuffer>(
        'GET',
        `/contents/${encoded}?ref=${ref}`,
        undefined,
        'application/vnd.github.raw+json',
      );
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return null;
      throw err;
    }
  }
}
