import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { counts, loaders } from 'virtual:devguru-interview';
import CodeBlock from '../components/content/CodeBlock';
import InlineMarkdown from '../components/content/InlineMarkdown';
import type { InterviewEntry, InterviewItem } from '../build/contentIndex';
import { TRACKS, type Track } from '../registry/tracks';

/** Tracks that have at least one interview question, in sidebar order. */
const tracksWithQuestions = TRACKS.filter((track) => (counts[track.slug] ?? 0) > 0);
const totalQuestions = tracksWithQuestions.reduce((sum, t) => sum + (counts[t.slug] ?? 0), 0);
const ALL = 'all';

/** Topics drawn at first, and how many more each time the reader nears the end. */
const BATCH = 10;

const chip = (active: boolean) =>
  `tap shrink-0 rounded-full border px-4 text-sm font-medium ${
    active
      ? 'border-brand-600 bg-brand-600 text-white'
      : 'border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800'
  }`;

const button =
  'tap rounded-lg border border-slate-300 px-4 text-sm font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800';

/** Loaded track data stays in memory, so switching chips back is instant. */
const cache = new Map<string, InterviewEntry[]>();

function useTrackData(slugs: string[]): InterviewEntry[] | null {
  const key = slugs.join(',');
  const [data, setData] = useState<InterviewEntry[] | null>(() =>
    slugs.every((s) => cache.has(s)) ? slugs.flatMap((s) => cache.get(s) ?? []) : null,
  );
  useEffect(() => {
    let alive = true;
    const list = key ? key.split(',') : [];
    if (list.every((s) => cache.has(s))) {
      setData(list.flatMap((s) => cache.get(s) ?? []));
      return;
    }
    setData(null);
    Promise.all(
      list.map(async (slug) => {
        if (!cache.has(slug)) cache.set(slug, (await loaders[slug]!()).default);
        return cache.get(slug) ?? [];
      }),
    )
      .then((parts) => alive && setData(parts.flat()))
      .catch(() => alive && setData([]));
    return () => {
      alive = false;
    };
  }, [key]);
  return data;
}

function answerText(item: InterviewItem): string {
  return item.answer.map((block) => (block.kind === 'text' ? block.text : block.code)).join(' ');
}

/** Keeps the questions whose question or answer has every filter word. */
function filterEntry(entry: InterviewEntry, words: string[]): InterviewEntry | null {
  if (words.length === 0) return entry;
  const has = (text: string) => words.every((word) => text.toLowerCase().includes(word));
  if (has(`${entry.title} ${entry.module}`)) return entry; // whole topic matches by name
  const items = entry.items.filter((item) => has(`${item.q} ${answerText(item)}`));
  return items.length > 0 ? { ...entry, items } : null;
}

const questionId = (entry: InterviewEntry, index: number) =>
  `iq-${entry.track}-${entry.slug}-${index}`;

/** One question. The answer is built only when it is opened, to keep long lists light. */
function Question({
  item,
  id,
  number,
  initiallyOpen,
}: {
  item: InterviewItem;
  id: string;
  number: number;
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details
      id={id}
      open={initiallyOpen}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group scroll-mt-20 break-inside-avoid rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 font-medium [&::-webkit-details-marker]:hidden">
        <span>
          <span className="mr-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
            Q{number}.
          </span>
          {item.q}
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-slate-600 transition-transform group-open:rotate-180 dark:text-slate-400"
        >
          ▾
        </span>
      </summary>
      {open && (
        <div className="space-y-3 border-t border-slate-200 px-4 py-3 leading-relaxed text-slate-800 dark:border-slate-700 dark:text-slate-200">
          {item.answer.map((block, index) =>
            block.kind === 'text' ? (
              <p key={index}>
                <InlineMarkdown text={block.text} />
              </p>
            ) : (
              <CodeBlock key={index} code={block.code} language={block.language} />
            ),
          )}
        </div>
      )}
    </details>
  );
}

export default function InterviewPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('track') ?? '';
  const trackFilter =
    requested === ALL || tracksWithQuestions.some((t) => t.slug === requested)
      ? requested
      : (tracksWithQuestions[0]?.slug ?? ALL);
  const text = params.get('q') ?? '';

  useEffect(() => {
    document.title = 'Interview questions | DevGuru';
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

  const selected: Track[] =
    trackFilter === ALL
      ? tracksWithQuestions
      : tracksWithQuestions.filter((t) => t.slug === trackFilter);
  const data = useTrackData(selected.map((t) => t.slug));

  const groups = useMemo(() => {
    if (!data) return [];
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    return selected
      .map((track) => {
        let number = 0;
        const entries = data
          .filter((e) => e.track === track.slug)
          .map((e) => filterEntry(e, words))
          .filter((e): e is InterviewEntry => e !== null)
          .map((entry) => ({
            entry,
            numbers: entry.items.map(() => ++number),
          }));
        return { track, entries };
      })
      .filter((group) => group.entries.length > 0);
    // selected is derived from trackFilter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, text, trackFilter]);

  const topicsShown = groups.reduce((sum, g) => sum + g.entries.length, 0);
  const questionsShown = groups.reduce(
    (sum, g) => sum + g.entries.reduce((s, e) => s + e.entry.items.length, 0),
    0,
  );

  // "Show all answers" re-creates the questions open (or closed) via a new key.
  const [allOpen, setAllOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const setEveryAnswer = (open: boolean) => {
    setFocusId(null);
    setAllOpen(open);
    setVersion((v) => v + 1);
  };

  // Draw a few topics, and more when the reader scrolls near the end.
  const [limit, setLimit] = useState(BATCH);
  useEffect(() => {
    setLimit(BATCH);
    setFocusId(null);
  }, [text, trackFilter]);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = end.current;
    if (limit >= topicsShown) return;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setLimit(topicsShown);
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
  }, [limit, topicsShown]);

  // Printing includes every question with its answer.
  useEffect(() => {
    const showAll = () =>
      flushSync(() => {
        setLimit(Number.POSITIVE_INFINITY);
        setAllOpen(true);
        setVersion((v) => v + 1);
      });
    window.addEventListener('beforeprint', showAll);
    return () => window.removeEventListener('beforeprint', showAll);
  }, []);

  const randomQuestion = () => {
    const all = groups.flatMap((g) =>
      g.entries.flatMap(({ entry }) => entry.items.map((_, i) => questionId(entry, i))),
    );
    if (all.length === 0) return;
    const id = all[Math.floor(Math.random() * all.length)]!;
    flushSync(() => {
      setLimit(Number.POSITIVE_INFINITY);
      setAllOpen(false);
      setFocusId(id);
      setVersion((v) => v + 1);
    });
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    element?.querySelector('summary')?.focus({ preventScroll: true });
  };

  let budget = limit;
  const visibleGroups = groups
    .map((group) => {
      const take = group.entries.slice(0, Math.max(0, budget));
      budget -= take.length;
      return { ...group, entries: take };
    })
    .filter((group) => group.entries.length > 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Interview questions
          </h1>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            {totalQuestions.toLocaleString('en-IN')} questions with answers from every topic. Pick a
            stack, think of your answer, then open the card to check it.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3 print:hidden">
        <label htmlFor="interview-filter" className="sr-only">
          Filter interview questions
        </label>
        <input
          id="interview-filter"
          type="search"
          value={text}
          onChange={(event) => update('q', event.target.value)}
          placeholder="Filter, for example “index” or “decorator”"
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900"
        />
        <div role="group" aria-label="Choose a stack" className="flex gap-2 overflow-x-auto pb-1">
          {tracksWithQuestions.map((track) => (
            <button
              key={track.slug}
              type="button"
              aria-pressed={trackFilter === track.slug}
              className={chip(trackFilter === track.slug)}
              onClick={() => update('track', track.slug)}
            >
              <span aria-hidden="true">{track.icon}&nbsp;</span>
              {track.name}
              <span className="ml-1.5 opacity-75">{counts[track.slug]}</span>
            </button>
          ))}
          <button
            type="button"
            aria-pressed={trackFilter === ALL}
            className={chip(trackFilter === ALL)}
            onClick={() => update('track', ALL)}
          >
            All stacks
            <span className="ml-1.5 opacity-75">{totalQuestions.toLocaleString('en-IN')}</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} onClick={() => setEveryAnswer(!allOpen)}>
            {allOpen ? 'Hide all answers' : 'Show all answers'}
          </button>
          <button type="button" className={button} onClick={randomQuestion}>
            🎲 Random question
          </button>
          <button
            type="button"
            className={button}
            onClick={() => {
              flushSync(() => {
                setLimit(Number.POSITIVE_INFINITY);
                setAllOpen(true);
                setVersion((v) => v + 1);
              });
              window.print();
            }}
          >
            Print / save as PDF
          </button>
        </div>
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          {data === null
            ? 'Loading questions…'
            : questionsShown === 0
              ? 'Nothing matches that filter.'
              : `Showing ${questionsShown.toLocaleString('en-IN')} questions from ${topicsShown} topics`}
        </p>
      </div>

      {visibleGroups.map(({ track, entries }) => (
        <section key={track.slug} aria-labelledby={`iq-${track.slug}`} className="mt-8">
          <h2 id={`iq-${track.slug}`} className="text-xl font-bold">
            <span aria-hidden="true">{track.icon} </span>
            {track.name} interview questions
          </h2>
          <div className="mt-3 space-y-6">
            {entries.map(({ entry, numbers }) => (
              <section
                key={entry.slug}
                aria-label={entry.title}
                className="defer-render [contain-intrinsic-size:auto_360px]"
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
                <div className="mt-2 space-y-2">
                  {entry.items.map((item, index) => {
                    const id = questionId(entry, index);
                    return (
                      <Question
                        key={`${id}-${version}`}
                        id={id}
                        item={item}
                        number={numbers[index] ?? index + 1}
                        initiallyOpen={allOpen || focusId === id}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </section>
      ))}
      {limit < topicsShown && (
        <div ref={end} className="py-8 text-center text-sm text-slate-600 dark:text-slate-400">
          Loading more questions…
        </div>
      )}
    </div>
  );
}
