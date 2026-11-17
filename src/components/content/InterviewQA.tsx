import { useContext, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getTrack } from '../../registry/tracks';
import { H2 } from './Prose';
import { TopicContext } from './topicContext';

/** Template block 8: wraps 3 to 5 <QA> items. */
export function InterviewQA({ children }: { children: ReactNode }) {
  // The topic key is "<track>/<topic id>"; it is null outside a topic page.
  const track = getTrack(useContext(TopicContext)?.split('/')[0] ?? '');
  return (
    <section className="defer-render">
      <H2>Interview questions</H2>
      <div className="space-y-3">{children}</div>
      {track && (
        <p className="mt-3 text-sm">
          <Link
            to={`/interview?track=${track.slug}`}
            className="font-semibold text-brand-700 underline underline-offset-2 dark:text-brand-300"
          >
            All {track.name} interview questions →
          </Link>
        </p>
      )}
    </section>
  );
}

/** One question. The answer stays folded until the learner taps it. */
export function QA({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
        <span>{q}</span>
        <span
          aria-hidden="true"
          className="shrink-0 text-slate-600 dark:text-slate-400 transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-slate-200 px-4 py-1 dark:border-slate-700">{children}</div>
    </details>
  );
}
