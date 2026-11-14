import { useCallback, useEffect, useState } from 'react';
import type { TopicLoader, TopicModule } from '../registry/topics';

type TopicState =
  { status: 'loading' } | { status: 'ready'; module: TopicModule } | { status: 'error' };

/** Downloads one topic's MDX file. `retry` is for a failed download (offline, etc.). */
export function useTopic(loader: TopicLoader): { state: TopicState; retry: () => void } {
  const [state, setState] = useState<TopicState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loader()
      .then((module) => {
        if (!cancelled) setState({ status: 'ready', module });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [loader, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
