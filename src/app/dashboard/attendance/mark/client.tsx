'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Button,
  Select,
  DatePicker,
  Card,
  Tag,
  message,
  Spin,
  Empty,
  Input,
  Alert,
} from 'antd'
import {
  ArrowLeftOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Option } = Select

interface Student {
  id: string
  firstName: string
  lastName: string
  phone: string
  attendance: {
    id: string
    status: 'PRESENT' | 'ABSENT'
    notes?: string
  } | null
}

interface Group {
  id: string
  name: string
  teacher: { id: string; firstName: string; lastName: string }
  course: { id: string; name: string }
}

interface GroupOption {
  id: string
  name: string
  teacher: { firstName: string; lastName: string }
  course: { name: string }
}

// Status configuration
const statusConfig = {
  PRESENT: { icon: <CheckCircleOutlined />, label: 'Keldi', color: 'bg-green-500', textColor: 'text-green-500', bgLight: 'bg-green-50', border: 'border-green-500' },
  ABSENT: { icon: <CloseCircleOutlined />, label: 'Kelmadi', color: 'bg-red-500', textColor: 'text-red-500', bgLight: 'bg-red-50', border: 'border-red-500' },
}

export default function AttendanceMarkContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialGroupId = searchParams.get('groupId') || ''
  const initialDate = searchParams.get('date') || dayjs().format('YYYY-MM-DD')

  const [groups, setGroups] = useState<GroupOption[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>(initialGroupId)
  const [selectedDate, setSelectedDate] = useState<dayjs.Dayjs>(dayjs(initialDate))
  const [group, setGroup] = useState<Group | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [attendances, setAttendances] = useState<Record<string, { status: string; notes: string }>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasExistingAttendance, setHasExistingAttendance] = useState(false)
  const [expandedNote, setExpandedNote] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('')
  const [canMarkAttendance, setCanMarkAttendance] = useState(true)

  // Fetch groups (TEACHER faqat o'z guruhlarini ko'radi)
  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) { router.push('/login'); return }

      // User ma'lumotlarini olish
      const userData = localStorage.getItem('user')
      const user = userData ? JSON.parse(userData) : null
      setUserRole(user?.role || '')

      // ADMIN davomat belgilay olmaydi
      if (user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'ACCOUNTANT') {
        setCanMarkAttendance(false)
        return
      }

      // TEACHER uchun faqat o'z guruhlarini olish
      let url = '/api/groups?status=ACTIVE&limit=100'
      if (user?.role === 'TEACHER' && user?.teacherId) {
        url += `&teacherId=${user.teacherId}`
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups)
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  // Fetch group students
  const fetchGroupStudents = async () => {
    if (!selectedGroupId || !selectedDate) return

    setLoading(true)
    try {
      const token = localStorage.getItem('token')

      const response = await fetch(`/api/attendance/group/${selectedGroupId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: selectedDate.format('YYYY-MM-DD') }),
      })

      if (!response.ok) {
        const data = await response.json()
        message.error(data.error || 'Xatolik yuz berdi')
        return
      }

      const data = await response.json()
      setGroup(data.group)
      setStudents(data.students)
      setHasExistingAttendance(data.hasExistingAttendance)

      const existingAttendances: Record<string, { status: string; notes: string }> = {}
      data.students.forEach((student: Student) => {
        if (student.attendance) {
          existingAttendances[student.id] = { status: student.attendance.status, notes: student.attendance.notes || '' }
        } else {
          existingAttendances[student.id] = { status: 'PRESENT', notes: '' }
        }
      })
      setAttendances(existingAttendances)
    } catch (error) {
      message.error('Talabalarni yuklashda xatolik')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGroups() }, [])
  useEffect(() => { if (selectedGroupId && selectedDate) fetchGroupStudents() }, [selectedGroupId, selectedDate])

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendances((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }))
  }

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendances((prev) => ({ ...prev, [studentId]: { ...prev[studentId], notes } }))
  }

  const setAllStatus = (status: string) => {
    const newAttendances: Record<string, { status: string; notes: string }> = {}
    students.forEach((student) => {
      newAttendances[student.id] = { status, notes: attendances[student.id]?.notes || '' }
    })
    setAttendances(newAttendances)
  }

  const handleSave = async () => {
    if (!selectedGroupId || !selectedDate) { message.error('Guruh va sanani tanlang'); return }
    if (students.length === 0) { message.error('Talabalar topilmadi'); return }

    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const attendanceData = Object.entries(attendances).map(([studentId, data]) => ({
        studentId, status: data.status, notes: data.notes || null,
      }))

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ groupId: selectedGroupId, date: selectedDate.format('YYYY-MM-DD'), attendances: attendanceData }),
      })

      const data = await response.json()
      if (!response.ok) { message.error(data.error || 'Xatolik yuz berdi'); return }

      message.success('Davomat muvaffaqiyatli saqlandi')
      setHasExistingAttendance(true)
    } catch (error) {
      message.error('Davomatni saqlashda xatolik')
    } finally {
      setSaving(false)
    }
  }

  // Stats
  const presentCount = Object.values(attendances).filter((a) => a.status === 'PRESENT').length
  const absentCount = Object.values(attendances).filter((a) => a.status === 'ABSENT').length

  return (
    <DashboardLayout>
      {/* Back button */}
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push('/dashboard/attendance')}
        className="mb-4 h-10 touch-manipulation"
      >
        Orqaga
      </Button>

      {/* Permission warning for ADMIN users */}
      {!canMarkAttendance && (
        <Alert
          message="Ruxsat yo'q"
          description="Davomat belgilash faqat Super Admin va O'qituvchilar uchun ruxsat berilgan. Sizning rolingiz (Admin/Menejer/Buxgalter) davomat belgilash imkoniyatiga ega emas."
          type="error"
          showIcon
          className="mb-4"
        />
      )}

      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Davomat belgilash</h2>
        <p className="text-xs md:text-sm text-gray-600">
          {selectedDate.format('DD.MM.YYYY')} - {group?.name || 'Guruh tanlang'}
        </p>
      </div>

      {/* Group and Date Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <TeamOutlined className="mr-1" /> Guruh
          </label>
          <Select
            placeholder="Guruh tanlang"
            size="large"
            style={{ width: '100%', height: 48 }}
            value={selectedGroupId || undefined}
            onChange={(value) => setSelectedGroupId(value)}
            showSearch
            optionFilterProp="children"
          >
            {groups.map((g) => (
              <Option key={g.id} value={g.id}>{g.name} - {g.teacher.lastName}</Option>
            ))}
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <CalendarOutlined className="mr-1" /> Sana
          </label>
          <DatePicker
            size="large"
            style={{ width: '100%', height: 48 }}
            format="DD.MM.YYYY"
            value={selectedDate}
            onChange={(date) => setSelectedDate(date || dayjs())}
            disabledDate={(current) => current && current > dayjs().endOf('day')}
            inputReadOnly
          />
        </div>
        <div className="flex items-end">
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!canMarkAttendance || !selectedGroupId || students.length === 0}
            className="w-full h-12 text-base touch-manipulation"
          >
            Saqlash
          </Button>
        </div>
      </div>

      {/* Warning */}
      {hasExistingAttendance && (
        <Alert
          message="Davomat mavjud - saqlash yangilaydi"
          type="warning"
          showIcon
          className="mb-4"
        />
      )}

      {/* Quick Actions */}
      {students.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            size="large"
            onClick={() => setAllStatus('PRESENT')}
            className="h-11 touch-manipulation"
            icon={<CheckCircleOutlined className="text-green-500" />}
          >
            Hammasi keldi
          </Button>
          <Button
            size="large"
            onClick={() => setAllStatus('ABSENT')}
            className="h-11 touch-manipulation"
            icon={<CloseCircleOutlined className="text-red-500" />}
          >
            Hammasi kelmadi
          </Button>
        </div>
      )}

      {/* Stats */}
      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
            <div className="text-green-600 font-bold text-xl">{presentCount}</div>
            <div className="text-green-600 text-xs font-medium">Keldi</div>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
            <div className="text-red-600 font-bold text-xl">{absentCount}</div>
            <div className="text-red-600 text-xs font-medium">Kelmadi</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center border border-gray-200">
            <div className="text-gray-600 font-bold text-xl">{students.length}</div>
            <div className="text-gray-600 text-xs font-medium">Jami</div>
          </div>
        </div>
      )}

      {/* Students List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : selectedGroupId ? (
        students.length > 0 ? (
          <div className="space-y-3">
            {students.map((student, index) => {
              const currentStatus = attendances[student.id]?.status || 'PRESENT'
              const config = statusConfig[currentStatus as keyof typeof statusConfig]

              return (
                <Card
                  key={student.id}
                  className={`shadow-sm transition-all ${config.bgLight} border-l-4 ${config.border}`}
                  styles={{ body: { padding: '12px' } }}
                >
                  {/* Student info */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full ${config.color} text-white flex items-center justify-center text-sm font-bold`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {student.lastName} {student.firstName}
                      </div>
                      <div className="text-xs text-gray-500">{student.phone}</div>
                    </div>
                    <div className={`${config.textColor} font-medium text-sm flex items-center gap-1`}>
                      {config.icon} {config.label}
                    </div>
                  </div>

                  {/* Status buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(statusConfig).map(([status, cfg]) => (
                      <button
                        key={status}
                        onClick={() => handleStatusChange(student.id, status)}
                        className={`p-3 rounded-xl transition-all touch-manipulation flex items-center justify-center gap-2 ${
                          currentStatus === status
                            ? `${cfg.color} text-white shadow-md`
                            : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-300 active:bg-gray-50'
                        }`}
                        style={{ minHeight: 52 }}
                      >
                        <span className="text-lg">{cfg.icon}</span>
                        <span className="text-sm font-medium">{cfg.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Notes */}
                  <div className="mt-3">
                    <Input
                      placeholder="Izoh qo'shish..."
                      value={attendances[student.id]?.notes || ''}
                      onChange={(e) => handleNotesChange(student.id, e.target.value)}
                      className="h-10"
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Empty description="Bu guruhda talabalar topilmadi" className="py-12" />
        )
      ) : (
        <Empty description="Guruhni tanlang" className="py-12" />
      )}

      {/* Fixed Save Button at bottom on mobile */}
      {students.length > 0 && canMarkAttendance && (
        <div className="fixed bottom-16 md:bottom-0 left-0 right-0 p-3 bg-white border-t shadow-lg md:hidden z-40">
          <Button
            type="primary"
            size="large"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!selectedGroupId || students.length === 0}
            className="w-full h-12 text-base"
          >
            Davomatni saqlash ({presentCount} keldi, {absentCount} kelmadi)
          </Button>
        </div>
      )}

      {/* Spacer for fixed button */}
      {students.length > 0 && <div className="h-20 md:hidden" />}
    </DashboardLayout>
  )
}
