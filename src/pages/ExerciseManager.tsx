import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import type { DurationUnit, Exercise, ExerciseType } from '../db/schema'
import { assetUrl } from '../lib/assets'
import {
  DURATION_UNITS,
  EXERCISE_TYPES,
  MUSCLE_GROUPS,
  createEmptyExercise,
  exerciseSummaryLine,
  getPlansUsingExercise,
  resolveExerciseType,
  uniqueExerciseId,
} from '../lib/exercises'
import { IllustrationPicker } from '../components/IllustrationPicker'

export function ExerciseManager() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const all = await db.exercises.orderBy('name').toArray()
    setExercises(all)
  }

  useEffect(() => {
    load()
  }, [])

  const startNew = async () => {
    const id = await uniqueExerciseId('new-exercise')
    setEditing(createEmptyExercise(id))
    setIsNew(true)
    setError('')
  }

  const startEdit = (exercise: Exercise) => {
    setEditing({ ...exercise, exerciseType: resolveExerciseType(exercise) })
    setIsNew(false)
    setError('')
  }

  const setExerciseType = (type: ExerciseType) => {
    if (!editing) return
    const next: Exercise = { ...editing, exerciseType: type }
    if (type === 'cardio') {
      next.defaultDuration = next.defaultDuration ?? 30
      next.durationUnit = next.durationUnit ?? 'sec'
      delete next.defaultWeight
      delete next.defaultReps
    } else if (type === 'bodyweight') {
      next.defaultReps = next.defaultReps ?? 10
      delete next.defaultWeight
      delete next.defaultDuration
      delete next.durationUnit
    } else {
      next.defaultReps = next.defaultReps ?? 10
      delete next.defaultDuration
      delete next.durationUnit
    }
    setEditing(next)
  }

  const save = async () => {
    if (!editing) return
    if (!editing.name.trim()) {
      setError('Name is required.')
      return
    }
    if (!editing.instructions.trim()) {
      setError('Instructions are required.')
      return
    }

    const type = resolveExerciseType(editing)
    if (type === 'cardio' && !editing.defaultDuration) {
      setError('Default duration is required for cardio exercises.')
      return
    }

    setSaving(true)
    setError('')

    let record: Exercise = { ...editing, name: editing.name.trim() }
    if (type === 'cardio') {
      delete record.defaultReps
      delete record.defaultWeight
    } else if (type === 'bodyweight') {
      delete record.defaultWeight
      delete record.defaultDuration
      delete record.durationUnit
    } else {
      delete record.defaultDuration
      delete record.durationUnit
    }
    delete record.weightUnit

    if (isNew) {
      record = { ...record, id: await uniqueExerciseId(record.name) }
      await db.exercises.add(record)
    } else {
      await db.exercises.put(record)
    }

    await load()
    setEditing(null)
    setIsNew(false)
    setSaving(false)
  }

  const remove = async (exercise: Exercise) => {
    const plans = await getPlansUsingExercise(exercise.id)
    if (plans.length > 0) {
      alert(
        `Cannot delete "${exercise.name}" — it is used in: ${plans.join(', ')}. Remove it from those plans first.`,
      )
      return
    }

    if (
      !confirm(
        `Delete "${exercise.name}"? Past workout logs referencing this exercise may not display correctly.`,
      )
    ) {
      return
    }

    await db.exercises.delete(exercise.id)
    if (editing?.id === exercise.id) setEditing(null)
    await load()
  }

  const updateField = <K extends keyof Exercise>(
    field: K,
    value: Exercise[K],
  ) => {
    if (!editing) return
    setEditing({ ...editing, [field]: value })
  }

  if (editing) {
    const type = resolveExerciseType(editing)

    return (
      <div>
        <button
          onClick={() => {
            setEditing(null)
            setIsNew(false)
            setError('')
          }}
          className="mb-4 text-sm text-emerald-600"
        >
          ← Back to exercises
        </button>

        <h1 className="mb-4 text-2xl font-bold">
          {isNew ? 'New exercise' : 'Edit exercise'}
        </h1>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        <IllustrationPicker
          value={editing.illustration}
          onChange={(illustration) => {
            setError('')
            updateField('illustration', illustration)
          }}
          onError={setError}
        />

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Name</span>
            <input
              value={editing.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. Goblet Squat"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          {!isNew && (
            <label className="block">
              <span className="text-sm font-medium">ID</span>
              <input
                value={editing.id}
                readOnly
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-slate-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium">Exercise type</span>
            <select
              value={type}
              onChange={(e) =>
                setExerciseType(e.target.value as ExerciseType)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            >
              {EXERCISE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Muscle group</span>
            <select
              value={editing.muscleGroup}
              onChange={(e) => updateField('muscleGroup', e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            >
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">Instructions</span>
            <textarea
              value={editing.instructions}
              onChange={(e) => updateField('instructions', e.target.value)}
              rows={5}
              placeholder="How to perform this exercise..."
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Default sets</span>
            <input
              type="number"
              min={1}
              value={editing.defaultSets}
              onChange={(e) =>
                updateField('defaultSets', parseInt(e.target.value, 10) || 1)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          {type === 'cardio' && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium">Default duration</span>
                <input
                  type="number"
                  min={1}
                  step={editing.durationUnit === 'min' ? '0.5' : '1'}
                  value={editing.defaultDuration ?? ''}
                  onChange={(e) =>
                    updateField(
                      'defaultDuration',
                      parseFloat(e.target.value) || undefined,
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Duration unit</span>
                <select
                  value={editing.durationUnit ?? 'sec'}
                  onChange={(e) =>
                    updateField('durationUnit', e.target.value as DurationUnit)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  {DURATION_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {(type === 'strength' || type === 'bodyweight') && (
            <label className="block">
              <span className="text-sm font-medium">Default reps</span>
              <input
                value={editing.defaultReps ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  const asNumber = parseInt(raw, 10)
                  updateField(
                    'defaultReps',
                    raw !== '' && !Number.isNaN(asNumber) ? asNumber : raw,
                  )
                }}
                placeholder="10"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          )}

          {type === 'strength' && (
            <label className="block">
              <span className="text-sm font-medium">Default weight (kg)</span>
              <input
                type="number"
                step="0.5"
                value={editing.defaultWeight ?? ''}
                onChange={(e) =>
                  updateField(
                    'defaultWeight',
                    e.target.value ? parseFloat(e.target.value) : undefined,
                  )
                }
                placeholder="Optional starting weight"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          )}

          {type !== 'cardio' && (
            <label className="block">
              <span className="text-sm font-medium">
                {type === 'strength'
                  ? 'Starting weight note (optional)'
                  : 'Notes (optional)'}
              </span>
              <textarea
                value={editing.startingWeightNote ?? ''}
                onChange={(e) =>
                  updateField('startingWeightNote', e.target.value || undefined)
                }
                rows={3}
                placeholder={
                  type === 'strength'
                    ? 'e.g. Start with 8–12 kg'
                    : 'e.g. 10 reps per side'
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="mt-6 w-full rounded-2xl bg-emerald-600 py-4 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : isNew ? 'Create exercise' : 'Save exercise'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <Link to="/plans" className="mb-4 inline-block text-sm text-emerald-600">
        ← Back to plans
      </Link>

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Exercises</h1>
          <p className="text-sm text-slate-500">
            Manage the exercise library used in your workout plans
          </p>
        </div>
        <button
          onClick={startNew}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          + New
        </button>
      </div>

      {exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="text-slate-500">No exercises yet.</p>
          <button
            onClick={startNew}
            className="mt-3 text-sm font-medium text-emerald-600"
          >
            Create your first exercise
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {exercises.map((exercise) => (
            <div
              key={exercise.id}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <img
                src={assetUrl(exercise.illustration)}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl bg-slate-100 object-contain p-1 dark:bg-slate-800"
                onError={(e) => {
                  e.currentTarget.src = assetUrl('/illustrations/placeholder.svg')
                }}
              />
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{exercise.name}</h2>
                <p className="text-sm text-slate-500">
                  {exercise.muscleGroup} ·{' '}
                  {EXERCISE_TYPES.find(
                    (t) => t.value === resolveExerciseType(exercise),
                  )?.label.split(' ')[0]}
                </p>
                <p className="text-xs text-slate-400">
                  {exerciseSummaryLine(exercise)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2">
                <button
                  onClick={() => startEdit(exercise)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(exercise)}
                  className="rounded-xl border border-red-200 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
