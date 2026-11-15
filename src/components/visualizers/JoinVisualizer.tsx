import { useEffect, useId, useState } from 'react';

export type JoinType = 'inner' | 'left' | 'right' | 'full' | 'cross';

interface JoinVisualizerProps {
  /** Which join is selected first. The learner can switch. */
  type?: JoinType;
}

interface Employee {
  name: string;
  dept: number | null;
}
interface Department {
  id: number;
  name: string;
}
interface ResultRow {
  employee: string | null;
  department: string | null;
  /** Position of the left row that produced it (-1: only from the right table). */
  from: number;
}

const EMPLOYEES: Employee[] = [
  { name: 'Asha', dept: 1 },
  { name: 'Ravi', dept: 2 },
  { name: 'Meera', dept: 1 },
  { name: 'Zoya', dept: null },
];
const DEPARTMENTS: Department[] = [
  { id: 1, name: 'Engineering' },
  { id: 2, name: 'Sales' },
  { id: 3, name: 'Research' },
];

const JOINS: { type: JoinType; label: string; sql: string; says: string }[] = [
  {
    type: 'inner',
    label: 'INNER',
    sql: 'INNER JOIN',
    says: 'Only rows that have a match in both tables.',
  },
  {
    type: 'left',
    label: 'LEFT',
    sql: 'LEFT JOIN',
    says: 'Every employee. No department? Then NULL.',
  },
  {
    type: 'right',
    label: 'RIGHT',
    sql: 'RIGHT JOIN',
    says: 'Every department. No employee? Then NULL.',
  },
  {
    type: 'full',
    label: 'FULL',
    sql: 'FULL JOIN',
    says: 'Everything from both tables, matched where possible.',
  },
  {
    type: 'cross',
    label: 'CROSS',
    sql: 'CROSS JOIN',
    says: 'Every employee paired with every department (4 x 3 = 12 rows).',
  },
];

function buildRows(type: JoinType): ResultRow[] {
  if (type === 'cross') {
    return EMPLOYEES.flatMap((e, index) =>
      DEPARTMENTS.map((d) => ({ employee: e.name, department: d.name, from: index })),
    );
  }
  const rows: ResultRow[] = [];
  EMPLOYEES.forEach((e, index) => {
    const match = DEPARTMENTS.find((d) => d.id === e.dept);
    if (match) rows.push({ employee: e.name, department: match.name, from: index });
    else if (type === 'left' || type === 'full') {
      rows.push({ employee: e.name, department: null, from: index });
    }
  });
  if (type === 'right' || type === 'full') {
    for (const d of DEPARTMENTS) {
      if (!EMPLOYEES.some((e) => e.dept === d.id)) {
        rows.push({ employee: null, department: d.name, from: -1 });
      }
    }
  }
  return rows;
}

const cell = 'border-t border-slate-200 px-2 py-1 dark:border-slate-700';
const on = 'fill-brand-500';
const off = 'fill-slate-200 dark:fill-slate-700';

/**
 * Shows what each JOIN keeps: a Venn diagram, the two small tables, and the
 * result. "Show matching" walks through the left table one row at a time.
 */
export default function JoinVisualizer({ type = 'inner' }: JoinVisualizerProps) {
  const clipId = useId();
  const [selected, setSelected] = useState<JoinType>(type);
  // step: how many left rows have been processed. EMPLOYEES.length + 1 = finished.
  const [step, setStep] = useState(EMPLOYEES.length + 1);

  const info = JOINS.find((j) => j.type === selected) ?? JOINS[0]!;
  const rows = buildRows(selected);
  const playing = step <= EMPLOYEES.length;
  const current = playing ? step - 1 : -1; // left row being matched now
  const visible = playing ? rows.filter((r) => r.from !== -1 && r.from < step) : rows;
  const currentDept = current >= 0 ? EMPLOYEES[current]?.dept : undefined;

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => setStep((s) => s + 1), 900);
    return () => window.clearTimeout(timer);
  }, [playing, step]);

  const leftOnly = selected === 'left' || selected === 'full' || selected === 'cross';
  const rightOnly = selected === 'right' || selected === 'full' || selected === 'cross';

  return (
    <figure className="my-6 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div role="group" aria-label="Choose a join type" className="flex flex-wrap gap-2">
        {JOINS.map((join) => (
          <button
            key={join.type}
            type="button"
            aria-pressed={join.type === selected}
            onClick={() => {
              setSelected(join.type);
              setStep(EMPLOYEES.length + 1);
            }}
            className={`tap rounded-lg px-3 text-sm font-semibold ${
              join.type === selected
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
            }`}
          >
            {join.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setStep(1)}
          disabled={playing}
          className="tap ml-auto rounded-lg border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
        >
          ▶ Show matching
        </button>
      </div>

      <p className="mt-3 font-mono text-[14px]">
        employees <strong>{info.sql}</strong> departments
        {selected !== 'cross' && ' ON employees.dept = departments.id'}
      </p>
      <p role="status" className="mt-1 text-sm text-slate-700 dark:text-slate-300">
        {info.says}
      </p>

      <svg
        viewBox="0 0 260 120"
        role="img"
        aria-label={`Venn diagram for ${info.sql}`}
        className="mx-auto mt-2 h-auto w-full max-w-xs"
      >
        <defs>
          <clipPath id={clipId}>
            <circle cx="100" cy="60" r="50" />
          </clipPath>
        </defs>
        <circle cx="100" cy="60" r="50" className={`transition-colors ${leftOnly ? on : off}`} />
        <circle cx="160" cy="60" r="50" className={`transition-colors ${rightOnly ? on : off}`} />
        <circle cx="160" cy="60" r="50" clipPath={`url(#${clipId})`} className={on} />
        <circle cx="100" cy="60" r="50" fill="none" strokeWidth="2" className="stroke-slate-500" />
        <circle cx="160" cy="60" r="50" fill="none" strokeWidth="2" className="stroke-slate-500" />
        <text
          x="72"
          y="64"
          textAnchor="middle"
          fontSize="11"
          className="fill-slate-900 dark:fill-white"
        >
          employees
        </text>
        <text
          x="190"
          y="64"
          textAnchor="middle"
          fontSize="11"
          className="fill-slate-900 dark:fill-white"
        >
          departments
        </text>
      </svg>

      <div className="mt-3 grid gap-3 text-[14px] sm:grid-cols-3">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono">
            <caption className="pb-1 text-left font-sans text-sm font-semibold">employees</caption>
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1">
                  name
                </th>
                <th scope="col" className="px-2 py-1">
                  dept
                </th>
              </tr>
            </thead>
            <tbody>
              {EMPLOYEES.map((e, index) => (
                <tr
                  key={e.name}
                  className={index === current ? 'bg-amber-100 dark:bg-amber-900/50' : ''}
                >
                  <td className={cell}>{e.name}</td>
                  <td className={cell}>{e.dept ?? 'NULL'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono">
            <caption className="pb-1 text-left font-sans text-sm font-semibold">
              departments
            </caption>
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1">
                  id
                </th>
                <th scope="col" className="px-2 py-1">
                  name
                </th>
              </tr>
            </thead>
            <tbody>
              {DEPARTMENTS.map((d) => {
                const hit = current >= 0 && (selected === 'cross' || d.id === currentDept);
                return (
                  <tr key={d.id} className={hit ? 'bg-amber-100 dark:bg-amber-900/50' : ''}>
                    <td className={cell}>{d.id}</td>
                    <td className={cell}>{d.name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left font-mono">
            <caption className="pb-1 text-left font-sans text-sm font-semibold">
              Result ({visible.length} {visible.length === 1 ? 'row' : 'rows'})
            </caption>
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1">
                  employee
                </th>
                <th scope="col" className="px-2 py-1">
                  department
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row, index) => (
                <tr key={index}>
                  <td
                    className={`${cell} ${row.employee ? '' : 'italic text-slate-600 dark:text-slate-400'}`}
                  >
                    {row.employee ?? 'NULL'}
                  </td>
                  <td
                    className={`${cell} ${row.department ? '' : 'italic text-slate-600 dark:text-slate-400'}`}
                  >
                    {row.department ?? 'NULL'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </figure>
  );
}
