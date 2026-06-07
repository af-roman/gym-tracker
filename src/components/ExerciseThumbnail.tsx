import type { Exercise } from '../db/schema'
import { getExerciseThumbnail } from '../lib/exercises'

interface ExerciseThumbnailProps {
  exercise: Exercise
  className?: string
}

export function ExerciseThumbnail({
  exercise,
  className = 'h-16 w-16',
}: ExerciseThumbnailProps) {
  const src = getExerciseThumbnail(exercise)

  if (!src) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-400 dark:bg-slate-800 ${className}`}
        aria-hidden
      >
        {exercise.name.charAt(0).toUpperCase() || '?'}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className={`shrink-0 rounded-xl bg-slate-100 object-cover dark:bg-slate-800 ${className}`}
    />
  )
}
