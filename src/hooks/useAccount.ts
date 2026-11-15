import { useSyncExternalStore } from 'react';
import { getAccountState, subscribeAccount, type AccountState } from '../utils/cloudSync';

/** Who is logged in (or guest) and whether progress is saved online. */
export function useAccount(): AccountState {
  return useSyncExternalStore(subscribeAccount, getAccountState, getAccountState);
}
