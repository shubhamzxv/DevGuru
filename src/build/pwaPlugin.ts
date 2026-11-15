import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Vite plugin (build only): writes dist/sw.js, the service worker that makes
 * DevGuru work offline. It fills the template src/build/sw.template.js with
 * the exact list of files this build produced, so no file is ever missed or stale.
 */

/** Files that should never be saved for offline use. */
const SKIP = [/\.map$/, /(^|\/)sw\.js$/, /\.gitkeep$/, /(^|\/)\./];

export function precacheList(bundleFiles: string[], publicFiles: string[]): string[] {
  const urls = ['/index.html', ...bundleFiles, ...publicFiles]
    .map((file) => file.replace(/\\/g, '/').replace(/^\/?/, '/'))
    .filter((url) => !SKIP.some((pattern) => pattern.test(url)));
  return [...new Set(urls)].sort();
}

/**
 * `fingerprint` covers files whose names do not change when their content does
 * (the public folder), so any change gives the service worker a new version.
 */
export function serviceWorkerSource(template: string, urls: string[], fingerprint = ''): string {
  const version = createHash('sha256')
    .update(template)
    .update(urls.join('\n'))
    .update(fingerprint)
    .digest('hex')
    .slice(0, 12);
  return template
    .replace('__VERSION__', version)
    .replace('/* __PRECACHE__ */ []', JSON.stringify(urls, null, 2));
}

function listFiles(root: string, dir = root): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(root, path) : [relative(root, path)];
  });
}

export default function pwaPlugin(templatePath: string): Plugin {
  let publicDir = '';
  return {
    name: 'devguru-service-worker',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const publicFiles = listFiles(publicDir);
      const urls = precacheList(Object.keys(bundle), publicFiles);
      const fingerprint = createHash('sha256');
      for (const file of publicFiles)
        fingerprint.update(file).update(readFileSync(join(publicDir, file)));
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: serviceWorkerSource(
          readFileSync(templatePath, 'utf8'),
          urls,
          fingerprint.digest('hex'),
        ),
      });
    },
  };
}
