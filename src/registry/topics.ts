import type { MDXContent } from 'mdx/types';
import type { TopicRef, Track } from './tracks';

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
