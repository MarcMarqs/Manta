import type { Project, Site, Tags } from './types';
import { orderProjects, projects, site, tags } from './content';

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
export function useContent(locals: App.Locals) {
  const preview = locals.preview;
  const t = preview?.tags ?? tags;
  return {
    preview: Boolean(preview),
    site: preview?.site ?? site,
    tags: t,
    projects: preview ? orderProjects(preview.projects) : projects,
    tagLabel: (id: string) => [...t.discipline, ...t.engine].find((x) => x.id === id)?.label ?? id,
    /**
     * Images uploaded in the editor exist on the draft branch but not in the running
     * build yet, so the preview fetches them through the API instead.
     */
    asset: (src: string) =>
      preview && src?.startsWith('/images/')
        ? `/api/asset?path=${encodeURIComponent(`public${src}`)}`
        : src,
  };
}
