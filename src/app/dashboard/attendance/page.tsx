"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import MobileModal from "@/components/MobileModal";
import {
  Button,
  Select,
  DatePicker,
  Tag,
  message,
  Card,
  Empty,
  Spin,
  NURMAKONs,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  CalendarOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;
const { Option } = Select;

interface AttendanceSession {
  groupId: string;
  date: string;
  group: {
    id: string;
    name: string;
    teacher: {
      id: string;
      firstName: string;
      lastName: string;
    };
    course: {
      id: string;
      name: string;
    };
    _count: {
      groupStudents: number;
    };
  };
  stats: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendanceRate: number;
  };
}

interface Group {
  id: string;
  name: string;
  teacher: {
    firstName: string;
    lastName: string;
  };
}

export default function AttendancePage() {
  const router = useRouter();

  // State
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
    null,
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // Davomat sessiyalarini yuklash
  const fetchSessions = async (page = pagination.page) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const params = new URLSearchParams();
      if (selectedGroup) params.append("groupId", selectedGroup);
      if (dateRange && dateRange[0]) {
        params.append("startDate", dateRange[0].format("YYYY-MM-DD"));
      }
      if (dateRange && dateRange[1]) {
        params.append("endDate", dateRange[1].format("YYYY-MM-DD"));
      }
      params.append("page", page.toString());
      params.append("limit", pagination.limit.toString());

      const response = await fetch(
        `/api/attendance/sessions?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) throw new Error("Failed to fetch");

      const data = await response.json();
      setSessions(data.sessions);
      setPagination(data.pagination);
    } catch (error) {
      message.error("Davomatlarni yuklashda xatolik");
      console.error("Error fetching sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  // Guruhlarni yuklash
  const fetchGroups = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/groups?status=ACTIVE&limit=100", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups);
      }
    } catch (error) {
      console.error("Error fetching groups:", error);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchSessions(1);
  }, []);

  useEffect(() => {
    fetchSessions(1);
  }, [selectedGroup, dateRange]);

  // Davomat sessiyasini o'chirish
  const handleDeleteSession = async (groupId: string, date: string) => {
    try {
      const token = localStorage.getItem("token");

      // Shu guruh va sanadagi barcha davomatlarni olish
      const targetDate = new Date(date);

      const getResponse = await fetch(
        `/api/attendance?groupId=${groupId}&date=${targetDate.toISOString().split("T")[0]}&limit=100`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!getResponse.ok) throw new Error("Failed to get attendances");

      const getData = await getResponse.json();

      // Har birini o'chirish
      for (const att of getData.attendances) {
        await fetch(`/api/attendance/${att.id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      message.success("Davomat o'chirildi");
      fetchSessions();
    } catch (error) {
      message.error("Davomatni o'chirishda xatolik");
      console.error("Error deleting session:", error);
    }
  };

  // Umumiy statistika
  const totalPresent = sessions.reduce(
    (sum, s) => sum + s.stats.present + s.stats.late,
    0,
  );
  const totalAbsent = sessions.reduce((sum, s) => sum + s.stats.absent, 0);
  const avgRate =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((sum, s) => sum + s.stats.attendanceRate, 0) /
            sessions.length,
        )
      : 0;

  // Filterlarni tozalash
  const clearFilters = () => {
    setSelectedGroup("");
    setDateRange(null);
    setIsFilterOpen(false);
  };

  const hasActiveFilters = selectedGroup || dateRange;

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              Davomat
            </h2>
            <p className="text-xs md:text-sm text-gray-600">
              Jami: {pagination.total} ta dars
            </p>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push("/dashboard/attendance/mark")}
            size="large"
            className="w-full sm:w-auto h-11 md:h-10 text-base touch-manipulation"
          >
            Davomat belgilash
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2 md:gap-3 mb-4">
        <div className="bg-blue-50 rounded-xl p-2 md:p-3 text-center border border-blue-100">
          <div className="text-blue-600 font-bold text-lg md:text-xl">
            {sessions.length}
          </div>
          <div className="text-blue-600 text-[10px] md:text-xs">Darslar</div>
        </div>
        <div className="bg-green-50 rounded-xl p-2 md:p-3 text-center border border-green-100">
          <div className="text-green-600 font-bold text-lg md:text-xl">
            {totalPresent}
          </div>
          <div className="text-green-600 text-[10px] md:text-xs">Keldi</div>
        </div>
        <div className="bg-red-50 rounded-xl p-2 md:p-3 text-center border border-red-100">
          <div className="text-red-600 font-bold text-lg md:text-xl">
            {totalAbsent}
          </div>
          <div className="text-red-600 text-[10px] md:text-xs">Kelmadi</div>
        </div>
        <div className="bg-purple-50 rounded-xl p-2 md:p-3 text-center border border-purple-100">
          <div
            className={`font-bold text-lg md:text-xl ${avgRate >= 80 ? "text-green-600" : avgRate >= 50 ? "text-yellow-600" : "text-red-600"}`}
          >
            {avgRate}%
          </div>
          <div className="text-purple-600 text-[10px] md:text-xs">O'rtacha</div>
        </div>
      </div>

      {/* Filter Button */}
      <div className="mb-4">
        <Button
          icon={<FilterOutlined />}
          onClick={() => setIsFilterOpen(true)}
          size="large"
          className="h-11 touch-manipulation"
          type={hasActiveFilters ? "primary" : "default"}
        >
          Filter
          {hasActiveFilters && (
            <span className="ml-1">
              ({selectedGroup ? 1 : 0} + {dateRange ? 1 : 0})
            </span>
          )}
        </Button>
        {hasActiveFilters && (
          <Button type="link" onClick={clearFilters} className="ml-2">
            Tozalash
          </Button>
        )}
      </div>

      {/* Sessions List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : sessions.length === 0 ? (
        <Empty
          description="Davomat topilmadi"
          className="py-12"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button
            type="primary"
            onClick={() => router.push("/dashboard/attendance/mark")}
          >
            Davomat belgilash
          </Button>
        </Empty>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card
              key={`${session.groupId}-${session.date}`}
              className="shadow-sm hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50 touch-manipulation"
              styles={{ body: { padding: "12px 16px" } }}
              onClick={() =>
                router.push(
                  `/dashboard/attendance/mark?groupId=${session.groupId}&date=${new Date(session.date).toISOString().split("T")[0]}`,
                )
              }
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  {/* Sana va guruh */}
                  <div className="flex items-center gap-2 mb-1">
                    <Tag color="blue" className="text-xs">
                      <CalendarOutlined className="mr-1" />
                      {new Date(session.date).toLocaleDateString("uz-UZ")}
                    </Tag>
                  </div>

                  {/* Guruh nomi */}
                  <div className="font-semibold text-gray-900 text-base truncate">
                    {session.group?.name}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {session.group?.course?.name}
                  </div>

                  {/* O'qituvchi */}
                  <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <UserOutlined />
                    {session.group?.teacher?.lastName}{" "}
                    {session.group?.teacher?.firstName}
                  </div>

                  {/* Davomat statistikasi */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex gap-1.5">
                      <Tag color="green" className="text-xs">
                        <CheckCircleOutlined />{" "}
                        {session.stats.present + session.stats.late}
                      </Tag>
                      <Tag color="red" className="text-xs">
                        <CloseCircleOutlined /> {session.stats.absent}
                      </Tag>
                      <span className="text-xs text-gray-400">
                        / {session.stats.total}
                      </span>
                    </div>
                  </div>

                  {/* NURMAKONs */}
                  <div className="mt-2">
                    <NURMAKONs
                      percent={session.stats.attendanceRate}
                      size="small"
                      status={
                        session.stats.attendanceRate >= 80
                          ? "success"
                          : session.stats.attendanceRate >= 50
                            ? "normal"
                            : "exception"
                      }
                      format={(percent) => `${percent}%`}
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/dashboard/attendance/mark?groupId=${session.groupId}&date=${new Date(session.date).toISOString().split("T")[0]}`,
                      );
                    }}
                    className="h-8 px-2"
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/dashboard/attendance/mark?groupId=${session.groupId}&date=${new Date(session.date).toISOString().split("T")[0]}`,
                      );
                    }}
                    className="h-8 px-2"
                  />
                  <Popconfirm
                    title="Davomatni o'chirish"
                    description="Bu sananing davomati o'chiriladi"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleDeleteSession(session.groupId, session.date);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="Ha"
                    cancelText="Yo'q"
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                      className="h-8 px-2"
                    />
                  </Popconfirm>
                </div>
              </div>
            </Card>
          ))}

          {/* Load more */}
          {pagination.page < pagination.totalPages && (
            <div className="text-center pt-4">
              <Button
                onClick={() => {
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
                  fetchSessions(pagination.page + 1);
                }}
                size="large"
                className="h-11 touch-manipulation"
              >
                Ko'proq yuklash
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Filter Modal */}
      <MobileModal
        open={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        title="Filterlar"
        footer={
          <div className="flex gap-3">
            <Button block size="large" onClick={clearFilters} className="h-12">
              Tozalash
            </Button>
            <Button
              block
              type="primary"
              size="large"
              onClick={() => setIsFilterOpen(false)}
              className="h-12"
            >
              Qo'llash
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <TeamOutlined className="mr-1" /> Guruh
            </label>
            <Select
              placeholder="Guruh tanlang"
              allowClear
              size="large"
              value={selectedGroup || undefined}
              onChange={(value) => setSelectedGroup(value || "")}
              className="w-full"
              style={{ height: 48 }}
              showSearch
              optionFilterProp="children"
            >
              {groups.map((group) => (
                <Option key={group.id} value={group.id}>
                  {group.name} - {group.teacher.lastName}
                </Option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarOutlined className="mr-1" /> Sana oralig'i
            </label>
            <RangePicker
              size="large"
              style={{ width: "100%", height: 48 }}
              format="DD.MM.YYYY"
              value={dateRange}
              onChange={(dates) =>
                setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)
              }
              placeholder={["Boshlanish", "Tugash"]}
              inputReadOnly
            />
          </div>
        </div>
      </MobileModal>
    </DashboardLayout>
  );
}
