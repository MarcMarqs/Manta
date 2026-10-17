import { useEffect, useRef, useState } from 'preact/hooks';
import type { Block, Site } from '../lib/types';
import { BlockListEditor } from './BlockEditor';
import { cloneBlock } from './blocks';
import {
  HOME,
  PAGES_DIR,
  SITE,
  fileToRoute,
  files,
  openView,
  projects,
  routeToFile,
  setFiles,
  toast,
  updateFile,
  type PageFile,
} from './store';
import { blocksFromMarkdown } from './markdown';
import { ImageField } from './media';
import { Field, Icon, IconButton, Modal, Select, TextArea, TextInput, Toggle } from './ui';

const RESERVED = ['admin', 'api', 'images', '_astro', '404'];

/** Why a route can't be used for a page, or null if it can. */
export function routeProblem(route: string, current?: string): string | null {
  const slug = route.replace(/^\/+|\/+$/g, '');
  if (!slug) return 'Enter a URL, like about or work/my-game.';
  if (!/^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/.test(slug))
    return 'Use lowercase letters, numbers and hyphens, with / between parts.';
  if (slug === 'home' || RESERVED.includes(slug.split('/')[0])) return `"${slug}" is reserved.`;
  const file = routeToFile(`/${slug}`);
  if (file !== current && file in files.value) return 'A page with that URL already exists.';
  return null;
}

const TEMPLATES: Record<string, { label: string; blocks: (title: string) => Block[] }> = {
  blank: {
    label: 'Blank',
    blocks: (title) => [{ id: 'title', type: 'heading', level: 1, text: title }],
  },
  caseStudy: {
    label: 'Case study',
    blocks: (title) => [
      { id: 'title', type: 'heading', level: 1, text: title },
      ...['Overview', 'Goals', 'Process', 'Outcome', 'Takeaways'].flatMap((h): Block[] => {
        const key = h.toLowerCase();
        return [
          { id: `h-${key}`, type: 'heading', level: 2, text: h },
          { id: `t-${key}`, type: 'text', html: '<p></p>' },
        ];
      }),
    ],
  },
};

/** `about` → `about-copy`, then `about-copy-2`, until one is free. */
function freeRoute(route: string): string {
  const base = `${route.replace(/\/+$/, '')}-copy`;
  if (!routeProblem(base)) return base;
  for (let n = 2; n < 500; n++) {
    if (!routeProblem(`${base}-${n}`)) return `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

/**
 * A page copied whole, at an address of its own.
 *
 * Every block is cloned rather than shared, which gives each one a new id: ids are what
 * the editor selects by and what headings anchor to, and two pages holding the same ones
 * is a knot waiting to be pulled.
 *
 * The copy does not carry the original's project. A case study is the page for a project,
 * and two of them claiming the same one leaves no answer to which is which — the tags, the
 * next-case-study link and, for private work, the one address it answers on.
 */
export function duplicatePage(path: string) {
  const page = files.value[path] as PageFile | undefined;
  if (!page) return;
  const route = freeRoute(fileToRoute(path));
  const copy: PageFile = {
    ...page,
    title: `${page.title || 'Untitled'} (copy)`,
    project: undefined,
    blocks: page.blocks.map(cloneBlock),
  };
  const next = routeToFile(route);
  setFiles({ ...files.value, [next]: copy }, { coalesce: false });
  openView({ kind: 'page', path: next });
  toast(`Copied to ${route}.`);
  return next;
}

export function createPage(
  route: string,
  title: string,
  template: keyof typeof TEMPLATES,
  extra?: Partial<PageFile>,
  blocks?: Block[],
) {
  const path = routeToFile(route);
  const page: PageFile = { title, description: '', ...extra, blocks: blocks ?? TEMPLATES[template].blocks(title) };
  setFiles({ ...files.value, [path]: page }, { coalesce: false });
  openView({ kind: 'page', path });
  return path;
}

export function NewPageDialog({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [route, setRoute] = useState('');
  const [touchedRoute, setTouchedRoute] = useState(false);
  const [template, setTemplate] = useState<keyof typeof TEMPLATES>('blank');
  const [addToNav, setAddToNav] = useState(false);
  /** A Markdown file, once one has been chosen, waiting for Create page. */
  const [imported, setImported] = useState<{ name: string; blocks: Block[] } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const takeMarkdown = async (chosen: File | undefined | null) => {
    const content = await readText(chosen);
    if (content === null || !chosen) return;
    const md = blocksFromMarkdown(content);
    if (!md.blocks.length) {
      toast('That file had nothing in it.', 'error');
      return;
    }
    setImported({ name: chosen.name, blocks: md.blocks });
    // The file knows what it is called and what it is about; neither is worth retyping.
    if (!title.trim()) setTitle(md.title ?? chosen.name.replace(/\.[^.]+$/, ''));
  };

  const suggested = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const effective = touchedRoute ? route : suggested;
  const problem = title.trim() ? routeProblem(effective) : 'Give the page a title.';

  const submit = () => {
    if (problem) return;
    createPage(`/${effective}`, title.trim(), template, undefined, imported?.blocks);
    if (addToNav) {
      updateFile<Site>(SITE, (s) => ({ ...s, nav: [...s.nav, { label: title.trim(), href: `/${effective}` }] }), {
        coalesce: false,
      });
    }
    onClose();
  };

  return (
    <Modal
      title="New page"
      onClose={onClose}
      footer={
        <>
          <button type="button" class="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" class="btn primary" disabled={Boolean(problem)} onClick={submit}>
            Create page
          </button>
        </>
      }
    >
      <form
        class="stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Title">
          <TextInput value={title} onChange={setTitle} autoFocus placeholder="Contact" />
        </Field>
        <Field label="URL" hint={problem && (title || touchedRoute) ? problem : `yoursite/${effective || '…'}`}>
          <div class="prefixed">
            <span>/</span>
            <TextInput
              value={effective}
              onChange={(v) => {
                setTouchedRoute(true);
                setRoute(v.replace(/^\/+/, ''));
              }}
            />
          </div>
        </Field>
        <Field label="Start from" hint={imported ? `${imported.blocks.length} blocks from ${imported.name}` : undefined}>
          {imported ? (
            <div class="row">
              <span class="pill ok">
                <Icon name="markdown" /> {imported.name}
              </span>
              <button type="button" class="btn small ghost" onClick={() => setImported(null)}>
                Use a template instead
              </button>
            </div>
          ) : (
            <div class="row">
              <button type="button" class="btn small ghost" onClick={() => file.current?.click()}>
                <Icon name="markdown" /> From a Markdown file
              </button>
              <input
                ref={file}
                type="file"
                accept=".md,.markdown,.mdx,.txt,text/markdown,text/plain"
                hidden
                onChange={(e) => {
                  takeMarkdown((e.target as HTMLInputElement).files?.[0]);
                  (e.target as HTMLInputElement).value = '';
                }}
              />
            </div>
          )}
        </Field>
        {!imported && (
        <Field label="Template">
          <Select
            value={template}
            options={Object.entries(TEMPLATES).map(([value, t]) => ({ value: value as keyof typeof TEMPLATES, label: t.label }))}
            onChange={setTemplate}
          />
        </Field>
        )}
        <Toggle checked={addToNav} onChange={setAddToNav} label="Add to the navigation menu" />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function RouteField({ path }: { path: string }) {
  const current = fileToRoute(path).slice(1);
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current]);
  const problem = value === current ? null : routeProblem(value, path);

  const commit = () => {
    if (value === current || problem) {
      setValue(current);
      return;
    }
    const next = routeToFile(`/${value}`);
    const oldRoute = `/${current}`;
    const newRoute = `/${value.replace(/^\/+|\/+$/g, '')}`;
    // Renaming moves the file and repoints the nav at the new URL.
    const { [path]: page, ...rest } = files.value;
    const site = rest[SITE] as Site;
    setFiles(
      {
        ...rest,
        [next]: page,
        [SITE]: {
          ...site,
          nav: site.nav.map((n) => (n.href === oldRoute ? { ...n, href: newRoute } : n)),
          // The page keeps its place in the list; only its address changed.
          pageOrder: site.pageOrder?.map((p) => (p === path ? next : p)),
        },
      },
      { coalesce: false },
    );
    openView({ kind: 'page', path: next });
    toast(`Page moved to ${newRoute}. Links in page text aren't updated automatically.`);
  };

  return (
    <Field label="URL" hint={problem ?? 'Changes when you leave the field.'}>
      <div class="prefixed">
        <span>/</span>
        <input
          class={`input${problem ? ' invalid' : ''}`}
          value={value}
          onInput={(e) => setValue((e.target as HTMLInputElement).value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
    </Field>
  );
}

/** Reads a dropped or chosen file as text, or null if it isn't one we can read. */
async function readText(file: File | undefined | null): Promise<string | null> {
  if (!file) return null;
  if (!/\.(md|markdown|mdx|txt)$/i.test(file.name) && !file.type.startsWith('text/')) {
    toast('Choose a .md file.', 'error');
    return null;
  }
  return file.text();
}

/**
 * Markdown in, blocks out, with a look at what came back first.
 *
 * It replaces or appends rather than merging, because a merge would have to guess which
 * of two versions of a paragraph you meant. Both land as an undoable change, so a bad
 * import is one Ctrl+Z away rather than a restore from history.
 */
function MarkdownDialog({ path, onClose }: { path: string; onClose: () => void }) {
  const page = files.value[path] as PageFile;
  const [text, setText] = useState('');
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const parsed = text.trim() ? blocksFromMarkdown(text) : null;

  const take = async (file: File | undefined | null) => {
    const content = await readText(file);
    if (content !== null) setText(content);
  };

  const apply = (mode: 'replace' | 'append') => {
    if (!parsed?.blocks.length) return;
    updateFile<PageFile>(
      path,
      (p) => ({
        ...p,
        title: mode === 'replace' && parsed.title ? parsed.title : p.title,
        blocks: mode === 'replace' ? parsed.blocks : [...p.blocks, ...parsed.blocks],
      }),
      { coalesce: false },
    );
    toast(`${parsed.blocks.length} block${parsed.blocks.length === 1 ? '' : 's'} imported. Undo with Ctrl+Z.`, 'success');
    onClose();
  };

  const counts = parsed
    ? Object.entries(
        parsed.blocks.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.type]: (acc[b.type] ?? 0) + 1 }), {}),
      )
        .map(([type, n]) => `${n} ${type}`)
        .join(' · ')
    : '';

  return (
    <Modal
      title="Import Markdown"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" class="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            class="btn"
            disabled={!parsed?.blocks.length}
            onClick={() => apply('append')}
            title={`Add to the end of ${page.title || 'this page'}`}
          >
            Add to the end
          </button>
          <button type="button" class="btn primary" disabled={!parsed?.blocks.length} onClick={() => apply('replace')}>
            Replace the page
          </button>
        </>
      }
    >
      <div
        class={`md-drop${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          if (e.dataTransfer?.types.includes('Files')) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take(e.dataTransfer?.files?.[0]);
        }}
      >
        <button type="button" class="btn small" onClick={() => input.current?.click()}>
          <Icon name="upload" /> Choose a .md file
        </button>
        <span class="field-hint">or drop one here, or paste it below.</span>
        <input
          ref={input}
          type="file"
          accept=".md,.markdown,.mdx,.txt,text/markdown,text/plain"
          hidden
          onChange={(e) => {
            take((e.target as HTMLInputElement).files?.[0]);
            (e.target as HTMLInputElement).value = '';
          }}
        />
      </div>
      <TextArea mono rows={14} value={text} onChange={setText} />
      <p class="field-hint">
        {parsed?.blocks.length
          ? `${counts}${parsed.title ? ` · title "${parsed.title}"` : ''}`
          : 'Headings, prose, lists, quotes, links, pictures, tables, rules and code become blocks. Charts, rails and spec strips are not things Markdown can say — add those afterwards.'}
      </p>
    </Modal>
  );
}

function JsonEditor({ path, onDone }: { path: string; onDone: () => void }) {
  const [text, setText] = useState(() => JSON.stringify(files.value[path], null, 2));
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.blocks)) throw new Error('A page needs a "blocks" array.');
      updateFile(path, () => parsed, { coalesce: false });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div class="stack">
      <TextArea mono rows={28} value={text} onChange={(v) => (setText(v), setError(null))} />
      {error && <p class="error-text">{error}</p>}
      <div class="row">
        <button type="button" class="btn primary" onClick={apply}>
          Apply JSON
        </button>
        <button type="button" class="btn ghost" onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PageEditor({ path }: { path: string }) {
  const page = files.value[path] as PageFile | undefined;
  const [jsonMode, setJsonMode] = useState(false);
  const [importing, setImporting] = useState(false);
  useEffect(() => setJsonMode(false), [path]);

  if (!page) return <p class="empty">This page no longer exists.</p>;

  const set = (patch: Partial<PageFile>) => updateFile<PageFile>(path, (p) => ({ ...p, ...patch }));
  const isHome = path === HOME;
  const route = fileToRoute(path);

  const remove = () => {
    if (!confirm(`Delete the page ${route}? You can undo this until you save.`)) return;
    const { [path]: _gone, ...rest } = files.value;
    const site = rest[SITE] as Site;
    setFiles(
      {
        ...rest,
        [SITE]: {
          ...site,
          nav: site.nav.filter((n) => n.href !== route),
          pageOrder: site.pageOrder?.filter((p) => p !== path),
        },
      },
      { coalesce: false },
    );
    openView({ kind: 'page', path: HOME });
  };

  return (
    <div class="editor-pane">
      <header class="pane-head">
        <div>
          <p class="eyebrow">{isHome ? 'Home page' : 'Page'}</p>
          <h1>{page.title || 'Untitled'}</h1>
          <p class="muted mono">{route}</p>
        </div>
        <div class="row">
          <button type="button" class={`btn small ghost${jsonMode ? ' active' : ''}`} onClick={() => setJsonMode(!jsonMode)}>
            <Icon name="code" /> JSON
          </button>
          <button type="button" class="btn small ghost" onClick={() => setImporting(true)} title="Build blocks from a Markdown file">
            <Icon name="markdown" /> Markdown
          </button>
          <IconButton icon="copy" label="Duplicate page" onClick={() => duplicatePage(path)} />
          {!isHome && <IconButton icon="trash" label="Delete page" tone="danger" onClick={remove} />}
        </div>
      </header>

      {importing && <MarkdownDialog path={path} onClose={() => setImporting(false)} />}

      {jsonMode ? (
        <JsonEditor path={path} onDone={() => setJsonMode(false)} />
      ) : (
        <>
          <details class="page-settings">
            <summary>Page settings</summary>
            <div class="fields">
              <Field label="Title" hint="Shown in the browser tab.">
                <TextInput value={page.title} onChange={(title) => set({ title })} />
              </Field>
              {!isHome && <RouteField path={path} />}
              <Field label="Description" hint="Shown in search results and link previews." wide>
                <TextInput value={page.description ?? ''} onChange={(description) => set({ description })} />
              </Field>
              <Field
                label="Link preview image"
                hint="Optional. Falls back to the project cover, then the site-wide one."
                wide
              >
                <ImageField value={page.image ?? ''} onChange={(image) => set({ image: image || undefined })} />
              </Field>
              <Field label="Contents list" wide>
                <Toggle
                  checked={page.toc !== false}
                  onChange={(v) => set({ toc: v ? undefined : false })}
                  label="Float a jump-to-section list beside long pages"
                />
              </Field>
              {path.startsWith(`${PAGES_DIR}work/`) && (
                <>
                  <Field label="Case study for">
                    <Select
                      value={page.project ?? ''}
                      options={[
                        { value: '', label: 'No project' },
                        ...projects.value.map((p) => ({ value: p.slug, label: p.title })),
                      ]}
                      onChange={(project) => set({ project: project || undefined })}
                    />
                  </Field>
                  <Field label="Next case study" hint="The card at the foot of this page.">
                    <Select
                      value={page.next ?? ''}
                      options={[
                        { value: '', label: 'The next project' },
                        { value: 'origin', label: 'The next in the same origin' },
                        { value: 'none', label: 'Nothing — end the page here' },
                        ...projects.value
                          .filter((p) => p.slug !== page.project)
                          .map((p) => ({ value: p.slug, label: `→ ${p.title}` })),
                      ]}
                      onChange={(next) => set({ next: next || undefined })}
                    />
                  </Field>
                </>
              )}
            </div>
          </details>

          <BlockListEditor
            blocks={page.blocks}
            onChange={(blocks) => set({ blocks })}
            emptyHint="This page is empty. Add its first block."
          />
        </>
      )}
    </div>
  );
}
