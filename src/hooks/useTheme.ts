import { useCallback, useSyncExternalStore } from 'react';
import { getTheme, setTheme, subscribeTheme, type Theme } from '../utils/theme';

/**
 * Read and change the theme from any component.
 * No provider needed: the theme lives in a tiny store in utils/theme.ts.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const theme = useSyncExternalStore<Theme>(subscribeTheme, getTheme, () => 'light');
  const toggleTheme = useCallback(() => {
    setTheme(getTheme() === 'dark' ? 'light' : 'dark');
  }, []);
  return { theme, toggleTheme };
}
