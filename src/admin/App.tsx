import { useEffect, useState } from 'preact/hooks';
import { api, ApiError } from './api';
import { LinkSuggestions } from './media';
import { NewPageDialog, PageEditor } from './PageEditor';
import { Preview } from './Preview';
import { ProjectsEditor } from './ProjectsEditor';
import { SiteEditor } from './SiteEditor';
import { TagsEditor } from './TagsEditor';
import {
  HOME,
  busy,
  canRedo,
  canUndo,
  dirtyPaths,
  fileToRoute,
  files,
  loadAll,
  openView,
  pagePaths,
  redo,
  save,
  status,
  toast,
  toasts,
  undo,
  view,
  type PageFile,
} from './store';
import { Icon, IconButton, Logo, Modal } from './ui';
import './admin.css';

// --- login ---------------------------------------------------------------

function Login({ onDone, configured }: { onDone: () => void; configured: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: Event) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.login(password);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  };

  return (
    <div class="login">
      <form class="login-card" onSubmit={submit}>
        <Logo big />
        <h1>Manta</h1>
        <p class="muted">Sign in to edit your site.</p>
        {configured ? (
          <>
            <input
              class="input"
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            />
            {error && <p class="error-text">{error}</p>}
            <button class="btn primary" type="submit" disabled={!password || pending}>
              {pending ? 'Signing in…' : 'Sign in'}
            </button>
          </>
        ) : (
          <p class="error-text">
            No password is set. Add an <code>ADMIN_PASSWORD</code> secret to the Worker in Cloudflare (or to{' '}
            <code>.dev.vars</code> when running locally), then reload.
          </p>
        )}
      </form>
    </div>
  );
}

// --- publish -------------------------------------------------------------

function PublishDialog({ onClose }: { onClose: () => void }) {
  const s = status.value;
  const [pending, setPending] = useState(false);
  if (!s) return null;

  const publish = async () => {
    setPending(true);
    busy.value = 'Publishing…';
    try {
      const result = await api.publish();
      status.value = result.status;
      toast(
        'Published. The live site rebuilds in about a minute.',
        'success',
        s.liveUrl ? { label: 'Open live site', href: s.liveUrl } : undefined,
      );
      onClose();
    } catch (err) {
      toast(`Publish failed: ${(err as Error).message}`, 'error');
      setPending(false);
    } finally {
      busy.value = null;
    }
  };

  return (
    <Modal
      title="Publish to the live site"
      onClose={onClose}
      footer={
        <>
          <button type="button" class="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" class="btn primary" onClick={publish} disabled={pending}>
            {pending ? 'Publishing…' : 'Publish now'}
          </button>
        </>
      }
    >
      <p>
        {s.ahead} saved change{s.ahead === 1 ? '' : 's'} will go live. These files differ from the live site:
      </p>
      <ul class="file-list">
        {s.changedFiles.map((f) => (
          <li class="mono">{f}</li>
        ))}
      </ul>
      {s.previewUrl && (
        <p class="muted">
          Check the{' '}
          <a href={s.previewUrl} target="_blank" rel="noreferrer">
            preview site
          </a>{' '}
          first if you haven't. It shows exactly what will be published.
        </p>
      )}
      {s.behind > 0 && (
        <p class="muted">
          The live site has {s.behind} newer commit{s.behind === 1 ? '' : 's'} (probably code changes). They'll be kept
          and merged with your edits.
        </p>
      )}
    </Modal>
  );
}

// --- top bar -------------------------------------------------------------

function StatusPill() {
  const dirty = dirtyPaths.value.length;
  const s = status.value;
  if (busy.value) return <span class="pill busy"><span class="spinner" />{busy.value}</span>;
  if (dirty) return <span class="pill warn">{dirty} unsaved change{dirty === 1 ? '' : 's'}</span>;
  if (s?.backend === 'local') return <span class="pill">Local mode · saves write to your files</span>;
  if (s?.ahead) return <span class="pill info">Draft · {s.ahead} change{s.ahead === 1 ? '' : 's'} not live yet</span>;
  return <span class="pill ok">Everything is live</span>;
}

function TopBar({ onPublish, onLogout }: { onPublish: () => void; onLogout: () => void }) {
  const dirty = dirtyPaths.value.length > 0;
  const s = status.value;
  const [menu, setMenu] = useState(false);

  const discard = async () => {
    setMenu(false);
    if (!confirm('Throw away every saved draft change that is not live yet? This cannot be undone.')) return;
    busy.value = 'Discarding draft…';
    try {
      await api.discard();
      await loadAll();
      toast('Draft discarded. Showing the live content.', 'success');
    } catch (err) {
      toast(`Discard failed: ${(err as Error).message}`, 'error');
    } finally {
      busy.value = null;
    }
  };

  const reload = async () => {
    setMenu(false);
    if (dirty && !confirm('Reload from the repository? Unsaved changes will be lost.')) return;
    busy.value = 'Reloading…';
    try {
      await loadAll();
    } finally {
      busy.value = null;
    }
  };

  return (
    <header class="topbar">
      <div class="brand">
        <Logo />
        <span>Manta</span>
      </div>
      <div class="row">
        <IconButton icon="undo" label="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo.value} />
        <IconButton icon="redo" label="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo.value} />
      </div>
      <div class="topbar-status">
        <StatusPill />
      </div>
      <div class="row">
        {s?.previewUrl && s.draftExists && (
          <a class="btn small ghost" href={s.previewUrl} target="_blank" rel="noreferrer">
            Preview site <Icon name="external" />
          </a>
        )}
        <button
          type="button"
          class={`btn small${dirty ? ' primary' : ''}`}
          onClick={save}
          disabled={!dirty || Boolean(busy.value)}
          title="Ctrl+S"
        >
          {s?.backend === 'local' ? 'Save' : 'Save draft'}
        </button>
        {s?.backend !== 'local' && (
          <button
            type="button"
            class="btn small accent"
            onClick={onPublish}
            disabled={dirty || !s?.ahead || Boolean(busy.value)}
            title={dirty ? 'Save your changes first' : !s?.ahead ? 'Nothing to publish' : 'Make the draft live'}
          >
            Publish
          </button>
        )}
        <div class="menu-wrap">
          <IconButton icon="grip" label="More" onClick={() => setMenu(!menu)} />
          {menu && (
            <div class="menu" onMouseLeave={() => setMenu(false)}>
              {s?.liveUrl && (
                <a href={s.liveUrl} target="_blank" rel="noreferrer">
                  Open live site
                </a>
              )}
              <button type="button" onClick={reload}>
                Reload from repository
              </button>
              {s?.backend !== 'local' && (
                <button type="button" onClick={discard} disabled={!s?.draftExists}>
                  Discard draft…
                </button>
              )}
              <button type="button" onClick={onLogout}>
                <Icon name="logout" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// --- sidebar -------------------------------------------------------------

function Sidebar({ onNewPage }: { onNewPage: () => void }) {
  const v = view.value;
  const dirty = new Set(dirtyPaths.value);
  const nav = (active: boolean, dirtyDot: boolean, icon: string, label: string, onClick: () => void, sub?: string) => (
    <button type="button" class={`side-item${active ? ' active' : ''}`} onClick={onClick}>
      <Icon name={icon} />
      <span class="side-label">
        {label}
        {sub && <span class="side-sub mono">{sub}</span>}
      </span>
      {dirtyDot && <span class="dot" title="Unsaved changes" />}
    </button>
  );

  return (
    <nav class="sidebar">
      <div class="side-group">
        <div class="side-head">
          <span>Pages</span>
          <IconButton icon="plus" label="New page" onClick={onNewPage} />
        </div>
        {pagePaths.value.map((path) => {
          const page = files.value[path] as PageFile;
          return nav(
            v.kind === 'page' && v.path === path,
            dirty.has(path),
            path === HOME ? 'home' : 'page',
            page.title || 'Untitled',
            () => openView({ kind: 'page', path }),
            fileToRoute(path),
          );
        })}
      </div>
      <div class="side-group">
        <div class="side-head">
          <span>Site</span>
        </div>
        {nav(v.kind === 'projects', dirty.has('content/projects.json'), 'grid', 'Projects', () => openView({ kind: 'projects' }))}
        {nav(v.kind === 'site', dirty.has('content/site.json'), 'palette', 'Site & theme', () => openView({ kind: 'site' }))}
        {nav(v.kind === 'tags', dirty.has('content/tags.json'), 'tag', 'Tags', () => openView({ kind: 'tags' }))}
      </div>
    </nav>
  );
}

function Toasts() {
  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.value.map((t) => (
        <div class={`toast ${t.tone}`}>
          <span>{t.message}</span>
          {t.action && (
            <a href={t.action.href} target="_blank" rel="noreferrer">
              {t.action.label} <Icon name="external" />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

// --- app -----------------------------------------------------------------

type Phase = { kind: 'checking' } | { kind: 'login'; configured: boolean } | { kind: 'loading' } | { kind: 'ready' } | { kind: 'error'; message: string };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const [newPage, setNewPage] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const start = async () => {
    setPhase({ kind: 'loading' });
    try {
      await loadAll();
      setPhase({ kind: 'ready' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setPhase({ kind: 'login', configured: true });
      else setPhase({ kind: 'error', message: (err as Error).message });
    }
  };

  useEffect(() => {
    api
      .session()
      .then((s) => (s.authed ? start() : setPhase({ kind: 'login', configured: s.passwordConfigured })))
      .catch((err) => setPhase({ kind: 'error', message: err.message }));
  }, []);

  // Keyboard shortcuts and the unsaved-changes guard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        save();
      } else if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirtyPaths.value.length) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, []);

  const logout = async () => {
    if (dirtyPaths.value.length && !confirm('Sign out and lose unsaved changes?')) return;
    await api.logout();
    location.reload();
  };

  if (phase.kind === 'checking' || phase.kind === 'loading') {
    return (
      <div class="splash">
        <span class="spinner" /> {phase.kind === 'loading' ? 'Loading your site…' : 'Starting…'}
      </div>
    );
  }
  if (phase.kind === 'login') return <Login configured={phase.configured} onDone={start} />;
  if (phase.kind === 'error') {
    return (
      <div class="splash error">
        <div>
          <h1>The editor couldn't load</h1>
          <p class="error-text">{phase.message}</p>
          <button type="button" class="btn" onClick={() => location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const v = view.value;
  return (
    <div class="app">
      <TopBar onPublish={() => setPublishing(true)} onLogout={logout} />
      <Sidebar onNewPage={() => setNewPage(true)} />
      <main class="editor">
        {v.kind === 'page' && <PageEditor path={v.path} />}
        {v.kind === 'projects' && <ProjectsEditor slug={v.slug} />}
        {v.kind === 'site' && <SiteEditor />}
        {v.kind === 'tags' && <TagsEditor />}
      </main>
      <Preview />
      <LinkSuggestions />
      <Toasts />
      {newPage && <NewPageDialog onClose={() => setNewPage(false)} />}
      {publishing && <PublishDialog onClose={() => setPublishing(false)} />}
    </div>
  );
}
