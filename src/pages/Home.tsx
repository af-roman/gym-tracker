import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import { InstallPrompt } from '../components/InstallPrompt'
import { useTranslation } from '../context/SettingsContext'

export function Home() {
  const { t, locale } = useTranslation()
  const [activeSession, setActiveSession] = useState<{
    id: number
    planName: string
  } | null>(null)
  const [stats, setStats] = useState({ sessions: 0, lastWorkout: '' })

  useEffect(() => {
    async function load() {
      const incomplete = await db.sessions
        .filter((s) => !s.completed)
        .first()
      if (incomplete?.id) {
        const plan = await db.workoutPlans.get(incomplete.planId)
        setActiveSession({
          id: incomplete.id,
          planName: plan?.name ?? t('app.workout'),
        })
      }

      const completed = await db.sessions.filter((s) => s.completed).toArray()
      const last = completed.sort(
        (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
      )[0]
      setStats({
        sessions: completed.length,
        lastWorkout: last
          ? last.startedAt.toLocaleDateString(locale)
          : t('home.noWorkoutsYet'),
      })
    }
    load()
  }, [locale, t])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('app.name')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('app.tagline')}
        </p>
      </div>

      <InstallPrompt />

      {activeSession && (
        <Link
          to={`/session/${activeSession.id}`}
          className="mb-4 block rounded-2xl bg-amber-500 p-5 text-white shadow-lg"
        >
          <p className="text-sm font-medium opacity-90">{t('home.resumeWorkout')}</p>
          <p className="text-xl font-bold">{activeSession.planName}</p>
          <p className="mt-1 text-sm opacity-90">{t('home.tapToContinue')}</p>
        </Link>
      )}

      <Link
        to="/start"
        className="mb-6 block rounded-2xl bg-emerald-600 p-6 text-center text-white shadow-lg active:scale-[0.98]"
      >
        <p className="text-2xl font-bold">{t('home.startWorkout')}</p>
        <p className="mt-1 text-sm opacity-90">{t('home.startSubtitle')}</p>
      </Link>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-2xl font-bold">{stats.sessions}</p>
          <p className="text-sm text-slate-500">{t('home.workoutsDone')}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold">{stats.lastWorkout}</p>
          <p className="text-sm text-slate-500">{t('home.lastSession')}</p>
        </div>
      </div>

      <div className="space-y-3">
        <Link
          to="/dashboard"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="font-medium">{t('home.viewDashboard')}</span>
          <span className="text-slate-400">›</span>
        </Link>
        <Link
          to="/metrics"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="font-medium">{t('home.logBodyMetrics')}</span>
          <span className="text-slate-400">›</span>
        </Link>
        <Link
          to="/history"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="font-medium">{t('home.browseHistory')}</span>
          <span className="text-slate-400">›</span>
        </Link>
      </div>
    </div>
  )
}
