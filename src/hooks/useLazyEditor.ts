import { useEffect, useState, type ComponentType, type RefObject } from 'react';
import { useNearViewport } from './useNearViewport';

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  label: string;
  language?: 'python' | 'sql';
}

/**
 * The CodeMirror editor is the biggest download on topic pages (~130 KB gzip).
 * It is fetched only when the playground comes near the screen, or when the
 * learner focuses the plain text box (call `load`). Until then, and if the
 * download fails, the plain text box is the editor.
 */
export function useLazyEditor(ref: RefObject<Element>) {
  const near = useNearViewport(ref, '300px');
  const [wanted, setWanted] = useState(false);
  const [Editor, setEditor] = useState<ComponentType<EditorProps> | null>(null);

  useEffect(() => {
    if (!(near || wanted) || Editor) return;
    let cancelled = false;
    import('../components/playground/CodeEditor')
      .then((module) => {
        if (!cancelled) setEditor(() => module.default as ComponentType<EditorProps>);
      })
      .catch(() => {
        // Keep the text box.
      });
    return () => {
      cancelled = true;
    };
  }, [near, wanted, Editor]);

  return { Editor, load: () => setWanted(true) };
}
