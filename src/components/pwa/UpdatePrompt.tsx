import { useEffect, useSyncExternalStore } from 'react';
import { applyUpdate, dismissPwaMessage, getPwaStatus, subscribePwa } from '../../utils/pwa';

/** Small message above the bottom bar: "works offline" or "new content available". */
export default function UpdatePrompt() {
  const status = useSyncExternalStore(subscribePwa, getPwaStatus, () => 'idle' as const);

  // The offline message is information only: hide it after a few seconds.
  useEffect(() => {
    if (status !== 'offline-ready') return;
    const timer = window.setTimeout(dismissPwaMessage, 6000);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (status === 'idle') return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg print:hidden lg:bottom-6 dark:border-slate-700 dark:bg-slate-900"
    >
      <p className="min-w-0 flex-1 text-sm font-medium">
        {status === 'update-ready'
          ? 'New content is available.'
          : 'DevGuru is saved on this device and now works offline.'}
      </p>
      {status === 'update-ready' && (
        <button
          type="button"
          onClick={applyUpdate}
          className="tap rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Refresh
        </button>
      )}
      <button
        type="button"
        onClick={dismissPwaMessage}
        className="tap rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        {status === 'update-ready' ? 'Later' : 'OK'}
      </button>
    </div>
  );
}
