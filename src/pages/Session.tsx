import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/schema'
import type { Exercise, WorkoutPlan } from '../db/schema'
import { ExerciseCard } from '../components/ExerciseCard'

export function Session() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
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

      const exs = await Promise.all(
        workoutPlan.exercises.map((pe) => db.exercises.get(pe.exerciseId)),
      )
      setPlan(workoutPlan)
      setExercises(exs.filter((e): e is Exercise => e != null))
      setCompletedIds(session.completedExerciseIds)
      setLoading(false)
    }
    load()
  }, [id, navigate])

  const cancelSession = async () => {
    if (
      !confirm(
        'Cancel this workout? All progress logged in this session will be deleted.',
      )
    ) {
      return
    }
    await db.setLogs.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
    navigate('/')
  }

  const total = exercises.length
  const done = completedIds.length
  const allDone = total > 0 && done === total

  if (loading || !plan) {
    return <p className="text-center text-slate-500">Loading session...</p>
  }

  return (
    <div>
      <Link to="/" className="mb-4 inline-block text-sm text-emerald-600">
        ← Home
      </Link>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{plan.name}</h1>
          <p className="text-sm text-slate-500">
            {done} of {total} exercises complete
          </p>
        </div>
        <button
          onClick={cancelSession}
          className="shrink-0 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 dark:border-red-900 dark:text-red-400"
        >
          Cancel
        </button>
      </div>

      <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>

      <div className="space-y-3">
        {plan.exercises.map((pe) => {
          const exercise = exercises.find((e) => e.id === pe.exerciseId)
          if (!exercise) return null
          return (
            <ExerciseCard
              key={pe.exerciseId}
              exercise={exercise}
              planExercise={pe}
              completed={completedIds.includes(pe.exerciseId)}
              sessionId={id}
            />
          )
        })}
      </div>

      {allDone ? (
        <Link
          to={`/session/${id}/summary`}
          className="mt-6 block rounded-2xl bg-emerald-600 py-4 text-center font-semibold text-white"
        >
          Finish workout →
        </Link>
      ) : (
        <Link
          to={`/session/${id}/summary`}
          className="mt-6 block text-center text-sm text-slate-500"
        >
          Finish early (save what you have)
        </Link>
      )}
    </div>
  )
}
