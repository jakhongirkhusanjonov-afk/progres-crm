import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'
import { hashPassword } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { isSuperAdmin } from '@/lib/permissions'

// Barcha foydalanuvchilarni olish (faqat SUPER_ADMIN)
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const currentUser = getUser(request)

    if (!currentUser || !isSuperAdmin(currentUser.role)) {
      return NextResponse.json(
        { error: 'Bu amal uchun ruxsat yo\'q' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Filter shartlari
    const where: any = {}

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' as const } },
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ]
    }

    if (role) {
      where.role = role
    }

    if (status === 'active') {
      where.isActive = true
    } else if (status === 'blocked') {
      where.isActive = false
    }

    const total = await prisma.user.count({ where })
    const skip = (page - 1) * limit

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        admin: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    // Ma'lumotlarni formatlash
    const formattedUsers = users.map((user: any) => ({
      ...user,
      displayName:
        user.fullName ||
        (user.teacher
          ? `${user.teacher.firstName} ${user.teacher.lastName}`
          : user.student
            ? `${user.student.firstName} ${user.student.lastName}`
            : user.admin
              ? `${user.admin.firstName} ${user.admin.lastName}`
              : user.username),
      linkedEntity: user.teacher ? 'teacher' : user.student ? 'student' : user.admin ? 'admin' : null,
      linkedId: user.teacher?.id || user.student?.id || user.admin?.id || null,
    }))

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json(
      { error: 'Foydalanuvchilarni yuklashda xatolik' },
      { status: 500 }
    )
  }
})

// Yangi admin qo'shish (faqat SUPER_ADMIN)
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const currentUser = getUser(request)

    if (!currentUser || !isSuperAdmin(currentUser.role)) {
      return NextResponse.json(
        { error: 'Bu amal uchun ruxsat yo\'q' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { username, password, fullName, email, phone, role } = body

    // Tekshirish
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username va parol majburiy' },
        { status: 400 }
      )
    }

    // Faqat admin rollarini qo'shish mumkin
    const allowedRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT']
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Faqat Admin, Manager va Accountant rollarini qo\'shish mumkin' },
        { status: 400 }
      )
    }

    // Username formatini tekshirish
    const usernameRegex = /^[a-z0-9_\.]+$/
    if (!usernameRegex.test(username.toLowerCase())) {
      return NextResponse.json(
        { error: 'Username faqat kichik harflar, raqamlar, _ va . dan iborat bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // Username unique tekshirish
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Bu username allaqachon band' },
        { status: 400 }
      )
    }

    // Parol uzunligi
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // User yaratish
    const hashedPassword = await hashPassword(password)
    const encryptedPassword = encrypt(password)

    const newUser = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        password: hashedPassword,
        plainPassword: encryptedPassword,
        fullName: fullName || null,
        email: email?.toLowerCase() || null,
        phone: phone || null,
        role,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: newUser,
      credentials: { username: username.toLowerCase(), password },
    })
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { error: 'Foydalanuvchi yaratishda xatolik' },
      { status: 500 }
    )
  }
})
