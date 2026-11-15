import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { CommandResult, Simulator } from '../../simulators/types';

interface Entry {
  id: number;
  prompt: string;
  command: string;
  result: CommandResult;
}

interface FakeTerminalProps {
  simulator: Simulator;
  /** Commands from the lesson, shown as tap-to-run buttons. */
  starters: string[];
  /** Called after every command, so pictures (like the Git graph) can redraw. */
  onChange?: () => void;
  label: string;
}

const button =
  'tap rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800';

/**
 * A terminal look-alike: type a command (or tap one of the lesson's commands),
 * see the output, and a plain-language note on what the command did.
 */
export default function FakeTerminal({ simulator, starters, onChange, label }: FakeTerminalProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [used, setUsed] = useState<Set<number>>(new Set());
  const [explain, setExplain] = useState(true);
  const [prompt, setPrompt] = useState(() => simulator.prompt());
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries]);

  const execute = (commands: string[]) => {
    const added: Entry[] = [];
    let cleared = false;
    for (const command of commands) {
      const before = simulator.prompt();
      const result = simulator.run(command);
      if (result.clear) {
        cleared = true;
        added.length = 0;
        continue;
      }
      added.push({ id: nextId.current++, prompt: before, command, result });
    }
    setEntries((current) => (cleared ? added : [...current, ...added]));
    setHistory((h) => [...h, ...commands]);
    setHistoryIndex(null);
    setPrompt(simulator.prompt());
    onChange?.();
  };

  const runStarter = (index: number) => {
    const command = starters[index];
    if (command === undefined) return;
    execute([command]);
    setUsed((u) => new Set(u).add(index));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    if (history.length === 0) return;
    event.preventDefault();
    const index =
      event.key === 'ArrowUp'
        ? Math.max(0, (historyIndex ?? history.length) - 1)
        : Math.min(history.length, (historyIndex ?? history.length) + 1);
    setHistoryIndex(index);
    setInput(history[index] ?? '');
  };

  return (
    <div className="space-y-3">
      {starters.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Tap a command to run it, or type your own:</p>
            <button
              type="button"
              className={button}
              onClick={() => {
                const rest = starters.map((_, i) => i).filter((i) => !used.has(i));
                execute(rest.map((i) => starters[i] ?? ''));
                setUsed(new Set(starters.map((_, i) => i)));
              }}
              disabled={used.size === starters.length}
            >
              Run all
            </button>
          </div>
          <ol className="mt-2 flex flex-wrap gap-2">
            {starters.map((command, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => runStarter(index)}
                  className={`tap max-w-full rounded-lg border px-3 text-left font-mono text-sm ${
                    used.has(index)
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : 'border-slate-300 bg-white hover:border-brand-400 dark:border-slate-600 dark:bg-slate-900'
                  }`}
                >
                  <span aria-hidden="true">{used.has(index) ? '✓ ' : '▶ '}</span>
                  {command}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-100 shadow-inner">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-3 py-1.5 text-xs text-slate-400">
          <span>{label}</span>
          <label className="flex min-h-8 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={explain}
              onChange={(e) => setExplain(e.target.checked)}
            />
            Explain each command
          </label>
        </div>
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label={`${label} output`}
          className="max-h-96 min-h-32 overflow-y-auto px-3 py-2 font-mono text-sm"
          onClick={() => inputRef.current?.focus()}
        >
          {entries.length === 0 && (
            <p className="text-slate-500">Type help to see what this terminal understands.</p>
          )}
          {entries.map((entry) => (
            <div key={entry.id} className="mb-2">
              <div className="break-all">
                <span className="text-emerald-400">{entry.prompt}</span> {entry.command}
              </div>
              {entry.result.output && (
                <pre
                  className={`overflow-x-auto whitespace-pre ${entry.result.error ? 'text-red-300' : 'text-slate-200'}`}
                >
                  {entry.result.output}
                </pre>
              )}
              {explain && entry.result.explanation && (
                <p className="mt-1 rounded-md bg-sky-950/60 px-2 py-1 font-sans text-sm text-sky-200">
                  <span aria-hidden="true">💡 </span>
                  {entry.result.explanation}
                </p>
              )}
            </div>
          ))}
        </div>
        <form
          className="flex items-center gap-2 border-t border-slate-800 px-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim() === '') return;
            execute([input]);
            setInput('');
          }}
        >
          <label htmlFor={`${label}-input`} className="sr-only">
            Command
          </label>
          <span
            aria-hidden="true"
            className="hidden shrink-0 font-mono text-sm text-emerald-400 sm:inline"
          >
            {prompt}
          </span>
          <span aria-hidden="true" className="font-mono text-sm text-emerald-400 sm:hidden">
            $
          </span>
          <input
            ref={inputRef}
            id={`${label}-input`}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            placeholder="type a command"
            className="min-h-12 w-full min-w-0 bg-transparent font-mono text-sm text-slate-100 outline-none placeholder:text-slate-600"
          />
          <button
            type="submit"
            className="tap shrink-0 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Run
          </button>
        </form>
      </div>
    </div>
  );
}
