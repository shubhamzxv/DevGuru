import { Link, NavLink } from 'react-router-dom';
import AccountButton from '../account/AccountButton';
import { CLOUD_SYNC_ENABLED } from '../../config/cloud';
import ThemeToggle from './ThemeToggle';
import { LogoMark, MenuIcon, SearchIcon } from './icons';

interface HeaderProps {
  onMenuClick: () => void;
  drawerOpen: boolean;
}

const desktopLink = ({ isActive }: { isActive: boolean }) =>
  `tap rounded-lg px-3 text-sm font-medium ${
    isActive
      ? 'text-brand-700 dark:text-brand-300'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

export default function Header({ onMenuClick, drawerOpen }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 print:hidden border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-1 px-2 lg:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          aria-expanded={drawerOpen}
          aria-controls="mobile-drawer"
          className="tap rounded-lg text-slate-700 hover:bg-slate-100 lg:hidden dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <MenuIcon />
        </button>

        <Link to="/" className="tap gap-2 rounded-lg px-1 text-lg font-bold tracking-tight">
          <LogoMark />
          <span>
            Dev<span className="text-brand-600 dark:text-brand-400">Guru</span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 lg:flex">
          <NavLink to="/progress" className={desktopLink}>
            Progress
          </NavLink>
          <NavLink to="/cheatsheets" className={desktopLink}>
            Cheat sheets
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center lg:ml-2">
          <Link
            to="/search"
            aria-label="Search topics (Ctrl+K)"
            className="tap gap-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:border lg:border-slate-300 lg:px-3 dark:text-slate-300 dark:hover:bg-slate-800 lg:dark:border-slate-700"
          >
            <SearchIcon />
            <span aria-hidden="true" className="hidden text-sm lg:inline">
              Search
            </span>
            <kbd
              aria-hidden="true"
              className="hidden rounded border border-slate-300 px-1.5 text-xs text-slate-500 lg:inline dark:border-slate-600 dark:text-slate-400"
            >
              Ctrl K
            </kbd>
          </Link>
          <ThemeToggle />
          {CLOUD_SYNC_ENABLED && <AccountButton />}
        </div>
      </div>
    </header>
  );
}
