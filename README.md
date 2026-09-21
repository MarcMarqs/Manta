# Manta

A game-design portfolio site whose pages are built from content files, plus (soon) an
editor at `/admin` for changing those files without touching code.

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
| `content/site.json` | Site name, tagline, footer, nav, and the whole theme (colors, fonts, radius, spacing) |
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
| `image` | `src`, `alt`, `caption?`, `width?` (`content` \| `wide`) |
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

### Adding a project

1. Add an entry to `content/projects.json`.
2. Drop a cover in `public/images/projects/<slug>/`.
3. Create `content/pages/work/<slug>.json` for its case study.

Set `"draft": true` on a project to keep it out of the build.

## Deploying

Cloudflare builds and deploys the Worker (`manta`) on every push to `main`.
Build command `npm run build`, deploy command `npx wrangler deploy`.

Two secrets are set in the Cloudflare dashboard, never in this repo:

- `ADMIN_PASSWORD` — the password for the `/admin` editor
- `GITHUB_TOKEN` — fine-grained token, this repo only, contents read/write

## Not built yet

The `/admin` editor: block-based page editing with live preview, image upload,
saves committed to a draft branch, and one Publish button that merges to `main`.
