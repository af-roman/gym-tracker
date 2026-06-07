import { Link } from 'react-router-dom'
import type { Exercise, PlanExercise } from '../db/schema'
import { assetUrl } from '../lib/assets'
import { formatPlanTarget } from '../lib/exercises'

interface ExerciseCardProps {
  exercise: Exercise
  planExercise: PlanExercise
  completed: boolean
  sessionId: number
}

export function ExerciseCard({
  exercise,
  planExercise,
  completed,
  sessionId,
}: ExerciseCardProps) {
  return (
    <Link
      to={`/session/${sessionId}/exercise/${exercise.id}`}
      className={`flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
        completed
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
          : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800'
      }`}
    >
      <img
        src={assetUrl(exercise.illustration)}
        alt=""
        className="h-16 w-16 shrink-0 rounded-xl bg-slate-100 object-contain p-1 dark:bg-slate-800"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{exercise.name}</h3>
          {completed && (
            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
              Done
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {formatPlanTarget(exercise, planExercise)}
        </p>
        <p className="text-xs text-slate-400">{exercise.muscleGroup}</p>
      </div>
      <span className="text-slate-400">›</span>
    </Link>
  )
}
