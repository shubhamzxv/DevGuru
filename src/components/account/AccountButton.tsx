import { useEffect, useId, useRef, useState } from 'react';
import { useAccount } from '../../hooks/useAccount';
import { logout, syncNow } from '../../utils/cloudSync';
import { CloudIcon, UserIcon } from '../layout/icons';
import LoginDialog from './LoginDialog';
import { syncText } from './syncText';

const item =
  'tap w-full justify-start rounded-lg px-3 text-left text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800';

/** Header button: "Log in" for guests, an account menu when logged in. */
export default function AccountButton() {
  const account = useAccount();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Close the menu on Esc or a tap outside it.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    const onPointer = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [menuOpen]);

  // One wrapper for both states, with the dialog always last: after a successful
  // login the dialog stays mounted, so its "You are logged in" step can show.
  const guest = account.status === 'guest';
  const problem = account.status === 'offline' || account.status === 'error';
  const doLogout = async (force: boolean) => {
    const done = await logout(force);
    setUnsaved(!done);
    if (done) setMenuOpen(false);
  };

  return (
    <div ref={box} className="relative">
      {guest ? (
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="tap gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <UserIcon />
          <span className="hidden sm:inline">Log in</span>
          <span className="sr-only sm:hidden">Log in to save progress online</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setMenuOpen(!menuOpen);
            setUnsaved(false);
          }}
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={`Account: ${account.label}. ${syncText(account)}`}
          className="tap relative gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <CloudIcon />
          <span className="hidden max-w-[9rem] truncate sm:inline">{account.label}</span>
          {problem && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-2 h-2.5 w-2.5 rounded-full bg-amber-500"
            />
          )}
        </button>
      )}
      {!guest && menuOpen && (
        <div
          id={menuId}
          className="absolute right-0 top-full z-40 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          <p className="px-3 pt-1 text-sm font-semibold">{account.label}</p>
          <p role="status" className="px-3 pb-2 text-sm text-slate-600 dark:text-slate-400">
            {syncText(account)}
          </p>
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={account.status === 'syncing'}
            className={item}
          >
            Sync now
          </button>
          {unsaved ? (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p>Some changes are not saved online yet. If you log out now they are lost.</p>
              <button
                type="button"
                onClick={() => void doLogout(true)}
                className={`${item} mt-1 text-red-700 dark:text-red-400`}
              >
                Log out anyway
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => void doLogout(false)} className={item}>
              Log out
            </button>
          )}
          <p className="px-3 pt-1 text-xs text-slate-600 dark:text-slate-400">
            Logging out keeps your progress online and clears it from this device.
          </p>
        </div>
      )}
      <LoginDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
