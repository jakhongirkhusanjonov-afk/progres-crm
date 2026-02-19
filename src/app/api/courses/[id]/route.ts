import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Bitta kursni olish
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        groups: {
          include: {
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
        },
        _count: {
          select: {
            groups: true,
          },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: 'Kurs topilmadi' }, { status: 404 })
    }

    return NextResponse.json({ course })
  } catch (error) {
    console.error('Get course error:', error)
    return NextResponse.json(
      { error: 'Kursni yuklashda xatolik' },
      { status: 500 }
    )
  }
})

// Kursni tahrirlash
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
    const { name, description, duration, price, level, isActive } = body

    // Validatsiya
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Kurs nomi majburiy' },
        { status: 400 }
      )
    }

    if (price !== undefined && parseFloat(price) < 0) {
      return NextResponse.json(
        { error: 'Narx noto\'g\'ri' },
        { status: 400 }
      )
    }

    // Kurs mavjudligini tekshirish
    const existingCourse = await prisma.course.findUnique({
      where: { id },
    })

    if (!existingCourse) {
      return NextResponse.json({ error: 'Kurs topilmadi' }, { status: 404 })
    }

    // Nom dublikatini tekshirish
    const duplicateCourse = await prisma.course.findFirst({
      where: {
        name: name.trim(),
        NOT: { id },
      },
    })

    if (duplicateCourse) {
      return NextResponse.json(
        { error: 'Bu nomdagi kurs allaqachon mavjud' },
        { status: 400 }
      )
    }

    // Kursni yangilash
    const course = await prisma.course.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        duration: duration ? parseInt(duration) : null,
        price: price !== undefined ? parseFloat(price) : undefined,
        level: level || null,
        isActive: isActive !== undefined ? isActive : undefined,
      },
    })

    return NextResponse.json({
      success: true,
      course,
      message: 'Kurs muvaffaqiyatli yangilandi',
    })
  } catch (error) {
    console.error('Update course error:', error)
    return NextResponse.json(
      { error: 'Kursni yangilashda xatolik' },
      { status: 500 }
    )
  }
})

// Kursni o'chirish
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

    // Kurs mavjudligini tekshirish
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            groups: true,
          },
        },
      },
    })

    if (!course) {
      return NextResponse.json({ error: 'Kurs topilmadi' }, { status: 404 })
    }

    // Agar kursda guruhlar bo'lsa, o'chirmaslik
    if (course._count.groups > 0) {
      return NextResponse.json(
        { error: `Bu kursda ${course._count.groups} ta guruh mavjud. Avval guruhlarni o'chiring.` },
        { status: 400 }
      )
    }

    // Kursni o'chirish
    await prisma.course.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: 'Kurs muvaffaqiyatli o\'chirildi',
    })
  } catch (error) {
    console.error('Delete course error:', error)
    return NextResponse.json(
      { error: 'Kursni o\'chirishda xatolik' },
      { status: 500 }
    )
  }
})
