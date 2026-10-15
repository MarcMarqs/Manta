// The editor may only touch content and images. Even a hijacked session can't
// rewrite the site's code, config or build settings through the API.

const CONTENT_FILE = /^content\/[a-z0-9_-]+(\/[a-z0-9_-]+)*\.json$/;
const IMAGE_FILE = /^public\/images\/[a-z0-9_-]+(\/[a-z0-9_-]+)*\.(png|jpe?g|webp|gif|svg|avif)$/;
// Clips uploaded in the editor. Their own folder, because they are not resized, carry no
// smaller copies, and should be easy to tell apart from the pictures when they pile up.
const VIDEO_FILE = /^public\/videos\/[a-z0-9_-]+(\/[a-z0-9_-]+)*\.(mp4|webm)$/;

export const isContentPath = (path: string) => CONTENT_FILE.test(path);
export const isImagePath = (path: string) => IMAGE_FILE.test(path);
export const isVideoPath = (path: string) => VIDEO_FILE.test(path);
/** Anything uploaded from the editor: pictures and clips alike. */
export const isMediaPath = (path: string) => isImagePath(path) || isVideoPath(path);
export const isEditablePath = (path: string) => isContentPath(path) || isMediaPath(path);

export const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

export const VIDEO_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
};

const extOf = (path: string) => path.split('.').pop()?.toLowerCase() ?? '';

export const imageType = (path: string) => IMAGE_TYPES[extOf(path)] ?? 'application/octet-stream';

/** The uploads folder is the only place names are generated, so `-480` means a copy. */
const VARIANT_SUFFIX = /-(\d{2,5})(\.\w+)$/;

/** `…/shot-480.webp` -> `…/shot.webp`, or null when the name says nothing about a copy. */
export const variantSource = (path: string) => {
  if (!path.startsWith('public/images/uploads/')) return null;
  const base = path.replace(VARIANT_SUFFIX, '$2');
  return base === path ? null : base;
};

/** The width `…-960.webp` stands for. */
export const variantWidth = (path: string) => {
  const m = VARIANT_SUFFIX.exec(path);
  return m ? Number(m[1]) : null;
};

/**
 * Only the pictures, with the smaller copies left out.
 *
 * An upload becomes four files, and listing all four made the library look like it held
 * four pictures — three of them apparently unused, because nothing points at a copy by
 * name. Deleting one of those "spares" takes a width out from under the real picture and
 * leaves the page asking for a file that is no longer there.
 *
 * The manifest is asked first, since it is the record of what was made. The name is the
 * fallback, for an upload from before the manifest existed: a file whose name is another
 * file's name plus a number, in the folder where names are generated, is a copy of it.
 */
export function pictures(paths: string[], manifestJson?: string): string[] {
  const copies = new Set<string>();
  try {
    const manifest = JSON.parse(manifestJson ?? '{}') as Record<string, { sizes?: number[] }>;
    for (const [src, entry] of Object.entries(manifest))
      for (const width of entry.sizes ?? [])
        copies.add(`public${src}`.replace(/\.(\w+)$/, `-${width}.$1`));
  } catch {
    /* An unreadable manifest just means falling back to the names. */
  }
  const all = new Set(paths);
  return paths.filter((p) => {
    if (copies.has(p)) return false;
    const source = variantSource(p);
    return !source || !all.has(source);
  });
}

export const mediaType = (path: string) =>
  IMAGE_TYPES[extOf(path)] ?? VIDEO_TYPES[extOf(path)] ?? 'application/octet-stream';
