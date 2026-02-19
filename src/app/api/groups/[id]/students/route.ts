import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Guruhga talaba qo'shish
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const user = getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const { id: groupId } = await params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Noto\'g\'ri JSON format' },
        { status: 400 }
      )
    }

    const { studentId, price, discountReason } = body

    // Validatsiya
    if (!studentId) {
      return NextResponse.json(
        { error: 'Talaba tanlanishi kerak' },
        { status: 400 }
      )
    }

    // Guruh mavjudligini tekshirish
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { course: true },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Guruh topilmadi' },
        { status: 404 }
      )
    }

    // Talaba mavjudligini tekshirish
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    })

    if (!student) {
      return NextResponse.json(
        { error: 'Talaba topilmadi' },
        { status: 404 }
      )
    }

    // Talaba allaqachon bu guruhda borligini tekshirish
    const existingEnrollment = await prisma.groupStudent.findUnique({
      where: {
        groupId_studentId: {
          groupId,
          studentId,
        },
      },
    })

    if (existingEnrollment) {
      return NextResponse.json(
        { error: 'Bu talaba allaqachon guruhda mavjud' },
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

    // GroupStudent yaratish
    const groupStudent = await prisma.groupStudent.create({
      data: {
        groupId,
        studentId,
        price: parsedPrice,
        discountReason: discountReason || null,
        status: 'ACTIVE',
      },
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
    })

    return NextResponse.json({
      success: true,
      groupStudent,
      message: 'Talaba guruhga qo\'shildi',
    })
  } catch (error: any) {
    console.error('Add student to group error:', error)

    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Bu talaba allaqachon guruhda mavjud' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Talabani qo\'shishda xatolik' },
      { status: 500 }
    )
  }
})

// Guruhga qo'shilmagan talabalarni olish (qidiruv bilan)
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: groupId } = await params
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''

    // Guruh mavjudligini tekshirish
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        groupStudents: {
          select: { studentId: true },
        },
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Guruh topilmadi' },
        { status: 404 }
      )
    }

    // Allaqachon guruhda bo'lgan talabalar ID lari
    const existingStudentIds = group.groupStudents.map(gs => gs.studentId)

    // Qidiruv shartlari
    const where: any = {
      status: 'ACTIVE',
      id: {
        notIn: existingStudentIds.length > 0 ? existingStudentIds : ['__none__'],
      },
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ]
    }

    const students = await prisma.student.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        gender: true,
        status: true,
        _count: {
          select: {
            groupStudents: true,
          },
        },
      },
      orderBy: [
        { firstName: 'asc' },
        { lastName: 'asc' },
      ],
      take: 50,
    })

    return NextResponse.json({ students })
  } catch (error) {
    console.error('Get available students error:', error)
    return NextResponse.json(
      { error: 'Talabalarni yuklashda xatolik' },
      { status: 500 }
    )
  }
})
