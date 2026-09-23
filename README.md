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
| `content/tags.json` | Allowed discipline/engine tags, so filters never break from a typo |
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
| `heading` | `level` 1–4, `text` |
| `text` | `html` — rich text |
| `image` | `src`, `alt`, `caption?`, `scale?` (10–100, % of the block), `aspect?` (`1:1` \| `4:3` \| `3:2` \| `16:9` \| `21:9`) |
| `gallery` | `images[]` of `{ src, alt }` |
| `video` | `provider` (`youtube` \| `vimeo` \| `itch`), `videoId`, `title?` |
| `button` | `label`, `href`, `style?` (`primary` \| `secondary`) |
| `divider` | — |
| `spacer` | `size?` (`sm` \| `md` \| `lg`) |
| `table` | `columns[]`, `rows[][]`, `caption?` |
| `chart` | `variant` (`bar` \| `line`), `series[]` of `{ label, value }`, `title?` |
| `columns` | `count` 2–3, `columns[]` each `{ id, blocks[] }` |
| `section` | `background?` (`none` \| `surface` \| `accent`), `blocks[]` |
| `projectRail` | `filters?` — the expandable carousel |
| `projectGrid` | `filters?` — the plain card grid |
| `html` | `html` — escape hatch for embeds the editor can't express |

`section` and `columns` nest other blocks, so layouts compose.

Any block can also take `align` (`left` | `center` | `right`) and `width` (`narrow` | `normal`
| `wide` | `full`). Wide reaches past the text column, full runs edge to edge. A full-width
`section` becomes a coloured band whose content stays in the column. Inside sections and
columns, wide and full fall back to normal. Every option collapses sensibly on a phone.

### Adding a project

1. Add an entry to `content/projects.json`.
2. Drop a cover in `public/images/projects/<slug>/`.
3. Create `content/pages/work/<slug>.json` for its case study.

Set `"draft": true` on a project to keep it out of the build.

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
- **Images** are resized to 2000px and converted to WebP in the browser, then committed to
  `public/images/uploads/` on the draft straight away, so the preview can show them. An image
  block can be scaled and cropped to a shape; the library deletes ones nothing uses any more.

- **Link previews and search:** every page carries Open Graph and Twitter tags, a canonical
  URL, and appears in `/sitemap.xml`; `/robots.txt` keeps crawlers out of `/admin`. A shared
  link shows the page's own description and picture — a case study uses its project cover,
  anything else falls back to the site-wide image in Site & theme. All of it hangs off the
  **Site address** there, so update that when the domain changes.

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
- `GITHUB_TOKEN` — fine-grained token: this repository only, **Contents: Read and write**.

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
