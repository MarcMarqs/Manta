import type { Site, Theme } from '../lib/types';
import { FONTS, SYSTEM_FONT } from '../lib/fonts';
import { LinkInput } from './media';
import { SITE, site, updateFile } from './store';
import { Field, Icon, IconButton, Select, TextInput } from './ui';

const COLORS: { key: keyof Theme; dark?: keyof Theme; label: string; hint: string }[] = [
  { key: 'bg', dark: 'bgDark', label: 'Background', hint: 'Page background' },
  { key: 'fg', dark: 'fgDark', label: 'Text', hint: 'Body text and headings' },
  { key: 'muted', dark: 'mutedDark', label: 'Muted text', hint: 'Captions, meta, nav' },
  { key: 'surface', dark: 'surfaceDark', label: 'Surface', hint: 'Cards and sections' },
  { key: 'border', dark: 'borderDark', label: 'Border', hint: 'Lines and outlines' },
];

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div class="color-input">
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onInput={(e) => onChange((e.target as HTMLInputElement).value)} />
      <input
        class="input mono small"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        spellcheck={false}
      />
    </div>
  );
}

const fontOptions = [
  { value: SYSTEM_FONT, label: 'System default' },
  ...FONTS.map((f) => ({ value: f.name, label: `${f.name} · ${f.kind}` })),
];

export function SiteEditor() {
  const s = site.value;
  if (!s) return null;
  const t = s.theme;

  const set = (patch: Partial<Site>) => updateFile<Site>(SITE, (cur) => ({ ...cur, ...patch }));
  const setTheme = (patch: Partial<Theme>) => updateFile<Site>(SITE, (cur) => ({ ...cur, theme: { ...cur.theme, ...patch } }));
  const setNav = (nav: Site['nav']) => set({ nav });

  return (
    <div class="editor-pane">
      <header class="pane-head">
        <div>
          <p class="eyebrow">Site</p>
          <h1>Site & theme</h1>
          <p class="muted">Applies to every page. The preview shows the last page you opened.</p>
        </div>
      </header>

      <section class="subsection">
        <h3>Identity</h3>
        <div class="fields">
          <Field label="Site name" hint="Top-left of every page and the browser tab.">
            <TextInput value={s.name} onChange={(name) => set({ name })} />
          </Field>
          <Field label="Footer">
            <TextInput value={s.footer} onChange={(footer) => set({ footer })} />
          </Field>
          <Field label="Tagline" wide>
            <TextInput value={s.tagline} onChange={(tagline) => set({ tagline })} />
          </Field>
        </div>
      </section>

      <section class="subsection">
        <h3>Navigation</h3>
        {s.nav.map((item, i) => (
          <div class="nav-row">
            <TextInput
              value={item.label}
              placeholder="Label"
              onChange={(label) => setNav(s.nav.map((n, j) => (j === i ? { ...n, label } : n)))}
            />
            <LinkInput value={item.href} onChange={(href) => setNav(s.nav.map((n, j) => (j === i ? { ...n, href } : n)))} />
            <IconButton
              icon="up"
              label="Move up"
              disabled={i === 0}
              onClick={() => {
                const next = [...s.nav];
                [next[i - 1], next[i]] = [next[i], next[i - 1]];
                setNav(next);
              }}
            />
            <IconButton icon="trash" label="Remove" tone="danger" onClick={() => setNav(s.nav.filter((_, j) => j !== i))} />
          </div>
        ))}
        <button type="button" class="btn small ghost" onClick={() => setNav([...s.nav, { label: 'New link', href: '/' }])}>
          <Icon name="plus" /> Add menu item
        </button>
      </section>

      <section class="subsection">
        <h3>Colors</h3>
        <div class="fields">
          <Field label="Accent" hint="Buttons, links, charts, highlights." wide>
            <ColorInput value={t.accent} onChange={(accent) => setTheme({ accent })} />
          </Field>
        </div>
        <div class="color-table">
          <div class="color-table-head">
            <span />
            <span>
              <Icon name="sun" /> Light
            </span>
            <span>
              <Icon name="moon" /> Dark
            </span>
          </div>
          {COLORS.map((c) => (
            <div class="color-table-row">
              <span>
                <strong>{c.label}</strong>
                <span class="field-hint">{c.hint}</span>
              </span>
              <ColorInput value={t[c.key] as string} onChange={(v) => setTheme({ [c.key]: v } as Partial<Theme>)} />
              <ColorInput value={t[c.dark!] as string} onChange={(v) => setTheme({ [c.dark!]: v } as Partial<Theme>)} />
            </div>
          ))}
        </div>
        <p class="field-hint">Visitors get light or dark from their system setting, and can switch with the Theme button. Use the sun/moon toggle above the preview to check both.</p>
      </section>

      <section class="subsection">
        <h3>Type & layout</h3>
        <div class="fields">
          <Field label="Heading font">
            <Select value={t.fontHeading} options={fontOptions} onChange={(fontHeading) => setTheme({ fontHeading })} />
          </Field>
          <Field label="Body font">
            <Select value={t.fontBody} options={fontOptions} onChange={(fontBody) => setTheme({ fontBody })} />
          </Field>
          <Field label={`Corner radius · ${t.radius}`}>
            <input
              type="range"
              min="0"
              max="28"
              value={parseInt(t.radius) || 0}
              onInput={(e) => setTheme({ radius: `${(e.target as HTMLInputElement).value}px` })}
            />
          </Field>
          <Field label={`Spacing · ${t.spacing}×`} hint="Scales the gaps between blocks.">
            <input
              type="range"
              min="0.7"
              max="1.6"
              step="0.05"
              value={t.spacing}
              onInput={(e) => setTheme({ spacing: Number((e.target as HTMLInputElement).value) })}
            />
          </Field>
          <Field label="Content width">
            <Select
              value={t.maxWidth}
              options={['880px', '960px', '1100px', '1240px', '1400px'].map((v) => ({ value: v, label: v }))}
              onChange={(maxWidth) => setTheme({ maxWidth })}
            />
          </Field>
        </div>
      </section>
    </div>
  );
}
