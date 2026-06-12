import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/schema'
import type { Exercise, PlanExercise } from '../db/schema'
import {
  SetLogger,
  setsToDrafts,
  newSetDraft,
  type SetDraft,
} from '../components/SetLogger'
import { ExerciseThumbnail } from '../components/ExerciseThumbnail'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { useTranslation } from '../context/SettingsContext'
import { getLastSessionSummary, isPersonalBest } from '../lib/progress'
import {
  formatExerciseMeta,
  isDurationExerciseType,
  resolveExerciseType,
  instructionPhotoSrc,
} from '../lib/exercises'
import {
  collectResolvedExerciseIds,
  findPlanSlotByResolvedId,
  findSwapAlternatives,
  swapSessionExercise,
} from '../lib/session'

export function ExerciseDetail() {
  const { sessionId, exerciseId } = useParams<{
    sessionId: string
    exerciseId: string
  }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [planExercise, setPlanExercise] = useState<PlanExercise | null>(null)
  const [planSlotExerciseId, setPlanSlotExerciseId] = useState<string | null>(
    null,
  )
  const [sets, setSets] = useState<SetDraft[]>([])
  const [lastSummary, setLastSummary] = useState<string | null>(null)
  const [showPb, setShowPb] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapAlternatives, setSwapAlternatives] = useState<Exercise[]>([])
  const [swapping, setSwapping] = useState(false)
  const [originalExerciseName, setOriginalExerciseName] = useState<
    string | null
  >(null)

  const sid = parseInt(sessionId ?? '0', 10)

  useEffect(() => {
    async function load() {
      const session = await db.sessions.get(sid)
      if (!session || !exerciseId) return

      const plan = await db.workoutPlans.get(session.planId)
      const ex = await db.exercises.get(exerciseId)
      const pe = plan
        ? findPlanSlotByResolvedId(plan, exerciseId, session.exerciseSwaps)
        : undefined
      if (!ex || !pe || !plan) return

      const existingLogs = await db.setLogs
        .where({ sessionId: sid, exerciseId })
        .toArray()

      setPlanSlotExerciseId(pe.exerciseId)
      setExercise(ex)
      setPlanExercise(pe)
      setSets(setsToDrafts(existingLogs, ex, pe))
      setLastSummary(await getLastSessionSummary(exerciseId, sid, t))

      if (pe.exerciseId !== exerciseId) {
        const original = await db.exercises.get(pe.exerciseId)
        setOriginalExerciseName(original?.name ?? null)
      } else {
        setOriginalExerciseName(null)
      }
    }
    load()
  }, [sid, exerciseId, t])

  const openSwapModal = async () => {
    if (!exercise) return
    const session = await db.sessions.get(sid)
    const plan = session
      ? await db.workoutPlans.get(session.planId)
      : undefined
    if (!session || !plan) return

    const allExercises = await db.exercises.toArray()
    const excludeIds = collectResolvedExerciseIds(plan, session.exerciseSwaps)
    setSwapAlternatives(
      findSwapAlternatives(exercise, allExercises, excludeIds),
    )
    setShowSwapModal(true)
  }

  const confirmSwap = async (newExerciseId: string) => {
    if (!planSlotExerciseId || newExerciseId === exerciseId) return
    setSwapping(true)
    await swapSessionExercise(sid, planSlotExerciseId, newExerciseId)
    setShowSwapModal(false)
    setSwapping(false)
    navigate(`/session/${sid}/exercise/${newExerciseId}`, { replace: true })
  }

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

  const swapMeta = useMemo(() => {
    if (!exercise) return ''
    return formatExerciseMeta(exercise, t)
  }, [exercise, t])

  if (!exercise || !planExercise) {
    return <p className="text-center text-slate-500">{t('common.loading')}</p>
  }

  const exerciseType = resolveExerciseType(exercise)
  const instructionPhotos = exercise.instructionPhotos ?? []

  return (
    <div>
      <Link
        to={`/session/${sid}`}
        className="mb-4 inline-block text-sm text-emerald-600"
      >
        ← {t('common.backToChecklist')}
      </Link>

      {showPb && (
        <div className="mb-4 rounded-2xl bg-amber-400 p-4 text-center font-bold text-amber-950">
          🏆 {t('exerciseDetail.personalBest')}
        </div>
      )}

      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">{exercise.name}</h1>
          <p className="text-sm text-slate-500">{swapMeta}</p>
          {originalExerciseName && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {t('session.swappedFrom', { name: originalExerciseName })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={openSwapModal}
          className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium dark:border-slate-700"
        >
          {t('exerciseDetail.swapExercise')}
        </button>
      </div>

      {lastSummary && (
        <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
          {lastSummary}
        </p>
      )}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-2 font-semibold">{t('exerciseDetail.howToPerform')}</h2>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {exercise.instructions}
        </p>
        {instructionPhotos.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {instructionPhotos.map((photo, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="text-left"
              >
                <img
                  src={instructionPhotoSrc(photo)}
                  alt={t('common.step', { number: index + 1 })}
                  className="aspect-square w-full rounded-xl object-cover"
                />
                <p className="mt-1 text-center text-xs text-slate-500">
                  {t('common.step', { number: index + 1 })}
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
            {t('exerciseDetail.watchTutorial')}
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

      <h2 className="mb-3 mt-6 text-lg font-semibold">
        {t('exerciseDetail.logSets')}
      </h2>
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
        {saving ? t('common.saving') : t('exerciseDetail.markDone')}
      </button>

      {showSwapModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={() => !swapping && setShowSwapModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="swap-exercise-title"
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-5 dark:border-slate-800">
              <h2 id="swap-exercise-title" className="text-lg font-bold">
                {t('exerciseDetail.swapTitle')}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {t('exerciseDetail.swapDescription')} ({swapMeta})
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {swapAlternatives.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-slate-500">
                  {t('exerciseDetail.noAlternatives')}
                </p>
              ) : (
                <div className="space-y-2">
                  {swapAlternatives.map((alt) => (
                    <button
                      key={alt.id}
                      type="button"
                      disabled={swapping}
                      onClick={() => confirmSwap(alt.id)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
                    >
                      <ExerciseThumbnail
                        exercise={alt}
                        className="h-12 w-12"
                      />
                      <span className="min-w-0 flex-1 font-medium">
                        {alt.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 p-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowSwapModal(false)}
                disabled={swapping}
                className="w-full rounded-xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
