// Role-based permissions system

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'TEACHER' | 'STUDENT'
export type Resource = 'students' | 'teachers' | 'courses' | 'groups' | 'payments' | 'attendance' | 'salary' | 'users' | 'profile' | 'admins'
export type Action = 'create' | 'read' | 'update' | 'delete'

export const PERMISSIONS: Record<Role, Partial<Record<Resource, Action[]>>> = {
  SUPER_ADMIN: {
    students: ['create', 'read', 'update', 'delete'],
    teachers: ['create', 'read', 'update', 'delete'],
    courses: ['create', 'read', 'update', 'delete'],
    groups: ['create', 'read', 'update', 'delete'],
    payments: ['create', 'read', 'update', 'delete'],
    attendance: ['create', 'read', 'update', 'delete'],
    salary: ['read', 'create', 'update'],
    users: ['read', 'update', 'create'],
    profile: ['read', 'update'],
    admins: ['create', 'read', 'update', 'delete'],
  },
  ADMIN: {
    students: ['create', 'read', 'update'],
    teachers: ['read'],
    courses: ['read'],
    groups: ['create', 'read', 'update'],
    payments: ['create', 'read'],
    attendance: ['read'],
    profile: ['read', 'update'],
  },
  MANAGER: {
    students: ['create', 'read', 'update'],
    groups: ['read'],
    payments: ['create', 'read'],
    attendance: ['read'],
    profile: ['read', 'update'],
  },
  ACCOUNTANT: {
    students: ['read'],
    payments: ['create', 'read', 'update'],
    salary: ['read', 'create'],
    profile: ['read', 'update'],
  },
  TEACHER: {
    groups: ['read'], // faqat o'z guruhlari
    attendance: ['create', 'read', 'update'], // faqat o'z guruhlari
    salary: ['read'], // faqat o'zini
    students: ['read'], // faqat o'z guruhidagi talabalar
    profile: ['read', 'update'],
  },
  STUDENT: {
    profile: ['read', 'update'],
    payments: ['read'], // faqat o'zini
    attendance: ['read'], // faqat o'zini
    groups: ['read'], // faqat o'z guruhlari
  },
}

// Ruxsat tekshirish
export function hasPermission(role: string, resource: Resource, action: Action): boolean {
  const perms = PERMISSIONS[role as Role]
  if (!perms) return false
  const resourcePerms = perms[resource]
  if (!resourcePerms) return false
  return resourcePerms.includes(action)
}

// Admin rolelari
export function isAdmin(role: string): boolean {
  return ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'].includes(role)
}

// Super admin tekshirish
export function isSuperAdmin(role: string): boolean {
  return role === 'SUPER_ADMIN'
}

// Navigation items for each role
export const NAVIGATION_ITEMS: Record<Role, { label: string; href: string; icon?: string }[]> = {
  SUPER_ADMIN: [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { label: 'Talabalar', href: '/dashboard/students', icon: 'users' },
    { label: "O'qituvchilar", href: '/dashboard/teachers', icon: 'teacher' },
    { label: 'Guruhlar', href: '/dashboard/groups', icon: 'group' },
    { label: 'Kurslar', href: '/dashboard/courses', icon: 'book' },
    { label: "To'lovlar", href: '/dashboard/payments', icon: 'payment' },
    { label: 'Maosh', href: '/dashboard/salary', icon: 'money' },
    { label: 'Hisobotlar', href: '/dashboard/reports', icon: 'report' },
    { label: 'Foydalanuvchilar', href: '/dashboard/users', icon: 'users-cog' },
    { label: 'Sozlamalar', href: '/dashboard/settings', icon: 'settings' },
  ],
  ADMIN: [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { label: 'Talabalar', href: '/dashboard/students', icon: 'users' },
    { label: 'Guruhlar', href: '/dashboard/groups', icon: 'group' },
    { label: "To'lovlar", href: '/dashboard/payments', icon: 'payment' },
    { label: 'Sozlamalar', href: '/dashboard/settings', icon: 'settings' },
  ],
  MANAGER: [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { label: 'Talabalar', href: '/dashboard/students', icon: 'users' },
    { label: 'Guruhlar', href: '/dashboard/groups', icon: 'group' },
    { label: "To'lovlar", href: '/dashboard/payments', icon: 'payment' },
    { label: 'Sozlamalar', href: '/dashboard/settings', icon: 'settings' },
  ],
  ACCOUNTANT: [
    { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
    { label: "To'lovlar", href: '/dashboard/payments', icon: 'payment' },
    { label: 'Maosh', href: '/dashboard/salary', icon: 'money' },
    { label: 'Sozlamalar', href: '/dashboard/settings', icon: 'settings' },
  ],
  TEACHER: [
    { label: 'Profilim', href: '/dashboard/my-profile', icon: 'user' },
    { label: 'Guruhlarim', href: '/dashboard/my-groups', icon: 'group' },
    { label: 'Davomat', href: '/dashboard/attendance', icon: 'calendar' },
    { label: 'Maoshim', href: '/dashboard/my-salary', icon: 'money' },
  ],
  STUDENT: [
    // NOTE: 'Profilim' href is dynamic - handled in DashboardLayout
    { label: 'Profilim', href: '/dashboard/students/{studentId}', icon: 'user' },
  ],
}

// Role labels (o'zbek tilida)
export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  MANAGER: 'Menejer',
  ACCOUNTANT: 'Buxgalter',
  TEACHER: "O'qituvchi",
  STUDENT: 'Talaba',
}

// Role colors for badges
export const ROLE_COLORS: Record<Role, string> = {
  SUPER_ADMIN: 'red',
  ADMIN: 'orange',
  MANAGER: 'purple',
  ACCOUNTANT: 'cyan',
  TEACHER: 'blue',
  STUDENT: 'green',
}
