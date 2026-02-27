'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import MobileModal from '@/components/MobileModal'
import {
  Button,
  Input,
  Tag,
  Modal,
  Form,
  Select,
  DatePicker,
  message,
  Card,
  Empty,
  Spin,
  Pagination,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  EyeOutlined,
  FilterOutlined,
  PhoneOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hasPermission } from '@/lib/permissions'

const { Option } = Select

// Talaba interfeysi
interface Student {
  id: string
  firstName: string
  lastName: string
  phone: string
  parentPhone?: string
  dateOfBirth?: string
  gender?: 'MALE' | 'FEMALE'
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
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [genderFilter, setGenderFilter] = useState<string>('')
  const [userRole, setUserRole] = useState<string>('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // User role olish
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role || '')
    }
  }, [])

  // Permission tekshirish
  const canAddStudent = hasPermission(userRole, 'students', 'create')
  const canEditStudent = hasPermission(userRole, 'students', 'update')

  // Talabalarni yuklash
  const fetchStudents = async (page = pagination.page) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const params = new URLSearchParams()
      if (searchText) params.append('search', searchText)
      if (statusFilter) params.append('status', statusFilter)
      if (genderFilter) params.append('gender', genderFilter)
      params.append('page', page.toString())
      params.append('limit', pagination.limit.toString())

      const response = await fetch(`/api/students?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()
      setStudents(data.students)
      setPagination(data.pagination)
    } catch (error) {
      message.error('Talabalarni yuklashda xatolik')
      console.error('Error fetching students:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents(1)
  }, [searchText, statusFilter, genderFilter])

  // Modal
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
        // 409 xatosi - dublikat ism/familiya
        if (response.status === 409) {
          message.error(data.error || "Bu ism va familiyali o'quvchi ro'yxatda mavjud")
          form.setFields([
            {
              name: 'firstName',
              errors: [data.error || "Bu ism va familiyali o'quvchi ro'yxatda mavjud"],
            },
          ])
          return
        }
        message.error(data.error || 'Xatolik yuz berdi')
        return
      }

      message.success(
        editingStudent
          ? 'Talaba muvaffaqiyatli yangilandi'
          : "Talaba muvaffaqiyatli qo'shildi"
      )
      setIsModalOpen(false)
      form.resetFields()
      fetchStudents()
    } catch (error) {
      message.error('Xatolik yuz berdi')
    }
  }

  // Talabani o'chirish
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: 'Talabani arxivga olish',
      content: 'Haqiqatan ham bu talabani arxivga olmoqchimisiz?',
      okText: 'Ha',
      cancelText: "Yo'q",
      onOk: async () => {
        try {
          const token = localStorage.getItem('token')
          const response = await fetch(`/api/students/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })

          if (!response.ok) throw new Error('Failed to delete')

          message.success('Talaba arxivga olindi')
          fetchStudents()
        } catch (error) {
          message.error("Talabani o'chirishda xatolik")
        }
      },
    })
  }

  // Status rangi
  const getStatusConfig = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      ACTIVE: { color: 'green', text: 'Faol' },
      GRADUATED: { color: 'blue', text: 'Bitirgan' },
      SUSPENDED: { color: 'orange', text: "To'xtatilgan" },
      DROPPED: { color: 'red', text: 'Arxiv' },
    }
    return config[status] || { color: 'default', text: status }
  }

  // Filterlarni tozalash
  const clearFilters = () => {
    setStatusFilter('')
    setGenderFilter('')
    setSearchText('')
    setIsFilterOpen(false)
  }

  // Active filter count
  const activeFilterCount = [statusFilter, genderFilter].filter(Boolean).length

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Talabalar</h2>
            <p className="text-xs md:text-sm text-gray-600">
              Jami: {pagination.total} ta talaba
            </p>
          </div>
          {canAddStudent && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => router.push('/dashboard/students/new')}
              size="large"
              className="w-full sm:w-auto h-11 md:h-10 text-base touch-manipulation"
            >
              Yangi talaba
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="Qidirish..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            className="flex-1 h-11"
            style={{ fontSize: '16px' }}
          />
          <Button
            icon={<FilterOutlined />}
            onClick={() => setIsFilterOpen(true)}
            size="large"
            className="h-11 px-4 touch-manipulation"
            type={activeFilterCount > 0 ? 'primary' : 'default'}
          >
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-white text-orange-500 rounded-full px-1.5 text-xs">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Active filters display */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {statusFilter && (
              <Tag closable onClose={() => setStatusFilter('')} className="text-sm py-1">
                Status: {getStatusConfig(statusFilter).text}
              </Tag>
            )}
            {genderFilter && (
              <Tag closable onClose={() => setGenderFilter('')} className="text-sm py-1">
                Jinsi: {genderFilter === 'MALE' ? 'Erkak' : 'Ayol'}
              </Tag>
            )}
            <Button type="link" size="small" onClick={clearFilters}>
              Tozalash
            </Button>
          </div>
        )}
      </div>

      {/* Students List - Card view for mobile */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : students.length === 0 ? (
        <Empty
          description="Talabalar topilmadi"
          className="py-12"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {canAddStudent && (
            <Button type="primary" onClick={() => router.push('/dashboard/students/new')}>
              Talaba qo'shish
            </Button>
          )}
        </Empty>
      ) : (
        <>
          <div className="space-y-3">
            {students.map((student) => (
              <Card
                key={student.id}
                className="shadow-sm hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50 touch-manipulation"
                styles={{ body: { padding: '12px 16px' } }}
                onClick={() => router.push(`/dashboard/students/${student.id}`)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <UserOutlined className="text-orange-500 text-lg" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-base truncate">
                          {student.lastName} {student.firstName}
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 text-sm">
                          <PhoneOutlined className="text-xs" />
                          <span>{student.phone}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Tag color={getStatusConfig(student.status).color} className="text-xs">
                        {getStatusConfig(student.status).text}
                      </Tag>
                      {student.gender && (
                        <Tag color={student.gender === 'MALE' ? 'blue' : 'pink'} className="text-xs">
                          {student.gender === 'MALE' ? 'Erkak' : 'Ayol'}
                        </Tag>
                      )}
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <TeamOutlined />
                        {student.groupStudents.length} ta guruh
                      </span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/dashboard/students/${student.id}`)
                      }}
                      className="h-8 px-2"
                    />
                    {canEditStudent && (
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          showModal(student)
                        }}
                        className="h-8 px-2"
                      />
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {pagination.total > pagination.limit && (
            <div className="flex justify-center mt-6">
              <Pagination
                current={pagination.page}
                total={pagination.total}
                pageSize={pagination.limit}
                onChange={(page) => {
                  setPagination((prev) => ({ ...prev, page }))
                  fetchStudents(page)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                showSizeChanger={false}
                showTotal={(total) => `Jami: ${total}`}
              />
            </div>
          )}
        </>
      )}

      {/* Filter Modal */}
      <MobileModal
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filterlar"
        footer={
          <div className="flex gap-3">
            <Button block size="large" onClick={clearFilters} className="h-12">
              Tozalash
            </Button>
            <Button block type="primary" size="large" onClick={() => setIsFilterOpen(false)} className="h-12">
              Qo'llash
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <Select
              placeholder="Tanlang"
              allowClear
              size="large"
              value={statusFilter || undefined}
              onChange={(value) => setStatusFilter(value || '')}
              className="w-full"
              style={{ height: 48 }}
            >
              <Option value="ACTIVE">Faol</Option>
              <Option value="GRADUATED">Bitirgan</Option>
              <Option value="SUSPENDED">To'xtatilgan</Option>
              <Option value="DROPPED">Arxiv</Option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Jinsi</label>
            <Select
              placeholder="Tanlang"
              allowClear
              size="large"
              value={genderFilter || undefined}
              onChange={(value) => setGenderFilter(value || '')}
              className="w-full"
              style={{ height: 48 }}
            >
              <Option value="MALE">Erkak</Option>
              <Option value="FEMALE">Ayol</Option>
            </Select>
          </div>
        </div>
      </MobileModal>

      {/* Edit Student Modal */}
      <MobileModal
        open={isModalOpen}
        onClose={handleCancel}
        title={
          <span className="flex items-center gap-2">
            <UserOutlined />
            {editingStudent ? 'Talabani tahrirlash' : "Yangi talaba qo'shish"}
          </span>
        }
        footer={
          <div className="flex gap-3">
            <Button block size="large" onClick={handleCancel} className="h-12">
              Bekor qilish
            </Button>
            <Button block type="primary" size="large" onClick={() => form.submit()} className="h-12">
              {editingStudent ? 'Saqlash' : "Qo'shish"}
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          requiredMark={false}
        >
          <Form.Item
            label="Familiya"
            name="lastName"
            rules={[{ required: true, message: 'Familiya kiriting' }]}
          >
            <Input placeholder="Rahimov" size="large" className="h-12" style={{ fontSize: '16px' }} />
          </Form.Item>

          <Form.Item
            label="Ism"
            name="firstName"
            rules={[{ required: true, message: 'Ism kiriting' }]}
          >
            <Input placeholder="Aziz" size="large" className="h-12" style={{ fontSize: '16px' }} />
          </Form.Item>

          <Form.Item
            label="Jinsi"
            name="gender"
            rules={[{ required: true, message: 'Jinsini tanlang' }]}
          >
            <Select placeholder="Tanlang" size="large" style={{ height: 48 }}>
              <Option value="MALE">Erkak</Option>
              <Option value="FEMALE">Ayol</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Tug'ilgan sana" name="dateOfBirth">
            <DatePicker
              style={{ width: '100%', height: 48 }}
              format="DD.MM.YYYY"
              size="large"
              inputReadOnly
            />
          </Form.Item>

          <Form.Item
            label="Telefon"
            name="phone"
            rules={[
              { required: true, message: 'Telefon raqam kiriting' },
              { pattern: /^\+998\d{9}$/, message: '+998901234567 formatida kiriting' },
            ]}
          >
            <Input
              placeholder="+998901234567"
              size="large"
              className="h-12"
              style={{ fontSize: '16px' }}
              type="tel"
              inputMode="tel"
            />
          </Form.Item>

          <Form.Item
            label="Ota-ona telefoni"
            name="parentPhone"
            rules={[
              { pattern: /^\+998\d{9}$/, message: '+998901234567 formatida kiriting' },
            ]}
          >
            <Input
              placeholder="+998901234567"
              size="large"
              className="h-12"
              style={{ fontSize: '16px' }}
              type="tel"
              inputMode="tel"
            />
          </Form.Item>

          {editingStudent && (
            <Form.Item label="Status" name="status">
              <Select size="large" style={{ height: 48 }}>
                <Option value="ACTIVE">Faol</Option>
                <Option value="GRADUATED">Bitirgan</Option>
                <Option value="SUSPENDED">To'xtatilgan</Option>
                <Option value="DROPPED">Arxiv</Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </MobileModal>
    </DashboardLayout>
  )
}
