import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'
import dayjs from 'dayjs'

// Dashboard statistikalarini olish
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const now = dayjs()
    const currentMonth = now.startOf('month')
    const currentMonthEnd = now.endOf('month')

    // Parallel ravishda barcha ma'lumotlarni olish
    const [
      // Asosiy statistikalar
      activeStudents,
      activeGroups,
      totalTeachers,
      totalCourses,

      // Bu oylik daromad (to'lovlar)
      thisMonthPayments,

      // Bu oylik xarajat (o'qituvchi maoshi)
      thisMonthSalary,

      // Oxirgi 6 oy to'lovlar
      last6MonthsPayments,

      // Guruhlar statistikasi (talabalar soni)
      groupsWithStudents,

      // Oxirgi 5 ta to'lov
      recentPayments,

      // Oxirgi 5 ta talaba
      recentStudents,

      // Bugungi darslar
      todayGroups,

      // Umumiy qarzdorlik hisoblash uchun
      allActiveGroupStudents,
      allPaymentsThisMonth,
    ] = await Promise.all([
      // Faol talabalar
      prisma.student.count({
        where: { status: 'ACTIVE' }
      }),

      // Faol guruhlar
      prisma.group.count({
        where: { status: 'ACTIVE' }
      }),

      // Jami o'qituvchilar
      prisma.teacher.count({
        where: { status: 'ACTIVE' }
      }),

      // Jami kurslar
      prisma.course.count({
        where: { isActive: true }
      }),

      // Bu oylik to'lovlar yig'indisi
      prisma.payment.aggregate({
        where: {
          paymentDate: {
            gte: currentMonth.toDate(),
            lte: currentMonthEnd.toDate()
          }
        },
        _sum: { amount: true },
        _count: true
      }),

      // Bu oylik maosh to'lovlari
      prisma.salaryPayment.aggregate({
        where: {
          period: now.format('YYYY-MM')
        },
        _sum: { amount: true }
      }),

      // Oxirgi 6 oy to'lovlar - raw query
      prisma.payment.findMany({
        where: {
          paymentDate: {
            gte: dayjs().subtract(6, 'month').startOf('month').toDate()
          }
        },
        select: {
          amount: true,
          paymentDate: true
        }
      }),

      // Guruhlar va talabalar soni
      prisma.group.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              groupStudents: {
                where: { status: 'ACTIVE' }
              }
            }
          }
        },
        orderBy: { name: 'asc' }
      }),

      // Oxirgi 5 ta to'lov
      prisma.payment.findMany({
        take: 5,
        orderBy: { paymentDate: 'desc' },
        include: {
          student: {
            select: { firstName: true, lastName: true }
          }
        }
      }),

      // Oxirgi 5 ta talaba
      prisma.student.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          createdAt: true
        }
      }),

      // Bugungi darslar (scheduleDays tekshiruvi)
      prisma.group.findMany({
        where: {
          status: 'ACTIVE'
        },
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          scheduleDays: true,
          teacher: {
            select: { firstName: true, lastName: true }
          },
          course: {
            select: { name: true }
          },
          _count: {
            select: {
              groupStudents: {
                where: { status: 'ACTIVE' }
              }
            }
          }
        },
        orderBy: { startTime: 'asc' }
      }),

      // Qarzdorlik uchun - faol guruh talabalari
      prisma.groupStudent.findMany({
        where: {
          status: 'ACTIVE',
          group: { status: 'ACTIVE' }
        },
        include: {
          group: {
            include: {
              course: true
            }
          }
        }
      }),

      // Bu oylik to'lovlar
      prisma.payment.aggregate({
        where: {
          paymentDate: {
            gte: currentMonth.toDate(),
            lte: currentMonthEnd.toDate()
          }
        },
        _sum: { amount: true }
      })
    ])

    // Bugungi kunni olish
    const today = now.day()

    // Bugungi darslarni filterlash
    const todayLessons = todayGroups.filter(g => {
      if (!g.scheduleDays) return false
      const days = g.scheduleDays.split(',').map(d => parseInt(d.trim()))
      return days.includes(today)
    })

    // Qarzdorlik hisoblash
    let expectedTotal = 0
    allActiveGroupStudents.forEach(gs => {
      const price = gs.price || gs.group.price || gs.group.course.price
      expectedTotal += Number(price) || 0
    })
    const paidTotal = Number(allPaymentsThisMonth._sum.amount) || 0
    const totalDebt = Math.max(0, expectedTotal - paidTotal)

    // Oxirgi 6 oy grafiklarini formatlash
    const months: { month: string; label: string; total: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = dayjs().subtract(i, 'month')
      months.push({
        month: monthDate.format('YYYY-MM'),
        label: monthDate.format('MMM'),
        total: 0
      })
    }

    // To'lovlarni months massiviga qo'shish
    last6MonthsPayments.forEach((p) => {
      const paymentMonth = dayjs(p.paymentDate).format('YYYY-MM')
      const monthIndex = months.findIndex(m => m.month === paymentMonth)
      if (monthIndex !== -1) {
        months[monthIndex].total += Number(p.amount) || 0
      }
    })

    // Guruhlar statistikasini formatlash
    const groupsStats = groupsWithStudents.map(g => ({
      name: g.name,
      students: g._count.groupStudents
    }))

    // Sof foyda
    const thisMonthRevenue = Number(thisMonthPayments._sum.amount) || 0
    const thisMonthExpense = Number(thisMonthSalary._sum.amount) || 0
    const netProfit = thisMonthRevenue - thisMonthExpense

    return NextResponse.json({
      // Statistika kartalari
      stats: {
        thisMonthRevenue,
        thisMonthExpense,
        netProfit,
        activeStudents,
        activeGroups,
        totalDebt,
        totalTeachers,
        totalCourses,
        paymentsCount: thisMonthPayments._count
      },

      // To'lovlar grafigi (oxirgi 6 oy)
      paymentsChart: months,

      // Guruhlar statistikasi
      groupsStats,

      // Oxirgi faoliyat
      recentActivity: {
        payments: recentPayments.map(p => ({
          id: p.id,
          amount: Number(p.amount),
          date: p.paymentDate,
          studentName: `${p.student.firstName} ${p.student.lastName}`,
          method: p.method,
          type: p.paymentType
        })),
        students: recentStudents,
        todayLessons: todayLessons.map(g => ({
          id: g.id,
          name: g.name,
          time: `${g.startTime} - ${g.endTime}`,
          teacher: `${g.teacher.firstName} ${g.teacher.lastName}`,
          course: g.course.name,
          studentsCount: g._count.groupStudents
        }))
      }
    })

  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Server xatosi' },
      { status: 500 }
    )
  }
})
