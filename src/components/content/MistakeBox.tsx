import type { ReactNode } from 'react';
import { H2 } from './Prose';

/** Template block 7: wraps 2 to 4 <Mistake> items. */
export function Mistakes({ children }: { children: ReactNode }) {
  return (
    <section className="defer-render">
      <H2>Common mistakes</H2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Mistake({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}

export function Wrong({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 border-l-4 border-red-500 pl-3">
      <p className="text-sm font-bold text-red-700 dark:text-red-400">❌ Wrong</p>
      {children}
    </div>
  );
}

export function Right({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 border-l-4 border-emerald-500 pl-3">
      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">✅ Right</p>
      {children}
    </div>
  );
}
