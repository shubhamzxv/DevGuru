/**
 * Registers the service worker (production builds only) and tells the UI when
 * - the app has just been saved for offline use ("offline-ready"), or
 * - a newer version is downloaded and waiting ("update-ready").
 */
export type PwaStatus = 'idle' | 'offline-ready' | 'update-ready';

let status: PwaStatus = 'idle';
let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();

function setStatus(next: PwaStatus) {
  status = next;
  listeners.forEach((listener) => listener());
}

export function getPwaStatus(): PwaStatus {
  return status;
}

export function subscribePwa(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dismissPwaMessage(): void {
  setStatus('idle');
}

/** Switches to the waiting version. The page reloads once it takes control. */
export function applyUpdate(): void {
  waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    const hadController = navigator.serviceWorker.controller !== null;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        const watch = (worker: ServiceWorker | null) => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state !== 'installed') return;
            if (navigator.serviceWorker.controller) {
              waitingWorker = worker;
              setStatus('update-ready');
            } else {
              setStatus('offline-ready'); // first install
            }
          });
        };

        if (registration.waiting && hadController) {
          waitingWorker = registration.waiting;
          setStatus('update-ready');
        }
        registration.addEventListener('updatefound', () => watch(registration.installing));

        // Long-open tabs (and the installed app) look for new content every hour.
        window.setInterval(() => void registration.update(), 60 * 60 * 1000);
      })
      .catch(() => {
        // Offline support is a bonus: the site still works without it.
      });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return; // first install: nothing to reload
      reloading = true;
      window.location.reload();
    });
  });
}
