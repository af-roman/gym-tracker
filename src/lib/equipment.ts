export const GYM_EQUIPMENT = [
  'barbell',
  'dumbbell',
  'kettlebell',
  'cable_machine',
  'smith_machine',
  'pull_up_bar',
  'bench',
  'squat_rack',
  'leg_press',
  'treadmill',
  'exercise_bike',
  'rowing_machine',
  'elliptical',
  'resistance_bands',
  'trx',
  'medicine_ball',
  'foam_roller',
  'bodyweight',
] as const

export type GymEquipmentId = (typeof GYM_EQUIPMENT)[number]
