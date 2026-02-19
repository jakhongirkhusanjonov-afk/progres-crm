import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Davomatlarni olish (filter va pagination bilan)
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const groupId = searchParams.get('groupId') || ''
    const teacherId = searchParams.get('teacherId') || ''
    const studentId = searchParams.get('studentId') || ''
    const date = searchParams.get('date') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const status = searchParams.get('status') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Filter shartlarini tuzish
    const where: any = {}

    if (groupId) {
      where.groupId = groupId
    }

    if (studentId) {
      where.studentId = studentId
    }

    if (status) {
      where.status = status
    }

    // Sana filterlari
    if (date) {
      const targetDate = new Date(date)
      const nextDay = new Date(targetDate)
      nextDay.setDate(nextDay.getDate() + 1)
      where.date = {
        gte: targetDate,
        lt: nextDay,
      }
    } else if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setDate(end.getDate() + 1)
        where.date.lt = end
      }
    }

    // O'qituvchi bo'yicha filter (guruh orqali)
    if (teacherId) {
      where.group = {
        teacherId: teacherId,
      }
    }

    // Umumiy sonni olish
    const total = await prisma.attendance.count({ where })

    // Pagination
    const skip = (page - 1) * limit

    // Unique sanalar va guruhlar bo'yicha guruhlab olish (davomat sessiyalari)
    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        group: {
          select: {
            id: true,
            name: true,
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            course: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                groupStudents: true,
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
    })

    return NextResponse.json({
      attendances,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get attendances error:', error)
    return NextResponse.json(
      { error: 'Davomatlarni yuklashda xatolik' },
      { status: 500 }
    )
  }
})

// Davomat yaratish (bulk - bir nechta talaba uchun)
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // === PERMISSION CHECK ===
    // Faqat SUPER_ADMIN va TEACHER davomat belgilashi mumkin
    // ADMIN davomat belgilay olmaydi
    if (!['SUPER_ADMIN', 'TEACHER'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Davomat belgilash uchun ruxsat yo\'q. Faqat Super Admin va O\'qituvchilar davomat belgilashi mumkin.' },
        { status: 403 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Noto'g'ri JSON format" },
        { status: 400 }
      )
    }

    const { groupId, date, attendances } = body

    // === VALIDATSIYA ===
    if (!groupId) {
      return NextResponse.json(
        { error: 'Guruh tanlanishi kerak' },
        { status: 400 }
      )
    }

    if (!date) {
      return NextResponse.json(
        { error: 'Sana kiritilishi kerak' },
        { status: 400 }
      )
    }

    if (!attendances || !Array.isArray(attendances) || attendances.length === 0) {
      return NextResponse.json(
        { error: 'Davomat ma\'lumotlari kiritilishi kerak' },
        { status: 400 }
      )
    }

    // Sanani tekshirish
    const attendanceDate = new Date(date)
    if (isNaN(attendanceDate.getTime())) {
      return NextResponse.json(
        { error: "Noto'g'ri sana formati" },
        { status: 400 }
      )
    }

    // Soatlarni 0 ga sozlash (faqat sana)
    attendanceDate.setHours(0, 0, 0, 0)

    // Guruh mavjudligini tekshirish
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupStudents: {
          where: { status: 'ACTIVE' },
          select: { studentId: true },
        },
        teacher: {
          select: {
            userId: true,
          },
        },
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Guruh topilmadi' },
        { status: 404 }
      )
    }

    // TEACHER uchun: faqat o'z guruhida davomat belgilashi mumkin
    if (user.role === 'TEACHER') {
      // Teacher userId'sini user.userId bilan solishtirish
      if (group.teacher?.userId !== user.userId) {
        return NextResponse.json(
          { error: 'Bu sizning guruhingiz emas. Faqat o\'z guruhingizda davomat belgilashingiz mumkin.' },
          { status: 403 }
        )
      }
    }

    // Talabalar ID larini tekshirish
    const validStudentIds = group.groupStudents.map((gs) => gs.studentId)

    // Har bir davomat uchun validatsiya
    for (const att of attendances) {
      if (!att.studentId) {
        return NextResponse.json(
          { error: 'Talaba ID si kerak' },
          { status: 400 }
        )
      }

      if (!validStudentIds.includes(att.studentId)) {
        return NextResponse.json(
          { error: `Talaba (${att.studentId}) bu guruhda emas` },
          { status: 400 }
        )
      }

      if (!att.status || !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(att.status)) {
        return NextResponse.json(
          { error: "Davomat statusi noto'g'ri (PRESENT, ABSENT, LATE, EXCUSED)" },
          { status: 400 }
        )
      }
    }

    // Mavjud davomatlarni o'chirish (shu sana va guruh uchun)
    await prisma.attendance.deleteMany({
      where: {
        groupId,
        date: attendanceDate,
      },
    })

    // Yangi davomatlarni yaratish
    const createdAttendances = await prisma.attendance.createMany({
      data: attendances.map((att: any) => ({
        groupId,
        studentId: att.studentId,
        date: attendanceDate,
        status: att.status,
        notes: att.notes || null,
      })),
    })

    // Yaratilgan davomatlarni qaytarish
    const result = await prisma.attendance.findMany({
      where: {
        groupId,
        date: attendanceDate,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Davomat muvaffaqiyatli saqlandi',
      count: createdAttendances.count,
      attendances: result,
    })
  } catch (error: any) {
    console.error('Create attendance error:', error)

    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Bu talaba uchun shu sanada davomat allaqachon mavjud' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: `Davomat yaratishda xatolik: ${error?.message || "Noma'lum xato"}` },
      { status: 500 }
    )
  }
})
