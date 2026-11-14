import { isValidElement, type ReactNode } from 'react';

export interface ExtractedCode {
  code: string;
  language: string | undefined;
}

interface CodeLikeProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Finds the first fenced code block inside MDX children and returns its text.
 * Used by components that wrap a code block, for example <Playground>.
 */
export function extractCode(node: ReactNode): ExtractedCode | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = extractCode(child as ReactNode);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<CodeLikeProps>(node)) return null;

  const { className, children } = node.props;
  const language = /language-([\w-]+)/.exec(className ?? '')?.[1];
  if (language && typeof children === 'string') {
    return { code: children.replace(/\n$/, ''), language };
  }
  return extractCode(children);
}
