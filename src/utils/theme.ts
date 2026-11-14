export type Theme = 'light' | 'dark';

/** Keep in sync with public/theme-init.js */
export const THEME_STORAGE_KEY = 'devguru-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Decide which theme to show.
 * 1. If the user picked one before, use it.
 * 2. Otherwise follow the phone/computer setting.
 */
export function resolveTheme(stored: string | null, systemPrefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return systemPrefersDark ? 'dark' : 'light';
}

function readStored(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return null; // private mode / storage blocked
  }
}

export function getTheme(): Theme {
  return resolveTheme(readStored(), window.matchMedia(DARK_QUERY).matches);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#020617' : '#ffffff');
}

const listeners = new Set<() => void>();

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage blocked: the theme still changes for this visit.
  }
  applyTheme(theme);
  listeners.forEach((listener) => listener());
}

/** Used by useTheme (useSyncExternalStore). */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  const onExternalChange = () => {
    applyTheme(getTheme());
    listener();
  };
  media.addEventListener('change', onExternalChange);
  window.addEventListener('storage', onExternalChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', onExternalChange);
    window.removeEventListener('storage', onExternalChange);
  };
}
