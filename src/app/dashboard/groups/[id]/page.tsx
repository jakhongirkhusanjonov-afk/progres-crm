"use client";

import { Check, X } from "lucide-react";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/auth-client";
import {
  Button,
  Card,
  Tag,
  Table,
  Space,
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
  message,
  Descriptions,
  Statistic,
  Row,
  Col,
  Tabs,
  Empty,
  Spin,
  Popconfirm,
} from "antd";
import NURMAKONLogo from "@/components/NURMAKONLogo";
import {
  ArrowLeftOutlined,
  UserAddOutlined,
  TeamOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  BookOutlined,
  DeleteOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  PercentageOutlined,
  TrophyOutlined,
  FrownOutlined,
  CrownOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table";

const { Option } = Select;
const { Search } = Input;

// Dars kunlari
const DAYS_OF_WEEK: Record<string, string> = {
  "0": "Yakshanba",
  "1": "Dushanba",
  "2": "Seshanba",
  "3": "Chorshanba",
  "4": "Payshanba",
  "5": "Juma",
  "6": "Shanba",
};

// Interfeys
interface GroupStudent {
  id: string;
  enrollDate: string;
  status: "ACTIVE" | "COMPLETED" | "DROPPED";
  price?: number;
  discountReason?: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    status: string;
    gender?: string;
  };
}

interface Group {
  id: string;
  name: string;
  course: {
    id: string;
    name: string;
    price: number;
    level?: string;
    duration?: number;
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
  };
  startDate: string;
  endDate?: string;
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  maxStudents: number;
  roomNumber?: string;
  branch?: string;
  price?: number;
  scheduleDays?: string;
  scheduleTime?: string;
  groupStudents: GroupStudent[];
  _count: {
    groupStudents: number;
    attendances: number;
    testResults: number;
  };
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: string;
}

interface Stats {
  totalPayments: number;
  paymentCount: number;
  attendance: {
    status: string;
    _count: number;
  }[];
}

interface AttendanceSession {
  groupId: string;
  date: string;
  stats: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendanceRate: number;
  };
}

interface StudentRanking {
  student: {
    id: string;
    firstName: string;
    lastName: string;
  };
  stats: {
    present: number;
    late: number;
    absent: number;
    total: number;
    attendanceRate: number;
  };
}

interface AttendanceStats {
  totalLessons: number;
  totalAttendances: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

interface StudentRankings {
  best: StudentRanking | null;
  worst: StudentRanking | null;
  all: StudentRanking[];
}

interface PaymentChecklistItem {
  index: number;
  studentId: string;
  firstName: string;
  lastName: string;
  phone: string;
  hasPaid: boolean;
}

interface PaymentChecklist {
  checklist: PaymentChecklistItem[];
  currentMonth: number;
  currentYear: number;
  currentMonthName: string;
}

export default function GroupProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [form] = Form.useForm();

  // State
  const [group, setGroup] = useState<Group | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [searchStudents, setSearchStudents] = useState<Student[]>([]);
  const [studentSearchText, setStudentSearchText] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);
  const [attendanceSessions, setAttendanceSessions] = useState<
    AttendanceSession[]
  >([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceStats, setAttendanceStats] =
    useState<AttendanceStats | null>(null);
  const [studentRankings, setStudentRankings] =
    useState<StudentRankings | null>(null);
  const [paymentChecklist, setPaymentChecklist] =
    useState<PaymentChecklist | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);

  // Guruh ma'lumotlarini yuklash
  const fetchGroup = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/groups/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          message.error("Guruh topilmadi");
          router.push("/dashboard/groups");
          return;
        }
        throw new Error("Failed to fetch");
      }

      const data = await response.json();
      setGroup(data.group);
      setStats(data.stats);
    } catch (error) {
      message.error("Guruh ma'lumotlarini yuklashda xatolik");
      console.error("Error fetching group:", error);
    } finally {
      setLoading(false);
    }
  };

  // Barcha talabalarni yuklash
  const fetchAllStudents = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/students?limit=1000&status=ACTIVE", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAllStudents(data.students);
      }
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  };

  // Davomat tarixini yuklash
  const fetchAttendanceSessions = async () => {
    setLoadingAttendance(true);
    try {
      const token = localStorage.getItem("token");

      // Parallel ravishda ikkala API'ni chaqirish
      const [sessionsRes, groupAttRes] = await Promise.all([
        fetch(`/api/attendance/sessions?groupId=${id}&limit=50`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/attendance/group/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setAttendanceSessions(data.sessions);
      }

      if (groupAttRes.ok) {
        const groupData = await groupAttRes.json();
        setAttendanceStats(groupData.stats);
        setStudentRankings(groupData.studentRankings);
      }
    } catch (error) {
      console.error("Error fetching attendance sessions:", error);
    } finally {
      setLoadingAttendance(false);
    }
  };

  // To'lov checklist ma'lumotlarini yuklash
  const fetchPaymentChecklist = async () => {
    setLoadingChecklist(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/groups/${id}/payment-checklist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setPaymentChecklist(data);
      }
    } catch (error) {
      console.error("Error fetching payment checklist:", error);
    } finally {
      setLoadingChecklist(false);
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchAllStudents();
    fetchAttendanceSessions();
    fetchPaymentChecklist();
  }, [id]);

  // Talabalarni qidirish
  useEffect(() => {
    if (!studentSearchText) {
      setSearchStudents([]);
      return;
    }

    const search = studentSearchText.toLowerCase();
    const filtered = allStudents
      .filter((s) => {
        // Guruhda yo'q talabalarni filterlash
        const isInGroup = group?.groupStudents.some(
          (gs) => gs.student.id === s.id,
        );
        if (isInGroup) return false;

        return (
          s.firstName.toLowerCase().includes(search) ||
          s.lastName.toLowerCase().includes(search) ||
          s.phone.includes(search)
        );
      })
      .slice(0, 10);

    setSearchStudents(filtered);
  }, [studentSearchText, allStudents, group]);

  // Talaba qo'shish
  const handleAddStudent = async (values: any) => {
    if (!values.studentId) {
      message.error("Talabani tanlang");
      return;
    }

    setAddingStudent(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/groups/${id}/students`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentId: values.studentId,
          price: values.price || null,
          discountReason: values.discountReason || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || "Xatolik yuz berdi");
        return;
      }

      message.success("Talaba guruhga qo'shildi");
      setIsAddStudentModalOpen(false);
      form.resetFields();
      setStudentSearchText("");
      fetchGroup();
    } catch (error) {
      message.error("Xatolik yuz berdi");
      console.error("Error adding student:", error);
    } finally {
      setAddingStudent(false);
    }
  };

  // Talabani guruhdan o'chirish
  const handleRemoveStudent = async (studentId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/groups/${id}/students/${studentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        const data = await response.json();
        message.error(data.error || "Xatolik yuz berdi");
        return;
      }

      message.success("Talaba guruhdan o'chirildi");
      fetchGroup();
    } catch (error) {
      message.error("Xatolik yuz berdi");
      console.error("Error removing student:", error);
    }
  };

  // Chiqish
  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Dars kunlarini formatlash
  const formatScheduleDays = (days?: string) => {
    if (!days) return "-";
    return days
      .split(",")
      .map((d) => DAYS_OF_WEEK[d] || d)
      .join(", ");
  };

  // Narxni formatlash
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("uz-UZ").format(price) + " so'm";
  };

  // Talabalar jadvali
  const studentsColumns: ColumnsType<GroupStudent> = [
    {
      title: "#",
      key: "index",
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: "F.I.O",
      key: "fullName",
      render: (_, record) => (
        <a
          onClick={() =>
            router.push(`/dashboard/students/${record.student.id}`)
          }
        >
          {record.student.lastName} {record.student.firstName}
        </a>
      ),
    },
    {
      title: "Telefon",
      key: "phone",
      render: (_, record) => (
        <span>
          <PhoneOutlined className="mr-1" />
          {record.student.phone}
        </span>
      ),
    },
    {
      title: "Qo'shilgan sana",
      key: "enrollDate",
      render: (_, record) =>
        new Date(record.enrollDate).toLocaleDateString("uz-UZ"),
    },
    {
      title: "Individual narx",
      key: "price",
      render: (_, record) => {
        if (record.price) {
          return (
            <span>
              {formatPrice(Number(record.price))}
              {record.discountReason && (
                <div className="text-xs text-gray-500">
                  {record.discountReason}
                </div>
              )}
            </span>
          );
        }
        return <span className="text-gray-400">Standart</span>;
      },
    },
    {
      title: "Status",
      key: "status",
      render: (_, record) => {
        const config: Record<string, { color: string; text: string }> = {
          ACTIVE: { color: "green", text: "Aktiv" },
          COMPLETED: { color: "blue", text: "Tugatgan" },
          DROPPED: { color: "red", text: "Chiqib ketgan" },
        };
        const c = config[record.status] || {
          color: "default",
          text: record.status,
        };
        return <Tag color={c.color}>{c.text}</Tag>;
      },
    },
    {
      title: "Amallar",
      key: "actions",
      render: (_, record) => (
        <Popconfirm
          title="Talabani guruhdan o'chirish"
          description="Haqiqatan ham bu talabani guruhdan o'chirmoqchimisiz?"
          onConfirm={() => handleRemoveStudent(record.student.id)}
          okText="Ha"
          cancelText="Yo'q"
        >
          <Button type="link" danger icon={<DeleteOutlined />}>
            O'chirish
          </Button>
        </Popconfirm>
      ),
    },
  ];

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  // Guruh topilmadi
  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Empty description="Guruh topilmadi" />
      </div>
    );
  }

  // Davomat statistikasi
  const getAttendanceCount = (status: string) => {
    if (!stats?.attendance) return 0;
    const found = stats.attendance.find((a) => a.status === status);
    return found?._count || 0;
  };

  // Guruh narxi
  const groupPrice = group.price || group.course.price;

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
                  className="text-gray-600 hover:text-gray-900"
                >
                  O'qituvchilar
                </a>
                <a
                  href="/dashboard/groups"
                  className="text-indigo-600 font-medium"
                >
                  Guruhlar
                </a>
                <a
                  href="/dashboard/courses"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Kurslar
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
          onClick={() => router.push("/dashboard/groups")}
          className="mb-4"
        >
          Orqaga
        </Button>

        {/* Guruh sarlavhasi */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900">
                  {group.name}
                </h2>
                <Tag
                  color={
                    group.status === "ACTIVE"
                      ? "green"
                      : group.status === "COMPLETED"
                        ? "blue"
                        : "red"
                  }
                >
                  {group.status === "ACTIVE"
                    ? "Aktiv"
                    : group.status === "COMPLETED"
                      ? "Tugallangan"
                      : "Yopilgan"}
                </Tag>
              </div>
              <p className="text-gray-500 mt-1">
                <BookOutlined className="mr-1" />
                {group.course.name}
                {group.course.level && ` (${group.course.level})`}
              </p>
            </div>
            {group.status === "ACTIVE" && (
              <Button
                type="primary"
                icon={<UserAddOutlined />}
                size="large"
                onClick={() => {
                  form.resetFields();
                  form.setFieldsValue({ price: Number(groupPrice) });
                  setIsAddStudentModalOpen(true);
                }}
              >
                Talaba qo'shish
              </Button>
            )}
          </div>
        </div>

        {/* Statistika */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Talabalar"
                value={group._count.groupStudents}
                suffix={`/ ${group.maxStudents}`}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Guruh narxi"
                value={Number(groupPrice)}
                formatter={(val) => formatPrice(Number(val))}
                prefix={<DollarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Jami to'lovlar"
                value={stats?.totalPayments || 0}
                formatter={(val) => formatPrice(Number(val))}
                prefix={<DollarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Davomat"
                value={getAttendanceCount("PRESENT")}
                suffix={`/ ${group._count.attendances || 0}`}
                prefix={<CheckCircleOutlined />}
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
                    <Descriptions.Item label="O'qituvchi">
                      {group.teacher.lastName} {group.teacher.firstName}
                      {group.teacher.phone && (
                        <div className="text-xs text-gray-500">
                          <PhoneOutlined className="mr-1" />
                          {group.teacher.phone}
                        </div>
                      )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Kurs">
                      {group.course.name}
                      {group.course.level && ` (${group.course.level})`}
                    </Descriptions.Item>
                    <Descriptions.Item label="Dars kunlari">
                      <CalendarOutlined className="mr-1" />
                      {formatScheduleDays(group.scheduleDays)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Dars vaqti">
                      <ClockCircleOutlined className="mr-1" />
                      {group.scheduleTime || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Boshlanish sanasi">
                      {new Date(group.startDate).toLocaleDateString("uz-UZ")}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tugash sanasi">
                      {group.endDate
                        ? new Date(group.endDate).toLocaleDateString("uz-UZ")
                        : "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Xona">
                      {group.roomNumber || "-"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Filial">
                      {group.branch || "-"}
                    </Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: "students",
                label: (
                  <span>
                    <TeamOutlined className="mr-1" />
                    Talabalar ({group._count.groupStudents})
                  </span>
                ),
                children: (
                  <div>
                    {group.groupStudents.length > 0 ? (
                      <Table
                        columns={studentsColumns}
                        dataSource={group.groupStudents}
                        rowKey="id"
                        pagination={false}
                        scroll={{ x: 600 }}
                      />
                    ) : (
                      <Empty description="Hali talabalar qo'shilmagan" />
                    )}
                  </div>
                ),
              },
              {
                key: "attendance",
                label: (
                  <span>
                    <CalendarOutlined className="mr-1" />
                    Davomat
                  </span>
                ),
                children: (
                  <div>
                    {/* Davomat belgilash tugmasi */}
                    <div className="mb-4 flex justify-between items-center">
                      <h3 className="text-lg font-medium">Davomat tarixi</h3>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() =>
                          router.push(
                            `/dashboard/attendance/mark?groupId=${id}`,
                          )
                        }
                      >
                        Davomat belgilash
                      </Button>
                    </div>

                    {loadingAttendance ? (
                      <div className="text-center py-8">
                        <Spin />
                      </div>
                    ) : (
                      <>
                        {/* Statistika */}
                        <Row gutter={[16, 16]} className="mb-4">
                          <Col xs={12} sm={6}>
                            <Card
                              className="text-center bg-blue-50"
                              size="small"
                            >
                              <Statistic
                                title="Jami darslar"
                                value={attendanceStats?.totalLessons || 0}
                                valueStyle={{ fontSize: "18px" }}
                                prefix={<CalendarOutlined />}
                              />
                            </Card>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Card
                              className="text-center bg-green-50"
                              size="small"
                            >
                              <Statistic
                                title="Kelgan"
                                value={
                                  (attendanceStats?.present || 0) +
                                  (attendanceStats?.late || 0)
                                }
                                valueStyle={{
                                  color: "#52c41a",
                                  fontSize: "18px",
                                }}
                                prefix={<CheckCircleOutlined />}
                              />
                            </Card>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Card
                              className="text-center bg-red-50"
                              size="small"
                            >
                              <Statistic
                                title="Kelmagan"
                                value={attendanceStats?.absent || 0}
                                valueStyle={{
                                  color: "#ff4d4f",
                                  fontSize: "18px",
                                }}
                                prefix={<CloseCircleOutlined />}
                              />
                            </Card>
                          </Col>
                          <Col xs={12} sm={6}>
                            <Card className="text-center" size="small">
                              <Statistic
                                title="O'rtacha foiz"
                                value={attendanceStats?.attendanceRate || 0}
                                suffix="%"
                                valueStyle={{
                                  color: "#1890ff",
                                  fontSize: "18px",
                                }}
                                prefix={<PercentageOutlined />}
                              />
                            </Card>
                          </Col>
                        </Row>

                        {/* Eng yaxshi va eng yomon talabalar */}
                        {studentRankings &&
                          (studentRankings.best || studentRankings.worst) && (
                            <Row gutter={[16, 16]} className="mb-4">
                              {studentRankings.best && (
                                <Col xs={24} sm={12}>
                                  <Card
                                    size="small"
                                    className="border-green-200 bg-green-50"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="bg-green-500 text-white p-2 rounded-full">
                                        <CrownOutlined className="text-lg" />
                                      </div>
                                      <div className="flex-1">
                                        <div className="text-xs text-gray-500">
                                          Eng yaxshi davomat
                                        </div>
                                        <a
                                          onClick={() =>
                                            router.push(
                                              `/dashboard/students/${studentRankings.best!.student.id}`,
                                            )
                                          }
                                          className="font-medium text-green-700 hover:text-green-800"
                                        >
                                          {
                                            studentRankings.best.student
                                              .lastName
                                          }{" "}
                                          {
                                            studentRankings.best.student
                                              .firstName
                                          }
                                        </a>
                                      </div>
                                      <div className="text-right">
                                        <div className="text-2xl font-bold text-green-600">
                                          {
                                            studentRankings.best.stats
                                              .attendanceRate
                                          }
                                          %
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {studentRankings.best.stats.present +
                                            studentRankings.best.stats.late}
                                          /{studentRankings.best.stats.total}
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                </Col>
                              )}
                              {studentRankings.worst &&
                                studentRankings.best?.student.id !==
                                  studentRankings.worst?.student.id && (
                                  <Col xs={24} sm={12}>
                                    <Card
                                      size="small"
                                      className="border-red-200 bg-red-50"
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="bg-red-500 text-white p-2 rounded-full">
                                          <FrownOutlined className="text-lg" />
                                        </div>
                                        <div className="flex-1">
                                          <div className="text-xs text-gray-500">
                                            Eng past davomat
                                          </div>
                                          <a
                                            onClick={() =>
                                              router.push(
                                                `/dashboard/students/${studentRankings.worst!.student.id}`,
                                              )
                                            }
                                            className="font-medium text-red-700 hover:text-red-800"
                                          >
                                            {
                                              studentRankings.worst.student
                                                .lastName
                                            }{" "}
                                            {
                                              studentRankings.worst.student
                                                .firstName
                                            }
                                          </a>
                                        </div>
                                        <div className="text-right">
                                          <div className="text-2xl font-bold text-red-600">
                                            {
                                              studentRankings.worst.stats
                                                .attendanceRate
                                            }
                                            %
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {studentRankings.worst.stats
                                              .present +
                                              studentRankings.worst.stats.late}
                                            /{studentRankings.worst.stats.total}
                                          </div>
                                        </div>
                                      </div>
                                    </Card>
                                  </Col>
                                )}
                            </Row>
                          )}

                        {/* Davomat tarixi jadvali */}
                        {attendanceSessions.length > 0 ? (
                          <Table
                            size="small"
                            dataSource={attendanceSessions}
                            rowKey={(record) =>
                              `${record.groupId}-${record.date}`
                            }
                            pagination={{ pageSize: 10 }}
                            columns={[
                              {
                                title: "Sana",
                                key: "date",
                                render: (_, record) => (
                                  <span>
                                    <CalendarOutlined className="mr-2" />
                                    {dayjs(record.date).format("DD.MM.YYYY")}
                                  </span>
                                ),
                              },
                              {
                                title: "Keldi",
                                key: "present",
                                render: (_, record) => (
                                  <Tag color="green">
                                    <CheckCircleOutlined />{" "}
                                    {record.stats.present + record.stats.late}
                                  </Tag>
                                ),
                              },
                              {
                                title: "Kelmadi",
                                key: "absent",
                                render: (_, record) => (
                                  <Tag color="red">
                                    <CloseCircleOutlined />{" "}
                                    {record.stats.absent}
                                  </Tag>
                                ),
                              },
                              {
                                title: "Foiz",
                                key: "rate",
                                render: (_, record) => (
                                  <Tag
                                    color={
                                      record.stats.attendanceRate >= 80
                                        ? "green"
                                        : record.stats.attendanceRate >= 50
                                          ? "orange"
                                          : "red"
                                    }
                                  >
                                    {record.stats.attendanceRate}%
                                  </Tag>
                                ),
                              },
                              {
                                title: "Amal",
                                key: "action",
                                render: (_, record) => (
                                  <Button
                                    type="link"
                                    size="small"
                                    onClick={() =>
                                      router.push(
                                        `/dashboard/attendance/mark?groupId=${id}&date=${dayjs(record.date).format("YYYY-MM-DD")}`,
                                      )
                                    }
                                  >
                                    Ko'rish
                                  </Button>
                                ),
                              },
                            ]}
                          />
                        ) : (
                          <Empty
                            description="Hali davomat belgilanmagan"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          >
                            <Button
                              type="primary"
                              onClick={() =>
                                router.push(
                                  `/dashboard/attendance/mark?groupId=${id}`,
                                )
                              }
                            >
                              Davomat belgilash
                            </Button>
                          </Empty>
                        )}
                      </>
                    )}
                  </div>
                ),
              },
              {
                key: "payments",
                label: (
                  <span>
                    <DollarOutlined className="mr-1" />
                    To'lovlar
                  </span>
                ),
                children: (
                  <div>
                    {/* Joriy oy statistikasi */}
                    <Row gutter={[16, 16]} className="mb-4">
                      <Col xs={12}>
                        <Card className="text-center">
                          <Statistic
                            title="Jami to'lovlar"
                            value={stats?.totalPayments || 0}
                            formatter={(val) => formatPrice(Number(val))}
                            valueStyle={{ color: "#52c41a" }}
                          />
                        </Card>
                      </Col>
                      <Col xs={12}>
                        <Card className="text-center">
                          <Statistic
                            title="To'lovlar soni"
                            value={stats?.paymentCount || 0}
                          />
                        </Card>
                      </Col>
                    </Row>

                    {/* Joriy oy to'lovlari chek-listi */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-base font-semibold text-gray-800">
                          Joriy oy to'lovlari chek-listi
                          {paymentChecklist && (
                            <span className="ml-2 text-sm font-normal text-gray-500">
                              ({paymentChecklist.currentMonthName}{" "}
                              {paymentChecklist.currentYear})
                            </span>
                          )}
                        </h3>
                        {paymentChecklist && (
                          <div className="text-sm text-gray-500">
                            <span className="text-green-600 font-medium">
                              {paymentChecklist.checklist.filter((s) => s.hasPaid).length}
                            </span>
                            /{paymentChecklist.checklist.length} to'lagan
                          </div>
                        )}
                      </div>

                      {loadingChecklist ? (
                        <div className="flex justify-center py-8">
                          <Spin />
                        </div>
                      ) : !paymentChecklist ||
                        paymentChecklist.checklist.length === 0 ? (
                        <Empty
                          description="Bu guruhda hali o'quvchilar yo'q"
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="text-left py-2 px-3 font-medium text-gray-600 w-12">
                                  T/r
                                </th>
                                <th className="text-left py-2 px-3 font-medium text-gray-600">
                                  O'quvchi F.I.SH.
                                </th>
                                <th className="text-center py-2 px-3 font-medium text-gray-600 w-36">
                                  Joriy oy holati
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {paymentChecklist.checklist.map((item) => (
                                <tr
                                  key={item.studentId}
                                  className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                >
                                  <td className="py-2 px-3 text-gray-500">
                                    {item.index}
                                  </td>
                                  <td className="py-2 px-3">
                                    <span
                                      className="font-medium text-gray-800 cursor-pointer hover:text-indigo-600"
                                      onClick={() =>
                                        router.push(
                                          `/dashboard/students/${item.studentId}`,
                                        )
                                      }
                                    >
                                      {item.lastName} {item.firstName}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="flex justify-center">
                                      {item.hasPaid ? (
                                        <Check className="text-green-600 h-5 w-5" />
                                      ) : (
                                        <X className="text-red-600 h-5 w-5" />
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      {/* Talaba qo'shish modal */}
      <Modal
        title={
          <Space>
            <UserAddOutlined />
            Talaba qo'shish
          </Space>
        }
        open={isAddStudentModalOpen}
        onCancel={() => {
          setIsAddStudentModalOpen(false);
          form.resetFields();
          setStudentSearchText("");
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleAddStudent}>
          <Form.Item
            label="Talabani qidiring"
            name="studentId"
            rules={[{ required: true, message: "Talabani tanlang" }]}
          >
            <Select
              showSearch
              placeholder="Ism, familiya yoki telefon bo'yicha qidiring"
              onSearch={setStudentSearchText}
              filterOption={false}
              notFoundContent={
                studentSearchText ? (
                  searchStudents.length === 0 ? (
                    <Empty
                      description="Talaba topilmadi"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : null
                ) : (
                  <div className="p-2 text-gray-500">
                    Qidirish uchun yozing...
                  </div>
                )
              }
            >
              {searchStudents.map((student) => (
                <Option key={student.id} value={student.id}>
                  <div>
                    <span className="font-medium">
                      {student.lastName} {student.firstName}
                    </span>
                    <span className="text-gray-500 ml-2">{student.phone}</span>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Individual narx (so'm)" name="price">
                <InputNumber
                  style={{ width: "100%" }}
                  min={0}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
                  }
                  parser={(value) => value!.replace(/\s/g, "") as any}
                  placeholder={`Default: ${formatPrice(Number(groupPrice))}`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Chegirma sababi" name="discountReason">
                <Input placeholder="Masalan: 10% chegirma" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={addingStudent}
                size="large"
              >
                Qo'shish
              </Button>
              <Button
                onClick={() => {
                  setIsAddStudentModalOpen(false);
                  form.resetFields();
                  setStudentSearchText("");
                }}
                size="large"
              >
                Bekor qilish
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
