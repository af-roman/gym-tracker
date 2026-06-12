import type { ExerciseDifficulty } from '../db/schema'
import { useTranslation } from '../context/SettingsContext'
import {
  EXERCISE_DIFFICULTIES,
  formatDifficulties,
  normalizeDifficultyRange,
  selectDifficultyRange,
} from '../lib/exercises'

interface DifficultyRangeSelectProps {
  value: ExerciseDifficulty[]
  onChange: (value: ExerciseDifficulty[]) => void
}

export function DifficultyRangeSelect({
  value,
  onChange,
}: DifficultyRangeSelectProps) {
  const { t } = useTranslation()
  const range = normalizeDifficultyRange(value)
  const rangeStart = range[0]
  const rangeEnd = range[range.length - 1]

  return (
    <div className="block">
      <span className="text-sm font-medium">{t('exercises.difficulty')}</span>
      <p className="mt-0.5 text-xs text-slate-500">{t('exercises.difficultyHint')}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {EXERCISE_DIFFICULTIES.map((option, index) => {
          const inRange = range.includes(option.value)
          const isStart = option.value === rangeStart
          const isEnd = option.value === rangeEnd
          const isMiddle = inRange && !isStart && !isEnd

          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onChange(selectDifficultyRange(range, option.value))
              }
              className={`border px-3 py-1.5 text-sm transition ${
                inRange
                  ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              } ${
                isStart && isEnd
                  ? 'rounded-full'
                  : isStart
                    ? 'rounded-l-full rounded-r-none'
                    : isEnd
                      ? 'rounded-l-none rounded-r-full'
                      : isMiddle
                        ? 'rounded-none'
                        : 'rounded-full'
              } ${index > 0 && inRange ? '-ml-px' : ''}`}
              aria-pressed={inRange}
            >
              {t(`difficulty.${option.value}`)}
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        {t('exercises.difficultyShowsAs')}:{' '}
        <span className="font-medium text-slate-700 dark:text-slate-300">
          {formatDifficulties(range, t)}
        </span>
      </p>
    </div>
  )
}
