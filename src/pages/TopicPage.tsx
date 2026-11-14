import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopicNav from '../components/content/TopicNav';
import { TopicContext } from '../components/content/topicContext';
import ComingSoon from '../components/layout/ComingSoon';
import { useProgress } from '../hooks/useProgress';
import { useTopic } from '../hooks/useTopic';
import { mdxComponents } from '../registry/mdxComponents';
import {
  findTopic,
  getTopicLoader,
  topicKey,
  type TopicLoader,
  type TopicPosition,
} from '../registry/topics';
import { getTrack, type Track } from '../registry/tracks';
import { setLastVisited, toggleComplete } from '../utils/storage';
import NotFound from './NotFound';

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function TopicPage() {
  const { tech, topic } = useParams();
  const track = getTrack(tech);
  const position = track && topic ? findTopic(track, topic) : undefined;
  if (!track || !topic || !position) return <NotFound />;

  const loader = getTopicLoader(track.slug, topic);
  if (!loader) {
    // In the syllabus, but the MDX file is not written yet.
    return (
      <ComingSoon title={position.current.title} step="a later content update">
        <p>This topic is planned but not written yet.</p>
        <p className="mt-3">
          <Link
            to={`/track/${track.slug}`}
            className="font-semibold text-brand-700 underline dark:text-brand-300"
          >
            Back to {track.name}
          </Link>
        </p>
      </ComingSoon>
    );
  }

  // key: start fresh (loading state, quiz answers) when moving to another topic
  return (
    <TopicView key={`${track.slug}/${topic}`} track={track} position={position} loader={loader} />
  );
}

interface TopicViewProps {
  track: Track;
  position: TopicPosition;
  loader: TopicLoader;
}

function TopicView({ track, position, loader }: TopicViewProps) {
  const { state, retry } = useTopic(loader);
  const progress = useProgress();
  const key = topicKey(track.slug, position.current.id);
  const path = `/track/${track.slug}/${position.current.slug}`;
  const title = position.current.title;

  useEffect(() => {
    document.title = `${title} – ${track.name} | DevGuru`;
    setLastVisited({ path, title: `${track.name}: ${title}` });
    // Leaving the topic: put the normal tab title back.
    return () => {
      document.title = 'DevGuru – Learn tech the simple way';
    };
  }, [path, title, track.name]);

  if (state.status === 'loading') {
    return (
      <p role="status" className="py-10 text-center text-slate-500 dark:text-slate-400">
        Loading topic…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="mx-auto max-w-xl py-10 text-center">
        <h1 className="text-xl font-bold">Could not load this topic</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Please check your internet connection and try again.
        </p>
        <button
          type="button"
          onClick={retry}
          className="tap mt-5 rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white hover:bg-brand-700"
        >
          Try again
        </button>
      </section>
    );
  }

  const { default: Content, frontmatter } = state.module;

  return (
    <article className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-600 dark:text-slate-400">
        <Link to={`/track/${track.slug}`} className="font-medium underline">
          {track.name}
        </Link>
        <span aria-hidden="true"> › </span>
        {position.moduleTitle}
      </nav>

      {/* Template block 1: title + one-line summary */}
      <header className="mt-2">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{frontmatter.title}</h1>
        <p className="mt-2 text-lg text-slate-700 dark:text-slate-300">{frontmatter.summary}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Last updated:{' '}
          <time dateTime={frontmatter.updated}>{formatDate(frontmatter.updated)}</time>
        </p>
      </header>

      {/* Template blocks 2 to 10 come from the MDX file */}
      <TopicContext.Provider value={key}>
        <Content components={mdxComponents} />
      </TopicContext.Provider>

      {/* Template block 11 */}
      <TopicNav
        trackSlug={track.slug}
        prev={position.prev}
        next={position.next}
        complete={progress.completed.includes(key)}
        onToggleComplete={() => toggleComplete(key)}
      />
    </article>
  );
}
