import type { Page, Project, Site, Tags } from './types';
import siteJson from '../../content/site.json';
import projectsJson from '../../content/projects.json';
import tagsJson from '../../content/tags.json';

export const site = siteJson as Site;
export const tags = tagsJson as Tags;

/** Every project as written, including the ones the site does not show. */
export const allProjects = projectsJson as Project[];

/**
 * Projects in display order, which is simply the order they are kept in.
 *
 * Sorting them here by year, with one flag to push a favourite to the front, meant the
 * running order was something to be worked around rather than decided: two projects from
 * the same year could not be separated, and nothing could be put third.
 *
 * Private and drafted work is absent from every list this returns, which is what keeps it
 * off the home page, out of the tag pages and out of the next-case-study link.
 */
export function orderProjects(list: Project[]): Project[] {
  return list.filter((p) => (p.visibility ?? 'public') === 'public');
}

export const projects: Project[] = orderProjects(allProjects);

/** Human label for a tag id, for pages that render outside the preview context. */
export const tagLabel = (id: string) =>
  [...tags.discipline, ...tags.engine].find((t) => t.id === id)?.label ?? id;

/** Whether a tag is one of the marked ones, for pages that render outside the preview. */
export const tagAccent = (id: string) =>
  Boolean([...tags.discipline, ...tags.engine].find((t) => t.id === id)?.accent);

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
 * Where a project's case study is, by project slug.
 *
 * A link used to be built as /work/<slug> wherever one was wanted, which is a guess
 * dressed as an address: it is right only while the page file happens to be named after
 * the project. Two pages were not -- a page kept its old filename after the project was
 * renamed -- and their cards pointed at 404s on the live site while the pages themselves
 * answered perfectly well at the addresses they actually had.
 *
 * The page says which project it belongs to, so that is what is read first. The old
 * convention stays as a fallback for the pages that never set it, and a project with no
 * page at all gets nothing rather than a link into a 404.
 */
const studyPaths = new Map<string, string>();
for (const page of allPages) if (page.project) studyPaths.set(page.project, page.path);
for (const project of allProjects) {
  if (studyPaths.has(project.slug)) continue;
  const byName = allPages.find((page) => page.path === `/work/${project.slug}`);
  if (byName) studyPaths.set(project.slug, byName.path);
}

/** The address of a project's case study, or nothing if it has none. */
export const caseStudyHref = (slug: string) => studyPaths.get(slug);

/**
 * Case studies for private projects, by project slug. These are built as one dynamic
 * route rather than prerendered: a prerendered page is a file on the asset server, and
 * a file cannot ask for a password.
 */
export const privatePages = new Map(
  allPages.filter((page) => pageVisibility(page) === 'private' && page.project).map((page) => [page.project!, page]),
);
