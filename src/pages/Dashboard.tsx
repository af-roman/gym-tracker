import { useEffect, useState } from 'react'
import { db } from '../db/schema'
import type { Exercise } from '../db/schema'
import { MuscleGroupRadarChart } from '../components/MuscleGroupRadarChart'
import { ProgressChart } from '../components/ProgressChart'
import { useTranslation } from '../context/SettingsContext'
import { getExerciseProgress, getMuscleGroupStats } from '../lib/progress'
import type { MuscleGroupStat } from '../lib/progress'
import { exportAllData, importAllData } from '../lib/export'

type Tab = 'exercises' | 'body'

export function Dashboard() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('exercises')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedExercise, setSelectedExercise] = useState('')
  const [liftData, setLiftData] = useState<
    { date: string; maxWeight: number; totalVolume: number }[]
  >([])
  const [bodyData, setBodyData] = useState<
    { date: string; weightKg: number; waistCm: number }[]
  >([])
  const [muscleGroupData, setMuscleGroupData] = useState<MuscleGroupStat[]>([])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'exercises', label: t('dashboard.tabExercises') },
    { id: 'body', label: t('dashboard.tabBody') },
  ]

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
      setMuscleGroupData(await getMuscleGroupStats())
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
      if (!confirm(t('dashboard.importConfirm'))) return
      await importAllData(data)
      window.location.reload()
    }
    input.click()
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">{t('dashboard.title')}</h1>
      <p className="mb-6 text-sm text-slate-500">{t('dashboard.subtitle')}</p>

      <div className="mb-6 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === item.id
                ? 'bg-white text-emerald-700 shadow dark:bg-slate-900 dark:text-emerald-400'
                : 'text-slate-500'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'exercises' && (
        <>
          <MuscleGroupRadarChart data={muscleGroupData} />

          <label className="mb-4 block">
            <span className="text-sm font-medium">{t('dashboard.selectExercise')}</span>
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
              title={t('dashboard.maxWeightChart')}
              data={liftData}
              lines={[
                {
                  key: 'maxWeight',
                  label: t('dashboard.chartMaxWeight'),
                  color: '#10b981',
                },
              ]}
            />
            <ProgressChart
              title={t('dashboard.volumeChart')}
              data={liftData}
              lines={[
                {
                  key: 'totalVolume',
                  label: t('dashboard.chartVolume'),
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
            title={t('dashboard.bodyWeight')}
            data={bodyData}
            lines={[
              { key: 'weightKg', label: t('dashboard.chartWeight'), color: '#10b981' },
            ]}
          />
          <ProgressChart
            title={t('dashboard.waistChart')}
            data={bodyData.filter((d) => d.waistCm > 0)}
            lines={[
              { key: 'waistCm', label: t('dashboard.chartWaist'), color: '#f59e0b' },
            ]}
          />
        </div>
      )}

      <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
        <h2 className="mb-3 font-semibold">{t('dashboard.dataBackup')}</h2>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700"
          >
            {t('dashboard.exportJson')}
          </button>
          <button
            onClick={handleImport}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-medium dark:border-slate-700"
          >
            {t('dashboard.importJson')}
          </button>
        </div>
      </div>
    </div>
  )
}
