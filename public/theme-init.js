// Runs before React loads. Keep in sync with src/utils/theme.ts.
(function () {
  try {
    var stored = localStorage.getItem('devguru-theme');
    var dark =
      stored === 'dark' ||
      (stored !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {
    /* localStorage blocked: stay on light theme */
  }
})();
