import { useMemo, useState } from 'react';
import { useFramePlayer } from '../../hooks/useFramePlayer';
import { GRAPH, traversalFrames } from '../../simulators/algorithms';
import { PlayerControls } from './AlgoPlayer';

/** <GraphTraversal mode="bfs" /> : watch BFS (queue) or DFS (stack) visit a small graph. */
export default function GraphTraversal({ mode = 'bfs' }: { mode?: 'bfs' | 'dfs' }) {
  const [chosen, setChosen] = useState(mode);
  const frames = useMemo(() => traversalFrames(chosen), [chosen]);
  const player = useFramePlayer(frames.length, 900);
  const frame = frames[player.index] ?? frames[0]!;
  const x = (n: string) => (GRAPH.nodes[n]?.[0] ?? 0) * 3.2 + 20;
  const y = (n: string) => (GRAPH.nodes[n]?.[1] ?? 0) * 1.8 + 20;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div role="group" aria-label="Traversal" className="flex gap-2">
        {(['bfs', 'dfs'] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={m === chosen}
            onClick={() => {
              setChosen(m);
              player.reset();
            }}
            className={`tap rounded-full border px-4 text-sm font-semibold ${m === chosen ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'}`}
          >
            {m === 'bfs' ? 'BFS (queue)' : 'DFS (stack)'}
          </button>
        ))}
      </div>
      <svg
        viewBox="0 0 360 220"
        className="w-full max-w-md"
        role="img"
        aria-label={`Graph. Visited so far: ${frame.visited.join(', ') || 'none'}`}
      >
        {GRAPH.edges.map(([a, b]) => {
          const active =
            frame.edge &&
            ((frame.edge[0] === a && frame.edge[1] === b) ||
              (frame.edge[0] === b && frame.edge[1] === a));
          return (
            <line
              key={`${a}${b}`}
              x1={x(a)}
              y1={y(a)}
              x2={x(b)}
              y2={y(b)}
              strokeWidth={active ? 4 : 2}
              stroke={active ? '#f59e0b' : '#94a3b8'}
            />
          );
        })}
        {Object.keys(GRAPH.nodes).map((n) => {
          const visited = frame.visited.includes(n);
          const current = frame.current === n;
          const waiting = frame.frontier.includes(n);
          const fill = current ? '#f59e0b' : visited ? '#10b981' : waiting ? '#c7d2fe' : '#ffffff';
          return (
            <g key={n}>
              <circle cx={x(n)} cy={y(n)} r={16} fill={fill} stroke="#4f46e5" strokeWidth={2} />
              <text
                x={x(n)}
                y={y(n) + 5}
                textAnchor="middle"
                className="text-[14px] font-bold"
                fill={visited || current ? '#fff' : '#0f172a'}
              >
                {n}
              </text>
              {visited && (
                <text
                  x={x(n) + 18}
                  y={y(n) - 12}
                  className="text-[11px] font-semibold"
                  fill="#059669"
                >
                  {frame.visited.indexOf(n) + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">
          {chosen === 'bfs' ? 'Queue (front →):' : 'Stack (top →):'}
        </span>
        {frame.frontier.length === 0 ? (
          <span className="text-slate-500">empty</span>
        ) : (
          frame.frontier.map((n, i) => (
            <span
              key={`${n}${i}`}
              className="rounded bg-indigo-100 px-2 py-1 font-mono font-semibold text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100"
            >
              {n}
            </span>
          ))
        )}
      </div>
      <PlayerControls player={player} total={frames.length} note={frame.note} />
    </div>
  );
}
