import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from '../context/SettingsContext'

const navItems = [
  { to: '/', labelKey: 'nav.home', icon: '🏠' },
  { to: '/dashboard', labelKey: 'nav.progress', icon: '📈' },
  { to: '/metrics', labelKey: 'nav.body', icon: '⚖️' },
  { to: '/plans', labelKey: 'nav.plans', icon: '📋' },
  { to: '/settings', labelKey: 'nav.settings', icon: '⚙️' },
] as const

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { t } = useTranslation()

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <main className="flex-1 px-4 pb-24 pt-4">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-lg justify-around px-1 py-2">
          {navItems.map((item) => {
            const active =
              item.to === '/plans'
                ? location.pathname.startsWith('/plans')
                : location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex min-w-[3.25rem] flex-col items-center rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {t(item.labelKey)}
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
