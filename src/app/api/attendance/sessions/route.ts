import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/api-middleware'

// Davomat sessiyalarini olish (guruh + sana bo'yicha guruhlangan)
export const GET = withAuth(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const groupId = searchParams.get('groupId') || ''
    const teacherId = searchParams.get('teacherId') || ''
    const startDate = searchParams.get('startDate') || ''
    const endDate = searchParams.get('endDate') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Filter shartlarini tuzish
    const where: any = {}

    if (groupId) {
      where.groupId = groupId
    }

    if (teacherId) {
      where.group = {
        teacherId: teacherId,
      }
    }

    // Sana filterlari
    if (startDate || endDate) {
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

    // Unique (groupId, date) kombinatsiyalarini olish
    const uniqueSessions = await prisma.attendance.findMany({
      where,
      select: {
        groupId: true,
        date: true,
      },
      distinct: ['groupId', 'date'],
      orderBy: { date: 'desc' },
    })

    const total = uniqueSessions.length
    const skip = (page - 1) * limit
    const paginatedSessions = uniqueSessions.slice(skip, skip + limit)

    // Har bir sessiya uchun statistika olish
    const sessions = await Promise.all(
      paginatedSessions.map(async (session) => {
        const targetDate = new Date(session.date)
        const nextDay = new Date(targetDate)
        nextDay.setDate(nextDay.getDate() + 1)

        // Guruh ma'lumotlari
        const group = await prisma.group.findUnique({
          where: { id: session.groupId },
          select: {
            id: true,
            name: true,
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
            _count: {
              select: {
                groupStudents: true,
              },
            },
          },
        })

        // Davomat statistikasi
        const stats = await prisma.attendance.groupBy({
          by: ['status'],
          where: {
            groupId: session.groupId,
            date: {
              gte: targetDate,
              lt: nextDay,
            },
          },
          _count: true,
        })

        const totalStudents = stats.reduce((sum, s) => sum + s._count, 0)
        const presentCount = stats.find((s) => s.status === 'PRESENT')?._count || 0
        const lateCount = stats.find((s) => s.status === 'LATE')?._count || 0
        const absentCount = stats.find((s) => s.status === 'ABSENT')?._count || 0
        const excusedCount = stats.find((s) => s.status === 'EXCUSED')?._count || 0

        return {
          groupId: session.groupId,
          date: session.date,
          group,
          stats: {
            total: totalStudents,
            present: presentCount,
            late: lateCount,
            absent: absentCount,
            excused: excusedCount,
            attendanceRate: totalStudents > 0
              ? Math.round(((presentCount + lateCount) / totalStudents) * 100)
              : 0,
          },
        }
      })
    )

    return NextResponse.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Get attendance sessions error:', error)
    return NextResponse.json(
      { error: 'Davomat sessiyalarini yuklashda xatolik' },
      { status: 500 }
    )
  }
})
