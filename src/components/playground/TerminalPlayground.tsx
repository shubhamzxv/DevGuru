import { useState } from 'react';
import { ShellSimulator } from '../../simulators/shell';
import { starterCommands } from '../../simulators/types';
import FakeTerminal from '../terminal/FakeTerminal';

/**
 * Linux and Docker playground: a pretend Ubuntu machine with a home folder to
 * explore and Docker installed. When Docker has images or containers, a small
 * panel shows them, so learners SEE what each docker command changed.
 */
export default function TerminalPlayground({ initialCode }: { initialCode: string }) {
  const [round, setRound] = useState(0);
  const [shell, setShell] = useState(() => new ShellSimulator());
  const [, redraw] = useState(0);
  const starters = starterCommands(initialCode);
  const { images, containers } = shell.docker;
  const showDocker = images.size > 0 || containers.length > 0;

  return (
    <div className="space-y-3">
      <FakeTerminal
        key={round}
        simulator={shell}
        starters={starters}
        onChange={() => redraw((n) => n + 1)}
        label="Terminal"
      />

      {showDocker && (
        <section aria-label="Docker on this machine" className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold">Images (templates)</h3>
            <ul className="mt-1 space-y-1 text-sm">
              {[...images.values()].map((image) => (
                <li key={`${image.repo}:${image.tag}`} className="font-mono">
                  📦 {image.repo}:{image.tag}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold">Containers (running copies)</h3>
            {containers.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">None yet.</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {containers.map((container) => (
                  <li key={container.id} className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        container.status === 'running'
                          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {container.status === 'running' ? 'Up' : 'Exited'}
                    </span>
                    <span className="font-mono">{container.name}</span>
                    <span className="text-slate-500">
                      {container.image}
                      {container.status === 'running' &&
                        container.ports.length > 0 &&
                        ` · ${container.ports.map(([h, c]) => `${h}→${c}`).join(', ')}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => {
          setShell(new ShellSimulator());
          setRound((n) => n + 1);
        }}
        className="tap rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
      >
        Reset machine
      </button>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        A simulated Ubuntu machine: files and containers live only in this page. Type{' '}
        <code>help</code> or <code>docker help</code>.
      </p>
    </div>
  );
}
