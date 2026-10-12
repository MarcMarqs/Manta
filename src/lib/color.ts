/**
 * Contrast arithmetic, shared by the site and the editor.
 *
 * The site lets anyone pick an accent, and the same hex has to work on a white page and
 * on a near-black one. A green bright enough to glow on #14171c measures 1.3:1 on white,
 * which is not a readable colour — it is a stain. So rather than trusting a single pick,
 * both themes derive a colour that is legible against their own background, and the
 * editor shows what each one measures.
 */

const hexOf = (value: string): string | null => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!m) return null;
  return m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
};

const rgbOf = (hex: string): [number, number, number] => {
  const full = hexOf(hex) ?? '000000';
  return [0, 1, 2].map((i) => parseInt(full.slice(i * 2, i * 2 + 2), 16)) as [number, number, number];
};

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const channel = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgbOf(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Text needs 4.5:1; large text, icons and borders get by on 3:1. */
export const READABLE = 4.5;

const toHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = rgbOf(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
};

const toHex = (h: number, s: number, l: number): string => {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};

/**
 * The nearest version of a colour that can be read against a given background.
 *
 * Hue and saturation are kept, so the result is still recognisably the colour that was
 * picked; only lightness moves, and only as far as it has to — toward black on a light
 * background, toward white on a dark one. A colour that already passes is returned
 * untouched, which is why setting this up changes nothing for a theme that was already
 * legible.
 */
export function legibleOn(color: string, background: string, target = READABLE): string {
  if (!hexOf(color) || !hexOf(background)) return color;
  if (contrast(color, background) >= target) return color;

  const [h, s, l] = toHsl(color);
  const darken = luminance(background) > 0.18;
  for (let step = 1; step <= 100; step++) {
    const next = darken ? l - step / 100 : l + step / 100;
    if (next < 0 || next > 1) break;
    const candidate = toHex(h, s, next);
    if (contrast(candidate, background) >= target) return candidate;
  }
  // Nothing in this hue reaches the target: fall back to whichever end is further away.
  return darken ? '#000000' : '#ffffff';
}

/** Black or white, whichever can be read on top of a colour. */
export function onColor(color: string): string {
  return contrast('#ffffff', color) >= contrast('#10131a', color) ? '#ffffff' : '#10131a';
}
