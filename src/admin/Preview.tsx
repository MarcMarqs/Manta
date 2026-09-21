import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { ancestorsOf } from './blocks';
import { api } from './api';
import {
  PROJECTS,
  SITE,
  TAGS,
  expanded,
  fileToRoute,
  files,
  openView,
  previewPath,
  redo,
  routeToFile,
  save,
  selectedBlock,
  toast,
  undo,
  type PageFile,
} from './store';
import { Icon, Segmented } from './ui';

type Device = 'desktop' | 'tablet' | 'mobile';
type Theme = 'auto' | 'light' | 'dark';

const WIDTHS: Record<Device, string> = { desktop: '100%', tablet: '768px', mobile: '390px' };

const device = signal<Device>('desktop');
const theme = signal<Theme>('auto');

/** Scrolls the editor to a block's card and opens it, along with every section/column around it. */
function revealInEditor(id: string) {
  const page = files.value[previewPath.value] as PageFile | undefined;
  const trail = page ? ancestorsOf(page.blocks, id) : null;
  if (trail) expanded.value = new Set([...expanded.value, ...trail, id]);
  selectedBlock.value = id;
  requestAnimationFrame(() =>
    document.querySelector(`[data-edit-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
  );
}

export function Preview() {
  const frames = [useRef<HTMLIFrameElement>(null), useRef<HTMLIFrameElement>(null)];
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const activeRef = useRef(0);
  activeRef.current = active;

  const path = previewPath.value;
  const page = files.value[path] as PageFile | undefined;
  const site = files.value[SITE];
  const projects = files.value[PROJECTS];
  const tags = files.value[TAGS];

  const post = (frame: HTMLIFrameElement | null, msg: unknown) => frame?.contentWindow?.postMessage(msg, '*');

  // Re-render whenever anything the page depends on changes, debounced while typing.
  useEffect(() => {
    if (!page || !site) return;
    const id = ++request.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const html = await api.preview({ path: fileToRoute(path), page, site, projects, tags });
        if (id !== request.current) return;
        const current = frames[activeRef.current].current;
        const nextIndex = activeRef.current === 0 ? 1 : 0;
        const next = frames[nextIndex].current;
        if (!next) return;
        const scroll = current?.contentWindow?.scrollY ?? 0;
        const sameDoc = current?.dataset.path === path;
        next.onload = () => {
          if (id !== request.current) return;
          // Keep the reader's place when the same page re-renders.
          if (sameDoc) next.contentWindow?.scrollTo(0, scroll);
          post(next, { type: 'manta:theme', theme: theme.value });
          post(next, { type: 'manta:highlight', id: selectedBlock.value });
          next.dataset.path = path;
          setActive(nextIndex);
          setLoading(false);
          setError(null);
        };
        next.srcdoc = html;
      } catch (err) {
        if (id !== request.current) return;
        setLoading(false);
        setError((err as Error).message);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [path, page, site, projects, tags]);

  // Selection in the editor highlights the block in the preview.
  useEffect(() => {
    post(frames[active].current, { type: 'manta:highlight', id: selectedBlock.value, scroll: true });
  }, [selectedBlock.value, active]);

  useEffect(() => {
    post(frames[active].current, { type: 'manta:theme', theme: theme.value });
  }, [theme.value, active]);

  // Messages from the preview: a block was clicked, or a link was followed.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frames.some((f) => f.current?.contentWindow === event.source)) return;
      const msg = event.data ?? {};
      if (msg.type === 'manta:select' && typeof msg.id === 'string') revealInEditor(msg.id);
      if (msg.type === 'manta:navigate' && typeof msg.path === 'string') {
        const target = routeToFile(msg.path);
        if (target in files.value) openView({ kind: 'page', path: target });
        else toast(`${msg.path} isn't a page on this site yet.`);
      }
      if (msg.type === 'manta:key') {
        if (msg.key === 's') save();
        else if ((msg.key === 'z' && msg.shift) || msg.key === 'y') redo();
        else if (msg.key === 'z') undo();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div class="preview">
      <div class="preview-bar">
        <span class="preview-path mono">
          {loading && <span class="spinner" />}
          {fileToRoute(path)}
        </span>
        <div class="row">
          <Segmented
            value={theme.value}
            onChange={(v) => (theme.value = v)}
            options={[
              { value: 'auto', label: 'System theme', icon: 'auto' },
              { value: 'light', label: 'Light', icon: 'sun' },
              { value: 'dark', label: 'Dark', icon: 'moon' },
            ]}
          />
          <Segmented
            value={device.value}
            onChange={(v) => (device.value = v)}
            options={[
              { value: 'desktop', label: 'Desktop', icon: 'desktop' },
              { value: 'tablet', label: 'Tablet', icon: 'tablet' },
              { value: 'mobile', label: 'Phone', icon: 'mobile' },
            ]}
          />
        </div>
      </div>
      <div class={`preview-stage ${device.value}`}>
        {error && (
          <div class="preview-error">
            <Icon name="x" /> Preview failed: {error}
          </div>
        )}
        <div class="preview-device" style={{ width: WIDTHS[device.value] }}>
          {frames.map((ref, i) => (
            <iframe
              ref={ref}
              title={`Preview of ${fileToRoute(path)}`}
              class={i === active ? 'active' : ''}
              aria-hidden={i !== active}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
