'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Row,
  Col,
  Divider,
  Typography,
  Switch,
  Modal,
  Result,
} from 'antd'
import {
  ArrowLeftOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  KeyOutlined,
  CopyOutlined,
  CheckOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { generatePassword } from '@/lib/crypto-client'

const { Title, Text } = Typography

interface Credentials {
  username: string
  password: string
}

export default function NewAdminPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [createAccount, setCreateAccount] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [copied, setCopied] = useState(false)
  const [userRole, setUserRole] = useState<string>('')

  // Check user role
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      router.push('/login')
      return
    }

    const user = JSON.parse(userData)
    setUserRole(user.role)

    // Faqat SUPER_ADMIN ko'ra oladi
    if (user.role !== 'SUPER_ADMIN') {
      message.error('Sizda bu sahifaga kirish huquqi yo\'q')
      router.push('/dashboard')
    }
  }, [router])

  // Avtomatik parol yaratish
  const handleGeneratePassword = () => {
    const newPassword = generatePassword(8)
    form.setFieldsValue({ password: newPassword })
  }

  // Copy qilish
  const handleCopy = () => {
    if (!credentials) return
    const text = `Login: ${credentials.username}\nParol: ${credentials.password}\nRole: Administrator`
    navigator.clipboard.writeText(text)
    setCopied(true)
    message.success('Nusxa olindi!')
    setTimeout(() => setCopied(false), 2000)
  }

  // Saqlash
  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')

      const response = await fetch('/api/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...values,
          createAccount,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        message.error(data.error || 'Xatolik yuz berdi')
        return
      }

      // Agar credentials qaytarilgan bo'lsa, modalda ko'rsatish
      if (data.credentials) {
        setCredentials(data.credentials)
        setSuccessModalOpen(true)
      } else {
        message.success('Admin muvaffaqiyatli qo\'shildi')
        router.push('/dashboard/admins')
      }
    } catch (error) {
      message.error('Xatolik yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  // Modal yopish va redirect
  const handleModalClose = () => {
    setSuccessModalOpen(false)
    setCredentials(null)
    router.push('/dashboard/admins')
  }

  // Faqat SUPER_ADMIN ko'ra oladi
  if (userRole && userRole !== 'SUPER_ADMIN') {
    return null
  }

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push('/dashboard/admins')}
            >
              Orqaga
            </Button>
            <Title level={4} className="!mb-0">
              <SafetyCertificateOutlined className="mr-2 text-orange-500" />
              Yangi admin qo'shish
            </Title>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            requiredMark={false}
          >
            <Divider>Shaxsiy ma'lumotlar</Divider>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Ism"
                  name="firstName"
                  rules={[{ required: true, message: 'Ism kiriting' }]}
                >
                  <Input
                    placeholder="Aziz"
                    size="large"
                    className="h-12"
                    style={{ fontSize: '16px' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Familiya"
                  name="lastName"
                  rules={[{ required: true, message: 'Familiya kiriting' }]}
                >
                  <Input
                    placeholder="Rahimov"
                    size="large"
                    className="h-12"
                    style={{ fontSize: '16px' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Telefon"
                  name="phone"
                  rules={[
                    { required: true, message: 'Telefon kiriting' },
                    {
                      pattern: /^\+998\d{9}$/,
                      message: '+998XXXXXXXXX formatida',
                    },
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
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[{ type: 'email', message: 'Email noto\'g\'ri' }]}
                >
                  <Input
                    placeholder="admin@example.com"
                    size="large"
                    className="h-12"
                    style={{ fontSize: '16px' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider>
              <span className="flex items-center gap-2">
                <KeyOutlined />
                Tizimga kirish ma'lumotlari
              </span>
            </Divider>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-4">
                <Text>Admin uchun login yaratish</Text>
                <Switch
                  checked={createAccount}
                  onChange={setCreateAccount}
                  checkedChildren="Ha"
                  unCheckedChildren="Yo'q"
                />
              </div>

              {createAccount && (
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Username"
                      name="username"
                      rules={[
                        { required: createAccount, message: 'Username kiriting' },
                        {
                          pattern: /^[a-z0-9_\.]+$/,
                          message: 'Faqat kichik harflar, raqamlar, _ va .',
                        },
                        { min: 3, message: 'Kamida 3 ta belgi' },
                      ]}
                    >
                      <Input
                        placeholder="aziz.rahimov"
                        size="large"
                        className="h-12"
                        style={{ fontSize: '16px' }}
                        prefix={<UserOutlined className="text-gray-400" />}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Parol"
                      name="password"
                      rules={[
                        { required: createAccount, message: 'Parol kiriting' },
                        { min: 6, message: 'Kamida 6 ta belgi' },
                      ]}
                    >
                      <Input.Group compact>
                        <Input
                          style={{ width: 'calc(100% - 90px)' }}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Parol"
                          size="large"
                          className="h-12"
                          prefix={<KeyOutlined className="text-gray-400" />}
                          suffix={
                            <Button
                              type="text"
                              size="small"
                              icon={showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                              onClick={() => setShowPassword(!showPassword)}
                            />
                          }
                        />
                        <Button
                          type="primary"
                          onClick={handleGeneratePassword}
                          size="large"
                          className="h-12"
                          style={{ width: '90px' }}
                        >
                          Yaratish
                        </Button>
                      </Input.Group>
                    </Form.Item>
                  </Col>
                </Row>
              )}

              {!createAccount && (
                <Text type="secondary" className="text-sm">
                  Admin tizimga kira olmaydi. Keyinroq login yaratish mumkin.
                </Text>
              )}
            </div>

            <Divider />

            <div className="flex gap-4">
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
                size="large"
                className="h-12"
              >
                Saqlash
              </Button>
              <Button
                size="large"
                className="h-12"
                onClick={() => router.push('/dashboard/admins')}
              >
                Bekor qilish
              </Button>
            </div>
          </Form>
        </Card>
      </div>

      {/* Success Modal */}
      <Modal
        open={successModalOpen}
        onCancel={handleModalClose}
        footer={null}
        closable={false}
        centered
        width={450}
      >
        <Result
          status="success"
          title="Admin muvaffaqiyatli qo'shildi!"
          subTitle="Quyidagi login ma'lumotlarini admin xodimga yuboring"
        />

        {credentials && (
          <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300 mb-4">
            <div className="flex justify-between items-center mb-2">
              <Text type="secondary">Login:</Text>
              <Text strong copyable>{credentials.username}</Text>
            </div>
            <div className="flex justify-between items-center mb-2">
              <Text type="secondary">Parol:</Text>
              <Text strong copyable>{credentials.password}</Text>
            </div>
            <div className="flex justify-between items-center">
              <Text type="secondary">Role:</Text>
              <Text strong className="text-orange-600">Administrator</Text>
            </div>
          </div>
        )}

        <div className="text-center mb-4">
          <Text type="warning" className="text-sm">
            Bu ma'lumotni admin xodimga yuboring!
          </Text>
        </div>

        <div className="flex gap-3 justify-center">
          <Button
            type="primary"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={handleCopy}
            size="large"
          >
            {copied ? 'Nusxa olindi' : 'Copy qilish'}
          </Button>
          <Button onClick={handleModalClose} size="large">
            OK
          </Button>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
