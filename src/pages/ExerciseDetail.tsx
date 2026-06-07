import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/schema'
import type { Exercise, PlanExercise } from '../db/schema'
import {
  SetLogger,
  setsToDrafts,
  newSetDraft,
  type SetDraft,
} from '../components/SetLogger'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { getLastSessionSummary, isPersonalBest } from '../lib/progress'
import {
  formatExerciseMeta,
  isDurationExerciseType,
  resolveExerciseType,
  instructionPhotoSrc,
} from '../lib/exercises'

export function ExerciseDetail() {
  const { sessionId, exerciseId } = useParams<{
    sessionId: string
    exerciseId: string
  }>()
  const navigate = useNavigate()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [planExercise, setPlanExercise] = useState<PlanExercise | null>(null)
  const [sets, setSets] = useState<SetDraft[]>([])
  const [lastSummary, setLastSummary] = useState<string | null>(null)
  const [showPb, setShowPb] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const sid = parseInt(sessionId ?? '0', 10)

  useEffect(() => {
    async function load() {
      const session = await db.sessions.get(sid)
      if (!session || !exerciseId) return

      const plan = await db.workoutPlans.get(session.planId)
      const ex = await db.exercises.get(exerciseId)
      const pe = plan?.exercises.find((e) => e.exerciseId === exerciseId)
      if (!ex || !pe) return

      const existingLogs = await db.setLogs
        .where({ sessionId: sid, exerciseId })
        .toArray()

      setExercise(ex)
      setPlanExercise(pe)
      setSets(setsToDrafts(existingLogs, ex, pe))
      setLastSummary(await getLastSessionSummary(exerciseId, sid))
    }
    load()
  }, [sid, exerciseId])

  const addSet = () => {
    if (!planExercise || !exercise) return
    setSets((prev) => [
      ...prev,
      newSetDraft(exercise, planExercise, prev.length + 1),
    ])
  }

  const saveExercise = async () => {
    if (!exercise || !exerciseId) return
    setSaving(true)

    await db.setLogs.where({ sessionId: sid, exerciseId }).delete()

    for (const set of sets) {
      await db.setLogs.add({
        sessionId: sid,
        exerciseId,
        setNumber: set.setNumber,
        targetReps: set.targetReps,
        targetWeight: set.targetWeight,
        actualReps: set.actualReps,
        actualWeight: set.actualWeight,
        rpe: set.rpe,
        notes: set.notes || undefined,
      })
    }

    const session = await db.sessions.get(sid)
    if (session) {
      const completed = new Set(session.completedExerciseIds)
      completed.add(exerciseId)
      await db.sessions.update(sid, {
        completedExerciseIds: [...completed],
      })
    }

    const type = resolveExerciseType(exercise)
    if (!isDurationExerciseType(type)) {
      const maxWeight = Math.max(...sets.map((s) => s.actualWeight ?? 0))
      if (await isPersonalBest(exerciseId, maxWeight, sid)) {
        setShowPb(true)
        setTimeout(() => navigate(`/session/${sid}`), 1500)
        setSaving(false)
        return
      }
    }

    navigate(`/session/${sid}`)
    setSaving(false)
  }

  if (!exercise || !planExercise) {
    return <p className="text-center text-slate-500">Loading...</p>
  }

  const exerciseType = resolveExerciseType(exercise)
  const instructionPhotos = exercise.instructionPhotos ?? []

  return (
    <div>
      <Link
        to={`/session/${sid}`}
        className="mb-4 inline-block text-sm text-emerald-600"
      >
        ← Back to checklist
      </Link>

      {showPb && (
        <div className="mb-4 rounded-2xl bg-amber-400 p-4 text-center font-bold text-amber-950">
          🏆 New personal best!
        </div>
      )}

      <h1 className="text-2xl font-bold">{exercise.name}</h1>
      <p className="text-sm text-slate-500">{formatExerciseMeta(exercise)}</p>

      {lastSummary && (
        <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          {lastSummary}
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-semibold">How to perform</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {exercise.instructions}
        </p>
        {instructionPhotos.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {instructionPhotos.map((photo, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="text-left"
              >
                <img
                  src={instructionPhotoSrc(photo)}
                  alt={`Step ${index + 1}`}
                  className="aspect-square w-full rounded-xl object-cover"
                />
                <p className="mt-1 text-center text-xs text-slate-500">
                  Step {index + 1}
                </p>
              </button>
            ))}
          </div>
        )}
        {exercise.tutorialVideoUrl && (
          <a
            href={exercise.tutorialVideoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <span aria-hidden>▶</span>
            Watch tutorial on YouTube
          </a>
        )}
        {exercise.startingWeightNote && (
          <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">
            💡 {exercise.startingWeightNote}
          </p>
        )}
      </div>

      {lightboxIndex != null && (
        <PhotoLightbox
          photos={instructionPhotos.map(instructionPhotoSrc)}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onChangeIndex={setLightboxIndex}
        />
      )}

      <h2 className="mb-3 mt-6 text-lg font-semibold">Log your sets</h2>
      <SetLogger
        sets={sets}
        exerciseType={exerciseType}
        durationUnit={planExercise.durationUnit ?? exercise.durationUnit}
        onChange={setSets}
        onAddSet={addSet}
      />

      <button
        onClick={saveExercise}
        disabled={saving}
        className="mt-6 w-full rounded-2xl bg-emerald-600 py-4 font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Mark exercise done'}
      </button>
    </div>
  )
}
