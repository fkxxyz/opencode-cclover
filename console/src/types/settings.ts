export type ThemeMode = "light" | "dark" | "system"

export interface Settings {
  theme: ThemeMode
  language: string
  endpoint: string
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  language: "zh-CN",
  endpoint: "http://127.0.0.1:4099",
}
