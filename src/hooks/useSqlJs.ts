import { useCallback, useEffect, useState } from 'react';
import type { Database, SqlJsStatic, SqlValue } from 'sql.js';
import seedSql from '../data/seed.sql?raw';

/**
 * SQL in the browser with sql.js (SQLite compiled to WebAssembly).
 * One in-memory database is shared by every playground on the site, so a table
 * you change in one topic is still changed in the next. "Reset database" reloads
 * the sample data. Nothing leaves the browser.
 */

export interface SqlResult {
  columns: string[];
  rows: SqlValue[][];
  /** True when the last statement returned rows (a SELECT). */
  hasRows: boolean;
  /** Rows changed by the last INSERT / UPDATE / DELETE. */
  rowsChanged: number;
  /** How long the query took, in milliseconds. */
  ms: number;
}

export interface SchemaTable {
  name: string;
  columns: { name: string; type: string; primaryKey: boolean }[];
}

export type SqlStatus = 'idle' | 'loading' | 'running';

let sqlPromise: Promise<SqlJsStatic> | null = null;
let database: Database | null = null;

function loadSqlJs(): Promise<SqlJsStatic> {
  sqlPromise ??= import('sql.js')
    .then((module) => module.default({ locateFile: () => '/wasm/sql-wasm.wasm' }))
    .catch((error: unknown) => {
      sqlPromise = null; // allow a retry after a failed download
      throw error;
    });
  return sqlPromise;
}

async function getDatabase(): Promise<Database> {
  if (database) return database;
  const SQL = await loadSqlJs();
  database = new SQL.Database();
  database.run(seedSql);
  return database;
}

async function recreateDatabase(): Promise<void> {
  const SQL = await loadSqlJs();
  database?.close();
  database = new SQL.Database();
  database.run(seedSql);
}

function readSchema(db: Database): SchemaTable[] {
  const tables = db.exec(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const names = (tables[0]?.values ?? []).map((row) => String(row[0]));
  return names.map((name) => {
    const info = db.exec(`PRAGMA table_info("${name.replace(/"/g, '""')}")`);
    // table_info columns: cid, name, type, notnull, dflt_value, pk
    const columns = (info[0]?.values ?? []).map((row) => ({
      name: String(row[1]),
      type: String(row[2] ?? ''),
      primaryKey: Number(row[5]) > 0,
    }));
    return { name, columns };
  });
}

export function useSqlJs() {
  const [status, setStatus] = useState<SqlStatus>('idle');
  const [result, setResult] = useState<SqlResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [schema, setSchema] = useState<SchemaTable[] | null>(null);

  const fail = useCallback((problem: unknown, loading: boolean) => {
    const message = problem instanceof Error ? problem.message : String(problem);
    setError(
      loading
        ? 'Could not load the SQL engine. Check your internet connection and try again.'
        : message,
    );
    setResult(null);
    setStatus('idle');
  }, []);

  /** Runs one or more statements and shows the result of the last one. */
  const run = useCallback(
    async (sql: string) => {
      setError(null);
      setStatus(database ? 'running' : 'loading');
      let db: Database;
      try {
        db = await getDatabase();
      } catch (problem) {
        fail(problem, true);
        return;
      }
      try {
        const start = performance.now();
        const sets = db.exec(sql);
        const ms = performance.now() - start;
        const last = sets[sets.length - 1];
        setResult({
          columns: last?.columns ?? [],
          rows: last?.values ?? [],
          hasRows: last !== undefined,
          rowsChanged: db.getRowsModified(),
          ms,
        });
        setSchema(readSchema(db)); // a CREATE or DROP may have changed it
        setStatus('idle');
      } catch (problem) {
        fail(problem, false);
      }
    },
    [fail],
  );

  /** Throws away every change and loads the sample data again. */
  const resetDatabase = useCallback(async () => {
    setError(null);
    setResult(null);
    setStatus('loading');
    try {
      await recreateDatabase();
      setSchema(readSchema(await getDatabase()));
      setStatus('idle');
    } catch (problem) {
      fail(problem, true);
    }
  }, [fail]);

  /** Loads the engine (if needed) and reads the list of tables and columns. */
  const loadSchema = useCallback(async () => {
    setStatus((current) => (current === 'idle' && !database ? 'loading' : current));
    try {
      setSchema(readSchema(await getDatabase()));
      setStatus('idle');
    } catch (problem) {
      fail(problem, true);
    }
  }, [fail]);

  // If the database is already open (another playground used it), show its schema.
  useEffect(() => {
    if (database) setSchema(readSchema(database));
  }, []);

  return { status, result, error, schema, run, resetDatabase, loadSchema };
}
