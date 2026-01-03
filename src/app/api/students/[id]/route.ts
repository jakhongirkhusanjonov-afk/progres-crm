import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'

// Bitta talabani olish
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        createdBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
        groupStudents: {
          include: {
            group: {
              include: {
                course: true,
                teacher: true,
              },
            },
          },
        },
        payments: {
          orderBy: {
            paymentDate: 'desc',
          },
        },
        attendances: {
          orderBy: {
            date: 'desc',
          },
          take: 10,
        },
        _count: {
          select: {
            payments: true,
            attendances: true,
            testResults: true,
          },
        },
      },
    })

    if (!student) {
      return NextResponse.json({ error: 'Talaba topilmadi' }, { status: 404 })
    }

    return NextResponse.json({ student })
  } catch (error) {
    console.error('Get student error:', error)
    return NextResponse.json(
      { error: 'Talabani yuklashda xatolik' },
      { status: 500 }
    )
  }
}

// Talabani tahrirlash
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const decoded = verifyToken(token || '')

    if (!decoded) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      middleName,
      phone,
      parentPhone,
      email,
      dateOfBirth,
      gender,
      address,
      passportSeries,
      passportNumber,
      status,
      notes,
    } = body

    // Majburiy maydonlarni tekshirish
    if (!firstName || !lastName || !phone) {
      return NextResponse.json(
        { error: 'Ism, familiya va telefon raqam majburiy' },
        { status: 400 }
      )
    }

    // Telefon raqam boshqa talabada yo'qligini tekshirish
    const existingStudent = await prisma.student.findUnique({
      where: { phone },
    })

    if (existingStudent && existingStudent.id !== params.id) {
      return NextResponse.json(
        { error: 'Bu telefon raqam bilan boshqa talaba mavjud' },
        { status: 400 }
      )
    }

    // Talabani yangilash
    const student = await prisma.student.update({
      where: { id: params.id },
      data: {
        firstName,
        lastName,
        middleName,
        phone,
        parentPhone,
        email,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender,
        address,
        passportSeries,
        passportNumber,
        status,
        notes,
      },
      include: {
        createdBy: {
          select: {
            fullName: true,
          },
        },
      },
    })

    return NextResponse.json({ success: true, student })
  } catch (error) {
    console.error('Update student error:', error)
    return NextResponse.json(
      { error: 'Talabani yangilashda xatolik' },
      { status: 500 }
    )
  }
}

// Talabani o'chirish (yoki arxivga olish)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const decoded = verifyToken(token || '')

    if (!decoded) {
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // URL dan "hard" parametrini olish (to'liq o'chirish yoki arxivga olish)
    const searchParams = request.nextUrl.searchParams
    const hardDelete = searchParams.get('hard') === 'true'

    if (hardDelete) {
      // To'liq o'chirish (ehtiyotkorlik bilan ishlatish kerak!)
      await prisma.student.delete({
        where: { id: params.id },
      })

      return NextResponse.json({
        success: true,
        message: 'Talaba to\'liq o\'chirildi'
      })
    } else {
      // Arxivga olish (status ni o'zgartirish)
      const student = await prisma.student.update({
        where: { id: params.id },
        data: {
          status: 'DROPPED', // DROPPED status arxivlangan degan ma'noni bildiradi
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Talaba arxivga olindi',
        student
      })
    }
  } catch (error) {
    console.error('Delete student error:', error)
    return NextResponse.json(
      { error: 'Talabani o\'chirishda xatolik' },
      { status: 500 }
    )
  }
}
