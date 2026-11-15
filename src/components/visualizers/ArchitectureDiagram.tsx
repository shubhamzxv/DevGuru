import { useEffect, useState } from 'react';
import type { Diagram, DiagramNode } from '../../simulators/diagram';

const CELL_W = 156;
const CELL_H = 108;
const BOX_W = 128;
const BOX_H = 66;

const button =
  'tap rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-slate-100 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800';

function centre(node: DiagramNode) {
  return { x: node.col * CELL_W + CELL_W / 2, y: node.row * CELL_H + CELL_H / 2 };
}

/** Point where the line from a box centre towards (dx, dy) leaves the box. */
function edgePoint(c: { x: number; y: number }, dx: number, dy: number) {
  const t = Math.min(
    (BOX_W / 2 + 4) / Math.abs(dx || 1e-6),
    (BOX_H / 2 + 4) / Math.abs(dy || 1e-6),
  );
  return { x: c.x + dx * t, y: c.y + dy * t };
}

/**
 * AWS and System Design playground: tap any box to learn what it does.
 * "Play" walks a request through the system one step at a time.
 */
export default function ArchitectureDiagram({ diagram }: { diagram: Diagram }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [flowIndex, setFlowIndex] = useState(0);
  const [step, setStep] = useState(-1); // -1 = not started
  const [playing, setPlaying] = useState(false);

  const flow = diagram.flows[flowIndex];
  const steps = flow?.steps ?? [];
  const current = step >= 0 ? steps[step] : undefined;
  const previous = step > 0 ? steps[step - 1] : undefined;
  const finished = step >= steps.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (finished) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStep((s) => s + 1), 1400);
    return () => window.clearTimeout(timer);
  }, [playing, step, finished]);

  const byId = new Map(diagram.nodes.map((n) => [n.id, n]));
  const width = (Math.max(...diagram.nodes.map((n) => n.col)) + 1) * CELL_W;
  const height = (Math.max(...diagram.nodes.map((n) => n.row)) + 1) * CELL_H;
  const info = selected ? byId.get(selected) : current ? byId.get(current.node) : undefined;

  const activeEdge = (from: string, to: string) =>
    !!previous &&
    !!current &&
    ((previous.node === from && current.node === to) ||
      (previous.node === to && current.node === from));

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', minWidth: Math.min(width, 520), maxWidth: width }}
          role="group"
          aria-label="Architecture diagram. Tap a box for details."
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" className="fill-slate-400" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="#f59e0b" />
            </marker>
          </defs>
          {diagram.edges.map((edge) => {
            const a = byId.get(edge.from);
            const b = byId.get(edge.to);
            if (!a || !b) return null;
            const ca = centre(a);
            const cb = centre(b);
            const dx = cb.x - ca.x;
            const dy = cb.y - ca.y;
            const start = edgePoint(ca, dx, dy);
            const end = edgePoint(cb, -dx, -dy);
            const active = activeEdge(edge.from, edge.to);
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  strokeWidth={active ? 3.5 : 2}
                  stroke={active ? '#f59e0b' : undefined}
                  className={active ? '' : 'stroke-slate-400'}
                  markerEnd={`url(#${active ? 'arrow-active' : 'arrow'})`}
                />
                {edge.label && (
                  <text
                    x={(start.x + end.x) / 2}
                    y={(start.y + end.y) / 2 - 6}
                    textAnchor="middle"
                    className="fill-slate-500 text-[11px] dark:fill-slate-400"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
          {diagram.nodes.map((node) => {
            const c = centre(node);
            const isCurrent = current?.node === node.id;
            const isSelected = selected === node.id;
            const toggle = () => setSelected(isSelected ? null : node.id);
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`${node.label}: ${node.info}`}
                onClick={toggle}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggle();
                  }
                }}
                className="cursor-pointer outline-none"
              >
                <rect
                  x={c.x - BOX_W / 2}
                  y={c.y - BOX_H / 2}
                  width={BOX_W}
                  height={BOX_H}
                  rx={12}
                  strokeWidth={isCurrent || isSelected ? 3 : 1.5}
                  className={
                    isCurrent
                      ? 'fill-amber-100 stroke-amber-500 dark:fill-amber-900/60'
                      : isSelected
                        ? 'fill-brand-50 stroke-brand-600 dark:fill-brand-950 dark:stroke-brand-400'
                        : 'fill-white stroke-slate-300 dark:fill-slate-800 dark:stroke-slate-600'
                  }
                />
                <text x={c.x} y={c.y - 4} textAnchor="middle" className="text-[22px]">
                  {node.icon ?? '⬜'}
                </text>
                <text
                  x={c.x}
                  y={c.y + 20}
                  textAnchor="middle"
                  className="fill-slate-900 text-[12px] font-semibold dark:fill-slate-100"
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {diagram.flows.length > 0 && (
        <div className="space-y-2">
          {diagram.flows.length > 1 && (
            <div role="group" aria-label="Choose a request flow" className="flex flex-wrap gap-2">
              {diagram.flows.map((f, i) => (
                <button
                  key={f.name}
                  type="button"
                  aria-pressed={i === flowIndex}
                  onClick={() => {
                    setFlowIndex(i);
                    setStep(-1);
                    setPlaying(false);
                  }}
                  className={`${button} ${i === flowIndex ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700' : ''}`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="tap rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              onClick={() => {
                setSelected(null);
                if (finished) setStep(0);
                else if (step < 0) setStep(0);
                setPlaying((p) => !p || finished);
              }}
            >
              {playing ? 'Pause' : step < 0 || finished ? `▶ Play: ${flow?.name ?? ''}` : 'Resume'}
            </button>
            <button
              type="button"
              className={button}
              disabled={step <= 0}
              onClick={() => setStep((s) => s - 1)}
            >
              Back
            </button>
            <button
              type="button"
              className={button}
              disabled={finished}
              onClick={() => setStep((s) => s + 1)}
            >
              Next step
            </button>
          </div>
          <p role="status" className="min-h-6 text-sm text-slate-700 dark:text-slate-300">
            {current ? (
              <>
                <span className="font-semibold">
                  Step {step + 1} of {steps.length} · {byId.get(current.node)?.label}:
                </span>{' '}
                {current.text}
              </>
            ) : (
              'Press Play to follow one request through the system, step by step.'
            )}
          </p>
        </div>
      )}

      {info && (
        <section aria-live="polite" className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
          <h3 className="font-semibold">
            <span aria-hidden="true">{info.icon} </span>
            {info.label}
          </h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{info.info}</p>
          {info.example && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-semibold">Real use:</span> {info.example}
            </p>
          )}
        </section>
      )}
      {!info && step < 0 && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Tap any box to see what it does.
        </p>
      )}
    </div>
  );
}
