/**
 * Packages that need a real server or are not shipped with Pyodide, so code that
 * imports them cannot run in the browser playground.
 */
const SERVER_ONLY =
  /^\s*(?:from|import)\s+(?:flask(?:_\w+)?|fastapi|django|rest_framework|starlette|uvicorn|gunicorn|celery|werkzeug|wtforms|alembic|mcp|anthropic|openai|httpx|psycopg2?|redis|boto3)\b/m;

/** True when a Python snippet can run in the in-browser playground. */
export function pythonRunsInBrowser(code: string): boolean {
  return !SERVER_ONLY.test(code);
}
