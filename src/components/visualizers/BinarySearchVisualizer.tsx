import { useMemo, useState } from 'react';
import { useFramePlayer } from '../../hooks/useFramePlayer';
import { binarySearchFrames } from '../../simulators/algorithms';
import { PlayerControls } from './AlgoPlayer';

interface BinarySearchVisualizerProps {
  values?: number[];
  target?: number;
}

/** <BinarySearchVisualizer values={[...sorted]} target={23} /> */
export default function BinarySearchVisualizer({
  values = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91],
  target = 23,
}: BinarySearchVisualizerProps) {
  const sorted = useMemo(() => [...values].sort((a, b) => a - b), [values]);
  const [goal, setGoal] = useState(target);
  const frames = useMemo(() => binarySearchFrames(sorted, goal), [sorted, goal]);
  const player = useFramePlayer(frames.length, 1100);
  const frame = frames[player.index] ?? frames[0]!;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <label className="flex items-center gap-2 text-sm font-semibold">
        Look for
        <input
          type="number"
          value={goal}
          onChange={(e) => {
            setGoal(Number(e.target.value));
            player.reset();
          }}
          className="min-h-11 w-24 rounded-lg border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <ol className="flex gap-1 overflow-x-auto pb-1" aria-label="Sorted list">
        {sorted.map((value, i) => {
          const inRange = i >= frame.lo && i <= frame.hi;
          const style =
            frame.found === i
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : frame.mid === i
                ? 'border-amber-500 bg-amber-100 dark:bg-amber-900/50'
                : inRange
                  ? 'border-brand-400 bg-white dark:bg-slate-800'
                  : 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-800 dark:bg-slate-900';
          return (
            <li key={i} className="flex flex-col items-center">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 font-semibold ${style}`}
              >
                {value}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">{i}</span>
              <span className="h-4 text-[10px] font-bold text-brand-700 dark:text-brand-300">
                {[i === frame.lo && 'lo', i === frame.mid && 'mid', i === frame.hi && 'hi']
                  .filter(Boolean)
                  .join(' ')}
              </span>
            </li>
          );
        })}
      </ol>
      <PlayerControls player={player} total={frames.length} note={frame.note} />
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Each step halves what is left: 1,000,000 items need at most 20 steps. That is O(log n).
      </p>
    </div>
  );
}
