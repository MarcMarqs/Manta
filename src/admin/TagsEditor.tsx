import { useState } from 'preact/hooks';
import type { Block, Project, Tag, Tags } from '../lib/types';
import { PROJECTS, TAGS, files, pagePaths, projects, setFiles, tags, updateFile, type PageFile } from './store';
import { Field, IconButton, TextInput, Toggle } from './ui';

const toId = (label: string) =>
  label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function TagGroup({ group, title, hint }: { group: 'discipline' | 'engine'; title: string; hint: string }) {
  const list = tags.value?.[group] ?? [];
  const [draft, setDraft] = useState('');
  const usage = (id: string) => projects.value.filter((p) => p[group].includes(id)).length;

  const setList = (next: Tag[]) => updateFile<Tags>(TAGS, (t) => ({ ...t, [group]: next }));

  const add = () => {
    const label = draft.trim();
    const id = toId(label);
    if (!id) return;
    if ([...tags.value.discipline, ...tags.value.engine].some((t) => t.id === id)) {
      setDraft('');
      return;
    }
    setList([...list, { id, label }]);
    setDraft('');
  };

  /** Removing a tag also strips it from every project, so no project points at a missing tag. */
  const remove = (id: string) => {
    const n = usage(id);
    if (n && !confirm(`${n} project${n === 1 ? ' uses' : 's use'} this tag. Remove it from ${n === 1 ? 'it' : 'them'} too?`)) return;
    setFiles(
      {
        ...files.value,
        [TAGS]: { ...tags.value, [group]: list.filter((t) => t.id !== id) },
        [PROJECTS]: (files.value[PROJECTS] as Project[]).map((p) => ({ ...p, [group]: p[group].filter((x) => x !== id) })),
      },
      { coalesce: false },
    );
  };

  return (
    <section class="subsection">
      <h3>{title}</h3>
      <p class="field-hint">{hint}</p>
      {list.map((tag, i) => (
        <div class="tag-row">
          <TextInput value={tag.label} onChange={(label) => setList(list.map((t, j) => (j === i ? { ...t, label } : t)))} />
          <span class="tag-actions">
            <IconButton icon="trash" label="Delete tag" tone="danger" onClick={() => remove(tag.id)} />
          </span>
          <span class="tag-meta">
            <span class="muted mono">{tag.id}</span>
            <span class="muted">{usage(tag.id)} projects</span>
            <Toggle
              checked={Boolean(tag.accent)}
              label="Accent"
              onChange={(accent) => setList(list.map((t, j) => (j === i ? { ...t, accent: accent || undefined } : t)))}
            />
          </span>
        </div>
      ))}
      <form
        class="tag-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Field label="New tag">
          <TextInput value={draft} onChange={setDraft} placeholder="e.g. Combat Design" />
        </Field>
        <button type="submit" class="btn small" disabled={!toId(draft)}>
          Add
        </button>
      </form>
    </section>
  );
}

/**
 * The shelves work is divided into.
 *
 * Unlike a tag, every project has exactly one, so there is always a first entry and it is
 * the one a project lands on by default. That makes the order meaningful and makes the
 * last origin undeletable — take it away and projects would point at nothing.
 */
/** Every rail and grid in a block tree, however deeply nested, aimed at this shelf. */
function shelvesIn(blocks: Block[]): Extract<Block, { type: 'projectRail' | 'projectGrid' }>[] {
  return blocks.flatMap((b) => {
    if (b.type === 'projectRail' || b.type === 'projectGrid') return [b];
    if (b.type === 'section') return shelvesIn(b.blocks);
    if (b.type === 'columns') return b.columns.flatMap((c) => shelvesIn(c.blocks));
    return [];
  });
}

/** The same tree with every rail and grid on `from` moved to `to`. */
function repoint(blocks: Block[], from: string, to: string): Block[] {
  return blocks.map((b) => {
    if ((b.type === 'projectRail' || b.type === 'projectGrid') && b.origin === from) return { ...b, origin: to };
    if (b.type === 'section') return { ...b, blocks: repoint(b.blocks, from, to) };
    if (b.type === 'columns') {
      return { ...b, columns: b.columns.map((c) => ({ ...c, blocks: repoint(c.blocks, from, to) })) };
    }
    return b;
  });
}

function OriginGroup() {
  const list = tags.value?.origin ?? [];
  const [draft, setDraft] = useState('');
  const usage = (id: string) =>
    projects.value.filter((p) => (p.origin ?? list[0]?.id) === id).length;
  const shelvesPointedAt = (id: string) =>
    pagePaths.value.flatMap((path) =>
      shelvesIn((files.value[path] as PageFile).blocks).filter((b) => b.origin === id),
    );

  const setList = (next: Tag[]) => updateFile<Tags>(TAGS, (t) => ({ ...t, origin: next }));

  const add = () => {
    const label = draft.trim();
    const id = toId(label);
    if (!id) return;
    if (list.some((o) => o.id === id)) {
      setDraft('');
      return;
    }
    setList([...list, { id, label }]);
    setDraft('');
  };

  /**
   * What is left over has to go somewhere, so it goes to the first shelf that remains —
   * both the projects that sat here and every rail or grid that was pointed at it. A
   * block left aimed at a missing shelf would simply show nothing, with no sign why.
   */
  const remove = (id: string) => {
    if (list.length <= 1) return;
    const n = usage(id);
    const rest = list.filter((o) => o.id !== id);
    const fallback = rest[0];
    const blocks = shelvesPointedAt(id).length;
    const moved = [
      n && `${n === 1 ? '1 project sits' : `${n} projects sit`} here`,
      blocks && `${blocks === 1 ? '1 rail or grid shows' : `${blocks} rails or grids show`} it`,
    ].filter(Boolean);
    if (moved.length && !confirm(`${moved.join(', and ')}. Move ${moved.length > 1 ? 'them' : 'that'} to ${fallback.label}?`)) {
      return;
    }

    const pages = Object.fromEntries(
      pagePaths.value.map((path) => {
        const page = files.value[path] as PageFile;
        return [path, { ...page, blocks: repoint(page.blocks, id, fallback.id) }];
      }),
    );

    setFiles(
      {
        ...files.value,
        ...pages,
        [TAGS]: { ...tags.value, origin: rest },
        [PROJECTS]: (files.value[PROJECTS] as Project[]).map((p) =>
          (p.origin ?? list[0]?.id) === id ? { ...p, origin: fallback.id } : p,
        ),
      },
      { coalesce: false },
    );
  };

  const move = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= list.length) return;
    const next = [...list];
    const [item] = next.splice(i, 1);
    next.splice(to, 0, item);
    // Projects that were only on the old first shelf by default would otherwise move with
    // it, so the default is written down before the order changes under them.
    setFiles(
      {
        ...files.value,
        [TAGS]: { ...tags.value, origin: next },
        [PROJECTS]: (files.value[PROJECTS] as Project[]).map((p) =>
          p.origin ? p : { ...p, origin: list[0]?.id },
        ),
      },
      { coalesce: false },
    );
  };

  return (
    <section class="subsection">
      <h3>Origins</h3>
      <p class="field-hint">
        The shelves a project can sit on, and the ones a project rail or grid can be pointed at. The first is where a
        new project lands.
      </p>
      {list.map((origin, i) => (
        <div class="tag-row">
          <TextInput
            value={origin.label}
            onChange={(label) => setList(list.map((o, j) => (j === i ? { ...o, label } : o)))}
          />
          <span class="tag-actions">
            <IconButton icon="up" label="Move up" disabled={i === 0} onClick={() => move(i, -1)} />
            <IconButton icon="down" label="Move down" disabled={i === list.length - 1} onClick={() => move(i, 1)} />
            <IconButton
              icon="trash"
              label={list.length <= 1 ? 'The last origin cannot be removed' : 'Delete origin'}
              tone="danger"
              disabled={list.length <= 1}
              onClick={() => remove(origin.id)}
            />
          </span>
          <span class="tag-meta">
            <span class="muted mono">{origin.id}</span>
            <span class="muted">{usage(origin.id)} projects</span>
          </span>
        </div>
      ))}
      <form
        class="tag-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Field label="New origin">
          <TextInput value={draft} onChange={setDraft} placeholder="e.g. Game jams" />
        </Field>
        <button type="submit" class="btn small" disabled={!toId(draft)}>
          Add
        </button>
      </form>
    </section>
  );
}

export function TagsEditor() {
  return (
    <div class="editor-pane">
      <header class="pane-head">
        <div>
          <p class="eyebrow">Content</p>
          <h1>Tags</h1>
          <p class="muted">The shelves work is divided into, and the filter buttons on the rail and grid.</p>
        </div>
      </header>
      <OriginGroup />
      <TagGroup
        group="discipline"
        title="Disciplines"
        hint="What kind of design work a project shows. Accent draws a tag in the accent colour on project cards and under a case study."
      />
      <TagGroup
        group="engine"
        title="Engines & tools"
        hint="What it was built with. Accenting these is the quickest way to tell tools from disciplines at a glance."
      />
    </div>
  );
}
