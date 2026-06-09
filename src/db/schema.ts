import Dexie, { type EntityTable } from 'dexie'
import { normalizeMuscleGroups } from '../lib/muscleGroups'

export type ExerciseType =
  | 'squat'
  | 'hinge'
  | 'horizontal-push'
  | 'horizontal-pull'
  | 'vertical-push'
  | 'vertical-pull'
  | 'accessory'
  | 'core'
  | 'cardio'
  | 'stretch'
  | 'joint-mobility'
  | 'roller-massage'
export type DurationUnit = 'sec' | 'min'
export type ExerciseDifficulty = 'beginner' | 'intermediate' | 'advanced'

export interface Exercise {
  id: string
  name: string
  muscleGroups: string[]
  difficulties: ExerciseDifficulty[]
  instructions: string
  instructionPhotos?: string[]
  thumbnailPhotoIndex?: number
  tutorialVideoUrl?: string
  exerciseType: ExerciseType
  defaultSets: number
  /** Reps + kg types */
  defaultReps?: number | string
  /** Cardio & stretch */
  defaultDuration?: number
  durationUnit?: DurationUnit
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
  /** Plan slot exercise id → replacement exercise id for this session only */
  exerciseSwaps?: Record<string, string>
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
          .modify((ex: Exercise & { weightUnit?: string; exerciseType?: string }) => {
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
              ;(ex as { exerciseType: string }).exerciseType = 'bodyweight'
            } else {
              ;(ex as { exerciseType: string }).exerciseType = 'strength'
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
    this.version(3)
      .stores({
        exercises: 'id, name, muscleGroup',
        workoutPlans: 'id, name',
        sessions: '++id, planId, startedAt, completed',
        setLogs: '++id, sessionId, exerciseId, [sessionId+exerciseId]',
        bodyMetrics: '++id, date',
      })
      .upgrade(async (tx) => {
        const LEGACY_TYPE_MAP: Record<string, ExerciseType> = {
          strength: 'accessory',
          bodyweight: 'core',
          cardio: 'cardio',
        }

        const SEED_TYPE_MAP: Record<string, ExerciseType> = {
          'goblet-squat': 'squat',
          'walking-lunges': 'squat',
          'romanian-deadlift': 'hinge',
          'dumbbell-bench-press': 'horizontal-push',
          'incline-dumbbell-press': 'horizontal-push',
          'dumbbell-row': 'horizontal-pull',
          'lat-pulldown': 'vertical-pull',
          'dumbbell-shoulder-press': 'vertical-push',
          'dead-bug': 'core',
          plank: 'core',
        }

        const isDurationType = (type: ExerciseType) =>
          type === 'cardio' || type === 'stretch'

        await tx
          .table('exercises')
          .toCollection()
          .modify((ex: Exercise) => {
            const raw = ex.exerciseType as string
            if (SEED_TYPE_MAP[ex.id]) {
              ex.exerciseType = SEED_TYPE_MAP[ex.id]
            } else if (LEGACY_TYPE_MAP[raw]) {
              ex.exerciseType = LEGACY_TYPE_MAP[raw]
            } else if (
              ![
                'squat',
                'hinge',
                'horizontal-push',
                'horizontal-pull',
                'vertical-push',
                'vertical-pull',
                'accessory',
                'core',
                'cardio',
                'stretch',
              ].includes(raw)
            ) {
              ex.exerciseType = 'accessory'
            }

            if (isDurationType(ex.exerciseType)) {
              if (ex.defaultDuration == null) {
                const rawReps = ex.defaultReps
                if (typeof rawReps === 'number') ex.defaultDuration = rawReps
                else {
                  const parsed = parseInt(String(rawReps ?? ''), 10)
                  ex.defaultDuration = Number.isNaN(parsed) ? 30 : parsed
                }
              }
              ex.durationUnit = ex.durationUnit ?? 'sec'
              delete ex.defaultReps
              delete ex.defaultWeight
            } else {
              if (ex.defaultReps == null && ex.defaultDuration != null) {
                ex.defaultReps = ex.defaultDuration
              }
              if (ex.defaultReps == null) ex.defaultReps = 10
              delete ex.defaultDuration
              delete ex.durationUnit
            }
          })

        await tx
          .table('workoutPlans')
          .toCollection()
          .modify(async (plan: WorkoutPlan) => {
            for (const pe of plan.exercises) {
              if (pe.defaultDuration == null) continue
              const ex = (await tx.table('exercises').get(pe.exerciseId)) as
                | Exercise
                | undefined
              const type = ex?.exerciseType ?? 'accessory'
              if (isDurationType(type)) continue
              if (pe.defaultReps == null) pe.defaultReps = pe.defaultDuration
              delete pe.defaultDuration
              delete pe.durationUnit
            }
          })
      })
    this.version(4)
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
          .modify((ex: Exercise & { illustration?: string }) => {
            if (!ex.instructionPhotos) ex.instructionPhotos = []

            if (ex.illustration?.startsWith('data:')) {
              ex.instructionPhotos = [
                ex.illustration,
                ...ex.instructionPhotos,
              ].slice(0, 4)
              ex.thumbnailPhotoIndex = 0
            }

            delete ex.illustration
          })
      })
    this.version(5)
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
          .modify((ex: Exercise & { muscleGroup?: string }) => {
            if (ex.muscleGroup === 'Cardio') {
              ex.muscleGroup = 'Other'
            }
          })
      })
    this.version(6).stores({
      exercises: 'id, name, muscleGroup',
      workoutPlans: 'id, name',
      sessions: '++id, planId, startedAt, completed',
      setLogs: '++id, sessionId, exerciseId, [sessionId+exerciseId]',
      bodyMetrics: '++id, date',
    })
    this.version(7)
      .stores({
        exercises: 'id, name, muscleGroup, difficulty',
        workoutPlans: 'id, name',
        sessions: '++id, planId, startedAt, completed',
        setLogs: '++id, sessionId, exerciseId, [sessionId+exerciseId]',
        bodyMetrics: '++id, date',
      })
      .upgrade(async (tx) => {
        await tx
          .table('exercises')
          .toCollection()
          .modify(
            (
              ex: Exercise & {
                muscleGroup?: string
                difficulty?: ExerciseDifficulty
              },
            ) => {
              if (ex.difficulty) return
              const text =
                `${ex.instructions} ${ex.startingWeightNote ?? ''}`.toLowerCase()
              if (
                text.includes('advanced') &&
                !text.includes('beginner') &&
                !text.includes('from beginner')
              ) {
                ex.difficulty = 'advanced'
              } else if (
                text.includes('beginner') ||
                text.includes('from beginner to every level')
              ) {
                ex.difficulty = 'beginner'
              } else {
                ex.difficulty = 'intermediate'
              }
            },
          )
      })
    this.version(8)
      .stores({
        exercises: 'id, name',
        workoutPlans: 'id, name',
        sessions: '++id, planId, startedAt, completed',
        setLogs: '++id, sessionId, exerciseId, [sessionId+exerciseId]',
        bodyMetrics: '++id, date',
      })
      .upgrade(async (tx) => {
        await tx
          .table('exercises')
          .toCollection()
          .modify(
            (
              ex: Exercise & {
                muscleGroup?: string
                difficulty?: ExerciseDifficulty
              },
            ) => {
              if (!ex.muscleGroups?.length) {
                const legacy = ex.muscleGroup === 'Cardio' ? 'Other' : ex.muscleGroup
                ex.muscleGroups = legacy ? [legacy] : ['Other']
              }
              delete ex.muscleGroup

              if (!ex.difficulties?.length) {
                ex.difficulties = ex.difficulty ? [ex.difficulty] : ['intermediate']
              }
              delete ex.difficulty
            },
          )
      })
    this.version(9)
      .stores({
        exercises: 'id, name',
        workoutPlans: 'id, name',
        sessions: '++id, planId, startedAt, completed',
        setLogs: '++id, sessionId, exerciseId, [sessionId+exerciseId]',
        bodyMetrics: '++id, date',
      })
      .upgrade(async (tx) => {
        const order: ExerciseDifficulty[] = [
          'beginner',
          'intermediate',
          'advanced',
        ]
        await tx
          .table('exercises')
          .toCollection()
          .modify((ex: Exercise) => {
            const indices = [
              ...new Set(
                (ex.difficulties ?? [])
                  .filter((level): level is ExerciseDifficulty =>
                    order.includes(level),
                  )
                  .map((level) => order.indexOf(level)),
              ),
            ].sort((a, b) => a - b)
            if (indices.length === 0) {
              ex.difficulties = ['intermediate']
              return
            }
            ex.difficulties = order.slice(indices[0], indices[indices.length - 1] + 1)
          })
      })
    this.version(10)
      .stores({
        exercises: 'id, name',
        workoutPlans: 'id, name',
        sessions: '++id, planId, startedAt, completed',
        setLogs: '++id, sessionId, exerciseId, [sessionId+exerciseId]',
        bodyMetrics: '++id, date',
      })
      .upgrade(async (tx) => {
        await tx
          .table('exercises')
          .toCollection()
          .modify((ex: Exercise) => {
            ex.muscleGroups = normalizeMuscleGroups(ex.muscleGroups ?? [])
          })
      })
  }
}

export const db = new GymTrackerDB()
