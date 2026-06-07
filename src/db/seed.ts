import { db } from './schema'
import { defaultPlans, exerciseDefinitions } from '../data/exercises'

export async function seedDatabase(): Promise<void> {
  const exerciseCount = await db.exercises.count()
  if (exerciseCount > 0) return

  await db.exercises.bulkAdd(exerciseDefinitions)
  await db.workoutPlans.bulkAdd(defaultPlans)
}

export async function initDatabase(): Promise<void> {
  await db.open()
  await seedDatabase()
}
