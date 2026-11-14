import { describe, expect, it } from 'vitest';
import { resolveTheme } from '../src/utils/theme';

describe('resolveTheme', () => {
  it('uses the saved choice first', () => {
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });

  it('follows the system setting when nothing is saved', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('ignores a broken saved value', () => {
    expect(resolveTheme('purple', true)).toBe('dark');
  });
});
