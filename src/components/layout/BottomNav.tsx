import { NavLink, useLocation } from 'react-router-dom';
import { HomeIcon, ProgressIcon, SearchIcon, TracksIcon } from './icons';

interface BottomNavProps {
  /** "Tracks" opens the drawer, which lists every track. */
  onTracksClick: () => void;
}

const base = 'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium';
const active = 'text-brand-700 dark:text-brand-300';
const idle = 'text-slate-600 dark:text-slate-400';

const linkClass = ({ isActive }: { isActive: boolean }) => `${base} ${isActive ? active : idle}`;

/** Bottom bar for phones and tablets. Hidden on desktop (lg and up). */
export default function BottomNav({ onTracksClick }: BottomNavProps) {
  const { pathname } = useLocation();
  const onTrackPage = pathname.startsWith('/track/');

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed inset-x-0 bottom-0 z-40 print:hidden border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden dark:border-slate-800 dark:bg-slate-950"
    >
      <ul className="grid grid-cols-4">
        <li>
          <NavLink to="/" end className={linkClass}>
            <HomeIcon />
            Home
          </NavLink>
        </li>
        <li>
          <button
            type="button"
            onClick={onTracksClick}
            aria-haspopup="dialog"
            className={`${base} w-full ${onTrackPage ? active : idle}`}
          >
            <TracksIcon />
            Tracks
          </button>
        </li>
        <li>
          <NavLink to="/search" className={linkClass}>
            <SearchIcon />
            Search
          </NavLink>
        </li>
        <li>
          <NavLink to="/progress" className={linkClass}>
            <ProgressIcon />
            Progress
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}
