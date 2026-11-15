import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import ProgressRing from '../components/layout/ProgressRing';
import { useProgress } from '../hooks/useProgress';
import { nextTopicToLearn, resolveTopicKey, topicKey, writtenTopics } from '../registry/topics';
import { TRACKS } from '../registry/tracks';
import { migrate, replaceData, resetData, toggleBookmark, type AppData } from '../utils/storage';

const card =
  'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900';
const button =
  'tap rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800';

function percent(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className={card}>
      <p className="text-sm text-slate-600 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {note && <p className="text-xs text-slate-500 dark:text-slate-400">{note}</p>}
    </div>
  );
}

function downloadBackup(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `devguru-progress-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ProgressPage() {
  const progress = useProgress();
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'My progress | DevGuru';
    return () => {
      document.title = 'DevGuru – Learn tech the simple way';
    };
  }, []);

  const tracks = TRACKS.map((track) => {
    const available = writtenTopics(track);
    const done = available.filter((topic) =>
      progress.completed.includes(topicKey(track.slug, topic.id)),
    ).length;
    return { track, available: available.length, done };
  });
  const totalAvailable = tracks.reduce((sum, t) => sum + t.available, 0);
  const totalDone = tracks.reduce((sum, t) => sum + t.done, 0);

  const quizzes = Object.entries(progress.quizScores)
    .flatMap(([key, score]) => {
      const topic = resolveTopicKey(key);
      return topic ? [{ key, score, topic }] : []; // skip topics that no longer exist
    })
    .sort((a, b) => percent(a.score.score, a.score.total) - percent(b.score.score, b.score.total));
  const quizAverage =
    quizzes.length > 0
      ? Math.round(
          quizzes.reduce((sum, q) => sum + percent(q.score.score, q.score.total), 0) /
            quizzes.length,
        )
      : null;

  const bookmarks = progress.bookmarks.flatMap((key) => {
    const topic = resolveTopicKey(key);
    return topic ? [{ key, topic }] : [];
  });

  const next = nextTopicToLearn(progress.lastVisited?.path, progress.completed);

  const restore = async (file: File) => {
    try {
      const restored = migrate(JSON.parse(await file.text()));
      replaceData(restored);
      setMessage(`Progress restored: ${restored.completed.length} completed topics.`);
    } catch {
      setMessage('That file is not a DevGuru progress backup.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">My progress</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-300">
        Saved in this browser only. No account needed.
      </p>

      <section aria-label="Summary" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Topics completed"
          value={`${totalDone} / ${totalAvailable}`}
          note={`${percent(totalDone, totalAvailable)}% of written topics`}
        />
        <Stat label="Quizzes taken" value={quizzes.length} />
        <Stat label="Average quiz score" value={quizAverage === null ? '–' : `${quizAverage}%`} />
        <Stat label="Bookmarks" value={bookmarks.length} />
      </section>

      <section aria-labelledby="continue-heading" className="mt-8">
        <h2 id="continue-heading" className="text-lg font-bold">
          Continue where you left off
        </h2>
        {progress.lastVisited ? (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Link to={progress.lastVisited.path} className={`${card} block hover:border-brand-400`}>
              <span className="block text-sm text-slate-500 dark:text-slate-400">Last opened</span>
              <span className="font-semibold">{progress.lastVisited.title}</span>
            </Link>
            {next && (
              <Link to={next.path} className={`${card} block hover:border-brand-400`}>
                <span className="block text-sm text-slate-500 dark:text-slate-400">
                  Next not completed
                </span>
                <span className="font-semibold">{next.title}</span>
              </Link>
            )}
          </div>
        ) : (
          <p className={`${card} mt-2 text-slate-600 dark:text-slate-300`}>
            You have not opened a topic yet.{' '}
            <Link
              to="/track/python"
              className="font-semibold text-brand-700 underline dark:text-brand-300"
            >
              Start with Python
            </Link>
            .
          </p>
        )}
      </section>

      <section aria-labelledby="tracks-heading" className="mt-8">
        <h2 id="tracks-heading" className="text-lg font-bold">
          Tracks
        </h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {tracks.map(({ track, available, done }) => (
            <li key={track.slug}>
              <Link
                to={`/track/${track.slug}`}
                className={`${card} flex min-h-20 items-center gap-4 hover:border-brand-400`}
              >
                <span aria-hidden="true" className="text-2xl">
                  {track.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{track.name}</span>
                  <span className="block text-sm text-slate-600 dark:text-slate-400">
                    {available === 0 ? 'Coming soon' : `${done} of ${available} topics done`}
                  </span>
                </span>
                <ProgressRing percent={percent(done, available)} label={track.name} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="quiz-heading" className="mt-8">
        <h2 id="quiz-heading" className="text-lg font-bold">
          Quiz scores
        </h2>
        {quizzes.length === 0 ? (
          <p className={`${card} mt-2 text-slate-600 dark:text-slate-300`}>
            Finish the quick quiz at the end of a topic to see your score here.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Lowest scores first, so you know what to revise.
            </p>
            <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {quizzes.map(({ key, score, topic }) => {
                const value = percent(score.score, score.total);
                return (
                  <li
                    key={key}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
                  >
                    <Link
                      to={topic.path}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {topic.title}
                      <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                        {topic.trackName}
                      </span>
                    </Link>
                    <span className="flex shrink-0 items-center gap-2 text-sm">
                      {value < 60 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                          Revise
                        </span>
                      )}
                      <span className="font-semibold">
                        {score.score} / {score.total}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="bookmarks-heading" className="mt-8">
        <h2 id="bookmarks-heading" className="text-lg font-bold">
          Bookmarks
        </h2>
        {bookmarks.length === 0 ? (
          <p className={`${card} mt-2 text-slate-600 dark:text-slate-300`}>
            Tap <strong>Bookmark</strong> on any topic to keep it here.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {bookmarks.map(({ key, topic }) => (
              <li key={key} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                <Link to={topic.path} className="font-medium underline-offset-2 hover:underline">
                  {topic.title}
                  <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                    {topic.trackName}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => toggleBookmark(key)}
                  aria-label={`Remove bookmark: ${topic.title}`}
                  className={button}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="data-heading" className="mt-8">
        <h2 id="data-heading" className="text-lg font-bold">
          Your data
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Move your progress to another browser or phone with a backup file.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={button} onClick={() => downloadBackup(progress)}>
            Download backup
          </button>
          <button type="button" className={button} onClick={() => fileInput.current?.click()}>
            Restore from backup
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void restore(file);
              event.target.value = '';
            }}
          />
          {confirmReset ? (
            <>
              <button
                type="button"
                className="tap rounded-lg bg-red-600 px-4 font-semibold text-white hover:bg-red-700"
                onClick={() => {
                  resetData();
                  setConfirmReset(false);
                  setMessage('All progress was cleared.');
                }}
              >
                Yes, clear everything
              </button>
              <button type="button" className={button} onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              className={`${button} text-red-700 dark:text-red-400`}
              onClick={() => setConfirmReset(true)}
            >
              Reset progress
            </button>
          )}
        </div>
        <p role="status" className="mt-2 text-sm font-medium">
          {message}
        </p>
      </section>
    </div>
  );
}
