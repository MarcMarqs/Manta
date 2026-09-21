# Manta — Portfolio + Editor Spec

_Decisions locked 2026-09-20. Supersedes `portfolio-cms-project-overview.md` and
`project-summary.md` wherever they disagree._

## What Manta is
A personal game-design portfolio site **plus** a built-in editor (`/admin`) that lets the
owner create and adjust pages without touching code. One site, one user.

## Locked decisions

| Area | Decision |
|---|---|
| Codebase | Start fresh. Old Astro zip and HTML prototype are design references only. |
| Editing | Forms + block list on the left, live preview of the real page on the right. |
| Pages | Fully block-based. Every page, home included, is a stack of blocks. |
| Hosting | Cloudflare **Worker** (`manta`), built from GitHub on push. Not Pages. |
| Language | English only, but content shape keeps a locale key so PT can be added later. |
| Auth | Password login to `/admin`. GitHub token lives as a Worker secret, never in the browser. |
| Scope | This portfolio only. No multi-site support. |
| Publishing | Saves go to a draft branch with its own preview URL. One Publish button merges to `main`. |
| Styling | Global theme only: accent, background, fonts, spacing scale, light/dark. |
| Domain | `workers.dev` for now. |
| Home layout | Build **both** the expandable rail and the simple grid as blocks; choose after testing live. |

## Block set (v1)
- **Core:** heading, rich text, image, gallery, video embed, button, spacer/divider
- **Data:** table, chart
- **Layout:** columns, section (own background), project rail, project grid
- **Escape hatch:** raw HTML/embed (itch.io widgets, iframes)

## Proposed stack
Astro with the Cloudflare adapter. Content pages prerendered as static HTML; `/admin` and
`/api/*` run as Worker routes so the GitHub token stays server-side.

## Content model
- `content/site.json` — site name, tagline, footer, nav, theme tokens
- `content/pages/<slug>.json` — a page: metadata + ordered block array
- `content/projects.json` — project index: slug, cover, tags, summary, highlights, links
- `content/tags.json` — controlled vocabulary for filters
- `public/images/…` — uploaded images, committed to the repo
- Video is never stored in git: provider + id (YouTube / Vimeo / itch.io)

## Current blockers
1. **The `MarcMarqs/Manta` repo is empty.** Cloudflare's "error occurred while fetching
   repository" is just that — nothing to clone. Fixed by the first push.
2. **The local project folder is empty.** Nothing to push yet.
3. **The Cloudflare project is a Worker, not Pages.** Preview URLs and build config differ
   from the original plan; the draft/preview flow must be adapted.

## Still undecided (defaults assumed unless you say otherwise)
- About page depth: bio + contact only
- Contact: email link, no form
- Case-study structure: free blocks, with Overview → Goals → Process → Outcome → Takeaways
  offered as a starting template
- Project ordering: newest first, with a `featured` flag available
- Image handling: resize and convert to WebP on upload
