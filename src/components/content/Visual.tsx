import type { ReactNode } from 'react';

/** Template block 4: a diagram or small animation with a caption. */
export default function Visual({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="my-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <div className="overflow-x-auto [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:max-w-full">
        {children}
      </div>
      <figcaption className="mt-3 text-center text-sm text-slate-600 dark:text-slate-400">
        {caption}
      </figcaption>
    </figure>
  );
}
