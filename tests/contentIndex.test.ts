import { describe, expect, it } from 'vitest';
import {
  extractCheatSheet,
  extractHeadings,
  extractQuestions,
  extractTerms,
  extractWords,
  splitRow,
} from '../src/build/contentIndex';
import { precacheList, serviceWorkerSource } from '../src/build/pwaPlugin';
import { parseInline } from '../src/utils/inlineMarkdown';

const SAMPLE = `---
id: sql-sample
title: Sample
summary: A sample topic.
updated: "2026-11-15"
---

## Simple explanation

A **window function** keeps every row. Window functions are great.

\`\`\`sql
## not a heading, this is code
SELECT 1;
\`\`\`

<QA q="What is a window function?">

An answer.

</QA>

<CheatSheet>

| What you want | Code |
| --- | --- |
| Rank rows | \`RANK() OVER (ORDER BY x)\` |
| Logical OR in Python | \`a \\| b\` |

Remember: **filter outside**.

</CheatSheet>
`;

describe('content index (build time)', () => {
  it('reads headings but ignores lines inside code blocks', () => {
    expect(extractHeadings(SAMPLE)).toEqual(['Simple explanation']);
  });

  it('collects bold key terms once each', () => {
    expect(extractTerms(SAMPLE)).toEqual(['window function', 'filter outside']);
  });

  it('collects interview questions', () => {
    expect(extractQuestions(SAMPLE)).toEqual(['What is a window function?']);
  });

  it('keeps meaningful frequent words and drops stopwords', () => {
    const words = extractWords(SAMPLE);
    expect(words).toContain('window');
    expect(words).toContain('rank'); // cheat sheet text counts too
    expect(words).not.toContain('the');
    expect(words).not.toContain('select'); // only inside a code block
  });

  it('reads the cheat sheet table, escaped pipes and notes', () => {
    expect(extractCheatSheet(SAMPLE)).toEqual({
      headers: ['What you want', 'Code'],
      rows: [
        ['Rank rows', '`RANK() OVER (ORDER BY x)`'],
        ['Logical OR in Python', '`a | b`'],
      ],
      notes: ['Remember: **filter outside**.'],
    });
    expect(extractCheatSheet('no sheet here')).toBeNull();
  });

  it('splits table rows only on real pipes', () => {
    expect(splitRow('| a | `x \\| y` | c |')).toEqual(['a', '`x | y`', 'c']);
  });
});

describe('inline markdown in cheat sheet cells', () => {
  it('finds code and bold parts', () => {
    expect(parseInline('Use `len(x)` for **size** only')).toEqual([
      { kind: 'text', value: 'Use ' },
      { kind: 'code', value: 'len(x)' },
      { kind: 'text', value: ' for ' },
      { kind: 'bold', value: 'size' },
      { kind: 'text', value: ' only' },
    ]);
  });
});

describe('service worker', () => {
  it('lists every app file once and skips source maps and hidden files', () => {
    const list = precacheList(
      ['index.html', 'assets/index-abc.js', 'assets/index-abc.js.map'],
      ['wasm/sql-wasm.wasm', 'favicon.svg', '.gitkeep', 'icons\\icon-192.png'],
    );
    expect(list).toEqual([
      '/assets/index-abc.js',
      '/favicon.svg',
      '/icons/icon-192.png',
      '/index.html',
      '/wasm/sql-wasm.wasm',
    ]);
  });

  it('fills the template and changes version when files change', () => {
    const template = "const VERSION = '__VERSION__';\nconst PRECACHE = /* __PRECACHE__ */ [];";
    const a = serviceWorkerSource(template, ['/index.html']);
    const b = serviceWorkerSource(template, ['/index.html', '/assets/new.js']);
    const c = serviceWorkerSource(template, ['/index.html'], 'theme-init.js changed');
    expect(a).toContain('"/index.html"');
    expect(a).not.toContain('__VERSION__');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});
