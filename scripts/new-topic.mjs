// Adds a new topic.  Run: npm run new:topic -- python decorators "Decorators" "Functions"
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { contentRoot, isSlug, readJson, today, writeJson } from './lib.mjs';

const [track, slug, title, moduleTitle] = process.argv.slice(2);
if (!track || !slug || !title || !isSlug(slug)) {
  console.error('Usage: npm run new:topic -- <track> <topic-slug> "<Title>" ["<Module title>"]');
  console.error('Example: npm run new:topic -- python decorators "Decorators" "Functions"');
  process.exit(1);
}

const indexPath = join(contentRoot, track, 'index.json');
if (!existsSync(indexPath)) {
  console.error(
    `Track "${track}" not found. Create it first: npm run new:track -- ${track} "Name"`,
  );
  process.exit(1);
}

const mdxPath = join(contentRoot, track, `${slug}.mdx`);
if (existsSync(mdxPath)) {
  console.error(`src/content/${track}/${slug}.mdx already exists.`);
  process.exit(1);
}

const index = readJson(indexPath);
const allTopics = index.modules.flatMap((module) => module.topics);
const existing = allTopics.find((topic) => topic.slug === slug);
const id = existing?.id ?? `${track}-${slug}`;

// 1. Add it to the syllabus (unless Step 3 already listed it).
if (!existing) {
  const wanted = moduleTitle ?? index.modules.at(-1)?.title ?? 'New topics';
  let module = index.modules.find((m) => m.title === wanted);
  if (!module) {
    module = { title: wanted, topics: [] };
    index.modules.push(module);
  }
  module.topics.push({ id, slug, title });
  writeJson(indexPath, index);
}

// 2. Create the MDX file with every block of the topic template.
const lang = index.playground === 'sql' ? 'sql' : index.playground === 'python' ? 'python' : 'bash';
const fence = '```';
const mdx = `---
id: ${id}
title: ${existing?.title ?? title}
summary: One sentence that says what it is.
updated: "${today()}"
---

{/* Writing rules: simple English, short sentences, one idea per paragraph.
    Put the keyword in **bold** the first time. Keep { } and < > inside code only. */}

<Analogy>

Explain it with a real-life example (shop, train, contact list, library).

</Analogy>

## Simple explanation

Short paragraphs. Explain every technical word the first time it appears.

<Visual caption="What the picture shows">
  <svg viewBox="0 0 320 80" width="320" height="80" role="img" aria-label="Describe the diagram">
    <rect x="10" y="20" width="300" height="40" rx="8" fill="#e0e7ff" stroke="#4f46e5" strokeWidth="2" />
  </svg>
</Visual>

## Code example

${fence}${lang}
# line-by-line comments
${fence}

${fence}output
expected output
${fence}

<Playground kind="${index.playground}">

${fence}${lang}
# starting code for the learner
${fence}

</Playground>

<Mistakes>

<Mistake title="Name of the mistake">

<Wrong>

${fence}${lang}
# wrong code
${fence}

</Wrong>

<Right>

${fence}${lang}
# right code
${fence}

</Right>

One line: why it is wrong.

</Mistake>

</Mistakes>

<InterviewQA>

<QA q="A realistic interview question?">

The answer in simple words.

</QA>

</InterviewQA>

<Quiz
  questions={[
    {
      q: 'Question?',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      answer: 0,
      why: 'Why the correct option is correct.',
    },
  ]}
/>

<CheatSheet>

| What you want | Code |
| --- | --- |
| Thing | \`code\` |

</CheatSheet>
`;
writeFileSync(mdxPath, mdx);

console.log(`Created src/content/${track}/${slug}.mdx`);
console.log(
  existing
    ? 'It was already in index.json.'
    : `Added "${title}" to src/content/${track}/index.json`,
);
console.log('Now write the content, then run: npm run validate');
