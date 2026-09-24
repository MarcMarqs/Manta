// Dev-only backend: reads and writes the project's own files on disk. Loaded only
// under `astro dev` when no GITHUB_TOKEN is set, so it never ships to the Worker.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import type { Backend, ContentState, FileChange, Status, Version } from './backend';
import { isContentPath, isImagePath } from './paths';

const root = process.cwd();

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(join(root, dir), { withFileTypes: true }).catch(() => [] as import('node:fs').Dirent[]);
  const nested = await Promise.all(
    entries.map((e) => {
      const path = `${dir}/${e.name}`;
      return e.isDirectory() ? walk(path) : Promise.resolve([path]);
    }),
  );
  return nested.flat();
}

const toRepoPath = (abs: string) => relative(root, abs).split(sep).join('/');

export class LocalBackend implements Backend {
  kind = 'local' as const;

  async load(): Promise<ContentState> {
    const contentPaths = (await walk('content')).filter(isContentPath);
    const files: Record<string, string> = {};
    await Promise.all(
      contentPaths.map(async (p) => {
        files[p] = await readFile(join(root, p), 'utf-8');
      }),
    );
    const images = (await walk('public/images'))
      .filter(isImagePath)
      .map((p) => p.replace(/^public/, ''))
      .sort();
    return { branch: 'local', files, images };
  }

  async commit(changes: FileChange[]): Promise<void> {
    for (const change of changes) {
      const abs = join(root, change.path);
      if (toRepoPath(abs) !== change.path) throw new Error(`Refusing to write outside the project: ${change.path}`);
      if ('delete' in change) {
        await rm(abs, { force: true });
        continue;
      }
      await mkdir(dirname(abs), { recursive: true });
      await writeFile(abs, change.encoding === 'base64' ? Buffer.from(change.content, 'base64') : change.content);
    }
  }

  async status(): Promise<Status> {
    return {
      backend: 'local',
      draftExists: false,
      ahead: 0,
      behind: 0,
      changedFiles: [],
      previewUrl: null,
      liveUrl: null,
    };
  }

  async history(): Promise<Version[]> {
    return [];
  }

  async restore(): Promise<void> {
    throw new Error('Local mode has no version history. Use git to go back.');
  }

  async publish(): Promise<void> {
    throw new Error('Local mode writes straight to your files — there is nothing to publish. Commit and push with git.');
  }

  async discard(): Promise<void> {
    throw new Error('Local mode has no draft branch to discard. Use git to revert files.');
  }

  async readAsset(path: string): Promise<ArrayBuffer | null> {
    try {
      const buffer = await readFile(join(root, path));
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    } catch {
      return null;
    }
  }
}
