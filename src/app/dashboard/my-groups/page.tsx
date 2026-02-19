'use client'

import { useState, useEffect } from 'react'
import { Card, Table, Tag, Spin, message, Empty, Badge } from 'antd'
import { TeamOutlined, UserOutlined, CalendarOutlined, ClockCircleOutlined } from '@ant-design/icons'
import DashboardLayout from '@/components/DashboardLayout'
import Link from 'next/link'

interface Group {
  id: string
  name: string
  course: {
    id: string
    name: string
  }
  status: string
  daysOfWeek: string[]
  startTime: string
  endTime: string
  roomNumber?: string
  _count?: {
    students: number
  }
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Dushanba',
  TUESDAY: 'Seshanba',
  WEDNESDAY: 'Chorshanba',
  THURSDAY: 'Payshanba',
  FRIDAY: 'Juma',
  SATURDAY: 'Shanba',
  SUNDAY: 'Yakshanba',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'green',
  COMPLETED: 'blue',
  CANCELLED: 'red',
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Faol',
  COMPLETED: 'Tugagan',
  CANCELLED: 'Bekor qilingan',
}

export default function MyGroupsPage() {
  const [loading, setLoading] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [userRole, setUserRole] = useState<string>('')

  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role)
    }
    fetchMyGroups()
  }, [])

  const fetchMyGroups = async () => {
    try {
      const token = localStorage.getItem('token')
      const userData = localStorage.getItem('user')
      if (!userData) return

      const user = JSON.parse(userData)

      // Teacher uchun
      if (user.role === 'TEACHER' && user.teacherId) {
        const res = await fetch(`/api/groups?teacherId=${user.teacherId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (res.ok) {
          const data = await res.json()
          setGroups(data.groups || [])
        }
      }
      // Student uchun - guruhlarini olish
      else if (user.role === 'STUDENT' && user.studentId) {
        const res = await fetch(`/api/students/${user.studentId}/groups`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })

        if (res.ok) {
          const data = await res.json()
          // Transform to match groups format
          const studentGroups = (data.groups || []).map((g: any) => ({
            id: g.group.id,
            name: g.group.name,
            course: g.group.course,
            status: g.group.status,
            daysOfWeek: g.group.daysOfWeek || [],
            startTime: g.group.startTime,
            endTime: g.group.endTime,
            roomNumber: g.group.roomNumber,
            _count: { students: g.group._count?.students || 0 }
          }))
          setGroups(studentGroups)
        }
      }
    } catch (error) {
      console.error('Fetch groups error:', error)
      message.error('Guruhlarni yuklashda xatolik')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (time?: string) => {
    if (!time) return '-'
    return time.substring(0, 5)
  }

  const columns = [
    {
      title: 'Guruh nomi',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Group) => (
        <div>
          <Link
            href={`/dashboard/groups/${record.id}`}
            className="font-medium text-orange-600 hover:text-orange-700"
          >
            {text}
          </Link>
          <div className="text-xs text-gray-500">{record.course?.name}</div>
        </div>
      ),
    },
    {
      title: 'Holat',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] || 'default'}>
          {STATUS_LABELS[status] || status}
        </Tag>
      ),
    },
    {
      title: 'Dars kunlari',
      dataIndex: 'daysOfWeek',
      key: 'daysOfWeek',
      render: (days: string[]) => (
        <div className="flex flex-wrap gap-1">
          {days?.map((day) => (
            <Tag key={day} className="text-xs">
              {DAY_LABELS[day] || day}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: 'Vaqti',
      key: 'time',
      render: (_: any, record: Group) => (
        <span className="text-sm">
          {formatTime(record.startTime)} - {formatTime(record.endTime)}
        </span>
      ),
    },
    {
      title: 'Xona',
      dataIndex: 'roomNumber',
      key: 'roomNumber',
      render: (room: string) => room || '-',
    },
    {
      title: 'Talabalar',
      key: 'students',
      render: (_: any, record: Group) => (
        <Badge count={record._count?.students || 0} showZero color="orange" />
      ),
    },
  ]

  // Mobile card view
  const renderMobileCard = (group: Group) => (
    <Card key={group.id} className="mb-3 shadow-sm">
      <div className="flex justify-between items-start mb-3">
        <div>
          <Link
            href={`/dashboard/groups/${group.id}`}
            className="font-semibold text-lg text-orange-600"
          >
            {group.name}
          </Link>
          <div className="text-sm text-gray-500">{group.course?.name}</div>
        </div>
        <Tag color={STATUS_COLORS[group.status] || 'default'}>
          {STATUS_LABELS[group.status] || group.status}
        </Tag>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <CalendarOutlined className="text-gray-400" />
          <span>
            {group.daysOfWeek?.map(d => DAY_LABELS[d]).join(', ') || '-'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ClockCircleOutlined className="text-gray-400" />
          <span>{formatTime(group.startTime)} - {formatTime(group.endTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          <TeamOutlined className="text-gray-400" />
          <span>{group._count?.students || 0} ta talaba</span>
        </div>
        {group.roomNumber && (
          <div className="text-gray-500">
            Xona: {group.roomNumber}
          </div>
        )}
      </div>
    </Card>
  )

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Spin size="large" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">
            {userRole === 'TEACHER' ? 'Mening Guruhlarim' : 'Mening Guruhlarim'}
          </h1>
          <p className="text-gray-500 text-sm">
            {userRole === 'TEACHER'
              ? 'Siz dars berayotgan guruhlar ro\'yxati'
              : 'Siz a\'zo bo\'lgan guruhlar ro\'yxati'
            }
          </p>
        </div>

        {groups.length === 0 ? (
          <Card className="shadow-sm">
            <Empty
              description={
                userRole === 'TEACHER'
                  ? 'Sizga hali guruh biriktirilmagan'
                  : 'Siz hali hech qaysi guruhga qo\'shilmagansiz'
              }
            />
          </Card>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Card className="shadow-sm">
                <Table
                  dataSource={groups}
                  columns={columns}
                  rowKey="id"
                  pagination={false}
                />
              </Card>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden">
              {groups.map(renderMobileCard)}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
