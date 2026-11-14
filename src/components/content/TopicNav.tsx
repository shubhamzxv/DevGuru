import { Link } from 'react-router-dom';
import type { TopicRef } from '../../registry/tracks';

interface TopicNavProps {
  trackSlug: string;
  prev: TopicRef | undefined;
  next: TopicRef | undefined;
  complete: boolean;
  onToggleComplete: () => void;
}

const navLink =
  'flex min-h-14 flex-1 flex-col justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500';

/** Template block 11: "Mark as complete" + Previous / Next. */
export default function TopicNav({
  trackSlug,
  prev,
  next,
  complete,
  onToggleComplete,
}: TopicNavProps) {
  return (
    <footer className="mt-10 border-t border-slate-200 pt-6 dark:border-slate-800">
      <button
        type="button"
        onClick={onToggleComplete}
        aria-pressed={complete}
        className={`tap w-full rounded-xl px-5 py-3 font-semibold sm:w-auto ${
          complete
            ? 'bg-emerald-700 text-white hover:bg-emerald-800'
            : 'bg-brand-600 text-white hover:bg-brand-700'
        }`}
      >
        {complete ? '✓ Completed (tap to undo)' : 'Mark as complete'}
      </button>

      <nav aria-label="Previous and next topic" className="mt-4 flex flex-col gap-3 sm:flex-row">
        {prev ? (
          <Link to={`/track/${trackSlug}/${prev.slug}`} className={navLink}>
            <span className="text-xs text-slate-500 dark:text-slate-400">← Previous</span>
            <span className="font-medium">{prev.title}</span>
          </Link>
        ) : (
          <span className="hidden flex-1 sm:block" />
        )}
        {next ? (
          <Link to={`/track/${trackSlug}/${next.slug}`} className={`${navLink} sm:text-right`}>
            <span className="text-xs text-slate-500 dark:text-slate-400">Next →</span>
            <span className="font-medium">{next.title}</span>
          </Link>
        ) : (
          <Link to={`/track/${trackSlug}`} className={`${navLink} sm:text-right`}>
            <span className="text-xs text-slate-500 dark:text-slate-400">Finished</span>
            <span className="font-medium">Back to all topics</span>
          </Link>
        )}
      </nav>
    </footer>
  );
}
