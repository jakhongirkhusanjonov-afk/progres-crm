'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Spin,
  Descriptions,
  Tag,
  Divider,
  Tabs,
} from 'antd'
import {
  UserOutlined,
  LockOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import DashboardLayout from '@/components/DashboardLayout'
import { ROLE_LABELS, ROLE_COLORS, Role } from '@/lib/permissions'

interface UserProfile {
  id: string
  username: string
  fullName: string
  email?: string
  phone?: string
  role: string
  isActive: boolean
  lastLogin?: string
  createdAt: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  // Password change state
  const [passwordForm] = Form.useForm()
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const userData = localStorage.getItem('user')
      if (!userData) {
        router.push('/login')
        return
      }

      const user = JSON.parse(userData)
      const token = localStorage.getItem('token')

      const res = await fetch(`/api/users/${user.userId || user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setProfile(data.user)
      } else {
        message.error('Profil ma\'lumotlarini yuklashda xatolik')
      }
    } catch (error) {
      console.error('Profile fetch error:', error)
      message.error('Profil ma\'lumotlarini yuklashda xatolik')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Parollar mos kelmaydi')
      return
    }

    setPasswordLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/users/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        message.success('Parol muvaffaqiyatli o\'zgartirildi!')
        passwordForm.resetFields()
        setShowCurrentPassword(false)
        setShowNewPassword(false)
        setShowConfirmPassword(false)
      } else {
        message.error(data.error || 'Parolni o\'zgartirishda xatolik')
      }
    } catch (error) {
      console.error('Change password error:', error)
      message.error('Parolni o\'zgartirishda xatolik')
    } finally {
      setPasswordLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('uz-UZ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Spin size="large" />
        </div>
      </DashboardLayout>
    )
  }

  if (!profile) {
    return (
      <DashboardLayout>
        <div className="text-center py-8">
          <p className="text-gray-500">Profil topilmadi</p>
        </div>
      </DashboardLayout>
    )
  }

  const tabItems = [
    {
      key: 'profile',
      label: (
        <span>
          <UserOutlined /> Profil
        </span>
      ),
      children: (
        <div>
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-orange-100 rounded-full flex items-center justify-center">
                <UserOutlined className="text-4xl md:text-5xl text-orange-500" />
              </div>
              <Tag
                color={ROLE_COLORS[profile.role as Role]}
                className="mt-3 text-sm"
              >
                {ROLE_LABELS[profile.role as Role] || profile.role}
              </Tag>
            </div>

            {/* Info */}
            <div className="flex-1">
              <h2 className="text-xl md:text-2xl font-semibold mb-4">
                {profile.fullName || profile.username}
              </h2>

              <Descriptions
                column={{ xs: 1, sm: 2 }}
                size="small"
                labelStyle={{ fontWeight: 500, color: '#6b7280' }}
              >
                <Descriptions.Item label="Username">
                  <span className="font-medium">{profile.username}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Telefon">
                  <span className="font-medium">{profile.phone || '-'}</span>
                </Descriptions.Item>
                {profile.email && (
                  <Descriptions.Item label="Email">
                    <span className="font-medium">{profile.email}</span>
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Holat">
                  <Tag color={profile.isActive ? 'green' : 'red'}>
                    {profile.isActive ? 'Aktiv' : 'Bloklangan'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Oxirgi kirish">
                  {formatDate(profile.lastLogin)}
                </Descriptions.Item>
                <Descriptions.Item label="Ro'yxatdan o'tgan">
                  {formatDate(profile.createdAt)}
                </Descriptions.Item>
              </Descriptions>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'password',
      label: (
        <span>
          <LockOutlined /> Parolni o'zgartirish
        </span>
      ),
      children: (
        <div className="max-w-md">
          <div className="mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <SafetyCertificateOutlined className="text-orange-500" />
              Xavfsizlik
            </h3>
            <p className="text-gray-500 text-sm mt-1">
              Parolingizni xavfsiz saqlash uchun uni vaqti-vaqti bilan o'zgartiring
            </p>
          </div>

          <Form
            form={passwordForm}
            layout="vertical"
            onFinish={handleChangePassword}
          >
            <Form.Item
              name="currentPassword"
              label="Joriy parol"
              rules={[{ required: true, message: 'Joriy parolni kiriting' }]}
            >
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Joriy parolingizni kiriting"
                prefix={<LockOutlined className="text-gray-400" />}
                size="large"
                suffix={
                  <Button
                    type="text"
                    size="small"
                    icon={showCurrentPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="newPassword"
              label="Yangi parol"
              rules={[
                { required: true, message: 'Yangi parolni kiriting' },
                { min: 6, message: 'Parol kamida 6 belgidan iborat bo\'lishi kerak' },
              ]}
            >
              <Input
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Yangi parolni kiriting"
                prefix={<LockOutlined className="text-gray-400" />}
                size="large"
                suffix={
                  <Button
                    type="text"
                    size="small"
                    icon={showNewPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  />
                }
              />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Yangi parolni tasdiqlash"
              dependencies={['newPassword']}
              rules={[
                { required: true, message: 'Parolni tasdiqlang' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('newPassword') === value) {
                      return Promise.resolve()
                    }
                    return Promise.reject(new Error('Parollar mos kelmaydi'))
                  },
                }),
              ]}
            >
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Yangi parolni qayta kiriting"
                prefix={<LockOutlined className="text-gray-400" />}
                size="large"
                suffix={
                  <Button
                    type="text"
                    size="small"
                    icon={showConfirmPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  />
                }
              />
            </Form.Item>

            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg mb-6">
              <div className="font-medium text-orange-800 mb-2">Parol talablari:</div>
              <ul className="text-sm text-orange-700 list-disc ml-4 space-y-1">
                <li>Kamida 6 ta belgidan iborat bo'lishi kerak</li>
                <li>Xavfsizlik uchun harflar, raqamlar va belgilar aralash tavsiya qilinadi</li>
              </ul>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={passwordLoading}
                icon={<LockOutlined />}
                size="large"
                className="bg-orange-500 hover:bg-orange-600"
              >
                Parolni o'zgartirish
              </Button>
            </Form.Item>
          </Form>
        </div>
      ),
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <SettingOutlined className="text-orange-500" />
            Sozlamalar
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Profil va xavfsizlik sozlamalari
          </p>
        </div>

        {/* Settings Card */}
        <Card className="shadow-sm">
          <Tabs items={tabItems} defaultActiveKey="profile" />
        </Card>
      </div>
    </DashboardLayout>
  )
}
