import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const contentRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content');

export const PLAYGROUND_KINDS = ['python', 'sql', 'terminal', 'git', 'http', 'diagram', 'none'];

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
}

/** Reads the simple "key: value" lines between the --- markers of an MDX file. */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const out = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    out[line.slice(0, colon).trim()] = line
      .slice(colon + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return out;
}

export function isSlug(value) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}
