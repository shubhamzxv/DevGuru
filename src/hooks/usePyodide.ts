import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanTraceback } from '../utils/pythonError';
import { parseTrace, type TraceResult } from '../utils/trace';

export type WorkerMessage =
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'started' }
  | { type: 'done' }
  | { type: 'trace'; result: string }
  | { type: 'error'; message: string }
  | { type: 'loadError'; message: string };

export interface OutputLine {
  kind: 'out' | 'err' | 'info';
  text: string;
}

/** idle: nothing running. loading: downloading Python or packages. running: code is executing. */
export type PythonStatus = 'idle' | 'loading' | 'running';

const TIMEOUT_MS = 10_000;
const MAX_LINES = 1000;

/**
 * Runs Python code in a Web Worker.
 * The worker (and the ~8 MB Pyodide download) starts only on the first run.
 * run(code)       -> normal run, printed lines arrive in `output`
 * runSteps(code)  -> step-by-step run, the recording arrives in `trace`
 */
export function usePyodide() {
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const lineCountRef = useRef(0);
  const [status, setStatus] = useState<PythonStatus>('idle');
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [trace, setTrace] = useState<TraceResult | null>(null);

  const append = useCallback((line: OutputLine) => {
    setOutput((lines) => [...lines, line]);
  }, []);

  /** Kills the worker. This is the only way to stop an infinite loop. */
  const stop = useCallback(
    (note?: string) => {
      window.clearTimeout(timerRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
      setStatus('idle');
      if (note) append({ kind: 'info', text: note });
    },
    [append],
  );

  const start = useCallback(
    (mode: 'run' | 'trace', code: string) => {
      window.clearTimeout(timerRef.current);
      lineCountRef.current = 0;
      setOutput([]);
      setTrace(null);
      setStatus('loading');

      let worker = workerRef.current;
      if (!worker) {
        worker = new Worker(new URL('../workers/pyodide.worker.ts', import.meta.url), {
          type: 'module',
        });
        workerRef.current = worker;

        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          const message = event.data;
          switch (message.type) {
            case 'stdout':
            case 'stderr':
              lineCountRef.current += 1;
              if (lineCountRef.current > MAX_LINES) {
                stop(`Stopped: more than ${MAX_LINES} lines of output.`);
              } else {
                append({ kind: message.type === 'stdout' ? 'out' : 'err', text: message.text });
              }
              break;
            case 'started':
              setStatus('running');
              timerRef.current = window.setTimeout(() => {
                stop(`Stopped: the code ran for more than ${TIMEOUT_MS / 1000} seconds.`);
              }, TIMEOUT_MS);
              break;
            case 'trace': {
              const parsed = parseTrace(message.result);
              if (parsed) setTrace(parsed);
              else append({ kind: 'err', text: 'Could not read the step-by-step result.' });
              break;
            }
            case 'done':
              window.clearTimeout(timerRef.current);
              setStatus('idle');
              break;
            case 'error':
              window.clearTimeout(timerRef.current);
              append({ kind: 'err', text: cleanTraceback(message.message) });
              setStatus('idle');
              break;
            case 'loadError':
              stop('Could not load Python. Check your internet connection and try again.');
              break;
          }
        };
        worker.onerror = () => {
          stop('Could not load Python. Check your internet connection and try again.');
        };
      }

      worker.postMessage({ type: mode, code });
    },
    [append, stop],
  );

  const run = useCallback((code: string) => start('run', code), [start]);
  const runSteps = useCallback((code: string) => start('trace', code), [start]);
  const clearTrace = useCallback(() => setTrace(null), []);

  // Leaving the page: free the worker.
  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      workerRef.current?.terminate();
    },
    [],
  );

  return { status, output, trace, run, runSteps, clearTrace, stop };
}
