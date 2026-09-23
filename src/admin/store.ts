import { batch, computed, signal } from '@preact/signals';
import type { Block, Project, Site, Tags } from '../lib/types';
import { api, type Status } from './api';

export const SITE = 'content/site.json';
export const PROJECTS = 'content/projects.json';
export const TAGS = 'content/tags.json';
export const PAGES_DIR = 'content/pages/';
export const HOME = `${PAGES_DIR}home.json`;

export interface PageFile {
  title: string;
  description?: string;
  project?: string;
  blocks: Block[];
}

export type View =
  | { kind: 'page'; path: string }
  | { kind: 'projects'; slug?: string }
  | { kind: 'site' }
  | { kind: 'tags' };

// --- content -------------------------------------------------------------

type Files = Record<string, unknown>;

/** Current content, parsed, keyed by repo path. */
export const files = signal<Files>({});
/** Each file as last loaded or saved, normalised through `serialize`. */
export const saved = signal<Record<string, string>>({});
export const images = signal<string[]>([]);
export const status = signal<Status | null>(null);

export const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export const dirtyPaths = computed(() => {
  const out: string[] = [];
  for (const [path, value] of Object.entries(files.value)) {
    if (saved.value[path] !== serialize(value)) out.push(path);
  }
  for (const path of Object.keys(saved.value)) if (!(path in files.value)) out.push(path);
  return out;
});

export const site = computed(() => files.value[SITE] as Site);
export const projects = computed(() => (files.value[PROJECTS] as Project[]) ?? []);
export const tags = computed(() => files.value[TAGS] as Tags);

export const pagePaths = computed(() =>
  Object.keys(files.value)
    .filter((p) => p.startsWith(PAGES_DIR))
    .sort((a, b) => (a === HOME ? -1 : b === HOME ? 1 : a.localeCompare(b))),
);

/** content/pages/work/dunes.json -> /work/dunes */
export const fileToRoute = (path: string) => {
  const slug = path.slice(PAGES_DIR.length).replace(/\.json$/, '');
  return slug === 'home' ? '/' : `/${slug}`;
};
/** /work/dunes -> content/pages/work/dunes.json */
export const routeToFile = (route: string) => {
  const slug = route.replace(/^\/+|\/+$/g, '');
  return `${PAGES_DIR}${slug || 'home'}.json`;
};

// --- undo / redo ---------------------------------------------------------

const past: Files[] = [];
const future: Files[] = [];
let lastChange = 0;
export const historyTick = signal(0);

/**
 * Every edit goes through here. Edits less than a second apart collapse into one
 * undo step, so undo removes a burst of typing rather than one character.
 */
export function setFiles(next: Files, { coalesce = true } = {}) {
  const now = Date.now();
  if (!coalesce || now - lastChange > 1000 || !past.length) {
    past.push(files.value);
    if (past.length > 200) past.shift();
  }
  lastChange = now;
  future.length = 0;
  files.value = next;
  historyTick.value++;
}

export function updateFile<T>(path: string, fn: (current: T) => T, opts?: { coalesce?: boolean }) {
  setFiles({ ...files.value, [path]: fn(files.value[path] as T) }, opts);
}

export const canUndo = computed(() => (historyTick.value, past.length > 0));
export const canRedo = computed(() => (historyTick.value, future.length > 0));

export function undo() {
  const prev = past.pop();
  if (!prev) return;
  future.push(files.value);
  files.value = prev;
  lastChange = 0;
  historyTick.value++;
  leaveMissingPage();
}

export function redo() {
  const next = future.pop();
  if (!next) return;
  past.push(files.value);
  files.value = next;
  lastChange = 0;
  historyTick.value++;
  leaveMissingPage();
}

/** Undo can remove the page being edited (e.g. undoing its creation): fall back to home. */
function leaveMissingPage() {
  const v = view.value;
  if (v.kind === 'page' && !(v.path in files.value)) openView({ kind: 'page', path: HOME });
  if (!(previewPath.value in files.value)) previewPath.value = HOME;
}

// --- ui state ------------------------------------------------------------

export const view = signal<View>({ kind: 'page', path: HOME });
/** The page the preview shows while a non-page view (projects, theme) is open. */
export const previewPath = signal<string>(HOME);
export const selectedBlock = signal<string | null>(null);
/** Blocks whose settings are open in the editor. */
export const expanded = signal<Set<string>>(new Set());
export const busy = signal<string | null>(null);

export function openView(next: View) {
  batch(() => {
    view.value = next;
    if (next.kind === 'page') previewPath.value = next.path;
    if (next.kind === 'projects') previewPath.value = HOME;
    selectedBlock.value = null;
  });
}

export function toggleExpanded(id: string, open?: boolean) {
  const next = new Set(expanded.value);
  const shouldOpen = open ?? !next.has(id);
  if (shouldOpen) next.add(id);
  else next.delete(id);
  expanded.value = next;
}

// --- toasts --------------------------------------------------------------

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'success' | 'error';
  action?: { label: string; href: string };
}
export const toasts = signal<Toast[]>([]);
let toastId = 0;

export function toast(message: string, tone: Toast['tone'] = 'info', action?: Toast['action']) {
  const id = ++toastId;
  toasts.value = [...toasts.value, { id, message, tone, action }];
  setTimeout(() => (toasts.value = toasts.value.filter((t) => t.id !== id)), tone === 'error' ? 9000 : 5000);
}

// --- loading & saving ----------------------------------------------------

export async function loadAll() {
  const state = await api.state();
  const parsed: Files = {};
  const normalised: Record<string, string> = {};
  for (const [path, raw] of Object.entries(state.files)) {
    try {
      parsed[path] = JSON.parse(raw);
      normalised[path] = serialize(parsed[path]);
    } catch {
      toast(`${path} isn't valid JSON and was skipped.`, 'error');
    }
  }
  batch(() => {
    files.value = parsed;
    saved.value = normalised;
    images.value = state.images;
    status.value = state.status;
    past.length = 0;
    future.length = 0;
    historyTick.value++;
    const current = view.value;
    if (current.kind === 'page' && !(current.path in parsed)) openView({ kind: 'page', path: HOME });
  });
}

/** Problems that would break the site if saved, as human-readable messages. */
export function validate(): string[] {
  const problems: string[] = [];
  for (const path of pagePaths.value) {
    const page = files.value[path] as PageFile;
    const name = fileToRoute(path);
    if (!page.title?.trim()) problems.push(`Page ${name} needs a title.`);
    const seen = new Set<string>();
    const walk = (blocks: Block[]) => {
      for (const b of blocks) {
        if (seen.has(b.id)) problems.push(`Page ${name} has two blocks with id "${b.id}".`);
        seen.add(b.id);
        if (b.type === 'section') walk(b.blocks);
        if (b.type === 'columns') b.columns.forEach((c) => walk(c.blocks));
      }
    };
    walk(page.blocks ?? []);
  }
  const slugs = new Set<string>();
  for (const p of projects.value) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) problems.push(`Project "${p.title}" has an invalid URL slug.`);
    if (slugs.has(p.slug)) problems.push(`Two projects use the slug "${p.slug}".`);
    slugs.add(p.slug);
  }
  return problems;
}

const describe = (path: string) =>
  path === SITE
    ? 'site settings'
    : path === PROJECTS
      ? 'projects'
      : path === TAGS
        ? 'tags'
        : `page ${fileToRoute(path)}`;

export async function save() {
  const paths = dirtyPaths.value;
  if (!paths.length || busy.value) return;
  const problems = validate();
  if (problems.length) {
    problems.slice(0, 3).forEach((p) => toast(p, 'error'));
    return;
  }

  const changes = paths.map((path) =>
    path in files.value
      ? { path, content: serialize(files.value[path]) }
      : { path, delete: true as const },
  );
  const message = `Edit ${paths.map(describe).join(', ')}`.slice(0, 180);

  busy.value = 'Saving…';
  try {
    const result = await api.save(changes, message);
    const nextSaved = { ...saved.value };
    for (const change of changes) {
      if ('delete' in change) delete nextSaved[change.path];
      else nextSaved[change.path] = change.content;
    }
    batch(() => {
      saved.value = nextSaved;
      status.value = result.status;
    });
    if (result.status.backend === 'local') toast('Saved to your project files.', 'success');
    else
      toast(
        'Saved to the draft. The preview site rebuilds in about a minute.',
        'success',
        result.status.previewUrl ? { label: 'Open preview', href: result.status.previewUrl } : undefined,
      );
  } catch (err) {
    toast(`Save failed: ${(err as Error).message}`, 'error');
  } finally {
    busy.value = null;
  }
}

export async function refreshStatus() {
  try {
    status.value = await api.status();
  } catch {}
}

/** Page and project names that still reference an image, so it isn't deleted while in use. */
export function imageUsage(src: string): string[] {
  const used: string[] = [];
  for (const [path, value] of Object.entries(files.value)) {
    if (!JSON.stringify(value).includes(`"${src}"`)) continue;
    used.push(path === PROJECTS ? 'Projects' : path === SITE ? 'Site settings' : fileToRoute(path));
  }
  return used;
}

export const newId = (prefix = 'b') => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

// Dev-only handle for inspecting editor state from the browser console.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __manta: unknown }).__manta = { files, saved, past, future, view, selectedBlock };
}
