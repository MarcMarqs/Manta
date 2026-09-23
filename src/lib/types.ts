export interface Theme {
  accent: string;
  bg: string;
  fg: string;
  muted: string;
  surface: string;
  border: string;
  bgDark: string;
  fgDark: string;
  mutedDark: string;
  surfaceDark: string;
  borderDark: string;
  /** A family name from src/lib/fonts.ts, or "system-ui". */
  fontHeading: string;
  fontBody: string;
  radius: string;
  maxWidth: string;
  spacing: number;
}

export interface Site {
  /** Public address of the site, used for canonical URLs, the sitemap and link previews. */
  url?: string;
  /** Default picture shown when a link to the site is shared. */
  socialImage?: string;
  name: string;
  tagline: string;
  footer: string;
  nav: { label: string; href: string }[];
  theme: Theme;
}

export interface Tag {
  id: string;
  label: string;
}

export interface Tags {
  discipline: Tag[];
  engine: Tag[];
}

export interface ProjectLink {
  type: 'play' | 'source' | 'doc';
  label: string;
  href: string;
}

export interface Project {
  slug: string;
  title: string;
  genre: string;
  year: number;
  role: string;
  summary: string;
  highlights: string[];
  discipline: string[];
  engine: string[];
  cover: string;
  coverVideo: string | null;
  featured: boolean;
  draft: boolean;
  links: ProjectLink[];
}

export type Align = 'left' | 'center' | 'right';
/** normal = the content column; wide and full reach past it (top-level blocks only). */
export type BlockWidth = 'narrow' | 'normal' | 'wide' | 'full';

/** Placement options every block can carry. Both are optional; absent means left / normal. */
export interface BlockLayout {
  align?: Align;
  width?: BlockWidth;
}

/** One entry in a page's block array. Nested blocks live in `section` and `columns`. */
export type Block = BlockLayout & (
  | { id: string; type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { id: string; type: 'text'; html: string }
  | {
      id: string;
      type: 'image';
      src: string;
      alt: string;
      caption?: string;
      /** Percentage of the block's width, 10-100. Absent means full width. */
      scale?: number;
      /** Crop shape. Absent or 'auto' keeps the picture's own proportions. */
      aspect?: 'auto' | '1:1' | '4:3' | '3:2' | '16:9' | '21:9';
    }
  | { id: string; type: 'gallery'; images: { src: string; alt: string }[] }
  | { id: string; type: 'video'; provider: 'youtube' | 'vimeo' | 'itch'; videoId: string; title?: string }
  | { id: string; type: 'button'; label: string; href: string; style?: 'primary' | 'secondary' }
  | { id: string; type: 'divider' }
  | { id: string; type: 'spacer'; size?: 'sm' | 'md' | 'lg' }
  | { id: string; type: 'table'; caption?: string; columns: string[]; rows: string[][] }
  | { id: string; type: 'chart'; variant: 'bar' | 'line'; title?: string; series: { label: string; value: number }[] }
  | { id: string; type: 'columns'; count: 2 | 3; columns: { id: string; blocks: Block[] }[] }
  | { id: string; type: 'section'; background?: 'none' | 'surface' | 'accent'; blocks: Block[] }
  | { id: string; type: 'projectRail'; filters?: boolean }
  | { id: string; type: 'projectGrid'; filters?: boolean }
  | { id: string; type: 'html'; html: string }
);

export type BlockType = Block['type'];

export interface Page {
  /** Route path, derived from the file name: home.json -> "/", work/dunes.json -> "/work/dunes" */
  path: string;
  /** File name without extension, as stored in content/pages/ */
  slug: string;
  title: string;
  description?: string;
  /** Picture for this page's link previews. Falls back to the project cover, then the site's. */
  image?: string;
  /** Slug of the project this page is a case study for, if any. */
  project?: string;
  blocks: Block[];
}
