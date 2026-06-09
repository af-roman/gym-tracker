import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import type { Exercise, PlanExercise, WorkoutPlan } from '../db/schema'
import { ExercisePicker } from '../components/ExercisePicker'
import { ExerciseThumbnail } from '../components/ExerciseThumbnail'
import {
  formatExerciseMeta,
  isDurationExerciseType,
  planExerciseFromTemplate,
  resolveExerciseType,
} from '../lib/exercises'

type PickerTarget =
  | { mode: 'change'; index: number }
  | { mode: 'add' }
  | null

const AUTO_SCROLL_EDGE_PX = 72
const AUTO_SCROLL_MAX_SPEED = 16
const GHOST_GRAB_OFFSET_Y = 36
const POINTER_LISTENER_OPTS = { capture: true, passive: false } as const

function clearTextSelection() {
  window.getSelection()?.removeAllRanges()
}

/**
 * Insert slot 0..n in the full list (before row i = slot i, after last row = slot n).
 * Pointer in the top half of a row (or gap above it) → slot = row index.
 * Pointer in the bottom half (or gap below) → slot = row index + 1.
 */
function findInsertSlot(
  listEl: HTMLElement,
  clientY: number,
  rowCount: number,
): number {
  if (rowCount === 0) return 0

  const rows = Array.from(
    listEl.querySelectorAll<HTMLElement>('[data-exercise-row]'),
  )
    .map((row) => ({
      index: parseInt(row.dataset.rowIndex ?? '-1', 10),
      rect: row.getBoundingClientRect(),
    }))
    .filter((row) => row.index >= 0 && row.rect.height > 0)
    .sort((a, b) => a.index - b.index)

  if (rows.length === 0) return rowCount

  for (const { index, rect } of rows) {
    const midY = rect.top + rect.height / 2
    if (clientY < midY) {
      return index
    }
  }

  return rowCount
}

function insertSlotToIndex(
  insertSlot: number,
  fromIndex: number,
  rowCount: number,
): number {
  if (rowCount === 0) return 0
  if (insertSlot >= rowCount) return rowCount - 1
  return insertSlot > fromIndex ? insertSlot - 1 : insertSlot
}

/** Slots dragIndex and dragIndex+1 share one visual gap while the row is lifted. */
function normalizeInsertSlot(
  slot: number,
  dragIndex: number,
  rowCount: number,
): number {
  if (slot === dragIndex + 1 && slot < rowCount) {
    return dragIndex
  }
  return slot
}

function staticifyFormControls(root: HTMLElement) {
  root.querySelectorAll('input').forEach((input) => {
    const div = document.createElement('div')
    div.className = `${input.className} flex min-h-[2.5rem] items-center text-sm`
    div.textContent = input.value
    input.replaceWith(div)
  })

  root.querySelectorAll('select').forEach((select) => {
    const div = document.createElement('div')
    div.className = `${select.className} flex min-h-[2.5rem] items-center text-sm`
    div.textContent =
      select.options[select.selectedIndex]?.text ?? select.value
    select.replaceWith(div)
  })

  root.querySelectorAll('textarea').forEach((textarea) => {
    const div = document.createElement('div')
    div.className = textarea.className
    div.textContent = textarea.value
    textarea.replaceWith(div)
  })
}

function createDragGhost(
  row: HTMLElement,
  clientX: number,
  clientY: number,
): HTMLElement {
  const clone = row.cloneNode(true) as HTMLElement
  clone.setAttribute('data-drag-ghost', 'true')

  clone.querySelectorAll('button').forEach((button) => {
    const label = button.getAttribute('aria-label') ?? ''
    if (label.startsWith('Reorder') || button.textContent?.trim() === 'Delete') {
      button.remove()
      return
    }

    const div = document.createElement('div')
    div.className = button.className
    div.innerHTML = button.innerHTML
    button.replaceWith(div)
  })

  staticifyFormControls(clone)

  const rect = row.getBoundingClientRect()
  clone.style.position = 'fixed'
  clone.style.left = '0'
  clone.style.top = '0'
  clone.style.width = `${rect.width}px`
  clone.style.zIndex = '9999'
  clone.style.pointerEvents = 'none'
  clone.style.opacity = '0.95'
  clone.style.boxShadow = '0 16px 40px rgba(15, 23, 42, 0.22)'
  clone.style.transform = `translate(${clientX - rect.width / 2}px, ${clientY - GHOST_GRAB_OFFSET_Y}px)`

  document.body.appendChild(clone)
  return clone
}

function updateDragGhost(
  ghost: HTMLElement,
  clientX: number,
  clientY: number,
  width: number,
) {
  ghost.style.transform = `translate(${clientX - width / 2}px, ${clientY - GHOST_GRAB_OFFSET_Y}px)`
}

function DropPlaceholder() {
  return (
    <div
      className="flex min-h-[4.5rem] items-center justify-center rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/60 transition-[height,opacity,margin] duration-150 ease-out dark:border-emerald-700 dark:bg-emerald-950/30 motion-reduce:transition-none"
      aria-hidden
    />
  )
}

export function PlanEditor() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [editing, setEditing] = useState<WorkoutPlan | null>(null)
  const [saving, setSaving] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [insertSlot, setInsertSlot] = useState<number | null>(null)
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null)

  const dragIndexRef = useRef<number | null>(null)
  const insertSlotRef = useRef<number | null>(null)
  const rowCountRef = useRef(0)
  const exerciseListRef = useRef<HTMLDivElement>(null)
  const dragGhostRef = useRef<HTMLElement | null>(null)
  const ghostWidthRef = useRef(0)
  const lastPointerRef = useRef({ x: 0, y: 0 })
  const autoScrollRafRef = useRef<number | null>(null)
  const scrollLockRef = useRef<{ body: string; html: string } | null>(null)
  const pointerSessionRef = useRef<{
    moveHandler: (event: globalThis.PointerEvent) => void
    upHandler: (event: globalThis.PointerEvent) => void
    cancelHandler: (event: globalThis.PointerEvent) => void
    captureTarget: HTMLElement | null
    pointerId: number
  } | null>(null)

  const lockPageScroll = () => {
    if (scrollLockRef.current) return
    scrollLockRef.current = {
      body: document.body.style.touchAction,
      html: document.documentElement.style.touchAction,
    }
    document.body.style.touchAction = 'none'
    document.documentElement.style.touchAction = 'none'
  }

  const unlockPageScroll = () => {
    if (!scrollLockRef.current) return
    document.body.style.touchAction = scrollLockRef.current.body
    document.documentElement.style.touchAction = scrollLockRef.current.html
    scrollLockRef.current = null
  }

  const removeDragGhost = () => {
    dragGhostRef.current?.remove()
    dragGhostRef.current = null
    ghostWidthRef.current = 0
  }

  const stopAutoScroll = () => {
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current)
      autoScrollRafRef.current = null
    }
  }

  const updateDropTarget = (clientY: number) => {
    const list = exerciseListRef.current
    if (!list || dragIndexRef.current === null) return

    const slot = normalizeInsertSlot(
      findInsertSlot(list, clientY, rowCountRef.current),
      dragIndexRef.current,
      rowCountRef.current,
    )
    if (insertSlotRef.current !== slot) {
      insertSlotRef.current = slot
      setInsertSlot(slot)
    }
  }

  const startAutoScrollLoop = () => {
    const tick = () => {
      if (dragIndexRef.current === null) {
        stopAutoScroll()
        return
      }

      const { y } = lastPointerRef.current
      if (y < AUTO_SCROLL_EDGE_PX) {
        const speed =
          ((AUTO_SCROLL_EDGE_PX - y) / AUTO_SCROLL_EDGE_PX) *
          AUTO_SCROLL_MAX_SPEED
        window.scrollBy(0, -speed)
      } else if (y > window.innerHeight - AUTO_SCROLL_EDGE_PX) {
        const speed =
          ((y - (window.innerHeight - AUTO_SCROLL_EDGE_PX)) /
            AUTO_SCROLL_EDGE_PX) *
          AUTO_SCROLL_MAX_SPEED
        window.scrollBy(0, speed)
      }

      updateDropTarget(lastPointerRef.current.y)
      autoScrollRafRef.current = requestAnimationFrame(tick)
    }

    stopAutoScroll()
    autoScrollRafRef.current = requestAnimationFrame(tick)
  }

  const load = async () => {
    setPlans(await db.workoutPlans.toArray())
    setExercises(await db.exercises.toArray())
  }

  useEffect(() => {
    load()
  }, [])

  const cancelPointerSession = () => {
    const session = pointerSessionRef.current
    if (session) {
      window.removeEventListener(
        'pointermove',
        session.moveHandler,
        POINTER_LISTENER_OPTS,
      )
      window.removeEventListener(
        'pointerup',
        session.upHandler,
        POINTER_LISTENER_OPTS,
      )
      window.removeEventListener(
        'pointercancel',
        session.cancelHandler,
        POINTER_LISTENER_OPTS,
      )
      if (
        session.captureTarget?.hasPointerCapture(session.pointerId)
      ) {
        session.captureTarget.releasePointerCapture(session.pointerId)
      }
      pointerSessionRef.current = null
    }
    unlockPageScroll()
    stopAutoScroll()
    removeDragGhost()
  }

  useEffect(() => () => cancelPointerSession(), [])

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

  const openAddExercisePicker = () => {
    if (!editing || exercises.length === 0) return
    setPickerTarget({ mode: 'add' })
  }

  const handlePickerSelect = (exercise: Exercise) => {
    if (!editing || !pickerTarget) return

    if (pickerTarget.mode === 'add') {
      setEditing({
        ...editing,
        exercises: [
          ...editing.exercises,
          planExerciseFromTemplate(exercise),
        ],
      })
    } else {
      updateExerciseInPlan(pickerTarget.index, 'exerciseId', exercise.id)
    }

    setPickerTarget(null)
  }

  const pickerExcludeIds = useMemo(() => {
    if (!editing) return new Set<string>()
    if (pickerTarget?.mode === 'change') {
      return new Set(
        editing.exercises
          .filter((_, index) => index !== pickerTarget.index)
          .map((pe) => pe.exerciseId),
      )
    }
    return new Set(editing.exercises.map((pe) => pe.exerciseId))
  }, [editing, pickerTarget])

  const pickerSelectedId =
    pickerTarget?.mode === 'change' && editing
      ? editing.exercises[pickerTarget.index]?.exerciseId
      : undefined

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

  const endReorder = (
    fromIndex: number | null,
    slot: number | null,
    rowCount: number,
  ) => {
    cancelPointerSession()
    if (fromIndex !== null && slot !== null) {
      const toIndex = insertSlotToIndex(slot, fromIndex, rowCount)
      reorderExercises(fromIndex, toIndex)
    }
    dragIndexRef.current = null
    insertSlotRef.current = null
    setDragIndex(null)
    setInsertSlot(null)
  }

  const startDragFromHandle = (
    event: PointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (dragIndexRef.current !== null) return
    if (event.button !== 0) return

    event.preventDefault()
    event.stopPropagation()
    clearTextSelection()

    cancelPointerSession()
    lockPageScroll()

    const captureTarget = event.currentTarget
    const pointerId = event.pointerId
    lastPointerRef.current = { x: event.clientX, y: event.clientY }

    const row = captureTarget.closest('[data-exercise-row]') as HTMLElement | null
    if (row) {
      const rect = row.getBoundingClientRect()
      ghostWidthRef.current = rect.width
      removeDragGhost()
      dragGhostRef.current = createDragGhost(
        row,
        event.clientX,
        event.clientY,
      )
    }

    rowCountRef.current = editing?.exercises.length ?? 0

    dragIndexRef.current = index
    insertSlotRef.current = index
    setDragIndex(index)
    setInsertSlot(index)
    startAutoScrollLoop()

    try {
      captureTarget.setPointerCapture(pointerId)
    } catch {
      // Pointer capture may fail on some browsers; fall back to window listeners.
    }

    const moveHandler = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return

      lastPointerRef.current = { x: ev.clientX, y: ev.clientY }
      ev.preventDefault()
      ev.stopPropagation()
      clearTextSelection()

      if (dragGhostRef.current) {
        updateDragGhost(
          dragGhostRef.current,
          ev.clientX,
          ev.clientY,
          ghostWidthRef.current,
        )
      }
      updateDropTarget(ev.clientY)
    }

    const upHandler = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      endReorder(
        dragIndexRef.current,
        insertSlotRef.current,
        rowCountRef.current,
      )
    }

    const cancelHandler = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      // Ignore pointercancel during an active drag — mobile browsers often
      // fire it when scroll is attempted; we block scroll via touch-action.
    }

    pointerSessionRef.current = {
      moveHandler,
      upHandler,
      cancelHandler,
      captureTarget,
      pointerId,
    }
    window.addEventListener('pointermove', moveHandler, POINTER_LISTENER_OPTS)
    window.addEventListener('pointerup', upHandler, POINTER_LISTENER_OPTS)
    window.addEventListener(
      'pointercancel',
      cancelHandler,
      POINTER_LISTENER_OPTS,
    )
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
        <div ref={exerciseListRef} className="flex flex-col gap-3">
          {editing.exercises.map((pe, index) => {
            const template = exercises.find((e) => e.id === pe.exerciseId)
            const type = template ? resolveExerciseType(template) : 'accessory'
            const durationType = isDurationExerciseType(type)
            const isDragging = dragIndex === index
            const showPlaceholder =
              dragIndex !== null && insertSlot === index

            return (
            <Fragment key={`${pe.exerciseId}-${index}`}>
              {showPlaceholder && <DropPlaceholder />}
            {!isDragging && (
            <div
              data-exercise-row
              data-row-index={index}
              className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white transition-[transform,opacity] duration-150 ease-out dark:border-slate-800 dark:bg-slate-900 motion-reduce:transition-none"
            >
              <div className="min-w-0 flex-1 p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                {template ? (
                  <p className="text-xs text-slate-500">
                    {formatExerciseMeta(template)}
                  </p>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => removeExercise(index)}
                  className="shrink-0 rounded-lg border border-red-200 px-2 py-0.5 text-xs text-red-600 dark:border-red-900 dark:text-red-400"
                >
                  Delete
                </button>
              </div>
              <label className="mb-2 block">
                <span className="text-xs font-medium text-slate-500">
                  Exercise
                </span>
                {dragIndex !== null ? (
                  <div className="mt-1 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                    {template ? (
                      <>
                        <ExerciseThumbnail
                          exercise={template}
                          className="h-10 w-10 shrink-0"
                        />
                        <span className="min-w-0 flex-1 font-medium">
                          {template.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500">Exercise</span>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickerTarget({ mode: 'change', index })}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
                  >
                    {template ? (
                      <>
                        <ExerciseThumbnail
                          exercise={template}
                          className="h-10 w-10 shrink-0"
                        />
                        <span className="min-w-0 flex-1 font-medium">
                          {template.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500">Choose exercise</span>
                    )}
                    <span className="shrink-0 text-xs text-emerald-600">
                      Change
                    </span>
                  </button>
                )}
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
              </div>
              <button
                type="button"
                onPointerDown={(e) => startDragFromHandle(e, index)}
                style={{ touchAction: 'none' }}
                className="flex w-11 shrink-0 cursor-grab touch-none items-center justify-center self-stretch border-l border-slate-200 bg-slate-50 text-slate-400 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-800/50"
                aria-label={`Reorder ${template?.name ?? 'exercise'}`}
              >
                ⠿
              </button>
            </div>
            )}
            </Fragment>
          )})}
          {dragIndex !== null &&
            insertSlot === editing.exercises.length && <DropPlaceholder />}
        </div>

        <button
          onClick={openAddExercisePicker}
          disabled={exercises.length === 0}
          className="mt-3 w-full rounded-xl border-2 border-dashed border-slate-300 py-2 text-sm disabled:opacity-50 dark:border-slate-700"
        >
          + Add exercise
        </button>

        <ExercisePicker
          open={pickerTarget !== null}
          title={
            pickerTarget?.mode === 'add' ? 'Add exercise' : 'Change exercise'
          }
          description="Search and filter by type, muscle group, and difficulty."
          exercises={exercises}
          selectedId={pickerSelectedId}
          excludeIds={pickerExcludeIds}
          onSelect={handlePickerSelect}
          onClose={() => setPickerTarget(null)}
        />

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
