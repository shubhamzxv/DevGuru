import { useRef, useState } from 'react';
import { useLazyEditor } from '../../hooks/useLazyEditor';
import { usePyodide } from '../../hooks/usePyodide';
import StepVisualizer from '../visualizers/StepVisualizer';

interface PythonPlaygroundProps {
  /** The example code. Reset brings it back. */
  initialCode: string;
}

const button = 'tap rounded-lg px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Editor on top, output below (stacked on every screen size).
 * Run downloads Python the first time (~8 MB), then runs the code in a Web Worker.
 * "Step through" runs the code once and lets the learner replay it line by line.
 */
export default function PythonPlayground({ initialCode }: PythonPlaygroundProps) {
  const box = useRef<HTMLDivElement>(null);
  const { Editor, load: loadEditor } = useLazyEditor(box);
  const [code, setCode] = useState(initialCode);
  const [tracedCode, setTracedCode] = useState('');
  const { status, output, trace, run, runSteps, clearTrace, stop } = usePyodide();
  const busy = status !== 'idle';
  const rows = Math.min(24, Math.max(6, code.split('\n').length + 1));

  const startSteps = () => {
    setTracedCode(code);
    runSteps(code);
  };

  return (
    <div
      ref={box}
      className="my-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
    >
      <div className="bg-slate-100 px-3 py-2 dark:bg-slate-800">
        <p className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Python editor
        </p>
        {/* Same height before and after the editor loads, so nothing below jumps. */}
        <div style={{ minHeight: `calc(${rows} * 1.625 * 14px + 26px)` }}>
          {Editor ? (
            <Editor
              value={code}
              onChange={setCode}
              onRun={() => run(code)}
              label="Python code editor"
            />
          ) : (
            <textarea
              onFocus={loadEditor}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  run(code);
                }
              }}
              aria-label="Python code editor"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              rows={rows}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="block w-full resize-y rounded-lg border border-slate-300 bg-white p-3 font-mono text-[14px] leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          )}
        </div>
        <p className="pt-1 text-xs text-slate-600 dark:text-slate-400">
          Ctrl+Enter runs the code. In the editor, press Esc, then Tab, to leave it with the
          keyboard.
        </p>
      </div>

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
          onClick={startSteps}
          disabled={busy}
          className={`${button} bg-brand-600 text-white hover:bg-brand-700`}
        >
          👣 Step through
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
          onClick={() => {
            setCode(initialCode);
            clearTrace();
          }}
          disabled={code === initialCode && !trace}
          className={`${button} border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800`}
        >
          ↺ Reset
        </button>
        <p role="status" className="flex items-center text-sm text-slate-600 dark:text-slate-300">
          {status === 'loading' && 'Loading Python (one-time ~8 MB)…'}
          {status === 'running' && 'Running…'}
        </p>
      </div>

      {trace ? (
        <StepVisualizer key={tracedCode} code={tracedCode} trace={trace} onClose={clearTrace} />
      ) : (
        <div className="bg-slate-900 px-4 pb-4 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Output</p>
          <pre
            aria-live="polite"
            tabIndex={0}
            className="mt-2 max-h-80 min-h-12 overflow-auto whitespace-pre-wrap leading-relaxed text-slate-100"
          >
            {output.length === 0 && !busy && (
              <span className="text-slate-400">
                Press Run to see the result, or Step through to watch each line.
              </span>
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
      )}
    </div>
  );
}
