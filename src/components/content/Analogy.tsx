import type { ReactNode } from 'react';

/** Template block 2: the real-life example. */
export default function Analogy({ children }: { children: ReactNode }) {
  return (
    <aside className="my-6 rounded-xl border border-accent-300 bg-accent-50 p-4 dark:border-accent-700 dark:bg-accent-950/40">
      <h2 className="flex items-center gap-2 text-base font-bold text-accent-900 dark:text-accent-200">
        <span aria-hidden="true">💡</span> Real-life example
      </h2>
      <div className="[&>p]:text-slate-800 dark:[&>p]:text-slate-200">{children}</div>
    </aside>
  );
}
