'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  DatePicker,
  InputNumber,
  message,
  Row,
  Col,
  Divider,
  Typography,
  Slider,
  Space,
  Tag,
  Switch,
  Modal,
  Result,
} from 'antd'
import CompasLogo from '@/components/CompasLogo'
import {
  ArrowLeftOutlined,
  UserOutlined,
  SaveOutlined,
  DeleteOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  KeyOutlined,
  CopyOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import Link from 'next/link'
import { generatePassword } from '@/lib/crypto-client'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

interface Course {
  id: string
  name: string
  price: number
}

interface CourseSelection {
  courseId: string
  courseName: string
  percentage: number
}

interface Credentials {
  username: string
  password: string
}

export default function NewTeacherPage() {
  const router = useRouter()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourses, setSelectedCourses] = useState<CourseSelection[]>([])
  const [createAccount, setCreateAccount] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [successModalOpen, setSuccessModalOpen] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [copied, setCopied] = useState(false)

  // Kurslarni yuklash
  const fetchCourses = async () => {
    try {
      const token = localStorage.getItem('token')
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

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }
    fetchCourses()
  }, [])

  // Kurs qo'shish
  const handleAddCourse = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId)
    if (!course) return

    // Allaqachon qo'shilganmi tekshirish
    if (selectedCourses.find((sc) => sc.courseId === courseId)) {
      message.warning('Bu fan allaqachon qo\'shilgan')
      return
    }

    setSelectedCourses([
      ...selectedCourses,
      {
        courseId,
        courseName: course.name,
        percentage: 50,
      },
    ])
  }

  // Foizni o'zgartirish
  const handlePercentageChange = (courseId: string, percentage: number) => {
    setSelectedCourses(
      selectedCourses.map((sc) =>
        sc.courseId === courseId ? { ...sc, percentage } : sc
      )
    )
  }

  // Kursni o'chirish
  const handleRemoveCourse = (courseId: string) => {
    setSelectedCourses(selectedCourses.filter((sc) => sc.courseId !== courseId))
  }

  // Avtomatik parol yaratish
  const handleGeneratePassword = () => {
    const newPassword = generatePassword(8)
    form.setFieldsValue({ password: newPassword })
  }

  // Copy qilish
  const handleCopy = () => {
    if (!credentials) return
    const text = `Login: ${credentials.username}\nParol: ${credentials.password}`
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

      const response = await fetch('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...values,
          dateOfBirth: values.dateOfBirth?.toISOString() || null,
          courses: selectedCourses.map((sc) => ({
            courseId: sc.courseId,
            percentage: sc.percentage,
          })),
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
        message.success('O\'qituvchi muvaffaqiyatli qo\'shildi')
        router.push('/dashboard/teachers')
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
    router.push('/dashboard/teachers')
  }

  // Qo'shilmagan kurslar
  const availableCourses = courses.filter(
    (c) => !selectedCourses.find((sc) => sc.courseId === c.id)
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => router.push('/dashboard')}
              >
                <CompasLogo width={40} height={40} />
              </div>
              <nav className="hidden md:flex gap-4">
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/dashboard/teachers" className="text-indigo-600 font-medium">
                  O'qituvchilar
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push('/dashboard/teachers')}
            >
              Orqaga
            </Button>
            <Title level={4} className="!mb-0">
              <UserOutlined className="mr-2" />
              Yangi o'qituvchi qo'shish
            </Title>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            initialValues={{ createAccount: true }}
          >
            <Divider>Shaxsiy ma'lumotlar</Divider>

            <Row gutter={16}>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="Familiya"
                  name="lastName"
                  rules={[{ required: true, message: 'Familiya kiriting' }]}
                >
                  <Input placeholder="Rahimov" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  label="Ism"
                  name="firstName"
                  rules={[{ required: true, message: 'Ism kiriting' }]}
                >
                  <Input placeholder="Aziz" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="Otasining ismi" name="middleName">
                  <Input placeholder="Karimovich" />
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
                  <Input placeholder="+998901234567" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[{ type: 'email', message: 'Email noto\'g\'ri' }]}
                >
                  <Input placeholder="teacher@example.com" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item label="Tug'ilgan sana" name="dateOfBirth">
                  <DatePicker
                    style={{ width: '100%' }}
                    format="DD.MM.YYYY"
                    placeholder="Tanlang"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Manzil" name="address">
                  <Input placeholder="Toshkent sh., Chilonzor t." />
                </Form.Item>
              </Col>
            </Row>

            <Divider>Kasbiy ma'lumotlar</Divider>

            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item label="Mutaxassislik" name="specialization">
                  <Input placeholder="Ingliz tili o'qituvchisi" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Tajriba (yil)" name="experience">
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    max={50}
                    placeholder="5"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="Ma'lumoti" name="education">
              <TextArea
                rows={2}
                placeholder="Oliy ma'lumot, TATU 2015-yil bitirgan"
              />
            </Form.Item>

            <Divider>Fanlar va foizlar</Divider>

            <div className="mb-4">
              <Text type="secondary">
                O'qituvchi o'qitadigan fanlarni tanlang va har bir fan uchun maosh
                foizini belgilang (40-60%)
              </Text>
            </div>

            <Row gutter={16} className="mb-4">
              <Col xs={24} sm={16}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Fan tanlang"
                  onChange={handleAddCourse}
                  value={undefined}
                >
                  {availableCourses.map((course) => (
                    <Option key={course.id} value={course.id}>
                      {course.name}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>

            {selectedCourses.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                {selectedCourses.map((sc) => (
                  <div
                    key={sc.courseId}
                    className="flex items-center gap-4 mb-4 last:mb-0"
                  >
                    <Tag color="blue" className="text-sm">
                      {sc.courseName}
                    </Tag>
                    <div className="flex-1">
                      <Slider
                        min={40}
                        max={60}
                        value={sc.percentage}
                        onChange={(value) =>
                          handlePercentageChange(sc.courseId, value)
                        }
                        marks={{
                          40: '40%',
                          50: '50%',
                          60: '60%',
                        }}
                      />
                    </div>
                    <Text strong>{sc.percentage}%</Text>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveCourse(sc.courseId)}
                    />
                  </div>
                ))}
              </div>
            )}

            {selectedCourses.length === 0 && (
              <div className="text-center py-4 text-gray-400 bg-gray-50 rounded-lg mb-4">
                Hech qanday fan tanlanmagan
              </div>
            )}

            <Divider>
              <Space>
                <KeyOutlined />
                Tizimga kirish ma'lumotlari
              </Space>
            </Divider>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-4">
                <Text>O'qituvchi uchun login yaratish</Text>
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
                          style={{ width: 'calc(100% - 80px)' }}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Parol"
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
                          style={{ width: '80px' }}
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
                  O'qituvchi tizimga kira olmaydi. Keyinroq login yaratish mumkin.
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
              >
                Saqlash
              </Button>
              <Button
                size="large"
                onClick={() => router.push('/dashboard/teachers')}
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
          title="O'qituvchi muvaffaqiyatli qo'shildi!"
          subTitle="Quyidagi login ma'lumotlarini o'qituvchiga yuboring"
        />

        {credentials && (
          <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300 mb-4">
            <div className="flex justify-between items-center mb-2">
              <Text type="secondary">Login:</Text>
              <Text strong copyable>{credentials.username}</Text>
            </div>
            <div className="flex justify-between items-center">
              <Text type="secondary">Parol:</Text>
              <Text strong copyable>{credentials.password}</Text>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            type="primary"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={handleCopy}
          >
            {copied ? 'Nusxa olindi' : 'Nusxa olish'}
          </Button>
          <Button onClick={handleModalClose}>
            OK
          </Button>
        </div>

        <div className="text-center mt-4">
          <Text type="warning" className="text-xs">
            ⚠️ Bu maxfiy ma'lumot! Faqat o'qituvchiga yuboring.
          </Text>
        </div>
      </Modal>
    </div>
  )
}
