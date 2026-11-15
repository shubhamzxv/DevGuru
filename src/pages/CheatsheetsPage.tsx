import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import sheets from 'virtual:devguru-cheatsheets';
import InlineMarkdown from '../components/content/InlineMarkdown';
import type { CheatSheetEntry } from '../build/contentIndex';
import { TRACKS } from '../registry/tracks';

/** Tracks that have at least one written cheat sheet. */
const tracksWithSheets = TRACKS.filter((track) => sheets.some((s) => s.track === track.slug));

const chip = (active: boolean) =>
  `tap shrink-0 rounded-full border px-4 text-sm font-medium ${
    active
      ? 'border-brand-600 bg-brand-600 text-white'
      : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
  }`;

/** Sheets drawn at first, and how many more each time the reader nears the end. */
const BATCH = 12;

/** Keeps only the rows (or notes) that contain the filter text. */
function filterSheet(entry: CheatSheetEntry, words: string[]): CheatSheetEntry | null {
  if (words.length === 0) return entry;
  const has = (text: string) => words.every((word) => text.toLowerCase().includes(word));
  if (has(`${entry.title} ${entry.module}`)) return entry; // whole sheet matches by name
  const rows = entry.sheet.rows.filter((row) => has(row.join(' ')));
  const notes = entry.sheet.notes.filter(has);
  if (rows.length === 0 && notes.length === 0) return null;
  return { ...entry, sheet: { ...entry.sheet, rows, notes } };
}

export default function CheatsheetsPage() {
  const [params, setParams] = useSearchParams();
  const trackFilter = params.get('track') ?? '';
  const text = params.get('q') ?? '';

  useEffect(() => {
    document.title = 'Cheat sheets | DevGuru';
    return () => {
      document.title = 'DevGuru – Learn tech the simple way';
    };
  }, []);

  const update = (key: 'track' | 'q', value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const groups = useMemo(() => {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return tracksWithSheets
      .filter((track) => !trackFilter || track.slug === trackFilter)
      .map((track) => ({
        track,
        sheets: sheets
          .filter((s) => s.track === track.slug)
          .map((s) => filterSheet(s, words))
          .filter((s): s is CheatSheetEntry => s !== null),
      }))
      .filter((group) => group.sheets.length > 0);
  }, [text, trackFilter]);

  const shown = groups.reduce((sum, g) => sum + g.sheets.length, 0);

  // All sheets together are ~20,000 elements: drawing them in one go froze phones
  // for over a second. Draw a few, and more when the reader scrolls near the end.
  const [limit, setLimit] = useState(BATCH);
  useEffect(() => setLimit(BATCH), [text, trackFilter]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = end.current;
    if (!element || limit >= shown || typeof IntersectionObserver === 'undefined') {
      if (limit < shown && typeof IntersectionObserver === 'undefined') setLimit(shown);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLimit((current) => current + BATCH);
      },
      { rootMargin: '1200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [limit, shown]);
  // Printing must include every sheet, even ones not drawn yet.
  useEffect(() => {
    const showAll = () => flushSync(() => setLimit(Number.POSITIVE_INFINITY));
    window.addEventListener('beforeprint', showAll);
    return () => window.removeEventListener('beforeprint', showAll);
  }, []);

  let budget = limit;
  const visibleGroups = groups
    .map((group) => {
      const take = group.sheets.slice(0, Math.max(0, budget));
      budget -= take.length;
      return { ...group, sheets: take };
    })
    .filter((group) => group.sheets.length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Cheat sheets</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            The one-glance summary of every topic, in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            flushSync(() => setLimit(Number.POSITIVE_INFINITY));
            window.print();
          }}
          className="tap rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-100 print:hidden dark:border-slate-600 dark:hover:bg-slate-800"
        >
          Print / save as PDF
        </button>
      </div>

      <div className="mt-5 space-y-3 print:hidden">
        <label htmlFor="sheet-filter" className="sr-only">
          Filter cheat sheets
        </label>
        <input
          id="sheet-filter"
          type="search"
          value={text}
          onChange={(event) => update('q', event.target.value)}
          placeholder="Filter, for example “join” or “dict”"
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900"
        />
        <div role="group" aria-label="Choose a track" className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            aria-pressed={!trackFilter}
            className={chip(!trackFilter)}
            onClick={() => update('track', '')}
          >
            All
          </button>
          {tracksWithSheets.map((track) => (
            <button
              key={track.slug}
              type="button"
              aria-pressed={trackFilter === track.slug}
              className={chip(trackFilter === track.slug)}
              onClick={() => update('track', track.slug)}
            >
              <span aria-hidden="true">{track.icon}&nbsp;</span>
              {track.name}
            </button>
          ))}
        </div>
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          {shown === 0 ? 'Nothing matches that filter.' : `Showing ${shown} cheat sheets`}
        </p>
      </div>

      {visibleGroups.map(({ track, sheets: trackSheets }) => (
        <section key={track.slug} aria-labelledby={`sheets-${track.slug}`} className="mt-8">
          <h2 id={`sheets-${track.slug}`} className="text-xl font-bold">
            <span aria-hidden="true">{track.icon} </span>
            {track.name}
          </h2>
          <div className="mt-3 space-y-4">
            {trackSheets.map((entry) => (
              <section
                key={entry.slug}
                aria-label={entry.title}
                className="defer-render break-inside-avoid rounded-xl border [contain-intrinsic-size:auto_320px] border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <h3 className="font-semibold">
                  <Link
                    to={`/track/${entry.track}/${entry.slug}`}
                    className="text-brand-700 underline underline-offset-2 hover:decoration-2 dark:text-brand-300"
                  >
                    {entry.title}
                  </Link>
                  <span className="ml-2 text-sm font-normal text-slate-600 dark:text-slate-400">
                    {entry.module}
                  </span>
                </h3>
                {entry.sheet.rows.length > 0 && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                      <thead>
                        <tr>
                          {entry.sheet.headers.map((header, index) => (
                            <th
                              key={index}
                              scope="col"
                              className="border-b border-slate-300 px-2 py-1.5 font-semibold dark:border-slate-700"
                            >
                              <InlineMarkdown text={header} />
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {entry.sheet.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="align-top">
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="border-b border-slate-100 px-2 py-1.5 dark:border-slate-800"
                              >
                                <InlineMarkdown text={cell} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {entry.sheet.notes.map((note, index) => (
                  <p key={index} className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    <InlineMarkdown text={note} />
                  </p>
                ))}
              </section>
            ))}
          </div>
        </section>
      ))}
      {limit < shown && (
        <div ref={end} className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">
          Loading more cheat sheets…
        </div>
      )}
    </div>
  );
}
