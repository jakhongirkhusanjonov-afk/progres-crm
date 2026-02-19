import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Bitta davomat ma'lumotlarini olish
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    const attendance = await prisma.attendance.findUnique({
      where: { id },
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
    })

    if (!attendance) {
      return NextResponse.json(
        { error: 'Davomat topilmadi' },
        { status: 404 }
      )
    }

    return NextResponse.json({ attendance })
  } catch (error) {
    console.error('Get attendance error:', error)
    return NextResponse.json(
      { error: "Davomat ma'lumotlarini yuklashda xatolik" },
      { status: 500 }
    )
  }
})

// Davomatni yangilash
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
        { error: "Noto'g'ri JSON format" },
        { status: 400 }
      )
    }

    const { status, notes } = body

    // Davomat mavjudligini tekshirish
    const existingAttendance = await prisma.attendance.findUnique({
      where: { id },
    })

    if (!existingAttendance) {
      return NextResponse.json(
        { error: 'Davomat topilmadi' },
        { status: 404 }
      )
    }

    // Status validatsiyasi
    if (status && !['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].includes(status)) {
      return NextResponse.json(
        { error: "Davomat statusi noto'g'ri" },
        { status: 400 }
      )
    }

    // Yangilash
    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes

    const attendance = await prisma.attendance.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Davomat yangilandi',
      attendance,
    })
  } catch (error: any) {
    console.error('Update attendance error:', error)
    return NextResponse.json(
      { error: `Davomatni yangilashda xatolik: ${error?.message || "Noma'lum xato"}` },
      { status: 500 }
    )
  }
})

// Davomatni o'chirish
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

    // Davomat mavjudligini tekshirish
    const existingAttendance = await prisma.attendance.findUnique({
      where: { id },
    })

    if (!existingAttendance) {
      return NextResponse.json(
        { error: 'Davomat topilmadi' },
        { status: 404 }
      )
    }

    // O'chirish
    await prisma.attendance.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: "Davomat o'chirildi",
    })
  } catch (error: any) {
    console.error('Delete attendance error:', error)
    return NextResponse.json(
      { error: `Davomatni o'chirishda xatolik: ${error?.message || "Noma'lum xato"}` },
      { status: 500 }
    )
  }
})
