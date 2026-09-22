import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

// --- icons (16px, stroke = currentColor) ---------------------------------

const paths: Record<string, string> = {
  up: 'M8 12V4M4 8l4-4 4 4',
  down: 'M8 4v8M4 8l4 4 4-4',
  copy: 'M5.5 5.5h7v7h-7zM3.5 10.5v-7h7',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5',
  plus: 'M8 3v10M3 8h10',
  x: 'M4 4l8 8M12 4l-8 8',
  chevron: 'M6 4l4 4-4 4',
  grip: 'M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01',
  undo: 'M5.5 3.5L3 6l2.5 2.5M3 6h6.5a3.5 3.5 0 010 7H7',
  redo: 'M10.5 3.5L13 6l-2.5 2.5M13 6H6.5a3.5 3.5 0 000 7H9',
  external: 'M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5',
  upload: 'M8 10.5V3M5 6l3-3 3 3M3 10.5V13h10v-2.5',
  image: 'M2.5 3.5h11v9h-11zM2.5 10.5l3-3 2.5 2.5 2-2 3.5 3.5M10 6.25h.01',
  page: 'M4 2.5h5l3 3v8H4zM9 2.5v3h3',
  home: 'M2.5 7.5L8 3l5.5 4.5M4 6.5V13h8V6.5',
  grid: 'M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z',
  palette: 'M8 2.5a5.5 5.5 0 100 11c.8 0 1.2-.6 1-1.3-.3-.9.3-1.7 1.2-1.7h1.3a2 2 0 002-2A5.5 5.5 0 008 2.5zM5 7.5h.01M6.5 5h.01M9.5 5h.01',
  tag: 'M2.5 2.5h5l6 6-5 5-6-6zM5 5h.01',
  code: 'M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5',
  desktop: 'M2 3h12v8H2zM6 14h4M8 11v3',
  tablet: 'M4 2h8v12H4zM7.5 12h1',
  mobile: 'M5 2h6v12H5zM7.5 12h1',
  sun: 'M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1',
  moon: 'M13 9.5A5.5 5.5 0 016.5 3a5.5 5.5 0 106.5 6.5z',
  auto: 'M8 2.5a5.5 5.5 0 100 11zM8 2.5a5.5 5.5 0 010 11',
  logout: 'M6 3H3v10h3M10.5 5L13.5 8l-3 3M13.5 8H6',
  link: 'M7 9a2.5 2.5 0 003.5 0l2-2A2.5 2.5 0 009 3.5l-.5.5M9 7a2.5 2.5 0 00-3.5 0l-2 2A2.5 2.5 0 007 12.5l.5-.5',
  bold: 'M4.5 3h4a2.5 2.5 0 010 5h-4zM4.5 8h5a2.5 2.5 0 010 5h-5z',
  italic: 'M7 3h5M4 13h5M9.5 3l-3 10',
  list: 'M6 4h7.5M6 8h7.5M6 12h7.5M2.5 4h.01M2.5 8h.01M2.5 12h.01',
  olist: 'M6.5 4h7M6.5 8h7M6.5 12h7M2.5 3l1-.5V6M2.5 10.5c0-1.5 2-1.5 2 0 0 .8-2 1.5-2 2.5h2',
  clear: 'M3 13h10M6 3h7M9.5 3L7 11M4 5l6 6',
  alignLeft: 'M2.5 4h11M2.5 8h7M2.5 12h9',
  alignCenter: 'M2.5 4h11M4.5 8h7M3.5 12h9',
  alignRight: 'M2.5 4h11M6.5 8h7M4.5 12h9',
};

export function Icon({ name, size = 16 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] ?? ''} />
    </svg>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  disabled,
  tone,
}: {
  icon: string;
  label: string;
  onClick: (e: MouseEvent) => void;
  disabled?: boolean;
  tone?: 'danger';
}) {
  return (
    <button
      type="button"
      class={`icon-btn${tone ? ` ${tone}` : ''}`}
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
      disabled={disabled}
    >
      <Icon name={icon} />
    </button>
  );
}

// --- logo ----------------------------------------------------------------

/** The Manta mark: the same ray as public/favicon.svg, so the tab and the editor match. */
export function Logo({ big }: { big?: boolean }) {
  return (
    <div class={`brand-mark${big ? ' big' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <path
          transform="translate(0.64 -1.76) scale(0.96)"
          fill="currentColor"
          d="M16 10.2C16.9 10.2 17.6 9.4 18.2 7.6C19.2 8.4 19.5 9.9 19.1 11.1C23.6 10.6 27.8 13.2 29.8 18.4C26.4 18.6 22.8 19.4 19.8 21.8C18.9 22.4 17.8 22.8 16.6 23L16.3 29.4L15.7 29.4L15.4 23C14.2 22.8 13.1 22.4 12.2 21.8C9.2 19.4 5.6 18.6 2.2 18.4C4.2 13.2 8.4 10.6 12.9 11.1C12.5 9.9 12.8 8.4 13.8 7.6C14.4 9.4 15.1 10.2 16 10.2Z"
        />
      </svg>
    </div>
  );
}

// --- fields --------------------------------------------------------------

export function Field({
  label,
  hint,
  children,
  wide,
}: {
  label: string;
  hint?: string;
  children: ComponentChildren;
  wide?: boolean;
}) {
  return (
    <label class={`field${wide ? ' wide' : ''}`}>
      <span class="field-label">{label}</span>
      {children}
      {hint && <span class="field-hint">{hint}</span>}
    </label>
  );
}

interface InputProps {
  placeholder?: string;
  autoFocus?: boolean;
  class?: string;
}

export function TextInput({
  value,
  onChange,
  ...rest
}: { value: string | number | undefined; onChange: (v: string) => void } & InputProps) {
  return (
    <input
      type="text"
      {...rest}
      class={rest.class ?? 'input'}
      value={value ?? ''}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 4,
  mono,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <textarea
      class={`input${mono ? ' mono' : ''}`}
      rows={rows}
      value={value}
      placeholder={placeholder}
      spellcheck={!mono}
      onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
    />
  );
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      class="input"
      value={String(value)}
      onChange={(e) => {
        const raw = (e.target as HTMLSelectElement).value;
        const match = options.find((o) => String(o.value) === raw);
        if (match) onChange(match.value);
      }}
    >
      {options.map((o) => (
        <option value={String(o.value)}>{o.label}</option>
      ))}
    </select>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div class="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={o.value === value}
          class={o.value === value ? 'active' : ''}
          onClick={() => onChange(o.value)}
          title={o.label}
        >
          {o.icon ? <Icon name={o.icon} /> : o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label class="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span class="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

// --- rich text -----------------------------------------------------------

/**
 * Minimal rich text: bold, italic, links, lists. The DOM is only rewritten when the
 * value changes from outside (undo, switching blocks), so typing never loses the caret.
 */
export function RichText({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  const emit = () => {
    if (!ref.current) return;
    let html = ref.current.innerHTML;
    // A bare text node typed into an empty editor should still be a paragraph.
    if (html && !/^\s*</.test(html)) html = `<p>${html}</p>`;
    onChange(html === '<br>' ? '' : html);
  };

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  const link = () => {
    const href = prompt('Link to (a page like /about, or a full URL):', 'https://');
    if (href) exec('createLink', href);
  };

  return (
    <div class="richtext">
      <div class="richtext-toolbar">
        <IconButton icon="bold" label="Bold" onClick={() => exec('bold')} />
        <IconButton icon="italic" label="Italic" onClick={() => exec('italic')} />
        <IconButton icon="link" label="Link" onClick={link} />
        <IconButton icon="list" label="Bullet list" onClick={() => exec('insertUnorderedList')} />
        <IconButton icon="olist" label="Numbered list" onClick={() => exec('insertOrderedList')} />
        <IconButton icon="clear" label="Clear formatting" onClick={() => exec('removeFormat')} />
      </div>
      <div
        ref={ref}
        class="richtext-body"
        contentEditable
        onInput={emit}
        onPaste={(e) => {
          // Paste as plain text so formatting from other apps doesn't leak in.
          e.preventDefault();
          const text = e.clipboardData?.getData('text/plain') ?? '';
          document.execCommand('insertText', false, text);
        }}
      />
    </div>
  );
}

// --- modal ---------------------------------------------------------------

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div class="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div class={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header class="modal-head">
          <h2>{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div class="modal-body">{children}</div>
        {footer && <footer class="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}
