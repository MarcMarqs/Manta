import type { Block } from '../lib/types';
import { newId } from './store';

/**
 * Markdown in, blocks out.
 *
 * Not a Markdown renderer: Manta's pages are blocks, so this is a translation, and the
 * things Markdown cannot say — a chart, a project rail, a spec strip — stay things you
 * add afterwards. What it does cover is the shape most writing arrives in: headings,
 * prose, lists, links, pictures, tables, rules and code.
 *
 * Consecutive prose is gathered into one text block rather than one per paragraph. A
 * page of thirty single-paragraph blocks is technically the same page and miserable to
 * edit; a heading, a picture, a table or a rule is what ends a run.
 */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Inline markup, after escaping.
 *
 * Code spans are pulled out first and put back last, so the asterisks and underscores
 * inside `a_b_c` stay the characters they are instead of becoming emphasis.
 */
export function inline(text: string): string {
  const codes: string[] = [];
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });

  out = out
    // A picture inside a line of prose, rather than one standing alone.
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, alt: string, src: string) => `<img src="${src}" alt="${alt}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_, label: string, href: string) => `<a href="${href}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*)_/g, '$1<em>$2</em>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>');

  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${codes[Number(i)]}</code>`);
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^(-{3,}|\*{3,}|_{3,})\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBER = /^\s*\d+[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;
const IMAGE_ONLY = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/;
const FENCE = /^(```|~~~)(.*)$/;
const TABLE_RULE = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;
const ALERT = /^\[!(\w+)\]\s*$/;
/** GitHub's five names, mapped onto the four kinds of attention a callout can ask for. */
const ALERT_TONE: Record<string, 'note' | 'key' | 'caution' | 'result'> = {
  NOTE: 'note',
  TIP: 'result',
  IMPORTANT: 'key',
  WARNING: 'caution',
  CAUTION: 'caution',
};

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    // A table cell is plain text, and Markdown has no way to break a line inside one
    // except the <br> GFM allows. That is a line break, so it arrives as one.
    .map((c) => c.trim().replace(/<br\s*\/?>/gi, '\n'));

export interface Imported {
  /** The first level-1 heading, which is what the page is called. */
  title?: string;
  blocks: Block[];
}

export function blocksFromMarkdown(source: string): Imported {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let title: string | undefined;

  // Prose accumulates here as HTML until something that is not prose ends the run.
  let run: string[] = [];
  const flush = () => {
    if (!run.length) return;
    blocks.push({ id: newId('b'), type: 'text', html: run.join('') });
    run = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) continue;

    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const body: string[] = [];
      const close = fence[1];
      for (i++; i < lines.length && !lines[i].startsWith(close); i++) body.push(lines[i]);
      blocks.push({
        id: newId('b'),
        type: 'text',
        html: `<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`,
      });
      continue;
    }

    if (RULE.test(line)) {
      flush();
      blocks.push({ id: newId('b'), type: 'divider' });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const level = Math.min(heading[1].length, 4) as 1 | 2 | 3 | 4;
      const text = inline(heading[2].replace(/\s+#+\s*$/, ''));
      if (level === 1 && !title) title = heading[2].replace(/\s+#+\s*$/, '').trim();
      blocks.push({ id: newId('b'), type: 'heading', level, text });
      continue;
    }

    const picture = IMAGE_ONLY.exec(line.trim());
    if (picture) {
      flush();
      blocks.push({
        id: newId('b'),
        type: 'image',
        src: picture[2],
        alt: picture[1],
        ...(picture[3] ? { caption: picture[3] } : {}),
      });
      continue;
    }

    // A table is a header row, a row of dashes, then the body.
    if (line.includes('|') && TABLE_RULE.test(lines[i + 1] ?? '')) {
      flush();
      const columns = cells(line);
      const rows: string[][] = [];
      for (i += 2; i < lines.length && lines[i].includes('|') && lines[i].trim(); i++) rows.push(cells(lines[i]));
      i--;
      blocks.push({ id: newId('b'), type: 'table', columns, rows });
      continue;
    }

    const bullet = BULLET.exec(line);
    const numbered = !bullet && NUMBER.exec(line);
    if (bullet || numbered) {
      const tag = bullet ? 'ul' : 'ol';
      const items: string[] = [];
      for (; i < lines.length; i++) {
        const m = (tag === 'ul' ? BULLET : NUMBER).exec(lines[i]);
        if (!m) break;
        items.push(`<li>${inline(m[1])}</li>`);
      }
      i--;
      run.push(`<${tag}>${items.join('')}</${tag}>`);
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      const said: string[] = [];
      for (; i < lines.length; i++) {
        const m = QUOTE.exec(lines[i]);
        if (!m) break;
        said.push(m[1]);
      }
      i--;
      // GitHub writes an admonition as a quote whose first line names it. That is a
      // callout, which the page already knows how to draw, rather than a quotation.
      const alert = ALERT.exec(said[0] ?? '');
      if (alert) {
        flush();
        blocks.push({
          id: newId('b'),
          type: 'callout',
          tone: ALERT_TONE[alert[1].toUpperCase()] ?? 'note',
          html: `<p>${inline(said.slice(1).join(' ').trim())}</p>`,
        });
        continue;
      }
      run.push(`<blockquote><p>${inline(said.join(' ').trim())}</p></blockquote>`);
      continue;
    }

    // Prose: a paragraph runs until a blank line or something that is not prose.
    const paragraph: string[] = [];
    for (; i < lines.length; i++) {
      const next = lines[i];
      if (
        !next.trim() ||
        HEADING.test(next) ||
        RULE.test(next) ||
        BULLET.test(next) ||
        NUMBER.test(next) ||
        QUOTE.test(next) ||
        FENCE.test(next)
      )
        break;
      paragraph.push(next.trim());
    }
    i--;
    if (paragraph.length) run.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }

  flush();
  return { title, blocks };
}
