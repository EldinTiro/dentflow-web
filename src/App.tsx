import { Toaster } from 'sonner'
import { ThemeProvider } from '@/shared/context/ThemeContext'
import { AppRouter } from '@/routes'

export default function App() {
  return (
    <ThemeProvider>
      <AppRouter />
      <Toaster position="top-right" richColors closeButton />
    </ThemeProvider>
  )
}
