import type { AppData, QuizScore } from './storage';

const percent = (s: QuizScore) => (s.total > 0 ? s.score / s.total : 0);

/**
 * Combines two copies of progress (for example guest progress on this device and
 * the progress saved online). Nothing is lost: completed topics and bookmarks are
 * joined, the better quiz score is kept, and `preferred`'s "last visited" wins.
 */
export function mergeProgress(other: AppData, preferred: AppData): AppData {
  const join = (a: string[], b: string[]) => [...a, ...b.filter((item) => !a.includes(item))];
  const quizScores = { ...other.quizScores };
  for (const [key, score] of Object.entries(preferred.quizScores)) {
    const old = quizScores[key];
    if (!old || percent(score) >= percent(old)) quizScores[key] = score;
  }
  return {
    version: preferred.version,
    completed: join(other.completed, preferred.completed),
    quizScores,
    bookmarks: join(other.bookmarks, preferred.bookmarks),
    lastVisited: preferred.lastVisited ?? other.lastVisited,
  };
}

export function isEmptyProgress(data: AppData): boolean {
  return (
    data.completed.length === 0 &&
    data.bookmarks.length === 0 &&
    Object.keys(data.quizScores).length === 0 &&
    data.lastVisited === null
  );
}

export function sameProgress(a: AppData, b: AppData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
