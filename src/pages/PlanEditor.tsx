import { useEffect, useState, type DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import type { Exercise, PlanExercise, WorkoutPlan } from '../db/schema'
import {
  formatExerciseMeta,
  isDurationExerciseType,
  planExerciseFromTemplate,
  resolveExerciseType,
} from '../lib/exercises'

function startExerciseRowDrag(
  event: DragEvent<HTMLButtonElement>,
  index: number,
  onStart: (index: number) => void,
) {
  onStart(index)
  const row = event.currentTarget.closest('[data-exercise-row]') as
    | HTMLElement
    | null
  if (!row || !event.dataTransfer) return

  const clone = row.cloneNode(true) as HTMLElement
  clone.setAttribute('data-drag-clone', 'true')
  clone.style.position = 'fixed'
  clone.style.top = '-10000px'
  clone.style.left = '0'
  clone.style.width = `${row.offsetWidth}px`
  clone.style.opacity = '0.95'
  clone.style.pointerEvents = 'none'
  clone.style.boxShadow = '0 16px 40px rgba(15, 23, 42, 0.18)'
  document.body.appendChild(clone)

  const rowRect = row.getBoundingClientRect()
  const handleRect = event.currentTarget.getBoundingClientRect()
  const offsetX = handleRect.left - rowRect.left + handleRect.width / 2
  const offsetY = rowRect.height / 2

  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', String(index))
  event.dataTransfer.setDragImage(clone, offsetX, offsetY)
}

function clearExerciseRowDragPreview() {
  document
    .querySelectorAll('[data-drag-clone]')
    .forEach((element) => element.remove())
}

export function PlanEditor() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [editing, setEditing] = useState<WorkoutPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const load = async () => {
    setPlans(await db.workoutPlans.toArray())
    setExercises(await db.exercises.toArray())
  }

  useEffect(() => {
    load()
  }, [])

  const startNewPlan = () => {
    setEditing({
      id: `plan-${Date.now()}`,
      name: '',
      description: '',
      exercises: [],
    })
  }

  const duplicatePlan = async (plan: WorkoutPlan) => {
    const copy: WorkoutPlan = {
      ...plan,
      id: `${plan.id}-copy-${Date.now()}`,
      name: `${plan.name} (Copy)`,
      exercises: [...plan.exercises],
    }
    await db.workoutPlans.add(copy)
    await load()
    setEditing(copy)
  }

  const removePlan = async (plan: WorkoutPlan) => {
    if (
      !confirm(
        `Delete "${plan.name}"? This cannot be undone. Past workout sessions using this plan will be kept.`,
      )
    ) {
      return
    }
    await db.workoutPlans.delete(plan.id)
    if (editing?.id === plan.id) setEditing(null)
    await load()
  }

  const savePlan = async () => {
    if (!editing) return
    setSaving(true)
    await db.workoutPlans.put(editing)
    await load()
    setEditing(null)
    setSaving(false)
  }

  const updateExerciseInPlan = (
    index: number,
    field:
      | 'defaultSets'
      | 'defaultReps'
      | 'defaultWeight'
      | 'defaultDuration'
      | 'durationUnit'
      | 'exerciseId',
    value: string | number,
  ) => {
    if (!editing) return
    const updated = { ...editing, exercises: [...editing.exercises] }
    const pe = { ...updated.exercises[index] }

    if (field === 'exerciseId') {
      const template = exercises.find((e) => e.id === value)
      if (template) {
        updated.exercises[index] = planExerciseFromTemplate(template)
      } else {
        pe.exerciseId = value as string
        updated.exercises[index] = pe
      }
    } else {
      if (field === 'defaultSets') pe.defaultSets = value as number
      else if (field === 'defaultReps') pe.defaultReps = value
      else if (field === 'defaultWeight')
        pe.defaultWeight = value ? (value as number) : undefined
      else if (field === 'defaultDuration')
        pe.defaultDuration = value ? (value as number) : undefined
      else if (field === 'durationUnit')
        pe.durationUnit = value as PlanExercise['durationUnit']
      updated.exercises[index] = pe
    }

    setEditing(updated)
  }

  const addExercise = () => {
    if (!editing || exercises.length === 0) return
    setEditing({
      ...editing,
      exercises: [
        ...editing.exercises,
        planExerciseFromTemplate(exercises[0]),
      ],
    })
  }

  const removeExercise = (index: number) => {
    if (!editing) return
    setEditing({
      ...editing,
      exercises: editing.exercises.filter((_, i) => i !== index),
    })
  }

  const reorderExercises = (fromIndex: number, toIndex: number) => {
    if (!editing || fromIndex === toIndex) return
    const next = [...editing.exercises]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    setEditing({ ...editing, exercises: next })
  }

  if (editing) {
    return (
      <div>
        <button
          onClick={() => setEditing(null)}
          className="mb-4 text-sm text-emerald-600"
        >
          ← Back to plans
        </button>
        <h1 className="mb-4 text-2xl font-bold">
          {editing.name ? 'Edit plan' : 'New plan'}
        </h1>

        <label className="mb-4 block">
          <span className="text-sm font-medium">Plan name</span>
          <input
            value={editing.name}
            onChange={(e) =>
              setEditing({ ...editing, name: e.target.value })
            }
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <label className="mb-4 block">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={editing.description}
            onChange={(e) =>
              setEditing({ ...editing, description: e.target.value })
            }
            rows={3}
            placeholder="What is this plan for?"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>

        <h2 className="mb-1 font-semibold">Exercises</h2>
        <p className="mb-3 text-xs text-slate-500">
          Drag the handle to reorder exercises
        </p>
        <div className="space-y-3">
          {editing.exercises.map((pe, index) => {
            const template = exercises.find((e) => e.id === pe.exerciseId)
            const type = template ? resolveExerciseType(template) : 'accessory'
            const durationType = isDurationExerciseType(type)
            const isDragging = dragIndex === index
            const isDragOver = dragOverIndex === index && dragIndex !== index

            return (
            <div
              key={`${pe.exerciseId}-${index}`}
              data-exercise-row
              onDragOver={(e) => {
                e.preventDefault()
                setDragOverIndex(index)
              }}
              onDragLeave={() => {
                if (dragOverIndex === index) setDragOverIndex(null)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIndex !== null) reorderExercises(dragIndex, index)
                clearExerciseRowDragPreview()
                setDragIndex(null)
                setDragOverIndex(null)
              }}
              className={`flex overflow-hidden rounded-2xl border transition-colors dark:border-slate-800 ${
                isDragOver
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-slate-200'
              } ${isDragging ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0 flex-1 p-4">
              {template && (
                <p className="mb-2 text-xs text-slate-500">
                  {formatExerciseMeta(template)}
                </p>
              )}
              <label className="mb-2 block">
                <span className="text-xs font-medium text-slate-500">
                  Exercise
                </span>
                <select
                  value={pe.exerciseId}
                  onChange={(e) =>
                    updateExerciseInPlan(index, 'exerciseId', e.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">
                    Sets
                  </span>
                  <input
                    type="number"
                    value={pe.defaultSets}
                    onChange={(e) =>
                      updateExerciseInPlan(
                        index,
                        'defaultSets',
                        parseInt(e.target.value, 10),
                      )
                    }
                    className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                {durationType ? (
                  <>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">
                        Duration
                      </span>
                      <input
                        type="number"
                        value={pe.defaultDuration ?? ''}
                        onChange={(e) =>
                          updateExerciseInPlan(
                            index,
                            'defaultDuration',
                            parseFloat(e.target.value),
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">
                        Unit
                      </span>
                      <select
                        value={pe.durationUnit ?? 'sec'}
                        onChange={(e) =>
                          updateExerciseInPlan(
                            index,
                            'durationUnit',
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      >
                        <option value="sec">sec</option>
                        <option value="min">min</option>
                      </select>
                    </label>
                  </>
                ) : (
                  <>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">
                        Reps
                      </span>
                      <input
                        value={pe.defaultReps ?? ''}
                        onChange={(e) =>
                          updateExerciseInPlan(
                            index,
                            'defaultReps',
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-slate-500">
                        Weight (kg)
                      </span>
                      <input
                        type="number"
                        value={pe.defaultWeight ?? ''}
                        onChange={(e) =>
                          updateExerciseInPlan(
                            index,
                            'defaultWeight',
                            parseFloat(e.target.value),
                          )
                        }
                        className="mt-1 w-full rounded-xl border border-slate-200 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                      />
                    </label>
                  </>
                )}
              </div>
              <button
                onClick={() => removeExercise(index)}
                className="mt-2 text-sm text-red-500"
              >
                Remove
              </button>
              </div>
              <button
                type="button"
                draggable
                onDragStart={(e) =>
                  startExerciseRowDrag(e, index, setDragIndex)
                }
                onDragEnd={() => {
                  clearExerciseRowDragPreview()
                  setDragIndex(null)
                  setDragOverIndex(null)
                }}
                className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center self-stretch border-l border-slate-200 bg-slate-50 text-slate-400 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800/50"
                aria-label={`Reorder ${template?.name ?? 'exercise'}`}
              >
                ⠿
              </button>
            </div>
          )})}
        </div>

        <button
          onClick={addExercise}
          disabled={exercises.length === 0}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-slate-300 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
        >
          + Add exercise
        </button>

        {exercises.length === 0 && (
          <p className="mt-2 text-center text-sm text-slate-500">
            <Link to="/plans/exercises" className="text-emerald-600">
              Create exercises
            </Link>{' '}
            before adding them to this plan.
          </p>
        )}

        <button
          onClick={savePlan}
          disabled={saving}
          className="mt-6 w-full rounded-2xl bg-emerald-600 py-4 font-semibold text-white"
        >
          {saving ? 'Saving...' : 'Save plan'}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Workout plans</h1>
          <p className="text-sm text-slate-500">
            Build plans from your exercise library
          </p>
        </div>
        <button
          onClick={startNewPlan}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          + New plan
        </button>
      </div>

      <Link
        to="/plans/exercises"
        className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <p className="font-semibold">Manage exercises</p>
          <p className="text-sm text-slate-500">
            Add, edit, or remove exercises in your library
          </p>
        </div>
        <span className="text-slate-400">›</span>
      </Link>

      <div className="space-y-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            role="button"
            tabIndex={0}
            onClick={() => setEditing(plan)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setEditing(plan)
              }
            }}
            className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
          >
            <div className="min-w-0 flex-1">
              <h2 className="font-bold">{plan.name}</h2>
              <p className="text-sm text-slate-500">{plan.description}</p>
              <p className="mt-1 text-xs text-slate-400">
                {plan.exercises.length} exercises
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  duplicatePlan(plan)
                }}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removePlan(plan)
                }}
                className="rounded-xl border border-red-200 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
