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
  InputNumber,
  message,
  Card,
  Empty,
  Spin,
  Pagination,
  Divider,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  PhoneOutlined,
  BookOutlined,
  MinusCircleOutlined,
  EyeOutlined,
  FilterOutlined,
} from '@ant-design/icons'

const { Option } = Select
const { TextArea } = Input

// Interfeys
interface Course {
  id: string
  name: string
  price: number
  isActive: boolean
}

interface TeacherCourse {
  id: string
  courseId: string
  percentage: number
  course: Course
}

interface Teacher {
  id: string
  firstName: string
  lastName: string
  middleName?: string
  phone: string
  address?: string
  education?: string
  status: 'ACTIVE' | 'ON_LEAVE' | 'RESIGNED'
  hireDate: string
  createdBy: {
    fullName: string
  }
  groups: any[]
  teacherCourses: TeacherCourse[]
  _count: {
    groups: number
    schedules: number
  }
}

export default function TeachersPage() {
  const router = useRouter()
  const [form] = Form.useForm()

  // State
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [selectedCourses, setSelectedCourses] = useState<{ courseId: string; percentage: number }[]>([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Kurslarni yuklash
  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch('/api/courses?isActive=true', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setCourses(data.courses || [])
      }
    } catch (error) {
      console.error('Error fetching courses:', error)
    }
  }

  // O'qituvchilarni yuklash
  const fetchTeachers = async (page = pagination.page) => {
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
      params.append('page', page.toString())
      params.append('limit', pagination.limit.toString())

      const response = await fetch(`/api/teachers?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()
      setTeachers(data.teachers)
      setPagination(data.pagination)
    } catch (error) {
      message.error('O\'qituvchilarni yuklashda xatolik')
      console.error('Error fetching teachers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  useEffect(() => {
    fetchTeachers(1)
  }, [searchText, statusFilter])

  // Modal ochish/yopish
  const showModal = (teacher?: Teacher) => {
    if (teacher) {
      setEditingTeacher(teacher)
      form.setFieldsValue({
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        middleName: teacher.middleName,
        phone: teacher.phone,
        education: teacher.education,
        address: teacher.address,
        status: teacher.status,
      })
      // TeacherCourses ni yuklash
      setSelectedCourses(
        teacher.teacherCourses.map((tc) => ({
          courseId: tc.courseId,
          percentage: tc.percentage,
        }))
      )
    } else {
      setEditingTeacher(null)
      form.resetFields()
      setSelectedCourses([])
    }
    setIsModalOpen(true)
  }

  const handleCancel = () => {
    setIsModalOpen(false)
    setEditingTeacher(null)
    form.resetFields()
    setSelectedCourses([])
  }

  // Kurs qo'shish
  const addCourse = () => {
    const usedCourseIds = selectedCourses.map((c) => c.courseId)
    const availableCourses = courses.filter((c) => !usedCourseIds.includes(c.id))

    if (availableCourses.length === 0) {
      message.warning('Barcha kurslar allaqachon tanlangan')
      return
    }

    setSelectedCourses([
      ...selectedCourses,
      { courseId: '', percentage: 50 },
    ])
  }

  // Kurs o'chirish
  const removeCourse = (index: number) => {
    const newCourses = [...selectedCourses]
    newCourses.splice(index, 1)
    setSelectedCourses(newCourses)
  }

  // Kurs tanlash
  const handleCourseChange = (index: number, courseId: string) => {
    const newCourses = [...selectedCourses]
    newCourses[index].courseId = courseId
    setSelectedCourses(newCourses)
  }

  // Foiz o'zgartirish
  const handlePercentageChange = (index: number, percentage: number | null) => {
    const newCourses = [...selectedCourses]
    newCourses[index].percentage = percentage || 50
    setSelectedCourses(newCourses)
  }

  // O'qituvchi qo'shish/tahrirlash
  const handleSubmit = async (values: any) => {
    try {
      const validCourses = selectedCourses.filter((c) => c.courseId)

      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const url = editingTeacher
        ? `/api/teachers/${editingTeacher.id}`
        : '/api/teachers'

      const method = editingTeacher ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...values,
          courses: validCourses,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        message.error(data.error || 'Xatolik yuz berdi')
        return
      }

      message.success(
        editingTeacher
          ? 'O\'qituvchi muvaffaqiyatli yangilandi'
          : 'O\'qituvchi muvaffaqiyatli qo\'shildi'
      )
      setIsModalOpen(false)
      form.resetFields()
      setSelectedCourses([])
      fetchTeachers()
    } catch (error) {
      message.error('Xatolik yuz berdi')
      console.error('Error saving teacher:', error)
    }
  }

  // O'qituvchini o'chirish (arxivga olish)
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: 'O\'qituvchini arxivga olish',
      content: 'Haqiqatan ham bu o\'qituvchini arxivga olmoqchimisiz?',
      okText: 'Ha',
      cancelText: 'Yo\'q',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token')
          const response = await fetch(`/api/teachers/${id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!response.ok) throw new Error('Failed to delete')

          message.success('O\'qituvchi arxivga olindi')
          fetchTeachers()
        } catch (error) {
          message.error('O\'qituvchini o\'chirishda xatolik')
        }
      },
    })
  }

  // Mavjud kurslar (tanlangan kurslarni chiqarib tashlash)
  const getAvailableCourses = (currentIndex: number) => {
    const usedCourseIds = selectedCourses
      .filter((_, idx) => idx !== currentIndex)
      .map((c) => c.courseId)
    return courses.filter((c) => !usedCourseIds.includes(c.id))
  }

  // Status config
  const getStatusConfig = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      ACTIVE: { color: 'green', text: 'Aktiv' },
      ON_LEAVE: { color: 'orange', text: 'Ta\'tilda' },
      RESIGNED: { color: 'red', text: 'Ishdan ketgan' },
    }
    return config[status] || { color: 'default', text: status }
  }

  // Filterlarni tozalash
  const clearFilters = () => {
    setStatusFilter('')
    setSearchText('')
    setIsFilterOpen(false)
  }

  const hasActiveFilters = !!statusFilter

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">O'qituvchilar</h2>
            <p className="text-xs md:text-sm text-gray-600">
              Jami: {pagination.total} ta o'qituvchi
            </p>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => showModal()}
            size="large"
            className="w-full sm:w-auto h-11 md:h-10 text-base touch-manipulation"
          >
            Yangi o'qituvchi
          </Button>
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
            type={hasActiveFilters ? 'primary' : 'default'}
          >
            <span className="hidden sm:inline">Filter</span>
          </Button>
        </div>

        {/* Active filters display */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {statusFilter && (
              <Tag closable onClose={() => setStatusFilter('')} className="text-sm py-1">
                Status: {getStatusConfig(statusFilter).text}
              </Tag>
            )}
            <Button type="link" size="small" onClick={clearFilters}>
              Tozalash
            </Button>
          </div>
        )}
      </div>

      {/* Teachers List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : teachers.length === 0 ? (
        <Empty
          description="O'qituvchilar topilmadi"
          className="py-12"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => showModal()}>
            O'qituvchi qo'shish
          </Button>
        </Empty>
      ) : (
        <>
          <div className="space-y-3">
            {teachers.map((teacher) => (
              <Card
                key={teacher.id}
                className="shadow-sm hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50 touch-manipulation"
                styles={{ body: { padding: '12px 16px' } }}
                onClick={() => router.push(`/dashboard/teachers/${teacher.id}`)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Avatar va ism */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                        <UserOutlined className="text-blue-500 text-lg" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-base truncate">
                          {teacher.lastName} {teacher.firstName} {teacher.middleName || ''}
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 text-sm">
                          <PhoneOutlined className="text-xs" />
                          <span>{teacher.phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Fanlar */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {teacher.teacherCourses.length > 0 ? (
                        teacher.teacherCourses.map((tc) => (
                          <Tag key={tc.id} color="blue" className="text-xs">
                            {tc.course.name} - {tc.percentage}%
                          </Tag>
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs">Fanlar yo'q</span>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag color={getStatusConfig(teacher.status).color} className="text-xs">
                        {getStatusConfig(teacher.status).text}
                      </Tag>
                      <span className="text-xs text-gray-500">
                        {teacher._count.groups} ta guruh
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
                        router.push(`/dashboard/teachers/${teacher.id}`)
                      }}
                      className="h-8 px-2"
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        showModal(teacher)
                      }}
                      className="h-8 px-2"
                    />
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(teacher.id)
                      }}
                      className="h-8 px-2"
                    />
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
                  fetchTeachers(page)
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
              <Option value="ACTIVE">Aktiv</Option>
              <Option value="ON_LEAVE">Ta'tilda</Option>
              <Option value="RESIGNED">Ishdan ketgan</Option>
            </Select>
          </div>
        </div>
      </MobileModal>

      {/* Create/Edit Teacher Modal */}
      <MobileModal
        open={isModalOpen}
        onClose={handleCancel}
        title={
          <span className="flex items-center gap-2">
            <UserOutlined />
            {editingTeacher ? 'O\'qituvchini tahrirlash' : 'Yangi o\'qituvchi qo\'shish'}
          </span>
        }
        width={800}
        footer={
          <div className="flex gap-3">
            <Button block size="large" onClick={handleCancel} className="h-12">
              Bekor qilish
            </Button>
            <Button block type="primary" size="large" onClick={() => form.submit()} className="h-12">
              {editingTeacher ? 'Saqlash' : 'Qo\'shish'}
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
          {/* Asosiy ma'lumotlar */}
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <Form.Item label="Otasining ismi" name="middleName">
            <Input placeholder="Karimovich" size="large" className="h-12" style={{ fontSize: '16px' }} />
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

          <Form.Item label="Ma'lumoti" name="education">
            <Input placeholder="Oliy, TDPU 2015" size="large" className="h-12" style={{ fontSize: '16px' }} />
          </Form.Item>

          <Form.Item label="Manzil" name="address">
            <TextArea rows={2} placeholder="Toshkent sh., Chilonzor t." style={{ fontSize: '16px' }} />
          </Form.Item>

          {editingTeacher && (
            <Form.Item label="Status" name="status">
              <Select size="large" style={{ height: 48 }}>
                <Option value="ACTIVE">Aktiv</Option>
                <Option value="ON_LEAVE">Ta'tilda</Option>
                <Option value="RESIGNED">Ishdan ketgan</Option>
              </Select>
            </Form.Item>
          )}

          {/* Fanlar va foizlar */}
          <Divider className="!my-4">
            <span className="text-sm text-gray-500 flex items-center gap-2">
              <BookOutlined />
              Fanlar va foizlar
            </span>
          </Divider>

          {selectedCourses.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Hech qanday fan tanlanmagan"
              className="!my-4"
            />
          ) : (
            <div className="space-y-3 mb-4">
              {selectedCourses.map((sc, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Select
                    placeholder="Fanni tanlang"
                    value={sc.courseId || undefined}
                    onChange={(value) => handleCourseChange(index, value)}
                    className="flex-1"
                    size="large"
                    style={{ height: 48 }}
                  >
                    {getAvailableCourses(index).map((course) => (
                      <Option key={course.id} value={course.id}>
                        {course.name}
                      </Option>
                    ))}
                  </Select>
                  <InputNumber
                    min={40}
                    max={60}
                    value={sc.percentage}
                    onChange={(value) => handlePercentageChange(index, value)}
                    formatter={(value) => `${value}%`}
                    parser={(value) => value?.replace('%', '') as unknown as number}
                    className="w-24"
                    size="large"
                    style={{ height: 48 }}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => removeCourse(index)}
                    className="h-12 w-12"
                  />
                </div>
              ))}
            </div>
          )}

          <Button
            type="dashed"
            onClick={addCourse}
            block
            icon={<PlusOutlined />}
            className="h-12 mb-4"
            disabled={selectedCourses.length >= courses.length}
          >
            Fan qo'shish
          </Button>
        </Form>
      </MobileModal>
    </DashboardLayout>
  )
}
