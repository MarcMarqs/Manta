import { useRef, useState } from 'preact/hooks';
import { api, assetUrl } from './api';
import { busy, fileToRoute, images, pagePaths, projects, status, toast } from './store';
import { Icon, IconButton, Modal } from './ui';

const MAX_EDGE = 2000;

function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Photos are scaled to at most 2000px and re-encoded as WebP before upload, so a
 * 12 MB phone picture lands in the repo at a few hundred KB. SVGs and GIFs are kept
 * as-is: re-encoding would rasterise one and freeze the other.
 */
async function prepare(file: File): Promise<{ type: string; data: string }> {
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return { type: file.type, data: await readAsBase64(file) };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85));
  if (!blob) throw new Error('This browser could not convert the image.');
  return { type: 'image/webp', data: await readAsBase64(blob) };
}

export async function uploadImage(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) {
    toast('That file is not an image.', 'error');
    return null;
  }
  busy.value = 'Uploading image…';
  try {
    const { type, data } = await prepare(file);
    const result = await api.upload(file.name, type, data);
    images.value = [...images.value, result.src].sort();
    status.value = result.status;
    return result.src;
  } catch (err) {
    toast(`Upload failed: ${(err as Error).message}`, 'error');
    return null;
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
          {list.map((src) => (
            <button type="button" class="library-item" onClick={() => onPick(src)} title={src}>
              <img src={assetUrl(src)} alt="" loading="lazy" />
              <span>{src.split('/').pop()}</span>
            </button>
          ))}
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
