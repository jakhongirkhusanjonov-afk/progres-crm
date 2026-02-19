import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'
import { hasPermission } from '@/lib/permissions'

// Guruhlarni olish (qidiruv, filter va pagination bilan)
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const courseId = searchParams.get('courseId') || ''
    const teacherId = searchParams.get('teacherId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Filter shartlarini tuzish
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    if (status) {
      where.status = status
    }

    if (courseId) {
      where.courseId = courseId
    }

    if (teacherId) {
      where.teacherId = teacherId
    }

    // Umumiy sonni olish
    const total = await prisma.group.count({ where })

    // Pagination
    const skip = (page - 1) * limit

    const groups = await prisma.group.findMany({
      where,
      include: {
        course: {
          select: {
            id: true,
            name: true,
            price: true,
            level: true,
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        _count: {
          select: {
            groupStudents: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    })

    return NextResponse.json({
      groups,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get groups error:', error)
    return NextResponse.json(
      { error: 'Guruhlarni yuklashda xatolik' },
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

// Yangi guruh yaratish
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // Role-based permission check
    if (!hasPermission(user.role, 'groups', 'create')) {
      console.error('POST /api/groups - Ruxsat yo\'q:', user.role)
      return NextResponse.json(
        { error: 'Sizda guruh yaratish huquqi yo\'q' },
        { status: 403 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Noto\'g\'ri JSON format' },
        { status: 400 }
      )
    }

    console.log('Guruh yaratish so\'rovi:', JSON.stringify(body, null, 2))

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

    // === VALIDATSIYA ===

    // Guruh nomi
    if (!name || (typeof name === 'string' && !name.trim())) {
      return NextResponse.json(
        { error: 'Guruh nomi majburiy' },
        { status: 400 }
      )
    }

    // Kurs ID
    if (!courseId) {
      return NextResponse.json(
        { error: 'Kurs tanlanishi kerak' },
        { status: 400 }
      )
    }

    // O'qituvchi ID
    if (!teacherId) {
      return NextResponse.json(
        { error: 'O\'qituvchi tanlanishi kerak' },
        { status: 400 }
      )
    }

    // Boshlanish sanasi
    if (!startDate) {
      return NextResponse.json(
        { error: 'Guruh boshlanish sanasi majburiy' },
        { status: 400 }
      )
    }

    // Sanani tekshirish
    const parsedStartDate = new Date(startDate)
    if (isNaN(parsedStartDate.getTime())) {
      return NextResponse.json(
        { error: 'Noto\'g\'ri sana formati' },
        { status: 400 }
      )
    }

    // Dars vaqtlari majburiy
    if (!startTime) {
      return NextResponse.json(
        { error: 'Dars boshlanish vaqti majburiy (masalan: "14:00")' },
        { status: 400 }
      )
    }

    if (!endTime) {
      return NextResponse.json(
        { error: 'Dars tugash vaqti majburiy (masalan: "16:00")' },
        { status: 400 }
      )
    }

    // Vaqt formatini tekshirish
    if (!isValidTimeFormat(startTime)) {
      return NextResponse.json(
        { error: 'Boshlanish vaqti noto\'g\'ri formatda (HH:mm bo\'lishi kerak)' },
        { status: 400 }
      )
    }

    if (!isValidTimeFormat(endTime)) {
      return NextResponse.json(
        { error: 'Tugash vaqti noto\'g\'ri formatda (HH:mm bo\'lishi kerak)' },
        { status: 400 }
      )
    }

    // Narxni tekshirish
    let parsedPrice = null
    if (price !== undefined && price !== null && price !== '') {
      parsedPrice = parseFloat(String(price))
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return NextResponse.json(
          { error: 'Narx noto\'g\'ri formatda' },
          { status: 400 }
        )
      }
    }

    // scheduleDays ni string formatga o'tkazish
    let scheduleDaysStr = null
    if (scheduleDays) {
      if (Array.isArray(scheduleDays)) {
        scheduleDaysStr = scheduleDays.join(',')
      } else if (typeof scheduleDays === 'string') {
        scheduleDaysStr = scheduleDays
      }
    }

    // === MA'LUMOTLAR BAZASINI TEKSHIRISH ===

    // Kurs mavjudligini tekshirish
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    })

    if (!course) {
      return NextResponse.json(
        { error: 'Tanlangan kurs topilmadi' },
        { status: 400 }
      )
    }

    // O'qituvchi mavjudligini tekshirish
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    })

    if (!teacher) {
      return NextResponse.json(
        { error: 'Tanlangan o\'qituvchi topilmadi' },
        { status: 400 }
      )
    }

    // === GURUH YARATISH ===
    const groupData = {
      name: String(name).trim(),
      courseId,
      teacherId,
      startDate: parsedStartDate,
      roomNumber: roomNumber ? String(roomNumber).trim() : null,
      branch: branch ? String(branch).trim() : null,
      price: parsedPrice,
      scheduleDays: scheduleDaysStr,
      startTime: startTime,
      endTime: endTime,
      status: groupStatus || 'ACTIVE',
    }

    console.log('Guruh data:', JSON.stringify(groupData, null, 2))

    const group = await prisma.group.create({
      data: groupData,
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

    console.log('Guruh muvaffaqiyatli yaratildi:', group.id)

    return NextResponse.json({
      success: true,
      group,
      message: 'Guruh muvaffaqiyatli yaratildi',
    })
  } catch (error: any) {
    console.error('Guruh yaratishda xato:', error)
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
      { error: `Guruh yaratishda xatolik: ${error?.message || 'Noma\'lum xato'}` },
      { status: 500 }
    )
  }
})
