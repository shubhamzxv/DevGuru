import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { sql } from '@codemirror/lang-sql';
import {
  bracketMatching,
  defaultHighlightStyle,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../hooks/useTheme';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Called on Ctrl+Enter (Cmd+Enter on a Mac). */
  onRun?: () => void;
  /** Read by screen readers. */
  label: string;
  /** Which language to colour. Defaults to Python. */
  language?: 'python' | 'sql';
}

const baseTheme = EditorView.theme({
  '&': { fontSize: '14px' },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    lineHeight: '1.6',
    maxHeight: '26rem',
    overflow: 'auto',
  },
  '.cm-content': { padding: '12px 0' },
  '&.cm-focused': { outline: '2px solid #6366f1' },
});

const lightTheme = [
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  EditorView.theme({
    '&': { backgroundColor: '#ffffff', color: '#0f172a' },
    '.cm-gutters': { backgroundColor: '#f1f5f9', color: '#64748b', border: 'none' },
  }),
];

/**
 * CodeMirror 6 editor: line numbers, Python or SQL colours, Tab to indent, undo/redo.
 * It is loaded only when a playground is on the page (see PythonPlayground).
 */
export default function CodeEditor({
  value,
  onChange,
  onRun,
  label,
  language = 'python',
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [themeSlot] = useState(() => new Compartment());
  const { theme } = useTheme();

  // Keep the newest callbacks without rebuilding the editor.
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  useEffect(() => {
    onChangeRef.current = onChange;
    onRunRef.current = onRun;
  });

  // Create the editor once.
  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          bracketMatching(),
          indentUnit.of('    '),
          EditorState.tabSize.of(4),
          language === 'sql' ? sql() : python(),
          keymap.of([
            {
              key: 'Mod-Enter',
              run: () => {
                onRunRef.current?.();
                return true;
              },
            },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
          EditorView.contentAttributes.of({ 'aria-label': label }),
          baseTheme,
          themeSlot.of(theme === 'dark' ? oneDark : lightTheme),
        ],
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once; value and theme are synced below
  }, []);

  // Outside change (for example the Reset button): replace the text.
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  // Dark / light switch.
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeSlot.reconfigure(theme === 'dark' ? oneDark : lightTheme),
    });
  }, [theme, themeSlot]);

  return (
    <div
      ref={hostRef}
      className="overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600"
    />
  );
}
