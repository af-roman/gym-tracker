import type { DurationUnit, Exercise, ExerciseType, PlanExercise, SetLog } from '../db/schema'
import {
  getPlanDuration,
  isDurationExerciseType,
  resolveExerciseType,
} from '../lib/exercises'
import { rpeLabel } from '../lib/rpe'

export interface SetDraft {
  setNumber: number
  targetReps: number | string
  targetWeight?: number
  actualReps: number
  actualWeight?: number
  rpe: number
  notes: string
}

interface SetLoggerProps {
  exerciseType: ExerciseType
  durationUnit?: DurationUnit
  sets: SetDraft[]
  onChange: (sets: SetDraft[]) => void
  onAddSet: () => void
}

export function SetLogger({
  exerciseType,
  durationUnit = 'sec',
  sets,
  onChange,
  onAddSet,
}: SetLoggerProps) {
  const updateSet = (index: number, patch: Partial<SetDraft>) => {
    const next = sets.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange(next)
  }

  const removeSet = (index: number) => {
    if (sets.length <= 1) return
    const next = sets
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, setNumber: i + 1 }))
    onChange(next)
  }

  const durationType = isDurationExerciseType(exerciseType)

  const valueLabel = durationType
    ? durationUnit === 'min'
      ? 'Minutes'
      : 'Seconds'
    : 'Reps'

  return (
    <div className="space-y-4">
      {sets.map((set, index) => (
        <div
          key={`${set.setNumber}-${index}`}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="font-semibold">Set {set.setNumber}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                Target:{' '}
                {durationType
                  ? `${set.targetReps} ${durationUnit}`
                  : set.targetWeight != null
                    ? `${set.targetReps} @ ${set.targetWeight} kg`
                    : set.targetReps}
              </span>
              {sets.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSet(index)}
                  className="text-sm font-medium text-red-500"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div
            className={`grid gap-3 ${durationType ? 'grid-cols-1' : 'grid-cols-2'}`}
          >
            <label className="block">
              <span className="text-xs text-slate-500">{valueLabel}</span>
              <input
                type="number"
                inputMode="numeric"
                step={durationType && durationUnit === 'min' ? '0.5' : '1'}
                value={set.actualReps || ''}
                onChange={(e) =>
                  updateSet(index, {
                    actualReps: parseFloat(e.target.value) || 0,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-lg font-medium dark:border-slate-700 dark:bg-slate-800"
              />
            </label>

            {!durationType && (
              <label className="block">
                <span className="text-xs text-slate-500">Weight (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={set.actualWeight ?? ''}
                  onChange={(e) =>
                    updateSet(index, {
                      actualWeight: e.target.value
                        ? parseFloat(e.target.value)
                        : undefined,
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-lg font-medium dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            )}
          </div>

          <label className="mt-3 block">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Difficulty (RPE)</span>
              <span>
                {set.rpe} — {rpeLabel(set.rpe)}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={set.rpe}
              onChange={(e) =>
                updateSet(index, { rpe: parseInt(e.target.value, 10) })
              }
              className="mt-1 w-full"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-xs text-slate-500">Notes (optional)</span>
            <input
              type="text"
              value={set.notes}
              onChange={(e) => updateSet(index, { notes: e.target.value })}
              placeholder="e.g. felt heavy on last rep"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
        </div>
      ))}

      <button
        onClick={onAddSet}
        className="w-full rounded-2xl border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:text-slate-400"
      >
        + Add set
      </button>
    </div>
  )
}

function defaultTarget(exercise: Exercise, pe: PlanExercise) {
  const type = resolveExerciseType(exercise)
  if (isDurationExerciseType(type)) {
    const { value } = getPlanDuration(exercise, pe)
    return { targetReps: value, targetWeight: undefined as number | undefined }
  }
  return {
    targetReps: pe.defaultReps ?? exercise.defaultReps ?? 10,
    targetWeight: pe.defaultWeight,
  }
}

export function setsToDrafts(
  logs: SetLog[],
  exercise: Exercise,
  pe: PlanExercise,
): SetDraft[] {
  if (logs.length > 0) {
    return logs.map((l) => ({
      setNumber: l.setNumber,
      targetReps: l.targetReps,
      targetWeight: l.targetWeight,
      actualReps: l.actualReps,
      actualWeight: l.actualWeight,
      rpe: l.rpe ?? 5,
      notes: l.notes ?? '',
    }))
  }

  const { targetReps, targetWeight } = defaultTarget(exercise, pe)
  const type = resolveExerciseType(exercise)
  const defaultActual =
    isDurationExerciseType(type) || typeof targetReps === 'number'
      ? Number(targetReps) || 0
      : 0

  return Array.from({ length: pe.defaultSets }, (_, i) => ({
    setNumber: i + 1,
    targetReps,
    targetWeight,
    actualReps: defaultActual,
    actualWeight: targetWeight,
    rpe: 5,
    notes: '',
  }))
}

export function newSetDraft(
  exercise: Exercise,
  pe: PlanExercise,
  setNumber: number,
): SetDraft {
  const { targetReps, targetWeight } = defaultTarget(exercise, pe)
  const type = resolveExerciseType(exercise)
  return {
    setNumber,
    targetReps,
    targetWeight,
    actualReps:
      isDurationExerciseType(type) || typeof targetReps === 'number'
        ? Number(targetReps) || 0
        : 0,
    actualWeight: targetWeight,
    rpe: 5,
    notes: '',
  }
}
