'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import MobileModal from '@/components/MobileModal'
import {
  Card,
  Button,
  Input,
  Select,
  Tag,
  message,
  Empty,
  Spin,
  Pagination,
  Switch,
  Modal,
  Form,
  Divider,
} from 'antd'
import {
  SearchOutlined,
  UserOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
  CopyOutlined,
  PlusOutlined,
  FilterOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'

const { Option } = Select

interface User {
  id: string
  username: string
  fullName: string | null
  email: string | null
  phone: string | null
  role: string
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  displayName: string
  linkedEntity: string | null
  linkedId: string | null
}

// Role labels va ranglar
const ROLE_CONFIG: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'red' },
  ADMIN: { label: 'Admin', color: 'orange' },
  MANAGER: { label: 'Menejer', color: 'purple' },
  ACCOUNTANT: { label: 'Buxgalter', color: 'cyan' },
  TEACHER: { label: "O'qituvchi", color: 'blue' },
  STUDENT: { label: 'Talaba', color: 'green' },
}

export default function UsersPage() {
  const router = useRouter()
  const [form] = Form.useForm()

  // State
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })

  // Password modal
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [passwordData, setPasswordData] = useState<{
    username: string
    password: string
    role: string
    displayName: string
  } | null>(null)
  const [loadingPassword, setLoadingPassword] = useState(false)

  // Admin qo'shish modal
  const [addAdminModalOpen, setAddAdminModalOpen] = useState(false)
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [newCredentials, setNewCredentials] = useState<{ username: string; password: string } | null>(null)

  // Check if current user is SUPER_ADMIN
  useEffect(() => {
    const checkAccess = () => {
      try {
        const token = localStorage.getItem('token')
        if (!token) {
          router.push('/login')
          return false
        }

        // Token'dan role olish (simple decode)
        const payload = JSON.parse(atob(token.split('.')[1]))
        if (payload.role !== 'SUPER_ADMIN') {
          message.error('Bu sahifaga kirishga ruxsat yo\'q')
          router.push('/dashboard')
          return false
        }
        return true
      } catch {
        router.push('/login')
        return false
      }
    }

    if (checkAccess()) {
      fetchUsers(1)
    }
  }, [])

  // Users yuklash
  const fetchUsers = async (page = pagination.page) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const params = new URLSearchParams()
      if (searchText) params.append('search', searchText)
      if (roleFilter) params.append('role', roleFilter)
      if (statusFilter) params.append('status', statusFilter)
      params.append('page', page.toString())
      params.append('limit', pagination.limit.toString())

      const response = await fetch(`/api/users?${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.status === 403) {
        message.error('Bu sahifaga kirishga ruxsat yo\'q')
        router.push('/dashboard')
        return
      }

      if (!response.ok) throw new Error('Failed to fetch')

      const data = await response.json()
      setUsers(data.users)
      setPagination(data.pagination)
    } catch (error) {
      message.error('Foydalanuvchilarni yuklashda xatolik')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchText, roleFilter, statusFilter])

  // Parolni ko'rish
  const handleViewPassword = async (user: User) => {
    setSelectedUser(user)
    setPasswordModalOpen(true)
    setLoadingPassword(true)
    setPasswordData(null)

    try {
      const token = localStorage.getItem('token')

      if (!token) {
        message.error('Avtorizatsiya talab qilinadi. Qaytadan kiring.')
        router.push('/login')
        return
      }

      console.log('Requesting password for user:', user.id)
      console.log('Token exists:', !!token)

      const response = await fetch(`/api/users/${user.id}/password`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Cookie'larni ham yuborish
      })

      const data = await response.json()
      console.log('Password API response:', response.status, data)

      if (!response.ok) {
        // API'dan kelgan xatolik xabarini ko'rsatish
        if (response.status === 401) {
          message.error(data.error || 'Avtorizatsiya talab qilinadi')
          console.log('Debug info:', data.debug)
        } else if (response.status === 403) {
          message.error(data.error || 'Ruxsat yo\'q')
        } else {
          message.error(data.error || 'Parolni olishda xatolik')
        }
        return
      }

      setPasswordData(data)
    } catch (error) {
      message.error('Parolni olishda xatolik: ' + (error instanceof Error ? error.message : 'Unknown'))
      console.error('Password fetch error:', error)
    } finally {
      setLoadingPassword(false)
    }
  }

  // User statusini o'zgartirish (block/unblock)
  const handleToggleStatus = (user: User) => {
    Modal.confirm({
      title: user.isActive ? 'Foydalanuvchini bloklash' : 'Foydalanuvchini aktivlashtirish',
      icon: <ExclamationCircleOutlined />,
      content: user.isActive
        ? 'Bu foydalanuvchi tizimga kira olmaydi. Davom etasizmi?'
        : 'Bu foydalanuvchi yana tizimga kira oladi. Davom etasizmi?',
      okText: 'Ha',
      cancelText: 'Yo\'q',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token')
          const response = await fetch(`/api/users/${user.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ isActive: !user.isActive }),
          })

          if (!response.ok) throw new Error('Failed to update')

          message.success(user.isActive ? 'Foydalanuvchi bloklandi' : 'Foydalanuvchi aktivlashtirildi')
          fetchUsers()
        } catch (error) {
          message.error('Xatolik yuz berdi')
        }
      },
    })
  }

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    message.success('Nusxalandi!')
  }

  // Admin qo'shish
  const handleAddAdmin = async (values: any) => {
    setAddingAdmin(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/users', {
        method: 'POST',
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

      setNewCredentials(data.credentials)
      message.success('Admin muvaffaqiyatli qo\'shildi')
      form.resetFields()
      fetchUsers()
    } catch (error) {
      message.error('Xatolik yuz berdi')
    } finally {
      setAddingAdmin(false)
    }
  }

  // Filterlarni tozalash
  const clearFilters = () => {
    setRoleFilter('')
    setStatusFilter('')
    setSearchText('')
    setIsFilterOpen(false)
  }

  const hasActiveFilters = roleFilter || statusFilter

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              <UserOutlined className="mr-2" />
              Foydalanuvchilar
            </h2>
            <p className="text-xs md:text-sm text-gray-600">
              Jami: {pagination.total} ta foydalanuvchi
            </p>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setNewCredentials(null)
              setAddAdminModalOpen(true)
            }}
            size="large"
            className="w-full sm:w-auto h-11 md:h-10 text-base touch-manipulation"
          >
            Admin qo'shish
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

        {/* Active filters */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2">
            {roleFilter && (
              <Tag closable onClose={() => setRoleFilter('')} className="text-sm py-1">
                Role: {ROLE_CONFIG[roleFilter]?.label}
              </Tag>
            )}
            {statusFilter && (
              <Tag closable onClose={() => setStatusFilter('')} className="text-sm py-1">
                Status: {statusFilter === 'active' ? 'Aktiv' : 'Bloklangan'}
              </Tag>
            )}
            <Button type="link" size="small" onClick={clearFilters}>
              Tozalash
            </Button>
          </div>
        )}
      </div>

      {/* Users List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : users.length === 0 ? (
        <Empty
          description="Foydalanuvchilar topilmadi"
          className="py-12"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
          <div className="space-y-3">
            {users.map((user) => (
              <Card
                key={user.id}
                className="shadow-sm hover:shadow-md transition-shadow touch-manipulation"
                styles={{ body: { padding: '12px 16px' } }}
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0 flex-1">
                    {/* Avatar va ism */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          user.isActive ? 'bg-blue-100' : 'bg-gray-100'
                        }`}
                      >
                        <UserOutlined
                          className={`text-lg ${user.isActive ? 'text-blue-500' : 'text-gray-400'}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-base truncate">
                          {user.displayName}
                        </div>
                        <div className="text-xs text-gray-500">@{user.username}</div>
                      </div>
                    </div>

                    {/* Telefon va email */}
                    {(user.phone || user.email) && (
                      <div className="text-xs text-gray-500 mb-2">
                        {user.phone && <span>{user.phone}</span>}
                        {user.phone && user.email && <span> | </span>}
                        {user.email && <span>{user.email}</span>}
                      </div>
                    )}

                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag color={ROLE_CONFIG[user.role]?.color || 'default'} className="text-xs">
                        {ROLE_CONFIG[user.role]?.label || user.role}
                      </Tag>
                      <Tag
                        color={user.isActive ? 'green' : 'red'}
                        icon={user.isActive ? <UnlockOutlined /> : <LockOutlined />}
                        className="text-xs"
                      >
                        {user.isActive ? 'Aktiv' : 'Bloklangan'}
                      </Tag>
                    </div>

                    {/* Last login */}
                    {user.lastLogin && (
                      <div className="text-xs text-gray-400 mt-1">
                        Oxirgi kirish: {new Date(user.lastLogin).toLocaleString('uz-UZ')}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => handleViewPassword(user)}
                      className="h-8 px-2"
                      title="Parolni ko'rish"
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={user.isActive ? <LockOutlined /> : <UnlockOutlined />}
                      onClick={() => handleToggleStatus(user)}
                      className={`h-8 px-2 ${user.isActive ? 'text-red-500' : 'text-green-500'}`}
                      title={user.isActive ? 'Bloklash' : 'Aktivlashtirish'}
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
                  fetchUsers(page)
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
            <Button
              block
              type="primary"
              size="large"
              onClick={() => setIsFilterOpen(false)}
              className="h-12"
            >
              Qo'llash
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <Select
              placeholder="Tanlang"
              allowClear
              size="large"
              value={roleFilter || undefined}
              onChange={(value) => setRoleFilter(value || '')}
              className="w-full"
              style={{ height: 48 }}
            >
              {Object.entries(ROLE_CONFIG).map(([key, config]) => (
                <Option key={key} value={key}>
                  {config.label}
                </Option>
              ))}
            </Select>
          </div>
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
              <Option value="active">Aktiv</Option>
              <Option value="blocked">Bloklangan</Option>
            </Select>
          </div>
        </div>
      </MobileModal>

      {/* Password View Modal */}
      <MobileModal
        open={passwordModalOpen}
        onClose={() => {
          setPasswordModalOpen(false)
          setPasswordData(null)
          setSelectedUser(null)
        }}
        title={
          <span className="flex items-center gap-2">
            <LockOutlined />
            Parol ma'lumoti
          </span>
        }
        footer={
          <Button
            block
            size="large"
            onClick={() => {
              setPasswordModalOpen(false)
              setPasswordData(null)
            }}
            className="h-12"
          >
            Yopish
          </Button>
        }
      >
        {loadingPassword ? (
          <div className="flex justify-center py-8">
            <Spin />
          </div>
        ) : passwordData ? (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Foydalanuvchi</div>
                  <div className="font-medium">{passwordData.displayName}</div>
                </div>
                <Divider className="!my-2" />
                <div>
                  <div className="text-xs text-gray-500 mb-1">Login (username)</div>
                  <div className="flex items-center justify-between">
                    <code className="text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      {passwordData.username}
                    </code>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(passwordData.username)}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Parol</div>
                  <div className="flex items-center justify-between">
                    <code className="text-green-600 bg-green-50 px-2 py-1 rounded">
                      {passwordData.password}
                    </code>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(passwordData.password)}
                    />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Role</div>
                  <Tag color={ROLE_CONFIG[passwordData.role]?.color || 'default'}>
                    {ROLE_CONFIG[passwordData.role]?.label || passwordData.role}
                  </Tag>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <ExclamationCircleOutlined className="text-yellow-600 mt-0.5" />
                <div className="text-xs text-yellow-700">
                  Bu maxfiy ma'lumot! Faqat tegishli shaxsga ulashing.
                </div>
              </div>
            </div>
            <Button
              block
              icon={<CopyOutlined />}
              onClick={() =>
                copyToClipboard(`Login: ${passwordData.username}\nParol: ${passwordData.password}`)
              }
              className="h-10"
            >
              Hammasini nusxalash
            </Button>
          </div>
        ) : (
          <Empty description="Ma'lumot topilmadi" />
        )}
      </MobileModal>

      {/* Add Admin Modal */}
      <MobileModal
        open={addAdminModalOpen}
        onClose={() => {
          setAddAdminModalOpen(false)
          setNewCredentials(null)
          form.resetFields()
        }}
        title={
          <span className="flex items-center gap-2">
            <PlusOutlined />
            Yangi admin qo'shish
          </span>
        }
        footer={
          newCredentials ? (
            <Button
              block
              type="primary"
              size="large"
              onClick={() => {
                setAddAdminModalOpen(false)
                setNewCredentials(null)
                form.resetFields()
              }}
              className="h-12"
            >
              Yopish
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                block
                size="large"
                onClick={() => {
                  setAddAdminModalOpen(false)
                  form.resetFields()
                }}
                className="h-12"
              >
                Bekor qilish
              </Button>
              <Button
                block
                type="primary"
                size="large"
                onClick={() => form.submit()}
                loading={addingAdmin}
                className="h-12"
              >
                Qo'shish
              </Button>
            </div>
          )
        }
      >
        {newCredentials ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <div className="text-green-600 font-medium mb-2">Admin muvaffaqiyatli qo'shildi!</div>
              <div className="text-sm text-gray-600">
                Quyidagi ma'lumotlarni saqlab qo'ying:
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Login</div>
                <div className="flex items-center justify-between">
                  <code className="text-blue-600 bg-blue-50 px-2 py-1 rounded">
                    {newCredentials.username}
                  </code>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(newCredentials.username)}
                  />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Parol</div>
                <div className="flex items-center justify-between">
                  <code className="text-green-600 bg-green-50 px-2 py-1 rounded">
                    {newCredentials.password}
                  </code>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(newCredentials.password)}
                  />
                </div>
              </div>
            </div>
            <Button
              block
              icon={<CopyOutlined />}
              onClick={() =>
                copyToClipboard(
                  `Login: ${newCredentials.username}\nParol: ${newCredentials.password}`
                )
              }
              className="h-10"
            >
              Hammasini nusxalash
            </Button>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            onFinish={handleAddAdmin}
            requiredMark={false}
            initialValues={{ role: 'ADMIN' }}
          >
            <Form.Item
              label="Username"
              name="username"
              rules={[
                { required: true, message: 'Username kiriting' },
                {
                  pattern: /^[a-z0-9_\.]+$/,
                  message: 'Faqat kichik harflar, raqamlar, _ va .',
                },
              ]}
            >
              <Input
                placeholder="admin.user"
                size="large"
                className="h-12"
                style={{ fontSize: '16px' }}
              />
            </Form.Item>

            <Form.Item
              label="Parol"
              name="password"
              rules={[
                { required: true, message: 'Parol kiriting' },
                { min: 6, message: 'Kamida 6 ta belgi' },
              ]}
            >
              <Input.Password
                placeholder="Kamida 6 ta belgi"
                size="large"
                className="h-12"
                style={{ fontSize: '16px' }}
              />
            </Form.Item>

            <Form.Item label="To'liq ism" name="fullName">
              <Input
                placeholder="Ism Familiya"
                size="large"
                className="h-12"
                style={{ fontSize: '16px' }}
              />
            </Form.Item>

            <Form.Item label="Email" name="email">
              <Input
                placeholder="email@example.com"
                type="email"
                size="large"
                className="h-12"
                style={{ fontSize: '16px' }}
              />
            </Form.Item>

            <Form.Item label="Telefon" name="phone">
              <Input
                placeholder="+998901234567"
                type="tel"
                size="large"
                className="h-12"
                style={{ fontSize: '16px' }}
              />
            </Form.Item>

            <Form.Item
              label="Role"
              name="role"
              rules={[{ required: true, message: 'Role tanlang' }]}
            >
              <Select size="large" style={{ height: 48 }}>
                <Option value="ADMIN">Admin</Option>
                <Option value="MANAGER">Menejer</Option>
                <Option value="ACCOUNTANT">Buxgalter</Option>
              </Select>
            </Form.Item>
          </Form>
        )}
      </MobileModal>
    </DashboardLayout>
  )
}
