import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Talabani guruhdan chiqarish
export const DELETE = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; groupStudentId: string }> }
) => {
  try {
    const { id: studentId, groupStudentId } = await params
    const user = getUser(request)

    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // STUDENT role guruhdan chiqarish huquqiga ega emas
    if (user.role === 'STUDENT') {
      return NextResponse.json(
        { error: 'Sizda guruhdan chiqarish huquqi yo\'q' },
        { status: 403 }
      )
    }

    console.log('DELETE /api/students/[id]/groups/[groupStudentId] -', { studentId, groupStudentId })

    // GroupStudent mavjudligini tekshirish
    const groupStudent = await prisma.groupStudent.findUnique({
      where: { id: groupStudentId },
    })

    if (!groupStudent) {
      return NextResponse.json(
        { error: 'Guruh a\'zoligi topilmadi' },
        { status: 404 }
      )
    }

    // Talaba IDsi to'g'ri ekanligini tekshirish
    if (groupStudent.studentId !== studentId) {
      return NextResponse.json(
        { error: 'Bu talabaga tegishli emas' },
        { status: 400 }
      )
    }

    // Guruhdan chiqarish
    await prisma.groupStudent.delete({
      where: { id: groupStudentId },
    })

    console.log('DELETE - Talaba guruhdan chiqarildi:', groupStudentId)

    return NextResponse.json({
      success: true,
      message: 'Talaba guruhdan muvaffaqiyatli chiqarildi',
    })
  } catch (error) {
    console.error('Remove from group error:', error)
    return NextResponse.json(
      { error: 'Guruhdan chiqarishda xatolik' },
      { status: 500 }
    )
  }
})
