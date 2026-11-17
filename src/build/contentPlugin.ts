import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import {
  extractCheatSheet,
  extractHeadings,
  extractInterviewQA,
  extractQuestions,
  extractTerms,
  extractWords,
  parseFrontmatter,
  type CheatSheetEntry,
  type InterviewEntry,
  type SearchEntry,
} from './contentIndex';

/**
 * Vite plugin: builds small data modules from src/content at build time.
 *
 *   import entries from 'virtual:devguru-search';       // every topic, for search
 *   import sheets from 'virtual:devguru-cheatsheets';   // every cheat sheet table
 *   import { counts, loaders } from 'virtual:devguru-interview';
 *     // question count per track, and loaders['python']() which lazily imports
 *     // 'virtual:devguru-interview/python' (that track's questions and answers)
 *
 * The app never downloads the raw MDX for these pages. Adding a topic or a
 * track needs no change here: everything is read from the folders.
 */

interface TrackJson {
  name: string;
  icon: string;
  order: number;
  modules: { title: string; topics: { id: string; slug: string; title: string }[] }[];
}

const SEARCH_ID = 'virtual:devguru-search';
const CHEATS_ID = 'virtual:devguru-cheatsheets';
const INTERVIEW_ID = 'virtual:devguru-interview';

function readTracks(contentRoot: string) {
  return readdirSync(contentRoot, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && existsSync(join(contentRoot, entry.name, 'index.json')),
    )
    .map((entry) => ({
      slug: entry.name,
      index: JSON.parse(
        readFileSync(join(contentRoot, entry.name, 'index.json'), 'utf8'),
      ) as TrackJson,
    }))
    .sort((a, b) => a.index.order - b.index.order || a.index.name.localeCompare(b.index.name));
}

export function buildContentData(contentRoot: string): {
  search: SearchEntry[];
  cheatsheets: CheatSheetEntry[];
  interview: Record<string, InterviewEntry[]>;
} {
  const search: SearchEntry[] = [];
  const cheatsheets: CheatSheetEntry[] = [];
  const interview: Record<string, InterviewEntry[]> = {};

  for (const { slug: track, index } of readTracks(contentRoot)) {
    for (const module of index.modules) {
      for (const topic of module.topics) {
        const file = join(contentRoot, track, `${topic.slug}.mdx`);
        const text = existsSync(file) ? readFileSync(file, 'utf8') : null;
        const base = {
          track,
          trackName: index.name,
          trackIcon: index.icon,
          module: module.title,
          slug: topic.slug,
          title: topic.title,
        };

        search.push({
          ...base,
          id: topic.id,
          summary: text ? (parseFrontmatter(text).summary ?? '') : '',
          written: text !== null,
          headings: text ? extractHeadings(text) : [],
          terms: text ? extractTerms(text) : [],
          questions: text ? extractQuestions(text) : [],
          words: text ? extractWords(text) : [],
        });

        const sheet = text ? extractCheatSheet(text) : null;
        if (sheet) cheatsheets.push({ ...base, sheet });

        const items = text ? extractInterviewQA(text) : [];
        if (items.length > 0) {
          (interview[track] ??= []).push({
            track,
            module: module.title,
            slug: topic.slug,
            title: topic.title,
            items,
          });
        }
      }
    }
  }
  return { search, cheatsheets, interview };
}

/** The interview index module: counts per track and one lazy loader per track. */
function interviewIndexSource(interview: Record<string, InterviewEntry[]>): string {
  const counts = Object.fromEntries(
    Object.entries(interview).map(([track, entries]) => [
      track,
      entries.reduce((sum, entry) => sum + entry.items.length, 0),
    ]),
  );
  const loaders = Object.keys(interview)
    .map(
      (track) =>
        `  ${JSON.stringify(track)}: () => import(${JSON.stringify(`${INTERVIEW_ID}/${track}`)}),`,
    )
    .join('\n');
  return `export const counts = ${JSON.stringify(counts)};\nexport const loaders = {\n${loaders}\n};\n`;
}

export default function contentPlugin(contentRoot: string): Plugin {
  const resolved = new Set([`\0${SEARCH_ID}`, `\0${CHEATS_ID}`, `\0${INTERVIEW_ID}`]);
  const isInterviewTrack = (id: string) => id.startsWith(`\0${INTERVIEW_ID}/`);

  return {
    name: 'devguru-content-index',
    resolveId(id) {
      if (id === SEARCH_ID || id === CHEATS_ID || id === INTERVIEW_ID) return `\0${id}`;
      if (id.startsWith(`${INTERVIEW_ID}/`)) {
        const id0 = `\0${id}`;
        resolved.add(id0); // so handleHotUpdate reloads it too
        return id0;
      }
      return undefined;
    },
    load(id) {
      if (!resolved.has(id) && !isInterviewTrack(id)) return undefined;
      // No this.addWatchFile(contentRoot) here: Vite treats watch files as imports
      // in dev, and a Windows path (D:\...\src\content) cannot be resolved, which
      // broke Search and Cheat sheets on Windows. handleHotUpdate below does the job.
      const data = buildContentData(contentRoot);
      if (id === `\0${INTERVIEW_ID}`) return interviewIndexSource(data.interview);
      if (isInterviewTrack(id)) {
        const track = id.slice(`\0${INTERVIEW_ID}/`.length);
        return `export default ${JSON.stringify(data.interview[track] ?? [])};`;
      }
      const value = id === `\0${SEARCH_ID}` ? data.search : data.cheatsheets;
      return `export default ${JSON.stringify(value)};`;
    },
    // Dev server: an MDX or index.json file in src/content changed → rebuild both
    // data modules and reload Search / Cheat sheets / Interview questions.
    handleHotUpdate({ file, server, modules }) {
      if (!file.replace(/\\/g, '/').includes('/src/content/')) return;
      const affected = [...resolved]
        .map((id) => server.moduleGraph.getModuleById(id))
        .filter((mod): mod is NonNullable<typeof mod> => Boolean(mod));
      for (const mod of affected) server.moduleGraph.invalidateModule(mod);
      return [...modules, ...affected];
    },
  };
}
