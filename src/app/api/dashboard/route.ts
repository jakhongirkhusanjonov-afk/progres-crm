import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'
import dayjs from 'dayjs'

// Dashboard statistikalarini olish
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const now = dayjs()
    const currentMonth = now.startOf('month')
    const currentMonthEnd = now.endOf('month')

    // Tizimga kirgan foydalanuvchini aniqlash
    const currentUser = getUser(request)
    const isTeacher = currentUser?.role === 'TEACHER'
    const teacherId = currentUser?.teacherId

    // Parallel ravishda barcha ma'lumotlarni olish
    const [
      activeStudents,
      activeGroups,
      totalTeachers,
      totalCourses,
      thisMonthPayments,
      thisMonthSalary,
      last6MonthsPayments,
      groupsWithStudents,
      recentPayments,
      recentStudents,
      todayGroups,
      allActiveGroupStudents,
      allPaymentsThisMonth,
    ] = await Promise.all([
      // Faol talabalar
      isTeacher && teacherId
        ? prisma.student.count({
            where: {
              status: 'ACTIVE',
              groupStudents: {
                some: {
                  status: 'ACTIVE',
                  group: { status: 'ACTIVE', teacherId },
                },
              },
            },
          })
        : prisma.student.count({ where: { status: 'ACTIVE' } }),

      // Faol guruhlar
      isTeacher && teacherId
        ? prisma.group.count({ where: { status: 'ACTIVE', teacherId } })
        : prisma.group.count({ where: { status: 'ACTIVE' } }),

      // Jami o'qituvchilar
      prisma.teacher.count({ where: { status: 'ACTIVE' } }),

      // Jami kurslar
      prisma.course.count({ where: { isActive: true } }),

      // Bu oylik to'lovlar yig'indisi
      prisma.payment.aggregate({
        where: {
          paymentDate: { gte: currentMonth.toDate(), lte: currentMonthEnd.toDate() },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Bu oylik maosh to'lovlari
      prisma.salaryPayment.aggregate({
        where: { period: now.format('YYYY-MM') },
        _sum: { amount: true },
      }),

      // Oxirgi 6 oy to'lovlar
      prisma.payment.findMany({
        where: {
          paymentDate: { gte: dayjs().subtract(6, 'month').startOf('month').toDate() },
        },
        select: { amount: true, paymentDate: true },
      }),

      // Guruhlar va talabalar soni
      prisma.group.findMany({
        where: {
          status: 'ACTIVE',
          ...(isTeacher && teacherId ? { teacherId } : {}),
        },
        select: {
          id: true,
          name: true,
          _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { name: 'asc' },
      }),

      // Oxirgi 5 ta to'lov
      prisma.payment.findMany({
        take: 5,
        orderBy: { paymentDate: 'desc' },
        include: { student: { select: { firstName: true, lastName: true } } },
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
          createdAt: true,
        },
      }),

      // Bugungi darslar
      prisma.group.findMany({
        where: {
          status: 'ACTIVE',
          ...(isTeacher && teacherId ? { teacherId } : {}),
        },
        select: {
          id: true,
          name: true,
          startTime: true,
          endTime: true,
          scheduleDays: true,
          teacher: { select: { firstName: true, lastName: true } },
          course: { select: { name: true } },
          _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { startTime: 'asc' },
      }),

      // Qarzdorlik uchun - faol guruh talabalari
      prisma.groupStudent.findMany({
        where: {
          status: 'ACTIVE',
          group: {
            status: 'ACTIVE',
            ...(isTeacher && teacherId ? { teacherId } : {}),
          },
        },
        include: { group: { include: { course: true } } },
      }),

      // Bu oylik to'lovlar - qarzdorlikni hisoblash uchun
      isTeacher && teacherId
        ? prisma.payment.aggregate({
            where: {
              paymentDate: { gte: currentMonth.toDate(), lte: currentMonthEnd.toDate() },
              student: {
                groupStudents: {
                  some: { status: 'ACTIVE', group: { status: 'ACTIVE', teacherId } },
                },
              },
            },
            _sum: { amount: true },
          })
        : prisma.payment.aggregate({
            where: {
              paymentDate: { gte: currentMonth.toDate(), lte: currentMonthEnd.toDate() },
            },
            _sum: { amount: true },
          }),
    ])

    // Bugungi darslarni filterlash
    const today = now.day()
    const todayLessons = todayGroups.filter((g) => {
      if (!g.scheduleDays) return false
      const days = g.scheduleDays.split(',').map((d) => parseInt(d.trim()))
      return days.includes(today)
    })

    // ====================================================
    // Ketma-ket 2 ta dars qoldirganlarni aniqlash
    // Barcha faol guruh talabalari uchun barcha davomatlarni olib,
    // JS da guruhlash va oxirgi 2 ta statusni tekshiramiz.
    // ====================================================
    // Build the set of active (studentId, groupId) pairs for filtering
    const activeStudentGroupSet = new Set(
      allActiveGroupStudents.map((gs) => `${gs.studentId}_${gs.groupId}`)
    )

    const allAttFull = await prisma.attendance.findMany({
      where: {
        group: { status: 'ACTIVE' },
        student: { status: 'ACTIVE' },
      },
      select: {
        studentId: true,
        groupId: true,
        date: true,
        status: true,
        student: {
          select: { firstName: true, lastName: true, phone: true, parentPhone: true },
        },
        group: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    })

    // (studentId, groupId) juftligi bo'yicha guruhlash (faqat faol enrollment lar)
    const attByPair = new Map<string, typeof allAttFull>()
    for (const att of allAttFull) {
      const key = `${att.studentId}_${att.groupId}`
      // Faqat faol GroupStudent yozuvlari uchun
      if (!activeStudentGroupSet.has(key)) continue
      if (!attByPair.has(key)) attByPair.set(key, [])
      attByPair.get(key)!.push(att)
    }

    // Oxirgi 2 ta davomati ham ABSENT bo'lgan talabalarni topish
    const consecutiveAbsentStudents: Array<{
      studentId: string
      studentName: string
      phone: string
      groupName: string
    }> = []
    const seenPairs = new Set<string>()

    for (const [key, atts] of attByPair) {
      if (
        atts.length >= 2 &&
        atts[0].status === 'ABSENT' &&
        atts[1].status === 'ABSENT' &&
        !seenPairs.has(key)
      ) {
        seenPairs.add(key)
        const info = atts[0]
        consecutiveAbsentStudents.push({
          studentId: info.studentId,
          studentName: `${info.student.firstName} ${info.student.lastName}`,
          phone: info.student.phone || info.student.parentPhone || '',
          groupName: info.group.name,
        })
      }
    }

    // Qarzdorlik hisoblash
    let expectedTotal = 0
    allActiveGroupStudents.forEach((gs) => {
      const price = gs.price || gs.group.price || gs.group.course.price
      expectedTotal += Number(price) || 0
    })
    const paidTotal = Number(allPaymentsThisMonth._sum.amount) || 0
    const totalDebt = Math.max(0, expectedTotal - paidTotal)

    // Oxirgi 6 oy grafiklarini formatlash
    const months: { month: string; label: string; total: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = dayjs().subtract(i, 'month')
      months.push({ month: monthDate.format('YYYY-MM'), label: monthDate.format('MMM'), total: 0 })
    }
    last6MonthsPayments.forEach((p) => {
      const paymentMonth = dayjs(p.paymentDate).format('YYYY-MM')
      const monthIndex = months.findIndex((m) => m.month === paymentMonth)
      if (monthIndex !== -1) months[monthIndex].total += Number(p.amount) || 0
    })

    // Guruhlar statistikasini formatlash
    const groupsStats = groupsWithStudents.map((g) => ({
      name: g.name,
      students: g._count.groupStudents,
    }))

    // Sof foyda
    const thisMonthRevenue = Number(thisMonthPayments._sum.amount) || 0
    const thisMonthExpense = Number(thisMonthSalary._sum.amount) || 0
    const netProfit = thisMonthRevenue - thisMonthExpense

    return NextResponse.json({
      // Ketma-ket dars qoldirganlar (Admin/SuperAdmin uchun)
      consecutiveAbsentStudents,

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
        paymentsCount: thisMonthPayments._count,
      },

      // To'lovlar grafigi (oxirgi 6 oy)
      paymentsChart: months,

      // Guruhlar statistikasi
      groupsStats,

      // Oxirgi faoliyat
      recentActivity: {
        payments: recentPayments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          date: p.paymentDate,
          studentName: `${p.student.firstName} ${p.student.lastName}`,
          method: p.method,
          type: p.paymentType,
        })),
        students: recentStudents,
        todayLessons: todayLessons.map((g) => ({
          id: g.id,
          name: g.name,
          time: `${g.startTime} - ${g.endTime}`,
          teacher: `${g.teacher.firstName} ${g.teacher.lastName}`,
          course: g.course.name,
          studentsCount: g._count.groupStudents,
        })),
      },
    })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 })
  }
})
