import type { Exercise } from '../db/schema'
import { useTranslation } from '../context/SettingsContext'
import { getExerciseMetaDisplay } from '../lib/exercises'

interface ExerciseMetaRowsProps {
  exercise: Exercise
  className?: string
}

export function ExerciseMetaRows({ exercise, className = '' }: ExerciseMetaRowsProps) {
  const { t } = useTranslation()
  const { type, muscles, level } = getExerciseMetaDisplay(exercise, {
    fullMuscles: true,
    t,
  })

  return (
    <p
      className={`break-words text-xs leading-snug text-slate-500 ${className}`}
    >
      <span className="text-slate-600 dark:text-slate-300">{type}</span>
      <span aria-hidden className="mx-1 text-slate-300 dark:text-slate-600">
        ·
      </span>
      <span>{muscles}</span>
      <span aria-hidden className="mx-1 text-slate-300 dark:text-slate-600">
        ·
      </span>
      <span className="font-medium text-slate-600 dark:text-slate-300">{level}</span>
    </p>
  )
}
