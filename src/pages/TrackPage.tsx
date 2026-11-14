import { Link, useParams } from 'react-router-dom';
import { useProgress } from '../hooks/useProgress';
import { isTopicWritten, topicKey, writtenTopics } from '../registry/topics';
import { getTrack } from '../registry/tracks';
import NotFound from './NotFound';

export default function TrackPage() {
  const { tech } = useParams();
  const track = getTrack(tech);
  const progress = useProgress();
  if (!track) return <NotFound />;

  const available = writtenTopics(track);
  const doneCount = available.filter((topic) =>
    progress.completed.includes(topicKey(track.slug, topic.id)),
  ).length;
  const percent = available.length ? Math.round((doneCount / available.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          <span aria-hidden="true">{track.icon} </span>
          {track.name}
        </h1>
        <p className="mt-1 text-slate-600 dark:text-slate-300">{track.tagline}</p>

        <div className="mt-4">
          <div
            role="progressbar"
            aria-label={`${track.name} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
          >
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {doneCount} of {available.length} topics complete
          </p>
        </div>
      </header>

      {track.modules.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          The syllabus for this track is added in Step 3.
        </p>
      )}

      {track.modules.map((module, moduleIndex) => (
        <section key={module.title} className="mt-8">
          <h2 className="text-lg font-bold">
            <span className="text-slate-500 dark:text-slate-400">{moduleIndex + 1}. </span>
            {module.title}
          </h2>
          <ol className="mt-3 space-y-2">
            {module.topics.map((topic) => {
              const done = progress.completed.includes(topicKey(track.slug, topic.id));
              const row =
                'flex min-h-12 items-center gap-3 rounded-xl border px-4 py-2 border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';

              if (!isTopicWritten(track.slug, topic.slug)) {
                return (
                  <li key={topic.id} className={`${row} text-slate-500 dark:text-slate-400`}>
                    <span aria-hidden="true" className="w-5 text-center">
                      ○
                    </span>
                    <span className="flex-1">{topic.title}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium dark:bg-slate-800">
                      Coming soon
                    </span>
                  </li>
                );
              }

              return (
                <li key={topic.id}>
                  <Link
                    to={`/track/${track.slug}/${topic.slug}`}
                    className={`${row} font-medium hover:border-brand-400 dark:hover:border-brand-500`}
                  >
                    <span
                      aria-hidden="true"
                      className={`w-5 text-center ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}
                    >
                      {done ? '✓' : '○'}
                    </span>
                    <span className="flex-1">{topic.title}</span>
                    {done && <span className="sr-only">(completed)</span>}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
