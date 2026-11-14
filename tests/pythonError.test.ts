import { describe, expect, it } from 'vitest';
import { cleanTraceback } from '../src/utils/pythonError';

describe('cleanTraceback', () => {
  it('removes the lines about Pyodide itself', () => {
    const raw = [
      'Traceback (most recent call last):',
      '  File "/lib/python312.zip/_pyodide/_base.py", line 574, in eval_code_async',
      '    await CodeRunner(',
      '  File "<exec>", line 2, in <module>',
      "NameError: name 'total' is not defined",
    ].join('\n');

    expect(cleanTraceback(raw)).toBe(
      [
        'Traceback (most recent call last):',
        '  File "<exec>", line 2, in <module>',
        "NameError: name 'total' is not defined",
      ].join('\n'),
    );
  });

  it('leaves other messages unchanged', () => {
    expect(cleanTraceback('Something else went wrong\n')).toBe('Something else went wrong');
  });
});
