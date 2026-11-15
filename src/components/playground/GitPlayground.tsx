import { useState } from 'react';
import { GitSimulator } from '../../simulators/git';
import { starterCommands } from '../../simulators/types';
import FakeTerminal from '../terminal/FakeTerminal';
import GitGraph from '../visualizers/GitGraph';

/** Git track playground: a terminal that understands git, and the live commit graph above it. */
export default function GitPlayground({ initialCode }: { initialCode: string }) {
  const [round, setRound] = useState(0); // bump = start again with a fresh repository
  const [git, setGit] = useState(() => new GitSimulator());
  const [, redraw] = useState(0);
  const starters = starterCommands(initialCode);

  return (
    <div className="space-y-3">
      <GitGraph commits={git.graph()} />
      <FakeTerminal
        key={round}
        simulator={git}
        starters={starters}
        onChange={() => redraw((n) => n + 1)}
        label="Git terminal"
      />
      <button
        type="button"
        onClick={() => {
          setGit(new GitSimulator());
          setRound((n) => n + 1);
        }}
        className="tap rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
      >
        Reset repository
      </button>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        This is a simulator: nothing runs on your computer. It covers the everyday commands; type{' '}
        <code>git help</code> for the list.
      </p>
    </div>
  );
}
