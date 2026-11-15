import type { ReactNode } from 'react';
import type { FramePlayer } from '../../hooks/useFramePlayer';

const button =
  'tap rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800';

interface PlayerControlsProps {
  player: FramePlayer;
  total: number;
  note: string;
  children?: ReactNode;
}

/** Buttons and the "what is happening" line under every DSA visualizer. */
export function PlayerControls({ player, total, note, children }: PlayerControlsProps) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={player.toggle}
          className="tap rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {player.playing ? 'Pause' : player.atEnd && player.index > 0 ? 'Play again' : '▶ Play'}
        </button>
        <button
          type="button"
          className={button}
          onClick={player.back}
          disabled={player.index === 0}
        >
          Back
        </button>
        <button type="button" className={button} onClick={player.next} disabled={player.atEnd}>
          Step
        </button>
        <button type="button" className={button} onClick={player.reset}>
          Reset
        </button>
        {children}
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {player.index + 1} / {total}
        </span>
      </div>
      <p role="status" className="min-h-6 text-sm text-slate-700 dark:text-slate-300">
        {note}
      </p>
    </div>
  );
}
