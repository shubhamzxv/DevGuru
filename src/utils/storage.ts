/**
 * Everything the app remembers about the learner lives in ONE localStorage
 * entry with a version number. When the shape changes in future, bump
 * DATA_VERSION and upgrade old data inside migrate() instead of losing it.
 */
export const DATA_STORAGE_KEY = 'devguru-data';
export const DATA_VERSION = 1;

export interface QuizScore {
  score: number;
  total: number;
}

export interface LastVisited {
  path: string;
  title: string;
}

export interface AppData {
  version: number;
  /** Topic keys: "<track>/<topic id>" */
  completed: string[];
  quizScores: Record<string, QuizScore>;
  bookmarks: string[];
  lastVisited: LastVisited | null;
}

export const EMPTY_DATA: AppData = {
  version: DATA_VERSION,
  completed: [],
  quizScores: {},
  bookmarks: [],
  lastVisited: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** Accepts anything read from storage and returns safe, current-version data. */
export function migrate(raw: unknown): AppData {
  if (!isRecord(raw)) return EMPTY_DATA;

  // Future upgrades go here, for example:
  // if (raw.version === 1) raw = upgradeV1ToV2(raw);

  const quizScores: Record<string, QuizScore> = {};
  if (isRecord(raw.quizScores)) {
    for (const [key, value] of Object.entries(raw.quizScores)) {
      if (isRecord(value) && typeof value.score === 'number' && typeof value.total === 'number') {
        quizScores[key] = { score: value.score, total: value.total };
      }
    }
  }

  const last = raw.lastVisited;
  const lastVisited =
    isRecord(last) && typeof last.path === 'string' && typeof last.title === 'string'
      ? { path: last.path, title: last.title }
      : null;

  return {
    version: DATA_VERSION,
    completed: stringList(raw.completed),
    quizScores,
    bookmarks: stringList(raw.bookmarks),
    lastVisited,
  };
}

let cache: AppData | null = null;
const listeners = new Set<() => void>();

function read(): AppData {
  try {
    const text = localStorage.getItem(DATA_STORAGE_KEY);
    return text ? migrate(JSON.parse(text)) : EMPTY_DATA;
  } catch {
    return EMPTY_DATA; // storage blocked or broken JSON
  }
}

export function getData(): AppData {
  cache ??= read();
  return cache;
}

export function updateData(change: (data: AppData) => AppData): void {
  cache = change(getData());
  try {
    localStorage.setItem(DATA_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked: keep the change for this visit only.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeData(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed the data: re-read it.
  const onStorage = (event: StorageEvent) => {
    if (event.key === DATA_STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

// ---- actions ----

export function toggleComplete(topicKey: string): void {
  updateData((data) => ({
    ...data,
    completed: data.completed.includes(topicKey)
      ? data.completed.filter((key) => key !== topicKey)
      : [...data.completed, topicKey],
  }));
}

export function saveQuizScore(topicKey: string, score: QuizScore): void {
  updateData((data) => ({ ...data, quizScores: { ...data.quizScores, [topicKey]: score } }));
}

export function setLastVisited(lastVisited: LastVisited): void {
  if (getData().lastVisited?.path === lastVisited.path) return;
  updateData((data) => ({ ...data, lastVisited }));
}
