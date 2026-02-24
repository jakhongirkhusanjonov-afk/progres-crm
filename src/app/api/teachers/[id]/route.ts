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

// O'qituvchini bazadan butunlay o'chirish (hard delete)
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

    // O'qituvchi mavjudligini tekshirish
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        groups: {
          where: { status: 'ACTIVE' },
          select: { id: true, name: true },
        },
        _count: {
          select: { groups: true },
        },
      },
    })

    if (!teacher) {
      return NextResponse.json(
        { error: "O'qituvchi topilmadi" },
        { status: 404 }
      )
    }

    // Faol guruhlari bor bo'lsa — o'chirishni bloklash
    if (teacher.groups.length > 0) {
      const groupNames = teacher.groups.map((g) => g.name).join(', ')
      return NextResponse.json(
        {
          error: `O'qituvchini o'chirib bo'lmaydi — uning faol guruhlari mavjud: ${groupNames}. Avval guruhlarni yoping yoki boshqa o'qituvchiga o'tkazing.`,
        },
        { status: 400 }
      )
    }

    // Tranzaksiya ichida: bog'liq yozuvlarni tozalab, o'qituvchini o'chirish
    await prisma.$transaction(async (tx) => {
      // 1. Schedule yozuvlarini o'chirish (cascade yo'q)
      await tx.schedule.deleteMany({ where: { teacherId: id } })

      // 2. O'qituvchini o'chirish
      //    TeacherCourse va SalaryPayment — Prisma cascade bilan avtomatik o'chiriladi
      await tx.teacher.delete({ where: { id } })
    })

    return NextResponse.json({
      success: true,
      message: "O'qituvchi bazadan butunlay o'chirildi",
    })
  } catch (error) {
    console.error('Delete teacher error:', error)
    return NextResponse.json(
      { error: "O'qituvchini o'chirishda xatolik yuz berdi" },
      { status: 500 }
    )
  }
})
