import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/schema'
import type { Exercise, PlanExercise, WorkoutPlan } from '../db/schema'
import { ExerciseCard } from '../components/ExerciseCard'
import { useTranslation } from '../context/SettingsContext'
import { resolveSessionExerciseId } from '../lib/session'

interface SessionExerciseEntry {
  planExercise: PlanExercise
  exercise: Exercise
  swappedFromName?: string
}

export function Session() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [entries, setEntries] = useState<SessionExerciseEntry[]>([])
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const id = parseInt(sessionId ?? '0', 10)

  useEffect(() => {
    async function load() {
      const session = await db.sessions.get(id)
      if (!session) {
        navigate('/')
        return
      }
      const workoutPlan = await db.workoutPlans.get(session.planId)
      if (!workoutPlan) return

      const swaps = session.exerciseSwaps ?? {}
      const loaded: SessionExerciseEntry[] = []
      for (const pe of workoutPlan.exercises) {
        const resolvedId = resolveSessionExerciseId(pe.exerciseId, swaps)
        const exercise = await db.exercises.get(resolvedId)
        if (!exercise) continue
        const original =
          resolvedId !== pe.exerciseId
            ? await db.exercises.get(pe.exerciseId)
            : null
        loaded.push({
          planExercise: pe,
          exercise,
          swappedFromName: original?.name,
        })
      }
      setPlan(workoutPlan)
      setEntries(loaded)
      setCompletedIds(session.completedExerciseIds)
      setLoading(false)
    }
    load()
  }, [id, navigate])

  const cancelSession = async () => {
    if (!confirm(t('session.cancelConfirm'))) return
    await db.setLogs.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
    navigate('/')
  }

  const total = entries.length
  const done = completedIds.length
  const allDone = total > 0 && done === total

  if (loading || !plan) {
    return <p className="text-center text-slate-500">{t('common.loadingSession')}</p>
  }

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-emerald-600">
        {t('common.home')}
      </Link>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{plan.name}</h1>
          <p className="text-sm text-slate-500">
            {t('session.exercisesComplete', { done, total })}
          </p>
        </div>
        <button
          onClick={cancelSession}
          className="shrink-0 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 dark:border-red-900 dark:text-red-400"
        >
          {t('session.cancel')}
        </button>
      </div>

      <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>

      <div className="space-y-3">
        {entries.map(({ planExercise, exercise, swappedFromName }) => (
          <ExerciseCard
            key={planExercise.exerciseId}
            exercise={exercise}
            planExercise={planExercise}
            completed={completedIds.includes(exercise.id)}
            sessionId={id}
            swappedFromName={swappedFromName}
          />
        ))}
      </div>

      {allDone ? (
        <Link
          to={`/session/${id}/summary`}
          className="mt-6 block rounded-2xl bg-emerald-600 py-4 text-center font-semibold text-white"
        >
          {t('session.finishWorkout')}
        </Link>
      ) : (
        <Link
          to={`/session/${id}/summary`}
          className="mt-6 block text-center text-sm text-slate-500"
        >
          {t('session.finishEarly')}
        </Link>
      )}
    </div>
  )
}
