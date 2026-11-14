import { Highlight, themes } from 'prism-react-renderer';
import { useState } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { Prism } from '../../utils/prism';

interface CodeBlockProps {
  code: string;
  /** python, sql, bash, json, docker, http, git, ... */
  language?: string;
  /** Text in the top bar. Defaults to the language name. */
  label?: string;
}

/** Highlighted code with a Copy button. Scrolls sideways on small screens. */
export default function CodeBlock({ code, language = 'text', label }: CodeBlockProps) {
  const { theme } = useTheme();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false); // clipboard blocked by the browser
    }
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between bg-slate-100 pl-4 dark:bg-slate-800">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          {label ?? language}
        </span>
        <button
          type="button"
          onClick={copy}
          className="tap px-4 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <span aria-live="polite">{copied ? 'Copied ✓' : 'Copy'}</span>
        </button>
      </div>
      <Highlight
        prism={Prism}
        theme={theme === 'dark' ? themes.nightOwl : themes.github}
        code={code}
        language={language}
      >
        {({ style, tokens, getLineProps, getTokenProps }) => (
          <pre style={style} className="overflow-x-auto p-4 leading-relaxed" tabIndex={0}>
            <code>
              {tokens.map((line, lineIndex) => (
                <div key={lineIndex} {...getLineProps({ line })}>
                  {line.map((token, tokenIndex) => (
                    <span key={tokenIndex} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  );
}

/** What the code prints. Written in MDX as a fenced block with the language "output". */
export function OutputBlock({ text }: { text: string }) {
  return (
    <div className="my-4 overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
      <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-emerald-300">
        Output
      </div>
      <pre className="overflow-x-auto px-4 pb-4 pt-2 leading-relaxed text-slate-100" tabIndex={0}>
        <code>{text}</code>
      </pre>
    </div>
  );
}
