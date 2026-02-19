import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

// O'qituvchi to'lov tarixini olish
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ teacherId: string }> }
) => {
  try {
    const { teacherId } = await params
    const searchParams = request.nextUrl.searchParams
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // O'qituvchi mavjudligini tekshirish
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    })

    if (!teacher) {
      return NextResponse.json(
        { error: "O'qituvchi topilmadi" },
        { status: 404 }
      )
    }

    // Yil bo'yicha filter
    const where: any = { teacherId }
    if (year) {
      where.period = {
        startsWith: year,
      }
    }

    // Umumiy sonni olish
    const total = await prisma.salaryPayment.count({ where })

    // Pagination
    const skip = (page - 1) * limit

    // To'lovlar tarixini olish
    const payments = await prisma.salaryPayment.findMany({
      where,
      orderBy: [{ period: 'desc' }, { paymentDate: 'desc' }],
      skip,
      take: limit,
    })

    // Oylar bo'yicha guruhlash
    const paymentsByMonth: Record<string, any[]> = {}
    payments.forEach((payment) => {
      if (!paymentsByMonth[payment.period]) {
        paymentsByMonth[payment.period] = []
      }
      paymentsByMonth[payment.period].push({
        id: payment.id,
        amount: Number(payment.amount),
        paymentDate: payment.paymentDate,
        method: payment.method,
        notes: payment.notes,
      })
    })

    // Jami to'langan
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0)

    // Yillik statistika
    const yearlyStats = await prisma.salaryPayment.aggregate({
      where: {
        teacherId,
        period: {
          startsWith: year,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    })

    return NextResponse.json({
      teacher,
      year,
      payments: paymentsByMonth,
      stats: {
        totalPayments: total,
        yearlyTotal: Number(yearlyStats._sum.amount) || 0,
        yearlyCount: yearlyStats._count,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get salary history error:', error)
    return NextResponse.json(
      { error: "To'lov tarixini yuklashda xatolik" },
      { status: 500 }
    )
  }
})
