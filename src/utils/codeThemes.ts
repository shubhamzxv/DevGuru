import { themes, type PrismTheme } from 'prism-react-renderer';

/**
 * prism-react-renderer's GitHub and Night Owl themes with every token colour
 * darkened (light) or lightened (dark) until it reaches at least 4.6:1 against
 * the code background, so code passes WCAG AA contrast (needed: 4.5:1).
 */
const LIGHT_FIXES: Record<string, string> = {
  '#999988': '#6e6e62', // comments
  '#e3116c': '#da1068', // strings
  '#36acaa': '#277c7b', // numbers, booleans, constants
  '#00a4db': '#00769e', // keywords, attribute names
  '#d73a49': '#ce3846', // functions, tags
};
const DARK_FIXES: Record<string, string> = {
  'rgb(99, 119, 119)': '#758787', // comments
  'rgba(239, 83, 80, 0.56)': '#ef5350', // deleted
};

function withFixes(theme: PrismTheme, fixes: Record<string, string>): PrismTheme {
  return {
    ...theme,
    styles: theme.styles.map((entry) => {
      const color = entry.style.color;
      return color && fixes[color]
        ? { ...entry, style: { ...entry.style, color: fixes[color] } }
        : entry;
    }),
  };
}

export const lightCodeTheme = withFixes(themes.github, LIGHT_FIXES);
export const darkCodeTheme = withFixes(themes.nightOwl, DARK_FIXES);
