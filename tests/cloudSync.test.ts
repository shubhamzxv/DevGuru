import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { identityKey, parseIdentity } from '../src/utils/identity';
import { mergeProgress } from '../src/utils/mergeProgress';
import { EMPTY_DATA, type AppData } from '../src/utils/storage';

// ---------- identity ----------

describe('parseIdentity', () => {
  it('treats the same Indian mobile number written differently as one person', async () => {
    const forms = [
      '9876543210',
      '+91 98765 43210',
      '098765-43210',
      '919876543210',
      '(+91) 98765 43210',
    ];
    const keys = new Set<string>();
    for (const form of forms) {
      const parsed = parseIdentity(form);
      expect(parsed.ok, form).toBe(true);
      if (parsed.ok) {
        expect(parsed.identity.value).toBe('919876543210');
        expect(parsed.identity.label).toBe('+91 ••••••3210');
        keys.add(await identityKey(parsed.identity));
      }
    }
    expect(keys.size).toBe(1);
  });

  it('accepts usernames case-insensitively and rejects bad input', () => {
    const a = parseIdentity('@Asha_K');
    expect(a.ok && a.identity).toEqual({ kind: 'username', value: 'asha_k', label: '@asha_k' });
    for (const bad of ['', 'ab', '1abc', 'has space', 'x'.repeat(31), '12345', 'a@b']) {
      expect(parseIdentity(bad).ok, bad).toBe(false);
    }
  });

  it('hashes to a 64-character key that never contains the phone number', async () => {
    const parsed = parseIdentity('9876543210');
    if (!parsed.ok) throw new Error('parse failed');
    const key = await identityKey(parsed.identity);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('9876543210');
    const other = parseIdentity('9876543211');
    if (!other.ok) throw new Error('parse failed');
    expect(await identityKey(other.identity)).not.toBe(key);
  });
});

describe('mergeProgress', () => {
  it('joins topics and bookmarks and keeps the better quiz score', () => {
    const online: AppData = {
      ...EMPTY_DATA,
      completed: ['python/lists', 'sql/joins'],
      quizScores: { 'python/lists': { score: 2, total: 3 }, 'sql/joins': { score: 3, total: 3 } },
      bookmarks: ['git/rebase'],
      lastVisited: { path: '/track/sql/joins', title: 'Joins' },
    };
    const device: AppData = {
      ...EMPTY_DATA,
      completed: ['sql/joins', 'aws/s3'],
      quizScores: { 'python/lists': { score: 3, total: 3 }, 'sql/joins': { score: 1, total: 3 } },
      bookmarks: [],
      lastVisited: { path: '/track/aws/s3', title: 'S3' },
    };
    expect(mergeProgress(online, device)).toEqual({
      ...EMPTY_DATA,
      completed: ['python/lists', 'sql/joins', 'aws/s3'],
      quizScores: { 'python/lists': { score: 3, total: 3 }, 'sql/joins': { score: 3, total: 3 } },
      bookmarks: ['git/rebase'],
      lastVisited: { path: '/track/aws/s3', title: 'S3' },
    });
  });
});

// ---------- sync engine against a fake S3 ----------

/** One browser: its own localStorage and its own copy of the modules. */
async function makeDevice(s3: Map<string, string>, calls: string[], failNetwork: { on: boolean }) {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (failNetwork.on) throw new TypeError('Failed to fetch');
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${url}`);
    if (method === 'PUT') {
      s3.set(url, String(init?.body));
      return new Response(null, { status: 200 });
    }
    const body = s3.get(url);
    // Like S3 without list permission: a missing file is 403.
    return body === undefined
      ? new Response('AccessDenied', { status: 403 })
      : new Response(body, { status: 200 });
  });
  vi.resetModules();
  const storage = await import('../src/utils/storage');
  const sync = await import('../src/utils/cloudSync');
  // Wire the change listener like startCloudSync() does.
  storage.subscribeData(sync.handleLocalChangeForTests);
  return { storage, sync, store };
}

describe('cloud sync', () => {
  let s3: Map<string, string>;
  let calls: string[];
  const network = { on: false };

  beforeEach(() => {
    s3 = new Map();
    calls = [];
    network.on = false;
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('guests never talk to S3', async () => {
    const { storage, sync } = await makeDevice(s3, calls, network);
    storage.toggleComplete('python/lists');
    await vi.advanceTimersByTimeAsync(5000);
    expect(sync.getAccountState().status).toBe('guest');
    expect(calls).toEqual([]);
  });

  it('a new user: guest progress is uploaded to a path-style URL, without the phone number', async () => {
    const { storage, sync } = await makeDevice(s3, calls, network);
    storage.toggleComplete('python/lists');
    const result = await sync.login('98765 43210');
    expect(result).toMatchObject({ ok: true, created: true });
    expect(sync.getAccountState()).toMatchObject({ status: 'saved', label: '+91 ••••••3210' });
    const [url, body] = [...s3.entries()][0]!;
    expect(url).toMatch(
      /^https:\/\/s3\.ap-south-1\.amazonaws\.com\/com\.shubham\.devguru\/progress\/[0-9a-f]{64}\.json$/,
    );
    expect(body).not.toContain('9876543210');
    expect(JSON.parse(body).data.completed).toEqual(['python/lists']);
  });

  it('second device: logging in loads the progress and adds its guest progress', async () => {
    const phone = await makeDevice(s3, calls, network);
    phone.storage.toggleComplete('python/lists');
    await phone.sync.login('asha_k');

    const laptop = await makeDevice(s3, calls, network);
    laptop.storage.toggleComplete('sql/joins'); // as a guest
    const result = await laptop.sync.login('ASHA_K');
    expect(result).toMatchObject({ ok: true, created: false, merged: true, completed: 2 });
    expect(laptop.storage.getData().completed).toEqual(['python/lists', 'sql/joins']);
    expect(JSON.parse([...s3.values()][0]!).data.completed).toEqual(['python/lists', 'sql/joins']);
  });

  it('changes are saved about 2 seconds after they happen', async () => {
    const { storage, sync } = await makeDevice(s3, calls, network);
    await sync.login('asha_k');
    calls.length = 0;
    storage.toggleComplete('aws/s3');
    storage.toggleBookmark('aws/s3');
    expect(sync.getAccountState().status).toBe('pending');
    await vi.advanceTimersByTimeAsync(2500);
    expect(calls.filter((c) => c.startsWith('PUT'))).toHaveLength(1); // both changes in one save
    expect(sync.getAccountState().status).toBe('saved');
    const saved = JSON.parse([...s3.values()][0]!).data as AppData;
    expect(saved.completed).toEqual(['aws/s3']);
    expect(saved.bookmarks).toEqual(['aws/s3']);
  });

  it('un-ticking a topic on one device is not undone by the other', async () => {
    const a = await makeDevice(s3, calls, network);
    a.storage.toggleComplete('python/lists');
    a.storage.toggleComplete('sql/joins');
    await a.sync.login('asha_k');
    const b = await makeDevice(s3, calls, network);
    await b.sync.login('asha_k'); // b has both topics

    // Back to device A (each device keeps its own modules; point storage at its own store).
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => a.store.get(k) ?? null,
      setItem: (k: string, v: string) => void a.store.set(k, v),
      removeItem: (k: string) => void a.store.delete(k),
    });
    a.storage.toggleComplete('sql/joins'); // un-tick
    await vi.advanceTimersByTimeAsync(2500);
    expect(JSON.parse([...s3.values()][0]!).data.completed).toEqual(['python/lists']);

    vi.stubGlobal('localStorage', {
      getItem: (k: string) => b.store.get(k) ?? null,
      setItem: (k: string, v: string) => void b.store.set(k, v),
      removeItem: (k: string) => void b.store.delete(k),
    });
    await b.sync.syncNow(); // b has no local changes → takes the online copy
    expect(b.storage.getData().completed).toEqual(['python/lists']);
  });

  it('a real conflict (both devices changed) keeps both changes', async () => {
    const a = await makeDevice(s3, calls, network);
    await a.sync.login('asha_k');
    const b = await makeDevice(s3, calls, network);
    await b.sync.login('asha_k');

    b.storage.toggleComplete('git/rebase');
    await vi.advanceTimersByTimeAsync(2500); // b saved
    a.storage.toggleComplete('docker/volumes'); // a changed before hearing about b
    await vi.advanceTimersByTimeAsync(2500);
    expect(JSON.parse([...s3.values()][0]!).data.completed.sort()).toEqual([
      'docker/volumes',
      'git/rebase',
    ]);
    expect(a.storage.getData().completed.sort()).toEqual(['docker/volumes', 'git/rebase']);
  });

  it('offline: changes are kept and uploaded when the network returns', async () => {
    const { storage, sync } = await makeDevice(s3, calls, network);
    await sync.login('asha_k');
    network.on = true;
    storage.toggleComplete('linux/permissions');
    await vi.advanceTimersByTimeAsync(2500);
    expect(['error', 'offline']).toContain(sync.getAccountState().status);
    network.on = false;
    await vi.advanceTimersByTimeAsync(31000); // automatic retry
    expect(sync.getAccountState().status).toBe('saved');
    expect(JSON.parse([...s3.values()][0]!).data.completed).toEqual(['linux/permissions']);
  });

  it('logout keeps progress online and clears this device', async () => {
    const { storage, sync, store } = await makeDevice(s3, calls, network);
    storage.toggleComplete('python/lists');
    await sync.login('asha_k');
    expect(await sync.logout()).toBe(true);
    expect(sync.getAccountState().status).toBe('guest');
    expect(storage.getData().completed).toEqual([]);
    expect(store.has(sync.ACCOUNT_STORAGE_KEY)).toBe(false);
    expect(JSON.parse([...s3.values()][0]!).data.completed).toEqual(['python/lists']);
  });

  it('logout refuses while changes cannot be uploaded, unless forced', async () => {
    const { storage, sync } = await makeDevice(s3, calls, network);
    await sync.login('asha_k');
    network.on = true;
    storage.toggleComplete('python/lists');
    expect(await sync.logout()).toBe(false);
    expect(sync.getAccountState().status).not.toBe('guest');
    expect(await sync.logout(true)).toBe(true);
  });

  it('rejects a bad username without calling S3', async () => {
    const { sync } = await makeDevice(s3, calls, network);
    const result = await sync.login('a b');
    expect(result.ok).toBe(false);
    expect(calls).toEqual([]);
  });
});
