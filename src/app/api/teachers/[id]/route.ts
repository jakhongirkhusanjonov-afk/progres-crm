import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Bitta o'qituvchini olish
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            isActive: true,
            lastLogin: true,
          },
        },
        createdBy: {
          select: {
            fullName: true,
            email: true,
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
        schedules: {
          include: {
            group: {
              include: {
                course: true,
              },
            },
          },
        },
        salaryPayments: {
          orderBy: {
            paymentDate: 'desc',
          },
          take: 10,
        },
        _count: {
          select: {
            groups: true,
            schedules: true,
            salaryPayments: true,
          },
        },
      },
    })

    if (!teacher) {
      return NextResponse.json({ error: 'O\'qituvchi topilmadi' }, { status: 404 })
    }

    return NextResponse.json({ teacher })
  } catch (error) {
    console.error('Get teacher error:', error)
    return NextResponse.json(
      { error: 'O\'qituvchini yuklashda xatolik' },
      { status: 500 }
    )
  }
})

// O'qituvchini tahrirlash
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
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
      status,
      courses, // [{courseId, percentage}]
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

    // Telefon raqam boshqa o'qituvchida yo'qligini tekshirish
    const existingTeacher = await prisma.teacher.findFirst({
      where: { phone, id: { not: id } },
    })

    if (existingTeacher) {
      return NextResponse.json(
        { error: 'Bu telefon raqam bilan boshqa o\'qituvchi mavjud' },
        { status: 400 }
      )
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

    // O'qituvchini yangilash (transaction bilan)
    const teacher = await prisma.$transaction(async (tx) => {
      // O'qituvchi ma'lumotlarini yangilash
      await tx.teacher.update({
        where: { id },
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName: middleName?.trim() || null,
          phone,
          address: address || null,
          education: education || null,
          status: status || undefined,
        },
      })

      // Eski TeacherCourse larni o'chirish
      await tx.teacherCourse.deleteMany({
        where: { teacherId: id },
      })

      // Yangi TeacherCourse lar yaratish
      if (courses && courses.length > 0) {
        await tx.teacherCourse.createMany({
          data: courses.map((c: { courseId: string; percentage: number }) => ({
            teacherId: id,
            courseId: c.courseId,
            percentage: c.percentage,
          })),
        })
      }

      // To'liq o'qituvchi ma'lumotlarini qaytarish
      return tx.teacher.findUnique({
        where: { id },
        include: {
          createdBy: {
            select: {
              fullName: true,
            },
          },
          teacherCourses: {
            include: {
              course: true,
            },
          },
          groups: {
            include: {
              course: true,
            },
          },
        },
      })
    })

    return NextResponse.json({ success: true, teacher })
  } catch (error) {
    console.error('PUT /api/teachers/[id] - Xatolik:', error)
    return NextResponse.json(
      { error: 'O\'qituvchini yangilashda xatolik' },
      { status: 500 }
    )
  }
})

// O'qituvchini o'chirish (yoki arxivga olish)
export const DELETE = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const user = getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // URL dan "hard" parametrini olish
    const searchParams = request.nextUrl.searchParams
    const hardDelete = searchParams.get('hard') === 'true'

    if (hardDelete) {
      // To'liq o'chirish
      await prisma.teacher.delete({
        where: { id },
      })

      return NextResponse.json({
        success: true,
        message: 'O\'qituvchi to\'liq o\'chirildi'
      })
    } else {
      // Arxivga olish (status ni o'zgartirish)
      const teacher = await prisma.teacher.update({
        where: { id },
        data: {
          status: 'RESIGNED',
        },
      })

      return NextResponse.json({
        success: true,
        message: 'O\'qituvchi arxivga olindi',
        teacher
      })
    }
  } catch (error) {
    console.error('Delete teacher error:', error)
    return NextResponse.json(
      { error: 'O\'qituvchini o\'chirishda xatolik' },
      { status: 500 }
    )
  }
})
