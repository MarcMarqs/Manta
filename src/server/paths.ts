// The editor may only touch content and images. Even a hijacked session can't
// rewrite the site's code, config or build settings through the API.

const CONTENT_FILE = /^content\/[a-z0-9_-]+(\/[a-z0-9_-]+)*\.json$/;
const IMAGE_FILE = /^public\/images\/[a-z0-9_-]+(\/[a-z0-9_-]+)*\.(png|jpe?g|webp|gif|svg|avif)$/;

export const isContentPath = (path: string) => CONTENT_FILE.test(path);
export const isImagePath = (path: string) => IMAGE_FILE.test(path);
export const isEditablePath = (path: string) => isContentPath(path) || isImagePath(path);

export const IMAGE_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

export const imageType = (path: string) =>
  IMAGE_TYPES[path.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';
