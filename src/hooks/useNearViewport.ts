import { useEffect, useState, type RefObject } from 'react';

/**
 * True once the element is on screen or within `margin` of it, and stays true.
 * Used to delay work that is not needed yet (syntax highlighting, the code
 * editor download) so a topic page becomes usable faster on phones.
 * Without IntersectionObserver (very old browsers, tests) it is true at once.
 */
export function useNearViewport(ref: RefObject<Element>, margin = '600px'): boolean {
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    if (near) return;
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [near, ref, margin]);

  return near;
}
