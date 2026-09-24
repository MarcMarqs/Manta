import { useEffect, useState } from 'preact/hooks';
import { api, ApiError, type Version } from './api';
import { LinkSuggestions } from './media';
import { NewPageDialog, PageEditor } from './PageEditor';
import { Preview } from './Preview';
import { ProjectsEditor } from './ProjectsEditor';
import { SiteEditor } from './SiteEditor';
import { TagsEditor } from './TagsEditor';
import {
  HOME,
  applyRecovery,
  busy,
  canRedo,
  canUndo,
  dirtyPaths,
  fileToRoute,
  files,
  loadAll,
  openView,
  pagePaths,
  forgetUnsaved,
  recovery,
  redo,
  save,
  selectedBlock,
  status,
  toast,
  toasts,
  undo,
  view,
  type PageFile,
} from './store';
import { blockActions } from './BlockEditor';
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

// --- version history -----------------------------------------------------

function HistoryDialog({ onClose }: { onClose: () => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .history()
      .then((r) => setVersions(r.versions))
      .catch((err) => setError(err.message));
  }, []);

  const restore = async (version: Version) => {
    if (
      !confirm(
        `Put the content back as it was at "${version.message}"? It becomes a new draft change, so nothing is lost and you can still undo by restoring a later version.`,
      )
    )
      return;
    busy.value = 'Restoring…';
    try {
      const result = await api.restore(version.sha);
      await loadAll();
      status.value = result.status;
      toast('Content restored. Check the preview, then publish when ready.', 'success');
      onClose();
    } catch (err) {
      toast(`Restore failed: ${(err as Error).message}`, 'error');
    } finally {
      busy.value = null;
    }
  };

  const when = (iso: string) => {
    const date = new Date(iso);
    const mins = Math.round((Date.now() - date.getTime()) / 60000);
    if (mins < 60) return `${Math.max(1, mins)} min ago`;
    if (mins < 1440) return `${Math.round(mins / 60)} h ago`;
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Modal title="Version history" onClose={onClose} wide>
      {error && <p class="error-text">{error}</p>}
      {!versions && !error && (
        <p class="empty">
          <span class="spinner" /> Loading versions…
        </p>
      )}
      {versions?.length === 0 && <p class="empty">No saved versions yet.</p>}
      {versions && versions.length > 0 && (
        <>
          <p class="muted">Every save and publish is a version. Restoring one adds it as a new change.</p>
          <div class="version-list">
            {versions.map((v, i) => (
              <div class="version-row">
                <span class="version-main">
                  <strong>{v.message}</strong>
                  <span class="muted small">
                    {when(v.date)} · {v.author} · <span class="mono">{v.sha.slice(0, 7)}</span>
                  </span>
                </span>
                {i === 0 ? (
                  <span class="pill ok">Current</span>
                ) : (
                  <button type="button" class="btn small" onClick={() => restore(v)} disabled={Boolean(busy.value)}>
                    Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

function RecoveryDialog() {
  const backup = recovery.value;
  if (!backup) return null;
  const when = new Date(backup.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <Modal
      title="Unsaved changes found"
      onClose={forgetUnsaved}
      footer={
        <>
          <button type="button" class="btn ghost" onClick={forgetUnsaved}>
            Discard them
          </button>
          <button type="button" class="btn primary" onClick={applyRecovery}>
            Restore my changes
          </button>
        </>
      }
    >
      <p>
        This browser still holds edits from {when} that were never saved. They were kept when the tab closed.
      </p>
      <p class="muted">Restoring brings them back into the editor, where you can save or undo them as usual.</p>
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

function TopBar({ onPublish, onLogout, onHistory }: { onPublish: () => void; onLogout: () => void; onHistory: () => void }) {
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
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  onHistory();
                }}
              >
                Version history…
              </button>
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
  const [history, setHistory] = useState(false);

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
      const target = e.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') ||
        document.querySelector('.modal');
      const actions = selectedBlock.value ? blockActions.get(selectedBlock.value) : undefined;

      // Block shortcuts only make sense when a block is selected and you aren't typing.
      if (!typing && actions) {
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          actions.move(e.key === 'ArrowUp' ? -1 : 1);
          return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          actions.remove();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          actions.duplicate();
          return;
        }
      }
      if (e.key === 'Escape' && !typing) selectedBlock.value = null;

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
      <TopBar
        onPublish={() => setPublishing(true)}
        onLogout={logout}
        onHistory={() => setHistory(true)}
      />
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
      {history && <HistoryDialog onClose={() => setHistory(false)} />}
      <RecoveryDialog />
    </div>
  );
}
