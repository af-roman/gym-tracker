interface MultiSelectPillsProps<T extends string> {
  label: string
  hint?: string
  options: readonly T[]
  values: T[]
  onChange: (values: T[]) => void
  min?: number
  getLabel?: (option: T) => string
}

export function MultiSelectPills<T extends string>({
  label,
  hint,
  options,
  values,
  onChange,
  min = 1,
  getLabel,
}: MultiSelectPillsProps<T>) {
  const toggle = (option: T) => {
    if (values.includes(option)) {
      if (values.length <= min) return
      onChange(values.filter((value) => value !== option))
      return
    }
    onChange([...values, option])
  }

  return (
    <div className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = values.includes(option)
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                selected
                  ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
              aria-pressed={selected}
            >
              {getLabel?.(option) ?? option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
