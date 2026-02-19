'use client'

import { useState, useEffect } from 'react'
import { Card, Form, Input, Button, message, Spin, Descriptions, Tag, Modal, Divider } from 'antd'
import { UserOutlined, LockOutlined, PhoneOutlined, MailOutlined, CalendarOutlined, EditOutlined } from '@ant-design/icons'
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
  student?: {
    id: string
    firstName: string
    lastName: string
    phone: string
    parentPhone?: string
    dateOfBirth?: string
    gender?: string
    status: string
  }
  teacher?: {
    id: string
    firstName: string
    lastName: string
    phone: string
    specialization?: string
    salary?: number
    status: string
  }
}

export default function MyProfilePage() {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      // localStorage'dan user ma'lumotlarini olish
      const userData = localStorage.getItem('user')
      if (!userData) return

      const user = JSON.parse(userData)
      const token = localStorage.getItem('token')

      // API'dan to'liq profile olish
      const res = await fetch(`/api/users/${user.userId || user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (res.ok) {
        const data = await res.json()
        setProfile(data.user)
      }
    } catch (error) {
      console.error('Profile fetch error:', error)
      message.error('Profil ma\'lumotlarini yuklashda xatolik')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async (values: any) => {
    setChangingPassword(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/users/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      })

      const data = await res.json()

      if (res.ok) {
        message.success('Parol muvaffaqiyatli o\'zgartirildi')
        setPasswordModalOpen(false)
        form.resetFields()
      } else {
        message.error(data.error || 'Parolni o\'zgartirishda xatolik')
      }
    } catch (error) {
      console.error('Change password error:', error)
      message.error('Parolni o\'zgartirishda xatolik')
    } finally {
      setChangingPassword(false)
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

  const isTeacher = profile.role === 'TEACHER'
  const isStudent = profile.role === 'STUDENT'
  const person = isTeacher ? profile.teacher : isStudent ? profile.student : null

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Mening Profilim</h1>
            <p className="text-gray-500 text-sm">Shaxsiy ma'lumotlaringiz</p>
          </div>
          <Button
            type="primary"
            icon={<LockOutlined />}
            onClick={() => setPasswordModalOpen(true)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            Parolni o'zgartirish
          </Button>
        </div>

        {/* Profile Card */}
        <Card className="shadow-sm">
          <div className="flex flex-col md:flex-row gap-6">
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
                {person ? `${person.firstName} ${person.lastName}` : profile.fullName || profile.username}
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
                  <span className="font-medium">{person?.phone || profile.phone || '-'}</span>
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
        </Card>

        {/* Additional Info for Teacher/Student */}
        {isTeacher && profile.teacher && (
          <Card title="O'qituvchi ma'lumotlari" className="shadow-sm">
            <Descriptions
              column={{ xs: 1, sm: 2 }}
              size="small"
              labelStyle={{ fontWeight: 500, color: '#6b7280' }}
            >
              <Descriptions.Item label="Mutaxassislik">
                {profile.teacher.specialization || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Oylik maosh">
                {profile.teacher.salary ? `${profile.teacher.salary.toLocaleString()} so'm` : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Holat">
                <Tag color={profile.teacher.status === 'ACTIVE' ? 'green' : 'orange'}>
                  {profile.teacher.status === 'ACTIVE' ? 'Faol' : profile.teacher.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {isStudent && profile.student && (
          <Card title="Talaba ma'lumotlari" className="shadow-sm">
            <Descriptions
              column={{ xs: 1, sm: 2 }}
              size="small"
              labelStyle={{ fontWeight: 500, color: '#6b7280' }}
            >
              <Descriptions.Item label="Ota-ona telefoni">
                {profile.student.parentPhone || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Tug'ilgan sana">
                {profile.student.dateOfBirth
                  ? new Date(profile.student.dateOfBirth).toLocaleDateString('uz-UZ')
                  : '-'
                }
              </Descriptions.Item>
              <Descriptions.Item label="Jinsi">
                {profile.student.gender === 'MALE' ? 'Erkak' : profile.student.gender === 'FEMALE' ? 'Ayol' : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Holat">
                <Tag color={profile.student.status === 'ACTIVE' ? 'green' : 'orange'}>
                  {profile.student.status === 'ACTIVE' ? 'Faol' : profile.student.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </div>

      {/* Password Change Modal */}
      <Modal
        title="Parolni o'zgartirish"
        open={passwordModalOpen}
        onCancel={() => {
          setPasswordModalOpen(false)
          form.resetFields()
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleChangePassword}
        >
          <Form.Item
            name="currentPassword"
            label="Joriy parol"
            rules={[{ required: true, message: 'Joriy parolni kiriting' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Joriy parolingiz"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="Yangi parol"
            rules={[
              { required: true, message: 'Yangi parolni kiriting' },
              { min: 6, message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Yangi parol"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Parolni tasdiqlang"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Parolni tasdiqlang' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Parollar mos emas'))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Parolni qayta kiriting"
              size="large"
            />
          </Form.Item>

          <div className="flex gap-2 justify-end mt-6">
            <Button onClick={() => {
              setPasswordModalOpen(false)
              form.resetFields()
            }}>
              Bekor qilish
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={changingPassword}
              className="bg-orange-500 hover:bg-orange-600"
            >
              O'zgartirish
            </Button>
          </div>
        </Form>
      </Modal>
    </DashboardLayout>
  )
}
