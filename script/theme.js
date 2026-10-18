/* Preferences only. Note data lives in IndexedDB. */
try {
  const p = JSON.parse(localStorage.getItem('atlasnote.preferences') || '{}');
  document.documentElement.dataset.theme = p.theme === 'light' ? 'light' : 'dark';
} catch { /* Keep a usable dark default when preferences are unavailable. */ }
