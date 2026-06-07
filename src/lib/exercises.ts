import type { DurationUnit, Exercise, ExerciseType, PlanExercise } from '../db/schema'
import { db } from '../db/schema'

export const MAX_INSTRUCTION_PHOTOS = 3
export const MAX_INSTRUCTION_PHOTO_BYTES = 2 * 1024 * 1024

export const MUSCLE_GROUPS = [
  'Legs',
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Core',
  'Full body',
  'Other',
]

export const EXERCISE_TYPES: { value: ExerciseType; label: string }[] = [
  { value: 'squat', label: 'Squat' },
  { value: 'hinge', label: 'Hinge' },
  { value: 'horizontal-push', label: 'Horizontal push' },
  { value: 'horizontal-pull', label: 'Horizontal pull' },
  { value: 'vertical-push', label: 'Vertical push' },
  { value: 'vertical-pull', label: 'Vertical pull' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'core', label: 'Core' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'stretch', label: 'Stretch' },
]

export const DURATION_UNITS: DurationUnit[] = ['sec', 'min']

const LEGACY_TYPE_MAP: Record<string, ExerciseType> = {
  strength: 'accessory',
  bodyweight: 'core',
  cardio: 'cardio',
}

export function isDurationExerciseType(type: ExerciseType): boolean {
  return type === 'cardio' || type === 'stretch'
}

export function exerciseTypeLabel(type: ExerciseType): string {
  return EXERCISE_TYPES.find((t) => t.value === type)?.label ?? type
}

export function formatExerciseMeta(exercise: Exercise): string {
  return `${exerciseTypeLabel(resolveExerciseType(exercise))} · ${exercise.muscleGroup}`
}

export function getExerciseThumbnail(exercise: Exercise): string | undefined {
  const photos = exercise.instructionPhotos ?? []
  if (photos.length === 0) return undefined
  const index = exercise.thumbnailPhotoIndex ?? 0
  return photos[Math.min(index, photos.length - 1)]
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
    muscleGroup: 'Other',
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
