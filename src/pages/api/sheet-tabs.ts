import type { APIRoute } from 'astro';
import { handle, json } from '../../server/http';

export const prerender = false;

/**
 * The tabs in a Google Sheet, so the editor can offer them by name instead of asking for
 * a number out of a URL.
 *
 * Google has no public, key-free way to ask this, but the page that renders a sheet
 * carries the list in a script: `items.push({name: "Souls", …, gid: "1307238717"…})`.
 * Reading it here rather than in the browser is not a preference — the editor cannot
 * fetch docs.google.com itself — and it keeps the parsing in one place.
 *
 * The id is scrubbed to the characters Google uses and dropped into a fixed address, so
 * nothing arriving here can choose what gets fetched.
 */
const TAB = /items\.push\(\{name:\s*"((?:[^"\\]|\\.)*)"[^}]*?gid:\s*"(\d+)"/g;

/** A published sheet renders a plain menu instead of the script above. */
const PUBLISHED_TAB = /<li id="sheet-button-(\d+)"[^>]*>(?:<a[^>]*>)?([^<]*)/g;

export const GET: APIRoute = (ctx) =>
  handle(async () => {
    const id = (ctx.url.searchParams.get('id') ?? '').replace(/[^\w-]/g, '');
    const published = ctx.url.searchParams.get('source') === 'published';
    if (!id) return json({ tabs: [] });

    const address = published
      ? `https://docs.google.com/spreadsheets/d/e/${id}/pubhtml`
      : `https://docs.google.com/spreadsheets/d/${id}/preview`;

    const res = await fetch(address, { redirect: 'follow' });
    if (!res.ok) return json({ tabs: [], error: 'That spreadsheet could not be opened.' });
    const html = await res.text();

    const tabs: { name: string; gid: string }[] = [];
    for (const match of html.matchAll(TAB)) {
      const [, name, gid] = match;
      let label = name;
      try {
        label = JSON.parse(`"${name}"`) as string;
      } catch {
        // Keep the raw name: a tab whose label will not parse is still a real tab.
      }
      tabs.push({ name: label, gid });
    }
    if (!tabs.length) {
      for (const match of html.matchAll(PUBLISHED_TAB)) {
        const [, gid, name] = match;
        tabs.push({ name: name.trim(), gid });
      }
    }

    // A page that loaded but holds no tabs means Google served a sign-in wall instead:
    // the sheet exists, but not for anyone who is not signed in to an account that can
    // see it — which is exactly what a visitor to the site would get.
    if (!tabs.length) {
      return json({ tabs: [], error: 'No tabs found. Set sharing to Anyone with the link, then try again.' });
    }
    return json({ tabs });
  });
