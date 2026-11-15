import { useState } from 'react';
import { CLOUD_SYNC_ENABLED } from '../../config/cloud';
import { useAccount } from '../../hooks/useAccount';
import { syncNow } from '../../utils/cloudSync';
import LoginDialog from './LoginDialog';
import { syncText } from './syncText';

const button = 'tap rounded-lg px-4 font-medium disabled:cursor-not-allowed disabled:opacity-50';

/** On the progress page: where the progress is saved, with Log in / Sync now. */
export default function AccountCard() {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  if (!CLOUD_SYNC_ENABLED) return null;
  const guest = account.status === 'guest';

  return (
    <section
      aria-label="Where your progress is saved"
      className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-950/40"
    >
      <div className="mr-auto min-w-0">
        <p className="font-semibold">{guest ? 'Guest mode' : `Logged in as ${account.label}`}</p>
        <p role="status" className="text-sm text-slate-700 dark:text-slate-300">
          {guest
            ? 'Progress is saved in this browser only. Log in with a phone number or username to keep it on every device.'
            : syncText(account)}
        </p>
      </div>
      {guest ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`${button} bg-brand-600 text-white hover:bg-brand-700`}
        >
          Log in
        </button>
      ) : (
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={account.status === 'syncing'}
          className={`${button} border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800`}
        >
          Sync now
        </button>
      )}
      <LoginDialog open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
