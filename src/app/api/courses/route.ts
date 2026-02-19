import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Barcha kurslarni olish
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const isActive = searchParams.get('isActive')

    // Filter
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ]
    }

    if (isActive !== null && isActive !== '') {
      where.isActive = isActive === 'true'
    }

    const courses = await prisma.course.findMany({
      where,
      include: {
        _count: {
          select: {
            groups: true,
          },
        },
        groups: {
          select: {
            teacherId: true,
          },
          distinct: ['teacherId'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Har bir kurs uchun unique o'qituvchilar sonini hisoblash
    const coursesWithStats = courses.map((course) => ({
      ...course,
      groupsCount: course._count.groups,
      teachersCount: course.groups.length,
      groups: undefined,
      _count: undefined,
    }))

    return NextResponse.json({ courses: coursesWithStats })
  } catch (error) {
    console.error('Get courses error:', error)
    return NextResponse.json(
      { error: 'Kurslarni yuklashda xatolik' },
      { status: 500 }
    )
  }
})

// Yangi kurs qo'shish
export const POST = withAuth(async (request: NextRequest) => {
  try {
    const user = getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, duration, price, level } = body

    // Validatsiya
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Kurs nomi majburiy' },
        { status: 400 }
      )
    }

    if (!price || parseFloat(price) < 0) {
      return NextResponse.json(
        { error: 'Narx kiritilishi kerak' },
        { status: 400 }
      )
    }

    // Kurs nomini tekshirish (dublikat)
    const existingCourse = await prisma.course.findFirst({
      where: { name: name.trim() },
    })

    if (existingCourse) {
      return NextResponse.json(
        { error: 'Bu nomdagi kurs allaqachon mavjud' },
        { status: 400 }
      )
    }

    // Yangi kurs yaratish
    const course = await prisma.course.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        duration: duration ? parseInt(duration) : null,
        price: parseFloat(price),
        level: level || null,
        isActive: true,
      },
    })

    return NextResponse.json({
      success: true,
      course,
      message: 'Kurs muvaffaqiyatli qo\'shildi',
    })
  } catch (error) {
    console.error('Create course error:', error)
    return NextResponse.json(
      { error: 'Kurs qo\'shishda xatolik' },
      { status: 500 }
    )
  }
})
