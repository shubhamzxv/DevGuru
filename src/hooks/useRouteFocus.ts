import { useEffect, useRef, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * After moving to another page inside the app (not on the first load):
 * - scroll to the top, or to the #section in the link if there is one;
 * - move keyboard focus to the main area, so screen readers start reading the
 *   new page and Tab continues from it instead of from the old link.
 * Changing only the query (?q= filters) keeps the scroll position and focus.
 */
export function useRouteFocus(main: RefObject<HTMLElement>) {
  const { pathname, hash } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (target) target.scrollIntoView();
    else window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [pathname, hash, main]);
}
