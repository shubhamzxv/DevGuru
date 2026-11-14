import { useCallback, useEffect, useRef, useState } from 'react';
import { cleanTraceback } from '../utils/pythonError';

export type WorkerMessage =
  | { type: 'stdout'; text: string }
  | { type: 'stderr'; text: string }
  | { type: 'started' }
  | { type: 'done' }
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
 * The worker (and the ~8 MB Pyodide download) starts only on the first run().
 */
export function usePyodide() {
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const lineCountRef = useRef(0);
  const [status, setStatus] = useState<PythonStatus>('idle');
  const [output, setOutput] = useState<OutputLine[]>([]);

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

  const run = useCallback(
    (code: string) => {
      window.clearTimeout(timerRef.current);
      lineCountRef.current = 0;
      setOutput([]);
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
              stop('Could not load Python. Check your internet connection and press Run again.');
              break;
          }
        };
        worker.onerror = () => {
          stop('Could not load Python. Check your internet connection and press Run again.');
        };
      }

      worker.postMessage({ type: 'run', code });
    },
    [append, stop],
  );

  // Leaving the page: free the worker.
  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current);
      workerRef.current?.terminate();
    },
    [],
  );

  return { status, output, run, stop };
}
