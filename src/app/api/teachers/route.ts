import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'
import { hashPassword } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'

// O'qituvchilarni olish (qidiruv, filter va pagination bilan)
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
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

    // Umumiy sonni olish
    const total = await prisma.teacher.count({ where })

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

    const teachers = await prisma.teacher.findMany({
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
        groups: {
          include: {
            course: true,
            _count: {
              select: {
                groupStudents: true,
              },
            },
          },
        },
        teacherCourses: {
          include: {
            course: true,
          },
        },
        _count: {
          select: {
            groups: true,
            schedules: true,
          },
        },
      },
      orderBy,
      skip,
      take: limit,
    })

    return NextResponse.json({
      teachers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get teachers error:', error)
    return NextResponse.json(
      { error: 'O\'qituvchilarni yuklashda xatolik' },
      { status: 500 }
    )
  }
})

// Yangi o'qituvchi qo'shish
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      middleName,
      phone,
      address,
      education,
      courses, // [{courseId, percentage}]
      // User account uchun
      username,
      password,
      createAccount, // true bo'lsa User yaratiladi
    } = body

    // Majburiy maydonlarni tekshirish
    if (!firstName || !lastName || !phone) {
      return NextResponse.json(
        { error: 'Ism, familiya va telefon raqam majburiy' },
        { status: 400 }
      )
    }

    // Telefon raqam formatini tekshirish
    const phoneRegex = /^\+998\d{9}$/
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: 'Telefon raqam +998XXXXXXXXX formatida bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // Telefon raqam unique tekshiruvi olib tashlandi
    // Bir xil telefon bilan bir nechta o'qituvchi bo'lishi mumkin

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

    // Foizlarni tekshirish
    if (courses && courses.length > 0) {
      for (const c of courses) {
        if (c.percentage < 40 || c.percentage > 60) {
          return NextResponse.json(
            { error: 'Foiz 40% dan 60% gacha bo\'lishi kerak' },
            { status: 400 }
          )
        }
      }
    }

    // Yangi o'qituvchi yaratish (transaction bilan)
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
            role: 'TEACHER',
            phone,
            isActive: true,
          },
        })
      }

      // O'qituvchi yaratish
      const newTeacher = await tx.teacher.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName: middleName?.trim() || null,
          phone,
          address: address || null,
          education: education || null,
          createdById: user.userId,
          userId: newUser?.id || null,
        },
      })

      // TeacherCourse lar yaratish
      if (courses && courses.length > 0) {
        await tx.teacherCourse.createMany({
          data: courses.map((c: { courseId: string; percentage: number }) => ({
            teacherId: newTeacher.id,
            courseId: c.courseId,
            percentage: c.percentage,
          })),
        })
      }

      // To'liq o'qituvchi ma'lumotlarini qaytarish
      const teacher = await tx.teacher.findUnique({
        where: { id: newTeacher.id },
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
          teacherCourses: {
            include: {
              course: true,
            },
          },
        },
      })

      return {
        teacher,
        credentials: createAccount ? { username: username.toLowerCase(), password } : null,
      }
    })

    return NextResponse.json({
      success: true,
      teacher: result.teacher,
      credentials: result.credentials,
    })
  } catch (error) {
    console.error('POST /api/teachers - Xatolik:', error)
    return NextResponse.json(
      { error: 'O\'qituvchi qo\'shishda xatolik yuz berdi' },
      { status: 500 }
    )
  }
})
