import type {
  DurationUnit,
  Exercise,
  ExerciseDifficulty,
  ExerciseType,
  PlanExercise,
} from '../db/schema'
import { db } from '../db/schema'
import { assetUrl } from './assets'

export const MAX_INSTRUCTION_PHOTOS = 4
export const MAX_INSTRUCTION_PHOTO_BYTES = 2 * 1024 * 1024

export const MUSCLE_GROUPS = [
  'Arms',
  'Back',
  'Chest',
  'Core',
  'Full body',
  'Legs',
  'Other',
  'Shoulders',
] as const

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

const DIFFICULTY_ORDER: ExerciseDifficulty[] = [
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

export function resolveMuscleGroups(exercise: ExerciseLike): string[] {
  if (exercise.muscleGroups?.length) {
    return [...exercise.muscleGroups]
  }
  const legacy = exercise.muscleGroup
  if (legacy) {
    return [legacy === 'Cardio' ? 'Other' : legacy]
  }
  return ['Other']
}

export function resolveExerciseDifficulties(
  exercise: ExerciseLike,
): ExerciseDifficulty[] {
  if (exercise.difficulties?.length) {
    return [...exercise.difficulties]
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

export function formatMuscleGroups(groups: string[]): string {
  return groups.join(' + ')
}

export function formatDifficulties(difficulties: ExerciseDifficulty[]): string {
  const sorted = [...difficulties].sort(
    (a, b) => DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b),
  )
  return sorted.map((d) => DIFFICULTY_SHORT[d]).join(' + ')
}

export function formatExerciseMeta(exercise: Exercise): string {
  const groups = resolveMuscleGroups(exercise)
  const groupLabel =
    groups.length > 3
      ? `${groups.slice(0, 3).join(' + ')}…`
      : formatMuscleGroups(groups)

  return `${exerciseTypeLabel(resolveExerciseType(exercise))} · ${groupLabel} · ${formatDifficulties(resolveExerciseDifficulties(exercise))}`
}

export function exerciseMatchesMuscleFilter(
  exercise: Exercise,
  filter: string,
): boolean {
  if (!filter) return true
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
    muscleGroups: ['Other'],
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
