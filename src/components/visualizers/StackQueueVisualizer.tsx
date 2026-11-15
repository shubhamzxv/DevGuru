import { useState } from 'react';

const button =
  'tap rounded-lg border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800';

/** <StackQueueVisualizer mode="stack" /> : push and pop by hand to feel LIFO vs FIFO. */
export default function StackQueueVisualizer({ mode = 'stack' }: { mode?: 'stack' | 'queue' }) {
  const [chosen, setChosen] = useState(mode);
  const [items, setItems] = useState<number[]>([10, 20, 30]);
  const [next, setNext] = useState(40);
  const [note, setNote] = useState('');
  const isStack = chosen === 'stack';
  const outIndex = isStack ? items.length - 1 : 0;

  const add = () => {
    setItems((list) => [...list, next]);
    setNote(
      isStack
        ? `push(${next}): ${next} goes on TOP. O(1)`
        : `enqueue(${next}): ${next} joins at the BACK. O(1)`,
    );
    setNext((n) => n + 10);
  };
  const remove = () => {
    const value = items[outIndex];
    if (value === undefined) return;
    setItems((list) => (isStack ? list.slice(0, -1) : list.slice(1)));
    setNote(
      isStack
        ? `pop() returned ${value}: the LAST one in comes out FIRST (LIFO).`
        : `dequeue() returned ${value}: the FIRST one in comes out FIRST (FIFO).`,
    );
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div role="group" aria-label="Structure" className="flex gap-2">
        {(['stack', 'queue'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === chosen}
            onClick={() => {
              setChosen(m);
              setNote('');
            }}
            className={`tap rounded-full border px-4 text-sm font-semibold ${m === chosen ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'}`}
          >
            {m === 'stack' ? 'Stack (plates)' : 'Queue (ticket line)'}
          </button>
        ))}
      </div>
      <ol
        aria-label={isStack ? 'Stack, top first' : 'Queue, front first'}
        className={`flex min-h-16 gap-2 ${isStack ? 'flex-col-reverse items-start' : 'flex-row items-center overflow-x-auto'}`}
      >
        {items.map((value, i) => (
          <li
            key={`${value}-${i}`}
            className={`flex h-11 min-w-16 items-center justify-center rounded-lg border-2 px-3 font-mono font-bold ${i === outIndex ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/50' : 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-950/40'}`}
          >
            {value}
            {i === outIndex && (
              <span className="ml-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {isStack ? '← top' : '← front'}
              </span>
            )}
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-sm text-slate-500">
            Empty. Popping now would be an error (underflow).
          </li>
        )}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={add} disabled={items.length >= 8}>
          {isStack ? `push(${next})` : `enqueue(${next})`}
        </button>
        <button type="button" className={button} onClick={remove} disabled={items.length === 0}>
          {isStack ? 'pop()' : 'dequeue()'}
        </button>
      </div>
      <p role="status" className="min-h-6 text-sm text-slate-700 dark:text-slate-300">
        {note ||
          (isStack
            ? 'Python: use a list. append() to push, pop() to pop.'
            : 'Python: use collections.deque. append() to enqueue, popleft() to dequeue.')}
      </p>
    </div>
  );
}
