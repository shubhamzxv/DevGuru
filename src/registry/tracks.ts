/**
 * Track registry.
 *
 * Every folder in src/content/ that has an index.json becomes a track
 * automatically. To add a new technology (for example Kubernetes):
 *   1. create src/content/kubernetes/index.json
 *   2. add MDX topic files next to it
 * No other code changes are needed: sidebar, home cards and routes update themselves.
 */

/** Which interactive tool the track uses on its topic pages. */
export type PlaygroundKind = 'python' | 'sql' | 'terminal' | 'git' | 'http' | 'diagram' | 'none';

export interface TopicRef {
  /** Stable id. Never change it: saved progress is stored against it. */
  id: string;
  /** Used in the URL and as the MDX file name: <slug>.mdx */
  slug: string;
  title: string;
}

export interface TrackModule {
  title: string;
  topics: TopicRef[];
}

/** Shape of src/content/<tech>/index.json */
export interface TrackIndex {
  name: string;
  icon: string;
  tagline: string;
  /** Position in lists (small number first). */
  order: number;
  playground: PlaygroundKind;
  modules: TrackModule[];
}

export interface Track extends TrackIndex {
  /** Folder name. Used in the URL: /track/<slug> */
  slug: string;
}

/** Turns { '../content/python/index.json': {...} } into a sorted list of tracks. */
export function buildTracks(files: Record<string, TrackIndex>): Track[] {
  return Object.entries(files)
    .map(([path, index]) => {
      const slug = path.split('/').slice(-2, -1)[0];
      if (!slug) throw new Error(`Cannot read track folder name from "${path}"`);
      return { ...index, slug };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

const indexFiles = import.meta.glob<TrackIndex>('../content/*/index.json', {
  eager: true,
  import: 'default',
});

export const TRACKS: readonly Track[] = buildTracks(indexFiles);

export function getTrack(slug: string | undefined): Track | undefined {
  return TRACKS.find((track) => track.slug === slug);
}
