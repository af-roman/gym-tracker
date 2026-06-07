import { db } from '../db/schema'
import type { SetLog } from '../db/schema'
import { formatLoggedSet } from './exercises'

export interface ExerciseProgressPoint {
  date: string
  maxWeight: number
  totalVolume: number
}

export async function getExerciseProgress(
  exerciseId: string,
): Promise<ExerciseProgressPoint[]> {
  const completedSessions = await db.sessions
    .filter((s) => s.completed)
    .toArray()

  const sessionMap = new Map(
    completedSessions.map((s) => [s.id!, s.startedAt]),
  )

  const logs = await db.setLogs.where('exerciseId').equals(exerciseId).toArray()
  const bySession = new Map<number, SetLog[]>()

  for (const log of logs) {
    if (!sessionMap.has(log.sessionId)) continue
    const existing = bySession.get(log.sessionId) ?? []
    existing.push(log)
    bySession.set(log.sessionId, existing)
  }

  const points: ExerciseProgressPoint[] = []

  for (const [sessionId, sessionLogs] of bySession) {
    const date = sessionMap.get(sessionId)!
    const maxWeight = Math.max(
      ...sessionLogs.map((l) => l.actualWeight ?? 0),
    )
    const totalVolume = sessionLogs.reduce(
      (sum, l) => sum + l.actualReps * (l.actualWeight ?? 0),
      0,
    )
    points.push({
      date: date.toISOString().slice(0, 10),
      maxWeight,
      totalVolume,
    })
  }

  return points.sort((a, b) => a.date.localeCompare(b.date))
}

export async function getLastSessionSummary(
  exerciseId: string,
  beforeSessionId?: number,
): Promise<string | null> {
  const completedSessions = (
    await db.sessions.filter((s) => s.completed).toArray()
  ).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())

  for (const session of completedSessions) {
    if (beforeSessionId && session.id === beforeSessionId) continue
    const logs = await db.setLogs
      .where({ sessionId: session.id!, exerciseId })
      .toArray()
    if (logs.length === 0) continue

    const exercise = await db.exercises.get(exerciseId)
    if (!exercise) continue

    const details = logs
      .map((l) => formatLoggedSet(exercise, l.actualReps, l.actualWeight))
      .join(', ')
    return `Last time: ${logs.length} sets (${details})`
  }

  return null
}

export async function isPersonalBest(
  exerciseId: string,
  weight: number,
  excludeSessionId?: number,
): Promise<boolean> {
  if (weight <= 0) return false

  const logs = await db.setLogs.where('exerciseId').equals(exerciseId).toArray()
  const completedSessionIds = new Set(
    (await db.sessions.filter((s) => s.completed).toArray())
      .filter((s) => s.id !== excludeSessionId)
      .map((s) => s.id!),
  )

  const previousMax = logs
    .filter((l) => completedSessionIds.has(l.sessionId))
    .reduce((max, l) => Math.max(max, l.actualWeight ?? 0), 0)

  return weight > previousMax
}
