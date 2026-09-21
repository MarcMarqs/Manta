import type { Block, BlockType } from '../lib/types';
import { newId } from './store';

interface BlockSpec {
  label: string;
  group: 'Text & media' | 'Data' | 'Layout' | 'Advanced';
  hint: string;
  create: () => Block;
}

export const BLOCKS: Record<BlockType, BlockSpec> = {
  heading: {
    label: 'Heading',
    group: 'Text & media',
    hint: 'Section title',
    create: () => ({ id: newId(), type: 'heading', level: 2, text: 'New heading' }),
  },
  text: {
    label: 'Text',
    group: 'Text & media',
    hint: 'Paragraphs, lists, links',
    create: () => ({ id: newId(), type: 'text', html: '<p>Write something…</p>' }),
  },
  image: {
    label: 'Image',
    group: 'Text & media',
    hint: 'One picture with a caption',
    create: () => ({ id: newId(), type: 'image', src: '', alt: '', caption: '', width: 'content' }),
  },
  gallery: {
    label: 'Gallery',
    group: 'Text & media',
    hint: 'A grid of images',
    create: () => ({ id: newId(), type: 'gallery', images: [] }),
  },
  video: {
    label: 'Video',
    group: 'Text & media',
    hint: 'YouTube, Vimeo or itch.io',
    create: () => ({ id: newId(), type: 'video', provider: 'youtube', videoId: '', title: '' }),
  },
  button: {
    label: 'Button',
    group: 'Text & media',
    hint: 'Link to a page or site',
    create: () => ({ id: newId(), type: 'button', label: 'Button', href: '/', style: 'primary' }),
  },
  table: {
    label: 'Table',
    group: 'Data',
    hint: 'Rows and columns',
    create: () => ({
      id: newId(),
      type: 'table',
      caption: '',
      columns: ['Column A', 'Column B'],
      rows: [
        ['', ''],
        ['', ''],
      ],
    }),
  },
  chart: {
    label: 'Chart',
    group: 'Data',
    hint: 'Bar or line chart',
    create: () => ({
      id: newId(),
      type: 'chart',
      variant: 'bar',
      title: '',
      series: [
        { label: 'A', value: 10 },
        { label: 'B', value: 20 },
        { label: 'C', value: 15 },
      ],
    }),
  },
  section: {
    label: 'Section',
    group: 'Layout',
    hint: 'Group blocks, optional background',
    create: () => ({ id: newId(), type: 'section', background: 'surface', blocks: [] }),
  },
  columns: {
    label: 'Columns',
    group: 'Layout',
    hint: 'Side-by-side blocks',
    create: () => ({
      id: newId(),
      type: 'columns',
      count: 2,
      columns: [
        { id: newId('col'), blocks: [] },
        { id: newId('col'), blocks: [] },
      ],
    }),
  },
  divider: {
    label: 'Divider',
    group: 'Layout',
    hint: 'Horizontal line',
    create: () => ({ id: newId(), type: 'divider' }),
  },
  spacer: {
    label: 'Spacer',
    group: 'Layout',
    hint: 'Empty vertical space',
    create: () => ({ id: newId(), type: 'spacer', size: 'md' }),
  },
  projectRail: {
    label: 'Project rail',
    group: 'Layout',
    hint: 'Expandable carousel of projects',
    create: () => ({ id: newId(), type: 'projectRail', filters: true }),
  },
  projectGrid: {
    label: 'Project grid',
    group: 'Layout',
    hint: 'Grid of project cards',
    create: () => ({ id: newId(), type: 'projectGrid', filters: false }),
  },
  html: {
    label: 'HTML',
    group: 'Advanced',
    hint: 'Raw HTML or embed code',
    create: () => ({ id: newId(), type: 'html', html: '' }),
  },
};

export const GROUPS = ['Text & media', 'Data', 'Layout', 'Advanced'] as const;

const stripTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

/** One-line description of a block's content, shown on its collapsed card. */
export function summarize(block: Block): string {
  switch (block.type) {
    case 'heading':
      return stripTags(block.text);
    case 'text':
      return stripTags(block.html);
    case 'image':
      return block.caption || block.alt || block.src.split('/').pop() || 'No image yet';
    case 'gallery':
      return `${block.images.length} image${block.images.length === 1 ? '' : 's'}`;
    case 'video':
      return block.videoId ? `${block.provider} · ${block.videoId}` : 'No video yet';
    case 'button':
      return `${block.label} → ${block.href}`;
    case 'table':
      return block.caption || `${block.columns.length} × ${block.rows.length}`;
    case 'chart':
      return block.title || `${block.variant} chart, ${block.series.length} values`;
    case 'section': {
      const n = block.blocks.length;
      return `${n} block${n === 1 ? '' : 's'}${block.background && block.background !== 'none' ? ` · ${block.background}` : ''}`;
    }
    case 'columns':
      return `${block.count} columns`;
    case 'spacer':
      return block.size ?? 'md';
    case 'projectRail':
    case 'projectGrid':
      return block.filters ? 'With filters' : 'No filters';
    case 'html':
      return stripTags(block.html) || block.html.slice(0, 60) || 'Empty';
    default:
      return '';
  }
}

/** Fresh ids throughout, so a duplicated block never collides with its original. */
export function cloneBlock(block: Block): Block {
  const copy = structuredClone(block) as Block;
  const renew = (b: Block) => {
    b.id = newId();
    if (b.type === 'section') b.blocks.forEach(renew);
    if (b.type === 'columns')
      b.columns.forEach((c) => {
        c.id = newId('col');
        c.blocks.forEach(renew);
      });
  };
  renew(copy);
  return copy;
}

/** Ids of the blocks containing `id` (outermost first), or null if it isn't in the tree. */
export function ancestorsOf(blocks: Block[], id: string, trail: string[] = []): string[] | null {
  for (const b of blocks) {
    if (b.id === id) return trail;
    const children =
      b.type === 'section' ? [b.blocks] : b.type === 'columns' ? b.columns.map((c) => c.blocks) : [];
    for (const list of children) {
      const found = ancestorsOf(list, id, [...trail, b.id]);
      if (found) return found;
    }
  }
  return null;
}

/** Pulls an id out of a pasted YouTube/Vimeo URL; returns the input unchanged if it's already an id. */
export function parseVideoInput(input: string): { provider?: 'youtube' | 'vimeo'; id: string } {
  const value = input.trim();
  const yt = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { provider: 'youtube', id: yt[1] };
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { provider: 'vimeo', id: vimeo[1] };
  return { id: value };
}
