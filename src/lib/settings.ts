import type { GymEquipmentId } from './equipment'

export type ThemeMode = 'light' | 'dark' | 'system'
export type TextSize = 'small' | 'medium' | 'large'
export type AppLanguage = 'en' | 'cs'

export interface AppSettings {
  theme: ThemeMode
  textSize: TextSize
  language: AppLanguage
  equipment: GymEquipmentId[]
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  textSize: 'medium',
  language: 'en',
  equipment: ['bodyweight'],
}

const SETTINGS_KEY = 'gym-tracker-settings'
const LEGACY_THEME_KEY = 'theme'

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppSettings>
      return {
        theme: parsed.theme ?? DEFAULT_SETTINGS.theme,
        textSize: parsed.textSize ?? DEFAULT_SETTINGS.textSize,
        language: parsed.language ?? DEFAULT_SETTINGS.language,
        equipment: Array.isArray(parsed.equipment)
          ? (parsed.equipment as GymEquipmentId[])
          : DEFAULT_SETTINGS.equipment,
      }
    }
  } catch {
    // ignore corrupt storage
  }

  const legacyTheme = localStorage.getItem(LEGACY_THEME_KEY)
  if (legacyTheme === 'dark' || legacyTheme === 'light') {
    return {
      ...DEFAULT_SETTINGS,
      theme: legacyTheme,
    }
  }

  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  localStorage.setItem(LEGACY_THEME_KEY, resolveTheme(settings.theme))
}

export function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return theme
}

export function applySettings(settings: AppSettings): void {
  const resolved = resolveTheme(settings.theme)
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  document.documentElement.lang = settings.language
  document.documentElement.dataset.textSize = settings.textSize
}
