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

/** One entry in a page's block array. Nested blocks live in `section` and `columns`. */
export type Block =
  | { id: string; type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { id: string; type: 'text'; html: string }
  | { id: string; type: 'image'; src: string; alt: string; caption?: string; width?: 'content' | 'wide' }
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
  | { id: string; type: 'html'; html: string };

export type BlockType = Block['type'];

export interface Page {
  /** Route path, derived from the file name: home.json -> "/", work/dunes.json -> "/work/dunes" */
  path: string;
  /** File name without extension, as stored in content/pages/ */
  slug: string;
  title: string;
  description?: string;
  /** Slug of the project this page is a case study for, if any. */
  project?: string;
  blocks: Block[];
}
