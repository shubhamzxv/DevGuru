import { Link } from 'react-router-dom';
import ProgressRing from '../components/layout/ProgressRing';
import { TRACKS } from '../registry/tracks';

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl">
      <section className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-800 px-5 py-8 text-white sm:px-8 sm:py-12">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-100">
          Learn by doing
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Tech, explained the simple way
        </h1>
        <p className="mt-3 max-w-xl text-base text-brand-50 sm:text-lg">
          Every topic has a real-life example, clear code, and a playground where you run Python and
          SQL right here in your browser. No install. No login.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/track/python"
            className="tap rounded-xl bg-white px-5 py-3 font-semibold text-brand-700 hover:bg-brand-50"
          >
            Start with Python
          </Link>
          <Link
            to="/playground/python"
            className="tap rounded-xl border border-white/50 px-5 py-3 font-semibold text-white hover:bg-white/10"
          >
            Open playground
          </Link>
        </div>
      </section>

      <section aria-labelledby="continue-heading" className="mt-8">
        <h2 id="continue-heading" className="text-lg font-bold">
          Continue learning
        </h2>
        <p className="mt-2 rounded-xl border border-slate-200 bg-white p-4 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          You have not started a topic yet. Pick a track below to begin.
        </p>
      </section>

      <section aria-labelledby="tracks-heading" className="mt-8">
        <h2 id="tracks-heading" className="text-lg font-bold">
          All tracks
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TRACKS.map((track) => (
            <li key={track.slug}>
              <Link
                to={`/track/${track.slug}`}
                className="flex h-full min-h-20 items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 hover:border-brand-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500"
              >
                <span aria-hidden="true" className="text-3xl">
                  {track.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{track.name}</span>
                  <span className="block text-sm text-slate-600 dark:text-slate-400">
                    {track.tagline}
                  </span>
                </span>
                {/* Real progress is wired up in Step 6 */}
                <ProgressRing percent={0} label={track.name} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
