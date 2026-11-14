import { useSyncExternalStore } from 'react';
import { EMPTY_DATA, getData, subscribeData, type AppData } from '../utils/storage';

/** Live view of the learner's saved data (completed topics, quiz scores, ...). */
export function useProgress(): AppData {
  return useSyncExternalStore(subscribeData, getData, () => EMPTY_DATA);
}
