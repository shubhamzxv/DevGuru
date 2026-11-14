// Adds a new technology.  Run: npm run new:track -- kubernetes "Kubernetes" "☸️"
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { contentRoot, isSlug, readJson, writeJson } from './lib.mjs';

const [slug, name, icon = '📘'] = process.argv.slice(2);
if (!slug || !name || !isSlug(slug)) {
  console.error('Usage: npm run new:track -- <slug> "<Name>" "<emoji>"');
  console.error('Example: npm run new:track -- kubernetes "Kubernetes" "☸️"');
  process.exit(1);
}

const dir = join(contentRoot, slug);
if (existsSync(dir)) {
  console.error(`Track "${slug}" already exists.`);
  process.exit(1);
}

const orders = readdirSync(contentRoot)
  .filter((entry) => statSync(join(contentRoot, entry)).isDirectory())
  .map((entry) => join(contentRoot, entry, 'index.json'))
  .filter((path) => existsSync(path))
  .map((path) => readJson(path).order ?? 0);

mkdirSync(dir);
writeJson(join(dir, 'index.json'), {
  name,
  icon,
  tagline: 'Write a short one-line description here',
  order: Math.max(0, ...orders) + 1,
  playground: 'none',
  modules: [],
});

console.log(`Created src/content/${slug}/index.json`);
console.log(`Next: npm run new:topic -- ${slug} <topic-slug> "<Topic title>" "<Module title>"`);
