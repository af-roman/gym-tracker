import type { TranslateFn } from '../lib/exercises'

export function rpeLabel(rpe: number, t?: TranslateFn): string {
  if (t) {
    if (rpe <= 4) return t('exerciseDetail.rpeEasy')
    if (rpe <= 7) return t('exerciseDetail.rpeModerate')
    return t('exerciseDetail.rpeHard')
  }
  if (rpe <= 4) return 'Easy'
  if (rpe <= 7) return 'Moderate'
  return 'Hard'
}

export function formatReps(reps: number | string): string {
  return typeof reps === 'number' ? String(reps) : reps
}
