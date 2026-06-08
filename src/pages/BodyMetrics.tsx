import { useEffect, useState } from 'react'
import { db } from '../db/schema'
import type { BodyMetric } from '../db/schema'

export function BodyMetrics() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [weightKg, setWeightKg] = useState('')
  const [waistCm, setWaistCm] = useState('')
  const [notes, setNotes] = useState('')
  const [history, setHistory] = useState<BodyMetric[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const loadHistory = async () => {
    const metrics = await db.bodyMetrics.orderBy('date').reverse().toArray()
    setHistory(metrics)
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const resetForm = () => {
    setEditingId(null)
    setDate(new Date().toISOString().slice(0, 10))
    setWeightKg('')
    setWaistCm('')
    setNotes('')
    setError('')
  }

  const loadIntoForm = (metric: BodyMetric) => {
    setEditingId(metric.id ?? null)
    setDate(metric.date)
    setWeightKg(metric.weightKg?.toString() ?? '')
    setWaistCm(metric.waistCm?.toString() ?? '')
    setNotes(metric.notes ?? '')
    setError('')
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    setError('')

    const entry: BodyMetric = {
      date,
      weightKg: weightKg ? parseFloat(weightKg) : undefined,
      waistCm: waistCm ? parseFloat(waistCm) : undefined,
      notes: notes || undefined,
    }

    if (editingId != null) {
      const conflict = await db.bodyMetrics
        .where('date')
        .equals(date)
        .filter((m) => m.id !== editingId)
        .first()
      if (conflict) {
        setError('Another record already exists for this date.')
        setSaving(false)
        return
      }
      await db.bodyMetrics.update(editingId, entry)
    } else {
      const existing = await db.bodyMetrics.where('date').equals(date).first()
      if (existing?.id) {
        await db.bodyMetrics.update(existing.id, entry)
        setEditingId(existing.id)
      } else {
        const id = await db.bodyMetrics.add(entry)
        if (id != null) setEditingId(id)
      }
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await loadHistory()
    setSaving(false)
  }

  const deleteEntry = async () => {
    if (editingId == null) return
    if (!confirm('Delete this body metrics record?')) return

    setDeleting(true)
    await db.bodyMetrics.delete(editingId)
    resetForm()
    await loadHistory()
    setDeleting(false)
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Body metrics</h1>
      <p className="mb-6 text-sm text-slate-500">
        Log weight and measurements on rest days
      </p>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        {editingId != null && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            Editing a history record
          </p>
        )}

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

        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={save}
          disabled={saving || (!weightKg && !waistCm)}
          className="w-full rounded-2xl bg-emerald-600 py-4 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : saved ? 'Saved ✓' : editingId ? 'Update record' : 'Save metrics'}
        </button>

        {editingId != null && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700"
            >
              New entry
            </button>
            <button
              type="button"
              onClick={deleteEntry}
              disabled={deleting}
              className="flex-1 rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 dark:border-red-900 dark:text-red-400"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-semibold">History</h2>
          <p className="mb-3 text-xs text-slate-500">
            Tap a record to edit it
          </p>
          <div className="space-y-2">
            {history.map((m) => {
              const isSelected = editingId === m.id

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => loadIntoForm(m)}
                  className={`flex w-full items-start justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                      : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-emerald-800 dark:hover:bg-slate-900'
                  }`}
                >
                  <span className="font-medium">{m.date}</span>
                  <div className="text-right">
                    <span className="text-slate-500">
                      {m.weightKg != null ? `${m.weightKg} kg` : ''}
                      {m.weightKg != null && m.waistCm != null ? ' · ' : ''}
                      {m.waistCm != null ? `${m.waistCm} cm waist` : ''}
                    </span>
                    {m.notes?.trim() && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">
                        {m.notes}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
