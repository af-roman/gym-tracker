import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import { InstallPrompt } from '../components/InstallPrompt'
import { ThemeToggle } from '../components/ThemeToggle'

export function Home() {
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
          planName: plan?.name ?? 'Workout',
        })
      }

      const completed = await db.sessions.filter((s) => s.completed).toArray()
      const last = completed.sort(
        (a, b) => b.startedAt.getTime() - a.startedAt.getTime(),
      )[0]
      setStats({
        sessions: completed.length,
        lastWorkout: last
          ? last.startedAt.toLocaleDateString()
          : 'No workouts yet',
      })
    }
    load()
  }, [])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gym Tracker</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your personal workout companion
          </p>
        </div>
        <ThemeToggle />
      </div>

      <InstallPrompt />

      {activeSession && (
        <Link
          to={`/session/${activeSession.id}`}
          className="mb-4 block rounded-2xl bg-amber-500 p-5 text-white shadow-lg"
        >
          <p className="text-sm font-medium opacity-90">Resume workout</p>
          <p className="text-xl font-bold">{activeSession.planName}</p>
          <p className="mt-1 text-sm opacity-90">Tap to continue →</p>
        </Link>
      )}

      <Link
        to="/start"
        className="mb-6 block rounded-2xl bg-emerald-600 p-6 text-center text-white shadow-lg active:scale-[0.98]"
      >
        <p className="text-2xl font-bold">Start Workout</p>
        <p className="mt-1 text-sm opacity-90">Pick a plan and hit the gym</p>
      </Link>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-2xl font-bold">{stats.sessions}</p>
          <p className="text-sm text-slate-500">Workouts done</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-semibold">{stats.lastWorkout}</p>
          <p className="text-sm text-slate-500">Last session</p>
        </div>
      </div>

      <div className="space-y-3">
        <Link
          to="/dashboard"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="font-medium">View progress dashboard</span>
          <span className="text-slate-400">›</span>
        </Link>
        <Link
          to="/metrics"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="font-medium">Log body metrics</span>
          <span className="text-slate-400">›</span>
        </Link>
        <Link
          to="/history"
          className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <span className="font-medium">Browse workout history</span>
          <span className="text-slate-400">›</span>
        </Link>
      </div>
    </div>
  )
}
