import type { MDXContent } from 'mdx/types';
import { getTrack, TRACKS, type TopicRef, type Track } from './tracks';

/** The block between --- lines at the top of every topic MDX file. */
export interface TopicFrontmatter {
  /** Must match the id in index.json. */
  id: string;
  title: string;
  /** One sentence: what it is. */
  summary: string;
  /** YYYY-MM-DD. Change it whenever the content changes. */
  updated: string;
}

export interface TopicModule {
  default: MDXContent;
  frontmatter: TopicFrontmatter;
}

export type TopicLoader = () => Promise<TopicModule>;

// Lazy: each topic is downloaded only when someone opens it.
const loaders = import.meta.glob<TopicModule>('../content/*/*.mdx');

/** Returns undefined when the topic is in the syllabus but not written yet. */
export function getTopicLoader(trackSlug: string, topicSlug: string): TopicLoader | undefined {
  return loaders[`../content/${trackSlug}/${topicSlug}.mdx`];
}

export function isTopicWritten(trackSlug: string, topicSlug: string): boolean {
  return getTopicLoader(trackSlug, topicSlug) !== undefined;
}

/** Progress and quiz scores are saved against this key. */
export function topicKey(trackSlug: string, topicId: string): string {
  return `${trackSlug}/${topicId}`;
}

export function allTopics(track: Track): TopicRef[] {
  return track.modules.flatMap((module) => module.topics);
}

/** Topics that have an MDX file (the ones a learner can open today). */
export function writtenTopics(track: Track): TopicRef[] {
  return allTopics(track).filter((topic) => isTopicWritten(track.slug, topic.slug));
}

export interface TopicPosition {
  current: TopicRef;
  moduleTitle: string;
  /** Previous / next WRITTEN topic in syllabus order. */
  prev: TopicRef | undefined;
  next: TopicRef | undefined;
}

export function findTopic(track: Track, topicSlug: string): TopicPosition | undefined {
  const owner = track.modules.find((module) => module.topics.some((t) => t.slug === topicSlug));
  const current = owner?.topics.find((t) => t.slug === topicSlug);
  if (!owner || !current) return undefined;

  const written = writtenTopics(track);
  const index = written.findIndex((t) => t.slug === topicSlug);
  return {
    current,
    moduleTitle: owner.title,
    prev: index > 0 ? written[index - 1] : undefined,
    next: index >= 0 ? written[index + 1] : undefined,
  };
}

export interface ResolvedTopic {
  track: Track;
  topic: TopicRef;
  path: string;
  title: string;
  trackName: string;
}

/** Turns a saved key like "sql/sql-joins" back into a topic. undefined if it no longer exists. */
export function resolveTopicKey(key: string): ResolvedTopic | undefined {
  const slash = key.indexOf('/');
  const track = getTrack(key.slice(0, slash));
  const topic = track && allTopics(track).find((t) => t.id === key.slice(slash + 1));
  if (!track || !topic) return undefined;
  return {
    track,
    topic,
    path: `/track/${track.slug}/${topic.slug}`,
    title: topic.title,
    trackName: track.name,
  };
}

/**
 * The first written, not-completed topic after the one at `lastPath`
 * (wrapping round to the start of the same track).
 */
export function nextTopicToLearn(
  lastPath: string | undefined,
  completed: readonly string[],
): { path: string; title: string } | undefined {
  const match = /^\/track\/([^/]+)\/([^/]+)$/.exec(lastPath ?? '');
  const track = match ? getTrack(match[1]) : TRACKS[0];
  if (!track) return undefined;
  const written = writtenTopics(track);
  const start = match ? written.findIndex((t) => t.slug === match[2]) + 1 : 0;
  const ordered = [...written.slice(start), ...written.slice(0, start)];
  const next = ordered.find(
    (t) => t.slug !== match?.[2] && !completed.includes(topicKey(track.slug, t.id)),
  );
  return (
    next && { path: `/track/${track.slug}/${next.slug}`, title: `${track.name}: ${next.title}` }
  );
}
