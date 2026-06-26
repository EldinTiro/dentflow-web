import { createContext, useContext, useEffect, useState } from 'react'

export type ColorTheme = 'indigo' | 'rose' | 'teal' | 'blue' | 'violet'
type DarkMode = 'light' | 'dark'

interface ThemeContextValue {
  theme: DarkMode
  toggle: () => void
  setTheme: (t: DarkMode) => void
  colorTheme: ColorTheme
  setColorTheme: (t: ColorTheme) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggle: () => {},
  setTheme: () => {},
  colorTheme: 'indigo',
  setColorTheme: () => {},
})

function getInitialDarkMode(): DarkMode {
  const saved = localStorage.getItem('theme') as DarkMode | null
  if (saved) return saved
  const hour = new Date().getHours()
  return hour >= 20 || hour < 6 ? 'dark' : 'light'
}

function getInitialColorTheme(): ColorTheme {
  return (localStorage.getItem('colorTheme') as ColorTheme | null) ?? 'indigo'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<DarkMode>(getInitialDarkMode)
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(getInitialColorTheme)

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  // Color theme — sets data-color-theme on <html>, "indigo" removes the attribute (default)
  useEffect(() => {
    if (colorTheme === 'indigo') {
      document.documentElement.removeAttribute('data-color-theme')
    } else {
      document.documentElement.setAttribute('data-color-theme', colorTheme)
    }
    localStorage.setItem('colorTheme', colorTheme)
  }, [colorTheme])

  // Auto dark/light switch at 20:00 / 06:00
  useEffect(() => {
    const tick = setInterval(() => {
      const hour = new Date().getHours()
      const shouldBeDark = hour >= 20 || hour < 6
      setThemeState((current) => {
        const auto = shouldBeDark ? 'dark' : 'light'
        if (current === auto) return current
        const saved = localStorage.getItem('theme')
        if (saved && saved !== auto) return current
        return auto
      })
    }, 60_000)
    return () => clearInterval(tick)
  }, [])

  function setTheme(t: DarkMode) { setThemeState(t) }
  function setColorTheme(t: ColorTheme) { setColorThemeState(t) }

  return (
    <ThemeContext.Provider value={{
      theme,
      toggle: () => setThemeState(t => t === 'dark' ? 'light' : 'dark'),
      setTheme,
      colorTheme,
      setColorTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
