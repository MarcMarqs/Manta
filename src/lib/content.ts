import type { Page, Project, Site, Tags } from './types';
import siteJson from '../../content/site.json';
import projectsJson from '../../content/projects.json';
import tagsJson from '../../content/tags.json';

export const site = siteJson as Site;
export const tags = tagsJson as Tags;

/** Projects in display order: featured first, then newest year first. */
export const projects: Project[] = (projectsJson as Project[])
  .filter((p) => !p.draft)
  .sort((a, b) => Number(b.featured) - Number(a.featured) || b.year - a.year);

export function projectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

export function tagLabel(id: string): string {
  return [...tags.discipline, ...tags.engine].find((t) => t.id === id)?.label ?? id;
}

const pageModules = import.meta.glob<Record<string, unknown>>('../../content/pages/**/*.json', {
  eager: true,
  import: 'default',
});

/** Every page in content/pages/, keyed by route path. home.json is the site root. */
export const pages: Page[] = Object.entries(pageModules).map(([file, data]) => {
  const slug = file.replace('../../content/pages/', '').replace(/\.json$/, '');
  return {
    ...(data as Omit<Page, 'path' | 'slug'>),
    slug,
    path: slug === 'home' ? '/' : `/${slug}`,
  };
});

export function pageByPath(path: string): Page | undefined {
  return pages.find((p) => p.path === path);
}
