import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Align, Block, BlockType, BlockWidth, Project } from '../lib/types';
import { BLOCKS, GROUPS, cloneBlock, parseVideoInput, summarize } from './blocks';
import { assetUrl } from './api';
import { ImageField, LinkInput } from './media';
import { PROJECTS, expanded, fileToRoute, files, newId, openView, pagePaths, projects, selectedBlock, toggleExpanded, updateFile } from './store';
import { Field, Icon, IconButton, RichText, Segmented, Select, TextArea, TextInput, Toggle } from './ui';

const MAX_DEPTH = 2;

/** Blocks that hold other blocks, and so can be moved into rather than stepped over. */
const holdsBlocks = (b: Block) => b.type === 'section' || b.type === 'columns';

/** How many containers deep a block goes, counting itself. A plain block is 0. */
function nesting(block: Block): number {
  if (block.type === 'section') return 1 + Math.max(0, ...block.blocks.map(nesting));
  if (block.type === 'columns') return 1 + Math.max(0, ...block.columns.flatMap((c) => c.blocks.map(nesting)));
  return 0;
}

/**
 * Whether a block may be moved into a container sitting in a list at this depth.
 *
 * It is the whole subtree that has to fit, not just the block itself: carrying a section
 * that holds sections into a container pushes the ones inside it a level deeper too, and
 * they would end up nested further than the Add menu will create.
 */
const fitsInside = (block: Block, depth: number) => nesting(block) === 0 || depth + nesting(block) < MAX_DEPTH;

/** The container with the block put inside it, at whichever end it arrived from. */
function withChild(container: Block, child: Block, at: 'start' | 'end'): Block {
  const place = (list: Block[]) => (at === 'start' ? [child, ...list] : [...list, child]);
  if (container.type === 'section') return { ...container, blocks: place(container.blocks) };
  if (container.type === 'columns') {
    // Columns have no single inside, so a block enters the near one: the first coming
    // down, the last coming up. Reaching the others is what dragging is for.
    const target = at === 'start' ? 0 : container.columns.length - 1;
    return {
      ...container,
      columns: container.columns.map((col, i) => (i === target ? { ...col, blocks: place(col.blocks) } : col)),
    };
  }
  return container;
}

/** Every page, plus any case study that doesn't have one yet, offered when adding a link. */
const linkOptions = () => {
  const pages = pagePaths.value.map((path) => ({
    label: (files.value[path] as { title?: string }).title || fileToRoute(path),
    href: fileToRoute(path),
  }));
  const known = new Set(pages.map((p) => p.href));
  const missing = projects.value
    .map((p) => ({ label: `${p.title} (case study)`, href: `/work/${p.slug}` }))
    .filter((p) => !known.has(p.href));
  return [...pages, ...missing];
};

/**
 * Actions for the selected block, so the keyboard shortcuts in App.tsx can reach whichever
 * card is selected without threading callbacks through every list.
 */
export const blockActions = new Map<string, { duplicate: () => void; remove: () => void; move: (dir: -1 | 1) => void }>();

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
  onEscape,
}: {
  blocks: Block[];
  onChange: (next: Block[]) => void;
  depth?: number;
  emptyHint?: string;
  /**
   * Moving off the end of a nested list lifts the block out of whatever holds it, rather
   * than stopping at a wall. Absent at the top level, where there is nowhere further out.
   */
  onEscape?: (block: Block, dir: -1 | 1) => void;
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
    // Off the end of a nested list: hand the block to whatever contains this one, which
    // is the only level that can both take it out and put it back down.
    if ((to < 0 || to >= blocks.length) && onEscape) {
      onEscape(blocks[from], to < 0 ? -1 : 1);
      return;
    }
    if (to < 0 || to >= blocks.length || from === to) return;

    // A neighbour that holds blocks is moved into rather than stepped over. This is the
    // mirror of escaping: travelling down enters at its top, travelling up enters at its
    // bottom, and carrying on in the same direction takes the block out the far side.
    // Without it a block created at the top level could never be put inside anything.
    const moving = blocks[from];
    const neighbour = blocks[to];
    if (holdsBlocks(neighbour) && fitsInside(moving, depth)) {
      const at = to > from ? 'start' : 'end';
      onChange(
        blocks
          .filter((_, i) => i !== from)
          .map((b) => (b.id === neighbour.id ? withChild(b, moving, at) : b)),
      );
      toggleExpanded(neighbour.id, true);
      selectedBlock.value = moving.id;
      return;
    }

    const next = [...blocks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  /** Whether the step in this direction puts the block inside a neighbour. */
  const entersFrom = (index: number, dir: -1 | 1) => {
    const neighbour = blocks[index + dir];
    if (!neighbour || !holdsBlocks(neighbour)) return undefined;
    return fitsInside(blocks[index], depth) ? neighbour.type : undefined;
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
            first={index === 0 && !onEscape}
            last={index === blocks.length - 1 && !onEscape}
            escapesUp={Boolean(onEscape) && index === 0}
            escapesDown={Boolean(onEscape) && index === blocks.length - 1}
            entersUp={entersFrom(index, -1)}
            entersDown={entersFrom(index, 1)}
            onChange={(b) => onChange(blocks.map((x, i) => (i === index ? b : x)))}
            onMove={(dir) => move(index, index + dir)}
            onDuplicate={() => insert(index + 1, cloneBlock(block))}
            onRemove={() => onChange(blocks.filter((_, i) => i !== index))}
            onEscapeChild={(self, child, dir) => {
              const next = [...blocks];
              next[index] = self;
              next.splice(dir === 1 ? index + 1 : index, 0, child);
              onChange(next);
              selectedBlock.value = child.id;
            }}
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
  escapesUp,
  escapesDown,
  entersUp,
  entersDown,
  onChange,
  onMove,
  onDuplicate,
  onRemove,
  onEscapeChild,
  onDragStart,
  onDragEnd,
}: {
  block: Block;
  depth: number;
  first: boolean;
  last: boolean;
  /** At an edge of a nested list, so moving further in that direction lifts it out. */
  escapesUp?: boolean;
  escapesDown?: boolean;
  /** The neighbour in that direction holds blocks, so moving puts this one inside it. */
  entersUp?: 'section' | 'columns';
  entersDown?: 'section' | 'columns';
  onChange: (b: Block) => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  /** A block inside this one is leaving: here is this block without it, and where it goes. */
  onEscapeChild?: (self: Block, child: Block, dir: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const isOpen = expanded.value.has(block.id);
  const isSelected = selectedBlock.value === block.id;
  const spec = BLOCKS[block.type];
  const [draggable, setDraggable] = useState(false);

  const confirmRemove = () => {
    const nested = block.type === 'section' || block.type === 'columns';
    if (!nested || confirm(`Delete this ${spec.label.toLowerCase()} and everything inside it?`)) onRemove();
  };

  // Keyboard shortcuts act on the selected block, wherever it is nested.
  useEffect(() => {
    blockActions.set(block.id, { duplicate: onDuplicate, remove: confirmRemove, move: onMove });
    return () => {
      blockActions.delete(block.id);
    };
  });

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
          <IconButton
            icon="up"
            label={
              first
                ? depth > 0
                  ? 'Already first inside this block'
                  : 'Already the first block'
                : entersUp
                  ? `Move up, into the ${entersUp} above (Alt+↑)`
                  : escapesUp
                    ? 'Move up, out of this block (Alt+↑)'
                    : 'Move up (Alt+↑)'
            }
            onClick={() => onMove(-1)}
            disabled={first}
          />
          <IconButton
            icon="down"
            label={
              last
                ? depth > 0
                  ? 'Already last inside this block'
                  : 'Already the last block'
                : entersDown
                  ? `Move down, into the ${entersDown} below (Alt+↓)`
                  : escapesDown
                    ? 'Move down, out of this block (Alt+↓)'
                    : 'Move down (Alt+↓)'
            }
            onClick={() => onMove(1)}
            disabled={last}
          />
          <IconButton icon="copy" label="Duplicate (Ctrl+D)" onClick={onDuplicate} />
          <IconButton icon="trash" label="Delete (Del)" tone="danger" onClick={confirmRemove} />
        </span>
      </div>
      {isOpen && (
        <div class="block-body">
          <LayoutFields block={block} depth={depth} onChange={onChange} />
          <BlockFields block={block} depth={depth} onChange={onChange} onEscapeChild={onEscapeChild} />
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

function BlockFields({
  block,
  depth,
  onChange,
  onEscapeChild,
}: {
  block: Block;
  depth: number;
  onChange: (b: Block) => void;
  onEscapeChild?: (self: Block, child: Block, dir: -1 | 1) => void;
}) {
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
          <Field label="Number" hint="Optional, e.g. 01.">
            <TextInput
              value={block.number ?? ''}
              onChange={(v) => onChange({ ...block, number: v || undefined })}
            />
          </Field>
          <Field label="Kicker" hint="Small line above the title.">
            <TextInput
              value={block.eyebrow ?? ''}
              onChange={(v) => onChange({ ...block, eyebrow: v || undefined })}
            />
          </Field>
        </div>
      );

    case 'text':
      return (
        <div class="stack">
          <RichText
            value={block.html}
            links={linkOptions()}
            onChange={(v) => onChange({ ...block, html: v })}
          />
          <div class="fields">
            <Field label="Line spacing" hint="Space between the lines of a paragraph.">
              <Select
                value={block.leading ?? 'normal'}
                options={[
                  { value: 'tight', label: 'Tight' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'airy', label: 'Airy' },
                ]}
                onChange={(v) => onChange({ ...block, leading: v === 'normal' ? undefined : v })}
              />
            </Field>
            <Field label="Paragraph spacing" hint="Space between one paragraph and the next.">
              <Select
                value={block.gap ?? 'normal'}
                options={[
                  { value: 'tight', label: 'Tight' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'airy', label: 'Airy' },
                ]}
                onChange={(v) => onChange({ ...block, gap: v === 'normal' ? undefined : v })}
              />
            </Field>
          </div>
        </div>
      );

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
          <Field label={`Size · ${block.scale ?? 100}%`} hint="Of the space the block has.">
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={block.scale ?? 100}
              onInput={(e) => {
                const scale = Number((e.target as HTMLInputElement).value);
                // 100% is the default, so it isn't written to the file.
                const { scale: _drop, ...rest } = block;
                onChange(scale === 100 ? rest : { ...rest, scale });
              }}
            />
          </Field>
          <Field label="Shape" hint="Crops the picture to fixed proportions.">
            <Select
              value={block.aspect ?? 'auto'}
              options={[
                { value: 'auto' as const, label: 'Original' },
                { value: '1:1' as const, label: 'Square' },
                { value: '4:3' as const, label: 'Landscape 4:3' },
                { value: '3:2' as const, label: 'Photo 3:2' },
                { value: '16:9' as const, label: 'Wide 16:9' },
                { value: '21:9' as const, label: 'Cinematic 21:9' },
              ]}
              onChange={(aspect) => {
                const { aspect: _drop, ...rest } = block;
                onChange(aspect === 'auto' ? rest : { ...rest, aspect });
              }}
            />
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

    case 'specs':
    case 'stats': {
      // Same shape either way: an ordered list of two-field rows.
      const isSpecs = block.type === 'specs';
      const items = block.items as { label: string; value: string }[];
      const write = (next: { label: string; value: string }[]) => onChange({ ...block, items: next } as Block);
      const edit = (i: number, patch: Partial<{ label: string; value: string }>) =>
        write(items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
      return (
        <div class="stack">
          <div class="series">
            <div class="series-head">
              <span>{isSpecs ? 'Label' : 'Figure'}</span>
              <span>{isSpecs ? 'Value' : 'Caption'}</span>
              <span />
            </div>
            {items.map((item, i) => (
              <div class="series-row">
                <TextInput
                  value={isSpecs ? item.label : item.value}
                  onChange={(v) => edit(i, isSpecs ? { label: v } : { value: v })}
                />
                <TextInput
                  value={isSpecs ? item.value : item.label}
                  onChange={(v) => edit(i, isSpecs ? { value: v } : { label: v })}
                />
                <IconButton
                  icon="trash"
                  label="Remove"
                  tone="danger"
                  onClick={() => write(items.filter((_, j) => j !== i))}
                />
              </div>
            ))}
            <button type="button" class="btn small ghost" onClick={() => write([...items, { label: '', value: '' }])}>
              <Icon name="plus" /> Add {isSpecs ? 'pair' : 'figure'}
            </button>
          </div>
        </div>
      );
    }

    case 'chart': {
      const setSeries = (i: number, patch: Partial<(typeof block.series)[number]>) =>
        onChange({ ...block, series: block.series.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
      const computed = block.series.some((x) => x.formula !== undefined);
      const range = block.range ?? { from: 0, to: 10, step: 1 };
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
            <Field label="Note" hint="One line under the title: what the numbers mean, or where they came from." wide>
              <TextInput value={block.note ?? ''} onChange={(v) => onChange({ ...block, note: v || undefined })} />
            </Field>
            <Field label="Reference line" hint="A line to read the marks against — a target, a proposal, a floor. Empty for none.">
              <input
                class="input"
                type="number"
                value={block.reference?.value ?? ''}
                onInput={(e) => {
                  const raw = (e.target as HTMLInputElement).value;
                  onChange({
                    ...block,
                    reference: raw === '' ? undefined : { ...block.reference, value: Number(raw) || 0 },
                  });
                }}
              />
            </Field>
            <Field label="Reference label">
              <TextInput
                value={block.reference?.label ?? ''}
                onChange={(label) =>
                  onChange({
                    ...block,
                    reference: block.reference ? { ...block.reference, label: label || undefined } : undefined,
                  })
                }
              />
            </Field>
          </div>

          {computed && (
            <div class="fields">
              <Field label="From" hint="The chart runs each formula from here…">
                <input
                  class="input"
                  type="number"
                  value={range.from}
                  onInput={(e) =>
                    onChange({ ...block, range: { ...range, from: Number((e.target as HTMLInputElement).value) || 0 } })
                  }
                />
              </Field>
              <Field label="To" hint="…to here.">
                <input
                  class="input"
                  type="number"
                  value={range.to}
                  onInput={(e) =>
                    onChange({ ...block, range: { ...range, to: Number((e.target as HTMLInputElement).value) || 0 } })
                  }
                />
              </Field>
              <Field label="Step">
                <input
                  class="input"
                  type="number"
                  value={range.step ?? 1}
                  onInput={(e) =>
                    onChange({ ...block, range: { ...range, step: Number((e.target as HTMLInputElement).value) || 1 } })
                  }
                />
              </Field>
            </div>
          )}

          {block.series.map((plot, i) => (
            <div class="subsection">
              <div class="fields">
                <Field label="Series name" hint="Shown in the legend when there is more than one.">
                  <TextInput value={plot.name ?? ''} onChange={(name) => setSeries(i, { name: name || undefined })} />
                </Field>
                <Field label="Values from" wide>
                  <Segmented
                    value={plot.formula !== undefined ? 'formula' : 'typed'}
                    options={[
                      { value: 'typed', label: 'Typed values' },
                      { value: 'formula', label: 'A formula' },
                    ]}
                    onChange={(mode) =>
                      setSeries(
                        i,
                        mode === 'formula'
                          ? { formula: plot.formula ?? '', data: undefined }
                          : { formula: undefined, data: plot.data ?? [] },
                      )
                    }
                  />
                </Field>
              </div>

              <Field label="Values on the marks" hint="Print every number. An emphasised point prints its own either way.">
                <Toggle
                  checked={Boolean(plot.labels)}
                  label="Show"
                  onChange={(labels) => setSeries(i, { labels: labels || undefined })}
                />
              </Field>

              {plot.formula !== undefined ? (
                <Field
                  label="Formula"
                  hint="In x, e.g. round(90 * pow(1.28, x - 75)). Arithmetic and ^, plus round, floor, ceil, abs, min, max, sqrt, pow, exp, log."
                  wide
                >
                  <TextInput value={plot.formula} onChange={(formula) => setSeries(i, { formula })} />
                </Field>
              ) : (
                <div class="series">
                  <div class="series-head">
                    <span>Label</span>
                    <span>Value</span>
                    <span>Emphasis</span>
                    <span />
                  </div>
                  {(plot.data ?? []).map((d, k) => (
                    <div class="series-row wide">
                      <TextInput
                        value={d.label}
                        onChange={(label) =>
                          setSeries(i, { data: (plot.data ?? []).map((x, m) => (m === k ? { ...x, label } : x)) })
                        }
                      />
                      <input
                        class="input"
                        type="number"
                        value={d.value}
                        onInput={(e) =>
                          setSeries(i, {
                            data: (plot.data ?? []).map((x, m) =>
                              m === k ? { ...x, value: Number((e.target as HTMLInputElement).value) || 0 } : x,
                            ),
                          })
                        }
                      />
                      <Select
                        value={d.emphasis ?? ''}
                        options={[
                          { value: '', label: 'Normal' },
                          { value: 'accent', label: 'Stand out' },
                          { value: 'muted', label: 'Step back' },
                        ]}
                        onChange={(v) =>
                          setSeries(i, {
                            data: (plot.data ?? []).map((x, m) =>
                              m === k ? { ...x, emphasis: (v || undefined) as 'accent' | 'muted' | undefined } : x,
                            ),
                          })
                        }
                      />
                      <IconButton
                        icon="trash"
                        label="Remove"
                        tone="danger"
                        onClick={() => setSeries(i, { data: (plot.data ?? []).filter((_, m) => m !== k) })}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    class="btn small ghost"
                    onClick={() => setSeries(i, { data: [...(plot.data ?? []), { label: '', value: 0 }] })}
                  >
                    <Icon name="plus" /> Add value
                  </button>
                </div>
              )}

              {block.series.length > 1 && (
                <button
                  type="button"
                  class="btn small ghost"
                  onClick={() => onChange({ ...block, series: block.series.filter((_, j) => j !== i) })}
                >
                  <Icon name="trash" /> Remove series
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            class="btn small ghost"
            onClick={() => onChange({ ...block, series: [...block.series, { name: '', data: [] }] })}
          >
            <Icon name="plus" /> Add series
          </button>
        </div>
      );
    }

    case 'pillars': {
      const write = (items: typeof block.items) => onChange({ ...block, items });
      return (
        <div class="stack">
          {block.items.map((item, i) => (
            <div class="subsection">
              <div class="fields">
                <Field label="Label" wide>
                  <TextInput
                    value={item.label}
                    onChange={(label) => write(block.items.map((x, j) => (j === i ? { ...x, label } : x)))}
                  />
                </Field>
                <Field label="Body" wide>
                  <TextArea
                    value={item.body}
                    onChange={(body) => write(block.items.map((x, j) => (j === i ? { ...x, body } : x)))}
                  />
                </Field>
              </div>
              <button type="button" class="btn small ghost" onClick={() => write(block.items.filter((_, j) => j !== i))}>
                <Icon name="trash" /> Remove
              </button>
            </div>
          ))}
          <button type="button" class="btn small ghost" onClick={() => write([...block.items, { label: '', body: '' }])}>
            <Icon name="plus" /> Add pillar
          </button>
        </div>
      );
    }

    case 'tornado': {
      const write = (rows: typeof block.rows) => onChange({ ...block, rows });
      return (
        <div class="stack">
          <div class="fields">
            <Field label="Title" wide>
              <TextInput value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v })} />
            </Field>
            <Field label="Unit" hint="Added after each number, e.g. %.">
              <TextInput value={block.unit ?? ''} onChange={(v) => onChange({ ...block, unit: v })} />
            </Field>
            <Field label="Low label">
              <TextInput value={block.lowLabel ?? ''} onChange={(v) => onChange({ ...block, lowLabel: v })} />
            </Field>
            <Field label="High label">
              <TextInput value={block.highLabel ?? ''} onChange={(v) => onChange({ ...block, highLabel: v })} />
            </Field>
          </div>
          <p class="field-hint">Rows sort themselves by the size of the swing, biggest first.</p>
          <div class="series">
            <div class="series-head">
              <span>Variable</span>
              <span>Low</span>
              <span>High</span>
              <span />
            </div>
            {block.rows.map((row, i) => (
              <div class="series-row wide">
                <TextInput
                  value={row.label}
                  onChange={(label) => write(block.rows.map((x, j) => (j === i ? { ...x, label } : x)))}
                />
                <input
                  class="input"
                  type="number"
                  value={row.low}
                  onInput={(e) =>
                    write(
                      block.rows.map((x, j) =>
                        j === i ? { ...x, low: Number((e.target as HTMLInputElement).value) || 0 } : x,
                      ),
                    )
                  }
                />
                <input
                  class="input"
                  type="number"
                  value={row.high}
                  onInput={(e) =>
                    write(
                      block.rows.map((x, j) =>
                        j === i ? { ...x, high: Number((e.target as HTMLInputElement).value) || 0 } : x,
                      ),
                    )
                  }
                />
                <IconButton
                  icon="trash"
                  label="Remove"
                  tone="danger"
                  onClick={() => write(block.rows.filter((_, j) => j !== i))}
                />
              </div>
            ))}
            <button
              type="button"
              class="btn small ghost"
              onClick={() => write([...block.rows, { label: '', low: 0, high: 0 }])}
            >
              <Icon name="plus" /> Add variable
            </button>
          </div>
        </div>
      );
    }

    case 'flow': {
      const options = block.nodes.map((n) => ({ value: n.id, label: n.label || n.id }));
      return (
        <div class="stack">
          <Field label="Caption" wide>
            <TextInput value={block.caption ?? ''} onChange={(v) => onChange({ ...block, caption: v })} />
          </Field>
          <div class="subsection">
            <p class="field-hint">Nodes are drawn left to right, in this order.</p>
            {block.nodes.map((node, i) => (
              <div class="series-row">
                <TextInput
                  value={node.label}
                  onChange={(label) =>
                    onChange({ ...block, nodes: block.nodes.map((x, j) => (j === i ? { ...x, label } : x)) })
                  }
                />
                <Toggle
                  checked={Boolean(node.accent)}
                  label="Highlight"
                  onChange={(accent) =>
                    onChange({
                      ...block,
                      nodes: block.nodes.map((x, j) => (j === i ? { ...x, accent: accent || undefined } : x)),
                    })
                  }
                />
                <IconButton
                  icon="trash"
                  label="Remove"
                  tone="danger"
                  onClick={() =>
                    onChange({
                      ...block,
                      nodes: block.nodes.filter((_, j) => j !== i),
                      edges: block.edges.filter((e) => e.from !== node.id && e.to !== node.id),
                    })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              class="btn small ghost"
              onClick={() => onChange({ ...block, nodes: [...block.nodes, { id: newId('n'), label: '' }] })}
            >
              <Icon name="plus" /> Add node
            </button>
          </div>
          <div class="subsection">
            <p class="field-hint">Each arrow joins two nodes.</p>
            {block.edges.map((edge, i) => (
              <div class="series-row">
                <Select
                  value={edge.from}
                  options={options}
                  onChange={(from) =>
                    onChange({ ...block, edges: block.edges.map((x, j) => (j === i ? { ...x, from } : x)) })
                  }
                />
                <Select
                  value={edge.to}
                  options={options}
                  onChange={(to) =>
                    onChange({ ...block, edges: block.edges.map((x, j) => (j === i ? { ...x, to } : x)) })
                  }
                />
                <IconButton
                  icon="trash"
                  label="Remove"
                  tone="danger"
                  onClick={() => onChange({ ...block, edges: block.edges.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <button
              type="button"
              class="btn small ghost"
              disabled={block.nodes.length < 2}
              onClick={() =>
                onChange({ ...block, edges: [...block.edges, { from: block.nodes[0].id, to: block.nodes[1].id }] })
              }
            >
              <Icon name="plus" /> Add arrow
            </button>
          </div>
        </div>
      );
    }

    case 'systemMap': {
      const options = block.nodes.map((n) => ({ value: n.id, label: n.label || n.id }));
      const setNode = (i: number, patch: Partial<(typeof block.nodes)[number]>) =>
        onChange({ ...block, nodes: block.nodes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
      const setLink = (i: number, patch: Partial<(typeof block.links)[number]>) =>
        onChange({ ...block, links: block.links.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
      const radial = (block.arrange ?? 'radial') === 'radial';
      return (
        <div class="stack">
          <div class="fields">
            <Field label="Arrangement" hint={radial ? 'The first node sits at the centre, the rest around it.' : 'Nodes run left to right, in the column their layer names.'}>
              <Segmented
                value={block.arrange ?? 'radial'}
                options={[
                  { value: 'radial', label: 'Around a core' },
                  { value: 'layered', label: 'Left to right' },
                ]}
                onChange={(v) => onChange({ ...block, arrange: v })}
              />
            </Field>
            <Field label="Caption" wide>
              <TextInput value={block.caption ?? ''} onChange={(v) => onChange({ ...block, caption: v })} />
            </Field>
          </div>

          <div class="subsection">
            <p class="field-hint">{radial ? 'The first node is the core.' : 'Layer 0 is the leftmost column.'}</p>
            {block.nodes.map((node, i) => (
              <div class="series-row wide">
                <TextInput value={node.label} onChange={(label) => setNode(i, { label })} />
                <TextInput value={node.note ?? ''} onChange={(note) => setNode(i, { note: note || undefined })} />
                {radial ? (
                  <Toggle
                    checked={Boolean(node.accent)}
                    label="Highlight"
                    onChange={(accent) => setNode(i, { accent: accent || undefined })}
                  />
                ) : (
                  <input
                    class="input"
                    type="number"
                    value={node.layer ?? 0}
                    onInput={(e) => setNode(i, { layer: Number((e.target as HTMLInputElement).value) || 0 })}
                  />
                )}
                <IconButton
                  icon="trash"
                  label="Remove"
                  tone="danger"
                  onClick={() =>
                    onChange({
                      ...block,
                      nodes: block.nodes.filter((_, j) => j !== i),
                      links: block.links.filter((l) => l.from !== node.id && l.to !== node.id),
                    })
                  }
                />
              </div>
            ))}
            <button
              type="button"
              class="btn small ghost"
              onClick={() => onChange({ ...block, nodes: [...block.nodes, { id: newId('n'), label: '' }] })}
            >
              <Icon name="plus" /> Add node
            </button>
          </div>

          <div class="subsection">
            <p class="field-hint">Each link joins two nodes, and can carry a short label.</p>
            {block.links.map((link, i) => (
              <div class="series-row wide">
                <Select value={link.from} options={options} onChange={(from) => setLink(i, { from })} />
                <Select value={link.to} options={options} onChange={(to) => setLink(i, { to })} />
                <TextInput value={link.label ?? ''} onChange={(label) => setLink(i, { label: label || undefined })} />
                <IconButton
                  icon="trash"
                  label="Remove"
                  tone="danger"
                  onClick={() => onChange({ ...block, links: block.links.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
            <button
              type="button"
              class="btn small ghost"
              disabled={block.nodes.length < 2}
              onClick={() =>
                onChange({ ...block, links: [...block.links, { from: block.nodes[0].id, to: block.nodes[1].id }] })
              }
            >
              <Icon name="plus" /> Add link
            </button>
          </div>
        </div>
      );
    }

    case 'radar': {
      // Every series carries one value per axis, so adding or removing an axis has to
      // resize all of them; a ragged series would silently plot as zero.
      const setAxes = (axes: string[], map: (values: number[]) => number[]) =>
        onChange({ ...block, axes, series: block.series.map((s) => ({ ...s, values: map(s.values) })) });
      return (
        <div class="stack">
          <div class="fields">
            <Field label="Title" wide>
              <TextInput value={block.title ?? ''} onChange={(v) => onChange({ ...block, title: v })} />
            </Field>
            <Field label="Outer ring" hint="Left empty, it comes from the largest value.">
              <input
                class="input"
                type="number"
                value={block.max ?? ''}
                onInput={(e) => {
                  const v = Number((e.target as HTMLInputElement).value);
                  onChange({ ...block, max: v > 0 ? v : undefined });
                }}
              />
            </Field>
          </div>

          <div class="subsection">
            <p class="field-hint">The measures every series is scored against.</p>
            {block.axes.map((axis, i) => (
              <div class="series-row">
                <TextInput
                  value={axis}
                  onChange={(v) => onChange({ ...block, axes: block.axes.map((x, j) => (j === i ? v : x)) })}
                />
                <IconButton
                  icon="trash"
                  label="Remove"
                  tone="danger"
                  onClick={() =>
                    setAxes(
                      block.axes.filter((_, j) => j !== i),
                      (values) => values.filter((_, j) => j !== i),
                    )
                  }
                />
              </div>
            ))}
            <button
              type="button"
              class="btn small ghost"
              onClick={() => setAxes([...block.axes, ''], (values) => [...values, 0])}
            >
              <Icon name="plus" /> Add measure
            </button>
          </div>

          {block.series.map((plot, i) => (
            <div class="subsection">
              <Field label="Series name" hint="Shown in the legend when there is more than one." wide>
                <TextInput
                  value={plot.name ?? ''}
                  onChange={(name) =>
                    onChange({ ...block, series: block.series.map((x, j) => (j === i ? { ...x, name } : x)) })
                  }
                />
              </Field>
              <div class="series">
                {block.axes.map((axis, k) => (
                  <div class="series-row">
                    <span class="field-hint">{axis || `Measure ${k + 1}`}</span>
                    <input
                      class="input"
                      type="number"
                      value={plot.values[k] ?? 0}
                      onInput={(e) =>
                        onChange({
                          ...block,
                          series: block.series.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  values: block.axes.map((_, m) =>
                                    m === k ? Number((e.target as HTMLInputElement).value) || 0 : (x.values[m] ?? 0),
                                  ),
                                }
                              : x,
                          ),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
              {block.series.length > 1 && (
                <button
                  type="button"
                  class="btn small ghost"
                  onClick={() => onChange({ ...block, series: block.series.filter((_, j) => j !== i) })}
                >
                  <Icon name="trash" /> Remove series
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            class="btn small ghost"
            onClick={() =>
              onChange({ ...block, series: [...block.series, { name: '', values: block.axes.map(() => 0) }] })
            }
          >
            <Icon name="plus" /> Add series
          </button>
        </div>
      );
    }

    case 'section':
      return (
        <div class="stack">
          <Field label="Arrange" hint="Side by side wraps onto the next line when it runs out of room.">
            <Segmented
              value={block.arrange ?? 'stack'}
              options={[
                { value: 'stack', label: 'Stacked' },
                { value: 'row', label: 'Side by side' },
              ]}
              onChange={(v) => onChange({ ...block, arrange: v === 'stack' ? undefined : 'row' })}
            />
          </Field>
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
            onEscape={
              onEscapeChild &&
              ((child, dir) =>
                onEscapeChild({ ...block, blocks: block.blocks.filter((b) => b.id !== child.id) }, child, dir))
            }
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
                  onEscape={
                    onEscapeChild &&
                    ((child, dir) =>
                      onEscapeChild(
                        {
                          ...block,
                          columns: block.columns.map((c, j) =>
                            j === i ? { ...c, blocks: c.blocks.filter((b) => b.id !== child.id) } : c,
                          ),
                        },
                        child,
                        dir,
                      ))
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
          <Field label="Which projects">
            <Select
              value={block.origin ?? 'professional'}
              options={[
                { value: 'professional', label: 'Professional work' },
                { value: 'personal', label: 'Personal studies' },
              ]}
              onChange={(origin) =>
                onChange({ ...block, origin: origin === 'professional' ? undefined : (origin as 'personal') })
              }
            />
          </Field>
          <Toggle
            checked={Boolean(block.filters)}
            label="Show tag filters above"
            onChange={(v) => onChange({ ...block, filters: v })}
          />
          <p class="field-hint">
            Shows every project on that shelf that isn't hidden, newest first. Covers can be swapped here;
            everything else about a project lives in the Projects tab.
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
