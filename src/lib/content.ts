import type { Page, Project, Site, Tags } from './types';
import siteJson from '../../content/site.json';
import projectsJson from '../../content/projects.json';
import tagsJson from '../../content/tags.json';

export const site = siteJson as Site;
export const tags = tagsJson as Tags;

/** Projects in display order: drafts hidden, featured first, then newest year first. */
export function orderProjects(list: Project[]): Project[] {
  return list
    .filter((p) => !p.draft)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (b.year ?? 0) - (a.year ?? 0));
}

export const projects: Project[] = orderProjects(projectsJson as Project[]);

/** Human label for a tag id, for pages that render outside the preview context. */
export const tagLabel = (id: string) =>
  [...tags.discipline, ...tags.engine].find((t) => t.id === id)?.label ?? id;

const pageModules = import.meta.glob<Record<string, unknown>>('../../content/pages/**/*.json', {
  eager: true,
  import: 'default',
});

/** Route path for a page file slug: "home" is the root, "work/dunes" is /work/dunes. */
export const slugToPath = (slug: string) => (slug === 'home' ? '/' : `/${slug}`);

/** Projects held back from the site, by slug. */
const drafted = new Set((projectsJson as Project[]).filter((p) => p.draft).map((p) => p.slug));

/**
 * Every page in content/pages/ that belongs on the site, keyed by route path.
 *
 * A case study for a drafted project is left out of the build entirely, rather than
 * built and merely unlinked: a page that answers on its address is public whether or
 * not anything points at it, and it would be in the sitemap besides. The editor's
 * preview renders through /admin/preview, so a draft can still be worked on.
 */
export const pages: Page[] = Object.entries(pageModules)
  .map(([file, data]) => {
    const slug = file.replace('../../content/pages/', '').replace(/\.json$/, '');
    return {
      ...(data as Omit<Page, 'path' | 'slug'>),
      slug,
      path: slugToPath(slug),
    };
  })
  .filter((page) => !(page.project && drafted.has(page.project)));
