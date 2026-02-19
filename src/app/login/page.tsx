import { Suspense } from 'react'
import CompasLogo from '@/components/CompasLogo'
import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Suspense fallback={
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl">
          <div className="flex justify-center mb-2">
            <CompasLogo width={140} height={140} />
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Tizimga kirish
          </h1>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </div>
  )
}
