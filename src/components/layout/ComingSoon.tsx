import type { ReactNode } from 'react';

interface ComingSoonProps {
  title: string;
  /** Which build step will fill this page in. */
  step: string;
  children?: ReactNode;
}

/** Temporary page body used until the real feature is built. */
export default function ComingSoon({ title, step, children }: ComingSoonProps) {
  return (
    <section className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-semibold text-accent-700 dark:text-accent-400">
          Coming in {step}
        </p>
        <div className="mt-2 text-slate-600 dark:text-slate-300">{children}</div>
      </div>
    </section>
  );
}
