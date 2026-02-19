import { Suspense } from 'react'
import { Spin } from 'antd'
import PaymentsContent from './client'

export default function PaymentsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    }>
      <PaymentsContent />
    </Suspense>
  )
}
