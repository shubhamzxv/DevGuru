import type { SqlValue } from 'sql.js';

interface ResultTableProps {
  columns: string[];
  rows: SqlValue[][];
}

const MAX_ROWS = 500;

function cellText(value: SqlValue): string {
  if (value === null) return 'NULL';
  if (value instanceof Uint8Array) return `[${value.length} bytes]`;
  return String(value);
}

/**
 * Query result as a table. It scrolls sideways and downwards inside its own box,
 * and the header row stays visible while you scroll.
 */
export default function ResultTable({ columns, rows }: ResultTableProps) {
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <div>
      <div
        tabIndex={0}
        role="region"
        aria-label="Query result"
        className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700"
      >
        <table className="w-full border-collapse text-left font-mono text-[14px]">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
            <tr>
              {columns.map((column, index) => (
                <th key={index} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-slate-200 dark:border-slate-700">
                {row.map((value, cellIndex) => (
                  <td
                    key={cellIndex}
                    className={`whitespace-nowrap px-3 py-1.5 ${
                      value === null ? 'italic text-slate-500 dark:text-slate-400' : ''
                    }`}
                  >
                    {cellText(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_ROWS && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Showing the first {MAX_ROWS} of {rows.length} rows.
        </p>
      )}
    </div>
  );
}
