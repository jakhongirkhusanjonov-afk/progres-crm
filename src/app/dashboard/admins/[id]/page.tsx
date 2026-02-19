'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Card,
  Button,
  message,
  Spin,
  Tag,
  Descriptions,
  Modal,
  Form,
  Input,
  Typography,
} from 'antd'
import {
  ArrowLeftOutlined,
  SafetyCertificateOutlined,
  EditOutlined,
  LockOutlined,
  UnlockOutlined,
  DeleteOutlined,
  UserOutlined,
  PhoneOutlined,
  MailOutlined,
  CalendarOutlined,
  ExclamationCircleOutlined,
  SaveOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

interface Admin {
  id: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    username: string
    isActive: boolean
    lastLogin?: string
    role: string
    createdAt: string
  }
}

export default function AdminProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [form] = Form.useForm()

  const [admin, setAdmin] = useState<Admin | null>(null)
  const [loading, setLoading] = useState(true)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userRole, setUserRole] = useState<string>('')

  // Check user role
  useEffect(() => {
    const userData = localStorage.getItem('user')
    if (userData) {
      const user = JSON.parse(userData)
      setUserRole(user.role)

      if (user.role !== 'SUPER_ADMIN') {
        message.error('Sizda bu sahifaga kirish huquqi yo\'q')
        router.push('/dashboard')
      }
    }
  }, [router])

  // Admin ma'lumotlarini yuklash
  const fetchAdmin = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch(`/api/admins/${id}`, {
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
        if (response.status === 404) {
          message.error('Admin topilmadi')
          router.push('/dashboard/admins')
          return
        }
        throw new Error('Failed to fetch')
      }

      const data = await response.json()
      setAdmin(data.admin)
    } catch (error) {
      message.error('Ma\'lumotlarni yuklashda xatolik')
      console.error('Error fetching admin:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (userRole === 'SUPER_ADMIN') {
      fetchAdmin()
    }
  }, [id, userRole])

  // Edit modal ochish
  const openEditModal = () => {
    if (!admin) return
    form.setFieldsValue({
      firstName: admin.firstName,
      lastName: admin.lastName,
      phone: admin.phone,
      email: admin.email,
    })
    setEditModalOpen(true)
  }

  // Admin ma'lumotlarini saqlash
  const handleSave = async (values: any) => {
    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/admins/${id}`, {
        method: 'PUT',
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

      message.success('Ma\'lumotlar saqlandi')
      setEditModalOpen(false)
      fetchAdmin()
    } catch (error) {
      message.error('Xatolik yuz berdi')
    } finally {
      setSaving(false)
    }
  }

  // Status o'zgartirish
  const handleToggleStatus = () => {
    if (!admin?.user) {
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
          const response = await fetch(`/api/admins/${id}`, {
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
          fetchAdmin()
        } catch (error) {
          message.error('Xatolik yuz berdi')
        }
      },
    })
  }

  // O'chirish
  const handleDelete = () => {
    if (!admin) return

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
          const response = await fetch(`/api/admins/${id}`, {
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
          router.push('/dashboard/admins')
        } catch (error) {
          message.error('Adminni o\'chirishda xatolik')
        }
      },
    })
  }

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (userRole && userRole !== 'SUPER_ADMIN') {
    return null
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      </DashboardLayout>
    )
  }

  if (!admin) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <Text type="secondary">Admin topilmadi</Text>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/dashboard/admins')}
          >
            Orqaga
          </Button>
          <Title level={4} className="!mb-0 flex-1">
            <SafetyCertificateOutlined className="mr-2 text-orange-500" />
            Admin profili
          </Title>
        </div>

        {/* Main Info Card */}
        <Card className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 mb-6">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mx-auto sm:mx-0">
              <SafetyCertificateOutlined className="text-orange-500 text-3xl" />
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <Title level={3} className="!mb-1">
                {admin.lastName} {admin.firstName}
              </Title>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                <Tag color="orange">Administrator</Tag>
                {admin.user && (
                  <Tag color={admin.user.isActive ? 'green' : 'red'}>
                    {admin.user.isActive ? 'Faol' : 'Bloklangan'}
                  </Tag>
                )}
              </div>
              {admin.user && (
                <Text type="secondary">
                  <UserOutlined className="mr-1" />
                  @{admin.user.username}
                </Text>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap justify-center sm:justify-end gap-2">
              <Button
                icon={<EditOutlined />}
                onClick={openEditModal}
              >
                Tahrirlash
              </Button>
              {admin.user && (
                <Button
                  icon={admin.user.isActive ? <LockOutlined /> : <UnlockOutlined />}
                  onClick={handleToggleStatus}
                  className={admin.user.isActive ? 'text-orange-500 border-orange-500' : 'text-green-500 border-green-500'}
                >
                  {admin.user.isActive ? 'Bloklash' : 'Faollashtirish'}
                </Button>
              )}
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
              >
                O'chirish
              </Button>
            </div>
          </div>

          <Descriptions
            column={{ xs: 1, sm: 2 }}
            bordered
            size="small"
          >
            <Descriptions.Item label={<><PhoneOutlined className="mr-1" /> Telefon</>}>
              {admin.phone}
            </Descriptions.Item>
            <Descriptions.Item label={<><MailOutlined className="mr-1" /> Email</>}>
              {admin.email || '-'}
            </Descriptions.Item>
            <Descriptions.Item label={<><CalendarOutlined className="mr-1" /> Qo'shilgan sana</>}>
              {formatDate(admin.createdAt)}
            </Descriptions.Item>
            {admin.user && (
              <Descriptions.Item label="Oxirgi kirish">
                {admin.user.lastLogin ? formatDate(admin.user.lastLogin) : 'Hali kirmagan'}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* Login Info Card */}
        {admin.user && (
          <Card title="Login ma'lumotlari" className="mb-4">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="Username">
                @{admin.user.username}
              </Descriptions.Item>
              <Descriptions.Item label="Role">
                <Tag color="orange">Admin</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={admin.user.isActive ? 'green' : 'red'}>
                  {admin.user.isActive ? 'Faol' : 'Bloklangan'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Account yaratilgan">
                {formatDate(admin.user.createdAt)}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </div>

      {/* Edit Modal */}
      <Modal
        title="Admin ma'lumotlarini tahrirlash"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
        centered
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          requiredMark={false}
        >
          <Form.Item
            label="Ism"
            name="firstName"
            rules={[{ required: true, message: 'Ism kiriting' }]}
          >
            <Input size="large" />
          </Form.Item>

          <Form.Item
            label="Familiya"
            name="lastName"
            rules={[{ required: true, message: 'Familiya kiriting' }]}
          >
            <Input size="large" />
          </Form.Item>

          <Form.Item
            label="Telefon"
            name="phone"
            rules={[
              { required: true, message: 'Telefon kiriting' },
              { pattern: /^\+998\d{9}$/, message: '+998XXXXXXXXX formatida' },
            ]}
          >
            <Input size="large" type="tel" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[{ type: 'email', message: 'Email noto\'g\'ri' }]}
          >
            <Input size="large" />
          </Form.Item>

          <div className="flex gap-3 justify-end">
            <Button onClick={() => setEditModalOpen(false)} size="large">
              Bekor qilish
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={saving}
              icon={<SaveOutlined />}
              size="large"
            >
              Saqlash
            </Button>
          </div>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
