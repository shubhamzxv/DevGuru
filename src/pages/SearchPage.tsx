import { useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import entries from 'virtual:devguru-search';
import { SearchIcon } from '../components/layout/icons';
import { FOCUS_SEARCH_EVENT } from '../hooks/useSearchShortcut';
import { search } from '../utils/search';

/** Shown before the learner types: common interview topics. */
const SUGGESTIONS = [
  'list vs tuple',
  'decorators',
  'shallow vs deep copy',
  'async await',
  'GIL',
  'window functions',
  'second highest salary',
  'indexes',
  'EXPLAIN ANALYZE',
  'ACID',
];

const writtenCount = entries.filter((entry) => entry.written).length;

function topicPath(track: string, slug: string): string {
  return `/track/${track}/${slug}`;
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const results = useMemo(() => search(entries, query), [query]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Search | DevGuru';
    const focus = () => inputRef.current?.focus();
    focus();
    window.addEventListener(FOCUS_SEARCH_EVENT, focus);
    return () => {
      window.removeEventListener(FOCUS_SEARCH_EVENT, focus);
      document.title = 'DevGuru – Learn tech the simple way';
    };
  }, []);

  // replace: typing should not fill the Back button history with every letter.
  const setQuery = (value: string) => setParams(value ? { q: value } : {}, { replace: true });

  const first = results[0];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Search</h1>

      <form
        role="search"
        className="mt-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (first) navigate(topicPath(first.entry.track, first.entry.slug));
        }}
      >
        <label htmlFor="site-search" className="sr-only">
          Search topics
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900">
          <SearchIcon className="shrink-0 text-slate-600 dark:text-slate-400" />
          <input
            ref={inputRef}
            id="site-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “list vs tuple” or “window functions”"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            className="min-h-12 w-full bg-transparent text-base outline-none placeholder:text-slate-400"
          />
        </div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Searches titles, key terms and interview questions of {writtenCount} topics.{' '}
          <span className="hidden lg:inline">
            Press{' '}
            <kbd className="rounded border border-slate-300 px-1 dark:border-slate-600">Enter</kbd>{' '}
            to open the first result.
          </span>
        </p>
      </form>

      {query.trim() === '' ? (
        <section aria-labelledby="ideas-heading" className="mt-8">
          <h2 id="ideas-heading" className="font-bold">
            Popular in interviews
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((suggestion) => (
              <li key={suggestion}>
                <button
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="tap rounded-full border border-slate-300 px-4 text-sm font-medium hover:border-brand-400 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  {suggestion}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section aria-label="Search results" className="mt-6">
          <p role="status" className="text-sm text-slate-600 dark:text-slate-300">
            {results.length === 0
              ? `No topics match “${query}”.`
              : `${results.length} ${results.length === 1 ? 'topic' : 'topics'} found`}
          </p>
          {results.length === 0 && (
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Check the spelling, use fewer words, or browse the{' '}
              <Link
                to="/cheatsheets"
                className="font-semibold text-brand-700 underline dark:text-brand-300"
              >
                cheat sheets
              </Link>
              .
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {results.map(({ entry, matchedQuestion }) => (
              <li key={`${entry.track}/${entry.slug}`}>
                <Link
                  to={topicPath(entry.track, entry.slug)}
                  className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500"
                >
                  <span className="block text-sm text-slate-500 dark:text-slate-400">
                    <span aria-hidden="true">{entry.trackIcon} </span>
                    {entry.trackName} › {entry.module}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-brand-700 dark:text-brand-300">
                      {entry.title}
                    </span>
                    {!entry.written && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Coming soon
                      </span>
                    )}
                  </span>
                  {entry.summary && (
                    <span className="mt-1 block text-sm text-slate-700 dark:text-slate-300">
                      {entry.summary}
                    </span>
                  )}
                  {matchedQuestion && (
                    <span className="mt-2 block text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-semibold">Interview question:</span> {matchedQuestion}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
