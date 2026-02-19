import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withRole, getUser } from '@/lib/api-middleware'

// Davomat hisobotini olish - faqat SUPER_ADMIN
async function handleGET(request: NextRequest) {
  try {
    const user = getUser(request)
    if (!user || user.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Ruxsat yo\'q' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const groupId = searchParams.get('groupId')

    // Sana filtrlari
    const dateFilter: any = {}
    if (from) {
      dateFilter.gte = new Date(from)
    }
    if (to) {
      dateFilter.lte = new Date(to + 'T23:59:59')
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        ...(Object.keys(dateFilter).length > 0 && { date: dateFilter }),
        ...(groupId && { groupId })
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        },
        group: {
          select: {
            name: true,
            course: {
              select: { name: true }
            },
            teacher: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { group: { name: 'asc' } }
      ]
    })

    // Excel uchun formatlash
    const data = attendances.map((a, index) => ({
      '№': index + 1,
      'Talaba': `${a.student.lastName} ${a.student.firstName}`,
      'Telefon': a.student.phone,
      'Guruh': a.group.name,
      'Kurs': a.group.course.name,
      'O\'qituvchi': `${a.group.teacher.lastName} ${a.group.teacher.firstName}`,
      'Sana': new Date(a.date).toLocaleDateString('uz-UZ'),
      'Holat': getStatusLabel(a.status),
      'Izoh': a.notes || '-'
    }))

    return NextResponse.json(data)
  } catch (error) {
    console.error('[Reports/Attendance GET] Error:', error)
    return NextResponse.json(
      { error: 'Hisobotni yuklashda xatolik' },
      { status: 500 }
    )
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'PRESENT': 'Keldi',
    'ABSENT': 'Kelmadi',
    'LATE': 'Kechikdi',
    'EXCUSED': 'Sababli'
  }
  return labels[status] || status
}

export const GET = withRole(['SUPER_ADMIN'], handleGET)
