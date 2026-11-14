import { NavLink } from 'react-router-dom';
import { TRACKS } from '../../registry/tracks';

interface SidebarProps {
  /** Called when a link is tapped (the mobile drawer uses it to close itself). */
  onNavigate?: () => void;
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-200'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
  }`;

const headingClass =
  'px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400';

const EXTRA_LINKS = [
  { heading: 'Playgrounds', to: '/playground/python', icon: '▶️', label: 'Python playground' },
  { heading: 'Playgrounds', to: '/playground/sql', icon: '▶️', label: 'SQL playground' },
  { heading: 'More', to: '/cheatsheets', icon: '📋', label: 'Cheat sheets' },
  { heading: 'More', to: '/progress', icon: '📈', label: 'My progress' },
] as const;

const EXTRA_HEADINGS = ['Playgrounds', 'More'] as const;

/** The list of links. Shown as a fixed column on desktop and inside the drawer on mobile. */
export default function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <nav aria-label="Tracks and tools" className="p-3">
      <h2 className={headingClass}>Tracks</h2>
      <ul>
        {TRACKS.map((track) => (
          <li key={track.slug}>
            <NavLink to={`/track/${track.slug}`} className={linkClass} onClick={onNavigate}>
              <span aria-hidden="true" className="w-6 text-center text-lg">
                {track.icon}
              </span>
              {track.name}
            </NavLink>
          </li>
        ))}
      </ul>

      {EXTRA_HEADINGS.map((heading) => (
        <div key={heading}>
          <h2 className={headingClass}>{heading}</h2>
          <ul>
            {EXTRA_LINKS.filter((link) => link.heading === heading).map((link) => (
              <li key={link.to}>
                <NavLink to={link.to} className={linkClass} onClick={onNavigate}>
                  <span aria-hidden="true" className="w-6 text-center text-lg">
                    {link.icon}
                  </span>
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
