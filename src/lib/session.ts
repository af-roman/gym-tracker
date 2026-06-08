import type { Exercise, PlanExercise, WorkoutPlan } from '../db/schema'
import { db } from '../db/schema'
import { resolveExerciseType } from './exercises'

export function resolveSessionExerciseId(
  planExerciseId: string,
  swaps?: Record<string, string>,
): string {
  return swaps?.[planExerciseId] ?? planExerciseId
}

export function findPlanSlotByResolvedId(
  plan: WorkoutPlan,
  resolvedExerciseId: string,
  swaps?: Record<string, string>,
): PlanExercise | undefined {
  return plan.exercises.find(
    (pe) =>
      resolveSessionExerciseId(pe.exerciseId, swaps) === resolvedExerciseId,
  )
}

export function collectResolvedExerciseIds(
  plan: WorkoutPlan,
  swaps?: Record<string, string>,
): Set<string> {
  return new Set(
    plan.exercises.map((pe) =>
      resolveSessionExerciseId(pe.exerciseId, swaps),
    ),
  )
}

export function findSwapAlternatives(
  exercise: Exercise,
  allExercises: Exercise[],
  excludeIds: Set<string>,
): Exercise[] {
  const type = resolveExerciseType(exercise)
  return allExercises
    .filter(
      (e) =>
        e.id !== exercise.id &&
        !excludeIds.has(e.id) &&
        resolveExerciseType(e) === type &&
        e.muscleGroup === exercise.muscleGroup,
    )
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function swapSessionExercise(
  sessionId: number,
  planSlotExerciseId: string,
  newExerciseId: string,
): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) return

  const swaps = { ...(session.exerciseSwaps ?? {}) }
  const previousResolved = resolveSessionExerciseId(planSlotExerciseId, swaps)

  swaps[planSlotExerciseId] = newExerciseId

  await db.setLogs
    .where({ sessionId, exerciseId: previousResolved })
    .delete()

  const completed = session.completedExerciseIds.filter(
    (id) => id !== previousResolved && id !== planSlotExerciseId,
  )

  await db.sessions.update(sessionId, {
    exerciseSwaps: swaps,
    completedExerciseIds: completed,
  })
}
