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

    // Guruh filtri (o'qituvchi faqat o'z guruhlarini ko'radi)
    const groupFilter = isTeacher && teacherId ? { teacherId } : {}

    // ============================================================
    // PARALLEL: Barcha mustaqil so'rovlarni bir vaqtda bajarish
    // N+1 querylar o'rniga batch/aggregate ishlatiladi
    // ============================================================
    const [
      activeStudents,
      activeGroups,
      totalTeachers,
      totalCourses,
      thisMonthPayments,
      thisMonthSalary,
      last6MonthsPaymentsRaw,
      groupsWithStudents,
      recentPayments,
      recentStudents,
      todayGroups,
      // Debt calculation: batch queries
      allActiveGroupStudents,
      chargesGrouped,
      paymentsGrouped,
      // Attendance for consecutive absent check (last 30 days only)
      recentAttendance,
    ] = await Promise.all([
      // 1. Faol talabalar soni
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

      // 2. Faol guruhlar soni
      prisma.group.count({ where: { status: 'ACTIVE', ...groupFilter } }),

      // 3. Jami o'qituvchilar
      prisma.teacher.count({ where: { status: 'ACTIVE' } }),

      // 4. Jami kurslar
      prisma.course.count({ where: { isActive: true } }),

      // 5. Bu oylik to'lovlar yig'indisi
      prisma.payment.aggregate({
        where: {
          paymentDate: { gte: currentMonth.toDate(), lte: currentMonthEnd.toDate() },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // 6. Bu oylik maosh to'lovlari
      prisma.salaryPayment.aggregate({
        where: { period: now.format('YYYY-MM') },
        _sum: { amount: true },
      }),

      // 7. Oxirgi 6 oy to'lovlar — groupBy bilan aggregate (findMany o'rniga)
      prisma.$queryRawUnsafe<Array<{ month: string; total: number }>>(
        `SELECT to_char("paymentDate", 'YYYY-MM') as month, COALESCE(SUM(amount), 0)::float as total
         FROM "Payment"
         WHERE "paymentDate" >= $1
         GROUP BY to_char("paymentDate", 'YYYY-MM')
         ORDER BY month ASC`,
        dayjs().subtract(6, 'month').startOf('month').toDate()
      ),

      // 8. Guruhlar va talabalar soni
      prisma.group.findMany({
        where: { status: 'ACTIVE', ...groupFilter },
        select: {
          id: true,
          name: true,
          _count: { select: { groupStudents: { where: { status: 'ACTIVE' } } } },
        },
        orderBy: { name: 'asc' },
      }),

      // 9. Oxirgi 5 ta to'lov
      prisma.payment.findMany({
        take: 5,
        orderBy: { paymentDate: 'desc' },
        include: { student: { select: { firstName: true, lastName: true } } },
      }),

      // 10. Oxirgi 5 ta talaba
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

      // 11. Bugungi darslar uchun guruhlar
      prisma.group.findMany({
        where: { status: 'ACTIVE', ...groupFilter },
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

      // 12. Faol group-student pairs (for debt calc — lightweight, no nested includes)
      prisma.groupStudent.findMany({
        where: {
          status: 'ACTIVE',
          group: { status: 'ACTIVE', ...groupFilter },
        },
        select: {
          groupId: true,
          studentId: true,
        },
      }),

      // 13. MonthlyCharge — batch SUM grouped by (groupId, studentId)
      prisma.monthlyCharge.groupBy({
        by: ['groupId', 'studentId'],
        _sum: { amount: true },
        where: {
          group: { status: 'ACTIVE', ...groupFilter },
          student: { status: 'ACTIVE' },
        },
      }),

      // 14. Payment — batch SUM grouped by (groupId, studentId) for TUITION only
      prisma.payment.groupBy({
        by: ['groupId', 'studentId'],
        _sum: { amount: true },
        where: {
          paymentType: 'TUITION',
          groupId: { not: null },
          student: { status: 'ACTIVE' },
        },
      }),

      // 15. Attendance — faqat oxirgi 30 kun (barcha vaqt emas!)
      prisma.attendance.findMany({
        where: {
          date: { gte: dayjs().subtract(30, 'day').toDate() },
          group: { status: 'ACTIVE', ...groupFilter },
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
      }),
    ])

    // ============================================================
    // Bugungi darslarni filterlash
    // ============================================================
    const today = now.day()
    const todayLessons = todayGroups.filter((g) => {
      if (!g.scheduleDays) return false
      const days = g.scheduleDays.split(',').map((d) => parseInt(d.trim()))
      return days.includes(today)
    })

    // ============================================================
    // Ketma-ket 2 ta dars qoldirganlarni aniqlash
    // Faqat oxirgi 30 kun davomati bilan (barcha tarix emas!)
    // ============================================================
    const activeStudentGroupSet = new Set(
      allActiveGroupStudents.map((gs) => `${gs.studentId}_${gs.groupId}`)
    )

    // (studentId, groupId) juftligi bo'yicha guruhlash
    const attByPair = new Map<string, typeof recentAttendance>()
    for (const att of recentAttendance) {
      const key = `${att.studentId}_${att.groupId}`
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

    for (const [key, atts] of attByPair) {
      if (
        atts.length >= 2 &&
        atts[0].status === 'ABSENT' &&
        atts[1].status === 'ABSENT'
      ) {
        const info = atts[0]
        consecutiveAbsentStudents.push({
          studentId: info.studentId,
          studentName: `${info.student.firstName} ${info.student.lastName}`,
          phone: info.student.phone || info.student.parentPhone || '',
          groupName: info.group.name,
        })
      }
    }

    // ============================================================
    // Qarzdorlik hisoblash: BATCH SUM — N+1 query yo'q!
    // qarz = SUM(MonthlyCharge) - SUM(Payment TUITION for same group)
    // ============================================================
    // Build lookup maps
    const chargesMap = new Map<string, number>()
    for (const row of chargesGrouped) {
      const key = `${row.groupId}_${row.studentId}`
      chargesMap.set(key, Number(row._sum.amount || 0))
    }

    const paymentsMap = new Map<string, number>()
    for (const row of paymentsGrouped) {
      if (!row.groupId) continue
      const key = `${row.groupId}_${row.studentId}`
      paymentsMap.set(key, Number(row._sum.amount || 0))
    }

    let totalDebt = 0
    for (const gs of allActiveGroupStudents) {
      const key = `${gs.groupId}_${gs.studentId}`
      const expected = chargesMap.get(key) || 0
      const paid = paymentsMap.get(key) || 0
      const debt = expected - paid
      if (debt > 0) totalDebt += debt
    }

    // ============================================================
    // Oxirgi 6 oy grafiklarini formatlash
    // ============================================================
    const months: { month: string; label: string; total: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const monthDate = dayjs().subtract(i, 'month')
      months.push({ month: monthDate.format('YYYY-MM'), label: monthDate.format('MMM'), total: 0 })
    }
    // Fill from raw query results
    for (const row of last6MonthsPaymentsRaw) {
      const monthIndex = months.findIndex((m) => m.month === row.month)
      if (monthIndex !== -1) months[monthIndex].total = Number(row.total) || 0
    }

    // ============================================================
    // Guruhlar statistikasini formatlash
    // ============================================================
    const groupsStats = groupsWithStudents.map((g) => ({
      name: g.name,
      students: g._count.groupStudents,
    }))

    // Sof foyda
    const thisMonthRevenue = Number(thisMonthPayments._sum.amount) || 0
    const thisMonthExpense = Number(thisMonthSalary._sum.amount) || 0
    const netProfit = thisMonthRevenue - thisMonthExpense

    return NextResponse.json({
      consecutiveAbsentStudents,

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

      paymentsChart: months,
      groupsStats,

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
