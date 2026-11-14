/**
 * Runs Python in the browser with Pyodide (Python compiled to WebAssembly).
 * It lives in a Web Worker so the page never freezes, and so the Stop button
 * can kill an infinite loop by terminating the worker.
 *
 * Messages in:  { type: 'run', code }    run the code normally
 *               { type: 'trace', code }  run it step by step and record each line
 * Messages out: see WorkerMessage in src/hooks/usePyodide.ts
 */
import tracerSource from './tracer.py?raw';

// Pinned version. To self-host later, copy the files to /public/pyodide and change this URL.
const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

interface PyodideApi {
  runPythonAsync(code: string): Promise<unknown>;
  loadPackagesFromImports(code: string): Promise<unknown>;
  setStdout(options: { batched: (text: string) => void }): void;
  setStderr(options: { batched: (text: string) => void }): void;
  globals: { set(name: string, value: unknown): void };
}

interface PyodideModule {
  loadPyodide(options: { indexURL: string }): Promise<PyodideApi>;
}

interface WorkerScope {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent<{ type: 'run' | 'trace'; code: string }>) => void) | null;
}

const scope = self as unknown as WorkerScope;

// input() needs a blocking prompt, which a worker cannot show. Fail with a clear message.
const PRELUDE = `
import builtins
def _devguru_input(prompt=""):
    raise RuntimeError("input() is not supported in this playground. Put the value in a variable instead, for example: name = 'Asha'")
builtins.input = _devguru_input
`;

const ready: Promise<PyodideApi> = (async () => {
  const module = (await import(/* @vite-ignore */ `${PYODIDE_URL}pyodide.mjs`)) as PyodideModule;
  const pyodide = await module.loadPyodide({ indexURL: PYODIDE_URL });
  pyodide.setStdout({ batched: (text) => scope.postMessage({ type: 'stdout', text }) });
  pyodide.setStderr({ batched: (text) => scope.postMessage({ type: 'stderr', text }) });
  await pyodide.runPythonAsync(PRELUDE);
  await pyodide.runPythonAsync(tracerSource); // defines _devguru_trace()
  return pyodide;
})();

ready.catch((error: unknown) => {
  scope.postMessage({ type: 'loadError', message: String(error) });
});

scope.onmessage = async (event) => {
  const { type, code } = event.data;
  let pyodide: PyodideApi;
  try {
    pyodide = await ready;
  } catch {
    return; // loadError was already sent
  }
  try {
    // Downloads numpy, pandas, ... only when the code imports them.
    await pyodide.loadPackagesFromImports(code);
    scope.postMessage({ type: 'started' });
    if (type === 'trace') {
      pyodide.globals.set('_devguru_source', code);
      const result = await pyodide.runPythonAsync('_devguru_trace(_devguru_source)');
      scope.postMessage({ type: 'trace', result: String(result) });
    } else {
      await pyodide.runPythonAsync(code);
    }
    scope.postMessage({ type: 'done' });
  } catch (error) {
    scope.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
