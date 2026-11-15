import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rules = JSON.parse(readFileSync('amplify-rules.json', 'utf8')) as {
  source: string;
  target: string;
  status: string;
}[];
const customHttp = readFileSync('customHttp.yml', 'utf8');

/** Amplify writes a regex rule as </pattern/>. */
const spa = rules[0]!;
const pattern = new RegExp(spa.source.replace(/^<\//, '').replace(/\/>$/, ''));
const rewrites = (path: string) => pattern.test(path);

describe('SPA rewrite rule (amplify-rules.json)', () => {
  it('sends every app route to index.html with status 200', () => {
    expect(spa.target).toBe('/index.html');
    expect(spa.status).toBe('200');
    for (const path of [
      '/',
      '/track/python',
      '/track/python/list-vs-tuple',
      '/track/system-design/cap-theorem',
      '/playground/sql',
      '/search',
      '/cheatsheets',
      '/no/such/page',
    ]) {
      expect(rewrites(path), path).toBe(true);
    }
  });

  it('serves real files as they are', () => {
    for (const path of [
      '/assets/index-abc123.js',
      '/assets/index-abc123.css',
      '/wasm/sql-wasm.wasm',
      '/sw.js',
      '/manifest.webmanifest',
      '/robots.txt',
      '/favicon.svg',
      '/icons/icon-192.png',
      '/theme-init.js',
    ]) {
      expect(rewrites(path), path).toBe(false);
    }
  });

  it('covers every file type in public/', () => {
    const extensions = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) walk(`${dir}/${entry.name}`);
        else extensions.add(entry.name.split('.').pop()!);
      }
    };
    walk('public');
    for (const ext of extensions) expect(rewrites(`/x/file.${ext}`), `.${ext}`).toBe(false);
  });
});

describe('Content-Security-Policy (customHttp.yml)', () => {
  const csp = /key: Content-Security-Policy\s+value: "([^"]+)"/.exec(customHttp)?.[1] ?? '';
  const directive = (name: string) =>
    csp
      .split(';')
      .map((part) => part.trim().split(/\s+/))
      .find(([key]) => key === name)
      ?.slice(1) ?? [];

  it('is present and blocks the risky defaults', () => {
    expect(csp).not.toBe('');
    expect(directive('default-src')).toEqual(["'self'"]);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
    expect(directive('script-src')).not.toContain("'unsafe-eval'");
    expect(directive('script-src')).not.toContain("'unsafe-inline'");
  });

  it('allows what Python (Pyodide) and SQL (sql.js) need', () => {
    expect(directive('script-src')).toEqual(
      expect.arrayContaining(["'self'", "'wasm-unsafe-eval'", 'https://cdn.jsdelivr.net']),
    );
    expect(directive('connect-src')).toContain('https://cdn.jsdelivr.net');
    expect(directive('worker-src')).toContain("'self'");
  });

  it('allows the progress store used for login (src/config/cloud.ts)', () => {
    const config = readFileSync('src/config/cloud.ts', 'utf8');
    const url = /DEFAULT_BASE_URL = '([^']+)'/.exec(config)?.[1];
    expect(url).toBeDefined();
    expect(directive('connect-src')).toContain(new URL(url!).origin);
  });

  it('uses the same Pyodide host as the worker', () => {
    const worker = readFileSync('src/workers/pyodide.worker.ts', 'utf8');
    const host = /PYODIDE_URL = 'https:\/\/([^/]+)\//.exec(worker)?.[1];
    expect(host).toBeDefined();
    expect(directive('script-src')).toContain(`https://${host}`);
  });
});
