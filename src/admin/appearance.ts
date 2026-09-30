import { signal } from '@preact/signals';

/**
 * How the editor itself looks.
 *
 * Shipwreck's arrangement, and the same five accents: black and green is the identity
 * and the ground stays put — what you choose is which colour marks the live thing. The
 * stored value is the accent's *name* rather than a hex, which is what lets one entry
 * repaint both themes.
 *
 * The line between this and Site & theme is the one Shipwreck draws: a setting that
 * follows *you* lives here, a setting that belongs to the work lives with the work. So
 * this is kept in the browser and never committed, while the site's own colours and
 * fonts are content and travel with the repo.
 */

export type Theme = 'dark' | 'light' | 'system';
export type Accent = 'green' | 'gold' | 'rust' | 'steel' | 'violet';

/** Two hexes each: a colour bright enough to carry on black is unreadable on paper. */
export const ACCENTS: { key: Accent; label: string; dark: string; light: string }[] = [
  { key: 'green', label: 'Green', dark: '#3fe082', light: '#12703c' },
  { key: 'gold', label: 'Gold', dark: '#e0b23f', light: '#8a6a10' },
  { key: 'rust', label: 'Rust', dark: '#e0663f', light: '#a8401d' },
  { key: 'steel', label: 'Steel', dark: '#3fa8e0', light: '#1a6b96' },
  { key: 'violet', label: 'Violet', dark: '#a97fe0', light: '#6a48a8' },
];

export interface Appearance {
  theme: Theme;
  accent: Accent;
  /** Show the block list packed tighter, for pages with a lot of blocks. */
  dense: boolean;
}

const DEFAULTS: Appearance = { theme: 'dark', accent: 'green', dense: false };
const KEY = 'manta.look';

export const appearance = signal<Appearance>(DEFAULTS);

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Toward black on the dark theme, toward white on the light one. */
const fade = (hex: string, toward: 0 | 255, amount: number) =>
  `rgb(${rgb(hex)
    .map((c) => Math.round(c + (toward - c) * amount))
    .join(' ')})`;

export const accentOf = (key: Accent) => ACCENTS.find((a) => a.key === key) ?? ACCENTS[0];

const prefersLight = () => matchMedia('(prefers-color-scheme: light)').matches;

/** Which theme is actually on screen, once "system" has been resolved. */
export const resolvedTheme = (look: Appearance): 'dark' | 'light' =>
  look.theme === 'system' ? (prefersLight() ? 'light' : 'dark') : look.theme;

/**
 * The theme class, then the tokens the accent decides. The soft wash is the accent at
 * low alpha — it is how the colour shows up at the edges of things, so an accent that
 * skipped it would only be half-changed.
 */
export function paint(look: Appearance) {
  const root = document.documentElement;
  const light = resolvedTheme(look) === 'light';
  root.classList.toggle('e-light', light);
  root.classList.toggle('e-dark', !light);
  root.classList.toggle('e-dense', look.dense);

  const hex = light ? accentOf(look.accent).light : accentOf(look.accent).dark;
  const [r, g, b] = rgb(hex);
  root.style.setProperty('--e-accent', hex);
  root.style.setProperty('--e-accent-soft', `rgb(${r} ${g} ${b} / ${light ? 0.1 : 0.14})`);
  root.style.setProperty('--e-accent-fg', light ? '#ffffff' : '#070a09');
  root.style.setProperty('--e-publish', hex);
  root.style.setProperty('--e-ok', hex);
  root.style.setProperty('--e-accent-dim', fade(hex, light ? 255 : 0, light ? 0.6 : 0.55));
}

function remember(look: Appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(look));
  } catch {
    /* A preference that cannot be kept costs the next visit, not any content. */
  }
}

/** Called once before the editor renders, so the first frame is already right. */
export function loadAppearance() {
  let look = DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) look = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Appearance>) };
  } catch {
    /* Unreadable storage just means the defaults. */
  }
  appearance.value = look;
  paint(look);
  // "System" has to keep listening; the other two are decisions already made.
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (appearance.value.theme === 'system') paint(appearance.value);
  });
}

export function setAppearance(patch: Partial<Appearance>) {
  appearance.value = { ...appearance.value, ...patch };
  paint(appearance.value);
  remember(appearance.value);
}
