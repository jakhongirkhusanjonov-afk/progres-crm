import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Talabani guruhga qo'shish
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: studentId } = await params
    const user = getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // STUDENT role guruhga qo'shish huquqiga ega emas
    if (user.role === 'STUDENT') {
      return NextResponse.json(
        { error: 'Sizda guruhga qo\'shish huquqi yo\'q' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { groupId } = body

    console.log('POST /api/students/[id]/groups - Talaba:', studentId, 'Guruh:', groupId)

    if (!groupId) {
      return NextResponse.json(
        { error: 'Guruh ID majburiy' },
        { status: 400 }
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

    // Guruh mavjudligini tekshirish
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Guruh topilmadi' },
        { status: 404 }
      )
    }

    // Talaba allaqachon bu guruhda yo'qligini tekshirish
    const existingGroupStudent = await prisma.groupStudent.findUnique({
      where: {
        groupId_studentId: {
          groupId,
          studentId,
        },
      },
    })

    if (existingGroupStudent) {
      return NextResponse.json(
        { error: 'Talaba allaqachon bu guruhda' },
        { status: 400 }
      )
    }

    // Talabani guruhga qo'shish
    const groupStudent = await prisma.groupStudent.create({
      data: {
        groupId,
        studentId,
        status: 'ACTIVE',
      },
      include: {
        group: {
          include: {
            course: true,
          },
        },
      },
    })

    console.log('POST /api/students/[id]/groups - Guruhga qo\'shildi:', groupStudent.id)

    return NextResponse.json({
      success: true,
      groupStudent,
      message: 'Talaba guruhga muvaffaqiyatli qo\'shildi',
    })
  } catch (error) {
    console.error('Add to group error:', error)
    return NextResponse.json(
      { error: 'Guruhga qo\'shishda xatolik' },
      { status: 500 }
    )
  }
})

// Talabaning guruhlarini olish
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: studentId } = await params
    const user = getUser(request)

    // STUDENT role faqat o'z guruhlarini ko'ra oladi
    if (user?.role === 'STUDENT' && user?.studentId !== studentId) {
      return NextResponse.json(
        { error: 'Sizda bu talaba guruhlarini ko\'rish huquqi yo\'q' },
        { status: 403 }
      )
    }

    const groupStudents = await prisma.groupStudent.findMany({
      where: { studentId },
      include: {
        group: {
          include: {
            course: true,
            teacher: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        enrollDate: 'desc',
      },
    })

    return NextResponse.json({ groupStudents })
  } catch (error) {
    console.error('Get student groups error:', error)
    return NextResponse.json(
      { error: 'Guruhlarni yuklashda xatolik' },
      { status: 500 }
    )
  }
})
