/**
 * Reads topic MDX text at BUILD time and pulls out what the search page and the
 * cheat sheets page need. Pure functions only (no file access), so they are easy
 * to test. The Vite plugin in ./contentPlugin.ts calls them for every topic.
 */

/** One row of the search index. Every syllabus topic has one, written or not. */
export interface SearchEntry {
  track: string;
  trackName: string;
  trackIcon: string;
  module: string;
  slug: string;
  id: string;
  title: string;
  summary: string;
  /** false = in the syllabus, MDX not written yet. */
  written: boolean;
  /** "## " headings of the topic. */
  headings: string[];
  /** **Bold** key terms (the content rules bold every keyword once). */
  terms: string[];
  /** Interview questions from <QA q="..."> */
  questions: string[];
  /** The most frequent other words, for "it's mentioned in here" matches. */
  words: string[];
}

export interface CheatSheetTable {
  headers: string[];
  rows: string[][];
  /** Short lines written under the table, such as a rule to remember. */
  notes: string[];
}

export interface CheatSheetEntry {
  track: string;
  trackName: string;
  trackIcon: string;
  module: string;
  slug: string;
  title: string;
  sheet: CheatSheetTable;
}

/** A piece of an interview answer: a paragraph (with `code` / **bold**) or a code block. */
export type AnswerBlock =
  { kind: 'text'; text: string } | { kind: 'code'; language: string; code: string };

export interface InterviewItem {
  q: string;
  answer: AnswerBlock[];
}

/** All interview questions of one topic. */
export interface InterviewEntry {
  track: string;
  module: string;
  slug: string;
  title: string;
  items: InterviewItem[];
}

/** Same simple "key: value" reader as scripts/lib.mjs. */
export function parseFrontmatter(text: string): Record<string, string> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out: Record<string, string> = {};
  if (!match?.[1]) return out;
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    out[line.slice(0, colon).trim()] = line
      .slice(colon + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return out;
}

/** The MDX text without the frontmatter and without fenced code blocks. */
export function proseOnly(text: string): string {
  return text
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, '')
    .replace(/^```[^\n]*\n[\s\S]*?^```[ \t]*$/gm, '');
}

export function extractHeadings(text: string): string[] {
  return [...proseOnly(text).matchAll(/^##\s+(.+?)\s*$/gm)].map((m) => clean(m[1] ?? ''));
}

export function extractTerms(text: string): string[] {
  const terms = [...proseOnly(text).matchAll(/\*\*([^*\n]{2,60})\*\*/g)].map((m) =>
    clean(m[1] ?? ''),
  );
  return unique(terms.filter(Boolean));
}

export function extractQuestions(text: string): string[] {
  return [...text.matchAll(/<QA\s+q=(["'])([\s\S]*?)\1\s*>/g)].map((m) => clean(m[2] ?? ''));
}

const STOPWORDS = new Set(
  (
    'a an and are as at be but by can do does for from has have how if in into is it its ' +
    'not of on or so than that the then there these this to too was we what when where ' +
    'which who why will with you your our they them their one two use used using also ' +
    'only same more most other each every any all just like get gets got make makes made ' +
    'here think try see run runs show shows need needs want wants way ways real example ' +
    'examples simple explanation code output mistake mistakes right wrong quiz cheat sheet ' +
    'answer interview question questions sheet should would could very much many first'
  ).split(' '),
);

/** Lower-case words: letters, digits and _ (so ROW_NUMBER stays one word). */
export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9_]+/g) ?? [];
}

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word);
}

/** The `limit` most frequent meaningful words of the prose. */
export function extractWords(text: string, limit = 60): string[] {
  const prose = proseOnly(text)
    .replace(/<\/?[A-Z][A-Za-z]*[^>]*>/g, ' ') // JSX tags
    .replace(/\{[\s\S]*?\}/g, ' '); // JSX expressions (quiz data)
  const counts = new Map<string, number>();
  for (const word of tokenize(prose)) {
    if (word.length < 3 || isStopword(word) || /^\d+$/.test(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

/** Splits a markdown table row on pipes that are not escaped as \| */
export function splitRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return inner.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim());
}

/** Reads the first table inside <CheatSheet> ... </CheatSheet>. */
export function extractCheatSheet(text: string): CheatSheetTable | null {
  const block = /<CheatSheet>([\s\S]*?)<\/CheatSheet>/.exec(text)?.[1];
  if (!block) return null;

  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const tableLines = lines.filter((line) => line.startsWith('|'));
  const notes = lines.filter((line) => !line.startsWith('|')).map(clean);
  if (tableLines.length < 2) return null;

  const [headerLine, , ...bodyLines] = tableLines;
  const headers = splitRow(headerLine ?? '');
  const rows = bodyLines
    .filter((line) => !/^\|[\s:|-]+\|$/.test(line)) // skip any extra separator line
    .map((line) => {
      const cells = splitRow(line);
      // Keep every row the same width as the header.
      return headers.map((_, index) => cells[index] ?? '');
    });
  return { headers, rows, notes };
}

/** Every <QA q="..."> answer </QA> of a topic, with the answer split into blocks. */
export function extractInterviewQA(text: string): InterviewItem[] {
  return [...text.matchAll(/<QA\s+q=(["'])([\s\S]*?)\1\s*>([\s\S]*?)<\/QA>/g)].map((m) => ({
    q: clean(m[2] ?? ''),
    answer: splitAnswer(m[3] ?? ''),
  }));
}

/** Splits answer markdown into paragraphs and fenced code blocks. */
export function splitAnswer(body: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  const fence = /^```([\w-]*)[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
  const addText = (chunk: string) => {
    for (const paragraph of chunk.split(/\n\s*\n/)) {
      const text = clean(paragraph).replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // links -> their text
      if (text) blocks.push({ kind: 'text', text });
    }
  };
  let last = 0;
  for (const match of body.matchAll(fence)) {
    addText(body.slice(last, match.index));
    blocks.push({
      kind: 'code',
      language: match[1] || 'text',
      code: (match[2] ?? '').replace(/\n$/, ''),
    });
    last = (match.index ?? 0) + match[0].length;
  }
  addText(body.slice(last));
  return blocks;
}

function clean(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function unique(list: string[]): string[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
