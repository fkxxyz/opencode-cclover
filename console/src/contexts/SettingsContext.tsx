import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
} from "react"
import type { Settings, ThemeMode } from "../types/settings"
import { DEFAULT_SETTINGS } from "../types/settings"

const STORAGE_KEY = "cclover-console-settings"

interface SettingsContextValue {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
  toggleTheme: () => void
  resolvedTheme: "light" | "dark"
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined
)

function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
  } catch (error) {
    console.error("Failed to load settings:", error)
  }
  return DEFAULT_SETTINGS
}

function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error("Failed to save settings:", error)
  }
}

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(
    getSystemTheme
  )

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light")
    }
    mediaQuery.addEventListener("change", handler)
    return () => mediaQuery.removeEventListener("change", handler)
  }, [])

  // 计算实际使用的主题
  const resolvedTheme = useMemo(() => {
    if (settings.theme === "system") {
      return systemTheme
    }
    return settings.theme
  }, [settings.theme, systemTheme])

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings }
      saveSettings(updated)
      return updated
    })
  }

  const toggleTheme = () => {
    const newTheme: ThemeMode =
      settings.theme === "dark" || resolvedTheme === "dark" ? "light" : "dark"
    updateSettings({ theme: newTheme })
  }

  const value = {
    settings,
    updateSettings,
    toggleTheme,
    resolvedTheme,
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider")
  }
  return context
}
