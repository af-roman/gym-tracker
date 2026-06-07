function applyStoredTheme() {
  const stored = localStorage.getItem('theme')
  const dark =
    stored === 'dark' ||
    (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

applyStoredTheme()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Service worker registration failed — app still works online
    })
  })
}
