import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import type { Session } from '../db/schema'

interface HistoryEntry {
  session: Session
  planName: string
  loggedExercises: number
}

export function WorkoutHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sessions = await db.sessions
        .filter((s) => s.completed)
        .toArray()
      sessions.sort(
        (a, b) =>
          (b.completedAt ?? b.startedAt).getTime() -
          (a.completedAt ?? a.startedAt).getTime(),
      )

      const loaded = await Promise.all(
        sessions.map(async (session) => {
          const plan = await db.workoutPlans.get(session.planId)
          const logs = await db.setLogs
            .where('sessionId')
            .equals(session.id!)
            .toArray()
          const loggedExercises = new Set(logs.map((l) => l.exerciseId)).size
          return {
            session,
            planName: plan?.name ?? 'Workout',
            loggedExercises,
          }
        }),
      )
      setEntries(loaded)
      setLoading(false)
    }
    load()
  }, [])

  const formatDate = (session: Session) => {
    const d = session.completedAt ?? session.startedAt
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-emerald-600">
        ← Home
      </Link>
      <h1 className="mb-2 text-2xl font-bold">Workout history</h1>
      <p className="mb-6 text-sm text-slate-500">
        Browse past completed workouts
      </p>

      {loading ? (
        <p className="text-center text-slate-500">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No completed workouts yet. Finish a session to see it here.
        </p>
      ) : (
        <div className="space-y-3">
          {entries.map(({ session, planName, loggedExercises }) => (
            <Link
              key={session.id}
              to={`/history/${session.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-bold">{planName}</h2>
                  <p className="text-sm text-slate-500">
                    {formatDate(session)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {loggedExercises} exercise
                    {loggedExercises === 1 ? '' : 's'} logged
                    {session.overallRpe != null
                      ? ` · RPE ${session.overallRpe}`
                      : ''}
                  </p>
                  {session.notes?.trim() && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                      {session.notes}
                    </p>
                  )}
                </div>
                <span className="shrink-0 text-slate-400">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
