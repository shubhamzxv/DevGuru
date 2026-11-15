import { lazy, Suspense, type ReactNode } from 'react';
import type { PlaygroundKind } from '../../registry/tracks';
import { parseDiagram } from '../../simulators/diagram';
import { extractCode } from '../../utils/extractCode';
import CodeBlock from '../content/CodeBlock';
import { H2 } from '../content/Prose';

// Every playground is its own chunk: a Python page never downloads the SQL or Git engine.
const PythonPlayground = lazy(() => import('./PythonPlayground'));
const SqlPlayground = lazy(() => import('./SqlPlayground'));
const GitPlayground = lazy(() => import('./GitPlayground'));
const TerminalPlayground = lazy(() => import('./TerminalPlayground'));
const HttpPlayground = lazy(() => import('./HttpPlayground'));
const ArchitectureDiagram = lazy(() => import('../visualizers/ArchitectureDiagram'));

interface PlaygroundProps {
  kind: PlaygroundKind;
  /** A fenced code block: the starting code, commands, request or diagram JSON. */
  children: ReactNode;
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {children}
    </p>
  );
}

/**
 * Template block 6: "Try it yourself". What the code block means depends on kind:
 * python   -> Python code, run in the browser (Pyodide)
 * sql      -> SQL, run on the sample database (sql.js)
 * git      -> one command per line; a Git simulator with a live commit graph
 * terminal -> one command per line; a simulated Linux machine with Docker
 * http     -> "METHOD /path", header lines, blank line, JSON body; a pretend REST API
 * diagram  -> JSON nodes / edges / flows; a clickable architecture diagram
 * none     -> the code is shown with a Copy button (Django and FastAPI run on a real server)
 */
export default function Playground({ kind, children }: PlaygroundProps) {
  const starter = extractCode(children);
  const code = starter?.code ?? '';

  let body: ReactNode;
  if (kind === 'python' && starter) {
    body = <PythonPlayground initialCode={code} />;
  } else if (kind === 'sql' && starter) {
    body = <SqlPlayground initialCode={code} />;
  } else if (kind === 'git') {
    body = <GitPlayground initialCode={code} />;
  } else if (kind === 'terminal') {
    body = <TerminalPlayground initialCode={code} />;
  } else if (kind === 'http') {
    body = <HttpPlayground initialCode={code} />;
  } else if (kind === 'diagram' && starter) {
    const diagram = parseDiagram(code);
    body =
      typeof diagram === 'string' ? (
        <Note>⚠ {diagram}</Note>
      ) : (
        <ArchitectureDiagram diagram={diagram} />
      );
  } else {
    body = (
      <>
        {starter ? <CodeBlock code={code} language={starter.language} label="Try it" /> : children}
        <Note>
          ▶ This code needs a real server, so it does not run in the browser. Copy it and run it on
          your computer; the expected output is shown in the lesson above.
        </Note>
      </>
    );
  }

  return (
    <section>
      <H2>Try it yourself</H2>
      <Suspense
        fallback={
          <p className="py-6 text-center text-sm text-slate-600 dark:text-slate-400">
            Loading the simulator…
          </p>
        }
      >
        {body}
      </Suspense>
    </section>
  );
}
