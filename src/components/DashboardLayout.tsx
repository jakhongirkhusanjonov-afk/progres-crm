"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { logout } from "@/lib/auth-client";
import { Drawer, Button } from "antd";
import {
  MenuOutlined,
  CloseOutlined,
  HomeOutlined,
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  CalendarOutlined,
  DollarOutlined,
  WalletOutlined,
  LogoutOutlined,
  AppstoreOutlined,
  SettingOutlined,
  ProfileOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import { NAVIGATION_ITEMS, ROLE_LABELS, Role } from "@/lib/permissions";
import NURMAKONLogo from "./NURMAKONLogo";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Icon mapping
const iconMap: Record<string, React.ReactNode> = {
  dashboard: <HomeOutlined />,
  users: <UserOutlined />,
  teacher: <TeamOutlined />,
  group: <BookOutlined />,
  book: <AppstoreOutlined />,
  payment: <DollarOutlined />,
  calendar: <CalendarOutlined />,
  money: <WalletOutlined />,
  "users-cog": <SettingOutlined />,
  user: <ProfileOutlined />,
  check: <CheckCircleOutlined />,
  admin: <SafetyCertificateOutlined />,
  settings: <SettingOutlined />,
  report: <FileExcelOutlined />,
};

// Get icon by name
const getIcon = (iconName?: string): React.ReactNode => {
  if (!iconName) return <HomeOutlined />;
  return iconMap[iconName] || <HomeOutlined />;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");

    if (!token || !userData) {
      router.push("/login");
      return;
    }

    setUser(JSON.parse(userData));

    // Check screen size
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [router]);

  // Get navigation items based on user role
  const navItems = useMemo(() => {
    if (!user?.role) return [];
    const items = NAVIGATION_ITEMS[user.role as Role] || [];
    return items.map((item) => {
      // Handle dynamic URLs for STUDENT
      let href = item.href;
      if (user.role === "STUDENT" && user.studentId) {
        href = href.replace("{studentId}", user.studentId);
      }
      return {
        ...item,
        href,
        icon: getIcon(item.icon),
      };
    });
  }, [user?.role, user?.studentId]);

  // Bottom navigation items (first 4 items for mobile)
  const bottomNavItems = useMemo(() => {
    return navItems.slice(0, 4);
  }, [navItems]);

  // Get role label
  const roleLabel = useMemo(() => {
    if (!user?.role) return "";
    return ROLE_LABELS[user.role as Role] || user.role;
  }, [user?.role]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 md:h-16 items-center">
            {/* Logo & Mobile Menu Button */}
            <div className="flex items-center gap-2 md:gap-8">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <MenuOutlined className="text-xl" />
              </button>

              {/* Logo */}
              <Link href="/dashboard" className="flex items-center gap-2">
                <NURMAKONLogo width={36} height={36} className="md:hidden" />
                <NURMAKONLogo
                  width={44}
                  height={44}
                  className="hidden md:flex"
                />
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex gap-1 lg:gap-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive(item.href)
                        ? "text-orange-600 bg-orange-50"
                        : "text-gray-600 hover:text-orange-600 hover:bg-orange-50"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center gap-2 md:gap-4">
              <div className="text-right hidden xs:block">
                <div className="font-medium text-gray-900 text-sm md:text-base truncate max-w-[100px] md:max-w-none">
                  {user.fullName}
                </div>
                <div className="text-gray-500 text-xs">{roleLabel}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 md:px-4 md:py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 active:bg-red-700 rounded-lg transition-colors touch-manipulation"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <LogoutOutlined className="md:mr-1" />
                <span className="hidden md:inline">Chiqish</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Side Menu Drawer */}
      <Drawer
        title={
          <div className="flex items-center justify-between">
            <span className="text-orange-600 font-bold">Menu</span>
          </div>
        }
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        width={280}
        closeIcon={<CloseOutlined className="text-lg" />}
        styles={{
          body: { padding: 0 },
          header: { borderBottom: "1px solid #f0f0f0" },
        }}
      >
        {/* User Info in Drawer */}
        <div className="p-4 bg-orange-50 border-b">
          <div className="font-medium text-gray-900">{user.fullName}</div>
          <div className="text-sm text-gray-500">{user.email}</div>
          <div className="text-xs text-orange-600 mt-1">{roleLabel}</div>
        </div>

        {/* Navigation Links */}
        <div className="py-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 text-base transition-colors touch-manipulation ${
                isActive(item.href)
                  ? "text-orange-600 bg-orange-50 border-r-4 border-orange-500"
                  : "text-gray-700 hover:bg-gray-50 active:bg-gray-100"
              }`}
              style={{ minHeight: 48 }}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>

        {/* Logout Button */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-white">
          <Button
            danger
            block
            size="large"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            className="h-12"
          >
            Chiqish
          </Button>
        </div>
      </Drawer>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 md:py-6">
        {children}
      </main>

      {/* Bottom Navigation (Mobile only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <div className="flex justify-around items-center h-16">
          {bottomNavItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors touch-manipulation ${
                isActive(item.href)
                  ? "text-orange-600"
                  : "text-gray-500 active:text-orange-500"
              }`}
            >
              <span
                className={`text-xl mb-0.5 ${isActive(item.href) ? "scale-110" : ""}`}
              >
                {item.icon}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
