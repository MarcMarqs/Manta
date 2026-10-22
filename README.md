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
| `callout` | `tone?` (`note` \| `key` \| `caution` \| `result`), `title?`, `html` — a panel that asks the reader to stop |
| `image` | `src`, `alt`, `caption?`, `scale?` (10–100, % of the block), `aspect?` (`1:1` \| `4:3` \| `3:2` \| `16:9` \| `21:9`) |
| `gallery` | `layout?` (`grid` \| `carousel`), `fit?` (`cover` \| `contain`), `images[]` of `{ src, alt, caption? }` — a grid takes its column count from the number of pictures, up to four, and fills the width |
| `video` | `provider` (`file` \| `youtube` \| `vimeo` \| `itch`), `videoId`, `src?` (for `file`), `loop?`, `scale?` (10-100, % of the block), `aspect?` (as `image`), `title?` |
| `button` | `label`, `href`, `style?` (`primary` \| `secondary`) |
| `divider` | — |
| `spacer` | `size?` (`sm` \| `md` \| `lg`) |
| `table` | `columns[]`, `rows[][]`, `caption?` — a cell grows as you type and keeps the line breaks you put in it |
| `specs` | `arrange?` (`row` \| `stack`), `items[]` of `{ label, value }` — the strip under a case-study title, or a one-per-line list |
| `formula` | `title?`, `terms[]` of `{ label, note?, op?, accent? }` where `op` is the symbol *before* a term, `note?` — how a number is arrived at |
| `stats` | `items[]` of `{ value, label }` — figures set large |
| `chart` | `variant` (`bar` \| `line`), `title?`, `note?`, `range?` `{ from, to, step? }`, `reference?` `{ value, label? }`, `series[]` of `{ name?, formula?, labels?, data? }` where a data point is `{ label, value, emphasis? }` |
| `pillars` | `items[]` of `{ label, body }` — callout boxes for design principles; the row width is chosen so the boxes divide evenly (four become 2×2), and a short last row is centred |
| `tornado` | `rows[]` of `{ label, low, high }`, `title?`, `unit?`, `lowLabel?`, `highLabel?` |
| `flow` | `nodes[]` of `{ id, label, accent? }`, `edges[]` of `{ from, to }`, `caption?` |
| `systemMap` | `arrange?` (`radial` \| `layered` \| `stacked`), `nodes[]` of `{ id, label, note?, accent?, layer? }` — a note runs to as many lines as it is given, and becomes a list when a line starts with `-`, `links[]` of `{ from, to, label?, dashed? }`, `caption?` |
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

Any block can also take `align` (`left` | `center` | `right`), `width` (`narrow` | `normal`
| `wide` | `full`) and, for a narrow block, `place` (`left` | `center` | `right`). Wide
reaches past the text column, full runs edge to edge. A full-width `section` becomes a
coloured band whose content stays in the column. Inside sections and columns, wide and full
fall back to normal. Every option collapses sensibly on a phone.

**Align and Position are different things.** Align is the text inside a block; Position is
where the block itself sits, and only a narrow block is small enough for that to mean
anything — 640px inside a 1100px column leaves 460px to play with. Position shows up in the
editor only when Width is Narrow, and defaults to centre, which is where narrow blocks have
always sat, so nothing moves until you move it. The two combine: a block pinned left with
its text centred is `place: left` plus `align: center`.

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
3. **Frame it.** A card is 16:10 and a cover rarely is, so something gets cut. Under
   **Projects → Framing** the picture is shown at the crop a card will make, and dragging
   it sets which part survives (`coverFocus`, a CSS position like `"50% 20%"`; absent means
   the middle). **Show all** (`coverFit: "contain"`) fits the whole picture in the frame
   instead, on a surface-coloured background — for logo art whose corners are the point.
   Both apply everywhere a cover appears: the rail, the grid and the next-case-study link.
4. Create `content/pages/work/<slug>.json` for its case study.

### The running order

Projects appear in the order they sit in under **Projects**, and the arrows on each row
move them. That order is the order everywhere: the rail, the grid, the tag pages and the
next-case-study link at the foot of a case study.

The list is grouped by origin, because only projects sharing a shelf are ever shown
together — and a move stays inside its shelf, stepping over whatever else lies between
them in the file. Reordering one shelf never disturbs another.

Projects hidden from the site keep their place in the list rather than being skipped, so
a draft lands where it was put when it goes public.

### Origins

A project sits on exactly one **origin** — the shelf it belongs to. The list lives under
**Tags → Origins**: rename them, reorder them, add as many as the work needs. The first
is where a new project lands.

A project rail or grid is pointed at one of them, which is how the home page shows studio
work in one place and personal studies in another. Removing an origin moves its projects,
and every rail and grid aimed at it, to the first shelf that remains — a block left
pointing at a missing shelf would just show nothing, with no sign why. The last origin
cannot be removed.

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

**Duplicate page** (beside Delete, in a page's header) copies a page whole to the next
free address: `/about` becomes `/about-copy`, then `/about-copy-2`. A page in a folder
stays in it. Every block is cloned rather than shared, so each gets a new id and editing
the copy never touches the original. The copy does not carry **Case study for** — two
pages claiming one project leaves no answer to which of them is its case study.

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
- **The panes** are yours to size: drag either divider to make the page list or the editing
  pane wider, double-click a divider to put that one column back, and use the two buttons at
  the top left to fold a pane away and bring it back. Widths are clamped so the preview keeps
  at least 300px. **Reset panel sizes** (⋯ menu) restores the shipped layout, which is the
  width the preview's device sizes are drawn for. The choice is kept in the browser, like the
  theme, so it follows you rather than the site.
- **The Pages list keeps the order you put it in.** Hover a page in the sidebar and arrows
  appear at its right end; the first move writes the whole order into `site.json` as
  `pageOrder`, and **A–Z** in the Pages header drops it again. A page that is not in the
  list sorts after the ones that are, alphabetically, so adding a page never reshuffles
  what you arranged. Only the editor reads it — visitors reach pages through the navigation
  and the links on them.
- **Colouring text while you write:** the toolbar carries **Text colour** and **Highlight
  colour**, each a free picker. The popover shows what the colour measures against the
  light theme and the dark one — a coloured word against the page it sits on, a highlight
  against the text that sits on it — so a choice that disappears in one theme says so
  before it ships. The numbers inform, they do not refuse; **None** takes the colour off
  again without touching the bold, links or anything else in the selection. Each of the
  two carries a bar of the colour it would apply, under its icon, so which is which and
  what either is set to can be seen without opening them.
- **Code and formulas:** two more toggles in the same toolbar. **Code** sets the selection
  in the monospace face with a tinted box, for a key, a command, a field name -- the thing
  someone would type. **Formula** sets it in a serif italic, for a quantity someone would
  read: `Heavy Cost = Light Cost x Heavy Multiplier`. They are deliberately not the same
  treatment, because the two look alike from a distance and mean different things, and a
  damage equation is not a string to be pasted into a console. Both light up when the
  caret is inside one, and pressing again takes it off.
- **Markdown in:** **Markdown** in a page's header takes a `.md` file — dropped, chosen or
  pasted — and turns it into blocks, either replacing the page or adding to the end. **New
  page** can start from one too, taking its title from the first `#` heading. Headings,
  prose, lists, quotes, links, pictures, tables, rules and code all come across, with
  `**bold**`, `*italic*`, `` `code` ``, `[links](/to)`, `==highlight==` and `~~strike~~`
  inside them. GitHub's alert syntax (`> [!WARNING]`, `> [!TIP]`, `> [!NOTE]`,
  `> [!IMPORTANT]`) becomes a callout, while an ordinary quotation stays a quotation.
  Consecutive prose gathers into one text block rather than one per paragraph,
  because a page of thirty single-paragraph blocks is miserable to edit. What Markdown
  cannot say — a chart, a project rail, a spec strip — you add afterwards. An import is one
  undoable change, so Ctrl+Z puts the page back.
- **Version history** (⋯ menu) lists every save and publish, and restores one as a new change,
  so going back is itself undoable.
- **Unsaved work** is kept in the browser: close the tab by accident and the editor offers it
  back next time.
- **Images** are resized to 2000px and converted to WebP in the browser, then committed to
  `public/images/uploads/` on the draft straight away, so the preview can show them. An image
  block can be scaled and cropped to a shape; the library deletes ones nothing uses any more,
  taking the smaller copies with it. The library lists pictures, not those copies — an upload
  is four files, and listing all four made three of them look like unused duplicates.
  GIFs and SVGs are kept exactly as they are, since re-encoding would freeze one and
  rasterise the other.

- **Video from your own machine:** a video block's **Source** offers **My computer**
  alongside the three embeds. The clip is committed to `public/videos/uploads/` on the draft
  and played by the browser itself, with no third party involved. Two limits are worth
  knowing: **MP4 or WebM only**, because those are what browsers play, and **25 MB**, which
  is the largest single file Cloudflare will serve from the built site — the editor refuses a
  bigger one up front rather than letting it fail after publishing. Nothing re-encodes it, so
  what you export is what the repository carries; export at the size you want served.
  **Loop silently** plays a short capture over and over without sound, the way a GIF does,
  which is a far smaller file than the same thing as an actual GIF. The trash button deletes
  the file itself, and refuses while any page still points at it.

- **A case study is two files.** The page carries the writing; the project carries the
  facts a reader sees at the foot of it — the cover, the tags and the buttons linking out.
  **Page settings → Case study for** names the project and carries an **Edit project**
  button through to it, which is where the Links section lives. The project carries the
  way back, under its slug and again under **Case study**.

  The link is the page's own `project` field, not the file's address, so a case study
  can be duplicated, renamed or kept at an address of its own and still be found. A
  project with no page offers to make one, or to **point at a page you already have**;
  **Unlink** leaves the page where it is and only breaks the tie.
- **The card at the foot of a case study** is set per page under **Page settings → Next
  case study**: the next project in the Projects order (the default), the next one in the
  same origin, a particular project, or nothing at all. Stored as `next` — a project slug,
  `origin`, or `none`. A private case study never shows one.

- **Contents list:** every heading gets an anchor derived from its words, so any section can
  be linked to directly. A page with two or more level-2 headings also floats a jump-to
  rail in the right margin — two is enough — with dashes at rest, labels on hover, and the
  current section marked as you read. Turn it off per page under **Page settings → Contents list**. It needs a margin
  to live in, so it hides below 1080px.

- **Link previews and search:** every page carries Open Graph and Twitter tags, a canonical
  URL, and appears in `/sitemap.xml`; `/robots.txt` keeps crawlers out of `/admin`. A shared
  link shows the page's own description and picture — a case study uses its project cover,
  anything else falls back to the site-wide image in Site & theme. All of it hangs off the
  **Site address** there, so update that when the domain changes.

**Colours come in pairs.** Every colour in **Site & theme → Colors** has a Light value and
a Dark one, the accent included: a green bright enough to glow on a near-black page
measures 1.3:1 against white, which is a stain rather than a colour. Each accent shows what
it measures against the background it will sit on, and a **Fix** button appears when it
falls under 4.5:1 — it keeps the hue and saturation and moves only the lightness, as far as
it has to and no further. A theme with no dark accent set gets one derived the same way, so
nothing is ever unreadable by default. The text that sits on a filled accent (a button) is
derived per theme too, which is why a pale accent gets dark text and a deep one gets white.

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

## Carousels

A **Gallery** block shows its images as a grid or as a **carousel** — one at a time, with
arrows and dots to rotate through, and a caption per image. Either way, clicking an image
opens it full size, where the arrow keys move between the images of that same gallery and
a click outside closes it.

The carousel is a scroller with snap points rather than a slideshow driven by script, so
it swipes on a touch screen and takes the keyboard on its own. The buttons only nudge that
scroll along.

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

**Show only this tab** gives the reader that one tab and no way through the frame to the
rest. The file view normally carries the whole workbook, strip along the bottom and all;
with this on, the block embeds the single sheet as a plain grid, and the page Google
serves names no other tab. It needs a tab chosen first -- there is no "only" without a
which -- and the published grid is already single, so the switch appears for the file
view alone.

What it does not do is change the file. Anyone who has the spreadsheet's own address
still opens all of it, because that is the sharing you set in Google and not something a
page can take back. If the other tabs must stay unseen by anyone who comes looking, keep
them in a different file.

Either way the sheet is served by Google, inside a frame: it keeps its own light
appearance and will not follow the site's dark theme. A sheet embedded on a private case
study is still only as private as its own sharing — the password on the page does not
reach inside the frame.

## A spec strip that breaks its lines

A value in the **Spec strip** keeps the lines it was given: press Enter in the value field
and the break survives onto the page, in the strip and in the one-per-line arrangement
alike. A role with two halves, a date range, two studios -- they read better stacked than
run together with a slash. Labels stay single-line, which is what a label is.

## Picking tags out

Each tag under **Tags** has an **Accent** switch. A tag with it on is drawn in the accent
colour wherever it is listed as a fact about a project — on the cards, and under a case
study. Turning it on for the engines is the quickest way to tell tools from disciplines
at a glance, but it is per tag rather than per group: a discipline worth singling out can
have it too.

The filter row is left alone. There the accent already means "this one is on", and one
colour cannot mean two things in the same row.

## Embedding a document

The **Document** block is the spreadsheet block's twin for Google Docs: paste the address
and it works out the id. **The file** obeys the sharing set on the document; **Published
text** is one put through File → Share → Publish to web, readable by anyone with the
published address. Same caveats as a sheet — it is served by Google inside a frame, keeps
its own light appearance, and is only as private as its own sharing.

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
