import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, getUser } from '@/lib/api-middleware'

// Talaba davomatini olish (batafsil, guruh bilan)
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: studentId } = await params
    const user = getUser(request)
    const searchParams = request.nextUrl.searchParams

    // STUDENT role faqat o'z davomatini ko'ra oladi
    if (user?.role === 'STUDENT' && user?.studentId !== studentId) {
      return NextResponse.json(
        { error: 'Sizda bu talaba davomatini ko\'rish huquqi yo\'q' },
        { status: 403 }
      )
    }
    const month = searchParams.get('month') || ''
    const groupId = searchParams.get('groupId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Talaba mavjudligini tekshirish
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        groupStudents: {
          where: { status: 'ACTIVE' },
          include: {
            group: {
              select: {
                id: true,
                name: true,
                course: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
                teacher: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!student) {
      return NextResponse.json(
        { error: 'Talaba topilmadi' },
        { status: 404 }
      )
    }

    // Davomat filterlari
    const where: any = { studentId }

    // Oy bo'yicha filter
    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      const startDate = new Date(year, monthNum - 1, 1)
      const endDate = new Date(year, monthNum, 0, 23, 59, 59)
      where.date = {
        gte: startDate,
        lte: endDate,
      }
    }

    // Guruh bo'yicha filter
    if (groupId) {
      where.groupId = groupId
    }

    // Umumiy sonni olish
    const total = await prisma.attendance.count({ where })

    // Pagination
    const skip = (page - 1) * limit

    // Davomatlarni olish (guruh ma'lumotlari bilan)
    const attendances = await prisma.attendance.findMany({
      where,
      include: {
        group: {
          select: {
            id: true,
            name: true,
            course: {
              select: {
                id: true,
                name: true,
              },
            },
            teacher: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: 'desc' }],
      skip,
      take: limit,
    })

    // Davomat statistikasi - barcha vaqt uchun
    const allTimeStats = await prisma.attendance.groupBy({
      by: ['status'],
      where: { studentId },
      _count: true,
    })

    const allTimeTotal = allTimeStats.reduce((sum, s) => sum + s._count, 0)
    const allTimePresent = allTimeStats.find((s) => s.status === 'PRESENT')?._count || 0
    const allTimeLate = allTimeStats.find((s) => s.status === 'LATE')?._count || 0
    const allTimeAbsent = allTimeStats.find((s) => s.status === 'ABSENT')?._count || 0
    const allTimeExcused = allTimeStats.find((s) => s.status === 'EXCUSED')?._count || 0

    // Davomat statistikasi - filterlangan
    let filteredStats: any = null
    if (month || groupId) {
      const statsResult = await prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: true,
      })

      const filteredTotal = statsResult.reduce((sum, s) => sum + s._count, 0)
      const filteredPresent = statsResult.find((s) => s.status === 'PRESENT')?._count || 0
      const filteredLate = statsResult.find((s) => s.status === 'LATE')?._count || 0
      const filteredAbsent = statsResult.find((s) => s.status === 'ABSENT')?._count || 0
      const filteredExcused = statsResult.find((s) => s.status === 'EXCUSED')?._count || 0

      filteredStats = {
        total: filteredTotal,
        present: filteredPresent,
        late: filteredLate,
        absent: filteredAbsent,
        excused: filteredExcused,
        attendanceRate: filteredTotal > 0
          ? Math.round(((filteredPresent + filteredLate) / filteredTotal) * 100)
          : 0,
      }
    }

    // Guruhlar bo'yicha statistika
    const groupStats = await prisma.attendance.groupBy({
      by: ['groupId', 'status'],
      where: { studentId },
      _count: true,
    })

    // Guruhlar bo'yicha statistikani formatlash
    const groupStatsMap: Record<string, any> = {}
    groupStats.forEach((stat) => {
      if (!groupStatsMap[stat.groupId]) {
        groupStatsMap[stat.groupId] = {
          present: 0,
          late: 0,
          absent: 0,
          excused: 0,
          total: 0,
        }
      }
      groupStatsMap[stat.groupId][stat.status.toLowerCase()] = stat._count
      groupStatsMap[stat.groupId].total += stat._count
    })

    // Guruhlar haqida ma'lumot olish
    const groupIds = Object.keys(groupStatsMap)
    const groups = await prisma.group.findMany({
      where: { id: { in: groupIds } },
      select: {
        id: true,
        name: true,
        course: {
          select: {
            name: true,
          },
        },
      },
    })

    const groupStatsFinal = groups.map((g) => {
      const stats = groupStatsMap[g.id]
      return {
        group: g,
        stats: {
          ...stats,
          attendanceRate: stats.total > 0
            ? Math.round(((stats.present + stats.late) / stats.total) * 100)
            : 0,
        },
      }
    })

    return NextResponse.json({
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        phone: student.phone,
        groups: student.groupStudents.map((gs) => gs.group),
      },
      attendances: attendances.map((att) => ({
        id: att.id,
        date: att.date,
        status: att.status,
        notes: att.notes,
        group: att.group,
      })),
      stats: {
        allTime: {
          total: allTimeTotal,
          present: allTimePresent,
          late: allTimeLate,
          absent: allTimeAbsent,
          excused: allTimeExcused,
          attendanceRate: allTimeTotal > 0
            ? Math.round(((allTimePresent + allTimeLate) / allTimeTotal) * 100)
            : 0,
        },
        filtered: filteredStats,
        byGroup: groupStatsFinal,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get student attendance error:', error)
    return NextResponse.json(
      { error: 'Talaba davomatini yuklashda xatolik' },
      { status: 500 }
    )
  }
})
