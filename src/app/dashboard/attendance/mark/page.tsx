import { Suspense } from 'react'
import { Spin } from 'antd'
import AttendanceMarkContent from './client'

export default function AttendanceMarkPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    }>
      <AttendanceMarkContent />
    </Suspense>
  )
}
