import { useMemo, useState } from 'react'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'
import type { Exercise, ExerciseDifficulty, ExerciseType } from '../db/schema'
import { useTranslation } from '../context/SettingsContext'
import {
  EXERCISE_DIFFICULTIES,
  EXERCISE_TYPES,
  MUSCLE_GROUPS,
  filterExercises,
} from '../lib/exercises'
import { ExerciseMetaRows } from './ExerciseMetaRows'
import { ExerciseThumbnail } from './ExerciseThumbnail'

interface ExercisePickerProps {
  open: boolean
  title: string
  description?: string
  exercises: Exercise[]
  selectedId?: string
  excludeIds?: Set<string>
  onSelect: (exercise: Exercise) => void
  onClose: () => void
}

export function ExercisePicker({
  open,
  title,
  description,
  exercises,
  selectedId,
  excludeIds,
  onSelect,
  onClose,
}: ExercisePickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ExerciseType | ''>('')
  const [muscleGroupFilter, setMuscleGroupFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<
    ExerciseDifficulty | ''
  >('')

  const filtered = useMemo(() => {
    const matches = filterExercises(exercises, {
      query,
      type: typeFilter,
      muscleGroup: muscleGroupFilter,
      difficulty: difficultyFilter,
    })
    if (!excludeIds?.size) return matches
    return matches.filter((exercise) => !excludeIds.has(exercise.id))
  }, [
    exercises,
    query,
    typeFilter,
    muscleGroupFilter,
    difficultyFilter,
    excludeIds,
  ])

  const clearFilters = () => {
    setQuery('')
    setTypeFilter('')
    setMuscleGroupFilter('')
    setDifficultyFilter('')
  }

  useBodyScrollLock(open)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-picker-title"
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 p-5 dark:border-slate-800">
          <h2 id="exercise-picker-title" className="text-lg font-bold">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}

          <label className="mt-4 block">
            <span className="sr-only">{t('exercises.searchExercises')}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('common.searchByName')}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as ExerciseType | '')
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">{t('common.allTypes')}</option>
              {EXERCISE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {t(`exerciseType.${type.value}`)}
                </option>
              ))}
            </select>
            <select
              value={muscleGroupFilter}
              onChange={(e) => setMuscleGroupFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">{t('common.allMuscleGroups')}</option>
              {MUSCLE_GROUPS.map((group) => (
                <option key={group} value={group}>
                  {t(`muscleGroup.${group}`)}
                </option>
              ))}
            </select>
            <select
              value={difficultyFilter}
              onChange={(e) =>
                setDifficultyFilter(e.target.value as ExerciseDifficulty | '')
              }
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">{t('common.allLevels')}</option>
              {EXERCISE_DIFFICULTIES.map((level) => (
                <option key={level.value} value={level.value}>
                  {t(`difficulty.${level.value}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {filtered.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-slate-500">
              <p>{t('exercises.noPickerResults')}</p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-3 font-medium text-emerald-600"
              >
                {t('common.clearFilters')}
              </button>
            </div>
          ) : (
            <>
              <p className="mb-2 px-1 text-xs text-slate-500">
                {t('exercises.pickerCount', { count: filtered.length })}
              </p>
              <div className="space-y-2">
                {filtered.map((exercise) => {
                  const isSelected = exercise.id === selectedId
                  return (
                    <button
                      key={exercise.id}
                      type="button"
                      onClick={() => onSelect(exercise)}
                      className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                          : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20'
                      }`}
                    >
                      <ExerciseThumbnail
                        exercise={exercise}
                        className="h-12 w-12 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-tight break-words">
                          {exercise.name}
                        </p>
                        <ExerciseMetaRows exercise={exercise} className="mt-0.5" />
                      </div>
                      {isSelected && (
                        <span className="shrink-0 text-xs font-medium text-emerald-600">
                          {t('common.current')}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700"
          >
            {t('common.cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
