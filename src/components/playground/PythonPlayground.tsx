import { useState } from 'react';
import { usePyodide } from '../../hooks/usePyodide';

interface PythonPlaygroundProps {
  /** The example code. Reset brings it back. */
  initialCode: string;
}

const button = 'tap rounded-lg px-5 font-semibold disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Editor on top, output below (stacked on every screen size).
 * Run downloads Python the first time (~8 MB), then runs the code in a Web Worker.
 */
export default function PythonPlayground({ initialCode }: PythonPlaygroundProps) {
  const [code, setCode] = useState(initialCode);
  const { status, output, run, stop } = usePyodide();
  const busy = status !== 'idle';
  const rows = Math.min(24, Math.max(6, code.split('\n').length + 1));

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <label className="block bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        Python editor
        <textarea
          value={code}
          onChange={(event) => setCode(event.target.value)}
          rows={rows}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="mt-2 block w-full resize-y rounded-lg border border-slate-300 bg-white p-3 font-mono text-[14px] font-normal normal-case leading-relaxed tracking-normal text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        />
      </label>

      <div className="flex flex-wrap gap-2 border-y border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => run(code)}
          disabled={busy}
          className={`${button} bg-emerald-700 text-white hover:bg-emerald-800`}
        >
          ▶ Run
        </button>
        <button
          type="button"
          onClick={() => stop('Stopped.')}
          disabled={!busy}
          className={`${button} bg-red-700 text-white hover:bg-red-800`}
        >
          ■ Stop
        </button>
        <button
          type="button"
          onClick={() => setCode(initialCode)}
          disabled={code === initialCode}
          className={`${button} border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800`}
        >
          ↺ Reset
        </button>
        <p role="status" className="flex items-center text-sm text-slate-600 dark:text-slate-300">
          {status === 'loading' && 'Loading Python (one-time ~8 MB)…'}
          {status === 'running' && 'Running…'}
        </p>
      </div>

      <div className="bg-slate-900 px-4 pb-4 pt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Output</p>
        <pre
          aria-live="polite"
          tabIndex={0}
          className="mt-2 max-h-80 min-h-12 overflow-auto whitespace-pre-wrap leading-relaxed text-slate-100"
        >
          {output.length === 0 && !busy && (
            <span className="text-slate-400">Press Run to see the result here.</span>
          )}
          {output.map((line, index) => (
            <span
              key={index}
              className={
                line.kind === 'err'
                  ? 'text-red-300'
                  : line.kind === 'info'
                    ? 'text-amber-300'
                    : undefined
              }
            >
              {line.text}
              {'\n'}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
