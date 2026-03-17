import { LoginForm } from '../components/LoginForm'
import { Gem } from 'lucide-react'

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-indigo-200">
          <Gem size={32} className="text-white" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">PearlDesk</h1>
          <p className="text-sm text-gray-400 mt-0.5">Dental Practice Management</p>
        </div>
      </div>
      <LoginForm />
    </div>
  )
}
