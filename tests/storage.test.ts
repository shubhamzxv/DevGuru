import { describe, expect, it } from 'vitest';
import { DATA_VERSION, EMPTY_DATA, migrate } from '../src/utils/storage';

describe('migrate (saved learner data)', () => {
  it('returns empty data for anything that is not an object', () => {
    expect(migrate(null)).toEqual(EMPTY_DATA);
    expect(migrate('hello')).toEqual(EMPTY_DATA);
    expect(migrate([1, 2])).toEqual(EMPTY_DATA);
  });

  it('keeps valid data', () => {
    const saved = {
      version: 1,
      completed: ['python/python-variables'],
      quizScores: { 'python/python-variables': { score: 2, total: 3 } },
      bookmarks: ['sql/sql-joins'],
      lastVisited: { path: '/track/python/variables', title: 'Python: Variables' },
    };
    expect(migrate(saved)).toEqual(saved);
  });

  it('drops broken parts instead of crashing', () => {
    const result = migrate({
      completed: ['ok', 42, null],
      quizScores: { good: { score: 1, total: 3 }, bad: 'oops' },
      lastVisited: { path: 5 },
    });
    expect(result.version).toBe(DATA_VERSION);
    expect(result.completed).toEqual(['ok']);
    expect(result.quizScores).toEqual({ good: { score: 1, total: 3 } });
    expect(result.bookmarks).toEqual([]);
    expect(result.lastVisited).toBeNull();
  });
});
