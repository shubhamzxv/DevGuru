import { isStopword, tokenize, type SearchEntry } from '../build/contentIndex';

/**
 * Small ranked search over the build-time index. No library needed:
 * - every query word is matched against title, key terms, headings,
 *   interview questions, summary and common words (in that order of weight)
 * - exact word > word start > inside a word > one typo ("decorater" finds "decorator")
 * - topics that match more of the query words rank higher
 */

export type MatchField = 'title' | 'term' | 'heading' | 'question' | 'summary' | 'word' | 'track';

export interface SearchResult {
  entry: SearchEntry;
  score: number;
  /** The interview question that matched, shown under the result. */
  matchedQuestion?: string;
}

interface PreparedField {
  field: MatchField;
  weight: number;
  words: string[];
}

interface Prepared {
  entry: SearchEntry;
  fields: PreparedField[];
  titleText: string;
  questions: { text: string; words: Set<string> }[];
}

const WEIGHTS: Record<MatchField, number> = {
  title: 10,
  term: 6,
  heading: 5,
  question: 4,
  summary: 3,
  track: 2,
  word: 2,
};

const cache = new WeakMap<readonly SearchEntry[], Prepared[]>();

function field(name: MatchField, words: string[]): PreparedField {
  return { field: name, weight: WEIGHTS[name], words: [...new Set(words)] };
}

function prepare(entries: readonly SearchEntry[]): Prepared[] {
  const hit = cache.get(entries);
  if (hit) return hit;
  const prepared = entries.map((entry): Prepared => ({
    entry,
    titleText: entry.title.toLowerCase(),
    questions: entry.questions.map((text) => ({ text, words: new Set(tokenize(text)) })),
    fields: [
      field('title', tokenize(entry.title)),
      field('term', entry.terms.flatMap(tokenize)),
      field('heading', entry.headings.flatMap(tokenize)),
      field('question', entry.questions.flatMap(tokenize)),
      field('summary', tokenize(entry.summary)),
      field('track', tokenize(`${entry.trackName} ${entry.module}`)),
      field('word', entry.words),
    ],
  }));
  cache.set(entries, prepared);
  return prepared;
}

/** True when a and b differ by at most one letter (added, removed, changed or swapped). */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (a.length === b.length) {
    // one changed letter, or two neighbours swapped
    return (
      a.slice(i + 1) === b.slice(i + 1) ||
      (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
    );
  }
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** How well one query word matches one indexed word: 1 = exact, 0 = no match. */
export function wordMatch(query: string, word: string): number {
  if (word === query) return 1;
  if (word.startsWith(query)) return query.length >= 2 ? 0.75 : 0.4;
  if (query.length >= 3 && word.includes(query)) return 0.5;
  // Plural/singular and typos, only for longer words so short ones stay precise.
  if (query.length >= 4 && word.length >= 4) {
    if (withinOneEdit(query, word)) return 0.6;
    if (word.length > query.length && withinOneEdit(query, word.slice(0, query.length))) return 0.4;
  }
  return 0;
}

function bestIn(query: string, words: string[]): number {
  let best = 0;
  for (const word of words) {
    const score = wordMatch(query, word);
    if (score > best) best = score;
    if (best === 1) break;
  }
  return best;
}

/** The words of the query that carry meaning ("list vs tuple" -> list, tuple). */
export function queryWords(query: string): string[] {
  const all = tokenize(query);
  const words = all.filter((word) => !isStopword(word) && word !== 'vs' && word !== 'versus');
  return words.length > 0 ? words : all;
}

export function search(entries: readonly SearchEntry[], query: string, limit = 30): SearchResult[] {
  const words = queryWords(query);
  if (words.length === 0) return [];
  const phrase = query.trim().toLowerCase();

  const results: SearchResult[] = [];
  for (const item of prepare(entries)) {
    let score = 0;
    let matched = 0;
    for (const word of words) {
      let best = 0;
      for (const field of item.fields) {
        const value = bestIn(word, field.words) * field.weight;
        if (value > best) best = value;
      }
      if (best > 0) matched++;
      score += best;
    }
    if (matched === 0) continue;

    const coverage = matched / words.length;
    if (words.length > 1 && coverage < 0.5) continue;
    score *= coverage * coverage;

    // Whole phrase bonuses
    if (phrase.length >= 3 && item.titleText.includes(phrase)) score += 15;
    if (item.titleText === phrase) score += 10;

    // Best matching interview question: the one sharing the most query words.
    let matchedQuestion: string | undefined;
    let questionHits = 0;
    for (const question of item.questions) {
      const hits = words.filter((word) => question.words.has(word)).length;
      if (hits > questionHits) {
        questionHits = hits;
        matchedQuestion = question.text;
      }
    }
    if (questionHits < Math.min(2, words.length)) matchedQuestion = undefined;

    if (!item.entry.written) score *= 0.5;
    results.push({ entry: item.entry, score, matchedQuestion });
  }

  return results
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
    .slice(0, limit);
}
