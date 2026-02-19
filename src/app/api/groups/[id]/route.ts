import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Guruh ma'lumotlarini olish
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    const group = await prisma.group.findUnique({
      where: { id },
      include: {
        course: true,
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        groupStudents: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                status: true,
                gender: true,
              },
            },
          },
          orderBy: {
            enrollDate: 'desc',
          },
        },
        schedules: true,
        _count: {
          select: {
            groupStudents: true,
            attendances: true,
            testResults: true,
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

    // To'lovlar statistikasini olish
    const studentIds = group.groupStudents.map((gs) => gs.studentId)

    const payments = await prisma.payment.aggregate({
      where: {
        studentId: { in: studentIds },
        paymentType: 'TUITION',
      },
      _sum: {
        amount: true,
      },
      _count: true,
    })

    // Davomat statistikasini olish
    const attendanceStats = await prisma.attendance.groupBy({
      by: ['status'],
      where: {
        groupId: id,
      },
      _count: true,
    })

    return NextResponse.json({
      group,
      stats: {
        totalPayments: payments._sum.amount || 0,
        paymentCount: payments._count,
        attendance: attendanceStats,
      },
    })
  } catch (error) {
    console.error('Get group error:', error)
    return NextResponse.json(
      { error: 'Guruh ma\'lumotlarini yuklashda xatolik' },
      { status: 500 }
    )
  }
})

// Vaqt formatini tekshirish (HH:mm)
function isValidTimeFormat(time: string): boolean {
  if (!time) return true
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
  return timeRegex.test(time)
}

// Guruhni yangilash
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const user = getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const { id } = await params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Noto\'g\'ri JSON format' },
        { status: 400 }
      )
    }

    console.log('Guruh yangilash so\'rovi:', id, JSON.stringify(body, null, 2))

    const {
      name,
      courseId,
      teacherId,
      startDate,
      roomNumber,
      branch,
      price,
      scheduleDays,
      startTime,
      endTime,
      status: groupStatus,
    } = body

    // Guruh mavjudligini tekshirish
    const existingGroup = await prisma.group.findUnique({
      where: { id },
    })

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Guruh topilmadi' },
        { status: 404 }
      )
    }

    // === VALIDATSIYA ===

    // Guruh nomi
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return NextResponse.json(
        { error: 'Guruh nomi bo\'sh bo\'lishi mumkin emas' },
        { status: 400 }
      )
    }

    // Vaqt formatini tekshirish
    if (startTime && !isValidTimeFormat(startTime)) {
      return NextResponse.json(
        { error: 'Boshlanish vaqti noto\'g\'ri formatda (HH:mm bo\'lishi kerak)' },
        { status: 400 }
      )
    }

    if (endTime && !isValidTimeFormat(endTime)) {
      return NextResponse.json(
        { error: 'Tugash vaqti noto\'g\'ri formatda (HH:mm bo\'lishi kerak)' },
        { status: 400 }
      )
    }

    // Narxni tekshirish
    let parsedPrice = undefined
    if (price !== undefined) {
      if (price === null || price === '') {
        parsedPrice = null
      } else {
        parsedPrice = parseFloat(String(price))
        if (isNaN(parsedPrice) || parsedPrice < 0) {
          return NextResponse.json(
            { error: 'Narx noto\'g\'ri formatda' },
            { status: 400 }
          )
        }
      }
    }

    // scheduleDays ni string formatga o'tkazish
    let scheduleDaysStr = undefined
    if (scheduleDays !== undefined) {
      if (scheduleDays === null || scheduleDays === '') {
        scheduleDaysStr = null
      } else if (Array.isArray(scheduleDays)) {
        scheduleDaysStr = scheduleDays.join(',')
      } else if (typeof scheduleDays === 'string') {
        scheduleDaysStr = scheduleDays
      }
    }

    // Kurs mavjudligini tekshirish
    if (courseId) {
      const course = await prisma.course.findUnique({
        where: { id: courseId },
      })
      if (!course) {
        return NextResponse.json(
          { error: 'Tanlangan kurs topilmadi' },
          { status: 400 }
        )
      }
    }

    // O'qituvchi mavjudligini tekshirish
    if (teacherId) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: teacherId },
      })
      if (!teacher) {
        return NextResponse.json(
          { error: 'Tanlangan o\'qituvchi topilmadi' },
          { status: 400 }
        )
      }
    }

    // === GURUHNI YANGILASH ===
    const updateData: any = {}

    if (name !== undefined) updateData.name = String(name).trim()
    if (courseId !== undefined) updateData.courseId = courseId
    if (teacherId !== undefined) updateData.teacherId = teacherId
    if (startDate !== undefined) updateData.startDate = new Date(startDate)
    if (roomNumber !== undefined) updateData.roomNumber = roomNumber ? String(roomNumber).trim() : null
    if (branch !== undefined) updateData.branch = branch ? String(branch).trim() : null
    if (parsedPrice !== undefined) updateData.price = parsedPrice
    if (scheduleDaysStr !== undefined) updateData.scheduleDays = scheduleDaysStr
    if (startTime !== undefined) updateData.startTime = startTime || null
    if (endTime !== undefined) updateData.endTime = endTime || null
    if (groupStatus !== undefined) updateData.status = groupStatus

    console.log('Yangilash data:', JSON.stringify(updateData, null, 2))

    const group = await prisma.group.update({
      where: { id },
      data: updateData,
      include: {
        course: true,
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            groupStudents: true,
          },
        },
      },
    })

    console.log('Guruh muvaffaqiyatli yangilandi:', group.id)

    return NextResponse.json({
      success: true,
      group,
      message: 'Guruh muvaffaqiyatli yangilandi',
    })
  } catch (error: any) {
    console.error('Guruh yangilashda xato:', error)
    console.error('Xato stack:', error?.stack)

    // Prisma xatolarini aniqlash
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Bu nom bilan guruh allaqachon mavjud' },
        { status: 400 }
      )
    }

    if (error?.code === 'P2003') {
      return NextResponse.json(
        { error: 'Bog\'langan ma\'lumot topilmadi (kurs yoki o\'qituvchi)' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: `Guruhni yangilashda xatolik: ${error?.message || 'Noma\'lum xato'}` },
      { status: 500 }
    )
  }
})

// Guruhni o'chirish (arxivlash)
export const DELETE = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const user = getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const { id } = await params

    // Guruh mavjudligini tekshirish
    const existingGroup = await prisma.group.findUnique({
      where: { id },
    })

    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Guruh topilmadi' },
        { status: 404 }
      )
    }

    // Guruhni CANCELLED statusiga o'zgartirish (soft delete)
    const group = await prisma.group.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    })

    return NextResponse.json({
      success: true,
      group,
      message: 'Guruh yopildi',
    })
  } catch (error) {
    console.error('Delete group error:', error)
    return NextResponse.json(
      { error: 'Guruhni o\'chirishda xatolik' },
      { status: 500 }
    )
  }
})
