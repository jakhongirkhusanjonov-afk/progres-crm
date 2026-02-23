"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Tabs,
  Table,
  Empty,
  Spin,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  message,
  Breadcrumb,
  Row,
  Col,
  Statistic,
  Divider,
  Popconfirm,
  Space,
  Result,
} from "antd";
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
  TeamOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  ManOutlined,
  WomanOutlined,
  PercentageOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FilterOutlined,
  LockOutlined,
  UndoOutlined,
  WarningOutlined,
  InboxOutlined,
  SettingOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from "@ant-design/icons";
import { NURMAKONs } from "antd";
import Link from "next/link";
import dayjs from "dayjs";
import DashboardLayout from "@/components/DashboardLayout";

const { Option } = Select;

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  parentPhone?: string;
  dateOfBirth?: string;
  gender?: "MALE" | "FEMALE";
  status: "ACTIVE" | "GRADUATED" | "SUSPENDED" | "DROPPED";
  enrollmentDate: string;
  createdAt: string;
  createdBy: {
    fullName: string;
    email: string;
  };
  groupStudents: any[];
  payments: any[];
  attendances: any[];
  _count: {
    payments: number;
    attendances: number;
    testResults: number;
  };
}

interface Group {
  id: string;
  name: string;
  course: {
    name: string;
  };
  teacher: {
    firstName: string;
    lastName: string;
  };
  status: string;
}

interface AttendanceData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    groups: {
      id: string;
      name: string;
      course: { name: string };
    }[];
  };
  attendances: {
    id: string;
    date: string;
    status: string;
    notes: string | null;
    group: {
      id: string;
      name: string;
      course: { name: string };
    };
  }[];
  stats: {
    allTime: {
      total: number;
      present: number;
      late: number;
      absent: number;
      excused: number;
      attendanceRate: number;
    };
    filtered: {
      total: number;
      present: number;
      late: number;
      absent: number;
      excused: number;
      attendanceRate: number;
    } | null;
    byGroup: {
      group: { id: string; name: string; course: { name: string } };
      stats: {
        total: number;
        present: number;
        late: number;
        absent: number;
        attendanceRate: number;
      };
    }[];
  };
}

export default function StudentProfilePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.id as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [groupLoading, setGroupLoading] = useState(false);
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [form] = Form.useForm();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);

  // Davomat state
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(
    null,
  );
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("");

  // Parol o'zgartirish state
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Permission checks
  const isStudent = currentUser?.role === "STUDENT";
  const isOwnProfile = isStudent && currentUser?.studentId === studentId;
  const canEdit =
    !isStudent ||
    currentUser?.role === "SUPER_ADMIN" ||
    currentUser?.role === "ADMIN";
  const isReadOnly = isStudent;
  const hasForbiddenAccess = isStudent && currentUser?.studentId !== studentId;

  // Get current user on mount
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setCurrentUser(JSON.parse(userData));
    }
  }, []);

  // Talaba ma'lumotlarini yuklash
  const fetchStudent = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/students/${studentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          message.error("Talaba topilmadi");
          router.push("/dashboard/students");
          return;
        }
        if (response.status === 403) {
          setLoading(false);
          return;
        }
        throw new Error("Failed to fetch");
      }

      const data = await response.json();
      setStudent(data.student);
    } catch (error) {
      message.error("Ma'lumotlarni yuklashda xatolik");
      console.error("Error fetching student:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mavjud guruhlarni yuklash
  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/groups?status=ACTIVE", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  // Davomat ma'lumotlarini yuklash
  const fetchAttendance = async () => {
    setAttendanceLoading(true);
    try {
      const token = localStorage.getItem("token");
      let url = `/api/attendance/student/${studentId}?limit=100`;
      if (selectedMonth) url += `&month=${selectedMonth}`;
      if (selectedGroupFilter) url += `&groupId=${selectedGroupFilter}`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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

  // Oylar ro'yxati
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

  useEffect(() => {
    if (studentId) {
      fetchStudent();
    }
  }, [studentId]);

  useEffect(() => {
    if (studentId) {
      fetchAttendance();
    }
  }, [studentId, selectedMonth, selectedGroupFilter]);

  // Tahrirlash modali
  const showEditModal = () => {
    if (student) {
      form.setFieldsValue({
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.phone,
        parentPhone: student.parentPhone,
        gender: student.gender,
        status: student.status,
        dateOfBirth: student.dateOfBirth ? dayjs(student.dateOfBirth) : null,
      });
      setIsEditModalOpen(true);
    }
  };

  // Guruh qo'shish modali
  const showGroupModal = async () => {
    await fetchGroups();
    setSelectedGroupId("");
    setIsGroupModalOpen(true);
  };

  const handleEditSubmit = async (values: any) => {
    setEditLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...values,
          dateOfBirth: values.dateOfBirth
            ? values.dateOfBirth.toISOString()
            : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || "Xatolik yuz berdi");
        return;
      }

      message.success("Talaba muvaffaqiyatli yangilandi");
      setIsEditModalOpen(false);
      fetchStudent();
    } catch (error) {
      message.error("Xatolik yuz berdi");
    } finally {
      setEditLoading(false);
    }
  };

  // Guruhga qo'shish
  const handleAddToGroup = async () => {
    if (!selectedGroupId) {
      message.warning("Guruh tanlang");
      return;
    }

    setGroupLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/students/${studentId}/groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ groupId: selectedGroupId }),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || "Xatolik yuz berdi");
        return;
      }

      message.success("Talaba guruhga qo'shildi");
      setIsGroupModalOpen(false);
      fetchStudent();
    } catch (error) {
      message.error("Xatolik yuz berdi");
    } finally {
      setGroupLoading(false);
    }
  };

  // Guruhdan chiqarish
  const handleRemoveFromGroup = async (groupStudentId: string) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/students/${studentId}/groups/${groupStudentId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to remove");
      }

      message.success("Talaba guruhdan chiqarildi");
      fetchStudent();
    } catch (error) {
      message.error("Xatolik yuz berdi");
    }
  };

  // Arxivga olish
  const handleArchive = async () => {
    setArchiveLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/students/${studentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || "Xatolik yuz berdi");
        return;
      }

      message.success("Talaba arxivga olindi. Login huquqi bekor qilindi.");
      setArchiveModalOpen(false);
      router.push("/dashboard/students");
    } catch (error) {
      message.error("Xatolik yuz berdi");
    } finally {
      setArchiveLoading(false);
    }
  };

  // Qayta faollashtirish
  const handleReactivate = async () => {
    setReactivateLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/students/${studentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          firstName: student?.firstName,
          lastName: student?.lastName,
          phone: student?.phone,
          status: "ACTIVE",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || "Xatolik yuz berdi");
        return;
      }

      message.success(
        "Talaba qayta faollashtirildi. Endi eski login/parol bilan kirishi mumkin.",
      );
      fetchStudent();
    } catch (error) {
      message.error("Xatolik yuz berdi");
    } finally {
      setReactivateLoading(false);
    }
  };

  // Parolni o'zgartirish
  const handleChangePassword = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error("Parollar mos kelmaydi");
      return;
    }

    setPasswordLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/users/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
          confirmPassword: values.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || "Parolni o'zgartirishda xatolik");
        return;
      }

      message.success("Parol muvaffaqiyatli o'zgartirildi!");
      passwordForm.resetFields();
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (error) {
      message.error("Parolni o'zgartirishda xatolik");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Spin size="large" />
        </div>
      </DashboardLayout>
    );
  }

  // Check forbidden access - Student trying to view another student's profile
  if (hasForbiddenAccess) {
    return (
      <DashboardLayout>
        <Result
          status="403"
          title="403"
          subTitle="Sizda bu sahifaga kirish huquqi yo'q"
          extra={
            <Button
              type="primary"
              onClick={() =>
                router.push(`/dashboard/students/${currentUser?.studentId}`)
              }
            >
              Profilimga qaytish
            </Button>
          }
        />
      </DashboardLayout>
    );
  }

  if (!student) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Empty description="Talaba topilmadi" />
        </div>
      </DashboardLayout>
    );
  }

  const statusConfig: Record<string, { color: string; text: string }> = {
    ACTIVE: { color: "green", text: "Aktiv" },
    GRADUATED: { color: "blue", text: "Bitirgan" },
    SUSPENDED: { color: "orange", text: "To'xtatilgan" },
    DROPPED: { color: "red", text: "Arxiv" },
  };

  // Arxivlangan yoki faol emasligini tekshirish (GRADUATED, SUSPENDED, DROPPED = login bloklangan)
  const isArchived =
    student?.status === "DROPPED" ||
    student?.status === "GRADUATED" ||
    student?.status === "SUSPENDED";

  // To'lovlar jami
  const totalPayments = student.payments.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0,
  );

  // To'lovlar jadvali
  const paymentColumns = [
    {
      title: "Sana",
      dataIndex: "paymentDate",
      key: "paymentDate",
      render: (date: string) => new Date(date).toLocaleDateString("uz-UZ"),
    },
    {
      title: "Summa",
      dataIndex: "amount",
      key: "amount",
      render: (amount: number) => (
        <span className="font-medium text-green-600">
          {Number(amount).toLocaleString()} so'm
        </span>
      ),
    },
    {
      title: "Turi",
      dataIndex: "paymentType",
      key: "paymentType",
      render: (type: string) => {
        const types: Record<string, string> = {
          TUITION: "O'qish",
          REGISTRATION: "Ro'yxat",
          EXAM: "Imtihon",
          MATERIAL: "Material",
          OTHER: "Boshqa",
        };
        return types[type] || type;
      },
    },
    {
      title: "Usul",
      dataIndex: "method",
      key: "method",
      render: (method: string) => {
        const methods: Record<string, string> = {
          CASH: "Naqd",
          CARD: "Karta",
          BANK_TRANSFER: "Bank",
          PAYME: "Payme",
          CLICK: "Click",
          UZUM: "Uzum",
        };
        return methods[method] || method;
      },
    },
  ];

  // Davomat jadvali
  const attendanceColumns = [
    {
      title: "Sana",
      dataIndex: "date",
      key: "date",
      render: (date: string) => new Date(date).toLocaleDateString("uz-UZ"),
    },
    {
      title: "Holat",
      dataIndex: "status",
      key: "status",
      render: (status: string) => {
        const statusMap: Record<string, { color: string; text: string }> = {
          PRESENT: { color: "green", text: "Keldi" },
          ABSENT: { color: "red", text: "Kelmadi" },
          LATE: { color: "orange", text: "Kechikdi" },
          EXCUSED: { color: "blue", text: "Sababli" },
        };
        const config = statusMap[status] || { color: "default", text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: "Izoh",
      dataIndex: "notes",
      key: "notes",
      render: (notes: string) => notes || "-",
    },
  ];

  // Guruhdan chiqarish ustuni uchun filter
  const studentGroupIds = student.groupStudents.map((gs: any) => gs.group.id);
  const filteredGroups = availableGroups.filter(
    (g) => !studentGroupIds.includes(g.id),
  );

  const tabItems = [
    {
      key: "info",
      label: "Ma'lumotlar",
      children: (
        <Descriptions bordered column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Familiya">
            {student.lastName}
          </Descriptions.Item>
          <Descriptions.Item label="Ism">{student.firstName}</Descriptions.Item>
          <Descriptions.Item label="Jinsi">
            {student.gender === "MALE" ? (
              <Space>
                <ManOutlined style={{ color: "#1890ff" }} />
                Erkak
              </Space>
            ) : student.gender === "FEMALE" ? (
              <Space>
                <WomanOutlined style={{ color: "#eb2f96" }} />
                Ayol
              </Space>
            ) : (
              "-"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Tug'ilgan sana">
            {student.dateOfBirth
              ? new Date(student.dateOfBirth).toLocaleDateString("uz-UZ")
              : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="Telefon">
            <a href={`tel:${student.phone}`} className="text-blue-600">
              {student.phone}
            </a>
          </Descriptions.Item>
          <Descriptions.Item label="Ota-ona telefoni">
            {student.parentPhone ? (
              <a href={`tel:${student.parentPhone}`} className="text-blue-600">
                {student.parentPhone}
              </a>
            ) : (
              "-"
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Ro'yxatdan o'tgan">
            {new Date(student.enrollmentDate).toLocaleDateString("uz-UZ")}
          </Descriptions.Item>
          <Descriptions.Item label="Yaratdi">
            {student.createdBy.fullName}
          </Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: "groups",
      label: (
        <span>
          <TeamOutlined /> Guruhlar ({student.groupStudents.length})
        </span>
      ),
      children: (
        <div>
          {/* Hide "Guruhga qo'shish" button for STUDENT */}
          {!isReadOnly && (
            <div className="mb-4">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={showGroupModal}
              >
                Guruhga qo'shish
              </Button>
            </div>
          )}
          {student.groupStudents.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {student.groupStudents.map((gs: any) => (
                <Card key={gs.id} size="small" className="shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-lg">
                        {gs.group.name}
                      </div>
                      <div className="text-gray-500">
                        {gs.group.course?.name}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Qo'shilgan:{" "}
                        {new Date(gs.enrollDate).toLocaleDateString("uz-UZ")}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Tag color={gs.status === "ACTIVE" ? "green" : "default"}>
                        {gs.status === "ACTIVE" ? "Aktiv" : gs.status}
                      </Tag>
                      {/* Hide "Chiqarish" button for STUDENT */}
                      {!isReadOnly && (
                        <Popconfirm
                          title="Guruhdan chiqarish"
                          description="Talabani bu guruhdan chiqarishni xohlaysizmi?"
                          onConfirm={() => handleRemoveFromGroup(gs.id)}
                          okText="Ha"
                          cancelText="Yo'q"
                        >
                          <Button size="small" danger type="link">
                            Chiqarish
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Empty description="Hech qanday guruhga qo'shilmagan" />
          )}
        </div>
      ),
    },
    {
      key: "payments",
      label: (
        <span>
          <DollarOutlined /> To'lovlar ({student._count.payments})
        </span>
      ),
      children: (
        <div>
          {student.payments.length > 0 && (
            <div className="mb-4 p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-600">Jami to'langan:</div>
              <div className="text-2xl font-bold text-green-600">
                {totalPayments.toLocaleString()} so'm
              </div>
            </div>
          )}
          {student.payments.length > 0 ? (
            <Table
              columns={paymentColumns}
              dataSource={student.payments}
              rowKey="id"
              pagination={{ pageSize: 5 }}
            />
          ) : (
            <Empty description="To'lovlar mavjud emas" />
          )}
        </div>
      ),
    },
    {
      key: "attendance",
      label: (
        <span>
          <CheckCircleOutlined /> Davomat ({student._count.attendances})
        </span>
      ),
      children: (
        <div>
          {/* Filterlar */}
          <div className="mb-4 flex flex-wrap gap-4">
            <div>
              <span className="text-gray-500 mr-2">Oy:</span>
              <Select
                placeholder="Barcha oylar"
                style={{ width: 180 }}
                allowClear
                value={selectedMonth || undefined}
                onChange={(val) => setSelectedMonth(val || "")}
              >
                {getMonthOptions().map((month) => (
                  <Option key={month.value} value={month.value}>
                    {month.label}
                  </Option>
                ))}
              </Select>
            </div>
            <div>
              <span className="text-gray-500 mr-2">Guruh:</span>
              <Select
                placeholder="Barcha guruhlar"
                style={{ width: 200 }}
                allowClear
                value={selectedGroupFilter || undefined}
                onChange={(val) => setSelectedGroupFilter(val || "")}
              >
                {student.groupStudents.map((gs: any) => (
                  <Option key={gs.group.id} value={gs.group.id}>
                    {gs.group.name}
                  </Option>
                ))}
              </Select>
            </div>
          </div>

          {attendanceLoading ? (
            <div className="text-center py-8">
              <Spin />
            </div>
          ) : attendanceData ? (
            <>
              {/* Davomat statistikasi */}
              <Row gutter={[16, 16]} className="mb-4">
                <Col xs={12} sm={6}>
                  <Card size="small" className="text-center bg-green-50">
                    <Statistic
                      title="Keldi"
                      value={
                        attendanceData.stats.allTime.present +
                        attendanceData.stats.allTime.late
                      }
                      valueStyle={{ color: "#52c41a", fontSize: "18px" }}
                      prefix={<CheckCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small" className="text-center bg-red-50">
                    <Statistic
                      title="Kelmadi"
                      value={attendanceData.stats.allTime.absent}
                      valueStyle={{ color: "#ff4d4f", fontSize: "18px" }}
                      prefix={<CloseCircleOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small" className="text-center">
                    <Statistic
                      title="Jami darslar"
                      value={attendanceData.stats.allTime.total}
                      valueStyle={{ fontSize: "18px" }}
                      prefix={<CalendarOutlined />}
                    />
                  </Card>
                </Col>
                <Col xs={12} sm={6}>
                  <Card size="small" className="text-center">
                    <div className="text-gray-500 text-sm mb-1">
                      Davomat foizi
                    </div>
                    <NURMAKONs
                      type="circle"
                      percent={attendanceData.stats.allTime.attendanceRate}
                      size={60}
                      status={
                        attendanceData.stats.allTime.attendanceRate >= 80
                          ? "success"
                          : attendanceData.stats.allTime.attendanceRate >= 50
                            ? "normal"
                            : "exception"
                      }
                    />
                  </Card>
                </Col>
              </Row>

              {/* Guruhlar bo'yicha statistika */}
              {attendanceData.stats.byGroup.length > 1 && (
                <div className="mb-4">
                  <Divider>Guruhlar bo'yicha</Divider>
                  <Row gutter={[16, 16]}>
                    {attendanceData.stats.byGroup.map((gs) => (
                      <Col xs={24} sm={12} md={8} key={gs.group.id}>
                        <Card size="small">
                          <div className="font-medium">{gs.group.name}</div>
                          <div className="text-xs text-gray-500 mb-2">
                            {gs.group.course.name}
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex gap-2">
                              <Tag color="green">
                                {gs.stats.present + gs.stats.late} keldi
                              </Tag>
                              <Tag color="red">{gs.stats.absent} kelmadi</Tag>
                            </div>
                            <NURMAKONs
                              type="circle"
                              percent={gs.stats.attendanceRate}
                              size={40}
                              format={(percent) => `${percent}%`}
                            />
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </div>
              )}

              {/* Davomat tarixi jadvali */}
              {attendanceData.attendances.length > 0 ? (
                <Table
                  size="small"
                  dataSource={attendanceData.attendances}
                  rowKey="id"
                  pagination={{ pageSize: 15 }}
                  columns={[
                    {
                      title: "Sana",
                      key: "date",
                      width: 120,
                      render: (_, record) =>
                        dayjs(record.date).format("DD.MM.YYYY"),
                    },
                    {
                      title: "Guruh",
                      key: "group",
                      render: (_, record) => (
                        <a
                          onClick={() =>
                            router.push(`/dashboard/groups/${record.group.id}`)
                          }
                        >
                          <div className="font-medium">{record.group.name}</div>
                          <div className="text-xs text-gray-500">
                            {record.group.course.name}
                          </div>
                        </a>
                      ),
                    },
                    {
                      title: "Holat",
                      key: "status",
                      width: 120,
                      render: (_, record) => {
                        const statusMap: Record<
                          string,
                          { color: string; text: string; icon: any }
                        > = {
                          PRESENT: {
                            color: "green",
                            text: "Keldi",
                            icon: <CheckCircleOutlined />,
                          },
                          ABSENT: {
                            color: "red",
                            text: "Kelmadi",
                            icon: <CloseCircleOutlined />,
                          },
                          LATE: {
                            color: "orange",
                            text: "Kechikdi",
                            icon: <ClockCircleOutlined />,
                          },
                          EXCUSED: {
                            color: "blue",
                            text: "Sababli",
                            icon: <ExclamationCircleOutlined />,
                          },
                        };
                        const config = statusMap[record.status] || {
                          color: "default",
                          text: record.status,
                          icon: null,
                        };
                        return (
                          <Tag color={config.color} icon={config.icon}>
                            {config.text}
                          </Tag>
                        );
                      },
                    },
                    {
                      title: "Izoh",
                      key: "notes",
                      render: (_, record) => record.notes || "-",
                    },
                  ]}
                />
              ) : (
                <Empty description="Davomat ma'lumotlari yo'q" />
              )}
            </>
          ) : (
            <Empty description="Davomat ma'lumotlari yo'q" />
          )}
        </div>
      ),
    },
    // Sozlamalar tab - faqat talaba o'z profilini ko'rayotganda
    ...(isOwnProfile
      ? [
          {
            key: "settings",
            label: (
              <span>
                <SettingOutlined /> Sozlamalar
              </span>
            ),
            children: (
              <div className="max-w-md">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LockOutlined /> Parolni o'zgartirish
                </h3>

                <Form
                  form={passwordForm}
                  layout="vertical"
                  onFinish={handleChangePassword}
                >
                  <Form.Item
                    name="currentPassword"
                    label="Joriy parol"
                    rules={[
                      { required: true, message: "Joriy parolni kiriting" },
                    ]}
                  >
                    <Input
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Joriy parolingizni kiriting"
                      prefix={<LockOutlined className="text-gray-400" />}
                      suffix={
                        <Button
                          type="text"
                          size="small"
                          icon={
                            showCurrentPassword ? (
                              <EyeInvisibleOutlined />
                            ) : (
                              <EyeOutlined />
                            )
                          }
                          onClick={() =>
                            setShowCurrentPassword(!showCurrentPassword)
                          }
                        />
                      }
                    />
                  </Form.Item>

                  <Form.Item
                    name="newPassword"
                    label="Yangi parol"
                    rules={[
                      { required: true, message: "Yangi parolni kiriting" },
                      {
                        min: 6,
                        message:
                          "Parol kamida 6 belgidan iborat bo'lishi kerak",
                      },
                    ]}
                  >
                    <Input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Yangi parolni kiriting"
                      prefix={<LockOutlined className="text-gray-400" />}
                      suffix={
                        <Button
                          type="text"
                          size="small"
                          icon={
                            showNewPassword ? (
                              <EyeInvisibleOutlined />
                            ) : (
                              <EyeOutlined />
                            )
                          }
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        />
                      }
                    />
                  </Form.Item>

                  <Form.Item
                    name="confirmPassword"
                    label="Yangi parolni tasdiqlash"
                    dependencies={["newPassword"]}
                    rules={[
                      { required: true, message: "Parolni tasdiqlang" },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (
                            !value ||
                            getFieldValue("newPassword") === value
                          ) {
                            return Promise.resolve();
                          }
                          return Promise.reject(
                            new Error("Parollar mos kelmaydi"),
                          );
                        },
                      }),
                    ]}
                  >
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Yangi parolni qayta kiriting"
                      prefix={<LockOutlined className="text-gray-400" />}
                      suffix={
                        <Button
                          type="text"
                          size="small"
                          icon={
                            showConfirmPassword ? (
                              <EyeInvisibleOutlined />
                            ) : (
                              <EyeOutlined />
                            )
                          }
                          onClick={() =>
                            setShowConfirmPassword(!showConfirmPassword)
                          }
                        />
                      }
                    />
                  </Form.Item>

                  <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm text-gray-600">
                    <div className="font-medium mb-1">Parol talablari:</div>
                    <ul className="list-disc ml-4">
                      <li>Kamida 6 ta belgidan iborat bo'lishi kerak</li>
                    </ul>
                  </div>

                  <Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={passwordLoading}
                      icon={<LockOutlined />}
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
      : []),
  ];

  // Determine breadcrumb based on user role
  const breadcrumbItems = isStudent
    ? [{ title: "Profilim" }]
    : [
        { title: <Link href="/dashboard">Dashboard</Link> },
        { title: <Link href="/dashboard/students">Talabalar</Link> },
        { title: `${student.lastName} ${student.firstName}` },
      ];

  return (
    <DashboardLayout>
      <div>
        <Breadcrumb className="mb-4" items={breadcrumbItems} />

        {/* Header Card */}
        <Card className="mb-6">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Hide back button for STUDENT - they don't have students list access */}
              {!isStudent && (
                <Button
                  icon={<ArrowLeftOutlined />}
                  onClick={() => router.push("/dashboard/students")}
                >
                  Orqaga
                </Button>
              )}
              <div className="bg-indigo-100 p-4 rounded-full">
                <UserOutlined className="text-2xl text-indigo-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {student.lastName} {student.firstName}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <Tag color={statusConfig[student.status]?.color}>
                    {statusConfig[student.status]?.text}
                  </Tag>
                  <span className="text-gray-500">
                    <PhoneOutlined className="mr-1" />
                    {student.phone}
                  </span>
                  {student.gender && (
                    <span className="text-gray-500">
                      {student.gender === "MALE" ? (
                        <ManOutlined style={{ color: "#1890ff" }} />
                      ) : (
                        <WomanOutlined style={{ color: "#eb2f96" }} />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Action buttons - hide for STUDENT role */}
            {!isReadOnly && (
              <div className="flex gap-2 flex-wrap">
                <Button icon={<EditOutlined />} onClick={showEditModal}>
                  Tahrirlash
                </Button>
                {isArchived ? (
                  // Qayta faollashtirish tugmasi (arxivlangan talabalar uchun)
                  <Popconfirm
                    title="Talabani qayta faollashtirish"
                    description={
                      <div>
                        <p>Talaba qayta faollashtiriladi:</p>
                        <ul className="list-disc ml-4 mt-2 text-gray-600">
                          <li>Status ACTIVE ga o'zgaradi</li>
                          <li>Login huquqi qayta tiklanadi</li>
                          <li>Eski login/parol bilan kirishi mumkin</li>
                        </ul>
                      </div>
                    }
                    onConfirm={handleReactivate}
                    okText="Ha, faollashtir"
                    cancelText="Bekor qilish"
                    okButtonProps={{ loading: reactivateLoading }}
                  >
                    <Button
                      type="primary"
                      icon={<UndoOutlined />}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      Qayta faollashtirish
                    </Button>
                  </Popconfirm>
                ) : (
                  // Arxivga olish tugmasi
                  <Button
                    danger
                    icon={<InboxOutlined />}
                    onClick={() => setArchiveModalOpen(true)}
                  >
                    Arxivga olish
                  </Button>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Stats */}
        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Guruhlar"
                value={student.groupStudents.length}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="To'lovlar"
                value={student._count.payments}
                prefix={<DollarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Davomat"
                value={student._count.attendances}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Jami to'lov"
                value={totalPayments}
                suffix="so'm"
                valueStyle={{ fontSize: "18px" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Tabs */}
        <Card>
          <Tabs items={tabItems} />
        </Card>
      </div>

      {/* Edit Modal */}
      <Modal
        title="Talabani tahrirlash"
        open={isEditModalOpen}
        onCancel={() => setIsEditModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleEditSubmit}
          autoComplete="off"
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Familiya"
                name="lastName"
                rules={[{ required: true, message: "Familiya kiriting" }]}
              >
                <Input placeholder="Rahimov" />
              </Form.Item>
            </Col>
            <Col span={12}>
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
            <Col span={12}>
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
            <Col span={12}>
              <Form.Item label="Tug'ilgan sana" name="dateOfBirth">
                <DatePicker
                  style={{ width: "100%" }}
                  format="DD.MM.YYYY"
                  placeholder="Tanlang"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Telefon"
                name="phone"
                rules={[
                  { required: true, message: "Telefon kiriting" },
                  {
                    pattern: /^\+998\d{9}$/,
                    message: "+998901234567 formatida",
                  },
                ]}
              >
                <Input placeholder="+998901234567" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Ota-ona telefoni"
                name="parentPhone"
                rules={[
                  {
                    pattern: /^\+998\d{9}$/,
                    message: "+998901234567 formatida",
                  },
                ]}
              >
                <Input placeholder="+998901234567" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Status" name="status">
            <Select>
              <Option value="ACTIVE">
                <Tag color="green">Aktiv</Tag>
              </Option>
              <Option value="GRADUATED">
                <Tag color="blue">Bitirgan</Tag>
              </Option>
              <Option value="SUSPENDED">
                <Tag color="orange">To'xtatilgan</Tag>
              </Option>
              <Option value="DROPPED">
                <Tag color="red">Arxiv</Tag>
              </Option>
            </Select>
          </Form.Item>

          <Divider />

          <Form.Item>
            <div className="flex gap-4">
              <Button type="primary" htmlType="submit" loading={editLoading}>
                Saqlash
              </Button>
              <Button onClick={() => setIsEditModalOpen(false)}>
                Bekor qilish
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>

      {/* Add to Group Modal */}
      <Modal
        title="Guruhga qo'shish"
        open={isGroupModalOpen}
        onCancel={() => setIsGroupModalOpen(false)}
        onOk={handleAddToGroup}
        okText="Qo'shish"
        cancelText="Bekor qilish"
        confirmLoading={groupLoading}
      >
        <div className="py-4">
          <Select
            style={{ width: "100%" }}
            placeholder="Guruhni tanlang"
            value={selectedGroupId || undefined}
            onChange={setSelectedGroupId}
            size="large"
          >
            {filteredGroups.map((group) => (
              <Option key={group.id} value={group.id}>
                <div>
                  <div className="font-medium">{group.name}</div>
                  <div className="text-xs text-gray-500">
                    {group.course?.name} - {group.teacher?.lastName}{" "}
                    {group.teacher?.firstName}
                  </div>
                </div>
              </Option>
            ))}
          </Select>
          {filteredGroups.length === 0 && (
            <div className="mt-2 text-gray-500 text-sm">
              Barcha guruhlar allaqachon tayinlangan yoki aktiv guruhlar yo'q
            </div>
          )}
        </div>
      </Modal>

      {/* Archive Confirmation Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-orange-500">
            <WarningOutlined className="text-xl" />
            <span>Talabani arxivga o'tkazish</span>
          </div>
        }
        open={archiveModalOpen}
        onCancel={() => setArchiveModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setArchiveModalOpen(false)}>
            Bekor qilish
          </Button>,
          <Button
            key="archive"
            type="primary"
            danger
            loading={archiveLoading}
            onClick={handleArchive}
            icon={<InboxOutlined />}
          >
            Ha, arxivlash
          </Button>,
        ]}
        width={480}
      >
        <div className="py-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <ExclamationCircleOutlined className="text-orange-500 text-xl mt-0.5" />
              <div>
                <div className="font-medium text-gray-900 mb-2">DIQQAT!</div>
                <div className="text-gray-600 text-sm">
                  <strong>
                    {student?.lastName} {student?.firstName}
                  </strong>{" "}
                  arxivga o'tkaziladi.
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <LockOutlined className="text-red-500 mt-1" />
              <div>
                <div className="font-medium text-gray-800">
                  Login huquqi bekor qilinadi
                </div>
                <div className="text-sm text-gray-500">
                  Talaba tizimga kira olmaydi
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircleOutlined className="text-green-500 mt-1" />
              <div>
                <div className="font-medium text-gray-800">
                  Ma'lumotlar saqlanadi
                </div>
                <div className="text-sm text-gray-500">
                  Barcha to'lovlar, davomat tarixi saqlanib qoladi
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <UndoOutlined className="text-blue-500 mt-1" />
              <div>
                <div className="font-medium text-gray-800">
                  Qayta faollashtirish mumkin
                </div>
                <div className="text-sm text-gray-500">
                  Kerak bo'lsa talabani qayta tiklash mumkin
                </div>
              </div>
            </div>
          </div>

          <Divider />

          <div className="text-center text-gray-600">Davom etasizmi?</div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
