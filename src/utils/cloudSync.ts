import { CLOUD_SYNC_ENABLED, PROGRESS_BASE_URL, PROGRESS_PREFIX } from '../config/cloud';
import { identityKey, parseIdentity, type Identity } from './identity';
import { isEmptyProgress, mergeProgress, sameProgress } from './mergeProgress';
import { EMPTY_DATA, getData, migrate, replaceData, subscribeData, type AppData } from './storage';

/**
 * Login without a backend: the learner's progress is one JSON file in a public S3
 * bucket, named by a hash of their phone number or username (see identity.ts).
 * GET reads it, PUT saves it. Guests (not logged in) work exactly as before.
 *
 * Sync rule (last writer wins, merge only on a real conflict):
 * - changes on this device ("dirty")      → upload
 * - file changed since our last sync      → download
 * - both                                  → merge, upload
 */

export const ACCOUNT_STORAGE_KEY = 'devguru-account';
const SAVE_DELAY_MS = 2000;
const PULL_INTERVAL_MS = 15000;
const RETRY_MS = 30000;

interface StoredAccount {
  key: string;
  label: string;
  /** updatedAt of the online file the last time this device synced. */
  remoteUpdatedAt: string | null;
  /** This device has changes that are not online yet. */
  dirty: boolean;
  lastSyncedAt: number | null;
}

export type SyncStatus = 'guest' | 'syncing' | 'saved' | 'pending' | 'offline' | 'error';

export interface AccountState {
  label: string | null;
  status: SyncStatus;
  /** Shown under the status, for example the reason a save failed. */
  message: string | null;
  lastSyncedAt: number | null;
}

/** What is stored in S3. No phone number or username is stored inside. */
interface ProgressFile {
  app: 'devguru';
  format: 1;
  updatedAt: string;
  data: AppData;
}

// ---------------- state ----------------

let account: StoredAccount | null = readAccount();
let state: AccountState = stateFor(
  account,
  account ? (account.dirty ? 'pending' : 'saved') : 'guest',
);
const listeners = new Set<() => void>();
let applyingRemote = false;
let changeCounter = 0;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
let again = false;
let lastPull = 0;

function readAccount(): StoredAccount | null {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNT_STORAGE_KEY) ?? 'null') as unknown;
    if (raw && typeof raw === 'object' && typeof (raw as StoredAccount).key === 'string') {
      const a = raw as StoredAccount;
      return {
        key: a.key,
        label: String(a.label ?? ''),
        remoteUpdatedAt: typeof a.remoteUpdatedAt === 'string' ? a.remoteUpdatedAt : null,
        dirty: Boolean(a.dirty),
        lastSyncedAt: typeof a.lastSyncedAt === 'number' ? a.lastSyncedAt : null,
      };
    }
  } catch {
    // broken JSON or storage blocked: guest
  }
  return null;
}

function writeAccount(next: StoredAccount | null): void {
  account = next;
  try {
    if (next) localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(ACCOUNT_STORAGE_KEY);
  } catch {
    // storage blocked: keep it for this visit
  }
}

function stateFor(
  a: StoredAccount | null,
  status: SyncStatus,
  message: string | null = null,
): AccountState {
  return {
    label: a?.label ?? null,
    status: a ? status : 'guest',
    message,
    lastSyncedAt: a?.lastSyncedAt ?? null,
  };
}

function setState(status: SyncStatus, message: string | null = null): void {
  state = stateFor(account, status, message);
  listeners.forEach((listener) => listener());
}

export function getAccountState(): AccountState {
  return state;
}

export function subscribeAccount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Puts progress from online into this device without marking it as a local change. */
function applyRemote(data: AppData): void {
  applyingRemote = true;
  try {
    replaceData(data);
  } finally {
    applyingRemote = false;
  }
}

// ---------------- S3 ----------------

export function progressUrl(key: string): string {
  return `${PROGRESS_BASE_URL}/${PROGRESS_PREFIX}${key}.json`;
}

/** The online file, or null if there is none yet. Throws on network problems. */
export async function fetchProgress(key: string): Promise<ProgressFile | null> {
  const response = await fetch(progressUrl(key), { cache: 'no-store' });
  // Without list permission, S3 answers 403 (not 404) for a file that does not exist.
  if (response.status === 404 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Could not read progress (HTTP ${response.status}).`);
  const raw = (await response.json().catch(() => null)) as Partial<ProgressFile> | null;
  if (!raw || raw.app !== 'devguru') return null;
  return {
    app: 'devguru',
    format: 1,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
    data: migrate(raw.data),
  };
}

export async function uploadProgress(key: string, data: AppData): Promise<string> {
  const updatedAt = new Date().toISOString();
  const file: ProgressFile = { app: 'devguru', format: 1, updatedAt, data };
  const response = await fetch(progressUrl(key), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(file),
  });
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? 'The progress store refused the save (HTTP 403). Check the S3 bucket policy and CORS.'
        : `Could not save progress (HTTP ${response.status}).`,
    );
  }
  return updatedAt;
}

// ---------------- sync ----------------

function errorMessage(error: unknown): { status: SyncStatus; message: string } {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      status: 'offline',
      message: 'You are offline. Changes will be saved when you are back online.',
    };
  }
  const text = error instanceof Error ? error.message : String(error);
  return {
    status: 'error',
    message: /fetch|network/i.test(text)
      ? 'Could not reach the progress store. Will try again.'
      : text,
  };
}

/** Upload and/or download now. Safe to call often: runs one at a time. */
export function syncNow(): Promise<void> {
  if (!CLOUD_SYNC_ENABLED || !account) return Promise.resolve();
  if (inFlight) {
    again = true;
    return inFlight;
  }
  inFlight = (async () => {
    const current = account!;
    const startCount = changeCounter;
    setState('syncing');
    try {
      const remote = await fetchProgress(current.key);
      if (account?.key !== current.key) return; // logged out meanwhile
      const local = getData();
      const remoteChanged = remote !== null && remote.updatedAt !== current.remoteUpdatedAt;
      let remoteUpdatedAt = current.remoteUpdatedAt;

      if (current.dirty || remote === null) {
        const next = remote && remoteChanged ? mergeProgress(remote.data, local) : local;
        if (!sameProgress(next, local)) applyRemote(next);
        remoteUpdatedAt = await uploadProgress(current.key, next);
      } else if (remoteChanged) {
        applyRemote(remote.data);
        remoteUpdatedAt = remote.updatedAt;
      }

      lastPull = Date.now();
      writeAccount({
        ...current,
        remoteUpdatedAt,
        dirty: changeCounter !== startCount, // changed again while saving
        lastSyncedAt: Date.now(),
      });
      setState(account?.dirty ? 'pending' : 'saved');
    } catch (error) {
      const { status, message } = errorMessage(error);
      setState(status, message);
      // Try again later (also on the "online" event and when the tab is shown again).
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void syncNow();
      }, RETRY_MS);
    } finally {
      inFlight = null;
      if (again) {
        again = false;
        void syncNow();
      } else if (account?.dirty && state.status === 'pending') {
        scheduleSave();
      }
    }
  })();
  return inFlight;
}

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void syncNow();
  }, SAVE_DELAY_MS);
}

/** A progress change on this device (mark complete, quiz, bookmark...). */
function onLocalChange(): void {
  if (applyingRemote || !account) return;
  changeCounter += 1;
  if (!account.dirty) writeAccount({ ...account, dirty: true });
  if (state.status !== 'syncing') setState('pending');
  scheduleSave();
}

// ---------------- login / logout ----------------

export interface LoginResult {
  ok: boolean;
  error?: string;
  /** No file online yet: a new profile was created. */
  created?: boolean;
  /** Guest progress on this device was combined with the online progress. */
  merged?: boolean;
  completed?: number;
}

export async function login(input: string): Promise<LoginResult> {
  if (!CLOUD_SYNC_ENABLED) return { ok: false, error: 'Saving progress online is turned off.' };
  const parsed = parseIdentity(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const identity: Identity = parsed.identity;

  let remote: ProgressFile | null;
  const key = await identityKey(identity);
  try {
    remote = await fetchProgress(key);
  } catch (error) {
    return { ok: false, error: errorMessage(error).message };
  }

  const guest = getData();
  const hasGuest = !isEmptyProgress(guest);
  const data = remote ? (hasGuest ? mergeProgress(remote.data, guest) : remote.data) : guest;
  applyRemote(data);
  writeAccount({
    key,
    label: identity.label,
    remoteUpdatedAt: remote?.updatedAt ?? null,
    dirty: remote === null || !sameProgress(data, remote.data),
    lastSyncedAt: remote ? Date.now() : null,
  });
  setState(account!.dirty ? 'pending' : 'saved');
  if (account!.dirty) await syncNow();

  return {
    ok: true,
    created: remote === null,
    merged: remote !== null && hasGuest && !sameProgress(data, remote.data),
    completed: data.completed.length,
  };
}

/**
 * Back to guest mode. Unsaved changes are uploaded first. The progress stays online;
 * this device starts empty so the next person does not see it.
 * Returns false (and stays logged in) if unsaved changes could not be uploaded,
 * unless `force` is true.
 */
export async function logout(force = false): Promise<boolean> {
  if (!account) return true;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (account.dirty) {
    await syncNow();
    if (account?.dirty && !force) return false;
  }
  writeAccount(null);
  applyRemote(EMPTY_DATA);
  setState('guest');
  return true;
}

// ---------------- start ----------------

let started = false;

/** Call once at app start. Keeps a logged-in device in step with the online copy. */
export function startCloudSync(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  subscribeData(onLocalChange);
  const pull = () => {
    if (
      account &&
      document.visibilityState === 'visible' &&
      Date.now() - lastPull > PULL_INTERVAL_MS
    ) {
      void syncNow();
    }
  };
  document.addEventListener('visibilitychange', pull);
  window.addEventListener('focus', pull);
  window.addEventListener('online', () => void syncNow());
  // Logged in or out in another tab.
  window.addEventListener('storage', (event) => {
    if (event.key === ACCOUNT_STORAGE_KEY) {
      account = readAccount();
      setState(account ? (account.dirty ? 'pending' : 'saved') : 'guest');
    }
  });
  if (account) void syncNow();
}

/** For tests: forget in-memory state. */
export function resetCloudSyncForTests(): void {
  account = readAccount();
  state = stateFor(account, account ? (account.dirty ? 'pending' : 'saved') : 'guest');
  changeCounter = 0;
  inFlight = null;
  again = false;
  lastPull = 0;
  if (saveTimer) clearTimeout(saveTimer);
  if (retryTimer) clearTimeout(retryTimer);
  saveTimer = null;
  retryTimer = null;
}

export { onLocalChange as handleLocalChangeForTests };
