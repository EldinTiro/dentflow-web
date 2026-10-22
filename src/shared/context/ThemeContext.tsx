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

/**
 * Before the signed-in user's preference loads: the last theme used on this device,
 * else the OS setting. There is no clock-based switch any more — it silently overrode
 * an explicit choice, so the app could be dark while the preference said Light (QA-021).
 */
function getInitialDarkMode(): DarkMode {
  const saved = localStorage.getItem('theme') as DarkMode | null
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
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

  // The setter state function is stable, so consumers can list it as an effect dependency.
  const setTheme = setThemeState
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
