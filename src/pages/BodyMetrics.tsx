import { useEffect, useState } from 'react'
import { db } from '../db/schema'
import type { BodyMetric } from '../db/schema'

export function BodyMetrics() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [weightKg, setWeightKg] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [notes, setNotes] = useState('')
  const [history, setHistory] = useState<BodyMetric[]>([])
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const loadHistory = async () => {
    const metrics = await db.bodyMetrics.orderBy('date').reverse().toArray()
    setHistory(metrics)
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const save = async () => {
    setSaving(true)
    const existing = await db.bodyMetrics.where('date').equals(date).first()
    const entry: BodyMetric = {
      date,
      weightKg: weightKg ? parseFloat(weightKg) : undefined,
      waistCm: waistCm ? parseFloat(waistCm) : undefined,
      notes: notes || undefined,
    }

    if (existing?.id) {
      await db.bodyMetrics.update(existing.id, entry)
    } else {
      await db.bodyMetrics.add(entry)
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await loadHistory()
    setSaving(false)
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Body metrics</h1>
      <p className="mb-6 text-sm text-slate-500">
        Log weight and measurements on rest days
      </p>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="block min-w-0">
          <span className="text-sm font-medium">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 box-border w-full max-w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Weight (kg)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="e.g. 78.5"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-lg dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Waist (cm)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={waistCm}
            onChange={(e) => setWaistCm(e.target.value)}
            placeholder="e.g. 85"
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-lg dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Notes (optional)</span>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800"
          />
        </label>

        <button
          onClick={save}
          disabled={saving || (!weightKg && !waistCm)}
          className="w-full rounded-2xl bg-emerald-600 py-4 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save metrics'}
        </button>
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-semibold">History</h2>
          <div className="space-y-2">
            {history.slice(0, 10).map((m) => {
              const isExpanded = expandedId === m.id
              const hasNotes = Boolean(m.notes?.trim())

              return (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800"
                >
                  <button
                    type="button"
                    onClick={() =>
                      hasNotes &&
                      setExpandedId(isExpanded ? null : (m.id ?? null))
                    }
                    className={`flex w-full items-start justify-between gap-3 px-4 py-3 text-left text-sm ${
                      hasNotes ? 'cursor-pointer' : 'cursor-default'
                    }`}
                  >
                    <span className="font-medium">{m.date}</span>
                    <div className="text-right">
                      <span className="text-slate-500">
                        {m.weightKg != null ? `${m.weightKg} kg` : ''}
                        {m.weightKg != null && m.waistCm != null ? ' · ' : ''}
                        {m.waistCm != null ? `${m.waistCm} cm waist` : ''}
                      </span>
                      {hasNotes && (
                        <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                          {isExpanded ? 'Hide notes' : 'View notes'}
                        </p>
                      )}
                    </div>
                  </button>
                  {isExpanded && hasNotes && (
                    <div className="border-t border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
                      {m.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
