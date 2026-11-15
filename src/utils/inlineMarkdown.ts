/**
 * Renders the little bits of markdown used inside cheat sheet cells:
 * `code` and **bold**. Everything else is shown as plain text (React escapes it).
 */
export function parseInline(text: string): { kind: 'text' | 'code' | 'bold'; value: string }[] {
  const parts: { kind: 'text' | 'code' | 'bold'; value: string }[] = [];
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: 'text', value: text.slice(last, index) });
    if (match[1] !== undefined) parts.push({ kind: 'code', value: match[1] });
    else parts.push({ kind: 'bold', value: match[2] ?? '' });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}
