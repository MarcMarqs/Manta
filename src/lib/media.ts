import manifest from '../../content/media.json';

/**
 * Uploaded pictures are saved in a few widths, so phones don't download a desktop-sized
 * image. content/media.json records what exists: the file itself is the largest, and the
 * smaller ones sit beside it as `name-480.webp`. Images added before this, or linked from
 * elsewhere, simply have no entry and render as a plain single image.
 */
interface Entry {
  /** Intrinsic width of the file at `src`. */
  w: number;
  /** Widths of the smaller copies stored next to it. */
  sizes: number[];
}

const media = manifest as Record<string, Entry>;

/**
 * A focal point is only ever two percentages.
 *
 * It ends up inside a style attribute, so whatever was typed into the editor is checked
 * against that shape rather than trusted: anything else is dropped and the picture
 * centres, which is where it sat before the setting existed.
 */
export function focusPoint(value: string | undefined): string | undefined {
  return value && /^\d{1,3}% \d{1,3}%$/.test(value) ? value : undefined;
}

export const variantPath = (src: string, width: number) => src.replace(/\.(\w+)$/, `-${width}.$1`);

/** `srcset` for an uploaded image, or undefined when there is only one copy. */
export function srcsetFor(src: string): string | undefined {
  const entry = media[src];
  if (!entry?.sizes.length) return undefined;
  return [...entry.sizes.map((w) => `${variantPath(src, w)} ${w}w`), `${src} ${entry.w}w`].join(', ');
}

export const widthOf = (src: string) => media[src]?.w;
