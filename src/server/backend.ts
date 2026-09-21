import { GitHubBackend } from './github';

export type FileChange =
  | { path: string; content: string; encoding: 'utf-8' | 'base64' }
  | { path: string; delete: true };

export interface ContentState {
  /** Which branch the content was read from: the draft if one exists, otherwise live. */
  branch: string;
  /** Repo path -> raw file text, for every content/**.json file. */
  files: Record<string, string>;
  /** Site paths (e.g. /images/uploads/x.webp) of every image in public/images. */
  images: string[];
}

export interface Status {
  backend: 'github' | 'local';
  draftExists: boolean;
  /** Commits on the draft branch that aren't live yet. */
  ahead: number;
  /** Commits on live that the draft branch doesn't have (e.g. code changes pushed since). */
  behind: number;
  changedFiles: string[];
  previewUrl: string | null;
  liveUrl: string | null;
}

export interface Backend {
  kind: 'github' | 'local';
  load(): Promise<ContentState>;
  commit(changes: FileChange[], message: string): Promise<void>;
  status(): Promise<Status>;
  publish(): Promise<void>;
  discard(): Promise<void>;
  readAsset(path: string): Promise<ArrayBuffer | null>;
}

export class ConfigError extends Error {}

/**
 * GitHub when a token is configured. In `astro dev` without one, the editor reads and
 * writes the files on disk instead, so it can be developed and tested with no token.
 */
export async function getBackend(env: Env): Promise<Backend> {
  if (env.GITHUB_TOKEN) {
    return new GitHubBackend(env.GITHUB_TOKEN, env.GITHUB_REPO || 'MarcMarqs/Manta', env);
  }
  if (import.meta.env.DEV) {
    const { LocalBackend } = await import('./local');
    return new LocalBackend();
  }
  throw new ConfigError('GITHUB_TOKEN is not set. Add it as a secret on the Worker in Cloudflare.');
}
