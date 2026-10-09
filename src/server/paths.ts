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

export const mediaType = (path: string) =>
  IMAGE_TYPES[extOf(path)] ?? VIDEO_TYPES[extOf(path)] ?? 'application/octet-stream';
