import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Bitta talabani olish
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const user = getUser(request)

    // STUDENT role faqat o'z profilini ko'ra oladi
    if (user?.role === 'STUDENT' && user?.studentId !== id) {
      return NextResponse.json(
        { error: 'Sizda bu talabani ko\'rish huquqi yo\'q' },
        { status: 403 }
      )
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            fullName: true,
            email: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            isActive: true,
            lastLogin: true,
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
})

// Talabani tahrirlash
export const PUT = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const user = getUser(request)

    if (!user) {
      console.error('PUT /api/students/[id] - Avtorizatsiya yo\'q')
      return NextResponse.json({ error: 'Avtorizatsiya kerak' }, { status: 401 })
    }

    // STUDENT role tahrirlash huquqiga ega emas
    if (user.role === 'STUDENT') {
      return NextResponse.json(
        { error: 'Sizda tahrirlash huquqi yo\'q' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('PUT /api/students/[id] - Kelgan ma\'lumotlar:', JSON.stringify(body, null, 2))

    const {
      firstName,
      lastName,
      phone,
      parentPhone,
      dateOfBirth,
      gender,
      status,
    } = body

    // Majburiy maydonlarni tekshirish
    if (!firstName || !lastName || !phone) {
      console.error('PUT /api/students/[id] - Majburiy maydonlar yo\'q')
      return NextResponse.json(
        { error: 'Ism, familiya va telefon raqam majburiy' },
        { status: 400 }
      )
    }

    // Telefon raqam formatini tekshirish
    const phoneRegex = /^\+998\d{9}$/
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { error: 'Telefon raqam +998XXXXXXXXX formatida bo\'lishi kerak' },
        { status: 400 }
      )
    }

    // Telefon raqam boshqa talabada yo'qligini tekshirish
    const existingStudent = await prisma.student.findFirst({
      where: {
        phone,
        id: { not: id },
      },
    })

    if (existingStudent) {
      return NextResponse.json(
        { error: 'Bu telefon raqam bilan boshqa talaba mavjud' },
        { status: 400 }
      )
    }

    // Avvalgi talaba ma'lumotlarini olish (user status sync uchun)
    const currentStudent = await prisma.student.findUnique({
      where: { id },
      select: { userId: true, status: true },
    })

    // Talabani yangilash (transaction bilan)
    const student = await prisma.$transaction(async (tx) => {
      // Talabani yangilash
      const updatedStudent = await tx.student.update({
        where: { id },
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone,
          parentPhone: parentPhone || null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          gender: gender || null,
          status: status || undefined,
        },
        include: {
          createdBy: {
            select: {
              fullName: true,
            },
          },
          user: {
            select: {
              id: true,
              username: true,
              isActive: true,
            },
          },
          groupStudents: {
            include: {
              group: {
                include: {
                  course: true,
                },
              },
            },
          },
        },
      })

      // Agar status o'zgargan bo'lsa va user mavjud bo'lsa, user statusini ham sync qilish
      if (status && currentStudent?.userId && status !== currentStudent.status) {
        // GRADUATED, DROPPED yoki SUSPENDED bo'lsa - user'ni bloklash (login huquqini olish)
        if (status === 'GRADUATED' || status === 'DROPPED' || status === 'SUSPENDED') {
          await tx.user.update({
            where: { id: currentStudent.userId },
            data: { isActive: false },
          })
          console.log(`User ${currentStudent.userId} bloklandi (student status: ${status})`)
        }
        // ACTIVE bo'lsa - user'ni aktiv qilish (qayta faollashtirish)
        else if (status === 'ACTIVE') {
          await tx.user.update({
            where: { id: currentStudent.userId },
            data: { isActive: true },
          })
          console.log(`User ${currentStudent.userId} qayta faollashtirildi`)
        }
      }

      return updatedStudent
    })

    console.log('PUT /api/students/[id] - Talaba yangilandi:', student.id)
    return NextResponse.json({ success: true, student })
  } catch (error) {
    console.error('PUT /api/students/[id] - Xatolik:', error)
    return NextResponse.json(
      { error: 'Talabani yangilashda xatolik' },
      { status: 500 }
    )
  }
})

// Talabani o'chirish (yoki arxivga olish)
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

    // STUDENT role o'chirish huquqiga ega emas
    if (user.role === 'STUDENT') {
      return NextResponse.json(
        { error: 'Sizda o\'chirish huquqi yo\'q' },
        { status: 403 }
      )
    }

    // URL dan "hard" parametrini olish (to'liq o'chirish yoki arxivga olish)
    const searchParams = request.nextUrl.searchParams
    const hardDelete = searchParams.get('hard') === 'true'

    // Talabani topish
    const currentStudent = await prisma.student.findUnique({
      where: { id },
      select: { userId: true },
    })

    if (hardDelete) {
      // To'liq o'chirish (ehtiyotkorlik bilan ishlatish kerak!)
      await prisma.$transaction(async (tx) => {
        // Agar user mavjud bo'lsa, uni ham o'chirish
        if (currentStudent?.userId) {
          await tx.user.delete({
            where: { id: currentStudent.userId },
          })
        }
        await tx.student.delete({
          where: { id },
        })
      })

      return NextResponse.json({
        success: true,
        message: 'Talaba to\'liq o\'chirildi'
      })
    } else {
      // Arxivga olish (status ni o'zgartirish va user'ni bloklash)
      const student = await prisma.$transaction(async (tx) => {
        // User'ni bloklash (agar mavjud bo'lsa)
        if (currentStudent?.userId) {
          await tx.user.update({
            where: { id: currentStudent.userId },
            data: { isActive: false },
          })
        }

        // Talaba statusini yangilash
        return tx.student.update({
          where: { id },
          data: {
            status: 'DROPPED',
          },
        })
      })

      return NextResponse.json({
        success: true,
        message: 'Talaba arxivga olindi. Login huquqi bekor qilindi.',
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
})
