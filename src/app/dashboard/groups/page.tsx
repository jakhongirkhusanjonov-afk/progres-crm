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
  TimePicker,
  InputNumber,
  Checkbox,
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
  EyeOutlined,
  TeamOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { hasPermission } from '@/lib/permissions'

const { Option } = Select

// Dars kunlari
const DAYS_OF_WEEK = [
  { value: '1', label: 'Dush' },
  { value: '2', label: 'Sesh' },
  { value: '3', label: 'Chor' },
  { value: '4', label: 'Pay' },
  { value: '5', label: 'Jum' },
  { value: '6', label: 'Shan' },
  { value: '0', label: 'Yak' },
]

// Guruh interfeysi
interface Group {
  id: string
  name: string
  course: {
    id: string
    name: string
    price: number
    level?: string
  }
  teacher: {
    id: string
    firstName: string
    lastName: string
    phone?: string
  }
  startDate: string
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  roomNumber?: string
  branch?: string
  price?: number
  scheduleDays?: string
  startTime?: string
  endTime?: string
  _count: {
    groupStudents: number
  }
}

interface Course {
  id: string
  name: string
  price: number
  level?: string
}

interface Teacher {
  id: string
  firstName: string
  lastName: string
  teacherCourses: { courseId: string }[]
}

export default function GroupsPage() {
  const router = useRouter()
  const [form] = Form.useForm()

  // State
  const [groups, setGroups] = useState<Group[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [filteredTeachers, setFilteredTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
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
  const canCreateGroup = hasPermission(userRole, 'groups', 'create')
  const canEditGroup = hasPermission(userRole, 'groups', 'update')
  const canDeleteGroup = hasPermission(userRole, 'groups', 'delete')

  // Guruhlarni yuklash
  const fetchGroups = async (page = pagination.page) => {
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

      const response = await fetch(`/api/groups?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()
      setGroups(data.groups)
      setPagination(data.pagination)
    } catch (error) {
      message.error('Guruhlarni yuklashda xatolik')
      console.error('Error fetching groups:', error)
    } finally {
      setLoading(false)
    }
  }

  // Kurslarni yuklash
  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/courses', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setCourses(data.courses)
      }
    } catch (error) {
      console.error('Error fetching courses:', error)
    }
  }

  // O'qituvchilarni yuklash
  const fetchTeachers = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/teachers?status=ACTIVE&limit=1000', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (response.ok) {
        const data = await response.json()
        setTeachers(data.teachers)
        setFilteredTeachers(data.teachers)
      }
    } catch (error) {
      console.error('Error fetching teachers:', error)
    }
  }

  useEffect(() => {
    fetchGroups(1)
    fetchCourses()
    fetchTeachers()
  }, [])

  useEffect(() => {
    fetchGroups(1)
  }, [searchText, statusFilter])

  // Kurs tanlanganda o'qituvchilarni filterlash
  const handleCourseChange = (courseId: string) => {
    form.setFieldsValue({ teacherId: undefined })

    // Tanlangan kurs narxini olish
    const selectedCourse = courses.find((c) => c.id === courseId)
    if (selectedCourse) {
      form.setFieldsValue({ price: Number(selectedCourse.price) })
    }

    // O'qituvchilarni filterlash
    const filtered = teachers.filter((t) =>
      t.teacherCourses.some((tc) => tc.courseId === courseId)
    )
    setFilteredTeachers(filtered.length > 0 ? filtered : teachers)
  }

  // Modal ochish/yopish
  const showModal = (group?: Group) => {
    if (group) {
      setEditingGroup(group)
      form.setFieldsValue({
        ...group,
        courseId: group.course.id,
        teacherId: group.teacher.id,
        startDate: dayjs(group.startDate),
        startTime: group.startTime ? dayjs(group.startTime, 'HH:mm') : null,
        endTime: group.endTime ? dayjs(group.endTime, 'HH:mm') : null,
        scheduleDays: group.scheduleDays ? group.scheduleDays.split(',') : [],
        price: group.price || Number(group.course.price),
      })
      // O'qituvchilarni filterlash
      const filtered = teachers.filter((t) =>
        t.teacherCourses.some((tc) => tc.courseId === group.course.id)
      )
      setFilteredTeachers(filtered.length > 0 ? filtered : teachers)
    } else {
      setEditingGroup(null)
      form.resetFields()
      setFilteredTeachers(teachers)
    }
    setIsModalOpen(true)
  }

  const handleCancel = () => {
    setIsModalOpen(false)
    setEditingGroup(null)
    form.resetFields()
  }

  // Guruh qo'shish/tahrirlash
  const handleSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const url = editingGroup
        ? `/api/groups/${editingGroup.id}`
        : '/api/groups'

      const method = editingGroup ? 'PUT' : 'POST'

      // Faqat kerakli maydonlarni yuborish
      const payload = {
        name: values.name,
        courseId: values.courseId,
        teacherId: values.teacherId,
        startDate: values.startDate?.toISOString() || null,
        startTime: values.startTime?.format('HH:mm') || null,
        endTime: values.endTime?.format('HH:mm') || null,
        scheduleDays: Array.isArray(values.scheduleDays)
          ? values.scheduleDays.join(',')
          : values.scheduleDays || null,
        price: values.price || null,
        roomNumber: values.roomNumber || null,
        branch: values.branch || null,
        ...(editingGroup && { status: values.status }),
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        message.error(data.error || 'Xatolik yuz berdi')
        return
      }

      message.success(
        editingGroup
          ? 'Guruh muvaffaqiyatli yangilandi'
          : 'Guruh muvaffaqiyatli yaratildi'
      )
      setIsModalOpen(false)
      form.resetFields()
      fetchGroups()
    } catch (error) {
      message.error('Xatolik yuz berdi')
      console.error('Error saving group:', error)
    }
  }

  // Guruhni o'chirish
  const handleDelete = (id: string) => {
    Modal.confirm({
      title: 'Guruhni yopish',
      content: 'Haqiqatan ham bu guruhni yopmoqchimisiz?',
      okText: 'Ha',
      cancelText: 'Yo\'q',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token')
          const response = await fetch(`/api/groups/${id}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!response.ok) throw new Error('Failed to delete')

          message.success('Guruh yopildi')
          fetchGroups()
        } catch (error) {
          message.error('Guruhni yopishda xatolik')
        }
      },
    })
  }

  // Dars kunlarini formatlash
  const formatScheduleDays = (days?: string) => {
    if (!days) return '-'
    const dayValues = days.split(',')
    return dayValues.map((d) => {
      const day = DAYS_OF_WEEK.find((dw) => dw.value === d)
      return day?.label || d
    }).join(', ')
  }

  // Status config
  const getStatusConfig = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      ACTIVE: { color: 'green', text: 'Aktiv' },
      COMPLETED: { color: 'blue', text: 'Tugallangan' },
      CANCELLED: { color: 'red', text: 'Yopilgan' },
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
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">Guruhlar</h2>
            <p className="text-xs md:text-sm text-gray-600">
              Jami: {pagination.total} ta guruh
            </p>
          </div>
          {canCreateGroup && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => showModal()}
              size="large"
              className="w-full sm:w-auto h-11 md:h-10 text-base touch-manipulation"
            >
              Yangi guruh
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

      {/* Groups List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : groups.length === 0 ? (
        <Empty
          description="Guruhlar topilmadi"
          className="py-12"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {canCreateGroup && (
            <Button type="primary" onClick={() => showModal()}>
              Guruh yaratish
            </Button>
          )}
        </Empty>
      ) : (
        <>
          <div className="space-y-3">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="shadow-sm hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50 touch-manipulation"
                styles={{ body: { padding: '12px 16px' } }}
                onClick={() => router.push(`/dashboard/groups/${group.id}`)}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Guruh nomi */}
                    <div className="flex items-center gap-2 mb-1">
                      <TeamOutlined className="text-orange-500" />
                      <div className="font-semibold text-gray-900 text-base truncate">
                        {group.name}
                      </div>
                    </div>

                    {/* Kurs */}
                    <div className="text-xs text-gray-500 truncate mb-2">
                      {group.course.name}
                    </div>

                    {/* O'qituvchi */}
                    <div className="text-sm text-gray-700 mb-2">
                      {group.teacher.lastName} {group.teacher.firstName}
                    </div>

                    {/* Jadval */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <CalendarOutlined />
                        {formatScheduleDays(group.scheduleDays)}
                      </span>
                      {(group.startTime || group.endTime) && (
                        <span className="flex items-center gap-1">
                          <ClockCircleOutlined />
                          {group.startTime || '--:--'} - {group.endTime || '--:--'}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Tag color={getStatusConfig(group.status).color} className="text-xs">
                        {getStatusConfig(group.status).text}
                      </Tag>
                      <Tag color="blue" className="text-xs">
                        <TeamOutlined /> {group._count.groupStudents} ta
                      </Tag>
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
                        router.push(`/dashboard/groups/${group.id}`)
                      }}
                      className="h-8 px-2"
                    />
                    {canEditGroup && (
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          showModal(group)
                        }}
                        className="h-8 px-2"
                      />
                    )}
                    {canDeleteGroup && group.status === 'ACTIVE' && (
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(group.id)
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
                  fetchGroups(page)
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
              <Option value="COMPLETED">Tugallangan</Option>
              <Option value="CANCELLED">Yopilgan</Option>
            </Select>
          </div>
        </div>
      </MobileModal>

      {/* Create/Edit Group Modal */}
      <MobileModal
        open={isModalOpen}
        onClose={handleCancel}
        title={
          <span className="flex items-center gap-2">
            <TeamOutlined />
            {editingGroup ? 'Guruhni tahrirlash' : 'Yangi guruh yaratish'}
          </span>
        }
        width={800}
        footer={
          <div className="flex gap-3">
            <Button block size="large" onClick={handleCancel} className="h-12">
              Bekor qilish
            </Button>
            <Button block type="primary" size="large" onClick={() => form.submit()} className="h-12">
              {editingGroup ? 'Saqlash' : 'Yaratish'}
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
            label="Guruh nomi"
            name="name"
            rules={[{ required: true, message: 'Guruh nomini kiriting' }]}
          >
            <Input placeholder="Ingliz tili Beginner A1" size="large" className="h-12" style={{ fontSize: '16px' }} />
          </Form.Item>

          <Form.Item
            label="Kurs"
            name="courseId"
            rules={[{ required: true, message: 'Kurs tanlang' }]}
          >
            <Select
              placeholder="Kurs tanlang"
              onChange={handleCourseChange}
              showSearch
              optionFilterProp="children"
              size="large"
              style={{ height: 48 }}
            >
              {courses.map((course) => (
                <Option key={course.id} value={course.id}>
                  {course.name} {course.level && `(${course.level})`}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="O'qituvchi"
            name="teacherId"
            rules={[{ required: true, message: 'O\'qituvchi tanlang' }]}
          >
            <Select
              placeholder="O'qituvchi tanlang"
              showSearch
              optionFilterProp="children"
              size="large"
              style={{ height: 48 }}
            >
              {filteredTeachers.map((teacher) => (
                <Option key={teacher.id} value={teacher.id}>
                  {teacher.lastName} {teacher.firstName}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Dars kunlari" name="scheduleDays">
            <Checkbox.Group className="w-full">
              <div className="grid grid-cols-4 gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <Checkbox key={day.value} value={day.value} className="!ml-0">
                    <span className="text-sm">{day.label}</span>
                  </Checkbox>
                ))}
              </div>
            </Checkbox.Group>
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="Boshlanish soati" name="startTime">
              <TimePicker
                format="HH:mm"
                style={{ width: '100%', height: 48 }}
                size="large"
                placeholder="09:00"
                inputReadOnly
              />
            </Form.Item>
            <Form.Item label="Tugash soati" name="endTime">
              <TimePicker
                format="HH:mm"
                style={{ width: '100%', height: 48 }}
                size="large"
                placeholder="11:00"
                inputReadOnly
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              label="Boshlanish sanasi"
              name="startDate"
              rules={[{ required: true, message: 'Sanani tanlang' }]}
            >
              <DatePicker
                style={{ width: '100%', height: 48 }}
                format="DD.MM.YYYY"
                size="large"
                inputReadOnly
              />
            </Form.Item>
            <Form.Item label="Narxi (so'm)" name="price">
              <InputNumber
                style={{ width: '100%' }}
                className="h-12"
                size="large"
                min={0}
                formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}
                parser={(value) => value!.replace(/\s/g, '') as any}
                placeholder="500000"
              />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="Xona raqami" name="roomNumber">
              <Input placeholder="A-101" size="large" className="h-12" style={{ fontSize: '16px' }} />
            </Form.Item>
            <Form.Item label="Filial" name="branch">
              <Input placeholder="Asosiy filial" size="large" className="h-12" style={{ fontSize: '16px' }} />
            </Form.Item>
          </div>

          {editingGroup && (
            <Form.Item label="Status" name="status">
              <Select size="large" style={{ height: 48 }}>
                <Option value="ACTIVE">Aktiv</Option>
                <Option value="COMPLETED">Tugallangan</Option>
                <Option value="CANCELLED">Yopilgan</Option>
              </Select>
            </Form.Item>
          )}
        </Form>
      </MobileModal>
    </DashboardLayout>
  )
}
