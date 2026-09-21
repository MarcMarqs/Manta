import { useState } from 'preact/hooks';
import type { Project, Tag, Tags } from '../lib/types';
import { PROJECTS, TAGS, files, projects, setFiles, tags, updateFile } from './store';
import { Field, IconButton, TextInput } from './ui';

const toId = (label: string) =>
  label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

function TagGroup({ group, title, hint }: { group: keyof Tags; title: string; hint: string }) {
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
          <span class="muted mono small">{tag.id}</span>
          <span class="muted small">{usage(tag.id)} projects</span>
          <IconButton icon="trash" label="Delete tag" tone="danger" onClick={() => remove(tag.id)} />
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

export function TagsEditor() {
  return (
    <div class="editor-pane">
      <header class="pane-head">
        <div>
          <p class="eyebrow">Content</p>
          <h1>Tags</h1>
          <p class="muted">The filter buttons on the project rail and grid come from this list.</p>
        </div>
      </header>
      <TagGroup group="discipline" title="Disciplines" hint="What kind of design work a project shows." />
      <TagGroup group="engine" title="Engines & tools" hint="What it was built with." />
    </div>
  );
}
