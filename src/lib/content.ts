import type { Page, Project, Site, Tags } from './types';
import siteJson from '../../content/site.json';
import projectsJson from '../../content/projects.json';
import tagsJson from '../../content/tags.json';

export const site = siteJson as Site;
export const tags = tagsJson as Tags;

/** Every project as written, including the ones the site does not show. */
export const allProjects = projectsJson as Project[];

/**
 * Projects in display order: public only, featured first, then newest year first.
 *
 * Private and drafted work is absent from every list this returns, which is what keeps
 * it off the home page, out of the tag pages and out of the next-case-study link.
 */
export function orderProjects(list: Project[]): Project[] {
  return list
    .filter((p) => (p.visibility ?? 'public') === 'public')
    .sort((a, b) => Number(b.featured) - Number(a.featured) || (b.year ?? 0) - (a.year ?? 0));
}

export const projects: Project[] = orderProjects(allProjects);

/** Human label for a tag id, for pages that render outside the preview context. */
export const tagLabel = (id: string) =>
  [...tags.discipline, ...tags.engine].find((t) => t.id === id)?.label ?? id;

const pageModules = import.meta.glob<Record<string, unknown>>('../../content/pages/**/*.json', {
  eager: true,
  import: 'default',
});

/** Route path for a page file slug: "home" is the root, "work/dunes" is /work/dunes. */
export const slugToPath = (slug: string) => (slug === 'home' ? '/' : `/${slug}`);

const visibilityOf = new Map(allProjects.map((p) => [p.slug, p.visibility ?? 'public']));

/**
 * Every page in content/pages/ that belongs on the site, keyed by route path.
 *
 * A case study for a drafted project is left out of the build entirely, rather than
 * built and merely unlinked: a page that answers on its address is public whether or
 * not anything points at it, and it would be in the sitemap besides. The editor's
 * preview renders through /admin/preview, so a draft can still be worked on.
 */
const allPages: Page[] = Object.entries(pageModules).map(([file, data]) => {
  const slug = file.replace('../../content/pages/', '').replace(/\.json$/, '');
  return {
    ...(data as Omit<Page, 'path' | 'slug'>),
    slug,
    path: slugToPath(slug),
  };
});

/** What a page's project says about who may read it. Pages without one are public. */
const pageVisibility = (page: Page) => (page.project ? (visibilityOf.get(page.project) ?? 'public') : 'public');

export const pages: Page[] = allPages.filter((page) => pageVisibility(page) === 'public');

/**
 * Case studies for private projects, by project slug. These are built as one dynamic
 * route rather than prerendered: a prerendered page is a file on the asset server, and
 * a file cannot ask for a password.
 */
export const privatePages = new Map(
  allPages.filter((page) => pageVisibility(page) === 'private' && page.project).map((page) => [page.project!, page]),
);
