import { describe, expect, it } from 'vitest';
import entries from 'virtual:devguru-search';
import sheets from 'virtual:devguru-cheatsheets';
import type { SearchEntry } from '../src/build/contentIndex';
import { queryWords, search, withinOneEdit, wordMatch } from '../src/utils/search';

function entry(partial: Partial<SearchEntry>): SearchEntry {
  return {
    track: 'python',
    trackName: 'Python',
    trackIcon: '🐍',
    module: 'Basics',
    slug: 'x',
    id: 'python-x',
    title: 'X',
    summary: '',
    written: true,
    headings: [],
    terms: [],
    questions: [],
    words: [],
    ...partial,
  };
}

describe('search helpers', () => {
  it('allows one typo in longer words', () => {
    expect(withinOneEdit('decorater', 'decorator')).toBe(true);
    expect(withinOneEdit('tupel', 'tuple')).toBe(true); // swapped letters
    expect(withinOneEdit('index', 'indexes')).toBe(false);
    expect(wordMatch('index', 'indexes')).toBeGreaterThan(0); // word start
    expect(wordMatch('sql', 'nosql')).toBeGreaterThan(0); // inside a word
    expect(wordMatch('cat', 'car')).toBe(0); // short words stay exact
  });

  it('drops filler words from the query', () => {
    expect(queryWords('What is the difference between list vs tuple?')).toEqual([
      'difference',
      'between',
      'list',
      'tuple',
    ]);
  });
});

describe('search ranking (small sample)', () => {
  const sample = [
    entry({ slug: 'lists', title: 'Lists', words: ['tuple'] }),
    entry({ slug: 'list-vs-tuple', title: 'List vs tuple' }),
    entry({ slug: 'decorators', title: 'Decorators', terms: ['decorator'] }),
    entry({
      slug: 'joins',
      title: 'Joins',
      track: 'sql',
      questions: ['What is the difference between INNER and LEFT JOIN?'],
    }),
    entry({ slug: 'later', title: 'Decorators in depth', written: false }),
  ];

  it('returns nothing for an empty query', () => {
    expect(search(sample, '   ')).toEqual([]);
  });

  it('puts the exact title first', () => {
    expect(search(sample, 'list vs tuple')[0]?.entry.slug).toBe('list-vs-tuple');
  });

  it('finds through a typo', () => {
    expect(search(sample, 'decorater')[0]?.entry.slug).toBe('decorators');
  });

  it('ranks written topics above planned ones', () => {
    const slugs = search(sample, 'decorators').map((r) => r.entry.slug);
    expect(slugs.indexOf('decorators')).toBeLessThan(slugs.indexOf('later'));
  });

  it('shows the interview question that matched', () => {
    const [first] = search(sample, 'inner left join difference');
    expect(first?.entry.slug).toBe('joins');
    expect(first?.matchedQuestion).toContain('INNER and LEFT JOIN');
  });
});

describe('search over the real content', () => {
  const top = (query: string) => search(entries, query)[0]?.entry;

  it('indexes every syllabus topic', () => {
    expect(entries.length).toBeGreaterThanOrEqual(365);
    expect(entries.filter((e) => e.written).length).toBeGreaterThanOrEqual(122);
  });

  it.each([
    ['list vs tuple', 'python', 'list-vs-tuple'],
    ['window functions', 'sql', 'window-functions'],
    ['shallow copy', 'python', 'shallow-vs-deep-copy'],
    ['explain analyze', 'sql', 'explain-vs-explain-analyze'],
    ['second highest salary', 'sql', 'nth-highest-salary'],
  ])('"%s" finds %s/%s first', (query, track, slug) => {
    expect(top(query)).toMatchObject({ track, slug });
  });

  it('has a cheat sheet for every written topic', () => {
    const written = entries.filter((e) => e.written).map((e) => `${e.track}/${e.slug}`);
    const withSheet = new Set(sheets.map((s) => `${s.track}/${s.slug}`));
    expect(written.filter((key) => !withSheet.has(key))).toEqual([]);
    expect(sheets.every((s) => s.sheet.rows.length > 0)).toBe(true);
  });
});
