import type { DurationUnit, Exercise, ExerciseType, PlanExercise } from '../db/schema'
import { db } from '../db/schema'

export const BUILT_IN_ILLUSTRATIONS = [
  '/illustrations/goblet-squat.svg',
  '/illustrations/dumbbell-bench-press.svg',
  '/illustrations/dumbbell-row.svg',
  '/illustrations/dumbbell-shoulder-press.svg',
  '/illustrations/plank.svg',
  '/illustrations/romanian-deadlift.svg',
  '/illustrations/incline-dumbbell-press.svg',
  '/illustrations/lat-pulldown.svg',
  '/illustrations/walking-lunges.svg',
  '/illustrations/dead-bug.svg',
  '/illustrations/placeholder.svg',
]

export const MUSCLE_GROUPS = [
  'Legs',
  'Chest',
  'Back',
  'Shoulders',
  'Arms',
  'Core',
  'Cardio',
  'Full body',
  'Other',
]

export const EXERCISE_TYPES: { value: ExerciseType; label: string }[] = [
  { value: 'strength', label: 'Strength (reps + kg)' },
  { value: 'bodyweight', label: 'Bodyweight (reps)' },
  { value: 'cardio', label: 'Cardio (duration)' },
]

export const DURATION_UNITS: DurationUnit[] = ['sec', 'min']

export function resolveExerciseType(exercise: Exercise): ExerciseType {
  if (exercise.exerciseType) return exercise.exerciseType
  if (exercise.weightUnit === 'sec') return 'cardio'
  if (exercise.weightUnit === 'bodyweight') return 'bodyweight'
  return 'strength'
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
    illustration: '/illustrations/placeholder.svg',
    exerciseType: 'strength',
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

  if (type === 'cardio') {
    return {
      ...base,
      defaultDuration: exercise.defaultDuration ?? 30,
      durationUnit: exercise.durationUnit ?? 'sec',
    }
  }

  if (type === 'strength') {
    return {
      ...base,
      defaultReps: exercise.defaultReps ?? 10,
      defaultWeight: exercise.defaultWeight,
    }
  }

  return {
    ...base,
    defaultReps: exercise.defaultReps ?? 10,
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
  if (type === 'cardio') {
    const { value, unit } = getPlanDuration(exercise, pe)
    return `${pe.defaultSets} × ${formatDuration(value, unit)}`
  }
  const reps = pe.defaultReps ?? exercise.defaultReps ?? '—'
  const weight =
    type === 'strength' && pe.defaultWeight != null
      ? ` @ ${pe.defaultWeight} kg`
      : type === 'strength'
        ? ' · kg'
        : ''
  return `${pe.defaultSets} × ${reps}${weight}`
}

export function formatSetTarget(
  exercise: Exercise,
  targetReps: number | string,
  targetWeight?: number,
): string {
  if (resolveExerciseType(exercise) === 'cardio') {
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
  if (resolveExerciseType(exercise) === 'cardio') {
    const unit = exercise.durationUnit ?? 'sec'
    return formatDuration(actualReps, unit)
  }
  if (actualWeight != null) return `${actualReps} reps @ ${actualWeight} kg`
  return `${actualReps} reps`
}

export function exerciseSummaryLine(exercise: Exercise): string {
  const type = resolveExerciseType(exercise)
  if (type === 'cardio') {
    return `${exercise.defaultSets} × ${formatDuration(
      exercise.defaultDuration ?? 30,
      exercise.durationUnit ?? 'sec',
    )}`
  }
  const weight =
    type === 'strength' && exercise.defaultWeight != null
      ? ` @ ${exercise.defaultWeight} kg`
      : ''
  return `${exercise.defaultSets} × ${exercise.defaultReps ?? '—'}${weight}`
}
