import { describe, expect, it } from 'vitest';
import { darkCodeTheme, lightCodeTheme } from '../src/utils/codeThemes';

/** WCAG 2 contrast ratio between two colours (#rrggbb or rgb()/rgba()). */
function contrast(a: string, b: string): number {
  const rgb = (c: string) =>
    c.startsWith('#')
      ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
      : (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
  const lum = (c: string) => {
    const [r = 0, g = 0, bl = 0] = rgb(c).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('code colours meet WCAG AA (4.5:1)', () => {
  for (const [name, theme] of [
    ['light', lightCodeTheme],
    ['dark', darkCodeTheme],
  ] as const) {
    it(`${name} theme`, () => {
      const background = theme.plain.backgroundColor ?? '#ffffff';
      const colours = [theme.plain.color, ...theme.styles.map((s) => s.style.color)].filter(
        (c): c is string => typeof c === 'string' && !c.includes('rgba'),
      );
      for (const colour of colours) {
        expect(contrast(colour, background), `${colour} on ${background}`).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    });
  }
});
