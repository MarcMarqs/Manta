import type { Block } from './types';

export interface TocItem {
  /** The id put on the heading, and the href the contents list points at. */
  anchor: string;
  text: string;
}

/** Strips the tags a rich heading might carry, so the contents list shows plain words. */
const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

const slugify = (text: string) =>
  plain(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Every heading on the page, in reading order, including ones nested in sections and columns. */
function walk(blocks: Block[], out: Extract<Block, { type: 'heading' }>[] = []) {
  for (const block of blocks) {
    if (block.type === 'heading') out.push(block);
    else if (block.type === 'section') walk(block.blocks, out);
    else if (block.type === 'columns') for (const col of block.columns) walk(col.blocks, out);
  }
  return out;
}

/**
 * Anchors for every heading on a page, keyed by block id.
 *
 * Built from the whole page at once rather than per heading, because two headings can
 * carry the same words — a case study with a "Result" under each experiment — and the
 * second one has to get its own anchor or the link would always land on the first.
 */
export function headingAnchors(blocks: Block[]): Map<string, string> {
  const anchors = new Map<string, string>();
  const used = new Set<string>();
  for (const heading of walk(blocks)) {
    const base = slugify(heading.text) || heading.id;
    let anchor = base;
    for (let n = 2; used.has(anchor); n++) anchor = `${base}-${n}`;
    used.add(anchor);
    anchors.set(heading.id, anchor);
  }
  return anchors;
}

/**
 * The contents list: top-level sections only. Level 3 and below are the texture inside a
 * section, and listing them turns a glanceable list into a second page of navigation.
 */
export function tocItems(blocks: Block[], anchors: Map<string, string>): TocItem[] {
  return walk(blocks)
    .filter((heading) => heading.level === 2)
    .map((heading) => ({ anchor: anchors.get(heading.id)!, text: plain(heading.text) }))
    .filter((item) => Boolean(item.anchor && item.text));
}
