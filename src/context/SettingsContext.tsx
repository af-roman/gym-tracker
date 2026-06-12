import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { cs } from '../i18n/cs'
import { en } from '../i18n/en'
import {
  applySettings,
  DEFAULT_SETTINGS,
  loadSettings,
  resolveTheme,
  saveSettings,
  type AppLanguage,
  type AppSettings,
  type TextSize,
  type ThemeMode,
} from '../lib/settings'
import type { GymEquipmentId } from '../lib/equipment'

const dictionaries: { en: typeof en; cs: typeof en } = {
  en,
  cs: cs as typeof en,
}

type TranslationParams = Record<string, string | number>

function getNestedValue(tree: (typeof dictionaries)[AppLanguage], path: string): string | undefined {
  const parts = path.split('.')
  let current: unknown = tree
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    params[key] != null ? String(params[key]) : '',
  )
}

function translate(
  language: AppLanguage,
  key: string,
  params?: TranslationParams,
): string {
  const dict = dictionaries[language]
  const count = params?.count
  let resolvedKey = key
  if (count != null) {
    const pluralKey = Number(count) === 1 ? `${key}_one` : `${key}_other`
    if (getNestedValue(dict, pluralKey)) resolvedKey = pluralKey
  }

  const value =
    getNestedValue(dict, resolvedKey) ?? getNestedValue(dictionaries.en, resolvedKey)
  if (value) return interpolate(value, params)

  return key
}

interface SettingsContextValue {
  settings: AppSettings
  setTheme: (theme: ThemeMode) => void
  setTextSize: (textSize: TextSize) => void
  setLanguage: (language: AppLanguage) => void
  setEquipment: (equipment: GymEquipmentId[]) => void
  toggleEquipment: (id: GymEquipmentId) => void
  t: (key: string, params?: TranslationParams) => string
  locale: string
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())

  const persist = useCallback((next: AppSettings) => {
    setSettings(next)
    saveSettings(next)
    applySettings(next)
  }, [])

  useEffect(() => {
    applySettings(settings)
  }, [settings])

  useEffect(() => {
    if (settings.theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applySettings(settings)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [settings])

  const t = useCallback(
    (key: string, params?: TranslationParams) =>
      translate(settings.language, key, params),
    [settings.language],
  )

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      setTheme: (theme) => persist({ ...settings, theme }),
      setTextSize: (textSize) => persist({ ...settings, textSize }),
      setLanguage: (language) => persist({ ...settings, language }),
      setEquipment: (equipment) => persist({ ...settings, equipment }),
      toggleEquipment: (id) => {
        const has = settings.equipment.includes(id)
        const equipment = has
          ? settings.equipment.filter((item) => item !== id)
          : [...settings.equipment, id]
        persist({ ...settings, equipment })
      },
      t,
      locale: settings.language === 'cs' ? 'cs-CZ' : 'en-US',
    }),
    [persist, settings, t],
  )

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}

export function useTranslation() {
  const { t, locale, settings } = useSettings()
  return { t, locale, language: settings.language }
}

export { DEFAULT_SETTINGS, resolveTheme }
