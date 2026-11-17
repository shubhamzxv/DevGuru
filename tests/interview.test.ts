import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractInterviewQA, splitAnswer } from '../src/build/contentIndex';
import { buildContentData } from '../src/build/contentPlugin';
import { TRACKS } from '../src/registry/tracks';

const TOPIC = `
<InterviewQA>

<QA q="What is a **decorator**?">

A function that wraps another function. See [the docs](https://docs.python.org).

\`\`\`python
@timer
def work(): ...
\`\`\`

Use \`functools.wraps\` to keep the name.

</QA>

<QA q='Why "g"?'>

Per-request storage.

</QA>

</InterviewQA>
`;

describe('interview questions (build time)', () => {
  it('reads every question with its answer split into text and code blocks', () => {
    expect(extractInterviewQA(TOPIC)).toEqual([
      {
        q: 'What is a **decorator**?',
        answer: [
          { kind: 'text', text: 'A function that wraps another function. See the docs.' },
          { kind: 'code', language: 'python', code: '@timer\ndef work(): ...' },
          { kind: 'text', text: 'Use `functools.wraps` to keep the name.' },
        ],
      },
      { q: 'Why "g"?', answer: [{ kind: 'text', text: 'Per-request storage.' }] },
    ]);
  });

  it('treats a fence without a language as text code', () => {
    expect(splitAnswer('```\nls -la\n```')).toEqual([
      { kind: 'code', language: 'text', code: 'ls -la' },
    ]);
  });

  it('has questions with non-empty answers for every track', () => {
    const { interview, search } = buildContentData(join(__dirname, '..', 'src', 'content'));
    for (const track of TRACKS) {
      const entries = interview[track.slug] ?? [];
      expect(entries.length, track.slug).toBeGreaterThan(0);
      for (const entry of entries) {
        for (const item of entry.items) {
          expect(item.q, `${track.slug}/${entry.slug}`).not.toBe('');
          expect(item.answer.length, `${track.slug}/${entry.slug}: ${item.q}`).toBeGreaterThan(0);
        }
      }
    }
    // Same questions the search index knows about.
    const total = Object.values(interview)
      .flat()
      .reduce((sum, entry) => sum + entry.items.length, 0);
    expect(total).toBe(search.reduce((sum, entry) => sum + entry.questions.length, 0));
  });
});
