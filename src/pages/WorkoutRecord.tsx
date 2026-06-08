import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/schema'
import type { Exercise, Session, SetLog, WorkoutPlan } from '../db/schema'
import { formatLoggedSet } from '../lib/exercises'
import { resolveSessionExerciseId } from '../lib/session'

export function WorkoutRecord() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [swaps, setSwaps] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<(SetLog & { exercise?: Exercise })[]>([])
  const [loading, setLoading] = useState(true)

  const sid = parseInt(sessionId ?? '0', 10)

  useEffect(() => {
    async function load() {
      const loadedSession = await db.sessions.get(sid)
      if (!loadedSession || !loadedSession.completed) {
        navigate('/history')
        return
      }
      const workoutPlan = await db.workoutPlans.get(loadedSession.planId)
      const allLogs = await db.setLogs.where('sessionId').equals(sid).toArray()
      const enriched = await Promise.all(
        allLogs.map(async (log) => ({
          ...log,
          exercise: await db.exercises.get(log.exerciseId),
        })),
      )
      setSession(loadedSession)
      setPlan(workoutPlan ?? null)
      setSwaps(loadedSession.exerciseSwaps ?? {})
      setLogs(enriched)
      setLoading(false)
    }
    load()
  }, [sid, navigate])

  if (loading || !session || !plan) {
    return <p className="text-center text-slate-500">Loading...</p>
  }

  const when = (session.completedAt ?? session.startedAt).toLocaleDateString(
    undefined,
    {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    },
  )

  const grouped = plan.exercises.map((pe) => {
    const resolvedId = resolveSessionExerciseId(pe.exerciseId, swaps)
    return {
      resolvedId,
      swapped: resolvedId !== pe.exerciseId,
      exercise: logs.find((l) => l.exerciseId === resolvedId)?.exercise,
      sets: logs.filter((l) => l.exerciseId === resolvedId),
    }
  })

  return (
    <div>
      <Link to="/history" className="mb-4 inline-block text-sm text-emerald-600">
        ← Workout history
      </Link>
      <h1 className="mb-1 text-2xl font-bold">{plan.name}</h1>
      <p className="mb-6 text-sm text-slate-500">{when}</p>

      {session.overallRpe != null && (
        <p className="mb-4 rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          Overall RPE: <span className="font-semibold">{session.overallRpe}</span>
        </p>
      )}

      {session.notes?.trim() && (
        <p className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          {session.notes}
        </p>
      )}

      <div className="space-y-4">
        {grouped.map(({ resolvedId, swapped, exercise, sets }) => (
          <div
            key={resolvedId}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="font-semibold">{exercise?.name ?? 'Exercise'}</h3>
            {swapped && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Substituted for this session
              </p>
            )}
            {sets.length === 0 ? (
              <p className="text-sm text-slate-400">Not logged</p>
            ) : exercise ? (
              <ul className="mt-2 space-y-1 text-sm">
                {sets.map((s) => (
                  <li
                    key={s.id}
                    className="text-slate-600 dark:text-slate-300"
                  >
                    Set {s.setNumber}:{' '}
                    {formatLoggedSet(exercise, s.actualReps, s.actualWeight)}
                    {s.rpe ? ` · RPE ${s.rpe}` : ''}
                    {s.notes ? ` · ${s.notes}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
