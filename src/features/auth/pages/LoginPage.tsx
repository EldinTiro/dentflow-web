import { LoginForm } from '../components/LoginForm'
import logo from '@/assets/logo.png'

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <img src={logo} alt="PearlDesk" className="mb-8 h-40 w-auto" />
      <LoginForm />
    </div>
  )
}
