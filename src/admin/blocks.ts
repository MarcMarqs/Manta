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
    create: () => ({ id: newId(), type: 'image', src: '', alt: '', caption: '' }),
  },
  gallery: {
    label: 'Gallery',
    group: 'Text & media',
    hint: 'A grid of images, or a carousel to click through',
    create: () => ({ id: newId(), type: 'gallery', images: [] }),
  },
  video: {
    label: 'Video',
    group: 'Text & media',
    hint: 'YouTube, Vimeo or itch.io',
    create: () => ({ id: newId(), type: 'video', provider: 'youtube', videoId: '', title: '' }),
  },
  doc: {
    label: 'Document',
    group: 'Data',
    hint: 'A Google Doc, live on the page',
    create: () => ({ id: newId(), type: 'doc', source: 'file', docId: '', height: 'medium' }),
  },
  sheet: {
    label: 'Spreadsheet',
    group: 'Data',
    hint: 'A Google Sheet, live on the page',
    create: () => ({ id: newId(), type: 'sheet', source: 'file', sheetId: '', height: 'medium' }),
  },
  button: {
    label: 'Button',
    group: 'Text & media',
    hint: 'Link to a page or site',
    create: () => ({ id: newId(), type: 'button', label: 'Button', href: '/', style: 'primary' }),
  },
  specs: {
    label: 'Spec strip',
    group: 'Data',
    hint: 'Role, studio, engine — a row of label/value pairs',
    create: () => ({
      id: newId(),
      type: 'specs',
      items: [
        { label: 'Role', value: '' },
        { label: 'Studio', value: '' },
        { label: 'Engine', value: '' },
      ],
    }),
  },
  stats: {
    label: 'Figures',
    group: 'Data',
    hint: 'Big numbers with a caption each',
    create: () => ({
      id: newId(),
      type: 'stats',
      items: [
        { value: '', label: '' },
        { value: '', label: '' },
      ],
    }),
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
        {
          data: [
            { label: 'A', value: 10 },
            { label: 'B', value: 20 },
            { label: 'C', value: 15 },
          ],
        },
      ],
    }),
  },
  pillars: {
    label: 'Pillars',
    group: 'Data',
    hint: 'Short callout boxes for principles',
    create: () => ({
      id: newId(),
      type: 'pillars',
      items: [
        { label: '', body: '' },
        { label: '', body: '' },
      ],
    }),
  },
  tornado: {
    label: 'Sensitivity',
    group: 'Data',
    hint: 'How far an outcome swings per input',
    create: () => ({
      id: newId(),
      type: 'tornado',
      title: '',
      unit: '',
      lowLabel: 'Low',
      highLabel: 'High',
      rows: [{ label: '', low: 0, high: 0 }],
    }),
  },
  flow: {
    label: 'Flow diagram',
    group: 'Data',
    hint: 'Labelled nodes joined by arrows',
    create: () => ({
      id: newId(),
      type: 'flow',
      caption: '',
      nodes: [
        { id: 'a', label: 'First' },
        { id: 'b', label: 'Second' },
      ],
      edges: [{ from: 'a', to: 'b' }],
    }),
  },
  systemMap: {
    label: 'System map',
    group: 'Data',
    hint: 'Nodes and the links between them',
    create: () => ({
      id: newId(),
      type: 'systemMap',
      arrange: 'radial',
      caption: '',
      nodes: [
        { id: 'a', label: 'Core', accent: true },
        { id: 'b', label: 'Feeds in' },
        { id: 'c', label: 'Feeds out' },
      ],
      links: [
        { from: 'b', to: 'a' },
        { from: 'a', to: 'c' },
      ],
    }),
  },
  radar: {
    label: 'Radar chart',
    group: 'Data',
    hint: 'Several things across the same measures',
    create: () => ({
      id: newId(),
      type: 'radar',
      title: '',
      axes: ['Damage', 'Range', 'Speed', 'Health', 'Control'],
      series: [{ name: '', values: [0, 0, 0, 0, 0] }],
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
      return [block.number, block.eyebrow, stripTags(block.text)].filter(Boolean).join(' · ');
    case 'text':
      return stripTags(block.html);
    case 'image':
      return block.caption || block.alt || block.src.split('/').pop() || 'No image yet';
    case 'gallery':
      return `${block.images.length} image${block.images.length === 1 ? '' : 's'}${block.layout === 'carousel' ? ' · carousel' : ''}`;
    case 'video':
      return block.videoId ? `${block.provider} · ${block.videoId}` : 'No video yet';
    case 'button':
      return `${block.label} → ${block.href}`;
    case 'sheet':
      return block.sheetId ? block.caption || block.title || 'Google Sheet' : 'No spreadsheet yet';
    case 'doc':
      return block.docId ? block.caption || block.title || 'Google Doc' : 'No document yet';
    case 'table':
      return block.caption || `${block.columns.length} × ${block.rows.length}`;
    case 'specs':
      return block.items.map((i) => i.label).filter(Boolean).join(' · ') || 'Empty';
    case 'stats':
      return block.items.map((i) => i.value).filter(Boolean).join(' · ') || 'Empty';
    case 'chart': {
      const points = block.series.reduce((n, s) => n + (s.formula ? 1 : (s.data?.length ?? 0)), 0);
      const computed = block.series.some((s) => s.formula);
      return block.title || `${block.variant} chart · ${computed ? 'from a formula' : `${points} values`}`;
    }
    case 'pillars':
      return block.items.map((i) => i.label).filter(Boolean).join(' · ') || 'Empty';
    case 'tornado':
      return block.title || `${block.rows.length} row${block.rows.length === 1 ? '' : 's'}`;
    case 'flow':
      return block.caption || `${block.nodes.length} nodes, ${block.edges.length} arrows`;
    case 'systemMap':
      return block.caption || `${block.nodes.length} nodes, ${block.links.length} links · ${block.arrange ?? 'radial'}`;
    case 'radar':
      return block.title || `${block.axes.length} axes, ${block.series.length} series`;
    case 'section': {
      const n = block.blocks.length;
      const notes = [
        block.arrange === 'row' ? 'side by side' : '',
        block.background && block.background !== 'none' ? block.background : '',
      ].filter(Boolean);
      return `${n} block${n === 1 ? '' : 's'}${notes.length ? ` · ${notes.join(' · ')}` : ''}`;
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
/**
 * Pulls the id and tab out of whatever Google Sheets address was pasted.
 *
 * Two shapes exist and they are not interchangeable: an ordinary document lives at
 * /spreadsheets/d/<id>, while one put through Publish to web gets a second, different id
 * at /spreadsheets/d/e/<id>. The /e/ has to be tested for first, or the plain pattern
 * matches it and takes "e" for the id.
 */
export function parseSheetInput(input: string): { source?: 'file' | 'published'; sheetId: string; gid?: string } {
  const value = input.trim();
  const gid = value.match(/[?#&]gid=(\d+)/)?.[1];
  const published = value.match(/spreadsheets\/d\/e\/([\w-]+)/);
  if (published) return { source: 'published', sheetId: published[1], gid };
  const file = value.match(/spreadsheets\/d\/([\w-]+)/);
  if (file) return { source: 'file', sheetId: file[1], gid };
  return { sheetId: value, gid };
}

/**
 * Pulls the id out of whatever Google Docs address was pasted.
 *
 * Same two shapes as a spreadsheet: an ordinary document at /document/d/<id>, and one
 * put through Publish to web at /document/d/e/<id>, which is a different id entirely.
 * The /e/ is tested for first, or the plain pattern matches it and takes "e" for the id.
 */
export function parseDocInput(input: string): { source?: 'file' | 'published'; docId: string } {
  const value = input.trim();
  const published = value.match(/document\/d\/e\/([\w-]+)/);
  if (published) return { source: 'published', docId: published[1] };
  const file = value.match(/document\/d\/([\w-]+)/);
  if (file) return { source: 'file', docId: file[1] };
  return { docId: value };
}

export function parseVideoInput(input: string): { provider?: 'youtube' | 'vimeo'; id: string } {
  const value = input.trim();
  const yt = value.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { provider: 'youtube', id: yt[1] };
  const vimeo = value.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { provider: 'vimeo', id: vimeo[1] };
  return { id: value };
}
