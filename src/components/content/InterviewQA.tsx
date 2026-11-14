import type { ReactNode } from 'react';
import { H2 } from './Prose';

/** Template block 8: wraps 3 to 5 <QA> items. */
export function InterviewQA({ children }: { children: ReactNode }) {
  return (
    <section>
      <H2>Interview questions</H2>
      <div className="space-y-3">{children}</div>
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
          className="shrink-0 text-slate-500 transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <div className="border-t border-slate-200 px-4 py-1 dark:border-slate-700">{children}</div>
    </details>
  );
}
