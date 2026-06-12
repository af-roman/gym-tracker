import { useEffect, useState } from 'react'
import { useTranslation } from '../context/SettingsContext'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const { t } = useTranslation()
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('install-dismissed') === 'true',
  )
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream
    setIsIOS(ios)
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (dismissed || isStandalone) return null

  const dismiss = () => {
    localStorage.setItem('install-dismissed', 'true')
    setDismissed(true)
  }

  const install = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    dismiss()
  }

  return (
    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/50">
      <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
        {t('install.title')}
      </p>
      <p className="mt-1 text-sm text-emerald-800/80 dark:text-emerald-200/80">
        {isIOS ? t('install.ios') : t('install.default')}
      </p>
      <div className="mt-3 flex gap-2">
        {!isIOS && deferredPrompt && (
          <button
            onClick={install}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {t('common.install')}
          </button>
        )}
        <button
          onClick={dismiss}
          className="rounded-xl px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"
        >
          {t('common.dismiss')}
        </button>
      </div>
    </div>
  )
}
