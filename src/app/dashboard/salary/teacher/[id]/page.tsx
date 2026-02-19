import { Suspense, use } from 'react'
import { Spin } from 'antd'
import TeacherSalaryContent from './client'

export default function TeacherSalaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    }>
      <TeacherSalaryContent teacherId={id} />
    </Suspense>
  )
}
