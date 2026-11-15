import { useEffect, useState } from 'react';

/** Play / pause / step through a list of recorded frames. */
export function useFramePlayer(count: number, delayMs = 700) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = Math.max(0, count - 1);
  const atEnd = index >= last;

  useEffect(() => {
    if (!playing) return;
    if (atEnd) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex((i) => i + 1), delayMs);
    return () => window.clearTimeout(timer);
  }, [playing, index, atEnd, delayMs]);

  return {
    index: Math.min(index, last),
    playing,
    atEnd,
    toggle: () => {
      if (atEnd) setIndex(0);
      setPlaying((p) => !p || atEnd);
    },
    next: () => setIndex((i) => Math.min(last, i + 1)),
    back: () => setIndex((i) => Math.max(0, i - 1)),
    reset: () => {
      setPlaying(false);
      setIndex(0);
    },
  };
}

export type FramePlayer = ReturnType<typeof useFramePlayer>;
