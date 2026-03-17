import { ThemeProvider } from '@/shared/context/ThemeContext'
import { AppRouter } from '@/routes'

export default function App() {
  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  )
}
