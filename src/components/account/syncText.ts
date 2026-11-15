import type { AccountState } from '../../utils/cloudSync';

function ago(time: number): string {
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(time).toLocaleDateString('en-IN');
}

/** One short line about where the progress is saved. */
export function syncText(state: AccountState): string {
  switch (state.status) {
    case 'guest':
      return 'Guest: progress is saved on this device only.';
    case 'syncing':
      return 'Saving…';
    case 'pending':
      return 'Changes will be saved in a moment.';
    case 'saved':
      return state.lastSyncedAt ? `Saved online ${ago(state.lastSyncedAt)}.` : 'Saved online.';
    case 'offline':
    case 'error':
      return state.message ?? 'Not saved online yet.';
  }
}
