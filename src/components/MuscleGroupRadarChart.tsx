import { useEffect, useState } from 'react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { useTranslation } from '../context/SettingsContext'
import { muscleGroupShortLabel } from '../lib/muscleGroups'
import type { MuscleGroupStat } from '../lib/progress'

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return dark
}

interface MuscleGroupRadarChartProps {
  data: MuscleGroupStat[]
}

export function MuscleGroupRadarChart({ data }: MuscleGroupRadarChartProps) {
  const { t } = useTranslation()
  const dark = useDarkMode()
  const labelColor = dark ? '#f8fafc' : '#0f172a'
  const gridColor = dark ? '#334155' : '#e2e8f0'
  const hasData = data.some((d) => d.volume > 0)

  if (!hasData) {
    return (
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        {t('dashboard.noWorkoutData')}
      </div>
    )
  }

  const chartData = data.map((d) => ({
    muscleGroup: muscleGroupShortLabel(d.muscleGroup),
    fullMuscleGroup: t(`muscleGroup.${d.muscleGroup}`),
    score: d.score,
    volume: d.volume,
  }))

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-1 font-semibold">{t('dashboard.muscleBalance')}</h3>
      <p className="mb-3 text-xs text-slate-500">{t('dashboard.muscleBalanceHint')}</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke={gridColor} />
            <PolarAngleAxis
              dataKey="muscleGroup"
              tick={{ fontSize: 10, fill: labelColor }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 9, fill: labelColor }}
              tickCount={5}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: dark ? '#1e293b' : '#ffffff',
                border: `1px solid ${gridColor}`,
                borderRadius: '0.75rem',
                color: labelColor,
              }}
              labelStyle={{ color: labelColor }}
              itemStyle={{ color: labelColor }}
              formatter={(value, _name, item) => {
                const volume = item.payload?.volume ?? 0
                const label = item.payload?.fullMuscleGroup ?? item.payload?.muscleGroup
                const score = typeof value === 'number' ? value : Number(value ?? 0)
                return [
                  t('dashboard.relativeVolumeValue', {
                    score,
                    volume: Math.round(volume),
                  }),
                  label,
                ]
              }}
            />
            <Radar
              name={t('dashboard.relativeVolume')}
              dataKey="score"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.35}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
