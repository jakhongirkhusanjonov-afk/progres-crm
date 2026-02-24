"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Card,
  Tag,
  Select,
  Empty,
  Spin,
  Progress,
  Collapse,
  Divider,
  message,
} from "antd";
import {
  DollarOutlined,
  TeamOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  BookOutlined,
  UserOutlined,
  PercentageOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Option } = Select;
const { Panel } = Collapse;

interface GroupDetail {
  group: {
    id: string;
    name: string;
    course: string;
  };
  studentCount: number;
  groupPrice: number;
  totalStudentPayments: number;
  teacherPercentage: number;
  lessonsCount: number;
  expectedLessons: number;
  attendanceCoefficient: number;
  teacherShare: number;
  monthlySalary: number;
  studentPrices?: { name: string; price: number }[];
}

interface SalaryPayment {
  id: string;
  amount: number;
  paymentDate: string;
  method: string;
  notes?: string;
}

interface SalaryData {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  period: string;
  groupsCount: number;
  groupDetails: GroupDetail[];
  summary: {
    totalStudentPayments: number;
    totalTeacherShare: number;
    totalSalary: number;
    paidAmount: number;
    debt: number;
  };
  payments: SalaryPayment[];
}

export default function MySalaryPage() {
  const router = useRouter();

  // State
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    dayjs().format("YYYY-MM"),
  );
  const [userRole, setUserRole] = useState<string>("");

  // User role tekshirish
  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      const user = JSON.parse(userData);
      setUserRole(user.role || "");

      // Faqat TEACHER kirishiga ruxsat
      if (user.role !== "TEACHER") {
        message.error("Sizda bu sahifaga kirish huquqi yo'q");
        router.push("/dashboard");
      }
    }
  }, [router]);

  // Maosh ma'lumotlarini yuklash
  const fetchSalaryData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(
        `/api/salary/my-salary?month=${selectedMonth}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 403) {
          message.error("Sizda bu sahifaga kirish huquqi yo'q");
          router.push("/dashboard");
          return;
        }
        throw new Error("Failed to fetch");
      }

      const data = await response.json();
      setSalaryData(data);
    } catch (error) {
      console.error("Error fetching salary data:", error);
      message.error("Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole === "TEACHER") {
      fetchSalaryData();
    }
  }, [selectedMonth, userRole]);

  // Narxni formatlash
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("uz-UZ").format(price) + " so'm";
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

  // To'lov usuli
  const getMethodLabel = (method: string) => {
    const methods: Record<string, string> = {
      CASH: "Naqd",
      CARD: "Karta",
      BANK_TRANSFER: "Bank o'tkazmasi",
      PAYME: "Payme",
      CLICK: "Click",
      UZUM: "Uzum",
    };
    return methods[method] || method;
  };

  // To'langan foiz
  const getPaidPercentage = () => {
    if (!salaryData || salaryData.summary.totalSalary === 0) return 100;
    return Math.round(
      (salaryData.summary.paidAmount / salaryData.summary.totalSalary) * 100,
    );
  };

  // Oy nomini olish
  const getMonthName = (period: string) => {
    return dayjs(period + "-01").format("MMMM YYYY");
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              <DollarOutlined className="mr-2" />
              Maoshim
            </h2>
            <p className="text-xs md:text-sm text-gray-600">
              O'z maosh hisobingiz
            </p>
          </div>
          <Select
            value={selectedMonth}
            onChange={setSelectedMonth}
            size="large"
            className="w-full sm:w-48"
            style={{ height: 44 }}
          >
            {getMonthOptions().map((month) => (
              <Option key={month.value} value={month.value}>
                {month.label}
              </Option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : !salaryData ? (
        <Empty
          description="Ma'lumot topilmadi"
          className="py-12"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
          {/* Asosiy statistika */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl p-3 md:p-4 border border-blue-100">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <TeamOutlined />
                <span className="text-xs font-medium">Guruhlar</span>
              </div>
              <div className="text-xl md:text-2xl font-bold text-blue-700">
                {salaryData.groupsCount}
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-3 md:p-4 border border-purple-100">
              <div className="flex items-center gap-2 text-purple-600 mb-1">
                <CalendarOutlined />
                <span className="text-xs font-medium">Darslar</span>
              </div>
              <div className="text-xl md:text-2xl font-bold text-purple-700">
                {salaryData.groupDetails.reduce(
                  (sum, g) => sum + g.lessonsCount,
                  0,
                )}
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-3 md:p-4 border border-green-100">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <CheckCircleOutlined />
                <span className="text-xs font-medium">To'langan</span>
              </div>
              <div className="text-base md:text-lg font-bold text-green-700 truncate">
                {formatPrice(salaryData.summary.paidAmount).replace(
                  " so'm",
                  "",
                )}
              </div>
            </div>

            <div
              className={`rounded-xl p-3 md:p-4 border ${
                salaryData.summary.debt > 0
                  ? "bg-red-50 border-red-100"
                  : "bg-green-50 border-green-100"
              }`}
            >
              <div
                className={`flex items-center gap-2 mb-1 ${
                  salaryData.summary.debt > 0
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >
                <ExclamationCircleOutlined />
                <span className="text-xs font-medium">Qarz</span>
              </div>
              <div
                className={`text-base md:text-lg font-bold truncate ${
                  salaryData.summary.debt > 0
                    ? "text-red-700"
                    : "text-green-700"
                }`}
              >
                {formatPrice(salaryData.summary.debt).replace(" so'm", "")}
              </div>
            </div>
          </div>

          {/* Oylik maosh kartasi */}
          <Card
            className="mb-4 shadow-sm"
            styles={{ body: { padding: "16px" } }}
          >
            <div className="text-center">
              <div className="text-gray-500 text-sm mb-2">
                {getMonthName(selectedMonth)} uchun hisoblangan maosh
              </div>
              <div className="text-3xl md:text-4xl font-bold text-orange-600 mb-3">
                {formatPrice(salaryData.summary.totalSalary)}
              </div>

              {/* Progress */}
              <Progress
                percent={getPaidPercentage()}
                size="small"
                status={
                  salaryData.summary.debt === 0
                    ? "success"
                    : getPaidPercentage() >= 50
                      ? "normal"
                      : "exception"
                }
                format={(percent) => `${percent}% to'langan`}
                className="max-w-md mx-auto"
              />

              {/* Status */}
              <div className="mt-3">
                {salaryData.summary.debt === 0 ? (
                  <Tag
                    color="green"
                    icon={<CheckCircleOutlined />}
                    className="text-sm px-3 py-1"
                  >
                    To'liq to'langan
                  </Tag>
                ) : salaryData.summary.paidAmount > 0 ? (
                  <Tag
                    color="orange"
                    icon={<ExclamationCircleOutlined />}
                    className="text-sm px-3 py-1"
                  >
                    Qisman to'langan
                  </Tag>
                ) : (
                  <Tag
                    color="red"
                    icon={<ExclamationCircleOutlined />}
                    className="text-sm px-3 py-1"
                  >
                    Hali to'lanmagan
                  </Tag>
                )}
              </div>
            </div>
          </Card>

          {/* Guruhlar bo'yicha breakdown */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <BookOutlined className="text-orange-500" />
                <span>Guruhlar bo'yicha hisob-kitob</span>
              </div>
            }
            className="mb-4 shadow-sm"
            styles={{ body: { padding: "12px" } }}
          >
            {salaryData.groupDetails.length === 0 ? (
              <Empty description="Aktiv guruhlar topilmadi" className="py-6" />
            ) : (
              <Collapse accordion className="bg-white">
                {salaryData.groupDetails.map((group) => (
                  <Panel
                    key={group.group.id}
                    header={
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 w-full pr-4">
                        <div>
                          <span className="font-medium">
                            {group.group.name}
                          </span>
                          <span className="text-gray-500 text-xs ml-2">
                            ({group.group.course})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Tag color="blue" className="text-xs">
                            <UserOutlined /> {group.studentCount}
                          </Tag>
                          <Tag color="purple" className="text-xs">
                            <PercentageOutlined /> {group.teacherPercentage}%
                          </Tag>
                          <span className="font-medium text-green-600 text-sm">
                            {formatPrice(group.monthlySalary)}
                          </span>
                        </div>
                      </div>
                    }
                  >
                    <div className="space-y-3">
                      {/* Hisob-kitob */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <h4 className="font-medium text-sm mb-2">
                          Maosh hisob-kitobi
                        </h4>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Talabalar soni:
                            </span>
                            <span>{group.studentCount} ta</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Jami to'lovlar:
                            </span>
                            <span>
                              {formatPrice(group.totalStudentPayments)}
                            </span>
                          </div>
                          <Divider className="my-2" />
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              O'qituvchi foizi:
                            </span>
                            <span className="font-medium">
                              {group.teacherPercentage}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              O'qituvchi ulushi:
                            </span>
                            <span className="font-medium text-blue-600">
                              {formatPrice(group.teacherShare)}
                            </span>
                          </div>
                          <Divider className="my-2" />
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              O'tilgan darslar:
                            </span>
                            <span>
                              {group.lessonsCount} / {group.expectedLessons}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">
                              Davomat koeff:
                            </span>
                            <span>{group.attendanceCoefficient}</span>
                          </div>
                          <Divider className="my-2" />
                          <div className="flex justify-between text-base font-medium">
                            <span>Oylik maosh:</span>
                            <span className="text-green-600">
                              {formatPrice(group.monthlySalary)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Panel>
                ))}
              </Collapse>
            )}
          </Card>

          {/* To'lovlar tarixi */}
          {salaryData.payments.length > 0 && (
            <Card
              title={
                <div className="flex items-center gap-2">
                  <DollarOutlined className="text-green-500" />
                  <span>To'lovlar tarixi</span>
                </div>
              }
              className="shadow-sm"
              styles={{ body: { padding: "12px" } }}
            >
              <div className="space-y-2">
                {salaryData.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100"
                  >
                    <div>
                      <div className="font-medium text-green-700">
                        {formatPrice(payment.amount)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {dayjs(payment.paymentDate).format("DD.MM.YYYY")}
                      </div>
                    </div>
                    <Tag color="green">{getMethodLabel(payment.method)}</Tag>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
