import Dexie, { type EntityTable } from 'dexie'

export type ExerciseType = 'strength' | 'bodyweight' | 'cardio'
export type DurationUnit = 'sec' | 'min'

export interface Exercise {
  id: string
  name: string
  muscleGroup: string
  instructions: string
  illustration: string
  exerciseType: ExerciseType
  defaultSets: number
  /** Strength & bodyweight */
  defaultReps?: number | string
  /** Cardio */
  defaultDuration?: number
  durationUnit?: DurationUnit
  /** Strength only (kg) */
  defaultWeight?: number
  startingWeightNote?: string
  /** @deprecated migrated to exerciseType */
  weightUnit?: 'kg' | 'bodyweight' | 'sec'
}

export interface PlanExercise {
  exerciseId: string
  defaultSets: number
  defaultReps?: number | string
  defaultDuration?: number
  durationUnit?: DurationUnit
  defaultWeight?: number
}

export interface WorkoutPlan {
  id: string
  name: string
  description: string
  exercises: PlanExercise[]
}

export interface Session {
  id?: number
  planId: string
  startedAt: Date
  completedAt?: Date
  notes?: string
  completed: boolean
  overallRpe?: number
  completedExerciseIds: string[]
}

export interface SetLog {
  id?: number
  sessionId: number
  exerciseId: string
  setNumber: number
  targetReps: number | string
  targetWeight?: number
  actualReps: number
  actualWeight?: number
  rpe?: number
  notes?: string
}

export interface BodyMetric {
  id?: number
  date: string
  weightKg?: number
  waistCm?: number
  notes?: string
}

export interface ExportData {
  version: 1
  exportedAt: string
  exercises: Exercise[]
  workoutPlans: WorkoutPlan[]
  sessions: Session[]
  setLogs: SetLog[]
  bodyMetrics: BodyMetric[]
}

class GymTrackerDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  workoutPlans!: EntityTable<WorkoutPlan, 'id'>
  sessions!: EntityTable<Session, 'id'>
  setLogs!: EntityTable<SetLog, 'id'>
  bodyMetrics!: EntityTable<BodyMetric, 'id'>

  constructor() {
    super('GymTrackerDB')
    this.version(1).stores({
      exercises: 'id, name, muscleGroup',
      workoutPlans: 'id, name',
      sessions: '++id, planId, startedAt, completed',
      setLogs: '++id, sessionId, exerciseId, [sessionId+exerciseId]',
      bodyMetrics: '++id, date',
    })
    this.version(2)
      .stores({
        exercises: 'id, name, muscleGroup',
        workoutPlans: 'id, name',
        sessions: '++id, planId, startedAt, completed',
        setLogs: '++id, sessionId, exerciseId, [sessionId+exerciseId]',
        bodyMetrics: '++id, date',
      })
      .upgrade(async (tx) => {
        await tx
          .table('exercises')
          .toCollection()
          .modify((ex: Exercise & { weightUnit?: string }) => {
            if (ex.exerciseType) return

            if (ex.weightUnit === 'sec') {
              ex.exerciseType = 'cardio'
              ex.durationUnit = 'sec'
              if (ex.defaultDuration == null) {
                const raw = ex.defaultReps
                if (typeof raw === 'number') ex.defaultDuration = raw
                else {
                  const parsed = parseInt(String(raw ?? ''), 10)
                  ex.defaultDuration = Number.isNaN(parsed) ? 30 : parsed
                }
              }
            } else if (ex.weightUnit === 'bodyweight') {
              ex.exerciseType = 'bodyweight'
            } else {
              ex.exerciseType = 'strength'
            }
            delete ex.weightUnit
          })

        await tx
          .table('workoutPlans')
          .toCollection()
          .modify((plan: WorkoutPlan) => {
            for (const pe of plan.exercises) {
              if (
                pe.defaultDuration != null ||
                typeof pe.defaultReps !== 'string' ||
                !pe.defaultReps.includes('sec')
              ) {
                continue
              }
              const parsed = parseInt(pe.defaultReps, 10)
              if (!Number.isNaN(parsed)) {
                pe.defaultDuration = parsed
                pe.durationUnit = 'sec'
                delete pe.defaultReps
              }
            }
          })
      })
  }
}

export const db = new GymTrackerDB()
