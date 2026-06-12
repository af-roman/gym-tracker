import { GYM_EQUIPMENT } from '../lib/equipment'
import { useSettings } from '../context/SettingsContext'
import type { AppLanguage, TextSize, ThemeMode } from '../lib/settings'

function OptionRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${
                selected
                  ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
              aria-pressed={selected}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Settings() {
  const {
    settings,
    setTheme,
    setTextSize,
    setLanguage,
    setEquipment,
    toggleEquipment,
    t,
  } = useSettings()

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: t('settings.themeLight') },
    { value: 'dark', label: t('settings.themeDark') },
    { value: 'system', label: t('settings.themeSystem') },
  ]

  const textSizeOptions: { value: TextSize; label: string }[] = [
    { value: 'small', label: t('settings.textSizeSmall') },
    { value: 'medium', label: t('settings.textSizeMedium') },
    { value: 'large', label: t('settings.textSizeLarge') },
  ]

  const languageOptions: { value: AppLanguage; label: string }[] = [
    { value: 'en', label: t('settings.languageEn') },
    { value: 'cs', label: t('settings.languageCs') },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">{t('settings.title')}</h1>

      <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-4 font-semibold">{t('settings.appearance')}</h2>
        <div className="space-y-5">
          <OptionRow
            label={t('settings.theme')}
            value={settings.theme}
            options={themeOptions}
            onChange={setTheme}
          />
          <OptionRow
            label={t('settings.textSize')}
            value={settings.textSize}
            options={textSizeOptions}
            onChange={setTextSize}
          />
          <OptionRow
            label={t('settings.language')}
            value={settings.language}
            options={languageOptions}
            onChange={setLanguage}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-semibold">{t('settings.equipment')}</h2>
        <p className="mt-1 text-sm text-slate-500">{t('settings.equipmentHint')}</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setEquipment([...GYM_EQUIPMENT])}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
          >
            {t('settings.equipmentSelectAll')}
          </button>
          <button
            type="button"
            onClick={() => setEquipment(['bodyweight'])}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700"
          >
            {t('settings.equipmentClear')}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {GYM_EQUIPMENT.map((id) => {
            const selected = settings.equipment.includes(id)
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggleEquipment(id)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  selected
                    ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-800 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                }`}
                aria-pressed={selected}
              >
                {t(`equipment.${id}`)}
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
