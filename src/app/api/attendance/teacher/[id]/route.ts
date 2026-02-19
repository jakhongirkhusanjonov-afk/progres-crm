import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

// O'qituvchi davomatini olish (barcha guruhlar uchun)
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: teacherId } = await params
    const searchParams = request.nextUrl.searchParams
    const month = searchParams.get('month') || '' // "2024-01" formatida
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''

    // O'qituvchi mavjudligini tekshirish
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        groups: {
          where: { status: 'ACTIVE' },
          include: {
            course: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
            _count: {
              select: {
                groupStudents: true,
              },
            },
          },
        },
        teacherCourses: {
          include: {
            course: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
    })

    if (!teacher) {
      return NextResponse.json(
        { error: "O'qituvchi topilmadi" },
        { status: 404 }
      )
    }

    // Sana filterlarini sozlash
    let dateFilter: any = {}

    if (month) {
      const [year, monthNum] = month.split('-').map(Number)
      const monthStart = new Date(year, monthNum - 1, 1)
      const monthEnd = new Date(year, monthNum, 1)
      dateFilter = {
        gte: monthStart,
        lt: monthEnd,
      }
    } else if (startDate || endDate) {
      if (startDate) {
        dateFilter.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setDate(end.getDate() + 1)
        dateFilter.lt = end
      }
    } else {
      // Default: joriy oy
      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      dateFilter = {
        gte: monthStart,
        lt: monthEnd,
      }
    }

    // O'qituvchining guruhlaridagi davomatlarni olish
    const groupIds = teacher.groups.map((g) => g.id)

    // Darslar (unique sanalar) sonini olish
    const lessons = await prisma.attendance.findMany({
      where: {
        groupId: { in: groupIds },
        date: dateFilter,
      },
      select: {
        groupId: true,
        date: true,
      },
      distinct: ['groupId', 'date'],
    })

    // Guruhlar bo'yicha darslar sonini hisoblash
    const lessonsPerGroup: Record<string, number> = {}
    lessons.forEach((lesson) => {
      if (!lessonsPerGroup[lesson.groupId]) {
        lessonsPerGroup[lesson.groupId] = 0
      }
      lessonsPerGroup[lesson.groupId]++
    })

    // Har bir guruh uchun davomat statistikasi
    const groupStats = await Promise.all(
      teacher.groups.map(async (group) => {
        const stats = await prisma.attendance.groupBy({
          by: ['status'],
          where: {
            groupId: group.id,
            date: dateFilter,
          },
          _count: true,
        })

        const totalRecords = stats.reduce((sum, s) => sum + s._count, 0)
        const presentCount = stats.find((s) => s.status === 'PRESENT')?._count || 0
        const lateCount = stats.find((s) => s.status === 'LATE')?._count || 0
        const absentCount = stats.find((s) => s.status === 'ABSENT')?._count || 0

        // O'qituvchi foizini olish
        const teacherCourse = teacher.teacherCourses.find(
          (tc) => tc.courseId === group.courseId
        )
        const teacherPercentage = teacherCourse?.percentage || 50

        // Guruh narxi
        const groupPrice = group.price || group.course.price

        return {
          group: {
            id: group.id,
            name: group.name,
            course: group.course,
            studentCount: group._count.groupStudents,
            price: groupPrice,
          },
          lessonsCount: lessonsPerGroup[group.id] || 0,
          stats: {
            totalRecords,
            present: presentCount,
            late: lateCount,
            absent: absentCount,
            attendanceRate: totalRecords > 0
              ? Math.round(((presentCount + lateCount) / totalRecords) * 100)
              : 0,
          },
          teacherPercentage,
        }
      })
    )

    // Umumiy statistika
    const totalLessons = Object.values(lessonsPerGroup).reduce((a, b) => a + b, 0)

    // Taxminiy oylik maosh hisoblash
    // Formula: (Guruh narxi × O'qituvchi foizi × Kelgan talabalar) / Guruh talabalar soni
    let estimatedSalary = 0

    for (const gs of groupStats) {
      if (gs.stats.totalRecords > 0 && gs.group.studentCount > 0) {
        const avgAttendance = (gs.stats.present + gs.stats.late) / gs.lessonsCount || 0
        const perLesson =
          (Number(gs.group.price) * (gs.teacherPercentage / 100) * avgAttendance) /
          gs.group.studentCount
        estimatedSalary += perLesson * gs.lessonsCount
      }
    }

    // So'nggi darslar ro'yxati
    const recentAttendances = await prisma.attendance.findMany({
      where: {
        groupId: { in: groupIds },
        date: dateFilter,
      },
      select: {
        id: true,
        date: true,
        groupId: true,
        status: true,
        group: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { date: 'desc' },
      distinct: ['groupId', 'date'],
      take: 20,
    })

    // Sanalar bo'yicha guruhlash
    const lessonsByDate: Record<
      string,
      { groupId: string; groupName: string; present: number; absent: number }[]
    > = {}

    for (const att of recentAttendances) {
      const dateKey = new Date(att.date).toISOString().split('T')[0]
      if (!lessonsByDate[dateKey]) {
        lessonsByDate[dateKey] = []
      }

      // Shu sana va guruh uchun statistika olish
      const dayStats = await prisma.attendance.groupBy({
        by: ['status'],
        where: {
          groupId: att.groupId,
          date: {
            gte: new Date(dateKey),
            lt: new Date(new Date(dateKey).getTime() + 86400000),
          },
        },
        _count: true,
      })

      const presentCount =
        (dayStats.find((s) => s.status === 'PRESENT')?._count || 0) +
        (dayStats.find((s) => s.status === 'LATE')?._count || 0)
      const absentCount = dayStats.find((s) => s.status === 'ABSENT')?._count || 0

      // Takrorlanmasligini tekshirish
      const exists = lessonsByDate[dateKey].some((l) => l.groupId === att.groupId)
      if (!exists) {
        lessonsByDate[dateKey].push({
          groupId: att.groupId,
          groupName: att.group.name,
          present: presentCount,
          absent: absentCount,
        })
      }
    }

    return NextResponse.json({
      teacher: {
        id: teacher.id,
        firstName: teacher.firstName,
        lastName: teacher.lastName,
        groups: teacher.groups.map((g) => ({
          id: g.id,
          name: g.name,
          studentCount: g._count.groupStudents,
        })),
      },
      period: {
        startDate: dateFilter.gte,
        endDate: dateFilter.lt,
      },
      summary: {
        totalGroups: teacher.groups.length,
        totalLessons,
        estimatedSalary: Math.round(estimatedSalary),
      },
      groupStats,
      recentLessons: lessonsByDate,
    })
  } catch (error) {
    console.error('Get teacher attendance error:', error)
    return NextResponse.json(
      { error: "O'qituvchi davomatini yuklashda xatolik" },
      { status: 500 }
    )
  }
})
