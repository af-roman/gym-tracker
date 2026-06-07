import type { Exercise } from '../db/schema'
import exercisesJson from './exercises.json'

export const exerciseDefinitions: Exercise[] = exercisesJson as Exercise[]

export const defaultPlans = [
  {
    id: 'full-body-a',
    name: 'Full Body A',
    description: 'Alternate with Full Body B, 2–3 times per week.',
    exercises: [
      { exerciseId: 'goblet-squat', defaultSets: 3, defaultReps: 10 },
      {
        exerciseId: 'bench-press-on-a-horizontal-bench',
        defaultSets: 3,
        defaultReps: 10,
      },
      {
        exerciseId: 'one-arm-rows-on-an-incline-bench',
        defaultSets: 3,
        defaultReps: 10,
      },
      {
        exerciseId: 'shoulder-presses-on-the-machine',
        defaultSets: 3,
        defaultReps: 10,
      },
      { exerciseId: 'dead-bug', defaultSets: 3, defaultReps: '6-8' },
    ],
  },
  {
    id: 'full-body-b',
    name: 'Full Body B',
    description: 'Alternate with Full Body A, 2–3 times per week.',
    exercises: [
      {
        exerciseId: 'romanian-deadlift-rdl-with-big-axis',
        defaultSets: 3,
        defaultReps: 10,
      },
      {
        exerciseId: 'bench-press-on-an-inclined-bench',
        defaultSets: 3,
        defaultReps: 10,
      },
      {
        exerciseId: 'wide-grip-seated-upper-pulley-pull-down',
        defaultSets: 3,
        defaultReps: 10,
      },
      { exerciseId: 'lunges-while-walking', defaultSets: 3, defaultReps: 10 },
      {
        exerciseId: 'lifting-limbs-on-all-fours-superman-arms-and-legs',
        defaultSets: 3,
        defaultReps: '6-8',
      },
    ],
  },
]
