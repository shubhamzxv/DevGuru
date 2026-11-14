import { useTheme } from '../../hooks/useTheme';
import { MoonIcon, SunIcon } from './icons';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className="tap rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
