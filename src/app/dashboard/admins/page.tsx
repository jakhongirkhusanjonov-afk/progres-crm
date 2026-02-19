'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Button,
  Input,
  Tag,
  Modal,
  message,
  Card,
  Empty,
  Spin,
  Pagination,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined,
  UserOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'

interface Admin {
  id: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  createdAt: string
  user?: {
    id: string
    username: string
    isActive: boolean
    lastLogin?: string
    role: string
  }
}

export default function AdminsPage() {
  const router = useRouter()

  // State
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [userRole, setUserRole] = useState<string>('')
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Check user role
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role)

      // Faqat SUPER_ADMIN ko'ra oladi
      if (user.role !== 'SUPER_ADMIN') {
        message.error('Sizda bu sahifaga kirish huquqi yo\'q')
        router.push('/dashboard')
      }
    }
  }, [router])

  // Adminlarni yuklash
  const fetchAdmins = async (page = pagination.page) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const params = new URLSearchParams()
      if (searchText) params.append('search', searchText)
      params.append('page', page.toString())
      params.append('limit', pagination.limit.toString())

      const response = await fetch(`/api/admins?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 403) {
          message.error('Sizda bu sahifaga kirish huquqi yo\'q')
          router.push('/dashboard')
          return
        }
        throw new Error('Failed to fetch')
      }

      const data = await response.json()
      setAdmins(data.admins)
      setPagination(data.pagination)
    } catch (error) {
      message.error('Adminlarni yuklashda xatolik')
      console.error('Error fetching admins:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userRole === 'SUPER_ADMIN') {
      fetchAdmins(1)
    }
  }, [searchText, userRole])

  // Admin statusini o'zgartirish (block/unblock)
  const handleToggleStatus = (admin: Admin) => {
    if (!admin.user) {
      message.warning('Bu admin uchun user account mavjud emas')
      return
    }

    const action = admin.user.isActive ? 'block' : 'unblock'
    const actionText = admin.user.isActive ? 'bloklash' : 'faollashtirish'

    Modal.confirm({
      title: `Adminni ${actionText}`,
      icon: <ExclamationCircleOutlined />,
      content: `Haqiqatan ham ${admin.firstName} ${admin.lastName}ni ${actionText}moqchimisiz?`,
      okText: 'Ha',
      cancelText: 'Yo\'q',
      okButtonProps: { danger: admin.user.isActive },
      onOk: async () => {
        try {
          const token = localStorage.getItem('token')
          const response = await fetch(`/api/admins/${admin.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ action }),
          })

          const data = await response.json()

          if (!response.ok) {
            message.error(data.error || 'Xatolik yuz berdi')
            return
          }

          message.success(data.message)
          fetchAdmins()
        } catch (error) {
          message.error('Xatolik yuz berdi')
        }
      },
    })
  }

  // Adminni o'chirish
  const handleDelete = (admin: Admin) => {
    Modal.confirm({
      title: 'Adminni o\'chirish',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Haqiqatan ham <strong>{admin.firstName} {admin.lastName}</strong>ni o'chirmoqchimisiz?</p>
          <p className="text-red-500 text-sm mt-2">Bu amalni ortga qaytarib bo'lmaydi!</p>
        </div>
      ),
      okText: 'Ha, o\'chirish',
      cancelText: 'Yo\'q',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const token = localStorage.getItem('token')
          const response = await fetch(`/api/admins/${admin.id}`, {
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

          message.success('Admin muvaffaqiyatli o\'chirildi')
          fetchAdmins()
        } catch (error) {
          message.error('Adminni o\'chirishda xatolik')
        }
      },
    })
  }

  // Faqat SUPER_ADMIN ko'ra oladi
  if (userRole && userRole !== 'SUPER_ADMIN') {
    return null
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <SafetyCertificateOutlined className="text-orange-500" />
              Adminlar
            </h2>
            <p className="text-xs md:text-sm text-gray-600">
              Jami: {pagination.total} ta admin
            </p>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push('/dashboard/admins/new')}
            size="large"
            className="w-full sm:w-auto h-11 md:h-10 text-base touch-manipulation"
          >
            Yangi admin
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Qidirish (ism, familiya, telefon)..."
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
          className="h-11"
          style={{ fontSize: '16px' }}
        />
      </div>

      {/* Admins List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : admins.length === 0 ? (
        <Empty
          description="Adminlar topilmadi"
          className="py-12"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary" onClick={() => router.push('/dashboard/admins/new')}>
            Admin qo'shish
          </Button>
        </Empty>
      ) : (
        <>
          <div className="space-y-3">
            {admins.map((admin, index) => (
              <Card
                key={admin.id}
                className="shadow-sm hover:shadow-md transition-shadow touch-manipulation"
                styles={{ body: { padding: '12px 16px' } }}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Avatar va ism */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                        <span className="text-orange-600 font-bold text-lg">
                          {(pagination.page - 1) * pagination.limit + index + 1}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-base truncate">
                          {admin.lastName} {admin.firstName}
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 text-sm">
                          <PhoneOutlined className="text-xs" />
                          <span>{admin.phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Username va Status */}
                    <div className="flex flex-wrap items-center gap-2">
                      {admin.user ? (
                        <>
                          <Tag color="blue" className="text-xs">
                            <UserOutlined className="mr-1" />
                            {admin.user.username}
                          </Tag>
                          <Tag
                            color={admin.user.isActive ? 'green' : 'red'}
                            className="text-xs"
                          >
                            {admin.user.isActive ? 'Faol' : 'Bloklangan'}
                          </Tag>
                        </>
                      ) : (
                        <Tag color="default" className="text-xs">
                          Login yo'q
                        </Tag>
                      )}
                      <Tag color="orange" className="text-xs">
                        Admin
                      </Tag>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <Tooltip title="Profilni ko'rish">
                      <Button
                        type="text"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => router.push(`/dashboard/admins/${admin.id}`)}
                        className="h-8 px-2"
                      />
                    </Tooltip>
                    {admin.user && (
                      <Tooltip title={admin.user.isActive ? 'Bloklash' : 'Faollashtirish'}>
                        <Button
                          type="text"
                          size="small"
                          icon={admin.user.isActive ? <LockOutlined /> : <UnlockOutlined />}
                          onClick={() => handleToggleStatus(admin)}
                          className={`h-8 px-2 ${admin.user.isActive ? 'text-orange-500' : 'text-green-500'}`}
                        />
                      </Tooltip>
                    )}
                    <Tooltip title="O'chirish">
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDelete(admin)}
                        className="h-8 px-2"
                      />
                    </Tooltip>
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
                  fetchAdmins(page)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                showSizeChanger={false}
                showTotal={(total) => `Jami: ${total}`}
              />
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
