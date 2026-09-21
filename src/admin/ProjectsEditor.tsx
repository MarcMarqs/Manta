import type { Project, ProjectLink } from '../lib/types';
import { ImageField, LinkInput } from './media';
import { createPage } from './PageEditor';
import { PAGES_DIR, PROJECTS, files, openView, projects, setFiles, tags, updateFile, view, type PageFile } from './store';
import { Field, Icon, IconButton, Segmented, TextArea, TextInput, Toggle } from './ui';

const caseStudyPath = (slug: string) => `${PAGES_DIR}work/${slug}.json`;

function blankProject(existing: Project[]): Project {
  let n = existing.length + 1;
  while (existing.some((p) => p.slug === `new-project-${n}`)) n++;
  return {
    slug: `new-project-${n}`,
    title: 'New project',
    genre: '',
    year: new Date().getFullYear(),
    role: '',
    summary: '',
    highlights: [],
    discipline: [],
    engine: [],
    cover: '',
    coverVideo: null,
    featured: false,
    draft: true,
    links: [],
  };
}

function TagPicker({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <Field label={label} wide>
      <div class="chip-picker">
        {options.map((t) => {
          const on = value.includes(t.id);
          return (
            <button
              type="button"
              class={`chip${on ? ' on' : ''}`}
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== t.id) : [...value, t.id])}
            >
              {t.label}
            </button>
          );
        })}
        {!options.length && <span class="field-hint">No tags yet. Add some in the Tags tab.</span>}
      </div>
    </Field>
  );
}

function ProjectForm({ project, index }: { project: Project; index: number }) {
  const all = projects.value;
  const set = (patch: Partial<Project>) =>
    updateFile<Project[]>(PROJECTS, (list) => list.map((p, i) => (i === index ? { ...p, ...patch } : p)));

  const study = caseStudyPath(project.slug);
  const hasStudy = study in files.value;

  /** Renaming the slug also moves the case-study page so the two stay linked. */
  const setSlug = (raw: string) => {
    const slug = raw.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const nextFiles = { ...files.value };
    nextFiles[PROJECTS] = all.map((p, i) => (i === index ? { ...p, slug } : p));
    const target = caseStudyPath(slug);
    if (hasStudy && slug && !(target in nextFiles)) {
      nextFiles[target] = { ...(nextFiles[study] as PageFile), project: slug };
      delete nextFiles[study];
    }
    setFiles(nextFiles);
    view.value = { kind: 'projects', slug };
  };

  const remove = () => {
    if (!confirm(`Delete "${project.title}"?${hasStudy ? ' Its case-study page is kept.' : ''}`)) return;
    updateFile<Project[]>(PROJECTS, (list) => list.filter((_, i) => i !== index), { coalesce: false });
    view.value = { kind: 'projects' };
  };

  const setLink = (i: number, patch: Partial<ProjectLink>) =>
    set({ links: project.links.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  return (
    <div class="stack">
      <div class="row spread">
        <div class="row">
          <Toggle checked={!project.draft} onChange={(v) => set({ draft: !v })} label="Visible on the site" />
          <Toggle checked={project.featured} onChange={(featured) => set({ featured })} label="Featured (shown first)" />
        </div>
        <IconButton icon="trash" label="Delete project" tone="danger" onClick={remove} />
      </div>

      <div class="fields">
        <Field label="Title">
          <TextInput value={project.title} onChange={(title) => set({ title })} />
        </Field>
        <Field label="URL slug" hint={`Case study lives at /work/${project.slug}`}>
          <TextInput value={project.slug} onChange={setSlug} />
        </Field>
        <Field label="Genre">
          <TextInput value={project.genre} onChange={(genre) => set({ genre })} />
        </Field>
        <Field label="Year">
          <input
            class="input"
            type="number"
            value={project.year}
            onInput={(e) => set({ year: Number((e.target as HTMLInputElement).value) || project.year })}
          />
        </Field>
        <Field label="Your role" wide>
          <TextInput value={project.role} onChange={(role) => set({ role })} />
        </Field>
        <Field label="Summary" hint="One or two lines, shown on the card." wide>
          <TextArea rows={2} value={project.summary} onChange={(summary) => set({ summary })} />
        </Field>
        <Field label="Highlights" hint="One per line, up to four are shown." wide>
          <TextArea
            rows={4}
            value={project.highlights.join('\n')}
            onChange={(v) => set({ highlights: v.split('\n').filter((l, i, arr) => l.trim() || i === arr.length - 1) })}
          />
        </Field>
        <TagPicker
          label="Disciplines"
          options={tags.value?.discipline ?? []}
          value={project.discipline}
          onChange={(discipline) => set({ discipline })}
        />
        <TagPicker
          label="Engines & tools"
          options={tags.value?.engine ?? []}
          value={project.engine}
          onChange={(engine) => set({ engine })}
        />
        <Field label="Cover image" wide>
          <ImageField value={project.cover} onChange={(cover) => set({ cover })} />
        </Field>
      </div>

      <section class="subsection">
        <h3>Links</h3>
        {project.links.map((link, i) => (
          <div class="link-row">
            <Segmented
              value={link.type}
              options={[
                { value: 'play', label: 'Play' },
                { value: 'source', label: 'Source' },
                { value: 'doc', label: 'Doc' },
              ]}
              onChange={(type) => setLink(i, { type })}
            />
            <TextInput value={link.label} placeholder="Label" onChange={(label) => setLink(i, { label })} />
            <LinkInput value={link.href} onChange={(href) => setLink(i, { href })} />
            <IconButton
              icon="trash"
              label="Remove link"
              tone="danger"
              onClick={() => set({ links: project.links.filter((_, j) => j !== i) })}
            />
          </div>
        ))}
        <button
          type="button"
          class="btn small ghost"
          onClick={() => set({ links: [...project.links, { type: 'play', label: 'Play', href: '' }] })}
        >
          <Icon name="plus" /> Add link
        </button>
      </section>

      <section class="subsection">
        <h3>Case study</h3>
        {hasStudy ? (
          <button type="button" class="btn" onClick={() => openView({ kind: 'page', path: study })}>
            <Icon name="page" /> Edit case-study page
          </button>
        ) : (
          <button
            type="button"
            class="btn"
            onClick={() => createPage(`/work/${project.slug}`, project.title, 'caseStudy', { project: project.slug })}
          >
            <Icon name="plus" /> Create case-study page
          </button>
        )}
      </section>
    </div>
  );
}

export function ProjectsEditor({ slug }: { slug?: string }) {
  const list = projects.value;
  const index = slug ? list.findIndex((p) => p.slug === slug) : -1;

  const add = () => {
    const project = blankProject(list);
    updateFile<Project[]>(PROJECTS, (l) => [...l, project], { coalesce: false });
    view.value = { kind: 'projects', slug: project.slug };
  };

  return (
    <div class="editor-pane">
      <header class="pane-head">
        <div>
          <p class="eyebrow">Content</p>
          <h1>Projects</h1>
          <p class="muted">Shown by the project rail and grid blocks, featured first, then newest.</p>
        </div>
        <button type="button" class="btn primary small" onClick={add}>
          <Icon name="plus" /> New project
        </button>
      </header>

      <div class="project-list">
        {list.map((p) => (
          <button
            type="button"
            class={`project-item${p.slug === slug ? ' active' : ''}`}
            onClick={() => (view.value = { kind: 'projects', slug: p.slug === slug ? undefined : p.slug })}
          >
            <span class="project-title">{p.title || 'Untitled'}</span>
            <span class="muted">
              {p.year}
              {p.draft ? ' · hidden' : ''}
              {p.featured ? ' · featured' : ''}
            </span>
          </button>
        ))}
      </div>

      {index >= 0 ? (
        <ProjectForm key={index} project={list[index]} index={index} />
      ) : (
        <p class="empty">Pick a project to edit it.</p>
      )}
    </div>
  );
}
