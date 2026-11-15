import { parseInline } from '../../utils/inlineMarkdown';

/** Shows a cheat sheet cell: `code` and **bold**, everything else as plain text. */
export default function InlineMarkdown({ text }: { text: string }) {
  const parts = parseInline(text).map((part, index) => {
    if (part.kind === 'code') {
      return (
        <code
          key={index}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] text-slate-900 dark:bg-slate-800 dark:text-slate-100"
        >
          {part.value}
        </code>
      );
    }
    if (part.kind === 'bold') return <strong key={index}>{part.value}</strong>;
    return <span key={index}>{part.value}</span>;
  });
  return <>{parts}</>;
}
