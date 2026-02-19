import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Talabani guruhdan o'chirish
export const DELETE = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) => {
  try {
    const user = getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const { id: groupId, studentId } = await params

    // GroupStudent mavjudligini tekshirish
    const groupStudent = await prisma.groupStudent.findUnique({
      where: {
        groupId_studentId: {
          groupId,
          studentId,
        },
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    if (!groupStudent) {
      return NextResponse.json(
        { error: 'Talaba bu guruhda topilmadi' },
        { status: 404 }
      )
    }

    // GroupStudent ni o'chirish
    await prisma.groupStudent.delete({
      where: {
        groupId_studentId: {
          groupId,
          studentId,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: `${groupStudent.student.firstName} ${groupStudent.student.lastName} guruhdan chiqarildi`,
    })
  } catch (error) {
    console.error('Remove student from group error:', error)
    return NextResponse.json(
      { error: 'Talabani guruhdan chiqarishda xatolik' },
      { status: 500 }
    )
  }
})

// Talabaning guruh ma'lumotlarini yangilash (narx, chegirma)
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) => {
  try {
    const user = getUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const { id: groupId, studentId } = await params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Noto\'g\'ri JSON format' },
        { status: 400 }
      )
    }

    const { price, discountReason, status } = body

    // GroupStudent mavjudligini tekshirish
    const existingGroupStudent = await prisma.groupStudent.findUnique({
      where: {
        groupId_studentId: {
          groupId,
          studentId,
        },
      },
    })

    if (!existingGroupStudent) {
      return NextResponse.json(
        { error: 'Talaba bu guruhda topilmadi' },
        { status: 404 }
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

    // Yangilash
    const updateData: any = {}
    if (parsedPrice !== undefined) updateData.price = parsedPrice
    if (discountReason !== undefined) updateData.discountReason = discountReason || null
    if (status !== undefined) updateData.status = status

    const groupStudent = await prisma.groupStudent.update({
      where: {
        groupId_studentId: {
          groupId,
          studentId,
        },
      },
      data: updateData,
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
      message: 'Ma\'lumotlar yangilandi',
    })
  } catch (error) {
    console.error('Update group student error:', error)
    return NextResponse.json(
      { error: 'Ma\'lumotlarni yangilashda xatolik' },
      { status: 500 }
    )
  }
})
