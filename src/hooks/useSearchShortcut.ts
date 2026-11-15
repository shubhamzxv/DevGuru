import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Sent when the shortcut is pressed while the search page is already open. */
export const FOCUS_SEARCH_EVENT = 'devguru:focus-search';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // CodeMirror editors are contenteditable, so "/" inside code is not hijacked.
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** Ctrl+K (Cmd+K on Mac) anywhere, or "/" when not typing, opens search. */
export function useSearchShortcut(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ctrlK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      const slash =
        event.key === '/' && !event.ctrlKey && !event.metaKey && !isTyping(event.target);
      if (!ctrlK && !slash) return;
      event.preventDefault();
      if (pathname === '/search') window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
      else navigate('/search');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, pathname]);
}
