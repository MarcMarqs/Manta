import { signal } from '@preact/signals';

/**
 * How wide the two left columns are, and whether they are on screen at all.
 *
 * This sits beside `appearance` rather than inside it because it is the same kind of
 * setting: it follows the person, not the work, so it is kept in the browser and never
 * committed. What it changes is only the frame — the pane you type into, the list you
 * pick pages from, and how much of the window is left for the preview.
 */

export interface Panels {
  /** Width of the page list, in px. */
  side: number;
  /** Width of the editing pane, in px. */
  editor: number;
  sideOpen: boolean;
  editorOpen: boolean;
}

export const PANEL_DEFAULTS: Panels = { side: 220, editor: 440, sideOpen: true, editorOpen: true };

/** A pane narrower than this cannot show its own contents, so dragging stops there. */
export const LIMITS = {
  side: { min: 160, max: 420 },
  editor: { min: 340, max: 900 },
};

/** The preview is the point of the third column, so it never gets squeezed away. */
const PREVIEW_MIN = 300;

const KEY = 'manta.panels';

export const panels = signal<Panels>(PANEL_DEFAULTS);

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/**
 * Both columns are clamped against the window as well as against themselves: a width
 * that was comfortable on a wide monitor would leave no preview at all on a laptop, and
 * the stored value outlives the screen it was chosen on.
 */
function fit(p: Panels): Panels {
  const side = p.sideOpen ? clamp(p.side, LIMITS.side.min, LIMITS.side.max) : p.side;
  const room = window.innerWidth - (p.sideOpen ? side : 0) - PREVIEW_MIN;
  const editorMax = Math.max(LIMITS.editor.min, Math.min(LIMITS.editor.max, room));
  return { ...p, side, editor: p.editorOpen ? clamp(p.editor, LIMITS.editor.min, editorMax) : p.editor };
}

/** The widths the grid reads. A closed pane is zero wide, so its column disappears. */
export function applyPanels(p: Panels) {
  const root = document.documentElement;
  root.style.setProperty('--e-side-w', `${p.sideOpen ? p.side : 0}px`);
  root.style.setProperty('--e-editor-w', `${p.editorOpen ? p.editor : 0}px`);
  root.classList.toggle('e-side-off', !p.sideOpen);
  root.classList.toggle('e-editor-off', !p.editorOpen);
}

function remember(p: Panels) {
  try {
    const next = JSON.stringify(p);
    // Dragging and window resizing both land here many times a second; only a width
    // that actually ended up different is worth writing down.
    if (next !== localStorage.getItem(KEY)) localStorage.setItem(KEY, next);
  } catch {
    /* A preference that cannot be kept costs the next visit, not any content. */
  }
}

/** Called once before the editor renders, so the first frame is already the right shape. */
export function loadPanels() {
  let p = PANEL_DEFAULTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) p = { ...PANEL_DEFAULTS, ...(JSON.parse(raw) as Partial<Panels>) };
  } catch {
    /* Unreadable storage just means the defaults. */
  }
  panels.value = fit(p);
  applyPanels(panels.value);
  // A window that is resized can leave a stored width with nowhere to go.
  window.addEventListener('resize', () => setPanels({}));
}

export function setPanels(patch: Partial<Panels>) {
  panels.value = fit({ ...panels.value, ...patch });
  applyPanels(panels.value);
  remember(panels.value);
}

/** Back to the shipped widths, both panes open — the state the preview is sized for. */
export function resetPanels() {
  setPanels(PANEL_DEFAULTS);
}
