import type { ComponentChildren } from 'preact';
import { ACCENTS, appearance, setAppearance, type Accent, type Theme } from './appearance';
import { Segmented } from './ui';

/**
 * Everything you can change about the editor, in one place.
 *
 * The rule for what belongs here is Shipwreck's: a setting that follows *you* rather
 * than a piece of work. How the editor looks is yours and stays in this browser; how the
 * site looks belongs to the site and lives in Site & theme, committed with the content.
 */
export function SettingsEditor() {
  const look = appearance.value;

  return (
    <div class="pane">
      <div class="pane-head">
        <h2>Settings</h2>
        <p class="muted">
          How the editor itself looks. Kept in this browser, never committed — the site's own
          colours and fonts are content, and live in Site &amp; theme.
        </p>
      </div>

      <RuleLabel>Appearance</RuleLabel>

      <Row
        label="Theme"
        hint="Dark is the designed one. Light is the reading theme, for a bright room. System follows whatever the machine is set to."
      >
        <Segmented
          value={look.theme}
          onChange={(theme) => setAppearance({ theme: theme as Theme })}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
        />
      </Row>

      <Row
        label="Accent"
        hint="The colour of whatever is live or selected — including Publish, which is the thing going live. The same five the other tools offer."
      >
        <div class="swatches">
          {ACCENTS.map((accent) => (
            <button
              key={accent.key}
              type="button"
              class={`swatch${look.accent === accent.key ? ' is-on' : ''}`}
              aria-label={accent.label}
              aria-pressed={look.accent === accent.key}
              title={accent.label}
              onClick={() => setAppearance({ accent: accent.key as Accent })}
              style={{ background: look.theme === 'light' ? accent.light : accent.dark }}
            />
          ))}
        </div>
      </Row>

      <Row
        label="Density"
        hint="Packs the block list tighter. Worth it on a long case study, where a page can run to a hundred blocks."
      >
        <Segmented
          value={look.dense ? 'dense' : 'comfortable'}
          onChange={(v) => setAppearance({ dense: v === 'dense' })}
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'dense', label: 'Dense' },
          ]}
        />
      </Row>
    </div>
  );
}

/** A centred small-caps label with hairlines running out to either side. */
function RuleLabel({ children }: { children: ComponentChildren }) {
  return (
    <div class="rule-label">
      <span class="rule" />
      <span class="eyebrow">{children}</span>
      <span class="rule" />
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint: string; children: ComponentChildren }) {
  return (
    <div class="set-row">
      <div class="set-text">
        <span class="set-label">{label}</span>
        <p class="muted set-hint">{hint}</p>
      </div>
      <div class="set-control">{children}</div>
    </div>
  );
}
