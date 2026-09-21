/// <reference types="astro/client" />

interface Env {
  ASSETS: Fetcher;
  ADMIN_PASSWORD?: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string;
  LIVE_URL?: string;
  /**
   * Hostname the editor is served on, e.g. "manta.you.workers.dev". When set, /admin and
   * /api/* answer 404 on every other hostname, so visitors to the public domain never
   * see that Manta exists. Unset means the editor is available on every hostname.
   */
  ADMIN_HOST?: string;
  PREVIEW_URL?: string;
  /** Optional. Signs session cookies; falls back to ADMIN_PASSWORD. */
  SESSION_SECRET?: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    /** Set only by /admin/preview: unsaved editor content that replaces the built-in JSON. */
    preview?: import('./lib/context').PreviewData;
  }
}
