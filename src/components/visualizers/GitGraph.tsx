import { useEffect, useRef, useState } from 'react';
import type { GraphCommit } from '../../simulators/git';

const COL = 64;
const ROW = 56;
const PAD_X = 36;
const LABEL_H = 18;

/** One colour per branch row, readable in light and dark mode. */
const LANE_COLORS = ['#4f46e5', '#059669', '#d97706', '#db2777', '#0891b2', '#7c3aed'];

/**
 * Draws the commits as a graph: one row per branch, newest on the right.
 * Labels show branches (HEAD -> main), tags and remote branches (origin/main).
 * Tap a commit to read its message.
 */
export default function GitGraph({ commits }: { commits: GraphCommit[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollLeft = box.scrollWidth; // keep the newest commit in view
  }, [commits.length]);

  if (commits.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
        No commits yet. The graph appears after your first <code>git commit</code>.
      </p>
    );
  }

  const index = new Map(commits.map((c, i) => [c.id, i]));
  const lanes = [...new Set(commits.map((c) => c.lane))].sort((a, b) => a - b);
  const laneRow = new Map(lanes.map((lane, i) => [lane, i]));
  const maxLabels = Math.max(1, ...commits.map((c) => c.labels.length));
  const top = 14 + maxLabels * LABEL_H;
  const pos = (c: GraphCommit) => ({
    x: PAD_X + (index.get(c.id) ?? 0) * COL,
    y: top + (laneRow.get(c.lane) ?? 0) * ROW,
  });
  const width = PAD_X * 2 + (commits.length - 1) * COL;
  const height = top + (lanes.length - 1) * ROW + 30;
  const chosen = commits.find((c) => c.id === selected);

  return (
    <figure className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
      <div ref={scroller} className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Commit graph with ${commits.length} commits`}
        >
          {commits.flatMap((child) =>
            child.parents.map((parentId) => {
              const parent = commits[index.get(parentId) ?? -1];
              if (!parent) return null;
              const a = pos(parent);
              const b = pos(child);
              const color = LANE_COLORS[child.lane % LANE_COLORS.length];
              const d =
                a.y === b.y
                  ? `M${a.x},${a.y} L${b.x},${b.y}`
                  : `M${a.x},${a.y} C${a.x + COL / 2},${a.y} ${b.x - COL / 2},${b.y} ${b.x},${b.y}`;
              return (
                <path
                  key={`${parentId}-${child.id}`}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={3}
                  opacity={0.8}
                />
              );
            }),
          )}
          {commits.map((commit) => {
            const { x, y } = pos(commit);
            const color = LANE_COLORS[commit.lane % LANE_COLORS.length];
            const isSelected = commit.id === selected;
            return (
              <g
                key={commit.id}
                role="button"
                tabIndex={0}
                aria-label={`Commit ${commit.id}: ${commit.message}${commit.labels.length ? `, ${commit.labels.join(', ')}` : ''}`}
                aria-pressed={isSelected}
                onClick={() => setSelected(isSelected ? null : commit.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelected(isSelected ? null : commit.id);
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <title>{`${commit.id} ${commit.message}`}</title>
                <circle cx={x} cy={y} r={16} fill="transparent" />
                {commit.isHead && (
                  <circle
                    cx={x}
                    cy={y}
                    r={14}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray="3 3"
                  />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 11 : 9}
                  fill={commit.parents.length > 1 ? 'white' : color}
                  stroke={color}
                  strokeWidth={3}
                />
                <text
                  x={x}
                  y={y + 26}
                  textAnchor="middle"
                  className="fill-slate-500 font-mono text-[10px] dark:fill-slate-400"
                >
                  {commit.id}
                </text>
                {commit.labels.map((label, i) => {
                  const w = label.length * 6.6 + 12;
                  const ly = y - 20 - i * LABEL_H;
                  const head = label.startsWith('HEAD');
                  const tag = label.startsWith('tag:');
                  const remote = label.startsWith('origin/');
                  return (
                    <g key={label}>
                      <rect
                        x={x - w / 2}
                        y={ly - 12}
                        width={w}
                        height={16}
                        rx={8}
                        fill={head ? color : tag ? '#fef3c7' : remote ? '#e2e8f0' : 'white'}
                        stroke={color}
                      />
                      <text
                        x={x}
                        y={ly}
                        textAnchor="middle"
                        className="font-mono text-[11px] font-semibold"
                        fill={head ? 'white' : '#0f172a'}
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="px-2 pb-1 pt-2 text-sm text-slate-700 dark:text-slate-300">
        {chosen ? (
          <>
            <span className="font-mono font-semibold">{chosen.id}</span> {chosen.message}
            {chosen.parents.length > 1 && (
              <span className="text-slate-600 dark:text-slate-400"> (merge commit: 2 parents)</span>
            )}
          </>
        ) : (
          'Each circle is a commit; lines point back to the commit before it. Hollow circle = merge commit. Tap a commit to read its message.'
        )}
      </figcaption>
    </figure>
  );
}
