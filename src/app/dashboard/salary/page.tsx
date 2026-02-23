"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import MobileModal from "@/components/MobileModal";
import {
  Button,
  Select,
  Card,
  Tag,
  Form,
  InputNumber,
  Input,
  DatePicker,
  message,
  Empty,
  Spin,
  NURMAKONs,
} from "antd";
import {
  DollarOutlined,
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Option } = Select;

interface TeacherSalary {
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  period: string;
  groupsCount: number;
  groupDetails: any[];
  summary: {
    totalStudentPayments: number;
    totalTeacherShare: number;
    totalSalary: number;
    paidAmount: number;
    debt: number;
  };
}

interface SalaryStats {
  teachersCount: number;
  totalSalary: number;
  totalPaid: number;
  totalDebt: number;
}

export default function SalaryPage() {
  const router = useRouter();
  const [form] = Form.useForm();

  // State
  const [salaries, setSalaries] = useState<TeacherSalary[]>([]);
  const [stats, setStats] = useState<SalaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    dayjs().format("YYYY-MM"),
  );
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherSalary | null>(
    null,
  );
  const [paying, setPaying] = useState(false);

  // Maoshlarni yuklash
  const fetchSalaries = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/salary?month=${selectedMonth}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      setSalaries(data.salaries);
      setStats(data.stats);
    } catch (error) {
      message.error("Maoshlarni yuklashda xatolik");
      console.error("Error fetching salaries:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaries();
  }, [selectedMonth]);

  // Maosh to'lash modalni ochish
  const showPayModal = (salary: TeacherSalary) => {
    setSelectedTeacher(salary);
    form.setFieldsValue({
      amount: salary.summary.debt,
      paymentDate: dayjs(),
      method: "CASH",
      notes: "",
    });
    setIsPayModalOpen(true);
  };

  // Maosh to'lash
  const handlePay = async (values: any) => {
    if (!selectedTeacher) return;

    setPaying(true);
    try {
      const token = localStorage.getItem("token");

      const response = await fetch("/api/salary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          teacherId: selectedTeacher.teacher.id,
          amount: values.amount,
          paymentDate: values.paymentDate.toISOString(),
          period: selectedMonth,
          method: values.method,
          notes: values.notes || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.error || "Xatolik yuz berdi");
        return;
      }

      message.success("Maosh to'lovi muvaffaqiyatli saqlandi");
      setIsPayModalOpen(false);
      form.resetFields();
      setSelectedTeacher(null);
      fetchSalaries();
    } catch (error) {
      message.error("Xatolik yuz berdi");
      console.error("Error paying salary:", error);
    } finally {
      setPaying(false);
    }
  };

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

  // To'langan foiz
  const getPaidPercentage = (salary: TeacherSalary) => {
    if (salary.summary.totalSalary === 0) return 100;
    return Math.round(
      (salary.summary.paidAmount / salary.summary.totalSalary) * 100,
    );
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              <DollarOutlined className="mr-2" />
              Maosh
            </h2>
            <p className="text-xs md:text-sm text-gray-600">
              O'qituvchilar maoshi hisob-kitobi
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-4">
        <div className="bg-blue-50 rounded-xl p-2 md:p-3 text-center border border-blue-100">
          <div className="text-blue-600 font-bold text-lg md:text-xl">
            {stats?.teachersCount || 0}
          </div>
          <div className="text-blue-600 text-[10px] md:text-xs">
            O'qituvchilar
          </div>
        </div>
        <div className="bg-indigo-50 rounded-xl p-2 md:p-3 text-center border border-indigo-100">
          <div className="text-indigo-600 font-bold text-sm md:text-lg truncate">
            {formatPrice(stats?.totalSalary || 0).replace(" so'm", "")}
          </div>
          <div className="text-indigo-600 text-[10px] md:text-xs">
            Jami maosh
          </div>
        </div>
        <div className="bg-green-50 rounded-xl p-2 md:p-3 text-center border border-green-100">
          <div className="text-green-600 font-bold text-sm md:text-lg truncate">
            {formatPrice(stats?.totalPaid || 0).replace(" so'm", "")}
          </div>
          <div className="text-green-600 text-[10px] md:text-xs">To'langan</div>
        </div>
        <div className="bg-red-50 rounded-xl p-2 md:p-3 text-center border border-red-100">
          <div className="text-red-600 font-bold text-sm md:text-lg truncate">
            {formatPrice(stats?.totalDebt || 0).replace(" so'm", "")}
          </div>
          <div className="text-red-600 text-[10px] md:text-xs">Qarz</div>
        </div>
      </div>

      {/* Salaries List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : salaries.length === 0 ? (
        <Empty
          description="O'qituvchilar topilmadi"
          className="py-12"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <div className="space-y-3">
          {salaries.map((salary) => (
            <Card
              key={salary.teacher.id}
              className="shadow-sm hover:shadow-md transition-shadow touch-manipulation"
              styles={{ body: { padding: "12px 16px" } }}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  {/* O'qituvchi */}
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                      <UserOutlined className="text-blue-500 text-lg" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 text-base truncate">
                        {salary.teacher.lastName} {salary.teacher.firstName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {salary.teacher.phone}
                      </div>
                    </div>
                  </div>

                  {/* Guruhlar soni */}
                  <div className="flex items-center gap-2 mb-2">
                    <Tag
                      icon={<TeamOutlined />}
                      color="blue"
                      className="text-xs"
                    >
                      {salary.groupsCount} ta guruh
                    </Tag>
                  </div>

                  {/* Maosh ma'lumotlari */}
                  <div className="space-y-1 text-sm mb-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Hisoblangan:</span>
                      <span className="font-medium text-blue-600">
                        {formatPrice(salary.summary.totalSalary)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">To'langan:</span>
                      <span className="text-green-600">
                        {formatPrice(salary.summary.paidAmount)}
                      </span>
                    </div>
                    {salary.summary.debt > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Qarz:</span>
                        <span className="text-red-600 font-medium">
                          {formatPrice(salary.summary.debt)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* NURMAKONs */}
                  <NURMAKONs
                    percent={getPaidPercentage(salary)}
                    size="small"
                    status={
                      salary.summary.debt === 0
                        ? "success"
                        : getPaidPercentage(salary) >= 50
                          ? "normal"
                          : "exception"
                    }
                    format={(percent) => `${percent}%`}
                  />

                  {/* Status tag */}
                  <div className="mt-2">
                    {salary.summary.debt === 0 ? (
                      <Tag color="green" icon={<CheckCircleOutlined />}>
                        To'langan
                      </Tag>
                    ) : (
                      <Tag color="red" icon={<ExclamationCircleOutlined />}>
                        Qarz: {formatPrice(salary.summary.debt)}
                      </Tag>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() =>
                      router.push(
                        `/dashboard/salary/teacher/${salary.teacher.id}?month=${selectedMonth}`,
                      )
                    }
                    className="h-8 px-2"
                  />
                  {salary.summary.debt > 0 && (
                    <Button
                      type="primary"
                      size="small"
                      icon={<WalletOutlined />}
                      onClick={() => showPayModal(salary)}
                      className="h-8 px-2"
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pay Modal */}
      <MobileModal
        open={isPayModalOpen}
        onClose={() => {
          setIsPayModalOpen(false);
          form.resetFields();
          setSelectedTeacher(null);
        }}
        title={
          <span className="flex items-center gap-2">
            <WalletOutlined />
            Maosh to'lash
          </span>
        }
        footer={
          <div className="flex gap-3">
            <Button
              block
              size="large"
              onClick={() => {
                setIsPayModalOpen(false);
                form.resetFields();
                setSelectedTeacher(null);
              }}
              className="h-12"
            >
              Bekor qilish
            </Button>
            <Button
              block
              type="primary"
              size="large"
              onClick={() => form.submit()}
              loading={paying}
              icon={<WalletOutlined />}
              className="h-12"
            >
              To'lash
            </Button>
          </div>
        }
      >
        {selectedTeacher && (
          <>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-gray-600 text-sm">O'qituvchi:</div>
              <div className="font-medium text-lg">
                {selectedTeacher.teacher.lastName}{" "}
                {selectedTeacher.teacher.firstName}
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Hisoblangan maosh:</span>
                  <span className="font-medium text-blue-600">
                    {formatPrice(selectedTeacher.summary.totalSalary)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">To'langan:</span>
                  <span className="text-green-600">
                    {formatPrice(selectedTeacher.summary.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span className="text-gray-700">Qarz:</span>
                  <span className="text-red-600">
                    {formatPrice(selectedTeacher.summary.debt)}
                  </span>
                </div>
              </div>
            </div>

            <Form
              form={form}
              layout="vertical"
              onFinish={handlePay}
              requiredMark={false}
            >
              <Form.Item
                label="Summa"
                name="amount"
                rules={[
                  { required: true, message: "Summani kiriting" },
                  {
                    type: "number",
                    min: 1000,
                    message: "Minimal summa: 1,000 so'm",
                  },
                ]}
              >
                <InputNumber
                  style={{ width: "100%" }}
                  size="large"
                  className="h-12"
                  min={0}
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
                  }
                  parser={(value) => value!.replace(/\s/g, "") as any}
                  inputMode="numeric"
                />
              </Form.Item>

              <div className="grid grid-cols-2 gap-3">
                <Form.Item
                  label="Sana"
                  name="paymentDate"
                  rules={[{ required: true, message: "Sanani tanlang" }]}
                >
                  <DatePicker
                    style={{ width: "100%", height: 48 }}
                    size="large"
                    format="DD.MM.YYYY"
                    inputReadOnly
                  />
                </Form.Item>
                <Form.Item
                  label="To'lov usuli"
                  name="method"
                  rules={[{ required: true, message: "Usulni tanlang" }]}
                >
                  <Select size="large" style={{ height: 48 }}>
                    <Option value="CASH">Naqd</Option>
                    <Option value="CARD">Karta</Option>
                    <Option value="BANK_TRANSFER">Bank o'tkazmasi</Option>
                    <Option value="PAYME">Payme</Option>
                    <Option value="CLICK">Click</Option>
                    <Option value="UZUM">Uzum</Option>
                  </Select>
                </Form.Item>
              </div>

              <Form.Item label="Izoh" name="notes">
                <Input.TextArea
                  rows={2}
                  placeholder="Qo'shimcha izoh..."
                  style={{ fontSize: "16px" }}
                />
              </Form.Item>
            </Form>
          </>
        )}
      </MobileModal>
    </DashboardLayout>
  );
}
