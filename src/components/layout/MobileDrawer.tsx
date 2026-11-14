import { useEffect, useRef } from 'react';
import Sidebar from './Sidebar';
import { CloseIcon } from './icons';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

/** Slide-in menu for phones and tablets. Hidden on desktop (lg and up). */
export default function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    // Stop the page behind the drawer from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      id="mobile-drawer"
      className={`fixed inset-0 z-50 transition-[visibility] duration-200 lg:hidden ${
        open ? 'visible' : 'invisible'
      }`}
    >
      {/* Dark overlay: tap it to close */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-950/60 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute inset-y-0 left-0 flex w-[85%] max-w-xs flex-col bg-white shadow-2xl transition-transform duration-200 ease-out dark:bg-slate-900 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 pl-6 pr-2 dark:border-slate-800">
          <span className="text-base font-bold">Menu</span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="tap rounded-lg text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <Sidebar onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}
