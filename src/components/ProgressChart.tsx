import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

import { useTranslation } from '../context/SettingsContext'

interface DataPoint {
  date: string
  [key: string]: string | number
}

interface ProgressChartProps {
  data: DataPoint[]
  lines: { key: string; label: string; color: string }[]
  title: string
}

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

export function ProgressChart({ data, lines, title }: ProgressChartProps) {
  const { t } = useTranslation()
  const dark = useDarkMode()
  const labelColor = dark ? '#f8fafc' : '#0f172a'
  const gridColor = dark ? '#334155' : '#e2e8f0'
  const axisTick = { fontSize: 11, fill: labelColor }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        {t('dashboard.noChartData')}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis
              dataKey="date"
              tick={axisTick}
              tickFormatter={(v) => v.slice(5)}
            />
            <YAxis tick={axisTick} width={36} />
            <Tooltip
              contentStyle={{
                backgroundColor: dark ? '#1e293b' : '#ffffff',
                border: `1px solid ${gridColor}`,
                borderRadius: '0.75rem',
                color: labelColor,
              }}
              labelStyle={{ color: labelColor }}
              itemStyle={{ color: labelColor }}
            />
            <Legend wrapperStyle={{ color: labelColor }} />
            {lines.map((line) => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                name={line.label}
                stroke={line.color}
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
