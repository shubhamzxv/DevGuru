import { useRef, useState } from 'react';
import { useLazyEditor } from '../../hooks/useLazyEditor';
import { useSqlJs } from '../../hooks/useSqlJs';
import ResultTable from './ResultTable';

interface SqlPlaygroundProps {
  /** The example query. "Reset query" brings it back. */
  initialCode: string;
}

const button = 'tap rounded-lg px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50';
const plain =
  'border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800';

/**
 * SQL editor on top, result below (stacked on every screen size).
 * The query runs in the browser on a sample database (SQLite). Changes you make
 * with INSERT, UPDATE or DELETE stay until you press "Reset database" or reload.
 */
export default function SqlPlayground({ initialCode }: SqlPlaygroundProps) {
  const box = useRef<HTMLDivElement>(null);
  const { Editor, load: loadEditor } = useLazyEditor(box);
  const [code, setCode] = useState(initialCode);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const { status, result, error, schema, run, resetDatabase, loadSchema } = useSqlJs();
  const busy = status !== 'idle';
  const rows = Math.min(20, Math.max(5, code.split('\n').length + 1));

  const toggleSchema = () => {
    if (!schemaOpen && !schema) void loadSchema();
    setSchemaOpen(!schemaOpen);
  };

  /** Tap a table or column name in the schema to add it to the query. */
  const insert = (name: string) => {
    setCode((current) => (current === '' || /\s$/.test(current) ? current : `${current} `) + name);
  };

  return (
    <div
      ref={box}
      className="my-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700"
    >
      <div className="bg-slate-100 px-3 py-2 dark:bg-slate-800">
        <p className="pb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          SQL editor
        </p>
        {/* Same height before and after the editor loads, so nothing below jumps. */}
        <div style={{ minHeight: `calc(${rows} * 1.625 * 14px + 26px)` }}>
          {Editor ? (
            <Editor
              value={code}
              onChange={setCode}
              onRun={() => void run(code)}
              label="SQL query editor"
              language="sql"
            />
          ) : (
            <textarea
              onFocus={loadEditor}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void run(code);
                }
              }}
              aria-label="SQL query editor"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              rows={rows}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              className="block w-full resize-y rounded-lg border border-slate-300 bg-white p-3 font-mono text-[14px] leading-relaxed text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
          )}
        </div>
        <p className="pt-1 text-xs text-slate-600 dark:text-slate-400">
          Ctrl+Enter runs the query. In the editor, press Esc, then Tab, to leave it with the
          keyboard.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-y border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => void run(code)}
          disabled={busy}
          className={`${button} bg-emerald-700 text-white hover:bg-emerald-800`}
        >
          ▶ Run
        </button>
        <button
          type="button"
          onClick={toggleSchema}
          aria-expanded={schemaOpen}
          className={`${button} ${plain}`}
        >
          {schemaOpen ? 'Hide schema' : 'View schema'}
        </button>
        <button
          type="button"
          onClick={() => setCode(initialCode)}
          disabled={code === initialCode}
          className={`${button} ${plain}`}
        >
          ↺ Reset query
        </button>
        <button
          type="button"
          onClick={() => void resetDatabase()}
          disabled={busy}
          className={`${button} ${plain}`}
        >
          Reset database
        </button>
        <p role="status" className="flex items-center text-sm text-slate-600 dark:text-slate-300">
          {status === 'loading' && 'Loading the SQL engine…'}
          {status === 'running' && 'Running…'}
        </p>
      </div>

      {schemaOpen && (
        <div className="border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Tap a table or column name to add it to your query.
          </p>
          {!schema && <p className="mt-2 text-sm">Loading tables…</p>}
          <ul className="mt-2 space-y-3">
            {schema?.map((table) => (
              <li key={table.name}>
                <button
                  type="button"
                  onClick={() => insert(table.name)}
                  className="tap rounded-lg bg-brand-50 px-3 font-mono text-[14px] font-bold text-brand-800 hover:bg-brand-100 dark:bg-brand-950 dark:text-brand-200 dark:hover:bg-brand-900"
                >
                  {table.name}
                </button>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {table.columns.map((column) => (
                    <li key={column.name}>
                      <button
                        type="button"
                        onClick={() => insert(column.name)}
                        className={`tap rounded-lg px-2 font-mono text-[14px] ${plain}`}
                      >
                        {column.primaryKey && (
                          <span aria-label="primary key" className="mr-1">
                            🔑
                          </span>
                        )}
                        {column.name}
                        <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">
                          {column.type}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white p-3 dark:bg-slate-900" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Result
        </p>

        {error && (
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-red-800 dark:bg-red-950 dark:text-red-200">
            SQL error: {error}
          </pre>
        )}

        {!error && !result && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Press Run to see the rows here.
          </p>
        )}

        {!error && result && result.hasRows && (
          <>
            <p className="my-2 text-sm text-slate-600 dark:text-slate-300">
              {result.rows.length} {result.rows.length === 1 ? 'row' : 'rows'} in{' '}
              {result.ms < 1 ? 'under 1' : Math.round(result.ms)} ms
            </p>
            <ResultTable columns={result.columns} rows={result.rows} />
          </>
        )}

        {!error && result && !result.hasRows && (
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
            Done. {result.rowsChanged} {result.rowsChanged === 1 ? 'row' : 'rows'} changed. Run a
            SELECT to see the data.
          </p>
        )}

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          This playground uses SQLite. A few things differ in MySQL and PostgreSQL; topics point
          them out where it matters. Your changes stay in this browser only.
        </p>
      </div>
    </div>
  );
}
