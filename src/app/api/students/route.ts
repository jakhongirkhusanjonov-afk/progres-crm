import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'
import { hashPassword } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { hasPermission } from '@/lib/permissions'

// Talabalarni olish (qidiruv, filter va pagination bilan)
export const GET = withAuth(async (request: NextRequest) => {
  try {
    // URL dan query parametrlarni olish
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const gender = searchParams.get('gender') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Filter shartlarini tuzish
    const where: any = {}

    // Qidiruv - ism, familiya, telefon bo'yicha
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ]
    }

    // Status bo'yicha filter
    if (status) {
      where.status = status
    }

    // Jinsi bo'yicha filter
    if (gender) {
      where.gender = gender
    }

    // Umumiy sonni olish
    const total = await prisma.student.count({ where })

    // Pagination
    const skip = (page - 1) * limit

    // Sorting
    const orderBy: any = {}
    if (sortBy === 'name') {
      orderBy.firstName = sortOrder
    } else if (sortBy === 'phone') {
      orderBy.phone = sortOrder
    } else {
      orderBy[sortBy] = sortOrder
    }

    const students = await prisma.student.findMany({
      where,
      include: {
        createdBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            isActive: true,
            lastLogin: true,
          },
        },
        groupStudents: {
          include: {
            group: {
              include: {
                course: true,
              },
            },
          },
        },
        _count: {
          select: {
            payments: true,
            attendances: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    })

    return NextResponse.json({
      students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get students error:', error)
    return NextResponse.json(
      { error: 'Talabalarni yuklashda xatolik' },
      { status: 500 }
    )
  }
})

// Yangi talaba qo'shish (faqat ADMIN va SUPER_ADMIN)
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)

    if (!user) {
      console.error('POST /api/students - Avtorizatsiya yo\'q')
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // Role-based permission check
    if (!hasPermission(user.role, 'students', 'create')) {
      console.error('POST /api/students - Ruxsat yo\'q:', user.role)
      return NextResponse.json(
        { error: 'Sizda talaba qo\'shish huquqi yo\'q' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('POST /api/students - Kelgan ma\'lumotlar:', JSON.stringify(body, null, 2))

    const {
      firstName,
      lastName,
      phone,
      parentPhone,
      dateOfBirth,
      gender,
      // User account uchun
      username,
      password,
      createAccount, // true bo'lsa User yaratiladi
    } = body

    // Majburiy maydonlarni tekshirish
    if (!firstName || !lastName || !phone) {
      console.error('POST /api/students - Majburiy maydonlar yo\'q:', { firstName, lastName, phone })
      return NextResponse.json(
        { error: 'Ism, familiya va telefon raqam majburiy' },
        { status: 400 }
      )
    }

    // Telefon raqam formatini tekshirish
    const phoneRegex = /^\+998\d{9}$/
    if (!phoneRegex.test(phone)) {
      console.error('POST /api/students - Noto\'g\'ri telefon format:', phone)
      return NextResponse.json(
        { error: 'Telefon raqam +998XXXXXXXXX formatida bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // Telefon raqam unique tekshiruvi olib tashlandi
    // Bir oiladan bir nechta farzand bo'lishi mumkin (bir xil telefon)

    // Ism + Familiya kombinatsiyasi yagona ekanligini tekshirish
    const existingStudent = await prisma.student.findFirst({
      where: {
        firstName: { equals: firstName.trim(), mode: 'insensitive' },
        lastName: { equals: lastName.trim(), mode: 'insensitive' },
      },
    })

    if (existingStudent) {
      return NextResponse.json(
        { error: "Bu ism va familiyali o'quvchi ro'yxatda mavjud" },
        { status: 409 }
      )
    }

    // Agar account yaratilsa, username va parolni tekshirish
    if (createAccount) {
      if (!username || !password) {
        return NextResponse.json(
          { error: 'Username va parol kiritilishi shart' },
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

      // Username unique ekanligini tekshirish
      const existingUser = await prisma.user.findUnique({
        where: { username: username.toLowerCase() },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'Bu username allaqachon band' },
          { status: 400 }
        )
      }

      // Parol uzunligini tekshirish
      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' },
          { status: 400 }
        )
      }
    }

    // Yangi talaba yaratish (transaction bilan)
    const result = await prisma.$transaction(async (tx) => {
      let newUser = null

      // Agar account yaratilsa
      if (createAccount && username && password) {
        const hashedPassword = await hashPassword(password)
        const encryptedPassword = encrypt(password)

        newUser = await tx.user.create({
          data: {
            username: username.toLowerCase(),
            password: hashedPassword,
            plainPassword: encryptedPassword,
            fullName: `${firstName} ${lastName}`,
            role: 'STUDENT',
            phone,
            isActive: true,
          },
        })
      }

      // Talaba yaratish
      const newStudent = await tx.student.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone,
          parentPhone: parentPhone || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender || null,
          createdById: user.userId,
          userId: newUser?.id || null,
        },
        include: {
          createdBy: {
            select: {
              fullName: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              isActive: true,
            },
          },
        },
      })

      return {
        student: newStudent,
        credentials: createAccount ? { username: username.toLowerCase(), password } : null,
      }
    })

    console.log('POST /api/students - Talaba yaratildi:', result.student.id)
    return NextResponse.json({
      success: true,
      student: result.student,
      credentials: result.credentials,
    })
  } catch (error) {
    console.error('POST /api/students - Xatolik:', error)
    return NextResponse.json(
      { error: 'Talaba qo\'shishda xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.' },
      { status: 500 }
    )
  }
})
