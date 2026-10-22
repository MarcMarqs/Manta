import type { Project, Site, Tags } from './types';
import { caseStudyHref, orderProjects, projects, site, tags } from './content';

/** Unsaved editor content, posted to /admin/preview so it renders through the real components. */
export interface PreviewData {
  site: Site;
  projects: Project[];
  tags: Tags;
}

/**
 * The content a component should render. On the built site this is the committed JSON;
 * inside the editor's preview it is whatever is currently in the editor.
 */
/**
 * Which shelf a project belongs to, and which one a block means.
 *
 * Both default to the first origin on the list rather than to a name written here: the
 * list is the author's, and the first entry is whatever they put at the top.
 */
export const originOf = (value: string | undefined, origins: { id: string }[]) =>
  value ?? origins[0]?.id ?? '';

/** A project's facts, run together with whatever the site puts between them. */
export const factLine = (site: { separator?: string }, facts: (string | number | undefined | null)[]) =>
  facts.filter(Boolean).join(site.separator ?? ' · ');

export function useContent(locals: App.Locals) {
  const preview = locals.preview;
  const t = preview?.tags ?? tags;
  return {
    preview: Boolean(preview),
    site: preview?.site ?? site,
    tags: t,
    projects: preview ? orderProjects(preview.projects) : projects,
    tagLabel: (id: string) => [...t.discipline, ...t.engine].find((x) => x.id === id)?.label ?? id,
    /** Whether a tag is one of the marked ones. */
    tagAccent: (id: string) => Boolean([...t.discipline, ...t.engine].find((x) => x.id === id)?.accent),
    /**
     * Where a project's case study is. The built site reads it off the pages themselves,
     * so a page named differently from its project is still found.
     *
     * The preview is sent the projects but not the pages, so there is nothing there to
     * read it from and it falls back to the old convention. That is the right trade:
     * inside the preview these links are not followed anyway, and the alternative is
     * shipping every page's path to the browser to decide the href of a card.
     */
    caseStudy: (slug: string) => (preview ? `/work/${slug}` : (caseStudyHref(slug) ?? `/work/${slug}`)),
    /**
     * Files uploaded in the editor exist on the draft branch but not in the running
     * build yet, so the preview fetches them through the API instead.
     */
    asset: (src: string) =>
      preview && /^\/(images|videos)\//.test(src ?? '')
        ? `/api/asset?path=${encodeURIComponent(`public${src}`)}`
        : src,
  };
}
