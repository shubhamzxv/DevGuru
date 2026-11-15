import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { login, type LoginResult } from '../../utils/cloudSync';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

const button = 'tap rounded-lg px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50';

/**
 * "Save progress online": type a phone number or a username. No password and no
 * OTP (there is no backend), so the dialog says plainly that the name is the key.
 */
export default function LoginDialog({ open, onClose }: LoginDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<LoginResult | null>(null);
  const ids = { title: useId(), help: useId(), error: useId() };

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setError(null);
      setDone(null);
      element.showModal();
      input.current?.focus();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await login(value);
    setBusy(false);
    if (result.ok) {
      setDone(result);
      setValue('');
    } else {
      setError(result.error ?? 'Could not log in.');
      input.current?.focus();
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={ids.title}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose(); // tap outside the box
      }}
      className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-5">
        <h2 id={ids.title} className="text-xl font-bold">
          {done ? 'You are logged in' : 'Save your progress online'}
        </h2>

        {done ? (
          <div className="mt-3 space-y-3 text-slate-700 dark:text-slate-300">
            <p role="status">
              {done.created
                ? 'A new profile was created. Your progress on this device is now saved online.'
                : `Welcome back! Your progress was loaded (${done.completed} topics done).`}
            </p>
            {done.merged && <p>Progress you made on this device as a guest was added to it.</p>}
            <p>Log in with the same name on any phone or computer to continue there.</p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className={`${button} bg-brand-600 text-white hover:bg-brand-700`}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-3 space-y-4">
            <p id={ids.help} className="text-sm text-slate-700 dark:text-slate-300">
              Use your <strong>phone number</strong> or any <strong>username</strong>. Log in with
              the same one on another device to continue where you stopped.
            </p>
            <div>
              <label htmlFor={`${ids.title}-input`} className="block text-sm font-semibold">
                Phone number or username
              </label>
              <input
                ref={input}
                id={`${ids.title}-input`}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null); // the old message no longer applies
                }}
                autoComplete="username"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder="98765 43210 or asha_k"
                aria-describedby={`${ids.help}${error ? ` ${ids.error}` : ''}`}
                aria-invalid={error ? true : undefined}
                className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base dark:border-slate-600 dark:bg-slate-950"
              />
              {error && (
                <p
                  id={ids.error}
                  role="alert"
                  className="mt-2 text-sm text-red-700 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </div>
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              There is no password: anyone who types the same phone number or username can see and
              change this progress. Only learning progress is saved — never type a password here.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`${button} border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className={`${button} bg-brand-600 text-white hover:bg-brand-700`}
              >
                {busy ? 'Checking…' : 'Continue'}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
