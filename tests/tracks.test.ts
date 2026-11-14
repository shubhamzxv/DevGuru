import { describe, expect, it } from 'vitest';
import { buildTracks, getTrack, TRACKS, type TrackIndex } from '../src/registry/tracks';

const sample = (name: string, order: number): TrackIndex => ({
  name,
  icon: '📘',
  tagline: '',
  order,
  playground: 'none',
  modules: [],
});

describe('buildTracks', () => {
  it('takes the slug from the folder name and sorts by order', () => {
    const tracks = buildTracks({
      '../content/sql/index.json': sample('SQL', 2),
      '../content/python/index.json': sample('Python', 1),
    });
    expect(tracks.map((t) => t.slug)).toEqual(['python', 'sql']);
  });
});

describe('track registry (real content folder)', () => {
  it('finds all 10 starting tracks, Python first', () => {
    expect(TRACKS).toHaveLength(10);
    expect(TRACKS[0]?.slug).toBe('python');
  });

  it('has unique order numbers and the required fields', () => {
    expect(new Set(TRACKS.map((t) => t.order)).size).toBe(TRACKS.length);
    for (const track of TRACKS) {
      expect(track.name).not.toBe('');
      expect(track.icon).not.toBe('');
      expect(Array.isArray(track.modules)).toBe(true);
    }
  });

  it('getTrack returns undefined for an unknown slug', () => {
    expect(getTrack('cobol')).toBeUndefined();
    expect(getTrack('aws')?.name).toBe('AWS');
  });
});
