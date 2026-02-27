"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken, getUser } from "@/lib/auth-client";
import {
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Card,
  Row,
  Col,
  message,
  Breadcrumb,
  Divider,
  Switch,
  Modal,
  Result,
  Typography,
  Space,
} from "antd";
import NURMAKONLogo from "@/components/NURMAKONLogo";
import {
  ArrowLeftOutlined,
  UserAddOutlined,
  SaveOutlined,
  UserOutlined,
  KeyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  CopyOutlined,
  CheckOutlined,
} from "@ant-design/icons";
import Link from "next/link";
import { generatePassword } from "@/lib/crypto-client";

const { Option } = Select;
const { Text } = Typography;

interface Credentials {
  username: string;
  password: string;
}

export default function NewStudentPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [canAddStudent, setCanAddStudent] = useState(false);

  // Auth tekshiruvi
  useEffect(() => {
    const token = getToken();
    const user = getUser();

    if (!token) {
      router.push("/login");
      return;
    }

    // ADMIN va SUPER_ADMIN talaba qo'sha oladi
    const allowedRoles = ["SUPER_ADMIN", "ADMIN"];
    if (user && allowedRoles.includes(user.role)) {
      setCanAddStudent(true);
    }

    setAuthChecking(false);
  }, [router]);

  // Avtomatik parol yaratish
  const handleGeneratePassword = () => {
    const newPassword = generatePassword(8);
    form.setFieldsValue({ password: newPassword });
  };

  // Copy qilish
  const handleCopy = () => {
    if (!credentials) return;
    const text = `Login: ${credentials.username}\nParol: ${credentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    message.success("Nusxa olindi!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Modal yopish va redirect
  const handleModalClose = () => {
    setSuccessModalOpen(false);
    setCredentials(null);
    router.push("/dashboard/students");
  };

  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      const token = getToken();
      if (!token) {
        message.error("Sessiya muddati tugagan. Qaytadan tizimga kiring.");
        router.push("/login");
        return;
      }

      const response = await fetch("/api/students", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...values,
          dateOfBirth: values.dateOfBirth
            ? values.dateOfBirth.toISOString()
            : null,
          createAccount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // 401 xatosi - token muddati tugagan
        if (response.status === 401) {
          message.error("Sessiya muddati tugagan. Qaytadan tizimga kiring.");
          router.push("/login");
          return;
        }
        // 403 xatosi - huquq yo'q
        if (response.status === 403) {
          message.error("Sizda bu amalni bajarish huquqi yo'q");
          return;
        }
        // 409 xatosi - dublikat ism/familiya
        if (response.status === 409) {
          message.error(data.error || "Xatolik yuz berdi");
          form.setFields([
            {
              name: "firstName",
              errors: [data.error || "Bu ism va familiyali o'quvchi ro'yxatda mavjud"],
            },
          ]);
          return;
        }
        message.error(data.error || "Xatolik yuz berdi");
        return;
      }

      // Agar credentials qaytarilgan bo'lsa, modalda ko'rsatish
      if (data.credentials) {
        setCredentials(data.credentials);
        setSuccessModalOpen(true);
      } else {
        message.success("Talaba muvaffaqiyatli qo'shildi");
        router.push("/dashboard/students");
      }
    } catch (error) {
      message.error("Xatolik yuz berdi");
      console.error("Error creating student:", error);
    } finally {
      setLoading(false);
    }
  };

  // Loading holati
  if (authChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  // Huquq yo'q
  if (!canAddStudent) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="text-red-500 text-6xl mb-4">⛔</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ruxsat yo'q</h2>
          <p className="text-gray-600 mb-4">
            Sizda talaba qo'shish huquqi yo'q. Faqat Admin va Super Admin bu
            amalni bajara oladi.
          </p>
          <Button
            type="primary"
            onClick={() => router.push("/dashboard/students")}
          >
            Orqaga qaytish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => router.push("/dashboard")}
              >
                <NURMAKONLogo width={40} height={40} />
              </div>
              <nav className="flex gap-4">
                <Link
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/students"
                  className="text-indigo-600 font-medium"
                >
                  Talabalar
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb
          className="mb-4"
          items={[
            { title: <Link href="/dashboard">Dashboard</Link> },
            { title: <Link href="/dashboard/students">Talabalar</Link> },
            { title: "Yangi talaba" },
          ]}
        />

        <Card>
          <div className="flex items-center gap-4 mb-6">
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => router.push("/dashboard/students")}
            >
              Orqaga
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <UserAddOutlined />
                Yangi talaba qo'shish
              </h2>
              <p className="text-sm text-gray-600">
                Barcha kerakli ma'lumotlarni to'ldiring
              </p>
            </div>
          </div>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
            size="large"
          >
            <Divider>Shaxsiy ma'lumotlar</Divider>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Familiya"
                  name="lastName"
                  rules={[{ required: true, message: "Familiya kiriting" }]}
                >
                  <Input placeholder="Rahimov" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Ism"
                  name="firstName"
                  rules={[{ required: true, message: "Ism kiriting" }]}
                >
                  <Input placeholder="Aziz" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Jinsi"
                  name="gender"
                  rules={[{ required: true, message: "Jinsini tanlang" }]}
                >
                  <Select placeholder="Tanlang">
                    <Option value="MALE">Erkak</Option>
                    <Option value="FEMALE">Ayol</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Tug'ilgan sana" name="dateOfBirth">
                  <DatePicker
                    style={{ width: "100%" }}
                    format="DD.MM.YYYY"
                    placeholder="Tanlang"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider>Bog'lanish</Divider>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Telefon raqam"
                  name="phone"
                  rules={[
                    { required: true, message: "Telefon raqam kiriting" },
                    {
                      pattern: /^\+998\d{9}$/,
                      message: "+998901234567 formatida kiriting",
                    },
                  ]}
                >
                  <Input placeholder="+998901234567" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item
                  label="Ota-ona telefoni"
                  name="parentPhone"
                  rules={[
                    {
                      pattern: /^\+998\d{9}$/,
                      message: "+998901234567 formatida kiriting",
                    },
                  ]}
                >
                  <Input placeholder="+998901234567" />
                </Form.Item>
              </Col>
            </Row>

            <Divider>
              <Space>
                <KeyOutlined />
                Tizimga kirish ma'lumotlari
              </Space>
            </Divider>

            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between mb-4">
                <Text>Talaba uchun login yaratish</Text>
                <Switch
                  checked={createAccount}
                  onChange={setCreateAccount}
                  checkedChildren="Ha"
                  unCheckedChildren="Yo'q"
                />
              </div>

              {createAccount && (
                <Row gutter={16}>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Username"
                      name="username"
                      rules={[
                        {
                          required: createAccount,
                          message: "Username kiriting",
                        },
                        {
                          pattern: /^[a-z0-9_\.]+$/,
                          message: "Faqat kichik harflar, raqamlar, _ va .",
                        },
                        { min: 3, message: "Kamida 3 ta belgi" },
                      ]}
                    >
                      <Input
                        placeholder="aziz.rahimov"
                        prefix={<UserOutlined className="text-gray-400" />}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={12}>
                    <Form.Item
                      label="Parol"
                      name="password"
                      rules={[
                        { required: createAccount, message: "Parol kiriting" },
                        { min: 6, message: "Kamida 6 ta belgi" },
                      ]}
                    >
                      <Input.Group compact>
                        <Input
                          style={{ width: "calc(100% - 80px)" }}
                          type={showPassword ? "text" : "password"}
                          placeholder="Parol"
                          prefix={<KeyOutlined className="text-gray-400" />}
                          suffix={
                            <Button
                              type="text"
                              size="small"
                              icon={
                                showPassword ? (
                                  <EyeInvisibleOutlined />
                                ) : (
                                  <EyeOutlined />
                                )
                              }
                              onClick={() => setShowPassword(!showPassword)}
                            />
                          }
                        />
                        <Button
                          type="primary"
                          onClick={handleGeneratePassword}
                          style={{ width: "80px" }}
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
                  Talaba tizimga kira olmaydi. Keyinroq login yaratish mumkin.
                </Text>
              )}
            </div>

            <Divider />

            <Form.Item>
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
                  onClick={() => router.push("/dashboard/students")}
                  size="large"
                >
                  Bekor qilish
                </Button>
              </div>
            </Form.Item>
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
          title="Talaba muvaffaqiyatli qo'shildi!"
          subTitle="Quyidagi login ma'lumotlarini talabaga yuboring"
        />

        {credentials && (
          <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300 mb-4">
            <div className="flex justify-between items-center mb-2">
              <Text type="secondary">Login:</Text>
              <Text strong copyable>
                {credentials.username}
              </Text>
            </div>
            <div className="flex justify-between items-center">
              <Text type="secondary">Parol:</Text>
              <Text strong copyable>
                {credentials.password}
              </Text>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            type="primary"
            icon={copied ? <CheckOutlined /> : <CopyOutlined />}
            onClick={handleCopy}
          >
            {copied ? "Nusxa olindi" : "Nusxa olish"}
          </Button>
          <Button onClick={handleModalClose}>OK</Button>
        </div>

        <div className="text-center mt-4">
          <Text type="warning" className="text-xs">
            ⚠️ Bu maxfiy ma'lumot! Faqat talabaga yuboring.
          </Text>
        </div>
      </Modal>
    </div>
  );
}
