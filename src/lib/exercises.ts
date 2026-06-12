import type {
  DurationUnit,
  Exercise,
  ExerciseDifficulty,
  ExerciseType,
  PlanExercise,
} from '../db/schema'
import { db } from '../db/schema'
import { assetUrl } from './assets'
import {
  isMuscleGroup,
  type MuscleGroup,
  normalizeMuscleGroups,
} from './muscleGroups'

export {
  isMuscleGroup,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_SHORT,
  type MuscleGroup,
  muscleGroupShortLabel,
  normalizeMuscleGroups,
} from './muscleGroups'

export const MAX_INSTRUCTION_PHOTOS = 4
export const MAX_INSTRUCTION_PHOTO_BYTES = 2 * 1024 * 1024

export const EXERCISE_TYPES: { value: ExerciseType; label: string }[] = [
  { value: 'accessory', label: 'Accessory' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'core', label: 'Core' },
  { value: 'hinge', label: 'Hinge' },
  { value: 'horizontal-pull', label: 'Horizontal pull' },
  { value: 'horizontal-push', label: 'Horizontal push' },
  { value: 'joint-mobility', label: 'Joint mobility' },
  { value: 'roller-massage', label: 'Roller massage' },
  { value: 'squat', label: 'Squat' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'vertical-pull', label: 'Vertical pull' },
  { value: 'vertical-push', label: 'Vertical push' },
]

export const DURATION_UNITS: DurationUnit[] = ['sec', 'min']

export const EXERCISE_DIFFICULTIES: {
  value: ExerciseDifficulty
  label: string
}[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export const DIFFICULTY_ORDER: ExerciseDifficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
]

const DIFFICULTY_SHORT: Record<ExerciseDifficulty, string> = {
  beginner: 'Beg',
  intermediate: 'Int',
  advanced: 'Adv',
}

const LEGACY_TYPE_MAP: Record<string, ExerciseType> = {
  strength: 'accessory',
  bodyweight: 'core',
  cardio: 'cardio',
}

interface LegacyExerciseFields {
  muscleGroup?: string
  difficulty?: ExerciseDifficulty
}

type ExerciseLike = Pick<Exercise, 'muscleGroups' | 'difficulties'> &
  LegacyExerciseFields

export function isDurationExerciseType(type: ExerciseType): boolean {
  return (
    type === 'cardio' ||
    type === 'stretch' ||
    type === 'joint-mobility' ||
    type === 'roller-massage'
  )
}

export function exerciseTypeLabel(type: ExerciseType): string {
  return EXERCISE_TYPES.find((t) => t.value === type)?.label ?? type
}

export function resolveMuscleGroups(exercise: ExerciseLike): MuscleGroup[] {
  if (exercise.muscleGroups?.length) {
    return normalizeMuscleGroups(exercise.muscleGroups)
  }
  const legacy = exercise.muscleGroup
  if (legacy) {
    return normalizeMuscleGroups([legacy === 'Cardio' ? 'Full body' : legacy])
  }
  return ['Other']
}

export function normalizeDifficultyRange(
  difficulties: ExerciseDifficulty[],
): ExerciseDifficulty[] {
  const indices = [
    ...new Set(
      difficulties
        .filter((level): level is ExerciseDifficulty =>
          DIFFICULTY_ORDER.includes(level),
        )
        .map((level) => DIFFICULTY_ORDER.indexOf(level)),
    ),
  ].sort((a, b) => a - b)

  if (indices.length === 0) return ['intermediate']

  const min = indices[0]
  const max = indices[indices.length - 1]
  return DIFFICULTY_ORDER.slice(min, max + 1)
}

export function selectDifficultyRange(
  current: ExerciseDifficulty[],
  clicked: ExerciseDifficulty,
): ExerciseDifficulty[] {
  const range = normalizeDifficultyRange(current)
  const clickedIndex = DIFFICULTY_ORDER.indexOf(clicked)

  if (range.length === 1 && range[0] === clicked) {
    return range
  }
  if (range.length === 1) {
    const currentIndex = DIFFICULTY_ORDER.indexOf(range[0])
    const min = Math.min(currentIndex, clickedIndex)
    const max = Math.max(currentIndex, clickedIndex)
    return DIFFICULTY_ORDER.slice(min, max + 1)
  }
  return [clicked]
}

export function resolveExerciseDifficulties(
  exercise: ExerciseLike,
): ExerciseDifficulty[] {
  if (exercise.difficulties?.length) {
    return normalizeDifficultyRange(exercise.difficulties)
  }
  const legacy = exercise.difficulty
  if (
    legacy === 'beginner' ||
    legacy === 'intermediate' ||
    legacy === 'advanced'
  ) {
    return [legacy]
  }
  return ['intermediate']
}

/** @deprecated use resolveExerciseDifficulties */
export function resolveExerciseDifficulty(
  exercise: ExerciseLike,
): ExerciseDifficulty {
  return resolveExerciseDifficulties(exercise)[0] ?? 'intermediate'
}

export function difficultyLabel(difficulty: ExerciseDifficulty): string {
  return (
    EXERCISE_DIFFICULTIES.find((d) => d.value === difficulty)?.label ??
    difficulty
  )
}

export type TranslateFn = (
  key: string,
  params?: Record<string, string | number>,
) => string

export function formatMuscleGroups(
  groups: string[],
  t?: TranslateFn,
): string {
  const labels = groups.map((group) =>
    t ? t(`muscleGroup.${group}`) : group,
  )
  return labels.join(' + ')
}

export function formatDifficulties(
  difficulties: ExerciseDifficulty[],
  t?: TranslateFn,
): string {
  const range = normalizeDifficultyRange(difficulties)
  if (range.length === 1) {
    return t
      ? t(`difficulty.short.${range[0]}`)
      : DIFFICULTY_SHORT[range[0]]
  }
  const short = t
    ? t(`difficulty.short.${range[0]}`)
    : DIFFICULTY_SHORT[range[0]]
  return `${short}+`
}

export function formatExerciseMuscleLabel(
  exercise: Exercise,
  options?: { fullMuscles?: boolean; t?: TranslateFn },
): string {
  const groups = resolveMuscleGroups(exercise)
  const visible = !options?.fullMuscles && groups.length > 3
    ? groups.slice(0, 3)
    : groups
  const label = formatMuscleGroups(visible, options?.t)
  if (visible && groups.length > 3) return `${label}…`
  return label
}

export function getExerciseMetaDisplay(
  exercise: Exercise,
  options?: { fullMuscles?: boolean; t?: TranslateFn },
): {
  type: string
  muscles: string
  level: string
} {
  const type = resolveExerciseType(exercise)
  return {
    type: options?.t
      ? options.t(`exerciseType.${type}`)
      : exerciseTypeLabel(type),
    muscles: formatExerciseMuscleLabel(exercise, options),
    level: formatDifficulties(resolveExerciseDifficulties(exercise), options?.t),
  }
}

export function formatExerciseMeta(
  exercise: Exercise,
  t?: TranslateFn,
): string {
  const { type, muscles, level } = getExerciseMetaDisplay(exercise, { t })
  return `${type} · ${muscles} · ${level}`
}

export function exerciseMatchesMuscleFilter(
  exercise: Exercise,
  filter: string,
): boolean {
  if (!filter) return true
  if (!isMuscleGroup(filter)) return false
  return resolveMuscleGroups(exercise).includes(filter)
}

export function exerciseMatchesDifficultyFilter(
  exercise: Exercise,
  filter: ExerciseDifficulty,
): boolean {
  if (!filter) return true
  return resolveExerciseDifficulties(exercise).includes(filter)
}

export interface ExerciseFilterOptions {
  query?: string
  type?: ExerciseType | ''
  muscleGroup?: string
  difficulty?: ExerciseDifficulty | ''
}

export function filterExercises(
  exercises: Exercise[],
  options: ExerciseFilterOptions,
): Exercise[] {
  const query = options.query?.trim().toLowerCase() ?? ''

  return exercises
    .filter((exercise) => {
      if (options.type && resolveExerciseType(exercise) !== options.type) {
        return false
      }
      if (!exerciseMatchesMuscleFilter(exercise, options.muscleGroup ?? '')) {
        return false
      }
      if (
        options.difficulty &&
        !exerciseMatchesDifficultyFilter(exercise, options.difficulty)
      ) {
        return false
      }
      if (!query) return true

      const haystack = [
        exercise.name,
        exercise.id,
        ...resolveMuscleGroups(exercise),
        exerciseTypeLabel(resolveExerciseType(exercise)),
        ...resolveExerciseDifficulties(exercise).map(difficultyLabel),
        exercise.instructions,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function instructionPhotoSrc(path: string): string {
  return assetUrl(path)
}

export function getExerciseThumbnail(exercise: Exercise): string | undefined {
  const photos = exercise.instructionPhotos ?? []
  if (photos.length === 0) return undefined
  const index = exercise.thumbnailPhotoIndex ?? 0
  return instructionPhotoSrc(photos[Math.min(index, photos.length - 1)])
}

export function resolveExerciseType(exercise: Exercise): ExerciseType {
  const raw = exercise.exerciseType as string | undefined
  if (raw && LEGACY_TYPE_MAP[raw]) return LEGACY_TYPE_MAP[raw]
  if (raw && EXERCISE_TYPES.some((t) => t.value === raw)) {
    return raw as ExerciseType
  }
  if (exercise.weightUnit === 'sec') return 'cardio'
  if (exercise.weightUnit === 'bodyweight') return 'core'
  return 'accessory'
}

export function slugifyExerciseName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return base || `exercise-${Date.now()}`
}

export async function uniqueExerciseId(
  name: string,
  excludeId?: string,
): Promise<string> {
  let id = slugifyExerciseName(name)
  let suffix = 0
  while (true) {
    const candidate = suffix === 0 ? id : `${id}-${suffix}`
    const existing = await db.exercises.get(candidate)
    if (!existing || existing.id === excludeId) return candidate
    suffix++
  }
}

export function createEmptyExercise(id: string): Exercise {
  return {
    id,
    name: '',
    muscleGroups: ['Other'] satisfies MuscleGroup[],
    difficulties: ['intermediate'],
    instructions: '',
    instructionPhotos: [],
    thumbnailPhotoIndex: 0,
    exerciseType: 'accessory',
    defaultSets: 3,
    defaultReps: 10,
  }
}

export async function getPlansUsingExercise(
  exerciseId: string,
): Promise<string[]> {
  const plans = await db.workoutPlans.toArray()
  return plans
    .filter((p) => p.exercises.some((e) => e.exerciseId === exerciseId))
    .map((p) => p.name)
}

export async function addExerciseToPlan(
  exercise: Exercise,
  planId: string,
): Promise<{ ok: true } | { ok: false; reason: 'not-found' | 'duplicate' }> {
  const plan = await db.workoutPlans.get(planId)
  if (!plan) return { ok: false, reason: 'not-found' }
  if (plan.exercises.some((pe) => pe.exerciseId === exercise.id)) {
    return { ok: false, reason: 'duplicate' }
  }
  await db.workoutPlans.put({
    ...plan,
    exercises: [...plan.exercises, planExerciseFromTemplate(exercise)],
  })
  return { ok: true }
}

export function planExerciseFromTemplate(exercise: Exercise): PlanExercise {
  const type = resolveExerciseType(exercise)
  const base = { exerciseId: exercise.id, defaultSets: exercise.defaultSets }

  if (isDurationExerciseType(type)) {
    return {
      ...base,
      defaultDuration: exercise.defaultDuration ?? 30,
      durationUnit: exercise.durationUnit ?? 'sec',
    }
  }

  return {
    ...base,
    defaultReps: exercise.defaultReps ?? 10,
    defaultWeight: exercise.defaultWeight,
  }
}

export function getPlanDuration(
  exercise: Exercise,
  pe: PlanExercise,
): { value: number; unit: DurationUnit } {
  return {
    value: pe.defaultDuration ?? exercise.defaultDuration ?? 30,
    unit: pe.durationUnit ?? exercise.durationUnit ?? 'sec',
  }
}

export function formatDuration(value: number, unit: DurationUnit): string {
  return `${value} ${unit}`
}

export function formatPlanTarget(
  exercise: Exercise,
  pe: PlanExercise,
): string {
  const type = resolveExerciseType(exercise)
  if (isDurationExerciseType(type)) {
    const { value, unit } = getPlanDuration(exercise, pe)
    return `${pe.defaultSets} × ${formatDuration(value, unit)}`
  }
  const reps = pe.defaultReps ?? exercise.defaultReps ?? '—'
  const weight =
    pe.defaultWeight != null ? ` @ ${pe.defaultWeight} kg` : ' · kg'
  return `${pe.defaultSets} × ${reps}${weight}`
}

export function formatSetTarget(
  exercise: Exercise,
  targetReps: number | string,
  targetWeight?: number,
): string {
  if (isDurationExerciseType(resolveExerciseType(exercise))) {
    const unit = exercise.durationUnit ?? 'sec'
    return formatDuration(Number(targetReps) || 0, unit)
  }
  if (targetWeight != null) return `${targetReps} @ ${targetWeight} kg`
  return String(targetReps)
}

export function formatLoggedSet(
  exercise: Exercise,
  actualReps: number,
  actualWeight?: number,
): string {
  if (isDurationExerciseType(resolveExerciseType(exercise))) {
    const unit = exercise.durationUnit ?? 'sec'
    return formatDuration(actualReps, unit)
  }
  if (actualWeight != null) return `${actualReps} reps @ ${actualWeight} kg`
  return `${actualReps} reps`
}

export function exerciseSummaryLine(exercise: Exercise): string {
  const type = resolveExerciseType(exercise)
  if (isDurationExerciseType(type)) {
    return `${exercise.defaultSets} × ${formatDuration(
      exercise.defaultDuration ?? 30,
      exercise.durationUnit ?? 'sec',
    )}`
  }
  const weight =
    exercise.defaultWeight != null
      ? ` @ ${exercise.defaultWeight} kg`
      : ''
  return `${exercise.defaultSets} × ${exercise.defaultReps ?? '—'}${weight}`
}
