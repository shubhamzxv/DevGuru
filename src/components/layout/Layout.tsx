import { Suspense, useCallback, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useRouteFocus } from '../../hooks/useRouteFocus';
import { useSearchShortcut } from '../../hooks/useSearchShortcut';
import UpdatePrompt from '../pwa/UpdatePrompt';
import BottomNav from './BottomNav';
import Header from './Header';
import MobileDrawer from './MobileDrawer';
import Sidebar from './Sidebar';

/**
 * The frame around every page.
 * - Phone/tablet: header + slide-in drawer + bottom navigation bar.
 * - Desktop (lg, 1024px and up): header + fixed sidebar on the left.
 */
export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  useSearchShortcut();
  const main = useRef<HTMLElement>(null);
  useRouteFocus(main);

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-3 focus:text-white"
      >
        Skip to content
      </a>

      <Header onMenuClick={openDrawer} drawerOpen={drawerOpen} />

      <div className="mx-auto flex w-full max-w-7xl">
        <aside className="sticky top-14 hidden print:hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-slate-200 lg:block dark:border-slate-800">
          <Sidebar />
        </aside>

        {/* pb-24 keeps content clear of the bottom bar on mobile */}
        <main
          ref={main}
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 px-4 outline-none focus-visible:ring-0 focus-visible:ring-offset-0 pb-24 pt-6 sm:px-6 lg:px-10 lg:pb-12"
        >
          <Suspense
            fallback={
              <p role="status" className="py-10 text-center text-slate-500 dark:text-slate-400">
                Loading…
              </p>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>

      <MobileDrawer open={drawerOpen} onClose={closeDrawer} />
      <BottomNav onTracksClick={openDrawer} />
      <UpdatePrompt />
    </div>
  );
}
