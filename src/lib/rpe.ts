export function rpeLabel(rpe: number): string {
  if (rpe <= 4) return 'Easy'
  if (rpe <= 7) return 'Moderate'
  return 'Hard'
}

export function formatReps(reps: number | string): string {
  return typeof reps === 'number' ? String(reps) : reps
}
