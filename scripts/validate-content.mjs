// Checks every track and topic before a build.  Run: npm run validate
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { contentRoot, isSlug, parseFrontmatter, PLAYGROUND_KINDS, readJson } from './lib.mjs';

const REQUIRED_BLOCKS = ['<Analogy', '<Mistakes', '<InterviewQA', '<Quiz', '<CheatSheet'];
const errors = [];
const warnings = [];
let topicCount = 0;
let writtenCount = 0;
const orders = new Map();

const trackDirs = readdirSync(contentRoot).filter((name) =>
  statSync(join(contentRoot, name)).isDirectory(),
);

for (const track of trackDirs) {
  const dir = join(contentRoot, track);
  const indexPath = join(dir, 'index.json');
  const where = `content/${track}`;

  if (!isSlug(track))
    errors.push(`${where}: folder name must be lower-case letters, digits, dashes`);
  if (!existsSync(indexPath)) {
    errors.push(`${where}: index.json is missing`);
    continue;
  }

  let index;
  try {
    index = readJson(indexPath);
  } catch (error) {
    errors.push(`${where}/index.json: not valid JSON (${error.message})`);
    continue;
  }

  for (const field of ['name', 'icon', 'tagline']) {
    if (typeof index[field] !== 'string' || index[field] === '') {
      errors.push(`${where}/index.json: "${field}" must be a non-empty string`);
    }
  }
  if (typeof index.order !== 'number') errors.push(`${where}/index.json: "order" must be a number`);
  else if (orders.has(index.order)) {
    errors.push(
      `${where}/index.json: order ${index.order} is already used by ${orders.get(index.order)}`,
    );
  } else orders.set(index.order, track);
  if (!PLAYGROUND_KINDS.includes(index.playground)) {
    errors.push(`${where}/index.json: "playground" must be one of ${PLAYGROUND_KINDS.join(', ')}`);
  }
  if (!Array.isArray(index.modules)) {
    errors.push(`${where}/index.json: "modules" must be a list`);
    continue;
  }

  const ids = new Set();
  const slugs = new Set();

  for (const module of index.modules) {
    if (typeof module.title !== 'string' || !Array.isArray(module.topics)) {
      errors.push(`${where}/index.json: every module needs "title" and "topics"`);
      continue;
    }
    for (const topic of module.topics) {
      topicCount += 1;
      const label = `${where} → ${topic.slug ?? '(no slug)'}`;
      for (const field of ['id', 'slug', 'title']) {
        if (typeof topic[field] !== 'string' || topic[field] === '') {
          errors.push(`${label}: "${field}" is missing in index.json`);
        }
      }
      if (typeof topic.slug === 'string' && !isSlug(topic.slug)) {
        errors.push(`${label}: slug must be lower-case letters, digits, dashes`);
      }
      if (ids.has(topic.id)) errors.push(`${label}: id "${topic.id}" is used twice`);
      if (slugs.has(topic.slug)) errors.push(`${label}: slug "${topic.slug}" is used twice`);
      ids.add(topic.id);
      slugs.add(topic.slug);

      const mdxPath = join(dir, `${topic.slug}.mdx`);
      if (!existsSync(mdxPath)) continue; // planned, shown as "Coming soon"
      writtenCount += 1;

      const text = readFileSync(mdxPath, 'utf8');
      const fm = parseFrontmatter(text);
      if (!fm) {
        errors.push(`${label}.mdx: the --- block at the top is missing`);
        continue;
      }
      if (fm.id !== topic.id)
        errors.push(`${label}.mdx: id "${fm.id}" must match index.json "${topic.id}"`);
      if (fm.title !== topic.title)
        errors.push(`${label}.mdx: title "${fm.title}" must match index.json "${topic.title}"`);
      if (!fm.summary) errors.push(`${label}.mdx: "summary" is missing`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fm.updated ?? ''))
        errors.push(`${label}.mdx: "updated" must look like 2026-11-14`);
      for (const block of REQUIRED_BLOCKS) {
        if (!text.includes(block)) errors.push(`${label}.mdx: ${block}> block is missing`);
      }
      if (!text.includes('<Playground') && !text.includes('<Visual')) {
        warnings.push(`${label}.mdx: no <Playground> and no <Visual> (add one if it helps)`);
      }
      if (/lorem ipsum/i.test(text)) errors.push(`${label}.mdx: contains "Lorem ipsum"`);
    }
  }

  for (const file of readdirSync(dir).filter((name) => name.endsWith('.mdx'))) {
    if (!slugs.has(file.replace(/\.mdx$/, ''))) {
      errors.push(`${where}/${file}: file exists but is not listed in index.json`);
    }
  }
}

for (const warning of warnings) console.warn(`warning  ${warning}`);
for (const error of errors) console.error(`ERROR    ${error}`);
console.log(
  `Content check: ${trackDirs.length} tracks, ${topicCount} topics in syllabus, ${writtenCount} written, ${errors.length} errors, ${warnings.length} warnings.`,
);
if (errors.length > 0) process.exit(1);
