export const MUSCLE_GROUPS = [
  'Chest',
  'Lats',
  'Upper back',
  'Lower back',
  'Delts',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Glutes',
  'Quads',
  'Hamstrings',
  'Calves',
  'Full body',
  'Other',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

const MUSCLE_GROUP_ORDER = new Map<MuscleGroup, number>(
  MUSCLE_GROUPS.map((group, index) => [group, index]),
)

export const MUSCLE_GROUP_SHORT: Record<MuscleGroup, string> = {
  Chest: 'Chest',
  Lats: 'Lats',
  'Upper back': 'Up back',
  'Lower back': 'Low back',
  Delts: 'Delts',
  Biceps: 'Bis',
  Triceps: 'Tris',
  Forearms: 'Forearms',
  Core: 'Core',
  Glutes: 'Glutes',
  Quads: 'Quads',
  Hamstrings: 'Hams',
  Calves: 'Calves',
  'Full body': 'Full',
  Other: 'Other',
}

const LEGACY_MUSCLE_GROUP_MAP: Record<string, MuscleGroup[]> = {
  Arms: ['Biceps', 'Triceps'],
  Back: ['Lats', 'Upper back'],
  Chest: ['Chest'],
  Core: ['Core'],
  'Full body': ['Full body'],
  Legs: ['Quads', 'Glutes', 'Hamstrings'],
  Other: ['Other'],
  Shoulders: ['Delts'],
  Cardio: ['Full body'],
}

export function isMuscleGroup(value: string): value is MuscleGroup {
  return (MUSCLE_GROUPS as readonly string[]).includes(value)
}

export function normalizeMuscleGroups(groups: string[]): MuscleGroup[] {
  const mapped: MuscleGroup[] = []

  for (const group of groups) {
    if (isMuscleGroup(group)) {
      if (!mapped.includes(group)) mapped.push(group)
      continue
    }

    const legacy = LEGACY_MUSCLE_GROUP_MAP[group]
    if (legacy) {
      for (const mappedGroup of legacy) {
        if (!mapped.includes(mappedGroup)) mapped.push(mappedGroup)
      }
    }
  }

  if (mapped.length === 0) return ['Other']

  return mapped.sort(
    (a, b) => (MUSCLE_GROUP_ORDER.get(a) ?? 99) - (MUSCLE_GROUP_ORDER.get(b) ?? 99),
  )
}

export function muscleGroupShortLabel(group: string): string {
  if (isMuscleGroup(group)) return MUSCLE_GROUP_SHORT[group]
  return group
}
