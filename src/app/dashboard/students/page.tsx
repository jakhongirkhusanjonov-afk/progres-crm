'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Table,
  Button,
  Input,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  DatePicker,
  message,
  Row,
  Col,
  Card,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'

const { Search } = Input
const { Option } = Select

// Talaba interfeysi
interface Student {
  id: string
  firstName: string
  lastName: string
  middleName?: string
  phone: string
  parentPhone?: string
  email?: string
  dateOfBirth?: string
  gender?: 'MALE' | 'FEMALE'
  address?: string
  status: 'ACTIVE' | 'GRADUATED' | 'SUSPENDED' | 'DROPPED'
  enrollmentDate: string
  createdBy: {
    fullName: string
  }
  groupStudents: any[]
  _count: {
    payments: number
    attendances: number
  }
}

export default function StudentsPage() {
  const router = useRouter()
  const [form] = Form.useForm()

  // State
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [genderFilter, setGenderFilter] = useState<string>('')

  // Talabalarni yuklash
  const fetchStudents = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      // Query parametrlarni tuzish
      const params = new URLSearchParams()
      if (searchText) params.append('search', searchText)
      if (statusFilter) params.append('status', statusFilter)
      if (genderFilter) params.append('gender', genderFilter)

      const response = await fetch(`/api/students?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()
      setStudents(data.students)
    } catch (error) {
      message.error('Talabalarni yuklashda xatolik')
      console.error('Error fetching students:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [searchText, statusFilter, genderFilter])

  // Modal ochish/yopish
  const showModal = (student?: Student) => {
    if (student) {
      setEditingStudent(student)
      form.setFieldsValue({
        ...student,
        dateOfBirth: student.dateOfBirth ? dayjs(student.dateOfBirth) : null,
      })
    } else {
      setEditingStudent(null)
      form.resetFields()
    }
    setIsModalOpen(true)
  }

  const handleCancel = () => {
    setIsModalOpen(false)
    setEditingStudent(null)
    form.resetFields()
  }

  // Talaba qo'shish/tahrirlash
  const handleSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const url = editingStudent
        ? `/api/students/${editingStudent.id}`
        : '/api/students'

      const method = editingStudent ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...values,
          dateOfBirth: values.dateOfBirth
            ? values.dateOfBirth.toISOString()
            : null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        message.error(data.error || 'Xatolik yuz berdi')
        return
      }

      message.success(
        editingStudent
          ? 'Talaba muvaffaqiyatli yangilandi'
          : 'Talaba muvaffaqiyatli qo\'shildi'
      )
      setIsModalOpen(false)
      form.resetFields()
      fetchStudents()
    } catch (error) {
      message.error('Xatolik yuz berdi')
      console.error('Error saving student:', error)
    }
  }

  // Talabani o'chirish (arxivga olish)
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: 'Talabani arxivga olish',
      content: 'Haqiqatan ham bu talabani arxivga olmoqchimisiz?',
      okText: 'Ha',
      cancelText: 'Yo\'q',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token')
          const response = await fetch(`/api/students/${id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!response.ok) throw new Error('Failed to delete')

          message.success('Talaba arxivga olindi')
          fetchStudents()
        } catch (error) {
          message.error('Talabani o\'chirishda xatolik')
        }
      },
    })
  }

  // Chiqish
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  // Jadval ustunlari
  const columns: ColumnsType<Student> = [
    {
      title: 'F.I.O',
      key: 'fullName',
      render: (_, record) => (
        <div>
          <div className="font-medium">
            {record.lastName} {record.firstName} {record.middleName}
          </div>
          {record.email && (
            <div className="text-xs text-gray-500">{record.email}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Telefon',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: 'Jinsi',
      dataIndex: 'gender',
      key: 'gender',
      render: (gender) => {
        if (!gender) return '-'
        return gender === 'MALE' ? (
          <Tag color="blue">Erkak</Tag>
        ) : (
          <Tag color="pink">Ayol</Tag>
        )
      },
    },
    {
      title: 'Guruhlar',
      key: 'groups',
      render: (_, record) => `${record.groupStudents.length} ta`,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig: Record<string, { color: string; text: string }> = {
          ACTIVE: { color: 'green', text: 'Aktiv' },
          GRADUATED: { color: 'blue', text: 'Bitirgan' },
          SUSPENDED: { color: 'orange', text: 'To\'xtatilgan' },
          DROPPED: { color: 'red', text: 'Arxiv' },
        }
        const config = statusConfig[status] || { color: 'default', text: status }
        return <Tag color={config.color}>{config.text}</Tag>
      },
    },
    {
      title: 'Ro\'yxatdan o\'tgan',
      dataIndex: 'enrollmentDate',
      key: 'enrollmentDate',
      render: (date) => new Date(date).toLocaleDateString('uz-UZ'),
    },
    {
      title: 'Amallar',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => showModal(record)}
          >
            Tahrirlash
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Arxivga
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <h1
                className="text-2xl font-bold text-indigo-600 cursor-pointer"
                onClick={() => router.push('/dashboard')}
              >
                O'quv Markazi CRM
              </h1>
              <nav className="flex gap-4">
                <a href="/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </a>
                <a
                  href="/dashboard/students"
                  className="text-indigo-600 font-medium"
                >
                  Talabalar
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
        <Card>
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Talabalar</h2>
              <p className="mt-1 text-sm text-gray-600">
                Barcha talabalar ro'yxati va boshqaruv
              </p>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
              size="large"
            >
              Yangi talaba
            </Button>
          </div>

          {/* Filtrlar */}
          <Row gutter={16} className="mb-4">
            <Col span={12}>
              <Search
                placeholder="Ism, familiya yoki telefon bo'yicha qidirish"
                allowClear
                enterButton={<SearchOutlined />}
                size="large"
                onSearch={(value) => setSearchText(value)}
                onChange={(e) => {
                  if (!e.target.value) setSearchText('')
                }}
              />
            </Col>
            <Col span={6}>
              <Select
                placeholder="Status"
                allowClear
                size="large"
                style={{ width: '100%' }}
                onChange={(value) => setStatusFilter(value || '')}
              >
                <Option value="ACTIVE">Aktiv</Option>
                <Option value="GRADUATED">Bitirgan</Option>
                <Option value="SUSPENDED">To'xtatilgan</Option>
                <Option value="DROPPED">Arxiv</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Select
                placeholder="Jinsi"
                allowClear
                size="large"
                style={{ width: '100%' }}
                onChange={(value) => setGenderFilter(value || '')}
              >
                <Option value="MALE">Erkak</Option>
                <Option value="FEMALE">Ayol</Option>
              </Select>
            </Col>
          </Row>

          {/* Jadval */}
          <Table
            columns={columns}
            dataSource={students}
            loading={loading}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Jami: ${total} ta talaba`,
            }}
          />
        </Card>
      </div>

      {/* Modal - Talaba qo'shish/tahrirlash */}
      <Modal
        title={
          <Space>
            <UserOutlined />
            {editingStudent ? 'Talabani tahrirlash' : 'Yangi talaba qo\'shish'}
          </Space>
        }
        open={isModalOpen}
        onCancel={handleCancel}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Ism"
                name="firstName"
                rules={[{ required: true, message: 'Ism kiriting' }]}
              >
                <Input placeholder="Aziz" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Familiya"
                name="lastName"
                rules={[{ required: true, message: 'Familiya kiriting' }]}
              >
                <Input placeholder="Rahimov" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Otasining ismi" name="middleName">
                <Input placeholder="Sharofovich" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Jinsi"
                name="gender"
                rules={[{ required: true, message: 'Jinsini tanlang' }]}
              >
                <Select placeholder="Tanlang">
                  <Option value="MALE">Erkak</Option>
                  <Option value="FEMALE">Ayol</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Telefon"
                name="phone"
                rules={[
                  { required: true, message: 'Telefon raqam kiriting' },
                  {
                    pattern: /^\+998\d{9}$/,
                    message: '+998901234567 formatida kiriting',
                  },
                ]}
              >
                <Input placeholder="+998901234567" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Ota-ona telefoni"
                name="parentPhone"
                rules={[
                  {
                    pattern: /^\+998\d{9}$/,
                    message: '+998901234567 formatida kiriting',
                  },
                ]}
              >
                <Input placeholder="+998901234567" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[{ type: 'email', message: 'To\'g\'ri email kiriting' }]}
              >
                <Input placeholder="email@example.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Tug'ilgan sana" name="dateOfBirth">
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Manzil" name="address">
            <Input.TextArea rows={2} placeholder="Toshkent sh., ..." />
          </Form.Item>

          {editingStudent && (
            <Form.Item label="Status" name="status">
              <Select>
                <Option value="ACTIVE">Aktiv</Option>
                <Option value="GRADUATED">Bitirgan</Option>
                <Option value="SUSPENDED">To'xtatilgan</Option>
                <Option value="DROPPED">Arxiv</Option>
              </Select>
            </Form.Item>
          )}

          <Form.Item label="Izoh" name="notes">
            <Input.TextArea rows={3} placeholder="Qo'shimcha ma'lumot..." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" size="large">
                {editingStudent ? 'Saqlash' : 'Qo\'shish'}
              </Button>
              <Button onClick={handleCancel} size="large">
                Bekor qilish
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
