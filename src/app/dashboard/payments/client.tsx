'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import MobileModal from '@/components/MobileModal'
import {
  Button,
  Tag,
  Card,
  message,
  Form,
  Input,
  Select,
  InputNumber,
  Tabs,
  Spin,
  Empty,
  Skeleton,
  Pagination,
  Collapse,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  DollarOutlined,
  CalendarOutlined,
  WalletOutlined,
  WarningOutlined,
  PhoneOutlined,
  FilterOutlined,
  UserOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  CaretRightOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hasPermission } from '@/lib/permissions'

interface Payment {
  id: string
  amount: number
  paymentType: string
  method: string
  description?: string
  paymentDate: string
  student: {
    id: string
    firstName: string
    lastName: string
    phone: string
  }
  createdBy: {
    id: string
    name: string
  }
}

interface Stats {
  today: { amount: number; count: number }
  month: { amount: number; count: number }
  total: { amount: number; count: number }
  debt: { amount: number; count: number }
}

interface Debtor {
  id: string
  student: { id: string; firstName: string; lastName: string; phone: string }
  group: { id: string; name: string; course: { name: string } }
  monthlyFee: number
  paidAmount: number
  debtAmount: number
  lastPaymentDate: string | null
}

// Guruh bo'yicha guruhlangan qarzdorlar
interface GroupedDebtors {
  groupId: string
  groupName: string
  courseName: string
  debtors: Debtor[]
  totalDebt: number
  debtorsCount: number
}

interface Student {
  id: string
  firstName: string
  lastName: string
  phone: string
  groupStudents?: {
    id: string
    price?: number
    group: { id: string; name: string; price?: number; course: { name: string; price: number } }
  }[]
}

const paymentTypes = [
  { value: 'TUITION', label: "O'qish to'lovi", color: 'blue' },
  { value: 'REGISTRATION', label: "Ro'yxatga olish", color: 'green' },
  { value: 'EXAM', label: 'Imtihon', color: 'orange' },
  { value: 'MATERIAL', label: 'Material', color: 'purple' },
  { value: 'OTHER', label: 'Boshqa', color: 'default' },
]

const paymentMethods = [
  { value: 'CASH', label: 'Naqd' },
  { value: 'CARD', label: 'Karta' },
  { value: 'BANK_TRANSFER', label: "Bank o'tkazmasi" },
  { value: 'PAYME', label: 'Payme' },
  { value: 'CLICK', label: 'Click' },
  { value: 'UZUM', label: 'Uzum' },
]

const MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
]

const YEARS = [2024, 2025, 2026, 2027]

// Joriy oy va yil
const now = new Date()
const CURRENT_MONTH = MONTHS[now.getMonth()]
const CURRENT_YEAR = now.getFullYear()

export default function PaymentsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form] = Form.useForm()

  // URL'dan tab parametrini olish (qarzdorlar yoki payments)
  const tabFromUrl = searchParams.get('tab')
  const defaultTab = tabFromUrl === 'qarzdorlar' ? 'debtors' : 'payments'

  // States
  const [payments, setPayments] = useState<Payment[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [debtorsLoading, setDebtorsLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [studentSearchLoading, setStudentSearchLoading] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [lastPayment, setLastPayment] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('')

  const [activeTab, setActiveTab] = useState(defaultTab)
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 })
  const [search, setSearch] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  // Qarzdorlarni guruh bo'yicha guruhlash
  const groupedDebtors: GroupedDebtors[] = debtors.reduce((acc, debtor) => {
    const existingGroup = acc.find(g => g.groupId === debtor.group.id)
    if (existingGroup) {
      existingGroup.debtors.push(debtor)
      existingGroup.totalDebt += debtor.debtAmount
      existingGroup.debtorsCount += 1
    } else {
      acc.push({
        groupId: debtor.group.id,
        groupName: debtor.group.name,
        courseName: debtor.group.course.name,
        debtors: [debtor],
        totalDebt: debtor.debtAmount,
        debtorsCount: 1,
      })
    }
    return acc
  }, [] as GroupedDebtors[]).sort((a, b) => b.totalDebt - a.totalDebt)

  // User role olish
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role || '')
    }
  }, [])

  // Permission tekshirish - to'lov qabul qilish
  const canCreatePayment = hasPermission(userRole, 'payments', 'create')

  const getToken = () => localStorage.getItem('token')

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm"
  }

  // Fetch functions
  const fetchPayments = useCallback(async (page = 1) => {
    setLoading(true)
    try {
      const token = getToken()
      if (!token) { router.push('/login'); return }

      const params = new URLSearchParams({ page: page.toString(), limit: pagination.limit.toString() })
      if (search) params.append('search', search)

      const response = await fetch(`/api/payments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()
      setPayments(data.payments || [])
      setPagination(data.pagination || { page: 1, limit: 20, total: 0 })
    } catch (error) {
      message.error("To'lovlarni yuklashda xatolik")
    } finally {
      setLoading(false)
    }
  }, [router, pagination.limit, search])

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      const token = getToken()
      if (!token) return

      const response = await fetch('/api/payments/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('[Stats] Xatolik:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchDebtors = async () => {
    setDebtorsLoading(true)
    try {
      const token = getToken()
      if (!token) return

      const response = await fetch('/api/payments/debtors', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to fetch debtors')
      const data = await response.json()
      const fetchedDebtors = data.debtors || []
      setDebtors(fetchedDebtors)

      // Barcha guruhlarni ochiq holatda boshlash
      const uniqueGroupIds = [...new Set(fetchedDebtors.map((d: Debtor) => d.group.id))]
      setExpandedGroups(uniqueGroupIds as string[])
    } catch (error) {
      console.error('[Debtors] Xatolik:', error)
    } finally {
      setDebtorsLoading(false)
    }
  }

  const searchStudents = async (searchText: string) => {
    if (!searchText || searchText.length < 2) { setStudents([]); return }

    setStudentSearchLoading(true)
    try {
      const token = getToken()
      if (!token) return

      const response = await fetch(`/api/students?search=${encodeURIComponent(searchText)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!response.ok) throw new Error('Failed to search students')
      const data = await response.json()
      setStudents(data.students || [])
    } catch (error) {
      console.error('[Students] Xatolik:', error)
    } finally {
      setStudentSearchLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
    fetchStats()
  }, [])

  // URL parametri o'zgarganda activeTab'ni yangilash
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'qarzdorlar') {
      setActiveTab('debtors')
    }
  }, [searchParams])

  useEffect(() => {
    if (activeTab === 'debtors' && debtors.length === 0) fetchDebtors()
  }, [activeTab])

  const handleAddPayment = () => {
    form.resetFields()
    setSelectedStudent(null)
    setStudents([])
    setPaymentSuccess(false)
    setModalVisible(true)
  }

  const handleStudentSelect = (studentId: string) => {
    const student = students.find((s) => s.id === studentId)
    setSelectedStudent(student || null)

    if (student?.groupStudents && student.groupStudents.length > 0) {
      const firstGroup = student.groupStudents[0]
      const price = Number(firstGroup.price || firstGroup.group.price || firstGroup.group.course.price || 0)
      form.setFieldsValue({
        groupId: firstGroup.group.id,
        amount: price,
        forMonth: form.getFieldValue('forMonth') || CURRENT_MONTH,
        forYear: form.getFieldValue('forYear') || CURRENT_YEAR,
      })
    } else {
      form.setFieldsValue({
        forMonth: form.getFieldValue('forMonth') || CURRENT_MONTH,
        forYear: form.getFieldValue('forYear') || CURRENT_YEAR,
      })
    }
  }

  const handleSubmit = async (values: any) => {
    setModalLoading(true)
    try {
      const token = getToken()
      if (!token) { router.push('/login'); return }

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          studentId: values.studentId,
          amount: values.amount,
          paymentType: values.paymentType,
          method: values.method,
          description: values.description,
          groupId: values.groupId || null,
          forMonth: values.forMonth || null,
          forYear: values.forYear || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "To'lov qo'shishda xatolik")
      }

      // Guruh nomini topish
      const groupName = selectedStudent?.groupStudents?.find(
        (gs) => gs.group.id === values.groupId
      )?.group.name || ''

      // Show success screen
      setLastPayment({
        studentName: selectedStudent ? `${selectedStudent.lastName} ${selectedStudent.firstName}` : '',
        amount: values.amount,
        method: paymentMethods.find(m => m.value === values.method)?.label || values.method,
        groupName,
        forMonth: values.forMonth || '',
        forYear: values.forYear || '',
      })
      setPaymentSuccess(true)

      fetchPayments()
      fetchStats()
      if (activeTab === 'debtors') fetchDebtors()
    } catch (error) {
      message.error(error instanceof Error ? error.message : "To'lov qo'shishda xatolik")
    } finally {
      setModalLoading(false)
    }
  }

  const handlePayDebt = (debtor: Debtor) => {
    form.setFieldsValue({
      studentId: debtor.student.id,
      amount: debtor.debtAmount,
      paymentType: 'TUITION',
      method: 'CASH',
      groupId: debtor.group.id,
      forMonth: CURRENT_MONTH,
      forYear: CURRENT_YEAR,
    })
    setSelectedStudent({
      id: debtor.student.id,
      firstName: debtor.student.firstName,
      lastName: debtor.student.lastName,
      phone: debtor.student.phone,
      groupStudents: [{
        id: debtor.id,
        group: {
          id: debtor.group.id,
          name: debtor.group.name,
          course: { name: debtor.group.course.name, price: 0 },
        },
      }],
    })
    setPaymentSuccess(false)
    setModalVisible(true)
  }

  const closeModal = () => {
    setModalVisible(false)
    setPaymentSuccess(false)
    form.resetFields()
    setSelectedStudent(null)
  }

  // Stats cards
  const statsCards = [
    { title: 'Bugun', value: stats?.today.amount || 0, icon: <CalendarOutlined />, color: 'from-green-500 to-green-600' },
    { title: 'Bu oy', value: stats?.month.amount || 0, icon: <WalletOutlined />, color: 'from-blue-500 to-blue-600' },
    { title: 'Jami', value: stats?.total.amount || 0, icon: <DollarOutlined />, color: 'from-purple-500 to-purple-600' },
    { title: 'Qarzdorlik', value: stats?.debt.amount || 0, icon: <WarningOutlined />, color: 'from-red-500 to-red-600' },
  ]

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">To'lovlar</h2>
            <p className="text-xs md:text-sm text-gray-600">
              To'lovlarni boshqarish va qarzdorlar
            </p>
          </div>
          {canCreatePayment && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddPayment}
              size="large"
              className="w-full sm:w-auto h-12 md:h-11 text-base bg-green-600 hover:bg-green-700 touch-manipulation"
            >
              To'lov qabul qilish
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
        {statsCards.map((card, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${card.color} rounded-xl p-3 md:p-4 shadow-md`}
          >
            {statsLoading ? (
              <Skeleton.Input active size="small" block />
            ) : (
              <>
                <div className="text-white opacity-80 text-xs font-medium mb-1">{card.title}</div>
                <div className="text-white text-sm md:text-base font-bold flex items-center gap-1.5">
                  {card.icon}
                  <span>{formatPrice(card.value)}</span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Card className="shadow-sm" styles={{ body: { padding: '12px' } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'payments',
              label: "To'lovlar",
              children: (
                <>
                  {/* Search */}
                  <div className="mb-4">
                    <Input
                      placeholder="Talaba qidirish..."
                      prefix={<SearchOutlined className="text-gray-400" />}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onPressEnter={() => fetchPayments(1)}
                      allowClear
                      className="h-11"
                      style={{ fontSize: '16px' }}
                    />
                  </div>

                  {/* Payments List */}
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <Spin size="large" />
                    </div>
                  ) : payments.length === 0 ? (
                    <Empty description="To'lovlar topilmadi" className="py-8" />
                  ) : (
                    <>
                      <div className="space-y-3">
                        {payments.map((payment) => (
                          <Card
                            key={payment.id}
                            size="small"
                            className="shadow-sm"
                            styles={{ body: { padding: '12px' } }}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 text-sm truncate">
                                  {payment.student.lastName} {payment.student.firstName}
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <PhoneOutlined />
                                  {payment.student.phone}
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  <Tag color={paymentTypes.find(t => t.value === payment.paymentType)?.color || 'default'} className="text-xs">
                                    {paymentTypes.find(t => t.value === payment.paymentType)?.label || payment.paymentType}
                                  </Tag>
                                  <Tag className="text-xs">
                                    {paymentMethods.find(m => m.value === payment.method)?.label || payment.method}
                                  </Tag>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="font-bold text-green-600 text-base">
                                  {formatPrice(payment.amount)}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                  {dayjs(payment.paymentDate).format('DD.MM.YYYY')}
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>

                      {/* Pagination */}
                      {pagination.total > pagination.limit && (
                        <div className="flex justify-center mt-4">
                          <Pagination
                            current={pagination.page}
                            total={pagination.total}
                            pageSize={pagination.limit}
                            onChange={(page) => {
                              setPagination((prev) => ({ ...prev, page }))
                              fetchPayments(page)
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            showSizeChanger={false}
                            size="small"
                          />
                        </div>
                      )}
                    </>
                  )}
                </>
              ),
            },
            {
              key: 'debtors',
              label: (
                <span>
                  Qarzdorlar
                  {stats?.debt.count ? <Tag color="red" className="ml-1">{stats.debt.count}</Tag> : null}
                </span>
              ),
              children: debtorsLoading ? (
                <div className="flex justify-center py-12">
                  <Spin size="large" />
                </div>
              ) : debtors.length === 0 ? (
                <Empty description="Qarzdorlar yo'q" className="py-8" />
              ) : (
                <>
                  {/* Total debt banner */}
                  <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex justify-between items-center">
                      <span className="text-red-700 font-medium text-sm">
                        Jami: {formatPrice(debtors.reduce((s, d) => s + d.debtAmount, 0))}
                      </span>
                      <span className="text-red-600 text-xs">
                        {debtors.length} ta talaba, {groupedDebtors.length} ta guruh
                      </span>
                    </div>
                  </div>

                  {/* Expand/Collapse buttons */}
                  <div className="flex justify-end gap-2 mb-3">
                    <Button
                      type="link"
                      size="small"
                      onClick={() => setExpandedGroups(groupedDebtors.map(g => g.groupId))}
                    >
                      Hammasini ochish
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => setExpandedGroups([])}
                    >
                      Hammasini yopish
                    </Button>
                  </div>

                  {/* Grouped Debtors */}
                  <Collapse
                    activeKey={expandedGroups}
                    onChange={(keys) => setExpandedGroups(keys as string[])}
                    expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
                    className="bg-white"
                  >
                    {groupedDebtors.map((group) => (
                      <Collapse.Panel
                        key={group.groupId}
                        header={
                          <div className="flex flex-col xs:flex-row justify-between xs:items-center w-full gap-1 pr-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <TeamOutlined className="text-orange-500 shrink-0" />
                              <span className="font-medium truncate">{group.groupName}</span>
                              <Tag color="blue" className="text-xs shrink-0">{group.courseName}</Tag>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 pl-5 xs:pl-0">
                              <Tag color="red" className="text-xs">
                                {group.debtorsCount} ta
                              </Tag>
                              <span className="font-bold text-red-600 whitespace-nowrap">
                                {formatPrice(group.totalDebt)}
                              </span>
                            </div>
                          </div>
                        }
                        className="mb-2"
                      >
                        <div className="space-y-2">
                          {group.debtors
                            .sort((a, b) => b.debtAmount - a.debtAmount)
                            .map((debtor, index) => (
                            <div
                              key={debtor.id}
                              className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                            >
                              {/* Talaba ismi va telefon */}
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <span className="text-gray-400 font-mono text-xs pt-1 shrink-0">
                                  {index + 1}.
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium text-gray-900 text-sm truncate">
                                    {debtor.student.lastName} {debtor.student.firstName}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                    <PhoneOutlined className="text-[10px]" />
                                    {debtor.student.phone}
                                  </div>
                                </div>
                              </div>

                              {/* Summalar va tugma */}
                              <div className="flex items-center justify-between sm:justify-end gap-3 pl-6 sm:pl-0">
                                {/* Oylik va To'langan */}
                                <div className="flex flex-col gap-0.5 text-xs">
                                  <span className="text-gray-500">
                                    Oylik: {formatPrice(debtor.monthlyFee)}
                                  </span>
                                  <span className="text-green-600">
                                    To'langan: {formatPrice(debtor.paidAmount)}
                                  </span>
                                </div>

                                {/* Qarz summasi */}
                                <div className="text-right shrink-0">
                                  <div className="text-xs text-gray-500">Qarz</div>
                                  <div className="font-bold text-red-600 text-base whitespace-nowrap">
                                    {formatPrice(debtor.debtAmount)}
                                  </div>
                                </div>

                                {/* To'lash tugmasi */}
                                {canCreatePayment && (
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<DollarOutlined />}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handlePayDebt(debtor)
                                    }}
                                    className="h-9 touch-manipulation shrink-0"
                                  >
                                    To'lash
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                          {/* Group total */}
                          <div className="flex justify-between items-center pt-2 mt-2 border-t border-gray-200">
                            <span className="text-sm text-gray-600">Guruh bo'yicha jami:</span>
                            <span className="font-bold text-red-600">
                              {formatPrice(group.totalDebt)}
                            </span>
                          </div>
                        </div>
                      </Collapse.Panel>
                    ))}
                  </Collapse>
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* Payment Modal */}
      <MobileModal
        open={modalVisible}
        onClose={closeModal}
        title={paymentSuccess ? "Muvaffaqiyatli!" : "To'lov qabul qilish"}
        footer={
          paymentSuccess ? (
            <Button block type="primary" size="large" onClick={closeModal} className="h-12">
              Yopish
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button block size="large" onClick={closeModal} className="h-12">
                Bekor qilish
              </Button>
              <Button
                block
                type="primary"
                size="large"
                onClick={() => form.submit()}
                loading={modalLoading}
                className="h-12 bg-green-600 hover:bg-green-700"
              >
                To'lash
              </Button>
            </div>
          )
        }
      >
        {paymentSuccess ? (
          // Success Screen
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircleOutlined className="text-green-500 text-4xl" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">To'lov qabul qilindi!</h3>
            <p className="text-gray-600 mb-1">{lastPayment?.studentName}</p>
            {lastPayment?.groupName && (
              <p className="text-sm text-gray-500 mb-1">
                <TeamOutlined className="mr-1" />
                {lastPayment.groupName}
              </p>
            )}
            {(lastPayment?.forMonth || lastPayment?.forYear) && (
              <p className="text-sm text-blue-500 mb-4">
                <CalendarOutlined className="mr-1" />
                {lastPayment.forMonth} {lastPayment.forYear}
              </p>
            )}
            <div className="bg-green-50 rounded-xl p-4 inline-block">
              <div className="text-2xl font-bold text-green-600">{formatPrice(lastPayment?.amount || 0)}</div>
              <div className="text-sm text-gray-500">{lastPayment?.method}</div>
            </div>
          </div>
        ) : (
          // Payment Form
          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <Form.Item
              name="studentId"
              label="Talaba"
              rules={[{ required: true, message: 'Talabani tanlang' }]}
            >
              <Select
                showSearch
                placeholder="Talaba ismi yoki telefon..."
                filterOption={false}
                onSearch={searchStudents}
                onChange={handleStudentSelect}
                loading={studentSearchLoading}
                size="large"
                style={{ height: 48 }}
                notFoundContent={
                  studentSearchLoading ? <Spin size="small" /> : students.length === 0 ? 'Kamida 2 ta belgi kiriting' : null
                }
              >
                {students.map((student) => (
                  <Select.Option key={student.id} value={student.id}>
                    <div className="flex items-center gap-2">
                      <UserOutlined />
                      <span className="font-medium">{student.lastName} {student.firstName}</span>
                      <span className="text-gray-500">{student.phone}</span>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>

            {selectedStudent?.groupStudents && selectedStudent.groupStudents.length > 0 && (
              <Form.Item
                name="groupId"
                label="Guruh"
                rules={[{ required: true, message: 'Guruhni tanlang' }]}
              >
                <Select size="large" style={{ height: 48 }} placeholder="Guruhni tanlang">
                  {selectedStudent.groupStudents.map((gs) => (
                    <Select.Option key={gs.group.id} value={gs.group.id}>
                      {gs.group.name} — {gs.group.course.name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            )}

            <div className="flex gap-3">
              <Form.Item
                name="forMonth"
                label="Oy"
                className="flex-1"
                rules={[{ required: true, message: 'Oyni tanlang' }]}
                initialValue={CURRENT_MONTH}
              >
                <Select size="large" style={{ height: 48 }} placeholder="Oy">
                  {MONTHS.map((m) => (
                    <Select.Option key={m} value={m}>{m}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="forYear"
                label="Yil"
                className="flex-1"
                rules={[{ required: true, message: 'Yilni tanlang' }]}
                initialValue={CURRENT_YEAR}
              >
                <Select size="large" style={{ height: 48 }} placeholder="Yil">
                  {YEARS.map((y) => (
                    <Select.Option key={y} value={y}>{y}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <Form.Item
              name="amount"
              label="Summa"
              rules={[{ required: true, message: "Summani kiriting" }]}
            >
              <InputNumber
                className="w-full h-12"
                size="large"
                min={1000}
                step={10000}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                parser={(value) => value!.replace(/\s/g, '') as any}
                addonAfter="so'm"
                placeholder="100 000"
                inputMode="numeric"
                style={{ fontSize: '16px' }}
              />
            </Form.Item>

            <Form.Item
              name="paymentType"
              label="To'lov turi"
              rules={[{ required: true, message: "Turini tanlang" }]}
              initialValue="TUITION"
            >
              <Select size="large" style={{ height: 48 }}>
                {paymentTypes.map((t) => (
                  <Select.Option key={t.value} value={t.value}>{t.label}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="method"
              label="To'lov usuli"
              rules={[{ required: true, message: "Usulini tanlang" }]}
              initialValue="CASH"
            >
              <Select size="large" style={{ height: 48 }}>
                {paymentMethods.map((m) => (
                  <Select.Option key={m.value} value={m.value}>{m.label}</Select.Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="description" label="Izoh">
              <Input.TextArea rows={2} placeholder="Qo'shimcha izoh..." style={{ fontSize: '16px' }} />
            </Form.Item>
          </Form>
        )}
      </MobileModal>
    </DashboardLayout>
  )
}
