import type { ReactNode } from 'react';
import type { PlaygroundKind } from '../../registry/tracks';
import { extractCode } from '../../utils/extractCode';
import CodeBlock from '../content/CodeBlock';
import { H2 } from '../content/Prose';
import PythonPlayground from './PythonPlayground';

interface PlaygroundProps {
  kind: PlaygroundKind;
  /** A fenced code block: the starting code. */
  children: ReactNode;
}

/**
 * Template block 6: "Try it yourself".
 * python -> real editor that runs in the browser (Pyodide).
 * others -> starting code only, until their playground is built (SQL: Step 5, simulators: Step 7).
 */
export default function Playground({ kind, children }: PlaygroundProps) {
  const starter = extractCode(children);

  return (
    <section>
      <H2>Try it yourself</H2>
      {kind === 'python' && starter ? (
        <PythonPlayground initialCode={starter.code} />
      ) : (
        <>
          {starter ? (
            <CodeBlock code={starter.code} language={starter.language} label="Playground" />
          ) : (
            children
          )}
          <p className="rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            ▶ The Run button for this playground arrives in{' '}
            {kind === 'sql' ? 'Step 5 (sql.js)' : 'Step 7 (simulators)'}. Until then, copy the code
            and try it on your computer.
          </p>
        </>
      )}
    </section>
  );
}
