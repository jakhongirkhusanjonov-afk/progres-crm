import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

// Uzbek oy nomlari (1-indeksdan, getMonth()+1 bilan mos keladi)
const UZ_MONTHS: Record<number, string> = {
  1: 'Yanvar',
  2: 'Fevral',
  3: 'Mart',
  4: 'Aprel',
  5: 'May',
  6: 'Iyun',
  7: 'Iyul',
  8: 'Avgust',
  9: 'Sentabr',
  10: 'Oktabr',
  11: 'Noyabr',
  12: 'Dekabr',
}

// Joriy oy to'lovlari tekshiruvi (checklist)
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: groupId } = await params

    const now = new Date()
    const currentMonth = now.getMonth() + 1  // 1-12
    const currentYear = now.getFullYear()
    const currentMonthName = UZ_MONTHS[currentMonth]

    // Guruh mavjudligini tekshirish + o'quvchilarni olish
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        groupStudents: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
          orderBy: {
            enrollDate: 'asc',
          },
        },
      },
    })

    if (!group) {
      return NextResponse.json(
        { error: 'Guruh topilmadi' },
        { status: 404 }
      )
    }

    const studentIds = group.groupStudents.map((gs) => gs.studentId)

    if (studentIds.length === 0) {
      return NextResponse.json({
        checklist: [],
        currentMonth,
        currentYear,
        currentMonthName,
      })
    }

    // Joriy guruh + joriy oy + joriy yil uchun to'lovlarni olish
    // forMonth va forYear ustunlarida tekshirish + paymentDate bo'yicha fallback
    const payments = await prisma.payment.findMany({
      where: {
        studentId: { in: studentIds },
        groupId,
        OR: [
          // forMonth/forYear ustunlari to'ldirilgan bo'lsa
          {
            forMonth: currentMonthName,
            forYear: currentYear,
          },
          // Bu oyda kiritilgan to'lovlar (forMonth/forYear bo'sh bo'lsa ham)
          {
            forMonth: null,
            paymentDate: {
              gte: new Date(currentYear, currentMonth - 1, 1),
              lt: new Date(currentYear, currentMonth, 1),
            },
          },
        ],
      },
      select: {
        id: true,
        studentId: true,
        amount: true,
        forMonth: true,
        forYear: true,
        paymentDate: true,
      },
    })

    // To'lagan talabalar Set'i
    const paidStudentIds = new Set(payments.map((p) => p.studentId))

    // Cheklistni yaratish
    const checklist = group.groupStudents.map((gs, index) => ({
      index: index + 1,
      studentId: gs.student.id,
      firstName: gs.student.firstName,
      lastName: gs.student.lastName,
      phone: gs.student.phone,
      hasPaid: paidStudentIds.has(gs.student.id),
    }))

    return NextResponse.json({
      checklist,
      currentMonth,
      currentYear,
      currentMonthName,
    })
  } catch (error) {
    console.error('Payment checklist error:', error)
    return NextResponse.json(
      { error: 'To\'lov cheklistini yuklashda xatolik' },
      { status: 500 }
    )
  }
})
