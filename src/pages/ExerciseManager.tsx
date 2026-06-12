import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../db/schema'
import type {
  DurationUnit,
  Exercise,
  ExerciseDifficulty,
  ExerciseType,
  WorkoutPlan,
} from '../db/schema'
import {
  DURATION_UNITS,
  EXERCISE_DIFFICULTIES,
  EXERCISE_TYPES,
  MUSCLE_GROUPS,
  addExerciseToPlan,
  createEmptyExercise,
  exerciseSummaryLine,
  filterExercises,
  isDurationExerciseType,
  getPlansUsingExercise,
  normalizeDifficultyRange,
  normalizeMuscleGroups,
  resolveExerciseDifficulties,
  resolveExerciseType,
  resolveMuscleGroups,
  uniqueExerciseId,
} from '../lib/exercises'
import { parseYoutubeUrl } from '../lib/youtube'
import { ExerciseMetaRows } from '../components/ExerciseMetaRows'
import { ExercisePhotoPicker } from '../components/ExercisePhotoPicker'
import { ExerciseThumbnail } from '../components/ExerciseThumbnail'
import { DifficultyRangeSelect } from '../components/DifficultyRangeSelect'
import { MultiSelectPills } from '../components/MultiSelectPills'
import { useTranslation } from '../context/SettingsContext'

export function ExerciseManager() {
  const { t } = useTranslation()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<ExerciseType | ''>('')
  const [muscleGroupFilter, setMuscleGroupFilter] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState<
    ExerciseDifficulty | ''
  >('')
  const [plans, setPlans] = useState<WorkoutPlan[]>([])
  const [addToPlanExercise, setAddToPlanExercise] = useState<Exercise | null>(
    null,
  )
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [addToPlanError, setAddToPlanError] = useState('')
  const [addingToPlan, setAddingToPlan] = useState(false)
  const [planAddedPlanName, setPlanAddedPlanName] = useState('')

  const load = async () => {
    const [all, allPlans] = await Promise.all([
      db.exercises.orderBy('name').toArray(),
      db.workoutPlans.orderBy('name').toArray(),
    ])
    setExercises(all)
    setPlans(allPlans)
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
    setEditing({
      ...exercise,
      exerciseType: resolveExerciseType(exercise),
      muscleGroups: resolveMuscleGroups(exercise),
      difficulties: resolveExerciseDifficulties(exercise),
      instructionPhotos: exercise.instructionPhotos ?? [],
      thumbnailPhotoIndex: exercise.thumbnailPhotoIndex ?? 0,
    })
    setIsNew(false)
    setError('')
  }

  const setExerciseType = (type: ExerciseType) => {
    if (!editing) return
    const next: Exercise = { ...editing, exerciseType: type }
    if (isDurationExerciseType(type)) {
      next.defaultDuration = next.defaultDuration ?? 30
      next.durationUnit = next.durationUnit ?? 'sec'
      delete next.defaultWeight
      delete next.defaultReps
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
      setError('exercises.nameRequired')
      return
    }
    if (!editing.instructions.trim()) {
      setError('exercises.instructionsRequired')
      return
    }
    if (resolveMuscleGroups(editing).length === 0) {
      setError('exercises.muscleRequired')
      return
    }
    if (resolveExerciseDifficulties(editing).length === 0) {
      setError('exercises.difficultyRequired')
      return
    }

    const type = resolveExerciseType(editing)
    if (isDurationExerciseType(type) && !editing.defaultDuration) {
      setError('exercises.durationRequired')
      return
    }

    const videoUrl = editing.tutorialVideoUrl?.trim()
    let tutorialVideoUrl: string | undefined
    if (videoUrl) {
      const parsed = parseYoutubeUrl(videoUrl)
      if (!parsed) {
        setError('exercises.youtubeInvalid')
        return
      }
      tutorialVideoUrl = parsed
    }

    setSaving(true)
    setError('')

    let record: Exercise = {
      ...editing,
      name: editing.name.trim(),
      difficulties: normalizeDifficultyRange(resolveExerciseDifficulties(editing)),
      muscleGroups: normalizeMuscleGroups(resolveMuscleGroups(editing)),
      instructionPhotos: editing.instructionPhotos ?? [],
      thumbnailPhotoIndex:
        (editing.instructionPhotos?.length ?? 0) > 0
          ? Math.min(
              editing.thumbnailPhotoIndex ?? 0,
              (editing.instructionPhotos?.length ?? 1) - 1,
            )
          : undefined,
      tutorialVideoUrl,
    }
    if (!tutorialVideoUrl) {
      delete record.tutorialVideoUrl
    }
    if (isDurationExerciseType(type)) {
      delete record.defaultReps
      delete record.defaultWeight
    } else {
      delete record.defaultDuration
      delete record.durationUnit
    }
    if ((record.instructionPhotos?.length ?? 0) === 0) {
      delete record.instructionPhotos
      delete record.thumbnailPhotoIndex
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

  const openAddToPlan = (exercise: Exercise) => {
    setAddToPlanExercise(exercise)
    setAddToPlanError('')
    setSelectedPlanId(plans[0]?.id ?? '')
  }

  const closeAddToPlan = () => {
    setAddToPlanExercise(null)
    setAddToPlanError('')
    setSelectedPlanId('')
  }

  const confirmAddToPlan = async () => {
    if (!addToPlanExercise || !selectedPlanId) return

    const plan = plans.find((p) => p.id === selectedPlanId)
    if (!plan) return

    setAddingToPlan(true)
    setAddToPlanError('')

    const result = await addExerciseToPlan(addToPlanExercise, selectedPlanId)
    if (!result.ok) {
      setAddToPlanError(
        result.reason === 'duplicate'
          ? 'exercises.alreadyInPlan'
          : 'exercises.notFound',
      )
      setAddingToPlan(false)
      return
    }

    await load()
    setPlanAddedPlanName(plan.name)
    closeAddToPlan()
    setAddingToPlan(false)
  }

  const remove = async (exercise: Exercise) => {
    const usedInPlans = await getPlansUsingExercise(exercise.id)
    if (usedInPlans.length > 0) {
      alert(
        t('exercises.cannotDeleteInPlans', {
          name: exercise.name,
          plans: usedInPlans.join(', '),
        }),
      )
      return
    }

    if (
      !confirm(
        t('exercises.deleteConfirmNamed', { name: exercise.name }),
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

  const filteredExercises = useMemo(
    () =>
      filterExercises(exercises, {
        query: searchQuery,
        type: typeFilter,
        muscleGroup: muscleGroupFilter,
        difficulty: difficultyFilter,
      }),
    [exercises, searchQuery, typeFilter, muscleGroupFilter, difficultyFilter],
  )

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
          {t('exercises.backToList')}
        </button>

        <h1 className="mb-4 text-2xl font-bold">
          {isNew ? t('exercises.newExercise') : t('exercises.editExercise')}
        </h1>

        {error && (
          <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {t(error)}
          </p>
        )}

        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium">{t('exercises.name')}</span>
            <input
              value={editing.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={t('exercises.namePlaceholder')}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          {!isNew && (
            <label className="block">
              <span className="text-sm font-medium">{t('exercises.id')}</span>
              <input
                value={editing.id}
                readOnly
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-3 text-slate-500 dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm font-medium">{t('exercises.type')}</span>
            <select
              value={type}
              onChange={(e) =>
                setExerciseType(e.target.value as ExerciseType)
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            >
              {EXERCISE_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(`exerciseType.${opt.value}`)}
                </option>
              ))}
            </select>
          </label>

          <MultiSelectPills
            label={t('exercises.muscleGroups')}
            hint={t('exercises.muscleGroupsHint')}
            options={MUSCLE_GROUPS}
            values={resolveMuscleGroups(editing)}
            onChange={(muscleGroups) => updateField('muscleGroups', muscleGroups)}
            getLabel={(group) => t(`muscleGroup.${group}`)}
          />

          <DifficultyRangeSelect
            value={resolveExerciseDifficulties(editing)}
            onChange={(difficulties) =>
              updateField('difficulties', difficulties)
            }
          />

          <label className="block">
            <span className="text-sm font-medium">
              {t('exercises.instructions')}
            </span>
            <textarea
              value={editing.instructions}
              onChange={(e) => updateField('instructions', e.target.value)}
              rows={5}
              placeholder={t('exercises.instructionsPlaceholder')}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <ExercisePhotoPicker
            photos={editing.instructionPhotos ?? []}
            thumbnailIndex={editing.thumbnailPhotoIndex ?? 0}
            onChange={(photos, thumbnailIndex) => {
              setError('')
              setEditing({
                ...editing,
                instructionPhotos: photos,
                thumbnailPhotoIndex: thumbnailIndex,
              })
            }}
            onError={setError}
          />

          <label className="block">
            <span className="text-sm font-medium">
              {t('exercises.youtubeUrl')} ({t('common.optional')})
            </span>
            <input
              type="url"
              value={editing.tutorialVideoUrl ?? ''}
              onChange={(e) =>
                updateField('tutorialVideoUrl', e.target.value || undefined)
              }
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">
              {t('exercises.defaultSets')}
            </span>
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

          {isDurationExerciseType(type) && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm font-medium">
                  {t('exercises.defaultDuration')}
                </span>
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
                <span className="text-sm font-medium">
                  {t('exercises.durationUnit')}
                </span>
                <select
                  value={editing.durationUnit ?? 'sec'}
                  onChange={(e) =>
                    updateField('durationUnit', e.target.value as DurationUnit)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  {DURATION_UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {t(`common.${unit}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {!isDurationExerciseType(type) && (
            <label className="block">
              <span className="text-sm font-medium">
                {t('exercises.defaultReps')}
              </span>
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

          {!isDurationExerciseType(type) && (
            <>
              <label className="block">
                <span className="text-sm font-medium">
                  {t('exercises.defaultWeight')}
                </span>
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
                  placeholder={t('exercises.weightPlaceholder')}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">
                  {t('exercises.startingWeightNote')} ({t('common.optional')})
                </span>
                <textarea
                  value={editing.startingWeightNote ?? ''}
                  onChange={(e) =>
                    updateField('startingWeightNote', e.target.value || undefined)
                  }
                  rows={3}
                  placeholder={t('exercises.startingWeightPlaceholder')}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            </>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="mt-6 w-full rounded-2xl bg-emerald-600 py-4 font-semibold text-white disabled:opacity-50"
        >
          {saving
            ? t('common.saving')
            : isNew
              ? t('exercises.createExercise')
              : t('exercises.saveExercise')}
        </button>
      </div>
    )
  }

  return (
    <div>
      <Link to="/plans" className="mb-4 inline-block text-sm text-emerald-600">
        {t('common.backToPlans')}
      </Link>

      {planAddedPlanName && (
        <p className="mb-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {t('exercises.addedToPlan', { plan: planAddedPlanName })}
          <button
            type="button"
            onClick={() => setPlanAddedPlanName('')}
            className="ml-2 font-medium underline"
          >
            {t('common.dismiss')}
          </button>
        </p>
      )}

      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('exercises.title')}</h1>
          <p className="text-sm text-slate-500">{t('exercises.subtitle')}</p>
        </div>
        <button
          onClick={startNew}
          className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {t('common.newButton')}
        </button>
      </div>

      {exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <p className="text-slate-500">{t('exercises.noExercisesYet')}</p>
          <button
            onClick={startNew}
            className="mt-3 text-sm font-medium text-emerald-600"
          >
            {t('exercises.createFirst')}
          </button>
        </div>
      ) : (
        <>
          <label className="mb-4 block">
            <span className="text-xs font-medium text-slate-500">
              {t('common.search')}
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('common.searchByName')}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                {t('exercises.type')}
              </span>
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as ExerciseType | '')
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('common.allTypes')}</option>
                {EXERCISE_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(`exerciseType.${opt.value}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                {t('exercises.muscleGroup')}
              </span>
              <select
                value={muscleGroupFilter}
                onChange={(e) => setMuscleGroupFilter(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('common.allMuscleGroups')}</option>
                {MUSCLE_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {t(`muscleGroup.${group}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-500">
                {t('exercises.difficulty')}
              </span>
              <select
                value={difficultyFilter}
                onChange={(e) =>
                  setDifficultyFilter(e.target.value as ExerciseDifficulty | '')
                }
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">{t('common.allLevels')}</option>
                {EXERCISE_DIFFICULTIES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {t(`difficulty.${d.value}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredExercises.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <p className="text-slate-500">{t('exercises.noMatch')}</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setTypeFilter('')
                  setMuscleGroupFilter('')
                  setDifficultyFilter('')
                }}
                className="mt-3 text-sm font-medium text-emerald-600"
              >
                {t('common.clearFilters')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                {t('exercises.count', {
                  count: filteredExercises.length,
                  total: exercises.length,
                })}
              </p>
              {filteredExercises.map((exercise) => (
                <div
                  key={exercise.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => startEdit(exercise)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      startEdit(exercise)
                    }
                  }}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
                >
                  <ExerciseThumbnail exercise={exercise} className="h-12 w-12 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold leading-tight break-words">
                      {exercise.name}
                    </h2>
                    <ExerciseMetaRows exercise={exercise} className="mt-0.5" />
                    <p className="mt-0.5 text-xs text-slate-400">
                      {exerciseSummaryLine(exercise)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openAddToPlan(exercise)
                      }}
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
                    >
                      {t('exercises.addToPlan')}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        remove(exercise)
                      }}
                      className="rounded-xl border border-red-200 px-3 py-1.5 text-sm text-red-600 dark:border-red-900 dark:text-red-400"
                    >
                      {t('exercises.deleteExercise')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {addToPlanExercise && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={closeAddToPlan}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-to-plan-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-to-plan-title" className="text-lg font-bold">
              {t('exercises.addToPlanTitle')}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {t('exercises.addToPlanDescription', {
                name: addToPlanExercise.name,
              })}
            </p>

            {plans.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                {t('exercises.noPlansYet')}{' '}
                <Link to="/plans" className="font-medium text-emerald-600">
                  {t('plans.newPlan')}
                </Link>{' '}
                {t('exercises.createPlanFirst')}
              </p>
            ) : (
              <label className="mt-4 block">
                <span className="text-sm font-medium">
                  {t('exercises.workoutPlan')}
                </span>
                <select
                  value={selectedPlanId}
                  onChange={(e) => {
                    setSelectedPlanId(e.target.value)
                    setAddToPlanError('')
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {addToPlanError && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {t(addToPlanError)}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={closeAddToPlan}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmAddToPlan}
                disabled={plans.length === 0 || !selectedPlanId || addingToPlan}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {addingToPlan ? t('exercises.adding') : t('common.add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
