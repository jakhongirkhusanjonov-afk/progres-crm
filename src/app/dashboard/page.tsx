'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Card,
  Row,
  Col,
  Spin,
  Empty,
  Tag,
  Skeleton,
} from 'antd'
import {
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  DollarOutlined,
  CalendarOutlined,
  PlusOutlined,
  RightOutlined,
  WalletOutlined,
  RiseOutlined,
  FallOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { hasPermission, isAdmin } from '@/lib/permissions'

interface DashboardData {
  stats: {
    thisMonthRevenue: number
    thisMonthExpense: number
    netProfit: number
    activeStudents: number
    activeGroups: number
    totalDebt: number
    totalTeachers: number
    totalCourses: number
    paymentsCount: number
  }
  paymentsChart: Array<{
    month: string
    label: string
    total: number
  }>
  groupsStats: Array<{
    name: string
    students: number
  }>
  recentActivity: {
    payments: Array<{
      id: string
      amount: number
      date: string
      studentName: string
      method: string
      type: string
    }>
    students: Array<{
      id: string
      firstName: string
      lastName: string
      phone: string
      status: string
      createdAt: string
    }>
    todayLessons: Array<{
      id: string
      name: string
      time: string
      teacher: string
      course: string
      studentsCount: number
    }>
  }
}

// Pie chart ranglari
const COLORS = ['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16']

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<string>('')

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      // Get user role from localStorage
      const userData = localStorage.getItem('user')
      if (userData) {
        const user = JSON.parse(userData)
        setUserRole(user.role || '')
      }

      const response = await fetch('/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Narxni formatlash
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm"
  }

  // Qisqa narx formati (K, M)
  const formatShortPrice = (price: number) => {
    if (price >= 1000000) {
      return (price / 1000000).toFixed(1) + 'M'
    } else if (price >= 1000) {
      return (price / 1000).toFixed(0) + 'K'
    }
    return price.toString()
  }

  // SUPER_ADMIN uchun barcha statistika kartalari
  const allStatsCards = [
    {
      title: 'Bu oylik daromad',
      value: data?.stats.thisMonthRevenue || 0,
      icon: <DollarOutlined />,
      color: 'from-orange-500 to-orange-600',
      format: 'price',
      superAdminOnly: true,
      link: '/dashboard/payments'
    },
    {
      title: 'Bu oylik xarajat',
      value: data?.stats.thisMonthExpense || 0,
      icon: <WalletOutlined />,
      color: 'from-red-500 to-red-600',
      format: 'price',
      superAdminOnly: true,
      link: '/dashboard/salary'
    },
    {
      title: 'Sof foyda',
      value: data?.stats.netProfit || 0,
      icon: (data?.stats.netProfit || 0) >= 0 ? <RiseOutlined /> : <FallOutlined />,
      color: (data?.stats.netProfit || 0) >= 0 ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600',
      format: 'price',
      superAdminOnly: true,
      link: '/dashboard/payments'
    },
    {
      title: 'Faol talabalar',
      value: data?.stats.activeStudents || 0,
      icon: <UserOutlined />,
      color: 'from-blue-500 to-blue-600',
      format: 'number',
      superAdminOnly: false,
      link: '/dashboard/students'
    },
    {
      title: 'Faol guruhlar',
      value: data?.stats.activeGroups || 0,
      icon: <TeamOutlined />,
      color: 'from-purple-500 to-purple-600',
      format: 'number',
      superAdminOnly: false,
      link: '/dashboard/groups'
    },
    {
      title: 'Qarzdorlik',
      value: data?.stats.totalDebt || 0,
      icon: <WarningOutlined />,
      color: (data?.stats.totalDebt || 0) > 0 ? 'from-amber-500 to-amber-600' : 'from-green-500 to-green-600',
      format: 'price',
      superAdminOnly: false,
      link: '/dashboard/payments?tab=qarzdorlar'
    },
  ]

  // Role ga qarab statistika kartalari
  const statsCards = userRole === 'SUPER_ADMIN'
    ? allStatsCards
    : allStatsCards.filter(card => !card.superAdminOnly)

  // Tezkor havolalar - role ga qarab filterlash
  const allQuickLinks = [
    {
      title: "Talaba qo'shish",
      description: "Yangi talaba",
      icon: <UserOutlined className="text-xl md:text-2xl" />,
      href: '/dashboard/students/new',
      color: 'bg-orange-50 hover:bg-orange-100 border-orange-200 active:bg-orange-200',
      permission: { resource: 'students' as const, action: 'create' as const }
    },
    {
      title: "Guruh yaratish",
      description: "Yangi guruh",
      icon: <TeamOutlined className="text-xl md:text-2xl" />,
      href: '/dashboard/groups',
      color: 'bg-blue-50 hover:bg-blue-100 border-blue-200 active:bg-blue-200',
      permission: { resource: 'groups' as const, action: 'create' as const }
    },
    {
      title: "Davomat",
      description: "Belgilash",
      icon: <CalendarOutlined className="text-xl md:text-2xl" />,
      href: '/dashboard/attendance/mark',
      color: 'bg-green-50 hover:bg-green-100 border-green-200 active:bg-green-200',
      permission: { resource: 'attendance' as const, action: 'create' as const }
    },
    {
      title: "To'lov",
      description: "Qabul qilish",
      icon: <CreditCardOutlined className="text-xl md:text-2xl" />,
      href: '/dashboard/payments',
      color: 'bg-purple-50 hover:bg-purple-100 border-purple-200 active:bg-purple-200',
      permission: { resource: 'payments' as const, action: 'create' as const }
    },
  ]

  // Role ga qarab tezkor havolalar - permission tekshirish
  const quickLinks = allQuickLinks.filter(link =>
    hasPermission(userRole, link.permission.resource, link.permission.action)
  )

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4 md:mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-xs md:text-sm text-gray-600">
          Bugungi sana: {dayjs().format('DD.MM.YYYY')}
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {/* Loading skeleton for mobile */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton.Button key={i} active block style={{ height: 80 }} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton.Button active block style={{ height: 250 }} />
            <Skeleton.Button active block style={{ height: 250 }} />
          </div>
        </div>
      ) : (
        <>
          {/* Statistika kartalari - ADMIN: 3 cards, SUPER_ADMIN: 6 cards */}
          <div className={`grid grid-cols-2 md:grid-cols-3 ${userRole === 'SUPER_ADMIN' ? 'lg:grid-cols-6' : 'lg:grid-cols-3'} gap-2 md:gap-3 mb-4 md:mb-6`}>
            {statsCards.map((card, index) => (
              <div
                key={index}
                onClick={() => card.link && router.push(card.link)}
                className={`bg-gradient-to-br ${card.color} rounded-xl p-3 md:p-4 shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer active:scale-[0.98] touch-manipulation`}
              >
                <div className="text-white opacity-80 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1 truncate">
                  {card.title}
                </div>
                <div className="text-white text-base md:text-lg font-bold flex items-center gap-1.5">
                  {card.icon}
                  <span>
                    {card.format === 'price'
                      ? formatShortPrice(card.value)
                      : card.value}
                  </span>
                </div>
                {card.format === 'price' && (
                  <div className="text-white opacity-70 text-[9px] md:text-xs mt-0.5 truncate">
                    {formatPrice(card.value)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Tezkor havolalar - role ga qarab */}
          {quickLinks.length > 0 && (
          <div className={`grid grid-cols-2 ${quickLinks.length >= 4 ? 'md:grid-cols-4' : `md:grid-cols-${Math.min(quickLinks.length, 3)}`} gap-2 md:gap-3 mb-4 md:mb-6`}>
            {quickLinks.map((link, index) => (
              <div
                key={index}
                onClick={() => router.push(link.href)}
                className={`${link.color} border rounded-xl p-3 md:p-4 cursor-pointer transition-all hover:shadow-md touch-manipulation`}
                style={{ minHeight: 70 }}
              >
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="text-orange-500">{link.icon}</div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 text-sm md:text-base truncate">
                      {link.title}
                    </div>
                    <div className="text-[10px] md:text-xs text-gray-500 truncate">
                      {link.description}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          {/* Grafiklar - Faqat SUPER_ADMIN uchun */}
          {userRole === 'SUPER_ADMIN' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 md:mb-6">
              {/* To'lovlar grafigi */}
              <Card
                title={
                  <div className="flex items-center gap-2 text-sm md:text-base">
                    <DollarOutlined className="text-orange-500" />
                    <span>Oxirgi 6 oy</span>
                  </div>
                }
                extra={
                  <Link href="/dashboard/payments" className="text-orange-500 text-xs md:text-sm">
                    Batafsil <RightOutlined />
                  </Link>
                }
                className="shadow-md"
                styles={{ body: { padding: '8px 12px' } }}
              >
                <div className="h-48 md:h-64">
                  {data?.paymentsChart && data.paymentsChart.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.paymentsChart} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 9 }}
                          tickFormatter={(value) => formatShortPrice(value)}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                        />
                        <Tooltip
                          formatter={(value: number) => [formatPrice(value), "To'lov"]}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '12px' }}
                        />
                        <Bar dataKey="total" fill="url(#colorGradient)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <defs>
                          <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f97316" />
                            <stop offset="100%" stopColor="#fb923c" />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <Empty description="Ma'lumot yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    </div>
                  )}
                </div>
              </Card>

              {/* Guruhlar statistikasi */}
              <Card
                title={
                  <div className="flex items-center gap-2 text-sm md:text-base">
                    <TeamOutlined className="text-blue-500" />
                    <span>Guruhlardagi talabalar</span>
                  </div>
                }
                extra={
                  <Link href="/dashboard/groups" className="text-blue-500 text-xs md:text-sm">
                    Batafsil <RightOutlined />
                  </Link>
                }
                className="shadow-md"
                styles={{ body: { padding: '8px 12px' } }}
              >
                <div className="h-48 md:h-64">
                  {data?.groupsStats && data.groupsStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data.groupsStats.slice(0, 6)}
                          cx="50%"
                          cy="50%"
                          innerRadius={30}
                          outerRadius={60}
                          paddingAngle={2}
                          dataKey="students"
                          nameKey="name"
                          label={({ name, value }) => `${String(name || '').slice(0, 8)}: ${value}`}
                          labelLine={false}
                        >
                          {data.groupsStats.slice(0, 6).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number, name: string) => [`${value} ta`, name]}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', fontSize: '12px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <Empty description="Guruhlar yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Oxirgi faoliyat - Role ga qarab ko'rsatish */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${userRole === 'SUPER_ADMIN' ? 'lg:grid-cols-3' : ''} gap-4`}>
            {/* Bugungi darslar */}
            <Card
              title={
                <div className="flex items-center gap-2 text-sm">
                  <ClockCircleOutlined className="text-green-500" />
                  <span>Bugungi darslar</span>
                </div>
              }
              extra={<Tag color="orange">{data?.recentActivity.todayLessons.length || 0}</Tag>}
              className="shadow-md"
              styles={{ body: { padding: '8px 12px', maxHeight: 260, overflow: 'auto' } }}
            >
              {data?.recentActivity.todayLessons && data.recentActivity.todayLessons.length > 0 ? (
                <div className="space-y-2">
                  {data.recentActivity.todayLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className={`p-2.5 bg-gradient-to-r from-green-50 to-white rounded-lg border border-green-100 ${
                        userRole === 'SUPER_ADMIN' ? 'active:bg-green-100 cursor-pointer' : ''
                      } touch-manipulation`}
                      onClick={() => {
                        // ADMIN uchun davomat sahifasiga o'tish yo'q
                        if (userRole === 'SUPER_ADMIN') {
                          router.push(`/dashboard/attendance/mark?groupId=${lesson.id}`)
                        } else {
                          router.push(`/dashboard/groups`)
                        }
                      }}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 text-sm truncate">{lesson.name}</div>
                          <div className="text-xs text-gray-500 truncate">{lesson.course}</div>
                        </div>
                        <Tag color="green" className="text-xs shrink-0">{lesson.time}</Tag>
                      </div>
                      <div className="flex justify-between items-center mt-1.5 text-xs text-gray-500">
                        <span className="truncate">{lesson.teacher}</span>
                        <span className="shrink-0">{lesson.studentsCount} ta</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="Bugun dars yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} className="py-6" />
              )}
            </Card>

            {/* Oxirgi to'lovlar - Faqat SUPER_ADMIN uchun */}
            {userRole === 'SUPER_ADMIN' && (
              <Card
                title={
                  <div className="flex items-center gap-2 text-sm">
                    <DollarOutlined className="text-orange-500" />
                    <span>Oxirgi to'lovlar</span>
                  </div>
                }
                extra={
                  <Link href="/dashboard/payments" className="text-orange-500 text-xs">
                    Hammasi <RightOutlined />
                  </Link>
                }
                className="shadow-md"
                styles={{ body: { padding: '8px 12px', maxHeight: 260, overflow: 'auto' } }}
              >
                {data?.recentActivity.payments && data.recentActivity.payments.length > 0 ? (
                  <div className="space-y-2">
                    {data.recentActivity.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="p-2.5 bg-gradient-to-r from-orange-50 to-white rounded-lg border border-orange-100"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 text-sm truncate">{payment.studentName}</div>
                            <div className="text-xs text-gray-500">{dayjs(payment.date).format('DD.MM.YYYY')}</div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold text-orange-600 text-sm">{formatPrice(payment.amount)}</div>
                            <Tag color="blue" className="text-xs mt-0.5">{payment.method}</Tag>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty description="To'lovlar yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} className="py-6" />
                )}
              </Card>
            )}

            {/* Yangi talabalar */}
            <Card
              title={
                <div className="flex items-center gap-2 text-sm">
                  <UserOutlined className="text-blue-500" />
                  <span>Yangi talabalar</span>
                </div>
              }
              extra={
                <Link href="/dashboard/students" className="text-blue-500 text-xs">
                  Hammasi <RightOutlined />
                </Link>
              }
              className="shadow-md"
              styles={{ body: { padding: '8px 12px', maxHeight: 260, overflow: 'auto' } }}
            >
              {data?.recentActivity.students && data.recentActivity.students.length > 0 ? (
                <div className="space-y-2">
                  {data.recentActivity.students.map((student) => (
                    <div
                      key={student.id}
                      className="p-2.5 bg-gradient-to-r from-blue-50 to-white rounded-lg border border-blue-100 active:bg-blue-100 cursor-pointer touch-manipulation"
                      onClick={() => router.push(`/dashboard/students/${student.id}`)}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{student.phone}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <Tag color={student.status === 'ACTIVE' ? 'green' : 'default'} className="text-xs">
                            {student.status === 'ACTIVE' ? 'Faol' : student.status}
                          </Tag>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {dayjs(student.createdAt).format('DD.MM')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty description="Talabalar yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} className="py-6" />
              )}
            </Card>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
