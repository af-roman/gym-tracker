import type { Exercise } from '../db/schema'

export const exerciseDefinitions: Exercise[] = [
  {
    id: 'goblet-squat',
    name: 'Goblet Squat',
    muscleGroup: 'Legs',
    instructions:
      'Hold a dumbbell at chest height with both hands. Feet shoulder-width apart, toes slightly out. Push hips back and bend knees to squat until thighs are parallel to the floor. Keep chest up and knees tracking over toes. Drive through heels to stand.',
    illustration: '/illustrations/goblet-squat.svg',
    exerciseType: 'strength',
    defaultSets: 3,
    defaultReps: 10,
    startingWeightNote: 'Start with 8–12 kg and focus on depth and control.',
  },
  {
    id: 'dumbbell-bench-press',
    name: 'Dumbbell Bench Press',
    muscleGroup: 'Chest',
    instructions:
      'Lie on a flat bench holding dumbbells at chest level, palms facing forward. Press weights up until arms are extended without locking elbows. Lower slowly with control until dumbbells reach chest height. Keep shoulder blades squeezed together.',
    illustration: '/illustrations/dumbbell-bench-press.svg',
    exerciseType: 'strength',
    defaultSets: 3,
    defaultReps: 10,
    startingWeightNote: 'Start with 6–10 kg per hand.',
  },
  {
    id: 'dumbbell-row',
    name: 'Dumbbell Row',
    muscleGroup: 'Back',
    instructions:
      'Place one knee and hand on a bench, other foot on the floor. Hold a dumbbell in the free hand, arm extended. Pull the weight to your hip, squeezing your shoulder blade. Lower with control. Keep back flat — avoid rotating your torso.',
    illustration: '/illustrations/dumbbell-row.svg',
    exerciseType: 'strength',
    defaultSets: 3,
    defaultReps: 10,
    startingWeightNote: 'Start with 8–12 kg per arm.',
  },
  {
    id: 'dumbbell-shoulder-press',
    name: 'Dumbbell Shoulder Press',
    muscleGroup: 'Shoulders',
    instructions:
      'Sit or stand with dumbbells at shoulder height, palms forward. Press weights overhead until arms are straight but not locked. Lower to ear level with control. Keep core tight and avoid arching your lower back excessively.',
    illustration: '/illustrations/dumbbell-shoulder-press.svg',
    exerciseType: 'strength',
    defaultSets: 3,
    defaultReps: 10,
    startingWeightNote: 'Start with 4–8 kg per hand.',
  },
  {
    id: 'plank',
    name: 'Plank',
    muscleGroup: 'Core',
    instructions:
      'Forearms on the floor, elbows under shoulders. Body in a straight line from head to heels. Engage core and glutes. Hold without letting hips sag or pike up. Breathe steadily throughout the hold.',
    illustration: '/illustrations/plank.svg',
    exerciseType: 'cardio',
    defaultSets: 3,
    defaultDuration: 30,
    durationUnit: 'sec',
    startingWeightNote: 'Hold 20–30 seconds per set. Quality over duration.',
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian Deadlift',
    muscleGroup: 'Legs',
    instructions:
      'Hold dumbbells in front of thighs, feet hip-width apart. With a slight knee bend, hinge at hips and push them back. Lower weights along your legs until you feel a stretch in hamstrings. Drive hips forward to return to standing. Keep back flat throughout.',
    illustration: '/illustrations/romanian-deadlift.svg',
    exerciseType: 'strength',
    defaultSets: 3,
    defaultReps: 10,
    startingWeightNote: 'Start with 10–14 kg total.',
  },
  {
    id: 'incline-dumbbell-press',
    name: 'Incline Dumbbell Press',
    muscleGroup: 'Chest',
    instructions:
      'Set bench to 30–45 degrees. Hold dumbbells at chest level. Press up and slightly together at the top. Lower with control to chest level. Keep feet flat on the floor and core engaged.',
    illustration: '/illustrations/incline-dumbbell-press.svg',
    exerciseType: 'strength',
    defaultSets: 3,
    defaultReps: 10,
    startingWeightNote: 'Start with 6–10 kg per hand.',
  },
  {
    id: 'lat-pulldown',
    name: 'Lat Pulldown',
    muscleGroup: 'Back',
    instructions:
      'Sit at the lat pulldown machine, grip bar slightly wider than shoulders. Pull bar to upper chest while squeezing shoulder blades. Control the return — don\'t let the weight yank your arms up. Avoid leaning back excessively.',
    illustration: '/illustrations/lat-pulldown.svg',
    exerciseType: 'strength',
    defaultSets: 3,
    defaultReps: '8-10',
    startingWeightNote: 'Start light to learn the movement — around 20–30 kg on the stack.',
  },
  {
    id: 'walking-lunges',
    name: 'Walking Lunges',
    muscleGroup: 'Legs',
    instructions:
      'Hold dumbbells at your sides. Step forward into a lunge — both knees at roughly 90 degrees. Push through front heel to step into the next lunge. Keep torso upright and core braced. Alternate legs each step.',
    illustration: '/illustrations/walking-lunges.svg',
    exerciseType: 'strength',
    defaultSets: 3,
    defaultReps: 10,
    startingWeightNote: 'Start bodyweight or 4–8 kg per hand.',
  },
  {
    id: 'dead-bug',
    name: 'Dead Bug',
    muscleGroup: 'Core',
    instructions:
      'Lie on back, arms pointing up, knees bent at 90 degrees. Press lower back into the floor. Slowly extend opposite arm and leg while keeping back flat. Return and alternate sides. Move slowly — this is about control, not speed.',
    illustration: '/illustrations/dead-bug.svg',
    exerciseType: 'bodyweight',
    defaultSets: 3,
    defaultReps: 10,
    startingWeightNote: '10 reps per side. Reduce range if lower back arches.',
  },
]

export const defaultPlans = [
  {
    id: 'full-body-a',
    name: 'Full Body A',
    description: 'Alternate with Full Body B, 2–3 times per week.',
    exercises: [
      { exerciseId: 'goblet-squat', defaultSets: 3, defaultReps: 10 },
      { exerciseId: 'dumbbell-bench-press', defaultSets: 3, defaultReps: 10 },
      { exerciseId: 'dumbbell-row', defaultSets: 3, defaultReps: 10 },
      { exerciseId: 'dumbbell-shoulder-press', defaultSets: 3, defaultReps: 10 },
      {
        exerciseId: 'plank',
        defaultSets: 3,
        defaultDuration: 30,
        durationUnit: 'sec' as const,
      },
    ],
  },
  {
    id: 'full-body-b',
    name: 'Full Body B',
    description: 'Alternate with Full Body A, 2–3 times per week.',
    exercises: [
      { exerciseId: 'romanian-deadlift', defaultSets: 3, defaultReps: 10 },
      { exerciseId: 'incline-dumbbell-press', defaultSets: 3, defaultReps: 10 },
      { exerciseId: 'lat-pulldown', defaultSets: 3, defaultReps: '8-10' },
      { exerciseId: 'walking-lunges', defaultSets: 3, defaultReps: 10 },
      { exerciseId: 'dead-bug', defaultSets: 3, defaultReps: 10 },
    ],
  },
]
