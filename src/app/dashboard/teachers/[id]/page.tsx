"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { logout, getToken, getUser as getCurrentUser } from "@/lib/auth-client";
import { generatePassword } from "@/lib/crypto-client";
import {
  Button,
  Card,
  Tag,
  Table,
  message,
  Descriptions,
  Statistic,
  Row,
  Col,
  Tabs,
  Empty,
  Spin,
  Select,
  Progress,
  Divider,
  Modal,
  Form,
  Input,
  Typography,
  Result,
} from "antd";
import NURMAKONLogo from "@/components/NURMAKONLogo";
import {
  ArrowLeftOutlined,
  UserOutlined,
  TeamOutlined,
  CalendarOutlined,
  DollarOutlined,
  BookOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PercentageOutlined,
  ScheduleOutlined,
  WalletOutlined,
  ExclamationCircleOutlined,
  RightOutlined,
  KeyOutlined,
  CopyOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LoginOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

const { Option } = Select;

interface TeacherCourse {
  id: string;
  courseId: string;
  percentage: number;
  course: {
    id: string;
    name: string;
    price: number;
  };
}

interface Group {
  id: string;
  name: string;
  course: {
    name: string;
    price: number;
  };
  status: string;
  _count: {
    groupStudents: number;
  };
}

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  email?: string;
  address?: string;
  education?: string;
  experience?: number;
  status: "ACTIVE" | "ON_LEAVE" | "RESIGNED";
  hireDate: string;
  salary?: number;
  createdAt: string;
  userId?: string;
  user?: {
    id: string;
    username: string;
    isActive: boolean;
    lastLogin?: string;
  };
  createdBy: {
    fullName: string;
  };
  groups: Group[];
  teacherCourses: TeacherCourse[];
  _count: {
    groups: number;
    schedules: number;
  };
}

interface GroupStats {
  group: {
    id: string;
    name: string;
    course: {
      id: string;
      name: string;
      price: number;
    };
    studentCount: number;
    price: number;
  };
  lessonsCount: number;
  stats: {
    totalRecords: number;
    present: number;
    late: number;
    absent: number;
    attendanceRate: number;
  };
  teacherPercentage: number;
}

interface AttendanceData {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    groups: {
      id: string;
      name: string;
      studentCount: number;
    }[];
  };
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalGroups: number;
    totalLessons: number;
    estimatedSalary: number;
  };
  groupStats: GroupStats[];
  recentLessons: Record<
    string,
    {
      groupId: string;
      groupName: string;
      present: number;
      absent: number;
    }[]
  >;
}

interface SalaryData {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
  };
  period: string;
  groupDetails: {
    group: {
      id: string;
      name: string;
      course: string;
    };
    studentCount: number;
    totalStudentPayments: number;
    teacherPercentage: number;
    lessonsCount: number;
    attendanceCoefficient: number;
    monthlySalary: number;
  }[];
  summary: {
    totalStudentPayments: number;
    totalTeacherShare: number;
    totalSalary: number;
    paidAmount: number;
    debt: number;
  };
}

export default function TeacherProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // State
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(
    null,
  );
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [salaryLoading, setSalaryLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    dayjs().format("YYYY-MM"),
  );

  // Login yaratish uchun state
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginForm] = Form.useForm();
  const [loginLoading, setLoginLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);

  // Current user
  const currentUser = getCurrentUser();

  // O'qituvchi ma'lumotlarini yuklash
  const fetchTeacher = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/teachers/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          message.error("O'qituvchi topilmadi");
          router.push("/dashboard/teachers");
          return;
        }
        throw new Error("Failed to fetch");
      }

      const data = await response.json();
      setTeacher(data.teacher);
    } catch (error) {
      message.error("O'qituvchi ma'lumotlarini yuklashda xatolik");
      console.error("Error fetching teacher:", error);
    } finally {
      setLoading(false);
    }
  };

  // Davomat statistikasini yuklash
  const fetchAttendanceStats = async () => {
    setAttendanceLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/attendance/teacher/${id}?month=${selectedMonth}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setAttendanceData(data);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Maosh ma'lumotlarini yuklash
  const fetchSalary = async () => {
    setSalaryLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/salary/teacher/${id}?month=${selectedMonth}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setSalaryData(data);
      }
    } catch (error) {
      console.error("Error fetching salary:", error);
    } finally {
      setSalaryLoading(false);
    }
  };

  useEffect(() => {
    fetchTeacher();
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchAttendanceStats();
      fetchSalary();
    }
  }, [id, selectedMonth]);

  // Chiqish
  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Login yaratish modalni ochish
  const openLoginModal = () => {
    // Default username yaratish (familiya.ism formatida)
    if (teacher) {
      const defaultUsername =
        `${teacher.lastName.toLowerCase()}.${teacher.firstName.toLowerCase()}`.replace(
          /[^a-z0-9._]/g,
          "",
        );
      loginForm.setFieldsValue({
        username: defaultUsername,
        password: "",
      });
    }
    setLoginModalOpen(true);
  };

  // Parol yaratish
  const handleGeneratePassword = () => {
    const newPassword = generatePassword(8);
    loginForm.setFieldsValue({ password: newPassword });
    setShowPassword(true);
  };

  // Login yaratish
  const handleCreateLogin = async (values: {
    username: string;
    password: string;
  }) => {
    setLoginLoading(true);
    try {
      const token = getToken();
      if (!token) {
        message.error("Sessiya muddati tugagan");
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/teachers/${id}/create-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || "Xatolik yuz berdi");
        return;
      }

      // Success - credentials ni saqlash
      setCreatedCredentials(data.credentials);
      setLoginModalOpen(false);
      setSuccessModalOpen(true);

      // Teacher ma'lumotlarini yangilash
      fetchTeacher();
    } catch (error) {
      message.error("Login yaratishda xatolik");
      console.error("Create login error:", error);
    } finally {
      setLoginLoading(false);
    }
  };

  // Credentials copy qilish
  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const text = `Login: ${createdCredentials.username}\nParol: ${createdCredentials.password}`;
    navigator.clipboard.writeText(text);
    message.success("Nusxa olindi!");
  };

  // Success modal yopish
  const handleSuccessModalClose = () => {
    setSuccessModalOpen(false);
    setCreatedCredentials(null);
    loginForm.resetFields();
  };

  // Admin yoki Super Admin ekanligini tekshirish
  const canCreateLogin =
    currentUser && ["SUPER_ADMIN", "ADMIN"].includes(currentUser.role);

  // Narxni formatlash
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("uz-UZ").format(price) + " so'm";
  };

  // Oylar ro'yxati (oxirgi 12 oy)
  const getMonthOptions = () => {
    const months = [];
    for (let i = 0; i < 12; i++) {
      const month = dayjs().subtract(i, "month");
      months.push({
        value: month.format("YYYY-MM"),
        label: month.format("MMMM YYYY"),
      });
    }
    return months;
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  // O'qituvchi topilmadi
  if (!teacher) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Empty description="O'qituvchi topilmadi" />
      </div>
    );
  }

  // Status ranglari
  const statusConfig: Record<string, { color: string; text: string }> = {
    ACTIVE: { color: "green", text: "Aktiv" },
    ON_LEAVE: { color: "orange", text: "Ta'tilda" },
    RESIGNED: { color: "red", text: "Ishdan ketgan" },
  };

  // Guruhlar jadvali
  const groupsColumns: ColumnsType<Group> = [
    {
      title: "Guruh nomi",
      key: "name",
      render: (_, record) => (
        <a onClick={() => router.push(`/dashboard/groups/${record.id}`)}>
          {record.name}
        </a>
      ),
    },
    {
      title: "Kurs",
      key: "course",
      render: (_, record) => record.course.name,
    },
    {
      title: "Talabalar",
      key: "students",
      render: (_, record) => (
        <Tag icon={<TeamOutlined />} color="blue">
          {record._count.groupStudents} ta
        </Tag>
      ),
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) => {
        const config: Record<string, { color: string; text: string }> = {
          ACTIVE: { color: "green", text: "Aktiv" },
          COMPLETED: { color: "blue", text: "Tugallangan" },
          CANCELLED: { color: "red", text: "Yopilgan" },
        };
        const c = config[record.status] || {
          color: "default",
          text: record.status,
        };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    {
      title: "Amal",
      key: "action",
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() =>
            router.push(`/dashboard/attendance/mark?groupId=${record.id}`)
          }
        >
          Davomat belgilash
        </Button>
      ),
    },
  ];

  // Davomat statistikasi jadvali
  const attendanceColumns: ColumnsType<GroupStats> = [
    {
      title: "Guruh",
      key: "group",
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.group.name}</div>
          <div className="text-xs text-gray-500">
            {record.group.course.name}
          </div>
        </div>
      ),
    },
    {
      title: "Talabalar",
      key: "students",
      render: (_, record) => `${record.group.studentCount} ta`,
    },
    {
      title: "Darslar",
      key: "lessons",
      render: (_, record) => (
        <Tag icon={<CalendarOutlined />}>{record.lessonsCount} ta</Tag>
      ),
    },
    {
      title: "Keldi/Kelmadi",
      key: "attendance",
      render: (_, record) => (
        <div>
          <Tag color="green">
            <CheckCircleOutlined /> {record.stats.present + record.stats.late}
          </Tag>
          <Tag color="red">
            <CloseCircleOutlined /> {record.stats.absent}
          </Tag>
        </div>
      ),
    },
    {
      title: "Davomat %",
      key: "rate",
      render: (_, record) => (
        <Progress
          percent={record.stats.attendanceRate}
          size="small"
          status={
            record.stats.attendanceRate >= 80
              ? "success"
              : record.stats.attendanceRate >= 50
                ? "normal"
                : "exception"
          }
        />
      ),
    },
    {
      title: "O'qituvchi %",
      key: "teacherPercentage",
      render: (_, record) => (
        <Tag color="purple">{record.teacherPercentage}%</Tag>
      ),
    },
  ];

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
              <nav className="hidden md:flex gap-4">
                <a
                  href="/dashboard"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Dashboard
                </a>
                <a
                  href="/dashboard/students"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Talabalar
                </a>
                <a
                  href="/dashboard/teachers"
                  className="text-indigo-600 font-medium"
                >
                  O'qituvchilar
                </a>
                <a
                  href="/dashboard/groups"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Guruhlar
                </a>
                <a
                  href="/dashboard/attendance"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Davomat
                </a>
              </nav>
            </div>
            <Button danger onClick={handleLogout}>
              Chiqish
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back button */}
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/dashboard/teachers")}
          className="mb-4"
        >
          Orqaga
        </Button>

        {/* O'qituvchi sarlavhasi */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-100 p-4 rounded-full">
                <UserOutlined className="text-2xl text-indigo-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {teacher.lastName} {teacher.firstName}{" "}
                    {teacher.middleName || ""}
                  </h2>
                  <Tag color={statusConfig[teacher.status]?.color}>
                    {statusConfig[teacher.status]?.text}
                  </Tag>
                  {/* Login status */}
                  {teacher.user ? (
                    <Tag color="green" icon={<LoginOutlined />}>
                      Login: {teacher.user.username}
                    </Tag>
                  ) : (
                    <Tag color="orange" icon={<ExclamationCircleOutlined />}>
                      Login yo'q
                    </Tag>
                  )}
                </div>
                <p className="text-gray-500 mt-1">
                  <PhoneOutlined className="mr-1" />
                  {teacher.phone}
                </p>
              </div>
            </div>

            {/* Login yaratish tugmasi */}
            {!teacher.user && canCreateLogin && (
              <Button
                type="primary"
                icon={<KeyOutlined />}
                onClick={openLoginModal}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Login yaratish
              </Button>
            )}
          </div>
        </div>

        {/* Statistika */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Guruhlar"
                value={teacher._count.groups}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Bu oydagi darslar"
                value={attendanceData?.summary.totalLessons || 0}
                prefix={<CalendarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Fanlar soni"
                value={teacher.teacherCourses.length}
                prefix={<BookOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Taxminiy maosh"
                value={attendanceData?.summary.estimatedSalary || 0}
                formatter={(val) => formatPrice(Number(val))}
                valueStyle={{ color: "#52c41a", fontSize: "18px" }}
                prefix={<DollarOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Tabs */}
        <Card>
          <Tabs
            defaultActiveKey="info"
            items={[
              {
                key: "info",
                label: "Asosiy ma'lumotlar",
                children: (
                  <Descriptions bordered column={{ xs: 1, sm: 2 }}>
                    <Descriptions.Item label="Familiya">
                      {teacher.lastName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ism">
                      {teacher.firstName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Otasining ismi">
                      {teacher.middleName || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Telefon">
                      <a
                        href={`tel:${teacher.phone}`}
                        className="text-blue-600"
                      >
                        {teacher.phone}
                      </a>
                    </Descriptions.Item>
                    <Descriptions.Item label="Ma'lumoti">
                      {teacher.education || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Manzil">
                      {teacher.address || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Ishga kirgan">
                      {new Date(teacher.hireDate).toLocaleDateString("uz-UZ")}
                    </Descriptions.Item>
                    <Descriptions.Item label="Yaratdi">
                      {teacher.createdBy.fullName}
                    </Descriptions.Item>
                    <Descriptions.Item label="Fanlar" span={2}>
                      {teacher.teacherCourses.length > 0 ? (
                        teacher.teacherCourses.map((tc) => (
                          <Tag key={tc.id} color="blue" className="mb-1 mr-1">
                            {tc.course.name} - {tc.percentage}%
                          </Tag>
                        ))
                      ) : (
                        <span className="text-gray-400">
                          Hech qanday fan biriktirilmagan
                        </span>
                      )}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: "groups",
                label: (
                  <span>
                    <TeamOutlined className="mr-1" />
                    Guruhlar ({teacher._count.groups})
                  </span>
                ),
                children: (
                  <div>
                    {teacher.groups.length > 0 ? (
                      <Table
                        columns={groupsColumns}
                        dataSource={teacher.groups}
                        rowKey="id"
                        pagination={false}
                        scroll={{ x: 600 }}
                      />
                    ) : (
                      <Empty description="Hech qanday guruh biriktirilmagan" />
                    )}
                  </div>
                ),
              },
              {
                key: "attendance",
                label: (
                  <span>
                    <CalendarOutlined className="mr-1" />
                    Davomat va Maosh
                  </span>
                ),
                children: (
                  <div>
                    {/* Oy tanlash */}
                    <div className="mb-4 flex justify-between items-center">
                      <h3 className="text-lg font-medium">
                        <ScheduleOutlined className="mr-2" />
                        Oylik hisobot
                      </h3>
                      <Select
                        value={selectedMonth}
                        onChange={setSelectedMonth}
                        style={{ width: 200 }}
                        size="large"
                      >
                        {getMonthOptions().map((month) => (
                          <Option key={month.value} value={month.value}>
                            {month.label}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    {/* Oylik statistika */}
                    {attendanceLoading ? (
                      <div className="text-center py-8">
                        <Spin />
                      </div>
                    ) : attendanceData ? (
                      <>
                        <Row gutter={[16, 16]} className="mb-4">
                          <Col xs={12} sm={8}>
                            <Card size="small" className="text-center">
                              <Statistic
                                title="Jami darslar"
                                value={attendanceData.summary.totalLessons}
                                prefix={<CalendarOutlined />}
                              />
                            </Card>
                          </Col>
                          <Col xs={12} sm={8}>
                            <Card size="small" className="text-center">
                              <Statistic
                                title="Guruhlar"
                                value={attendanceData.summary.totalGroups}
                                prefix={<TeamOutlined />}
                              />
                            </Card>
                          </Col>
                          <Col xs={24} sm={8}>
                            <Card
                              size="small"
                              className="text-center bg-green-50"
                            >
                              <Statistic
                                title="Taxminiy maosh"
                                value={attendanceData.summary.estimatedSalary}
                                formatter={(val) => formatPrice(Number(val))}
                                valueStyle={{ color: "#52c41a" }}
                                prefix={<DollarOutlined />}
                              />
                            </Card>
                          </Col>
                        </Row>

                        <Divider>Guruhlar bo'yicha</Divider>

                        {attendanceData.groupStats.length > 0 ? (
                          <Table
                            columns={attendanceColumns}
                            dataSource={attendanceData.groupStats}
                            rowKey={(record) => record.group.id}
                            pagination={false}
                            scroll={{ x: 800 }}
                          />
                        ) : (
                          <Empty description="Bu oyda darslar o'tilmagan" />
                        )}

                        {/* So'nggi darslar ro'yxati */}
                        {Object.keys(attendanceData.recentLessons).length >
                          0 && (
                          <>
                            <Divider>O'tgan darslar ro'yxati</Divider>
                            <Table
                              size="small"
                              dataSource={Object.entries(
                                attendanceData.recentLessons,
                              ).flatMap(([date, lessons]) =>
                                lessons.map((lesson, idx) => ({
                                  key: `${date}-${lesson.groupId}-${idx}`,
                                  date,
                                  ...lesson,
                                  total: lesson.present + lesson.absent,
                                  rate:
                                    lesson.present + lesson.absent > 0
                                      ? Math.round(
                                          (lesson.present /
                                            (lesson.present + lesson.absent)) *
                                            100,
                                        )
                                      : 0,
                                })),
                              )}
                              pagination={{ pageSize: 10 }}
                              columns={[
                                {
                                  title: "Sana",
                                  key: "date",
                                  width: 120,
                                  render: (_, record: any) => (
                                    <span>
                                      <CalendarOutlined className="mr-2" />
                                      {dayjs(record.date).format("DD.MM.YYYY")}
                                    </span>
                                  ),
                                },
                                {
                                  title: "Guruh",
                                  key: "group",
                                  render: (_, record: any) => (
                                    <a
                                      onClick={() =>
                                        router.push(
                                          `/dashboard/groups/${record.groupId}`,
                                        )
                                      }
                                    >
                                      {record.groupName}
                                    </a>
                                  ),
                                },
                                {
                                  title: "Talabalar",
                                  key: "students",
                                  width: 120,
                                  render: (_, record: any) => (
                                    <span>
                                      <Tag color="green">
                                        <CheckCircleOutlined /> {record.present}
                                      </Tag>
                                      <Tag color="red">
                                        <CloseCircleOutlined /> {record.absent}
                                      </Tag>
                                    </span>
                                  ),
                                },
                                {
                                  title: "Foiz",
                                  key: "rate",
                                  width: 100,
                                  render: (_, record: any) => (
                                    <Tag
                                      color={
                                        record.rate >= 80
                                          ? "green"
                                          : record.rate >= 50
                                            ? "orange"
                                            : "red"
                                      }
                                    >
                                      {record.rate}%
                                    </Tag>
                                  ),
                                },
                              ]}
                            />
                          </>
                        )}

                        {/* Maosh hisoblash formulasi */}
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-medium mb-2">
                            <DollarOutlined className="mr-2" />
                            Maosh hisoblash formulasi:
                          </h4>
                          <p className="text-gray-600 text-sm">
                            Har bir guruh uchun:{" "}
                            <code className="bg-gray-200 px-2 py-1 rounded">
                              Talabalar individual narxlari yig'indisi ×
                              O'qituvchi foizi × Davomat koeffitsienti
                            </code>
                          </p>
                          <p className="text-gray-500 text-xs mt-2">
                            * Davomat koeffitsienti = O'tilgan darslar / Jami
                            darslar
                          </p>
                        </div>
                      </>
                    ) : (
                      <Empty description="Ma'lumot topilmadi" />
                    )}
                  </div>
                ),
              },
              {
                key: "salary",
                label: (
                  <span>
                    <WalletOutlined className="mr-1" />
                    Maosh
                  </span>
                ),
                children: (
                  <div>
                    {/* Oy tanlash */}
                    <div className="mb-4 flex justify-between items-center">
                      <h3 className="text-lg font-medium">
                        <WalletOutlined className="mr-2" />
                        Oylik maosh hisob-kitobi
                      </h3>
                      <Select
                        value={selectedMonth}
                        onChange={setSelectedMonth}
                        style={{ width: 200 }}
                        size="large"
                      >
                        {getMonthOptions().map((month) => (
                          <Option key={month.value} value={month.value}>
                            {month.label}
                          </Option>
                        ))}
                      </Select>
                    </div>

                    {salaryLoading ? (
                      <div className="text-center py-8">
                        <Spin />
                      </div>
                    ) : salaryData ? (
                      <>
                        {/* Maosh statistikasi */}
                        <Row gutter={[16, 16]} className="mb-4">
                          <Col xs={12} sm={6}>
                            <Card size="small" className="text-center">
                              <Statistic
                                title="Jami to'lovlar"
                                value={salaryData.summary.totalStudentPayments}
                                formatter={(val) => formatPrice(Number(val))}
                                valueStyle={{ fontSize: "14px" }}
                              />
                            </Card>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Card
                              size="small"
                              className="text-center bg-blue-50"
                            >
                              <Statistic
                                title="Hisoblangan maosh"
                                value={salaryData.summary.totalSalary}
                                formatter={(val) => formatPrice(Number(val))}
                                valueStyle={{
                                  color: "#1890ff",
                                  fontSize: "14px",
                                }}
                              />
                            </Card>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Card
                              size="small"
                              className="text-center bg-green-50"
                            >
                              <Statistic
                                title="To'langan"
                                value={salaryData.summary.paidAmount}
                                formatter={(val) => formatPrice(Number(val))}
                                valueStyle={{
                                  color: "#52c41a",
                                  fontSize: "14px",
                                }}
                              />
                            </Card>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Card
                              size="small"
                              className="text-center bg-red-50"
                            >
                              <Statistic
                                title="Qarz"
                                value={salaryData.summary.debt}
                                formatter={(val) => formatPrice(Number(val))}
                                valueStyle={{
                                  color:
                                    salaryData.summary.debt > 0
                                      ? "#ff4d4f"
                                      : "#52c41a",
                                  fontSize: "14px",
                                }}
                                prefix={
                                  salaryData.summary.debt > 0 ? (
                                    <ExclamationCircleOutlined />
                                  ) : (
                                    <CheckCircleOutlined />
                                  )
                                }
                              />
                            </Card>
                          </Col>
                        </Row>

                        {/* Guruhlar bo'yicha maosh */}
                        <Divider>Guruhlar bo'yicha tafsilot</Divider>

                        {salaryData.groupDetails.length > 0 ? (
                          <Table
                            dataSource={salaryData.groupDetails}
                            rowKey={(record) => record.group.id}
                            pagination={false}
                            scroll={{ x: 800 }}
                            columns={[
                              {
                                title: "Guruh",
                                key: "group",
                                render: (_, record) => (
                                  <div>
                                    <div className="font-medium">
                                      {record.group.name}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {record.group.course}
                                    </div>
                                  </div>
                                ),
                              },
                              {
                                title: "Talabalar",
                                key: "students",
                                width: 100,
                                render: (_, record) =>
                                  `${record.studentCount} ta`,
                              },
                              {
                                title: "To'lovlar",
                                key: "payments",
                                width: 150,
                                render: (_, record) => (
                                  <span className="text-gray-600">
                                    {formatPrice(record.totalStudentPayments)}
                                  </span>
                                ),
                              },
                              {
                                title: "Foiz",
                                key: "percentage",
                                width: 80,
                                render: (_, record) => (
                                  <Tag color="purple">
                                    {record.teacherPercentage}%
                                  </Tag>
                                ),
                              },
                              {
                                title: "Darslar",
                                key: "lessons",
                                width: 80,
                                render: (_, record) => (
                                  <Tag icon={<CalendarOutlined />}>
                                    {record.lessonsCount}
                                  </Tag>
                                ),
                              },
                              {
                                title: "Koeffitsient",
                                key: "coefficient",
                                width: 100,
                                render: (_, record) => (
                                  <Progress
                                    percent={Math.round(
                                      record.attendanceCoefficient * 100,
                                    )}
                                    size="small"
                                    format={(percent) =>
                                      `${record.attendanceCoefficient.toFixed(2)}`
                                    }
                                  />
                                ),
                              },
                              {
                                title: "Maosh",
                                key: "salary",
                                width: 150,
                                render: (_, record) => (
                                  <span className="font-medium text-green-600">
                                    {formatPrice(record.monthlySalary)}
                                  </span>
                                ),
                              },
                            ]}
                          />
                        ) : (
                          <Empty description="Bu oyda guruhlar topilmadi" />
                        )}

                        {/* Batafsil sahifaga o'tish */}
                        <div className="mt-4 text-right">
                          <Button
                            type="primary"
                            icon={<RightOutlined />}
                            onClick={() =>
                              router.push(
                                `/dashboard/salary/teacher/${id}?month=${selectedMonth}`,
                              )
                            }
                          >
                            Batafsil ko'rish
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Empty description="Maosh ma'lumotlari topilmadi" />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      {/* Login yaratish modal */}
      <Modal
        title={
          <span>
            <KeyOutlined className="mr-2" />
            Login yaratish - {teacher.firstName} {teacher.lastName}
          </span>
        }
        open={loginModalOpen}
        onCancel={() => setLoginModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={loginForm} layout="vertical" onFinish={handleCreateLogin}>
          <Form.Item
            label="Username"
            name="username"
            rules={[
              { required: true, message: "Username kiriting" },
              { min: 3, message: "Kamida 3 ta belgi" },
              {
                pattern: /^[a-z0-9_\.]+$/,
                message: "Faqat kichik harflar, raqamlar, _ va .",
              },
            ]}
          >
            <Input
              prefix={<UserOutlined className="text-gray-400" />}
              placeholder="username"
            />
          </Form.Item>

          <Form.Item
            label="Parol"
            name="password"
            rules={[
              { required: true, message: "Parol kiriting" },
              { min: 6, message: "Kamida 6 ta belgi" },
            ]}
          >
            <Input.Group compact>
              <Input
                style={{ width: "calc(100% - 100px)" }}
                type={showPassword ? "text" : "password"}
                prefix={<KeyOutlined className="text-gray-400" />}
                suffix={
                  <Button
                    type="text"
                    size="small"
                    icon={
                      showPassword ? <EyeInvisibleOutlined /> : <EyeOutlined />
                    }
                    onClick={() => setShowPassword(!showPassword)}
                  />
                }
                value={loginForm.getFieldValue("password")}
                onChange={(e) =>
                  loginForm.setFieldsValue({ password: e.target.value })
                }
              />
              <Button
                type="primary"
                onClick={handleGeneratePassword}
                style={{ width: "100px" }}
              >
                Yaratish
              </Button>
            </Input.Group>
          </Form.Item>

          <div className="flex justify-end gap-2 mt-4">
            <Button onClick={() => setLoginModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={loginLoading}
              icon={<KeyOutlined />}
            >
              Login yaratish
            </Button>
          </div>
        </Form>
      </Modal>

      {/* Success modal */}
      <Modal
        open={successModalOpen}
        onCancel={handleSuccessModalClose}
        footer={null}
        closable={false}
        centered
        width={450}
      >
        <Result
          status="success"
          title="Login muvaffaqiyatli yaratildi!"
          subTitle="Quyidagi ma'lumotlarni o'qituvchiga yuboring"
        />

        {createdCredentials && (
          <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-300 mb-4">
            <div className="flex justify-between items-center mb-2">
              <Typography.Text type="secondary">Login:</Typography.Text>
              <Typography.Text strong copyable>
                {createdCredentials.username}
              </Typography.Text>
            </div>
            <div className="flex justify-between items-center">
              <Typography.Text type="secondary">Parol:</Typography.Text>
              <Typography.Text strong copyable>
                {createdCredentials.password}
              </Typography.Text>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            type="primary"
            icon={<CopyOutlined />}
            onClick={handleCopyCredentials}
          >
            Nusxa olish
          </Button>
          <Button onClick={handleSuccessModalClose}>OK</Button>
        </div>

        <div className="text-center mt-4">
          <Typography.Text type="warning" className="text-xs">
            Bu maxfiy ma'lumot! Faqat o'qituvchiga yuboring.
          </Typography.Text>
        </div>
      </Modal>
    </div>
  );
}
