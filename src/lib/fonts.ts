// Curated Google Fonts the theme editor offers. Weights must match what Google
// actually serves for each family: asking for a missing weight fails the whole request.
export const FONTS: { name: string; weights: string; kind: 'sans' | 'serif' | 'mono' | 'display' }[] = [
  { name: 'Inter', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Space Grotesk', weights: '400;500;600;700', kind: 'sans' },
  { name: 'DM Sans', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Manrope', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Outfit', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Sora', weights: '400;500;600;700', kind: 'sans' },
  { name: 'IBM Plex Sans', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Work Sans', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Rubik', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Archivo', weights: '400;500;600;700', kind: 'sans' },
  { name: 'Syne', weights: '400;500;600;700', kind: 'display' },
  { name: 'Chakra Petch', weights: '400;500;600;700', kind: 'display' },
  { name: 'Rajdhani', weights: '400;500;600;700', kind: 'display' },
  { name: 'Orbitron', weights: '400;500;600;700', kind: 'display' },
  { name: 'Oswald', weights: '400;500;600;700', kind: 'display' },
  { name: 'Bebas Neue', weights: '400', kind: 'display' },
  { name: 'Press Start 2P', weights: '400', kind: 'display' },
  { name: 'VT323', weights: '400', kind: 'display' },
  { name: 'Fraunces', weights: '400;500;600;700', kind: 'serif' },
  { name: 'Playfair Display', weights: '400;500;600;700', kind: 'serif' },
  { name: 'Lora', weights: '400;500;600;700', kind: 'serif' },
  { name: 'Source Serif 4', weights: '400;500;600;700', kind: 'serif' },
  { name: 'JetBrains Mono', weights: '400;500;600;700', kind: 'mono' },
  { name: 'Space Mono', weights: '400;700', kind: 'mono' },
];

export const SYSTEM_FONT = 'system-ui';

const fallback = (name: string) => {
  const kind = FONTS.find((f) => f.name === name)?.kind;
  return kind === 'serif' ? 'Georgia, serif' : kind === 'mono' ? 'ui-monospace, monospace' : 'system-ui, sans-serif';
};

/** CSS font-family value for a theme font name. */
export function fontStack(name: string): string {
  if (!name || name === SYSTEM_FONT) return 'system-ui, sans-serif';
  return `'${name}', ${fallback(name)}`;
}

/** One Google Fonts stylesheet URL covering every font the theme uses, or null for system fonts only. */
export function googleFontsHref(names: string[]): string | null {
  const families = [...new Set(names)].filter((n) => n && n !== SYSTEM_FONT);
  if (!families.length) return null;
  const params = families.map((name) => {
    const weights = FONTS.find((f) => f.name === name)?.weights;
    const family = name.replace(/ /g, '+');
    return `family=${family}${weights ? `:wght@${weights}` : ''}`;
  });
  return `https://fonts.googleapis.com/css2?${params.join('&')}&display=swap`;
}
