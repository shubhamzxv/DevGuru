import { useMemo, useState } from 'react';
import { useFramePlayer } from '../../hooks/useFramePlayer';
import { sortFrames, type SortAlgorithm } from '../../simulators/algorithms';
import { PlayerControls } from './AlgoPlayer';

const ALGORITHMS: { id: SortAlgorithm; name: string; big: string }[] = [
  { id: 'bubble', name: 'Bubble', big: 'O(n²)' },
  { id: 'selection', name: 'Selection', big: 'O(n²)' },
  { id: 'insertion', name: 'Insertion', big: 'O(n²), O(n) if almost sorted' },
  { id: 'merge', name: 'Merge', big: 'O(n log n)' },
  { id: 'quick', name: 'Quick', big: 'O(n log n) on average' },
];

interface SortVisualizerProps {
  algorithm?: SortAlgorithm;
  values?: number[];
}

/** <SortVisualizer algorithm="bubble" values={[5, 3, 8, 1]} /> in a DSA topic. */
export default function SortVisualizer({
  algorithm = 'bubble',
  values = [7, 3, 9, 2, 8, 1, 6, 4],
}: SortVisualizerProps) {
  const [chosen, setChosen] = useState<SortAlgorithm>(algorithm);
  const [list, setList] = useState(values);
  const frames = useMemo(() => sortFrames(chosen, list), [chosen, list]);
  const player = useFramePlayer(frames.length, 600);
  const frame = frames[player.index] ?? frames[0]!;
  const max = Math.max(...frame.values, 1);
  const info = ALGORITHMS.find((a) => a.id === chosen);

  const colour = (i: number) => {
    if (frame.changed?.includes(i)) return 'bg-red-500';
    if (frame.pivot === i) return 'bg-purple-500';
    if (frame.compare?.includes(i)) return 'bg-amber-400';
    if (frame.sorted.includes(i)) return 'bg-emerald-500';
    return 'bg-brand-500';
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div role="group" aria-label="Sorting algorithm" className="flex flex-wrap gap-2">
        {ALGORITHMS.map((a) => (
          <button
            key={a.id}
            type="button"
            aria-pressed={a.id === chosen}
            onClick={() => {
              setChosen(a.id);
              player.reset();
            }}
            className={`tap rounded-full border px-3 text-sm font-medium ${a.id === chosen ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'}`}
          >
            {a.name}
          </button>
        ))}
      </div>
      <div
        className="flex h-44 items-end gap-1 sm:gap-2"
        role="img"
        aria-label={`Values: ${frame.values.join(', ')}`}
      >
        {frame.values.map((value, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-semibold">{value}</span>
            <div
              className={`w-full rounded-t ${colour(i)} transition-all`}
              style={{ height: `${(value / max) * 140}px` }}
            />
          </div>
        ))}
      </div>
      <p className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
        <span>
          <span className="inline-block h-3 w-3 rounded bg-amber-400 align-middle" /> comparing
        </span>
        <span>
          <span className="inline-block h-3 w-3 rounded bg-red-500 align-middle" /> moved
        </span>
        <span>
          <span className="inline-block h-3 w-3 rounded bg-purple-500 align-middle" /> pivot
        </span>
        <span>
          <span className="inline-block h-3 w-3 rounded bg-emerald-500 align-middle" /> in final
          place
        </span>
        <span className="font-semibold">Time: {info?.big}</span>
      </p>
      <PlayerControls player={player} total={frames.length} note={frame.note}>
        <button
          type="button"
          onClick={() => {
            setList(Array.from({ length: 8 }, () => 1 + Math.floor(Math.random() * 9)));
            player.reset();
          }}
          className="tap rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          New numbers
        </button>
      </PlayerControls>
    </div>
  );
}
