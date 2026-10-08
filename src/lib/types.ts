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
  /** Numerals, cell references and formulas. */
  fontMono: string;
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
  /**
   * Cloudflare Web Analytics token. Counting is cookieless and carries no identifier,
   * which is why the site needs no consent banner — the first thing a visitor would
   * otherwise have to get past. Empty means nothing is measured at all.
   */
  analyticsToken?: string;
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

/** Where the work came from; drives which shelf on the home page it appears in. */
export type ProjectOrigin = 'professional' | 'personal';

/**
 * How much of a project the world gets to see.
 *
 * 'public' is the ordinary state. 'private' is work that cannot be published — under
 * NDA, usually — so it is kept out of every index and its case study is served behind
 * a password, on its own address, to whoever is sent the link. 'draft' is not finished
 * and is not built at all.
 */
export type ProjectVisibility = 'public' | 'private' | 'draft';

export interface Project {
  slug: string;
  title: string;
  genre: string;
  /** null when the date isn't public or isn't settled yet; the UI just omits it. */
  year: number | null;
  role: string;
  summary: string;
  highlights: string[];
  discipline: string[];
  engine: string[];
  cover: string;
  coverVideo: string | null;
  featured: boolean;
  /** Absent means professional — the studio work that leads the page. */
  origin?: ProjectOrigin;
  visibility: ProjectVisibility;
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
  | {
      id: string;
      type: 'heading';
      level: 1 | 2 | 3 | 4;
      text: string;
      /** A numbered section header: "01" above the title, with an optional kicker line. */
      number?: string;
      eyebrow?: string;
    }
  | {
      id: string;
      type: 'text';
      html: string;
      /** Space between the lines of a paragraph. */
      leading?: 'tight' | 'normal' | 'airy';
      /** Space between one paragraph and the next. */
      gap?: 'tight' | 'normal' | 'airy';
    }
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
  /** The strip under a case-study title: role, studio, team size, engine, focus. */
  | { id: string; type: 'specs'; items: { label: string; value: string }[] }
  /** Figures worth stating on their own: years in industry, shipped titles, "~90% solved". */
  | { id: string; type: 'stats'; items: { value: string; label: string }[] }
  | {
      id: string;
      type: 'chart';
      variant: 'bar' | 'line';
      title?: string;
      /** One line under the title, for what the numbers mean or where they came from. */
      note?: string;
      /** Values are computed across this range for any series carrying a formula. */
      range?: { from: number; to: number; step?: number };
      /** A line across the chart to read the bars against: a target, a proposal, a floor. */
      reference?: { value: number; label?: string };
      series: {
        name?: string;
        /** Expression in `x`, e.g. "round(90 * pow(1.28, x - 75))". Needs `range`. */
        formula?: string;
        /** Print every value on its mark. An emphasised point prints its own regardless. */
        labels?: boolean;
        data?: {
          label: string;
          value: number;
          /** Lift one point out of the series, or push it back. */
          emphasis?: 'accent' | 'muted';
        }[];
      }[];
    }
  /** Short callout boxes for the principles a piece of work was built on. */
  | { id: string; type: 'pillars'; items: { label: string; body: string }[] }
  /** Sensitivity: how far an outcome swings when one input moves low or high. */
  | {
      id: string;
      type: 'tornado';
      title?: string;
      unit?: string;
      lowLabel?: string;
      highLabel?: string;
      rows: { label: string; low: number; high: number }[];
    }
  /** A few labelled nodes and the arrows between them. */
  | {
      id: string;
      type: 'flow';
      caption?: string;
      nodes: { id: string; label: string; accent?: boolean }[];
      edges: { from: string; to: string }[];
    }
  /**
   * A system drawn as nodes and the links between them.
   *
   * Positions are derived, never authored: 'radial' puts the first node at the centre
   * and arranges the rest around it, 'layered' runs them left to right in the columns
   * their layer names. A diagram that needs hand-placed coordinates is a drawing, and
   * belongs in an image block instead of here.
   */
  | {
      id: string;
      type: 'systemMap';
      arrange?: 'radial' | 'layered';
      caption?: string;
      nodes: { id: string; label: string; note?: string; accent?: boolean; layer?: number }[];
      links: { from: string; to: string; label?: string; dashed?: boolean }[];
    }
  /** The same measures compared across several things — archetypes against one stat line. */
  | {
      id: string;
      type: 'radar';
      title?: string;
      axes: string[];
      /** The outer ring. Left out, it comes from the largest value present. */
      max?: number;
      series: { name?: string; values: number[] }[];
    }
  | { id: string; type: 'columns'; count: 2 | 3; columns: { id: string; blocks: Block[] }[] }
  | {
      id: string;
      type: 'section';
      background?: 'none' | 'surface' | 'accent';
      /** 'row' lays the blocks inside side by side, wrapping when they run out of room. */
      arrange?: 'stack' | 'row';
      blocks: Block[];
    }
  | { id: string; type: 'projectRail'; filters?: boolean; origin?: ProjectOrigin }
  | { id: string; type: 'projectGrid'; filters?: boolean; origin?: ProjectOrigin }
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
  /** false hides the floating contents list, which otherwise appears on long pages. */
  toc?: boolean;
  blocks: Block[];
}
