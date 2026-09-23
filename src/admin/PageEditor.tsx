import { useEffect, useState } from 'preact/hooks';
import type { Block, Site } from '../lib/types';
import { BlockListEditor } from './BlockEditor';
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

export function createPage(route: string, title: string, template: keyof typeof TEMPLATES, extra?: Partial<PageFile>) {
  const path = routeToFile(route);
  const page: PageFile = { title, description: '', ...extra, blocks: TEMPLATES[template].blocks(title) };
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
    createPage(`/${effective}`, title.trim(), template);
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
        <Field label="Start from">
          <Select
            value={template}
            options={Object.entries(TEMPLATES).map(([value, t]) => ({ value: value as keyof typeof TEMPLATES, label: t.label }))}
            onChange={setTemplate}
          />
        </Field>
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
        [SITE]: { ...site, nav: site.nav.map((n) => (n.href === oldRoute ? { ...n, href: newRoute } : n)) },
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
  useEffect(() => setJsonMode(false), [path]);

  if (!page) return <p class="empty">This page no longer exists.</p>;

  const set = (patch: Partial<PageFile>) => updateFile<PageFile>(path, (p) => ({ ...p, ...patch }));
  const isHome = path === HOME;
  const route = fileToRoute(path);

  const remove = () => {
    if (!confirm(`Delete the page ${route}? You can undo this until you save.`)) return;
    const { [path]: _gone, ...rest } = files.value;
    const site = rest[SITE] as Site;
    setFiles({ ...rest, [SITE]: { ...site, nav: site.nav.filter((n) => n.href !== route) } }, { coalesce: false });
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
          {!isHome && <IconButton icon="trash" label="Delete page" tone="danger" onClick={remove} />}
        </div>
      </header>

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
              {path.startsWith(`${PAGES_DIR}work/`) && (
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
