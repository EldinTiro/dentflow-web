import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggle: () => {}, setTheme: () => {} })

function getInitialTheme(): Theme {
  const saved = localStorage.getItem('theme') as Theme | null
  if (saved) return saved
  const hour = new Date().getHours()
  return hour >= 20 || hour < 6 ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  // Auto-switch at 20:00 if user hasn't explicitly overridden
  useEffect(() => {
    const tick = setInterval(() => {
      const hour = new Date().getHours()
      const shouldBeDark = hour >= 20 || hour < 6
      setTheme((current) => {
        const auto = shouldBeDark ? 'dark' : 'light'
        // Only switch if no explicit user preference stored beyond current auto value
        if (current === auto) return current
        const saved = localStorage.getItem('theme')
        // Respect explicit user toggle — don't override if same hour window
        if (saved && saved !== auto) return current
        return auto
      })
    }, 60_000)
    return () => clearInterval(tick)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark'), setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
