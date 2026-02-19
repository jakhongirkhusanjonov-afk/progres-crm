'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import MobileModal from '@/components/MobileModal'
import {
  Card,
  Button,
  Input,
  Tag,
  Form,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Empty,
  Spin,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  BookOutlined,
  TeamOutlined,
  UserOutlined,
  ReloadOutlined,
} from '@ant-design/icons'

const { TextArea } = Input
const { Option } = Select

interface Course {
  id: string
  name: string
  description: string | null
  duration: number | null
  price: number
  level: string | null
  isActive: boolean
  createdAt: string
  groupsCount: number
  teachersCount: number
}

export default function CoursesPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Course | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [form] = Form.useForm()

  // Kurslarni yuklash
  const fetchCourses = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const params = new URLSearchParams()
      if (searchText) params.append('search', searchText)

      const response = await fetch(`/api/courses?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        throw new Error('Failed to fetch')
      }

      const data = await response.json()
      setCourses(data.courses || [])
    } catch (error) {
      message.error('Kurslarni yuklashda xatolik')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  // Qidirish
  const handleSearch = () => {
    fetchCourses()
  }

  // Modal ochish (yangi kurs)
  const showCreateModal = () => {
    setEditingCourse(null)
    form.resetFields()
    form.setFieldsValue({
      price: 500000,
      isActive: true,
    })
    setIsModalOpen(true)
  }

  // Modal ochish (tahrirlash)
  const showEditModal = (course: Course) => {
    setEditingCourse(course)
    form.setFieldsValue({
      name: course.name,
      description: course.description,
      duration: course.duration,
      price: course.price,
      level: course.level,
      isActive: course.isActive,
    })
    setIsModalOpen(true)
  }

  // Kurs saqlash
  const handleSubmit = async (values: any) => {
    setSubmitLoading(true)
    try {
      const token = localStorage.getItem('token')
      const url = editingCourse
        ? `/api/courses/${editingCourse.id}`
        : '/api/courses'
      const method = editingCourse ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      })

      const data = await response.json()

      if (!response.ok) {
        message.error(data.error || 'Xatolik yuz berdi')
        return
      }

      message.success(
        editingCourse
          ? 'Kurs muvaffaqiyatli yangilandi'
          : 'Kurs muvaffaqiyatli qo\'shildi'
      )
      setIsModalOpen(false)
      form.resetFields()
      fetchCourses()
    } catch (error) {
      message.error('Xatolik yuz berdi')
    } finally {
      setSubmitLoading(false)
    }
  }

  // Kursni o'chirish
  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/courses/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        message.error(data.error || 'Xatolik yuz berdi')
        return
      }

      message.success('Kurs o\'chirildi')
      fetchCourses()
    } catch (error) {
      message.error('Xatolik yuz berdi')
    }
  }

  // Statistika
  const totalCourses = courses.length
  const activeCourses = courses.filter((c) => c.isActive).length
  const totalGroups = courses.reduce((sum, c) => sum + c.groupsCount, 0)

  // Narxni formatlash
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('uz-UZ').format(Number(price)) + " so'm"
  }

  // Level color
  const getLevelConfig = (level: string | null) => {
    if (!level) return { color: 'default', text: '-' }
    const config: Record<string, { color: string; text: string }> = {
      Beginner: { color: 'green', text: 'Beginner' },
      Intermediate: { color: 'blue', text: 'Intermediate' },
      Advanced: { color: 'purple', text: 'Advanced' },
    }
    return config[level] || { color: 'default', text: level }
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Kurslar</h2>
            <p className="text-xs md:text-sm text-gray-600">
              Jami: {totalCourses} ta kurs
            </p>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showCreateModal}
            size="large"
            className="w-full sm:w-auto h-11 md:h-10 text-base touch-manipulation"
          >
            Yangi kurs
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
        <div className="bg-blue-50 rounded-xl p-2 md:p-3 text-center border border-blue-100">
          <div className="text-blue-600 font-bold text-lg md:text-xl">{totalCourses}</div>
          <div className="text-blue-600 text-[10px] md:text-xs">Jami kurslar</div>
        </div>
        <div className="bg-green-50 rounded-xl p-2 md:p-3 text-center border border-green-100">
          <div className="text-green-600 font-bold text-lg md:text-xl">{activeCourses}</div>
          <div className="text-green-600 text-[10px] md:text-xs">Aktiv</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-2 md:p-3 text-center border border-orange-100">
          <div className="text-orange-600 font-bold text-lg md:text-xl">{totalGroups}</div>
          <div className="text-orange-600 text-[10px] md:text-xs">Guruhlar</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 flex gap-2">
        <Input
          placeholder="Qidirish..."
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onPressEnter={handleSearch}
          allowClear
          className="flex-1 h-11"
          style={{ fontSize: '16px' }}
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchCourses}
          size="large"
          className="h-11 touch-manipulation"
        />
      </div>

      {/* Courses List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : courses.length === 0 ? (
        <Empty
          description="Kurslar topilmadi"
          className="py-12"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={showCreateModal}>
            Kurs qo'shish
          </Button>
        </Empty>
      ) : (
        <div className="space-y-3">
          {courses.map((course) => (
            <Card
              key={course.id}
              className="shadow-sm hover:shadow-md transition-shadow touch-manipulation"
              styles={{ body: { padding: '12px 16px' } }}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  {/* Kurs nomi */}
                  <div className="flex items-center gap-2 mb-1">
                    <BookOutlined className="text-blue-500" />
                    <div className="font-semibold text-gray-900 text-base truncate">
                      {course.name}
                    </div>
                  </div>

                  {/* Description */}
                  {course.description && (
                    <div className="text-xs text-gray-500 truncate mb-2">
                      {course.description}
                    </div>
                  )}

                  {/* Narx */}
                  <div className="text-green-600 font-medium text-sm mb-2">
                    {formatPrice(course.price)}
                    {course.duration && (
                      <span className="text-gray-400 font-normal ml-2">
                        ({course.duration} soat)
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag color={course.isActive ? 'green' : 'red'} className="text-xs">
                      {course.isActive ? 'Aktiv' : 'Nofaol'}
                    </Tag>
                    {course.level && (
                      <Tag color={getLevelConfig(course.level).color} className="text-xs">
                        {getLevelConfig(course.level).text}
                      </Tag>
                    )}
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <TeamOutlined /> {course.groupsCount}
                    </span>
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <UserOutlined /> {course.teachersCount}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => showEditModal(course)}
                    className="h-8 px-2"
                  />
                  <Popconfirm
                    title="Kursni o'chirish"
                    description="Haqiqatan ham bu kursni o'chirmoqchimisiz?"
                    onConfirm={() => handleDelete(course.id)}
                    okText="Ha"
                    cancelText="Yo'q"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      className="h-8 px-2"
                    />
                  </Popconfirm>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Course Modal */}
      <MobileModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCourse ? 'Kursni tahrirlash' : 'Yangi kurs qo\'shish'}
        footer={
          <div className="flex gap-3">
            <Button block size="large" onClick={() => setIsModalOpen(false)} className="h-12">
              Bekor qilish
            </Button>
            <Button
              block
              type="primary"
              size="large"
              onClick={() => form.submit()}
              loading={submitLoading}
              className="h-12"
            >
              {editingCourse ? 'Saqlash' : 'Qo\'shish'}
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
            label="Kurs nomi"
            name="name"
            rules={[{ required: true, message: 'Kurs nomini kiriting' }]}
          >
            <Input placeholder="Masalan: Ingliz tili" size="large" className="h-12" style={{ fontSize: '16px' }} />
          </Form.Item>

          <Form.Item label="Tavsif" name="description">
            <TextArea
              rows={3}
              placeholder="Kurs haqida qisqa ma'lumot"
              style={{ fontSize: '16px' }}
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              label="Narxi (so'm)"
              name="price"
              rules={[{ required: true, message: 'Narxni kiriting' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                size="large"
                className="h-12"
                min={0}
                step={50000}
                formatter={(value) =>
                  `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                }
                parser={(value) => value!.replace(/,/g, '') as any}
                placeholder="500,000"
              />
            </Form.Item>
            <Form.Item label="Davomiyligi (soat)" name="duration">
              <InputNumber
                style={{ width: '100%' }}
                size="large"
                className="h-12"
                min={1}
                placeholder="72"
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="Daraja" name="level">
              <Select placeholder="Tanlang" allowClear size="large" style={{ height: 48 }}>
                <Option value="Beginner">Beginner (Boshlang'ich)</Option>
                <Option value="Intermediate">Intermediate (O'rta)</Option>
                <Option value="Advanced">Advanced (Yuqori)</Option>
              </Select>
            </Form.Item>
            <Form.Item label="Holat" name="isActive">
              <Select defaultValue={true} size="large" style={{ height: 48 }}>
                <Option value={true}>Aktiv</Option>
                <Option value={false}>Nofaol</Option>
              </Select>
            </Form.Item>
          </div>
        </Form>
      </MobileModal>
    </DashboardLayout>
  )
}
