import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

// Guruh davomatini olish
export const GET = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: groupId } = await params
    const searchParams = request.nextUrl.searchParams
    const date = searchParams.get('date') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Guruh mavjudligini tekshirish
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
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
            price: true,
          },
        },
        groupStudents: {
          where: { status: 'ACTIVE' },
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
            student: {
              lastName: 'asc',
            },
          },
        },
        _count: {
          select: {
            groupStudents: true,
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

    // Davomat filterlari
    const where: any = { groupId }

    if (date) {
      const targetDate = new Date(date)
      const nextDay = new Date(targetDate)
      nextDay.setDate(nextDay.getDate() + 1)
      where.date = {
        gte: targetDate,
        lt: nextDay,
      }
    } else if (startDate || endDate) {
      where.date = {}
      if (startDate) {
        where.date.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setDate(end.getDate() + 1)
        where.date.lt = end
      }
    }

    // Umumiy sonni olish
    const total = await prisma.attendance.count({ where })

    // Pagination
    const skip = (page - 1) * limit

    // Davomatlarni olish
    const attendances = await prisma.attendance.findMany({
      where,
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
      orderBy: [{ date: 'desc' }, { student: { lastName: 'asc' } }],
      skip,
      take: limit,
    })

    // Sanalar bo'yicha guruhlash
    const attendancesByDate: Record<string, any[]> = {}
    attendances.forEach((att) => {
      const dateKey = new Date(att.date).toISOString().split('T')[0]
      if (!attendancesByDate[dateKey]) {
        attendancesByDate[dateKey] = []
      }
      attendancesByDate[dateKey].push(att)
    })

    // Davomat statistikasi
    const stats = await prisma.attendance.groupBy({
      by: ['status'],
      where: { groupId },
      _count: true,
    })

    const totalAttendances = stats.reduce((sum, s) => sum + s._count, 0)
    const presentCount = stats.find((s) => s.status === 'PRESENT')?._count || 0
    const absentCount = stats.find((s) => s.status === 'ABSENT')?._count || 0
    const lateCount = stats.find((s) => s.status === 'LATE')?._count || 0
    const excusedCount = stats.find((s) => s.status === 'EXCUSED')?._count || 0

    // Unique sanalar soni (darslar soni)
    const uniqueDates = await prisma.attendance.findMany({
      where: { groupId },
      select: { date: true },
      distinct: ['date'],
    })

    // Talabalar bo'yicha davomat statistikasi (eng yaxshi/yomon)
    const studentStats = await prisma.attendance.groupBy({
      by: ['studentId', 'status'],
      where: { groupId },
      _count: true,
    })

    // Talabalar bo'yicha statistikani formatlash
    const studentStatsMap: Record<string, { present: number; late: number; absent: number; total: number }> = {}
    studentStats.forEach((stat) => {
      if (!studentStatsMap[stat.studentId]) {
        studentStatsMap[stat.studentId] = { present: 0, late: 0, absent: 0, total: 0 }
      }
      if (stat.status === 'PRESENT') studentStatsMap[stat.studentId].present = stat._count
      else if (stat.status === 'LATE') studentStatsMap[stat.studentId].late = stat._count
      else if (stat.status === 'ABSENT') studentStatsMap[stat.studentId].absent = stat._count
      studentStatsMap[stat.studentId].total += stat._count
    })

    // Talabalar ro'yxati
    const studentIds = Object.keys(studentStatsMap)
    const students = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    })

    // Talabalar statistikasi (foiz bilan)
    const studentsWithStats = students.map((s) => {
      const stats = studentStatsMap[s.id]
      const attendanceRate = stats.total > 0
        ? Math.round(((stats.present + stats.late) / stats.total) * 100)
        : 0
      return {
        student: s,
        stats: { ...stats, attendanceRate },
      }
    }).sort((a, b) => b.stats.attendanceRate - a.stats.attendanceRate)

    // Eng yaxshi va eng yomon
    const bestStudent = studentsWithStats.length > 0 ? studentsWithStats[0] : null
    const worstStudent = studentsWithStats.length > 0 ? studentsWithStats[studentsWithStats.length - 1] : null

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        teacher: group.teacher,
        course: group.course,
        students: group.groupStudents.map((gs) => gs.student),
        studentCount: group._count.groupStudents,
      },
      attendances,
      attendancesByDate,
      stats: {
        totalLessons: uniqueDates.length,
        totalAttendances,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        excused: excusedCount,
        attendanceRate: totalAttendances > 0
          ? Math.round(((presentCount + lateCount) / totalAttendances) * 100)
          : 0,
      },
      studentRankings: {
        best: bestStudent,
        worst: worstStudent,
        all: studentsWithStats,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get group attendance error:', error)
    return NextResponse.json(
      { error: 'Guruh davomatini yuklashda xatolik' },
      { status: 500 }
    )
  }
})

// Guruh uchun bir sanada davomat olish (mark uchun)
export const POST = withAuth(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: groupId } = await params

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Noto'g'ri JSON format" },
        { status: 400 }
      )
    }

    const { date } = body

    if (!date) {
      return NextResponse.json(
        { error: 'Sana kiritilishi kerak' },
        { status: 400 }
      )
    }

    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    const nextDay = new Date(targetDate)
    nextDay.setDate(nextDay.getDate() + 1)

    // Guruh mavjudligini tekshirish
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
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
        groupStudents: {
          where: { status: 'ACTIVE' },
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
            student: {
              lastName: 'asc',
            },
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

    // Shu sanadagi davomatlarni olish
    const existingAttendances = await prisma.attendance.findMany({
      where: {
        groupId,
        date: {
          gte: targetDate,
          lt: nextDay,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    // Talabalar ro'yxatini tayyorlash (mavjud davomat bilan)
    const students = group.groupStudents.map((gs) => {
      const existingAtt = existingAttendances.find(
        (att) => att.studentId === gs.student.id
      )
      return {
        ...gs.student,
        attendance: existingAtt
          ? {
              id: existingAtt.id,
              status: existingAtt.status,
              notes: existingAtt.notes,
            }
          : null,
      }
    })

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        teacher: group.teacher,
        course: group.course,
      },
      date: targetDate.toISOString(),
      students,
      hasExistingAttendance: existingAttendances.length > 0,
    })
  } catch (error) {
    console.error('Get group attendance for date error:', error)
    return NextResponse.json(
      { error: 'Guruh davomatini yuklashda xatolik' },
      { status: 500 }
    )
  }
})
