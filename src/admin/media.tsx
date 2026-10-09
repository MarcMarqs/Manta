import { useRef, useState } from 'preact/hooks';
import { api, assetUrl } from './api';
import { MEDIA, busy, fileToRoute, imageUsage, images, pagePaths, projects, setSavedFile, status, toast } from './store';
import { Icon, IconButton, Modal } from './ui';

const MAX_EDGE = 2000;
/** What Cloudflare will serve as a single file on the built site. */
const MAX_VIDEO_MB = 25;
const VIDEO_TYPES = ['video/mp4', 'video/webm'];
/** Copies made for phones and tablets; anything wider than the original is skipped. */
const VARIANT_WIDTHS = [480, 960, 1440];

function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

interface Prepared {
  type: string;
  data: string;
  width?: number;
  variants: { width: number; data: string }[];
}

/** Draws the bitmap at a given width and returns it as base64 WebP. */
async function encodeAt(bitmap: ImageBitmap, width: number): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((bitmap.height / bitmap.width) * width);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85));
  if (!blob) throw new Error('This browser could not convert the image.');
  return readAsBase64(blob);
}

/**
 * Photos are scaled to at most 2000px and re-encoded as WebP before upload, so a
 * 12 MB phone picture lands in the repo at a few hundred KB. Smaller copies are made at
 * the same time, so phones don't download the desktop-sized one. SVGs and GIFs are kept
 * as-is: re-encoding would rasterise one and freeze the other.
 */
async function prepare(file: File): Promise<Prepared> {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return { type: file.type, data: await readAsBase64(file), variants: [] };
  }
  const bitmap = await createImageBitmap(file);
  const width = Math.min(MAX_EDGE, bitmap.width);
  try {
    const data = await encodeAt(bitmap, width);
    const variants = [];
    for (const w of VARIANT_WIDTHS) {
      // No point storing a copy that isn't meaningfully smaller than the original.
      if (w < width * 0.9) variants.push({ width: w, data: await encodeAt(bitmap, w) });
    }
    return { type: 'image/webp', data, width, variants };
  } finally {
    bitmap.close();
  }
}

export async function uploadImage(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) {
    toast('That file is not an image.', 'error');
    return null;
  }
  busy.value = 'Uploading image…';
  try {
    const prepared = await prepare(file);
    const result = await api.upload(file.name, prepared);
    images.value = [...images.value, result.src].sort();
    status.value = result.status;
    // The server committed the manifest already, so hold it without marking it unsaved.
    if (result.manifest) setSavedFile(MEDIA, result.manifest);
    return result.src;
  } catch (err) {
    toast(`Upload failed: ${(err as Error).message}`, 'error');
    return null;
  } finally {
    busy.value = null;
  }
}

/**
 * A clip goes up exactly as it is.
 *
 * Nothing here re-encodes it: a browser can redraw a photo on a canvas, but it cannot
 * compress video without shipping an encoder, so the size you export is the size the
 * repository carries. The limit is checked before the upload rather than after, so a
 * 200 MB capture fails in a second instead of after a long wait.
 */
export async function uploadVideo(file: File): Promise<string | null> {
  if (!VIDEO_TYPES.includes(file.type)) {
    toast('Upload an MP4 or a WebM. Other formats cannot be played on the web.', 'error');
    return null;
  }
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    toast(
      `That clip is ${Math.round(file.size / 1024 / 1024)} MB; the limit is ${MAX_VIDEO_MB} MB. Trim it, or export it smaller.`,
      'error',
    );
    return null;
  }
  busy.value = 'Uploading video…';
  try {
    const result = await api.upload(file.name, { type: file.type, data: await readAsBase64(file), variants: [] });
    status.value = result.status;
    return result.src;
  } catch (err) {
    toast(`Upload failed: ${(err as Error).message}`, 'error');
    return null;
  } finally {
    busy.value = null;
  }
}

/**
 * Deletes an uploaded file, once nothing points at it any more.
 *
 * The check is the point: `imageUsage` searches every content file for the path, so a
 * picture or clip still on a page cannot be deleted out from under it. What is left
 * behind is the git history, which is why this is safe to offer at all.
 */
async function deleteUpload(src: string, kind: 'Image' | 'Clip'): Promise<boolean> {
  const used = imageUsage(src);
  if (used.length) {
    toast(`Still used by ${used.join(', ')}. Remove it there first.`, 'error');
    return false;
  }
  if (!confirm(`Delete ${src.split('/').pop()}? It stays in the site's history, but goes from the site.`)) return false;

  busy.value = 'Deleting…';
  try {
    const result = await api.deleteUpload(`public${src}`);
    images.value = images.value.filter((i) => i !== src);
    status.value = result.status;
    if (result.manifest) setSavedFile(MEDIA, result.manifest);
    toast(`${kind} deleted.`, 'success');
    return true;
  } catch (err) {
    toast(`Delete failed: ${(err as Error).message}`, 'error');
    return false;
  } finally {
    busy.value = null;
  }
}

function MediaLibrary({ onPick, onClose }: { onPick: (src: string) => void; onClose: () => void }) {
  const [filter, setFilter] = useState('');
  const list = images.value.filter((src) => src.toLowerCase().includes(filter.toLowerCase()));
  return (
    <Modal title="Image library" onClose={onClose} wide>
      <input
        class="input"
        placeholder="Filter by name…"
        value={filter}
        onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
      />
      {list.length === 0 ? (
        <p class="empty">No images yet. Upload one from any image field.</p>
      ) : (
        <div class="library">
          {list.map((src) => {
            const used = imageUsage(src);
            return (
              <div class="library-item">
                <button type="button" class="library-pick" onClick={() => onPick(src)} title={src}>
                  <img src={assetUrl(src)} alt="" loading="lazy" />
                  <span>{src.split('/').pop()}</span>
                </button>
                <span class="library-foot">
                  <span class="muted small" title={used.join(', ')}>
                    {used.length ? `Used in ${used.length}` : 'Unused'}
                  </span>
                  <IconButton
                    icon="trash"
                    tone="danger"
                    label={used.length ? `Used by ${used.join(', ')}` : 'Delete image'}
                    disabled={used.length > 0}
                    onClick={() => deleteUpload(src, 'Image')}
                  />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

export function ImageField({ value, onChange }: { value: string; onChange: (src: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [library, setLibrary] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    const src = await uploadImage(file);
    if (src) onChange(src);
  };

  return (
    <div
      class={`image-field${dragging ? ' dragging' : ''}`}
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
        handleFiles(e.dataTransfer?.files ?? null);
      }}
    >
      <div class="image-thumb">
        {value ? <img src={assetUrl(value)} alt="" /> : <Icon name="image" size={22} />}
      </div>
      <div class="image-actions">
        <div class="row">
          <button type="button" class="btn small" onClick={() => input.current?.click()}>
            <Icon name="upload" /> Upload
          </button>
          <button type="button" class="btn small ghost" onClick={() => setLibrary(true)}>
            Library
          </button>
          {value && <IconButton icon="x" label="Remove image" onClick={() => onChange('')} />}
        </div>
        <input
          class="input small"
          value={value}
          placeholder="…or paste an image URL"
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        />
        <span class="field-hint">Drop a file here too. Photos are resized and converted to WebP.</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFiles((e.target as HTMLInputElement).files);
          (e.target as HTMLInputElement).value = '';
        }}
      />
      {library && (
        <MediaLibrary
          onClose={() => setLibrary(false)}
          onPick={(src) => {
            onChange(src);
            setLibrary(false);
          }}
        />
      )}
    </div>
  );
}

/** Pick a clip from this machine, or point at one already uploaded. */
export function VideoField({ value, onChange }: { value: string; onChange: (src: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    const src = await uploadVideo(file);
    if (src) onChange(src);
  };

  return (
    <div
      class={`image-field${dragging ? ' dragging' : ''}`}
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
        handleFiles(e.dataTransfer?.files ?? null);
      }}
    >
      <div class="image-thumb">
        {value ? <video src={assetUrl(value)} muted preload="metadata" /> : <Icon name="play" size={22} />}
      </div>
      <div class="image-actions">
        <div class="row">
          <button type="button" class="btn small" onClick={() => input.current?.click()}>
            <Icon name="upload" /> Upload
          </button>
          {value && (
            <>
              <IconButton icon="x" label="Take this clip off the block" onClick={() => onChange('')} />
              <IconButton
                icon="trash"
                tone="danger"
                label="Delete the file from the site"
                onClick={async () => {
                  const gone = value;
                  // This block has to stop pointing at the file first, or the usage
                  // check finds itself and refuses. Put it back if it is used elsewhere.
                  onChange('');
                  if (!(await deleteUpload(gone, 'Clip'))) onChange(gone);
                }}
              />
            </>
          )}
        </div>
        <input
          class="input small"
          value={value}
          placeholder="…or paste the path of a clip"
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        />
        <span class="field-hint">
          Drop a file here too. MP4 or WebM, up to {MAX_VIDEO_MB} MB — the most a published page can serve.
        </span>
      </div>
      <input
        ref={input}
        type="file"
        accept="video/mp4,video/webm"
        hidden
        onChange={(e) => {
          handleFiles((e.target as HTMLInputElement).files);
          (e.target as HTMLInputElement).value = '';
        }}
      />
    </div>
  );
}

/** Text input that suggests every page on the site, while still accepting any URL. */
export function LinkInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      class="input"
      list="manta-links"
      value={value}
      placeholder="/about or https://…"
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
    />
  );
}

/** Rendered once by the app; feeds every LinkInput's suggestions. */
export function LinkSuggestions() {
  const routes = new Set(pagePaths.value.map(fileToRoute));
  for (const p of projects.value) routes.add(`/work/${p.slug}`);
  return (
    <datalist id="manta-links">
      {[...routes].sort().map((r) => (
        <option value={r} />
      ))}
    </datalist>
  );
}
