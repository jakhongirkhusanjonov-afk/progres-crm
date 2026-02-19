'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Card,
  Button,
  DatePicker,
  Select,
  message,
  Spin,
} from 'antd'
import {
  FileExcelOutlined,
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import * as XLSX from 'xlsx'

const { RangePicker } = DatePicker

interface Group {
  id: string
  name: string
  course: { name: string }
}

export default function ReportsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(false)
  const [userRole, setUserRole] = useState<string>('')

  // Filterlar
  const [paymentsDateRange, setPaymentsDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [paymentsGroupId, setPaymentsGroupId] = useState<string>('')

  const [attendanceDateRange, setAttendanceDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  const [attendanceGroupId, setAttendanceGroupId] = useState<string>('')

  const [studentsGroupId, setStudentsGroupId] = useState<string>('')
  const [studentsStatus, setStudentsStatus] = useState<string>('')

  // Loading states
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [attendanceLoading, setAttendanceLoading] = useState(false)
  const [studentsLoading, setStudentsLoading] = useState(false)

  const getToken = () => localStorage.getItem('token')

  useEffect(() => {
    // Check user role
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role)

      // Faqat SUPER_ADMIN ko'rishi mumkin
      if (user.role !== 'SUPER_ADMIN') {
        message.error('Sizda bu sahifaga kirish huquqi yo\'q')
        router.push('/dashboard')
        return
      }
    }

    // Guruhlarni yuklash
    fetchGroups()
  }, [router])

  const fetchGroups = async () => {
    try {
      const token = getToken()
      if (!token) return

      const response = await fetch('/api/groups?limit=100', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      }
    } catch (error) {
      console.error('Error fetching groups:', error)
    }
  }

  // Excel yuklab olish funksiyasi
  const downloadExcel = async (
    endpoint: string,
    filename: string,
    setLoadingFn: (v: boolean) => void
  ) => {
    setLoadingFn(true)
    try {
      const token = getToken()
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (!response.ok) {
        throw new Error('Ma\'lumotlarni yuklashda xatolik')
      }

      const data = await response.json()

      if (!Array.isArray(data) || data.length === 0) {
        message.warning('Ma\'lumot topilmadi')
        return
      }

      // Excel yaratish
      const ws = XLSX.utils.json_to_sheet(data)

      // Ustun kengliklarini avtomatik sozlash
      const colWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(
          key.length,
          ...data.map(row => String(row[key] || '').length)
        ) + 2
      }))
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Hisobot')

      // Yuklab olish
      XLSX.writeFile(wb, filename)
      message.success('Hisobot yuklandi!')
    } catch (error) {
      console.error('Download error:', error)
      message.error('Hisobotni yuklashda xatolik')
    } finally {
      setLoadingFn(false)
    }
  }

  // To'lovlar hisobotini yuklab olish
  const downloadPaymentsReport = () => {
    const params = new URLSearchParams()
    if (paymentsDateRange[0]) params.append('from', paymentsDateRange[0].format('YYYY-MM-DD'))
    if (paymentsDateRange[1]) params.append('to', paymentsDateRange[1].format('YYYY-MM-DD'))
    if (paymentsGroupId) params.append('groupId', paymentsGroupId)

    const query = params.toString()
    const endpoint = `/api/reports/payments${query ? `?${query}` : ''}`
    const dateStr = dayjs().format('YYYY-MM-DD')
    downloadExcel(endpoint, `Tolovlar_${dateStr}.xlsx`, setPaymentsLoading)
  }

  // Davomat hisobotini yuklab olish
  const downloadAttendanceReport = () => {
    const params = new URLSearchParams()
    if (attendanceDateRange[0]) params.append('from', attendanceDateRange[0].format('YYYY-MM-DD'))
    if (attendanceDateRange[1]) params.append('to', attendanceDateRange[1].format('YYYY-MM-DD'))
    if (attendanceGroupId) params.append('groupId', attendanceGroupId)

    const query = params.toString()
    const endpoint = `/api/reports/attendance${query ? `?${query}` : ''}`
    const dateStr = dayjs().format('YYYY-MM-DD')
    downloadExcel(endpoint, `Davomat_${dateStr}.xlsx`, setAttendanceLoading)
  }

  // Talabalar ro'yxatini yuklab olish
  const downloadStudentsReport = () => {
    const params = new URLSearchParams()
    if (studentsGroupId) params.append('groupId', studentsGroupId)
    if (studentsStatus) params.append('status', studentsStatus)

    const query = params.toString()
    const endpoint = `/api/reports/students${query ? `?${query}` : ''}`
    const dateStr = dayjs().format('YYYY-MM-DD')
    downloadExcel(endpoint, `Talabalar_${dateStr}.xlsx`, setStudentsLoading)
  }

  if (userRole !== 'SUPER_ADMIN') {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Spin size="large" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileExcelOutlined className="text-green-600" />
          Hisobotlar
        </h2>
        <p className="text-xs md:text-sm text-gray-600">
          Excel formatida hisobotlarni yuklab oling
        </p>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* To'lovlar hisoboti */}
        <Card
          className="shadow-md hover:shadow-lg transition-shadow"
          styles={{ body: { padding: '20px' } }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <DollarOutlined className="text-2xl text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">To'lovlar hisoboti</h3>
              <p className="text-xs text-gray-500">Barcha to'lovlar ro'yxati</p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sana oralig'i</label>
              <RangePicker
                value={paymentsDateRange}
                onChange={(dates) => setPaymentsDateRange(dates as any)}
                className="w-full"
                placeholder={['Boshlanish', 'Tugash']}
                format="DD.MM.YYYY"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Guruh</label>
              <Select
                value={paymentsGroupId}
                onChange={setPaymentsGroupId}
                className="w-full"
                placeholder="Barcha guruhlar"
                allowClear
              >
                {groups.map(g => (
                  <Select.Option key={g.id} value={g.id}>
                    {g.name} - {g.course.name}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={downloadPaymentsReport}
            loading={paymentsLoading}
            className="w-full h-11 bg-green-600 hover:bg-green-700"
          >
            Excel yuklab olish
          </Button>
        </Card>

        {/* Davomat hisoboti */}
        <Card
          className="shadow-md hover:shadow-lg transition-shadow"
          styles={{ body: { padding: '20px' } }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <CalendarOutlined className="text-2xl text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Davomat hisoboti</h3>
              <p className="text-xs text-gray-500">Talabalar davomati</p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Sana oralig'i</label>
              <RangePicker
                value={attendanceDateRange}
                onChange={(dates) => setAttendanceDateRange(dates as any)}
                className="w-full"
                placeholder={['Boshlanish', 'Tugash']}
                format="DD.MM.YYYY"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Guruh</label>
              <Select
                value={attendanceGroupId}
                onChange={setAttendanceGroupId}
                className="w-full"
                placeholder="Barcha guruhlar"
                allowClear
              >
                {groups.map(g => (
                  <Select.Option key={g.id} value={g.id}>
                    {g.name} - {g.course.name}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={downloadAttendanceReport}
            loading={attendanceLoading}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700"
          >
            Excel yuklab olish
          </Button>
        </Card>

        {/* Talabalar ro'yxati */}
        <Card
          className="shadow-md hover:shadow-lg transition-shadow"
          styles={{ body: { padding: '20px' } }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <UserOutlined className="text-2xl text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Talabalar ro'yxati</h3>
              <p className="text-xs text-gray-500">Barcha talabalar ma'lumoti</p>
            </div>
          </div>

          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Guruh</label>
              <Select
                value={studentsGroupId}
                onChange={setStudentsGroupId}
                className="w-full"
                placeholder="Barcha guruhlar"
                allowClear
              >
                {groups.map(g => (
                  <Select.Option key={g.id} value={g.id}>
                    {g.name} - {g.course.name}
                  </Select.Option>
                ))}
              </Select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Holat</label>
              <Select
                value={studentsStatus}
                onChange={setStudentsStatus}
                className="w-full"
                placeholder="Barcha holatlar"
                allowClear
              >
                <Select.Option value="ACTIVE">Faol</Select.Option>
                <Select.Option value="GRADUATED">Bitirgan</Select.Option>
                <Select.Option value="SUSPENDED">To'xtatilgan</Select.Option>
                <Select.Option value="DROPPED">Chiqib ketgan</Select.Option>
              </Select>
            </div>
          </div>

          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={downloadStudentsReport}
            loading={studentsLoading}
            className="w-full h-11 bg-purple-600 hover:bg-purple-700"
          >
            Excel yuklab olish
          </Button>
        </Card>
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="font-medium text-gray-700 mb-2">Ma'lumot</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Hisobotlar Excel (.xlsx) formatida yuklanadi</li>
          <li>• Filterlarni tanlash ixtiyoriy - bo'sh qoldirilsa barcha ma'lumotlar yuklanadi</li>
          <li>• Katta hajmdagi ma'lumotlar uchun yuklanish vaqti ko'proq bo'lishi mumkin</li>
        </ul>
      </div>
    </DashboardLayout>
  )
}
