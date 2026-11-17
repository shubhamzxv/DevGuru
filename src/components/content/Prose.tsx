import { isValidElement, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import CodeBlock, { OutputBlock } from './CodeBlock';
import { pythonRunsInBrowser } from '../../utils/runnable';

/* Styled versions of plain Markdown elements, used by every topic page. */

export function H2({ children, ...rest }: ComponentProps<'h2'>) {
  return (
    <h2 className="mb-3 mt-10 text-xl font-bold tracking-tight sm:text-2xl" {...rest}>
      {children}
    </h2>
  );
}

export function H3({ children, ...rest }: ComponentProps<'h3'>) {
  return (
    <h3 className="mb-2 mt-6 text-lg font-semibold" {...rest}>
      {children}
    </h3>
  );
}

export function P(props: ComponentProps<'p'>) {
  return <p className="my-3 leading-7 text-slate-700 dark:text-slate-300" {...props} />;
}

export function Ul(props: ComponentProps<'ul'>) {
  return (
    <ul className="my-3 list-disc space-y-1 pl-6 text-slate-700 dark:text-slate-300" {...props} />
  );
}

export function Ol(props: ComponentProps<'ol'>) {
  return (
    <ol
      className="my-3 list-decimal space-y-1 pl-6 text-slate-700 dark:text-slate-300"
      {...props}
    />
  );
}

export function Li(props: ComponentProps<'li'>) {
  return <li className="leading-7" {...props} />;
}

export function A({ href = '', children }: ComponentProps<'a'>) {
  const className = 'font-medium text-brand-700 underline dark:text-brand-300';
  if (href.startsWith('/')) {
    return (
      <Link to={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function Blockquote(props: ComponentProps<'blockquote'>) {
  return (
    <blockquote
      className="my-4 border-l-4 border-brand-400 pl-4 text-slate-700 dark:text-slate-300"
      {...props}
    />
  );
}

export function Hr() {
  return <hr className="my-8 border-slate-200 dark:border-slate-800" />;
}

/** Tables scroll sideways inside their own box so the page never breaks on phones. */
export function Table(props: ComponentProps<'table'>) {
  return (
    <div className="my-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  );
}

export function Th(props: ComponentProps<'th'>) {
  return (
    <th
      className="whitespace-nowrap bg-slate-100 px-3 py-2 font-semibold dark:bg-slate-800"
      {...props}
    />
  );
}

export function Td(props: ComponentProps<'td'>) {
  return <td className="border-t border-slate-200 px-3 py-2 dark:border-slate-700" {...props} />;
}

export function InlineCode(props: ComponentProps<'code'>) {
  return (
    <code
      className="rounded bg-slate-100 px-1.5 py-0.5 text-brand-800 dark:bg-slate-800 dark:text-brand-200"
      {...props}
    />
  );
}

interface CodeChildProps {
  className?: string;
  children?: ReactNode;
}

/**
 * A fenced code block in MDX.
 * ```python  -> highlighted CodeBlock with a Copy button
 * ```output  -> Output panel
 */
export function MdxPre({ children }: ComponentProps<'pre'>) {
  if (isValidElement<CodeChildProps>(children) && typeof children.props.children === 'string') {
    const language = /language-([\w-]+)/.exec(children.props.className ?? '')?.[1];
    const code = children.props.children.replace(/\n$/, '');
    // ```mysql and ```postgresql: coloured as SQL, but not runnable in the SQLite playground.
    const otherEngine = language === 'mysql' || language === 'postgresql';
    return language === 'output' ? (
      <OutputBlock text={code} />
    ) : (
      <CodeBlock
        code={code}
        language={otherEngine ? 'sql' : language}
        label={otherEngine ? language : undefined}
        tryIt={!otherEngine && !(language === 'python' && !pythonRunsInBrowser(code))}
      />
    );
  }
  return <pre className="my-4 overflow-x-auto">{children}</pre>;
}
