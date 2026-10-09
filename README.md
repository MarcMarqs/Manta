# Manta

A game-design portfolio site whose pages are built from content files, plus an editor
at `/admin` for changing those files without touching code.

Astro → static HTML → served by a Cloudflare Worker. See [MANTA-SPEC.md](MANTA-SPEC.md)
for the decisions behind it.

## Running it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs to dist/
```

## How content works

Nothing about a page lives in the code. Every page is a JSON file under `content/`:

| File | What it holds |
|---|---|
| `content/site.json` | Site address, name, tagline, footer, nav, link-preview image, and the whole theme (colors, fonts, radius, spacing) |
| `content/pages/**.json` | One file per page. `home.json` is `/`, `about.json` is `/about`, `work/dunes.json` is `/work/dunes` |
| `content/projects.json` | The project index used by the rail and grid blocks |
| `content/tags.json` | Allowed discipline/engine tags, so filters never break from a typo. Each one gets a `/tags/<id>` page |
| `content/media.json` | Written by the editor: which sizes exist for each uploaded image, used to build a `srcset` |
| `public/images/…` | Images, committed to the repo |

A page is a title plus an ordered array of blocks:

```json
{
  "title": "About",
  "blocks": [
    { "id": "h", "type": "heading", "level": 1, "text": "About" },
    { "id": "bio", "type": "text", "html": "<p>Hello.</p>" }
  ]
}
```

Every block needs a unique `id` (unique within its page) and a `type`.

### Block types

| Type | Fields |
|---|---|
| `heading` | `level` 1–4, `text`, `number?` + `eyebrow?` for a numbered section header |
| `text` | `html` — rich text |
| `image` | `src`, `alt`, `caption?`, `scale?` (10–100, % of the block), `aspect?` (`1:1` \| `4:3` \| `3:2` \| `16:9` \| `21:9`) |
| `gallery` | `images[]` of `{ src, alt }` |
| `video` | `provider` (`youtube` \| `vimeo` \| `itch`), `videoId`, `title?` |
| `button` | `label`, `href`, `style?` (`primary` \| `secondary`) |
| `divider` | — |
| `spacer` | `size?` (`sm` \| `md` \| `lg`) |
| `table` | `columns[]`, `rows[][]`, `caption?` |
| `specs` | `items[]` of `{ label, value }` — the strip under a case-study title |
| `stats` | `items[]` of `{ value, label }` — figures set large |
| `chart` | `variant` (`bar` \| `line`), `title?`, `note?`, `range?` `{ from, to, step? }`, `reference?` `{ value, label? }`, `series[]` of `{ name?, formula?, labels?, data? }` where a data point is `{ label, value, emphasis? }` |
| `pillars` | `items[]` of `{ label, body }` — callout boxes for design principles |
| `tornado` | `rows[]` of `{ label, low, high }`, `title?`, `unit?`, `lowLabel?`, `highLabel?` |
| `flow` | `nodes[]` of `{ id, label, accent? }`, `edges[]` of `{ from, to }`, `caption?` |
| `systemMap` | `arrange?` (`radial` \| `layered`), `nodes[]` of `{ id, label, note?, accent?, layer? }`, `links[]` of `{ from, to, label?, dashed? }`, `caption?` |
| `radar` | `axes[]`, `series[]` of `{ name?, values[] }`, `max?`, `title?` |
| `columns` | `count` 2–3, `columns[]` each `{ id, blocks[] }` |
| `section` | `background?` (`none` \| `surface` \| `accent`), `arrange?` (`stack` \| `row`), `blocks[]` |
| `projectRail` | `filters?` — the expandable carousel |
| `projectGrid` | `filters?` — the plain card grid |
| `html` | `html` — escape hatch for embeds the editor can't express |

A chart series is either typed out as `data`, or computed by a `formula` across `range`,
so a chart built on a curve stays right when the curve changes. A formula is arithmetic in
`x` — `round(90 * pow(1.28, x - 75))` — with `^` and `round, floor, ceil, abs, min, max,
sqrt, pow, exp, log`. It is **not** JavaScript: it is parsed and evaluated by
`src/lib/formula.ts`, because formulas live in content the editor can write, and the
editor must never be able to put executable code into the repo. A formula that doesn't
parse shows a note under the chart instead of failing the build.

A chart is shaped to the claim it is making, not to the numbers it holds. **Reference**
draws a line across it to read the marks against — a target, a proposal, a floor.
**Emphasis** lifts one point out of its series or pushes it back, so an exception can be
seen rather than hunted for; an emphasised point prints its value, and a series set to
show **labels** prints all of them. **Note** is the line under the title that says what
the numbers mean or where they came from.

A **system map** draws nodes and the links between them, for explaining how the parts of
a system feed each other. Positions are never authored: **Around a core** puts the first
node in the middle and spaces the rest around it, **Left to right** runs them in the
columns their layer names. A link can carry a short label, and steps aside when the gap
between two nodes is too small to hold it. A map wider than the text column scrolls
sideways rather than shrinking its labels, so set the block to **wide** when it has a lot
of nodes. A diagram that needs hand-placed coordinates is a drawing, and belongs in an
image block.

A **radar** compares several things across the same measures — enemy archetypes on one
stat line. Every axis shares one scale, because a radar that normalises each axis on its
own can draw two very different things identically. Series are told apart by colour *and*
by dash, so they survive a mono print and a colour-blind reader.

`section` and `columns` nest other blocks, so layouts compose. A section set to **Side by
side** (`"arrange": "row"`) lays its blocks in a row instead of a stack, each as wide as it
needs to be, wrapping onto the next line when it runs out of room — for a row of buttons
or a few small things that belong together. Use `columns` instead when you want equal
tracks of content that stay aligned.

Any block can also take `align` (`left` | `center` | `right`) and `width` (`narrow` | `normal`
| `wide` | `full`). Wide reaches past the text column, full runs edge to edge. A full-width
`section` becomes a coloured band whose content stays in the column. Inside sections and
columns, wide and full fall back to normal. Every option collapses sensibly on a phone.

### Origin

Every project has an **origin**: `professional` (the default — studio work) or `personal`
(prototypes, jam games, studies). The home page shows a shelf for each. Set it per project
in the editor, or with `"origin": "personal"` in `projects.json`. A `projectRail` or
`projectGrid` block shows one origin, chosen in the block's settings; tag pages ignore the
split and list everything carrying the tag.

Within a shelf, `featured` projects lead — the editorial weight the earlier prototype
called `primary`.

### Adding a project

1. Add an entry to `content/projects.json`.
2. Drop a cover in `public/images/projects/<slug>/`. A `coverVideo` plays over it: in the
   rail only while that card is open, in the grid only under the pointer (or when the card
   scrolls into view on a touch screen), so a page of cards doesn't run every video at once.
3. Create `content/pages/work/<slug>.json` for its case study.

### Who can see a project

Each project carries a `visibility`, set in the editor under **Who can see it**:

| Value | What happens |
| --- | --- |
| `public` | Listed and linked like any other project. The default. |
| `private` | Absent from the home page, the tag pages, the sitemap and the next-case-study link. Its case study is not built as a file at all: it is served on demand at `/private/<slug>` and asks for `WORK_PASSWORD` first. Nothing of the project — not even its title — is in the response until the password is right. |
| `draft` | Not built. Nothing of it reaches the site. |

A private case study is reached only by the address you send someone, which the editor
shows next to the setting. It is a dead end on purpose: no tag links, no next case study,
`noindex` in the head and `Disallow: /private/` in robots.txt. Unlock lasts a week in
that browser.

If `WORK_PASSWORD` is unset, private case studies answer 404 — the safe way to fail.

## The editor (`/admin`)

Pages, projects, tags and the theme are edited at `/admin`: forms on the left, a live
preview on the right rendered by the site's own components, so what you see is what ships.

- **Blocks:** add from the menu (or the `+` between blocks), drag the grip or use the arrows to
  reorder, duplicate, delete. Click anything in the preview to jump to its settings.
- **Save draft** (Ctrl+S) commits every changed file to the `draft` branch in one commit.
  Cloudflare builds that branch at its own preview URL.
- **Publish** makes the draft live: `main` moves to the draft, then the draft branch is deleted.
  A fresh one is cut from `main` on the next save.
- **Discard draft** (⋯ menu) throws away saved-but-unpublished changes.
- **Undo / redo:** Ctrl+Z / Ctrl+Shift+Z, including deleted pages, until you reload.
- **Block shortcuts** with a block selected: Ctrl+D duplicates, Alt+↑/↓ moves, Delete removes,
  Escape deselects. Moving off the end of a section or column lifts the block out of it,
  landing just before or after whatever held it — one level at a time, so a block in a
  column inside a section lands in the section rather than on the page.
- **Version history** (⋯ menu) lists every save and publish, and restores one as a new change,
  so going back is itself undoable.
- **Unsaved work** is kept in the browser: close the tab by accident and the editor offers it
  back next time.
- **Images** are resized to 2000px and converted to WebP in the browser, then committed to
  `public/images/uploads/` on the draft straight away, so the preview can show them. An image
  block can be scaled and cropped to a shape; the library deletes ones nothing uses any more.

- **Contents list:** every heading gets an anchor derived from its words, so any section can
  be linked to directly. A page with three or more level-2 headings also floats a jump-to
  rail in the right margin: dashes at rest, labels on hover, the current section marked as
  you read. Turn it off per page under **Page settings → Contents list**. It needs a margin
  to live in, so it hides below 1080px.

- **Link previews and search:** every page carries Open Graph and Twitter tags, a canonical
  URL, and appears in `/sitemap.xml`; `/robots.txt` keeps crawlers out of `/admin`. A shared
  link shows the page's own description and picture — a case study uses its project cover,
  anything else falls back to the site-wide image in Site & theme. All of it hangs off the
  **Site address** there, so update that when the domain changes.

**Settings** in the sidebar holds what belongs to you rather than to the work: theme
(dark, the reading light theme, or follow the system), the accent that marks whatever is
live or selected, and block-list density. It is kept in your browser and never committed
— the site's own colours and fonts are content, and live in Site & theme.

The editor's chrome uses the same palette and faces as Shipwreck, Siren and Barnacle —
deep water at night, Cinzel for labels, Inter for body, and one phosphorescent green that
only marks what is live or selected. Dark is home; a light reading theme applies if the
system asks for one. It is deliberately independent of the site's own theme, so the
preview pane always looks like the site and the chrome around it always looks like Manta.

The editor can only write `content/**.json` and `public/images/**`, never code or config.

### Running it locally

```bash
npm run dev      # then open http://localhost:4321/admin
```

Local dev reads secrets from `.dev.vars` (gitignored). With no `GITHUB_TOKEN` there, the editor
works in **local mode**: saves write straight to the files on disk, and publishing is git's job.
Add a token to `.dev.vars` to test against GitHub instead.

## Deploying

Cloudflare builds and deploys the Worker (`manta`) on every push. In the Worker's
**Settings → Build**:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler versions upload` |
| Builds for non-production branches | Enabled (this is what gives `draft` its preview URL) |

Secrets, set under **Settings → Variables and Secrets** as type *Secret*, never in this repo:

- `ADMIN_PASSWORD` — the password for `/admin`. Changing it signs every session out.
- `WORK_PASSWORD` — opens case studies marked private. You give this one out, so keep it
  different from `ADMIN_PASSWORD`; it opens nothing but those pages, and a session for one
  is never a session for the other. Changing it ends every unlock.
- `GITHUB_TOKEN` — fine-grained token: this repository only, **Contents: Read and write**.

## Embedding a spreadsheet

The **Spreadsheet** block puts a Google Sheet on the page, live. Paste the address from
your browser and it works out the id and the tab on its own.

Two ways to show one:

- **The file** — the spreadsheet as it looks in Sheets, tabs along the bottom. It obeys
  the sharing set on the file, so set that to *Anyone with the link* or readers get a
  sign-in page where the sheet should be.
- **Published grid** — the bare grid, from **File → Share → Publish to web**. Publishing
  makes it readable by anyone who has the published address, whatever the file's own
  sharing says.

**Sheet tab** lists the tabs by name, read off the spreadsheet itself: the editor fetches
the sheet's own page server-side and pulls the list out of it, since Google offers no
key-free way to ask. If they cannot be read — a sheet that is not shared, or no network —
the field falls back to taking the number by hand, so a picker that will not load never
becomes the only way in.

The tab is stored as a `gid` and carried in the address fragment, because that is what
Sheets reads: a `?gid=` query is accepted and then ignored, landing the reader on the
first tab however carefully it was set.

Either way the sheet is served by Google, inside a frame: it keeps its own light
appearance and will not follow the site's dark theme. A sheet embedded on a private case
study is still only as private as its own sharing — the password on the page does not
reach inside the frame.

## Measuring

**Site & theme → Sharing & search → Cloudflare Web Analytics token** turns on counting.
In the Cloudflare dashboard: **Analytics & Logs → Web Analytics → Add a site**, then paste
the token out of the snippet it offers. Empty means nothing is measured.

It is cookieless and stores no identifier, so the site needs no consent banner — which
matters, because a banner would be the first thing anyone sees. The beacon is left out of
the editor's preview: looking at your own page while writing it is not a visit.

After the first deploy, put your real URLs in `wrangler.jsonc` under `vars`
(`LIVE_URL`, `PREVIEW_URL`) so the editor can link to them.

`public/.assetsignore` keeps the Worker's server code out of the public static assets.
Don't delete it.

### Keeping visitors out of Manta

Set `ADMIN_HOST` in `wrangler.jsonc` to the one hostname the editor should live on. On every
other hostname, `/admin` and `/api/*` answer with the site's normal 404 page, so a visitor
can't even tell an editor exists.

The usual setup, once you own a domain:

1. Attach the domain to the Worker (**Settings → Domains & Routes → Add → Custom domain**).
   That is the address you share.
2. Set `"ADMIN_HOST": "manta.<subdomain>.workers.dev"`. That address becomes yours alone.
3. Optional, stronger: put **Cloudflare Access** (Zero Trust, free) in front of that
   workers.dev hostname and the `draft-` preview one, so only your email can even load them.

While the site only has its workers.dev address, leave `ADMIN_HOST` empty: there is just one
hostname, and blocking it would lock you out too.
