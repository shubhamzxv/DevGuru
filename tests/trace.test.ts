import { describe, expect, it } from 'vitest';
import { parseTrace } from '../src/utils/trace';

describe('parseTrace (step-by-step result from Python)', () => {
  it('reads a normal recording', () => {
    const json = JSON.stringify({
      steps: [
        { line: 1, scope: 'main program', vars: {}, out: '' },
        { line: 2, scope: 'main program', vars: { total: '0' }, out: '' },
      ],
      error: null,
      truncated: false,
      output: '0\n',
      final: { total: '0' },
    });

    const trace = parseTrace(json);
    expect(trace?.steps).toHaveLength(2);
    expect(trace?.steps[1]?.vars).toEqual({ total: '0' });
    expect(trace?.error).toBeNull();
    expect(trace?.output).toBe('0\n');
    expect(trace?.final).toEqual({ total: '0' });
  });

  it('keeps the error message and line', () => {
    const json = JSON.stringify({
      steps: [{ line: 1, scope: 'main program', vars: {}, out: '' }],
      error: { message: "NameError: name 'b' is not defined", line: 1 },
      truncated: false,
      output: '',
      final: {},
    });
    expect(parseTrace(json)?.error).toEqual({
      message: "NameError: name 'b' is not defined",
      line: 1,
    });
  });

  it('returns null for broken data', () => {
    expect(parseTrace('not json')).toBeNull();
    expect(parseTrace('{"steps": "oops"}')).toBeNull();
    expect(parseTrace('{"steps": [{"line": "one"}]}')).toBeNull();
  });
});
