import { db, type ExportData } from '../db/schema'

export async function exportAllData(): Promise<ExportData> {
  const [exercises, workoutPlans, sessions, setLogs, bodyMetrics] =
    await Promise.all([
      db.exercises.toArray(),
      db.workoutPlans.toArray(),
      db.sessions.toArray(),
      db.setLogs.toArray(),
      db.bodyMetrics.toArray(),
    ])

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises,
    workoutPlans,
    sessions,
    setLogs,
    bodyMetrics,
  }
}

export async function importAllData(data: ExportData): Promise<void> {
  if (data.version !== 1) {
    throw new Error('Unsupported export version')
  }

  const sessions = data.sessions.map((s) => ({
    ...s,
    startedAt: new Date(s.startedAt),
    completedAt: s.completedAt ? new Date(s.completedAt) : undefined,
  }))

  await db.transaction(
    'rw',
    [db.exercises, db.workoutPlans, db.sessions, db.setLogs, db.bodyMetrics],
    async () => {
      await db.exercises.clear()
      await db.workoutPlans.clear()
      await db.sessions.clear()
      await db.setLogs.clear()
      await db.bodyMetrics.clear()

      await db.exercises.bulkAdd(data.exercises)
      await db.workoutPlans.bulkAdd(data.workoutPlans)
      await db.sessions.bulkAdd(sessions)
      await db.setLogs.bulkAdd(data.setLogs)
      await db.bodyMetrics.bulkAdd(data.bodyMetrics)
    },
  )
}
