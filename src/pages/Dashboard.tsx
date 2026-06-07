import { useEffect, useState } from 'react'
import { db } from '../db/schema'
import type { Exercise } from '../db/schema'
import { ProgressChart } from '../components/ProgressChart'
import { getExerciseProgress } from '../lib/progress'
import { exportAllData, importAllData } from '../lib/export'

type Tab = 'lifts' | 'body'

export function Dashboard() {
  const [tab, setTab] = useState<Tab>('lifts')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [liftData, setLiftData] = useState<
    { date: string; maxWeight: number; totalVolume: number }[]
  >([])
  const [bodyData, setBodyData] = useState<
    { date: string; weightKg: number; waistCm: number }[]
  >([])

  useEffect(() => {
    async function load() {
      const exs = await db.exercises.toArray()
      setExercises(exs)
      if (exs.length > 0 && !selectedExercise) {
        setSelectedExercise(exs[0].id)
      }

      const metrics = await db.bodyMetrics.orderBy('date').toArray()
      setBodyData(
        metrics
          .filter((m) => m.weightKg != null || m.waistCm != null)
          .map((m) => ({
            date: m.date,
            weightKg: m.weightKg ?? 0,
            waistCm: m.waistCm ?? 0,
          })),
      )
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedExercise) return
    getExerciseProgress(selectedExercise).then(setLiftData)
  }, [selectedExercise])

  const handleExport = async () => {
    const data = await exportAllData()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gym-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const text = await file.text()
      const data = JSON.parse(text)
      if (
        !confirm(
          'Import will replace all current data. Continue?',
        )
      )
        return
      await importAllData(data)
      window.location.reload()
    }
    input.click()
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Progress</h1>
      <p className="mb-6 text-sm text-slate-500">
        Track your lifts and body metrics over time
      </p>

      <div className="mb-6 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {(['lifts', 'body'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-white text-emerald-700 shadow dark:bg-slate-900 dark:text-emerald-400'
                : 'text-slate-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'lifts' && (
        <>
          <label className="mb-4 block">
            <span className="text-sm font-medium">Exercise</span>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
            >
              {exercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-4">
            <ProgressChart
              title="Max weight per session (kg)"
              data={liftData}
              lines={[
                {
                  key: 'maxWeight',
                  label: 'Max weight',
                  color: '#10b981',
                },
              ]}
            />
            <ProgressChart
              title="Total volume per session"
              data={liftData}
              lines={[
                {
                  key: 'totalVolume',
                  label: 'Volume',
                  color: '#6366f1',
                },
              ]}
            />
          </div>
        </>
      )}

      {tab === 'body' && (
        <div className="space-y-4">
          <ProgressChart
            title="Body weight (kg)"
            data={bodyData}
            lines={[
              { key: 'weightKg', label: 'Weight', color: '#10b981' },
            ]}
          />
          <ProgressChart
            title="Waist circumference (cm)"
            data={bodyData.filter((d) => d.waistCm > 0)}
            lines={[
              { key: 'waistCm', label: 'Waist', color: '#f59e0b' },
            ]}
          />
        </div>
      )}

      <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="mb-3 font-semibold">Data backup</h2>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700"
          >
            Export JSON
          </button>
          <button
            onClick={handleImport}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700"
          >
            Import JSON
          </button>
        </div>
      </div>
    </div>
  )
}
