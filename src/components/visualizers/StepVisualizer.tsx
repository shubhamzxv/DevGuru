import { useEffect, useState } from 'react';
import type { TraceResult } from '../../utils/trace';

interface StepVisualizerProps {
  /** The code that was traced. */
  code: string;
  trace: TraceResult;
  onClose: () => void;
}

const button =
  'tap rounded-lg border border-slate-300 px-3 font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800';

/**
 * Shows a recorded run one line at a time: the next line to run is highlighted,
 * with the variables and the printed output up to that moment.
 * The last position (after the final line) shows the finished state.
 */
export default function StepVisualizer({ code, trace, onClose }: StepVisualizerProps) {
  const last = trace.steps.length; // index of the "finished" position
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const finished = index >= last;
  const isPlaying = playing && !finished;

  // Play: move one step forward every 0.8 seconds until the end.
  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setTimeout(() => setIndex((current) => current + 1), 800);
    return () => window.clearTimeout(timer);
  }, [isPlaying, index]);

  const step = finished ? undefined : trace.steps[index];
  const currentLine = step ? step.line : (trace.error?.line ?? null);
  const variables = step ? step.vars : trace.final;
  const printed = step ? step.out : trace.output;
  const scope = step ? step.scope : 'main program';
  const names = Object.keys(variables);
  const lines = code.split('\n');

  let status = `Step ${index + 1} of ${last}: line ${currentLine ?? '?'} runs next`;
  if (finished) {
    if (trace.error) status = `Stopped with an error: ${trace.error.message}`;
    else if (trace.truncated) status = `Stopped after ${last} steps (the code is too long to show)`;
    else status = 'Finished';
  }

  return (
    <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={index === 0}
          onClick={() => {
            setPlaying(false);
            setIndex(0);
          }}
        >
          ⏮ Start
        </button>
        <button
          type="button"
          className={button}
          disabled={index === 0}
          onClick={() => {
            setPlaying(false);
            setIndex((current) => Math.max(0, current - 1));
          }}
        >
          ◀ Back
        </button>
        <button
          type="button"
          className={button}
          disabled={finished}
          onClick={() => {
            setPlaying(false);
            setIndex((current) => Math.min(last, current + 1));
          }}
        >
          Next ▶
        </button>
        <button
          type="button"
          className={button}
          disabled={finished}
          aria-pressed={isPlaying}
          onClick={() => setPlaying(!isPlaying)}
        >
          {isPlaying ? '⏸ Pause' : '⏵ Play'}
        </button>
        <button type="button" className={`${button} ml-auto`} onClick={onClose}>
          ✕ Close steps
        </button>
      </div>

      <p
        role="status"
        className={`mt-3 text-sm font-semibold ${
          finished && trace.error
            ? 'text-red-700 dark:text-red-400'
            : 'text-slate-700 dark:text-slate-200'
        }`}
      >
        {status}
      </p>

      <ol
        aria-label="Code, with the current line highlighted"
        className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-50 py-2 font-mono text-[14px] leading-relaxed dark:border-slate-700 dark:bg-slate-950"
      >
        {lines.map((text, lineIndex) => {
          const isCurrent = lineIndex + 1 === currentLine;
          const highlight =
            finished && trace.error
              ? 'bg-red-100 dark:bg-red-950'
              : 'bg-amber-100 dark:bg-amber-900/50';
          return (
            <li
              key={lineIndex}
              aria-current={isCurrent ? 'step' : undefined}
              className={`flex whitespace-pre px-2 ${isCurrent ? highlight : ''}`}
            >
              <span className="w-8 shrink-0 select-none pr-2 text-right text-slate-600 dark:text-slate-400">
                {lineIndex + 1}
              </span>
              <span aria-hidden="true" className="w-4 shrink-0 text-amber-600">
                {isCurrent ? '➤' : ''}
              </span>
              <span>{text || ' '}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">
            Variables{' '}
            <span className="font-normal text-slate-600 dark:text-slate-400">in {scope}</span>
          </h3>
          {names.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">No variables yet.</p>
          ) : (
            <div className="mt-1 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full border-collapse text-left font-mono text-[14px]">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr>
                    <th scope="col" className="px-3 py-1.5 font-semibold">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-1.5 font-semibold">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {names.map((name) => (
                    <tr key={name} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="px-3 py-1.5">{name}</td>
                      <td className="whitespace-nowrap px-3 py-1.5">{variables[name]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold">Printed so far</h3>
          <pre
            tabIndex={0}
            className="mt-1 max-h-40 min-h-10 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-slate-100"
          >
            {printed || <span className="text-slate-400">Nothing printed yet.</span>}
          </pre>
        </div>
      </div>
    </div>
  );
}
