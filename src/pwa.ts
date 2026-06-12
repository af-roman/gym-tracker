import { loadSettings, applySettings } from './lib/settings'

function applyStoredTheme() {
  applySettings(loadSettings())
}

applyStoredTheme()

function lockZoom() {
  const blockGesture = (event: Event) => {
    event.preventDefault()
  }

  document.addEventListener('gesturestart', blockGesture, { passive: false })
  document.addEventListener('gesturechange', blockGesture, { passive: false })
  document.addEventListener('gestureend', blockGesture, { passive: false })

  document.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey) {
        event.preventDefault()
      }
    },
    { passive: false },
  )
}

lockZoom()

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Service worker registration failed — app still works online
    })
  })
}
