import { useState } from 'react';
import {
  METHODS,
  MockApi,
  parseRequestText,
  toCurl,
  type HttpMethod,
  type HttpResponse,
} from '../../simulators/http';

const field =
  'w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900';

function statusColor(status: number): string {
  if (status < 300)
    return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (status < 400) return 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200';
  if (status < 500) return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200';
}

function headersToText(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

function textToHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const colon = line.indexOf(':');
    if (colon > 0) headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return headers;
}

/** REST track playground: build a request, send it to a pretend API, read the response. */
export default function HttpPlayground({ initialCode }: { initialCode: string }) {
  const start = parseRequestText(initialCode);
  const [api, setApi] = useState(() => new MockApi());
  const [method, setMethod] = useState<HttpMethod>(start.method);
  const [path, setPath] = useState(start.path);
  const [headers, setHeaders] = useState(headersToText(start.headers));
  const [body, setBody] = useState(start.body);
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const request = {
    method,
    path: path.startsWith('/') ? path : `/${path}`,
    headers: textToHeaders(headers),
    body: hasBody ? body : '',
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          setResponse(api.send(request));
        }}
      >
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="http-method">
            Method
          </label>
          <select
            id="http-method"
            value={method}
            onChange={(e) => setMethod(e.target.value as HttpMethod)}
            className={`${field} min-h-11 w-auto font-semibold`}
          >
            {METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="http-path">
            Path
          </label>
          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-slate-300 focus-within:border-brand-500 dark:border-slate-700">
            <span className="hidden shrink-0 pl-3 font-mono text-sm text-slate-600 dark:text-slate-400 sm:inline">
              https://api.devguru.dev
            </span>
            <input
              id="http-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-11 w-full min-w-0 bg-transparent px-2 font-mono text-sm outline-none"
            />
          </div>
        </div>
        <div>
          <label htmlFor="http-headers" className="text-sm font-semibold">
            Headers{' '}
            <span className="font-normal text-slate-600 dark:text-slate-400">
              (one per line: Name: value)
            </span>
          </label>
          <textarea
            id="http-headers"
            value={headers}
            onChange={(e) => setHeaders(e.target.value)}
            rows={2}
            spellCheck={false}
            className={`${field} mt-1 py-2`}
          />
        </div>
        {hasBody && (
          <div>
            <label htmlFor="http-body" className="text-sm font-semibold">
              Body (JSON)
            </label>
            <textarea
              id="http-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              spellCheck={false}
              className={`${field} mt-1 py-2`}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="tap rounded-lg bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700"
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => {
              setApi(new MockApi());
              setMethod(start.method);
              setPath(start.path);
              setHeaders(headersToText(start.headers));
              setBody(start.body);
              setResponse(null);
            }}
            className="tap rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Reset
          </button>
        </div>
      </form>

      <section aria-live="polite" aria-label="Response">
        {response ? (
          <div className="space-y-2">
            <p className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 font-mono text-sm font-bold ${statusColor(response.status)}`}
              >
                {response.status} {response.statusText}
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {response.timeMs} ms
              </span>
            </p>
            <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/50 dark:text-sky-100">
              <span aria-hidden="true">💡 </span>
              {response.explanation}
            </p>
            <details>
              <summary className="tap cursor-pointer justify-start text-sm font-semibold">
                Response headers
              </summary>
              <pre className="overflow-x-auto rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-800">
                {headersToText(response.headers)}
              </pre>
            </details>
            {response.body ? (
              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-sm text-slate-100">
                {response.body}
              </pre>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">(no body)</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Press Send to see the response here.
          </p>
        )}
      </section>

      <details>
        <summary className="tap cursor-pointer justify-start text-sm font-semibold">
          The same request with curl
        </summary>
        <pre className="overflow-x-auto rounded-lg bg-slate-100 p-2 text-sm dark:bg-slate-800">
          {toCurl(request)}
        </pre>
      </details>
    </div>
  );
}
