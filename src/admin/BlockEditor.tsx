import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Align, Block, BlockType, BlockWidth, Project } from '../lib/types';
import { BLOCKS, GROUPS, cloneBlock, parseVideoInput, summarize } from './blocks';
import { assetUrl } from './api';
import { ImageField, LinkInput } from './media';
import { PROJECTS, expanded, newId, openView, projects, selectedBlock, toggleExpanded, updateFile } from './store';
import { Field, Icon, IconButton, RichText, Segmented, TextArea, TextInput, Toggle } from './ui';

const MAX_DEPTH = 2;

// Drag state lives outside components: a drag only reorders within the list it started in.
let drag: { list: string; index: number } | null = null;

// --- add-block menu ------------------------------------------------------

function AddMenu({ depth, onPick, onClose }: { depth: number; onPick: (b: Block) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', close));
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const allowed = (type: BlockType) => depth < MAX_DEPTH || (type !== 'section' && type !== 'columns');

  return (
    <div class="add-menu" ref={ref} role="menu">
      {GROUPS.map((group) => {
        const types = (Object.keys(BLOCKS) as BlockType[]).filter((t) => BLOCKS[t].group === group && allowed(t));
        if (!types.length) return null;
        return (
          <div class="add-group">
            <div class="add-group-label">{group}</div>
            {types.map((t) => (
              <button type="button" role="menuitem" class="add-item" onClick={() => onPick(BLOCKS[t].create())}>
                <span class="add-item-label">{BLOCKS[t].label}</span>
                <span class="add-item-hint">{BLOCKS[t].hint}</span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Inserter({ depth, onInsert, visible }: { depth: number; onInsert: (b: Block) => void; visible?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div class={`inserter${visible ? ' visible' : ''}${open ? ' open' : ''}`}>
      <button type="button" class="inserter-btn" onClick={() => setOpen(true)} title="Insert block here">
        <Icon name="plus" size={12} />
      </button>
      {open && (
        <AddMenu
          depth={depth}
          onClose={() => setOpen(false)}
          onPick={(b) => {
            setOpen(false);
            onInsert(b);
          }}
        />
      )}
    </div>
  );
}

// --- list ----------------------------------------------------------------

export function BlockListEditor({
  blocks,
  onChange,
  depth = 0,
  emptyHint,
}: {
  blocks: Block[];
  onChange: (next: Block[]) => void;
  depth?: number;
  emptyHint?: string;
}) {
  const listKey = useMemo(() => newId('list'), []);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const insert = (index: number, block: Block) => {
    const next = [...blocks];
    next.splice(index, 0, block);
    onChange(next);
    selectedBlock.value = block.id;
    toggleExpanded(block.id, true);
    requestAnimationFrame(() =>
      document.querySelector(`[data-edit-id="${block.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
    );
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div class={`block-list depth-${depth}`}>
      {blocks.length === 0 && <p class="empty small">{emptyHint ?? 'No blocks yet.'}</p>}

      {blocks.map((block, index) => (
        <div
          key={block.id}
          class={`block-slot${dropAt === index ? ' drop-before' : ''}${dropAt === index + 1 && index === blocks.length - 1 ? ' drop-after' : ''}`}
          onDragOver={(e) => {
            if (!drag || drag.list !== listKey) return;
            e.preventDefault();
            e.stopPropagation();
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setDropAt(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
          }}
          onDragLeave={() => setDropAt(null)}
          onDrop={(e) => {
            if (!drag || drag.list !== listKey || dropAt === null) return;
            e.preventDefault();
            e.stopPropagation();
            const to = dropAt > drag.index ? dropAt - 1 : dropAt;
            move(drag.index, to);
            drag = null;
            setDropAt(null);
          }}
        >
          <Inserter depth={depth} onInsert={(b) => insert(index, b)} />
          <BlockCard
            block={block}
            depth={depth}
            first={index === 0}
            last={index === blocks.length - 1}
            onChange={(b) => onChange(blocks.map((x, i) => (i === index ? b : x)))}
            onMove={(dir) => move(index, index + dir)}
            onDuplicate={() => insert(index + 1, cloneBlock(block))}
            onRemove={() => onChange(blocks.filter((_, i) => i !== index))}
            onDragStart={() => (drag = { list: listKey, index })}
            onDragEnd={() => {
              drag = null;
              setDropAt(null);
            }}
          />
        </div>
      ))}

      <div class="add-block-wrap">
        <button type="button" class="add-block" onClick={() => setMenuOpen(true)}>
          <Icon name="plus" /> Add block
        </button>
        {menuOpen && (
          <AddMenu
            depth={depth}
            onClose={() => setMenuOpen(false)}
            onPick={(b) => {
              setMenuOpen(false);
              insert(blocks.length, b);
            }}
          />
        )}
      </div>
    </div>
  );
}

// --- card ----------------------------------------------------------------

function BlockCard({
  block,
  depth,
  first,
  last,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  block: Block;
  depth: number;
  first: boolean;
  last: boolean;
  onChange: (b: Block) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const isOpen = expanded.value.has(block.id);
  const isSelected = selectedBlock.value === block.id;
  const spec = BLOCKS[block.type];
  const [draggable, setDraggable] = useState(false);

  return (
    <div
      class={`block-card${isOpen ? ' open' : ''}${isSelected ? ' selected' : ''}`}
      data-edit-id={block.id}
      draggable={draggable}
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer?.setData('text/plain', block.id);
        onDragStart();
      }}
      onDragEnd={() => {
        setDraggable(false);
        onDragEnd();
      }}
      onFocusIn={(e) => {
        // Stop here so focusing a field in a nested block doesn't select its section too.
        e.stopPropagation();
        selectedBlock.value = block.id;
      }}
    >
      <div
        class="block-head"
        onClick={() => {
          selectedBlock.value = block.id;
          toggleExpanded(block.id);
        }}
      >
        <span
          class="grip"
          title="Drag to reorder"
          onMouseDown={() => setDraggable(true)}
          onMouseUp={() => setDraggable(false)}
        >
          <Icon name="grip" />
        </span>
        <span class={`chevron${isOpen ? ' open' : ''}`}>
          <Icon name="chevron" size={12} />
        </span>
        <span class="block-type">{spec?.label ?? block.type}</span>
        <span class="block-summary">{summarize(block)}</span>
        {layoutLabel(block) && <span class="block-layout">{layoutLabel(block)}</span>}
        <span class="block-tools">
          <IconButton icon="up" label="Move up" onClick={() => onMove(-1)} disabled={first} />
          <IconButton icon="down" label="Move down" onClick={() => onMove(1)} disabled={last} />
          <IconButton icon="copy" label="Duplicate" onClick={onDuplicate} />
          <IconButton
            icon="trash"
            label="Delete"
            tone="danger"
            onClick={() => {
              const nested = block.type === 'section' || block.type === 'columns';
              if (!nested || confirm(`Delete this ${spec.label.toLowerCase()} and everything inside it?`)) onRemove();
            }}
          />
        </span>
      </div>
      {isOpen && (
        <div class="block-body">
          <LayoutFields block={block} depth={depth} onChange={onChange} />
          <BlockFields block={block} depth={depth} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// --- width & alignment ---------------------------------------------------

const WIDTHS: { value: BlockWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
  { value: 'full', label: 'Full' },
];

// "content" is the old image-only name for normal.
const widthOf = (block: Block): BlockWidth =>
  (block.width as string) === 'content' || !block.width ? 'normal' : block.width;

function layoutLabel(block: Block): string {
  const w = widthOf(block);
  return [w !== 'normal' && WIDTHS.find((x) => x.value === w)?.label, block.align && block.align !== 'left' && (block.align === 'center' ? 'Centered' : 'Right')]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Where a block sits on the page. Defaults (left, normal) are removed from the JSON rather
 * than stored, so untouched blocks stay clean. Wide and full only make sense at the top
 * level: inside a section or column there is no page edge to reach.
 */
function LayoutFields({ block, depth, onChange }: { block: Block; depth: number; onChange: (b: Block) => void }) {
  if (block.type === 'spacer') return null;
  const width = widthOf(block);
  const widths = depth === 0 ? WIDTHS : WIDTHS.slice(0, 2);

  const set = (patch: { align?: Align; width?: BlockWidth }) => {
    const next = { ...block, ...patch } as Block;
    if (next.align === 'left') delete next.align;
    if (next.width === 'normal' || (next.width as string) === 'content') delete next.width;
    onChange(next);
  };

  return (
    <div class="layout-row">
      <Field label="Align">
        <Segmented
          value={block.align ?? 'left'}
          options={[
            { value: 'left' as const, label: 'Left', icon: 'alignLeft' },
            { value: 'center' as const, label: 'Center', icon: 'alignCenter' },
            { value: 'right' as const, label: 'Right', icon: 'alignRight' },
          ]}
          onChange={(align) => set({ align })}
        />
      </Field>
      <Field label="Width">
        <Segmented value={widths.some((w) => w.value === width) ? width : 'normal'} options={widths} onChange={(w) => set({ width: w })} />
      </Field>
    </div>
  );
}

// --- project covers ------------------------------------------------------

/**
 * The rail and the grid both draw their pictures from the projects, so the covers are
 * editable here too. Otherwise you have to guess that they live in the Projects tab.
 */
function CoverList() {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const list = projects.value;

  if (!list.length) return <p class="empty small">No projects yet. Add them in the Projects tab.</p>;

  const setCover = (slug: string, cover: string) =>
    updateFile<Project[]>(PROJECTS, (all) => all.map((p) => (p.slug === slug ? { ...p, cover } : p)));

  return (
    <div class="cover-list">
      {list.map((p) => (
        <div class="cover-row">
          <button
            type="button"
            class="cover-thumb"
            title="Change this cover"
            onClick={() => setOpenSlug(openSlug === p.slug ? null : p.slug)}
          >
            {p.cover ? <img src={assetUrl(p.cover)} alt="" /> : <Icon name="image" />}
          </button>
          <span class="cover-title">{p.title || p.slug}</span>
          <button type="button" class="btn small ghost" onClick={() => setOpenSlug(openSlug === p.slug ? null : p.slug)}>
            Change image
          </button>
          <IconButton
            icon="external"
            label={`Open ${p.title} in Projects`}
            onClick={() => openView({ kind: 'projects', slug: p.slug })}
          />
          {openSlug === p.slug && (
            <div class="cover-editor">
              <ImageField value={p.cover} onChange={(cover) => setCover(p.slug, cover)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- per-type settings ---------------------------------------------------

function BlockFields({ block, depth, onChange }: { block: Block; depth: number; onChange: (b: Block) => void }) {
  switch (block.type) {
    case 'heading':
      return (
        <div class="fields">
          <Field label="Size">
            <Segmented
              value={block.level}
              options={[1, 2, 3, 4].map((l) => ({ value: l as 1 | 2 | 3 | 4, label: `H${l}` }))}
              onChange={(v) => onChange({ ...block, level: v })}
            />
          </Field>
          <Field label="Text" wide>
            <TextInput value={block.text} onChange={(v) => onChange({ ...block, text: v })} />
          </Field>
        </div>
      );

    case 'text':
      return <RichText value={block.html} onChange={(v) => onChange({ ...block, html: v })} />;

    case 'image':
      return (
        <div class="fields">
          <Field label="Image" wide>
            <ImageField value={block.src} onChange={(v) => onChange({ ...block, src: v })} />
          </Field>
          <Field label="Alt text" hint="Describes the image for screen readers." wide>
            <TextInput value={block.alt} onChange={(v) => onChange({ ...block, alt: v })} />
          </Field>
          <Field label="Caption" wide>
            <TextInput value={block.caption ?? ''} onChange={(v) => onChange({ ...block, caption: v })} />
          </Field>
        </div>
      );

    case 'gallery':
      return (
        <div class="stack">
          {block.images.map((img, i) => (
            <div class="gallery-row">
              <ImageField
                value={img.src}
                onChange={(src) =>
                  onChange({ ...block, images: block.images.map((x, j) => (j === i ? { ...x, src } : x)) })
                }
              />
              <div class="gallery-side">
                <TextInput
                  value={img.alt}
                  placeholder="Alt text"
                  onChange={(alt) =>
                    onChange({ ...block, images: block.images.map((x, j) => (j === i ? { ...x, alt } : x)) })
                  }
                />
                <div class="row">
                  <IconButton
                    icon="up"
                    label="Move up"
                    disabled={i === 0}
                    onClick={() => onChange({ ...block, images: swap(block.images, i, i - 1) })}
                  />
                  <IconButton
                    icon="down"
                    label="Move down"
                    disabled={i === block.images.length - 1}
                    onClick={() => onChange({ ...block, images: swap(block.images, i, i + 1) })}
                  />
                  <IconButton
                    icon="trash"
                    label="Remove"
                    tone="danger"
                    onClick={() => onChange({ ...block, images: block.images.filter((_, j) => j !== i) })}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            class="btn small ghost"
            onClick={() => onChange({ ...block, images: [...block.images, { src: '', alt: '' }] })}
          >
            <Icon name="plus" /> Add image
          </button>
        </div>
      );

    case 'video':
      return (
        <div class="fields">
          <Field label="Provider">
            <Segmented
              value={block.provider}
              options={[
                { value: 'youtube', label: 'YouTube' },
                { value: 'vimeo', label: 'Vimeo' },
                { value: 'itch', label: 'itch.io' },
              ]}
              onChange={(v) => onChange({ ...block, provider: v })}
            />
          </Field>
          <Field
            label="Video"
            hint={block.provider === 'itch' ? 'The number from your itch.io embed code.' : 'Paste the video link or its id.'}
            wide
          >
            <TextInput
              value={block.videoId}
              onChange={(v) => {
                const parsed = parseVideoInput(v);
                onChange({ ...block, videoId: parsed.id, provider: parsed.provider ?? block.provider });
              }}
            />
          </Field>
          <Field label="Title" hint="For screen readers." wide>
            <TextInput value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v })} />
          </Field>
        </div>
      );

    case 'button':
      return (
        <div class="fields">
          <Field label="Label">
            <TextInput value={block.label} onChange={(v) => onChange({ ...block, label: v })} />
          </Field>
          <Field label="Style">
            <Segmented
              value={block.style ?? 'primary'}
              options={[
                { value: 'primary', label: 'Primary' },
                { value: 'secondary', label: 'Secondary' },
              ]}
              onChange={(v) => onChange({ ...block, style: v })}
            />
          </Field>
          <Field label="Links to" hint="Pick a page from the list or type any URL." wide>
            <LinkInput value={block.href} onChange={(v) => onChange({ ...block, href: v })} />
          </Field>
        </div>
      );

    case 'divider':
      return <p class="empty small">A divider has no settings.</p>;

    case 'spacer':
      return (
        <Field label="Size">
          <Segmented
            value={block.size ?? 'md'}
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'md', label: 'Medium' },
              { value: 'lg', label: 'Large' },
            ]}
            onChange={(v) => onChange({ ...block, size: v })}
          />
        </Field>
      );

    case 'table':
      return <TableFields block={block} onChange={onChange} />;

    case 'chart':
      return (
        <div class="stack">
          <div class="fields">
            <Field label="Type">
              <Segmented
                value={block.variant}
                options={[
                  { value: 'bar', label: 'Bar' },
                  { value: 'line', label: 'Line' },
                ]}
                onChange={(v) => onChange({ ...block, variant: v })}
              />
            </Field>
            <Field label="Title" wide>
              <TextInput value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v })} />
            </Field>
          </div>
          <div class="series">
            <div class="series-head">
              <span>Label</span>
              <span>Value</span>
              <span />
            </div>
            {block.series.map((d, i) => (
              <div class="series-row">
                <TextInput
                  value={d.label}
                  onChange={(label) =>
                    onChange({ ...block, series: block.series.map((x, j) => (j === i ? { ...x, label } : x)) })
                  }
                />
                <input
                  class="input"
                  type="number"
                  value={d.value}
                  onInput={(e) => {
                    const value = Number((e.target as HTMLInputElement).value) || 0;
                    onChange({ ...block, series: block.series.map((x, j) => (j === i ? { ...x, value } : x)) });
                  }}
                />
                <IconButton
                  icon="trash"
                  label="Remove"
                  tone="danger"
                  onClick={() => onChange({ ...block, series: block.series.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <button
              type="button"
              class="btn small ghost"
              onClick={() => onChange({ ...block, series: [...block.series, { label: '', value: 0 }] })}
            >
              <Icon name="plus" /> Add value
            </button>
          </div>
        </div>
      );

    case 'section':
      return (
        <div class="stack">
          <Field label="Background">
            <Segmented
              value={block.background ?? 'none'}
              options={[
                { value: 'none', label: 'None' },
                { value: 'surface', label: 'Subtle' },
                { value: 'accent', label: 'Accent' },
              ]}
              onChange={(v) => onChange({ ...block, background: v })}
            />
          </Field>
          <BlockListEditor
            blocks={block.blocks}
            depth={depth + 1}
            emptyHint="Empty section. Add blocks to it below."
            onChange={(blocks) => onChange({ ...block, blocks })}
          />
        </div>
      );

    case 'columns':
      return (
        <div class="stack">
          <Field label="Columns">
            <Segmented
              value={block.count}
              options={[
                { value: 2 as const, label: '2' },
                { value: 3 as const, label: '3' },
              ]}
              onChange={(count) => onChange(resizeColumns(block, count))}
            />
          </Field>
          <div class={`columns-editor cols-${block.count}`}>
            {block.columns.map((col, i) => (
              <div class="column-editor">
                <div class="column-label">Column {i + 1}</div>
                <BlockListEditor
                  blocks={col.blocks}
                  depth={depth + 1}
                  emptyHint="Empty column."
                  onChange={(blocks) =>
                    onChange({ ...block, columns: block.columns.map((c, j) => (j === i ? { ...c, blocks } : c)) })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      );

    case 'projectRail':
    case 'projectGrid':
      return (
        <div class="stack">
          <Toggle
            checked={Boolean(block.filters)}
            label="Show tag filters above"
            onChange={(v) => onChange({ ...block, filters: v })}
          />
          <p class="field-hint">
            Shows every project that isn't hidden, newest first. Covers can be swapped here; everything else about
            a project lives in the Projects tab.
          </p>
          <CoverList />
        </div>
      );

    case 'html':
      return (
        <Field label="HTML" hint="Rendered as-is. Use for embeds the other blocks can't express." wide>
          <TextArea mono rows={8} value={block.html} onChange={(v) => onChange({ ...block, html: v })} />
        </Field>
      );

    default:
      return <p class="empty small">Unknown block type.</p>;
  }
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/** Changing the column count never loses content: blocks from a removed column move into the last one kept. */
function resizeColumns(block: Extract<Block, { type: 'columns' }>, count: 2 | 3): Block {
  let columns = [...block.columns];
  if (count > columns.length) {
    while (columns.length < count) columns.push({ id: newId('col'), blocks: [] });
  } else if (count < columns.length) {
    const removed = columns.slice(count).flatMap((c) => c.blocks);
    columns = columns.slice(0, count);
    columns[count - 1] = { ...columns[count - 1], blocks: [...columns[count - 1].blocks, ...removed] };
  }
  return { ...block, count, columns };
}

function TableFields({
  block,
  onChange,
}: {
  block: Extract<Block, { type: 'table' }>;
  onChange: (b: Block) => void;
}) {
  const setCell = (r: number, c: number, v: string) =>
    onChange({ ...block, rows: block.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) });
  const setHeader = (c: number, v: string) =>
    onChange({ ...block, columns: block.columns.map((x, j) => (j === c ? v : x)) });
  const addColumn = () =>
    onChange({
      ...block,
      columns: [...block.columns, `Column ${block.columns.length + 1}`],
      rows: block.rows.map((r) => [...r, '']),
    });
  const removeColumn = (c: number) =>
    onChange({
      ...block,
      columns: block.columns.filter((_, j) => j !== c),
      rows: block.rows.map((r) => r.filter((_, j) => j !== c)),
    });

  return (
    <div class="stack">
      <Field label="Caption" wide>
        <TextInput value={block.caption ?? ''} onChange={(v) => onChange({ ...block, caption: v })} />
      </Field>
      <div class="table-editor">
        <table>
          <thead>
            <tr>
              {block.columns.map((col, c) => (
                <th>
                  <div class="th-cell">
                    <input class="input cell head" value={col} onInput={(e) => setHeader(c, (e.target as HTMLInputElement).value)} />
                    {block.columns.length > 1 && (
                      <IconButton icon="x" label="Remove column" onClick={() => removeColumn(c)} />
                    )}
                  </div>
                </th>
              ))}
              <th class="narrow">
                <IconButton icon="plus" label="Add column" onClick={addColumn} />
              </th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr>
                {row.map((cell, c) => (
                  <td>
                    <input class="input cell" value={cell} onInput={(e) => setCell(r, c, (e.target as HTMLInputElement).value)} />
                  </td>
                ))}
                <td class="narrow">
                  <IconButton
                    icon="trash"
                    label="Remove row"
                    tone="danger"
                    onClick={() => onChange({ ...block, rows: block.rows.filter((_, i) => i !== r) })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        class="btn small ghost"
        onClick={() => onChange({ ...block, rows: [...block.rows, block.columns.map(() => '')] })}
      >
        <Icon name="plus" /> Add row
      </button>
    </div>
  );
}
