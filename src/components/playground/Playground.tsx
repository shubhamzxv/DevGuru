import type { ReactNode } from 'react';
import type { PlaygroundKind } from '../../registry/tracks';
import { extractCode } from '../../utils/extractCode';
import CodeBlock from '../content/CodeBlock';
import { H2 } from '../content/Prose';
import PythonPlayground from './PythonPlayground';
import SqlPlayground from './SqlPlayground';

interface PlaygroundProps {
  kind: PlaygroundKind;
  /** A fenced code block: the starting code. */
  children: ReactNode;
}

/**
 * Template block 6: "Try it yourself".
 * python -> editor that runs Python in the browser (Pyodide)
 * sql    -> editor that runs SQL in the browser on the sample database (sql.js)
 * others -> starting code only, until their simulator is built (Step 7)
 */
export default function Playground({ kind, children }: PlaygroundProps) {
  const starter = extractCode(children);

  let body: ReactNode;
  if (kind === 'python' && starter) {
    body = <PythonPlayground initialCode={starter.code} />;
  } else if (kind === 'sql' && starter) {
    body = <SqlPlayground initialCode={starter.code} />;
  } else {
    body = (
      <>
        {starter ? (
          <CodeBlock code={starter.code} language={starter.language} label="Playground" />
        ) : (
          children
        )}
        <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          ▶ The interactive version of this playground arrives in Step 7 (simulators). Until then,
          copy the code and try it on your computer.
        </p>
      </>
    );
  }

  return (
    <section>
      <H2>Try it yourself</H2>
      {body}
    </section>
  );
}
