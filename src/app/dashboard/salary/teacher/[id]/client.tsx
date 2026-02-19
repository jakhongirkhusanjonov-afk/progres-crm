'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { logout } from '@/lib/auth-client'
import {
  Button,
  Card,
  Tag,
  Table,
  message,
  Row,
  Col,
  Statistic,
  Select,
  Empty,
  Spin,
  Divider,
  Collapse,
  Modal,
  Form,
  InputNumber,
  Input,
  DatePicker,
  Space,
  Popconfirm,
} from 'antd'
import CompasLogo from '@/components/CompasLogo'
import {
  ArrowLeftOutlined,
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WalletOutlined,
  BookOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'

const { Option } = Select
const { Panel } = Collapse

interface GroupDetail {
  group: {
    id: string
    name: string
    course: {
      id: string
      name: string
    }
    scheduleDays: string
  }
  students: {
    id: string
    name: string
    phone: string
    price: number
    discountReason?: string
  }[]
  studentCount: number
  groupPrice: number
  totalStudentPayments: number
  teacherPercentage: number
  lessons: {
    date: string
    present: number
    absent: number
    total: number
  }[]
  lessonsCount: number
  expectedLessons: number
  attendanceCoefficient: number
  teacherShare: number
  monthlySalary: number
}

interface SalaryPayment {
  id: string
  amount: number
  paymentDate: string
  method: string
  notes?: string
}

interface TeacherSalaryData {
  teacher: {
    id: string
    firstName: string
    lastName: string
    middleName?: string
    phone: string
    status: string
  }
  period: string
  periodDisplay: string
  groupDetails: GroupDetail[]
  summary: {
    groupsCount: number
    totalStudents: number
    totalStudentPayments: number
    totalTeacherShare: number
    totalLessons: number
    totalSalary: number
    paidAmount: number
    debt: number
    isPaid: boolean
  }
  payments: SalaryPayment[]
}

export default function TeacherSalaryContent({ teacherId }: { teacherId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [form] = Form.useForm()

  const initialMonth = searchParams.get('month') || dayjs().format('YYYY-MM')

  // State
  const [salaryData, setSalaryData] = useState<TeacherSalaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth)
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [paying, setPaying] = useState(false)

  // Maosh ma'lumotlarini yuklash
  const fetchSalaryData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/salary/teacher/${teacherId}?month=${selectedMonth}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          message.error("O'qituvchi topilmadi")
          router.push('/dashboard/salary')
          return
        }
        throw new Error('Failed to fetch')
      }

      const data = await response.json()
      setSalaryData(data)
    } catch (error) {
      message.error("Ma'lumotlarni yuklashda xatolik")
      console.error('Error fetching salary data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSalaryData()
  }, [teacherId, selectedMonth])

  // Maosh to'lash modalni ochish
  const showPayModal = () => {
    if (!salaryData) return
    form.setFieldsValue({
      amount: salaryData.summary.debt,
      paymentDate: dayjs(),
      method: 'CASH',
      notes: '',
    })
    setIsPayModalOpen(true)
  }

  // Maosh to'lash
  const handlePay = async (values: any) => {
    if (!salaryData) return

    setPaying(true)
    try {
      const token = localStorage.getItem('token')

      const response = await fetch('/api/salary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teacherId: salaryData.teacher.id,
          amount: values.amount,
          paymentDate: values.paymentDate.toISOString(),
          period: selectedMonth,
          method: values.method,
          notes: values.notes || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        message.error(data.error || 'Xatolik yuz berdi')
        return
      }

      message.success("Maosh to'lovi muvaffaqiyatli saqlandi")
      setIsPayModalOpen(false)
      form.resetFields()
      fetchSalaryData()
    } catch (error) {
      message.error('Xatolik yuz berdi')
    } finally {
      setPaying(false)
    }
  }

  // To'lovni o'chirish
  const handleDeletePayment = async (paymentId: string) => {
    try {
      const token = localStorage.getItem('token')

      const response = await fetch(`/api/salary/${paymentId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to delete')
      }

      message.success("To'lov o'chirildi")
      fetchSalaryData()
    } catch (error) {
      message.error("To'lovni o'chirishda xatolik")
    }
  }

  // Chiqish
  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  // Narxni formatlash
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(price) + " so'm"
  }

  // Oylar ro'yxati
  const getMonthOptions = () => {
    const months = []
    for (let i = 0; i < 12; i++) {
      const month = dayjs().subtract(i, 'month')
      months.push({
        value: month.format('YYYY-MM'),
        label: month.format('MMMM YYYY'),
      })
    }
    return months
  }

  // To'lov usuli
  const getMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      CASH: 'Naqd',
      CARD: 'Karta',
      BANK_TRANSFER: "Bank o'tkazmasi",
      PAYME: 'Payme',
      CLICK: 'Click',
      UZUM: 'Uzum',
    }
    return methods[method] || method
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  // Ma'lumot topilmadi
  if (!salaryData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Empty description="Ma'lumot topilmadi" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => router.push('/dashboard')}
              >
                <CompasLogo width={40} height={40} />
              </div>
              <nav className="hidden md:flex gap-4">
                <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </a>
                <a href="/dashboard/teachers" className="text-gray-600 hover:text-gray-900">
                  O'qituvchilar
                </a>
                <a href="/dashboard/salary" className="text-indigo-600 font-medium">
                  Maosh
                </a>
              </nav>
            </div>
            <Button danger onClick={handleLogout}>
              Chiqish
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/dashboard/salary')}
          className="mb-4"
        >
          Orqaga
        </Button>

        {/* O'qituvchi sarlavhasi */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-4 rounded-full">
                <UserOutlined className="text-2xl text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {salaryData.teacher.lastName} {salaryData.teacher.firstName}
                </h2>
                <p className="text-gray-500">{salaryData.teacher.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Select
                value={selectedMonth}
                onChange={setSelectedMonth}
                style={{ width: 180 }}
                size="large"
              >
                {getMonthOptions().map((month) => (
                  <Option key={month.value} value={month.value}>
                    {month.label}
                  </Option>
                ))}
              </Select>
              {salaryData.summary.debt > 0 && (
                <Button
                  type="primary"
                  icon={<WalletOutlined />}
                  size="large"
                  onClick={showPayModal}
                >
                  Maosh to'lash
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Statistika */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="Guruhlar"
                value={salaryData.summary.groupsCount}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="Talabalar"
                value={salaryData.summary.totalStudents}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="Darslar"
                value={salaryData.summary.totalLessons}
                prefix={<CalendarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="Jami to'lovlar"
                value={salaryData.summary.totalStudentPayments}
                formatter={(val) => formatPrice(Number(val))}
                valueStyle={{ fontSize: '16px' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small">
              <Statistic
                title="O'qituvchi ulushi"
                value={salaryData.summary.totalTeacherShare}
                formatter={(val) => formatPrice(Number(val))}
                valueStyle={{ fontSize: '16px', color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8} md={4}>
            <Card size="small" className={salaryData.summary.debt > 0 ? 'bg-red-50' : 'bg-green-50'}>
              <Statistic
                title="Qarz"
                value={salaryData.summary.debt}
                formatter={(val) => formatPrice(Number(val))}
                valueStyle={{
                  fontSize: '16px',
                  color: salaryData.summary.debt > 0 ? '#ff4d4f' : '#52c41a',
                }}
              />
            </Card>
          </Col>
        </Row>

        {/* Oylik maosh */}
        <Card className="mb-6">
          <div className="text-center py-4">
            <div className="text-gray-500 text-lg mb-2">
              {salaryData.periodDisplay} uchun hisoblangan maosh
            </div>
            <div className="text-4xl font-bold text-indigo-600">
              {formatPrice(salaryData.summary.totalSalary)}
            </div>
            <div className="mt-2">
              {salaryData.summary.isPaid ? (
                <Tag color="green" icon={<CheckCircleOutlined />} className="text-lg px-4 py-1">
                  To'liq to'langan
                </Tag>
              ) : salaryData.summary.paidAmount > 0 ? (
                <Tag color="orange" icon={<ExclamationCircleOutlined />} className="text-lg px-4 py-1">
                  Qisman to'langan: {formatPrice(salaryData.summary.paidAmount)}
                </Tag>
              ) : (
                <Tag color="red" icon={<ExclamationCircleOutlined />} className="text-lg px-4 py-1">
                  To'lanmagan
                </Tag>
              )}
            </div>
          </div>
        </Card>

        {/* Guruhlar bo'yicha breakdown */}
        <Card title={<span><BookOutlined className="mr-2" />Guruhlar bo'yicha hisob-kitob</span>} className="mb-6">
          <Collapse accordion>
            {salaryData.groupDetails.map((group, index) => (
              <Panel
                key={group.group.id}
                header={
                  <div className="flex justify-between items-center w-full pr-4">
                    <div>
                      <span className="font-medium">{group.group.name}</span>
                      <span className="text-gray-500 ml-2">({group.group.course.name})</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <Tag color="blue">{group.studentCount} ta talaba</Tag>
                      <Tag color="purple">{group.teacherPercentage}%</Tag>
                      <span className="font-medium text-green-600">
                        {formatPrice(group.monthlySalary)}
                      </span>
                    </div>
                  </div>
                }
              >
                <Row gutter={[16, 16]}>
                  {/* Hisob-kitob */}
                  <Col xs={24} md={12}>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium mb-3">Maosh hisob-kitobi</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Guruh narxi:</span>
                          <span>{formatPrice(group.groupPrice)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Talabalar soni:</span>
                          <span>{group.studentCount} ta</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Jami to'lovlar:</span>
                          <span>{formatPrice(group.totalStudentPayments)}</span>
                        </div>
                        <Divider className="my-2" />
                        <div className="flex justify-between">
                          <span className="text-gray-500">O'qituvchi foizi:</span>
                          <span>{group.teacherPercentage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">O'qituvchi ulushi:</span>
                          <span className="font-medium">{formatPrice(group.teacherShare)}</span>
                        </div>
                        <Divider className="my-2" />
                        <div className="flex justify-between">
                          <span className="text-gray-500">O'tilgan darslar:</span>
                          <span>{group.lessonsCount} / {group.expectedLessons}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Davomat koeff:</span>
                          <span>{group.attendanceCoefficient}</span>
                        </div>
                        <Divider className="my-2" />
                        <div className="flex justify-between text-lg font-medium">
                          <span>Oylik maosh:</span>
                          <span className="text-green-600">{formatPrice(group.monthlySalary)}</span>
                        </div>
                      </div>
                    </div>
                  </Col>

                  {/* Talabalar */}
                  <Col xs={24} md={12}>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium mb-3">Talabalar ({group.studentCount})</h4>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500">
                              <th className="text-left py-1">Ism</th>
                              <th className="text-right py-1">Narx</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.students.map((student) => (
                              <tr key={student.id} className="border-t">
                                <td className="py-1">{student.name}</td>
                                <td className="text-right">
                                  {formatPrice(student.price)}
                                  {student.discountReason && (
                                    <span className="text-xs text-gray-400 ml-1">
                                      ({student.discountReason})
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </Col>
                </Row>
              </Panel>
            ))}
          </Collapse>

          {salaryData.groupDetails.length === 0 && (
            <Empty description="Aktiv guruhlar topilmadi" />
          )}
        </Card>

        {/* To'lovlar tarixi */}
        <Card title={<span><WalletOutlined className="mr-2" />To'lovlar tarixi</span>}>
          {salaryData.payments.length > 0 ? (
            <Table
              dataSource={salaryData.payments}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: 'Sana',
                  key: 'date',
                  render: (_, record) => (
                    <span>
                      <CalendarOutlined className="mr-2" />
                      {dayjs(record.paymentDate).format('DD.MM.YYYY')}
                    </span>
                  ),
                },
                {
                  title: 'Summa',
                  key: 'amount',
                  render: (_, record) => (
                    <span className="font-medium text-green-600">
                      {formatPrice(record.amount)}
                    </span>
                  ),
                },
                {
                  title: 'Usul',
                  key: 'method',
                  render: (_, record) => (
                    <Tag>{getMethodLabel(record.method)}</Tag>
                  ),
                },
                {
                  title: 'Izoh',
                  key: 'notes',
                  render: (_, record) => record.notes || '-',
                },
                {
                  title: 'Amal',
                  key: 'action',
                  render: (_, record) => (
                    <Popconfirm
                      title="To'lovni o'chirish"
                      description="Haqiqatan ham bu to'lovni o'chirmoqchimisiz?"
                      onConfirm={() => handleDeletePayment(record.id)}
                      okText="Ha"
                      cancelText="Yo'q"
                    >
                      <Button type="link" danger icon={<DeleteOutlined />}>
                        O'chirish
                      </Button>
                    </Popconfirm>
                  ),
                },
              ]}
            />
          ) : (
            <Empty description="To'lovlar topilmadi" />
          )}
        </Card>
      </div>

      {/* Maosh to'lash modal */}
      <Modal
        title={
          <Space>
            <WalletOutlined />
            Maosh to'lash
          </Space>
        }
        open={isPayModalOpen}
        onCancel={() => {
          setIsPayModalOpen(false)
          form.resetFields()
        }}
        footer={null}
        width={500}
      >
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between">
            <span className="text-gray-500">Hisoblangan maosh:</span>
            <span className="font-medium text-blue-600">
              {formatPrice(salaryData.summary.totalSalary)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">To'langan:</span>
            <span className="text-green-600">
              {formatPrice(salaryData.summary.paidAmount)}
            </span>
          </div>
          <div className="flex justify-between font-medium">
            <span className="text-gray-700">Qarz:</span>
            <span className="text-red-600">
              {formatPrice(salaryData.summary.debt)}
            </span>
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handlePay}
        >
          <Form.Item
            label="Summa"
            name="amount"
            rules={[
              { required: true, message: 'Summani kiriting' },
              { type: 'number', min: 1000, message: "Minimal summa: 1,000 so'm" },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              size="large"
              min={0}
              formatter={(value) =>
                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
              }
              parser={(value) => value!.replace(/\s/g, '') as any}
              addonAfter="so'm"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Sana"
                name="paymentDate"
                rules={[{ required: true, message: 'Sanani tanlang' }]}
              >
                <DatePicker
                  style={{ width: '100%' }}
                  size="large"
                  format="DD.MM.YYYY"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="To'lov usuli"
                name="method"
                rules={[{ required: true, message: 'Usulni tanlang' }]}
              >
                <Select size="large">
                  <Option value="CASH">Naqd</Option>
                  <Option value="CARD">Karta</Option>
                  <Option value="BANK_TRANSFER">Bank o'tkazmasi</Option>
                  <Option value="PAYME">Payme</Option>
                  <Option value="CLICK">Click</Option>
                  <Option value="UZUM">Uzum</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Izoh" name="notes">
            <Input.TextArea rows={2} placeholder="Qo'shimcha izoh..." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={paying}
                size="large"
                icon={<WalletOutlined />}
              >
                To'lash
              </Button>
              <Button
                onClick={() => {
                  setIsPayModalOpen(false)
                  form.resetFields()
                }}
                size="large"
              >
                Bekor qilish
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
