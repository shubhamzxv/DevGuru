import type { ReactNode } from 'react';

/** Template block 10: the one-glance summary. */
export default function CheatSheet({ children }: { children: ReactNode }) {
  return (
    <section className="defer-render my-8 rounded-xl border-2 border-brand-300 bg-brand-50 p-4 dark:border-brand-700 dark:bg-brand-950/40">
      <h2 className="flex items-center gap-2 text-lg font-bold text-brand-900 dark:text-brand-100">
        <span aria-hidden="true">📋</span> Cheat sheet
      </h2>
      {children}
    </section>
  );
}
