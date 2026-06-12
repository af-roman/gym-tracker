import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../db/schema'
import type { Exercise, SetLog, WorkoutPlan } from '../db/schema'
import { useTranslation } from '../context/SettingsContext'
import { formatLoggedSet } from '../lib/exercises'
import { resolveSessionExerciseId } from '../lib/session'

export function SessionSummary() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [plan, setPlan] = useState<WorkoutPlan | null>(null)
  const [swaps, setSwaps] = useState<Record<string, string>>({})
  const [logs, setLogs] = useState<(SetLog & { exercise?: Exercise })[]>([])
  const [notes, setNotes] = useState('')
  const [overallRpe, setOverallRpe] = useState(5)
  const [saving, setSaving] = useState(false)

  const sid = parseInt(sessionId ?? '0', 10)

  useEffect(() => {
    async function load() {
      const session = await db.sessions.get(sid)
      if (!session) {
        navigate('/')
        return
      }
      const workoutPlan = await db.workoutPlans.get(session.planId)
      const allLogs = await db.setLogs.where('sessionId').equals(sid).toArray()
      const enriched = await Promise.all(
        allLogs.map(async (log) => ({
          ...log,
          exercise: await db.exercises.get(log.exerciseId),
        })),
      )
      setPlan(workoutPlan ?? null)
      setSwaps(session.exerciseSwaps ?? {})
      setLogs(enriched)
      setNotes(session.notes ?? '')
      setOverallRpe(session.overallRpe ?? 5)
    }
    load()
  }, [sid, navigate])

  const saveSession = async () => {
    setSaving(true)
    await db.sessions.update(sid, {
      completed: true,
      completedAt: new Date(),
      notes: notes || undefined,
      overallRpe,
    })
    navigate('/dashboard')
    setSaving(false)
  }

  if (!plan) {
    return <p className="text-center text-slate-500">{t('common.loading')}</p>
  }

  const grouped = plan.exercises.map((pe) => {
    const resolvedId = resolveSessionExerciseId(pe.exerciseId, swaps)
    return {
      resolvedId,
      swapped: resolvedId !== pe.exerciseId,
      exercise: logs.find((l) => l.exerciseId === resolvedId)?.exercise,
      sets: logs.filter((l) => l.exerciseId === resolvedId),
    }
  })

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">{t('sessionSummary.title')}</h1>
      <p className="mb-6 text-sm text-slate-500">{plan.name}</p>

      <div className="space-y-4">
        {grouped.map(({ resolvedId, swapped, exercise, sets }) => (
          <div
            key={resolvedId}
            className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="font-semibold">
              {exercise?.name ?? t('common.exercise')}
            </h3>
            {swapped && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {t('sessionSummary.substituted')}
              </p>
            )}
            {sets.length === 0 ? (
              <p className="text-sm text-slate-400">{t('common.notLogged')}</p>
            ) : exercise ? (
              <ul className="mt-2 space-y-1 text-sm">
                {sets.map((s) => (
                  <li
                    key={s.id}
                    className="text-slate-600 dark:text-slate-300"
                  >
                    {t('common.setLine', {
                      number: s.setNumber,
                      value: formatLoggedSet(exercise, s.actualReps, s.actualWeight),
                    })}
                    {s.rpe ? ` · ${t('common.rpe', { value: s.rpe })}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      <label className="mt-6 block">
        <span className="text-sm font-medium">{t('sessionSummary.howDidItFeel')}</span>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={10}
            value={overallRpe}
            onChange={(e) => setOverallRpe(parseInt(e.target.value, 10))}
            className="flex-1"
          />
          <span className="w-8 text-center font-semibold">{overallRpe}</span>
        </div>
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium">{t('sessionSummary.sessionNotes')}</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder={t('sessionSummary.sessionNotesPlaceholder')}
          className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        />
      </label>

      <button
        onClick={saveSession}
        disabled={saving}
        className="mt-6 w-full rounded-2xl bg-emerald-600 py-4 font-semibold text-white disabled:opacity-50"
      >
        {saving ? t('common.saving') : t('sessionSummary.saveWorkout')}
      </button>

      <Link
        to={`/session/${sid}`}
        className="mt-3 block text-center text-sm text-slate-500"
      >
        {t('common.backToChecklist')}
      </Link>
    </div>
  )
}
